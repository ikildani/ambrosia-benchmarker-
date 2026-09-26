/**
 * Shared entity graph — duplicate-company merge planning. Pure: no I/O.
 *
 * Input: every companies row (or any subset). Output: a MergePlan per group
 * of rows that share a normalised name (lib/entities/normalize.ts, spacing
 * ignored), the canonical row chosen with companyPopulationScore, the
 * name_variations union to write on it, and the rows that go to a review
 * list instead of being merged.
 *
 * Guard rails (each one is a test in __tests__/lib/entities/merge.test.ts):
 *   1. Two rows that both carry a ticker, and the tickers differ, are never
 *      merged; same for cik / sec_cik. The group goes to `review`.
 *   2. Rows whose names differ by a subsidiary / division marker — a
 *      parenthetical ("Alexion (AstraZeneca)"), a trailing division word
 *      ("Pfizer Oncology", "Sanofi Vaccines"), or a known subsidiary name —
 *      go to `review`, never to a plan. Inside a group this means the rows'
 *      stems or markers are not identical; across groups it means a row's
 *      stem is another canonical row's name (reported as `markerReview`).
 *   3. Hazard 1 (docs/entity-graph.md): a subsidiary row that lists its
 *      parent's name in name_variations ("Kite (Gilead)" carrying "Gilead")
 *      mis-routes alias matches. Any variation that is the exact name of a
 *      separate canonical row is stripped from the union and recorded in
 *      `aliasStrips` — for merged groups and for singleton rows alike.
 *
 * repointPlan() turns a plan into the UPDATE statements per referencing
 * table.column (COMPANY_REFERENCING_COLUMNS, measured against pg_catalog on
 * Sep 25 2026 — every foreign key to companies.id plus the three uuid columns
 * that hold a companies.id without a constraint). The apply path in
 * lib/entities/merge-apply.ts executes the same list through supabase-js.
 */

import { compactKey, normalizeCompanyName, sameCompanyKey } from './normalize';
import { companyPopulationScore, type CompanyRow } from './resolve';

// ─── Referencing tables ─────────────────────────────────────────────────────

export interface ReferencingColumn {
  table: string;
  column: string;
  /** uuid: one id per row; 'uuid[]': array column holding companies.id values. */
  kind: 'uuid' | 'uuid[]';
  /** True when a FOREIGN KEY to companies(id) exists. */
  fk: boolean;
  onDelete: 'cascade' | 'set_null' | null;
  /**
   * Other columns of a UNIQUE index that includes this column. Repointing a
   * row whose key already exists on the canonical id violates the index; such
   * rows are left on the merged id (which still exists) and counted as conflicts.
   */
  uniqueWith: string[] | null;
  /** Primary-key column(s), for the rollback id list in company_merges.repointed_ids. */
  pk: string[];
}

/**
 * Every column that holds a companies.id. Source: pg_constraint (contype =
 * 'f', confrelid = companies) and pg_attribute for uuid columns named after a
 * company, Sep 25 2026. Keep in sync with docs/entity-graph.md "Merge job".
 */
