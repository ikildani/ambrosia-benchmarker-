/**
 * Financial Modeling Engine - Type Definitions
 *
 * Core types for the risk-adjusted NPV (rNPV) engine, Monte Carlo simulation,
 * market sizing, scenario planning, competitive analysis, and deal flow forecasting.
 *
 * These types are consumed by the rNPV calculator, Monte Carlo simulator,
 * and scenario analysis modules within lib/financial/.
 *
 * @module lib/financial/types
 */

import type { Phase, TherapeuticArea, Modality } from '@/lib/calculations';
import type { TimeWindow } from './pos-time-windows';
import type { Geography, GeographicSplit } from './geographic-revenue-curves';

// ---------------------------------------------------------------------------
// Phase Transition Probabilities
// ---------------------------------------------------------------------------

/**
 * Phase-to-phase transition probabilities for a given therapeutic area.
 *
 * Source: BIO/Informa "Clinical Development Success Rates and Contributing
 * Factors 2011-2020", cross-referenced with Nature Reviews Drug Discovery
 * 2021-2024 updates and FDA CDER approval statistics.
 *
 * Values represent the probability (0-1) of successfully advancing from one
 * development stage to the next.
 */
export interface PhaseTransitionRates {
  /** Target validation through IND-enabling studies */
  discoveryToPreclinical?: number;
  /** IND-enabling through first-in-human dosing */
  preclinicalToPhase1: number;
  /** Dose-escalation/safety through proof-of-concept */
  phase1ToPhase2: number;
  /** Phase 1/2 combined trial success (single-step) */
  phase1_2ToPhase2?: number;
  /** Proof-of-concept through pivotal readout */
  phase2ToPhase3: number;
  /** Phase 2/3 adaptive trial success (single-step) */
  phase2_3ToPhase3?: number;
  /** Pivotal data through regulatory approval */
  phase3ToApproval: number;
  /** NDA/BLA filed through approval decision */
  ndaFiledToApproval?: number;
  /** Regulatory approval through successful commercial launch */
  approvalToLaunch: number;
}

// ---------------------------------------------------------------------------
// rNPV Model Inputs
// ---------------------------------------------------------------------------

/**
 * Input parameters for an rNPV (risk-adjusted Net Present Value) calculation.
 *
 * The rNPV methodology discounts projected cash flows by both the time value
 * of money (WACC) and the probability of successfully reaching each milestone.
 * This is the standard valuation approach for pre-revenue pharma/biotech assets.
 */
export interface RNPVInput {
  /** Current development phase of the asset */
  phase: Phase;

  /** Therapeutic area (maps to PoS tables and cost/duration assumptions) */
  therapeuticArea: TherapeuticArea;

  /** Drug modality -- drives PoS adjustment factors */
  modality: Modality;

  /** Clinical indication (e.g., 'lung_nsclc', 'alzheimers') */
  indication: string;

  /**
   * Geographic territory for revenue modeling.
   * Accepts region keys like 'us', 'eu5', 'japan', 'china', 'row', 'global'.
   */
  territory: string;

  /** Peak annual sales estimate in $M across low/median/high scenarios */
  peakSalesEstimate: { low: number; median: number; high: number };

  /**
   * Competitive positioning of the asset.
   * Maps to COMPETITIVE_SHARE_ADJUSTMENT in pos-tables.ts.
   * One of: 'firstInClass', 'firstToPivotal', 'bestInClass', 'racing',
   *         'behind', 'crowded'.
   */
  competitivePosition: string;

  /**
   * Quality of available clinical/preclinical data.
   * Used to adjust confidence intervals and PoS.
   * One of: 'robust', 'moderate', 'preliminary', 'preclinical_only'.
   */
  dataQuality: string;

  /** Regulatory designations that may uplift approval probability */
  regulatoryDesignations: {
    /** FDA Breakthrough Therapy designation */
    breakthrough: boolean;
    /** FDA Fast Track designation */
    fastTrack: boolean;
    /** FDA/EMA Orphan Drug designation */
    orphan: boolean;
    /** EMA PRIME (Priority Medicines) designation */
    prime: boolean;
  };

  /** Biomarker selection status — drives PoS uplift for validated biomarkers */
  biomarkerStatus?: string;

  /**
   * Company type of the asset owner — affects discount rate.
   * One of: 'largePharma', 'midPharma', 'biotech', 'clinicalStageBiotech', 'academic'.
   */
  companyType?: string;

  /**
   * Deal structure type — affects discount rate and implied upfront %.
   * One of: 'licensing', 'acquisition', 'codevelopment', 'option', 'collaboration'.
   * Defaults to 'licensing' if not provided.
   */
  dealType?: string;

  // =========================================================================
  // Deal-type-specific structural components
  // =========================================================================
  // These fields surface the economic machinery that makes co-development,
  // option, and collaboration deals structurally different from a plain
  // license. They are optional; sensible defaults are applied by the engine
  // when the corresponding dealType is selected.

  /**
   * Co-development cost sharing: fraction of R&D costs the LICENSEE (partner)
   * bears. 0.5 = classic 50/50 split. 0.6 = licensee bears 60% (buyer-led
   * codev). Only used when dealType === 'codevelopment'.
   *
   * Source: BMS/Acceleron, Roche/Genentech historical co-development
   * agreements. 50/50 is the modal split; 60/40 occurs when the larger
   * partner pays up for tighter strategic control.
   *
   * Default: 0.5 for codev deals, undefined otherwise.
   */
  costSharingRatio?: number;

  /**
   * Option exercise fee paid IF the licensee exercises the option after
   * seeing data. Typical range: 1–2× the option upfront. Only used when
   * dealType === 'option'.
   *
   * Source: Gilead/Tubulis Dec 2024 ($20M upfront + $30M option exercise +
   * $415M milestones), plus BIO 2024–2026 option deal analysis.
   *
   * Default: 10% of rNPV (approximates 1× the option upfront).
   */
  optionExerciseFee?: number;

  /**
   * Collaboration FTE funding: research-capacity payments typical in early
   * platform collaborations. Only used when dealType === 'collaboration'.
   *
   * Source: Genmab, Schrödinger, Exscientia multi-target research deals.
   * Common range $0.5M–$2M per FTE per year over 3–5 years.
   */
  fteFunding?: {
    /** Number of full-time equivalents funded by the licensee */
    fteCount: number;
    /** Fully loaded cost per FTE per year in $M (typ. 0.5–2.0) */
    costPerFTE_M: number;
    /** Years of funding committed (typ. 3–5) */
    yearsOfFunding: number;
  };

  /**
   * Equity investment component of the deal in $M. The licensee takes an
   * equity stake in the licensor at signing. Only used when
   * dealType === 'collaboration'.
   *
   * Source: AbbVie/Genmab 2022, BMS/Repare, Pfizer/Arvinas 2021.
   */
  equityInvestment?: number;

