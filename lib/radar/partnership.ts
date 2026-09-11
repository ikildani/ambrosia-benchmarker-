/**
 * Asset Radar — partnership detection (Phase 2, item 7).
 *
 * Standalone refresh that derives `partnership_status`, the partner, the
 * territory split and an evidence trail for every clinical asset, replacing
 * the per-asset `resolvePartnershipStatus` lookups inside the Layer 1
 * indexer (gap register G-PART-1..4, G-STAT-1).
 *
 * Three evidence sources, in descending strength:
 *
 *   deal               deals row where the asset's company is the LICENSOR and
 *                      the deal asset name matches the asset (normalized
 *                      equality, exact code-name token, or token overlap >= 0.8;
 *                      never a substring match). In-licensed, rejected, flagged,
 *                      synthetic and non-canonical deals are ignored.
 *   trial_collaborator industry collaborator on one of the asset's trials that
 *                      is not the owning company. Academic, hospital,
 *                      government and non-profit collaborators do not count.
 *   press_release      press_releases row mentioning the company and the asset
 *                      together with licensing language.
 *
 * Territory algebra runs over the fixed set {us, eu, japan, china, row};
 * 'global' is the union. `partnered` = every region granted, `partially_partnered`
 * = some region granted or a non-deal partner signal, else `unpartnered`.
 *
 * `derivePartnership` is pure (unit-tested); `refreshPartnershipBatch` is the
 * set-based database driver used by /api/cron/partnership-refresh.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { pgArrayLiteral } from '@/lib/radar/pg-array';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type PartnershipStatus = 'unpartnered' | 'partially_partnered' | 'partnered';

export type Territory = 'us' | 'eu' | 'japan' | 'china' | 'row';

/** The fixed region set. 'global' is the union of all five. */
export const TERRITORIES: readonly Territory[] = ['us', 'eu', 'japan', 'china', 'row'];

export type EvidenceType = 'deal' | 'trial_collaborator' | 'press_release';

export interface PartnershipEvidence {
  type: EvidenceType;
  /** deals.id, NCT id, or press_releases.id */
  id: string;
  url?: string;
  /** ISO date of the deal announcement / press release */
  date?: string;
  note: string;
}

export interface PartnershipResult {
  status: PartnershipStatus;
  partnerCompanyName: string | null;
  partnerCompanyId: string | null;
  /** Regions confirmed granted by active deals (empty when only soft signals exist). */
  territoriesGranted: Territory[];
  /**
   * Regions still available. `['global']` means no confirmed territorial grant
   * (an unpartnered asset, or a partner signal whose territory split is not
   * disclosed); `[]` means every region is granted.
   */
  territoriesAvailable: string[];
  evidence: PartnershipEvidence[];
  /** 0-100. Deal-backed >= 80 (65 when the territory is undisclosed); press-only <= 70; trial-only <= 60. */
  confidence: number;
  /** Active deals that matched; written to clinical_assets.deal_ids. */
  dealIds: string[];
}

export interface PartnershipAsset {
  id?: string;
  company_id: string | null;
  company_name: string;
  /** companies.name_variations for the owning company, when known. */
  company_name_variations?: string[] | null;
  asset_name: string;
  asset_aliases?: string[] | null;
  nct_ids?: string[] | null;
}

export interface PartnershipDeal {
  id: string;
  licensor_id: string | null;
  licensor_name: string | null;
  licensee_id: string | null;
  licensee_name: string | null;
  asset_name: string | null;
  territory: string | null;
  territories_included?: string[] | null;
  deal_type?: string | null;
  deal_status?: string | null;
  exclusivity?: string | null;
  announced_date?: string | null;
  source_url?: string | null;
  verification_status?: string | null;
  is_synthetic?: boolean | null;
  is_canonical?: boolean | null;
}

export interface TrialCollaborator {
  nct_id: string;
  collaborator_name: string;
  /** CT.gov sponsor class when known (INDUSTRY, NIH, FED, OTHER_GOV, NETWORK, INDIV, OTHER, UNKNOWN). */
  collaborator_class?: string | null;
}

export interface PressHit {
  id: string;
  headline: string;
  body_text?: string | null;
  published_at: string | null;
  source_url?: string | null;
  /** Canonical companies.name values (see lib/ingestion/press-releases.ts). */
  companies_mentioned?: string[] | null;
  company_ids?: string[] | null;
}

export interface DerivePartnershipInput {
  asset: PartnershipAsset;
  deals: PartnershipDeal[];
  trialCollaborators: TrialCollaborator[];
  pressHits: PressHit[];
}

// ═══════════════════════════════════════════════════════════════════════
// STRING HELPERS
// ═══════════════════════════════════════════════════════════════════════

function alnum(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Copied from lib/ingestion/clinical-trials.ts — escapes LIKE/ILIKE metacharacters. */
export function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPANY NAME EQUALITY
// ═══════════════════════════════════════════════════════════════════════

const LEGAL_SUFFIX_RE =
  /[,\s]+(inc\.?|incorporated|corp\.?|corporation|ltd\.?|limited|plc|llc|l\.l\.c\.|lp|l\.p\.|co\.?|company|ag|sa|s\.a\.?|nv|n\.v\.?|se|gmbh|a\/s|ab|as|oy|kk|k\.k\.|pty|holdings?|group)\s*$/i;

const DESCRIPTOR_SUFFIX_RE =
  /\s+(pharmaceuticals?|pharma|therapeutics?|biosciences?|bioscience|biotechnology|biotech|biopharma|biopharmaceuticals?|biologics|sciences?|medicines?|oncology|health|healthcare|laboratories|labs?|research|international|global)\s*$/i;

/** Lower-case key with legal suffixes removed: 'Pfizer Inc.' -> 'pfizer'. */
export function companyKey(name: string | null | undefined): string {
  if (!name) return '';
  let s = name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/&/g, ' and ').trim();
  for (let i = 0; i < 3; i++) s = s.replace(LEGAL_SUFFIX_RE, '').replace(/\s+and\s*$/i, '');
  return alnum(s);
}

/** Key with descriptor words also removed: 'Acme Therapeutics, Inc.' -> 'acme'. */
function companyCoreKey(name: string | null | undefined): string {
  if (!name) return '';
  let s = name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/&/g, ' and ').trim();
  for (let i = 0; i < 3; i++) s = s.replace(LEGAL_SUFFIX_RE, '').replace(/\s+and\s*$/i, '');
  for (let i = 0; i < 2; i++) s = s.replace(DESCRIPTOR_SUFFIX_RE, '');
  return alnum(s);
}

/** True when two spellings denote the same company (suffix-insensitive equality; never substring). */
export function sameCompany(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = companyKey(a);
  const kb = companyKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const ca = companyCoreKey(a);
  const cb = companyCoreKey(b);
  return ca.length >= 5 && ca === cb;
}

function companyNamesOf(asset: PartnershipAsset): string[] {
  return [asset.company_name, ...(asset.company_name_variations ?? [])].filter(Boolean);
}

function isOwningCompany(asset: PartnershipAsset, id: string | null | undefined, name: string | null | undefined): boolean {
  if (id && asset.company_id && id === asset.company_id) return true;
  return companyNamesOf(asset).some(n => sameCompany(n, name));
}

