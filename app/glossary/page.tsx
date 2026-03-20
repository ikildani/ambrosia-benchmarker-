import { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { BookOpen } from 'lucide-react';
import { glossaryTerms, glossaryCategories } from '@/lib/glossaryTerms';
import { SiteFooter } from '@/components/seo/SiteFooter';

export const metadata: Metadata = {
  title: 'Biotech Licensing Glossary | Deal Terms Explained | Ambrosia Ventures',
  description: 'Comprehensive glossary of biotech licensing deal terms. Learn about upfront payments, milestones, royalties, CVRs, and more pharmaceutical partnership terminology.',
  keywords: ['biotech glossary', 'licensing terms', 'pharma deal terminology', 'milestone payments explained', 'royalty rates', 'biotech M&A terms'],
  openGraph: {
    title: `Biotech Licensing Glossary — ${glossaryTerms.length}+ Deal Terms Explained`,
    description: 'Master the language of biotech licensing deals — upfront payments, milestones, royalties, CVRs, ADCs, CAR-T, and more.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/glossary',
    images: [{ url: '/api/og?title=Biotech%20Licensing%20Glossary&subtitle=30%2B%20Essential%20Deal%20Terms%20Explained&type=landing' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biotech Licensing Glossary — Deal Terms Explained',
    description: `Comprehensive glossary of ${glossaryTerms.length}+ biotech licensing deal terms for BD professionals.`,
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/glossary',
  },
};

export default function GlossaryPage() {
  // JSON-LD for glossary
  const glossarySchema = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: 'Biotech Licensing Glossary',
    description: 'Comprehensive glossary of biotech and pharmaceutical licensing deal terminology',
    url: 'https://calculator.ambrosiaventures.co/glossary',
    hasDefinedTerm: glossaryTerms.map(term => ({
      '@type': 'DefinedTerm',
      name: term.term,
      description: term.definition,
      url: `https://calculator.ambrosiaventures.co/glossary/${term.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(glossarySchema) }}
      />

      <main className="min-h-screen bg-white">
        {/* Header */}
        <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-16 px-4">
          <div className="max-w-4xl mx-auto">
            <Breadcrumbs items={[{ label: 'Glossary' }]} />

            <div className="mt-8 flex items-start gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <BookOpen className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">
                  Biotech Licensing Glossary
                </h1>
                <p className="mt-2 text-xl text-slate-300">
                  {glossaryTerms.length} essential terms for biotech deal professionals
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Category Navigation */}
        <nav className="sticky top-0 z-40 bg-white border-b border-slate-200 py-4 px-4">
          <div className="max-w-4xl mx-auto flex flex-wrap gap-2">
            {glossaryCategories.map((category) => (
              <a
                key={category}
                href={`#${category.toLowerCase().replace(/\s+/g, '-')}`}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-full hover:bg-blue-100 hover:text-blue-700 transition-colors"
              >
                {category}
              </a>
            ))}
          </div>
        </nav>

        {/* Glossary Content */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          {glossaryCategories.map((category) => (
            <section
              key={category}
              id={category.toLowerCase().replace(/\s+/g, '-')}
              className="mb-12"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-200">
                {category}
              </h2>
              <div className="space-y-6">
                {glossaryTerms
                  .filter((term) => term.category === category)
                  .map((term) => (
                    <div
                      key={term.term}
                      id={term.slug}
                      className="scroll-mt-24"
                    >
                      <h3 className="text-lg font-semibold text-slate-900">
                        <Link
                          href={`/glossary/${term.slug}`}
                          className="hover:text-blue-700 transition-colors"
                        >
                          {term.term}
                        </Link>
                      </h3>
                      <p className="mt-2 text-slate-600 leading-relaxed">
                        {term.definition}
                      </p>
                      <Link
                        href={`/calculator`}
                        className="inline-flex items-center gap-1 mt-2 text-sm text-teal-600 font-medium hover:text-teal-700 transition-colors"
                      >
                        See in action
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </Link>
                      {term.relatedTerms.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-xs text-slate-400">Related:</span>
                          {term.relatedTerms.map((related) => {
                            const entry = glossaryTerms.find(t => t.term === related);
                            return entry ? (
                              <Link
                                key={related}
                                href={`/glossary/${entry.slug}`}
                                className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                              >
                                {related}
                              </Link>
                            ) : (
                              <span
                                key={related}
                                className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded"
                              >
                                {related}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-slate-50">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Put These Terms Into Practice
            </h2>
            <p className="text-slate-600 mb-8">
              Use our calculator to estimate deal terms based on real market data.
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
