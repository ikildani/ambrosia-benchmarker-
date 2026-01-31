import benchmarks from '@/data/benchmarks.json';

export type Phase = 'preclinical' | 'phase1' | 'phase2' | 'phase3' | 'approved';
export type Modality = 'smallMolecule' | 'antibody' | 'adc' | 'bispecific' | 'cellTherapy' | 'geneTherapy';
export type IndicationType =
  | 'lung'
  | 'breast'
  | 'colorectal'
  | 'pancreatic'
  | 'aml'
  | 'other_solid'
  | 'other_hematologic'
  | 'pediatric';
export type Territory = 'global' | 'usOnly' | 'exUs';

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
  territory: Territory;
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
  const indicationMods = benchmarks.indicationModifiers as Record<string, { multiplier: number; label: string }>;
  const indicationMod = indicationMods[input.indicationType];
  if (indicationMod) {
    totalMultiplier *= indicationMod.multiplier;
    modifiers.push({ name: indicationMod.label, multiplier: indicationMod.multiplier });
  }

  // Apply territory modifier
  const territoryMods = benchmarks.territoryModifiers as Record<string, { multiplier: number; label: string }>;
  const territoryMod = territoryMods[input.territory];
  if (territoryMod) {
    totalMultiplier *= territoryMod.multiplier;
    modifiers.push({ name: territoryMod.label, multiplier: territoryMod.multiplier });
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
  { value: 'bispecific', label: 'Bispecific Antibody' },
  { value: 'cellTherapy', label: 'Cell Therapy (CAR-T, CAR-NK)' },
  { value: 'geneTherapy', label: 'Gene Therapy / Gene Editing' },
];

export const indicationOptions = [
  { value: 'lung', label: 'Lung Cancer (NSCLC/SCLC)' },
  { value: 'breast', label: 'Breast Cancer' },
  { value: 'colorectal', label: 'Colorectal Cancer' },
  { value: 'pancreatic', label: 'Pancreatic Cancer' },
  { value: 'aml', label: 'AML (Acute Myeloid Leukemia)' },
  { value: 'other_solid', label: 'Other Solid Tumors' },
  { value: 'other_hematologic', label: 'Other Hematologic Malignancies' },
  { value: 'pediatric', label: 'Pediatric Oncology' },
];

export const territoryOptions = [
  { value: 'global', label: 'Global (Worldwide)' },
  { value: 'usOnly', label: 'US Only' },
  { value: 'exUs', label: 'Ex-US (Outside United States)' },
];
