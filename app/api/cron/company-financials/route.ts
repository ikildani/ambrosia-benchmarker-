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
 *   deal_signals        (198) company_signal_refresh_deal_intent() + company_signal_refresh_derived_listings():
 *                       deal-record intent signals and HKEX / ceased-filer listings, pure SQL.
 *   listings            (198) official exchange lists -> company_listings (lib/ingestion/listings.ts).
 *                       ?sources=SSE,SZSE limits the lists.
 *   edgar_index         (198) EDGAR CIK lookup file -> health-care filers -> listings, CIKs, Form D
 *                       (lib/ingestion/edgar-filers.ts).
 *   nih_grants          (198) NIH RePORTER SBIR/STTR awards -> company_grants (lib/ingestion/nih-grants.ts).
 *   enrich              (198) deal_signals, then listings when a week old, else EDGAR index (06:00)
 *                       or NIH grants (18:00).
 *
 * Without ?mode the run picks by UTC hour, so one cron entry serves all sources (vercel.json is
 * at the 100-cron cap): 00/12 run financials, 06/18 run enrich (198), 2/8/14/20 run hkex,
 * 4/10/16/22 run form_d. Schedule: `20 star-slash-2 * * *`.
 *
 * Query params: ?mode=  ?limit=  ?resolve_ciks=true (financials)  ?dry_run=1 (fetch and
 * classify, no DB writes; hkex and form_d modes).
 * Env: SEC_USER_AGENT (contact address, required by SEC fair-access policy).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runCompanyFinancials } from '@/lib/ingestion/company-financials';
import { COMPANY_SIGNAL_MODES, LISTINGS_CURSOR, companySignalsSchemaReady, enrichStep, modeForHour, type CompanySignalsMode } from '@/lib/ingestion/company-signals';
import { LISTING_SOURCES, runListings, type ListingSourceKey } from '@/lib/ingestion/listings';
import { runEdgarFilers } from '@/lib/ingestion/edgar-filers';
import { runNihGrants } from '@/lib/ingestion/nih-grants';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
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
    if (V2_MODES.has(mode)) return await signalsV2(supabase, mode as V2Mode, { limit, dryRun, startedAt, sources: params.get('sources') });
    return await companySignals(supabase, mode as Exclude<CompanySignalsMode, 'financials' | V2Mode>, limit, dryRun, startedAt);
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

type V2Mode = 'enrich' | 'deal_signals' | 'listings' | 'edgar_index' | 'nih_grants';
const V2_MODES: ReadonlySet<string> = new Set(['enrich', 'deal_signals', 'listings', 'edgar_index', 'nih_grants']);

