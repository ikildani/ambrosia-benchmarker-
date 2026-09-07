/**
 * One comp population: the hero band / badge / percentile context
 * (summarizePeerBenchmarkPool) and the Comparables tab
 * (computeBenchmarkRange) must return the SAME recency-weighted median for
 * the same pool. Also covers the offline-sample labelling and the
 * 10-minute server cache.
 */

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(),
  createServerClient: jest.fn(),
}));

import {
  summarizePeerBenchmarkPool,
  toOfflineSample,
  computePeerBenchmark,
  relaxationToMatchLevel,
  type PeerBenchmarkPoolDeal,
} from '@/lib/peer-benchmark';
import { computeBenchmarkRange } from '@/lib/comparableDeals.server';
import { computeCompStats } from '@/lib/comparable-scoring';
import { assessQueryConfidence } from '@/components/results/QueryConfidenceBadge';

const FIXTURE_POOL: PeerBenchmarkPoolDeal[] = [
  { upfrontM: 40, totalValueM: 400, year: 2026, royaltyLowPct: 8 },
  { upfrontM: 75, totalValueM: 900, year: 2025, royaltyLowPct: 10 },
  { upfrontM: 120, totalValueM: 1500, year: 2024, royaltyLowPct: 12 },
  { upfrontM: 25, totalValueM: 300, year: 2023, royaltyLowPct: null },
  { upfrontM: 200, totalValueM: 2200, year: 2026, royaltyLowPct: 15 },
  { upfrontM: null, totalValueM: 650, year: 2025, royaltyLowPct: null }, // undisclosed upfront
  { upfrontM: 60, totalValueM: null, year: 2022, royaltyLowPct: 6 },     // undisclosed total
  { upfrontM: 90, totalValueM: 1100, year: 2021, royaltyLowPct: 9 },
  { upfrontM: 15, totalValueM: 150, year: 2020, royaltyLowPct: 5 },
  { upfrontM: 300, totalValueM: 3000, year: 2025, royaltyLowPct: 18 },
];

describe('peer benchmark — one comp population', () => {
  it('hero p50 equals the Comparables-tab market median for the same pool (recency-weighted)', () => {
    const summary = summarizePeerBenchmarkPool(FIXTURE_POOL, { relaxation: 'none' });
    const range = computeBenchmarkRange(FIXTURE_POOL);

    expect(summary.upfrontPercentiles.p50).toBe(range.upfront.median);
    expect(summary.upfrontPercentiles.p25).toBe(range.upfront.p25);
    expect(summary.upfrontPercentiles.p75).toBe(range.upfront.p75);
    expect(summary.totalDealPercentiles.p50).toBe(range.totalValue.median);
    expect(summary.totalDealPercentiles.p25).toBe(range.totalValue.p25);
    expect(summary.totalDealPercentiles.p75).toBe(range.totalValue.p75);

    expect(summary.n).toBe(range.n);
    expect(summary.nDisclosedUpfront).toBe(range.nUpfront);
    expect(summary.nDisclosedTotal).toBe(range.nTotal);
    expect(summary.source).toBe('live');
    expect(summary.weighting).toBe('recency');
  });

  it('is monotone p10 <= p25 <= p50 <= p75 <= p90 and reports royalties when >= 3 disclosed', () => {
    const s = summarizePeerBenchmarkPool(FIXTURE_POOL, { relaxation: 'modality_only', excludedApprovedMA: 2 });
    for (const set of [s.upfrontPercentiles, s.totalDealPercentiles, s.royaltyPercentiles!]) {
      expect(set.p10).toBeLessThanOrEqual(set.p25);
      expect(set.p25).toBeLessThanOrEqual(set.p50);
      expect(set.p50).toBeLessThanOrEqual(set.p75);
      expect(set.p75).toBeLessThanOrEqual(set.p90);
    }
    expect(s.nDisclosedRoyalty).toBe(8);
    expect(s.matchLevel).toBe('widened');
    expect(s.relaxation).toBe('modality_only');
    expect(s.excludedApprovedMA).toBe(2);
  });

  it('documents that the transparency "raw" stats are a different (unweighted) helper', () => {
    // The chosen convention is recency-weighted. computeCompStats (used by
    // /api/deals/transparency) is unweighted, so it is NOT expected to agree
    // in general — this pins the fact so nobody re-labels them as the same.
    const s = summarizePeerBenchmarkPool(FIXTURE_POOL, { relaxation: 'none' });
    const raw = computeCompStats(FIXTURE_POOL.filter(d => d.upfrontM).map(d => d.upfrontM!))!;
    expect(raw.n).toBe(s.nDisclosedUpfront);
    // Unweighted median of [15,25,40,60,75,90,120,200,300] = 75
    expect(raw.median).toBe(75);
    // Recency-weighted median leans toward newer deals (2025/2026) — must be >= unweighted here
    expect(s.upfrontPercentiles.p50).toBeGreaterThanOrEqual(raw.median);
  });

  it('empty pool yields zeros and no royalty percentiles', () => {
    const s = summarizePeerBenchmarkPool([], { relaxation: 'ta_only' });
    expect(s.n).toBe(0);
    expect(s.upfrontPercentiles.p50).toBe(0);
    expect(s.royaltyPercentiles).toBeNull();
    expect(s.matchLevel).toBe('ta-only');
  });

  it('relaxation → matchLevel mapping', () => {
    expect(relaxationToMatchLevel('none')).toBe('strict');
    expect(relaxationToMatchLevel('modality_only')).toBe('widened');
    expect(relaxationToMatchLevel('ta_only')).toBe('ta-only');
  });
});

