/**
 * Search & Evaluation QA — automated invariant checks over the whole universe.
 *
 * The heavy lifting is set-based inside Postgres (migration 119 RPCs:
 * radar_qa_universe_stats, radar_qa_vocab_violations, radar_qa_thesis_stats,
 * radar_qa_score_stats, radar_qa_pipeline_stats). This module:
 *
 *   1. collectQaStats(supabase)   — calls the RPCs, passes the vocabulary
 *                                   from lib/radar/vocab.ts (single source).
 *   2. evaluateInvariants(stats)  — PURE: turns the stats into one result per
 *                                   check with severity + threshold. Unit
 *                                   tested on fixture stats.
 *   3. runInvariants(supabase)    — 1 + 2, then writes radar_qa_runs
 *                                   (kind 'invariants') and radar_qa_findings.
 *
 * Severity contract (docs/asset-radar-qa.md):
 *   blocker  cannot launch
 *   major    must be listed in the launch notes
 *   minor    backlog
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  RADAR_MODALITY_OPTIONS,
  RADAR_PARTNERSHIP_OPTIONS,
  RADAR_PHASE_OPTIONS,
  RADAR_REGION_OPTIONS,
  RADAR_TA_OPTIONS,
} from '@/lib/radar/vocab';
import type { OwnerType } from '@/lib/radar/types';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type QaSeverity = 'blocker' | 'major' | 'minor';

export interface QaCheckResult {
  check_name: string;
  /** Severity the check carries when it fails. */
  severity: QaSeverity;
  passed: boolean;
  expected: string;
  observed: string;
  /** Number of offending rows when applicable. */
  count: number | null;
  /** Sample of offending ids (<= 20). */
  failing_ids: string[];
  details: Record<string, unknown>;
  /** Reporting group for the coverage table. */
  group: 'vocab' | 'identity' | 'coverage' | 'partnership' | 'thesis' | 'score' | 'freshness' | 'pipeline';
}

export interface VocabStat {
  violations: number;
  samples: { value: string; count: number }[];
}

export interface QaUniverseStats {
  total_assets: number;
  industry_assets: number;
  assets_with_trials: number;
  missing_company: { count: number; sample_ids: string[] };
  industry_phase_missing: { count: number; sample_ids: string[] };
  classification: { classified: number; skipped: number; needs_review: number; unclassified: number };
  target_p2plus: { classified: number; with_target: number };
  drug_resolution: { resolved: number };
  partnership: {
    checked: number;
    never_checked: number;
    partnered_without_evidence: { count: number; sample_ids: string[] };
  };
  territory: { violations: number; samples: { id: string; values: string[] }[] };
  freshness: { active_trial_assets: number; fresh_400d: number };
}

export interface QaThesisStats {
  eligible: number;
  with_thesis: number;
  theses: number;
  insufficient_with_predicted: { count: number; sample_ids: string[] };
  comp_count_below_verified: { count: number; sample_ids: string[] };
  terms_basis_inconsistent: { count: number; sample_ids: string[] };
  terms_basis_null: number;
  calculator_ratio: { n: number; median: number | null; p90: number | null };
}

export interface QaScoreStats {
  active_model_version: string | null;
  scored_industry: number;
  snapshot_checked: number;
  v2_rows: number;
  v3_rows: number;
  entries_bad: { count: number; sample_ids: string[] };
  sum_bad: { count: number; samples: { id: string; score: number; points_sum: number | null; model_version: string | null }[] };
  snapshot_model_version_missing: number;
  asset_model_version_missing: number;
  confidence_missing: number;
  distribution: {
    n: number;
    max: number | null;
    mean: number | null;
    p50: number | null;
    p90: number | null;
    count_ge_50: number;
    count_ge_30: number;
  };
}

export interface QaStageRun {
  source: string;
  stage: string;
  last_run_at: string;
  status: string;
  runs: number;
}

export interface QaPipelineStats {
  duplicates: { groups: number; sample: Record<string, unknown>[] };
  trial_orphans: { count: number };
  press_empty_mentions: { total_90d: number; empty: number };
  stages: QaStageRun[];
  cron_failures_7d: { source: string; stage: string; failed: number; last_failed_at: string; sample_error: string | null }[];
}

export interface QaStats {
  collected_at: string;
  universe: QaUniverseStats;
  vocab: Record<string, VocabStat>;
  thesis: QaThesisStats;
  score: QaScoreStats;
  pipeline: QaPipelineStats;
  /** RPCs that failed; each becomes a blocker finding (the gate cannot be evaluated). */
  errors: string[];
}

export interface InvariantsRunResult {
  run_id: string | null;
  passed: boolean;
  universe_size: number;
  blockers: number;
  majors: number;
  minors: number;
  checks: QaCheckResult[];
  stats: QaStats;
  errors: string[];
  duration_ms: number;
}

