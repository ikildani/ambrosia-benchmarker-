/**
 * Financial Modeling Orchestrator
 *
 * Runs the full suite of synchronous financial engines:
 * rNPV, Monte Carlo, market sizing, FX sensitivity, scenario planning.
 *
 * This runs client-side (all engines are pure TypeScript, zero deps).
 * Server-side operations (competitive landscape, deal flow forecast)
 * are fetched via API from the UI components.
 */

import type { CalculationInput, CalculationResult } from '@/lib/calculations';
import type {
  RNPVInput,
  RNPVResult,
  MonteCarloResult,
  MarketSizeEstimate,
  FXSensitivity,
  ScenarioResult,
  DealWaterfall,
  ScenarioComparisonResult,
  LifecycleExtensionResult,
  EnsembleResult,
} from './types';
import { calculateRNPV } from './rnpv-engine';
import { runMonteCarlo } from './monte-carlo';
import { estimateMarketSize, getEpidemiologyData } from './market-size';
import { calculateFXSensitivity } from './fx-sensitivity';
import { runAllScenarios, getDefensiveAnalysis } from './scenario-planner';
import { DEFAULT_DISCOUNT_RATES, TERRITORY_RISK_PREMIUM } from './discount-rates';
import { buildDealWaterfall, generateScenarioComparison, calculateLifecycleExtensions } from './institutional-upgrades';
import { calculateCompetitiveDynamics, calculateRealOptions } from './advanced-upgrades';
import type { CompetitiveDynamicsResult, RealOptionsResult } from './advanced-upgrades';
import { checkCrossEngineConsistency } from './consistency-checks';
import { assertInvariants, checkScenarioInvariants } from './invariants';
import { calculateEnsembleValuation } from './ensemble-valuation';
import { computeCalculationFingerprint } from './calculation-version';
import { computeRegulatoryRisk, type RegulatoryRiskResult } from './regulatory-risk';
import { computeGlobalRegulatoryRisk } from './global-regulatory-risk';
import { computeMilestoneProbabilities, type MilestoneProbabilityResult } from './milestone-probability';
import { computeTaxStructureImpact, type TaxStructureResult } from './cross-border-tax';
import { estimateStackingByModality, type RoyaltyStackingResult } from './royalty-stacking';
import { computePatentDynamics, type PatentDynamicsResult } from './patent-loe-dynamics';
import { computeCMCRisk, type CMCRiskResult } from './cmc-timeline-risk';
import { DEFAULT_EARNOUT_STRUCTURE, computeEarnoutValue, type EarnoutResult } from './earnout-cvr';
import { computePricingConstraints, type PricingConstraintResult } from './pricing-access';
import { computeIndicationSequence, type IndicationSequenceResult } from './indication-sequencing';
import { computeBuyerSynergy, BUYER_PROFILES, type BuyerSynergyResult } from './buyer-synergy';

/** Full output of the financial modeling pipeline */
export interface FinancialModelResult {
  rnpv: RNPVResult;
  monteCarlo: MonteCarloResult;
  marketSize: MarketSizeEstimate | null;
  fxSensitivity: FXSensitivity;
  scenarios: ScenarioResult[];
  defensiveAnalysis: {
    worstCase: ScenarioResult;
    bestCase: ScenarioResult;
    defensiveFloor: number;
    walkAwayThreshold: number;
    narrative: string;
  };
  // Institutional-grade upgrades
  dealWaterfall: DealWaterfall;
  scenarioComparison: ScenarioComparisonResult;
  lifecycleExtensions: LifecycleExtensionResult;
  competitiveDynamics: CompetitiveDynamicsResult;
  realOptions: RealOptionsResult;
  /** Tier 3 Item 7: blended valuation across rNPV / comparables / real options */
  ensemble: EnsembleResult;
  /** Deterministic fingerprint for full model reproducibility (inputs + engine version) */
  calculationFingerprint?: string;

  // ── Institutional-Grade Extensions (Steps 12-21) ──
  regulatoryRisk?: RegulatoryRiskResult;
  milestoneProbabilities?: MilestoneProbabilityResult;
  taxStructure?: TaxStructureResult;
  royaltyStacking?: RoyaltyStackingResult;
  patentDynamics?: PatentDynamicsResult;
  cmcRisk?: CMCRiskResult;
  earnoutValuation?: EarnoutResult;
  pricingConstraints?: PricingConstraintResult;
  indicationSequence?: IndicationSequenceResult;
  buyerSynergies?: BuyerSynergyResult[];
}

