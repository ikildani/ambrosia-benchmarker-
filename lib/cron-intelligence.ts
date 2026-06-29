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
    skipped?: number;
    errors?: number;
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
  const thisErrorRate = metrics.processed > 0 ? (metrics.errors ?? 0) / metrics.processed : 0;
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
    skipped?: number;
    errors?: number;
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

// ── Types for Intelligence Bus ──────────────────────────────────────────────

export interface UserDemandSignals {
  topTherapeuticAreas: Array<{ ta: string; count: number }>;
  topModalities: Array<{ modality: string; count: number }>;
  topIndications: Array<{ indication: string; count: number }>;
  trendingSearches: string[];
  updatedAt: string;
}

export interface IntelligenceBus {
  winningTopics: Array<{ ta: string; modality: string; conversionRate: number }>;
  titleStrategiesThatWork: string[];
  titleStrategiesThatFailed: string[];
  newCompetitorQueries: string[];
  activeExitIntentVariant: string;
  priorityTAs: string[];
  updatedAt: string;
}

export const EMPTY_DEMAND_SIGNALS: UserDemandSignals = {
  topTherapeuticAreas: [],
  topModalities: [],
  topIndications: [],
  trendingSearches: [],
  updatedAt: '',
};

export const EMPTY_INTELLIGENCE_BUS: IntelligenceBus = {
  winningTopics: [],
  titleStrategiesThatWork: [],
  titleStrategiesThatFailed: [],
  newCompetitorQueries: [],
  activeExitIntentVariant: '',
  priorityTAs: [],
  updatedAt: '',
};

// ── D. User Demand Signal Collector ─────────────────────────────────────────

/**
 * Collect what users are actually doing — which TAs, modalities, and
 * indications are most popular. Stores the result in system_config so
 * every cron can read it without re-querying.
 */
