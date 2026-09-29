/**
 * Flag-and-fix: a flagged deal is repaired from its primary source, not parked.
 *
 * Why (Sep 28 2026): the verifier flags a deal when the web evidence disagrees
 * with the record (wrong date, missing upfront, merged deals), then throws away
 * the corrections it found. 575 real deals sat flagged and out of every count.
 * A 25-deal manual pass found the same pattern each time: the deal is real, a
 * press release or filing states the terms, and most flagged rows duplicate a
 * row that is already right.
 *
 * Per flagged deal:
 *   1. Find a primary document: an existing citation on a primary host, else a
 *      search restricted to primary hosts (SEC, exchanges, newswires, the
 *      companies' own domains).
 *   2. Fetch it and extract the terms with the model, which must quote the
 *      document. A quote that is not in the fetched text voids the extraction.
 *   3. If a verified, cited row already holds the same deal, this row is
 *      rejected as its duplicate. Otherwise the row is corrected from the
 *      document, cited, and verified.
 *   4. No primary document: the row stays flagged and is reported unresolved.
 *
 * Every outcome is written to remediation_log (cron_source 'flag_fixer') with
 * the before -> after diff and the source URL; the daily report emails it.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '../fetch-with-timeout';
import { isTimeBudgetExceeded } from '../cron-utils';
import {
  appendVerificationNote,
  companyDomainStem,
  extractCitationUrls,
  extractUrlsFromText,
  isPressReleaseUrl,
} from './deal-verifier';

const PERPLEXITY_API = 'https://api.perplexity.ai/v1/responses';
export const FLAG_FIXER_SOURCE = 'flag_fixer';

/** Hosts whose documents count as primary: regulators, exchanges, newswires. */
export const PRIMARY_HOSTS = [
  'sec.gov',
  'businesswire.com',
  'prnewswire.com',
  'globenewswire.com',
  'newswire.ca',
  'accesswire.com',
  'hkexnews.hk',
  'sse.com.cn',
  'szse.cn',
  'cninfo.com.cn',
  'release.tdnet.info',
  'asx.com.au',
  'dart.fss.or.kr',
] as const;

const FIELDS = [
  'announced_date',
  'licensor_name',
  'licensee_name',
  'asset_name',
  'deal_type',
  'upfront_usd',
  'milestones_total_usd',
  'total_deal_value_usd',
  'phase_at_signing',
] as const;
type Field = (typeof FIELDS)[number];

const DEAL_TYPES = new Set(['license', 'option', 'collaboration', 'acquisition', 'co_development', 'co_promotion', 'other']);
const PHASES = new Set(['discovery', 'preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved']);

export interface FlaggedDeal {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  asset_name: string | null;
  deal_type: string | null;
  announced_date: string | null;
  upfront_usd: number | string | null;
  milestones_total_usd: number | string | null;
  total_deal_value_usd: number | string | null;
  phase_at_signing: string | null;
  source_url: string | null;
  press_release_url: string | null;
  verification_notes: string | null;
}

/** Terms the model extracted from a primary document. */
export interface ExtractedTerms {
  same_deal: boolean;
  announced_date: string | null;
  licensor: string | null;
  licensee: string | null;
  asset_name: string | null;
  deal_type: string | null;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  total_deal_value_usd: number | null;
  phase_at_signing: string | null;
  /** Verbatim sentence(s) from the document that state the date and money. */
  evidence: string[];
  notes?: string | null;
}

/** Every outcome carries the deal label and why it was flagged, so the Slack report reads on its own. */
interface OutcomeContext { label: string; flaggedBecause: string }
export type FixOutcome = OutcomeContext & (
  | { kind: 'fixed'; dealId: string; url: string; diff: string[] }
  | { kind: 'duplicate'; dealId: string; keeperId: string; url: string | null }
  | { kind: 'rejected'; dealId: string; reason: string }
  | { kind: 'unresolved'; dealId: string; reason: string; attempt: number; retryOn: string });

/**
 * A flag is never left for a person. After this many attempts without a primary
 * document the row is rejected: it cannot be shown under the primary-source rule,
 * and a later primary filing re-enters through ingestion as a new, cited row.
 */
export const MAX_FIX_ATTEMPTS = 3;

export interface FlagFixResult {
  attempted: number;
  fixed: number;
  duplicates: number;
  rejected: number;
  unresolved: number;
  outcomes: FixOutcome[];
  errors: string[];
}

