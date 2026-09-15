/**
 * Catalyst proximity (Asset Radar, Phase 3 Workstream C). Writes
 * `asset_catalysts` (migration 114).
 *
 * Sources
 *   - company_trials: primary_completion_date / completion_date per NCT id on
 *     the asset; status completed / terminated marks the catalyst observed.
 *   - clinical_assets.phase_history: phase transitions when present.
 *   - press_releases: PDUFA dates ("PDUFA" + a date), conference presentations
 *     (category conference + ASCO/ESMO/AACR/ASH/AHA/ADA + a date), readouts
 *     (category clinical + topline/readout language), each matched to the
 *     asset by name or alias with word boundaries.
 *
 * Every row has source, source_url, expected_date and (when passed or
 * announced) observed_date. Upsert key: (asset_id, catalyst_type, nct_key,
 * expected_date) where nct_key = coalesce(nct_id, '') is a stored column.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
import { pgArrayLiteral } from '@/lib/radar/pg-array';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const SYNC_SOURCE = 'catalysts';
const DEFAULT_TIME_BUDGET_MS = 240_000;
const DEFAULT_ASSET_LIMIT = 400;
const PRESS_LOOKBACK_MONTHS = 18;
const OBSERVE_SWEEP_LIMIT = 2000;

export type CatalystType = 'primary_completion' | 'study_completion' | 'phase_transition' | 'pdufa' | 'readout_announced' | 'conference_presentation';

export const CONFERENCE_RE = /\b(ASCO|ESMO|AACR|ASH|AHA|ADA)\b/;
export const PDUFA_RE = /\bPDUFA\b/i;
export const READOUT_RE = /\b(topline|top-line|readout|read-out|primary endpoint|met (?:its|the) primary|data readout|results from|announces? (?:positive |negative )?(?:results|data))\b/i;

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6,
  july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface CatalystAsset {
  id: string;
  company_id: string | null;
  asset_name: string;
  asset_aliases: string[] | null;
  nct_ids: string[] | null;
  lead_nct_id: string | null;
  phase: string | null;
  phase_history: unknown[] | null;
}

export interface CatalystTrial {
  nct_id: string;
  company_id: string | null;
  status: string | null;
  phase: string | null;
  primary_completion_date: string | null;
  completion_date: string | null;
  last_update_posted: string | null;
}

export interface CatalystPress {
  id: string;
  headline: string;
  body_text: string | null;
  published_at: string;
  source_url: string;
  company_ids: string[] | null;
  categories: string[] | null;
}

export interface CatalystRow {
  asset_id: string;
  company_id: string | null;
  catalyst_type: CatalystType;
  expected_date: string;
  observed_date: string | null;
  nct_id: string | null;
  source: string;
  source_url: string;
  confidence: number;
}

export interface CatalystsRunResult {
  assetsProcessed: number;
  trialsFetched: number;
  pressFetched: number;
  catalystsUpserted: number;
  observedMarked: number;
  failed: number;
  errors: string[];
  timedOut: boolean;
  durationMs: number;
  cursor: string | null;
}

// ═══════════════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════════════

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function validIso(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export interface ParsedDate {
  iso: string;
  granularity: 'day' | 'month' | 'quarter' | 'half' | 'year';
}

/**
 * First date-like expression in `text`, searched from `anchorIndex` outward
 * (nearest first). Handles "March 15, 2027", "15 March 2027", "2027-03-15",
 * "March 2027", "Q1 2027" / "first quarter of 2027", "first half of 2027",
 * "mid-2027". Coarser granularities resolve to the period end.
 */
