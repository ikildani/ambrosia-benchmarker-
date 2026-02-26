import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';
import { captureApiError } from '@/lib/sentry-api';

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const [user, authError] = await requireAuth(request);
    if (authError) return authError;

    const supabase = createServiceClient();

    // Gather all user data
    const [profileResult, sessionsResult, calculationsResult, eventsResult, leadScoreResult] =
      await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', user.id).single(),
        supabase.from('sessions').select('*').eq('user_id', user.id).order('started_at', { ascending: false }),
        supabase.from('calculations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('lead_scores').select('*').eq('user_id', user.id).single(),
      ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      email: user.email,
      profile: profileResult.data || null,
      sessions: sessionsResult.data || [],
      calculations: calculationsResult.data || [],
      events: eventsResult.data || [],
      lead_score: leadScoreResult.data || null,
      metadata: {
        total_sessions: sessionsResult.data?.length || 0,
        total_calculations: calculationsResult.data?.length || 0,
        total_events: eventsResult.data?.length || 0,
      },
    };

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="data-export-${user.id}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    captureApiError(error, 'data-export');
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
