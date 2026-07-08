import type { Metadata } from 'next';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Biopharma Deal Benchmarks Q1 2026 — Free Report | Ambrosia Ventures',
  description: `Free report: upfront ranges, milestone structures, and royalty benchmarks across 12 therapeutic areas. Sourced from ${DEAL_STATS.TOTAL_DEALS} verified biopharma transactions. Download instantly.`,
  keywords: [
    'biopharma deal benchmarks', 'licensing upfront benchmarks', 'pharma deal terms 2026',
    'biotech licensing deal data', 'Phase 2 deal terms', 'ADC licensing benchmarks',
    'biopharma milestone structure', 'pharma royalty rates', 'deal valuation biotech',
    'oncology deal benchmarks', 'rare disease licensing', 'immunology deal terms',
    'biopharma comparable transactions', 'pharma deal intelligence',
  ],
  openGraph: {
    title: 'Biopharma Deal Benchmarks 2026 — Free Report',
    description: `Upfront ranges, milestone structures, and royalty benchmarks across 12 TAs. ${DEAL_STATS.TOTAL_DEALS} verified transactions. Free download.`,
    url: 'https://calculator.ambrosiaventures.co/insights/q1-2026-deal-benchmarks',
    siteName: 'Ambrosia Ventures',
    type: 'article',
    images: [{
      url: 'https://calculator.ambrosiaventures.co/og/deal-benchmarks-2026.png',
      width: 1200,
      height: 630,
      alt: 'Biopharma Deal Benchmarks 2026 — Ambrosia Ventures',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biopharma Deal Benchmarks 2026 — Free Report',
    description: `Upfront ranges, milestone structures, and royalty benchmarks across 12 TAs. ${DEAL_STATS.TOTAL_DEALS} verified transactions.`,
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/insights/q1-2026-deal-benchmarks',
  },
  robots: {
    index: true,
    follow: true,
  },
};

// JSON-LD structured data for SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Report',
  name: 'Biopharma Deal Benchmarks Q1 2026',
  description: 'Comprehensive deal benchmarking report covering upfront payments, milestone structures, royalty rates, and deal-flow trends across 12 therapeutic areas in biopharma licensing.',
  author: {
    '@type': 'Organization',
    name: 'Ambrosia Ventures',
    url: 'https://ambrosiaventures.co',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Ambrosia Ventures',
    url: 'https://calculator.ambrosiaventures.co',
  },
  datePublished: '2026-04-01',
  dateModified: '2026-04-29',
  url: 'https://calculator.ambrosiaventures.co/insights/q1-2026-deal-benchmarks',
  isAccessibleForFree: true,
  keywords: 'biopharma deal benchmarks, licensing upfront, milestone structure, royalty rates, deal valuation, pharma deal terms',
  about: {
    '@type': 'Thing',
    name: 'Biopharma Licensing and Deal Terms',
  },
};

export default function Q1BenchmarksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
