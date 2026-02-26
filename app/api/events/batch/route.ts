import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

const MAX_BATCH_SIZE = 100;

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

interface BatchEvent {
  event_type: string;
  event_data: Record<string, unknown>;
  session_id?: string;
  anonymous_id?: string;
  user_id?: string;
  timestamp?: string;
}

interface BatchRequest {
  events: BatchEvent[];
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'events-batch', RATE_LIMIT_CONFIGS.events);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const supabase = createServiceClient();
    const body: BatchRequest = await request.json();

    if (!Array.isArray(body.events) || body.events.length === 0) {
      return NextResponse.json(
        { error: 'Events array is required' },
        { status: 400 }
      );
    }

    if (body.events.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BATCH_SIZE} events per batch` },
        { status: 400 }
      );
    }

    // Filter valid events and format for insert
    const validEvents = body.events
      .filter((e) => VALID_EVENT_TYPES.includes(e.event_type as EventType))
      .map((e) => ({
        user_id: e.user_id || null,
        session_id: e.session_id || null,
        anonymous_id: e.anonymous_id || null,
        event_type: e.event_type,
        event_data: e.event_data || {},
        user_tier: 'free', // Will be updated by trigger if needed
        created_at: e.timestamp || new Date().toISOString(),
      }));

    if (validEvents.length === 0) {
      return NextResponse.json(
        { error: 'No valid events in batch' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('events')
      .insert(validEvents)
      .select('id');

    if (error) {
      console.error('Batch event error:', error);
      // Don't fail completely - return partial success info
    }

    return NextResponse.json({
      success: true,
      received: body.events.length,
      processed: data?.length || 0,
    });
  } catch (error) {
    console.error('Batch event API error:', error);
    // Fail silently - tracking shouldn't break UX
    return NextResponse.json({ success: true, received: 0, processed: 0 });
  }
}
