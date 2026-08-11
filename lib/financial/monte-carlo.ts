/**
 * Monte Carlo simulation engine for pharma deal rNPV analysis.
 *
 * Runs 10,000 iterations varying key parameters (PoS, peak sales,
 * discount rate, time-to-market, pricing) around user-supplied base
 * values and returns a comprehensive statistical summary.
 *
 * Key feature: parameters are sampled with **correlated noise** via
 * Cholesky decomposition of an empirical correlation matrix.  This
 * captures real-world dependencies between variables (e.g., higher PoS
 * correlating with lower discount rates and larger peak sales).
 *
 * Correlation sources:
 *   - DealForma pharma licensing database (2020-2025)
 *   - Lo & Pisani (2015), Wong, Siah & Lo (2019) — clinical trial analytics
 *   - Golub & Van Loan, Matrix Computations — Cholesky algorithm
 *
 * Pure TypeScript — zero external dependencies.  Designed to run
 * synchronously in < 500 ms for 10K iterations (no Web Workers).
 */

import type { MonteCarloInput, MonteCarloResult, RNPVInput } from './types';
import {
  seedableRandom,
  sampleNormal,
  percentile,
  buildHistogram,
} from './distributions';

// Import PoS tables and discount rates for parameter variation
import {
  POS_BY_THERAPEUTIC_AREA,
  POS_MODALITY_ADJUSTMENT,
  PHASE_DURATION,
  PHASE_COSTS,
  REVENUE_CURVE,
  getCumulativePoS,
} from './pos-tables';

// Layer 1: mathematical invariants
import { checkMonteCarloInvariants, assertInvariants } from './invariants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ITERATIONS = 10_000;
const HISTOGRAM_BINS = 30;
const DEFAULT_DISCOUNT_RATE = 0.11; // 11 % WACC — mid-range for biotech
const DEFAULT_SEED = 42;

// ---------------------------------------------------------------------------
// Scenario Weighting
// ---------------------------------------------------------------------------
// Pharma deal outcomes are inherently multimodal: either the drug works
// (bull/base) or it doesn't (bear). Flat distributions underestimate
// tail risk and oversmooth the outcome space.
//
// Each scenario shifts the base-case distribution parameters before
// correlated sampling. Weights are calibrated to empirical pharma
// deal outcome distributions (DealForma 2020-2025).
// ---------------------------------------------------------------------------

interface ScenarioConfig {
  name: 'bear' | 'base' | 'bull';
  weight: number;
  /** Additive shift to PoS (fraction of base, e.g., -0.20 = -20% of base PoS) */
  posShiftFraction: number;
  /** Multiplicative shift to peak sales (e.g., -0.30 = -30%) */
  peakSalesMultiplier: number;
  /** Additive shift to discount rate (pp, e.g., +0.02 = +2pp) */
  discountRateShift: number;
  /** Additive shift to time-to-market (years, e.g., +1.5) */
  timelineShift: number;
}

// Phase-calibrated scenario weights: late-stage assets have tighter distributions
function getScenarioConfigs(phase?: string): ScenarioConfig[] {
  // Late-stage: more certainty → heavier base weight, less extreme tails
  const isLateStage = phase && ['phase3', 'nda_filed', 'approved'].includes(phase);
  const isEarlyStage = phase && ['preclinical', 'phase1', 'discovery'].includes(phase);

  const bearWeight = isLateStage ? 0.15 : isEarlyStage ? 0.25 : 0.20;
  const bullWeight = isLateStage ? 0.25 : isEarlyStage ? 0.35 : 0.30;
  const baseWeight = 1 - bearWeight - bullWeight;

  return [
    {
      name: 'bear',
      weight: bearWeight,
      posShiftFraction: isEarlyStage ? -0.25 : -0.15,
      peakSalesMultiplier: isEarlyStage ? -0.40 : -0.25,
      discountRateShift: 0.02,
      timelineShift: isLateStage ? 0.5 : 1.5,
    },
    {
      name: 'base',
      weight: baseWeight,
      posShiftFraction: 0,
      peakSalesMultiplier: 0,
      discountRateShift: 0,
      timelineShift: 0,
    },
    {
      name: 'bull',
      weight: bullWeight,
      posShiftFraction: isEarlyStage ? 0.20 : 0.10,
      peakSalesMultiplier: isEarlyStage ? 0.50 : 0.30,
      discountRateShift: -0.01,
      timelineShift: isLateStage ? -0.25 : -0.5,
    },
  ];
}

