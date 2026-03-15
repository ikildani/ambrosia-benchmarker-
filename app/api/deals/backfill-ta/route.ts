/**
 * API Route: SEC EDGAR Backfill by Therapeutic Area
 * Searches SEC full-text search for TA-specific deal filings,
 * then uses the production-grade extraction pipeline from sec-edgar.ts.
 *
 * POST /api/deals/backfill-ta?ta=neurology,cardiovascular,metabolic
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

// TA-specific search queries for SEC EDGAR full-text search
const TA_SEARCH_CONFIGS: Record<string, { terms: string[]; minDeals: number }> = {
  neurology: {
    terms: [
      '"neurology" "license agreement"',
      '"CNS" "collaboration agreement"',
      '"Alzheimer" "license"',
      '"Parkinson" "collaboration"',
      '"epilepsy" "license agreement"',
      '"neurodegenerat" "agreement"',
      '"migraine" "partnership"',
      '"multiple sclerosis" "license"',
      '"schizophrenia" "collaboration"',
      '"depression" "license agreement"',
    ],
    minDeals: 500,
  },
  immunology: {
    terms: [
      '"autoimmune" "license agreement"',
      '"immunology" "collaboration"',
      '"rheumatoid arthritis" "license"',
      '"lupus" "collaboration agreement"',
      '"psoriasis" "license"',
      '"inflammatory bowel" "agreement"',
      '"atopic dermatitis" "collaboration"',
      '"Crohn" "license agreement"',
      '"ulcerative colitis" "license"',
    ],
    minDeals: 500,
  },
  metabolic: {
    terms: [
      '"diabetes" "license agreement"',
      '"obesity" "collaboration"',
      '"GLP-1" "agreement"',
      '"NASH" "license"',
      '"metabolic" "collaboration agreement"',
      '"dyslipidemia" "license"',
      '"insulin" "license agreement"',
      '"type 2 diabetes" "collaboration"',
      '"PCSK9" "license"',
      '"SGLT2" "agreement"',
    ],
    minDeals: 400,
  },
  cardiovascular: {
    terms: [
      '"cardiovascular" "license agreement"',
      '"heart failure" "collaboration"',
      '"hypertension" "license"',
      '"cardiomyopathy" "agreement"',
      '"thrombosis" "license agreement"',
      '"atrial fibrillation" "collaboration"',
      '"atherosclerosis" "license"',
      '"pulmonary hypertension" "agreement"',
      '"anticoagulant" "license"',
      '"ATTR" "agreement"',
    ],
    minDeals: 400,
  },
  infectiousDisease: {
    terms: [
      '"infectious disease" "license agreement"',
      '"antibiotic" "collaboration"',
      '"antiviral" "license"',
      '"vaccine" "collaboration agreement"',
      '"HIV" "license agreement"',
      '"hepatitis" "collaboration"',
      '"antimicrobial" "license"',
      '"RSV" "license agreement"',
      '"COVID" "license agreement"',
      '"influenza" "collaboration"',
    ],
    minDeals: 350,
  },
  rareDisease: {
    terms: [
      '"rare disease" "license agreement"',
      '"orphan drug" "collaboration"',
      '"gene therapy" "license"',
      '"enzyme replacement" "agreement"',
      '"cystic fibrosis" "license"',
      '"muscular dystrophy" "collaboration"',
      '"sickle cell" "license agreement"',
      '"spinal muscular atrophy" "agreement"',
      '"hemophilia" "license"',
      '"Fabry" "agreement"',
    ],
    minDeals: 350,
  },
  ophthalmology: {
    terms: [
      '"ophthalmology" "license agreement"',
      '"retinal" "collaboration"',
      '"macular degeneration" "license"',
      '"glaucoma" "agreement"',
      '"ocular" "license agreement"',
      '"dry eye" "collaboration"',
      '"diabetic retinopathy" "license"',
    ],
    minDeals: 250,
  },
  dermatology: {
    terms: [
      '"dermatology" "license agreement"',
      '"psoriasis" "collaboration"',
      '"eczema" "license"',
      '"acne" "agreement"',
      '"atopic dermatitis" "license agreement"',
      '"vitiligo" "collaboration"',
      '"alopecia" "license"',
      '"hidradenitis" "agreement"',
    ],
    minDeals: 250,
  },
  hematology: {
    terms: [
      '"hematology" "license agreement"',
      '"hemophilia" "collaboration"',
      '"sickle cell" "license"',
      '"thalassemia" "agreement"',
      '"anemia" "license agreement"',
      '"coagulation" "collaboration"',
      '"leukemia" "license agreement"',
      '"lymphoma" "collaboration"',
      '"myeloma" "license"',
      '"myelofibrosis" "agreement"',
    ],
    minDeals: 300,
  },
  gastroenterology: {
    terms: [
      '"gastroenterology" "license agreement"',
      '"inflammatory bowel" "collaboration"',
      '"Crohn" "license"',
      '"celiac" "agreement"',
      '"NASH" "license agreement"',
      '"liver fibrosis" "collaboration"',
      '"ulcerative colitis" "agreement"',
      '"eosinophilic esophagitis" "license"',
    ],
    minDeals: 250,
  },
  womensHealth: {
    terms: [
      '"endometriosis" "license agreement"',
      '"uterine fibroids" "collaboration"',
      '"fertility" "license"',
      '"contraceptive" "agreement"',
      '"reproductive" "license agreement"',
      '"menopause" "collaboration"',
      '"ovarian" "license agreement"',
      '"breast cancer" "collaboration"',
    ],
    minDeals: 200,
  },
};

const SEC_FULL_TEXT_SEARCH = 'https://efts.sec.gov/LATEST/search-index';

interface SECSearchResult {
  accession: string;
  company: string;
  date: string;
  url: string;
}

/**
 * Search SEC EDGAR full-text search API for TA-specific deal terms.
 * Constructs proper document URLs using cik + accession + file_name.
 */
