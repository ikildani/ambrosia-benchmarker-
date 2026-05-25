import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Onboarding Drip Cron — Daily 9AM UTC
// 5-email sequence adapting to user state (trial vs free, active vs dormant):
//   Day 0: Welcome + guided first calculation link
//   Day 1: "Your Pro trial is active" — feature showcase with pre-filled calc links
//   Day 3: Value insight (adapted: different if user has run calcs vs not)
//   Day 5: Trial ending soon — upgrade CTA with pricing
//   Day 7: Trial expired — last-chance upgrade or annual savings
// Tracks sent emails in events table (email_number 1-5) to prevent duplicates.
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
  const prefillUrl = `${BASE_URL}/start?phase=phase2&modality=adc&therapeuticArea=oncology&competitivePosition=racing&dataQuality=strongPhase2&peakSales=2000&from=email`;
  return {
    subject: 'Your 7-day Pro trial is active — run your first analysis',
    html: buildEmailWrapper(`
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Welcome to Ambrosia Ventures. Your <strong style="color: #14b8a6;">7-day Pro trial</strong> is now active — every feature is unlocked.
      </p>

      <div style="background: #0f172a; border: 1px solid #14b8a6; padding: 16px 20px; border-radius: 12px; margin: 20px 0;">
        <p style="color: #14b8a6; font-size: 13px; font-weight: 600; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.06em;">Quick start — try this now</p>
        <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6; margin: 0;">
          We pre-loaded a <strong>Phase 2 oncology ADC licensing deal</strong> for you. Click below to see the full analysis — rNPV, Monte Carlo simulation, partner matching, and deal terms — in under 60 seconds.
        </p>
      </div>

      ${ctaButton('Run the Pre-Loaded Analysis', prefillUrl)}

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 8px;">
        With Pro, you have access to:
      </p>

      <ul style="color: #94a3b8; font-size: 15px; line-height: 1.8; padding-left: 20px; margin: 0 0 16px;">
        <li><strong style="color: #e2e8f0;">Risk-adjusted NPV</strong> with phase-specific probability of success</li>
        <li><strong style="color: #e2e8f0;">Monte Carlo simulation</strong> (10,000 iterations)</li>
        <li><strong style="color: #e2e8f0;">Partner matching</strong> across 850+ pharma & biotech companies</li>
        <li><strong style="color: #e2e8f0;">PDF & Excel export</strong> for board decks</li>
      </ul>

      <p style="color: #64748b; font-size: 13px; margin: 24px 0 0; border-top: 1px solid #1e293b; padding-top: 16px;">
        Questions? Reply directly — I read every message.<br>
        <strong style="color: #94a3b8;">Issa Kildani</strong>, Founder
      </p>
    `),
  };
}

function buildDay1Email(name: string): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || 'there';
  return {
    subject: `${firstName}, you haven't run your first analysis yet`,
    html: buildEmailWrapper(`
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        You signed up yesterday but haven't run a calculation yet. Your Pro trial has <strong style="color: #14b8a6;">6 days remaining</strong>.
      </p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Here are three scenarios you can model right now — click any to see the full analysis:
      </p>

      <div style="margin: 20px 0;">
        <a href="${BASE_URL}/start?phase=phase2&modality=adc&therapeuticArea=oncology&competitivePosition=firstInClass&dataQuality=strongPhase2&peakSales=3000&from=email" style="display: block; text-decoration: none; background: #0f172a; border: 1px solid #1e3a5f; padding: 14px 16px; border-radius: 10px; margin-bottom: 8px;">
          <strong style="color: #e2e8f0; font-size: 14px;">Phase 2 Oncology ADC — First-in-class</strong>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Strong Phase 2 data, $3B peak sales</p>
        </a>
        <a href="${BASE_URL}/start?phase=phase1&modality=smallMolecule&therapeuticArea=metabolic&competitivePosition=racing&dataQuality=promising&peakSales=5000&from=email" style="display: block; text-decoration: none; background: #0f172a; border: 1px solid #1e3a5f; padding: 14px 16px; border-radius: 10px; margin-bottom: 8px;">
          <strong style="color: #e2e8f0; font-size: 14px;">Phase 1 GLP-1 — Metabolic/Obesity</strong>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Competitive race, $5B peak sales potential</p>
        </a>
        <a href="${BASE_URL}/start?phase=phase3&modality=mab&therapeuticArea=immunology&competitivePosition=bestInClass&dataQuality=pivotalReady&peakSales=2000&from=email" style="display: block; text-decoration: none; background: #0f172a; border: 1px solid #1e3a5f; padding: 14px 16px; border-radius: 10px;">
          <strong style="color: #e2e8f0; font-size: 14px;">Phase 3 mAb — Immunology Best-in-class</strong>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Pivotal data, $2B peak sales</p>
        </a>
      </div>

      <p style="color: #64748b; font-size: 13px; margin: 24px 0 0; border-top: 1px solid #1e293b; padding-top: 16px;">
        Or <a href="${BASE_URL}/start" style="color: #14b8a6; text-decoration: none;">build your own scenario</a> from scratch.
      </p>
    `),
  };
}

