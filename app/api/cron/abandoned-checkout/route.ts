import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BASE_URL = 'https://calculator.ambrosiaventures.co';

function formatLabel(value: string): string {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function buildRecoveryEmail(modality: string, indication: string, phase: string): { subject: string; html: string } {
  const assetDesc = [phase, modality, indication].filter(Boolean).map(formatLabel).join(' ');

  return {
    subject: 'Your deal report is waiting',
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
        You started a deal report${assetDesc ? ` for your <strong style="color: #14b8a6;">${assetDesc}</strong> analysis` : ''} but didn't finish checkout. Your analysis is still ready.
      </p>

      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <p style="color: #e2e8f0; font-size: 14px; font-weight: 600; margin: 0 0 12px;">Your report includes:</p>
        <ul style="color: #94a3b8; font-size: 14px; line-height: 2; margin: 0; padding-left: 20px;">
          <li>Comparable deal transactions with disclosed terms</li>
          <li>Risk-adjusted valuation (rNPV)</li>
          <li>Deal structure benchmarks (upfronts, milestones, royalties)</li>
          <li>Partner matching with buyer intent analysis</li>
          <li>Board-ready PDF and Excel export</li>
        </ul>
      </div>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 20px;">
        The deal landscape moves fast. The benchmarks in your report are calibrated to current market data — the sooner you have them, the stronger your position.
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${BASE_URL}/calculator" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">
          Complete Your Purchase
        </a>
      </div>

      <p style="color: #64748b; font-size: 13px; margin: 24px 0 0; border-top: 1px solid #1e293b; padding-top: 16px;">
        Had trouble with checkout? Reply to this email and we'll help.
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
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingPurchases } = await supabase
      .from('report_purchases')
      .select('id, user_id, email, calculation_inputs, created_at')
      .eq('status', 'pending')
      .lte('created_at', oneDayAgo)
      .gte('created_at', sevenDaysAgo);

    if (!pendingPurchases || pendingPurchases.length === 0) {
      return NextResponse.json({ success: true, message: 'No abandoned checkouts', emailsSent: 0 });
    }

    const purchaseIds = pendingPurchases.map(p => p.id);
    const { data: existingRecoveries } = await supabase
      .from('events')
      .select('event_data')
      .eq('event_type', 'abandoned_checkout_recovery_sent')
      .in('event_data->>report_purchase_id', purchaseIds);

    const alreadySentIds = new Set(
      (existingRecoveries || []).map(e => (e.event_data as { report_purchase_id?: string })?.report_purchase_id).filter(Boolean),
    );

    let emailsSent = 0;
    const errors: string[] = [];

    for (const purchase of pendingPurchases) {
      if (alreadySentIds.has(purchase.id)) continue;

      let email = purchase.email;
      if (!email && purchase.user_id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email, tier')
          .eq('id', purchase.user_id)
          .single();
        if (profile?.tier === 'pro' || profile?.tier === 'portfolio') continue;
        email = profile?.email || null;
      }

      if (!email) continue;

      const inputs = (purchase.calculation_inputs || {}) as {
        modality?: string; indication?: string; phase?: string;
      };
      const { subject, html } = buildRecoveryEmail(
        inputs.modality || '',
        inputs.indication || '',
        inputs.phase || '',
      );
      const result = await sendEmail({ to: email, subject, html });

      if (result.success) {
        await supabase.from('events').insert({
          user_id: purchase.user_id,
          event_type: 'abandoned_checkout_recovery_sent',
          event_data: { email, report_purchase_id: purchase.id },
        });
        emailsSent++;
      } else {
        errors.push(`Failed for ${email}: ${result.error}`);
      }
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Abandoned checkout recovery: ${pendingPurchases.length} pending, ${emailsSent} emails sent`,
          attachments: [{
            color: '#f59e0b',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: 'Abandoned Checkout Recovery', emoji: true } },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Pending Purchases (24h-7d):*\n${pendingPurchases.length}` },
                  { type: 'mrkdwn', text: `*Recovery Emails Sent:*\n${emailsSent}` },
                  { type: 'mrkdwn', text: `*Already Sent:*\n${alreadySentIds.size}` },
                  { type: 'mrkdwn', text: `*Errors:*\n${errors.length}` },
                ],
              },
            ],
          }],
        }),
      }).then(() => {}, () => {});
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'abandoned-checkout', {
        processed: pendingPurchases.length,
        inserted: emailsSent,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      pendingPurchases: pendingPurchases.length,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    captureApiError(error, 'cron-abandoned-checkout');
    return NextResponse.json({ error: 'Abandoned checkout cron failed' }, { status: 500 });
  }
}
