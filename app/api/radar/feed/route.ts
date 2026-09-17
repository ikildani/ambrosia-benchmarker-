/**
 * Asset Radar — ranked feed.
 *
 * GET /api/radar/feed?ta=oncology&ta=neurology&mod=adc&ph=phase_2&ps=unpartnered
 *     &cc=US&rg=europe&ot=industry&ts=recruiting&ind=nsclc&tgt=HER2&sb=60-79
 *     &pmin=phase_1&pmax=phase_3&min=40&q=her2
 *     &sort=score&dir=desc&after=<cursor>&limit=50
 * GET /api/radar/feed?...&count=only      → { estimated_total }
 *
 * Parameter names and validation come from lib/radar/client/filter-schema.ts
 * (the same codec the client uses for the URL), so anything that is not a
 * known vocabulary value is dropped before it reaches PostgREST.
 *
 * Paging is keyset on (sort column, id): `after` is the last row's
 * (value, id) pair, base64url-encoded. Counts are planner estimates and are
 * only requested on the first page. Three queries per page: the rows, the
 * 30-day score snapshots for those rows, and the next primary completion
 * date for their trials. One HEAD query for count-only calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { ASSET_LIST_COLUMNS, type ClinicalAssetRow, type OwnerType } from '@/lib/radar/types';
import {
  parseFilters,
  resolvePhaseList,
  SORT_COLUMNS,
  SORT_KEYS,
  FEED_PAGE_SIZE,
  FEED_MAX_PAGE_SIZE,
  isUuidLike,
  RADAR_SCORE_BAND_OPTIONS,
  type RadarFilterState,
  type SortKey,
  type SortDir,
} from '@/lib/radar/client/filter-schema';
import type { FeedRow, FeedResponse, FeedCountResponse } from '@/lib/radar/client/api-types';

export const dynamic = 'force-dynamic';

// ── Cursor codec ──────────────────────────────────────────────────────────

type CursorValue = number | string | null;

function encodeCursor(value: CursorValue, id: string): string {
  return Buffer.from(JSON.stringify([value, id]), 'utf8').toString('base64url');
}

function decodeCursor(raw: string | null, kind: 'number' | 'text'): { value: CursorValue; id: string } | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [value, id] = parsed as [unknown, unknown];
    if (typeof id !== 'string' || !isUuidLike(id)) return null;
    if (value === null) return { value: null, id };
    if (kind === 'number') {
      return typeof value === 'number' && Number.isFinite(value) ? { value, id } : null;
    }
    return typeof value === 'string' && value.length <= 300 ? { value, id } : null;
  } catch {
    return null;
  }
}

/** Double-quotes a value for use inside a PostgREST `.or()` expression. */
function pgQuote(v: CursorValue): string {
  if (v === null) return 'null';
  if (typeof v === 'number') return String(v);
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// ── Row shaping ───────────────────────────────────────────────────────────

type SelectedRow = Pick<ClinicalAssetRow, keyof Omit<FeedRow, 'owner_type' | 'score_delta_30d' | 'score_spark' | 'next_catalyst_date'>> & {
  companies: { owner_type: string | null } | { owner_type: string | null }[] | null;
};

const OWNER_TYPES: OwnerType[] = ['industry', 'academic', 'government', 'hospital', 'network', 'cro', 'other', 'unknown'];

function ownerTypeOf(row: SelectedRow): OwnerType {
  const c = Array.isArray(row.companies) ? row.companies[0] : row.companies;
  const v = c?.owner_type;
  return v && (OWNER_TYPES as string[]).includes(v) ? (v as OwnerType) : 'unknown';
}

function downsample(values: number[], max: number): number[] {
  if (values.length <= max) return values;
  const out: number[] = [];
  for (let i = 0; i < max; i++) {
    out.push(values[Math.round((i * (values.length - 1)) / (max - 1))]);
  }
  return out;
}

// ── Query building ────────────────────────────────────────────────────────

const SELECT = `${ASSET_LIST_COLUMNS}, companies(owner_type)`;
const SELECT_WITH_OWNER_FILTER = `${ASSET_LIST_COLUMNS}, companies!inner(owner_type)`;

function scoreBandRange(bands: string[]): { min: number; max: number | null }[] {
  return bands
    .filter(b => RADAR_SCORE_BAND_OPTIONS.some(o => o.value === b))
    .map(b => {
      if (b === '80+') return { min: 80, max: null };
      const [lo, hi] = b.split('-').map(Number);
      return { min: lo, max: hi };
    });
}

/** Filter builder for a dynamic select string on the untyped service client. */
type Builder = ReturnType<ReturnType<SupabaseClient['from']>['select']>;

function applyFilters(query: Builder, f: RadarFilterState): Builder {
  let q = query;
  if (f.ta.length) q = q.in('therapeutic_area', f.ta);
  if (f.modality.length) q = q.in('modality', f.modality);
  if (f.partnership.length) q = q.in('partnership_status', f.partnership);
  if (f.country.length) q = q.in('originator_country', f.country);
  if (f.region.length) q = q.in('originator_region', f.region);
  if (f.trial_status.length) q = q.in('trial_status', f.trial_status);
  if (f.indication.length) q = q.in('indication_category', f.indication);
  if (f.target.length) q = q.in('target', f.target);
  if (f.owner_type.length) q = q.in('companies.owner_type', f.owner_type);
  const phases = resolvePhaseList(f);
  if (phases) q = q.in('phase', phases);
  if (f.min_score !== null) q = q.gte('licensing_intent_score', f.min_score);
  if (f.score_band.length) {
    const ranges = scoreBandRange(f.score_band);
    if (ranges.length) {
      const clauses = ranges.map(r =>
        r.max === null
          ? `licensing_intent_score.gte.${r.min}`
          : `and(licensing_intent_score.gte.${r.min},licensing_intent_score.lte.${r.max})`,
      );
      q = q.or(clauses.join(','));
    }
  }
  if (f.q) {
    // cleanQuery() already removed , ( ) % and backslashes, so the term cannot alter the expression.
    const term = `%${f.q}%`;
    q = q.or(`asset_name.ilike.${term},company_name.ilike.${term},target.ilike.${term},indication_specific.ilike.${term}`);
  }
  return q;
}

function applyCursor(query: Builder, column: string, dir: SortDir, cursor: { value: CursorValue; id: string }): Builder {
  const cmp = dir === 'desc' ? 'lt' : 'gt';
  if (cursor.value === null) {
    // Nulls sort last in both directions; once inside the null block only the id advances.
    const inNulls = query.is(column, null);
    return cmp === 'lt' ? inNulls.lt('id', cursor.id) : inNulls.gt('id', cursor.id);
  }
  const v = pgQuote(cursor.value);
  return query.or(`${column}.${cmp}.${v},and(${column}.eq.${v},id.${cmp}.${cursor.id}),${column}.is.null`);
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const filters = parseFilters(searchParams);

  const sortRaw = searchParams.get('sort');
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(sortRaw ?? '') ? (sortRaw as SortKey) : 'score';
  const dirRaw = searchParams.get('dir');
  const dir: SortDir = dirRaw === 'asc' || dirRaw === 'desc' ? dirRaw : SORT_COLUMNS[sort].defaultDir;
  const { column, kind } = SORT_COLUMNS[sort];

  const limitRaw = parseInt(searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(FEED_MAX_PAGE_SIZE, Math.max(1, limitRaw)) : FEED_PAGE_SIZE;
  const countOnly = searchParams.get('count') === 'only';

  const afterRaw = searchParams.get('after');
  const cursor = decodeCursor(afterRaw, kind);
  if (afterRaw && !cursor) {
    return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const select = filters.owner_type.length ? SELECT_WITH_OWNER_FILTER : SELECT;

  // Count-only: one HEAD request with a planner estimate. Used by the live
  // match counter on the mandate form, so it must never do an exact count.
  if (countOnly) {
    const { count, error } = await applyFilters(
      supabase.from('clinical_assets').select(select, { count: 'estimated', head: true }),
      filters,
    );
    if (error) {
      console.error('[radar/feed] count error:', error.message);
      return NextResponse.json({ error: 'Failed to count assets' }, { status: 500 });
    }
    const body: FeedCountResponse = { estimated_total: count ?? 0 };
    return NextResponse.json(body);
  }

  const wantCount = !cursor;
  let query: Builder = supabase
    .from('clinical_assets')
    .select(select, wantCount ? { count: 'estimated' } : undefined);
  query = applyFilters(query, filters);
  if (cursor) query = applyCursor(query, column, dir, cursor);
  query = query
    .order(column, { ascending: dir === 'asc', nullsFirst: false })
    .order('id', { ascending: dir === 'asc' })
    .range(0, limit); // limit + 1 rows so we know whether a next page exists

  const { data, count, error } = await query;
  if (error) {
    console.error('[radar/feed] query error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }

  const fetched = (data ?? []) as SelectedRow[];
  const hasMore = fetched.length > limit;
  const pageRows = hasMore ? fetched.slice(0, limit) : fetched;
  const ids = pageRows.map(r => r.id);

  // Snapshot trend and next catalyst for this page only (bounded by page size).
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const sinceIso = since.toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);
  const nctIds = Array.from(new Set(pageRows.flatMap(r => (r.nct_ids ?? []).slice(0, 4)))).slice(0, 250);

  const [snapRes, trialRes] = ids.length
    ? await Promise.all([
        supabase
          .from('asset_signal_snapshots')
          .select('asset_id, licensing_intent_score, snapshot_date')
          .in('asset_id', ids)
          .gte('snapshot_date', sinceIso)
          .order('snapshot_date', { ascending: true }),
        nctIds.length
          ? supabase
              .from('company_trials')
              .select('nct_id, primary_completion_date')
              .in('nct_id', nctIds)
              .gte('primary_completion_date', todayIso)
              .not('primary_completion_date', 'is', null)
          : Promise.resolve({ data: [] as { nct_id: string; primary_completion_date: string | null }[], error: null }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (snapRes.error) console.warn('[radar/feed] snapshots unavailable:', snapRes.error.message);
  if (trialRes.error) console.warn('[radar/feed] trial dates unavailable:', trialRes.error.message);

  const sparkByAsset = new Map<string, number[]>();
  for (const s of (snapRes.data ?? []) as { asset_id: string; licensing_intent_score: number | null; snapshot_date: string }[]) {
    if (s.licensing_intent_score === null) continue;
    const arr = sparkByAsset.get(s.asset_id) ?? [];
    arr.push(Number(s.licensing_intent_score));
    sparkByAsset.set(s.asset_id, arr);
  }
  const completionByNct = new Map<string, string>();
  for (const t of (trialRes.data ?? []) as { nct_id: string; primary_completion_date: string | null }[]) {
    if (t.primary_completion_date) completionByNct.set(t.nct_id, t.primary_completion_date);
  }

  const rows: FeedRow[] = pageRows.map(r => {
    const { companies: _companies, ...asset } = r; // eslint-disable-line @typescript-eslint/no-unused-vars
    const current = asset.licensing_intent_score === null ? null : Number(asset.licensing_intent_score);
    const history = sparkByAsset.get(r.id) ?? [];
    const spark = current === null ? history : [...history, current];
    const delta = history.length && current !== null ? Math.round((current - history[0]) * 10) / 10 : null;
    let nextCatalyst: string | null = null;
    for (const nct of (asset.nct_ids ?? []).slice(0, 4)) {
      const d = completionByNct.get(nct);
      if (d && (!nextCatalyst || d < nextCatalyst)) nextCatalyst = d;
    }
    return {
      ...asset,
      licensing_intent_score: current,
      owner_type: ownerTypeOf(r),
      score_delta_30d: delta,
      score_spark: downsample(spark, 10),
      next_catalyst_date: nextCatalyst,
    };
  });

  let nextCursor: string | null = null;
  if (hasMore && pageRows.length) {
    const last = pageRows[pageRows.length - 1] as unknown as Record<string, CursorValue>;
    const v = last[column];
    nextCursor = encodeCursor(v === undefined ? null : v, pageRows[pageRows.length - 1].id);
  }

  const body: FeedResponse = {
    rows,
    next_cursor: nextCursor,
    estimated_total: wantCount ? count ?? null : null,
    limit,
  };
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  });
}
