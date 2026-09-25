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
 * extractions per run, 4 in parallel; Sep 25: a run walks as many pages as
 * its budget allows, so 2017→present drains in days, not weeks. Every extracted accession is written to
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
  /** Consecutive retries of the current page after a partial EFTS parse failure. */
  retries?: number;
}

export interface BackfillOptions {
  anthropicApiKey: string;
  dryRun?: boolean;
  timeBudgetMs?: number;
  maxExtractions?: number;
  minConfidence?: number;
  /** Insert [reviewConfidence, minConfidence) as pending with a review note. Default 60. */
  reviewConfidence?: number;
  /** Override the cursor for a one-off local run, e.g. { quarterKey: '2019Q3' }. Not persisted when set. */
  cursorOverride?: Partial<BackfillCursorState>;
  /** Restrict to one query key for a local probe. */
  onlyQuery?: string;
  /** Parallel extractions per run. Claude calls are I/O bound; 4 is safe under SEC's 10 req/s and Anthropic tier limits. */
  concurrency?: number;
}

export interface BackfillResult {
  /** Quarter/query the run started on. */
  quarterKey: string;
  query: string;
  /** Pages walked this run (a run keeps going until its time budget or cap is used). */
  pages: number;
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

/** What the cursor does after a run. */
export type CursorStep = 'stay' | 'next_page' | 'next_query';

/**
 * 'stay'       page not drained (cap or time budget hit); the ledger makes the
 *              next run skip what was already extracted, so no filing is lost.
 * 'next_page'  page drained and EFTS reports more hits for this query.
 * 'next_query' page drained and no more hits; roll to the next query, then quarter.
 * Before Sep 24 2026 a cap hit advanced the page and silently dropped the
 * unextracted remainder.
 */
function advance(state: BackfillCursorState, quarters: ReturnType<typeof quartersSince>, step: CursorStep): BackfillCursorState {
  const next: BackfillCursorState = { ...state, completedQuarters: [...state.completedQuarters], retries: 0 };
  if (step === 'stay') { next.retries = (state.retries ?? 0) + 1; return next; }
  if (step === 'next_page') { next.from += EFTS_PAGE_SIZE; return next; }
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
  const reviewConfidence = opts.reviewConfidence ?? 60;
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
  const concurrency = Math.max(1, opts.concurrency ?? 1);
  const MAX_PAGE_RETRIES = 2;
  const MIN_PAGE_BUDGET_MS = 40_000; // do not open a new page with less than this left

  const isFinished = (st: BackfillCursorState) =>
    st.quarterKey === quarters[quarters.length - 1].key && st.completedQuarters.includes(st.quarterKey);

  let cur: BackfillCursorState = { ...state };
  const startKey = { quarterKey: cur.quarterKey, queryIndex: cur.queryIndex };
  let pages = 0, candidates = 0, prefiltered = 0, alreadyProcessed = 0, extracted = 0, passed = 0, inserted = 0;

  const record = async (doc: EftsDocument, outcome: string, quarterKey: string, queryKey: string) => {
    if (dryRun) return;
    const { error: ledgerErr } = await supabase.from(PROCESSED_TABLE).upsert({
      accession: doc.accession, outcome, quarter: quarterKey, query_key: queryKey,
      form: doc.form || null, filing_date: doc.filingDate || null, company: doc.companyName || null,
    }, { onConflict: 'accession' });
    if (ledgerErr) errors.push(`ledger write failed ${doc.accession}: ${ledgerErr.message}`);
  };

  // A run walks page after page until the time budget or the extraction cap is used.
  // Before Sep 25 2026 one run meant one page of one query; once the ledger made later
  // queries mostly "seen", runs finished in seconds and 75% of the schedule was idle.
  while (!isFinished(cur) && Date.now() - start < budget - MIN_PAGE_BUDGET_MS && extracted < maxExtractions) {
    const quarter = quarters.find(q => q.key === cur.quarterKey) ?? quarters[0];
    const queryIndex = opts.onlyQuery ? Math.max(0, PHARMA_DEAL_QUERIES.findIndex(q => q.key === opts.onlyQuery)) : cur.queryIndex;
    const query = PHARMA_DEAL_QUERIES[queryIndex] ?? PHARMA_DEAL_QUERIES[0];
    pages++;
    let step: CursorStep = 'next_query';

    const page = await eftsSearch({ q: query.q, startdt: quarter.startdt, enddt: quarter.enddt, from: cur.from });
    if (page.parseFailed && page.hits.length === 0) {
      errors.push(`EFTS non-JSON body for ${query.key} ${quarter.key} from=${cur.from}`);
      step = (cur.retries ?? 0) < MAX_PAGE_RETRIES ? 'stay' : 'next_query';
    } else if (page.status !== 200 && !(page.status === 500 && cur.from > 0)) {
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
        const seenHere = docs.length - todo.length;
        alreadyProcessed += seenHere;
        for (let i = 0; i < seenHere; i++) funnel.count('already_in_table', 'edgar_fts_processed');
      }

      // 3. Extract up to the cap, `concurrency` at a time, within the time budget.
      const batch = todo.slice(0, Math.max(0, maxExtractions - extracted));
      const capHit = todo.length > batch.length;
      if (capHit) funnel.count('time_budget', 'extraction_cap');
      const run = await mapWithConcurrency(batch, concurrency, async (doc) => {
        let outcome: string;
        try {
          outcome = await processEftsDocument(supabase, doc, {
            anthropicApiKey: opts.anthropicApiKey, dryRun, minConfidence, reviewConfidence, funnel,
            sourceType: doc.form.startsWith('6-K') ? 'sec_6k' : 'sec_8k',
          });
        } catch (e) {
          // One attempt per filing: recording the failure keeps a flaky filing from pinning the cursor.
          await record(doc, 'extraction_error', quarter.key, query.key);
          throw e;
        }
        if (outcome === 'inserted') { passed++; inserted++; }
        if (outcome === 'error') errors.push(`insert error ${doc.accession}`);
        await record(doc, outcome === 'error' ? 'insert_error' : outcome, quarter.key, query.key);
        return outcome;
      }, () => Date.now() - start < budget);
      extracted += run.started;
      for (const e of run.errors) {
        funnel.count('extraction_error', undefined, String(e.error).slice(0, 120));
        errors.push(`${batch[e.index]?.accession}: ${String(e.error).slice(0, 160)}`);
      }
      const budgetHit = run.started < batch.length;
      if (budgetHit) funnel.count('time_budget', 'hits_remaining');

      // A form that failed to parse means part of this page was never seen: re-request it next
      // time (bounded), the ledger skips what was already extracted.
      const partialParse = page.parseFailed && (cur.retries ?? 0) < MAX_PAGE_RETRIES;
      if (partialParse) errors.push(`EFTS partial parse failure for ${query.key} ${quarter.key} from=${cur.from}; page will be retried`);

      if (capHit || budgetHit || partialParse) step = 'stay';
      else if (cur.from + EFTS_PAGE_SIZE < page.total) step = 'next_page';
      else step = 'next_query';
    }

    const next = advance(cur, quarters, step);
    if (!dryRun && !opts.cursorOverride) {
      await writeSyncCursor(supabase, BACKFILL_CURSOR_SOURCE, `${next.quarterKey}:${next.queryIndex}:${next.from}`, next);
    }
    if (step === 'stay') { cur = next; break; } // cap/budget/parse: nothing more to do this run
    cur = next;
  }

  const finished = isFinished(cur);
  const summary = funnel.summary();
  console.log(`[edgar-fts-backfill] ${startKey.quarterKey} q${startKey.queryIndex} → ${cur.quarterKey}:${cur.queryIndex}:${cur.from} pages=${pages} ${summary}${dryRun ? ' (dry run)' : ''}`);
  return {
    quarterKey: startKey.quarterKey, query: PHARMA_DEAL_QUERIES[startKey.queryIndex]?.key ?? PHARMA_DEAL_QUERIES[0].key, pages,
    candidates, prefiltered, alreadyProcessed, extracted, passed, inserted, errors, funnel: funnel.toJSON(), summary, next: cur, finished,
  };
}
