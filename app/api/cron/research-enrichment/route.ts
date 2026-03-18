/**
 * Cron: Research Enrichment (WHO + FDA BTD + Semantic Scholar)
 *
 * Runs 3 data enrichment pipelines that add context to deal intelligence:
 * 1. FDA Breakthrough Therapy designations — flags BTD assets in deals table
 * 2. Semantic Scholar — academic publications relevant to deal TAs
 * 3. WHO Essential Medicines — reference list for unmet need context
 *
 * Schedule: Weekly (Saturday 06:00 UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runFDABreakthroughIngestion } from '@/lib/ingestion/fda-breakthrough';
import { runSemanticScholarIngestion } from '@/lib/ingestion/semantic-scholar';
import { logCronRun } from '@/lib/cron-utils';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));
  if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityKey) return NextResponse.json({ error: 'PERPLEXITY_API_KEY not configured' }, { status: 500 });

  const supabase = createServiceClient();
  const startTime = Date.now();

  // Step 1: FDA Breakthrough Therapy designations
  console.log('[research-enrichment] Step 1: FDA Breakthrough Therapy designations...');
  let btdResult = { fetched: 0, stored: 0, enriched_deals: 0, errors: [] as string[] };
  try {
    btdResult = await runFDABreakthroughIngestion(supabase, perplexityKey);
  } catch (err) {
    console.error('[research-enrichment] FDA BTD error:', err);
  }

  // Step 2: Semantic Scholar publications (if time permits)
  let scholarResult = { queries_run: 0, papers_found: 0, papers_stored: 0, errors: [] as string[] };
  if (Date.now() - startTime < 200_000) {
    console.log('[research-enrichment] Step 2: Semantic Scholar publications...');
    try {
      scholarResult = await runSemanticScholarIngestion(supabase, {
        maxPerTA: 5,
        yearFilter: `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`,
      });
    } catch (err) {
      console.error('[research-enrichment] Semantic Scholar error:', err);
    }
  }

  await logCronRun(supabase, 'research_enrichment', {
    fetched: btdResult.fetched + scholarResult.papers_found,
    processed: btdResult.stored + scholarResult.papers_stored,
    inserted: btdResult.enriched_deals + scholarResult.papers_stored,
    errors: [...btdResult.errors, ...scholarResult.errors],
  });

  const durationMs = Date.now() - startTime;
  console.log(`[research-enrichment] Done in ${(durationMs / 1000).toFixed(1)}s`);

  return NextResponse.json({
    success: true,
    durationMs,
    fdaBreakthrough: btdResult,
    semanticScholar: scholarResult,
  });
}
