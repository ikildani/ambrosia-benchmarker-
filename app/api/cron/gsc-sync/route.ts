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

export async function POST(request: NextRequest) {
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
    console.log('[gsc-sync] Starting daily GSC data sync...');

    const gsc = new GSCClient();
    if (!gsc.isConfigured()) {
      console.warn('[gsc-sync] GSC client not configured — skipping sync');
      await logCronRun(supabase, 'gsc-sync', {
        processed: 0,
        parameters: { status: 'not_configured' },
      });
      return NextResponse.json({ message: 'GSC not configured', skipped: true });
    }

    const today = new Date().toISOString().split('T')[0];

    // 2. Pull performance data (28 days)
    console.log('[gsc-sync] Fetching performance data...');
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

    console.log(`[gsc-sync] Performance: ${performanceData.length} rows stored`);

    // 3. Get indexed page count
    console.log('[gsc-sync] Fetching indexed page count...');
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

    console.log(`[gsc-sync] Coverage: ${indexedCount} indexed pages`);

    // 4. Submit sitemap
    console.log('[gsc-sync] Submitting sitemap...');
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
        console.warn(
          `[gsc-sync] Coverage drop detected: ${previousCount} → ${indexedCount} (-${dropPercent.toFixed(1)}%)`
        );
        await sendCoverageDropAlert(previousCount, indexedCount, dropPercent);
      }
    }

    // 6. Log cron run
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
    console.warn('[gsc-sync] SLACK_WEBHOOK_URL not configured — skipping alert');
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
