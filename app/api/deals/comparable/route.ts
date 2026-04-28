import { requireSingleSession } from "@/lib/auth/require-single-session";
import { NextRequest, NextResponse } from 'next/server';
import { findComparableDealsWithDB, findEnrichedComparableDeals } from '@/lib/comparableDeals.server';
import { findSimilarDeals } from '@/lib/embeddings';
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
    const sessionCheck = await requireSingleSession(request);
    if (sessionCheck) return sessionCheck;
    const params = request.nextUrl.searchParams;
    const therapeuticArea = params.get('therapeuticArea') || 'oncology';
    const modality = params.get('modality') || '';
    const indication = params.get('indication') || '';
    const phase = params.get('phase') || undefined;
    const dealType = params.get('dealType') || undefined;
    const enriched = params.get('enriched') === 'true';

    // Verify tier server-side to prevent free users from accessing all deals via API
    const tier = await getUserTier();
    const hasFullAccess = tier === 'pro' || tier === 'report';

    // Enriched mode: return full scoring details + benchmark range for comp selector
    if (enriched) {
      const { deals: enrichedDeals, benchmarkRange } = await findEnrichedComparableDeals(
        { therapeuticArea, modality, indication, phase, dealType },
        hasFullAccess ? 30 : 30,
      );
      const deals = hasFullAccess ? enrichedDeals : enrichedDeals.slice(0, FREE_DEAL_LIMIT);
      return NextResponse.json({
        deals,
        benchmarkRange,
        totalAvailable: enrichedDeals.length,
        enriched: true,
      });
    }

    // Legacy mode: keyword + semantic matching (existing behavior)
    const keywordDeals = await findComparableDealsWithDB(
      { therapeuticArea, modality, indication, phase },
      hasFullAccess ? 15 : 15
    );

    let semanticDeals: typeof keywordDeals = [];
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (perplexityKey && hasFullAccess) {
      try {
        const supabase = createServiceClient();
        const dbResults = await findSimilarDeals(supabase, perplexityKey, {
          therapeuticArea,
          indication,
          modality,
          phase,
          territory: params.get('territory') || undefined,
          dealType,
        }, 10);

        semanticDeals = dbResults.map((d, idx) => ({
          id: `sem-${idx}`,
          parties: `${d.licensor_name} / ${d.licensee_name}`,
          totalValue: d.total_deal_value_usd
            ? (d.total_deal_value_usd >= 1_000_000_000
              ? `$${(d.total_deal_value_usd / 1_000_000_000).toFixed(1)}B`
              : `$${Math.round(d.total_deal_value_usd / 1_000_000)}M`)
            : 'Undisclosed',
          year: d.announced_date ? new Date(d.announced_date).getFullYear() : new Date().getFullYear(),
          phase: undefined,
          relevanceReasons: [`${Math.round(d.similarity * 100)}% match`],
        }));
      } catch {
        // Silent fallback
      }
    }

    const seen = new Set<string>();
    const merged = [...semanticDeals, ...keywordDeals].filter(deal => {
      const key = `${deal.parties.toLowerCase()}|${deal.year}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const allDeals = merged.slice(0, hasFullAccess ? 15 : 15);
    const deals = hasFullAccess ? allDeals : allDeals.slice(0, FREE_DEAL_LIMIT);
    const totalAvailable = allDeals.length;

    return NextResponse.json({ deals, totalAvailable, semantic: semanticDeals.length > 0 });
  } catch (error) {
    captureApiError(error, 'deals-comparable');
    return NextResponse.json(
      { deals: [], error: 'Failed to fetch comparable deals' },
      { status: 500 }
    );
  }
}
