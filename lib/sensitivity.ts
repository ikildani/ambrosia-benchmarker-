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
  category: 'bbb_penetration' | 'disease_progression' | 'biomarker_validation' | 'competitive_landscape' | 'line_of_therapy' | 'combination_strategy';
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
  isImmunology: boolean = false
): Array<{ value: string; label: string }> {
  switch (parameterKey) {
    case 'phase':
      return phaseOptions;
    case 'territory':
      return territoryOptions;
    case 'competitivePosition':
      return competitivePositionOptions;
    case 'modality':
      return flattenOptions(isImmunology ? immunologyModalityOptions : isNeurology ? neurologyModalityOptions : modalityOptions);
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
  const options = getOptionsForParameter(parameterKey, isNeurology, isImmunology);
  if (options.length === 0) return null;

  const currentValue = String(baseInputs[parameterKey]);
  const baseTotalValue = baseResult.terms.totalDealValue.median;
  const baseUpfront = baseResult.terms.upfront.median;

  const computedOptions: ParameterOption[] = options.map(opt => {
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
    const modifiedInputs = { ...baseInputs, [parameterKey]: opt.value };
    const modifiedResult = calculateDealTerms(modifiedInputs as CalculationInput);
    const newTotalValue = modifiedResult.terms.totalDealValue.median;
    const newUpfront = modifiedResult.terms.upfront.median;

    return {
      value: opt.value,
      label: opt.label,
      resultingUpfront: newUpfront,
      resultingTotalValue: newTotalValue,
      delta: newTotalValue - baseTotalValue,
      deltaPercent: baseTotalValue > 0 ? ((newTotalValue - baseTotalValue) / baseTotalValue) * 100 : 0,
    };
  });

  // Calculate impact range
  const deltas = computedOptions.map(o => o.delta);
  const maxPositive = Math.max(0, ...deltas);
  const maxNegative = Math.min(0, ...deltas);
  const impactRange = maxPositive - maxNegative;

  // Determine impact level based on percentage range
  const impactPercent = baseTotalValue > 0 ? (impactRange / baseTotalValue) * 100 : 0;
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
    options: computedOptions.sort((a, b) => b.resultingTotalValue - a.resultingTotalValue),
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
  let bestImprovement = {
    param: parameters[0],
    option: parameters[0]?.options[0] || {
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

// Main function to compute full sensitivity analysis
export function computeSensitivityAnalysis(
  inputs: CalculationInput,
  result: CalculationResult
): SensitivityData {
  const isNeurology = inputs.therapeuticArea === 'neurology';
  const isImmunology = inputs.therapeuticArea === 'immunology';
  const parametersToAnalyze: Array<keyof CalculationInput> = [
    'phase',
    'territory',
    'competitivePosition',
    'modality',
    'dataQuality',
    isNeurology ? 'treatmentApproach' : isImmunology ? 'treatmentGoal' : 'lineOfTherapy',
    'biomarker',
    'combinationPotential',
    ...(isNeurology ? ['bbbPenetration' as keyof CalculationInput, 'diseaseProgression' as keyof CalculationInput, 'biomarkerValidation' as keyof CalculationInput] : []),
    ...(isImmunology ? ['immuneResetPotential' as keyof CalculationInput, 'targetSpecificity' as keyof CalculationInput, 'diseaseSeverity' as keyof CalculationInput] : []),
  ];

  const parameters: ParameterSensitivity[] = parametersToAnalyze
    .map(key => computeParameterSensitivity(result, inputs, key))
    .filter((p): p is ParameterSensitivity => p !== null);

  // Sort by impact range (descending)
  parameters.sort((a, b) => b.impactRange - a.impactRange);

  // Find top value driver
  const topValueDriver = findTopValueDriver(parameters);

  // Generate therapeutic-area-specific insights
  const neurologyInsights = isImmunology
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
