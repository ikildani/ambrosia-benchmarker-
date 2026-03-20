import { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { BookOpen, ArrowRight } from 'lucide-react';
import { SiteFooter } from '@/components/seo/SiteFooter';

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
];

export default function GuidesPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Guides' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <main className="min-h-screen bg-white">
        <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-16 px-4">
          <div className="max-w-4xl mx-auto">
            <Breadcrumbs items={[{ label: 'Guides' }]} />

            <div className="mt-8 flex items-start gap-4">
              <div className="p-3 bg-teal-500/20 rounded-xl">
                <BookOpen className="w-8 h-8 text-teal-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">
                  Biotech Deal Guides
                </h1>
                <p className="mt-2 text-xl text-slate-300">
                  In-depth resources for licensing professionals and BD teams
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid gap-6">
            {guides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guides/${guide.slug}`}
                className="group block bg-white rounded-2xl border border-slate-200 p-8 hover:border-teal-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm text-slate-500">{guide.readTime}</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 group-hover:text-teal-700 transition-colors mb-3">
                      {guide.title}
                    </h2>
                    <p className="text-slate-600 leading-relaxed mb-4">
                      {guide.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {guide.tags.map((tag) => (
                        <span key={tag} className="px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="w-6 h-6 text-slate-400 group-hover:text-teal-600 transition-colors flex-shrink-0 mt-2" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="py-16 px-4 bg-slate-50">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Ready to Benchmark Your Deal?
            </h2>
            <p className="text-slate-600 mb-8">
              Use our calculator to model deal terms based on real market data.
            </p>
            <Link
              href="/calculator"
              className="inline-flex items-center justify-center px-8 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors"
            >
              Try the Calculator
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
