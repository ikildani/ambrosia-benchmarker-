import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { GSCClient, type GSCPerformanceRow } from '@/lib/seo/gsc-client';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatTimestamp(): string {
  return new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+\u221e' : '0';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function stripDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url;
  }
}

// ─── AGGREGATION ──────────────────────────────────────────────────────────────

interface AggregatedMetrics {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
}

interface QueryMetrics {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

interface PageMetrics {
  page: string;
  clicks: number;
  impressions: number;
  position: number;
}

function aggregateRows(rows: GSCPerformanceRow[]): AggregatedMetrics {
  if (rows.length === 0) {
    return { totalClicks: 0, totalImpressions: 0, avgCtr: 0, avgPosition: 0 };
  }

  let totalClicks = 0;
  let totalImpressions = 0;
  let positionSum = 0;
  let positionCount = 0;

  for (const row of rows) {
    totalClicks += row.clicks;
    totalImpressions += row.impressions;
    if (row.impressions > 0) {
      positionSum += row.position * row.impressions;
      positionCount += row.impressions;
    }
  }

  return {
    totalClicks,
    totalImpressions,
    avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    avgPosition: positionCount > 0 ? positionSum / positionCount : 0,
  };
}

function topQueriesByClicks(rows: GSCPerformanceRow[], limit: number): QueryMetrics[] {
  const map = new Map<string, { clicks: number; impressions: number; positionWeighted: number }>();

  for (const row of rows) {
    const existing = map.get(row.query);
    if (existing) {
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
      existing.positionWeighted += row.position * row.impressions;
    } else {
      map.set(row.query, {
        clicks: row.clicks,
        impressions: row.impressions,
        positionWeighted: row.position * row.impressions,
      });
    }
  }

  return Array.from(map.entries())
    .map(([query, data]) => ({
      query,
      clicks: data.clicks,
      impressions: data.impressions,
      position: data.impressions > 0 ? data.positionWeighted / data.impressions : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit);
}

function topPagesByClicks(rows: GSCPerformanceRow[], limit: number): PageMetrics[] {
  const map = new Map<string, { clicks: number; impressions: number; positionWeighted: number }>();

  for (const row of rows) {
    const page = stripDomain(row.page);
    const existing = map.get(page);
    if (existing) {
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
      existing.positionWeighted += row.position * row.impressions;
    } else {
      map.set(page, {
        clicks: row.clicks,
        impressions: row.impressions,
        positionWeighted: row.position * row.impressions,
      });
    }
  }

  return Array.from(map.entries())
    .map(([page, data]) => ({
      page,
      clicks: data.clicks,
      impressions: data.impressions,
      position: data.impressions > 0 ? data.positionWeighted / data.impressions : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit);
}

function computePagePositionChanges(
  currentRows: GSCPerformanceRow[],
  previousRows: GSCPerformanceRow[]
): { rising: { page: string; oldPos: number; newPos: number; change: number }[]; declining: { page: string; oldPos: number; newPos: number; change: number }[] } {
  // Build position maps by page
  const buildPagePositionMap = (rows: GSCPerformanceRow[]): Map<string, { positionWeighted: number; impressions: number }> => {
    const map = new Map<string, { positionWeighted: number; impressions: number }>();
    for (const row of rows) {
      const page = stripDomain(row.page);
      const existing = map.get(page);
      if (existing) {
        existing.positionWeighted += row.position * row.impressions;
        existing.impressions += row.impressions;
      } else {
        map.set(page, { positionWeighted: row.position * row.impressions, impressions: row.impressions });
      }
    }
    return map;
  };

  const currentMap = buildPagePositionMap(currentRows);
  const previousMap = buildPagePositionMap(previousRows);

  const rising: { page: string; oldPos: number; newPos: number; change: number }[] = [];
  const declining: { page: string; oldPos: number; newPos: number; change: number }[] = [];

  for (const [page, currentData] of currentMap) {
    const previousData = previousMap.get(page);
    if (!previousData || previousData.impressions === 0 || currentData.impressions === 0) continue;

    const oldPos = previousData.positionWeighted / previousData.impressions;
    const newPos = currentData.positionWeighted / currentData.impressions;
    const change = oldPos - newPos; // Positive = improved (lower position number = better)

    if (Math.abs(change) > 3) {
      if (change > 0) {
        rising.push({ page, oldPos: Math.round(oldPos), newPos: Math.round(newPos), change: Math.round(change) });
      } else {
        declining.push({ page, oldPos: Math.round(oldPos), newPos: Math.round(newPos), change: Math.round(change) });
      }
    }
  }

  // Pages that dropped out of top 20
  for (const [page, previousData] of previousMap) {
    if (previousData.impressions === 0) continue;
    const oldPos = previousData.positionWeighted / previousData.impressions;
    if (oldPos > 20) continue; // Only care about pages that were in top 20

    const currentData = currentMap.get(page);
    if (!currentData || currentData.impressions === 0) {
      declining.push({
        page,
        oldPos: Math.round(oldPos),
        newPos: 0, // Dropped off entirely
        change: -Math.round(oldPos),
      });
    }
  }

  rising.sort((a, b) => b.change - a.change);
  declining.sort((a, b) => a.change - b.change);

  return { rising: rising.slice(0, 10), declining: declining.slice(0, 10) };
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
    const gsc = new GSCClient();

    // ── Check if GSC is configured ──────────────────────────────────────
    if (!gsc.isConfigured()) {
      await sendSlackMessage(
        ':warning: Weekly SEO Digest \u2014 GSC Not Configured',
        '#f59e0b',
        'Google Search Console credentials are not configured. Set `GOOGLE_SERVICE_ACCOUNT_JSON` env var to enable SEO performance tracking.',
      );

      return NextResponse.json({ success: true, message: 'GSC not configured' });
    }

    // ── Fetch performance data for current week and previous week ───────
    // GSC data has a ~2 day delay, so "last 7 days" = days 3-9 ago
    const currentWeekData = await gsc.getPerformanceData(9); // Last 9 days (includes 2-day delay buffer)
    const previousWeekData = await gsc.getPerformanceData(16); // Last 16 days

    // Split data: current = first 7 days of data, previous = next 7 days
    // Since getPerformanceData returns aggregated data, we query both periods
    // and compare. The GSC client returns combined query+page rows.
    // For a proper week-over-week, we need separate calls.
    // The GSC client aggregates across the entire period, so we use:
    //   currentWeek = 7-day data
    //   previousWeek = 14-day data minus 7-day data (approximate via separate call)

    const currentMetrics = aggregateRows(currentWeekData);

    // For previous week, subtract current from 14-day to approximate
    const twoWeekMetrics = aggregateRows(previousWeekData);
    const previousMetrics: AggregatedMetrics = {
      totalClicks: Math.max(0, twoWeekMetrics.totalClicks - currentMetrics.totalClicks),
      totalImpressions: Math.max(0, twoWeekMetrics.totalImpressions - currentMetrics.totalImpressions),
      avgCtr: twoWeekMetrics.avgCtr, // Approximation
      avgPosition: twoWeekMetrics.avgPosition, // Approximation
    };

    // ── Build top queries and pages ─────────────────────────────────────
    const topQueries = topQueriesByClicks(currentWeekData, 10);
    const topPages = topPagesByClicks(currentWeekData, 10);
    const { rising, declining } = computePagePositionChanges(currentWeekData, previousWeekData);

    // ── Build Slack message ─────────────────────────────────────────────
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const headerSection = [
      `*Clicks:* ${currentMetrics.totalClicks.toLocaleString()} (${pctChange(currentMetrics.totalClicks, previousMetrics.totalClicks)} vs prior week)`,
      `*Impressions:* ${currentMetrics.totalImpressions.toLocaleString()} (${pctChange(currentMetrics.totalImpressions, previousMetrics.totalImpressions)})`,
      `*Avg CTR:* ${(currentMetrics.avgCtr * 100).toFixed(2)}%`,
      `*Avg Position:* ${currentMetrics.avgPosition.toFixed(1)}`,
    ].join('\n');

    const queryLines = topQueries.length > 0
      ? topQueries.map((q, i) => `${i + 1}. \u201c${q.query}\u201d \u2014 ${q.clicks} clicks, pos ${q.position.toFixed(1)}`).join('\n')
      : '_No query data available_';

    const pageLines = topPages.length > 0
      ? topPages.map((p, i) => `${i + 1}. \`${p.page}\` \u2014 ${p.clicks} clicks`).join('\n')
      : '_No page data available_';

    const risingLines = rising.length > 0
      ? rising.map((r) => `\u2022 \`${r.page}\` \u2014 pos ${r.oldPos} \u2192 ${r.newPos} (+${r.change})`).join('\n')
      : '_No significant gains_';

    const decliningLines = declining.length > 0
      ? declining.map((d) => {
          if (d.newPos === 0) return `\u2022 \`${d.page}\` \u2014 pos ${d.oldPos} \u2192 dropped off`;
          return `\u2022 \`${d.page}\` \u2014 pos ${d.oldPos} \u2192 ${d.newPos} (${d.change})`;
        }).join('\n')
      : '_No significant drops_';

    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: `Weekly SEO Digest \u2014 ${dateStr}` } },
      { type: 'section', text: { type: 'mrkdwn', text: headerSection } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: `:mag: *Top Queries:*\n${queryLines}` } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: `:page_facing_up: *Top Pages:*\n${pageLines}` } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: `:chart_with_upwards_trend: *Rising Pages:*\n${risingLines}` } },
      { type: 'section', text: { type: 'mrkdwn', text: `:chart_with_downwards_trend: *Declining Pages:*\n${decliningLines}` } },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `${formatTimestamp()} | Data from Google Search Console | calculator.ambrosiaventures.co` }],
      },
    ];

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `:bar_chart: Weekly SEO Digest \u2014 ${currentMetrics.totalClicks} clicks, ${currentMetrics.totalImpressions.toLocaleString()} impressions`,
          attachments: [{
            color: '#2563eb',
            blocks,
          }],
        }),
      });
    }

    return NextResponse.json({
      success: true,
      metrics: {
        current: currentMetrics,
        previous: previousMetrics,
        topQueries: topQueries.length,
        topPages: topPages.length,
        risingPages: rising.length,
        decliningPages: declining.length,
      },
    });
  } catch (error) {
    console.error('[SEO Performance] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ─── SLACK HELPERS ────────────────────────────────────────────────────────────

async function sendSlackMessage(title: string, color: string, body: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: title,
      attachments: [{
        color,
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: title } },
          { type: 'section', text: { type: 'mrkdwn', text: body } },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: formatTimestamp() }],
          },
        ],
      }],
    }),
  }).catch((err) => console.error('[SEO Performance] Slack error:', err));
}
