/**
 * Ingestion freshness and the AI keys ingestion depends on.
 *
 * Incidents: deal ingestion stopped silently in Sep 2026 (Perplexity + Anthropic
 * key failures); the Anthropic key was invalid from Oct 26 to Oct 28 2026.
 *
 * Thresholds, from deals.created_at history (Jul-Nov 2026): while ingestion
 * runs, 99% of gaps between inserts are under an hour; every gap over a day
 * was an outage (the longest, 866 h, was the Aug-Sep one). Weekends and US
 * holidays thin out newswire flow, so warn at 36 h and fail at 72 h. Verified
 * rows lag inserts by the verification pass, so allow 4 / 7 days.
 *
 * Key checks never generate text: Anthropic is asked for its model list
 * (free, routed through the spend guard's fetch), Perplexity gets a request
 * with an empty message list, which a valid key answers 400 and an invalid
 * one 401. Neither detects an exhausted balance with a valid key; the hourly
 * credit sentinel in api-credit-check covers that from the ingestion log.
 */

import { guardedFetch } from '@/lib/ai/spend-guard';
import { type MonitorCheck, type CheckOutcome, ok, warn, fail, worst, hoursSince, errMsg } from '../types';

export const NEWEST_DEAL_WARN_H = 36;
export const NEWEST_DEAL_FAIL_H = 72;
export const NEWEST_VERIFIED_WARN_H = 4 * 24;
export const NEWEST_VERIFIED_FAIL_H = 7 * 24;

function ageText(h: number): string {
  return h >= 48 ? `${Math.round(h / 24)} days` : `${Math.round(h)} h`;
}

export function gradeAge(what: string, h: number | null, warnH: number, failH: number): CheckOutcome {
  if (h === null) return fail(`no ${what} at all`);
  if (h > failH) return fail(`newest ${what} is ${ageText(h)} old`);
  if (h > warnH) return warn(`newest ${what} is ${ageText(h)} old`);
  return ok(`newest ${what} ${ageText(h)} ago`);
}

export const ingestionFreshnessCheck: MonitorCheck = {
  id: 'ingestion_freshness',
  label: 'Deal ingestion freshness',
  cadence: 'hourly',
  async run(ctx) {
    const db = ctx.service();
    const [latest, latestVerified] = await Promise.all([
      db.from('deals').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('deals_verified').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (latest.error) return fail(`deals unreadable: ${errMsg(latest.error.message)}`);
    if (latestVerified.error) return fail(`deals_verified unreadable: ${errMsg(latestVerified.error.message)}`);
    const a = gradeAge('deal row', hoursSince((latest.data as { created_at?: string } | null)?.created_at, ctx.now), NEWEST_DEAL_WARN_H, NEWEST_DEAL_FAIL_H);
    const b = gradeAge('verified deal', hoursSince((latestVerified.data as { created_at?: string } | null)?.created_at, ctx.now), NEWEST_VERIFIED_WARN_H, NEWEST_VERIFIED_FAIL_H);
    return worst([a, b], `${a.reason}; ${b.reason}`);
  },
};

export async function checkAnthropicKey(key: string | undefined, f: typeof fetch): Promise<CheckOutcome> {
  if (!key) return fail('ANTHROPIC_API_KEY not set');
  const res = await guardedFetch('revenue-monitor', f)('https://api.anthropic.com/v1/models?limit=1', {
    method: 'GET',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  });
  if (res.ok) return ok('Anthropic key valid');
  if (res.status === 401 || res.status === 403) return fail(`Anthropic key rejected (${res.status})`);
  return warn(`Anthropic models endpoint returned ${res.status}`);
}

export async function checkPerplexityKey(key: string | undefined, f: typeof fetch): Promise<CheckOutcome> {
  if (!key) return fail('PERPLEXITY_API_KEY not set');
  const res = await f('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    // Empty messages: rejected as invalid before any generation is billed.
    body: JSON.stringify({ model: 'sonar', messages: [], max_tokens: 1 }),
  });
  if (res.status === 401 || res.status === 403) return fail(`Perplexity key rejected (${res.status})`);
  if (res.status === 400 || res.status === 422 || res.ok) return ok('Perplexity key valid');
  const body = (await res.text().catch(() => '')).toLowerCase();
  if (res.status === 402 || /quota|credit|insufficient/.test(body)) return fail(`Perplexity out of credit (${res.status})`);
  return warn(`Perplexity returned ${res.status}`);
}

export const aiKeysCheck: MonitorCheck = {
  id: 'ai_keys',
  label: 'Anthropic & Perplexity keys',
  cadence: 'hourly',
  async run(ctx) {
    const [a, p] = await Promise.all([
      checkAnthropicKey(ctx.env.ANTHROPIC_API_KEY, ctx.fetch).catch(e => warn(`Anthropic check error: ${errMsg(e)}`)),
      checkPerplexityKey(ctx.env.PERPLEXITY_API_KEY, ctx.fetch).catch(e => warn(`Perplexity check error: ${errMsg(e)}`)),
    ]);
    return worst([a, p], 'Anthropic and Perplexity keys valid');
  },
};
