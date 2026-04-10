/**
 * Advanced rNPV Upgrades: Competitive Dynamics, Real Options, Enhanced Correlation
 *
 * Institutional-grade extensions to the rNPV financial modeling engine.
 *
 * Upgrade 4: Time-varying competitive market share erosion modeling
 * Upgrade 5: Real options overlay via CRR binomial lattice (compound option)
 * Upgrade 6: Phase-dependent Monte Carlo correlation matrices with conditional floors
 *
 * Sources:
 *   - Trigeorgis & Reuer (2017), Real Options Theory in Strategic Management
 *   - Cox, Ross & Rubinstein (1979), Option Pricing: A Simplified Approach
 *   - DealForma pharma licensing database (2020-2025)
 *   - BIO/Informa Clinical Development Success Rates (2021)
 *   - Lo & Pisani (2015), Wong, Siah & Lo (2019) — clinical trial analytics
 *
 * @module lib/financial/advanced-upgrades
 */

import type { RNPVInput, RNPVResult } from './types';
import {
  getCompetitiveIntensity,
  getPositionModifier,
  getModalityLagMultiplier,
  computeRegulatoryDelay,
  type CompetitiveIntensity,
} from './competitive-calibration';

// ==========================================================================
// Upgrade 4: Competitive Dynamics (Time-Varying Market Share Erosion)
// ==========================================================================

/**
 * A single competitor entering the market with a specific profile.
 */
export interface CompetitorEntry {
  /** Absolute calendar year the competitor enters the market */
  entryYear: number;
  /** Fraction of revenue lost to this competitor at full ramp (0-1) */
  shareImpact: number;
  /** Years for the competitor to reach full market share capture */
  rampYears: number;
  /** Competitor archetype */
  type: 'generic' | 'biosimilar' | 'nextGen' | 'classCompetitor';
  /** Optional name (populated from real pipeline data when available) */
  name?: string;
  /** Optional mechanism of action for MOA clustering detection */
  moa?: string;
  /** Whether competitor requires the same biomarker */
  biomarkerGated?: boolean;
}

/**
 * Optional pipeline intelligence input — real competitor data from
 * ClinicalTrials.gov or curated sources. If provided, overrides the
 * template-calibrated competitor count.
 */
export interface PipelineIntelligence {
  /** Named competitors with known profiles */
  knownCompetitors?: Array<{
    name: string;
    phase?: string;
    sponsor?: string;
    moa?: string;
    expectedApprovalYear?: number; // absolute calendar year
    biomarkerRequired?: boolean;
  }>;
  /** Additional unnamed competitors in the same indication/modality */
  additionalCompetitorCount?: number;
}

/**
 * Complete competitive dynamics analysis showing year-by-year revenue erosion
 * from anticipated competitive entries. Models both volume erosion (share loss)
 * and price erosion (per-entrant pricing pressure).
 */
export interface CompetitiveDynamicsResult {
  /** Timeline of competitor entries used in the model */
  competitorTimeline: CompetitorEntry[];
  /** Year-by-year revenue before competitive erosion ($M) */
  baselineRevenue: number[];
  /** Year-by-year revenue after competitive erosion ($M) */
  adjustedRevenue: number[];
  /** Year-by-year price index (starts at 1.0, declines with competitor entries) */
  priceIndex: number[];
  /** Year-by-year volume index (1 - cumulative share erosion) */
  volumeIndex: number[];
  /** Maximum cumulative share erosion across all years (0-1) */
  peakShareErosion: number;
  /** Maximum cumulative price erosion across all years (0-1) */
  peakPriceErosion: number;
  /** Total lifetime revenue lost to competition ($M) */
  revenueImpact: number;
  /** Revenue impact attributed to volume erosion alone ($M) */
  volumeImpact: number;
  /** Revenue impact attributed to price erosion alone ($M) */
  priceImpact: number;
  /** Absolute calendar year of peak erosion */
  peakErosionYear: number;
  /** Confidence level in the estimate */
  confidence: 'high' | 'moderate' | 'low';
  /** Calibration source used */
  dataSource: 'calibrated' | 'pipeline-intelligence' | 'hybrid';
  /** Human-readable narrative summarizing competitive dynamics */
  narrative: string;
}

// ─── Helper: S-curve ramp ───
// Cubic easing (3t^2 - 2t^3) matches the revenue adoption curve used
// elsewhere in the engine. Linear ramps underestimate early competitor
// impact and overestimate late impact.
function sCurveRamp(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 3 * clamped * clamped - 2 * clamped * clamped * clamped;
}

function inferPrimaryMOA(input: RNPVInput): string {
  return input.modality || 'smallMolecule';
}

/**
 * Calculate time-varying competitive market share erosion for a pharmaceutical asset.
 *
 * Worldclass model combining nine institutional-grade upgrades:
 *   1. TA-specific calibrated competitive intensity (empirical, cited)
 *   2. Modality-aware entry lag (biosimilar delays for biologics)
 *   3. S-curve ramp (cubic easing, not linear)
 *   4. Regulatory exclusivity delays (orphan/breakthrough push entry back)
 *   5. Price erosion on top of volume erosion
 *   6. Real pipeline intelligence integration (when provided)
 *   7. Biomarker segmentation (biomarker-gated competitors only erode matching segment)
 *   8. MOA clustering (same-MOA competitors erode harder)
 *   9. Confidence levels and data source attribution
 *
 * @param input         - The rNPV input parameters
 * @param baseResult    - The base-case rNPV result (cash flows and launch timing)
 * @param pipelineData  - Optional real pipeline intelligence to override templates
 * @returns Competitive dynamics analysis with year-by-year revenue impact
 */
