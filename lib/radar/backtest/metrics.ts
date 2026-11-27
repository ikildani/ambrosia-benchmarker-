/**
 * Search & Evaluation scoring v3 — backtest metrics (pure).
 *
 * Every function takes parallel arrays of predicted probabilities (0..1) and
 * binary labels (0/1), plus optional per-row importance weights, and returns
 * a plain number or a small record. Nothing here touches Supabase.
 *
 * Weights exist because the training/test snapshots subsample negative
 * assets (labels.ts keepNegativeAsset). A negative row sampled at rate r
 * carries weight 1/r so precision@k, lift, Brier and the calibration bins
 * describe the full asset universe, not the subsample. ROC-AUC and PR-AUC are
 * computed on the weighted pair / precision-recall definitions for the same
 * reason. With all weights = 1 the definitions reduce to the usual ones and
 * match lib/services/pharma-intent-backtest-v2.ts (Mann-Whitney AUC, top-k
 * precision, mean squared error), which does not export them.
 */

import type { ScoreBacktestSummary } from '@/lib/radar/types';

export interface CalibrationBin {
  bin: string;
  predicted: number;
  observed: number;
  n: number;
}

export interface FactorImportance {
  factor: string;
  importance: number;
}

export interface BacktestMetrics {
  n: number;
  positives: number;
  /** Weighted positive share (the universe base rate when weights undo subsampling). */
  base_rate: number;
  roc_auc: number;
  pr_auc: number;
  precision_at_50: number;
  precision_at_100: number;
  precision_top_decile: number;
  lift_top_decile: number;
  brier: number;
  brier_baseline: number;
  calibration_bins: CalibrationBin[];
  /** True when the evaluation set has fewer than MIN_POSITIVES_FOR_POWER positives. */
  low_power: boolean;
}

/** Below this many positives in the holdout, every metric is flagged low_power. */
export const MIN_POSITIVES_FOR_POWER = 30;

type Weights = readonly number[] | undefined;

function assertParallel(scores: readonly number[], labels: readonly number[], weights?: Weights): void {
  if (scores.length !== labels.length) {
    throw new Error(`metrics: scores (${scores.length}) and labels (${labels.length}) differ in length`);
  }
  if (weights && weights.length !== scores.length) {
    throw new Error(`metrics: weights (${weights.length}) and scores (${scores.length}) differ in length`);
  }
}

function w(weights: Weights, i: number): number {
  return weights ? weights[i] : 1;
}

/** Indices sorted by score descending; ties keep input order (stable). */
function rankDesc(scores: readonly number[]): number[] {
  return scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a] || a - b);
}

/**
 * ROC-AUC = P(score_pos > score_neg) over weighted positive/negative pairs,
 * ties counting half. O(n log n): walk scores ascending, accumulating the
 * negative weight below each tie group. Returns 0.5 when a class is empty.
 */
export function rocAuc(scores: readonly number[], labels: readonly number[], weights?: Weights): number {
  assertParallel(scores, labels, weights);
  const n = scores.length;
  let wPos = 0;
  let wNeg = 0;
  for (let i = 0; i < n; i++) { if (labels[i] === 1) wPos += w(weights, i); else wNeg += w(weights, i); }
  if (wPos === 0 || wNeg === 0) return 0.5;

  const order = scores.map((_, i) => i).sort((a, b) => scores[a] - scores[b] || a - b);
  let negBelow = 0;
  let sum = 0;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && scores[order[j + 1]] === scores[order[i]]) j++;
    let posHere = 0;
    let negHere = 0;
    for (let k = i; k <= j; k++) {
      const idx = order[k];
      if (labels[idx] === 1) posHere += w(weights, idx); else negHere += w(weights, idx);
    }
    sum += posHere * (negBelow + 0.5 * negHere);
    negBelow += negHere;
    i = j + 1;
  }
  return sum / (wPos * wNeg);
}

/**
 * PR-AUC as (weighted) average precision: Σ over tie groups of
 * precision(group) × recall gained in the group. Returns 0 with no positives.
 */
export function prAuc(scores: readonly number[], labels: readonly number[], weights?: Weights): number {
  assertParallel(scores, labels, weights);
  const n = scores.length;
  let wPos = 0;
  for (let i = 0; i < n; i++) if (labels[i] === 1) wPos += w(weights, i);
  if (n === 0 || wPos === 0) return 0;

  const order = rankDesc(scores);
  let tp = 0;
  let seen = 0;
  let ap = 0;
  let k = 0;
  while (k < n) {
    let j = k;
    while (j + 1 < n && scores[order[j + 1]] === scores[order[k]]) j++;
    let tpGroup = 0;
    let wGroup = 0;
    for (let g = k; g <= j; g++) {
      const idx = order[g];
      wGroup += w(weights, idx);
      if (labels[idx] === 1) tpGroup += w(weights, idx);
    }
    tp += tpGroup;
    seen += wGroup;
    ap += (tp / seen) * (tpGroup / wPos);
    k = j + 1;
  }
  return ap;
}

