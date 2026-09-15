/**
 * Cron: Patents by Assignee (Asset Radar, Phase 3 Workstream C)
 *
 * PatentsView v1 search by assignee organization for every industry-owned
 * company with a Phase 1+ asset; writes company_patents and links patents to
 * drug_master through drug_aliases (lib/ingestion/patents-assignee.ts).
 * radar_patent_velocity (migration 114) is the rolling 12-month view.
 *
 * Suggested schedule: every 2 hours at :40 (`40 star-slash-2 * * *`), 30
 * companies per run (45 req/min cap; ~1-3 requests per company). Roughly
 * 10k industry companies -> one full pass in ~28 days; re-visits only pull
 * patents granted since the last pass.
 *
 * Query params (optional): ?limit=30
 * Env: PATENTSVIEW_API_KEY (without it the run logs a skip and exits 200).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runPatentsAssignee } from '@/lib/ingestion/patents-assignee';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const STAGE = 'patents_assignee';

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
    const result = await runPatentsAssignee(supabase, { limit, timeBudgetMs: 240_000 });

    // A missing key is a configuration gap, not a data failure: log it as
    // partial so the cron health monitor surfaces it, but return 200.
    const status = result.skipped
      ? 'partial'
      : deriveRunStatus({
          errors: result.errors.length,
          timedOut: result.timedOut,
          processed: result.companiesProcessed,
          produced: result.patentsUpserted,
        });

    const logged = await logRadarRun(supabase, {
      source: 'licensing_signals',
      startedAt,
      status,
      runType: 'scheduled',
      fetched: result.patentsFetched,
      processed: result.companiesProcessed,
      inserted: result.patentsUpserted,
      updated: result.linked,
      failed: result.failed,
      errors: result.skipped ? [result.skipped, ...result.errors] : result.errors,
      parameters: {
        stage: STAGE,
        limit: limit ?? 30,
        companies_processed: result.companiesProcessed,
        patents_fetched: result.patentsFetched,
        patents_upserted: result.patentsUpserted,
        linked_to_drug: result.linked,
        cursor: result.cursor,
        timed_out: result.timedOut,
        api_key_set: Boolean(process.env.PATENTSVIEW_API_KEY),
      },
      notes: result.skipped ?? undefined,
    });

    return NextResponse.json({
      success: true,
      stage: STAGE,
      skipped: result.skipped,
      companies_processed: result.companiesProcessed,
      patents_fetched: result.patentsFetched,
      patents_upserted: result.patentsUpserted,
      linked_to_drug: result.linked,
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
    console.error(`[patents-assignee] Fatal error: ${message}`);
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
