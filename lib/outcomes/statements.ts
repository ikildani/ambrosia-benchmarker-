/**
 * Outcome ledger — accuracy statements (Alaric outcomes program, workstream 2).
 *
 * Turns accuracy_rollups cells into the sentences the product prints:
 *
 *   accuracyStatementFromRollups — the brief coverage block (DataCoverage.accuracy)
 *   calculatorAccuracyLine       — "This profile: median error ±X% on N resolved deals"
 *   summariseAccuracy            — by source × window, for a methodology page
 *
 * Every statement needs at least MIN_N accepted outcomes in the cell; below
 * that the helpers return null and the surface prints its honest fallback (or
 * nothing). The pure helpers take rows; the loaders take a Supabase client and
 * never throw — a failure is logged with the [Outcomes] prefix and yields null.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataCoverage } from '@/lib/brief/types';
import { readAccuracyRollups } from './rollups';
import type { AccuracyRollupRow, PredictionSource, RollupWindow } from './types';

/** Minimum accepted outcomes in a cell before any accuracy statement is printed. */
export const MIN_N = 10;

export type AccuracyStatement = NonNullable<DataCoverage['accuracy']>;

// ─── formatting ────────────────────────────────────────────────────────────

/** 0.2345 → "±23%"; null → null. */
export function formatMedianError(ape: number | null | undefined): string | null {
  if (typeof ape !== 'number' || !Number.isFinite(ape) || ape < 0) return null;
  return `±${Math.round(ape * 100)}%`;
}

/** 0.684 → "68%"; null → null. */
export function formatRate(rate: number | null | undefined): string | null {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) return null;
  return `${Math.round(rate * 100)}%`;
}

function usable(row: AccuracyRollupRow | undefined, metric: 'median_ape_total' | 'median_ape_upfront'): row is AccuracyRollupRow {
  return !!row && row.n >= MIN_N && typeof row[metric] === 'number';
}

function pickCell(rows: AccuracyRollupRow[], source: PredictionSource | null, window: RollupWindow): AccuracyRollupRow | undefined {
  return rows.find((r) => (r.source ?? null) === source && r.window === window);
}

// ─── brief coverage block ──────────────────────────────────────────────────

/**
 * Pure. Rows are rollup cells already filtered to the asset's TA (any source,
 * any window). Prefers the brief × all-time cell; falls back to the all-source
 * cell for the same TA. Returns null below MIN_N so the methodology page keeps
 * its "omitted rather than estimated" line.
 */
export function accuracyStatementFromRollups(rows: AccuracyRollupRow[]): AccuracyStatement | null {
  const brief = pickCell(rows, 'brief', 'all');
  const all = pickCell(rows, null, 'all');
  const cell = usable(brief, 'median_ape_total') ? brief : usable(all, 'median_ape_total') ? all : null;
  if (!cell) return null;

  const value = formatMedianError(cell.median_ape_total);
  if (!value) return null;

  const clauses: string[] = [];
  const band = formatRate(cell.within_band_rate_total);
  if (band) clauses.push(`within predicted band ${band} of the time`);
  const buyer = formatRate(cell.buyer_hit_rate);
  if (buyer && cell.source === 'brief') clauses.push(`buyers named in the brief signed ${buyer} of the time`);
  const note = clauses.length ? `${clauses.join('; ')}.` : 'Resolved against announced deals for this therapeutic area.';

  return {
    metric: cell.source === 'brief'
      ? 'Median error on resolved briefs (total value)'
      : 'Median error on resolved predictions in this therapeutic area (total value)',
    value,
    n: cell.n,
    note,
  };
}

/**
 * Loads the TA's brief and all-source cells (window = all) and returns the
 * statement, or null. Never throws.
 */
