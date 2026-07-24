import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

function buildDay1Email(name: string): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || 'there';
  return {
    subject: 'Welcome to Pro — here\'s your first move',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
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
        Your Pro trial is live. Here's how to get the most out of your 7 days:
      </p>
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <p style="color: #14b8a6; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px;">Start here</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #e2e8f0; font-size: 14px;">
              <strong>1. Run a full rNPV analysis</strong>
              <p style="color: #64748b; font-size: 12px; margin: 4px 0 0;">Select your asset details and hit Calculate. Pro gives you risk-adjusted NPV with TA-specific probability curves.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #e2e8f0; font-size: 14px; border-top: 1px solid #1e293b;">
              <strong>2. Check your Partner Matches</strong>
              <p style="color: #64748b; font-size: 12px; margin: 4px 0 0;">See which of 850+ pharma companies are most likely to bid on your asset — scored by patent cliffs, pipeline gaps, and deal urgency.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #e2e8f0; font-size: 14px; border-top: 1px solid #1e293b;">
              <strong>3. Export a board-ready PDF</strong>
              <p style="color: #64748b; font-size: 12px; margin: 4px 0 0;">Click Export to get a 20-page deal analysis with comparables, sensitivity, and negotiation playbook.</p>
            </td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${BASE_URL}/calculator" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">
          Run Your First Pro Analysis
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px; margin: 24px 0 0; border-top: 1px solid #1e293b; padding-top: 16px;">
        Questions about any feature? Reply to this email — our team responds within hours.
      </p>
      <p style="color: #94a3b8; font-size: 15px; margin: 16px 0 0;">Best,<br><strong style="color: #e2e8f0;">The Ambrosia Ventures Team</strong></p>
    </div>
    <div style="text-align: center; padding: 24px; color: #475569; font-size: 12px;">
      <p style="margin: 0;">Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6; text-decoration: none;">ambrosiaventures.co</a></p>
      <p style="margin: 8px 0 0;"><a href="${BASE_URL}/unsubscribe" style="color: #475569; text-decoration: underline;">Unsubscribe</a></p>
    </div>
  </div>
</body></html>`,
  };
}

function buildDay4Email(name: string, featuresUsed: string[]): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || 'there';
  const allFeatures = ['rNPV Analysis', 'Monte Carlo Simulation', 'Partner Matching', 'Scenario Comparison', 'Real Options', 'PDF Export', 'Buyer-Specific Valuation', 'Competitive Dynamics'];
  const unused = allFeatures.filter(f => !featuresUsed.includes(f));
  const featureRows = unused.slice(0, 4).map(f => `
    <tr><td style="padding: 6px 0; color: #e2e8f0; font-size: 14px; border-bottom: 1px solid #1e293b;">
      <span style="color: #14b8a6;">→</span> ${f}
    </td></tr>`).join('');

  return {
    subject: 'Features you haven\'t tried yet',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="text-align: center; padding: 32px 24px; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 16px 16px 0 0; border: 1px solid #1e3a5f; border-bottom: none;">
      <img src="${BASE_URL}/icon-color.png" alt="Ambrosia Ventures" width="48" height="48" style="margin-bottom: 16px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Ambrosia Ventures</h1>
    </div>
    <div style="background: #111827; padding: 32px; border: 1px solid #1e3a5f; border-top: none; border-radius: 0 0 16px 16px;">
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>
      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        You've been exploring Pro for a few days. ${featuresUsed.length > 0 ? `You've already used ${featuresUsed.join(', ')}. ` : ''}Here's what you haven't tried yet:
      </p>
      ${featureRows ? `
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">${featureRows}</table>
      </div>` : ''}
      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 16px 0;">
        Each of these engines adds a different lens to your deal analysis. Together, they give you the kind of rigor that investment committees expect.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${BASE_URL}/calculator" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">
          Explore Pro Features
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 15px; margin: 16px 0 0;">Best,<br><strong style="color: #e2e8f0;">The Ambrosia Ventures Team</strong></p>
    </div>
    <div style="text-align: center; padding: 24px; color: #475569; font-size: 12px;">
      <p style="margin: 0;"><a href="${BASE_URL}/unsubscribe" style="color: #475569; text-decoration: underline;">Unsubscribe</a></p>
    </div>
  </div>
</body></html>`,
  };
}

function buildDay6Email(name: string): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || 'there';
  return {
    subject: 'Your trial ends tomorrow — keep your access',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="text-align: center; padding: 32px 24px; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 16px 16px 0 0; border: 1px solid #1e3a5f; border-bottom: none;">
      <img src="${BASE_URL}/icon-color.png" alt="Ambrosia Ventures" width="48" height="48" style="margin-bottom: 16px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Ambrosia Ventures</h1>
    </div>
    <div style="background: #111827; padding: 32px; border: 1px solid #1e3a5f; border-top: none; border-radius: 0 0 16px 16px;">
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>
      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Your Pro trial ends tomorrow. After that, you'll revert to the free tier — 3 calculations per month, no rNPV, no partner matching, no exports.
      </p>
      <div style="background: #0f172a; border: 1px solid #14b8a620; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: #14b8a6; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px;">Keep Pro Access</p>
        <p style="color: #e2e8f0; font-size: 20px; font-weight: 700; margin: 0 0 4px;">$299/month</p>
        <p style="color: #64748b; font-size: 13px; margin: 0 0 4px;">or $199/month on an annual plan (save $1,200/year)</p>
        <p style="color: #64748b; font-size: 12px; margin: 0 0 16px;">Cancel anytime. 7-day money-back guarantee.</p>
        <a href="${BASE_URL}/pro" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">
          Keep My Pro Access
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px; margin: 16px 0 0;">
        If you decide not to continue, no action needed — your account will automatically switch to free. Your saved data is preserved.
      </p>
      <p style="color: #94a3b8; font-size: 15px; margin: 20px 0 0;">Best,<br><strong style="color: #e2e8f0;">Issa</strong><br><span style="color: #64748b; font-size: 13px;">Ambrosia Ventures</span></p>
    </div>
    <div style="text-align: center; padding: 24px; color: #475569; font-size: 12px;">
      <p style="margin: 0;"><a href="${BASE_URL}/unsubscribe" style="color: #475569; text-decoration: underline;">Unsubscribe</a></p>
    </div>
  </div>
</body></html>`,
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

    const { data: trialUsers } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, pro_activated_at, subscription_status')
      .eq('subscription_status', 'trialing');

    if (!trialUsers || trialUsers.length === 0) {
      return NextResponse.json({ success: true, message: 'No trial users', emailsSent: 0 });
    }

    const userIds = trialUsers.map(u => u.id);

    const { data: sentEvents } = await supabase
      .from('events')
      .select('user_id, event_type')
      .in('event_type', ['trial_onboarding_day1_sent', 'trial_onboarding_day4_sent', 'trial_onboarding_day6_sent'])
      .in('user_id', userIds);

    const sentMap = new Map<string, Set<string>>();
    for (const e of sentEvents || []) {
      if (!e.user_id) continue;
      if (!sentMap.has(e.user_id)) sentMap.set(e.user_id, new Set());
      sentMap.get(e.user_id)!.add(e.event_type);
    }

    const { data: userEvents } = await supabase
      .from('events')
      .select('user_id, event_type')
      .in('user_id', userIds)
      .in('event_type', [
        'calculation_completed', 'partner_match_requested', 'export_attempted',
        'output_section_expanded',
      ]);

    const featureMap = new Map<string, Set<string>>();
    for (const e of userEvents || []) {
      if (!e.user_id) continue;
      if (!featureMap.has(e.user_id)) featureMap.set(e.user_id, new Set());
      const features = featureMap.get(e.user_id)!;
      if (e.event_type === 'calculation_completed') features.add('rNPV Analysis');
      if (e.event_type === 'partner_match_requested') features.add('Partner Matching');
      if (e.event_type === 'export_attempted') features.add('PDF Export');
      if (e.event_type === 'output_section_expanded') features.add('Scenario Comparison');
    }

    let emailsSent = 0;
    const errors: string[] = [];

    for (const user of trialUsers) {
      const activatedAt = user.pro_activated_at ? new Date(user.pro_activated_at) : new Date(user.email ? Date.now() - 86400000 : Date.now());
      const daysSinceActivation = (Date.now() - activatedAt.getTime()) / (24 * 60 * 60 * 1000);
      const sent = sentMap.get(user.id) || new Set();

      let emailType: 'day1' | 'day4' | 'day6' | null = null;
      let emailContent: { subject: string; html: string } | null = null;

      if (daysSinceActivation >= 5 && !sent.has('trial_onboarding_day6_sent')) {
        emailType = 'day6';
        emailContent = buildDay6Email(user.full_name || user.email);
      } else if (daysSinceActivation >= 3 && !sent.has('trial_onboarding_day4_sent')) {
        emailType = 'day4';
        const used = Array.from(featureMap.get(user.id) || []);
        emailContent = buildDay4Email(user.full_name || user.email, used);
      } else if (daysSinceActivation >= 0.5 && !sent.has('trial_onboarding_day1_sent')) {
        emailType = 'day1';
        emailContent = buildDay1Email(user.full_name || user.email);
      }

      if (!emailType || !emailContent) continue;

      const result = await sendEmail({ to: user.email, ...emailContent });

      if (result.success) {
        await supabase.from('events').insert({
          user_id: user.id,
          event_type: `trial_onboarding_${emailType}_sent`,
          event_data: { email: user.email, days_since_activation: Math.floor(daysSinceActivation) },
        });
        emailsSent++;
      } else {
        errors.push(`Failed ${emailType} for ${user.email}: ${result.error}`);
      }
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl && emailsSent > 0) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Trial onboarding: ${emailsSent} emails sent to ${trialUsers.length} trial users`,
          attachments: [{
            color: '#14b8a6',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: 'Trial Onboarding Report', emoji: true } },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Active Trials:*\n${trialUsers.length}` },
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
      await runCronIntelligence(supabase, 'trial-onboarding', {
        processed: trialUsers.length,
        inserted: emailsSent,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      trialUsers: trialUsers.length,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    captureApiError(error, 'cron-trial-onboarding');
    return NextResponse.json({ error: 'Trial onboarding cron failed' }, { status: 500 });
  }
}
