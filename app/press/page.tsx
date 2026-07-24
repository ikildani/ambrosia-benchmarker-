'use client';

import Image from 'next/image';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { DEAL_STATS } from '@/lib/config/constants';

export default function PressPage() {
  return (
    <>
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt="Ambrosia Ventures"
                width={180}
                height={48}
                className="h-10 w-auto object-contain dark:[filter:brightness(2)]"
                priority
              />
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Press & Media
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Resources for journalists, analysts, and media professionals covering the life sciences industry.
          </p>
        </div>

        {/* Company Overview */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">About Ambrosia Ventures</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Ambrosia Ventures provides data-driven deal intelligence for the life sciences industry. Our platform
              analyzes {DEAL_STATS.TOTAL_DEALS} publicly disclosed biopharma licensing transactions to help biotechnology companies
              benchmark deal terms and identify optimal partners.
            </p>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Solidus enables biotech executives, business development professionals, and investors
              to estimate upfront payments, milestone structures, and royalty rates based on real market data
              across therapeutic areas including oncology, neurology, immunology, and metabolic/obesity.
            </p>
          </div>
        </section>

        {/* Key Facts */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Key Facts</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { stat: DEAL_STATS.TOTAL_DEALS, label: 'Deals Analyzed' },
              { stat: '12', label: 'Therapeutic Areas' },
              { stat: '15+', label: 'Modalities Covered' },
              { stat: '2018-Present', label: 'Data Coverage' },
            ].map((item, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 text-center">
                <p className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">
                  {item.stat}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Data Methodology */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Data & Methodology</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Data Sources</h3>
                <p className="text-slate-600 dark:text-slate-300">
                  SEC filings (8-K, 10-K, 10-Q), FTC premerger filings, company press releases, investor presentations, and verified
                  industry databases. All financial terms are cross-referenced for accuracy.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Update Frequency</h3>
                <p className="text-slate-600 dark:text-slate-300">
                  New deals are added within 48 hours of public disclosure. Historical data is continuously
                  validated and enriched with additional context.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Benchmark Methodology</h3>
                <p className="text-slate-600 dark:text-slate-300">
                  Estimates represent the 25th-75th percentile range of comparable transactions, filtered by
                  modality, development phase, therapeutic area, and geographic territory.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Media Assets */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Media Assets</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-32 h-32 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="Ambrosia Ventures Logo"
                  width={100}
                  height={30}
                  className="w-24 object-contain dark:[filter:brightness(2)]"
                />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Logo & Brand Assets</h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
                  Download high-resolution logos and brand guidelines for media use.
                </p>
                <a
                  href="mailto:info@ambrosiaventures.co?subject=Media%20Kit%20Request"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Request Media Kit
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Press Contact */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Press Contact</h2>
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-2xl border border-teal-200 dark:border-teal-800 p-6 sm:p-8">
            <p className="text-slate-700 dark:text-slate-300 mb-4">
              For press inquiries, interview requests, or data citations, please contact:
            </p>
            <a
              href="mailto:info@ambrosiaventures.co"
              className="inline-flex items-center gap-2 text-teal-600 dark:text-teal-400 font-semibold hover:underline"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              info@ambrosiaventures.co
            </a>
          </div>
        </section>

        {/* Citation Guidelines */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Citation Guidelines</h2>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              When citing Ambrosia Ventures data or analysis, please use the following format:
            </p>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 font-mono text-sm text-slate-700 dark:text-slate-300">
              Source: Solidus (solidus.ambrosiaventures.co), [Month Year]
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
              For custom data requests or exclusive analysis, please contact our press team.
            </p>
          </div>
        </section>
      </div>

    </main>
    <SiteFooter />
    </>
  );
}