// ═══════════════════════════════════════════════════════════════════════
// OWNER TYPE HEURISTIC (academic / hospital / government / non-profit / industry)
// ═══════════════════════════════════════════════════════════════════════

export type OwnerType = 'academic' | 'hospital' | 'government' | 'nonprofit' | 'industry';

const ACADEMIC_RE = /\b(universit|université|universidad|universität|college|school of|academy|academic|faculty|polytechnic|institut|instituto|istituto|campus)/i;
const HOSPITAL_RE = /\b(hospital|hôpital|hospitalier|medical cent(er|re)|health system|healthcare system|clinic\b|clinique|infirmary|cancer cent(er|re)|children'?s|nhs\b|mayo\b|sloan kettering|md anderson|dana-farber|assistance publique|charité)/i;
const GOVERNMENT_RE = /\b(nih\b|nci\b|niaid|nhlbi|nida|niddk|nimh|national institutes?|national cancer|ministry|ministère|department of|government|agency|fda\b|ema\b|cdc\b|barda|darpa|army|navy|air force|veterans|department of defense|research council|cirm\b|inserm|cnrs|helmholtz|max planck)/i;
const NONPROFIT_RE = /\b(foundation|fondation|fundación|society|association|charity|charitable|trust\b|network|consortium|cooperative|cooperative group|coalition|alliance for|fund\b|initiative|program\b|programme\b)/i;

/**
 * Classify a sponsor / collaborator by name. Only 'industry' collaborators
 * count as partnership evidence. When the CT.gov class is known it wins.
 */
export function classifyOwnerType(name: string, ctgovClass?: string | null): OwnerType {
  const cls = (ctgovClass || '').toUpperCase();
  if (cls === 'INDUSTRY') return 'industry';
  if (cls === 'NIH' || cls === 'FED' || cls === 'OTHER_GOV') return 'government';
  if (cls === 'NETWORK') return 'nonprofit';
  if (cls === 'INDIV') return 'nonprofit';
  const n = name || '';
  if (GOVERNMENT_RE.test(n)) return 'government';
  if (ACADEMIC_RE.test(n)) return 'academic';
  if (HOSPITAL_RE.test(n)) return 'hospital';
  if (NONPROFIT_RE.test(n)) return 'nonprofit';
  return 'industry';
}

// ═══════════════════════════════════════════════════════════════════════
// ASSET NAME MATCHER
// ═══════════════════════════════════════════════════════════════════════

export type NameMatchKind = 'exact' | 'code' | 'overlap';

/** Dosage-form and filler words that do not identify an asset. */
const NAME_STOPWORDS = new Set([
  'injection', 'injectable', 'tablet', 'tablets', 'capsule', 'capsules', 'oral', 'iv', 'sc',
  'subcutaneous', 'intravenous', 'solution', 'suspension', 'formulation', 'program', 'programme',
  'product', 'candidate', 'compound', 'asset', 'the', 'a', 'an', 'of', 'for', 'in', 'with', 'its',
  'drug', 'therapy', 'treatment', 'dose', 'doses', 'mg', 'mcg', 'ml', 'kg',
]);

/** 'MK-3475', 'BNT162b2', 'DS-8201a', 'AZD 1222' -> 'mk3475', 'bnt162b2', 'ds8201a', 'azd1222'. */
const CODE_RE = /\b([a-z]{1,6})[-\s]?(\d{2,6}[a-z0-9]{0,3})\b/gi;

export function codeTokens(name: string): Set<string> {
  const out = new Set<string>();
  for (const m of (name || '').matchAll(CODE_RE)) out.add(`${m[1]}${m[2]}`.toLowerCase());
  return out;
}

function wordTokens(name: string): string[] {
  return (name || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 0 && !NAME_STOPWORDS.has(t));
}

/**
 * Split a free-text asset field into candidate names: parentheticals become
 * their own segment ('Pembrolizumab (MK-3475)' -> ['Pembrolizumab', 'MK-3475'])
 * and list separators split combos ('ABC-123 and ABC-456').
 */
export function nameSegments(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const segments: string[] = [];
  const parens = [...raw.matchAll(/\(([^)]{2,})\)/g)].map(m => m[1]);
  const base = raw.replace(/\([^)]*\)/g, ' ');
  for (const part of [base, ...parens]) {
    for (const s of part.split(/\s*(?:,|;|\/|\band\b|&|\bplus\b|\+)\s*/i)) {
      const t = s.trim();
      if (t.length >= 2) segments.push(t);
    }
  }
  return segments;
}

function matchSegment(a: string, d: string): NameMatchKind | null {
  const aa = alnum(a);
  const dd = alnum(d);
  if (aa.length >= 3 && aa === dd) return 'exact';

  const ca = codeTokens(a);
  if (ca.size > 0) {
    const cd = codeTokens(d);
    for (const c of ca) if (cd.has(c)) return 'code';
  }

  const ta = new Set(wordTokens(a));
  const td = new Set(wordTokens(d));
  if (ta.size === 0 || td.size === 0) return null;
  let inter = 0;
  let strong = false;
  for (const t of ta) {
    if (td.has(t)) {
      inter++;
      if (t.length >= 4) strong = true;
    }
  }
  const denom = Math.max(ta.size, td.size);
  if (strong && inter / denom >= 0.8) return 'overlap';
  return null;
}

/**
 * Does a deal's asset_name refer to this asset? Returns the strongest match
 * kind or null. Short names never substring-match: 'ABC' vs 'ABC-123' is null.
 */
