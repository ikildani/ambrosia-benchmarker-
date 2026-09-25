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
  STARTER_MONTHLY: '$99/month',
  STARTER_PRICE: '$99',
  STARTER_PRICE_NUM: 99,
  STARTER_ANNUAL_MONTHLY: '$79/month',
  STARTER_ANNUAL_PRICE: '$948',
  STARTER_ANNUAL_PRICE_NUM: 948,
  STARTER_ANNUAL_MONTHLY_NUM: 79,
  STARTER_ANNUAL_SAVINGS: '$240',
  STARTER_CALC_LIMIT: 10,
  STARTER_PARTNER_MATCHES: 3,
  STARTER_PDF_EXPORTS: 3,
  REPORT_PRICE: '$499',
  REPORT_PRICE_NUM: 499,
  REPORT_LABEL: 'Deal Report',
} as const;

// Portfolio License — multi-seat enterprise tier for biotech and pharma VC firms.
// All tiers require annual billing. Sales-led — no self-serve checkout.
// Pricing calibrated against comparable enterprise platforms (Cortellis, Evaluate Pharma,
// Capital IQ) and biotech VC procurement benchmarks. See project-portfolio-license-framework.md.
export const PORTFOLIO_PRICING = {
  GROWTH_SEATS: 5,
  GROWTH_MONTHLY: '$2,500',
  GROWTH_MONTHLY_NUM: 2500,
  GROWTH_ANNUAL: '$30,000',
  GROWTH_ANNUAL_NUM: 30000,
  GROWTH_PER_SEAT: '$500',
  GROWTH_EXTRA_SEAT: '$450',
  GROWTH_ANALYST_HOURS: '2 hours/month',

  SCALE_SEATS: 10,
  SCALE_MONTHLY: '$5,000',
  SCALE_MONTHLY_NUM: 5000,
  SCALE_ANNUAL: '$60,000',
  SCALE_ANNUAL_NUM: 60000,
  SCALE_PER_SEAT: '$500',
  SCALE_EXTRA_SEAT: '$400',
  SCALE_ANALYST_HOURS: '5 hours/month',

  ENTERPRISE_SEATS: '15+',
  ENTERPRISE_MONTHLY: '$10,000',
  ENTERPRISE_MONTHLY_NUM: 10000,
  ENTERPRISE_ANNUAL: '$120,000',
  ENTERPRISE_ANNUAL_NUM: 120000,
  ENTERPRISE_PER_SEAT: '$667',
  ENTERPRISE_EXTRA_SEAT: '$350',
  ENTERPRISE_ANALYST_HOURS: '10 hours/month + named analyst',
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
// 2026-06-29: Full cleanup — deleted rejected/synthetic/pre-2017/dupes, added landmark deals
// Deal count reflects only verified + pending real deals with disclosed terms.
// 2026-09-25: set by hand to the cron's own definition (1,667) — the GITHUB_TOKEN behind the
// auto-updater died on 2026-09-16, so the site showed 1,400+ against 1,900+ real rows. Server
// pages now read lib/deal-stats.ts; this constant is the fallback and the client-side copy.
export const LIVE_DEAL_COUNT = 1667;

export const DEAL_STATS = {
  TOTAL_DEALS: formatDealCount(LIVE_DEAL_COUNT),
  TOTAL_DEALS_RAW: LIVE_DEAL_COUNT,
  TOTAL_COMPANIES: '700+',
  TOTAL_DEALS_DESCRIPTION: 'verified biopharma deals across 12 therapeutic areas — licensing, acquisitions, collaborations, option agreements, and co-development — sourced from SEC 8-K filings, FTC premerger filings, press releases, and regulatory databases',
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

export const BENCHMARK_PRICING = {
  PRICE: '$2,500',
  PRICE_NUM: 2500,
  PRICE_CENTS: 250000,
  LABEL: 'Deal Intelligence Brief',
  TAGLINE: 'Map the landscape',
  DESCRIPTION: 'One asset, one decision: what to ask, from whom, by when, with the evidence behind every number.',
  MODALITY_COUNT: 13,
  DEAL_TYPE_COUNT: 4,
  CALCULATION_COUNT: 52,
  INCLUDES: [
    'A signed recommendation: ask, floor and walk-away, with what would change the view',
    'Valuation bridge reconciling comparables, calibrated range, risk-adjusted NPV and buyer-specific value to one ask',
    `Cited comparable set from the ${formatDealCount(LIVE_DEAL_COUNT)}-deal Solidus database, phase-matched, every row sourced`,
    'Buyer map ranked on evidence: fit, urgency, exclusivity losses, and what each buyer has paid at your stage',
    'Catalyst calendar and go-to-market window for the next 24 months',
    'Positioning, the five objections you will hear, and the evidence to prepare',
    'Diligence readiness list for your phase and modality',
    'Reviewed by the Managing Partner before it leaves; walkthrough call included',
    'Delivered as a confidential PDF within 24 hours of the intake call',
    'Credited in full against any subsequent advisory mandate',
  ],
  DELIVERY_HOURS: 24,
  PORTFOLIO_DISCOUNT_PRICE: '$1,500',
  PORTFOLIO_DISCOUNT_PRICE_NUM: 1500,
  PORTFOLIO_DISCOUNT_LABEL: 'Portfolio License holders',
} as const;

export const BENCHMARK_VERSION = {
  LABEL: '2025-2026 Market Benchmarks v5.0',
  YEAR_RANGE: '2025-2026',
} as const;

/**
 * Deal-memo confidence is computed from comparable-deal counts, never
 * self-reported by the LLM. "Tight" comps share the therapeutic area AND
 * (indication OR modality) with the queried asset.
 */
export const DEAL_MEMO_CONFIDENCE = {
  /** Comparable pool fetched for the memo (top MEMO_PROMPT_COMPS are shown to the model). */
  COMPS_FETCHED: 20,
  /** How many comps are listed in the prompt text. */
  PROMPT_COMPS: 8,
  /** tight-match count >= HIGH_MIN -> 'high' */
  HIGH_MIN: 15,
  /** tight-match count >= MEDIUM_MIN -> 'medium', else 'low' */
  MEDIUM_MIN: 5,
} as const;

/**
 * Per-factor calibration study (2026-09). Answers "is there a quantitative
 * lookback behind each engine multiplier?" — a ridge log-linear regression of
 * observed deal value on one-hot factor dummies over the backtest corpus.
 * Evidence only: production multipliers were NOT changed by this study.
 * Reproduce: `npm run calibration:per-factor`.
 */
export const PER_FACTOR_CALIBRATION_STUDY = {
  TAG: '2026-09',
  CORPUS_N: 462,
  DOC_PATH: 'docs/calibration-per-factor-2026-09.md',
  OUTPUT_PATH: 'scripts/calibration/output/per-factor-2026-09.json',
  COMMAND: 'npm run calibration:per-factor',
} as const;