/** Company signals v2 (migration 198). Every step logs its own data_ingestion_log row. */
async function signalsV2(
  supabase: ReturnType<typeof createServiceClient>,
  requested: V2Mode,
  o: { limit: number | undefined; dryRun: boolean; startedAt: number; sources: string | null },
) {
  const runType = o.dryRun ? 'manual' : 'scheduled';
  const out: Record<string, unknown> = { success: true, mode: requested, dry_run: o.dryRun };

  // Migration 198 not applied: say so once instead of failing every write.
  const probe = await supabase.from('company_listings').select('id', { count: 'exact', head: true }).limit(1);
  if (probe.error) {
    const logged = await logRadarRun(supabase, {
      source: 'company_signals', startedAt: o.startedAt, status: 'partial', runType,
      errors: [`migration 198 not applied: ${probe.error.message}`], parameters: { stage: `company_signals:${requested}`, skipped: true },
    });
    return NextResponse.json({ success: false, mode: requested, skipped: 'migration 198 not applied', error: probe.error.message, logged });
  }

  if (requested === 'enrich' || requested === 'deal_signals') {
    const t0 = Date.now();
    const errors: string[] = [];
    let deal: unknown = null;
    let derived: unknown = null;
    if (!o.dryRun) {
      const a = await supabase.rpc('company_signal_refresh_deal_intent');
      if (a.error) errors.push(`deal intent: ${a.error.message}`); else deal = a.data;
      const b = await supabase.rpc('company_signal_refresh_derived_listings');
      if (b.error) errors.push(`derived listings: ${b.error.message}`); else derived = b.data;
    }
    const dealCounts = (deal ?? {}) as Record<string, number>;
    await logRadarRun(supabase, {
      source: 'company_signals', startedAt: t0, runType,
      status: deriveRunStatus({ errors: errors.length, processed: 1, produced: 1 }),
      processed: dealCounts.candidates ?? 0, inserted: dealCounts.upserted ?? 0, skipped: dealCounts.rejected_name_disagreement ?? 0,
      errors, parameters: { stage: 'company_signals:deal_signals', dry_run: o.dryRun, deal, derived },
    });
    out.deal_signals = { deal, derived, errors };
    if (requested === 'deal_signals') return NextResponse.json(out);
  }

  let step: Exclude<V2Mode, 'enrich' | 'deal_signals'> = requested as Exclude<V2Mode, 'enrich' | 'deal_signals'>;
  if (requested === 'enrich') {
    const cur = await readSyncCursor<{ lastRunAt?: string }>(supabase, LISTINGS_CURSOR);
    const pending = await supabase.rpc('company_signal_edgar_candidates', { p_limit: 1, p_recheck_days: 90 });
    step = enrichStep({ listingsRunAt: cur.state.lastRunAt ?? null, edgarPending: (pending.data as unknown[] | null)?.length ?? 0 });
    out.step = step;
  }

  const t1 = Date.now();
  if (step === 'listings') {
    const only = (o.sources ?? '').split(',').map(x => x.trim().toUpperCase()).filter((x): x is ListingSourceKey => x in LISTING_SOURCES);
    const r = await runListings(supabase, { dryRun: o.dryRun, only });
    if (!o.dryRun && !only.length && Object.values(r.sources).some(x => x.entries > 0)) {
      await writeSyncCursor(supabase, LISTINGS_CURSOR, null, { lastRunAt: new Date().toISOString(), companies: r.companies, matches: r.matches });
    }
    await logRadarRun(supabase, {
      source: 'company_signals', startedAt: t1, runType,
      status: deriveRunStatus({ errors: r.errors.length, processed: r.subjects, produced: o.dryRun ? r.matches : r.written }),
      fetched: Object.values(r.sources).reduce((n, x) => n + x.entries, 0), processed: r.subjects, inserted: r.written, failed: r.deleted, errors: r.errors,
      parameters: { stage: 'company_signals:listings', dry_run: o.dryRun, sources: r.sources, by_method: r.byMethod, companies: r.companies, ambiguous_issuers: r.ambiguousIssuers, deleted: r.deleted },
    });
    out.listings = { ...r, errors: r.errors.slice(0, 10) };
  } else if (step === 'edgar_index') {
    const r = await runEdgarFilers(supabase, { dryRun: o.dryRun, limit: o.limit, timeBudgetMs: TIME_BUDGET_MS - (Date.now() - o.startedAt) - 10_000 });
    await logRadarRun(supabase, {
      source: 'company_signals', startedAt: t1, runType,
      status: deriveRunStatus({ errors: r.errors.length, timedOut: r.timedOut, processed: r.processed, produced: r.processed }),
      fetched: r.candidates, processed: r.processed, inserted: r.events, updated: r.matched, errors: r.errors,
      parameters: { stage: 'company_signals:edgar_index', dry_run: o.dryRun, with_ciks: r.withCiks, matched: r.matched, active_filers: r.activeFilers, ciks_set: r.ciksSet, inactive_filers: r.inactiveFilers, form_d_companies: r.formDCompanies, rejected: r.rejected, timed_out: r.timedOut, sec_user_agent_set: Boolean(process.env.SEC_USER_AGENT) },
    });
    out.edgar_index = { ...r, errors: r.errors.slice(0, 10) };
  } else {
    const r = await runNihGrants(supabase, { dryRun: o.dryRun, timeBudgetMs: TIME_BUDGET_MS - (Date.now() - o.startedAt) - 20_000 });
    await logRadarRun(supabase, {
      source: 'company_signals', startedAt: t1, runType,
      status: deriveRunStatus({ errors: r.errors.length, timedOut: r.timedOut, processed: r.projects, produced: o.dryRun ? r.rows : r.written }),
      fetched: r.projects, processed: r.projects, inserted: r.written, errors: r.errors,
      parameters: { stage: 'company_signals:nih_grants', dry_run: o.dryRun, years: r.years, companies: r.companies, org_keys: r.orgKeys, skipped_multi_state: r.skippedMultiState, timed_out: r.timedOut },
    });
    out.nih_grants = { ...r, errors: r.errors.slice(0, 10) };
  }
  return NextResponse.json(out);
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
  requested: Exclude<CompanySignalsMode, 'financials' | V2Mode>,
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

  let mode: Exclude<CompanySignalsMode, 'financials' | 'hkex' | V2Mode> = requested === 'hkex'
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
