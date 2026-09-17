/**
 * Asset Radar — facet counts for the filter rail.
 *
 * GET /api/radar/facets?<same filter params as /api/radar/feed>
 *   → { facets: { region: [{value,count}], country: [...], ... }, total, cached }
 *
 * One RPC call (radar_facet_counts, migration 117) per distinct filter
 * fingerprint; results are cached in-memory for five minutes so a user
 * toggling facets back and forth hits the database once per combination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import {
  parseFilters,
  resolvePhaseList,
  filtersFingerprint,
  MULTI_FACET_KEYS,
  type MultiFacetKey,
  type RadarFilterState,
} from '@/lib/radar/client/filter-schema';
import type { FacetBucket, FacetsResponse } from '@/lib/radar/client/api-types';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 300;

interface CacheEntry {
  expires: number;
  body: Omit<FacetsResponse, 'cached'>;
}

// Module-level cache: survives across requests on a warm serverless instance,
// bounded so a scan of random filter combinations cannot grow it unbounded.
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): CacheEntry['body'] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.body;
}

function cacheSet(key: string, body: CacheEntry['body']): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, body });
}

/** RPC argument: the same keys as the filter state, with the phase range already resolved to a list. */
function toRpcFilters(f: RadarFilterState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of MULTI_FACET_KEYS) {
    if (key === 'phase') continue;
    if (f[key].length) out[key] = f[key];
  }
  const phases = resolvePhaseList(f);
  if (phases) out.phase = phases;
  if (f.min_score !== null) out.min_score = f.min_score;
  if (f.q) out.q = f.q;
  return out;
}

function emptyFacets(): Record<MultiFacetKey, FacetBucket[]> {
  return Object.fromEntries(MULTI_FACET_KEYS.map(k => [k, [] as FacetBucket[]])) as unknown as Record<MultiFacetKey, FacetBucket[]>;
}

export async function GET(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const filters = parseFilters(request.nextUrl.searchParams);
  const key = filtersFingerprint(filters);

  const cached = cacheGet(key);
  if (cached) {
    const body: FacetsResponse = { ...cached, cached: true };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'private, max-age=60' } });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('radar_facet_counts', { filters: toRpcFilters(filters) });
  if (error) {
    console.error('[radar/facets] rpc error:', error.message);
    return NextResponse.json({ error: 'Failed to load facet counts' }, { status: 500 });
  }

  const facets = emptyFacets();
  let total = 0;
  for (const row of (data ?? []) as { facet: string; value: string | null; count: number | string }[]) {
    const count = Number(row.count) || 0;
    if (row.facet === '_total') {
      total = count;
      continue;
    }
    if (row.value === null) continue;
    if ((MULTI_FACET_KEYS as readonly string[]).includes(row.facet)) {
      facets[row.facet as MultiFacetKey].push({ value: row.value, count });
    }
  }

  const body: Omit<FacetsResponse, 'cached'> = { facets, total };
  cacheSet(key, body);
  return NextResponse.json({ ...body, cached: false } satisfies FacetsResponse, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  });
}
