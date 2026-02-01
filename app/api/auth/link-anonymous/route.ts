import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface LinkAnonymousRequest {
  user_id: string;
  anonymous_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body: LinkAnonymousRequest = await request.json();

    if (!body.user_id || !body.anonymous_id) {
      return NextResponse.json(
        { error: 'user_id and anonymous_id are required' },
        { status: 400 }
      );
    }

    // Use the database function to link all anonymous data to the user
    const { error: linkError } = await supabase.rpc('link_anonymous_to_user', {
      p_user_id: body.user_id,
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
        .eq('user_id', body.user_id)
        .eq('anonymous_id', body.anonymous_id),
      supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', body.user_id)
        .eq('anonymous_id', body.anonymous_id),
      supabase
        .from('calculations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', body.user_id)
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
