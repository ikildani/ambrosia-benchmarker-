/**
 * Cron: Licensing Signal Detection (scoring v2)
 *
 * Scores clinical assets with the 9-factor licensing intent model in
 * lib/radar/signal-detection. Evidence is fetched once per company, scoring
 * is pure arithmetic, and persistence is batched, so a single 250 s run
 * covers ~2,500 assets (the queue is ordered by last_scored_at NULLS FIRST,
 * so never-scored assets go first).
 *
 * Schedule: 8:00 AM UTC daily (after asset-universe at 6:30 AM)
 *
 * Manual backfill: GET /api/cron/licensing-signals?limit=6000
 *   `limit` (1..10000) overrides the default queue size and marks the run
 *   as run_type = 'backfill' in data_ingestion_log.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { detectLicensingSignals, DEFAULT_RUN_LIMIT, MAX_RUN_LIMIT } from '@/lib/radar/signal-detection';

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

  // Optional manual override of the queue size for backfill runs.
  const limitParam = request.nextUrl.searchParams.get('limit');
  let limit = DEFAULT_RUN_LIMIT;
  let runType: 'scheduled' | 'backfill' = 'scheduled';
  if (limitParam !== null) {
    const parsed = Number.parseInt(limitParam, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_RUN_LIMIT) {
      return NextResponse.json(
        { error: `limit must be an integer between 1 and ${MAX_RUN_LIMIT}` },
        { status: 400 },
      );
    }
    limit = parsed;
    runType = 'backfill';
  }

  const supabase = createServiceClient();

  try {
    const result = await detectLicensingSignals(supabase, { limit, runType });

    return NextResponse.json({
      success: true,
      run_type: runType,
      limit,
      assets_queued: result.assetsQueued,
      assets_scored: result.assetsScored,
      assets_failed: result.assetsFailed,
      signals_detected: result.signalsDetected,
      signals_inserted: result.signalsInserted,
      snapshots_taken: result.snapshotsTaken,
      factor_nonzero: result.factorNonZero,
      factor_errors: result.factorErrors,
      duration_ms: result.durationMs,
      timed_out: result.timedOut,
      logged: result.logged,
      errors: result.errors.slice(0, 10),
      error_count: result.errors.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[licensing-signals] Fatal error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
