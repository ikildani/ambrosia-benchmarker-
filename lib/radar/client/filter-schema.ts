/**
 * Asset Radar feed — filter state, URL codec and API query builder.
 *
 * Pure TypeScript (no React, no DOM) so the same module backs the feed and
 * facets routes on the server and the URL-synced reducer on the client.
 * Vocabulary values come from lib/radar/vocab.ts; the three lists that the
 * vocab module does not define yet (owner type, trial status, score band)
 * live here and nowhere else.
 */

import {
  RADAR_TA_OPTIONS,
  RADAR_MODALITY_OPTIONS,
  RADAR_PHASE_OPTIONS,
  RADAR_PHASE_RANK,
  RADAR_PARTNERSHIP_OPTIONS,
  RADAR_REGION_OPTIONS,
  RADAR_COUNTRY_OPTIONS,
  isRadarValue,
  type VocabOption,
} from '@/lib/radar/vocab';
import type { OwnerType } from '@/lib/radar/types';

// ── Extra vocabularies ────────────────────────────────────────────────────

/** companies.owner_type (migration 106 check constraint). */
export const RADAR_OWNER_TYPE_OPTIONS: (VocabOption & { value: OwnerType })[] = [
  { value: 'industry', label: 'Industry' },
  { value: 'academic', label: 'Academic' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'government', label: 'Government' },
  { value: 'network', label: 'Network' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
];

/** clinical_assets.trial_status slugs written by lib/ingestion/clinical-trials.ts. */
export const RADAR_TRIAL_STATUS_OPTIONS: VocabOption[] = [
  { value: 'recruiting', label: 'Recruiting' },
  { value: 'not_yet_recruiting', label: 'Not yet recruiting' },
  { value: 'active_not_recruiting', label: 'Active, not recruiting' },
  { value: 'enrolling_by_invitation', label: 'Enrolling by invitation' },
  { value: 'completed', label: 'Completed' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'unknown', label: 'Unknown' },
];

/** Licensing intent score bands; values must match radar_score_band() in migration 117. */
export const RADAR_SCORE_BAND_OPTIONS: VocabOption[] = [
  { value: '80+', label: '80 and above' },
  { value: '60-79', label: '60 to 79' },
  { value: '40-59', label: '40 to 59' },
  { value: '20-39', label: '20 to 39' },
  { value: '0-19', label: '0 to 19' },
];

export function scoreBand(score: number | null | undefined): string | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  if (score >= 80) return '80+';
  if (score >= 60) return '60-79';
  if (score >= 40) return '40-59';
  if (score >= 20) return '20-39';
  return '0-19';
}

// ── Filter state ──────────────────────────────────────────────────────────

/** Multi-select facets. Values are validated against a vocabulary where one exists. */
export const MULTI_FACET_KEYS = [
  'ta',
  'modality',
  'phase',
  'partnership',
  'country',
  'region',
  'owner_type',
  'trial_status',
  'indication',
  'target',
  'score_band',
] as const;
export type MultiFacetKey = (typeof MULTI_FACET_KEYS)[number];

export interface RadarFilterState {
  /** Free-text search over asset, company, target, indication. */
  q: string;
  ta: string[];
  modality: string[];
  phase: string[];
  partnership: string[];
  country: string[];
  region: string[];
  owner_type: string[];
  trial_status: string[];
  /** indication_category slugs (no closed vocabulary; validated as slugs). */
  indication: string[];
  /** Exact target strings as stored (no closed vocabulary; length-capped). */
  target: string[];
  score_band: string[];
  phase_min: string | null;
  phase_max: string | null;
  /** Minimum licensing intent score, 0–100. */
  min_score: number | null;
}

export const EMPTY_FILTERS: RadarFilterState = {
  q: '',
  ta: [],
  modality: [],
  phase: [],
  partnership: [],
  country: [],
  region: [],
  owner_type: [],
  trial_status: [],
  indication: [],
  target: [],
  score_band: [],
  phase_min: null,
  phase_max: null,
  min_score: null,
};

