import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BASE_URL = 'https://calculator.ambrosiaventures.co';

function buildUpsellEmail(email: string): { subject: string; html: string } {
  return {
    subject: 'You paid $499 for one report. Here\'s how to get unlimited.',
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
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi there,</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Thanks for purchasing a deal report. You now have institutional-grade benchmarks for that specific analysis.
      </p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Quick thought: <strong style="color: #e2e8f0;">Pro gives you unlimited reports</strong> for $299/month. That includes:
      </p>

      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <ul style="color: #94a3b8; font-size: 14px; line-height: 2; margin: 0; padding-left: 20px;">
          <li><strong style="color: #14b8a6;">Unlimited deal reports</strong> — run as many analyses as you need</li>
          <li><strong style="color: #14b8a6;">rNPV + Monte Carlo</strong> — full risk-adjusted valuations</li>
          <li><strong style="color: #14b8a6;">Partner matching</strong> — 850+ pharma companies with intent scoring</li>
          <li><strong style="color: #14b8a6;">Real options + scenario comparison</strong> — model every outcome</li>
          <li><strong style="color: #14b8a6;">PDF + Excel export</strong> — board-ready deliverables</li>
        </ul>
      </div>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 20px;">
        At $299/month, Pro pays for itself after your second analysis. No more one-off purchases.
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${BASE_URL}/calculator?upgrade=true" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">
          Upgrade to Pro
        </a>
      </div>

      <p style="color: #64748b; font-size: 13px; margin: 24px 0 0; border-top: 1px solid #1e293b; padding-top: 16px;">
        Questions? Reply to this email — our team reads every message.
      </p>

      <p style="color: #94a3b8; font-size: 15px; margin: 16px 0 0;">
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
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    const { data: recentPurchases } = await supabase
      .from('report_purchases')
      .select('id, user_id, email, purchased_at')
      .eq('status', 'completed')
      .gte('purchased_at', fortyEightHoursAgo)
      .lte('purchased_at', twentyFourHoursAgo);

    if (!recentPurchases || recentPurchases.length === 0) {
      return NextResponse.json({ success: true, message: 'No recent report purchases', emailsSent: 0 });
    }

    const seenEmails = new Set<string>();
    const eligiblePurchases: typeof recentPurchases = [];

    for (const purchase of recentPurchases) {
      const email = (purchase.email || '').toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      eligiblePurchases.push(purchase);
    }

    const { data: existingUpsells } = await supabase
      .from('events')
      .select('event_data')
      .eq('event_type', 'report_buyer_upsell_sent');

    const alreadySentEmails = new Set(
      (existingUpsells || []).map(e => (e.event_data as { email?: string })?.email?.toLowerCase()).filter(Boolean),
    );

    let emailsSent = 0;
    const errors: string[] = [];

    for (const purchase of eligiblePurchases) {
      const email = purchase.email!.toLowerCase();

      if (alreadySentEmails.has(email)) continue;

      if (purchase.user_id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tier')
          .eq('id', purchase.user_id)
          .single();

        if (profile?.tier === 'pro' || profile?.tier === 'portfolio') continue;
      }

      const { subject, html } = buildUpsellEmail(email);
      const result = await sendEmail({ to: email, subject, html });

      if (result.success) {
        await supabase.from('events').insert({
          user_id: purchase.user_id,
          event_type: 'report_buyer_upsell_sent',
          event_data: { email, report_purchase_id: purchase.id },
        });
        emailsSent++;
      } else {
        errors.push(`Failed for ${email}: ${result.error}`);
      }
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl && emailsSent > 0) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Report buyer upsell: ${emailsSent} emails sent`,
          attachments: [{
            color: '#14b8a6',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: 'Report Buyer Pro Upsell', emoji: true } },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Recent Purchases:*\n${recentPurchases.length}` },
                  { type: 'mrkdwn', text: `*Upsell Emails Sent:*\n${emailsSent}` },
                ],
              },
            ],
          }],
        }),
      }).then(() => {}, () => {});
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'report-upsell', {
        processed: recentPurchases.length,
        inserted: emailsSent,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      recentPurchases: recentPurchases.length,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    captureApiError(error, 'cron-report-upsell');
    return NextResponse.json({ error: 'Report upsell cron failed' }, { status: 500 });
  }
}