async function searchSECForTA(
  term: string,
  daysBack: number = 365 * 7
): Promise<SECSearchResult[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const params = new URLSearchParams({
    q: term,
    dateRange: 'custom',
    startdt: formatDate(startDate),
    enddt: formatDate(endDate),
    forms: '8-K,8-K/A,6-K',
    from: '0',
    size: '100',
  });

  const response = await fetchWithTimeout(`${SEC_FULL_TEXT_SEARCH}?${params}`, {
    headers: {
      'User-Agent': 'Ambrosia Ventures Deal Calculator research@ambrosiaventures.co',
      'Accept': 'application/json',
    },
    timeoutMs: 20_000,
    retries: 1,
  });

  if (!response.ok) return [];

  const data = await response.json();
  const hits = data.hits?.hits || [];

  return hits.map((hit: Record<string, any>) => {
    // The SEC full-text search API returns:
    // - _id: "accession:filename" (e.g., "0001193125-21-068558:d135857dex991.htm")
    // - _source.ciks: ["0001660334"] (array)
    // - _source.adsh: "0001193125-21-068558" (accession with dashes)
    // Construct proper document URL from these fields.
    const docId = hit._id || '';
    const parts = docId.split(':');
    const accession = parts[0] || hit._source?.adsh || '';
    const fileName = parts[1] || '';
    const cik = (hit._source?.ciks?.[0] || '').replace(/^0+/, '');
    const accessionFormatted = accession.replace(/-/g, '');

    const url = cik && accessionFormatted && fileName
      ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionFormatted}/${fileName}`
      : '';

    return {
      accession,
      company: hit._source?.display_names?.[0] || '',
      date: hit._source?.file_date || '',
      url,
    };
  });
}

// POST /api/deals/backfill-ta?ta=neurology,cardiovascular,metabolic
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    return NextResponse.json({ error: 'ADMIN_API_KEY not configured' }, { status: 500 });
  }

  const expectedToken = `Bearer ${adminKey}`;
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

  // Parse requested TAs (or do all underrepresented)
  const reqUrl = new URL(request.url);
  const requestedTAs = reqUrl.searchParams.get('ta')?.split(',') || Object.keys(TA_SEARCH_CONFIGS);

  const results: Record<string, { searched: number; fetched: number; extracted: number; inserted: number; errors: string[] }> = {};
  const seenUrls = new Set<string>();

  for (const ta of requestedTAs) {
    const config = TA_SEARCH_CONFIGS[ta];
    if (!config) continue;

    console.log(`[backfill] Starting ${ta} backfill...`);
    const taResult = { searched: 0, fetched: 0, extracted: 0, inserted: 0, errors: [] as string[] };

    // Check current count for this TA
    const { count: currentCount } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('therapeutic_area', ta);

    if ((currentCount || 0) >= config.minDeals) {
      console.log(`[backfill] ${ta}: already at ${currentCount} deals (target ${config.minDeals}), skipping`);
      results[ta] = taResult;
      continue;
    }

    const needed = config.minDeals - (currentCount || 0);
    console.log(`[backfill] ${ta}: ${currentCount} deals, need ${needed} more to reach ${config.minDeals}`);

    for (const term of config.terms) {
      if (taResult.inserted >= needed) break;

      try {
        const filings = await searchSECForTA(term);
        taResult.searched += filings.length;

        for (const filing of filings) {
          if (taResult.inserted >= needed) break;
          if (!filing.url || seenUrls.has(filing.url)) continue;
          seenUrls.add(filing.url);

          // Check if already processed
          const { data: existing } = await supabase
            .from('deals')
            .select('id')
            .eq('source_url', filing.url)
            .limit(1)
            .single();

          if (existing) continue;

          try {
            // Use the production-grade fetchFilingContent from sec-edgar.ts
            // This properly handles HTML entity decoding and content extraction
            const content = await fetchFilingContent(filing.url);
            taResult.fetched++;

            if (content.length < 500) {
              console.log(`[backfill] ${ta}: Skipping ${filing.url} — content too short (${content.length} chars)`);
              continue;
            }

            // Use the production-grade extractDealFromFiling from sec-edgar.ts
            // This has the comprehensive 50+ line prompt with proper field definitions
            const deal = await extractDealFromFiling(content, anthropicApiKey);

            if (deal && deal.confidence_score >= 75 && deal.licensor && deal.licensee) {
              taResult.extracted++;

              const licensorId = await findOrCreateCompany(supabase, deal.licensor, false);
              const licenseeId = await findOrCreateCompany(supabase, deal.licensee, true);
              const derivedTA = deriveTherapeuticArea(deal.indication_category);

              // Use the TA we searched for if the derived one is 'other'
              const finalTA = derivedTA === 'other' ? ta : derivedTA;

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
                announced_date: filing.date || new Date().toISOString().split('T')[0],
                source_type: 'sec_8k',
                source_url: filing.url,
                terms_disclosed: deal.upfront_usd !== null || deal.milestones_total_usd !== null,
                confidence_score: deal.confidence_score,
                extraction_notes: `Backfill for ${ta}. ${deal.extraction_notes || ''}`.trim(),
                extraction_model: 'claude-sonnet-4-20250514',
                extraction_timestamp: new Date().toISOString(),
                therapeutic_area: finalTA,
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

              if (insertError) {
                if (insertError.code !== '23505') {
                  taResult.errors.push(insertError.message);
                }
              } else {
                taResult.inserted++;
                console.log(`[backfill] ${ta}: ${deal.licensor} → ${deal.licensee} (${deal.indication_specific || deal.indication_category}) [conf: ${deal.confidence_score}]`);
              }
            }

            // Rate limiting — respect SEC servers
            await new Promise(r => setTimeout(r, 1500));
          } catch (err) {
            taResult.errors.push(`Filing ${filing.url}: ${err}`);
            continue;
          }
        }

        // Rate limit between search terms
        await new Promise(r => setTimeout(r, 500));

      } catch (error) {
        taResult.errors.push(`Term "${term}": ${error}`);
      }
    }

    results[ta] = taResult;
    console.log(`[backfill] ${ta}: searched ${taResult.searched}, fetched ${taResult.fetched}, extracted ${taResult.extracted}, inserted ${taResult.inserted}`);
  }

  // Log
  await supabase.from('data_ingestion_log').insert({
    source: 'ta_backfill',
    run_type: 'manual',
    parameters: { therapeutic_areas: requestedTAs },
    records_fetched: Object.values(results).reduce((s, r) => s + r.searched, 0),
    records_processed: Object.values(results).reduce((s, r) => s + r.extracted, 0),
    records_inserted: Object.values(results).reduce((s, r) => s + r.inserted, 0),
    records_failed: Object.values(results).reduce((s, r) => s + r.errors.length, 0),
    errors: Object.values(results).flatMap(r => r.errors).slice(0, 50),
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, results });
}
