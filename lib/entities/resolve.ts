/**
 * Shared entity graph — resolvers.
 *
 * Match order for every kind: id → exact normalised name → alias table
 * (companies.name_variations / drug_aliases) → fuzzy (trigram similarity on
 * normalised names, threshold FUZZY_MATCH_THRESHOLD). Below the threshold the
 * top MAX_CANDIDATES near misses come back as `candidates` and `match` is
 * null; the caller (a person or a review queue) picks, never the resolver.
 *
 * Companies: several near-duplicate rows exist per organisation (legal-form
 * spellings from trial registries next to the enriched partner row). The
 * best-populated row wins (data_quality_score, revenue, deals_last_24mo,
 * classification) and the others' ids are returned in meta.duplicateIds so a
 * merge job can fold them later. Nothing here writes.
 *
 * Deals: the quality filter used everywhere else applies (is_synthetic false,
 * is_canonical not false, verification_status not rejected/flagged), so a
 * resolved deal id is always one the product would show.
 *
 * Every query is bounded (limit ≤ 300) and pulled by an anchor token before
 * scoring locally, so a resolve never scans a table.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FUZZY_MATCH_THRESHOLD,
  MAX_CANDIDATES,
  CANDIDATE_FLOOR,
  anchorToken,
  isUuid,
  normalizeAssetName,
  normalizeCompanyName,
  normalizePartyName,
  orValue,
  rankBySimilarity,
  sameCompanyKey,
  similarity,
} from './normalize';
import type {
  AssetMeta,
  AssetQuery,
  AssetRef,
  CompanyMeta,
  CompanyQuery,
  CompanyRef,
  DealMeta,
  DealQuery,
  DealRef,
  EntityCandidate,
  EntityRef,
  ResolveItem,
  ResolveResult,
} from './types';
import { RESOLVE_BATCH_MAX } from './types';

// Confidence assigned per match route (fuzzy carries its similarity score).
const CONFIDENCE_ID = 1;
const CONFIDENCE_EXACT = 0.98;
const CONFIDENCE_ALIAS = 0.95;

/** Candidate pool size pulled from the database before local scoring. */
const POOL_LIMIT = 300;
/** Deals: how far from announced_date a row still counts (days). */
export const DEAL_DATE_WINDOW_DAYS = 45;

// Loose client type so tests can pass a chainable stub without the full
// supabase-js generic surface. Callers pass a real SupabaseClient.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EntityClient = SupabaseClient<any, any, any> | { from: (table: string) => any };

// ─── Company ────────────────────────────────────────────────────────────────

export interface CompanyRow {
  id: string;
  name: string;
  name_variations: string[] | null;
  company_type: string | null;
  owner_type: string | null;
  hq_country: string | null;
  hq_region: string | null;
  ticker: string | null;
  cik: string | null;
  sec_cik: string | null;
  website_url: string | null;
  data_quality_score: number | null;
  total_annual_revenue: number | null;
  deals_last_24mo: number | null;
}

export const COMPANY_COLS =
  'id,name,name_variations,company_type,owner_type,hq_country,hq_region,ticker,cik,sec_cik,website_url,data_quality_score,total_annual_revenue,deals_last_24mo';

/**
 * How populated a companies row is; the highest wins among duplicates.
 * Mirrors the buyer-map rule (quality score + revenue + recent deals) and
 * adds a small bonus for a classified row so an enriched partner profile
 * beats a bare registry sponsor row with the same name.
 */
export function companyPopulationScore(r: Pick<CompanyRow, 'data_quality_score' | 'total_annual_revenue' | 'deals_last_24mo' | 'company_type' | 'ticker' | 'cik' | 'sec_cik' | 'name_variations'>): number {
  return (
    (r.data_quality_score ?? 0) +
    (r.total_annual_revenue ? 50 : 0) +
    (r.deals_last_24mo ?? 0) +
    (r.company_type ? 10 : 0) +
    (r.ticker || r.cik || r.sec_cik ? 5 : 0) +
    Math.min(5, (r.name_variations ?? []).length)
  );
}

/** Pick the best-populated row; the rest are duplicates. Pure; exported for tests. */
export function pickBestCompany<T extends CompanyRow>(rows: readonly T[]): { best: T; duplicates: T[] } | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => companyPopulationScore(b) - companyPopulationScore(a) || a.id.localeCompare(b.id));
  return { best: sorted[0], duplicates: sorted.slice(1) };
}

