#!/usr/bin/env npx tsx
/**
 * Duplicate-company merge job (docs/entity-graph.md, "Merge job").
 *
 * DRY RUN (default, read-only):
 *   npx tsx scripts/merge-duplicate-companies.ts
 *   Pages every companies row, groups by normalised name, counts the
 *   references each group member has in every table that holds a
 *   companies.id, plans the merges (lib/entities/merge.ts) and writes
 *     tmp/company-merge-report.md   — human summary + review lists
 *     tmp/company-merge-plan.json   — the exact plan the apply path consumes
 *   then prints: groups, rows to merge, rows to review, references per
 *   table.column, top 20 groups by reference count. Writes nothing to the DB.
 *
 * APPLY (three guards, all required):
 *   MERGE_APPLY=yes npx tsx scripts/merge-duplicate-companies.ts --apply --run-id merge-2026-09-26
 *   Re-plans from the live table (never from a stale JSON), refuses unless
 *   migration 127 is present (company_merges + companies.merged_into), then
 *   per plan: audit row → re-point each referencing table → alias union on
 *   the canonical → merged_into/merged_at on the surplus row. Never deletes.
 *   --limit N        apply only the first N plans (ordered by reference count)
 *   --only <key>     apply one group (its compact key from the report)
 *   --skip-strips    do not apply hazard-1 alias strips on singleton rows
 *
 * Rollback: see docs/entity-graph.md — merged_into is reversible and every
 * company_merges row carries what was re-pointed.
 */

import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { COMPANY_COLS } from '../lib/entities/resolve';
import {
  COMPANY_REFERENCING_COLUMNS,
  columnKey,
  planCompanyMerges,
  repointPlan,
  type AliasStrip,
  type MergeCompanyRow,
  type MergePlan,
  type MergePlanResult,
  type ReferencingColumn,
} from '../lib/entities/merge';
import { normalizeCompanyName, compactKey } from '../lib/entities/normalize';

dotenv.config({ path: '.env.local' });

const ROOT = path.resolve(__dirname, '..');
const TMP = path.join(ROOT, 'tmp');
const REPORT = path.join(TMP, 'company-merge-report.md');
const PLAN = path.join(TMP, 'company-merge-plan.json');
const PAGE = 1000;
const ID_CHUNK = 50;

// ─── CLI ────────────────────────────────────────────────────────────────────

interface Args {
  apply: boolean;
  runId: string | null;
  limit: number | null;
  only: string | null;
  skipStrips: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false, runId: null, limit: null, only: null, skipStrips: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--run-id') args.runId = argv[++i] ?? null;
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--only') args.only = argv[++i] ?? null;
    else if (a === '--skip-strips') args.skipStrips = true;
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
      process.exit(0);
    } else {
      console.error(`unknown argument ${a}`);
      process.exit(2);
    }
  }
  return args;
}

const log = {
  info: (m: string) => console.log(m),
  warn: (m: string) => console.warn(m),
};

// ─── Read side ──────────────────────────────────────────────────────────────

const READ_COLS = `${COMPANY_COLS},source_registry,created_at`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = ReturnType<typeof createClient<any, any, any>>;

async function loadCompanies(supabase: Client): Promise<MergeCompanyRow[]> {
  // merged_into exists only after migration 127; select it when it does.
  let cols = `${READ_COLS},merged_into`;
  const probe = await supabase.from('companies').select('merged_into').limit(0);
  if (probe.error) cols = READ_COLS;
  const out: MergeCompanyRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('companies').select(cols).order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`companies page ${from} failed: ${error.message}`);
    const rows = (data ?? []) as MergeCompanyRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** rowId → total references; plus per-column totals over the same ids. */
