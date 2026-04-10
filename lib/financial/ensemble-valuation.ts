/**
 * Ensemble Valuation Engine (Item 7 — Tier 3 Engine Grade A+)
 *
 * Blends three independent valuation methods using inverse-variance weighting:
 *
 *   1. rNPV — risk-adjusted DCF from `lib/financial/rnpv-engine.ts`
 *   2. Comparable Transactions — median of historical disclosed deals filtered
 *      by therapeutic area + modality + phase ±1, from `lib/comparableDeals.ts`
 *   3. Real Options — compound CRR lattice from `lib/financial/advanced-upgrades.ts`
 *
 * The blend formula:
 *
 *   ensembleNPV = Σ(value_i × 1/var_i) / Σ(1/var_i)
 *   ensembleStdDev = sqrt(1 / Σ(1/var_i))
 *
 * Variance sources (each method derives its own uncertainty estimate so the
 * weighting is fair — no method gets to set its own weight):
 *
 *   - rNPV variance: derived from Monte Carlo P10/P90 spread, same lognormal
 *     inversion the real-options module uses (advanced-upgrades.ts:728-735).
 *   - Comparables variance: sample variance of the matched group's totalValueM.
 *   - Real options variance: scaled version of the underlying MC variance,
 *     reflecting that the lattice already smooths via volatility.
 *
 * Graceful degradation: if any method has Infinity variance (e.g., comparables
 * with sample size < 3 even after widening), it is excluded from the blend
 * and the remaining methods are renormalized. The result still surfaces but
 * `fallbackUsed` is set true.
 *
 * @module lib/financial/ensemble-valuation
 */

import type {
  RNPVInput,
  RNPVResult,
  MonteCarloResult,
  RealOptionsResult,
  EnsembleMethod,
  EnsembleResult,
} from './types';
import { COMPARABLE_DEALS, type ComparableDeal } from '@/lib/comparableDeals';
import { normalizePhaseForDB, phaseWindowDB } from './deal-type-normalization';

// ---------------------------------------------------------------------------
// Tunable constants
// ---------------------------------------------------------------------------

/** Minimum comparable sample size for the strict TA + modality + phase filter */
const STRICT_FILTER_MIN_N = 5;
/** Minimum sample size for the level-1 widened filter (TA + phase ±1) */
const LEVEL1_WIDEN_MIN_N = 3;
/** Minimum sample size for the level-2 widened filter (TA only) */
const LEVEL2_WIDEN_MIN_N = 3;

/** Phase window radius — ±1 phase by default. */
const PHASE_WINDOW = 1;

/** Floor variance to avoid divide-by-zero on degenerate methods (small but finite) */
const MIN_VARIANCE = 1; // $M²

// ---------------------------------------------------------------------------
// Comparable transactions method
// ---------------------------------------------------------------------------

interface ComparableMethodResult {
  value: number;
  variance: number;
  sampleSize: number;
  widenLevel: 0 | 1 | 2;
  matchedDeals: ComparableDeal[];
}

/**
 * Filter comparables by TA + modality + phase ±1, widening progressively
 * until the sample is large enough or we run out of widening levels.
 *
 * Comparables with `phase` undefined are treated as wildcard matches (kept
 * in every filter level) — this addresses Bug C from the plan, where many
 * historical deals lack a phase tag.
 */