function companyAliases(rows: readonly CompanyRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const n = (r.name ?? '').trim();
    if (n) set.add(n);
    for (const v of r.name_variations ?? []) {
      const t = (v ?? '').trim();
      if (t) set.add(t);
    }
  }
  return [...set];
}

function companyRef(best: CompanyRow, duplicates: readonly CompanyRow[], matchedOn: EntityRef['matchedOn'], confidence: number): CompanyRef {
  const meta: CompanyMeta = {
    companyType: best.company_type ?? null,
    ownerType: best.owner_type ?? null,
    hqCountry: best.hq_country ?? null,
    hqRegion: best.hq_region ?? null,
    ticker: best.ticker ?? null,
    cik: best.cik ?? best.sec_cik ?? null,
    dataQualityScore: best.data_quality_score ?? null,
    duplicateIds: duplicates.map(d => d.id),
  };
  return {
    kind: 'company',
    id: best.id,
    canonicalName: best.name,
    confidence: round3(confidence),
    matchedOn,
    aliases: companyAliases([best, ...duplicates]),
    meta,
  };
}

function companyCandidate(r: CompanyRow, score: number): EntityCandidate {
  return { kind: 'company', id: r.id, canonicalName: r.name, score: round3(score) };
}

/** Rows whose normalised name equals `key` (spacing ignored), from a pool. */
function sameNameRows(pool: readonly CompanyRow[], key: string): CompanyRow[] {
  return pool.filter(r => sameCompanyKey(normalizeCompanyName(r.name), key));
}

/**
 * Pull a bounded pool of company rows that could match `key`: name contains
 * the anchor token, or name_variations contains the raw spelling.
 */
async function fetchCompanyPool(supabase: EntityClient, raw: string, key: string): Promise<CompanyRow[]> {
  const filters: string[] = [];
  const anchor = anchorToken(key);
  if (anchor) filters.push(`name.ilike.${orValue(`%${escapeLike(anchor)}%`)}`);
  const trimmed = raw.trim();
  if (trimmed) filters.push(`name_variations.cs.{${orValue(trimmed)}}`);
  if (!filters.length) return [];
  const rows = await runCompanyPool(supabase, filters);
  if (rows.length || anchor.length < 5) return rows;
  // A typo inside the anchor token ("Pfizzer", "Kyowa Kirinn") leaves the pool
  // empty; widen to the anchor's 4-character stem anywhere in the name plus the
  // first token as a prefix, so the fuzzy stage still has something to score.
  const first = key.split(' ')[0] ?? '';
  const widened = [`name.ilike.${orValue(`%${escapeLike(anchor.slice(0, 4))}%`)}`];
  if (first.length >= 4) widened.push(`name.ilike.${orValue(`${escapeLike(first.slice(0, 4))}%`)}`);
  return runCompanyPool(supabase, widened);
}

async function runCompanyPool(supabase: EntityClient, filters: string[]): Promise<CompanyRow[]> {
  const { data, error } = await supabase
    .from('companies')
    .select(COMPANY_COLS)
    .or(filters.join(','))
    .order('data_quality_score', { ascending: false, nullsFirst: false })
    .limit(POOL_LIMIT);
  if (error) throw new Error(`companies pool lookup failed: ${error.message}`);
  return (data ?? []) as CompanyRow[];
}

async function fetchCompaniesWhere(supabase: EntityClient, column: string, value: string): Promise<CompanyRow[]> {
  const { data, error } = await supabase.from('companies').select(COMPANY_COLS).eq(column, value).limit(50);
  if (error) throw new Error(`companies ${column} lookup failed: ${error.message}`);
  return (data ?? []) as CompanyRow[];
}

/** Duplicates of a row already in hand (by-id / ticker / cik routes). */
async function duplicatesOf(supabase: EntityClient, row: CompanyRow): Promise<CompanyRow[]> {
  const key = normalizeCompanyName(row.name);
  if (!key) return [];
  const pool = await fetchCompanyPool(supabase, row.name, key);
  return sameNameRows(pool, key).filter(r => r.id !== row.id);
}

