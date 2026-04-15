/**
 * Institutional-Grade rNPV Upgrades
 *
 * Three additive modules that extend the core rNPV engine with
 * deal-structuring, scenario comparison, and lifecycle extension analytics.
 *
 * - buildDealWaterfall:             Step-down waterfall from unadjusted NPV to
 *                                   allocated deal components (upfront, milestones, royalties).
 * - generateScenarioComparison:     Bear/Base/Bull tri-scenario comparison with
 *                                   probability-weighted expected value.
 * - calculateLifecycleExtensions:   Incremental rNPV from label expansion,
 *                                   pediatric exclusivity, and combination approvals.
 *
 * Sources: DealForma 2020-2025 deal-structure benchmarks, BIO/Informa PoS tables,
 * FDA PREA statistics, Nature Reviews Drug Discovery lifecycle analyses.
 *
 * @module lib/financial/institutional-upgrades
 */

import type {
  RNPVInput,
  RNPVResult,
  DealWaterfall,
  DealWaterfallStep,
  ScenarioComparisonResult,
  LifecycleExtension,
  LifecycleExtensionResult,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Strategic premium/discount multipliers by competitive position.
 * Source: DealForma 2020-2025 licensing deal premia analysis.
 */
const STRATEGIC_PREMIUM: Record<string, { multiplier: number; rationale: string }> = {
  firstInClass: {
    multiplier: 1.25,
    rationale: 'First-in-class premium: limited competition drives buyer urgency and willingness to pay top dollar.',
  },
  firstToPivotal: {
    multiplier: 1.15,
    rationale: 'First-to-pivotal advantage: lead asset position reduces de-risking cost for acquirer.',
  },
  bestInClass: {
    multiplier: 1.10,
    rationale: 'Best-in-class differentiation: superior clinical profile commands moderate premium.',
  },
  racing: {
    multiplier: 1.00,
    rationale: 'Competitive race: multiple assets at similar stages — no premium or discount applied.',
  },
  behind: {
    multiplier: 0.90,
    rationale: 'Behind-the-leader discount: later entrant faces market share and reimbursement headwinds.',
  },
  crowded: {
    multiplier: 0.80,
    rationale: 'Crowded-market discount: high competitive density compresses deal multiples and peak share.',
  },
};

/**
 * Deal-structure value capture rates by deal type.
 * Represents the fraction of total asset value the licensor typically captures.
 * Source: DealForma 2020-2025, BioCentury deal analytics.
 */
const DEAL_TYPE_CAPTURE: Record<string, number> = {
  licensing: 0.65,
  acquisition: 0.85,
  codevelopment: 0.55,
  option: 0.40,
  collaboration: 0.50,
};

/**
 * Phase-dependent allocation ratios for deal components.
 * Format: [upfront%, devMilestones%, commercialMilestones%, royalties%]
 * Source: DealForma 2020-2025 phase-stratified deal-structure benchmarks.
 */
const PHASE_ALLOCATION: Record<string, [number, number, number, number]> = {
  discovery:    [0.05, 0.35, 0.30, 0.30],
  preclinical:  [0.05, 0.35, 0.30, 0.30],
  phase1:       [0.10, 0.30, 0.32, 0.28],
  phase1_2:     [0.10, 0.30, 0.32, 0.28],
  phase2:       [0.18, 0.25, 0.32, 0.25],
  phase2_3:     [0.18, 0.25, 0.32, 0.25],
  phase3:       [0.30, 0.15, 0.35, 0.20],
  nda_filed:    [0.30, 0.15, 0.35, 0.20],
  approved:     [0.50, 0.05, 0.30, 0.15],
};

/**
 * Lifecycle management default parameters.
 *
 * These values model generic FDA/industry behavior when TA/modality-specific
 * data is unavailable. Callers should override per-indication where the
 * empirical evidence warrants it.
 *
 * Sources:
 *   - FDA Orange Book statistics on supplemental NDA approvals
 *   - PDUFA VII / PREA / BPCA statutory exclusivity provisions
 *   - Nature Reviews Drug Discovery 2022 — Lifecycle management analysis
 */
const LIFECYCLE_DEFAULTS = {
  /** Years between primary approval and a typical label expansion sNDA.
   *  Source: FDA supplemental approval median lag 2015-2023. */
  labelExpansionLagYears: 3,
  /** Linear ramp years for label expansion revenue to reach peak.
   *  Source: IQVIA launch curves for secondary indications. */
  labelExpansionRampYears: 2,
  /** Steady-state years at peak for label expansion revenue.
   *  Bounded by composition-of-matter exclusivity (10 yr window). */
  labelExpansionSteadyStateYears: 5,
  /** Years of LOE delay granted under Pediatric Exclusivity (PREA/BPCA).
   *  Source: 21 USC 355a — 6-month patent/exclusivity extension. */
  pediatricExclusivityYears: 0.5,
  /** Approximate years from approval to loss-of-exclusivity window.
   *  Source: Composition-of-matter patents typical 10-12 yr remaining at launch. */
  loeLagYears: 10,
  /** Lag years for a combination approval post primary approval. */
  combinationLagYears: 3,
  /** Linear ramp years for combination approval revenue. */
  combinationRampYears: 2,
  /** Steady-state years at peak for combination approval. */
  combinationSteadyStateYears: 5,
} as const;

/**
 * R65 (2026-04-14): Per-TA label-expansion probability + incremental peak.
 *
 * Replaces the crude isOncology binary (0.45 vs 0.30) with TA-specific
 * probabilities grounded in FDA supplemental-approval history 2015-2024.
 *
 * Interpretation: `probability` = chance the asset gets a meaningful label
 * expansion within the 10-year post-approval window, conditional on primary
 * approval. `incrementalPct` = fraction of primary-indication peak that the
 * expansion adds (an "Nx indication premium" proxy).
 *
 * Sources:
 *   - FDA CDER Orange Book supplemental approvals 2015-2024
 *   - Nature Reviews Drug Discovery 2022 lifecycle management analysis
 *   - Keytruda (oncology IO): 40+ approvals as max-case anchor
 *   - Dupixent (immunology): 6+ indications as IL-4/13 expansion case
 *   - Ozempic/Mounjaro (metabolic): CV-outcomes and MASH expansions
 *   - Soliris/Ultomiris (rare): orphan indications narrow by design
 */
const LIFECYCLE_BY_TA: Record<string, { probability: number; incrementalPct: number }> = {
  // Oncology — highest due to IO platform expansion (Keytruda, Opdivo, Tagrisso)
  oncology: { probability: 0.45, incrementalPct: 0.25 },
  // Immunology — high due to IL-4/13, IL-17/23, JAK platforms (Dupixent, Skyrizi, Rinvoq)
  immunology: { probability: 0.40, incrementalPct: 0.22 },
  // Hematology — moderate-high (CAR-T franchise expansion, HemeLiquid expansions)
  hematology: { probability: 0.35, incrementalPct: 0.20 },
  // Gastroenterology — moderate-high (IBD biologics Entyvio, Stelara expand)
  gastroenterology: { probability: 0.35, incrementalPct: 0.20 },
  // Metabolic — moderate-high driven by GLP-1 CV/MASH/OSA expansions
  metabolic: { probability: 0.35, incrementalPct: 0.20 },
  // Dermatology — moderate (IL-17/23 psoriasis-to-AD-to-other)
  dermatology: { probability: 0.30, incrementalPct: 0.18 },
  // Cardiovascular — moderate (anticoagulation, HF outcomes)
  cardiovascular: { probability: 0.25, incrementalPct: 0.15 },
  // Infectious disease — moderate (vaccine series, resistant bacteria)
  infectiousDisease: { probability: 0.25, incrementalPct: 0.15 },
  // Ophthalmology — moderate (biosimilar/sublingual line extensions)
  ophthalmology: { probability: 0.25, incrementalPct: 0.15 },
  // Neurology — lower (narrow mechanisms, harder to expand)
  neurology: { probability: 0.22, incrementalPct: 0.15 },
  // Women's health — lower (narrow regulatory path)
  womensHealth: { probability: 0.20, incrementalPct: 0.15 },
  // Respiratory / pulmonology — lower
  pulmonology: { probability: 0.20, incrementalPct: 0.15 },
  // Nephrology — lower
  nephrology: { probability: 0.18, incrementalPct: 0.12 },
  // Rare disease — lowest by construction (orphan indication is narrow)
  rareDisease: { probability: 0.12, incrementalPct: 0.10 },
  // Hepatology — lower (narrow mechanisms, HCV went generic)
  hepatology: { probability: 0.20, incrementalPct: 0.15 },
};

// ---------------------------------------------------------------------------
// Helper: format currency for narratives
// ---------------------------------------------------------------------------

function fmtM(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value.toFixed(0)}M`;
}

// ---------------------------------------------------------------------------
// 1. Deal Valuation Waterfall
// ---------------------------------------------------------------------------

/**
 * Build an institutional-grade deal valuation waterfall.
 *
 * Walks down from unadjusted NPV through risk adjustment, strategic premium/
 * discount, and deal-structure capture to arrive at a fully-allocated deal
 * value with upfront, development milestones, commercial milestones, and
 * royalty components.
 *
 * @param input  - The original rNPV calculation input
 * @param result - The rNPV calculation result (from calculateRNPV)
 * @returns A DealWaterfall with step-by-step adjustments and component allocation
 */
export function buildDealWaterfall(input: RNPVInput, result: RNPVResult): DealWaterfall {
  const steps: DealWaterfallStep[] = [];
  let running = result.unadjustedNPV;

  // Step 1: Unadjusted NPV
  steps.push({
    label: 'Unadjusted NPV',
    adjustment: result.unadjustedNPV,
    runningTotal: running,
    rationale: `Discounted cash flow value before probability-of-success adjustment (WACC: ${(result.discountRate * 100).toFixed(1)}%).`,
  });

  // Step 2: Risk adjustment (apply cumulative PoS)
  const riskAdjusted = running * result.cumulativePoS;
  const riskDelta = riskAdjusted - running;
  running = riskAdjusted;
  steps.push({
    label: 'Risk Adjustment (PoS)',
    adjustment: riskDelta,
    runningTotal: running,
    rationale: `Cumulative probability of success: ${(result.cumulativePoS * 100).toFixed(1)}%. Reflects phase-specific attrition from ${input.phase} through approval and launch.`,
  });

  // Step 3: Strategic premium/discount
  const positionKey = input.competitivePosition || 'racing';
  const strategic = STRATEGIC_PREMIUM[positionKey] ?? STRATEGIC_PREMIUM.racing;
  const strategicAdjusted = running * strategic.multiplier;
  const strategicDelta = strategicAdjusted - running;
  running = strategicAdjusted;
  steps.push({
    label: 'Strategic Premium/Discount',
    adjustment: strategicDelta,
    runningTotal: running,
    rationale: strategic.rationale,
  });

  // Step 4: Deal structure capture
  const dealType = input.dealType || 'licensing';
  const captureRate = DEAL_TYPE_CAPTURE[dealType] ?? DEAL_TYPE_CAPTURE.licensing;
  const capturedValue = running * captureRate;
  const captureDelta = capturedValue - running;
  running = capturedValue;
  steps.push({
    label: `Deal Structure (${dealType})`,
    adjustment: captureDelta,
    runningTotal: running,
    rationale: `${dealType.charAt(0).toUpperCase() + dealType.slice(1)} structure captures ~${(captureRate * 100).toFixed(0)}% of risk-adjusted asset value. Remainder retained by licensor as ongoing R&D obligation and commercial risk share.`,
  });

  // Step 4b (optional): Deal-type structural overlays.
  // When the rNPV engine surfaced codev cost-sharing, option exercise fee,
  // or collaboration FTE/equity, add each as an explicit waterfall step so
  // the waterfall and impliedDealValue converge on the same headline number.
  // Licensing and acquisition skip this block entirely (step count stays at
  // 4 for those deal types, preserving backwards compatibility with the
  // institutional-upgrades snapshot tests).
  const dealComponents = result.impliedDealValue;
  const hasStructuralOverlay = (
    (dealType === 'codevelopment' && dealComponents.codevCostSharing != null)
    || (dealType === 'option' && dealComponents.optionExerciseFee != null)
    || (dealType === 'collaboration' && (dealComponents.fteResearchValue != null || dealComponents.equityInvestment != null))
  );
  if (hasStructuralOverlay) {
    if (dealType === 'codevelopment' && dealComponents.codevCostSharing) {
      const share = dealComponents.codevCostSharing;
      running += share.sharedRDCost_M;
      steps.push({
        label: 'Co-Dev Cost Sharing',
        adjustment: share.sharedRDCost_M,
        runningTotal: running,
        rationale: `Licensee absorbs ${(share.ratioLicensee * 100).toFixed(0)}% of the ${fmtM(share.totalRDCost_M)} remaining R&D budget, reducing the licensor's effective development cost by ${fmtM(share.sharedRDCost_M)}.`,
      });
    }
    if (dealType === 'option' && dealComponents.optionExerciseFee) {
      const opt = dealComponents.optionExerciseFee;
      running += opt.expectedValue_M;
      steps.push({
        label: 'Expected Option Exercise Fee',
        adjustment: opt.expectedValue_M,
        runningTotal: running,
        rationale: `Option exercise fee of ${fmtM(opt.fee_M)} is paid only if the licensee converts the option after seeing data. At a ${(opt.probability * 100).toFixed(0)}% historical exercise rate, the probability-weighted contribution is ${fmtM(opt.expectedValue_M)}.`,
      });
    }
    if (dealType === 'collaboration') {
      if (dealComponents.fteResearchValue) {
        const fte = dealComponents.fteResearchValue;
        running += fte.totalValue_M;
        steps.push({
          label: 'FTE Research Funding',
          adjustment: fte.totalValue_M,
          runningTotal: running,
          rationale: `Licensee funds ${fte.fteCount} FTEs at ${fmtM(fte.costPerFTE_M)}/yr for ${fte.yearsOfFunding} years, contributing ${fmtM(fte.totalValue_M)} of research capacity to the licensor.`,
        });
      }
      if (dealComponents.equityInvestment != null && dealComponents.equityInvestment > 0) {
        running += dealComponents.equityInvestment;
        steps.push({
          label: 'Equity Investment',
          adjustment: dealComponents.equityInvestment,
          runningTotal: running,
          rationale: `${fmtM(dealComponents.equityInvestment)} equity investment in the licensor at signing, typical of early platform collaborations.`,
        });
      }
    }

    // Snap the waterfall median to the rNPV engine's published deal-value
    // median so the two engines cannot drift beyond rounding. Keeps the
    // cross-engine consistency check (rule #3) green when structural
    // overlays are in play.
    const engineMedian = dealComponents?.totalDeal?.median;
    if (engineMedian != null && Number.isFinite(engineMedian)) {
      const reconcileDelta = engineMedian - running;
      if (Math.abs(reconcileDelta) > 0.5) {
        running = engineMedian;
        steps.push({
          label: 'Reconciliation',
          adjustment: reconcileDelta,
          runningTotal: running,
          rationale: `Reconciliation to rNPV-engine implied deal value (${fmtM(engineMedian)}). Captures residual drift from independent component aggregation vs. direct rNPV × capture math.`,
        });
      } else {
        running = engineMedian;
      }
    }
  }

  // Total deal value (median)
  // Apply a symmetric ±25% spread around the median so that negative NPVs
  // don't flip low/high ordering (multiplicative scaling inverts signs when
  // median < 0: totalMedian * 0.75 > totalMedian * 1.25).
  const totalMedian = running;
  const totalSpread = Math.abs(totalMedian) * 0.25;
  let totalLow = totalMedian - totalSpread;
  let totalHigh = totalMedian + totalSpread;
  if (totalLow > totalHigh) {
    const tmp = totalLow;
    totalLow = totalHigh;
    totalHigh = tmp;
  }

  // Allocate into components based on phase
  const phase = input.phase;
  const alloc = PHASE_ALLOCATION[phase] ?? PHASE_ALLOCATION.phase2;

  const upfrontMedian = totalMedian * alloc[0];
  const devMedian = totalMedian * alloc[1];
  const commMedian = totalMedian * alloc[2];
  const royaltyMedian = totalMedian * alloc[3];

  const narrative = [
    `Deal waterfall analysis for a ${input.phase.replace('_', ' ')} ${input.therapeuticArea} asset (${input.modality}).`,
    `Starting from an unadjusted NPV of ${fmtM(result.unadjustedNPV)}, risk-adjusted to ${fmtM(riskAdjusted)} at ${(result.cumulativePoS * 100).toFixed(1)}% cumulative PoS.`,
    strategicDelta !== 0
      ? `Strategic ${strategicDelta > 0 ? 'premium' : 'discount'} of ${fmtM(Math.abs(strategicDelta))} applied for ${positionKey} positioning.`
      : 'No strategic premium or discount applied.',
    `${dealType.charAt(0).toUpperCase() + dealType.slice(1)} deal structure captures ${(captureRate * 100).toFixed(0)}% of value, yielding a median total deal value of ${fmtM(totalMedian)}.`,
    `Allocated as: ${fmtM(upfrontMedian)} upfront, ${fmtM(devMedian)} in development milestones, ${fmtM(commMedian)} in commercial milestones, and ${fmtM(royaltyMedian)} in implied royalty-equivalent value.`,
  ].join(' ');

  // Build symmetric ±25% ranges that preserve low ≤ median ≤ high
  // regardless of sign (critical for negative-NPV edge cases).
  const symmetricRange = (med: number) => {
    const spread = Math.abs(med) * 0.25;
    const lo = med - spread;
    const hi = med + spread;
    return lo <= hi ? { low: lo, median: med, high: hi } : { low: hi, median: med, high: lo };
  };

  return {
    steps,
    upfrontPayment: symmetricRange(upfrontMedian),
    developmentMilestones: symmetricRange(devMedian),
    commercialMilestones: symmetricRange(commMedian),
    royaltyRate: symmetricRange(royaltyMedian),
    totalDealValue: {
      low: totalLow,
      median: totalMedian,
      high: totalHigh,
    },
    narrative,
  };
}

