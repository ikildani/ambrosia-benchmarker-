import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { captureApiError } from '@/lib/sentry-api';
import { calculationRequestSchema, clampInt } from '@/lib/api-validation';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';

/** Sanitize numeric output — reject NaN/Infinity, return null for invalid */
function safeNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

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
      output_upfront_low: safeNum(body.outputs?.upfront_low),
      output_upfront_mid: safeNum(body.outputs?.upfront_mid),
      output_upfront_high: safeNum(body.outputs?.upfront_high),
      output_milestones_total: safeNum(body.outputs?.milestones_total),
      output_royalty_low: safeNum(body.outputs?.royalty_low),
      output_royalty_high: safeNum(body.outputs?.royalty_high),
      output_total_deal_value_low: safeNum(body.outputs?.total_deal_value_low),
      output_total_deal_value_high: safeNum(body.outputs?.total_deal_value_high),
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

    // Find session IDs owned by this user (for pre-login calculations)
    let ownedSessionIds: string[] = [];
    if (userId) {
      const { data: ownedSessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId);
      ownedSessionIds = (ownedSessions || []).map((s) => s.id);
    }

    // If count only is requested, return just the count
    if (countOnly && userId) {
      const now = new Date();

      // Count calculations with direct user_id match
      let directQuery = supabase
        .from('calculations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (monthOnly) {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        directQuery = directQuery.gte('created_at', startOfMonth.toISOString());
      }

      const { count: directCount, error: directError } = await directQuery;

      if (directError) {
        console.error('Calculation count error:', directError);
        return apiError('Failed to count calculations', 500);
      }

      // Count session-owned calculations (user_id IS NULL but session belongs to user)
      let sessionCount = 0;
      if (ownedSessionIds.length > 0) {
        let sessionQuery = supabase
          .from('calculations')
          .select('id', { count: 'exact', head: true })
          .is('user_id', null)
          .in('session_id', ownedSessionIds);

        if (monthOnly) {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          sessionQuery = sessionQuery.gte('created_at', startOfMonth.toISOString());
        }

        const { count: sCount, error: sError } = await sessionQuery;
        if (sError) {
          console.error('Session calculation count error:', sError);
        } else {
          sessionCount = sCount || 0;
        }
      }

      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return apiSuccess({
        count: (directCount || 0) + sessionCount,
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

    if (userId) {
      // Fetch calculations with direct user_id match
      const { data: directData, error: directError } = await supabase
        .from('calculations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (directError) {
        console.error('Calculation fetch error:', directError);
        return apiError('Failed to fetch calculations', 500);
      }

      // Also fetch session-owned calculations (user_id IS NULL but session belongs to user)
      let sessionData: typeof directData = [];
      if (ownedSessionIds.length > 0) {
        const { data: sData, error: sError } = await supabase
          .from('calculations')
          .select('*')
          .is('user_id', null)
          .in('session_id', ownedSessionIds)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (sError) {
          console.error('Session calculation fetch error:', sError);
        } else {
          sessionData = sData || [];
        }
      }

      // Merge and sort by created_at descending, then apply limit
      const merged = [...(directData || []), ...sessionData]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);

      return apiSuccess({ calculations: merged });
    } else if (anonymousId) {
      const { data, error } = await supabase
        .from('calculations')
        .select('*')
        .eq('anonymous_id', anonymousId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Calculation fetch error:', error);
        return apiError('Failed to fetch calculations', 500);
      }

      return apiSuccess({ calculations: data });
    }

    return apiError('user_id or anonymous_id is required', 400);
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

    // First try to delete by user_id (calculations created while logged in)
    const { data: directDelete, error: directError } = await supabase
      .from('calculations')
      .delete()
      .eq('id', id)
      .eq('user_id', authUser.id)
      .select('id');

    if (directError) {
      console.error('Calculation delete error:', directError);
      return apiError('Failed to delete calculation', 500);
    }

    // If no rows were deleted, the calculation may have been created anonymously
    // before the user logged in. Verify ownership via linked session.
    if (!directDelete || directDelete.length === 0) {
      // Look up the calculation to check if it belongs to a session linked to this user
      const { data: calc } = await supabase
        .from('calculations')
        .select('id, user_id, anonymous_id, session_id')
        .eq('id', id)
        .single();

      if (!calc) {
        return apiSuccess({}); // Already deleted or never existed
      }

      // Check if the anonymous calculation's session is linked to this user
      let ownsCalculation = false;
      if (calc.session_id) {
        const { data: session } = await supabase
          .from('sessions')
          .select('user_id')
          .eq('id', calc.session_id)
          .single();
        ownsCalculation = session?.user_id === authUser.id;
      }

      // Also check if user_id is null but anonymous_id matches a session owned by this user
      if (!ownsCalculation && calc.anonymous_id) {
        const { data: linkedSessions } = await supabase
          .from('sessions')
          .select('id')
          .eq('anonymous_id', calc.anonymous_id)
          .eq('user_id', authUser.id)
          .limit(1);
        ownsCalculation = (linkedSessions && linkedSessions.length > 0) || false;
      }

      if (!ownsCalculation) {
        return apiError('Not authorized to delete this calculation', 403);
      }

      const { error: anonDeleteError } = await supabase
        .from('calculations')
        .delete()
        .eq('id', id);

      if (anonDeleteError) {
        console.error('Anonymous calculation delete error:', anonDeleteError);
        return apiError('Failed to delete calculation', 500);
      }
    }

    return apiSuccess({});
  } catch (error) {
    captureApiError(error, 'calculations-delete');
    return apiError('Internal server error', 500);
  }
}
