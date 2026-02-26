import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';
import { captureApiError } from '@/lib/sentry-api';

export async function DELETE(request: NextRequest) {
  try {
    // SECURITY: Use middleware-managed session instead of raw token
    const [user, authError] = await requireAuth(request);
    if (authError) return authError;

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

    // Helper to delete from a table and track errors
    const deleteFrom = async (table: string, column: string, value: string) => {
      const { error } = await supabase.from(table).delete().eq(column, value);
      if (error) {
        console.error(`Error deleting from ${table}:`, error);
        deletionErrors.push(table);
      }
    };

    // --- Phase 1: Delete from tables with SET NULL FK (won't auto-delete) ---
    // These MUST be explicitly deleted for GDPR compliance

    await deleteFrom('outreach_emails', 'user_id', user.id);
    await deleteFrom('outreach_email_usage', 'user_id', user.id);
    await deleteFrom('watchlist_items', 'user_id', user.id);
    await deleteFrom('partner_match_results', 'user_id', user.id);
    await deleteFrom('report_purchases', 'user_id', user.id);

    // --- Phase 2: Delete from tables that may also have email-keyed data ---

    await deleteFrom('saved_scenarios', 'user_id', user.id);
    if (user.email) {
      await deleteFrom('saved_scenarios', 'email', user.email);
    }

    await deleteFrom('shared_calculations', 'user_id', user.id);
    if (user.email) {
      await deleteFrom('shared_calculations', 'email', user.email);
    }

    if (user.email) {
      await deleteFrom('email_logs', 'email', user.email);
      await deleteFrom('newsletter_subscribers', 'email', user.email);
    }

    await deleteFrom('email_preferences', 'user_id', user.id);

    // --- Phase 3: Original deletions (events → calculations → sessions → lead_scores) ---
    // Delete in correct order (respecting foreign keys)

    await deleteFrom('events', 'user_id', user.id);
    await deleteFrom('calculations', 'user_id', user.id);
    await deleteFrom('sessions', 'user_id', user.id);
    await deleteFrom('lead_scores', 'user_id', user.id);

    // --- Phase 4: Delete user profile (critical) ---
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', user.id);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
      deletionErrors.push('user_profile');
      return NextResponse.json(
        {
          error: 'Failed to delete user profile',
          partial_deletion: deletionErrors.length > 1,
          failed_tables: deletionErrors,
        },
        { status: 500 }
      );
    }

    // --- Phase 5: Delete the auth user (critical) ---
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
    captureApiError(error, 'data-deletion');
    return NextResponse.json(
      { error: 'Failed to delete data' },
      { status: 500 }
    );
  }
}
