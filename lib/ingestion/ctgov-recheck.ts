/**
 * Re-check open trials that have been quiet on ClinicalTrials.gov for a year.
 *
 * The sweep (ctgov-sweep.ts) walks studies in LastUpdatePostDate order, so it only sees a study when
 * that date moves. CT.gov flips an overdue study to UNKNOWN without changing it, and a 2026-10-30 audit
 * found 12% of 13,840 open trials not updated in a year had newer data on CT.gov (409 completed,
 * 80 terminated, 590 unknown) that the sweep never fetched. This pass asks CT.gov for those trials
 * by id, oldest check first, and stamps `status_checked_at` (migration 175) so each one is re-asked
 * about once a month. `updated_at` moves only when something changed, so the asset indexer
 * (radar_companies_to_index) re-indexes only companies whose trials really changed.
 */

import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mapStatus, normalizeDate } from '@/lib/ingestion/clinical-trials';
import { CT_API_V2 } from '@/lib/ingestion/ctgov-sweep';

export const OPEN_TRIAL_STATUSES = ['recruiting', 'active_not_recruiting', 'not_yet_recruiting', 'enrolling_by_invitation'];
/** Open trials whose last CT.gov update is older than this are re-asked. */
export const QUIET_AFTER_DAYS = 365;
/** A trial re-asked within this many days is not asked again. */
export const RECHECK_EVERY_DAYS = 30;
const IDS_PER_REQUEST = 100;
const REQUEST_INTERVAL_MS = 600;
const DEFAULT_LIMIT = 3000;

export interface RecheckOptions {
  limit?: number;
  timeBudgetMs?: number;
  now?: Date;
}

export interface RecheckResult {
  trialsAsked: number;
  trialsChanged: number;
  statusChanged: number;
  rowsUpdated: number;
  missing: number;
  timedOut: boolean;
  errors: string[];
}

export interface LiveTrial {
  status: string;
  last_update_posted: string | null;
  primary_completion_date: string | null;
  completion_date: string | null;
}

interface StoredTrial {
  nct_id: string;
  status: string | null;
  last_update_posted: string | null;
  primary_completion_date: string | null;
  completion_date: string | null;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** CT.gov v2 study → the fields this pass refreshes. */
export function parseLiveTrial(study: unknown): { nctId: string; live: LiveTrial } | null {
  const p = (study as { protocolSection?: Record<string, any> })?.protocolSection;
  const nctId = p?.identificationModule?.nctId;
  const s = p?.statusModule;
  if (typeof nctId !== 'string' || !s) return null;
  return {
    nctId,
    live: {
      status: mapStatus(s.overallStatus),
      last_update_posted: normalizeDate(s.lastUpdatePostDateStruct?.date),
      primary_completion_date: normalizeDate(s.primaryCompletionDateStruct?.date),
      completion_date: normalizeDate(s.completionDateStruct?.date),
    },
  };
}

/** The update to write, or null when CT.gov says nothing new. Never moves a date backwards. */
export function trialChanges(stored: StoredTrial, live: LiveTrial): Partial<LiveTrial> | null {
  const out: Partial<LiveTrial> = {};
  if (live.status && live.status !== stored.status) out.status = live.status;
  if (live.last_update_posted && (!stored.last_update_posted || live.last_update_posted > stored.last_update_posted)) {
    out.last_update_posted = live.last_update_posted;
  }
  if (live.primary_completion_date && live.primary_completion_date !== stored.primary_completion_date) out.primary_completion_date = live.primary_completion_date;
  if (live.completion_date && live.completion_date !== stored.completion_date) out.completion_date = live.completion_date;
  return Object.keys(out).length ? out : null;
}

export async function recheckQuietOpenTrials(supabase: SupabaseClient, opts: RecheckOptions = {}): Promise<RecheckResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const budget = opts.timeBudgetMs ?? 60_000;
  const result: RecheckResult = { trialsAsked: 0, trialsChanged: 0, statusChanged: 0, rowsUpdated: 0, missing: 0, timedOut: false, errors: [] };
  const day = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('company_trials')
    .select('nct_id, status, last_update_posted, primary_completion_date, completion_date')
    .in('status', OPEN_TRIAL_STATUSES)
    .like('nct_id', 'NCT%')
    .lt('last_update_posted', day(QUIET_AFTER_DAYS).slice(0, 10))
    .or(`status_checked_at.is.null,status_checked_at.lt.${day(RECHECK_EVERY_DAYS)}`)
    .order('status_checked_at', { ascending: true, nullsFirst: true })
    .limit(opts.limit ?? DEFAULT_LIMIT);
  if (error) {
    result.errors.push(`company_trials read: ${error.message}`);
    return result;
  }
  // One row per company that runs the trial; CT.gov answers per trial.
  const byNct = new Map<string, StoredTrial>();
  for (const row of (data ?? []) as StoredTrial[]) if (!byNct.has(row.nct_id)) byNct.set(row.nct_id, row);
  const ids = [...byNct.keys()];

  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
    if (Date.now() - started > budget) {
      result.timedOut = true;
      break;
    }
    const batch = ids.slice(i, i + IDS_PER_REQUEST);
    const url = `${CT_API_V2}?filter.ids=${batch.join(',')}&fields=NCTId,OverallStatus,LastUpdatePostDate,PrimaryCompletionDate,CompletionDate&pageSize=${IDS_PER_REQUEST}`;
    let studies: unknown[] = [];
    try {
      const res = await fetchWithTimeout(url, { timeoutMs: 30_000, retries: 1 });
      if (!res.ok) {
        result.errors.push(`CT.gov ${res.status} for ${batch.length} ids`);
        continue;
      }
      studies = ((await res.json()) as { studies?: unknown[] }).studies ?? [];
    } catch (err) {
      result.errors.push(`CT.gov fetch: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    result.trialsAsked += batch.length;
    const seen = new Set<string>();
    for (const study of studies) {
      const parsed = parseLiveTrial(study);
      if (!parsed || !byNct.has(parsed.nctId)) continue;
      seen.add(parsed.nctId);
      const changes = trialChanges(byNct.get(parsed.nctId)!, parsed.live);
      if (!changes) continue;
      const { error: upErr, count } = await supabase
        .from('company_trials')
        .update({ ...changes, status_checked_at: now.toISOString(), updated_at: now.toISOString() }, { count: 'exact' })
        .eq('nct_id', parsed.nctId);
      if (upErr) {
        result.errors.push(`update ${parsed.nctId}: ${upErr.message}`);
        continue;
      }
      result.trialsChanged++;
      if (changes.status) result.statusChanged++;
      result.rowsUpdated += count ?? 0;
    }
    result.missing += batch.length - seen.size;
    // Every trial CT.gov answered for counts as checked; updated_at stays put on unchanged ones.
    if (seen.size) {
      const { error: stampErr } = await supabase
        .from('company_trials')
        .update({ status_checked_at: now.toISOString() })
        .in('nct_id', [...seen]);
      if (stampErr) result.errors.push(`stamp: ${stampErr.message}`);
    }
    await sleep(REQUEST_INTERVAL_MS);
  }
  return result;
}