export function parseDateFromText(text: string, anchorIndex = 0): ParsedDate | null {
  const src = text ?? '';
  const candidates: Array<{ index: number; parsed: ParsedDate }> = [];
  const push = (index: number, parsed: ParsedDate | null) => { if (parsed) candidates.push({ index, parsed }); };

  for (const m of src.matchAll(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi)) {
    const iso = validIso(Number(m[3]), MONTHS[m[1].toLowerCase()], Number(m[2]));
    push(m.index ?? 0, iso ? { iso, granularity: 'day' } : null);
  }
  for (const m of src.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\.?,?\s+(\d{4})\b/gi)) {
    const iso = validIso(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1]));
    push(m.index ?? 0, iso ? { iso, granularity: 'day' } : null);
  }
  for (const m of src.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const iso = validIso(Number(m[1]), Number(m[2]), Number(m[3]));
    push(m.index ?? 0, iso ? { iso, granularity: 'day' } : null);
  }
  for (const m of src.matchAll(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/gi)) {
    const y = Number(m[2]);
    const mo = MONTHS[m[1].toLowerCase()];
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const iso = validIso(y, mo, last);
    push(m.index ?? 0, iso ? { iso, granularity: 'month' } : null);
  }
  for (const m of src.matchAll(/\b(?:q([1-4])|(first|second|third|fourth|1st|2nd|3rd|4th)[\s-]+quarter(?:\s+of)?)\s+(?:of\s+)?(\d{4})\b/gi)) {
    const qMap: Record<string, number> = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4 };
    const q = m[1] ? Number(m[1]) : qMap[m[2].toLowerCase()];
    const y = Number(m[3]);
    const mo = q * 3;
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const iso = validIso(y, mo, last);
    push(m.index ?? 0, iso ? { iso, granularity: 'quarter' } : null);
  }
  for (const m of src.matchAll(/\b(?:(first|second|1st|2nd)[\s-]+half(?:\s+of)?|h([12]))\s+(?:of\s+)?(\d{4})\b/gi)) {
    const h = m[2] ? Number(m[2]) : /first|1st/i.test(m[1]) ? 1 : 2;
    const y = Number(m[3]);
    const iso = h === 1 ? `${y}-06-30` : `${y}-12-31`;
    push(m.index ?? 0, { iso, granularity: 'half' });
  }
  for (const m of src.matchAll(/\bmid-?(\d{4})\b/gi)) {
    push(m.index ?? 0, { iso: `${m[1]}-06-30`, granularity: 'half' });
  }
  if (candidates.length === 0) return null;
  // The date normally follows the trigger word ("PDUFA date of March 15,
  // 2027"), so dates after the anchor win, nearest first; earlier dates are
  // fallbacks.
  const score = (i: number) => (i >= anchorIndex ? i - anchorIndex : anchorIndex - i + 1_000_000);
  candidates.sort((a, b) => score(a.index) - score(b.index) || a.index - b.index);
  return candidates[0].parsed;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when the asset name or any alias (>= 4 chars) appears in text with word boundaries. */
export function matchAssetInText(asset: Pick<CatalystAsset, 'asset_name' | 'asset_aliases'>, text: string): boolean {
  const hay = text ?? '';
  const names = [asset.asset_name, ...(asset.asset_aliases ?? [])].filter(n => n && n.trim().length >= 4);
  for (const n of names) {
    const pattern = escapeRe(n.trim()).replace(/[-\s]+/g, '[-\\s]?');
    if (new RegExp(`(^|[^A-Za-z0-9])${pattern}(?![A-Za-z0-9])`, 'i').test(hay)) return true;
  }
  return false;
}

export function ctgovUrl(nct: string): string {
  return `https://clinicaltrials.gov/study/${nct}`;
}

/**
 * Trial-derived catalysts. A completion date that has passed is observed on
 * that date; a completed/terminated trial whose date is still in the future
 * is observed on last_update_posted (registry lag). Withdrawn trials and
 * trials without dates produce nothing.
 */
export function deriveTrialCatalysts(asset: CatalystAsset, trials: CatalystTrial[], today: string): CatalystRow[] {
  const rows: CatalystRow[] = [];
  const wanted = new Set(asset.nct_ids ?? []);
  for (const t of trials) {
    if (!wanted.has(t.nct_id)) continue;
    if (t.status === 'withdrawn') continue;
    const done = t.status === 'completed' || t.status === 'terminated';
    const pairs: Array<[CatalystType, string | null]> = [
      ['primary_completion', t.primary_completion_date],
      ['study_completion', t.completion_date],
    ];
    for (const [type, date] of pairs) {
      if (!date) continue;
      const expected = date.slice(0, 10);
      let observed: string | null = null;
      if (expected <= today) observed = expected;
      else if (done) observed = (t.last_update_posted ?? today).slice(0, 10);
      rows.push({
        asset_id: asset.id,
        company_id: asset.company_id,
        catalyst_type: type,
        expected_date: expected,
        observed_date: observed,
        nct_id: t.nct_id,
        source: 'ctgov',
        source_url: ctgovUrl(t.nct_id),
        confidence: type === 'primary_completion' ? 70 : 60,
      });
    }
  }
  return rows;
}