export async function resolveCompany(supabase: EntityClient, q: CompanyQuery): Promise<ResolveResult<CompanyMeta>> {
  // 1. id
  if (q.id) {
    if (!isUuid(q.id)) return { match: null, candidates: [] };
    const { data, error } = await supabase.from('companies').select(COMPANY_COLS).eq('id', q.id).maybeSingle();
    if (error) throw new Error(`companies id lookup failed: ${error.message}`);
    if (!data) return { match: null, candidates: [] };
    const row = data as CompanyRow;
    const dups = await duplicatesOf(supabase, row);
    return { match: companyRef(row, dups, 'id', CONFIDENCE_ID), candidates: [] };
  }

  // 2. ticker / cik — structured ids stored on the row.
  if (q.ticker?.trim()) {
    const rows = await fetchCompaniesWhere(supabase, 'ticker', q.ticker.trim().toUpperCase());
    const picked = pickBestCompany(rows);
    if (picked) {
      const extra = (await duplicatesOf(supabase, picked.best)).filter(d => !rows.some(r => r.id === d.id));
      return { match: companyRef(picked.best, [...picked.duplicates, ...extra], 'id', CONFIDENCE_ID), candidates: [] };
    }
  }
  if (q.cik?.trim()) {
    const digits = q.cik.replace(/\D/g, '');
    if (digits) {
      const forms = [...new Set([digits.replace(/^0+/, '') || '0', digits.padStart(10, '0')])];
      const ors = forms.flatMap(f => [`cik.eq.${orValue(f)}`, `sec_cik.eq.${orValue(f)}`]);
      const { data, error } = await supabase.from('companies').select(COMPANY_COLS).or(ors.join(',')).limit(50);
      if (error) throw new Error(`companies cik lookup failed: ${error.message}`);
      const rows = (data ?? []) as CompanyRow[];
      const picked = pickBestCompany(rows);
      if (picked) {
        const extra = (await duplicatesOf(supabase, picked.best)).filter(d => !rows.some(r => r.id === d.id));
        return { match: companyRef(picked.best, [...picked.duplicates, ...extra], 'id', CONFIDENCE_ID), candidates: [] };
      }
    }
  }

  // 3. name: exact → alias → fuzzy, all scored over one bounded pool.
  const raw = (q.name ?? '').trim();
  const key = normalizeCompanyName(raw);
  if (!key) return { match: null, candidates: [] };
  const pool = await fetchCompanyPool(supabase, raw, key);
  if (!pool.length) return { match: null, candidates: [] };

  const exact = sameNameRows(pool, key);
  if (exact.length) {
    const picked = pickBestCompany(exact)!;
    return { match: companyRef(picked.best, picked.duplicates, 'exact', CONFIDENCE_EXACT), candidates: [] };
  }

  const viaAlias = pool.filter(r => (r.name_variations ?? []).some(v => sameCompanyKey(normalizeCompanyName(v), key)));
  if (viaAlias.length) {
    const picked = pickBestCompany(viaAlias)!;
    // Rows sharing the winner's own name are duplicates too.
    const more = sameNameRows(pool, normalizeCompanyName(picked.best.name)).filter(r => r.id !== picked.best.id && !picked.duplicates.some(d => d.id === r.id));
    return { match: companyRef(picked.best, [...picked.duplicates, ...more], 'alias', CONFIDENCE_ALIAS), candidates: [] };
  }

  const ranked = rankBySimilarity(key, pool, r => [normalizeCompanyName(r.name), ...(r.name_variations ?? []).map(normalizeCompanyName)]);
  if (ranked.best) {
    const winnerKey = normalizeCompanyName(ranked.best.item.name);
    const group = sameNameRows(pool, winnerKey);
    const picked = pickBestCompany(group.length ? group : [ranked.best.item])!;
    const candidates = ranked.candidates
      .filter(c => normalizeCompanyName(c.item.name) !== winnerKey)
      .slice(0, MAX_CANDIDATES)
      .map(c => companyCandidate(c.item, c.score));
    return { match: companyRef(picked.best, picked.duplicates, 'fuzzy', ranked.best.score), candidates };
  }
  return { match: null, candidates: dedupeCandidates(ranked.candidates.map(c => companyCandidate(c.item, c.score))) };
}

// ─── Asset ──────────────────────────────────────────────────────────────────

export interface DrugRow {
  id: string;
  preferred_name: string;
  inn: string | null;
  unii: string | null;
  chembl_id: string | null;
  modality: string | null;
  target: string | null;
  max_phase: string | null;
  is_combination: boolean | null;
  originator_company_id: string | null;
  source: string | null;
  confidence: number | null;
}

