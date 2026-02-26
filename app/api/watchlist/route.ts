import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';
import { watchlistQuerySchema, watchlistAddSchema, watchlistDeleteSchema, formatZodErrors } from '@/lib/api-validation';

const MAX_WATCHLIST_ITEMS = 25;

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authenticated session
    const [user, authError] = await requireAuth(request);
    if (authError) return authError;

    const supabase = createServiceClient();

    // Verify user is Pro (using authenticated user's ID, not query param)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', user.id)
      .single();

    if (profile?.tier !== 'pro') {
      return apiError('Pro subscription required', 403);
    }

    const { data, error } = await supabase
      .from('watchlist_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Watchlist fetch error:', error);
      return apiError('Failed to fetch watchlist', 500);
    }

    return apiSuccess({ items: data || [] });
  } catch (error) {
    console.error('Watchlist API error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Require authenticated session
  const [user, authError] = await requireAuth(request);
  if (authError) return authError;

  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'calculations', RATE_LIMIT_CONFIGS.calculations);

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders('Too many requests', 429, getRateLimitHeaders(rateLimitResult));
  }

  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const parsed = watchlistAddSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const { item_type, item_value, company_id } = parsed.data;

    // Verify Pro tier using authenticated user
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', user.id)
      .single();

    if (profile?.tier !== 'pro') {
      return apiError('Pro subscription required', 403);
    }

    // Check item count
    const { count } = await supabase
      .from('watchlist_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if ((count || 0) >= MAX_WATCHLIST_ITEMS) {
      return apiError(`Maximum ${MAX_WATCHLIST_ITEMS} watchlist items allowed`, 400);
    }

    const { data, error } = await supabase
      .from('watchlist_items')
      .insert({
        user_id: user.id,
        item_type,
        item_value,
        company_id: company_id || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return apiError('Item already in watchlist', 409);
      }
      console.error('Watchlist insert error:', error);
      return apiError('Failed to add to watchlist', 500);
    }

    return apiSuccess({ item: data });
  } catch (error) {
    console.error('Watchlist API error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest) {
  // SECURITY: Require authenticated session
  const [user, authError] = await requireAuth(request);
  if (authError) return authError;

  try {
    const supabase = createServiceClient();
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = watchlistDeleteSchema.safeParse(params);

    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const { id } = parsed.data;

    // SECURITY: Only delete items owned by authenticated user
    const { error } = await supabase
      .from('watchlist_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Watchlist delete error:', error);
      return apiError('Failed to remove from watchlist', 500);
    }

    return apiSuccess({});
  } catch (error) {
    console.error('Watchlist API error:', error);
    return apiError('Internal server error', 500);
  }
}
