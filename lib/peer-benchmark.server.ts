/**
 * Live peer benchmark — server only.
 *
 * Feeds the results-page hero band, QueryConfidenceBadge and MetricCard
 * percentile context with aggregate percentiles computed over the SAME pool
 * the Comparables tab renders: findEnrichedComparableDeals (Supabase,
 * is_synthetic=false, canonical, not rejected/flagged, terms disclosed,
 * stage filter, shared scoring + relaxation ladder, top COMPARABLES_POOL_SIZE
 * by match score). Percentiles are recency-weighted with the same
 * weightedQuantile/recencyWeight pairs as computeBenchmarkRange, so the hero
 * p50 equals the Comparables-tab market median for the same query.
 *
 * Results are cached in-process for 10 minutes per query key.
 *
 * Import ONLY from API routes / server code (pulls next/headers via
 * lib/supabase/server).
 *
 * @module lib/peer-benchmark.server
 */

import { createServiceClient } from '@/lib/supabase/server';
import { findEnrichedComparableDeals, type EnrichedComparableDeal } from '@/lib/comparableDeals.server';
import {
  summarizePeerBenchmarkPool,
  type PeerBenchmarkPoolDeal,
  type PeerBenchmarkSummary,
} from '@/lib/peer-benchmark';

export interface LivePeerBenchmarkInput {
  therapeuticArea: string;
  phase?: string;
  modality?: string;
  indication?: string;
  dealType?: string;
  /** Accepted for API symmetry; the comp pool is not territory-filtered. */
  territory?: string;
}

/**
 * Must equal the `maxDeals` the /api/deals/comparable enriched path passes
 * to findEnrichedComparableDeals (30). Both surfaces must summarize the same
 * rows or the medians drift apart again.
 */
export const COMPARABLES_POOL_SIZE = 30;

export const PEER_BENCHMARK_CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

interface CacheEntry {
  expiresAt: number;
  value: PeerBenchmarkSummary;
}

const cache = new Map<string, CacheEntry>();

export function peerBenchmarkCacheKey(input: LivePeerBenchmarkInput): string {
  // territory is intentionally omitted — it does not change the pool.
  return [
    input.therapeuticArea,
    input.phase ?? '',
    input.modality ?? '',
    input.indication ?? '',
    input.dealType ?? '',
  ].map(s => s.toLowerCase().trim()).join('|');
}

/** Test hook. */
export function clearPeerBenchmarkCache(): void {
  cache.clear();
}

function readCache(key: string, now: number): PeerBenchmarkSummary | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function writeCache(key: string, value: PeerBenchmarkSummary, now: number): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Evict expired first, then the oldest insertion.
    for (const [k, v] of cache) {
      if (v.expiresAt <= now) cache.delete(k);
    }
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }
  cache.set(key, { expiresAt: now + PEER_BENCHMARK_CACHE_TTL_MS, value });
}

/**
 * Royalty rates are not part of the enriched comp row, so fetch them for the
 * pool's ids in one extra query. Any failure degrades to "no royalty data".
 */
async function attachRoyalties(deals: EnrichedComparableDeal[]): Promise<PeerBenchmarkPoolDeal[]> {
  const base: PeerBenchmarkPoolDeal[] = deals.map(d => ({
    upfrontM: d.upfrontM,
    totalValueM: d.totalValueM,
    year: d.year,
    royaltyLowPct: null,
  }));
  if (deals.length === 0) return base;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('deals')
      .select('id, royalty_low_pct')
      .in('id', deals.map(d => d.id));
    const byId = new Map<string, number | null>();
    for (const row of data || []) {
      byId.set(String(row.id), row.royalty_low_pct != null ? Number(row.royalty_low_pct) : null);
    }
    return base.map((d, i) => ({ ...d, royaltyLowPct: byId.get(String(deals[i].id)) ?? null }));
  } catch (err) {
    console.warn('[peer-benchmark] royalty lookup failed, continuing without royalties:', err);
    return base;
  }
}

/**
 * Compute (or serve from cache) the live peer benchmark for a query.
 * Throws when the comparable pool cannot be fetched — the API route turns
 * that into a 5xx and the client keeps its labelled offline sample.
 */
export async function computeLivePeerBenchmark(
  input: LivePeerBenchmarkInput,
  opts: { now?: number; skipCache?: boolean } = {},
): Promise<PeerBenchmarkSummary> {
  const now = opts.now ?? Date.now();
  const key = peerBenchmarkCacheKey(input);
  if (!opts.skipCache) {
    const cached = readCache(key, now);
    if (cached) return cached;
  }

  const { deals, relaxation, excludedApprovedMA } = await findEnrichedComparableDeals(
    {
      therapeuticArea: input.therapeuticArea,
      modality: input.modality ?? '',
      indication: input.indication ?? '',
      phase: input.phase,
      dealType: input.dealType,
    },
    COMPARABLES_POOL_SIZE,
  );

  const pool = await attachRoyalties(deals);
  const summary = summarizePeerBenchmarkPool(pool, { relaxation, excludedApprovedMA });
  writeCache(key, summary, now);
  return summary;
}
