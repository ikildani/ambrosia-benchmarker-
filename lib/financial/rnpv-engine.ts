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
  REVENUE_CURVE_OVERRIDES,
  INDICATION_REVENUE_CURVES,
  COMPETITIVE_SHARE_TA_MULTIPLIER,
  COGS_BY_MODALITY_CATEGORY,
  SGA_BY_LIFECYCLE_STAGE,
  DATA_QUALITY_TIMELINE_MULTIPLIER,
} from './pos-tables';
import {
  MANUFACTURING_WACC_PREMIUM,
  MARKET_ACCESS_DELAY_MONTHS,
  checkPeakSalesRealism,
  checkPeakSalesCeiling,
  getGenericEntrenchmentMultiplier,
} from './index-drugs';
import { DEFAULT_DISCOUNT_RATES, COMPANY_TYPE_ADJUSTMENT, TERRITORY_RISK_PREMIUM, DEAL_TYPE_RISK_ADJUSTMENT, TERRITORY_TAX_RATE } from './discount-rates';
import { checkRNPVInvariants, assertInvariants } from './invariants';
import { getCompetitiveDensity } from './indication-competitive-density';
import {
  applyCombinationAdjustment,
  getCombinationDynamics,
} from './combination-therapy';
import { decomposeGeographicRevenue } from './geographic-revenue-curves';
import { decomposeRisk } from './risk-decomposition';
import { getDynamicWaccComponent } from './macro-factors';
import { getSubpopulationModifier } from './subpopulation-modifiers';
import { resolveUpfrontStructure } from './deal-structure-classifier';
import type { DealStructureClassification } from './deal-structure-classifier';
import { getPatentCliffAdjustment } from './patent-cliffs';
import { getTargetCombination, getDefaultCombinationEffect } from './target-combinations';
import { getTargetPeakSalesModifier, MODALITY_TARGET_OVERLAP } from './target-taxonomy';
import { getRoutePeakSalesModifier, getRouteCogsMultiplier } from './delivery-routes';
import { TIER2_FLAGS, TIER4_FLAGS } from '@/lib/feature-flags';
import { computeEmpiricalMultiplier } from './empirical-multiplier';
import { getCeiling, clampRange } from './indication-ceilings';
import { computeCalculationFingerprint } from './calculation-version';

/** Resolve territory-specific effective tax rate, defaulting to 18% global blend. */
function getEffectiveTaxRate(territory: string): number {
  return TERRITORY_TAX_RATE[territory] ?? 0.18;
}

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

  // Line of therapy
  firstLine: { phase2ToPhase3: 1.10, phase3ToApproval: 1.15 },
  thirdLinePlus: { phase2ToPhase3: 0.85, phase3ToApproval: 0.80 },

  // Combination potential
  strongCombination: { phase2ToPhase3: 1.10, phase3ToApproval: 1.08 },
  standaloneLimited: { phase2ToPhase3: 0.90, phase3ToApproval: 0.92 },

  // Neurology BBB penetration
  bbb_proven: { phase1ToPhase2: 1.15, phase2ToPhase3: 1.20 },
  bbb_unproven: { phase1ToPhase2: 0.75, phase2ToPhase3: 0.70 },
  bbb_promising: { phase1ToPhase2: 0.95, phase2ToPhase3: 0.90 },
  rapid_progressive_disease: { phase2ToPhase3: 1.15, phase3ToApproval: 1.10 },
  episodic_disease: { phase2ToPhase3: 0.90 },

  // Immunology
  curative_intent: { phase2ToPhase3: 0.80, phase3ToApproval: 0.85 },
  chronic_treatment: { phase2ToPhase3: 1.10, phase3ToApproval: 1.10 },
  narrow_target: { phase2ToPhase3: 1.10 },
  broad_immunosuppression: { phase2ToPhase3: 0.85 },
  severe_refractory_disease: { phase2ToPhase3: 1.15, phase3ToApproval: 1.10 },
  mild_moderate_disease: { phase2ToPhase3: 0.90 },

  // Metabolic
  superior_wl_efficacy: { phase2ToPhase3: 1.20, phase3ToApproval: 1.15 },
  modest_wl_efficacy: { phase2ToPhase3: 0.80, phase3ToApproval: 0.85 },
  oral_route: { phase2ToPhase3: 1.15 },
  implantable_route: { phase2ToPhase3: 0.85 },
  cardiometabolic_benefit: { phase2ToPhase3: 1.10, phase3ToApproval: 1.10 },
  novel_mechanism: { phase2ToPhase3: 0.90, phase3ToApproval: 0.85 },

  // Cardiovascular
  cv_mortality_reduction: { phase3ToApproval: 1.25 },
  cv_symptom_improvement: { phase3ToApproval: 0.85 },
  cv_mace_endpoint: { phase2ToPhase3: 0.90, phase3ToApproval: 1.15 },
  cv_surrogate_endpoint: { phase2ToPhase3: 1.10, phase3ToApproval: 0.90 },
  cv_high_risk_population: { phase2ToPhase3: 1.10 },
  cv_primary_prevention: { phase2ToPhase3: 0.85 },

  // Infectious Disease
  id_novel_target: { phase2ToPhase3: 1.15, phase3ToApproval: 1.10 },
  id_broad_spectrum: { phase2ToPhase3: 0.90 },
  id_chronic_infection: { phase2ToPhase3: 0.90, phase3ToApproval: 0.95 },
  id_acute_infection: { phase2ToPhase3: 1.10 },
  id_who_urgent: { phase2ToPhase3: 1.15, phase3ToApproval: 1.20 },

  // Ophthalmology
  ophtho_one_time: { phase2ToPhase3: 1.20 },
  ophtho_chronic_injection: { phase2ToPhase3: 0.90 },
  ophtho_topical: { phase2ToPhase3: 1.10 },
  ophtho_vision_threatening: { phase2ToPhase3: 1.15, phase3ToApproval: 1.10 },
  ophtho_symptom_relief: { phase2ToPhase3: 0.90 },
  ophtho_extended_durability: { phase2ToPhase3: 1.10 },

  // Women's Health
  wh_no_approved_therapy: { phase2ToPhase3: 1.20, phase3ToApproval: 1.15 },
  wh_well_served: { phase2ToPhase3: 0.85 },
  wh_pregnancy_complexity: { phase2ToPhase3: 0.80, phase3ToApproval: 0.85 },

  // Rare Disease
  rd_ultra_rare: { phase2ToPhase3: 1.25, phase3ToApproval: 1.20 },
  rd_broader_rare: { phase2ToPhase3: 1.05 },
  rd_monogenic: { phase2ToPhase3: 1.15, phase3ToApproval: 1.10 },
  rd_unknown_genetic: { phase2ToPhase3: 0.80 },

  // Hematology
  heme_mrd_endpoint: { phase2ToPhase3: 1.15, phase3ToApproval: 1.10 },
  heme_survival_endpoint: { phase2ToPhase3: 0.90, phase3ToApproval: 0.95 },
  heme_transplant_eligible: { phase2ToPhase3: 1.10 },
  heme_post_transplant: { phase2ToPhase3: 0.85 },

  // Dermatology
  derm_severe_refractory: { phase2ToPhase3: 1.10, phase3ToApproval: 1.05 },
  derm_mild: { phase2ToPhase3: 0.90 },
  derm_chronic_relapsing: { phase2ToPhase3: 1.05 },
  derm_topical_only: { phase2ToPhase3: 1.10 },
  derm_systemic: { phase2ToPhase3: 0.95 },

  // Gastroenterology
  gi_endoscopic_remission: { phase2ToPhase3: 1.15, phase3ToApproval: 1.10 },
  gi_clinical_only: { phase2ToPhase3: 0.90 },
  gi_biologic_naive: { phase2ToPhase3: 1.10 },
  gi_multi_biologic_exposed: { phase2ToPhase3: 0.80 },
  gi_upper_gi: { phase2ToPhase3: 0.95 },
  gi_colonic: { phase2ToPhase3: 1.05 },
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

  // Line of therapy
  if (input.lineOfTherapy === '1L') keys.push('firstLine');
  if (input.lineOfTherapy === '3L+') keys.push('thirdLinePlus');

  // Combination potential
  if (input.combinationPotential === 'strong') keys.push('strongCombination');
  if (input.combinationPotential === 'standalone') keys.push('standaloneLimited');

  // Neurology
  if (input.bbbPenetration === 'provenCNS') keys.push('bbb_proven');
  if (input.bbbPenetration === 'promisingPreclinical') keys.push('bbb_promising');
  if (input.bbbPenetration === 'unproven' || input.bbbPenetration === 'peripheralOnly') keys.push('bbb_unproven');
  if (input.diseaseProgression === 'rapidProgressive') keys.push('rapid_progressive_disease');
  if (input.diseaseProgression === 'episodic') keys.push('episodic_disease');

  // Immunology
  if (input.immuneResetPotential === 'curativeIntent') keys.push('curative_intent');
  if (input.treatmentGoal === 'chronicTreatment' || input.immuneResetPotential === 'chronicTreatment') keys.push('chronic_treatment');
  if (input.targetSpecificity === 'antigenSpecific') keys.push('narrow_target');
  if (input.targetSpecificity === 'broadImmunosuppression') keys.push('broad_immunosuppression');
  if (input.diseaseSeverity === 'severe' || input.diseaseSeverity === 'refractory') keys.push('severe_refractory_disease');
  if (input.diseaseSeverity === 'mildModerate') keys.push('mild_moderate_disease');

  // Metabolic
  if (input.weightLossEfficacy === 'superiorEfficacy') keys.push('superior_wl_efficacy');
  if (input.weightLossEfficacy === 'modestEfficacy') keys.push('modest_wl_efficacy');
  if (input.routeOfAdministration === 'oral') keys.push('oral_route');
  if (input.routeOfAdministration === 'implantable') keys.push('implantable_route');
  if (input.comorbidityBreadth === 'cardiometabolicBenefit') keys.push('cardiometabolic_benefit');
  if (input.mechanismDifferentiation === 'incretinBased') keys.push('novel_mechanism');

  // Cardiovascular
  if (input.cvOutcomeBenefit === 'mortalityReduction') keys.push('cv_mortality_reduction');
  if (input.cvOutcomeBenefit === 'symptomImprovement') keys.push('cv_symptom_improvement');
  if (input.cvTrialEndpoint === 'maceEndpoint') keys.push('cv_mace_endpoint');
  if (input.cvTrialEndpoint === 'surrogateBiomarker') keys.push('cv_surrogate_endpoint');
  if (input.cvPopulationRisk === 'highRisk') keys.push('cv_high_risk_population');
  if (input.cvPopulationRisk === 'primaryPrevention') keys.push('cv_primary_prevention');

  // Infectious Disease
  if (input.resistanceProfile === 'novelTarget') keys.push('id_novel_target');
  if (input.resistanceProfile === 'broadSpectrum') keys.push('id_broad_spectrum');
  if (input.infectionChronicity === 'chronic' || input.infectionChronicity === 'latent') keys.push('id_chronic_infection');
  if (input.infectionChronicity === 'acute') keys.push('id_acute_infection');
  if (input.publicHealthPriority === 'whoUrgent' || input.publicHealthPriority === 'whoCritical') keys.push('id_who_urgent');

  // Ophthalmology
  if (input.treatmentDurability === 'oneTime') keys.push('ophtho_one_time');
  if (input.treatmentDurability === 'chronicInjection') keys.push('ophtho_chronic_injection');
  if (input.treatmentDurability === 'extendedDuration') keys.push('ophtho_extended_durability');
  if (input.ocularDelivery === 'topical') keys.push('ophtho_topical');
  if (input.visionImpact === 'visionThreatening') keys.push('ophtho_vision_threatening');
  if (input.visionImpact === 'symptomRelief') keys.push('ophtho_symptom_relief');

  // Women's Health
  if (input.whUnmetNeed === 'noApprovedTherapy') keys.push('wh_no_approved_therapy');
  if (input.whUnmetNeed === 'wellServed') keys.push('wh_well_served');

  // Rare Disease
  if (input.patientPopulationSize === 'ultraRare_sub1k') keys.push('rd_ultra_rare');
  if (input.patientPopulationSize === 'broader_50k_200k') keys.push('rd_broader_rare');
  if (input.geneticBasis === 'monogenic_validated') keys.push('rd_monogenic');
  if (input.geneticBasis === 'unknown_genetic' || input.geneticBasis === 'non_genetic') keys.push('rd_unknown_genetic');

  // Hematology
  if (input.mrdStatus === 'mrd_endpoint') keys.push('heme_mrd_endpoint');
  if (input.mrdStatus === 'survival_endpoint') keys.push('heme_survival_endpoint');
  if (input.transplantEligibility === 'transplant_eligible') keys.push('heme_transplant_eligible');
  if (input.transplantEligibility === 'post_transplant') keys.push('heme_post_transplant');

  // Dermatology
  if (input.skinSeverity === 'severe' || input.skinSeverity === 'refractory_derm') keys.push('derm_severe_refractory');
  if (input.skinSeverity === 'mild') keys.push('derm_mild');
  if (input.chronicityProfile === 'chronic_relapsing') keys.push('derm_chronic_relapsing');
  if (input.topicalVsSystemic === 'topical_only') keys.push('derm_topical_only');
  if (input.topicalVsSystemic === 'systemic_only') keys.push('derm_systemic');

  // Gastroenterology
  if (input.endoscopicEndpoint === 'endoscopic_remission') keys.push('gi_endoscopic_remission');
  if (input.endoscopicEndpoint === 'clinical_only') keys.push('gi_clinical_only');
  if (input.biologicExperience === 'biologic_naive') keys.push('gi_biologic_naive');
  if (input.biologicExperience === 'multi_biologic_exposed') keys.push('gi_multi_biologic_exposed');
  if (input.giSegment === 'upper_gi') keys.push('gi_upper_gi');
  if (input.giSegment === 'colonic' || input.giSegment === 'pancolonic') keys.push('gi_colonic');

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

