/**
 * Unit tests for the Asset Radar QA harness (lib/radar/qa/*).
 * No network: Supabase and the Anthropic SDK are stubbed.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  EXPECTED_RADAR_STAGES,
  QA_THRESHOLDS,
  evaluateInvariants,
  normalizePipelineStats,
  normalizeScoreStats,
  normalizeThesisStats,
  normalizeUniverseStats,
  runInvariants,
  summarizeChecks,
  type QaStats,
} from '@/lib/radar/qa/invariants';
import {
  AGREEMENT_GATE,
  agreementPassed,
  buildHumanReviewRows,
  buildPartnershipRequestParams,
  cohensKappa,
  fieldAgrees,
  goldenHash,
  goldenQuotas,
  normalizeHumanReviewRows,
  partnershipBatchWithModel,
  selectGoldenSample,
  summarizeHumanReviews,
  textSimilar,
  topFactors,
  type GoldenCandidate,
} from '@/lib/radar/qa/golden-set';
import { RequestBudget, type ClassifierClient } from '@/lib/radar/classify';
import { agreementRowsFromFields, coverageRowsFromStats, renderQaReportMarkdown, buildQaReport, type QaReport } from '@/lib/radar/qa/report';

// ═══════════════════════════════════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════════════════════════════════

const NOW_ISO = '2026-09-17T06:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const now = () => NOW_MS;

/** Every check passes on this fixture. */
function healthyStats(overrides: Partial<QaStats> = {}): QaStats {
  const stages = EXPECTED_RADAR_STAGES.map(s => ({ source: s.source, stage: s.stage, last_run_at: new Date(NOW_MS - 3600_000).toISOString(), status: 'completed', runs: 3 }));
  return {
    collected_at: NOW_ISO,
    universe: normalizeUniverseStats({
      total_assets: 10000, industry_assets: 6000, assets_with_trials: 9800,
      missing_company: { count: 0, sample_ids: [] },
      industry_phase_missing: { count: 300, sample_ids: [] },
      classification: { classified: 5500, skipped: 300, needs_review: 100, unclassified: 100 },
      target_p2plus: { classified: 2000, with_target: 1500 },
      drug_resolution: { resolved: 4000 },
      partnership: { checked: 9990, never_checked: 10, partnered_without_evidence: { count: 0, sample_ids: [] } },
      territory: { violations: 0, samples: [] },
      freshness: { active_trial_assets: 5000, fresh_400d: 4500 },
    }),
    vocab: {
      'clinical_assets.therapeutic_area': { violations: 0, samples: [] },
      'clinical_assets.modality': { violations: 0, samples: [] },
    },
    thesis: normalizeThesisStats({
      eligible: 3000, with_thesis: 2990, theses: 3100,
      insufficient_with_predicted: { count: 0, sample_ids: [] },
      comp_count_below_verified: { count: 0, sample_ids: [] },
      terms_basis_inconsistent: { count: 0, sample_ids: [] },
      terms_basis_null: 5,
      calculator_ratio: { n: 800, median: 0.4, p90: 1.2 },
    }),
    score: normalizeScoreStats({
      active_model_version: 'v3.1', scored_industry: 5800, snapshot_checked: 5700, v2_rows: 0, v3_rows: 5700,
      entries_bad: { count: 10, sample_ids: ['s1'] }, sum_bad: { count: 5, samples: [] },
      snapshot_model_version_missing: 0, asset_model_version_missing: 0, confidence_missing: 0,
      distribution: { n: 5800, max: 92, mean: 21.4, p50: 18, p90: 55, count_ge_50: 700, count_ge_30: 2000 },
    }),
    pipeline: normalizePipelineStats({
      duplicates: { groups: 0, sample: [] },
      trial_orphans: { count: 0 },
      press_empty_mentions: { total_90d: 400, empty: 40 },
      stages,
      cron_failures_7d: [],
    }),
    errors: [],
    ...overrides,
  };
}

function check(stats: QaStats, name: string) {
  const c = evaluateInvariants(stats, { now }).find(r => r.check_name === name);
  if (!c) throw new Error(`check ${name} not produced`);
  return c;
}

// ═══════════════════════════════════════════════════════════════════════
// INVARIANT EVALUATORS
// ═══════════════════════════════════════════════════════════════════════

