/**
 * Risk-adjusted Net Present Value (rNPV) Engine
 *
 * Calculates probability-weighted NPV for pharmaceutical assets using:
 * - Phase-specific probability of success (PoS) from published FDA/BIO data
 * - Revenue projections based on market size and competitive position
 * - WACC-based discounting with territory-specific adjustments
 * - Cross-validation against multiplier-based benchmark estimates
 */

import type {
  RNPVInput,
  RNPVResult,
  CashFlowYear,
} from './types';
import {
  getCumulativePoS,
  PHASE_DURATION,
  PHASE_COSTS,
  REVENUE_CURVE,
  COGS_BY_MODALITY_CATEGORY,
  SGA_BY_LIFECYCLE_STAGE,
} from './pos-tables';
import { DEFAULT_DISCOUNT_RATES, COMPANY_TYPE_ADJUSTMENT, TERRITORY_RISK_PREMIUM, DEAL_TYPE_RISK_ADJUSTMENT } from './discount-rates';

/**
 * Effective corporate tax rate for pharma/biotech.
 * Source: Deloitte 2024 pharma tax benchmark — US effective rate ~15-21%;
 * we use 18% as a blended global rate reflecting offshore IP structures.
 */
const EFFECTIVE_TAX_RATE = 0.18;

// ---------------------------------------------------------------------------
// Indication-Specific PoS Modifiers
// ---------------------------------------------------------------------------
// Beyond base TA rates and modality adjustments, specific indication
// characteristics further modify the probability of success. These
// modifiers capture biomarker validation status, regulatory precedent,
// competitive density, modality-specific risks, and disease-modifying
// vs symptomatic treatment effects.
//
// Modifiers stack multiplicatively but are capped at ±40% of base PoS
// to prevent unrealistic extremes.
//
// Sources: BIO/Informa 2021, FDA CDER approval statistics, Nature Reviews
// Drug Discovery modality analyses, Wong Siah & Lo (2019).
// ---------------------------------------------------------------------------

/**
 * PoS modifier lookup. Each key maps to per-transition multipliers.
 * A multiplier of 1.20 means +20% to that transition's probability.
 */
const POS_MODIFIERS: Record<string, Partial<Record<string, number>>> = {
  // Biomarker validation: validated biomarker increases PoS
  biomarker_validated: { phase2ToPhase3: 1.20, phase3ToApproval: 1.15 },
  biomarker_unvalidated: { phase2ToPhase3: 0.85, phase3ToApproval: 0.80 },

  // Regulatory precedent
  has_approved_predecessor: { phase3ToApproval: 1.25 }, // Same target has approved drug
  first_in_class_target: { phase2ToPhase3: 0.80, phase3ToApproval: 0.75 },

  // Competition density
  crowded_indication: { phase2ToPhase3: 0.90, phase3ToApproval: 0.85 }, // >5 competitors in same phase
  unmet_need_high: { phase2ToPhase3: 1.10, phase3ToApproval: 1.15 },

  // Modality-specific risks
  gene_therapy: { phase1ToPhase2: 1.10, phase2ToPhase3: 0.85 }, // Manufacturing risk
  car_t: { phase1ToPhase2: 1.15, phase2ToPhase3: 0.90 },

  // Disease-modifying vs symptomatic (especially relevant for neurology)
  disease_modifying: { phase2ToPhase3: 0.75, phase3ToApproval: 0.65 },
  symptomatic: { phase2ToPhase3: 1.10, phase3ToApproval: 1.05 },
};

/** Maximum total PoS modifier deviation from base (±40%) */
const MAX_POS_MODIFIER_DEVIATION = 0.40;

/**
 * Derive applicable PoS modifier keys from RNPVInput properties.
 * Maps user-facing input fields to the modifier lookup keys.
 */
function deriveModifierKeys(input: RNPVInput): string[] {
  const keys: string[] = [];

  // Biomarker status
  if (input.biomarkerStatus === 'selected') {
    keys.push('biomarker_validated');
  } else if (input.biomarkerStatus === 'unselected') {
    keys.push('biomarker_unvalidated');
  }

  // Competitive position → crowded or unmet need
  if (input.competitivePosition === 'crowded' || input.competitivePosition === 'behind') {
    keys.push('crowded_indication');
  }
  if (input.competitivePosition === 'firstInClass') {
    keys.push('first_in_class_target');
    keys.push('unmet_need_high');
  }

  // Modality-specific
  const geneTherapyModalities = ['geneTherapy', 'geneTherapyOcular', 'geneTherapyRare'];
  const carTModalities = ['carT_heme', 'carT_solid', 'carT_autoimmune', 'inVivoCarT', 'carTreg'];
  if (geneTherapyModalities.includes(input.modality)) {
    keys.push('gene_therapy');
  }
  if (carTModalities.includes(input.modality)) {
    keys.push('car_t');
  }

  // Has approved predecessor — if competitive position shows existing approvals
  if (input.competitivePosition === 'bestInClass' || input.competitivePosition === 'behind') {
    keys.push('has_approved_predecessor');
  }

  return keys;
}

