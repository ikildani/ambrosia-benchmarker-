import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { captureApiError } from '@/lib/sentry-api';
import { calculationRequestSchema, clampInt } from '@/lib/api-validation';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'calculations', RATE_LIMIT_CONFIGS.calculations);

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders('Too many requests. Please try again later.', 429, getRateLimitHeaders(rateLimitResult), 'RATE_LIMITED');
  }

  try {
    const supabase = createServiceClient();
    const rawBody = await request.json();

    // Validate input with Zod schema
    const parseResult = calculationRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid input';
      return apiError(firstError, 400);
    }
    const body = parseResult.data;

    // SECURITY: Derive user_id from auth session, not from request body
    const authUser = await getAuthenticatedUser(request);
    const verifiedUserId = authUser?.id || null;

    // Get user tier from verified user
    let userTier = 'free';
    if (verifiedUserId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', verifiedUserId)
        .single();

      if (profile?.tier) {
        userTier = profile.tier;
      }
    }

    // Store the calculation
    const calculationData = {
      user_id: verifiedUserId,
      session_id: body.session_id || null,
      anonymous_id: body.anonymous_id || null,
      therapeutic_area: body.therapeutic_area || 'oncology',
      modality: body.modality,
      development_phase: body.development_phase,
      indication_category: body.indication_category || null,
      indication_specific: body.indication_specific || null,
      territory_scope: body.territory_scope || null,
      territories_included: body.territories_included || null,
      exclusivity_type: body.exclusivity_type || null,
      deal_type: body.deal_type || null,
      includes_manufacturing: body.includes_manufacturing || false,
      includes_codev: body.includes_codev || false,
      includes_copromote: body.includes_copromote || false,
      output_upfront_low: body.outputs?.upfront_low || null,
      output_upfront_mid: body.outputs?.upfront_mid || null,
      output_upfront_high: body.outputs?.upfront_high || null,
      output_milestones_total: body.outputs?.milestones_total || null,
      output_royalty_low: body.outputs?.royalty_low || null,
      output_royalty_high: body.outputs?.royalty_high || null,
      output_total_deal_value_low: body.outputs?.total_deal_value_low || null,
      output_total_deal_value_high: body.outputs?.total_deal_value_high || null,
      calculation_version: '1.0.0',
    };

    let { data: calculation, error: calcError } = await supabase
      .from('calculations')
      .insert(calculationData)
      .select('id')
      .single();

    // If insert failed (likely FK violation on session_id), retry without session_id
    if (calcError && calculationData.session_id) {
      console.warn('Calculation insert failed, retrying without session_id:', calcError.message);
      calculationData.session_id = null;
      const retry = await supabase
        .from('calculations')
        .insert(calculationData)
        .select('id')
        .single();
      calculation = retry.data;
      calcError = retry.error;
    }

    if (calcError) {
      console.error('Calculation save error:', calcError);
      return apiError('Failed to save calculation', 500);
    }

    // Fire event and update session count (non-blocking — don't let these fail the response)
    const validSessionId = calculationData.session_id;

    const eventData = {
      user_id: verifiedUserId,
      session_id: validSessionId,
      anonymous_id: body.anonymous_id || null,
      event_type: 'calculation_completed',
      event_data: {
        calculation_id: calculation!.id,
        therapeutic_area: body.therapeutic_area || 'oncology',
        modality: body.modality,
        development_phase: body.development_phase,
        indication_category: body.indication_category,
        territory_scope: body.territory_scope,
        outputs: {
          upfront_range: [body.outputs?.upfront_low, body.outputs?.upfront_high],
          milestones_total: body.outputs?.milestones_total,
          royalty_range: [body.outputs?.royalty_low, body.outputs?.royalty_high],
          total_deal_value_range: [
            body.outputs?.total_deal_value_low,
            body.outputs?.total_deal_value_high,
          ],
        },
      },
      user_tier: userTier,
    };

    Promise.resolve(
      supabase.from('events').insert(eventData)
    ).catch(() => {});

    if (validSessionId) {
      Promise.resolve(
        supabase.rpc('increment_session_calculations', {
          p_session_id: validSessionId,
        })
      ).catch(() => {});
    }

    return apiSuccess({ calculation_id: calculation!.id });
  } catch (error) {
    captureApiError(error, 'calculations-post');
    return apiError('Failed to save calculation', 500);
  }
}

// GET endpoint to retrieve user's calculation history or count
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('user_id');
    const anonymousId = searchParams.get('anonymous_id');
    const sessionId = searchParams.get('session_id');
    const countOnly = searchParams.get('count') === 'true';
    const monthOnly = searchParams.get('month') === 'true'; // Get count for current month only
    const limit = clampInt(searchParams.get('limit'), 1, 100, 50);

    if (!requestedUserId && !anonymousId) {
      return apiError('user_id or anonymous_id is required', 400);
    }

    // SECURITY: Verify authenticated user owns the requested data
    let userId: string | null = null;
    if (requestedUserId) {
      const authUser = await getAuthenticatedUser(request);
      if (!authUser || authUser.id !== requestedUserId) {
        return apiError('Unauthorized: user_id does not match session', 403);
      }
      userId = authUser.id;
    }

    // If count only is requested, return just the count
    if (countOnly && userId) {
      const now = new Date();
      let query = supabase
        .from('calculations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Filter to current month if requested
      if (monthOnly) {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query = query.gte('created_at', startOfMonth.toISOString());
      }

      const { count, error } = await query;

      if (error) {
        console.error('Calculation count error:', error);
        return apiError('Failed to count calculations', 500);
      }

      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return apiSuccess({
        count: count || 0,
        month: monthOnly ? currentMonth : undefined
      });
    }

    // SECURITY: For anonymous_id queries, require session_id for verification
    // This prevents enumeration attacks on anonymous calculation data
    if (anonymousId && !userId) {
      if (!sessionId) {
        return apiError('session_id required for anonymous access', 400);
      }

      // Verify the session_id matches calculations with this anonymous_id
      const { data: sessionCheck } = await supabase
        .from('calculations')
        .select('id')
        .eq('anonymous_id', anonymousId)
        .eq('session_id', sessionId)
        .limit(1);

      if (!sessionCheck || sessionCheck.length === 0) {
        return apiError('Invalid session', 403);
      }
    }

    let query = supabase
      .from('calculations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (anonymousId) {
      query = query.eq('anonymous_id', anonymousId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Calculation fetch error:', error);
      return apiError('Failed to fetch calculations', 500);
    }

    return apiSuccess({ calculations: data });
  } catch (error) {
    captureApiError(error, 'calculations-get');
    return apiError('Internal server error', 500);
  }
}

// DELETE endpoint to remove a calculation
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('id is required', 400);
    }

    // SECURITY: Verify authenticated user owns the calculation
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return apiError('Authentication required for deletion', 401);
    }

    // Delete only if the calculation belongs to the authenticated user
    const { error } = await supabase
      .from('calculations')
      .delete()
      .eq('id', id)
      .eq('user_id', authUser.id);

    if (error) {
      console.error('Calculation delete error:', error);
      return apiError('Failed to delete calculation', 500);
    }

    return apiSuccess({});
  } catch (error) {
    captureApiError(error, 'calculations-delete');
    return apiError('Internal server error', 500);
  }
}
