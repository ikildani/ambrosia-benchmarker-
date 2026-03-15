'use client';

import React, { useState } from 'react';
import { DEAL_STATS } from '@/lib/config/constants';

function MethodologySection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-6 sm:mt-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors group"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">How we calculate these estimates</span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="mt-2 px-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              Our engine uses <strong className="text-slate-700 dark:text-slate-200">weighted least squares regression</strong> on 350+ verified
              biopharma deals, with phase-adjusted multipliers calibrated to real M&A and licensing data from 2020 to 2026.
            </p>
            <p>
              Each estimate is cross-validated using <strong className="text-slate-700 dark:text-slate-200">risk-adjusted NPV models</strong>,
              Monte Carlo simulations, and comparable transaction analysis. Therapeutic area-specific factors (mechanism novelty,
              competitive landscape, regulatory pathway) are applied as multiplicative adjustments to base deal ranges.
            </p>
            <p>
              Data is sourced from SEC EDGAR 8-K filings, company press releases, ClinicalTrials.gov, and FDA Orange Book.
              Benchmarks are refreshed daily. All ranges represent the 25th to 75th percentile of comparable transactions.
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              See our <a href="/glossary" className="text-teal-600 dark:text-teal-400 hover:underline">Glossary</a> for definitions of key terms.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsDisclaimerInner() {
  return (
    <div className="mt-6 sm:mt-8 p-4 sm:p-5 bg-gradient-to-br from-slate-100 to-neutral-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-neutral-200 dark:border-slate-700">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Important Disclaimer</h4>
          <p className="text-xs text-slate-500 leading-relaxed mb-2">
            <strong className="text-slate-600">For Informational Purposes Only:</strong> These estimates are generated
            using publicly available deal data, industry benchmarks, and algorithmic models. They are intended solely
            for educational and planning purposes.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed mb-2">
            <strong className="text-slate-600">Not Professional Advice:</strong> This tool does not constitute financial,
            legal, investment, or professional advice of any kind. Actual deal terms can vary significantly (often by
            50% or more) based on asset-specific factors, competitive dynamics, market conditions, negotiation leverage,
            and numerous other variables not captured by this model.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            <strong className="text-slate-600">Consult Professionals:</strong> Before making any business decisions,
            consult qualified financial advisors, legal counsel, and industry experts familiar with your specific situation.
            <a href="/terms" className="text-teal-600 hover:text-teal-700 ml-1 underline">Terms</a>
            {' '}&bull;{' '}
            <a href="/privacy" className="text-teal-600 hover:text-teal-700 underline">Privacy</a>
          </p>
          <p className="text-xs text-slate-500 leading-relaxed mt-2">
            <strong className="text-slate-600">Data Sources:</strong> Deal benchmarks derived from {DEAL_STATS.TOTAL_DEALS} publicly
            disclosed transactions. Data refreshed daily from SEC EDGAR 8-K filings, ClinicalTrials.gov, and FDA Orange Book.
          </p>
        </div>
      </div>
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
