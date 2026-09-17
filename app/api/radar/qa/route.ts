/**
 * GET /api/radar/qa — latest Asset Radar QA report (admin only).
 *
 * Auth: lib/admin-auth.ts verifyAdminAuth (ADMIN_API_KEY bearer token, or an
 * authenticated ADMIN_EMAILS user) — the same gate as app/api/admin/*.
 *
 * Query params:
 *   ?run=<uuid>     report for a specific invariants run (default: latest)
 *   ?format=md      text/markdown instead of JSON
 *   ?sheet=1        download the human review XLSX for the current golden set
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { isUuid } from '@/app/api/radar/_lib/radar-api';
import { buildQaReport, renderQaReportMarkdown } from '@/lib/radar/qa/report';
import { exportHumanReviewSheet } from '@/lib/radar/qa/golden-set';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = await verifyAdminAuth(request);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const supabase = createServiceClient();

  try {
    if (params.get('sheet') === '1') {
      const origin = request.nextUrl.origin;
      const { buffer, rows, assets } = await exportHumanReviewSheet(supabase, { baseUrl: origin });
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="radar-golden-review-${new Date().toISOString().slice(0, 10)}.xlsx"`,
          'X-Radar-QA-Rows': String(rows),
          'X-Radar-QA-Assets': String(assets),
          'Cache-Control': 'no-store',
        },
      });
    }

    const runParam = params.get('run');
    const runId = runParam && isUuid(runParam) ? runParam : undefined;
    const report = await buildQaReport(supabase, runId);

    if (params.get('format') === 'md') {
      return new NextResponse(renderQaReportMarkdown(report), {
        status: 200,
        headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return NextResponse.json({ success: true, report, markdown: renderQaReportMarkdown(report) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[radar-qa-api] ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