export const COMPANY_REFERENCING_COLUMNS: readonly ReferencingColumn[] = [
  { table: 'deals', column: 'licensor_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'deals', column: 'licensee_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'drug_owners', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'cascade', uniqueWith: ['drug_id', 'role', 'territory'], pk: ['id'] },
  { table: 'drug_master', column: 'originator_company_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'clinical_assets', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'clinical_assets', column: 'partner_company_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'counterparty_premiums', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'cascade', uniqueWith: ['as_of_date'], pk: ['id'] },
  { table: 'company_trials', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'cascade', uniqueWith: ['nct_id'], pk: ['id'] },
  { table: 'company_financials', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'cascade', uniqueWith: ['fiscal_period_end', 'period_type'], pk: ['id'] },
  { table: 'company_intent_signals', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'cascade', uniqueWith: ['signal_type', 'source_type', 'source_id'], pk: ['id'] },
  { table: 'company_patents', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'cascade', uniqueWith: ['patent_id'], pk: ['id'] },
  { table: 'licensing_signals', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'intent_score_snapshots', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'cascade', uniqueWith: ['modality', 'indication', 'snapshot_date'], pk: ['id'] },
  { table: 'drug_revenues', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'cascade', uniqueWith: ['drug_name_normalized', 'fiscal_year', 'fiscal_period'], pk: ['id'] },
  { table: 'trial_interventions', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'sponsor_aliases', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'competitive_intel', column: 'competitor_company_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'radar_deal_opportunities', column: 'acquirer_company_id', kind: 'uuid', fk: true, onDelete: 'cascade', uniqueWith: ['asset_id'], pk: ['id'] },
  { table: 'radar_deal_opportunities', column: 'asset_company_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'asset_catalysts', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'predictions', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'outcomes', column: 'licensee_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'outreach_emails', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'set_null', uniqueWith: null, pk: ['id'] },
  { table: 'watchlist_items', column: 'company_id', kind: 'uuid', fk: true, onDelete: 'cascade', uniqueWith: null, pk: ['id'] },
  // No foreign key, but the value is a companies.id.
  { table: 'radar_score_snapshots', column: 'company_id', kind: 'uuid', fk: false, onDelete: null, uniqueWith: null, pk: ['feature_version', 'as_of', 'asset_id'] },
  { table: 'portfolio_deal_pipelines', column: 'partner_company_id', kind: 'uuid', fk: false, onDelete: null, uniqueWith: null, pk: ['id'] },
  { table: 'press_releases', column: 'company_ids', kind: 'uuid[]', fk: false, onDelete: null, uniqueWith: null, pk: ['id'] },
];

export function columnKey(c: Pick<ReferencingColumn, 'table' | 'column'>): string {
  return `${c.table}.${c.column}`;
}

// ─── Subsidiary / division markers ──────────────────────────────────────────

/**
 * Trailing words that name a division of a larger company rather than a
 * different legal spelling of the same one. "Pfizer Oncology" is not a
 * duplicate of "Pfizer".
 */
export const DIVISION_MARKERS: readonly string[] = [
  'oncology', 'respiratory', 'ophthalmology', 'consumer health', 'consumer healthcare', 'vaccines', 'animal health',
  'diagnostics', 'biosimilars', 'generics', 'rare disease', 'rare diseases', 'gene therapy', 'cell therapy',
  'neuroscience', 'immunology', 'cardiovascular', 'dermatology', 'medical devices', 'nutrition', 'research',
  'ventures', 'foundation', 'japan', 'china', 'usa', 'uk', 'europe',
];

/**
 * Subsidiaries that trade under their own name inside a parent. A name that
 * is one of these next to a parent name ("Roche Genentech", "Genentech
 * (Roche)") is a subsidiary row, not a duplicate of the parent.
 */
export const KNOWN_SUBSIDIARIES: Readonly<Record<string, string>> = {
  genentech: 'roche',
  chugai: 'roche',
  'spark therapeutics': 'roche',
  janssen: 'johnson and johnson',
  'janssen biotech': 'johnson and johnson',
  'janssen cilag': 'johnson and johnson',
  actelion: 'johnson and johnson',
  alexion: 'astrazeneca',
  medimmune: 'astrazeneca',
  kite: 'gilead',
  'kite pharma': 'gilead',
  allergan: 'abbvie',
  pharmacyclics: 'abbvie',
  celgene: 'bristol myers squibb',
  'juno therapeutics': 'bristol myers squibb',
  shire: 'takeda',
  'takeda oncology': 'takeda',
  sandoz: 'novartis',
  'viiv healthcare': 'gsk',
  'tesaro': 'gsk',
  'loxo oncology': 'eli lilly',
  'seagen': 'pfizer',
  'array biopharma': 'pfizer',
  'horizon therapeutics': 'amgen',
  'immunomedics': 'gilead',
  'biohaven': 'pfizer',
  'mylan': 'viatris',
  'sobi': 'swedish orphan biovitrum',
  'boehringer ingelheim pharmaceuticals': 'boehringer ingelheim',
};

export interface NameParts {
  /** Normalised name with parentheticals and a trailing division word removed. */
  stem: string;
  /** Normalised markers found: parenthetical contents, division words, known-subsidiary tokens. */
  markers: string[];
}

/**
 * Split a raw company name into its stem and its subsidiary / division
 * markers. Pure; exported for tests.
 *
 *   "Alexion (AstraZeneca)"  → { stem: "alexion", markers: ["astrazeneca"] }
 *   "Pfizer Oncology"        → { stem: "pfizer",  markers: ["oncology"] }
 *   "Kyowa Kirin Co., Ltd."  → { stem: "kyowa kirin", markers: [] }
 */
export function splitNameMarkers(raw: string | null | undefined): NameParts {
  const markers: string[] = [];
  let s = raw ?? '';
  // Parentheticals (possibly nested or repeated) are markers.
  s = s.replace(/\(([^()]*)\)/g, (_m, inner: string) => {
    const k = normalizeCompanyName(inner);
    if (k) markers.push(k);
    return ' ';
  });
  let stem = normalizeCompanyName(s);
  // A trailing division word (longest first so "consumer health" wins over "health").
  const byLength = [...DIVISION_MARKERS].sort((a, b) => b.length - a.length);
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of byLength) {
      if (stem !== m && stem.endsWith(` ${m}`)) {
        markers.push(m);
        stem = stem.slice(0, -(m.length + 1)).trim();
        changed = true;
        break;
      }
    }
  }
  // A known subsidiary next to its parent ("Roche Genentech", "Genentech Roche").
  for (const sub of Object.keys(KNOWN_SUBSIDIARIES)) {
    const parent = KNOWN_SUBSIDIARIES[sub];
    if (stem !== sub && stem !== parent && (stem === `${parent} ${sub}` || stem === `${sub} ${parent}`)) {
      markers.push(sub);
      stem = parent;
      break;
    }
  }
  return { stem, markers: [...new Set(markers)] };
}

