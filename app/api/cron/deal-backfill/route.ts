/**
 * Cron Route: Automated 8-K Deal Backfill
 *
 * Cycles through deal types and pages on each run, processing a batch of
 * SEC EDGAR 8-K Item 1.01 filings. Tracks progress in the database so each
 * run picks up where the last one left off.
 *
 * Schedule: Every 6 hours (0 0,6,12,18 * * *)
 * Each run processes ~15-20 filings within the time budget, yielding ~5-15 new deals.
 * Over a week: 28 runs × ~10 deals = ~280 new deals/week from SEC filings alone.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import {
  fetchFilingContent,
  extractDealFromFiling,
  findOrCreateCompany,
  deriveTherapeuticArea,
} from '@/lib/ingestion/sec-edgar';
import { validateExtractedDeal } from '@/lib/ingestion/deal-extraction-validator';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_RUNTIME_MS = 250_000;
const SEC_SEARCH = 'https://efts.sec.gov/LATEST/search-index';

function getDateRange(): { dateStart: string; dateEnd: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    dateStart: start.toISOString().split('T')[0],
    dateEnd: end.toISOString().split('T')[0],
  };
}

// Cycle through these deal searches — each cron run processes one
const DEAL_SEARCHES = [
  { type: 'license', query: '"license agreement" "upfront" "milestone"' },
  { type: 'collaboration', query: '"collaboration agreement" "upfront"' },
  { type: 'option', query: '"option agreement" "pharma"' },
  { type: 'acquisition', query: '"acquisition" "merger agreement" "pharma"' },
  { type: 'royalty', query: '"royalty" "license" "pharma" "milestone"' },
  { type: 'license2', query: '"exclusive license" "pharma" "upfront payment"' },
  { type: 'collab2', query: '"research collaboration" "pharma" "milestone"' },
  { type: 'codev', query: '"co-development" "pharma" "cost sharing"' },
];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const supabase = createServiceClient();
  const startTime = Date.now();

  // Get the current progress cursor from the database
  const { data: cursor } = await supabase
    .from('data_ingestion_log')
    .select('parameters')
    .eq('source', 'cron_deal_backfill')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  let searchIndex = (cursor?.parameters as Record<string, number>)?.nextSearchIndex || 0;
  let page = (cursor?.parameters as Record<string, number>)?.nextPage || 0;

  // Wrap around if we've exhausted all searches
  if (searchIndex >= DEAL_SEARCHES.length) {
    searchIndex = 0;
    page = 0; // Reset pages when cycling back
  }

  const search = DEAL_SEARCHES[searchIndex];
  const { dateStart, dateEnd } = getDateRange();
  // Search SEC EDGAR — rolling 30-day window to continuously find new filings
  const params = new URLSearchParams({
    q: search.query,
    forms: '8-K,8-K/A,6-K',
    dateRange: 'custom',
    startdt: dateStart,
    enddt: dateEnd,
    from: String(page * 20),
    size: '20',
  });

  const searchResponse = await fetchWithTimeout(`${SEC_SEARCH}?${params}`, {
    headers: {
      'User-Agent': 'Solidus research@ambrosiaventures.co',
      'Accept': 'application/json',
    },
    timeoutMs: 20_000,
    retries: 1,
  });

  const result = {
    searchType: search.type,
    page,
    fetched: 0,
    extracted: 0,
    inserted: 0,
    skipped: 0,
    byTA: {} as Record<string, number>,
    errors: [] as string[],
    nextSearchIndex: searchIndex,
    nextPage: page + 1,
  };

  if (!searchResponse.ok) {
    result.errors.push(`SEC search failed: ${searchResponse.status}`);
  } else {
    const data = await searchResponse.json();
    const total = data.hits?.total?.value || 0;
    const hits = data.hits?.hits || [];

    // If no more results for this search type, move to next
    if (hits.length === 0) {
      result.nextSearchIndex = searchIndex + 1;
      result.nextPage = 0;
    }

    for (const hit of hits) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) break;

      const docId = hit._id || '';
      const parts = docId.split(':');
      const accession = parts[0] || '';
      const fileName = parts[1] || '';
      const cik = (hit._source?.ciks?.[0] || '').replace(/^0+/, '');
      const accessionFormatted = accession.replace(/-/g, '');

      const url = cik && accessionFormatted && fileName
        ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionFormatted}/${fileName}`
        : '';

      if (!url) continue;

      // Check if already processed
      const { data: existing } = await supabase
        .from('deals')
        .select('id')
        .eq('source_url', url)
        .limit(1)
        .single();

      if (existing) {
        result.skipped++;
        continue;
      }

      try {
        const content = await fetchFilingContent(url);
        result.fetched++;

        if (content.length < 500) continue;

        const deal = await extractDealFromFiling(content, anthropicApiKey);

        if (!deal || deal.confidence_score < 75 || !deal.licensor || !deal.licensee) continue;

        const validation = validateExtractedDeal(deal);
        if (!validation.valid) {
          console.log(`[deal-backfill] Rejected deal (${validation.rejectCode}): ${deal.licensor} / ${deal.licensee}`);
          continue;
        }

        result.extracted++;

        const licensorId = await findOrCreateCompany(supabase, deal.licensor, false);
        const licenseeId = await findOrCreateCompany(supabase, deal.licensee, true);
        const ta = deriveTherapeuticArea(deal.indication_category);

        const { classifyAndEnrichDeal } = await import('@/lib/ingestion/company-geography');
        const geo = classifyAndEnrichDeal(deal.licensor, deal.licensee);

        const { error: insertError } = await supabase.from('deals').insert({
          licensor_name: deal.licensor,
          licensor_id: licensorId,
          licensee_name: deal.licensee,
          licensee_id: licenseeId,
          asset_name: deal.asset_name,
          asset_description: deal.extraction_notes,
          modality: deal.modality,
          indication_category: deal.indication_category,
          indication_specific: deal.indication_specific,
          target: deal.target,
          mechanism_of_action: deal.mechanism_of_action,
          phase_at_signing: deal.phase_at_signing,
          territory: deal.territory || 'global',
          deal_type: deal.deal_type,
          upfront_usd: deal.upfront_usd,
          milestones_total_usd: deal.milestones_total_usd,
          milestones_development_usd: deal.milestones_development_usd,
          milestones_regulatory_usd: deal.milestones_regulatory_usd,
          milestones_commercial_usd: deal.milestones_commercial_usd,
          royalty_low_pct: deal.royalty_low_pct,
          royalty_high_pct: deal.royalty_high_pct,
          total_deal_value_usd: deal.total_deal_value_usd,
          announced_date: hit._source?.file_date || new Date().toISOString().split('T')[0],
          source_type: 'sec_8k',
          source_url: url,
          terms_disclosed: deal.upfront_usd !== null || deal.milestones_total_usd !== null,
          confidence_score: deal.confidence_score,
          extraction_notes: deal.extraction_notes,
          extraction_model: 'claude-opus-4-6',
          extraction_timestamp: new Date().toISOString(),
          therapeutic_area: ta,
          milestone_details: deal.milestone_details,
          research_funding_usd: deal.research_funding_usd,
          profit_share_pct: deal.profit_share_pct,
          cost_share_ratio: deal.cost_share_ratio,
          opt_in_rights: deal.opt_in_rights,
          opt_in_stage: deal.opt_in_stage,
          regulatory_designations: deal.regulatory_designations,
          term_years: deal.term_years,
          sublicense_rights: deal.sublicense_rights,
          rights_retained: deal.rights_retained,
          indications_licensed: deal.indications_licensed,
          includes_diagnostics: deal.includes_diagnostics,
          licensor_country: geo.licensor_country !== 'unknown' ? geo.licensor_country : null,
          licensee_country: geo.licensee_country !== 'unknown' ? geo.licensee_country : null,
          licensor_region: geo.licensor_region !== 'unknown' ? geo.licensor_region : null,
          licensee_region: geo.licensee_region !== 'unknown' ? geo.licensee_region : null,
          cross_border: geo.cross_border,
          deal_corridor: geo.deal_corridor,
        });

        if (insertError && insertError.code !== '23505') {
          result.errors.push(insertError.message);
        } else if (!insertError) {
          result.inserted++;
          result.byTA[ta] = (result.byTA[ta] || 0) + 1;
        }

        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        result.errors.push(`${url}: ${err}`);
      }
    }
  }

  // Save progress cursor for next run
  await supabase.from('data_ingestion_log').insert({
    source: 'cron_deal_backfill',
    run_type: 'cron',
    parameters: {
      searchType: search.type,
      page,
      nextSearchIndex: result.nextSearchIndex,
      nextPage: result.nextPage,
    },
    records_fetched: result.fetched,
    records_processed: result.extracted,
    records_inserted: result.inserted,
    records_failed: result.errors.length,
    errors: result.errors.slice(0, 50),
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  // Reclassify 'other' deals using comprehensive indication_category mapping
  const taMap: Record<string, string[]> = {
    oncology: ['solid_tumor', 'solid_tumors', 'hematological', 'hematologic', 'heme_onc', 'lung_cancer', 'breast_cancer', 'prostate_cancer', 'colorectal_cancer', 'pancreatic_cancer', 'liver_cancer', 'melanoma', 'glioblastoma', 'bladder_cancer', 'renal_cell_carcinoma', 'head_and_neck_cancer'],
    cardiovascular: ['cardiovascular', 'cardiac', 'heart_failure', 'hypertension', 'thrombosis', 'cardiomyopathy', 'atrial_fibrillation', 'atherosclerosis', 'pulmonary_hypertension', 'coronary', 'arrhythmia', 'attr_cardiomyopathy', 'pah'],
    neurology: ['cns', 'alzheimers', 'parkinsons', 'epilepsy', 'migraine', 'schizophrenia', 'depression', 'neurodegeneration', 'multiple_sclerosis', 'als', 'huntingtons', 'neuropathic_pain', 'bipolar', 'adhd', 'insomnia', 'stroke', 'spasticity', 'parkinsons_disease', 'alzheimers_disease'],
    immunology: ['autoimmune', 'rheumatoid_arthritis', 'lupus', 'inflammatory_bowel', 'psoriasis', 'atopic_dermatitis', 'psoriatic_arthritis', 'ankylosing_spondylitis', 'vasculitis', 'myasthenia_gravis', 'ibd', 'crohns', 'ulcerative_colitis', 'iga_nephropathy', 'gvhd', 'multiple_sclerosis', 'respiratory', 'pulmonary', 'asthma', 'copd'],
    metabolic: ['metabolic', 'diabetes', 'obesity', 'nash', 'mash', 'dyslipidemia', 'type_2_diabetes', 'type_1_diabetes', 'gout', 'fatty_liver', 'hypercholesterolemia', 'hypertriglyceridemia', 'pcsk9', 'sglt2', 'glp1'],
    infectiousDisease: ['infectious', 'hiv', 'hepatitis', 'hbv', 'hcv', 'rsv', 'influenza', 'covid_19', 'covid', 'antiviral', 'antibiotic', 'antimicrobial', 'vaccine', 'fungal', 'tuberculosis', 'malaria', 'bacterial'],
    rareDisease: ['rare_disease', 'orphan', 'gene_therapy', 'sma', 'duchenne', 'dmd', 'hemophilia', 'cystic_fibrosis', 'fabry', 'gaucher', 'pompe', 'hunter', 'sickle_cell', 'thalassemia', 'attr_amyloidosis', 'pnh', 'hae', 'angelman', 'dravet', 'friedreich', 'achondroplasia', 'wilson_disease'],
    hematology: ['hematology', 'leukemia', 'lymphoma', 'myeloma', 'multiple_myeloma', 'myelofibrosis', 'anemia', 'sickle_cell_disease', 'thrombocytopenia', 'coagulation', 'hemophilia_a', 'hemophilia_b', 'aml', 'cll', 'all', 'dlbcl', 'mds', 'polycythemia_vera', 'itp'],
    ophthalmology: ['ophthalmology', 'retinal', 'glaucoma', 'macular', 'wet_amd', 'dry_amd', 'ocular', 'dry_eye', 'diabetic_retinopathy', 'uveitis', 'geographic_atrophy', 'inherited_retinal'],
    dermatology: ['dermatology', 'eczema', 'acne', 'vitiligo', 'alopecia', 'alopecia_areata', 'hidradenitis', 'rosacea', 'prurigo', 'molluscum', 'actinic_keratosis', 'hyperhidrosis', 'skin_fibrosis'],
    gastroenterology: ['gastroenterology', 'celiac', 'ibs', 'ibd', 'nash', 'liver_fibrosis', 'gerd', 'eosinophilic_esophagitis', 'c_difficile', 'pancreatitis', 'primary_biliary_cholangitis', 'short_bowel'],
    womensHealth: ['reproductive', 'endometriosis', 'uterine', 'uterine_fibroids', 'fertility', 'menopause', 'gynecology', 'pcos', 'preeclampsia', 'postpartum', 'contraception', 'ovarian_cancer', 'cervical_cancer', 'breast_cancer'],
  };

  for (const [ta, categories] of Object.entries(taMap)) {
    for (const cat of categories) {
      await supabase
        .from('deals')
        .update({ therapeutic_area: ta })
        .eq('therapeutic_area', 'other')
        .eq('indication_category', cat);
    }
  }

  // Recalculate company deal stats for companies with new deals
  if (result.inserted > 0) {
    try {
      const { data: recentDeals } = await supabase
        .from('deals')
        .select('licensor_id, licensee_id')
        .order('created_at', { ascending: false })
        .limit(result.inserted * 2);

      const companyIds = new Set<string>();
      for (const deal of recentDeals || []) {
        if (deal.licensor_id) companyIds.add(deal.licensor_id);
        if (deal.licensee_id) companyIds.add(deal.licensee_id);
      }

      for (const companyId of companyIds) {
        try { await supabase.rpc('update_company_deal_stats', { p_company_id: companyId }); } catch {}
      }
    } catch {
      // Company stats update failed (non-fatal)
    }
  }

  // Intelligence tracking
  try {
    await runCronIntelligence(supabase, 'deal-backfill', {
      processed: result.fetched,
      inserted: result.inserted,
    });
  } catch {}

  return NextResponse.json({ success: true, ...result });
}