describe('evaluateInvariants: thresholds and severity', () => {
  it('healthy fixture passes with zero failures', () => {
    const checks = evaluateInvariants(healthyStats(), { now });
    const failed = checks.filter(c => !c.passed);
    expect(failed.map(c => c.check_name)).toEqual([]);
    expect(summarizeChecks(checks)).toEqual({ passed: true, blockers: 0, majors: 0, minors: 0 });
    expect(checks.length).toBeGreaterThanOrEqual(24);
  });

  it('RPC errors become blockers (gate cannot be evaluated)', () => {
    const c = check(healthyStats({ errors: ['radar_qa_thesis_stats: relation does not exist'] }), 'qa_stats_collection');
    expect(c.passed).toBe(false);
    expect(c.severity).toBe('blocker');
  });

  it('vocab violations: any → major, > 1% of universe → blocker', () => {
    const s = healthyStats();
    s.vocab['clinical_assets.modality'] = { violations: 3, samples: [{ value: 'monoclonal_antibody', count: 3 }] };
    let c = check(s, 'vocab_clinical_assets_modality');
    expect(c.passed).toBe(false);
    expect(c.severity).toBe('major');
    expect(c.observed).toContain('monoclonal_antibody×3');
    s.vocab['clinical_assets.modality'] = { violations: 200, samples: [] };
    c = check(s, 'vocab_clinical_assets_modality');
    expect(c.severity).toBe('blocker');
  });

  it('missing company is a blocker with sample ids', () => {
    const s = healthyStats();
    s.universe.missing_company = { count: 2, sample_ids: ['a', 'b'] };
    const c = check(s, 'asset_has_company');
    expect(c.passed).toBe(false);
    expect(c.severity).toBe('blocker');
    expect(c.failing_ids).toEqual(['a', 'b']);
  });

  it('industry phase missing: > 10% major, > 25% blocker', () => {
    const s = healthyStats();
    s.universe.industry_phase_missing.count = 900; // 15%
    expect(check(s, 'industry_phase_known')).toMatchObject({ passed: false, severity: 'major' });
    s.universe.industry_phase_missing.count = 2000; // 33%
    expect(check(s, 'industry_phase_known')).toMatchObject({ passed: false, severity: 'blocker' });
  });

  it('classification coverage counts classified + skipped against industry assets', () => {
    const s = healthyStats();
    s.universe.classification = { classified: 5000, skipped: 300, needs_review: 400, unclassified: 300 }; // 88.3%
    const c = check(s, 'classification_coverage');
    expect(c.passed).toBe(false);
    expect(c.severity).toBe('major');
    expect(c.details.coverage_pct).toBe(88.3);
    s.universe.classification = { classified: 4000, skipped: 0, needs_review: 1000, unclassified: 1000 }; // 66.7%
    expect(check(s, 'classification_coverage').severity).toBe('blocker');
  });

  it('target / drug resolution / freshness are majors at their thresholds', () => {
    const s = healthyStats();
    s.universe.target_p2plus = { classified: 2000, with_target: 1100 }; // 55% < 60
    s.universe.drug_resolution.resolved = 3000; // 50% < 55
    s.universe.freshness = { active_trial_assets: 5000, fresh_400d: 3900 }; // 78% < 80
    expect(check(s, 'target_coverage_phase2plus')).toMatchObject({ passed: false, severity: 'major' });
    expect(check(s, 'drug_resolution_coverage')).toMatchObject({ passed: false, severity: 'major' });
    expect(check(s, 'active_trial_freshness')).toMatchObject({ passed: false, severity: 'major' });
    s.universe.target_p2plus.with_target = 1200; // exactly 60
    expect(check(s, 'target_coverage_phase2plus').passed).toBe(true);
  });

  it('partnership: checked coverage < 99 major, < 90 blocker; partnered without evidence escalates at 25', () => {
    const s = healthyStats();
    s.universe.partnership.checked = 9800; s.universe.partnership.never_checked = 200;
    expect(check(s, 'partnership_checked_coverage')).toMatchObject({ passed: false, severity: 'major' });
    s.universe.partnership.checked = 8000; s.universe.partnership.never_checked = 2000;
    expect(check(s, 'partnership_checked_coverage').severity).toBe('blocker');
    s.universe.partnership.partnered_without_evidence = { count: 3, sample_ids: ['x'] };
    expect(check(s, 'partnered_has_hard_evidence')).toMatchObject({ passed: false, severity: 'major', failing_ids: ['x'] });
    s.universe.partnership.partnered_without_evidence = { count: 26, sample_ids: [] };
    expect(check(s, 'partnered_has_hard_evidence').severity).toBe('blocker');
  });

  it('territory vocabulary violations are major with samples', () => {
    const s = healthyStats();
    s.universe.territory = { violations: 1, samples: [{ id: 't1', values: ['usa'] }] };
    const c = check(s, 'territory_vocab');
    expect(c).toMatchObject({ passed: false, severity: 'major', failing_ids: ['t1'] });
  });

  it('thesis honesty contract: insufficient-with-terms and comp_count < verified are blockers', () => {
    const s = healthyStats();
    s.thesis.insufficient_with_predicted = { count: 1, sample_ids: ['th1'] };
    s.thesis.comp_count_below_verified = { count: 2, sample_ids: ['th2'] };
    s.thesis.terms_basis_inconsistent = { count: 4, sample_ids: [] };
    expect(check(s, 'thesis_insufficient_has_no_terms')).toMatchObject({ passed: false, severity: 'blocker', failing_ids: ['th1'] });
    expect(check(s, 'thesis_comp_count_ge_verified')).toMatchObject({ passed: false, severity: 'blocker' });
    expect(check(s, 'thesis_terms_basis_consistent')).toMatchObject({ passed: false, severity: 'major' });
  });

  it('thesis coverage and calculator ratio', () => {
    const s = healthyStats();
    s.thesis.with_thesis = 2900; // 96.7% < 99
    expect(check(s, 'thesis_coverage')).toMatchObject({ passed: false, severity: 'major' });
    s.thesis.with_thesis = 2500; // 83% < 90
    expect(check(s, 'thesis_coverage').severity).toBe('blocker');
    s.thesis.calculator_ratio = { n: 100, median: 1.4, p90: 3 };
    expect(check(s, 'thesis_calculator_vs_comps')).toMatchObject({ passed: false, severity: 'major' });
    s.thesis.calculator_ratio = { n: 0, median: null, p90: null };
    expect(check(s, 'thesis_calculator_vs_comps').passed).toBe(true);
  });

  it('score contract: entries / sums escalate by share; distribution blocker when nothing ≥ 30', () => {
    const s = healthyStats();
    s.score.entries_bad.count = 120; // 2.1% of 5700
    expect(check(s, 'score_factor_entries')).toMatchObject({ passed: false, severity: 'major' });
    s.score.entries_bad.count = 700; // 12%
    expect(check(s, 'score_factor_entries').severity).toBe('blocker');
    s.score.sum_bad = { count: 100, samples: [{ id: 'z', score: 40, points_sum: 12, model_version: 'v2-composite' }] };
    expect(check(s, 'score_decomposition_sums')).toMatchObject({ passed: false, severity: 'major', failing_ids: ['z'] });
    s.score.confidence_missing = 5;
    expect(check(s, 'score_confidence_present')).toMatchObject({ passed: false, severity: 'major' });
    s.score.snapshot_model_version_missing = 3;
    expect(check(s, 'score_model_version_present')).toMatchObject({ passed: false, severity: 'major' });
    s.score.distribution.count_ge_30 = 0;
    const d = check(s, 'score_discriminates');
    expect(d).toMatchObject({ passed: false, severity: 'blocker' });
    expect(d.details.share_ge_50_pct).toBe(12.1);
  });

  it('model_version check is skipped when no v3 model is active', () => {
    const s = healthyStats();
    s.score.active_model_version = null;
    s.score.snapshot_model_version_missing = 100;
    expect(evaluateInvariants(s, { now }).find(c => c.check_name === 'score_model_version_present')).toBeUndefined();
  });

  it('pipeline: duplicates / orphans minor then major; press resolution minor', () => {
    const s = healthyStats();
    s.pipeline.duplicates.groups = 12;
    s.pipeline.trial_orphans.count = 3;
    s.pipeline.press_empty_mentions = { total_90d: 100, empty: 60 };
    expect(check(s, 'drug_master_cross_company_duplicates')).toMatchObject({ passed: false, severity: 'minor' });
    expect(check(s, 'company_trials_orphans')).toMatchObject({ passed: false, severity: 'minor' });
    expect(check(s, 'press_releases_company_resolution')).toMatchObject({ passed: false, severity: 'minor' });
    s.pipeline.duplicates.groups = 600;
    s.pipeline.trial_orphans.count = 5000;
    expect(check(s, 'drug_master_cross_company_duplicates').severity).toBe('major');
    expect(check(s, 'company_trials_orphans').severity).toBe('major');
  });

  it('stage freshness: stale critical stage is a blocker, stale non-critical is major', () => {
    const s = healthyStats();
    const stale = new Date(NOW_MS - 3 * 24 * 3600_000).toISOString();
    s.pipeline.stages = s.pipeline.stages.map(st => (st.source === 'mandate_matcher' && st.stage === '' ? { ...st, last_run_at: stale } : st));
    let c = check(s, 'radar_stages_ran_48h');
    expect(c).toMatchObject({ passed: false, severity: 'major', count: 1 });
    expect(c.observed).toContain('mandate_matcher');
    s.pipeline.stages = s.pipeline.stages.filter(st => !(st.source === 'licensing_signals' && st.stage === ''));
    c = check(s, 'radar_stages_ran_48h');
    expect(c.severity).toBe('blocker');
    expect(c.count).toBe(2);
  });

  it('cron failures: minor, major at 5+ for one stage', () => {
    const s = healthyStats();
    s.pipeline.cron_failures_7d = [{ source: 'deal_thesis', stage: '', failed: 2, last_failed_at: NOW_ISO, sample_error: null }];
    expect(check(s, 'radar_cron_failures_7d')).toMatchObject({ passed: false, severity: 'minor', count: 2 });
    s.pipeline.cron_failures_7d[0].failed = QA_THRESHOLDS.cron_failures_major_count;
    expect(check(s, 'radar_cron_failures_7d').severity).toBe('major');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SUPABASE STUB
// ═══════════════════════════════════════════════════════════════════════

interface Call { method: string; args: unknown[] }
interface Op { table: string; calls: Call[] }
type Handler = (table: string, calls: Call[]) => { data?: unknown; error?: { message: string } | null; count?: number | null };

function stubSupabase(handler: Handler, rpcHandler?: (name: string, args: Record<string, unknown>) => { data?: unknown; error?: { message: string } | null }) {
  const ops: Op[] = [];
  const rpcs: { name: string; args: Record<string, unknown> }[] = [];
  const methods = ['select', 'eq', 'neq', 'is', 'lt', 'gt', 'gte', 'in', 'not', 'order', 'limit', 'range', 'upsert', 'insert', 'update', 'delete', 'maybeSingle', 'single', 'overlaps'];
  const from = (table: string) => {
    const calls: Call[] = [];
    ops.push({ table, calls });
    const builder: Record<string, unknown> = {};
    for (const m of methods) builder[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return builder; };
    builder.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      let out: unknown;
      try { out = { data: null, error: null, count: null, ...handler(table, calls) }; } catch (err) { return Promise.reject(err).then(resolve, reject); }
      return Promise.resolve(out).then(resolve, reject);
    };
    return builder;
  };
  const rpc = async (name: string, args: Record<string, unknown>) => {
    rpcs.push({ name, args });
    return { data: null, error: null, ...(rpcHandler ? rpcHandler(name, args) : {}) };
  };
  return { client: { from, rpc } as unknown as SupabaseClient, ops, rpcs };
}

const has = (calls: Call[], method: string, ...args: unknown[]) =>
  calls.some(c => c.method === method && args.every((a, i) => JSON.stringify(c.args[i]) === JSON.stringify(a)));

describe('runInvariants: persistence', () => {
  it('passes the vocab lists to the RPCs, writes one run row and one finding per failed check', async () => {
    const healthy = healthyStats();
    const { client, ops, rpcs } = stubSupabase(
      (table, calls) => {
        if (table === 'radar_qa_runs' && has(calls, 'insert')) return { data: { id: 'run-1' } };
        return {};
      },
      name => {
        if (name === 'radar_qa_universe_stats') return { data: { ...healthy.universe, missing_company: { count: 1, sample_ids: ['m1'] } } };
        if (name === 'radar_qa_thesis_stats') return { data: healthy.thesis };
        if (name === 'radar_qa_score_stats') return { data: healthy.score };
        if (name === 'radar_qa_pipeline_stats') return { data: healthy.pipeline };
        if (name === 'radar_qa_vocab_violations') return { data: { violations: 0, samples: [] } };
        return { error: { message: 'unknown rpc' } };
      },
    );
    const r = await runInvariants(client, { now });
    expect(r.run_id).toBe('run-1');
    expect(r.passed).toBe(false);
    expect(r.blockers).toBe(1);
    expect(r.errors).toEqual([]);
    const vocabCalls = rpcs.filter(x => x.name === 'radar_qa_vocab_violations');
    expect(vocabCalls.length).toBe(6);
    expect(vocabCalls.find(x => x.args.p_column === 'modality')?.args.p_allowed).toContain('antibody');
    expect(rpcs.find(x => x.name === 'radar_qa_universe_stats')?.args).toEqual({ p_vocab: { phase: expect.arrayContaining(['phase_2', 'not_applicable']), territories: ['global', 'us', 'eu', 'japan', 'china', 'row'] } });
    const runInsert = ops.find(o => o.table === 'radar_qa_runs')!.calls.find(c => c.method === 'insert')!.args[0] as Record<string, unknown>;
    expect(runInsert).toMatchObject({ kind: 'invariants', passed: false, blocking_failures: 1, universe_size: 10000 });
    const findings = ops.find(o => o.table === 'radar_qa_findings')!.calls.find(c => c.method === 'insert')!.args[0] as Record<string, unknown>[];
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ run_id: 'run-1', check_name: 'asset_has_company', severity: 'blocker', asset_id: null });
  });

  it('a failing RPC yields a blocker and the run is still persisted', async () => {
    const { client } = stubSupabase(
      (table, calls) => (table === 'radar_qa_runs' && has(calls, 'insert') ? { data: { id: 'run-2' } } : {}),
      () => ({ error: { message: 'function does not exist' } }),
    );
    const r = await runInvariants(client, { now });
    expect(r.run_id).toBe('run-2');
    expect(r.blockers).toBeGreaterThanOrEqual(10);
    // 4 stats RPCs + 6 vocab RPCs
    expect(r.checks.filter(c => c.check_name === 'qa_stats_collection')).toHaveLength(10);
  });

  it('persist:false skips writes', async () => {
    const { client, ops } = stubSupabase(() => ({}), () => ({ data: {} }));
    const r = await runInvariants(client, { now, persist: false });
    expect(r.run_id).toBeNull();
    expect(ops).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GOLDEN SET SAMPLER
// ═══════════════════════════════════════════════════════════════════════

function pool(perStratum: number, opts: { skip?: (c: GoldenCandidate) => boolean } = {}): GoldenCandidate[] {
  const out: GoldenCandidate[] = [];
  for (const owner of ['industry', 'academic_hospital'] as const)
    for (const phase of ['p1', 'p2', 'p3'] as const)
      for (const region of ['north_america', 'europe', 'east_asia', 'other'] as const)
        for (let i = 0; i < perStratum; i++) {
          const c: GoldenCandidate = { asset_id: `${owner}-${phase}-${region}-${i}`, owner_group: owner, phase_bucket: phase, region_bucket: region };
          if (!opts.skip?.(c)) out.push(c);
        }
  return out;
}

describe('golden set: quotas and sampler', () => {
  it('quotas sum to size and honour the 70/30 owner split', () => {
    const q = goldenQuotas(200);
    const total = Object.values(q).reduce((a, b) => a + b, 0);
    expect(total).toBe(200);
    const industry = Object.entries(q).filter(([k]) => k.startsWith('industry|')).reduce((a, [, v]) => a + v, 0);
    expect(industry).toBe(140);
    expect(Object.keys(q)).toHaveLength(24);
    expect(q['industry|p1|north_america']).toBeGreaterThanOrEqual(18);
    expect(q['academic_hospital|p3|other']).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic for a seed and changes with the seed', () => {
    const cands = pool(30);
    const a = selectGoldenSample(cands, { size: 200, seed: 's1' });
    const b = selectGoldenSample(cands, { size: 200, seed: 's1' });
    const c = selectGoldenSample(cands, { size: 200, seed: 's2' });
    expect(a.selected.map(s => s.asset_id)).toEqual(b.selected.map(s => s.asset_id));
    expect(a.selected).toHaveLength(200);
    expect(a.shortfall).toBe(0);
    expect(a.selected.map(s => s.asset_id)).not.toEqual(c.selected.map(s => s.asset_id));
    expect(a.filled).toEqual(a.quotas);
    // shuffled input gives the same set
    const shuffled = [...cands].reverse();
    expect(selectGoldenSample(shuffled, { size: 200, seed: 's1' }).selected.map(s => s.asset_id).sort()).toEqual(a.selected.map(s => s.asset_id).sort());
  });

  it('lowest hash wins within a stratum and precomputed hashes are honoured', () => {
    const cands = pool(30);
    const r = selectGoldenSample(cands, { size: 200, seed: 'x' });
    const key = 'industry|p2|europe';
    const inStratum = cands.filter(c => `${c.owner_group}|${c.phase_bucket}|${c.region_bucket}` === key).map(c => ({ id: c.asset_id, h: goldenHash(c.asset_id, 'x') })).sort((a, b) => a.h.localeCompare(b.h));
    const picked = r.selected.filter(s => s.stratum === key).map(s => s.asset_id);
    expect(picked).toEqual(inStratum.slice(0, r.quotas[key]).map(x => x.id));
    expect(goldenHash('abc', 'x')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('redistributes shortfall within the owner group, then across', () => {
    // no academic east_asia candidates at all
    const cands = pool(30, { skip: c => c.owner_group === 'academic_hospital' && c.region_bucket === 'east_asia' });
    const r = selectGoldenSample(cands, { size: 200, seed: 's' });
    expect(r.selected).toHaveLength(200);
    expect(r.selected.filter(s => s.owner_group === 'academic_hospital')).toHaveLength(60);
    expect(r.filled['academic_hospital|p1|east_asia']).toBe(0);
    // thin academic pool overall: only 20 academic candidates in total
    const thin = pool(30, { skip: c => c.owner_group === 'academic_hospital' && !c.asset_id.endsWith('-0') });
    const t = selectGoldenSample(thin, { size: 200, seed: 's' });
    expect(t.selected.filter(s => s.owner_group === 'academic_hospital')).toHaveLength(12);
    expect(t.selected).toHaveLength(200);
    expect(t.selected.filter(s => s.owner_group === 'industry')).toHaveLength(188);
    // truly insufficient pool reports the shortfall
    const tiny = selectGoldenSample(pool(2), { size: 200, seed: 's' });
    expect(tiny.selected).toHaveLength(48);
    expect(tiny.shortfall).toBe(152);
  });

  it('ignores duplicates and unknown strata', () => {
    const weird = { asset_id: 'weird', owner_group: 'cro', phase_bucket: 'p1', region_bucket: 'other' } as unknown as GoldenCandidate;
    const cands: GoldenCandidate[] = [...pool(5), ...pool(5), weird];
    const r = selectGoldenSample(cands, { size: 24, seed: 's' });
    expect(new Set(r.selected.map(s => s.asset_id)).size).toBe(24);
    expect(r.selected.find(s => s.asset_id === 'weird')).toBeUndefined();
  });

  it('topFactors keeps the nine largest |points| and drops the intercept', () => {
    const fs = Array.from({ length: 12 }, (_, i) => ({ factor: `f${i}`, points: i % 2 ? -i : i, score: i, weight: 0.1, confidence: 50, evidence_text: null, evidence_url: null }));
    fs.push({ factor: 'intercept', points: -99, score: 0, weight: 1, confidence: 100, evidence_text: null, evidence_url: null });
    const top = topFactors(fs);
    expect(top).toHaveLength(9);
    expect(top[0].factor).toBe('f11');
    expect(top.find(f => f.factor === 'intercept')).toBeUndefined();
    expect(topFactors({})).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AGREEMENT MATH
// ═══════════════════════════════════════════════════════════════════════

describe('agreement math', () => {
  it("Cohen's kappa matches the textbook example and edge cases", () => {
    // 20 a/a, 5 a/b, 10 b/a, 15 b/b → po = 0.7, pe = 0.5, kappa = 0.4
    const pairs: [string | null, string | null][] = [
      ...Array(20).fill(['a', 'a']), ...Array(5).fill(['a', 'b']), ...Array(10).fill(['b', 'a']), ...Array(15).fill(['b', 'b']),
    ];
    expect(cohensKappa(pairs)).toBeCloseTo(0.4, 3);
    expect(cohensKappa([])).toBeNull();
    expect(cohensKappa([['a', 'a'], ['a', 'a']])).toBeNull(); // pe = 1
    expect(cohensKappa([['a', 'a'], ['b', 'b'], [null, null], ['c', 'c']])).toBe(1);
    expect(cohensKappa([['a', 'b'], ['b', 'a']])).toBe(-1);
  });

  it('fieldAgrees: exact for categoricals, normalised for target, fuzzy for text', () => {
    expect(fieldAgrees('therapeutic_area', 'Oncology', 'oncology')).toBe(true);
    expect(fieldAgrees('modality', 'antibody', 'adc')).toBe(false);
    expect(fieldAgrees('target', 'PD-1', 'pd1')).toBe(true);
    expect(fieldAgrees('target', 'PD-1', 'PD-L1')).toBe(false);
    expect(fieldAgrees('target', null, null)).toBe(true);
    expect(fieldAgrees('target', 'KRAS', null)).toBe(false);
    expect(textSimilar('non-small cell lung cancer', 'NSCLC (non-small-cell lung cancer)')).toBe(true);
    expect(textSimilar('PD-1 blocking antibody', 'anti-PD-1 monoclonal antibody')).toBe(true);
    expect(textSimilar('atopic dermatitis', 'psoriasis')).toBe(false);
    expect(fieldAgrees('moa_short', 'KRAS G12C covalent inhibitor', 'covalent inhibitor of KRAS G12C')).toBe(true);
  });

  it('agreementPassed applies the launch gate per field', () => {
    const ok = { classified_compared: 200, fields: { therapeutic_area: { compared: 200, agree: 180, agreement_pct: 90, kappa: 0.8, both_null: 0, model_only: 0, stored_only: 0 }, modality: { compared: 200, agree: 172, agreement_pct: 86, kappa: 0.7, both_null: 0, model_only: 0, stored_only: 0 }, target: { compared: 200, agree: 150, agreement_pct: 75, kappa: null, both_null: 0, model_only: 0, stored_only: 0 } }, partnership: { compared: 200, agree: 190, agreement_pct: 95, kappa: 0.5, both_null: 0, model_only: 0, stored_only: 0, confusion: {} } };
    expect(agreementPassed(ok)).toBe(true);
    expect(agreementPassed({ ...ok, fields: { ...ok.fields, target: { ...ok.fields.target, agreement_pct: 74.9 } } })).toBe(false);
    expect(agreementPassed({ ...ok, classified_compared: 0 })).toBe(false);
    expect(AGREEMENT_GATE.therapeutic_area).toBe(85);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PARTNERSHIP MODEL CALL
// ═══════════════════════════════════════════════════════════════════════

function message(text: string): Anthropic.Message {
  return {
    id: 'msg', type: 'message', role: 'assistant', model: 'claude-opus-4-6', stop_reason: 'end_turn', stop_sequence: null,
    content: [{ type: 'text', text, citations: null }],
    usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 500, cache_read_input_tokens: 0 },
  } as unknown as Anthropic.Message;
}

function stubClient(responses: Array<Anthropic.Message | Error>): ClassifierClient & { create: jest.Mock } {
  const create = jest.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('stub client: no more responses');
    if (next instanceof Error) throw next;
    return next;
  });
  return { create, messages: { create } };
}

const pInput = {
  asset_id: 'a1', asset_name: 'ACM-101', aliases: [], company_name: 'Acme', stored_status: 'unpartnered', stored_partner: null,
  trials: [{ nct_id: 'NCT1', lead_sponsor: 'Acme', lead_sponsor_class: 'INDUSTRY', collaborators: ['BigPharma Inc'], status: 'recruiting' }],
  deals: [], press: [],
};

describe('partnership audit request', () => {
  it('builds a cached, temperature-0, JSON-schema request that withholds the stored status', () => {
    const p = buildPartnershipRequestParams('claude-opus-4-6', [pInput]);
    expect(p.temperature).toBe(0);
    expect((p.system as { cache_control?: unknown }[])[0].cache_control).toEqual({ type: 'ephemeral' });
    expect((p as unknown as { output_config: { format: { type: string } } }).output_config.format.type).toBe('json_schema');
    const user = (p.messages[0].content as string);
    expect(user).toContain('BigPharma Inc');
    expect(user).not.toContain('unpartnered');
    expect(buildPartnershipRequestParams('claude-opus-5', [pInput]).temperature).toBeUndefined();
  });

  it('parses verdicts with zod, drops unknown / invalid items, counts usage and respects the cap', async () => {
    const client = stubClient([message(JSON.stringify({ results: [
      { asset_id: 'a1', partnership_status: 'partially_partnered', partner_name: 'BigPharma Inc', confidence: 70, rationale: 'industry collaborator on NCT1', evidence_ids: ['NCT1'] },
      { asset_id: 'zz', partnership_status: 'partnered', partner_name: null, confidence: 1, rationale: '', evidence_ids: [] },
      { asset_id: 'a1', partnership_status: 'bogus', partner_name: null, confidence: 1, rationale: '', evidence_ids: [] },
    ] }))]);
    const budget = new RequestBudget(1);
    const r = await partnershipBatchWithModel(client, 'claude-opus-4-6', [pInput], budget);
    expect(r.verdicts.size).toBe(1);
    expect(r.verdicts.get('a1')).toMatchObject({ partnership_status: 'partially_partnered', partner_name: 'BigPharma Inc' });
    expect(r.usage).toEqual({ input: 1000, output: 200, cacheWrite: 500, cacheRead: 0 });
    await expect(partnershipBatchWithModel(client, 'claude-opus-4-6', [pInput], budget)).rejects.toThrow(/request cap/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// HUMAN REVIEW SHEET
// ═══════════════════════════════════════════════════════════════════════

describe('human review sheet', () => {
  it('builds one row per asset × field with labels, URL and evidence links', () => {
    const rows = buildHumanReviewRows([{
      asset_id: 'a1', stratum: 'industry|p2|europe',
      frozen_snapshot: { asset: { asset_name: 'ACM-101', company_name: 'Acme', therapeutic_area: 'oncology', modality: 'antibody', phase: 'phase_2', target: 'PD-1', nct_ids: ['NCT1'], partnership_status: 'partnered' }, partnership_evidence: [{ type: 'deal', id: 'd1', url: 'https://x/deal' }] },
    }], 'https://solidus.test');
    expect(rows).toHaveLength(8);
    const ta = rows.find(r => r.field === 'therapeutic_area')!;
    expect(ta).toMatchObject({ model_value: 'oncology', model_label: 'Oncology', asset_url: 'https://solidus.test/radar/a1', human_value: null, agrees: null });
    expect(ta.evidence).toBe('https://clinicaltrials.gov/study/NCT1');
    expect(rows.find(r => r.field === 'partnership_status')!.evidence).toContain('https://x/deal');
    expect(rows.find(r => r.field === 'moa_short')!.model_value).toBeNull();
  });

  it('normalises filled rows: yes/no, inferred agreement from human_value, skips untouched rows', () => {
    const rows = normalizeHumanReviewRows([
      { asset_id: 'a1', field: 'therapeutic_area', model_value: 'oncology', human_value: '', agrees: 'Yes', comment: '' },
      { asset_id: 'a1', field: 'modality', model_value: 'antibody', human_value: 'adc', agrees: '', comment: 'it is an ADC' },
      { asset_id: 'a1', field: 'target', model_value: 'PD-1', human_value: 'pd1', agrees: '', comment: '' },
      { asset_id: 'a1', field: 'moa_short', model_value: null, human_value: '', agrees: '', comment: '' },
      { asset_id: 'a1', field: 'not_a_field', model_value: 'x', human_value: 'y', agrees: 'no', comment: '' },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ field: 'therapeutic_area', agrees: true, human_value: 'oncology' });
    expect(rows[1]).toMatchObject({ field: 'modality', agrees: false, human_value: 'adc', comment: 'it is an ADC' });
    expect(rows[2]).toMatchObject({ field: 'target', agrees: true });
    const summary = summarizeHumanReviews(rows);
    expect(summary.modality).toMatchObject({ compared: 1, agree: 0, agreement_pct: 0 });
    expect(summary.therapeutic_area).toMatchObject({ compared: 1, agree: 1, agreement_pct: 100 });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════════════

describe('report', () => {
  it('coverage rows carry thresholds and pass flags from the checks', () => {
    const stats = healthyStats();
    const checks = evaluateInvariants(stats, { now });
    const rows = coverageRowsFromStats(stats, checks);
    expect(rows.find(r => r.metric.startsWith('Industry assets classified'))).toMatchObject({ numerator: 5800, denominator: 6000, share_pct: 96.7, threshold_pct: 95, passed: true });
    expect(rows.find(r => r.metric.startsWith('Eligible assets'))).toMatchObject({ share_pct: 99.7, passed: true });
    expect(coverageRowsFromStats(null)).toEqual([]);
  });

  it('agreement rows apply the gate only where one exists', () => {
    const f = { therapeutic_area: { compared: 10, agree: 9, agreement_pct: 90, kappa: 0.8, both_null: 0, model_only: 0, stored_only: 0 }, moa_short: { compared: 10, agree: 5, agreement_pct: 50, kappa: null, both_null: 0, model_only: 0, stored_only: 0 } };
    const rows = agreementRowsFromFields(f, { compared: 10, agree: 8, agreement_pct: 80, kappa: 0.3, both_null: 0, model_only: 0, stored_only: 0 });
    expect(rows.find(r => r.field === 'therapeutic_area')).toMatchObject({ gate_pct: 85, passed: true });
    expect(rows.find(r => r.field === 'moa_short')).toMatchObject({ gate_pct: null, passed: null });
    expect(rows.find(r => r.field === 'partnership_status')).toMatchObject({ gate_pct: 85, passed: false });
  });

  it('buildQaReport folds the latest runs and findings; markdown renders every section', async () => {
    const stats = healthyStats();
    stats.universe.missing_company = { count: 1, sample_ids: ['m1'] };
    const checks = evaluateInvariants(stats, { now });
    const runs: Record<string, unknown> = {
      invariants: { id: 'r1', run_at: NOW_ISO, kind: 'invariants', universe_size: 10000, summary: { checks, stats }, passed: false, blocking_failures: 1, notes: null },
      golden_agreement: { id: 'r2', run_at: NOW_ISO, kind: 'golden_agreement', universe_size: 200, summary: { model: 'claude-opus-4-6', estimated_cost_usd: 3.2, fields: { therapeutic_area: { compared: 200, agree: 190, agreement_pct: 95, kappa: 0.9, both_null: 0, model_only: 0, stored_only: 0 } }, partnership: { compared: 200, agree: 180, agreement_pct: 90, kappa: 0.6, both_null: 0, model_only: 0, stored_only: 0, confusion: { unpartnered: { unpartnered: 150, partnered: 10 }, partnered: { partnered: 30, unpartnered: 10 } } }, disagreements: [{ asset_id: 'a', asset_name: 'X-1', company_name: 'Co', field: 'target', stored: 'A', model: 'B', model_confidence: 80 }] }, passed: true, blocking_failures: 0, notes: null },
      golden_human: null,
    };
    const { client } = stubSupabase((table, calls) => {
      if (table === 'radar_qa_runs') {
        const kind = calls.find(c => c.method === 'eq' && c.args[0] === 'kind')?.args[1] as string;
        return { data: runs[kind] ?? null };
      }
      if (table === 'radar_qa_findings') return { data: [{ check_name: 'asset_has_company', severity: 'blocker', expected: 'no asset without company', observed: '1 assets', details: { count: 1, failing_ids: ['m1'], group: 'identity' }, asset_id: null }] };
      return {};
    });
    const report = await buildQaReport(client, undefined, { now });
    expect(report.passed).toBe(false);
    expect(report.launch_gate).toMatchObject({ no_blockers: false, majors_count: 0, agreement_ok: true, human_ok: null });
    expect(report.invariants!.blockers[0]).toMatchObject({ check_name: 'asset_has_company', failing_ids: ['m1'] });
    expect(report.agreement!.rows.map(r => r.field)).toEqual(['therapeutic_area', 'partnership_status']);
    expect(report.cron_health!.missing).toEqual([]);
    expect(report.freshness).toEqual({ active_trial_assets: 5000, fresh_400d: 4500, share_pct: 90 });

    const md = renderQaReportMarkdown(report);
    expect(md).toContain('# Asset Radar QA report');
    expect(md).toContain('launch gate: **FAIL**');
    expect(md).toContain('**asset_has_company**');
    expect(md).toContain('| Industry assets classified or skipped |');
    expect(md).toContain('claude-opus-4-6');
    expect(md).toContain('### Partnership confusion');
    expect(md).toContain('| Co / X-1 | target | A | B | 80 |');
    expect(md).toContain('All expected Radar stages ran.');
    expect(md).not.toContain('undefined');
  });

  it('markdown renders an empty report without throwing', () => {
    const empty: QaReport = {
      generated_at: NOW_ISO, passed: false,
      launch_gate: { no_blockers: null, majors_count: null, agreement_ok: null, human_ok: null, notes: ['No invariants run yet'] },
      invariants: null, coverage: [], agreement: null, human: null, freshness: null, cron_health: null,
    };
    const md = renderQaReportMarkdown(empty);
    expect(md).toContain('> No invariants run yet');
    expect(md).toContain('| No blockers | n/a |');
  });
});
