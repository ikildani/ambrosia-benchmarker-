/**
 * Manual entry point for the deal inflow check.
 *
 * The scheduled run happens inside /api/cron/api-credit-check at 13:20 UTC
 * (Vercel caps a project at 100 cron entries). This route stays so the check
 * can be triggered by hand: curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/deal-inflow-check
 * See lib/ingestion/inflow-check.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { runDealInflowCheck } from '@/lib/ingestion/inflow-check';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  const expected = `Bearer ${cronSecret}`;
  const provided = authHeader || '';
  const ok = provided.length === expected.length && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const report = await runDealInflowCheck(createServiceClient());
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    console.error('[deal-inflow-check] failed:', error);
    return NextResponse.json({ error: 'deal inflow check failed' }, { status: 500 });
  }
}
