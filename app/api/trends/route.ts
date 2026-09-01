import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { aggregateDealsByQuarter, computeMomentumSignals } from '@/lib/services/trend-aggregation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'trends', RATE_LIMIT_CONFIGS.calculations);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const supabase = createServiceClient();
    const searchParams = request.nextUrl.searchParams;

    const ta = searchParams.get('ta') || undefined;
    const modality = searchParams.get('modality') || undefined;
    const fromYear = searchParams.get('from') ? parseInt(searchParams.get('from')!) : undefined;
    const toYear = searchParams.get('to') ? parseInt(searchParams.get('to')!) : undefined;

    if (fromYear && (isNaN(fromYear) || fromYear < 2017 || fromYear > 2030)) {
      return NextResponse.json({ success: false, error: 'Invalid from year' }, { status: 400 });
    }
    if (toYear && (isNaN(toYear) || toYear < 2017 || toYear > 2030)) {
      return NextResponse.json({ success: false, error: 'Invalid to year' }, { status: 400 });
    }

    const quarters = await aggregateDealsByQuarter(supabase, { ta, modality, fromYear, toYear });
    const momentum = computeMomentumSignals(quarters);

    let userTier = 'free';
    try {
      const { createServerClient } = await import('@/lib/supabase/server');
      const authClient = await createServerClient();
      const { data: { user } } = await authClient.auth.getUser();
      if (user?.id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tier')
          .eq('id', user.id)
          .single();
        userTier = profile?.tier || 'free';
        if (userTier === 'free' && user.email) {
          const { isProEmailClient } = await import('@/lib/config/authorized-emails.client');
          if (isProEmailClient(user.email)) userTier = 'pro';
        }
      }
    } catch {
      // Session check failed — serve free tier
    }

    // Email fallback — if cookie auth failed, check email param
    if (userTier === 'free') {
      const emailParam = new URL(request.url).searchParams.get('email');
      if (emailParam) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tier')
          .eq('email', emailParam.toLowerCase().trim())
          .maybeSingle();
        if (profile?.tier === 'pro' || profile?.tier === 'report' || profile?.tier === 'portfolio') {
          userTier = profile.tier;
        }
      }
    }

    const hasPro = userTier === 'pro' || userTier === 'portfolio' || userTier === 'report';

    const sanitizedQuarters = quarters.map(q => ({
      quarter: q.quarter,
      year: q.year,
      dealCount: q.dealCount,
      medianUpfrontM: hasPro ? q.medianUpfrontM : null,
      medianTotalM: hasPro ? q.medianTotalM : null,
      avgRoyaltyLow: hasPro ? q.avgRoyaltyLow : null,
      avgRoyaltyHigh: hasPro ? q.avgRoyaltyHigh : null,
      byTA: q.byTA,
      byModality: hasPro ? q.byModality : {},
      byPhase: hasPro ? q.byPhase : {},
      byDealType: hasPro ? q.byDealType : {},
    }));

    return NextResponse.json(
      {
        success: true,
        quarters: sanitizedQuarters,
        momentum: hasPro ? momentum : momentum.slice(0, 2),
        tier: userTier,
        meta: { timestamp: new Date().toISOString() },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
          ...getRateLimitHeaders(rateLimitResult),
        },
      }
    );
  } catch (err) {
    console.error('[trends] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
