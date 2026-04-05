/**
 * FTC Pre-Merger Notification Ingestion
 *
 * Discovers FTC biopharma merger reviews, HSR filings, and antitrust
 * enforcement actions via Perplexity web search + Claude extraction.
 *
 * Sources:
 *  - FTC press releases: https://www.ftc.gov/news-events/news/press-releases
 *  - FTC enforcement cases: https://www.ftc.gov/enforcement/cases-proceedings
 *
 * Flow: Perplexity discovers FTC actions → Claude extracts structured data → DB insert
 *
 * Cost: ~$0.018 per run (3 Perplexity queries + 3 Claude extractions)
 * Expected yield: 1-5 FTC actions per run (FTC publishes infrequently)
 */

import Anthropic from '@anthropic-ai/sdk';
import { fetchWithTimeout } from '../fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateCompany, deriveTherapeuticArea } from './sec-edgar';

const PERPLEXITY_API = 'https://api.perplexity.ai/v1/responses';

interface FTCDeal {
  acquirer: string;
  target: string;
  deal_value_usd: number | null;
  indication: string | null;
  therapeutic_area: string | null;
  ftc_action: 'approved' | 'under_review' | 'challenged' | 'blocked' | 'consent_order' | 'abandoned';
  ftc_case_number: string | null;
  divestiture_required: boolean;
  divestiture_details: string | null;
  announced_date: string;
  source_url: string | null;
  summary: string;
  confidence: number;
}

/**
 * Build time-scoped FTC discovery queries for the current month.
 */
function buildFTCQueries(): string[] {
  const now = new Date();
  const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return [
    `FTC biopharma merger review ${monthYear}. Include any Hart-Scott-Rodino HSR pre-merger filings, consent orders, divestitures, or challenges involving pharmaceutical or biotech companies. List acquirer, target, deal value, therapeutic area, and FTC action taken.`,
    `FTC HSR filing pharmaceutical biotechnology ${monthYear}. List all FTC antitrust actions on pharma acquisitions including approvals with conditions, blocked mergers, and required divestitures. Include company names, deal values, and drug/indication details.`,
    `FTC antitrust pharma acquisition ${monthYear}. Federal Trade Commission enforcement actions against pharmaceutical mergers and acquisitions. Include any consent decrees, preliminary injunctions, or administrative complaints. List companies, deal sizes, and outcomes.`,
  ];
}

/**
 * Query Perplexity for FTC biopharma deal activity.
 */