// ─── Pure helpers (unit-tested) ─────────────────────────────────────────────

function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain);
}

/**
 * Primary-source candidates, best first: regulator/exchange/newswire hosts,
 * then pages on either party's own domain. Everything else (news sites,
 * aggregators, Wikipedia) is dropped: it can point to a source but is not one.
 */
export function primaryCandidates(urls: string[], parties: { licensor?: string | null; licensee?: string | null }): string[] {
  const stems = [companyDomainStem(parties.licensor), companyDomainStem(parties.licensee)].filter((s): s is string => !!s);
  const scored: Array<{ url: string; rank: number }> = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const host = hostOf(url);
    if (!host || seen.has(url)) continue;
    seen.add(url);
    if (PRIMARY_HOSTS.some(h => hostMatches(host, h))) scored.push({ url, rank: host.endsWith('sec.gov') ? 0 : 1 });
    else if (stems.some(stem => host.split('.').some(label => label === stem || label.startsWith(stem)))) scored.push({ url, rank: 2 });
  }
  return scored.sort((a, b) => a.rank - b.rank).map(s => s.url);
}

/** HTML to plain text, capped. */
export function documentText(raw: string, max = 40_000): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’“”]/g, "'").replace(/\s+/g, ' ').trim();

/**
 * True when every evidence quote appears in the fetched document. This is the
 * guard against an extraction the model did not read off the page.
 */
