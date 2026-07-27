'use client';

import Link from 'next/link';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';
import { DEAL_STATS } from '@/lib/config/constants';

export default function MethodologyPage() {
  return (
    <>
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b border-slate-200/80 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            <Link href="/" className="flex items-center">
              <AmbrosiaLogo variant="auto" height={40} />
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-3 py-2 rounded-lg"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Page Header */}
        <div className="mb-10 sm:mb-14">
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-3">How We Build Our Benchmarks</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Methodology
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl">
            Our benchmarks are calibrated against {DEAL_STATS.TOTAL_DEALS} verified biopharma transactions sourced from regulatory filings, public disclosures, and proprietary intelligence. Here&apos;s how we turn raw data into actionable deal intelligence.
          </p>
        </div>

        {/* Sections */}
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-12">

          {/* Data Foundation */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-700 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white !mt-0 !mb-0">Data Foundation</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Every benchmark in our platform is grounded in real, publicly disclosed transactions. Our database encompasses {DEAL_STATS.TOTAL_DEALS} biopharma deals spanning 2017 through 2026, covering 12 therapeutic areas, 5 deal structures, and 15+ modalities.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 not-prose mt-6">
              {[
                { label: 'Verified Transactions', value: DEAL_STATS.TOTAL_DEALS, sub: 'Licensing, acquisitions, collaborations, options, co-development' },
                { label: 'Company Profiles', value: DEAL_STATS.TOTAL_COMPANIES, sub: 'Pharma, biotech, and specialty companies tracked' },
                { label: 'Therapeutic Areas', value: '12', sub: 'Oncology through rare disease and women\'s health' },
                { label: 'Data Sources', value: '10+', sub: 'Regulatory filings, press wires, agency databases' },
              ].map(s => (
                <div key={s.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{s.value}</div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{s.label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.sub}</div>
                </div>
              ))}
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-8">Primary Sources</h3>
            <ul className="text-slate-600 dark:text-slate-300">
              <li><strong>SEC Regulatory Filings</strong> — 8-K material definitive agreements, the filings companies are legally required to submit when entering material licensing, collaboration, or acquisition agreements</li>
              <li><strong>FTC Premerger Filings</strong> — Hart-Scott-Rodino Act filings and Federal Trade Commission merger review actions that capture deal activity above reporting thresholds</li>
              <li><strong>Press Release Wires</strong> — Deal announcements from global press distribution networks, filtered for biopharma relevance and financial term disclosure</li>
              <li><strong>Regulatory Agency Databases</strong> — FDA, EMA, and other regulatory body approval and authorization records that signal commercial-stage deal activity</li>
              <li><strong>Clinical Trial Registries</strong> — Partnership and sponsor changes in registered clinical trials that indicate underlying licensing or collaboration agreements</li>
              <li><strong>Proprietary Intelligence Feeds</strong> — Web-wide deal monitoring that captures announcements from industry conferences, investor presentations, and non-US company disclosures</li>
            </ul>
          </section>

          {/* Benchmarking Methodology */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white !mt-0 !mb-0">Benchmarking Engine</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Raw transaction data is transformed into actionable benchmarks through a multi-factor quantitative model that adjusts for the variables that matter most in deal structuring.
            </p>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Multi-Factor Regression</h3>
            <p className="text-slate-600 dark:text-slate-300">
              Our hedonic regression model scores each comparable transaction across multiple dimensions — therapeutic area, modality, clinical phase, territory scope, deal structure, and indication specificity. Transactions are weighted by recency: deals from the last 24 months carry twice the influence of older transactions, ensuring benchmarks reflect current market dynamics rather than historical norms.
            </p>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Monte Carlo Simulation</h3>
            <p className="text-slate-600 dark:text-slate-300">
              Every calculation runs 10,000 Monte Carlo iterations with scenario-weighted distributions — base case (50%), bear case (20%), and bull case (30%). This produces probability-adjusted ranges rather than single-point estimates, reflecting the inherent variability across different market conditions and negotiation outcomes.
            </p>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Risk-Adjusted NPV</h3>
            <p className="text-slate-600 dark:text-slate-300">
              rNPV analysis incorporates phase-specific probability of success rates, indication-specific modifiers (biomarker validation, regulatory precedent, competitive density, modality risk), and scenario bridges that quantify dollar-impact risks like competitor entry, payer restrictions, and label expansion potential.
            </p>
          </section>

          {/* Comparable Deal Matching */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white !mt-0 !mb-0">Semantic Deal Matching</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Traditional deal databases match on keywords — &quot;oncology&quot; finds oncology deals. Our platform goes further with semantic matching technology that understands the full context of each transaction.
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              Every deal in our database is represented as a high-dimensional vector encoding its complete profile — companies, asset characteristics, modality, indication, development phase, territory, deal economics, and strategic context. When you run a calculation, your inputs are similarly encoded and compared against every transaction using cosine similarity.
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              This means an &quot;oral GLP-1 receptor agonist for obesity at Phase 2&quot; query will surface deals like Zealand/Roche (petrelintide), Carmot/Roche (CT-388), and Structure/Roche (GSBR-1290) — even if the exact keywords don&apos;t overlap. The system finds deals that are structurally and strategically similar, not just categorically related.
            </p>
          </section>

          {/* Data Quality */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white !mt-0 !mb-0">Data Quality & Freshness</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Stale data produces misleading benchmarks. Our automated ingestion pipeline processes new regulatory filings and deal announcements multiple times per day, ensuring benchmarks reflect the latest market activity.
            </p>
            <div className="not-prose mt-6 space-y-3">
              {[
                { label: 'Confidence Threshold', desc: 'Every transaction is scored for extraction confidence. Deals below 75/100 are excluded from benchmarks — we prioritize accuracy over volume.' },
                { label: 'Source Verification', desc: 'Deals are cross-referenced against original source documents. Financial terms are only marked as disclosed when explicitly stated in filings or press releases.' },
                { label: 'Continuous Updates', desc: 'Our pipeline ingests from 10+ data sources on automated schedules — some hourly, some daily, some weekly — depending on source update frequency.' },
                { label: 'Deduplication', desc: 'Multi-key conflict resolution prevents the same deal from appearing twice, even when announced via different sources or amended in subsequent filings.' },
              ].map(item => (
                <div key={item.label} className="flex gap-3 p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                  <svg className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Understanding Benchmark Ranges */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white !mt-0 !mb-0">Understanding Benchmark Ranges</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Biopharma deal terms are not deterministic — they are the product of negotiation between parties with different leverage, information, and strategic objectives. Our benchmarks reflect this reality by providing ranges derived from the distribution of comparable transactions, not single-point predictions.
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              The ranges you see represent where similar deals have historically landed across different market conditions, competitive landscapes, and negotiation dynamics. They are designed to inform your deal strategy and provide data-driven anchor points for term sheet discussions — not to predict the exact outcome of any individual negotiation.
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              For definitive deal structuring, we recommend engaging qualified financial and legal advisors who can incorporate proprietary clinical data, specific IP considerations, and counterparty dynamics that quantitative models cannot fully capture.
            </p>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Link
            href="/calculator"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-semibold rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg"
          >
            Try the Calculator
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </main>
    </>
  );
}
