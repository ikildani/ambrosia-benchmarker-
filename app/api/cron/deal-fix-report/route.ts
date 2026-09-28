/**
 * Cron: daily flag-and-fix report, emailed to the owner.
 *
 * Lists every flagged deal handled in the last 24 hours and how: fixed from a
 * primary source (with the field changes), removed as a duplicate, rejected,
 * or still unresolved. Sent to ADMIN_NOTIFICATION_EMAIL. Nothing handled and
 * nothing newly flagged: no email.
 *
 * Schedule: daily 12:50 UTC (08:50 ET). ?hours=N widens the window; ?dry=1
 * returns the HTML instead of sending.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { buildFlagFixReportHtml, collectFlagFixReport } from '@/lib/ingestion/flag-fix-report';

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
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();

  const supabase = createServiceClient();
  const report = await collectFlagFixReport(supabase, since);
  const handled = report.fixed.length + report.duplicates.length + report.rejected.length + report.unresolved.length;
  const html = buildFlagFixReportHtml(report);

  if (params.get('dry') === '1') return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  if (handled === 0 && report.newlyFlagged === 0) return NextResponse.json({ sent: false, reason: 'nothing to report' });

  const to = process.env.ADMIN_NOTIFICATION_EMAIL || 'ikildani@ambrosiaventures.co';
  const subject = `Deal data: ${report.fixed.length} fixed, ${report.duplicates.length} duplicates removed, ${report.unresolved.length} unresolved`;
  const sent = await sendEmail({ to, subject, html });
  return NextResponse.json({ sent: sent.success, error: sent.success ? undefined : sent.error, fixed: report.fixed.length, duplicates: report.duplicates.length, rejected: report.rejected.length, unresolved: report.unresolved.length });
}
