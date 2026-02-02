import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { findPartnerMatches, MatchInput } from '@/lib/services/partner-matching';

// Tier-based match limits
const MATCH_LIMITS = {
  free: 2,
  pro: 5,
};

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const {
      calculation_id,
      session_id,
      anonymous_id,
      user_id,
      modality,
      development_phase,
      indication_category,
      indication_specific,
      territory_scope,
      tier: clientTier, // Accept tier from frontend as fallback
    } = body;

    // Validate required fields
    if (!modality || !development_phase) {
      return NextResponse.json(
        { error: 'modality and development_phase are required' },
        { status: 400 }
      );
    }

    // Determine user tier - check database first, then use client tier as fallback
    let userTier: 'free' | 'pro' = 'free';
    let authenticatedUserId: string | null = null;

    if (user_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, tier')
        .eq('id', user_id)
        .single();

      if (profile) {
        authenticatedUserId = profile.id;
        userTier = (profile.tier as 'free' | 'pro') || 'free';
      }
    }

    // Use client-provided tier as fallback (for localStorage auth users)
    if (userTier === 'free' && clientTier === 'pro') {
      userTier = 'pro';
    }

    // Build match input
    const matchInput: MatchInput = {
      modality,
      development_phase,
      indication_category: indication_category || null,
      indication_specific: indication_specific || null,
      territory_scope: territory_scope || null,
    };

    // Find matches
    const result = await findPartnerMatches(supabase, matchInput, 50);

    // Determine how many to show based on tier
    const matchLimit = MATCH_LIMITS[userTier];
    const matchesToShow = result.matches.slice(0, matchLimit);
    const hiddenMatches = result.total_matches - matchLimit;

    // Prepare response based on tier
    const responseMatches = matchesToShow.map((match, index) => {
      if (userTier === 'free') {
        // Free tier: names and match score only, profile data hidden
        return {
          rank: index + 1,
          company_id: match.company_id,
          company_name: match.company_name,
          company_type: match.company_type,
          match_score: match.match_score,
          profile_locked: true,
          // Blurred/hidden fields
          match_reasons: null,
          modalities_active: null,
          indications_active: null,
          deals_last_12mo: null,
          last_deal_date: null,
          active_trials_count: null,
          avg_upfront_usd: null,
        };
      } else {
        // Pro tier: full profile data
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

    // Build response
    const response: any = {
      success: true,
      total_matches: result.total_matches,
      matches_shown: matchLimit,
      matches: responseMatches,
      user_tier: userTier,
      generated_at: result.generated_at,
    };

    // Add upgrade CTA for free users
    if (userTier === 'free' && hiddenMatches > 0) {
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

    // Add advisory CTA for pro users
    if (userTier === 'pro') {
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

    return NextResponse.json(response);

  } catch (error) {
    console.error('Partner matching error:', error);
    return NextResponse.json(
      { error: 'Failed to find partner matches' },
      { status: 500 }
    );
  }
}
// Trigger rebuild 1770005077
