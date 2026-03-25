import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import {
  getAllProgrammaticSlugs,
  getProgrammaticPageData,
  formatCurrency,
} from '@/lib/seo/programmatic-pages';
import { SiteFooter } from '@/components/seo/SiteFooter';

export async function generateStaticParams() {
  return getAllProgrammaticSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getProgrammaticPageData(slug);
  if (!page) return {};

  const baseUrl = 'https://calculator.ambrosiaventures.co';

  return {
    title: page.title,
    description: page.metaDescription,
    keywords: [
      `${page.ta.label} deal benchmarks`,
      `${page.phase.label} licensing deals`,
      `${page.territory.label} biopharma deals`,
      'upfront payment benchmarks',
      'pharma royalty rates',
      'deal valuation',
    ],
    openGraph: {
      title: page.title,
      description: page.metaDescription,
      url: `${baseUrl}/data/${slug}`,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.metaDescription,
    },
    alternates: {
      canonical: `${baseUrl}/data/${slug}`,
    },
  };
}

export default async function ProgrammaticDataPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getProgrammaticPageData(slug);
  if (!page) notFound();

  const baseUrl = 'https://calculator.ambrosiaventures.co';
  const calcUrl = `/calculator?ta=${page.ta.key}&phase=${page.phase.key}&territory=${page.territory.key}`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Data', item: `${baseUrl}/data` },
      { '@type': 'ListItem', position: 3, name: page.h1 },
    ],
  };

  const datasetSchema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: page.title,
    description: page.metaDescription,
    url: `${baseUrl}/data/${slug}`,
    creator: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: baseUrl,
    },
    keywords: [page.ta.label, page.phase.label, page.territory.label, 'biopharma deals', 'licensing benchmarks'],
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Median Upfront Payment', value: page.upfront.median, unitCode: 'USD' },
      { '@type': 'PropertyValue', name: 'Median Total Deal Value', value: page.totalValue.median, unitCode: 'USD' },
      { '@type': 'PropertyValue', name: 'Base Royalty Rate', value: page.royalty.base, unitCode: 'P1' },
    ],
  };

  const territoryContext = page.territory.key === 'global'
    ? ''
    : ` in ${page.territory.label} territory`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }}
      />

      <main className="min-h-screen bg-slate-950 text-white">
        {/* Header */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-16 px-4">
          <div className="max-w-3xl mx-auto">
            <nav className="flex items-center gap-2 text-sm text-slate-500 mb-8">
              <Link href="/" className="hover:text-teal-400 transition-colors">Home</Link>
              <span>/</span>
              <Link href="/data" className="hover:text-teal-400 transition-colors">Data</Link>
              <span>/</span>
              <span className="text-slate-300">{page.h1}</span>
            </nav>

            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
              {page.h1}
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              Median upfront of <span className="text-teal-400 font-semibold">{formatCurrency(page.upfront.median)}</span> with
              total deal values reaching <span className="text-teal-400 font-semibold">{formatCurrency(page.totalValue.high)}</span>{territoryContext}.
            </p>
          </div>
        </section>

        {/* Stat Cards */}
        <section className="px-4 -mt-8">
          <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Median Upfront</p>
              <p className="text-2xl font-bold text-teal-400">{formatCurrency(page.upfront.median)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Deal Value</p>
              <p className="text-2xl font-bold text-teal-400">{formatCurrency(page.totalValue.median)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Royalty Range</p>
              <p className="text-2xl font-bold text-teal-400">{page.royalty.base}%–{page.royalty.max}%</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Territory Multiplier</p>
              <p className="text-2xl font-bold text-teal-400">{page.territoryMultiplier}x</p>
            </div>
          </div>
        </section>

        {/* Context Section */}
        <section className="px-4 py-16">
          <div className="max-w-3xl mx-auto prose prose-slate prose-lg prose-invert">
            <h2 className="text-xl font-semibold text-white mb-4">
              Understanding {page.ta.label} Deal Benchmarks at {page.phase.label}
            </h2>
            <p className="text-slate-400 leading-relaxed">
              {page.phase.label} {page.ta.label} licensing deals{territoryContext} command a median upfront
              payment of {formatCurrency(page.upfront.median)}, with values ranging
              from {formatCurrency(page.upfront.low)} at the low end
              to {formatCurrency(page.upfront.high)} for premium assets. These benchmarks
              reflect the risk-adjusted value of clinical-stage assets in the {page.ta.label.toLowerCase()} therapeutic
              area, where development costs, competitive dynamics, and market potential all factor into deal pricing.
            </p>
            <p className="text-slate-400 leading-relaxed">
              Total deal values — including milestones for development, regulatory, and commercial
              achievements — range from {formatCurrency(page.totalValue.low)} to {formatCurrency(page.totalValue.high)},
              with a median of {formatCurrency(page.totalValue.median)}. Royalty rates for {page.ta.label.toLowerCase()} assets
              at this stage typically fall between {page.royalty.base}% and {page.royalty.max}% of net sales, reflecting
              the balance between licensor value contribution and licensee commercialization investment.
            </p>
            <p className="text-slate-400 leading-relaxed">
              The {page.territory.label} territory applies a {page.territoryMultiplier}x multiplier to base deal
              economics. This accounts for market size, regulatory complexity, pricing environment, and
              competitive landscape differences across geographies. Licensors negotiating {page.territory.label.toLowerCase()} rights
              should calibrate upfront expectations and milestone structures accordingly.
            </p>
          </div>
        </section>

        {/* Benchmark Table */}
        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-semibold text-white mb-6">
              Full Benchmark Data
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Metric</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Low</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">Median</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">High</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-800/50">
                    <td className="px-4 py-3 text-slate-300">Upfront Payment</td>
                    <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(page.upfront.low)}</td>
                    <td className="px-4 py-3 text-right text-teal-400 font-semibold">{formatCurrency(page.upfront.median)}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(page.upfront.high)}</td>
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="px-4 py-3 text-slate-300">Total Deal Value</td>
                    <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(page.totalValue.low)}</td>
                    <td className="px-4 py-3 text-right text-teal-400 font-semibold">{formatCurrency(page.totalValue.median)}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(page.totalValue.high)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-300">Royalty Rate</td>
                    <td className="px-4 py-3 text-right text-slate-400" colSpan={1}>{page.royalty.base}%</td>
                    <td className="px-4 py-3 text-right text-teal-400 font-semibold">—</td>
                    <td className="px-4 py-3 text-right text-slate-400">{page.royalty.max}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Comparable Deals */}
        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-semibold text-white mb-6">
              Comparable Deals
            </h2>
            {page.comparableDeals.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60">
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Year</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Licensor</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Licensee</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-medium">Upfront</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-medium">Total Value</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Deal Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.comparableDeals.map((deal, i) => (
                      <tr key={i} className="border-b border-slate-800/50 last:border-b-0">
                        <td className="px-4 py-3 text-slate-400">{deal.year}</td>
                        <td className="px-4 py-3 text-slate-300">{deal.licensor}</td>
                        <td className="px-4 py-3 text-slate-300">{deal.licensee}</td>
                        <td className="px-4 py-3 text-right text-teal-400">{formatCurrency(deal.upfront)}</td>
                        <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(deal.totalDealValue)}</td>
                        <td className="px-4 py-3 text-slate-400 capitalize">{deal.dealType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center">
                <p className="text-slate-500">
                  No territory-specific comparable deals.{' '}
                  <Link href={calcUrl} className="text-teal-400 hover:text-teal-300 transition-colors">
                    Use the calculator
                  </Link>{' '}
                  for full analysis.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-semibold text-white mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              <details className="group rounded-xl border border-slate-800 bg-slate-900/40">
                <summary className="cursor-pointer px-6 py-4 text-slate-300 font-medium hover:text-white transition-colors list-none flex items-center justify-between">
                  What is the average upfront payment for {page.phase.label} {page.ta.label} deals{territoryContext}?
                  <svg className="w-5 h-5 text-slate-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-4 text-slate-400 leading-relaxed">
                  The median upfront payment for {page.phase.label} {page.ta.label} licensing
                  deals{territoryContext} is {formatCurrency(page.upfront.median)}, based on our analysis of
                  comparable transactions. Values range from {formatCurrency(page.upfront.low)} for
                  early-stage or less differentiated assets up to {formatCurrency(page.upfront.high)} for
                  premium programs with strong clinical data or first-in-class mechanisms.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-800 bg-slate-900/40">
                <summary className="cursor-pointer px-6 py-4 text-slate-300 font-medium hover:text-white transition-colors list-none flex items-center justify-between">
                  How does {page.territory.label} territory affect {page.ta.label} deal value?
                  <svg className="w-5 h-5 text-slate-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-4 text-slate-400 leading-relaxed">
                  {page.territory.label} rights carry a {page.territoryMultiplier}x multiplier relative to
                  base deal economics. This means {page.territory.label.toLowerCase()} {page.ta.label.toLowerCase()} deals
                  are valued at {page.territoryMultiplier > 1 ? 'a premium' : 'a discount'} compared
                  to single-country rights, reflecting the combined market opportunity, regulatory
                  pathway, and competitive dynamics of the territory.
                </div>
              </details>

              <details className="group rounded-xl border border-slate-800 bg-slate-900/40">
                <summary className="cursor-pointer px-6 py-4 text-slate-300 font-medium hover:text-white transition-colors list-none flex items-center justify-between">
                  What royalty rates are typical for {page.phase.label} {page.ta.label} licensing?
                  <svg className="w-5 h-5 text-slate-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-4 text-slate-400 leading-relaxed">
                  Royalty rates for {page.phase.label} {page.ta.label.toLowerCase()} assets typically range
                  from {page.royalty.base}% to {page.royalty.max}% of net sales. The exact rate depends on
                  the licensor&apos;s contribution (IP, clinical data, manufacturing), deal structure
                  (exclusive vs. co-exclusive), and the licensee&apos;s commercialization investment. Higher
                  royalties often correspond to lower upfront payments, and vice versa.
                </div>
              </details>
            </div>
          </div>
        </section>

        {/* Related Pages */}
        {page.relatedSlugs.length > 0 && (
          <section className="px-4 pb-16">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-semibold text-white mb-6">
                Related Benchmarks
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {page.relatedSlugs.map((relatedSlug) => {
                  const related = getProgrammaticPageData(relatedSlug);
                  if (!related) return null;
                  return (
                    <Link
                      key={relatedSlug}
                      href={`/data/${relatedSlug}`}
                      className="group block rounded-xl border border-slate-800 p-5 hover:border-slate-600 transition-colors"
                    >
                      <p className="text-sm text-teal-400 font-semibold mb-1">
                        {formatCurrency(related.upfront.median)} upfront
                      </p>
                      <p className="text-sm text-slate-400 leading-snug group-hover:text-slate-300 transition-colors">
                        {related.ta.label} &middot; {related.phase.label} &middot; {related.territory.label}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              Run Your Own Benchmark
            </h2>
            <p className="text-slate-400 mb-8 max-w-xl mx-auto">
              These benchmarks are starting points. Get a customized valuation for your specific
              asset, indication, and deal structure.
            </p>
            <Link
              href={calcUrl}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold hover:from-teal-700 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20"
            >
              Open Deal Calculator
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
