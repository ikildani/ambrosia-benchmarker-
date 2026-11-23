/**
 * Revenue-path monitoring: shared types.
 *
 * Each check is independent, side-effect-free (or self-cleaning) and returns
 * ok / warn / fail with a one-line reason. Checks get every client through
 * MonitorContext so tests can swap in fakes.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { CalculationInput, CalculationResult } from '@/lib/calculations';

export type CheckStatus = 'ok' | 'warn' | 'fail';

/** hourly checks run on every pass; daily checks run once a day (and on demand). */
export type Cadence = 'hourly' | 'daily';

export interface CheckOutcome {
  status: CheckStatus;
  /** One line, safe for Slack. Never include secrets or customer emails. */
  reason: string;
}

export interface CheckResult extends CheckOutcome {
  id: string;
  label: string;
  cadence: Cadence;
  durationMs: number;
}

export interface MonitorContext {
  now: Date;
  env: Record<string, string | undefined>;
  /** Production origin, no trailing slash. */
  appUrl: string;
  fetch: typeof fetch;
  /** Service-role client (bypasses RLS). */
  service: () => SupabaseClient;
  /** Anon client: the same path the browser uses. */
  anon: () => SupabaseClient;
  /** null when STRIPE_SECRET_KEY is not configured. */
  stripe: () => Stripe | null;
  calculate: (input: CalculationInput) => CalculationResult;
  loadBenchmarks: () => Promise<void>;
}

export interface MonitorCheck {
  id: string;
  label: string;
  cadence: Cadence;
  run: (ctx: MonitorContext) => Promise<CheckOutcome>;
}

export const ok = (reason: string): CheckOutcome => ({ status: 'ok', reason });
export const warn = (reason: string): CheckOutcome => ({ status: 'warn', reason });
export const fail = (reason: string): CheckOutcome => ({ status: 'fail', reason });

/** Worst of several outcomes; reasons of the non-ok parts are joined. */
export function worst(parts: CheckOutcome[], okReason: string): CheckOutcome {
  const fails = parts.filter(p => p.status === 'fail');
  const warns = parts.filter(p => p.status === 'warn');
  if (fails.length) return fail([...fails, ...warns].map(p => p.reason).join('; '));
  if (warns.length) return warn(warns.map(p => p.reason).join('; '));
  return ok(okReason);
}

export function hoursSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (now.getTime() - t) / 3_600_000 : null;
}

export function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  // PostgREST outages return a full HTML page; keep the first readable bit.
  return m.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) || 'unknown error';
}
