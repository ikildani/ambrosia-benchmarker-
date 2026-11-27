import { trainGam, DEFAULT_MIN_CHILD_WEIGHT_SHARE } from '@/lib/radar/backtest/gam';
import { buildModelParams, type ModelParams } from '@/lib/radar/backtest/model';
import { EVAL_PROTOCOL } from '@/lib/radar/backtest/metrics';
import {
  evaluateModelOnRows, feedVisibleOwnership, isFeedTestRow, trainAndEvaluate, GAM_SETTINGS, MODEL_VERSION_PREFIX,
  type LoadedSnapshot,
} from '@/lib/radar/backtest/run';
import { RADAR_OWNERSHIP_DEFAULT_EXCLUDED } from '@/lib/radar/vocab';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('v6 protocol: rank only what the default feed shows', () => {
  test('protocol id moved to v2 and the model prefix to v6', () => {
    expect(EVAL_PROTOCOL).toBe('feed_monthly_v2');
    expect(MODEL_VERSION_PREFIX).toBe('v6');
    // The cron accepts the new prefix in activate_version.
    expect(/^v\d+\.\d{12}$/.test(`${MODEL_VERSION_PREFIX}.202611270000`)).toBe(true);
  });

  test('feed-hidden ownership states are exactly the feed defaults', () => {
    for (const s of RADAR_OWNERSHIP_DEFAULT_EXCLUDED) expect(feedVisibleOwnership(s)).toBe(false);
    for (const s of ['originator', 'unknown', 'licensee', null, undefined]) expect(feedVisibleOwnership(s)).toBe(true);
  });

  test('isFeedTestRow: test months and visible programs only', () => {
    expect(isFeedTestRow({ as_of: '2025-01-01' })).toBe(true);
    expect(isFeedTestRow({ as_of: '2025-01-01', in_feed: true })).toBe(true);
    expect(isFeedTestRow({ as_of: '2025-01-01', in_feed: false })).toBe(false);
    expect(isFeedTestRow({ as_of: '2024-12-01', in_feed: true })).toBe(false);
  });

  test('hidden rows are neither ranked by evaluateModelOnRows nor by trainAndEvaluate', () => {
    // A model that scores x; hidden rows carry high x and label 0, so ranking them would cost AUC.
    const rows: LoadedSnapshot[] = [];
    for (let i = 0; i < 400; i++) {
      const hidden = i % 4 === 0;
      rows.push({ asset_id: `a${i}`, as_of: '2025-03-01', features: { x: hidden ? 1000 + i : i }, label: !hidden && i > 350 ? 1 : 0, weight: 1, in_feed: !hidden });
    }
    const p = buildModelParams({
      version: 'v.t', featureVersion: 'v5.0', featureNames: ['x'], signConstraints: [0],
      fit: { weights: [1], bias: 0, means: [0], stds: [1], iterations: 1, finalLoss: 0, classWeightPos: 1 },
      calibration: { type: 'none' }, samplingRate: 1, l2: 0,
      trainWindow: { from: '2022-01-01', to: '2024-06-01' }, testWindow: { from: '2025-01-01', to: '2025-09-01' }, nTrain: 1, positivesTrain: 1,
    }) as ModelParams;
    expect(evaluateModelOnRows(p, rows).roc_auc).toBeCloseTo(1, 6);
    const shown = rows.map(r => ({ ...r, in_feed: true }));
    expect(evaluateModelOnRows(p, shown).roc_auc).toBeLessThan(0.9);
  });

  test('trainAndEvaluate trains on hidden rows but excludes them from the test ranking', () => {
    const rnd = mulberry32(5);
    const rows: LoadedSnapshot[] = [];
    const months = ['2023-06-01', '2024-03-01', '2024-09-01', '2025-02-01'];
    for (const m of months) {
      for (let i = 0; i < 600; i++) {
        const x = rnd();
        const y = rnd() < 0.02 + 0.3 * x * x ? 1 : 0;
        rows.push({ asset_id: `${m}-${i}`, as_of: m, features: { x }, label: y as 0 | 1, weight: 1, in_feed: i % 5 !== 0 });
      }
    }
    const o = trainAndEvaluate(rows, 'v6.t', new Date('2026-11-27T00:00:00Z'), { featureNames: ['x'] });
    const visibleTest = rows.filter(r => r.as_of >= '2025-01-01' && r.in_feed);
    expect(o.testPredictions.length).toBe(visibleTest.length);
    expect(o.params.n_train).toBe(rows.filter(r => r.as_of <= '2024-06-01').length);
    expect(o.monthly.roc_auc).toBeGreaterThan(0.6);
  });
});

describe('v6 model: larger leaf floor', () => {
  test('GAM_SETTINGS uses a 1 % leaf floor (v5 used 0.0625 %)', () => {
    expect(GAM_SETTINGS.minChildWeightShare).toBe(0.01);
    expect(DEFAULT_MIN_CHILD_WEIGHT_SHARE).toBeCloseTo(0.000625, 9);
  });

  test('a larger leaf floor refuses splits that isolate a handful of positive rows', () => {
    // 20 positives sit in one narrow x band; the rest is noise. A tiny floor carves the band out,
    // a 10 % floor cannot isolate 1 % of the weight.
    const X: (number | null)[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 2000; i++) { X.push([i]); y.push(i >= 1000 && i < 1020 ? 1 : 0); }
    const loose = trainGam(X, y, { rounds: 50, maxBins: 200, classWeightPos: 1, minChildWeightShare: 0.0001 });
    const tight = trainGam(X, y, { rounds: 50, maxBins: 200, classWeightPos: 1, minChildWeightShare: 0.1 });
    const swing = (f: typeof loose) => Math.max(...f.params.values[0]) - Math.min(...f.params.values[0]);
    expect(swing(loose)).toBeGreaterThan(swing(tight));
  });

  test('minChildHessian still overrides the share', () => {
    const X = Array.from({ length: 200 }, (_, i) => [i % 2]);
    const y = X.map(([v]) => (v === 1 ? 1 : 0));
    const fit = trainGam(X, y, { rounds: 5, minChildHessian: 1e9 });
    expect(fit.rounds).toBe(0);
  });
});
