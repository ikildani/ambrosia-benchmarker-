import { readFileSync } from 'fs';
import { join } from 'path';
import { binOf, gamSum, gamTerm, quantileEdges, trainGam } from '@/lib/radar/backtest/gam';
import { buildModelParams, logitBatch, predictBatch, scoreFromFeatures, contributionMatrix, isGamModel, type ModelParams } from '@/lib/radar/backtest/model';
import { computeMonthlyMetrics, gateDecision, precisionAtK } from '@/lib/radar/backtest/metrics';
import { buildLabelEvents, ledgerEvents, licensorMatches, mergeAndPropagate, type LabelAsset, type LabelDeal } from '@/lib/radar/backtest/labels';
import { evaluateModelOnRows, inFeedPopulation, rowFor, type LoadedSnapshot } from '@/lib/radar/backtest/run';
import { MODEL_EXCLUDED_FEATURES, MODEL_FEATURE_NAMES, FEATURE_NAMES, CANDIDATE_FEATURE_NAMES } from '@/lib/radar/backtest/features';
import { computeScorecard } from '@/lib/radar/qa/scorecard';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('gam: bins', () => {
  test('quantile edges collapse duplicates; binary features get one edge', () => {
    expect(quantileEdges([0, 1, 1, 0, null, 1], 24)).toEqual([0]);
    expect(quantileEdges([null, null], 8)).toEqual([]);
    const e = quantileEdges(Array.from({ length: 1000 }, (_, i) => i), 10);
    expect(e.length).toBe(9);
    expect([...e].sort((a, b) => a - b)).toEqual(e);
  });

  test('binOf: <= edge goes left, above all edges is the last bin, missing is -1', () => {
    const edges = [1, 5, 10];
    expect(binOf(edges, 0)).toBe(0);
    expect(binOf(edges, 1)).toBe(0);
    expect(binOf(edges, 1.5)).toBe(1);
    expect(binOf(edges, 10)).toBe(2);
    expect(binOf(edges, 11)).toBe(3);
    expect(binOf(edges, null)).toBe(-1);
    expect(binOf(edges, Number.NaN)).toBe(-1);
  });
});

describe('gam: training', () => {
  // y depends on x0 non-monotonically (U-shape) and on whether x1 is missing; x2 is noise.
  function synth(n: number, seed: number) {
    const rnd = mulberry32(seed);
    const X: (number | null)[][] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const x0 = rnd() * 10;
      const x1 = rnd() > 0.7 ? null : rnd();
      const x2 = rnd();
      const z = -3 + (x0 < 2 || x0 > 8 ? 2.5 : 0) + (x1 === null ? 1.5 : 0);
      X.push([x0, x1, x2]);
      y.push(rnd() < 1 / (1 + Math.exp(-z)) ? 1 : 0);
    }
    return { X, y };
  }

  test('learns a U-shaped effect and an informative missing bin; noise stays small', () => {
    const { X, y } = synth(6000, 7);
    const v = synth(2000, 8);
    const fit = trainGam(X, y, { maxRounds: 300, learningRate: 0.2, valid: { X: v.X, y: v.y } });
    const p = fit.params;
    expect(gamTerm(p, 0, 1) - gamTerm(p, 0, 5)).toBeGreaterThan(1);
    expect(gamTerm(p, 0, 9) - gamTerm(p, 0, 5)).toBeGreaterThan(1);
    expect(gamTerm(p, 1, null) - gamTerm(p, 1, 0.5)).toBeGreaterThan(0.8);
    const range2 = Math.max(...p.values[2], p.missing[2]) - Math.min(...p.values[2], p.missing[2]);
    expect(range2).toBeLessThan(0.5);
    expect(fit.rounds).toBeGreaterThan(0);
    expect(fit.validCurve.length).toBeGreaterThan(0);
  });

  test('is deterministic and early stopping keeps the best validation round', () => {
    const { X, y } = synth(3000, 11);
    const v = synth(1000, 12);
    const a = trainGam(X, y, { maxRounds: 400, learningRate: 0.3, patience: 20, valid: { X: v.X, y: v.y } });
    const b = trainGam(X, y, { maxRounds: 400, learningRate: 0.3, patience: 20, valid: { X: v.X, y: v.y } });
    expect(a.params).toEqual(b.params);
    const best = Math.min(...a.validCurve);
    expect(a.bestValidLoss).toBeCloseTo(best, 12);
    expect(a.validCurve.indexOf(best) + 1).toBe(a.rounds);
  });

  test('a fixed round count trains exactly that many rounds', () => {
    const { X, y } = synth(1500, 3);
    expect(trainGam(X, y, { rounds: 17, learningRate: 0.1 }).rounds).toBe(17);
  });
});

