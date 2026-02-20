import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface CreateSessionRequest {
  anonymous_id: string;
  user_id?: string;
  device_type?: 'desktop' | 'tablet' | 'mobile';
  referrer_url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

interface UpdateSessionRequest {
  session_id: string;
  user_id?: string;
  ended_at?: string;
  duration_seconds?: number;
  calculation_count?: number;
  paywall_hits?: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body: CreateSessionRequest = await request.json();

    if (!body.anonymous_id) {
      return NextResponse.json(
        { error: 'anonymous_id is required' },
        { status: 400 }
      );
    }

    // SECURITY: Never accept user_id from request body — it must come from auth.
    // Sessions start anonymous; user_id is linked later via /api/auth/link-anonymous.
    const sessionData = {
      anonymous_id: body.anonymous_id,
      user_id: null,
      device_type: body.device_type || null,
      referrer_url: body.referrer_url || null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
    };

    const { data, error } = await supabase
      .from('sessions')
      .insert(sessionData)
      .select('id')
      .single();

    if (error) {
      console.error('Session creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ session_id: data.id });
  } catch (error) {
    console.error('Session API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body: UpdateSessionRequest = await request.json();

    if (!body.session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.user_id !== undefined) updateData.user_id = body.user_id;
    if (body.ended_at !== undefined) updateData.ended_at = body.ended_at;
    if (body.duration_seconds !== undefined) updateData.duration_seconds = body.duration_seconds;
    if (body.calculation_count !== undefined) updateData.calculation_count = body.calculation_count;
    if (body.paywall_hits !== undefined) updateData.paywall_hits = body.paywall_hits;

    const { error } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', body.session_id);

    if (error) {
      console.error('Session update error:', error);
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