export function matchAssetName(assetNames: string[], dealAssetName: string | null | undefined): NameMatchKind | null {
  if (!dealAssetName) return null;
  const dealSegments = nameSegments(dealAssetName);
  if (dealSegments.length === 0) return null;
  const assetSegments = assetNames.filter(Boolean).flatMap(nameSegments);
  let best: NameMatchKind | null = null;
  for (const a of assetSegments) {
    for (const d of dealSegments) {
      const kind = matchSegment(a, d);
      if (kind === 'exact') return 'exact';
      if (kind === 'code') best = 'code';
      else if (kind === 'overlap' && best === null) best = 'overlap';
    }
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════════════
// TERRITORY ALGEBRA
// ═══════════════════════════════════════════════════════════════════════

export type TerritoryScope =
  | { scope: 'global' }
  | { scope: 'regions'; regions: Territory[] }
  /** A regional grant whose region is not disclosed ('regional', 'other'). */
  | { scope: 'regional_unknown' }
  /** No territory information on the deal at all. */
  | { scope: 'unknown' };

const ALL_BUT = (excluded: Territory[]): Territory[] => TERRITORIES.filter(t => !excluded.includes(t));

const TERRITORY_LABELS: Record<string, Territory[] | 'global' | 'regional'> = {
  global: 'global', worldwide: 'global', world: 'global', ww: 'global', all: 'global', all_territories: 'global', global_rights: 'global', worldwide_rights: 'global',
  us: ['us'], usa: ['us'], u_s: ['us'], u_s_a: ['us'], united_states: ['us'], us_only: ['us'], united_states_only: ['us'], north_america: ['us'], na: ['us'], us_canada: ['us'], us_and_canada: ['us'], united_states_and_canada: ['us', 'row'],
  ex_us: ALL_BUT(['us']), ex_u_s: ALL_BUT(['us']), exus: ALL_BUT(['us']), outside_us: ALL_BUT(['us']), outside_the_us: ALL_BUT(['us']), ex_north_america: ALL_BUT(['us']),
  ex_china: ALL_BUT(['china']), ex_greater_china: ALL_BUT(['china']), outside_china: ALL_BUT(['china']), outside_greater_china: ALL_BUT(['china']),
  ex_japan: ALL_BUT(['japan']), outside_japan: ALL_BUT(['japan']),
  ex_eu: ALL_BUT(['eu']), ex_europe: ALL_BUT(['eu']), outside_europe: ALL_BUT(['eu']),
  ex_asia: ['us', 'eu', 'row'], ex_asia_pacific: ['us', 'eu', 'row'],
  us_eu: ['us', 'eu'], us_europe: ['us', 'eu'], us_eu_japan: ['us', 'eu', 'japan'], us_europe_japan: ['us', 'eu', 'japan'], us_japan: ['us', 'japan'],
  eu: ['eu'], europe: ['eu'], european_union: ['eu'], eu_only: ['eu'], emea: ['eu', 'row'], uk: ['eu'], united_kingdom: ['eu'], germany: ['eu'], france: ['eu'], italy: ['eu'], spain: ['eu'], switzerland: ['eu'], nordics: ['eu'], benelux: ['eu'], eu_uk: ['eu'], europe_uk: ['eu'],
  japan: ['japan'], jp: ['japan'], japan_only: ['japan'],
  china: ['china'], greater_china: ['china'], prc: ['china'], mainland_china: ['china'], china_only: ['china'], china_hk_macau: ['china'], china_hong_kong_macau: ['china'], china_hong_kong_macau_taiwan: ['china'], hong_kong: ['china'], taiwan: ['china'], macau: ['china'],
  asia: ['china', 'japan', 'row'], asia_pacific: ['china', 'japan', 'row'], apac: ['china', 'japan', 'row'], asia_ex_japan: ['china', 'row'], asia_ex_china: ['japan', 'row'], east_asia: ['china', 'japan', 'row'],
  korea: ['row'], south_korea: ['row'], republic_of_korea: ['row'], australia: ['row'], australia_new_zealand: ['row'], anz: ['row'], canada: ['row'], latin_america: ['row'], latam: ['row'], south_america: ['row'], brazil: ['row'], mexico: ['row'], middle_east: ['row'], mena: ['row'], middle_east_north_africa: ['row'], india: ['row'], southeast_asia: ['row'], sea: ['row'], asean: ['row'], israel: ['row'], africa: ['row'], russia: ['row'], cis: ['row'], turkey: ['row'], row: ['row'], rest_of_world: ['row'], rest_of_the_world: ['row'], rest_of_world_ex_us: ALL_BUT(['us']),
  regional: 'regional', other: 'regional', select_territories: 'regional', certain_territories: 'regional', undisclosed_territories: 'regional',
};

function territoryKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\bex-\s*/g, 'ex_')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const REGION_KEYWORDS: { re: RegExp; region: Territory }[] = [
  { re: /\b(u\.?s\.?a?\.?|united states|north america)\b/i, region: 'us' },
  { re: /\b(e\.?u\.?|europe|european|emea|u\.?k\.?|united kingdom|germany|france|italy|spain|switzerland|nordics|benelux)\b/i, region: 'eu' },
  { re: /\bjapan\b/i, region: 'japan' },
  { re: /\b(china|chinese|prc|hong kong|hk|macau|macao|taiwan)\b/i, region: 'china' },
  { re: /\b(korea|canada|australia|new zealand|latin america|latam|south america|brazil|mexico|middle east|mena|india|southeast asia|asean|israel|africa|russia|cis|turkey|rest of (?:the )?world|row|asia|apac|caribbean|countries|markets)\b/i, region: 'row' },
];

function regionsInText(text: string): Territory[] {
  const found = new Set<Territory>();
  for (const { re, region } of REGION_KEYWORDS) if (re.test(text)) found.add(region);
  return TERRITORIES.filter(t => found.has(t));
}

const GLOBAL_RE = /\b(global|worldwide|world-?wide|all territories|all countries)\b/i;
const EXCLUSION_RE = /\b(?:ex|excluding|except|excl\.?|outside(?: of)?|other than|minus)\b[-\s:]*(.+)$/i;

/**
 * Map one raw territory label to a scope. Exact vocabulary values hit the
 * table ('worldwide', 'us_only', 'ex-US', 'Greater China'); free text from
 * the extractor is parsed: 'global (ex-China)' and 'global excluding Japan'
 * become all-but, 'outside Greater China' becomes all-but, and anything else
 * naming a recognisable region becomes that region set.
 */
export function territoryScopeFromLabel(raw: string | null | undefined): TerritoryScope {
  if (!raw || !raw.trim()) return { scope: 'unknown' };
  const key = territoryKey(raw);
  const mapped = TERRITORY_LABELS[key] ?? TERRITORY_LABELS[key.replace(/_only$/, '')];
  if (mapped === 'global') return { scope: 'global' };
  if (mapped === 'regional') return { scope: 'regional_unknown' };
  if (mapped) return { scope: 'regions', regions: [...mapped] };
  if (key === 'unknown' || key === 'undisclosed' || key === 'not_disclosed' || key === 'n_a' || key === 'na') return { scope: 'unknown' };

  const text = raw.replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  const exclusion = text.match(EXCLUSION_RE);
  if (GLOBAL_RE.test(text)) {
    if (!exclusion) return { scope: 'global' };
    const excluded = regionsInText(exclusion[1]);
    // 'global excluding <indication carve-out>' is still a worldwide grant
    if (excluded.length === 0) return { scope: 'global' };
    const regions = ALL_BUT(excluded);
    return regions.length === 0 ? { scope: 'regional_unknown' } : { scope: 'regions', regions };
  }
  if (exclusion && /^\s*(?:ex|excluding|except|excl\.?|outside|other than|minus)\b/i.test(text)) {
    const excluded = regionsInText(exclusion[1]);
    if (excluded.length > 0) {
      const regions = ALL_BUT(excluded);
      return regions.length === 0 ? { scope: 'regional_unknown' } : { scope: 'regions', regions };
    }
  }
  const regions = regionsInText(text);
  if (regions.length > 0) return { scope: 'regions', regions };
  // Unrecognised country / region name: a real grant somewhere, region unknown
  return { scope: 'regional_unknown' };
}

/**
 * Territories granted by one deal: the union of `territory` and every
 * `territories_included` entry. Acquisitions grant everything.
 */
export function dealTerritoryScope(deal: Pick<PartnershipDeal, 'territory' | 'territories_included' | 'deal_type'>): TerritoryScope {
  if ((deal.deal_type || '').toLowerCase() === 'acquisition') return { scope: 'global' };
  const labels = [deal.territory, ...(deal.territories_included ?? [])].filter((l): l is string => !!l && l.trim().length > 0);
  if (labels.length === 0) return { scope: 'unknown' };
  const regions = new Set<Territory>();
  let sawRegionalUnknown = false;
  let sawKnown = false;
  for (const label of labels) {
    const s = territoryScopeFromLabel(label);
    if (s.scope === 'global') return { scope: 'global' };
    if (s.scope === 'regions') { sawKnown = true; s.regions.forEach(r => regions.add(r)); }
    else if (s.scope === 'regional_unknown') sawRegionalUnknown = true;
  }
  if (sawKnown) return { scope: 'regions', regions: TERRITORIES.filter(t => regions.has(t)) };
  if (sawRegionalUnknown) return { scope: 'regional_unknown' };
  return { scope: 'unknown' };
}

/**
 * granted -> { status, granted, available }. `available` is `['global']` when
 * nothing is granted and `[]` when everything is.
 */
export function territoryAlgebra(granted: Iterable<Territory>): {
  coverage: 'none' | 'partial' | 'full';
  granted: Territory[];
  available: string[];
} {
  const set = new Set<Territory>();
  for (const g of granted) if ((TERRITORIES as readonly string[]).includes(g)) set.add(g);
  const grantedList = TERRITORIES.filter(t => set.has(t));
  const availableList = TERRITORIES.filter(t => !set.has(t));
  if (grantedList.length === 0) return { coverage: 'none', granted: [], available: ['global'] };
  if (availableList.length === 0) return { coverage: 'full', granted: grantedList, available: [] };
  return { coverage: 'partial', granted: grantedList, available: availableList };
}

// ═══════════════════════════════════════════════════════════════════════
// DEAL ELIGIBILITY
// ═══════════════════════════════════════════════════════════════════════

const INACTIVE_DEAL_STATUSES = new Set(['terminated', 'expired']);

/** rejected/flagged, synthetic or non-canonical deals never count. */
export function isEligibleDeal(deal: PartnershipDeal): boolean {
  const vs = (deal.verification_status || '').toLowerCase();
  if (vs === 'rejected' || vs === 'flagged') return false;
  if (deal.is_synthetic === true) return false;
  if (deal.is_canonical === false) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// PRESS-RELEASE PARSING
// ═══════════════════════════════════════════════════════════════════════

export const LICENSING_PHRASES = [
  'exclusive license', 'exclusive licence', 'exclusive worldwide license', 'exclusive global license',
  'licensing agreement', 'license agreement', 'licence agreement', 'licensing deal',
  'collaboration and license', 'collaboration and licensing', 'collaboration & license',
  'option to license', 'option agreement', 'exclusive option',
  'to acquire', 'acquires', 'acquisition of', 'acquired',
  'global rights', 'worldwide rights', 'exclusive rights', 'commercialization rights', 'commercialisation rights',
  'development and commercialization', 'in-licens', 'out-licens', 'has licensed', 'licenses ', 'licensed ',
];

function containsWord(haystack: string, needle: string): boolean {
  const n = needle.trim();
  if (n.length < 3) return false;
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(n.toLowerCase())}([^a-z0-9]|$)`, 'i');
  return re.test(haystack);
}

/** True when the press text names the asset (by name, alias, or shared code token). */
export function pressMentionsAsset(text: string, assetNames: string[]): boolean {
  const lower = text.toLowerCase();
  for (const name of assetNames) {
    if (!name) continue;
    if (alnum(name).length >= 4 && containsWord(lower, name)) return true;
    for (const code of codeTokens(name)) {
      // match the code with or without a hyphen/space between letters and digits
      const m = code.match(/^([a-z]+)(.+)$/);
      if (!m) continue;
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(m[1])}[-\\s]?${escapeRegExp(m[2])}([^a-z0-9]|$)`, 'i');
      if (re.test(lower)) return true;
    }
  }
  return false;
}