export function evidenceSupported(evidence: string[] | undefined, text: string): boolean {
  if (!evidence || evidence.length === 0) return false;
  const hay = norm(text);
  return evidence.every(q => {
    const n = norm(q).replace(/^["'.…\s]+|["'.…\s]+$/g, '');
    return n.length >= 20 && hay.includes(n);
  });
}

function usd(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function normalizePhase(p: string | null | undefined): string | null {
  if (!p) return null;
  const s = p.toLowerCase().replace(/\s+/g, '_').replace(/^phase(\d)/, 'phase_$1');
  return PHASES.has(s) ? s : null;
}

/**
 * Column patch from the extracted terms: only fields the document states and
 * that differ from the row. Party names are left alone unless the document
 * shows the roles reversed (renames break entity links and the dedupe keys).
 */
export function buildPatch(deal: FlaggedDeal, t: ExtractedTerms, today = new Date().toISOString().slice(0, 10)): Partial<Record<Field, string | number | null>> {
  const patch: Partial<Record<Field, string | number | null>> = {};
  if (t.announced_date && /^\d{4}-\d{2}-\d{2}$/.test(t.announced_date) && t.announced_date >= '2000-01-01' && t.announced_date <= today
      && t.announced_date !== deal.announced_date) {
    patch.announced_date = t.announced_date;
  }
  for (const k of ['upfront_usd', 'milestones_total_usd', 'total_deal_value_usd'] as const) {
    const v = usd(t[k]);
    if (v != null && v !== usd(deal[k])) patch[k] = v;
  }
  // Upfront can never exceed the headline total.
  const up = (patch.upfront_usd as number | undefined) ?? usd(deal.upfront_usd);
  const tot = (patch.total_deal_value_usd as number | undefined) ?? usd(deal.total_deal_value_usd);
  if (up != null && tot != null && up > tot * 1.05) delete patch.upfront_usd;
  const phase = normalizePhase(t.phase_at_signing);
  if (phase && phase !== deal.phase_at_signing) patch.phase_at_signing = phase;
  if (t.deal_type && DEAL_TYPES.has(t.deal_type) && t.deal_type !== deal.deal_type) patch.deal_type = t.deal_type;
  if (t.asset_name) {
    const a = t.asset_name.trim();
    if (a.length >= 2 && a.length <= 120 && a !== deal.asset_name) patch.asset_name = a;
  }
  return patch;
}

/** True when the document names the parties the other way round. */
export function rolesReversed(deal: FlaggedDeal, t: ExtractedTerms): boolean {
  const s = (x: string | null | undefined) => companyDomainStem(x) ?? (x || '').toLowerCase();
  if (!t.licensor || !t.licensee || !deal.licensor_name || !deal.licensee_name) return false;
  return s(t.licensor) === s(deal.licensee_name) && s(t.licensee) === s(deal.licensor_name) && s(t.licensor) !== s(t.licensee);
}

export function describeDiff(deal: FlaggedDeal, patch: Record<string, unknown>): string[] {
  return Object.entries(patch).map(([k, v]) => `${k}: ${deal[k as keyof FlaggedDeal] ?? 'null'} -> ${v ?? 'null'}`);
}

/** Days between two ISO dates (absolute). */
function dayGap(a: string | null, b: string | null): number {
  if (!a || !b) return Infinity;
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
}

export interface CandidateRow {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  announced_date: string | null;
  upfront_usd: number | string | null;
  total_deal_value_usd: number | string | null;
  verification_status: string | null;
  source_url: string | null;
  press_release_url: string | null;
  is_synthetic: boolean | null;
}

/**
 * The verified, cited row that already holds this deal, if any: same two
 * parties (either role order), announced within 45 days of the document date,
 * and money that agrees within 10% where both sides state it.
 */
export function findKeeper(dealId: string, t: ExtractedTerms, rows: CandidateRow[]): CandidateRow | null {
  const stem = (x: string | null | undefined) => companyDomainStem(x) ?? (x || '').toLowerCase().trim();
  const a = stem(t.licensor), b = stem(t.licensee);
  const close = (x: unknown, y: unknown) => {
    const p = usd(x), q = usd(y);
    return p == null || q == null || Math.abs(p - q) <= 0.1 * Math.max(p, q);
  };
  const matches = rows.filter(r => r.id !== dealId && !r.is_synthetic && r.verification_status === 'verified'
    && (r.source_url || r.press_release_url)
    && ((stem(r.licensor_name) === a && stem(r.licensee_name) === b) || (stem(r.licensor_name) === b && stem(r.licensee_name) === a))
    && dayGap(r.announced_date, t.announced_date) <= 45
    && close(r.upfront_usd, t.upfront_usd) && close(r.total_deal_value_usd, t.total_deal_value_usd));
  return matches.sort((x, y) => dayGap(x.announced_date, t.announced_date) - dayGap(y.announced_date, t.announced_date))[0] ?? null;
}

// ─── Network steps ─────────────────────────────────────────────────────────

async function searchPrimary(deal: FlaggedDeal, perplexityApiKey: string): Promise<string[]> {
  const asset = deal.asset_name && deal.asset_name.length <= 40 && !deal.asset_name.includes('_') ? ` "${deal.asset_name}"` : '';
  const input = `"${deal.licensor_name}" "${deal.licensee_name}"${asset} agreement press release OR 8-K announcement upfront milestones`;
  const res = await fetchWithTimeout(PERPLEXITY_API, {
    timeoutMs: 20_000,
    retries: 1,
    method: 'POST',
    headers: { Authorization: `Bearer ${perplexityApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset: 'fast-search', input }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}`);
  const data = await res.json();
  const urls = extractCitationUrls(data);
  let text = '';
  for (const item of data.output || []) {
    if (item.type === 'message') for (const c of item.content || []) if (c.type === 'output_text') text += c.text + '\n';
  }
  if (urls.length === 0) urls.push(...extractUrlsFromText(text));
  return urls;
}

async function fetchDocument(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, {
      timeoutMs: 15_000,
      headers: { 'User-Agent': 'Solidus research@ambrosiaventures.co', Accept: 'text/html,application/xhtml+xml,text/plain' },
    });
    if (!res.ok) return null;
    const text = documentText(await res.text());
    return text.length >= 400 ? text : null;
  } catch {
    return null;
  }
}

async function extractTerms(anthropic: Anthropic, deal: FlaggedDeal, url: string, text: string): Promise<ExtractedTerms | null> {
  const record = {
    licensor: deal.licensor_name, licensee: deal.licensee_name, asset: deal.asset_name, deal_type: deal.deal_type,
    announced_date: deal.announced_date, upfront_usd: deal.upfront_usd, milestones_total_usd: deal.milestones_total_usd,
    total_deal_value_usd: deal.total_deal_value_usd, phase: deal.phase_at_signing,
  };
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 900,
    system: 'You extract biopharma deal terms from a primary document (press release or regulatory filing). Use only what the document states. Return ONLY valid JSON.',
    messages: [{
      role: 'user',
      content: `Database record (may be wrong): ${JSON.stringify(record)}

Document (${url}):
${text.slice(0, 30_000)}

Return JSON:
{"same_deal": boolean, "announced_date": "YYYY-MM-DD"|null, "licensor": string|null, "licensee": string|null, "asset_name": string|null, "deal_type": "license"|"option"|"collaboration"|"acquisition"|"co_development"|"co_promotion"|"other"|null, "upfront_usd": number|null, "milestones_total_usd": number|null, "total_deal_value_usd": number|null, "phase_at_signing": "discovery"|"preclinical"|"phase_1"|"phase_2"|"phase_3"|"approved"|null, "evidence": [string], "notes": string|null}

Rules:
- same_deal: true only if the document announces the deal between these two companies that the record describes (either role order). A different deal between the same companies is false.
- announced_date: the dateline of the announcement, not the closing date.
- licensor = the party granting rights or being acquired; licensee = the party paying.
- Money in USD. upfront_usd = cash due at signing/closing (acquisitions: the equity value or per-share cash total the document states). milestones_total_usd = all contingent payments incl. CVRs. total_deal_value_usd = the headline "up to" total. A value the document does not state is null; never compute one it does not give, except total = upfront + milestones when both are stated.
- Financing deals (royalty purchases, loans) are "other".
- evidence: 1-3 sentences copied VERBATIM from the document that state the date and the money. They are checked against the text.`,
    }],
  });
  const block = msg.content[0];
  if (!block || block.type !== 'text') return null;
  const m = block.text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as ExtractedTerms;
  } catch {
    return null;
  }
}

