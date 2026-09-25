/**
 * Outcome ledger — accuracy rollups.
 *
 * computeRollups() is pure: accepted outcomes (joined to their prediction) and
 * expired predictions in, one row per (source × TA × phase × model × window)
 * cell out, with `*` (null) for "all" on every dimension. materialiseRollups()
 * loads the inputs, upserts the cells and deletes stale ones.
 * readAccuracyRollups() is the reader behind GET /api/outcomes/accuracy.
 *
 * Window is by outcomes.resolved_at (expiry time for expired predictions).
 * Medians are linear-interpolated; rates are shares of rows where the metric
 * is non-null; window_hit_rate treats expired predictions as misses.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AccuracyFilters,
  AccuracyRollupRow,
  OutcomeMetrics,
  PredictionSource,
  RollupInputRow,
  RollupRunReport,
  RollupWindow,
} from './types';

const WINDOWS: Array<{ window: RollupWindow; days: number | null }> = [
  { window: '90d', days: 90 },
  { window: '365d', days: 365 },
  { window: 'all', days: null },
];

// ─── pure helpers ──────────────────────────────────────────────────────────

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = (v.length - 1) / 2;
  const lo = Math.floor(mid);
  const hi = Math.ceil(mid);
  return round4((v[lo] + v[hi]) / 2);
}

function rate(hits: number, denom: number): number | null {
  return denom > 0 ? round4(hits / denom) : null;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function rollupKey(source: string | null, ta: string | null, phase: string | null, model: string | null, window: RollupWindow): string {
  return [source ?? '*', ta ?? '*', phase ?? '*', model ?? '*', window].join('|');
}

interface Cell {
  source: PredictionSource | null;
  therapeutic_area: string | null;
  phase: string | null;
  model_version: string | null;
  window: RollupWindow;
  rows: RollupInputRow[];
}

function summarise(cell: Cell, computedAt: string): AccuracyRollupRow {
  const live = cell.rows.filter((r) => !r.expired);
  const expired = cell.rows.length - live.length;
  const m = (k: keyof OutcomeMetrics) => live.map((r) => r.metrics[k]);
  const num = (k: 'abs_pct_error_upfront' | 'abs_pct_error_total') => m(k).filter((x): x is number => typeof x === 'number');
  const bools = (k: 'within_band_upfront' | 'within_band_total' | 'buyer_hit' | 'window_hit') => m(k).filter((x): x is boolean => typeof x === 'boolean');

  const wbU = bools('within_band_upfront');
  const wbT = bools('within_band_total');
  const buyer = live.filter((r) => r.namedBuyers).map((r) => r.metrics.buyer_hit).filter((x): x is boolean => typeof x === 'boolean');
  const windowLive = live.filter((r) => r.hadWindow).map((r) => r.metrics.window_hit).filter((x): x is boolean => typeof x === 'boolean');
  const windowDenom = windowLive.length + expired;
  const windowHits = windowLive.filter(Boolean).length;

  return {
    key: rollupKey(cell.source, cell.therapeutic_area, cell.phase, cell.model_version, cell.window),
    source: cell.source,
    therapeutic_area: cell.therapeutic_area,
    phase: cell.phase,
    model_version: cell.model_version,
    window: cell.window,
    n: live.length,
    n_expired: expired,
    median_ape_upfront: median(num('abs_pct_error_upfront')),
    median_ape_total: median(num('abs_pct_error_total')),
    within_band_rate_upfront: rate(wbU.filter(Boolean).length, wbU.length),
    within_band_rate_total: rate(wbT.filter(Boolean).length, wbT.length),
    buyer_hit_rate: rate(buyer.filter(Boolean).length, buyer.length),
    window_hit_rate: rate(windowHits, windowDenom),
    value_captured_total_m: round4(live.reduce((s, r) => s + (r.metrics.value_captured_m ?? 0), 0)),
    computed_at: computedAt,
  };
}

/** Pure: input rows → one AccuracyRollupRow per non-empty cell. */
export function computeRollups(rows: RollupInputRow[], now: Date = new Date()): AccuracyRollupRow[] {
  const cells = new Map<string, Cell>();
  const computedAt = now.toISOString();
  const nowMs = now.getTime();

  for (const r of rows) {
    const at = r.resolved_at ? Date.parse(r.resolved_at) : NaN;
    for (const w of WINDOWS) {
      if (w.days != null) {
        if (!Number.isFinite(at)) continue;
        if (nowMs - at > w.days * 86_400_000) continue;
      }
      const sources: Array<PredictionSource | null> = [null, r.source];
      const tas = r.therapeutic_area ? [null, r.therapeutic_area] : [null];
      const phases = r.phase ? [null, r.phase] : [null];
      const models = r.model_version ? [null, r.model_version] : [null];
      for (const s of sources) for (const t of tas) for (const p of phases) for (const mv of models) {
        const key = rollupKey(s, t, p, mv, w.window);
        let cell = cells.get(key);
        if (!cell) {
          cell = { source: s, therapeutic_area: t, phase: p, model_version: mv, window: w.window, rows: [] };
          cells.set(key, cell);
        }
        cell.rows.push(r);
      }
    }
  }
  return [...cells.values()].map((c) => summarise(c, computedAt));
}

// ─── loaders ───────────────────────────────────────────────────────────────

