/**
 * monotonePhaseLadder — calibrated development-phase medians are fitted by weighted isotonic
 * regression (no upward bias), uncalibrated half-steps between calibrated phases take their
 * geometric mean, and discovery never sits above preclinical.
 */
import { monotonePhaseLadder, type PhaseBaselines, type PhaseBaselineEntry } from '@/lib/benchmarks';

const cell = (median: number, n?: number): PhaseBaselineEntry => ({
  upfront: { low: median / 2, median, high: median * 2 },
  totalValue: { low: median * 5, median: median * 10, high: median * 20 },
  royalty: { base: 8, max: 12 },
  ...(n ? { meta: { sampleSize: n, calibratedAt: '2026-11-17', source: 'calibrated' as const } } : {}),
});

// Production oncology ladder on Nov 23 2026: calibrated cells mixed with static half-steps.
const oncology = (): PhaseBaselines => ({
  discovery: cell(14),
  preclinical: cell(10.4, 94),
  phase1: cell(60, 53),
  phase1_2: cell(90),
  phase2: cell(35, 42),
  phase2_3: cell(235),
  phase3: cell(97.5, 34),
  nda_filed: cell(630),
  approved: cell(50, 38),
});

const LADDER = ['discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3'];

describe('monotonePhaseLadder', () => {
  it('makes the oncology development ladder non-decreasing', () => {
    const b = oncology();
    monotonePhaseLadder(b);
    const m = LADDER.map((p) => b[p].upfront.median);
    for (let i = 1; i < m.length; i++) expect(m[i]).toBeGreaterThanOrEqual(m[i - 1]);
    const tv = LADDER.map((p) => b[p].totalValue.median);
    for (let i = 1; i < tv.length; i++) expect(tv[i]).toBeGreaterThanOrEqual(tv[i - 1]);
  });

  it('pools a violating pair to its sample-weighted geometric mean, not the higher value', () => {
    const b = oncology();
    monotonePhaseLadder(b);
    const pooled = Math.exp((53 * Math.log(60) + 42 * Math.log(35)) / 95);
    expect(b.phase1.upfront.median).toBeCloseTo(pooled, 0);
    expect(b.phase2.upfront.median).toBeCloseTo(pooled, 0);
    expect(b.phase1.upfront.median).toBeLessThan(60);
    // Cells already in order are untouched.
    expect(b.preclinical.upfront.median).toBe(10.4);
    expect(b.phase3.upfront.median).toBe(97.5);
  });

  it('scales low/high with the median', () => {
    const b = oncology();
    monotonePhaseLadder(b);
    expect(b.phase2.upfront.low / b.phase2.upfront.median).toBeCloseTo(0.5, 1);
    expect(b.phase2.upfront.high / b.phase2.upfront.median).toBeCloseTo(2, 1);
  });

  it('fills static half-steps from calibrated neighbours and caps discovery at preclinical', () => {
    const b = oncology();
    monotonePhaseLadder(b);
    expect(b.phase2_3.upfront.median).toBeCloseTo(Math.sqrt(b.phase2.upfront.median * 97.5), 0);
    expect(b.phase1_2.upfront.median).toBeCloseTo(b.phase1.upfront.median, 0);
    expect(b.discovery.upfront.median).toBe(10.4);
  });

  it('leaves NDA-filed and approved cells alone', () => {
    const b = oncology();
    monotonePhaseLadder(b);
    expect(b.nda_filed.upfront.median).toBe(630);
    expect(b.approved.upfront.median).toBe(50);
  });

  it('leaves an all-static ladder unchanged', () => {
    const b: PhaseBaselines = { preclinical: cell(30), phase1: cell(20), phase2: cell(50) };
    monotonePhaseLadder(b);
    expect(b.phase1.upfront.median).toBe(20);
  });
});
