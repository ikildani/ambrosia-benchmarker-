/**
 * Weekly Deal Completeness Audit
 *
 * Compares deals found via Perplexity web search against our database
 * to measure coverage and auto-ingest any gaps.
 *
 * Flow: Perplexity discovers public deals -> Claude deduplicates & structures
 *       -> DB match check -> auto-ingest missing -> calculate completeness score
 *
 * Cost: ~$0.02 Perplexity (3 queries) + ~$0.03 Claude extraction
 */

import Anthropic from '@anthropic-ai/sdk';
import { fetchWithTimeout } from '../fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateCompany, deriveTherapeuticArea } from './sec-edgar';
import { isTimeBudgetExceeded } from '@/lib/cron-utils';
import { validateExtractedDeal } from './deal-extraction-validator';

const PERPLEXITY_API = 'https://api.perplexity.ai/v1/responses';

interface PublicDeal {
  licensor: string;
  licensee: string;
  asset_name: string;
  total_value_usd: number | null;
  deal_type: string;
  therapeutic_area: string;
  announced_date: string;
}

interface MissingDeal {
  licensor: string;
  licensee: string;
  value: string;
  type: string;
  ta: string;
}

export interface CompletenessAuditResult {
  deals_found_public: number;
  deals_in_db: number;
  deals_missing: number;
  deals_auto_ingested: number;
  completeness_pct: number;
  missing_deals: MissingDeal[];
  errors: string[];
}

/**
 * Calculate last Monday (week_start) and last Sunday (week_end) relative to now.
 */
function getLastWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ...

  // Last Monday: go back to this Monday, then subtract 7 days
  const daysToLastMonday = dayOfWeek === 0 ? 8 : dayOfWeek + 6;
  const lastMonday = new Date(now);
  lastMonday.setUTCDate(now.getUTCDate() - daysToLastMonday);
  lastMonday.setUTCHours(0, 0, 0, 0);

  const lastSunday = new Date(lastMonday);
  lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
  lastSunday.setUTCHours(23, 59, 59, 999);

  return {
    weekStart: lastMonday.toISOString().split('T')[0],
    weekEnd: lastSunday.toISOString().split('T')[0],
  };
}

/**
 * Query Perplexity for deal information.
 */
async function queryPerplexity(query: string, apiKey: string): Promise<string> {
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
 * Use Claude to extract and deduplicate deals from combined Perplexity text.
 */
async function extractPublicDeals(
  combinedText: string,
  anthropicApiKey: string
): Promise<PublicDeal[]> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey, timeout: 60_000 });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    system: `You extract structured biopharma deal data from text. Return ONLY valid JSON — an array of deal objects. Deduplicate: if the same deal appears multiple times across search results, include it only once. Use null for unknown values. Do not invent or hallucinate data.`,
    messages: [{
      role: 'user',
      content: `Extract a list of unique biopharma deals from this text. For each deal, provide JSON:
{
  "licensor": "company granting rights or being acquired",
  "licensee": "company receiving rights or acquirer",
  "asset_name": "drug name or program name",
  "total_value_usd": number in full dollars or null,
  "deal_type": "license|option|collaboration|acquisition|co_development",
  "therapeutic_area": "best guess TA category",
  "announced_date": "YYYY-MM-DD or YYYY-MM or YYYY"
}

Deduplicate — if the same deal appears in multiple search results, include it only once.
Return a JSON array only.

Text:
${combinedText.substring(0, 12000)}`
    }],
  });

  const textContent = response.content[0];
  if (textContent.type !== 'text') return [];

  const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]) as PublicDeal[];
  } catch {
    return [];
  }
}

/**
 * Format a dollar value for display.
 */
function formatDollars(usd: number | null): string {
  if (usd == null) return 'undisclosed';
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(0)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}

/**
 * Run the weekly completeness audit.
 *
 * 1. Query Perplexity for public deals from the target week
 * 2. Extract and deduplicate via Claude
 * 3. Match against existing DB deals
 * 4. Auto-ingest missing deals
 * 5. Record audit results
 */
