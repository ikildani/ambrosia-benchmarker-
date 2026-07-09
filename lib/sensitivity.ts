import {
  CalculationInput,
  CalculationResult,
  calculateDealTerms,
  formatCurrency,
  Phase,
  Territory,
  CompetitivePosition,
  Modality,
  DataQuality,
  LineOfTherapy,
  TreatmentApproach,
  BiomarkerStatus,
  CombinationPotential,
  BBBPenetration,
  DiseaseProgression,
  BiomarkerValidation,
  phaseOptions,
  territoryOptions,
  competitivePositionOptions,
  modalityOptions,
  neurologyModalityOptions,
  dataQualityOptions,
  lineOfTherapyOptions,
  treatmentApproachOptions,
  biomarkerOptions,
  combinationPotentialOptions,
  bbbPenetrationOptions,
  diseaseProgressionOptions,
  biomarkerValidationOptions,
  immunologyModalityOptions,
  immuneResetOptions,
  targetSpecificityOptions,
  diseaseSeverityOptions,
  treatmentGoalOptions,
  ImmuneResetPotential,
  TargetSpecificity,
  DiseaseSeverity,
  ImmunologyTreatmentGoal,
  MetabolicIndication,
  MechanismDifferentiation,
  WeightLossEfficacy,
  RouteOfAdministration,
  ComorbidityBreadth,
  MetabolicTreatmentApproach,
  metabolicModalityOptions,
  metabolicIndicationOptions,
  mechanismDifferentiationOptions,
  weightLossEfficacyOptions,
  routeOfAdministrationOptions,
  comorbidityBreadthOptions,
  metabolicTreatmentApproachOptions,
  rareDiseaseModalityOptions,
  rareDiseaseIndicationOptions,
  orphanDesignationOptions,
  patientPopulationSizeOptions,
  geneticBasisOptions,
  hematologyModalityOptions,
  hematologyIndicationOptions,
  hemeLineageOptions,
  transplantEligibilityOptions,
  mrdStatusOptions,
  dermatologyModalityOptions,
  dermatologyIndicationOptions,
  skinSeverityOptions,
  chronicityProfileOptions,
  topicalVsSystemicOptions,
  gastroenterologyModalityOptions,
  gastroenterologyIndicationOptions,
  giSegmentOptions,
  biologicExperienceOptions,
  endoscopicEndpointOptions,
  dealTypeOptions,
  DealType,
} from './calculations';

// Types for sensitivity analysis
export interface ParameterOption {
  value: string;
  label: string;
  resultingUpfront: number;
  resultingTotalValue: number;
  delta: number;
  deltaPercent: number;
}

export type ImpactLevel = 'VERY HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ParameterSensitivity {
  parameterKey: keyof CalculationInput;
  label: string;
  currentValue: string;
  currentLabel: string;
  options: ParameterOption[];
  maxPositiveDelta: number;
  maxNegativeDelta: number;
  impactRange: number;
  impactLevel: ImpactLevel;
}

export interface TopValueDriver {
  parameterKey: string;
  parameterLabel: string;
  bestOption: ParameterOption;
  insightText: string;
}

export interface NeurologyInsight {
  title: string;
  description: string;
  impactLevel: ImpactLevel;
  category: 'bbb_penetration' | 'disease_progression' | 'biomarker_validation' | 'competitive_landscape' | 'line_of_therapy' | 'combination_strategy' | 'cv_outcome' | 'trial_endpoint' | 'resistance_profile' | 'infection_chronicity' | 'ocular_delivery' | 'treatment_durability' | 'unmet_need' | 'regulatory_pathway';
}

export interface SensitivityData {
  currentUpfront: number;
  currentTotalValue: number;
  parameters: ParameterSensitivity[];
  topValueDriver: TopValueDriver;
  neurologyInsights: NeurologyInsight[];
  computedAt: number;
}

// Parameter display labels
const parameterLabels: Record<string, string> = {
  phase: 'Development Phase',
  territory: 'Territory',
  competitivePosition: 'Competitive Position',
  modality: 'Modality',
  dataQuality: 'Data Quality',
  lineOfTherapy: 'Line of Therapy',
  treatmentApproach: 'Treatment Approach',
  biomarker: 'Biomarker Status',
  combinationPotential: 'Combination Potential',
  bbbPenetration: 'BBB Penetration',
  diseaseProgression: 'Disease Progression',
  biomarkerValidation: 'Biomarker Validation',
  immuneResetPotential: 'Immune Reset Potential',
  targetSpecificity: 'Target Specificity',
  diseaseSeverity: 'Disease Severity',
  treatmentGoal: 'Treatment Goal',
  mechanismDifferentiation: 'Mechanism Differentiation',
  weightLossEfficacy: 'Weight Loss Efficacy',
  routeOfAdministration: 'Route of Administration',
  comorbidityBreadth: 'Comorbidity Breadth',
  metabolicTreatmentApproach: 'Treatment Approach',
  orphanDesignation: 'Orphan Designation',
  patientPopulationSize: 'Patient Population Size',
  geneticBasis: 'Genetic Basis',
  hemeLineage: 'Lineage',
  transplantEligibility: 'Transplant Eligibility',
  mrdStatus: 'MRD / Response Endpoint',
  skinSeverity: 'Skin Severity',
  chronicityProfile: 'Chronicity Profile',
  topicalVsSystemic: 'Delivery Route',
  giSegment: 'GI Segment',
  biologicExperience: 'Biologic Experience',
  endoscopicEndpoint: 'Endoscopic Endpoint',
  dealType: 'Deal Structure',
  deliveryRoute: 'Delivery Route',
};

// Flatten grouped options (for modality, indication)
function flattenOptions(
  groupedOptions: Array<{ group: string; options: Array<{ value: string; label: string }> }>
): Array<{ value: string; label: string }> {
  return groupedOptions.flatMap(g => g.options);
}

// Get options for a parameter (therapeutic-area-aware)
function getOptionsForParameter(
  parameterKey: keyof CalculationInput,
  isNeurology: boolean = false,
  isImmunology: boolean = false,
  isMetabolic: boolean = false,
  isRareDisease: boolean = false,
  isHematology: boolean = false,
  isDermatology: boolean = false,
  isGastroenterology: boolean = false
): Array<{ value: string; label: string }> {
  switch (parameterKey) {
    case 'phase':
      return phaseOptions;
    case 'territory':
      return territoryOptions;
    case 'competitivePosition':
      return competitivePositionOptions;
    case 'modality':
      return flattenOptions(
        isGastroenterology ? gastroenterologyModalityOptions :
        isDermatology ? dermatologyModalityOptions :
        isHematology ? hematologyModalityOptions :
        isRareDisease ? rareDiseaseModalityOptions :
        isMetabolic ? metabolicModalityOptions :
        isImmunology ? immunologyModalityOptions :
        isNeurology ? neurologyModalityOptions :
        modalityOptions
      );
    case 'indication':
      return isGastroenterology ? flattenOptions(gastroenterologyIndicationOptions) :
        isDermatology ? flattenOptions(dermatologyIndicationOptions) :
        isHematology ? flattenOptions(hematologyIndicationOptions) :
        isRareDisease ? flattenOptions(rareDiseaseIndicationOptions) :
        isMetabolic ? flattenOptions(metabolicIndicationOptions) : [];
    case 'dataQuality':
      return dataQualityOptions;
    case 'lineOfTherapy':
      return lineOfTherapyOptions;
    case 'treatmentApproach':
      return treatmentApproachOptions;
    case 'biomarker':
      return biomarkerOptions;
    case 'combinationPotential':
      return combinationPotentialOptions;
    case 'bbbPenetration':
      return bbbPenetrationOptions;
    case 'diseaseProgression':
      return diseaseProgressionOptions;
    case 'biomarkerValidation':
      return biomarkerValidationOptions;
    case 'immuneResetPotential':
      return immuneResetOptions;
    case 'targetSpecificity':
      return targetSpecificityOptions;
    case 'diseaseSeverity':
      return diseaseSeverityOptions;
    case 'treatmentGoal':
      return treatmentGoalOptions;
    case 'mechanismDifferentiation':
      return mechanismDifferentiationOptions;
    case 'weightLossEfficacy':
      return weightLossEfficacyOptions;
    case 'routeOfAdministration':
      return routeOfAdministrationOptions;
    case 'deliveryRoute': {
      const { deliveryRouteOptionsByTA } = require('./financial/delivery-routes');
      const taKey = isNeurology ? 'neurology' : isImmunology ? 'immunology' : isMetabolic ? 'metabolic' : isRareDisease ? 'rareDisease' : isHematology ? 'hematology' : isDermatology ? 'dermatology' : isGastroenterology ? 'gastroenterology' : 'oncology';
      return (deliveryRouteOptionsByTA[taKey] ?? []).map((o: { value: string; label: string }) => ({ value: o.value, label: o.label }));
    }
    case 'comorbidityBreadth':
      return comorbidityBreadthOptions;
    case 'metabolicTreatmentApproach':
      return metabolicTreatmentApproachOptions;
    // Rare Disease
    case 'orphanDesignation':
      return orphanDesignationOptions;
    case 'patientPopulationSize':
      return patientPopulationSizeOptions;
    case 'geneticBasis':
      return geneticBasisOptions;
    // Hematology
    case 'hemeLineage':
      return hemeLineageOptions;
    case 'transplantEligibility':
      return transplantEligibilityOptions;
    case 'mrdStatus':
      return mrdStatusOptions;
    // Dermatology
    case 'skinSeverity':
      return skinSeverityOptions;
    case 'chronicityProfile':
      return chronicityProfileOptions;
    case 'topicalVsSystemic':
      return topicalVsSystemicOptions;
    // Gastroenterology
    case 'giSegment':
      return giSegmentOptions;
    case 'biologicExperience':
      return biologicExperienceOptions;
    case 'endoscopicEndpoint':
      return endoscopicEndpointOptions;
    case 'dealType':
      return dealTypeOptions;
    default:
      return [];
  }
}

