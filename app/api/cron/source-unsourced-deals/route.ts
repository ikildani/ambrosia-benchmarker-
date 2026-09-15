import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sourceUnsourcedDeals } from '@/lib/ingestion/deal-sourcer';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Deal sourcer cron — daily 08:30 UTC
//
// Audit 2026-09-14: 779 real-looking rows had no citation and therefore could
// never be verified (Aug 2026 trigger) or reach the comparable pool. This
// cron attaches a primary-source URL to 25 of them per day and returns each
// to `pending`, where the existing deal-verification cron (every 2h) makes the
// verified / flagged call with the citation in hand. Backlog drains in ~5
// weeks with no one remembering to run a script.
//
// Cost ≈ $0.02 per row. Auth: Bearer $CRON_SECRET (same pattern as siblings).
// ---------------------------------------------------------------------------

const ROWS_PER_RUN = 25;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const isValid = token.length === cronSecret.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!perplexityApiKey || !anthropicApiKey) {
    return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });
  }

  try {
    const supabase = createServiceClient();
    const result = await sourceUnsourcedDeals(supabase, {
      perplexityApiKey,
      anthropicApiKey,
      limit: ROWS_PER_RUN,
      timeBudgetMs: 250_000,
      dryRun: false,
    });

    try {
      await runCronIntelligence(supabase, 'source-unsourced-deals', {
        processed: result.attempted,
        inserted: result.sourced,
        skipped: result.skipped,
        errors: result.errors,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      attempted: result.attempted,
      sourced: result.sourced,
      skipped: result.skipped,
      errors: result.errors,
      decisions: result.records.map(r => ({
        dealId: r.dealId,
        licensor: r.licensor,
        licensee: r.licensee,
        action: r.decision.action,
        detail: r.decision.action === 'source' ? r.decision.url : r.decision.why,
      })),
    });
  } catch (error) {
    captureApiError(error, 'cron-source-unsourced-deals');
    return NextResponse.json({ error: 'Sourcing run failed' }, { status: 500 });
  }
}
