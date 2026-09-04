/**
 * Cron: Competitive Intelligence (Asset Radar Layer 5)
 *
 * Analyzes competitive landscape for each clinical asset:
 * user interest, competitor deals, patent overlap, conference overlap,
 * trial crowding, publication race. Updates competitive_heat scores.
 *
 * Schedule: 10:30 AM UTC daily (after licensing-signals at 8 AM)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runCompetitiveIntel } from '@/lib/radar/competitive-intel';

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
    const result = await runCompetitiveIntel(supabase);

    return NextResponse.json({
      success: true,
      assets_analyzed: result.assetsAnalyzed,
      signals_detected: result.signalsDetected,
      signals_inserted: result.signalsInserted,
      heat_scores_updated: result.heatScoresUpdated,
      errors: result.errors.slice(0, 10),
      timed_out: result.timedOut,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[competitive-intel-radar] Fatal error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
