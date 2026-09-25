import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';
import { runOutcomePhase } from '@/lib/outcomes/cron';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Outcome resolver — NOT registered in vercel.json (the project sits at
// Vercel's 100-cron cap). The scheduled run is a phase at the end of
// /api/cron/deal-verification (0 */2 * * *, rollups at 02:00 UTC). This route
// exists for manual runs with CRON_SECRET:
//
//   GET /api/cron/outcome-resolve                 resolver only (rollups if hour === 3 UTC)
//   GET /api/cron/outcome-resolve?rollups=true    force Radar writer + rollups
//   GET /api/cron/outcome-resolve?radar=true      force the Radar writer even when
//                                                 OUTCOMES_RADAR_WRITER is unset
//   GET /api/cron/outcome-resolve?cursor=<iso>    re-scan deals created after <iso>
//   GET /api/cron/outcome-resolve?rollups=true&followups=true
//                                                 also send the day-45 / day-120 brief
//                                                 outcome follow-ups (off by default here;
//                                                 the scheduled 02:00 UTC run sends them)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const isValid = token.length === cronSecret.length && timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const cursor = params.get('cursor');
  try {
    const supabase = createServiceClient();
    const report = await runOutcomePhase(supabase, {
      rollupHour: 3,
      forceRollups: params.get('rollups') === 'true',
      forceRadar: params.get('radar') === 'true',
      skipFollowups: params.get('followups') !== 'true',
      cursorOverride: cursor && Number.isFinite(Date.parse(cursor)) ? new Date(cursor).toISOString() : undefined,
    });

    try {
      await runCronIntelligence(supabase, 'outcome-resolve', {
        processed: report.resolver.dealsScanned,
        inserted: report.resolver.autoResolved + report.resolver.queued,
        errors: report.errors.length,
      });
    } catch {}

    return NextResponse.json({ success: report.errors.length === 0, ...report, timestamp: new Date().toISOString() });
  } catch (error) {
    captureApiError(error, 'cron-outcome-resolve');
    return NextResponse.json({ error: 'Outcome resolve cron failed' }, { status: 500 });
  }
}
