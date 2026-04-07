import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Churn Prevention Cron — Weekly Wednesday 10AM UTC
// Re-engages Pro/Report users who haven't been active in 14+ days.
// Sends personalized email with recent deals from their most-used TA.
// ---------------------------------------------------------------------------

const BASE_URL = 'https://calculator.ambrosiaventures.co';

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

function buildChurnEmail(
  name: string,
  ta: string,
  dealCount: number,
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
    subject: `${dealCount} new deal${dealCount !== 1 ? 's' : ''} in ${taLabel} this week — benchmarks updated`,
    html: `<!DOCTYPE html>
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
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        We noticed you have not checked your benchmarks recently. Here is what changed in <strong style="color: #14b8a6;">${taLabel}</strong>:
      </p>

      <!-- Deal summary -->
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; margin: 20px 0;">
        <div style="padding: 12px 16px; background: #14b8a610; border-bottom: 1px solid #1e293b;">
          <strong style="color: #14b8a6; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Recent ${taLabel} Deals</strong>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${dealRows}
        </table>
      </div>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 16px 0;">
        Your Pro account includes real-time access to these benchmarks. Updated deal data means more accurate valuations for your current negotiations.
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${BASE_URL}/calculator" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px; letter-spacing: 0.2px;">
          View Updated Benchmarks
        </a>
      </div>

      <p style="color: #64748b; font-size: 13px; margin: 24px 0 0; border-top: 1px solid #1e293b; padding-top: 16px;">
        Need help with a specific deal? Reply to this email and our advisory team will follow up.
      </p>

      <p style="color: #94a3b8; font-size: 15px; margin: 16px 0 0;">
        Best,<br>
        <strong style="color: #e2e8f0;">The Ambrosia Ventures Team</strong>
      </p>
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
</html>`,
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
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 1. Get all Pro/Report users
    const { data: proUsers } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, tier')
      .in('tier', ['pro', 'report']);

    if (!proUsers || proUsers.length === 0) {
      return NextResponse.json({ success: true, message: 'No Pro/Report users', atRisk: 0, emailsSent: 0 });
    }

    const userIds = proUsers.map(u => u.id);

    // 2. Get last calculation per user
    const { data: recentCalcs } = await supabase
      .from('calculations')
      .select('user_id, created_at, therapeutic_area')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    const lastCalcMap = new Map<string, { date: string; ta: string }>();
    const taCountMap = new Map<string, Map<string, number>>();
    if (recentCalcs) {
      for (const calc of recentCalcs) {
        if (!calc.user_id) continue;
        // Track last calculation date
        if (!lastCalcMap.has(calc.user_id)) {
          lastCalcMap.set(calc.user_id, { date: calc.created_at, ta: calc.therapeutic_area || 'oncology' });
        }
        // Track TA usage counts for most-used TA
        if (!taCountMap.has(calc.user_id)) taCountMap.set(calc.user_id, new Map());
        const userTaCounts = taCountMap.get(calc.user_id)!;
        const ta = calc.therapeutic_area || 'oncology';
        userTaCounts.set(ta, (userTaCounts.get(ta) || 0) + 1);
      }
    }

    // 3. Get last login from Supabase Auth
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const loginMap = new Map<string, string | null>();
    for (const au of authData?.users || []) {
      if (au.id) loginMap.set(au.id, au.last_sign_in_at || null);
    }

    // 4. Check which users already received a churn prevention email in the last 14 days
    const { data: recentChurnEmails } = await supabase
      .from('events')
      .select('user_id')
      .eq('event_type', 'churn_prevention_sent')
      .gte('created_at', fourteenDaysAgo.toISOString())
      .in('user_id', userIds);

    const recentlyEmailedSet = new Set((recentChurnEmails || []).map(e => e.user_id));

    // 5. Identify at-risk users
    const atRiskUsers: typeof proUsers = [];
    for (const user of proUsers) {
      // Skip if already sent churn email in last 14 days
      if (recentlyEmailedSet.has(user.id)) continue;

      const lastCalc = lastCalcMap.get(user.id);
      const lastLogin = loginMap.get(user.id);

      const lastCalcDate = lastCalc ? new Date(lastCalc.date) : null;
      const lastLoginDate = lastLogin ? new Date(lastLogin) : null;

      const calcInactive = !lastCalcDate || lastCalcDate < fourteenDaysAgo;
      const loginInactive = !lastLoginDate || lastLoginDate < fourteenDaysAgo;

      if (calcInactive && loginInactive) {
        atRiskUsers.push(user);
      }
    }

    let emailsSent = 0;
    const errors: string[] = [];

    for (const user of atRiskUsers) {
      try {
        // Determine most-used TA
        const userTaCounts = taCountMap.get(user.id);
        let topTa = 'oncology'; // default
        if (userTaCounts && userTaCounts.size > 0) {
          let maxCount = 0;
          for (const [ta, count] of userTaCounts) {
            if (count > maxCount) {
              maxCount = count;
              topTa = ta;
            }
          }
        }

        // Get deals ACTUALLY announced in the last 7 days (not just ingested)
        // This prevents old backfilled deals from being shown as "new"
        const sevenDaysAgoDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { data: recentDeals } = await supabase
          .from('deals')
          .select('licensee, licensor, total_deal_value, deal_type, announced_date')
          .eq('therapeutic_area', topTa)
          .gte('announced_date', sevenDaysAgoDate)
          .order('total_deal_value', { ascending: false, nullsFirst: false })
          .limit(5);

        // If no deals in last 7 days, get most recent deals in that TA
        let dealsToShow = recentDeals || [];
        let dealCount = dealsToShow.length;

        if (dealsToShow.length === 0) {
          // Fallback: most recent deals by announced_date (not ingestion date)
          const { data: fallbackDeals } = await supabase
            .from('deals')
            .select('licensee, licensor, total_deal_value, deal_type, announced_date')
            .eq('therapeutic_area', topTa)
            .order('announced_date', { ascending: false, nullsFirst: false })
            .limit(3);
          dealsToShow = fallbackDeals || [];
          dealCount = dealsToShow.length;
        }

        // Only send if we have deals to show
        if (dealsToShow.length === 0) continue;

        const displayName = user.full_name || user.email;
        const { subject, html } = buildChurnEmail(displayName, topTa, dealCount, dealsToShow);
        const result = await sendEmail({ to: user.email, subject, html });

        if (result.success) {
          await supabase.from('events').insert({
            user_id: user.id,
            event_type: 'churn_prevention_sent',
            event_data: {
              user_email: user.email,
              therapeutic_area: topTa,
              deals_shown: dealCount,
            },
          });
          emailsSent++;
        } else {
          errors.push(`Failed for ${user.email}: ${result.error}`);
        }
      } catch (err) {
        errors.push(`Error processing ${user.email}: ${String(err)}`);
      }
    }

    // 8. Slack summary
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Churn prevention: ${atRiskUsers.length} at-risk Pro users, ${emailsSent} emails sent`,
          attachments: [{
            color: '#f59e0b',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: 'Churn Prevention Report', emoji: true } },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Total Pro/Report Users:*\n${proUsers.length}` },
                  { type: 'mrkdwn', text: `*At-Risk (14d inactive):*\n${atRiskUsers.length}` },
                  { type: 'mrkdwn', text: `*Emails Sent:*\n${emailsSent}` },
                  { type: 'mrkdwn', text: `*Errors:*\n${errors.length}` },
                ],
              },
              ...(atRiskUsers.length > 0 ? [{
                type: 'context' as const,
                elements: [{
                  type: 'mrkdwn' as const,
                  text: `At-risk: ${atRiskUsers.slice(0, 10).map(u => u.email).join(', ')}${atRiskUsers.length > 10 ? ` +${atRiskUsers.length - 10} more` : ''}`,
                }],
              }] : []),
            ],
          }],
        }),
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      totalProUsers: proUsers.length,
      atRiskUsers: atRiskUsers.length,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    captureApiError(error, 'cron-churn-prevention');
    return NextResponse.json({ error: 'Churn prevention cron failed' }, { status: 500 });
  }
}
