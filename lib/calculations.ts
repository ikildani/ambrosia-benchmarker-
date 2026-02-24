import { getBenchmarksSync } from '@/lib/benchmarks';

// Live-calibrated benchmarks (merges static JSON with DB-driven calibrations)
const benchmarks = getBenchmarksSync();

// Therapeutic area type
export type TherapeuticArea = 'oncology' | 'neurology' | 'immunology' | 'metabolic';

// Phase types
export type Phase = 'preclinical' | 'phase1' | 'phase2' | 'phase3' | 'approved';

// Modality types (17 oncology + 6 neurology = 23 options)
export type Modality =
  | 'smallMolecule' | 'mab' | 'adc' | 'bispecific' | 'tCellEngager'
  | 'carT_heme' | 'carT_solid' | 'cellTherapy' | 'geneTherapy'
  | 'radiopharmaceutical' | 'mrna' | 'rnai' | 'protac'
  | 'molecularGlue' | 'peptide' | 'therapeuticVaccine' | 'oncolyticVirus'
  | 'bbbPlatform' | 'aso' | 'psychedelic'
  | 'ionChannel' | 'tauTargeting' | 'stemCell'
  | 'oligonucleotide'
  | 'carT_autoimmune' | 'inVivoCarT' | 'carTreg'
  | 'fcrnAntagonist' | 'complementInhibitor' | 'jakInhibitor'
  | 's1pModulator' | 'oralIntegrin' | 'dualAntagonist' | 'tl1aInhibitor'
  // Metabolic-specific modalities
  | 'glp1Agonist' | 'dualIncretin' | 'tripleIncretin'
  | 'sglt2Inhibitor' | 'amylinAnalog' | 'oralPeptide'
  | 'antiActivin' | 'microbiomeBased';

// Indication types
export type SolidTumorIndication =
  | 'lung_nsclc' | 'lung_sclc' | 'breast_her2' | 'breast_tnbc' | 'breast_hr'
  | 'colorectal' | 'pancreatic' | 'melanoma' | 'prostate' | 'ovarian'
  | 'gastric' | 'liver' | 'renal' | 'gbm' | 'bladder' | 'headNeck'
  | 'cholangiocarcinoma' | 'mesothelioma' | 'sarcoma'
  | 'endometrial' | 'cervical' | 'thyroid' | 'esophageal' | 'smallBowel';

export type HematologicIndication =
  | 'aml' | 'all' | 'cll' | 'myeloma' | 'dlbcl' | 'follicular'
  | 'mantleCell' | 'mds' | 'mpn' | 'tCellLymphoma'
  | 'cml' | 'waldenstrom' | 'hodgkins';

export type NeurologyIndication =
  | 'alzheimers' | 'parkinsons' | 'schizophrenia' | 'depression'
  | 'als' | 'huntingtons' | 'migraine' | 'narcolepsy'
  | 'pain' | 'ms' | 'epilepsy' | 'tremor' | 'tbi' | 'addiction'
  | 'rareNeuro'
  | 'bipolar' | 'ptsd' | 'ocd'
  | 'autism' | 'rett' | 'friedreichs' | 'dmd'
  | 'chronicPain';

export type ImmunologyIndication =
  | 'rheumatoidArthritis' | 'sle_lupus' | 'lupusNephritis'
  | 'atopicderm' | 'psoriasis' | 'psoriaticArthritis'
  | 'ulcerativeColitis' | 'crohns' | 'ibd_broad'
  | 'myastheniaGravis' | 'multipleSclerosisMod'
  | 'igan' | 'aancaVasculitis'
  | 'systemicSclerosis' | 'sjogrens'
  | 'alopecia' | 'hidradenitis'
  | 'pnh' | 'cidp'
  | 'rareAutoimmune'
  | 'celiac' | 'vitiligo' | 'pemphigus' | 'itp'
  | 'asthma' | 'eosinophilicEsophagitis'
  | 'gvhd' | 'organTransplant'
  | 'thyroidEye' | 'pbc';

export type MetabolicIndication =
  | 'obesity' | 'type2Diabetes' | 'nashMash'
  | 'metabolicSyndrome' | 'lipodystrophy'
  | 'glycogenStorage' | 'pku'
  | 'rareMetabolic'
  | 'type1Diabetes' | 'ckdMetabolic'
  | 'hfpef' | 'familialHypercholesterolemia'
  | 'gout' | 'wilsonDisease' | 'fabry' | 'gaucher';

export type Indication = SolidTumorIndication | HematologicIndication | NeurologyIndication | ImmunologyIndication | MetabolicIndication;

// Territory types (9 options)
export type Territory =
  | 'global' | 'us_only' | 'ex_us' | 'europe' | 'china'
  | 'japan' | 'row' | 'us_eu' | 'us_japan';

// New multiplier types
export type BiomarkerStatus = 'selected' | 'unselected';
export type LineOfTherapy = '1L' | '2L' | '3L+';
export type TreatmentApproach = 'diseaseModifying' | 'symptomatic' | 'adjunctive';
export type CombinationPotential = 'strong' | 'some' | 'standalone';
export type CompetitivePosition = 'firstInClass' | 'firstToPivotal' | 'bestInClass' | 'racing' | 'behind' | 'crowded';
export type DataQuality = 'pivotalReady' | 'strongPhase2' | 'promising' | 'mixed' | 'limited';

// Neurology-specific types
export type BBBPenetration = 'provenCNS' | 'promisingPreclinical' | 'unproven' | 'peripheralOnly';
export type DiseaseProgression = 'slowProgressive' | 'moderateProgressive' | 'rapidProgressive' | 'episodic';
export type BiomarkerValidation = 'validatedSurrogate' | 'exploratory' | 'noBiomarker';

// Immunology-specific types
export type ImmuneResetPotential = 'curativeIntent' | 'durableRemission' | 'chronicTreatment';
export type TargetSpecificity = 'antigenSpecific' | 'pathwayTargeted' | 'broadImmunosuppression';
export type DiseaseSeverity = 'mildModerate' | 'moderateSevere' | 'severe' | 'refractory';
export type ImmunologyTreatmentGoal = 'remissionInduction' | 'maintenance' | 'flareControl';

// Metabolic-specific types
export type MechanismDifferentiation = 'incretinBased' | 'nonIncretin' | 'combinationMechanism';
export type WeightLossEfficacy = 'superiorEfficacy' | 'competitiveEfficacy' | 'modestEfficacy';
export type RouteOfAdministration = 'oral' | 'injectable' | 'implantable';
export type ComorbidityBreadth = 'cardiometabolicBenefit' | 'obesityPrimary' | 'organProtective';
export type MetabolicTreatmentApproach = 'chronicWeightMgmt' | 'glycemicControl' | 'organProtective' | 'metabolicReset';

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
  therapeuticArea: TherapeuticArea;
  phase: Phase;
  modality: Modality;
  indication: Indication;
  territory: Territory;
  biomarker: BiomarkerStatus;
  lineOfTherapy: LineOfTherapy;
  treatmentApproach: TreatmentApproach;
  combinationPotential: CombinationPotential;
  competitivePosition: CompetitivePosition;
  dataQuality: DataQuality;
  regulatoryDesignations: RegulatoryDesignations;
  // Neurology-specific optional fields
  bbbPenetration?: BBBPenetration;
  diseaseProgression?: DiseaseProgression;
  biomarkerValidation?: BiomarkerValidation;
  // Immunology-specific optional fields
  immuneResetPotential?: ImmuneResetPotential;
  targetSpecificity?: TargetSpecificity;
  diseaseSeverity?: DiseaseSeverity;
  treatmentGoal?: ImmunologyTreatmentGoal;
  // Metabolic-specific optional fields
  mechanismDifferentiation?: MechanismDifferentiation;
  weightLossEfficacy?: WeightLossEfficacy;
  routeOfAdministration?: RouteOfAdministration;
  comorbidityBreadth?: ComorbidityBreadth;
  metabolicTreatmentApproach?: MetabolicTreatmentApproach;
}

