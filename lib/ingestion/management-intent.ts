/**
 * Management-intent language classifier (Search & Evaluation, Phase 3 Workstream C).
 * Writes `company_intent_signals` (migration 114).
 *
 * Inputs
 *   - press_releases in the licensing / strategic_review / executive_hire /
 *     layoffs / financing categories (persisted by lib/ingestion/press-releases.ts)
 *   - for SEC filers (companies.cik): the MD&A / liquidity paragraphs of the
 *     latest 10-K or 10-Q, fetched through the submissions API
 *
 * Classifier: claude-sonnet-5, strict JSON validated with zod, 10 paragraphs
 * per call, the rubric cached with prompt caching. Sonnet 5 rejects sampling
 * parameters (temperature / top_p), so determinism comes from the rubric and
 * validation rather than temperature 0.
 *
 * Invariants: a signal is never stored without a verbatim quote (checked
 * against the paragraph after whitespace folding) and a source_url. Per-run
 * spend is capped (INTENT_COST_CAP_USD, default 3) and token usage is
 * returned for the run log.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
import {
  fetchSubmissions,
  latestPeriodicFiling,
  listRecentFilings,
  padCik,
  secUserAgent,
  stripCik,
} from './company-financials';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

export const INTENT_MODEL = 'claude-sonnet-5';
export const INTENT_BATCH_SIZE = 10;
const SYNC_SOURCE = 'management_intent';
const DEFAULT_TIME_BUDGET_MS = 240_000;
const DEFAULT_PRESS_LIMIT = 60;
// 30 filings per 4-hourly run (180/day) walks ~800 SEC filers in five days; the
// dollar cap (INTENT_COST_CAP_USD) still bounds each run.
const DEFAULT_FILING_LIMIT = 30;
const MAX_PARAGRAPHS_PER_PRESS = 6;
const MAX_PARAGRAPHS_PER_FILING = 40;
const MAX_PARAGRAPH_CHARS = 1200;
const MIN_PARAGRAPH_CHARS = 60;
const MAX_QUOTE_CHARS = 400;

/** USD per million tokens, claude-sonnet-5 (first-party API). */
export const SONNET5_PRICING = { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 } as const;

export const INTENT_PRESS_CATEGORIES = ['licensing', 'strategic_review', 'executive_hire', 'layoffs', 'financing'] as const;

export const INTENT_SIGNAL_TYPES = [
  'seeking_partner', 'retaining_rights', 'strategic_review', 'restructuring', 'bd_hire',
  'cfo_cbo_change', 'layoffs', 'pipeline_prioritization', 'going_concern_language',
] as const;
export type IntentSignalType = (typeof INTENT_SIGNAL_TYPES)[number];
export type IntentPolarity = 'bullish' | 'bearish' | 'neutral';
export type IntentSourceType = 'press_release' | '10k' | '10q' | '8k' | 'earnings_call' | 'job_posting';

/** Paragraphs worth sending to the model. */
export const INTENT_KEYWORD_RE =
  /\b(partner(?:s|ed|ing|ship)?|licens(?:e|es|ed|ing|ee|or)|collaborat\w*|strategic alternatives?|strategic (?:review|options?)|prioriti[sz]\w*|discontinu\w*|deprioriti[sz]\w*|reduc(?:e|ed|ing|tion) (?:in )?(?:our |its |the )?(?:workforce|headcount)|workforce reduction|restructur\w*|substantial doubt|going concern|chief business officer|chief financial officer|business development|out-?licens\w*|in-?licens\w*|retain(?:s|ed|ing)? (?:all |full |worldwide |global )?(?:commercial )?rights|wholly[- ]owned|monetiz\w*|non-?dilutive|cash runway|fund (?:our )?operations (?:into|through)|at-the-market|shelf registration)\b/i;

const FILING_SOURCE_TYPE: Record<string, IntentSourceType> = { '10-K': '10k', '10-Q': '10q', '20-F': '10k' };

// ═══════════════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════════════

export const IntentSignalSchema = z.object({
  paragraph_index: z.number().int().min(0),
  signal_type: z.enum(INTENT_SIGNAL_TYPES),
  polarity: z.enum(['bullish', 'bearish', 'neutral']),
  stance: z.string().max(240),
  quote: z.string().min(1).max(MAX_QUOTE_CHARS),
  confidence: z.number().int().min(0).max(100),
});
export type IntentSignal = z.infer<typeof IntentSignalSchema>;

