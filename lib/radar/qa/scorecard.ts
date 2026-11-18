/**
 * Search & Evaluation scorecard — one measured 0-100 number for "how world-class is the engine".
 *
 * radar_qa_scorecard_stats() (migration 190) returns raw measures. Each metric here maps one
 * measure onto 0-100 by linear interpolation between a "poor" anchor (0) and a "world-class"
 * anchor (100), clamped. Dimension score = mean of its metric scores; overall = weighted mean of
 * dimensions. A metric whose sample is too small scores 0 and is flagged `unmeasured`, so the
 * number cannot be inflated by leaving things unmeasured.
 *
 * Anchors are deliberately strict: 100 means better than the commercial leaders on that measure.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ScorecardDimension = 'accuracy' | 'ranking' | 'coverage' | 'signals' | 'freshness' | 'evidence';

export type ScorecardStats = Record<string, number | string | null | undefined>;

export interface ScorecardMetricSpec {
  key: string;
  dimension: ScorecardDimension;
  label: string;
  /** Value scoring 0. */
  poor: number;
  /** Value scoring 100. */
  target: number;
  /** Read the metric value from the raw stats; null = not measurable. */
  value: (s: ScorecardStats) => number | null;
  /** Minimum sample for the value to count; below it the metric is unmeasured. */
  sample?: (s: ScorecardStats) => number;
  minSample?: number;
  format: 'pct' | 'count' | 'ratio' | 'hours';
}

export interface ScorecardMetricResult {
  key: string;
  dimension: ScorecardDimension;
  label: string;
  value: number | null;
  score: number;
  unmeasured: boolean;
  poor: number;
  target: number;
  format: ScorecardMetricSpec['format'];
}

export interface ScorecardResult {
  overall: number;
  dimensions: { dimension: ScorecardDimension; weight: number; score: number }[];
  metrics: ScorecardMetricResult[];
}

