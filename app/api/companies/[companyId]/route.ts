import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const companyId = params.companyId;

    // Check user tier
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

    // Fetch company profile
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Fetch recent deals (last 12 months)
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Match deals by ID or by company name (fallback for unlinked deals)
    const companyName = company.name;

    const [dealsResult, trialsResult] = await Promise.all([
      supabase
        .from('deals')
        .select('id, licensor_name, licensee_name, asset_name, modality, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, indication_category')
        .or(`licensee_id.eq.${companyId},licensor_id.eq.${companyId},licensee_name.ilike.${companyName},licensor_name.ilike.${companyName}`)
        .gte('announced_date', oneYearAgo)
        .order('announced_date', { ascending: false })
        .limit(20),

      supabase
        .from('company_trials')
        .select('nct_id, trial_title, phase, status, modality, indication_category, start_date, primary_completion_date, enrollment_count')
        .eq('company_id', companyId)
        .in('status', ['recruiting', 'active_not_recruiting', 'enrolling_by_invitation'])
        .order('start_date', { ascending: false })
        .limit(30),
    ]);

    const deals = dealsResult.data || [];
    const trials = trialsResult.data || [];

    // Pipeline by phase
    const pipelineByPhase: Record<string, number> = {};
    for (const trial of trials) {
      const phase = trial.phase || 'unknown';
      pipelineByPhase[phase] = (pipelineByPhase[phase] || 0) + 1;
    }

    // Benchmark comparison — company avg upfront vs market avg
    let benchmarkComparison = null;
    if (isPro && deals.length > 0) {
      const companyDealsWithUpfront = deals.filter(d => d.upfront_usd != null && d.upfront_usd > 0);
      const companyAvgUpfront = companyDealsWithUpfront.length > 0
        ? companyDealsWithUpfront.reduce((sum, d) => sum + d.upfront_usd, 0) / companyDealsWithUpfront.length
        : null;

      // Market avg from last 12 months
      const { data: marketAvgData } = await supabase
        .from('deals')
        .select('upfront_usd')
        .gte('announced_date', oneYearAgo)
        .not('upfront_usd', 'is', null)
        .gt('upfront_usd', 0);

      const marketDeals = marketAvgData || [];
      const marketAvg = marketDeals.length > 0
        ? marketDeals.reduce((sum, d) => sum + d.upfront_usd, 0) / marketDeals.length
        : null;

      benchmarkComparison = {
        company_avg_upfront: companyAvgUpfront,
        market_avg_upfront: marketAvg,
      };
    }

    // For free users, redact financial data
    const profile = {
      id: company.id,
      name: company.name,
      company_type: company.company_type,
      hq_country: company.hq_country,
      acquisition_appetite: isPro ? company.acquisition_appetite : null,
      modalities_active: company.modalities_active,
      indications_active: company.indications_active,
      deals_last_12mo: company.deals_last_12mo,
      active_trials_count: company.active_trials_count,
      patent_cliffs: isPro ? company.patent_cliffs : null,
      strategic_priorities: isPro ? company.strategic_priorities : null,
    };

    const gatedDeals = isPro
      ? deals
      : deals.slice(0, 2).map(d => ({ ...d, upfront_usd: null, total_deal_value_usd: null }));

    const gatedTrials = isPro ? trials : trials.slice(0, 3);

    return NextResponse.json({
      company: profile,
      recent_deals: gatedDeals,
      active_trials: gatedTrials,
      pipeline_by_phase: pipelineByPhase,
      benchmark_comparison: benchmarkComparison,
      is_pro: isPro,
    });
  } catch (error) {
    console.error('Company profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
