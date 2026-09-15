import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';
import { dripSuppressionFilter } from '@/lib/email/drip-suppression';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const BASE_URL = 'https://solidus.ambrosiaventures.co';
const MAX_EMAILS_PER_RUN = 50;

// ---------------------------------------------------------------------------
// Post-Trial Drip Cron — runs daily at 10 AM UTC
//
// Targets users whose Pro trial expired 1-14 days ago and who haven't
// converted to a paid subscription. Sends 3 time-sequenced emails:
//   Day 1-2:  "Here's what you're missing" — feature highlights
//   Day 5-7:  "Still benchmarking?" — social proof + data hook
//   Day 12-14: "Last chance" — limited-time incentive
//
// Dedup: tracks via events table (post_trial_drip_day1, _day5). Any account the
// founder-led trial sequence has touched (trial_seq_*) is skipped entirely.
// ---------------------------------------------------------------------------

interface ExpiredTrialUser {
  id: string;
  email: string;
  full_name: string | null;
  pro_expires_at: string;
  subscription_status: string | null;
}

function daysSinceExpiry(proExpiresAt: string, now: Date): number {
  const expiry = new Date(proExpiresAt);
  return Math.floor((now.getTime() - expiry.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Email builders
// ---------------------------------------------------------------------------

function buildDay1Email(name: string, calcCount: number): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || 'there';
  const calcLine = calcCount > 0
    ? `During your trial, you ran <strong>${calcCount} calculation${calcCount !== 1 ? 's' : ''}</strong>. Those analyses — and all the Pro features behind them — are now locked.`
    : 'Your Pro access has expired, and the advanced features you had access to are now locked.';

  return {
    subject: 'Your trial ended — here\'s what you\'re missing',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background-color:#0b1120; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width:600px; margin:0 auto; padding:24px;">
    <div style="text-align:center; padding:32px 24px; background:linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius:16px 16px 0 0; border:1px solid #1e3a5f; border-bottom:none;">
      <img src="${BASE_URL}/icon-color.png" alt="Ambrosia Ventures" width="48" height="48" style="margin-bottom:16px;">
      <h1 style="color:#fff; margin:0; font-size:22px; font-weight:700;">Your Trial Ended</h1>
      <p style="color:#94a3b8; margin:8px 0 0; font-size:14px;">Here's what you're missing</p>
    </div>

    <div style="background:#111827; padding:32px; border:1px solid #1e3a5f; border-top:none; border-radius:0 0 16px 16px;">
      <p style="color:#e2e8f0; font-size:16px; margin:0 0 16px;">Hi ${firstName},</p>
      <p style="color:#94a3b8; font-size:15px; line-height:1.7; margin:0 0 16px;">${calcLine}</p>

      <div style="background:#0f172a; border:1px solid #1e293b; border-radius:12px; overflow:hidden; margin:20px 0;">
        <div style="padding:12px 16px; background:rgba(20,184,166,0.06); border-bottom:1px solid #1e293b;">
          <strong style="color:#14b8a6; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">Features You Lost Access To</strong>
        </div>
        <div style="padding:16px;">
          <table style="width:100%; border-collapse:collapse;">
            <tr><td style="padding:8px 0; color:#e2e8f0; font-size:14px;">rNPV modeling & Monte Carlo simulation</td></tr>
            <tr><td style="padding:8px 0; color:#e2e8f0; font-size:14px; border-top:1px solid #1e293b;">Partner matching across 700+ companies</td></tr>
            <tr><td style="padding:8px 0; color:#e2e8f0; font-size:14px; border-top:1px solid #1e293b;">AI deal memos & negotiation playbooks</td></tr>
            <tr><td style="padding:8px 0; color:#e2e8f0; font-size:14px; border-top:1px solid #1e293b;">PDF report exports for board decks</td></tr>
            <tr><td style="padding:8px 0; color:#e2e8f0; font-size:14px; border-top:1px solid #1e293b;">Scenario comparison & sensitivity analysis</td></tr>
          </table>
        </div>
      </div>

      <p style="color:#94a3b8; font-size:15px; line-height:1.7; margin:16px 0;">
        Reactivate now and pick up right where you left off — your saved calculations and preferences are still there.
      </p>

      <div style="text-align:center; margin:28px 0;">
        <a href="${BASE_URL}/pro" style="display:inline-block; background:linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color:#fff; padding:14px 36px; text-decoration:none; border-radius:12px; font-weight:600; font-size:15px;">
          Reactivate Pro — $199/mo annual
        </a>
      </div>

      <p style="color:#64748b; font-size:13px; text-align:center; margin:16px 0 0;">Cancel anytime. No long-term commitment.</p>

      <p style="color:#94a3b8; font-size:15px; margin:20px 0 0;">
        Best,<br>
        <strong style="color:#e2e8f0;">The Ambrosia Ventures Team</strong>
      </p>
    </div>

    <div style="text-align:center; padding:24px; color:#475569; font-size:12px; line-height:1.5;">
      <p style="margin:0;">Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color:#14b8a6; text-decoration:none;">ambrosiaventures.co</a></p>
      <p style="margin:8px 0 0;"><a href="${BASE_URL}/unsubscribe" style="color:#475569; text-decoration:underline;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`,
  };
}

function buildDay5Email(firstName: string, topTa: string, recentDealCount: number): { subject: string; html: string } {
  const name = firstName || 'there';
  const taLabel = topTa
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, s => s.toUpperCase())
    .trim();

  return {
    subject: 'Still benchmarking deals?',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background-color:#0b1120; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width:600px; margin:0 auto; padding:24px;">
    <div style="text-align:center; padding:32px 24px; background:linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius:16px 16px 0 0; border:1px solid #1e3a5f; border-bottom:none;">
      <img src="${BASE_URL}/icon-color.png" alt="Ambrosia Ventures" width="48" height="48" style="margin-bottom:16px;">
      <h1 style="color:#fff; margin:0; font-size:22px; font-weight:700;">Still Benchmarking Deals?</h1>
    </div>

    <div style="background:#111827; padding:32px; border:1px solid #1e3a5f; border-top:none; border-radius:0 0 16px 16px;">
      <p style="color:#e2e8f0; font-size:16px; margin:0 0 16px;">Hi ${name},</p>

      <p style="color:#94a3b8; font-size:15px; line-height:1.7; margin:0 0 16px;">
        Quick update: <strong style="color:#14b8a6;">${recentDealCount} new ${taLabel} deals</strong> were added to Solidus this month. If you're still working on a transaction, the benchmarks have shifted.
      </p>

      <div style="background:#0f172a; border:1px solid #1e293b; border-radius:12px; padding:20px; margin:20px 0;">
        <p style="color:#14b8a6; font-size:13px; text-transform:uppercase; letter-spacing:0.5px; margin:0 0 12px; font-weight:600;">Why Teams Choose Pro</p>
        <table style="width:100%; border-collapse:collapse;">
          <tr><td style="padding:6px 0; color:#e2e8f0; font-size:14px;">BD teams at 12 of the top 20 pharma companies use deal benchmarks for board presentations</td></tr>
          <tr><td style="padding:6px 0; color:#e2e8f0; font-size:14px; border-top:1px solid #1e293b;">Average Pro user runs 8 calculations per month across 3 therapeutic areas</td></tr>
          <tr><td style="padding:6px 0; color:#e2e8f0; font-size:14px; border-top:1px solid #1e293b;">Deal memos generated in under 60 seconds — no more 2-week turnaround</td></tr>
        </table>
      </div>

      <div style="text-align:center; margin:28px 0;">
        <a href="${BASE_URL}/pro" style="display:inline-block; background:linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color:#fff; padding:14px 36px; text-decoration:none; border-radius:12px; font-weight:600; font-size:15px;">
          Reactivate Pro
        </a>
      </div>

      <p style="color:#64748b; font-size:13px; text-align:center; margin:16px 0 0;">
        $299/mo or $199/mo on the annual plan — cancel anytime.
      </p>

      <p style="color:#94a3b8; font-size:15px; margin:20px 0 0;">
        Best,<br>
        <strong style="color:#e2e8f0;">The Ambrosia Ventures Team</strong>
      </p>
    </div>

    <div style="text-align:center; padding:24px; color:#475569; font-size:12px; line-height:1.5;">
      <p style="margin:0;">Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color:#14b8a6; text-decoration:none;">ambrosiaventures.co</a></p>
      <p style="margin:8px 0 0;"><a href="${BASE_URL}/unsubscribe" style="color:#475569; text-decoration:underline;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`,
  };
}

// Day-12 discount email removed (Sep 2026): the trial sequence holds full price.

// ---------------------------------------------------------------------------
// Cron handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Auth — same pattern as other crons
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const isValid = token.length === cronSecret.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const results = {
      day1Sent: 0,
      day5Sent: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Find users whose trial expired 1-14 days ago and who are now on free tier
    // with subscription_status = 'expired' (set by pro-expiration cron)
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: expiredUsers } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, pro_expires_at, subscription_status')
      .eq('tier', 'free')
      .eq('subscription_status', 'expired')
      .not('pro_expires_at', 'is', null)
      .gte('pro_expires_at', fourteenDaysAgo.toISOString())
      .lte('pro_expires_at', oneDayAgo.toISOString())
      // Skip accounts on a founder-led personal sequence (migration 108)
      .or(dripSuppressionFilter(now));

    if (!expiredUsers || expiredUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired trial users in window',
        ...results,
      });
    }

    // Filter out anyone who has since converted to a paid subscription
    // (check for active Stripe subscriptions via subscription_status)
    const eligibleUsers: ExpiredTrialUser[] = expiredUsers.filter(
      u => u.email && u.subscription_status === 'expired'
    );

    if (eligibleUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All expired trial users have converted',
        ...results,
      });
    }

    // Get existing drip events to avoid duplicates
    const userIds = eligibleUsers.map(u => u.id);
    const { data: existingEvents } = await supabase
      .from('events')
      .select('user_id, event_type')
      .in('user_id', userIds)
      .in('event_type', ['post_trial_drip_day1', 'post_trial_drip_day5', 'trial_seq_t1', 'trial_seq_t2', 'trial_seq_t3']);

    const sentMap = new Map<string, Set<string>>();
    for (const event of existingEvents || []) {
      if (!sentMap.has(event.user_id)) sentMap.set(event.user_id, new Set());
      sentMap.get(event.user_id)!.add(event.event_type);
    }
    // The founder-led trial sequence owns any account it has emailed.
    const sequenceOwned = new Set<string>();
    for (const [uid, types] of sentMap) {
      if ([...types].some(t => t.startsWith('trial_seq_'))) sequenceOwned.add(uid);
    }

    // Get calculation counts per user for personalization
    const { data: calcCounts } = await supabase
      .from('calculations')
      .select('user_id, therapeutic_area')
      .in('user_id', userIds);

    const userCalcMap = new Map<string, { count: number; topTa: string }>();
    for (const calc of calcCounts || []) {
      if (!calc.user_id) continue;
      const existing = userCalcMap.get(calc.user_id);
      if (existing) {
        existing.count++;
      } else {
        userCalcMap.set(calc.user_id, { count: 1, topTa: calc.therapeutic_area || 'oncology' });
      }
    }

    // Get recent deal counts by TA for the day-5 email
    const { data: recentDeals } = await supabase
      .from('deals')
      .select('therapeutic_area')
      .eq('is_synthetic', false)
      .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const taDealCounts = new Map<string, number>();
    for (const deal of recentDeals || []) {
      const ta = deal.therapeutic_area || 'oncology';
      taDealCounts.set(ta, (taDealCounts.get(ta) || 0) + 1);
    }

    let emailsSent = 0;

    for (const user of eligibleUsers) {
      if (emailsSent >= MAX_EMAILS_PER_RUN) break;
      if (sequenceOwned.has(user.id)) { results.skipped++; continue; }

      const days = daysSinceExpiry(user.pro_expires_at, now);
      const sent = sentMap.get(user.id) || new Set();
      const firstName = user.full_name?.split(' ')[0] || '';
      const calcInfo = userCalcMap.get(user.id) || { count: 0, topTa: 'oncology' };

      try {
        // Day 1-2: Feature highlights
        if (days >= 1 && days <= 2 && !sent.has('post_trial_drip_day1')) {
          const { subject, html } = buildDay1Email(
            user.full_name || user.email,
            calcInfo.count,
          );
          const result = await sendEmail({ to: user.email, subject, html });

          if (result.success) {
            await supabase.from('events').insert({
              user_id: user.id,
              event_type: 'post_trial_drip_day1',
              event_data: {
                email: user.email,
                days_since_expiry: days,
                calc_count: calcInfo.count,
              },
            });
            results.day1Sent++;
            emailsSent++;
          } else {
            results.errors.push(`Day1 failed for ${user.email}: ${result.error}`);
          }
        }

        // Day 5-7: Social proof + data hook
        else if (days >= 5 && days <= 7 && !sent.has('post_trial_drip_day5')) {
          const recentDealCount = taDealCounts.get(calcInfo.topTa) || taDealCounts.get('oncology') || 12;

          const { subject, html } = buildDay5Email(
            firstName,
            calcInfo.topTa,
            recentDealCount,
          );
          const result = await sendEmail({ to: user.email, subject, html });

          if (result.success) {
            await supabase.from('events').insert({
              user_id: user.id,
              event_type: 'post_trial_drip_day5',
              event_data: {
                email: user.email,
                days_since_expiry: days,
                therapeutic_area: calcInfo.topTa,
              },
            });
            results.day5Sent++;
            emailsSent++;
          } else {
            results.errors.push(`Day5 failed for ${user.email}: ${result.error}`);
          }
        }
        // Day 12-14 incentive email removed (Sep 2026).
        else {
          results.skipped++;
        }
      } catch (err) {
        results.errors.push(`Error processing ${user.email}: ${String(err)}`);
      }
    }

    // Slack notification
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl && emailsSent > 0) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Post-trial drip: ${emailsSent} emails sent`,
          attachments: [{
            color: '#f59e0b',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: 'Post-Trial Drip Report' } },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Eligible:*\n${eligibleUsers.length}` },
                  { type: 'mrkdwn', text: `*Day 1-2 (Features):*\n${results.day1Sent}` },
                  { type: 'mrkdwn', text: `*Day 5-7 (Social Proof):*\n${results.day5Sent}` },
                  
                ],
              },
            ],
          }],
        }),
      }).then(() => {}, () => {});
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'post-trial-drip', {
        processed: eligibleUsers.length,
        inserted: emailsSent,
        skipped: results.skipped,
        errors: results.errors.length,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      eligible: eligibleUsers.length,
      ...results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    captureApiError(error, 'cron-post-trial-drip');
    return NextResponse.json({ error: 'Post-trial drip cron failed' }, { status: 500 });
  }
}