/**
 * Precision among the k highest-scored rows. With weights, rows are consumed
 * in score order until k units of weight are covered (the last row counts
 * fractionally), so "top 50" means the top 50 assets of the universe.
 */
export function precisionAtK(scores: readonly number[], labels: readonly number[], k: number, weights?: Weights): number {
  assertParallel(scores, labels, weights);
  const n = scores.length;
  if (n === 0 || k <= 0) return 0;
  const order = rankDesc(scores);
  let covered = 0;
  let tp = 0;
  for (let r = 0; r < n && covered < k; r++) {
    const idx = order[r];
    const wi = Math.min(w(weights, idx), k - covered);
    covered += wi;
    if (labels[idx] === 1) tp += wi;
  }
  return covered > 0 ? tp / covered : 0;
}

/** Total weight (= row count when unweighted). */
function totalWeight(n: number, weights?: Weights): number {
  if (!weights) return n;
  let s = 0;
  for (const v of weights) s += v;
  return s;
}

/** Precision among the top decile of the (weighted) universe. */
export function precisionTopDecile(scores: readonly number[], labels: readonly number[], weights?: Weights): number {
  const k = Math.max(1, totalWeight(scores.length, weights) / 10);
  return precisionAtK(scores, labels, k, weights);
}

/**
 * Lift of the top decile: top-10 % precision divided by the base rate.
 * 1.0 = no better than random; 0 when there are no positives.
 */
export function liftTopDecile(scores: readonly number[], labels: readonly number[], weights?: Weights): number {
  assertParallel(scores, labels, weights);
  const n = scores.length;
  if (n === 0) return 0;
  let wPos = 0;
  for (let i = 0; i < n; i++) if (labels[i] === 1) wPos += w(weights, i);
  if (wPos === 0) return 0;
  const base = wPos / totalWeight(n, weights);
  return precisionTopDecile(scores, labels, weights) / base;
}

/** (Weighted) mean squared error between probability and outcome. */
export function brier(scores: readonly number[], labels: readonly number[], weights?: Weights): number {
  assertParallel(scores, labels, weights);
  if (scores.length === 0) return 0;
  let sum = 0;
  let tw = 0;
  for (let i = 0; i < scores.length; i++) {
    const wi = w(weights, i);
    sum += wi * (scores[i] - labels[i]) ** 2;
    tw += wi;
  }
  return tw > 0 ? sum / tw : 0;
}

/**
 * Equal-width calibration bins on [0, 1]. Each bin reports the weighted mean
 * predicted probability, the weighted observed positive rate and the raw row
 * count. Empty bins are kept (n = 0) so the chart axis is stable across runs.
 */
export function calibrationBins(scores: readonly number[], labels: readonly number[], bins = 10, weights?: Weights): CalibrationBin[] {
  assertParallel(scores, labels, weights);
  const width = 1 / bins;
  const sumPred = new Array<number>(bins).fill(0);
  const sumObs = new Array<number>(bins).fill(0);
  const sumW = new Array<number>(bins).fill(0);
  const count = new Array<number>(bins).fill(0);
  for (let i = 0; i < scores.length; i++) {
    const p = Math.max(0, Math.min(1, scores[i]));
    const b = Math.min(bins - 1, Math.floor(p / width));
    const wi = w(weights, i);
    sumPred[b] += wi * p;
    sumObs[b] += wi * labels[i];
    sumW[b] += wi;
    count[b]++;
  }
  return Array.from({ length: bins }, (_, b) => ({
    bin: `${(b * width).toFixed(1)}-${((b + 1) * width).toFixed(1)}`,
    predicted: sumW[b] ? sumPred[b] / sumW[b] : 0,
    observed: sumW[b] ? sumObs[b] / sumW[b] : 0,
    n: count[b],
  }));
}

/** Expected calibration error: |predicted − observed| weighted by bin share. */
export function expectedCalibrationError(bins: readonly CalibrationBin[]): number {
  const total = bins.reduce((s, b) => s + b.n, 0);
  if (total === 0) return 0;
  return bins.reduce((s, b) => s + (b.n / total) * Math.abs(b.predicted - b.observed), 0);
}