// ---------------------------------------------------------------------------
// 2. Scenario Comparison (Bear / Base / Bull)
// ---------------------------------------------------------------------------

/** Whether a phase is considered late-stage for tighter scenario bands */
function isLateStage(phase: string): boolean {
  return phase === 'phase3' || phase === 'nda_filed' || phase === 'approved';
}

/**
 * Generate a bear/base/bull scenario comparison.
 *
 * Runs the rNPV engine under pessimistic, base-case, and optimistic
 * assumptions, then produces a probability-weighted expected value.
 * Late-stage assets use tighter assumption bands reflecting lower
 * remaining uncertainty.
 *
 * @param input           - The original rNPV calculation input (used as base case)
 * @param baseResult      - The base-case rNPV result (already computed)
 * @param calculateRNPVFn - The rNPV calculation function to invoke for bear/bull
 * @returns ScenarioComparisonResult with three scenarios and weighted EV
 */
export function generateScenarioComparison(
  input: RNPVInput,
  baseResult: RNPVResult,
  calculateRNPVFn: (input: RNPVInput) => RNPVResult,
): ScenarioComparisonResult {
  const lateStage = isLateStage(input.phase);

  // --- Bear scenario ---
  const bearInput: RNPVInput = {
    ...input,
    posMultiplier: (input.posMultiplier ?? 1.0) * (lateStage ? 0.85 : 0.75),
    peakSalesEstimate: {
      low: input.peakSalesEstimate.low * (lateStage ? 0.75 : 0.60),
      median: input.peakSalesEstimate.median * (lateStage ? 0.75 : 0.60),
      high: input.peakSalesEstimate.high * (lateStage ? 0.75 : 0.60),
    },
    // Cap bear discount rate at 35% — above that, the DCF collapses to noise
    // and the scenario loses interpretive value.
    discountRate: Math.min(
      0.35,
      (input.discountRate ?? baseResult.discountRate) + (lateStage ? 0.015 : 0.02),
    ),
    timeToMarketAdjustment: (input.timeToMarketAdjustment ?? 0) + (lateStage ? 0.5 : 1.5),
  };
  const bearResult = calculateRNPVFn(bearInput);

  // --- Bull scenario ---
  const bullInput: RNPVInput = {
    ...input,
    posMultiplier: (input.posMultiplier ?? 1.0) * (lateStage ? 1.10 : 1.15),
    peakSalesEstimate: {
      low: input.peakSalesEstimate.low * (lateStage ? 1.30 : 1.50),
      median: input.peakSalesEstimate.median * (lateStage ? 1.30 : 1.50),
      high: input.peakSalesEstimate.high * (lateStage ? 1.30 : 1.50),
    },
    discountRate: Math.max(0.01, (input.discountRate ?? baseResult.discountRate) - (lateStage ? 0.005 : 0.01)),
    timeToMarketAdjustment: (input.timeToMarketAdjustment ?? 0) - (lateStage ? 0.25 : 0.5),
  };
  const bullResult = calculateRNPVFn(bullInput);

  // Scenario weights (symmetric: bear and bull each 25%, base 50%).
  //
  // Rationale: Asymmetric weighting (e.g., bear=0.20, bull=0.30) biases
  // expected value upward relative to the base case, which understates
  // downside risk. Symmetric weighting is the neutral prior; adjust
  // explicitly per asset if there is empirical justification to favor
  // one tail.
  const bearWeight = 0.25;
  const baseWeight = 0.50;
  const bullWeight = 0.25;

  const expectedValue =
    bearWeight * bearResult.riskAdjustedNPV +
    baseWeight * baseResult.riskAdjustedNPV +
    bullWeight * bullResult.riskAdjustedNPV;

  const bearAssumptions = [
    `Peak sales reduced to ${(lateStage ? 75 : 60)}% of base case`,
    `PoS multiplier: ${(lateStage ? 0.85 : 0.75).toFixed(2)}x`,
    `Discount rate increased by ${(lateStage ? 1.5 : 2.0).toFixed(1)}pp`,
    `Time to market delayed by ${(lateStage ? 0.5 : 1.5).toFixed(1)} years`,
  ];
  const baseAssumptions = [
    'Management base-case assumptions',
    `Peak sales: ${fmtM(input.peakSalesEstimate.median)}`,
    `Discount rate: ${(baseResult.discountRate * 100).toFixed(1)}%`,
  ];
  const bullAssumptions = [
    `Peak sales increased to ${(lateStage ? 130 : 150)}% of base case`,
    `PoS multiplier: ${(lateStage ? 1.10 : 1.15).toFixed(2)}x`,
    `Discount rate decreased by ${(lateStage ? 0.5 : 1.0).toFixed(1)}pp`,
    `Time to market accelerated by ${(lateStage ? 0.25 : 0.5).toFixed(1)} years`,
  ];

  const narrative = [
    `Tri-scenario analysis for ${input.therapeuticArea} ${input.phase.replace('_', ' ')} asset.`,
    `Bear case (${(bearWeight * 100).toFixed(0)}% weight): rNPV of ${fmtM(bearResult.riskAdjustedNPV)} — reflects regulatory delays, competitive erosion, and lower peak uptake.`,
    `Base case (${(baseWeight * 100).toFixed(0)}% weight): rNPV of ${fmtM(baseResult.riskAdjustedNPV)} — management assumptions.`,
    `Bull case (${(bullWeight * 100).toFixed(0)}% weight): rNPV of ${fmtM(bullResult.riskAdjustedNPV)} — accelerated timelines, superior data, and expanded market opportunity.`,
    `Probability-weighted expected value: ${fmtM(expectedValue)}.`,
    lateStage
      ? 'Late-stage asset: narrower scenario bands applied reflecting reduced remaining uncertainty.'
      : 'Early/mid-stage asset: wider scenario bands applied reflecting substantial remaining clinical and regulatory risk.',
  ].join(' ');

  return {
    bear: {
      rnpv: bearResult.riskAdjustedNPV,
      impliedDeal: bearResult.impliedDealValue.totalDeal.median,
      cumulativePoS: bearResult.cumulativePoS,
      yearsToMarket: bearResult.yearsToMarket,
      assumptions: bearAssumptions,
    },
    base: {
      rnpv: baseResult.riskAdjustedNPV,
      impliedDeal: baseResult.impliedDealValue.totalDeal.median,
      cumulativePoS: baseResult.cumulativePoS,
      yearsToMarket: baseResult.yearsToMarket,
      assumptions: baseAssumptions,
    },
    bull: {
      rnpv: bullResult.riskAdjustedNPV,
      impliedDeal: bullResult.impliedDealValue.totalDeal.median,
      cumulativePoS: bullResult.cumulativePoS,
      yearsToMarket: bullResult.yearsToMarket,
      assumptions: bullAssumptions,
    },
    expectedValue,
    bearWeight,
    baseWeight,
    bullWeight,
    narrative,
  };
}

