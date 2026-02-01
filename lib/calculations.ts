import benchmarks from '@/data/benchmarks.json';

// Phase types
export type Phase = 'preclinical' | 'phase1' | 'phase2' | 'phase3' | 'approved';

// Modality types (17 options)
export type Modality =
  | 'smallMolecule' | 'mab' | 'adc' | 'bispecific' | 'tCellEngager'
  | 'carT_heme' | 'carT_solid' | 'cellTherapy' | 'geneTherapy'
  | 'radiopharmaceutical' | 'mrna' | 'rnai' | 'protac'
  | 'molecularGlue' | 'peptide' | 'therapeuticVaccine' | 'oncolyticVirus';

// Indication types
export type SolidTumorIndication =
  | 'lung_nsclc' | 'lung_sclc' | 'breast_her2' | 'breast_tnbc' | 'breast_hr'
  | 'colorectal' | 'pancreatic' | 'melanoma' | 'prostate' | 'ovarian'
  | 'gastric' | 'liver' | 'renal' | 'gbm' | 'bladder' | 'headNeck'
  | 'cholangiocarcinoma' | 'mesothelioma' | 'sarcoma';

export type HematologicIndication =
  | 'aml' | 'all' | 'cll' | 'myeloma' | 'dlbcl' | 'follicular'
  | 'mantleCell' | 'mds' | 'mpn' | 'tCellLymphoma';

export type Indication = SolidTumorIndication | HematologicIndication;

// Territory types (9 options)
export type Territory =
  | 'global' | 'us_only' | 'ex_us' | 'europe' | 'china'
  | 'japan' | 'row' | 'us_eu' | 'us_japan';

// New multiplier types
export type BiomarkerStatus = 'selected' | 'unselected';
export type LineOfTherapy = '1L' | '2L' | '3L+';
export type CombinationPotential = 'strong' | 'some' | 'standalone';
export type CompetitivePosition = 'firstInClass' | 'firstToPivotal' | 'bestInClass' | 'racing' | 'behind' | 'crowded';
export type DataQuality = 'pivotalReady' | 'strongPhase2' | 'promising' | 'mixed' | 'limited';

export interface RegulatoryDesignations {
  breakthrough: boolean;
  fastTrack: boolean;
  orphan: boolean;
  prime: boolean;
}

// Output types
export interface DealTerms {
  upfront: { low: number; median: number; high: number };
  devMilestones: { low: number; median: number; high: number };
  regMilestones: { low: number; median: number; high: number };
  commMilestones: { low: number; median: number; high: number };
  totalDealValue: { low: number; median: number; high: number };
}

export interface TieredRoyalties {
  base: { low: number; high: number };
  midTier: { low: number; high: number };
  highTier: { low: number; high: number };
}

export interface DealRecommendation {
  upfrontPercent: number;
  milestonePercent: number;
  rationale: string;
}

export interface CalculationInput {
  phase: Phase;
  modality: Modality;
  indication: Indication;
  territory: Territory;
  biomarker: BiomarkerStatus;
  lineOfTherapy: LineOfTherapy;
  combinationPotential: CombinationPotential;
  competitivePosition: CompetitivePosition;
  dataQuality: DataQuality;
  regulatoryDesignations: RegulatoryDesignations;
}

export interface CalculationResult {
  terms: DealTerms;
  tieredRoyalties: TieredRoyalties;
  dealRecommendation: DealRecommendation;
  negotiationInsight: string;
  modifiers: { name: string; multiplier: number }[];
  labels: {
    phase: string;
    modality: string;
    indication: string;
  };
}

// Helper to get indication category
function getIndicationCategory(indication: Indication): 'solidTumor' | 'hematologic' {
  const solidTumors: SolidTumorIndication[] = [
    'lung_nsclc', 'lung_sclc', 'breast_her2', 'breast_tnbc', 'breast_hr',
    'colorectal', 'pancreatic', 'melanoma', 'prostate', 'ovarian',
    'gastric', 'liver', 'renal', 'gbm', 'bladder', 'headNeck',
    'cholangiocarcinoma', 'mesothelioma', 'sarcoma'
  ];
  return solidTumors.includes(indication as SolidTumorIndication) ? 'solidTumor' : 'hematologic';
}

