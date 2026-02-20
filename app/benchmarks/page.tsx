import { Metadata } from 'next';
import Link from 'next/link';
import { getAllBenchmarkPages } from '@/lib/benchmarkPages';

export const metadata: Metadata = {
  title: 'Biopharma Deal Benchmarks 2026 | Ambrosia Ventures',
  description:
    'Comprehensive licensing deal benchmarks across oncology, neurology, ADCs, CAR-T, bispecifics, and more. Data-driven deal term analysis for biopharma professionals.',
  keywords: [
    'biopharma deal benchmarks',
    'licensing deal terms',
    'oncology deal benchmarks',
    'neurology deal benchmarks',
    'ADC deal terms',
    'CAR-T licensing',
    'bispecific antibody deals',
    'pharma milestones',
    'royalty rates',
  ],
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/benchmarks',
  },
  openGraph: {
    title: 'Biopharma Deal Benchmarks 2026',
    description:
      'Comprehensive licensing deal benchmarks across oncology, neurology, immunology, and all major modalities.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/benchmarks',
    images: [
      {
        url: '/api/og?title=Biopharma%20Deal%20Benchmarks%202026&subtitle=Oncology%20%E2%80%A2%20Neurology%20%E2%80%A2%20Immunology',
        width: 1200,
        height: 630,
        alt: 'Biopharma Deal Benchmarks 2026',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biopharma Deal Benchmarks 2026',
    description: 'Comprehensive licensing deal benchmarks across oncology, neurology, immunology, and all major modalities.',
  },
};

const CATEGORY_META: Record<
  string,
  { label: string; description: string; icon: string }
> = {
  modality: {
    label: 'By Modality',
    description: 'Deal benchmarks segmented by drug modality — ADCs, CAR-T, bispecifics, gene therapy, and more.',
    icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  },
  indication: {
    label: 'By Indication',
    description: 'Deal benchmarks for specific disease indications — NSCLC, breast cancer, myeloma, and Alzheimer\'s.',
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  },
  phase: {
    label: 'By Clinical Stage',
    description: 'Deal benchmarks across development stages — preclinical, Phase 2, and Phase 3 licensing terms.',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  },
  overview: {
    label: 'Market Overviews',
    description: 'Comprehensive 2026 deal landscape analysis across oncology, neurology, immunology, and metabolic/obesity therapeutic areas.',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

const CATEGORY_ORDER: string[] = ['overview', 'modality', 'indication', 'phase'];

export default function BenchmarksIndex() {
  const pages = getAllBenchmarkPages();

  // Group pages by category
  const grouped: Record<string, typeof pages> = {};
  for (const page of pages) {
    if (!grouped[page.category]) {
      grouped[page.category] = [];
    }
    grouped[page.category].push(page);
  }

  // Breadcrumb JSON-LD
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://calculator.ambrosiaventures.co',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Benchmarks',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-16 px-4 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,199,199,0.12),rgba(255,255,255,0))]" />
            <div className="absolute top-20 right-[10%] w-72 h-72 bg-teal-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-[5%] w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-5xl mx-auto">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-slate-400 mb-8">
              <Link href="/" className="hover:text-teal-400 transition-colors">
                Home
              </Link>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-slate-300 font-medium">Benchmarks</span>
            </nav>

            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/10 border border-teal-500/20 rounded-full text-teal-300 text-sm mb-6">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                2026 Market Data
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Biopharma Deal{' '}
                <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  Benchmarks
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-8">
                Data-driven licensing deal term analysis across oncology, neurology, and all major modalities.
                Upfronts, milestones, royalties, and deal structures.
              </p>
              <Link
                href="/calculator"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
              >
                Try the Calculator
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </header>

        {/* Category sections */}
        <div className="max-w-5xl mx-auto px-4 py-16 space-y-16">
          {CATEGORY_ORDER.map((categoryKey) => {
            const categoryPages = grouped[categoryKey];
            if (!categoryPages || categoryPages.length === 0) return null;
            const meta = CATEGORY_META[categoryKey];

            return (
              <section key={categoryKey}>
                <div className="flex items-start gap-4 mb-8">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-soft">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={meta.icon} />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{meta.label}</h2>
                    <p className="text-slate-600 mt-1">{meta.description}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryPages.map((page) => (
                    <Link
                      key={page.slug}
                      href={`/benchmarks/${page.slug}`}
                      className="group bg-white rounded-xl border border-slate-200 p-6 hover:border-teal-300 hover:shadow-soft-lg transition-all duration-300 hover:-translate-y-1"
                    >
                      <h3 className="text-lg font-semibold text-slate-900 group-hover:text-teal-700 transition-colors mb-2">
                        {page.h1}
                      </h3>
                      <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                        {page.metaDescription}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {page.heroStats.slice(0, 2).map((stat, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 px-2 py-1 rounded-full"
                          >
                            {stat.label}: {stat.value}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        View benchmarks
                        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Model Your Own Deal Terms
            </h2>
            <p className="text-slate-300 mb-8">
              Use our calculator to customize inputs for your specific asset &mdash; phase, modality, indication,
              competitive position, and more &mdash; and get instant deal term estimates.
            </p>
            <Link
              href="/calculator"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
            >
              Start Calculating
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 bg-slate-900 border-t border-slate-800">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-400 text-sm">
              &copy; {new Date().getFullYear()} Ambrosia Ventures
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <Link href="/calculator" className="hover:text-white transition-colors">Calculator</Link>
              <Link href="/glossary" className="hover:text-white transition-colors">Glossary</Link>
              <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
