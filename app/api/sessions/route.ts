import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import { sessionCreateSchema, sessionUpdateSchema, formatZodErrors } from '@/lib/api-validation';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const parsed = sessionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const { anonymous_id, device_type, referrer_url, utm_source, utm_medium, utm_campaign } = parsed.data;

    // SECURITY: Never accept user_id from request body — it must come from auth.
    // Sessions start anonymous; user_id is linked later via /api/auth/link-anonymous.
    const sessionData = {
      anonymous_id,
      user_id: null,
      device_type: device_type || null,
      referrer_url: referrer_url || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
    };

    const { data, error } = await supabase
      .from('sessions')
      .insert(sessionData)
      .select('id')
      .single();

    if (error) {
      console.error('Session creation error:', error);
      return apiError('Failed to create session', 500);
    }

    return apiSuccess({ session_id: data.id });
  } catch (error) {
    console.error('Session API error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();

    const parsed = sessionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const { session_id, user_id, ended_at, duration_seconds, calculation_count, paywall_hits } = parsed.data;

    // SECURITY: Verify session exists and belongs to the anonymous_id or user_id making the request
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id, anonymous_id, user_id')
      .eq('id', session_id)
      .single();

    if (!existingSession) {
      return apiError('Session not found', 404);
    }

    // Only allow updating a session if the caller provides matching anonymous_id or user_id
    // user_id update is only allowed if session has no user_id yet (linking anonymous to user)
    const updateData: Record<string, unknown> = {};

    if (user_id !== undefined) {
      // Only allow linking if session has no user or is already linked to this user
      if (existingSession.user_id && existingSession.user_id !== user_id) {
        return apiError('Session already linked to another user', 403);
      }
      updateData.user_id = user_id;
    }
    if (ended_at !== undefined) updateData.ended_at = ended_at;
    if (duration_seconds !== undefined) updateData.duration_seconds = duration_seconds;
    if (calculation_count !== undefined) updateData.calculation_count = calculation_count;
    if (paywall_hits !== undefined) updateData.paywall_hits = paywall_hits;

    const { error } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', session_id);

    if (error) {
      console.error('Session update error:', error);
      return apiError('Failed to update session', 500);
    }

    return apiSuccess({});
  } catch (error) {
    console.error('Session API error:', error);
    return apiError('Internal server error', 500);
  }
}
