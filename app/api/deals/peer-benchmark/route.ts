/**
 * GET /api/deals/peer-benchmark
 *
 * Aggregate peer-benchmark percentiles over the SAME live comp pool the
 * Comparables tab renders (see lib/peer-benchmark.server.ts). Consumed by
 * the results-page hero band, QueryConfidenceBadge and MetricCard percentile
 * context so every "comparable deals" number on the page comes from one
 * population.
 *
 * Query params:
 *   therapeuticArea (required) · phase · modality · dealType · territory · indication
 *
 * Response 200 (all tiers — percentiles are aggregate, no deal rows):
 *   {
 *     n, matchLevel, relaxation, excludedApprovedMA,
 *     upfrontPercentiles: { p10, p25, p50, p75, p90 },   // $M, recency-weighted
 *     totalDealPercentiles: { p10, p25, p50, p75, p90 }, // $M, recency-weighted
 *     royaltyPercentiles: { ... } | null,                // %, royalty_low_pct
 *     nDisclosedUpfront, nDisclosedTotal, nDisclosedRoyalty,
 *     source: 'live', weighting: 'recency',
 *     computedAt: ISO string
 *   }
 *   400 { error } when therapeuticArea is missing
 *   429 { error } when rate-limited
 *   500 { error } when the pool cannot be fetched (client keeps its
 *       "offline sample" fallback)
 *
 * Cached server-side for 10 minutes per query key.
 */

import { requireSingleSession } from '@/lib/auth/require-single-session';
import { NextRequest, NextResponse } from 'next/server';
import { computeLivePeerBenchmark } from '@/lib/peer-benchmark.server';
import { captureApiError } from '@/lib/sentry-api';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'deals-peer-benchmark', RATE_LIMIT_CONFIGS.deals);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) },
    );
  }

  try {
    const sessionCheck = await requireSingleSession(request);
    if (sessionCheck) return sessionCheck;

    const params = request.nextUrl.searchParams;
    const therapeuticArea = (params.get('therapeuticArea') || '').trim();
    if (!therapeuticArea) {
      return NextResponse.json({ error: 'therapeuticArea parameter required' }, { status: 400 });
    }

    const summary = await computeLivePeerBenchmark({
      therapeuticArea,
      phase: params.get('phase') || undefined,
      modality: params.get('modality') || undefined,
      indication: params.get('indication') || undefined,
      dealType: params.get('dealType') || undefined,
      territory: params.get('territory') || undefined,
    });

    return NextResponse.json(
      { ...summary, computedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    captureApiError(error, 'deals-peer-benchmark');
    return NextResponse.json(
      { error: 'Failed to compute peer benchmark' },
      { status: 500 },
    );
  }
}