// ═══════════════════════════════════════════════════════════════════════
// THRESHOLDS (documented in docs/asset-radar-qa.md)
// ═══════════════════════════════════════════════════════════════════════

export const QA_THRESHOLDS = {
  /** Vocabulary violations above this share of the universe are a blocker; any violation is major. */
  vocab_blocker_share_pct: 1,
  industry_phase_missing_major_pct: 10,
  industry_phase_missing_blocker_pct: 25,
  classification_coverage_min_pct: 95,
  classification_coverage_blocker_pct: 80,
  target_p2plus_min_pct: 60,
  drug_resolution_min_pct: 55,
  partnership_checked_min_pct: 99,
  partnership_checked_blocker_pct: 90,
  partnered_without_evidence_blocker_count: 25,
  thesis_coverage_min_pct: 99,
  thesis_coverage_blocker_pct: 90,
  calculator_ratio_median_max: 1.0,
  score_entries_bad_major_pct: 1,
  score_entries_bad_blocker_pct: 10,
  score_sum_bad_major_pct: 1,
  score_sum_bad_blocker_pct: 10,
  score_min_factor_entries: 9,
  freshness_min_pct: 80,
  freshness_days: 400,
  duplicates_major_groups: 500,
  trial_orphans_major_count: 1000,
  press_empty_mentions_minor_pct: 50,
  stage_window_hours: 48,
  cron_failures_major_count: 5,
} as const;

/**
 * Radar cron stages that must have a completed/partial data_ingestion_log
 * row inside the 48-hour window. (source, parameters.stage) pairs as written
 * by each module via logRadarRun; stage '' = the module logs without one.
 * `critical` stages are blockers when missing; the rest are major.
 */
export const EXPECTED_RADAR_STAGES: { source: string; stage: string; label: string; critical: boolean }[] = [
  { source: 'asset_universe', stage: '', label: 'Universe indexer (lib/radar/asset-universe.ts)', critical: true },
  { source: 'asset_universe', stage: 'ctgov_sweep', label: 'CT.gov sponsor-agnostic sweep', critical: true },
  { source: 'asset_universe', stage: 'registry_sweep', label: 'Ex-US registry sweep', critical: false },
  { source: 'asset_universe', stage: 'drug_resolve', label: 'Drug master resolver', critical: false },
  { source: 'asset_universe', stage: 'partnership_refresh', label: 'Partnership refresh', critical: true },
  { source: 'asset_universe', stage: 'classify', label: 'Asset classification', critical: true },
  { source: 'licensing_signals', stage: '', label: 'Licensing intent scoring', critical: true },
  { source: 'licensing_signals', stage: 'catalysts', label: 'Catalyst detector', critical: false },
  { source: 'licensing_signals', stage: 'company_financials', label: 'Company financials (SEC XBRL)', critical: false },
  { source: 'licensing_signals', stage: 'management_intent', label: 'Management intent classifier', critical: false },
  { source: 'licensing_signals', stage: 'patents_assignee', label: 'PatentsView by assignee', critical: false },
  { source: 'licensing_signals', stage: 'score_backtest', label: 'Score backtest', critical: false },
  { source: 'deal_thesis', stage: '', label: 'Deal thesis generator', critical: true },
  { source: 'mandate_matcher', stage: '', label: 'Mandate matcher', critical: false },
  { source: 'mandate_matcher', stage: 'radar_digest', label: 'Mandate digest email', critical: false },
  { source: 'competitive_intel', stage: '', label: 'Competitive intel', critical: false },
  { source: 'deal_creator', stage: '', label: 'Deal creator', critical: false },
];

/** Territory slugs allowed in clinical_assets.territory_rights_available. */
export const TERRITORY_VOCAB = ['global', 'us', 'eu', 'japan', 'china', 'row'] as const;

/** Phase values the universe may carry (vocab + the two CT.gov placeholders). */
export const PHASE_VOCAB_WITH_PLACEHOLDERS = [...RADAR_PHASE_OPTIONS.map(o => o.value), 'not_applicable', 'unknown'];

const OWNER_TYPES: OwnerType[] = ['industry', 'academic', 'government', 'hospital', 'network', 'cro', 'other', 'unknown'];

/** Column → allowed values, all from lib/radar/vocab.ts. */
export const VOCAB_CHECKS: { table: 'clinical_assets' | 'companies'; column: string; allowed: string[] }[] = [
  { table: 'clinical_assets', column: 'therapeutic_area', allowed: RADAR_TA_OPTIONS.map(o => o.value) },
  { table: 'clinical_assets', column: 'modality', allowed: RADAR_MODALITY_OPTIONS.map(o => o.value) },
  { table: 'clinical_assets', column: 'phase', allowed: PHASE_VOCAB_WITH_PLACEHOLDERS },
  { table: 'clinical_assets', column: 'partnership_status', allowed: RADAR_PARTNERSHIP_OPTIONS.map(o => o.value) },
  { table: 'clinical_assets', column: 'originator_region', allowed: RADAR_REGION_OPTIONS.map(o => o.value) },
  { table: 'companies', column: 'owner_type', allowed: OWNER_TYPES },
];

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

