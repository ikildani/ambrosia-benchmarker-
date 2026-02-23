import { staticBenchmarks as benchmarks, type Benchmarks, type MultiplierOption, type PhaseBaselines } from '@/lib/benchmarks';

export type ImpactBadgeType = 'base' | 'premium' | 'neutral' | 'discount';

export interface ImpactBadge {
  type: ImpactBadgeType;
  label: string;
  rawMultiplier: number;
}

function formatBaseValue(median: number): string {
  if (median >= 1000) {
    const billions = median / 1000;
    return billions % 1 === 0 ? `$${billions}B base` : `$${billions.toFixed(1)}B base`;
  }
  return `$${median}M base`;
}

function buildBadgeFromMultiplier(multiplier: number): ImpactBadge {
  if (multiplier > 1.005) {
    const pct = Math.round((multiplier - 1) * 100);
    return { type: 'premium', label: `+${pct}%`, rawMultiplier: multiplier };
  }
  if (multiplier < 0.995) {
    const pct = Math.round((1 - multiplier) * 100);
    return { type: 'discount', label: `-${pct}%`, rawMultiplier: multiplier };
  }
  return { type: 'neutral', label: 'Neutral', rawMultiplier: 1.0 };
}

const baselinesMap: Record<string, PhaseBaselines> = {
  oncology: benchmarks.phaseBaselines,
  neurology: benchmarks.neurologyPhaseBaselines,
  immunology: benchmarks.immunologyPhaseBaselines,
  metabolic: benchmarks.metabolicPhaseBaselines,
};

export function getPhaseImpactBadge(phase: string, therapeuticArea: string): ImpactBadge {
  const baselines = baselinesMap[therapeuticArea] || baselinesMap.oncology;
  const data = baselines[phase];
  if (!data) return { type: 'neutral', label: 'N/A', rawMultiplier: 1.0 };
  const median = data.totalValue.median;
  return { type: 'base', label: formatBaseValue(median), rawMultiplier: median };
}

export function getMultiplierImpactBadge(configKey: string, optionValue: string): ImpactBadge {
  const config = benchmarks.multiplierConfig[configKey as keyof Benchmarks['multiplierConfig']] as Record<string, MultiplierOption> | undefined;
  if (!config || !config[optionValue]) {
    return { type: 'neutral', label: 'Neutral', rawMultiplier: 1.0 };
  }
  return buildBadgeFromMultiplier(config[optionValue].multiplier);
}

export function getTerritoryImpactBadge(territory: string): ImpactBadge {
  const data = benchmarks.territories[territory];
  if (!data) return { type: 'neutral', label: 'Neutral', rawMultiplier: 1.0 };
  return buildBadgeFromMultiplier(data.multiplier);
}

export function getModalityImpactBadge(modality: string): ImpactBadge {
  const data = benchmarks.modalities[modality];
  if (!data) return { type: 'neutral', label: 'Neutral', rawMultiplier: 1.0 };
  return buildBadgeFromMultiplier(data.multiplier);
}

const indicationCategoriesMap: Record<string, string[]> = {
  solidTumor: Object.keys(benchmarks.indications.solidTumor),
  hematologic: Object.keys(benchmarks.indications.hematologic),
  neurology: Object.keys(benchmarks.indications.neurology),
  immunology: Object.keys(benchmarks.indications.immunology),
  metabolic: Object.keys(benchmarks.indications.metabolic),
};

function findIndicationCategory(indicationValue: string): string | null {
  for (const [cat, values] of Object.entries(indicationCategoriesMap)) {
    if (values.includes(indicationValue)) return cat;
  }
  return null;
}

export function getIndicationImpactBadge(indicationValue: string): ImpactBadge {
  const category = findIndicationCategory(indicationValue);
  if (!category) return { type: 'neutral', label: 'Neutral', rawMultiplier: 1.0 };
  const indCat = benchmarks.indications[category as keyof Benchmarks['indications']];
  const data = indCat?.[indicationValue];
  if (!data) return { type: 'neutral', label: 'Neutral', rawMultiplier: 1.0 };
  return buildBadgeFromMultiplier(data.multiplier);
}