export const IntentBatchSchema = z.object({ signals: z.array(IntentSignalSchema) });

// ═══════════════════════════════════════════════════════════════════════
// RUBRIC (stable; cached)
// ═══════════════════════════════════════════════════════════════════════

export const INTENT_RUBRIC = `You classify biopharma management language for licensing intent. You receive numbered paragraphs from press releases or SEC filings (MD&A, liquidity, risk factors) of one company. Extract only statements that reveal whether the company is more or less likely to OUT-LICENSE or partner its drug assets in the next 12 months.

Signal types (use exactly these strings):
- seeking_partner: the company says it is seeking, evaluating, exploring or in discussions on partnering, licensing, collaboration or "strategic partnerships" for a program or the company. Polarity bullish.
- retaining_rights: the company states it retains, intends to retain, or will commercialize on its own / keep worldwide rights. Polarity bearish.
- strategic_review: review of strategic alternatives, sale process, special committee, reverse merger, maximize shareholder value. Polarity bullish.
- restructuring: corporate restructuring, cost reduction program, wind-down, cease operations, refocus. Polarity bullish.
- layoffs: reduction in workforce or headcount with a stated scope. Polarity bullish.
- pipeline_prioritization: discontinuing, pausing, deprioritizing or "seeking external options" for a program; narrowing focus to lead assets. Polarity bullish for the deprioritized assets.
- bd_hire: appointment of a Chief Business Officer, head of business development, corporate development or licensing. Polarity bullish.
- cfo_cbo_change: departure or appointment of CFO, CBO or CEO (transition, resignation). Polarity neutral unless the text ties it to a partnering or funding strategy.
- going_concern_language: "substantial doubt about ability to continue as a going concern", runway shorter than 12 months, need to raise capital to fund operations. Polarity bullish.

Rules:
1. Report only statements ABOUT THE COMPANY ITSELF, not about counterparties, competitors, or generic risk-factor hypotheticals ("if we are unable to raise capital we may need to ..."). Hypothetical boilerplate is not a signal; skip it.
2. quote must be copied VERBATIM from the paragraph, at most 400 characters, and must be the shortest span that supports the classification. Do not paraphrase, do not merge sentences from different paragraphs.
3. confidence 0-100: 90+ explicit and unambiguous; 60-89 clear but indirect; below 60 weak. Omit anything below 40.
4. stance: one short sentence (<= 240 chars) in your own words explaining what the statement implies for out-licensing.
5. A paragraph can yield several signals of different types; never repeat the same type for the same paragraph.
6. If nothing qualifies, return {"signals": []}.

Output: a single JSON object {"signals": [{"paragraph_index": <int>, "signal_type": <string>, "polarity": "bullish"|"bearish"|"neutral", "stance": <string>, "quote": <string>, "confidence": <int>}]} and nothing else. No markdown fences.`;

// ═══════════════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════════════

export function foldWhitespace(s: string): string {
  return (s ?? '').replace(/[ \s]+/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
}

/** Verbatim check after whitespace and curly-quote folding. */
export function quoteIsVerbatim(quote: string, paragraph: string): boolean {
  const q = foldWhitespace(quote).toLowerCase();
  if (!q) return false;
  return foldWhitespace(paragraph).toLowerCase().includes(q);
}

/** Parse the model's JSON, tolerating fences and stray prose around the object. */
export function parseIntentResponse(text: string): { signals: IntentSignal[]; invalid: number; parseError: string | null } {
  let raw = (text ?? '').trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return { signals: [], invalid: 0, parseError: 'no JSON object in response' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(first, last + 1));
  } catch (err) {
    return { signals: [], invalid: 0, parseError: `JSON.parse: ${err instanceof Error ? err.message : String(err)}` };
  }
  const batch = IntentBatchSchema.safeParse(parsed);
  if (batch.success) return { signals: batch.data.signals, invalid: 0, parseError: null };
  // Salvage individually valid entries so one malformed item does not sink the batch.
  const arr = (parsed as { signals?: unknown[] })?.signals;
  if (!Array.isArray(arr)) return { signals: [], invalid: 0, parseError: batch.error.issues[0]?.message ?? 'schema mismatch' };
  const ok: IntentSignal[] = [];
  let invalid = 0;
  for (const item of arr) {
    const r = IntentSignalSchema.safeParse(item);
    if (r.success) ok.push(r.data);
    else invalid++;
  }
  return { signals: ok, invalid, parseError: null };
}