// Calculate risk score (0-100, higher = more risk)
function calculateRiskScore(input: CalculationInput): number {
  let score = 0;

  // Phase risk (earlier = more risk)
  const phaseRisk: Record<Phase, number> = {
    preclinical: 40,
    phase1: 30,
    phase2: 20,
    phase3: 10,
    approved: 0
  };
  score += phaseRisk[input.phase];

  // Competitive position risk
  const competitiveRisk: Record<CompetitivePosition, number> = {
    firstInClass: 0,
    firstToPivotal: 5,
    bestInClass: 10,
    racing: 20,
    behind: 30,
    crowded: 40
  };
  score += competitiveRisk[input.competitivePosition];

  // Data quality risk
  const dataRisk: Record<DataQuality, number> = {
    pivotalReady: 0,
    strongPhase2: 5,
    promising: 10,
    mixed: 15,
    limited: 20
  };
  score += dataRisk[input.dataQuality];

  return Math.min(score, 100);
}

// Get negotiation insight based on inputs
function getNegotiationInsight(input: CalculationInput): string {
  const insights = benchmarks.marketContext.negotiationInsights;

  // Priority order: modality > line of therapy > competitive > territory > data quality

  // Modality insights
  const modalityInsights = insights.modality as Record<string, string>;
  if (modalityInsights[input.modality]) {
    return modalityInsights[input.modality];
  }

  // Line of therapy insights
  const lotInsights = insights.lineOfTherapy as Record<string, string>;
  if (lotInsights[input.lineOfTherapy]) {
    return lotInsights[input.lineOfTherapy];
  }

  // Competitive position insights
  const compInsights = insights.competitivePosition as Record<string, string>;
  if (compInsights[input.competitivePosition]) {
    return compInsights[input.competitivePosition];
  }

  // Territory insights
  const territoryInsights = insights.territory as Record<string, string>;
  if (input.territory === 'china' && territoryInsights.china) {
    return territoryInsights.china;
  }
  if (input.territory === 'europe' && territoryInsights.europe) {
    return territoryInsights.europe;
  }

  // Data quality insights
  const dataInsights = insights.dataQuality as Record<string, string>;
  if (dataInsights[input.dataQuality]) {
    return dataInsights[input.dataQuality];
  }

  // Default insight
  return "Consider recent comparable deals in your negotiation strategy.";
}