async function log(supabase: SupabaseClient, issueType: string, dealId: string, action: string, newValue: string | null, needsReview: boolean) {
  await supabase.from('remediation_log').insert({
    cron_source: FLAG_FIXER_SOURCE,
    issue_type: issueType,
    deal_id: dealId,
    field_name: '*',
    new_value: newValue,
    action_taken: action.slice(0, 1000),
    confidence: needsReview ? null : 90,
    auto_fixed: !needsReview,
    needs_review: needsReview,
  }).then(() => {}, () => {});
}

const DEAL_COLUMNS = 'id, licensor_name, licensee_name, asset_name, deal_type, announced_date, upfront_usd, milestones_total_usd, total_deal_value_usd, phase_at_signing, source_url, press_release_url, verification_notes';

/**
 * Repair flagged deals from primary sources. Rows the fixer tried in the last
 * `retryAfterDays` are skipped, so the unresolved ones rotate instead of
 * consuming every run.
 */
export async function fixFlaggedDeals(
  supabase: SupabaseClient,
  perplexityApiKey: string,
  anthropicApiKey: string,
  options?: { maxDeals?: number; timeBudgetMs?: number; retryAfterDays?: number; ids?: string[] },
): Promise<FlagFixResult> {
  const start = Date.now();
  const maxDeals = options?.maxDeals ?? 8;
  const budget = options?.timeBudgetMs ?? 240_000;
  const retryAfterDays = options?.retryAfterDays ?? 3;
  const result: FlagFixResult = { attempted: 0, fixed: 0, duplicates: 0, rejected: 0, unresolved: 0, outcomes: [], errors: [] };
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  const since = new Date(Date.now() - retryAfterDays * 86_400_000).toISOString();
  const { data: recent } = await supabase.from('remediation_log').select('deal_id')
    .eq('cron_source', FLAG_FIXER_SOURCE).gte('created_at', since).limit(2000);
  const skip = new Set((recent ?? []).map(r => r.deal_id as string));

  let query = supabase.from('deals').select(DEAL_COLUMNS)
    .eq('verification_status', 'flagged').eq('is_synthetic', false)
    .order('announced_date', { ascending: false, nullsFirst: false })
    .limit(maxDeals * 5);
  if (options?.ids?.length) query = query.in('id', options.ids);
  const { data: rows, error } = await query;
  if (error) {
    result.errors.push(`pick: ${error.message}`);
    return result;
  }
  const queue = (rows ?? []).filter(r => options?.ids?.length || !skip.has(r.id)).slice(0, maxDeals) as FlaggedDeal[];

  for (const deal of queue) {
    if (isTimeBudgetExceeded(start, budget)) break;
    result.attempted++;
    try {
      const outcome = await fixOne(supabase, anthropic, perplexityApiKey, deal);
      result.outcomes.push(outcome);
      if (outcome.kind === 'fixed') result.fixed++;
      else if (outcome.kind === 'duplicate') result.duplicates++;
      else if (outcome.kind === 'rejected') result.rejected++;
      else result.unresolved++;
    } catch (e) {
      result.errors.push(`${deal.licensor_name}/${deal.licensee_name}: ${String(e).slice(0, 200)}`);
    }
  }
  return result;
}

