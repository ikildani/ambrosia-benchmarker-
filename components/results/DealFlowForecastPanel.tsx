'use client';

import { useMemo } from 'react';
import { BarChart3, Lock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import type { DealFlowForecast } from '@/lib/financial/types';

interface DealFlowForecastPanelProps {
  forecast?: DealFlowForecast;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

const sentimentConfig: Record<
  string,
  { label: string; className: string }
> = {
  hot: {
    label: 'Hot',
    className:
      'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30',
  },
  warm: {
    label: 'Warm',
    className:
      'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  },
  neutral: {
    label: 'Neutral',
    className:
      'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-500',
  },
  cooling: {
    label: 'Cooling',
    className:
      'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  },
};

const trendConfig: Record<
  string,
  { icon: typeof TrendingUp; label: string; color: string }
> = {
  accelerating: {
    icon: TrendingUp,
    label: 'Accelerating',
    color: 'text-green-600 dark:text-green-400',
  },
  stable: {
    icon: Minus,
    label: 'Stable',
    color: 'text-slate-600 dark:text-slate-400',
  },
  decelerating: {
    icon: TrendingDown,
    label: 'Decelerating',
    color: 'text-red-600 dark:text-red-400',
  },
};

function confidenceLabel(confidence: number): {
  text: string;
  className: string;
} {
  if (confidence >= 0.7) {
    return {
      text: 'High',
      className:
        'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300',
    };
  }
  if (confidence >= 0.4) {
    return {
      text: 'Med',
      className:
        'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
    };
  }
  return {
    text: 'Low',
    className:
      'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300',
  };
}

export default function DealFlowForecastPanel({
  forecast,
  tier,
  onUpgrade,
  onBuyReport,
}: DealFlowForecastPanelProps) {
  const hasAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  const chartData = useMemo(() => {
    if (!forecast) return null;

    const historical = forecast.historicalQuarters.slice(-4).map((q) => ({
      quarter: q.quarter,
      count: q.dealCount,
      totalValue: q.totalValue,
      type: 'historical' as const,
      confidence: undefined as number | undefined,
    }));

    const forecastSlice = forecast.forecast.slice(0, 4).map((q) => ({
      quarter: q.quarter,
      count: q.predictedDeals,
      totalValue: undefined as number | undefined,
      type: 'forecast' as const,
      confidence: q.confidence,
    }));

    const displayQuarters = [...historical, ...forecastSlice];
    const maxCount = Math.max(...displayQuarters.map((q) => q.count), 1);

    // Generate y-axis labels: 5 evenly spaced ticks from 0 to maxCount
    const tickCount = 5;
    const step = Math.ceil(maxCount / (tickCount - 1));
    const yLabels: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      yLabels.push(step * i);
    }
    // Ensure the top label is at least maxCount
    const yMax = yLabels[yLabels.length - 1] || maxCount;

    return { displayQuarters, maxCount, yLabels, yMax };
  }, [forecast]);

  if (!forecast || !chartData) {
    return (
      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Deal flow forecast unavailable for this therapeutic area.
        </p>
      </div>
    );
  }

  const fc = forecast;
  const sentiment = sentimentConfig[fc.marketSentiment] || sentimentConfig.neutral;
  const trendInfo = trendConfig[fc.trend] || trendConfig.stable;
  const TrendIcon = trendInfo.icon;

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
                <BarChart3 className="w-5 h-5 text-white" />
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
          <div
            className={
              !hasAccess
                ? 'blur-[6px] pointer-events-none transition-all'
                : 'transition-all'
            }
          >
            {/* Trend + Seasonal Pattern Row */}
            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center gap-2">
                <TrendIcon className={`w-5 h-5 ${trendInfo.color}`} />
                <span className={`text-sm font-semibold ${trendInfo.color}`}>
                  {trendInfo.label}
                </span>
              </div>
              {fc.seasonalPattern && (
                <p className="text-xs text-neutral-500 dark:text-slate-400 italic">
                  {fc.seasonalPattern}
                </p>
              )}
            </div>

            {/* Quarterly Deal Counts - Bar Chart with Y-axis */}
            <div className="mb-5">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Quarterly Deal Volume
              </h5>
              <div className="flex h-40">
                {/* Y-axis labels */}
                <div className="flex flex-col justify-between items-end pr-2 pb-5 pt-0">
                  {[...chartData.yLabels].reverse().map((label) => (
                    <span
                      key={label}
                      className="text-[10px] text-neutral-400 dark:text-slate-500 leading-none"
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {/* Bars */}
                <div className="flex items-end gap-1 sm:gap-2 flex-1 h-full">
                  {chartData.displayQuarters.map((q, idx) => {
                    const heightPercent = Math.max(
                      (q.count / chartData.yMax) * 100,
                      6
                    );
                    const isHistorical = q.type === 'historical';
                    const conf =
                      q.confidence != null
                        ? confidenceLabel(q.confidence)
                        : null;

                    return (
                      <div
                        key={`${q.quarter}-${idx}`}
                        className="flex-1 flex flex-col items-center justify-end h-full"
                      >
                        {/* Confidence badge above forecast bars */}
                        {conf && (
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full mb-0.5 ${conf.className}`}
                          >
                            {conf.text}
                          </span>
                        )}

                        {/* Deal count */}
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-0.5">
                          {q.count}
                        </span>

                        {/* Bar */}
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            isHistorical
                              ? 'bg-gradient-to-t from-violet-500 to-indigo-400'
                              : 'bg-gradient-to-t from-violet-300/70 to-indigo-200/70 dark:from-violet-600/70 dark:to-indigo-500/70'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />

                        {/* Total value under historical bars */}
                        {isHistorical && q.totalValue != null && (
                          <span className="text-[9px] text-violet-500 dark:text-violet-400 mt-0.5 font-medium">
                            {formatCurrency(q.totalValue)}
                          </span>
                        )}

                        {/* Quarter label */}
                        <span className="text-[10px] text-neutral-400 dark:text-slate-500 mt-0.5 truncate w-full text-center">
                          {q.quarter}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-2 justify-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-violet-500 to-indigo-400" />
                  <span className="text-[10px] text-neutral-500 dark:text-slate-400">
                    Historical
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-violet-300/70 to-indigo-200/70 dark:from-violet-600/70 dark:to-indigo-500/70" />
                  <span className="text-[10px] text-neutral-500 dark:text-slate-400">
                    Forecast
                  </span>
                </div>
              </div>
            </div>

            {/* Timing Advice / Narrative */}
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
                aria-label="Unlock Deal Flow Insights"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
              >
                <Lock className="w-4 h-4" />
                Unlock Deal Flow Insights
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
