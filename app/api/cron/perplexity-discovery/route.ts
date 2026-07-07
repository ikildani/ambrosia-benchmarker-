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
import { notifyHighValueDeal } from '@/lib/slack/notify';
import { runCronIntelligence, collectUserDemandSignals, getCronIntelligenceBus } from '@/lib/cron-intelligence';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Cycle through TAs — 2-3 per run, covering all over ~3 days
// Every run also includes _mega_deals query for large deals across all TAs
// Includes cross-TA queries for underrepresented deal types
const TA_ROTATION = [
  ['oncology', 'neurology', 'immunology'],
  ['metabolic', 'cardiovascular', 'rareDisease'],
  ['hematology', 'ophthalmology', 'infectiousDisease'],
  ['dermatology', 'gastroenterology', 'womensHealth'],
  ['_option_deals', '_codev_deals', '_china_deals'],   // Cross-TA deal type focus
  ['oncology', 'neurology', 'metabolic'],               // High-priority TAs again
  ['immunology', 'cardiovascular', 'hematology'],
  ['rareDisease', 'ophthalmology', 'dermatology'],
  ['infectiousDisease', 'gastroenterology', 'womensHealth'],
  ['_option_deals', '_codev_deals', 'oncology'],        // Deal type focus + oncology
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
  const rotationTAs = TA_ROTATION[currentIndex];
  // Always include mega-deals sweep to catch large deals across all TAs
  let currentTAs = rotationTAs.includes('_mega_deals') ? rotationTAs : [...rotationTAs, '_mega_deals'];

  // Wire demand signals: ensure the most-demanded TA is always included
  let demandDriven = false;
  try {
    const { data: signalsRow } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'user_demand_signals')
      .single();

    const signals = signalsRow?.value as { topTherapeuticAreas?: Array<{ta: string; count: number}> } | null;
    const topDemandTA = signals?.topTherapeuticAreas?.[0]?.ta;

    if (topDemandTA && !currentTAs.includes(topDemandTA) && !topDemandTA.startsWith('_')) {
      currentTAs.unshift(topDemandTA);
      demandDriven = true;
    }
  } catch {
    // Non-fatal: demand signals may not exist yet
  }

  const result = await runPerplexityDealDiscovery(supabase, perplexityApiKey, anthropicApiKey, {
    therapeuticAreas: currentTAs,
    maxQueriesPerTA: 2,
    timeBudgetMs: 240_000,
  });

  // Post-processing
  if (result.deals_inserted > 0) {
    await reclassifyOtherDeals(supabase);
    await updateCompanyStats(supabase, result.deals_inserted * 2);

    // Alert on high-value deals (any source type from this run)
    const { data: newBigDeals } = await supabase
      .from('deals')
      .select('licensee_name, licensor_name, asset_name, total_deal_value_usd, deal_type, therapeutic_area, announced_date')
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .gte('total_deal_value_usd', 500000000)
      .order('total_deal_value_usd', { ascending: false });

    if (newBigDeals) {
      for (const deal of newBigDeals) {
        await notifyHighValueDeal({
          licensee: deal.licensee_name,
          licensor: deal.licensor_name,
          asset: deal.asset_name || 'Undisclosed',
          totalValue: deal.total_deal_value_usd,
          dealType: deal.deal_type,
          therapeuticArea: deal.therapeutic_area,
          announcedDate: deal.announced_date,
        }).catch(err => console.error('[Perplexity] Slack alert error:', err));
      }
    }

    // Per-run Slack summary removed — consolidated into weekly digest
    // High-value deal alerts (>$500M) still fire real-time above
  }

  // Log with cursor in notes field for rotation tracking
  await supabase.from('data_ingestion_log').insert({
    source: 'perplexity_discovery',
    run_type: 'cron',
    parameters: { therapeuticAreas: currentTAs, byTA: result.by_ta, demandDriven },
    records_fetched: result.queries_run,
    records_processed: result.deals_discovered,
    records_inserted: result.deals_inserted,
    records_failed: result.errors.length,
    errors: result.errors.slice(0, 50),
    status: 'completed',
    completed_at: new Date().toISOString(),
    notes: String(currentIndex), // Cursor for rotation tracking
  });

  // Intelligence tracking
  try {
    await runCronIntelligence(supabase, 'perplexity-discovery', {
      processed: result.deals_discovered,
      inserted: result.deals_inserted,
    });
  } catch {}

  return NextResponse.json({
    success: true,
    rotation: `${currentIndex + 1}/${TA_ROTATION.length}`,
    therapeuticAreas: currentTAs,
    ...result,
  });
}