// Default configs for backwards compatibility
const SCENARIO_CONFIGS = getScenarioConfigs();

/**
 * Select a scenario using weighted random sampling.
 * Returns the index into the provided scenarioConfigs array.
 *
 * The caller MUST pass the phase-calibrated configs so that selection
 * probability and parameter shifts both use the same weights. Earlier
 * versions used the module-level SCENARIO_CONFIGS (no phase) for selection
 * while phaseConfigs was used for parameter shifts — causing a weight
 * mismatch for early and late stage assets.
 */
function sampleScenario(rng: () => number, scenarioConfigs: ScenarioConfig[] = SCENARIO_CONFIGS): number {
  const u = rng();
  let cumWeight = 0;
  for (let i = 0; i < scenarioConfigs.length; i++) {
    cumWeight += scenarioConfigs[i].weight;
    if (u < cumWeight) return i;
  }
  return scenarioConfigs.length - 1; // fallback to last (bull)
}

/** Ordered list of clinical phases used for rNPV progression.
 * Includes combined/adaptive trial phases and NDA filed to match
 * the full phase set supported by the rNPV engine. */
const PHASE_ORDER = [
  'discovery',
  'preclinical',
  'phase1',
  'phase1_2',
  'phase2',
  'phase2_3',
  'phase3',
  'nda_filed',
  'approved',
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
 * 'approved') to our internal phase index.
 */
