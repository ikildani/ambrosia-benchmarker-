/**
 * Pricing & Reimbursement Constraint Engine
 *
 * Models the impact of payer/reimbursement dynamics on pharma deal valuations.
 * Evaluates cost-effectiveness (ICER/NICE/QALY), IRA Medicare negotiation
 * exposure, international reference pricing differentials, formulary tiering,
 * and patient access barriers to produce a net peak-sales adjustment.
 *
 * Key regulatory frameworks modeled:
 *   - US: Inflation Reduction Act (IRA) Medicare negotiation (2025+ vintage)
 *   - UK: NICE technology appraisals and Highly Specialised Technology (HST)
 *   - EU: HTA Regulation 2021/2282 (joint clinical assessments from Jan 2025)
 *   - International reference pricing (IRP) across G7 + Australia + China
 *
 * Sources:
 *   - ICER 2020-2023 Value Assessment Framework & Evidence Reports
 *   - CMS IRA Implementation Final Rule (2023); CBO scoring (2022)
 *   - NICE Methods Guide 2022; NICE HST evaluation criteria
 *   - WHO Guideline on Country Pharmaceutical Pricing Policies (2020)
 *   - Evaluate Pharma World Preview 2024; IQVIA Global Pricing Reference 2025
 *
 * @module lib/financial/pricing-access
 */

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface ICERThreshold {
  /** Disease severity classification */
  severity: DiseaseSeverity;
  /** Willingness-to-pay threshold in USD per QALY */
  thresholdPerQALY: number;
  /** NICE-equivalent threshold in GBP per QALY (converted at ~1.25 USD/GBP) */
  niceEquivalentGBP: number;
}

export type DiseaseSeverity =
  | 'mild'
  | 'moderate'
  | 'severe'
  | 'life_threatening'
  | 'ultra_rare'
  | 'ultra_rare_pediatric';

export type ICERRisk = 'favorable' | 'borderline' | 'unfavorable';

export type NICERecommendation =
  | 'recommended'
  | 'optimized'
  | 'restricted'
  | 'not_recommended';

export type FormularyTier =
  | 'specialty'
  | 'preferred_brand'
  | 'non_preferred'
  | 'restricted';

export interface IRAExposure {
  /** Whether the drug would be eligible for IRA Medicare negotiation */
  eligible: boolean;
  /** Calendar year when negotiation would begin (null if ineligible) */
  negotiationYear: number | null;
  /** Expected price reduction from Medicare negotiation (0-1) */
  expectedPriceReduction_pct: number;
}

export interface TerritoryPriceIndex {
  /** Territory identifier */
  territory: string;
  /** Price as percentage of US WAC (0-1) */
  pricePctOfUS: number;
}

export interface InternationalReferencePricing {
  /** Revenue-weighted average price vs US (0-1) */
  avgPriceVsUS: number;
  /** Per-territory breakdown */
  territories: TerritoryPriceIndex[];
}

export interface PayerMixImpact {
  /** Commercial/employer-sponsored insurance share (0-1) */
  commercialPct: number;
  /** Medicare Part B/D share (0-1) */
  medicarePct: number;
  /** Medicaid share (0-1) */
  medicaidPct: number;
  /** Managed care (MA, MCO) share (0-1) */
  managedCarePct: number;
}

export interface PricingConstraintResult {
  /** ICER cost-effectiveness threshold for this indication (USD/QALY) */
  icerThreshold: number;
  /** Whether drug price likely exceeds willingness-to-pay */
  icerRisk: ICERRisk;
  /** Expected NICE recommendation category */
  niceRecommendation: NICERecommendation;
  /** IRA Medicare negotiation exposure */
  iraExposure: IRAExposure;
  /** International reference pricing differentials */
  internationalReferencePricing: InternationalReferencePricing;
  /** Net peak sales adjustment from all pricing/access constraints (negative = reduction) */
  peakSalesAdjustment_pct: number;
  /** Payer mix breakdown */
  payerMixImpact: PayerMixImpact;
  /** Expected formulary tier placement */
  formularyTier: FormularyTier;
  /** Patient access barriers */
  patientAccessBarriers: string[];
  /** Human-readable narrative summarizing constraints */
  narrative: string;
}

