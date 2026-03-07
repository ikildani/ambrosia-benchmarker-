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

export const DEAL_STATS = {
  TOTAL_DEALS: '600+',
  TOTAL_DEALS_DESCRIPTION: 'real biopharma licensing deals across 8 therapeutic areas including oncology, neurology, immunology, metabolic, cardiovascular, infectious disease, ophthalmology, and women\'s health',
  NEUROLOGY_DEALS: '88+',
  NEUROLOGY_DEALS_DESCRIPTION: 'neurology R&D partnerships',
  NEUROLOGY_TOTAL_VALUE: '$45.9B',
  NEUROLOGY_TIMEFRAME: '2024-2026',
  IMMUNOLOGY_DEALS: '48+',
  IMMUNOLOGY_DEALS_DESCRIPTION: 'immunology/autoimmune R&D partnerships',
  IMMUNOLOGY_TOTAL_VALUE: '$13B+',
  IMMUNOLOGY_TIMEFRAME: '2019-2026',
  METABOLIC_DEALS: '35+',
  METABOLIC_DEALS_DESCRIPTION: 'metabolic/obesity R&D partnerships',
  METABOLIC_TOTAL_VALUE: '$25B+',
  METABOLIC_TIMEFRAME: '2022-2026',
} as const;

export const BENCHMARK_VERSION = {
  LABEL: '2025-2026 Market Benchmarks v5.0',
  YEAR_RANGE: '2025-2026',
} as const;
