import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { captureApiError } from '@/lib/sentry-api';

export async function GET(request: NextRequest) {
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'calculations', RATE_LIMIT_CONFIGS.calculations);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const history = searchParams.get('history') === 'true';
    const userId = searchParams.get('user_id');
    const weekParam = searchParams.get('week'); // e.g. "2024-02-05" for deep link from email

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

    const isPro = userTier === 'pro';

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
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
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

      return NextResponse.json({ snapshots: gatedSnapshots });
    }

    // Build snapshot query — support ?week= deep link
    let snapshotQuery = supabase
      .from('market_snapshots')
      .select('*')
      .eq('snapshot_type', 'weekly');

    if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
      snapshotQuery = snapshotQuery.eq('snapshot_date', weekParam);
    } else {
      snapshotQuery = snapshotQuery.order('snapshot_date', { ascending: false }).limit(1);
    }

    const [snapshotResult, dealsResult] = await Promise.all([
      snapshotQuery.single(),

      supabase
        .from('deals')
        .select('id, licensor_name, licensee_name, asset_name, modality, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, therapeutic_area, indication_category')
        .gte('announced_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('announced_date', { ascending: false }),
    ]);

    if (snapshotResult.error) {
      console.error('Pulse snapshot error:', snapshotResult.error);
      return NextResponse.json({ error: 'No snapshot available' }, { status: 404 });
    }

    const snapshot = snapshotResult.data;
    const deals = dealsResult.data || [];

    // Gate data for free users
    if (!isPro) {
      return NextResponse.json({
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

    return NextResponse.json({
      snapshot,
      deals,
      total_deals: deals.length,
      is_pro: true,
    });
  } catch (error) {
    captureApiError(error, 'pulse');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
