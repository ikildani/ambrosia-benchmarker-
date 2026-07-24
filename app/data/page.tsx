import { Metadata } from 'next';
import Link from 'next/link';
import { getAllProgrammaticPages, formatCurrency } from '@/lib/seo/programmatic-pages';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Biopharma Deal Data by Therapeutic Area, Phase & Territory | Ambrosia Ventures',
  description:
    'Browse 300+ data pages covering biopharma deal benchmarks across every therapeutic area, clinical phase, and territory combination. Upfront payments, total deal values, royalty rates, and comparable transactions.',
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/data',
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
      <main className="min-h-screen bg-slate-950 text-white">
        {/* Header */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-16 px-4">
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
        <section className="px-4 py-16">
          <div className="max-w-5xl mx-auto space-y-16">
            {taEntries.map(([taKey, pages]) => {
              const taLabel = pages[0].ta.label;
              return (
                <div key={taKey}>
                  <h2 className="text-2xl font-bold text-white mb-6 border-b border-slate-800 pb-3">
                    {taLabel}
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pages.map((page) => (
                      <Link
                        key={page.slug}
                        href={`/data/${page.slug}`}
                        className="group block rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-baseline justify-between mb-2">
                          <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                            {page.phase.label}
                          </span>
                          <span className="text-sm font-semibold text-teal-400">
                            {formatCurrency(page.upfront.median)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {page.territory.label} territory
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-slate-800 py-12 text-center">
          <div className="mx-auto max-w-2xl px-6">
            <p className="text-slate-500 text-sm mb-4">
              Benchmarks powered by {DEAL_STATS.TOTAL_DEALS} real biopharma licensing deals
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

      <SiteFooter />
    </>
  );
}
