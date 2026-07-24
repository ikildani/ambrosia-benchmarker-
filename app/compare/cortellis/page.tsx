import { Metadata } from 'next';
import Link from 'next/link';
import { DEAL_STATS, PRICING } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Ambrosia vs Cortellis | Pharmaceutical Deal Terms & Valuation',
  description:
    'Compare Ambrosia Ventures to Clarivate Cortellis for pharma deal intelligence. Pricing, deal mechanics depth, and real-time analytics.',
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/compare/cortellis',
  },
  openGraph: {
    title: 'Ambrosia vs Cortellis | Pharmaceutical Deal Terms & Valuation',
    description:
      'Compare Ambrosia Ventures to Clarivate Cortellis for pharma deal intelligence. Pricing, deal mechanics depth, and real-time analytics.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/compare/cortellis',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ambrosia vs Cortellis | Pharma Deal Intelligence',
    description:
      'Pipeline intelligence vs deal economics — how Ambrosia and Cortellis compare for pharma BD.',
  },
};

const FAQ_ITEMS = [
  {
    question: 'How does Ambrosia compare to Clarivate Cortellis?',
    answer:
      'Cortellis is a comprehensive pipeline and regulatory intelligence platform with deep clinical trial data and patent analytics. Ambrosia focuses on deal economics — benchmarking upfronts, milestones, royalties, and running valuation models across 1,500+ verified biopharma transactions with 14 purpose-built engines.',
  },
  {
    question: 'What makes Ambrosia different from Cortellis?',
    answer:
      'Cortellis covers pipeline intelligence, regulatory data, and patent landscapes. Ambrosia provides deal-specific analytics that Cortellis lacks: Monte Carlo simulation for deal terms, partner matching across 850+ companies, competitive dynamics modeling, real options valuation, and real-time deal intelligence with transparent pricing.',
  },
  {
    question: 'Is Ambrosia cheaper than Cortellis?',
    answer:
      'Substantially. Ambrosia Pro starts at $199/month (annual) or $299/month with no contract. Cortellis enterprise licenses typically run $100,000-$150,000+ per year depending on modules, with multi-year commitments and per-seat pricing.',
  },
  {
    question: 'Should I use Ambrosia or Cortellis for deal analysis?',
    answer:
      'For pipeline and regulatory intelligence, Cortellis has deep coverage. For deal-level economics — benchmarking, valuation, partner matching, and competitive dynamics — Ambrosia provides tools that Cortellis does not. Many pharma BD teams use both: Cortellis for pipeline context and Ambrosia for deal structuring and valuation.',
  },
];

const FEATURES = [
  { feature: 'Deal Benchmarking', ambrosia: true, competitor: false },
  { feature: 'rNPV Analysis', ambrosia: true, competitor: false },
  { feature: 'Monte Carlo Simulation', ambrosia: true, competitor: false },
  { feature: 'Partner Matching (850+ companies)', ambrosia: true, competitor: false },
  { feature: 'Real-time Deal Intelligence', ambrosia: true, competitor: false },
  { feature: 'PDF/Excel Export', ambrosia: true, competitor: true },
  { feature: 'Competitive Dynamics Engine', ambrosia: true, competitor: false },
  { feature: 'Real Options Valuation', ambrosia: true, competitor: false },
  { feature: 'Pipeline Intelligence (global)', ambrosia: false, competitor: true },
  { feature: 'Regulatory Data', ambrosia: false, competitor: true },
  { feature: 'Patent Analytics', ambrosia: false, competitor: true },
  { feature: 'Deal Terms Database', ambrosia: true, competitor: true },
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

export default function CortellisComparePage() {
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
          Ambrosia vs Cortellis
        </h1>
        <p className="text-lg text-slate-400 max-w-3xl">
          Clarivate Cortellis is an industry standard for pipeline and regulatory intelligence.
          Ambrosia delivers the deal economics layer — {DEAL_STATS.TOTAL_DEALS} verified
          transactions, 14 calculation engines, and pricing starting at {PRICING.PRO_ANNUAL_MONTHLY}.
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
                <th className="text-center py-4 px-5 text-slate-400 font-medium">Cortellis</th>
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
              title: 'Deal Economics, Not Just Pipeline Data',
              description:
                'Cortellis maps pipelines and regulatory milestones. Ambrosia analyzes the deal terms themselves — what comparable transactions paid in upfronts, how milestone structures break down, and what royalty rates look like by TA and phase.',
            },
            {
              title: 'Real-Time Valuation Engines',
              description:
                'Run rNPV, Monte Carlo, real options, tornado sensitivity, and deal waterfall analysis on demand. Cortellis provides static deal summaries without interactive valuation tools.',
            },
            {
              title: 'Transparent, Accessible Pricing',
              description: `Ambrosia Pro starts at ${PRICING.PRO_ANNUAL_MONTHLY} (annual) with no contract. Cortellis runs $100K-$150K+ per year with per-module pricing, making it inaccessible to smaller biotech teams.`,
            },
            {
              title: 'Competitive Dynamics Modeling',
              description:
                'Model how competitor pipeline events affect your deal leverage and timing. Ambrosia tracks competitive dynamics in real time — a capability Cortellis does not provide at the deal level.',
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
            Cortellis is built for large pharma with enterprise budgets. Ambrosia delivers
            institutional-grade deal analytics at a fraction of the cost.
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
                Clarivate Cortellis
              </p>
              <p className="text-3xl font-bold text-white">
                ~$120K+<span className="text-sm font-normal text-slate-500">/year</span>
              </p>
              <p className="text-sm text-slate-400 mt-1">Per-module enterprise pricing</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-500">
                <li>Module-based pricing adds up</li>
                <li>Multi-year commitments expected</li>
                <li>Per-seat costs on top</li>
                <li>Sales-led procurement only</li>
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
            The Deal Economics Layer Cortellis Doesn&apos;t Cover
          </h2>
          <p className="text-slate-400 mb-6 max-w-xl mx-auto">
            Run your asset through Ambrosia&apos;s 14 engines and get the deal-level analysis that
            pipeline databases can&apos;t provide.
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
