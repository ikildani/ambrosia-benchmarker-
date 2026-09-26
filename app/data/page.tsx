import { Metadata } from 'next';
import Link from 'next/link';
import { getAllProgrammaticPages, formatCurrency } from '@/lib/seo/programmatic-pages';
import { DEAL_STATS } from '@/lib/config/constants';
import SiteHeaderAuto from '@/components/SiteHeaderAuto';

export const metadata: Metadata = {
  title: 'Biopharma Deal Data by Therapeutic Area, Phase & Territory',
  description:
    'Browse 300+ data pages covering biopharma deal benchmarks across every therapeutic area, clinical phase, and territory combination. Upfront payments, total deal values, royalty rates, and comparable transactions.',
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/data',
  },
  openGraph: {
    title: 'Biopharma Deal Data by Therapeutic Area, Phase & Territory',
    description: '300+ data pages of biopharma deal benchmarks: upfronts, total deal values, royalty rates, and comparable transactions.',
    url: 'https://solidus.ambrosiaventures.co/data',
    type: 'website',
    images: [{ url: '/api/og?title=Biopharma%20Deal%20Data&subtitle=By%20Therapeutic%20Area%2C%20Phase%20%26%20Territory&type=landing', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biopharma Deal Data by Therapeutic Area, Phase & Territory',
    description: '300+ data pages of biopharma deal benchmarks: upfronts, total deal values, royalty rates, and comparable transactions.',
  },
};

export default function DataIndexPage() {
  const allPages = getAllProgrammaticPages();

  // Group pages by TA key
  const grouped: Record<string, typeof allPages> = {};
  for (const page of allPages) {
    if (!grouped[page.ta.key]) {
      grouped[page.ta.key] = [];
    }
    grouped[page.ta.key].push(page);
  }

  const taEntries = Object.entries(grouped);

  return (
    <>
      <SiteHeaderAuto />
      <main id="main-content" className="min-h-screen bg-slate-950 text-white">
        {/* Header */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-28 sm:pt-32 pb-12 sm:pb-16 px-4">
          <div className="max-w-3xl mx-auto">
            <nav className="flex items-center gap-2 text-sm text-slate-500 mb-8">
              <Link href="/" className="hover:text-teal-400 transition-colors">Home</Link>
              <span>/</span>
              <span className="text-slate-300">Data</span>
            </nav>

            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Deal Benchmark Data
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              300+ data pages covering every therapeutic area, clinical phase, and territory
              combination. Upfront payments, total deal values, royalty rates, and comparable
              transactions — all in one place.
            </p>
          </div>
        </section>

        {/* TA Sections */}
        <section className="px-4 py-10 sm:py-16">
          <div className="max-w-5xl mx-auto space-y-3 sm:space-y-6">
            {/* One row per therapeutic area; the phase × territory grid opens on demand.
                The flat list was 300 cards and 40,000 px tall on a phone. */}
            {taEntries.map(([taKey, pages], idx) => {
              const taLabel = pages[0].ta.label;
              const medians = pages.map((p) => p.upfront.median).filter((n) => Number.isFinite(n));
              const lo = medians.length ? Math.min(...medians) : 0;
              const hi = medians.length ? Math.max(...medians) : 0;
              return (
                <details key={taKey} open={idx === 0} className="group rounded-2xl border border-slate-800 bg-slate-900/30 open:bg-slate-900/50">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 sm:px-6 py-4 min-h-14 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold text-white">{taLabel}</h2>
                      <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                        {pages.length} benchmark pages · median upfront {formatCurrency(lo)}{hi !== lo ? ` – ${formatCurrency(hi)}` : ''}
                      </p>
                    </div>
                    <svg className="w-5 h-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-6 pb-5">
                    {pages.map((page) => (
                      <Link
                        key={page.slug}
                        href={`/data/${page.slug}`}
                        className="block min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5 hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-baseline justify-between mb-2">
                          <span className="text-sm font-medium text-slate-200">
                            {page.phase.label}
                          </span>
                          <span className="text-sm font-semibold text-teal-400">
                            {formatCurrency(page.upfront.median)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {page.territory.label} territory
                        </p>
                      </Link>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-slate-800 py-12 text-center">
          <div className="mx-auto max-w-2xl px-6">
            <p className="text-slate-400 text-sm mb-4">
              Benchmarks powered by {DEAL_STATS.TOTAL_DEALS} primary-sourced biopharma licensing deals
            </p>
            <Link
              href="/calculator"
              className="text-teal-400 hover:text-teal-300 font-medium text-sm transition-colors"
            >
              Try Solidus &rarr;
            </Link>
          </div>
        </section>
      </main>

    </>
  );
}