export interface IRANegotiationEntry {
  /** Years after approval before eligible for negotiation */
  yearsPostApproval: number;
  /** Drug category */
  category: 'small_molecule' | 'biologic';
  /** Minimum annual Medicare Part D spend to trigger eligibility (USD millions) */
  spendThreshold_M: number;
  /** Description of the negotiation rule */
  description: string;
}

// ---------------------------------------------------------------------------
// ICER Thresholds by Severity
// ---------------------------------------------------------------------------

/**
 * Cost-effectiveness thresholds by disease severity.
 *
 * These reflect the implicit and explicit willingness-to-pay (WTP) thresholds
 * used by US payers, ICER, and NICE. Ultra-rare/pediatric diseases command
 * higher WTP due to smaller patient populations and unmet need.
 *
 * NICE uses GBP 20,000-30,000/QALY for standard TAs, up to GBP 100,000-300,000
 * for HST (Highly Specialised Technologies). US payers implicitly accept higher
 * thresholds, especially for oncology and rare disease.
 */
export const ICER_THRESHOLDS_BY_SEVERITY: Record<DiseaseSeverity, ICERThreshold> = {
  mild: {
    severity: 'mild',
    thresholdPerQALY: 50_000,
    niceEquivalentGBP: 20_000,
  },
  moderate: {
    severity: 'moderate',
    thresholdPerQALY: 100_000,
    niceEquivalentGBP: 30_000,
  },
  severe: {
    severity: 'severe',
    thresholdPerQALY: 150_000,
    niceEquivalentGBP: 50_000,
  },
  life_threatening: {
    severity: 'life_threatening',
    thresholdPerQALY: 200_000,
    niceEquivalentGBP: 80_000,
  },
  ultra_rare: {
    severity: 'ultra_rare',
    thresholdPerQALY: 300_000,
    niceEquivalentGBP: 200_000,
  },
  ultra_rare_pediatric: {
    severity: 'ultra_rare_pediatric',
    thresholdPerQALY: 500_000,
    niceEquivalentGBP: 300_000,
  },
};

// ---------------------------------------------------------------------------
// IRA Negotiation Schedule
// ---------------------------------------------------------------------------

/**
 * Inflation Reduction Act Medicare Drug Price Negotiation Rules.
 *
 * Per the IRA (signed Aug 2022, effective 2026 negotiations):
 * - Small molecules: eligible 9 years after FDA approval
 * - Biologics: eligible 13 years after FDA approval
 * - Must have Medicare Part B or Part D spend exceeding threshold
 * - Initial cohort (2026): 10 drugs selected by CMS from Part D
 * - Expanding to 15 drugs (Part D, 2027), 15 drugs (Part B+D, 2028), 20 (2029+)
 *
 * Expected price reductions: CBO estimates 25-60% off list price,
 * with a statutory ceiling based on years since approval.
 */
export const IRA_NEGOTIATION_SCHEDULE: IRANegotiationEntry[] = [
  {
    yearsPostApproval: 9,
    category: 'small_molecule',
    spendThreshold_M: 200,
    description:
      'Small molecules with 9+ years post-approval and >$200M Medicare Part D spend are eligible for CMS negotiation. Statutory maximum fair price capped at 75% of non-federal average manufacturer price for 9-12 years, 65% for 12-16 years, 40% for 16+ years.',
  },
  {
    yearsPostApproval: 13,
    category: 'biologic',
    spendThreshold_M: 200,
    description:
      'Biologics with 13+ years post-approval and >$200M Medicare Part B/D spend are eligible. Longer exclusivity window reflects BPCIA 12-year reference product exclusivity. Same tiered maximum fair price structure applies.',
  },
];

// ---------------------------------------------------------------------------
// Internal constants & lookup tables
// ---------------------------------------------------------------------------

/** Disease severity by therapeutic area (default mapping) */
const TA_SEVERITY_MAP: Record<string, DiseaseSeverity> = {
  oncology: 'life_threatening',
  hematology: 'life_threatening',
  neurology: 'severe',
  immunology: 'moderate',
  cardiovascular: 'severe',
  metabolic: 'moderate',
  infectiousDisease: 'moderate',
  ophthalmology: 'moderate',
  rareDisease: 'ultra_rare',
  womensHealth: 'mild',
  dermatology: 'mild',
  gastroenterology: 'moderate',
  psychiatry: 'moderate',
  pain_management: 'moderate',
  pulmonology: 'severe',
  nephrology: 'severe',
  hepatology: 'severe',
  endocrinology: 'moderate',
  musculoskeletal: 'moderate',
};

