/**
 * Peer benchmark — compute where a given deal sits in the distribution of
 * comparable real deals from the corpus. Sidebar on /calculator results
 * shows "your deal at Xth percentile" as inputs change.
 *
 * Deliberately sync + fast. Reads from the bundled corpus, no DB call.
 *
 * @module lib/peer-benchmark
 */

import { EXTENDED_COMPARABLE_DEALS } from '@/data/comparable-deals-extended';
import { SUPABASE_COMPARABLE_DEALS } from '@/data/comparable-deals-supabase';

export interface PeerBenchmarkInput {
  therapeuticArea?: string;
  phase?: string;
  modality?: string;
  /** Candidate deal's upfront ($M) — the point we're benchmarking */
  candidateUpfront_M?: number;
  /** Candidate total deal value ($M). */
  candidateTotalDeal_M?: number;
}

export interface PeerBenchmarkResult {
  /** Number of comparable deals that matched the filter */
  n: number;
  /** Breadth level — how relaxed the filter had to be to get a usable sample */
  matchLevel: 'strict' | 'widened' | 'ta-only' | 'global';
  /** Distribution percentiles across comparable total deal values ($M). */
  totalDealPercentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
  /** Distribution percentiles across comparable upfronts ($M). */
  upfrontPercentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
  /** Candidate's percentile rank within comparable total deal values (0-100). */
  candidateTotalDealPercentile: number | null;
  /** Candidate's percentile rank within comparable upfronts (0-100). */
  candidateUpfrontPercentile: number | null;
  /** Human-readable narrative summarizing the position */
  narrative: string;
}

interface MinimalDeal {
  therapeuticArea: string;
  phase: string;
  modality: string;
  upfront: number;
  totalDealValue: number;
}

function combinedCorpus(): MinimalDeal[] {
  const rows: MinimalDeal[] = [];
  for (const d of [...EXTENDED_COMPARABLE_DEALS, ...SUPABASE_COMPARABLE_DEALS]) {
    if (!d.upfront || !d.totalDealValue || d.upfront <= 0 || d.totalDealValue <= 0) continue;
    rows.push({
      therapeuticArea: d.therapeuticArea,
      phase: d.phase,
      modality: d.modality,
      upfront: d.upfront,
      totalDealValue: d.totalDealValue,
    });
  }
  return rows;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function rankPercentile(sorted: number[], value: number): number {
  if (sorted.length === 0) return 50;
  // Find first index where sorted[i] >= value. Everything before is strictly less.
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  // `lo` is how many deals are < value. Percentile rank = (strictly less / total).
  return Math.round((lo / sorted.length) * 100);
}

function matchesFilter(d: MinimalDeal, filter: {
  ta?: string;
  phase?: string;
  modality?: string;
}): boolean {
  if (filter.ta && d.therapeuticArea !== filter.ta) return false;
  if (filter.phase && d.phase !== filter.phase) return false;
  if (filter.modality && d.modality !== filter.modality) return false;
  return true;
}

function computeStats(pool: MinimalDeal[], input: PeerBenchmarkInput, matchLevel: PeerBenchmarkResult['matchLevel']): PeerBenchmarkResult {
  const sortedUpfront = pool.map(d => d.upfront).sort((a, b) => a - b);
  const sortedTotal = pool.map(d => d.totalDealValue).sort((a, b) => a - b);

  const totalDealPercentiles = {
    p10: percentile(sortedTotal, 10),
    p25: percentile(sortedTotal, 25),
    p50: percentile(sortedTotal, 50),
    p75: percentile(sortedTotal, 75),
    p90: percentile(sortedTotal, 90),
  };
  const upfrontPercentiles = {
    p10: percentile(sortedUpfront, 10),
    p25: percentile(sortedUpfront, 25),
    p50: percentile(sortedUpfront, 50),
    p75: percentile(sortedUpfront, 75),
    p90: percentile(sortedUpfront, 90),
  };

  const candidateTotalDealPercentile = input.candidateTotalDeal_M != null
    ? rankPercentile(sortedTotal, input.candidateTotalDeal_M)
    : null;
  const candidateUpfrontPercentile = input.candidateUpfront_M != null
    ? rankPercentile(sortedUpfront, input.candidateUpfront_M)
    : null;

  const narrative = buildNarrative(
    pool.length,
    matchLevel,
    candidateUpfrontPercentile,
    candidateTotalDealPercentile,
    input,
  );

  return {
    n: pool.length,
    matchLevel,
    totalDealPercentiles,
    upfrontPercentiles,
    candidateTotalDealPercentile,
    candidateUpfrontPercentile,
    narrative,
  };
}

function buildNarrative(
  n: number,
  matchLevel: PeerBenchmarkResult['matchLevel'],
  upfrontPct: number | null,
  totalPct: number | null,
  input: PeerBenchmarkInput,
): string {
  if (n < 3) return 'Too few comparable deals for a meaningful benchmark.';

  const scopeDescription = (() => {
    if (matchLevel === 'strict') return `${n} same-TA, same-phase, same-modality comparables`;
    if (matchLevel === 'widened') return `${n} same-TA, same-phase comparables (modality widened)`;
    if (matchLevel === 'ta-only') return `${n} same-TA comparables`;
    return `${n} comparable deals (broad)`;
  })();

  if (upfrontPct != null && totalPct != null) {
    const uf = `p${upfrontPct}`;
    const td = `p${totalPct}`;
    return `Your deal sits at ${uf} on upfront and ${td} on total value vs ${scopeDescription}.`;
  }
  if (upfrontPct != null) {
    return `Your upfront sits at p${upfrontPct} vs ${scopeDescription}.`;
  }
  if (totalPct != null) {
    return `Your total deal value sits at p${totalPct} vs ${scopeDescription}.`;
  }
  return `${scopeDescription} available. Enter an upfront or total deal value to see where you sit.`;
}

const MIN_POOL_FOR_STRICT = 8;
const MIN_POOL_FOR_WIDENED = 5;
const MIN_POOL_FOR_TA = 5;

/**
 * Compute peer benchmark with progressive filter widening:
 *   1. strict: TA + phase + modality
 *   2. widened: TA + phase (modality dropped)
 *   3. ta-only: TA alone
 *   4. global: full corpus
 */
export function computePeerBenchmark(input: PeerBenchmarkInput): PeerBenchmarkResult {
  const corpus = combinedCorpus();

  // Try strict
  const strict = corpus.filter(d => matchesFilter(d, {
    ta: input.therapeuticArea,
    phase: input.phase,
    modality: input.modality,
  }));
  if (strict.length >= MIN_POOL_FOR_STRICT) {
    return computeStats(strict, input, 'strict');
  }

  const widened = corpus.filter(d => matchesFilter(d, {
    ta: input.therapeuticArea,
    phase: input.phase,
  }));
  if (widened.length >= MIN_POOL_FOR_WIDENED) {
    return computeStats(widened, input, 'widened');
  }

  const taOnly = corpus.filter(d => matchesFilter(d, {
    ta: input.therapeuticArea,
  }));
  if (taOnly.length >= MIN_POOL_FOR_TA) {
    return computeStats(taOnly, input, 'ta-only');
  }

  return computeStats(corpus, input, 'global');
}
