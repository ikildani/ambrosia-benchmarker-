/**
 * Document memory: which filings the extractor has already judged. Nov 23 2026.
 *
 * Deduplication used to look only at deals.source_filing_id, so a document the
 * extractor called "not a deal" was extracted again on every run while it stayed
 * in the source's look-back window (HKEX 14 days, scanned every 30 minutes).
 * In the week to Nov 23, 272 HKEX "not a deal" verdicts covered 6 documents and
 * 160 DART verdicts covered 6; the same handful of filings ate the daily budget.
 *
 * Stored per scope (hkex, asx, dart, tdnet, cninfo, mfn, edgar, press) in
 * radar_sync_cursors under `docmem:<scope>`, so no migration is needed. Entries
 * expire after TTL_DAYS and the store is capped at MAX_ENTRIES (oldest out).
 *
 * Only a verdict is remembered. An extraction that could not run (budget, credit,
 * network: ExtractionUnavailableError) is not, so that document is retried on the
 * next run inside its window, or the next day once the budget resets.
 *
 * Usage: processors call alreadyJudged() before fetching the document and
 * rememberVerdict() once the extractor has answered; the cron route calls
 * flushDocMemories() at the end of its run. A failed read disables writes for
 * that scope in that run, so a database hiccup can never wipe the store.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readSyncCursor, writeSyncCursor } from '../radar/sync-cursor';

export type DocScope = 'hkex' | 'asx' | 'dart' | 'tdnet' | 'cninfo' | 'mfn' | 'edgar' | 'press';
/** extracted = the model returned a deal (inserted, gated, or a duplicate); not_a_deal = it said no. */
export type DocVerdict = 'extracted' | 'not_a_deal';

export const TTL_DAYS = 45;
export const MAX_ENTRIES = 5000;
const PREFIX = 'docmem:';

/** id -> [verdict code, UTC epoch day]. Compact so a 5,000-entry store stays ~150 KB. */
export type MemoryStore = Record<string, [string, number]>;

export const epochDay = (d = new Date()) => Math.floor(d.getTime() / 86_400_000);

/** Drop expired entries, then the oldest beyond `max`. Pure; unit-tested. */
export function pruneMemory(store: MemoryStore, today: number, ttlDays = TTL_DAYS, max = MAX_ENTRIES): MemoryStore {
  const live = Object.entries(store).filter(([, v]) => Array.isArray(v) && typeof v[1] === 'number' && today - v[1] < ttlDays);
  live.sort((a, b) => b[1][1] - a[1][1]);
  return Object.fromEntries(live.slice(0, max));
}

class DocMemory {
  dirty = false;
  constructor(readonly scope: DocScope, private store: MemoryStore, readonly writable: boolean) {}
  has(id: string): boolean { return Object.prototype.hasOwnProperty.call(this.store, id); }
  remember(id: string, verdict: DocVerdict) { this.store[id] = [verdict, epochDay()]; this.dirty = true; }
  forget(id: string) { if (this.has(id)) { delete this.store[id]; this.dirty = true; } }
  snapshot(): MemoryStore { return pruneMemory(this.store, epochDay()); }
}

const loaded = new Map<DocScope, DocMemory>();

async function memory(supabase: SupabaseClient, scope: DocScope): Promise<DocMemory> {
  const hit = loaded.get(scope);
  if (hit) return hit;
  let mem: DocMemory;
  try {
    const cur = await readSyncCursor<{ ids?: MemoryStore }>(supabase, PREFIX + scope);
    mem = new DocMemory(scope, pruneMemory(cur.state.ids ?? {}, epochDay()), true);
  } catch (e) {
    console.warn(`[doc-memory] ${scope} read failed, running without memory: ${String(e).slice(0, 160)}`);
    mem = new DocMemory(scope, {}, false);
  }
  loaded.set(scope, mem);
  return mem;
}

/** True when the extractor already gave this document a verdict within TTL_DAYS. */
export async function alreadyJudged(supabase: SupabaseClient, scope: DocScope, id: string): Promise<boolean> {
  return (await memory(supabase, scope)).has(id);
}

export async function rememberVerdict(supabase: SupabaseClient, scope: DocScope, id: string, verdict: DocVerdict): Promise<void> {
  (await memory(supabase, scope)).remember(id, verdict);
}

/** Undo a verdict, e.g. when the insert failed for a database reason and the document must be retried. */
export async function forgetVerdict(supabase: SupabaseClient, scope: DocScope, id: string): Promise<void> {
  (await memory(supabase, scope)).forget(id);
}

/** Persist every changed scope and clear the per-run cache. Never throws. */
export async function flushDocMemories(supabase: SupabaseClient, opts: { dryRun?: boolean } = {}): Promise<void> {
  const scopes = [...loaded.values()];
  loaded.clear();
  if (opts.dryRun) return;
  for (const mem of scopes) {
    if (!mem.dirty || !mem.writable) continue;
    try {
      const ids = mem.snapshot();
      await writeSyncCursor(supabase, PREFIX + mem.scope, String(Object.keys(ids).length), { ids });
    } catch (e) {
      console.warn(`[doc-memory] ${mem.scope} write failed: ${String(e).slice(0, 160)}`);
    }
  }
}

/** Test hook. */
export function __resetDocMemory() { loaded.clear(); }