/** Indication-level severity overrides (more specific than TA-level) */
const INDICATION_SEVERITY_OVERRIDES: Record<string, DiseaseSeverity> = {
  // Oncology -- all life-threatening by default, but pediatric tumors get higher WTP
  gbm: 'life_threatening',
  pancreatic: 'life_threatening',
  // Neurology upgrades
  als: 'life_threatening',
  huntingtons: 'life_threatening',
  duchenne: 'ultra_rare_pediatric',
  sma: 'ultra_rare_pediatric',
  // Rare disease specifics
  pompe: 'ultra_rare',
  fabry: 'ultra_rare',
  gaucher: 'ultra_rare',
  batten: 'ultra_rare_pediatric',
  // Hematology
  sickle_cell: 'severe',
  hemophilia_a: 'ultra_rare',
  hemophilia_b: 'ultra_rare',
  // Cardio upgrades
  heart_failure: 'life_threatening',
  pah: 'life_threatening',
  // Metabolic downgrades/upgrades
  nash: 'moderate',
  obesity: 'mild',
  type1_diabetes: 'severe',
  type2_diabetes: 'moderate',
  // Ophthalmology
  wet_amd: 'severe',
  inherited_retinal: 'ultra_rare_pediatric',
  // Dermatology upgrades for severe forms
  pemphigus: 'severe',
  epidermolysis_bullosa: 'ultra_rare',
};

/**
 * International reference pricing indices.
 * Values represent typical price as a fraction of US WAC.
 *
 * Sources: IQVIA MIDAS 2024, GlobalData Pricing Intelligence 2025
 */
const IRP_TERRITORY_INDICES: TerritoryPriceIndex[] = [
  { territory: 'Germany', pricePctOfUS: 0.62 },
  { territory: 'UK', pricePctOfUS: 0.48 },
  { territory: 'France', pricePctOfUS: 0.45 },
  { territory: 'Italy', pricePctOfUS: 0.42 },
  { territory: 'Spain', pricePctOfUS: 0.40 },
  { territory: 'Japan', pricePctOfUS: 0.55 },
  { territory: 'Canada', pricePctOfUS: 0.62 },
  { territory: 'Australia', pricePctOfUS: 0.47 },
  { territory: 'South Korea', pricePctOfUS: 0.38 },
  { territory: 'China', pricePctOfUS: 0.27 },
  { territory: 'Brazil', pricePctOfUS: 0.32 },
];

/** Biologic modalities (for IRA exclusivity period determination) */
const BIOLOGIC_MODALITIES = new Set([
  'mab',
  'adc',
  'bispecific',
  'tCellEngager',
  'carT_heme',
  'carT_solid',
  'cellTherapy',
  'geneTherapy',
  'geneTherapyOcular',
  'geneTherapyRare',
  'mrna',
  'therapeuticVaccine',
  'oncolyticVirus',
  'carT_autoimmune',
  'inVivoCarT',
  'carTreg',
  'fcrnAntagonist',
  'complementInhibitor',
  'enzymeReplacement',
  'bispecificHeme',
  'antiVegf',
  'vaccinePreventive',
  'phageTherapy',
  'topicalBiologic',
  'il17Inhibitor',
  'il13Inhibitor',
  'il23GI',
  'antiTl1a',
  'tl1aInhibitor',
  'stemCell',
]);

/**
 * Payer mix defaults by therapeutic area (US market).
 * Commercial share is higher for working-age populations;
 * Medicare dominates for age-related conditions.
 */