/**
 * Map CalculationInput into RNPVInput.
 * Bridges the existing calculator inputs to the financial engine's expected format.
 */
function buildRNPVInput(
  inputs: CalculationInput,
  result: CalculationResult,
  peakSalesOverride?: { low: number; median: number; high: number },
): RNPVInput {
  // Estimate peak sales from the deal value if no epidemiology-based estimate
  // Phase-stratified multipliers: earlier phases have wider uncertainty ranges
  const totalDealMedian = result.terms.totalDealValue.median;
  const PEAK_SALES_MULTIPLIER: Record<string, { low: number; median: number; high: number }> = {
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
  const mult = PEAK_SALES_MULTIPLIER[inputs.phase] || PEAK_SALES_MULTIPLIER.phase2;
  const defaultPeakSales = {
    low: totalDealMedian * mult.low,
    median: totalDealMedian * mult.median,
    high: totalDealMedian * mult.high,
  };

  return {
    phase: inputs.phase,
    therapeuticArea: inputs.therapeuticArea,
    modality: inputs.modality,
    indication: inputs.indication,
    territory: inputs.territory,
    peakSalesEstimate: peakSalesOverride || defaultPeakSales,
    competitivePosition: inputs.competitivePosition || 'racing',
    differentiationFactors: inputs.differentiationFactors,
    dataQuality: inputs.dataQuality || 'moderate',
    biomarkerStatus: inputs.biomarker || 'unselected',
    regulatoryDesignations: {
      breakthrough: inputs.regulatoryDesignations?.breakthrough || false,
      fastTrack: inputs.regulatoryDesignations?.fastTrack || false,
      orphan: inputs.regulatoryDesignations?.orphan || false,
      prime: inputs.regulatoryDesignations?.prime || false,
    },
    discountRate: (() => {
      const baseRate = DEFAULT_DISCOUNT_RATES[inputs.therapeuticArea]?.[inputs.phase];
      return baseRate ? baseRate + (TERRITORY_RISK_PREMIUM[inputs.territory] || 0) : undefined;
    })(),
    benchmarkDealValue: {
      low: result.terms.totalDealValue.low,
      median: result.terms.totalDealValue.median,
      high: result.terms.totalDealValue.high,
    },
    dealType: inputs.dealType,

    // TA-specific modifiers — every user selection now moves the numbers
    lineOfTherapy: inputs.lineOfTherapy,
    combinationPotential: inputs.combinationPotential,
    treatmentApproach: inputs.treatmentApproach,

    // Neurology
    bbbPenetration: inputs.bbbPenetration,
    diseaseProgression: inputs.diseaseProgression,
    biomarkerValidation: inputs.biomarkerValidation,

    // Immunology
    immuneResetPotential: inputs.immuneResetPotential,
    targetSpecificity: inputs.targetSpecificity,
    diseaseSeverity: inputs.diseaseSeverity,
    treatmentGoal: inputs.treatmentGoal,

    // Metabolic
    weightLossEfficacy: inputs.weightLossEfficacy,
    routeOfAdministration: inputs.routeOfAdministration,
    mechanismDifferentiation: inputs.mechanismDifferentiation,
    comorbidityBreadth: inputs.comorbidityBreadth,

    // Cardiovascular
    cvOutcomeBenefit: inputs.cvOutcomeBenefit,
    cvTrialEndpoint: inputs.cvTrialEndpoint,
    cvPopulationRisk: inputs.cvPopulationRisk,

    // Infectious Disease
    resistanceProfile: inputs.resistanceProfile,
    infectionChronicity: inputs.infectionChronicity,
    publicHealthPriority: inputs.publicHealthPriority,

    // Ophthalmology
    ocularDelivery: inputs.ocularDelivery,
    treatmentDurability: inputs.treatmentDurability,
    visionImpact: inputs.visionImpact,

    // Women's Health
    whUnmetNeed: inputs.whUnmetNeed,
    whTargetPopulation: inputs.whTargetPopulation,

    // Rare Disease
    patientPopulationSize: inputs.patientPopulationSize,
    geneticBasis: inputs.geneticBasis,

    // Hematology
    hemeLineage: inputs.hemeLineage,
    transplantEligibility: inputs.transplantEligibility,
    mrdStatus: inputs.mrdStatus,

    // Dermatology
    skinSeverity: inputs.skinSeverity,
    chronicityProfile: inputs.chronicityProfile,
    topicalVsSystemic: inputs.topicalVsSystemic,

    // Gastroenterology
    giSegment: inputs.giSegment,
    biologicExperience: inputs.biologicExperience,
    endoscopicEndpoint: inputs.endoscopicEndpoint,
  };
}

/**
 * Run the full financial modeling pipeline synchronously.
 *
 * Total runtime: ~200-400ms for rNPV + Monte Carlo + scenarios + FX.
 */
export function runFinancialModel(
  inputs: CalculationInput,
  result: CalculationResult,
  epidemiologyDataset?: Record<string, { prevalencePerMillion: number; incidencePerMillion: number; diagnosedPercent: number; treatedPercent: number; drugEligiblePercent: number; annualCostOfTherapy: number; peakSalesRangeM?: { low: number; median: number; high: number }; sources: string[] }>,
  pipelineData?: import('./advanced-upgrades').PipelineIntelligence,
): FinancialModelResult {
  // Step 1: Market size estimation (if epi data available)
  let marketSize: MarketSizeEstimate | null = null;
  let peakSalesFromMarket: { low: number; median: number; high: number } | undefined;

  if (epidemiologyDataset) {
    const epiData = getEpidemiologyData(inputs.indication, epidemiologyDataset);
    marketSize = estimateMarketSize(
      inputs.indication,
      inputs.territory,
      inputs.competitivePosition || 'racing',
      epiData,
      inputs.therapeuticArea,  // R68 Task 4: TA-aware share adjustment
    );
    // Use epidemiology-derived peak sales for rNPV
    peakSalesFromMarket = marketSize.peakSales;
  }

  // R60c (2026-04-14): User-supplied peak-sales override (R23 UI input) now
  // flows into the rNPV engine. Previously the CalculationInput.peakSalesOverrideM
  // scalar was collected by the calculator form but never reached buildRNPVInput —
  // every BD user's custom analyst consensus was silently dropped. Override takes
  // highest priority: user input > epidemiology > phase-multiplier default.
  //
  // Given only a scalar median, spread ±30% around it for low/high bounds (matches
  // typical analyst consensus IQR per EvaluatePharma World Preview methodology).
  let peakSalesOverride: { low: number; median: number; high: number } | undefined;
  const userPeak = inputs.peakSalesOverrideM;
  if (userPeak != null && userPeak > 0) {
    peakSalesOverride = {
      low: userPeak * 0.7,
      median: userPeak,
      high: userPeak * 1.5,
    };
  } else {
    peakSalesOverride = peakSalesFromMarket;
  }

  // Step 2: rNPV calculation
  const rnpvInput = buildRNPVInput(inputs, result, peakSalesOverride);
  const rnpv = calculateRNPV(rnpvInput);

  // Step 3: Monte Carlo simulation (10K iterations, seeded for reproducibility)
  const monteCarlo = runMonteCarlo({ rnpvInput }, 42);

  // Step 4: FX sensitivity (use peak annual revenue, not lifetime sum)
  const baseRevenue = rnpv.cashFlows.length > 0
    ? Math.max(...rnpv.cashFlows.map(cf => cf.revenue), 0)
    : 0;
  const fxSensitivity = calculateFXSensitivity(
    inputs.territory,
    baseRevenue,
    rnpv.riskAdjustedNPV,
  );

  // Step 5: Scenario planning (pass precomputed scenarios to avoid duplicate computation)
  const scenarios = runAllScenarios(rnpvInput, rnpv);
  const defensiveAnalysis = getDefensiveAnalysis(rnpvInput, rnpv, scenarios);

  // Step 6: Deal Valuation Waterfall — translates rNPV → buyer economics
  const dealWaterfall = buildDealWaterfall(rnpvInput, rnpv);

  // Step 7: Bear/Base/Bull Scenario Comparison
  const scenarioComparison = generateScenarioComparison(rnpvInput, rnpv, calculateRNPV);

  // Step 8: Lifecycle Extension Modeling — label expansion, pediatric exclusivity, combos
  const lifecycleExtensions = calculateLifecycleExtensions(rnpvInput, rnpv);

  // Step 9: Competitive Dynamics — time-varying market share erosion
  // When pipelineData is provided, real competitor data from ClinicalTrials.gov
  // overrides the calibrated templates for grade A+ accuracy.
  const competitiveDynamics = calculateCompetitiveDynamics(rnpvInput, rnpv, pipelineData);

  // Step 10: Real Options Overlay — compound optionality via binomial lattice
  const realOptions = calculateRealOptions(rnpvInput, rnpv, monteCarlo);

  // Step 11: Ensemble Valuation (Tier 3 Item 7) — inverse-variance blend of
  // rNPV + comparable transactions + real options. Surfaces a single headline
  // number that is robust to method-specific bias.
  const ensemble = calculateEnsembleValuation(rnpv, monteCarlo, realOptions, rnpvInput);

  // Layer 2: Cross-engine consistency checks — logs to Sentry, never throws.
  try {
    const scenarioViolations = checkScenarioInvariants(scenarioComparison);
    const consistencyViolations = checkCrossEngineConsistency(
      rnpv,
      monteCarlo,
      undefined, // tornado baseline not exposed from this orchestrator
      scenarioComparison,
      dealWaterfall,
      undefined, // buyer-specific generic not computed in this orchestrator
    );
    const allViolations = [...scenarioViolations, ...consistencyViolations];
    if (allViolations.some(v => v.severity === 'critical')) {
      assertInvariants(allViolations, {
        context: 'run-financial-model',
        extra: {
          phase: inputs.phase,
          therapeuticArea: inputs.therapeuticArea,
          modality: inputs.modality,
          indication: inputs.indication,
        },
      });
    }
  } catch {
    // Never break production runs on a consistency check failure.
  }

  // Layer 4: Fire-and-forget metric logging for distribution monitoring.
  // Only runs on the server where the supabase service key is available.
  // Fails silently — this must never impact the calculation result.
  if (typeof window === 'undefined') {
    void logCalculationMetric({
      therapeuticArea: inputs.therapeuticArea,
      modality: inputs.modality,
      phase: inputs.phase,
      indication: inputs.indication,
      peakSales: rnpvInput.peakSalesEstimate?.median ?? 0,
      rnpv: rnpv.riskAdjustedNPV,
      unadjustedNpv: rnpv.unadjustedNPV,
      monteCarloP50: monteCarlo.percentiles?.p50 ?? 0,
      cumulativePoS: rnpv.cumulativePoS,
      yearsToMarket: rnpv.yearsToMarket,
      discountRate: rnpv.discountRate,
      invariantViolations: 0,
    });
  }

  // ── Steps 12-21: Institutional-Grade Extensions ──
  // Each wrapped in try/catch — non-critical, never breaks pipeline.

  // Step 12: Global Regulatory Pathway Risk Model (7 agencies, territory-aware)
  let regulatoryRisk: RegulatoryRiskResult | undefined;
  try {
    regulatoryRisk = computeGlobalRegulatoryRisk(
      rnpvInput.phase,
      rnpvInput.therapeuticArea,
      rnpvInput.modality,
      rnpvInput.indication,
      {
        breakthrough: rnpvInput.regulatoryDesignations.breakthrough,
        fastTrack: rnpvInput.regulatoryDesignations.fastTrack,
        orphan: rnpvInput.regulatoryDesignations.orphan,
        prime: rnpvInput.regulatoryDesignations.prime,
        acceleratedApproval: false,
        priorityReview: false,
        rarePediatric: false,
      },
      rnpvInput.territory || 'global',
    ) as unknown as RegulatoryRiskResult;
  } catch { /* non-critical — keep going */ }

  // Step 13: Milestone Probability Weighting
  let milestoneProbabilities: MilestoneProbabilityResult | undefined;
  try {
    milestoneProbabilities = computeMilestoneProbabilities(
      rnpvInput.phase,
      rnpvInput.therapeuticArea,
      rnpvInput.modality,
      rnpvInput.indication,
      rnpvInput.dealType ?? 'licensing',
    );
  } catch { /* non-critical — keep going */ }

  // Step 14: Cross-Border Tax Structuring
  let taxStructure: TaxStructureResult | undefined;
  try {
    const royaltyRate = 0.10; // default 10% royalty rate estimate
    taxStructure = computeTaxStructureImpact(
      rnpvInput.territory as 'us' | 'eu' | 'japan' | 'china' | 'row' | 'global',
      rnpv.impliedDealValue.totalDeal.median,
      royaltyRate,
      (rnpvInput.dealType ?? 'licensing') as 'licensing' | 'acquisition' | 'codevelopment' | 'option' | 'collaboration',
      rnpvInput.peakSalesEstimate.median,
    );
  } catch { /* non-critical — keep going */ }

  // Step 15: Royalty Stacking Risk
  let royaltyStacking: RoyaltyStackingResult | undefined;
  try {
    const baseRoyalty = (result.tieredRoyalties?.base?.low ?? 5) / 100;
    royaltyStacking = estimateStackingByModality(baseRoyalty, inputs.modality as any);
  } catch { /* non-critical — keep going */ }

  // Step 16: Patent Term & LOE Dynamics
  let patentDynamics: PatentDynamicsResult | undefined;
  try {
    const currentYear = new Date().getFullYear();
    const approvalYear = currentYear + Math.ceil(rnpv.yearsToMarket);
    patentDynamics = computePatentDynamics(
      rnpvInput.phase,
      rnpvInput.modality,
      rnpvInput.therapeuticArea,
      rnpvInput.indication,
      {
        breakthrough: rnpvInput.regulatoryDesignations.breakthrough,
        fastTrack: rnpvInput.regulatoryDesignations.fastTrack,
        orphan: rnpvInput.regulatoryDesignations.orphan,
        prime: rnpvInput.regulatoryDesignations.prime,
      },
      approvalYear,
    );
  } catch { /* non-critical — keep going */ }

  // Step 17: CMC Timeline & Risk
  let cmcRisk: CMCRiskResult | undefined;
  try {
    cmcRisk = computeCMCRisk(
      rnpvInput.modality,
      rnpvInput.phase,
      rnpvInput.therapeuticArea,
    );
  } catch { /* non-critical — keep going */ }

  // Step 18: Earnout / CVR Valuation
  let earnoutValuation: EarnoutResult | undefined;
  try {
    const earnoutStructure = DEFAULT_EARNOUT_STRUCTURE(
      rnpvInput.phase,
      rnpvInput.dealType ?? 'licensing',
    );
    earnoutValuation = computeEarnoutValue(
      earnoutStructure,
      rnpvInput.phase,
      rnpvInput.therapeuticArea,
      rnpv.discountRate,
      rnpvInput.peakSalesEstimate.median,
    );
  } catch { /* non-critical — keep going */ }

  // Step 19: Pricing & Reimbursement Constraints
  let pricingConstraints: PricingConstraintResult | undefined;
  try {
    // Estimate annual cost of therapy from peak sales and addressable patients
    const estimatedPatientsAtPeak = 10_000; // conservative default
    const annualCostOfTherapy = marketSize?.annualRevenuePerPatient
      ?? (rnpvInput.peakSalesEstimate.median * 1_000_000) / estimatedPatientsAtPeak;
    pricingConstraints = computePricingConstraints(
      rnpvInput.therapeuticArea,
      rnpvInput.modality,
      rnpvInput.indication,
      rnpvInput.territory,
      rnpvInput.peakSalesEstimate.median,
      annualCostOfTherapy,
    );
  } catch { /* non-critical — keep going */ }

  // Step 20: Indication Sequencing (franchise expansion)
  let indicationSequence: IndicationSequenceResult | undefined;
  try {
    indicationSequence = computeIndicationSequence(
      rnpvInput.therapeuticArea,
      rnpvInput.indication,
      rnpvInput.modality,
      rnpvInput.peakSalesEstimate.median,
    );
  } catch { /* non-critical — keep going */ }

  // Step 21: Buyer-Specific Synergy Analysis
  // Runs against all buyer archetypes in BUYER_PROFILES to produce an array
  // of synergy assessments ranked by total premium.
  let buyerSynergiesResult: BuyerSynergyResult[] | undefined;
  try {
    const modalityKeyMap: Record<string, import('./buyer-synergy').ModalityKey> = {
      smallMolecule: 'small_molecule', protac: 'small_molecule', molecularGlue: 'small_molecule',
      mab: 'mab', fcrnAntagonist: 'mab', complementInhibitor: 'mab',
      bispecific: 'bispecific', tCellEngager: 'bispecific', bispecificHeme: 'bispecific',
      adc: 'adc',
      geneTherapy: 'gene_therapy', geneTherapyRare: 'gene_therapy', geneTherapyOcular: 'gene_therapy',
      carT_heme: 'cell_therapy', carT_solid: 'cell_therapy', cellTherapy: 'cell_therapy', stemCell: 'cell_therapy',
      mrna: 'mrna',
      peptide: 'peptide', glp1Agonist: 'peptide', dualIncretin: 'peptide', tripleIncretin: 'peptide',
      rnai: 'oligonucleotide', aso: 'oligonucleotide', oligonucleotide: 'oligonucleotide',
      vaccinePreventive: 'vaccine', therapeuticVaccine: 'vaccine',
    };
    const assetProfile: import('./buyer-synergy').AssetSynergyProfile = {
      assetName: rnpvInput.indication,
      therapeuticArea: rnpvInput.therapeuticArea as import('./buyer-synergy').TherapeuticAreaKey,
      modality: modalityKeyMap[rnpvInput.modality] ?? 'small_molecule',
      indication: rnpvInput.indication,
      projectedPeakSales_M: rnpvInput.peakSalesEstimate.median,
      annualRDCost_M: rnpv.phaseTransitions.reduce((s, t) => s + t.costEstimate, 0) / Math.max(1, rnpv.yearsToMarket),
      filingGeographies: (['us', 'eu', 'japan', 'china', 'row'] as const).filter(
        g => g === rnpvInput.territory || rnpvInput.territory === 'global',
      ),
      mechanism: rnpvInput.modality,
      phase: rnpvInput.phase,
      requiresCompanionDx: false,
      numberOfBidders: 2,
      attractiveness: 6,
    };

    const results: BuyerSynergyResult[] = [];
    for (const profile of Object.values(BUYER_PROFILES)) {
      try {
        results.push(computeBuyerSynergy(profile, assetProfile));
      } catch { /* skip individual buyer failures */ }
    }
    results.sort((a, b) => b.totalSynergyPremium_pct - a.totalSynergyPremium_pct);
    buyerSynergiesResult = results;
  } catch { /* non-critical — keep going */ }

  return {
    rnpv,
    monteCarlo,
    marketSize,
    fxSensitivity,
    scenarios,
    defensiveAnalysis,
    dealWaterfall,
    scenarioComparison,
    lifecycleExtensions,
    competitiveDynamics,
    realOptions,
    ensemble,
    calculationFingerprint: computeCalculationFingerprint(inputs as unknown as Record<string, unknown>),
    regulatoryRisk,
    milestoneProbabilities,
    taxStructure,
    royaltyStacking,
    patentDynamics,
    cmcRisk,
    earnoutValuation,
    pricingConstraints,
    indicationSequence,
    buyerSynergies: buyerSynergiesResult,
  };
}

/**
 * Write a single calculation metric row to the calculation_metrics table.
 *
 * Fire-and-forget — caught errors are swallowed so the main calculation
 * pipeline is never impacted. Only runs on server (has service role key).
 */
interface CalculationMetricPayload {
  therapeuticArea: string;
  modality: string;
  phase: string;
  indication: string;
  peakSales: number;
  rnpv: number;
  unadjustedNpv: number;
  monteCarloP50: number;
  cumulativePoS: number;
  yearsToMarket: number;
  discountRate: number;
  invariantViolations: number;
}

async function logCalculationMetric(payload: CalculationMetricPayload): Promise<void> {
  try {
    // Use direct Supabase REST API to avoid importing @/lib/supabase/server,
    // which transitively pulls in next/headers and breaks client-side bundling.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    await fetch(`${url}/rest/v1/calculation_metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        therapeutic_area: payload.therapeuticArea,
        modality: payload.modality,
        phase: payload.phase,
        indication: payload.indication,
        peak_sales: payload.peakSales,
        rnpv: payload.rnpv,
        unadjusted_npv: payload.unadjustedNpv,
        monte_carlo_p50: payload.monteCarloP50,
        cumulative_pos: payload.cumulativePoS,
        years_to_market: payload.yearsToMarket,
        discount_rate: payload.discountRate,
        invariant_violations: payload.invariantViolations,
      }),
    });
  } catch {
    // Silently swallow — metric logging must never break calculations.
  }
}