async function queryPerplexity(
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
 * Use Claude to extract structured FTC deal data from Perplexity's response.
 */
async function extractFTCDeals(
  text: string,
  anthropicApiKey: string
): Promise<FTCDeal[]> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey, timeout: 60_000 });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: `You extract structured data about FTC (Federal Trade Commission) actions on biopharma mergers and acquisitions. Return ONLY valid JSON — an array of deal objects. Be precise: only include actual FTC enforcement actions or HSR filings involving pharmaceutical/biotech companies. Use null for unknown values. Do not invent or hallucinate data.`,
    messages: [{
      role: 'user',
      content: `Extract all FTC biopharma merger/acquisition actions from this text. For each, return:
{
  "acquirer": "acquiring company name",
  "target": "target company name",
  "deal_value_usd": number in full dollars or null,
  "indication": "primary indication or therapeutic focus" or null,
  "therapeutic_area": "oncology|neurology|immunology|cardiovascular|metabolic|infectiousDisease|rareDisease|ophthalmology|hematology|dermatology|gastroenterology|womensHealth|other",
  "ftc_action": "approved|under_review|challenged|blocked|consent_order|abandoned",
  "ftc_case_number": "FTC case/docket number" or null,
  "divestiture_required": true/false,
  "divestiture_details": "what assets must be divested" or null,
  "announced_date": "YYYY-MM-DD or YYYY-MM or YYYY",
  "source_url": "URL to FTC press release or case page" or null,
  "summary": "brief 1-2 sentence summary of FTC action",
  "confidence": 80-95
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
    return JSON.parse(jsonMatch[0]) as FTCDeal[];
  } catch {
    return [];
  }
}

/**
 * Run FTC pre-merger notification ingestion.
 *
 * Queries Perplexity for recent FTC biopharma merger activity,
 * extracts structured data via Claude, deduplicates, and inserts into DB.
 */
export async function runFTCIngestion(
  supabase: SupabaseClient,
  anthropicApiKey: string,
  perplexityApiKey: string
): Promise<{
  queries_run: number;
  deals_discovered: number;
  deals_inserted: number;
  errors: string[];
}> {
  const result = {
    queries_run: 0,
    deals_discovered: 0,
    deals_inserted: 0,
    errors: [] as string[],
  };

  const queries = buildFTCQueries();

  for (const query of queries) {
    try {
      console.log(`[ftc] Querying: "${query.substring(0, 60)}..."`);

      // Step 1: Perplexity discovers FTC actions from the web
      const perplexityText = await queryPerplexity(query, perplexityApiKey);
      result.queries_run++;

      if (!perplexityText || perplexityText.length < 50) {
        console.log('[ftc] No useful response');
        continue;
      }

      // Step 2: Claude extracts structured data
      const deals = await extractFTCDeals(perplexityText, anthropicApiKey);
      result.deals_discovered += deals.length;
      console.log(`[ftc] Discovered ${deals.length} FTC actions`);

      // Step 3: Deduplicate and insert
      for (const deal of deals) {
        if (!deal.acquirer || !deal.target) continue;
        if (deal.confidence < 75) continue;

        try {
          // Check for duplicates: same acquirer + target in deals table
          const { data: existing } = await supabase
            .from('deals')
            .select('id')
            .ilike('licensee_name', `%${deal.acquirer.substring(0, 15)}%`)
            .ilike('licensor_name', `%${deal.target.substring(0, 15)}%`)
            .eq('source_type', 'ftc_premerger')
            .limit(1)
            .maybeSingle();

          if (existing) {
            console.log(`[ftc] Duplicate skipped: ${deal.acquirer} / ${deal.target}`);
            continue;
          }

          // Also check non-FTC duplicate (same deal may have come from SEC/press)
          const { data: existingDeal } = await supabase
            .from('deals')
            .select('id')
            .ilike('licensee_name', `%${deal.acquirer.substring(0, 15)}%`)
            .ilike('licensor_name', `%${deal.target.substring(0, 15)}%`)
            .eq('deal_type', 'acquisition')
            .limit(1)
            .maybeSingle();

          if (existingDeal) {
            // Update existing deal with FTC metadata instead of creating duplicate
            await supabase.from('deals').update({
              ftc_action: deal.ftc_action,
              ftc_case_number: deal.ftc_case_number,
              divestiture_required: deal.divestiture_required,
              divestiture_details: deal.divestiture_details,
              extraction_notes: `FTC action: ${deal.ftc_action}. ${deal.summary}`,
            }).eq('id', existingDeal.id);

            console.log(`[ftc] Updated existing deal ${existingDeal.id} with FTC metadata`);
            result.deals_inserted++; // count updates too
            continue;
          }

          // Resolve company IDs
          const acquirerId = await findOrCreateCompany(supabase, deal.acquirer, true).catch(() => null);
          const targetId = await findOrCreateCompany(supabase, deal.target, false).catch(() => null);

          // Derive therapeutic area
          const ta = deal.therapeutic_area || deriveTherapeuticArea(deal.indication || '');

          // Normalize announced_date
          const today = new Date().toISOString().split('T')[0];
          let announcedDate = deal.announced_date;
          if (announcedDate && announcedDate.length === 4) announcedDate += '-06-15';
          if (announcedDate && announcedDate.length === 7) announcedDate += '-15';
          if (!announcedDate) announcedDate = today;
          if (announcedDate > today) announcedDate = today;

          const { error: insertError } = await supabase.from('deals').insert({
            licensor_name: deal.target,
            licensor_id: targetId,
            licensee_name: deal.acquirer,
            licensee_id: acquirerId,
            asset_name: `${deal.target} (FTC ${deal.ftc_action})`,
            asset_description: deal.summary,
            modality: 'other',
            deal_type: 'acquisition',
            total_deal_value_usd: deal.deal_value_usd,
            indication_category: deal.indication?.toLowerCase().replace(/\s+/g, '_') || null,
            indication_specific: deal.indication,
            therapeutic_area: ta === 'other' ? (deal.therapeutic_area || 'other') : ta,
            territory: 'us',
            announced_date: announcedDate,
            source_type: 'ftc_premerger',
            source_url: deal.source_url,
            confidence_score: deal.confidence,
            verified: false,
            terms_disclosed: deal.deal_value_usd !== null,
            ftc_action: deal.ftc_action,
            ftc_case_number: deal.ftc_case_number,
            divestiture_required: deal.divestiture_required,
            divestiture_details: deal.divestiture_details,
            extraction_notes: `FTC ${deal.ftc_action}: ${deal.summary}`,
            extraction_model: 'perplexity+claude-sonnet-4',
            extraction_timestamp: new Date().toISOString(),
          });

          if (insertError) {
            // Skip duplicates silently (unique index catches them)
            if (insertError.code !== '23505') {
              result.errors.push(`Insert ${deal.acquirer}/${deal.target}: ${insertError.message}`);
            }
          } else {
            result.deals_inserted++;
            console.log(`[ftc] Inserted: ${deal.acquirer} acquiring ${deal.target} (${deal.ftc_action})`);
          }
        } catch (err) {
          result.errors.push(`${deal.acquirer}/${deal.target}: ${String(err)}`);
        }
      }

      // Rate limit between Perplexity queries
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      result.errors.push(`FTC query failed: ${String(err)}`);
    }
  }

  console.log(`[ftc] Complete: ${result.deals_discovered} discovered, ${result.deals_inserted} inserted, ${result.errors.length} errors`);
  return result;
}
