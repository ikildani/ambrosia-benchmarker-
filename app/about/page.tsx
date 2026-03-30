import { Metadata } from 'next';
import Link from 'next/link';
import { generateAboutPageSchema, generateBreadcrumbSchema } from '@/lib/seo/structured-data';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://calculator.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'About Ambrosia Ventures | Life Sciences M&A Advisory',
  description:
    'Ambrosia Ventures builds data-driven deal intelligence tools for life sciences professionals. Learn about our team, methodology, and mission to bring transparency to biopharma deal-making.',
  keywords: [
    'Ambrosia Ventures',
    'life sciences M&A advisory',
    'biopharma deal intelligence',
    'biotech licensing experts',
    'pharma deal advisory',
    'deal benchmarking team',
  ],
  alternates: {
    canonical: `${BASE_URL}/about`,
  },
  openGraph: {
    title: 'About Ambrosia Ventures | Life Sciences M&A Advisory',
    description:
      'Data-driven deal intelligence for life sciences professionals. Learn about our team and mission.',
    type: 'website',
    url: `${BASE_URL}/about`,
    siteName: 'Ambrosia Ventures',
    images: [
      {
        url: '/api/og?title=About%20Ambrosia%20Ventures&subtitle=Life%20Sciences%20Deal%20Intelligence',
        width: 1200,
        height: 630,
        alt: 'About Ambrosia Ventures',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Ambrosia Ventures | Life Sciences M&A Advisory',
    description:
      'Data-driven deal intelligence for life sciences professionals.',
  },
};

export default function AboutPage() {
  const aboutSchema = generateAboutPageSchema();
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'About' },
  ]);

  return (
    <>
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        {/* Header */}
        <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b border-slate-200/80 dark:border-slate-700 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link
                href="/"
                className="flex items-center text-lg font-bold text-slate-900 dark:text-white"
              >
                Ambrosia Ventures
              </Link>
              <div className="flex items-center gap-4">
                <Link
                  href="/calculator"
                  className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                >
                  Calculator
                </Link>
                <Link
                  href="/"
                  className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Home
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <li>
                <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-slate-700 dark:text-slate-300 font-medium">About</li>
            </ol>
          </nav>

          {/* Page Header */}
          <div className="mb-12">
            <p className="text-sm font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-3">
              About Us
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              Why Ambrosia Ventures
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl">
              We believe biopharma deal-making should be driven by data, not guesswork.
              Ambrosia Ventures brings institutional-grade deal intelligence to every team
              at the negotiating table.
            </p>
          </div>

          {/* Main Content */}
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-12">

            {/* The Problem */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white !mt-0">
                The Problem We Solve
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-lg">
                Life sciences licensing is a $200B+ annual market where information asymmetry
                determines outcomes. Large pharmaceutical companies negotiate dozens of deals per year
                and maintain dedicated competitive intelligence teams. Most biotech companies negotiate
                one or two major deals in their entire corporate life.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                This asymmetry means biotech founders, venture investors, and smaller pharma teams
                routinely leave tens of millions of dollars on the table — not because they lack
                negotiating skill, but because they lack market context. They do not know what
                comparable deals have closed at, what terms are standard versus exceptional, or
                where the leverage points are in their specific transaction.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                We built Ambrosia Ventures to close that gap.
              </p>
            </section>

            {/* What We Built */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                What We Built
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                Our platform combines three capabilities that were previously available only to
                the largest advisory firms:
              </p>
              <div className="not-prose grid sm:grid-cols-3 gap-6 mt-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mb-4">
                    <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Deal Calculator</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Instant benchmarks for upfront payments, milestones, royalties, and total deal
                    value — calibrated by therapeutic area, modality, and clinical phase.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Market Intelligence</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Real-time deal flow tracking, company profiles, and competitive landscape analysis
                    across 12 therapeutic areas and 850+ companies.
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center mb-4">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Advanced Valuation</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    rNPV modeling, Monte Carlo simulation with 10,000 iterations, scenario planning,
                    and AI-generated negotiation playbooks.
                  </p>
                </div>
              </div>
            </section>

            {/* Our Data */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Our Data Advantage
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                The quality of deal intelligence depends entirely on the quality of the underlying
                data. Our transaction database includes 3,000+ verified biopharma deals spanning
                2017 through 2026, sourced from SEC filings (8-K material agreements), FTC premerger filings, regulatory
                agency databases, clinical trial registries, and proprietary intelligence feeds.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Every deal in our database is normalized for comparability: financial terms are
                adjusted for territory scope, milestone probability weighting, and deal structure
                variations. This normalization is what makes our benchmarks reliable — you are
                comparing like-for-like transactions, not headline numbers that obscure meaningful
                differences.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Our data pipeline runs continuously, with new deals ingested within 48 hours of
                public disclosure. Weekly automated scans of SEC EDGAR capture material agreements
                as they are filed, and our clinical trial monitoring tracks partnership and sponsor
                changes that signal deal activity before press announcements.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                For a detailed explanation of how we process and validate our data, see our{' '}
                <Link href="/methodology" className="text-teal-600 dark:text-teal-400 font-medium hover:underline">
                  methodology page
                </Link>.
              </p>
            </section>

            {/* Who We Serve */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Who We Serve
              </h2>
              <div className="not-prose space-y-4 mt-6">
                {[
                  {
                    title: 'Biotech Business Development',
                    description: 'Founders and BD leads preparing for licensing discussions who need to understand where their deal should price relative to comparable transactions.',
                  },
                  {
                    title: 'Pharma Corporate Development',
                    description: 'Search and evaluation teams assessing in-licensing opportunities who need objective benchmarks to calibrate internal valuations.',
                  },
                  {
                    title: 'Life Sciences Investors',
                    description: 'Venture capital and crossover investors who need to model licensing scenarios for portfolio companies and validate management deal projections.',
                  },
                  {
                    title: 'M&A Advisory Teams',
                    description: 'Investment bankers and advisory professionals who need real-time deal comps and defensible valuation frameworks for client engagements.',
                  },
                  {
                    title: 'Strategy Consultants',
                    description: 'Consulting teams advising pharma clients on portfolio strategy, competitive positioning, and deal structuring.',
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5"
                  >
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Our Approach */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Our Approach to Deal Intelligence
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                We take a fundamentally different approach from traditional deal databases. Rather
                than presenting raw deal data and leaving interpretation to the user, we build
                analytical models that extract actionable insights from the data.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                When you use our calculator, you are not just querying a database — you are
                accessing a model that accounts for phase-specific risk adjustments, modality
                premiums, therapeutic area dynamics, territory scope, regulatory designation
                impacts, and competitive intensity. These factors are calibrated against actual
                deal outcomes, not theoretical frameworks.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                The result is deal intelligence that reflects how the market actually prices
                assets — with all the nuance and context that a well-prepared advisory team
                would bring to a client engagement, delivered instantly and at a fraction of
                the cost.
              </p>
            </section>

            {/* CTA Section */}
            <section className="not-prose">
              <div className="bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20 rounded-2xl border border-teal-200/50 dark:border-teal-800/50 p-8 sm:p-10 text-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                  Start Benchmarking
                </h2>
                <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-lg mx-auto">
                  Whether you are preparing for a licensing negotiation, evaluating an
                  in-licensing opportunity, or modeling deal scenarios for your portfolio,
                  our platform gives you the data to make better decisions.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    href="/calculator"
                    className="inline-flex items-center justify-center px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors"
                  >
                    Open the Calculator
                  </Link>
                  <Link
                    href="/benchmarks"
                    className="inline-flex items-center justify-center px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:border-teal-300 dark:hover:border-teal-600 transition-colors"
                  >
                    Browse Benchmarks
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