/**
 * Factor importance = mean absolute logit contribution per feature across the
 * evaluation rows, normalised to sum to 1. `contributions[i][j]` is the
 * contribution of feature j on row i (weight × standardized value).
 */
export function factorImportance(featureNames: readonly string[], contributions: readonly (readonly number[])[]): FactorImportance[] {
  const d = featureNames.length;
  const acc = new Array<number>(d).fill(0);
  for (const row of contributions) {
    for (let j = 0; j < d; j++) acc[j] += Math.abs(row[j] ?? 0);
  }
  const n = contributions.length || 1;
  const means = acc.map(a => a / n);
  const total = means.reduce((s, m) => s + m, 0);
  return featureNames
    .map((factor, j) => ({ factor, importance: total > 0 ? means[j] / total : 0 }))
    .sort((a, b) => b.importance - a.importance);
}

/**
 * All scorecard numbers in one call.
 *
 * `scores` are calibrated probabilities (Brier and calibration bins need them).
 * `rankScores` order the rows for AUC, PR-AUC, precision@k and lift; pass the
 * raw logits, because isotonic calibration is a step function that ties whole
 * blocks of rows (the feed orders by the logit for the same reason). Defaults
 * to `scores`.
 */
export function computeMetrics(
  scores: readonly number[],
  labels: readonly number[],
  weights?: Weights,
  rankScores: readonly number[] = scores,
): BacktestMetrics {
  assertParallel(scores, labels, weights);
  assertParallel(rankScores, labels, weights);
  const n = scores.length;
  let positives = 0;
  let wPos = 0;
  for (let i = 0; i < n; i++) if (labels[i] === 1) { positives++; wPos += w(weights, i); }
  const tw = totalWeight(n, weights);
  const baseRate = tw > 0 ? wPos / tw : 0;
  return {
    n,
    positives,
    base_rate: baseRate,
    roc_auc: rocAuc(rankScores, labels, weights),
    pr_auc: prAuc(rankScores, labels, weights),
    precision_at_50: precisionAtK(rankScores, labels, 50, weights),
    precision_at_100: precisionAtK(rankScores, labels, 100, weights),
    precision_top_decile: precisionTopDecile(rankScores, labels, weights),
    lift_top_decile: liftTopDecile(rankScores, labels, weights),
    brier: brier(scores, labels, weights),
    // Brier of always predicting the base rate — the honest comparison point.
    brier_baseline: baseRate * (1 - baseRate),
    calibration_bins: calibrationBins(scores, labels, 10, weights),
    low_power: positives < MIN_POSITIVES_FOR_POWER,
  };
}

/**
 * Assemble the row written to radar_score_backtests (= ScoreBacktestSummary
 * minus the DB-generated id, plus the harness-only low_power flag).
 */
export function toBacktestSummary(args: {
  modelVersion: string;
  runAt: Date;
  trainWindow: { from: string; to: string };
  testWindow: { from: string; to: string };
  nTrain: number;
  metrics: BacktestMetrics;
  importance: FactorImportance[];
  notes: string[];
}): Omit<ScoreBacktestSummary, 'id'> & { low_power: boolean } {
  const m = args.metrics;
  const notes = [...args.notes];
  if (m.low_power) {
    notes.unshift(
      `low_power: only ${m.positives} positive${m.positives === 1 ? '' : 's'} in the test window (< ${MIN_POSITIVES_FOR_POWER}); ` +
      'treat every metric as indicative, not as evidence of discrimination.',
    );
  }
  return {
    model_version: args.modelVersion,
    run_at: args.runAt.toISOString(),
    train_window: args.trainWindow,
    test_window: args.testWindow,
    n_train: args.nTrain,
    n_test: m.n,
    positives_test: m.positives,
    roc_auc: round4(m.roc_auc),
    pr_auc: round4(m.pr_auc),
    precision_at_50: round4(m.precision_at_50),
    precision_at_100: round4(m.precision_at_100),
    lift_top_decile: Math.round(m.lift_top_decile * 1000) / 1000,
    brier: Math.round(m.brier * 1e6) / 1e6,
    calibration_bins: m.calibration_bins.map(b => ({ ...b, predicted: round4(b.predicted), observed: round4(b.observed) })),
    factor_importance: args.importance.map(f => ({ factor: f.factor, importance: round4(f.importance) })),
    notes: notes.length ? notes.join(' | ') : null,
    low_power: m.low_power,
  };
}

function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

