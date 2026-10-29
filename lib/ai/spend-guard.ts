/**
 * Daily AI spend guard. Every Anthropic client is built with
 * `new Anthropic(withSpendGuard('<source>', opts))`, which swaps in a fetch that
 *
 *   1. checks today's spend (ai_spend_today, migration 168) before the call and
 *      answers with a local 429 (x-should-retry: false, so the SDK does not retry)
 *      once the caller's lane is over its daily cap;
 *   2. reads `usage` from the response and adds the cost to ai_spend_daily.
 *
 * Lanes, so ingestion and Search & Evaluation can never eat the credits the core
 * Solidus product needs (Issa, Oct 28 2026):
 *   interactive  the Solidus product: memos, comparables narration, query, MCP/API. Own pool.
 *   search       Search & Evaluation user requests (typed search, asset narrative). Own small pool.
 *   core         new-deal ingestion and verification.
 *   bulk         backfills, S&E classification/preclinical/intent, enrichment, SEO/content.
 *                Capped at a share of the background pool.
 *
 * Caps (USD per UTC day): AI_DAILY_CAP_USD (core + bulk), AI_BULK_SHARE (share of it
 * bulk may use), AI_INTERACTIVE_DAILY_CAP_USD, AI_SEARCH_DAILY_CAP_USD. Lean defaults are deliberately low;
 * AI_BUDGET_MODE=full raises them. Ledger errors fail open: a database hiccup must
 * not stop the product, and the per-run caps in each job still apply.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isLean } from '@/lib/ai/budget';

export type SpendLane = 'interactive' | 'search' | 'core' | 'bulk';

/** List price, USD per million tokens. Unknown models are charged at the Opus rate (overestimate, never under). */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};
const FALLBACK_PRICING = { input: 5, output: 25 };
const WEB_SEARCH_USD = 0.01;

const SEARCH_SOURCES = new Set(['radar-search', 'radar-narrative']);
const INTERACTIVE_SOURCES = new Set([
  'query', 'mcp', 'deals-enrich', 'deal-memo', 'playbook',
  'objection', 'comparable-narrator', 'admin-deal-ingest', 'admin-bulk-ingest', 'outreach-generator',
]);
const CORE_SOURCES = new Set([
  'sec-edgar', 'deal-gate', 'press-releases', 'perplexity-deals', 'deal-verifier', 'ftc-premerger',
  'deal-status', 'flag-fixer', 'qa-health-check',
]);

export function laneFor(source: string): SpendLane {
  if (SEARCH_SOURCES.has(source)) return 'search';
  if (INTERACTIVE_SOURCES.has(source)) return 'interactive';
  if (CORE_SOURCES.has(source)) return 'core';
  return 'bulk';
}

function pricingFor(model: string) {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  // Dated ids (claude-sonnet-4-20250514, claude-haiku-4-5-20251001) price as their family.
  const key = Object.keys(MODEL_PRICING).sort((a, b) => b.length - a.length).find((k) => model.startsWith(k));
  return key ? MODEL_PRICING[key] : FALLBACK_PRICING;
}

export interface UsageLike {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number } | null;
}

export function usageCostUsd(model: string, u: UsageLike, discount = 1): number {
  const p = pricingFor(model);
  const m = 1_000_000;
  const tokens =
    ((u.input_tokens ?? 0) * p.input +
      (u.cache_creation_input_tokens ?? 0) * p.input * 1.25 +
      (u.cache_read_input_tokens ?? 0) * p.input * 0.1 +
      (u.output_tokens ?? 0) * p.output) / m;
  return tokens * discount + (u.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD;
}

export interface SpendCaps {
  background: number;
  bulk: number;
  interactive: number;
  search: number;
}

export function spendCaps(env: NodeJS.ProcessEnv = process.env): SpendCaps {
  const lean = isLean(env);
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : d;
  };
  const background = num(env.AI_DAILY_CAP_USD, lean ? 6 : 150);
  const share = Math.min(1, num(env.AI_BULK_SHARE, lean ? 1 / 3 : 0.5));
  return {
    background,
    bulk: background * share,
    interactive: num(env.AI_INTERACTIVE_DAILY_CAP_USD, lean ? 5 : 50),
    search: num(env.AI_SEARCH_DAILY_CAP_USD, lean ? 1 : 20),
  };
}

