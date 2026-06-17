import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BASE_URL = 'https://calculator.ambrosiaventures.co';

type DunningStage = 1 | 2 | 3;

function buildDunningEmail(stage: DunningStage): { subject: string; html: string } {
  const subjects: Record<DunningStage, string> = {
    1: 'Action needed: your payment didn\'t go through',
    2: 'Your Pro access is at risk',
    3: 'Last chance: your Pro account will be downgraded tomorrow',
  };

  const bodies: Record<DunningStage, string> = {
    1: `<p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        We tried to process your Pro subscription payment, but it didn't go through. This usually happens when a card expires or your bank flags an unfamiliar charge.
      </p>
      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Your Pro access is still active — just update your payment method and you're all set.
      </p>`,
    2: `<p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        We've tried to process your subscription payment multiple times now. Your Pro features are still active, but they'll be paused if we can't collect payment soon.
      </p>
      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        You'll lose access to:
      </p>
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin: 16px 0;">
        <ul style="color: #94a3b8; font-size: 14px; line-height: 2; margin: 0; padding-left: 20px;">
          <li>Unlimited deal calculations</li>
          <li>Monte Carlo simulation and rNPV analysis</li>
          <li>Partner matching with intent scoring</li>
          <li>PDF and Excel exports</li>
          <li>850+ company deal profiles</li>
        </ul>
      </div>`,
    3: `<p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        This is a final heads-up: if we don't receive payment within the next 24 hours, your account will revert to the free tier.
      </p>
      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        You'll lose access to your saved analyses, shared links, and unlimited deal benchmarking.
      </p>
      <p style="color: #64748b; font-size: 13px; margin: 16px 0;">
        If you intended to cancel, no action needed — your data will be preserved and you can reactivate anytime.
      </p>`,
  };

  const ctaText: Record<DunningStage, string> = {
    1: 'Update Payment Method',
    2: 'Update Payment Method Now',
    3: 'Keep My Pro Access',
  };

  return {
    subject: subjects[stage],
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

      ${bodies[stage]}

      <div style="text-align: center; margin: 28px 0;">
        <a href="${BASE_URL}/settings" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">
          ${ctaText[stage]}
        </a>
      </div>

      <p style="color: #64748b; font-size: 13px; margin: 24px 0 0; border-top: 1px solid #1e293b; padding-top: 16px;">
        Having trouble? Reply to this email and we'll sort it out.
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
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const { data: failedPayments } = await supabase
      .from('events')
      .select('user_id, event_data, created_at')
      .eq('event_type', 'payment_failed')
      .gte('created_at', tenDaysAgo)
      .order('created_at', { ascending: false });

    if (!failedPayments || failedPayments.length === 0) {
      return NextResponse.json({ success: true, message: 'No recent payment failures', emailsSent: 0 });
    }

    const latestByUser = new Map<string, { user_id: string; event_data: Record<string, unknown>; created_at: string }>();
    for (const event of failedPayments) {
      const key = event.user_id || (event.event_data as { stripe_customer_id?: string })?.stripe_customer_id || '';
      if (!key) continue;
      if (!latestByUser.has(key)) {
        latestByUser.set(key, event as typeof latestByUser extends Map<string, infer V> ? V : never);
      }
    }

    const { data: dunningEvents } = await supabase
      .from('events')
      .select('user_id, event_type')
      .in('event_type', ['dunning_email_1_sent', 'dunning_email_2_sent', 'dunning_email_3_sent'])
      .gte('created_at', tenDaysAgo);

    const dunningMap = new Map<string, Set<string>>();
    for (const e of dunningEvents || []) {
      if (!e.user_id) continue;
      if (!dunningMap.has(e.user_id)) dunningMap.set(e.user_id, new Set());
      dunningMap.get(e.user_id)!.add(e.event_type);
    }

    let emailsSent = 0;
    const errors: string[] = [];
    const stageCounts = { 1: 0, 2: 0, 3: 0 };

    for (const [key, event] of latestByUser) {
      const customerId = (event.event_data as { stripe_customer_id?: string })?.stripe_customer_id;
      const userId = event.user_id;

      let profile: { id: string; email: string; subscription_status: string | null } | null = null;

      if (userId) {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, email, subscription_status')
          .eq('id', userId)
          .single();
        profile = data;
      } else if (customerId) {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, email, subscription_status')
          .eq('stripe_customer_id', customerId)
          .single();
        profile = data;
      }

      if (!profile) continue;
      if (profile.subscription_status === 'active') continue;

      const daysSinceFailure = (Date.now() - new Date(event.created_at).getTime()) / (24 * 60 * 60 * 1000);
      const sent = dunningMap.get(profile.id) || new Set();

      let stage: DunningStage | null = null;

      if (daysSinceFailure >= 7 && !sent.has('dunning_email_3_sent') && sent.has('dunning_email_2_sent')) {
        stage = 3;
      } else if (daysSinceFailure >= 3 && !sent.has('dunning_email_2_sent') && sent.has('dunning_email_1_sent')) {
        stage = 2;
      } else if (!sent.has('dunning_email_1_sent')) {
        stage = 1;
      }

      if (!stage) continue;

      const { subject, html } = buildDunningEmail(stage);
      const result = await sendEmail({ to: profile.email, subject, html });

      if (result.success) {
        await supabase.from('events').insert({
          user_id: profile.id,
          event_type: `dunning_email_${stage}_sent`,
          event_data: {
            email: profile.email,
            stripe_customer_id: customerId,
            days_since_failure: Math.floor(daysSinceFailure),
          },
        });
        emailsSent++;
        stageCounts[stage]++;
      } else {
        errors.push(`Failed stage ${stage} for ${profile.email}: ${result.error}`);
      }
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Dunning: ${emailsSent} emails sent (${stageCounts[1]} stage 1, ${stageCounts[2]} stage 2, ${stageCounts[3]} stage 3)`,
          attachments: [{
            color: '#ef4444',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: 'Payment Dunning Report', emoji: true } },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Failed Payments (10d):*\n${latestByUser.size}` },
                  { type: 'mrkdwn', text: `*Stage 1 (gentle):*\n${stageCounts[1]}` },
                  { type: 'mrkdwn', text: `*Stage 2 (urgent):*\n${stageCounts[2]}` },
                  { type: 'mrkdwn', text: `*Stage 3 (final):*\n${stageCounts[3]}` },
                ],
              },
            ],
          }],
        }),
      }).then(() => {}, () => {});
    }

    return NextResponse.json({
      success: true,
      failedPayments: latestByUser.size,
      emailsSent,
      stageCounts,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    captureApiError(error, 'cron-dunning');
    return NextResponse.json({ error: 'Dunning cron failed' }, { status: 500 });
  }
}
