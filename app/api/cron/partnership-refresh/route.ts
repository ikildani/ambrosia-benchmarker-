/**
 * Cron: Partnership Refresh (Asset Radar, Phase 2 item 7)
 *
 * Re-derives partnership_status / partner / territory split / evidence for
 * clinical_assets, oldest partnership_checked_at first, using
 * lib/radar/partnership.ts (deals constrained to the asset's company, trial
 * collaborators, press releases). Replaces the per-asset partnership lookups
 * inside the Layer 1 indexer.
 *
 * Suggested schedule: every 6 hours at :45 (`45 star-slash-6 * * *`), 500
 * assets per run, after deals-update (3 AM) and press-releases.
 *
 * Query params (optional): ?limit=500
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { refreshPartnershipBatch } from '@/lib/radar/partnership';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function parsePositiveInt(raw: string | null, fallback: number | undefined): number | undefined {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
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
  const limit = parsePositiveInt(request.nextUrl.searchParams.get('limit'), undefined);
  const startedAt = Date.now();

  try {
    const result = await refreshPartnershipBatch(supabase, { limit, timeBudgetMs: 240_000 });

    const status = deriveRunStatus({
      errors: result.errors.length,
      timedOut: result.timedOut,
      processed: result.processed,
      produced: result.processed,
    });

    const logged = await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt,
      status,
      runType: 'scheduled',
      fetched: result.dealsFetched + result.collaboratorRowsFetched + result.pressHitsFetched,
      processed: result.processed,
      updated: result.updated,
      skipped: result.unchanged,
      failed: result.failed,
      errors: result.errors,
      parameters: {
        stage: 'partnership_refresh',
        limit: limit ?? 500,
        transitions: result.transitions,
        status_counts: result.statusCounts,
        deals_fetched: result.dealsFetched,
        collaborator_rows_fetched: result.collaboratorRowsFetched,
        press_hits_fetched: result.pressHitsFetched,
        timed_out: result.timedOut,
      },
      notes: Object.entries(result.transitions).map(([k, v]) => `${k}: ${v}`).join(', ') || undefined,
    });

    return NextResponse.json({
      success: true,
      processed: result.processed,
      updated: result.updated,
      unchanged: result.unchanged,
      failed: result.failed,
      transitions: result.transitions,
      status_counts: result.statusCounts,
      deals_fetched: result.dealsFetched,
      collaborator_rows_fetched: result.collaboratorRowsFetched,
      press_hits_fetched: result.pressHitsFetched,
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
      parameters: { stage: 'partnership_refresh' },
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
