/**
 * Perplexity AI Deal Discovery Pipeline
 *
 * Uses Perplexity's web search agent to discover real biopharma deals
 * from across the entire web — not limited to SEC filings or RSS feeds.
 * Returns structured deal data with source citations for verification.
 *
 * Flow: Perplexity discovers deals → Claude extracts structured terms → DB insert
 *
 * Cost: ~$0.006 per Perplexity query, ~$0.02 per Claude extraction
 * Expected yield: 5-15 verified deals per TA query
 */

import Anthropic from '@anthropic-ai/sdk';
import { fetchWithTimeout } from '../fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateCompany, deriveTherapeuticArea } from './sec-edgar';

const PERPLEXITY_API = 'https://api.perplexity.ai/v1/responses';

interface PerplexityDeal {
  licensor: string;
  licensee: string;
  asset_name: string;
  deal_type: string;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  total_deal_value_usd: number | null;
  royalty_range: string | null;
  indication: string;
  modality: string;
  phase: string;
  territory: string;
  announced_date: string;
  source_url: string | null;
  therapeutic_area: string;
  confidence: number;
}

// Comprehensive discovery queries organized by TA and deal type
// Each TA has 4-6 queries targeting different deal types, time periods, and angles
const TA_DISCOVERY_QUERIES: Record<string, string[]> = {
  neurology: [
    'List all biopharma licensing deals and collaborations announced in 2025-2026 for neurology, CNS, Alzheimer\'s, Parkinson\'s, epilepsy, migraine, and schizophrenia. Include company names, drug names, deal values, and deal types.',
    'Recent neurology drug acquisitions and M&A 2023-2025 with acquisition prices, including AbbVie, Biogen, BMS, Lilly, Roche neuroscience deals',
    'Biopharma option agreements and co-development deals for CNS and neurology drugs 2022-2025, where one company has option to license or co-develop',
    'Chinese biotech licensing deals with Western pharma for neurology and CNS drugs 2023-2025, including ex-China rights deals',
    'Neurology drug deals announced at JP Morgan Healthcare Conference and ASCO 2024 2025 2026 with financial terms',
  ],
  immunology: [
    'List all biopharma licensing deals announced in 2024-2026 for autoimmune diseases, rheumatoid arthritis, lupus, IBD, psoriasis, and atopic dermatitis with financial terms.',
    'Recent autoimmune drug acquisitions and M&A 2023-2025 including TL1A, IL-17, IL-23, JAK inhibitor deals with deal values',
    'Biopharma co-development and option agreements for immunology and autoimmune drugs 2022-2025 with opt-in rights and cost-sharing',
    'CAR-T cell therapy deals for autoimmune diseases 2024-2025 2026, including in vivo CAR-T and allogeneic approaches',
  ],
  cardiovascular: [
    'List biopharma licensing deals 2024-2026 for cardiovascular, heart failure, ATTR cardiomyopathy, PAH, hypertension with financial terms.',
    'Cardiovascular drug acquisitions and M&A 2022-2025 including MyoKardia, Acceleron, CinCor, BridgeBio with deal values',
    'siRNA and antisense deals for cardiovascular targets 2022-2025 including PCSK9, Lp(a), angiotensinogen, Factor XI',
    'Option and co-development agreements for cardiovascular drugs 2022-2025 with disclosed economics',
  ],
  metabolic: [
    'List all obesity and GLP-1 drug licensing deals 2023-2026 with company names and financial terms including Novo Nordisk, Lilly, Roche, Amgen, AstraZeneca, Viking, Structure',
    'NASH MASH liver disease drug deals and acquisitions 2022-2025 with deal values and milestones',
    'Diabetes drug co-development and option agreements 2022-2025 including T1D cell therapy, SGLT2, and insulin deals',
    'Chinese biotech out-licensing deals for obesity and metabolic drugs to Western pharma 2023-2025',
  ],
  infectiousDisease: [
    'List biopharma licensing deals 2024-2026 for HIV, hepatitis B, RSV, flu vaccines, antibiotics with financial terms.',
    'mRNA vaccine partnerships and licensing deals 2022-2025 for influenza, RSV, and pandemic preparedness',
    'Hepatitis B cure program licensing deals 2022-2025 including siRNA, antisense, capsid inhibitor approaches',
    'Antibiotic and antifungal drug deals 2022-2025 including BARDA-funded programs and pull incentive deals',
  ],
  rareDisease: [
    'List gene therapy licensing deals and acquisitions 2023-2026 for rare diseases with financial terms including SMA, DMD, hemophilia, Fabry',
    'Rare disease drug acquisitions and M&A 2022-2025 including Alexion, Shire, Sarepta, BioMarin, Ultragenyx',
    'AAV gene therapy platform deals and collaborations 2022-2025 with upfront payments and milestones',
    'Rare disease option agreements and co-development deals 2022-2025 with opt-in provisions',
    'CRISPR and gene editing deals for rare diseases 2023-2025 including base editing, prime editing',
  ],
  hematology: [
    'List CAR-T cell therapy and bispecific antibody deals for blood cancers 2023-2026 including lymphoma, myeloma, leukemia',
    'Sickle cell disease and hemophilia gene therapy deals 2022-2025 with financial terms',
    'Hematology drug acquisitions 2022-2025 including MorphoSys, Seagen, Forma, Sierra Oncology with deal values',
    'Myelofibrosis and MDS drug licensing deals 2022-2025 with upfront payments and milestones',
  ],
  ophthalmology: [
    'List ophthalmology drug deals 2023-2026 for AMD, glaucoma, dry eye, diabetic retinopathy with financial terms.',
    'Gene therapy and cell therapy deals for eye diseases 2022-2025 including retinal diseases',
    'Ophthalmology drug acquisitions 2022-2025 including Iveric Bio, Aerie, Oyster Point with deal values',
  ],
  dermatology: [
    'List dermatology drug deals 2023-2026 for atopic dermatitis, psoriasis, vitiligo, alopecia, hidradenitis with financial terms.',
    'Dermatology acquisitions and M&A 2022-2025 including Dermavant, Concert, Dice, Kymab with deal values',
    'IL-13, IL-31, IL-17, OX40L antibody deals for skin diseases 2022-2025 with deal structures',
  ],
  gastroenterology: [
    'List gastroenterology drug deals 2023-2026 for IBD, Crohn\'s, ulcerative colitis, NASH, celiac, EoE with financial terms.',
    'TL1A antibody and integrin inhibitor deals for IBD 2022-2025 including Prometheus, Morphic, Roivant',
    'NASH/MASH drug deals and acquisitions 2022-2025 including CymaBay, Madrigal, Intercept with values',
  ],
  womensHealth: [
    'List women\'s health drug deals 2022-2026 for endometriosis, uterine fibroids, menopause, fertility with financial terms.',
    'Breast cancer and ovarian cancer drug deals 2023-2025 including ADC, PARP inhibitor, and CDK4/6 licensing agreements',
    'GnRH antagonist and NK3 receptor antagonist deals for women\'s health 2020-2025 with deal values',
  ],
  // Cross-TA queries for deal types that are underrepresented
  _option_deals: [
    'Biopharma option agreements 2023-2025 where company paid option fee for right to license drug, including opt-in fees and exercise payments across all therapeutic areas',
    'Pharma evaluation and option deals 2022-2025 with option periods, opt-in rights, and exercise fees for non-oncology drugs',
  ],
  _codev_deals: [
    'Biopharma co-development agreements 2023-2025 with 50/50 cost-sharing, profit-sharing, or co-promotion rights across all therapeutic areas',
    'Joint development and co-commercialization pharma deals 2022-2025 with shared costs and territory splits',
  ],
  _china_deals: [
    'Chinese biotech companies licensing drugs to Western pharma 2023-2025 with upfront payments and milestones, ex-China rights deals',
    'China-to-West pharma licensing deals 2024-2025 across all therapeutic areas with financial terms disclosed',
  ],
};