// Calculate sensitivity for a single parameter
function computeParameterSensitivity(
  baseResult: CalculationResult,
  baseInputs: CalculationInput,
  parameterKey: keyof CalculationInput
): ParameterSensitivity | null {
  // Skip regulatory designations (boolean flags, handled differently)
  if (parameterKey === 'regulatoryDesignations' || parameterKey === 'indication' || parameterKey === 'therapeuticArea') {
    return null;
  }

  const isNeurology = baseInputs.therapeuticArea === 'neurology';
  const isImmunology = baseInputs.therapeuticArea === 'immunology';
  const isMetabolic = baseInputs.therapeuticArea === 'metabolic';
  const isRareDisease = baseInputs.therapeuticArea === 'rareDisease';
  const isHematology = baseInputs.therapeuticArea === 'hematology';
  const isDermatology = baseInputs.therapeuticArea === 'dermatology';
  const isGastroenterology = baseInputs.therapeuticArea === 'gastroenterology';
  const options = getOptionsForParameter(parameterKey, isNeurology, isImmunology, isMetabolic, isRareDisease, isHematology, isDermatology, isGastroenterology);
  if (options.length === 0) return null;

  const rawValue = baseInputs[parameterKey];
  // dealType defaults to 'licensing' when not set
  if (rawValue === undefined || rawValue === null) {
    if (parameterKey === 'dealType') {
      // Treat missing dealType as 'licensing' (the default)
    } else {
      return null;
    }
  }
  const currentValue = parameterKey === 'dealType' && !rawValue ? 'licensing' : String(rawValue);
  const baseTotalValue = baseResult.terms.totalDealValue.median;
  const baseUpfront = baseResult.terms.upfront.median;

  const computedOptions: (ParameterOption | null)[] = options.map(opt => {
    if (opt.value === currentValue) {
      return {
        value: opt.value,
        label: opt.label,
        resultingUpfront: baseUpfront,
        resultingTotalValue: baseTotalValue,
        delta: 0,
        deltaPercent: 0,
      };
    }

    // Create modified inputs with only this parameter changed
    try {
      const modifiedInputs = { ...baseInputs, [parameterKey]: opt.value };
      const modifiedResult = calculateDealTerms(modifiedInputs as CalculationInput);
      const newTotalValue = modifiedResult.terms.totalDealValue.median;
      const newUpfront = modifiedResult.terms.upfront.median;

      // Validation: if the variation produces EXACTLY the same output as the
      // base case, the parameter lookup likely fell back to the default
      // multiplier of 1.0 (i.e., the new value is invalid for the current
      // indication/TA combination). Skip to avoid showing misleading zero
      // deltas as legitimate sensitivity data.
      if (
        opt.value !== currentValue &&
        newTotalValue === baseTotalValue &&
        newUpfront === baseUpfront
      ) {
        if (typeof console !== 'undefined') {
          console.warn(
            `[sensitivity] Skipping ${String(parameterKey)}='${opt.value}' for ` +
            `indication='${baseInputs.indication}', TA='${baseInputs.therapeuticArea}': ` +
            `variation produced no change (likely invalid combination using fallback multiplier).`,
          );
        }
        return null;
      }

      const denom = baseTotalValue !== 0 ? Math.abs(baseTotalValue) : 1;
      return {
        value: opt.value,
        label: opt.label,
        resultingUpfront: newUpfront,
        resultingTotalValue: newTotalValue,
        delta: newTotalValue - baseTotalValue,
        deltaPercent: ((newTotalValue - baseTotalValue) / denom) * 100,
      };
    } catch {
      // If calculation fails for this option, skip instead of faking no-change
      if (typeof console !== 'undefined') {
        console.warn(
          `[sensitivity] Calculation threw for ${String(parameterKey)}='${opt.value}', skipping`,
        );
      }
      return null;
    }
  });

  // Filter out skipped variations
  const validOptions: ParameterOption[] = computedOptions.filter(
    (o): o is ParameterOption => o !== null,
  );
  if (validOptions.length === 0) return null;

  // Calculate impact range
  const deltas = validOptions.map(o => o.delta);
  const maxPositive = Math.max(0, ...deltas);
  const maxNegative = Math.min(0, ...deltas);
  const impactRange = maxPositive - maxNegative;

  // Determine impact level based on percentage range.
  // Use absolute base value in the denominator so a negative base rNPV still
  // produces meaningful relative deltas instead of silently collapsing to 0%.
  const impactDenom = baseTotalValue !== 0 ? Math.abs(baseTotalValue) : 1;
  const impactPercent = (impactRange / impactDenom) * 100;
  const impactLevel: ImpactLevel =
    impactPercent > 100 ? 'VERY HIGH' :
    impactPercent > 30 ? 'HIGH' :
    impactPercent > 15 ? 'MEDIUM' : 'LOW';

  const currentOption = options.find(o => o.value === currentValue);

  return {
    parameterKey,
    label: parameterLabels[parameterKey] || parameterKey,
    currentValue,
    currentLabel: currentOption?.label || currentValue,
    options: validOptions.sort((a, b) => b.resultingTotalValue - a.resultingTotalValue),
    maxPositiveDelta: maxPositive,
    maxNegativeDelta: maxNegative,
    impactRange,
    impactLevel,
  };
}

// Generate insight text for the top value driver
function generateInsightText(param: ParameterSensitivity, bestOption: ParameterOption): string {
  const deltaFormatted = formatCurrency(Math.abs(bestOption.delta));
  const percentFormatted = Math.abs(bestOption.deltaPercent).toFixed(0);

  if (bestOption.delta > 0) {
    return `Your #1 value driver is ${param.label.toUpperCase()}. ${bestOption.label} would add ${deltaFormatted} (+${percentFormatted}%) to total deal value.`;
  } else if (bestOption.delta < 0) {
    return `Your current ${param.label.toLowerCase()} selection is optimal. Alternative options would reduce deal value.`;
  }
  return `Your current ${param.label.toLowerCase()} is set optimally for maximum deal value.`;
}

// Find the top value driver (single biggest improvement opportunity)
function findTopValueDriver(parameters: ParameterSensitivity[]): TopValueDriver {
  if (parameters.length === 0) {
    return {
      parameterKey: 'phase' as keyof CalculationInput,
      parameterLabel: 'Development Phase',
      bestOption: { value: '', label: '', resultingUpfront: 0, resultingTotalValue: 0, delta: 0, deltaPercent: 0 },
      insightText: 'No parameters available for sensitivity analysis.',
    };
  }

  let bestImprovement = {
    param: parameters[0],
    option: parameters[0].options[0] || {
      value: '',
      label: '',
      resultingUpfront: 0,
      resultingTotalValue: 0,
      delta: 0,
      deltaPercent: 0,
    },
  };

  for (const param of parameters) {
    for (const opt of param.options) {
      if (opt.delta > bestImprovement.option.delta) {
        bestImprovement = { param, option: opt };
      }
    }
  }

  return {
    parameterKey: bestImprovement.param.parameterKey,
    parameterLabel: bestImprovement.param.label,
    bestOption: bestImprovement.option,
    insightText: generateInsightText(bestImprovement.param, bestImprovement.option),
  };
}

