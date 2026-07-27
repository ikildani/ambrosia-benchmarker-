import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { getAllInsightSlugs, getInsightBySlug } from '@/lib/insightPages';
import { DEAL_STATS } from '@/lib/config/constants';
import { InsightEmailCapture } from '@/components/insights/InsightEmailCapture';

export async function generateStaticParams() {
  return getAllInsightSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const insight = getInsightBySlug(slug);
  if (!insight) return {};

  const baseUrl = 'https://solidus.ambrosiaventures.co';
  const ogUrl = `${baseUrl}/api/og?type=insight&stat=${encodeURIComponent(insight.stat)}&title=${encodeURIComponent(insight.title)}`;

  return {
    title: `${insight.stat} — ${insight.title} | Ambrosia Ventures`,
    description: insight.metaDescription,
    openGraph: {
      title: `${insight.stat} — ${insight.title}`,
      description: insight.metaDescription,
      url: `${baseUrl}/insights/${slug}`,
      type: 'article',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: insight.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${insight.stat} — ${insight.title}`,
      description: insight.metaDescription,
      images: [ogUrl],
    },
    alternates: {
      canonical: `${baseUrl}/insights/${slug}`,
    },
  };
}

export default async function InsightPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const insight = getInsightBySlug(slug);
  if (!insight) notFound();

  const baseUrl = 'https://solidus.ambrosiaventures.co';
  const calcUrl = `${baseUrl}/calculator?${new URLSearchParams(
    Object.entries(insight.calculatorPrefill).filter(([, v]) => v) as [string, string][]
  ).toString()}`;

  const linkedInText = `${insight.stat} — ${insight.title}\n\nExplore more biopharma deal benchmarks:\n${baseUrl}/insights/${slug}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${baseUrl}/insights/${slug}`)}&summary=${encodeURIComponent(linkedInText)}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://solidus.ambrosiaventures.co" },
          { "@type": "ListItem", "position": 2, "name": "Insights", "item": "https://solidus.ambrosiaventures.co/insights" },
          { "@type": "ListItem", "position": 3, "name": insight.title }
        ]
      })}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": `${insight.stat} — ${insight.title}`,
        "description": insight.context,
        "author": { "@type": "Organization", "name": "Ambrosia Ventures", "url": "https://solidus.ambrosiaventures.co" },
        "publisher": { "@type": "Organization", "name": "Ambrosia Ventures", "url": "https://solidus.ambrosiaventures.co", "logo": { "@type": "ImageObject", "url": "https://solidus.ambrosiaventures.co/logo.png" } },
        "mainEntityOfPage": `https://solidus.ambrosiaventures.co/insights/${slug}`,
        "image": `https://solidus.ambrosiaventures.co/api/og?type=insight&stat=${encodeURIComponent(insight.stat)}&title=${encodeURIComponent(insight.title)}`,
        "articleSection": "Biopharma Deal Intelligence",
        "keywords": "biopharma deals, licensing benchmarks, deal intelligence",
      })}} />
      <main className="min-h-screen bg-slate-950 text-white">
        {/* Big stat hero */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center text-xs font-bold text-white">
                A
              </div>
              Ambrosia Ventures
            </Link>
          </div>

          <div className="text-7xl sm:text-8xl md:text-9xl font-bold text-amber-400 mb-6 tracking-tight">
            {insight.stat}
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-4 leading-tight">
            {insight.title}
          </h1>

          <p className="text-slate-400 text-lg leading-relaxed max-w-2xl mx-auto mb-8">
            {insight.context}
          </p>

          <p className="text-xs text-slate-600 mb-10">{insight.source}</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={calcUrl}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold hover:from-teal-700 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20"
            >
              Run Your Own Analysis
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href={linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-700 text-slate-300 font-medium hover:border-slate-500 hover:text-white transition-all"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Share on LinkedIn
            </a>
          </div>
        </div>
      </section>

      {/* Related insights */}
      <section className="border-t border-slate-800 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-lg font-semibold text-slate-300 mb-8 text-center">More Deal Insights</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {insight.relatedInsights.map((related) => (
              <Link
                key={related.slug}
                href={`/insights/${related.slug}`}
                className="group block rounded-xl border border-slate-800 p-6 hover:border-slate-600 transition-colors"
              >
                <div className="text-3xl font-bold text-amber-400 mb-2 group-hover:text-amber-300 transition-colors">
                  {related.stat}
                </div>
                <p className="text-sm text-slate-400 leading-snug">{related.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <InsightEmailCapture slug={slug} />

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
            Try Solidus →
          </Link>
        </div>
      </section>
    </main>
    </>
  );
}
