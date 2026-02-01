// Supabase Edge Function: Data Retention Cleanup
// Schedule: Run monthly after insights generation
// GDPR compliant - deletes data older than 24 months

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RETENTION_MONTHS = 24;

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Calculate cutoff date (24 months ago)
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);
    const cutoffISO = cutoffDate.toISOString();

    const deletionStats = {
      events: 0,
      sessions: 0,
      calculations: 0,
    };

    // Delete old events (except calculation_completed which we keep for analytics)
    const { count: eventsDeleted, error: eventsError } = await supabase
      .from('events')
      .delete()
      .lt('created_at', cutoffISO)
      .neq('event_type', 'calculation_completed')
      .select('*', { count: 'exact', head: true });

    if (eventsError) {
      console.error('Error deleting events:', eventsError);
    } else {
      deletionStats.events = eventsDeleted || 0;
    }

    // Delete old sessions without associated users (orphaned anonymous sessions)
    const { count: sessionsDeleted, error: sessionsError } = await supabase
      .from('sessions')
      .delete()
      .lt('started_at', cutoffISO)
      .is('user_id', null)
      .select('*', { count: 'exact', head: true });

    if (sessionsError) {
      console.error('Error deleting sessions:', sessionsError);
    } else {
      deletionStats.sessions = sessionsDeleted || 0;
    }

    // For calculations, we keep them longer for market analysis
    // But delete very old ones (older than 36 months) without user association
    const extendedCutoff = new Date();
    extendedCutoff.setMonth(extendedCutoff.getMonth() - 36);
    const extendedCutoffISO = extendedCutoff.toISOString();

    const { count: calculationsDeleted, error: calculationsError } = await supabase
      .from('calculations')
      .delete()
      .lt('created_at', extendedCutoffISO)
      .is('user_id', null)
      .select('*', { count: 'exact', head: true });

    if (calculationsError) {
      console.error('Error deleting calculations:', calculationsError);
    } else {
      deletionStats.calculations = calculationsDeleted || 0;
    }

    // Log the cleanup for audit purposes
    console.log('Data retention cleanup completed:', {
      cutoffDate: cutoffISO,
      deletionStats,
    });

    return new Response(
      JSON.stringify({
        success: true,
        cutoffDate: cutoffISO,
        retentionMonths: RETENTION_MONTHS,
        deleted: deletionStats,
        message: `Deleted ${deletionStats.events} events, ${deletionStats.sessions} sessions, ${deletionStats.calculations} calculations`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Data retention error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