/**
 * Calculate the combined PoS modifier for a specific phase transition.
 *
 * Stacks all applicable modifiers multiplicatively, then clamps the
 * result to ±MAX_POS_MODIFIER_DEVIATION (±40%) of the unmodified value.
 *
 * @param transitionKey - Phase transition name (e.g., 'phase2ToPhase3')
 * @param modifierKeys - Active modifier keys for this asset
 * @returns Multiplicative adjustment factor (e.g., 1.15 = +15%)
 */
function getCombinedPosModifier(
  transitionKey: string,
  modifierKeys: string[],
): number {
  let combined = 1.0;

  for (const key of modifierKeys) {
    const modifiers = POS_MODIFIERS[key];
    if (modifiers && modifiers[transitionKey] != null) {
      combined *= modifiers[transitionKey]!;
    }
  }

  // Clamp to ±40% deviation from base
  const minMultiplier = 1.0 - MAX_POS_MODIFIER_DEVIATION;
  const maxMultiplier = 1.0 + MAX_POS_MODIFIER_DEVIATION;
  return Math.max(minMultiplier, Math.min(maxMultiplier, combined));
}

/**
 * Generic erosion at LOE by modality category.
 * Source: IQVIA Channel Dynamics, EvaluatePharma lifecycle analysis.
 * Small molecules face rapid generic substitution (80% erosion within 1 year).
 * Biologics face slower biosimilar adoption (30-50% over several years).
 */
const GENERIC_EROSION_BY_MODALITY: Record<string, number> = {
  smallMolecule: 0.80,   // Rapid generic substitution
  biologic: 0.40,        // Slower biosimilar uptake, physician inertia
  cellTherapy: 0.20,     // Minimal generic competition for autologous therapies
  geneTherapy: 0.15,     // One-time therapies, very limited biosimilar pathway
  vaccine: 0.50,         // Moderate — some biosimilar competition
  radiopharmaceutical: 0.30, // Complex manufacturing limits generic entry
};

/** Phase order for iteration */
const PHASE_ORDER = ['discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved'] as const;

/** Map phase to index */
function phaseIndex(phase: string): number {
  const idx = PHASE_ORDER.indexOf(phase as typeof PHASE_ORDER[number]);
  return idx >= 0 ? idx : 0;
}

/**
 * Calculate risk-adjusted NPV for a pharmaceutical asset.
 *
 * The model projects cash flows from current phase through patent expiry,
 * applies phase-specific PoS discounting, and calculates implied deal terms.
 */
