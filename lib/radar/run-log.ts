/**
 * Shared run logger for every Asset Radar cron (asset universe, licensing
 * signals, deal thesis, mandate matcher, competitive intel, deal creator).
 *
 * Every Radar module used to insert into `data_ingestion_log` with columns
 * that do not exist (`duration_seconds`, `error_details`, `metadata`) and a
 * status (`success`) that violates the CHECK constraint, and never checked the
 * result. The insert failed silently on every run, which is why no Radar cron
 * has ever appeared in the ingestion log or in the cron health monitor.
 *
 * This helper writes the real schema (migration 002) and surfaces failures.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type RadarRunSource =
  | 'asset_universe'
  | 'licensing_signals'
  | 'deal_thesis'
  | 'mandate_matcher'
  | 'competitive_intel'
  | 'deal_creator';

export interface RadarRunLog {
  source: RadarRunSource;
  startedAt: Date | number;
  /** completed = clean run, partial = ran with errors or timed out, failed = threw */
  status: 'completed' | 'partial' | 'failed';
  runType?: 'scheduled' | 'manual' | 'backfill';
  fetched?: number;
  processed?: number;
  inserted?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  errors?: string[];
  /** Free-form run details (cursor position, timed_out, per-factor counts, ...). */
  parameters?: Record<string, unknown>;
  notes?: string;
}

/**
 * Insert one row into data_ingestion_log. Never throws; returns false when the
 * insert failed so callers can surface it in their own response payload.
 */
export async function logRadarRun(
  supabase: SupabaseClient,
  run: RadarRunLog,
): Promise<boolean> {
  const startedAt = typeof run.startedAt === 'number' ? new Date(run.startedAt) : run.startedAt;
  const completedAt = new Date();
  const durationSeconds = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);

  const { error } = await supabase.from('data_ingestion_log').insert({
    source: run.source,
    run_type: run.runType ?? 'scheduled',
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    status: run.status,
    records_fetched: run.fetched ?? 0,
    records_processed: run.processed ?? 0,
    records_inserted: run.inserted ?? 0,
    records_updated: run.updated ?? 0,
    records_skipped: run.skipped ?? 0,
    records_failed: run.failed ?? 0,
    errors: (run.errors ?? []).slice(0, 50),
    parameters: { ...(run.parameters ?? {}), duration_seconds: durationSeconds },
    notes: run.notes ?? null,
  });

  if (error) {
    console.error(`[radar:${run.source}] failed to write data_ingestion_log: ${error.message}`);
    return false;
  }
  return true;
}

/**
 * Derive a run status from counters. A run that produced nothing while the
 * input was non-empty is `partial`, so the cron health monitor can alert on it
 * instead of treating an empty run as healthy.
 */
export function deriveRunStatus(args: {
  errors: number;
  timedOut?: boolean;
  processed: number;
  produced: number;
}): 'completed' | 'partial' {
  if (args.errors > 0 || args.timedOut) return 'partial';
  if (args.processed > 0 && args.produced === 0) return 'partial';
  return 'completed';
}
