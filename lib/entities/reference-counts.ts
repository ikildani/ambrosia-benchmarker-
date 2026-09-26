/**
 * Count references to a set of companies.id across COMPANY_REFERENCING_COLUMNS.
 *
 * Extracted from scripts/merge-duplicate-companies.ts so the cleanup scripts
 * (same-company merges, junk retirement) rank and report on the same numbers.
 * Pages every column in index-aligned order, retries transient failures, and
 * falls back to one indexed HEAD count per id when a chunk times out (a big
 * sponsor's company_trials).
 */

import { COMPANY_REFERENCING_COLUMNS, columnKey, type ReferencingColumn } from './merge';
import type { EntityClient } from './resolve';

export interface ReferenceCounts {
  perRow: Map<string, number>;
  perColumn: Map<string, number>;
  perRowColumn: Map<string, Map<string, number>>;
}

export interface ReferenceCountOptions {
  /** Rows per page when walking a column (default 250). */
  page?: number;
  /** Ids per IN () chunk (default 50). */
  idChunk?: number;
  /** Columns to count (default COMPANY_REFERENCING_COLUMNS). */
  columns?: readonly ReferencingColumn[];
  log?: (line: string) => void;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function countCompanyReferences(supabase: EntityClient, ids: readonly string[], opts: ReferenceCountOptions = {}): Promise<ReferenceCounts> {
  const PAGE = opts.page ?? 250;
  const ID_CHUNK = opts.idChunk ?? 50;
  const columns = opts.columns ?? COMPANY_REFERENCING_COLUMNS;
  const log = opts.log ?? (() => {});
  const perRow = new Map<string, number>();
  const perColumn = new Map<string, number>();
  const perRowColumn = new Map<string, Map<string, number>>();
  const idSet = new Set(ids);
  const bump = (id: string, col: ReferencingColumn, n = 1) => {
    perRow.set(id, (perRow.get(id) ?? 0) + n);
    const k = columnKey(col);
    perColumn.set(k, (perColumn.get(k) ?? 0) + n);
    const m = perRowColumn.get(id) ?? new Map<string, number>();
    m.set(k, (m.get(k) ?? 0) + n);
    perRowColumn.set(id, m);
  };

  const pageChunk = async (col: ReferencingColumn, chunk: string[]) => {
    for (let from = 0; ; from += PAGE) {
      let qb = supabase.from(col.table).select(col.column);
      qb = col.kind === 'uuid[]' ? qb.overlaps(col.column, chunk) : qb.in(col.column, chunk);
      if (col.kind === 'uuid') qb = qb.order(col.column);
      for (const k of col.pk) qb = qb.order(k);
      let data: unknown[] | null = null;
      let error: { message: string } | null = null;
      for (let attempt = 1; attempt <= 4; attempt++) {
        const res = await qb.range(from, from + PAGE - 1);
        data = res.data as unknown[] | null;
        error = res.error;
        if (!error || attempt === 4) break;
        await sleep(1500 * attempt);
      }
      if (error) throw Object.assign(new Error(`${columnKey(col)} count failed: ${error.message}`), { timeout: /timeout|canceling statement/i.test(error.message) });
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      for (const r of rows) {
        const v = r[col.column];
        if (Array.isArray(v)) {
          for (const x of new Set(v as string[])) if (idSet.has(x)) bump(x, col);
        } else if (typeof v === 'string' && idSet.has(v)) bump(v, col);
      }
      if (rows.length < PAGE) break;
    }
  };

  const countPerId = async (col: ReferencingColumn, chunk: string[]) => {
    for (let i = 0; i < chunk.length; i += 8) {
      await Promise.all(
        chunk.slice(i, i + 8).map(async id => {
          let count: number | null = null;
          let error: { message: string } | null = null;
          for (let attempt = 1; attempt <= 4; attempt++) {
            const res = await supabase.from(col.table).select(col.column, { count: 'exact', head: true }).eq(col.column, id);
            count = res.count;
            error = res.error;
            if (!error || attempt === 4) break;
            await sleep(1500 * attempt);
          }
          if (error) throw new Error(`${columnKey(col)} count for ${id} failed: ${error.message}`);
          if (count) bump(id, col, count);
        }),
      );
    }
  };

  for (const col of columns) {
    let fallbacks = 0;
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const chunk = ids.slice(i, i + ID_CHUNK);
      try {
        await pageChunk(col, chunk);
      } catch (err) {
        if (!(err as { timeout?: boolean }).timeout || col.kind === 'uuid[]') throw err;
        fallbacks++;
        await countPerId(col, chunk);
      }
    }
    if (!perColumn.has(columnKey(col))) perColumn.set(columnKey(col), 0);
    log(`  ${columnKey(col).padEnd(44)} ${String(perColumn.get(columnKey(col))).padStart(7)} rows over ${ids.length} ids${fallbacks ? ` (${fallbacks} chunks counted per id)` : ''}`);
  }
  return { perRow, perColumn, perRowColumn };
}
