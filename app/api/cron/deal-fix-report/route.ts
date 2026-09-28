/**
 * On-demand flag-and-fix report (the daily send rides on /api/cron/api-credit-check
 * at 12:20 UTC because vercel.json is at Vercel's 100-cron cap).
 *
 * Lists every flagged deal handled in the window and how: fixed from a primary
 * source (with the field changes), removed as a duplicate, rejected, or still
 * unresolved. ?hours=N sets the window (default 24); ?dry=1 returns the HTML
 * instead of emailing ADMIN_NOTIFICATION_EMAIL.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { buildFlagFixReportHtml, collectFlagFixReport, sendFlagFixReport } from '@/lib/ingestion/flag-fix-report';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  const expected = `Bearer ${cronSecret}`;
  const provided = request.headers.get('authorization') || '';
  const ok = provided.length === expected.length && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const hoursParam = Number(params.get('hours'));
  const hours = Number.isFinite(hoursParam) && hoursParam > 0 ? Math.min(24 * 14, hoursParam) : 24;
  const supabase = createServiceClient();

  if (params.get('dry') === '1') {
    const report = await collectFlagFixReport(supabase, new Date(Date.now() - hours * 3_600_000).toISOString());
    return new NextResponse(buildFlagFixReportHtml(report), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const { sent, error, report } = await sendFlagFixReport(supabase, hours);
  return NextResponse.json({ sent, error, fixed: report.fixed.length, duplicates: report.duplicates.length, rejected: report.rejected.length, unresolved: report.unresolved.length });
}