export const SORT_KEYS = [
  'score',
  'confidence',
  'asset',
  'owner',
  'phase',
  'modality',
  'ta',
  'target',
  'readiness',
  'heat',
  'updated',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = 'asc' | 'desc';

/** Sort key → clinical_assets column. Shared by the feed route (ORDER BY) and the cursor codec. */
export const SORT_COLUMNS: Record<SortKey, { column: string; kind: 'number' | 'text'; defaultDir: SortDir }> = {
  score: { column: 'licensing_intent_score', kind: 'number', defaultDir: 'desc' },
  confidence: { column: 'score_confidence', kind: 'number', defaultDir: 'desc' },
  asset: { column: 'asset_name', kind: 'text', defaultDir: 'asc' },
  owner: { column: 'company_name', kind: 'text', defaultDir: 'asc' },
  phase: { column: 'phase', kind: 'text', defaultDir: 'desc' },
  modality: { column: 'modality', kind: 'text', defaultDir: 'asc' },
  ta: { column: 'therapeutic_area', kind: 'text', defaultDir: 'asc' },
  target: { column: 'target', kind: 'text', defaultDir: 'asc' },
  readiness: { column: 'deal_readiness_score', kind: 'number', defaultDir: 'desc' },
  heat: { column: 'competitive_heat', kind: 'number', defaultDir: 'desc' },
  updated: { column: 'last_update_date', kind: 'text', defaultDir: 'desc' },
};

export type ViewMode = 'table' | 'cards';

export interface RadarUiState {
  view: ViewMode;
  sort: SortKey;
  dir: SortDir;
  /** Opaque keyset cursor for the current page (null = first page). */
  after: string | null;
  /** Selected mandate id, or null for "all assets". */
  mandate: string | null;
  /** Asset ids in the compare tray, max COMPARE_LIMIT. */
  compare: string[];
}

export const COMPARE_LIMIT = 5;
export const FEED_PAGE_SIZE = 50;
export const FEED_MAX_PAGE_SIZE = 100;

export const DEFAULT_UI: RadarUiState = {
  view: 'table',
  sort: 'score',
  dir: 'desc',
  after: null,
  mandate: null,
  compare: [],
};

export interface RadarState {
  filters: RadarFilterState;
  ui: RadarUiState;
}

// ── Validation ────────────────────────────────────────────────────────────

const FACET_VOCAB: Partial<Record<MultiFacetKey, VocabOption[]>> = {
  ta: RADAR_TA_OPTIONS,
  modality: RADAR_MODALITY_OPTIONS,
  phase: RADAR_PHASE_OPTIONS,
  partnership: RADAR_PARTNERSHIP_OPTIONS,
  country: RADAR_COUNTRY_OPTIONS,
  region: RADAR_REGION_OPTIONS,
  owner_type: RADAR_OWNER_TYPE_OPTIONS,
  trial_status: RADAR_TRIAL_STATUS_OPTIONS,
  score_band: RADAR_SCORE_BAND_OPTIONS,
};

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_VALUES_PER_FACET = 30;
const MAX_TARGET_LEN = 80;
const MAX_Q_LEN = 100;

/** Vocabulary list for a facet, or null when the facet is open-ended (indication, target). */
export function facetOptions(key: MultiFacetKey): VocabOption[] | null {
  return FACET_VOCAB[key] ?? null;
}

/**
 * Keeps only values the facet accepts. Vocabulary facets are whitelisted;
 * indication categories must be slugs; targets are trimmed and capped so
 * they can be embedded in a PostgREST `.in()` safely (the client quotes them).
 */
export function cleanFacetValues(key: MultiFacetKey, raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const v = r.trim();
    if (!v || seen.has(v)) continue;
    const list = FACET_VOCAB[key];
    if (list) {
      if (!isRadarValue(list, v)) continue;
    } else if (key === 'indication') {
      if (!SLUG_RE.test(v)) continue;
    } else if (key === 'target') {
      if (v.length > MAX_TARGET_LEN || /[\u0000-\u001f\u007f]/.test(v)) continue;
    }
    seen.add(v);
    out.push(v);
    if (out.length >= MAX_VALUES_PER_FACET) break;
  }
  return out;
}