function buildDay3Email(name: string, hasCalculations: boolean): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || 'there';

  if (hasCalculations) {
    return {
      subject: 'How much is your biotech asset actually worth?',
      html: buildEmailWrapper(`
        <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>

        <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          You have been running calculations — great. Your Pro trial has <strong style="color: #14b8a6;">4 days left</strong>.
        </p>

        <div style="background: #0f172a; border-left: 3px solid #14b8a6; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
          <p style="color: #14b8a6; font-size: 14px; font-weight: 600; margin: 0 0 4px;">Market Insight</p>
          <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6; margin: 0;">
            Phase 2 oncology assets command a <strong>$1.5B median total deal value</strong> in 2025-2026 licensing transactions. But the range is enormous — from $200M to $7B+ — and the difference comes down to modality, data maturity, and competitive positioning.
          </p>
        </div>

        <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          Have you tried exporting a PDF report yet? Pro members can generate board-ready reports with rNPV, Monte Carlo confidence intervals, and comparable deal comps.
        </p>

        ${ctaButton('Generate a PDF Report', `${BASE_URL}/calculator`)}

        <p style="color: #94a3b8; font-size: 15px; margin: 16px 0 0;">
          Best,<br>
          <strong style="color: #e2e8f0;">Issa Kildani</strong>, Founder
        </p>
      `),
    };
  }

  return {
    subject: `${firstName}, your Pro trial expires in 4 days — try it now`,
    html: buildEmailWrapper(`
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Your Pro trial has <strong style="color: #f59e0b;">4 days left</strong> and you haven't run your first calculation yet. Takes 60 seconds.
      </p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Here is what a single calculation gives you:
      </p>

      <div style="margin: 16px 0;">
        <div style="padding: 8px 0; border-bottom: 1px solid #1e293b;">
          <span style="color: #14b8a6; margin-right: 8px;">1.</span>
          <span style="color: #e2e8f0; font-size: 14px;"><strong>Deal terms</strong> — upfront, milestones, royalties benchmarked against 2,500+ real deals</span>
        </div>
        <div style="padding: 8px 0; border-bottom: 1px solid #1e293b;">
          <span style="color: #14b8a6; margin-right: 8px;">2.</span>
          <span style="color: #e2e8f0; font-size: 14px;"><strong>rNPV valuation</strong> — risk-adjusted net present value with LoA calibration</span>
        </div>
        <div style="padding: 8px 0; border-bottom: 1px solid #1e293b;">
          <span style="color: #14b8a6; margin-right: 8px;">3.</span>
          <span style="color: #e2e8f0; font-size: 14px;"><strong>10 partner matches</strong> — ranked by strategic fit and acquisition intent</span>
        </div>
        <div style="padding: 8px 0;">
          <span style="color: #14b8a6; margin-right: 8px;">4.</span>
          <span style="color: #e2e8f0; font-size: 14px;"><strong>PDF export</strong> — board-ready report you can share</span>
        </div>
      </div>

      ${ctaButton('Run Your First Analysis Now', `${BASE_URL}/start?phase=phase2&modality=adc&therapeuticArea=oncology&competitivePosition=racing&dataQuality=strongPhase2&peakSales=2000&from=email`)}

      <p style="color: #94a3b8; font-size: 15px; margin: 16px 0 0;">
        Best,<br>
        <strong style="color: #e2e8f0;">Issa Kildani</strong>, Founder
      </p>
    `),
  };
}