export async function collectUserDemandSignals(
  supabase: SupabaseClient
): Promise<UserDemandSignals> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Query calculations for TA and modality popularity
  const { data: recentCalcs } = await supabase
    .from('calculations')
    .select('therapeutic_area, modality, indication')
    .gte('created_at', sevenDaysAgo)
    .limit(5000);

  const calcs = recentCalcs || [];

  // Count therapeutic areas
  const taCounts = new Map<string, number>();
  const modalityCounts = new Map<string, number>();
  const indicationCounts = new Map<string, number>();

  for (const calc of calcs) {
    if (calc.therapeutic_area) {
      taCounts.set(calc.therapeutic_area, (taCounts.get(calc.therapeutic_area) || 0) + 1);
    }
    if (calc.modality) {
      modalityCounts.set(calc.modality, (modalityCounts.get(calc.modality) || 0) + 1);
    }
    if (calc.indication) {
      indicationCounts.set(calc.indication, (indicationCounts.get(calc.indication) || 0) + 1);
    }
  }

  // Query sessions for page visit patterns (look for TA-related pages)
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('landing_page, referrer_url')
    .gte('started_at', sevenDaysAgo)
    .not('landing_page', 'is', null)
    .limit(2000);

  // Extract search terms from referrer URLs as trending searches
  const searchTerms = new Map<string, number>();
  for (const session of recentSessions || []) {
    const url = session.referrer_url || '';
    // Extract Google search queries from referrer
    const qMatch = url.match(/[?&]q=([^&]+)/);
    if (qMatch) {
      const term = decodeURIComponent(qMatch[1]).replace(/\+/g, ' ').toLowerCase().trim();
      if (term.length > 2 && term.length < 100) {
        searchTerms.set(term, (searchTerms.get(term) || 0) + 1);
      }
    }
  }

  // Query events for feature engagement
  const { data: recentEvents } = await supabase
    .from('events')
    .select('event_type, properties')
    .gte('created_at', sevenDaysAgo)
    .in('event_type', ['calculation_completed', 'report_generated', 'share_created'])
    .limit(2000);

  for (const event of recentEvents || []) {
    const props = event.properties as Record<string, string> | null;
    if (props?.therapeutic_area) {
      taCounts.set(props.therapeutic_area, (taCounts.get(props.therapeutic_area) || 0) + 1);
    }
    if (props?.modality) {
      modalityCounts.set(props.modality, (modalityCounts.get(props.modality) || 0) + 1);
    }
  }

  const signals: UserDemandSignals = {
    topTherapeuticAreas: Array.from(taCounts.entries())
      .map(([ta, count]) => ({ ta, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    topModalities: Array.from(modalityCounts.entries())
      .map(([modality, count]) => ({ modality, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    topIndications: Array.from(indicationCounts.entries())
      .map(([indication, count]) => ({ indication, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30),
    trendingSearches: Array.from(searchTerms.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([term]) => term),
    updatedAt: new Date().toISOString(),
  };

  // Store in system_config for all crons to read
  try {
    await supabase.from('system_config').upsert(
      {
        key: 'user_demand_signals',
        value: signals,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch {
    console.error('[cron-intelligence] Failed to store user demand signals');
  }

  return signals;
}

// ── E. Cross-Cron Intelligence Bus ──────────────────────────────────────────

/**
 * Read the shared intelligence bus from system_config.
 * Each feedback-loop cron writes its learnings here; other crons read them.
 */
export async function getCronIntelligenceBus(
  supabase: SupabaseClient
): Promise<IntelligenceBus> {
  try {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'cron_intelligence_bus')
      .single();

    if (data?.value) {
      return { ...EMPTY_INTELLIGENCE_BUS, ...(data.value as Partial<IntelligenceBus>) };
    }
  } catch {
    // First run or table doesn't exist yet — return empty
  }

  return { ...EMPTY_INTELLIGENCE_BUS };
}

/**
 * Update specific fields on the intelligence bus (merge, not replace).
 * Called by feedback-loop crons after they complete their analysis.
 */
export async function updateIntelligenceBus(
  supabase: SupabaseClient,
  updates: Partial<Omit<IntelligenceBus, 'updatedAt'>>
): Promise<void> {
  try {
    // Read current bus state
    const current = await getCronIntelligenceBus(supabase);

    // Merge updates
    const merged: IntelligenceBus = {
      winningTopics: updates.winningTopics ?? current.winningTopics,
      titleStrategiesThatWork: updates.titleStrategiesThatWork ?? current.titleStrategiesThatWork,
      titleStrategiesThatFailed: updates.titleStrategiesThatFailed ?? current.titleStrategiesThatFailed,
      newCompetitorQueries: updates.newCompetitorQueries ?? current.newCompetitorQueries,
      activeExitIntentVariant: updates.activeExitIntentVariant ?? current.activeExitIntentVariant,
      priorityTAs: updates.priorityTAs ?? current.priorityTAs,
      updatedAt: new Date().toISOString(),
    };

    await supabase.from('system_config').upsert(
      {
        key: 'cron_intelligence_bus',
        value: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch (err) {
    console.error('[cron-intelligence] Failed to update intelligence bus:', err);
  }
}

// ── F. Auto-Remediation ─────────────────────────────────────────────────────

/**
 * Automatic remediation actions when a cron is unhealthy.
 * Returns a list of actions taken (for logging/Slack).
 */
export async function autoRemediate(
  supabase: SupabaseClient,
  cronName: string,
  health: CronHealthReport
): Promise<string[]> {
  const actions: string[] = [];

  // 1. Stalled >= 5 runs: lower all adaptive thresholds by one step
  if (health.consecutiveZeroRuns >= 5) {
    const { data: thresholdConfigs } = await supabase
      .from('system_config')
      .select('key, value')
      .like('key', `adaptive_threshold:${cronName}:%`);

    for (const config of thresholdConfigs || []) {
      const val = config.value as {
        threshold: number;
        defaultValue: number;
        bounds?: { minValue: number; stepDown: number };
      } | null;

      if (!val) continue;

      const minValue = val.bounds?.minValue ?? Math.round(val.defaultValue * 0.1);
      const stepDown = val.bounds?.stepDown ?? Math.round(val.defaultValue * 0.25);
      const newThreshold = Math.max(val.threshold - stepDown, minValue);

      if (newThreshold < val.threshold) {
        await supabase
          .from('system_config')
          .update({
            value: {
              ...val,
              threshold: newThreshold,
              autoRemediated: true,
              remediatedAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('key', config.key);

        actions.push(
          `Lowered threshold ${config.key.split(':').pop()} from ${val.threshold} to ${newThreshold}`
        );
      }
    }

    if (actions.length === 0 && health.consecutiveZeroRuns >= 5) {
      actions.push(`No thresholds to lower for ${cronName} — stall may be data-source related`);
    }
  }

  // 2. Stalled >= 10 runs: escalation alert
  if (health.consecutiveZeroRuns >= 10) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `ESCALATION: ${cronName} has been stalled for ${health.consecutiveZeroRuns} consecutive runs`,
            attachments: [
              {
                color: '#dc2626',
                blocks: [
                  {
                    type: 'header',
                    text: {
                      type: 'plain_text',
                      text: `ESCALATION: ${cronName} — ${health.consecutiveZeroRuns} Consecutive Zero Runs`,
                    },
                  },
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: [
                        `*Status:* ${health.status}`,
                        `*Recommendation:* ${health.recommendation}`,
                        `*Auto-Remediation Actions:*`,
                        ...actions.map((a) => `- ${a}`),
                        '',
                        '_This cron requires manual investigation. All automatic remediation has been applied._',
                      ].join('\n'),
                    },
                  },
                ],
              },
            ],
          }),
        });
        actions.push('Sent escalation Slack alert');
      } catch {
        actions.push('Failed to send escalation Slack alert');
      }
    }
  }

  // 3. High error rate: log error patterns
  if (
    health.errorRateVsLastWeek !== null &&
    health.errorRateVsLastWeek > 0.5
  ) {
    // Fetch recent error logs for this cron to identify patterns
    const { data: errorLogs } = await supabase
      .from('data_ingestion_log')
      .select('errors, created_at')
      .eq('source', cronName)
      .not('errors', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    const errorPatterns = new Map<string, number>();
    for (const log of errorLogs || []) {
      const errors = log.errors as string[] | null;
      for (const err of errors || []) {
        // Extract error type/prefix (first 80 chars)
        const key = err.slice(0, 80);
        errorPatterns.set(key, (errorPatterns.get(key) || 0) + 1);
      }
    }

    if (errorPatterns.size > 0) {
      const topErrors = Array.from(errorPatterns.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      // Store error pattern analysis in system_config
      await supabase.from('system_config').upsert(
        {
          key: `error_patterns:${cronName}`,
          value: {
            topErrors: topErrors.map(([pattern, count]) => ({ pattern, count })),
            analyzedAt: new Date().toISOString(),
            errorRateVsLastWeek: health.errorRateVsLastWeek,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

      actions.push(
        `Logged ${topErrors.length} error pattern(s): ${topErrors.map(([p, c]) => `"${p.slice(0, 40)}..." (${c}x)`).join(', ')}`
      );
    }
  }

  return actions;
}