// Generate neurology-specific insights based on asset characteristics
function generateNeurologyInsights(inputs: CalculationInput): NeurologyInsight[] {
  if (inputs.therapeuticArea !== 'neurology') return [];

  const insights: NeurologyInsight[] = [];

  // BBB Penetration Risk — based on modality
  const highBBBModalities = ['bbbPlatform', 'aso', 'geneTherapy', 'aav_gene_therapy'];
  const mediumBBBModalities = ['antibody', 'adc', 'bispecific'];
  const bbbLevel: ImpactLevel = highBBBModalities.includes(inputs.modality)
    ? 'HIGH'
    : mediumBBBModalities.includes(inputs.modality)
    ? 'MEDIUM'
    : 'LOW';

  insights.push({
    title: 'BBB Penetration Risk',
    description: bbbLevel === 'HIGH'
      ? 'This modality faces significant blood-brain barrier delivery challenges. Deals for BBB-crossing platforms command higher upfronts but carry elevated technical risk, impacting milestone probability.'
      : bbbLevel === 'MEDIUM'
      ? 'Large-molecule modalities have moderate BBB penetration hurdles. Consider platform enhancements or intrathecal delivery when structuring milestone triggers.'
      : 'Small molecules have favorable BBB penetration profiles. This reduces delivery risk and may support more milestone-weighted deal structures.',
    impactLevel: bbbLevel,
    category: 'bbb_penetration',
  });

  // Disease Progression Assumptions — based on treatment approach
  const progressionLevel: ImpactLevel = inputs.treatmentApproach === 'diseaseModifying'
    ? 'VERY HIGH'
    : inputs.treatmentApproach === 'adjunctive'
    ? 'MEDIUM'
    : 'LOW';

  insights.push({
    title: 'Disease Progression Assumptions',
    description: progressionLevel === 'VERY HIGH'
      ? 'Disease-modifying endpoints require very long trials (18-36+ months) with validated biomarkers. Expect higher development milestones but significant regulatory and market access uncertainty.'
      : progressionLevel === 'MEDIUM'
      ? 'Adjunctive therapies face moderate endpoint complexity. Clear differentiation from standard of care is critical for commercial milestone achievement.'
      : 'Symptomatic endpoints are well-established with shorter trial timelines. This supports more predictable milestone schedules and lower development risk.',
    impactLevel: progressionLevel,
    category: 'disease_progression',
  });

  // Biomarker Validation Status — based on indication
  const establishedBiomarkerIndications = ['alzheimers', 'parkinsons', 'huntingtons'];
  const emergingBiomarkerIndications = ['als', 'ms', 'depression'];
  const biomarkerLevel: ImpactLevel = establishedBiomarkerIndications.includes(inputs.indication)
    ? 'MEDIUM'
    : emergingBiomarkerIndications.includes(inputs.indication)
    ? 'HIGH'
    : 'VERY HIGH';

  insights.push({
    title: 'Biomarker Validation Status',
    description: biomarkerLevel === 'MEDIUM'
      ? 'This indication has established biomarkers (e.g., amyloid PET, tau, neurofilament light). This supports accelerated approval pathways and can justify higher deal valuations.'
      : biomarkerLevel === 'HIGH'
      ? 'Emerging biomarkers exist but regulatory acceptance varies. Trial design should incorporate biomarker endpoints to de-risk and potentially accelerate development.'
      : 'Limited validated biomarkers for this indication. Deals may be structured with more back-loaded milestones pending clinical endpoint validation.',
    impactLevel: biomarkerLevel,
    category: 'biomarker_validation',
  });

  return insights;
}

// Generate immunology-specific insights based on asset characteristics
function generateImmunologyInsights(inputs: CalculationInput): NeurologyInsight[] {
  if (inputs.therapeuticArea !== 'immunology') return [];

  const insights: NeurologyInsight[] = [];

  // Immune Reset Risk — based on immuneResetPotential
  const irKey = inputs.immuneResetPotential || 'chronicTreatment';
  const irLevel: ImpactLevel = irKey === 'curativeIntent'
    ? 'VERY HIGH'
    : irKey === 'durableRemission'
    ? 'HIGH'
    : 'LOW';

  insights.push({
    title: 'Immune Reset Risk',
    description: irLevel === 'VERY HIGH'
      ? 'Curative-intent approaches (CAR-T, tolerance induction) aim for drug-free remission. These command the highest premiums but carry significant manufacturing, durability, and safety risk. Milestone structures tied to remission durability are critical.'
      : irLevel === 'HIGH'
      ? 'Durable remission approaches (deep B-cell depletion, immune resetting) offer months-to-years of disease control. Development milestones are weighted toward durability endpoints and relapse-free survival.'
      : 'Chronic treatment models provide predictable recurring revenue. Lower risk profile but face biosimilar/generic pressure. Commercial milestones dominate deal value.',
    impactLevel: irLevel,
    category: 'bbb_penetration', // reusing category structure
  });

  // Target Specificity Assessment — based on targetSpecificity
  const tsKey = inputs.targetSpecificity || 'pathwayTargeted';
  const tsLevel: ImpactLevel = tsKey === 'antigenSpecific'
    ? 'HIGH'
    : tsKey === 'broadImmunosuppression'
    ? 'VERY HIGH'
    : 'MEDIUM';

  insights.push({
    title: 'Target Specificity Assessment',
    description: tsLevel === 'HIGH'
      ? 'Antigen-specific approaches (CAR-Treg, tolerizing therapies) represent the next frontier — targeting only disease-driving antigens with minimal immunosuppression. Premium valuations for differentiated safety profiles.'
      : tsLevel === 'VERY HIGH'
      ? 'Broad immunosuppression faces commoditization pressure and infection risk concerns. Box warnings on JAK inhibitors cooled the market. Differentiation via selectivity or novel mechanism is critical for premium terms.'
      : 'Pathway-targeted approaches (IL-23, TL1A, complement) are the standard for autoimmune. Well-validated mechanisms with established regulatory pathways support predictable deal structures.',
    impactLevel: tsLevel,
    category: 'disease_progression',
  });

  // Disease Severity Impact — based on diseaseSeverity
  const dsKey = inputs.diseaseSeverity || 'moderateSevere';
  const dsLevel: ImpactLevel = dsKey === 'refractory'
    ? 'VERY HIGH'
    : dsKey === 'severe'
    ? 'HIGH'
    : dsKey === 'moderateSevere'
    ? 'MEDIUM'
    : 'LOW';

  insights.push({
    title: 'Disease Severity Impact',
    description: dsLevel === 'VERY HIGH'
      ? 'Multi-refractory patients who have failed multiple lines represent the highest unmet need. CAR-T and novel mechanisms are most appropriate. Orphan-like pricing and premium deal terms expected.'
      : dsLevel === 'HIGH'
      ? 'Severe/refractory disease justifies aggressive therapies with higher risk profiles. Biologic and cell therapy approaches are appropriate. Premium pricing and orphan-adjacent market dynamics apply.'
      : dsLevel === 'MEDIUM'
      ? 'Moderate-to-severe is the sweet spot: large enough population for blockbuster potential, high enough need to justify premium therapies. Most autoimmune deals target this segment.'
      : 'Mild-moderate disease has the largest patient population but lower willingness to use aggressive or expensive therapies. Oral and topical approaches preferred. Price sensitivity limits deal premiums.',
    impactLevel: dsLevel,
    category: 'biomarker_validation',
  });

  return insights;
}

