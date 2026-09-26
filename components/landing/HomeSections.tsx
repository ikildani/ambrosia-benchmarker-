// Server components: the marketing sections below the fold. They used to live
// inside a 1,000-line client component and were hydrated on every visit; now
// they are HTML with no JavaScript attached.
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { PRICING, ENGINE_COUNT } from '@/lib/config/constants';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';
import UseCaseCards from '@/components/landing/UseCaseCards';
import ComparisonTable from '@/components/landing/ComparisonTable';

export function HomeMiddle({ dealCount }: { dealCount: string }) {
  return (
    <>
      {/* How It Works Section */}
      <section id="how-it-works" className="py-10 sm:py-14 lg:py-18 xl:py-20 px-4 xl:px-6 bg-gradient-to-b from-slate-50 dark:from-slate-800 to-white dark:to-slate-900 scroll-mt-20 transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <div className="inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-500/20 border border-slate-200 dark:border-blue-600/30 rounded-full px-4 py-1.5 mb-6">
              <svg className="w-4 h-4 text-blue-700 dark:text-blue-400 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-sm font-medium text-blue-800 dark:text-blue-400">Simple Process</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-navy-800 dark:text-white mb-3 sm:mb-4">
              How It Works
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-neutral-600 dark:text-slate-400 max-w-2xl mx-auto">
              Get deal term estimates in three simple steps
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 xl:gap-10">
            {[
              {
                step: '1',
                title: 'Enter Asset Details',
                description: 'Select therapeutic area, development phase, modality, indication, and other key parameters for your asset.',
                icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
              },
              {
                step: '2',
                title: 'Analyze Market Data',
                description: 'Our algorithm processes your inputs against publicly available deal benchmarks and market data.',
                icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
              },
              {
                step: '3',
                title: 'Get Full Deal Intelligence',
                description: 'Receive instant estimates, rNPV analysis, Monte Carlo simulations, comparable deals, AI deal memos, partner matching, company profiles, and negotiation playbooks.',
                icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
              },
            ].map((item, idx) => (
              <div key={idx} className="relative group">
                {/* Connector line */}
                {idx < 2 && (
                  <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-slate-200 dark:from-blue-600/15 to-transparent" />
                )}
                <div className="bg-white dark:bg-slate-800 p-5 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-soft hover:shadow-soft-lg hover:border-slate-200 dark:hover:border-blue-600/50 transition-all duration-500 hover:-translate-y-2">
                  <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-soft flex-shrink-0">
                      {item.step}
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 dark:bg-slate-500/20 rounded-lg sm:rounded-xl flex items-center justify-center group-hover:bg-slate-100 dark:group-hover:bg-slate-500/30 transition-colors flex-shrink-0">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700 dark:text-blue-400 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold text-navy-800 dark:text-white mb-2 sm:mb-3">
                    {item.title}
                  </h3>
                  <p className="text-sm sm:text-base text-neutral-600 dark:text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-8 sm:mt-10 lg:mt-12">
            <Link
              href="/calculator"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-white dark:to-slate-100 text-white dark:text-slate-900 font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-xl
                       shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/15 transition-all duration-300 hover:-translate-y-0.5 w-full sm:w-auto text-sm sm:text-base"
            >
              <span>Start Your Analysis</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-10 sm:py-14 lg:py-18 xl:py-20 px-4 xl:px-6 bg-neutral-50 dark:bg-slate-800/50 transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <div className="inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-500/20 border border-slate-200 dark:border-blue-600/30 rounded-full px-4 py-1.5 mb-6">
              <svg className="w-4 h-4 text-blue-700 dark:text-blue-400 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-medium text-blue-800 dark:text-blue-400">21 Engines · 12 Therapeutic Areas</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-navy-800 dark:text-white mb-3 sm:mb-4">
              What Solidus Does
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-neutral-600 dark:text-slate-400 max-w-2xl mx-auto">
              Institutional-grade deal intelligence for biotech founders, BD executives, and life sciences investors
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 xl:gap-10">
            {[
              {
                icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                title: 'Deal Benchmarking',
                description: `Instant benchmarks from ${dealCount} primary-sourced deals across 12 therapeutic areas. Upfront payments, milestones, royalties, and comparable deal matching.`,
                gradient: 'from-slate-800 to-slate-900',
              },
              {
                icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
                title: 'Financial Modeling',
                description: 'Risk-adjusted NPV (rNPV) analysis and Monte Carlo simulation with 10,000 iterations. Model probability-weighted deal outcomes and scenario ranges.',
                gradient: 'from-blue-600 to-blue-800',
              },
              {
                icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
                title: 'Market Pulse',
                description: 'Weekly market intelligence with benchmark sparklines, deal flow trends, competitive landscape analysis, and market size & epidemiology data.',
                gradient: 'from-slate-600 to-slate-800',
              },
              {
                icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
                title: 'Company Intelligence',
                description: 'Deep profiles on 700+ pharma and biotech companies with deal history, pipeline tracking, patent cliff timelines, and intelligent partner matching.',
                gradient: 'from-slate-700 to-slate-900',
              },
              {
                icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
                title: 'Deal Toolkit',
                description: 'AI deal memos, negotiation playbooks, sensitivity analysis, scenario comparison, outreach email generation, and 20-page branded PDF reports.',
                gradient: 'from-slate-700 to-slate-900',
              },
              {
                icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
                title: 'Enterprise-Grade Platform',
                description: 'GDPR-compliant data handling, authenticated APIs, rate-limited endpoints, WCAG-accessible interface, and daily SEC EDGAR + FTC pre-merger data ingestion.',
                gradient: 'from-slate-500 to-slate-700',
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="group bg-white dark:bg-slate-800 p-5 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-soft hover:shadow-soft-lg hover:border-slate-200 dark:hover:border-blue-600/50 transition-all duration-500 hover:-translate-y-2"
              >
                <div className={`w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br ${feature.gradient} rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-5 lg:mb-6 shadow-soft group-hover:scale-110 group-hover:shadow-glow transition-all duration-300`}>
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-navy-800 dark:text-white mb-2 sm:mb-3 group-hover:text-blue-800 dark:group-hover:text-blue-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base text-neutral-600 dark:text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Case Cards */}
      <UseCaseCards />

      {/* Comparison Table */}
      <ComparisonTable />

      {/* Partner Discovery Preview Section */}
      <section className="py-10 sm:py-12 lg:py-16 xl:py-18 px-4 xl:px-6 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 transition-colors duration-300">
        <div className="max-w-5xl xl:max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 bg-slate-50 dark:bg-blue-900/20 border border-slate-200 dark:border-blue-600/30 rounded-full px-4 py-1.5 mb-4">
              <svg className="w-4 h-4 text-blue-700 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm font-medium text-blue-800 dark:text-blue-400">AI Partner Matching</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-navy-800 dark:text-white mb-3">
              Find Your Ideal Licensing Partner
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Our AI matches your asset profile against 700+ pharma and biotech companies to find the best strategic fit
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl xl:max-w-4xl mx-auto mb-8">
            {[
              { name: 'Major Pharma Co.', score: 92, focus: 'Oncology, ADC expertise', deals: '12 deals in 12mo' },
              { name: 'Global BioPharma', score: 87, focus: 'Late-stage licensing', deals: '8 deals in 12mo' },
              { name: 'Specialty Pharma', score: 84, focus: 'Niche indications', deals: '6 deals in 12mo' },
            ].map((partner, idx) => (
              <div key={idx} className="relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-soft overflow-hidden">
                <div className="absolute inset-0 backdrop-blur-[2px] bg-white/40 dark:bg-slate-800/40 z-10 flex items-center justify-center">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-700/80 px-3 py-1 rounded-full">Run analysis to reveal</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700" />
                  <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{partner.score}%</span>
                </div>
                <div className="font-semibold text-sm text-slate-800 dark:text-white mb-1">{partner.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{partner.focus}</div>
                <div className="text-xs text-blue-700 dark:text-blue-400 dark:text-blue-400 mt-1">{partner.deals}</div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/calculator"
              className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-semibold px-8 py-4 rounded-xl shadow-xl shadow-slate-900/15 hover:shadow-2xl hover:shadow-slate-900/20 transition-all duration-300 hover:-translate-y-1 text-sm sm:text-base"
            >
              <span>See Your Partner Matches</span>
              <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Advanced Analytics Section */}
      <section className="py-10 sm:py-14 lg:py-18 xl:py-20 px-4 xl:px-6 bg-white dark:bg-slate-900 transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-12 lg:mb-16">
            <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 rounded-full px-4 py-1.5 mb-6">
              <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400">Advanced Analytics</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-navy-800 dark:text-white mb-3 sm:mb-4">
              Beyond Benchmarks
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-neutral-600 dark:text-slate-400 max-w-2xl mx-auto">
              Full financial modeling and market intelligence tools that turn data into deal strategy
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {/* rNPV & Monte Carlo */}
            <div className="group bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/50 p-6 sm:p-8 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-soft hover:shadow-soft-lg hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-all duration-500 hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-soft">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white">rNPV & Monte Carlo Simulation</h3>
              </div>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-slate-400 leading-relaxed mb-4">
                Risk-adjusted net present value analysis with 10,000-iteration Monte Carlo simulation. Model probability-weighted deal outcomes across development phases, regulatory milestones, and commercial scenarios.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Phase-gated probabilities', 'Confidence intervals', 'Scenario ranges', 'Waterfall charts'].map((tag) => (
                  <span key={tag} className="text-xs px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full">{tag}</span>
                ))}
              </div>
            </div>

            {/* Market Pulse */}
            <div className="group bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/50 p-6 sm:p-8 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-soft hover:shadow-soft-lg hover:border-slate-200 dark:hover:border-blue-600/50 transition-all duration-500 hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white shadow-soft">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white">Market Pulse Intelligence</h3>
              </div>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-slate-400 leading-relaxed mb-4">
                Real-time market intelligence dashboard with benchmark sparklines, deal flow trends by modality, competitive landscape analysis, and market size & epidemiology data across therapeutic areas.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Benchmark trends', 'Deal flow charts', 'Competitive landscape', 'Market sizing'].map((tag) => (
                  <span key={tag} className="text-xs px-2.5 py-1 bg-slate-50 dark:bg-slate-500/10 text-blue-700 dark:text-blue-400 dark:text-blue-400 rounded-full">{tag}</span>
                ))}
              </div>
            </div>

            {/* Company Intelligence */}
            <div className="group bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/50 p-6 sm:p-8 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-soft hover:shadow-soft-lg hover:border-slate-300 dark:hover:border-blue-600/50 transition-all duration-500 hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white shadow-soft">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white">Company Profiles & Pipeline</h3>
              </div>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-slate-400 leading-relaxed mb-4">
                Deep profiles on 700+ pharma and biotech companies with historical deal flow, active pipeline tracking from ClinicalTrials.gov, patent cliff timelines, and strategic fit scoring.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Deal history', 'Pipeline tracker', 'Patent cliffs', 'Strategic fit scores'].map((tag) => (
                  <span key={tag} className="text-xs px-2.5 py-1 bg-slate-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 rounded-full">{tag}</span>
                ))}
              </div>
            </div>

            {/* AI Deal Tools */}
            <div className="group bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/50 p-6 sm:p-8 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-soft hover:shadow-soft-lg hover:border-emerald-200 dark:hover:border-emerald-500/50 transition-all duration-500 hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white shadow-soft">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white">Advanced Deal Intelligence</h3>
              </div>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-slate-400 leading-relaxed mb-4">
                Institutional-grade deal memos, negotiation playbooks with counterparty-specific tactics, outreach email templates, and 20-page branded PDF reports — all customized to your specific asset and market position.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Deal memos', 'Negotiation playbooks', 'Outreach emails', 'Deal reports'].map((tag) => (
                  <span key={tag} className="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Authority Section */}
      <section className="py-10 sm:py-12 lg:py-16 xl:py-18 px-4 xl:px-6 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(14, 165, 165, 0.5) 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>
        <div className="max-w-4xl xl:max-w-5xl mx-auto relative text-center">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-3 sm:mb-4">Primary-Source Verified Data</h2>
          <p className="text-neutral-300 text-sm sm:text-base max-w-2xl mx-auto mb-8 leading-relaxed">
            Solidus is built on {dealCount} primary-sourced biopharma transactions — every row cites a regulatory filing or an issuer release. No secondary data. No scraped estimates. Updated daily.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 xl:gap-8">
            {[
              { icon: '📄', label: 'SEC EDGAR Filings', desc: '8-K and 10-K deal data extracted from regulatory filings' },
              { icon: '⚖️', label: 'FTC Pre-Merger', desc: 'Hart-Scott-Rodino filings and merger review actions' },
              { icon: '🔬', label: 'ClinicalTrials.gov', desc: 'Pipeline and trial data for partner intelligence' },
              { icon: '📰', label: 'Press Releases', desc: 'GlobeNewsWire, BusinessWire, PRNewswire — daily ingestion' },
            ].map((source, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-5 text-left">
                <div className="text-2xl mb-2">{source.icon}</div>
                <div className="text-white font-semibold text-sm mb-1">{source.label}</div>
                <div className="text-neutral-400 text-xs">{source.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans Overview */}
      <section id="pricing" className="py-20 px-4 bg-[#080d16] border-t border-white/5 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Choose Your Plan</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Price a single asset, map an entire landscape, or run your full pipeline.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {/* Deal Intelligence Brief */}
            <Link
              href="/brief"
              className="group relative bg-gradient-to-b from-teal-500/[0.03] to-[#0d1420] border border-teal-500/20 rounded-2xl p-7 hover:border-teal-500/40 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#080d16] bg-teal-500 rounded-full">Concierge</span>
              </div>
              <div className="flex items-center justify-between mb-5">
                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 rounded-full border border-teal-500/20">One-Time</span>
                <span className="text-2xl font-bold text-white font-mono">$2,500</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Intelligence Brief</h3>
              <p className="text-xs text-slate-500 mb-1 font-medium text-teal-400/70">Map the landscape</p>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">One asset, one scored recommendation, about 30 data-backed pages. Invoiced at intake; credited in full against a subsequent advisory mandate.</p>
              <ul className="space-y-2 mb-5">
                {['A signed recommendation: ask, floor, walk-away', 'Cited comparables and evidence-ranked buyers', 'Managing Partner review + 30-minute walkthrough', 'Within 24 hours of the intake call'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Check className="w-3 h-3 text-teal-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-400 group-hover:text-teal-300 transition-colors">
                Configure Brief <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>

            {/* Pro */}
            <Link
              href="/pro"
              className="group relative bg-gradient-to-b from-teal-500/[0.04] to-[#0d1420] border border-teal-500/20 rounded-2xl p-8 hover:border-teal-500/40 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#080d16] bg-teal-500 rounded-full">Most Popular</span>
              </div>
              <div className="flex items-center justify-between mb-6">
                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 rounded-full border border-teal-500/20">Subscription</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-white font-mono">{PRICING.PRO_PRICE}</span>
                  <span className="text-xs text-slate-500">/mo</span>
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Pro — Unlimited Access</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">Unlimited calculations, all {ENGINE_COUNT} engines, partner matching, and export. For teams running multiple deals.</p>
              <ul className="space-y-2 mb-6">
                {['Everything in Report, unlimited', 'Buyer-specific valuation (3 partners)', 'Pharma Intent Score (10-factor)', 'Tornado + compound scenarios'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-xs text-slate-400">
                    <Check className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-400 group-hover:text-teal-300 transition-colors">
                View Pro details <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </div>
        </div>
      </section>

    </>
  );
}

export function HomeGuides({ dealCount }: { dealCount: string }) {
  return (
    <>
      {/* Featured Guides */}
      <section className="py-20 px-4 bg-slate-950 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">
              Deal Intelligence Guides
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              In-depth resources for BD teams, deal committees, and licensing professionals — backed by data from {dealCount} primary-sourced transactions.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { href: '/guides/biopharma-licensing-benchmarks', title: 'Biopharma Licensing Benchmarks 2026', desc: 'Upfront, milestone, and royalty benchmarks by phase, modality, and TA', tag: 'Data' },
              { href: '/guides/rnpv-biotech-valuation', title: 'rNPV Biotech Valuation Guide', desc: 'Phase transition probabilities, cash flow modeling, and Monte Carlo enhancement', tag: 'Methodology' },
              { href: '/guides/negotiate-pharma-royalty-rates', title: 'Pharma Royalty Rate Benchmarks', desc: 'Royalty rates by phase and modality with negotiation strategies', tag: 'Benchmarks' },
              { href: '/guides/life-sciences-deal-calculator-guide', title: 'Solidus Platform Guide', desc: `${ENGINE_COUNT} engines, 12 therapeutic areas, 23+ modalities — how to use the platform`, tag: 'Tutorial' },
              { href: '/guides/biotech-licensing-deal-structure', title: 'Deal Structure Guide', desc: 'Upfront, milestone, and royalty allocation by deal type and stage', tag: 'Strategy' },
              { href: '/guides/how-to-value-biotech-deal', title: 'How to Value a Biotech Deal', desc: 'Step-by-step using comparables, rNPV, and Monte Carlo simulation', tag: 'Valuation' },
              { href: '/guides/monte-carlo-biotech-valuation', title: 'Monte Carlo Biotech Valuation', desc: '10,000-iteration stochastic modeling with correlated variables and phase-dependent risk', tag: 'Methodology' },
            ].map(guide => (
              <Link
                key={guide.href}
                href={guide.href}
                className="group bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.06] hover:border-teal-500/30 transition-all duration-300"
              >
                <span className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-400 bg-teal-500/10 rounded mb-3">{guide.tag}</span>
                <h3 className="text-sm font-semibold text-white group-hover:text-teal-400 transition-colors mb-2">{guide.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{guide.desc}</p>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/guides" className="text-sm text-teal-400 hover:text-teal-300 font-medium transition-colors">
              View all guides →
            </Link>
          </div>
        </div>
      </section>

    </>
  );
}

export function HomeAbout() {
  return (
    <>
      {/* About Section */}
      <section id="about" className="py-10 sm:py-14 lg:py-18 xl:py-20 px-4 xl:px-6 bg-white dark:bg-slate-900 scroll-mt-20 transition-colors duration-300">
        <div className="max-w-4xl xl:max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-navy-50 dark:bg-navy-500/20 border border-navy-200 dark:border-navy-500/30 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 mb-4 sm:mb-6">
            <span className="text-xs sm:text-sm font-medium text-navy-700 dark:text-navy-300">About Us</span>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-navy-800 dark:text-white mb-4 sm:mb-6">
            Ambrosia Ventures
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-neutral-600 dark:text-slate-400 mb-6 sm:mb-8 lg:mb-10 leading-relaxed px-2">
            A boutique strategy and M&A advisory firm specializing in life sciences.
            We help biotech companies, pharmaceutical corporate development teams, and investors
            navigate licensing deals, M&A transactions, and strategic partnerships.
          </p>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-10 lg:mb-12">
            {['Licensing Strategy', 'M&A Advisory', 'In/Out-Licensing', 'Deal Structuring', 'Valuation'].map((service, idx) => (
              <span
                key={idx}
                className="px-3 sm:px-5 py-2 sm:py-2.5 bg-neutral-50 dark:bg-slate-800 rounded-lg sm:rounded-xl text-navy-700 dark:text-slate-300 text-xs sm:text-sm font-medium border border-neutral-200 dark:border-slate-700
                         hover:bg-slate-50 dark:hover:bg-slate-500/20 hover:border-slate-200 dark:hover:border-blue-600/50 hover:text-blue-800 dark:hover:text-blue-400 transition-all duration-300 cursor-default"
              >
                {service}
              </span>
            ))}
          </div>
          <a
            href="https://www.ambrosiaventures.co"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary group"
          >
            Visit Our Website
            <svg className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-900 text-neutral-400 py-10 sm:py-12 lg:py-16 xl:py-20 px-4 xl:px-6">
        <div className="max-w-6xl xl:max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-6 sm:gap-8 pb-8 sm:pb-12 border-b border-navy-800">
            <div className="flex items-center">
              <AmbrosiaLogo variant="reversed" height={32} />
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 lg:gap-8 text-xs sm:text-sm">
              {[
                { label: 'Website', href: 'https://www.ambrosiaventures.co', external: true },
                { label: 'Contact', href: '/contact', external: false },
                { label: 'LinkedIn', href: 'https://www.linkedin.com/company/ambrosia-ventures', external: true },
                { label: 'Benchmarks', href: '/benchmarks', external: false },
                { label: 'Guides', href: '/guides', external: false },
                { label: 'Glossary', href: '/glossary', external: false },
                { label: 'Therapeutic Areas', href: '/therapeutic-areas', external: false },
                { label: 'Deal Tracker', href: '/tracker', external: false },
                { label: 'Reports', href: '/reports', external: false },
                { label: 'Terms', href: '/terms', external: false },
                { label: 'Privacy', href: '/privacy', external: false },
              ].map((link, idx) => (
                link.external ? (
                  <a
                    key={idx}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-400 transition-colors duration-300 relative group"
                  >
                    {link.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-500 group-hover:w-full transition-all duration-300" />
                  </a>
                ) : (
                  <Link
                    key={idx}
                    href={link.href}
                    className="hover:text-blue-400 transition-colors duration-300 relative group"
                  >
                    {link.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-500 group-hover:w-full transition-all duration-300" />
                  </Link>
                )
              ))}
            </nav>
          </div>
          {/* Disclaimer */}
          <div className="pt-6 sm:pt-8 pb-6 sm:pb-8 border-b border-navy-800">
            <div className="flex items-start gap-3 p-4 sm:p-5 bg-navy-800/50 rounded-xl border border-navy-700">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-navy-700 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-neutral-300 mb-1.5">Important Disclaimer</h4>
                <p className="text-xs text-neutral-400 leading-relaxed mb-2">
                  <strong className="text-neutral-300">For Informational Purposes Only:</strong> These estimates are generated
                  using publicly available deal data, industry benchmarks, and algorithmic models. They are intended solely
                  for educational and planning purposes.
                </p>
                <p className="text-xs text-neutral-400 leading-relaxed mb-2">
                  <strong className="text-neutral-300">Not Professional Advice:</strong> This tool does not constitute financial,
                  legal, investment, or professional advice of any kind. Actual deal terms can vary significantly (often by
                  50% or more) based on asset-specific factors, competitive dynamics, market conditions, negotiation leverage,
                  and numerous other variables not captured by this model.
                </p>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  <strong className="text-neutral-300">Consult Professionals:</strong> Before making any business decisions,
                  consult qualified financial advisors, legal counsel, and industry experts familiar with your specific situation.
                  <Link href="/terms" className="text-blue-400 hover:text-blue-300 ml-1 underline">Terms</Link>
                  {' '}&bull;{' '}
                  <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">Privacy</Link>
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
            <p className="text-xs sm:text-sm">
              &copy; {new Date().getFullYear()} Ambrosia Ventures. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
