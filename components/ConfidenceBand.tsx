'use client';

/**
 * Confidence Band (R24 — 2026-04-13)
 *
 * Visual range indicator for key deal values. Instead of showing a single
 * point estimate, displays the low/median/high range as a bar with markers.
 *
 * BD executives expect this — any valuation output without a confidence
 * band reads as naive. When Monte Carlo results are available
 * (financialModel.monteCarlo), the component uses P10/P50/P90 from the
 * simulation. Otherwise it falls back to the multiplier-based low/median/
 * high already present in DealTerms.
 */

import { formatCurrency } from '@/lib/calculations';

interface ConfidenceBandProps {
  low: number;
  median: number;
  high: number;
  /** Label shown above the band (e.g., "Upfront payment"). */
  label: string;
  /** Optional sublabel (e.g., "P10 / P50 / P90 from Monte Carlo"). */
  sublabel?: string;
  /** "monte-carlo" shows teal for MC-derived, "multiplier" shows slate for range-based */
  source?: 'monte-carlo' | 'multiplier';
  /** If present, a benchmark median to show as a reference line. */
  benchmark?: number;
}

const fmt = (v: number): string => {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  if (Math.abs(v) >= 1) return `$${v.toFixed(0)}M`;
  return `$${v.toFixed(1)}M`;
};

export default function ConfidenceBand({
  low,
  median,
  high,
  label,
  sublabel,
  source = 'multiplier',
  benchmark,
}: ConfidenceBandProps) {
  // Clamp so we always show a visible range even with degenerate data.
  const safeLow = Math.min(low, median, high);
  const safeHigh = Math.max(low, median, high);
  const range = safeHigh - safeLow || 1;

  const lowPct = 0;
  const medianPct = ((median - safeLow) / range) * 100;
  const highPct = 100;
  const benchmarkPct =
    benchmark !== undefined && benchmark >= safeLow && benchmark <= safeHigh
      ? ((benchmark - safeLow) / range) * 100
      : null;

  const isMC = source === 'monte-carlo';
  const barGrad = isMC
    ? 'from-teal-500/40 via-teal-400/60 to-teal-500/40'
    : 'from-slate-500/30 via-slate-400/50 to-slate-500/30';

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </div>
          {sublabel && (
            <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{sublabel}</div>
          )}
        </div>
        {isMC && (
          <span className="shrink-0 rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-500">
            Monte Carlo
          </span>
        )}
      </div>

      {/* Range bar */}
      <div className="relative mt-4 h-2 w-full overflow-visible rounded-full bg-slate-100 dark:bg-slate-800">
        {/* Main band */}
        <div
          className={`absolute inset-y-0 rounded-full bg-gradient-to-r ${barGrad}`}
          style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
        />
        {/* Median marker */}
        <div
          className={`absolute top-1/2 h-5 w-[2px] -translate-y-1/2 ${
            isMC ? 'bg-teal-500' : 'bg-slate-700 dark:bg-slate-200'
          }`}
          style={{ left: `${medianPct}%` }}
          aria-hidden
        />
        {/* Benchmark marker (if provided) */}
        {benchmarkPct !== null && (
          <div
            className="absolute top-1/2 h-5 w-[2px] -translate-y-1/2 bg-amber-500"
            style={{ left: `${benchmarkPct}%` }}
            aria-hidden
            aria-label="Benchmark median"
          />
        )}
      </div>

      {/* Numbers */}
      <div className="mt-3 flex items-baseline justify-between text-xs">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">
            {isMC ? 'P10' : 'Low'}
          </span>
          <span className="font-mono text-slate-600 dark:text-slate-400">{fmt(low)}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isMC ? 'P50 (median)' : 'Median'}
          </span>
          <span className={`font-mono text-base font-semibold ${isMC ? 'text-teal-600 dark:text-teal-400' : 'text-slate-800 dark:text-slate-100'}`}>
            {fmt(median)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">
            {isMC ? 'P90' : 'High'}
          </span>
          <span className="font-mono text-slate-600 dark:text-slate-400">{fmt(high)}</span>
        </div>
      </div>

      {benchmarkPct !== null && (
        <div className="mt-2 text-[10px] text-amber-500 dark:text-amber-400">
          ↓ Benchmark median: <span className="font-mono">{fmt(benchmark!)}</span>
        </div>
      )}
    </div>
  );
}