export type LaneTotals = Record<SpendLane, number>;

/** Null when the lane may spend; otherwise why not. */
export function overCap(lane: SpendLane, t: LaneTotals, caps: SpendCaps): string | null {
  if (lane === 'search') {
    return t.search >= caps.search ? `search $${t.search.toFixed(2)} of $${caps.search.toFixed(2)}` : null;
  }
  if (lane === 'interactive') {
    return t.interactive >= caps.interactive ? `interactive $${t.interactive.toFixed(2)} of $${caps.interactive.toFixed(2)}` : null;
  }
  const background = t.core + t.bulk;
  if (background >= caps.background) return `background $${background.toFixed(2)} of $${caps.background.toFixed(2)}`;
  if (lane === 'bulk' && t.bulk >= caps.bulk) return `bulk $${t.bulk.toFixed(2)} of $${caps.bulk.toFixed(2)}`;
  return null;
}

// ── Ledger (per warm instance: DB totals refreshed every 60 s, plus this instance's own spend since) ──

const REFRESH_MS = 60_000;
let db: SupabaseClient | null = null;

/** Service-role client built here, not via lib/supabase/server, so the guard never pulls in next/headers. */
function ledger(): SupabaseClient {
  if (db) return db;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase environment variables');
  db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return db;
}
let cached: { at: number; day: string; totals: LaneTotals } | null = null;
let localSince: LaneTotals = { interactive: 0, search: 0, core: 0, bulk: 0 };

const utcDay = () => new Date().toISOString().slice(0, 10);

