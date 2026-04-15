'use client';

/**
 * Peer benchmark panel — renders live percentile positioning vs comparable
 * real deals. Designed to slot into the calculator results page as a
 * contextual sidebar. Client component so it updates as the user edits
 * inputs without triggering a full-page refetch.
 */

import { useMemo } from 'react';
import { computePeerBenchmark, type PeerBenchmarkInput } from '@/lib/peer-benchmark';

interface Props extends PeerBenchmarkInput {
  compact?: boolean;
}

function fmt(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${Math.round(m)}M`;
}

function percentileBadgeColor(p: number | null): string {
  if (p == null) return 'bg-slate-800 text-slate-500';
  if (p >= 75) return 'bg-teal-500/20 text-teal-300 border border-teal-500/30';
  if (p >= 50) return 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
  if (p >= 25) return 'bg-slate-700/60 text-slate-200 border border-slate-600/40';
  return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
}

export function PeerBenchmarkPanel(props: Props) {
  const { compact = false, ...input } = props;
  const benchmark = useMemo(() => computePeerBenchmark(input), [
    input.therapeuticArea,
    input.phase,
    input.modality,
    input.candidateUpfront_M,
    input.candidateTotalDeal_M,
    input.dealStructure,
    input.dealType,
    input.territory,
  ]);

  if (benchmark.n < 3) {
    return (
      <aside className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500">Peer benchmark</div>
        <p className="mt-2 text-xs text-slate-500">
          Too few comparable deals for this filter. Try widening stage or modality.
        </p>
      </aside>
    );
  }

  const { totalDealPercentiles, upfrontPercentiles, candidateUpfrontPercentile, candidateTotalDealPercentile, matchLevel, narrative, n } = benchmark;

  const scopeBadgeLabel = {
    strict: 'Tightest comps',
    widened: 'TA + phase',
    'ta-only': 'TA-only',
    global: 'Broad',
  }[matchLevel];

  return (
    <aside className="rounded-lg border border-slate-800 bg-slate-900/30 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Peer benchmark</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {n} comparable deals · <span className="text-slate-400">{scopeBadgeLabel}</span>
          </p>
        </div>
      </div>

      {/* Candidate percentile badges */}
      {(candidateUpfrontPercentile != null || candidateTotalDealPercentile != null) && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {candidateUpfrontPercentile != null && (
            <div className="rounded-md border border-slate-800/60 bg-slate-950/40 p-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Upfront</div>
              <div className={`mt-1 inline-flex items-center rounded px-2 py-1 font-mono text-sm ${percentileBadgeColor(candidateUpfrontPercentile)}`}>
                p{candidateUpfrontPercentile}
              </div>
            </div>
          )}
          {candidateTotalDealPercentile != null && (
            <div className="rounded-md border border-slate-800/60 bg-slate-950/40 p-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Total deal</div>
              <div className={`mt-1 inline-flex items-center rounded px-2 py-1 font-mono text-sm ${percentileBadgeColor(candidateTotalDealPercentile)}`}>
                p{candidateTotalDealPercentile}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Distributions */}
      {!compact && (
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-baseline justify-between text-[11px] text-slate-500">
              <span>Comparable upfronts</span>
              <span className="font-mono">
                {fmt(upfrontPercentiles.p10)} – {fmt(upfrontPercentiles.p90)}
              </span>
            </div>
            <div className="flex text-[10px] font-mono text-slate-500">
              <span className="flex-1">p10 {fmt(upfrontPercentiles.p10)}</span>
              <span className="flex-1 text-center">p50 {fmt(upfrontPercentiles.p50)}</span>
              <span className="flex-1 text-right">p90 {fmt(upfrontPercentiles.p90)}</span>
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-baseline justify-between text-[11px] text-slate-500">
              <span>Comparable total deal values</span>
              <span className="font-mono">
                {fmt(totalDealPercentiles.p10)} – {fmt(totalDealPercentiles.p90)}
              </span>
            </div>
            <div className="flex text-[10px] font-mono text-slate-500">
              <span className="flex-1">p10 {fmt(totalDealPercentiles.p10)}</span>
              <span className="flex-1 text-center">p50 {fmt(totalDealPercentiles.p50)}</span>
              <span className="flex-1 text-right">p90 {fmt(totalDealPercentiles.p90)}</span>
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-slate-400">{narrative}</p>
    </aside>
  );
}
