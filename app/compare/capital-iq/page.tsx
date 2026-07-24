import { Metadata } from 'next';
import Link from 'next/link';
import { DEAL_STATS, PRICING } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Ambrosia vs S&P Capital IQ | Biotech Deal Benchmarking',
  description:
    'Compare Ambrosia Ventures to S&P Capital IQ for biotech deal analysis. Deal-specific depth vs general financial data.',
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/compare/capital-iq',
  },
  openGraph: {
    title: 'Ambrosia vs S&P Capital IQ | Biotech Deal Benchmarking',
    description:
      'Compare Ambrosia Ventures to S&P Capital IQ for biotech deal analysis. Deal-specific depth vs general financial data.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/compare/capital-iq',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ambrosia vs S&P Capital IQ | Biotech Deal Benchmarking',
    description:
      'Deal-specific biopharma intelligence vs broad financial data. See the comparison.',
  },
};

const FAQ_ITEMS = [
  {
    question: 'How does Ambrosia compare to S&P Capital IQ?',
    answer:
      'Capital IQ is a broad financial data terminal covering equities, credit, M&A, and company fundamentals across all industries. Ambrosia is purpose-built for biopharma deal analysis — providing licensing-specific benchmarks, pharma deal engines, and partner matching that Capital IQ does not offer.',
  },
  {
    question: 'What makes Ambrosia different from Capital IQ for biopharma deals?',
    answer:
      'Capital IQ reports deal headlines — total value, date, and parties. Ambrosia breaks down deal mechanics: upfront-to-total ratios, milestone allocation by type (development, regulatory, commercial), royalty rate benchmarks, and risk-adjusted valuations using rNPV and Monte Carlo simulation.',
  },
  {
    question: 'Is Ambrosia cheaper than S&P Capital IQ?',
    answer:
      'Significantly. Ambrosia Pro starts at $199/month (annual) with no minimum seats. Capital IQ enterprise licenses typically start at $25,000+ per year per seat, often requiring multi-seat minimums and annual commitments.',
  },
  {
    question: 'Can I use Ambrosia alongside Capital IQ?',
    answer:
      'Yes. Many BD teams use Capital IQ for company financials, equity research, and broad M&A screening, then use Ambrosia for deal-specific benchmarking, valuation engines, and partner matching. The platforms are complementary — Ambrosia fills the pharma deal economics gap that Capital IQ does not address.',
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
  { feature: 'Broad Financial Data (all industries)', ambrosia: false, competitor: true },
  { feature: 'Equity & Credit Research', ambrosia: false, competitor: true },
  { feature: 'M&A Screening (all sectors)', ambrosia: false, competitor: true },
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

export default function CapitalIQComparePage() {
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
          Ambrosia vs S&amp;P Capital IQ
        </h1>
        <p className="text-lg text-slate-400 max-w-3xl">
          Capital IQ covers financial data across every industry. Ambrosia goes deep on biopharma
          deal economics — {DEAL_STATS.TOTAL_DEALS} verified deals, 14 pharma-specific engines, and
          transparent pricing starting at {PRICING.PRO_ANNUAL_MONTHLY}.
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
                <th className="text-center py-4 px-5 text-slate-400 font-medium">Capital IQ</th>
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
              title: 'Pharma-Specific Deal Engines',
              description:
                'Capital IQ shows deal headlines. Ambrosia deconstructs deal mechanics — upfront-to-total ratios, milestone structures, royalty bands, and equity stakes — across 12 therapeutic areas.',
            },
            {
              title: 'Licensing Deal Terms',
              description:
                'Capital IQ tracks M&A and public equity deals. Ambrosia specializes in the licensing and partnership deals that drive biopharma BD — the terms you actually negotiate.',
            },
            {
              title: 'Self-Serve, No Procurement',
              description: `Start using Ambrosia in minutes at ${PRICING.PRO_ANNUAL_MONTHLY} (annual). Capital IQ requires enterprise sales, IT provisioning, and contracts starting at ~$25K+/seat/year.`,
            },
            {
              title: 'Partner Matching Algorithm',
              description:
                'Match your asset to the best potential partners from 850+ pharma and biotech companies — scored by therapeutic area focus, deal history, and strategic fit. Capital IQ has no equivalent.',
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
            Capital IQ is designed for multi-sector financial analysis at enterprise scale. Ambrosia
            is built for biopharma BD teams who need deal-specific depth without the overhead.
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
                S&amp;P Capital IQ
              </p>
              <p className="text-3xl font-bold text-white">
                ~$25K+<span className="text-sm font-normal text-slate-500">/seat/year</span>
              </p>
              <p className="text-sm text-slate-400 mt-1">Enterprise contracts only</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-500">
                <li>Multi-seat minimums typical</li>
                <li>Annual commitment required</li>
                <li>IT provisioning needed</li>
                <li>Sales-led procurement</li>
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
            Deal-Specific Depth, Without the Enterprise Price Tag
          </h2>
          <p className="text-slate-400 mb-6 max-w-xl mx-auto">
            Run your deal parameters through Ambrosia&apos;s purpose-built engines and see what
            Capital IQ can&apos;t show you.
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
