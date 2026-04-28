/**
 * Weighted quantile computation for deal benchmarking.
 *
 * Used by the comparable deals selector (client-side live recalculation)
 * and the backtest corridor-clamp system (server-side aggregate metrics).
 * Shared module so both paths use identical math.
 */

export interface WeightedValue {
  value: number;
  weight: number;
}

/**
 * Compute a weighted quantile (e.g., 0.25 for p25, 0.5 for median, 0.75 for p75).
 *
 * Sorts values by ascending order, accumulates weights, and returns the first
 * value where cumulative weight >= target (q * totalWeight). Handles edge
 * cases: empty array returns 0, zero-weight entries are filtered.
 */
export function weightedQuantile(pairs: WeightedValue[], q: number): number {
  if (pairs.length === 0) return 0;
  const filtered = pairs.filter(p => p.weight > 0);
  if (filtered.length === 0) return 0;
  const sorted = [...filtered].sort((a, b) => a.value - b.value);
  const totalWeight = sorted.reduce((s, p) => s + p.weight, 0);
  const target = q * totalWeight;
  let cum = 0;
  for (const p of sorted) {
    cum += p.weight;
    if (cum >= target) return p.value;
  }
  return sorted[sorted.length - 1].value;
}

/**
 * Compute p25, median (p50), and p75 from weighted values in one pass.
 */
export function weightedPercentiles(pairs: WeightedValue[]): {
  p25: number;
  median: number;
  p75: number;
  n: number;
} {
  return {
    p25: weightedQuantile(pairs, 0.25),
    median: weightedQuantile(pairs, 0.5),
    p75: weightedQuantile(pairs, 0.75),
    n: pairs.filter(p => p.weight > 0).length,
  };
}

/**
 * Recency weight for deal-year based calibration.
 * Exponential decay with 2.5-year halflife from reference year (default 2026).
 *
 * Duplicated from lib/financial/calibration.ts for client-side use
 * (calibration.ts imports server-only modules). Values:
 *   2026 → 1.00, 2025 → 0.76, 2024 → 0.57, 2023 → 0.43, 2022 → 0.33
 */
export function recencyWeight(
  dealYear: number,
  referenceYear: number = 2026,
  halflifeYears: number = 2.5,
): number {
  const yearsAgo = Math.max(0, referenceYear - dealYear);
  return Math.pow(0.5, yearsAgo / halflifeYears);
}
