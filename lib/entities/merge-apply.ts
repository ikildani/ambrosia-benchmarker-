/**
 * Shared entity graph — duplicate-company merge, apply side (I/O).
 *
 * Executes a MergePlan from lib/entities/merge.ts through supabase-js:
 *   1. one company_merges audit row per merged row (written first, so a
 *      crash mid-plan leaves a trace),
 *   2. every referencing table.column re-pointed from the merged id to the
 *      canonical id (COMPANY_REFERENCING_COLUMNS); rows a unique index will
 *      not let move are left on the merged id and counted as conflicts,
 *   3. name_variations on the canonical replaced by the alias union,
 *   4. merged_into / merged_at set on the surplus row (never deleted),
 *   5. the audit row completed with {table.column: count} and the moved ids.
 *
 * Nothing here runs unless the caller passes every guard in
 * assertApplyGuards() and the schema probe in assertMigrationPresent()
 * finds migration 127. scripts/merge-duplicate-companies.ts is the only
 * caller; it defaults to a dry run that never imports a writing path.
 */

import type { EntityClient } from './resolve';
import { COMPANY_REFERENCING_COLUMNS, columnKey, type AliasStrip, type MergePlan, type ReferencingColumn } from './merge';

/** Environment variable that must equal 'yes' for --apply to run (second guard after the flag). */
export const MERGE_APPLY_ENV = 'MERGE_APPLY';
/** Moved ids stored per column in company_merges.repointed_ids; beyond this the list is truncated and flagged. */
export const REPOINTED_IDS_CAP = 20_000;
const PAGE = 1000;

export interface ApplyGuardInput {
  apply: boolean;
  runId: string | null | undefined;
  env: Record<string, string | undefined>;
}

/** Throws unless --apply, --run-id and MERGE_APPLY=yes are all present. Pure. */
export function assertApplyGuards(input: ApplyGuardInput): void {
  if (!input.apply) throw new Error('apply refused: --apply flag not set (dry run is the default)');
  if (!input.runId || !/^[A-Za-z0-9._-]{3,64}$/.test(input.runId)) {
    throw new Error('apply refused: --run-id <id> is required (3–64 chars: letters, digits, . _ -)');
  }
  if (input.env[MERGE_APPLY_ENV] !== 'yes') throw new Error(`apply refused: environment variable ${MERGE_APPLY_ENV}=yes is required`);
}

/**
 * Refuse to run when migration 127 is not applied: company_merges must exist
 * and companies.merged_into must be selectable. PostgREST cannot read
 * information_schema, so both are probed with a zero-row select; an
 * undefined table (42P01 / PGRST205) or column (42703) means "not applied".
 */
export async function assertMigrationPresent(client: EntityClient): Promise<void> {
  const ledger = await client.from('company_merges').select('id').limit(0);
  if (ledger.error) throw new Error(`apply refused: migration 127 not applied (company_merges: ${ledger.error.message})`);
  const col = await client.from('companies').select('merged_into').limit(0);
  if (col.error) throw new Error(`apply refused: migration 127 not applied (companies.merged_into: ${col.error.message})`);
}

export interface ColumnRepointResult {
  count: number;
  ids: string[];
  idsTruncated: boolean;
  conflicts: number;
}

export interface ApplyPlanResult {
  canonicalId: string;
  merged: Array<{
    mergedId: string;
    auditId: string | null;
    skipped: 'already_merged' | null;
    repointed: Record<string, number>;
    conflicts: Record<string, number>;
  }>;
  aliasUnionWritten: boolean;
}

export interface ApplyLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
}

function pkOf(row: Record<string, unknown>, pk: readonly string[]): string {
  return pk.map(k => String(row[k])).join('|');
}

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  return !!err && (err.code === '23505' || /duplicate key|unique/i.test(err.message ?? ''));
}