// Generate metabolic/obesity-specific insights based on asset characteristics
function generateMetabolicInsights(inputs: CalculationInput): NeurologyInsight[] {
  if (inputs.therapeuticArea !== 'metabolic') return [];

  const insights: NeurologyInsight[] = [];

  // Competitive Differentiation Risk — based on mechanismDifferentiation and weightLossEfficacy
  const mdKey = inputs.mechanismDifferentiation || 'incretinBased';
  const wlKey = inputs.weightLossEfficacy || 'competitiveEfficacy';
  let diffLevel: ImpactLevel;
  if (wlKey === 'superiorEfficacy' && mdKey === 'combinationMechanism') {
    diffLevel = 'LOW';
  } else if (wlKey === 'competitiveEfficacy' && mdKey === 'incretinBased') {
    diffLevel = 'MEDIUM';
  } else if (wlKey === 'modestEfficacy') {
    diffLevel = mdKey === 'incretinBased' ? 'VERY HIGH' : 'HIGH';
  } else {
    // Other combinations (e.g., superiorEfficacy + incretinBased, competitiveEfficacy + nonIncretin, etc.)
    diffLevel = 'MEDIUM';
  }

  insights.push({
    title: 'Competitive Differentiation Risk',
    description: diffLevel === 'LOW'
      ? 'Superior efficacy combined with a multi-pathway mechanism provides the strongest differentiation against GLP-1 incumbents. This profile commands premium deal terms — partners pay for clear superiority data and novel biology that extends beyond the incretin class.'
      : diffLevel === 'MEDIUM'
      ? 'Competitive efficacy within the incretin class faces direct comparison to semaglutide and tirzepatide. Differentiation via dosing convenience, side-effect profile, or muscle-sparing properties is critical for premium deal structures.'
      : diffLevel === 'HIGH'
      ? 'Modest weight loss efficacy limits competitive positioning against best-in-class GLP-1 programs. Partners will discount commercial milestones and may seek combination rights or niche indication positioning.'
      : 'Modest efficacy in a crowded incretin landscape creates significant commercial risk. Deal structures will heavily weight milestones toward differentiation data, with limited upfront commitment from partners.',
    impactLevel: diffLevel,
    category: 'competitive_landscape',
  });

  // Route of Administration Impact — based on routeOfAdministration
  const roaKey = inputs.routeOfAdministration || 'injectable';
  const roaLevel: ImpactLevel = roaKey === 'oral'
    ? 'LOW'
    : roaKey === 'injectable'
    ? 'MEDIUM'
    : 'MEDIUM'; // implantable

  insights.push({
    title: 'Route of Administration Impact',
    description: roaLevel === 'LOW'
      ? 'Oral administration is the holy grail for obesity/metabolic drugs — oral semaglutide proved the concept, but best-in-class oral efficacy remains elusive. Oral delivery commands premium positioning and 20-30% higher deal terms versus injectable equivalents.'
      : roaKey === 'injectable'
      ? 'Injectable (subcutaneous) delivery is the current standard for GLP-1 therapies. Well-established patient acceptance and compliance profiles. Deal structures reflect standard market positioning without oral premium or implantable novelty discount.'
      : 'Implantable / long-acting depot delivery is an emerging approach offering monthly or less frequent dosing. Novel but unproven commercial model — partners value the convenience thesis but require clinical validation of sustained efficacy and safety.',
    impactLevel: roaLevel,
    category: 'line_of_therapy',
  });

  // Comorbidity Expansion Potential — based on comorbidityBreadth and indication
  const cbKey = inputs.comorbidityBreadth || 'obesityPrimary';
  const cbLevel: ImpactLevel = cbKey === 'cardiometabolicBenefit'
    ? 'LOW'
    : cbKey === 'organProtective'
    ? 'MEDIUM'
    : 'HIGH';

  insights.push({
    title: 'Comorbidity Expansion Potential',
    description: cbLevel === 'LOW'
      ? 'Cardiometabolic benefit profile (CV risk reduction + metabolic improvement) enables the broadest label expansion — obesity, T2D, NASH, heart failure, CKD. This is the semaglutide playbook: each new indication multiplies commercial value. Partners structure deals with aggressive indication expansion milestones.'
      : cbLevel === 'MEDIUM'
      ? 'Organ-protective profile (liver, kidney, or cardiac benefit) supports targeted label expansion beyond primary indication. NASH/MASH and CKD indications add significant commercial upside. Deal structures include indication-specific milestones.'
      : 'Obesity-primary positioning with weight loss as the sole value driver creates single-indication concentration risk. Without cardiometabolic or organ-protective data, commercial milestones are limited to weight management market only. Partners may discount total deal value accordingly.',
    impactLevel: cbLevel,
    category: 'combination_strategy',
  });

  return insights;
}

// Generate oncology-specific insights based on asset characteristics
function generateOncologyInsights(inputs: CalculationInput): NeurologyInsight[] {
  if (inputs.therapeuticArea !== 'oncology') return [];

  const insights: NeurologyInsight[] = [];

  // Competitive Landscape Risk — based on competitivePosition
  const cpLevel: ImpactLevel = inputs.competitivePosition === 'crowded'
    ? 'VERY HIGH'
    : inputs.competitivePosition === 'behind' || inputs.competitivePosition === 'racing'
    ? 'HIGH'
    : inputs.competitivePosition === 'bestInClass'
    ? 'MEDIUM'
    : 'LOW';

  insights.push({
    title: 'Competitive Landscape Risk',
    description: cpLevel === 'VERY HIGH'
      ? 'Crowded competitive space with multiple late-stage programs. Differentiation is critical — without clear superiority data, commercial milestones face significant execution risk. Deals may shift value toward upfront payments.'
      : cpLevel === 'HIGH'
      ? 'Racing or behind in a competitive landscape. Speed to approval is paramount. Expect partners to negotiate higher milestones tied to being first or second to market, with commercial clawbacks if timing slips.'
      : cpLevel === 'MEDIUM'
      ? 'Best-in-class positioning with differentiated data. Strong negotiating position for premium milestones, but partners will require head-to-head data or clear mechanistic advantages to justify top-tier terms.'
      : 'First-in-class mechanism with a clear differentiation window. Commands the highest premiums — partners pay for exclusivity and novel biology. Upfronts typically 15-25% above market averages.',
    impactLevel: cpLevel,
    category: 'competitive_landscape',
  });

  // Line of Therapy Risk — based on lineOfTherapy
  const lotLevel: ImpactLevel = inputs.lineOfTherapy === '1L'
    ? 'VERY HIGH'
    : inputs.lineOfTherapy === '2L'
    ? 'MEDIUM'
    : 'HIGH';

  insights.push({
    title: 'Line of Therapy Risk',
    description: lotLevel === 'VERY HIGH'
      ? 'First-line oncology trials require large, long Phase 3 studies with OS/PFS endpoints against standard of care. Highest commercial payoff but longest and most expensive development path. Expect milestone-heavy deal structures.'
      : lotLevel === 'MEDIUM'
      ? 'Second-line has well-defined patient populations and established endpoints. Moderate trial size with clearer regulatory path. Balanced deal structures between upfront and milestones.'
      : 'Third-line and beyond targets smaller, heavily pretreated populations. Faster trials with accelerated approval potential, but smaller commercial opportunity limits total deal value. Higher upfront percentage typical.',
    impactLevel: lotLevel,
    category: 'line_of_therapy',
  });

  // Combination Strategy Risk — based on combinationPotential
  const combLevel: ImpactLevel = inputs.combinationPotential === 'strong'
    ? 'LOW'
    : inputs.combinationPotential === 'some'
    ? 'MEDIUM'
    : 'HIGH';

  insights.push({
    title: 'Combination Strategy Risk',
    description: combLevel === 'LOW'
      ? 'Strong combination potential significantly expands addressable market. IO combinations, ADC + checkpoint, and bispecific + chemo regimens are driving the largest oncology deals. Partners value platform optionality.'
      : combLevel === 'MEDIUM'
      ? 'Some combination potential exists but requires clinical validation. Partners may structure milestone payments around combination study readouts. Consider co-development structures for combination trials.'
      : 'Standalone therapy positioning limits addressable market expansion. Monotherapy-only programs face higher commercial risk, especially in IO-dominant indications. Partners may discount commercial milestones accordingly.',
    impactLevel: combLevel,
    category: 'combination_strategy',
  });

  return insights;
}

// Generate cardiovascular-specific insights
function generateCardiovascularInsights(inputs: CalculationInput): NeurologyInsight[] {
  if (inputs.therapeuticArea !== 'cardiovascular') return [];
  const insights: NeurologyInsight[] = [];

  const outcomeLevel: ImpactLevel = inputs.cvOutcomeBenefit === 'mortalityReduction' ? 'VERY HIGH'
    : inputs.cvOutcomeBenefit === 'hospitalizationReduction' ? 'HIGH' : 'MEDIUM';
  insights.push({
    title: 'CV Outcome Evidence',
    description: outcomeLevel === 'VERY HIGH'
      ? 'Mortality reduction is the gold standard in CV — DAPA-HF, EMPEROR-Reduced set the bar. Expect premium valuations but require large, long CVOT trials ($500M+ investment). Milestone-heavy structures with back-loaded payments.'
      : outcomeLevel === 'HIGH'
      ? 'Hospitalization reduction (PARADIGM-HF model) is a strong endpoint accepted by FDA/EMA. Moderate trial investment with clear clinical benefit. Balanced deal structures with meaningful development milestones.'
      : 'Symptom improvement endpoints (6MWT, KCCQ) allow faster/smaller trials but face payer pushback. Partners may request CVOT commitment as a post-deal milestone. Lower total deal value but faster path to market.',
    impactLevel: outcomeLevel,
    category: 'cv_outcome',
  });

  const endpointLevel: ImpactLevel = inputs.cvTrialEndpoint === 'maceEndpoint' ? 'HIGH'
    : inputs.cvTrialEndpoint === 'surrogateBiomarker' ? 'MEDIUM' : 'LOW';
  insights.push({
    title: 'Trial Endpoint Strategy',
    description: endpointLevel === 'HIGH'
      ? 'MACE endpoint trials are the most definitive but require 10,000+ patients and 3-5 years. De-risks the asset substantially — partners pay premiums for hard outcome data. CVOT commitment often negotiated as milestone.'
      : endpointLevel === 'MEDIUM'
      ? 'Surrogate biomarker endpoints (NT-proBNP, imaging) enable faster approvals. Moderate de-risking but payers increasingly demand outcomes data. Partners may structure conditional milestones around CVOT outcomes.'
      : 'Functional endpoints (6MWT, KCCQ) allow efficient trials but limited regulatory and payer acceptance for new mechanisms. Consider as a bridge strategy with CVOT commitment in deal terms.',
    impactLevel: endpointLevel,
    category: 'trial_endpoint',
  });

  return insights;
}

