/**
 * Outcome ledger — resolver.
 *
 * Runs from /api/cron/outcome-resolve (and as a phase of the deal-verification
 * cron). Keeps a cursor on deals.created_at in radar_sync_cursors
 * (source = 'outcome_resolve'), and for every new quality-filtered deal:
 *
 *   1. finds open predictions whose licensor / company / asset could be the
 *      deal's licensor (cheap key index, then scoreMatch),
 *   2. ≥ AUTO_RESOLVE_THRESHOLD  → outcomes row (accepted) + prediction resolved,
 *      REVIEW_QUEUE_THRESHOLD..  → outcomes row (pending) for the admin queue,
 *      below                     → ignored.
 *
 * Expiry: open predictions whose predicted_window_end + 180 d has passed become
 * `expired` (they count against window hit rate only). Predictions with no
 * window expire 730 d after creation — the spec leaves this open; two years is
 * past any realistic signing horizon for a calculator range.
 *
 * Never throws: every step records into report.errors and the caller logs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AUTO_RESOLVE_THRESHOLD,
  REVIEW_QUEUE_THRESHOLD,
  computeOutcomeMetrics,
  coreCompanyName,
  dealToActuals,
  expandAliases,
  normalizeCompanyName,
  scoreMatch,
} from './matcher';
import {
  DEAL_CANDIDATE_COLUMNS,
  type CompanyAlias,
  type DealCandidateRow,
  type OutcomeInsert,
  type PredictionForMatch,
  type ResolverRunReport,
} from './types';

export const RESOLVER_CURSOR_SOURCE = 'outcome_resolve';
const DEAL_BATCH = 500;
const PREDICTION_PAGE = 1000;
const MAX_PREDICTION_PAGES = 10;
const WINDOW_GRACE_DAYS = 180;
const NO_WINDOW_EXPIRY_DAYS = 730;
const MAX_QUEUED_PER_PREDICTION = 3;

const PREDICTION_MATCH_COLUMNS = [
  'id', 'company_id', 'asset_id', 'licensor_name', 'asset_name', 'indication', 'therapeutic_area', 'phase',
  'resolve_after', 'upfront_low', 'upfront_mid', 'upfront_high', 'total_low', 'total_mid', 'total_high',
  'predicted_buyers', 'predicted_window_start', 'predicted_window_end',
].join(',');

// ─── helpers ───────────────────────────────────────────────────────────────

function isoDaysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * The deals quality filter (same predicate as lib/brief/comp-set.ts
 * fetchQualityDealRows): non-synthetic, canonical-or-unknown, not rejected/flagged.
 */
export function applyDealQualityFilter<T>(q: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the PostgREST builder's five generics are not worth threading; the caller keeps its own builder type through T
  const b = q as any;
  return b
    .eq('is_synthetic', false)
    .not('is_canonical', 'is', false)
    .not('verification_status', 'in', '("rejected","flagged")') as T;
}

export async function readCursor(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from('radar_sync_cursors')
    .select('cursor')
    .eq('source', RESOLVER_CURSOR_SOURCE)
    .maybeSingle();
  const c = (data as { cursor: string | null } | null)?.cursor ?? null;
  return c && Number.isFinite(Date.parse(c)) ? c : null;
}

export async function writeCursor(supabase: SupabaseClient, cursor: string, state: Record<string, unknown>): Promise<void> {
  const existing = await supabase
    .from('radar_sync_cursors')
    .select('runs')
    .eq('source', RESOLVER_CURSOR_SOURCE)
    .maybeSingle();
  const runs = ((existing.data as { runs: number } | null)?.runs ?? 0) + 1;
  await supabase
    .from('radar_sync_cursors')
    .upsert({ source: RESOLVER_CURSOR_SOURCE, cursor, state, runs, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'source' });
}

async function fetchAllCompanies(supabase: SupabaseClient): Promise<CompanyAlias[]> {
  const out: CompanyAlias[] = [];
  for (let from = 0, pages = 0; pages < 5; from += 1000, pages++) {
    const { data, error } = await supabase
      .from('companies')
      .select('id,name,name_variations')
      .range(from, from + 999);
    if (error) throw new Error(`companies: ${error.message}`);
    const batch = (data ?? []) as CompanyAlias[];
    out.push(...batch);
    if (batch.length < 1000) break;
  }
  return out;
}

async function fetchOpenPredictions(supabase: SupabaseClient, now: Date): Promise<PredictionForMatch[]> {
  const out: PredictionForMatch[] = [];
  for (let from = 0, pages = 0; pages < MAX_PREDICTION_PAGES; from += PREDICTION_PAGE, pages++) {
    const { data, error } = await supabase
      .from('predictions')
      .select(PREDICTION_MATCH_COLUMNS)
      .eq('status', 'open')
      .lte('resolve_after', now.toISOString())
      .order('created_at', { ascending: true })
      .range(from, from + PREDICTION_PAGE - 1);
    if (error) throw new Error(`predictions: ${error.message}`);
    const batch = (data ?? []) as unknown as PredictionForMatch[];
    out.push(...batch);
    if (batch.length < PREDICTION_PAGE) break;
  }
  return out;
}

