/**
 * Cron: Asset Universe Indexer
 *
 * Indexes clinical-stage assets from company_trials into the canonical
 * clinical_assets table. Cross-references deals for partnership status.
 *
 * Schedule: 6:30 AM UTC daily (after trials-update at 5 AM and deals-update at 3 AM)
 * Cursor: companies.assets_indexed_at (migration 102) — 400 companies/run,
 * least-recently indexed first, only companies with drug-bearing trials.
 *
 * Query params (all optional): ?limit=400  ?batch=10
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { indexAssetUniverse } from '@/lib/radar/asset-universe';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function parsePositiveInt(raw: string | null, fallback: number | undefined): number | undefined {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
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
  const companyLimit = parsePositiveInt(request.nextUrl.searchParams.get('limit'), undefined);
  const batchSize = parsePositiveInt(request.nextUrl.searchParams.get('batch'), undefined);

  try {
    const result = await indexAssetUniverse(supabase, { companyLimit, batchSize, runType: 'scheduled' });

    // Intelligence tracking (same pattern as trials-update)
    try {
      await runCronIntelligence(supabase, 'asset-universe', {
        processed: result.companiesProcessed,
        inserted: result.assetsIndexed + result.assetsUpdated,
        skipped: result.assetsSkipped,
        errors: result.errors.length,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      companies_processed: result.companiesProcessed,
      trials_fetched: result.trialsFetched,
      assets_indexed: result.assetsIndexed,
      assets_updated: result.assetsUpdated,
      assets_skipped: result.assetsSkipped,
      assets_failed: result.assetsFailed,
      partnerships_resolved: result.partnershipsResolved,
      errors: result.errors.slice(0, 10),
      error_count: result.errors.length,
      timed_out: result.timedOut,
      logged: result.logged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[asset-universe] Fatal error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
