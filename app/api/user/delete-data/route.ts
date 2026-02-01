import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createServerClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // Verify the token and get user
    const authClient = createServerClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Get counts before deletion for confirmation
    const [sessionsCount, calculationsCount, eventsCount] = await Promise.all([
      supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('calculations').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]);

    const deletionSummary = {
      sessions: sessionsCount.count || 0,
      calculations: calculationsCount.count || 0,
      events: eventsCount.count || 0,
    };

    // Delete in correct order (respecting foreign keys)
    // Events reference sessions, so delete events first
    const { error: eventsError } = await supabase
      .from('events')
      .delete()
      .eq('user_id', user.id);

    if (eventsError) {
      console.error('Error deleting events:', eventsError);
    }

    // Delete calculations
    const { error: calculationsError } = await supabase
      .from('calculations')
      .delete()
      .eq('user_id', user.id);

    if (calculationsError) {
      console.error('Error deleting calculations:', calculationsError);
    }

    // Delete sessions
    const { error: sessionsError } = await supabase
      .from('sessions')
      .delete()
      .eq('user_id', user.id);

    if (sessionsError) {
      console.error('Error deleting sessions:', sessionsError);
    }

    // Delete lead score
    const { error: leadScoreError } = await supabase
      .from('lead_scores')
      .delete()
      .eq('user_id', user.id);

    if (leadScoreError) {
      console.error('Error deleting lead score:', leadScoreError);
    }

    // Delete user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', user.id);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
    }

    // Finally, delete the auth user
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete auth account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'All user data has been permanently deleted',
      deleted: deletionSummary,
    });
  } catch (error) {
    console.error('Data deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete data' },
      { status: 500 }
    );
  }
}
