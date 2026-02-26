/**
 * Monte Carlo simulation engine for pharma deal rNPV analysis.
 *
 * Runs 10,000 iterations varying key parameters (PoS, peak sales,
 * discount rate, time-to-market, pricing) around user-supplied base
 * values and returns a comprehensive statistical summary.
 *
 * Pure TypeScript — zero external dependencies.  Designed to run
 * synchronously in < 500 ms for 10K iterations (no Web Workers).
 */

import type { MonteCarloInput, MonteCarloResult, RNPVInput } from './types';
import {
  seedableRandom,
  sampleNormal,
  sampleTriangular,
  sampleBeta,
  sampleLognormal,
  percentile,
  buildHistogram,
} from './distributions';

// Import PoS tables and discount rates for parameter variation
import {
  POS_BY_THERAPEUTIC_AREA,
  POS_MODALITY_ADJUSTMENT,
  PHASE_DURATION,
  REVENUE_CURVE,
  getCumulativePoS,
} from './pos-tables';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ITERATIONS = 10_000;
const HISTOGRAM_BINS = 30;
const DEFAULT_DISCOUNT_RATE = 0.11; // 11 % WACC — mid-range for biotech
const DEFAULT_SEED = 42;

/** Ordered list of clinical phases used for rNPV progression. */
const PHASE_ORDER = [
  'preclinical',
  'phase1',
  'phase2',
  'phase3',
  'approval',
] as const;

type ClinicalPhase = (typeof PHASE_ORDER)[number];

/**
 * Human-readable labels for the five sampled drivers.
 * Used in the `keyDriverSensitivity` output for chart display.
 */
