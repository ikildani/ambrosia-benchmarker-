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

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_RUNTIME_MS = 250_000;
const SEC_SEARCH = 'https://efts.sec.gov/LATEST/search-index';

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
  console.log(`[cron-backfill] Processing ${search.type} deals, page ${page}...`);

  // Search SEC EDGAR
  const params = new URLSearchParams({
    q: search.query,
    forms: '8-K,8-K/A,6-K',
    items: '1.01',
    from: String(page * 20),
    size: '20',
  });

  const searchResponse = await fetchWithTimeout(`${SEC_SEARCH}?${params}`, {
    headers: {
      'User-Agent': 'Ambrosia Ventures Deal Calculator research@ambrosiaventures.co',
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
      console.log(`[cron-backfill] No more results for ${search.type}, moving to next search type`);
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

        result.extracted++;

        const licensorId = await findOrCreateCompany(supabase, deal.licensor, false);
        const licenseeId = await findOrCreateCompany(supabase, deal.licensee, true);
        const ta = deriveTherapeuticArea(deal.indication_category);

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
          extraction_model: 'claude-sonnet-4-20250514',
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

  // Also reclassify any 'other' deals using indication_category mapping
  const taMap: Record<string, string[]> = {
    cardiovascular: ['cardiovascular', 'cardiac', 'heart_failure', 'hypertension', 'thrombosis', 'cardiomyopathy'],
    neurology: ['cns', 'alzheimers', 'parkinsons', 'epilepsy', 'migraine', 'schizophrenia', 'depression', 'neurodegeneration'],
    immunology: ['autoimmune', 'rheumatoid_arthritis', 'lupus', 'inflammatory_bowel', 'psoriasis', 'atopic_dermatitis'],
    metabolic: ['metabolic', 'diabetes', 'obesity', 'nash', 'dyslipidemia', 'type_2_diabetes'],
    infectiousDisease: ['infectious', 'hiv', 'hepatitis', 'rsv', 'influenza', 'covid_19', 'antiviral', 'vaccine'],
    rareDisease: ['rare_disease', 'orphan', 'gene_therapy', 'sma', 'duchenne', 'hemophilia', 'cystic_fibrosis'],
    hematology: ['hematology', 'leukemia', 'lymphoma', 'myeloma', 'myelofibrosis', 'anemia', 'sickle_cell'],
    ophthalmology: ['ophthalmology', 'retinal', 'glaucoma', 'macular', 'ocular', 'dry_eye'],
    dermatology: ['dermatology', 'eczema', 'acne', 'vitiligo', 'alopecia'],
    gastroenterology: ['gastroenterology', 'celiac', 'ibs', 'ibd', 'nash', 'liver_fibrosis'],
    womensHealth: ['reproductive', 'endometriosis', 'uterine', 'fertility', 'menopause', 'gynecology'],
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

  console.log(`[cron-backfill] Done: ${result.inserted} inserted, next: ${DEAL_SEARCHES[result.nextSearchIndex]?.type || 'restart'} p${result.nextPage}`);

  return NextResponse.json({ success: true, ...result });
}