// ═══════════════════════════════════════════════════════════════════════
// FEED PROTOCOL (v5): rank within each as-of month, average across months
// ═══════════════════════════════════════════════════════════════════════

/**
 * v2 (Nov 2026): v1 ranked every industry primary row, including the programs the default feed hides
 * (comparator_or_background, marketed_other, duplicate_program, not_a_program: 22 % of test rows).
 * v2 ranks only what the feed shows; the metrics of v1 and v2 rows are not comparable.
 */
export const EVAL_PROTOCOL = 'feed_monthly_v2';

export interface MonthlyFeedMetrics {
  months: number;
  /** Months that had at least one positive (the averages run over these). */
  months_with_positives: number;
  roc_auc: number;
  precision_at_50: number;
  precision_at_100: number;
  /** Mean sampling-weighted positive rate. */
  base_rate: number;
  /** precision_at_100 / base_rate. */
  lift_at_100: number;
  lift_top_decile: number;
  /** Mean share of the month's positives found in the top 1 % of the weighted universe. */
  recall_top_1pct: number;
}

/**
 * The feed shows one list per day, so the honest top-of-list numbers rank one month's
 * population at a time: "top 100" is the top 100 programs of that month's universe (weights undo
 * negative subsampling), not the top 100 rows of nine months pooled. Every metric is the mean
 * over months with at least one positive; lift_at_100 divides the mean precision by the mean
 * base rate on the same rows.
 */
export function computeMonthlyMetrics(
  months: readonly string[],
  rankScores: readonly number[],
  labels: readonly number[],
  weights?: Weights,
): MonthlyFeedMetrics {
  assertParallel(rankScores, labels, weights);
  if (months.length !== labels.length) throw new Error('computeMonthlyMetrics: months and labels differ in length');
  const byMonth = new Map<string, number[]>();
  months.forEach((m, i) => {
    const list = byMonth.get(m);
    if (list) list.push(i); else byMonth.set(m, [i]);
  });
  let n = 0;
  const acc = { auc: 0, p50: 0, p100: 0, base: 0, lift: 0, r1: 0 };
  for (const idx of byMonth.values()) {
    const y = idx.map(i => labels[i]);
    if (!y.some(v => v === 1)) continue;
    const s = idx.map(i => rankScores[i]);
    const ww = idx.map(i => w(weights, i));
    let wp = 0;
    let wt = 0;
    for (let k = 0; k < idx.length; k++) { wt += ww[k]; if (y[k] === 1) wp += ww[k]; }
    n++;
    acc.auc += rocAuc(s, y, ww);
    acc.p50 += precisionAtK(s, y, 50, ww);
    acc.p100 += precisionAtK(s, y, 100, ww);
    acc.base += wt > 0 ? wp / wt : 0;
    acc.lift += liftTopDecile(s, y, ww);
    const k1 = Math.max(1, wt / 100);
    acc.r1 += wp > 0 ? (precisionAtK(s, y, k1, ww) * Math.min(k1, wt)) / wp : 0;
  }
  const mean = (v: number) => (n ? v / n : 0);
  const base = mean(acc.base);
  return {
    months: byMonth.size,
    months_with_positives: n,
    roc_auc: mean(acc.auc),
    precision_at_50: mean(acc.p50),
    precision_at_100: mean(acc.p100),
    base_rate: base,
    lift_at_100: base > 0 ? mean(acc.p100) / base : 0,
    lift_top_decile: mean(acc.lift),
    recall_top_1pct: mean(acc.r1),
  };
}

export interface GateMetrics {
  roc_auc: number;
  precision_at_100: number;
  lift_top_decile: number;
}

/**
 * Activation gate (v5): a candidate replaces the incumbent only when it is strictly better on
 * precision@100, top-decile lift AND ROC AUC, measured by the same protocol on the same rows.
 * A tie at zero precision@100 is not an improvement.
 */
export function gateDecision(candidate: GateMetrics, incumbent: GateMetrics | null): { activate: boolean; reasons: string[] } {
  if (!incumbent) return { activate: true, reasons: ['no comparable incumbent'] };
  const reasons: string[] = [];
  const cmp = (name: keyof GateMetrics) => {
    const ok = candidate[name] > incumbent[name] + 1e-9;
    reasons.push(`${name} ${candidate[name].toFixed(4)} vs ${incumbent[name].toFixed(4)} ${ok ? 'better' : 'not better'}`);
    return ok;
  };
  const results = [cmp('precision_at_100'), cmp('lift_top_decile'), cmp('roc_auc')];
  return { activate: results.every(Boolean), reasons };
}
