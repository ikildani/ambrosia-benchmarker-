/**
 * Accuracy statements: the n ≥ 10 threshold, "±X%" / "Y%" formatting, the
 * brief → all-source fallback, the calculator line and the methodology
 * summary shape.
 */

import {
  MIN_N,
  accuracyStatementFromRollups,
  calculatorAccuracyLine,
  formatMedianError,
  formatRate,
  loadBriefAccuracyStatement,
  summariseAccuracy,
} from '@/lib/outcomes/statements';
import type { AccuracyRollupRow, PredictionSource, RollupWindow } from '@/lib/outcomes/types';
import type { SupabaseClient } from '@supabase/supabase-js';

const cell = (over: Partial<AccuracyRollupRow> & { source: PredictionSource | null; window: RollupWindow }): AccuracyRollupRow => ({
  key: `${over.source ?? '*'}|${over.therapeutic_area ?? '*'}|${over.phase ?? '*'}|*|${over.window}`,
  therapeutic_area: null,
  phase: null,
  model_version: null,
  n: 12,
  n_expired: 0,
  median_ape_upfront: 0.18,
  median_ape_total: 0.2345,
  within_band_rate_upfront: 0.7,
  within_band_rate_total: 0.684,
  buyer_hit_rate: 0.5,
  window_hit_rate: 0.4,
  value_captured_total_m: 12.5,
  computed_at: '2026-09-25T02:00:00Z',
  ...over,
});

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('formatting', () => {
  it('rounds the median error to a whole percent with a ± sign', () => {
    expect(formatMedianError(0.2345)).toBe('±23%');
    expect(formatMedianError(0.005)).toBe('±1%');
    expect(formatMedianError(1.5)).toBe('±150%');
    expect(formatMedianError(null)).toBeNull();
    expect(formatMedianError(-0.1)).toBeNull();
    expect(formatMedianError(Number.NaN)).toBeNull();
  });
  it('formats rates as whole percents', () => {
    expect(formatRate(0.684)).toBe('68%');
    expect(formatRate(1)).toBe('100%');
    expect(formatRate(undefined)).toBeNull();
  });
});

describe('accuracyStatementFromRollups', () => {
  it('prints the brief cell with band and buyer clauses when n ≥ 10', () => {
    const s = accuracyStatementFromRollups([cell({ source: 'brief', window: 'all', therapeutic_area: 'oncology' })]);
    expect(s).toEqual({
      metric: 'Median error on resolved briefs (total value)',
      value: '±23%',
      n: 12,
      note: 'within predicted band 68% of the time; buyers named in the brief signed 50% of the time.',
    });
  });

  it('returns null below the threshold, when the median is missing, or with no rows', () => {
    expect(MIN_N).toBe(10);
    expect(accuracyStatementFromRollups([cell({ source: 'brief', window: 'all', n: 9 })])).toBeNull();
    expect(accuracyStatementFromRollups([cell({ source: 'brief', window: 'all', median_ape_total: null })])).toBeNull();
    expect(accuracyStatementFromRollups([])).toBeNull();
  });

  it('ignores 90d / 365d cells and falls back to the all-source cell with its own label', () => {
    const rows = [
      cell({ source: 'brief', window: '365d', n: 40 }),
      cell({ source: 'brief', window: 'all', n: 4 }),
      cell({ source: null, window: 'all', n: 15, median_ape_total: 0.31, within_band_rate_total: 0.6, buyer_hit_rate: 0.9 }),
    ];
    const s = accuracyStatementFromRollups(rows);
    expect(s?.metric).toBe('Median error on resolved predictions in this therapeutic area (total value)');
    expect(s?.value).toBe('±31%');
    expect(s?.n).toBe(15);
    // buyer clause is a brief-only statement
    expect(s?.note).toBe('within predicted band 60% of the time.');
  });

  it('omits the band clause when the band rate is unmeasured', () => {
    const s = accuracyStatementFromRollups([cell({ source: 'brief', window: 'all', within_band_rate_total: null, buyer_hit_rate: null })]);
    expect(s?.note).toBe('Resolved against announced deals for this therapeutic area.');
  });
});

