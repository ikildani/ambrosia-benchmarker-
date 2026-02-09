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

export interface SensitivityData {
  currentUpfront: number;
  currentTotalValue: number;
  parameters: ParameterSensitivity[];
  topValueDriver: TopValueDriver;
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
  isNeurology: boolean = false
): Array<{ value: string; label: string }> {
  switch (parameterKey) {
    case 'phase':
      return phaseOptions;
    case 'territory':
      return territoryOptions;
    case 'competitivePosition':
      return competitivePositionOptions;
    case 'modality':
      return flattenOptions(isNeurology ? neurologyModalityOptions : modalityOptions);
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
  const options = getOptionsForParameter(parameterKey, isNeurology);
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

// Main function to compute full sensitivity analysis
export function computeSensitivityAnalysis(
  inputs: CalculationInput,
  result: CalculationResult
): SensitivityData {
  const isNeurology = inputs.therapeuticArea === 'neurology';
  const parametersToAnalyze: Array<keyof CalculationInput> = [
    'phase',
    'territory',
    'competitivePosition',
    'modality',
    'dataQuality',
    isNeurology ? 'treatmentApproach' : 'lineOfTherapy',
    'biomarker',
    'combinationPotential',
  ];

  const parameters: ParameterSensitivity[] = parametersToAnalyze
    .map(key => computeParameterSensitivity(result, inputs, key))
    .filter((p): p is ParameterSensitivity => p !== null);

  // Sort by impact range (descending)
  parameters.sort((a, b) => b.impactRange - a.impactRange);

  // Find top value driver
  const topValueDriver = findTopValueDriver(parameters);

  return {
    currentUpfront: result.terms.upfront.median,
    currentTotalValue: result.terms.totalDealValue.median,
    parameters,
    topValueDriver,
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
