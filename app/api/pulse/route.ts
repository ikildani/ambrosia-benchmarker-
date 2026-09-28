import { requireSingleSession } from "@/lib/auth/require-single-session";
import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { captureApiError } from '@/lib/sentry-api';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';
import { pulseQuerySchema, formatZodErrors } from '@/lib/api-validation';
import { collapseDuplicateDeals, canonicalModality } from '@/lib/digest/weekly-snapshot';

export async function GET(request: NextRequest) {
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'calculations', RATE_LIMIT_CONFIGS.calculations);

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders('Too many requests', 429, getRateLimitHeaders(rateLimitResult), 'RATE_LIMITED');
  }

  try {
    // Skip single-session check for read-only GET — don't block market data
    const rawParams = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = pulseQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const supabase = createServiceClient();
    const history = parsed.data.history === 'true';
    const weekParam = parsed.data.week || null;

    // Tier comes from the session only. The client still sends ?user_id=, but trusting it
    // let anyone who knew a Pro user's id read Pro data. Same-origin fetches carry the cookie.
    let userTier = 'free';
    try {
      const { getAuthenticatedUser } = await import('@/lib/auth-helpers');
      const authUser = await getAuthenticatedUser(request);
      if (authUser?.id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tier')
          .eq('id', authUser.id)
          .single();
        if (profile?.tier) userTier = profile.tier;
      }
    } catch {}

    const isPro = userTier === 'pro' || userTier === 'report' || userTier === 'portfolio';

    if (history) {
      // Return last 12 weekly snapshots for sparklines
      const { data: snapshots, error } = await supabase
        .from('market_snapshots')
        .select('*')
        .eq('snapshot_type', 'weekly')
        .order('snapshot_date', { ascending: false })
        .limit(12);

      if (error) {
        console.error('Pulse history error:', error);
        return apiError('Failed to fetch history', 500);
      }

      // For free users, null out financial details in snapshots
      const gatedSnapshots = isPro
        ? snapshots
        : (snapshots || []).map((s) => ({
            ...s,
            avg_upfront_usd: null,
            total_upfront_usd: null,
            notable_deals: [],
            modality_breakdown: nullifyFinancials(s.modality_breakdown),
            therapeutic_area_breakdown: nullifyFinancials(s.therapeutic_area_breakdown),
            phase_breakdown: nullifyFinancials(s.phase_breakdown),
          }));

      return apiSuccess({ snapshots: gatedSnapshots });
    }

    // Build snapshot query — support ?week= deep link
    let snapshotQuery = supabase
      .from('market_snapshots')
      .select('*')
      .eq('snapshot_type', 'weekly');

    if (weekParam) {
      snapshotQuery = snapshotQuery.eq('snapshot_date', weekParam);
    } else {
      snapshotQuery = snapshotQuery.order('snapshot_date', { ascending: false }).limit(1);
    }

    const [snapshotResult, dealsResult] = await Promise.all([
      snapshotQuery.single(),

      supabase
        .from('deals_verified')  // quality-filtered view (migration 147)
        .select('id, licensor_name, licensee_name, asset_name, modality, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, therapeutic_area, indication_category, source_type, verification_status, dedupe_group_id')
        .gte('announced_date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .lte('announced_date', new Date().toISOString().split('T')[0])
        .not('therapeutic_area', 'in', '("other","_option_deals","_codev_deals","_china_deals")')
        .order('announced_date', { ascending: false })
        .limit(60),
    ]);

    if (snapshotResult.error) {
      console.error('Pulse snapshot error:', snapshotResult.error);
      return apiError('No snapshot available', 404);
    }

    const snapshot = snapshotResult.data;
    const rawDeals = dealsResult.data || [];

    // Dedup canonical duplicates (dedupe group, or the same parties + asset under different
    // spellings or reversed roles), newest first, then cap the page at 25.
    const allDeals = collapseDuplicateDeals(rawDeals)
      .map((d) => ({ ...d, modality: canonicalModality(d.modality) }))
      .sort((a, b) => (b.announced_date || '').localeCompare(a.announced_date || '') || String(a.id).localeCompare(String(b.id)));
    const deals = allDeals.slice(0, 25);

    // Gate data for free users
    if (!isPro) {
      return apiSuccess({
        snapshot: {
          ...snapshot,
          avg_upfront_usd: null,
          total_upfront_usd: null,
          notable_deals: [],
          benchmark_changes: {},
          modality_breakdown: nullifyFinancials(snapshot.modality_breakdown),
          therapeutic_area_breakdown: nullifyFinancials(snapshot.therapeutic_area_breakdown),
          phase_breakdown: nullifyFinancials(snapshot.phase_breakdown),
        },
        deals: deals.slice(0, 2).map((d) => ({ ...d, upfront_usd: null, total_deal_value_usd: null })),
        total_deals: allDeals.length,
        is_pro: false,
      });
    }

    return apiSuccess({
      snapshot,
      deals,
      total_deals: allDeals.length,
      is_pro: true,
    });
  } catch (error) {
    captureApiError(error, 'pulse');
    return apiError('Internal server error', 500);
  }
}

function nullifyFinancials(breakdown: Record<string, { count: number; avg_upfront: number | null; total_value: number | null }> | null) {
  if (!breakdown) return {};
  const result: Record<string, { count: number; avg_upfront: null; total_value: null }> = {};
  for (const [key, val] of Object.entries(breakdown)) {
    result[key] = { count: val.count, avg_upfront: null, total_value: null };
  }
  return result;
}
