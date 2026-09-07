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
 * Population: ONE comp pool. The band is the recency-weighted p10..p90 of
 * the same live Supabase pool the Comparables tab renders, delivered via
 * GET /api/deals/peer-benchmark (Results.tsx → PeerBenchmarkContext). While
 * that request is in flight, or if it fails, the bundled static corpus is
 * shown and explicitly tagged "offline sample".
 *
 * What the user sees:
 *   1. Headline band: $95M · $180M · $310M  (p25, p50 comp, p75)
 *   2. Scope + weighting label, and an "offline sample" tag when applicable
 *   3. Engine estimate surfaced as a secondary signal with "model view"
 *      label — not the hero.
 */

import type { RNPVResult } from '@/lib/financial/types';
import {
  computePeerBenchmark,
  describePeerBenchmarkScope,
  toOfflineSample,
  type PeerBenchmarkSummary,
} from '@/lib/peer-benchmark';
import type { DealStructure } from '@/lib/financial/deal-structure-classifier';
import { useMemo } from 'react';
import { usePeerBenchmark } from './PeerBenchmarkContext';

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
  /**
   * The single comp population. Falls back to PeerBenchmarkContext, then to
   * the bundled corpus tagged "offline sample" when neither is supplied.
   */
  peerBenchmark?: PeerBenchmarkSummary | null;
}

function fmtM(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}B`;
  if (n >= 100) return `$${Math.round(n)}M`;
  return `$${n.toFixed(0)}M`;
}

export function OfflineSampleTag({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300 ${className}`}
      title="Live comparable pool unavailable — showing the bundled static corpus. Numbers may differ from the Comparables tab."
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
      Offline sample
    </span>
  );
}

export function DirectionalRangeHero({
  rnpvResult,
  therapeuticArea,
  phase,
  modality,
  dealStructure,
  dealType,
  territory,
  peerBenchmark,
}: Props) {
  const fromContext = usePeerBenchmark();

  // Offline fallback only — the bundled corpus, explicitly labelled.
  const offline = useMemo(
    () =>
      toOfflineSample(
        computePeerBenchmark({ therapeuticArea, phase, modality, dealStructure, dealType, territory }),
      ),
    [therapeuticArea, phase, modality, dealStructure, dealType, territory],
  );

  const benchmark: PeerBenchmarkSummary = peerBenchmark ?? fromContext ?? offline;
  const isOffline = benchmark.source !== 'live';

  const enginePoint = rnpvResult.impliedDealValue?.upfront?.median;
  const engineLow = rnpvResult.impliedDealValue?.upfront?.low;
  const engineHigh = rnpvResult.impliedDealValue?.upfront?.high;

  // Use peer-benchmark percentiles as the hero band if we have enough
  // disclosed upfronts. Otherwise fall back to the engine's low-median-high.
  const hasBenchmark = benchmark.n >= 3 && benchmark.nDisclosedUpfront >= 3;
  const p25 = hasBenchmark ? benchmark.upfrontPercentiles.p25 : engineLow;
  const p50 = hasBenchmark ? benchmark.upfrontPercentiles.p50 : enginePoint;
  const p75 = hasBenchmark ? benchmark.upfrontPercentiles.p75 : engineHigh;
  const p10 = hasBenchmark ? benchmark.upfrontPercentiles.p10 : undefined;
  const p90 = hasBenchmark ? benchmark.upfrontPercentiles.p90 : undefined;

  const n = benchmark.n;
  const scopeDescription = hasBenchmark
    ? describePeerBenchmarkScope(benchmark)
    : 'engine estimate range (low / median / high)';
  const weightingLabel = benchmark.weighting === 'recency' ? 'recency-weighted' : 'unweighted';

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
          <div className="flex flex-col items-end gap-1">
            <div className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
              n={n} comps · {benchmark.nDisclosedUpfront} with disclosed upfront
            </div>
            {isOffline && <OfflineSampleTag />}
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
            Median
          </div>
          <div className="font-mono text-xl sm:text-3xl font-bold text-teal-200">
            {fmtM(p50)}
          </div>
          <div className="text-[10px] text-teal-400/80 mt-1">
            {hasBenchmark ? `of comparable deals · ${weightingLabel}` : 'engine median'}
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
      {hasBenchmark && p10 != null && p90 != null && p10 > 0 && p90 > 0 && (
        <div className="mb-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            80% band: <span className="font-mono text-slate-400">{fmtM(p10)}</span>–
            <span className="font-mono text-slate-400">{fmtM(p90)}</span>
          </span>
          <span>p10–p90 of the comparable sample (80% of those deals by construction)</span>
        </div>
      )}

      {/* Scope + coverage */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mb-3">
        <span className="rounded-full bg-slate-700/40 px-2 py-0.5">
          {scopeDescription}
        </span>
        {hasBenchmark && p25 != null && p75 != null && (
          <span className="text-slate-500">
            · Range spans{' '}
            <span className="font-mono text-slate-300">
              {fmtM(p75 - p25)}
            </span>
            {' '}— use as directional ballpark, not a point target
          </span>
        )}
      </div>

      {hasBenchmark && isOffline && (
        <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/80">
          Live comparable pool unavailable — this band is drawn from the bundled
          static corpus ({weightingLabel}). The Comparables tab may show
          different figures until the live pool loads.
        </div>
      )}

      {hasBenchmark && !isOffline && (
        <div className="mb-3 text-[11px] text-slate-500">
          Same pool as the Comparables tab: the median above is the tab&apos;s
          recency-weighted market median.
        </div>
      )}

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
