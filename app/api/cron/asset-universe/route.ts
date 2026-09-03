/**
 * Cron: Asset Universe Indexer
 *
 * Indexes clinical-stage assets from company_trials into the canonical
 * clinical_assets table. Cross-references deals for partnership status.
 *
 * Schedule: 6:30 AM UTC daily (after trials-update at 5 AM and deals-update at 3 AM)
 * Expected: 2,000-10,000+ assets indexed across 200+ companies
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { indexAssetUniverse } from '@/lib/radar/asset-universe';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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

  try {
    const result = await indexAssetUniverse(supabase);

    return NextResponse.json({
      success: true,
      companies_processed: result.companiesProcessed,
      assets_indexed: result.assetsIndexed,
      assets_updated: result.assetsUpdated,
      partnerships_resolved: result.partnershipsResolved,
      errors: result.errors.slice(0, 10),
      timed_out: result.timedOut,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[asset-universe] Fatal error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
