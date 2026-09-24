/**
 * Cron: HKEX announcements. `?mode=daily` (default) scans the last 14 days;
 * `?mode=backfill` advances the 2017→present cursor one 14-day window per run;
 * `?mode=both` runs the daily scan first, then backfill with the remaining
 * budget. The schedule uses `both` twice a day: Vercel caps a project at 100
 * cron entries, so the two modes share one. See lib/ingestion/exchanges/hkex.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { runHkexIngestion } from '@/lib/ingestion/exchanges/hkex';
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
  const DAILY_BUDGET_MS = 90_000;

  // `both`: daily scan (bounded) then backfill with whatever budget is left.
  const modes: Array<'daily' | 'backfill'> = requested === 'both' ? ['daily', 'backfill'] : requested === 'backfill' ? ['backfill'] : ['daily'];
  const started = Date.now();
  const results: Record<string, unknown> = {};
  for (const mode of modes) {
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
  const failed = modes.every(m => (results[m] as { error?: string })?.error);
  return NextResponse.json({ success: !failed, dryRun, modes, ...results }, { status: failed ? 500 : 200 });
}
