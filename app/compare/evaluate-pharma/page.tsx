import { Metadata } from 'next';
import Link from 'next/link';
import { DEAL_STATS, PRICING } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Ambrosia vs EvaluatePharma | Biopharma Deal Intelligence Comparison',
  description:
    'Compare Ambrosia Ventures to EvaluatePharma for biopharma deal benchmarking. See how deal coverage, pricing, and analytics compare.',
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/compare/evaluate-pharma',
  },
  openGraph: {
    title: 'Ambrosia vs EvaluatePharma | Biopharma Deal Intelligence Comparison',
    description:
      'Compare Ambrosia Ventures to EvaluatePharma for biopharma deal benchmarking. See how deal coverage, pricing, and analytics compare.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/compare/evaluate-pharma',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ambrosia vs EvaluatePharma | Deal Intelligence Comparison',
    description:
      'How Ambrosia compares to EvaluatePharma for biopharma deal benchmarking and valuation.',
  },
};

const FAQ_ITEMS = [
  {
    question: 'How does Ambrosia compare to EvaluatePharma?',
    answer:
      'Ambrosia focuses on deal-specific benchmarking — upfront payments, milestones, royalty rates, and partner matching across 1,500+ verified transactions. EvaluatePharma excels at consensus revenue forecasts and pipeline coverage but lacks deal-specific mechanics like Monte Carlo simulation for deal terms, real options valuation, and competitive dynamics engines.',
  },
  {
    question: 'What makes Ambrosia different from EvaluatePharma?',
    answer:
      'Ambrosia provides 14 purpose-built calculation engines for biopharma deal analysis: rNPV, Monte Carlo simulation, partner matching (700+ companies), competitive dynamics, real options valuation, deal waterfall, and more. EvaluatePharma focuses on consensus forecasts and pipeline data without deal-specific benchmarking tools.',
  },
  {
    question: 'Is Ambrosia cheaper than EvaluatePharma?',
    answer:
      'Yes. Ambrosia Pro starts at $199/month (annual) or $299/month. EvaluatePharma typically requires enterprise contracts starting at approximately $50,000 per year with multi-year commitments. Ambrosia offers transparent, self-serve pricing with no sales process required.',
  },
  {
    question: 'Can Ambrosia replace EvaluatePharma for deal benchmarking?',
    answer:
      'For deal-specific benchmarking and valuation, Ambrosia provides deeper deal mechanics analysis than EvaluatePharma. If your primary need is consensus revenue forecasts and long-range pipeline analytics, EvaluatePharma may complement Ambrosia. Many BD teams use both: EvaluatePharma for market-level forecasts and Ambrosia for deal-level economics.',
  },
];

const FEATURES = [
  { feature: 'Deal Benchmarking', ambrosia: true, competitor: false },
  { feature: 'rNPV Analysis', ambrosia: true, competitor: false },
  { feature: 'Monte Carlo Simulation', ambrosia: true, competitor: false },
  { feature: 'Partner Matching (700+ companies)', ambrosia: true, competitor: false },
  { feature: 'Real-time Deal Intelligence', ambrosia: true, competitor: false },
  { feature: 'PDF/Excel Export', ambrosia: true, competitor: true },
  { feature: 'Competitive Dynamics Engine', ambrosia: true, competitor: false },
  { feature: 'Real Options Valuation', ambrosia: true, competitor: false },
  { feature: 'Consensus Revenue Forecasts', ambrosia: false, competitor: true },
  { feature: 'Pipeline Coverage (global)', ambrosia: true, competitor: true },
  { feature: 'API Access', ambrosia: true, competitor: true },
  { feature: 'Pricing Transparency', ambrosia: true, competitor: false },
];

