import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';
import { DEAL_STATS } from '@/lib/config/constants';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Onboarding Drip Cron — Daily 9AM UTC
// Converts free users to Pro via 3-email sequence:
//   Day 0: Welcome email
//   Day 3: Value/insight email
//   Day 7: Pro pitch
// Tracks sent emails in events table to prevent duplicates.
// ---------------------------------------------------------------------------

const BASE_URL = 'https://calculator.ambrosiaventures.co';

function buildEmailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <!-- Header -->
    <div style="text-align: center; padding: 32px 24px; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 16px 16px 0 0; border: 1px solid #1e3a5f; border-bottom: none;">
      <img src="${BASE_URL}/icon-color.png" alt="Ambrosia Ventures" width="48" height="48" style="margin-bottom: 16px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">Ambrosia Ventures</h1>
      <p style="color: #64748b; margin: 4px 0 0; font-size: 13px;">Deal Intelligence Platform</p>
    </div>

    <!-- Body -->
    <div style="background: #111827; padding: 32px; border: 1px solid #1e3a5f; border-top: none; border-radius: 0 0 16px 16px;">
      ${content}
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px; color: #475569; font-size: 12px; line-height: 1.5;">
      <p style="margin: 0;">Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6; text-decoration: none;">ambrosiaventures.co</a></p>
      <p style="margin: 8px 0 0;">
        <a href="${BASE_URL}/unsubscribe" style="color: #475569; text-decoration: underline;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function ctaButton(text: string, href: string): string {
  return `<div style="text-align: center; margin: 28px 0;">
    <a href="${href}" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px; letter-spacing: 0.2px;">
      ${text}
    </a>
  </div>`;
}

function buildDay0Email(name: string): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || 'there';
  return {
    subject: 'Your biopharma deal benchmarks are ready',
    html: buildEmailWrapper(`
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Welcome to Ambrosia Ventures. You now have access to the most comprehensive biopharma deal benchmarking platform available.
      </p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 8px;">
        Here is what you can do right now:
      </p>

      <ul style="color: #94a3b8; font-size: 15px; line-height: 1.8; padding-left: 20px; margin: 0 0 16px;">
        <li><strong style="color: #e2e8f0;">Benchmark any deal</strong> across 12 therapeutic areas and 17+ modalities</li>
        <li><strong style="color: #e2e8f0;">Get instant valuations</strong> for upfront payments, milestones, and royalties</li>
        <li><strong style="color: #e2e8f0;">Compare against ${DEAL_STATS.TOTAL_DEALS} real deals</strong> sourced from SEC filings, FTC, and regulatory databases</li>
      </ul>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 4px;">
        Run your first calculation to see where your asset stands in the current market.
      </p>

      ${ctaButton('Run Your First Calculation', `${BASE_URL}/calculator`)}

      <p style="color: #64748b; font-size: 13px; margin: 24px 0 0; border-top: 1px solid #1e293b; padding-top: 16px;">
        Questions? Reply to this email -- our team reads every message.
      </p>

      <p style="color: #94a3b8; font-size: 15px; margin: 16px 0 0;">
        Best,<br>
        <strong style="color: #e2e8f0;">The Ambrosia Ventures Team</strong>
      </p>
    `),
  };
}

function buildDay3Email(name: string): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || 'there';
  return {
    subject: 'How much is your biotech asset actually worth?',
    html: buildEmailWrapper(`
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        One of the most common questions in biopharma BD is deceptively simple: <em style="color: #e2e8f0;">What is my asset actually worth?</em>
      </p>

      <div style="background: #0f172a; border-left: 3px solid #14b8a6; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
        <p style="color: #14b8a6; font-size: 14px; font-weight: 600; margin: 0 0 4px;">Market Insight</p>
        <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6; margin: 0;">
          Phase 2 oncology assets command a <strong>$1.5B median total deal value</strong> in 2025-2026 licensing transactions. But the range is enormous -- from $200M to $7B+ -- and the difference comes down to modality, data maturity, and competitive positioning.
        </p>
      </div>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        We wrote a detailed analysis breaking down the factors that drive asset valuation across therapeutic areas, modalities, and clinical phases.
      </p>

      ${ctaButton('Read the Full Analysis', `${BASE_URL}/insights/how-much-is-my-biotech-asset-worth`)}

      <p style="color: #64748b; font-size: 13px; margin: 24px 0 0; border-top: 1px solid #1e293b; padding-top: 16px;">
        Already running calculations on the platform? Great -- you are building the data foundation for stronger negotiations.
      </p>

      <p style="color: #94a3b8; font-size: 15px; margin: 16px 0 0;">
        Best,<br>
        <strong style="color: #e2e8f0;">The Ambrosia Ventures Team</strong>
      </p>
    `),
  };
}