const PAYER_MIX_BY_TA: Record<string, PayerMixImpact> = {
  oncology: { commercialPct: 0.35, medicarePct: 0.40, medicaidPct: 0.10, managedCarePct: 0.15 },
  neurology: { commercialPct: 0.30, medicarePct: 0.45, medicaidPct: 0.10, managedCarePct: 0.15 },
  immunology: { commercialPct: 0.50, medicarePct: 0.20, medicaidPct: 0.12, managedCarePct: 0.18 },
  metabolic: { commercialPct: 0.40, medicarePct: 0.35, medicaidPct: 0.10, managedCarePct: 0.15 },
  cardiovascular: { commercialPct: 0.30, medicarePct: 0.45, medicaidPct: 0.10, managedCarePct: 0.15 },
  infectiousDisease: { commercialPct: 0.45, medicarePct: 0.20, medicaidPct: 0.20, managedCarePct: 0.15 },
  ophthalmology: { commercialPct: 0.25, medicarePct: 0.55, medicaidPct: 0.05, managedCarePct: 0.15 },
  rareDisease: { commercialPct: 0.45, medicarePct: 0.25, medicaidPct: 0.15, managedCarePct: 0.15 },
  womensHealth: { commercialPct: 0.55, medicarePct: 0.10, medicaidPct: 0.20, managedCarePct: 0.15 },
  hematology: { commercialPct: 0.35, medicarePct: 0.35, medicaidPct: 0.15, managedCarePct: 0.15 },
  dermatology: { commercialPct: 0.55, medicarePct: 0.15, medicaidPct: 0.12, managedCarePct: 0.18 },
  gastroenterology: { commercialPct: 0.50, medicarePct: 0.20, medicaidPct: 0.12, managedCarePct: 0.18 },
};