function Check() {
  return (
    <svg className="w-5 h-5 text-teal-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Cross() {
  return (
    <svg className="w-5 h-5 text-red-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function EvaluatePharmaComparePage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <main className="min-h-screen bg-[#0a0e1a]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <Link
          href="/compare"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-400 transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Comparisons
        </Link>
        <p className="text-xs font-bold text-teal-400 tracking-[0.15em] uppercase mb-3">
          Platform Comparison
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          Ambrosia vs EvaluatePharma
        </h1>
        <p className="text-lg text-slate-400 max-w-3xl">
          EvaluatePharma leads in consensus revenue forecasts and pipeline analytics. Ambrosia
          delivers deal-specific benchmarking with {DEAL_STATS.TOTAL_DEALS} verified transactions,
          14 calculation engines, and transparent pricing starting at {PRICING.PRO_ANNUAL_MONTHLY}.
        </p>
      </section>

      {/* Comparison Table */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Feature Comparison</h2>
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-4 px-5 text-slate-400 font-medium">Feature</th>
                <th className="text-center py-4 px-5 text-teal-400 font-semibold">Ambrosia</th>
                <th className="text-center py-4 px-5 text-slate-400 font-medium">EvaluatePharma</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map(({ feature, ambrosia, competitor }, i) => (
                <tr
                  key={feature}
                  className={`border-b border-white/[0.04] ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}
                >
                  <td className="py-3.5 px-5 text-slate-300 font-medium">{feature}</td>
                  <td className="py-3.5 px-5">{ambrosia ? <Check /> : <Cross />}</td>
                  <td className="py-3.5 px-5">{competitor ? <Check /> : <Cross />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Key Differentiators */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Key Differentiators</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              title: 'Deal-Specific Benchmarking',
              description:
                'Ambrosia benchmarks against real deal terms — upfronts, milestones, royalties, and equity stakes — not just revenue forecasts. Every data point is transaction-level.',
            },
            {
              title: '14 Calculation Engines',
              description:
                'rNPV, Monte Carlo, tornado sensitivity, partner matching, competitive dynamics, real options, deal waterfall, scenario comparison, and more — purpose-built for biopharma BD.',
            },
            {
              title: 'Transparent Pricing',
              description: `Pro starts at ${PRICING.PRO_ANNUAL_MONTHLY} (annual). No enterprise sales process, no six-figure minimums, no multi-year lock-in. EvaluatePharma starts around $50K/year.`,
            },
            {
              title: '700+ Partner Company Database',
              description:
                'Algorithmic partner matching across 700+ pharma and biotech companies with therapeutic area affinity, deal history, and strategic fit scoring.',
            },
          ].map(({ title, description }) => (
            <div
              key={title}
              className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]"
            >
              <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Comparison */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-8">
          <h2 className="text-2xl font-bold text-white mb-2">Pricing Comparison</h2>
          <p className="text-slate-400 mb-6">
            Ambrosia is designed for BD professionals and biotech teams who need institutional-grade
            deal analytics without enterprise procurement overhead.
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-teal-500/5 border border-teal-500/20">
              <p className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-1">
                Ambrosia Pro
              </p>
              <p className="text-3xl font-bold text-white">
                {PRICING.PRO_ANNUAL_MONTHLY}{' '}
                <span className="text-sm font-normal text-slate-500">(annual)</span>
              </p>
              <p className="text-sm text-slate-400 mt-1">
                or {PRICING.PRO_MONTHLY} month-to-month
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                <li>All 14 calculation engines</li>
                <li>Unlimited benchmarks</li>
                <li>PDF/Excel export</li>
                <li>Partner matching</li>
                <li>No contract required</li>
              </ul>
            </div>
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                EvaluatePharma
              </p>
              <p className="text-3xl font-bold text-white">
                ~$50K+<span className="text-sm font-normal text-slate-500">/year</span>
              </p>
              <p className="text-sm text-slate-400 mt-1">Enterprise contracts only</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-500">
                <li>Sales-led procurement</li>
                <li>Multi-year commitments typical</li>
                <li>Per-seat pricing adds up</li>
                <li>No self-serve option</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {FAQ_ITEMS.map(({ question, answer }) => (
            <div
              key={question}
              className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]"
            >
              <h3 className="text-base font-semibold text-white mb-2">{question}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center rounded-xl bg-gradient-to-b from-teal-500/5 to-transparent border border-teal-500/10 p-10">
          <h2 className="text-2xl font-bold text-white mb-3">
            See the Difference With Your Own Deal
          </h2>
          <p className="text-slate-400 mb-6 max-w-xl mx-auto">
            Run your deal parameters through Ambrosia&apos;s 14 engines and compare the depth of
            analysis to any platform on the market.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/calculator"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all text-sm"
            >
              Start Free Trial
            </Link>
            <Link
              href="mailto:issa@ambrosiaventures.co?subject=Demo%20Request"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.04] border border-white/[0.1] text-white font-semibold rounded-xl hover:bg-white/[0.08] transition-all text-sm"
            >
              Schedule Demo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
