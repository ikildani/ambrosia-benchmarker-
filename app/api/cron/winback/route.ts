import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BASE_URL = 'https://calculator.ambrosiaventures.co';
const MAX_EMAILS_PER_RUN = 50;

function formatLabel(value: string): string {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function formatDealValue(amount: number | null): string {
  if (amount == null) return 'Undisclosed';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  return `$${amount.toLocaleString()}`;
}

interface RecentDeal {
  licensee: string;
  licensor: string;
  total_deal_value: number | null;
  deal_type: string;
  announced_date: string | null;
}

function buildWinbackEmail(
  name: string,
  ta: string,
  deals: RecentDeal[],
): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || 'there';
  const taLabel = formatLabel(ta);

  const dealRows = deals.slice(0, 3).map(d => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b;">
        <strong style="color: #e2e8f0; font-size: 14px;">${d.licensor || 'Undisclosed'} &rarr; ${d.licensee || 'Undisclosed'}</strong>
        <p style="color: #64748b; font-size: 12px; margin: 4px 0 0;">
          ${formatLabel(d.deal_type || 'licensing')} | ${formatDealValue(d.total_deal_value)}${d.announced_date ? ` | ${new Date(d.announced_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
        </p>
      </td>
    </tr>
  `).join('');

  return {
    subject: `New ${taLabel} deal data since your last visit`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="text-align: center; padding: 32px 24px; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 16px 16px 0 0; border: 1px solid #1e3a5f; border-bottom: none;">
      <img src="${BASE_URL}/icon-color.png" alt="Ambrosia Ventures" width="48" height="48" style="margin-bottom: 16px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Ambrosia Ventures</h1>
      <p style="color: #64748b; margin: 4px 0 0; font-size: 13px;">Deal Intelligence Platform</p>
    </div>

    <div style="background: #111827; padding: 32px; border: 1px solid #1e3a5f; border-top: none; border-radius: 0 0 16px 16px;">
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        It's been a while since you explored <strong style="color: #14b8a6;">${taLabel}</strong> benchmarks. A lot has changed — here's what's new:
      </p>

      ${dealRows ? `
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; margin: 20px 0;">
        <div style="padding: 12px 16px; background: #14b8a610; border-bottom: 1px solid #1e293b;">
          <strong style="color: #14b8a6; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Recent ${taLabel} Deals</strong>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${dealRows}
        </table>
      </div>` : ''}

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 16px 0;">
        New deals mean updated benchmarks. If you're working on anything in ${taLabel}, the data is fresher than when you last checked.
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${BASE_URL}/calculator" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">
          See Updated Benchmarks
        </a>
      </div>

      <p style="color: #64748b; font-size: 13px; margin: 20px 0 0; text-align: center;">
        Want full access? <a href="${BASE_URL}/pro" style="color: #14b8a6; text-decoration: none;">Upgrade to Pro</a> for unlimited calculations.
      </p>

      <p style="color: #94a3b8; font-size: 15px; margin: 20px 0 0;">
        Best,<br>
        <strong style="color: #e2e8f0;">The Ambrosia Ventures Team</strong>
      </p>
    </div>

    <div style="text-align: center; padding: 24px; color: #475569; font-size: 12px; line-height: 1.5;">
      <p style="margin: 0;">Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6; text-decoration: none;">ambrosiaventures.co</a></p>
      <p style="margin: 8px 0 0;"><a href="${BASE_URL}/unsubscribe" style="color: #475569; text-decoration: underline;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`,
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const secret = process.env.CRON_SECRET || '';

  if (!token || !secret || token.length !== secret.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();

    const { data: leadScores } = await supabase
      .from('lead_scores')
      .select('user_id, lead_score, last_activity_at')
      .gte('lead_score', 30)
      .lte('last_activity_at', twentyOneDaysAgo);

    if (!leadScores || leadScores.length === 0) {
      return NextResponse.json({ success: true, message: 'No lapsed warm leads', emailsSent: 0 });
    }

    const userIds = leadScores.map(l => l.user_id);
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, tier, created_at')
      .in('id', userIds)
      .eq('tier', 'free')
      .lte('created_at', thirtyDaysAgo);

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ success: true, message: 'No eligible free users', emailsSent: 0 });
    }

    const eligibleIds = profiles.map(p => p.id);
    const { data: existingWinbacks } = await supabase
      .from('events')
      .select('user_id')
      .eq('event_type', 'winback_email_sent')
      .in('user_id', eligibleIds);

    const alreadySent = new Set((existingWinbacks || []).map(e => e.user_id));

    const { data: calcs } = await supabase
      .from('calculations')
      .select('user_id, therapeutic_area')
      .in('user_id', eligibleIds);

    const taCountMap = new Map<string, Map<string, number>>();
    for (const calc of calcs || []) {
      if (!calc.user_id) continue;
      if (!taCountMap.has(calc.user_id)) taCountMap.set(calc.user_id, new Map());
      const userTaCounts = taCountMap.get(calc.user_id)!;
      const ta = calc.therapeutic_area || 'oncology';
      userTaCounts.set(ta, (userTaCounts.get(ta) || 0) + 1);
    }

    let emailsSent = 0;
    const errors: string[] = [];

    for (const profile of profiles) {
      if (emailsSent >= MAX_EMAILS_PER_RUN) break;
      if (alreadySent.has(profile.id)) continue;

      const userTaCounts = taCountMap.get(profile.id);
      let topTa = 'oncology';
      if (userTaCounts && userTaCounts.size > 0) {
        let maxCount = 0;
        for (const [ta, count] of userTaCounts) {
          if (count > maxCount) { maxCount = count; topTa = ta; }
        }
      }

      const { data: recentDeals } = await supabase
        .from('deals')
        .select('licensee, licensor, total_deal_value, deal_type, announced_date')
        .eq('therapeutic_area', topTa)
        .eq('is_synthetic', false)
        .order('announced_date', { ascending: false, nullsFirst: false })
        .limit(3);

      if (!recentDeals || recentDeals.length === 0) continue;

      const leadScore = leadScores.find(l => l.user_id === profile.id)?.lead_score || 0;
      const { subject, html } = buildWinbackEmail(profile.full_name || profile.email, topTa, recentDeals);
      const result = await sendEmail({ to: profile.email, subject, html });

      if (result.success) {
        await supabase.from('events').insert({
          user_id: profile.id,
          event_type: 'winback_email_sent',
          event_data: {
            email: profile.email,
            therapeutic_area: topTa,
            lead_score: leadScore,
          },
        });
        emailsSent++;
      } else {
        errors.push(`Failed for ${profile.email}: ${result.error}`);
      }
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Winback: ${emailsSent} emails sent to lapsed warm leads`,
          attachments: [{
            color: '#2563eb',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: 'Winback Campaign Report', emoji: true } },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Lapsed Warm Leads:*\n${leadScores.length}` },
                  { type: 'mrkdwn', text: `*Eligible (free, 30d+):*\n${profiles.length}` },
                  { type: 'mrkdwn', text: `*Already Sent:*\n${alreadySent.size}` },
                  { type: 'mrkdwn', text: `*Emails Sent:*\n${emailsSent}` },
                ],
              },
            ],
          }],
        }),
      }).then(() => {}, () => {});
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'winback', {
        processed: profiles.length,
        inserted: emailsSent,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      lapsedLeads: leadScores.length,
      eligible: profiles.length,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    captureApiError(error, 'cron-winback');
    return NextResponse.json({ error: 'Winback cron failed' }, { status: 500 });
  }
}
