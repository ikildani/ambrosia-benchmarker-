/**
 * Cron: Licensing-intent score backtest (scoring v3).
 *
 * Drives lib/radar/backtest/run.ts through its cursor (radar_sync_cursors
 * source 'score_backtest'):
 *   labels → snapshots (resumable, many invocations) → train → done.
 *
 * Each invocation does at most ~240 s of work and persists its position, so
 * the schedule can be dense; once the phase is 'done' the run is a no-op.
 * The train phase stores the model and the gate verdict (better than the active
 * model on precision@100, top-decile lift AND AUC, feed protocol, same rows).
 * It never activates on a schedule: activation is a rollout step.
 *
 * Schedule: 30 *\/2 * * * (every two hours, offset from asset-universe).
 *
 * Manual:
 *   GET /api/cron/score-backtest?phase=train&dry_run=1   train on stored snapshots, write nothing
 *   GET /api/cron/score-backtest?phase=train             train, store model + backtest (no activation)
 *   GET /api/cron/score-backtest?phase=train&activate=1  ... and activate if the gate passes
 *   GET /api/cron/score-backtest?activate_version=v5.X   activate a stored model whose gate passed
 *   GET /api/cron/score-backtest?reset=1                 wipe snapshots and rebuild
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runScoreBacktest, activateStoredModel, type BacktestPhase } from '@/lib/radar/backtest/run';

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
  const dryRun = params.get('dry_run') === '1';
  const activate = params.get('activate') === '1';
  const activateVersion = params.get('activate_version');
  if (dryRun && (phase !== 'train' || reset)) {
    return NextResponse.json({ error: 'dry_run=1 needs phase=train (and no reset)' }, { status: 400 });
  }
  const runType = phase || reset ? 'manual' : 'scheduled';

  const supabase = createServiceClient();

  if (activateVersion) {
    if (!/^v\d+\.\d{12}$/.test(activateVersion)) {
      return NextResponse.json({ error: 'activate_version must look like v5.202611240000' }, { status: 400 });
    }
    const r = await activateStoredModel(supabase, activateVersion, { force: params.get('force') === '1' });
    return NextResponse.json({ success: r.activated, version: activateVersion, ...r }, { status: r.activated ? 200 : 409 });
  }

  try {
    const result = await runScoreBacktest(supabase, { phase, reset, runType, dryRun, activate });
    return NextResponse.json({
      success: true,
      run_type: runType,
      dry_run: dryRun,
      gate_passed: result.gate_passed ?? null,
      gate: result.gate ?? null,
      incumbent: result.incumbent ?? null,
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
