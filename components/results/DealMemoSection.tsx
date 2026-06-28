import React from 'react';
import type { DealMemo } from '@/lib/ai/deal-memo-generator';
import { PRICING } from '@/lib/config/constants';

interface DealMemoSectionProps {
  hasFullAccess: boolean;
  dealMemo: DealMemo | null;
  memoLoading: boolean;
  memoError: string | null;
  onGenerateMemo: () => void;
  onBuyReport?: () => void;
}

function DealMemoSectionInner({
  hasFullAccess,
  dealMemo,
  memoLoading,
  memoError,
  onGenerateMemo,
  onBuyReport,
}: DealMemoSectionProps) {
  return (
    <div className="mt-6 sm:mt-8">
      {hasFullAccess ? (
        <div className="border border-purple-200 dark:border-purple-800/50 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
          <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-b border-purple-200 dark:border-purple-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-soft">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-200">Deal Memo</h3>
                  <p className="text-xs text-purple-600 dark:text-purple-400">Board-ready analysis by Ambrosia AI</p>
                </div>
              </div>
              {!dealMemo && !memoLoading && (
                <button
                  onClick={onGenerateMemo}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-semibold rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all shadow-soft"
                >
                  Generate Memo
                </button>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {memoLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-2 border-purple-200 dark:border-purple-800" />
                    <div className="absolute inset-0 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                  </div>
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Generating deal memo...</p>
                  <p className="text-xs text-neutral-500 dark:text-slate-500">Analyzing asset profile, comps, and market dynamics</p>
                </div>
              </div>
            )}

            {memoError && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">{memoError}</p>
                <button onClick={onGenerateMemo} className="mt-2 text-sm text-red-600 dark:text-red-400 underline">
                  Try again
                </button>
              </div>
            )}

            {dealMemo && (
              <div className="space-y-5">
                {/* Executive Summary */}
                {dealMemo.executive_summary && (
                <div>
                  <h4 className="text-sm font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-2">Executive Summary</h4>
                  <p className="text-sm text-neutral-800 dark:text-slate-200 leading-relaxed">{dealMemo.executive_summary}</p>
                </div>
                )}

                {/* Valuation Rationale */}
                {dealMemo.valuation_rationale && (
                <div>
                  <h4 className="text-sm font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-2">Valuation Rationale</h4>
                  <p className="text-sm text-neutral-700 dark:text-slate-300 leading-relaxed">{dealMemo.valuation_rationale}</p>
                </div>
                )}

                {/* Market Context */}
                {dealMemo.market_context && (
                <div>
                  <h4 className="text-sm font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-2">Market Context</h4>
                  <p className="text-sm text-neutral-700 dark:text-slate-300 leading-relaxed">{dealMemo.market_context}</p>
                </div>
                )}

                {/* Risk Factors + Negotiation Priorities side by side */}
                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                  {Array.isArray(dealMemo.risk_factors) && dealMemo.risk_factors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-2">Key Risks</h4>
                    <ul className="space-y-1.5">
                      {dealMemo.risk_factors.map((risk, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-slate-300">
                          <span className="text-amber-500 mt-0.5 flex-shrink-0">&#9679;</span>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                  )}
                  {Array.isArray(dealMemo.negotiation_priorities) && dealMemo.negotiation_priorities.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-2">Negotiation Priorities</h4>
                    <ul className="space-y-1.5">
                      {dealMemo.negotiation_priorities.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-slate-300">
                          <span className="text-teal-500 mt-0.5 flex-shrink-0">&#9679;</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  )}
                </div>

                {/* Comparable Analysis */}
                {dealMemo.comparable_analysis && (
                <div>
                  <h4 className="text-sm font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-2">Comparable Deal Analysis</h4>
                  <p className="text-sm text-neutral-700 dark:text-slate-300 leading-relaxed">{dealMemo.comparable_analysis}</p>
                </div>
                )}

                {/* Confidence */}
                {dealMemo.confidence_level && (
                <div className="flex items-center gap-2 pt-2 border-t border-neutral-200 dark:border-slate-700">
                  <span className="text-xs text-neutral-500 dark:text-slate-400">Confidence:</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    dealMemo.confidence_level === 'high' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                    dealMemo.confidence_level === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {dealMemo.confidence_level.toUpperCase()}
                  </span>
                </div>
                )}
              </div>
            )}

            {!dealMemo && !memoLoading && !memoError && (
              <div className="text-center py-8">
                <p className="text-sm text-neutral-500 dark:text-slate-400">
                  Click &quot;Generate Memo&quot; to create a comprehensive deal analysis for your asset profile.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Free tier teaser */
        <div className="relative">
          <div className="border border-purple-200 dark:border-purple-800/50 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
            <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-b border-purple-200 dark:border-purple-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-soft">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-200">Deal Memo</h3>
                  <p className="text-xs text-purple-600 dark:text-purple-400">Board-ready analysis by Ambrosia AI</p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              {/* Blurred preview */}
              <div className="filter blur-sm select-none pointer-events-none space-y-3">
                <div className="h-4 bg-neutral-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-4 bg-neutral-200 dark:bg-slate-700 rounded w-full" />
                <div className="h-4 bg-neutral-200 dark:bg-slate-700 rounded w-5/6" />
                <div className="h-12 bg-neutral-100 dark:bg-slate-700/50 rounded-lg mt-4" />
                <div className="h-4 bg-neutral-200 dark:bg-slate-700 rounded w-2/3" />
                <div className="h-4 bg-neutral-200 dark:bg-slate-700 rounded w-full" />
              </div>
            </div>
          </div>
          {/* Overlay CTA */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
            <div className="text-center px-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-neutral-800 dark:text-white mb-1">Deal Memo</h4>
              <p className="text-sm text-neutral-600 dark:text-slate-300 mb-4 max-w-xs">
                Get an deal analysis with executive summary, risk factors, and negotiation priorities.
              </p>
              <button
                onClick={() => onBuyReport?.()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all shadow-soft"
              >
                Get Full Report — {PRICING.REPORT_PRICE}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DealMemoSection = React.memo(DealMemoSectionInner);
DealMemoSection.displayName = 'DealMemoSection';

export default DealMemoSection;
export type { DealMemoSectionProps };
