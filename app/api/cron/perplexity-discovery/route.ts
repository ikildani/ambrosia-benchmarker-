/**
 * Cron: Perplexity AI Deal Discovery
 *
 * Uses Perplexity's web search to discover biopharma deals from across
 * the entire internet, then Claude extracts structured deal terms.
 *
 * Cycles through 2-3 TAs per run (time-budgeted). Covers all 11 non-oncology
 * TAs over ~4 days. Each query discovers 5-15 deals.
 *
 * Schedule: Every 8 hours (3x/day) — staggers with deal-backfill (4x/day)
 * Cost: ~$0.03-0.05 per run (~$3/month)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runPerplexityDealDiscovery } from '@/lib/ingestion/perplexity-deals';
import { logCronRun, reclassifyOtherDeals, updateCompanyStats } from '@/lib/cron-utils';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Cycle through TAs — 2-3 per run, covering all over ~5 days
// Includes cross-TA queries for underrepresented deal types
const TA_ROTATION = [
  ['neurology', 'immunology', 'cardiovascular'],
  ['metabolic', 'infectiousDisease', 'rareDisease'],
  ['hematology', 'ophthalmology', 'dermatology'],
  ['gastroenterology', 'womensHealth'],
  ['_option_deals', '_codev_deals', '_china_deals'],   // Cross-TA deal type focus
  ['neurology', 'metabolic', 'rareDisease'],            // High-priority TAs again
  ['immunology', 'cardiovascular', 'hematology'],
  ['infectiousDisease', 'ophthalmology', 'dermatology'],
  ['gastroenterology', 'womensHealth', 'neurology'],
  ['_option_deals', '_codev_deals'],                     // Deal type focus again
];

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
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!perplexityApiKey) {
    return NextResponse.json({ error: 'PERPLEXITY_API_KEY not configured' }, { status: 500 });
  }
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const supabase = createServiceClient();

  // Determine which TAs to process this run (cycle based on last run's notes field)
  const { data: lastRun } = await supabase
    .from('data_ingestion_log')
    .select('notes')
    .eq('source', 'perplexity_discovery')
    .not('notes', 'is', null)
    .order('id', { ascending: false })
    .limit(1)
    .single();

  const lastIndex = lastRun?.notes ? parseInt(lastRun.notes, 10) : -1;
  const currentIndex = (isNaN(lastIndex) ? 0 : (lastIndex + 1)) % TA_ROTATION.length;
  const currentTAs = TA_ROTATION[currentIndex];

  console.log(`[perplexity] Run ${currentIndex}/${TA_ROTATION.length}: ${currentTAs.join(', ')}`);

  const result = await runPerplexityDealDiscovery(supabase, perplexityApiKey, anthropicApiKey, {
    therapeuticAreas: currentTAs,
    maxQueriesPerTA: 2,
    timeBudgetMs: 240_000,
  });

  // Post-processing
  if (result.deals_inserted > 0) {
    const reclassified = await reclassifyOtherDeals(supabase);
    const statsUpdated = await updateCompanyStats(supabase, result.deals_inserted * 2);
    console.log(`[perplexity] Post-processing: ${reclassified} reclassified, ${statsUpdated} company stats updated`);
  }

  // Log with cursor in notes field for rotation tracking
  await supabase.from('data_ingestion_log').insert({
    source: 'perplexity_discovery',
    run_type: 'cron',
    parameters: { therapeuticAreas: currentTAs, byTA: result.by_ta },
    records_fetched: result.queries_run,
    records_processed: result.deals_discovered,
    records_inserted: result.deals_inserted,
    records_failed: result.errors.length,
    errors: result.errors.slice(0, 50),
    status: 'completed',
    completed_at: new Date().toISOString(),
    notes: String(currentIndex), // Cursor for rotation tracking
  });

  console.log(`[perplexity] Done: ${result.deals_discovered} discovered, ${result.deals_inserted} inserted`);

  return NextResponse.json({
    success: true,
    rotation: `${currentIndex + 1}/${TA_ROTATION.length}`,
    therapeuticAreas: currentTAs,
    ...result,
  });
}
