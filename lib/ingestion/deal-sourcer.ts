/**
 * Deal sourcer — attach a primary-source citation to real-looking deal rows
 * that have none.
 *
 * Audit 2026-09-14: 779 rows in `deals` look like genuine transactions (Reata
 * → Biogen, Dermira → Lilly, Arrowhead → Janssen) but were loaded without a
 * source_url / press_release_url / source_filing_id and left `flagged`. The
 * Aug 2026 trigger rightly refuses to mark a row verified without a citation,
 * so those rows sit outside the comparable pool the engine uses.
 *
 * For each unsourced row this module:
 *   1. asks Perplexity for the deal's primary announcement,
 *   2. asks Claude to confirm the search results describe THIS deal
 *      (licensor, licensee, asset or headline terms within tolerance),
 *   3. takes the primary announcement Claude named, provided the search itself
 *      returned that URL, else a newswire/SEC host or a URL on one of the two
 *      parties' domains; never an arbitrary first https link,
 *   4. writes source_url / source_type / provenance_tier and returns the row
 *      to `pending`, so the existing deal-verifier cron adjudicates it with a
 *      citation in hand. It never sets verified=true itself.
 *
 * Cost ≈ $0.02 per row (one Perplexity call + one short Opus call).
 * Shared by scripts/source-unsourced-deals.ts and the daily cron.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '../fetch-with-timeout';
import { isTimeBudgetExceeded } from '../cron-utils';
import {
  extractCitationUrls,
  extractUrlsFromText,
  selectSourceUrl,
  isPressReleaseUrl,
  appendVerificationNote,
} from './deal-verifier';
import { extractAuditExcerpt } from './deal-extraction-validator';

const PERPLEXITY_API = 'https://api.perplexity.ai/v1/responses';
const DEAL_COLUMNS =
  'id, licensor_name, licensee_name, asset_name, target, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, announced_date, indication_category, therapeutic_area, phase_at_signing, territory, verification_status, verification_notes, confidence_score, is_canonical';

export interface UnsourcedDeal {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  asset_name: string | null;
  target: string | null;
  deal_type: string | null;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  total_deal_value_usd: number | null;
  announced_date: string | null;
  indication_category: string | null;
  therapeutic_area: string | null;
  phase_at_signing: string | null;
  territory: string | null;
  verification_status: string | null;
  verification_notes: string | null;
  confidence_score: number | null;
  is_canonical: boolean | null;
}

/** What Claude returns after comparing the row with the search results. */
export interface SourceMatch {
  exists: boolean;
  confidence: number;
  licensor_match: boolean;
  licensee_match: boolean;
  asset_match: boolean;
  /** Announced value or date within tolerance (value ±30%, date ±90 days). */
  headline_match: boolean;
  best_source_url: string | null;
  corrected_value: number | null;
  corrected_date: string | null;
  reason: string;
}

export type SourceDecision =
  | { action: 'source'; url: string; sourceType: 'press_release' | 'other'; provenanceTier: 'B' | 'C'; path: 'matcher' | 'preferred_host' | 'company_domain' }
  | { action: 'skip'; why: string };

/** Confidence Claude must report before a citation is attached. */
export const SOURCE_MIN_CONFIDENCE = 70;

/**
 * Pure decision rule, unit-tested: attach a citation only when the search
 * confirms both parties and either the asset or a headline term, and only
 * with a URL that came from the search's citation list.
 */
export function decideSource(
  match: SourceMatch,
  citationUrls: string[],
  deal: Pick<UnsourcedDeal, 'licensor_name' | 'licensee_name'>,
): SourceDecision {
  if (!match.exists) return { action: 'skip', why: `no evidence the deal exists: ${match.reason}` };
  if (match.confidence < SOURCE_MIN_CONFIDENCE) return { action: 'skip', why: `confidence ${match.confidence} < ${SOURCE_MIN_CONFIDENCE}` };
  if (!match.licensor_match || !match.licensee_match) return { action: 'skip', why: 'parties do not match' };
  if (!match.asset_match && !match.headline_match) return { action: 'skip', why: 'neither asset nor headline terms match' };

  // 1. The matcher read the results and named the primary announcement; trust
  //    it only when the URL is one the search actually returned.
  if (match.best_source_url && citationUrls.includes(match.best_source_url)) {
    const url = match.best_source_url;
    const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
    const preferred = ['sec.gov', 'businesswire.com', 'prnewswire.com', 'globenewswire.com'].some(h => host === h || host.endsWith('.' + h));
    const pressRelease = preferred || isPressReleaseUrl(url);
    return {
      action: 'source',
      url,
      sourceType: pressRelease ? 'press_release' : 'other',
      provenanceTier: pressRelease ? 'B' : 'C',
      path: 'matcher',
    };
  }
  // 2. Otherwise accept only a newswire/SEC host or a URL on one of the two
  //    parties' own domains. Never an arbitrary first https link: that is how
  //    a spin-off notice or an FDA approval release ends up cited for a deal.
  const selected = selectSourceUrl(citationUrls, { licensor: deal.licensor_name, licensee: deal.licensee_name }, { allowFirstHttps: false });
  if (!selected) return { action: 'skip', why: 'no primary-source citation among search results' };
  return {
    action: 'source',
    url: selected.url,
    sourceType: 'press_release',
    provenanceTier: 'B',
    path: selected.path,
  };
}