describe('model: additive (gam) params keep the waterfall contract', () => {
  const { X, y } = (() => {
    const rnd = mulberry32(5);
    const X: (number | null)[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 2000; i++) {
      const r = [rnd(), rnd() > 0.5 ? null : rnd()];
      X.push(r);
      y.push(rnd() < (r[0] as number) * 0.3 ? 1 : 0);
    }
    return { X, y };
  })();
  const fit = trainGam(X, y, { rounds: 40 });
  const params: ModelParams = {
    ...buildModelParams({
      version: 'v5.t', featureVersion: 'v5.0', featureNames: ['a', 'b'], signConstraints: [0, 0],
      fit: { weights: [0, 0], bias: fit.bias, means: [0, 0], stds: [1, 1], iterations: fit.rounds, finalLoss: 0, classWeightPos: fit.classWeightPos },
      calibration: { type: 'platt', a: 0.9, b: -0.2 }, samplingRate: 1, l2: 1,
      trainWindow: { from: '2022-01-01', to: '2024-06-01' }, testWindow: { from: '2025-01-01', to: '2025-09-01' }, nTrain: 2000, positivesTrain: 1,
    }),
    prior_correction: -1.2,
    model_type: 'gam',
    gam: fit.params,
  };

  test('Σ contribution + intercept = logit, and batch paths agree with the single scorer', () => {
    expect(isGamModel(params)).toBe(true);
    const out = scoreFromFeatures({ a: 0.7, b: null }, params);
    const sum = out.contributions.reduce((s, c) => s + c.contribution, 0);
    expect(out.intercept + sum).toBeCloseTo(out.logit, 12);
    expect(out.contributions[1].imputed).toBe(true);
    expect(out.contributions[0].weight * out.contributions[0].standardized).toBeCloseTo(out.contributions[0].contribution, 12);
    expect(logitBatch([[0.7, null]], params)[0]).toBeCloseTo(out.logit, 12);
    expect(predictBatch([[0.7, null]], params)[0]).toBeCloseTo(out.probability, 12);
    expect(contributionMatrix([[0.7, null]], params)[0].reduce((s, v) => s + v, 0)).toBeCloseTo(sum, 12);
    expect(gamSum(params.gam!, [0.7, null]) + params.bias + params.prior_correction).toBeCloseTo(out.logit, 12);
  });

  test('a v3/v4 logistic model without model_type is scored as before', () => {
    const lin = { ...params, model_type: undefined, gam: undefined, weights: [1, -1], means: [0.5, 0.5], stds: [1, 1] };
    expect(isGamModel(lin)).toBe(false);
    const out = scoreFromFeatures({ a: 1, b: 0 }, lin);
    expect(out.logit).toBeCloseTo(lin.bias + lin.prior_correction + 0.5 + 0.5, 10);
  });
});

describe('metrics: feed protocol', () => {
  test('ranks within each month and averages; lift_at_100 = precision / base rate on the same rows', () => {
    // Month A: 3 positives on top of 200 negatives; month B: positives at the bottom.
    const months: string[] = [];
    const scores: number[] = [];
    const labels: number[] = [];
    for (let i = 0; i < 203; i++) { months.push('2025-01-01'); scores.push(i < 3 ? 10 - i : -i); labels.push(i < 3 ? 1 : 0); }
    for (let i = 0; i < 203; i++) { months.push('2025-02-01'); scores.push(i < 3 ? -1000 - i : -i); labels.push(i < 3 ? 1 : 0); }
    const m = computeMonthlyMetrics(months, scores, labels);
    expect(m.months).toBe(2);
    expect(m.months_with_positives).toBe(2);
    expect(m.roc_auc).toBeCloseTo(0.5, 6); // 1.0 and 0.0
    expect(m.precision_at_100).toBeCloseTo((3 / 100 + 0) / 2, 6);
    expect(m.base_rate).toBeCloseTo(3 / 203, 6);
    expect(m.lift_at_100).toBeCloseTo(m.precision_at_100 / m.base_rate, 6);
    // Pooling the two months would rank month A's positives first and hide month B's failure in p@100.
    expect(precisionAtK(scores, labels, 100)).toBeCloseTo(0.03, 6);
  });

  test('months without positives are skipped, weights undo subsampling', () => {
    const m = computeMonthlyMetrics(['m1', 'm1', 'm2'], [2, 1, 5], [1, 0, 0], [1, 99, 10]);
    expect(m.months).toBe(2);
    expect(m.months_with_positives).toBe(1);
    expect(m.base_rate).toBeCloseTo(1 / 100, 9);
    expect(m.precision_at_100).toBeCloseTo(1 / 100, 9);
  });

  test('gate: strictly better on precision@100, top-decile lift AND AUC', () => {
    const inc = { roc_auc: 0.73, precision_at_100: 0.013, lift_top_decile: 3.77 };
    expect(gateDecision({ roc_auc: 0.81, precision_at_100: 0.09, lift_top_decile: 4.8 }, inc).activate).toBe(true);
    expect(gateDecision({ roc_auc: 0.81, precision_at_100: 0.09, lift_top_decile: 3.7 }, inc).activate).toBe(false);
    expect(gateDecision({ roc_auc: 0.72, precision_at_100: 0.09, lift_top_decile: 4.8 }, inc).activate).toBe(false);
    expect(gateDecision({ roc_auc: 0.9, precision_at_100: 0, lift_top_decile: 9 }, { ...inc, precision_at_100: 0 }).activate).toBe(false);
    expect(gateDecision({ roc_auc: 0.6, precision_at_100: 0, lift_top_decile: 1 }, null).activate).toBe(true);
  });
});