/** Default payer mix for TAs not in the lookup */
const DEFAULT_PAYER_MIX: PayerMixImpact = {
  commercialPct: 0.40,
  medicarePct: 0.30,
  medicaidPct: 0.12,
  managedCarePct: 0.18,
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Determine disease severity for a given TA/indication pair.
 * Indication-level overrides take precedence over TA-level defaults.
 */
function resolveSeverity(therapeuticArea: string, indication: string): DiseaseSeverity {
  const indicationKey = indication.toLowerCase().replace(/[\s-]/g, '_');
  if (INDICATION_SEVERITY_OVERRIDES[indicationKey]) {
    return INDICATION_SEVERITY_OVERRIDES[indicationKey];
  }
  return TA_SEVERITY_MAP[therapeuticArea] ?? 'moderate';
}

/**
 * Determine whether a modality is classified as a biologic (13yr IRA window)
 * or small molecule (9yr IRA window).
 */
function isBiologic(modality: string): boolean {
  return BIOLOGIC_MODALITIES.has(modality);
}

/**
 * Estimate ICER risk by comparing annual cost of therapy to the WTP threshold.
 *
 * Logic: if annual cost exceeds the QALY threshold (rough proxy assuming
 * ~0.5-1.0 QALYs gained per treatment year), the drug is borderline or
 * unfavorable. Ultra-rare/pediatric drugs get more generous treatment.
 */
function assessICERRisk(
  annualCostOfTherapy: number,
  threshold: number,
  severity: DiseaseSeverity,
): ICERRisk {
  // Assume average incremental QALY gain per year of treatment
  const assumedQALYGainPerYear =
    severity === 'ultra_rare_pediatric' ? 0.8 :
    severity === 'ultra_rare' ? 0.6 :
    severity === 'life_threatening' ? 0.5 :
    severity === 'severe' ? 0.4 :
    0.3;

  const impliedICER = annualCostOfTherapy / assumedQALYGainPerYear;

  if (impliedICER <= threshold * 0.8) return 'favorable';
  if (impliedICER <= threshold * 1.2) return 'borderline';
  return 'unfavorable';
}

/**
 * Map ICER risk + severity to a NICE recommendation category.
 *
 * NICE uses a tiered framework:
 * - Recommended: clear cost-effectiveness within standard thresholds
 * - Optimized: recommended with managed access / outcomes-based contracts
 * - Restricted: limited to specific subpopulations or lines of therapy
 * - Not recommended: ICER exceeds all acceptable thresholds
 */
function assessNICE(icerRisk: ICERRisk, severity: DiseaseSeverity): NICERecommendation {
  if (icerRisk === 'favorable') return 'recommended';
  if (icerRisk === 'borderline') {
    // NICE gives more latitude for severe/rare conditions via HST pathway
    if (severity === 'ultra_rare_pediatric' || severity === 'ultra_rare') return 'optimized';
    if (severity === 'life_threatening' || severity === 'severe') return 'optimized';
    return 'restricted';
  }
  // Unfavorable ICER
  if (severity === 'ultra_rare_pediatric' || severity === 'ultra_rare') return 'restricted';
  if (severity === 'life_threatening') return 'restricted';
  return 'not_recommended';
}

/**
 * Compute IRA negotiation exposure.
 *
 * Drugs are eligible when:
 *   1. They exceed the Medicare spend threshold ($200M/year)
 *   2. They have been on market longer than the exclusivity window
 *      (9 years for small molecules, 13 years for biologics)
 *
 * Expected price reduction is based on CBO estimates and early IRA
 * negotiation outcomes (Januvia, Eliquis, Xarelto, Entresto, etc.).
 */
function computeIRAExposure(
  modality: string,
  peakSales_M: number,
  territory: string,
): IRAExposure {
  // IRA only applies to US market
  const usRelevant = territory === 'us' || territory === 'global' || territory === 'north_america';
  if (!usRelevant) {
    return { eligible: false, negotiationYear: null, expectedPriceReduction_pct: 0 };
  }

  // Estimate Medicare share of peak sales
  const estimatedMedicareShare = 0.35; // ~35% of US pharma revenue is Medicare
  const estimatedMedicareSpend_M = peakSales_M * estimatedMedicareShare;

  if (estimatedMedicareSpend_M < 200) {
    return { eligible: false, negotiationYear: null, expectedPriceReduction_pct: 0 };
  }

  const exclusivityYears = isBiologic(modality) ? 13 : 9;
  // Assume approval in ~2028 for a typical asset under evaluation today
  const assumedApprovalYear = 2028;
  const negotiationYear = assumedApprovalYear + exclusivityYears;

  // Tiered expected reductions based on years post-approval at negotiation
  // Statutory caps: 75% of non-FAMP (9-12yr), 65% (12-16yr), 40% (16yr+)
  // In practice CBO estimates 25-60% reductions; early signals suggest ~40-55%
  let expectedReduction: number;
  if (isBiologic(modality)) {
    // Biologics face less aggressive negotiation due to biosimilar competition
    expectedReduction = 0.30;
  } else {
    // Small molecules face steeper reductions (more pricing history, generics)
    expectedReduction = 0.45;
  }

  // Higher-revenue drugs attract more aggressive negotiation
  if (estimatedMedicareSpend_M > 1_000) {
    expectedReduction += 0.10;
  } else if (estimatedMedicareSpend_M > 500) {
    expectedReduction += 0.05;
  }

  // Cap at statutory maximum
  expectedReduction = Math.min(expectedReduction, 0.60);

  return {
    eligible: true,
    negotiationYear,
    expectedPriceReduction_pct: Math.round(expectedReduction * 1000) / 1000,
  };
}

/**
 * Compute international reference pricing impact for a given territory.
 * If territory is 'us', IRP has no direct impact (US is the reference ceiling).
 * If territory is 'global', compute revenue-weighted average.
 */
function computeIRP(territory: string): InternationalReferencePricing {
  if (territory === 'us') {
    return {
      avgPriceVsUS: 1.0,
      territories: [{ territory: 'US', pricePctOfUS: 1.0 }],
    };
  }

  // For non-US or global, use full territory breakdown
  const territories = [...IRP_TERRITORY_INDICES];

  // Revenue-weight by approximate pharma market size shares (ex-US)
  const marketWeights: Record<string, number> = {
    Germany: 0.15,
    UK: 0.08,
    France: 0.10,
    Italy: 0.07,
    Spain: 0.05,
    Japan: 0.20,
    Canada: 0.08,
    Australia: 0.04,
    'South Korea': 0.05,
    China: 0.15,
    Brazil: 0.03,
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const t of territories) {
    const w = marketWeights[t.territory] ?? 0.05;
    weightedSum += t.pricePctOfUS * w;
    totalWeight += w;
  }

  const avgPriceVsUS = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 1000) / 1000
    : 0.50;

  return { avgPriceVsUS, territories };
}