export function calculateRNPV(input: RNPVInput): RNPVResult {
  // --- Input guards ---
  const VALID_PHASES = ['discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved'];
  const guardedPhase = VALID_PHASES.includes(input.phase) ? input.phase : 'phase2';
  const guardedDiscountRate = input.discountRate != null
    ? Math.max(0.01, Math.min(0.40, input.discountRate))
    : input.discountRate;
  const guardedPeakSales = {
    low: Math.max(0, Math.min(1_000_000, input.peakSalesEstimate.low)),
    median: Math.max(0, Math.min(1_000_000, input.peakSalesEstimate.median)),
    high: Math.max(0, Math.min(1_000_000, input.peakSalesEstimate.high)),
  };

  const {
    therapeuticArea,
    modality,
    territory,
    competitivePosition,
    dataQuality,
    regulatoryDesignations,
    benchmarkDealValue,
  } = input;
  const dealType = input.dealType || 'licensing';
  const phase = guardedPhase as typeof input.phase;
  const peakSalesEstimate = guardedPeakSales;

  // 1. Get discount rate (use guarded value, or compute from TA + territory + company type + deal type)
  const discountRate = guardedDiscountRate ?? getDefaultDiscountRate(therapeuticArea, phase, territory, input.companyType, dealType);

  // 2. Calculate cumulative PoS from current phase
  const { cumulativePoS: rawCumulativePoS, transitions } = getCumulativePoS(
    phase,
    therapeuticArea,
    modality,
    input.biomarkerStatus || 'unselected',
    regulatoryDesignations,
  );

  // 2b. Apply indication-specific PoS modifiers
  // These adjust the cumulative PoS based on biomarker validation,
  // competitive density, modality-specific risks, and disease characteristics.
  // Modifiers stack multiplicatively but cap at ±40% of base PoS.
  const modifierKeys = deriveModifierKeys(input);
  let indicationModifier = 1.0;
  // Apply the combined modifier for the most impactful transition
  // (approximation: use the geometric mean of all applicable transition modifiers)
  const transitionKeys = ['phase1ToPhase2', 'phase2ToPhase3', 'phase3ToApproval'];
  let modifierProduct = 1.0;
  let modifierCount = 0;
  for (const tk of transitionKeys) {
    const mod = getCombinedPosModifier(tk, modifierKeys);
    if (mod !== 1.0) {
      modifierProduct *= mod;
      modifierCount++;
    }
  }
  if (modifierCount > 0) {
    indicationModifier = Math.pow(modifierProduct, 1.0 / transitionKeys.length);
  }

  const modifiedPoS = Math.max(0, Math.min(1, rawCumulativePoS * indicationModifier));

  // Apply scenario PoS multiplier (e.g., 0.85 for reduced approval confidence)
  // Clamp to [0, 1] to keep probability valid
  const cumulativePoS = input.posMultiplier != null
    ? Math.max(0, Math.min(1, modifiedPoS * input.posMultiplier))
    : modifiedPoS;

  // 3. Calculate years to market from current phase
  const durations = PHASE_DURATION[therapeuticArea] || PHASE_DURATION.oncology;
  const costs = PHASE_COSTS[therapeuticArea] || PHASE_COSTS.oncology;
  const currentIdx = phaseIndex(phase);

  let yearsToMarket = 0;
  const phaseTransitions: RNPVResult['phaseTransitions'] = [];
  let runningCumProb = 1.0;

  for (let i = currentIdx; i < PHASE_ORDER.length; i++) {
    const phaseName = PHASE_ORDER[i];
    const duration = durations[phaseName] || 2.0;
    const cost = costs[phaseName] || 30;
    const transition = transitions[i - currentIdx];

    if (transition) {
      runningCumProb = transition.cumulativeProb;
    }

    phaseTransitions.push({
      phase: phaseName,
      probability: transition?.probability ?? 1.0,
      cumulativeProb: runningCumProb,
      yearsToComplete: duration,
      costEstimate: cost,
    });

    if (phaseName !== 'approved') {
      yearsToMarket += duration;
    }
  }
  // Add regulatory review time
  yearsToMarket += durations.regulatory || 1.0;

  // Apply scenario time-to-market adjustment (delays or accelerations)
  if (input.timeToMarketAdjustment) {
    yearsToMarket = Math.max(0, yearsToMarket + input.timeToMarketAdjustment);
  }

  // 4. Data quality confidence adjustment to peak sales
  // Note: Competitive position adjustment is handled upstream in the market-size
  // engine (SOM = SAM × market share by position). We do NOT re-apply it here
  // to avoid double-counting. Only data quality affects peak sales at this stage.
  // Source: Internal calibration — data quality reflects confidence in projections
  const dataQualityAdj = getDataQualityAdjustment(dataQuality);

  const adjustedPeakSales = {
    low: peakSalesEstimate.low * dataQualityAdj,
    median: peakSalesEstimate.median * dataQualityAdj,
    high: peakSalesEstimate.high * dataQualityAdj,
  };

  // 5. Project cash flows using median peak sales
  const cashFlows = projectCashFlows(
    adjustedPeakSales.median,
    yearsToMarket,
    discountRate,
    cumulativePoS,
    costs,
    currentIdx,
    durations,
    modality,
  );

  // 6. Calculate NPV from cash flows
  let unadjustedNPV = 0;
  let riskAdjustedNPV = 0;

  for (const cf of cashFlows) {
    unadjustedNPV += cf.presentValue;
    riskAdjustedNPV += cf.riskAdjustedPV;
  }

  // 7. Terminal value (residual revenue after explicit forecast period)
  // Post-LOE drugs have declining revenue, so we use a declining perpetuity
  // with negative terminal growth reflecting generic erosion.
  // Source: EvaluatePharma lifecycle analysis — post-LOE revenue declines
  // at 15-25% annually; we use -10% as a conservative long-term steady state.
  const TERMINAL_DECLINE_RATE = -0.10; // 10% annual decline post-LOE
  const lastRevenueCF = [...cashFlows].reverse().find(cf => cf.revenue > 0);
  let terminalValue = 0;
  const genericErosion = getGenericErosionRate(modality);
  if (lastRevenueCF && lastRevenueCF.revenue > 0) {
    const terminalRevenue = lastRevenueCF.revenue * (1 - genericErosion); // Retained revenue post-LOE (modality-dependent)
    // Gordon growth model with negative growth: TV = CF / (r - g), discounted to present
    // Source: Damodaran, "Valuing pharma companies" — terminal value for mature drugs
    const denominator = discountRate - TERMINAL_DECLINE_RATE; // r - g where g is negative, so r + |g|
    if (denominator > 0.01) { // safety guard
      const terminalPV = (terminalRevenue / denominator);
      // Discount from the terminal year back to present, and risk-adjust
      const terminalYear = lastRevenueCF.year || cashFlows.length;
      const terminalDF = 1 / Math.pow(1 + discountRate, terminalYear);
      terminalValue = terminalPV * terminalDF * cumulativePoS;
    }
  }
  riskAdjustedNPV += terminalValue;

  // 8. Find peak sales year
  const peakCF = cashFlows.reduce((max, cf) => cf.revenue > max.revenue ? cf : max, cashFlows[0]);
  const peakSalesYear = peakCF?.year || 0;

  // 9. Calculate implied deal terms
  // Upfront % depends on both phase and deal type.
  // Deal-type overrides (acquisition, option, etc.) take precedence over phase-based ratios.
  const upfrontPercent = getDealTypeUpfrontPercent(dealType) ?? getUpfrontPercent(phase);
  const impliedDealValue = {
    upfront: {
      low: riskAdjustedNPV * upfrontPercent.low,
      median: riskAdjustedNPV * upfrontPercent.median,
      high: riskAdjustedNPV * upfrontPercent.high,
    },
    totalDeal: {
      low: riskAdjustedNPV * 0.40,
      median: riskAdjustedNPV * 0.55,
      high: riskAdjustedNPV * 0.75,
    },
  };

  // 10. Cross-validation with benchmark-based deal value
  // Use phase-dependent deal-to-rNPV ratio for more accurate comparison.
  // Earlier phases have lower deal/rNPV ratios due to higher risk premium.
  // Source: DealForma 2020-2025 — median total deal value as fraction of rNPV by phase.
  let crossValidation: RNPVResult['crossValidation'];
  if (benchmarkDealValue) {
    const benchMedian = benchmarkDealValue.median;
    const phaseDealRatio = getPhaseDealToRNPVRatio(phase);
    const rnpvImpliedMedian = riskAdjustedNPV * phaseDealRatio;
    const divergence = benchMedian > 0
      ? ((rnpvImpliedMedian - benchMedian) / benchMedian) * 100
      : 0;

    crossValidation = {
      benchmarkMedian: benchMedian,
      rnpvMedian: rnpvImpliedMedian,
      divergencePercent: Math.round(divergence),
      narrative: generateDivergenceNarrative(divergence, phase, therapeuticArea, competitivePosition),
    };
  }

  // 11. Model assumptions documentation
  const posModifierNote = modifierKeys.length > 0
    ? ` (indication-adjusted: ${modifierKeys.join(', ')} → ${indicationModifier >= 1 ? '+' : ''}${((indicationModifier - 1) * 100).toFixed(1)}%)`
    : '';
  const modelAssumptions = [
    `Discount rate: ${(discountRate * 100).toFixed(1)}% (${therapeuticArea} ${phase} risk-adjusted WACC${territory ? `, ${territory} territory` : ''}${input.companyType ? `, ${input.companyType}` : ''}${dealType !== 'licensing' ? `, ${dealType} deal structure` : ''})`,
    `Cumulative PoS from ${phase}: ${(cumulativePoS * 100).toFixed(1)}%${posModifierNote}`,
    `Years to market: ${yearsToMarket.toFixed(1)} years`,
    `Peak sales estimate: $${adjustedPeakSales.median.toFixed(0)}M (adj. for data quality; competitive position applied upstream)`,
    `Revenue ramp: ${REVENUE_CURVE.rampUpYears}yr ramp, ${REVENUE_CURVE.peakDurationYears}yr peak, ${(REVENUE_CURVE.declineRate * 100).toFixed(0)}% annual decline`,
    `LOE: ${REVENUE_CURVE.loeYearsAfterApproval} years post-approval; generic erosion: ${(genericErosion * 100).toFixed(0)}% (${modality})`,
    `COGS: modality-specific (${modality}); SG&A: lifecycle-stage-specific`,
    `Corporate tax: ${(EFFECTIVE_TAX_RATE * 100).toFixed(0)}% effective rate on positive operating income`,
  ];

  return {
    riskAdjustedNPV: Math.round(riskAdjustedNPV),
    unadjustedNPV: Math.round(unadjustedNPV),
    cumulativePoS,
    phaseTransitions,
    cashFlows,
    peakSalesYear,
    yearsToMarket: Math.round(yearsToMarket * 10) / 10,
    impliedDealValue: {
      upfront: roundRange(impliedDealValue.upfront),
      totalDeal: roundRange(impliedDealValue.totalDeal),
    },
    crossValidation,
    discountRate,
    terminalValue: Math.round(terminalValue),
    modelAssumptions,
  };
}