export interface SourcerOptions {
  perplexityApiKey: string;
  anthropicApiKey: string;
  /** Rows to attempt (default 25). */
  limit?: number;
  /** Stop starting new rows after this many ms (default 250s). */
  timeBudgetMs?: number;
  /** When true, decide but never write. */
  dryRun?: boolean;
  /** Receives one record per row for the audit log. */
  onDecision?: (record: SourcerLogRecord) => void;
  /** Only rows with these verification statuses (default flagged, pending, skipped). */
  statuses?: string[];
}

export interface SourcerLogRecord {
  at: string;
  dealId: string;
  licensor: string | null;
  licensee: string | null;
  asset: string | null;
  announced: string | null;
  decision: SourceDecision | { action: 'error'; why: string };
  match?: SourceMatch;
  citations?: string[];
  applied: boolean;
}

export interface SourcerResult {
  attempted: number;
  sourced: number;
  skipped: number;
  errors: number;
  records: SourcerLogRecord[];
}

/** Rows eligible for sourcing: real-looking, unsourced, not rejected, not verified. */
export async function fetchUnsourcedDeals(
  supabase: SupabaseClient,
  limit: number,
  statuses: string[] = ['flagged', 'pending', 'skipped'],
): Promise<UnsourcedDeal[]> {
  const { data, error } = await supabase
    .from('deals')
    .select(DEAL_COLUMNS)
    .eq('is_synthetic', false)
    .eq('verified', false)
    .in('verification_status', statuses)
    .is('source_url', null)
    .is('press_release_url', null)
    .is('source_filing_id', null)
    .not('licensor_name', 'is', null)
    .not('licensee_name', 'is', null)
    // Canonical rows first (they feed comps once sourced), then largest deals.
    .order('is_canonical', { ascending: false, nullsFirst: false })
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`unsourced-deals query failed: ${error.message}`);
  return (data || []) as UnsourcedDeal[];
}

function buildSearchQuery(deal: UnsourcedDeal): string {
  const year = deal.announced_date ? new Date(deal.announced_date).getFullYear() : '';
  const asset = deal.asset_name && deal.asset_name.length > 2 ? ` "${deal.asset_name}"` : '';
  return `"${deal.licensor_name}" "${deal.licensee_name}"${asset} ${year} agreement press release upfront`;
}

async function searchPerplexity(apiKey: string, query: string): Promise<{ text: string; citations: string[] } | null> {
  const response = await fetchWithTimeout(PERPLEXITY_API, {
    timeoutMs: 20_000,
    retries: 1,
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset: 'fast-search', input: query }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const citations = extractCitationUrls(data);
  let text = '';
  for (const item of data.output || []) {
    if (item.type === 'message') {
      for (const content of item.content || []) {
        if (content.type === 'output_text') text += content.text + '\n';
      }
    }
  }
  if (citations.length === 0) citations.push(...extractUrlsFromText(text));
  return { text, citations };
}

async function matchWithClaude(anthropic: Anthropic, deal: UnsourcedDeal, searchText: string, citations: string[]): Promise<SourceMatch | null> {
  const record = {
    licensor: deal.licensor_name,
    licensee: deal.licensee_name,
    asset: deal.asset_name,
    target: deal.target,
    deal_type: deal.deal_type,
    upfront_usd: deal.upfront_usd,
    milestones_total_usd: deal.milestones_total_usd,
    total_deal_value_usd: deal.total_deal_value_usd,
    announced_date: deal.announced_date,
    indication: deal.indication_category,
    therapeutic_area: deal.therapeutic_area,
    phase: deal.phase_at_signing,
  };
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 500,
    system: 'You match a biopharma deal record against web search results and return ONLY valid JSON. Be strict: a different asset between the same two companies is NOT a match.',
    messages: [{
      role: 'user',
      content: `Database record: ${JSON.stringify(record)}

Web search results: ${searchText.substring(0, 4000)}

Citation URLs available (choose best_source_url ONLY from this list, or null): ${JSON.stringify(citations.slice(0, 12))}

Respond with JSON:
{ "exists": boolean, "confidence": 0-100, "licensor_match": boolean, "licensee_match": boolean, "asset_match": boolean, "headline_match": boolean, "best_source_url": string | null, "corrected_value": number | null, "corrected_date": "YYYY-MM-DD" | null, "reason": string }

Rules:
- exists: the search results describe a real transaction between these two companies.
- asset_match: the named asset/program (or target) in the record is the one in the transaction.
- headline_match: the announced total value is within 30% of the record OR the announced date is within 90 days of the record.
- best_source_url: the primary announcement (company press release, SEC filing, or major trade press), from the list only.
- corrected_value / corrected_date: fill only when the results clearly state a different total value (USD) or date.`,
    }],
  });
  const text = response.content[0];
  if (text.type !== 'text') return null;
  const json = text.text.match(/\{[\s\S]*\}/);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json[0]) as Partial<SourceMatch>;
    return {
      exists: Boolean(parsed.exists),
      confidence: Number(parsed.confidence ?? 0),
      licensor_match: Boolean(parsed.licensor_match),
      licensee_match: Boolean(parsed.licensee_match),
      asset_match: Boolean(parsed.asset_match),
      headline_match: Boolean(parsed.headline_match),
      best_source_url: typeof parsed.best_source_url === 'string' ? parsed.best_source_url : null,
      corrected_value: typeof parsed.corrected_value === 'number' && parsed.corrected_value > 0 ? parsed.corrected_value : null,
      corrected_date: typeof parsed.corrected_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.corrected_date) ? parsed.corrected_date : null,
      reason: String(parsed.reason ?? ''),
    };
  } catch {
    return null;
  }
}