interface PhaseHistoryEntry { phase?: string; to?: string; date?: string; at?: string; observed_at?: string; changed_at?: string }

/** Phase transitions from clinical_assets.phase_history entries ({phase|to, date|at|observed_at}). */
export function derivePhaseTransitions(asset: CatalystAsset): CatalystRow[] {
  const hist = Array.isArray(asset.phase_history) ? (asset.phase_history as PhaseHistoryEntry[]) : [];
  const entries = hist
    .map(h => ({ phase: h?.phase ?? h?.to ?? null, date: (h?.date ?? h?.at ?? h?.observed_at ?? h?.changed_at ?? '').slice(0, 10) }))
    .filter(e => e.phase && /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const rows: CatalystRow[] = [];
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].phase === entries[i - 1].phase) continue;
    rows.push({
      asset_id: asset.id,
      company_id: asset.company_id,
      catalyst_type: 'phase_transition',
      expected_date: entries[i].date,
      observed_date: entries[i].date,
      nct_id: null,
      source: 'phase_history',
      source_url: asset.lead_nct_id ? ctgovUrl(asset.lead_nct_id) : `https://clinicaltrials.gov/search?term=${encodeURIComponent(asset.asset_name)}`,
      confidence: 60,
    });
  }
  return rows;
}

/**
 * Press-derived catalysts for the assets of the companies a release mentions.
 * PDUFA: "PDUFA" plus a date. Conference: category conference plus a major
 * meeting acronym plus a date. Readout: category clinical plus readout
 * language, observed on the publication date.
 */