/**
 * Project year-by-year cash flows from current phase through patent expiry.
 */
function projectCashFlows(
  peakSales: number,
  yearsToMarket: number,
  discountRate: number,
  cumulativePoS: number,
  phaseCosts: Record<string, number>,
  currentPhaseIdx: number,
  durations: Record<string, number>,
  modality: string,
): CashFlowYear[] {
  const cashFlows: CashFlowYear[] = [];
  const { rampUpYears, peakDurationYears, declineRate, loeYearsAfterApproval } = REVENUE_CURVE;
  // Use modality-dependent generic erosion instead of the flat 80% constant
  const genericErosion = getGenericErosionRate(modality);
  const totalYears = Math.ceil(yearsToMarket) + loeYearsAfterApproval + 5; // +5 for post-LOE tail

  // R&D cost phase mapping (years spent in each remaining phase)
  let rdYearsSoFar = 0;
  const rdSchedule: { startYear: number; endYear: number; annualCost: number }[] = [];
  for (let i = currentPhaseIdx; i < PHASE_ORDER.length; i++) {
    const phaseName = PHASE_ORDER[i];
    const dur = durations[phaseName] || 2.0;
    const totalCost = phaseCosts[phaseName] || 0;
    const annualCost = dur > 0 ? totalCost / dur : 0;
    rdSchedule.push({
      startYear: rdYearsSoFar,
      endYear: rdYearsSoFar + dur,
      annualCost,
    });
    rdYearsSoFar += dur;
  }

  const launchYear = Math.ceil(yearsToMarket);

  for (let year = 0; year <= totalYears; year++) {
    const yearsSinceLaunch = year - launchYear;

    // Revenue model
    let revenue = 0;
    if (yearsSinceLaunch >= 0) {
      if (yearsSinceLaunch < rampUpYears) {
        // S-curve ramp: cubic easing
        const t = yearsSinceLaunch / rampUpYears;
        revenue = peakSales * (3 * t * t - 2 * t * t * t);
      } else if (yearsSinceLaunch < rampUpYears + peakDurationYears) {
        revenue = peakSales;
      } else if (yearsSinceLaunch < loeYearsAfterApproval) {
        const declineYears = yearsSinceLaunch - rampUpYears - peakDurationYears;
        revenue = peakSales * Math.pow(1 - declineRate, declineYears);
      } else {
        // Post-LOE: sharp generic erosion
        const postLoeYears = yearsSinceLaunch - loeYearsAfterApproval;
        revenue = peakSales * (1 - genericErosion) * Math.pow(0.85, postLoeYears);
      }
    }

    // COGS by modality category
    // Source: Industry benchmarks — biologics 15-20%, small molecules 8-12%, cell/gene 25-35%
    const cogsRate = getCogsRate(modality);
    const cogs = revenue * cogsRate;
    const grossProfit = revenue - cogs;

    // R&D costs during development
    let rdCosts = 0;
    for (const sched of rdSchedule) {
      if (year >= sched.startYear && year < sched.endYear) {
        rdCosts = sched.annualCost;
        break;
      }
    }

    // SG&A by lifecycle stage
    // Source: Deloitte biopharma R&D benchmarking; McKinsey launch excellence database
    let sgaCosts = 0;
    if (yearsSinceLaunch >= 0) {
      if (yearsSinceLaunch < 1) {
        sgaCosts = revenue * SGA_BY_LIFECYCLE_STAGE.launch;      // 35% — salesforce build-out
      } else if (yearsSinceLaunch < rampUpYears) {
        sgaCosts = revenue * SGA_BY_LIFECYCLE_STAGE.growth;       // 28% — market development
      } else if (yearsSinceLaunch < rampUpYears + peakDurationYears) {
        sgaCosts = revenue * SGA_BY_LIFECYCLE_STAGE.peak;         // 22% — mature operations
      } else if (yearsSinceLaunch < loeYearsAfterApproval) {
        sgaCosts = revenue * SGA_BY_LIFECYCLE_STAGE.decline;      // 18% — optimized footprint
      } else {
        sgaCosts = revenue * SGA_BY_LIFECYCLE_STAGE.postLOE;      // 10% — minimal support
      }
    }

    const preTaxCashFlow = grossProfit - rdCosts - sgaCosts;
    // Apply corporate tax on positive operating income only (no tax benefit on losses
    // for simplicity — pharma NOL carryforwards are complex and company-specific)
    const tax = preTaxCashFlow > 0 ? preTaxCashFlow * EFFECTIVE_TAX_RATE : 0;
    const netCashFlow = preTaxCashFlow - tax;
    const discountFactor = 1 / Math.pow(1 + discountRate, year);
    const presentValue = netCashFlow * discountFactor;

    // Risk-adjusted: probability of reaching this year's cash flows
    // During development: PoS-weighted; post-launch: full cumulative PoS
    const yearPoS = yearsSinceLaunch >= 0 ? cumulativePoS : getPartialPoS(year, launchYear, cumulativePoS);
    const riskAdjustedPV = presentValue * yearPoS;

    cashFlows.push({
      year,
      revenue: Math.round(revenue * 10) / 10,
      cogs: Math.round(cogs * 10) / 10,
      grossProfit: Math.round(grossProfit * 10) / 10,
      rdCosts: Math.round(rdCosts * 10) / 10,
      sgaCosts: Math.round(sgaCosts * 10) / 10,
      netCashFlow: Math.round(netCashFlow * 10) / 10,
      discountFactor: Math.round(discountFactor * 10000) / 10000,
      presentValue: Math.round(presentValue * 10) / 10,
      cumulativePoS: Math.round(yearPoS * 1000) / 1000,
      riskAdjustedPV: Math.round(riskAdjustedPV * 10) / 10,
    });
  }

  return cashFlows;
}

