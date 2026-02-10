import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'deals', RATE_LIMIT_CONFIGS.deals);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    );
  }

  try {
    const supabase = createServiceClient();
    const searchParams = request.nextUrl.searchParams;

    // Get user email from headers (more secure than query params)
    const email = request.headers.get('x-user-email');

    // SECURITY: Only trust database-verified tier, never client-provided tier
    let userTier: 'free' | 'pro' = 'free';

    if (email) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('email', email)
        .single();

      userTier = (profile?.tier as 'free' | 'pro') || 'free';
    }

    // SECURITY: Removed client tier fallback - this was a privilege escalation vulnerability
    // Tier must be verified from database only

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
        terms_disclosed,
        therapeutic_area
      `, { count: 'exact' });

    // Apply filters
    const therapeuticArea = searchParams.get('therapeutic_area');
    if (therapeuticArea) {
      query = query.in('therapeutic_area', therapeuticArea.split(','));
    }

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

    const yearFromRaw = searchParams.get('year_from');
    const yearToRaw = searchParams.get('year_to');

    // Validate year inputs to prevent injection (must be 4-digit integers)
    const yearRegex = /^\d{4}$/;
    const yearFrom = yearFromRaw && yearRegex.test(yearFromRaw) ? yearFromRaw : null;
    const yearTo = yearToRaw && yearRegex.test(yearToRaw) ? yearToRaw : null;

    // Apply date filter - include NULL dates OR dates within range
    if (yearFrom && yearTo) {
      query = query.or(`announced_date.is.null,and(announced_date.gte.${yearFrom}-01-01,announced_date.lte.${yearTo}-12-31)`);
    } else if (yearFrom) {
      query = query.or(`announced_date.is.null,announced_date.gte.${yearFrom}-01-01`);
    } else if (yearTo) {
      query = query.or(`announced_date.is.null,announced_date.lte.${yearTo}-12-31`);
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

async function getDistinctValues(
  supabase: ReturnType<typeof createServiceClient>,
  column: string
): Promise<string[]> {
  const values = new Set<string>();
  let offset = 0;
  const pageSize = 1000;

  // Paginate to overcome PostgREST max_rows limit
  for (let page = 0; page < 5; page++) {
    const { data } = await supabase
      .from('deals')
      .select(column)
      .not(column, 'is', null)
      .order(column)
      .range(offset, offset + pageSize - 1);

    if (!data || data.length === 0) break;
    for (const row of data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = (row as any)[column];
      if (val) values.add(val as string);
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return [...values].sort();
}

async function getFilterOptions(supabase: ReturnType<typeof createServiceClient>) {
  const [modalities, phases, indications, dealTypes, therapeuticAreas] = await Promise.all([
    getDistinctValues(supabase, 'modality'),
    getDistinctValues(supabase, 'phase_at_signing'),
    getDistinctValues(supabase, 'indication_category'),
    getDistinctValues(supabase, 'deal_type'),
    getDistinctValues(supabase, 'therapeutic_area'),
  ]);

  return { modalities, phases, indications, dealTypes, therapeuticAreas };
}