export const DRUG_COLS = 'id,preferred_name,inn,unii,chembl_id,modality,target,max_phase,is_combination,originator_company_id,source,confidence';

interface AliasRow {
  drug_id: string;
  alias: string;
  alias_normalized: string;
  alias_type: string | null;
}

function assetRef(row: DrugRow, aliases: string[], matchedOn: EntityRef['matchedOn'], confidence: number): AssetRef {
  const meta: AssetMeta = {
    inn: row.inn ?? null,
    unii: row.unii ?? null,
    chemblId: row.chembl_id ?? null,
    modality: row.modality ?? null,
    target: row.target ?? null,
    maxPhase: row.max_phase ?? null,
    originatorCompanyId: row.originator_company_id ?? null,
    isCombination: !!row.is_combination,
    sourceConfidence: row.confidence ?? null,
  };
  const set = new Set<string>();
  if (row.preferred_name) set.add(row.preferred_name);
  if (row.inn) set.add(row.inn);
  for (const a of aliases) if (a) set.add(a);
  return { kind: 'asset', id: row.id, canonicalName: row.preferred_name, confidence: round3(confidence), matchedOn, aliases: [...set], meta };
}

/** Prefer externally-resolved rows (chembl/gsrs/pubchem) over internal placeholders, then confidence. */
function drugRank(r: DrugRow): number {
  return (r.source && r.source !== 'internal' ? 100 : 0) + (r.confidence ?? 0);
}

async function fetchDrugs(supabase: EntityClient, ids: string[]): Promise<DrugRow[]> {
  const uniq = [...new Set(ids)].slice(0, 100);
  if (!uniq.length) return [];
  const { data, error } = await supabase.from('drug_master').select(DRUG_COLS).in('id', uniq);
  if (error) throw new Error(`drug_master lookup failed: ${error.message}`);
  return (data ?? []) as DrugRow[];
}

async function fetchAliasesFor(supabase: EntityClient, drugId: string): Promise<string[]> {
  const { data, error } = await supabase.from('drug_aliases').select('alias').eq('drug_id', drugId).limit(60);
  if (error) throw new Error(`drug_aliases lookup failed: ${error.message}`);
  return ((data ?? []) as Array<{ alias: string }>).map(a => a.alias).filter(Boolean);
}

async function assetById(supabase: EntityClient, id: string, matchedOn: EntityRef['matchedOn'], confidence: number): Promise<ResolveResult<AssetMeta>> {
  const { data, error } = await supabase.from('drug_master').select(DRUG_COLS).eq('id', id).maybeSingle();
  if (error) throw new Error(`drug_master id lookup failed: ${error.message}`);
  if (!data) return { match: null, candidates: [] };
  const row = data as DrugRow;
  return { match: assetRef(row, await fetchAliasesFor(supabase, row.id), matchedOn, confidence), candidates: [] };
}

async function assetWhere(supabase: EntityClient, column: string, value: string, caseInsensitive = false): Promise<DrugRow[]> {
  let qb = supabase.from('drug_master').select(DRUG_COLS);
  qb = caseInsensitive ? qb.ilike(column, escapeLike(value)) : qb.eq(column, value);
  const { data, error } = await qb.limit(20);
  if (error) throw new Error(`drug_master ${column} lookup failed: ${error.message}`);
  return (data ?? []) as DrugRow[];
}

function assetCandidate(r: DrugRow, score: number): EntityCandidate {
  return { kind: 'asset', id: r.id, canonicalName: r.preferred_name, score: round3(score) };
}

async function pickAsset(supabase: EntityClient, rows: DrugRow[], matchedOn: EntityRef['matchedOn'], confidence: number): Promise<ResolveResult<AssetMeta>> {
  const sorted = [...rows].sort((a, b) => drugRank(b) - drugRank(a) || a.id.localeCompare(b.id));
  const best = sorted[0];
  const aliases = await fetchAliasesFor(supabase, best.id);
  // Other rows hit by the same key are surfaced as candidates so an operator can see the ambiguity.
  const candidates = sorted.slice(1, 1 + MAX_CANDIDATES).map(r => assetCandidate(r, confidence));
  return { match: assetRef(best, aliases, matchedOn, confidence), candidates };
}