/** True when two raw names are the same organisation name except for a subsidiary / division marker. */
export function differOnlyByMarker(a: string, b: string): boolean {
  const pa = splitNameMarkers(a);
  const pb = splitNameMarkers(b);
  if (sameCompanyKey(normalizeCompanyName(a), normalizeCompanyName(b))) return false;
  if (!pa.stem || !pb.stem) return false;
  if (!sameCompanyKey(pa.stem, pb.stem)) return false;
  return pa.markers.join('|') !== pb.markers.join('|');
}

// ─── Plan types ─────────────────────────────────────────────────────────────

export interface MergeCompanyRow extends CompanyRow {
  source_registry?: string | null;
  created_at?: string | null;
  merged_into?: string | null;
}

export interface MergedRowPlan {
  id: string;
  name: string;
  populationScore: number;
  /** References to this row across COMPANY_REFERENCING_COLUMNS, when the caller counted them. */
  referenceCount: number;
  reasons: string[];
}

export interface AliasStrip {
  /** The row whose name_variations loses `alias`. */
  rowId: string;
  rowName: string;
  alias: string;
  /** The separate canonical row whose exact name the alias is. */
  parentId: string;
  parentName: string;
}

export interface MergePlan {
  /** compactKey of the normalised name shared by every row in the group. */
  key: string;
  canonicalId: string;
  canonicalName: string;
  canonicalScore: number;
  canonicalReferenceCount: number;
  merged: MergedRowPlan[];
  /** name_variations to write on the canonical (union of the group, parent names stripped). */
  aliasUnion: string[];
  aliasStrips: AliasStrip[];
  reason: string;
  /** Sum of referenceCount over the merged rows (what the apply will re-point). */
  referenceCount: number;
}

export type ReviewReason = 'ticker_conflict' | 'cik_conflict' | 'subsidiary_marker';

export interface ReviewItem {
  key: string;
  reason: ReviewReason;
  detail: string;
  rows: Array<{ id: string; name: string; ticker: string | null; cik: string | null; populationScore: number }>;
}

/** A row whose stem (marker removed) is another canonical row's name. Not merged; listed for a person. */
export interface MarkerReviewItem {
  rowId: string;
  rowName: string;
  markers: string[];
  stemRowId: string;
  stemRowName: string;
}

