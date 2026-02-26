'use client';

import { formatCurrency } from '@/lib/calculations';
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

function correlationBarWidth(value: number): string {
  return `${Math.min(Math.abs(value) * 100, 100)}%`;
}

export default function MonteCarloResults({
  monteCarloResult,
  tier,
  onUpgrade,
  onBuyReport,
}: MonteCarloResultsProps) {
  if (!monteCarloResult) return null;

  const hasAccess = tier === 'pro' || tier === 'report';
  const mc = monteCarloResult;

  // Percentile data for the distribution bars
  const percentiles = [
    { label: 'P5', value: mc.percentiles.p5, color: 'bg-red-400 dark:bg-red-500' },
    { label: 'P25', value: mc.percentiles.p25, color: 'bg-amber-400 dark:bg-amber-500' },
    { label: 'P50', value: mc.percentiles.p50, color: 'bg-teal-500 dark:bg-teal-400' },
    { label: 'P75', value: mc.percentiles.p75, color: 'bg-cyan-400 dark:bg-cyan-500' },
    { label: 'P95', value: mc.percentiles.p95, color: 'bg-indigo-400 dark:bg-indigo-500' },
  ];

  // Normalize bar widths relative to P95
  const maxVal = Math.max(Math.abs(mc.percentiles.p95), Math.abs(mc.percentiles.p5), 1);

  // Top 3 sensitivity drivers
  const topDrivers = mc.keyDriverSensitivity
    .slice()
    .sort((a, b) => Math.abs(b.correlationWithNPV) - Math.abs(a.correlationWithNPV))
    .slice(0, 3);

  const positiveProbPct = (mc.probabilityOfPositiveNPV * 100).toFixed(1);

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
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                  />
                </svg>
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
          <div className={!hasAccess ? 'blur-sm pointer-events-none' : ''}>
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
                          width: `${Math.max(
                            (Math.max(p.value, 0) / maxVal) * 100,
                            4
                          )}%`,
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

            {/* Key Sensitivities - Top 3 Drivers */}
            {topDrivers.length > 0 && (
              <div>
                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                  Key Value Drivers
                </h5>
                <div className="space-y-2">
                  {topDrivers.map((driver, idx) => (
                    <div
                      key={driver.parameter}
                      className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                    >
                      <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                          {driver.label}
                        </p>
                        <div className="mt-1 h-1.5 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              driver.correlationWithNPV >= 0
                                ? 'bg-teal-500'
                                : 'bg-red-400'
                            }`}
                            style={{
                              width: correlationBarWidth(
                                driver.correlationWithNPV
                              ),
                            }}
                          />
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
                  ))}
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
