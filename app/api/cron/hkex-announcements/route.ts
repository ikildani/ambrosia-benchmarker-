/**
 * Cron: HKEX announcements. `?mode=daily` (default) scans the last 14 days;
 * `?mode=backfill` advances the 2017→present cursor one 14-day window per run;
 * `?mode=both` runs the HKEX daily scan, then the TDnet (Japan) and ASX
 * (Australia) daily scans, then HKEX backfill with the remaining budget. The schedule uses `both` twice a day:
 * Vercel caps a project at 100 cron entries, so the exchange adapters share one.
 * See lib/ingestion/exchanges/hkex.ts and tdnet.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { runHkexIngestion } from '@/lib/ingestion/exchanges/hkex';
import { runTdnetIngestion } from '@/lib/ingestion/exchanges/tdnet';
import { runAsxIngestion } from '@/lib/ingestion/exchanges/asx';
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
  const requested = request.nextUrl.searchParams.get('mode');
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const TOTAL_BUDGET_MS = 250_000;
  const DAILY_BUDGET_MS = 60_000;

  // `both`: daily scan (bounded) then backfill with whatever budget is left.
  const modes: Array<'daily' | 'backfill'> = requested === 'both' ? ['daily', 'backfill'] : requested === 'backfill' ? ['backfill'] : (requested === 'tdnet' || requested === 'asx') ? [] : ['daily'];
  const started = Date.now();
  const results: Record<string, unknown> = {};
  const TDNET_BUDGET_MS = 50_000;

  // TDnet (Japan) daily phase, between the HKEX daily scan and the HKEX backfill.
  const runTdnet = async () => {
    try {
      const r = await runTdnetIngestion(supabase, { anthropicApiKey, dryRun, timeBudgetMs: TDNET_BUDGET_MS });
      if (!dryRun) {
        await logCronRun(supabase, 'tdnet_announcements', {
          fetched: r.disclosures, processed: r.extracted, inserted: r.inserted, errors: r.errors, funnel: r.funnel,
          parameters: { dates: r.dates, dealTitles: r.dealTitles },
          // A weekend or holiday list is legitimately empty.
          expectRecords: r.disclosures > 0,
        });
      }
      results.tdnet = r;
    } catch (error) {
      console.error('[tdnet] failed:', error);
      try { await logCronRun(supabase, 'tdnet_announcements', { fetched: 0, processed: 0, inserted: 0, errors: [String(error)], status: 'failed' }); } catch {}
      results.tdnet = { error: String(error).slice(0, 200) };
    }
  };

  const ASX_BUDGET_MS = 60_000;
  const runAsx = async () => {
    try {
      const r = await runAsxIngestion(supabase, { anthropicApiKey, dryRun, timeBudgetMs: ASX_BUDGET_MS });
      if (!dryRun) {
        await logCronRun(supabase, 'asx_announcements', {
          fetched: r.announcements, processed: r.extracted, inserted: r.inserted, errors: r.errors, funnel: r.funnel,
          parameters: { codesScanned: r.codesScanned, deepCode: r.deepCode, dealHeadlines: r.dealHeadlines },
          expectRecords: r.codesScanned > 0,
        });
      }
      results.asx = r;
    } catch (error) {
      console.error('[asx] failed:', error);
      try { await logCronRun(supabase, 'asx_announcements', { fetched: 0, processed: 0, inserted: 0, errors: [String(error)], status: 'failed' }); } catch {}
      results.asx = { error: String(error).slice(0, 200) };
    }
  };

  for (const mode of modes) {
    if (mode === 'backfill' && requested === 'both') { await runTdnet(); await runAsx(); }
    const source = mode === 'backfill' ? 'hkex_backfill' : 'hkex_announcements';
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    const timeBudgetMs = modes.length > 1 && mode === 'daily' ? Math.min(DAILY_BUDGET_MS, remaining) : remaining;
    if (timeBudgetMs < 20_000) { results[mode] = { skipped: 'no budget left' }; continue; }
    try {
      const result = await runHkexIngestion(supabase, { anthropicApiKey, dryRun, mode, timeBudgetMs });
      if (!dryRun) {
        await logCronRun(supabase, source, {
          fetched: result.announcements,
          processed: result.extracted,
          inserted: result.inserted,
          errors: result.errors,
          funnel: result.funnel,
          parameters: { mode, window: result.window, dealTitles: result.dealTitles, next: result.next ?? null, throttled: result.throttled },
          status: result.throttled ? 'partial' : undefined,
          notes: result.throttled ? 'HKEX throttled; cursor held and backoff set' : undefined,
        });
      }
      results[mode] = result;
    } catch (error) {
      console.error(`[hkex] ${mode} failed:`, error);
      try { await logCronRun(supabase, source, { fetched: 0, processed: 0, inserted: 0, errors: [String(error)], status: 'failed' }); } catch {}
      results[mode] = { error: String(error).slice(0, 200) };
    }
  }
  if (requested === 'tdnet') await runTdnet();
  if (requested === 'asx') await runAsx();
  const phases = [...modes, ...(results.tdnet ? ['tdnet'] : []), ...(results.asx ? ['asx'] : [])];
  const failed = phases.length > 0 && phases.every(m => (results[m] as { error?: string })?.error);
  return NextResponse.json({ success: !failed, dryRun, modes: phases, ...results }, { status: failed ? 500 : 200 });
}
