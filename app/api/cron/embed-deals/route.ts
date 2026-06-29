/**
 * Cron: Embed Deals with Perplexity Vectors
 *
 * Generates 3,416-dim embeddings for deals that don't have them yet.
 * Processes ~200 deals per run. With ~2,700 deals, full backfill
 * takes ~14 runs (2 days at every 4 hours).
 *
 * After initial backfill, this runs to embed newly ingested deals.
 * Cost: ~$0.0002 per run (essentially free).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { embedUnprocessedDeals } from '@/lib/embeddings';
import { logCronRun } from '@/lib/cron-utils';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityApiKey) {
    return NextResponse.json({ error: 'PERPLEXITY_API_KEY not configured' }, { status: 500 });
  }

  const supabase = createServiceClient();

  // Count how many deals need embedding
  const { count: unembedded } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .is('embedding', null)
    .neq('therapeutic_area', 'other');

  const result = await embedUnprocessedDeals(supabase, perplexityApiKey, {
    limit: 200,
    timeBudgetMs: 250_000,
  });

  await logCronRun(supabase, 'embed_deals', {
    fetched: unembedded || 0,
    processed: result.processed,
    inserted: result.processed,
    errors: result.errors > 0 ? [`${result.errors} embedding failures`] : [],
  });

  // Intelligence tracking
  try {
    await runCronIntelligence(supabase, 'embed-deals', {
      processed: result.processed,
      inserted: result.processed,
    });
  } catch {}

  return NextResponse.json({
    success: true,
    processed: result.processed,
    errors: result.errors,
    remaining: (unembedded || 0) - result.processed,
  });
}