function phaseIndex(phase: string): number {
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

// ---------------------------------------------------------------------------
// Correlated sampling via Cholesky decomposition
// ---------------------------------------------------------------------------
// Source: Empirical correlations from pharma deal analysis (DealForma 2020-2025),
// academic literature (Lo & Pisani, 2015; Wong, Siah & Lo, 2019).
//
// Variables are correlated in reality:
// - PoS ↔ Peak Sales: +0.40 (validated targets attract larger market opportunity)
// - PoS ↔ Time: -0.25 (successful programs encounter fewer delays)
// - PoS ↔ Rate: -0.30 (lower risk assets command lower cost of capital)
// - Peak Sales ↔ Time: -0.35 (large-market assets face competitive urgency)
// - Peak Sales ↔ Pricing: +0.20 (premium drugs serve larger/underserved markets)
// - Rate ↔ Time: +0.25 (longer timelines increase investor risk perception)

/** 5x5 correlation matrix: [PoS, PeakSales, Rate, Time, Pricing] */
const CORRELATION_MATRIX: number[][] = [
  // PoS    Peak   Rate   Time   Price
  [ 1.00,  0.40, -0.30, -0.25,  0.00],  // PoS
  [ 0.40,  1.00,  0.00, -0.35,  0.20],  // Peak Sales
  [-0.30,  0.00,  1.00,  0.25,  0.00],  // Discount Rate
  [-0.25, -0.35,  0.25,  1.00,  0.00],  // Time to Market
  [ 0.00,  0.20,  0.00,  0.00,  1.00],  // Pricing
];

/**
 * Deal-type-specific correlation matrix overrides.
 *
 * Acquisitions: PoS-Time correlation near 0 (fixed M&A timeline, not
 * contingent on clinical milestones). Lower PoS-Rate correlation
 * (acquirer absorbs risk at closing).
 *
 * Options: Higher PoS-Time correlation (exercise decision depends on
 * clinical data readouts, tightly coupling success probability with
 * timeline). Stronger PoS-Rate link (option premium pricing sensitive
 * to perceived risk).
 *
 * Sources: DealForma M&A vs licensing correlation analysis (2020-2025),
 * BioCentury option deal structuring data.
 */
const DEAL_TYPE_CORRELATION_OVERRIDES: Record<string, number[][]> = {
  acquisition: [
    // PoS    Peak   Rate   Time   Price
    [ 1.00,  0.30, -0.15, -0.05,  0.00],  // PoS — near-zero time link (fixed M&A timeline)
    [ 0.30,  1.00,  0.00, -0.15,  0.20],  // Peak Sales — lower time sensitivity
    [-0.15,  0.00,  1.00,  0.10,  0.00],  // Discount Rate — acquirer absorbs risk
    [-0.05, -0.15,  0.10,  1.00,  0.00],  // Time to Market — largely fixed
    [ 0.00,  0.20,  0.00,  0.00,  1.00],  // Pricing
  ],
  option: [
    // PoS    Peak   Rate   Time   Price
    [ 1.00,  0.45, -0.35, -0.45,  0.00],  // PoS — strong time link (exercise depends on data)
    [ 0.45,  1.00,  0.00, -0.40,  0.25],  // Peak Sales — high time sensitivity
    [-0.35,  0.00,  1.00,  0.30,  0.00],  // Discount Rate — option pricing is risk-sensitive
    [-0.45, -0.40,  0.30,  1.00,  0.00],  // Time to Market — exercise window drives urgency
    [ 0.00,  0.25,  0.00,  0.00,  1.00],  // Pricing
  ],
  // Reformulation / 505(b)(2): more predictable regulatory timelines
  // (pathway is well-defined), so PoS-timeline correlation is much lower
  // than for NME assets. Lower overall correlations reflect the reduced
  // uncertainty in 505(b)(2) development programs where the reference
  // product provides substantial prior data.
  // Source: FDA 505(b)(2) approval statistics (2018-2025), DealForma
  // reformulation deal outcomes analysis.
  reformulation: [
    // PoS    Peak   Rate   Time   Price
    [ 1.00,  0.15, -0.10,  0.10,  0.00],  // PoS — lower correlation, more predictable for 505(b)(2)
    [ 0.15,  1.00,  0.00,  0.20,  0.20],  // Peak Sales — lower timeline sensitivity
    [-0.10,  0.00,  1.00,  0.10,  0.00],  // Discount Rate — slight negative, lower risk = lower discount
    [ 0.10,  0.20,  0.10,  1.00,  0.00],  // Time to Market — well-defined regulatory timeline
    [ 0.00,  0.20,  0.00,  0.00,  1.00],  // Pricing
  ],
};

/**
 * Validate that a matrix is a proper correlation matrix before Cholesky
 * decomposition.  Checks:
 *   1. Unit diagonal (all diagonal entries = 1.0 within tolerance)
 *   2. Symmetry   (A[i][j] = A[j][i] within tolerance)
 *   3. Bounds     (|A[i][j]| < 1 for off-diagonal entries)
 *
 * Returns true if the matrix passes all checks.  When false, the caller
 * should fall back to an identity matrix (independent sampling) rather
 * than feeding a degenerate matrix into Cholesky where Math.max(0, ...)
 * silently collapses dimensions.
 */
function validateCorrelationMatrix(matrix: number[][]): boolean {
  const n = matrix.length;
  for (let i = 0; i < n; i++) {
    if (Math.abs(matrix[i][i] - 1.0) > 1e-6) return false;
    for (let j = 0; j < i; j++) {
      if (Math.abs(matrix[i][j] - matrix[j][i]) > 1e-6) return false;
      if (Math.abs(matrix[i][j]) >= 1.0) return false;
    }
  }
  return true;
}

/**
 * Cholesky decomposition of a symmetric positive-definite matrix.
 * Returns lower-triangular matrix L such that L * L^T = A.
 * Used to transform independent standard normal samples into correlated samples.
 *
 * Source: Standard numerical methods (Golub & Van Loan, Matrix Computations)
 */
function choleskyDecompose(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(0, matrix[i][i] - sum));
      } else {
        L[i][j] = L[j][j] > 0 ? (matrix[i][j] - sum) / L[j][j] : 0;
      }
    }
  }
  return L;
}