export function pct(num: number, den: number): number {
  if (!den || den <= 0) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function n(v: unknown): number {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function nullableNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function ids(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).slice(0, 20) : [];
}

function result(partial: Omit<QaCheckResult, 'failing_ids' | 'details' | 'count'> & Partial<Pick<QaCheckResult, 'failing_ids' | 'details' | 'count'>>): QaCheckResult {
  return { count: null, failing_ids: [], details: {}, ...partial };
}

/** Normalise raw RPC JSON into the typed stats shape; every field defaults to 0 / [] so evaluators never see undefined. */
export function normalizeUniverseStats(raw: Record<string, unknown> | null | undefined): QaUniverseStats {
  const r = (raw ?? {}) as Record<string, Record<string, unknown>>;
  const obj = (k: string) => (r[k] ?? {}) as Record<string, unknown>;
  return {
    total_assets: n(r.total_assets),
    industry_assets: n(r.industry_assets),
    assets_with_trials: n(r.assets_with_trials),
    missing_company: { count: n(obj('missing_company').count), sample_ids: ids(obj('missing_company').sample_ids) },
    industry_phase_missing: { count: n(obj('industry_phase_missing').count), sample_ids: ids(obj('industry_phase_missing').sample_ids) },
    classification: {
      classified: n(obj('classification').classified),
      skipped: n(obj('classification').skipped),
      needs_review: n(obj('classification').needs_review),
      unclassified: n(obj('classification').unclassified),
    },
    target_p2plus: { classified: n(obj('target_p2plus').classified), with_target: n(obj('target_p2plus').with_target) },
    drug_resolution: { resolved: n(obj('drug_resolution').resolved) },
    partnership: {
      checked: n(obj('partnership').checked),
      never_checked: n(obj('partnership').never_checked),
      partnered_without_evidence: {
        count: n((obj('partnership').partnered_without_evidence as Record<string, unknown> | undefined)?.count),
        sample_ids: ids((obj('partnership').partnered_without_evidence as Record<string, unknown> | undefined)?.sample_ids),
      },
    },
    territory: {
      violations: n(obj('territory').violations),
      samples: Array.isArray(obj('territory').samples) ? (obj('territory').samples as { id: string; values: string[] }[]).slice(0, 20) : [],
    },
    freshness: { active_trial_assets: n(obj('freshness').active_trial_assets), fresh_400d: n(obj('freshness').fresh_400d) },
  };
}

export function normalizeThesisStats(raw: Record<string, unknown> | null | undefined): QaThesisStats {
  const r = (raw ?? {}) as Record<string, unknown>;
  const obj = (k: string) => (r[k] ?? {}) as Record<string, unknown>;
  return {
    eligible: n(r.eligible),
    with_thesis: n(r.with_thesis),
    theses: n(r.theses),
    insufficient_with_predicted: { count: n(obj('insufficient_with_predicted').count), sample_ids: ids(obj('insufficient_with_predicted').sample_ids) },
    comp_count_below_verified: { count: n(obj('comp_count_below_verified').count), sample_ids: ids(obj('comp_count_below_verified').sample_ids) },
    terms_basis_inconsistent: { count: n(obj('terms_basis_inconsistent').count), sample_ids: ids(obj('terms_basis_inconsistent').sample_ids) },
    terms_basis_null: n(r.terms_basis_null),
    calculator_ratio: {
      n: n(obj('calculator_ratio').n),
      median: nullableNum(obj('calculator_ratio').median),
      p90: nullableNum(obj('calculator_ratio').p90),
    },
  };
}

export function normalizeScoreStats(raw: Record<string, unknown> | null | undefined): QaScoreStats {
  const r = (raw ?? {}) as Record<string, unknown>;
  const obj = (k: string) => (r[k] ?? {}) as Record<string, unknown>;
  const dist = obj('distribution');
  return {
    active_model_version: typeof r.active_model_version === 'string' ? r.active_model_version : null,
    scored_industry: n(r.scored_industry),
    snapshot_checked: n(r.snapshot_checked),
    v2_rows: n(r.v2_rows),
    v3_rows: n(r.v3_rows),
    entries_bad: { count: n(obj('entries_bad').count), sample_ids: ids(obj('entries_bad').sample_ids) },
    sum_bad: {
      count: n(obj('sum_bad').count),
      samples: Array.isArray(obj('sum_bad').samples) ? (obj('sum_bad').samples as QaScoreStats['sum_bad']['samples']).slice(0, 20) : [],
    },
    snapshot_model_version_missing: n(r.snapshot_model_version_missing),
    asset_model_version_missing: n(r.asset_model_version_missing),
    confidence_missing: n(r.confidence_missing),
    distribution: {
      n: n(dist.n),
      max: nullableNum(dist.max),
      mean: nullableNum(dist.mean),
      p50: nullableNum(dist.p50),
      p90: nullableNum(dist.p90),
      count_ge_50: n(dist.count_ge_50),
      count_ge_30: n(dist.count_ge_30),
    },
  };
}

export function normalizePipelineStats(raw: Record<string, unknown> | null | undefined): QaPipelineStats {
  const r = (raw ?? {}) as Record<string, unknown>;
  const obj = (k: string) => (r[k] ?? {}) as Record<string, unknown>;
  return {
    duplicates: { groups: n(obj('duplicates').groups), sample: Array.isArray(obj('duplicates').sample) ? (obj('duplicates').sample as Record<string, unknown>[]) : [] },
    trial_orphans: { count: n(obj('trial_orphans').count) },
    press_empty_mentions: { total_90d: n(obj('press_empty_mentions').total_90d), empty: n(obj('press_empty_mentions').empty) },
    stages: Array.isArray(r.stages) ? (r.stages as QaStageRun[]).map(s => ({ ...s, stage: s.stage ?? '' })) : [],
    cron_failures_7d: Array.isArray(r.cron_failures_7d) ? (r.cron_failures_7d as QaPipelineStats['cron_failures_7d']) : [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// COLLECT (RPC calls)
// ═══════════════════════════════════════════════════════════════════════

export async function collectQaStats(supabase: SupabaseClient, opts: { now?: () => number } = {}): Promise<QaStats> {
  const now = opts.now ?? Date.now;
  const errors: string[] = [];

  const rpc = async <T,>(name: string, args: Record<string, unknown>): Promise<T | null> => {
    try {
      const { data, error } = await supabase.rpc(name, args);
      if (error) {
        errors.push(`${name}: ${error.message}`);
        return null;
      }
      return (data ?? null) as T | null;
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  };

  const [universeRaw, thesisRaw, scoreRaw, pipelineRaw] = await Promise.all([
    rpc<Record<string, unknown>>('radar_qa_universe_stats', {
      p_vocab: { phase: PHASE_VOCAB_WITH_PLACEHOLDERS, territories: [...TERRITORY_VOCAB] },
    }),
    rpc<Record<string, unknown>>('radar_qa_thesis_stats', {}),
    rpc<Record<string, unknown>>('radar_qa_score_stats', { p_days: 14 }),
    rpc<Record<string, unknown>>('radar_qa_pipeline_stats', {}),
  ]);

  const vocab: Record<string, VocabStat> = {};
  await Promise.all(
    VOCAB_CHECKS.map(async v => {
      const raw = await rpc<Record<string, unknown>>('radar_qa_vocab_violations', { p_table: v.table, p_column: v.column, p_allowed: v.allowed });
      if (raw) {
        vocab[`${v.table}.${v.column}`] = {
          violations: n(raw.violations),
          samples: Array.isArray(raw.samples) ? (raw.samples as { value: string; count: number }[]).slice(0, 20) : [],
        };
      }
    }),
  );

  return {
    collected_at: new Date(now()).toISOString(),
    universe: normalizeUniverseStats(universeRaw),
    vocab,
    thesis: normalizeThesisStats(thesisRaw),
    score: normalizeScoreStats(scoreRaw),
    pipeline: normalizePipelineStats(pipelineRaw),
    errors,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// EVALUATE (pure)
// ═══════════════════════════════════════════════════════════════════════

export interface EvaluateOptions {
  /** Override thresholds (tests). */
  thresholds?: Partial<typeof QA_THRESHOLDS>;
  /** Override the expected stage list (tests). */
  expectedStages?: typeof EXPECTED_RADAR_STAGES;
  /** Wall clock for the stage-freshness window. */
  now?: () => number;
}

export function evaluateInvariants(stats: QaStats, opts: EvaluateOptions = {}): QaCheckResult[] {
  const T = { ...QA_THRESHOLDS, ...(opts.thresholds ?? {}) };
  const stages = opts.expectedStages ?? EXPECTED_RADAR_STAGES;
  const now = opts.now ?? Date.now;
  const out: QaCheckResult[] = [];
  const u = stats.universe;

  // ── RPC failures: the gate cannot be evaluated ──────────────────────
  for (const e of stats.errors) {
    out.push(result({
      check_name: 'qa_stats_collection',
      severity: 'blocker',
      passed: false,
      expected: 'every radar_qa_* RPC returns (migration 119 applied)',
      observed: e,
      group: 'pipeline',
    }));
  }

  // ── Vocabulary compliance ───────────────────────────────────────────
  for (const [key, v] of Object.entries(stats.vocab)) {
    const share = pct(v.violations, u.total_assets);
    out.push(result({
      check_name: `vocab_${key.replace('.', '_')}`,
      severity: share > T.vocab_blocker_share_pct ? 'blocker' : 'major',
      passed: v.violations === 0,
      expected: `every non-null ${key} value in lib/radar/vocab.ts`,
      observed: `${v.violations} violations (${fmtPct(share)})${v.samples.length ? `: ${v.samples.slice(0, 5).map(s => `${s.value}×${s.count}`).join(', ')}` : ''}`,
      count: v.violations,
      details: { samples: v.samples },
      group: 'vocab',
    }));
  }

  // ── Identity ────────────────────────────────────────────────────────
  out.push(result({
    check_name: 'asset_has_company',
    severity: 'blocker',
    passed: u.missing_company.count === 0,
    expected: 'no asset without company_id AND company_name',
    observed: `${u.missing_company.count} assets`,
    count: u.missing_company.count,
    failing_ids: u.missing_company.sample_ids,
    group: 'identity',
  }));

  const phaseMissingPct = pct(u.industry_phase_missing.count, u.industry_assets);
  out.push(result({
    check_name: 'industry_phase_known',
    severity: phaseMissingPct > T.industry_phase_missing_blocker_pct ? 'blocker' : 'major',
    passed: phaseMissingPct <= T.industry_phase_missing_major_pct,
    expected: `≤ ${T.industry_phase_missing_major_pct}% of industry assets with NULL / not_applicable / unknown phase`,
    observed: `${u.industry_phase_missing.count} of ${u.industry_assets} (${fmtPct(phaseMissingPct)})`,
    count: u.industry_phase_missing.count,
    failing_ids: u.industry_phase_missing.sample_ids,
    details: { share_pct: phaseMissingPct },
    group: 'identity',
  }));

  // ── Coverage ────────────────────────────────────────────────────────
  const clsCovered = u.classification.classified + u.classification.skipped;
  const clsPct = pct(clsCovered, u.industry_assets);
  out.push(result({
    check_name: 'classification_coverage',
    severity: clsPct < T.classification_coverage_blocker_pct ? 'blocker' : 'major',
    passed: clsPct >= T.classification_coverage_min_pct,
    expected: `classified + skipped ≥ ${T.classification_coverage_min_pct}% of industry assets`,
    observed: `${clsCovered} of ${u.industry_assets} (${fmtPct(clsPct)}); needs_review ${u.classification.needs_review}, unclassified ${u.classification.unclassified}`,
    count: u.classification.unclassified + u.classification.needs_review,
    details: { ...u.classification, coverage_pct: clsPct },
    group: 'coverage',
  }));

  const targetPct = pct(u.target_p2plus.with_target, u.target_p2plus.classified);
  out.push(result({
    check_name: 'target_coverage_phase2plus',
    severity: 'major',
    passed: targetPct >= T.target_p2plus_min_pct,
    expected: `target present on ≥ ${T.target_p2plus_min_pct}% of classified industry Phase 2+ assets`,
    observed: `${u.target_p2plus.with_target} of ${u.target_p2plus.classified} (${fmtPct(targetPct)})`,
    count: u.target_p2plus.classified - u.target_p2plus.with_target,
    details: { share_pct: targetPct },
    group: 'coverage',
  }));

  const drugPct = pct(u.drug_resolution.resolved, u.industry_assets);
  out.push(result({
    check_name: 'drug_resolution_coverage',
    severity: 'major',
    passed: drugPct >= T.drug_resolution_min_pct,
    expected: `drug_resolution_status = resolved on ≥ ${T.drug_resolution_min_pct}% of industry assets`,
    observed: `${u.drug_resolution.resolved} of ${u.industry_assets} (${fmtPct(drugPct)})`,
    count: u.industry_assets - u.drug_resolution.resolved,
    details: { share_pct: drugPct },
    group: 'coverage',
  }));

  // ── Partnership ─────────────────────────────────────────────────────
  const checkedPct = pct(u.partnership.checked, u.total_assets);
  out.push(result({
    check_name: 'partnership_checked_coverage',
    severity: checkedPct < T.partnership_checked_blocker_pct ? 'blocker' : 'major',
    passed: checkedPct >= T.partnership_checked_min_pct,
    expected: `partnership_checked_at set on ≥ ${T.partnership_checked_min_pct}% of assets`,
    observed: `${u.partnership.checked} of ${u.total_assets} (${fmtPct(checkedPct)}); never checked ${u.partnership.never_checked}`,
    count: u.partnership.never_checked,
    details: { share_pct: checkedPct },
    group: 'partnership',
  }));

  const pwe = u.partnership.partnered_without_evidence;
  out.push(result({
    check_name: 'partnered_has_hard_evidence',
    severity: pwe.count > T.partnered_without_evidence_blocker_count ? 'blocker' : 'major',
    passed: pwe.count === 0,
    expected: "every 'partnered' asset carries a deal or press_release evidence entry",
    observed: `${pwe.count} partnered assets without deal/press evidence`,
    count: pwe.count,
    failing_ids: pwe.sample_ids,
    group: 'partnership',
  }));

  out.push(result({
    check_name: 'territory_vocab',
    severity: 'major',
    passed: u.territory.violations === 0,
    expected: `territory_rights_available ⊆ {${TERRITORY_VOCAB.join(', ')}}`,
    observed: `${u.territory.violations} assets with out-of-vocabulary territories`,
    count: u.territory.violations,
    failing_ids: u.territory.samples.map(s => s.id),
    details: { samples: u.territory.samples },
    group: 'partnership',
  }));

  // ── Deal theses (honesty contract) ──────────────────────────────────
  const th = stats.thesis;
  const thesisPct = pct(th.with_thesis, th.eligible);
  out.push(result({
    check_name: 'thesis_coverage',
    severity: thesisPct < T.thesis_coverage_blocker_pct ? 'blocker' : 'major',
    passed: thesisPct >= T.thesis_coverage_min_pct,
    expected: `every radar_thesis_eligible_assets row has a radar_deal_theses row (≥ ${T.thesis_coverage_min_pct}%)`,
    observed: `${th.with_thesis} of ${th.eligible} (${fmtPct(thesisPct)})`,
    count: th.eligible - th.with_thesis,
    details: { coverage_pct: thesisPct },
    group: 'thesis',
  }));

  out.push(result({
    check_name: 'thesis_insufficient_has_no_terms',
    severity: 'blocker',
    passed: th.insufficient_with_predicted.count === 0,
    expected: 'predicted_* NULL whenever insufficient_comps',
    observed: `${th.insufficient_with_predicted.count} theses show numbers below the comp floor`,
    count: th.insufficient_with_predicted.count,
    failing_ids: th.insufficient_with_predicted.sample_ids,
    group: 'thesis',
  }));

  out.push(result({
    check_name: 'thesis_comp_count_ge_verified',
    severity: 'blocker',
    passed: th.comp_count_below_verified.count === 0,
    expected: 'comp_count ≥ verified_comp_count',
    observed: `${th.comp_count_below_verified.count} theses`,
    count: th.comp_count_below_verified.count,
    failing_ids: th.comp_count_below_verified.sample_ids,
    group: 'thesis',
  }));

  out.push(result({
    check_name: 'thesis_terms_basis_consistent',
    severity: 'major',
    passed: th.terms_basis_inconsistent.count === 0,
    expected: 'terms_basis = f(comp_relaxation, insufficient_comps) per termsBasisFor()',
    observed: `${th.terms_basis_inconsistent.count} inconsistent; ${th.terms_basis_null} NULL (pre-116 rows)`,
    count: th.terms_basis_inconsistent.count,
    failing_ids: th.terms_basis_inconsistent.sample_ids,
    details: { terms_basis_null: th.terms_basis_null },
    group: 'thesis',
  }));

  const ratio = th.calculator_ratio;
  out.push(result({
    check_name: 'thesis_calculator_vs_comps',
    severity: 'major',
    passed: ratio.median === null || ratio.median <= T.calculator_ratio_median_max,
    expected: `median |calculator_upfront_mid − predicted_upfront_mid| / predicted_upfront_mid ≤ ${T.calculator_ratio_median_max} on phase_matched theses`,
    observed: ratio.n > 0
      ? `n=${ratio.n}, median ${ratio.median?.toFixed(2)}, p90 ${ratio.p90?.toFixed(2)}`
      : 'no phase_matched theses with both values',
    count: null,
    details: { n: ratio.n, median: ratio.median, p90: ratio.p90 },
    group: 'thesis',
  }));

  // ── Score contract ──────────────────────────────────────────────────
  const sc = stats.score;
  const entriesBadPct = pct(sc.entries_bad.count, sc.snapshot_checked);
  out.push(result({
    check_name: 'score_factor_entries',
    severity: entriesBadPct > T.score_entries_bad_blocker_pct ? 'blocker' : 'major',
    passed: sc.snapshot_checked > 0 && entriesBadPct <= T.score_entries_bad_major_pct,
    expected: `asset_signal_snapshots.factor_scores is an array with ≥ ${T.score_min_factor_entries} entries for every scored industry asset`,
    observed: sc.snapshot_checked > 0
      ? `${sc.entries_bad.count} of ${sc.snapshot_checked} latest snapshots (${fmtPct(entriesBadPct)}) malformed`
      : `no snapshots in the last 14 days for ${sc.scored_industry} scored industry assets`,
    count: sc.entries_bad.count,
    failing_ids: sc.entries_bad.sample_ids,
    details: { snapshot_checked: sc.snapshot_checked, scored_industry: sc.scored_industry },
    group: 'score',
  }));

  const sumBadPct = pct(sc.sum_bad.count, sc.snapshot_checked);
  out.push(result({
    check_name: 'score_decomposition_sums',
    severity: sumBadPct > T.score_sum_bad_blocker_pct ? 'blocker' : 'major',
    passed: sumBadPct <= T.score_sum_bad_major_pct,
    expected: 'v2: |Σ points − score| ≤ 0.5; v3: intercept row present and Σ points a finite logit (|Σ| ≤ 20)',
    observed: `${sc.sum_bad.count} of ${sc.snapshot_checked} (${fmtPct(sumBadPct)}); v2 rows ${sc.v2_rows}, v3 rows ${sc.v3_rows}`,
    count: sc.sum_bad.count,
    failing_ids: sc.sum_bad.samples.map(s => s.id),
    details: { samples: sc.sum_bad.samples },
    group: 'score',
  }));

  out.push(result({
    check_name: 'score_confidence_present',
    severity: 'major',
    passed: sc.confidence_missing === 0,
    expected: 'score_confidence non-null on every scored industry asset',
    observed: `${sc.confidence_missing} missing of ${sc.scored_industry}`,
    count: sc.confidence_missing,
    group: 'score',
  }));

  if (sc.active_model_version) {
    out.push(result({
      check_name: 'score_model_version_present',
      severity: 'major',
      passed: sc.snapshot_model_version_missing === 0 && sc.asset_model_version_missing === 0,
      expected: `model_version stamped on snapshots and assets while model ${sc.active_model_version} is active`,
      observed: `snapshots missing ${sc.snapshot_model_version_missing}, assets missing ${sc.asset_model_version_missing}`,
      count: sc.snapshot_model_version_missing + sc.asset_model_version_missing,
      details: { active_model_version: sc.active_model_version },
      group: 'score',
    }));
  }

  const d = sc.distribution;
  const ge50Pct = pct(d.count_ge_50, d.n);
  out.push(result({
    check_name: 'score_discriminates',
    severity: 'blocker',
    passed: d.n > 0 && d.count_ge_30 > 0,
    expected: 'at least one scored industry asset ≥ 30 (score does not discriminate otherwise)',
    observed: d.n > 0
      ? `n=${d.n}, max ${d.max}, mean ${d.mean?.toFixed(1)}, p50 ${d.p50}, p90 ${d.p90}; ≥30: ${d.count_ge_30}; ≥50: ${d.count_ge_50} (${fmtPct(ge50Pct)})`
      : 'no scored industry assets',
    count: null,
    details: { ...d, share_ge_50_pct: ge50Pct },
    group: 'score',
  }));

  // ── Freshness ───────────────────────────────────────────────────────
  const freshPct = pct(u.freshness.fresh_400d, u.freshness.active_trial_assets);
  out.push(result({
    check_name: 'active_trial_freshness',
    severity: 'major',
    passed: freshPct >= T.freshness_min_pct,
    expected: `last_update_date within ${T.freshness_days} days for ≥ ${T.freshness_min_pct}% of active-trial assets`,
    observed: `${u.freshness.fresh_400d} of ${u.freshness.active_trial_assets} (${fmtPct(freshPct)})`,
    count: u.freshness.active_trial_assets - u.freshness.fresh_400d,
    details: { share_pct: freshPct },
    group: 'freshness',
  }));

  // ── Pipeline ────────────────────────────────────────────────────────
  const p = stats.pipeline;
  out.push(result({
    check_name: 'drug_master_cross_company_duplicates',
    severity: p.duplicates.groups > T.duplicates_major_groups || p.duplicates.groups < 0 ? 'major' : 'minor',
    passed: p.duplicates.groups === 0,
    expected: 'no drug_master node held by ≥ 2 industry companies (radar_drug_duplicates)',
    observed: p.duplicates.groups < 0 ? 'radar_drug_duplicates RPC unavailable' : `${p.duplicates.groups} groups`,
    count: Math.max(0, p.duplicates.groups),
    details: { sample: p.duplicates.sample },
    group: 'pipeline',
  }));

  out.push(result({
    check_name: 'company_trials_orphans',
    severity: p.trial_orphans.count > T.trial_orphans_major_count ? 'major' : 'minor',
    passed: p.trial_orphans.count === 0,
    expected: 'every company_trials row references an existing company',
    observed: `${p.trial_orphans.count} orphan rows`,
    count: p.trial_orphans.count,
    group: 'pipeline',
  }));

  const pressPct = pct(p.press_empty_mentions.empty, p.press_empty_mentions.total_90d);
  out.push(result({
    check_name: 'press_releases_company_resolution',
    severity: 'minor',
    passed: p.press_empty_mentions.total_90d === 0 || pressPct <= T.press_empty_mentions_minor_pct,
    expected: `≤ ${T.press_empty_mentions_minor_pct}% of press_releases (90 d) with empty companies_mentioned`,
    observed: `${p.press_empty_mentions.empty} of ${p.press_empty_mentions.total_90d} (${fmtPct(pressPct)})`,
    count: p.press_empty_mentions.empty,
    details: { share_pct: pressPct },
    group: 'pipeline',
  }));

  const windowStart = now() - T.stage_window_hours * 3600 * 1000;
  const seen = new Map<string, QaStageRun>();
  for (const s of p.stages) seen.set(`${s.source}|${s.stage ?? ''}`, s);
  const missing = stages.filter(s => {
    const run = seen.get(`${s.source}|${s.stage}`);
    return !run || Date.parse(run.last_run_at) < windowStart;
  });
  const missingCritical = missing.filter(m => m.critical);
  out.push(result({
    check_name: 'radar_stages_ran_48h',
    severity: missingCritical.length > 0 ? 'blocker' : 'major',
    passed: missing.length === 0,
    expected: `every Radar stage has a completed/partial run in the last ${T.stage_window_hours} h`,
    observed: missing.length === 0
      ? `${stages.length} stages fresh`
      : `missing: ${missing.map(m => `${m.source}${m.stage ? `/${m.stage}` : ''}`).join(', ')}`,
    count: missing.length,
    details: { missing: missing.map(m => ({ source: m.source, stage: m.stage, label: m.label, critical: m.critical })), seen: p.stages },
    group: 'pipeline',
  }));

  const worstFailure = p.cron_failures_7d.reduce((m, f) => Math.max(m, n(f.failed)), 0);
  const totalFailures = p.cron_failures_7d.reduce((m, f) => m + n(f.failed), 0);
  out.push(result({
    check_name: 'radar_cron_failures_7d',
    severity: worstFailure >= T.cron_failures_major_count ? 'major' : 'minor',
    passed: totalFailures === 0,
    expected: 'no failed Radar cron runs in the last 7 days',
    observed: totalFailures === 0
      ? 'none'
      : p.cron_failures_7d.map(f => `${f.source}${f.stage ? `/${f.stage}` : ''}×${f.failed}`).join(', '),
    count: totalFailures,
    details: { failures: p.cron_failures_7d },
    group: 'pipeline',
  }));

  return out;
}

export function summarizeChecks(checks: QaCheckResult[]): { passed: boolean; blockers: number; majors: number; minors: number } {
  const failed = checks.filter(c => !c.passed);
  const blockers = failed.filter(c => c.severity === 'blocker').length;
  const majors = failed.filter(c => c.severity === 'major').length;
  const minors = failed.filter(c => c.severity === 'minor').length;
  return { passed: blockers === 0, blockers, majors, minors };
}

// ═══════════════════════════════════════════════════════════════════════
// RUN (collect + evaluate + persist)
// ═══════════════════════════════════════════════════════════════════════

export interface RunInvariantsOptions extends EvaluateOptions {
  /** Skip the radar_qa_runs / radar_qa_findings write (dry run). */
  persist?: boolean;
  notes?: string;
}

export async function runInvariants(supabase: SupabaseClient, opts: RunInvariantsOptions = {}): Promise<InvariantsRunResult> {
  const now = opts.now ?? Date.now;
  const started = now();
  const stats = await collectQaStats(supabase, { now });
  const checks = evaluateInvariants(stats, opts);
  const summary = summarizeChecks(checks);
  const errors = [...stats.errors];
  let runId: string | null = null;

  if (opts.persist !== false) {
    const { data, error } = await supabase
      .from('radar_qa_runs')
      .insert({
        kind: 'invariants',
        run_at: new Date(now()).toISOString(),
        universe_size: stats.universe.total_assets,
        summary: {
          ...summary,
          checks: checks.map(c => ({ ...c, details: undefined })),
          stats,
        },
        passed: summary.passed,
        blocking_failures: summary.blockers,
        notes: opts.notes ?? null,
      })
      .select('id')
      .single();
    if (error) errors.push(`radar_qa_runs insert failed: ${error.message}`);
    else runId = data?.id ?? null;

    if (runId) {
      const findings = checks
        .filter(c => !c.passed)
        .map(c => ({
          run_id: runId,
          asset_id: null,
          check_name: c.check_name,
          severity: c.severity,
          expected: c.expected,
          observed: c.observed,
          details: { count: c.count, failing_ids: c.failing_ids, group: c.group, ...c.details },
        }));
      if (findings.length > 0) {
        const { error: fErr } = await supabase.from('radar_qa_findings').insert(findings);
        if (fErr) errors.push(`radar_qa_findings insert failed: ${fErr.message}`);
      }
    }
  }

  return {
    run_id: runId,
    passed: summary.passed,
    universe_size: stats.universe.total_assets,
    blockers: summary.blockers,
    majors: summary.majors,
    minors: summary.minors,
    checks,
    stats,
    errors,
    duration_ms: now() - started,
  };
}
