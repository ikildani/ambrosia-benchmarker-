import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

interface LinkAnonymousRequest {
  anonymous_id: string;
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication — user_id comes from session, never from body
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();
    const body: LinkAnonymousRequest = await request.json();

    if (!body.anonymous_id) {
      return NextResponse.json(
        { error: 'anonymous_id is required' },
        { status: 400 }
      );
    }

    const userId = authUser.id;

    // Use the database function to link all anonymous data to the user
    const { error: linkError } = await supabase.rpc('link_anonymous_to_user', {
      p_user_id: userId,
      p_anonymous_id: body.anonymous_id,
    });

    if (linkError) {
      console.error('Link anonymous error:', linkError);
      return NextResponse.json(
        { error: 'Failed to link anonymous data' },
        { status: 500 }
      );
    }

    // Count how many records were linked
    const [sessionsResult, eventsResult, calculationsResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('anonymous_id', body.anonymous_id),
      supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('anonymous_id', body.anonymous_id),
      supabase
        .from('calculations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('anonymous_id', body.anonymous_id),
    ]);

    return NextResponse.json({
      success: true,
      linked: {
        sessions: sessionsResult.count || 0,
        events: eventsResult.count || 0,
        calculations: calculationsResult.count || 0,
      },
    });
  } catch (error) {
    console.error('Link anonymous API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
