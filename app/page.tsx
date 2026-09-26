import type { Metadata } from 'next';
import { getLiveDealStats } from '@/lib/deal-stats';
import { getDealCoverageStats } from '@/lib/deal-coverage';
import { calculateDealTerms, modalityOptions, indicationOptions } from '@/lib/calculations';
import SiteHeaderAuto from '@/components/SiteHeaderAuto';
import ExitIntentCapture from '@/components/ExitIntentCapture';
import FAQSection from '@/components/FAQSection';
import HomeHero from '@/components/landing/HomeHero';
import LiveDemo from '@/components/landing/LiveDemo';
import { DEMO_DEFAULT, type DemoResult } from '@/components/landing/live-demo-shared';
import CoverageSection from '@/components/landing/CoverageSection';
import { HomeMiddle, HomeGuides, HomeAbout } from '@/components/landing/HomeSections';
import PricingIsland from '@/components/landing/PricingIsland';

/** Default live-demo scenario, computed on the server so the widget paints with real numbers and no engine download. */
function demoInitial(): DemoResult {
  const r = calculateDealTerms({
    therapeuticArea: 'oncology',
    phase: DEMO_DEFAULT.phase,
    modality: DEMO_DEFAULT.modality,
    indication: DEMO_DEFAULT.indication,
    territory: 'global',
    biomarker: 'unselected',
    lineOfTherapy: '2L',
    treatmentApproach: 'symptomatic',
    combinationPotential: 'some',
    competitivePosition: 'racing',
    dataQuality: 'promising',
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
  });
  return { terms: { upfront: r.terms.upfront, totalDealValue: r.terms.totalDealValue }, tieredRoyalties: { base: r.tieredRoyalties.base } };
}

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
  const [stats, coverage] = await Promise.all([getLiveDealStats(), getDealCoverageStats()]);
  const dealCount = stats.totalDealsDisplay;
  const demoOptions = {
    modalities: modalityOptions.map((g) => ({ group: g.group, options: g.options.map((o) => ({ value: o.value, label: o.label })) })),
    indications: indicationOptions.map((g) => ({ group: g.group, options: g.options.map((o) => ({ value: o.value, label: o.label })) })),
  };
  return (
    <main id="main-content" className="min-h-screen bg-white dark:bg-slate-900 transition-colors duration-300">
      <SiteHeaderAuto />
      <HomeHero dealCount={dealCount} />
      <LiveDemo initial={demoInitial()} modalities={demoOptions.modalities} indications={demoOptions.indications} />
      <CoverageSection stats={coverage} />
      <HomeMiddle dealCount={dealCount} />
      <PricingIsland />
      <HomeGuides dealCount={dealCount} />
      <FAQSection />
      <HomeAbout />
      <ExitIntentCapture />
    </main>
  );
}