/**
 * Keep only signals whose quote is verbatim in the referenced paragraph and
 * whose paragraph_index is in range; drop duplicates of (type, paragraph).
 */
export function validateSignals(signals: IntentSignal[], paragraphs: string[]): { kept: IntentSignal[]; dropped: number } {
  const kept: IntentSignal[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const s of signals) {
    const p = paragraphs[s.paragraph_index];
    if (p == null || !quoteIsVerbatim(s.quote, p) || s.confidence < 40) {
      dropped++;
      continue;
    }
    const key = `${s.paragraph_index}|${s.signal_type}`;
    if (seen.has(key)) {
      dropped++;
      continue;
    }
    seen.add(key);
    kept.push({ ...s, quote: foldWhitespace(s.quote).slice(0, MAX_QUOTE_CHARS) });
  }
  return { kept, dropped };
}

export function htmlToText(html: string): string {
  return (html ?? '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|tr|li|h[1-6]|br|table)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&ldquo;|&#8221;|&rdquo;/g, '"')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Split a document into candidate paragraphs and keep the ones that mention
 * intent keywords. Paragraphs after the MD&A heading are preferred when the
 * cap is hit, since risk-factor boilerplate precedes it in a 10-K.
 */
export function extractIntentParagraphs(text: string, max: number): string[] {
  // No lookbehind: tsconfig targets ES2017. Blank lines split paragraphs; a
  // paragraph that is still very long is re-split into sentence windows.
  const chunks: string[] = [];
  for (const block of (text ?? '').split(/\n\s*\n/)) {
    const folded = foldWhitespace(block);
    if (folded.length < MIN_PARAGRAPH_CHARS) continue;
    if (folded.length <= MAX_PARAGRAPH_CHARS) {
      chunks.push(folded);
      continue;
    }
    let window = '';
    for (const sentence of folded.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [folded]) {
      if (window.length + sentence.length > MAX_PARAGRAPH_CHARS && window) {
        chunks.push(window.trim());
        window = '';
      }
      window += sentence;
    }
    if (window.trim().length >= MIN_PARAGRAPH_CHARS) chunks.push(window.trim());
  }
  const mdaIdx = chunks.findIndex(c => /management'?s discussion and analysis/i.test(c) && c.length < 400);
  const scored: Array<{ text: string; priority: number; idx: number }> = [];
  chunks.forEach((c, idx) => {
    if (!INTENT_KEYWORD_RE.test(c)) return;
    const priority = (mdaIdx >= 0 && idx > mdaIdx ? 2 : 0) + (/liquidity|going concern|substantial doubt|partner|licens|strategic alternatives|workforce/i.test(c) ? 1 : 0);
    scored.push({ text: c.length > MAX_PARAGRAPH_CHARS ? c.slice(0, MAX_PARAGRAPH_CHARS) : c, priority, idx });
  });
  scored.sort((a, b) => b.priority - a.priority || a.idx - b.idx);
  const picked = scored.slice(0, max).sort((a, b) => a.idx - b.idx);
  const seen = new Set<string>();
  return picked.map(p => p.text).filter(t => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function buildIntentUserMessage(paragraphs: string[]): string {
  const numbered = paragraphs.map((p, i) => ({ paragraph_index: i, text: p }));
  return `Paragraphs:\n${JSON.stringify(numbered, null, 0)}\n\nReturn the JSON object now.`;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  calls: number;
}

export function emptyUsage(): TokenUsage {
  return { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, calls: 0 };
}

export function usageCostUsd(u: TokenUsage): number {
  const m = 1_000_000;
  return (
    (u.input_tokens / m) * SONNET5_PRICING.input +
    (u.output_tokens / m) * SONNET5_PRICING.output +
    (u.cache_creation_input_tokens / m) * SONNET5_PRICING.cacheWrite +
    (u.cache_read_input_tokens / m) * SONNET5_PRICING.cacheRead
  );
}

export function addUsage(into: TokenUsage, u: Partial<TokenUsage> | null | undefined): void {
  if (!u) return;
  into.input_tokens += u.input_tokens ?? 0;
  into.output_tokens += u.output_tokens ?? 0;
  into.cache_read_input_tokens += u.cache_read_input_tokens ?? 0;
  into.cache_creation_input_tokens += u.cache_creation_input_tokens ?? 0;
  into.calls += 1;
}

// ═══════════════════════════════════════════════════════════════════════
// CLASSIFIER
// ═══════════════════════════════════════════════════════════════════════

/** Minimal client surface so tests can pass a fake. */
export interface IntentClient {
  messages: { create: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message> };
}

export interface ClassifyResult {
  signals: IntentSignal[];
  usage: TokenUsage;
  dropped: number;
  invalid: number;
  errors: string[];
}

/**
 * Classify paragraphs in batches of INTENT_BATCH_SIZE. Stops early when the
 * running cost would exceed `costCapUsd` (already-spent cost is passed in via
 * `spentUsd`). Never throws; per-batch failures are collected.
 */
export async function classifyParagraphs(
  client: IntentClient,
  paragraphs: string[],
  opts: { costCapUsd?: number; spentUsd?: number; model?: string } = {},
): Promise<ClassifyResult> {
  const usage = emptyUsage();
  const errors: string[] = [];
  const signals: IntentSignal[] = [];
  let dropped = 0;
  let invalid = 0;
  const cap = opts.costCapUsd ?? Number.POSITIVE_INFINITY;
  let spent = opts.spentUsd ?? 0;

  for (let i = 0; i < paragraphs.length; i += INTENT_BATCH_SIZE) {
    if (spent >= cap) {
      errors.push(`cost cap reached (${spent.toFixed(3)} >= ${cap}); ${paragraphs.length - i} paragraphs deferred`);
      break;
    }
    const batch = paragraphs.slice(i, i + INTENT_BATCH_SIZE);
    try {
      const res = await client.messages.create({
        model: opts.model ?? INTENT_MODEL,
        max_tokens: 4000,
        system: [{ type: 'text', text: INTENT_RUBRIC, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildIntentUserMessage(batch) }],
      });
      const u = res.usage as unknown as Partial<TokenUsage>;
      const batchUsage = emptyUsage();
      addUsage(batchUsage, u);
      addUsage(usage, u);
      spent += usageCostUsd(batchUsage);
      if (res.stop_reason === 'refusal') {
        errors.push(`batch ${i / INTENT_BATCH_SIZE}: refusal`);
        continue;
      }
      const text = res.content.filter(b => b.type === 'text').map(b => (b as Anthropic.TextBlock).text).join('\n');
      const parsed = parseIntentResponse(text);
      if (parsed.parseError) errors.push(`batch ${i / INTENT_BATCH_SIZE}: ${parsed.parseError}`);
      invalid += parsed.invalid;
      const v = validateSignals(parsed.signals, batch);
      dropped += v.dropped;
      for (const s of v.kept) signals.push({ ...s, paragraph_index: s.paragraph_index + i });
    } catch (err) {
      errors.push(`batch ${i / INTENT_BATCH_SIZE}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { signals, usage, dropped, invalid, errors };
}

// ═══════════════════════════════════════════════════════════════════════
// ROW BUILDING
// ═══════════════════════════════════════════════════════════════════════

export interface IntentSignalRow {
  company_id: string;
  signal_type: IntentSignalType;
  polarity: IntentPolarity;
  stance: string | null;
  quote: string;
  source_type: IntentSourceType;
  source_id: string;
  source_url: string;
  observed_at: string;
  confidence: number;
  model: string;
  fetched_at: string;
}

/** Build rows; refuses anything without a quote or an http(s) source_url. */
export function toIntentRows(
  signals: IntentSignal[],
  ctx: { company_id: string; source_type: IntentSourceType; source_id: string; source_url: string; observed_at: string; model?: string; now?: Date },
): IntentSignalRow[] {
  if (!/^https?:\/\//i.test(ctx.source_url)) return [];
  const fetched = (ctx.now ?? new Date()).toISOString();
  const byType = new Map<IntentSignalType, IntentSignal>();
  // One row per (company, type, source): keep the most confident.
  for (const s of signals) {
    if (!s.quote?.trim()) continue;
    const prev = byType.get(s.signal_type);
    if (!prev || s.confidence > prev.confidence) byType.set(s.signal_type, s);
  }
  return [...byType.values()].map(s => ({
    company_id: ctx.company_id,
    signal_type: s.signal_type,
    polarity: s.polarity,
    stance: s.stance?.slice(0, 240) || null,
    quote: s.quote.slice(0, MAX_QUOTE_CHARS),
    source_type: ctx.source_type,
    source_id: ctx.source_id,
    source_url: ctx.source_url,
    observed_at: ctx.observed_at,
    confidence: Math.max(0, Math.min(100, Math.round(s.confidence))),
    model: ctx.model ?? INTENT_MODEL,
    fetched_at: fetched,
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════════════

interface CursorState extends Record<string, unknown> {
  /** press_releases.published_at ISO of the last classified item. */
  pressCursor?: string | null;
  /** companies.id of the last SEC filer processed. */
  filingCursor?: string | null;
  /** company_id -> accession already classified. */
  filings?: Record<string, string>;
}

export interface ManagementIntentOptions {
  pressLimit?: number;
  filingLimit?: number;
  timeBudgetMs?: number;
  costCapUsd?: number;
  now?: Date;
  client?: IntentClient;
}

export interface ManagementIntentRunResult {
  pressProcessed: number;
  filingsProcessed: number;
  paragraphsClassified: number;
  signalsWritten: number;
  dropped: number;
  invalid: number;
  usage: TokenUsage;
  costUsd: number;
  costCapUsd: number;
  costCapHit: boolean;
  errors: string[];
  timedOut: boolean;
  durationMs: number;
  skipped: string | null;
}

interface PressRow {
  id: string;
  headline: string;
  body_text: string | null;
  published_at: string;
  source_url: string;
  company_ids: string[] | null;
  categories: string[] | null;
}

export async function runManagementIntent(
  supabase: SupabaseClient,
  opts: ManagementIntentOptions = {},
): Promise<ManagementIntentRunResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const budget = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const costCap = opts.costCapUsd ?? Number(process.env.INTENT_COST_CAP_USD ?? '3');
  const errors: string[] = [];
  const usage = emptyUsage();
  const result: ManagementIntentRunResult = {
    pressProcessed: 0, filingsProcessed: 0, paragraphsClassified: 0, signalsWritten: 0, dropped: 0, invalid: 0,
    usage, costUsd: 0, costCapUsd: costCap, costCapHit: false, errors, timedOut: false, durationMs: 0, skipped: null,
  };
  const outOfTime = () => Date.now() - started > budget;
  const spent = () => usageCostUsd(usage);

  let client = opts.client ?? null;
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      result.skipped = 'skipped: ANTHROPIC_API_KEY not set';
      result.durationMs = Date.now() - started;
      return result;
    }
    client = new Anthropic({ apiKey }) as unknown as IntentClient;
  }

  const cursor = await readSyncCursor<CursorState>(supabase, SYNC_SOURCE);
  const state: CursorState = {
    pressCursor: cursor.state.pressCursor ?? null,
    filingCursor: cursor.state.filingCursor ?? null,
    filings: { ...(cursor.state.filings ?? {}) },
  };

  async function writeRows(rows: IntentSignalRow[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await supabase
      .from('company_intent_signals')
      .upsert(rows, { onConflict: 'company_id,signal_type,source_type,source_id' });
    if (error) errors.push(`upsert: ${error.message}`);
    else result.signalsWritten += rows.length;
  }

  // ── Press releases ─────────────────────────────────────────────────────
  const since = state.pressCursor ?? new Date(now.getTime() - 24 * 30 * 86_400_000).toISOString();
  const { data: press, error: pErr } = await supabase
    .from('press_releases')
    .select('id, headline, body_text, published_at, source_url, company_ids, categories')
    .overlaps('categories', [...INTENT_PRESS_CATEGORIES])
    .neq('company_ids', '{}')
    .gt('published_at', since)
    .order('published_at', { ascending: true })
    .limit(opts.pressLimit ?? DEFAULT_PRESS_LIMIT);
  if (pErr) errors.push(`press_releases read: ${pErr.message}`);

  for (const pr of (press ?? []) as PressRow[]) {
    if (outOfTime()) { result.timedOut = true; break; }
    if (spent() >= costCap) { result.costCapHit = true; break; }
    const companyId = pr.company_ids?.[0];
    if (!companyId || !/^https?:\/\//i.test(pr.source_url)) { state.pressCursor = pr.published_at; continue; }
    const paragraphs = [pr.headline, ...extractIntentParagraphs(pr.body_text ?? '', MAX_PARAGRAPHS_PER_PRESS)]
      .map(foldWhitespace)
      .filter(Boolean);
    const cls = await classifyParagraphs(client, paragraphs, { costCapUsd: costCap, spentUsd: spent() });
    addAll(usage, cls.usage);
    errors.push(...cls.errors.map(e => `press ${pr.id}: ${e}`));
    result.paragraphsClassified += paragraphs.length;
    result.dropped += cls.dropped;
    result.invalid += cls.invalid;
    result.pressProcessed++;
    await writeRows(toIntentRows(cls.signals, {
      company_id: companyId,
      source_type: 'press_release',
      source_id: pr.id,
      source_url: pr.source_url,
      observed_at: pr.published_at.slice(0, 10),
      now,
    }));
    state.pressCursor = pr.published_at;
  }

  // ── SEC filings (MD&A / liquidity) ─────────────────────────────────────
  if (!result.timedOut && !result.costCapHit) {
    let q = supabase
      .from('companies')
      .select('id, name, cik')
      .not('cik', 'is', null)
      .order('id', { ascending: true })
      .limit(opts.filingLimit ?? DEFAULT_FILING_LIMIT);
    if (state.filingCursor) q = q.gt('id', state.filingCursor);
    let { data: filers, error: fErr } = await q;
    if (fErr) errors.push(`companies read: ${fErr.message}`);
    if ((filers ?? []).length === 0 && state.filingCursor) {
      state.filingCursor = null;
      const again = await supabase.from('companies').select('id, name, cik').not('cik', 'is', null).order('id', { ascending: true }).limit(opts.filingLimit ?? DEFAULT_FILING_LIMIT);
      filers = again.data ?? [];
    }
    for (const co of (filers ?? []) as Array<{ id: string; name: string; cik: string }>) {
      if (outOfTime()) { result.timedOut = true; break; }
      if (spent() >= costCap) { result.costCapHit = true; break; }
      state.filingCursor = co.id;
      try {
        const sub = await fetchSubmissions(co.cik);
        const latest = sub ? latestPeriodicFiling(listRecentFilings(sub)) : null;
        if (!latest || !latest.primaryDocument) continue;
        if (state.filings![co.id] === latest.accessionNumber) continue;
        const accn = latest.accessionNumber.replace(/-/g, '');
        const docUrl = `https://www.sec.gov/Archives/edgar/data/${stripCik(co.cik)}/${accn}/${latest.primaryDocument}`;
        const res = await fetchWithTimeout(docUrl, {
          headers: { 'User-Agent': secUserAgent(), Accept: 'text/html,application/xhtml+xml' },
          timeoutMs: 30_000,
          retries: 1,
        });
        if (!res.ok) { errors.push(`${co.name}: filing ${res.status}`); continue; }
        const html = await res.text();
        const paragraphs = extractIntentParagraphs(htmlToText(html), MAX_PARAGRAPHS_PER_FILING);
        result.filingsProcessed++;
        if (paragraphs.length === 0) { state.filings![co.id] = latest.accessionNumber; continue; }
        const cls = await classifyParagraphs(client, paragraphs, { costCapUsd: costCap, spentUsd: spent() });
        addAll(usage, cls.usage);
        errors.push(...cls.errors.map(e => `${co.name} ${latest.form}: ${e}`));
        result.paragraphsClassified += paragraphs.length;
        result.dropped += cls.dropped;
        result.invalid += cls.invalid;
        await writeRows(toIntentRows(cls.signals, {
          company_id: co.id,
          source_type: FILING_SOURCE_TYPE[latest.form] ?? '10q',
          source_id: latest.accessionNumber,
          source_url: docUrl,
          observed_at: latest.filingDate,
          now,
        }));
        if (!cls.errors.some(e => e.startsWith('cost cap'))) state.filings![co.id] = latest.accessionNumber;
      } catch (err) {
        errors.push(`${co.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  try {
    await writeSyncCursor(supabase, SYNC_SOURCE, state.pressCursor ?? null, state);
  } catch (err) {
    errors.push(`cursor write: ${err instanceof Error ? err.message : String(err)}`);
  }
  result.costUsd = Math.round(spent() * 10_000) / 10_000;
  result.durationMs = Date.now() - started;
  return result;
}

function addAll(into: TokenUsage, u: TokenUsage): void {
  into.input_tokens += u.input_tokens;
  into.output_tokens += u.output_tokens;
  into.cache_read_input_tokens += u.cache_read_input_tokens;
  into.cache_creation_input_tokens += u.cache_creation_input_tokens;
  into.calls += u.calls;
}

// Re-export for route/tests convenience.
export { padCik };
