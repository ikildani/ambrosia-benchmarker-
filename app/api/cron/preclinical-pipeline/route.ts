/**
 * Cron: Preclinical pipeline (Search & Evaluation)
 *
 * Three disclosure sources share this route (vercel.json is at the cron cap):
 *
 *   filings  the pipeline section of the latest 10-K / 20-F / 40-F (or S-1 / F-1) of
 *            industry companies with a CIK (lib/ingestion/preclinical-pipeline.ts). Each
 *            run reads up to `limit` filings it has not read yet; filers already read cost
 *            one SEC submissions fetch and do not use up the run.
 *   pages    company pipeline pages fetched server-side, robots.txt honored, extracted
 *            through the Message Batches API and drained by the next run
 *            (lib/ingestion/pipeline-pages-http.ts).
 *   hkex     annual reports of HKEX-listed companies with companies.hkex_stock_id
 *            (lib/ingestion/hkex-pipeline.ts).
 *
 * Every source: claude-sonnet-5 with a structured-output schema, a verbatim excerpt
 * and source URL for every program, matching by name / drug / identifier, a cross-
 * company code guard, and preclinical assets created only when unmatched.
 *
 * Schedule: every 2 hours at :25. Without query params the UTC hour picks the mode
 * (scheduledPreclinicalMode): filings at 00/06/12/18, HKEX at 10, pages at the other hours once
 * the owner has approved a pages allowance (AI_BACKLOG_PRECLINICAL_PAGES_USD).
 *
 * Manual only: ?mode=replay&limit=500[&clinical=1][&dry_run=1] re-decides asset_disclosures rows
 * recorded as unmatched_clinical with today's matching (no model calls), cursor 'preclinical_replay'.
 *
 * Query params (optional): ?mode=filings|pages|hkex ?limit=12 ?cost_cap=5
 *   ?company=<uuid>(,<uuid>) ?force=1 ?sync=1 (pages: live extraction, no batch)
 *   ?clinical=1 (create Phase 1-3 programs whose code no registry knows)
 * Env: ANTHROPIC_API_KEY, SEC_USER_AGENT, PRECLINICAL_COST_CAP_USD,
 *   AI_BACKLOG_PRECLINICAL_PAGES_USD, PRECLINICAL_CREATE_UNKNOWN_CLINICAL=1.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import { isLean } from '@/lib/ai/budget';
import { aiBudgetAvailable, backlogActive, withSpendGuard } from '@/lib/ai/spend-guard';
import { timingSafeEqual } from 'crypto';
import { replayUnmatchedDisclosures, runPreclinicalPipeline, scheduledPreclinicalMode, type PreclinicalMode } from '@/lib/ingestion/preclinical-pipeline';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
import { runPipelinePagesHttp, type PagesClient } from '@/lib/ingestion/pipeline-pages-http';
import { runHkexPipeline, type HkexIssuer } from '@/lib/ingestion/hkex-pipeline';
import type { IntentClient } from '@/lib/ingestion/management-intent';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const STAGE = 'preclinical_pipeline';
type Mode = PreclinicalMode;

function parsePositiveNumber(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
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
  const companyLimit = parsePositiveNumber(params.get('limit'));
  const costCapUsd = parsePositiveNumber(params.get('cost_cap'));
  const companyIds = (params.get('company') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const force = params.get('force') === '1';
  const createUnknownClinical = params.get('clinical') === '1' || process.env.PRECLINICAL_CREATE_UNKNOWN_CLINICAL === '1';
  const startedAt = Date.now();

  // Lean mode (Oct 28 2026): filings every 6 h, never past the daily bulk AI budget.
  // Backlog allowance (Oct 29 2026): filings every run and $3 a run until the unread filers are read.
  const filingsBacklog = await backlogActive('preclinical-pipeline');
  const requested = params.get('mode');
  let mode: Mode | null;
  if (requested === 'replay') return await runReplayMode(request, { companyLimit, createUnknownClinical, startedAt });
  if (requested === 'filings' || requested === 'pages' || requested === 'hkex') mode = requested;
  else if (params.size > 0) mode = 'filings';
  else {
    mode = scheduledPreclinicalMode(new Date().getUTCHours(), {
      pagesApproved: await backlogActive('preclinical-pages'),
      filingsBacklog,
      lean: isLean(),
    });
  }
  if (!mode) return NextResponse.json({ success: true, skipped: 'lean_mode_slot' });

  const source = mode === 'pages' ? 'preclinical-pages' : mode === 'hkex' ? 'hkex-pipeline' : 'preclinical-pipeline';
  const budget = await aiBudgetAvailable(source);
  if (!budget.ok) return NextResponse.json({ success: true, mode, skipped: 'ai_budget', reason: budget.reason });

  try {
    if (mode === 'pages') return await runPagesMode(request, { companyLimit, costCapUsd, companyIds, createUnknownClinical, startedAt });
    if (mode === 'hkex') return await runHkexMode({ companyLimit, costCapUsd, startedAt });

    const result = await runPreclinicalPipeline(supabase, {
      companyLimit: companyLimit ? Math.floor(companyLimit) : undefined,
      costCapUsd: costCapUsd ?? (filingsBacklog ? 3 : undefined),
      companyIds: companyIds.length ? companyIds : undefined,
      force,
      createUnknownClinical,
      timeBudgetMs: 240_000,
    });

    const status = result.skipped
      ? 'partial'
      : deriveRunStatus({
          errors: result.errors.length,
          timedOut: result.timedOut,
          processed: result.filingsRead,
          produced: result.assetsCreated + result.assetsMatched,
        });

    const logged = await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt,
      status,
      runType: companyIds.length ? 'manual' : 'scheduled',
      fetched: result.filingsRead,
      processed: result.companiesProcessed,
      inserted: result.assetsCreated,
      updated: result.assetsMatched,
      skipped: result.filingsSkippedSeen,
      failed: result.errors.length,
      errors: result.skipped ? [result.skipped, ...result.errors] : result.errors,
      parameters: {
        stage: STAGE,
        mode,
        companies_processed: result.companiesProcessed,
        filings_read: result.filingsRead,
        filings_skipped_seen: result.filingsSkippedSeen,
        programs_extracted: result.programsExtracted,
        assets_created: result.assetsCreated,
        assets_matched: result.assetsMatched,
        unmatched_clinical: result.unmatchedClinical,
        foreign_skipped: result.foreignSkipped,
        disclosures_written: result.disclosuresWritten,
        quotes_dropped: result.quotesDropped,
        schema_invalid: result.schemaInvalid,
        tokens: result.usage,
        cost_usd: result.costUsd,
        cost_cap_usd: result.costCapUsd,
        cost_cap_hit: result.costCapHit,
        timed_out: result.timedOut,
        sample: result.sample,
      },
      notes: result.skipped
        ?? `${result.assetsCreated} preclinical assets created, ${result.assetsMatched} disclosures matched over ${result.filingsRead} filings (${result.filingsSkippedSeen} filers already read), $${result.costUsd.toFixed(3)}`,
    });

    return NextResponse.json({
      success: true,
      stage: STAGE,
      mode,
      skipped: result.skipped,
      companies_processed: result.companiesProcessed,
      filings_read: result.filingsRead,
      filings_skipped_seen: result.filingsSkippedSeen,
      programs_extracted: result.programsExtracted,
      assets_created: result.assetsCreated,
      assets_matched: result.assetsMatched,
      unmatched_clinical: result.unmatchedClinical,
      foreign_skipped: result.foreignSkipped,
      disclosures_written: result.disclosuresWritten,
      quotes_dropped: result.quotesDropped,
      schema_invalid: result.schemaInvalid,
      tokens: result.usage,
      cost_usd: result.costUsd,
      cost_cap_usd: result.costCapUsd,
      cost_cap_hit: result.costCapHit,
      sample: result.sample,
      errors: result.errors.slice(0, 10),
      error_count: result.errors.length,
      timed_out: result.timedOut,
      duration_ms: result.durationMs,
      logged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[preclinical-pipeline] Fatal error (${mode}): ${message}`);
    await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt,
      status: 'failed',
      errors: [message],
      parameters: { stage: mode === 'pages' ? 'preclinical_pages' : mode === 'hkex' ? 'hkex_pipeline' : STAGE, mode },
    });
    return NextResponse.json({ success: false, mode, error: message }, { status: 500 });
  }
}

function anthropicClient(source: string): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic(withSpendGuard(source, { apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 180_000 }));
}

async function runPagesMode(
  request: NextRequest,
  o: { companyLimit?: number; costCapUsd?: number; companyIds: string[]; createUnknownClinical: boolean; startedAt: number },
): Promise<NextResponse> {
  const supabase = createServiceClient();
  const client = anthropicClient('preclinical-pages');
  if (!client) return NextResponse.json({ success: true, mode: 'pages', skipped: 'ANTHROPIC_API_KEY not set' });
  const sync = request.nextUrl.searchParams.get('sync') === '1';
  const r = await runPipelinePagesHttp(supabase, {
    client: client as unknown as PagesClient,
    limit: o.companyLimit ? Math.floor(o.companyLimit) : 60,
    costCapUsd: o.costCapUsd ?? 3,
    extraction: sync ? 'sync' : 'batch',
    companyIds: o.companyIds.length ? o.companyIds : undefined,
    createUnknownClinical: o.createUnknownClinical,
    timeBudgetMs: 240_000,
  });
  const logged = await logRadarRun(supabase, {
    source: 'asset_universe',
    startedAt: o.startedAt,
    status: deriveRunStatus({ errors: r.errors.length, timedOut: r.timedOut, processed: r.targets, produced: r.assetsCreated + r.assetsMatched + r.batchRequests }),
    runType: o.companyIds.length ? 'manual' : 'scheduled',
    fetched: r.targets,
    processed: r.located,
    inserted: r.assetsCreated,
    updated: r.assetsMatched,
    skipped: r.noPage + r.needsRender + r.robotsBlocked + r.siteMismatch,
    failed: r.errors.length,
    errors: r.errors.slice(0, 20),
    parameters: {
      stage: 'preclinical_pages',
      mode: 'pages',
      extraction: sync ? 'sync' : 'batch',
      targets: r.targets, located: r.located, needs_render: r.needsRender, robots_blocked: r.robotsBlocked,
      site_mismatch: r.siteMismatch, no_page: r.noPage, unreachable: r.unreachable, requests: r.requests,
      batch_submitted: r.batchSubmitted, batch_requests: r.batchRequests, batches_drained: r.batchesDrained,
      programs: r.programsExtracted, clinical_created: r.clinicalCreated, foreign_skipped: r.foreignSkipped,
      unmatched_clinical: r.unmatchedClinical, quotes_dropped: r.quotesDropped, tokens: r.usage, cost_usd: r.costUsd,
      sample: r.companies.filter(c => c.created?.length).slice(0, 10).map(c => ({ company: c.company, url: c.url, created: c.created?.slice(0, 6), matched: c.matched })),
    },
    notes: `pipeline pages (server): ${r.located}/${r.targets} pages, batch ${r.batchRequests} submitted, ${r.batchesDrained} drained, ${r.assetsCreated} created, ${r.assetsMatched} matched, $${r.costUsd.toFixed(3)}`,
  });
  const { companies, ...rest } = r;
  return NextResponse.json({ success: true, stage: 'preclinical_pages', mode: 'pages', ...rest, errors: r.errors.slice(0, 10), companies: companies.slice(0, 40), logged });
}

async function runHkexMode(o: { companyLimit?: number; costCapUsd?: number; startedAt: number }): Promise<NextResponse> {
  const supabase = createServiceClient();
  const client = anthropicClient('hkex-pipeline');
  if (!client) return NextResponse.json({ success: true, mode: 'hkex', skipped: 'ANTHROPIC_API_KEY not set' });
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, hkex_stock_code, hkex_stock_id')
    .not('hkex_stock_id', 'is', null)
    .is('merged_into', null)
    .order('id');
  if (error) throw new Error(`companies read: ${error.message}`);
  const issuers: HkexIssuer[] = ((data ?? []) as Array<{ id: string; name: string; hkex_stock_code: string | null; hkex_stock_id: number }>)
    .map(c => ({ stockId: c.hkex_stock_id, code: c.hkex_stock_code ?? String(c.hkex_stock_id), shortName: c.name, companyId: c.id, companyName: c.name }));
  if (issuers.length === 0) return NextResponse.json({ success: true, mode: 'hkex', skipped: 'no companies with hkex_stock_id (migration 189 backfill pending)' });
  // Issuers with no annual report read yet first: each HKEX search is throttled to one per 3 s.
  const { data: read } = await supabase.from('asset_disclosures').select('company_id').eq('source_type', 'hkex_annual_report').in('company_id', issuers.map(i => i.companyId));
  const readIds = new Set(((read ?? []) as Array<{ company_id: string }>).map(x => x.company_id));
  issuers.sort((a, b) => Number(readIds.has(a.companyId)) - Number(readIds.has(b.companyId)));
  // Already-read reports are skipped cheaply inside runHkexPipeline (asset_disclosures by NEWS_ID).
  const r = await runHkexPipeline(supabase, issuers, {
    client: client as unknown as IntentClient,
    costCapUsd: o.costCapUsd ?? 2,
    timeBudgetMs: 230_000,
    limit: o.companyLimit ? Math.floor(o.companyLimit) : issuers.length,
  });
  const logged = await logRadarRun(supabase, {
    source: 'asset_universe',
    startedAt: o.startedAt,
    status: deriveRunStatus({ errors: r.errors.length, timedOut: r.timedOut, processed: r.reportsRead, produced: r.assetsCreated + r.assetsMatched }),
    runType: 'scheduled',
    fetched: r.issuers,
    processed: r.reportsRead,
    inserted: r.assetsCreated,
    updated: r.assetsMatched,
    skipped: r.skippedSeen + r.noReport,
    failed: r.errors.length,
    errors: r.errors.slice(0, 20),
    parameters: { stage: 'hkex_pipeline', mode: 'hkex', reports_read: r.reportsRead, skipped_seen: r.skippedSeen, no_report: r.noReport, programs: r.programsExtracted, unmatched_clinical: r.unmatchedClinical, cost_usd: r.costUsd, sample: r.sample.slice(0, 10) },
    notes: `HKEX annual reports: ${r.reportsRead} read (${r.skippedSeen} already read), ${r.assetsCreated} created, ${r.assetsMatched} matched, $${r.costUsd.toFixed(3)}`,
  });
  return NextResponse.json({ success: true, mode: 'hkex', ...r, errors: r.errors.slice(0, 10), logged });
}

async function runReplayMode(request: NextRequest, o: { companyLimit?: number; createUnknownClinical: boolean; startedAt: number }): Promise<NextResponse> {
  const supabase = createServiceClient();
  const dryRun = request.nextUrl.searchParams.get('dry_run') === '1';
  const cursor = await readSyncCursor<{ afterId?: string | null }>(supabase, 'preclinical_replay');
  const r = await replayUnmatchedDisclosures(supabase, {
    limit: o.companyLimit ? Math.min(1000, Math.floor(o.companyLimit)) : 300,
    afterId: (cursor.state.afterId as string | null | undefined) ?? null,
    dryRun,
    createUnknownClinical: o.createUnknownClinical,
  });
  if (!dryRun) {
    await writeSyncCursor(supabase, 'preclinical_replay', new Date().toISOString(), { afterId: r.lastId });
    await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt: o.startedAt,
      status: deriveRunStatus({ errors: r.errors.length, processed: r.disclosures, produced: r.matched + r.created }),
      runType: 'manual',
      fetched: r.disclosures,
      processed: r.sources,
      inserted: r.created,
      updated: r.matched,
      skipped: r.foreignSkipped + r.stillUnmatched,
      failed: r.errors.length,
      errors: r.errors.slice(0, 20),
      parameters: { stage: 'preclinical_replay', mode: 'replay', clinical_created: r.clinicalCreated, foreign_skipped: r.foreignSkipped, still_unmatched: r.stillUnmatched, last_id: r.lastId },
      notes: `replayed ${r.disclosures} unmatched disclosures: ${r.matched} matched, ${r.created} created (${r.clinicalCreated} clinical), ${r.foreignSkipped} owned by another company`,
    });
  }
  const { sample, ...totals } = r;
  return NextResponse.json({ success: true, mode: 'replay', dry_run: dryRun, ...totals, errors: r.errors.slice(0, 10), sample: sample.slice(0, 20) });
}
