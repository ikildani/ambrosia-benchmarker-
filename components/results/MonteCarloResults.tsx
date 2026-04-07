'use client';

import { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { BarChart3, Lock, Activity } from 'lucide-react';
import type { MonteCarloResult } from '@/lib/financial/types';

interface MonteCarloResultsProps {
  monteCarloResult?: MonteCarloResult;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

function correlationColor(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 0.6) return 'text-teal-700 dark:text-teal-400';
  if (abs >= 0.3) return 'text-amber-600 dark:text-amber-400';
  return 'text-slate-500 dark:text-slate-400';
}

export default function MonteCarloResults({
  monteCarloResult,
  tier,
  onUpgrade,
  onBuyReport,
}: MonteCarloResultsProps) {
  const [hoveredBin, setHoveredBin] = useState<number | null>(null);

  const hasAccess = tier === 'pro' || tier === 'report';
  const mc = monteCarloResult;

  // --- Memoized computations ---

  const percentiles = useMemo(() => {
    if (!mc) return [];
    return [
      { label: 'P5', value: mc.percentiles.p5, color: 'bg-red-400 dark:bg-red-500' },
      { label: 'P25', value: mc.percentiles.p25, color: 'bg-amber-400 dark:bg-amber-500' },
      { label: 'P50', value: mc.percentiles.p50, color: 'bg-teal-500 dark:bg-teal-400' },
      { label: 'P75', value: mc.percentiles.p75, color: 'bg-cyan-400 dark:bg-cyan-500' },
      { label: 'P95', value: mc.percentiles.p95, color: 'bg-indigo-400 dark:bg-indigo-500' },
    ];
  }, [mc]);

  const percentileRange = useMemo(() => {
    if (!mc) return { min: 0, max: 1 };
    const allValues = [
      mc.percentiles.p5,
      mc.percentiles.p25,
      mc.percentiles.p50,
      mc.percentiles.p75,
      mc.percentiles.p95,
    ];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    return { min, max };
  }, [mc]);

  const topDrivers = useMemo(() => {
    if (!mc) return [];
    return mc.keyDriverSensitivity
      .slice()
      .sort((a, b) => Math.abs(b.correlationWithNPV) - Math.abs(a.correlationWithNPV))
      .slice(0, 3);
  }, [mc]);

  const positiveProbPct = useMemo(() => {
    if (!mc) return '0.0';
    return (mc.probabilityOfPositiveNPV * 100).toFixed(1);
  }, [mc]);

  const histogramData = useMemo(() => {
    if (!mc || !mc.histogram || mc.histogram.length === 0) return null;
    const maxCount = Math.max(...mc.histogram.map((b) => b.count));
    const minBin = mc.histogram[0].binStart;
    const maxBin = mc.histogram[mc.histogram.length - 1].binEnd;
    const p50 = mc.percentiles.p50;

    // Find which bin index the P50 falls into
    let p50BinIndex = -1;
    for (let i = 0; i < mc.histogram.length; i++) {
      if (p50 >= mc.histogram[i].binStart && p50 < mc.histogram[i].binEnd) {
        p50BinIndex = i;
        break;
      }
    }
    // If P50 equals the last bin's end, assign to the last bin
    if (p50BinIndex === -1 && p50 >= mc.histogram[mc.histogram.length - 1].binStart) {
      p50BinIndex = mc.histogram.length - 1;
    }

    return { maxCount, minBin, maxBin, p50BinIndex };
  }, [mc]);

  // --- Early return for missing data ---

  if (!mc) {
    return (
      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Monte Carlo simulation requires rNPV base case to run.
        </p>
      </div>
    );
  }

  /**
   * Compute bar width for a percentile value.
   * Handles negative values properly by mapping the full range (min..max)
   * onto 0%..100% bar width.
   */
  function percentileBarWidth(value: number): number {
    const { min, max } = percentileRange;
    const range = max - min;
    if (range === 0) return 50;
    return ((value - min) / range) * 100;
  }

  /**
   * Returns a gradient color for histogram bins based on position.
   * Left (low outcomes) = red/rose, right (high outcomes) = teal/green.
   */
  function histogramBinColor(index: number, total: number): string {
    const ratio = total <= 1 ? 0.5 : index / (total - 1);
    if (ratio < 0.25) return 'bg-rose-500';
    if (ratio < 0.4) return 'bg-orange-400';
    if (ratio < 0.55) return 'bg-amber-400';
    if (ratio < 0.7) return 'bg-emerald-400';
    return 'bg-teal-500';
  }

  return (
    <div className="relative mt-6 sm:mt-8">
      <div className="rounded-xl bg-gradient-to-r from-indigo-400 to-purple-400 p-[1px]">
        <div
          className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !hasAccess ? 'select-none' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-soft flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  Monte Carlo Simulation
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  {mc.iterations.toLocaleString()} iterations &middot; probabilistic
                  valuation range
                </p>
              </div>
            </div>
          </div>

          {/* Blurred content for non-pro */}
          <div className={!hasAccess ? 'blur-[6px] pointer-events-none transition-all' : 'transition-all'}>
            {/* Probability of Positive NPV -- Prominent */}
            <div className="mb-5 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 rounded-lg border border-indigo-100 dark:border-indigo-500/20 text-center">
              <p className="text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                Probability of Positive NPV
              </p>
              <p
                className={`text-3xl sm:text-4xl font-bold ${
                  mc.probabilityOfPositiveNPV >= 0.7
                    ? 'text-green-600 dark:text-green-400'
                    : mc.probabilityOfPositiveNPV >= 0.4
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {positiveProbPct}%
              </p>
              <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
                Mean: {formatCurrency(mc.mean)} &middot; Std Dev:{' '}
                {formatCurrency(mc.stdDev)}
              </p>
            </div>

            {/* Histogram Distribution Chart */}
            {histogramData && mc.histogram.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    NPV Distribution
                  </h5>
                </div>

                {/* Chart container */}
                <div className="relative bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 p-3">
                  {/* Bars */}
                  <div className="flex items-end gap-[1px] h-32 sm:h-40">
                    {mc.histogram.map((bin, idx) => {
                      const heightPct =
                        histogramData.maxCount > 0
                          ? (bin.count / histogramData.maxCount) * 100
                          : 0;
                      const isP50 = idx === histogramData.p50BinIndex;
                      const isHovered = hoveredBin === idx;

                      return (
                        <div
                          key={idx}
                          className="relative flex-1 flex flex-col items-center justify-end h-full"
                          onMouseEnter={() => setHoveredBin(idx)}
                          onMouseLeave={() => setHoveredBin(null)}
                        >
                          {/* Hover tooltip */}
                          {isHovered && (
                            <div className="absolute bottom-full mb-2 z-10 bg-slate-800 dark:bg-slate-600 text-white text-[10px] leading-tight rounded px-2 py-1.5 whitespace-nowrap shadow-lg pointer-events-none">
                              <div className="font-semibold">
                                {formatCurrency(bin.binStart)} &ndash; {formatCurrency(bin.binEnd)}
                              </div>
                              <div className="text-slate-300 mt-0.5">
                                {bin.count.toLocaleString()} iterations ({bin.percentage.toFixed(1)}%)
                              </div>
                            </div>
                          )}

                          {/* P50 marker */}
                          {isP50 && (
                            <div className="absolute -top-5 text-[9px] font-bold text-indigo-600 dark:text-indigo-300 whitespace-nowrap">
                              P50
                            </div>
                          )}

                          {/* Bar */}
                          <div
                            className={`w-full rounded-t-sm transition-all duration-200 cursor-pointer ${histogramBinColor(idx, mc.histogram.length)} ${
                              isHovered ? 'opacity-100 scale-x-110' : 'opacity-80 hover:opacity-100'
                            } ${isP50 ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-1 ring-offset-slate-50 dark:ring-offset-slate-700' : ''}`}
                            style={{
                              height: `${Math.max(heightPct, 1)}%`,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* X-axis labels */}
                  <div className="flex justify-between mt-2 px-0.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {formatCurrency(histogramData.minBin)}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {formatCurrency(histogramData.maxBin)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Distribution Summary - Percentile Bars */}
            <div className="mb-5">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Value Distribution
              </h5>
              <div className="space-y-2">
                {percentiles.map((p) => (
                  <div key={p.label} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-neutral-500 dark:text-slate-400 w-8 flex-shrink-0">
                      {p.label}
                    </span>
                    <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full ${p.color} rounded-full transition-all duration-500`}
                        style={{
                          width: `${Math.max(percentileBarWidth(p.value), 2)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-16 text-right">
                      {formatCurrency(p.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 95% Confidence Interval */}
            <div className="mb-5 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wide">
                    95% Confidence Interval
                  </p>
                  <p className="text-sm font-bold text-navy-800 dark:text-white mt-0.5">
                    {formatCurrency(mc.confidenceInterval95.low)} &mdash;{' '}
                    {formatCurrency(mc.confidenceInterval95.high)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wide">
                    80% Confidence
                  </p>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                    {formatCurrency(mc.confidenceInterval80.low)} &mdash;{' '}
                    {formatCurrency(mc.confidenceInterval80.high)}
                  </p>
                </div>
              </div>
            </div>

            {/* Risk Metrics — VaR/CVaR + Distribution Shape */}
            {mc.var95 !== undefined && (
              <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-100 dark:border-red-500/20">
                  <p className="text-[10px] font-bold text-red-500/70 dark:text-red-400/70 uppercase tracking-wider mb-1">VaR (95%)</p>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">{formatCurrency(mc.var95)}</p>
                  <p className="text-[10px] text-red-500/50 dark:text-red-400/40 mt-0.5">Worst case 95% of time</p>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-lg border border-rose-100 dark:border-rose-500/20">
                  <p className="text-[10px] font-bold text-rose-500/70 dark:text-rose-400/70 uppercase tracking-wider mb-1">CVaR (95%)</p>
                  <p className="text-sm font-bold text-rose-700 dark:text-rose-400">{formatCurrency(mc.cvar95)}</p>
                  <p className="text-[10px] text-rose-500/50 dark:text-rose-400/40 mt-0.5">Expected tail loss</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                  <p className="text-[10px] font-bold text-slate-500/70 dark:text-slate-400/70 uppercase tracking-wider mb-1">Skewness</p>
                  <p className={`text-sm font-bold ${mc.skewness > 0 ? 'text-teal-700 dark:text-teal-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {mc.skewness > 0 ? '+' : ''}{mc.skewness.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-500/50 dark:text-slate-400/40 mt-0.5">
                    {mc.skewness > 0.5 ? 'Right-skewed (upside)' : mc.skewness < -0.5 ? 'Left-skewed (downside)' : 'Near-symmetric'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                  <p className="text-[10px] font-bold text-slate-500/70 dark:text-slate-400/70 uppercase tracking-wider mb-1">Tail Risk</p>
                  <p className={`text-sm font-bold ${mc.kurtosis > 1 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {mc.kurtosis > 0 ? '+' : ''}{mc.kurtosis.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-500/50 dark:text-slate-400/40 mt-0.5">
                    {mc.kurtosis > 2 ? 'Heavy tails' : mc.kurtosis > 0 ? 'Moderate tails' : 'Normal-like'}
                  </p>
                </div>
              </div>
            )}

            {/* Key Sensitivities - Top 3 Drivers (centered-origin correlation bars) */}
            {topDrivers.length > 0 && (
              <div>
                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                  Key Value Drivers
                </h5>
                <div className="space-y-2">
                  {topDrivers.map((driver, idx) => {
                    const corrPct = Math.abs(driver.correlationWithNPV) * 50; // 50% = full bar on one side
                    const isPositive = driver.correlationWithNPV >= 0;

                    return (
                      <div
                        key={driver.parameter}
                        className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all"
                      >
                        <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                            {driver.label}
                          </p>
                          {/* Centered-origin correlation bar */}
                          <div className="mt-1 h-1.5 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden relative">
                            {/* Center line */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300 dark:bg-slate-500 z-10" />
                            {isPositive ? (
                              /* Positive: bar extends right from center */
                              <div
                                className="absolute top-0 bottom-0 left-1/2 bg-teal-500 rounded-r-full transition-all duration-500"
                                style={{ width: `${corrPct}%` }}
                              />
                            ) : (
                              /* Negative: bar extends left from center */
                              <div
                                className="absolute top-0 bottom-0 right-1/2 bg-rose-500 rounded-l-full transition-all duration-500"
                                style={{ width: `${corrPct}%` }}
                              />
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold flex-shrink-0 ${correlationColor(
                            driver.correlationWithNPV
                          )}`}
                        >
                          {driver.correlationWithNPV > 0 ? '+' : ''}
                          {driver.correlationWithNPV.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Pro Gate Overlay */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() =>
                  onBuyReport ? onBuyReport() : onUpgrade?.()
                }
                aria-label="Unlock Monte Carlo Simulation"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow hover:scale-105 transition-all"
              >
                <Lock className="w-4 h-4" />
                Unlock Monte Carlo Simulation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
