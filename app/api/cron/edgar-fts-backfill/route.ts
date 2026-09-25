/**
 * Cron: SEC full-text-search historical backfill, 2017 → present.
 * Every 15 minutes, up to 80 extractions per run (4 in parallel), cursor in
 * sync_cursors. Sep 25 2026: filings pass a cheap gate (EXTRACTION_GATE) before
 * the extractor and are extracted through Message Batches at 50% price
 * (BACKFILL_EXTRACTION_MODE=batch); a run drains the previous batch first.
 * radar_sync_cursors, processed-accession ledger in edgar_fts_processed.
 * Manual overrides: ?max=N&concurrency=N&dryRun=true.
 * See lib/ingestion/edgar-fts-backfill.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { runEdgarFtsBackfill } from '@/lib/ingestion/edgar-fts-backfill';
import { logCronRun } from '@/lib/cron-utils';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  const expected = `Bearer ${cronSecret}`;
  const provided = authHeader || '';
  const ok = provided.length === expected.length && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  const supabase = createServiceClient();
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const maxExtractions = Math.min(200, Number(request.nextUrl.searchParams.get('max')) || 80);
  const concurrency = Math.min(8, Number(request.nextUrl.searchParams.get('concurrency')) || 4);
  try {
    const result = await runEdgarFtsBackfill(supabase, { anthropicApiKey, dryRun, timeBudgetMs: 250_000, maxExtractions, concurrency });
    if (!dryRun) {
      await logCronRun(supabase, 'edgar_fts_backfill', {
        fetched: result.candidates,
        processed: result.extracted,
        inserted: result.inserted + (result.drained?.inserted ?? 0),
        errors: result.errors,
        funnel: result.funnel,
        parameters: { quarter: result.quarterKey, query: result.query, pages: result.pages, next: result.next, finished: result.finished, prefiltered: result.prefiltered, alreadyProcessed: result.alreadyProcessed, maxExtractions, concurrency, extractionMode: process.env.BACKFILL_EXTRACTION_MODE || 'batch', gate: process.env.EXTRACTION_GATE || 'haiku', batchId: result.batchId ?? null, drained: result.drained ?? null },
        // A quarter/query with no hits is a legitimate empty page once the walk is finished.
        expectRecords: !result.finished,
        notes: result.finished ? 'backfill walk complete; cursor at the current quarter' : undefined,
      });
    }
    return NextResponse.json({ success: true, dryRun, ...result });
  } catch (error) {
    console.error('[edgar-fts-backfill] failed:', error);
    try { await logCronRun(supabase, 'edgar_fts_backfill', { fetched: 0, processed: 0, inserted: 0, errors: [String(error)], status: 'failed' }); } catch {}
    return NextResponse.json({ error: 'edgar fts backfill failed' }, { status: 500 });
  }
}
