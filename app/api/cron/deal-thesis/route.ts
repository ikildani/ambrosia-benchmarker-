import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { generateDealTheses, MIN_COMPS_FOR_TERMS } from '@/lib/radar/deal-thesis';
import { deriveRunStatus } from '@/lib/radar/run-log';

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
    const result = await generateDealTheses(supabase);
    const status = deriveRunStatus({
      errors: result.errors.length,
      timedOut: result.timedOut,
      processed: result.assetsProcessed,
      produced: result.thesesGenerated,
    });

    return NextResponse.json({
      success: true,
      status,
      assets_processed: result.assetsProcessed,
      theses_generated: result.thesesGenerated,
      insufficient_comps: result.insufficientComps,
      min_comps_for_terms: MIN_COMPS_FOR_TERMS,
      error_count: result.errors.length,
      errors: result.errors.slice(0, 10),
      timed_out: result.timedOut,
      log_written: result.logWritten,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[deal-thesis] Fatal error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
