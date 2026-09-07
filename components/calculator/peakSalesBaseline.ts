/**
 * Peak-sales baseline shared by the two UI paths that set peak sales:
 *   - PeakSalesOverrideInput (asset step, scalar $M)
 *   - CustomAssumptionsPanel "Peak Sales" section (deal step, low/median/high)
 *
 * Both paths must show the SAME baseline and write the SAME state
 * (CalculatorFormState.peakSalesOverrideM + customAssumptions.peakSalesOverride),
 * see useCalculatorState 'SET_PEAK_SALES_OVERRIDE'.
 *
 * Baseline resolution order mirrors what the engine does when nothing is
 * overridden (lib/financial/run-financial-model.ts, buildRNPVInput):
 *   1. Indication typical asset peak (lib/financial/index-drugs.ts
 *      getIndicationTypicalAssetPeak) — the "engine default" PeakSalesOverrideInput
 *      already displays — spread with the engine's scalar-override spread.
 *   2. Phase multiple of the live totalDealValue.median (PEAK_SALES_MULTIPLIER
 *      in run-financial-model.ts, mirrored below).
 *   3. null → the UI shows "Model default: computed at calculation time", never 0.
 */
import { getIndicationTypicalAssetPeak } from '@/lib/financial/index-drugs';

export interface PeakSalesTriple {
  low: number;
  median: number;
  high: number;
}

/**
 * Spread the engine applies to a scalar peakSalesOverrideM
 * (run-financial-model.ts: low = 0.7x, high = 1.5x — EvaluatePharma-style IQR).
 * Keep in sync with lib/financial/run-financial-model.ts.
 */
export const PEAK_SALES_SCALAR_SPREAD = { low: 0.7, high: 1.5 } as const;

/**
 * Mirror of PEAK_SALES_MULTIPLIER in lib/financial/run-financial-model.ts
 * (buildRNPVInput). That constant is module-private, so it is duplicated
 * here; keep the two tables identical.
 */
export const PEAK_SALES_PHASE_MULTIPLIER: Record<string, PeakSalesTriple> = {
  discovery: { low: 8, median: 16, high: 28 },
  preclinical: { low: 6, median: 12, high: 20 },
  phase1: { low: 4, median: 8, high: 14 },
  phase1_2: { low: 3.2, median: 6.5, high: 11.5 },
  phase2: { low: 2.5, median: 5, high: 9 },
  phase2_3: { low: 2, median: 4, high: 7 },
  phase3: { low: 1.5, median: 3, high: 5 },
  nda_filed: { low: 1.2, median: 2.2, high: 3.5 },
  approved: { low: 1.0, median: 1.5, high: 2.5 },
};

/** Build the low/median/high triple the engine derives from a scalar override. */
export function tripleFromScalar(medianM: number): PeakSalesTriple {
  return {
    low: medianM * PEAK_SALES_SCALAR_SPREAD.low,
    median: medianM,
    high: medianM * PEAK_SALES_SCALAR_SPREAD.high,
  };
}

function roundTriple(t: PeakSalesTriple): PeakSalesTriple {
  return { low: Math.round(t.low), median: Math.round(t.median), high: Math.round(t.high) };
}

export interface PeakSalesBaselineArgs {
  indication?: string | null;
  phase?: string | null;
  /** Live estimate from calculateDealTerms(...).terms.totalDealValue.median ($M). */
  totalDealValueMedian?: number | null;
}

/**
 * Resolve the peak-sales baseline ($M, integers) for the current wizard state.
 * Returns null when neither an indication anchor nor a live estimate is
 * available — callers must then render "Model default: computed at
 * calculation time" rather than 0.
 */
export function getPeakSalesBaseline(args: PeakSalesBaselineArgs): PeakSalesTriple | null {
  const { indication, phase, totalDealValueMedian } = args;

  if (indication) {
    const typical = getIndicationTypicalAssetPeak(indication);
    if (typical != null && Number.isFinite(typical) && typical > 0) {
      return roundTriple(tripleFromScalar(typical));
    }
  }

  if (totalDealValueMedian != null && Number.isFinite(totalDealValueMedian) && totalDealValueMedian > 0) {
    const mult = PEAK_SALES_PHASE_MULTIPLIER[phase || ''] || PEAK_SALES_PHASE_MULTIPLIER.phase2;
    return roundTriple({
      low: totalDealValueMedian * mult.low,
      median: totalDealValueMedian * mult.median,
      high: totalDealValueMedian * mult.high,
    });
  }

  return null;
}

/** True when a persisted triple is a real override (any positive value). */
export function isPeakSalesOverrideSet(t: Partial<PeakSalesTriple> | null | undefined): t is PeakSalesTriple {
  return !!t && ((t.low ?? 0) > 0 || (t.median ?? 0) > 0 || (t.high ?? 0) > 0);
}
