import { Metadata } from 'next';
import Link from 'next/link';
import { DEAL_STATS } from '@/lib/config/constants';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Solidus for BD Teams | Biopharma Deal Benchmarking',
  description: `Deal intelligence for pharma and biotech business development teams. Benchmark upfronts, milestones, and royalties against ${DEAL_STATS.TOTAL_DEALS} verified transactions before you negotiate.`,
  keywords: [
    'pharma BD deal benchmarking',
    'biotech licensing benchmarks',
    'deal terms database',
    'biopharma business development tools',
    'licensing deal comparables',
    'pharma deal intelligence',
  ],
  alternates: { canonical: `${BASE_URL}/for/bd-teams` },
  openGraph: {
    title: 'Solidus for BD Teams | Biopharma Deal Benchmarking',
    description: `Benchmark deal terms against ${DEAL_STATS.TOTAL_DEALS} verified transactions. Stop guessing on upfronts, milestones, and royalties.`,
    type: 'website',
    url: `${BASE_URL}/for/bd-teams`,
    siteName: 'Solidus by Ambrosia Ventures',
    images: [{ url: '/api/og?title=Solidus%20for%20BD%20Teams&subtitle=Deal%20Intelligence%20for%20Business%20Development', width: 1200, height: 630 }],
  },
};

export default function BDTeamsPage() {
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
            <li className="text-slate-700 dark:text-slate-300 font-medium">For BD Teams</li>
          </ol>
        </nav>

        <div className="mb-12">
          <p className="text-sm font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-3">For Business Development</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Walk into every negotiation with the data your counterparty already has.
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
            Solidus benchmarks your deal against {DEAL_STATS.TOTAL_DEALS} verified biopharma transactions — upfronts, milestones, royalties, and deal structures — so you negotiate from evidence, not anecdote.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 mb-12">
          {[
            { title: 'Deal Terms Calculator', desc: 'Input your asset\'s TA, modality, phase, and indication. Get benchmarked upfront, total deal value, milestone, and royalty ranges in seconds — calibrated against SEC 8-K filings.' },
            { title: 'Comparable Deal Selector', desc: 'Pull the specific transactions your counterparty will reference. Filter by indication, modality, stage, territory, and deal type. See what similar assets actually transacted for.' },
            { title: 'Partner Matching', desc: '850+ companies scored across 11 strategic dimensions. Know which buyers have the pipeline gaps, financial capacity, and M&A history that make your asset a fit — before the first call.' },
            { title: 'Buyer-Specific Valuation', desc: 'The same asset is worth different amounts to different buyers. Solidus calibrates valuations to each acquirer\'s portfolio gaps, deal history, and strategic premiums.' },
            { title: 'Monte Carlo Simulation', desc: '10,000-iteration probabilistic analysis. See the full distribution of outcomes — not just the median. Know where P10, P50, and P90 land for your specific deal.' },
            { title: 'Negotiation Playbook', desc: 'AI-generated playbook with opening position, walk-away, and counterparty-specific talking points. Built from the comp set, not generic advice.' },
          ].map((item) => (
            <div key={item.title} className="p-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{item.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-6 mb-12">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">The problem Solidus solves for BD teams</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Your counterparty — the pharma company across the table — has a 200-person deal team, a proprietary transaction database, and decades of pattern recognition. Your company has a spreadsheet and whatever your BD lead remembers from the last conference. Solidus closes that gap. Every deal term you propose is backed by verified comparable transactions, not guesswork.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/calculator" className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors">
            Benchmark Your Deal — Free
          </Link>
          <Link href="/pricing" className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            See Pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