export async function resolveAsset(supabase: EntityClient, q: AssetQuery): Promise<ResolveResult<AssetMeta>> {
  // 1. id
  if (q.id) {
    if (!isUuid(q.id)) return { match: null, candidates: [] };
    return assetById(supabase, q.id, 'id', CONFIDENCE_ID);
  }
  // 2. structured external ids
  if (q.unii?.trim()) {
    const rows = await assetWhere(supabase, 'unii', q.unii.trim().toUpperCase());
    if (rows.length) return pickAsset(supabase, rows, 'id', CONFIDENCE_ID);
  }
  if (q.chembl_id?.trim()) {
    const rows = await assetWhere(supabase, 'chembl_id', q.chembl_id.trim().toUpperCase());
    if (rows.length) return pickAsset(supabase, rows, 'id', CONFIDENCE_ID);
  }
  // 3. exact: INN column, then preferred_name (case-insensitive, no wildcards)
  const inn = (q.inn ?? '').trim();
  if (inn) {
    const rows = await assetWhere(supabase, 'inn', inn, true);
    if (rows.length) return pickAsset(supabase, rows, 'exact', CONFIDENCE_EXACT);
  }
  const raw = (q.name ?? inn).trim();
  const key = normalizeAssetName(raw);
  if (!key) return { match: null, candidates: [] };
  if (raw) {
    const rows = await assetWhere(supabase, 'preferred_name', raw, true);
    if (rows.length) return pickAsset(supabase, rows, 'exact', CONFIDENCE_EXACT);
  }
  // 4. alias table (exact normalised key)
  {
    const { data, error } = await supabase.from('drug_aliases').select('drug_id,alias,alias_normalized,alias_type').eq('alias_normalized', key).limit(50);
    if (error) throw new Error(`drug_aliases lookup failed: ${error.message}`);
    const hits = (data ?? []) as AliasRow[];
    if (hits.length) {
      const rows = await fetchDrugs(supabase, hits.map(h => h.drug_id));
      if (rows.length) return pickAsset(supabase, rows, 'alias', CONFIDENCE_ALIAS);
    }
  }
  // 5. fuzzy over aliases sharing the first four characters (bounded pool).
  // Code names (ABC-123) are never fuzzy-matched: one digit apart is a different drug.
  if (key.length < 6 || /\d/.test(key)) return { match: null, candidates: [] };
  const { data, error } = await supabase
    .from('drug_aliases')
    .select('drug_id,alias,alias_normalized,alias_type')
    .like('alias_normalized', `${escapeLike(key.slice(0, 4))}%`)
    .limit(POOL_LIMIT);
  if (error) throw new Error(`drug_aliases fuzzy lookup failed: ${error.message}`);
  const pool = (data ?? []) as AliasRow[];
  const byDrug = new Map<string, AliasRow[]>();
  for (const a of pool) {
    if (/\d/.test(a.alias_normalized)) continue;
    const arr = byDrug.get(a.drug_id) ?? [];
    arr.push(a);
    byDrug.set(a.drug_id, arr);
  }
  const ranked = rankBySimilarity(key, [...byDrug.entries()], ([, rows]) => rows.map(r => r.alias_normalized));
  if (!ranked.best && !ranked.candidates.length) return { match: null, candidates: [] };
  const ids = [ranked.best?.item[0], ...ranked.candidates.map(c => c.item[0])].filter((x): x is string => !!x);
  const rows = await fetchDrugs(supabase, ids);
  const rowOf = (id: string) => rows.find(r => r.id === id);
  const candidates = ranked.candidates.map(c => ({ row: rowOf(c.item[0]), score: c.score })).filter(c => c.row).map(c => assetCandidate(c.row!, c.score));
  if (ranked.best) {
    const best = rowOf(ranked.best.item[0]);
    if (best) return { match: assetRef(best, ranked.best.item[1].map(a => a.alias), 'fuzzy', ranked.best.score), candidates };
  }
  return { match: null, candidates };
}

// ─── Deal ───────────────────────────────────────────────────────────────────

export interface DealRow {
  id: string;
  licensor_name: string | null;
  licensor_id: string | null;
  licensee_name: string | null;
  licensee_id: string | null;
  asset_name: string | null;
  announced_date: string | null;
  deal_type: string | null;
  phase_at_signing: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
}

export const DEAL_COLS = 'id,licensor_name,licensor_id,licensee_name,licensee_id,asset_name,announced_date,deal_type,phase_at_signing,upfront_usd,total_deal_value_usd';

