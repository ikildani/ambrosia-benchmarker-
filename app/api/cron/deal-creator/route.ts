/**
 * Cron: Deal Creation Engine (Asset Radar Layer 6)
 *
 * Proposes transactions that don't exist yet by crossing pharma
 * portfolio gaps against available unpartnered assets with predicted
 * deal economics. The capstone of Asset Radar.
 *
 * Schedule: 11:30 AM UTC daily (after all other layers)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runDealCreator } from '@/lib/radar/deal-creator';

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
    const result = await runDealCreator(supabase);

    return NextResponse.json({
      success: true,
      acquirers_analyzed: result.acquirersAnalyzed,
      assets_considered: result.assetsConsidered,
      opportunities_created: result.opportunitiesCreated,
      errors: result.errors.slice(0, 10),
      timed_out: result.timedOut,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[deal-creator] Fatal error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