describe('peer benchmark — offline sample fallback', () => {
  it('tags the static corpus result as an offline, unweighted sample', () => {
    const stat = computePeerBenchmark({ therapeuticArea: 'oncology', phase: 'phase2', modality: 'smallMolecule' });
    const s = toOfflineSample(stat);
    expect(s.source).toBe('offline sample');
    expect(s.weighting).toBe('unweighted');
    expect(s.relaxation).toBeNull();
    expect(s.n).toBe(stat.n);
    expect(s.upfrontPercentiles).toEqual(stat.upfrontPercentiles);
    expect(s.totalDealPercentiles).toEqual(stat.totalDealPercentiles);
    expect(s.royaltyPercentiles).toBeNull();
  });

  it('confidence badge carries the source and mentions "offline sample" when not live', () => {
    const live = summarizePeerBenchmarkPool(FIXTURE_POOL, { relaxation: 'none' });
    const a = assessQueryConfidence(live, live.upfrontPercentiles.p50);
    expect(a.source).toBe('live');
    expect(a.level).toBe('high');
    expect(a.description).toContain('inside the p25–p75 band');
    expect(a.description).not.toContain('offline sample');

    const offline = { ...live, source: 'offline sample' as const, weighting: 'unweighted' as const, relaxation: null };
    const b = assessQueryConfidence(offline, 1);
    expect(b.source).toBe('offline sample');
    expect(b.description).toContain('offline sample');
    expect(b.description).toContain('outside the p10–p90 band');
  });
});

describe('peer benchmark — live server path', () => {
  const mockFind = jest.fn();
  const mockIn = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    mockFind.mockReset();
    mockIn.mockReset();
    jest.doMock('@/lib/comparableDeals.server', () => ({
      findEnrichedComparableDeals: mockFind,
    }));
    jest.doMock('@/lib/supabase/server', () => ({
      createServiceClient: () => ({
        from: () => ({ select: () => ({ in: mockIn }) }),
      }),
      createServerClient: jest.fn(),
    }));
  });

  const enrichedPool = FIXTURE_POOL.map((d, i) => ({
    id: `d${i}`,
    upfrontM: d.upfrontM,
    totalValueM: d.totalValueM,
    year: d.year,
  }));

  it('uses the same pool as the Comparables tab (maxDeals = 30) and caches for 10 minutes per key', async () => {
    mockFind.mockResolvedValue({ deals: enrichedPool, relaxation: 'none', excludedApprovedMA: 1, benchmarkRange: computeBenchmarkRange(enrichedPool) });
    mockIn.mockResolvedValue({ data: enrichedPool.map((d, i) => ({ id: d.id, royalty_low_pct: FIXTURE_POOL[i].royaltyLowPct })) });

    const mod = await import('@/lib/peer-benchmark.server');
    mod.clearPeerBenchmarkCache();

    const input = { therapeuticArea: 'oncology', phase: 'phase_2', modality: 'small_molecule', indication: 'nsclc', dealType: 'licensing' };
    const t0 = 1_000_000;
    const a = await mod.computeLivePeerBenchmark(input, { now: t0 });

    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind.mock.calls[0][1]).toBe(mod.COMPARABLES_POOL_SIZE);
    expect(mod.COMPARABLES_POOL_SIZE).toBe(30);
    expect(a.source).toBe('live');
    expect(a.n).toBe(enrichedPool.length);
    expect(a.excludedApprovedMA).toBe(1);
    expect(a.upfrontPercentiles.p50).toBe(computeBenchmarkRange(enrichedPool).upfront.median);
    expect(a.royaltyPercentiles).not.toBeNull();

    // Same key inside TTL → cache hit
    const b = await mod.computeLivePeerBenchmark({ ...input, territory: 'global' }, { now: t0 + 5 * 60 * 1000 });
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);

    // After TTL → recomputed
    await mod.computeLivePeerBenchmark(input, { now: t0 + mod.PEER_BENCHMARK_CACHE_TTL_MS + 1 });
    expect(mockFind).toHaveBeenCalledTimes(2);

    // Different query → separate key
    await mod.computeLivePeerBenchmark({ ...input, phase: 'phase_3' }, { now: t0 });
    expect(mockFind).toHaveBeenCalledTimes(3);
  });

  it('degrades gracefully when the royalty lookup fails', async () => {
    mockFind.mockResolvedValue({ deals: enrichedPool, relaxation: 'ta_only', excludedApprovedMA: 0, benchmarkRange: computeBenchmarkRange(enrichedPool) });
    mockIn.mockRejectedValue(new Error('boom'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const mod = await import('@/lib/peer-benchmark.server');
    mod.clearPeerBenchmarkCache();
    const s = await mod.computeLivePeerBenchmark({ therapeuticArea: 'neurology' }, { now: 1 });
    expect(s.royaltyPercentiles).toBeNull();
    expect(s.nDisclosedRoyalty).toBe(0);
    expect(s.matchLevel).toBe('ta-only');
    expect(s.upfrontPercentiles.p50).toBe(computeBenchmarkRange(enrichedPool).upfront.median);
    warn.mockRestore();
  });
});
