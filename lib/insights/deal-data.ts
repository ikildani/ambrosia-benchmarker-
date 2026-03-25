import { getBenchmarksSync, type PhaseBaselineEntry } from '@/lib/benchmarks';
import { EXTENDED_COMPARABLE_DEALS, type ExtendedComparableDeal } from '@/data/comparable-deals-extended';
import { calculateDealTerms, formatCurrency, type CalculationInput, type TherapeuticArea, type Phase, type Modality, type CalculationResult } from '@/lib/calculations';

const benchmarks = getBenchmarksSync();

// ── Phase Baselines ──────────────────────────────────────────────────────────

const phaseBaselineMap: Record<string, Record<string, PhaseBaselineEntry>> = {
  oncology: benchmarks.phaseBaselines,
  metabolic: benchmarks.metabolicPhaseBaselines,
  immunology: benchmarks.immunologyPhaseBaselines,
  neurology: benchmarks.neurologyPhaseBaselines,
  cardiovascular: benchmarks.cardiovascularPhaseBaselines,
  infectiousDisease: benchmarks.infectiousDiseasePhaseBaselines,
  ophthalmology: benchmarks.ophthalmologyPhaseBaselines,
  womensHealth: benchmarks.womensHealthPhaseBaselines,
  rareDisease: benchmarks.rareDiseasePhaseBaselines,
  hematology: benchmarks.hematologyPhaseBaselines,
  dermatology: benchmarks.dermatologyPhaseBaselines,
  gastroenterology: benchmarks.gastroenterologyPhaseBaselines,
};

const PHASE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  preclinical: 'Preclinical',
  phase1: 'Phase 1',
  phase1_2: 'Phase 1/2',
  phase2: 'Phase 2',
  phase2_3: 'Phase 2/3',
  phase3: 'Phase 3',
  nda_filed: 'NDA/BLA Filed',
  approved: 'Approved',
};

const TA_LABELS: Record<string, string> = {
  oncology: 'Oncology',
  neurology: 'Neurology/CNS',
  immunology: 'Immunology',
  metabolic: 'Metabolic/Obesity',
  cardiovascular: 'Cardiovascular',
  infectiousDisease: 'Infectious Disease',
  ophthalmology: 'Ophthalmology',
  womensHealth: "Women's Health",
  rareDisease: 'Rare Disease',
  hematology: 'Hematology',
  dermatology: 'Dermatology',
  gastroenterology: 'Gastroenterology',
};

export function getPhaseLabel(phase: string): string {
  return PHASE_LABELS[phase] || phase;
}

export function getTALabel(ta: string): string {
  return TA_LABELS[ta] || ta;
}

export function getPhaseBaselines(ta: string = 'oncology'): Record<string, PhaseBaselineEntry> {
  return phaseBaselineMap[ta] || benchmarks.phaseBaselines;
}

export function getPhaseBaselineEntry(ta: string, phase: string): PhaseBaselineEntry | undefined {
  const baselines = getPhaseBaselines(ta);
  return baselines[phase];
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function formatDealValue(valueM: number): string {
  if (valueM >= 1000) {
    const b = valueM / 1000;
    return `$${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B`;
  }
  return `$${Math.round(valueM)}M`;
}

export { formatCurrency };

// ── Comparable Deals ─────────────────────────────────────────────────────────

interface DealFilters {
  therapeuticArea?: string;
  territory?: string;
  dealType?: string;
  phase?: string;
  modality?: string;
  geographicSpecific?: boolean;
}

export function getFilteredDeals(filters: DealFilters): ExtendedComparableDeal[] {
  return EXTENDED_COMPARABLE_DEALS.filter((deal) => {
    if (filters.therapeuticArea && deal.therapeuticArea !== filters.therapeuticArea) return false;
    if (filters.territory && deal.territory !== filters.territory) return false;
    if (filters.dealType && deal.dealType !== filters.dealType) return false;
    if (filters.phase && deal.phase !== filters.phase) return false;
    if (filters.modality && deal.modality !== filters.modality) return false;
    if (filters.geographicSpecific !== undefined && deal.geographicSpecific !== filters.geographicSpecific) return false;
    return true;
  });
}

export function getDealsForTerritory(territory: string): ExtendedComparableDeal[] {
  return EXTENDED_COMPARABLE_DEALS.filter((deal) => {
    const t = deal.territory.toLowerCase();
    if (territory === 'europe') return t.includes('europe') || t === 'ex_us' || t === 'eu';
    if (territory === 'asia_pacific') return t.includes('japan') || t.includes('china') || t.includes('asia') || t === 'ex_china' || t === 'apac';
    return t.includes(territory.toLowerCase());
  });
}

// ── Computed Benchmarks ──────────────────────────────────────────────────────

function makeInput(overrides: Partial<CalculationInput>): CalculationInput {
  return {
    therapeuticArea: overrides.therapeuticArea ?? 'oncology',
    phase: overrides.phase ?? 'phase2',
    modality: overrides.modality ?? 'smallMolecule',
    indication: overrides.indication ?? 'lung_nsclc',
    territory: overrides.territory ?? 'global',
    biomarker: overrides.biomarker ?? 'unselected',
    lineOfTherapy: overrides.lineOfTherapy ?? '2L',
    treatmentApproach: overrides.treatmentApproach ?? 'symptomatic',
    combinationPotential: overrides.combinationPotential ?? 'some',
    competitivePosition: overrides.competitivePosition ?? 'racing',
    dataQuality: overrides.dataQuality ?? 'promising',
    regulatoryDesignations: overrides.regulatoryDesignations ?? {
      breakthrough: false,
      fastTrack: false,
      orphan: false,
      prime: false,
    },
  };
}

export function getComputedBenchmark(overrides: Partial<CalculationInput>): CalculationResult {
  return calculateDealTerms(makeInput(overrides));
}

// ── All TAs list ─────────────────────────────────────────────────────────────

export const ALL_TAS: TherapeuticArea[] = [
  'oncology', 'neurology', 'immunology', 'metabolic',
  'cardiovascular', 'infectiousDisease', 'ophthalmology', 'womensHealth',
  'rareDisease', 'hematology', 'dermatology', 'gastroenterology',
];
