'use client';

import type { DealFlowForecast } from '@/lib/financial/types';

interface DealFlowForecastPanelProps {
  forecast?: DealFlowForecast;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

const sentimentConfig: Record<
  string,
  { label: string; emoji: string; className: string }
> = {
  hot: {
    label: 'Hot',
    emoji: '',
    className:
      'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30',
  },
  warm: {
    label: 'Warm',
    emoji: '',
    className:
      'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  },
  neutral: {
    label: 'Neutral',
    emoji: '',
    className:
      'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-500',
  },
  cooling: {
    label: 'Cooling',
    emoji: '',
    className:
      'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  },
};

const trendConfig: Record<string, { arrow: string; label: string; color: string }> = {
  accelerating: {
    arrow: 'M5 10l7-7m0 0l7 7m-7-7v18',
    label: 'Accelerating',
    color: 'text-green-600 dark:text-green-400',
  },
  stable: {
    arrow: 'M4 12h16',
    label: 'Stable',
    color: 'text-slate-600 dark:text-slate-400',
  },
  decelerating: {
    arrow: 'M19 14l-7 7m0 0l-7-7m7 7V3',
    label: 'Decelerating',
    color: 'text-red-600 dark:text-red-400',
  },
};

export default function DealFlowForecastPanel({
  forecast,
  tier,
  onUpgrade,
  onBuyReport,
}: DealFlowForecastPanelProps) {
  if (!forecast) return null;

  const hasAccess = tier === 'pro' || tier === 'report';
  const fc = forecast;

  const sentiment = sentimentConfig[fc.marketSentiment] || sentimentConfig.neutral;
  const trend = trendConfig[fc.trend] || trendConfig.stable;

  // Combine historical and forecast for the bar chart
  const allQuarters = [
    ...fc.historicalQuarters.map((q) => ({
      quarter: q.quarter,
      count: q.dealCount,
      type: 'historical' as const,
    })),
    ...fc.forecast.map((q) => ({
      quarter: q.quarter,
      count: q.predictedDeals,
      type: 'forecast' as const,
    })),
  ];

  // Take last 4 historical + next 4 forecast
  const historicalSlice = allQuarters
    .filter((q) => q.type === 'historical')
    .slice(-4);
  const forecastSlice = allQuarters
    .filter((q) => q.type === 'forecast')
    .slice(0, 4);
  const displayQuarters = [...historicalSlice, ...forecastSlice];
  const maxCount = Math.max(...displayQuarters.map((q) => q.count), 1);

  return (
    <div className="relative mt-6 sm:mt-8">
      <div className="rounded-xl bg-gradient-to-r from-violet-400 to-indigo-400 p-[1px]">
        <div
          className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !hasAccess ? 'select-none' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-soft flex-shrink-0">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  Deal Flow Forecast
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  {fc.therapeuticArea.charAt(0).toUpperCase() +
                    fc.therapeuticArea.slice(1)}{' '}
                  deal activity &amp; outlook
                </p>
              </div>
            </div>

            {/* Market Sentiment Badge */}
            <span
              className={`px-2.5 py-1 text-xs font-semibold rounded-full border flex-shrink-0 ${sentiment.className}`}
            >
              {sentiment.label} Market
            </span>
          </div>

          {/* Blurred content for non-pro */}
          <div className={!hasAccess ? 'blur-sm pointer-events-none' : ''}>
            {/* Trend + Sentiment Row */}
            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center gap-2">
                <svg
                  className={`w-5 h-5 ${trend.color}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={trend.arrow}
                  />
                </svg>
                <span
                  className={`text-sm font-semibold ${trend.color}`}
                >
                  {trend.label}
                </span>
              </div>
              {fc.seasonalPattern && (
                <p className="text-xs text-neutral-500 dark:text-slate-400 italic">
                  {fc.seasonalPattern}
                </p>
              )}
            </div>

            {/* Quarterly Deal Counts - Bar Chart */}
            <div className="mb-5">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Quarterly Deal Volume
              </h5>
              <div className="flex items-end gap-1 sm:gap-2 h-32">
                {displayQuarters.map((q, idx) => {
                  const heightPercent = Math.max(
                    (q.count / maxCount) * 100,
                    6
                  );
                  const isHistorical = q.type === 'historical';

                  return (
                    <div
                      key={`${q.quarter}-${idx}`}
                      className="flex-1 flex flex-col items-center justify-end h-full"
                    >
                      <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        {q.count}
                      </span>
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${
                          isHistorical
                            ? 'bg-gradient-to-t from-violet-500 to-indigo-400'
                            : 'bg-gradient-to-t from-violet-300 to-indigo-200 dark:from-violet-600 dark:to-indigo-500 border border-dashed border-violet-400 dark:border-violet-500'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                      <span className="text-[8px] sm:text-[10px] text-neutral-400 dark:text-slate-500 mt-1 truncate w-full text-center">
                        {q.quarter}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-2 justify-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-violet-500 to-indigo-400" />
                  <span className="text-[10px] text-neutral-500 dark:text-slate-400">
                    Historical
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-violet-300 to-indigo-200 dark:from-violet-600 dark:to-indigo-500 border border-dashed border-violet-400" />
                  <span className="text-[10px] text-neutral-500 dark:text-slate-400">
                    Forecast
                  </span>
                </div>
              </div>
            </div>

            {/* Timing Advice */}
            <div className="p-3 sm:p-4 bg-gradient-to-r from-violet-50/50 to-indigo-50/50 dark:from-violet-500/5 dark:to-indigo-500/5 rounded-lg border border-violet-100 dark:border-violet-500/20">
              <p className="text-sm text-neutral-700 dark:text-slate-300 leading-relaxed">
                {fc.narrative}
              </p>
            </div>
          </div>

          {/* Pro Gate Overlay */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() =>
                  onBuyReport ? onBuyReport() : onUpgrade?.()
                }
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Unlock Financial Modeling
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
