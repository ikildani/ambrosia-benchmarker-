/**
 * Deal-terms backtest: the CI accuracy gate, the territory mapping and the offline fixture path.
 */
import { readFileSync } from 'fs';
import path from 'path';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => {
    throw new Error('network access in an offline backtest');
  }),
}));

import { createClient } from '@supabase/supabase-js';
import {
  checkAgainstBaseline,
  mapTerritory,
  runFixture,
  GATE,
  type BacktestFixture,
  type BacktestSummary,
} from '@/lib/backtest/terms-backtest-core';
import { getBenchmarksSync, setCalibrationRowsForTesting } from '@/lib/benchmarks';

const root = path.join(__dirname, '..', '..');
const fixture: BacktestFixture = JSON.parse(readFileSync(path.join(root, 'data/backtest/terms-backtest-fixture.json'), 'utf8'));
const baseline: BacktestSummary = JSON.parse(readFileSync(path.join(root, 'data/backtest/terms-backtest-baseline.json'), 'utf8'));

function summary(overall: Partial<BacktestSummary['overall']>, extra: Partial<BacktestSummary> = {}): BacktestSummary {
  return {
    generatedAt: '2026-11-23T00:00:00Z',
    fixtureSnapshotAt: 'snap-1',
    window: { from: '2023-01-01', to: '2026-09-30' },
    overall: { n: 200, medianRatio: 1.2, within2x: 0.4, mdaeLog: 1.0, ...overall },
    byTerritory: {}, byPhase: {}, byTA: {}, byModality: {},
    ...extra,
  };
}

describe('checkAgainstBaseline (CI accuracy gate)', () => {
  const base = summary({});

  it('passes when nothing changed', () => {
    expect(checkAgainstBaseline(summary({}), base)).toEqual({ ok: true, messages: [] });
  });

  it('passes on improvements', () => {
    expect(checkAgainstBaseline(summary({ within2x: 0.45, mdaeLog: 0.9 }), base).ok).toBe(true);
  });

  it('tolerates a within-2x drop of up to 1 point', () => {
    expect(checkAgainstBaseline(summary({ within2x: 0.4 - GATE.maxWithin2xDrop }), base).ok).toBe(true);
    expect(checkAgainstBaseline(summary({ within2x: 0.391 }), base).ok).toBe(true);
  });

  it('fails when within 2x drops by more than 1 point', () => {
    const r = checkAgainstBaseline(summary({ within2x: 0.385 }), base);
    expect(r.ok).toBe(false);
    expect(r.messages.join(' ')).toMatch(/Within 2x fell 1\.5 points/);
  });

  it('tolerates an MdAE(log) rise of up to 0.02', () => {
    expect(checkAgainstBaseline(summary({ mdaeLog: 1.02 }), base).ok).toBe(true);
  });

  it('fails when MdAE(log) rises by more than 0.02', () => {
    const r = checkAgainstBaseline(summary({ mdaeLog: 1.03 }), base);
    expect(r.ok).toBe(false);
    expect(r.messages.join(' ')).toMatch(/MdAE\(log\) rose/);
  });

  it('fails when the sample changed without a baseline refresh', () => {
    expect(checkAgainstBaseline(summary({ n: 201 }), base).messages.join(' ')).toMatch(/Sample changed/);
    expect(checkAgainstBaseline(summary({}, { fixtureSnapshotAt: 'snap-2' }), base).ok).toBe(false);
  });
});

describe('mapTerritory', () => {
  it.each([
    ['global', null, 'global'],
    ['china', null, 'china'],
    ['Greater China', null, 'china'],
    ['Japan', null, 'japan'],
    ['us', null, 'us_only'],
    ['us_eu', null, 'us_eu'],
    ['ex_us', null, 'ex_us'],
    ['ex_us (excluding US, Canada, and Mexico)', null, 'ex_us'],
    ['other', ['China mainland', 'Hong Kong', 'Macau', 'Taiwan'], 'china'],
    ['regional', ['United States', 'Canada'], 'us_only'],
    ['regional', ['United States', 'Canada', 'European Union', 'United Kingdom'], 'us_eu'],
    ['regional', ['European Union', 'European Patent Organization member states'], 'europe'],
    ['asia_pacific', ['South Korea'], 'south_korea'],
    ['other', ['Australia', 'New Zealand'], 'australia'],
    ['regional', ['Saudi Arabia', 'Middle East', 'North Africa'], 'mena'],
  ] as Array<[string, string[] | null, string]>)('%s %j -> %s', (t, inc, want) => {
    expect(mapTerritory(t, inc)).toBe(want);
  });

  it.each([
    ['ex_china', null],
    ['global ex-Greater China', null],
    ['other', ['worldwide excluding Japan']],
    ['regional', ['Europe', 'India']],
    ['regional', ['Japan', 'South Korea']],
    ['null', []],
    ['Europe and select markets', null],
  ] as Array<[string, string[] | null]>)('skips carve-outs and mixed baskets: %s %j', (t, inc) => {
    expect(mapTerritory(t, inc)).toBeNull();
  });
});

describe('offline fixture backtest', () => {
  beforeEach(() => (createClient as jest.Mock).mockClear());
  afterAll(() => setCalibrationRowsForTesting(null));

  it('fixture holds primary-sourced deals and the calibration overlay', () => {
    expect(fixture.deals.length).toBeGreaterThan(100);
    expect(fixture.calibrations.length).toBeGreaterThan(0);
    expect(fixture.deals.every((d) => d.upfront_usd > 0)).toBe(true);
  });

  it('reproduces the committed baseline without touching Supabase', () => {
    const { rows, summary: s } = runFixture(fixture);
    expect(createClient).not.toHaveBeenCalled();
    expect(rows.length).toBe(baseline.overall.n);
    expect(s.overall).toEqual(baseline.overall);
    expect(s.byTerritory).toEqual(baseline.byTerritory);
    expect(checkAgainstBaseline(s, baseline).ok).toBe(true);
  });

  it('applies the fixture calibrations (results differ from static tables)', () => {
    const calibrated = runFixture(fixture).summary.overall;
    const staticOnly = runFixture({ ...fixture, calibrations: [] }).summary.overall;
    expect(calibrated.medianRatio).not.toBeCloseTo(staticOnly.medianRatio, 2);
  });

  it('setCalibrationRowsForTesting pins the overlay and null releases it', () => {
    const row = { calibration_type: 'phase_baseline', therapeutic_area: 'cardiovascular', phase: 'phase2', modality: null,
      upfront_low: 11, upfront_median: 22, upfront_high: 33, total_value_low: null, total_value_median: null, total_value_high: null,
      royalty_base: null, royalty_max: null, multiplier: null, sample_size: 12, calibrated_at: '2026-11-01' };
    setCalibrationRowsForTesting([row]);
    const cell = getBenchmarksSync().cardiovascularPhaseBaselines.phase2;
    expect(cell.meta?.source).toBe('calibrated');
    expect(cell.upfront.median).toBe(22);
    expect(createClient).not.toHaveBeenCalled();
    setCalibrationRowsForTesting(null);
  });
});
