/**
 * Cron: sponsor-agnostic ClinicalTrials.gov sweep (Asset Radar Phase 2.1)
 *
 * Walks every interventional drug/biologic/genetic/combination-product study
 * on CT.gov in LastUpdatePostDate order, creates sponsor companies as needed,
 * and feeds company_trials + trial_interventions so the asset-universe cron
 * (6:30 AM UTC) indexes sellers as well as buyers.
 *
 * Schedule: hourly during the backfill (~225k studies, 6–8 runs), then daily
 * at 4:30 AM UTC — after deals-update (3 AM), before trials-update (5 AM) and
 * asset-universe (6:30 AM). The cursor lives in radar_sync_cursors
 * (source 'ctgov_sweep'); once caught up, a run is one or two pages.
 *
 * Query params (all optional):
 *   ?full=true   reset the cursor to 2000-01-01 and start over
 *   ?chunk=N     max pages this run (default 400 — the time budget stops it first)
 *   ?limit=N     studies per page, 1..1000 (default 1000)
 *   ?budget=MS   wall-clock budget in ms (default 250000)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runCtgovSweep } from '@/lib/ingestion/ctgov-sweep';
import { runCronIntelligence } from '@/lib/cron-intelligence';

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
  const params = request.nextUrl.searchParams;
  const full = params.get('full') === 'true' || params.get('full') === '1';
  const maxPages = parsePositiveInt(params.get('chunk'), undefined);
  const pageSize = parsePositiveInt(params.get('limit'), undefined);
  const timeBudgetMs = parsePositiveInt(params.get('budget'), undefined);

  try {
    const result = await runCtgovSweep(supabase, {
      full,
      maxPages,
      pageSize,
      timeBudgetMs,
      runType: full ? 'backfill' : 'scheduled',
    });

    // Cron health tracking (same pattern as asset-universe); never fatal.
    try {
      await runCronIntelligence(supabase, 'ctgov-sweep', {
        processed: result.studiesFetched,
        inserted: result.trialsUpserted + result.interventionsUpserted,
        skipped: result.orphanTrials,
        errors: result.errors.length,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      pages_fetched: result.pagesFetched,
      studies_fetched: result.studiesFetched,
      trials_upserted: result.trialsUpserted,
      orphan_trials: result.orphanTrials,
      cro_led_trials: result.croLedTrials,
      interventions_upserted: result.interventionsUpserted,
      primary_interventions: result.primaryInterventions,
      sponsors_seen: result.sponsorsSeen,
      sponsors_resolved: result.sponsorsResolved,
      companies_matched: result.companiesMatched,
      companies_created: result.companiesCreated,
      cursor_before: result.cursorBefore,
      cursor_after: result.cursorAfter,
      page_token_pending: !!result.pageTokenAfter,
      caught_up: result.caughtUp,
      total_count: result.totalCount,
      timed_out: result.timedOut,
      errors: result.errors.slice(0, 10),
      error_count: result.errors.length,
      logged: result.logged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ctgov-sweep] Fatal error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
