import benchmarks from '@/data/benchmarks.json';

export type Phase = 'preclinical' | 'phase1' | 'phase2' | 'phase3' | 'approved';
export type Modality = 'smallMolecule' | 'antibody' | 'adc' | 'cellTherapy' | 'geneTherapy';
export type IndicationType = 'solidTumor_common' | 'solidTumor_rare' | 'hematologic_common' | 'hematologic_rare' | 'pediatric';

export interface DealTerms {
  upfront: { low: number; median: number; high: number };
  devMilestones: { low: number; median: number; high: number };
  regMilestones: { low: number; median: number; high: number };
  commMilestones: { low: number; median: number; high: number };
  royalties: { low: number; median: number; high: number };
  totalDealValue: { low: number; median: number; high: number };
}

export interface CalculationInput {
  phase: Phase;
  modality: Modality;
  indicationType: IndicationType;
  isFirstInClass: boolean;
  isBestInClass: boolean;
  isCrowdedSpace: boolean;
}

export interface CalculationResult {
  terms: DealTerms;
  modifiers: { name: string; multiplier: number }[];
  labels: {
    phase: string;
    modality: string;
  };
}

function applyMultiplier(
  value: { low: number; median: number; high: number },
  multiplier: number,
  isPercentage: boolean = false
): { low: number; median: number; high: number } {
  if (isPercentage) {
    // For royalties, cap at reasonable bounds
    return {
      low: Math.min(Math.round(value.low * multiplier * 10) / 10, 50),
      median: Math.min(Math.round(value.median * multiplier * 10) / 10, 55),
      high: Math.min(Math.round(value.high * multiplier * 10) / 10, 60),
    };
  }
  return {
    low: Math.round(value.low * multiplier),
    median: Math.round(value.median * multiplier),
    high: Math.round(value.high * multiplier),
  };
}

export function calculateDealTerms(input: CalculationInput): CalculationResult {
  const oncologyData = benchmarks.oncology as Record<string, Record<string, DealTerms>>;
  const baseTerms = oncologyData[input.phase][input.modality];
  const modifiers: { name: string; multiplier: number }[] = [];

  let totalMultiplier = 1.0;

  // Apply indication type modifier
  const [indicationCategory, indicationSubtype] = input.indicationType.split('_');
  const indicationMods = benchmarks.indicationModifiers as Record<string, Record<string, { multiplier: number; label: string }> | { multiplier: number; label: string }>;

  if (indicationCategory === 'pediatric') {
    const mod = indicationMods.pediatric as { multiplier: number; label: string };
    totalMultiplier *= mod.multiplier;
    modifiers.push({ name: mod.label, multiplier: mod.multiplier });
  } else {
    const categoryMods = indicationMods[indicationCategory] as Record<string, { multiplier: number; label: string }>;
    if (categoryMods && categoryMods[indicationSubtype]) {
      totalMultiplier *= categoryMods[indicationSubtype].multiplier;
      modifiers.push({
        name: categoryMods[indicationSubtype].label,
        multiplier: categoryMods[indicationSubtype].multiplier
      });
    }
  }

  // Apply competitive position modifiers
  if (input.isFirstInClass) {
    const mod = indicationMods.firstInClass as { multiplier: number; label: string };
    totalMultiplier *= mod.multiplier;
    modifiers.push({ name: mod.label, multiplier: mod.multiplier });
  }

  if (input.isBestInClass && !input.isFirstInClass) {
    const mod = indicationMods.bestInClass as { multiplier: number; label: string };
    totalMultiplier *= mod.multiplier;
    modifiers.push({ name: mod.label, multiplier: mod.multiplier });
  }

  if (input.isCrowdedSpace) {
    const mod = indicationMods.crowdedSpace as { multiplier: number; label: string };
    totalMultiplier *= mod.multiplier;
    modifiers.push({ name: mod.label, multiplier: mod.multiplier });
  }

  // Apply multipliers to all terms
  const adjustedTerms: DealTerms = {
    upfront: applyMultiplier(baseTerms.upfront, totalMultiplier),
    devMilestones: applyMultiplier(baseTerms.devMilestones, totalMultiplier),
    regMilestones: applyMultiplier(baseTerms.regMilestones, totalMultiplier),
    commMilestones: applyMultiplier(baseTerms.commMilestones, totalMultiplier),
    royalties: applyMultiplier(baseTerms.royalties, totalMultiplier, true),
    totalDealValue: applyMultiplier(baseTerms.totalDealValue, totalMultiplier),
  };

  const labels = benchmarks.labels as {
    phases: Record<string, string>;
    modalities: Record<string, string>;
  };

  return {
    terms: adjustedTerms,
    modifiers,
    labels: {
      phase: labels.phases[input.phase],
      modality: labels.modalities[input.modality],
    },
  };
}

export function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value}M`;
}

export function formatRange(range: { low: number; median: number; high: number }, isPercentage: boolean = false): string {
  if (isPercentage) {
    return `${range.low}% - ${range.high}%`;
  }
  return `${formatCurrency(range.low)} - ${formatCurrency(range.high)}`;
}

export const phaseOptions = [
  { value: 'preclinical', label: 'Preclinical (IND-enabling)' },
  { value: 'phase1', label: 'Phase 1' },
  { value: 'phase2', label: 'Phase 2' },
  { value: 'phase3', label: 'Phase 3' },
  { value: 'approved', label: 'Approved / NDA Filed' },
];

export const modalityOptions = [
  { value: 'smallMolecule', label: 'Small Molecule' },
  { value: 'antibody', label: 'Monoclonal Antibody' },
  { value: 'adc', label: 'Antibody-Drug Conjugate (ADC)' },
  { value: 'cellTherapy', label: 'Cell Therapy (CAR-T, CAR-NK)' },
  { value: 'geneTherapy', label: 'Gene Therapy / Gene Editing' },
];

export const indicationOptions = [
  { value: 'solidTumor_common', label: 'Solid Tumor - Common (lung, breast, colorectal)' },
  { value: 'solidTumor_rare', label: 'Solid Tumor - Rare' },
  { value: 'hematologic_common', label: 'Hematologic - Common (NHL, AML, CLL)' },
  { value: 'hematologic_rare', label: 'Hematologic - Rare' },
  { value: 'pediatric', label: 'Pediatric Oncology' },
];
