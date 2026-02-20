import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';

// Vercel Cron: Run every 6 hours
// Add to vercel.json: { "crons": [{ "path": "/api/cron/lead-scores", "schedule": "0 */6 * * *" }] }

const SCORING_WEIGHTS = {
  // Activity frequency
  sessions_7d: 10,
  sessions_30d: 3,
  calculations_7d: 8,
  calculations_30d: 2,

  // Standard intent signals
  paywall_hits: 15,
  export_attempts: 20,
  pro_feature_clicks: 12,

  // Engagement depth
  unique_modalities: 5,
  unique_indications: 3,
  avg_session_duration: 0.5,

  // Recency bonus
  activity_today: 20,
  activity_3d: 15,
  activity_7d: 10,

  // Partner matching events (HIGH INTENT - these users are serious)
  partner_match_requested: 25,
  partner_clicked: 10,
  partner_expanded: 15,
  partner_upgrade_cta_clicked: 20,
  partner_advisory_cta_clicked: 40, // Highest intent signal - ready to buy advisory
};

const TIER_THRESHOLDS = {
  qualified: 80,
  hot: 60,
  warm: 30,
  cold: 0,
};

export async function GET(request: NextRequest) {
  // Security: Require cron secret for all cron endpoints
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Use constant-time comparison to prevent timing attacks
  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';

  // Ensure both strings are same length for timing-safe comparison
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;

  const isValid = isValidLength && timingSafeEqual(
    Buffer.from(tokenToCompare),
    Buffer.from(expectedToken)
  );

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all free-tier users
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('tier', 'free');

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, processed: 0, total: 0 });
    }

    const userIds = users.map((u) => u.id);

    // PERFORMANCE: Bulk-fetch all data in 3 queries instead of 3×N (fixes N+1)
    // Only fetch data from last 30 days to bound query size
    const [sessionsResult, calculationsResult, eventsResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('user_id, started_at, duration_seconds')
        .in('user_id', userIds)
        .gte('started_at', d30.toISOString()),
      supabase
        .from('calculations')
        .select('user_id, modality, indication_category, created_at')
        .in('user_id', userIds)
        .gte('created_at', d30.toISOString()),
      supabase
        .from('events')
        .select('user_id, event_type, created_at')
        .in('user_id', userIds)
        .gte('created_at', d30.toISOString()),
    ]);

    // Group by user_id for O(1) lookups
    const sessionsByUser = new Map<string, typeof sessionsResult.data>();
    for (const s of sessionsResult.data || []) {
      const arr = sessionsByUser.get(s.user_id) || [];
      arr.push(s);
      sessionsByUser.set(s.user_id, arr);
    }

    const calcsByUser = new Map<string, typeof calculationsResult.data>();
    for (const c of calculationsResult.data || []) {
      const arr = calcsByUser.get(c.user_id) || [];
      arr.push(c);
      calcsByUser.set(c.user_id, arr);
    }

    const eventsByUser = new Map<string, typeof eventsResult.data>();
    for (const e of eventsResult.data || []) {
      const arr = eventsByUser.get(e.user_id) || [];
      arr.push(e);
      eventsByUser.set(e.user_id, arr);
    }

    // Process each user in memory (no more per-user queries)
    const upsertBatch: Record<string, unknown>[] = [];

    for (const user of users) {
      const sessions = sessionsByUser.get(user.id) || [];
      const calculations = calcsByUser.get(user.id) || [];
      const events = eventsByUser.get(user.id) || [];

      // Calculate metrics
      const sessions7d = sessions.filter((s) => new Date(s.started_at) > d7).length;
      const sessions30d = sessions.length;
      const calculations7d = calculations.filter((c) => new Date(c.created_at) > d7).length;
      const calculations30d = calculations.length;

      const uniqueModalities = new Set(calculations.map((c) => c.modality)).size;
      const uniqueIndications = new Set(calculations.map((c) => c.indication_category)).size;

      // Count event types
      const eventCounts = new Map<string, number>();
      for (const e of events) {
        eventCounts.set(e.event_type, (eventCounts.get(e.event_type) || 0) + 1);
      }

      const paywallHits = eventCounts.get('paywall_displayed') || 0;
      const exportAttempts = eventCounts.get('export_attempted') || 0;
      const proFeatureClicks = eventCounts.get('pro_feature_clicked') || 0;
      const partnerMatchRequests = eventCounts.get('partner_match_requested') || 0;
      const partnerClicks = eventCounts.get('partner_clicked') || 0;
      const partnerExpanded = eventCounts.get('partner_expanded') || 0;
      const partnerUpgradeClicks = eventCounts.get('partner_upgrade_cta_clicked') || 0;
      const partnerAdvisoryClicks = eventCounts.get('partner_advisory_cta_clicked') || 0;

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
      score += Math.min(partnerMatchRequests, 5) * SCORING_WEIGHTS.partner_match_requested;
      score += Math.min(partnerClicks, 10) * SCORING_WEIGHTS.partner_clicked;
      score += Math.min(partnerExpanded, 5) * SCORING_WEIGHTS.partner_expanded;
      score += Math.min(partnerUpgradeClicks, 3) * SCORING_WEIGHTS.partner_upgrade_cta_clicked;
      score += Math.min(partnerAdvisoryClicks, 2) * SCORING_WEIGHTS.partner_advisory_cta_clicked;

      // Timestamps for recency
      const allTimestamps = [
        ...sessions.map((s) => new Date(s.started_at).getTime()),
        ...calculations.map((c) => new Date(c.created_at).getTime()),
        ...events.map((e) => new Date(e.created_at).getTime()),
      ].filter((t) => !isNaN(t));

      const lastActivityAt = allTimestamps.length > 0 ? new Date(Math.max(...allTimestamps)) : null;
      const firstActivityAt = allTimestamps.length > 0 ? new Date(Math.min(...allTimestamps)) : null;

      if (lastActivityAt) {
        const daysSince = (now.getTime() - lastActivityAt.getTime()) / (24 * 60 * 60 * 1000);
        if (daysSince < 1) score += SCORING_WEIGHTS.activity_today;
        else if (daysSince < 3) score += SCORING_WEIGHTS.activity_3d;
        else if (daysSince < 7) score += SCORING_WEIGHTS.activity_7d;
      }

      score = Math.min(100, Math.round(score));

      let tier = 'cold';
      if (score >= TIER_THRESHOLDS.qualified) tier = 'qualified';
      else if (score >= TIER_THRESHOLDS.hot) tier = 'hot';
      else if (score >= TIER_THRESHOLDS.warm) tier = 'warm';

      upsertBatch.push({
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
    }

    // Batch upsert all scores at once
    if (upsertBatch.length > 0) {
      const { error: upsertError } = await supabase
        .from('lead_scores')
        .upsert(upsertBatch);

      if (upsertError) {
        console.error('Lead score batch upsert error:', upsertError);
      }
    }

    return NextResponse.json({
      success: true,
      processed: upsertBatch.length,
      total: users.length,
    });
  } catch (error) {
    console.error('Lead scoring error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
