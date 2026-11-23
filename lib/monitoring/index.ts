/**
 * Revenue-path monitor: synthetic checks on the paths that make money.
 *
 * Schedule (rides on the hourly `api-credit-check` cron, :20 past each hour,
 * because vercel.json is at Vercel's 100-cron cap):
 *   - hourly checks every pass;
 *   - daily checks (password reset end to end, checkout session create/expire)
 *     and the Slack digest at DAILY_UTC_HOUR.
 * On demand: GET /api/cron/revenue-monitor (CRON_SECRET).
 *
 * State lives in system_config under STATE_KEY; Slack is posted only when a
 * check enters or leaves `fail`, plus the daily digest.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyMonitorTransitions, notifyMonitorDigest } from '@/lib/slack/notify';
import type { CheckResult, MonitorCheck, MonitorContext } from './types';
import { errMsg } from './types';
import { planAlerts, transitionLines, digestLines, type MonitorState, type Transition } from './alerts';
import { authConfigCheck, passwordResetCheck } from './checks/auth';
import { stripePricesCheck, checkoutSessionCheck, stripeWebhookCheck } from './checks/checkout';
import { calculatorDataCheck } from './checks/calculator';
import { ingestionFreshnessCheck, aiKeysCheck } from './checks/ingestion';
import { publicPagesCheck } from './checks/public-pages';
import { databaseCheck } from './checks/database';
import { emailSenderCheck } from './checks/email';

export const STATE_KEY = 'revenue_monitor_state';
/** 14:20 UTC: after the 12:20 flag-fix report and the 13:20 inflow check. */
export const DAILY_UTC_HOUR = 14;
export const CHECK_TIMEOUT_MS = 25_000;

export const ALL_CHECKS: MonitorCheck[] = [
  authConfigCheck,
  passwordResetCheck,
  stripePricesCheck,
  checkoutSessionCheck,
  stripeWebhookCheck,
  calculatorDataCheck,
  ingestionFreshnessCheck,
  aiKeysCheck,
  publicPagesCheck,
  databaseCheck,
  emailSenderCheck,
];

/**
 * hourly: hourly checks only. all: every check. auto (the cron): hourly checks,
 * plus each daily check that has not run in DAILY_MIN_GAP_H once the UTC day
 * reaches DAILY_UTC_HOUR, so a missed 14:20 run is picked up at 15:20.
 */
export type RunScope = 'hourly' | 'all' | 'auto';
export const DAILY_MIN_GAP_H = 23;

export function dailyDue(check: MonitorCheck, prev: MonitorState | null, now: Date): boolean {
  const last = prev?.checks[check.id]?.lastRun;
  if (!last) return true;
  if (now.getUTCHours() < DAILY_UTC_HOUR) return false;
  return (now.getTime() - Date.parse(last)) / 3_600_000 >= DAILY_MIN_GAP_H;
}

export function selectChecks(
  scope: RunScope,
  opts: { only?: string[]; prev?: MonitorState | null; now?: Date; checks?: MonitorCheck[] } = {},
): MonitorCheck[] {
  const checks = opts.checks ?? ALL_CHECKS;
  if (opts.only && opts.only.length) return checks.filter(c => opts.only!.includes(c.id));
  if (scope === 'all') return checks;
  if (scope === 'hourly') return checks.filter(c => c.cadence === 'hourly');
  const now = opts.now ?? new Date();
  return checks.filter(c => c.cadence === 'hourly' || dailyDue(c, opts.prev ?? null, now));
}

/** Runs one check with a timeout; a throw or a timeout is a `fail`, never an exception. */
export async function runCheck(check: MonitorCheck, ctx: MonitorContext, timeoutMs = CHECK_TIMEOUT_MS): Promise<CheckResult> {
  const t0 = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = await Promise.race([
      check.run(ctx),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${Math.round(timeoutMs / 1000)} s`)), timeoutMs);
      }),
    ]);
    return { id: check.id, label: check.label, cadence: check.cadence, ...outcome, durationMs: Date.now() - t0 };
  } catch (e) {
    return { id: check.id, label: check.label, cadence: check.cadence, status: 'fail', reason: `check error: ${errMsg(e)}`, durationMs: Date.now() - t0 };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runChecks(checks: MonitorCheck[], ctx: MonitorContext, timeoutMs?: number): Promise<CheckResult[]> {
  return Promise.all(checks.map(c => runCheck(c, ctx, timeoutMs)));
}

export async function loadState(db: SupabaseClient): Promise<MonitorState | null> {
  const { data } = await db.from('system_config').select('value').eq('key', STATE_KEY).maybeSingle();
  const v = (data as { value?: MonitorState } | null)?.value;
  return v && typeof v === 'object' && v.checks ? v : null;
}

export async function saveState(db: SupabaseClient, state: MonitorState, now: Date): Promise<void> {
  await db.from('system_config').upsert({ key: STATE_KEY, value: state, updated_at: now.toISOString() }, { onConflict: 'key' });
}

export interface MonitorRun {
  results: CheckResult[];
  transitions: Transition[];
  digestSent: boolean;
  recorded: boolean;
}

export interface RunOptions {
  scope: RunScope;
  /** Persist state and post Slack alerts. Off for on-demand reads. */
  record: boolean;
  only?: string[];
  forceDigest?: boolean;
  notify?: { transitions: typeof notifyMonitorTransitions; digest: typeof notifyMonitorDigest };
}

export async function runRevenueMonitor(ctx: MonitorContext, opts: RunOptions): Promise<MonitorRun> {
  const db = opts.record || opts.scope === 'auto' ? ctx.service() : null;
  const prev = db ? await loadState(db).catch(() => null) : null;
  const results = await runChecks(selectChecks(opts.scope, { only: opts.only, prev, now: ctx.now }), ctx);
  if (!opts.record || !db) return { results, transitions: [], digestSent: false, recorded: false };

  const notify = opts.notify ?? { transitions: notifyMonitorTransitions, digest: notifyMonitorDigest };
  const digestDue = Boolean(opts.forceDigest) || ctx.now.getUTCHours() >= DAILY_UTC_HOUR;
  const plan = planAlerts(prev, results, ctx.now, { digestDue });

  if (plan.transitions.length) {
    await notify.transitions(transitionLines(plan.transitions, ctx.now), plan.transitions.some(t => t.to === 'fail'));
  }
  if (plan.digest) {
    const { headline, lines } = digestLines(plan.next);
    await notify.digest(headline, lines, Object.values(plan.next.checks).some(c => c.status === 'fail'));
  }
  await saveState(db, plan.next, ctx.now);
  return { results, transitions: plan.transitions, digestSent: plan.digest, recorded: true };
}