async function countReferences(supabase: Client, ids: readonly string[]): Promise<{ perRow: Map<string, number>; perColumn: Map<string, number>; perRowColumn: Map<string, Map<string, number>> }> {
  const perRow = new Map<string, number>();
  const perColumn = new Map<string, number>();
  const perRowColumn = new Map<string, Map<string, number>>();
  const bump = (id: string, col: ReferencingColumn, n = 1) => {
    perRow.set(id, (perRow.get(id) ?? 0) + n);
    const k = columnKey(col);
    perColumn.set(k, (perColumn.get(k) ?? 0) + n);
    const m = perRowColumn.get(id) ?? new Map<string, number>();
    m.set(k, (m.get(k) ?? 0) + n);
    perRowColumn.set(id, m);
  };
  const idSet = new Set(ids);

  /** Page the rows of one chunk of ids; ordered by the filtered column (index-aligned) then the pk. */
  const pageChunk = async (col: ReferencingColumn, chunk: string[]) => {
    for (let from = 0; ; from += PAGE) {
      let qb = supabase.from(col.table).select(col.column);
      qb = col.kind === 'uuid[]' ? qb.overlaps(col.column, chunk) : qb.in(col.column, chunk);
      if (col.kind === 'uuid') qb = qb.order(col.column);
      for (const k of col.pk) qb = qb.order(k);
      const { data, error } = await qb.range(from, from + PAGE - 1);
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

  /** Heavy columns (company_trials for a big sponsor): one indexed HEAD count per id, 8 in flight. */
  const countPerId = async (col: ReferencingColumn, chunk: string[]) => {
    for (let i = 0; i < chunk.length; i += 8) {
      await Promise.all(
        chunk.slice(i, i + 8).map(async id => {
          const { count, error } = await supabase.from(col.table).select(col.column, { count: 'exact', head: true }).eq(col.column, id);
          if (error) throw new Error(`${columnKey(col)} count for ${id} failed: ${error.message}`);
          if (count) bump(id, col, count);
        }),
      );
    }
  };

  for (const col of COMPANY_REFERENCING_COLUMNS) {
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
    log.info(`  ${columnKey(col).padEnd(44)} ${String(perColumn.get(columnKey(col))).padStart(7)} rows over ${ids.length} ids${fallbacks ? ` (${fallbacks} chunks counted per id)` : ''}`);
  }
  return { perRow, perColumn, perRowColumn };
}

interface MisroutedDeal {
  dealId: string;
  rowId: string;
  rowName: string;
  side: 'licensor' | 'licensee';
  partyName: string;
  alias: string;
  parentId: string;
  parentName: string;
}

/** Hazard 1 in the wild: deals whose party id is a subsidiary row while the party name is the stripped parent alias. */
async function findMisroutedDeals(supabase: Client, strips: readonly AliasStrip[]): Promise<MisroutedDeal[]> {
  const byRow = new Map<string, AliasStrip[]>();
  for (const s of strips) byRow.set(s.rowId, [...(byRow.get(s.rowId) ?? []), s]);
  const out: MisroutedDeal[] = [];
  for (const [rowId, list] of byRow) {
    const { data, error } = await supabase
      .from('deals')
      .select('id,licensor_id,licensor_name,licensee_id,licensee_name')
      .or(`licensor_id.eq.${rowId},licensee_id.eq.${rowId}`)
      .limit(500);
    if (error) throw new Error(`deals misroute scan failed for ${rowId}: ${error.message}`);
    for (const d of (data ?? []) as Array<{ id: string; licensor_id: string | null; licensor_name: string | null; licensee_id: string | null; licensee_name: string | null }>) {
      for (const side of ['licensor', 'licensee'] as const) {
        if (d[`${side}_id`] !== rowId) continue;
        const name = d[`${side}_name`] ?? '';
        const k = compactKey(normalizeCompanyName(name));
        const hit = list.find(s => compactKey(normalizeCompanyName(s.alias)) === k);
        if (hit) out.push({ dealId: d.id, rowId, rowName: hit.rowName, side, partyName: name, alias: hit.alias, parentId: hit.parentId, parentName: hit.parentName });
      }
    }
  }
  return out;
}

// ─── Report ─────────────────────────────────────────────────────────────────

function md(s: string): string {
  return s.replace(/\|/g, '\\|');
}

function writeReport(result: MergePlanResult, perColumn: Map<string, number>, perRowColumn: Map<string, Map<string, number>>, misrouted: MisroutedDeal[], totalRows: number, when: string): string {
  const { plans, review, markerReview, singletonStrips, stats } = result;
  const lines: string[] = [];
  lines.push(`# Duplicate-company merge — dry run ${when}`, '');
  lines.push('Read-only. Nothing below has been written. Re-run with `--apply` (see docs/entity-graph.md) to execute.', '');
  lines.push('## Summary', '');
  lines.push('| Measure | Value |', '|---|---|');
  lines.push(`| companies rows read | ${totalRows} |`);
  lines.push(`| rows already merged (merged_into set) | ${stats.alreadyMerged} |`);
  lines.push(`| duplicate groups (same normalised name) | ${stats.groups} |`);
  lines.push(`| groups planned for merge | ${stats.plannedGroups} |`);
  lines.push(`| rows to fold (merged_into set) | ${stats.rowsToMerge} |`);
  lines.push(`| groups sent to review | ${stats.reviewGroups} (${stats.rowsInReview} rows) |`);
  lines.push(`| rows whose stem is another company (marker review, not merged) | ${stats.markerReviewRows} |`);
  lines.push(`| parent-name alias strips (hazard 1) | ${stats.aliasStrips} (${singletonStrips.length} on rows outside a plan) |`);
  lines.push(`| deals currently mis-routed to a subsidiary row via a parent alias | ${misrouted.length} |`);
  lines.push(`| references to re-point (rows across all tables) | ${stats.referencesToRepoint} |`, '');

  lines.push('## References to re-point per table.column', '');
  lines.push('Rows in each column that point at a row scheduled to be folded. Columns with a unique index (last column) can leave conflicts on the merged row; those are counted in the audit ledger, never deleted.', '');
  lines.push('| table.column | rows on merged ids | fk | on delete | unique with |', '|---|---:|---|---|---|');
  const mergedIds = new Set(plans.flatMap(p => p.merged.map(m => m.id)));
  for (const c of COMPANY_REFERENCING_COLUMNS) {
    const k = columnKey(c);
    let n = 0;
    for (const id of mergedIds) n += perRowColumn.get(id)?.get(k) ?? 0;
    lines.push(`| ${k} | ${n} | ${c.fk ? 'yes' : 'no'} | ${c.onDelete ?? '—'} | ${c.uniqueWith?.join(', ') ?? '—'} |`);
  }
  lines.push('', `Total rows on all group members (canonical + merged): ${[...perColumn.values()].reduce((s, n) => s + n, 0)}.`, '');

  lines.push('## Top 20 groups by references to re-point', '');
  lines.push('| # | canonical (score, refs) | folded rows (score, refs) | refs to move | strips |', '|---|---|---|---:|---:|');
  plans.slice(0, 20).forEach((p, i) => {
    const folded = p.merged.map(m => `${md(m.name)} (${m.populationScore}, ${m.referenceCount})`).join('; ');
    lines.push(`| ${i + 1} | ${md(p.canonicalName)} (${p.canonicalScore}, ${p.canonicalReferenceCount}) \`${p.canonicalId.slice(0, 8)}\` | ${folded} | ${p.referenceCount} | ${p.aliasStrips.length} |`);
  });
  lines.push('');

  lines.push('## Review — not merged', '');
  lines.push(`${review.length} groups share a normalised name but tripped a guard rail. A person decides; the job never touches them.`, '');
  for (const r of review) {
    lines.push(`- **${r.reason}** \`${r.key}\` — ${md(r.detail)}`);
    for (const row of r.rows) lines.push(`  - ${md(row.name)} \`${row.id}\` score ${row.populationScore}${row.ticker ? ` ticker ${row.ticker}` : ''}${row.cik ? ` cik ${row.cik}` : ''}`);
  }
  lines.push('');

  lines.push('## Marker review — subsidiary / division rows next to their parent', '');
  lines.push(`${markerReview.length} rows whose name minus a parenthetical or division word is another canonical row. Listed for information; they are separate organisations until a person says otherwise. First 60:`, '');
  for (const m of markerReview.slice(0, 60)) lines.push(`- ${md(m.rowName)} \`${m.rowId.slice(0, 8)}\` [${m.markers.join(', ')}] ↔ ${md(m.stemRowName)} \`${m.stemRowId.slice(0, 8)}\``);
  lines.push('');

  const allStrips = [...plans.flatMap(p => p.aliasStrips), ...singletonStrips];
  lines.push('## Parent-name alias strips (hazard 1)', '');
  lines.push(`${allStrips.length} name_variations entries are the exact name of a separate canonical row and will be removed from the subsidiary row (audit reason \`alias_strip\` for rows outside a plan). First 100:`, '');
  for (const s of allStrips.slice(0, 100)) lines.push(`- ${md(s.rowName)} \`${s.rowId.slice(0, 8)}\` loses "${md(s.alias)}" (row ${md(s.parentName)} \`${s.parentId.slice(0, 8)}\`)`);
  lines.push('');

  lines.push('## Deals mis-routed through a parent alias', '');
  lines.push('Deals whose licensor_id / licensee_id points at a row that carries the party name only as a (stripped) alias, while a row named exactly that exists. Most are hazard 1 (Alexion (AstraZeneca) holding AstraZeneca deals); a few are the same organisation under two rows (Moderna / Moderna TX Inc.) and a person decides. The merge job does not change these (it only strips the alias so it cannot recur); re-resolve the party id by hand or with `POST /api/entities/resolve`.', '');
  for (const d of misrouted) lines.push(`- deal \`${d.dealId}\` ${d.side} "${md(d.partyName)}" → row ${md(d.rowName)} \`${d.rowId.slice(0, 8)}\`; should be ${md(d.parentName)} \`${d.parentId.slice(0, 8)}\``);
  lines.push('');

  lines.push('## All planned groups', '');
  lines.push('| canonical | folded | refs |', '|---|---|---:|');
  for (const p of plans) lines.push(`| ${md(p.canonicalName)} \`${p.canonicalId.slice(0, 8)}\` | ${p.merged.map(m => `${md(m.name)} \`${m.id.slice(0, 8)}\``).join('; ')} | ${p.referenceCount} |`);
  lines.push('');

  lines.push('## Sample SQL for the top group', '');
  if (plans[0]) {
    lines.push('```sql');
    for (const s of repointPlan(plans[0])) lines.push(s.sql);
    lines.push('```', '');
  }
  return lines.join('\n');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local)');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const when = new Date().toISOString();

  if (args.apply) {
    // Guards run before any read so a mis-typed invocation stops at once.
    const { assertApplyGuards, assertMigrationPresent } = await import('../lib/entities/merge-apply');
    assertApplyGuards({ apply: args.apply, runId: args.runId, env: process.env });
    await assertMigrationPresent(supabase);
  }

  log.info(`Loading companies…`);
  const companies = await loadCompanies(supabase);
  log.info(`  ${companies.length} rows`);

  // Pass 1: groups without reference counts, to know which ids to count.
  const first = planCompanyMerges(companies, { skipAliasStrips: true });
  const groupIds = new Set<string>();
  for (const p of first.plans) {
    groupIds.add(p.canonicalId);
    for (const m of p.merged) groupIds.add(m.id);
  }
  for (const r of first.review) for (const row of r.rows) groupIds.add(row.id);
  log.info(`Counting references for ${groupIds.size} rows in ${first.stats.groups} groups across ${COMPANY_REFERENCING_COLUMNS.length} columns…`);
  const refs = await countReferences(supabase, [...groupIds]);

  // Pass 2: the real plan, with counts as tie-break and for the report.
  const result = planCompanyMerges(companies, { referenceCounts: refs.perRow });
  const allStrips = [...result.plans.flatMap(p => p.aliasStrips), ...result.singletonStrips];
  log.info(`Scanning deals for parties mis-routed through ${allStrips.length} parent aliases…`);
  const misrouted = await findMisroutedDeals(supabase, allStrips);

  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(REPORT, writeReport(result, refs.perColumn, refs.perRowColumn, misrouted, companies.length, when));
  fs.writeFileSync(
    PLAN,
    JSON.stringify(
      {
        generatedAt: when,
        dryRun: !args.apply,
        stats: result.stats,
        referencingColumns: COMPANY_REFERENCING_COLUMNS,
        referencesPerColumn: Object.fromEntries(refs.perColumn),
        plans: result.plans,
        review: result.review,
        markerReview: result.markerReview,
        singletonStrips: result.singletonStrips,
        misroutedDeals: misrouted,
      },
      null,
      2,
    ),
  );

  const s = result.stats;
  log.info('');
  log.info(`Duplicate-company merge — ${args.apply ? 'APPLY' : 'DRY RUN'} ${when}`);
  log.info(`  companies rows            ${s.rows} (${s.alreadyMerged} already merged)`);
  log.info(`  duplicate groups          ${s.groups}`);
  log.info(`  groups planned            ${s.plannedGroups}  → rows to fold ${s.rowsToMerge}`);
  log.info(`  groups to review          ${s.reviewGroups}  (${s.rowsInReview} rows)`);
  log.info(`  marker review rows        ${s.markerReviewRows}`);
  log.info(`  parent-alias strips       ${s.aliasStrips}  (${result.singletonStrips.length} outside a plan)`);
  log.info(`  mis-routed deals          ${misrouted.length}`);
  log.info(`  references to re-point    ${s.referencesToRepoint}`);
  log.info('  per table.column (rows on merged ids):');
  const mergedIds = new Set(result.plans.flatMap(p => p.merged.map(m => m.id)));
  for (const c of COMPANY_REFERENCING_COLUMNS) {
    let n = 0;
    for (const id of mergedIds) n += refs.perRowColumn.get(id)?.get(columnKey(c)) ?? 0;
    if (n) log.info(`    ${columnKey(c).padEnd(44)} ${String(n).padStart(7)}`);
  }
  log.info('  top 20 groups by references:');
  result.plans.slice(0, 20).forEach((p, i) => {
    log.info(`    ${String(i + 1).padStart(2)}. ${p.canonicalName}  ← ${p.merged.map(m => m.name).join(' | ')}  (${p.referenceCount} refs, ${p.merged.length} rows)`);
  });
  log.info(`  report ${path.relative(ROOT, REPORT)}`);
  log.info(`  plan   ${path.relative(ROOT, PLAN)}`);

  if (!args.apply) return;

  // ── Apply ────────────────────────────────────────────────────────────────
  const { applyMergePlan, applyAliasStrips } = await import('../lib/entities/merge-apply');
  let plans: MergePlan[] = result.plans;
  if (args.only) plans = plans.filter(p => p.key === args.only);
  if (args.limit != null && Number.isFinite(args.limit)) plans = plans.slice(0, Math.max(0, args.limit));
  log.info('');
  log.info(`Applying ${plans.length} plans (run ${args.runId})…`);
  let folded = 0;
  let repointed = 0;
  let conflicts = 0;
  for (const [i, p] of plans.entries()) {
    log.info(`[${i + 1}/${plans.length}] ${p.canonicalName} (${p.canonicalId})`);
    const r = await applyMergePlan(supabase, p, args.runId!, log);
    for (const m of r.merged) {
      if (m.skipped) continue;
      folded++;
      repointed += Object.values(m.repointed).reduce((a, b) => a + b, 0);
      conflicts += Object.values(m.conflicts).reduce((a, b) => a + b, 0);
    }
  }
  let stripped = 0;
  if (!args.skipStrips && !args.only && args.limit == null) {
    log.info(`Applying ${result.singletonStrips.length} alias strips on rows outside a plan…`);
    stripped = await applyAliasStrips(supabase, result.singletonStrips, args.runId!, log);
  } else if (result.singletonStrips.length) {
    log.info(`Skipping ${result.singletonStrips.length} singleton alias strips (--skip-strips / --only / --limit); run a full apply to write them.`);
  }
  log.info('');
  log.info(`Done: ${folded} rows folded, ${repointed} references re-pointed, ${conflicts} left on unique conflicts, ${stripped} rows had parent aliases stripped. Audit: company_merges WHERE run_id = '${args.runId}'.`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
