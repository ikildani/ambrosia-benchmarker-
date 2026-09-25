/**
 * Cron: Partnership Refresh (Search & Evaluation, Phase 2 item 7)
 *
 * Re-derives partnership_status / partner / territory split / evidence for
 * clinical_assets using lib/radar/partnership.ts (deals constrained to the
 * asset's company, trial collaborators, press releases).
 *
 * Modes (auto-selected unless ?mode= is given):
 *   backlog      never-checked assets, oldest first, 5,000 per run; assets
 *                whose company has no signal source at all are stamped
 *                unpartnered in bulk first (migration 113).
 *   incremental  only assets whose company gained a deal, press mention or
 *                trial row since they were last checked, plus a rolling
 *                30-day re-check.
 *
 * Schedule (vercel.json): backlog `45 * * * *` (hourly) until the run log
 * reports backlog.never_checked = 0; then `45 4 * * *` (daily, after
 * deals-update at 3 AM and the press-release persist runs).
 *
 * Query params (optional):
 *   ?limit=5000               assets per run
 *   ?mode=backlog|incremental force a mode
 *   ?budget=240000            wall-clock budget in ms (max 280000)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { refreshPartnershipBatch, type RefreshMode } from '@/lib/radar/partnership';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function parsePositiveInt(raw: string | null, fallback: number | undefined): number | undefined {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseMode(raw: string | null): RefreshMode | 'auto' {
  return raw === 'backlog' || raw === 'incremental' ? raw : 'auto';
}

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
  const params = request.nextUrl.searchParams;
  const limit = parsePositiveInt(params.get('limit'), undefined);
  const mode = parseMode(params.get('mode'));
  const timeBudgetMs = Math.min(parsePositiveInt(params.get('budget'), 240_000) ?? 240_000, 280_000);
  const manual = params.has('mode') || params.has('budget');
  const startedAt = Date.now();

  try {
    const result = await refreshPartnershipBatch(supabase, { limit, mode, timeBudgetMs });

    // Ownership attribution rides on the same cadence: rows whose drug
    // resolution or enrichment moved since their last check get re-derived
    // (radar_apply_ownership, migration 125). Cheap and set-based, so a
    // failure is reported but never fails the partnership run.
    let ownership: Record<string, unknown> | null = null;
    if (Date.now() - startedAt < timeBudgetMs) {
      const { data, error } = await supabase.rpc('radar_apply_ownership', { p_limit: 5000, p_recheck_days: 30 });
      if (error) result.errors.push(`radar_apply_ownership failed (is migration 125 applied?): ${error.message}`);
      else ownership = (data ?? null) as Record<string, unknown> | null;
    }

    const status = deriveRunStatus({
      errors: result.errors.length,
      timedOut: result.timedOut,
      processed: result.processed + result.stampedUnpartnered,
      produced: result.processed + result.stampedUnpartnered,
    });

    const logged = await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt,
      status,
      runType: manual ? 'manual' : 'scheduled',
      fetched: result.dealsFetched + result.collaboratorRowsFetched + result.pressHitsFetched,
      processed: result.processed + result.stampedUnpartnered,
      updated: result.updated + result.stampedUnpartnered,
      skipped: result.unchanged,
      failed: result.failed,
      errors: result.errors,
      parameters: {
        stage: 'partnership_refresh',
        mode: result.mode,
        limit: limit ?? 5000,
        slices: result.slices,
        transitions: result.transitions,
        status_counts: result.statusCounts,
        stamped_unpartnered: result.stampedUnpartnered,
        stamped_by_previous_status: result.stampedByPreviousStatus,
        changed_detected: result.changedDetected,
        rolling_rechecked: result.rollingRechecked,
        deals_fetched: result.dealsFetched,
        collaborator_rows_fetched: result.collaboratorRowsFetched,
        press_hits_fetched: result.pressHitsFetched,
        backlog: {
          never_checked: result.backlog.neverChecked,
          checked: result.backlog.checked,
          stale_30d: result.backlog.stale30d,
          estimated_runs_remaining: result.backlog.estimatedRunsRemaining,
        },
        timed_out: result.timedOut,
        ownership,
      },
      notes: [
        `${result.mode}: ${result.processed} derived, ${result.stampedUnpartnered} bulk-stamped unpartnered`,
        Object.entries(result.transitions).map(([k, v]) => `${k}: ${v}`).join(', ') || null,
        result.backlog.neverChecked !== null ? `backlog ${result.backlog.neverChecked} never checked` : null,
      ].filter(Boolean).join('; '),
    });

    return NextResponse.json({
      success: true,
      mode: result.mode,
      processed: result.processed,
      updated: result.updated,
      unchanged: result.unchanged,
      failed: result.failed,
      stamped_unpartnered: result.stampedUnpartnered,
      stamped_by_previous_status: result.stampedByPreviousStatus,
      changed_detected: result.changedDetected,
      rolling_rechecked: result.rollingRechecked,
      slices: result.slices,
      transitions: result.transitions,
      status_counts: result.statusCounts,
      deals_fetched: result.dealsFetched,
      collaborator_rows_fetched: result.collaboratorRowsFetched,
      press_hits_fetched: result.pressHitsFetched,
      backlog: result.backlog,
      ownership,
      errors: result.errors.slice(0, 10),
      error_count: result.errors.length,
      timed_out: result.timedOut,
      duration_ms: result.durationMs,
      logged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[partnership-refresh] Fatal error: ${message}`);
    await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt,
      status: 'failed',
      errors: [message],
      parameters: { stage: 'partnership_refresh', mode },
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
