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

    // Track deletion errors for reporting
    const deletionErrors: string[] = [];

    // Delete in correct order (respecting foreign keys)
    // Events reference sessions, so delete events first
    const { error: eventsError } = await supabase
      .from('events')
      .delete()
      .eq('user_id', user.id);

    if (eventsError) {
      console.error('Error deleting events:', eventsError);
      deletionErrors.push('events');
    }

    // Delete calculations
    const { error: calculationsError } = await supabase
      .from('calculations')
      .delete()
      .eq('user_id', user.id);

    if (calculationsError) {
      console.error('Error deleting calculations:', calculationsError);
      deletionErrors.push('calculations');
    }

    // Delete sessions
    const { error: sessionsError } = await supabase
      .from('sessions')
      .delete()
      .eq('user_id', user.id);

    if (sessionsError) {
      console.error('Error deleting sessions:', sessionsError);
      deletionErrors.push('sessions');
    }

    // Delete lead score
    const { error: leadScoreError } = await supabase
      .from('lead_scores')
      .delete()
      .eq('user_id', user.id);

    if (leadScoreError) {
      console.error('Error deleting lead score:', leadScoreError);
      deletionErrors.push('lead_scores');
    }

    // Delete user profile - this is critical
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', user.id);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
      deletionErrors.push('user_profile');
      // Profile deletion failure is critical - stop here
      return NextResponse.json(
        {
          error: 'Failed to delete user profile',
          partial_deletion: deletionErrors.length > 1,
          failed_tables: deletionErrors,
        },
        { status: 500 }
      );
    }

    // Finally, delete the auth user - this is critical
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      return NextResponse.json(
        {
          error: 'Failed to delete auth account. Profile data was removed but auth record remains.',
          partial_deletion: true,
          failed_tables: ['auth_user'],
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'All user data has been permanently deleted',
      deleted: deletionSummary,
      warnings: deletionErrors.length > 0 ? `Some non-critical data may not have been deleted: ${deletionErrors.join(', ')}` : undefined,
    });
  } catch (error) {
    console.error('Data deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete data' },
      { status: 500 }
    );
  }
}
