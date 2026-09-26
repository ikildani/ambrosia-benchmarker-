import type { Metadata } from 'next';
import HomeContent from './HomeContent';
import { getLiveDealStats } from '@/lib/deal-stats';

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getLiveDealStats();
  const count = stats.totalDealsDisplay;
  return {
  title: 'Solidus — Life Sciences Deal Intelligence & Benchmarks',
  description: `Instant deal benchmarks, rNPV analysis, and Monte Carlo simulation for biopharma licensing, M&A, and pharma partnerships. ${count} verified transactions across 12 therapeutic areas and 23+ modalities. Upfront payments, milestones, royalty rates, partner matching, and AI deal memos — powered by SEC EDGAR, FTC pre-merger filings, and ClinicalTrials.gov data. Free to start.`,
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co',
  },
  openGraph: {
    title: 'Solidus — Life Sciences Deal Intelligence & Benchmarks',
    description: `Instant biopharma deal benchmarks from ${count} verified transactions. rNPV modeling, Monte Carlo simulation, partner matching, and AI deal intelligence across 12 therapeutic areas. Free to start.`,
    url: 'https://solidus.ambrosiaventures.co',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: `Solidus — Instant benchmarks from ${count} real biopharma licensing transactions`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Solidus — Life Sciences Deal Intelligence & Benchmarks',
    description: `Instant biopharma deal benchmarks, rNPV, Monte Carlo & AI deal intelligence. ${count} verified deals, 700+ company profiles, 12 therapeutic areas. Free to start.`,
    images: ['/api/og'],
  },
  };
}

export default async function HomePage() {
  const stats = await getLiveDealStats();
  return <HomeContent dealCountDisplay={stats.totalDealsDisplay} />;
}