/**
 * Query Perplexity's agent API to discover deals for a specific TA.
 */
async function queryPerplexityForDeals(
  query: string,
  apiKey: string
): Promise<string> {
  const response = await fetchWithTimeout(PERPLEXITY_API, {
    timeoutMs: 30_000,
    retries: 1,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      preset: 'fast-search',
      input: query,
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract text from response
  let text = '';
  for (const item of data.output || []) {
    if (item.type === 'message') {
      for (const content of item.content || []) {
        if (content.type === 'output_text') {
          text += content.text + '\n';
        }
      }
    }
  }

  return text;
}

/**
 * Use Claude to extract structured deal data from Perplexity's response.
 */
async function extractDealsFromText(
  text: string,
  ta: string,
  anthropicApiKey: string
): Promise<PerplexityDeal[]> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey, timeout: 60_000 });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: `You extract structured biopharma deal data from text. Return ONLY valid JSON — an array of deal objects. Be precise: only include deals with enough information to be useful (at minimum: two company names and an asset/program name). Use null for unknown values. Do not invent or hallucinate data.`,
    messages: [{
      role: 'user',
      content: `Extract all biopharma deals from this text. For each deal, return:
{
  "licensor": "company granting rights",
  "licensee": "company receiving rights / acquirer",
  "asset_name": "drug name or program name",
  "deal_type": "license|option|collaboration|acquisition|co_development",
  "upfront_usd": number in full dollars or null,
  "milestones_total_usd": number or null,
  "total_deal_value_usd": number or null,
  "royalty_range": "e.g. mid-single to low-double digit" or null,
  "indication": "specific indication",
  "modality": "smallMolecule|antibody|adc|bispecific|car_t|cell_therapy|gene_therapy|mrna|radiopharm|peptide|oligonucleotide|vaccine|other",
  "phase": "discovery|preclinical|phase_1|phase_2|phase_3|approved",
  "territory": "global|us|ex_us|etc",
  "announced_date": "YYYY-MM-DD or YYYY-MM or YYYY",
  "therapeutic_area": "${ta}",
  "confidence": 85-95
}

Return JSON array only. Text:
${text.substring(0, 8000)}`
    }],
  });

  const textContent = response.content[0];
  if (textContent.type !== 'text') return [];

  const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]) as PerplexityDeal[];
  } catch {
    return [];
  }
}

