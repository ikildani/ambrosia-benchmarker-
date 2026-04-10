// Centralized constants for marketing/pricing/stats strings
// LIVE_DEAL_COUNT is auto-updated by the daily-stats cron via GitHub API.
// Do not manually edit LIVE_DEAL_COUNT — the cron manages it.

export const PRICING = {
  PRO_MONTHLY: '$299/month',
  PRO_PRICE: '$299',
  PRO_PRICE_NUM: 299,
  PRO_ANNUAL_MONTHLY: '$199/month',
  PRO_ANNUAL_PRICE: '$2,388',
  PRO_ANNUAL_PRICE_NUM: 2388,
  PRO_ANNUAL_MONTHLY_NUM: 199,
  PRO_ANNUAL_SAVINGS: '$1,200',
  REPORT_PRICE: '$499',
  REPORT_PRICE_NUM: 499,
  REPORT_LABEL: 'Deal Report',
} as const;

// Portfolio License — multi-seat enterprise tier for VC firms and corporate venture arms.
// All tiers require annual billing. Sales-led — no self-serve checkout.
export const PORTFOLIO_PRICING = {
  GROWTH_SEATS: 5,
  GROWTH_MONTHLY: '$1,200',
  GROWTH_MONTHLY_NUM: 1200,
  GROWTH_ANNUAL: '$14,400',
  GROWTH_ANNUAL_NUM: 14400,
  GROWTH_PER_SEAT: '$240',
  GROWTH_EXTRA_SEAT: '$200',

  SCALE_SEATS: 10,
  SCALE_MONTHLY: '$2,000',
  SCALE_MONTHLY_NUM: 2000,
  SCALE_ANNUAL: '$24,000',
  SCALE_ANNUAL_NUM: 24000,
  SCALE_PER_SEAT: '$200',
  SCALE_EXTRA_SEAT: '$175',

  ENTERPRISE_SEATS: '15+',
  ENTERPRISE_MONTHLY: '$2,500',
  ENTERPRISE_MONTHLY_NUM: 2500,
  ENTERPRISE_ANNUAL: '$30,000',
  ENTERPRISE_ANNUAL_NUM: 30000,
  ENTERPRISE_PER_SEAT: '$167',
  ENTERPRISE_EXTRA_SEAT: '$150',
} as const;

export const PORTFOLIO_DEMO_URL =
  'mailto:issa@ambrosiaventures.co?subject=Portfolio%20License%20Demo%20Request&body=Fund%20name%3A%20%0APortfolio%20size%20(companies)%3A%20%0AEstimated%20seats%20needed%3A%20%0APrimary%20therapeutic%20areas%3A%20%0APreferred%20demo%20time%3A%20';

/**
 * Rounds a count down to the nearest 100 and formats as "X,Y00+".
 * e.g., 3561 → "3,500+", 3649 → "3,600+", 3439 → "3,400+"
 * Always rounds down so we never overstate.
 */
export function formatDealCount(count: number): string {
  const rounded = Math.floor(count / 100) * 100;
  return `${rounded.toLocaleString()}+`;
}

// AUTO-UPDATED BY CRON — do not edit manually
// This value is the verified deal count (excludes 'other'/internal TAs)
// Updated daily by /api/cron/daily-stats via GitHub API
// 2026-03-26: Major dedup — removed 103 fake FDA approvals + 907 duplicates
export const LIVE_DEAL_COUNT = 2535;

export const DEAL_STATS = {
  TOTAL_DEALS: formatDealCount(LIVE_DEAL_COUNT),
  TOTAL_DEALS_RAW: LIVE_DEAL_COUNT,
  TOTAL_COMPANIES: '850+',
  TOTAL_DEALS_DESCRIPTION: 'real biopharma deals across 12 therapeutic areas — licensing, acquisitions, collaborations, option agreements, and co-development — sourced from SEC 8-K filings, FTC premerger filings, press releases, and regulatory databases',
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
};

export const BENCHMARK_VERSION = {
  LABEL: '2025-2026 Market Benchmarks v5.0',
  YEAR_RANGE: '2025-2026',
} as const;