/** Transform 5 independent standard normals into correlated standard normals */
function correlatedNormals(independent: number[], choleskyL: number[][]): number[] {
  const n = independent.length;
  const correlated = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      correlated[i] += choleskyL[i][j] * independent[j];
    }
  }
  return correlated;
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
  // Build sequential pathway from current phase (NOT linear PHASE_ORDER).
  // Combined phases (phase1_2, phase2_3) are alternative pathways, not sequential steps.
  const mcPathway: string[] = (() => {
    if (input.phase === 'phase1_2') return ['phase1_2', 'phase3', 'nda_filed'];
    if (input.phase === 'phase2_3') return ['phase2_3', 'nda_filed'];
    if (input.phase === 'nda_filed') return ['nda_filed'];
    if (input.phase === 'approved') return [];
    const standard = ['discovery', 'preclinical', 'phase1', 'phase2', 'phase3', 'nda_filed'];
    const sIdx = standard.indexOf(input.phase);
    return sIdx >= 0 ? standard.slice(sIdx) : ['phase1', 'phase2', 'phase3', 'nda_filed'];
  })();

  const taDurations = PHASE_DURATION[input.therapeuticArea] ?? PHASE_DURATION.oncology;
  let totalYearsToMarket = 0;
  for (const phaseKey of mcPathway) {
    const duration = (taDurations as Record<string, number>)[phaseKey] ?? 1.5;
    totalYearsToMarket += duration;
  }
  // Note: nda_filed already represents regulatory review; don't add durations.regulatory again.
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

  // --- 4. Development costs (risk-adjusted per phase gate) -------------
  // Each phase's cost is weighted by the probability of actually reaching
  // that phase. This avoids overestimating costs for early-stage assets
  // where most programs terminate before expensive late-stage trials.
  // Source: Standard rNPV methodology (Stewart, Allison & Johnson, 2001)
  const taCosts = PHASE_COSTS[input.therapeuticArea] ?? PHASE_COSTS['oncology'];
  const taBaseRates = POS_BY_THERAPEUTIC_AREA[input.therapeuticArea] ?? POS_BY_THERAPEUTIC_AREA['oncology'];
  const baseTransitionRates = [
    taBaseRates.discoveryToPreclinical ?? 0.45,
    taBaseRates.preclinicalToPhase1,
    taBaseRates.phase1ToPhase2,
    taBaseRates.phase1_2ToPhase2 ?? taBaseRates.phase1ToPhase2,
    taBaseRates.phase2ToPhase3,
    taBaseRates.phase2_3ToPhase3 ?? taBaseRates.phase2ToPhase3,
    taBaseRates.phase3ToApproval,
    taBaseRates.ndaFiledToApproval ?? 0.90,
    taBaseRates.approvalToLaunch,
  ];

  // Map pathway phase names to baseTransitionRates indices for PoS gating
  const phaseRateMap: Record<string, number> = {
    discovery: baseTransitionRates[0],
    preclinical: baseTransitionRates[1],
    phase1: baseTransitionRates[2],
    phase1_2: baseTransitionRates[3],
    phase2: baseTransitionRates[4],
    phase2_3: baseTransitionRates[5],
    phase3: baseTransitionRates[6],
    nda_filed: baseTransitionRates[7],
  };

  let discountedCosts = 0;
  let yearAccum = 0;
  let phasePoS = 1.0; // cumulative probability of reaching each phase
  for (const phaseKey of mcPathway) {
    const phaseCost = (taCosts as Record<string, number>)[phaseKey] ?? 0;
    const phaseDur = (taDurations as Record<string, number>)[phaseKey] ?? 1.5;

    if (phaseCost > 0 && phaseDur > 0) {
      const annualCost = phaseCost / phaseDur;
      for (let yr = 0; yr < Math.ceil(phaseDur); yr++) {
        const costYear = yearAccum + yr + 1;
        // Risk-adjust: only incur cost if we've reached this phase
        discountedCosts += (annualCost * phasePoS) / Math.pow(1 + r, costYear);
      }
    }
    yearAccum += phaseDur;

    // Update cumulative PoS for next phase in pathway
    const rate = phaseRateMap[phaseKey];
    if (rate != null) {
      phasePoS *= Math.max(0.01, Math.min(0.95, rate));
    }
  }
  // Note: nda_filed is the regulatory review window; don't add a separate regulatory cost.

  // --- 5. rNPV = PoS x discounted revenue - risk-adjusted costs -------
  return cumulativePoS * discountedRevenue - discountedCosts;
}

