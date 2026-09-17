/**
 * Cron: Licensing-intent score backtest (scoring v3).
 *
 * Drives lib/radar/backtest/run.ts through its cursor (radar_sync_cursors
 * source 'score_backtest'):
 *   labels → snapshots (resumable, many invocations) → train → done.
 *
 * Each invocation does at most ~240 s of work and persists its position, so
 * the schedule can be dense; once the phase is 'done' the run is a no-op.
 * A model is activated only when it beats the active one on the same test
 * window (precision@50 and ROC-AUC), or when none is active.
 *
 * Schedule: 30 *\/2 * * * (every two hours, offset from asset-universe).
 *
 * Manual:
 *   GET /api/cron/score-backtest?phase=train   retrain on existing snapshots
 *   GET /api/cron/score-backtest?reset=1       wipe snapshots and rebuild
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runScoreBacktest, type BacktestPhase } from '@/lib/radar/backtest/run';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const PHASES: readonly BacktestPhase[] = ['labels', 'snapshots', 'train', 'done'];

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

  const params = request.nextUrl.searchParams;
  const phaseRaw = params.get('phase');
  const phase = phaseRaw && (PHASES as readonly string[]).includes(phaseRaw) ? (phaseRaw as BacktestPhase) : undefined;
  if (phaseRaw && !phase) {
    return NextResponse.json({ error: `phase must be one of ${PHASES.join(', ')}` }, { status: 400 });
  }
  const reset = params.get('reset') === '1';
  const runType = phase || reset ? 'manual' : 'scheduled';

  const supabase = createServiceClient();

  try {
    const result = await runScoreBacktest(supabase, { phase, reset, runType });
    return NextResponse.json({
      success: true,
      run_type: runType,
      phase_before: result.phase_before,
      phase_after: result.phase_after,
      processed: result.processed,
      written: result.written,
      model_version: result.model_version ?? null,
      backtest_id: result.backtest_id ?? null,
      activated: result.activated ?? null,
      metrics: result.metrics ?? null,
      timed_out: result.timed_out,
      duration_ms: result.duration_ms,
      logged: result.logged,
      errors: result.errors.slice(0, 10),
      error_count: result.errors.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[score-backtest] Fatal error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