const CAP_WORD = "[A-Z][A-Za-z0-9&.'’-]*";
/** Greedy capitalized phrase: stops at the first lowercase word other than of/and/&/de/for. */
const CAP_PHRASE = `${CAP_WORD}(?:\\s+(?:${CAP_WORD}|of|and|&|de|for))*`;
/** Lazy variant: extends one word at a time until the following verb matches. */
const CAP_PHRASE_LAZY = `${CAP_WORD}(?:\\s+(?:${CAP_WORD}|of|and|&|de|for))*?`;
const PAIR_VERBS = '(?:[Aa]nnounce\\w*|[Ee]nter\\w*|[Ss]ign\\w*|[Ff]orm\\w*|[Ee]xpand\\w*|[Aa]gree\\b|[Aa]gree[sd]\\b|[Ii]nk\\w*|[Uu]nveil\\w*|[Ss]trike\\w*|[Tt]o\\b|[Pp]artner\\w*|[Cc]ollaborate\\w*|[Ee]xtend\\w*|[Jj]oin\\w*|[Ll]aunch\\w*)';
const LEAD_VERBS = '(?:[Ll]icenses|[Ii]n-licenses|[Aa]cquires|[Tt]o [Aa]cquire|[Ss]ecures|[Oo]btains|[Gg]ains|[Ss]igns|[Ee]nters|[Ee]xercises|[Ee]xpands|[Cc]ompletes [Aa]cquisition)';

