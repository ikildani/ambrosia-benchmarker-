/**
 * Weekly Content Performance Feedback Loop cron job.
 * Closes the loop between content generation and revenue by:
 * 1. Attributing signups/Pro conversions to content pages via session referrers
 * 2. Ranking content by conversion rate using GSC + session data
 * 3. Feeding winning topics back into the seo_content_queue
 * 4. Updating blog_posts with GSC performance columns
 * 5. Backfilling attribution_source on user_profiles from sessions
 * 6. Sending a Slack digest of top performers and queued topics
 *
 * Schedule: Mondays at 3PM UTC (vercel.json)
 * Auth: Bearer token matched against CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { updateIntelligenceBus } from '@/lib/cron-intelligence';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ── Types ───────────────────────────────────────────────────────────────────

interface ContentAttribution {
  slug: string;
  title: string;
  pageUrl: string;
  gscClicks: number;
  gscImpressions: number;
  gscAvgCtr: number;
  gscAvgPosition: number;
  sessionCount: number;
  signups: number;
  proConversions: number;
  conversionRate: number; // signups / clicks
}

interface UtmAttribution {
  utmSource: string;
  utmCampaign: string | null;
  sessionCount: number;
  signups: number;
  proConversions: number;
  conversionRate: number;
}

interface QueuedTopic {
  title: string;
  slug: string;
  source: string;
  parentSlug: string;
}

// ── TA labels for topic variation ───────────────────────────────────────────

const TA_LABELS: Record<string, string> = {
  oncology: 'Oncology',
  neurology: 'Neurology',
  immunology: 'Immunology',
  metabolic: 'Metabolic',
  cardiovascular: 'Cardiovascular',
  rareDisease: 'Rare Disease',
  hematology: 'Hematology',
  infectiousDisease: 'Infectious Disease',
  ophthalmology: 'Ophthalmology',
  dermatology: 'Dermatology',
  gastroenterology: 'Gastroenterology',
  womensHealth: "Women's Health",
};

// Topic variation templates: given a winning blog post, generate related subtopics
const TOPIC_VARIATIONS: Record<string, { subtopics: string[]; slugSuffix: string }[]> = {
  oncology: [
    { subtopics: ['HER2+ Breast Cancer', 'NSCLC', 'Colorectal Cancer'], slugSuffix: 'her2-breast-cancer' },
    { subtopics: ['ADC Solid Tumors', 'Bispecific Oncology', 'Radiopharmaceutical Oncology'], slugSuffix: 'adc-solid-tumors' },
  ],
  neurology: [
    { subtopics: ['Alzheimer Disease', 'Parkinson Disease', 'ALS'], slugSuffix: 'alzheimer-disease' },
    { subtopics: ['CNS Gene Therapy', 'Neuro Anti-Amyloid', 'Migraine Therapeutics'], slugSuffix: 'cns-gene-therapy' },
  ],
  immunology: [
    { subtopics: ['Rheumatoid Arthritis', 'Lupus', 'Atopic Dermatitis'], slugSuffix: 'rheumatoid-arthritis' },
    { subtopics: ['IL-17 Inhibitors', 'JAK Inhibitors', 'TNF Biosimilars'], slugSuffix: 'il-17-inhibitors' },
  ],
  metabolic: [
    { subtopics: ['GLP-1 Obesity', 'MASH NASH', 'Type 2 Diabetes'], slugSuffix: 'glp1-obesity' },
  ],
  cardiovascular: [
    { subtopics: ['Heart Failure', 'ATTR Cardiomyopathy', 'Pulmonary Hypertension'], slugSuffix: 'heart-failure' },
  ],
  hematology: [
    { subtopics: ['CAR-T Hematology', 'Multiple Myeloma', 'AML Therapeutics'], slugSuffix: 'car-t-hematology' },
  ],
  rareDisease: [
    { subtopics: ['Gene Therapy Rare Disease', 'SMA Therapeutics', 'Hemophilia'], slugSuffix: 'gene-therapy-rare-disease' },
  ],
};

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // 1. Auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));
  if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const startTime = Date.now();
  const supabase = createServiceClient();

  try {
    // Run all steps, collecting results for the digest
    const [contentAttribution, utmAttribution] = await Promise.all([
      getContentAttribution(supabase),
      getUtmAttribution(supabase),
    ]);

    // Update blog_posts with GSC performance data
    const postsUpdated = await updateBlogPostPerformance(supabase, contentAttribution);

    // Feed winners into content queue
    const queuedTopics = await feedWinnersToQueue(supabase, contentAttribution);

    // Backfill attribution_source on user_profiles
    const attributionBackfilled = await backfillAttributionSource(supabase);

    // Send Slack digest
    await sendSlackDigest(contentAttribution, utmAttribution, queuedTopics);

    // Write winning topics to the intelligence bus
    const winningTopics = contentAttribution
      .filter((c) => c.signups > 0 || (c.gscClicks >= 10 && c.conversionRate > 0.01))
      .slice(0, 10)
      .map((c) => {
        const ta = detectTherapeuticArea(c.title, [], c.slug) || 'unknown';
        const modality = detectModality(c.title, c.slug) || 'unknown';
        return { ta, modality, conversionRate: c.conversionRate };
      });

    try {
      await updateIntelligenceBus(supabase, {
        winningTopics,
        priorityTAs: winningTopics
          .map((w) => w.ta)
          .filter((ta) => ta !== 'unknown')
          .filter((ta, i, arr) => arr.indexOf(ta) === i),
      });
    } catch {
      console.error('[content-performance] Failed to update intelligence bus (non-fatal)');
    }

    const durationMs = Date.now() - startTime;

    // Log cron run
    await logCronRun(supabase, 'content-performance', {
      processed: contentAttribution.length,
      inserted: queuedTopics.length,
      parameters: {
        contentPiecesAnalyzed: contentAttribution.length,
        utmSourcesAnalyzed: utmAttribution.length,
        blogPostsUpdated: postsUpdated,
        topicsQueued: queuedTopics.length,
        attributionBackfilled,
        durationMs,
      },
    });

    return NextResponse.json({
      success: true,
      durationMs,
      contentPiecesAnalyzed: contentAttribution.length,
      utmSourcesAnalyzed: utmAttribution.length,
      blogPostsUpdated: postsUpdated,
      topicsQueued: queuedTopics.length,
      attributionBackfilled,
      topContent: contentAttribution.slice(0, 5).map((c) => ({
        slug: c.slug,
        clicks: c.gscClicks,
        signups: c.signups,
        proConversions: c.proConversions,
        conversionRate: c.conversionRate,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[content-performance] Error:', message);

    await logCronRun(supabase, 'content-performance', {
      errors: [message],
      parameters: { stage: 'content_performance' },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Step 1: Content attribution ─────────────────────────────────────────────

async function getContentAttribution(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<ContentAttribution[]> {
  const baseUrl = 'https://calculator.ambrosiaventures.co';

  // 1a. Get GSC performance data from seo_metrics (last 7 days of stored data)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: gscMetrics } = await supabase
    .from('seo_metrics')
    .select('data')
    .eq('metric_type', 'gsc_performance')
    .gte('metric_date', sevenDaysAgo)
    .order('metric_date', { ascending: false })
    .limit(1);

  // Build a map of page URL -> GSC stats from the latest stored data
  const gscMap = new Map<string, { clicks: number; impressions: number; ctr: number; position: number }>();

  if (gscMetrics?.[0]?.data?.topQueries) {
    const queries = gscMetrics[0].data.topQueries as Array<{
      page: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;

    for (const q of queries) {
      if (!q.page) continue;
      // Aggregate by page (multiple queries can point to same page)
      const existing = gscMap.get(q.page) || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
      existing.clicks += q.clicks;
      existing.impressions += q.impressions;
      // Weighted average for CTR and position
      const totalImp = existing.impressions;
      if (totalImp > 0) {
        existing.ctr = existing.clicks / totalImp;
      }
      existing.position =
        totalImp > 0
          ? (existing.position * (totalImp - q.impressions) + q.position * q.impressions) / totalImp
          : q.position;
      gscMap.set(q.page, existing);
    }
  }

  // 1b. Get published blog posts
  const { data: blogPosts } = await supabase
    .from('blog_posts')
    .select('id, slug, title, modality, category, tags, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(200);

  if (!blogPosts || blogPosts.length === 0) return [];

  // 1c. For each blog post, count sessions with matching referrer_url (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const results: ContentAttribution[] = [];

  for (const post of blogPosts) {
    const pageUrl = `${baseUrl}/blog/${post.slug}`;
    const insightUrl = `${baseUrl}/insights/${post.slug}`;

    // Count sessions where referrer contains this blog/insight slug
    const { count: sessionCount } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .gte('started_at', thirtyDaysAgo)
      .or(`referrer_url.ilike.%/blog/${post.slug}%,referrer_url.ilike.%/insights/${post.slug}%`);

    // Count signups: users created within 24h of a session that visited this content
    // We use a raw approach: find sessions with this referrer, then check user_profiles
    const { data: contentSessions } = await supabase
      .from('sessions')
      .select('user_id, started_at')
      .gte('started_at', thirtyDaysAgo)
      .or(`referrer_url.ilike.%/blog/${post.slug}%,referrer_url.ilike.%/insights/${post.slug}%`)
      .not('user_id', 'is', null)
      .limit(500);

    let signups = 0;
    let proConversions = 0;

    if (contentSessions && contentSessions.length > 0) {
      const userIds = Array.from(new Set(contentSessions.map((s) => s.user_id).filter(Boolean))) as string[];

      if (userIds.length > 0) {
        // Get user profiles for these users
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, tier, created_at')
          .in('id', userIds.slice(0, 100)); // Cap at 100 to avoid query limits

        for (const profile of profiles || []) {
          // Check if user signed up within 24h of their content session
          const userSessions = contentSessions.filter((s) => s.user_id === profile.id);
          const earliestSession = userSessions.reduce((earliest, s) => {
            const t = new Date(s.started_at).getTime();
            return t < earliest ? t : earliest;
          }, Infinity);

          const profileCreated = new Date(profile.created_at).getTime();
          const twentyFourHours = 24 * 60 * 60 * 1000;

          // If profile was created within 24h after the session, it's an attributed signup
          if (profileCreated >= earliestSession && profileCreated <= earliestSession + twentyFourHours) {
            signups++;
            if (profile.tier === 'pro') {
              proConversions++;
            }
          }
        }
      }
    }

    // Get GSC data for this page
    const gscData = gscMap.get(pageUrl) || gscMap.get(insightUrl) || {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    };

    const conversionRate = gscData.clicks > 0 ? signups / gscData.clicks : 0;

    results.push({
      slug: post.slug,
      title: post.title,
      pageUrl,
      gscClicks: gscData.clicks,
      gscImpressions: gscData.impressions,
      gscAvgCtr: gscData.ctr,
      gscAvgPosition: gscData.position,
      sessionCount: sessionCount || 0,
      signups,
      proConversions,
      conversionRate,
    });
  }

  // Sort by conversion rate (with minimum click threshold), then by total clicks
  return results.sort((a, b) => {
    // Require at least 5 clicks to rank by conversion rate
    const aRate = a.gscClicks >= 5 ? a.conversionRate : 0;
    const bRate = b.gscClicks >= 5 ? b.conversionRate : 0;
    if (bRate !== aRate) return bRate - aRate;
    return b.gscClicks - a.gscClicks;
  });
}

// ── Step 1b: UTM attribution ────────────────────────────────────────────────

async function getUtmAttribution(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<UtmAttribution[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get sessions with utm_source in the last 30 days
  const { data: utmSessions } = await supabase
    .from('sessions')
    .select('user_id, utm_source, utm_campaign, started_at')
    .gte('started_at', thirtyDaysAgo)
    .not('utm_source', 'is', null)
    .limit(2000);

  if (!utmSessions || utmSessions.length === 0) return [];

  // Group by utm_source + utm_campaign
  const sourceMap = new Map<
    string,
    {
      utmSource: string;
      utmCampaign: string | null;
      sessions: Array<{ user_id: string | null; started_at: string }>;
    }
  >();

  for (const s of utmSessions) {
    const key = `${s.utm_source}::${s.utm_campaign || ''}`;
    const existing = sourceMap.get(key) || {
      utmSource: s.utm_source,
      utmCampaign: s.utm_campaign,
      sessions: [] as Array<{ user_id: string; started_at: string }>,
    };
    existing.sessions.push({ user_id: s.user_id, started_at: s.started_at });
    sourceMap.set(key, existing);
  }

  const results: UtmAttribution[] = [];

  for (const [, group] of Array.from(sourceMap)) {
    const userIds = Array.from(new Set(group.sessions.map((s) => s.user_id).filter(Boolean))) as string[];
    let signups = 0;
    let proConversions = 0;

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, tier, created_at')
        .in('id', userIds.slice(0, 100));

      for (const profile of profiles || []) {
        const userSessions = group.sessions.filter((s) => s.user_id === profile.id);
        const earliestSession = userSessions.reduce((earliest, s) => {
          const t = new Date(s.started_at).getTime();
          return t < earliest ? t : earliest;
        }, Infinity);

        const profileCreated = new Date(profile.created_at).getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (profileCreated >= earliestSession && profileCreated <= earliestSession + twentyFourHours) {
          signups++;
          if (profile.tier === 'pro') {
            proConversions++;
          }
        }
      }
    }

    results.push({
      utmSource: group.utmSource,
      utmCampaign: group.utmCampaign,
      sessionCount: group.sessions.length,
      signups,
      proConversions,
      conversionRate: group.sessions.length > 0 ? signups / group.sessions.length : 0,
    });
  }

  // Sort by Pro conversions first, then signups
  return results.sort((a, b) => {
    if (b.proConversions !== a.proConversions) return b.proConversions - a.proConversions;
    return b.signups - a.signups;
  });
}

// ── Step 2: Update blog_posts with performance data ─────────────────────────

async function updateBlogPostPerformance(
  supabase: ReturnType<typeof createServiceClient>,
  contentAttribution: ContentAttribution[],
): Promise<number> {
  let updated = 0;
  const now = new Date().toISOString();

  for (const content of contentAttribution) {
    // Only update posts that have some data
    if (
      content.gscClicks === 0 &&
      content.gscImpressions === 0 &&
      content.signups === 0
    ) {
      continue;
    }

    const { error } = await supabase
      .from('blog_posts')
      .update({
        gsc_clicks: content.gscClicks,
        gsc_impressions: content.gscImpressions,
        gsc_avg_ctr: content.gscAvgCtr > 0 ? Math.round(content.gscAvgCtr * 10000) / 10000 : null,
        gsc_avg_position: content.gscAvgPosition > 0 ? Math.round(content.gscAvgPosition * 10) / 10 : null,
        conversion_signups: content.signups,
        conversion_pro: content.proConversions,
        view_count: content.gscClicks, // Use GSC clicks as proxy for views
        performance_updated_at: now,
      })
      .eq('slug', content.slug);

    if (!error) updated++;
  }

  return updated;
}

// ── Step 3: Feed winners into content queue ─────────────────────────────────

async function feedWinnersToQueue(
  supabase: ReturnType<typeof createServiceClient>,
  contentAttribution: ContentAttribution[],
): Promise<QueuedTopic[]> {
  // Take top 5 converting pieces with actual conversions
  const winners = contentAttribution
    .filter((c) => c.signups > 0 || (c.gscClicks >= 10 && c.conversionRate > 0))
    .slice(0, 5);

  if (winners.length === 0) return [];

  // Get the blog post metadata for winners to extract topic params
  const winnerSlugs = winners.map((w) => w.slug);
  const { data: winnerPosts } = await supabase
    .from('blog_posts')
    .select('slug, title, modality, category, tags')
    .in('slug', winnerSlugs);

  interface WinnerPost {
    slug: string;
    title: string;
    modality: string | null;
    category: string | null;
    tags: string[] | null;
  }
  const postMap = new Map<string, WinnerPost>();
  for (const p of (winnerPosts || []) as WinnerPost[]) {
    postMap.set(p.slug, p);
  }
  const queuedTopics: QueuedTopic[] = [];

  for (const winner of winners) {
    const post = postMap.get(winner.slug);
    if (!post) continue;

    // Extract therapeutic area from title/tags/slug
    const detectedTA = detectTherapeuticArea(post.title, post.tags || [], winner.slug);
    const detectedModality = post.modality || detectModality(post.title, winner.slug);

    // Generate variation topics
    const variations = generateTopicVariations(detectedTA, detectedModality, post.title, winner.slug);

    for (const variation of variations) {
      // Check if similar topic already exists in queue
      const { data: existing } = await supabase
        .from('seo_content_queue')
        .select('id')
        .or(`generated_slug.eq.${variation.slug},topic_params->>'headline' .ilike.%${variation.headline.slice(0, 30)}%`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Insert into queue
      const { error } = await supabase.from('seo_content_queue').insert({
        source: 'performance_feedback',
        trigger_event: {
          type: 'content_performance_winner',
          parentSlug: winner.slug,
          parentTitle: winner.title,
          clicks: winner.gscClicks,
          signups: winner.signups,
          proConversions: winner.proConversions,
          conversionRate: winner.conversionRate,
          analyzedAt: new Date().toISOString(),
        },
        priority: 75,
        status: 'pending',
        topic_params: {
          therapeuticArea: variation.ta || detectedTA,
          modality: variation.modality || detectedModality,
          headline: variation.headline,
          parentSlug: winner.slug,
        },
        generated_slug: variation.slug,
      });

      if (!error) {
        queuedTopics.push({
          title: variation.headline,
          slug: variation.slug,
          source: 'performance_feedback',
          parentSlug: winner.slug,
        });
      }
    }
  }

  return queuedTopics;
}

// ── Step 4: Backfill attribution_source ─────────────────────────────────────

async function backfillAttributionSource(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<number> {
  // Find users with null attribution_source who have sessions with utm_source
  const { data: usersToBackfill } = await supabase
    .from('user_profiles')
    .select('id')
    .is('attribution_source', null)
    .limit(200);

  if (!usersToBackfill || usersToBackfill.length === 0) return 0;

  let backfilled = 0;

  for (const user of usersToBackfill) {
    // Get the earliest session with utm_source for this user
    const { data: firstSession } = await supabase
      .from('sessions')
      .select('utm_source, utm_campaign')
      .eq('user_id', user.id)
      .not('utm_source', 'is', null)
      .order('started_at', { ascending: true })
      .limit(1);

    if (firstSession && firstSession.length > 0 && firstSession[0].utm_source) {
      const updatePayload: Record<string, string> = {
        attribution_source: firstSession[0].utm_source,
      };
      if (firstSession[0].utm_campaign) {
        updatePayload.attribution_campaign = firstSession[0].utm_campaign;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updatePayload)
        .eq('id', user.id);

      if (!error) backfilled++;
    }
  }

  return backfilled;
}

// ── Step 5: Slack digest ────────────────────────────────────────────────────

async function sendSlackDigest(
  contentAttribution: ContentAttribution[],
  utmAttribution: UtmAttribution[],
  queuedTopics: QueuedTopic[],
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const date = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Top 5 content pieces by conversion
  const topContent = contentAttribution.slice(0, 5);
  const contentLines = topContent.length > 0
    ? topContent.map((c, i) => {
        const ctrStr = c.gscAvgCtr > 0 ? `${(c.gscAvgCtr * 100).toFixed(1)}%` : 'N/A';
        return `${i + 1}. *${c.title}*\n   ${c.gscClicks} clicks | ${c.signups} signups | ${c.proConversions} Pro | CTR ${ctrStr} | Conv ${(c.conversionRate * 100).toFixed(1)}%`;
      }).join('\n')
    : '_No content with conversions this period_';

  // Top 5 UTM sources by Pro conversion
  const topUtm = utmAttribution.slice(0, 5);
  const utmLines = topUtm.length > 0
    ? topUtm.map((u, i) => {
        const campaign = u.utmCampaign ? ` (${u.utmCampaign})` : '';
        return `${i + 1}. *${u.utmSource}*${campaign} — ${u.sessionCount} sessions | ${u.signups} signups | ${u.proConversions} Pro`;
      }).join('\n')
    : '_No UTM-attributed conversions this period_';

  // Queued topics
  const queueLines = queuedTopics.length > 0
    ? queuedTopics.map((t) => `- "${t.title}" (from \`${t.parentSlug}\`)`).join('\n')
    : '_No new topics queued_';

  // Total stats
  const totalSignups = contentAttribution.reduce((sum, c) => sum + c.signups, 0);
  const totalPro = contentAttribution.reduce((sum, c) => sum + c.proConversions, 0);
  const totalClicks = contentAttribution.reduce((sum, c) => sum + c.gscClicks, 0);

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Content Performance Report — ${date}`,
        attachments: [{
          color: '#8b5cf6',
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: `Content Performance Report — ${date}`, emoji: true },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Total Content Clicks:*\n${totalClicks.toLocaleString()}` },
                { type: 'mrkdwn', text: `*Content-Attributed Signups:*\n${totalSignups}` },
                { type: 'mrkdwn', text: `*Content-Attributed Pro:*\n${totalPro}` },
                { type: 'mrkdwn', text: `*Topics Queued:*\n${queuedTopics.length}` },
              ],
            },
            { type: 'divider' },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Top 5 Content by Conversion:*\n${contentLines}`,
              },
            },
            { type: 'divider' },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Top 5 UTM Sources by Pro Conversion:*\n${utmLines}`,
              },
            },
            { type: 'divider' },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Topics Queued for Generation:*\n${queueLines}`,
              },
            },
            {
              type: 'context',
              elements: [
                { type: 'mrkdwn', text: 'Data: GSC + Supabase sessions (30-day window) | Content feedback loop' },
              ],
            },
          ],
        }],
      }),
    });
  } catch (err) {
    console.error(
      '[content-performance] Slack notification error:',
      err instanceof Error ? err.message : 'unknown',
    );
  }
}

// ── Helper: Detect therapeutic area from title/tags/slug ────────────────────

function detectTherapeuticArea(title: string, tags: string[], slug: string): string | null {
  const text = `${title} ${tags.join(' ')} ${slug}`.toLowerCase();

  const taKeywords: Record<string, string[]> = {
    oncology: ['oncology', 'cancer', 'tumor', 'adc', 'her2', 'nsclc', 'melanoma', 'carcinoma', 'sarcoma'],
    neurology: ['neurology', 'neuro', 'alzheimer', 'parkinson', 'cns', 'brain', 'migraine', 'als', 'epilepsy'],
    immunology: ['immunology', 'autoimmune', 'lupus', 'rheumatoid', 'inflammatory', 'il-17', 'jak', 'tnf'],
    metabolic: ['metabolic', 'diabetes', 'obesity', 'glp-1', 'glp1', 'nash', 'mash', 'weight'],
    cardiovascular: ['cardiovascular', 'cardiac', 'heart', 'hypertension', 'atherosclerosis', 'attr'],
    hematology: ['hematology', 'leukemia', 'lymphoma', 'myeloma', 'car-t', 'aml', 'sickle'],
    rareDisease: ['rare disease', 'rare_disease', 'orphan', 'sma', 'duchenne', 'hemophilia', 'gene therapy'],
    infectiousDisease: ['infectious', 'hiv', 'hepatitis', 'vaccine', 'rsv', 'antiviral', 'antibiotic'],
    ophthalmology: ['ophthalmology', 'retinal', 'macular', 'glaucoma', 'ocular', 'amd'],
    dermatology: ['dermatology', 'psoriasis', 'eczema', 'atopic', 'vitiligo', 'alopecia'],
    gastroenterology: ['gastro', 'crohn', 'colitis', 'celiac', 'ibs', 'liver'],
    womensHealth: ['endometriosis', 'uterine', 'fertility', 'ovarian', 'menopause', 'pcos'],
  };

  for (const [ta, keywords] of Object.entries(taKeywords)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return ta;
    }
  }

  return null;
}

// ── Helper: Detect modality from title/slug ─────────────────────────────────

function detectModality(title: string, slug: string): string | null {
  const text = `${title} ${slug}`.toLowerCase();

  const modalityKeywords: Record<string, string[]> = {
    adc: ['adc', 'antibody-drug conjugate', 'antibody drug conjugate'],
    bispecific: ['bispecific', 'bispecifics'],
    smallMolecule: ['small molecule', 'small-molecule'],
    monoclonalAntibody: ['monoclonal', 'mab', 'antibody'],
    geneTherapy: ['gene therapy', 'gene-therapy', 'aav'],
    cellTherapy: ['cell therapy', 'car-t', 'car t'],
    rnai: ['rnai', 'sirna', 'rna interference'],
    mrna: ['mrna'],
    protac: ['protac', 'protein degradation'],
    radiopharmaceutical: ['radiopharm', 'radiopharma', 'radioligand'],
    glp1Agonist: ['glp-1', 'glp1', 'semaglutide', 'tirzepatide'],
  };

  for (const [modality, keywords] of Object.entries(modalityKeywords)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return modality;
    }
  }

  return null;
}

// ── Helper: Generate topic variations from a winning post ───────────────────

function generateTopicVariations(
  ta: string | null,
  modality: string | null,
  title: string,
  parentSlug: string,
): Array<{ headline: string; slug: string; ta: string | null; modality: string | null }> {
  const variations: Array<{ headline: string; slug: string; ta: string | null; modality: string | null }> = [];
  const now = new Date();
  const year = now.getFullYear();
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;

  if (ta && TOPIC_VARIATIONS[ta]) {
    const taVariations = TOPIC_VARIATIONS[ta];
    // Pick first variation set we haven't used
    const variation = taVariations[0];
    if (variation) {
      for (const subtopic of variation.subtopics.slice(0, 2)) {
        const slug = `${subtopic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-deal-benchmarks-${quarter.toLowerCase()}-${year}`;
        variations.push({
          headline: `${subtopic} Deal Benchmarks ${quarter} ${year}: Upfronts, Milestones, and Royalties`,
          slug,
          ta,
          modality,
        });
      }
    }
  }

  // If we have a modality but no TA variations, generate modality-specific subtopics
  if (variations.length === 0 && modality) {
    const modalityLabel = modality.replace(/([A-Z])/g, ' $1').trim();
    variations.push({
      headline: `${modalityLabel} Licensing Trends ${quarter} ${year}: What the Data Shows`,
      slug: `${modality.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-licensing-trends-${quarter.toLowerCase()}-${year}`,
      ta,
      modality,
    });
  }

  // Fallback: generate a generic "deep dive" variation
  if (variations.length === 0) {
    const cleanTitle = title.replace(/\d{4}.*$/, '').trim();
    variations.push({
      headline: `${cleanTitle}: ${quarter} ${year} Deep Dive`,
      slug: `${parentSlug}-deep-dive-${quarter.toLowerCase()}-${year}`,
      ta,
      modality,
    });
  }

  return variations.slice(0, 2); // Max 2 variations per winner
}