  /**
   * Override for the weighted-average cost of capital.
   * If not provided, defaults to ~10-12% depending on phase and risk profile.
   * Early-stage assets typically use the higher end of the range.
   */
  discountRate?: number;

  /**
   * Optional benchmark deal value from the existing comparables-based engine.
   * When provided, the rNPV result will include a cross-validation section
   * comparing the two methodologies and explaining any divergence.
   */
  benchmarkDealValue?: { low: number; median: number; high: number };

  /**
   * Additional years added to (or subtracted from) time-to-market.
   * Used by scenario planning to model regulatory delays or accelerations.
   * Positive = delay, negative = acceleration.
   */
  timeToMarketAdjustment?: number;

  /**
   * Multiplier applied to cumulative probability of success (0-2).
   * Used by scenario planning to model increased/decreased approval confidence.
   * E.g., 0.85 = 15% PoS reduction; 1.15 = 15% PoS increase.
   */
  posMultiplier?: number;

  /**
   * Rolling time window for PoS calibration. When provided and time-windowed
   * data exists for `indication`, the engine substitutes that cohort's
   * absolute phase transition rates for the TA baseline before applying
   * modality / biomarker / regulatory uplifts. This lets users compare e.g.
   * "Alzheimer's PoS using 2014-2024 cohort" vs "2021-2024 most recent".
   * Indications without time-windowed data ignore this field and fall back
   * to the existing indication PoS modifier logic.
   *
   * Defaults to `'most_recent'` (which resolves to 2021-2024 if available,
   * otherwise 2019-2024, otherwise 2014-2024).
   */
  timeWindow?: TimeWindow;

  // =========================================================================
  // TA-Specific Modifiers — wired from CalculationInput to drive PoS/valuation
  // =========================================================================

  /** Line of therapy: 1L commands premium, 3L+ faces more competition */
  lineOfTherapy?: string;

  /** Combination potential: strong combo eligibility = higher value */
  combinationPotential?: string;

  /**
   * Combination therapy context — drives peak sales adjustment when the
   * indication is typically used in combination regimens (oncology, HIV,
   * some immunology). When omitted, the engine uses the default dynamics
   * from `COMBINATION_BY_INDICATION`. Setting this to 'monotherapy' forces
   * the engine to skip the combo discount — useful when the user asserts
   * the asset will not be used in combination.
   *
   * See `/lib/financial/combination-therapy.ts` for the full model.
   */
  combinationContext?: import('./combination-therapy').CombinationContext;

  /** Treatment approach: disease-modifying vs symptomatic */
  treatmentApproach?: string;

  // Neurology
  /** Blood-brain barrier penetration status */
  bbbPenetration?: string;
  /** Disease progression rate */
  diseaseProgression?: string;
  /** Biomarker validation level */
  biomarkerValidation?: string;

  // Immunology
  /** Potential for immune reset / curative approach */
  immuneResetPotential?: string;
  /** Target specificity: narrow vs broad */
  targetSpecificity?: string;
  /** Disease severity classification */
  diseaseSeverity?: string;
  /** Treatment goal: remission vs maintenance */
  treatmentGoal?: string;

  // Metabolic
  /** Weight loss efficacy level */
  weightLossEfficacy?: string;
  /** Route of administration */
  routeOfAdministration?: string;
  /** Mechanism differentiation */
  mechanismDifferentiation?: string;
  /** Comorbidity breadth */
  comorbidityBreadth?: string;

  // Cardiovascular
  /** Cardiovascular outcome benefit type */
  cvOutcomeBenefit?: string;
  /** Trial endpoint type */
  cvTrialEndpoint?: string;
  /** Population risk level */
  cvPopulationRisk?: string;

  // Infectious Disease
  /** Resistance profile */
  resistanceProfile?: string;
  /** Infection chronicity */
  infectionChronicity?: string;
  /** Public health priority level */
  publicHealthPriority?: string;

  // Ophthalmology
  /** Ocular delivery method */
  ocularDelivery?: string;
  /** Treatment durability */
  treatmentDurability?: string;
  /** Vision impact severity */
  visionImpact?: string;

  // Women's Health
  /** Target population */
  whTargetPopulation?: string;
  /** Unmet need level */
  whUnmetNeed?: string;

  // Rare Disease
  /** Patient population size */
  patientPopulationSize?: string;
  /** Genetic basis */
  geneticBasis?: string;

  // Hematology
  /** Hematologic lineage */
  hemeLineage?: string;
  /** Transplant eligibility */
  transplantEligibility?: string;
  /** MRD endpoint status */
  mrdStatus?: string;

  // Dermatology
  /** Skin severity */
  skinSeverity?: string;
  /** Chronicity profile */
  chronicityProfile?: string;
  /** Topical vs systemic */
  topicalVsSystemic?: string;

  // Gastroenterology
  /** GI segment */
  giSegment?: string;
  /** Biologic experience */
  biologicExperience?: string;
  /** Endoscopic endpoint */
  endoscopicEndpoint?: string;

  // =========================================================================
  // Internal flags — DO NOT set from public API code.
  // Used by lib/financial/risk-decomposition.ts (Tier 4 item 11) to run
  // counterfactual NPVs with specific risk sources neutralized. Always
  // travel with skipDecomposition: true to prevent infinite recursion.
  // =========================================================================
  /** Internal: counterfactual flags for risk decomposition. */
  __internalFlags?: RNPVInternalFlags;
}

/**
 * Internal counterfactual flags used by the risk decomposer (item 11, Tier 4).
 *
 * Each flag, when true, neutralizes one risk source inside calculateRNPV()
 * so the decomposer can measure the marginal value impact of that source by
 * comparing the counterfactual NPV against the baseline NPV. NEVER set these
 * from public API code — they exist solely for internal recursive calls.
 */
export interface RNPVInternalFlags {
  /** Strip MANUFACTURING_WACC_PREMIUM from the discount rate. */
  skipMfgPremium?: boolean;
  /** Skip the indication-specific competitive density penetration multiplier. */
  skipCompetitiveDensity?: boolean;
  /** Skip the MARKET_ACCESS_DELAY_MONTHS lag added to time-to-market. */
  skipMarketAccessDelay?: boolean;
  /** Skip the indication generic-entrenchment peak sales penalty. */
  skipGenericEntrenchment?: boolean;
  /** Neutralize regulatory designations (breakthrough/fastTrack/orphan/prime). */
  skipRegulatoryDesignations?: boolean;
  /** Strip indication modifier + modality/biomarker/regulatory PoS uplifts. */
  clinicalOnlyPoS?: boolean;
  /** Suppress the recursive decomposeRisk() call (set by the decomposer). */
  skipDecomposition?: boolean;
}

// ---------------------------------------------------------------------------
// Cash Flow Projection
// ---------------------------------------------------------------------------