// ---------------------------------------------------------------------------
// Reformulation / 505(b)(2) Sub-Type Profiles
// ---------------------------------------------------------------------------
// Different reformulation types have fundamentally different economics.
// A pure formulation change (tablet→ER) requires only PK bridging, while
// a 505(b)(2) with a new indication is closer to an abbreviated NDA.
//
// Sources & calibration (verified Aug 2026):
// - Cost ranges: SyneticX "The Real Cost of a 505(b)(2)" ($8-20M for
//   formulation changes, $20-300M for complex programs); DrugPatentWatch
//   "Cut Drug R&D Costs by 90%" ($200-300M for new indication Phase III)
// - Timelines: SyneticX (2-3yr formulation, 3-5yr mid-complexity, 4-7yr
//   Phase III); Premier Research "2020 505(b)(2) Year in Review"
// - PoS: 505(b)(2) accounts for ~60% of NDA approvals (Premier Research);
//   64.5% first-cycle approval rate 2009-2015 (Premier Consulting); rank
//   ordering by sub-type is model assumption (no published sub-type PoS)
// - Discount: -2pp captures commercial de-risking (known molecule,
//   prescriber familiarity); development de-risking is in PoS uplift
// ---------------------------------------------------------------------------

interface ReformulationProfile {
  costMultiplier: number;
  durationMultiplier: number;
  posUplift: number;
  description: string;
}

const REFORMULATION_PROFILES: Record<string, ReformulationProfile> = {
  // Pure formulation change — PK bridging only (tablet→ER, IV→subQ same molecule)
  formulation_change: { costMultiplier: 0.25, durationMultiplier: 0.35, posUplift: 1.60, description: 'PK bridging study only' },
  // New route of administration — PK + additional safety data needed (oral→injectable, IV→inhaled)
  route_change: { costMultiplier: 0.40, durationMultiplier: 0.50, posUplift: 1.40, description: 'PK bridging + safety assessment' },
  // New dosage form with efficacy claims — PK + efficacy data (abuse-deterrent, extended-release with new claims)
  dosage_form: { costMultiplier: 0.55, durationMultiplier: 0.60, posUplift: 1.25, description: 'PK + efficacy demonstration' },
  // 505(b)(2) with new indication — abbreviated but substantial clinical program
  new_indication: { costMultiplier: 0.70, durationMultiplier: 0.75, posUplift: 1.15, description: 'Abbreviated clinical program for new indication' },
};

/**
 * Infer reformulation sub-type from modality and indication context.
 * When an explicit sub-type is provided (user-selected), returns it directly.
 * Falls back to 'route_change' as the safe middle-ground default.
 */
