/**
 * Which registries a parameterless registry-sweep cron run (every 2 h, vercel.json) covers.
 *
 * Bulk backfills of static corpora (EU CTR: 2,221 pages at ~12 s each, closed to new
 * trials since Jan 2023) would starve the incremental registries if they shared the
 * round robin, so they get whole runs at fixed UTC hours until their first full walk
 * completes, and afterwards one re-walk per REWALK_DAYS (status updates only).
 */

export interface BacklogRegistry {
  registry: string;
  /** UTC hours (cron fires at even hours) whose run is dedicated to this backlog. */
  hours: number[];
  rewalkDays: number;
}

export const BACKLOG_REGISTRIES: BacklogRegistry[] = [
  { registry: 'euctr', hours: [2, 6, 10, 14, 18, 22], rewalkDays: 90 },
];

export interface BacklogState {
  /** registry_sync_cursors.state.last_completed_at of `registry:<id>`. */
  lastCompletedAt: string | null;
  /** registry_sync_cursors.cursor (non-null while a walk is under way). */
  cursor: string | null;
}

export interface RegistryRunPlan {
  /** Run only this registry with the whole budget. */
  dedicated: string | null;
  /** Leave these out of the round robin. */
  exclude: string[];
}

function due(state: BacklogState | undefined, rewalkDays: number, now: Date): boolean {
  if (!state?.lastCompletedAt) return true;
  if (state.cursor) return true; // a re-walk is under way
  const last = Date.parse(state.lastCompletedAt);
  return !Number.isFinite(last) || now.getTime() - last > rewalkDays * 86_400_000;
}

export function planRegistryRun(utcHour: number, states: Record<string, BacklogState | undefined>, now: Date = new Date()): RegistryRunPlan {
  const exclude: string[] = [];
  let dedicated: string | null = null;
  for (const b of BACKLOG_REGISTRIES) {
    exclude.push(b.registry);
    if (!dedicated && b.hours.includes(utcHour) && due(states[b.registry], b.rewalkDays, now)) dedicated = b.registry;
  }
  return { dedicated, exclude };
}