interface OutcomeJoinRow extends OutcomeMetrics {
  resolved_at: string | null;
  predictions: {
    source: PredictionSource;
    therapeutic_area: string | null;
    phase: string | null;
    model_version: string | null;
    predicted_buyers: string[] | null;
    predicted_window_start: string | null;
    predicted_window_end: string | null;
  } | null;
}

interface ExpiredPredictionRow {
  source: PredictionSource;
  therapeutic_area: string | null;
  phase: string | null;
  model_version: string | null;
  updated_at: string;
}

const EMPTY_METRICS: OutcomeMetrics = {
  abs_pct_error_upfront: null, abs_pct_error_total: null, within_band_upfront: null, within_band_total: null,
  buyer_hit: null, window_hit: null, value_captured_m: null,
};

export async function loadRollupInputs(supabase: SupabaseClient): Promise<RollupInputRow[]> {
  const rows: RollupInputRow[] = [];
  const page = 1000;

  for (let from = 0, pages = 0; pages < 20; from += page, pages++) {
    const { data, error } = await supabase
      .from('outcomes')
      .select('resolved_at,abs_pct_error_upfront,abs_pct_error_total,within_band_upfront,within_band_total,buyer_hit,window_hit,value_captured_m,predictions!inner(source,therapeutic_area,phase,model_version,predicted_buyers,predicted_window_start,predicted_window_end)')
      .eq('status', 'accepted')
      .order('resolved_at', { ascending: false })
      .range(from, from + page - 1);
    if (error) throw new Error(`outcomes: ${error.message}`);
    const batch = (data ?? []) as unknown as OutcomeJoinRow[];
    for (const o of batch) {
      if (!o.predictions) continue;
      rows.push({
        source: o.predictions.source,
        therapeutic_area: o.predictions.therapeutic_area,
        phase: o.predictions.phase,
        model_version: o.predictions.model_version,
        resolved_at: o.resolved_at,
        expired: false,
        namedBuyers: (o.predictions.predicted_buyers ?? []).length > 0,
        hadWindow: !!(o.predictions.predicted_window_start && o.predictions.predicted_window_end),
        metrics: {
          abs_pct_error_upfront: o.abs_pct_error_upfront,
          abs_pct_error_total: o.abs_pct_error_total,
          within_band_upfront: o.within_band_upfront,
          within_band_total: o.within_band_total,
          buyer_hit: o.buyer_hit,
          window_hit: o.window_hit,
          value_captured_m: o.value_captured_m,
        },
      });
    }
    if (batch.length < page) break;
  }

  for (let from = 0, pages = 0; pages < 20; from += page, pages++) {
    const { data, error } = await supabase
      .from('predictions')
      .select('source,therapeutic_area,phase,model_version,updated_at')
      .eq('status', 'expired')
      .order('updated_at', { ascending: false })
      .range(from, from + page - 1);
    if (error) throw new Error(`expired predictions: ${error.message}`);
    const batch = (data ?? []) as unknown as ExpiredPredictionRow[];
    for (const p of batch) {
      rows.push({
        source: p.source, therapeutic_area: p.therapeutic_area, phase: p.phase, model_version: p.model_version,
        resolved_at: p.updated_at, expired: true, namedBuyers: false, hadWindow: true, metrics: EMPTY_METRICS,
      });
    }
    if (batch.length < page) break;
  }
  return rows;
}

// ─── materialise ───────────────────────────────────────────────────────────

export async function materialiseRollups(supabase: SupabaseClient, now: Date = new Date()): Promise<RollupRunReport> {
  const report: RollupRunReport = { inputRows: 0, cells: 0, errors: [] };
  try {
    const inputs = await loadRollupInputs(supabase);
    report.inputRows = inputs.length;
    const cells = computeRollups(inputs, now);
    for (let i = 0; i < cells.length; i += 500) {
      const { error } = await supabase.from('accuracy_rollups').upsert(cells.slice(i, i + 500), { onConflict: 'key' });
      if (error) report.errors.push(`upsert: ${error.message}`);
      else report.cells += Math.min(500, cells.length - i);
    }
    if (!report.errors.length) {
      const { error } = await supabase.from('accuracy_rollups').delete().lt('computed_at', now.toISOString());
      if (error) report.errors.push(`prune: ${error.message}`);
    }
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : String(e));
  }
  return report;
}

// ─── reader ────────────────────────────────────────────────────────────────

/**
 * Rollup cells for the given filters. An absent dimension means the "all"
 * cell for that dimension (null), so `{ source: 'brief' }` returns the
 * brief × all-TA × all-phase × all-model cells for every window.
 */
export async function readAccuracyRollups(supabase: SupabaseClient, filters: AccuracyFilters = {}): Promise<AccuracyRollupRow[]> {
  let q = supabase.from('accuracy_rollups').select('*');
  const dim = (col: 'source' | 'therapeutic_area' | 'phase' | 'model_version', v: string | null | undefined) => {
    q = v ? q.eq(col, v) : q.is(col, null);
  };
  dim('source', filters.source);
  dim('therapeutic_area', filters.therapeutic_area);
  dim('phase', filters.phase);
  dim('model_version', filters.model_version);
  if (filters.window) q = q.eq('window', filters.window);
  const { data, error } = await q.order('window', { ascending: true });
  if (error) throw new Error(`accuracy_rollups: ${error.message}`);
  return (data ?? []) as AccuracyRollupRow[];
}
