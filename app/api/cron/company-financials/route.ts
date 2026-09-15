/**
 * Cron: Company Financials (Asset Radar, Phase 3 Workstream C)
 *
 * SEC XBRL cash / burn / runway, going-concern language and ATM/shelf filings
 * for every company with a CIK (lib/ingestion/company-financials.ts). Resolves
 * CIKs from company_tickers.json once a day. Round-robins through filers via
 * radar_sync_cursors('company_financials').
 *
 * Suggested schedule: every 6 hours at :20 (`20 star-slash-6 * * *`), 40
 * companies per run (~3 SEC requests each, under 10 req/s).
 *
 * Query params (optional): ?limit=40  ?resolve_ciks=true
 * Env: SEC_USER_AGENT (contact address, required by SEC fair-access policy).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runCompanyFinancials } from '@/lib/ingestion/company-financials';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const STAGE = 'company_financials';

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
  const resolveCiks = request.nextUrl.searchParams.get('resolve_ciks') === 'true';
  const startedAt = Date.now();

  try {
    const result = await runCompanyFinancials(supabase, { limit, resolveCiks, timeBudgetMs: 240_000 });

    const status = deriveRunStatus({
      errors: result.errors.length,
      timedOut: result.timedOut,
      processed: result.processed,
      produced: result.rowsUpserted + result.ciksResolved,
    });

    const logged = await logRadarRun(supabase, {
      source: 'licensing_signals',
      startedAt,
      status,
      runType: 'scheduled',
      fetched: result.processed,
      processed: result.processed,
      inserted: result.rowsUpserted,
      updated: result.ciksResolved,
      skipped: result.skippedNoCik,
      failed: result.failed,
      errors: result.errors,
      parameters: {
        stage: STAGE,
        limit: limit ?? 40,
        ciks_resolved: result.ciksResolved,
        rows_upserted: result.rowsUpserted,
        cursor: result.cursor,
        timed_out: result.timedOut,
        sec_user_agent_set: Boolean(process.env.SEC_USER_AGENT),
      },
    });

    return NextResponse.json({
      success: true,
      stage: STAGE,
      processed: result.processed,
      ciks_resolved: result.ciksResolved,
      rows_upserted: result.rowsUpserted,
      skipped_no_cik: result.skippedNoCik,
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
    console.error(`[company-financials] Fatal error: ${message}`);
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