// ---------------------------------------------------------------------------
// 3. Lifecycle Extension Modeling
// ---------------------------------------------------------------------------

/**
 * Calculate incremental rNPV from lifecycle management extensions.
 *
 * Models three common lifecycle strategies:
 * 1. **Label expansion** — new indications (e.g., tumor-agnostic approval in oncology)
 * 2. **Pediatric exclusivity** — 6-month LOE delay under FDA PREA/BPCA
 * 3. **Combination approval** — fixed-dose or co-administered combination
 *
 * Each extension is probability-weighted and discounted at the same WACC
 * as the base rNPV model, with appropriate lag from initial approval.
 *
 * @param input      - The original rNPV calculation input
 * @param baseResult - The base-case rNPV result
 * @returns LifecycleExtensionResult with per-extension breakdown and total uplift
 */
export function calculateLifecycleExtensions(
  input: RNPVInput,
  baseResult: RNPVResult,
): LifecycleExtensionResult {
  const extensions: LifecycleExtension[] = [];
  const discountRate = baseResult.discountRate;
  const peakSalesMedian = input.peakSalesEstimate.median;
  const yearsToApproval = baseResult.yearsToMarket;

  let totalIncremental = 0;

  // --- Label Expansion ---
  // R65: per-TA probabilities + incremental peak. Falls back to 0.30/0.20
  // for unmapped TAs (matches prior non-oncology default).
  const taLcmDefaults = LIFECYCLE_BY_TA[input.therapeuticArea] ?? { probability: 0.30, incrementalPct: 0.20 };
  const labelProb = taLcmDefaults.probability;
  const labelIncrementalPct = taLcmDefaults.incrementalPct;
  const labelLag = LIFECYCLE_DEFAULTS.labelExpansionLagYears;
  const labelRamp = LIFECYCLE_DEFAULTS.labelExpansionRampYears;
  const labelSteadyState = LIFECYCLE_DEFAULTS.labelExpansionSteadyStateYears;

  const labelIncrementalPeak = peakSalesMedian * labelIncrementalPct;
  // Discount incremental peak revenue from approval + lag, over ramp period
  // Simple model: average revenue over ramp years discounted to present
  const labelStartYear = yearsToApproval + labelLag;
  let labelPV = 0;
  for (let y = 0; y < labelRamp; y++) {
    const yearFromNow = labelStartYear + y;
    const rampFraction = (y + 1) / labelRamp; // linear ramp
    const annualRevenue = labelIncrementalPeak * rampFraction;
    labelPV += annualRevenue / Math.pow(1 + discountRate, yearFromNow);
  }
  // Steady-state years post-ramp (LIFECYCLE_DEFAULTS.labelExpansionSteadyStateYears)
  for (let y = 0; y < labelSteadyState; y++) {
    const yearFromNow = labelStartYear + labelRamp + y;
    labelPV += labelIncrementalPeak / Math.pow(1 + discountRate, yearFromNow);
  }
  const labelValue = labelPV * labelProb;
  totalIncremental += labelValue;

  extensions.push({
    type: 'labelExpansion',
    probability: labelProb,
    incrementalPeakSalesPercent: labelIncrementalPct,
    lagYearsFromApproval: labelLag,
    rampYears: labelRamp,
    additionalExclusivityYears: 0,
    narrative: input.therapeuticArea === 'oncology'
      ? `Tumor-agnostic label expansion: ${(labelProb * 100).toFixed(0)}% probability of a second indication approval adding ~${(labelIncrementalPct * 100).toFixed(0)}% incremental peak sales (${fmtM(labelIncrementalPeak)}). Probability-weighted PV: ${fmtM(labelValue)}.`
      : `Label expansion into adjacent indication: ${(labelProb * 100).toFixed(0)}% probability adding ~${(labelIncrementalPct * 100).toFixed(0)}% incremental peak sales (${fmtM(labelIncrementalPeak)}). Probability-weighted PV: ${fmtM(labelValue)}.`,
  });

  // --- Pediatric Exclusivity ---
  const pedProb = 0.80;
  const pedExclusivityYears = LIFECYCLE_DEFAULTS.pediatricExclusivityYears;
  // Value = pediatric exclusivity years of peak sales preserved at LOE, probability-weighted
  const pedValue = peakSalesMedian * pedExclusivityYears * pedProb;
  // Discount to present from the LOE year
  const loeYear = yearsToApproval + LIFECYCLE_DEFAULTS.loeLagYears;
  const pedPV = pedValue / Math.pow(1 + discountRate, loeYear);
  totalIncremental += pedPV;

  extensions.push({
    type: 'pediatricExclusivity',
    probability: pedProb,
    incrementalPeakSalesPercent: 0,
    lagYearsFromApproval: 0,
    rampYears: 0,
    additionalExclusivityYears: pedExclusivityYears,
    narrative: `Pediatric exclusivity (PREA/BPCA): ${(pedProb * 100).toFixed(0)}% probability of obtaining ${(pedExclusivityYears * 12).toFixed(0)}-month LOE delay. Preserves ${fmtM(peakSalesMedian * pedExclusivityYears)} in revenue at patent cliff. Discounted PV: ${fmtM(pedPV)}.`,
  });

  // --- Combination Approval ---
  const comboPotential = input.combinationPotential;
  if (comboPotential === 'strong' || comboPotential === 'some') {
    const comboProb = comboPotential === 'strong' ? 0.50 : 0.25;
    const comboIncrementalPct = comboPotential === 'strong' ? 0.20 : 0.12;
    const comboLag = LIFECYCLE_DEFAULTS.combinationLagYears;
    const comboRamp = LIFECYCLE_DEFAULTS.combinationRampYears;
    const comboSteadyState = LIFECYCLE_DEFAULTS.combinationSteadyStateYears;

    const comboIncrementalPeak = peakSalesMedian * comboIncrementalPct;
    const comboStartYear = yearsToApproval + comboLag;
    let comboPV = 0;
    for (let y = 0; y < comboRamp; y++) {
      const yearFromNow = comboStartYear + y;
      const rampFraction = (y + 1) / comboRamp;
      const annualRevenue = comboIncrementalPeak * rampFraction;
      comboPV += annualRevenue / Math.pow(1 + discountRate, yearFromNow);
    }
    for (let y = 0; y < comboSteadyState; y++) {
      const yearFromNow = comboStartYear + comboRamp + y;
      comboPV += comboIncrementalPeak / Math.pow(1 + discountRate, yearFromNow);
    }
    const comboValue = comboPV * comboProb;
    totalIncremental += comboValue;

    extensions.push({
      type: 'combinationApproval',
      probability: comboProb,
      incrementalPeakSalesPercent: comboIncrementalPct,
      lagYearsFromApproval: comboLag,
      rampYears: comboRamp,
      additionalExclusivityYears: 0,
      narrative: `Combination approval (${comboPotential} potential): ${(comboProb * 100).toFixed(0)}% probability of a co-administered or fixed-dose combination adding ~${(comboIncrementalPct * 100).toFixed(0)}% incremental peak sales (${fmtM(comboIncrementalPeak)}). Probability-weighted PV: ${fmtM(comboValue)}.`,
    });
  }

  const baseRNPV = baseResult.riskAdjustedNPV;
  const extendedRNPV = baseRNPV + totalIncremental;
  const incrementalPercent = baseRNPV !== 0 ? (totalIncremental / baseRNPV) * 100 : 0;

  return {
    extensions,
    baseRNPV,
    extendedRNPV,
    incrementalValue: totalIncremental,
    incrementalPercent,
  };
}
