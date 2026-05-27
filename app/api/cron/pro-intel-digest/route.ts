import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { sendEmail } from '@/lib/email/client';
import { logCronRun } from '@/lib/cron-utils';
import { captureApiError } from '@/lib/sentry-api';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Pro Intelligence Digest — Mondays 1PM UTC
//
// Sends each Pro user a personalized weekly market intelligence email based
// on their most-used therapy areas (derived from calculation history).
//
// Content per user:
//   1. Top 2 therapy areas from their calculation events
//   2. New deals announced in those TAs in the last 7 days
//   3. Monthly calculation count + recent benchmark context
//
// Only sends if there are new deals to show — no empty digests.
//
// Cron config (vercel.json): "0 13 * * 1"
// Auth: Bearer $CRON_SECRET
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

interface DealRow {
  licensee: string | null;
  licensor: string | null;
  total_deal_value: number | null;
  deal_type: string | null;
  therapeutic_area: string | null;
  announced_date: string | null;
}

function buildDigestEmail(
  firstName: string,
  ta1: string,
  ta2: string | null,
  deals: DealRow[],
  monthlyCalcCount: number,
  unsubscribeEmail: string,
): { subject: string; html: string } {
  const ta1Label = formatLabel(ta1);
  const ta2Label = ta2 ? formatLabel(ta2) : null;
  const taDisplay = ta2Label ? `${ta1Label} & ${ta2Label}` : ta1Label;

  const dealRows = deals.slice(0, 6).map(d => {
    const taLabel = formatLabel(d.therapeutic_area || 'unknown');
    const dealTypeLabel = formatLabel(d.deal_type || 'licensing');
    const dateStr = d.announced_date
      ? new Date(d.announced_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';

    return `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #1e293b;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <strong style="color: #e2e8f0; font-size: 14px;">${d.licensor || 'Undisclosed'} &rarr; ${d.licensee || 'Undisclosed'}</strong>
              <p style="color: #64748b; font-size: 12px; margin: 4px 0 0;">
                ${dealTypeLabel} | ${taLabel}${dateStr ? ` | ${dateStr}` : ''}
              </p>
            </div>
            <span style="color: #14b8a6; font-size: 14px; font-weight: 600; white-space: nowrap; margin-left: 12px;">${formatDealValue(d.total_deal_value)}</span>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Determine a market signal based on the deals
  const avgValue = deals.reduce((sum, d) => sum + (d.total_deal_value || 0), 0) / (deals.length || 1);
  let marketSignal: string;
  if (deals.length >= 5) {
    marketSignal = `${ta1Label} saw ${deals.length} new deals this week, signaling sustained dealmaking activity.`;
  } else if (avgValue >= 1e9) {
    marketSignal = `Average deal size in ${ta1Label} this week: ${formatDealValue(avgValue)} — large-cap transactions dominating.`;
  } else if (deals.length >= 3) {
    marketSignal = `Steady flow of ${deals.length} deals in ${ta1Label} this week across multiple deal types.`;
  } else {
    marketSignal = `${deals.length} new deal${deals.length !== 1 ? 's' : ''} in ${ta1Label} — track emerging opportunities with updated benchmarks.`;
  }

  return {
    subject: `Your weekly deal intelligence -- ${taDisplay}`,
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
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">Weekly Deal Intelligence</h1>
      <p style="color: #14b8a6; margin: 8px 0 0; font-size: 14px; font-weight: 600;">${taDisplay}</p>
    </div>

    <!-- Body -->
    <div style="background: #111827; padding: 32px; border: 1px solid #1e3a5f; border-top: none; border-radius: 0 0 16px 16px;">
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">${firstName ? `${firstName}, here` : 'Here'} is what moved in your focus areas this week:</p>

      <!-- New Deals -->
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; margin: 20px 0;">
        <div style="padding: 12px 16px; background: #14b8a610; border-bottom: 1px solid #1e293b;">
          <strong style="color: #14b8a6; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">New Deals This Week</strong>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${dealRows || '<tr><td style="padding: 16px; color: #64748b;">No new deals this week.</td></tr>'}
        </table>
      </div>

      <!-- Market Signal -->
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
        <p style="color: #14b8a6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px;">Market Signal</p>
        <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6; margin: 0;">${marketSignal}</p>
      </div>

      <!-- Your Benchmarks -->
      ${monthlyCalcCount > 0 ? `
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
        <p style="color: #14b8a6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px;">Your Activity</p>
        <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6; margin: 0;">
          You have modeled <strong style="color: #14b8a6;">${monthlyCalcCount}</strong> deal${monthlyCalcCount !== 1 ? 's' : ''} this month. Updated benchmark data is ready for your next analysis.
        </p>
      </div>` : ''}

      <div style="text-align: center; margin: 28px 0;">
        <a href="${BASE_URL}/calculator" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px; letter-spacing: 0.2px;">
          Model Another Deal
        </a>
      </div>

      <p style="color: #94a3b8; font-size: 15px; margin: 16px 0 0;">
        -- Ambrosia Intelligence Engine
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px; color: #475569; font-size: 12px; line-height: 1.5;">
      <p style="margin: 0;">Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6; text-decoration: none;">ambrosiaventures.co</a></p>
      <p style="margin: 8px 0 0;">
        <a href="${BASE_URL}/unsubscribe?email=${encodeURIComponent(unsubscribeEmail)}" style="color: #475569; text-decoration: underline;">Unsubscribe</a>
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
    if (!timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    // 1. Get all Pro users
    const { data: proUsers } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, tier')
      .eq('tier', 'pro');

    if (!proUsers || proUsers.length === 0) {
      return NextResponse.json({
        success: true,
        proUsers: 0,
        emailsSent: 0,
        message: 'No Pro users',
      });
    }

    const userIds = proUsers.map(u => u.id);

    // 2. Get calculation events for all Pro users (last 90 days for TA ranking)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);
    const { data: calcEvents } = await supabase
      .from('events')
      .select('user_id, event_data, created_at')
      .eq('event_type', 'calculation_completed')
      .in('user_id', userIds)
      .gte('created_at', ninetyDaysAgo.toISOString());

    // Build TA frequency maps per user + monthly calc count
    const userTaMap = new Map<string, Map<string, number>>();
    const userMonthlyCalcCount = new Map<string, number>();
    for (const event of calcEvents || []) {
      if (!event.user_id) continue;
      const data = (event.event_data || {}) as Record<string, unknown>;
      const ta = (data.therapeutic_area as string) || (data.therapeuticArea as string) || 'oncology';

      if (!userTaMap.has(event.user_id)) userTaMap.set(event.user_id, new Map());
      const taFreq = userTaMap.get(event.user_id)!;
      taFreq.set(ta, (taFreq.get(ta) || 0) + 1);

      // Count calculations in the last 30 days
      if (new Date(event.created_at) >= thirtyDaysAgo) {
        userMonthlyCalcCount.set(event.user_id, (userMonthlyCalcCount.get(event.user_id) || 0) + 1);
      }
    }

    // 3. Pre-fetch new deals from the last 7 days across all TAs
    const sevenDaysAgoDate = sevenDaysAgo.toISOString().split('T')[0];
    const { data: recentDeals } = await supabase
      .from('deals')
      .select('licensee, licensor, total_deal_value, deal_type, therapeutic_area, announced_date')
      .eq('is_synthetic', false)
      .gte('announced_date', sevenDaysAgoDate)
      .order('total_deal_value', { ascending: false, nullsFirst: false })
      .limit(200);

    // Group deals by TA
    const dealsByTa = new Map<string, DealRow[]>();
    for (const deal of recentDeals || []) {
      const ta = deal.therapeutic_area || 'other';
      if (!dealsByTa.has(ta)) dealsByTa.set(ta, []);
      dealsByTa.get(ta)!.push(deal);
    }

    // 4. Check which users already received a digest this week
    const { data: recentDigests } = await supabase
      .from('events')
      .select('user_id')
      .eq('event_type', 'pro_intel_digest_sent')
      .gte('created_at', sevenDaysAgo.toISOString())
      .in('user_id', userIds);

    const recentlyDigestedSet = new Set((recentDigests || []).map(e => e.user_id));

    let emailsSent = 0;
    let skippedNoDeals = 0;
    const errors: string[] = [];

    for (const user of proUsers) {
      if (recentlyDigestedSet.has(user.id)) {
        console.log(`[pro-intel-digest] Skipping ${user.email} — already sent this week`);
        continue;
      }

      if (!user.email) continue;

      try {
        // Get top 2 TAs for this user
        const taFreq = userTaMap.get(user.id);
        let ta1 = 'oncology';
        let ta2: string | null = null;

        if (taFreq && taFreq.size > 0) {
          const sorted = Array.from(taFreq.entries())
            .sort((a, b) => b[1] - a[1]);
          ta1 = sorted[0][0];
          ta2 = sorted.length > 1 ? sorted[1][0] : null;
        }

        // Collect deals from their TAs
        const ta1Deals = dealsByTa.get(ta1) || [];
        const ta2Deals = ta2 ? (dealsByTa.get(ta2) || []) : [];
        const combinedDeals = [...ta1Deals, ...ta2Deals]
          .sort((a, b) => (b.total_deal_value || 0) - (a.total_deal_value || 0))
          .slice(0, 6);

        // Only send if there are deals to show
        if (combinedDeals.length === 0) {
          skippedNoDeals++;
          continue;
        }

        const firstName = user.full_name?.split(' ')[0] || '';
        const monthlyCalcs = userMonthlyCalcCount.get(user.id) || 0;

        const { subject, html } = buildDigestEmail(
          firstName,
          ta1,
          ta2,
          combinedDeals,
          monthlyCalcs,
          user.email,
        );

        const result = await sendEmail({ to: user.email, subject, html });

        if (result.success) {
          await supabase.from('events').insert({
            event_type: 'pro_intel_digest_sent',
            event_data: {
              ta1,
              ta2,
              deals_shown: combinedDeals.length,
              monthly_calc_count: monthlyCalcs,
            },
            user_id: user.id,
            user_tier: 'pro',
          }).catch(() => {});

          emailsSent++;
          console.log(`[pro-intel-digest] Sent to ${user.email} (${ta1}${ta2 ? `/${ta2}` : ''}, ${combinedDeals.length} deals)`);
        } else {
          errors.push(`Email failed for ${user.email}: ${result.error}`);
        }
      } catch (err) {
        errors.push(`Error processing ${user.email}: ${String(err)}`);
      }
    }

    // Log cron run
    await logCronRun(supabase, 'pro-intel-digest', {
      fetched: proUsers.length,
      processed: proUsers.length - recentlyDigestedSet.size,
      inserted: emailsSent,
      errors,
      parameters: {
        totalDealsThisWeek: recentDeals?.length || 0,
        uniqueTAs: dealsByTa.size,
        skippedNoDeals,
      },
    });

    // Slack summary
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Pro intel digest: ${emailsSent}/${proUsers.length} Pro users emailed (${recentDeals?.length || 0} new deals across ${dealsByTa.size} TAs)`,
        }),
      }).catch(() => {});
    }

    console.log(`[pro-intel-digest] Done: ${proUsers.length} Pro users, ${emailsSent} emails sent, ${skippedNoDeals} skipped (no deals), ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      proUsers: proUsers.length,
      emailsSent,
      skippedNoDeals,
      skippedAlreadySent: recentlyDigestedSet.size,
      totalDealsThisWeek: recentDeals?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    captureApiError(error, 'cron-pro-intel-digest');
    return NextResponse.json({ error: 'Pro intel digest cron failed' }, { status: 500 });
  }
}