describe('calculatorAccuracyLine', () => {
  it('prefers the calculator cell and uses the upfront error', () => {
    const rows = [
      cell({ source: 'calculator', window: 'all', n: 14, median_ape_upfront: 0.22 }),
      cell({ source: null, window: 'all', n: 60, median_ape_upfront: 0.35 }),
    ];
    expect(calculatorAccuracyLine(rows)).toBe('This profile: median error ±22% on 14 resolved deals');
  });

  it('falls back to all sources, then to the total error, and to null under the threshold', () => {
    expect(calculatorAccuracyLine([
      cell({ source: 'calculator', window: 'all', n: 3 }),
      cell({ source: null, window: 'all', n: 10, median_ape_upfront: null, median_ape_total: 0.4 }),
    ])).toBe('This profile: median error ±40% on 10 resolved deals');
    expect(calculatorAccuracyLine([cell({ source: 'calculator', window: 'all', n: 9 }), cell({ source: null, window: 'all', n: 9 })])).toBeNull();
    expect(calculatorAccuracyLine([cell({ source: 'calculator', window: '90d', n: 50 })])).toBeNull();
  });
});

describe('summariseAccuracy', () => {
  it('groups global cells by source and window and blanks the rates under the threshold', () => {
    const rows = [
      cell({ source: null, window: 'all', n: 30, computed_at: '2026-09-25T02:00:00Z' }),
      cell({ source: null, window: '90d', n: 5, computed_at: '2026-09-25T02:05:00Z' }),
      cell({ source: 'brief', window: 'all', n: 11 }),
      // a TA-specific cell is not part of the global table
      cell({ source: 'brief', window: 'all', therapeutic_area: 'oncology', n: 99 }),
    ];
    const s = summariseAccuracy(rows);
    expect(s.minN).toBe(10);
    expect(s.computedAt).toBe('2026-09-25T02:05:00Z');
    expect(s.sources.map((x) => x.source)).toEqual(['all', 'brief']);
    const all = s.sources[0];
    expect(all.label).toBe('All predictions');
    expect(all.windows.map((w) => w.window)).toEqual(['90d', 'all']);
    const w90 = all.windows[0];
    expect(w90.meaningful).toBe(false);
    expect(w90.n).toBe(5);
    expect(w90.medianErrorTotal).toBeNull();
    const wAll = all.windows[1];
    expect(wAll).toMatchObject({ meaningful: true, n: 30, medianErrorUpfront: '±18%', medianErrorTotal: '±23%', withinBandTotal: '68%', buyerHitRate: '50%', windowHitRate: '40%', valueCapturedM: 12.5 });
    expect(s.sources[1].windows[0].n).toBe(11);
  });

  it('is empty with no rows', () => {
    expect(summariseAccuracy([])).toEqual({ computedAt: null, minN: 10, sources: [] });
  });
});

describe('loadBriefAccuracyStatement', () => {
  function stub(rowsBySource: Record<string, AccuracyRollupRow[]>, fail = false) {
    return {
      from: () => {
        let source: string | null = null;
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = (col: string, v: string) => { if (col === 'source') source = v; return chain; };
        chain.is = (col: string) => { if (col === 'source') source = null; return chain; };
        chain.order = () => Promise.resolve(fail ? { data: null, error: { message: 'boom' } } : { data: rowsBySource[source ?? '*'] ?? [], error: null });
        return chain;
      },
    } as unknown as SupabaseClient;
  }

  it('reads brief + all cells for the TA and returns the statement', async () => {
    const db = stub({ brief: [cell({ source: 'brief', window: 'all', therapeutic_area: 'oncology' })] });
    const s = await loadBriefAccuracyStatement(db, 'oncology');
    expect(s?.value).toBe('±23%');
  });

  it('never throws: a database error yields null and a warning', async () => {
    const s = await loadBriefAccuracyStatement(stub({}, true), 'oncology');
    expect(s).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[Outcomes]'), 'accuracy_rollups: boom');
    expect(await loadBriefAccuracyStatement(stub({}), '  ')).toBeNull();
  });
});