export interface MergePlanResult {
  plans: MergePlan[];
  review: ReviewItem[];
  markerReview: MarkerReviewItem[];
  /** Strips on rows that are not part of any plan (applied as their own audit rows). */
  singletonStrips: AliasStrip[];
  stats: {
    rows: number;
    alreadyMerged: number;
    groups: number;
    plannedGroups: number;
    rowsToMerge: number;
    reviewGroups: number;
    rowsInReview: number;
    markerReviewRows: number;
    aliasStrips: number;
    referencesToRepoint: number;
  };
}

export interface PlanOptions {
  /** rowId → number of references across COMPANY_REFERENCING_COLUMNS (tie-break and reporting). */
  referenceCounts?: ReadonlyMap<string, number>;
  /** Skip hazard-1 stripping entirely. Default false. */
  skipAliasStrips?: boolean;
}

// ─── Planning ───────────────────────────────────────────────────────────────

function tickerOf(r: CompanyRow): string | null {
  const t = (r.ticker ?? '').trim().toUpperCase();
  return t || null;
}

function cikOf(r: CompanyRow): string | null {
  const raw = r.cik ?? r.sec_cik ?? '';
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  return digits || null;
}

function distinct(values: Array<string | null>): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}

/**
 * Canonical row of a group: companyPopulationScore, then references (a row
 * every deal already points at is a better survivor), then an enriched
 * (non-registry) row, then the oldest row, then the lowest id.
 */
export function rankCanonical<T extends MergeCompanyRow>(rows: readonly T[], referenceCounts?: ReadonlyMap<string, number>): T[] {
  const refs = (r: T) => referenceCounts?.get(r.id) ?? 0;
  const registry = (r: T) => (r.source_registry ? 1 : 0);
  const created = (r: T) => r.created_at ?? '9999';
  return [...rows].sort(
    (a, b) =>
      companyPopulationScore(b) - companyPopulationScore(a) ||
      refs(b) - refs(a) ||
      registry(a) - registry(b) ||
      created(a).localeCompare(created(b)) ||
      a.id.localeCompare(b.id),
  );
}

