/**
 * Outcome ledger — the hourly phase shared by /api/cron/outcome-resolve
 * (manual / standalone) and the deal-verification cron (scheduled, because
 * vercel.json is at Vercel's 100-cron cap).
 *
 * Every call runs the resolver. Once a day — when the UTC hour equals
 * `rollupHour`, or when `forceRollups` is set — it also runs the Radar writer
 * (if enabled), materialises the accuracy rollups and sends the day-45 /
 * day-120 brief outcome follow-ups. Never throws; returns a report and logs
 * exactly one line with counts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { runResolver } from './resolver';
import { materialiseRollups } from './rollups';
import { recordRadarPredictions } from './writers';
import { runOutcomeFollowups, type FollowupRunReport } from './followups';
import type { RadarWriterReport, ResolverRunReport, RollupRunReport } from './types';

export interface OutcomePhaseOptions {
  now?: Date;
  /** UTC hour at which the nightly work (Radar writer + rollups) runs. */
  rollupHour: number;
  forceRollups?: boolean;
  forceRadar?: boolean;
  cursorOverride?: string;
  /** Skip the follow-up emails on a nightly run (manual re-runs). */
  skipFollowups?: boolean;
}

export interface OutcomePhaseReport {
  resolver: ResolverRunReport;
  radar: RadarWriterReport | null;
  rollups: RollupRunReport | null;
  followups: FollowupRunReport | null;
  nightly: boolean;
  ms: number;
  errors: string[];
}

export async function runOutcomePhase(supabase: SupabaseClient, opts: OutcomePhaseOptions): Promise<OutcomePhaseReport> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const nightly = opts.forceRollups === true || now.getUTCHours() === opts.rollupHour;
  const errors: string[] = [];

  let resolver: ResolverRunReport;
  try {
    resolver = await runResolver(supabase, { now, cursorOverride: opts.cursorOverride });
  } catch (e) {
    resolver = { dealsScanned: 0, openPredictions: 0, pairsScored: 0, autoResolved: 0, queued: 0, expired: 0, cursorFrom: null, cursorTo: null, errors: [e instanceof Error ? e.message : String(e)] };
  }
  errors.push(...resolver.errors);

  let radar: RadarWriterReport | null = null;
  let rollups: RollupRunReport | null = null;
  let followups: FollowupRunReport | null = null;
  if (nightly) {
    try {
      radar = await recordRadarPredictions(supabase, { now, force: opts.forceRadar });
      errors.push(...radar.errors);
    } catch (e) {
      errors.push(`radar: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      rollups = await materialiseRollups(supabase, now);
      errors.push(...rollups.errors);
    } catch (e) {
      errors.push(`rollups: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!opts.skipFollowups) {
      try {
        followups = await runOutcomeFollowups(supabase, { now });
        errors.push(...followups.errors);
      } catch (e) {
        errors.push(`followups: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  const ms = Date.now() - started;
  console.log(
    `[Outcomes] resolve: deals=${resolver.dealsScanned} open=${resolver.openPredictions} pairs=${resolver.pairsScored} ` +
    `auto=${resolver.autoResolved} queued=${resolver.queued} expired=${resolver.expired} cursor=${resolver.cursorTo ?? '-'}` +
    (nightly ? ` | nightly: radar=${radar ? `${radar.inserted}/${radar.candidates}${radar.enabled ? '' : ' (off)'}` : '-'} rollups=${rollups ? `${rollups.cells} cells from ${rollups.inputRows} rows` : '-'} followups=${followups ? `${followups.sent}/${followups.due} due of ${followups.requests}` : '-'}` : '') +
    ` | ${ms}ms${errors.length ? ` | errors=${errors.length}: ${errors.slice(0, 3).join('; ')}` : ''}`,
  );
  return { resolver, radar, rollups, followups, nightly, ms, errors };
}