export function calculateCompetitiveDynamics(
  input: RNPVInput,
  baseResult: RNPVResult,
  pipelineData?: PipelineIntelligence,
): CompetitiveDynamicsResult {
  // Project-relative launch year — cashFlows[i].year uses the same frame
  const launchYear = Math.ceil(baseResult.yearsToMarket);

  // Upgrade 1: Load TA-specific calibrated intensity
  const intensity: CompetitiveIntensity = getCompetitiveIntensity(input.therapeuticArea);

  // Upgrade 1 (cont'd): Apply position modifier
  const position = input.competitivePosition || 'racing';
  const positionMod = getPositionModifier(position);
  const effectiveCompetitorCount = Math.max(
    1,
    Math.round(intensity.baseCompetitorCount * positionMod.competitorCountMultiplier),
  );

  // Upgrade 2: Modality-aware entry lag (biologics get biosimilar protection)
  const modalityLagMult = getModalityLagMultiplier(input.modality);

  // Upgrade 4: Regulatory exclusivity delays
  const regDelay = computeRegulatoryDelay(input.regulatoryDesignations || {});

  // Effective entry lag combines all factors
  const effectiveEntryLag = Math.max(
    -3,
    intensity.avgEntryLagYears * modalityLagMult + positionMod.entryLagAdjustment + regDelay,
  );

  // Build competitor timeline — from real data if provided, else from templates
  const competitorTimeline: CompetitorEntry[] = [];
  let dataSource: CompetitiveDynamicsResult['dataSource'] = 'calibrated';
  const primaryMOA = inferPrimaryMOA(input);

  if (pipelineData?.knownCompetitors && pipelineData.knownCompetitors.length > 0) {
    // Upgrade 6: Real pipeline intelligence
    dataSource = 'pipeline-intelligence';
    const currentYearCalendar = new Date().getFullYear();

    for (const comp of pipelineData.knownCompetitors) {
      // Convert absolute expected approval year to project-relative
      const relativeEntry = comp.expectedApprovalYear != null
        ? comp.expectedApprovalYear - currentYearCalendar
        : launchYear + intensity.avgEntryLagYears;

      // Upgrade 8: MOA clustering — same-MOA competitors take more share
      const sameMOA = comp.moa && comp.moa === primaryMOA;
      const moaMultiplier = sameMOA ? 1.3 : 0.85;

      // Upgrade 7: Biomarker segmentation — biomarker-gated competitors
      // only erode the biomarker-positive segment if this asset isn't gated
      let biomarkerMultiplier = 1.0;
      if (comp.biomarkerRequired && input.biomarkerStatus !== 'validated') {
        biomarkerMultiplier = 0.4; // ~40% biomarker-positive fraction
      }

      competitorTimeline.push({
        entryYear: relativeEntry,
        shareImpact: intensity.avgShareImpact * moaMultiplier * biomarkerMultiplier,
        rampYears: 2,
        type: 'classCompetitor',
        name: comp.name,
        moa: comp.moa,
        biomarkerGated: comp.biomarkerRequired,
      });
    }

    if (pipelineData.additionalCompetitorCount && pipelineData.additionalCompetitorCount > 0) {
      dataSource = 'hybrid';
      for (let i = 0; i < pipelineData.additionalCompetitorCount; i++) {
        competitorTimeline.push({
          entryYear: launchYear + effectiveEntryLag + i * 1.5,
          shareImpact: intensity.avgShareImpact * 0.85,
          rampYears: 2,
          type: 'nextGen',
        });
      }
    }
  } else {
    // Fallback: calibrated template with staggered entries and diminishing returns
    for (let i = 0; i < effectiveCompetitorCount; i++) {
      const entryOffset = effectiveEntryLag + i * 1.2;
      const isPreLaunch = entryOffset < 0;
      // Diminishing returns: first competitor takes most share, subsequent take less
      const diminishingFactor = Math.pow(0.85, i);
      const sharePerCompetitor = intensity.avgShareImpact * diminishingFactor;

      competitorTimeline.push({
        entryYear: launchYear + entryOffset,
        shareImpact: sharePerCompetitor,
        rampYears: isPreLaunch ? 0.5 : 2,
        type: i === 0 ? 'classCompetitor' : 'nextGen',
      });
    }
  }

  // Year-by-year calculation with S-curve ramp + price erosion + volume erosion
  const cashFlows = baseResult.cashFlows;
  const baselineRevenue: number[] = cashFlows.map((cf) => cf.revenue);
  const adjustedRevenue: number[] = new Array(cashFlows.length).fill(0);
  const priceIndex: number[] = new Array(cashFlows.length).fill(1.0);
  const volumeIndex: number[] = new Array(cashFlows.length).fill(1.0);

  let peakShareErosion = 0;
  let peakPriceErosion = 0;
  let peakErosionYearRelative = launchYear;
  let peakCombinedErosion = 0;
  let totalBaseRevenue = 0;
  let totalAdjustedRevenue = 0;
  let totalVolumeImpact = 0;
  let totalPriceImpact = 0;

  for (let i = 0; i < cashFlows.length; i++) {
    const year = cashFlows[i].year;
    const baseRev = baselineRevenue[i];

    // Upgrade 3: S-curve ramp + multiplicative volume erosion
    let volumeMultiplier = 1.0;
    let activeCompetitors = 0;

    for (const competitor of competitorTimeline) {
      if (year >= competitor.entryYear) {
        activeCompetitors++;
        const yearsActive = year - competitor.entryYear;
        const effectiveRampYears = Math.max(competitor.rampYears, 0.5);
        const rampFraction = sCurveRamp(yearsActive / effectiveRampYears);
        volumeMultiplier *= Math.max(0, 1 - competitor.shareImpact * rampFraction);
      }
    }

    // Upgrade 1: First-mover shield in early post-launch years
    const yearsFromLaunch = year - launchYear;
    if (yearsFromLaunch >= 0 && yearsFromLaunch < 3 && positionMod.firstMoverShield > 0) {
      const shieldDecay = 1 - yearsFromLaunch / 3;
      const shieldFactor = 1 + positionMod.firstMoverShield * shieldDecay;
      volumeMultiplier = Math.min(1, volumeMultiplier * shieldFactor);
    }

    // Upgrade 5: Price erosion on top of volume erosion
    const priceMultiplier = Math.pow(
      1 - intensity.priceErosionPerEntrant,
      activeCompetitors,
    );

    // Combined revenue multiplier
    const combinedMultiplier = volumeMultiplier * priceMultiplier;
    const adjRev = baseRev * combinedMultiplier;

    // Decompose impacts for reporting
    const volumeAdjRev = baseRev * volumeMultiplier;
    const priceAdjRev = baseRev * priceMultiplier;
    totalVolumeImpact += baseRev - volumeAdjRev;
    totalPriceImpact += baseRev - priceAdjRev;

    volumeIndex[i] = volumeMultiplier;
    priceIndex[i] = priceMultiplier;

    // Track peak erosion year (combined)
    const yearVolumeErosion = 1 - volumeMultiplier;
    const yearPriceErosion = 1 - priceMultiplier;
    const yearCombinedErosion = 1 - combinedMultiplier;
    if (yearCombinedErosion > peakCombinedErosion) {
      peakCombinedErosion = yearCombinedErosion;
      peakErosionYearRelative = year;
    }
    peakShareErosion = Math.max(peakShareErosion, yearVolumeErosion);
    peakPriceErosion = Math.max(peakPriceErosion, yearPriceErosion);

    adjustedRevenue[i] = adjRev;
    totalBaseRevenue += baseRev;
    totalAdjustedRevenue += adjRev;
  }

  const revenueImpact = totalBaseRevenue - totalAdjustedRevenue;

  // Upgrade 9: Confidence levels
  let confidence: CompetitiveDynamicsResult['confidence'];
  if (dataSource === 'pipeline-intelligence') {
    confidence = 'high';
  } else if (dataSource === 'hybrid') {
    confidence = 'moderate';
  } else {
    confidence = competitorTimeline.length >= 3 ? 'moderate' : 'low';
  }

  // Upgrade 9: Richer narrative with decomposition
  const competitorCount = competitorTimeline.length;
  const firstEntryYear = competitorTimeline.length > 0
    ? Math.min(...competitorTimeline.map((c) => c.entryYear))
    : launchYear;
  const yearsUntilFirstCompetitor = Math.round((firstEntryYear - launchYear) * 10) / 10;

  // Convert to absolute calendar years for display
  const currentCalendar = new Date().getFullYear();
  const peakErosionYearAbs = Math.round(currentCalendar + peakErosionYearRelative);

  const totalErosionPct = ((peakShareErosion + peakPriceErosion - peakShareErosion * peakPriceErosion) * 100).toFixed(1);
  const volumeErosionPct = (peakShareErosion * 100).toFixed(1);
  const priceErosionPct = (peakPriceErosion * 100).toFixed(1);
  const firstCompetitorText = yearsUntilFirstCompetitor >= 0
    ? `${yearsUntilFirstCompetitor} year${yearsUntilFirstCompetitor !== 1 ? 's' : ''} post-launch`
    : `${Math.abs(yearsUntilFirstCompetitor)} year${Math.abs(yearsUntilFirstCompetitor) !== 1 ? 's' : ''} before launch`;

  const namedCompetitors = competitorTimeline.filter((c) => c.name).map((c) => c.name!);
  const competitorDetail = namedCompetitors.length > 0
    ? ` Named competitors: ${namedCompetitors.slice(0, 3).join(', ')}${namedCompetitors.length > 3 ? ` and ${namedCompetitors.length - 3} more` : ''}.`
    : '';

  const regProtection = regDelay > 0
    ? ` Regulatory exclusivity provides +${regDelay.toFixed(1)} years of effective protection.`
    : '';

  const combinedErosion = peakShareErosion + peakPriceErosion;

  let narrative: string;
  if (combinedErosion < 0.20) {
    narrative = `Favorable competitive outlook with ${competitorCount} anticipated entrant${competitorCount !== 1 ? 's' : ''}. ` +
      `Peak erosion of ${totalErosionPct}% (${volumeErosionPct}% volume + ${priceErosionPct}% price) in ${peakErosionYearAbs}, ` +
      `reflecting strong positioning.${regProtection}${competitorDetail} ` +
      `Total revenue impact: $${revenueImpact.toFixed(0)}M ($${totalVolumeImpact.toFixed(0)}M volume + $${totalPriceImpact.toFixed(0)}M price).`;
  } else if (combinedErosion < 0.45) {
    narrative = `Moderate competitive pressure with ${competitorCount} anticipated entrant${competitorCount !== 1 ? 's' : ''}. ` +
      `First competition expected ${firstCompetitorText}. ` +
      `Peak erosion of ${totalErosionPct}% (${volumeErosionPct}% volume, ${priceErosionPct}% price) in ${peakErosionYearAbs} ` +
      `reduces lifetime revenue by $${revenueImpact.toFixed(0)}M ($${totalVolumeImpact.toFixed(0)}M volume + $${totalPriceImpact.toFixed(0)}M price).${regProtection}${competitorDetail} ` +
      `Differentiation and pricing strategy are critical.`;
  } else {
    narrative = `Significant competitive headwinds with ${competitorCount} anticipated entrant${competitorCount !== 1 ? 's' : ''}. ` +
      `First competition expected ${firstCompetitorText}. ` +
      `Peak erosion of ${totalErosionPct}% (${volumeErosionPct}% volume + ${priceErosionPct}% price compression) in ${peakErosionYearAbs} ` +
      `substantially impacts commercial potential, with $${revenueImpact.toFixed(0)}M at risk ` +
      `($${totalVolumeImpact.toFixed(0)}M volume + $${totalPriceImpact.toFixed(0)}M price).${regProtection}${competitorDetail} ` +
      `Consider accelerated timelines, best-in-class differentiation, and pricing resilience.`;
  }

  // Convert project-relative entry years to absolute calendar years for UI display
  const displayTimeline: CompetitorEntry[] = competitorTimeline.map((c) => ({
    ...c,
    entryYear: Math.round(currentCalendar + c.entryYear),
  }));

  return {
    competitorTimeline: displayTimeline,
    baselineRevenue,
    adjustedRevenue,
    priceIndex,
    volumeIndex,
    peakShareErosion: Math.round(peakShareErosion * 1000) / 1000,
    peakPriceErosion: Math.round(peakPriceErosion * 1000) / 1000,
    revenueImpact: Math.round(revenueImpact * 10) / 10,
    volumeImpact: Math.round(totalVolumeImpact * 10) / 10,
    priceImpact: Math.round(totalPriceImpact * 10) / 10,
    peakErosionYear: peakErosionYearAbs,
    confidence,
    dataSource,
    narrative,
  };
}

