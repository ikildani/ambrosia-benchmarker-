import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { captureApiError } from '@/lib/sentry-api';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';
import { clampInt, dealsQuerySchema, formatZodErrors } from '@/lib/api-validation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'deals', RATE_LIMIT_CONFIGS.deals);

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders('Too many requests. Please try again later.', 429, getRateLimitHeaders(rateLimitResult), 'RATE_LIMITED');
  }

  try {
    const supabase = createServiceClient();
    const searchParams = request.nextUrl.searchParams;

    // Validate query params with Zod
    const rawParams = Object.fromEntries(searchParams.entries());
    const parsed = dealsQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    // SECURITY: Use server-side session auth first, then fall back to UUID header
    let userTier: 'free' | 'pro' | 'report' = 'free';

    // Method 1: Server-side session (most secure — cannot be spoofed)
    try {
      const { createServerClient: createAuthClient } = await import('@/lib/supabase/server');
      const authClient = await createAuthClient();
      const { data: { user } } = await authClient.auth.getUser();
      if (user?.id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tier')
          .eq('id', user.id)
          .single();
        userTier = (profile?.tier as 'free' | 'pro' | 'report') || 'free';

        // Check email allowlist
        if (userTier === 'free' && user.email) {
          const { isProEmailClient } = await import('@/lib/config/authorized-emails.client');
          if (isProEmailClient(user.email)) userTier = 'pro';
        }
      }
    } catch {
      // Session auth failed — fall back to UUID header
    }

    // Method 2: UUID header fallback (hard to guess, needed for non-session contexts)
    if (userTier === 'free') {
      const userId = request.headers.get('x-user-id');
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (userId && UUID_REGEX.test(userId)) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tier')
          .eq('id', userId)
          .single();
        userTier = (profile?.tier as 'free' | 'pro' | 'report') || 'free';
      }
      // NOTE: x-user-email header no longer used for tier lookup (spoofable)
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
        exclusivity,
        upfront_usd,
        milestones_total_usd,
        milestones_development_usd,
        milestones_regulatory_usd,
        milestones_commercial_usd,
        total_deal_value_usd,
        royalty_low_pct,
        royalty_high_pct,
        equity_investment_usd,
        option_exercise_fee,
        milestone_details,
        sales_milestones,
        research_funding_usd,
        profit_share_pct,
        cost_share_ratio,
        opt_in_rights,
        opt_in_stage,
        regulatory_designations,
        term_years,
        sublicense_rights,
        rights_retained,
        indications_licensed,
        includes_diagnostics,
        includes_manufacturing,
        includes_co_development,
        includes_co_promotion,
        target,
        mechanism_of_action,
        announced_date,
        terms_disclosed,
        therapeutic_area,
        deal_status,
        licensee_id,
        licensor_id
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

    const yearFrom = parsed.data.year_from || null;
    const yearTo = parsed.data.year_to || null;

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

    // Search by text — use individual ilike filters to avoid PostgREST filter injection
    const search = searchParams.get('search');
    if (search) {
      // Sanitize search input: strip PostgREST filter operators
      const sanitized = search.replace(/[%_\\]/g, '\\$&').slice(0, 100);
      query = query.or(`asset_name.ilike.%${sanitized}%,licensor_name.ilike.%${sanitized}%,licensee_name.ilike.%${sanitized}%`);
    }

    // Pagination — clamp to safe bounds
    const page = Math.max(1, Math.min(parseInt(searchParams.get('page') || '1') || 1, 10000));
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '20') || 20, 50));
    const offset = (page - 1) * limit;

    // Sorting — Zod validates allowed columns via enum
    const sortBy = parsed.data.sort_by || 'announced_date';
    const sortOrder = parsed.data.sort_order || 'desc';

    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: deals, count, error } = await query;

    if (error) {
      console.error('Deals query error:', error);
      return apiError('Failed to fetch deals', 500);
    }

    // For free users, only show first 5 full deals globally, blur the rest
    const processedDeals = (deals || []).map((deal, index) => {
      const globalIndex = offset + index;
      if (userTier === 'pro' || userTier === 'report' || globalIndex < 5) {
        return deal;
      }
      // Blur financial data for free users beyond 5 deals
      return {
        ...deal,
        upfront_usd: null,
        milestones_total_usd: null,
        milestones_development_usd: null,
        milestones_regulatory_usd: null,
        milestones_commercial_usd: null,
        total_deal_value_usd: null,
        royalty_low_pct: null,
        royalty_high_pct: null,
        equity_investment_usd: null,
        option_exercise_fee: null,
        milestone_details: null,
        sales_milestones: null,
        research_funding_usd: null,
        profit_share_pct: null,
        cost_share_ratio: null,
        blurred: true,
      };
    });

    // Get filter options for the UI
    const filterOptions = await getFilterOptions(supabase);

    return apiSuccess({
      deals: processedDeals,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      userTier,
      filters: filterOptions,
    });
  } catch (error) {
    captureApiError(error, 'deals');
    return apiError('Internal server error', 500);
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
      const val = (row as unknown as Record<string, unknown>)[column];
      if (typeof val === 'string' && val) values.add(val);
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
