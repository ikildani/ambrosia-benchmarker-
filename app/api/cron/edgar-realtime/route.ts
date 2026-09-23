// SEC EDGAR Real-Time Monitor — runs every 2 hours
// Thin wrapper: the pipeline lives in lib/ingestion/edgar-realtime.ts so it
// can run in dry-run mode locally and count every stage of its funnel.
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { runEdgarRealtime } from '@/lib/ingestion/edgar-realtime';
import { notifyHighValueDeal } from '@/lib/slack/notify';
import { logCronRun } from '@/lib/cron-utils';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/** SEC accepts filings 06:00–22:00 ET on business days; before that a zero-fetch is normal. */
function filingsExpectedNow(now: Date): boolean {
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  return day >= 1 && day <= 5 && hour >= 13; // 09:00 ET onward
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }
  const supabase = createServiceClient();
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const date = request.nextUrl.searchParams.get('date') ?? undefined;

  try {
    const result = await runEdgarRealtime(supabase, {
      date,
      dryRun,
      anthropicApiKey,
      timeBudgetMs: 100_000,
      onHighValue: notifyHighValueDeal,
    });

    if (!dryRun) {
      await logCronRun(supabase, 'edgar_realtime', {
        fetched: result.fetched,
        processed: result.processed,
        inserted: result.inserted,
        errors: result.errors,
        funnel: result.funnel,
        parameters: { date: result.date, summary: result.summary },
        // Before ~09:00 ET on a business day, or on a weekend, no filings is normal.
        expectRecords: filingsExpectedNow(new Date()),
        notes: result.noFilings ? 'SEC returned no 8-K filings for the date' : undefined,
      });
      try {
        await runCronIntelligence(supabase, 'edgar-realtime', { processed: result.processed, inserted: result.inserted });
      } catch {}
    }

    return NextResponse.json({ success: true, dryRun, ...result });
  } catch (error) {
    console.error('[edgar-realtime] Fatal error:', error);
    try {
      await logCronRun(supabase, 'edgar_realtime', { fetched: 0, processed: 0, inserted: 0, errors: [String(error)], status: 'failed' });
    } catch {}
    return NextResponse.json({ error: 'Edgar realtime monitor failed' }, { status: 500 });
  }
}
