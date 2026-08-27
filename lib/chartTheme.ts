// Branded chart color palette and theming for Recharts

export const CHART_COLORS = {
  // Primary palette (teal family)
  teal500: '#0EA5A5',
  teal600: '#0c8e8e',
  cyan500: '#06B6D4',
  cyan600: '#0891B2',

  // Accent
  accent500: '#E6A800',
  accent400: '#f0bf1a',

  // Neutral
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',

  // Positive / negative
  positive: '#0EA5A5',
  negative: '#E6A800',

  // Grid & axis (designed for dark backgrounds)
  gridLine: '#334155',
  axisLabel: '#94A3B8',
  axisLabelBold: '#CBD5E1',
  axisLine: '#334155',
} as const;

// Bar chart color sequence
export const BAR_COLORS = [
  CHART_COLORS.teal500,
  CHART_COLORS.cyan500,
  CHART_COLORS.teal600,
  CHART_COLORS.cyan600,
] as const;

// Dark mode overrides
export const CHART_COLORS_DARK = {
  gridLine: '#334155',
  axisLabel: '#94A3B8',
  axisLabelBold: '#E2E8F0',
  axisLine: '#334155',
} as const;

// Per-TA colors for stacked/multi-series trend charts
export const TA_CHART_COLORS: Record<string, string> = {
  oncology: '#f43f5e',
  neurology: '#8b5cf6',
  immunology: '#3b82f6',
  metabolic: '#f59e0b',
  cardiovascular: '#ef4444',
  infectiousDisease: '#10b981',
  ophthalmology: '#06b6d4',
  womensHealth: '#ec4899',
  rareDisease: '#a855f7',
  hematology: '#f97316',
  dermatology: '#d946ef',
  gastroenterology: '#84cc16',
} as const;

// Sequential palette for multi-series line/area charts (up to 8 series)
export const SERIES_COLORS = [
  '#0EA5A5',
  '#06B6D4',
  '#3b82f6',
  '#8b5cf6',
  '#E6A800',
  '#f43f5e',
  '#10b981',
  '#f97316',
] as const;
