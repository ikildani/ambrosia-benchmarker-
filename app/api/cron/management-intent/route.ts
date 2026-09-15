/**
 * Cron: Management Intent (Asset Radar, Phase 3 Workstream C)
 *
 * Classifies press releases (licensing / strategic_review / executive_hire /
 * layoffs / financing) and the MD&A / liquidity paragraphs of the latest
 * 10-K / 10-Q for SEC filers with claude-sonnet-5, writing
 * company_intent_signals with the verbatim quote and URL
 * (lib/ingestion/management-intent.ts). Spend is capped per run.
 *
 * Suggested schedule: every 4 hours at :50 (`50 star-slash-4 * * *`), after
 * press-releases (:05 every 2h). 60 press releases + 8 filings per run.
 *
 * Query params (optional): ?press_limit=60 ?filing_limit=8 ?cost_cap=3
 * Env: ANTHROPIC_API_KEY, SEC_USER_AGENT, INTENT_COST_CAP_USD (default 3).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runManagementIntent } from '@/lib/ingestion/management-intent';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const STAGE = 'management_intent';

function parsePositiveNumber(raw: string | null, fallback: number | undefined): number | undefined {
  if (!raw) return fallback;
  const n = Number(raw);
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
  const params = request.nextUrl.searchParams;
  const pressLimit = parsePositiveNumber(params.get('press_limit'), undefined);
  const filingLimit = parsePositiveNumber(params.get('filing_limit'), undefined);
  const costCapUsd = parsePositiveNumber(params.get('cost_cap'), undefined);
  const startedAt = Date.now();

  try {
    const result = await runManagementIntent(supabase, {
      pressLimit: pressLimit ? Math.floor(pressLimit) : undefined,
      filingLimit: filingLimit ? Math.floor(filingLimit) : undefined,
      costCapUsd,
      timeBudgetMs: 240_000,
    });

    const processed = result.pressProcessed + result.filingsProcessed;
    const status = result.skipped
      ? 'partial'
      : deriveRunStatus({
          errors: result.errors.length,
          timedOut: result.timedOut,
          processed: result.paragraphsClassified,
          produced: result.signalsWritten,
        });

    const logged = await logRadarRun(supabase, {
      source: 'licensing_signals',
      startedAt,
      status,
      runType: 'scheduled',
      fetched: result.paragraphsClassified,
      processed,
      inserted: result.signalsWritten,
      skipped: result.dropped + result.invalid,
      failed: result.errors.length,
      errors: result.skipped ? [result.skipped, ...result.errors] : result.errors,
      parameters: {
        stage: STAGE,
        press_processed: result.pressProcessed,
        filings_processed: result.filingsProcessed,
        paragraphs_classified: result.paragraphsClassified,
        signals_written: result.signalsWritten,
        quotes_dropped: result.dropped,
        schema_invalid: result.invalid,
        tokens: result.usage,
        cost_usd: result.costUsd,
        cost_cap_usd: result.costCapUsd,
        cost_cap_hit: result.costCapHit,
        timed_out: result.timedOut,
      },
      notes: result.skipped ?? `${result.signalsWritten} signals, $${result.costUsd.toFixed(3)} over ${result.usage.calls} calls`,
    });

    return NextResponse.json({
      success: true,
      stage: STAGE,
      skipped: result.skipped,
      press_processed: result.pressProcessed,
      filings_processed: result.filingsProcessed,
      paragraphs_classified: result.paragraphsClassified,
      signals_written: result.signalsWritten,
      quotes_dropped: result.dropped,
      schema_invalid: result.invalid,
      tokens: result.usage,
      cost_usd: result.costUsd,
      cost_cap_usd: result.costCapUsd,
      cost_cap_hit: result.costCapHit,
      errors: result.errors.slice(0, 10),
      error_count: result.errors.length,
      timed_out: result.timedOut,
      duration_ms: result.durationMs,
      logged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[management-intent] Fatal error: ${message}`);
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
