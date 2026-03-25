// Centralized constants for marketing/pricing/stats strings
// Update here when pricing, deal counts, or benchmark dates change

export const PRICING = {
  PRO_MONTHLY: '$99/month',
  PRO_PRICE: '$99',
  PRO_PRICE_NUM: 99,
  PRO_ANNUAL_MONTHLY: '$79/month',
  PRO_ANNUAL_PRICE: '$948',
  PRO_ANNUAL_PRICE_NUM: 948,
  PRO_ANNUAL_MONTHLY_NUM: 79,
  PRO_ANNUAL_SAVINGS: '$240',
  REPORT_PRICE: '$149',
  REPORT_PRICE_NUM: 149,
  REPORT_LABEL: 'Deal Report',
} as const;

/**
 * Rounds a count down to the nearest 100 and formats as "X,Y00+".
 * e.g., 3561 → "3,500+", 3649 → "3,600+", 3450 → "3,400+"
 * Rounds down to the nearest hundred so we never overstate.
 */
export function formatDealCount(count: number): string {
  const rounded = Math.floor(count / 100) * 100;
  return `${rounded.toLocaleString()}+`;
}

// Live deal count — updated by daily-stats cron writing to this file,
// or manually when the number is known to have changed significantly.
// Current DB count as of last check: 3,561
const LIVE_DEAL_COUNT = 3561;

export const DEAL_STATS = {
  TOTAL_DEALS: formatDealCount(LIVE_DEAL_COUNT),
  TOTAL_DEALS_RAW: LIVE_DEAL_COUNT,
  TOTAL_COMPANIES: '850+',
  TOTAL_DEALS_DESCRIPTION: 'real biopharma deals across 12 therapeutic areas — licensing, acquisitions, collaborations, option agreements, and co-development — sourced from SEC 8-K filings, press releases, and regulatory databases',
  NEUROLOGY_DEALS: '150+',
  NEUROLOGY_DEALS_DESCRIPTION: 'neurology R&D partnerships',
  NEUROLOGY_TOTAL_VALUE: '$45.9B',
  NEUROLOGY_TIMEFRAME: '2017-2026',
  IMMUNOLOGY_DEALS: '113+',
  IMMUNOLOGY_DEALS_DESCRIPTION: 'immunology/autoimmune R&D partnerships',
  IMMUNOLOGY_TOTAL_VALUE: '$13B+',
  IMMUNOLOGY_TIMEFRAME: '2017-2026',
  METABOLIC_DEALS: '79+',
  METABOLIC_DEALS_DESCRIPTION: 'metabolic/obesity R&D partnerships',
  METABOLIC_TOTAL_VALUE: '$25B+',
  METABOLIC_TIMEFRAME: '2017-2026',
} as const;

export const BENCHMARK_VERSION = {
  LABEL: '2025-2026 Market Benchmarks v5.0',
  YEAR_RANGE: '2025-2026',
} as const;
