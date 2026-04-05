import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatDollars(amount: number | null): string {
  if (amount == null) return 'Undisclosed';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(): string {
  return new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// ─── ALERT EMAIL TEMPLATE ─────────────────────────────────────────────────────

function buildAlertEmailHtml(deal: {
  licensor_name: string;
  licensee_name: string;
  therapeutic_area: string;
  modality: string;
  indication_specific: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  announced_date: string;
  asset_name: string | null;
}, userName: string): string {
  const ta = formatLabel(deal.therapeutic_area);
  const upfront = formatDollars(deal.upfront_usd);
  const totalValue = formatDollars(deal.total_deal_value_usd);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">New ${ta} Deal Announced</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">${deal.licensor_name} &times; ${deal.licensee_name}</p>
        </div>

        <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
          <p style="font-size: 16px;">Hi ${userName},</p>

          <p>A new deal was just announced in <strong>${ta}</strong> &mdash; a therapeutic area you've been benchmarking.</p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #14b8a6;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 120px;">Licensor</td>
                <td style="padding: 6px 0; font-weight: 600;">${deal.licensor_name}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Licensee</td>
                <td style="padding: 6px 0; font-weight: 600;">${deal.licensee_name}</td>
              </tr>
              ${deal.asset_name ? `<tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Asset</td>
                <td style="padding: 6px 0;">${deal.asset_name}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Modality</td>
                <td style="padding: 6px 0;">${formatLabel(deal.modality)}</td>
              </tr>
              ${deal.indication_specific ? `<tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Indication</td>
                <td style="padding: 6px 0;">${formatLabel(deal.indication_specific)}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Upfront</td>
                <td style="padding: 6px 0; font-weight: 700; color: #14b8a6;">${upfront}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Total Value</td>
                <td style="padding: 6px 0; font-weight: 700; color: #16a34a;">${totalValue}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Announced</td>
                <td style="padding: 6px 0;">${deal.announced_date}</td>
              </tr>
            </table>
          </div>

          <p><strong>Your negotiating leverage may have changed.</strong> This deal could shift the benchmark ranges for ${ta} assets at your stage. Run an updated calculation to see where your deal stands.</p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="https://calculator.ambrosiaventures.co" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
              See Updated Benchmarks
            </a>
          </div>

          <p style="margin-top: 24px; color: #64748b; font-size: 13px;">
            You're receiving this because you've run calculations in ${ta}. Manage alert preferences in your account settings.
          </p>
        </div>

        <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">
            Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6;">ambrosiaventures.co</a>
          </p>
          <p style="margin: 8px 0 0;">
            <a href="https://calculator.ambrosiaventures.co/unsubscribe" style="color: #64748b;">Unsubscribe</a>
          </p>
        </div>
      </body>
    </html>
  `;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
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
    // Weekly window: deals actually announced in the last 7 days (not just ingested recently).
    // This prevents backfilled deals from being surfaced as "new" to users.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const sevenDaysAgoTs = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // ── 1. Find deals announced in the last 7 days (both announced + ingested recently) ──
    const { data: newDeals, error: dealsError } = await supabase
      .from('deals')
      .select('id, licensor_name, licensee_name, therapeutic_area, modality, indication_specific, upfront_usd, total_deal_value_usd, announced_date, asset_name')
      .gte('announced_date', sevenDaysAgo)
      .gte('created_at', sevenDaysAgoTs)
      .not('therapeutic_area', 'is', null)
      .not('therapeutic_area', 'eq', 'other')
      .order('total_deal_value_usd', { ascending: false, nullsFirst: false });

    if (dealsError) {
      console.error('[Competitor Deal Alert] Deals query error:', dealsError);
      return NextResponse.json({ error: 'Deals query failed' }, { status: 500 });
    }

    if (!newDeals || newDeals.length === 0) {
      return NextResponse.json({ success: true, message: 'No new deals in window', usersNotified: 0, dealsProcessed: 0 });
    }

    // ── 2. Deduplicate: check which deals already had alerts sent ───────
    const dealIds = newDeals.map((d) => d.id);
    const { data: existingAlerts } = await supabase
      .from('events')
      .select('event_data')
      .eq('event_type', 'competitor_deal_alert')
      .in('event_data->>deal_id', dealIds);

    const alreadyAlertedDealIds = new Set(
      (existingAlerts || []).map((e) => {
        const data = typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data;
        return data.deal_id;
      })
    );

    const unalertedDeals = newDeals.filter((d) => !alreadyAlertedDealIds.has(d.id));
    if (unalertedDeals.length === 0) {
      return NextResponse.json({ success: true, message: 'All new deals already alerted', usersNotified: 0, dealsProcessed: 0 });
    }

    // ── 3. Collect unique TAs from new deals ────────────────────────────
    const dealTAs = [...new Set(unalertedDeals.map((d) => d.therapeutic_area).filter(Boolean))];

    // ── 4. Find Pro/Report users who have calculated in those TAs ───────
    const { data: matchingCalcs } = await supabase
      .from('calculations')
      .select('user_id, therapeutic_area')
      .in('therapeutic_area', dealTAs)
      .not('user_id', 'is', null);

    if (!matchingCalcs || matchingCalcs.length === 0) {
      // No users have calculated in these TAs — still log & notify Slack
      await sendSlackSummary(0, unalertedDeals.length, unalertedDeals);
      return NextResponse.json({ success: true, message: 'No matching users', usersNotified: 0, dealsProcessed: unalertedDeals.length });
    }

    // Build map: TA → unique user IDs
    const taToUserIds = new Map<string, Set<string>>();
    for (const calc of matchingCalcs) {
      if (!calc.user_id || !calc.therapeutic_area) continue;
      if (!taToUserIds.has(calc.therapeutic_area)) {
        taToUserIds.set(calc.therapeutic_area, new Set());
      }
      taToUserIds.get(calc.therapeutic_area)!.add(calc.user_id);
    }

    // Collect all unique user IDs that need notification
    const allUserIds = new Set<string>();
    for (const deal of unalertedDeals) {
      const users = taToUserIds.get(deal.therapeutic_area);
      if (users) {
        for (const uid of users) allUserIds.add(uid);
      }
    }

    if (allUserIds.size === 0) {
      await sendSlackSummary(0, unalertedDeals.length, unalertedDeals);
      return NextResponse.json({ success: true, message: 'No matching users', usersNotified: 0, dealsProcessed: unalertedDeals.length });
    }

    // ── 5. Fetch user profiles (Pro/Report only) ────────────────────────
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, tier')
      .in('id', Array.from(allUserIds))
      .in('tier', ['pro', 'report']);

    if (!users || users.length === 0) {
      await sendSlackSummary(0, unalertedDeals.length, unalertedDeals);
      return NextResponse.json({ success: true, message: 'No Pro/Report users matched', usersNotified: 0, dealsProcessed: unalertedDeals.length });
    }

    const userMap = new Map(users.map((u) => [u.id, u]));

    // ── 6. Send personalized emails + track in events ───────────────────
    let totalEmailsSent = 0;
    let totalErrors = 0;
    const notifiedUserIds = new Set<string>();

    for (const deal of unalertedDeals) {
      const matchedUserIds = taToUserIds.get(deal.therapeutic_area);
      if (!matchedUserIds) continue;

      for (const userId of matchedUserIds) {
        const user = userMap.get(userId);
        if (!user) continue; // Not Pro/Report tier

        // Avoid sending same user multiple emails for same deal
        const alertKey = `${userId}:${deal.id}`;
        if (notifiedUserIds.has(alertKey)) continue;

        const ta = formatLabel(deal.therapeutic_area);
        const valueStr = deal.total_deal_value_usd
          ? formatDollars(deal.total_deal_value_usd)
          : deal.upfront_usd
            ? formatDollars(deal.upfront_usd)
            : 'Undisclosed';

        const subject = `New ${ta} deal: ${deal.licensor_name} \u00d7 ${deal.licensee_name} \u2014 ${valueStr}`;
        const userName = user.full_name || user.email.split('@')[0];

        const result = await sendEmail({
          to: user.email,
          subject,
          html: buildAlertEmailHtml(deal, userName),
        });

        if (result.success) {
          totalEmailsSent++;
          notifiedUserIds.add(alertKey);

          // Track in events table to prevent duplicates
          await supabase.from('events').insert({
            user_id: userId,
            event_type: 'competitor_deal_alert',
            event_data: {
              deal_id: deal.id,
              therapeutic_area: deal.therapeutic_area,
              licensor: deal.licensor_name,
              licensee: deal.licensee_name,
              email_sent: true,
            },
            user_tier: user.tier,
          });
        } else {
          totalErrors++;
          console.error(`[Competitor Deal Alert] Email failed for ${user.email}:`, result.error);
        }
      }
    }

    // ── 7. Slack summary ────────────────────────────────────────────────
    await sendSlackSummary(totalEmailsSent, unalertedDeals.length, unalertedDeals, totalErrors);

    return NextResponse.json({
      success: true,
      dealsProcessed: unalertedDeals.length,
      usersNotified: totalEmailsSent,
      errors: totalErrors,
    });
  } catch (error) {
    console.error('[Competitor Deal Alert] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ─── SLACK NOTIFICATION ───────────────────────────────────────────────────────

async function sendSlackSummary(
  usersNotified: number,
  dealsCount: number,
  deals: { licensor_name: string; licensee_name: string; therapeutic_area: string; total_deal_value_usd: number | null }[],
  errors: number = 0
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const dealLines = deals.slice(0, 5).map((d) => {
    const val = formatDollars(d.total_deal_value_usd);
    return `\u2022 ${d.licensor_name} \u00d7 ${d.licensee_name} (${formatLabel(d.therapeutic_area)}) \u2014 ${val}`;
  }).join('\n');

  const statusEmoji = errors > 0 ? ':warning:' : usersNotified > 0 ? ':bell:' : ':zzz:';
  const color = errors > 0 ? '#f59e0b' : usersNotified > 0 ? '#14b8a6' : '#64748b';

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `${statusEmoji} Deal Alert: ${usersNotified} users notified about ${dealsCount} new deal(s)`,
      attachments: [{
        color,
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: `Competitor Deal Alert \u2014 ${dealsCount} New Deal(s)` } },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Users Notified:*\n${usersNotified}` },
              { type: 'mrkdwn', text: `*Deals Processed:*\n${dealsCount}` },
              { type: 'mrkdwn', text: `*Errors:*\n${errors}` },
            ],
          },
          ...(dealLines ? [{
            type: 'section' as const,
            text: { type: 'mrkdwn' as const, text: `*Deals:*\n${dealLines}` },
          }] : []),
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: formatTimestamp() }],
          },
        ],
      }],
    }),
  }).catch((err) => console.error('[Competitor Deal Alert] Slack error:', err));
}