function buildDay7Email(name: string): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || 'there';
  return {
    subject: "You've seen the benchmarks. Here's what Pro unlocks.",
    html: buildEmailWrapper(`
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        You have been using Ambrosia Ventures for a week now. If you have run a calculation, you have seen what market-grade benchmarks look like.
      </p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 8px;">
        Here is what Pro members get access to:
      </p>

      <div style="margin: 20px 0;">
        <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
          <div style="color: #14b8a6; font-size: 14px; margin-right: 10px; min-width: 20px;">&#10003;</div>
          <div>
            <strong style="color: #e2e8f0; font-size: 14px;">Risk-Adjusted NPV (rNPV)</strong>
            <p style="color: #94a3b8; font-size: 13px; margin: 2px 0 0;">Full DCF analysis with phase-specific probability of success</p>
          </div>
        </div>
        <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
          <div style="color: #14b8a6; font-size: 14px; margin-right: 10px; min-width: 20px;">&#10003;</div>
          <div>
            <strong style="color: #e2e8f0; font-size: 14px;">Monte Carlo Simulation</strong>
            <p style="color: #94a3b8; font-size: 13px; margin: 2px 0 0;">10,000-run probabilistic analysis with confidence intervals</p>
          </div>
        </div>
        <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
          <div style="color: #14b8a6; font-size: 14px; margin-right: 10px; min-width: 20px;">&#10003;</div>
          <div>
            <strong style="color: #e2e8f0; font-size: 14px;">Partner Matching (850+ Companies)</strong>
            <p style="color: #94a3b8; font-size: 13px; margin: 2px 0 0;">Buyer-specific valuation and strategic fit scoring</p>
          </div>
        </div>
        <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
          <div style="color: #14b8a6; font-size: 14px; margin-right: 10px; min-width: 20px;">&#10003;</div>
          <div>
            <strong style="color: #e2e8f0; font-size: 14px;">Pharma Intent Score</strong>
            <p style="color: #94a3b8; font-size: 13px; margin: 2px 0 0;">Predictive model showing which buyers are actively acquiring in your space</p>
          </div>
        </div>
        <div style="display: flex; align-items: flex-start; margin-bottom: 12px;">
          <div style="color: #14b8a6; font-size: 14px; margin-right: 10px; min-width: 20px;">&#10003;</div>
          <div>
            <strong style="color: #e2e8f0; font-size: 14px;">PDF & Excel Export</strong>
            <p style="color: #94a3b8; font-size: 13px; margin: 2px 0 0;">Board-ready reports for presentations and negotiations</p>
          </div>
        </div>
      </div>

      <div style="background: #0f172a; border: 1px solid #1e3a5f; padding: 20px; border-radius: 12px; margin: 24px 0; text-align: center;">
        <p style="color: #14b8a6; font-size: 14px; font-weight: 600; margin: 0 0 8px;">Why BD teams upgrade</p>
        <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6; margin: 0;">
          BD teams using Pro close deals 40% faster with data-backed term sheets. When you walk into a negotiation with Monte Carlo confidence intervals and comparable deal data, the conversation changes.
        </p>
      </div>

      ${ctaButton('Upgrade to Pro', `${BASE_URL}/calculator?upgrade=true`)}

      <p style="color: #64748b; font-size: 13px; margin: 24px 0 0; border-top: 1px solid #1e293b; padding-top: 16px;">
        Have questions about Pro? Reply to this email and we will walk you through it.
      </p>

      <p style="color: #94a3b8; font-size: 15px; margin: 16px 0 0;">
        Best,<br>
        <strong style="color: #e2e8f0;">The Ambrosia Ventures Team</strong>
      </p>
    `),
  };
}

