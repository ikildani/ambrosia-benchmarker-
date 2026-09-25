/**
 * Cron: Asset Catalysts (Search & Evaluation, Phase 3 Workstream C)
 *
 * Derives dated catalysts per clinical asset from company_trials (primary /
 * study completion), clinical_assets.phase_history (phase transitions) and
 * press_releases (PDUFA dates, conference presentations, readouts), and marks
 * observed_date when a date passes or a readout matches
 * (lib/ingestion/catalysts.ts).
 *
 * Suggested schedule: every 2 hours at :25 (`25 star-slash-2 * * *`), 400
 * assets per run, after registry-sweep (:00 every 2h) and press-releases
 * (:05 every 2h). ~122k assets with a company -> one full pass in ~25 days;
 * raise the limit once the run time is known.
 *
 * Query params (optional): ?limit=400
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runCatalysts } from '@/lib/ingestion/catalysts';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const STAGE = 'catalysts';

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
    const result = await runCatalysts(supabase, { limit, timeBudgetMs: 240_000 });

    const status = deriveRunStatus({
      errors: result.errors.length,
      timedOut: result.timedOut,
      processed: result.assetsProcessed,
      produced: result.catalystsUpserted + result.observedMarked,
    });

    const logged = await logRadarRun(supabase, {
      source: 'licensing_signals',
      startedAt,
      status,
      runType: 'scheduled',
      fetched: result.trialsFetched + result.pressFetched,
      processed: result.assetsProcessed,
      inserted: result.catalystsUpserted,
      updated: result.observedMarked,
      failed: result.failed,
      errors: result.errors,
      parameters: {
        stage: STAGE,
        limit: limit ?? 400,
        trials_fetched: result.trialsFetched,
        press_fetched: result.pressFetched,
        catalysts_upserted: result.catalystsUpserted,
        observed_marked: result.observedMarked,
        cursor: result.cursor,
        timed_out: result.timedOut,
      },
    });

    return NextResponse.json({
      success: true,
      stage: STAGE,
      assets_processed: result.assetsProcessed,
      trials_fetched: result.trialsFetched,
      press_fetched: result.pressFetched,
      catalysts_upserted: result.catalystsUpserted,
      observed_marked: result.observedMarked,
      failed: result.failed,
      errors: result.errors.slice(0, 10),
      error_count: result.errors.length,
      timed_out: result.timedOut,
      cursor: result.cursor,
      duration_ms: result.durationMs,
      logged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[catalysts] Fatal error: ${message}`);
    await logRadarRun(supabase, {
      source: 'licensing_signals',
      startedAt,
      status: 'failed',
      errors: [message],
      parameters: { stage: STAGE },
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
