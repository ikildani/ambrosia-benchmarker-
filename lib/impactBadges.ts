import benchmarks from '@/data/benchmarks.json';

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

const baselinesMap: Record<string, Record<string, { totalValue: { median: number } }>> = {
  oncology: (benchmarks as any).phaseBaselines,
  neurology: (benchmarks as any).neurologyPhaseBaselines,
  immunology: (benchmarks as any).immunologyPhaseBaselines,
  metabolic: (benchmarks as any).metabolicPhaseBaselines,
};

export function getPhaseImpactBadge(phase: string, therapeuticArea: string): ImpactBadge {
  const baselines = baselinesMap[therapeuticArea] || baselinesMap.oncology;
  const data = baselines[phase];
  if (!data) return { type: 'neutral', label: 'N/A', rawMultiplier: 1.0 };
  const median = data.totalValue.median;
  return { type: 'base', label: formatBaseValue(median), rawMultiplier: median };
}

export function getMultiplierImpactBadge(configKey: string, optionValue: string): ImpactBadge {
  const config = (benchmarks.multiplierConfig as any)[configKey];
  if (!config || !config[optionValue]) {
    return { type: 'neutral', label: 'Neutral', rawMultiplier: 1.0 };
  }
  return buildBadgeFromMultiplier(config[optionValue].multiplier);
}

export function getModalityImpactBadge(modality: string): ImpactBadge {
  const data = (benchmarks as any).modalities?.[modality];
  if (!data) return { type: 'neutral', label: 'Neutral', rawMultiplier: 1.0 };
  return buildBadgeFromMultiplier(data.multiplier);
}