export function derivePressCatalysts(press: CatalystPress, assets: CatalystAsset[], today: string): CatalystRow[] {
  const rows: CatalystRow[] = [];
  if (!/^https?:\/\//i.test(press.source_url ?? '')) return rows;
  const text = `${press.headline ?? ''}\n${press.body_text ?? ''}`;
  const published = press.published_at.slice(0, 10);
  const cats = new Set(press.categories ?? []);
  const matched = assets.filter(a => matchAssetInText(a, text));
  if (matched.length === 0) return rows;

  const pdufaIdx = text.search(PDUFA_RE);
  const pdufaDate = pdufaIdx >= 0 ? parseDateFromText(text, pdufaIdx) : null;
  const confIdx = text.search(CONFERENCE_RE);
  const confDate = cats.has('conference') && confIdx >= 0 ? parseDateFromText(text, confIdx) : null;
  const isReadout = cats.has('clinical') && READOUT_RE.test(text);

  for (const a of matched) {
    if (pdufaDate) {
      rows.push({
        asset_id: a.id, company_id: a.company_id, catalyst_type: 'pdufa',
        expected_date: pdufaDate.iso, observed_date: pdufaDate.iso <= today ? pdufaDate.iso : null, nct_id: null,
        source: 'press_release', source_url: press.source_url, confidence: pdufaDate.granularity === 'day' ? 85 : 65,
      });
    }
    if (confDate && confDate.iso >= published) {
      rows.push({
        asset_id: a.id, company_id: a.company_id, catalyst_type: 'conference_presentation',
        expected_date: confDate.iso, observed_date: confDate.iso <= today ? confDate.iso : null, nct_id: null,
        source: 'press_release', source_url: press.source_url, confidence: confDate.granularity === 'day' ? 70 : 50,
      });
    }
    if (isReadout) {
      rows.push({
        asset_id: a.id, company_id: a.company_id, catalyst_type: 'readout_announced',
        expected_date: published, observed_date: published, nct_id: null,
        source: 'press_release', source_url: press.source_url, confidence: 70,
      });
    }
  }
  return rows;
}

/** Collapse duplicates on the upsert key; keep the higher confidence, prefer an observed_date. */
export function dedupeCatalysts(rows: CatalystRow[]): CatalystRow[] {
  const map = new Map<string, CatalystRow>();
  for (const r of rows) {
    const key = `${r.asset_id}|${r.catalyst_type}|${r.nct_id ?? ''}|${r.expected_date}`;
    const prev = map.get(key);
    if (!prev) { map.set(key, r); continue; }
    const merged: CatalystRow = r.confidence > prev.confidence ? { ...r } : { ...prev };
    merged.observed_date = prev.observed_date ?? r.observed_date ?? null;
    map.set(key, merged);
  }
  return [...map.values()];
}

/**
 * A readout press release resolves the asset's nearest unobserved
 * primary_completion within six months either side of the readout date.
 */
export function readoutResolvesCompletion(readoutDate: string, completions: CatalystRow[]): CatalystRow[] {
  const r = Date.parse(readoutDate);
  return completions.filter(c => c.catalyst_type === 'primary_completion' && !c.observed_date
    && Math.abs(Date.parse(c.expected_date) - r) <= 183 * 86_400_000);
}

// ═══════════════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════════════

export interface CatalystsOptions {
  limit?: number;
  timeBudgetMs?: number;
  now?: Date;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function runCatalysts(supabase: SupabaseClient, opts: CatalystsOptions = {}): Promise<CatalystsRunResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const today = isoDay(now);
  const budget = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const limit = opts.limit ?? DEFAULT_ASSET_LIMIT;
  const errors: string[] = [];
  const result: CatalystsRunResult = {
    assetsProcessed: 0, trialsFetched: 0, pressFetched: 0, catalystsUpserted: 0, observedMarked: 0, failed: 0,
    errors, timedOut: false, durationMs: 0, cursor: null,
  };
  const outOfTime = () => Date.now() - started > budget;

  const cursor = await readSyncCursor(supabase, SYNC_SOURCE);
  let q = supabase
    .from('clinical_assets')
    .select('id, company_id, asset_name, asset_aliases, nct_ids, lead_nct_id, phase, phase_history')
    .not('company_id', 'is', null)
    .order('id', { ascending: true })
    .limit(limit);
  if (cursor.cursor) q = q.gt('id', cursor.cursor);
  let { data: assetsData, error: aErr } = await q;
  if (aErr) errors.push(`clinical_assets read: ${aErr.message}`);
  let lastId: string | null = cursor.cursor;
  if ((assetsData ?? []).length === 0 && cursor.cursor) {
    const again = await supabase
      .from('clinical_assets')
      .select('id, company_id, asset_name, asset_aliases, nct_ids, lead_nct_id, phase, phase_history')
      .not('company_id', 'is', null)
      .order('id', { ascending: true })
      .limit(limit);
    assetsData = again.data ?? [];
    lastId = null;
  }
  const assets = (assetsData ?? []) as CatalystAsset[];

  // Trials for every NCT id in the batch.
  const nctIds = [...new Set(assets.flatMap(a => a.nct_ids ?? []))];
  const trialsByNct = new Map<string, CatalystTrial[]>();
  for (const ids of chunk(nctIds, 200)) {
    if (outOfTime()) { result.timedOut = true; break; }
    const { data, error } = await supabase
      .from('company_trials')
      .select('nct_id, company_id, status, phase, primary_completion_date, completion_date, last_update_posted')
      .in('nct_id', ids);
    if (error) { errors.push(`company_trials read: ${error.message}`); continue; }
    for (const t of (data ?? []) as CatalystTrial[]) {
      const list = trialsByNct.get(t.nct_id) ?? [];
      list.push(t);
      trialsByNct.set(t.nct_id, list);
    }
    result.trialsFetched += data?.length ?? 0;
  }

  // Press releases for the batch's companies (18-month window).
  const companyIds = [...new Set(assets.map(a => a.company_id).filter((x): x is string => !!x))];
  const assetsByCompany = new Map<string, CatalystAsset[]>();
  for (const a of assets) {
    if (!a.company_id) continue;
    const list = assetsByCompany.get(a.company_id) ?? [];
    list.push(a);
    assetsByCompany.set(a.company_id, list);
  }
  const sinceIso = new Date(now.getTime() - PRESS_LOOKBACK_MONTHS * 30 * 86_400_000).toISOString();
  const press: CatalystPress[] = [];
  for (const ids of chunk(companyIds, 100)) {
    if (outOfTime()) { result.timedOut = true; break; }
    const { data, error } = await supabase
      .from('press_releases')
      .select('id, headline, body_text, published_at, source_url, company_ids, categories')
      .overlaps('company_ids', pgArrayLiteral(ids))
      .overlaps('categories', pgArrayLiteral(['regulatory', 'conference', 'clinical']))
      .gte('published_at', sinceIso)
      .order('published_at', { ascending: false })
      .limit(1500);
    if (error) { errors.push(`press_releases read: ${error.message}`); continue; }
    press.push(...((data ?? []) as CatalystPress[]));
  }
  result.pressFetched = press.length;

  // Derive.
  let rows: CatalystRow[] = [];
  for (const a of assets) {
    if (outOfTime()) { result.timedOut = true; break; }
    lastId = a.id;
    result.assetsProcessed++;
    const trials: CatalystTrial[] = [];
    for (const nct of a.nct_ids ?? []) {
      const list = trialsByNct.get(nct) ?? [];
      // Prefer the row owned by the asset's company when the trial is shared.
      const own = list.find(t => t.company_id === a.company_id) ?? list[0];
      if (own) trials.push(own);
    }
    rows.push(...deriveTrialCatalysts(a, trials, today));
    rows.push(...derivePhaseTransitions(a));
  }
  for (const pr of press) {
    const targets = (pr.company_ids ?? []).flatMap(cid => assetsByCompany.get(cid) ?? []);
    if (targets.length === 0) continue;
    rows.push(...derivePressCatalysts(pr, targets, today));
  }
  // Readouts resolve nearby primary completions.
  for (const r of rows.filter(x => x.catalyst_type === 'readout_announced')) {
    for (const c of readoutResolvesCompletion(r.expected_date, rows.filter(x => x.asset_id === r.asset_id))) {
      c.observed_date = r.expected_date;
    }
  }
  rows = dedupeCatalysts(rows);

  for (const batch of chunk(rows, 300)) {
    const { error } = await supabase
      .from('asset_catalysts')
      .upsert(batch, { onConflict: 'asset_id,catalyst_type,nct_key,expected_date' });
    if (error) { result.failed += batch.length; errors.push(`asset_catalysts upsert: ${error.message}`); continue; }
    result.catalystsUpserted += batch.length;
  }

  // Sweep: any stored catalyst whose expected date has passed is observed.
  if (!outOfTime()) {
    const { data: passed, error: sErr } = await supabase
      .from('asset_catalysts')
      .select('id, expected_date')
      .is('observed_date', null)
      .lt('expected_date', today)
      .in('catalyst_type', ['primary_completion', 'study_completion', 'pdufa', 'conference_presentation'])
      .limit(OBSERVE_SWEEP_LIMIT);
    if (sErr) errors.push(`observed sweep read: ${sErr.message}`);
    const byDate = new Map<string, string[]>();
    for (const p of (passed ?? []) as Array<{ id: string; expected_date: string }>) {
      const list = byDate.get(p.expected_date) ?? [];
      list.push(p.id);
      byDate.set(p.expected_date, list);
    }
    for (const [date, ids] of byDate) {
      for (const idBatch of chunk(ids, 200)) {
        const { error } = await supabase.from('asset_catalysts').update({ observed_date: date }).in('id', idBatch);
        if (error) { errors.push(`observed sweep update: ${error.message}`); break; }
        result.observedMarked += idBatch.length;
      }
    }
  }

  result.cursor = lastId;
  try {
    await writeSyncCursor(supabase, SYNC_SOURCE, lastId, { last_batch: assets.length, last_run_today: today });
  } catch (err) {
    errors.push(`cursor write: ${err instanceof Error ? err.message : String(err)}`);
  }
  result.durationMs = Date.now() - started;
  return result;
}