async function todayTotals(): Promise<LaneTotals | null> {
  const day = utcDay();
  if (cached && cached.day === day && Date.now() - cached.at < REFRESH_MS) {
    return { interactive: cached.totals.interactive + localSince.interactive, search: cached.totals.search + localSince.search, core: cached.totals.core + localSince.core, bulk: cached.totals.bulk + localSince.bulk };
  }
  try {
    const { data, error } = await ledger().rpc('ai_spend_today');
    if (error) throw new Error(error.message);
    const totals: LaneTotals = { interactive: 0, search: 0, core: 0, bulk: 0 };
    for (const r of (data ?? []) as { lane: SpendLane; usd: number | string }[]) totals[r.lane] = Number(r.usd) || 0;
    cached = { at: Date.now(), day, totals };
    localSince = { interactive: 0, search: 0, core: 0, bulk: 0 };
    return totals;
  } catch (err) {
    console.warn('[spend-guard] ledger read failed, allowing call:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function record(lane: SpendLane, source: string, model: string, row: { calls: number; blocked: number; input: number; output: number; usd: number }) {
  localSince[lane] += row.usd;
  try {
    const { error } = await ledger().rpc('ai_spend_record', {
      p_lane: lane, p_source: source, p_model: model || 'unknown',
      p_calls: row.calls, p_blocked: row.blocked, p_input: row.input, p_output: row.output, p_usd: Math.round(row.usd * 10_000) / 10_000,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn('[spend-guard] ledger write failed:', err instanceof Error ? err.message : String(err));
  }
}

/** True when `source` may spend now. Jobs call this first so a capped run exits instead of looping on refusals. */
export async function aiBudgetAvailable(source: string): Promise<{ ok: boolean; reason: string | null }> {
  const totals = await todayTotals();
  if (!totals) return { ok: true, reason: null };
  const reason = overCap(laneFor(source), totals, spendCaps());
  return { ok: !reason, reason };
}

export class AiBudgetExceededError extends Error {
  constructor(reason: string) {
    super(`Daily AI budget reached (${reason}); resumes 00:00 UTC`);
    this.name = 'AiBudgetExceededError';
  }
}

function budgetResponse(reason: string): Response {
  const message = new AiBudgetExceededError(reason).message;
  return new Response(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message } }), {
    status: 429,
    headers: { 'content-type': 'application/json', 'x-should-retry': 'false' },
  });
}

/** Estimated batch cost at submit time: chars/4 input, a third of max_tokens output, 50% batch discount. */
function estimateBatch(body: unknown): { model: string; input: number; output: number; usd: number } {
  const reqs = (body as { requests?: { params?: { model?: string; max_tokens?: number } }[] })?.requests ?? [];
  let input = 0, output = 0, usd = 0, model = '';
  for (const r of reqs) {
    const p = r.params ?? {};
    model ||= p.model ?? '';
    const inTok = Math.ceil(JSON.stringify(p).length / 4);
    const outTok = Math.ceil((p.max_tokens ?? 1024) / 3);
    input += inTok;
    output += outTok;
    usd += usageCostUsd(p.model ?? '', { input_tokens: inTok, output_tokens: outTok }, 0.5);
  }
  return { model, input, output, usd };
}

/** A fetch for the Anthropic SDK (or direct calls) that enforces and records the daily budget. */
export function guardedFetch(source: string, inner: typeof fetch = fetch): typeof fetch {
  const lane = laneFor(source);
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
    const isBatchSubmit = method === 'POST' && /\/v1\/messages\/batches\/?(\?|$)/.test(url);
    const isMessage = method === 'POST' && /\/v1\/messages\/?(\?|$)/.test(url);
    if (!isMessage && !isBatchSubmit) return inner(input, init);

    let body: unknown = null;
    if (typeof init?.body === 'string') {
      try { body = JSON.parse(init.body); } catch { /* not JSON; leave unestimated */ }
    }
    const requestedModel = (body as { model?: string } | null)?.model ?? '';

    const totals = await todayTotals();
    const reason = totals ? overCap(lane, totals, spendCaps()) : null;
    if (reason) {
      await record(lane, source, requestedModel, { calls: 0, blocked: 1, input: 0, output: 0, usd: 0 });
      return budgetResponse(reason);
    }

    const res = await inner(input, init);
    if (!res.ok) return res;

    if (isBatchSubmit) {
      const est = estimateBatch(body);
      await record(lane, `${source}:batch`, est.model, { calls: 1, blocked: 0, input: est.input, output: est.output, usd: est.usd });
      return res;
    }
    if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
      // Streaming: charge the worst case from max_tokens so the cap still holds.
      const maxOut = (body as { max_tokens?: number } | null)?.max_tokens ?? 4096;
      const est = { input_tokens: Math.ceil((typeof init?.body === 'string' ? init.body.length : 0) / 4), output_tokens: maxOut };
      await record(lane, source, requestedModel, { calls: 1, blocked: 0, input: est.input_tokens, output: est.output_tokens, usd: usageCostUsd(requestedModel, est) });
      return res;
    }
    try {
      const json = (await res.clone().json()) as { model?: string; usage?: UsageLike };
      const model = json.model ?? requestedModel;
      const u = json.usage ?? {};
      await record(lane, source, model, {
        calls: 1, blocked: 0,
        input: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
        output: u.output_tokens ?? 0,
        usd: usageCostUsd(model, u),
      });
    } catch {
      /* unreadable body: the caller still gets the response */
    }
    return res;
  }) as typeof fetch;
}

/** Client options with the guarded fetch: `new Anthropic(withSpendGuard('sec-edgar', { apiKey }))`. */
export function withSpendGuard<T extends object>(source: string, opts?: T): T & { fetch: typeof fetch } {
  return { ...(opts ?? ({} as T)), fetch: guardedFetch(source) };
}

/** Test hook. */
export function __resetSpendGuardCache() {
  cached = null;
  localSince = { interactive: 0, search: 0, core: 0, bulk: 0 };
}
