/**
 * Weekly Comparison Page Auto-Optimizer cron job.
 * Measures GSC performance of /compare/* pages, discovers competitor gap
 * queries, auto-queues new comparison pages, and flags underperformers
 * for meta title rewrites.
 *
 * Schedule: Mondays at 4PM UTC (vercel.json)
 * Auth: Bearer token matched against CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { updateIntelligenceBus } from '@/lib/cron-intelligence';
import { GSCClient, type GSCPerformanceRow } from '@/lib/seo/gsc-client';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ── Known comparison pages ────────────────────────────────────────────────

const COMPARISON_SLUGS = [
  '/compare/evaluate-pharma',
  '/compare/capital-iq',
  '/compare/cortellis',
];

const BASE_URL = 'https://calculator.ambrosiaventures.co';

// Competitor names we already have pages for (lowercase for matching)
const EXISTING_COMPETITORS = new Set([
  'evaluatepharma', 'evaluate pharma', 'evaluate',
  'capital iq', 'capitaliq', 'cap iq', 's&p capital iq',
  'cortellis', 'clarivate cortellis',
]);

// Competitor brand names we might discover in GSC queries
const COMPETITOR_PATTERNS: Array<{ pattern: RegExp; name: string; slug: string }> = [
  { pattern: /\b(dealogic)\b/i, name: 'Dealogic', slug: 'dealogic' },
  { pattern: /\b(informa|informa pharma|pharma intelligence)\b/i, name: 'Informa Pharma Intelligence', slug: 'informa-pharma' },
  { pattern: /\b(globaldata|global data)\b/i, name: 'GlobalData', slug: 'globaldata' },
  { pattern: /\b(citeline|trialtrove|pharmaprojects)\b/i, name: 'Citeline', slug: 'citeline' },
  { pattern: /\b(pitchbook)\b/i, name: 'PitchBook', slug: 'pitchbook' },
  { pattern: /\b(preqin)\b/i, name: 'Preqin', slug: 'preqin' },
  { pattern: /\b(biomedtracker)\b/i, name: 'BioMedTracker', slug: 'biomedtracker' },
  { pattern: /\b(evaluate|evaluate\s*vantage)\b/i, name: 'Evaluate Vantage', slug: 'evaluate-vantage' },
  { pattern: /\b(sagient|icer|icer\s*data)\b/i, name: 'ICER', slug: 'icer' },
  { pattern: /\b(definitive\s*healthcare)\b/i, name: 'Definitive Healthcare', slug: 'definitive-healthcare' },
  { pattern: /\b(ep\s*vantage)\b/i, name: 'EP Vantage', slug: 'ep-vantage' },
  { pattern: /\b(iqvia)\b/i, name: 'IQVIA', slug: 'iqvia' },
  { pattern: /\b(veeva)\b/i, name: 'Veeva', slug: 'veeva' },
];

// ── Types ──────────────────────────────────────────────────────────────────

interface ComparisonPagePerformance {
  page: string;
  slug: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

interface DiscoveredCompetitor {
  name: string;
  slug: string;
  query: string;
  impressions: number;
  clicks: number;
}

// ── Route handler ──────────────────────────────────────────────────────────

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
    // 2. Initialize GSC client
    const gsc = new GSCClient();
    if (!gsc.isConfigured()) {
      await gsc.initOAuth2();
    }
    if (!gsc.isConfigured()) {
      console.warn('[comparison-optimizer] GSC not configured — skipping');
      await logCronRun(supabase, 'comparison-optimizer', {
        processed: 0,
        parameters: { status: 'gsc_not_configured' },
      });
      return NextResponse.json({ message: 'GSC not configured', skipped: true });
    }

    // 3. Pull performance data (28 days)
    const performanceData = await gsc.getPerformanceData(28);

    // 4. Measure comparison page performance
    const comparisonPerformance = measureComparisonPages(performanceData);

    // 5. Discover competitor gap queries
    const discoveredCompetitors = discoverCompetitorGaps(performanceData);

    // 6. Queue new comparison pages for discovered competitors
    let pagesQueued = 0;
    for (const competitor of discoveredCompetitors) {
      const queued = await queueComparisonPage(supabase, competitor);
      if (queued) pagesQueued++;
    }

    // 7. Flag underperforming comparison pages
    let flagged = 0;
    for (const page of comparisonPerformance) {
      const wasFlagged = await flagUnderperformer(supabase, page);
      if (wasFlagged) flagged++;
    }

    // 8. Store weekly comparison metrics
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('seo_metrics').upsert(
      {
        metric_date: today,
        metric_type: 'comparison_page_performance',
        data: {
          pages: comparisonPerformance.map((p) => ({
            slug: p.slug,
            clicks: p.clicks,
            impressions: p.impressions,
            ctr: p.ctr,
            avgPosition: p.avgPosition,
            topQueries: p.topQueries.slice(0, 5),
          })),
          discoveredCompetitors: discoveredCompetitors.map((c) => ({
            name: c.name,
            slug: c.slug,
            query: c.query,
            impressions: c.impressions,
          })),
          pagesQueued,
          flagged,
          timestamp: new Date().toISOString(),
        },
      },
      { onConflict: 'metric_date,metric_type' }
    );

    // 9. Slack digest
    await sendSlackDigest(comparisonPerformance, discoveredCompetitors, pagesQueued, flagged);

    // Write discovered competitors to the intelligence bus
    if (discoveredCompetitors.length > 0) {
      try {
        await updateIntelligenceBus(supabase, {
          newCompetitorQueries: discoveredCompetitors.map(
            (c) => `${c.name}: "${c.query}" (${c.impressions} impressions)`
          ),
        });
      } catch {
        console.error('[comparison-optimizer] Failed to update intelligence bus (non-fatal)');
      }
    }

    // 10. Log cron run
    await logCronRun(supabase, 'comparison-optimizer', {
      processed: comparisonPerformance.length,
      inserted: pagesQueued,
      parameters: {
        pagesAnalyzed: comparisonPerformance.length,
        competitorsDiscovered: discoveredCompetitors.length,
        pagesQueued,
        flaggedForRewrite: flagged,
        totalClicks: comparisonPerformance.reduce((sum, p) => sum + p.clicks, 0),
        totalImpressions: comparisonPerformance.reduce((sum, p) => sum + p.impressions, 0),
      },
    });

    return NextResponse.json({
      success: true,
      pagesAnalyzed: comparisonPerformance.length,
      competitorsDiscovered: discoveredCompetitors.length,
      pagesQueued,
      flaggedForRewrite: flagged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[comparison-optimizer] Error:', message);

    await logCronRun(supabase, 'comparison-optimizer', {
      errors: [message],
      parameters: { stage: 'comparison_optimizer' },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Step 4: Measure comparison page performance ────────────────────────────

function measureComparisonPages(
  performanceData: GSCPerformanceRow[]
): ComparisonPagePerformance[] {
  const results: ComparisonPagePerformance[] = [];

  for (const slug of COMPARISON_SLUGS) {
    const pageUrl = `${BASE_URL}${slug}`;

    // Get all rows for this comparison page
    const pageRows = performanceData.filter((r) => r.page === pageUrl);

    if (pageRows.length === 0) {
      results.push({
        page: pageUrl,
        slug,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        avgPosition: 0,
        topQueries: [],
      });
      continue;
    }

    const totalClicks = pageRows.reduce((sum, r) => sum + r.clicks, 0);
    const totalImpressions = pageRows.reduce((sum, r) => sum + r.impressions, 0);
    const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition =
      pageRows.reduce((sum, r) => sum + r.position * r.impressions, 0) /
      (totalImpressions || 1);

    // Top queries sorted by impressions
    const topQueries = pageRows
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10)
      .map((r) => ({
        query: r.query,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }));

    results.push({
      page: pageUrl,
      slug,
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr,
      avgPosition,
      topQueries,
    });
  }

  return results;
}

// ── Step 5: Discover competitor gap queries ────────────────────────────────

function discoverCompetitorGaps(
  performanceData: GSCPerformanceRow[]
): DiscoveredCompetitor[] {
  const discovered = new Map<string, DiscoveredCompetitor>();

  // Look through ALL queries (not just comparison page queries)
  // for competitor brand mentions that indicate comparison intent
  const comparisonIntentPatterns = [
    /alternative/i,
    /vs\.?\s/i,
    /versus/i,
    /compared?\s*to/i,
    /competitor/i,
    /better\s*than/i,
    /replacement/i,
    /substitute/i,
    /switch\s*(from|to)/i,
    /review/i,
    /pricing/i,
  ];

  for (const row of performanceData) {
    const query = row.query.toLowerCase();

    // Check if this query mentions a competitor we don't have a page for
    for (const { pattern, name, slug } of COMPETITOR_PATTERNS) {
      if (!pattern.test(query)) continue;

      // Skip if we already have this competitor covered
      if (EXISTING_COMPETITORS.has(slug)) continue;

      // Check for comparison intent or significant impressions
      const hasComparisonIntent = comparisonIntentPatterns.some((p) => p.test(query));
      const hasSignificantImpressions = row.impressions >= 5;

      if (!hasComparisonIntent && !hasSignificantImpressions) continue;

      const existing = discovered.get(slug);
      if (!existing || row.impressions > existing.impressions) {
        discovered.set(slug, {
          name,
          slug,
          query: row.query,
          impressions: row.impressions,
          clicks: row.clicks,
        });
      }
    }
  }

  return Array.from(discovered.values()).sort(
    (a, b) => b.impressions - a.impressions
  );
}

// ── Step 6: Queue new comparison pages ─────────────────────────────────────

async function queueComparisonPage(
  supabase: ReturnType<typeof createServiceClient>,
  competitor: DiscoveredCompetitor
): Promise<boolean> {
  const compareSlug = `compare-${competitor.slug}`;

  // Check if page already exists in blog_posts
  const { data: existingPost } = await supabase
    .from('blog_posts')
    .select('id')
    .eq('slug', compareSlug)
    .single();

  if (existingPost) {
    console.log(
      `[comparison-optimizer] Comparison page already exists: ${compareSlug}`
    );
    return false;
  }

  // Check if already in seo_generated_pages
  const { data: existingGenerated } = await supabase
    .from('seo_generated_pages')
    .select('id')
    .eq('slug', compareSlug)
    .single();

  if (existingGenerated) {
    console.log(
      `[comparison-optimizer] Already queued in seo_generated_pages: ${compareSlug}`
    );
    return false;
  }

  // Insert into seo_generated_pages with comparison page structure
  // The seo-page-render cron will pick this up and generate the full page
  const { error } = await supabase.from('seo_generated_pages').upsert(
    {
      slug: compareSlug,
      page_data: {
        slug: compareSlug,
        title: `Ambrosia vs ${competitor.name} | Biopharma Deal Intelligence Comparison`,
        metaDescription: `Compare Ambrosia Ventures to ${competitor.name} for biopharma deal benchmarking. See how deal coverage, pricing, and analytics compare across ${competitor.name} and Ambrosia.`,
        h1: `Ambrosia vs ${competitor.name}: Biopharma Deal Intelligence Comparison`,
        category: 'comparison',
        calculatorPrefill: {},
        contextParagraphs: [
          `BD teams evaluating ${competitor.name} alternatives are searching for "${competitor.query}" — this page should comprehensively compare deal benchmarking capabilities, pricing, and analytics depth.`,
          `Structure: comparison table (features), FAQ schema, pricing comparison, CTA to free trial.`,
          `Competitor: ${competitor.name}. Discovery query: "${competitor.query}" (${competitor.impressions} impressions in 28d).`,
        ],
        companies: [],
        headline: `How Ambrosia Compares to ${competitor.name} for Deal Benchmarking`,
      },
      source: 'comparison_gap',
      priority_score: 85,
      status: 'pending',
      impressions_at_creation: competitor.impressions,
    },
    { onConflict: 'slug' }
  );

  if (error) {
    console.error(
      `[comparison-optimizer] Failed to queue ${compareSlug}:`,
      error.message
    );
    return false;
  }

  console.log(
    `[comparison-optimizer] Queued new comparison page: ${compareSlug} (discovered via "${competitor.query}", ${competitor.impressions} impressions)`
  );
  return true;
}

// ── Step 7: Flag underperforming pages ─────────────────────────────────────

async function flagUnderperformer(
  supabase: ReturnType<typeof createServiceClient>,
  page: ComparisonPagePerformance
): Promise<boolean> {
  // Flag if >100 impressions but <2% CTR
  if (page.impressions < 100 || page.ctr >= 0.02) {
    return false;
  }

  // Check if already flagged recently (within 14 days)
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const { data: recentFlag } = await supabase
    .from('seo_optimization_log')
    .select('id')
    .eq('page_path', page.slug)
    .gte('created_at', twoWeeksAgo.toISOString())
    .limit(1);

  if (recentFlag && recentFlag.length > 0) {
    return false;
  }

  // Find the top query driving impressions (for context)
  const topQuery = page.topQueries[0];

  // Insert flag into seo_optimization_log
  const { error } = await supabase.from('seo_optimization_log').insert({
    page_path: page.slug,
    original_title: `Current title for ${page.slug}`,
    original_description: `Current meta description for ${page.slug}`,
    new_title: '', // Empty — signals this is a candidate, not an applied change
    new_description: '',
    trigger_query: topQuery?.query || 'comparison_optimizer_flag',
    trigger_position: page.avgPosition,
    trigger_ctr: page.ctr,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error(
      `[comparison-optimizer] Failed to flag ${page.slug}:`,
      error.message
    );
    return false;
  }

  console.log(
    `[comparison-optimizer] Flagged ${page.slug} for CTR rewrite (${page.impressions} imp, ${(page.ctr * 100).toFixed(1)}% CTR)`
  );
  return true;
}

// ── Slack digest ───────────────────────────────────────────────────────────

async function sendSlackDigest(
  pages: ComparisonPagePerformance[],
  discovered: DiscoveredCompetitor[],
  pagesQueued: number,
  flagged: number
): Promise<void> {
  const webhookUrl =
    process.env.SLACK_SEO_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const totalClicks = pages.reduce((sum, p) => sum + p.clicks, 0);
  const totalImpressions = pages.reduce((sum, p) => sum + p.impressions, 0);
  const avgCtr =
    totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0';

  const pageLines = pages
    .map(
      (p) =>
        `- \`${p.slug}\`: ${p.clicks} clicks, ${p.impressions} imp, ${(p.ctr * 100).toFixed(1)}% CTR, pos ${p.avgPosition.toFixed(1)}`
    )
    .join('\n');

  const discoveredLines =
    discovered.length > 0
      ? discovered
          .slice(0, 5)
          .map(
            (c) =>
              `- *${c.name}*: "${c.query}" (${c.impressions} imp, ${c.clicks} clicks)`
          )
          .join('\n')
      : '_No new competitor queries discovered_';

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Comparison Page Optimizer — Weekly Report`,
        attachments: [
          {
            color: '#6366f1',
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: 'Comparison Page Optimizer — Weekly Report',
                  emoji: true,
                },
              },
              {
                type: 'section',
                fields: [
                  {
                    type: 'mrkdwn',
                    text: `*Total Clicks (28d):*\n${totalClicks.toLocaleString()}`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Total Impressions:*\n${totalImpressions.toLocaleString()}`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Avg CTR:*\n${avgCtr}%`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Pages Queued:*\n${pagesQueued}`,
                  },
                ],
              },
              { type: 'divider' },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Page Performance:*\n${pageLines}`,
                },
              },
              { type: 'divider' },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Competitor Gap Queries Discovered:*\n${discoveredLines}`,
                },
              },
              ...(flagged > 0
                ? [
                    {
                      type: 'section' as const,
                      text: {
                        type: 'mrkdwn' as const,
                        text: `*Flagged for Meta Rewrite:* ${flagged} page(s) with >100 imp and <2% CTR`,
                      },
                    },
                  ]
                : []),
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: 'Data: Google Search Console | 28-day window | New pages queued for seo-page-render cron',
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    console.error(
      '[comparison-optimizer] Slack notification error:',
      err instanceof Error ? err.message : 'Unknown'
    );
  }
}