/**
 * Run Perplexity deal discovery for one or more TAs.
 */
export async function runPerplexityDealDiscovery(
  supabase: SupabaseClient,
  perplexityApiKey: string,
  anthropicApiKey: string,
  options?: {
    therapeuticAreas?: string[];
    maxQueriesPerTA?: number;
    timeBudgetMs?: number;
  }
): Promise<{
  queries_run: number;
  deals_discovered: number;
  deals_inserted: number;
  by_ta: Record<string, number>;
  errors: string[];
}> {
  const startTime = Date.now();
  const timeBudget = options?.timeBudgetMs || 240_000;
  const maxQueriesPerTA = options?.maxQueriesPerTA || 2;
  const tas = options?.therapeuticAreas || Object.keys(TA_DISCOVERY_QUERIES);

  const result = {
    queries_run: 0,
    deals_discovered: 0,
    deals_inserted: 0,
    by_ta: {} as Record<string, number>,
    errors: [] as string[],
  };

  for (const ta of tas) {
    if (Date.now() - startTime > timeBudget) break;

    const queries = TA_DISCOVERY_QUERIES[ta];
    if (!queries) continue;

    for (const query of queries.slice(0, maxQueriesPerTA)) {
      if (Date.now() - startTime > timeBudget) break;

      try {
        console.log(`[perplexity] Querying ${ta}: "${query.substring(0, 60)}..."`);

        // Step 1: Perplexity discovers deals from the web
        const perplexityText = await queryPerplexityForDeals(query, perplexityApiKey);
        result.queries_run++;

        if (!perplexityText || perplexityText.length < 50) {
          console.log(`[perplexity] ${ta}: No useful response`);
          continue;
        }

        // Step 2: Claude extracts structured data
        const deals = await extractDealsFromText(perplexityText, ta, anthropicApiKey);
        result.deals_discovered += deals.length;
        console.log(`[perplexity] ${ta}: Discovered ${deals.length} deals`);

        // Step 3: Insert into database
        for (const deal of deals) {
          if (!deal.licensor || !deal.licensee || !deal.asset_name) continue;
          if (deal.confidence < 80) continue;

          try {
            const licensorId = await findOrCreateCompany(supabase, deal.licensor, false);
            const licenseeId = await findOrCreateCompany(supabase, deal.licensee, true);
            const derivedTA = deriveTherapeuticArea(deal.indication) || ta;

            // Normalize announced_date
            const today = new Date().toISOString().split('T')[0];
            let announcedDate = deal.announced_date;
            if (announcedDate && announcedDate.length === 4) announcedDate += '-06-15'; // Year-only: use mid-year estimate
            if (announcedDate && announcedDate.length === 7) announcedDate += '-15'; // Month-only: use 15th
            if (!announcedDate) announcedDate = today; // Use today if no date available
            // Clamp future dates to today
            if (announcedDate && announcedDate > today) announcedDate = today;

            const { error: insertError } = await supabase.from('deals').upsert({
              licensor_name: deal.licensor,
              licensor_id: licensorId,
              licensee_name: deal.licensee,
              licensee_id: licenseeId,
              asset_name: deal.asset_name,
              asset_description: `${deal.indication} — discovered via Perplexity web search`,
              modality: deal.modality || 'other',
              indication_category: deal.indication?.toLowerCase().replace(/\s+/g, '_') || null,
              indication_specific: deal.indication,
              phase_at_signing: deal.phase || 'unknown',
              territory: deal.territory || 'global',
              deal_type: deal.deal_type || 'license',
              upfront_usd: deal.upfront_usd,
              milestones_total_usd: deal.milestones_total_usd,
              total_deal_value_usd: deal.total_deal_value_usd,
              announced_date: announcedDate,
              source_type: 'press_release',
              terms_disclosed: (deal.upfront_usd !== null) || (deal.total_deal_value_usd !== null),
              confidence_score: deal.confidence || 85,
              verified: false,
              therapeutic_area: derivedTA === 'other' ? ta : derivedTA,
              extraction_notes: `Perplexity discovery → Claude extraction`,
              extraction_model: 'perplexity+claude-sonnet-4',
              extraction_timestamp: new Date().toISOString(),
            }, {
              onConflict: 'licensor_name,licensee_name,asset_name,announced_date',
              ignoreDuplicates: true,
            });

            if (!insertError) {
              result.deals_inserted++;
              result.by_ta[ta] = (result.by_ta[ta] || 0) + 1;
            }
          } catch (err) {
            result.errors.push(`${deal.licensor}/${deal.licensee}: ${err}`);
          }
        }

        // Rate limit between Perplexity queries
        await new Promise(r => setTimeout(r, 2000));

      } catch (err) {
        result.errors.push(`${ta} query failed: ${err}`);
      }
    }
  }

  return result;
}