export function calculateDealTerms(input: CalculationInput): CalculationResult {
  const modifiers: { name: string; multiplier: number }[] = [];

  // Get phase baselines
  const phaseBaseline = benchmarks.phaseBaselines[input.phase];
  const phaseConfig = benchmarks.phaseConfig;

  // Get multipliers from benchmarks
  const modalityData = benchmarks.modalities[input.modality];
  const modalityMultiplier = modalityData?.multiplier ?? 1.0;
  modifiers.push({ name: modalityData?.label ?? input.modality, multiplier: modalityMultiplier });

  // Get indication multiplier
  const category = getIndicationCategory(input.indication);
  const indicationsCategory = benchmarks.indications[category] as Record<string, { multiplier: number; label: string }>;
  const indicationData = indicationsCategory[input.indication];
  const indicationMultiplier = indicationData?.multiplier ?? 1.0;
  modifiers.push({ name: indicationData?.label ?? input.indication, multiplier: indicationMultiplier });

  // Get territory multiplier
  const territoryData = benchmarks.territories[input.territory];
  const territoryMultiplier = territoryData?.multiplier ?? 1.0;
  modifiers.push({ name: territoryData?.label ?? input.territory, multiplier: territoryMultiplier });

  // Get biomarker multiplier
  const biomarkerData = benchmarks.multiplierConfig.biomarker[input.biomarker];
  const biomarkerMultiplier = biomarkerData?.multiplier ?? 1.0;
  if (biomarkerMultiplier !== 1.0) {
    modifiers.push({ name: biomarkerData?.label ?? input.biomarker, multiplier: biomarkerMultiplier });
  }

  // Get line of therapy multiplier
  const lotData = benchmarks.multiplierConfig.lineOfTherapy[input.lineOfTherapy];
  const lotMultiplier = lotData?.multiplier ?? 1.0;
  if (lotMultiplier !== 1.0) {
    modifiers.push({ name: lotData?.label ?? input.lineOfTherapy, multiplier: lotMultiplier });
  }

  // Get combination potential multiplier
  const comboData = benchmarks.multiplierConfig.combinationPotential[input.combinationPotential];
  const comboMultiplier = comboData?.multiplier ?? 1.0;
  if (comboMultiplier !== 1.0) {
    modifiers.push({ name: comboData?.label ?? input.combinationPotential, multiplier: comboMultiplier });
  }

  // Get competitive position multiplier
  const compData = benchmarks.multiplierConfig.competitivePosition[input.competitivePosition];
  const competitiveMultiplier = compData?.multiplier ?? 1.0;
  if (competitiveMultiplier !== 1.0) {
    modifiers.push({ name: compData?.label ?? input.competitivePosition, multiplier: competitiveMultiplier });
  }

  // Get data quality multiplier
  const dataData = benchmarks.multiplierConfig.dataQuality[input.dataQuality];
  const dataQualityMultiplier = dataData?.multiplier ?? 1.0;
  if (dataQualityMultiplier !== 1.0) {
    modifiers.push({ name: dataData?.label ?? input.dataQuality, multiplier: dataQualityMultiplier });
  }

  // Calculate regulatory bonus (additive, capped at 20%)
  const regConfig = benchmarks.multiplierConfig.regulatoryDesignations;
  let regulatoryBonus = 0;
  if (input.regulatoryDesignations.breakthrough) {
    regulatoryBonus += regConfig.breakthrough.bonus;
    modifiers.push({ name: regConfig.breakthrough.label, multiplier: 1 + regConfig.breakthrough.bonus });
  }
  if (input.regulatoryDesignations.fastTrack) {
    regulatoryBonus += regConfig.fastTrack.bonus;
    modifiers.push({ name: regConfig.fastTrack.label, multiplier: 1 + regConfig.fastTrack.bonus });
  }
  if (input.regulatoryDesignations.orphan) {
    regulatoryBonus += regConfig.orphan.bonus;
    modifiers.push({ name: regConfig.orphan.label, multiplier: 1 + regConfig.orphan.bonus });
  }
  if (input.regulatoryDesignations.prime) {
    regulatoryBonus += regConfig.prime.bonus;
    modifiers.push({ name: regConfig.prime.label, multiplier: 1 + regConfig.prime.bonus });
  }
  regulatoryBonus = Math.min(regulatoryBonus, regConfig.maxBonus);

  // Apply diminishing multiplier stacking
  // modality^1.0 × indication^0.8 × territory^1.0 × competitive^0.7 × dataQuality^0.5
  const effectiveMultiplier =
    Math.pow(modalityMultiplier, 1.0) *
    Math.pow(indicationMultiplier, 0.8) *
    Math.pow(biomarkerMultiplier, 0.9) *
    Math.pow(lotMultiplier, 0.85) *
    Math.pow(comboMultiplier, 0.75) *
    Math.pow(territoryMultiplier, 1.0) *
    Math.pow(competitiveMultiplier, 0.7) *
    Math.pow(dataQualityMultiplier, 0.5) *
    (1 + regulatoryBonus);

  // Calculate total deal value
  const baseTotalValue = phaseBaseline.totalValue;
  const rangeWidth = phaseConfig.rangeWidths[input.phase];

  const adjustedMedian = Math.round(baseTotalValue.median * effectiveMultiplier);
  const totalDealValue = {
    low: Math.round(adjustedMedian * (1 - rangeWidth)),
    median: adjustedMedian,
    high: Math.round(adjustedMedian * (1 + rangeWidth))
  };

  // Calculate upfront based on phase ratios
  const upfrontRatios = phaseConfig.upfrontRatios[input.phase];
  const riskScore = calculateRiskScore(input);
  // Higher risk = lower upfront ratio (toward low end)
  const riskFactor = riskScore / 100; // 0 to 1
  const upfrontRatioLow = upfrontRatios.low + (upfrontRatios.high - upfrontRatios.low) * (1 - riskFactor);
  const upfrontRatioHigh = upfrontRatios.low + (upfrontRatios.high - upfrontRatios.low) * (1 - riskFactor * 0.5);

  const upfront = {
    low: Math.round(totalDealValue.low * upfrontRatios.low),
    median: Math.round(totalDealValue.median * (upfrontRatioLow + upfrontRatioHigh) / 2),
    high: Math.round(totalDealValue.high * upfrontRatios.high)
  };

  // Calculate milestone allocations
  const milestoneAlloc = phaseConfig.milestoneAllocations[input.phase];
  const totalMilestones = {
    low: totalDealValue.low - upfront.low,
    median: totalDealValue.median - upfront.median,
    high: totalDealValue.high - upfront.high
  };

  const devMilestones = {
    low: Math.round(totalMilestones.low * milestoneAlloc.dev),
    median: Math.round(totalMilestones.median * milestoneAlloc.dev),
    high: Math.round(totalMilestones.high * milestoneAlloc.dev)
  };

  const regMilestones = {
    low: Math.round(totalMilestones.low * milestoneAlloc.reg),
    median: Math.round(totalMilestones.median * milestoneAlloc.reg),
    high: Math.round(totalMilestones.high * milestoneAlloc.reg)
  };

  const commMilestones = {
    low: Math.round(totalMilestones.low * milestoneAlloc.comm),
    median: Math.round(totalMilestones.median * milestoneAlloc.comm),
    high: Math.round(totalMilestones.high * milestoneAlloc.comm)
  };

  // Calculate tiered royalties
  const baseRoyalty = phaseBaseline.royalty;
  const royaltyMultiplier = Math.pow(effectiveMultiplier, 0.3); // Dampened effect on royalties

  const baseLow = Math.round(baseRoyalty.base * royaltyMultiplier * 10) / 10;
  const baseHigh = Math.round(baseRoyalty.max * royaltyMultiplier * 10) / 10;

  const tieredRoyalties: TieredRoyalties = {
    base: {
      low: Math.min(baseLow, 25),
      high: Math.min(baseHigh, 30)
    },
    midTier: {
      low: Math.min(baseLow + 2, 28),
      high: Math.min(baseHigh + 2, 33)
    },
    highTier: {
      low: Math.min(baseLow + 4, 30),
      high: Math.min(baseHigh + 4, 35)
    }
  };

  // Calculate deal recommendation
  const recommendedUpfrontPercent = Math.round((upfrontRatioLow + upfrontRatioHigh) / 2 * 100);
  const dealRecommendation: DealRecommendation = {
    upfrontPercent: recommendedUpfrontPercent,
    milestonePercent: 100 - recommendedUpfrontPercent,
    rationale: generateRationale(input, riskScore)
  };

  // Get negotiation insight
  const negotiationInsight = getNegotiationInsight(input);

  // Get labels
  const labels = benchmarks.labels;

  return {
    terms: {
      upfront,
      devMilestones,
      regMilestones,
      commMilestones,
      totalDealValue
    },
    tieredRoyalties,
    dealRecommendation,
    negotiationInsight,
    modifiers,
    labels: {
      phase: labels.phases[input.phase],
      modality: modalityData?.label ?? input.modality,
      indication: indicationData?.label ?? input.indication
    }
  };
}

