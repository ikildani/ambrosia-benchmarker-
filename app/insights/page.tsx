import { Metadata } from 'next';
import Link from 'next/link';
import { getAllInsightSlugs } from '@/lib/insightPages';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Biopharma Deal Insights | Ambrosia Ventures',
  description: `Data-driven insights on biopharma deal structure, licensing benchmarks, upfront payments, milestones, and royalty rates across ${DEAL_STATS.TOTAL_DEALS} transactions.`,
  alternates: { canonical: 'https://solidus.ambrosiaventures.co/insights' },
  openGraph: {
    title: 'Biopharma Deal Insights | Ambrosia Ventures',
    description: 'Data-driven insights on biopharma deal structure, licensing benchmarks, and valuation trends.',
    url: 'https://solidus.ambrosiaventures.co/insights',
    type: 'website',
  },
};

const INSIGHT_PAGES = [
  { slug: 'biopharma-deal-benchmarks-2026', title: 'Biopharma Deal Benchmarks 2026', desc: 'Comprehensive benchmarks across 13 therapeutic areas with phase-by-phase economics.' },
  { slug: 'adc-vs-bispecific-deal-benchmarks-2026', title: 'ADC vs Bispecific Deal Benchmarks', desc: 'Head-to-head comparison of ADC and bispecific antibody deal structures and valuations.' },
  { slug: 'oncology-upfront-payment-benchmarks', title: 'Oncology Upfront Payment Benchmarks', desc: 'Upfront payment trends in oncology licensing deals by phase and modality.' },
  { slug: 'pharma-licensing-royalty-rates', title: 'Pharma Licensing Royalty Rates', desc: 'Royalty rate benchmarks across therapeutic areas, phases, and deal types.' },
  { slug: 'deal-terms-by-therapeutic-area', title: 'Deal Terms by Therapeutic Area', desc: 'How deal economics vary across oncology, neurology, immunology, and 9 other TAs.' },
  { slug: 'phase-2-milestone-payment-benchmarks', title: 'Phase 2 Milestone Payment Benchmarks', desc: 'Development, regulatory, and commercial milestone structures at Phase 2.' },
  { slug: 'preclinical-asset-valuation-licensing', title: 'Preclinical Asset Valuation', desc: 'How to value and structure licensing deals for preclinical-stage assets.' },
  { slug: 'biotech-licensing-europe', title: 'European Biotech Licensing Deals', desc: 'Deal structure and valuation trends for European biotech out-licensing.' },
  { slug: 'out-licensing-asia-pacific', title: 'Asia-Pacific Out-Licensing', desc: 'China-to-West licensing surge and APAC deal economics.' },
  { slug: 'israel-biotech-deal-benchmarks', title: 'Israel Biotech Deal Benchmarks', desc: 'Israeli biotech licensing deal data and partnership trends.' },
  { slug: 'biopharma-deal-valuation-methods', title: 'Biopharma Deal Valuation Methods', desc: 'rNPV, Monte Carlo, real options, and comparable deal approaches compared.' },
  { slug: 'biotech-out-licensing-deal-terms-2025-2026', title: 'Biotech Out-Licensing Deal Terms', desc: '2025-2026 deal structure trends for biotech out-licensing transactions.' },
  { slug: 'q1-2026-deal-benchmarks', title: 'Q1 2026 Deal Benchmarks', desc: 'Quarterly update on deal activity, upfront trends, and market shifts.' },
  { slug: 'biopharma-deal-benchmarking-tools-2026', title: 'Biopharma Deal Benchmarking Tools', desc: 'Comparison of deal benchmarking platforms and methodologies.' },
  { slug: 'how-much-is-my-biotech-asset-worth', title: 'How Much Is My Biotech Asset Worth?', desc: 'A practical guide to valuing biotech assets for licensing and acquisition.' },
  { slug: 'licensing-vs-acquisition-deal-terms', title: 'Licensing vs Acquisition Deal Terms', desc: 'When to license and when to sell — deal economics compared.' },
  { slug: 'phase-2-vs-phase-3-deal-economics', title: 'Phase 2 vs Phase 3 Deal Economics', desc: 'The Phase 2 inflection point and how deal terms shift at Phase 3.' },
  { slug: 'deal-committee-presentation-guide', title: 'Deal Committee Presentation Guide', desc: 'How to build a board-ready deal analysis for investment committees.' },
  { slug: 'pharma-partner-identification-guide', title: 'Pharma Partner Identification Guide', desc: 'Data-driven approach to finding the right licensing partner.' },
  { slug: 'rnpv-vs-dcf-biotech-valuation', title: 'rNPV vs DCF Biotech Valuation', desc: 'When to use risk-adjusted NPV vs discounted cash flow in biotech deals.' },
  { slug: 'biotech-fundraising-deal-benchmarks', title: 'Biotech Fundraising Deal Benchmarks', desc: 'Fundraising and partnership deal economics for biotech companies.' },
];

export default function InsightsIndexPage() {
  return (
    <main className="min-h-screen bg-[#0a0e1a]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-12">
          <p className="text-xs font-bold text-teal-400 tracking-[0.15em] uppercase mb-3">Deal Intelligence</p>
          <h1 className="text-4xl font-bold text-white mb-4">Biopharma Deal Insights</h1>
          <p className="text-lg text-slate-400 max-w-2xl">
            Data-driven analysis of biopharma deal structure, licensing benchmarks, and valuation trends — backed by {DEAL_STATS.TOTAL_DEALS} real transactions.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {INSIGHT_PAGES.map(({ slug, title, desc }) => (
            <Link
              key={slug}
              href={`/insights/${slug}`}
              className="group p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-teal-500/20 hover:bg-white/[0.04] transition-all"
            >
              <h2 className="text-base font-semibold text-white group-hover:text-teal-400 transition-colors mb-2">
                {title}
              </h2>
              <p className="text-sm text-slate-400 line-clamp-2">{desc}</p>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/calculator?utm_source=seo&utm_medium=insights_index&utm_content=bottom_cta"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all text-sm"
          >
            Run Your Own Benchmark
          </Link>
        </div>
      </div>
    </main>
  );
}