/**
 * A single year in the projected cash flow schedule.
 *
 * Each row captures both the unadjusted financial projection and the
 * risk-adjusted present value after applying cumulative PoS and discounting.
 */
export interface CashFlowYear {
  /** Calendar year of the projection (e.g., 2025, 2026...) */
  year: number;

  /** Gross revenue in $M */
  revenue: number;

  /** Cost of goods sold in $M (typically 10-25% of revenue for biologics) */
  cogs: number;

  /** Revenue minus COGS ($M) */
  grossProfit: number;

  /** R&D costs attributable to this asset in $M (clinical + CMC) */
  rdCosts: number;

  /** Selling, general & administrative costs in $M */
  sgaCosts: number;

  /** Net operating cash flow in $M (grossProfit - rdCosts - sgaCosts) */
  netCashFlow: number;

  /** Discount factor = 1 / (1 + WACC)^n for this year */
  discountFactor: number;

  /** Present value of netCashFlow ($M) before risk adjustment */
  presentValue: number;

  /** Cumulative probability of success from current phase to this year */
  cumulativePoS: number;

  /** Present value weighted by cumulative PoS ($M) -- the rNPV contribution */
  riskAdjustedPV: number;
}

// ---------------------------------------------------------------------------
// rNPV Result
// ---------------------------------------------------------------------------

/**
 * Complete output of an rNPV calculation.
 *
 * Contains the headline rNPV figure, the full cash flow schedule, implied
 * deal terms, and (optionally) a cross-validation against benchmark comps.
 */
export interface RNPVResult {
  /** The headline risk-adjusted NPV in $M */
  riskAdjustedNPV: number;

  /** NPV without probability-of-success adjustment ($M) */
  unadjustedNPV: number;

  /** Overall cumulative probability of reaching market from current phase */
  cumulativePoS: number;

  /** Breakdown of each phase transition with timing and cost */
  phaseTransitions: {
    /** Human-readable phase label (e.g., 'Phase 2 -> Phase 3') */
    phase: string;
    /** Probability of completing this single transition (0-1) */
    probability: number;
    /** Cumulative probability from current phase through this transition */
    cumulativeProb: number;
    /** Expected years to complete this phase */
    yearsToComplete: number;
    /** Estimated development cost for this phase ($M) */
    costEstimate: number;
  }[];

  /** Year-by-year projected cash flows with risk adjustment */
  cashFlows: CashFlowYear[];

  /** Calendar year when peak revenue is projected */
  peakSalesYear: number;

  /** Years from now until projected market launch */
  yearsToMarket: number;

  /**
   * Implied deal terms derived from the rNPV.
   * Upfront is typically 15-40% of rNPV for early-stage; total deal
   * includes milestones and is typically 60-100% of rNPV.
   *
   * Deal-type-specific structural components are surfaced when the
   * dealType input triggers them (codev cost-sharing, option exercise
   * fee, collaboration FTE funding / equity). These are additive value
   * components already rolled into totalDeal, but broken out so the UI
   * and report can explain where the headline number comes from.
   */
  impliedDealValue: {
    upfront: { low: number; median: number; high: number };
    totalDeal: { low: number; median: number; high: number };

    /**
     * Co-development cost sharing component. Populated only for
     * dealType === 'codevelopment'. Represents the R&D spend the
     * licensee absorbs on the licensor's behalf — an in-kind contribution
     * that flows through the deal economics as avoided licensor cost.
     */
    codevCostSharing?: {
      /** Total remaining R&D ($M) from current phase through launch */
      totalRDCost_M: number;
      /** Licensee's share (0-1) */
      ratioLicensee: number;
      /** Licensee's absorbed R&D spend in $M (= totalRDCost × ratio) */
      sharedRDCost_M: number;
    };

    /**
     * Option exercise fee component. Populated only for
     * dealType === 'option'. The exercise fee is only paid if the
     * licensee elects to convert the option into a full license after
     * seeing data, so we report both the nominal fee and the expected
     * (probability-weighted) value.
     */
    optionExerciseFee?: {
      /** Nominal exercise fee if option is converted ($M) */
      fee_M: number;
      /** Historical probability of exercise (0-1) */
      probability: number;
      /** Probability-weighted expected contribution to deal value ($M) */
      expectedValue_M: number;
    };

    /**
     * Collaboration FTE research-funding component. Populated only for
     * dealType === 'collaboration' when fteFunding is provided (or
     * inferred by default).
     */
    fteResearchValue?: {
      /** Number of FTEs funded */
      fteCount: number;
      /** Cost per FTE per year ($M) */
      costPerFTE_M: number;
      /** Years of funding committed */
      yearsOfFunding: number;
      /** Total absorbed research cost in $M */
      totalValue_M: number;
    };

    /**
     * Equity investment in the licensor in $M. Populated only for
     * dealType === 'collaboration' when equityInvestment is provided.
     */
    equityInvestment?: number;
  };

  /**
   * Cross-validation of rNPV against the benchmark comparables engine.
   * Only present when benchmarkDealValue was provided in the input.
   */
  crossValidation?: {
    /** Median deal value from the comparables engine ($M) */
    benchmarkMedian: number;
    /** Median implied deal value from rNPV ($M) */
    rnpvMedian: number;
    /** Percentage divergence (positive = rNPV higher than benchmark) */
    divergencePercent: number;
    /** Human-readable explanation of why the two methods diverge */
    narrative: string;
  };

  /** WACC / discount rate used in the model */
  discountRate: number;

  /** Terminal value component of the NPV ($M) */
  terminalValue: number;

  /**
   * Key assumptions baked into this calculation, surfaced for transparency.
   * Example: "Phase 2->3 PoS adjusted +20% for breakthrough designation"
   */
  modelAssumptions: string[];

  /**
   * Result of the indication TAM ceiling check against the user's peak sales
   * assumption. Populated only when the indication maps to INDICATION_MARKET_CAPS.
   *   - severity 'critical' means the model hard-capped peak sales to 80% of TAM.
   *   - severity 'warning' means the assumption exceeds the market leader's peak
   *     but was not capped.
   *   - ok: true means the assumption is within realistic bounds.
   */
  peakSalesCeilingCheck?: {
    ok: boolean;
    severity?: 'warning' | 'critical';
    ceiling?: number;
    tam?: number;
    message?: string;
  };

