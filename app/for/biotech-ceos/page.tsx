import { Metadata } from 'next';
import Link from 'next/link';
import { DEAL_STATS } from '@/lib/config/constants';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Solidus for Biotech CEOs | Know What Your Deal Is Worth',
  description: `Deal intelligence for biotech founders and CEOs preparing for licensing, partnering, or M&A. Benchmark your asset against ${DEAL_STATS.TOTAL_DEALS} verified pharma transactions.`,
  keywords: [
    'biotech CEO deal preparation',
    'biotech licensing valuation',
    'pharma deal benchmarks for founders',
    'biotech asset valuation tool',
    'licensing deal preparation',
    'biotech M&A benchmarking',
  ],
  alternates: { canonical: `${BASE_URL}/for/biotech-ceos` },
  openGraph: {
    title: 'Solidus for Biotech CEOs | Know What Your Deal Is Worth',
    description: 'Benchmark your asset before the first meeting. Know what fair terms look like — backed by verified transactions, not anecdote.',
    type: 'website',
    url: `${BASE_URL}/for/biotech-ceos`,
    siteName: 'Solidus by Ambrosia Ventures',
    images: [{ url: '/api/og?title=Solidus%20for%20Biotech%20CEOs&subtitle=Know%20What%20Your%20Deal%20Is%20Worth', width: 1200, height: 630 }],
  },
};

export default function BiotechCEOsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b border-slate-200/80 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center text-lg font-bold text-slate-900 dark:text-white">Ambrosia Ventures</Link>
            <div className="flex items-center gap-4">
              <Link href="/calculator" className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors">Calculator</Link>
              <Link href="/" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <li><Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-slate-700 dark:text-slate-300 font-medium">For Biotech CEOs</li>
          </ol>
        </nav>

        <div className="mb-12">
          <p className="text-sm font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-3">For Biotech Founders &amp; CEOs</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Your first licensing deal sets the tone for everything that follows. Get it right.
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
            Most biotech CEOs enter their first partnering conversation without knowing what comparable deals actually transacted for. Solidus gives you the data before you&apos;re at the table — so your board deck references real benchmarks, not assumptions.
          </p>
        </div>

        <div className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">What Solidus does for you</h2>
          <div className="space-y-4">
            {[
              { title: 'Before the first meeting', desc: 'Run your asset through 21 engines. In 30 seconds, you know the upfront range, total deal value, milestone structure, and royalty tiers for your specific TA, modality, phase, and indication. Based on verified SEC 8-K filings — not press releases.' },
              { title: 'Before the board meeting', desc: 'Generate a deal intelligence brief with comparable transactions, rNPV analysis, Monte Carlo distributions, and scenario comparisons (Bear/Base/Bull). Your board sees institutional-grade analysis, not a spreadsheet with three rows of comps.' },
              { title: 'Before you sign the term sheet', desc: 'The Deal Structure Optimizer models all five deal structures (licensing, acquisition, co-development, option, collaboration) side by side. Know whether you\'re leaving money on the table with the structure you\'ve been offered.' },
              { title: 'When the buyer says "this is market"', desc: 'Pull the actual comp set. Filter by indication, modality, stage, territory. See exactly what "market" is — and where your asset falls relative to it. The Pharma Intent Score tells you how likely each buyer is to close.' },
            ].map((item) => (
              <div key={item.title} className="p-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-6 mb-12">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">The cost of not knowing</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
            A Phase 2 oncology licensing deal has a median total deal value of $400M+. The difference between a well-benchmarked negotiation and an under-informed one is typically 10-20% of deal value. On a $400M deal, that&apos;s $40-80M left on the table.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Solidus Pro costs $299/month. A Deal Intelligence Brief is $2,500 for the full landscape. The math speaks for itself.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/calculator" className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors">
            Benchmark Your Asset — Free
          </Link>
          <Link href="/pro" className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Start Free Pro Trial
          </Link>
        </div>
      </div>
    </main>
  );
}