/** Tokens ≥ 4 chars of the core company name, for the candidate pre-filter. */
function nameTokens(name: string | null | undefined): string[] {
  return coreCompanyName(name).split(' ').filter((t) => t.length >= 4);
}

/** Index deals by the identity keys a prediction could share with them. */
export function buildDealIndex(deals: DealCandidateRow[], companies: CompanyAlias[]): Map<string, Set<number>> {
  const index = new Map<string, Set<number>>();
  const add = (key: string, i: number) => {
    if (!index.has(key)) index.set(key, new Set());
    index.get(key)!.add(i);
  };
  deals.forEach((d, i) => {
    if (d.licensor_id) add(`id:${d.licensor_id}`, i);
    expandAliases(d.licensor_name, d.licensor_id, companies).forEach((a) => add(`n:${a}`, i));
    const asset = normalizeCompanyName(d.asset_name);
    if (asset.length >= 4) add(`a:${asset}`, i);
    nameTokens(d.licensor_name).forEach((t) => add(`t:${t}`, i));
  });
  return index;
}

/** Deals a prediction could plausibly match (identity pre-filter; scoreMatch decides). */
export function candidateDeals(prediction: PredictionForMatch, index: Map<string, Set<number>>, companies: CompanyAlias[]): Set<number> {
  const out = new Set<number>();
  const take = (key: string) => index.get(key)?.forEach((i) => out.add(i));
  if (prediction.company_id) take(`id:${prediction.company_id}`);
  expandAliases(prediction.licensor_name, prediction.company_id, companies).forEach((a) => take(`n:${a}`));
  const asset = normalizeCompanyName(prediction.asset_name);
  if (asset.length >= 4) take(`a:${asset}`);
  nameTokens(prediction.licensor_name).forEach((t) => take(`t:${t}`));
  return out;
}

function buildOutcome(prediction: PredictionForMatch, deal: DealCandidateRow, score: number, evidence: Record<string, unknown>, companies: CompanyAlias[], accepted: boolean, now: Date): OutcomeInsert {
  const actuals = dealToActuals(deal);
  const metrics = computeOutcomeMetrics(prediction, actuals, companies);
  return {
    prediction_id: prediction.id,
    deal_id: deal.id,
    matched_by: 'auto',
    status: accepted ? 'accepted' : 'pending',
    match_confidence: score,
    match_evidence: evidence,
    ...actuals,
    first_offer_upfront_m: null,
    first_offer_total_m: null,
    our_ask_upfront_m: null,
    our_ask_total_m: null,
    ...metrics,
    resolved_at: accepted ? now.toISOString() : null,
    reviewed_by: accepted ? 'resolver' : null,
    notes: null,
  };
}

// ─── expiry ────────────────────────────────────────────────────────────────

export async function expirePredictions(supabase: SupabaseClient, now: Date): Promise<{ expired: number; errors: string[] }> {
  const errors: string[] = [];
  let expired = 0;
  const stamp = { status: 'expired', updated_at: now.toISOString() };
  const windowCutoff = isoDaysAgo(now, WINDOW_GRACE_DAYS).slice(0, 10);
  const r1 = await supabase
    .from('predictions')
    .update(stamp)
    .eq('status', 'open')
    .lt('predicted_window_end', windowCutoff)
    .select('id');
  if (r1.error) errors.push(`expire(window): ${r1.error.message}`);
  else expired += (r1.data ?? []).length;

  const r2 = await supabase
    .from('predictions')
    .update(stamp)
    .eq('status', 'open')
    .is('predicted_window_end', null)
    .lt('created_at', isoDaysAgo(now, NO_WINDOW_EXPIRY_DAYS))
    .select('id');
  if (r2.error) errors.push(`expire(no-window): ${r2.error.message}`);
  else expired += (r2.data ?? []).length;
  return { expired, errors };
}

// ─── admin actions (shared with app/api/admin/outcomes) ────────────────────

export async function acceptOutcome(supabase: SupabaseClient, outcomeId: string, reviewedBy: string, notes?: string | null): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('outcomes')
    .update({ status: 'accepted', resolved_at: now, reviewed_by: reviewedBy, matched_by: 'manual', ...(notes ? { notes } : {}) })
    .eq('id', outcomeId)
    .select('prediction_id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'not found' };
  const predictionId = (data as { prediction_id: string }).prediction_id;
  const up = await supabase.from('predictions').update({ status: 'resolved', updated_at: now }).eq('id', predictionId);
  if (up.error) return { ok: false, error: up.error.message };
  // Other pending candidates for the same prediction are now moot.
  await supabase.from('outcomes').update({ status: 'rejected', reviewed_by: reviewedBy }).eq('prediction_id', predictionId).eq('status', 'pending').neq('id', outcomeId);
  return { ok: true };
}

export async function rejectOutcome(supabase: SupabaseClient, outcomeId: string, reviewedBy: string, notes?: string | null): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('outcomes')
    .update({ status: 'rejected', reviewed_by: reviewedBy, ...(notes ? { notes } : {}) })
    .eq('id', outcomeId)
    .eq('status', 'pending');
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ─── main ──────────────────────────────────────────────────────────────────

