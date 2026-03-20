import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { getAllTermSlugs, getTermBySlug, getRelatedTermEntries } from '@/lib/glossaryTerms';

export function generateStaticParams() {
  return getAllTermSlugs().map((term) => ({ term }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ term: string }>;
}): Promise<Metadata> {
  const { term: slug } = await params;
  const entry = getTermBySlug(slug);
  if (!entry) return {};

  const baseUrl = 'https://calculator.ambrosiaventures.co';
  const title = `${entry.term} — Biotech Deal Term Explained | Ambrosia Ventures`;
  const description = entry.definition.length > 155
    ? entry.definition.substring(0, 152) + '...'
    : entry.definition;

  return {
    title,
    description,
    keywords: [
      entry.term.toLowerCase(),
      `${entry.term.toLowerCase()} definition`,
      `${entry.term.toLowerCase()} biopharma`,
      'biotech deal terms',
      'pharma licensing glossary',
    ],
    openGraph: {
      title,
      description,
      url: `${baseUrl}/glossary/${slug}`,
      type: 'article',
      images: [{ url: `/api/og?title=${encodeURIComponent(entry.term)}&subtitle=${encodeURIComponent(entry.category)}&type=landing`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${entry.term} — Biotech Deal Term`,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/glossary/${slug}`,
    },
  };
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<{ term: string }>;
}) {
  const { term: slug } = await params;
  const entry = getTermBySlug(slug);
  if (!entry) notFound();

  const related = getRelatedTermEntries(entry.relatedTerms);
  const baseUrl = 'https://calculator.ambrosiaventures.co';

  const definedTermSchema = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: entry.term,
    description: entry.definition,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: 'Biotech Licensing Glossary',
      url: `${baseUrl}/glossary`,
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Glossary', item: `${baseUrl}/glossary` },
      { '@type': 'ListItem', position: 3, name: entry.term },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <main className="min-h-screen bg-white">
        {/* Header */}
        <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-16 px-4">
          <div className="max-w-3xl mx-auto">
            <nav className="flex items-center gap-2 text-sm text-slate-400 mb-8">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <Link href="/glossary" className="hover:text-white transition-colors">Glossary</Link>
              <span>/</span>
              <span className="text-slate-200">{entry.term}</span>
            </nav>

            <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-sm font-medium rounded-full mb-4">
              {entry.category}
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white">
              {entry.term}
            </h1>
          </div>
        </header>

        {/* Definition */}
        <section className="max-w-3xl mx-auto px-4 py-12">
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xl text-slate-700 leading-relaxed">
              {entry.definition}
            </p>
          </div>

          {/* Related Terms */}
          {related.length > 0 && (
            <div className="mt-12 pt-8 border-t border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Related Terms</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/glossary/${r.slug}`}
                    className="group block p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                  >
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                      {r.term}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                      {r.definition}
                    </p>
                  </Link>
                ))}
              </div>

              {/* Non-glossary related terms as badges */}
              {entry.relatedTerms.filter((name) => !related.find((r) => r.term === name)).length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {entry.relatedTerms
                    .filter((name) => !related.find((r) => r.term === name))
                    .map((name) => (
                      <span
                        key={name}
                        className="px-3 py-1 text-sm bg-slate-100 text-slate-600 rounded-full"
                      >
                        {name}
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* CTA */}
        <section className="py-16 px-4 bg-slate-50">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              See How {entry.term} Affects Deal Economics
            </h2>
            <p className="text-slate-600 mb-8">
              Model deal terms with real benchmark data from 3,000+ biopharma transactions.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/calculator"
                className="inline-flex items-center justify-center px-8 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors"
              >
                Try the Calculator
              </Link>
              <Link
                href="/glossary"
                className="inline-flex items-center justify-center px-8 py-3 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-100 transition-colors"
              >
                Browse All Terms
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
