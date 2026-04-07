'use client';

import React, { useState } from 'react';
import { DEAL_STATS } from '@/lib/config/constants';

function MethodologySection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-6 sm:mt-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors group"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-navy-600 to-navy-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">How We Calculate These Estimates</span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="mt-2 px-4 sm:px-5 py-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          {/* Data Foundation */}
          <div className="mb-5">
            <h5 className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-2">Data Foundation</h5>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              All benchmarks are derived from <strong className="text-slate-700 dark:text-slate-200">{DEAL_STATS.TOTAL_DEALS} verified biopharma transactions</strong> sourced
              from SEC EDGAR 8-K filings, FTC premerger filings, public press releases, ClinicalTrials.gov, and FDA regulatory databases.
              Data is refreshed daily through automated ingestion pipelines that monitor 10+ sources. Each deal is verified against
              multiple sources before inclusion.
            </p>
          </div>

          {/* Valuation Methodology */}
          <div className="mb-5">
            <h5 className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-2">Valuation Methodology</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { title: 'Deal Terms Benchmark', desc: 'Percentile analysis (P25/P50/P75) across comparable transactions filtered by therapeutic area, modality, phase, and deal type.' },
                { title: 'Risk-Adjusted NPV', desc: 'Discounted cash flow model with phase-specific probability of success, modality-adjusted COGS, and TA-calibrated discount rates.' },
                { title: 'Monte Carlo Simulation', desc: '10,000 correlated iterations using Cholesky decomposition to capture real-world variable dependencies. Outputs VaR, CVaR, and distribution shape.' },
                { title: 'Scenario Analysis', desc: '30+ stress scenarios (regulatory, clinical, competitive, commercial, pricing) including compound events where multiple risks interact non-linearly.' },
                { title: 'Market Sizing', desc: 'Bottom-up epidemiology funnel (prevalence → diagnosed → treated → eligible) with territory pricing indices, validated against actual market data.' },
                { title: 'Real Options', desc: 'Cox-Ross-Rubinstein binomial lattice pricing each development phase as a compound option, capturing the value of flexibility at decision gates.' },
              ].map(item => (
                <div key={item.title} className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600/30">
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{item.title}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Key Calibration Sources */}
          <div className="mb-5">
            <h5 className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-2">Calibration Sources</h5>
            <div className="space-y-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              {[
                'BIO/Informa Clinical Development Success Rates (2011-2020, recalibrated with 2014-2023 data)',
                'Citeline/Norstella Phase Transition Analysis 2014-2023',
                'Tufts NEWDIGS Cell & Gene Therapy Success Rates (2024)',
                'FDA CDER Novel Drug Approvals (2021-2026)',
                'Damodaran Pharma/Biotech Industry WACC Analysis',
                'Deloitte "Measuring the Return from Pharmaceutical Innovation" (2025)',
                'EvaluatePharma World Preview Reports (2022-2026)',
                'DealForma Pharma Licensing Database (2020-2025) — correlation matrices',
              ].map(source => (
                <div key={source} className="flex items-start gap-1.5">
                  <span className="text-teal-500 mt-0.5">•</span>
                  <span>{source}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Coverage */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { value: '12', label: 'Therapeutic Areas' },
              { value: '70', label: 'Modalities Calibrated' },
              { value: '10', label: 'Financial Engines' },
              { value: DEAL_STATS.TOTAL_DEALS, label: 'Verified Deals' },
            ].map(stat => (
              <div key={stat.label} className="text-center p-2.5 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                <div className="text-base font-bold text-teal-600 dark:text-teal-400">{stat.value}</div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-3 text-xs">
            <a href="/methodology" className="text-teal-600 dark:text-teal-400 hover:underline">Full Methodology</a>
            <span className="text-slate-300 dark:text-slate-600">&bull;</span>
            <a href="/glossary" className="text-teal-600 dark:text-teal-400 hover:underline">Glossary</a>
            <span className="text-slate-300 dark:text-slate-600">&bull;</span>
            <a href="/terms" className="text-teal-600 dark:text-teal-400 hover:underline">Terms</a>
            <span className="text-slate-300 dark:text-slate-600">&bull;</span>
            <a href="/privacy" className="text-teal-600 dark:text-teal-400 hover:underline">Privacy</a>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsDisclaimerInner() {
  return (
    <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
        Benchmark ranges are calibrated against {DEAL_STATS.TOTAL_DEALS} verified transactions and reflect the market distribution for comparable deals.
        Individual outcomes depend on asset-specific factors, competitive dynamics, and negotiation leverage.
        For definitive deal structuring, engage qualified financial and legal advisors who can incorporate non-public factors.
      </p>
    </div>
  );
}

function ResultsDisclaimerWithMethodology() {
  return (
    <>
      <MethodologySection />
      <ResultsDisclaimerInner />
    </>
  );
}

const ResultsDisclaimer = React.memo(ResultsDisclaimerWithMethodology);
ResultsDisclaimer.displayName = 'ResultsDisclaimer';

export default ResultsDisclaimer;
