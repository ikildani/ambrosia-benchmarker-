/**
 * computeRollups on fixtures: medians, within-band, buyer hit, window hit,
 * value captured, windows and the "all" cells.
 */

import { computeRollups, median, rollupKey } from '@/lib/outcomes/rollups';
import type { OutcomeMetrics, RollupInputRow } from '@/lib/outcomes/types';

const NOW = new Date('2027-06-01T00:00:00Z');

const metrics = (over: Partial<OutcomeMetrics> = {}): OutcomeMetrics => ({
  abs_pct_error_upfront: null, abs_pct_error_total: null, within_band_upfront: null, within_band_total: null,
  buyer_hit: null, window_hit: null, value_captured_m: null, ...over,
});

const row = (over: Partial<RollupInputRow> = {}): RollupInputRow => ({
  source: 'brief', therapeutic_area: 'oncology', phase: 'phase_2', model_version: 'brief-v3',
  resolved_at: '2027-05-15T00:00:00Z', expired: false, namedBuyers: true, hadWindow: true, metrics: metrics(), ...over,
});

const fixtures: RollupInputRow[] = [
  row({ metrics: metrics({ abs_pct_error_upfront: 0.10, abs_pct_error_total: 0.30, within_band_upfront: true, within_band_total: true, buyer_hit: true, window_hit: true, value_captured_m: 20 }) }),
  row({ metrics: metrics({ abs_pct_error_upfront: 0.20, abs_pct_error_total: 0.10, within_band_upfront: true, within_band_total: false, buyer_hit: false, window_hit: true, value_captured_m: 5 }) }),
  row({ metrics: metrics({ abs_pct_error_upfront: 0.50, abs_pct_error_total: null, within_band_upfront: false, within_band_total: null, buyer_hit: true, window_hit: false }) }),
  // older than 90 d but inside 365 d
  row({ resolved_at: '2026-12-01T00:00:00Z', metrics: metrics({ abs_pct_error_upfront: 0.40, within_band_upfront: false, buyer_hit: false, window_hit: true }) }),
  // expired prediction: counts against window hit only
  row({ resolved_at: '2027-05-20T00:00:00Z', expired: true, namedBuyers: false, hadWindow: true }),
  // different source / TA
  row({ source: 'calculator', therapeutic_area: 'neurology', phase: 'phase_1', model_version: 'calculator-1.0.0', namedBuyers: false, hadWindow: false, metrics: metrics({ abs_pct_error_upfront: 1.0, within_band_upfront: false }) }),
];

const find = (cells: ReturnType<typeof computeRollups>, key: string) => cells.find((c) => c.key === key);

describe('median', () => {
  it('interpolates even counts, ignores non-finite', () => {
    expect(median([0.1, 0.2, 0.5])).toBe(0.2);
    expect(median([0.1, 0.2, 0.4, 0.5])).toBe(0.3);
    expect(median([NaN])).toBeNull();
    expect(median([])).toBeNull();
  });
});

describe('computeRollups', () => {
  const cells = computeRollups(fixtures, NOW);

  it('brief × oncology × phase_2 × brief-v3 × 365d — medians, rates, value captured', () => {
    const c = find(cells, rollupKey('brief', 'oncology', 'phase_2', 'brief-v3', '365d'));
    expect(c).toBeDefined();
    expect(c!.n).toBe(4);
    expect(c!.n_expired).toBe(1);
    expect(c!.median_ape_upfront).toBe(0.3);              // [0.1,0.2,0.4,0.5] → 0.3
    expect(c!.median_ape_total).toBe(0.2);                // [0.1,0.3] → 0.2
    expect(c!.within_band_rate_upfront).toBe(0.5);        // 2 of 4
    expect(c!.within_band_rate_total).toBe(0.5);          // 1 of 2 non-null
    expect(c!.buyer_hit_rate).toBe(0.5);                  // 2 of 4 (all named buyers)
    expect(c!.window_hit_rate).toBe(0.6);                 // 3 hits / (4 windowed + 1 expired)
    expect(c!.value_captured_total_m).toBe(25);
  });

  it('90d window drops the December row', () => {
    const c = find(cells, rollupKey('brief', 'oncology', 'phase_2', 'brief-v3', '90d'));
    expect(c!.n).toBe(3);
    expect(c!.median_ape_upfront).toBe(0.2);              // [0.1,0.2,0.5]
    expect(c!.window_hit_rate).toBe(0.5);                 // 2 / (3 + 1 expired)
  });

  it('the all-dimensions cell aggregates every source', () => {
    const c = find(cells, rollupKey(null, null, null, null, 'all'));
    expect(c!.n).toBe(5);
    expect(c!.n_expired).toBe(1);
    expect(c!.median_ape_upfront).toBe(0.4);              // [0.1,0.2,0.4,0.5,1.0]
    expect(c!.buyer_hit_rate).toBe(0.5);                  // calculator row had no named buyers
  });

  it('per-source "all" cells exist and the calculator cell is isolated', () => {
    const calc = find(cells, rollupKey('calculator', null, null, null, 'all'));
    expect(calc!.n).toBe(1);
    expect(calc!.median_ape_upfront).toBe(1);
    expect(calc!.window_hit_rate).toBeNull();
    expect(calc!.buyer_hit_rate).toBeNull();
    expect(find(cells, rollupKey('brief', null, null, null, 'all'))!.n).toBe(4);
  });

  it('emits no cell for dimensions that never occur', () => {
    expect(find(cells, rollupKey('radar', null, null, null, 'all'))).toBeUndefined();
    expect(find(cells, rollupKey('brief', 'neurology', null, null, 'all'))).toBeUndefined();
  });

  it('stamps computed_at with the run time', () => {
    expect(cells.every((c) => c.computed_at === NOW.toISOString())).toBe(true);
  });
});