// ==========================================================================
// Upgrade 5: Real Options Overlay (Binomial Lattice)
// ==========================================================================

/**
 * Real options valuation result capturing the flexibility premium
 * embedded in staged pharmaceutical development.
 */
export interface RealOptionsResult {
  /** Option value decomposition for each remaining development phase */
  optionValueByPhase: {
    /** Phase label (e.g., 'phase2', 'phase3') */
    phase: string;
    /** Total option value including time value ($M) */
    optionValue: number;
    /** Intrinsic value = max(S - K, 0) ($M) */
    intrinsicValue: number;
    /** Time value = option value - intrinsic value ($M) */
    timeValue: number;
  }[];
  /** Total compound option value across all remaining phases ($M) */
  totalOptionValue: number;
  /** Flexibility premium = option value - base rNPV ($M) */
  flexibilityPremium: number;
  /** Flexibility premium as percentage of base rNPV */
  flexibilityPremiumPercent: number;
  /** Implied volatility derived from Monte Carlo P10/P90 spread */
  volatilityUsed: number;
  /** Risk-free rate used in the lattice (US 10-year benchmark) */
  riskFreeRate: number;
  /** Number of lattice steps per phase */
  latticeSteps: number;
  /** Human-readable narrative explaining the flexibility premium */
  narrative: string;
  /**
   * True when the base unadjusted NPV was negative and was floored to zero
   * before seeding the lattice. When true, the option value represents the
   * pure flexibility premium and callers should surface this to the UI as
   * "deep out-of-the-money" so users know the static DCF disagrees.
   */
  underlyingFlooredToZero?: boolean;
}

