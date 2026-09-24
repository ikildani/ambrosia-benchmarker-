/**
 * Historical deal backfill from SEC full-text search, 2017 → present.
 *
 * Walks a cursor over (quarter × query) from 2017Q1 forward, pages every
 * form separately (see edgar-fts.ts on why), pre-filters hits on SIC and
 * Item 1.01, and runs each remaining filing through the same extraction,
 * validation and cited-insert path as the real-time monitor. Every row it
 * writes carries source_filing_id and source_url.
 *
 * Budget: EFTS returns ~250 pharma-scoped "license agreement" hits per
 * quarter in 2019. Sep 24 2026: runs every 15 minutes with up to 80
 * extractions per run, 4 in parallel, so 2017→present (~13,000 filings)
 * drains in about a week. Every extracted accession is written to
 * edgar_fts_processed so rejected filings are never paid for twice.
 *
 * Cursor lives in radar_sync_cursors under source 'edgar_fts_backfill'.
 * Delete the row to restart from 2017Q1.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { readSyncCursor, writeSyncCursor } from '../radar/sync-cursor';
import { FunnelCounter } from './funnel';
import { PHARMA_DEAL_QUERIES, eftsSearch, hitToDocument, isLikelyPharmaDealHit, quartersSince, EFTS_PAGE_SIZE, type EftsDocument } from './edgar-fts';
import { processEftsDocument } from './edgar-realtime';
import { mapWithConcurrency } from './concurrency';

/**
 * Ledger of accessions this backfill has already extracted (migration 119).
 * Rejected filings are not in `deals`, so without this the next run would
 * re-extract them and a page with more rejections than the cap would pin the
 * cursor forever.
 */
export const PROCESSED_TABLE = 'edgar_fts_processed';

export const BACKFILL_CURSOR_SOURCE = 'edgar_fts_backfill';
export const BACKFILL_FROM_YEAR = 2017;

export interface BackfillCursorState extends Record<string, unknown> {
  quarterKey: string;
  queryIndex: number;
  from: number;
  /** Quarters fully walked, for the coverage report. */
  completedQuarters: string[];
}

export interface BackfillOptions {
  anthropicApiKey: string;
  dryRun?: boolean;
  timeBudgetMs?: number;
  maxExtractions?: number;
  minConfidence?: number;
  /** Override the cursor for a one-off local run, e.g. { quarterKey: '2019Q3' }. Not persisted when set. */
  cursorOverride?: Partial<BackfillCursorState>;
  /** Restrict to one query key for a local probe. */
  onlyQuery?: string;
  /** Parallel extractions per run. Claude calls are I/O bound; 4 is safe under SEC's 10 req/s and Anthropic tier limits. */
  concurrency?: number;
}

export interface BackfillResult {
  quarterKey: string;
  query: string;
  candidates: number;
  prefiltered: number;
  /** Pre-filtered hits skipped because the ledger already had them. */
  alreadyProcessed: number;
  extracted: number;
  passed: number;
  inserted: number;
  errors: string[];
  funnel: ReturnType<FunnelCounter['toJSON']>;
  summary: string;
  next: BackfillCursorState;
  finished: boolean;
}

function advance(state: BackfillCursorState, quarters: ReturnType<typeof quartersSince>, exhaustedPage: boolean): BackfillCursorState {
  const next: BackfillCursorState = { ...state, completedQuarters: [...state.completedQuarters] };
  if (!exhaustedPage) { next.from += EFTS_PAGE_SIZE; return next; }
  next.from = 0;
  next.queryIndex += 1;
  if (next.queryIndex >= PHARMA_DEAL_QUERIES.length) {
    next.queryIndex = 0;
    if (!next.completedQuarters.includes(state.quarterKey)) next.completedQuarters.push(state.quarterKey);
    const idx = quarters.findIndex(q => q.key === state.quarterKey);
    next.quarterKey = idx >= 0 && idx + 1 < quarters.length ? quarters[idx + 1].key : state.quarterKey;
  }
  return next;
}

