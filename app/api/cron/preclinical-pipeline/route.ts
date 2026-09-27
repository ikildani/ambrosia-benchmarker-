/**
 * Cron: Preclinical pipeline from SEC filings (Search & Evaluation)
 *
 * Reads the pipeline section of the latest 10-K / 20-F (or S-1 / F-1) for
 * industry companies with a CIK, extracts the company's own programs with
 * claude-sonnet-5 (structured output, verbatim excerpt required), attaches
 * disclosures to existing assets and creates preclinical assets that no
 * registry can know about (lib/ingestion/preclinical-pipeline.ts).
 *
 * Schedule: every 2 hours at :25. 12 companies per run walks the ~700 SEC
 * filers in about five days; re-visits only re-read a company when it has a
 * newer annual report. Spend per run is capped (PRECLINICAL_COST_CAP_USD,
 * default 5).
 *
 * Query params (optional): ?limit=12 ?cost_cap=5 ?company=<uuid>(,<uuid>) ?force=1
 * Env: ANTHROPIC_API_KEY, SEC_USER_AGENT, PRECLINICAL_COST_CAP_USD.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runPreclinicalPipeline } from '@/lib/ingestion/preclinical-pipeline';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const STAGE = 'preclinical_pipeline';

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
  const startedAt = Date.now();

  try {
    const result = await runPreclinicalPipeline(supabase, {
      companyLimit: companyLimit ? Math.floor(companyLimit) : undefined,
      costCapUsd,
      companyIds: companyIds.length ? companyIds : undefined,
      force,
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
        companies_processed: result.companiesProcessed,
        filings_read: result.filingsRead,
        filings_skipped_seen: result.filingsSkippedSeen,
        programs_extracted: result.programsExtracted,
        assets_created: result.assetsCreated,
        assets_matched: result.assetsMatched,
        unmatched_clinical: result.unmatchedClinical,
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
        ?? `${result.assetsCreated} preclinical assets created, ${result.assetsMatched} disclosures matched over ${result.filingsRead} filings, $${result.costUsd.toFixed(3)}`,
    });

    return NextResponse.json({
      success: true,
      stage: STAGE,
      skipped: result.skipped,
      companies_processed: result.companiesProcessed,
      filings_read: result.filingsRead,
      filings_skipped_seen: result.filingsSkippedSeen,
      programs_extracted: result.programsExtracted,
      assets_created: result.assetsCreated,
      assets_matched: result.assetsMatched,
      unmatched_clinical: result.unmatchedClinical,
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
    console.error(`[preclinical-pipeline] Fatal error: ${message}`);
    await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt,
      status: 'failed',
      errors: [message],
      parameters: { stage: STAGE },
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