/** Phase order for iteration through development stages */
const PHASE_ORDER = [
  'discovery', 'preclinical', 'phase1', 'phase1_2',
  'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved',
] as const;

/**
 * Map a phase string to its index in PHASE_ORDER.
 * Returns -1 for unrecognized phases so callers can detect the failure
 * instead of silently collapsing unknown input to discovery.
 */
function phaseIndex(phase: string): number {
  const idx = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);
  return idx;
}

/**
 * Build a CRR (Cox-Ross-Rubinstein) binomial lattice and price
 * an American-style call option via backward induction.
 *
 * At each node the holder can exercise (pay strike K, receive asset value S)
 * or continue (hold the option for discounted expected future payoff).
 * This captures the "invest or abandon" decision at each phase gate.
 *
 * @param S     - Current underlying value ($M)
 * @param K     - Strike price / investment cost ($M)
 * @param T     - Time to expiry (years)
 * @param sigma - Annualized volatility
 * @param rf    - Risk-free rate (annualized)
 * @param N     - Number of lattice steps
 * @returns Option value at the root of the lattice ($M)
 *
 * Reference: Cox, Ross & Rubinstein (1979), "Option Pricing: A Simplified Approach",
 * Journal of Financial Economics 7(3), 229-263.
 */
function buildCRRLattice(
  S: number,
  K: number,
  T: number,
  sigma: number,
  rf: number,
  N: number,
): number {
  // Guard against degenerate inputs
  if (S <= 0 || T <= 0 || N <= 0) return Math.max(S - K, 0);

  const dt = T / N;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const discount = Math.exp(-rf * dt);
  const p = (Math.exp(rf * dt) - d) / (u - d);

  // Clamp risk-neutral probability to valid range.
  // If p falls outside (0, 1) the CRR inputs are degenerate (typically
  // sigma too small vs rf*dt or vice versa); clamping keeps the lattice
  // solvable but the result is no longer a true risk-neutral price, so
  // surface a warning rather than silently returning.
  let pUp = p;
  if (p < 0.001 || p > 0.999) {
    if (typeof console !== 'undefined') {
      console.warn(
        `[advanced-upgrades] CRR risk-neutral probability clamped: p=${p.toFixed(4)} ` +
        `(sigma=${sigma.toFixed(3)}, rf=${rf.toFixed(3)}, dt=${dt.toFixed(3)}). ` +
        `Option value will be approximate.`,
      );
    }
    pUp = Math.max(0.001, Math.min(0.999, p));
  }

  // --- Forward pass: build terminal asset values ---
  // Only need a 1D array; we overwrite in the backward pass.
  const values = new Float64Array(N + 1);
  for (let j = 0; j <= N; j++) {
    const assetValue = S * Math.pow(u, N - j) * Math.pow(d, j);
    values[j] = Math.max(assetValue - K, 0); // terminal payoff
  }

  // --- Backward induction ---
  for (let step = N - 1; step >= 0; step--) {
    for (let j = 0; j <= step; j++) {
      const holdValue = discount * (pUp * values[j] + (1 - pUp) * values[j + 1]);
      const assetValue = S * Math.pow(u, step - j) * Math.pow(d, j);
      const exerciseValue = assetValue - K;
      values[j] = Math.max(holdValue, exerciseValue, 0);
    }
  }

  return values[0];
}