/**
 * Determine formulary tier based on modality, cost, and indication.
 *
 * Specialty tier: biologics, gene therapies, cell therapies (>$10K/month)
 * Preferred brand: branded small molecules with established class (<$5K/month)
 * Non-preferred: me-too drugs without differentiation advantage
 * Restricted: narrow indications requiring prior auth + step therapy
 */
function determineFormularyTier(
  modality: string,
  annualCostOfTherapy: number,
  severity: DiseaseSeverity,
): FormularyTier {
  const monthlyCost = annualCostOfTherapy / 12;

  // Gene/cell therapies and high-cost biologics are always specialty tier
  if (
    modality.includes('geneTherapy') ||
    modality.includes('carT') ||
    modality === 'cellTherapy' ||
    modality === 'stemCell' ||
    modality === 'enzymeReplacement' ||
    monthlyCost > 10_000
  ) {
    return 'specialty';
  }

  // High-cost branded biologics
  if (isBiologic(modality) && monthlyCost > 3_000) {
    return 'specialty';
  }

  // Restricted for borderline cost-effectiveness in non-severe conditions
  if (monthlyCost > 5_000 && (severity === 'mild' || severity === 'moderate')) {
    return 'restricted';
  }

  // Standard branded drugs
  if (monthlyCost > 1_000) {
    return 'non_preferred';
  }

  return 'preferred_brand';
}

/**
 * Identify patient access barriers based on formulary tier, cost, and modality.
 */
