import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Vercel Cron: Run every 6 hours
// Add to vercel.json: { "crons": [{ "path": "/api/cron/lead-scores", "schedule": "0 */6 * * *" }] }

const SCORING_WEIGHTS = {
  sessions_7d: 10,
  sessions_30d: 3,
  calculations_7d: 8,
  calculations_30d: 2,
  paywall_hits: 15,
  export_attempts: 20,
  pro_feature_clicks: 12,
  unique_modalities: 5,
  unique_indications: 3,
  avg_session_duration: 0.5,
  activity_today: 20,
  activity_3d: 15,
  activity_7d: 10,
};

const TIER_THRESHOLDS = {
  qualified: 80,
  hot: 60,
  warm: 30,
  cold: 0,
};

export async function GET(request: NextRequest) {
  // Verify cron secret (optional but recommended)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all users with activity
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('tier', 'free');

    let processedCount = 0;

    for (const user of users || []) {
      // Fetch metrics
      const [sessionsResult, calculationsResult, eventsResult] = await Promise.all([
        supabase.from('sessions').select('*').eq('user_id', user.id),
        supabase.from('calculations').select('modality, indication_category, created_at').eq('user_id', user.id),
        supabase.from('events').select('event_type, created_at').eq('user_id', user.id),
      ]);

      const sessions = sessionsResult.data || [];
      const calculations = calculationsResult.data || [];
      const events = eventsResult.data || [];

      // Calculate metrics
      const sessions7d = sessions.filter((s) => new Date(s.started_at) > d7).length;
      const sessions30d = sessions.filter((s) => new Date(s.started_at) > d30).length;
      const calculations7d = calculations.filter((c) => new Date(c.created_at) > d7).length;
      const calculations30d = calculations.filter((c) => new Date(c.created_at) > d30).length;

      const uniqueModalities = new Set(calculations.map((c) => c.modality)).size;
      const uniqueIndications = new Set(calculations.map((c) => c.indication_category)).size;

      const paywallHits = events.filter((e) => e.event_type === 'paywall_displayed').length;
      const exportAttempts = events.filter((e) => e.event_type === 'export_attempted').length;
      const proFeatureClicks = events.filter((e) => e.event_type === 'pro_feature_clicked').length;

      const avgSessionDuration = sessions.length > 0
        ? sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / sessions.length
        : 0;

      // Calculate score
      let score = 0;
      score += sessions7d * SCORING_WEIGHTS.sessions_7d;
      score += sessions30d * SCORING_WEIGHTS.sessions_30d;
      score += calculations7d * SCORING_WEIGHTS.calculations_7d;
      score += calculations30d * SCORING_WEIGHTS.calculations_30d;
      score += paywallHits * SCORING_WEIGHTS.paywall_hits;
      score += exportAttempts * SCORING_WEIGHTS.export_attempts;
      score += proFeatureClicks * SCORING_WEIGHTS.pro_feature_clicks;
      score += uniqueModalities * SCORING_WEIGHTS.unique_modalities;
      score += uniqueIndications * SCORING_WEIGHTS.unique_indications;
      score += (avgSessionDuration / 60) * SCORING_WEIGHTS.avg_session_duration;

      // Find timestamps
      const allTimestamps = [
        ...sessions.map((s) => new Date(s.started_at).getTime()),
        ...calculations.map((c) => new Date(c.created_at).getTime()),
        ...events.map((e) => new Date(e.created_at).getTime()),
      ].filter((t) => !isNaN(t));

      const lastActivityAt = allTimestamps.length > 0 ? new Date(Math.max(...allTimestamps)) : null;
      const firstActivityAt = allTimestamps.length > 0 ? new Date(Math.min(...allTimestamps)) : null;

      // Recency bonus
      if (lastActivityAt) {
        const daysSince = (now.getTime() - lastActivityAt.getTime()) / (24 * 60 * 60 * 1000);
        if (daysSince < 1) score += SCORING_WEIGHTS.activity_today;
        else if (daysSince < 3) score += SCORING_WEIGHTS.activity_3d;
        else if (daysSince < 7) score += SCORING_WEIGHTS.activity_7d;
      }

      score = Math.min(100, Math.round(score));

      // Determine tier
      let tier = 'cold';
      if (score >= TIER_THRESHOLDS.qualified) tier = 'qualified';
      else if (score >= TIER_THRESHOLDS.hot) tier = 'hot';
      else if (score >= TIER_THRESHOLDS.warm) tier = 'warm';

      // Upsert lead score
      await supabase.from('lead_scores').upsert({
        user_id: user.id,
        total_sessions: sessions.length,
        total_calculations: calculations.length,
        sessions_last_7_days: sessions7d,
        sessions_last_30_days: sessions30d,
        calculations_last_7_days: calculations7d,
        calculations_last_30_days: calculations30d,
        paywall_hits_total: paywallHits,
        export_attempts: exportAttempts,
        pro_feature_clicks: proFeatureClicks,
        unique_modalities_explored: uniqueModalities,
        unique_indications_explored: uniqueIndications,
        avg_session_duration_seconds: Math.round(avgSessionDuration),
        lead_score: score,
        lead_tier: tier,
        first_activity_at: firstActivityAt?.toISOString() || null,
        last_activity_at: lastActivityAt?.toISOString() || null,
        updated_at: new Date().toISOString(),
      });

      processedCount++;
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: users?.length || 0,
    });
  } catch (error) {
    console.error('Lead scoring error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