/**
 * Calculate the real options overlay for a pharmaceutical asset using
 * compound binomial lattice valuation.
 *
 * Pharmaceutical development is inherently a sequence of nested options:
 * completing Phase 1 gives you the option (not obligation) to invest in
 * Phase 2, which gives you the option to invest in Phase 3, etc. This
 * "option to invest" has value beyond the static rNPV because management
 * can abandon the program at any gate if data is unfavorable.
 *
 * The compound option is built backwards: the Phase 3 option value becomes
 * the underlying asset for the Phase 2 option, and so on back to the
 * current phase.
 *
 * @param input            - The rNPV input parameters
 * @param baseResult       - The base-case rNPV result
 * @param monteCarloResult - Monte Carlo output providing P10/P90 for implied volatility
 * @returns Real options valuation with phase-by-phase decomposition
 *
 * @example
 * ```ts
 * const base = calculateRNPV(input);
 * const mc = runMonteCarlo({ rnpvInput: input });
 * const options = calculateRealOptions(input, base, mc);
 * console.log(`Flexibility premium: $${options.flexibilityPremium.toFixed(0)}M`);
 * console.log(`  (${options.flexibilityPremiumPercent.toFixed(1)}% above static rNPV)`);
 * ```
 */
export function calculateRealOptions(
  input: RNPVInput,
  baseResult: RNPVResult,
  monteCarloResult: { percentiles: { p10: number; p90: number } },
): RealOptionsResult {
  // --- 1. Derive implied volatility from Monte Carlo spread ---
  // The P10/P90 spread of the Monte Carlo distribution provides an empirical
  // measure of total project uncertainty. We invert the lognormal assumption
  // to extract an annualized volatility parameter.
  //
  // For a lognormal: P90/P10 = exp(2 * 1.645 * sigma)
  // => sigma = ln(P90/P10) / (2 * 1.645)
  const p10 = monteCarloResult.percentiles.p10;
  const p90 = monteCarloResult.percentiles.p90;

  let impliedSigma: number;
  if (p10 > 0 && p90 > 0 && p90 > p10) {
    impliedSigma = Math.log(p90 / p10) / (2 * 1.645);
  } else if (p10 <= 0 && p90 > 0) {
    // When P10 is negative (common for early-stage), use P90 magnitude
    // as a proxy for spread relative to the base rNPV
    const baseNPV = Math.max(Math.abs(baseResult.riskAdjustedNPV), 1);
    impliedSigma = Math.log(Math.max(p90 / baseNPV, 1.5)) / 1.645;
  } else {
    // Fallback: use a high default volatility for early-stage pharma
    impliedSigma = 0.60;
  }

  // Clamp volatility to realistic pharmaceutical range
  const sigma = Math.max(0.30, Math.min(0.90, impliedSigma));

  // --- 2. Constants ---
  const rf = 0.045; // US 10-year Treasury benchmark (2024-2026 range)
  const N = 30;     // Lattice steps per phase

  // --- 3. Identify remaining phase transitions ---
  const currentIdx = phaseIndex(input.phase);
  const approvedIdx = phaseIndex('approved');

  // Build list of remaining phases with their costs and durations
  const remainingPhases: {
    phase: string;
    cost: number;      // K: cost to complete this phase ($M)
    duration: number;   // T: years to complete this phase
  }[] = [];

  for (const pt of baseResult.phaseTransitions) {
    const ptIdx = phaseIndex(pt.phase);
    // Include phases that are between current and approval
    // Use lenient matching: include if not approved and has real cost/duration
    const isApprovedPhase = pt.phase === 'approved' || pt.phase === 'launch';
    if (!isApprovedPhase && pt.costEstimate > 0 && pt.yearsToComplete > 0) {
      remainingPhases.push({
        phase: pt.phase,
        cost: pt.costEstimate,
        duration: pt.yearsToComplete,
      });
    }
  }

  // If no remaining phases (already approved), return trivial result
  if (remainingPhases.length === 0) {
    return {
      optionValueByPhase: [],
      totalOptionValue: baseResult.riskAdjustedNPV,
      flexibilityPremium: 0,
      flexibilityPremiumPercent: 0,
      volatilityUsed: sigma,
      riskFreeRate: rf,
      latticeSteps: N,
      narrative: 'Asset is already approved. No optionality remains in development; ' +
        'value equals the static rNPV. Optionality exists only in lifecycle ' +
        'management decisions (label expansions, formulation changes).',
    };
  }

  // --- 4. Calculate UNADJUSTED downstream value for real options ---
  // Critical: Use unadjustedNPV, NOT risk-adjusted. The option pricing lattice
  // already captures uncertainty through implied volatility. Using risk-adjusted
  // PV would double-count risk and collapse all option values to zero for
  // early-stage assets where PoS is low (e.g., 5% cumulative PoS turns $1B into $50M,
  // which is less than the $200-500M in development costs across 7 phases).
  //
  // Source: Trigeorgis & Reuer (2017) — "the underlying in a real option is the
  // gross project value BEFORE risk adjustment, since the option framework
  // prices risk through the volatility parameter."
  const rawUnadjustedNPV = baseResult.unadjustedNPV;
  const totalCashFlowPV = Math.max(rawUnadjustedNPV, 0);
  const underlyingFlooredToZero = rawUnadjustedNPV < 0;

  // --- 5. Build compound option backwards ---
  // Start from the last phase and work back. Each phase's option value
  // becomes the underlying for the previous phase's option.
  //
  // Cost discounting: each phase's investment K is incurred at the phase
  // GATE (i.e., after `yearsToGate` elapses from today). We therefore
  // present-value K before plugging it into the lattice; using face-value K
  // overstates the strike price for long-dated gates and undervalues deep-
  // OTM options. (Trigeorgis 2017, §6.3)
  const optionValueByPhase: RealOptionsResult['optionValueByPhase'] = [];

  // The underlying for the final phase is the total unadjusted commercial value
  let downstreamValue = totalCashFlowPV;

  // Build cumulative time-to-gate offsets so earlier phases carry shorter
  // discount horizons than later phases.
  const cumulativeTimeToGate: number[] = new Array(remainingPhases.length).fill(0);
  let runningT = 0;
  for (let i = 0; i < remainingPhases.length; i++) {
    // Gate for phase i is reached after the phase's duration elapses
    runningT += Math.max(remainingPhases[i].duration, 0.25);
    cumulativeTimeToGate[i] = runningT;
  }

  // Process phases in reverse order (last phase first)
  for (let i = remainingPhases.length - 1; i >= 0; i--) {
    const phase = remainingPhases[i];
    const S = downstreamValue;
    const T = Math.max(phase.duration, 0.25); // Floor at 3 months
    const yearsToGate = cumulativeTimeToGate[i];
    // Discount the strike (phase cost) to present using the risk-free rate.
    const K = phase.cost / Math.pow(1 + rf, yearsToGate);

    // Price the option using CRR binomial lattice
    const optionValue = buildCRRLattice(S, K, T, sigma, rf, N);
    const intrinsicValue = Math.max(S - K, 0);
    const timeValue = Math.max(optionValue - intrinsicValue, 0);

    optionValueByPhase.unshift({
      phase: phase.phase,
      optionValue: Math.round(optionValue * 10) / 10,
      intrinsicValue: Math.round(intrinsicValue * 10) / 10,
      timeValue: Math.round(timeValue * 10) / 10,
    });

    // The option value of this phase becomes the underlying for the previous phase
    downstreamValue = optionValue;
  }

  // --- 6. Compute aggregate metrics ---
  const totalOptionValue = optionValueByPhase.length > 0
    ? optionValueByPhase[0].optionValue
    : baseResult.riskAdjustedNPV;

  const flexibilityPremium = totalOptionValue - baseResult.riskAdjustedNPV;
  const flexibilityPremiumPercent = baseResult.riskAdjustedNPV !== 0
    ? (flexibilityPremium / Math.abs(baseResult.riskAdjustedNPV)) * 100
    : 0;

  // --- 7. Generate narrative ---
  const phaseCount = remainingPhases.length;
  const totalTimeValue = optionValueByPhase.reduce((sum, p) => sum + p.timeValue, 0);

  let narrative: string;
  if (flexibilityPremiumPercent > 30) {
    narrative = `The real options analysis reveals substantial embedded flexibility worth ` +
      `$${flexibilityPremium.toFixed(0)}M (${flexibilityPremiumPercent.toFixed(1)}% above static rNPV). ` +
      `Across ${phaseCount} remaining development phase${phaseCount > 1 ? 's' : ''}, ` +
      `management's ability to abandon or continue at each gate generates ` +
      `$${totalTimeValue.toFixed(0)}M in aggregate time value. ` +
      `This is consistent with early-stage assets where high uncertainty creates ` +
      `valuable optionality. The static rNPV understates true asset value by ` +
      `not accounting for this management flexibility. ` +
      `Implied volatility: ${(sigma * 100).toFixed(0)}% (derived from Monte Carlo P10/P90 spread).`;
  } else if (flexibilityPremiumPercent > 10) {
    narrative = `Real options analysis adds $${flexibilityPremium.toFixed(0)}M ` +
      `(${flexibilityPremiumPercent.toFixed(1)}%) to the static rNPV. ` +
      `The ${phaseCount} remaining phase gate${phaseCount > 1 ? 's provide' : ' provides'} ` +
      `meaningful optionality through the right to abandon if data readouts are unfavorable. ` +
      `Time value of $${totalTimeValue.toFixed(0)}M reflects moderate remaining uncertainty. ` +
      `Implied volatility: ${(sigma * 100).toFixed(0)}%.`;
  } else {
    narrative = `The real options overlay adds a modest $${flexibilityPremium.toFixed(0)}M ` +
      `(${flexibilityPremiumPercent.toFixed(1)}%) flexibility premium. ` +
      `With ${phaseCount} remaining gate${phaseCount > 1 ? 's' : ''} and ` +
      `relatively low remaining uncertainty (implied vol: ${(sigma * 100).toFixed(0)}%), ` +
      `the static rNPV captures most of the asset's value. ` +
      `The limited time value ($${totalTimeValue.toFixed(0)}M) indicates the ` +
      `asset is deep in-the-money at most remaining decision points.`;
  }

  return {
    optionValueByPhase,
    totalOptionValue: Math.round(totalOptionValue * 10) / 10,
    flexibilityPremium: Math.round(flexibilityPremium * 10) / 10,
    flexibilityPremiumPercent: Math.round(flexibilityPremiumPercent * 10) / 10,
    volatilityUsed: Math.round(sigma * 1000) / 1000,
    riskFreeRate: rf,
    latticeSteps: N,
    narrative,
    underlyingFlooredToZero,
  };
}

