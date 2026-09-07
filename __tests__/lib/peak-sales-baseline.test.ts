/**
 * Peak-sales baseline shared by PeakSalesOverrideInput and the
 * CustomAssumptionsPanel "Peak Sales" section (components/calculator/peakSalesBaseline.ts).
 */
import {
  getPeakSalesBaseline,
  tripleFromScalar,
  isPeakSalesOverrideSet,
  PEAK_SALES_PHASE_MULTIPLIER,
  PEAK_SALES_SCALAR_SPREAD,
} from '@/components/calculator/peakSalesBaseline';
import { getIndicationTypicalAssetPeak } from '@/lib/financial/index-drugs';

describe('peakSalesBaseline', () => {
  it('mirrors the engine scalar spread (0.7x / 1.5x)', () => {
    expect(PEAK_SALES_SCALAR_SPREAD).toEqual({ low: 0.7, high: 1.5 });
    expect(tripleFromScalar(1000)).toEqual({ low: 700, median: 1000, high: 1500 });
  });

  it('mirrors PEAK_SALES_MULTIPLIER from run-financial-model.ts', () => {
    expect(PEAK_SALES_PHASE_MULTIPLIER.phase2).toEqual({ low: 2.5, median: 5, high: 9 });
    expect(PEAK_SALES_PHASE_MULTIPLIER.phase3).toEqual({ low: 1.5, median: 3, high: 5 });
    expect(PEAK_SALES_PHASE_MULTIPLIER.approved).toEqual({ low: 1.0, median: 1.5, high: 2.5 });
  });

  it('uses the indication typical asset peak (same source as PeakSalesOverrideInput) when available', () => {
    const typical = getIndicationTypicalAssetPeak('lung_nsclc');
    expect(typical).not.toBeNull();
    const baseline = getPeakSalesBaseline({ indication: 'lung_nsclc', phase: 'phase2', totalDealValueMedian: 500 });
    expect(baseline).toEqual({
      low: Math.round(typical! * 0.7),
      median: Math.round(typical!),
      high: Math.round(typical! * 1.5),
    });
    expect(baseline!.median).toBeGreaterThan(0);
  });

  it('falls back to phase multiple of the live estimate when no indication anchor exists', () => {
    const baseline = getPeakSalesBaseline({ indication: 'no_such_indication', phase: 'phase2', totalDealValueMedian: 400 });
    expect(baseline).toEqual({ low: 1000, median: 2000, high: 3600 });
  });

  it('defaults unknown phases to phase2 multipliers', () => {
    const baseline = getPeakSalesBaseline({ indication: null, phase: '', totalDealValueMedian: 100 });
    expect(baseline).toEqual({ low: 250, median: 500, high: 900 });
  });

  it('returns null (never 0) when nothing is resolvable', () => {
    expect(getPeakSalesBaseline({ indication: null, phase: null, totalDealValueMedian: null })).toBeNull();
    expect(getPeakSalesBaseline({ indication: 'no_such_indication', phase: 'phase1', totalDealValueMedian: 0 })).toBeNull();
  });

  it('isPeakSalesOverrideSet treats all-zero / missing triples as unset', () => {
    expect(isPeakSalesOverrideSet(undefined)).toBe(false);
    expect(isPeakSalesOverrideSet(null)).toBe(false);
    expect(isPeakSalesOverrideSet({ low: 0, median: 0, high: 0 })).toBe(false);
    expect(isPeakSalesOverrideSet({ low: 0, median: 500, high: 0 })).toBe(true);
  });
});
