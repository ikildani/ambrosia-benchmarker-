/**
 * Alert policy: page only on a change into or out of `fail`, plus one daily
 * digest line. Warnings never page; they appear in the digest.
 *
 * Pure functions so the policy is unit-tested without Slack or a database.
 */

import type { CheckResult, CheckStatus, Cadence } from './types';

export interface CheckState {
  status: CheckStatus;
  reason: string;
  cadence: Cadence;
  /** When the check entered this status. */
  since: string;
  lastRun: string;
}

export interface MonitorState {
  checks: Record<string, CheckState>;
  /** UTC date (YYYY-MM-DD) of the last digest posted. */
  lastDigest?: string;
}

export interface Transition {
  id: string;
  label: string;
  from: CheckStatus | null;
  to: CheckStatus;
  reason: string;
  /** For recoveries: when the failure started. */
  failingSince?: string;
}

export interface AlertPlan {
  transitions: Transition[];
  next: MonitorState;
  digest: boolean;
}

export function planAlerts(prev: MonitorState | null, results: CheckResult[], now: Date, opts: { digestDue: boolean }): AlertPlan {
  const nowIso = now.toISOString();
  const checks: Record<string, CheckState> = { ...(prev?.checks ?? {}) };
  const transitions: Transition[] = [];

  for (const r of results) {
    const before = checks[r.id];
    const from = before?.status ?? null;
    const enteredFail = r.status === 'fail' && from !== 'fail';
    const leftFail = from === 'fail' && r.status !== 'fail';
    if (enteredFail || leftFail) {
      transitions.push({
        id: r.id,
        label: r.label,
        from,
        to: r.status,
        reason: r.reason,
        ...(leftFail ? { failingSince: before?.since } : {}),
      });
    }
    checks[r.id] = {
      status: r.status,
      reason: r.reason,
      cadence: r.cadence,
      since: from === r.status && before ? before.since : nowIso,
      lastRun: nowIso,
    };
  }

  const today = nowIso.slice(0, 10);
  const digest = opts.digestDue && prev?.lastDigest !== today;
  return { transitions, next: { checks, lastDigest: digest ? today : prev?.lastDigest }, digest };
}

const ICON: Record<CheckStatus, string> = { ok: '✅', warn: '⚠️', fail: '🔴' };

function duration(fromIso: string | undefined, now: Date): string {
  if (!fromIso) return '';
  const h = (now.getTime() - Date.parse(fromIso)) / 3_600_000;
  if (!Number.isFinite(h)) return '';
  return h >= 48 ? ` after ${Math.round(h / 24)} days` : ` after ${Math.max(1, Math.round(h))} h`;
}

export function transitionLines(transitions: Transition[], now: Date): string[] {
  return transitions.map(t =>
    t.to === 'fail'
      ? `${ICON.fail} *${t.label}* failing: ${t.reason}`
      : `${ICON[t.to]} *${t.label}* recovered${duration(t.failingSince, now)}: ${t.reason}`,
  );
}

/** One line per check, worst first. */
export function digestLines(state: MonitorState): { headline: string; lines: string[] } {
  const rank: Record<CheckStatus, number> = { fail: 0, warn: 1, ok: 2 };
  const rows = Object.entries(state.checks).sort((a, b) => rank[a[1].status] - rank[b[1].status] || a[0].localeCompare(b[0]));
  const n = { ok: 0, warn: 0, fail: 0 };
  for (const [, s] of rows) n[s.status]++;
  const headline = n.fail
    ? `Revenue paths: ${n.fail} failing, ${n.warn} warning, ${n.ok} ok`
    : n.warn
      ? `Revenue paths: all up, ${n.warn} warning`
      : `Revenue paths: all ${n.ok} checks ok`;
  const lines = rows.map(([id, s]) => `${ICON[s.status]} ${id}: ${s.reason}`);
  return { headline, lines };
}
