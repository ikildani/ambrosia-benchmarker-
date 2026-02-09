// Centralized configuration for all marketing, pricing, and stats values.
// Update values here instead of hunting through components.

export const SITE_CONFIG = {
  // Pricing
  proPriceAmount: 99,
  proPriceDisplay: '$99',
  proPriceWithPeriod: '$99/month',
  proPriceBilling: '$99/month • Billed monthly',
  proOriginalPrice: '$199',
  proDiscount: '50% OFF',

  // Stats
  dealsAnalyzed: '500+',
  dealValueEstimated: '$2B+',
  companiesServed: '50+',
  userSatisfaction: '99%',
  neurologyPartnerships: '88+',
  bdProsUpgraded: '127+',
  partnerResearchSpeed: '10x',

  // Limits
  freeCalculationsPerMonth: 2,
  freeCalculationsLabel: '2 calculations per month',

  // Benchmark period
  benchmarkPeriod: '2025-2026 Market Benchmarks',

  // Description text
  dealsDescription: '500+ real biopharma licensing deals across oncology and neurology',
  benchmarkTagline: 'Benchmark with 500+ real deals',
} as const;