const DRIVER_LABELS: Record<string, string> = {
  probabilityOfSuccess: 'Probability of Success',
  peakSales: 'Peak Sales ($M)',
  discountRate: 'Discount Rate (WACC)',
  timeToMarket: 'Time to Market (Years)',
  pricing: 'Pricing Multiplier',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map the Phase type from calculations.ts ('preclinical' | 'phase1' | … |
 * 'approved') to our internal phase index.  'approved' is treated as
 * equivalent to 'approval' (index 4).
 */
function phaseIndex(phase: string): number {
  if (phase === 'approved') return PHASE_ORDER.indexOf('approval');
  const idx = PHASE_ORDER.indexOf(phase as ClinicalPhase);
  return idx >= 0 ? idx : 0;
}

/**
 * Derive lognormal parameters (mu, sigma) from a desired *median* and
 * a coefficient of variation (CV) expressed as a fraction.
 *
 * For a lognormal distribution:
 *   median = exp(mu)        →  mu = ln(median)
 *   CV² = exp(sigma²) - 1   →  sigma = sqrt(ln(1 + CV²))
 */
function lognormalParams(
  median: number,
  cv: number,
): { mu: number; sigma: number } {
  const mu = Math.log(Math.max(median, 1e-6));
  const sigma = Math.sqrt(Math.log(1 + cv * cv));
  return { mu, sigma };
}

/**
 * Derive Beta distribution parameters (alpha, beta) from a desired mean
 * probability and a variation fraction that controls spread.
 *
 * mean = alpha / (alpha + beta)
 * kappa = alpha + beta   (controls variance — higher = tighter)
 *
 * We map variation [0, 1] → kappa [500, 4] on a log scale so that
 * small variation fractions produce very tight distributions and large
 * ones produce wide, uncertain distributions.
 */
function betaParams(
  mean: number,
  variationFraction: number,
): { alpha: number; beta: number } {
  const m = Math.max(0.001, Math.min(0.999, mean));

  const clampedVar = Math.max(0.001, Math.min(1, variationFraction));
  const kappa = Math.exp(
    Math.log(500) + (Math.log(4) - Math.log(500)) * clampedVar,
  );

  return {
    alpha: m * kappa,
    beta: (1 - m) * kappa,
  };
}

/**
 * Compute the simplified risk-adjusted NPV for a single simulation
 * iteration.
 *
 * Steps:
 *   1. Use the sampled cumulative PoS directly.
 *   2. Sum remaining phase durations and apply the sampled time shift.
 *   3. Project revenues over the standard pharma S-curve using sampled
 *      peak sales and pricing multiplier.
 *   4. Discount all future cash flows at the sampled discount rate.
 *   5. Subtract present-valued development costs.
 *   6. Return rNPV = PoS * discounted revenue - discounted costs.
 */
function computeIterationRNPV(
  input: RNPVInput,
  sampledPoS: number,
  sampledPeakSales: number,
  sampledDiscountRate: number,
  sampledTimeShift: number,
  sampledPricingMultiplier: number,
): number {
  const startIdx = phaseIndex(input.phase);

  // --- 1. Cumulative probability of reaching approval ------------------
  const cumulativePoS = Math.max(0, Math.min(1, sampledPoS));

  // --- 2. Time to market -----------------------------------------------
  // Sum remaining phase durations from pos-tables, then apply shift.
  const taDurations = PHASE_DURATION[input.therapeuticArea] ?? PHASE_DURATION.oncology;
  let totalYearsToMarket = 0;
  for (let i = startIdx; i < PHASE_ORDER.length - 1; i++) {
    const phaseKey = PHASE_ORDER[i];
    const duration = (taDurations as Record<string, number>)[phaseKey] ?? 1.5;
    totalYearsToMarket += duration;
  }
  // Add regulatory review time
  totalYearsToMarket += (taDurations as Record<string, number>)['regulatory'] ?? 1.0;
  totalYearsToMarket = Math.max(0.5, totalYearsToMarket + sampledTimeShift);

  // --- 3. Project revenues using the standard pharma S-curve -----------
  // Use the shared REVENUE_CURVE lifecycle parameters to build year-by-year fractions
  const { rampUpYears, peakDurationYears, declineRate, loeYearsAfterApproval } = REVENUE_CURVE;
  const totalRevenueYears = loeYearsAfterApproval + 3; // +3 for post-LOE tail

  let discountedRevenue = 0;
  const r = Math.max(0.01, sampledDiscountRate); // floor at 1 %

  for (let yr = 0; yr < totalRevenueYears; yr++) {
    const yearFromNow = totalYearsToMarket + yr + 1;
    // S-curve ramp then peak then decline
    let revFraction: number;
    if (yr < rampUpYears) {
      const t = yr / rampUpYears;
      revFraction = 3 * t * t - 2 * t * t * t; // cubic ease-in-out
    } else if (yr < rampUpYears + peakDurationYears) {
      revFraction = 1.0;
    } else if (yr < loeYearsAfterApproval) {
      revFraction = Math.pow(1 - declineRate, yr - rampUpYears - peakDurationYears);
    } else {
      revFraction = 0.20 * Math.pow(0.85, yr - loeYearsAfterApproval); // post-LOE tail
    }
    const annualRevenue = sampledPeakSales * revFraction * sampledPricingMultiplier;
    const discountFactor = 1 / Math.pow(1 + r, yearFromNow);
    discountedRevenue += annualRevenue * discountFactor;
  }

  // --- 4. Development costs (simple present-value estimate) ------------
  // We estimate remaining dev costs from remaining phases.  If the
  // pos-tables export per-phase costs in the future we can use those;
  // for now we use a heuristic based on phase and therapeutic area.
  // The costs are spread evenly across remaining years and discounted.
  const estimatedRemainingCosts = estimateRemainingDevCosts(
    input.therapeuticArea,
    startIdx,
  );
  let discountedCosts = 0;
  if (estimatedRemainingCosts > 0 && totalYearsToMarket > 0) {
    const yearsRemaining = Math.max(1, Math.ceil(totalYearsToMarket));
    const annualCost = estimatedRemainingCosts / yearsRemaining;
    for (let yr = 1; yr <= yearsRemaining; yr++) {
      discountedCosts += annualCost / Math.pow(1 + r, yr);
    }
  }

  // --- 5. rNPV = PoS x discounted revenue - discounted costs -----------
  return cumulativePoS * discountedRevenue - discountedCosts;
}

/**
 * Rough estimate of remaining development costs ($M) from the current
 * phase to approval.  These are order-of-magnitude figures drawn from
 * published pharma R&D cost studies (DiMasi et al., Tufts CSDD).
 */
function estimateRemainingDevCosts(
  therapeuticArea: string,
  startPhaseIdx: number,
): number {
  // Per-phase cost assumptions ($M) — intentionally conservative
  const phaseCosts: Record<string, number[]> = {
    // [preclinical, phase1, phase2, phase3, approval(regulatory)]
    oncology: [15, 30, 60, 150, 10],
    neurology: [15, 25, 55, 180, 12],
    immunology: [12, 25, 50, 140, 10],
    metabolic: [12, 25, 55, 160, 10],
    cardiovascular: [12, 25, 60, 200, 12],
    infectiousDisease: [10, 20, 45, 120, 8],
    ophthalmology: [10, 20, 40, 100, 8],
    womensHealth: [10, 20, 40, 110, 8],
  };

  const costs = phaseCosts[therapeuticArea] ?? phaseCosts['oncology'];
  let total = 0;
  for (let i = startPhaseIdx; i < costs.length; i++) {
    total += costs[i];
  }
  return total;
}

/**
 * Pearson correlation coefficient between two equal-length arrays.
 * Returns a value in [-1, 1].  Returns 0 when either array has zero
 * variance (constant values).
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denomX = n * sumX2 - sumX * sumX;
  const denomY = n * sumY2 - sumY * sumY;
  const denominator = Math.sqrt(denomX * denomY);

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Fisher-Pearson coefficient of skewness.
 * skewness = (1/n) * Sum[(xi - mean)^3] / stdDev^3
 */
function computeSkewness(
  values: number[],
  mean: number,
  stdDev: number,
): number {
  if (stdDev === 0 || values.length === 0) return 0;
  const n = values.length;
  let sumCubed = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i] - mean;
    sumCubed += d * d * d;
  }
  return sumCubed / (n * stdDev * stdDev * stdDev);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a Monte Carlo simulation for pharma deal rNPV analysis.
 *
 * @param input - Simulation parameters (base rNPV inputs + variation ranges).
 * @param seed  - Optional PRNG seed for reproducibility (default: 42).
 * @returns A MonteCarloResult with percentiles, histogram, confidence
 *          intervals, and driver sensitivity correlations.
 */
