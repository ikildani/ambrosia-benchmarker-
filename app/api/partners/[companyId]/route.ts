import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { companyId } = params;

    // Get user info from query params or headers
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');
    const sessionId = searchParams.get('session_id');
    const anonymousId = searchParams.get('anonymous_id');
    const clientTier = searchParams.get('tier'); // Accept tier from frontend

    // Verify user tier (Pro required for full profiles)
    let userTier: 'free' | 'pro' = 'free';

    if (userId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', userId)
        .single();

      userTier = (profile?.tier as 'free' | 'pro') || 'free';
    }

    // Use client-provided tier as fallback (for localStorage auth users)
    if (userTier === 'free' && clientTier === 'pro') {
      userTier = 'pro';
    }

    // Free users can't access detailed profiles
    if (userTier !== 'pro') {
      return NextResponse.json(
        {
          error: 'Pro subscription required',
          upgrade_url: '/upgrade',
          message: 'Upgrade to Pro to view detailed partner profiles',
        },
        { status: 403 }
      );
    }

    // Fetch company details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Fetch recent deals (as licensee)
    const { data: recentDeals } = await supabase
      .from('deals')
      .select(`
        id,
        asset_name,
        modality,
        indication_category,
        indication_specific,
        phase_at_signing,
        territory,
        deal_type,
        upfront_usd,
        milestones_total_usd,
        total_deal_value_usd,
        announced_date,
        licensor_name,
        terms_disclosed
      `)
      .eq('licensee_id', companyId)
      .order('announced_date', { ascending: false })
      .limit(10);

    // Fetch active trials by indication
    const { data: trials } = await supabase
      .from('company_trials')
      .select('indication_category, indication_specific, modality, phase, status')
      .eq('company_id', companyId)
      .in('status', ['recruiting', 'active_not_recruiting', 'not_yet_recruiting']);

    // Aggregate trials by indication
    const trialsByIndication: Record<string, number> = {};
    const trialsByModality: Record<string, number> = {};
    const trialsByPhase: Record<string, number> = {};

    if (trials) {
      for (const trial of trials) {
        if (trial.indication_category) {
          trialsByIndication[trial.indication_category] = (trialsByIndication[trial.indication_category] || 0) + 1;
        }
        if (trial.modality) {
          trialsByModality[trial.modality] = (trialsByModality[trial.modality] || 0) + 1;
        }
        if (trial.phase) {
          trialsByPhase[trial.phase] = (trialsByPhase[trial.phase] || 0) + 1;
        }
      }
    }

    // Track the profile view event
    await supabase.from('events').insert({
      user_id: userId || null,
      session_id: sessionId || null,
      anonymous_id: anonymousId || null,
      event_type: 'partner_expanded',
      event_data: {
        company_id: companyId,
        company_name: company.name,
        company_type: company.company_type,
      },
      user_tier: userTier,
    });

    // Update partner_match_results to track expansion
    if (userId) {
      // Get the most recent match result for this user
      const { data: recentMatch } = await supabase
        .from('partner_match_results')
        .select('id, partners_expanded')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (recentMatch) {
        const expanded = recentMatch.partners_expanded || [];
        if (!expanded.includes(company.name)) {
          await supabase
            .from('partner_match_results')
            .update({
              partners_expanded: [...expanded, company.name],
            })
            .eq('id', recentMatch.id);
        }
      }
    }

    // Format response
    const response = {
      company: {
        id: company.id,
        name: company.name,
        ticker: company.ticker,
        company_type: company.company_type,
        hq_country: company.hq_country,
        website_url: company.website_url,

        // Therapeutic focus
        modalities_active: company.modalities_active || [],
        modalities_primary: company.modalities_primary || [],
        indications_active: company.indications_active || [],
        indications_specific: company.indications_specific || [],

        // Deal preferences
        phase_preference_min: company.phase_preference_min,
        phase_preference_max: company.phase_preference_max,
        territory_focus: company.territory_focus || [],

        // Activity metrics
        deals_last_12mo: company.deals_last_12mo || 0,
        deals_last_24mo: company.deals_last_24mo || 0,
        active_trials_count: company.active_trials_count || 0,
        last_deal_date: company.last_deal_date,
        last_deal_modality: company.last_deal_modality,
        last_deal_indication: company.last_deal_indication,

        // Financial metrics
        avg_upfront_usd: company.avg_upfront_usd,
        median_upfront_usd: company.median_upfront_usd,

        // Strategic info
        acquisition_appetite: company.acquisition_appetite,
        strategic_priorities: company.strategic_priorities || [],
        patent_cliffs: company.patent_cliffs || [],

        // Patent cliff revenue at risk
        revenue_at_risk_2025: company.revenue_at_risk_2025,
        revenue_at_risk_2026: company.revenue_at_risk_2026,
        revenue_at_risk_2027: company.revenue_at_risk_2027,

        // Data quality
        data_quality_score: company.data_quality_score,
        data_sources: company.data_sources || [],
        last_enriched_at: company.last_enriched_at,
      },

      // Recent deals
      recent_deals: (recentDeals || []).map(deal => ({
        id: deal.id,
        asset_name: deal.asset_name || 'Undisclosed',
        licensor: deal.licensor_name,
        modality: deal.modality,
        indication: deal.indication_specific || deal.indication_category,
        phase: deal.phase_at_signing,
        territory: deal.territory,
        deal_type: deal.deal_type,
        upfront_usd: deal.terms_disclosed ? deal.upfront_usd : null,
        milestones_usd: deal.terms_disclosed ? deal.milestones_total_usd : null,
        total_value_usd: deal.terms_disclosed ? deal.total_deal_value_usd : null,
        announced_date: deal.announced_date,
        terms_disclosed: deal.terms_disclosed,
      })),

      // Pipeline breakdown
      pipeline: {
        by_indication: trialsByIndication,
        by_modality: trialsByModality,
        by_phase: trialsByPhase,
        total_active_trials: trials?.length || 0,
      },

      // Advisory CTA
      advisory_cta: {
        message: 'Need deeper partner analysis? Our advisory team provides full market mapping, warm introductions, and deal support.',
        cta_text: 'Book a Call',
        cta_url: 'https://calendly.com/ambrosia-advisory',
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Partner profile error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partner profile' },
      { status: 500 }
    );
  }
}
