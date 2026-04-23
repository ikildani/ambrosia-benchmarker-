import { requireSingleSession } from "@/lib/auth/require-single-session";
import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { captureApiError } from '@/lib/sentry-api';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';
import { pulseQuerySchema, formatZodErrors } from '@/lib/api-validation';

export async function GET(request: NextRequest) {
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'calculations', RATE_LIMIT_CONFIGS.calculations);

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders('Too many requests', 429, getRateLimitHeaders(rateLimitResult), 'RATE_LIMITED');
  }

  try {
    const sessionCheck = await requireSingleSession(request);
    if (sessionCheck) return sessionCheck;
    const rawParams = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = pulseQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const supabase = createServiceClient();
    const history = parsed.data.history === 'true';
    const userId = parsed.data.user_id || null;
    const weekParam = parsed.data.week || null;

    // Check user tier for gating
    let userTier = 'free';
    if (userId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', userId)
        .single();
      if (profile?.tier) userTier = profile.tier;
    }

    const isPro = userTier === 'pro' || userTier === 'report';

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
        .from('deals')
        .select('id, licensor_name, licensee_name, asset_name, modality, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, therapeutic_area, indication_category, source_type')
        .eq('is_synthetic', false)  // R68: exclude 845 flagged fakes from pulse feed
        .gte('announced_date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .lte('announced_date', new Date().toISOString().split('T')[0])
        .not('therapeutic_area', 'in', '("other","_option_deals","_codev_deals","_china_deals")')
        .order('announced_date', { ascending: false })
        .limit(25),
    ]);

    if (snapshotResult.error) {
      console.error('Pulse snapshot error:', snapshotResult.error);
      return apiError('No snapshot available', 404);
    }

    const snapshot = snapshotResult.data;
    const deals = dealsResult.data || [];

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
        total_deals: deals.length,
        is_pro: false,
      });
    }

    return apiSuccess({
      snapshot,
      deals,
      total_deals: deals.length,
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
