import { requireSingleSession } from "@/lib/auth/require-single-session";
import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';
import { isProEmail } from '@/lib/config/authorized-emails';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';
import { scenarioCreateSchema, formatZodErrors } from '@/lib/api-validation';
import type { UserTier } from '@/types/tier';

export const dynamic = 'force-dynamic';

// GET - List saved scenarios for a user
export async function GET(request: NextRequest) {
  // SECURITY: Require authenticated session
  const [user, authError] = await requireAuth(request);
  if (authError) return authError;

  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'scenarios', RATE_LIMIT_CONFIGS.default);

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders('Too many requests', 429, getRateLimitHeaders(rateLimitResult));
  }

  try {
    const supabase = createServiceClient();
    const email = user.email!;

    // Verify tier from database
    let userTier: UserTier = 'free';
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', user.id)
      .single();

    userTier = (profile?.tier as UserTier) || 'free';

    // Check PRO_EMAILS list for authorized users
    if (userTier === 'free' && isProEmail(email)) {
      userTier = 'pro';
    }

    if (userTier !== 'pro' && userTier !== 'report') {
      return apiError('Pro subscription required', 403);
    }

    // Fetch scenarios for authenticated user only
    const { data: scenarios, error } = await supabase
      .from('saved_scenarios')
      .select('id, name, notes, inputs, results, labels, created_at, updated_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching scenarios:', error);
      return apiError('Failed to fetch scenarios', 500);
    }

    return apiSuccess({ scenarios: scenarios || [] });
  } catch (error) {
    console.error('Scenarios API error:', error);
    return apiError('Internal server error', 500);
  }
}

// POST - Save a new scenario
export async function POST(request: NextRequest) {
  // SECURITY: Require authenticated session
  const [user, authError] = await requireAuth(request);
  if (authError) return authError;

  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'scenarios', RATE_LIMIT_CONFIGS.default);

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders('Too many requests', 429, getRateLimitHeaders(rateLimitResult));
  }

  try {
    // R72: Single-session enforcement — block stale sessions
    const sessionCheck = await requireSingleSession(request);
    if (sessionCheck) return sessionCheck;

    const supabase = createServiceClient();
    const body = await request.json();
    const parsed = scenarioCreateSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const { name, notes, inputs, results, labels } = parsed.data;
    const email = user.email!;

    // Verify tier from database using authenticated user
    let userTier: UserTier = 'free';
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, tier')
      .eq('id', user.id)
      .single();

    userTier = (profile?.tier as UserTier) || 'free';

    if (userTier === 'free' && isProEmail(email)) {
      userTier = 'pro';
    }

    if (userTier !== 'pro' && userTier !== 'report') {
      return apiError('Pro subscription required to save scenarios', 403);
    }

    // Check scenario limit (max 20 per user)
    const { count } = await supabase
      .from('saved_scenarios')
      .select('*', { count: 'exact', head: true })
      .eq('email', email);

    if (count && count >= 20) {
      return apiError('Maximum of 20 saved scenarios reached. Please delete some to save new ones.', 400);
    }

    // Save scenario for authenticated user
    const { data: scenario, error } = await supabase
      .from('saved_scenarios')
      .insert({
        user_id: user.id,
        email,
        name,
        notes: notes || null,
        inputs,
        results,
        labels: labels || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving scenario:', error);
      return apiError('Failed to save scenario', 500);
    }

    return apiSuccess({ scenario });
  } catch (error) {
    console.error('Save scenario error:', error);
    return apiError('Internal server error', 500);
  }
}

// DELETE - Delete a scenario
export async function DELETE(request: NextRequest) {
  // SECURITY: Require authenticated session
  const [user, authError] = await requireAuth(request);
  if (authError) return authError;

  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'scenarios-delete', RATE_LIMIT_CONFIGS.default);

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders('Too many requests', 429, getRateLimitHeaders(rateLimitResult));
  }

  try {
    const supabase = createServiceClient();
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const id = params.id;

    if (!id) {
      return apiError('id is required', 400);
    }

    // SECURITY: Only delete scenarios owned by the authenticated user
    const { error } = await supabase
      .from('saved_scenarios')
      .delete()
      .eq('id', id)
      .eq('email', user.email!);

    if (error) {
      console.error('Error deleting scenario:', error);
      return apiError('Failed to delete scenario', 500);
    }

    return apiSuccess({});
  } catch (error) {
    console.error('Delete scenario error:', error);
    return apiError('Internal server error', 500);
  }
}
