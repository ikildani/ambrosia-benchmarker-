/**
 * Weekly Exit-Intent Intelligence cron job.
 * Measures exit-intent popup conversion, rotates A/B test copy variants,
 * tracks variant performance, and picks winners after a full rotation.
 *
 * Schedule: Tuesdays at 10AM UTC (vercel.json)
 * Auth: Bearer token matched against CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ── Exit-intent copy variants ──────────────────────────────────────────────

interface ExitIntentVariant {
  id: string;
  headline: string;
  subtext: string;
  buttonText: string;
  footnote: string;
}

const VARIANTS: ExitIntentVariant[] = [
  {
    id: 'A',
    headline: 'Wait — before you go',
    subtext: 'Get a free deal benchmark report for your next calculation.',
    buttonText: 'Send My Free Report',
    footnote: 'No spam, unsubscribe anytime. 3,000+ deals benchmarked.',
  },
  {
    id: 'B',
    headline: 'Wait — before you go',
    subtext: 'See how your deal compares to 3,000+ real biopharma transactions.',
    buttonText: 'Show Me the Data',
    footnote: 'Free benchmarking insight. No credit card required.',
  },
  {
    id: 'C',
    headline: 'Wait — before you go',
    subtext: 'Join 50+ biotech BD teams using data-driven deal benchmarks.',
    buttonText: 'Get My Free Benchmark',
    footnote: 'Trusted by BD teams at top-20 pharma. No spam.',
  },
  {
    id: 'D',
    headline: 'Your deal terms may be below market',
    subtext: 'Get a free analysis showing how your terms compare to recent deals in your therapeutic area.',
    buttonText: 'See My Deal Analysis',
    footnote: 'Instant benchmarking against 3,000+ verified transactions.',
  },
];

const ROTATION_WEEKS = 4; // One full rotation before picking a winner

// ── Types ──────────────────────────────────────────────────────────────────

interface VariantPerformance {
  variant_id: string;
  impressions: number;
  captures: number;
  signups: number;
  pro_conversions: number;
  week_start: string;
  week_end: string;
}

interface ExitIntentConfig {
  active_variant: string;
  rotation_start: string; // ISO date when current rotation started
  rotation_week: number; // 1-4 within current rotation
  locked_winner: string | null; // Set after 4 weeks if a winner is found
  variant_history: Array<{
    variant_id: string;
    week: number;
    captures: number;
    impressions: number;
  }>;
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
    // 2. Get current exit-intent config from system_config
    const config = await getExitIntentConfig(supabase);

    // 3. Measure last 7 days of exit-intent performance
    const weekPerformance = await measureWeekPerformance(supabase, config.active_variant);

    // 4. Store variant performance for this week
    await storeVariantPerformance(supabase, config, weekPerformance);

    // 5. Rotate variant or lock winner
    const rotationResult = await rotateOrLockVariant(supabase, config);

    // 6. Compute overall exit-intent conversion metrics
    const overallMetrics = await getOverallMetrics(supabase);

    // 7. Slack digest
    await sendSlackDigest(config, weekPerformance, rotationResult, overallMetrics);

    // 8. Log cron run
    await logCronRun(supabase, 'exit-intent-optimizer', {
      processed: 1,
      parameters: {
        activeVariant: rotationResult.newVariant,
        rotationWeek: rotationResult.newWeek,
        weekCaptures: weekPerformance.captures,
        weekImpressions: weekPerformance.impressions,
        conversionRate: weekPerformance.impressions > 0
          ? (weekPerformance.captures / weekPerformance.impressions * 100).toFixed(1) + '%'
          : '0%',
        lockedWinner: rotationResult.lockedWinner,
      },
    });

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'exit-intent-optimizer', {
        processed: 1,
        inserted: 0,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      activeVariant: rotationResult.newVariant,
      rotationWeek: rotationResult.newWeek,
      weekCaptures: weekPerformance.captures,
      weekSignups: weekPerformance.signups,
      weekProConversions: weekPerformance.pro_conversions,
      lockedWinner: rotationResult.lockedWinner,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[exit-intent-optimizer] Error:', message);

    await logCronRun(supabase, 'exit-intent-optimizer', {
      errors: [message],
      parameters: { stage: 'exit_intent_optimizer' },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Config management ──────────────────────────────────────────────────────

async function getExitIntentConfig(
  supabase: ReturnType<typeof createServiceClient>
): Promise<ExitIntentConfig> {
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'exit_intent_config')
    .single();

  if (data?.value) {
    return data.value as ExitIntentConfig;
  }

  // Initialize default config
  const defaultConfig: ExitIntentConfig = {
    active_variant: 'A',
    rotation_start: new Date().toISOString().split('T')[0],
    rotation_week: 1,
    locked_winner: null,
    variant_history: [],
  };

  await supabase.from('system_config').upsert(
    {
      key: 'exit_intent_config',
      value: defaultConfig,
    },
    { onConflict: 'key' }
  );

  return defaultConfig;
}

async function saveExitIntentConfig(
  supabase: ReturnType<typeof createServiceClient>,
  config: ExitIntentConfig
): Promise<void> {
  await supabase.from('system_config').upsert(
    {
      key: 'exit_intent_config',
      value: config,
    },
    { onConflict: 'key' }
  );
}

// ── Step 3: Measure weekly performance ─────────────────────────────────────

async function measureWeekPerformance(
  supabase: ReturnType<typeof createServiceClient>,
  activeVariant: string
): Promise<VariantPerformance> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekStart = weekAgo.toISOString().split('T')[0];
  const weekEnd = now.toISOString().split('T')[0];

  // Count exit-intent captures from newsletter_subscribers
  const { data: captures, count: captureCount } = await supabase
    .from('newsletter_subscribers')
    .select('id, email', { count: 'exact' })
    .eq('source', 'exit_intent')
    .gte('subscribed_at', weekAgo.toISOString())
    .lte('subscribed_at', now.toISOString());

  const capturedEmails = new Set(
    (captures || []).map((c) => c.email?.toLowerCase()).filter(Boolean)
  );

  // Count how many of those captured emails signed up (exist in auth.users)
  // We approximate by checking user_profiles for matching emails
  let signups = 0;
  if (capturedEmails.size > 0) {
    const { count } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .in('email', Array.from(capturedEmails))
      .gte('created_at', weekAgo.toISOString());

    signups = count || 0;
  }

  // Count Pro conversions among captured emails
  let proConversions = 0;
  if (capturedEmails.size > 0) {
    const { count } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .in('email', Array.from(capturedEmails))
      .eq('tier', 'pro');

    proConversions = count || 0;
  }

  // Estimate impressions from daily_stats or seo_metrics
  // Exit-intent triggers for non-paid, desktop users who leave the viewport.
  // We approximate impressions from unique sessions - paid users.
  const { data: statsData } = await supabase
    .from('seo_metrics')
    .select('data')
    .eq('metric_type', 'daily_stats')
    .gte('metric_date', weekStart)
    .lte('metric_date', weekEnd);

  let estimatedImpressions = 0;
  for (const row of statsData || []) {
    const d = row.data as Record<string, number> | null;
    // Rough estimate: ~30% of organic visitors see exit intent on desktop
    const organicSessions = d?.organic_sessions || d?.total_sessions || 0;
    estimatedImpressions += Math.round(organicSessions * 0.3);
  }

  // If no stats data, use capture count * rough multiplier
  if (estimatedImpressions === 0 && (captureCount || 0) > 0) {
    estimatedImpressions = Math.max((captureCount || 0) * 20, 50); // ~5% capture rate estimate
  }

  return {
    variant_id: activeVariant,
    impressions: estimatedImpressions,
    captures: captureCount || 0,
    signups,
    pro_conversions: proConversions,
    week_start: weekStart,
    week_end: weekEnd,
  };
}

// ── Step 4: Store variant performance ──────────────────────────────────────

async function storeVariantPerformance(
  supabase: ReturnType<typeof createServiceClient>,
  config: ExitIntentConfig,
  performance: VariantPerformance
): Promise<void> {
  // Store in seo_metrics with a specific type for exit-intent tracking
  const today = new Date().toISOString().split('T')[0];

  await supabase.from('seo_metrics').upsert(
    {
      metric_date: today,
      metric_type: 'exit_intent_variant',
      data: {
        variant_id: performance.variant_id,
        rotation_week: config.rotation_week,
        impressions: performance.impressions,
        captures: performance.captures,
        signups: performance.signups,
        pro_conversions: performance.pro_conversions,
        capture_rate: performance.impressions > 0
          ? performance.captures / performance.impressions
          : 0,
        signup_rate: performance.captures > 0
          ? performance.signups / performance.captures
          : 0,
        week_start: performance.week_start,
        week_end: performance.week_end,
      },
    },
    { onConflict: 'metric_date,metric_type' }
  );

  // Update variant_history in config
  config.variant_history.push({
    variant_id: performance.variant_id,
    week: config.rotation_week,
    captures: performance.captures,
    impressions: performance.impressions,
  });

  await saveExitIntentConfig(supabase, config);
}

// ── Step 5: Rotate variant or lock winner ──────────────────────────────────

interface RotationResult {
  newVariant: string;
  newWeek: number;
  lockedWinner: string | null;
  action: 'rotated' | 'locked' | 'kept';
}

async function rotateOrLockVariant(
  supabase: ReturnType<typeof createServiceClient>,
  config: ExitIntentConfig
): Promise<RotationResult> {
  // If already locked, keep the winner
  if (config.locked_winner) {
    return {
      newVariant: config.locked_winner,
      newWeek: config.rotation_week,
      lockedWinner: config.locked_winner,
      action: 'kept',
    };
  }

  const variantIds = VARIANTS.map((v) => v.id);
  const currentIndex = variantIds.indexOf(config.active_variant);

  // After one full rotation (4 weeks), pick the winner
  if (config.rotation_week >= ROTATION_WEEKS) {
    const winner = pickWinner(config);

    config.locked_winner = winner;
    config.active_variant = winner;
    config.rotation_week = ROTATION_WEEKS;
    await saveExitIntentConfig(supabase, config);

    console.log(
      `[exit-intent-optimizer] Locked winner: Variant ${winner} after ${ROTATION_WEEKS} weeks`
    );

    return {
      newVariant: winner,
      newWeek: ROTATION_WEEKS,
      lockedWinner: winner,
      action: 'locked',
    };
  }

  // Rotate to next variant
  const nextIndex = (currentIndex + 1) % variantIds.length;
  const nextVariant = variantIds[nextIndex];
  const nextWeek = config.rotation_week + 1;

  config.active_variant = nextVariant;
  config.rotation_week = nextWeek;
  await saveExitIntentConfig(supabase, config);

  console.log(
    `[exit-intent-optimizer] Rotated to Variant ${nextVariant} (week ${nextWeek}/${ROTATION_WEEKS})`
  );

  return {
    newVariant: nextVariant,
    newWeek: nextWeek,
    lockedWinner: null,
    action: 'rotated',
  };
}

function pickWinner(config: ExitIntentConfig): string {
  // Aggregate captures and impressions per variant
  const variantStats = new Map<string, { captures: number; impressions: number }>();

  for (const entry of config.variant_history) {
    const existing = variantStats.get(entry.variant_id) || { captures: 0, impressions: 0 };
    existing.captures += entry.captures;
    existing.impressions += entry.impressions;
    variantStats.set(entry.variant_id, existing);
  }

  // Pick variant with highest capture rate
  let bestVariant = 'A';
  let bestRate = -1;

  for (const [variantId, stats] of variantStats) {
    const rate = stats.impressions > 0 ? stats.captures / stats.impressions : 0;
    if (rate > bestRate) {
      bestRate = rate;
      bestVariant = variantId;
    }
  }

  return bestVariant;
}

// ── Step 6: Overall metrics ────────────────────────────────────────────────

interface OverallMetrics {
  totalCaptures30d: number;
  totalSignups30d: number;
  totalProConversions30d: number;
  overallCaptureRate: string;
}

async function getOverallMetrics(
  supabase: ReturnType<typeof createServiceClient>
): Promise<OverallMetrics> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { count: totalCaptures } = await supabase
    .from('newsletter_subscribers')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'exit_intent')
    .gte('subscribed_at', thirtyDaysAgo.toISOString());

  const capturedEmails30d = await supabase
    .from('newsletter_subscribers')
    .select('email')
    .eq('source', 'exit_intent')
    .gte('subscribed_at', thirtyDaysAgo.toISOString());

  const emails = (capturedEmails30d.data || [])
    .map((r) => r.email?.toLowerCase())
    .filter(Boolean) as string[];

  let signups30d = 0;
  let proConversions30d = 0;

  if (emails.length > 0) {
    const { count: signupCount } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .in('email', emails);

    signups30d = signupCount || 0;

    const { count: proCount } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .in('email', emails)
      .eq('tier', 'pro');

    proConversions30d = proCount || 0;
  }

  // Estimate 30d impressions from seo_metrics
  const thirtyDaysStr = thirtyDaysAgo.toISOString().split('T')[0];
  const { data: variantMetrics } = await supabase
    .from('seo_metrics')
    .select('data')
    .eq('metric_type', 'exit_intent_variant')
    .gte('metric_date', thirtyDaysStr);

  let totalImpressions30d = 0;
  for (const row of variantMetrics || []) {
    const d = row.data as Record<string, number> | null;
    totalImpressions30d += d?.impressions || 0;
  }

  const overallCaptureRate =
    totalImpressions30d > 0
      ? ((totalCaptures || 0) / totalImpressions30d * 100).toFixed(1) + '%'
      : 'N/A';

  return {
    totalCaptures30d: totalCaptures || 0,
    totalSignups30d: signups30d,
    totalProConversions30d: proConversions30d,
    overallCaptureRate,
  };
}

// ── Slack digest ───────────────────────────────────────────────────────────

async function sendSlackDigest(
  config: ExitIntentConfig,
  weekPerformance: VariantPerformance,
  rotation: RotationResult,
  overall: OverallMetrics
): Promise<void> {
  const webhookUrl =
    process.env.SLACK_SEO_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const captureRate =
    weekPerformance.impressions > 0
      ? ((weekPerformance.captures / weekPerformance.impressions) * 100).toFixed(1)
      : '0.0';

  const activeVariantData = VARIANTS.find(
    (v) => v.id === rotation.newVariant
  );

  // Build variant comparison table
  const variantStats = new Map<string, { captures: number; impressions: number }>();
  for (const entry of config.variant_history) {
    const existing = variantStats.get(entry.variant_id) || {
      captures: 0,
      impressions: 0,
    };
    existing.captures += entry.captures;
    existing.impressions += entry.impressions;
    variantStats.set(entry.variant_id, existing);
  }

  const variantLines = VARIANTS.map((v) => {
    const stats = variantStats.get(v.id);
    if (!stats) return `  ${v.id}: _No data yet_`;
    const rate =
      stats.impressions > 0
        ? ((stats.captures / stats.impressions) * 100).toFixed(1) + '%'
        : 'N/A';
    return `  ${v.id}: ${stats.captures} captures / ${stats.impressions} imp = ${rate}`;
  }).join('\n');

  const statusEmoji =
    rotation.action === 'locked'
      ? 'trophy'
      : rotation.action === 'rotated'
        ? 'arrows_counterclockwise'
        : 'lock';

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Exit-Intent Intelligence — Weekly Report`,
        attachments: [
          {
            color: '#10b981',
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: 'Exit-Intent Intelligence — Weekly Report',
                  emoji: true,
                },
              },
              {
                type: 'section',
                fields: [
                  {
                    type: 'mrkdwn',
                    text: `*This Week:*\n${weekPerformance.captures} captures, ${weekPerformance.signups} signups, ${weekPerformance.pro_conversions} Pro`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Capture Rate:*\n~${captureRate}%`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*30-Day Totals:*\n${overall.totalCaptures30d} captures, ${overall.totalSignups30d} signups, ${overall.totalProConversions30d} Pro`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*30-Day Capture Rate:*\n${overall.overallCaptureRate}`,
                  },
                ],
              },
              { type: 'divider' },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*:${statusEmoji}: Active Variant: ${rotation.newVariant}* (Week ${rotation.newWeek}/${ROTATION_WEEKS})\n_"${activeVariantData?.subtext || ''}"_`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Variant Comparison:*\n\`\`\`\n${variantLines}\n\`\`\``,
                },
              },
              ...(rotation.lockedWinner
                ? [
                    {
                      type: 'section' as const,
                      text: {
                        type: 'mrkdwn' as const,
                        text: `*Winner Locked:* Variant ${rotation.lockedWinner} selected as permanent copy after ${ROTATION_WEEKS}-week rotation.`,
                      },
                    },
                  ]
                : []),
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: 'Exit-intent shown to non-paid desktop users leaving viewport | Captures via newsletter_subscribers (source=exit_intent)',
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
      '[exit-intent-optimizer] Slack notification error:',
      err instanceof Error ? err.message : 'Unknown'
    );
  }
}
