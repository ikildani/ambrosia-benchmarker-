import { Metadata } from 'next';
import Link from 'next/link';
import { DEAL_STATS, PRICING } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Compare Ambrosia Ventures | Biopharma Deal Intelligence Alternatives',
  description: `Compare Ambrosia Ventures to EvaluatePharma, S&P Capital IQ, and Cortellis for biopharma deal benchmarking. ${DEAL_STATS.TOTAL_DEALS} deals, 14 engines, transparent pricing.`,
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/compare',
  },
  openGraph: {
    title: 'Compare Ambrosia Ventures | Biopharma Deal Intelligence Alternatives',
    description: 'See how Ambrosia stacks up against legacy pharma data platforms for deal benchmarking, valuation, and partner matching.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/compare',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Compare Ambrosia Ventures | Biopharma Deal Alternatives',
    description: 'See how Ambrosia stacks up against legacy pharma data platforms.',
  },
};

const COMPARISONS = [
  {
    slug: 'evaluate-pharma',
    name: 'EvaluatePharma',
    tagline: 'Consensus forecasts vs deal-specific benchmarking',
    description:
      'EvaluatePharma excels at consensus revenue forecasts and pipeline analytics. Ambrosia focuses on deal-specific mechanics — upfronts, milestones, royalties, and real-time comparable deal intelligence.',
    strengths: ['Consensus revenue forecasts', 'Pipeline coverage'],
    ambrosiaEdge: ['Deal-specific benchmarking', 'Monte Carlo simulation', 'Partner matching'],
  },
  {
    slug: 'capital-iq',
    name: 'S&P Capital IQ',
    tagline: 'Broad financial data vs deal-specific depth',
    description:
      'Capital IQ covers M&A, equity, and credit data across all industries. Ambrosia goes deep on biopharma licensing deal terms — the economics that drive BD decisions.',
    strengths: ['Broad financial data', 'M&A screening'],
    ambrosiaEdge: ['Pharma-specific engines', 'Licensing deal terms', 'rNPV & real options'],
  },
  {
    slug: 'cortellis',
    name: 'Clarivate Cortellis',
    tagline: 'Pipeline intelligence vs deal economics',
    description:
      'Cortellis provides deep pipeline and regulatory intelligence. Ambrosia delivers the deal economics layer — benchmarking, valuation, and competitive dynamics that Cortellis does not cover.',
    strengths: ['Pipeline/regulatory data', 'Patent intelligence'],
    ambrosiaEdge: ['Deal valuation engines', 'Competitive dynamics', 'Transparent pricing'],
  },
];

export default function ComparePage() {
  return (
    <main className="min-h-screen bg-[#0a0e1a]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero */}
        <div className="mb-14 text-center">
          <p className="text-xs font-bold text-teal-400 tracking-[0.15em] uppercase mb-3">
            Platform Comparison
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            How Ambrosia Compares
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {DEAL_STATS.TOTAL_DEALS} real biopharma deals. 14 calculation engines. 12 therapeutic
            areas. See how Ambrosia stacks up against the legacy platforms.
          </p>
        </div>

        {/* Comparison Cards */}
        <div className="grid gap-6">
          {COMPARISONS.map(({ slug, name, tagline, description, strengths, ambrosiaEdge }) => (
            <Link
              key={slug}
              href={`/compare/${slug}`}
              className="group p-6 sm:p-8 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-teal-500/20 hover:bg-white/[0.04] transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white group-hover:text-teal-400 transition-colors mb-1">
                    Ambrosia vs {name}
                  </h2>
                  <p className="text-sm text-teal-400/70 mb-3">{tagline}</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
                </div>
                <div className="flex-shrink-0 sm:ml-8">
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-teal-400 group-hover:text-teal-300 transition-colors">
                    View comparison
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-white/[0.04] grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    {name} strengths
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {strengths.map((s) => (
                      <span
                        key={s}
                        className="text-xs px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/10"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-teal-500/80 uppercase tracking-wider mb-2">
                    Ambrosia edge
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ambrosiaEdge.map((s) => (
                      <span
                        key={s}
                        className="text-xs px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/10"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Stats bar */}
        <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { value: DEAL_STATS.TOTAL_DEALS, label: 'Verified Deals' },
            { value: '14', label: 'Calculation Engines' },
            { value: '562', label: 'Indications' },
            { value: PRICING.PRO_MONTHLY, label: 'Starting Price' },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]"
            >
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-14 text-center">
          <p className="text-slate-400 mb-6">
            Ready to see the difference? Try Ambrosia with your own deal parameters.
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
      </div>
    </main>
  );
}
