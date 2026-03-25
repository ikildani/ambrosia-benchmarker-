// SEO insight page slugs — used by sitemap.ts and for cross-linking
export const SEO_INSIGHT_SLUGS = [
  'oncology-upfront-payment-benchmarks',
  'biotech-out-licensing-deal-terms-2025-2026',
  'phase-2-milestone-payment-benchmarks',
  'preclinical-asset-valuation-licensing',
  'pharma-licensing-royalty-rates',
  'deal-terms-by-therapeutic-area',
  'biopharma-deal-valuation-methods',
  'biotech-licensing-europe',
  'out-licensing-asia-pacific',
  'israel-biotech-deal-benchmarks',
] as const;

export type SeoInsightSlug = (typeof SEO_INSIGHT_SLUGS)[number];
