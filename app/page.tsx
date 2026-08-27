import type { Metadata } from 'next';
import HomeContent from './HomeContent';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Solidus — Life Sciences Deal Intelligence & Benchmarks | Ambrosia Ventures',
  description: `Instant deal benchmarks, rNPV analysis, and Monte Carlo simulation for biopharma licensing, M&A, and pharma partnerships. ${DEAL_STATS.TOTAL_DEALS} verified transactions across 12 therapeutic areas and 23+ modalities. Upfront payments, milestones, royalty rates, partner matching, and AI deal memos — powered by SEC EDGAR, FTC pre-merger filings, and ClinicalTrials.gov data. Free to start.`,
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co',
  },
  openGraph: {
    title: 'Solidus — Life Sciences Deal Intelligence & Benchmarks | Ambrosia Ventures',
    description: `Instant biopharma deal benchmarks from ${DEAL_STATS.TOTAL_DEALS} verified transactions. rNPV modeling, Monte Carlo simulation, partner matching, and AI deal intelligence across 12 therapeutic areas. Free to start.`,
    url: 'https://solidus.ambrosiaventures.co',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: `Solidus — Instant benchmarks from ${DEAL_STATS.TOTAL_DEALS} real biopharma licensing transactions`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Solidus — Life Sciences Deal Intelligence & Benchmarks',
    description: `Instant biopharma deal benchmarks, rNPV, Monte Carlo & AI deal intelligence. ${DEAL_STATS.TOTAL_DEALS} verified deals, 700+ company profiles, 12 therapeutic areas. Free to start.`,
    images: ['/api/og'],
  },
};

export default function HomePage() {
  return <HomeContent />;
}
