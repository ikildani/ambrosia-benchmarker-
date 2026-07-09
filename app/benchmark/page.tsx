import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { BENCHMARK_PRICING, DEAL_STATS } from '@/lib/config/constants';
import BenchmarkIntakeWizard from '@/components/benchmark/BenchmarkIntakeWizard';

export const metadata: Metadata = {
  title: 'Deal Intelligence Brief — Biopharma Licensing Deal Landscape Report | $2,500',
  description:
    `Comprehensive deal landscape report for any biopharma indication. 52 deal calculations across 13 modalities and 4 structures, comparable transactions from ${DEAL_STATS.TOTAL_DEALS} deals, AI strategic narrative, partner matching with intent scoring, and negotiation playbook. White-label branding included. Delivered in 24 hours.`,
  keywords: [
    'biopharma deal landscape report', 'pharma licensing benchmarks', 'drug licensing deal terms',
    'biotech out-licensing advisory', 'pharma deal intelligence', 'indication deal benchmarks',
    'licensing deal valuation report', 'pharma BD deal benchmarks', 'biopharma deal advisory',
    'biotech licensing landscape analysis', 'pharma M&A benchmarks', 'deal structure benchmarking',
    'pharmaceutical licensing terms report', 'biotech deal advisory service',
    'oncology deal benchmarks', 'neurology licensing benchmarks', 'immunology deal landscape',
    'rare disease deal terms', 'ADC deal benchmarks', 'bispecific antibody deal terms',
  ],
  openGraph: {
    title: 'Deal Intelligence Brief — Full Indication Deal Landscape | Ambrosia Ventures',
    description:
      `The complete deal landscape for any biopharma indication. 52 deal calculations, AI narrative, partner matching, rNPV + Monte Carlo valuation. Calibrated against ${DEAL_STATS.TOTAL_DEALS} real transactions. $2,500 all-inclusive with white-label branding.`,
    url: 'https://calculator.ambrosiaventures.co/benchmark',
    type: 'website',
    images: [{
      url: '/api/og?title=Deal%20Intelligence%20Brief&subtitle=52%20Deal%20Calculations%20%C2%B7%20AI%20Narrative%20%C2%B7%2024hr%20Delivery',
      width: 1200,
      height: 630,
      alt: 'Ambrosia Ventures Deal Intelligence Brief — Full Indication Deal Landscape Report',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Deal Intelligence Brief — $2,500 | Ambrosia Ventures',
    description: `Full deal landscape for any biopharma indication. 52 calculations, AI narrative, comparable transactions from ${DEAL_STATS.TOTAL_DEALS} deals, partner matching, white-label branding. 24hr delivery.`,
    images: ['/api/og?title=Deal%20Intelligence%20Brief&subtitle=52%20Deal%20Calculations%20%C2%B7%20AI%20Narrative%20%C2%B7%2024hr%20Delivery'],
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/benchmark',
  },
};

const PROOF_POINTS = [
  '52 deal combinations',
  'AI strategic narrative',
  'Delivered in 24 hours',
] as const;

const briefProductSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Deal Intelligence Brief',
  description: 'Comprehensive biopharma deal landscape report covering 52 deal calculations across 13 modalities and 4 deal structures for any indication. Includes AI strategic narrative, comparable transactions, partner matching, rNPV valuation, Monte Carlo simulation, and negotiation playbook. White-label branding and walkthrough included.',
  url: 'https://calculator.ambrosiaventures.co/benchmark',
  brand: { '@type': 'Organization', name: 'Ambrosia Ventures' },
  offers: {
    '@type': 'Offer',
    price: '2500',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    priceValidUntil: '2027-12-31',
    seller: { '@type': 'Organization', name: 'Ambrosia Ventures' },
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    reviewCount: '12',
    bestRating: '5',
  },
};

const briefFaqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is a Deal Intelligence Brief?',
      acceptedAnswer: { '@type': 'Answer', text: 'A comprehensive deal landscape report covering 52 deal calculations (13 modalities x 4 deal structures) for any biopharma indication. It includes AI-written strategic narrative and negotiation playbook, comparable transactions from 2,500+ deals, partner matching with intent scoring, full financial model suite (rNPV, Monte Carlo, scenarios), M&A structures with CVR valuation, and white-label branding.' },
    },
    {
      '@type': 'Question',
      name: 'How long does delivery take?',
      acceptedAnswer: { '@type': 'Answer', text: 'The Brief is delivered within 24 hours of the intake call. The process is: (1) submit request, (2) 15-minute intake call to customize the analysis, (3) delivery within 24 hours, (4) complimentary 30-minute walkthrough of the findings.' },
    },
    {
      '@type': 'Question',
      name: 'What therapeutic areas and indications are covered?',
      acceptedAnswer: { '@type': 'Answer', text: 'The Brief covers any indication across 12 therapeutic areas: oncology, neurology, immunology, metabolic, cardiovascular, rare disease, infectious disease, ophthalmology, hematology, dermatology, gastroenterology, and women\'s health. Each Brief analyzes 13 modalities (small molecule, mAb, ADC, bispecific, gene therapy, RNAi, and more) across licensing, option, co-development, and M&A structures.' },
    },
    {
      '@type': 'Question',
      name: 'Who uses the Deal Intelligence Brief?',
      acceptedAnswer: { '@type': 'Answer', text: 'BD and licensing executives at biotech companies preparing out-licensing or in-licensing strategies, VC/PE fund partners evaluating life sciences deals for investment committee presentations, advisory firms running deal processes, and corporate development teams at pharma companies scoping competitive landscapes.' },
    },
    {
      '@type': 'Question',
      name: 'How is the Brief different from the $499 report?',
      acceptedAnswer: { '@type': 'Answer', text: 'The $499 Deal Intelligence Report covers one modality and one deal structure. The $2,500 Brief covers ALL 52 combinations (13 modalities x 4 structures) for a single indication, with human concierge service, custom AI narrative tailored to your specific deal context, white-label branding for IC/board presentations, and a complimentary walkthrough call.' },
    },
  ],
};

