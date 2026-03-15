import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runPressReleaseIngestion } from '@/lib/ingestion/press-releases';
import Anthropic from '@anthropic-ai/sdk';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import type { ExtractedDeal } from '@/lib/ingestion/sec-edgar';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// TA-specific search queries for SEC EDGAR full-text search
// These are designed to find deals in underrepresented therapeutic areas
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
    minDeals: 300,
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
    minDeals: 300,
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
    ],
    minDeals: 300,
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
    ],
    minDeals: 300,
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
    ],
    minDeals: 250,
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
    ],
    minDeals: 250,
  },
  ophthalmology: {
    terms: [
      '"ophthalmology" "license agreement"',
      '"retinal" "collaboration"',
      '"macular degeneration" "license"',
      '"glaucoma" "agreement"',
      '"ocular" "license agreement"',
      '"dry eye" "collaboration"',
    ],
    minDeals: 200,
  },
  dermatology: {
    terms: [
      '"dermatology" "license agreement"',
      '"psoriasis" "collaboration"',
      '"eczema" "license"',
      '"acne" "agreement"',
      '"skin" "license agreement" "pharma"',
      '"vitiligo" "collaboration"',
      '"alopecia" "license"',
    ],
    minDeals: 200,
  },
  hematology: {
    terms: [
      '"hematology" "license agreement"',
      '"hemophilia" "collaboration"',
      '"sickle cell" "license"',
      '"thalassemia" "agreement"',
      '"anemia" "license agreement"',
      '"coagulation" "collaboration"',
    ],
    minDeals: 200,
  },
  respiratory: {
    terms: [
      '"respiratory" "license agreement"',
      '"asthma" "collaboration"',
      '"COPD" "license"',
      '"pulmonary fibrosis" "agreement"',
      '"cystic fibrosis" "collaboration"',
      '"inhaled" "license agreement"',
    ],
    minDeals: 200,
  },
  gastroenterology: {
    terms: [
      '"gastroenterology" "license agreement"',
      '"inflammatory bowel" "collaboration"',
      '"Crohn" "license"',
      '"celiac" "agreement"',
      '"GI" "license agreement" "pharma"',
    ],
    minDeals: 200,
  },
  womensHealth: {
    terms: [
      '"women" "health" "license agreement"',
      '"endometriosis" "collaboration"',
      '"fertility" "license"',
      '"contraceptive" "agreement"',
      '"reproductive" "license agreement"',
    ],
    minDeals: 150,
  },
};

const SEC_FULL_TEXT_SEARCH = 'https://efts.sec.gov/LATEST/search-index';

async function searchSECForTA(
  term: string,
  daysBack: number = 365 * 3 // 3 years of history
): Promise<Array<{ accession: string; company: string; date: string; url: string; description: string }>> {
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
    size: '40',
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

  return hits.map((hit: Record<string, any>) => ({
    accession: hit._id || '',
    company: hit._source?.display_names?.[0] || hit._source?.entity_name || '',
    date: hit._source?.file_date || '',
    url: hit._source?.file_url
      ? `https://www.sec.gov${hit._source.file_url}`
      : '',
    description: hit._source?.display_description || '',
  }));
}

async function extractDealFromFiling(
  content: string,
  company: string,
  anthropicApiKey: string
): Promise<ExtractedDeal | null> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  const systemPrompt = `You are an expert biopharma deal analyst extracting licensing deal information from SEC filings. Extract structured deal data with high precision. Be conservative — only extract explicitly stated information. Use null for undisclosed fields.

MODALITY VALUES: small_molecule, antibody, adc, bispecific, car_t, cell_therapy, gene_therapy, mrna, radiopharm, peptide, oligonucleotide, vaccine, other
INDICATION CATEGORIES: solid_tumor, hematological, autoimmune, cns, cardiovascular, infectious, metabolic, rare_disease, respiratory, dermatology, ophthalmology, hematology, reproductive, other
PHASE VALUES: discovery, preclinical, phase_1, phase_2, phase_3, approved, unknown
DEAL TYPE VALUES: license, option, collaboration, acquisition, co_development, co_promotion, other`;

  const userPrompt = `Extract the biopharma deal from this filing by ${company}. Return ONLY valid JSON.

If NOT a biopharma deal, return: {"is_deal": false}

If it IS a deal, return a JSON object with: licensor, licensee, asset_name, modality, indication_category, indication_specific, target, mechanism_of_action, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, milestones_development_usd, milestones_regulatory_usd, milestones_commercial_usd, royalty_low_pct, royalty_high_pct, total_deal_value_usd, confidence_score (0-100), extraction_notes.

Filing text (truncated):
${content.substring(0, 12000)}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const textContent = response.content[0];
    if (textContent.type !== 'text') return null;

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.is_deal === false) return null;

    return parsed as ExtractedDeal;
  } catch {
    return null;
  }
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
  const url = new URL(request.url);
  const requestedTAs = url.searchParams.get('ta')?.split(',') || Object.keys(TA_SEARCH_CONFIGS);

  const results: Record<string, { searched: number; extracted: number; inserted: number; errors: string[] }> = {};

  for (const ta of requestedTAs) {
    const config = TA_SEARCH_CONFIGS[ta];
    if (!config) continue;

    console.log(`[backfill] Starting ${ta} backfill...`);
    const taResult = { searched: 0, extracted: 0, inserted: 0, errors: [] as string[] };

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

          // Check if already processed
          const { data: existing } = await supabase
            .from('deals')
            .select('id')
            .eq('source_url', filing.url)
            .limit(1)
            .single();

          if (existing) continue;

          // Fetch filing content
          if (!filing.url) continue;
          try {
            const response = await fetchWithTimeout(filing.url, {
              timeoutMs: 15_000,
              headers: {
                'User-Agent': 'Ambrosia Ventures Deal Calculator research@ambrosiaventures.co',
                'Accept': 'text/html',
              },
            });

            if (!response.ok) continue;

            const html = await response.text();
            const text = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            if (text.length < 200) continue;

            const deal = await extractDealFromFiling(text, filing.company, anthropicApiKey);

            if (deal && deal.confidence_score >= 70 && deal.licensor && deal.licensee) {
              taResult.extracted++;

              const { findOrCreateCompany, deriveTherapeuticArea } = await import('@/lib/ingestion/sec-edgar');
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
              });

              if (insertError) {
                if (insertError.code !== '23505') {
                  taResult.errors.push(insertError.message);
                }
              } else {
                taResult.inserted++;
                console.log(`[backfill] ${ta}: ${deal.licensor} → ${deal.licensee} (${deal.indication_specific || deal.indication_category})`);
              }
            }

            // Rate limiting
            await new Promise(r => setTimeout(r, 1500));
          } catch {
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
    console.log(`[backfill] ${ta}: searched ${taResult.searched}, extracted ${taResult.extracted}, inserted ${taResult.inserted}`);
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