export function runMonteCarlo(
  input: MonteCarloInput,
  seed: number = DEFAULT_SEED,
): MonteCarloResult {
  const iterations = input.iterations ?? DEFAULT_ITERATIONS;
  const rng = seedableRandom(seed);
  const rnpv = input.rnpvInput;

  // ----- Prepare distribution parameters --------------------------------

  // 1. PoS: beta distribution centred on base cumulative PoS
  const posResult = getCumulativePoS(
    rnpv.phase,
    rnpv.therapeuticArea,
    rnpv.modality,
    'unselected',
    rnpv.regulatoryDesignations,
  );
  const basePoS = posResult.cumulativePoS;
  const { alpha: posAlpha, beta: posBeta } = betaParams(
    basePoS,
    input.posVariation ?? 0.20,
  );

  // 2. Peak sales: lognormal centred on the user-supplied median
  const basePeakSales = rnpv.peakSalesEstimate.median;
  const peakSalesCV = input.peakSalesVariation ?? 0.30;
  const { mu: psMu, sigma: psSigma } = lognormalParams(
    basePeakSales,
    peakSalesCV,
  );

  // 3. Discount rate: normal centred on base rate
  const baseRate = rnpv.discountRate ?? DEFAULT_DISCOUNT_RATE;
  const rateStdDev = input.discountRateVariation ?? 0.02; // absolute pp

  // 4. Time-to-market: triangular shift (years earlier / later)
  const ttmShift = input.timeToMarketVariation ?? 1.0; // +/- years
  const ttmMin = -ttmShift;
  const ttmMode = 0;
  const ttmMax = ttmShift;

  // 5. Pricing multiplier: normal centred on 1.0
  const pricingStdDev = input.pricingVariation ?? 0.15;

  // ----- Run iterations -------------------------------------------------

  const npvResults = new Float64Array(iterations);

  // Per-iteration sampled parameter vectors (for correlation analysis)
  const sampledPoSArr = new Float64Array(iterations);
  const sampledPeakArr = new Float64Array(iterations);
  const sampledRateArr = new Float64Array(iterations);
  const sampledTimeArr = new Float64Array(iterations);
  const sampledPriceArr = new Float64Array(iterations);

  for (let i = 0; i < iterations; i++) {
    // Sample parameters
    const sPoS = sampleBeta(posAlpha, posBeta, rng);
    const sPeak = sampleLognormal(psMu, psSigma, rng);
    const sRate = Math.max(0.01, sampleNormal(baseRate, rateStdDev, rng));
    const sTime = sampleTriangular(ttmMin, ttmMode, ttmMax, rng);
    const sPrice = Math.max(0.1, sampleNormal(1.0, pricingStdDev, rng));

    // Store for correlation
    sampledPoSArr[i] = sPoS;
    sampledPeakArr[i] = sPeak;
    sampledRateArr[i] = sRate;
    sampledTimeArr[i] = sTime;
    sampledPriceArr[i] = sPrice;

    // Compute rNPV
    npvResults[i] = computeIterationRNPV(
      rnpv,
      sPoS,
      sPeak,
      sRate,
      sTime,
      sPrice,
    );
  }

  // ----- Sort and compute statistics ------------------------------------

  const sorted = new Float64Array(npvResults);
  sorted.sort();
  const sortedArr = Array.from(sorted);

  // Mean and standard deviation (single-pass)
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < iterations; i++) {
    sum += npvResults[i];
    sumSq += npvResults[i] * npvResults[i];
  }
  const mean = sum / iterations;
  const variance = sumSq / iterations - mean * mean;
  const stdDev = Math.sqrt(Math.max(0, variance));

  // Percentiles
  const p2_5 = percentile(sortedArr, 2.5);
  const p5 = percentile(sortedArr, 5);
  const p10 = percentile(sortedArr, 10);
  const p25 = percentile(sortedArr, 25);
  const p50 = percentile(sortedArr, 50);
  const p75 = percentile(sortedArr, 75);
  const p90 = percentile(sortedArr, 90);
  const p95 = percentile(sortedArr, 95);
  const p97_5 = percentile(sortedArr, 97.5);

  // ----- Histogram (with percentage per bin) ----------------------------

  const rawValues = Array.from(npvResults);
  const rawHistogram = buildHistogram(rawValues, HISTOGRAM_BINS);
  const histogram = rawHistogram.map((bin) => ({
    binStart: bin.binStart,
    binEnd: bin.binEnd,
    count: bin.count,
    percentage: (bin.count / iterations) * 100,
  }));

  // ----- Key driver sensitivity (Pearson correlations) -------------------

  const npvArr = Array.from(npvResults);
  const posCorr = pearsonCorrelation(Array.from(sampledPoSArr), npvArr);
  const peakCorr = pearsonCorrelation(Array.from(sampledPeakArr), npvArr);
  const rateCorr = pearsonCorrelation(Array.from(sampledRateArr), npvArr);
  const timeCorr = pearsonCorrelation(Array.from(sampledTimeArr), npvArr);
  const priceCorr = pearsonCorrelation(Array.from(sampledPriceArr), npvArr);

  const keyDriverSensitivity = [
    {
      parameter: 'probabilityOfSuccess',
      correlationWithNPV: posCorr,
      label: DRIVER_LABELS['probabilityOfSuccess'],
    },
    {
      parameter: 'peakSales',
      correlationWithNPV: peakCorr,
      label: DRIVER_LABELS['peakSales'],
    },
    {
      parameter: 'discountRate',
      correlationWithNPV: rateCorr,
      label: DRIVER_LABELS['discountRate'],
    },
    {
      parameter: 'timeToMarket',
      correlationWithNPV: timeCorr,
      label: DRIVER_LABELS['timeToMarket'],
    },
    {
      parameter: 'pricing',
      correlationWithNPV: priceCorr,
      label: DRIVER_LABELS['pricing'],
    },
  ].sort(
    (a, b) =>
      Math.abs(b.correlationWithNPV) - Math.abs(a.correlationWithNPV),
  );

  // ----- Probability metrics --------------------------------------------

  let countPositive = 0;
  for (let i = 0; i < iterations; i++) {
    if (npvResults[i] > 0) countPositive++;
  }
  const probabilityOfPositiveNPV = countPositive / iterations;

  // ----- Assemble result ------------------------------------------------

  return {
    iterations,

    percentiles: {
      p5,
      p10,
      p25,
      p50,
      p75,
      p90,
      p95,
    },

    mean,
    stdDev,

    histogram,

    confidenceInterval95: { low: p2_5, high: p97_5 },
    confidenceInterval80: { low: p10, high: p90 },

    probabilityOfPositiveNPV,

    keyDriverSensitivity,
  };
}