function buildDay5Email(name: string): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || 'there';
  return {
    subject: `${firstName}, your Pro trial ends in 2 days`,
    html: buildEmailWrapper(`
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Your Pro trial expires in <strong style="color: #f59e0b;">2 days</strong>. After that, you will lose access to rNPV, Monte Carlo, partner matching, and PDF export.
      </p>

      <div style="background: #0f172a; border: 1px solid #14b8a6; padding: 20px; border-radius: 12px; margin: 24px 0; text-align: center;">
        <p style="color: #14b8a6; font-size: 13px; font-weight: 600; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.06em;">Most teams pick annual</p>
        <p style="color: #e2e8f0; font-size: 16px; margin: 0;"><strong>$199/mo</strong> billed annually <span style="color: #64748b;">·</span> <strong style="color: #14b8a6;">save $1,200/year</strong> vs monthly</p>
      </div>

      ${ctaButton('Keep Pro Access — $199/mo Annual', `${BASE_URL}/pro?plan=annual`)}

      <p style="color: #64748b; font-size: 12px; text-align: center; margin: -16px 0 24px;">Or <a href="${BASE_URL}/pro?plan=monthly" style="color: #64748b;">$299/mo monthly</a></p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        If budget is a concern, reply to this email and I will see what I can do.
      </p>

      <p style="color: #94a3b8; font-size: 15px; margin: 16px 0 0;">
        Best,<br>
        <strong style="color: #e2e8f0;">Issa Kildani</strong>, Founder
      </p>
    `),
  };
}