/** Union of a group's names and name_variations, canonical first, exact-string deduped. */
export function unionAliases(canonical: CompanyRow, others: readonly CompanyRow[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (v: string | null | undefined) => {
    const t = (v ?? '').trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  add(canonical.name);
  for (const v of canonical.name_variations ?? []) add(v);
  for (const r of others) {
    add(r.name);
    for (const v of r.name_variations ?? []) add(v);
  }
  return out;
}

interface Group {
  key: string;
  rows: MergeCompanyRow[];
}

function groupByKey(rows: readonly MergeCompanyRow[]): Map<string, Group> {
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const key = compactKey(normalizeCompanyName(r.name));
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.rows.push(r);
    else groups.set(key, { key, rows: [r] });
  }
  return groups;
}

/**
 * Plan the merges. `rows` may be the whole table (the script pages it) or a
 * subset; a row already carrying merged_into is ignored.
 */
export function planCompanyMerges(rows: readonly MergeCompanyRow[], opts: PlanOptions = {}): MergePlanResult {
  const refs = opts.referenceCounts;
  const refOf = (id: string) => refs?.get(id) ?? 0;
  const live = rows.filter(r => !r.merged_into);
  const groups = groupByKey(live);

  // Canonical row per key (singletons are their own canonical) — the index
  // every hazard-1 strip and every cross-group marker check reads.
  const canonicalByKey = new Map<string, MergeCompanyRow>();
  for (const g of groups.values()) canonicalByKey.set(g.key, rankCanonical(g.rows, refs)[0]);

  const plans: MergePlan[] = [];
  const review: ReviewItem[] = [];
  const plannedRowIds = new Set<string>();

  for (const g of groups.values()) {
    if (g.rows.length < 2) continue;
    const ranked = rankCanonical(g.rows, refs);
    const summary = ranked.map(r => ({ id: r.id, name: r.name, ticker: tickerOf(r), cik: cikOf(r), populationScore: companyPopulationScore(r) }));

    // Guard 1: distinct structured ids.
    const tickers = distinct(ranked.map(tickerOf));
    if (tickers.length > 1) {
      review.push({ key: g.key, reason: 'ticker_conflict', detail: `tickers ${tickers.join(', ')}`, rows: summary });
      continue;
    }
    const ciks = distinct(ranked.map(cikOf));
    if (ciks.length > 1) {
      review.push({ key: g.key, reason: 'cik_conflict', detail: `ciks ${ciks.join(', ')}`, rows: summary });
      continue;
    }

    // Guard 2 (inside the group): the rows' stems / markers must be identical.
    const parts = ranked.map(r => splitNameMarkers(r.name));
    const first = parts[0];
    const markerMismatch = parts.find(p => !sameCompanyKey(p.stem, first.stem) || p.markers.join('|') !== first.markers.join('|'));
    if (markerMismatch) {
      review.push({
        key: g.key,
        reason: 'subsidiary_marker',
        detail: `names differ by a subsidiary/division marker: ${ranked.map(r => JSON.stringify(r.name)).join(' vs ')}`,
        rows: summary,
      });
      continue;
    }

    const canonical = ranked[0];
    const others = ranked.slice(1);
    const merged: MergedRowPlan[] = others.map(r => ({
      id: r.id,
      name: r.name,
      populationScore: companyPopulationScore(r),
      referenceCount: refOf(r.id),
      reasons: [
        `same normalised name "${normalizeCompanyName(r.name)}" as canonical "${canonical.name}"`,
        `population ${companyPopulationScore(r)} ≤ ${companyPopulationScore(canonical)}`,
      ],
    }));
    const union = unionAliases(canonical, others);
    const { kept, strips } = opts.skipAliasStrips ? { kept: union, strips: [] } : stripParentAliases(canonical, g.key, union, canonicalByKey);
    plans.push({
      key: g.key,
      canonicalId: canonical.id,
      canonicalName: canonical.name,
      canonicalScore: companyPopulationScore(canonical),
      canonicalReferenceCount: refOf(canonical.id),
      merged,
      aliasUnion: kept,
      aliasStrips: strips,
      reason: 'same_normalized_name',
      referenceCount: merged.reduce((s, m) => s + m.referenceCount, 0),
    });
    for (const r of g.rows) plannedRowIds.add(r.id);
  }

  // Cross-group guard 2: a row whose stem is another canonical row's name.
  const markerReview: MarkerReviewItem[] = [];
  for (const g of groups.values()) {
    const row = canonicalByKey.get(g.key)!;
    const p = splitNameMarkers(row.name);
    if (!p.markers.length || !p.stem) continue;
    const stemKey = compactKey(p.stem);
    if (stemKey === g.key) continue;
    const stemRow = canonicalByKey.get(stemKey);
    if (stemRow) markerReview.push({ rowId: row.id, rowName: row.name, markers: p.markers, stemRowId: stemRow.id, stemRowName: stemRow.name });
  }

  // Hazard 1 on rows outside any plan.
  const singletonStrips: AliasStrip[] = [];
  if (!opts.skipAliasStrips) {
    for (const g of groups.values()) {
      if (plannedRowIds.has(g.rows[0].id) && g.rows.length > 1) continue;
      for (const row of g.rows) {
        if (plannedRowIds.has(row.id)) continue;
        const { strips } = stripParentAliases(row, g.key, row.name_variations ?? [], canonicalByKey);
        singletonStrips.push(...strips);
      }
    }
  }

  plans.sort((a, b) => b.referenceCount - a.referenceCount || b.merged.length - a.merged.length || a.canonicalName.localeCompare(b.canonicalName));
  const rowsToMerge = plans.reduce((s, p) => s + p.merged.length, 0);
  const planStrips = plans.reduce((s, p) => s + p.aliasStrips.length, 0);
  return {
    plans,
    review,
    markerReview,
    singletonStrips,
    stats: {
      rows: rows.length,
      alreadyMerged: rows.length - live.length,
      groups: [...groups.values()].filter(g => g.rows.length > 1).length,
      plannedGroups: plans.length,
      rowsToMerge,
      reviewGroups: review.length,
      rowsInReview: review.reduce((s, r) => s + r.rows.length, 0),
      markerReviewRows: markerReview.length,
      aliasStrips: planStrips + singletonStrips.length,
      referencesToRepoint: plans.reduce((s, p) => s + p.referenceCount, 0),
    },
  };
}

/**
 * Hazard 1: drop every variation that is the exact name of a different
 * canonical row, unless it is the row's own stem ("Alexion" stays on
 * "Alexion (AstraZeneca)"; "AstraZeneca" goes when an AstraZeneca row exists).
 */
export function stripParentAliases(
  row: MergeCompanyRow,
  ownKey: string,
  aliases: readonly string[],
  canonicalByKey: ReadonlyMap<string, MergeCompanyRow>,
): { kept: string[]; strips: AliasStrip[] } {
  const ownStem = compactKey(splitNameMarkers(row.name).stem);
  const kept: string[] = [];
  const strips: AliasStrip[] = [];
  for (const alias of aliases) {
    const k = compactKey(normalizeCompanyName(alias));
    if (!k || k === ownKey || k === ownStem) {
      kept.push(alias);
      continue;
    }
    const parent = canonicalByKey.get(k);
    if (parent && parent.id !== row.id) {
      strips.push({ rowId: row.id, rowName: row.name, alias, parentId: parent.id, parentName: parent.name });
      continue;
    }
    kept.push(alias);
  }
  return { kept, strips };
}

// ─── Repoint plan ───────────────────────────────────────────────────────────

export interface RepointStatement {
  table: string;
  column: string;
  kind: ReferencingColumn['kind'];
  mergedId: string;
  canonicalId: string;
  /** SQL an operator could run by hand; the apply path issues the equivalent through supabase-js. */
  sql: string;
  uniqueWith: string[] | null;
}

function q(id: string): string {
  return `'${id.replace(/'/g, "''")}'`;
}

/** The UPDATE per referencing column for every merged row of a plan, plus the companies writes. */
export function repointPlan(plan: MergePlan, referencingColumns: readonly ReferencingColumn[] = COMPANY_REFERENCING_COLUMNS): RepointStatement[] {
  const out: RepointStatement[] = [];
  for (const m of plan.merged) {
    for (const c of referencingColumns) {
      let sql: string;
      if (c.kind === 'uuid[]') {
        sql = `UPDATE ${c.table} SET ${c.column} = array_replace(${c.column}, ${q(m.id)}::uuid, ${q(plan.canonicalId)}::uuid) WHERE ${c.column} @> ARRAY[${q(m.id)}::uuid];`;
      } else if (c.uniqueWith?.length) {
        const same = c.uniqueWith.map(k => `x.${k} IS NOT DISTINCT FROM t.${k}`).join(' AND ');
        sql = `UPDATE ${c.table} t SET ${c.column} = ${q(plan.canonicalId)} WHERE t.${c.column} = ${q(m.id)} AND NOT EXISTS (SELECT 1 FROM ${c.table} x WHERE x.${c.column} = ${q(plan.canonicalId)} AND ${same});`;
      } else {
        sql = `UPDATE ${c.table} SET ${c.column} = ${q(plan.canonicalId)} WHERE ${c.column} = ${q(m.id)};`;
      }
      out.push({ table: c.table, column: c.column, kind: c.kind, mergedId: m.id, canonicalId: plan.canonicalId, sql, uniqueWith: c.uniqueWith });
    }
  }
  const aliases = plan.aliasUnion.map(a => `'${a.replace(/'/g, "''")}'`).join(', ');
  out.push({
    table: 'companies',
    column: 'name_variations',
    kind: 'uuid',
    mergedId: plan.canonicalId,
    canonicalId: plan.canonicalId,
    sql: `UPDATE companies SET name_variations = ARRAY[${aliases}]::text[] WHERE id = ${q(plan.canonicalId)};`,
    uniqueWith: null,
  });
  for (const m of plan.merged) {
    out.push({
      table: 'companies',
      column: 'merged_into',
      kind: 'uuid',
      mergedId: m.id,
      canonicalId: plan.canonicalId,
      sql: `UPDATE companies SET merged_into = ${q(plan.canonicalId)}, merged_at = now() WHERE id = ${q(m.id)} AND merged_into IS NULL;`,
      uniqueWith: null,
    });
  }
  return out;
}
