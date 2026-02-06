import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

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

interface EventRequest {
  event_type: string;
  event_data: Record<string, unknown>;
  session_id?: string;
  anonymous_id?: string;
  user_id?: string;
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = checkRateLimit(identifier, 'events', RATE_LIMIT_CONFIGS.events);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const supabase = createServiceClient();
    const body: EventRequest = await request.json();

    // Validate event type
    if (!VALID_EVENT_TYPES.includes(body.event_type as EventType)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // Get user tier if user_id is provided
    let userTier = 'free';
    if (body.user_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', body.user_id)
        .single();

      if (profile?.tier) {
        userTier = profile.tier;
      }
    }

    const eventData = {
      user_id: body.user_id || null,
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Event API error:', error);
    // Fail silently - tracking shouldn't break UX
    return NextResponse.json({ success: true });
  }
}