/** The quality filter every product surface applies to deals. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyDealQualityFilter<T extends { eq: (...a: any[]) => T; not: (...a: any[]) => T }>(qb: T): T {
  return qb.eq('is_synthetic', false).not('is_canonical', 'is', false).not('verification_status', 'in', '("rejected","flagged")');
}

export function usdToM(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.round((v / 1e6) * 1000) / 1000;
}

function dealRef(row: DealRow, matchedOn: EntityRef['matchedOn'], confidence: number): DealRef {
  const meta: DealMeta = {
    licensorId: row.licensor_id ?? null,
    licensorName: row.licensor_name ?? null,
    licenseeId: row.licensee_id ?? null,
    licenseeName: row.licensee_name ?? null,
    assetName: row.asset_name ?? null,
    announcedDate: row.announced_date ?? null,
    dealType: row.deal_type ?? null,
    phaseAtSigning: row.phase_at_signing ?? null,
    upfrontM: usdToM(row.upfront_usd),
    totalM: usdToM(row.total_deal_value_usd),
  };
  return { kind: 'deal', id: row.id, canonicalName: dealLabel(row), confidence: round3(confidence), matchedOn, aliases: [], meta };
}

export function dealLabel(row: Pick<DealRow, 'licensor_name' | 'licensee_name' | 'asset_name' | 'announced_date'>): string {
  const parties = [row.licensor_name, row.licensee_name].filter(Boolean).join(' → ');
  const asset = row.asset_name ? ` (${row.asset_name})` : '';
  const yr = row.announced_date ? ` ${row.announced_date.slice(0, 4)}` : '';
  return `${parties}${asset}${yr}`.trim();
}

function daysBetween(a: string, b: string): number | null {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.abs(ta - tb) / 86_400_000;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Score a deal row against the party names / date supplied. Pure; exported
 * for tests. Returns { score, exact } where exact means every supplied
 * party is an exact normalised match and the date (if supplied) is the same day.
 */
export function scoreDealRow(row: DealRow, q: DealQuery): { score: number; exact: boolean } {
  const parts: number[] = [];
  let exact = true;
  const cmp = (query: string | undefined, value: string | null) => {
    if (!query) return;
    const a = normalizePartyName(query);
    const b = normalizePartyName(value);
    const s = a && b ? similarity(a, b) : 0;
    if (s < 1) exact = false;
    parts.push(s);
  };
  cmp(q.licensor, row.licensor_name);
  cmp(q.licensee, row.licensee_name);
  // Either party may have been supplied on the wrong side (buyer/seller swapped).
  if (q.licensor && q.licensee && parts.length === 2 && Math.min(parts[0], parts[1]) < FUZZY_MATCH_THRESHOLD) {
    const swapped = [
      similarity(normalizePartyName(q.licensor), normalizePartyName(row.licensee_name)),
      similarity(normalizePartyName(q.licensee), normalizePartyName(row.licensor_name)),
    ];
    if (Math.min(...swapped) > Math.min(parts[0], parts[1])) {
      parts[0] = swapped[0];
      parts[1] = swapped[1];
      exact = false;
    }
  }
  if (!parts.length) return { score: 0, exact: false };
  const nameScore = Math.min(...parts);
  if (!q.announced_date) return { score: nameScore, exact };
  const days = row.announced_date ? daysBetween(q.announced_date, row.announced_date) : null;
  if (days == null) return { score: nameScore * 0.7, exact: false };
  if (days > 0) exact = false;
  const dateScore = Math.max(0, 1 - days / DEAL_DATE_WINDOW_DAYS);
  return { score: nameScore * 0.7 + dateScore * 0.3, exact };
}