  /**
   * Combination therapy adjustment applied to peak sales. Populated whenever
   * the indication has an entry in COMBINATION_BY_INDICATION (regardless of
   * whether the multiplier is <1.0). When the user sets
   * `combinationContext: 'monotherapy'`, multiplier is 1.0 and rationale
   * reflects the override.
   *
   * See `/lib/financial/combination-therapy.ts` for the full model.
   */
  combinationAdjustment?: {
    /** Effective revenue multiplier applied to peak sales (0.25-1.0) */
    multiplier: number;
    /** The context used (monotherapy, combo with SoC, etc.) */
    context: import('./combination-therapy').CombinationContext;
    /** Fraction of patients receiving the drug in combination regimens */
    comboFraction: number;
    /** Fraction of combo regimen revenue attributable to this drug */
    revenueShare: number;
    /** Partner drug(s) (if any) */
    partnerDrug?: string;
    /** Dollar change in peak sales median ($M, negative = reduction) */
    peakSalesDelta_M: number;
    /** Original (pre-adjustment) peak sales median ($M) */
    originalPeakSales_M: number;
    /** Adjusted peak sales median ($M) */
    adjustedPeakSales_M: number;
    /** Human-readable rationale for the adjustment */
    rationale: string;
  };

  /**
   * Optional decomposition of global peak sales into per-geography revenue
   * curves (US, EU5, Japan, China, RoW) with separate launch delays, ramp
   * speeds, pricing multipliers, and access risk premiums.
   *
   * Only populated when the rNPV engine successfully resolves a therapeutic
   * area to a geographic split table. The `totalRevenueByYear` schedule
   * should reconcile to the global cash-flow revenue schedule within ~5%.
   */
  geographicDecomposition?: {
    byGeography: Record<Geography, number[]>;
    totalRevenueByYear: number[];
    geographicSplits: GeographicSplit[];
    /**
     * The global peak sales number that was decomposed (post data-quality
     * and competitive-density adjustments, pre-regional pricing).
     */
    globalEquivalentPeakSales: number;
  };

  /**
   * 4-bucket attribution of value erosion (Tier 4 item 11). Populated when
   * TIER4_FLAGS.riskDecomposition is on. Buckets should sum to within 10%
   * of `unadjustedNPV - riskAdjustedNPV`; any residual is booked to `other`.
   */
  riskDecomposition?: RiskDecomposition;
}

// ---------------------------------------------------------------------------
// Risk Decomposition (Tier 4 Item 11)
// ---------------------------------------------------------------------------

/**
 * A single risk bucket in the 4-way decomposition of value erosion.
 * All impacts are reported as positive $M (magnitude of value destroyed).
 */
export interface RiskBucket {
  /** Magnitude of NPV impact attributed to this bucket ($M, ≥ 0). */
  impact_M: number;
  /** Share of total risk wedge attributable to this bucket (0..1). */
  percentOfTotal: number;
  /** Human-readable drivers (e.g., "phase 2→3 attrition", "Keytruda crowding"). */
  drivers: string[];
}

/**
 * 4-bucket attribution of `unadjustedNPV - riskAdjustedNPV` — the "risk wedge."
 * Each bucket represents how much NPV is destroyed by a specific risk source,
 * computed via counterfactual re-runs of calculateRNPV with that source
 * neutralized.
 */
export interface RiskDecomposition {
  /** Clinical: phase transition attrition (unavoidable biology/trial risk). */
  clinical: RiskBucket;
  /** Commercial: competitive density + GTN realism + market access. */
  commercial: RiskBucket;
  /** Manufacturing: CMC complexity premium (cell/gene therapy, ADCs, etc.). */
  manufacturing: RiskBucket;
  /** Regulatory: designation risk, territory risk premium, FDA pathway risk. */
  regulatory: RiskBucket;
  /** Residual — bookkeeping bucket so the four main ones always reconcile. */
  other: RiskBucket;
  /** Sum of bucket impacts ($M). Should ≈ unadjustedNPV − riskAdjustedNPV. */
  total_M: number;
  /**
   * Absolute reconciliation gap vs. `unadjustedNPV − riskAdjustedNPV`,
   * normalized by total_M (0..1). Violations > 0.10 surface as Sentry
   * breadcrumbs but never throw (decomposition is informational).
   */
  reconciliationGap: number;
}

// ---------------------------------------------------------------------------
// Monte Carlo Simulation
// ---------------------------------------------------------------------------

/**
 * Input parameters for a Monte Carlo simulation around an rNPV base case.
 *
 * Each variable is sampled from a distribution centered on the base-case
 * value, with spread controlled by the variation parameters.
 */
export interface MonteCarloInput {
  /** Base rNPV input to perturb */
  rnpvInput: RNPVInput;

  /** Number of simulation iterations (default: 10,000) */
  iterations?: number;

  /**
   * Fractional variation around base PoS per phase.
   * Default 0.20 means each phase PoS is sampled from
   * [basePoS * 0.80, basePoS * 1.20] using a beta distribution.
   */
  posVariation?: number;

  /**
   * Fractional variation around peak sales estimate.
   * Default 0.30 means peak sales sampled +/-30% of base.
   */
  peakSalesVariation?: number;

  /**
   * Absolute variation in discount rate (percentage points).
   * Default 0.02 means WACC sampled +/- 2pp around base.
   */
  discountRateVariation?: number;

  /**
   * Absolute variation in time-to-market (years).
   * Default 1 means launch date sampled +/- 1 year from base.
   */
  timeToMarketVariation?: number;

  /**
   * Fractional variation in per-patient pricing.
   * Default 0.15 means pricing sampled +/- 15% of base.
   */
  pricingVariation?: number;
}

/**
 * Output of a Monte Carlo simulation.
 *
 * Contains distribution statistics, a histogram for visualization,
 * confidence intervals, and a tornado-chart-ready sensitivity analysis
 * showing which input variables most strongly drive NPV variance.
 */
export interface MonteCarloResult {
  /** Number of iterations that were actually run */
  iterations: number;