function computeComparableMethod(
  rnpvInput: RNPVInput,
  comparableDeals: ComparableDeal[],
): ComparableMethodResult {
  const targetTA = rnpvInput.therapeuticArea;
  const targetModality = rnpvInput.modality;
  const targetDBPhase = normalizePhaseForDB(rnpvInput.phase);
  const phaseWindow = new Set(phaseWindowDB(targetDBPhase, PHASE_WINDOW));

  /** Match by phase: compound calculator phases collapse to DB form before comparing. */
  const matchesPhase = (d: ComparableDeal): boolean => {
    if (!d.phase) return true; // missing phase → wildcard (Bug C fix)
    const dbPhase = normalizePhaseForDB(d.phase);
    return phaseWindow.has(dbPhase);
  };

  /** Match by TA: includes secondaryTAs to widen coverage of cross-TA assets. */
  const matchesTA = (d: ComparableDeal): boolean => {
    if (d.therapeuticArea === targetTA) return true;
    if (d.secondaryTAs?.includes(targetTA)) return true;
    return false;
  };

  /** Match by modality: any overlap with the target modality. */
  const matchesModality = (d: ComparableDeal): boolean => {
    if (!d.modalities || d.modalities.length === 0) return true; // wildcard
    return d.modalities.includes(targetModality);
  };

  /** Has a usable totalValueM. */
  const hasValue = (d: ComparableDeal): boolean =>
    typeof d.totalValueM === 'number' && Number.isFinite(d.totalValueM) && d.totalValueM > 0;

  // Level 0: TA + modality + phase ±1
  const level0 = comparableDeals.filter(
    d => hasValue(d) && matchesTA(d) && matchesModality(d) && matchesPhase(d),
  );
  if (level0.length >= STRICT_FILTER_MIN_N) {
    return buildResult(level0, 0);
  }

  // Level 1: TA + phase ±1 (drop modality)
  const level1 = comparableDeals.filter(
    d => hasValue(d) && matchesTA(d) && matchesPhase(d),
  );
  if (level1.length >= LEVEL1_WIDEN_MIN_N) {
    return buildResult(level1, 1);
  }

  // Level 2: TA only
  const level2 = comparableDeals.filter(d => hasValue(d) && matchesTA(d));
  if (level2.length >= LEVEL2_WIDEN_MIN_N) {
    return buildResult(level2, 2);
  }

  // No usable comparables → return Infinity variance so the ensemble drops it
  return {
    value: 0,
    variance: Number.POSITIVE_INFINITY,
    sampleSize: level2.length,
    widenLevel: 2,
    matchedDeals: [],
  };
}

function buildResult(deals: ComparableDeal[], widenLevel: 0 | 1 | 2): ComparableMethodResult {
  const values = deals.map(d => d.totalValueM as number).sort((a, b) => a - b);
  const median = computeMedian(values);
  const variance = sampleVariance(values);
  // Floor variance: a tiny sample can have stddev = 0 by accident
  const safeVariance = Math.max(variance, MIN_VARIANCE);
  return {
    value: median,
    variance: safeVariance,
    sampleSize: deals.length,
    widenLevel,
    matchedDeals: deals,
  };
}

function computeMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function sampleVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map(v => (v - mean) ** 2);
  return sqDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);
}

// ---------------------------------------------------------------------------
// rNPV variance from Monte Carlo
// ---------------------------------------------------------------------------

/**
 * Derive an rNPV variance estimate from the Monte Carlo distribution.
 *
 * The MC engine already produces a stdDev field; we square it to get variance.
 * As a fallback (when stdDev is missing or zero), we invert the lognormal
 * P10/P90 spread the same way the real-options module does.
 */
function computeRnpvVariance(rnpv: RNPVResult, monteCarlo: MonteCarloResult): number {
  if (Number.isFinite(monteCarlo.stdDev) && monteCarlo.stdDev > 0) {
    return Math.max(monteCarlo.stdDev ** 2, MIN_VARIANCE);
  }
  // Fallback: lognormal spread inversion. Mirrors advanced-upgrades.ts:728-735.
  const p10 = monteCarlo.percentiles?.p10 ?? 0;
  const p90 = monteCarlo.percentiles?.p90 ?? 0;
  if (p10 > 0 && p90 > p10) {
    const sigma = Math.log(p90 / p10) / (2 * 1.645);
    // Convert lognormal sigma to dollar variance via base value
    const base = Math.max(rnpv.riskAdjustedNPV, 1);
    const dollarStdDev = base * sigma;
    return Math.max(dollarStdDev ** 2, MIN_VARIANCE);
  }
  // Last resort: assume CV = 0.40 (typical for early-stage pharma)
  const base = Math.max(rnpv.riskAdjustedNPV, 1);
  return Math.max((base * 0.40) ** 2, MIN_VARIANCE);
}

// ---------------------------------------------------------------------------
// Real options variance
// ---------------------------------------------------------------------------

