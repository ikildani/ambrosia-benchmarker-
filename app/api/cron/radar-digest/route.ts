/**
 * Cron: Search & Evaluation digest and alerts (Workstream G2)
 *
 * Runs lib/radar/notifications.ts once: mandate digests (email / in-app /
 * Slack, per radar_user_mandates.notify_* and radar_alert_rules), score
 * threshold crossings and score moves on watchlists, partnership changes,
 * and catalysts within the rule's horizon. Idempotent via
 * radar_alert_events.dedupe_key.
 *
 * Suggested schedule (vercel.json): "30 12 * * *" — daily 12:30 UTC, after
 * the mandate matcher (10:00), competitive intel (10:30) and deal creator
 * (11:30) so the digest sees the day's new matches and scores.
 *
 * Auth: Bearer CRON_SECRET, timing-safe. Logged through logRadarRun with
 * source 'mandate_matcher' and parameters.stage = 'radar_digest'.
 *
 * Second phase (vercel.json is at the 100-cron cap): after the radar run,
 * the post-delivery brief alerts (lib/brief/alerts.ts) use whatever budget
 * is left up to 280 s from the start. Its report rides in the same log row
 * (parameters.brief_alerts) and the response. On demand:
 * /api/cron/outcome-resolve?briefAlerts=true.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { runRadarNotifications } from '@/lib/radar/notifications';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';
import { runBriefAlerts, type BriefAlertRunReport } from '@/lib/brief/alerts';

const BRIEF_ALERTS_DEADLINE_MS = 280_000;

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '');
  const expected = process.env.CRON_SECRET;
  if (!expected || !cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    if (!timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const startedAt = Date.now();

  try {
    const result = await runRadarNotifications(supabase, { timeBudgetMs: 240_000 });

    // Phase 2: brief alerts with the remaining budget. Never lets the radar log fail.
    let briefAlerts: BriefAlertRunReport | { error: string } | null = null;
    try {
      briefAlerts = await runBriefAlerts(supabase, { deadline: startedAt + BRIEF_ALERTS_DEADLINE_MS });
      console.log(`[cron/radar-digest] brief alerts: requests=${briefAlerts.requests} items=${briefAlerts.items} claimed=${briefAlerts.claimed} sent=${briefAlerts.sent} failed=${briefAlerts.failed}${briefAlerts.timedOut ? ' (timed out)' : ''}${briefAlerts.errors.length ? ` errors=${briefAlerts.errors.length}` : ''}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[cron/radar-digest] brief alerts failed:', message);
      briefAlerts = { error: message };
    }

    const produced = result.eventsCreated + result.duplicatesSkipped;
    const status = deriveRunStatus({
      errors: result.errors.length + result.deliveriesFailed,
      timedOut: result.timedOut,
      // Only count a run as "processed" when there was something to evaluate.
      processed: result.digestsBuilt + result.rulesEvaluated,
      produced: result.digestsBuilt + result.rulesEvaluated > 0 ? Math.max(produced, 1) : 0,
    });

    const logged = await logRadarRun(supabase, {
      source: 'mandate_matcher',
      startedAt,
      status,
      runType: 'scheduled',
      fetched: result.mandatesScanned,
      processed: result.digestsBuilt + result.rulesEvaluated,
      inserted: result.eventsCreated,
      skipped: result.duplicatesSkipped,
      failed: result.deliveriesFailed,
      errors: result.errors,
      parameters: {
        stage: 'radar_digest',
        mandates_scanned: result.mandatesScanned,
        digests_built: result.digestsBuilt,
        rules_evaluated: result.rulesEvaluated,
        deliveries_sent: result.deliveriesSent,
        deliveries_failed: result.deliveriesFailed,
        timed_out: result.timedOut,
        brief_alerts: briefAlerts,
      },
      notes: `digests ${result.digestsBuilt}, events ${result.eventsCreated}, sent ${result.deliveriesSent}` +
        (briefAlerts && 'sent' in briefAlerts ? `; brief alerts ${briefAlerts.sent} sent / ${briefAlerts.items} items` : ''),
    });

    return NextResponse.json({ success: true, ...result, briefAlerts, status, logged, duration_ms: Date.now() - startedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/radar-digest] failed:', message);
    await logRadarRun(supabase, {
      source: 'mandate_matcher',
      startedAt,
      status: 'failed',
      errors: [message],
      parameters: { stage: 'radar_digest' },
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