function generateRationale(input: CalculationInput, riskScore: number): string {
  const phaseLabel = benchmarks.labels.phases[input.phase];

  if (riskScore < 25) {
    return `De-risked ${phaseLabel} asset with strong competitive position justifies higher upfront.`;
  } else if (riskScore < 50) {
    return `${phaseLabel} asset with moderate risk profile. Balanced upfront/milestone structure recommended.`;
  } else if (riskScore < 75) {
    return `Earlier-stage asset with competitive uncertainty. Milestone-weighted structure protects both parties.`;
  } else {
    return `High-risk profile suggests lower upfront with significant milestone potential tied to de-risking events.`;
  }
}

export function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value}M`;
}

export function formatRange(range: { low: number; median: number; high: number }): string {
  return `${formatCurrency(range.low)} - ${formatCurrency(range.high)}`;
}

// Option arrays for dropdowns
export const phaseOptions = [
  { value: 'preclinical', label: 'Preclinical (IND-enabling)' },
  { value: 'phase1', label: 'Phase 1' },
  { value: 'phase2', label: 'Phase 2' },
  { value: 'phase3', label: 'Phase 3' },
  { value: 'approved', label: 'Approved / NDA Filed' },
];

export const modalityOptions = [
  { group: 'Small Molecules', options: [
    { value: 'smallMolecule', label: 'Small Molecule' },
    { value: 'protac', label: 'PROTAC / Degrader' },
    { value: 'molecularGlue', label: 'Molecular Glue' },
  ]},
  { group: 'Antibodies', options: [
    { value: 'mab', label: 'Monoclonal Antibody (naked)' },
    { value: 'adc', label: 'Antibody-Drug Conjugate (ADC)' },
    { value: 'bispecific', label: 'Bispecific Antibody' },
    { value: 'tCellEngager', label: 'T-cell Engager (non-bispecific)' },
  ]},
  { group: 'Cell & Gene Therapy', options: [
    { value: 'carT_heme', label: 'CAR-T (Hematologic)' },
    { value: 'carT_solid', label: 'CAR-T (Solid Tumor)' },
    { value: 'cellTherapy', label: 'Cell Therapy (non-CAR-T)' },
    { value: 'geneTherapy', label: 'Gene Therapy / Gene Editing' },
  ]},
  { group: 'RNA & Vaccines', options: [
    { value: 'mrna', label: 'mRNA (Oncology Vaccine)' },
    { value: 'rnai', label: 'RNAi / siRNA' },
    { value: 'therapeuticVaccine', label: 'Therapeutic Vaccine (non-mRNA)' },
  ]},
  { group: 'Other', options: [
    { value: 'radiopharmaceutical', label: 'Radiopharmaceutical' },
    { value: 'peptide', label: 'Peptide' },
    { value: 'oncolyticVirus', label: 'Oncolytic Virus' },
  ]},
];

export const indicationOptions = [
  { group: 'Solid Tumors', options: [
    { value: 'lung_nsclc', label: 'Lung (NSCLC)' },
    { value: 'lung_sclc', label: 'Lung (SCLC)' },
    { value: 'breast_her2', label: 'Breast (HER2+)' },
    { value: 'breast_tnbc', label: 'Breast (TNBC)' },
    { value: 'breast_hr', label: 'Breast (HR+)' },
    { value: 'colorectal', label: 'Colorectal' },
    { value: 'pancreatic', label: 'Pancreatic' },
    { value: 'melanoma', label: 'Melanoma' },
    { value: 'prostate', label: 'Prostate (mCRPC)' },
    { value: 'ovarian', label: 'Ovarian' },
    { value: 'gastric', label: 'Gastric / GEJ' },
    { value: 'liver', label: 'HCC (Liver)' },
    { value: 'renal', label: 'Renal (RCC)' },
    { value: 'gbm', label: 'GBM (Brain)' },
    { value: 'bladder', label: 'Bladder' },
    { value: 'headNeck', label: 'Head & Neck' },
    { value: 'cholangiocarcinoma', label: 'Cholangiocarcinoma' },
    { value: 'mesothelioma', label: 'Mesothelioma' },
    { value: 'sarcoma', label: 'Sarcoma' },
  ]},
  { group: 'Hematologic Malignancies', options: [
    { value: 'aml', label: 'AML' },
    { value: 'all', label: 'ALL' },
    { value: 'cll', label: 'CLL' },
    { value: 'myeloma', label: 'Multiple Myeloma' },
    { value: 'dlbcl', label: 'DLBCL' },
    { value: 'follicular', label: 'Follicular Lymphoma' },
    { value: 'mantleCell', label: 'Mantle Cell Lymphoma' },
    { value: 'mds', label: 'MDS' },
    { value: 'mpn', label: 'MPN' },
    { value: 'tCellLymphoma', label: 'T-cell Lymphomas' },
  ]},
];

export const territoryOptions = [
  { value: 'global', label: 'Global' },
  { value: 'us_only', label: 'US Only' },
  { value: 'ex_us', label: 'Ex-US (All)' },
  { value: 'us_eu', label: 'US + Europe' },
  { value: 'us_japan', label: 'US + Japan' },
  { value: 'europe', label: 'Europe Only' },
  { value: 'japan', label: 'Japan' },
  { value: 'china', label: 'Greater China' },
  { value: 'row', label: 'Rest of World' },
];

export const biomarkerOptions = [
  { value: 'selected', label: 'Biomarker-selected' },
  { value: 'unselected', label: 'Broad / Unselected' },
];

export const lineOfTherapyOptions = [
  { value: '1L', label: 'First-line (1L)' },
  { value: '2L', label: 'Second-line (2L)' },
  { value: '3L+', label: 'Third-line+ (3L+)' },
];

export const combinationPotentialOptions = [
  { value: 'strong', label: 'Strong combo backbone potential' },
  { value: 'some', label: 'Some combo potential' },
  { value: 'standalone', label: 'Standalone only' },
];

export const competitivePositionOptions = [
  { value: 'firstInClass', label: 'First-in-class, no competition' },
  { value: 'firstToPivotal', label: 'First to pivotal trial' },
  { value: 'bestInClass', label: 'Best-in-class potential' },
  { value: 'racing', label: 'Racing with 1-2 others' },
  { value: 'behind', label: 'Behind 3+ competitors' },
  { value: 'crowded', label: 'Crowded with approved drugs' },
];

export const dataQualityOptions = [
  { value: 'pivotalReady', label: 'Pivotal-ready data' },
  { value: 'strongPhase2', label: 'Strong Phase 2 (clear signal)' },
  { value: 'promising', label: 'Promising early data' },
  { value: 'mixed', label: 'Mixed / inconsistent results' },
  { value: 'limited', label: 'Limited data' },
];

export const regulatoryDesignationOptions = [
  { value: 'breakthrough', label: 'Breakthrough Therapy' },
  { value: 'fastTrack', label: 'Fast Track' },
  { value: 'orphan', label: 'Orphan Drug' },
  { value: 'prime', label: 'PRIME (EU)' },
];