function buildDay7Email(name: string): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || 'there';
  return {
    subject: `Your Pro trial has ended — keep access for $199/mo`,
    html: buildEmailWrapper(`
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Your 7-day Pro trial ended today. Your account has been moved to the free tier.
      </p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 8px;">
        What you no longer have access to:
      </p>

      <div style="margin: 16px 0;">
        <div style="padding: 6px 0; color: #94a3b8; font-size: 14px;"><span style="color: #ef4444; margin-right: 8px;">&#10005;</span> Risk-adjusted NPV (rNPV)</div>
        <div style="padding: 6px 0; color: #94a3b8; font-size: 14px;"><span style="color: #ef4444; margin-right: 8px;">&#10005;</span> Monte Carlo simulation (10K iterations)</div>
        <div style="padding: 6px 0; color: #94a3b8; font-size: 14px;"><span style="color: #ef4444; margin-right: 8px;">&#10005;</span> Partner matching (850+ companies, 10 results)</div>
        <div style="padding: 6px 0; color: #94a3b8; font-size: 14px;"><span style="color: #ef4444; margin-right: 8px;">&#10005;</span> PDF & Excel report export</div>
        <div style="padding: 6px 0; color: #94a3b8; font-size: 14px;"><span style="color: #ef4444; margin-right: 8px;">&#10005;</span> Pharma Intent Score</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0 20px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 10px 8px; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #1e3a5f;">Plan</th>
            <th style="text-align: right; padding: 10px 8px; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #1e3a5f;">Monthly</th>
            <th style="text-align: right; padding: 10px 8px; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #1e3a5f;">12-month</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 12px 8px; font-size: 14px; color: #94a3b8; border-bottom: 1px solid #1e293b;">Monthly</td>
            <td style="padding: 12px 8px; font-size: 14px; color: #94a3b8; text-align: right; font-family: monospace; border-bottom: 1px solid #1e293b;">$299</td>
            <td style="padding: 12px 8px; font-size: 14px; color: #94a3b8; text-align: right; font-family: monospace; border-bottom: 1px solid #1e293b;">$3,588</td>
          </tr>
          <tr style="background: #0f172a;">
            <td style="padding: 12px 8px; font-size: 14px; color: #e2e8f0; font-weight: 600;">Annual</td>
            <td style="padding: 12px 8px; font-size: 14px; color: #e2e8f0; text-align: right; font-family: monospace; font-weight: 600;">$199</td>
            <td style="padding: 12px 8px; font-size: 14px; color: #14b8a6; text-align: right; font-family: monospace; font-weight: 700;">$2,388</td>
          </tr>
        </tbody>
      </table>

      ${ctaButton('Reactivate Pro — Annual ($199/mo)', `${BASE_URL}/pro?plan=annual`)}

      <p style="color: #64748b; font-size: 12px; text-align: center; margin: -16px 0 24px;">Or <a href="${BASE_URL}/pro?plan=monthly" style="color: #64748b;">$299/mo monthly</a></p>

      <p style="color: #94a3b8; font-size: 15px; margin: 16px 0 0;">
        Best,<br>
        <strong style="color: #e2e8f0;">Issa Kildani</strong>, Founder
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
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

    // Query users created in the last 10 days (covers full Day 0–7 window + buffer)
    // Include both free and pro-trial users (trial users still need drip emails)
    const { data: recentUsers } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, tier, subscription_status, pro_engagement_type, stripe_customer_id, created_at')
      .gte('created_at', tenDaysAgo);

    if (!recentUsers || recentUsers.length === 0) {
      return NextResponse.json({ success: true, message: 'No eligible users', sent: {} });
    }

    // Skip users who have paid via Stripe (already converted)
    const eligibleUsers = recentUsers.filter(u => !u.stripe_customer_id || u.pro_engagement_type?.startsWith('auto-trial'));

    const userIds = eligibleUsers.map(u => u.id);

    // Get drip events + calculation counts in parallel
    const [sentEventsResult, calcCountsResult] = await Promise.all([
      supabase.from('events').select('user_id, event_data').eq('event_type', 'drip_email_sent').in('user_id', userIds),
      supabase.from('events').select('user_id').eq('event_type', 'calculation_run').in('user_id', userIds),
    ]);

    const sentSet = new Set<string>();
    if (sentEventsResult.data) {
      for (const event of sentEventsResult.data) {
        const emailNum = event.event_data?.email_number;
        if (emailNum && event.user_id) sentSet.add(`${event.user_id}:${emailNum}`);
      }
    }

    // Count calculations per user
    const calcCounts = new Map<string, number>();
    if (calcCountsResult.data) {
      for (const event of calcCountsResult.data) {
        calcCounts.set(event.user_id, (calcCounts.get(event.user_id) || 0) + 1);
      }
    }

    const sent: Record<string, number> = { day0: 0, day1: 0, day3: 0, day5: 0, day7: 0 };
    const errors: string[] = [];

    for (const user of eligibleUsers) {
      const createdAt = new Date(user.created_at);
      const daysSinceSignup = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const displayName = user.full_name || user.email;
      const hasCalcs = (calcCounts.get(user.id) || 0) > 0;

      try {
        // Day 0: Welcome + trial activation + pre-filled calc link
        if (daysSinceSignup >= 0 && !sentSet.has(`${user.id}:1`)) {
          const { subject, html } = buildDay0Email(displayName);
          const result = await sendEmail({ to: user.email, subject, html });
          if (result.success) {
            await supabase.from('events').insert({
              user_id: user.id, event_type: 'drip_email_sent',
              event_data: { email_number: 1, user_email: user.email, template: 'day0_trial_welcome' },
            });
            sent.day0++;
          } else errors.push(`Day0 failed for ${user.email}: ${result.error}`);
        }

        // Day 1: Nudge if no calculation yet — 3 scenario links
        if (daysSinceSignup >= 1 && !hasCalcs && !sentSet.has(`${user.id}:2`)) {
          const { subject, html } = buildDay1Email(displayName);
          const result = await sendEmail({ to: user.email, subject, html });
          if (result.success) {
            await supabase.from('events').insert({
              user_id: user.id, event_type: 'drip_email_sent',
              event_data: { email_number: 2, user_email: user.email, template: 'day1_activation_nudge' },
            });
            sent.day1++;
          } else errors.push(`Day1 failed for ${user.email}: ${result.error}`);
        }

        // Day 3: Value insight (different version for active vs dormant)
        if (daysSinceSignup >= 3 && !sentSet.has(`${user.id}:3`)) {
          const { subject, html } = buildDay3Email(displayName, hasCalcs);
          const result = await sendEmail({ to: user.email, subject, html });
          if (result.success) {
            await supabase.from('events').insert({
              user_id: user.id, event_type: 'drip_email_sent',
              event_data: { email_number: 3, user_email: user.email, template: hasCalcs ? 'day3_value_active' : 'day3_urgency_dormant' },
            });
            sent.day3++;
          } else errors.push(`Day3 failed for ${user.email}: ${result.error}`);
        }

        // Day 5: Trial ending soon — upgrade CTA
        if (daysSinceSignup >= 5 && !sentSet.has(`${user.id}:4`)) {
          const { subject, html } = buildDay5Email(displayName);
          const result = await sendEmail({ to: user.email, subject, html });
          if (result.success) {
            await supabase.from('events').insert({
              user_id: user.id, event_type: 'drip_email_sent',
              event_data: { email_number: 4, user_email: user.email, template: 'day5_trial_ending' },
            });
            sent.day5++;
          } else errors.push(`Day5 failed for ${user.email}: ${result.error}`);
        }

        // Day 7: Trial expired — final upgrade push
        if (daysSinceSignup >= 7 && !sentSet.has(`${user.id}:5`)) {
          const { subject, html } = buildDay7Email(displayName);
          const result = await sendEmail({ to: user.email, subject, html });
          if (result.success) {
            await supabase.from('events').insert({
              user_id: user.id, event_type: 'drip_email_sent',
              event_data: { email_number: 5, user_email: user.email, template: 'day7_trial_expired' },
            });
            sent.day7++;
          } else errors.push(`Day7 failed for ${user.email}: ${result.error}`);
        }
      } catch (err) {
        errors.push(`Error processing ${user.email}: ${String(err)}`);
      }
    }

    // Slack summary
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Onboarding drip: ${JSON.stringify(sent)}`,
          attachments: [{
            color: '#14b8a6',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: 'Onboarding Drip (Trial-First)', emoji: true } },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Day 0 (Trial Welcome):*\n${sent.day0} sent` },
                  { type: 'mrkdwn', text: `*Day 1 (Activation):*\n${sent.day1} sent` },
                  { type: 'mrkdwn', text: `*Day 3 (Value/Urgency):*\n${sent.day3} sent` },
                  { type: 'mrkdwn', text: `*Day 5 (Trial Ending):*\n${sent.day5} sent` },
                  { type: 'mrkdwn', text: `*Day 7 (Expired):*\n${sent.day7} sent` },
                  { type: 'mrkdwn', text: `*Eligible Users:*\n${eligibleUsers.length}` },
                ],
              },
              ...(errors.length > 0 ? [{
                type: 'context' as const,
                elements: [{ type: 'mrkdwn' as const, text: `Errors: ${errors.length}` }],
              }] : []),
            ],
          }],
        }),
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      eligibleUsers: eligibleUsers.length,
      sent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    captureApiError(error, 'cron-onboarding-drip');
    return NextResponse.json({ error: 'Onboarding drip cron failed' }, { status: 500 });
  }
}