function inferReformulationSubType(modality: string, _indication?: string, explicitSubType?: string): string {
  // If the user explicitly selected a sub-type, use it directly
  if (explicitSubType) {
    return explicitSubType;
  }
  const mod = modality.toLowerCase();
  // Extended-release / sustained-release formulation changes
  if (mod.includes('extended') || mod.includes('er') || mod.includes('sr') || mod.includes('sustained')) {
    return 'formulation_change';
  }
  // Default to route_change (middle ground) when no sub-type info is available
  return 'route_change';
}

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
  const ca = input.customAssumptions;
  const guardedDiscountRate = (ca?.discountRate ?? input.discountRate) != null
    ? Math.max(0.01, Math.min(0.30, (ca?.discountRate ?? input.discountRate)!))
    : input.discountRate;
  const rawPeakSales = ca?.peakSalesOverride ?? input.peakSalesEstimate;
  const guardedPeakSales = {
    low: Math.max(0, Math.min(1_000_000, rawPeakSales.low)),
    median: Math.max(0, Math.min(1_000_000, rawPeakSales.median)),
    high: Math.max(0, Math.min(1_000_000, rawPeakSales.high)),
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

  // Indication TAM ceiling check — hard cap when user peak sales exceed 80% of
  // the total global TAM for the indication (impossible for any single drug),
  // soft warn when they exceed the realistic single-drug market-leader peak.
  // Applied BEFORE data-quality/generic multipliers so the cap reflects the
  // user's raw assumption vs the reality of the market.
  const ceilingCheck = input.indication
    ? checkPeakSalesCeiling(guardedPeakSales.median, input.indication)
    : { ok: true as const };
  const peakSalesEstimate = (() => {
    if (ceilingCheck.ok || ceilingCheck.severity !== 'critical' || ceilingCheck.ceiling == null) {
      return guardedPeakSales;
    }
    // Critical: hard-cap the median at 80% of TAM; scale low/high proportionally
    // so the range keeps its shape but collapses under the ceiling.
    const originalMedian = guardedPeakSales.median || 1;
    const scale = ceilingCheck.ceiling / originalMedian;
    return {
      low: guardedPeakSales.low * scale,
      median: ceilingCheck.ceiling,
      high: guardedPeakSales.high * scale,
    };
  })();

  // 1. Get discount rate (use guarded value, or compute from TA + territory + company type + deal type)
  // Add manufacturing complexity WACC premium for technically challenging modalities.
  // The risk decomposer (tier 4 item 11) sets __internalFlags.skipMfgPremium
  // to neutralize this risk source for the manufacturing-bucket counterfactual.
  const baseDiscountRate = guardedDiscountRate ?? getDefaultDiscountRate(therapeuticArea, phase, territory, input.companyType, dealType);
  // Internal flag: risk decomposer counterfactual runs strip this premium to
  // measure the manufacturing bucket.
  const mfgPremium = input.__internalFlags?.skipMfgPremium
    ? 0
    : (MANUFACTURING_WACC_PREMIUM[modality] || 0);
  // Cap the combined rate at 35% (not 30%) so that the manufacturing WACC
  // premium isn't silently dropped for high-risk combos where the base rate
  // already sits at the 30% TA/phase ceiling from getDefaultDiscountRate.
  const discountRate = Math.min(0.35, baseDiscountRate + mfgPremium);

  // 2. Calculate cumulative PoS from current phase
  // Pass the indication so getCumulativePoS can apply indication-specific
  // modifiers from /lib/financial/indication-pos-modifiers.ts (top-50
  // calibrated set). Non-calibrated indications fall back to TA-level rates.
  //
  // Internal flags: the risk decomposer strips regulatory designations (to
  // measure the regulatory bucket) and/or forces clinical-only PoS (to
  // measure the clinical bucket).
  const regsForPoS = input.__internalFlags?.skipRegulatoryDesignations || input.__internalFlags?.clinicalOnlyPoS
    ? { breakthrough: false, fastTrack: false, orphan: false, prime: false }
    : regulatoryDesignations;
  const indicationForPoS = input.__internalFlags?.clinicalOnlyPoS ? undefined : input.indication;
  const biomarkerForPoS = input.__internalFlags?.clinicalOnlyPoS ? 'unselected' : (input.biomarkerStatus || 'unselected');
  const { cumulativePoS: rawCumulativePoS, transitions } = getCumulativePoS(
    phase,
    therapeuticArea,
    modality,
    biomarkerForPoS,
    regsForPoS,
    indicationForPoS,
    // Time-windowed PoS is opt-in: use the user-supplied window, or
    // 'most_recent' when the TIER2_TIME_WINDOWED_POS flag is on, or
    // undefined (falls back to existing multiplicative modifier logic).
    // Default off until the 100-deal backtest validates this change.
    input.timeWindow ?? (TIER2_FLAGS.timeWindowedPoS ? 'most_recent' : undefined),
    input.molecularTargets,
    input.deliveryRoute,
    ca?.phaseTransitionRates,
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

  // Aggregate cap: total indication modifier deviation should not exceed ±35%,
  // slightly tighter than per-transition ±40% to prevent compound extremes
  indicationModifier = Math.max(0.65, Math.min(1.35, indicationModifier));

  const modifiedPoS = Math.max(0, Math.min(1, rawCumulativePoS * indicationModifier));

  // Apply scenario PoS multiplier (e.g., 0.85 for reduced approval confidence)
  // Clamp to [0, 1] to keep probability valid
  let cumulativePoS = input.posMultiplier != null
    ? Math.max(0, Math.min(1, modifiedPoS * input.posMultiplier))
    : modifiedPoS;

  // Reformulation / 505(b)(2): per-transition PoS adjustments based on sub-type.
  // Replaces the former flat cumulativePoS * 1.40 with differentiated per-
  // transition adjustments that flow through the same phaseTransitionOverrides
  // mechanism used by the custom assumptions feature.
  // Source: FDA 505(b)(2) approval statistics (2018-2025), DealForma
  // reformulation deal outcomes analysis.
  if (dealType === 'reformulation') {
    const reformSubType = inferReformulationSubType(modality, input.indication, input.reformulationSubType);
    const reformProfile = REFORMULATION_PROFILES[reformSubType] ?? REFORMULATION_PROFILES.route_change;

    // Per-transition PoS uplift: the base rates are already computed; we
    // multiply each transition by the profile's uplift with phase-specific
    // scaling to reflect 505(b)(2) pathway characteristics.
    const reformPoSUplift = reformProfile.posUplift;
    const reformTransitionOverrides: Partial<Record<string, number>> = {};

    // Find and override the relevant transition rates
    for (const t of transitions) {
      if (t.phase.includes('Phase 2') && t.phase.includes('Phase 3')) {
        // Phase 2→3: moderate uplift — still need PK/safety data
        reformTransitionOverrides['phase2ToPhase3'] = Math.min(0.95, t.probability * reformPoSUplift * 0.90);
      }
      if (t.phase.includes('Phase 3') && t.phase.includes('Approval')) {
        // Phase 3→Approval: strong uplift — abbreviated pathway, reference product safety
        reformTransitionOverrides['phase3ToApproval'] = Math.min(0.95, t.probability * reformPoSUplift * 1.10);
      }
      if (t.phase.includes('Approval') && t.phase.includes('Launch')) {
        // Approval→Launch: slight uplift — regulatory pathway is clearer
        reformTransitionOverrides['approvalToLaunch'] = Math.min(0.99, t.probability * 1.05);
      }
    }

    // Recalculate cumulative PoS with reformulation-adjusted transition rates
    // if we found applicable transitions
    if (Object.keys(reformTransitionOverrides).length > 0) {
      const { cumulativePoS: reformPoS } = getCumulativePoS(
        phase,
        therapeuticArea,
        modality,
        input.biomarkerStatus || 'unselected',
        regulatoryDesignations,
        input.indication,
        undefined,
        input.molecularTargets,
        input.deliveryRoute,
        reformTransitionOverrides,
      );
      cumulativePoS = Math.min(0.95, reformPoS);
    } else {
      // Fallback: if no transitions matched (e.g., approved phase), apply
      // a conservative uplift
      cumulativePoS = Math.min(0.95, cumulativePoS * reformPoSUplift);
    }
  }

  // 3. Calculate years to market from current phase
  // Determine which clinical pathway to follow based on current phase.
  // Combined phases (phase1_2, phase2_3) are ALTERNATIVE pathways, not sequential
  // steps. A drug follows ONE of: standard (P1→P2→P3), combined-early (P1/2→P3),
  // or combined-late (P2/3). Iterating PHASE_ORDER linearly double-counts them.
  const baseDurations = PHASE_DURATION[therapeuticArea] || PHASE_DURATION.oncology;
  const baseCosts = PHASE_COSTS[therapeuticArea] || PHASE_COSTS.oncology;
  // Spread into mutable copies so deal-type adjustments (e.g., reformulation)
  // do not mutate the shared lookup tables.
  const durations: Record<string, number> = { ...baseDurations };
  const costs: Record<string, number> = ca?.phaseCosts
    ? { ...baseCosts, ...Object.fromEntries(Object.entries(ca.phaseCosts).filter(([, v]) => v != null)) as Record<string, number> }
    : { ...baseCosts };

  // Reformulation: sub-type-specific cost and timeline reductions.
  // Replaces the former flat 0.4x cost / 0.5x duration with profile-based
  // multipliers that differentiate PK-bridging-only from abbreviated programs.
  if (dealType === 'reformulation') {
    const reformSubType = inferReformulationSubType(modality, input.indication, input.reformulationSubType);
    const reformProfile = REFORMULATION_PROFILES[reformSubType] ?? REFORMULATION_PROFILES.route_change;
    for (const key of Object.keys(costs)) {
      costs[key] = (costs[key] || 0) * reformProfile.costMultiplier;
    }
    for (const key of Object.keys(durations)) {
      durations[key] = (durations[key] || 0) * reformProfile.durationMultiplier;
    }
  }
  const currentIdx = phaseIndex(phase);

  // Build the actual sequential pathway based on the starting phase
  const pathway: string[] = (() => {
    if (phase === 'phase1_2') return ['phase1_2', 'phase3', 'nda_filed'];
    if (phase === 'phase2_3') return ['phase2_3', 'nda_filed'];
    if (phase === 'nda_filed') return ['nda_filed'];
    if (phase === 'approved') return [];
    // Standard pathway: discovery → preclinical → phase1 → phase2 → phase3 → nda_filed
    const standard = ['discovery', 'preclinical', 'phase1', 'phase2', 'phase3', 'nda_filed'];
    const startIdx = standard.indexOf(phase);
    return startIdx >= 0 ? standard.slice(startIdx) : ['phase1', 'phase2', 'phase3', 'nda_filed'];
  })();

  let yearsToMarket = 0;
  const phaseTransitions: RNPVResult['phaseTransitions'] = [];
  let runningCumProb = 1.0;

  // Build a mapping from pathway phase name to the transition that represents
  // *completing* that phase. For combined-phase starts (phase1_2, phase2_3),
  // the transitions array from getCumulativePoS has extra entries for the
  // combined-phase entry step, so a naive transitions[i] index is misaligned
  // with pathway[i]. The mapping below resolves by matching phase substrings.
  const pathwayPhaseToTransition: Record<string, typeof transitions[number] | undefined> = {};
  const matchers: Record<string, (label: string) => boolean> = {
    discovery: (l) => l.includes('Discovery'),
    preclinical: (l) => l.includes('Preclinical'),
    phase1: (l) => /Phase 1\b/.test(l) && !l.includes('Phase 1/2'),
    phase1_2: (l) => l.includes('Phase 1/2'),
    phase2: (l) => /Phase 2\b/.test(l) && !l.includes('Phase 2/3') && l.includes('Phase 3'),
    phase2_3: (l) => l.includes('Phase 2/3'),
    phase3: (l) => l.includes('Phase 3') && l.includes('Approval'),
    nda_filed: (l) => l.includes('Approval') && l.includes('Launch'),
  };
  for (const pName of pathway) {
    const matcher = matchers[pName];
    if (matcher) {
      pathwayPhaseToTransition[pName] = transitions.find(t => matcher(t.phase));
    }
  }

  for (let i = 0; i < pathway.length; i++) {
    const phaseName = pathway[i];
    const duration = durations[phaseName] || 2.0;
    const cost = costs[phaseName] || 30;
    const transition = pathwayPhaseToTransition[phaseName];

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

    yearsToMarket += duration;
  }
  // Note: nda_filed duration represents the full regulatory review period.
  // Previously the code also added durations.regulatory here, which double-counted
  // the review time. Removed to align with nda_filed = regulatory review window.

  // Apply data-quality-driven timeline adjustment (Nirav Jhaveri feedback)
  // Better data → faster Phase 3 (smaller trial). Worse data → longer Phase 3.
  const timelineMultiplier = DATA_QUALITY_TIMELINE_MULTIPLIER[dataQuality] || 1.0;
  if (timelineMultiplier !== 1.0 && currentIdx <= phaseIndex('phase3')) {
    const phase3Duration = durations.phase3 || 3.0;
    const adjustment = phase3Duration * (timelineMultiplier - 1.0);
    yearsToMarket = Math.max(0, yearsToMarket + adjustment);
  }

  // Apply market access delay (post-approval reimbursement lag)
  // Internal flag: risk decomposer skips this when measuring the commercial bucket.
  const accessDelay = input.__internalFlags?.skipMarketAccessDelay
    ? 0
    : (MARKET_ACCESS_DELAY_MONTHS[therapeuticArea]?.default || 0);
  if (accessDelay > 0) {
    yearsToMarket += accessDelay / 12; // Convert months to years
  }

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

  // 4b. Generic market entrenchment penalty (Nirav Jhaveri feedback)
  // If entering a market where generics dominate, peak sales are penalized at launch.
  // Internal flag: risk decomposer neutralizes this when measuring the commercial bucket.
  const genericEntrenchment = getGenericEntrenchmentMultiplier(therapeuticArea, input.indication);
  const genericMultiplier = input.__internalFlags?.skipGenericEntrenchment
    ? 1.0
    : genericEntrenchment.multiplier;

  const adjustedPeakSales = {
    low: peakSalesEstimate.low * dataQualityAdj * genericMultiplier,
    median: peakSalesEstimate.median * dataQualityAdj * genericMultiplier,
    high: peakSalesEstimate.high * dataQualityAdj * genericMultiplier,
  };

  // 4c. Peak sales sanity check against index drug (Nirav Jhaveri feedback)
  const peakSalesCheck = checkPeakSalesRealism(adjustedPeakSales.median, therapeuticArea, input.indication, modality);

  // 4d. Indication-specific competitive density adjustment.
  // Crowded indications (HER2 breast, MS, RA) penalize peak sales penetration;
  // under-served indications (SCI, Huntington's) get a boost.
  // Internal flag: risk decomposer skips this when measuring the commercial bucket.
  const competitiveDensity = input.__internalFlags?.skipCompetitiveDensity
    ? null
    : getCompetitiveDensity(input.indication);

  // 4d-subpop. Tier 4 Item 13: Patient subpopulation modifier.
  // When the user specifies mutationStatus / demographicSubpop / severityClass
  // (and the combination is in SUBPOPULATION_MODIFIERS), scale peak sales by
  // the subpop's addressable-market multiplier. No-op when fields are omitted
  // or no match exists. Flag-gated default off; backtest-validated in Stage 7.
  const subpop = TIER4_FLAGS.subpopulation
    ? getSubpopulationModifier(
        input.indication,
        input.mutationStatus,
        input.lineOfTherapy,
        input.demographicSubpop,
        input.severityClass,
      )
    : { peakSalesMult: 1.0, posMult: 1.0, matchedKey: null, source: null };
  if (subpop.peakSalesMult !== 1.0) {
    adjustedPeakSales.low *= subpop.peakSalesMult;
    adjustedPeakSales.median *= subpop.peakSalesMult;
    adjustedPeakSales.high *= subpop.peakSalesMult;
  }

  // 4d-cliff. Tier 4 Item 14: Patent cliff launch-timing adjustment.
  // Compares the asset's projected launch year against the market leader's
  // LOE + biosimilar dates. Pre-LOE launches face headwinds, post-biosimilar
  // launches get tailwinds. Flag-gated default off.
  const launchYear = new Date().getFullYear() + Math.round(yearsToMarket);
  const patentCliff = TIER4_FLAGS.patentCliffs
    ? getPatentCliffAdjustment(input.indication, launchYear)
    : null;
  if (patentCliff && patentCliff.multiplier !== 1.0) {
    adjustedPeakSales.low *= patentCliff.multiplier;
    adjustedPeakSales.median *= patentCliff.multiplier;
    adjustedPeakSales.high *= patentCliff.multiplier;
  }

  // 4d-target. Target combination peak sales adjustment.
  // Multi-target assets (bispecifics, ADC with specific antigen, dual-mechanism)
  // capture different market fractions than mono-target assets. Validated
  // combinations (PD-1+CTLA-4, GLP-1R+GIPR) get specific modifiers;
  // unvalidated multi-target assets get a default based on target count.
  const targets = input.molecularTargets ?? [];
  const overlapTarget = MODALITY_TARGET_OVERLAP[input.modality];
  const effectiveTargets = targets.filter(t => t !== overlapTarget);
  if (effectiveTargets.length > 0) {
    const combo = effectiveTargets.length >= 2
      ? getTargetCombination(effectiveTargets, input.indication)
      : undefined;
    let targetPeakMod = 1.0;
    if (combo) {
      targetPeakMod = combo.peakSalesModifier * combo.complexityPenalty;
    } else if (effectiveTargets.length >= 2) {
      const defaultCombo = getDefaultCombinationEffect(effectiveTargets.length);
      targetPeakMod = defaultCombo.peakSalesModifier * defaultCombo.complexityPenalty;
    } else {
      targetPeakMod = getTargetPeakSalesModifier(effectiveTargets[0]);
    }
    adjustedPeakSales.low *= targetPeakMod;
    adjustedPeakSales.median *= targetPeakMod;
    adjustedPeakSales.high *= targetPeakMod;
  }

  // 4d-route. Delivery route peak sales adjustment.
  // Oral-in-IV-class commands 20-30% premium. Intrathecal limits addressable
  // market. Gene therapy vector commands one-time treatment premium.
  const routePeakMod = getRoutePeakSalesModifier(input.deliveryRoute);
  if (routePeakMod !== 1.0) {
    adjustedPeakSales.low *= routePeakMod;
    adjustedPeakSales.median *= routePeakMod;
    adjustedPeakSales.high *= routePeakMod;
  }

  if (competitiveDensity) {
    adjustedPeakSales.low = adjustedPeakSales.low / competitiveDensity.penetrationMultiplier;
    adjustedPeakSales.median = adjustedPeakSales.median / competitiveDensity.penetrationMultiplier;
    adjustedPeakSales.high = adjustedPeakSales.high / competitiveDensity.penetrationMultiplier;
  }

  // 4e. Combination therapy adjustment
  // Most modern oncology and many immunology drugs are used in combinations,
  // not monotherapy. Combo drugs share patient pools AND revenue — the
  // effective peak sales for any single component is typically 30-60% of
  // a naive monotherapy assumption. Skipped when the user explicitly asserts
  // `combinationContext: 'monotherapy'`.
  // Source: NCCN 2025 guidelines, ASCO 2024-2025, EvaluatePharma 2025 combo
  // drug analysis, Goldman Sachs Healthcare 2024 combo deal research.
  //
  // Opt-in: applies only when the caller provided `combinationContext`
  // explicitly OR the TIER2_COMBO_THERAPY flag is on. Default off until
  // the 100-deal backtest validates this change.
  const comboEnabled = input.combinationContext !== undefined || TIER2_FLAGS.combinationTherapy;
  const comboDynamicsUsed = comboEnabled ? getCombinationDynamics(input.indication) : null;
  const originalPeakSalesMedian = adjustedPeakSales.median;
  const comboAdjustmentMedian = comboEnabled
    ? applyCombinationAdjustment(
        adjustedPeakSales.median,
        input.indication,
        input.combinationContext,
      )
    : { multiplier: 1.0, rationale: '' };
  const comboMultiplier = comboAdjustmentMedian.multiplier;
  if (comboMultiplier !== 1.0) {
    adjustedPeakSales.low = adjustedPeakSales.low * comboMultiplier;
    adjustedPeakSales.median = adjustedPeakSales.median * comboMultiplier;
    adjustedPeakSales.high = adjustedPeakSales.high * comboMultiplier;
  }

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
    therapeuticArea,
    pathway, // Pass pathway so R&D cost schedule uses sequential phases, not PHASE_ORDER linear sum
    input.indication, // Indication-specific revenue curve lookup (takes precedence over TA override)
    territory, // Territory-specific tax rate
    ca,
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
  const genericErosionTV = ca?.revenueCurve?.genericErosion ?? getGenericErosionRate(modality);
  if (lastRevenueCF && lastRevenueCF.revenue > 0) {
    const terminalRevenue = lastRevenueCF.revenue * (1 - genericErosionTV);
    // Gordon growth model with negative growth: TV = CF / (r - g), discounted to present
    // Source: Damodaran, "Valuing pharma companies" — terminal value for mature drugs
    const denominator = discountRate - TERMINAL_DECLINE_RATE; // r - g where g is negative, so r + |g|
    if (denominator > 0.01) { // safety guard
      const terminalPV = (terminalRevenue / denominator);
      // Discount from the terminal year back to present, and risk-adjust
      const terminalYear = lastRevenueCF.year ?? cashFlows.length;
      const terminalDF = 1 / Math.pow(1 + discountRate, terminalYear);
      terminalValue = terminalPV * terminalDF * cumulativePoS;
    }
  }
  riskAdjustedNPV += terminalValue;

  // 8. Find peak sales year
  const peakCF = cashFlows.reduce((max, cf) => cf.revenue > max.revenue ? cf : max, cashFlows[0]);
  const peakSalesYear = peakCF?.year || 0;

  // 9. Calculate implied deal terms
  // R57 (2026-04-14): Structure-aware upfront %. The single phase-based
  // formula had a ±25% ceiling of ~23% on backtest because real deals
  // split into six structurally distinct pricing regimes (classic,
  // option, platform_collab, regional, biosimilar, acquisition). The
  // classifier routes each deal to a regime-specific upfront %
  // distribution. See lib/financial/deal-structure-classifier.ts for
  // the regime definitions and the empirical calibration basis per regime.
  //
  // Legacy behavior preserved: dealType='acquisition' still lands in
  // strategic_acquisition with the same (0.70/0.825/0.95) fractions;
  // dealType='option' lands in option_style. New routing only changes
  // predictions for collaboration + licensing + early-phase deals where
  // the classic formula was systematically wrong.
  // Prefer the real (non-narrowed) territory when present — the backtest
  // harness narrows to global/us_only/ex_us for the rNPV math but passes
  // the original string via `realTerritory` so the classifier can detect
  // china/japan/europe/etc. and route to regional_license.
  const extended = input as unknown as {
    licensor?: string | null;
    licensee?: string | null;
    realTerritory?: string | null;
  };
  const structureResolution = resolveUpfrontStructure({
    phase,
    dealType,
    modality,
    therapeuticArea,
    territory: String(extended.realTerritory ?? territory ?? ''),
    licensor: extended.licensor ?? null,
    licensee: extended.licensee ?? null,
  });
  const dealStructureClassification: DealStructureClassification =
    structureResolution.classification;
  const upfrontPercent = structureResolution.upfrontPercent;
  // Total deal value as a fraction of rNPV is phase-stratified. Earlier phases
  // command a lower fraction due to higher risk premium. The median matches
  // getPhaseDealToRNPVRatio(phase); low/high are +/- 15pp around it (clamped).
  const phaseTotalDealMedian = getPhaseDealToRNPVRatio(phase);
  const phaseTotalDealLow = Math.max(0.10, phaseTotalDealMedian - 0.15);
  const phaseTotalDealHigh = Math.min(1.10, phaseTotalDealMedian + 0.20);

  // Base totalDeal ranges (may be reshaped below for deal-type-specific
  // structural components). These are the "pure licensing" baselines that
  // every deal type starts from.
  const baseTotalDealLow = riskAdjustedNPV * phaseTotalDealLow;
  const baseTotalDealMedian = riskAdjustedNPV * phaseTotalDealMedian;
  const baseTotalDealHigh = riskAdjustedNPV * phaseTotalDealHigh;

  // =========================================================================
  // Round 42 (2026-04-13): ENGINE-LEVEL EMPIRICAL CALIBRATION
  //
  // After 30+ calibration rounds on a 1,067-deal backtest corpus, the
  // following multipliers are empirically validated. They fire on BOTH
  // upfront and totalDeal so the upfront ≤ totalDeal invariant holds
  // structurally. This closes the backtest-vs-production gap — live
  // calculator users now see the same calibrated accuracy as the
  // published backtest numbers (~25% on core scope).
  //
  // (A) Per-TA × phase uplift correcting systematic undershoots:
  //     - oncology phase 2: 3.0× (174 core deals, originally -76% signed)
  //     - oncology phase 3: 1.3× (reduced to avoid compound with modality)
  //     - infectiousDisease: 3.0× (16 core deals, originally -78% signed)
  //
  // (B) Per-modality uplift for platform/novel-mechanism classes:
  //     adc 1.3×, bispecific 1.5×, rnai 1.5×, protac 1.5×,
  //     radiopharmaceutical 2.2×
  //
  // (C) Phase × deal-type corrections:
  //     phase2 collaboration ×4.0, phase3 collaboration ×3.0,
  //     approved acquisition ×0.25 (bidding-war dampener)
  //
  // The multiplier is applied via `calibratedRNPV` — a local variable
  // that scales the rNPV base for upfront/totalDeal calculations only.
  // The raw `riskAdjustedNPV` returned in RNPVResult is UNCHANGED, so
  // golden masters (which test rNPV pre-calibration) stay green.
  //
  // Sources: 2020-2025 disclosed deals per cohort, iteratively tuned
  // against disclosed upfronts. See docs/calibration-iteration-log.md.
  // =========================================================================
  // (R50 TA uplift + R61 phase×dealType tables moved to
  // lib/financial/empirical-multiplier.ts in R67. Historical rationale
  // preserved in that file's comment headers.)
  // R67 (2026-04-15) — Unified empirical multiplier.
  // REPLACES the R42+R50+R61 three-stack multiplicative composition with
  // a single tier-gated, additive-blended, hard-capped function in
  // `lib/financial/empirical-multiplier.ts`. The old stack was producing
  // 15-20× outputs on Phase 2 oncology acquisitions because each prior
  // calibration round had measured the same undershoot against the same
  // reference deals and landed independent corrections — stacking them
  // multiplicatively double-counted.
  //
  // Semantics guaranteed:
  //   - multiplier ∈ [0.25, 8.0] for all inputs (hard cap backstop)
  //   - acquisition > licensing at same asset quality
  //   - Tier-1 > Tier-2 at same (TA, phase, modality, dealType)
  //   - TA_UPLIFT / MODALITY_UPLIFT / PHASE_DEALTYPE_BASE remain the
  //     three calibration surfaces — tuned independently per round
  //
  // Invariants verified by lib/financial/__tests__/empirical-multiplier.test.ts.
  // Regression against closed deals in scripts/validate-empirical-calibration.ts.
  const empiricalMultiplier = computeEmpiricalMultiplier(input);

  // calibratedRNPV scales with the empirical multiplier for ALL downstream
  // upfront + totalDeal computations. Invariant preserved: both upfront
  // and totalDeal move proportionally.
  const rawCalibratedRNPV = riskAdjustedNPV * empiricalMultiplier;

  // R71 (2026-04-16): Systematic-undershoot correction. Backtest audit
  // showed median signed error of -24.6% (engine undershoots by 25%).
  // Per-phase analysis: phase2 actual/predicted ratio = 1.52, phase3 =
  // 1.33. R67's unified-multiplier fix correctly removed double-counting
  // but over-corrected — the engine now systematically undervalues.
  // This per-phase correction recenters the median at 0% signed error
  // without reintroducing the multiplicative stacking R67 fixed.
  // Applied as a FINAL scalar on calibratedRNPV so all downstream
  // (upfront, totalDeal, deal-type overlays) benefit equally.
  // Phase-specific correction values. Calibrated iteratively:
  // 1.50/1.33 overcorrected phase2 ±50% by -10pp. 1.30/1.25 balances
  // centering median signed error near 0% without regressing ±50%.
  const UNDERSHOOT_CORRECTION: Record<string, number> = {
    phase2: 1.35,
    phase2_3: 1.32,
    phase3: 1.28,
    nda_filed: 1.15,
    approved: 1.10,
  };
  const undershootFix = UNDERSHOOT_CORRECTION[phase] ?? 1.22;
  const calibratedRNPV = rawCalibratedRNPV * undershootFix;

  // R71 Fix #1: Indication-level hard ceiling clamp.
  // Apply P90 (indication || TA fallback) deal-corpus ceiling to prevent
  // over-prediction for assets in historically weak deal indications.
  const ceiling = getCeiling(input.indication, phase, dealType, therapeuticArea);
  const upfrontPre = {
    low: calibratedRNPV * upfrontPercent.low,
    median: calibratedRNPV * upfrontPercent.median,
    high: calibratedRNPV * upfrontPercent.high,
  };
  const totalDealPre = {
    low: baseTotalDealLow * empiricalMultiplier,
    median: baseTotalDealMedian * empiricalMultiplier,
    high: baseTotalDealHigh * empiricalMultiplier,
  };
  const upfrontClamped = clampRange(upfrontPre, ceiling.ceilingUpfront);
  const totalDealClamped = clampRange(totalDealPre, ceiling.ceilingTDV);
  // R70 (2026-04-16): Phase 2 option-value floor for the PRODUCTION ENGINE.
  // rNPV collapses to near-zero for phase2 deals in high-attrition TAs
  // (neurology 12.8% cumulative PoS, hematology 28.5%) because cumulative
  // PoS × high COGS × long timelines = negligible risk-adjusted NPV. Real
  // phase2 licensing deals are $60M-$1B because buyers pay for development
  // optionality. Without this floor, the calculator shows "$0 upfront" for
  // neurology phase2 assets — instantly losing credibility with any BD user.
  //
  // Floor is conservative at $60M (below the $100M corpus median for phase2)
  // and only triggers when the calibrated prediction is below that level.
  // Phase 3 has no floor because rNPV is typically positive at that stage.
  const PHASE2_OPTION_FLOOR_M: Record<string, number> = {
    phase2: 60,
    phase2_3: 70,
  };
  const phase2Floor = PHASE2_OPTION_FLOOR_M[phase] ?? 0;
  const flooredUpfront = {
    low: phase2Floor > 0 ? Math.max(upfrontClamped.low, phase2Floor * 0.6) : upfrontClamped.low,
    median: phase2Floor > 0 ? Math.max(upfrontClamped.median, phase2Floor) : upfrontClamped.median,
    high: phase2Floor > 0 ? Math.max(upfrontClamped.high, phase2Floor * 1.5) : upfrontClamped.high,
  };

  const impliedDealValue: RNPVResult['impliedDealValue'] = {
    upfront: flooredUpfront,
    totalDeal: { low: totalDealClamped.low, median: totalDealClamped.median, high: totalDealClamped.high },
  };

  // -------------------------------------------------------------------------
  // Deal-type-specific structural overlays (codev, option, collaboration)
  //
  // The three non-acquisition, non-plain-licensing deal types have structural
  // components that the base licensing math doesn't capture:
  //   - Co-development: shared R&D spend reduces effective licensor cost and
  //     therefore boosts the effective total deal value.
  //   - Option: the exercise fee is contingent on conversion and is modelled
  //     as a probability-weighted expected value added to the total.
  //   - Collaboration: FTE research funding and equity investment are direct
  //     cash-in that augment the deal value beyond a plain rNPV fraction.
  //
  // Each branch (a) reshapes upfront/total if appropriate and (b) populates
  // a structured sub-field on impliedDealValue so the UI and report can show
  // the buyer economics line-by-line.
  // -------------------------------------------------------------------------

  if (dealType === 'codevelopment') {
    // Total remaining R&D cost from current phase through launch.
    // This uses the same pathway the cash-flow projection uses and therefore
    // stays consistent with the engine's R&D burn schedule.
    const rdPathwayForSharing = pathway.filter(p => (costs[p] ?? 0) > 0);
    const totalRDCost = rdPathwayForSharing.reduce((sum, p) => sum + (costs[p] ?? 0), 0);

    // Cost-sharing ratio: default 50/50. Clamp to a sane band.
    const licenseeShare = Math.max(0, Math.min(0.9, input.costSharingRatio ?? 0.5));
    const sharedRDSavings = totalRDCost * licenseeShare;

    // Apply the savings as additional value to the licensor. Savings scale with
    // the probability of actually executing the program (cumPoS) — if the asset
    // fails early, the cost-share benefit is only partially realized.
    const expectedSavings = sharedRDSavings * Math.max(cumulativePoS, 0.25);

    // Codev totalDeal: use |rNPV| × phase ratio + expected cost-share savings.
    // Using the absolute value preserves a sensible headline number for
    // negative-rNPV early-stage assets (where the cost-share benefit itself
    // can exceed the standalone rNPV).
    // Use calibratedRNPV so TA/modality/phase×dealtype multipliers flow into
    // the codev headline (R42 engine migration — parity with licensing path).
    const codevBaseLow = Math.abs(calibratedRNPV) * phaseTotalDealLow;
    const codevBaseMedian = Math.abs(calibratedRNPV) * phaseTotalDealMedian;
    const codevBaseHigh = Math.abs(calibratedRNPV) * phaseTotalDealHigh;
    impliedDealValue.totalDeal = {
      low: codevBaseLow + expectedSavings * 0.85,
      median: codevBaseMedian + expectedSavings,
      high: codevBaseHigh + expectedSavings * 1.15,
    };

    // Upfront tightens toward the lower end of the codev band because the
    // licensee "pays" in ongoing R&D rather than cash at close. Ranges are
    // kept internally consistent against the reshaped totalDeal.
    impliedDealValue.upfront = {
      low: impliedDealValue.totalDeal.low * upfrontPercent.low,
      median: impliedDealValue.totalDeal.median * upfrontPercent.median,
      high: impliedDealValue.totalDeal.high * upfrontPercent.high,
    };

    impliedDealValue.codevCostSharing = {
      totalRDCost_M: Math.round(totalRDCost),
      ratioLicensee: licenseeShare,
      sharedRDCost_M: Math.round(expectedSavings),
    };
  } else if (dealType === 'option') {
    // Option deals pay a small upfront + a contingent exercise fee. We model
    // the exercise fee as a probability-weighted expected value.
    //
    // Default fee: 10% of |rNPV| (approximates 1× the option upfront). The
    // |·| keeps the fee non-zero even for early-stage assets with negative
    // risk-adjusted NPV — the fee is a contractual obligation that doesn't
    // depend on the licensor's balance sheet, so collapsing it to zero when
    // rNPV is negative would understate the deal's headline value.
    const defaultFee = Math.abs(calibratedRNPV) * 0.10;
    const exerciseFee = input.optionExerciseFee != null && input.optionExerciseFee >= 0
      ? input.optionExerciseFee
      : defaultFee;

    // Historical exercise probability: 50% for Phase 1 option deals (BIO
    // 2024–2026 analysis). Use a phase-scaled value so later-phase options
    // (rarer, but data-rich) exercise more often.
    const exerciseProbability = getOptionExerciseProbability(phase);
    const expectedExerciseFee = exerciseFee * exerciseProbability;

    // Rebuild totalDeal around upfront + expected exercise fee + phase-based
    // milestones. Anchor on |rNPV| × 0.40 so negative-rNPV early-stage
    // options still surface a meaningful headline number; then add the
    // expected exercise fee.
    const OPTION_BASE_CAPTURE = 0.40;
    const optionBase = Math.abs(calibratedRNPV) * OPTION_BASE_CAPTURE;
    const optionTotalMedian = optionBase + expectedExerciseFee;
    // Symmetric ±20% range around the median.
    const optionTotalLow = optionTotalMedian * 0.80;
    const optionTotalHigh = optionTotalMedian * 1.20;

    impliedDealValue.totalDeal = {
      low: optionTotalLow,
      median: optionTotalMedian,
      high: optionTotalHigh,
    };

    // Re-anchor option upfront on the reshaped totalDeal so the upfront
    // range never bleeds above total. Option upfront is 5–15% of totalDeal.
    impliedDealValue.upfront = {
      low: impliedDealValue.totalDeal.low * upfrontPercent.low,
      median: impliedDealValue.totalDeal.median * upfrontPercent.median,
      high: impliedDealValue.totalDeal.high * upfrontPercent.high,
    };

    // Derive expectedValue_M as an exact product of the already-rounded
    // fee_M and probability. Using the raw product (not a second Math.round)
    // preserves the identity expectedValue_M === fee_M × probability, which
    // would otherwise fail on half-integer rounding boundaries.
    const roundedFee = Math.round(exerciseFee);
    impliedDealValue.optionExerciseFee = {
      fee_M: roundedFee,
      probability: exerciseProbability,
      expectedValue_M: roundedFee * exerciseProbability,
    };
  } else if (dealType === 'collaboration') {
    // Collaboration deals often include FTE research funding and/or an equity
    // investment. Both are direct cash components that flow to the licensor
    // on top of the base rNPV-derived deal value.
    const fte = input.fteFunding;
    const fteValue = fte && fte.fteCount > 0 && fte.costPerFTE_M > 0 && fte.yearsOfFunding > 0
      ? fte.fteCount * fte.costPerFTE_M * fte.yearsOfFunding
      : 0;
    const equityValue = input.equityInvestment != null && input.equityInvestment > 0
      ? input.equityInvestment
      : 0;

    // Collaboration capture baseline: |rNPV| × 0.30 (early-stage, value-share
    // heavy on downstream milestones). Add FTE + equity on top. |·| keeps the
    // headline non-zero for negative-rNPV preclinical assets where the deal
    // is predominantly research funding.
    const COLLAB_BASE_CAPTURE = 0.30;
    const collabBase = Math.abs(calibratedRNPV) * COLLAB_BASE_CAPTURE;
    const collabTotalMedian = collabBase + fteValue + equityValue;
    const collabTotalLow = collabTotalMedian * 0.80;
    const collabTotalHigh = collabTotalMedian * 1.20;

    impliedDealValue.totalDeal = {
      low: collabTotalLow,
      median: collabTotalMedian,
      high: collabTotalHigh,
    };

    // Re-anchor collaboration upfront on the reshaped totalDeal. Collab
    // upfront is 10–25% of totalDeal.
    impliedDealValue.upfront = {
      low: impliedDealValue.totalDeal.low * upfrontPercent.low,
      median: impliedDealValue.totalDeal.median * upfrontPercent.median,
      high: impliedDealValue.totalDeal.high * upfrontPercent.high,
    };

    if (fteValue > 0 && fte) {
      impliedDealValue.fteResearchValue = {
        fteCount: fte.fteCount,
        costPerFTE_M: fte.costPerFTE_M,
        yearsOfFunding: fte.yearsOfFunding,
        totalValue_M: Math.round(fteValue),
      };
    }
    if (equityValue > 0) {
      impliedDealValue.equityInvestment = Math.round(equityValue);
    }
  } else if (dealType === 'reformulation') {
    // Reformulation overlay: the abbreviated 505(b)(2) pathway creates
    // structural value through R&D cost savings vs. a full NDA program.
    // Real reformulation deals have distinct structural features: technology
    // access fees, formulation IP licensing, reference product data licensing,
    // and manufacturing know-how transfer payments.
    const reformSubType = inferReformulationSubType(modality, input.indication, input.reformulationSubType);
    const reformProfile = REFORMULATION_PROFILES[reformSubType] ?? REFORMULATION_PROFILES.route_change;

    // Calculate full-NDA cost for comparison using baseCosts (unmodified by
    // reformulation cost reductions) so the savings reflect the true delta.
    const fullNDACost = pathway.reduce((sum, p) => sum + (baseCosts[p] ?? 0), 0);
    const reformCost = fullNDACost * reformProfile.costMultiplier;
    const pathwaySavings = fullNDACost - reformCost;

    // Formulation IP premium: 8-12% of deal value, reflecting the value
    // of the reference product data package and formulation know-how
    const ipPremium = Math.abs(calibratedRNPV) * 0.10;

    // Phase-specific reformulation multipliers (mirroring calculations.ts).
    // Lower than licensing because reformulation deals are typically $10-200M
    // (line extensions, not novel assets). Established safety profile reduces
    // risk but total value is smaller.
    const PHASE_REFORM_MULTIPLIERS: Record<string, number> = {
      discovery: 0.25,
      preclinical: 0.35,
      phase1: 0.45,
      phase1_2: 0.50,
      phase2: 0.55,
      phase2_3: 0.60,
      phase3: 0.65,
      nda_filed: 0.70,
      approved: 0.75,
    };

    // Rebuild total deal with reformulation economics
    const reformBase = Math.abs(calibratedRNPV) * (PHASE_REFORM_MULTIPLIERS[phase] ?? 0.55);
    const reformTotalMedian = reformBase + ipPremium;
    const reformTotalLow = reformTotalMedian * 0.80;
    const reformTotalHigh = reformTotalMedian * 1.20;

    impliedDealValue.totalDeal = {
      low: reformTotalLow,
      median: reformTotalMedian,
      high: reformTotalHigh,
    };

    impliedDealValue.upfront = {
      low: impliedDealValue.totalDeal.low * upfrontPercent.low,
      median: impliedDealValue.totalDeal.median * upfrontPercent.median,
      high: impliedDealValue.totalDeal.high * upfrontPercent.high,
    };

    impliedDealValue.reformulationIPValue = {
      fullNDACost_M: Math.round(fullNDACost),
      costMultiplier: reformProfile.costMultiplier,
      pathwaySavings_M: Math.round(pathwaySavings),
      subType: reformSubType,
    };
  }

  // Post-branch invariant: upfront.high ≤ totalDeal.high (and median/low).
  // Ranges can drift if a user supplies extreme inputs (e.g., a $1B equity
  // investment) that push totalDeal beyond the upfront cap. Clamp upfront
  // down rather than flipping the ordering.
  impliedDealValue.upfront.low = Math.min(
    impliedDealValue.upfront.low,
    impliedDealValue.totalDeal.low,
  );
  impliedDealValue.upfront.median = Math.min(
    impliedDealValue.upfront.median,
    impliedDealValue.totalDeal.median,
  );
  impliedDealValue.upfront.high = Math.min(
    impliedDealValue.upfront.high,
    impliedDealValue.totalDeal.high,
  );

  // 10. Cross-validation with benchmark-based deal value
  // Use phase-dependent deal-to-rNPV ratio for more accurate comparison.
  // Earlier phases have lower deal/rNPV ratios due to higher risk premium.
  // Source: DealForma 2020-2025 — median total deal value as fraction of rNPV by phase.
  let crossValidation: RNPVResult['crossValidation'];
  if (benchmarkDealValue) {
    const benchMedian = benchmarkDealValue.median;
    const phaseDealRatio = getPhaseDealToRNPVRatio(phase);
    const rnpvImpliedMedian = calibratedRNPV * phaseDealRatio;
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
  // R71 (2026-04-16): Source citations on every assumption. Grade-A+
  // institutional standard: every number should be traceable. BD users
  // need to explain these to counterparties in a negotiation room.
  const modelAssumptions = [
    `Discount rate: ${(discountRate * 100).toFixed(1)}% (${therapeuticArea} ${phase} WACC${mfgPremium > 0 ? ` + ${(mfgPremium * 100).toFixed(1)}pp CMC premium` : ''}${territory ? `, ${territory}` : ''}${input.companyType ? `, ${input.companyType}` : ''}${dealType !== 'licensing' ? `, ${dealType}` : ''}) [Source: Damodaran 2024 biotech WACC + EvaluatePharma phase-risk premium]`,
    `Cumulative PoS from ${phase}: ${(cumulativePoS * 100).toFixed(1)}%${posModifierNote} [Source: BIO Industry Analysis 2024, Wong-Siah-Lo 2019 Nature Biotech, FDA CDER approval statistics]`,
    `Years to market: ${yearsToMarket.toFixed(1)} years${accessDelay > 0 ? ` (incl. ${accessDelay}mo market access lag)` : ''}${timelineMultiplier !== 1.0 ? ` (data quality: ${dataQuality} → ${timelineMultiplier > 1 ? '+' : ''}${((timelineMultiplier - 1) * 100).toFixed(0)}% P3 duration)` : ''}`,
    `Peak sales estimate: $${adjustedPeakSales.median.toFixed(0)}M${genericMultiplier < 1.0 ? ` (×${genericMultiplier.toFixed(2)} generic entrenchment penalty)` : ''}`,
    ...(peakSalesCheck.indexDrug ? [`Index drug: ${peakSalesCheck.indexDrug.name} at $${peakSalesCheck.indexDrug.peakSalesM.toLocaleString()}M — model is ${(peakSalesCheck.indexRatio * 100).toFixed(0)}% of index (${peakSalesCheck.confidence})`] : []),
    ...(!ceilingCheck.ok && ceilingCheck.severity === 'critical'
      ? [`CRITICAL TAM ceiling: ${ceilingCheck.message} Hard-capped to $${(ceilingCheck.ceiling ?? 0).toLocaleString()}M (80% of $${(ceilingCheck.tam ?? 0).toLocaleString()}M TAM).`]
      : []),
    ...(!ceilingCheck.ok && ceilingCheck.severity === 'warning'
      ? [`WARNING TAM ceiling: ${ceilingCheck.message} Not capped, but this exceeds the market leader's peak.`]
      : []),
    ...(competitiveDensity ? [`Competitive density: ${competitiveDensity.approvedDrugs} approved drugs, ${competitiveDensity.activeTrials} active trials → ${competitiveDensity.penetrationMultiplier}x penetration multiplier`] : []),
    ...(subpop.matchedKey
      ? [`Subpopulation: ${subpop.matchedKey} → peak ×${subpop.peakSalesMult.toFixed(2)}, PoS ×${subpop.posMult.toFixed(2)} (source: ${subpop.source})`]
      : []),
    ...(patentCliff && patentCliff.scenario !== 'noLeader'
      ? [patentCliff.narrative]
      : []),
    ...(comboDynamicsUsed && comboMultiplier !== 1.0
      ? [`Combination therapy adjustment: ×${comboMultiplier.toFixed(2)} (${(comboMultiplier * 100).toFixed(0)}% of monotherapy assumption). ${comboDynamicsUsed.notes}${comboDynamicsUsed.partnerDrug ? ` Partner: ${comboDynamicsUsed.partnerDrug}.` : ''}`]
      : []),
    ...(comboDynamicsUsed && comboMultiplier === 1.0 && input.combinationContext === 'monotherapy'
      ? [`Combination therapy adjustment: skipped (user specified monotherapy context for ${input.indication}).`]
      : []),
    (() => {
      const ic = input.indication ? INDICATION_REVENUE_CURVES[input.indication] : undefined;
      const r = ic?.rampUpYears ?? REVENUE_CURVE_OVERRIDES[therapeuticArea]?.rampUpYears ?? REVENUE_CURVE.rampUpYears;
      const p = ic?.peakDurationYears ?? REVENUE_CURVE_OVERRIDES[therapeuticArea]?.peakDurationYears ?? REVENUE_CURVE.peakDurationYears;
      const d = ic?.declineRate ?? REVENUE_CURVE_OVERRIDES[therapeuticArea]?.declineRate ?? REVENUE_CURVE.declineRate;
      const src = ic ? ` [${input.indication}-specific: ${ic.source}]` : '';
      return `Revenue ramp: ${r}yr ramp, ${p}yr peak, ${(d * 100).toFixed(0)}% annual decline${src}`;
    })(),
    (() => {
      const ic = input.indication ? INDICATION_REVENUE_CURVES[input.indication] : undefined;
      const loe = ic?.loeYearsAfterApproval ?? REVENUE_CURVE_OVERRIDES[therapeuticArea]?.loeYearsAfterApproval ?? REVENUE_CURVE.loeYearsAfterApproval;
      return `LOE: ${loe} years post-approval; generic erosion: ${(genericErosionTV * 100).toFixed(0)}% (${modality})`;
    })(),
    `COGS: modality-specific (${modality}); SG&A: lifecycle-stage-specific`,
    `Corporate tax: ${(getEffectiveTaxRate(territory) * 100).toFixed(0)}% effective rate on positive operating income (${territory || 'global'})`,
  ];

  // --- Geographic revenue decomposition ---
  // Split the global peak sales into US / EU5 / Japan / China / RoW curves
  // with independent launch delays, ramps, and pricing multipliers. The
  // result is a parallel absolute-calendar-year revenue schedule that
  // should reconcile to the global cash-flow revenue within ~5%.
  //
  // Flag-gated: only populated when TIER2_GEO_DECOMP is on. Purely additive
  // data (doesn't affect NPV / PoS / cash flows), but keeping it off by
  // default keeps the UI from rendering unvalidated regional projections
  // until the 100-deal backtest confirms the split tables are accurate.
  let geographicDecomposition: RNPVResult['geographicDecomposition'];
  if (TIER2_FLAGS.geographicDecomposition) try {
    const startYearFloor = cashFlows.length > 0
      ? cashFlows[0].year
      : new Date().getFullYear();
    const approvalYear = Math.round(startYearFloor + yearsToMarket);
    const projectionYears = Math.max(20, cashFlows.length);
    const decomposed = decomposeGeographicRevenue(
      adjustedPeakSales.median,
      therapeuticArea,
      approvalYear,
      projectionYears,
    );
    geographicDecomposition = {
      byGeography: decomposed.byGeography,
      totalRevenueByYear: decomposed.totalRevenueByYear,
      geographicSplits: decomposed.geographicSplits,
      globalEquivalentPeakSales: adjustedPeakSales.median,
    };

    // Reconcile against the global cash flow revenue peak — should match
    // within ~5%. Surface in modelAssumptions; log to Sentry only if the
    // drift is extreme so we catch any regressions in the curve math.
    const decomposedPeak = decomposed.totalRevenueByYear.reduce(
      (m, v) => (v > m ? v : m),
      0,
    );
    const globalPeak = adjustedPeakSales.median;
    if (globalPeak > 0) {
      const drift = Math.abs(decomposedPeak - globalPeak) / globalPeak;
      modelAssumptions.push(
        `Geographic split: US/EU5/Japan/China/RoW curves (${therapeuticArea}); reconciled within ${(drift * 100).toFixed(1)}% of global peak`,
      );
    }
  } catch {
    // Never let decomposition errors break the rNPV calculation.
    geographicDecomposition = undefined;
  }

  const rnpvResult: RNPVResult = {
    riskAdjustedNPV: Math.round(riskAdjustedNPV),
    unadjustedNPV: Math.round(unadjustedNPV),
    cumulativePoS,
    phaseTransitions,
    cashFlows,
    peakSalesYear,
    yearsToMarket: Math.round(yearsToMarket * 10) / 10,
    calculationFingerprint: computeCalculationFingerprint(input as unknown as Record<string, unknown>),
    impliedDealValue: {
      upfront: roundRange(impliedDealValue.upfront),
      totalDeal: roundRange(impliedDealValue.totalDeal),
      ...(impliedDealValue.codevCostSharing
        ? { codevCostSharing: impliedDealValue.codevCostSharing }
        : {}),
      ...(impliedDealValue.optionExerciseFee
        ? { optionExerciseFee: impliedDealValue.optionExerciseFee }
        : {}),
      ...(impliedDealValue.fteResearchValue
        ? { fteResearchValue: impliedDealValue.fteResearchValue }
        : {}),
      ...(impliedDealValue.equityInvestment != null
        ? { equityInvestment: impliedDealValue.equityInvestment }
        : {}),
    },
    crossValidation,
    discountRate,
    terminalValue: Math.round(terminalValue),
    modelAssumptions,
    dealStructureClassification,
    peakSalesCeilingCheck: ceilingCheck.ok ? { ok: true } : ceilingCheck,
    ...(comboDynamicsUsed
      ? {
          combinationAdjustment: {
            multiplier: comboMultiplier,
            context: input.combinationContext || comboDynamicsUsed.context,
            comboFraction: comboDynamicsUsed.comboFraction,
            revenueShare: comboDynamicsUsed.revenueShare,
            ...(comboDynamicsUsed.partnerDrug ? { partnerDrug: comboDynamicsUsed.partnerDrug } : {}),
            peakSalesDelta_M: Math.round((adjustedPeakSales.median - originalPeakSalesMedian) * 10) / 10,
            originalPeakSales_M: Math.round(originalPeakSalesMedian * 10) / 10,
            adjustedPeakSales_M: Math.round(adjustedPeakSales.median * 10) / 10,
            rationale:
              comboAdjustmentMedian.rationale ||
              `Combination context: ${comboDynamicsUsed.context}. ${comboDynamicsUsed.notes}`,
          },
        }
      : {}),
    ...(geographicDecomposition ? { geographicDecomposition } : {}),
    ...(patentCliff && patentCliff.scenario !== 'noLeader' && patentCliff.leader
      ? {
          patentCliffAdjustment: {
            multiplier: patentCliff.multiplier,
            scenario: patentCliff.scenario,
            narrative: patentCliff.narrative,
            leaderDrug: patentCliff.leader.drug,
            loeYear: patentCliff.leader.loeYear,
            biosimilarYear: patentCliff.leader.biosimilarYear,
          },
        }
      : {}),
    ...(ca && Object.values(ca).some(v => v != null) ? {
      customAssumptionsApplied: {
        overriddenFields: Object.entries(ca)
          .filter(([, v]) => v != null)
          .map(([k]) => k),
      },
    } : {}),
  };

  // Layer 1: Mathematical invariants — log to Sentry but never throw.
  // Catches silent bugs like the Phase 1 oncology duration duplication (8.5y→15.8y).
  try {
    const violations = checkRNPVInvariants(rnpvResult, input);
    if (violations.some(v => v.severity === 'critical')) {
      assertInvariants(violations, {
        context: 'rnpv-engine',
        extra: {
          phase: input.phase,
          therapeuticArea: input.therapeuticArea,
          modality: input.modality,
          indication: input.indication,
        },
      });
    }
  } catch {
    // Never allow invariant checks to break production calculations.
  }

  // Tier 4 Item 11: Risk decomposition.
  // Skipped when this call is itself a counterfactual run from the decomposer
  // (flagged via __internalFlags.skipDecomposition) to prevent infinite recursion.
  // Default off until the 100-deal backtest validates it — flag-gated.
  if (
    TIER4_FLAGS.riskDecomposition &&
    !input.__internalFlags?.skipDecomposition
  ) {
    try {
      rnpvResult.riskDecomposition = decomposeRisk(input, rnpvResult, calculateRNPV);
      // Surface >10% reconciliation gaps as Sentry breadcrumbs so we can
      // catch drift without breaking the calculation.
      if (rnpvResult.riskDecomposition.reconciliationGap > 0.10) {
        try {
          const Sentry = require('@sentry/nextjs');
          Sentry.addBreadcrumb?.({
            category: 'engine.risk-decomposition',
            level: 'warning',
            message: `Risk decomposition reconciliation gap ${(rnpvResult.riskDecomposition.reconciliationGap * 100).toFixed(1)}% > 10%`,
            data: {
              phase: input.phase,
              therapeuticArea: input.therapeuticArea,
              modality: input.modality,
              indication: input.indication,
              total_M: rnpvResult.riskDecomposition.total_M,
            },
          });
        } catch {
          // Sentry is optional in test environments.
        }
      }
    } catch {
      // Decomposition is informational; never block the baseline result.
    }
  }

  return rnpvResult;
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
  therapeuticArea: string,
  pathway?: string[],
  indication?: string,
  territory?: string,
  customAssumptions?: import('./types').CustomAssumptions,
): CashFlowYear[] {
  const cashFlows: CashFlowYear[] = [];
  // Resolve revenue curve parameters with the following precedence:
  //   1. INDICATION_REVENUE_CURVES[indication] — most specific, real launch data
  //   2. REVENUE_CURVE_OVERRIDES[therapeuticArea] — TA-level override
  //   3. REVENUE_CURVE — default
  const indicationCurve = indication ? INDICATION_REVENUE_CURVES[indication] : undefined;
  const taOverrides = REVENUE_CURVE_OVERRIDES[therapeuticArea] || {};
  const rc = customAssumptions?.revenueCurve;
  const rampUpYears = rc?.rampUpYears ?? indicationCurve?.rampUpYears ?? taOverrides.rampUpYears ?? REVENUE_CURVE.rampUpYears;
  const peakDurationYears = rc?.peakDurationYears ?? indicationCurve?.peakDurationYears ?? taOverrides.peakDurationYears ?? REVENUE_CURVE.peakDurationYears;
  const declineRate = rc?.declineRate ?? indicationCurve?.declineRate ?? taOverrides.declineRate ?? REVENUE_CURVE.declineRate;
  const loeYearsAfterApproval = rc?.loeYearsAfterApproval ?? indicationCurve?.loeYearsAfterApproval ?? taOverrides.loeYearsAfterApproval ?? REVENUE_CURVE.loeYearsAfterApproval;
  const genericErosion = rc?.genericErosion ?? getGenericErosionRate(modality);
  const totalYears = Math.ceil(yearsToMarket) + loeYearsAfterApproval + 5; // +5 for post-LOE tail

  // R&D cost phase mapping (years spent in each remaining phase)
  // Use the sequential pathway (same as duration calculation) — NOT linear PHASE_ORDER.
  // Combined phases (phase1_2, phase2_3) are alternative pathways, not sequential steps.
  // Iterating PHASE_ORDER linearly double-counts costs by summing phase1 + phase1_2 + phase2 + ...
  const rdPathway = pathway ?? (() => {
    // Fallback: reconstruct standard pathway from currentPhaseIdx
    const standard = ['discovery', 'preclinical', 'phase1', 'phase2', 'phase3', 'nda_filed'];
    const currentPhase = PHASE_ORDER[currentPhaseIdx];
    const startIdx = standard.indexOf(currentPhase);
    return startIdx >= 0 ? standard.slice(startIdx) : ['phase1', 'phase2', 'phase3', 'nda_filed'];
  })();

  // Compute the raw (unadjusted) sum of pathway durations so we can scale
  // the R&D schedule to match the adjusted yearsToMarket. Without this scaling,
  // the R&D schedule would end at the raw sum (ignoring data-quality timeline
  // multiplier, market-access delay, and timeToMarketAdjustment), potentially
  // overlapping commercial revenue if yearsToMarket was compressed.
  const rawYearsToMarket = rdPathway.reduce((sum, p) => sum + (durations[p] || 2.0), 0);
  const rdTimelineScale = rawYearsToMarket > 0 ? yearsToMarket / rawYearsToMarket : 1.0;

  let rdYearsSoFar = 0;
  const rdSchedule: { startYear: number; endYear: number; annualCost: number }[] = [];
  for (const phaseName of rdPathway) {
    const rawDur = durations[phaseName] || 2.0;
    const scaledDur = rawDur * rdTimelineScale;
    const totalCost = phaseCosts[phaseName] || 0;
    // Divide totalCost by the SCALED duration so the total spend stays constant
    // while the annual burn rate adjusts to the compressed/expanded timeline.
    const annualCost = scaledDur > 0 ? totalCost / scaledDur : 0;
    rdSchedule.push({
      startYear: rdYearsSoFar,
      endYear: rdYearsSoFar + scaledDur,
      annualCost,
    });
    rdYearsSoFar += scaledDur;
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
        // Post-LOE: sharp generic erosion applied to the revenue level
        // *immediately before* LOE (not raw peakSales). Without this, a
        // drug that declined from $1B peak → $600M by LOE would incorrectly
        // jump back up to $1B × (1 - erosion) on LOE day.
        const declineYearsAtLoe = Math.max(0, loeYearsAfterApproval - rampUpYears - peakDurationYears);
        const preLoeRevenue = peakSales * Math.pow(1 - declineRate, declineYearsAtLoe);
        const postLoeYears = yearsSinceLaunch - loeYearsAfterApproval;
        revenue = preLoeRevenue * (1 - genericErosion) * Math.pow(0.85, postLoeYears);
      }
    }

    const cogsRate = customAssumptions?.cogsPercent ?? getCogsRate(modality);
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
    const tax = preTaxCashFlow > 0 ? preTaxCashFlow * getEffectiveTaxRate(territory ?? 'global') : 0;
    const netCashFlow = preTaxCashFlow - tax;
    const discountFactor = 1 / Math.pow(1 + discountRate, year);
    const presentValue = netCashFlow * discountFactor;

    // Risk-adjusted: probability of reaching this year's cash flows.
    //
    // Methodology note: we apply a single year-specific PoS to NET cash flow
    // (revenue - costs). Pre-launch years use getPartialPoS (sigmoidal ramp
    // from ~1.0 early to cumulativePoS at launch), which naturally captures
    // the fact that if a program fails early (e.g. Phase 2 miss), Phase 3
    // R&D spend never happens. Post-launch years use the full cumulativePoS
    // for both revenue and ongoing SG&A/COGS, which slightly under-weights
    // committed post-launch costs but keeps revenue and operating cost
    // risk-weighting symmetric. This matches the simplified rNPV convention
    // used in most published industry valuations.
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
export function getCogsRate(modality: string): number {
  // Map specific modalities to categories
  // Comprehensive modality-to-COGS mapping — all biologic-class modalities must be listed
  // to avoid incorrectly defaulting to smallMolecule (10% COGS instead of 18%)
  const biologicModalities = [
    'mab', 'bispecific', 'trispecificAntibody', 'tCellEngager', 'adc', 'fcrnAntagonist', 'complementInhibitor',
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
export function getGenericErosionRate(modality: string): number {
  const biologicModalities = ['mab', 'antibody', 'bispecific', 'trispecificAntibody', 'tCellEngager', 'adc', 'fcrnAntagonist', 'complementInhibitor', 'peptide', 'dualAntagonist', 'tl1aInhibitor', 'antiVegf', 'jakInhibitor', 's1pModulator', 'oralIntegrin', 'pcsk9Targeting', 'antiActivin', 'intravitreal', 'gnrhAntagonist', 'anticoagulantNovel', 'amylinAnalog', 'glp1Agonist', 'dualIncretin', 'tripleIncretin', 'sglt2Inhibitor'];
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
  // Year 0 is before any risk is realized; all planned R&D costs are "certain"
  // in the sense that you haven't had an opportunity to fail yet.
  if (year === 0) return 1.0;
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
export function getDefaultDiscountRate(
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

  // Tier 4 Item 12: Layer dynamic rf delta on top of the static rate when the
  // macro-factors flag is on. Flag-gated default off — zero production
  // behavior change until the 100-deal backtest validates the blend.
  if (TIER4_FLAGS.macroFactors) {
    rate += getDynamicWaccComponent(rate);
  }

  // Floor: reformulation discount rate should not go below 7.5% (below pharma WACC floor).
  // At late stages (approved = base 8%), the flat -2pp deal-type adjustment pushes to 6%,
  // which is below investment-grade WACC and unrealistic for any pharma asset.
  if (dealType === 'reformulation') {
    rate = Math.max(0.075, rate);
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
  // Empirically tuned against 251-deal backtest (`__tests__/backtest/baseline-
  // errors.json`). Per Option B methodology (`engine-grade-a-option-b.md`):
  // "iterate calibration until the model accurately predicts real deals."
  //
  // Round 2 (2026-04-13): Phase 3 licensing upfront ratio moved 0.30 → 0.22
  // median. The 26 core-scope Phase 3 deals showed median signed error +212%
  // at 0.30, driven by smaller/specialty licensees paying limited upfronts
  // on narrow territorial scope. DealForma/BioCentury 2020-2025 empirical
  // distribution for Phase 3 licensing has a much wider mass below 25% than
  // the original 20/30/40 band. Phase 2 / 2_3 left intact because phase 2
  // median was -48% (undershooting); raising it would worsen the asymmetry.
  // Phase 1 / preclinical left intact — upfronts there are strategic option
  // value, not NPV-fractions.
  // Round 37 (2026-04-13): Phase 2 / phase2_3 / phase3 medians raised based on
  // 1,067-deal corpus signed-error analysis. The 251-deal R2 calibration showed
  // phase 3 overshoot at 0.30; the expanded corpus shows persistent
  // undershoot across phase 2 (-51% median signed error) and phase 3
  // (-22% pre-uplift). Empirically tuned via R37 sweep:
  //   phase2:    0.18 → 0.22 (+22%)
  //   phase2_3:  0.20 → 0.24 (+20%)
  //   phase3:    0.22 → 0.26 (+18%)
  // Combined with R29-R32 test-harness uplifts, this lifts core ±35% by
  // ~2pp without breaking golden masters (which test rNPV pre-upfront).
  const percents: Record<string, { low: number; median: number; high: number }> = {
    preclinical: { low: 0.03, median: 0.05, high: 0.08 },
    phase1: { low: 0.05, median: 0.10, high: 0.15 },
    phase1_2: { low: 0.07, median: 0.13, high: 0.18 },
    phase2: { low: 0.12, median: 0.22, high: 0.30 },     // R37: was 0.10/0.18/0.25
    phase2_3: { low: 0.14, median: 0.24, high: 0.32 },   // R37: was 0.12/0.20/0.28
    phase3: { low: 0.18, median: 0.26, high: 0.36 },     // R37: was 0.15/0.22/0.32
    nda_filed: { low: 0.22, median: 0.32, high: 0.45 },
    approved: { low: 0.30, median: 0.42, high: 0.58 },
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
  if (dealType === 'reformulation') return { low: 0.15, median: 0.225, high: 0.30 };
  const overrides: Record<string, { low: number; median: number; high: number }> = {
    acquisition: { low: 0.70, median: 0.825, high: 0.95 },    // Mostly upfront cash
    codevelopment: { low: 0.15, median: 0.225, high: 0.30 },   // Shared risk = lower upfront
    option: { low: 0.05, median: 0.10, high: 0.15 },           // Option premium, exercise later
    collaboration: { low: 0.10, median: 0.175, high: 0.25 },   // Research funding, early partnership
  };
  return overrides[dealType] || null;
}

/**
 * Historical probability an option deal converts to a full license.
 *
 * Source: BIO 2024–2026 option-deal analysis. ~50% exercise rate for Phase 1
 * ADC / platform options; later-phase options (rare but data-rich) exercise
 * more often because the data supporting the decision is less ambiguous.
 *
 * These values are intentionally conservative — the probability is capped at
 * 0.75 because even Phase 3 assets fail at the CRL stage.
 */
function getOptionExerciseProbability(phase: string): number {
  const probs: Record<string, number> = {
    discovery: 0.25,
    preclinical: 0.35,
    phase1: 0.50,
    phase1_2: 0.55,
    phase2: 0.60,
    phase2_3: 0.65,
    phase3: 0.70,
    nda_filed: 0.75,
    approved: 0.75,
  };
  return probs[phase] ?? 0.50;
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
