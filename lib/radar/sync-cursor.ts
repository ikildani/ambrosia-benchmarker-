/**
 * Read/write helpers for radar_sync_cursors (migration 105). Every Radar
 * sweep that pages through an external source persists its position here so
 * a Vercel time-boxed run can resume where the previous one stopped.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SyncCursor<S extends Record<string, unknown> = Record<string, unknown>> {
  source: string;
  cursor: string | null;
  state: S;
  runs: number;
  last_run_at: string | null;
}

export async function readSyncCursor<S extends Record<string, unknown> = Record<string, unknown>>(
  supabase: SupabaseClient,
  source: string,
): Promise<SyncCursor<S>> {
  const { data, error } = await supabase
    .from('radar_sync_cursors')
    .select('source, cursor, state, runs, last_run_at')
    .eq('source', source)
    .maybeSingle();
  if (error) throw new Error(`radar_sync_cursors read failed for ${source}: ${error.message}`);
  if (!data) return { source, cursor: null, state: {} as S, runs: 0, last_run_at: null };
  return { ...data, state: (data.state ?? {}) as S } as SyncCursor<S>;
}

export async function writeSyncCursor<S extends Record<string, unknown> = Record<string, unknown>>(
  supabase: SupabaseClient,
  source: string,
  cursor: string | null,
  state: S,
): Promise<void> {
  const { data: existing } = await supabase
    .from('radar_sync_cursors')
    .select('runs')
    .eq('source', source)
    .maybeSingle();
  const { error } = await supabase.from('radar_sync_cursors').upsert(
    {
      source,
      cursor,
      state,
      runs: (existing?.runs ?? 0) + 1,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'source' },
  );
  if (error) throw new Error(`radar_sync_cursors write failed for ${source}: ${error.message}`);
}