export async function runCompletenessAudit(
  supabase: SupabaseClient,
  perplexityApiKey: string,
  anthropicApiKey: string,
  options?: { weekStart?: string; weekEnd?: string; timeBudgetMs?: number }
): Promise<CompletenessAuditResult> {
  const startTime = Date.now();
  const timeBudgetMs = options?.timeBudgetMs ?? 250_000;
  const errors: string[] = [];

  // Step 1: Calculate week range
  const { weekStart: defaultStart, weekEnd: defaultEnd } = getLastWeekRange();
  const weekStart = options?.weekStart ?? defaultStart;
  const weekEnd = options?.weekEnd ?? defaultEnd;

  console.log(`[completeness-audit] Auditing deals for ${weekStart} to ${weekEnd}`);

  // Step 2: Run 3 Perplexity queries for maximum coverage
  const queries = [
    `List all biopharma licensing deals announced between ${weekStart} and ${weekEnd} with financial terms disclosed. Include company names, drug/asset names, deal values, and deal types.`,
    `List all biopharma acquisitions and M&A transactions announced between ${weekStart} and ${weekEnd} with deal values.`,
    `List all biopharma collaboration and partnership deals announced between ${weekStart} and ${weekEnd} with financial terms.`,
  ];

  const perplexityTexts: string[] = [];

  for (const query of queries) {
    if (isTimeBudgetExceeded(startTime, timeBudgetMs)) {
      errors.push('Time budget exceeded during Perplexity queries');
      break;
    }

    try {
      const text = await queryPerplexity(query, perplexityApiKey);
      if (text && text.length >= 50) {
        perplexityTexts.push(text);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Perplexity query failed: ${msg}`);
    }
  }

  if (perplexityTexts.length === 0) {
    console.error('[completeness-audit] All Perplexity queries failed');
    return {
      deals_found_public: 0,
      deals_in_db: 0,
      deals_missing: 0,
      deals_auto_ingested: 0,
      completeness_pct: 100,
      missing_deals: [],
      errors,
    };
  }

  // Step 3: Combine and send to Claude for extraction + dedup
  const combinedText = perplexityTexts.join('\n\n---\n\n');
  let publicDeals: PublicDeal[] = [];

  try {
    publicDeals = await extractPublicDeals(combinedText, anthropicApiKey);
    console.log(`[completeness-audit] Claude extracted ${publicDeals.length} unique public deals`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Claude extraction failed: ${msg}`);
    return {
      deals_found_public: 0,
      deals_in_db: 0,
      deals_missing: 0,
      deals_auto_ingested: 0,
      completeness_pct: 100,
      missing_deals: [],
      errors,
    };
  }

  if (publicDeals.length === 0) {
    console.log('[completeness-audit] No public deals found for this week');
    // Still record the audit with 100% completeness (nothing to miss)
    await insertAuditRecord(supabase, weekStart, weekEnd, {
      deals_found_public: 0,
      deals_in_db: 0,
      deals_missing: 0,
      deals_auto_ingested: 0,
      completeness_pct: 100,
      missing_deals: [],
      errors,
    });
    return {
      deals_found_public: 0,
      deals_in_db: 0,
      deals_missing: 0,
      deals_auto_ingested: 0,
      completeness_pct: 100,
      missing_deals: [],
      errors,
    };
  }

  // Step 4: Check each public deal against our DB
  let dealsInDb = 0;
  const missingDeals: (PublicDeal & { _missing: true })[] = [];

  // Extend the date window by 7 days to account for date discrepancies
  const searchEndDate = new Date(weekEnd);
  searchEndDate.setUTCDate(searchEndDate.getUTCDate() + 7);
  const searchEndStr = searchEndDate.toISOString().split('T')[0];

  for (const deal of publicDeals) {
    if (isTimeBudgetExceeded(startTime, timeBudgetMs)) {
      errors.push('Time budget exceeded during DB matching');
      break;
    }

    const licenseePrefix = deal.licensee.substring(0, 12).toLowerCase();
    const licensorPrefix = deal.licensor.substring(0, 12).toLowerCase();

    const { data: match } = await supabase
      .from('deals')
      .select('id')
      .ilike('licensee_name', `%${licenseePrefix}%`)
      .ilike('licensor_name', `%${licensorPrefix}%`)
      .gte('announced_date', weekStart)
      .lte('announced_date', searchEndStr)
      .limit(1);

    if (match && match.length > 0) {
      dealsInDb++;
    } else {
      missingDeals.push({ ...deal, _missing: true });
    }
  }

  // Step 5: Auto-ingest missing deals
  let dealsAutoIngested = 0;

  let dealsRejected = 0;
  for (const deal of missingDeals) {
    if (isTimeBudgetExceeded(startTime, timeBudgetMs)) {
      errors.push('Time budget exceeded during auto-ingestion');
      break;
    }

    try {
      // R69 (2026-04-15): Fabrication gate. Completeness-audit uses
      // Perplexity + Claude to discover and extract public deals. Without
      // validation, Claude-hallucinated rows (TARGET-NNN placeholders,
      // Anti-TARGET prefixes, suffix/modality mismatches — the same
      // patterns that produced 845 fabricated rows pre-R49) would be
      // inserted directly. Apply the shared validator from R42.
      const validation = validateExtractedDeal({
        licensor: deal.licensor,
        licensee: deal.licensee,
        modality: null,  // completeness-audit doesn't extract modality
        asset_name: deal.asset_name,
        indication_specific: deal.therapeutic_area,
        upfront_usd: null,
        total_deal_value_usd: deal.total_value_usd,
        confidence_score: null,
        source_url: null,
      });
      if (!validation.valid) {
        dealsRejected++;
        errors.push(
          `Rejected hallucinated deal ${deal.licensor}→${deal.licensee} "${deal.asset_name}": ${validation.rejectCode} — ${validation.rejectReason}`,
        );
        continue;
      }

      // Find or create company records
      const licenseeCompany = await findOrCreateCompany(supabase, deal.licensee);
      const licensorCompany = await findOrCreateCompany(supabase, deal.licensor);

      const therapeuticArea = deriveTherapeuticArea(
        deal.therapeutic_area?.toLowerCase().replace(/\s+/g, '_') || null
      );

      const { error: insertError } = await supabase.from('deals').insert({
        licensee_name: deal.licensee,
        licensor_name: deal.licensor,
        licensee_id: (licenseeCompany as unknown as { id?: string })?.id ?? licenseeCompany ?? null,
        licensor_id: (licensorCompany as unknown as { id?: string })?.id ?? licensorCompany ?? null,
        asset_name: deal.asset_name,
        deal_type: deal.deal_type?.toLowerCase() || 'license',
        total_deal_value: deal.total_value_usd,
        therapeutic_area: therapeuticArea,
        indication_category: deal.therapeutic_area?.toLowerCase().replace(/\s+/g, '_') || null,
        announced_date: deal.announced_date || weekStart,
        source_type: 'completeness_audit',
        verification_status: 'pending',
        is_synthetic: false,  // R69: explicit — default should not be NULL
        verified: false,       // R69: explicit pending review
      });

      if (insertError) {
        // Skip duplicates silently (unique index catches them)
        if (insertError.code !== '23505') {
          errors.push(`Insert failed for ${deal.licensor}/${deal.licensee}: ${insertError.message}`);
        }
      } else {
        dealsAutoIngested++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Auto-ingest error for ${deal.licensor}/${deal.licensee}: ${msg}`);
    }
  }

  // Step 6: Calculate completeness
  const completeness = publicDeals.length > 0
    ? Math.round((dealsInDb / publicDeals.length) * 100)
    : 100;

  const missingDealsSummary: MissingDeal[] = missingDeals.map((d) => ({
    licensor: d.licensor,
    licensee: d.licensee,
    value: formatDollars(d.total_value_usd),
    type: d.deal_type || 'unknown',
    ta: d.therapeutic_area || 'unknown',
  }));

  // Step 7: Insert audit record
  const result: CompletenessAuditResult = {
    deals_found_public: publicDeals.length,
    deals_in_db: dealsInDb,
    deals_missing: missingDeals.length,
    deals_auto_ingested: dealsAutoIngested,
    completeness_pct: completeness,
    missing_deals: missingDealsSummary,
    errors,
  };

  await insertAuditRecord(supabase, weekStart, weekEnd, result);

  console.log(
    `[completeness-audit] Complete: ${publicDeals.length} public deals, ` +
    `${dealsInDb} in DB (${completeness}%), ${dealsAutoIngested} auto-ingested`
  );

  return result;
}

/**
 * Insert a row into the deal_completeness_audits table.
 */
async function insertAuditRecord(
  supabase: SupabaseClient,
  weekStart: string,
  weekEnd: string,
  result: CompletenessAuditResult
): Promise<void> {
  try {
    await supabase.from('deal_completeness_audits').insert({
      week_start: weekStart,
      week_end: weekEnd,
      deals_found_public: result.deals_found_public,
      deals_in_db: result.deals_in_db,
      deals_missing: result.deals_missing,
      deals_auto_ingested: result.deals_auto_ingested,
      completeness_pct: result.completeness_pct,
      missing_deals: result.missing_deals,
    });
  } catch {
    console.error('[completeness-audit] Failed to write audit record (non-fatal)');
  }
}