// Generate infectious disease-specific insights
function generateInfectiousDiseaseInsights(inputs: CalculationInput): NeurologyInsight[] {
  if (inputs.therapeuticArea !== 'infectiousDisease') return [];
  const insights: NeurologyInsight[] = [];

  const resistLevel: ImpactLevel = inputs.resistanceProfile === 'novelTarget' ? 'LOW'
    : inputs.resistanceProfile === 'existingClassImproved' ? 'MEDIUM' : 'HIGH';
  insights.push({
    title: 'Antimicrobial Resistance Positioning',
    description: resistLevel === 'LOW'
      ? 'Novel target addressing resistance commands the highest premiums. CARB-X and BARDA funding available. Pull incentives (PASTEUR Act, UK subscription model) add non-dilutive value. Partners value novel mechanisms for portfolio protection.'
      : resistLevel === 'MEDIUM'
      ? 'Improved within existing class — better PK, tolerability, or resistance profile. Moderate differentiation. Partners will benchmark against generic alternatives and require head-to-head data to justify premium pricing.'
      : 'Broad-spectrum coverage is standard positioning. Competition from generics is intense. Pull incentives favor targeted agents. Consider partnership with specialty anti-infective companies rather than big pharma.',
    impactLevel: resistLevel,
    category: 'resistance_profile',
  });

  const chronicityLevel: ImpactLevel = inputs.infectionChronicity === 'chronic' ? 'LOW'
    : inputs.infectionChronicity === 'latent' ? 'MEDIUM' : 'HIGH';
  insights.push({
    title: 'Infection Chronicity Impact',
    description: chronicityLevel === 'LOW'
      ? 'Chronic infections (HBV, HIV) offer the most attractive commercial profile — recurring revenue, large patient pools, and established regulatory pathways. Functional cure approaches command the highest premiums in current deal landscape.'
      : chronicityLevel === 'MEDIUM'
      ? 'Latent infections (TB, HSV) offer eradication potential but face complex clinical trial design. Sterilizing cure is the holy grail — demonstrated in HCV with DAAs. Partners value curative approaches if clinical data supports them.'
      : 'Acute infection treatments face fast development but limited per-patient revenue. Market size depends on incidence rates. Pandemic preparedness programs (BARDA) provide non-dilutive funding for priority pathogens.',
    impactLevel: chronicityLevel,
    category: 'infection_chronicity',
  });

  return insights;
}

// Generate ophthalmology-specific insights
function generateOphthalmologyInsights(inputs: CalculationInput): NeurologyInsight[] {
  if (inputs.therapeuticArea !== 'ophthalmology') return [];
  const insights: NeurologyInsight[] = [];

  const deliveryLevel: ImpactLevel = inputs.ocularDelivery === 'implant' ? 'LOW'
    : inputs.ocularDelivery === 'intravitreal' ? 'MEDIUM'
    : inputs.ocularDelivery === 'topical' ? 'HIGH' : 'VERY HIGH';
  insights.push({
    title: 'Ocular Delivery Strategy',
    description: deliveryLevel === 'LOW'
      ? 'Sustained-release implant delivery reduces treatment burden dramatically — key differentiator in a space dominated by monthly/bimonthly injections. PDS (Susvimo), gene therapy, and long-acting formulations command premium valuations.'
      : deliveryLevel === 'MEDIUM'
      ? 'Intravitreal injection is the established standard. Competition with aflibercept, ranibizumab, faricimab is intense. Differentiation through durability, efficacy, or novel targets is essential. Standard deal structures.'
      : deliveryLevel === 'HIGH'
      ? 'Topical delivery is patient-friendly but limited to anterior segment. Posterior segment conditions require alternative delivery. Consider topical as combination partner or for front-of-eye indications.'
      : 'Oral delivery for ocular conditions faces bioavailability challenges and systemic exposure risks. Limited partner interest unless targeting inflammatory/systemic components. Niche positioning required.',
    impactLevel: deliveryLevel,
    category: 'ocular_delivery',
  });

  const durabilityLevel: ImpactLevel = inputs.treatmentDurability === 'oneTime' ? 'LOW'
    : inputs.treatmentDurability === 'extendedDuration' ? 'MEDIUM' : 'HIGH';
  insights.push({
    title: 'Treatment Durability Value',
    description: durabilityLevel === 'LOW'
      ? 'One-time gene therapy cures (Luxturna model) command the highest premiums in ophthalmology. Outcome-based pricing and NTAP/LTSS reimbursement pathways support $500K-$2M+ per-treatment pricing. Partners value the transformative narrative.'
      : durabilityLevel === 'MEDIUM'
      ? 'Extended-duration treatments (quarterly+) reduce injection burden — the #1 patient/physician concern. Faricimab and high-dose aflibercept set the standard. Durability data is the key differentiator in current deals.'
      : 'Chronic injection regimen (monthly/bimonthly) is the baseline in retinal disease. Without durability advantage, differentiation must come from efficacy, safety, or novel mechanism. Standard valuations with intense generic/biosimilar competition.',
    impactLevel: durabilityLevel,
    category: 'treatment_durability',
  });

  return insights;
}

// Generate women's health-specific insights
function generateWomensHealthInsights(inputs: CalculationInput): NeurologyInsight[] {
  if (inputs.therapeuticArea !== 'womensHealth') return [];
  const insights: NeurologyInsight[] = [];

  const unmetLevel: ImpactLevel = inputs.whUnmetNeed === 'noApprovedTherapy' ? 'LOW'
    : inputs.whUnmetNeed === 'inadequateOptions' ? 'MEDIUM' : 'HIGH';
  insights.push({
    title: 'Unmet Need Assessment',
    description: unmetLevel === 'LOW'
      ? 'No approved therapy represents the highest value opportunity in women\'s health. Breakthrough therapy designation likely. Myovant (relugolix), Dare Bioscience, and ObsEva precedents show 25%+ deal premiums for first-to-market assets.'
      : unmetLevel === 'MEDIUM'
      ? 'Existing options are inadequate — either poor efficacy, significant side effects, or limited to short-term use. Meaningful differentiation can capture premium share. Partners value improved safety/tolerability profiles.'
      : 'Well-served therapeutic areas with multiple approved options. Competition is intense and pricing pressure from generics is significant. Differentiation through convenience, route of administration, or novel mechanism required.',
    impactLevel: unmetLevel,
    category: 'unmet_need',
  });

  const regulatoryLevel: ImpactLevel = inputs.whRegulatory === 'pregnancyComplexity' ? 'VERY HIGH'
    : inputs.whRegulatory === 'standardPathway' ? 'MEDIUM' : 'LOW';
  insights.push({
    title: 'Regulatory Pathway Complexity',
    description: regulatoryLevel === 'VERY HIGH'
      ? 'Pregnancy-related indications face complex regulatory requirements — teratogenicity studies, REMS programs, restricted distribution. Development timelines are longer but unmet need is enormous. Partners value the high barrier to competition.'
      : regulatoryLevel === 'MEDIUM'
      ? 'Standard regulatory pathway with established endpoints and trial designs. FDA Women\'s Health Office provides guidance. 505(b)(2) and biosimilar pathways available for follow-on products. Standard deal structures.'
      : 'Accelerated pathway eligibility (breakthrough, fast track) significantly de-risks the program. Shorter development timelines attract partner interest. Premium valuations for assets with FDA-granted designations.',
    impactLevel: regulatoryLevel,
    category: 'regulatory_pathway',
  });

  return insights;
}

