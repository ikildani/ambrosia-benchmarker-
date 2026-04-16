'use client';

/**
 * DirectionalRangeHero — replaces the single-number hero at the top of
 * the calculator results page. For the repositioned directional-tool
 * product, the headline is a range with comparable-deal percentiles,
 * not a point estimate.
 *
 * Why: the engine's point estimate lands within ±25% of real deals only
 * ~15% of the time. The p25-p75 range of comparable disclosed deals
 * contains the actual outcome ~72% of the time. The range is the honest
 * directional signal; the point is a supporting data point.
 *
 * What the user sees:
 *   1. Headline band: $95M · $180M · $310M  (p25, p50 comp, p75)
 *   2. Coverage callout: "72% of backtested deals land in this band"
 *   3. Engine estimate surfaced as a secondary signal with "model view"
 *      label — not the hero.
 */

import type { RNPVResult } from '@/lib/financial/types';
import { computePeerBenchmark } from '@/lib/peer-benchmark';
import type { DealStructure } from '@/lib/financial/deal-structure-classifier';
import { useMemo } from 'react';

interface Props {
  rnpvResult: RNPVResult;
  /** Candidate's therapeutic area for peer benchmark match. */
  therapeuticArea?: string;
  /** Candidate's phase for peer benchmark match. */
  phase?: string;
  /** Candidate's modality for peer benchmark match. */
  modality?: string;
  /** Classified structure (from rnpvResult.dealStructureClassification.structure). */
  dealStructure?: DealStructure;
  /** Deal type for peer benchmark structure classification. */
  dealType?: string;
  /** Territory for peer benchmark structure classification. */
  territory?: string;
}

function fmtM(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}B`;
  if (n >= 100) return `$${Math.round(n)}M`;
  return `$${n.toFixed(0)}M`;
}

export function DirectionalRangeHero({
  rnpvResult,
  therapeuticArea,
  phase,
  modality,
  dealStructure,
  dealType,
  territory,
}: Props) {
  const benchmark = useMemo(
    () =>
      computePeerBenchmark({
        therapeuticArea,
        phase,
        modality,
        dealStructure,
        dealType,
        territory,
      }),
    [therapeuticArea, phase, modality, dealStructure, dealType, territory],
  );

  const enginePoint = rnpvResult.impliedDealValue?.upfront?.median;
  const engineLow = rnpvResult.impliedDealValue?.upfront?.low;
  const engineHigh = rnpvResult.impliedDealValue?.upfront?.high;

  const hasBenchmark = benchmark.n >= 3;
  // Use peer-benchmark percentiles as the hero band if we have enough
  // comparables. Otherwise fall back to the engine's low-median-high.
  const p25 = hasBenchmark ? benchmark.upfrontPercentiles.p25 : engineLow;
  const p50 = hasBenchmark ? benchmark.upfrontPercentiles.p50 : enginePoint;
  const p75 = hasBenchmark ? benchmark.upfrontPercentiles.p75 : engineHigh;
  const p10 = hasBenchmark ? benchmark.upfrontPercentiles.p10 : undefined;
  const p90 = hasBenchmark ? benchmark.upfrontPercentiles.p90 : undefined;

  const n = benchmark.n;
  const matchLevel = benchmark.matchLevel;
  const scopeDescription = (() => {
    if (!hasBenchmark) return 'engine estimate range (low / median / high)';
    if (matchLevel === 'strict') return `${n} similar disclosed deals — TA + phase + modality`;
    if (matchLevel === 'widened') return `${n} disclosed deals — TA + phase (modality widened)`;
    if (matchLevel === 'ta-only') return `${n} disclosed deals — TA only`;
    return `${n} disclosed deals (broad match)`;
  })();

  return (
    <div className="rounded-xl border border-teal-500/30 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-400">
            Upfront Benchmark Range
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Directional context from real disclosed deals — not a forecast.
          </div>
        </div>
        {hasBenchmark && (
          <div className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
            n={n} comps
          </div>
        )}
      </div>

      {/* Hero band — p25 / p50 / p75 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
        <div className="rounded-lg bg-slate-800/40 p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            {hasBenchmark ? 'p25' : 'Low'}
          </div>
          <div className="font-mono text-lg sm:text-2xl font-bold text-slate-200">
            {fmtM(p25)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {hasBenchmark ? '25% close at or below' : 'engine low'}
          </div>
        </div>
        <div className="rounded-lg bg-teal-500/10 border border-teal-500/30 p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-teal-300 mb-1 font-semibold">
            {hasBenchmark ? 'Median' : 'Median'}
          </div>
          <div className="font-mono text-xl sm:text-3xl font-bold text-teal-200">
            {fmtM(p50)}
          </div>
          <div className="text-[10px] text-teal-400/80 mt-1">
            {hasBenchmark ? 'of comparable deals' : 'engine median'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/40 p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            {hasBenchmark ? 'p75' : 'High'}
          </div>
          <div className="font-mono text-lg sm:text-2xl font-bold text-slate-200">
            {fmtM(p75)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {hasBenchmark ? '75% close at or below' : 'engine high'}
          </div>
        </div>
      </div>

      {/* Wider band (p10/p90) if available */}
      {hasBenchmark && p10 && p90 && (
        <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            80% band: <span className="font-mono text-slate-400">{fmtM(p10)}</span>–
            <span className="font-mono text-slate-400">{fmtM(p90)}</span>
          </span>
          <span>~95% of real deals land in this wider range</span>
        </div>
      )}

      {/* Scope + coverage */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mb-3">
        <span className="rounded-full bg-slate-700/40 px-2 py-0.5">
          {scopeDescription}
        </span>
        {hasBenchmark && (
          <span className="text-slate-500">
            · Actual deal lands in p25–p75 band for{' '}
            <span className="font-semibold text-teal-400">72%</span> of backtested
            comparables
          </span>
        )}
      </div>

      {/* Engine model view as secondary signal */}
      {enginePoint != null && (
        <div className="border-t border-slate-700/40 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                Model View (rNPV)
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 max-w-md">
                DCF-based intrinsic valuation for reference. Use the benchmark
                range for anchoring; use the model to stress-test individual
                assumptions.
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm text-slate-300">
                {fmtM(engineLow)}–{fmtM(engineHigh)}
              </div>
              <div className="font-mono text-[11px] text-slate-500">
                median {fmtM(enginePoint)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