export function cleanPhaseBound(raw: string | null | undefined): string | null {
  return raw && isRadarValue(RADAR_PHASE_OPTIONS, raw) ? raw : null;
}

export function cleanMinScore(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Free text: control characters and PostgREST/LIKE metacharacters removed. Mirrors radar-api sanitizeSearchTerm. */
export function cleanQuery(raw: string | null | undefined): string {
  if (!raw) return '';
  return Array.from(raw)
    .map(ch => {
      const code = ch.charCodeAt(0);
      return code < 32 || code === 127 || ',()%\\'.includes(ch) ? ' ' : ch;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_Q_LEN)
    .trim();
}

export function isUuidLike(v: string): boolean {
  return UUID_RE.test(v);
}

/**
 * Phases allowed once phase_min / phase_max are applied on top of an explicit
 * phase list. Returns null when no phase constraint exists at all.
 */
export function resolvePhaseList(filters: Pick<RadarFilterState, 'phase' | 'phase_min' | 'phase_max'>): string[] | null {
  const lo = filters.phase_min ? RADAR_PHASE_RANK[filters.phase_min] ?? 0 : 0;
  const hi = filters.phase_max ? RADAR_PHASE_RANK[filters.phase_max] ?? Infinity : Infinity;
  const hasRange = lo > 0 || hi !== Infinity;
  if (!hasRange && filters.phase.length === 0) return null;
  const pool = filters.phase.length > 0 ? filters.phase : RADAR_PHASE_OPTIONS.map(o => o.value);
  const out = pool.filter(p => {
    const r = RADAR_PHASE_RANK[p] ?? 0;
    return r >= lo && r <= hi;
  });
  // A contradictory range (min above max) must match nothing rather than everything.
  return out.length > 0 ? out : ['__none__'];
}

export function isEmptyFilters(f: RadarFilterState): boolean {
  if (f.q) return false;
  if (f.phase_min || f.phase_max || f.min_score !== null) return false;
  return MULTI_FACET_KEYS.every(k => f[k].length === 0);
}

export function countActiveFilters(f: RadarFilterState): number {
  let n = MULTI_FACET_KEYS.reduce((acc, k) => acc + f[k].length, 0);
  if (f.q) n += 1;
  if (f.phase_min || f.phase_max) n += 1;
  if (f.min_score !== null) n += 1;
  return n;
}

// ── URL codec ─────────────────────────────────────────────────────────────
// Short param names keep shared links readable. Multi-value facets repeat
// the param (`ta=oncology&ta=neurology`) so values may contain commas.

const URL_KEYS: Record<MultiFacetKey, string> = {
  ta: 'ta',
  modality: 'mod',
  phase: 'ph',
  partnership: 'ps',
  country: 'cc',
  region: 'rg',
  owner_type: 'ot',
  trial_status: 'ts',
  indication: 'ind',
  target: 'tgt',
  score_band: 'sb',
};

export function parseFilters(params: URLSearchParams): RadarFilterState {
  const f: RadarFilterState = { ...EMPTY_FILTERS };
  for (const key of MULTI_FACET_KEYS) {
    f[key] = cleanFacetValues(key, params.getAll(URL_KEYS[key]));
  }
  f.q = cleanQuery(params.get('q'));
  f.phase_min = cleanPhaseBound(params.get('pmin'));
  f.phase_max = cleanPhaseBound(params.get('pmax'));
  f.min_score = cleanMinScore(params.get('min'));
  return f;
}

export function parseUi(params: URLSearchParams): RadarUiState {
  const sortRaw = params.get('sort');
  const sort: SortKey = (SORT_KEYS as readonly string[]).includes(sortRaw ?? '') ? (sortRaw as SortKey) : DEFAULT_UI.sort;
  const dirRaw = params.get('dir');
  const dir: SortDir = dirRaw === 'asc' || dirRaw === 'desc' ? dirRaw : SORT_COLUMNS[sort].defaultDir;
  const viewRaw = params.get('view');
  const mandateRaw = params.get('m');
  const after = params.get('after');
  const compare = Array.from(new Set(params.getAll('cmp').filter(isUuidLike))).slice(0, COMPARE_LIMIT);
  return {
    view: viewRaw === 'cards' ? 'cards' : 'table',
    sort,
    dir,
    after: after && /^[A-Za-z0-9_-]{1,512}$/.test(after) ? after : null,
    mandate: mandateRaw && isUuidLike(mandateRaw) ? mandateRaw : null,
    compare,
  };
}

export function parseRadarState(params: URLSearchParams): RadarState {
  return { filters: parseFilters(params), ui: parseUi(params) };
}

/** Serialises the whole state; defaults are omitted so an untouched feed has a clean URL. */
export function serializeRadarState(state: RadarState): URLSearchParams {
  const p = new URLSearchParams();
  const { filters: f, ui } = state;
  if (f.q) p.set('q', f.q);
  for (const key of MULTI_FACET_KEYS) {
    for (const v of f[key]) p.append(URL_KEYS[key], v);
  }
  if (f.phase_min) p.set('pmin', f.phase_min);
  if (f.phase_max) p.set('pmax', f.phase_max);
  if (f.min_score !== null) p.set('min', String(f.min_score));
  if (ui.sort !== DEFAULT_UI.sort) p.set('sort', ui.sort);
  if (ui.dir !== SORT_COLUMNS[ui.sort].defaultDir) p.set('dir', ui.dir);
  if (ui.view !== DEFAULT_UI.view) p.set('view', ui.view);
  if (ui.mandate) p.set('m', ui.mandate);
  if (ui.after) p.set('after', ui.after);
  for (const id of ui.compare) p.append('cmp', id);
  return p;
}

// ── API query builder ─────────────────────────────────────────────────────
// The feed and facets routes accept the same parameter names as the URL
// codec plus sort / dir / after / limit / count, so the client only needs
// one builder. Both routes re-validate everything they receive.

export interface FeedQueryOptions {
  sort?: SortKey;
  dir?: SortDir;
  after?: string | null;
  limit?: number;
  /** `count: 'only'` returns just the estimated total (HEAD-style). */
  countOnly?: boolean;
}

export function buildFeedQuery(filters: RadarFilterState, opts: FeedQueryOptions = {}): URLSearchParams {
  const p = serializeRadarState({ filters, ui: DEFAULT_UI });
  if (opts.sort) p.set('sort', opts.sort);
  if (opts.dir) p.set('dir', opts.dir);
  if (opts.after) p.set('after', opts.after);
  if (opts.limit) p.set('limit', String(opts.limit));
  if (opts.countOnly) p.set('count', 'only');
  return p;
}

/** Stable JSON of the filters (sorted keys, sorted values) for cache keys on both sides. */
export function filtersFingerprint(f: RadarFilterState): string {
  const obj: Record<string, unknown> = {};
  for (const key of [...MULTI_FACET_KEYS].sort()) {
    if (f[key].length) obj[key] = [...f[key]].sort();
  }
  if (f.q) obj.q = f.q;
  if (f.phase_min) obj.phase_min = f.phase_min;
  if (f.phase_max) obj.phase_max = f.phase_max;
  if (f.min_score !== null) obj.min_score = f.min_score;
  return JSON.stringify(obj);
}
