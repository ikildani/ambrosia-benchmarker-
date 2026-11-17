/**
 * Cron: Company Financials and free company signals (Search & Evaluation)
 *
 * Modes (?mode=):
 *   financials          SEC XBRL cash / burn / runway, going-concern language and ATM/shelf
 *                       filings for every company with a CIK (lib/ingestion/company-financials.ts).
 *                       Resolves CIKs from company_tickers.json once a day.
 *   hkex                HKEX listing match when a week old (lib/ingestion/hkex-signals.ts), else
 *                       HKEXnews announcement titles for matched issuers, classified by rules
 *                       into financing events and intent signals (24-month backfill, then
 *                       incremental).
 *   hkex_match          Force the listing match.
 *   hkex_announcements  Force the announcements pass.
 *   form_d              US feed companies without a public CIK: 10-K filer search, then SEC
 *                       Form D private financings (lib/ingestion/form-d.ts).
 *
 * Without ?mode the run picks by UTC hour, so one cron entry serves all sources (vercel.json is
 * at the 100-cron cap): hours divisible by 6 run financials (the 4 runs a day it always had),
 * 2/8/14/20 run hkex, 4/10/16/22 run form_d. Schedule: `20 star-slash-2 * * *`.
 *
 * Query params: ?mode=  ?limit=  ?resolve_ciks=true (financials)  ?dry_run=1 (fetch and
 * classify, no DB writes; hkex and form_d modes).
 * Env: SEC_USER_AGENT (contact address, required by SEC fair-access policy).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runCompanyFinancials } from '@/lib/ingestion/company-financials';
import { COMPANY_SIGNAL_MODES, companySignalsSchemaReady, modeForHour, type CompanySignalsMode } from '@/lib/ingestion/company-signals';
import { hkexMatchDue, readHkexCursorState, runHkexAnnouncements, runHkexListingMatch } from '@/lib/ingestion/hkex-signals';
import { runFormD } from '@/lib/ingestion/form-d';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';
import verifiedHkexIssuers from '@/scripts/data/hkex-biotech-map-20261103.json';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const STAGE = 'company_financials';
const TIME_BUDGET_MS = 240_000;

function parsePositiveInt(raw: string | null, fallback: number | undefined): number | undefined {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function authorized(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '');
  const expected = process.env.CRON_SECRET;
  if (!expected || !cronSecret) return false;
  try {
    return timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const params = request.nextUrl.searchParams;
  const rawMode = params.get('mode');
  if (rawMode && !COMPANY_SIGNAL_MODES.includes(rawMode as CompanySignalsMode)) {
    return NextResponse.json({ error: `unknown mode ${rawMode}; one of ${COMPANY_SIGNAL_MODES.join(', ')}` }, { status: 400 });
  }
  const mode: CompanySignalsMode = (rawMode as CompanySignalsMode | null) ?? modeForHour(new Date().getUTCHours());
  const limit = parsePositiveInt(params.get('limit'), undefined);
  const dryRun = params.get('dry_run') === '1' || params.get('dry_run') === 'true';
  const startedAt = Date.now();

  try {
    if (mode === 'financials') return await financials(supabase, limit, params.get('resolve_ciks') === 'true', startedAt);
    return await companySignals(supabase, mode, limit, dryRun, startedAt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[company-financials:${mode}] Fatal error: ${message}`);
    await logRadarRun(supabase, {
      source: mode === 'financials' ? 'licensing_signals' : 'company_signals',
      startedAt,
      status: 'failed',
      errors: [message],
      parameters: { stage: mode === 'financials' ? STAGE : `company_signals:${mode}`, dry_run: dryRun },
    });
    return NextResponse.json({ success: false, mode, error: message }, { status: 500 });
  }
}

async function financials(supabase: ReturnType<typeof createServiceClient>, limit: number | undefined, resolveCiks: boolean, startedAt: number) {
  const result = await runCompanyFinancials(supabase, { limit, resolveCiks, timeBudgetMs: TIME_BUDGET_MS });
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
    mode: 'financials',
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
}

async function companySignals(
  supabase: ReturnType<typeof createServiceClient>,
  requested: Exclude<CompanySignalsMode, 'financials'>,
  limit: number | undefined,
  dryRun: boolean,
  startedAt: number,
) {
  const schema = await companySignalsSchemaReady(supabase);
  if (!schema.ready) {
    // Migration 189 not applied yet: say so once per run instead of failing every write.
    const logged = await logRadarRun(supabase, {
      source: 'company_signals', startedAt, status: 'partial', runType: 'scheduled',
      errors: [`migration 189 not applied: ${schema.error}`], parameters: { stage: `company_signals:${requested}`, skipped: true },
      notes: 'company signals skipped until supabase/migrations/189_company_signals.sql is applied',
    });
    return NextResponse.json({ success: false, mode: requested, skipped: 'migration 189 not applied', error: schema.error, logged });
  }

  let mode: Exclude<CompanySignalsMode, 'financials' | 'hkex'> = requested === 'hkex'
    ? (hkexMatchDue((await readHkexCursorState(supabase)).lastMatchAt) ? 'hkex_match' : 'hkex_announcements')
    : requested;

  const runType = dryRun ? 'manual' : 'scheduled';
  if (mode === 'hkex_match') {
    const r = await runHkexListingMatch(supabase, { dryRun, verified: verifiedHkexIssuers });
    const logged = await logRadarRun(supabase, {
      source: 'company_signals', startedAt, runType,
      status: deriveRunStatus({ errors: r.errors.length, processed: r.candidates, produced: dryRun ? r.matched : r.written }),
      fetched: r.equities, processed: r.candidates, updated: r.written, skipped: r.unmatched + r.ambiguous, errors: r.errors,
      parameters: { stage: 'company_signals:hkex_match', dry_run: dryRun, equities: r.equities, matched: r.matched, verified: r.verified, ambiguous: r.ambiguous, unmatched: r.unmatched },
    });
    return NextResponse.json({ success: true, mode, dry_run: dryRun, ...r, errors: r.errors.slice(0, 10), logged });
  }

  if (mode === 'hkex_announcements') {
    const r = await runHkexAnnouncements(supabase, { dryRun, limit, timeBudgetMs: TIME_BUDGET_MS });
    const logged = await logRadarRun(supabase, {
      source: 'company_signals', startedAt, runType,
      status: deriveRunStatus({ errors: r.errors.length, timedOut: r.timedOut || r.throttled, processed: r.issuers, produced: r.announcements }),
      fetched: r.announcements, processed: r.issuers, inserted: r.financingEvents + r.intentSignals, errors: r.errors,
      parameters: { stage: 'company_signals:hkex_announcements', dry_run: dryRun, by_type: r.byType, financing_events: r.financingEvents, intent_signals: r.intentSignals, cursor: r.cursor, throttled: r.throttled, timed_out: r.timedOut },
    });
    return NextResponse.json({ success: true, mode, dry_run: dryRun, ...r, errors: r.errors.slice(0, 10), logged });
  }

  mode = 'form_d';
  const r = await runFormD(supabase, { dryRun, limit, timeBudgetMs: TIME_BUDGET_MS });
  const logged = await logRadarRun(supabase, {
    source: 'company_signals', startedAt, runType,
    status: deriveRunStatus({ errors: r.errors.length, timedOut: r.timedOut, processed: r.processed, produced: r.processed }),
    fetched: r.candidates, processed: r.processed, inserted: r.events, updated: r.ciksResolved + r.inactiveFilers + r.matched, errors: r.errors,
    parameters: { stage: 'company_signals:form_d', dry_run: dryRun, matched: r.matched, events: r.events, ciks_resolved: r.ciksResolved, inactive_filers: r.inactiveFilers, rejected_filings: r.rejectedFilings, timed_out: r.timedOut, sec_user_agent_set: Boolean(process.env.SEC_USER_AGENT) },
  });
  return NextResponse.json({ success: true, mode, dry_run: dryRun, ...r, errors: r.errors.slice(0, 10), logged });
}
