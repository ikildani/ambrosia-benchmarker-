import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllPseoSlugs, getPseoBySlug, getRelatedPseoPages, formatDollar } from '@/lib/pseoPages';
import { createServiceClient } from '@/lib/supabase/server';
import ReportCTA from '@/components/ReportCTA';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPseoSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getPseoBySlug(slug);
  if (!page) return {};

  const title = `${formatDollar(page.medianUpfrontM)} Median Upfront: ${page.modalityLabel} ${page.phaseLabel} Licensing Benchmarks (${page.totalDeals} Deals)`;
  const description = `${page.modalityLabel} licensing deals at ${page.phaseLabel} stage command ${formatDollar(page.medianUpfrontM)} median upfront payments across ${page.dealsWithUpfront} deals with disclosed terms. Benchmarks include milestones, royalties, and total deal values.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/benchmarks/data/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://calculator.ambrosiaventures.co/benchmarks/data/${slug}`,
      images: [{
        url: `/api/og?title=${encodeURIComponent(`${page.modalityLabel} ${page.phaseLabel}`)}&subtitle=${encodeURIComponent(`${formatDollar(page.medianUpfrontM)} median upfront · ${page.totalDeals} deals`)}&type=landing`,
        width: 1200,
        height: 630,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

async function getRepresentativeDeals(dbModalityPattern: string, dbPhase: string) {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('deals')
      .select('licensor_name, licensee_name, upfront_usd, total_deal_value_usd, announced_date, deal_type')
      .ilike('modality', dbModalityPattern)
      .eq('phase_at_signing', dbPhase)
      .gt('upfront_usd', 0)
      .order('upfront_usd', { ascending: false })
      .limit(5);
    return data || [];
  } catch {
    return [];
  }
}

export default async function PseoPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getPseoBySlug(slug);
  if (!page) notFound();

  const deals = await getRepresentativeDeals(page.dbModalityPattern, page.dbPhase);
  const related = getRelatedPseoPages(page);
  const calcUrl = `/calculator?modality=${encodeURIComponent(page.modality)}&phase=${encodeURIComponent(page.phase)}&utm_source=seo&utm_medium=pseo_page&utm_content=${slug}`;
  const yearRange = `${page.earliestDeal.slice(0, 4)}--${page.latestDeal.slice(0, 4)}`;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What is the median upfront payment for a ${page.phaseLabel} ${page.modalityLabel} licensing deal?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The median upfront payment for ${page.phaseLabel} ${page.modalityLabel} licensing deals is ${formatDollar(page.medianUpfrontM)}, based on ${page.dealsWithUpfront} deals with disclosed terms from ${yearRange}.`,
        },
      },
      ...(page.avgRoyaltyLow !== null ? [{
        '@type': 'Question',
        name: `What royalty rates are typical for ${page.phaseLabel} ${page.modalityLabel} deals?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Royalty rates for ${page.phaseLabel} ${page.modalityLabel} deals typically range from ${page.avgRoyaltyLow}% to ${page.avgRoyaltyHigh}%, based on deals in the Ambrosia Ventures database.`,
        },
      }] : []),
      ...(page.medianTdvM ? [{
        '@type': 'Question',
        name: `What is the typical total deal value for ${page.phaseLabel} ${page.modalityLabel} licensing agreements?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The median total deal value (upfront + milestones) for ${page.phaseLabel} ${page.modalityLabel} deals is ${formatDollar(page.medianTdvM)}, across ${page.totalDeals} transactions.`,
        },
      }] : []),
    ],
  };

  const datasetSchema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${page.modalityLabel} ${page.phaseLabel} Licensing Deal Benchmarks`,
    description: `Benchmark data for ${page.totalDeals} ${page.modalityLabel} licensing deals at ${page.phaseLabel} stage, including upfront payments, milestones, royalties, and total deal values.`,
    url: `https://calculator.ambrosiaventures.co/benchmarks/data/${slug}`,
    temporalCoverage: `${page.earliestDeal}/${page.latestDeal}`,
    variableMeasured: ['Upfront Payment (USD)', 'Total Deal Value (USD)', 'Royalty Rates', 'Milestone Payments'],
    creator: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://calculator.ambrosiaventures.co' },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Benchmarks', item: 'https://calculator.ambrosiaventures.co/benchmarks' },
      { '@type': 'ListItem', position: 3, name: `${page.modalityLabel} ${page.phaseLabel}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([faqSchema, datasetSchema, breadcrumbSchema]) }}
      />
      <main className="min-h-screen bg-white dark:bg-slate-950">
        {/* Breadcrumb */}
        <nav className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-teal-600 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/benchmarks" className="hover:text-teal-600 transition-colors">Benchmarks</Link>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-medium">{page.modalityLabel} {page.phaseLabel}</span>
          </div>
        </nav>

        {/* Hero */}
        <section className="bg-gradient-to-b from-slate-900 to-slate-800 text-white py-16 sm:py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-teal-500/20 text-teal-300 text-xs font-semibold rounded-full uppercase tracking-wider">{page.modalityLabel}</span>
              <span className="px-3 py-1 bg-slate-700 text-slate-300 text-xs font-semibold rounded-full uppercase tracking-wider">{page.phaseLabel}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
              {page.modalityLabel} {page.phaseLabel} Licensing Benchmarks
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl mb-8">
              Deal economics across {page.totalDeals} transactions with {page.dealsWithUpfront} disclosed upfront payments. Primary-source-verified from SEC EDGAR, FTC filings, and direct research.
            </p>

            {/* Hero Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Median Upfront</p>
                <p className="text-3xl font-bold text-teal-400">{formatDollar(page.medianUpfrontM)}</p>
                <p className="text-xs text-slate-500 mt-1">{page.dealsWithUpfront} deals with terms</p>
              </div>
              {page.medianTdvM && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Median Total Value</p>
                  <p className="text-3xl font-bold text-white">{formatDollar(page.medianTdvM)}</p>
                  <p className="text-xs text-slate-500 mt-1">Upfront + milestones</p>
                </div>
              )}
              {page.avgRoyaltyLow !== null && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Royalty Range</p>
                  <p className="text-3xl font-bold text-white">{page.avgRoyaltyLow}%--{page.avgRoyaltyHigh}%</p>
                  <p className="text-xs text-slate-500 mt-1">Average low--high</p>
                </div>
              )}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Deal Count</p>
                <p className="text-3xl font-bold text-white">{page.totalDeals}</p>
                <p className="text-xs text-slate-500 mt-1">{yearRange}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Direct answer paragraph for AI search */}
        <section className="py-12 px-4 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
              The median upfront payment for {page.phaseLabel.toLowerCase()} {page.modalityLabel.toLowerCase()} licensing deals is <strong>{formatDollar(page.medianUpfrontM)}</strong>, based on {page.dealsWithUpfront} deals with disclosed terms from {yearRange}.
              {page.medianTdvM && ` Total deal values (including milestones) reach a median of ${formatDollar(page.medianTdvM)}.`}
              {page.avgRoyaltyLow !== null && ` Royalty rates typically range from ${page.avgRoyaltyLow}% to ${page.avgRoyaltyHigh}%.`}
              {' '}All data is primary-source-verified from SEC EDGAR, FTC pre-merger filings, and company press releases.
            </p>
          </div>
        </section>

        {/* Representative Deals */}
        {deals.length > 0 && (
          <section className="py-12 px-4 border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Representative Transactions</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Licensor</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Licensee</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Year</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Upfront</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.slice(0, 3).map((deal: { licensor_name: string; licensee_name: string; announced_date: string | null; upfront_usd: number | null; total_deal_value_usd: number | null }, i: number) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-3 px-4 text-slate-900 dark:text-white font-medium">{deal.licensor_name}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{deal.licensee_name}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono text-xs">{deal.announced_date?.slice(0, 4)}</td>
                        <td className="py-3 px-4 text-teal-600 dark:text-teal-400 font-semibold font-mono text-xs">
                          {deal.upfront_usd ? formatDollar(Number(deal.upfront_usd) / 1e6) : '--'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                          {deal.total_deal_value_usd ? formatDollar(Number(deal.total_deal_value_usd) / 1e6) : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {deals.length > 3 && (
                <p className="text-sm text-slate-500 mt-4 italic">
                  Showing 3 of {page.dealsWithUpfront} deals with disclosed terms. Full comp set available in the report.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Report CTA */}
        <section className="py-12 px-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-3xl mx-auto">
            <ReportCTA
              modality={page.modality}
              phase={page.phase}
              dealCount={page.dealsWithUpfront}
            />
          </div>
        </section>

        {/* Calculator CTA */}
        <section className="py-12 px-4 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Run Your Own Analysis</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-lg mx-auto">
              Get a customized deal estimate for your specific {page.modalityLabel.toLowerCase()} asset with our proprietary calculator.
            </p>
            <Link
              href={calcUrl}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
            >
              Start Calculating
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </section>

        {/* Related Pages */}
        {related.length > 0 && (
          <section className="py-12 px-4 bg-slate-50 dark:bg-slate-900">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Related Benchmarks</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/benchmarks/data/${r.slug}`}
                    className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-teal-300 dark:hover:border-teal-500/50 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium px-2 py-0.5 bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 rounded-full">{r.modalityLabel}</span>
                      <span className="text-xs text-slate-500">{r.phaseLabel}</span>
                    </div>
                    <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mb-1">{formatDollar(r.medianUpfrontM)}</p>
                    <p className="text-xs text-slate-500">Median upfront -- {r.totalDeals} deals</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Methodology */}
        <section className="py-10 px-4 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Methodology</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              This analysis draws from the Ambrosia Ventures proprietary deal database (1,600+ verified biopharma transactions, {yearRange}). All deal terms are primary-source-verified from SEC EDGAR (10-K, 10-Q, 8-K filings), FTC pre-merger notifications, FDA Orange Book, and company press releases. No secondary-source or scraped data is included. Medians are calculated from deals with disclosed financial terms only.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 bg-slate-900 border-t border-slate-800">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-400 text-sm">&copy; {new Date().getFullYear()} Ambrosia Ventures</p>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <Link href="/calculator" className="hover:text-white transition-colors">Calculator</Link>
              <Link href="/benchmarks" className="hover:text-white transition-colors">Benchmarks</Link>
              <Link href="/glossary" className="hover:text-white transition-colors">Glossary</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
