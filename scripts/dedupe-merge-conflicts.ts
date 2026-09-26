/**
 * Duplicate child rows left on folded companies.
 *
 * When the merge job folds a row, every reference moves to the canonical id
 * except rows a unique index will not let move (company_trials (company_id,
 * nct_id), drug_owners, intent_score_snapshots, company_financials …): the
 * canonical already holds the same key. Those rows stay on the folded id and
 * are counted under company_merges.conflicts.
 *
 * This job, per referencing column that is part of a unique index:
 *   - finds every row whose company id is a folded row (companies.merged_into set);
 *   - if the canonical row has a twin under the same unique key: copies every
 *     value the twin lacks (NULL on the twin, set on the duplicate), snapshots
 *     the duplicate into company_cleanup_log (action deleted_duplicate) and
 *     deletes it;
 *   - otherwise re-points the row to the canonical id (action repointed) —
 *     rows written by a cron after the merge.
 *
 *   npx tsx scripts/dedupe-merge-conflicts.ts                       # dry run
 *   MERGE_APPLY=yes npx tsx scripts/dedupe-merge-conflicts.ts --apply --run-id <id> [--table company_trials]
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { COMPANY_REFERENCING_COLUMNS, columnKey, type ReferencingColumn } from '../lib/entities/merge';
import { assertApplyGuards } from '../lib/entities/merge-apply';

type Row = Record<string, unknown>;
type Client = ReturnType<typeof createClient>;

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const RUN_ID = args.includes('--run-id') ? args[args.indexOf('--run-id') + 1] : null;
const ONLY_TABLE = args.includes('--table') ? args[args.indexOf('--table') + 1] : null;

const PAGE = 250;
const ID_CHUNK = 50;
const SKIP_FILL = new Set(['id', 'created_at', 'updated_at', 'fetched_at', 'extraction_timestamp']);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function withRetry<T extends { error: { message: string } | null }>(fn: () => PromiseLike<T>, what: string): Promise<T> {
  let last: T | null = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    last = await fn();
    if (!last.error || !/timeout|canceling statement|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|network|<!DOCTYPE|JSON|52[0-9]/i.test(last.error.message)) return last;
    await sleep(1500 * attempt);
  }
  throw new Error(`${what}: ${last?.error?.message}`);
}

function pkOf(row: Row, pk: string[]): string {
  return pk.map(k => String(row[k])).join('|');
}

async function loadFolded(supabase: Client): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await withRetry(() => supabase.from('companies').select('id,merged_into').not('merged_into', 'is', null).order('id').range(from, from + 999), 'companies folded page');
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Array<{ id: string; merged_into: string }>) map.set(r.id, r.merged_into);
    if (!data || data.length < 1000) break;
  }
  return map;
}

async function assertLogTable(supabase: Client) {
  const { error } = await supabase.from('company_cleanup_log').select('id').limit(0);
  if (error) throw new Error(`apply refused: migration 133 not applied (company_cleanup_log: ${error.message})`);
}

interface Tally { seen: number; duplicates: number; filled: number; filledColumns: Map<string, number>; repointed: number; failed: number }

async function processColumn(supabase: Client, col: ReferencingColumn, folded: Map<string, string>): Promise<Tally> {
  const t: Tally = { seen: 0, duplicates: 0, filled: 0, filledColumns: new Map(), repointed: 0, failed: 0 };
  const ids = [...folded.keys()];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      let qb = supabase.from(col.table).select('*').in(col.column, chunk).order(col.column);
      for (const k of col.pk) qb = qb.order(k);
      const { data, error } = await withRetry(() => qb.range(from, from + PAGE - 1), `${columnKey(col)} page`);
      if (error) throw new Error(`${columnKey(col)}: ${error.message}`);
      rows.push(...((data ?? []) as Row[]));
      if (!data || data.length < PAGE) break;
    }
    for (const row of rows) {
      t.seen++;
      const mergedId = row[col.column] as string;
      const canonicalId = folded.get(mergedId)!;
      let twinQ = supabase.from(col.table).select('*').eq(col.column, canonicalId);
      for (const u of col.uniqueWith ?? []) twinQ = row[u] == null ? twinQ.is(u, null) : twinQ.eq(u, row[u] as string);
      const { data: twins, error: twinErr } = await withRetry(() => twinQ.limit(2), `${columnKey(col)} twin lookup`);
      if (twinErr) throw new Error(`${columnKey(col)} twin: ${twinErr.message}`);
      const twin = ((twins ?? []) as Row[])[0];

      if (!twin) {
        // No twin: the row can simply move (a cron wrote it after the merge).
        if (APPLY) {
          let upd = supabase.from(col.table).update({ [col.column]: canonicalId });
          for (const k of col.pk) upd = upd.eq(k, row[k] as string);
          const { error } = await withRetry(() => upd, `${columnKey(col)} repoint`);
          if (error) { t.failed++; console.error(`  repoint ${col.table} ${pkOf(row, col.pk)}: ${error.message}`); continue; }
          await supabase.from('company_cleanup_log').insert({ run_id: RUN_ID, action: 'repointed', table_name: col.table, row_id: pkOf(row, col.pk), company_id: mergedId, canonical_company_id: canonicalId, row, changes: { [col.column]: canonicalId } });
        }
        t.repointed++;
        continue;
      }

      const fill: Row = {};
      for (const [k, v] of Object.entries(row)) {
        if (SKIP_FILL.has(k) || k === col.column || col.pk.includes(k) || (col.uniqueWith ?? []).includes(k)) continue;
        if (v == null) continue;
        if (twin[k] == null || (Array.isArray(twin[k]) && (twin[k] as unknown[]).length === 0 && Array.isArray(v) && v.length > 0)) fill[k] = v;
      }
      if (APPLY) {
        if (Object.keys(fill).length) {
          let upd = supabase.from(col.table).update(fill);
          for (const k of col.pk) upd = upd.eq(k, twin[k] as string);
          const { error } = await withRetry(() => upd, `${columnKey(col)} fill`);
          if (error) { t.failed++; console.error(`  fill ${col.table} ${pkOf(twin, col.pk)}: ${error.message}`); continue; }
        }
        const { error: logErr } = await supabase.from('company_cleanup_log').insert({
          run_id: RUN_ID, action: 'deleted_duplicate', table_name: col.table, row_id: pkOf(row, col.pk), company_id: mergedId, canonical_company_id: canonicalId,
          kept_row_id: pkOf(twin, col.pk), row, changes: fill,
        });
        if (logErr) { t.failed++; console.error(`  log ${col.table} ${pkOf(row, col.pk)}: ${logErr.message}`); continue; }
        let del = supabase.from(col.table).delete();
        for (const k of col.pk) del = del.eq(k, row[k] as string);
        const { error: delErr } = await withRetry(() => del, `${columnKey(col)} delete`);
        if (delErr) { t.failed++; console.error(`  delete ${col.table} ${pkOf(row, col.pk)}: ${delErr.message}`); continue; }
      }
      t.duplicates++;
      if (Object.keys(fill).length) {
        t.filled++;
        for (const k of Object.keys(fill)) t.filledColumns.set(k, (t.filledColumns.get(k) ?? 0) + 1);
      }
    }
  }
  return t;
}

async function main() {
  if (APPLY) assertApplyGuards({ apply: APPLY, runId: RUN_ID, env: process.env });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  if (APPLY) await assertLogTable(supabase);

  const folded = await loadFolded(supabase);
  console.log(`${folded.size} folded company rows${APPLY ? ` — APPLYING (run ${RUN_ID})` : ' — dry run'}`);
  const columns = COMPANY_REFERENCING_COLUMNS.filter(c => c.kind === 'uuid' && c.uniqueWith && (!ONLY_TABLE || c.table === ONLY_TABLE));
  let dup = 0, rep = 0, fail = 0;
  for (const col of columns) {
    const t = await processColumn(supabase, col, folded);
    dup += t.duplicates; rep += t.repointed; fail += t.failed;
    const fills = [...t.filledColumns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k}×${n}`).join(', ');
    console.log(`  ${columnKey(col).padEnd(44)} on folded ids ${String(t.seen).padStart(5)}: duplicates ${String(t.duplicates).padStart(5)} (${t.filled} filled the kept row${fills ? ': ' + fills : ''}), re-pointed ${t.repointed}, failed ${t.failed}`);
  }
  console.log(`${APPLY ? 'Done' : 'Dry run'}: ${dup} duplicates ${APPLY ? 'deleted' : 'to delete'}, ${rep} rows ${APPLY ? 're-pointed' : 'to re-point'}, ${fail} failed.${APPLY ? ` Before-images: company_cleanup_log WHERE run_id = '${RUN_ID}'.` : ''}`);
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