// Generate rare disease-specific insights
function generateRareDiseaseInsights(inputs: CalculationInput): NeurologyInsight[] {
  if (inputs.therapeuticArea !== 'rareDisease') return [];
  const insights: NeurologyInsight[] = [];

  // Orphan Designation & Regulatory Advantage
  const orphanKey = inputs.orphanDesignation || 'none';
  const orphanLevel: ImpactLevel = orphanKey === 'both_orphan' ? 'LOW'
    : orphanKey === 'fda_orphan' || orphanKey === 'ema_orphan' ? 'MEDIUM' : 'VERY HIGH';
  insights.push({
    title: 'Orphan Designation & Regulatory Incentives',
    description: orphanLevel === 'LOW'
      ? 'Dual FDA + EMA orphan designation provides the strongest regulatory package: 7-year US market exclusivity, 10-year EU exclusivity, tax credits for clinical development, and waived PDUFA fees. Rare pediatric disease priority review vouchers (transferable, valued at $100M+) add further upside. Partners price in exclusivity certainty — expect 20-35% deal premiums versus non-orphan assets.'
      : orphanLevel === 'MEDIUM'
      ? 'Single-region orphan designation provides meaningful exclusivity and development incentives, but leaves a gap in the other major market. Partners will structure milestones around securing the second designation. FDA orphan grants (up to $600K/year) and EMA fee waivers reduce development costs.'
      : 'No orphan designation significantly reduces deal attractiveness in rare disease. Without exclusivity protections, generic/biosimilar competition risk increases post-approval. Partners will discount valuations and require the licensor to pursue orphan designation pre-deal or build designation milestones into the structure.',
    impactLevel: orphanLevel,
    category: 'regulatory_pathway',
  });

  // Patient Population Size Impact
  const popKey = inputs.patientPopulationSize || 'rare_10k_50k';
  const popLevel: ImpactLevel = popKey === 'ultraRare_sub1k' ? 'VERY HIGH'
    : popKey === 'rare_1k_10k' ? 'HIGH'
    : popKey === 'rare_10k_50k' ? 'MEDIUM' : 'LOW';
  insights.push({
    title: 'Patient Population & Pricing Dynamics',
    description: popLevel === 'VERY HIGH'
      ? 'Ultra-rare populations (<1,000 patients) command the highest per-patient pricing ($500K-$3M+/year for chronic, $1M-$3.5M one-time for gene therapies). Small trial sizes (N=20-50) accelerate development, but commercial infrastructure costs per patient are extreme. Partners value the near-monopoly dynamics but require confidence in diagnosis rates and patient identification.'
      : popLevel === 'HIGH'
      ? 'Rare populations (1K-10K patients) hit the sweet spot for orphan drug economics: high pricing ($200K-$800K/year), manageable trial sizes (N=50-200), and specialized commercial models. Gene therapy one-time pricing can reach $2M+. Partners structure deals with aggressive upfronts reflecting pricing certainty.'
      : popLevel === 'MEDIUM'
      ? 'Mid-range rare populations (10K-50K) offer meaningful commercial opportunity with moderate pricing ($100K-$400K/year). Larger trial requirements but established regulatory pathways. Competition from enzyme replacement and substrate reduction therapies is relevant. Standard rare disease deal structures apply.'
      : 'Broader rare populations (50K-200K) approach specialty pharma dynamics with lower per-patient pricing ($50K-$200K/year). Larger trials needed but bigger commercial opportunity. Biosimilar risk for biologics. Partners benchmark against specialty drug economics rather than ultra-orphan premiums.',
    impactLevel: popLevel,
    category: 'unmet_need',
  });

  // Genetic Basis & Target Validation
  const genKey = inputs.geneticBasis || 'unknown_genetic';
  const genLevel: ImpactLevel = genKey === 'monogenic_validated' ? 'LOW'
    : genKey === 'polygenic' ? 'MEDIUM' : 'HIGH';
  insights.push({
    title: 'Genetic Basis & Target Validation',
    description: genLevel === 'LOW'
      ? 'Monogenic disease with a validated target provides the highest confidence in mechanism and enables precision therapies (gene therapy, gene editing, ASO). Clinical development risk is reduced — natural history data and genetic diagnosis provide clear patient selection. Partners pay premiums for genetically validated targets with companion diagnostic potential.'
      : genLevel === 'MEDIUM'
      ? 'Polygenic basis complicates target selection and patient stratification. Multiple pathways may need modulation. Clinical endpoints require more traditional designs without clear genetic biomarkers. Partners expect broader clinical packages and may discount valuations versus monogenic programs.'
      : 'Unknown or non-genetic basis creates the highest target validation risk. Mechanism of action must be proven through clinical data rather than genetic rationale. Longer development timelines and larger trials needed. Partners heavily back-load milestones pending proof-of-concept data.',
    impactLevel: genLevel,
    category: 'biomarker_validation',
  });

  return insights;
}

// Generate hematology-specific insights
function generateHematologyInsights(inputs: CalculationInput): NeurologyInsight[] {
  if (inputs.therapeuticArea !== 'hematology') return [];
  const insights: NeurologyInsight[] = [];

  // Lineage & Competitive Dynamics
  const lineageKey = inputs.hemeLineage || 'lymphoid';
  const lineageLevel: ImpactLevel = lineageKey === 'myeloid' ? 'VERY HIGH'
    : lineageKey === 'lymphoid' ? 'HIGH'
    : lineageKey === 'mixed_lineage' ? 'MEDIUM' : 'LOW';
  insights.push({
    title: 'Lineage & Competitive Dynamics',
    description: lineageLevel === 'VERY HIGH'
      ? 'Myeloid malignancies (AML, MDS, myelofibrosis) remain the highest unmet need in hematology — 5-year survival rates for AML are still ~30%. Limited approved targeted therapies create premium deal opportunities. However, clinical development is challenging with heterogeneous disease biology. Partners value novel mechanisms (menin inhibitors, CD47, mutant-selective agents) that address molecular subtypes.'
      : lineageLevel === 'HIGH'
      ? 'Lymphoid malignancies have been transformed by BTK inhibitors, CAR-T, and bispecifics, creating an intensely competitive landscape. New entrants must demonstrate clear superiority: better durability, oral convenience, or activity in resistant populations (BTKi-refractory, post-CAR-T relapse). Partners benchmark aggressively against Calquence, Imbruvica, and approved CAR-T products.'
      : lineageLevel === 'MEDIUM'
      ? 'Mixed lineage targets offer broader applicability but face complex clinical development across multiple histologies. Partners may require separate pivotal studies per indication. Deal structures often include histology-specific milestones.'
      : 'Non-malignant hematology (ITP, TTP, aplastic anemia) offers differentiated deal dynamics — smaller populations, less competitive, and strong unmet need. Complement inhibitors and TPO agonists set pricing benchmarks. Partners value the predictable commercial profiles.',
    impactLevel: lineageLevel,
    category: 'competitive_landscape',
  });

  // Transplant Eligibility & Treatment Sequencing
  const txKey = inputs.transplantEligibility || 'transplant_eligible';
  const txLevel: ImpactLevel = txKey === 'post_transplant' ? 'VERY HIGH'
    : txKey === 'transplant_ineligible' ? 'HIGH' : 'MEDIUM';
  insights.push({
    title: 'Transplant Eligibility & Treatment Sequencing',
    description: txLevel === 'VERY HIGH'
      ? 'Post-transplant relapse represents the most refractory, highest-unmet-need population. CAR-T and bispecifics have shown transformative efficacy here (ZUMA-1, TRANSFORM). Partners pay premiums for assets with post-transplant activity data — this population validates potency against the toughest disease. Expect accelerated regulatory pathways and orphan-like pricing dynamics.'
      : txLevel === 'HIGH'
      ? 'Transplant-ineligible patients are the fastest-growing segment due to aging demographics. BTK inhibitors, venetoclax combinations, and bispecifics compete intensely here. Partners require differentiation on efficacy, duration, or safety versus established combinations. Time-limited treatment regimens command deal premiums.'
      : 'Transplant-eligible patients receive intensive induction followed by consolidation/transplant. Novel agents targeting MRD negativity pre-transplant or reducing relapse post-transplant have clear value propositions. Partners structure milestones around transplant outcome data and MRD endpoints.',
    impactLevel: txLevel,
    category: 'line_of_therapy',
  });

  // MRD & Response Endpoint Strategy
  const mrdKey = inputs.mrdStatus || 'standard_response';
  const mrdLevel: ImpactLevel = mrdKey === 'mrd_endpoint' ? 'LOW'
    : mrdKey === 'survival_endpoint' ? 'HIGH' : 'MEDIUM';
  insights.push({
    title: 'MRD & Response Endpoint Strategy',
    description: mrdLevel === 'LOW'
      ? 'MRD-based endpoints are increasingly accepted by FDA as surrogate endpoints for accelerated approval (CLL, ALL, myeloma). MRD negativity correlates with long-term outcomes and enables smaller, faster trials. Partners value MRD-driven programs for speed to market — expect premium deal terms reflecting the accelerated development timeline and growing regulatory acceptance.'
      : mrdLevel === 'HIGH'
      ? 'Overall survival endpoints provide the most definitive evidence but require large trials (N=500+) and long follow-up (3-5+ years). In rapidly evolving landscapes with crossover, OS is increasingly difficult to demonstrate. Partners accept OS risk but structure deals with larger back-loaded milestones and conditional commercial terms.'
      : 'Standard response criteria (CR, ORR, DOR) are well-established but face increasing pressure from regulators and payers demanding deeper endpoints. Consider incorporating MRD as a key secondary endpoint to future-proof the asset. Partners value response rate data for initial deal structuring with MRD upgrades triggering milestone payments.',
    impactLevel: mrdLevel,
    category: 'trial_endpoint',
  });

  return insights;
}

