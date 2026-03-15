import { NextRequest, NextResponse } from 'next/server';
import { findComparableDealsWithDB } from '@/lib/comparableDeals.server';
import { captureApiError } from '@/lib/sentry-api';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isProEmailClient } from '@/lib/config/authorized-emails.client';

export const dynamic = 'force-dynamic';

const FREE_DEAL_LIMIT = 3;

// Server-side tier verification for comparable deals
async function getUserTier(): Promise<'free' | 'pro' | 'report'> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) return 'free';

    // Check email allowlist first
    if (isProEmailClient(user.email)) return 'pro';

    // Check database tier (set by Stripe webhook)
    const serviceClient = createServiceClient();
    const { data: profile } = await serviceClient
      .from('user_profiles')
      .select('tier')
      .eq('id', user.id)
      .single();

    if (profile?.tier === 'pro' || profile?.tier === 'report') {
      return profile.tier as 'pro' | 'report';
    }

    return 'free';
  } catch {
    return 'free';
  }
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'deals-comparable', RATE_LIMIT_CONFIGS.deals);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { deals: [], error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const params = request.nextUrl.searchParams;
    const therapeuticArea = params.get('therapeuticArea') || 'oncology';
    const modality = params.get('modality') || '';
    const indication = params.get('indication') || '';
    const phase = params.get('phase') || undefined;

    // Verify tier server-side to prevent free users from accessing all deals via API
    const tier = await getUserTier();
    const hasFullAccess = tier === 'pro' || tier === 'report';

    // Fetch all matching deals to get total count
    const allDeals = await findComparableDealsWithDB(
      { therapeuticArea, modality, indication, phase },
      hasFullAccess ? 10 : 15 // Fetch enough to show total count for free users
    );

    // Limit response for free users - server-side enforcement
    const deals = hasFullAccess ? allDeals : allDeals.slice(0, FREE_DEAL_LIMIT);
    const totalAvailable = allDeals.length;

    return NextResponse.json({ deals, totalAvailable });
  } catch (error) {
    captureApiError(error, 'deals-comparable');
    return NextResponse.json(
      { deals: [], error: 'Failed to fetch comparable deals' },
      { status: 500 }
    );
  }
}
