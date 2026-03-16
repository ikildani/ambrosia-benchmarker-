/**
 * API Route: Press Release Deal Backfill
 * Runs the existing press release ingestion with higher article limits
 * and multiple passes to capture more deals from RSS feeds.
 *
 * POST /api/deals/backfill-press?maxPerSource=50
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { runPressReleaseIngestion } from '@/lib/ingestion/press-releases';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const supabase = createServiceClient();
  const url = new URL(request.url);
  const maxPerSource = parseInt(url.searchParams.get('maxPerSource') || '30', 10);

  console.log(`[backfill-press] Running press release ingestion with ${maxPerSource} articles per source...`);

  const result = await runPressReleaseIngestion(supabase, anthropicApiKey, {
    maxArticlesPerSource: maxPerSource,
  });

  // Log
  await supabase.from('data_ingestion_log').insert({
    source: 'press_release_backfill',
    run_type: 'manual',
    parameters: { maxPerSource },
    records_fetched: result.articles_found,
    records_processed: result.potential_deals,
    records_inserted: result.deals_inserted,
    records_failed: result.errors.length,
    errors: result.errors.slice(0, 50),
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, ...result });
}