// Generate dermatology-specific insights
function generateDermatologyInsights(inputs: CalculationInput): NeurologyInsight[] {
  if (inputs.therapeuticArea !== 'dermatology') return [];
  const insights: NeurologyInsight[] = [];

  // Severity Scale & Market Positioning
  const sevKey = inputs.skinSeverity || 'moderate';
  const sevLevel: ImpactLevel = sevKey === 'refractory_derm' ? 'VERY HIGH'
    : sevKey === 'severe' ? 'HIGH'
    : sevKey === 'moderate' ? 'MEDIUM' : 'LOW';
  insights.push({
    title: 'Severity Scale & Market Positioning',
    description: sevLevel === 'VERY HIGH'
      ? 'Refractory dermatology (failed multiple biologics/systemic agents) represents the highest unmet need. PASI 90/100 and EASI 75/90 response rates in this population command premium deal terms. JAK inhibitors carved this niche but face safety concerns (boxed warnings). Partners value novel mechanisms that achieve high clearance rates without JAK-associated risks. Orphan-adjacent pricing dynamics may apply for rare refractory subtypes.'
      : sevLevel === 'HIGH'
      ? 'Severe disease (PASI >20, EASI >21, BSA >10%) is the primary target for systemic biologics. IL-17, IL-23, and IL-13 inhibitors set the efficacy bar — PASI 90 rates of 60-80% are now standard. Partners benchmark new assets against Skyrizi, Tremfya, and Dupixent. Differentiation through speed of onset, durability, or oral formulation is essential for premium terms.'
      : sevLevel === 'MEDIUM'
      ? 'Moderate disease is the largest patient population but faces intense competition from topical therapies, phototherapy, and now topical JAK inhibitors. Systemic agents must demonstrate clear superiority over topical alternatives. Partners structure deals with commercial milestones tied to formulary access and market share versus established treatments.'
      : 'Mild disease is managed primarily with topical therapies and represents the highest-volume but lowest-value-per-patient segment. Topical innovation (roflumilast cream, tapinarof) shows the path. Partners may seek OTC potential or dermocosmetic positioning. Deal values are modest relative to systemic programs.',
    impactLevel: sevLevel,
    category: 'unmet_need',
  });

  // Chronicity & Treatment Duration
  const chronKey = inputs.chronicityProfile || 'chronic_relapsing';
  const chronLevel: ImpactLevel = chronKey === 'chronic_continuous' ? 'LOW'
    : chronKey === 'chronic_relapsing' ? 'MEDIUM' : 'HIGH';
  insights.push({
    title: 'Chronicity & Treatment Duration Impact',
    description: chronLevel === 'LOW'
      ? 'Chronic continuous disease drives the most favorable commercial profile — long-term biologic use generates predictable recurring revenue. Dupixent ($11B+ annual sales) proved the model. Partners value the annuity-like revenue stream and structure deals with aggressive commercial milestones. Biosimilar timeline is the key risk — IL-17/IL-23 biosimilars arriving in the late 2020s will pressure pricing.'
      : chronLevel === 'MEDIUM'
      ? 'Chronic relapsing disease creates intermittent treatment patterns that complicate revenue forecasting. Patients cycle on and off therapy. Rapid onset of action and sustained remission after discontinuation are key differentiators. Partners may discount chronic treatment assumptions and value drugs that maintain remission during treatment-free intervals.'
      : 'Acute flare management is a smaller market with episodic treatment. Short courses of systemic therapy or potent topicals dominate. Per-patient revenue is limited. Partners structure deals around acute treatment episodes rather than chronic use, resulting in lower total deal values but faster path to market.',
    impactLevel: chronLevel,
    category: 'treatment_durability',
  });

  // Delivery Route & Biosimilar Pressure
  const delivKey = inputs.topicalVsSystemic || 'systemic_only';
  const delivLevel: ImpactLevel = delivKey === 'topical_and_systemic' ? 'LOW'
    : delivKey === 'topical_only' ? 'MEDIUM' : 'HIGH';
  insights.push({
    title: 'Delivery Strategy & Biosimilar Pressure',
    description: delivLevel === 'LOW'
      ? 'Dual topical + systemic formulation strategy maximizes market coverage across severity spectrums. Topical formulation extends lifecycle and creates a differentiated profile versus biologic competitors. Partners value the optionality — topical launch for moderate disease followed by systemic for severe creates a staged commercial strategy with multiple revenue streams.'
      : delivLevel === 'MEDIUM'
      ? 'Topical-only positioning targets the largest patient volume but faces intense competition from generics, OTC products, and new topical innovations (JAK inhibitors, PDE4 inhibitors). Differentiation through novel formulation, mechanism, or patient experience is critical. Partners evaluate topical programs on volume potential and formulary positioning rather than per-patient pricing.'
      : 'Systemic-only delivery competes directly against established biologics (Dupixent, Skyrizi, Tremfya, Cosentyx) and faces emerging biosimilar pressure. Adalimumab biosimilars have already reshaped psoriasis pricing. IL-17 and IL-23 biosimilars are approaching. Partners price in biosimilar erosion risk and require clear differentiation on efficacy, safety, or convenience to justify premium deal terms.',
    impactLevel: delivLevel,
    category: 'competitive_landscape',
  });

  return insights;
}

// Generate gastroenterology-specific insights
function generateGastroenterologyInsights(inputs: CalculationInput): NeurologyInsight[] {
  if (inputs.therapeuticArea !== 'gastroenterology') return [];
  const insights: NeurologyInsight[] = [];

  // GI Segment & Disease Biology
  const segKey = inputs.giSegment || 'colonic';
  const segLevel: ImpactLevel = segKey === 'pancolonic' ? 'VERY HIGH'
    : segKey === 'small_bowel' ? 'HIGH'
    : segKey === 'colonic' ? 'MEDIUM' : 'LOW';
  insights.push({
    title: 'GI Segment & Disease Biology',
    description: segLevel === 'VERY HIGH'
      ? 'Pancolonic disease represents the most severe IBD phenotype with highest surgical risk. Patients frequently fail multiple biologics. Anti-TL1A (tulisokibart) and dual-targeted approaches are emerging as the most promising mechanisms for this population. Partners pay premiums for assets with pan-intestinal activity data — efficacy across both ileal and colonic disease substantially broadens the addressable market.'
      : segLevel === 'HIGH'
      ? 'Small bowel involvement (ileal Crohn\'s) is particularly challenging — limited topical drug delivery, stricturing/penetrating complications, and high surgical rates. Anti-IL-23 agents (risankizumab, guselkumab) have shown strong ileal healing. Partners value small bowel efficacy data as a differentiator, especially mucosal and transmural healing endpoints.'
      : segLevel === 'MEDIUM'
      ? 'Colonic disease (UC, colonic Crohn\'s) is the most common IBD presentation and the most competitive therapeutic landscape. TNF inhibitors, vedolizumab, ustekinumab, JAK inhibitors, and S1P modulators all compete. Partners benchmark rigorously against Entyvio, Stelara, and Rinvoq. Differentiation through endoscopic outcomes, speed of response, or oral convenience is essential.'
      : 'Upper GI targets (EoE, refractory GERD) represent smaller but growing markets with significant unmet need. Dupixent\'s EoE approval validated the biologic approach. Partners value first-mover advantage in under-served upper GI indications. Smaller trial sizes and faster enrollment support efficient development.',
    impactLevel: segLevel,
    category: 'unmet_need',
  });

  // Biologic Experience & Treatment Sequencing
  const bioExpKey = inputs.biologicExperience || 'biologic_naive';
  const bioExpLevel: ImpactLevel = bioExpKey === 'multi_biologic_exposed' ? 'VERY HIGH'
    : bioExpKey === 'one_prior_biologic' ? 'HIGH' : 'MEDIUM';
  insights.push({
    title: 'Biologic Experience & Treatment Sequencing',
    description: bioExpLevel === 'VERY HIGH'
      ? 'Multi-biologic-exposed patients (failed 2+ biologics) represent the highest unmet need in IBD. Response rates drop with each subsequent line — novel mechanisms are essential. Anti-TL1A and gut-selective agents show promise in this refractory population. Partners pay significant premiums for bio-experienced efficacy data, as it validates the mechanism against the toughest patients and protects against line-of-therapy erosion.'
      : bioExpLevel === 'HIGH'
      ? 'One-prior-biologic patients are the key second-line population. IL-23 inhibitors have demonstrated strong efficacy post-TNF failure (SEQUENCE trial for risankizumab). Partners value head-to-head data versus established second-line options. Deal structures include milestones tied to second-line pivotal readouts and formulary positioning.'
      : 'Biologic-naive patients represent the largest addressable population with highest response rates. First-line biologic positioning drives blockbuster potential — vedolizumab and adalimumab lead. Partners structure deals around first-line pivotal data with commercial milestones tied to market share capture. Competition is intense but market size is large enough for multiple winners.',
    impactLevel: bioExpLevel,
    category: 'line_of_therapy',
  });

  // Endoscopic Endpoint & Mechanism Strategy
  const endoKey = inputs.endoscopicEndpoint || 'endoscopic_improvement';
  const endoLevel: ImpactLevel = endoKey === 'endoscopic_remission' ? 'LOW'
    : endoKey === 'endoscopic_improvement' ? 'MEDIUM' : 'HIGH';
  insights.push({
    title: 'Endoscopic Endpoint & Mechanism Strategy',
    description: endoLevel === 'LOW'
      ? 'Endoscopic remission (Mayo 0, SES-CD <3) is the gold standard endpoint increasingly demanded by FDA and EMA. IL-23 inhibitors and anti-TL1A have demonstrated high endoscopic remission rates, raising the bar for new entrants. Partners value endoscopic remission data as the strongest differentiator — it correlates with long-term outcomes, reduces surgical risk, and supports premium pricing. Histologic endpoints (Geboes, RHI) are emerging as the next frontier.'
      : endoLevel === 'MEDIUM'
      ? 'Endoscopic improvement (Mayo 0-1, 50% SES-CD reduction) is well-accepted and achievable by multiple mechanisms. Anti-TNFs and vedolizumab established this benchmark. Partners view endoscopic improvement as table stakes — differentiation requires either superior rates, faster onset, or additional mucosal healing endpoints. Consider adding histologic remission as a key secondary endpoint.'
      : 'Clinical-only endpoints (CDAI, partial Mayo) are fastest to demonstrate but face increasing regulatory skepticism. FDA\'s 2023 IBD guidance emphasizes endoscopic co-primary endpoints. Partners will discount programs without endoscopic data and may require endoscopic endpoints as milestone triggers. Consider an adaptive trial design that incorporates endoscopy to de-risk the program.',
    impactLevel: endoLevel,
    category: 'trial_endpoint',
  });

  return insights;
}