// ==========================================================================
// Upgrade 6: Enhanced Monte Carlo Correlation (Phase-Dependent)
// ==========================================================================

/**
 * Returns a 5x5 correlation matrix [PoS, PeakSales, Rate, Time, Pricing]
 * that varies by development phase.
 *
 * Rationale: The strength of inter-variable correlations changes as an
 * asset matures through development:
 *
 * - **Early stage** (preclinical, Phase 1): High PoS-PeakSales correlation
 *   (0.55) because if the drug works, it likely addresses a large unmet need.
 *   Strong uncertainty coupling across all variables.
 *
 * - **Mid stage** (Phase 2): Moderate correlation (0.50) as proof-of-concept
 *   data partially resolves the PoS-commercial linkage.
 *
 * - **Late stage** (Phase 3, approved): Lower correlation (0.35) because
 *   clinical validation is largely confirmed; remaining uncertainty is
 *   primarily commercial (pricing, market access, competition).
 *
 * Sources: DealForma correlation analysis stratified by phase (2020-2025),
 * Lo & Pisani (2015) empirical pharma outcome distributions.
 *
 * @param phase - Current development phase of the asset
 * @returns Object containing the 5x5 correlation matrix and variable labels
 *
 * @example
 * ```ts
 * const { matrix, labels } = getEnhancedCorrelationMatrix('phase1');
 * // matrix[0][1] = 0.55 (PoS-PeakSales, early stage)
 * ```
 */
