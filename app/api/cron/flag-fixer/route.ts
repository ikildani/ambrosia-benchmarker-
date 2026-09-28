/**
 * Cron: Flag-and-fix
 *
 * Repairs flagged deals from their primary sources (lib/ingestion/flag-fixer.ts):
 * corrects and cites the row, or rejects it as a duplicate of a verified row,
 * or leaves it flagged as unresolved. Every outcome lands in remediation_log and
 * the daily deal-fix report emails it to the owner.
 *
 * Not in vercel.json (100-cron cap): the scheduled pass runs inside
 * /api/cron/deal-verification on its :40 run. This route is for on-demand
 * batches: ?max=N (<= 20) and ?ids=a,b.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { fixFlaggedDeals } from '@/lib/ingestion/flag-fixer';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  const expected = `Bearer ${cronSecret}`;
  const provided = request.headers.get('authorization') || '';
  const ok = provided.length === expected.length && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!perplexityApiKey || !anthropicApiKey) return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });

  const params = request.nextUrl.searchParams;
  const maxParam = Number(params.get('max'));
  const maxDeals = Number.isFinite(maxParam) && maxParam > 0 ? Math.min(20, maxParam) : 8;
  const ids = (params.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);

  const supabase = createServiceClient();
  const result = await fixFlaggedDeals(supabase, perplexityApiKey, anthropicApiKey, {
    maxDeals,
    timeBudgetMs: 240_000,
    ids: ids.length ? ids : undefined,
  });

  // Corrected money and dates move rows between dedupe groups; re-rank them.
  if (result.fixed + result.duplicates > 0) {
    const { error } = await supabase.rpc('recompute_deal_dedupe');
    if (error) result.errors.push(`recompute_deal_dedupe: ${error.message}`);
  }

  await logCronRun(supabase, 'flag-fixer', {
    processed: result.attempted,
    inserted: result.fixed,
    skipped: result.unresolved,
    errors: result.errors,
    parameters: { maxDeals, duplicates: result.duplicates },
  });

  return NextResponse.json({
    attempted: result.attempted,
    fixed: result.fixed,
    duplicates: result.duplicates,
    unresolved: result.unresolved,
    errors: result.errors,
  });
}
