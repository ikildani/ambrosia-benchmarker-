/**
 * Cron Intelligence Layer — The Brain
 *
 * Makes every cron self-aware and self-adjusting by providing:
 * A. Performance tracking with anomaly detection
 * B. Adaptive thresholds that auto-tune based on recent results
 * C. Stall alerts via Slack when crons produce zero output
 *
 * Usage: import into any cron route and call after the main work is done.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export type CronHealthStatus =
  | 'healthy'
  | 'stalled'
  | 'degraded'
  | 'error_spike'
  | 'no_history';

export interface CronHealthReport {
  status: CronHealthStatus;
  cronName: string;
  consecutiveZeroRuns: number;
  insertRateVsLastWeek: number | null; // e.g. -0.6 means 60% drop
  errorRateVsLastWeek: number | null;
  recommendation: string;
  suggestedThresholdAdjustments: Record<string, { current: number; suggested: number; reason: string }>;
}

interface CronRunRecord {
  records_processed: number;
  records_inserted: number;
  records_failed: number;
  created_at: string;
  parameters: Record<string, unknown> | null;
}

// ── A. Performance Tracking ──────────────────────────────────────────────────

/**
 * Track cron performance and detect anomalies by comparing to recent history.
 *
 * Call this at the end of each cron run (in addition to logCronRun) to get
 * back a health report with status, recommendation, and threshold suggestions.
 */
export async function trackCronPerformance(
  supabase: SupabaseClient,
  cronName: string,
  metrics: {
    processed: number;
    inserted: number;
    skipped: number;
    errors: number;
    thresholds?: Record<string, number>;
  }
): Promise<CronHealthReport> {
  // Fetch the last 7 runs for this cron (ordered newest first)
  const { data: recentRuns } = await supabase
    .from('data_ingestion_log')
    .select('records_processed, records_inserted, records_failed, created_at, parameters')
    .eq('source', cronName)
    .order('created_at', { ascending: false })
    .limit(7);

  const runs = (recentRuns || []) as CronRunRecord[];

  if (runs.length === 0) {
    return {
      status: 'no_history',
      cronName,
      consecutiveZeroRuns: metrics.inserted === 0 ? 1 : 0,
      insertRateVsLastWeek: null,
      errorRateVsLastWeek: null,
      recommendation: 'First run — no historical data to compare against.',
      suggestedThresholdAdjustments: {},
    };
  }

  // Count consecutive zero-insertion runs (including this one)
  let consecutiveZeroRuns = 0;
  if (metrics.inserted === 0) {
    consecutiveZeroRuns = 1;
    for (const run of runs) {
      if (run.records_inserted === 0) {
        consecutiveZeroRuns++;
      } else {
        break;
      }
    }
  }

  // Calculate insert rate: inserted / processed for this run vs avg of last 7
  const thisInsertRate = metrics.processed > 0 ? metrics.inserted / metrics.processed : 0;
  const pastInsertRates = runs
    .filter((r) => r.records_processed > 0)
    .map((r) => r.records_inserted / r.records_processed);
  const avgPastInsertRate =
    pastInsertRates.length > 0
      ? pastInsertRates.reduce((a, b) => a + b, 0) / pastInsertRates.length
      : 0;
  const insertRateVsLastWeek =
    avgPastInsertRate > 0 ? (thisInsertRate - avgPastInsertRate) / avgPastInsertRate : null;

  // Calculate error rate change
  const pastErrorRates = runs
    .filter((r) => r.records_processed > 0)
    .map((r) => r.records_failed / r.records_processed);
  const avgPastErrorRate =
    pastErrorRates.length > 0
      ? pastErrorRates.reduce((a, b) => a + b, 0) / pastErrorRates.length
      : 0;
  const thisErrorRate = metrics.processed > 0 ? metrics.errors / metrics.processed : 0;
  const errorRateVsLastWeek =
    avgPastErrorRate > 0 ? (thisErrorRate - avgPastErrorRate) / avgPastErrorRate : null;

  // Determine status
  let status: CronHealthStatus = 'healthy';
  let recommendation = 'Operating normally.';
  const suggestedThresholdAdjustments: Record<string, { current: number; suggested: number; reason: string }> = {};

  if (consecutiveZeroRuns >= 3) {
    status = 'stalled';
    recommendation =
      `${consecutiveZeroRuns} consecutive runs with zero output. ` +
      'Possible causes: (1) threshold too strict — lower filter thresholds, ' +
      '(2) data source is empty or API key expired, ' +
      '(3) dedup filter is too aggressive — all items already processed.';

    // Suggest lowering thresholds if provided
    if (metrics.thresholds) {
      for (const [name, value] of Object.entries(metrics.thresholds)) {
        suggestedThresholdAdjustments[name] = {
          current: value,
          suggested: Math.max(Math.round(value * 0.5), 1),
          reason: `Stalled for ${consecutiveZeroRuns} runs — halving threshold to find candidates`,
        };
      }
    }
  } else if (insertRateVsLastWeek !== null && insertRateVsLastWeek < -0.5) {
    status = 'degraded';
    recommendation =
      `Insert rate dropped ${Math.abs(Math.round(insertRateVsLastWeek * 100))}% vs recent average. ` +
      'Check if data quality changed or if validation filters became too strict.';
  } else if (errorRateVsLastWeek !== null && errorRateVsLastWeek > 1.0) {
    status = 'error_spike';
    recommendation =
      `Error rate increased ${Math.round(errorRateVsLastWeek * 100)}% vs recent average. ` +
      'Check API availability, network issues, or malformed data from source.';
  }

  return {
    status,
    cronName,
    consecutiveZeroRuns,
    insertRateVsLastWeek,
    errorRateVsLastWeek,
    recommendation,
    suggestedThresholdAdjustments,
  };
}

