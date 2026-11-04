import { harmonizeCalibratedBaselines, type PhaseBaselines, type PhaseBaselineEntry } from '@/lib/benchmarks';

const cell = (median: number, source: 'calibrated' | 'static' = 'calibrated'): PhaseBaselineEntry => ({
  upfront: { low: median / 2, median, high: median * 2 },
  totalValue: { low: median * 5, median: median * 10, high: median * 20 },
  royalty: { base: 8, max: 14 },
  ...(source === 'calibrated' ? { meta: { sampleSize: 12, calibratedAt: '2026-11-01', source } } : {}),
});

describe('harmonizeCalibratedBaselines', () => {
  it('fills uncalibrated half-steps from calibrated neighbours instead of static mega-deal numbers', () => {
    const b: PhaseBaselines = { phase1: cell(20), phase1_2: cell(168, 'static'), phase2: cell(62.5), phase2_3: cell(300, 'static'), phase3: cell(90) };
    harmonizeCalibratedBaselines(b);
    expect(b.phase1_2.upfront.median).toBeCloseTo(Math.sqrt(20 * 62.5), 0);
    expect(b.phase1_2.meta?.interpolated).toBe(true);
    expect(b.phase2_3.upfront.median).toBeLessThan(90);
  });

  it('replaces a calibrated outlier far above both neighbours', () => {
    const b: PhaseBaselines = { phase2: cell(40), phase2_3: cell(60), phase3: cell(4125), approved: cell(120) };
    harmonizeCalibratedBaselines(b);
    expect(b.phase3.upfront.median).toBeLessThan(200);
  });

  it('keeps calibrated medians from falling as the phase advances', () => {
    const b: PhaseBaselines = { phase2: cell(35), phase3: cell(23.8) };
    harmonizeCalibratedBaselines(b);
    expect(b.phase3.upfront.median).toBe(35);
  });

  it('leaves a static ladder untouched', () => {
    const b: PhaseBaselines = { phase1: cell(10, 'static'), phase1_2: cell(168, 'static'), phase2: cell(165, 'static') };
    harmonizeCalibratedBaselines(b);
    expect(b.phase1_2.upfront.median).toBe(168);
  });
});
