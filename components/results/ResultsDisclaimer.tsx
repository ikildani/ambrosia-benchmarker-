import React from 'react';
import { DEAL_STATS } from '@/lib/config/constants';

function ResultsDisclaimerInner() {
  return (
    <div className="mt-6 sm:mt-8 p-4 sm:p-5 bg-gradient-to-br from-slate-100 to-neutral-100 rounded-xl border border-neutral-200">
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

const ResultsDisclaimer = React.memo(ResultsDisclaimerInner);
ResultsDisclaimer.displayName = 'ResultsDisclaimer';

export default ResultsDisclaimer;