  /** Key percentiles of the simulated rNPV distribution ($M) */
  percentiles: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };

  /** Arithmetic mean of all simulated rNPV outcomes ($M) */
  mean: number;

  /** Standard deviation of simulated rNPV outcomes ($M) */
  stdDev: number;

  /**
   * Histogram bins for rendering a distribution chart.
   * Typically 30-50 bins covering the P1-P99 range.
   */
  histogram: {
    binStart: number;
    binEnd: number;
    count: number;
    percentage: number;
  }[];

  /** 95% confidence interval [P2.5, P97.5] */
  confidenceInterval95: { low: number; high: number };

  /** 80% confidence interval [P10, P90] */
  confidenceInterval80: { low: number; high: number };

  /** Fraction of iterations yielding a positive NPV (0-1) */
  probabilityOfPositiveNPV: number;

  /**
   * Tornado-chart data: rank-order correlation of each input parameter
   * with the simulated NPV. Higher |correlation| = stronger driver.
   */
  keyDriverSensitivity: {
    /** Internal parameter name (e.g., 'peakSales', 'phase2PoS') */
    parameter: string;
    /** Spearman rank correlation with NPV (-1 to 1) */
    correlationWithNPV: number;
    /** Human-readable label for charts (e.g., 'Peak Sales ($M)') */
    label: string;
  }[];

  /**
   * Scenario-weighted breakdown showing P50 rNPV and weight for each
   * macro scenario (bear/base/bull). Only present when scenario weighting
   * is enabled (default).
   *
   * Creates a multimodal distribution that better reflects pharma reality:
   * the drug either works (bull/base) or it doesn't (bear).
   */
  scenario_breakdown?: {
    bear: { p50: number; weight: number };
    base: { p50: number; weight: number };
    bull: { p50: number; weight: number };
  };

  /**
   * Value-at-Risk (VaR) at 95% confidence.
   * = P5 of the distribution. Answers: "What's the worst outcome
   * we'd expect 95% of the time?"
   */
  var95: number;

  /**
   * Conditional Value-at-Risk (CVaR) at 95% confidence.
   * = Mean of the bottom 5% of outcomes. Answers: "If things go
   * really wrong, how wrong on average?"
   * Always ≤ VaR_95 (deeper into the tail).
   */
  cvar95: number;

  /**
   * Skewness of the distribution.
   * Positive = right-skewed (more upside than downside probability).
   * Negative = left-skewed (fat left tail, downside-heavy).
   * Pharma rNPV distributions are typically right-skewed for early-stage
   * (many small losses + rare big wins) and symmetric for late-stage.
   */
  skewness: number;

  /**
   * Kurtosis of the distribution (excess kurtosis, 0 = normal).
   * > 0 = fatter tails than normal (more extreme outcomes).
   * Pharma distributions typically show excess kurtosis of 1-4
   * due to the binary nature of clinical trial outcomes.
   */
  kurtosis: number;
}

// ---------------------------------------------------------------------------
// Market Size / Epidemiology
// ---------------------------------------------------------------------------

/**
 * Epidemiological inputs for bottom-up market sizing.
 *
 * Used to build a patient funnel from total population down to
 * drug-eligible patients, then multiply by annual cost of therapy.
 */
export interface EpidemiologyData {
  /** Disease prevalence per million population */
  prevalencePerMillion: number;

  /** New cases per year per million population */
  incidencePerMillion: number;

  /** Fraction of prevalent patients who are diagnosed (0-1) */
  diagnosedPercent: number;

  /** Fraction of diagnosed patients receiving any treatment (0-1) */
  treatedPercent: number;

  /** Fraction of treated patients eligible for this drug class (0-1) */
  drugEligiblePercent: number;

  /** Annual cost of therapy per patient in USD */
  annualCostOfTherapy: number;

  /** Curated peak sales estimate from analyst consensus ($M) */
  peakSalesRangeM?: { low: number; median: number; high: number };

  /** Published sources for the epidemiology data */
  sources: string[];
}

/**
 * Bottom-up market size estimate derived from epidemiology data.
 *
 * Follows the TAM -> SAM -> SOM framework commonly used in pharma
 * commercial assessments and investor decks.
 */
export interface MarketSizeEstimate {
  /** Clinical indication being sized */
  indication: string;

  /** Geographic territory (e.g., 'us', 'eu5', 'global') */
  territory: string;

  /** Total Addressable Market in $M (all patients * annual cost) */
  totalAddressableMarket: number;

  /** Serviceable Addressable Market in $M (drug-eligible * annual cost) */
  serviceableAddressableMarket: number;

  /** Serviceable Obtainable Market in $M (SAM * realistic market share) */
  serviceableObtainableMarket: number;

  /** Implied peak annual sales under low/median/high share scenarios ($M) */
  peakSales: { low: number; median: number; high: number };

  /** Step-by-step patient funnel from population to addressable patients */
  patientFunnel: {
    totalPopulation: number;
    prevalentPatients: number;
    diagnosedPatients: number;
    treatedPatients: number;
    drugEligiblePatients: number;
    addressablePatients: number;
  };

  /** Assumed peak market share under low/median/high scenarios (0-1) */
  marketShareAssumption: { low: number; median: number; high: number };

  /** Net revenue per patient per year in USD */
  annualRevenuePerPatient: number;

  /** Published sources for market size assumptions */
  sources: string[];

  /**
   * True when territory or epidemiology data fell back to a default
   * (global population / generic rare-disease profile). UI should flag
   * the estimate as "estimated from default data" when this is true.
   */
  usedFallback?: boolean;

  /** List of fields that were filled from defaults */
  fallbackReasons?: string[];
}

// ---------------------------------------------------------------------------
// Scenario Planning
// ---------------------------------------------------------------------------

/**
 * A predefined scenario template that adjusts one or more model parameters.
 *
 * Scenarios are organized by category (regulatory, clinical, competitive,
 * commercial, pricing) and can be applied individually or stacked to
 * explore compound effects on valuation.
 */
export interface ScenarioTemplate {
  /** Unique identifier for this scenario */
  id: string;

  /** Human-readable scenario name (e.g., 'CRL / Regulatory Delay') */
  name: string;

  /** Brief description of what this scenario models */
  description: string;

  /** Category for grouping in the UI */
  category: 'regulatory' | 'clinical' | 'competitive' | 'commercial' | 'pricing';

  /** One or more parameter adjustments that define this scenario */
  adjustments: ScenarioAdjustment[];
}

/**
 * A single parameter adjustment within a scenario.
 *
 * The adjustment is applied to the base-case rNPV model via one of three
 * operations: multiply (scale), add (shift), or set (override).
 */
export interface ScenarioAdjustment {
  /**
   * Model parameter to adjust.
   * Examples: 'timeToMarket', 'peakSales', 'pos', 'discountRate',
   *           'cogsPercent', 'marketShare', 'genericErosion'.
   */
  parameter: string;

  /** How to apply the value: multiply base, add to base, or set absolutely */
  operation: 'multiply' | 'add' | 'set';

  /** The adjustment value (interpretation depends on operation) */
  value: number;

  /** Human-readable explanation of why this adjustment is appropriate */
  rationale: string;
}

/**
 * Result of applying a scenario to a base-case rNPV model.
 */
export interface ScenarioResult {
  /** The scenario that was applied */
  scenario: ScenarioTemplate;

  /** Base-case rNPV before the scenario ($M) */
  baseRNPV: number;

  /** rNPV after applying the scenario adjustments ($M) */
  adjustedRNPV: number;

  /** Absolute change in rNPV ($M) */
  impactDelta: number;

  /** Percentage change from base case */
  impactPercent: number;

  /** Implied deal terms under this scenario ($M) */
  adjustedDealValue: { low: number; median: number; high: number };

  /** Human-readable narrative explaining the scenario's impact */
  narrative: string;
}

/**
 * Defensive analysis summary derived from scenario planning.
 *
 * Captures the worst-case / best-case envelope, a defensive floor
 * (P10 of scenario outcomes), and a walk-away threshold below which
 * the risk-reward balance favors waiting or alternative strategies.
 */
export interface DefensiveAnalysis {
  /** Worst-case scenario result (lowest adjustedRNPV) */
  worstCase: ScenarioResult;