export async function resolveDeal(supabase: EntityClient, q: DealQuery): Promise<ResolveResult<DealMeta>> {
  if (q.id) {
    if (!isUuid(q.id)) return { match: null, candidates: [] };
    const { data, error } = await applyDealQualityFilter(supabase.from('deals').select(DEAL_COLS).eq('id', q.id)).maybeSingle();
    if (error) throw new Error(`deals id lookup failed: ${error.message}`);
    return data ? { match: dealRef(data as DealRow, 'id', CONFIDENCE_ID), candidates: [] } : { match: null, candidates: [] };
  }
  const licensor = (q.licensor ?? '').trim();
  const licensee = (q.licensee ?? '').trim();
  if (!licensor && !licensee) return { match: null, candidates: [] };

  const ors: string[] = [];
  for (const party of [licensor, licensee]) {
    if (!party) continue;
    const anchor = anchorToken(normalizePartyName(party));
    if (!anchor) continue;
    const pat = orValue(`%${escapeLike(anchor)}%`);
    ors.push(`licensor_name.ilike.${pat}`, `licensee_name.ilike.${pat}`);
  }
  if (!ors.length) return { match: null, candidates: [] };

  let qb = applyDealQualityFilter(supabase.from('deals').select(DEAL_COLS)).or(ors.join(','));
  if (q.announced_date && Number.isFinite(Date.parse(q.announced_date))) {
    qb = qb.gte('announced_date', addDays(q.announced_date, -DEAL_DATE_WINDOW_DAYS)).lte('announced_date', addDays(q.announced_date, DEAL_DATE_WINDOW_DAYS));
  }
  const { data, error } = await qb.order('announced_date', { ascending: false, nullsFirst: false }).limit(POOL_LIMIT);
  if (error) throw new Error(`deals lookup failed: ${error.message}`);
  const rows = (data ?? []) as DealRow[];
  if (!rows.length) return { match: null, candidates: [] };

  const scored = rows.map(row => ({ row, ...scoreDealRow(row, q) })).filter(s => s.score >= CANDIDATE_FLOOR).sort((a, b) => b.score - a.score);
  if (!scored.length) return { match: null, candidates: [] };
  const top = scored[0];
  const toCandidate = (s: { row: DealRow; score: number }): EntityCandidate => ({ kind: 'deal', id: s.row.id, canonicalName: dealLabel(s.row), score: round3(s.score) });
  // A second row scoring (near-)equally is ambiguous — one party name alone,
  // or two deals between the same parties — so candidates come back, not a match.
  const runnerUp = scored[1];
  const ambiguous = !!runnerUp && Math.abs(runnerUp.score - top.score) < 0.02;
  if (!ambiguous && top.exact) {
    return { match: dealRef(top.row, 'exact', CONFIDENCE_EXACT), candidates: scored.slice(1, 1 + MAX_CANDIDATES).map(toCandidate) };
  }
  if (!ambiguous && top.score >= FUZZY_MATCH_THRESHOLD) {
    return { match: dealRef(top.row, 'fuzzy', top.score), candidates: scored.slice(1, 1 + MAX_CANDIDATES).map(toCandidate) };
  }
  return { match: null, candidates: scored.slice(0, MAX_CANDIDATES).map(toCandidate) };
}

// ─── Batch ──────────────────────────────────────────────────────────────────

const BATCH_CONCURRENCY = 8;

export async function resolveOne(supabase: EntityClient, item: ResolveItem): Promise<ResolveResult> {
  switch (item.kind) {
    case 'company':
      return resolveCompany(supabase, item);
    case 'asset':
      return resolveAsset(supabase, item);
    case 'deal':
      return resolveDeal(supabase, item);
    default:
      return { match: null, candidates: [] };
  }
}

/**
 * Resolve up to RESOLVE_BATCH_MAX items, results in input order. Throws on a
 * larger batch (the route turns that into a 400). One failing item does not
 * fail the batch: it resolves to null with no candidates.
 */
export async function resolveBatch(supabase: EntityClient, items: ResolveItem[]): Promise<ResolveResult[]> {
  if (!Array.isArray(items)) throw new Error('items must be an array');
  if (items.length > RESOLVE_BATCH_MAX) throw new Error(`Batch too large: ${items.length} > ${RESOLVE_BATCH_MAX}`);
  const out: ResolveResult[] = new Array(items.length);
  for (let i = 0; i < items.length; i += BATCH_CONCURRENCY) {
    const slice = items.slice(i, i + BATCH_CONCURRENCY);
    const settled = await Promise.allSettled(slice.map(item => resolveOne(supabase, item)));
    settled.forEach((s, j) => {
      out[i + j] = s.status === 'fulfilled' ? s.value : { match: null, candidates: [] };
    });
  }
  return out;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Escape LIKE/ILIKE wildcards in a literal. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, m => `\\${m}`);
}

function dedupeCandidates(cs: EntityCandidate[]): EntityCandidate[] {
  const seen = new Set<string>();
  const out: EntityCandidate[] = [];
  for (const c of cs) {
    const k = normalizeCompanyName(c.canonicalName);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}