// Drill-down data for expanded metric views
export interface MilestoneBreakdown {
  label: string;
  percentage: number;
  value: { low: number; median: number; high: number };
}

export interface FactorImpact {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  percentage: number;
}

export interface DrillDownData {
  rangeExplanation: string;
  rangeWidthPercent: number;
  factors: FactorImpact[];
  breakdown?: MilestoneBreakdown[];
}

export interface DrillDownCollection {
  upfront: DrillDownData;
  totalDealValue: DrillDownData;
  devMilestones: DrillDownData;
  regMilestones: DrillDownData;
  commMilestones: DrillDownData;
  royalties: DrillDownData;
}

export interface CalculationResult {
  terms: DealTerms;
  tieredRoyalties: TieredRoyalties;
  dealRecommendation: DealRecommendation;
  negotiationInsight: string;
  modifiers: { name: string; multiplier: number; context?: string }[];
  labels: {
    phase: string;
    modality: string;
    indication: string;
  };
  drillDown: DrillDownCollection;
  phase: Phase;
  milestoneExplanation?: string;
}

// Helper to get indication category
function getIndicationCategory(indication: Indication): 'solidTumor' | 'hematologic' | 'neurology' | 'immunology' | 'metabolic' {
  const solidTumors: SolidTumorIndication[] = [
    'lung_nsclc', 'lung_sclc', 'breast_her2', 'breast_tnbc', 'breast_hr',
    'colorectal', 'pancreatic', 'melanoma', 'prostate', 'ovarian',
    'gastric', 'liver', 'renal', 'gbm', 'bladder', 'headNeck',
    'cholangiocarcinoma', 'mesothelioma', 'sarcoma',
    'endometrial', 'cervical', 'thyroid', 'esophageal', 'smallBowel'
  ];
  const neurologyIndications: NeurologyIndication[] = [
    'alzheimers', 'parkinsons', 'schizophrenia', 'depression',
    'als', 'huntingtons', 'migraine', 'narcolepsy',
    'pain', 'ms', 'epilepsy', 'tremor', 'tbi', 'addiction',
    'rareNeuro',
    'bipolar', 'ptsd', 'ocd',
    'autism', 'rett', 'friedreichs', 'dmd',
    'chronicPain'
  ];
  const immunologyIndications: ImmunologyIndication[] = [
    'rheumatoidArthritis', 'sle_lupus', 'lupusNephritis',
    'atopicderm', 'psoriasis', 'psoriaticArthritis',
    'ulcerativeColitis', 'crohns', 'ibd_broad',
    'myastheniaGravis', 'multipleSclerosisMod',
    'igan', 'aancaVasculitis',
    'systemicSclerosis', 'sjogrens',
    'alopecia', 'hidradenitis',
    'pnh', 'cidp',
    'rareAutoimmune',
    'celiac', 'vitiligo', 'pemphigus', 'itp',
    'asthma', 'eosinophilicEsophagitis',
    'gvhd', 'organTransplant',
    'thyroidEye', 'pbc'
  ];
  const metabolicIndications: MetabolicIndication[] = [
    'obesity', 'type2Diabetes', 'nashMash',
    'metabolicSyndrome', 'lipodystrophy',
    'glycogenStorage', 'pku',
    'rareMetabolic',
    'type1Diabetes', 'ckdMetabolic',
    'hfpef', 'familialHypercholesterolemia',
    'gout', 'wilsonDisease', 'fabry', 'gaucher'
  ];
  if (solidTumors.includes(indication as SolidTumorIndication)) return 'solidTumor';
  if (neurologyIndications.includes(indication as NeurologyIndication)) return 'neurology';
  if (immunologyIndications.includes(indication as ImmunologyIndication)) return 'immunology';
  if (metabolicIndications.includes(indication as MetabolicIndication)) return 'metabolic';
  return 'hematologic';
}