// estimateRemainingDevCosts removed — costs are now risk-adjusted per phase gate
// directly in computeIterationRNPV for more accurate modeling.

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
  const iterations = Math.min(input.iterations ?? DEFAULT_ITERATIONS, 50_000);
  const rng = seedableRandom(seed);

  // --- Input guards ---
  const VALID_PHASES = ['discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved'];
  const guardedInput = { ...input.rnpvInput };
  if (!VALID_PHASES.includes(guardedInput.phase)) {
    guardedInput.phase = 'phase2' as typeof guardedInput.phase;
  }
  if (guardedInput.discountRate != null) {
    guardedInput.discountRate = Math.max(0.01, Math.min(0.30, guardedInput.discountRate));
  }
  guardedInput.peakSalesEstimate = {
    low: Math.max(0, Math.min(1_000_000, guardedInput.peakSalesEstimate.low)),
    median: Math.max(0, Math.min(1_000_000, guardedInput.peakSalesEstimate.median)),
    high: Math.max(0, Math.min(1_000_000, guardedInput.peakSalesEstimate.high)),
  };
  const rnpv = guardedInput;

  // ----- Prepare distribution parameters --------------------------------

  // 1. PoS: beta distribution centred on base cumulative PoS
  // Use the user's actual biomarker status so MC p50 aligns with the main rNPV engine
  // (previously hardcoded 'unselected', causing systematic ~25% disagreement for biomarker-selected assets).
  const posResult = getCumulativePoS(
    rnpv.phase,
    rnpv.therapeuticArea,
    rnpv.modality,
    rnpv.biomarkerStatus || 'unselected',
    rnpv.regulatoryDesignations,
    rnpv.indication,
  );
  const basePoS = posResult.cumulativePoS;
  const posVariation = input.posVariation ?? 0.20;

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

  // 4. Time-to-market: shift range (years earlier / later)
  const ttmShift = input.timeToMarketVariation ?? 1.0; // +/- years

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

  // Track which scenario each iteration was drawn from
  const scenarioAssignment = new Uint8Array(iterations);

  // Warnings accumulated during simulation (surfaced in result)
  const warnings: string[] = [];

  // Select deal-type-specific correlation matrix (falls back to default for licensing/codevelopment/collaboration)
  const dealType = rnpv.dealType || 'licensing';
  let correlationMatrix = DEAL_TYPE_CORRELATION_OVERRIDES[dealType] ?? CORRELATION_MATRIX;

  // Validate correlation matrix before Cholesky decomposition.
  // A malformed matrix (non-unit diagonal, asymmetric, or |r| >= 1) causes
  // choleskyDecompose to silently collapse dimensions via Math.max(0, ...),
  // giving some parameters zero variation. Fall back to identity (independent
  // sampling) rather than producing a degenerate decomposition.
  const isValidCorrelation = validateCorrelationMatrix(correlationMatrix);
  if (!isValidCorrelation) {
    const n = correlationMatrix.length;
    correlationMatrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
    );
    warnings.push(
      `Correlation matrix for deal type "${dealType}" failed validation ` +
      `(non-unit diagonal, asymmetric, or |r| >= 1). ` +
      `Fell back to identity matrix — parameters sampled independently.`
    );
  }

  // Pre-compute Cholesky factor for correlated sampling
  const choleskyL = choleskyDecompose(correlationMatrix);

  // Use phase-calibrated scenario configs for more realistic distributions
  const phaseConfigs = getScenarioConfigs(guardedInput.phase);

  for (let i = 0; i < iterations; i++) {
    // --- Scenario weighting: sample which macro scenario applies ---
    // Phase-calibrated: late-stage assets have tighter distributions.
    // Pass phaseConfigs explicitly so selection probability matches the
    // phase-specific weights used for parameter shifts.
    const scenarioIdx = sampleScenario(rng, phaseConfigs);
    const scenario = phaseConfigs[scenarioIdx];
    scenarioAssignment[i] = scenarioIdx;

    // Scenario-adjusted base parameters
    const scenarioPoS = Math.max(0.001, Math.min(0.999,
      basePoS * (1 + scenario.posShiftFraction)));
    const scenarioPeakSales = basePeakSales * (1 + scenario.peakSalesMultiplier);
    const scenarioRate = Math.max(0.01, baseRate + scenario.discountRateShift);
    const scenarioTimeShift = scenario.timelineShift;

    // Recalculate lognormal params for scenario-adjusted peak sales
    const { mu: scenarioPsMu, sigma: scenarioPsSigma } = lognormalParams(
      scenarioPeakSales,
      peakSalesCV,
    );

    // Generate 5 independent standard normal samples
    const z = [
      sampleNormal(0, 1, rng),
      sampleNormal(0, 1, rng),
      sampleNormal(0, 1, rng),
      sampleNormal(0, 1, rng),
      sampleNormal(0, 1, rng),
    ];

    // Apply Cholesky transform to introduce correlations
    const corr = correlatedNormals(z, choleskyL);

    // Transform correlated normals to target distributions,
    // now centered on scenario-adjusted parameters:
    // 1. PoS: correlated normal shift around scenario-adjusted base.
    // posVariation is an ABSOLUTE perturbation (e.g. 0.20 = ±20pp), so we do
    // NOT multiply by scenarioPoS. Previously scaling by basePoS collapsed
    // early-stage distributions (±1.6pp at 8% basePoS instead of ±20pp).
    const posShift = corr[0] * (input.posVariation ?? 0.20);
    const sPoS = Math.max(0.001, Math.min(0.99, scenarioPoS + posShift));

    // 2. Peak Sales: lognormal with scenario-adjusted center
    const peakShift = corr[1] * scenarioPsSigma;
    const sPeak = Math.exp(scenarioPsMu + peakShift);

    // 3. Discount Rate: normal around scenario-adjusted rate
    const sRate = Math.max(0.01, scenarioRate + corr[2] * rateStdDev);

    // 4. Time-to-Market: scenario shift + correlated perturbation
    const timeSpread = input.timeToMarketVariation ?? 1.0;
    const sTime = Math.max(-timeSpread - 2, Math.min(timeSpread + 2,
      scenarioTimeShift + corr[3] * timeSpread * 0.5));

    // 5. Pricing: normal with correlated perturbation (not scenario-shifted)
    const sPrice = Math.max(0.1, 1.0 + corr[4] * pricingStdDev);

    // Store for correlation analysis
    sampledPoSArr[i] = sPoS;
    sampledPeakArr[i] = sPeak;
    sampledRateArr[i] = sRate;
    sampledTimeArr[i] = sTime;
    sampledPriceArr[i] = sPrice;

    // Compute rNPV with isFinite guard
    const iterResult = computeIterationRNPV(
      rnpv,
      sPoS,
      sPeak,
      sRate,
      sTime,
      sPrice,
    );
    npvResults[i] = isFinite(iterResult) ? iterResult : 0;
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
  const mean = Math.round((sum / iterations) * 10) / 10;
  const variance = sumSq / iterations - (sum / iterations) * (sum / iterations);
  const stdDev = Math.round(Math.sqrt(Math.max(0, variance)) * 10) / 10;

  // Percentiles (round to 1 decimal for clean display)
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const p2_5 = r1(percentile(sortedArr, 2.5));
  const p5 = r1(percentile(sortedArr, 5));
  const p10 = r1(percentile(sortedArr, 10));
  const p25 = r1(percentile(sortedArr, 25));
  const p50 = r1(percentile(sortedArr, 50));
  const p75 = r1(percentile(sortedArr, 75));
  const p90 = r1(percentile(sortedArr, 90));
  const p95 = r1(percentile(sortedArr, 95));
  const p97_5 = r1(percentile(sortedArr, 97.5));

  // ----- Histogram (with percentage per bin) ----------------------------

  const rawValues = Array.from(npvResults);
  const rawHistogram = buildHistogram(rawValues, HISTOGRAM_BINS);
  const histogram = rawHistogram.map((bin) => ({
    binStart: r1(bin.binStart),
    binEnd: r1(bin.binEnd),
    count: bin.count,
    percentage: Math.round((bin.count / iterations) * 1000) / 10,
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

  // ----- Scenario breakdown (per-scenario P50 and weight) ---------------
  // Collect rNPV results per scenario, sort, and extract P50 for each.
  // This surfaces the multimodal nature of the distribution.

  const scenarioResults: [number[], number[], number[]] = [[], [], []];
  for (let i = 0; i < iterations; i++) {
    scenarioResults[scenarioAssignment[i]].push(npvResults[i]);
  }

  const scenarioP50s = scenarioResults.map((results) => {
    if (results.length === 0) return 0;
    const sorted = results.slice().sort((a, b) => a - b);
    return r1(percentile(sorted, 50));
  });

  const scenario_breakdown = {
    bear: { p50: scenarioP50s[0], weight: phaseConfigs[0].weight },
    base: { p50: scenarioP50s[1], weight: phaseConfigs[1].weight },
    bull: { p50: scenarioP50s[2], weight: phaseConfigs[2].weight },
  };

  // ----- Risk metrics (VaR, CVaR, skewness, kurtosis) -------------------

  // VaR_95 = P5 (5th percentile). "What's the worst 95% of the time?"
  const var95 = p5;

  // CVaR_95 = mean of bottom 5%. "If things go wrong, how wrong?"
  const tailCutoff = Math.max(1, Math.floor(iterations * 0.05));
  let tailSum = 0;
  for (let i = 0; i < tailCutoff; i++) {
    tailSum += sorted[i];
  }
  const cvar95 = r1(tailSum / tailCutoff);

  // Skewness (Fisher's): positive = right-skewed (pharma early-stage typical)
  let m3 = 0;
  for (let i = 0; i < iterations; i++) {
    m3 += Math.pow(npvResults[i] - mean, 3);
  }
  m3 /= iterations;
  const skewness = stdDev > 0 ? r1(m3 / Math.pow(stdDev, 3) * 100) / 100 : 0;

  // Excess kurtosis: > 0 = fatter tails than normal
  let m4 = 0;
  for (let i = 0; i < iterations; i++) {
    m4 += Math.pow(npvResults[i] - mean, 4);
  }
  m4 /= iterations;
  const kurtosis = stdDev > 0 ? r1((m4 / Math.pow(stdDev, 4) - 3) * 100) / 100 : 0;

  // ----- Assemble result ------------------------------------------------

  const mcResult: MonteCarloResult = {
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

    scenario_breakdown,

    var95,
    cvar95,
    skewness,
    kurtosis,

    ...(warnings.length > 0 ? { warnings } : {}),
  };

  // Layer 1: mathematical invariants — log to Sentry but never throw.
  try {
    const violations = checkMonteCarloInvariants(mcResult);
    if (violations.some(v => v.severity === 'critical')) {
      assertInvariants(violations, {
        context: 'monte-carlo',
        extra: {
          phase: input.rnpvInput?.phase,
          therapeuticArea: input.rnpvInput?.therapeuticArea,
        },
      });
    }
  } catch {
    // Never break production calculations on invariant check failures.
  }

  return mcResult;
}