/** Map modality to COGS category
 * Source: Industry benchmarks — Deloitte biopharma manufacturing cost analysis */
function getCogsRate(modality: string): number {
  // Map specific modalities to categories
  // Comprehensive modality-to-COGS mapping — all biologic-class modalities must be listed
  // to avoid incorrectly defaulting to smallMolecule (10% COGS instead of 18%)
  const biologicModalities = [
    'mab', 'bispecific', 'tCellEngager', 'adc', 'fcrnAntagonist', 'complementInhibitor',
    'peptide', 'dualAntagonist', 'tl1aInhibitor', 'antiVegf', 'jakInhibitor',
    's1pModulator', 'oralIntegrin', 'pcsk9Targeting', 'antiActivin', 'intravitreal',
    'gnrhAntagonist', 'anticoagulantNovel', 'amylinAnalog', 'glp1Agonist',
    'dualIncretin', 'tripleIncretin', 'sglt2Inhibitor', 'oralPeptide',
    'hormoneTherapy', 'neuroactiveSteroid', 'myosinInhibitor',
  ];
  const cellTherapyModalities = ['carT_heme', 'carT_solid', 'cellTherapy', 'carT_autoimmune', 'inVivoCarT', 'carTreg', 'stemCell'];
  const geneTherapyModalities = ['geneTherapy', 'geneTherapyOcular', 'aso', 'rnai', 'oligonucleotide', 'mrna'];
  const vaccineModalities = ['therapeuticVaccine', 'vaccinePreventive', 'oncolyticVirus'];
  const radioModalities = ['radiopharmaceutical'];

  if (cellTherapyModalities.includes(modality)) return COGS_BY_MODALITY_CATEGORY.cellTherapy;
  if (geneTherapyModalities.includes(modality)) return COGS_BY_MODALITY_CATEGORY.geneTherapy;
  if (vaccineModalities.includes(modality)) return COGS_BY_MODALITY_CATEGORY.vaccine;
  if (radioModalities.includes(modality)) return COGS_BY_MODALITY_CATEGORY.radiopharmaceutical;
  if (biologicModalities.includes(modality)) return COGS_BY_MODALITY_CATEGORY.biologic;
  return COGS_BY_MODALITY_CATEGORY.smallMolecule; // default
}

