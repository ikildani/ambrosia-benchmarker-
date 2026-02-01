// Supabase Edge Function: Compute Lead Scores
// Schedule: Run every 6 hours via pg_cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SCORING_WEIGHTS = {
  // Activity frequency
  sessions_7d: 10, // per session
  sessions_30d: 3, // per session
  calculations_7d: 8, // per calculation
  calculations_30d: 2, // per calculation

  // Intent signals (high value)
  paywall_hits: 15, // per hit
  export_attempts: 20, // per attempt
  pro_feature_clicks: 12, // per click

  // Engagement depth
  unique_modalities: 5, // per modality explored
  unique_indications: 3, // per indication explored
  avg_session_duration: 0.5, // per minute

  // Recency bonus
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

interface UserMetrics {
  totalSessions: number;
  sessions7d: number;
  sessions30d: number;
  totalCalculations: number;
  calculations7d: number;
  calculations30d: number;
  paywallHits: number;
  exportAttempts: number;
  proFeatureClicks: number;
  uniqueModalities: number;
  uniqueIndications: number;
  avgSessionDuration: number;
  lastActivityAt: string | null;
  firstActivityAt: string | null;
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all free tier users
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('tier', 'free');

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const user of users || []) {
      try {
        const metrics = await getUserMetrics(supabase, user.id);
        const score = calculateScore(metrics);
        const tier = determineTier(score);

        await supabase.from('lead_scores').upsert({
          user_id: user.id,
          total_sessions: metrics.totalSessions,
          total_calculations: metrics.totalCalculations,
          sessions_last_7_days: metrics.sessions7d,
          sessions_last_30_days: metrics.sessions30d,
          calculations_last_7_days: metrics.calculations7d,
          calculations_last_30_days: metrics.calculations30d,
          paywall_hits_total: metrics.paywallHits,
          export_attempts: metrics.exportAttempts,
          pro_feature_clicks: metrics.proFeatureClicks,
          unique_modalities_explored: metrics.uniqueModalities,
          unique_indications_explored: metrics.uniqueIndications,
          avg_session_duration_seconds: Math.round(metrics.avgSessionDuration),
          lead_score: Math.round(score),
          lead_tier: tier,
          first_activity_at: metrics.firstActivityAt,
          last_activity_at: metrics.lastActivityAt,
          updated_at: new Date().toISOString(),
        });

        processedCount++;
      } catch (err) {
        errors.push(`User ${user.id}: ${err}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        total: users?.length || 0,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Lead scoring error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function getUserMetrics(supabase: any, userId: string): Promise<UserMetrics> {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch user data in parallel
  const [sessionsResult, calculationsResult, eventsResult] = await Promise.all([
    supabase.from('sessions').select('*').eq('user_id', userId),
    supabase
      .from('calculations')
      .select('modality, indication_category, created_at')
      .eq('user_id', userId),
    supabase
      .from('events')
      .select('event_type, created_at')
      .eq('user_id', userId),
  ]);

  const sessions = sessionsResult.data || [];
  const calculations = calculationsResult.data || [];
  const events = eventsResult.data || [];

  // Calculate session metrics
  const sessions7d = sessions.filter(
    (s: any) => new Date(s.started_at) > d7
  ).length;
  const sessions30d = sessions.filter(
    (s: any) => new Date(s.started_at) > d30
  ).length;

  const avgSessionDuration =
    sessions.length > 0
      ? sessions.reduce((acc: number, s: any) => acc + (s.duration_seconds || 0), 0) /
        sessions.length
      : 0;

  // Calculate calculation metrics
  const calculations7d = calculations.filter(
    (c: any) => new Date(c.created_at) > d7
  ).length;
  const calculations30d = calculations.filter(
    (c: any) => new Date(c.created_at) > d30
  ).length;

  // Calculate unique values
  const uniqueModalities = new Set(calculations.map((c: any) => c.modality)).size;
  const uniqueIndications = new Set(
    calculations.map((c: any) => c.indication_category)
  ).size;

  // Calculate event metrics
  const paywallHits = events.filter(
    (e: any) => e.event_type === 'paywall_displayed'
  ).length;
  const exportAttempts = events.filter(
    (e: any) => e.event_type === 'export_attempted'
  ).length;
  const proFeatureClicks = events.filter(
    (e: any) => e.event_type === 'pro_feature_clicked'
  ).length;

  // Find first and last activity
  const allTimestamps = [
    ...sessions.map((s: any) => new Date(s.started_at).getTime()),
    ...calculations.map((c: any) => new Date(c.created_at).getTime()),
    ...events.map((e: any) => new Date(e.created_at).getTime()),
  ].filter((t) => !isNaN(t));

  const firstActivityAt =
    allTimestamps.length > 0
      ? new Date(Math.min(...allTimestamps)).toISOString()
      : null;
  const lastActivityAt =
    allTimestamps.length > 0
      ? new Date(Math.max(...allTimestamps)).toISOString()
      : null;

  return {
    totalSessions: sessions.length,
    sessions7d,
    sessions30d,
    totalCalculations: calculations.length,
    calculations7d,
    calculations30d,
    paywallHits,
    exportAttempts,
    proFeatureClicks,
    uniqueModalities,
    uniqueIndications,
    avgSessionDuration,
    firstActivityAt,
    lastActivityAt,
  };
}

function calculateScore(metrics: UserMetrics): number {
  let score = 0;

  // Activity frequency
  score += metrics.sessions7d * SCORING_WEIGHTS.sessions_7d;
  score += metrics.sessions30d * SCORING_WEIGHTS.sessions_30d;
  score += metrics.calculations7d * SCORING_WEIGHTS.calculations_7d;
  score += metrics.calculations30d * SCORING_WEIGHTS.calculations_30d;

  // Intent signals
  score += metrics.paywallHits * SCORING_WEIGHTS.paywall_hits;
  score += metrics.exportAttempts * SCORING_WEIGHTS.export_attempts;
  score += metrics.proFeatureClicks * SCORING_WEIGHTS.pro_feature_clicks;

  // Engagement depth
  score += metrics.uniqueModalities * SCORING_WEIGHTS.unique_modalities;
  score += metrics.uniqueIndications * SCORING_WEIGHTS.unique_indications;
  score +=
    (metrics.avgSessionDuration / 60) * SCORING_WEIGHTS.avg_session_duration;

  // Recency bonus
  if (metrics.lastActivityAt) {
    const lastActivity = new Date(metrics.lastActivityAt).getTime();
    const now = Date.now();
    const daysSinceActivity = (now - lastActivity) / (24 * 60 * 60 * 1000);

    if (daysSinceActivity < 1) {
      score += SCORING_WEIGHTS.activity_today;
    } else if (daysSinceActivity < 3) {
      score += SCORING_WEIGHTS.activity_3d;
    } else if (daysSinceActivity < 7) {
      score += SCORING_WEIGHTS.activity_7d;
    }
  }

  // Cap at 100
  return Math.min(100, score);
}

function determineTier(score: number): string {
  if (score >= TIER_THRESHOLDS.qualified) return 'qualified';
  if (score >= TIER_THRESHOLDS.hot) return 'hot';
  if (score >= TIER_THRESHOLDS.warm) return 'warm';
  return 'cold';
}
