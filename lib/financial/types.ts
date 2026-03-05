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
   */
  impliedDealValue: {
    upfront: { low: number; median: number; high: number };
    totalDeal: { low: number; median: number; high: number };
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
    /** Predicted number of deals */
    predictedDeals: number;
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
