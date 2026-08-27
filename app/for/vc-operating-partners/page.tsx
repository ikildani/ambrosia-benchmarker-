import { Metadata } from 'next';
import Link from 'next/link';
import { DEAL_STATS } from '@/lib/config/constants';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Solidus for VC Operating Partners | Portfolio Deal Intelligence',
  description: `Deal intelligence for biotech VC and CVC operating partners. Benchmark deal terms across your entire portfolio with ${DEAL_STATS.TOTAL_DEALS} verified transactions, 21 engines, and dedicated analyst support.`,
  keywords: [
    'biotech VC deal intelligence',
    'CVC deal benchmarking',
    'portfolio deal benchmarking',
    'VC operating partner tools',
    'biotech fund deal terms',
    'pharma licensing benchmarks for VCs',
  ],
  alternates: { canonical: `${BASE_URL}/for/vc-operating-partners` },
  openGraph: {
    title: 'Solidus for VC Operating Partners | Portfolio Deal Intelligence',
    description: 'One platform for your entire portfolio. Benchmark every deal before it signs.',
    type: 'website',
    url: `${BASE_URL}/for/vc-operating-partners`,
    siteName: 'Solidus by Ambrosia Ventures',
    images: [{ url: '/api/og?title=Solidus%20for%20VC%20Operating%20Partners&subtitle=Portfolio%20Deal%20Intelligence', width: 1200, height: 630 }],
  },
};

export default function VCOperatingPartnersPage() {
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
            <li className="text-slate-700 dark:text-slate-300 font-medium">For VC Operating Partners</li>
          </ol>
        </nav>

        <div className="mb-12">
          <p className="text-sm font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-3">Portfolio License</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Your portfolio companies negotiate deals you hear about at the board meeting. Change that.
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
            Solidus gives your entire portfolio access to institutional-grade deal benchmarking — so every licensing conversation starts with verified comparable data, not guesswork. You see every deal across the portfolio before it signs.
          </p>
        </div>

        <div className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">What the Portfolio License includes</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: 'Full 21-engine access for every seat', desc: 'Deal terms, rNPV, Monte Carlo, partner matching, buyer-specific valuation, competitive dynamics, real options, milestone optimization — all 21 engines, unlimited calculations.' },
              { title: 'Admin dashboard', desc: 'Real-time visibility into which portfolio companies are benchmarking, what comps they\'re pulling, and where deal conversations are heading. No more status update emails.' },
              { title: 'Cross-portfolio pipeline tracker', desc: 'See active deal conversations across all portfolio companies. Catch conflicts — two companies approaching the same partner uncoordinated — before they become problems.' },
              { title: 'Dedicated analyst hours', desc: 'Every contract includes analyst hours from the Ambrosia team. Task them with custom comp sets, bespoke deal memos, or ad-hoc research. Delivered fund-branded.' },
              { title: 'Fund-branded reports', desc: 'Every output comes with your fund\'s logo and disclaimers. Portfolio CEOs share with their boards — your branding is on the analysis, not ours.' },
              { title: 'Quarterly portfolio benchmarking report', desc: 'A bespoke quarterly report covering deal landscape, company-specific benchmarks, and an LP-ready exec summary. Assembled by Ambrosia analysts.' },
            ].map((item) => (
              <div key={item.title} className="p-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Pricing</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { tier: 'Growth', price: '$30K', period: '/yr', seats: '5 seats', analyst: '2 hrs/mo analyst support' },
              { tier: 'Scale', price: '$60K', period: '/yr', seats: '10 seats', analyst: '5 hrs/mo analyst support', popular: true },
              { tier: 'Enterprise', price: '$120K', period: '/yr', seats: '15+ seats', analyst: '10 hrs/mo + named analyst' },
            ].map((t) => (
              <div key={t.tier} className={`p-5 rounded-lg border ${t.popular ? 'border-teal-400 dark:border-teal-600 ring-1 ring-teal-400/30' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-800/50 relative`}>
                {t.popular && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider bg-teal-500 text-white px-3 py-0.5 rounded-full">Most Popular</span>}
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{t.tier}</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{t.price}<span className="text-sm font-normal text-slate-500">{t.period}</span></div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.seats}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{t.analyst}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-6 mb-12">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">The ROI math</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
            Average Phase 2 licensing deal: $200-500M total value. Improvement needed to break even on a $60K Scale subscription: 0.012%. One better-negotiated milestone structure in one deal pays for a decade of Solidus.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            For context: a single outside counsel engagement on a complex licensing deal costs $75-100K. The Scale tier is $60K/yr for 10 seats — every deal, every company, all year.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/contact" className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors">
            Schedule a Portfolio Demo
          </Link>
          <Link href="/portfolio" className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Full Portfolio License Details
          </Link>
        </div>
      </div>
    </main>
  );
}
