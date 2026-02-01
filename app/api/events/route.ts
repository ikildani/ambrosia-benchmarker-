import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Valid event types
const VALID_EVENT_TYPES = [
  'calculation_started',
  'calculation_completed',
  'parameter_changed',
  'output_section_viewed',
  'output_section_expanded',
  'results_copied',
  'paywall_displayed',
  'paywall_dismissed',
  'export_attempted',
  'pro_feature_clicked',
  'upgrade_cta_clicked',
  'session_started',
  'session_ended',
  'profile_updated',
  'preferences_changed',
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