describe('labels v5: family, ledger, program propagation', () => {
  const asset = (id: string, over: Partial<LabelAsset> = {}): LabelAsset => ({
    id, company_id: 'c-sub', company_name: '勤浩医药（苏州）股份有限公司', asset_name: 'GH31 Capsule', asset_aliases: [], ...over,
  });
  const deal = (over: Partial<LabelDeal> = {}): LabelDeal => ({
    id: 'd1', licensor_id: 'c-root', licensor_name: 'Genhouse Bio', asset_name: 'GH31', deal_type: 'license',
    announced_date: '2025-02-21', verification_status: 'verified', is_synthetic: false, is_canonical: true, ...over,
  });

  test('a licensor in the same corporate family matches; unrelated companies do not', () => {
    expect(licensorMatches(asset('a', { family_id: 'c-root' }), deal({ licensor_family_id: 'c-root' }))).toBe('family');
    expect(licensorMatches(asset('a', { family_id: 'f2' }), deal({ licensor_family_id: 'c-root' }))).toBeNull();
    expect(licensorMatches(asset('a'), deal())).toBeNull();
  });

  test('buildLabelEvents reaches family members through the licensor family', () => {
    const ev = buildLabelEvents([asset('a', { family_id: 'c-root' })], [deal({ licensor_family_id: 'c-root' })]);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ asset_id: 'a', licensor_match: 'family' });
  });

  test('ledger events cover every row of the linked program, skip ineligible deals', () => {
    const deals = new Map([
      ['d1', deal()],
      ['d2', deal({ id: 'd2', verification_status: 'rejected' })],
      ['d3', deal({ id: 'd3', deal_type: 'distribution' })],
    ]);
    const byProgram = new Map([['k1', [asset('a'), asset('b')]]]);
    const ev = ledgerEvents([{ deal_id: 'd1', program_key: 'k1' }, { deal_id: 'd2', program_key: 'k1' }, { deal_id: 'd3', program_key: 'k1' }], deals, byProgram);
    expect(ev.map(e => `${e.asset_id}:${e.deal_id}`).sort()).toEqual(['a:d1', 'b:d1']);
    expect(ev.every(e => e.match_kind === 'ledger' && e.licensor_match === 'ledger')).toBe(true);
  });

  test('mergeAndPropagate copies an event to the program primary row and keeps direct matches', () => {
    const direct = [{ asset_id: 'dose1', deal_id: 'd1', announced_date: '2025-02-21', deal_type: 'license', match_kind: 'code' as const, licensor_match: 'id' as const }];
    const byProgram = new Map([['k1', [asset('dose1'), asset('primary')]]]);
    const programOf = new Map([['dose1', 'k1'], ['primary', 'k1']]);
    const out = mergeAndPropagate([direct, [{ ...direct[0], match_kind: 'ledger' as const, licensor_match: 'ledger' as const }]], programOf, byProgram);
    expect(out).toHaveLength(2);
    expect(out.find(e => e.asset_id === 'dose1')!.match_kind).toBe('code');
    expect(out.find(e => e.asset_id === 'primary')!.match_kind).toBe('program');
  });
});

