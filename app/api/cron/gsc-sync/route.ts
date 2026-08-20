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
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { GSCClient, type GSCPerformanceRow } from '@/lib/seo/gsc-client';
import { runCronIntelligence } from '@/lib/cron-intelligence';

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
    // Try OAuth2 if service account isn't configured
    if (!gsc.isConfigured()) {
      await gsc.initOAuth2();
    }
    if (!gsc.isConfigured()) {
      console.warn('[gsc-sync] Neither service account nor OAuth2 configured — GSC sync disabled.');
      await logCronRun(supabase, 'gsc-sync', {
        processed: 0,
        parameters: { status: 'not_configured', fix: 'Visit /api/auth/gsc-authorize to connect Google Search Console via OAuth2' },
      });
      return NextResponse.json({ message: 'GSC not configured', skipped: true });
    }
    console.log(`[gsc-sync] Using auth method: ${gsc.getAuthMethod()}`);

    const today = new Date().toISOString().split('T')[0];

    // 2. Pull performance data (28 days)
    const performanceData = await gsc.getPerformanceData(28);

    // Alert if GSC is returning zero data for 3+ consecutive days
    if (performanceData.length === 0) {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

      const { count: zeroDays } = await supabase
        .from('seo_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('metric_type', 'gsc_performance')
        .gte('metric_date', threeDaysAgoStr);

      if (zeroDays && zeroDays >= 3) {
        const alertWebhook = process.env.SLACK_WEBHOOK_URL;
        if (alertWebhook) {
          await fetch(alertWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `GSC Alert: Search Console returning ZERO performance data for ${zeroDays}+ consecutive days. ` +
                `Auth method: ${gsc.getAuthMethod()}. Check: (1) GSC property URL matches code, ` +
                `(2) OAuth refresh token is valid, (3) Google Cloud app is in "production" mode. ` +
                `All SEO monitoring, CTR optimization, and auto-indexing are disabled.`,
            }),
          }).catch(() => {});
        }
      }
    }

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
    await gsc.submitSitemap('https://solidus.ambrosiaventures.co/sitemap.xml');

    // 4b. Auto-indexing: find unindexed pages and request indexing (up to 10 per run)
    let indexingResults: { submitted: number; failed: number; urls: string[] } = {
      submitted: 0,
      failed: 0,
      urls: [],
    };
    try {
      indexingResults = await autoIndexUnindexedPages(supabase, gsc, performanceData);
    } catch (err) {
      console.error('[gsc-sync] Auto-indexing error (non-fatal):', err instanceof Error ? err.message : 'Unknown');
    }

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
              ...(indexingResults.submitted > 0
                ? [{
                    type: 'section' as const,
                    text: {
                      type: 'mrkdwn' as const,
                      text: `*Auto-Indexing:* ${indexingResults.submitted} pages submitted to Google Indexing API`,
                    },
                  }]
                : []),
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
        indexingSubmitted: indexingResults.submitted,
        indexingFailed: indexingResults.failed,
      },
    });

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'gsc-sync', {
        processed: performanceData.length,
        inserted: indexedCount,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      performanceRows: performanceData.length,
      indexedPages: indexedCount,
      coverageDropAlert,
      indexing: indexingResults,
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

// ── Auto-indexing for unindexed pages ──────────────────────────────────────

/** Priority scores for page types (higher = submit first) */
const PAGE_PRIORITY: { pattern: RegExp; priority: number }[] = [
  { pattern: /^\/$/, priority: 1.0 },
  { pattern: /^\/calculator$/, priority: 0.95 },
  { pattern: /^\/pro$/, priority: 0.9 },
  { pattern: /^\/therapeutic-areas\//, priority: 0.85 },
  { pattern: /^\/benchmarks\//, priority: 0.8 },
  { pattern: /^\/companies\//, priority: 0.75 },
  { pattern: /^\/insights\//, priority: 0.7 },
  { pattern: /^\/guides\//, priority: 0.7 },
  { pattern: /^\/blog\//, priority: 0.65 },
  { pattern: /^\/glossary\//, priority: 0.5 },
  { pattern: /^\/pulse$/, priority: 0.8 },
];

function getPagePriority(url: string): number {
  const path = url.replace('https://solidus.ambrosiaventures.co', '');
  for (const { pattern, priority } of PAGE_PRIORITY) {
    if (pattern.test(path)) return priority;
  }
  return 0.4; // default for uncategorized pages
}

const MAX_INDEXING_REQUESTS_PER_RUN = 10;

async function autoIndexUnindexedPages(
  supabase: SupabaseClient,
  gsc: GSCClient,
  performanceData: GSCPerformanceRow[]
): Promise<{ submitted: number; failed: number; urls: string[] }> {
  const baseUrl = 'https://solidus.ambrosiaventures.co';

  // 1. Build the set of pages that have impressions (i.e., Google knows about them)
  const pagesWithImpressions = new Set<string>();
  for (const row of performanceData) {
    if (row.page) pagesWithImpressions.add(row.page);
  }

  // Also fetch 90-day impression data for a broader view
  const broadPages = await gsc.getPagesWithImpressions(90);
  for (const p of broadPages) {
    pagesWithImpressions.add(p);
  }

  // 2. Build the canonical set of high-priority pages from known site structure
  const sitemapPages: { url: string; priority: number }[] = [];

  // Static high-value pages
  const staticPaths = [
    '/', '/calculator', '/pro', '/portfolio', '/pulse',
    '/benchmarks', '/companies', '/glossary', '/blog',
    '/therapeutic-areas', '/about', '/methodology',
    '/guides', '/guides/how-to-value-biotech-deal',
    '/guides/negotiate-pharma-royalty-rates',
    '/guides/biotech-licensing-deal-structure',
    '/guides/rnpv-biotech-valuation',
  ];
  for (const path of staticPaths) {
    const url = `${baseUrl}${path}`;
    sitemapPages.push({ url, priority: getPagePriority(url) });
  }

  // TA pages
  const tas = [
    'oncology', 'neurology', 'immunology', 'cardiovascular', 'metabolic',
    'rareDisease', 'infectiousDisease', 'ophthalmology', 'dermatology',
    'womensHealth', 'gastroenterology', 'hematology',
  ];
  for (const ta of tas) {
    const url = `${baseUrl}/therapeutic-areas/${ta}`;
    sitemapPages.push({ url, priority: getPagePriority(url) });
  }

  // Fetch published blog posts from Supabase
  const { data: blogPosts } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('status', 'published')
    .limit(200);

  for (const post of blogPosts || []) {
    const url = `${baseUrl}/blog/${post.slug}`;
    sitemapPages.push({ url, priority: getPagePriority(url) });
  }

  // Fetch company pages
  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .order('deals_last_12mo', { ascending: false, nullsFirst: false })
    .limit(200);

  for (const company of companies || []) {
    const url = `${baseUrl}/companies/${company.id}`;
    sitemapPages.push({ url, priority: getPagePriority(url) });
  }

  // 3. Find pages with 0 impressions (not indexed or not ranking)
  const unindexedPages = sitemapPages.filter((p) => !pagesWithImpressions.has(p.url));

  if (unindexedPages.length === 0) {
    console.log('[gsc-sync] All known pages have impressions — no indexing requests needed');
    return { submitted: 0, failed: 0, urls: [] };
  }

  console.log(`[gsc-sync] Found ${unindexedPages.length} pages with 0 impressions`);

  // 4. Check which pages are already in the indexing queue
  const { data: existingQueue } = await supabase
    .from('seo_indexing_queue')
    .select('url, status, submitted_at')
    .in('url', unindexedPages.map((p) => p.url));

  const alreadySubmitted = new Set(
    (existingQueue || [])
      .filter((q) => {
        // Skip if submitted in the last 3 days (avoid hammering the API)
        if (q.submitted_at) {
          const submittedAge = Date.now() - new Date(q.submitted_at).getTime();
          const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
          return submittedAge < threeDaysMs;
        }
        return false;
      })
      .map((q) => q.url)
  );

  // 5. Pick top N unsubmitted pages by priority
  const toSubmit = unindexedPages
    .filter((p) => !alreadySubmitted.has(p.url))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_INDEXING_REQUESTS_PER_RUN);

  if (toSubmit.length === 0) {
    console.log('[gsc-sync] All unindexed pages already submitted recently');
    return { submitted: 0, failed: 0, urls: [] };
  }

  // 6. Upsert into the queue and attempt indexing requests
  let submitted = 0;
  let failed = 0;
  const submittedUrls: string[] = [];

  for (const page of toSubmit) {
    // Attempt the Google Indexing API call
    const result = await gsc.requestIndexing(page.url);

    const now = new Date().toISOString();

    if (result.success) {
      submitted++;
      submittedUrls.push(page.url);
      await supabase.from('seo_indexing_queue').upsert(
        {
          url: page.url,
          priority: page.priority,
          submitted_at: now,
          status: 'submitted',
          updated_at: now,
        },
        { onConflict: 'url' }
      );
    } else {
      failed++;
      await supabase.from('seo_indexing_queue').upsert(
        {
          url: page.url,
          priority: page.priority,
          status: 'failed',
          error_message: result.error?.slice(0, 500),
          updated_at: now,
        },
        { onConflict: 'url' }
      );
    }
  }

  console.log(
    `[gsc-sync] Indexing requests: ${submitted} submitted, ${failed} failed out of ${toSubmit.length}`
  );

  return { submitted, failed, urls: submittedUrls };
}
