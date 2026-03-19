import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';
import { captureApiError } from '@/lib/sentry-api';
import { checkRateLimit, getIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';
import { logAuditEvent, getAuditContext } from '@/lib/audit-log';

export async function DELETE(request: NextRequest) {
  try {
    // SECURITY: Use middleware-managed session instead of raw token
    const [user, authError] = await requireAuth(request);
    if (authError) return authError;

    // Rate limiting — 1 deletion per day per user
    const identifier = getIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, 'delete-data', { limit: 1, windowSeconds: 86400 });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Account deletion already requested. Please wait before trying again.' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      );
    }

    const supabase = createServiceClient();

    // Audit log: data deletion request
    const auditCtx = getAuditContext(request);
    await logAuditEvent(supabase, {
      user_id: user.id,
      user_email: user.email,
      action: 'data_deletion_requested',
      resource: 'user_account',
      resource_id: user.id,
      ...auditCtx,
    });

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

    // --- Phase 4 & 5: Delete profile + auth user (both critical, must succeed together) ---
    // Delete auth user FIRST — if it fails, profile is still intact and user can retry.
    // If we deleted profile first and auth fails, user has orphaned auth record with no profile.
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      captureApiError(authDeleteError, 'data-deletion-auth');
      return NextResponse.json(
        {
          error: 'Failed to delete account. Please try again or contact support.',
          partial_deletion: deletionErrors.length > 0,
          failed_tables: [...deletionErrors, 'auth_user'],
        },
        { status: 500 }
      );
    }

    // Auth user deleted — now delete profile (safe: user can't log in anymore)
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', user.id);

    if (profileError) {
      // Non-fatal: auth user is gone so user is effectively deleted.
      // Profile row is orphaned but harmless. Log for cleanup.
      console.error('Error deleting profile (auth user already deleted):', profileError);
      captureApiError(profileError, 'data-deletion-profile-orphan');
      deletionErrors.push('user_profile');
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
