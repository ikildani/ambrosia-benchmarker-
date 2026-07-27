import { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { BarChart3, ArrowRight } from 'lucide-react';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Life Sciences Deal Reports | Market Intelligence | Ambrosia Ventures',
  description: 'Data-driven reports on biopharma licensing trends, deal volume, modality shifts, and market outlook. Annual and quarterly market intelligence for BD professionals.',
  keywords: ['biopharma deal reports', 'life sciences deal trends', 'pharma licensing market report', 'biotech deal data'],
  openGraph: {
    title: 'Life Sciences Deal Reports | Market Intelligence',
    description: 'Data-driven reports on biopharma licensing trends, deal volume, and market outlook.',
    type: 'website',
    url: 'https://solidus.ambrosiaventures.co/reports',
    images: [{ url: '/api/og?title=Deal%20Reports&subtitle=Market%20Intelligence&type=landing' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Life Sciences Deal Reports | Market Intelligence',
    description: 'Data-driven reports on biopharma licensing trends and market outlook.',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/reports',
  },
};

const reports = [
  {
    slug: 'q2-2026-biopharma-deal-benchmarks',
    title: 'Q2 2026 Biopharma Deal Benchmarks',
    description: `Institutional-grade quarterly analysis with risk-adjusted phase economics, royalty rate benchmarks, modality cycle tracking, and 4 market themes reshaping dealmaking. From ${DEAL_STATS.TOTAL_DEALS} verified transactions.`,
    date: 'July 2026',
    tags: ['Quarterly Report', 'Phase Economics', 'Royalty Rates', 'Modality Cycles'],
  },
  {
    slug: 'q1-2026-biopharma-deal-benchmarks',
    title: 'Q1 2026 Biopharma Deal Benchmarks',
    description: `Quarterly analysis of deal economics across 13 therapeutic areas. Phase-by-phase benchmarks, deal structure evolution, and 3 market themes. From ${DEAL_STATS.TOTAL_DEALS} verified transactions.`,
    date: 'March 2026',
    tags: ['Quarterly Report', 'Deal Benchmarks', 'Market Themes'],
  },
  {
    slug: 'deal-trends-2026',
    title: 'Life Sciences Deal Trends 2026',
    description: `Annual market report covering deal volume by therapeutic area, hottest modalities, phase trends, geographic shifts, and 2027 outlook. Data from ${DEAL_STATS.TOTAL_DEALS} biopharma transactions.`,
    date: 'March 2026',
    tags: ['Annual Report', 'Deal Trends', 'Market Data'],
  },
];

export default function ReportsPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://solidus.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Reports' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <main className="min-h-screen bg-white">
        <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-16 px-4">
          <div className="max-w-4xl mx-auto">
            <Breadcrumbs items={[{ label: 'Reports' }]} />

            <div className="mt-8 flex items-start gap-4">
              <div className="p-3 bg-teal-500/20 rounded-xl">
                <BarChart3 className="w-8 h-8 text-teal-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">
                  Deal Reports
                </h1>
                <p className="mt-2 text-xl text-slate-300">
                  Data-driven market intelligence for biopharma deal professionals
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid gap-6">
            {reports.map((report) => (
              <Link
                key={report.slug}
                href={`/reports/${report.slug}`}
                className="group block bg-white rounded-2xl border border-slate-200 p-8 hover:border-teal-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm text-slate-500">{report.date}</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 group-hover:text-teal-700 transition-colors mb-3">
                      {report.title}
                    </h2>
                    <p className="text-slate-600 leading-relaxed mb-4">
                      {report.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {report.tags.map((tag) => (
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
              Want Custom Analysis?
            </h2>
            <p className="text-slate-600 mb-8">
              Pro subscribers get access to detailed quarterly reports with custom filtering by therapeutic area, modality, and deal type.
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
    </>
  );
}