  /** Best-case scenario result (highest adjustedRNPV) */
  bestCase: ScenarioResult;

  /** P10 of all scenario-adjusted rNPV outcomes ($M) */
  defensiveFloor: number;

  /** Minimum acceptable deal value below which to walk away ($M) */
  walkAwayThreshold: number;

  /** Human-readable narrative summarizing the defensive posture */
  narrative: string;
}

// ---------------------------------------------------------------------------
// FX / Territory Pricing
// ---------------------------------------------------------------------------

/**
 * Pricing and currency profile for a geographic territory.
 *
 * Captures both the baseline price differential vs. US and the
 * regulatory/policy-driven pricing pressures specific to that market.
 */
export interface TerritoryPricingProfile {
  /** Territory identifier (e.g., 'us', 'eu5', 'japan', 'china') */
  territory: string;

  /** ISO 4217 currency code (e.g., 'USD', 'EUR', 'JPY', 'CNY') */
  currencyCode: string;

  /**
   * Price level relative to the US.
   * 1.0 = US price; 0.65 = 65% of US price.
   */
  pricingIndexVsUS: number;

  /** Intensity of government pricing pressure */
  regulatoryPressure: 'high' | 'moderate' | 'low';

  /**
   * Estimated price erosion from the US Inflation Reduction Act.
   * Only applicable to US territory. Expressed as a fraction (e.g., 0.25 = 25%).
   */
  iraImpact?: number;

  /**
   * Typical discount from National Reimbursement Drug List negotiation.
   * Only applicable to China territory.
   */
  nrdlDiscount?: number;

  /**
   * EU international reference pricing impact.
   * Expressed as a fraction representing average discount.
   */
  referenceBasketDiscount?: number;

  /** Trailing 12-month FX volatility vs. USD (annualized, e.g., 0.08 = 8%) */
  volatility12mo: number;

  /** Additional context about this territory's pricing environment */
  notes: string[];
}

/**
 * FX sensitivity analysis showing how currency movements and
 * regulatory pricing pressures affect projected revenue and deal value.
 */
export interface FXSensitivity {
  /** Revenue at current FX rates ($M) */
  baseCaseRevenue: number;

  /** Revenue impact under various FX scenarios */
  scenarios: {
    /** Scenario description (e.g., '+10% USD strengthening') */
    label: string;
    /** FX rate change (e.g., +0.10 = 10% USD strengthening) */
    fxChange: number;
    /** Revenue impact in $M (negative = headwind) */
    revenueImpact: number;
    /** Implied deal value impact in $M */
    dealValueImpact: number;
  }[];

  /** Estimated revenue erosion from regulatory pricing pressure ($M) */
  regulatoryPricingImpact: number;

  /** Revenue after all FX and pricing adjustments ($M) */
  totalAdjustedRevenue: number;
}

// ---------------------------------------------------------------------------
// Competitive Pipeline
// ---------------------------------------------------------------------------

/**
 * A single competing asset in the indication landscape.
 */
export interface CompetitiveAsset {
  /** Name of the company developing the asset */
  companyName: string;

  /** Drug name or internal designation */
  assetName: string;

  /** Drug modality (e.g., 'mab', 'smallMolecule', 'adc') */
  modality: string;

  /** Current development phase */
  phase: string;

  /** Target indication */
  indication: string;

  /** Projected approval year (if available) */
  expectedApprovalYear?: number;

  /** Key differentiating characteristic vs. other pipeline assets */
  differentiator?: string;
}

/**
 * Competitive landscape analysis for a specific indication.
 *
 * Synthesizes pipeline data into a density score and market share
 * erosion estimate that feeds into the rNPV model.
 */
export interface CompetitiveLandscape {
  /** Indication being analyzed */
  indication: string;

  /** Total number of competing assets across all phases */
  totalCompetingAssets: number;

  /** Count of competing assets by development phase */
  byPhase: Record<string, number>;

  /** Top competing assets with the most commercial relevance */
  keyCompetitors: CompetitiveAsset[];

  /**
   * Competitive density score (0-100).
   * Higher scores indicate a more crowded landscape with more downward
   * pressure on market share. Factors in phase, modality diversity,
   * and number of large pharma entrants.
   */
  competitiveDensityScore: number;

  /** Whether this asset has a meaningful first-mover advantage */
  firstMoverAdvantage: boolean;

  /** The next expected competitor approval */
  expectedNextApproval?: { company: string; year: number };

  /**
   * Estimated market share erosion from competition (0-1).
   * Applied as a multiplier to peak sales in the rNPV model.
   */
  marketShareErosionEstimate: number;

  /** Human-readable competitive landscape summary */
  narrative: string;
}

// ---------------------------------------------------------------------------
// Deal Flow Forecasting
// ---------------------------------------------------------------------------

/**
 * Deal flow forecast for a therapeutic area.
 *
 * Combines historical quarterly deal volume/value with a forward-looking
 * prediction of deal activity, market sentiment, and seasonal patterns.
 */
export interface DealFlowForecast {
  /** Therapeutic area being forecasted */
  therapeuticArea: string;

  /** Historical quarterly deal data for trend analysis */
  historicalQuarters: {
    /** Quarter label (e.g., 'Q1 2024') */
    quarter: string;
    /** Number of deals closed in this quarter */
    dealCount: number;
    /** Total deal value in $M (upfront + milestones) */
    totalValue: number;
  }[];

  /** Forward-looking deal activity prediction by quarter */
  forecast: {
    /** Quarter label (e.g., 'Q3 2026') */
    quarter: string;
    /** Predicted number of deals (point estimate) */
    predictedDeals: number;
    /** Lower bound of ~95% prediction interval */
    predictedDealsLow?: number;
    /** Upper bound of ~95% prediction interval */
    predictedDealsHigh?: number;
    /** Predicted total deal value in $M (point estimate) */
    predictedValueM?: number;
    /** Lower bound of ~95% prediction interval for deal value ($M) */
    predictedValueMLow?: number;
    /** Upper bound of ~95% prediction interval for deal value ($M) */
    predictedValueMHigh?: number;
    /** Model confidence in the prediction (0-1) */
    confidence: number;
  }[];

  /** Overall deal activity trend direction */
  trend: 'accelerating' | 'stable' | 'decelerating';

  /** Description of seasonal patterns (e.g., 'Q4 spike from year-end BD') */
  seasonalPattern: string;

  /** Current market sentiment for deals in this TA */
  marketSentiment: 'hot' | 'warm' | 'neutral' | 'cooling';

  /** Human-readable narrative summarizing the forecast */
  narrative: string;

  /** Data provenance flag indicating the source of forecast data */
  dataQuality: 'live' | 'curated' | 'proxy';

  /** Human-readable reliability assessment based on prediction interval width */
  forecastReliability: string;
}

// ---------------------------------------------------------------------------
// Acquisition Likelihood
// ---------------------------------------------------------------------------