export async function loadBriefAccuracyStatement(supabase: SupabaseClient, therapeuticArea: string | null | undefined): Promise<AccuracyStatement | null> {
  const ta = therapeuticArea?.trim();
  if (!ta) return null;
  try {
    const [brief, all] = await Promise.all([
      readAccuracyRollups(supabase, { source: 'brief', therapeutic_area: ta, window: 'all' }),
      readAccuracyRollups(supabase, { source: null, therapeutic_area: ta, window: 'all' }),
    ]);
    const statement = accuracyStatementFromRollups([...brief, ...all]);
    console.log(`[Outcomes] brief accuracy for ${ta}: ${statement ? `${statement.value} on n=${statement.n}` : 'below threshold'}`);
    return statement;
  } catch (e) {
    console.warn('[Outcomes] brief accuracy statement failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ─── calculator line ───────────────────────────────────────────────────────

/**
 * Pure. Rows are cells for (ta, phase, window = all) from the calculator and
 * all-source dimensions. Prefers the calculator cell, then all sources; uses
 * the upfront error (the headline card) and falls back to total. One sentence,
 * or null when N < MIN_N.
 */
export function calculatorAccuracyLine(rows: AccuracyRollupRow[]): string | null {
  const order: Array<PredictionSource | null> = ['calculator', null];
  for (const source of order) {
    const cell = pickCell(rows, source, 'all');
    if (!cell || cell.n < MIN_N) continue;
    const value = formatMedianError(cell.median_ape_upfront) ?? formatMedianError(cell.median_ape_total);
    if (!value) continue;
    return `This profile: median error ${value} on ${cell.n} resolved deals`;
  }
  return null;
}

// ─── methodology summary ───────────────────────────────────────────────────

export interface AccuracyWindowSummary {
  window: RollupWindow;
  n: number;
  nExpired: number;
  /** "±23%" or null below MIN_N / when unmeasured. */
  medianErrorUpfront: string | null;
  medianErrorTotal: string | null;
  withinBandUpfront: string | null;
  withinBandTotal: string | null;
  buyerHitRate: string | null;
  windowHitRate: string | null;
  /** $M, summed over client-reported outcomes. */
  valueCapturedM: number;
  /** False when n < MIN_N: print the counts, not the rates. */
  meaningful: boolean;
}

export interface AccuracySourceSummary {
  source: PredictionSource | 'all';
  label: string;
  windows: AccuracyWindowSummary[];
}

export interface AccuracySummary {
  computedAt: string | null;
  minN: number;
  sources: AccuracySourceSummary[];
}

const SOURCE_ORDER: Array<{ source: PredictionSource | 'all'; label: string }> = [
  { source: 'all', label: 'All predictions' },
  { source: 'calculator', label: 'Calculator ranges' },
  { source: 'brief', label: 'Deal briefs' },
  { source: 'radar', label: 'Radar licensing calls' },
  { source: 'share', label: 'Shared calculations' },
];
const WINDOW_ORDER: RollupWindow[] = ['90d', '365d', 'all'];

/** Pure. Global cells (TA / phase / model = all) → the methodology table. */
export function summariseAccuracy(rows: AccuracyRollupRow[]): AccuracySummary {
  const global = rows.filter((r) => r.therapeutic_area == null && r.phase == null && r.model_version == null);
  const sources: AccuracySourceSummary[] = [];
  for (const { source, label } of SOURCE_ORDER) {
    const windows: AccuracyWindowSummary[] = [];
    for (const window of WINDOW_ORDER) {
      const cell = pickCell(global, source === 'all' ? null : source, window);
      if (!cell) continue;
      const meaningful = cell.n >= MIN_N;
      windows.push({
        window,
        n: cell.n,
        nExpired: cell.n_expired,
        medianErrorUpfront: meaningful ? formatMedianError(cell.median_ape_upfront) : null,
        medianErrorTotal: meaningful ? formatMedianError(cell.median_ape_total) : null,
        withinBandUpfront: meaningful ? formatRate(cell.within_band_rate_upfront) : null,
        withinBandTotal: meaningful ? formatRate(cell.within_band_rate_total) : null,
        buyerHitRate: meaningful ? formatRate(cell.buyer_hit_rate) : null,
        windowHitRate: meaningful ? formatRate(cell.window_hit_rate) : null,
        valueCapturedM: cell.value_captured_total_m,
        meaningful,
      });
    }
    if (windows.length) sources.push({ source, label, windows });
  }
  const computedAt = global.reduce<string | null>((latest, r) => (!latest || r.computed_at > latest ? r.computed_at : latest), null);
  return { computedAt, minN: MIN_N, sources };
}

/**
 * The shape a public methodology page prints: accuracy by source and window
 * from accuracy_rollups. Never throws; an empty summary on failure.
 */
export async function getAccuracySummary(supabase: SupabaseClient): Promise<AccuracySummary> {
  try {
    const { data, error } = await supabase
      .from('accuracy_rollups')
      .select('*')
      .is('therapeutic_area', null)
      .is('phase', null)
      .is('model_version', null);
    if (error) throw new Error(error.message);
    return summariseAccuracy((data ?? []) as AccuracyRollupRow[]);
  } catch (e) {
    console.warn('[Outcomes] accuracy summary failed:', e instanceof Error ? e.message : e);
    return { computedAt: null, minN: MIN_N, sources: [] };
  }
}