/**
 * Attach citations to unsourced deals. Writes only when `dryRun` is false.
 */
export async function sourceUnsourcedDeals(supabase: SupabaseClient, options: SourcerOptions): Promise<SourcerResult> {
  const limit = options.limit ?? 25;
  const timeBudgetMs = options.timeBudgetMs ?? 250_000;
  const dryRun = options.dryRun ?? true;
  const start = Date.now();
  const result: SourcerResult = { attempted: 0, sourced: 0, skipped: 0, errors: 0, records: [] };
  const anthropic = new Anthropic({ apiKey: options.anthropicApiKey, timeout: 60_000 });

  const deals = await fetchUnsourcedDeals(supabase, limit, options.statuses);

  for (const deal of deals) {
    if (isTimeBudgetExceeded(start, timeBudgetMs)) break;
    result.attempted++;
    const base = {
      at: new Date().toISOString(),
      dealId: deal.id,
      licensor: deal.licensor_name,
      licensee: deal.licensee_name,
      asset: deal.asset_name,
      announced: deal.announced_date,
    };
    const log = (record: SourcerLogRecord) => {
      result.records.push(record);
      options.onDecision?.(record);
    };

    try {
      const search = await searchPerplexity(options.perplexityApiKey, buildSearchQuery(deal));
      if (!search || search.text.length < 50) {
        result.skipped++;
        log({ ...base, decision: { action: 'skip', why: 'search returned nothing usable' }, applied: false });
        continue;
      }
      const match = await matchWithClaude(anthropic, deal, search.text, search.citations);
      if (!match) {
        result.skipped++;
        log({ ...base, decision: { action: 'skip', why: 'matcher returned no JSON' }, citations: search.citations, applied: false });
        continue;
      }
      const decision = decideSource(match, search.citations, deal);
      if (decision.action !== 'source') {
        result.skipped++;
        log({ ...base, decision, match, citations: search.citations, applied: false });
        continue;
      }

      if (!dryRun) {
        const note = `source_url set by deal-sourcer (${decision.path}: ${new URL(decision.url).hostname}); returned to pending for re-verification. ${match.reason}`.slice(0, 500);
        const update: Record<string, unknown> = {
          source_url: decision.url,
          source_type: decision.sourceType,
          provenance_tier: decision.provenanceTier,
          verification_status: 'pending',
          verification_notes: appendVerificationNote(deal.verification_notes, note),
          raw_text_excerpt: extractAuditExcerpt(search.text, deal.licensee_name ?? '', 600) || undefined,
        };
        const { error } = await supabase
          .from('deals')
          .update(update)
          .eq('id', deal.id)
          .is('source_url', null); // race guard: never overwrite a citation written meanwhile
        if (error) {
          result.errors++;
          log({ ...base, decision: { action: 'error', why: error.message }, match, citations: search.citations, applied: false });
          continue;
        }
      }
      result.sourced++;
      log({ ...base, decision, match, citations: search.citations, applied: !dryRun });
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      result.errors++;
      log({ ...base, decision: { action: 'error', why: String(err) }, applied: false });
    }
  }

  return result;
}
