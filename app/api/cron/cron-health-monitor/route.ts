/**
 * Weekly Cron Health Monitor — The Meta-Cron
 *
 * Runs every Sunday at 8AM UTC and reviews ALL cron performance:
 * - Flags stalled, missing, or error-prone crons
 * - Cross-cron intelligence (content-performance → seo-content, etc.)
 * - Reports on adaptive threshold adjustments
 * - Sends a comprehensive Slack report
 *
 * Schedule: 0 8 * * 0 (Sundays 8AM UTC)
 * Auth: Bearer token matched against CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';

export const maxDuration = 120;

// All known cron sources and their expected frequencies.
// "daily" = should have 7+ runs/week, "weekly" = 1+ run/week, etc.
const KNOWN_CRONS: Record<string, { frequency: string; expectedRunsPerWeek: number }> = {
  // Data ingestion crons
  'edgar_realtime': { frequency: 'every-2h', expectedRunsPerWeek: 84 },
  'perplexity_discovery': { frequency: 'every-4h', expectedRunsPerWeek: 42 },
  'press_releases_cron': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'deals-update': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'deal-backfill': { frequency: 'every-6h', expectedRunsPerWeek: 28 },
  'deal-enrichment': { frequency: '3x-daily', expectedRunsPerWeek: 21 },
  'deal_verification': { frequency: '2x-daily', expectedRunsPerWeek: 14 },
  'ftc-update': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'trials-update': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'embed-deals': { frequency: '3x-daily', expectedRunsPerWeek: 21 },

  // SEO crons
  'seo-content': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'seo-page-render': { frequency: '2x-weekly', expectedRunsPerWeek: 2 },
  'ctr-optimize': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'ctr-validation': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'content-performance': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'comparison-optimizer': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'seo-performance': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'seo-health': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'gsc-sync': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'seo-content-suggestions': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'seo-page-expand': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'exit-intent-optimizer': { frequency: 'weekly', expectedRunsPerWeek: 1 },

  // Business crons
  'daily-stats': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'lead-scores': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'qa-health-check': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'onboarding-drip': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'drip-emails': { frequency: 'every-6h', expectedRunsPerWeek: 28 },
  'pro-gate-drip': { frequency: 'every-6h', expectedRunsPerWeek: 28 },
  'churn-prevention': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'weekly-digest': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'admin-deal-digest': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'competitor-intel': { frequency: 'daily', expectedRunsPerWeek: 7 },

  // Calibration crons
  'rnpv-regression': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'engine-static-scan': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'benchmark-calibration': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'intent-calibration': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'intent-calibration-v2': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'intent-snapshots': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'deal-completeness': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'deal-data-health': { frequency: 'monthly', expectedRunsPerWeek: 0.25 },
  'macro-factors': { frequency: 'daily', expectedRunsPerWeek: 7 },

  // Lifecycle crons
  'pro-expiration': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'smart-trial-extend': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'calculation-convert': { frequency: 'every-4h', expectedRunsPerWeek: 42 },
  'report-upsell': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'abandoned-checkout': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'dunning': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'winback': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'trial-onboarding': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'outbound-attribution': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'domain-clustering': { frequency: 'daily', expectedRunsPerWeek: 7 },

  // Other
  'company-enrichment': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  're-extract-pending': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'research-enrichment': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'indication-enrichment': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'publications-update': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'distribution-monitor': { frequency: 'daily', expectedRunsPerWeek: 7 },
  'portfolio-deal-alerts': { frequency: 'every-4h', expectedRunsPerWeek: 42 },
  'portfolio-activity-digest': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'apollo-auto-enroll': { frequency: '3x-weekly', expectedRunsPerWeek: 3 },
  'linkedin-content': { frequency: 'weekly', expectedRunsPerWeek: 1 },
  'pro-intel-digest': { frequency: 'weekly', expectedRunsPerWeek: 1 },
};

interface CronWeeklyStats {
  source: string;
  totalRuns: number;
  totalProcessed: number;
  totalInserted: number;
  totalFailed: number;
  successRate: number;
  consecutiveZeroRuns: number;
  trend: 'improving' | 'declining' | 'stable' | 'stalled' | 'no_data';
}

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
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 2. Query all ingestion logs from last 7 days
    const { data: thisWeekLogs } = await supabase
      .from('data_ingestion_log')
      .select('source, records_processed, records_inserted, records_failed, created_at, parameters')
      .gte('created_at', oneWeekAgo.toISOString())
      .order('created_at', { ascending: false });

    // 3. Query last week's logs for comparison
    const { data: lastWeekLogs } = await supabase
      .from('data_ingestion_log')
      .select('source, records_processed, records_inserted, records_failed')
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', oneWeekAgo.toISOString());

    const thisWeek = thisWeekLogs || [];
    const lastWeek = lastWeekLogs || [];

    // Group this week by source
    const thisWeekBySource = new Map<string, typeof thisWeek>();
    for (const log of thisWeek) {
      const existing = thisWeekBySource.get(log.source) || [];
      existing.push(log);
      thisWeekBySource.set(log.source, existing);
    }

    // Group last week by source (just totals)
    const lastWeekBySource = new Map<string, { totalInserted: number; totalProcessed: number }>();
    for (const log of lastWeek) {
      const existing = lastWeekBySource.get(log.source) || { totalInserted: 0, totalProcessed: 0 };
      existing.totalInserted += log.records_inserted || 0;
      existing.totalProcessed += log.records_processed || 0;
      lastWeekBySource.set(log.source, existing);
    }

    // 4. Compute stats for each cron
    const cronStats: CronWeeklyStats[] = [];
    const allSources = new Set([...thisWeekBySource.keys(), ...Object.keys(KNOWN_CRONS)]);

    for (const source of allSources) {
      const logs = thisWeekBySource.get(source) || [];
      const lastWeekData = lastWeekBySource.get(source);

      const totalRuns = logs.length;
      const totalProcessed = logs.reduce((s, l) => s + (l.records_processed || 0), 0);
      const totalInserted = logs.reduce((s, l) => s + (l.records_inserted || 0), 0);
      const totalFailed = logs.reduce((s, l) => s + (l.records_failed || 0), 0);
      const successRate = totalProcessed > 0 ? totalInserted / totalProcessed : 0;

      // Count consecutive zero runs (from most recent)
      let consecutiveZeroRuns = 0;
      for (const log of logs) {
        if ((log.records_inserted || 0) === 0) {
          consecutiveZeroRuns++;
        } else {
          break;
        }
      }

      // Determine trend
      let trend: CronWeeklyStats['trend'] = 'no_data';
      if (totalRuns === 0) {
        trend = 'no_data';
      } else if (consecutiveZeroRuns >= 3) {
        trend = 'stalled';
      } else if (lastWeekData && lastWeekData.totalProcessed > 0) {
        const lastWeekRate = lastWeekData.totalInserted / lastWeekData.totalProcessed;
        if (successRate > lastWeekRate * 1.1) {
          trend = 'improving';
        } else if (successRate < lastWeekRate * 0.7) {
          trend = 'declining';
        } else {
          trend = 'stable';
        }
      } else {
        trend = 'stable';
      }

      cronStats.push({
        source,
        totalRuns,
        totalProcessed,
        totalInserted,
        totalFailed,
        successRate,
        consecutiveZeroRuns,
        trend,
      });
    }

    // 5. Classify crons
    const healthy: CronWeeklyStats[] = [];
    const stalled: CronWeeklyStats[] = [];
    const errorProne: CronWeeklyStats[] = [];
    const notRunning: string[] = [];
    const declining: CronWeeklyStats[] = [];

    for (const stat of cronStats) {
      if (stat.totalRuns === 0 && KNOWN_CRONS[stat.source]) {
        notRunning.push(stat.source);
      } else if (stat.trend === 'stalled') {
        stalled.push(stat);
      } else if (stat.totalProcessed > 0 && stat.totalFailed / stat.totalProcessed > 0.2) {
        errorProne.push(stat);
      } else if (stat.trend === 'declining') {
        declining.push(stat);
      } else if (stat.totalRuns > 0) {
        healthy.push(stat);
      }
    }

    // 6. Cross-cron intelligence
    const crossCronInsights: string[] = [];

    // Check if content-performance found winning topics and seo-content queued them
    const contentPerfLogs = thisWeekBySource.get('content-performance') || [];
    const seoContentLogs = thisWeekBySource.get('seo-content') || [];
    if (contentPerfLogs.length > 0) {
      const latestPerf = contentPerfLogs[0];
      const perfParams = latestPerf.parameters as Record<string, unknown> | null;
      const winnersQueued = perfParams?.winnersQueued as number | undefined;
      if (winnersQueued && winnersQueued > 0) {
        const seoContentReactive = seoContentLogs.some((l) => {
          const params = l.parameters as Record<string, unknown> | null;
          return params?.reactivePublished && (params.reactivePublished as number) > 0;
        });
        if (!seoContentReactive) {
          crossCronInsights.push(
            `content-performance queued ${winnersQueued} winning topics, but seo-content has not processed any reactive items this week`
          );
        } else {
          crossCronInsights.push(
            `content-performance -> seo-content feedback loop is active (winners queued and processed)`
          );
        }
      }
    }

    // Check ctr-validation <-> ctr-optimize loop
    const ctrValLogs = thisWeekBySource.get('ctr-validation') || [];
    const ctrOptLogs = thisWeekBySource.get('ctr-optimize') || [];
    if (ctrValLogs.length > 0) {
      const latestVal = ctrValLogs[0];
      const valParams = latestVal.parameters as Record<string, unknown> | null;
      const reverted = valParams?.reverted as number | undefined;
      if (reverted && reverted > 0) {
        const ctrOptActive = ctrOptLogs.some((l) => (l.records_inserted || 0) > 0);
        if (ctrOptActive) {
          crossCronInsights.push(
            `ctr-validation reverted ${reverted} title(s) -- ctr-optimize is active and can retry with different approaches`
          );
        } else {
          crossCronInsights.push(
            `ctr-validation reverted ${reverted} title(s) -- but ctr-optimize has had 0 output, may need threshold adjustment`
          );
        }
      }
    }

    // Check deal-verification <-> content-performance loop
    const dealVerLogs = thisWeekBySource.get('deal_verification') || [];
    if (dealVerLogs.length > 0) {
      const totalVerified = dealVerLogs.reduce((s, l) => s + (l.records_inserted || 0), 0);
      if (totalVerified > 0 && contentPerfLogs.length === 0) {
        crossCronInsights.push(
          `deal-verification verified ${totalVerified} deal(s) this week, but content-performance did not run -- deal content may not be measured`
        );
      }
    }

    // 7. Check adaptive threshold adjustments
    const { data: adaptiveConfigs } = await supabase
      .from('system_config')
      .select('key, value')
      .like('key', 'adaptive_threshold:%');

    const thresholdAdjustments: { cron: string; threshold: string; current: number; default_: number }[] = [];
    for (const config of adaptiveConfigs || []) {
      const val = config.value as { cronName: string; thresholdName: string; threshold: number; defaultValue: number } | null;
      if (val && val.threshold !== val.defaultValue) {
        thresholdAdjustments.push({
          cron: val.cronName,
          threshold: val.thresholdName,
          current: val.threshold,
          default_: val.defaultValue,
        });
      }
    }

    // 8. Build Slack report
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      const blocks: object[] = [
        {
          type: 'header',
          text: { type: 'plain_text', text: 'Weekly Cron Intelligence Report', emoji: true },
        },
        { type: 'divider' },
      ];

      // Healthy summary
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            `*Healthy (${healthy.length}):* ` +
            (healthy.length > 0
              ? healthy
                  .sort((a, b) => b.totalInserted - a.totalInserted)
                  .slice(0, 10)
                  .map((c) => `${c.source} (${c.totalInserted}/${c.totalProcessed})`)
                  .join(', ') + (healthy.length > 10 ? ` +${healthy.length - 10} more` : '')
              : '_none_'),
        },
      });

      // Stalled
      if (stalled.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              `*Stalled (${stalled.length}):*\n` +
              stalled
                .map(
                  (c) =>
                    `- ${c.source}: ${c.totalInserted}/${c.totalProcessed} inserted, ${c.consecutiveZeroRuns} consecutive zeros`
                )
                .join('\n'),
          },
        });
      }

      // Error-prone
      if (errorProne.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              `*Error-Prone (${errorProne.length}):*\n` +
              errorProne
                .map(
                  (c) =>
                    `- ${c.source}: ${c.totalFailed}/${c.totalProcessed} failed (${Math.round((c.totalFailed / c.totalProcessed) * 100)}%)`
                )
                .join('\n'),
          },
        });
      }

      // Declining
      if (declining.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              `*Declining (${declining.length}):*\n` +
              declining
                .map((c) => `- ${c.source}: insert rate down vs last week`)
                .join('\n'),
          },
        });
      }

      // Not running
      if (notRunning.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              `*Not Running (${notRunning.length}):*\n` +
              notRunning.map((c) => `- ${c}`).join('\n'),
          },
        });
      }

      // Cross-cron intelligence
      if (crossCronInsights.length > 0) {
        blocks.push({ type: 'divider' });
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              '*Cross-Cron Intelligence:*\n' +
              crossCronInsights.map((i) => `- ${i}`).join('\n'),
          },
        });
      }

      // Adaptive threshold adjustments
      if (thresholdAdjustments.length > 0) {
        blocks.push({ type: 'divider' });
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              '*Adaptive Thresholds Adjusted:*\n' +
              thresholdAdjustments
                .map(
                  (t) =>
                    `- ${t.cron}: ${t.threshold} ${t.default_} -> ${t.current}${t.current < t.default_ ? ' (lowered — insufficient candidates)' : ' (raised — maintaining quality)'}`
                )
                .join('\n'),
          },
        });
      }

      // Summary context
      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Week of ${oneWeekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} | ${cronStats.length} crons tracked | ${thisWeek.length} total runs`,
          },
        ],
      });

      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `Weekly Cron Intelligence: ${healthy.length} healthy, ${stalled.length} stalled, ${notRunning.length} not running`,
            attachments: [
              {
                color: stalled.length > 0 || notRunning.length > 0 ? '#f59e0b' : '#2ecc71',
                blocks,
              },
            ],
          }),
        });
      } catch (slackErr) {
        console.error('[cron-health-monitor] Slack notification failed:', slackErr);
      }
    }

    // 9. Log this meta-cron's own run
    await logCronRun(supabase, 'cron-health-monitor', {
      processed: cronStats.length,
      inserted: healthy.length,
      errors: [
        ...stalled.map((s) => `stalled:${s.source}`),
        ...notRunning.map((n) => `not_running:${n}`),
        ...errorProne.map((e) => `error_prone:${e.source}`),
      ],
      parameters: {
        healthy: healthy.length,
        stalled: stalled.length,
        errorProne: errorProne.length,
        declining: declining.length,
        notRunning: notRunning.length,
        crossCronInsights: crossCronInsights.length,
        thresholdAdjustments: thresholdAdjustments.length,
      },
    });

    return NextResponse.json({
      success: true,
      summary: {
        healthy: healthy.length,
        stalled: stalled.length,
        errorProne: errorProne.length,
        declining: declining.length,
        notRunning: notRunning.length,
      },
      stalledCrons: stalled.map((s) => ({
        source: s.source,
        consecutiveZeroRuns: s.consecutiveZeroRuns,
        totalProcessed: s.totalProcessed,
      })),
      notRunningCrons: notRunning,
      crossCronInsights,
      thresholdAdjustments,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cron-health-monitor] Error:', message);

    await logCronRun(supabase, 'cron-health-monitor', {
      errors: [message],
      parameters: { stage: 'top-level' },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