export async function runEdgarFtsBackfill(supabase: SupabaseClient, opts: BackfillOptions): Promise<BackfillResult> {
  const start = Date.now();
  const budget = opts.timeBudgetMs ?? 250_000;
  const maxExtractions = opts.maxExtractions ?? 30;
  const minConfidence = opts.minConfidence ?? 75;
  const dryRun = !!opts.dryRun;
  const quarters = quartersSince(BACKFILL_FROM_YEAR);
  const funnel = new FunnelCounter();
  const errors: string[] = [];

  const stored = opts.cursorOverride ? null : await readSyncCursor<BackfillCursorState>(supabase, BACKFILL_CURSOR_SOURCE);
  const state: BackfillCursorState = {
    quarterKey: quarters[0].key,
    queryIndex: 0,
    from: 0,
    completedQuarters: [],
    ...(stored?.state ?? {}),
    ...(opts.cursorOverride ?? {}),
  };
  const quarter = quarters.find(q => q.key === state.quarterKey) ?? quarters[0];
  const queryIndex = opts.onlyQuery ? Math.max(0, PHARMA_DEAL_QUERIES.findIndex(q => q.key === opts.onlyQuery)) : state.queryIndex;
  const query = PHARMA_DEAL_QUERIES[queryIndex] ?? PHARMA_DEAL_QUERIES[0];
  const finished = quarter.key === quarters[quarters.length - 1].key && state.completedQuarters.includes(quarter.key);

  const concurrency = Math.max(1, opts.concurrency ?? 1);
  let candidates = 0, prefiltered = 0, alreadyProcessed = 0, extracted = 0, passed = 0, inserted = 0;
  let exhaustedPage = true;

  if (!finished) {
    const page = await eftsSearch({ q: query.q, startdt: quarter.startdt, enddt: quarter.enddt, from: state.from });
    if (page.parseFailed && page.hits.length === 0) {
      errors.push(`EFTS non-JSON body for ${query.key} ${quarter.key} from=${state.from}; will retry next run`);
      exhaustedPage = false; // stay on this page
    } else if (page.status !== 200 && !(page.status === 500 && state.from > 0)) {
      errors.push(`EFTS ${page.status} for ${query.key} ${quarter.key}`);
    } else {
      // 1. Cheap pass over the page: resolve and pre-filter every hit.
      const docs: EftsDocument[] = [];
      for (const hit of page.hits) {
        candidates++;
        funnel.count('fetched');
        const doc = hitToDocument(hit);
        if (!doc) { funnel.count('content_unavailable', 'unresolvable_hit', hit._id); continue; }
        const pre = isLikelyPharmaDealHit(hit);
        if (!pre.keep) { funnel.count('keyword_filtered', pre.reason, `${doc.companyName} ${doc.form} ${doc.fileType}`); continue; }
        prefiltered++;
        docs.push(doc);
      }

      // 2. Drop accessions the ledger already has (extracted on an earlier run, any outcome).
      let todo = docs;
      if (docs.length > 0) {
        const { data: seenRows, error: seenErr } = await supabase
          .from(PROCESSED_TABLE).select('accession').in('accession', docs.map(d => d.accession));
        if (seenErr) errors.push(`ledger read failed: ${seenErr.message}`);
        const seen = new Set((seenRows ?? []).map(r => r.accession as string));
        todo = docs.filter(d => !seen.has(d.accession));
        alreadyProcessed = docs.length - todo.length;
        for (let i = 0; i < alreadyProcessed; i++) funnel.count('already_in_table', 'edgar_fts_processed');
      }

      // 3. Extract up to the cap, `concurrency` at a time, within the time budget.
      const batch = todo.slice(0, maxExtractions);
      const capHit = todo.length > batch.length;
      if (capHit) funnel.count('time_budget', 'extraction_cap');
      const run = await mapWithConcurrency(batch, concurrency, async (doc) => {
        const outcome = await processEftsDocument(supabase, doc, {
          anthropicApiKey: opts.anthropicApiKey, dryRun, minConfidence, funnel,
          sourceType: doc.form.startsWith('6-K') ? 'sec_6k' : 'sec_8k',
        });
        if (outcome === 'inserted') { passed++; inserted++; }
        if (outcome === 'error') errors.push(`insert error ${doc.accession}`);
        // Record everything except insert errors, so those retry next run.
        if (!dryRun && outcome !== 'error') {
          const { error: ledgerErr } = await supabase.from(PROCESSED_TABLE).upsert({
            accession: doc.accession, outcome, quarter: quarter.key, query_key: query.key,
            form: doc.form || null, filing_date: doc.filingDate || null, company: doc.companyName || null,
          }, { onConflict: 'accession' });
          if (ledgerErr) errors.push(`ledger write failed ${doc.accession}: ${ledgerErr.message}`);
        }
        return outcome;
      }, () => Date.now() - start < budget);
      extracted = run.started;
      for (const e of run.errors) {
        funnel.count('extraction_error', undefined, String(e.error).slice(0, 120));
        errors.push(`${batch[e.index]?.accession}: ${String(e.error).slice(0, 160)}`);
      }
      const budgetHit = run.started < batch.length;
      if (budgetHit) funnel.count('time_budget', 'hits_remaining');
      // The page is drained only when every unseen doc was started and none were left behind the cap.
      exhaustedPage = !capHit && !budgetHit;
      if (exhaustedPage && state.from + EFTS_PAGE_SIZE < page.total) exhaustedPage = false;
    }
  }

  const next = finished ? state : advance(state, quarters, exhaustedPage);
  if (!dryRun && !opts.cursorOverride) {
    await writeSyncCursor(supabase, BACKFILL_CURSOR_SOURCE, `${next.quarterKey}:${next.queryIndex}:${next.from}`, next);
  }
  const summary = funnel.summary();
  console.log(`[edgar-fts-backfill] ${quarter.key} ${query.key} from=${state.from} ${summary}${dryRun ? ' (dry run)' : ''}`);
  return { quarterKey: quarter.key, query: query.key, candidates, prefiltered, alreadyProcessed, extracted, passed, inserted, errors, funnel: funnel.toJSON(), summary, next, finished };
}