// Calculate risk score (0-100, higher = more risk)
export function calculateRiskScore(input: CalculationInput): number {
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
  const isNeurology = input.therapeuticArea === 'neurology';
  const isImmunology = input.therapeuticArea === 'immunology';
  const isMetabolic = input.therapeuticArea === 'metabolic';

  // For metabolic, check metabolic-specific insights first
  if (isMetabolic) {
    const metModalityInsights = (insights as Record<string, Record<string, string>>).metabolicModality;
    if (metModalityInsights?.[input.modality]) {
      return metModalityInsights[input.modality];
    }
    const metIndicationInsights = (insights as Record<string, Record<string, string>>).metabolicIndication;
    if (metIndicationInsights?.[input.indication]) {
      return metIndicationInsights[input.indication];
    }
    const mechInsights = (insights as Record<string, Record<string, string>>).mechanismDifferentiation;
    if (input.mechanismDifferentiation && mechInsights?.[input.mechanismDifferentiation]) {
      return mechInsights[input.mechanismDifferentiation];
    }
    const routeInsights = (insights as Record<string, Record<string, string>>).routeOfAdministration;
    if (input.routeOfAdministration && routeInsights?.[input.routeOfAdministration]) {
      return routeInsights[input.routeOfAdministration];
    }
  }

  // For immunology, check immunology-specific insights first
  if (isImmunology) {
    const immunoModalityInsights = (insights as Record<string, Record<string, string>>).immunologyModality;
    if (immunoModalityInsights?.[input.modality]) {
      return immunoModalityInsights[input.modality];
    }
    const immunoIndicationInsights = (insights as Record<string, Record<string, string>>).immunologyIndication;
    if (immunoIndicationInsights?.[input.indication]) {
      return immunoIndicationInsights[input.indication];
    }
    const irInsights = (insights as Record<string, Record<string, string>>).immuneResetPotential;
    if (input.immuneResetPotential && irInsights?.[input.immuneResetPotential]) {
      return irInsights[input.immuneResetPotential];
    }
    const tsInsights = (insights as Record<string, Record<string, string>>).targetSpecificity;
    if (input.targetSpecificity && tsInsights?.[input.targetSpecificity]) {
      return tsInsights[input.targetSpecificity];
    }
  }

  // For neurology, check neurology-specific insights first
  if (isNeurology) {
    const neuroModalityInsights = (insights as Record<string, Record<string, string>>).neurologyModality;
    if (neuroModalityInsights?.[input.modality]) {
      return neuroModalityInsights[input.modality];
    }
    const neuroIndicationInsights = (insights as Record<string, Record<string, string>>).neurologyIndication;
    if (neuroIndicationInsights?.[input.indication]) {
      return neuroIndicationInsights[input.indication];
    }
    const taInsights = (insights as Record<string, Record<string, string>>).treatmentApproach;
    if (taInsights?.[input.treatmentApproach]) {
      return taInsights[input.treatmentApproach];
    }
  }

  // Priority order: modality > line of therapy > competitive > territory > data quality

  // Modality insights
  const modalityInsights = insights.modality as Record<string, string>;
  if (modalityInsights[input.modality]) {
    return modalityInsights[input.modality];
  }

  // Line of therapy insights (oncology only)
  const lotInsights = insights.lineOfTherapy as Record<string, string>;
  if (!isNeurology && !isImmunology && !isMetabolic && lotInsights[input.lineOfTherapy]) {
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

/** Clamp a multiplier to a safe range. Returns fallback if NaN, Infinity, or non-positive. */
function safeMultiplier(value: number, fallback: number = 1.0): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

/** Scrub a {low, median, high} range so no NaN/Infinity leaks to the frontend. */
function sanitizeRange(r: { low: number; median: number; high: number }): { low: number; median: number; high: number } {
  return {
    low: Number.isFinite(r.low) ? r.low : 0,
    median: Number.isFinite(r.median) ? r.median : 0,
    high: Number.isFinite(r.high) ? r.high : 0,
  };
}

/** Scrub a {low, high} range for royalties. */
function sanitizeRoyaltyRange(r: { low: number; high: number }): { low: number; high: number } {
  return {
    low: Number.isFinite(r.low) ? r.low : 0,
    high: Number.isFinite(r.high) ? r.high : 0,
  };
}

export function calculateDealTerms(input: CalculationInput): CalculationResult {
  const modifiers: { name: string; multiplier: number; context?: string }[] = [];
  const isNeurology = input.therapeuticArea === 'neurology';
  const isImmunology = input.therapeuticArea === 'immunology';
  const isMetabolic = input.therapeuticArea === 'metabolic';

  // Get phase baselines (metabolic vs immunology vs neurology vs oncology)
  const phaseBaseline = isMetabolic
    ? benchmarks.metabolicPhaseBaselines[input.phase]
    : isImmunology
    ? benchmarks.immunologyPhaseBaselines[input.phase]
    : isNeurology
    ? benchmarks.neurologyPhaseBaselines[input.phase]
    : benchmarks.phaseBaselines[input.phase];
  const phaseConfig = isMetabolic
    ? benchmarks.metabolicPhaseConfig
    : isImmunology
    ? benchmarks.immunologyPhaseConfig
    : isNeurology
    ? benchmarks.neurologyPhaseConfig
    : benchmarks.phaseConfig;

  // Get multipliers from benchmarks
  const modalityData = benchmarks.modalities[input.modality];
  const modalityMultiplier = modalityData?.multiplier ?? 1.0;
  modifiers.push({ name: modalityData?.label ?? input.modality, multiplier: modalityMultiplier, context: modalityData?.context });

  // Get indication multiplier
  const category = getIndicationCategory(input.indication);
  const indicationsCategory = benchmarks.indications[category];
  const indicationData = indicationsCategory[input.indication];
  const indicationMultiplier = indicationData?.multiplier ?? 1.0;
  modifiers.push({ name: indicationData?.label ?? input.indication, multiplier: indicationMultiplier, context: indicationData?.context });

  // Get territory multiplier
  const territoryData = benchmarks.territories[input.territory];
  const territoryMultiplier = territoryData?.multiplier ?? 1.0;
  modifiers.push({ name: territoryData?.label ?? input.territory, multiplier: territoryMultiplier, context: territoryData?.context });

  // Get biomarker multiplier
  const biomarkerData = benchmarks.multiplierConfig.biomarker[input.biomarker];
  const biomarkerMultiplier = biomarkerData?.multiplier ?? 1.0;
  if (biomarkerMultiplier !== 1.0) {
    modifiers.push({ name: biomarkerData?.label ?? input.biomarker, multiplier: biomarkerMultiplier, context: biomarkerData?.context });
  }

  // Get line of therapy / treatment approach / treatment goal multiplier (depends on therapeutic area)
  let lotMultiplier = 1.0;
  if (isImmunology) {
    const mc = benchmarks.multiplierConfig;
    const tgKey = input.treatmentGoal || 'remissionInduction';
    const tgData = mc.treatmentGoal?.[tgKey];
    lotMultiplier = tgData?.multiplier ?? 1.0;
    if (lotMultiplier !== 1.0) {
      modifiers.push({ name: tgData?.label ?? tgKey, multiplier: lotMultiplier, context: tgData?.context });
    }
  } else if (isMetabolic) {
    const mc = benchmarks.multiplierConfig;
    const mtaKey = input.metabolicTreatmentApproach || 'chronicWeightMgmt';
    const mtaData = mc.metabolicTreatmentApproach?.[mtaKey];
    lotMultiplier = mtaData?.multiplier ?? 1.0;
    if (lotMultiplier !== 1.0) {
      modifiers.push({ name: mtaData?.label ?? mtaKey, multiplier: lotMultiplier, context: mtaData?.context });
    }
  } else if (isNeurology) {
    const taData = benchmarks.multiplierConfig.treatmentApproach[input.treatmentApproach];
    lotMultiplier = taData?.multiplier ?? 1.0;
    if (lotMultiplier !== 1.0) {
      modifiers.push({ name: taData?.label ?? input.treatmentApproach, multiplier: lotMultiplier, context: taData?.context });
    }
  } else {
    const lotData = benchmarks.multiplierConfig.lineOfTherapy[input.lineOfTherapy];
    lotMultiplier = lotData?.multiplier ?? 1.0;
    if (lotMultiplier !== 1.0) {
      modifiers.push({ name: lotData?.label ?? input.lineOfTherapy, multiplier: lotMultiplier, context: lotData?.context });
    }
  }

  // Get combination potential multiplier
  const comboData = benchmarks.multiplierConfig.combinationPotential[input.combinationPotential];
  const comboMultiplier = comboData?.multiplier ?? 1.0;
  if (comboMultiplier !== 1.0) {
    modifiers.push({ name: comboData?.label ?? input.combinationPotential, multiplier: comboMultiplier, context: comboData?.context });
  }

  // Get competitive position multiplier
  const compData = benchmarks.multiplierConfig.competitivePosition[input.competitivePosition];
  const competitiveMultiplier = compData?.multiplier ?? 1.0;
  if (competitiveMultiplier !== 1.0) {
    modifiers.push({ name: compData?.label ?? input.competitivePosition, multiplier: competitiveMultiplier, context: compData?.context });
  }

  // Get data quality multiplier
  const dataData = benchmarks.multiplierConfig.dataQuality[input.dataQuality];
  const dataQualityMultiplier = dataData?.multiplier ?? 1.0;
  if (dataQualityMultiplier !== 1.0) {
    modifiers.push({ name: dataData?.label ?? input.dataQuality, multiplier: dataQualityMultiplier, context: dataData?.context });
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

  // Look up modality × indication interaction bonus (all therapeutic areas)
  let interactionBonus = 0;
  {
    const interactionTerms = benchmarks.interactionTerms || {};
    const key = `${input.modality}+${input.indication}`;
    if (interactionTerms[key]) {
      interactionBonus = interactionTerms[key].bonus;
      modifiers.push({
        name: `${modalityData?.label ?? input.modality} × ${indicationData?.label ?? input.indication} synergy`,
        multiplier: 1 + interactionBonus,
        context: interactionTerms[key].context
      });
    }
  }

  // Get neurology-specific multipliers (BBB, disease progression, biomarker validation)
  let bbbMultiplier = 1.0;
  let diseaseProgMultiplier = 1.0;
  let biomarkerValMultiplier = 1.0;
  if (isNeurology) {
    const mc = benchmarks.multiplierConfig;

    const bbbKey = input.bbbPenetration || 'unproven';
    const bbbData = mc.bbbPenetration?.[bbbKey];
    bbbMultiplier = bbbData?.multiplier ?? 1.0;
    if (bbbMultiplier !== 1.0) {
      modifiers.push({ name: bbbData?.label ?? bbbKey, multiplier: bbbMultiplier, context: bbbData?.context });
    }

    const dpKey = input.diseaseProgression || 'moderateProgressive';
    const dpData = mc.diseaseProgression?.[dpKey];
    diseaseProgMultiplier = dpData?.multiplier ?? 1.0;
    if (diseaseProgMultiplier !== 1.0) {
      modifiers.push({ name: dpData?.label ?? dpKey, multiplier: diseaseProgMultiplier, context: dpData?.context });
    }

    const bvKey = input.biomarkerValidation || 'noBiomarker';
    const bvData = mc.biomarkerValidation?.[bvKey];
    biomarkerValMultiplier = bvData?.multiplier ?? 1.0;
    if (biomarkerValMultiplier !== 1.0) {
      modifiers.push({ name: bvData?.label ?? bvKey, multiplier: biomarkerValMultiplier, context: bvData?.context });
    }
  }

  // Get immunology-specific multipliers
  let immuneResetMultiplier = 1.0;
  let targetSpecMultiplier = 1.0;
  let diseaseSevMultiplier = 1.0;
  if (isImmunology) {
    const mc = benchmarks.multiplierConfig;

    const irKey = input.immuneResetPotential || 'chronicTreatment';
    const irData = mc.immuneResetPotential?.[irKey];
    immuneResetMultiplier = irData?.multiplier ?? 1.0;
    if (immuneResetMultiplier !== 1.0) {
      modifiers.push({ name: irData?.label ?? irKey, multiplier: immuneResetMultiplier, context: irData?.context });
    }

    const tsKey = input.targetSpecificity || 'pathwayTargeted';
    const tsData = mc.targetSpecificity?.[tsKey];
    targetSpecMultiplier = tsData?.multiplier ?? 1.0;
    if (targetSpecMultiplier !== 1.0) {
      modifiers.push({ name: tsData?.label ?? tsKey, multiplier: targetSpecMultiplier, context: tsData?.context });
    }

    const dsKey = input.diseaseSeverity || 'moderateSevere';
    const dsData = mc.diseaseSeverity?.[dsKey];
    diseaseSevMultiplier = dsData?.multiplier ?? 1.0;
    if (diseaseSevMultiplier !== 1.0) {
      modifiers.push({ name: dsData?.label ?? dsKey, multiplier: diseaseSevMultiplier, context: dsData?.context });
    }
  }

  // Get metabolic-specific multipliers
  let mechDiffMultiplier = 1.0;
  let weightLossMultiplier = 1.0;
  let routeMultiplier = 1.0;
  let comorbidityMultiplier = 1.0;
  if (isMetabolic) {
    const mc = benchmarks.multiplierConfig;

    const mdKey = input.mechanismDifferentiation || 'incretinBased';
    const mdData = mc.mechanismDifferentiation?.[mdKey];
    mechDiffMultiplier = mdData?.multiplier ?? 1.0;
    if (mechDiffMultiplier !== 1.0) {
      modifiers.push({ name: mdData?.label ?? mdKey, multiplier: mechDiffMultiplier, context: mdData?.context });
    }

    const wlKey = input.weightLossEfficacy || 'competitiveEfficacy';
    const wlData = mc.weightLossEfficacy?.[wlKey];
    weightLossMultiplier = wlData?.multiplier ?? 1.0;
    if (weightLossMultiplier !== 1.0) {
      modifiers.push({ name: wlData?.label ?? wlKey, multiplier: weightLossMultiplier, context: wlData?.context });
    }

    const roaKey = input.routeOfAdministration || 'injectable';
    const roaData = mc.routeOfAdministration?.[roaKey];
    routeMultiplier = roaData?.multiplier ?? 1.0;
    if (routeMultiplier !== 1.0) {
      modifiers.push({ name: roaData?.label ?? roaKey, multiplier: routeMultiplier, context: roaData?.context });
    }

    const cbKey = input.comorbidityBreadth || 'obesityPrimary';
    const cbData = mc.comorbidityBreadth?.[cbKey];
    comorbidityMultiplier = cbData?.multiplier ?? 1.0;
    if (comorbidityMultiplier !== 1.0) {
      modifiers.push({ name: cbData?.label ?? cbKey, multiplier: comorbidityMultiplier, context: cbData?.context });
    }
  }

  // Apply diminishing multiplier stacking with therapeutic-area-specific exponents
  // Neurology: combo dampening reduced (CNS drugs are inherently combination-limited by BBB)
  // Neurology: indication exponent higher (indication choice matters more in neuro)
  // Immunology: combo therapies very relevant; indication and disease severity matter highly
  // Metabolic: route of admin and weight loss efficacy are the strongest differentiators
  const comboExp = isNeurology ? 0.90 : isImmunology ? 0.80 : isMetabolic ? 0.85 : 0.75;
  const indicationExp = isNeurology ? 0.90 : isImmunology ? 0.85 : isMetabolic ? 0.85 : 0.80;
  const lotExp = isNeurology ? 0.90 : isImmunology ? 0.85 : isMetabolic ? 0.85 : 0.85;

  const effectiveMultiplier =
    safeMultiplier(Math.pow(modalityMultiplier, 1.0)) *
    safeMultiplier(Math.pow(indicationMultiplier, indicationExp)) *
    safeMultiplier(Math.pow(biomarkerMultiplier, 0.9)) *
    safeMultiplier(Math.pow(lotMultiplier, lotExp)) *
    safeMultiplier(Math.pow(comboMultiplier, comboExp)) *
    safeMultiplier(Math.pow(territoryMultiplier, 1.0)) *
    safeMultiplier(Math.pow(competitiveMultiplier, 0.7)) *
    safeMultiplier(Math.pow(dataQualityMultiplier, 0.5)) *
    safeMultiplier(Math.pow(bbbMultiplier, 0.8)) *
    safeMultiplier(Math.pow(diseaseProgMultiplier, 0.7)) *
    safeMultiplier(Math.pow(biomarkerValMultiplier, 0.75)) *
    safeMultiplier(Math.pow(immuneResetMultiplier, 0.85)) *
    safeMultiplier(Math.pow(targetSpecMultiplier, 0.7)) *
    safeMultiplier(Math.pow(diseaseSevMultiplier, 0.75)) *
    safeMultiplier(Math.pow(mechDiffMultiplier, 0.80)) *
    safeMultiplier(Math.pow(weightLossMultiplier, 0.85)) *
    safeMultiplier(Math.pow(routeMultiplier, 0.75)) *
    safeMultiplier(Math.pow(comorbidityMultiplier, 0.70)) *
    safeMultiplier(1 + regulatoryBonus) *
    safeMultiplier(1 + interactionBonus);

  // Calculate total deal value
  const baseTotalValue = phaseBaseline.totalValue;
  const rangeWidth = phaseConfig.rangeWidths[input.phase];

  const adjustedMedian = Math.round(baseTotalValue.median * effectiveMultiplier);

  if (!Number.isFinite(adjustedMedian) || adjustedMedian < 0) {
    throw new Error(
      `Invalid calculation: adjustedMedian=${adjustedMedian}, effectiveMultiplier=${effectiveMultiplier}. ` +
      `Input: phase=${input.phase}, modality=${input.modality}, indication=${input.indication}`
    );
  }

  const totalDealValue = {
    low: Math.round(adjustedMedian * (1 - rangeWidth)),
    median: adjustedMedian,
    high: Math.round(adjustedMedian * (1 + rangeWidth))
  };

  // Calculate upfront based on phase ratios with risk adjustment
  const upfrontRatios = phaseConfig.upfrontRatios[input.phase];
  const riskScore = calculateRiskScore(input);
  // Higher risk = lower upfront ratio (toward low end)
  const riskFactor = Math.max(0, Math.min(riskScore / 100, 1)); // Clamp 0 to 1

  // Apply risk adjustment consistently across all calculations
  const adjustedRatioLow = upfrontRatios.low + (upfrontRatios.high - upfrontRatios.low) * (1 - riskFactor);
  const adjustedRatioHigh = upfrontRatios.low + (upfrontRatios.high - upfrontRatios.low) * (1 - riskFactor * 0.5);
  const adjustedRatioMedian = (adjustedRatioLow + adjustedRatioHigh) / 2;

  const upfront = {
    low: Math.round(totalDealValue.low * adjustedRatioLow * 0.9), // 10% lower for conservative low estimate
    median: Math.round(totalDealValue.median * adjustedRatioMedian),
    high: Math.round(totalDealValue.high * adjustedRatioHigh * 1.1) // 10% higher for optimistic high estimate
  };

  // Calculate milestone allocations
  // Disease-modifying neurology assets use rebalanced milestones (more dev-weighted)
  const dmPhaseAdjust = benchmarks.neurologyDiseaseModifyingPhaseAdjustment;
  const useDMRebalance = isNeurology && input.treatmentApproach === 'diseaseModifying' && dmPhaseAdjust;
  const milestoneAlloc = useDMRebalance
    ? dmPhaseAdjust.milestoneRebalance[input.phase]
    : phaseConfig.milestoneAllocations[input.phase];
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
  const recommendedUpfrontPercent = Math.round(adjustedRatioMedian * 100);
  const dealRecommendation: DealRecommendation = {
    upfrontPercent: recommendedUpfrontPercent,
    milestonePercent: 100 - recommendedUpfrontPercent,
    rationale: generateRationale(input, riskScore)
  };

  // Get negotiation insight
  const negotiationInsight = getNegotiationInsight(input);

  // Get labels
  const labels = benchmarks.labels;

  // Generate drill-down data
  const drillDown = generateDrillDownData(
    input,
    modifiers,
    rangeWidth,
    devMilestones,
    regMilestones,
    commMilestones,
    tieredRoyalties
  );

  return {
    terms: {
      upfront: sanitizeRange(upfront),
      devMilestones: sanitizeRange(devMilestones),
      regMilestones: sanitizeRange(regMilestones),
      commMilestones: sanitizeRange(commMilestones),
      totalDealValue: sanitizeRange(totalDealValue),
    },
    tieredRoyalties: {
      base: sanitizeRoyaltyRange(tieredRoyalties.base),
      midTier: sanitizeRoyaltyRange(tieredRoyalties.midTier),
      highTier: sanitizeRoyaltyRange(tieredRoyalties.highTier),
    },
    dealRecommendation: {
      ...dealRecommendation,
      upfrontPercent: Number.isFinite(dealRecommendation.upfrontPercent) ? dealRecommendation.upfrontPercent : 15,
      milestonePercent: Number.isFinite(dealRecommendation.milestonePercent) ? dealRecommendation.milestonePercent : 85,
    },
    negotiationInsight,
    modifiers,
    labels: {
      phase: labels.phases[input.phase],
      modality: modalityData?.label ?? input.modality,
      indication: indicationData?.label ?? input.indication
    },
    drillDown,
    phase: input.phase,
    ...(isNeurology ? {
      milestoneExplanation: generateNeuroMilestoneExplanation(input.phase, recommendedUpfrontPercent)
    } : {}),
    ...(isImmunology ? {
      milestoneExplanation: generateImmunologyMilestoneExplanation(input.phase, recommendedUpfrontPercent)
    } : {}),
    ...(isMetabolic ? {
      milestoneExplanation: generateMetabolicMilestoneExplanation(input.phase, recommendedUpfrontPercent)
    } : {})
  };
}

function generateNeuroMilestoneExplanation(phase: Phase, upfrontPercent: number): string {
  const neuroUpfrontRanges: Record<Phase, string> = {
    preclinical: '5-12%',
    phase1: '8-18%',
    phase2: '12-25%',
    phase3: '20-35%',
    approved: '30-50%',
  };
  const oncoUpfrontRanges: Record<Phase, string> = {
    preclinical: '8-18%',
    phase1: '12-25%',
    phase2: '18-35%',
    phase3: '25-45%',
    approved: '35-60%',
  };
  return `Neurology deals at ${phase.replace('phase', 'Phase ')} typically allocate ${neuroUpfrontRanges[phase]} upfront (vs ${oncoUpfrontRanges[phase]} in oncology). ` +
    `Your estimated ${upfrontPercent}% upfront reflects the higher clinical risk in CNS programs — longer trials, complex endpoints, and historically lower approval rates shift value toward milestone-based structures that reward de-risking.`;
}

function generateImmunologyMilestoneExplanation(phase: Phase, upfrontPercent: number): string {
  const immunoUpfrontRanges: Record<Phase, string> = {
    preclinical: '5-9%',
    phase1: '8-13%',
    phase2: '14-22%',
    phase3: '20-28%',
    approved: '28-42%',
  };
  return `Immunology/autoimmune deals at ${phase.replace('phase', 'Phase ')} typically allocate ${immunoUpfrontRanges[phase]} upfront. ` +
    `Your estimated ${upfrontPercent}% upfront reflects the chronic-disease commercial model — autoimmune drugs generate recurring revenue (Humira $21B peak, Dupixent $13B+), ` +
    `so deal structures weight commercial milestones heavily, with upfronts higher than neurology but structured to reward market access and formulary wins.`;
}

function generateMetabolicMilestoneExplanation(phase: Phase, upfrontPercent: number): string {
  const metUpfrontRanges: Record<Phase, string> = {
    preclinical: '6-10%',
    phase1: '10-15%',
    phase2: '15-25%',
    phase3: '20-30%',
    approved: '28-42%',
  };
  return `Metabolic/obesity deals at ${phase.replace('phase', 'Phase ')} typically allocate ${metUpfrontRanges[phase]} upfront. ` +
    `Your estimated ${upfrontPercent}% upfront reflects the commercial-weighted structure of metabolic deals — GLP-1 and incretin programs generate massive recurring revenue ($20B+ semaglutide peak), ` +
    `so deal structures heavily weight commercial milestones tied to formulary access, indication expansion, and blockbuster sales tiers.`;
}

function generateDrillDownData(
  input: CalculationInput,
  modifiers: { name: string; multiplier: number; context?: string }[],
  rangeWidth: number,
  devMilestones: { low: number; median: number; high: number },
  regMilestones: { low: number; median: number; high: number },
  commMilestones: { low: number; median: number; high: number },
  tieredRoyalties: TieredRoyalties
): DrillDownCollection {
  const phaseLabels = benchmarks.labels.phases;
  const rangePercent = Math.round(rangeWidth * 100);

  // Convert modifiers to factor impacts
  const factors: FactorImpact[] = modifiers.map(mod => ({
    name: mod.name,
    impact: mod.multiplier > 1 ? 'positive' : mod.multiplier < 1 ? 'negative' : 'neutral',
    percentage: Math.round((mod.multiplier - 1) * 100)
  }));

  // Phase-specific range explanations
  const rangeExplanations: Record<Phase, string> = {
    preclinical: `Preclinical assets have the widest valuation range (±${rangePercent}%) due to significant development uncertainty and limited clinical validation.`,
    phase1: `Phase 1 assets show moderate variance (±${rangePercent}%) as initial safety data reduces but doesn't eliminate development risk.`,
    phase2: `Phase 2 assets typically see ±${rangePercent}% variance based on efficacy signals, competitive dynamics, and pathway clarity.`,
    phase3: `Phase 3 assets have tighter ranges (±${rangePercent}%) given substantial de-risking, though regulatory and commercial uncertainties remain.`,
    approved: `Approved assets show the tightest ranges (±${rangePercent}%) with valuations driven primarily by commercial execution factors.`
  };

  // Development milestone breakdown by phase
  const devBreakdowns: Record<Phase, MilestoneBreakdown[]> = {
    preclinical: [
      { label: 'IND Filing', percentage: 30, value: calculateBreakdownValue(devMilestones, 0.30) },
      { label: 'Phase 1 Start', percentage: 25, value: calculateBreakdownValue(devMilestones, 0.25) },
      { label: 'Phase 2 Start', percentage: 25, value: calculateBreakdownValue(devMilestones, 0.25) },
      { label: 'Phase 3 Start', percentage: 20, value: calculateBreakdownValue(devMilestones, 0.20) }
    ],
    phase1: [
      { label: 'Phase 1 Completion', percentage: 40, value: calculateBreakdownValue(devMilestones, 0.40) },
      { label: 'Phase 2 Start', percentage: 35, value: calculateBreakdownValue(devMilestones, 0.35) },
      { label: 'Phase 3 Start', percentage: 25, value: calculateBreakdownValue(devMilestones, 0.25) }
    ],
    phase2: [
      { label: 'Phase 2 Completion', percentage: 60, value: calculateBreakdownValue(devMilestones, 0.60) },
      { label: 'Phase 3 Start', percentage: 40, value: calculateBreakdownValue(devMilestones, 0.40) }
    ],
    phase3: [
      { label: 'Phase 3 Completion', percentage: 70, value: calculateBreakdownValue(devMilestones, 0.70) },
      { label: 'NDA/BLA Filing', percentage: 30, value: calculateBreakdownValue(devMilestones, 0.30) }
    ],
    approved: [
      { label: 'Label Expansion', percentage: 100, value: calculateBreakdownValue(devMilestones, 1.0) }
    ]
  };

  // Regulatory milestone breakdown
  const regBreakdown: MilestoneBreakdown[] = [
    { label: 'FDA Approval', percentage: 50, value: calculateBreakdownValue(regMilestones, 0.50) },
    { label: 'EMA Approval', percentage: 30, value: calculateBreakdownValue(regMilestones, 0.30) },
    { label: 'Other Major Markets', percentage: 20, value: calculateBreakdownValue(regMilestones, 0.20) }
  ];

  // Commercial milestone breakdown
  const commBreakdown: MilestoneBreakdown[] = [
    { label: 'First $100M Net Sales', percentage: 15, value: calculateBreakdownValue(commMilestones, 0.15) },
    { label: '$500M Net Sales', percentage: 25, value: calculateBreakdownValue(commMilestones, 0.25) },
    { label: '$1B Net Sales', percentage: 30, value: calculateBreakdownValue(commMilestones, 0.30) },
    { label: '$2B+ Net Sales', percentage: 30, value: calculateBreakdownValue(commMilestones, 0.30) }
  ];

  // Royalty tier explanation
  const royaltyBreakdown: MilestoneBreakdown[] = [
    { label: `Base Tier (<$500M)`, percentage: tieredRoyalties.base.low, value: { low: tieredRoyalties.base.low, median: (tieredRoyalties.base.low + tieredRoyalties.base.high) / 2, high: tieredRoyalties.base.high } },
    { label: `Mid Tier ($500M-$1B)`, percentage: tieredRoyalties.midTier.low, value: { low: tieredRoyalties.midTier.low, median: (tieredRoyalties.midTier.low + tieredRoyalties.midTier.high) / 2, high: tieredRoyalties.midTier.high } },
    { label: `High Tier (>$1B)`, percentage: tieredRoyalties.highTier.low, value: { low: tieredRoyalties.highTier.low, median: (tieredRoyalties.highTier.low + tieredRoyalties.highTier.high) / 2, high: tieredRoyalties.highTier.high } }
  ];

  return {
    upfront: {
      rangeExplanation: `Upfront payments are guaranteed at signing. The range reflects market variability and negotiation outcomes for ${phaseLabels[input.phase]} assets.`,
      rangeWidthPercent: rangePercent,
      factors: factors.filter(f => f.impact !== 'neutral')
    },
    totalDealValue: {
      rangeExplanation: rangeExplanations[input.phase],
      rangeWidthPercent: rangePercent,
      factors: factors.filter(f => f.impact !== 'neutral')
    },
    devMilestones: {
      rangeExplanation: `Development milestones are paid upon achieving clinical trial objectives. Earlier-stage deals weight more toward development milestones.`,
      rangeWidthPercent: rangePercent,
      factors: factors.filter(f => f.impact !== 'neutral'),
      breakdown: devBreakdowns[input.phase]
    },
    regMilestones: {
      rangeExplanation: `Regulatory milestones are contingent on approval by health authorities. FDA typically accounts for 50% of regulatory milestone value.`,
      rangeWidthPercent: rangePercent,
      factors: factors.filter(f => f.impact !== 'neutral'),
      breakdown: regBreakdown
    },
    commMilestones: {
      rangeExplanation: `Commercial milestones are tied to net sales thresholds. Later-stage deals weight more toward commercial milestones.`,
      rangeWidthPercent: rangePercent,
      factors: factors.filter(f => f.impact !== 'neutral'),
      breakdown: commBreakdown
    },
    royalties: {
      rangeExplanation: `Royalties are ongoing payments on net sales, typically tiered to increase with sales volume. Rates reflect modality, indication, and competitive factors.`,
      rangeWidthPercent: rangePercent,
      factors: factors.filter(f => f.impact !== 'neutral'),
      breakdown: royaltyBreakdown
    }
  };
}

function calculateBreakdownValue(
  total: { low: number; median: number; high: number },
  percentage: number
): { low: number; median: number; high: number } {
  return {
    low: Math.round(total.low * percentage),
    median: Math.round(total.median * percentage),
    high: Math.round(total.high * percentage)
  };
}

function generateRationale(input: CalculationInput, riskScore: number): string {
  const phaseLabel = benchmarks.labels.phases[input.phase];
  const isNeuro = input.therapeuticArea === 'neurology';
  const isImmuno = input.therapeuticArea === 'immunology';
  const isMetab = input.therapeuticArea === 'metabolic';

  if (isMetab) {
    if (riskScore < 25) {
      return `De-risked ${phaseLabel} metabolic asset with validated mechanism and strong efficacy data justifies premium upfront. The enormous commercial potential of obesity/metabolic drugs ($100B+ projected market) drives aggressive commercial milestone structures.`;
    } else if (riskScore < 50) {
      return `${phaseLabel} metabolic asset with moderate risk. The GLP-1 era has established deal premiums, but differentiation via oral delivery, superior efficacy, or multi-organ benefit is critical for top-tier terms.`;
    } else if (riskScore < 75) {
      return `Earlier-stage metabolic asset with clinical uncertainty. Deals are structured with development milestones tied to weight loss endpoints and cardiometabolic outcome data.`;
    } else {
      return `High-risk metabolic profile. Expect modest upfront with milestone potential tied to efficacy differentiation, oral formulation success, and payer access milestones.`;
    }
  }

  if (isImmuno) {
    if (riskScore < 25) {
      return `De-risked ${phaseLabel} autoimmune asset with validated mechanism justifies higher upfront. Commercial milestones dominate — chronic autoimmune drugs generate blockbuster recurring revenue.`;
    } else if (riskScore < 50) {
      return `${phaseLabel} immunology asset with moderate risk. Autoimmune deals increasingly favor commercial milestone-heavy structures given the proven chronic-use revenue model.`;
    } else if (riskScore < 75) {
      return `Earlier-stage autoimmune asset with clinical uncertainty. Deals are structured with development milestones tied to endpoint validation and regulatory de-risking.`;
    } else {
      return `High-risk autoimmune profile. Expect minimal upfront with milestone potential tied to immune reset durability, endpoint validation, and regulatory milestones.`;
    }
  }

  if (isNeuro) {
    if (riskScore < 25) {
      return `De-risked ${phaseLabel} CNS asset with proven BBB penetration and strong data justifies a higher upfront component, though milestone-heavy structures remain the norm in neurology.`;
    } else if (riskScore < 50) {
      return `${phaseLabel} neurology asset with moderate risk. CNS programs typically favor milestone-weighted deals to account for longer development timelines and endpoint complexity.`;
    } else if (riskScore < 75) {
      return `Earlier-stage CNS asset with clinical uncertainty. Neurology deal structures favor heavy milestone weighting tied to clinical and regulatory de-risking events.`;
    } else {
      return `High-risk CNS profile. Expect minimal upfront with significant milestone potential tied to BBB penetration proof, clinical endpoints, and regulatory milestones.`;
    }
  }

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

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '$0M';
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
    { value: 'oligonucleotide', label: 'Oligonucleotide (ASO / siRNA for Tumors)' },
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
    { value: 'endometrial', label: 'Endometrial (Uterine)' },
    { value: 'cervical', label: 'Cervical' },
    { value: 'thyroid', label: 'Thyroid (Anaplastic/Medullary)' },
    { value: 'esophageal', label: 'Esophageal' },
    { value: 'smallBowel', label: 'Small Bowel / Appendiceal' },
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
    { value: 'cml', label: 'CML' },
    { value: 'waldenstrom', label: "Waldenstrom's Macroglobulinemia" },
    { value: 'hodgkins', label: 'Hodgkin Lymphoma' },
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

export const competitivePositionOptions: { value: CompetitivePosition; label: string }[] = [
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

// Therapeutic area options
export const therapeuticAreaOptions = [
  { value: 'oncology', label: 'Oncology' },
  { value: 'neurology', label: 'Neurology / CNS' },
  { value: 'immunology', label: 'Immunology / Autoimmune' },
  { value: 'metabolic', label: 'Metabolic / Obesity' },
];

// Neurology-specific indication options
export const neurologyIndicationOptions = [
  { group: 'Neurodegeneration', options: [
    { value: 'alzheimers', label: "Alzheimer's Disease" },
    { value: 'parkinsons', label: "Parkinson's Disease" },
    { value: 'als', label: 'ALS (Amyotrophic Lateral Sclerosis)' },
    { value: 'huntingtons', label: "Huntington's Disease" },
  ]},
  { group: 'Psychiatry', options: [
    { value: 'schizophrenia', label: 'Schizophrenia / Psychosis' },
    { value: 'depression', label: 'Depression / MDD' },
    { value: 'addiction', label: 'Addiction / Substance Use Disorders' },
    { value: 'bipolar', label: 'Bipolar Disorder' },
    { value: 'ptsd', label: 'PTSD / Trauma Disorders' },
    { value: 'ocd', label: 'OCD / Anxiety Disorders' },
  ]},
  { group: 'Movement & Seizure', options: [
    { value: 'epilepsy', label: 'Epilepsy' },
    { value: 'tremor', label: 'Movement Disorders (Tremor / Dystonia)' },
  ]},
  { group: 'Other CNS', options: [
    { value: 'pain', label: 'Pain (Chronic / Neuropathic)' },
    { value: 'ms', label: 'Multiple Sclerosis' },
    { value: 'migraine', label: 'Migraine / Headache' },
    { value: 'narcolepsy', label: 'Narcolepsy / Sleep Disorders' },
    { value: 'tbi', label: 'Traumatic Brain Injury / Stroke Recovery' },
    { value: 'chronicPain', label: 'Chronic Pain (Non-Neuropathic)' },
    { value: 'rareNeuro', label: 'Other Rare Neurological' },
  ]},
  { group: 'Neurodevelopmental & Rare', options: [
    { value: 'autism', label: 'Autism Spectrum Disorder' },
    { value: 'rett', label: 'Rett Syndrome' },
    { value: 'friedreichs', label: "Friedreich's Ataxia" },
    { value: 'dmd', label: 'Duchenne Muscular Dystrophy' },
  ]},
];

// Neurology-specific modality options
export const neurologyModalityOptions = [
  { group: 'Small Molecules', options: [
    { value: 'smallMolecule', label: 'Small Molecule' },
    { value: 'ionChannel', label: 'Ion Channel Modulator' },
    { value: 'protac', label: 'PROTAC / Degrader' },
  ]},
  { group: 'Biologics', options: [
    { value: 'mab', label: 'Monoclonal Antibody' },
    { value: 'tauTargeting', label: 'Tau-targeting Therapy' },
    { value: 'peptide', label: 'Peptide' },
  ]},
  { group: 'CNS Delivery & Platforms', options: [
    { value: 'bbbPlatform', label: 'BBB Delivery Platform' },
    { value: 'geneTherapy', label: 'Gene Therapy / Gene Editing' },
  ]},
  { group: 'RNA Therapeutics', options: [
    { value: 'aso', label: 'Antisense Oligonucleotide (ASO)' },
    { value: 'rnai', label: 'RNAi / siRNA' },
  ]},
  { group: 'Cell & Emerging', options: [
    { value: 'stemCell', label: 'Neural Stem Cell / Progenitor' },
    { value: 'psychedelic', label: 'Psychedelic / Neuroplastogen' },
    { value: 'cellTherapy', label: 'Cell Therapy (other)' },
  ]},
];

// Treatment approach options (neurology replacement for line of therapy)
export const treatmentApproachOptions = [
  { value: 'diseaseModifying', label: 'Disease-modifying' },
  { value: 'symptomatic', label: 'Symptomatic / Acute' },
  { value: 'adjunctive', label: 'Adjunctive / Supportive' },
];

export const bbbPenetrationOptions = [
  { value: 'provenCNS', label: 'Proven CNS penetration' },
  { value: 'promisingPreclinical', label: 'Promising preclinical BBB data' },
  { value: 'unproven', label: 'Unproven / standard' },
  { value: 'peripheralOnly', label: 'Peripheral only' },
];

export const diseaseProgressionOptions = [
  { value: 'slowProgressive', label: 'Slow progressive' },
  { value: 'moderateProgressive', label: 'Moderate progressive' },
  { value: 'rapidProgressive', label: 'Rapid progressive' },
  { value: 'episodic', label: 'Episodic / relapsing' },
];

export const biomarkerValidationOptions = [
  { value: 'validatedSurrogate', label: 'Validated surrogate endpoint' },
  { value: 'exploratory', label: 'Exploratory biomarker' },
  { value: 'noBiomarker', label: 'No biomarker' },
];

// Immunology-specific modality options
export const immunologyModalityOptions = [
  { group: 'Small Molecules', options: [
    { value: 'smallMolecule', label: 'Small Molecule' },
    { value: 'jakInhibitor', label: 'JAK / TYK2 Inhibitor' },
    { value: 's1pModulator', label: 'S1P Receptor Modulator' },
    { value: 'oralIntegrin', label: 'Oral Integrin Inhibitor' },
  ]},
  { group: 'Antibodies & Biologics', options: [
    { value: 'mab', label: 'Monoclonal Antibody' },
    { value: 'bispecific', label: 'Bispecific Antibody' },
    { value: 'tl1aInhibitor', label: 'Anti-TL1A' },
    { value: 'fcrnAntagonist', label: 'FcRn Antagonist' },
    { value: 'dualAntagonist', label: 'Dual BAFF/APRIL Antagonist' },
    { value: 'complementInhibitor', label: 'Complement Inhibitor' },
  ]},
  { group: 'Cell Therapy', options: [
    { value: 'carT_autoimmune', label: 'CAR-T (Autoimmune)' },
    { value: 'inVivoCarT', label: 'In Vivo CAR-T (LNP)' },
    { value: 'carTreg', label: 'CAR-Treg / Tolerizing' },
    { value: 'cellTherapy', label: 'Cell Therapy (other)' },
  ]},
  { group: 'RNA & Gene', options: [
    { value: 'rnai', label: 'RNAi / siRNA' },
    { value: 'geneTherapy', label: 'Gene Therapy' },
  ]},
  { group: 'Other', options: [
    { value: 'peptide', label: 'Peptide' },
  ]},
];

// Immunology-specific indication options
export const immunologyIndicationOptions = [
  { group: 'Inflammatory Bowel', options: [
    { value: 'ulcerativeColitis', label: 'Ulcerative Colitis' },
    { value: 'crohns', label: "Crohn's Disease" },
    { value: 'ibd_broad', label: 'IBD (Broad UC + CD)' },
    { value: 'celiac', label: 'Celiac Disease' },
  ]},
  { group: 'Rheumatologic', options: [
    { value: 'rheumatoidArthritis', label: 'Rheumatoid Arthritis' },
    { value: 'sle_lupus', label: 'Systemic Lupus (SLE)' },
    { value: 'lupusNephritis', label: 'Lupus Nephritis' },
    { value: 'systemicSclerosis', label: 'Systemic Sclerosis' },
    { value: 'sjogrens', label: "Sjogren's Syndrome" },
    { value: 'aancaVasculitis', label: 'ANCA Vasculitis' },
  ]},
  { group: 'Dermatologic', options: [
    { value: 'atopicderm', label: 'Atopic Dermatitis' },
    { value: 'psoriasis', label: 'Psoriasis' },
    { value: 'psoriaticArthritis', label: 'Psoriatic Arthritis' },
    { value: 'alopecia', label: 'Alopecia Areata' },
    { value: 'hidradenitis', label: 'Hidradenitis Suppurativa' },
    { value: 'vitiligo', label: 'Vitiligo' },
  ]},
  { group: 'Neuromuscular & Rare', options: [
    { value: 'myastheniaGravis', label: 'Myasthenia Gravis' },
    { value: 'cidp', label: 'CIDP' },
    { value: 'multipleSclerosisMod', label: 'Multiple Sclerosis' },
    { value: 'pnh', label: 'PNH' },
    { value: 'pemphigus', label: 'Pemphigus / Bullous Diseases' },
    { value: 'itp', label: 'Immune Thrombocytopenia (ITP)' },
  ]},
  { group: 'Respiratory & Allergic', options: [
    { value: 'asthma', label: 'Severe Asthma' },
    { value: 'eosinophilicEsophagitis', label: 'Eosinophilic Esophagitis (EoE)' },
  ]},
  { group: 'Transplant', options: [
    { value: 'gvhd', label: 'Graft-vs-Host Disease (GVHD)' },
    { value: 'organTransplant', label: 'Solid Organ Transplant Rejection' },
  ]},
  { group: 'Renal & Rare', options: [
    { value: 'igan', label: 'IgA Nephropathy' },
    { value: 'thyroidEye', label: 'Thyroid Eye Disease' },
    { value: 'pbc', label: 'Primary Biliary Cholangitis (PBC)' },
    { value: 'rareAutoimmune', label: 'Other Rare Autoimmune' },
  ]},
];

// Immunology-specific parameter options
export const immuneResetOptions = [
  { value: 'curativeIntent', label: 'Curative intent (drug-free remission)' },
  { value: 'durableRemission', label: 'Durable remission (years)' },
  { value: 'chronicTreatment', label: 'Chronic treatment' },
];

export const targetSpecificityOptions = [
  { value: 'antigenSpecific', label: 'Antigen-specific' },
  { value: 'pathwayTargeted', label: 'Pathway-targeted' },
  { value: 'broadImmunosuppression', label: 'Broad immunosuppression' },
];

export const diseaseSeverityOptions = [
  { value: 'mildModerate', label: 'Mild-moderate' },
  { value: 'moderateSevere', label: 'Moderate-severe' },
  { value: 'severe', label: 'Severe / refractory' },
  { value: 'refractory', label: 'Multi-refractory' },
];

export const treatmentGoalOptions = [
  { value: 'remissionInduction', label: 'Remission induction' },
  { value: 'maintenance', label: 'Maintenance / prevention' },
  { value: 'flareControl', label: 'Acute flare control' },
];

// Metabolic-specific modality options
export const metabolicModalityOptions = [
  { group: 'Incretin-Based', options: [
    { value: 'glp1Agonist', label: 'GLP-1 Receptor Agonist' },
    { value: 'dualIncretin', label: 'Dual Incretin (GLP-1/GIP)' },
    { value: 'tripleIncretin', label: 'Triple Agonist (GLP-1/GIP/Glucagon)' },
    { value: 'amylinAnalog', label: 'Amylin Analog / Cagrilintide-type' },
    { value: 'oralPeptide', label: 'Oral Peptide (Oral Semaglutide-type)' },
  ]},
  { group: 'Non-Incretin Biologics', options: [
    { value: 'mab', label: 'Monoclonal Antibody' },
    { value: 'antiActivin', label: 'Anti-Activin / Myostatin (Muscle-sparing)' },
    { value: 'bispecific', label: 'Bispecific Antibody' },
  ]},
  { group: 'Small Molecules & SGLT2', options: [
    { value: 'smallMolecule', label: 'Small Molecule' },
    { value: 'sglt2Inhibitor', label: 'SGLT2 Inhibitor' },
  ]},
  { group: 'Advanced Modalities', options: [
    { value: 'geneTherapy', label: 'Gene Therapy (Metabolic)' },
    { value: 'rnai', label: 'RNA Therapeutics (siRNA/ASO)' },
    { value: 'microbiomeBased', label: 'Microbiome-Based Therapy' },
  ]},
];

// Metabolic-specific indication options
export const metabolicIndicationOptions = [
  { group: 'Obesity & Weight', options: [
    { value: 'obesity', label: 'Obesity / Chronic Weight Management' },
    { value: 'metabolicSyndrome', label: 'Metabolic Syndrome' },
  ]},
  { group: 'Diabetes & Glycemic', options: [
    { value: 'type2Diabetes', label: 'Type 2 Diabetes' },
    { value: 'type1Diabetes', label: 'Type 1 Diabetes' },
  ]},
  { group: 'Organ-Specific Metabolic', options: [
    { value: 'nashMash', label: 'NASH / MASH (Fatty Liver)' },
    { value: 'lipodystrophy', label: 'Lipodystrophy' },
    { value: 'ckdMetabolic', label: 'CKD (Metabolic/Diabetic)' },
  ]},
  { group: 'Cardiovascular-Metabolic', options: [
    { value: 'hfpef', label: 'HFpEF (Heart Failure)' },
    { value: 'familialHypercholesterolemia', label: 'Familial Hypercholesterolemia' },
  ]},
  { group: 'Other Metabolic', options: [
    { value: 'gout', label: 'Gout / Hyperuricemia' },
  ]},
  { group: 'Rare Metabolic', options: [
    { value: 'glycogenStorage', label: 'Glycogen Storage Disease' },
    { value: 'pku', label: 'PKU (Phenylketonuria)' },
    { value: 'wilsonDisease', label: 'Wilson Disease' },
    { value: 'fabry', label: 'Fabry Disease' },
    { value: 'gaucher', label: 'Gaucher Disease' },
    { value: 'rareMetabolic', label: 'Other Rare Metabolic' },
  ]},
];

// Metabolic-specific parameter options
export const mechanismDifferentiationOptions = [
  { value: 'incretinBased', label: 'Incretin-based (GLP-1 class)' },
  { value: 'nonIncretin', label: 'Non-incretin mechanism' },
  { value: 'combinationMechanism', label: 'Combination / multi-pathway' },
];

export const weightLossEfficacyOptions = [
  { value: 'superiorEfficacy', label: 'Superior (>20% weight loss)' },
  { value: 'competitiveEfficacy', label: 'Competitive (15-20% weight loss)' },
  { value: 'modestEfficacy', label: 'Modest (<15% weight loss)' },
];

export const routeOfAdministrationOptions = [
  { value: 'oral', label: 'Oral administration' },
  { value: 'injectable', label: 'Injectable (SC/weekly or less)' },
  { value: 'implantable', label: 'Implantable / long-acting depot' },
];

export const comorbidityBreadthOptions = [
  { value: 'cardiometabolicBenefit', label: 'Cardiometabolic benefit (CV + metabolic)' },
  { value: 'obesityPrimary', label: 'Obesity-primary (weight only)' },
  { value: 'organProtective', label: 'Organ-protective (liver, kidney, heart)' },
];

export const metabolicTreatmentApproachOptions = [
  { value: 'chronicWeightMgmt', label: 'Chronic weight management' },
  { value: 'glycemicControl', label: 'Glycemic control' },
  { value: 'organProtective', label: 'Organ-protective' },
  { value: 'metabolicReset', label: 'Metabolic reset / curative' },
];
