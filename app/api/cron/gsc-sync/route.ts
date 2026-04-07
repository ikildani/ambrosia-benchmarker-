/**
 * Daily Google Search Console data sync cron job.
 * Pulls performance data, tracks indexed page counts, submits sitemap,
 * and alerts on significant coverage drops.
 *
 * Schedule: Daily at 08:00 UTC via Vercel Cron
 * Auth: Bearer token matched against CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { GSCClient } from '@/lib/seo/gsc-client';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  // 1. Auth
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const secret = process.env.CRON_SECRET || '';

  if (!secret || token.length !== secret.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    if (!crypto.timingSafeEqual(tokenBuf, secretBuf)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    const gsc = new GSCClient();
    if (!gsc.isConfigured()) {
      await logCronRun(supabase, 'gsc-sync', {
        processed: 0,
        parameters: { status: 'not_configured' },
      });
      return NextResponse.json({ message: 'GSC not configured', skipped: true });
    }

    const today = new Date().toISOString().split('T')[0];

    // 2. Pull performance data (28 days)
    const performanceData = await gsc.getPerformanceData(28);

    await supabase.from('seo_metrics').upsert(
      {
        metric_date: today,
        metric_type: 'gsc_performance',
        data: {
          rowCount: performanceData.length,
          totalClicks: performanceData.reduce((sum, r) => sum + r.clicks, 0),
          totalImpressions: performanceData.reduce((sum, r) => sum + r.impressions, 0),
          avgPosition:
            performanceData.length > 0
              ? performanceData.reduce((sum, r) => sum + r.position, 0) / performanceData.length
              : 0,
          topQueries: performanceData
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 50)
            .map((r) => ({
              query: r.query,
              page: r.page,
              clicks: r.clicks,
              impressions: r.impressions,
              ctr: r.ctr,
              position: r.position,
            })),
        },
      },
      { onConflict: 'metric_date,metric_type' }
    );

    // 3. Get indexed page count
    const indexedCount = await gsc.getIndexedPageCount();

    await supabase.from('seo_metrics').upsert(
      {
        metric_date: today,
        metric_type: 'gsc_coverage',
        data: {
          indexedPages: indexedCount,
          timestamp: new Date().toISOString(),
        },
      },
      { onConflict: 'metric_date,metric_type' }
    );

    // 4. Submit sitemap
    await gsc.submitSitemap('https://calculator.ambrosiaventures.co/sitemap.xml');

    // 5. Compare indexed count vs yesterday — alert if dropped by >5%
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: yesterdayMetric } = await supabase
      .from('seo_metrics')
      .select('data')
      .eq('metric_date', yesterdayStr)
      .eq('metric_type', 'gsc_coverage')
      .single();

    let coverageDropAlert = false;
    if (yesterdayMetric?.data?.indexedPages && indexedCount > 0) {
      const previousCount = yesterdayMetric.data.indexedPages as number;
      const dropPercent = ((previousCount - indexedCount) / previousCount) * 100;

      if (dropPercent > 5) {
        coverageDropAlert = true;
        await sendCoverageDropAlert(previousCount, indexedCount, dropPercent);
      }
    }

    // 6. Send daily SEO digest to #seo-alerts
    const totalClicks = performanceData.reduce((sum, r) => sum + r.clicks, 0);
    const totalImpressions = performanceData.reduce((sum, r) => sum + r.impressions, 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
    const avgPosition = performanceData.length > 0
      ? performanceData.reduce((sum, r) => sum + r.position, 0) / performanceData.length
      : 0;

    // Top queries by impressions
    const topQueries = performanceData
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5);

    // Pages gaining/dropping (compare position to previous data)
    const previousIndexed = yesterdayMetric?.data?.indexedPages as number | undefined;
    const indexedDelta = previousIndexed ? indexedCount - previousIndexed : 0;
    const indexedDeltaStr = indexedDelta > 0 ? `+${indexedDelta}` : indexedDelta === 0 ? 'no change' : `${indexedDelta}`;

    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

    const seoWebhook = process.env.SLACK_SEO_WEBHOOK_URL;
    if (seoWebhook) {
      const topQueryLines = topQueries.map((q, i) =>
        `${i + 1}. "${q.query}" — pos ${q.position.toFixed(1)}, CTR ${(q.ctr * 100).toFixed(1)}%, ${q.impressions} imp`
      ).join('\n');

      await fetch(seoWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Daily SEO Report — ${dateStr}`,
          attachments: [{
            color: '#2563eb',
            blocks: [
              {
                type: 'header',
                text: { type: 'plain_text', text: `📈 Daily SEO Report — ${dateStr}`, emoji: true },
              },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Indexed Pages:*\n${indexedCount.toLocaleString()} (${indexedDeltaStr} from yesterday)` },
                  { type: 'mrkdwn', text: `*Total Impressions (28d):*\n${totalImpressions.toLocaleString()}` },
                  { type: 'mrkdwn', text: `*Total Clicks (28d):*\n${totalClicks.toLocaleString()}` },
                  { type: 'mrkdwn', text: `*Avg CTR:*\n${avgCtr.toFixed(1)}%` },
                  { type: 'mrkdwn', text: `*Avg Position:*\n${avgPosition.toFixed(1)}` },
                  { type: 'mrkdwn', text: `*Queries Tracked:*\n${performanceData.length.toLocaleString()}` },
                ],
              },
              { type: 'divider' },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Top Queries by Impressions:*\n\`\`\`\n${topQueryLines || 'No data yet'}\n\`\`\``,
                },
              },
              {
                type: 'context',
                elements: [
                  { type: 'mrkdwn', text: `Data: Google Search Console | 28-day window | Sitemap submitted ✓` },
                ],
              },
            ],
          }],
        }),
      }).catch(err => console.error('[gsc-sync] SEO digest Slack error:', err));
    }

    // 7. Log cron run
    await logCronRun(supabase, 'gsc-sync', {
      fetched: performanceData.length,
      processed: performanceData.length,
      inserted: 2, // performance + coverage metrics
      parameters: {
        indexedPages: indexedCount,
        performanceRows: performanceData.length,
        coverageDropAlert,
      },
    });

    return NextResponse.json({
      success: true,
      performanceRows: performanceData.length,
      indexedPages: indexedCount,
      coverageDropAlert,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[gsc-sync] Error:', message);

    await logCronRun(supabase, 'gsc-sync', {
      errors: [message],
      parameters: { stage: 'gsc_sync' },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Slack notification ──────────────────────────────────────────────────────

async function sendCoverageDropAlert(
  previousCount: number,
  currentCount: number,
  dropPercent: number
) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `GSC Coverage Alert: Indexed pages dropped ${dropPercent.toFixed(1)}%`,
        attachments: [
          {
            color: '#e74c3c',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text:
                    `*GSC Coverage Drop Alert*\n` +
                    `Indexed pages dropped by *${dropPercent.toFixed(1)}%*\n` +
                    `Previous: ${previousCount.toLocaleString()} pages\n` +
                    `Current: ${currentCount.toLocaleString()} pages\n\n` +
                    `_Check Google Search Console for deindexing issues._`,
                },
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[gsc-sync] Slack notification failed:', err instanceof Error ? err.message : 'Unknown');
  }
}