export interface ResolverOptions {
  now?: Date;
  /** Deals per run (default 500). */
  batch?: number;
  /** Override the stored cursor (manual re-runs). */
  cursorOverride?: string;
}

export async function runResolver(supabase: SupabaseClient, opts: ResolverOptions = {}): Promise<ResolverRunReport> {
  const now = opts.now ?? new Date();
  const report: ResolverRunReport = {
    dealsScanned: 0, openPredictions: 0, pairsScored: 0, autoResolved: 0, queued: 0, expired: 0,
    cursorFrom: null, cursorTo: null, errors: [],
  };

  // 0. Expiry (independent of the deal cursor).
  const ex = await expirePredictions(supabase, now);
  report.expired = ex.expired;
  report.errors.push(...ex.errors);

  try {
    // 1. Cursor.
    const cursor = opts.cursorOverride ?? (await readCursor(supabase)) ?? isoDaysAgo(now, 7);
    report.cursorFrom = cursor;

    // 2. New quality-filtered deals since the cursor.
    const { data: dealData, error: dealErr } = await applyDealQualityFilter(
      supabase.from('deals').select(DEAL_CANDIDATE_COLUMNS),
    )
      .gt('created_at', cursor)
      .order('created_at', { ascending: true })
      .limit(opts.batch ?? DEAL_BATCH);
    if (dealErr) throw new Error(`deals: ${dealErr.message}`);
    const deals = (dealData ?? []) as unknown as DealCandidateRow[];
    report.dealsScanned = deals.length;
    if (!deals.length) {
      await writeCursor(supabase, cursor, { lastRun: now.toISOString(), dealsScanned: 0 });
      report.cursorTo = cursor;
      return report;
    }

    // 3. Open, matchable predictions + company aliases.
    const predictions = await fetchOpenPredictions(supabase, now);
    report.openPredictions = predictions.length;
    const nextCursor = deals.reduce((m, d) => (d.created_at && d.created_at > m ? d.created_at : m), cursor);

    if (predictions.length) {
      const companies = await fetchAllCompanies(supabase);
      const index = buildDealIndex(deals, companies);

      // Existing candidate rows so the queue never duplicates (unique index is the backstop).
      const existing = new Set<string>();
      for (let i = 0; i < predictions.length; i += 200) {
        const ids = predictions.slice(i, i + 200).map((p) => p.id);
        const { data } = await supabase.from('outcomes').select('prediction_id,deal_id').in('prediction_id', ids);
        ((data ?? []) as Array<{ prediction_id: string; deal_id: string | null }>).forEach((o) => existing.add(`${o.prediction_id}:${o.deal_id}`));
      }

      const accepted: OutcomeInsert[] = [];
      const pending: OutcomeInsert[] = [];
      const resolvedIds: string[] = [];

      for (const p of predictions) {
        const scored: Array<{ deal: DealCandidateRow; score: number; evidence: Record<string, unknown> }> = [];
        for (const i of candidateDeals(p, index, companies)) {
          const deal = deals[i];
          const m = scoreMatch(p, deal, companies);
          report.pairsScored++;
          if (m.score >= REVIEW_QUEUE_THRESHOLD) scored.push({ deal, score: m.score, evidence: { ...m.evidence } });
        }
        if (!scored.length) continue;
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];
        if (best.score >= AUTO_RESOLVE_THRESHOLD) {
          if (existing.has(`${p.id}:${best.deal.id}`)) continue;
          accepted.push(buildOutcome(p, best.deal, best.score, best.evidence, companies, true, now));
          resolvedIds.push(p.id);
        } else {
          for (const s of scored.slice(0, MAX_QUEUED_PER_PREDICTION)) {
            if (existing.has(`${p.id}:${s.deal.id}`)) continue;
            pending.push(buildOutcome(p, s.deal, s.score, s.evidence, companies, false, now));
          }
        }
      }

      for (const chunk of chunks(accepted, 200)) {
        const { error } = await supabase.from('outcomes').insert(chunk);
        if (error) report.errors.push(`insert accepted: ${error.message}`);
        else report.autoResolved += chunk.length;
      }
      for (const chunk of chunks(pending, 200)) {
        const { error } = await supabase.from('outcomes').insert(chunk);
        if (error) report.errors.push(`insert pending: ${error.message}`);
        else report.queued += chunk.length;
      }
      for (const chunk of chunks(resolvedIds, 200)) {
        const { error } = await supabase
          .from('predictions')
          .update({ status: 'resolved', updated_at: now.toISOString() })
          .in('id', chunk);
        if (error) report.errors.push(`resolve predictions: ${error.message}`);
      }
    }

    // 4. Advance the cursor only after a clean batch, so a failed insert is retried next run.
    if (!report.errors.length) {
      await writeCursor(supabase, nextCursor, { lastRun: now.toISOString(), dealsScanned: deals.length, autoResolved: report.autoResolved, queued: report.queued });
      report.cursorTo = nextCursor;
    } else {
      report.cursorTo = cursor;
    }
  } catch (e) {
    report.errors.push(errMsg(e));
  }
  return report;
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