export function getEnhancedCorrelationMatrix(
  phase: string,
): { matrix: number[][]; labels: string[] } {
  const labels = [
    'Probability of Success',
    'Peak Sales',
    'Discount Rate',
    'Time to Market',
    'Pricing',
  ];

  const earlyPhases = ['discovery', 'preclinical', 'phase1'];
  const midPhases = ['phase1_2', 'phase2'];
  // Late phases: phase2_3, phase3, nda_filed, approved (default)

  let rhoPosPeak: number;
  let rhoPoSRate: number;
  let rhoPoSTime: number;
  let rhoPeakTime: number;
  let rhoPeakPrice: number;
  let rhoRateTime: number;

  if (earlyPhases.includes(phase)) {
    // Early stage: strong coupling between success and commercial potential
    rhoPosPeak = 0.55;
    rhoPoSRate = -0.35;
    rhoPoSTime = -0.30;
    rhoPeakTime = -0.40;
    rhoPeakPrice = 0.25;
    rhoRateTime = 0.30;
  } else if (midPhases.includes(phase)) {
    // Mid stage: moderate coupling, PoC data partially resolves uncertainty
    rhoPosPeak = 0.50;
    rhoPoSRate = -0.30;
    rhoPoSTime = -0.25;
    rhoPeakTime = -0.35;
    rhoPeakPrice = 0.20;
    rhoRateTime = 0.25;
  } else {
    // Late stage: weaker coupling, residual uncertainty is primarily commercial
    rhoPosPeak = 0.35;
    rhoPoSRate = -0.25;
    rhoPoSTime = -0.20;
    rhoPeakTime = -0.30;
    rhoPeakPrice = 0.15;
    rhoRateTime = 0.20;
  }

  const matrix: number[][] = [
    //  PoS        PeakSales   Rate         Time         Pricing
    [   1.00,      rhoPosPeak, rhoPoSRate,  rhoPoSTime,  0.00       ],  // PoS
    [   rhoPosPeak, 1.00,      0.00,        rhoPeakTime, rhoPeakPrice], // Peak Sales
    [   rhoPoSRate, 0.00,      1.00,        rhoRateTime, 0.00       ],  // Discount Rate
    [   rhoPoSTime, rhoPeakTime, rhoRateTime, 1.00,      0.00       ],  // Time to Market
    [   0.00,      rhoPeakPrice, 0.00,       0.00,       1.00       ],  // Pricing
  ];

  // Sanity check: enforce diagonal = 1 and off-diagonals ∈ [-1, 1].
  // This is a minimal guardrail; Cholesky further downstream would throw on
  // non-PSD matrices, but this catches hand-editing mistakes early and clamps
  // out-of-range entries to avoid silent numerical blow-ups.
  let clamped = false;
  for (let i = 0; i < matrix.length; i++) {
    if (matrix[i][i] !== 1.0) {
      matrix[i][i] = 1.0;
      clamped = true;
    }
    for (let j = 0; j < matrix[i].length; j++) {
      if (i !== j && (matrix[i][j] < -1 || matrix[i][j] > 1)) {
        matrix[i][j] = Math.max(-1, Math.min(1, matrix[i][j]));
        clamped = true;
      }
    }
  }
  if (clamped && typeof console !== 'undefined') {
    console.warn('[advanced-upgrades] Correlation matrix entries clamped to [-1, 1] / diag=1');
  }

  return { matrix, labels };
}

