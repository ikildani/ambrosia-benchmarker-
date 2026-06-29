/**
 * Universal Cron Wrapper — Intelligence-Aware Harness
 *
 * Wraps any cron route handler with:
 * - Timing-safe CRON_SECRET auth
 * - Supabase service client creation
 * - User demand signals + intelligence bus loading (gracefully degraded)
 * - Automatic performance tracking and health reporting
 * - Stall detection with Slack alerts
 * - Auto-remediation for unhealthy crons
 * - Consistent JSON response shape
 *
 * Usage:
 *   export async function GET(request: NextRequest) {
 *     return withCronIntelligence('my-cron', request, async (supabase, ctx) => {
 *       // do work, optionally use ctx.priorities and ctx.bus
 *       return { processed: 10, inserted: 5, skipped: 3, errors: [] };
 *     });
 *   }
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import {
  trackCronPerformance,
  alertIfStalled,
  collectUserDemandSignals,
  getCronIntelligenceBus,
  autoRemediate,
  EMPTY_DEMAND_SIGNALS,
  EMPTY_INTELLIGENCE_BUS,
} from '@/lib/cron-intelligence';
import type {
  CronHealthReport,
  CronHealthStatus,
  UserDemandSignals,
  IntelligenceBus,
} from '@/lib/cron-intelligence';

// Re-export types so consumers can import from either module
export type { UserDemandSignals, IntelligenceBus, CronHealthReport };

// ── Types ────────────────────────────────────────────────────────────────────

export interface CronContext {
  supabase: SupabaseClient;
  priorities: UserDemandSignals;
  bus: IntelligenceBus;
  health: CronHealthReport;
}

interface CronResult {
  processed?: number;
  inserted?: number;
  skipped?: number;
  errors?: string[];
  [key: string]: unknown;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

function defaultHealthReport(cronName: string): CronHealthReport {
  return {
    status: 'no_history' as CronHealthStatus,
    cronName,
    consecutiveZeroRuns: 0,
    insertRateVsLastWeek: null,
    errorRateVsLastWeek: null,
    recommendation: 'Pre-run — health will be assessed after execution.',
    suggestedThresholdAdjustments: {},
  };
}

// ── Auth ─────────────────────────────────────────────────────────────────────

function authenticateRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const secret = process.env.CRON_SECRET || '';

  if (!token || !secret || token.length !== secret.length) {
    return false;
  }

  try {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    return crypto.timingSafeEqual(tokenBuf, secretBuf);
  } catch {
    return false;
  }
}

// ── Slack Alert (hard failures) ──────────────────────────────────────────────

async function slackAlertHardFailure(cronName: string, error: unknown): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const errorMessage =
    error instanceof Error ? error.message : String(error);
  const errorStack =
    error instanceof Error ? error.stack?.slice(0, 500) : undefined;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Hard failure in cron: ${cronName}`,
        attachments: [
          {
            color: '#e74c3c',
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: `Cron Hard Failure: ${cronName}`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Error:*\n\`\`\`${errorMessage}\`\`\``,
                },
              },
              ...(errorStack
                ? [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `*Stack (truncated):*\n\`\`\`${errorStack}\`\`\``,
                      },
                    },
                  ]
                : []),
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `Occurred at ${new Date().toISOString()}`,
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
  } catch (slackErr) {
    console.error(`[cron-wrapper] Slack hard-failure alert failed for ${cronName}:`, slackErr);
  }
}

// ── Main Wrapper ─────────────────────────────────────────────────────────────

export async function withCronIntelligence(
  cronName: string,
  request: NextRequest,
  handler: (supabase: SupabaseClient, context: CronContext) => Promise<CronResult>,
  options?: { maxDurationMs?: number; skipIntelligence?: boolean }
): Promise<NextResponse> {
  // ── Auth ──
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // ── Supabase client ──
    const supabase = createServiceClient();

    // ── Load intelligence (gracefully degraded) ──
    let priorities: UserDemandSignals = EMPTY_DEMAND_SIGNALS;
    let bus: IntelligenceBus = EMPTY_INTELLIGENCE_BUS;

    if (!options?.skipIntelligence) {
      try {
        const [loadedPriorities, loadedBus] = await Promise.all([
          collectUserDemandSignals(supabase).catch((err) => {
            console.error(`[cron-wrapper] collectUserDemandSignals failed for ${cronName}:`, err);
            return EMPTY_DEMAND_SIGNALS;
          }),
          getCronIntelligenceBus(supabase).catch((err) => {
            console.error(`[cron-wrapper] getCronIntelligenceBus failed for ${cronName}:`, err);
            return EMPTY_INTELLIGENCE_BUS;
          }),
        ]);
        priorities = loadedPriorities;
        bus = loadedBus;
      } catch (intellErr) {
        console.error(`[cron-wrapper] Intelligence loading failed for ${cronName}:`, intellErr);
        // Continue with empty defaults — the cron must still run
      }
    }

    // ── Build context ──
    const context: CronContext = {
      supabase,
      priorities,
      bus,
      health: defaultHealthReport(cronName),
    };

    // ── Execute handler ──
    const result = await handler(supabase, context);
    const durationMs = Date.now() - startTime;

    // ── Log the run ──
    await logCronRun(supabase, cronName, {
      processed: result.processed,
      inserted: result.inserted,
      errors: result.errors,
    });

    // ── Track performance and get health report ──
    let health: CronHealthReport = defaultHealthReport(cronName);
    try {
      health = await trackCronPerformance(supabase, cronName, {
        processed: result.processed || 0,
        inserted: result.inserted || 0,
        skipped: result.skipped || 0,
        errors: result.errors?.length || 0,
      });
    } catch (trackErr) {
      console.error(`[cron-wrapper] trackCronPerformance failed for ${cronName}:`, trackErr);
    }

    // ── Stall alert ──
    if (health.status === 'stalled' && health.consecutiveZeroRuns >= 3) {
      try {
        await alertIfStalled(supabase, cronName, health.consecutiveZeroRuns);
      } catch (stallErr) {
        console.error(`[cron-wrapper] alertIfStalled failed for ${cronName}:`, stallErr);
      }
    }

    // ── Auto-remediate ──
    let remediationActions: string[] = [];
    if (health.status !== 'healthy' && health.status !== 'no_history') {
      try {
        remediationActions = await autoRemediate(supabase, cronName, health);
      } catch (remErr) {
        console.error(`[cron-wrapper] autoRemediate failed for ${cronName}:`, remErr);
      }
    }

    return NextResponse.json({
      success: true,
      cronName,
      durationMs,
      result,
      health: {
        status: health.status,
        consecutiveZeroRuns: health.consecutiveZeroRuns,
        insertRateVsLastWeek: health.insertRateVsLastWeek,
        errorRateVsLastWeek: health.errorRateVsLastWeek,
        recommendation: health.recommendation,
      },
      ...(remediationActions.length > 0 ? { remediationActions } : {}),
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[cron-wrapper] Hard failure in ${cronName}:`, error);

    // ── Log the failed run ──
    try {
      const supabase = createServiceClient();
      await logCronRun(supabase, cronName, {
        processed: 0,
        inserted: 0,
        errors: [errorMessage],
      });
    } catch (logErr) {
      console.error(`[cron-wrapper] Failed to log error run for ${cronName}:`, logErr);
    }

    // ── Slack alert for hard failures ──
    await slackAlertHardFailure(cronName, error);

    return NextResponse.json(
      {
        success: false,
        cronName,
        durationMs,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