/**
 * Acquisition likelihood assessment for partner/acquirer matching.
 *
 * Scores how likely a given asset or company is to be acquired,
 * based on strategic fit, pipeline gaps, financial capacity, and
 * historical M&A behavior of potential acquirers.
 */
export interface AcquisitionLikelihood {
  /** Composite acquisition likelihood score (0-100) */
  score: number;

  /** Categorical assessment derived from the score */
  category: 'very_likely' | 'likely' | 'possible' | 'unlikely';

  /** Individual factors contributing to the overall score */
  factors: {
    /** Factor name (e.g., 'Pipeline Gap Fit', 'Patent Cliff Urgency') */
    factor: string;
    /** Weight of this factor in the composite score (0-1, sums to 1) */
    weight: number;
    /** This factor's individual score (0-100) */
    score: number;
    /** Explanation of why this factor scored as it did */
    narrative: string;
  }[];

  /** Expected timing of a potential acquisition */
  timing: 'imminent' | 'near_term' | 'medium_term' | 'speculative';

  /** Overall narrative summarizing the acquisition likelihood assessment */
  narrative: string;
}

// ---------------------------------------------------------------------------
// Deal Valuation Waterfall (Institutional Grade)
// ---------------------------------------------------------------------------

export interface DealWaterfallStep {
  label: string;
  adjustment: number;
  runningTotal: number;
  rationale: string;
}

export interface DealWaterfall {
  steps: DealWaterfallStep[];
  upfrontPayment: { low: number; median: number; high: number };
  developmentMilestones: { low: number; median: number; high: number };
  commercialMilestones: { low: number; median: number; high: number };
  royaltyRate: { low: number; median: number; high: number };
  totalDealValue: { low: number; median: number; high: number };
  narrative: string;
}

// ---------------------------------------------------------------------------
// Scenario Comparison (Bear/Base/Bull)
// ---------------------------------------------------------------------------

export interface ScenarioComparisonResult {
  bear: { rnpv: number; impliedDeal: number; cumulativePoS: number; yearsToMarket: number; assumptions: string[] };
  base: { rnpv: number; impliedDeal: number; cumulativePoS: number; yearsToMarket: number; assumptions: string[] };
  bull: { rnpv: number; impliedDeal: number; cumulativePoS: number; yearsToMarket: number; assumptions: string[] };
  expectedValue: number;
  bearWeight: number;
  baseWeight: number;
  bullWeight: number;
  narrative: string;
}

// ---------------------------------------------------------------------------
// Lifecycle Extension Modeling
// ---------------------------------------------------------------------------

export interface LifecycleExtension {
  type: 'labelExpansion' | 'pediatricExclusivity' | 'combinationApproval';
  probability: number;
  incrementalPeakSalesPercent: number;
  lagYearsFromApproval: number;
  rampYears: number;
  additionalExclusivityYears: number;
  narrative: string;
}

export interface LifecycleExtensionResult {
  extensions: LifecycleExtension[];
  baseRNPV: number;
  extendedRNPV: number;
  incrementalValue: number;
  incrementalPercent: number;
}

// ---------------------------------------------------------------------------
// Ensemble Valuation (Item 7 — Tier 3)
// ---------------------------------------------------------------------------

/**
 * One method's contribution to the inverse-variance-weighted ensemble.
 * Three methods are blended: rNPV, comparable transactions, and real options.
 */
export interface EnsembleMethod {
  /** Method label rendered in the UI */
  name: 'rNPV' | 'Comparable Transactions' | 'Real Options';
  /** Central estimate from this method ($M) */
  value: number;
  /** Variance estimate ($M²). Infinity → method excluded from blend. */
  variance: number;
  /** Normalized weight in the ensemble (0..1, all weights sum to 1) */
  weight: number;
  /** For comparables: number of deals in the matched group */
  sampleSize?: number;
  /** Confidence in this method's estimate */
  confidence: 'high' | 'medium' | 'low';
  /** Short narrative explaining how this method derived its value */
  rationale: string;
}

/**
 * Output of the ensemble valuation engine. The headline `ensembleValue` is
 * the inverse-variance-weighted blend of all three methods.
 */
export interface EnsembleResult {
  /** Headline blended value ($M) — `Σ(value_i × w_i)` */
  ensembleValue: number;
  /** Standard error of the ensemble = sqrt(1 / Σ(1/var_i)) ($M) */
  ensembleStdDev: number;
  /** All three methods with their weights and rationales */
  methods: EnsembleMethod[];
  /** max(values) − min(values) across methods ($M) */
  spread: number;
  /**
   * Qualitative agreement assessment:
   *   tight    → spread / median < 0.20 (methods converge)
   *   moderate → spread / median in [0.20, 0.50)
   *   wide     → spread / median ≥ 0.50 (review assumptions)
   */
  agreement: 'tight' | 'moderate' | 'wide';
  /** True when at least one method had to fall back (sparse comps, etc.) */
  fallbackUsed: boolean;
  /** Plain-English summary of the blend and any caveats */
  narrative: string;
}

// ---------------------------------------------------------------------------
// Deal Structure Optimizer (Item 8 — Tier 3)
// ---------------------------------------------------------------------------

/**
 * Licensor preference profile — drives the secondary sort that picks between
 * deal types of similar headline value. Inferred from `companyType` if absent.
 */
export interface LicensorPreferenceProfile {
  /** 0..1 — weight on cash now vs. future upside (higher = prefer upfront-heavy) */
  cashNowWeight: number;
  /** 0..1 — weight on risk aversion (higher = prefer guaranteed cash over option value) */
  riskAversionWeight: number;
}

/**
 * One row in the deal-structure ranking table. Each row represents the
 * counterfactual: "what would this asset look like as a $dealType deal?"
 */
export interface DealStructureOption {
  dealType: 'licensing' | 'acquisition' | 'codevelopment' | 'option' | 'collaboration';
  /** Headline deal value to licensor ($M) — uses rNPV implied total deal median */
  dealValue: number;
  /** Implied upfront payment ($M) for this structure */
  upfrontMedian: number;
  /** Implied total deal value ($M) for this structure */
  totalDealMedian: number;
  /** Score after applying licensor preference modifiers — used for sorting */
  preferenceAdjustedScore: number;
  /** Percent change vs. user's currently selected dealType (positive = better) */
  pctVsBaseline: number;
  /** Final rank (1 = best) after preference adjustment */
  rank: number;
  /** 1-2 sentence explanation of why this rank */
  rationale: string;
}

/**
 * Output of the deal structure optimizer. Surfaces a recommendation only when
 * the top alternative is materially better than the user's current selection.
 */
