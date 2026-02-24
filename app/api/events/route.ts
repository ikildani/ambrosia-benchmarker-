import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { eventSchema, formatZodErrors } from '@/lib/api-validation';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';

// Valid event types
const VALID_EVENT_TYPES = [
  // Calculation events
  'calculation_started',
  'calculation_completed',
  'parameter_changed',
  'output_section_viewed',
  'output_section_expanded',
  'results_copied',

  // Paywall events
  'paywall_displayed',
  'paywall_dismissed',
  'export_attempted',
  'pro_feature_clicked',
  'upgrade_cta_clicked',

  // Session events
  'session_started',
  'session_ended',

  // Profile events
  'profile_updated',
  'preferences_changed',

  // Partner matching events (HIGH INTENT)
  'partner_match_requested',
  'partner_clicked',
  'partner_expanded',
  'partner_upgrade_cta_clicked',
  'partner_advisory_cta_clicked',
] as const;

type EventType = typeof VALID_EVENT_TYPES[number];

export async function POST(request: NextRequest) {
  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'events', RATE_LIMIT_CONFIGS.events);

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders('Too many requests', 429, getRateLimitHeaders(rateLimitResult), 'RATE_LIMITED');
  }

  try {
    const supabase = createServiceClient();
    const raw = await request.json();
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }
    const body = parsed.data;

    // Validate event type
    if (!VALID_EVENT_TYPES.includes(body.event_type as EventType)) {
      return apiError('Invalid event type', 400);
    }

    // SECURITY: Verify user_id via auth header if provided, don't trust body.user_id blindly.
    // For anonymous events, user_id stays null (linked later via auth flow).
    let verifiedUserId: string | null = null;
    let userTier = 'free';

    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { createClient } = await import('@supabase/supabase-js');
      const authClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await authClient.auth.getUser(token);
      if (user) {
        verifiedUserId = user.id;
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tier')
          .eq('id', user.id)
          .single();
        if (profile?.tier) userTier = profile.tier;
      }
    }

    const eventData = {
      user_id: verifiedUserId,
      session_id: body.session_id || null,
      anonymous_id: body.anonymous_id || null,
      event_type: body.event_type,
      event_data: body.event_data || {},
      user_tier: userTier,
    };

    const { error } = await supabase.from('events').insert(eventData);

    if (error) {
      console.error('Event tracking error:', error);
      // Don't fail the request - tracking shouldn't break UX
    }

    // If it's a paywall event, increment session paywall hits
    if (body.event_type === 'paywall_displayed' && body.session_id) {
      await supabase.rpc('increment_session_paywall_hits', {
        p_session_id: body.session_id,
      });
    }

    return apiSuccess({});
  } catch (error) {
    console.error('Event API error:', error);
    // Fail silently - tracking shouldn't break UX
    return apiSuccess({});
  }
}