function identifyAccessBarriers(
  formularyTier: FormularyTier,
  modality: string,
  annualCostOfTherapy: number,
  severity: DiseaseSeverity,
): string[] {
  const barriers: string[] = [];

  // Prior authorization is near-universal for specialty drugs
  if (formularyTier === 'specialty' || formularyTier === 'restricted') {
    barriers.push('Prior authorization required');
  }

  // Step therapy for non-first-line agents
  if (
    severity !== 'ultra_rare' &&
    severity !== 'ultra_rare_pediatric' &&
    annualCostOfTherapy > 50_000
  ) {
    barriers.push('Step therapy (must fail standard of care first)');
  }

  // Quantity limits for controlled or high-cost drugs
  if (annualCostOfTherapy > 100_000) {
    barriers.push('Quantity limits and refill restrictions');
  }

  // Site-of-care restrictions for infused biologics
  if (
    modality === 'mab' ||
    modality === 'adc' ||
    modality === 'bispecific' ||
    modality === 'intravitreal' ||
    modality === 'antiVegf'
  ) {
    barriers.push('Site-of-care restrictions (hospital/clinic only)');
  }

  // REMS for high-risk modalities
  if (
    modality.includes('carT') ||
    modality === 'geneTherapy' ||
    modality === 'geneTherapyRare' ||
    modality === 'geneTherapyOcular' ||
    modality === 'radiopharmaceutical'
  ) {
    barriers.push('REMS program enrollment required');
  }

  // Specialty pharmacy distribution
  if (formularyTier === 'specialty') {
    barriers.push('Specialty pharmacy distribution only');
  }

  // Co-pay accumulators for commercial plans
  if (annualCostOfTherapy > 20_000) {
    barriers.push('Co-pay accumulator/maximizer programs may limit patient assistance');
  }

  // Medical exception process for restricted tier
  if (formularyTier === 'restricted') {
    barriers.push('Medical exception or peer-to-peer review may be required');
  }

  return barriers;
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Compute comprehensive pricing and reimbursement constraints on a pharma
 * asset's valuation. Returns risk-adjusted peak sales adjustment and
 * detailed payer/access analysis.
 *
 * @param therapeuticArea - Therapeutic area key (e.g., 'oncology', 'rareDisease')
 * @param modality - Drug modality key (e.g., 'smallMolecule', 'mab', 'carT_heme')
 * @param indication - Clinical indication key (e.g., 'lung_nsclc', 'sma')
 * @param territory - Geographic territory ('us', 'eu5', 'japan', 'global', etc.)
 * @param peakSales_M - Projected peak annual sales in USD millions
 * @param annualCostOfTherapy - Annual cost of therapy per patient in USD
 */
export function computePricingConstraints(
  therapeuticArea: string,
  modality: string,
  indication: string,
  territory: string,
  peakSales_M: number,
  annualCostOfTherapy: number,
): PricingConstraintResult {
  // 1. Resolve disease severity and ICER threshold
  const severity = resolveSeverity(therapeuticArea, indication);
  const icerEntry = ICER_THRESHOLDS_BY_SEVERITY[severity];
  const icerThreshold = icerEntry.thresholdPerQALY;

  // 2. Assess ICER risk
  const icerRisk = assessICERRisk(annualCostOfTherapy, icerThreshold, severity);

  // 3. NICE recommendation
  const niceRecommendation = assessNICE(icerRisk, severity);

  // 4. IRA exposure
  const iraExposure = computeIRAExposure(modality, peakSales_M, territory);

  // 5. International reference pricing
  const internationalReferencePricing = computeIRP(territory);

  // 6. Payer mix
  const payerMixImpact = PAYER_MIX_BY_TA[therapeuticArea] ?? DEFAULT_PAYER_MIX;

  // 7. Formulary tier
  const formularyTier = determineFormularyTier(modality, annualCostOfTherapy, severity);

  // 8. Patient access barriers
  const patientAccessBarriers = identifyAccessBarriers(
    formularyTier,
    modality,
    annualCostOfTherapy,
    severity,
  );

  // 9. Compute net peak sales adjustment
  const peakSalesAdjustment_pct = computePeakSalesAdjustment({
    icerRisk,
    niceRecommendation,
    iraExposure,
    irpAvgVsUS: internationalReferencePricing.avgPriceVsUS,
    territory,
    formularyTier,
    barrierCount: patientAccessBarriers.length,
    payerMix: payerMixImpact,
  });

  // 10. Generate narrative
  const narrative = generateNarrative({
    therapeuticArea,
    modality,
    indication,
    territory,
    annualCostOfTherapy,
    peakSales_M,
    icerThreshold,
    icerRisk,
    niceRecommendation,
    iraExposure,
    peakSalesAdjustment_pct,
    formularyTier,
    barrierCount: patientAccessBarriers.length,
    severity,
  });

  return {
    icerThreshold,
    icerRisk,
    niceRecommendation,
    iraExposure,
    internationalReferencePricing,
    peakSalesAdjustment_pct,
    payerMixImpact,
    formularyTier,
    patientAccessBarriers,
    narrative,
  };
}

// ---------------------------------------------------------------------------
// Peak sales adjustment calculation
// ---------------------------------------------------------------------------

interface AdjustmentInputs {
  icerRisk: ICERRisk;
  niceRecommendation: NICERecommendation;
  iraExposure: IRAExposure;
  irpAvgVsUS: number;
  territory: string;
  formularyTier: FormularyTier;
  barrierCount: number;
  payerMix: PayerMixImpact;
}

/**
 * Compute the net reduction to peak sales from all pricing/access constraints.
 *
 * Each constraint contributes an independent haircut; combined via
 * multiplicative stacking (not additive) to avoid over-penalizing.
 *
 * Returns a negative percentage (e.g., -0.18 means 18% reduction).
 */
function computePeakSalesAdjustment(inputs: AdjustmentInputs): number {
  let retentionFactor = 1.0;

  // ICER risk haircut
  const icerHaircuts: Record<ICERRisk, number> = {
    favorable: 0.0,
    borderline: 0.06,
    unfavorable: 0.15,
  };
  retentionFactor *= 1 - icerHaircuts[inputs.icerRisk];

  // NICE recommendation haircut (applies to EU/global territories)
  if (inputs.territory !== 'us') {
    const niceHaircuts: Record<NICERecommendation, number> = {
      recommended: 0.0,
      optimized: 0.04,
      restricted: 0.10,
      not_recommended: 0.22,
    };
    retentionFactor *= 1 - niceHaircuts[inputs.niceRecommendation];
  }

  // IRA negotiation haircut (applies to US/global)
  if (inputs.iraExposure.eligible) {
    // Haircut is the expected reduction weighted by Medicare share
    const iraImpact = inputs.iraExposure.expectedPriceReduction_pct * inputs.payerMix.medicarePct;
    retentionFactor *= 1 - iraImpact;
  }

  // International reference pricing drag for non-US territories
  if (inputs.territory !== 'us' && inputs.irpAvgVsUS < 0.8) {
    const irpDrag = (0.8 - inputs.irpAvgVsUS) * 0.5; // half the gap translates to sales impact
    retentionFactor *= 1 - irpDrag;
  }

  // Formulary tier drag
  const tierHaircuts: Record<FormularyTier, number> = {
    preferred_brand: 0.0,
    specialty: 0.03,
    non_preferred: 0.07,
    restricted: 0.14,
  };
  retentionFactor *= 1 - tierHaircuts[inputs.formularyTier];

  // Access barrier drag (each barrier ~1.5% drag, capped at 10%)
  const barrierDrag = Math.min(inputs.barrierCount * 0.015, 0.10);
  retentionFactor *= 1 - barrierDrag;

  // Medicaid best-price drag (if high Medicaid share)
  if (inputs.payerMix.medicaidPct > 0.15) {
    retentionFactor *= 1 - 0.03;
  }

  const adjustment = Math.round((retentionFactor - 1) * 10000) / 10000;
  return adjustment;
}

// ---------------------------------------------------------------------------
// Narrative generation
// ---------------------------------------------------------------------------

interface NarrativeInputs {
  therapeuticArea: string;
  modality: string;
  indication: string;
  territory: string;
  annualCostOfTherapy: number;
  peakSales_M: number;
  icerThreshold: number;
  icerRisk: ICERRisk;
  niceRecommendation: NICERecommendation;
  iraExposure: IRAExposure;
  peakSalesAdjustment_pct: number;
  formularyTier: FormularyTier;
  barrierCount: number;
  severity: DiseaseSeverity;
}

function generateNarrative(n: NarrativeInputs): string {
  const costStr = n.annualCostOfTherapy >= 1_000_000
    ? `$${(n.annualCostOfTherapy / 1_000_000).toFixed(1)}M`
    : `$${(n.annualCostOfTherapy / 1_000).toFixed(0)}K`;

  const adjustmentStr = n.peakSalesAdjustment_pct < 0
    ? `${(n.peakSalesAdjustment_pct * 100).toFixed(1)}%`
    : 'no';

  const parts: string[] = [];

  // Opening
  parts.push(
    `At ${costStr}/year, this ${n.modality} in ${n.indication} (${n.therapeuticArea}) faces ` +
    `${n.icerRisk} cost-effectiveness risk against a $${(n.icerThreshold / 1000).toFixed(0)}K/QALY threshold.`,
  );

  // NICE
  if (n.territory !== 'us') {
    const niceLabels: Record<NICERecommendation, string> = {
      recommended: 'a positive NICE recommendation',
      optimized: 'NICE recommendation with managed access arrangements',
      restricted: 'a restricted NICE recommendation (limited subpopulations)',
      not_recommended: 'NICE non-recommendation, requiring commercial negotiations',
    };
    parts.push(`UK market access: expect ${niceLabels[n.niceRecommendation]}.`);
  }

  // IRA
  if (n.iraExposure.eligible) {
    parts.push(
      `IRA exposure: eligible for Medicare price negotiation in ${n.iraExposure.negotiationYear}, ` +
      `with expected ${(n.iraExposure.expectedPriceReduction_pct * 100).toFixed(0)}% price reduction ` +
      `on the Medicare segment.`,
    );
  } else if (n.territory === 'us' || n.territory === 'global') {
    parts.push('IRA: not currently projected to trigger Medicare negotiation eligibility.');
  }

  // Formulary
  const tierLabels: Record<FormularyTier, string> = {
    specialty: 'specialty tier with associated co-pay and distribution constraints',
    preferred_brand: 'preferred brand tier with moderate co-pay',
    non_preferred: 'non-preferred tier with higher patient cost-sharing',
    restricted: 'restricted formulary access requiring clinical justification',
  };
  parts.push(`Formulary: ${tierLabels[n.formularyTier]}.`);

  // Access barriers
  if (n.barrierCount > 0) {
    parts.push(`${n.barrierCount} patient access barrier${n.barrierCount > 1 ? 's' : ''} identified.`);
  }

  // Bottom line
  parts.push(
    `Net pricing/access adjustment: ${adjustmentStr} reduction to peak sales ` +
    `($${n.peakSales_M.toFixed(0)}M projected).`,
  );

  return parts.join(' ');
}
