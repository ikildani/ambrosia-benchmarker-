import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import {
  getAllBenchmarkSlugs,
  getBenchmarkBySlug,
} from '@/lib/benchmarkPages';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllBenchmarkSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getBenchmarkBySlug(slug);
  if (!page) return {};

  return {
    title: page.title,
    description: page.metaDescription,
    alternates: {
      canonical: `https://calculator.ambrosiaventures.co/benchmarks/${slug}`,
    },
    openGraph: {
      title: page.title,
      description: page.metaDescription,
      type: 'article',
      url: `https://calculator.ambrosiaventures.co/benchmarks/${slug}`,
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(page.h1)}&subtitle=${encodeURIComponent(page.metaDescription.slice(0, 90))}&type=landing`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.metaDescription,
    },
  };
}

export default async function BenchmarkPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getBenchmarkBySlug(slug);
  if (!page) notFound();

  // Build calculator URL from prefill params
  const calculatorParams = new URLSearchParams();
  if (page.calculatorPrefill.phase) calculatorParams.set('phase', page.calculatorPrefill.phase);
  if (page.calculatorPrefill.modality) calculatorParams.set('modality', page.calculatorPrefill.modality);
  if (page.calculatorPrefill.indication) calculatorParams.set('indication', page.calculatorPrefill.indication);
  if (page.calculatorPrefill.therapeuticArea) calculatorParams.set('therapeuticArea', page.calculatorPrefill.therapeuticArea);
  const calculatorUrl = `/calculator${calculatorParams.toString() ? `?${calculatorParams.toString()}` : ''}`;

  // JSON-LD: FAQ schema
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  // JSON-LD: Article schema
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    description: page.metaDescription,
    author: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: 'https://calculator.ambrosiaventures.co',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      logo: {
        '@type': 'ImageObject',
        url: 'https://calculator.ambrosiaventures.co/logo.png',
      },
    },
    datePublished: '2026-01-15',
    dateModified: '2026-03-06',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://calculator.ambrosiaventures.co/benchmarks/${slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([faqSchema, articleSchema]),
        }}
      />

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-20 px-4 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,165,0.12),rgba(255,255,255,0))]" />
            <div className="absolute top-20 right-[10%] w-72 h-72 bg-teal-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-[5%] w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-5xl mx-auto">
            {/* Breadcrumb */}
            <Breadcrumbs items={[
              { label: 'Home', href: '/' },
              { label: 'Benchmarks', href: '/benchmarks' },
              { label: page.h1 },
            ]} />

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-8 leading-tight">
              {page.h1}
            </h1>

            {/* Hero stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {page.heroStats.map((stat, i) => (
                <div
                  key={i}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5"
                >
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    {stat.label}
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent mb-1">
                    {stat.value}
                  </div>
                  <div className="text-xs text-slate-500">{stat.subtext}</div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-8">
              <Link
                href={calculatorUrl}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
              >
                Model Your Deal
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </header>

        {/* Context / Analysis */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">
              Market Analysis
            </h2>
            <div className="space-y-6">
              {page.contextParagraphs.map((para, i) => (
                <p key={i} className="text-slate-600 leading-relaxed text-lg">
                  {para}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* Mid-page CTA */}
        <section className="py-12 px-4 bg-slate-50 border-y border-slate-200">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">
                Customize these benchmarks for your asset
              </h3>
              <p className="text-slate-600 text-sm">
                Adjust phase, modality, competitive position, and 10+ other parameters.
              </p>
            </div>
            <Link
              href={calculatorUrl}
              className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20 text-sm"
            >
              Open Calculator
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {page.faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group bg-white rounded-xl border border-slate-200 overflow-hidden"
                >
                  <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                    <span className="font-medium text-slate-900 pr-4">
                      {faq.question}
                    </span>
                    <svg
                      className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </summary>
                  <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Related Pages */}
        <section className="py-16 px-4 bg-slate-50 border-t border-slate-200">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">
              Related Benchmarks
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {page.relatedPages.map((related) => (
                <Link
                  key={related.slug}
                  href={`/benchmarks/${related.slug}`}
                  className="group bg-white rounded-xl border border-slate-200 p-5 hover:border-teal-300 hover:shadow-soft-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <h3 className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors mb-2">
                    {related.title}
                  </h3>
                  <span className="flex items-center gap-1 text-sm text-teal-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    View
                    <svg
                      className="w-4 h-4 transition-transform group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-16 px-4 bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Calculate Your Deal Terms?
            </h2>
            <p className="text-slate-300 mb-8">
              Get instant, customized benchmarks based on real market data from 600+ biopharma licensing deals.
            </p>
            <Link
              href={calculatorUrl}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
            >
              Start Calculating
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </Link>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
