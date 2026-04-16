/**
 * R71 — Indication-level hard ceilings for predicted deal terms.
 *
 * Computed offline from the verified deals corpus (see
 * scripts/compute-indication-ceilings.ts). The engine applies these as
 * P90 ceilings on predicted upfront and TDV, falling back from indication
 * → TA if the indication-specific cohort is sparse (n<3).
 *
 * Why: post-R67 multiplier-math fixes correctly bounded stacking, but the
 * engine still over-predicted for indications with weak historical deal
 * track records (DNA vaccines for RRP, post-bust gene therapy, etc.).
 * The multiplier doesn't know that certain indications have never closed
 * a deal above $X — the corpus does.
 *
 * This is ENGINE-LEVEL CALIBRATION, not calculator-UI gating. The ceiling
 * clamps predicted output after all multipliers + PoS adjustments.
 */

import ceilingsData from '@/data/indication-deal-ceilings.json';

interface CeilingEntry {
  p90Upfront: number;
  p90TDV: number;
  medianUpfront: number;
  medianTDV: number;
  n: number;
}

const MIN_COHORT_SIZE = 3; // below this, fall back to TA-level ceiling
const CEILING_SAFETY_MARGIN = 1.15; // clamp at 115% of P90 — allows for outlier premium

export interface CeilingClamp {
  applied: boolean;
  source: 'indication' | 'ta' | 'none';
  n: number;
  ceilingUpfront: number | null;
  ceilingTDV: number | null;
  reason?: string;
}

/**
 * Look up the ceiling for an (indication, phase, dealType) triple.
 * Returns null if no ceiling data exists (engine should NOT clamp).
 */
export function getCeiling(
  indication: string,
  phase: string,
  dealType: string,
  therapeuticArea?: string,
): CeilingClamp {
  const byIndication = (ceilingsData as any).byIndication as Record<string, CeilingEntry>;
  const byTA = (ceilingsData as any).byTA as Record<string, CeilingEntry>;

  const indKey = `${indication}::${phase}::${dealType}`;
  const indEntry = byIndication?.[indKey];
  if (indEntry && indEntry.n >= MIN_COHORT_SIZE) {
    return {
      applied: true,
      source: 'indication',
      n: indEntry.n,
      ceilingUpfront: Math.round(indEntry.p90Upfront * CEILING_SAFETY_MARGIN),
      ceilingTDV: Math.round(indEntry.p90TDV * CEILING_SAFETY_MARGIN),
      reason: `n=${indEntry.n} ${indication}/${phase}/${dealType} deals in corpus`,
    };
  }

  if (therapeuticArea) {
    const taKey = `${therapeuticArea}::${phase}::${dealType}`;
    const taEntry = byTA?.[taKey];
    if (taEntry && taEntry.n >= MIN_COHORT_SIZE) {
      return {
        applied: true,
        source: 'ta',
        n: taEntry.n,
        ceilingUpfront: Math.round(taEntry.p90Upfront * CEILING_SAFETY_MARGIN),
        ceilingTDV: Math.round(taEntry.p90TDV * CEILING_SAFETY_MARGIN),
        reason: `indication n=${indEntry?.n ?? 0} below min (${MIN_COHORT_SIZE}); fell back to ${therapeuticArea}/${phase}/${dealType} (n=${taEntry.n})`,
      };
    }
  }

  return { applied: false, source: 'none', n: 0, ceilingUpfront: null, ceilingTDV: null, reason: 'no cohort data — no clamp' };
}

/**
 * Apply ceiling clamp to a range prediction. Returns capped range + diagnostic.
 */
export function clampRange(
  prediction: { low: number; median: number; high: number },
  ceiling: number | null,
): { low: number; median: number; high: number; clamped: boolean } {
  if (ceiling == null) return { ...prediction, clamped: false };
  const clampedHigh = Math.min(prediction.high, ceiling);
  const clampedMedian = Math.min(prediction.median, ceiling * 0.85); // median at ~85% of ceiling max
  const clampedLow = Math.min(prediction.low, ceiling * 0.55);
  const clamped = clampedHigh < prediction.high;
  return {
    low: clampedLow,
    median: clampedMedian,
    high: clampedHigh,
    clamped,
  };
}