/** Map modality to generic erosion rate at LOE.
 * Source: IQVIA Channel Dynamics — biologics retain more revenue post-LOE
 * than small molecules due to slower biosimilar adoption. */
function getGenericErosionRate(modality: string): number {
  const biologicModalities = ['mab', 'bispecific', 'tCellEngager', 'adc', 'fcrnAntagonist', 'complementInhibitor', 'peptide', 'dualAntagonist', 'tl1aInhibitor', 'antiVegf', 'jakInhibitor', 's1pModulator', 'oralIntegrin', 'pcsk9Targeting', 'antiActivin', 'intravitreal', 'gnrhAntagonist', 'anticoagulantNovel', 'amylinAnalog', 'glp1Agonist', 'dualIncretin', 'tripleIncretin', 'sglt2Inhibitor', 'fcrnAntagonist', 'complementInhibitor'];
  const cellTherapyModalities = ['carT_heme', 'carT_solid', 'cellTherapy', 'carT_autoimmune', 'inVivoCarT', 'carTreg', 'stemCell'];
  const geneTherapyModalities = ['geneTherapy', 'geneTherapyOcular', 'aso', 'rnai', 'oligonucleotide', 'mrna'];
  const vaccineModalities = ['therapeuticVaccine', 'vaccinePreventive', 'oncolyticVirus'];
  const radioModalities = ['radiopharmaceutical'];

  if (cellTherapyModalities.includes(modality)) return GENERIC_EROSION_BY_MODALITY.cellTherapy;
  if (geneTherapyModalities.includes(modality)) return GENERIC_EROSION_BY_MODALITY.geneTherapy;
  if (vaccineModalities.includes(modality)) return GENERIC_EROSION_BY_MODALITY.vaccine;
  if (radioModalities.includes(modality)) return GENERIC_EROSION_BY_MODALITY.radiopharmaceutical;
  if (biologicModalities.includes(modality)) return GENERIC_EROSION_BY_MODALITY.biologic;
  return GENERIC_EROSION_BY_MODALITY.smallMolecule; // default
}