describe('population and model inputs', () => {
  test('feed population = industry owner and primary row', () => {
    expect(inFeedPopulation({ program_primary: true, owner_type: 'industry' })).toBe(true);
    expect(inFeedPopulation({ program_primary: false, owner_type: 'industry' })).toBe(false);
    expect(inFeedPopulation({ program_primary: true, owner_type: 'academic' })).toBe(false);
    expect(inFeedPopulation({ program_primary: true, owner_type: null })).toBe(false);
  });

  test('the leaky / undated / constant features never reach the model; company signals do', () => {
    for (const n of MODEL_EXCLUDED_FEATURES) expect(MODEL_FEATURE_NAMES).not.toContain(n);
    for (const n of CANDIDATE_FEATURE_NAMES) expect(MODEL_FEATURE_NAMES).toContain(n);
    expect(MODEL_FEATURE_NAMES.length).toBe(FEATURE_NAMES.length - MODEL_EXCLUDED_FEATURES.size + CANDIDATE_FEATURE_NAMES.length);
  });

  test('rowFor neutralizes features for incumbent re-scoring', () => {
    expect(rowFor({ a: 1, availability: 0.3 }, ['a', 'availability', 'zz'], new Set(['availability']))).toEqual([1, null, null]);
  });

  test('evaluateModelOnRows scores a logistic incumbent without its availability leak', () => {
    const rows: LoadedSnapshot[] = [];
    for (let i = 0; i < 300; i++) rows.push({ asset_id: `a${i}`, as_of: i % 2 ? '2025-01-01' : '2025-02-01', features: { x: i, availability: i < 20 ? 0 : 1 }, label: i < 20 ? 1 : 0, weight: 1 });
    const inc = {
      ...buildModelParams({
        version: 'v3.inc', featureVersion: 'v4.0', featureNames: ['x', 'availability'], signConstraints: [0, 1],
        fit: { weights: [0, -5], bias: 0, means: [0, 1], stds: [1, 1], iterations: 1, finalLoss: 0, classWeightPos: 1 },
        calibration: { type: 'none' }, samplingRate: 1, l2: 0,
        trainWindow: { from: '2022-01-01', to: '2024-06-01' }, testWindow: { from: '2025-01-01', to: '2025-09-01' }, nTrain: 1, positivesTrain: 1,
      }),
    } as ModelParams;
    // With the leak the incumbent would be perfect; neutralized it carries no signal.
    expect(evaluateModelOnRows(inc, rows).roc_auc).toBeCloseTo(0.5, 6);
  });
});

describe('scorecard: feed-protocol lift', () => {
  test('uses the stored lift_at_100 when present, else precision / base rate', () => {
    const base = { backtest_precision_at_100: 0.04, backtest_base_rate: 0.004, backtest_roc_auc: 0.8, backtest_lift_top_decile: 4 };
    const a = computeScorecard({ ...base, backtest_lift_at_100: 25 }).metrics.find(m => m.key === 'backtest_lift_at_100')!;
    expect(a.value).toBe(25);
    const b = computeScorecard(base).metrics.find(m => m.key === 'backtest_lift_at_100')!;
    expect(b.value).toBeCloseTo(10, 9);
  });
});

describe('migration 196', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/196_ranking_v5_deal_links.sql'), 'utf8');

  test('ledger accepts the new link methods', () => {
    for (const m of ['program_identifier', 'drug_alias', 'licensee_program', 'unique_identifier', 'deal_created']) expect(sql).toContain(`'${m}'`);
  });

  test('scorecard forward test and recall read the ledger and skip rejected deals', () => {
    const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.radar_qa_scorecard_stats()'));
    expect(fn).toMatch(/fwd_links AS[\s\S]*radar_deal_program_links/);
    expect(fn).toMatch(/'deals_12m_linked'[\s\S]*radar_deal_program_links/);
    expect(fn).toMatch(/deals12 AS[\s\S]*NOT IN \('rejected', 'flagged'\)/);
    expect(fn).toContain("'backtest_lift_at_100'");
  });

  test('generic payload / isotope words cannot drive a fallback link', () => {
    const re = new RegExp(sql.match(/c_generic text := '([^']+)'/)![1]);
    for (const t of ['DERUXTECAN', 'REZETECAN', 'VEDOTIN', 'AUTOTEMCEL', 'AC225', 'PB212', 'LU177']) expect(re.test(t)).toBe(true);
    for (const t of ['GH31', 'HM17321', 'FELZARTAMAB', 'ORKA001', 'LORUNDROSTAT', 'AT007', 'IN105']) expect(re.test(t)).toBe(false);
  });
});
