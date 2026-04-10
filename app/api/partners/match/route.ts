import { NextRequest } from 'next/server';
import { createServiceClient, createServerClient } from '@/lib/supabase/server';
import { findPartnerMatches, getDealHistoryCrossReference, MatchInput, FindPartnerMatchesOptions } from '@/lib/services/partner-matching';
import { isProEmail } from '@/lib/config/authorized-emails';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { captureApiError } from '@/lib/sentry-api';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';
import { partnerMatchSchema, formatZodErrors } from '@/lib/api-validation';

// Tier-based match limits
const MATCH_LIMITS: Record<string, number> = {
  free: 3,
  report: 10,
  pro: 10,
};

export async function POST(request: NextRequest) {
  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'partnerMatch', RATE_LIMIT_CONFIGS.partnerMatch);

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders('Too many requests. Please try again later.', 429, getRateLimitHeaders(rateLimitResult), 'RATE_LIMITED');
  }

  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const parsed = partnerMatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const {
      calculation_id,
      session_id,
      anonymous_id,
      user_id,
      user_email,
      tier: clientTier,
      modality,
      development_phase,
      indication_category,
      indication_specific,
      territory_scope,
      therapeutic_area,
      regulatory_designations,
      dealType,
    } = parsed.data;

    // Determine user tier from verified sources (3 methods, in priority order)
    let userTier: 'free' | 'pro' | 'report' = 'free';
    let authenticatedUserId: string | null = null;

    // Method 1: Verify session from cookie (most reliable — server-side auth)
    try {
      const serverClient = await createServerClient();
      const { data: { user: sessionUser } } = await serverClient.auth.getUser();
      if (sessionUser) {
        authenticatedUserId = sessionUser.id;
        // Check database profile for tier
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, tier')
          .eq('id', sessionUser.id)
          .single();
        if (profile) {
          userTier = (profile.tier as 'free' | 'pro' | 'report') || 'free';
        }
        // Check PRO_EMAILS using verified session email
        if (userTier === 'free' && sessionUser.email && isProEmail(sessionUser.email)) {
          userTier = 'pro';
        }
      }
    } catch {
      // Cookie-based auth not available — fall through to Method 2
    }

    // Method 2: Fallback to client-provided user_id (for non-cookie contexts)
    if (userTier === 'free' && !authenticatedUserId && user_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, tier, email')
        .eq('id', user_id)
        .single();

      if (profile) {
        authenticatedUserId = profile.id;
        userTier = (profile.tier as 'free' | 'pro' | 'report') || 'free';
        // Check PRO_EMAILS using database-verified email
        if (userTier === 'free' && profile.email && isProEmail(profile.email)) {
          userTier = 'pro';
        }
      }
    }

    // Method 3: Fallback to client-provided email for PRO_EMAILS allowlist check
    // This is safe because isProEmail() checks against a server-controlled env var list.
    // Covers users who signed in via custom form (no Supabase session, no DB profile).
    if (userTier === 'free' && !authenticatedUserId && user_email) {
      if (isProEmail(user_email)) {
        userTier = 'pro';
      }
      // Also try to find their profile by email (may have signed up with different ID)
      if (userTier === 'free') {
        const { data: emailProfile } = await supabase
          .from('user_profiles')
          .select('id, tier, email')
          .eq('email', user_email.toLowerCase().trim())
          .single();
        if (emailProfile) {
          authenticatedUserId = emailProfile.id;
          userTier = (emailProfile.tier as 'free' | 'pro' | 'report') || 'free';
          if (userTier === 'free' && emailProfile.email && isProEmail(emailProfile.email)) {
            userTier = 'pro';
          }
        }
      }
    }

    // SECURITY: Tier is verified server-side (session cookie, database, or PRO_EMAILS allowlist).
    // Client-provided tier is never trusted for authorization.

    // DEV ONLY: Allow ?test_tier=free to override tier for testing gating
    if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'preview') {
      const url = new URL(request.url);
      const testTier = url.searchParams.get('test_tier');
      if (testTier === 'free' || testTier === 'pro' || testTier === 'report') {
        userTier = testTier;
      }
    }

    // Build match input
    const matchInput: MatchInput = {
      modality,
      development_phase,
      indication_category: indication_category || null,
      indication_specific: indication_specific || null,
      territory_scope: territory_scope || null,
      therapeutic_area: therapeutic_area || null,
      regulatory_designations: regulatory_designations || undefined,
      dealType: dealType || undefined,
    };

    // Build options - include enhanced breakdown for Pro/Report tier
    const hasPaidAccess = userTier === 'pro' || userTier === 'report';
    const matchOptions: FindPartnerMatchesOptions = {
      limit: 50,
      includeEnhancedBreakdown: hasPaidAccess,
    };

    // Find matches
    const result = await findPartnerMatches(supabase, matchInput, matchOptions);

    // Determine how many to show based on tier
    const matchLimit = MATCH_LIMITS[userTier] || MATCH_LIMITS.free;
    const matchesToShow = result.matches.slice(0, matchLimit);
    const hiddenMatches = result.total_matches - matchLimit;

    // Prepare response based on tier
    const responseMatches = matchesToShow.map((match, index) => {
      if (!hasPaidAccess) {
        // Free tier: names, match score, and top 2 reasons (profile data hidden)
        return {
          rank: index + 1,
          company_id: match.company_id,
          company_name: match.company_name,
          company_type: match.company_type,
          match_score: match.match_score,
          match_reasons: match.match_reasons.slice(0, 2),
          profile_locked: true,
          // Blurred/hidden fields
          modalities_active: null,
          indications_active: null,
          deals_last_12mo: null,
          last_deal_date: null,
          active_trials_count: null,
          avg_upfront_usd: null,
        };
      } else {
        // Pro/Report tier: full profile data with enhanced breakdown
        return {
          rank: index + 1,
          company_id: match.company_id,
          company_name: match.company_name,
          company_type: match.company_type,
          ticker: match.ticker,
          hq_country: match.hq_country,
          match_score: match.match_score,
          match_reasons: match.match_reasons,
          score_breakdown: match.score_breakdown,
          modalities_active: match.modalities_active,
          modalities_primary: match.modalities_primary,
          indications_active: match.indications_active,
          indications_specific: match.indications_specific,
          deals_last_12mo: match.deals_last_12mo,
          deals_last_24mo: match.deals_last_24mo,
          last_deal_date: match.last_deal_date,
          last_deal_modality: match.last_deal_modality,
          active_trials_count: match.active_trials_count,
          avg_upfront_usd: match.avg_upfront_usd,
          median_upfront_usd: match.median_upfront_usd,
          phase_preference_min: match.phase_preference_min,
          phase_preference_max: match.phase_preference_max,
          acquisition_appetite: match.acquisition_appetite,
          data_quality_score: match.data_quality_score,
          profile_locked: false,
          // Enhanced breakdown (Pro tier only)
          detailed_breakdown: match.detailed_breakdown || null,
          watch_outs: match.watch_outs || null,
          relevant_deals: match.relevant_deals || null,
          strategic_context: match.strategic_context || null,
          // Pharma Intent Score (Pro tier only)
          pharma_intent: match.pharma_intent || null,
        };
      }
    });

    // Store match result for analytics
    const matchResultData = {
      user_id: authenticatedUserId,
      session_id: session_id || null,
      anonymous_id: anonymous_id || null,
      calculation_id: calculation_id || null,
      input_modality: modality,
      input_phase: development_phase,
      input_indication_category: indication_category || null,
      input_indication_specific: indication_specific || null,
      input_territory: territory_scope || null,
      matches_total: result.total_matches,
      matches_shown: matchLimit,
      match_results: result.matches.slice(0, 10).map(m => ({
        company_id: m.company_id,
        company_name: m.company_name,
        match_score: m.match_score,
      })),
      top_match_company: result.matches[0]?.company_name || null,
      top_match_score: result.matches[0]?.match_score || null,
      avg_match_score: result.matches.length > 0
        ? result.matches.reduce((sum, m) => sum + m.match_score, 0) / result.matches.length
        : null,
      user_tier: userTier,
    };

    await supabase.from('partner_match_results').insert(matchResultData);

    // Track event
    await supabase.from('events').insert({
      user_id: authenticatedUserId,
      session_id: session_id || null,
      anonymous_id: anonymous_id || null,
      event_type: 'partner_match_requested',
      event_data: {
        calculation_id,
        modality,
        development_phase,
        indication_category,
        indication_specific,
        territory_scope,
        matches_total: result.total_matches,
        matches_shown: matchLimit,
        top_match_score: result.matches[0]?.match_score || null,
      },
      user_tier: userTier,
    });

    // Deal history cross-reference for paid users (top 5 partners)
    let dealHistoryCrossRef: Awaited<ReturnType<typeof getDealHistoryCrossReference>> | null = null;
    if (hasPaidAccess && matchesToShow.length > 0) {
      try {
        dealHistoryCrossRef = await getDealHistoryCrossReference(
          supabase,
          matchesToShow.slice(0, 5),
          matchInput,
          3
        );
      } catch (err) {
        console.error('Deal history cross-reference error (non-fatal):', err);
      }
    }

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      total_matches: result.total_matches,
      matches_shown: matchLimit,
      matches: responseMatches,
      deal_history: dealHistoryCrossRef || undefined,
      user_tier: userTier,
      generated_at: result.generated_at,
    };

    // Add upgrade CTA for free users
    if (!hasPaidAccess && hiddenMatches > 0) {
      response.upgrade_cta = {
        type: 'partner_profiles',
        message: `Upgrade to Pro to see ${hiddenMatches} more potential partners with full profiles`,
        remaining_hidden: hiddenMatches,
        features: [
          'See 5 partner matches (vs 2)',
          'Full company profiles & deal history',
          'Patent cliff & acquisition signals',
          'Avg upfront & deal activity metrics',
        ],
      };
    }

    // Add advisory CTA for paid users
    if (hasPaidAccess) {
      response.advisory_cta = {
        message: 'Need deeper partner analysis? Our advisory team provides full market mapping, warm introductions, and deal support.',
        cta_text: 'Book a Call',
        cta_url: 'https://calendly.com/ambrosiaventures/strategy-session',
        features: [
          'Comprehensive partner landscape analysis',
          'Warm introductions to BD teams',
          'Deal structuring support',
          'Negotiation advisory',
        ],
      };
    }

    return apiSuccess(response);

  } catch (error) {
    captureApiError(error, 'partners-match');
    return apiError('Failed to find partner matches', 500);
  }
}
// Trigger rebuild 1770005077
