/**
 * Monthly intelligence digest — sends a single summary email to all
 * subscribers on newsletter_subscribers (source='intelligence_digest',
 * status='active'). Runs first of each month at 14:00 UTC.
 *
 * Content:
 *   - Calibration round summary (latest N rounds from git-log-style content)
 *   - Upcoming Phase 3 readouts (next 30 days, oncology + top 3 TAs)
 *   - FDA AdComm calendar (next 30 days, all TAs)
 *   - Top counterparty premium movements (if any)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { sendEmail } from '@/lib/email/client';
import { fetchUpcomingReadouts } from '@/lib/market-intelligence/ct-gov-events';
import { getAdCommCalendar } from '@/lib/market-intelligence/fda-adcomm';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface Subscriber {
  email: string;
}

function formatDigestHtml(payload: {
  monthLabel: string;
  ctgRows: Array<{ sponsor: string; intervention: string | null; indication: string; daysToReadout: number; studyUrl: string }>;
  adCommRows: Array<{ sponsor: string; application: string; indication: string; daysFromToday: number; meetingDate: string }>;
  unsubscribeEmail: string;
}): string {
  const baseUrl = 'https://solidus.ambrosiaventures.co';
  const { monthLabel, ctgRows, adCommRows, unsubscribeEmail } = payload;

  const ctgSection = ctgRows.length === 0
    ? '<p style="color:#94a3b8">No Phase 3 readouts in next 30 days.</p>'
    : ctgRows.map(r => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#cbd5e1;">
            <div style="font-weight:600;">${r.sponsor}${r.intervention ? ` &middot; ${r.intervention}` : ''}</div>
            <div style="font-size:13px;color:#94a3b8;margin-top:2px;">${r.indication} &middot; <a href="${r.studyUrl}" style="color:#34c2c2;">${r.daysToReadout}d out</a></div>
          </td>
        </tr>`).join('');

  const adCommSection = adCommRows.length === 0
    ? '<p style="color:#94a3b8">No AdComm meetings in next 30 days.</p>'
    : adCommRows.map(r => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#cbd5e1;">
            <div style="font-weight:600;">${r.application}</div>
            <div style="font-size:13px;color:#94a3b8;margin-top:2px;">${r.sponsor} &middot; ${r.indication} &middot; ${r.meetingDate} (${r.daysFromToday}d)</div>
          </td>
        </tr>`).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ambrosia Intelligence — ${monthLabel}</title>
</head>
<body style="margin:0;padding:0;background:#0c0e1f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;color:#e2e8f0;">
    <div style="border-bottom:3px solid #0EA5A5;padding-bottom:20px;margin-bottom:32px;">
      <h1 style="color:#ffffff;font-size:24px;margin:0;">Ambrosia Intelligence</h1>
      <p style="color:#94a3b8;font-size:14px;margin:6px 0 0 0;">${monthLabel} &middot; biopharma deal intelligence digest</p>
    </div>

    <h2 style="color:#34c2c2;font-size:16px;text-transform:uppercase;letter-spacing:0.08em;margin:32px 0 12px 0;">
      Phase 3 readouts — next 30 days
    </h2>
    <table style="width:100%;border-collapse:collapse;">
      ${ctgSection}
    </table>

    <h2 style="color:#34c2c2;font-size:16px;text-transform:uppercase;letter-spacing:0.08em;margin:32px 0 12px 0;">
      FDA advisory committees — next 30 days
    </h2>
    <table style="width:100%;border-collapse:collapse;">
      ${adCommSection}
    </table>

    <h2 style="color:#34c2c2;font-size:16px;text-transform:uppercase;letter-spacing:0.08em;margin:32px 0 12px 0;">
      From the product
    </h2>
    <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">
      The engine continues its calibration rounds against 1,000+ disclosed deals. Full dashboard
      (internal). Peer benchmarks live on <a href="${baseUrl}/simulator" style="color:#34c2c2;">/simulator</a>,
      counterparty playbooks on <a href="${baseUrl}/playbook" style="color:#34c2c2;">/playbook</a>.
    </p>

    <div style="border-top:1px solid #1e293b;margin-top:40px;padding-top:20px;font-size:12px;color:#64748b;">
      You&rsquo;re receiving this because you opted in for monthly intelligence digests at
      <a href="${baseUrl}" style="color:#64748b;">${baseUrl}</a>. One email a month, no marketing.
      <br />
      <a href="${baseUrl}/api/intelligence/unsubscribe?email=${encodeURIComponent(unsubscribeEmail)}" style="color:#64748b;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>
`.trim();
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  const expected = `Bearer ${cronSecret}`;
  const provided = authHeader || '';
  const sameLen = provided.length === expected.length;
  const tokenToCompare = sameLen ? provided : expected;
  const isValid = sameLen && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expected));
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const { data: subscribers } = await supabase
      .from('newsletter_subscribers')
      .select('email')
      .eq('source', 'intelligence_digest')
      .eq('status', 'active');

    const list = (subscribers ?? []) as Subscriber[];
    if (list.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: 'no subscribers' });
    }

    // Assemble digest content once — reused across all subscribers.
    const ctgOnc = await fetchUpcomingReadouts({ ta: 'oncology', phase: 'PHASE3', limit: 5, daysAhead: 30 });
    const ctgOther = await fetchUpcomingReadouts({ ta: 'immunology', phase: 'PHASE3', limit: 3, daysAhead: 30 });
    const ctgRows = [...ctgOnc, ...ctgOther].slice(0, 8).map(r => ({
      sponsor: r.sponsor,
      intervention: r.intervention,
      indication: r.conditions[0] || '—',
      daysToReadout: r.daysToReadout,
      studyUrl: r.studyUrl,
    }));

    const adCommAll = getAdCommCalendar({ daysAheadMax: 30, daysBehindMax: 0 });
    const adCommRows = adCommAll.filter(m => m.daysFromToday >= 0).slice(0, 8).map(m => ({
      sponsor: m.sponsor,
      application: m.application,
      indication: m.indication,
      daysFromToday: m.daysFromToday,
      meetingDate: m.meetingDate,
    }));

    const now = new Date();
    const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const subject = `Ambrosia Intelligence — ${monthLabel}`;

    let sent = 0;
    let failed = 0;
    for (const sub of list) {
      const html = formatDigestHtml({ monthLabel, ctgRows, adCommRows, unsubscribeEmail: sub.email });
      try {
        const result = await sendEmail({ to: sub.email, subject, html });
        if (result.success) sent++;
        else failed++;
      } catch {
        failed++;
      }
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'intelligence-digest', {
        processed: list.length,
        inserted: sent,
      });
    } catch {}

    return NextResponse.json({ success: true, sent, failed, total: list.length });
  } catch (err) {
    console.error('intelligence-digest cron error', err);
    return NextResponse.json({ error: 'Digest send failed' }, { status: 500 });
  }
}