/** Label and flag reason for the report: the last verifier or pipeline note on the row. */
export function outcomeContext(deal: Pick<FlaggedDeal, 'licensor_name' | 'licensee_name' | 'asset_name' | 'verification_notes'>): OutcomeContext {
  const label = `${deal.licensor_name ?? '?'} → ${deal.licensee_name ?? '?'}${deal.asset_name ? ` (${deal.asset_name})` : ''}`;
  const notes = (deal.verification_notes ?? '').replace(/\[\d{4}-\d{2}-\d{2} flag-and-fix:[^\]]*\]/g, '').trim();
  const parts = notes.split(/\s\|\s|\s(?=\[\d{4}-\d{2}-\d{2})/).map(p => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? 'flagged by the verifier';
  return { label, flaggedBecause: last.length > 220 ? `${last.slice(0, 217)}...` : last };
}

async function fixOne(supabase: SupabaseClient, anthropic: Anthropic, perplexityApiKey: string, deal: FlaggedDeal): Promise<FixOutcome> {
  const ctx = outcomeContext(deal);
  const outcome = await fixOneInner(supabase, anthropic, perplexityApiKey, deal);
  return { ...ctx, ...outcome } as FixOutcome;
}

type BareOutcome =
  | { kind: 'fixed'; dealId: string; url: string; diff: string[] }
  | { kind: 'duplicate'; dealId: string; keeperId: string; url: string | null }
  | { kind: 'rejected'; dealId: string; reason: string }
  | { kind: 'unresolved'; dealId: string; reason: string; attempt: number; retryOn: string };

async function fixOneInner(supabase: SupabaseClient, anthropic: Anthropic, perplexityApiKey: string, deal: FlaggedDeal): Promise<BareOutcome> {
  const parties = { licensor: deal.licensor_name, licensee: deal.licensee_name };
  const existing = [deal.source_url, deal.press_release_url].filter((u): u is string => !!u);
  let candidates = primaryCandidates(existing, parties);
  if (candidates.length === 0) candidates = primaryCandidates(await searchPrimary(deal, perplexityApiKey), parties);

  let terms: ExtractedTerms | null = null;
  let url: string | null = null;
  let lastReason = candidates.length === 0 ? 'no primary source (SEC, exchange, newswire or company site) found' : 'primary source did not describe this deal';
  for (const candidate of candidates.slice(0, 3)) {
    const text = await fetchDocument(candidate);
    if (!text) { lastReason = `could not fetch ${candidate}`; continue; }
    const t = await extractTerms(anthropic, deal, candidate, text);
    if (!t || !t.same_deal) continue;
    if (!evidenceSupported(t.evidence, text)) { lastReason = `extraction from ${candidate} was not supported by the document text`; continue; }
    terms = t; url = candidate;
    break;
  }

  if (!terms || !url) {
    const { count: prior } = await supabase.from('remediation_log').select('id', { count: 'exact', head: true })
      .eq('cron_source', FLAG_FIXER_SOURCE).eq('deal_id', deal.id).eq('issue_type', 'flagged_unresolved');
    const attempt = (prior ?? 0) + 1;
    if (attempt >= MAX_FIX_ATTEMPTS) {
      const reason = `no primary document after ${attempt} attempts (${lastReason})`;
      await supabase.from('deals').update({
        verification_status: 'rejected',
        verified: false,
        verify_attempted_at: new Date().toISOString(),
        verification_notes: appendVerificationNote(deal.verification_notes, `[${today()} flag-and-fix: rejected, ${reason}. Removed from counts; a primary filing re-enters through ingestion.]`),
      }).eq('id', deal.id);
      await log(supabase, 'flagged_rejected_no_source', deal.id, reason, null, false);
      return { kind: 'rejected', dealId: deal.id, reason };
    }
    const retryOn = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    await supabase.from('deals').update({
      verify_attempted_at: new Date().toISOString(),
      verification_notes: appendVerificationNote(deal.verification_notes, `[${today()} flag-and-fix: attempt ${attempt} of ${MAX_FIX_ATTEMPTS}, ${lastReason}; held out of counts, retry ${retryOn}]`),
    }).eq('id', deal.id);
    await log(supabase, 'flagged_unresolved', deal.id, `attempt ${attempt} of ${MAX_FIX_ATTEMPTS}: ${lastReason}`, null, false);
    return { kind: 'unresolved', dealId: deal.id, reason: lastReason, attempt, retryOn };
  }

  // Already held by a verified, cited row? Then this one is its duplicate.
  const { data: others } = await supabase.from('deals')
    .select('id, licensor_name, licensee_name, announced_date, upfront_usd, total_deal_value_usd, verification_status, source_url, press_release_url, is_synthetic')
    .or(`licensor_name.ilike.%${likeToken(terms.licensor ?? deal.licensor_name)}%,licensee_name.ilike.%${likeToken(terms.licensor ?? deal.licensor_name)}%`)
    .limit(200);
  const keeper = findKeeper(deal.id, terms, (others ?? []) as CandidateRow[]);
  if (keeper) return markDuplicate(supabase, deal, keeper.id, url);

  const patch: Record<string, unknown> = buildPatch(deal, terms);
  if (rolesReversed(deal, terms)) {
    const { data: full } = await supabase.from('deals')
      .select('licensor_name, licensee_name, licensor_id, licensee_id, licensor_country, licensee_country, licensor_region, licensee_region')
      .eq('id', deal.id).maybeSingle();
    if (full) Object.assign(patch, {
      licensor_name: full.licensee_name, licensee_name: full.licensor_name, licensor_id: full.licensee_id, licensee_id: full.licensor_id,
      licensor_country: full.licensee_country, licensee_country: full.licensor_country, licensor_region: full.licensee_region, licensee_region: full.licensor_region,
    });
  }
  const diff = describeDiff(deal, patch).filter(d => !/^(licensor|licensee)_(id|country|region)/.test(d));
  const money = ['upfront_usd', 'total_deal_value_usd'].some(k => usd(patch[k] ?? deal[k as keyof FlaggedDeal]) != null);
  const update: Record<string, unknown> = {
    ...patch,
    source_url: deal.source_url ?? url,
    press_release_url: deal.press_release_url ?? (isPressReleaseUrl(url) ? url : null),
    verification_status: 'verified',
    verified: true,
    verify_attempted_at: new Date().toISOString(),
    ...(money ? { terms_disclosed: true } : {}),
    verification_notes: appendVerificationNote(deal.verification_notes,
      `[${today()} flag-and-fix: re-sourced from ${url}; ${diff.length ? diff.join('; ') : 'record matched the source'}]`),
  };
  const { error } = await supabase.from('deals').update(update).eq('id', deal.id);
  if (error?.code === '23505') {
    // The corrected terms collide with a row that already holds them.
    const { data: twin } = await supabase.from('deals').select('id')
      .eq('licensor_name', deal.licensor_name).eq('licensee_name', deal.licensee_name)
      .eq('total_deal_value_usd', (patch.total_deal_value_usd ?? deal.total_deal_value_usd) as number)
      .neq('id', deal.id).limit(1).maybeSingle();
    if (twin?.id) return markDuplicate(supabase, deal, twin.id, url);
  }
  if (error) throw new Error(`save: ${error.message}`);
  await log(supabase, 'flagged_fixed', deal.id, diff.join('; ') || 'record matched the source; cited and verified', url, false);
  return { kind: 'fixed', dealId: deal.id, url, diff };
}

async function markDuplicate(supabase: SupabaseClient, deal: FlaggedDeal, keeperId: string, url: string | null): Promise<BareOutcome> {
  await supabase.from('deals').update({
    verification_status: 'rejected',
    verified: false,
    duplicate_of: keeperId,
    verify_attempted_at: new Date().toISOString(),
    verification_notes: appendVerificationNote(deal.verification_notes,
      `[${today()} flag-and-fix: duplicate of ${keeperId} (same deal, already verified and cited${url ? `; checked against ${url}` : ''}). Removed from counts.]`),
  }).eq('id', deal.id);
  await log(supabase, 'flagged_duplicate', deal.id, `duplicate of ${keeperId}`, keeperId, false);
  return { kind: 'duplicate', dealId: deal.id, keeperId, url };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A short distinctive token of a company name, safe inside a PostgREST ilike. */
export function likeToken(name: string | null | undefined): string {
  const stem = companyDomainStem(name) ?? (name || '').split(/\s+/)[0] ?? '';
  return stem.replace(/[^a-z0-9]/gi, '').slice(0, 20) || 'zzzz';
}