/**
 * Calculate partial PoS for development years using discrete phase milestones.
 *
 * During development, risk is NOT linearly distributed — it concentrates at
 * phase transition points (IND, Phase 1 readout, Phase 2 readout, etc.).
 * We use the phase-specific cumulative probabilities at each milestone.
 *
 * Source: BIO/Informa 2021 — risk is concentrated at go/no-go decisions,
 * not spread evenly across time.
 */
function getPartialPoS(year: number, launchYear: number, fullPoS: number): number {
  if (launchYear <= 0) return fullPoS;
  // Step function: the PoS for a given development year is the
  // cumulative probability of having passed all prior go/no-go gates.
  // We approximate this as: PoS improves in jumps at ~25%, ~50%, ~75% of timeline
  const progress = Math.min(year / launchYear, 1.0);
  if (progress >= 1.0) return fullPoS;

  // Sigmoidal risk curve — most risk concentrates in Phase 2/3 transition (middle)
  // This better reflects that early development years have low attrition
  // and late development (Phase 2→3) has the highest attrition
  const sigmoid = 1 / (1 + Math.exp(-10 * (progress - 0.5)));
  return 1.0 - sigmoid * (1.0 - fullPoS);
}

/** Get default discount rate for therapeutic area, phase, territory, company type, and deal type.
 * Additive adjustments from territory risk premium, company type, and deal type are applied
 * to the base TA/phase rate. Source: Damodaran, EY biopharma valuation benchmarks. */
function getDefaultDiscountRate(
  therapeuticArea: string,
  phase: string,
  territory?: string,
  companyType?: string,
  dealType?: string,
): number {
  const taRates = DEFAULT_DISCOUNT_RATES[therapeuticArea] || DEFAULT_DISCOUNT_RATES.oncology;
  let rate = taRates[phase] || taRates.phase2 || 0.12;

  // Apply territory risk premium (e.g., China +2.5pp, US -0.5pp)
  if (territory && TERRITORY_RISK_PREMIUM[territory] != null) {
    rate += TERRITORY_RISK_PREMIUM[territory];
  }

  // Apply company-type adjustment (e.g., large pharma -1pp, clinical-stage biotech +2.5pp)
  if (companyType && COMPANY_TYPE_ADJUSTMENT[companyType] != null) {
    rate += COMPANY_TYPE_ADJUSTMENT[companyType];
  }

  // Apply deal-type risk adjustment (e.g., acquisition -1.5pp, collaboration +2pp)
  if (dealType && DEAL_TYPE_RISK_ADJUSTMENT[dealType] != null) {
    rate += DEAL_TYPE_RISK_ADJUSTMENT[dealType];
  }

  // Clamp to reasonable range
  return Math.max(0.05, Math.min(0.30, rate));
}

/** Data quality adjustment to peak sales (better data = more confidence in projections) */
function getDataQualityAdjustment(dataQuality: string): number {
  const adjustments: Record<string, number> = {
    pivotalReady: 1.10,
    strongPhase2: 1.05,
    promising: 1.00,
    mixed: 0.90,
    limited: 0.80,
  };
  return adjustments[dataQuality] || 1.0;
}

/** Get upfront payment as % of rNPV by phase
 * Source: DealForma/BioCentury deal analysis 2020-2025 — median upfront
 * as fraction of total deal value, converted to rNPV basis using typical
 * rNPV-to-deal-value ratios by phase.
 *
 * Phase 2 deals: DealForma reports median upfront of 18% of total deal,
 * and total deal is typically 55% of rNPV, giving upfront ≈ 10% of rNPV (low)
 * to 25% (high for competitive assets).
 */