export const SCORECARD_WEIGHTS: Record<ScorecardDimension, number> = {
  accuracy: 0.3,
  ranking: 0.25,
  coverage: 0.15,
  signals: 0.1,
  freshness: 0.1,
  evidence: 0.1,
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function ratio(a: unknown, b: unknown): number | null {
  const x = num(a);
  const y = num(b);
  return x === null || y === null || y === 0 ? null : x / y;
}

export const SCORECARD_METRICS: readonly ScorecardMetricSpec[] = [
  // ── accuracy ─────────────────────────────────────────────────────────
  { key: 'audit_owner', dimension: 'accuracy', label: 'Owner correct in human audit of the top of the list', poor: 0.8, target: 0.98,
    value: s => num(s.audit_owner_share), sample: s => num(s.audit_owner_n) ?? 0, minSample: 50, format: 'pct' },
  { key: 'audit_availability', dimension: 'accuracy', label: 'Availability correct in human audit', poor: 0.7, target: 0.95,
    value: s => num(s.audit_availability_share), sample: s => num(s.audit_availability_n) ?? 0, minSample: 50, format: 'pct' },
  { key: 'top500_originator', dimension: 'accuracy', label: 'Top 500 owned by the originator', poor: 0.6, target: 0.98,
    value: s => num(s.top500_originator_share), format: 'pct' },
  { key: 'top1k_duplicates', dimension: 'accuracy', label: 'Duplicate programs in the top 1,000', poor: 50, target: 5,
    value: s => num(s.top1k_duplicates), format: 'count' },
  { key: 'feed_drug_resolved', dimension: 'accuracy', label: 'Feed programs matched to a known drug', poor: 0.5, target: 0.9,
    value: s => num(s.feed_drug_resolved_share), format: 'pct' },
  // ── ranking ──────────────────────────────────────────────────────────
  { key: 'backtest_lift_at_100', dimension: 'ranking', label: 'Top-100 hit rate vs. base rate (backtest)', poor: 1, target: 10,
    value: s => ratio(s.backtest_precision_at_100, s.backtest_base_rate), format: 'ratio' },
  { key: 'backtest_lift_top_decile', dimension: 'ranking', label: 'Top-decile lift (backtest)', poor: 2, target: 8,
    value: s => num(s.backtest_lift_top_decile), format: 'ratio' },
  { key: 'backtest_auc', dimension: 'ranking', label: 'Discrimination, ROC AUC (backtest)', poor: 0.7, target: 0.92,
    value: s => num(s.backtest_roc_auc), format: 'ratio' },
  { key: 'forward_top_decile', dimension: 'ranking', label: 'Licensed assets already in the top decile before the deal (live)', poor: 0.1, target: 0.6,
    value: s => num(s.forward_top_decile_share), sample: s => num(s.forward_n) ?? 0, minSample: 20, format: 'pct' },
  // ── coverage ─────────────────────────────────────────────────────────
  { key: 'universe_programs', dimension: 'coverage', label: 'Programs in the universe', poor: 100_000, target: 200_000,
    value: s => num(s.universe_programs), format: 'count' },
  { key: 'deal_recall_12m', dimension: 'coverage', label: 'Licensing deals (12 months) linked to a program', poor: 0.2, target: 0.95,
    value: s => ratio(s.deals_12m_linked, s.deals_12m), sample: s => num(s.deals_12m) ?? 0, minSample: 50, format: 'pct' },
  { key: 'feed_classified', dimension: 'coverage', label: 'Feed programs classified', poor: 0.7, target: 0.98,
    value: s => num(s.feed_classified_share), format: 'pct' },
  { key: 'feed_ta', dimension: 'coverage', label: 'Feed programs with a therapeutic area', poor: 0.7, target: 0.98,
    value: s => num(s.feed_ta_share), format: 'pct' },
  // ── signals ──────────────────────────────────────────────────────────
  { key: 'company_signal_coverage', dimension: 'signals', label: 'Feed companies with financial, financing or intent signals', poor: 0.05, target: 0.6,
    value: s => ratio(s.signal_companies, s.feed_companies), format: 'pct' },
  // ── freshness ────────────────────────────────────────────────────────
  { key: 'hours_since_classify', dimension: 'freshness', label: 'Hours since the classifier last succeeded', poor: 72, target: 12,
    value: s => num(s.hours_since_classify_ok), format: 'hours' },
  { key: 'failed_runs_48h', dimension: 'freshness', label: 'Failed pipeline runs in the last 48 hours', poor: 10, target: 0,
    value: s => num(s.failed_runs_48h), format: 'count' },
  // ── evidence ─────────────────────────────────────────────────────────
  { key: 'top500_sourced', dimension: 'evidence', label: 'Top 500 with a primary source', poor: 0.8, target: 1,
    value: s => num(s.top500_sourced_share), format: 'pct' },
  { key: 'top500_partnership_checked', dimension: 'evidence', label: 'Top 500 with a partnership check on record', poor: 0.5, target: 0.98,
    value: s => num(s.top500_partnership_checked_share), format: 'pct' },
];

/** 0-100 between the anchors; works whether higher or lower is better. */
export function scoreBetween(value: number, poor: number, target: number): number {
  if (poor === target) return value === target ? 100 : 0;
  const t = (value - poor) / (target - poor);
  return Math.round(Math.min(1, Math.max(0, t)) * 1000) / 10;
}

export function computeScorecard(stats: ScorecardStats, specs: readonly ScorecardMetricSpec[] = SCORECARD_METRICS): ScorecardResult {
  const metrics: ScorecardMetricResult[] = specs.map(spec => {
    const value = spec.value(stats);
    const sampleOk = spec.minSample === undefined || (spec.sample?.(stats) ?? 0) >= spec.minSample;
    const unmeasured = value === null || !sampleOk;
    return {
      key: spec.key,
      dimension: spec.dimension,
      label: spec.label,
      value,
      score: unmeasured ? 0 : scoreBetween(value as number, spec.poor, spec.target),
      unmeasured,
      poor: spec.poor,
      target: spec.target,
      format: spec.format,
    };
  });
  const dims = Object.keys(SCORECARD_WEIGHTS) as ScorecardDimension[];
  const dimensions = dims.map(dimension => {
    const ms = metrics.filter(m => m.dimension === dimension);
    const score = ms.length ? Math.round((ms.reduce((a, m) => a + m.score, 0) / ms.length) * 10) / 10 : 0;
    return { dimension, weight: SCORECARD_WEIGHTS[dimension], score };
  });
  const overall = Math.round(dimensions.reduce((a, d) => a + d.score * d.weight, 0) * 10) / 10;
  return { overall, dimensions, metrics };
}

function fmtValue(m: ScorecardMetricResult): string {
  if (m.value === null) return 'n/a';
  switch (m.format) {
    case 'pct': return `${Math.round(m.value * 1000) / 10}%`;
    case 'hours': return `${Math.round(m.value * 10) / 10} h`;
    case 'ratio': return `${Math.round(m.value * 100) / 100}`;
    default: return Math.round(m.value).toLocaleString('en-US');
  }
}

export function renderScorecardMarkdown(r: ScorecardResult): string {
  const lines = [`**Search & Evaluation scorecard: ${r.overall}/100**`, ''];
  for (const d of r.dimensions) {
    lines.push(`- ${d.dimension} (${Math.round(d.weight * 100)}%): ${d.score}`);
  }
  lines.push('', '| Metric | Value | Score |', '|---|---|---|');
  for (const m of r.metrics) {
    lines.push(`| ${m.label} | ${m.unmeasured ? `${fmtValue(m)} (unmeasured)` : fmtValue(m)} | ${m.score} |`);
  }
  return lines.join('\n');
}

export interface ScorecardRunResult extends ScorecardResult {
  run_id: string | null;
  stats: ScorecardStats;
}

/** Collect, score and (unless dry) persist one radar_qa_runs row of kind 'scorecard'. */
export async function runScorecard(supabase: SupabaseClient, opts: { persist: boolean; notes?: string }): Promise<ScorecardRunResult> {
  const { data, error } = await supabase.rpc('radar_qa_scorecard_stats');
  if (error) throw new Error(`radar_qa_scorecard_stats: ${error.message}`);
  const stats = (data ?? {}) as ScorecardStats;
  const result = computeScorecard(stats);
  let runId: string | null = null;
  if (opts.persist) {
    const { data: row, error: insErr } = await supabase
      .from('radar_qa_runs')
      .insert({
        kind: 'scorecard',
        universe_size: num(stats.universe_programs),
        summary: { overall: result.overall, dimensions: result.dimensions, metrics: result.metrics, stats },
        passed: result.overall >= 95,
        blocking_failures: result.metrics.filter(m => m.unmeasured).length,
        notes: opts.notes ?? null,
      })
      .select('id')
      .single();
    if (insErr) throw new Error(`radar_qa_runs insert (scorecard): ${insErr.message}`);
    runId = (row as { id: string } | null)?.id ?? null;
  }
  return { ...result, run_id: runId, stats };
}
