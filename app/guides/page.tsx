import { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, ArrowRight, Clock, ChevronRight } from 'lucide-react';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Biotech Deal Guides | Licensing & Valuation Resources | Ambrosia Ventures',
  description: 'In-depth guides on biopharma licensing deal valuation, comparable transactions analysis, rNPV modeling, and Monte Carlo simulation. Written for BD and licensing professionals.',
  keywords: ['biotech deal guide', 'biopharma valuation', 'licensing deal tutorial', 'rNPV analysis', 'deal benchmarking'],
  openGraph: {
    title: 'Biotech Deal Guides — Licensing & Valuation Resources',
    description: 'In-depth guides on biopharma licensing deal valuation, comparable transactions analysis, and deal benchmarking.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/guides',
    images: [{ url: '/api/og?title=Biotech%20Deal%20Guides&subtitle=Licensing%20%26%20Valuation%20Resources&type=landing' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biotech Deal Guides — Licensing & Valuation Resources',
    description: 'In-depth guides on biopharma licensing deal valuation and benchmarking.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/guides',
  },
};

const guides = [
  {
    slug: 'how-to-value-biotech-deal',
    title: 'How to Value a Biotech Deal',
    description: 'A complete step-by-step guide to valuing biopharma licensing deals using comparable transactions, rNPV analysis, and Monte Carlo simulation.',
    readTime: '12 min read',
    tags: ['Valuation', 'rNPV', 'Monte Carlo', 'Comparables'],
  },
  {
    slug: 'negotiate-pharma-royalty-rates',
    title: 'How to Negotiate Pharma Licensing Royalty Rates',
    description: 'Data-backed strategies for structuring and negotiating royalty rates in biopharma licensing deals, with benchmarks from 3,000+ transactions.',
    readTime: '14 min read',
    tags: ['Royalties', 'Negotiation', 'Benchmarks', 'Territory'],
  },
  {
    slug: 'biotech-licensing-deal-structure',
    title: 'Biotech Licensing Deal Structure: Upfront, Milestones & Royalties',
    description: 'Comprehensive breakdown of the three pillars of biopharma licensing economics, with benchmark data and structuring strategies for each component.',
    readTime: '15 min read',
    tags: ['Deal Structure', 'Upfront', 'Milestones', 'Royalties'],
  },
  {
    slug: 'rnpv-biotech-valuation',
    title: 'Risk-Adjusted NPV (rNPV) for Biotech Valuation',
    description: 'Master the industry-standard rNPV methodology for valuing biotech assets, from phase transition probabilities to Monte Carlo enhancement.',
    readTime: '16 min read',
    tags: ['rNPV', 'Valuation', 'Monte Carlo', 'PoS'],
  },
  {
    slug: 'pharma-ma-vs-licensing',
    title: 'Pharma M&A vs. Licensing: When to Acquire vs. License',
    description: 'Strategic framework for choosing between M&A and licensing in biopharma, with case studies and decision criteria for BD professionals.',
    readTime: '13 min read',
    tags: ['M&A', 'Licensing', 'Strategy', 'Case Studies'],
  },
  {
    slug: 'biopharma-licensing-benchmarks',
    title: 'Biopharma Licensing Benchmarks 2026: Data From 2,500+ Deals',
    description: 'Comprehensive benchmarks for upfront payments, milestones, and royalties by phase, modality, and therapeutic area — based on 2,500+ disclosed transactions.',
    readTime: '14 min read',
    tags: ['Benchmarks', 'Deal Terms', 'Data', '2026'],
  },
  {
    slug: 'life-sciences-deal-calculator-guide',
    title: 'Life Sciences Deal Calculator: Benchmark Upfronts, Milestones & Royalties',
    description: 'How to use the Ambrosia deal calculator to model rNPV, Monte Carlo, partner matching, and buyer-specific valuations across 12 TAs and 23+ modalities.',
    readTime: '10 min read',
    tags: ['Calculator', 'Tutorial', 'rNPV', 'Monte Carlo'],
  },
];

// ---------------------------------------------------------------------------
// Tag color map
// ---------------------------------------------------------------------------
function tagClasses(tag: string): string {
  const t = tag.toLowerCase();
  if (t === 'valuation' || t === 'rnpv' || t === 'pos')
    return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
  if (t === 'benchmarks' || t === 'data' || t === 'deal terms' || t === 'comparables' || t === '2026' || t === 'deal structure' || t === 'upfront' || t === 'milestones' || t === 'royalties' || t === 'territory')
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  if (t === 'negotiation')
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  if (t === 'strategy' || t === 'm&a' || t === 'case studies' || t === 'licensing')
    return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  if (t === 'monte carlo' || t === 'calculator')
    return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
  if (t === 'tutorial')
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GuidesPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Guides' },
    ],
  };

  const [featured, ...rest] = guides;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <main className="min-h-screen bg-[#0a0f1a]">

        {/* ═══════════════════════════════════════════════════════════════════
            HERO
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="relative pt-28 pb-20 px-4 overflow-hidden">
          {/* Radial glows */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(13,148,136,0.15),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_50%,rgba(99,102,241,0.08),transparent)]" />

          <div className="relative max-w-6xl mx-auto">
            {/* Inline breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-10">
              <Link href="/" className="hover:text-slate-300 transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-300">Guides</span>
            </nav>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 mb-6">
              <BookOpen className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">Resources</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
              Deal Intelligence{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
                Guides
              </span>
            </h1>

            <p className="mt-6 text-lg text-slate-400 leading-relaxed max-w-2xl">
              In-depth resources backed by data from {DEAL_STATS.TOTAL_DEALS}+ biopharma transactions.
              Written for BD professionals, licensing teams, and deal committees.
            </p>

            {/* Stat row */}
            <div className="mt-10 flex flex-wrap items-center gap-8">
              {[
                { value: `${guides.length}`, label: 'Guides' },
                { value: '12', label: 'Therapeutic Areas' },
                { value: '14', label: 'Engines Explained' },
              ].map((stat) => (
                <div key={stat.label} className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-mono">{stat.value}</span>
                  <span className="text-sm text-slate-500">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            FEATURED GUIDE
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="px-4 pb-8">
          <div className="max-w-6xl mx-auto">
            <Link
              href={`/guides/${featured.slug}`}
              className="group block bg-gradient-to-r from-teal-900/20 to-cyan-900/20 rounded-2xl border border-teal-500/20 p-8 sm:p-10 hover:border-teal-500/40 transition-all duration-300"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 mb-4">
                    <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">Featured</span>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-sm text-slate-500">{featured.readTime}</span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold text-white group-hover:text-teal-300 transition-colors mb-4">
                    {featured.title}
                  </h2>
                  <p className="text-slate-400 leading-relaxed mb-6 max-w-2xl">
                    {featured.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {featured.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${tagClasses(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white font-semibold rounded-xl group-hover:bg-teal-400 transition-all text-sm shadow-lg shadow-teal-500/25 group-hover:-translate-y-0.5">
                    Start reading <ArrowRight className="w-4 h-4" />
                  </span>
                </div>

                <div className="hidden sm:flex items-center justify-center w-20 h-20 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex-shrink-0">
                  <BookOpen className="w-8 h-8 text-teal-400" />
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            GUIDE CARDS GRID
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="px-4 py-12">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-5">
              {rest.map((guide) => (
                <Link
                  key={guide.slug}
                  href={`/guides/${guide.slug}`}
                  className="group block bg-[#0d1420] rounded-2xl border border-white/[0.06] p-7 hover:border-teal-500/20 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                        <span className="text-xs text-slate-500 font-medium">{guide.readTime}</span>
                      </div>

                      <h3 className="text-lg font-bold text-white group-hover:text-teal-300 transition-colors mb-3 leading-snug">
                        {guide.title}
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-4 line-clamp-2">
                        {guide.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        {guide.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${tagClasses(tag)}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <ArrowRight className="w-5 h-5 text-slate-700 group-hover:text-teal-400 transition-all flex-shrink-0 mt-1 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            CTA
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="relative px-4 py-20 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(13,148,136,0.10),transparent)]" />

          <div className="relative max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to benchmark?
            </h2>
            <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
              Model deal terms against {DEAL_STATS.TOTAL_DEALS}+ transactions across 12 therapeutic areas with 14 calculation engines.
            </p>
            <Link
              href="/calculator"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-teal-500 text-white font-semibold rounded-xl hover:bg-teal-400 transition-all text-base shadow-lg shadow-teal-500/25 hover:-translate-y-0.5"
            >
              Try the Calculator <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