function getUpfrontPercent(phase: string): { low: number; median: number; high: number } {
  const percents: Record<string, { low: number; median: number; high: number }> = {
    preclinical: { low: 0.03, median: 0.05, high: 0.08 },
    phase1: { low: 0.05, median: 0.10, high: 0.15 },
    phase2: { low: 0.10, median: 0.18, high: 0.25 },
    phase3: { low: 0.20, median: 0.30, high: 0.40 },
    approved: { low: 0.35, median: 0.50, high: 0.65 },
  };
  return percents[phase] || percents.phase2;
}

/**
 * Get deal-type-specific upfront % overrides.
 * Returns null for 'licensing' (use phase-based ratios instead).
 *
 * These ratios mirror the dealTypeUpfrontOverrides in calculations.ts,
 * adapted to the rNPV context where the median is interpolated.
 *
 * Source: DealForma/BioCentury 2020-2025 deal analysis by deal structure.
 */
function getDealTypeUpfrontPercent(dealType: string): { low: number; median: number; high: number } | null {
  const overrides: Record<string, { low: number; median: number; high: number }> = {
    acquisition: { low: 0.70, median: 0.825, high: 0.95 },    // Mostly upfront cash
    codevelopment: { low: 0.15, median: 0.225, high: 0.30 },   // Shared risk = lower upfront
    option: { low: 0.05, median: 0.10, high: 0.15 },           // Option premium, exercise later
    collaboration: { low: 0.10, median: 0.175, high: 0.25 },   // Research funding, early partnership
  };
  return overrides[dealType] || null;
}

/** Generate narrative explaining divergence between benchmark and rNPV valuations */
function generateDivergenceNarrative(
  divergencePercent: number,
  phase: string,
  therapeuticArea: string,
  competitivePosition: string,
): string {
  const absDivergence = Math.abs(divergencePercent);

  if (absDivergence <= 15) {
    return `The rNPV-implied deal value aligns closely with comparable deal benchmarks (${divergencePercent > 0 ? '+' : ''}${Math.round(divergencePercent)}% divergence), providing strong cross-validation of the estimated deal terms.`;
  }

  if (divergencePercent > 15) {
    const reasons = [];
    if (phase === 'phase3' || phase === 'approved') {
      reasons.push('advanced clinical stage reducing risk discount');
    }
    if (competitivePosition === 'firstInClass' || competitivePosition === 'firstToPivotal') {
      reasons.push('strong competitive positioning boosting projected market share');
    }
    if (therapeuticArea === 'oncology' || therapeuticArea === 'metabolic') {
      reasons.push('large addressable market in ' + therapeuticArea);
    }
    const reasonText = reasons.length > 0 ? ` Key drivers: ${reasons.join('; ')}.` : '';
    return `The rNPV model suggests the asset may be worth ${Math.round(divergencePercent)}% more than comparable deal benchmarks indicate.${reasonText} This could represent an opportunity for the licensor to negotiate above-market terms, or it may reflect optimistic market size assumptions that warrant scrutiny.`;
  }

  // divergencePercent < -15
  const reasons = [];
  if (phase === 'preclinical' || phase === 'phase1') {
    reasons.push('high clinical attrition risk at early stage');
  }
  if (competitivePosition === 'behind' || competitivePosition === 'crowded') {
    reasons.push('competitive pressure limiting projected market share');
  }
  if (therapeuticArea === 'neurology') {
    reasons.push('historically lower CNS development success rates');
  }
  const reasonText = reasons.length > 0 ? ` Key factors: ${reasons.join('; ')}.` : '';
  return `The rNPV model values the asset ${Math.round(Math.abs(divergencePercent))}% below comparable deal benchmarks.${reasonText} Benchmarks may reflect strategic premiums (e.g., competitive urgency, portfolio fit) not captured in the DCF model. Consider whether the deal premium is justified by strategic value.`;
}

/** Phase-dependent deal-to-rNPV ratio for cross-validation.
 * Earlier-phase deals capture a smaller fraction of rNPV due to risk premium.
 * Source: DealForma/BioCentury deal analysis 2020-2025 */
function getPhaseDealToRNPVRatio(phase: string): number {
  const ratios: Record<string, number> = {
    discovery: 0.25,
    preclinical: 0.35,
    phase1: 0.40,
    phase1_2: 0.45,
    phase2: 0.55,
    phase2_3: 0.60,
    phase3: 0.70,
    nda_filed: 0.80,
    approved: 0.90,
  };
  return ratios[phase] || 0.55;
}

/** Round a range object to nearest integer */
function roundRange(range: { low: number; median: number; high: number }): { low: number; median: number; high: number } {
  return {
    low: Math.round(range.low),
    median: Math.round(range.median),
    high: Math.round(range.high),
  };
}