function cleanCounterparty(raw: string): string {
  return raw
    .replace(/\s+(announce[sd]?|enter(?:s|ed)?|sign(?:s|ed)?|to|for|in|on|with|and|from|its|the)$/i, '')
    .replace(/[\s,.;:'’"-]+$/, '')
    .trim();
}

/**
 * Best-effort counterparty name from a headline. Canonical `companies_mentioned`
 * entries other than the owner win; otherwise headline patterns:
 *   'X and Y announce…', 'Y licenses … from X', 'X … with Y', 'Y to acquire X'.
 */
export function extractCounterparty(
  headline: string,
  ownerNames: string[],
  mentioned: string[] = [],
): string | null {
  const isOwner = (n: string) => ownerNames.some(o => sameCompany(o, n));
  for (const m of mentioned) if (m && !isOwner(m)) return m;

  const h = (headline || '').replace(/\s+/g, ' ').trim();
  if (!h) return null;

  const pair = h.match(new RegExp(`^(${CAP_PHRASE_LAZY})\\s+(?:and|&)\\s+(${CAP_PHRASE_LAZY})\\s+${PAIR_VERBS}`));
  if (pair) {
    for (const p of [pair[1], pair[2]]) {
      const c = cleanCounterparty(p);
      if (c.length >= 3 && !isOwner(c)) return c;
    }
  }

  const leading = h.match(new RegExp(`^(${CAP_PHRASE_LAZY})\\s+${LEAD_VERBS}\\b`));
  if (leading) {
    const c = cleanCounterparty(leading[1]);
    if (c.length >= 3 && !isOwner(c)) return c;
  }

  const prep = new RegExp(`\\b(?:from|with|to|by)\\s+(${CAP_PHRASE})`, 'g');
  for (const m of h.matchAll(prep)) {
    const c = cleanCounterparty(m[1]);
    if (c.length >= 3 && !isOwner(c) && !/^(The|A|An|Its|Global|Worldwide|Exclusive|Phase|FDA|EMA|US|EU)$/i.test(c)) return c;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// PURE DERIVATION
// ═══════════════════════════════════════════════════════════════════════

function isoDateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

function scopeNote(scope: TerritoryScope): string {
  switch (scope.scope) {
    case 'global': return 'worldwide rights';
    case 'regions': return `rights: ${scope.regions.join(', ')}`;
    case 'regional_unknown': return 'regional rights (region undisclosed)';
    default: return 'territory undisclosed';
  }
}

export function derivePartnership(input: DerivePartnershipInput): PartnershipResult {
  const { asset } = input;
  const assetNames = [asset.asset_name, ...(asset.asset_aliases ?? [])].filter(Boolean);
  const ownerNames = companyNamesOf(asset);
  const evidence: PartnershipEvidence[] = [];

  // ── Deals ────────────────────────────────────────────────────────────
  const granted = new Set<Territory>();
  let assumedGlobal = false;
  let regionalUnknown = false;
  let nonExclusiveOnly = false;
  let dealConfirmed = false;
  let bestMatch: NameMatchKind | null = null;
  const activeDealIds: string[] = [];
  let partner: { name: string | null; id: string | null; rank: number; date: string } | null = null;

  for (const deal of input.deals) {
    if (!isEligibleDeal(deal)) continue;
    // The company must be the licensor. In-licensed assets (company is the licensee) are ignored.
    if (isOwningCompany(asset, deal.licensee_id, deal.licensee_name)) continue;
    if (!isOwningCompany(asset, deal.licensor_id, deal.licensor_name)) continue;
    const match = matchAssetName(assetNames, deal.asset_name);
    if (!match) continue;

    const inactive = INACTIVE_DEAL_STATUSES.has((deal.deal_status || '').toLowerCase());
    const scope = dealTerritoryScope(deal);
    const nonExclusive = (deal.exclusivity || '').toLowerCase() === 'non_exclusive';
    const licensee = deal.licensee_name || 'undisclosed partner';

    if (inactive) {
      evidence.push({
        type: 'deal', id: deal.id, url: deal.source_url || undefined, date: isoDateOnly(deal.announced_date),
        note: `${deal.deal_status} deal with ${licensee} (${scopeNote(scope)}); rights reverted`,
      });
      continue;
    }

    dealConfirmed = true;
    activeDealIds.push(deal.id);
    if (!bestMatch || match === 'exact' || (match === 'code' && bestMatch === 'overlap')) bestMatch = match;

    let rank = 0;
    if (nonExclusive) {
      nonExclusiveOnly = true;
      rank = 1;
    } else if (scope.scope === 'global') { granted.clear(); TERRITORIES.forEach(t => granted.add(t)); rank = 5; }
    else if (scope.scope === 'regions') { scope.regions.forEach(t => granted.add(t)); rank = 2 + scope.regions.length / 10; }
    else if (scope.scope === 'regional_unknown') { regionalUnknown = true; rank = 2; }
    else { assumedGlobal = true; rank = 3; }

    evidence.push({
      type: 'deal', id: deal.id, url: deal.source_url || undefined, date: isoDateOnly(deal.announced_date),
      note: `${deal.deal_type || 'deal'} with ${licensee}: ${nonExclusive ? 'non-exclusive, ' : ''}${scopeNote(scope)}${scope.scope === 'unknown' ? ', assumed worldwide' : ''} (asset match: ${match})`,
    });

    const date = deal.announced_date || '';
    if (!partner || rank > partner.rank || (rank === partner.rank && date > partner.date)) {
      partner = { name: deal.licensee_name, id: deal.licensee_id, rank, date };
    }
  }
  // A non-exclusive grant is only "non-exclusive only" when no exclusive grant exists
  if (granted.size > 0 || assumedGlobal || regionalUnknown) nonExclusiveOnly = false;

  // ── Trial collaborators ──────────────────────────────────────────────
  const collaboratorTrials = new Map<string, Set<string>>(); // collaborator -> NCTs
  for (const c of input.trialCollaborators) {
    const name = (c.collaborator_name || '').trim();
    if (!name) continue;
    if (classifyOwnerType(name, c.collaborator_class) !== 'industry') continue;
    if (ownerNames.some(o => sameCompany(o, name))) continue;
    const key = companyKey(name) || name.toLowerCase();
    if (!collaboratorTrials.has(key)) collaboratorTrials.set(key, new Set());
    collaboratorTrials.get(key)!.add(c.nct_id);
  }
  const collaboratorNames = new Map<string, string>();
  for (const c of input.trialCollaborators) {
    const raw = (c.collaborator_name || '').trim();
    const key = companyKey(raw) || raw.toLowerCase();
    if (raw && collaboratorTrials.has(key) && !collaboratorNames.has(key)) collaboratorNames.set(key, raw);
  }
  let collaboratorTrialCount = 0;
  for (const [key, ncts] of collaboratorTrials) {
    const name = collaboratorNames.get(key) || key;
    for (const nct of ncts) {
      collaboratorTrialCount++;
      evidence.push({
        type: 'trial_collaborator', id: nct, url: `https://clinicaltrials.gov/study/${nct}`,
        note: `industry collaborator ${name} on ${nct}`,
      });
    }
  }
  const topCollaborator = [...collaboratorTrials.entries()].sort((a, b) => b[1].size - a[1].size)[0];

  // ── Press releases ───────────────────────────────────────────────────
  let pressCounterparty: string | null = null;
  let pressCounterpartyId: string | null = null;
  let pressHitCount = 0;
  let pressHeadlineHit = false;
  for (const hit of input.pressHits) {
    const headline = hit.headline || '';
    const text = `${headline} ${hit.body_text || ''}`;
    const lower = text.toLowerCase();
    const mentioned = hit.companies_mentioned ?? [];
    const mentionsOwner = mentioned.some(m => ownerNames.some(o => sameCompany(o, m))) ||
      ownerNames.some(o => companyCoreKey(o).length >= 5 && containsWord(lower, o));
    if (!mentionsOwner) continue;
    if (!pressMentionsAsset(text, assetNames)) continue;
    const phrase = LICENSING_PHRASES.find(p => lower.includes(p));
    if (!phrase) continue;

    pressHitCount++;
    if (LICENSING_PHRASES.some(p => headline.toLowerCase().includes(p))) pressHeadlineHit = true;
    const counterparty = extractCounterparty(headline, ownerNames, mentioned);
    if (counterparty && !pressCounterparty) {
      pressCounterparty = counterparty;
      const idx = mentioned.findIndex(m => sameCompany(m, counterparty));
      pressCounterpartyId = idx >= 0 ? (hit.company_ids?.[idx] ?? null) : null;
    }
    evidence.push({
      type: 'press_release', id: hit.id, url: hit.source_url || undefined, date: isoDateOnly(hit.published_at),
      note: `"${headline.slice(0, 160)}" — ${phrase.trim()}${counterparty ? `, counterparty ${counterparty}` : ''}`,
    });
  }

  // ── Status ───────────────────────────────────────────────────────────
  const algebra = territoryAlgebra(granted);
  let status: PartnershipStatus;
  if (dealConfirmed && (algebra.coverage === 'full' || (assumedGlobal && algebra.coverage === 'none' && !regionalUnknown))) {
    status = 'partnered';
  } else if (dealConfirmed || collaboratorTrials.size > 0 || pressHitCount > 0) {
    status = 'partially_partnered';
  } else {
    status = 'unpartnered';
  }

  // ── Confidence ───────────────────────────────────────────────────────
  let confidence: number;
  if (dealConfirmed) {
    confidence = bestMatch === 'overlap' ? 80 : 90;
    if (assumedGlobal && algebra.coverage === 'none') confidence = Math.min(confidence, 65);
    if (regionalUnknown && algebra.coverage === 'none') confidence = Math.min(confidence, 70);
    if (nonExclusiveOnly) confidence = Math.min(confidence, 60);
  } else if (pressHitCount > 0) {
    confidence = 50 + (pressCounterparty ? 10 : 0) + (pressHeadlineHit ? 10 : 0) + Math.min(pressHitCount - 1, 2) * 5;
    confidence = Math.min(confidence, 70);
  } else if (collaboratorTrials.size > 0) {
    confidence = Math.min(60, 40 + (collaboratorTrialCount - 1) * 10);
  } else {
    // Absence of evidence: higher when the company is covered by the deals table at all
    confidence = input.deals.length > 0 ? 55 : 40;
  }

  // ── Partner ──────────────────────────────────────────────────────────
  let partnerCompanyName: string | null = null;
  let partnerCompanyId: string | null = null;
  if (partner) { partnerCompanyName = partner.name; partnerCompanyId = partner.id; }
  else if (pressCounterparty) { partnerCompanyName = pressCounterparty; partnerCompanyId = pressCounterpartyId; }
  else if (topCollaborator) { partnerCompanyName = collaboratorNames.get(topCollaborator[0]) ?? null; }

  const territoriesAvailable =
    status === 'partnered' ? [] :
    algebra.coverage === 'partial' ? algebra.available :
    ['global'];

  return {
    status,
    partnerCompanyName,
    partnerCompanyId,
    territoriesGranted: status === 'partnered' && algebra.coverage !== 'full' ? [...TERRITORIES] : algebra.granted,
    territoriesAvailable,
    evidence,
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    dealIds: activeDealIds,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// RECONCILIATION (never downgrade deal-confirmed status on weaker evidence)
// ═══════════════════════════════════════════════════════════════════════

export interface ExistingPartnership {
  partnership_status: string | null;
  partner_company_name: string | null;
  partner_company_id: string | null;
  territory_rights_available: string[] | null;
  partnership_evidence: PartnershipEvidence[] | null;
  partnership_confidence: number | null;
  deal_ids: string[] | null;
}

const STATUS_RANK: Record<PartnershipStatus, number> = { unpartnered: 0, partially_partnered: 1, partnered: 2 };

function isPartnershipStatus(v: string | null | undefined): v is PartnershipStatus {
  return v === 'unpartnered' || v === 'partially_partnered' || v === 'partnered';
}

/**
 * A row whose stored evidence contains a deal (i.e. confirmed by this module
 * on an earlier run) is never moved below its current status when the new
 * derivation has no deal evidence. Legacy indexer rows carry `deal_ids` but no
 * evidence array; those were substring matches and are re-evaluated strictly
 * (the batch driver feeds their deal_ids back into the candidate set).
 */
export function reconcilePartnership(existing: ExistingPartnership | null | undefined, derived: PartnershipResult): PartnershipResult {
  if (!existing || !isPartnershipStatus(existing.partnership_status)) return derived;
  const existingEvidence = Array.isArray(existing.partnership_evidence) ? existing.partnership_evidence : [];
  const existingDealConfirmed = existingEvidence.some(e => e && e.type === 'deal' && !/rights reverted/.test(e.note || ''));
  const derivedDealConfirmed = derived.dealIds.length > 0;
  if (!existingDealConfirmed || derivedDealConfirmed) return derived;
  if (STATUS_RANK[derived.status] >= STATUS_RANK[existing.partnership_status]) return derived;

  const keptDeals = existingEvidence.filter(e => e.type === 'deal');
  const merged = [...keptDeals, ...derived.evidence.filter(e => e.type !== 'deal')];
  return {
    ...derived,
    status: existing.partnership_status,
    partnerCompanyName: existing.partner_company_name ?? derived.partnerCompanyName,
    partnerCompanyId: existing.partner_company_id ?? derived.partnerCompanyId,
    territoriesAvailable: existing.territory_rights_available ?? derived.territoriesAvailable,
    territoriesGranted: existing.partnership_status === 'partnered' ? [...TERRITORIES] : derived.territoriesGranted,
    evidence: merged,
    confidence: Math.max(derived.confidence, existing.partnership_confidence ?? 0),
    dealIds: (existing.deal_ids ?? []).filter(Boolean),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// BATCH REFRESH (set-based)
// ═══════════════════════════════════════════════════════════════════════

export interface RefreshPartnershipOptions {
  /** Assets per run, oldest partnership_checked_at first. Default 500. */
  limit?: number;
  /** Wall-clock budget. Default 240 s (Vercel maxDuration 300). */
  timeBudgetMs?: number;
  now?: Date;
}

export interface RefreshPartnershipResult {
  processed: number;
  updated: number;
  unchanged: number;
  failed: number;
  /** 'unpartnered→partnered': n */
  transitions: Record<string, number>;
  statusCounts: Record<PartnershipStatus, number>;
  dealsFetched: number;
  collaboratorRowsFetched: number;
  pressHitsFetched: number;
  errors: string[];
  timedOut: boolean;
  durationMs: number;
}

interface AssetRow {
  id: string;
  company_id: string | null;
  company_name: string;
  asset_name: string;
  asset_aliases: string[] | null;
  nct_ids: string[] | null;
  partnership_status: string | null;
  partner_company_name: string | null;
  partner_company_id: string | null;
  territory_rights_available: string[] | null;
  partnership_evidence: PartnershipEvidence[] | null;
  partnership_confidence: number | null;
  deal_ids: string[] | null;
}

interface CompanyRow { id: string; name: string; name_variations: string[] | null }

interface TrialRow {
  nct_id: string;
  company_id: string | null;
  company_name: string;
  collaborator_names: string[] | null;
  lead_sponsor_type: string | null;
}

const ASSET_COLUMNS =
  'id, company_id, company_name, asset_name, asset_aliases, nct_ids, partnership_status, partner_company_name, partner_company_id, territory_rights_available, partnership_evidence, partnership_confidence, deal_ids';

const DEAL_COLUMNS =
  'id, licensor_id, licensor_name, licensee_id, licensee_name, asset_name, territory, territories_included, deal_type, deal_status, exclusivity, announced_date, source_url, verification_status, is_synthetic, is_canonical';

const IN_CHUNK = 200;
const PRESS_LOOKBACK_MONTHS = 36;

function eligibleDealsQuery(supabase: SupabaseClient) {
  // Static filter strings only — never interpolate names into .or()
  return supabase
    .from('deals')
    .select(DEAL_COLUMNS)
    .or('is_synthetic.is.null,is_synthetic.eq.false')
    .or('is_canonical.is.null,is_canonical.eq.true')
    .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")');
}

function sameStringArray(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const x = a ?? [];
  const y = b ?? [];
  if (x.length !== y.length) return false;
  return x.every((v, i) => v === y[i]);
}

export async function refreshPartnershipBatch(
  supabase: SupabaseClient,
  options: RefreshPartnershipOptions = {},
): Promise<RefreshPartnershipResult> {
  const limit = options.limit ?? 500;
  const timeBudgetMs = options.timeBudgetMs ?? 240_000;
  const now = options.now ?? new Date();
  const startedAt = Date.now();
  const errors: string[] = [];
  const transitions: Record<string, number> = {};
  const statusCounts: Record<PartnershipStatus, number> = { unpartnered: 0, partially_partnered: 0, partnered: 0 };
  let processed = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let timedOut = false;
  const outOfTime = () => Date.now() - startedAt > timeBudgetMs;
  const dealsById = new Map<string, PartnershipDeal>();
  const trialRows: TrialRow[] = [];
  const pressRows: PressHit[] = [];
  const done = (): RefreshPartnershipResult => ({
    processed, updated, unchanged, failed, transitions, statusCounts,
    dealsFetched: dealsById.size, collaboratorRowsFetched: trialRows.length, pressHitsFetched: pressRows.length,
    errors, timedOut, durationMs: Date.now() - startedAt,
  });

  // ── 1. Assets, oldest partnership_checked_at first ───────────────────
  const assetsRes = await supabase
    .from('clinical_assets')
    .select(ASSET_COLUMNS)
    .order('partnership_checked_at', { ascending: true, nullsFirst: true })
    .order('id', { ascending: true })
    .limit(limit);
  if (assetsRes.error) {
    errors.push(`clinical_assets read failed: ${assetsRes.error.message}`);
    return done();
  }
  const assets = (assetsRes.data ?? []) as AssetRow[];
  if (assets.length === 0) return done();

  // ── 2. Companies (name variations) ───────────────────────────────────
  const companyById = new Map<string, CompanyRow>();
  const companyByKey = new Map<string, CompanyRow>();
  const companyIds = [...new Set(assets.map(a => a.company_id).filter((id): id is string => !!id))];
  for (const ids of chunk(companyIds, IN_CHUNK)) {
    const res = await supabase.from('companies').select('id, name, name_variations').in('id', ids);
    if (res.error) { errors.push(`companies read failed: ${res.error.message}`); continue; }
    for (const row of (res.data ?? []) as CompanyRow[]) {
      companyById.set(row.id, row);
      for (const n of [row.name, ...(row.name_variations ?? [])]) { const k = companyKey(n); if (k) companyByKey.set(k, row); }
    }
  }
  const orphanNames = [...new Set(assets.filter(a => !a.company_id).map(a => a.company_name))];
  for (const names of chunk(orphanNames, IN_CHUNK)) {
    const res = await supabase.from('companies').select('id, name, name_variations').in('name', names);
    if (res.error) { errors.push(`companies by name read failed: ${res.error.message}`); continue; }
    for (const row of (res.data ?? []) as CompanyRow[]) {
      companyById.set(row.id, row);
      for (const n of [row.name, ...(row.name_variations ?? [])]) { const k = companyKey(n); if (k) companyByKey.set(k, row); }
    }
  }
  const companyFor = (a: AssetRow): CompanyRow | undefined =>
    (a.company_id ? companyById.get(a.company_id) : undefined) ?? companyByKey.get(companyKey(a.company_name));

  const allCompanyNames = new Set<string>();
  const allCompanyIds = new Set<string>(companyIds);
  for (const a of assets) {
    allCompanyNames.add(a.company_name);
    const c = companyFor(a);
    if (c) { allCompanyIds.add(c.id); allCompanyNames.add(c.name); (c.name_variations ?? []).forEach(v => allCompanyNames.add(v)); }
  }

  if (outOfTime()) { timedOut = true; return done(); }

  // ── 3. Candidate deals: by licensor_id, by exact licensor_name, plus legacy deal_ids ──
  for (const ids of chunk([...allCompanyIds], IN_CHUNK)) {
    const res = await eligibleDealsQuery(supabase).in('licensor_id', ids);
    if (res.error) { errors.push(`deals by licensor_id failed: ${res.error.message}`); continue; }
    for (const d of (res.data ?? []) as PartnershipDeal[]) dealsById.set(d.id, d);
  }
  for (const names of chunk([...allCompanyNames].filter(Boolean), IN_CHUNK)) {
    const res = await eligibleDealsQuery(supabase).in('licensor_name', names);
    if (res.error) { errors.push(`deals by licensor_name failed: ${res.error.message}`); continue; }
    for (const d of (res.data ?? []) as PartnershipDeal[]) dealsById.set(d.id, d);
  }
  const legacyDealIds = [...new Set(assets.flatMap(a => a.deal_ids ?? []).filter(Boolean))].filter(id => !dealsById.has(id));
  for (const ids of chunk(legacyDealIds, IN_CHUNK)) {
    const res = await eligibleDealsQuery(supabase).in('id', ids);
    if (res.error) { errors.push(`deals by id failed: ${res.error.message}`); continue; }
    for (const d of (res.data ?? []) as PartnershipDeal[]) dealsById.set(d.id, d);
  }
  const dealsByLicensorId = new Map<string, PartnershipDeal[]>();
  const dealsByLicensorKey = new Map<string, PartnershipDeal[]>();
  for (const d of dealsById.values()) {
    if (d.licensor_id) { if (!dealsByLicensorId.has(d.licensor_id)) dealsByLicensorId.set(d.licensor_id, []); dealsByLicensorId.get(d.licensor_id)!.push(d); }
    const k = companyKey(d.licensor_name);
    if (k) { if (!dealsByLicensorKey.has(k)) dealsByLicensorKey.set(k, []); dealsByLicensorKey.get(k)!.push(d); }
  }

  if (outOfTime()) { timedOut = true; return done(); }

  // ── 4. Trial collaborators for every NCT in the batch ────────────────
  const nctIds = [...new Set(assets.flatMap(a => a.nct_ids ?? []).filter(Boolean))];
  for (const ids of chunk(nctIds, 300)) {
    const res = await supabase
      .from('company_trials')
      .select('nct_id, company_id, company_name, collaborator_names, lead_sponsor_type')
      .in('nct_id', ids);
    if (res.error) { errors.push(`company_trials read failed: ${res.error.message}`); continue; }
    trialRows.push(...((res.data ?? []) as TrialRow[]));
  }
  const trialsByNct = new Map<string, TrialRow[]>();
  for (const t of trialRows) { if (!trialsByNct.has(t.nct_id)) trialsByNct.set(t.nct_id, []); trialsByNct.get(t.nct_id)!.push(t); }

  // ── 4b. Only collaborators that resolve to a known company count ──────
  // On today's universe 2,210 of 5,556 unpartnered assets carry an
  // industry-looking collaborator string, most of them drug-supply
  // partners on combination arms (e.g. Merck supplying Keytruda). Flagging
  // those as partially partnered would be wrong far more often than right,
  // so a collaborator string is evidence only when it is a company we track.
  const rawCollaboratorNames = [...new Set(trialRows.flatMap(t => t.collaborator_names ?? []).filter(Boolean))];
  const knownCollaboratorKeys = new Set<string>();
  for (const names of chunk(rawCollaboratorNames, IN_CHUNK)) {
    const res = await supabase.from('companies').select('id, name, name_variations').in('name', names);
    if (res.error) { errors.push(`collaborator companies read failed: ${res.error.message}`); continue; }
    for (const row of (res.data ?? []) as CompanyRow[]) for (const n of [row.name, ...(row.name_variations ?? [])]) { const k = companyKey(n); if (k) knownCollaboratorKeys.add(k); }
  }

  if (outOfTime()) { timedOut = true; return done(); }

  // ── 5. Press hits (licensing / m&a items mentioning any batch company) ──
  const pressCutoff = new Date(now.getTime());
  pressCutoff.setMonth(pressCutoff.getMonth() - PRESS_LOOKBACK_MONTHS);
  for (const names of chunk([...allCompanyNames].filter(Boolean), 100)) {
    const res = await supabase
      .from('press_releases')
      .select('id, headline, body_text, published_at, source_url, companies_mentioned, company_ids')
      .overlaps('companies_mentioned', pgArrayLiteral(names))
      .overlaps('categories', ['licensing', 'm&a'])
      .gte('published_at', pressCutoff.toISOString())
      .order('published_at', { ascending: false })
      .limit(2000);
    if (res.error) { errors.push(`press_releases read failed: ${res.error.message}`); break; }
    pressRows.push(...((res.data ?? []) as PressHit[]));
  }
  const pressByCompanyKey = new Map<string, PressHit[]>();
  for (const p of pressRows) {
    for (const m of p.companies_mentioned ?? []) {
      const k = companyKey(m);
      if (!k) continue;
      if (!pressByCompanyKey.has(k)) pressByCompanyKey.set(k, []);
      pressByCompanyKey.get(k)!.push(p);
    }
  }

  if (outOfTime()) { timedOut = true; return done(); }

  // ── 6. Derive per asset ──────────────────────────────────────────────
  interface Pending { asset: AssetRow; result: PartnershipResult }
  const pending: Pending[] = [];
  for (const asset of assets) {
    try {
      const company = companyFor(asset);
      const partnershipAsset: PartnershipAsset = {
        id: asset.id,
        company_id: asset.company_id ?? company?.id ?? null,
        company_name: asset.company_name,
        company_name_variations: [company?.name, ...(company?.name_variations ?? [])].filter((n): n is string => !!n),
        asset_name: asset.asset_name,
        asset_aliases: asset.asset_aliases ?? [],
        nct_ids: asset.nct_ids ?? [],
      };
      const ownerNames = companyNamesOf(partnershipAsset);

      const candidateDeals = new Map<string, PartnershipDeal>();
      if (partnershipAsset.company_id) for (const d of dealsByLicensorId.get(partnershipAsset.company_id) ?? []) candidateDeals.set(d.id, d);
      for (const n of ownerNames) for (const d of dealsByLicensorKey.get(companyKey(n)) ?? []) candidateDeals.set(d.id, d);
      for (const id of asset.deal_ids ?? []) { const d = dealsById.get(id); if (d) candidateDeals.set(d.id, d); }

      const collaborators: TrialCollaborator[] = [];
      for (const nct of asset.nct_ids ?? []) {
        for (const t of trialsByNct.get(nct) ?? []) {
          const rowIsOwner = (t.company_id && t.company_id === partnershipAsset.company_id) || ownerNames.some(o => sameCompany(o, t.company_name));
          for (const name of t.collaborator_names ?? []) if (name && knownCollaboratorKeys.has(companyKey(name))) collaborators.push({ nct_id: nct, collaborator_name: name });
          // Another indexed company carries the same NCT: treat it as an industry co-party
          if (!rowIsOwner && t.company_name) collaborators.push({ nct_id: nct, collaborator_name: t.company_name, collaborator_class: t.lead_sponsor_type });
        }
      }

      const hits = new Map<string, PressHit>();
      for (const n of ownerNames) for (const p of pressByCompanyKey.get(companyKey(n)) ?? []) hits.set(p.id, p);

      const derived = derivePartnership({
        asset: partnershipAsset,
        deals: [...candidateDeals.values()],
        trialCollaborators: collaborators,
        pressHits: [...hits.values()],
      });
      pending.push({ asset, result: reconcilePartnership(asset, derived) });
    } catch (err) {
      failed++;
      errors.push(`derive failed for ${asset.company_name}/${asset.asset_name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── 7. Resolve partner ids for press / trial partners (one query) ────
  const unresolved = [...new Set(pending.filter(p => p.result.partnerCompanyName && !p.result.partnerCompanyId).map(p => p.result.partnerCompanyName!))];
  const partnerIdByKey = new Map<string, string>();
  for (const names of chunk(unresolved, IN_CHUNK)) {
    const res = await supabase.from('companies').select('id, name, name_variations').in('name', names);
    if (res.error) { errors.push(`partner companies read failed: ${res.error.message}`); continue; }
    for (const row of (res.data ?? []) as CompanyRow[]) for (const n of [row.name, ...(row.name_variations ?? [])]) { const k = companyKey(n); if (k) partnerIdByKey.set(k, row.id); }
  }
  for (const p of pending) {
    if (p.result.partnerCompanyName && !p.result.partnerCompanyId) {
      const id = partnerIdByKey.get(companyKey(p.result.partnerCompanyName));
      if (id) p.result.partnerCompanyId = id;
    }
  }

  // ── 8. Write ─────────────────────────────────────────────────────────
  const nowIso = now.toISOString();
  await mapConcurrent(pending, 8, async ({ asset, result }) => {
    if (outOfTime()) { timedOut = true; return; }
    const from = asset.partnership_status ?? 'unknown';
    const to = result.status;
    const changed =
      from !== to ||
      (asset.partner_company_name ?? null) !== result.partnerCompanyName ||
      (asset.partner_company_id ?? null) !== result.partnerCompanyId ||
      !sameStringArray(asset.territory_rights_available, result.territoriesAvailable) ||
      !sameStringArray(asset.deal_ids, result.dealIds) ||
      (asset.partnership_confidence ?? -1) !== result.confidence ||
      JSON.stringify(asset.partnership_evidence ?? []) !== JSON.stringify(result.evidence);

    const payload: Record<string, unknown> = {
      partnership_status: result.status,
      partner_company_name: result.partnerCompanyName,
      partner_company_id: result.partnerCompanyId,
      territory_rights_available: result.territoriesAvailable,
      deal_id: result.dealIds[0] ?? null,
      deal_ids: result.dealIds,
      partnership_evidence: result.evidence,
      partnership_confidence: result.confidence,
      partnership_checked_at: nowIso,
    };
    const { error } = await supabase.from('clinical_assets').update(payload).eq('id', asset.id);
    if (error) {
      failed++;
      errors.push(`update failed for ${asset.company_name}/${asset.asset_name}: ${error.message}`);
      return;
    }
    processed++;
    statusCounts[to]++;
    if (changed) updated++; else unchanged++;
    if (from !== to) {
      const key = `${from}→${to}`;
      transitions[key] = (transitions[key] ?? 0) + 1;
    }
  });

  return done();
}
