/**
 * Cron: HKEX announcements. `?mode=daily` (default) scans the last 14 days;
 * `?mode=backfill` advances the 2017→present cursor one 14-day window per run.
 * See lib/ingestion/exchanges/hkex.ts.
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
  const mode = request.nextUrl.searchParams.get('mode') === 'backfill' ? 'backfill' : 'daily';
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const source = mode === 'backfill' ? 'hkex_backfill' : 'hkex_announcements';
  try {
    const result = await runHkexIngestion(supabase, { anthropicApiKey, dryRun, mode, timeBudgetMs: 250_000 });
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
    return NextResponse.json({ success: true, dryRun, ...result });
  } catch (error) {
    console.error('[hkex] failed:', error);
    try { await logCronRun(supabase, source, { fetched: 0, processed: 0, inserted: 0, errors: [String(error)], status: 'failed' }); } catch {}
    return NextResponse.json({ error: 'hkex ingestion failed' }, { status: 500 });
  }
}
