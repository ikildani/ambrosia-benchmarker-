import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const searchParams = request.nextUrl.searchParams;

    // Get user tier from query params
    const email = searchParams.get('email');
    const clientTier = searchParams.get('tier');

    let userTier: 'free' | 'pro' = 'free';

    if (email) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('email', email)
        .single();

      userTier = (profile?.tier as 'free' | 'pro') || 'free';
    }

    // Use client-provided tier as fallback
    if (userTier === 'free' && clientTier === 'pro') {
      userTier = 'pro';
    }

    // Build query
    let query = supabase
      .from('deals')
      .select(`
        id,
        licensor_name,
        licensee_name,
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
        royalty_low_pct,
        royalty_high_pct,
        announced_date,
        terms_disclosed
      `, { count: 'exact' });

    // Apply filters
    const modality = searchParams.get('modality');
    if (modality) {
      query = query.in('modality', modality.split(','));
    }

    const phase = searchParams.get('phase');
    if (phase) {
      query = query.in('phase_at_signing', phase.split(','));
    }

    const indication = searchParams.get('indication');
    if (indication) {
      query = query.in('indication_category', indication.split(','));
    }

    const dealType = searchParams.get('deal_type');
    if (dealType) {
      query = query.in('deal_type', dealType.split(','));
    }

    const minUpfront = searchParams.get('min_upfront');
    if (minUpfront) {
      query = query.gte('upfront_usd', parseInt(minUpfront) * 1000000);
    }

    const maxUpfront = searchParams.get('max_upfront');
    if (maxUpfront) {
      query = query.lte('upfront_usd', parseInt(maxUpfront) * 1000000);
    }

    const yearFrom = searchParams.get('year_from');
    if (yearFrom) {
      query = query.gte('announced_date', `${yearFrom}-01-01`);
    }

    const yearTo = searchParams.get('year_to');
    if (yearTo) {
      query = query.lte('announced_date', `${yearTo}-12-31`);
    }

    const termsDisclosed = searchParams.get('terms_disclosed');
    if (termsDisclosed === 'true') {
      query = query.eq('terms_disclosed', true);
    }

    // Search by text
    const search = searchParams.get('search');
    if (search) {
      query = query.or(`asset_name.ilike.%${search}%,licensor_name.ilike.%${search}%,licensee_name.ilike.%${search}%`);
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = (page - 1) * limit;

    // Sorting
    const sortBy = searchParams.get('sort_by') || 'announced_date';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: deals, count, error } = await query;

    if (error) {
      console.error('Deals query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch deals' },
        { status: 500 }
      );
    }

    // For free users, only show first 5 full deals, blur the rest
    const processedDeals = (deals || []).map((deal, index) => {
      if (userTier === 'pro' || index < 5) {
        return deal;
      }
      // Blur financial data for free users beyond 5 deals
      return {
        ...deal,
        upfront_usd: null,
        milestones_total_usd: null,
        total_deal_value_usd: null,
        royalty_low_pct: null,
        royalty_high_pct: null,
        blurred: true,
      };
    });

    // Get filter options for the UI
    const filterOptions = await getFilterOptions(supabase);

    return NextResponse.json({
      deals: processedDeals,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      userTier,
      filters: filterOptions,
    });
  } catch (error) {
    console.error('Deals API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getFilterOptions(supabase: ReturnType<typeof createServiceClient>) {
  // Get distinct values for filters
  const [modalities, phases, indications, dealTypes] = await Promise.all([
    supabase.from('deals').select('modality').not('modality', 'is', null),
    supabase.from('deals').select('phase_at_signing').not('phase_at_signing', 'is', null),
    supabase.from('deals').select('indication_category').not('indication_category', 'is', null),
    supabase.from('deals').select('deal_type').not('deal_type', 'is', null),
  ]);

  return {
    modalities: [...new Set((modalities.data || []).map(d => d.modality))].sort(),
    phases: [...new Set((phases.data || []).map(d => d.phase_at_signing))].sort(),
    indications: [...new Set((indications.data || []).map(d => d.indication_category))].filter(Boolean).sort(),
    dealTypes: [...new Set((dealTypes.data || []).map(d => d.deal_type))].filter(Boolean).sort(),
  };
}
