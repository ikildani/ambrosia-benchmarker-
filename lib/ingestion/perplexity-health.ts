/**
 * Perplexity availability and the verification-path decision. Nov 23 2026.
 *
 * Perplexity has answered 401 insufficient_quota since Oct 15. The verification cron
 * kept calling it for every pending and flagged row (8,300 failed calls in the week to
 * Nov 23) and nothing became verified after Sep 30. Two changes:
 *
 *   - a quota/auth failure marks Perplexity down for PERPLEXITY_DOWN_HOURS in
 *     radar_sync_cursors ('perplexity_health'), and the cron skips it until then;
 *   - a deal whose citation is a primary document (SEC, exchange, newswire) is verified
 *     from that document first (lib/ingestion/flag-fixer.ts verifyPendingFromPrimary):
 *     fetched by code, terms quoted verbatim. Perplexity is only the fallback for rows
 *     with no primary citation, and only while it is up.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readSyncCursor, writeSyncCursor } from '../radar/sync-cursor';

export const PERPLEXITY_HEALTH_CURSOR = 'perplexity_health';
export const PERPLEXITY_DOWN_HOURS = 12;

/** Status codes that mean "no quota / no access", not a transient failure. */
export function isPerplexityOutage(status: number): boolean {
  return status === 401 || status === 402 || status === 403;
}

/** True when any of the error strings a verification pass returned reports an outage status. */
export function errorsShowPerplexityOutage(errors: string[]): boolean {
  return errors.some(e => /Perplexity(?: API error:)? (401|402|403)\b/.test(e));
}

export function isDown(state: { downUntil?: string | null } | null | undefined, now = new Date()): boolean {
  return !!state?.downUntil && Date.parse(state.downUntil) > now.getTime();
}

/** True while Perplexity is marked down. A read failure counts as up (the call itself will tell). */
export async function perplexityDown(supabase: SupabaseClient, now = new Date()): Promise<boolean> {
  try {
    const cur = await readSyncCursor<{ downUntil?: string | null }>(supabase, PERPLEXITY_HEALTH_CURSOR);
    return isDown(cur.state, now);
  } catch {
    return false;
  }
}

export async function markPerplexityDown(supabase: SupabaseClient, reason: string, now = new Date()): Promise<string> {
  const downUntil = new Date(now.getTime() + PERPLEXITY_DOWN_HOURS * 3_600_000).toISOString();
  try {
    await writeSyncCursor(supabase, PERPLEXITY_HEALTH_CURSOR, downUntil, { downUntil, reason: reason.slice(0, 300), markedAt: now.toISOString() });
  } catch (e) {
    console.warn('[perplexity-health] could not record outage:', String(e).slice(0, 160));
  }
  return downUntil;
}

export type VerificationPath = 'primary_document' | 'perplexity' | 'wait';

/**
 * Which path verifies a deal. A primary citation always wins: it is free to fetch, the
 * terms must be quoted from it, and it is what the owner rule requires anyway. Without
 * one, Perplexity searches for a source while it is configured and up; otherwise the
 * row waits (it stays pending, out of counts, and is not penalised).
 */
export function chooseVerificationPath(input: { hasPrimaryCitation: boolean; perplexityConfigured: boolean; perplexityDown: boolean }): VerificationPath {
  if (input.hasPrimaryCitation) return 'primary_document';
  if (input.perplexityConfigured && !input.perplexityDown) return 'perplexity';
  return 'wait';
}