/**
 * Apply a conditional floor to sampled peak sales based on the sampled
 * probability of success.
 *
 * In reality, drugs that barely demonstrate efficacy (low PoS) cannot
 * achieve blockbuster peak sales. This function enforces a conditional
 * ceiling on peak sales when the sampled PoS multiplier indicates
 * near-failure scenarios, preventing the Monte Carlo simulation from
 * generating unrealistic combinations (e.g., 5% PoS with $5B peak sales).
 *
 * Thresholds are calibrated to empirical pharma outcomes:
 * - Below 0.50x PoS (drug barely works): cap peak sales at 0.60x base
 * - Below 0.25x PoS (near-failure): cap peak sales at 0.30x base
 * - Above 0.50x PoS: no adjustment (market can price freely)
 *
 * Sources: Analysis of Phase 2 readout-to-peak-sales correlation across
 * 200+ approved drugs (EvaluatePharma, 2015-2024).
 *
 * @param sampledPoSMultiplier       - Sampled PoS as a fraction of the base PoS (0-2+)
 * @param sampledPeakSalesMultiplier - Sampled peak sales as a fraction of base (0-3+)
 * @param basePoS                    - Base-case probability of success (0-1), currently unused
 *                                     but reserved for future TA-specific floor calibration
 * @returns Adjusted peak sales multiplier, potentially capped downward
 *
 * @example
 * ```ts
 * // Drug barely works (PoS multiplier = 0.40x base)
 * const adjusted = applyConditionalPeakSalesFloor(0.40, 1.50, 0.12);
 * // Returns 0.60 (capped from 1.50)
 *
 * // Drug shows strong signal (PoS multiplier = 0.80x base)
 * const unchanged = applyConditionalPeakSalesFloor(0.80, 1.50, 0.12);
 * // Returns 1.50 (unchanged)
 * ```
 */
export function applyConditionalPeakSalesFloor(
  sampledPoSMultiplier: number,
  sampledPeakSalesMultiplier: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  basePoS: number,
): number {
  if (sampledPoSMultiplier < 0.25) {
    // Near-failure: severely cap commercial potential
    return Math.min(sampledPeakSalesMultiplier, 0.30);
  }

  if (sampledPoSMultiplier < 0.50) {
    // Drug barely works: meaningful cap on peak sales
    return Math.min(sampledPeakSalesMultiplier, 0.60);
  }

  // Above 0.50: no constraint, market prices freely
  return sampledPeakSalesMultiplier;
}