async function pageRows(client: EntityClient, table: string, select: string, filter: (qb: any) => any): Promise<Record<string, unknown>[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await filter(client.from(table).select(select)).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} page failed: ${error.message}`);
    const rows = (data ?? []) as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/**
 * Re-point one referencing column for one merged id. Batch UPDATE first; on a
 * unique-index violation fall back to one UPDATE per row so the movable rows
 * move and the colliding ones are counted, never deleted.
 */
/** Rows per UPDATE statement when re-pointing a column. */
export const REPOINT_CHUNK = 150;

export async function repointColumn(client: EntityClient, col: ReferencingColumn, mergedId: string, canonicalId: string): Promise<ColumnRepointResult> {
  const select = col.pk.join(',');
  if (col.kind === 'uuid[]') {
    const rows = await pageRows(client, col.table, `${select},${col.column}`, qb => qb.contains(col.column, [mergedId]));
    const ids: string[] = [];
    for (const r of rows) {
      const arr = (r[col.column] as string[]) ?? [];
      const next = [...new Set(arr.map(v => (v === mergedId ? canonicalId : v)))];
      let qb = client.from(col.table).update({ [col.column]: next });
      for (const k of col.pk) qb = qb.eq(k, r[k]);
      const { error } = await qb;
      if (error) throw new Error(`${columnKey(col)} update failed: ${error.message}`);
      ids.push(pkOf(r, col.pk));
    }
    return { count: ids.length, ids: ids.slice(0, REPOINTED_IDS_CAP), idsTruncated: ids.length > REPOINTED_IDS_CAP, conflicts: 0 };
  }

  const rows = await pageRows(client, col.table, select, qb => qb.eq(col.column, mergedId));
  if (!rows.length) return { count: 0, ids: [], idsTruncated: false, conflicts: 0 };
  const allIds = rows.map(r => pkOf(r, col.pk));

  // Update in chunks keyed by primary key. One statement over thousands of rows
  // on a table with per-row triggers (clinical_assets history, updated_at)
  // exceeds the statement timeout while the ingestion crons hold locks; ~150
  // rows per statement finishes well inside it. A chunk that hits a unique
  // violation falls back to per-row updates so conflicts are counted, not fatal.
  const moved: string[] = [];
  let conflicts = 0;
  const singlePk = col.pk.length === 1 ? col.pk[0] : null;
  const perRow = async (r: Record<string, unknown>) => {
    let qb = client.from(col.table).update({ [col.column]: canonicalId });
    for (const k of col.pk) qb = qb.eq(k, r[k]);
    const { error } = await qb;
    if (!error) moved.push(pkOf(r, col.pk));
    else if (isUniqueViolation(error)) conflicts++;
    else throw new Error(`${columnKey(col)} row update failed: ${error.message}`);
  };
  for (let i = 0; i < rows.length; i += REPOINT_CHUNK) {
    const chunk = rows.slice(i, i + REPOINT_CHUNK);
    if (singlePk) {
      const keys = chunk.map(r => r[singlePk] as string);
      let attempt = 0;
      let lastError: { message: string } | null = null;
      while (attempt < 5) {
        const res = await client.from(col.table).update({ [col.column]: canonicalId }).eq(col.column, mergedId).in(singlePk, keys);
        if (!res.error) { lastError = null; break; }
        lastError = res.error;
        if (isUniqueViolation(res.error)) break;
        if (!/timeout|canceling statement|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|network|Unexpected token|<!DOCTYPE|JSON|52[0-9]/i.test(res.error.message)) throw new Error(`${columnKey(col)} update failed: ${res.error.message}`);
        attempt++;
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
      if (!lastError) { moved.push(...chunk.map(r => pkOf(r, col.pk))); continue; }
      if (!isUniqueViolation(lastError)) throw new Error(`${columnKey(col)} update failed after retries: ${lastError.message}`);
    }
    for (const r of chunk) await perRow(r);
  }
  return { count: moved.length, ids: moved.slice(0, REPOINTED_IDS_CAP), idsTruncated: moved.length > REPOINTED_IDS_CAP, conflicts };
}

/** Execute one plan. Throws on the first hard error; audit rows written so far stay. */
export async function applyMergePlan(
  client: EntityClient,
  plan: MergePlan,
  runId: string,
  log: ApplyLogger,
  columns: readonly ReferencingColumn[] = COMPANY_REFERENCING_COLUMNS,
): Promise<ApplyPlanResult> {
  const result: ApplyPlanResult = { canonicalId: plan.canonicalId, merged: [], aliasUnionWritten: false };

  // Idempotency: a row merged by an earlier run (or by hand) is skipped.
  const { data: current, error: curErr } = await client
    .from('companies')
    .select('id,merged_into')
    .in('id', [plan.canonicalId, ...plan.merged.map(m => m.id)]);
  if (curErr) throw new Error(`companies state check failed: ${curErr.message}`);
  const state = new Map(((current ?? []) as Array<{ id: string; merged_into: string | null }>).map(r => [r.id, r.merged_into]));
  if (!state.has(plan.canonicalId)) throw new Error(`canonical ${plan.canonicalId} no longer exists`);
  if (state.get(plan.canonicalId)) throw new Error(`canonical ${plan.canonicalId} is itself merged into ${state.get(plan.canonicalId)}; re-run the dry run`);

  for (const m of plan.merged) {
    if (!state.has(m.id) || state.get(m.id)) {
      log.warn(`  skip ${m.id} (${m.name}): ${state.has(m.id) ? 'already merged' : 'row missing'}`);
      result.merged.push({ mergedId: m.id, auditId: null, skipped: 'already_merged', repointed: {}, conflicts: {} });
      continue;
    }
    const strips = plan.aliasStrips.map(s => s.alias);
    const { data: audit, error: auditErr } = await client
      .from('company_merges')
      .insert({
        canonical_id: plan.canonicalId,
        merged_id: m.id,
        merged_name: m.name,
        reason: plan.reason,
        alias_union: plan.aliasUnion,
        aliases_stripped: strips,
        run_id: runId,
        dry_run: false,
      })
      .select('id')
      .single();
    if (auditErr) throw new Error(`company_merges insert failed for ${m.id}: ${auditErr.message}`);
    const auditId = (audit as { id: string }).id;

    const repointed: Record<string, number> = {};
    const repointedIds: Record<string, string[]> = {};
    const conflicts: Record<string, number> = {};
    let truncated = false;
    for (const col of columns) {
      const r = await repointColumn(client, col, m.id, plan.canonicalId);
      if (r.count) {
        repointed[columnKey(col)] = r.count;
        repointedIds[columnKey(col)] = r.ids;
      }
      if (r.conflicts) conflicts[columnKey(col)] = r.conflicts;
      if (r.idsTruncated) truncated = true;
    }

    const { error: mergeErr } = await client
      .from('companies')
      .update({ merged_into: plan.canonicalId, merged_at: new Date().toISOString() })
      .eq('id', m.id)
      .is('merged_into', null);
    if (mergeErr) throw new Error(`companies.merged_into update failed for ${m.id}: ${mergeErr.message}`);

    const { error: doneErr } = await client
      .from('company_merges')
      .update({ repointed, repointed_ids: truncated ? { ...repointedIds, _truncated: true } : repointedIds, conflicts })
      .eq('id', auditId);
    if (doneErr) throw new Error(`company_merges completion failed for ${auditId}: ${doneErr.message}`);

    const total = Object.values(repointed).reduce((s, n) => s + n, 0);
    const conflictTotal = Object.values(conflicts).reduce((s, n) => s + n, 0);
    log.info(`  merged ${m.id} (${m.name}) → ${plan.canonicalId}: ${total} rows re-pointed${conflictTotal ? `, ${conflictTotal} left on unique conflicts` : ''}`);
    result.merged.push({ mergedId: m.id, auditId, skipped: null, repointed, conflicts });
  }

  if (result.merged.some(m => !m.skipped)) {
    const { error } = await client.from('companies').update({ name_variations: plan.aliasUnion }).eq('id', plan.canonicalId);
    if (error) throw new Error(`companies.name_variations update failed for ${plan.canonicalId}: ${error.message}`);
    result.aliasUnionWritten = true;
  }
  return result;
}

/** Apply hazard-1 strips on rows outside any plan: one audit row per row, name_variations rewritten. */
export async function applyAliasStrips(client: EntityClient, strips: readonly AliasStrip[], runId: string, log: ApplyLogger): Promise<number> {
  const byRow = new Map<string, AliasStrip[]>();
  for (const s of strips) byRow.set(s.rowId, [...(byRow.get(s.rowId) ?? []), s]);
  let rows = 0;
  for (const [rowId, list] of byRow) {
    const { data, error } = await client.from('companies').select('id,name,name_variations,merged_into').eq('id', rowId).maybeSingle();
    if (error) throw new Error(`companies read failed for ${rowId}: ${error.message}`);
    const row = data as { id: string; name: string; name_variations: string[] | null; merged_into: string | null } | null;
    if (!row || row.merged_into) continue;
    const drop = new Set(list.map(s => s.alias));
    const kept = (row.name_variations ?? []).filter(v => !drop.has(v));
    if (kept.length === (row.name_variations ?? []).length) continue;
    const { error: auditErr } = await client.from('company_merges').insert({
      canonical_id: row.id,
      merged_id: null,
      merged_name: row.name,
      reason: 'alias_strip',
      alias_union: kept,
      aliases_stripped: [...drop],
      run_id: runId,
      dry_run: false,
    });
    if (auditErr) throw new Error(`company_merges insert failed for strip on ${rowId}: ${auditErr.message}`);
    const { error: updErr } = await client.from('companies').update({ name_variations: kept }).eq('id', rowId);
    if (updErr) throw new Error(`companies.name_variations strip failed for ${rowId}: ${updErr.message}`);
    log.info(`  stripped ${[...drop].map(a => JSON.stringify(a)).join(', ')} from ${row.name} (${rowId})`);
    rows++;
  }
  return rows;
}
