/**
 * Cron: Licensing Signal Detection
 *
 * Scores every clinical asset with a 9-factor licensing intent model.
 * Detects cash runway pressure, BD hiring, conference activity,
 * regulatory milestones, competitor failures, management commentary,
 * patent filings, publication velocity, and strategic review signals.
 *
 * Schedule: 8:00 AM UTC daily (after asset-universe at 6:30 AM)
 * Expected: 200-500 assets scored per run
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { detectLicensingSignals } from '@/lib/radar/signal-detection';

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
    const result = await detectLicensingSignals(supabase);

    return NextResponse.json({
      success: true,
      assets_scored: result.assetsScored,
      signals_detected: result.signalsDetected,
      signals_inserted: result.signalsInserted,
      snapshots_taken: result.snapshotsTaken,
      errors: result.errors.slice(0, 10),
      timed_out: result.timedOut,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[licensing-signals] Fatal error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