export default function BenchmarkPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(briefProductSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(briefFaqSchema) }} />
      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="bg-[#1a1e42] dark:bg-slate-950 text-white">
        <div className="max-w-4xl mx-auto px-4 py-20 sm:py-28 text-center">
          {/* Eyebrow */}
          <p className="text-teal-400 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] mb-4">
            Deal Intelligence Brief
          </p>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
            The complete deal landscape
            <br className="hidden sm:block" /> for any indication
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-white/60 mb-10">
            Every modality. Every structure. Every counterparty.
          </p>

          {/* Proof points */}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10 mb-10">
            {PROOF_POINTS.map((point) => (
              <div
                key={point}
                className="flex items-center gap-2 text-sm text-white/80"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                {point}
              </div>
            ))}
          </div>

          {/* Price */}
          <div className="mb-10">
            <span className="text-3xl sm:text-4xl font-bold">
              {BENCHMARK_PRICING.PRICE}
            </span>
            <span className="text-white/50 text-sm ml-2">all-inclusive</span>
            <p className="text-white/40 text-xs mt-2">
              Includes white-label branding + complimentary walkthrough
            </p>
          </div>

          {/* Scroll CTA */}
          <a
            href="#wizard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
          >
            Configure Your Brief
            <span aria-hidden="true" className="text-base">&#8595;</span>
          </a>
        </div>
      </section>

      {/* ── Wizard ─────────────────────────────────────────────────── */}
      <section className="bg-slate-50 dark:bg-slate-900">
        <BenchmarkIntakeWizard />
      </section>

      {/* ── What's Included ────────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-center mb-12">
            What&apos;s Included
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BENCHMARK_PRICING.INCLUDES.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-700/30"
              >
                <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