/**
 * Real options variance is derived from the implied volatility used in the
 * lattice (advanced-upgrades.ts:747). We convert volatility to a dollar
 * stdDev via the option value, then square.
 *
 * Real options variance is intentionally scaled DOWN by 0.7 relative to the
 * raw rNPV variance because the lattice has already absorbed some uncertainty
 * through its volatility input — counting it twice would over-penalize.
 */
function computeRealOptionsVariance(realOptions: RealOptionsResult): number {
  const sigma = Math.max(realOptions.volatilityUsed ?? 0.5, 0.1);
  const base = Math.max(realOptions.totalOptionValue, 1);
  // Annualized volatility → 1-year dollar stdDev (conservative, no time-to-expiry adjustment)
  const dollarStdDev = base * sigma * 0.7;
  return Math.max(dollarStdDev ** 2, MIN_VARIANCE);
}

// ---------------------------------------------------------------------------
// Inverse-variance weighting
// ---------------------------------------------------------------------------

/**
 * Compute inverse-variance weights, gracefully handling Infinity (degenerate
 * methods that should be excluded). If all variances are Infinity, falls
 * back to equal weights.
 */
function inverseVarianceWeights(variances: number[]): number[] {
  const invVars = variances.map(v =>
    Number.isFinite(v) && v > 0 ? 1 / v : 0,
  );
  const sumInv = invVars.reduce((a, b) => a + b, 0);
  if (sumInv === 0) {
    return variances.map(() => 1 / variances.length);
  }
  return invVars.map(iv => iv / sumInv);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the three-method ensemble valuation.
 *
 * @param rnpv          - Result from `calculateRNPV()`
 * @param monteCarlo    - Result from `runMonteCarlo({ rnpvInput })`
 * @param realOptions   - Result from `calculateRealOptions(rnpvInput, rnpv, monteCarlo)`
 * @param rnpvInput     - The original `RNPVInput` (used for comparable filter)
 * @param comparableDeals - Comparable deal universe (defaults to COMPARABLE_DEALS)
 * @returns EnsembleResult with the blended value, per-method weights, and narrative
 */
export function calculateEnsembleValuation(
  rnpv: RNPVResult,
  monteCarlo: MonteCarloResult,
  realOptions: RealOptionsResult,
  rnpvInput: RNPVInput,
  comparableDeals: ComparableDeal[] = COMPARABLE_DEALS,
): EnsembleResult {
  // ── 1. Compute each method's central value ──
  // For rNPV we use the implied total deal value (not raw NPV) so all three
  // methods are denominated in the same units ($M of deal value).
  const rnpvValue = rnpv.impliedDealValue?.totalDeal?.median
    ?? rnpv.riskAdjustedNPV;
  const realOptionsValue = realOptions.totalOptionValue;

  const compResult = computeComparableMethod(rnpvInput, comparableDeals);
  const compValue = compResult.value;

  // ── 2. Compute each method's variance ──
  const rnpvVariance = computeRnpvVariance(rnpv, monteCarlo);
  const compVariance = compResult.variance;
  const realOptionsVariance = computeRealOptionsVariance(realOptions);

  // ── 3. Inverse-variance weighting ──
  const variances = [rnpvVariance, compVariance, realOptionsVariance];
  const weights = inverseVarianceWeights(variances);
  const values = [rnpvValue, compValue, realOptionsValue];

  // Drop methods with weight 0 (Infinity variance) from the value sum
  let ensembleValue = 0;
  for (let i = 0; i < values.length; i++) {
    ensembleValue += values[i] * weights[i];
  }

  // Ensemble stdDev: sqrt(1 / Σ(1/var_i)) — only for finite variances
  const finiteInvVars = variances
    .filter(v => Number.isFinite(v) && v > 0)
    .map(v => 1 / v);
  const sumFiniteInvVars = finiteInvVars.reduce((a, b) => a + b, 0);
  const ensembleStdDev = sumFiniteInvVars > 0 ? Math.sqrt(1 / sumFiniteInvVars) : 0;

  // ── 4. Build the EnsembleMethod objects with rationales ──
  const fallbackUsed = compResult.widenLevel > 0 || !Number.isFinite(compVariance);

  const methods: EnsembleMethod[] = [
    {
      name: 'rNPV',
      value: rnpvValue,
      variance: rnpvVariance,
      weight: weights[0],
      confidence: variances[0] < (rnpvValue * 0.5) ** 2 ? 'high' : 'medium',
      rationale: `Risk-adjusted DCF from the rNPV engine (${(rnpv.cumulativePoS * 100).toFixed(0)}% cumulative PoS, ${(rnpv.discountRate * 100).toFixed(1)}% discount rate). Variance derived from Monte Carlo P10/P90 spread.`,
    },
    {
      name: 'Comparable Transactions',
      value: compValue,
      variance: compVariance,
      weight: weights[1],
      sampleSize: compResult.sampleSize,
      confidence:
        compResult.widenLevel === 0 ? 'high'
          : compResult.widenLevel === 1 ? 'medium'
            : 'low',
      rationale:
        compResult.matchedDeals.length === 0
          ? `No comparable deals found for ${rnpvInput.therapeuticArea} / ${rnpvInput.modality} / ${rnpvInput.phase}. This method excluded from the blend.`
          : `Median of ${compResult.sampleSize} disclosed deals${
              compResult.widenLevel === 0
                ? ` matched on TA + modality + phase ±1`
                : compResult.widenLevel === 1
                  ? ` matched on TA + phase ±1 (modality widened)`
                  : ` matched on TA only (modality and phase widened)`
            }. Variance is the sample variance of the matched group.`,
    },
    {
      name: 'Real Options',
      value: realOptionsValue,
      variance: realOptionsVariance,
      weight: weights[2],
      confidence: realOptions.underlyingFlooredToZero ? 'low' : 'medium',
      rationale: `Compound CRR binomial lattice with ${(realOptions.volatilityUsed * 100).toFixed(0)}% implied volatility across ${realOptions.optionValueByPhase.length} remaining development gates.`,
    },
  ];

  // ── 5. Spread + agreement classification ──
  const finiteValues = methods
    .filter(m => Number.isFinite(m.variance))
    .map(m => m.value);
  const spread = finiteValues.length > 0
    ? Math.max(...finiteValues) - Math.min(...finiteValues)
    : 0;
  const median = ensembleValue !== 0 ? ensembleValue : 1;
  const spreadRatio = Math.abs(spread / median);
  const agreement: 'tight' | 'moderate' | 'wide' =
    spreadRatio < 0.20 ? 'tight'
      : spreadRatio < 0.50 ? 'moderate'
        : 'wide';

  // ── 6. Narrative ──
  const narrative = buildEnsembleNarrative(
    ensembleValue,
    methods,
    agreement,
    fallbackUsed,
  );

  return {
    ensembleValue,
    ensembleStdDev,
    methods,
    spread,
    agreement,
    fallbackUsed,
    narrative,
  };
}

function buildEnsembleNarrative(
  ensembleValue: number,
  methods: EnsembleMethod[],
  agreement: 'tight' | 'moderate' | 'wide',
  fallbackUsed: boolean,
): string {
  const dominant = [...methods]
    .sort((a, b) => b.weight - a.weight)
    .find(m => m.weight > 0);
  const dominantName = dominant?.name ?? 'rNPV';
  const dominantWeight = dominant ? (dominant.weight * 100).toFixed(0) : '33';

  const agreementCopy = {
    tight: 'All three methods converge tightly — high confidence in the headline.',
    moderate: 'Methods show moderate divergence — review the comparable filter and PoS assumptions.',
    wide: 'Wide spread across methods — assumptions may need a second look. Inspect the dominant driver.',
  }[agreement];

  const fallbackNote = fallbackUsed
    ? ' Comparable transactions matched a widened group — sample size is limited.'
    : '';

  return `Ensemble valuation: $${formatM(ensembleValue)}. ${dominantName} carries the highest weight (${dominantWeight}%) due to its lowest variance. ${agreementCopy}${fallbackNote}`;
}

function formatM(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}B`;
  return `${Math.round(value)}M`;
}

// ---------------------------------------------------------------------------
// Internal exports for testing
// ---------------------------------------------------------------------------

/** @internal exposed only for unit tests */
export const __test = {
  computeComparableMethod,
  computeRnpvVariance,
  computeRealOptionsVariance,
  inverseVarianceWeights,
  computeMedian,
  sampleVariance,
};
