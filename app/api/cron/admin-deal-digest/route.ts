/**
 * Weekly Deal Digest — runs every Monday at 08:00 UTC.
 *
 * Sends a single consolidated Slack notification with:
 * - Total deals ingested in the last 7 days
 * - Breakdown by source (SEC, press, Perplexity, OpenFDA)
 * - Breakdown by therapeutic area
 * - Top 10 deals by value
 * - Verification status summary
 *
 * Replaces per-run notifications that were too frequent and duplicative.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

export const maxDuration = 30;

function formatValue(amount: number | null): string {
  if (amount == null) return 'Undisclosed';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  return `$${amount.toFixed(0)}`;
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

  const supabase = createServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Last 7 days of deals
  const { data: newDeals } = await supabase
    .from('deals')
    .select('licensor_name, licensee_name, total_deal_value_usd, therapeutic_area, source_type, verification_status, announced_date')
    .gte('created_at', weekAgo)
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false });

  const totalNew = newDeals?.length || 0;

  // Total in DB
  const { count: totalInDb } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true });

  // Breakdown by source
  const bySource: Record<string, number> = {};
  const byTA: Record<string, number> = {};
  const byVerification: Record<string, number> = { verified: 0, pending: 0, flagged: 0 };

  (newDeals || []).forEach(d => {
    bySource[d.source_type] = (bySource[d.source_type] || 0) + 1;
    if (d.therapeutic_area) byTA[d.therapeutic_area] = (byTA[d.therapeutic_area] || 0) + 1;
    const vs = d.verification_status || 'pending';
    if (byVerification[vs] !== undefined) byVerification[vs]++;
  });

  // Top 10 deals by value
  const topDeals = (newDeals || [])
    .filter(d => d.total_deal_value_usd && Number(d.total_deal_value_usd) > 0)
    .slice(0, 10);

  // Build Slack message
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ ok: true, sent: false, reason: 'no webhook' });
  }

  const sourceLines = Object.entries(bySource)
    .sort(([, a], [, b]) => b - a)
    .map(([src, count]) => `  ${src}: ${count}`)
    .join('\n');

  const taLines = Object.entries(byTA)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([ta, count]) => `  ${ta}: ${count}`)
    .join('\n');

  const topDealLines = topDeals
    .map((d, i) => `${i + 1}. ${d.licensor_name} → ${d.licensee_name} — ${formatValue(Number(d.total_deal_value_usd))}`)
    .join('\n');

  const blocks: object[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Weekly Deal Digest — ${totalNew} New`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*New this week:*\n${totalNew}` },
        { type: 'mrkdwn', text: `*Total in DB:*\n${(totalInDb || 0).toLocaleString()}` },
        { type: 'mrkdwn', text: `*Verified:*\n${byVerification.verified}` },
        { type: 'mrkdwn', text: `*Pending verification:*\n${byVerification.pending}` },
      ],
    },
  ];

  if (sourceLines) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*By source:*\n\`\`\`${sourceLines}\`\`\`` },
    });
  }

  if (taLines) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*By therapeutic area:*\n\`\`\`${taLines}\`\`\`` },
    });
  }

  if (topDealLines) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Top deals this week:*\n${topDealLines}` },
    });
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: 'Weekly digest — next one in 7 days. High-value deals (>$500M) still alert in real-time.' }],
  });

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `Weekly deal digest: ${totalNew} new deals`,
      attachments: [{ color: '#14b8a6', blocks }],
    }),
  });

  return NextResponse.json({ ok: true, sent: true, totalNew, totalInDb });
}