// ── B. Adaptive Thresholds ──────────────────────────────────────────────────

/**
 * Get an adaptive threshold that auto-adjusts based on recent cron performance.
 *
 * If recent runs had zero output, the threshold is lowered (making it easier
 * to find candidates). If recent runs had plenty of output, the threshold is
 * raised (maintaining quality bar).
 *
 * The adapted value is persisted in `system_config` so it survives restarts
 * and can be inspected.
 */
export async function getAdaptiveThreshold(
  supabase: SupabaseClient,
  cronName: string,
  thresholdName: string,
  defaultValue: number,
  config?: {
    minValue: number;
    maxValue: number;
    stepDown: number;
    stepUp: number;
  }
): Promise<number> {
  const bounds = config || {
    minValue: Math.round(defaultValue * 0.1),
    maxValue: Math.round(defaultValue * 5),
    stepDown: Math.round(defaultValue * 0.25),
    stepUp: Math.round(defaultValue * 0.5),
  };

  const configKey = `adaptive_threshold:${cronName}:${thresholdName}`;

  // Read persisted value from system_config
  const { data: existing } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', configKey)
    .single();

  let currentValue = existing?.value?.threshold ?? defaultValue;

  // Read the last 3 runs for this cron
  const { data: recentRuns } = await supabase
    .from('data_ingestion_log')
    .select('records_inserted, records_processed')
    .eq('source', cronName)
    .order('created_at', { ascending: false })
    .limit(3);

  const runs = (recentRuns || []) as { records_inserted: number; records_processed: number }[];

  if (runs.length >= 3) {
    const allZero = runs.every((r) => r.records_inserted === 0);
    const allProductive = runs.every((r) => r.records_inserted > 10);

    if (allZero) {
      // Lower threshold to find more candidates
      currentValue = Math.max(currentValue - bounds.stepDown, bounds.minValue);
    } else if (allProductive) {
      // Raise threshold to maintain quality
      currentValue = Math.min(currentValue + bounds.stepUp, bounds.maxValue);
    }
    // else: mixed results, keep current value
  }

  // Clamp
  currentValue = Math.max(bounds.minValue, Math.min(bounds.maxValue, currentValue));

  // Persist the adapted value
  try {
    await supabase.from('system_config').upsert(
      {
        key: configKey,
        value: {
          threshold: currentValue,
          defaultValue,
          cronName,
          thresholdName,
          updatedAt: new Date().toISOString(),
          bounds,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch {
    console.error(`[cron-intelligence] Failed to persist adaptive threshold for ${configKey}`);
  }

  return currentValue;
}

// ── C. Health Alert ──────────────────────────────────────────────────────────

/**
 * Send a Slack alert if a cron has had N consecutive runs with zero output.
 *
 * Should be called after trackCronPerformance if the status is "stalled".
 */
export async function alertIfStalled(
  supabase: SupabaseClient,
  cronName: string,
  consecutiveZeroRuns: number
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  // Find the last successful run (records_inserted > 0)
  const { data: lastSuccess } = await supabase
    .from('data_ingestion_log')
    .select('created_at')
    .eq('source', cronName)
    .gt('records_inserted', 0)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const lastSuccessDate = lastSuccess?.created_at
    ? new Date(lastSuccess.created_at).toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'medium',
      })
    : 'Never';

  const daysSinceSuccess = lastSuccess?.created_at
    ? Math.round(
        (Date.now() - new Date(lastSuccess.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  // Build diagnosis suggestions
  const diagnosisList = [
    'Threshold too strict? Try lowering filter thresholds.',
    'API key expired? Check external API credentials.',
    'Data source empty? Verify the upstream source is still publishing.',
    'Dedup too aggressive? All new items may already exist in the database.',
  ];

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Stalled cron alert: ${cronName} (${consecutiveZeroRuns} zero runs)`,
        attachments: [
          {
            color: '#e74c3c',
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: `Stalled Cron: ${cronName}`,
                  emoji: true,
                },
              },
              {
                type: 'section',
                fields: [
                  {
                    type: 'mrkdwn',
                    text: `*Consecutive zero runs:*\n${consecutiveZeroRuns}`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Last successful run:*\n${lastSuccessDate}${daysSinceSuccess !== null ? ` (${daysSinceSuccess}d ago)` : ''}`,
                  },
                ],
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Suggested diagnosis:*\n${diagnosisList.map((d) => `- ${d}`).join('\n')}`,
                },
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    console.error(`[cron-intelligence] Slack stall alert failed for ${cronName}:`, err);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convenience wrapper: track performance, alert if stalled, return health report.
 * Drop-in addition to any cron that already calls logCronRun().
 */
export async function runCronIntelligence(
  supabase: SupabaseClient,
  cronName: string,
  metrics: {
    processed: number;
    inserted: number;
    skipped: number;
    errors: number;
    thresholds?: Record<string, number>;
  }
): Promise<CronHealthReport> {
  const report = await trackCronPerformance(supabase, cronName, metrics);

  if (report.status === 'stalled' && report.consecutiveZeroRuns >= 3) {
    await alertIfStalled(supabase, cronName, report.consecutiveZeroRuns);
  }

  // Log the intelligence report as a parameter on the existing ingestion log
  // (non-blocking — don't let failures break the cron)
  try {
    const { data: latestLog } = await supabase
      .from('data_ingestion_log')
      .select('id')
      .eq('source', cronName)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestLog?.id) {
      await supabase
        .from('data_ingestion_log')
        .update({
          parameters: {
            intelligence: {
              status: report.status,
              consecutiveZeroRuns: report.consecutiveZeroRuns,
              insertRateVsLastWeek: report.insertRateVsLastWeek,
              errorRateVsLastWeek: report.errorRateVsLastWeek,
              recommendation: report.recommendation,
              thresholdAdjustments: report.suggestedThresholdAdjustments,
            },
          },
        })
        .eq('id', latestLog.id);
    }
  } catch {
    // Non-fatal — intelligence metadata is nice-to-have
  }

  return report;
}
