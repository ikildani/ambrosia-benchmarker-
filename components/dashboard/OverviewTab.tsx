import React from 'react';
import { formatDate, type CalculationHistoryItem } from '@/lib/history';
import ActivityHeatmap from './ActivityHeatmap';
import InsightsSummary from './InsightsSummary';
import type { UserTier } from '@/types/tier';

interface OverviewTabProps {
  history: CalculationHistoryItem[];
  recentCalculations: CalculationHistoryItem[];
  topPhase: string;
  topModality: string;
  tier: UserTier;
  onNavigateToCalculator: () => void;
  onUpgrade: () => void;
  onHistoryClick: (item: CalculationHistoryItem) => void;
  formatCurrency: (value: number) => string;
}

const OverviewTab = React.memo(function OverviewTab({
  history,
  recentCalculations,
  topPhase,
  topModality,
  tier,
  onNavigateToCalculator,
  onUpgrade,
  onHistoryClick,
  formatCurrency,
}: OverviewTabProps) {
  // Compute last calculation date
  const lastCalculationDate = history.length > 0
    ? formatDate(history[0].timestamp)
    : null;

  // Compute most-used therapeutic area
  const topTherapeuticArea = React.useMemo(() => {
    if (history.length === 0) return '-';
    const counts: Record<string, number> = {};
    history.forEach(h => {
      const ta = h.inputs.therapeuticArea || 'other';
      counts[ta] = (counts[ta] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top = sorted[0]?.[0] || '-';
    return top.charAt(0).toUpperCase() + top.slice(1);
  }, [history]);
  return (
    <div className="space-y-6">
      {/* Deal Insights - Full Width */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Your Deal Insights</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Analytics from your deal calculations</p>
          </div>
        </div>

        {history.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            <div className="p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-lg sm:rounded-xl border border-blue-200/50">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium text-blue-800">Total Analyses</span>
              </div>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-800">{history.length}</p>
            </div>

            <div className="p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-cyan-50 to-cyan-100/50 rounded-lg sm:rounded-xl border border-cyan-200/50">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-medium text-cyan-700 truncate">Total Value</span>
              </div>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-cyan-700">
                {formatCurrency(history.reduce((sum, h) => sum + h.results.totalValueMedian, 0))}
              </p>
            </div>

            <div className="p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg sm:rounded-xl border border-blue-200/50">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span className="text-xs font-medium text-blue-700 truncate">Top Phase</span>
              </div>
              <p className="text-sm sm:text-lg lg:text-xl font-bold text-blue-700 truncate">
                {topPhase}
              </p>
            </div>

            <div className="p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-lg sm:rounded-xl border border-indigo-200/50">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span className="text-xs font-medium text-indigo-700 truncate">Top Modality</span>
              </div>
              <p className="text-sm sm:text-lg lg:text-xl font-bold text-indigo-700 truncate">
                {topModality}
              </p>
            </div>

            <div className="p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-lg sm:rounded-xl border border-amber-200/50">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span className="text-xs font-medium text-amber-700 truncate">Top TA</span>
              </div>
              <p className="text-sm sm:text-lg lg:text-xl font-bold text-amber-700 truncate">
                {topTherapeuticArea}
              </p>
            </div>

            <div className="p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-lg sm:rounded-xl border border-emerald-200/50">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-medium text-emerald-700 truncate">Last Analysis</span>
              </div>
              <p className="text-sm sm:text-lg lg:text-xl font-bold text-emerald-700 truncate">
                {lastCalculationDate || 'None yet'}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">No deal insights yet</h4>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Run your first calculation to see analytics here</p>
            <button
              onClick={onNavigateToCalculator}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-medium rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg shadow-slate-900/15 dark:shadow-blue-400/10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Run Your First Analysis
            </button>
          </div>
        )}
      </div>

      {/* Activity Heatmap */}
      <ActivityHeatmap history={history} />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Stats Cards */}
      <div className="md:col-span-2 lg:col-span-2 grid sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-sm sm:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Subscription</h3>
            {tier === 'free' && (
              <button
                onClick={onUpgrade}
                className="text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors"
              >
                Upgrade to Pro
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              (tier === 'pro' || tier === 'report' || tier === 'portfolio')
                ? 'bg-gradient-to-br from-slate-800 to-slate-900 shadow-lg shadow-slate-900/15 dark:shadow-blue-400/10'
                : 'bg-slate-100 dark:bg-slate-700'
            }`}>
              <svg className={`w-6 h-6 ${(tier === 'pro' || tier === 'report' || tier === 'portfolio') ? 'text-white' : 'text-slate-500 dark:text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{tier === 'pro' ? 'Pro Plan' : tier === 'report' ? 'Report Access' : 'Free Plan'}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {(tier === 'pro' || tier === 'report' || tier === 'portfolio')
                  ? 'Full access to all features'
                  : 'Limited to 2 calculations per month'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Insights - Full Width */}
      <div className="md:col-span-2 lg:col-span-3">
        <InsightsSummary history={history} />
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">Recent Activity</h3>
        {recentCalculations.length > 0 ? (
          <div className="space-y-4">
            {recentCalculations.map((item) => (
              <div
                key={item.id}
                onClick={() => onHistoryClick(item)}
                onKeyDown={(e) => e.key === 'Enter' && onHistoryClick(item)}
                role="button"
                tabIndex={0}
                aria-label={`View ${item.labels.phase} ${item.labels.modality} calculation from ${formatDate(item.timestamp)}`}
                className="flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-700 last:border-0 last:pb-0
                           cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-2 px-2 py-2 rounded-lg transition-all duration-200
                           focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-800 group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/30 transition-colors">
                  <svg className="w-4 h-4 text-slate-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {item.labels.phase} • {item.labels.modality}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(item.timestamp)}
                  </p>
                </div>
                <svg className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">No calculations yet</p>
            <button
              onClick={onNavigateToCalculator}
              className="mt-3 text-sm font-medium text-slate-900 dark:text-white hover:text-blue-800 dark:hover:text-blue-300"
            >
              Start your first calculation
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  );
});

export default OverviewTab;
