import { CalculationResult, formatCurrency } from './calculations';

// Saved scenario interface
export interface SavedScenario {
  id: string;
  name: string;
  notes?: string;
  inputs: Record<string, string>;
  results: CalculationResult;
  labels: { phase: string; modality: string; indication: string };
  created_at: string;
  updated_at?: string;
}

// Metric difference result
export interface MetricDifference {
  absoluteDiff: number;
  percentDiff: number;
  direction: 'increase' | 'decrease' | 'neutral';
}

// Comparison metric definition
export interface ComparisonMetric {
  key: string;
  label: string;
  category: 'dealInfo' | 'financial' | 'derived';
  format: 'text' | 'currency' | 'percentage' | 'range';
  getValue: (scenario: SavedScenario) => string;
  getNumericValue?: (scenario: SavedScenario) => number;
}

// Territory display labels
const TERRITORY_LABELS: Record<string, string> = {
  global: 'Global',
  us_only: 'US Only',
  ex_us: 'Ex-US',
  europe: 'Europe',
  china: 'China',
  japan: 'Japan',
  row: 'Rest of World',
  us_eu: 'US + EU',
  us_japan: 'US + Japan',
};

// Competitive position display labels
const POSITION_LABELS: Record<string, string> = {
  firstInClass: 'First-in-class',
  firstToPivotal: 'First-to-pivotal',
  bestInClass: 'Best-in-class',
  racing: 'Racing',
  behind: 'Behind',
  crowded: 'Crowded',
};

// All comparison metrics
export const COMPARISON_METRICS: ComparisonMetric[] = [
  // Deal Info Section
  {
    key: 'therapeuticArea',
    label: 'Therapeutic Area',
    category: 'dealInfo',
    format: 'text',
    getValue: (s) => {
      const area = s.inputs?.therapeuticArea;
      if (area === 'neurology') return 'Neurology / CNS';
      if (area === 'oncology') return 'Oncology';
      return area || '-';
    },
  },
  {
    key: 'phase',
    label: 'Phase',
    category: 'dealInfo',
    format: 'text',
    getValue: (s) => s.labels?.phase || '-',
  },
  {
    key: 'modality',
    label: 'Modality',
    category: 'dealInfo',
    format: 'text',
    getValue: (s) => s.labels?.modality || '-',
  },
  {
    key: 'territory',
    label: 'Territory',
    category: 'dealInfo',
    format: 'text',
    getValue: (s) => TERRITORY_LABELS[s.inputs?.territory] || s.inputs?.territory || 'Global',
  },
  {
    key: 'position',
    label: 'Position',
    category: 'dealInfo',
    format: 'text',
    getValue: (s) => POSITION_LABELS[s.inputs?.competitivePosition] || s.inputs?.competitivePosition || '-',
  },

  // Financial Section
  {
    key: 'upfront',
    label: 'UPFRONT',
    category: 'financial',
    format: 'currency',
    getValue: (s) => formatCurrency(s.results?.terms?.upfront?.median || 0),
    getNumericValue: (s) => s.results?.terms?.upfront?.median || 0,
  },
  {
    key: 'milestones',
    label: 'MILESTONES',
    category: 'financial',
    format: 'currency',
    getValue: (s) => {
      const dev = s.results?.terms?.devMilestones?.median || 0;
      const reg = s.results?.terms?.regMilestones?.median || 0;
      const comm = s.results?.terms?.commMilestones?.median || 0;
      return formatCurrency(dev + reg + comm);
    },
    getNumericValue: (s) => {
      const dev = s.results?.terms?.devMilestones?.median || 0;
      const reg = s.results?.terms?.regMilestones?.median || 0;
      const comm = s.results?.terms?.commMilestones?.median || 0;
      return dev + reg + comm;
    },
  },
  {
    key: 'totalValue',
    label: 'TOTAL VALUE',
    category: 'financial',
    format: 'currency',
    getValue: (s) => formatCurrency(s.results?.terms?.totalDealValue?.median || 0),
    getNumericValue: (s) => s.results?.terms?.totalDealValue?.median || 0,
  },
  {
    key: 'royalty',
    label: 'ROYALTY',
    category: 'financial',
    format: 'range',
    getValue: (s) => {
      const base = s.results?.tieredRoyalties?.base;
      return base ? `${base.low}% - ${base.high}%` : '-';
    },
  },

  // Derived Metrics Section
  {
    key: 'upfrontPercent',
    label: 'Upfront %',
    category: 'derived',
    format: 'percentage',
    getValue: (s) => {
      const upfront = s.results?.terms?.upfront?.median || 0;
      const total = s.results?.terms?.totalDealValue?.median || 1;
      return `${Math.round((upfront / total) * 100)}%`;
    },
    getNumericValue: (s) => {
      const upfront = s.results?.terms?.upfront?.median || 0;
      const total = s.results?.terms?.totalDealValue?.median || 1;
      return (upfront / total) * 100;
    },
  },
  {
    key: 'riskProfile',
    label: 'Risk Profile',
    category: 'derived',
    format: 'text',
    getValue: (s) => {
      const upfront = s.results?.terms?.upfront?.median || 0;
      const total = s.results?.terms?.totalDealValue?.median || 1;
      const upfrontPct = (upfront / total) * 100;
      if (upfrontPct >= 40) return 'Conservative';
      if (upfrontPct >= 25) return 'Balanced';
      if (upfrontPct >= 15) return 'Aggressive';
      return 'High Risk';
    },
  },
];

// Calculate percentage difference between two values
export function calculateDifference(
  baseline: number,
  comparison: number
): MetricDifference {
  if (baseline === 0) {
    return { absoluteDiff: comparison, percentDiff: 0, direction: 'neutral' };
  }
  const absoluteDiff = comparison - baseline;
  const percentDiff = ((comparison - baseline) / baseline) * 100;
  const direction = absoluteDiff > 0.01 ? 'increase' : absoluteDiff < -0.01 ? 'decrease' : 'neutral';
  return { absoluteDiff, percentDiff, direction };
}

// Format difference for display
export function formatDifference(diff: MetricDifference): string {
  if (diff.direction === 'neutral') return '-';
  const sign = diff.direction === 'increase' ? '+' : '';
  const arrow = diff.direction === 'increase' ? '\u25B2' : '\u25BC';
  return `${arrow} ${sign}${Math.round(diff.percentDiff)}%`;
}