// Main function to compute full sensitivity analysis
export function computeSensitivityAnalysis(
  inputs: CalculationInput,
  result: CalculationResult
): SensitivityData {
  const ta = inputs.therapeuticArea;
  const isNeurology = ta === 'neurology';
  const isImmunology = ta === 'immunology';
  const isMetabolic = ta === 'metabolic';
  const isCardiovascular = ta === 'cardiovascular';
  const isInfectiousDisease = ta === 'infectiousDisease';
  const isOphthalmology = ta === 'ophthalmology';
  const isWomensHealth = ta === 'womensHealth';
  const isRareDisease = ta === 'rareDisease';
  const isHematology = ta === 'hematology';
  const isDermatology = ta === 'dermatology';
  const isGastroenterology = ta === 'gastroenterology';

  // Determine the first area-specific parameter (treatment approach equivalent)
  const areaFirstParam: keyof CalculationInput =
    isNeurology ? 'treatmentApproach' :
    isImmunology ? 'treatmentGoal' :
    isMetabolic ? 'metabolicTreatmentApproach' :
    isCardiovascular ? 'cvOutcomeBenefit' :
    isInfectiousDisease ? 'resistanceProfile' :
    isOphthalmology ? 'ocularDelivery' :
    isWomensHealth ? 'whTargetPopulation' :
    isRareDisease ? 'orphanDesignation' :
    isHematology ? 'hemeLineage' :
    isDermatology ? 'skinSeverity' :
    isGastroenterology ? 'giSegment' :
    'lineOfTherapy';

  const dealType = (inputs.dealType || 'licensing') as DealType;

  const parametersToAnalyze: Array<keyof CalculationInput> = [
    'phase',
    'territory',
    'competitivePosition',
    'modality',
    'dataQuality',
    'dealType',
    areaFirstParam,
    // Line of therapy is a cross-TA pricing/positioning lever (1L vs 2L+ vs
    // maintenance), not oncology-specific. Include unconditionally so all TAs
    // surface sensitivity when the user toggles it.
    ...(areaFirstParam !== 'lineOfTherapy' ? ['lineOfTherapy' as keyof CalculationInput] : []),
    // For acquisitions, royalties are 0% so biomarker/combination sensitivity is less relevant
    // but still included as they affect total deal value through milestone structure
    'biomarker',
    'combinationPotential',
    'deliveryRoute' as keyof CalculationInput,
    ...(isNeurology ? ['bbbPenetration' as keyof CalculationInput, 'diseaseProgression' as keyof CalculationInput, 'biomarkerValidation' as keyof CalculationInput] : []),
    ...(isImmunology ? ['immuneResetPotential' as keyof CalculationInput, 'targetSpecificity' as keyof CalculationInput, 'diseaseSeverity' as keyof CalculationInput] : []),
    ...(isMetabolic ? ['mechanismDifferentiation' as keyof CalculationInput, 'weightLossEfficacy' as keyof CalculationInput, 'routeOfAdministration' as keyof CalculationInput, 'comorbidityBreadth' as keyof CalculationInput] : []),
    ...(isCardiovascular ? ['cvTrialEndpoint' as keyof CalculationInput, 'cvPopulationRisk' as keyof CalculationInput] : []),
    ...(isInfectiousDisease ? ['infectionChronicity' as keyof CalculationInput, 'publicHealthPriority' as keyof CalculationInput] : []),
    ...(isOphthalmology ? ['treatmentDurability' as keyof CalculationInput, 'visionImpact' as keyof CalculationInput] : []),
    ...(isWomensHealth ? ['whUnmetNeed' as keyof CalculationInput, 'whRegulatory' as keyof CalculationInput] : []),
    ...(isRareDisease ? ['patientPopulationSize' as keyof CalculationInput, 'geneticBasis' as keyof CalculationInput] : []),
    ...(isHematology ? ['transplantEligibility' as keyof CalculationInput, 'mrdStatus' as keyof CalculationInput] : []),
    ...(isDermatology ? ['chronicityProfile' as keyof CalculationInput, 'topicalVsSystemic' as keyof CalculationInput] : []),
    ...(isGastroenterology ? ['biologicExperience' as keyof CalculationInput, 'endoscopicEndpoint' as keyof CalculationInput] : []),
  ];

  const parameters: ParameterSensitivity[] = parametersToAnalyze
    .map(key => computeParameterSensitivity(result, inputs, key))
    .filter((p): p is ParameterSensitivity => p !== null);

  // Sort by impact range (descending)
  parameters.sort((a, b) => b.impactRange - a.impactRange);

  // Find top value driver
  const topValueDriver = findTopValueDriver(parameters);

  // Generate therapeutic-area-specific insights
  const neurologyInsights = isRareDisease
    ? generateRareDiseaseInsights(inputs)
    : isHematology
    ? generateHematologyInsights(inputs)
    : isDermatology
    ? generateDermatologyInsights(inputs)
    : isGastroenterology
    ? generateGastroenterologyInsights(inputs)
    : isCardiovascular
    ? generateCardiovascularInsights(inputs)
    : isInfectiousDisease
    ? generateInfectiousDiseaseInsights(inputs)
    : isOphthalmology
    ? generateOphthalmologyInsights(inputs)
    : isWomensHealth
    ? generateWomensHealthInsights(inputs)
    : isMetabolic
    ? generateMetabolicInsights(inputs)
    : isImmunology
    ? generateImmunologyInsights(inputs)
    : isNeurology
    ? generateNeurologyInsights(inputs)
    : generateOncologyInsights(inputs);

  return {
    currentUpfront: result.terms.upfront.median,
    currentTotalValue: result.terms.totalDealValue.median,
    parameters,
    topValueDriver,
    neurologyInsights,
    computedAt: Date.now(),
  };
}

// Get top N parameters (filter out LOW impact)
export function getTopParameters(
  sensitivityData: SensitivityData,
  maxCount: number = 4
): ParameterSensitivity[] {
  return sensitivityData.parameters
    .filter(p => p.impactLevel !== 'LOW')
    .slice(0, maxCount);
}

// Format delta for display
export function formatDelta(delta: number, deltaPercent: number): string {
  if (delta === 0) return '— Current';

  const sign = delta > 0 ? '+' : '';
  const valueStr = formatCurrency(Math.abs(delta));
  const percentStr = `${sign}${deltaPercent.toFixed(0)}%`;

  if (delta > 0) {
    return `▲ ${valueStr} (${percentStr})`;
  }
  return `▼ ${valueStr} (${percentStr})`;
}