export interface DealOptimizerResult {
  userSelectedDealType: 'licensing' | 'acquisition' | 'codevelopment' | 'option' | 'collaboration';
  userSelectedDealValue: number;
  /** All 5 deal types ranked best → worst */
  rankings: DealStructureOption[];
  /** Top alternative (or null if user is already on the best option) */
  topAlternative: DealStructureOption | null;
  /**
   * Strength of the recommendation:
   *   strong   → alternative > 40% better
   *   moderate → 20–40% better
   *   weak     → < 20% better (not surfaced in UI)
   *   none     → user is already on the best option
   */
  recommendationStrength: 'strong' | 'moderate' | 'weak' | 'none';
  /** Recommendation copy for the UI banner — null when strength is weak/none */
  recommendation: string | null;
  /** Resolved licensor preference profile (the one actually used for scoring) */
  preferenceProfile: LicensorPreferenceProfile;
}

// ---------------------------------------------------------------------------
// Counterparty Premiums (Item 9 — Tier 3)
// ---------------------------------------------------------------------------

/**
 * Historical premium that a specific buyer pays vs. comparable deals.
 * Computed by `computeCounterpartyPremiums` from the deals + companies tables
 * and refreshed quarterly via `app/api/cron/counterparty-calibration`.
 */
export interface CounterpartyPremium {
  /** UUID of the buyer in the companies table */
  companyId: string;
  /** Display name */
  companyName: string;
  /**
   * Multiplicative premium vs. comparable median.
   * - 1.00 = pays the median
   * - 1.25 = pays 25% above median (e.g., AbbVie historically)
   * - 0.95 = pays 5% below median (e.g., Gilead post-Immunomedics)
   *
   * Always clamped to [0.7, 1.5] — anything outside is suspect.
   */
  premiumMultiplier: number;
  /** Number of disclosed deals used in the calculation */
  sampleSize: number;
  /**
   * Confidence level:
   *   high   → n ≥ 10 disclosed deals
   *   medium → 5 ≤ n ≤ 9
   *   low    → 3 ≤ n ≤ 4 (premium applied at 50% weight)
   */
  confidence: 'high' | 'medium' | 'low';
  /**
   * Per-TA breakdowns (only TAs with n ≥ 3 included). Used for context-aware
   * lookups when the buyer's premium varies by therapeutic area.
   */
  byTherapeuticArea: Record<string, { premium: number; n: number }>;
  /** Per-phase breakdowns (n ≥ 3 only) */
  byPhase: Record<string, { premium: number; n: number }>;
  /** ISO date of the calculation run */
  asOfDate: string;
  /** Free-text notes about how this premium was computed */
  calculationNotes: string;
}

/**
 * Result of a counterparty premium lookup. Wraps the multiplier with metadata
 * so callers can decide whether to apply it (low-confidence premiums are
 * typically ignored or down-weighted).
 */
export interface CounterpartyPremiumLookup {
  /** The multiplier to apply to deal value (1.0 = no adjustment) */
  multiplier: number;
  confidence: 'high' | 'medium' | 'low';
  /** Provenance: 'company_wide' | 'ta_specific' | 'phase_specific' | 'no_history' */
  source: string;
}

// ---------------------------------------------------------------------------
// RWE Tuning (Item 10 — Tier 3)
// ---------------------------------------------------------------------------

/**
 * Single drug backtest record. Compares the rNPV engine's projected peak
 * sales (run with as-of-approval inputs) against the actual realized peak.
 */
export interface DrugBacktest {
  drugName: string;
  company: string;
  therapeuticArea: string;
  modality: string;
  indication: string;
  /** Actual peak sales from real-world data ($M) */
  actualPeakM: number;
  /** Model's projected peak sales when run retrospectively ($M) */
  modelPeakM: number;
  /** Signed percent error: (model - actual) / actual */
  errorPct: number;
  /** Absolute error in $M */
  errorAbsM: number;
  /** Notes (e.g., "skipped: missing peak", "biosimilar entry not modeled") */
  notes: string;
}

/**
 * Aggregated bias for a slice (TA, modality, or phase). Used to identify
 * systematic over/under-shoots that can be corrected via tuning deltas.
 */
export interface BiasAggregate {
  /** Group label (e.g., "oncology", "mab", "approved") */
  group: string;
  /** Which dimension this slice represents */
  groupType: 'therapeutic_area' | 'modality' | 'phase';
  /** Mean signed error: positive = model overshoots, negative = undershoots */
  meanError: number;
  /** Median signed error */
  medianError: number;
  /** Root-mean-squared error in $M */
  rmseM: number;
  /** Number of drugs in the slice */
  sampleSize: number;
  /**
   * Recommended multiplicative adjustment to apply to the slice's peak sales
   * cap. Always within ±15% of 1.0 — bounded to prevent runaway feedback.
   */
  recommendedAdjustment: number;
}

/**
 * A bounded tuning delta proposed by the RWE engine. The cron writes these
 * to `rwe_pending_deltas` for review; if `RWE_AUTO_APPLY=true` and held-out
 * validation passes, they are promoted to `rwe_active_overrides`.
 */
export interface TuningDelta {
  /** Dotted parameter path (e.g., "PEAK_SALES_CAP.oncology.median") */
  parameter: string;
  /** Current value at the time of the proposal */
  currentValue: number;
  /** Proposed new value (always within ±15% of currentValue) */
  proposedValue: number;
  /**
   * Expected reduction in $M RMSE if applied, computed by replaying the
   * backtest with the proposed value substituted in.
   */
  expectedErrorReduction: number;
  /** Free-text rationale for why this change should reduce bias */
  rationale: string;
}

/**
 * Full output of a single RWE tuning run. Persisted to the
 * `rwe_tuning_results` table by the weekly cron.
 */
export interface RWETuningResult {
  /** ISO date the run executed */
  asOfDate: string;
  /** Total drugs analyzed (with usable peak data) */
  totalDrugsAnalyzed: number;
  /** Drugs skipped due to missing peak/year/etc. */
  drugsSkipped: number;
  /** Per-drug backtest rows */
  backtests: DrugBacktest[];
  /** Aggregated bias by therapeutic area */
  biasByTA: BiasAggregate[];
  /** Aggregated bias by modality */
  biasByModality: BiasAggregate[];
  /** Aggregated bias by phase (always "approved" for index drugs but kept for symmetry) */
  biasByPhase: BiasAggregate[];
  /** Mean signed error across all drugs (positive = systematic overshoot) */
  overallMeanError: number;
  /** Mean absolute percentage error across all drugs */
  overallMape: number;
  /** Root-mean-squared error in $M across all drugs */
  overallRmse: number;
  /** Bounded tuning deltas proposed by this run */
  proposedTuningDeltas: TuningDelta[];
  /** True when overall RMSE jumped >20% vs. previous run (drift alert) */
  driftAlert: boolean;
  /** Held-out validation result (when computed) */
  holdoutValidation?: {
    sampleSize: number;
    holdoutRmse: number;
    fullRmse: number;
    deltasAcceptedAfterValidation: number;
  };
}