export async function GET(request: NextRequest) {
  // Auth
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
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Query free users created in the last 7 days
    const { data: recentFreeUsers } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, tier, created_at')
      .eq('tier', 'free')
      .gte('created_at', sevenDaysAgo);

    if (!recentFreeUsers || recentFreeUsers.length === 0) {
      return NextResponse.json({ success: true, message: 'No eligible users', day0: 0, day3: 0, day7: 0 });
    }

    // 2. Get all drip_email_sent events for these users
    const userIds = recentFreeUsers.map(u => u.id);
    const { data: sentEvents } = await supabase
      .from('events')
      .select('user_id, event_data')
      .eq('event_type', 'drip_email_sent')
      .in('user_id', userIds);

    // Build a set of "userId:emailNumber" for already-sent emails
    const sentSet = new Set<string>();
    if (sentEvents) {
      for (const event of sentEvents) {
        const emailNum = event.event_data?.email_number;
        if (emailNum && event.user_id) {
          sentSet.add(`${event.user_id}:${emailNum}`);
        }
      }
    }

    // 3. Also check which users have already upgraded (query current tier again to be safe)
    const { data: upgradedUsers } = await supabase
      .from('user_profiles')
      .select('id')
      .in('id', userIds)
      .in('tier', ['pro', 'report']);

    const upgradedSet = new Set((upgradedUsers || []).map(u => u.id));

    let day0Sent = 0;
    let day3Sent = 0;
    let day7Sent = 0;
    const errors: string[] = [];

    for (const user of recentFreeUsers) {
      // Skip if already upgraded
      if (upgradedSet.has(user.id)) continue;

      const createdAt = new Date(user.created_at);
      const daysSinceSignup = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const displayName = user.full_name || user.email;

      try {
        // Day 0: Welcome email (signup day)
        if (daysSinceSignup >= 0 && !sentSet.has(`${user.id}:1`)) {
          const { subject, html } = buildDay0Email(displayName);
          const result = await sendEmail({ to: user.email, subject, html });

          if (result.success) {
            await supabase.from('events').insert({
              user_id: user.id,
              event_type: 'drip_email_sent',
              event_data: { email_number: 1, user_email: user.email, template: 'day0_welcome' },
            });
            day0Sent++;
          } else {
            errors.push(`Day0 failed for ${user.email}: ${result.error}`);
          }
        }

        // Day 3: Value/insight email
        if (daysSinceSignup >= 3 && !sentSet.has(`${user.id}:2`)) {
          const { subject, html } = buildDay3Email(displayName);
          const result = await sendEmail({ to: user.email, subject, html });

          if (result.success) {
            await supabase.from('events').insert({
              user_id: user.id,
              event_type: 'drip_email_sent',
              event_data: { email_number: 2, user_email: user.email, template: 'day3_value' },
            });
            day3Sent++;
          } else {
            errors.push(`Day3 failed for ${user.email}: ${result.error}`);
          }
        }

        // Day 7: Pro pitch
        if (daysSinceSignup >= 7 && !sentSet.has(`${user.id}:3`)) {
          const { subject, html } = buildDay7Email(displayName);
          const result = await sendEmail({ to: user.email, subject, html });

          if (result.success) {
            await supabase.from('events').insert({
              user_id: user.id,
              event_type: 'drip_email_sent',
              event_data: { email_number: 3, user_email: user.email, template: 'day7_pro_pitch' },
            });
            day7Sent++;
          } else {
            errors.push(`Day7 failed for ${user.email}: ${result.error}`);
          }
        }
      } catch (err) {
        errors.push(`Error processing ${user.email}: ${String(err)}`);
      }
    }

    // 7. Slack summary
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Onboarding drip: Day 0: ${day0Sent}, Day 3: ${day3Sent}, Day 7: ${day7Sent}`,
          attachments: [{
            color: '#14b8a6',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: 'Onboarding Drip Emails', emoji: true } },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Day 0 (Welcome):*\n${day0Sent} sent` },
                  { type: 'mrkdwn', text: `*Day 3 (Value):*\n${day3Sent} sent` },
                  { type: 'mrkdwn', text: `*Day 7 (Pro Pitch):*\n${day7Sent} sent` },
                  { type: 'mrkdwn', text: `*Eligible Users:*\n${recentFreeUsers.length}` },
                ],
              },
              ...(errors.length > 0 ? [{
                type: 'context' as const,
                elements: [{ type: 'mrkdwn' as const, text: `Errors: ${errors.length}` }],
              }] : []),
            ],
          }],
        }),
      }).then(() => {}, () => {});
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'onboarding-drip', {
        processed: day0Sent + day3Sent + day7Sent,
        inserted: day0Sent + day3Sent + day7Sent,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      eligibleUsers: recentFreeUsers.length,
      day0: day0Sent,
      day3: day3Sent,
      day7: day7Sent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    captureApiError(error, 'cron-onboarding-drip');
    return NextResponse.json({ error: 'Onboarding drip cron failed' }, { status: 500 });
  }
}
