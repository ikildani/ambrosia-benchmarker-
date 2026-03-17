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

// TA-specific discovery queries — Perplexity searches the entire web for these
const TA_DISCOVERY_QUERIES: Record<string, string[]> = {
  neurology: [
    'List all biopharma licensing deals and collaborations announced in 2025-2026 for neurology, CNS, Alzheimer\'s, Parkinson\'s, epilepsy, migraine, and schizophrenia. Include company names, drug names, deal values, and deal types.',
    'Recent neurology drug licensing agreements and acquisitions 2024-2025 with financial terms disclosed, including upfront payments and milestone values',
  ],
  immunology: [
    'List all biopharma licensing deals announced in 2024-2026 for autoimmune diseases, rheumatoid arthritis, lupus, inflammatory bowel disease, psoriasis, and atopic dermatitis. Include company names, asset names, deal values.',
    'Recent immunology drug partnerships and collaboration agreements 2024-2025 with disclosed financial terms',
  ],
  cardiovascular: [
    'List all biopharma licensing deals and acquisitions announced in 2024-2026 for cardiovascular disease, heart failure, hypertension, ATTR cardiomyopathy, and pulmonary hypertension. Include financial terms.',
    'Recent cardiovascular drug licensing agreements 2024-2025 with upfront payments and milestone values disclosed',
  ],
  metabolic: [
    'List all biopharma deals announced in 2024-2026 for obesity, GLP-1, diabetes, NASH/MASH, and metabolic diseases. Include company names, drug names, deal values, and deal types.',
    'Recent obesity and diabetes drug licensing deals and acquisitions 2024-2025 with disclosed financial terms',
  ],
  infectiousDisease: [
    'List all biopharma licensing deals announced in 2024-2026 for infectious diseases, HIV, hepatitis B, RSV, influenza, antibiotics, and vaccines. Include financial terms.',
    'Recent antiviral and vaccine licensing agreements and collaborations 2024-2025 with deal values',
  ],
  rareDisease: [
    'List all biopharma deals announced in 2024-2026 for rare diseases, gene therapy, SMA, Duchenne, hemophilia, and orphan drugs. Include company names, asset names, deal values.',
    'Recent gene therapy and rare disease licensing agreements 2024-2025 with upfront payments disclosed',
  ],
  hematology: [
    'List all biopharma licensing deals announced in 2024-2026 for hematology, leukemia, lymphoma, multiple myeloma, sickle cell disease, and hemophilia. Include financial terms.',
    'Recent CAR-T cell therapy and hematology drug deals 2024-2025 with deal values and company names',
  ],
  ophthalmology: [
    'List all biopharma licensing deals announced in 2024-2026 for ophthalmology, macular degeneration, glaucoma, dry eye, and retinal diseases. Include financial terms.',
  ],
  dermatology: [
    'List all biopharma licensing deals announced in 2024-2026 for dermatology, atopic dermatitis, psoriasis, vitiligo, and alopecia. Include financial terms and deal types.',
  ],
  gastroenterology: [
    'List all biopharma licensing deals announced in 2024-2026 for gastroenterology, IBD, Crohn\'s disease, ulcerative colitis, NASH, celiac disease, and eosinophilic esophagitis. Include financial terms.',
  ],
  womensHealth: [
    'List all biopharma licensing deals announced in 2024-2026 for women\'s health, endometriosis, uterine fibroids, menopause, fertility, and contraception. Include financial terms.',
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
            let announcedDate = deal.announced_date;
            if (announcedDate && announcedDate.length === 4) announcedDate += '-07-01';
            if (announcedDate && announcedDate.length === 7) announcedDate += '-15';
            if (!announcedDate) announcedDate = new Date().toISOString().split('T')[0];

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
