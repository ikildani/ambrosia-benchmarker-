/**
 * Sponsor-agnostic ClinicalTrials.gov sweep (Asset Radar Phase 2, item 1).
 *
 * The per-company ingester (lib/ingestion/clinical-trials.ts) only crawls
 * companies flagged actively_acquiring — a buyer list — so the asset universe
 * never contained sellers. This module walks EVERY interventional
 * drug/biologic/genetic/combination-product study on CT.gov in
 * LastUpdatePostDate order, regardless of sponsor, and:
 *
 *   1. resolves the lead sponsor to a companies row (sponsor_aliases →
 *      companies.name / name_variations → create), CROs never own assets;
 *   2. upserts company_trials with the same field mapping the existing
 *      ingester uses (its helpers are imported, not copied);
 *   3. writes one trial_interventions row per intervention with its arm role
 *      so comparator / background arms do not become assets;
 *   4. persists its position in radar_sync_cursors (source 'ctgov_sweep') as
 *      the last LastUpdatePostDate fully processed plus the in-flight page
 *      token, so time-boxed Vercel runs resume exactly where they stopped.
 *
 * The existing asset-universe indexer then picks the new companies up through
 * radar_companies_to_index() unchanged.
 *
 * Throughput: pageSize 1000, one request per ~1.5 s plus DB writes, so a
 * 250 s run covers roughly 25–40 pages (25k–40k studies). The ~200k-study
 * backfill takes 6–8 runs; the daily incremental (≈500–1,500 updated drug
 * studies/day) is one or two pages.
 */

import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DRUG_STUDY_FILTER,
  DRUG_INTERVENTION_TYPES,
  pickPrimaryIntervention,
  inferModalityFromIntervention,
  inferIndicationFromConditions,
  mapPhase,
  mapStatus,
  normalizeDate,
} from '@/lib/ingestion/clinical-trials';
import { classifyCompanyCountry, deriveRegion } from '@/lib/ingestion/company-geography';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

export const CT_API_V2 = 'https://clinicaltrials.gov/api/v2/studies';
export const SWEEP_SOURCE = 'ctgov_sweep';
export const SWEEP_EPOCH = '2000-01-01';

export const DEFAULT_PAGE_SIZE = 1000;
export const MAX_PAGE_SIZE = 1000;
export const REQUEST_INTERVAL_MS = 1_500;
export const DEFAULT_TIME_BUDGET_MS = 250_000;
/** Do not start a new page when fewer than this many ms remain in the budget. */
const PAGE_RESERVE_MS = 20_000;
const DEFAULT_MAX_PAGES = 400;
const UPSERT_CHUNK = 500;
/** PostgREST `in` filters go in the URL; keep each lookup list short. */
const LOOKUP_CHUNK = 100;

/**
 * CT.gov v2 piece names fetched per study — only what is stored. Arms are
 * needed for arm_role; MeSH terms are one extra list per study and feed the
 * indication classifier.
 */
export const SWEEP_FIELDS = [
  'NCTId', 'BriefTitle', 'Acronym', 'BriefSummary',
  'LeadSponsorName', 'LeadSponsorClass', 'CollaboratorName', 'CollaboratorClass',
  'StudyType', 'Phase', 'OverallStatus', 'WhyStopped',
  'StartDate', 'PrimaryCompletionDate', 'CompletionDate', 'StudyFirstPostDate',
  'LastUpdatePostDate', 'ResultsFirstPostDate', 'EnrollmentCount',
  'Condition', 'ConditionMeshTerm',
  'InterventionName', 'InterventionType', 'InterventionDescription', 'InterventionOtherName',
  'InterventionArmGroupLabel',
  'ArmGroupLabel', 'ArmGroupType', 'ArmGroupInterventionName',
  'LocationCountry',
  'PrimaryOutcomeMeasure', 'PrimaryOutcomeDescription', 'PrimaryOutcomeTimeFrame',
  'SecondaryOutcomeMeasure',
] as const;

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type OwnerType = 'industry' | 'academic' | 'government' | 'hospital' | 'network' | 'cro' | 'other' | 'unknown';
export type ArmRole = 'experimental' | 'active_comparator' | 'placebo_comparator' | 'sham' | 'no_intervention' | 'other' | 'unknown';
export type AliasRelationship = 'self' | 'subsidiary' | 'former_name' | 'cro' | 'academic' | 'government' | 'hospital' | 'unknown';

export interface ParsedIntervention {
  name: string;
  nameNormalized: string;
  type: string;
  description: string | null;
  otherNames: string[];
  armRole: ArmRole;
  /** Every arm role the intervention appears under (an intervention can sit in several arms). */
  armRoles: ArmRole[];
  isPrimaryAsset: boolean;
}

export interface ParsedStudy {
  nctId: string;
  title: string;
  acronym: string | null;
  briefSummary: string | null;
  leadSponsorName: string;
  leadSponsorClass: string;
  collaborators: Array<{ name: string; class: string }>;
  studyType: string | null;
  phase: string;
  status: string;
  whyStopped: string | null;
  conditions: string[];
  meshTerms: string[];
  interventions: ParsedIntervention[];
  hasArmGroups: boolean;
  startDate: string | null;
  primaryCompletionDate: string | null;
  completionDate: string | null;
  firstPostedDate: string | null;
  lastUpdatePosted: string | null;
  enrollmentCount: number | null;
  /** Distinct location countries in first-seen order (CT.gov full names). */
  locationCountries: string[];
  hasResults: boolean;
  primaryOutcomes: Array<{ measure: string; description: string | null; timeFrame: string | null }>;
  secondaryOutcomes: string[];
}

export interface SweepCursorState {
  /** LastUpdatePostDate lower bound the in-flight page token belongs to. */
  query_from?: string;
  /** CT.gov nextPageToken to resume with (same query_from), null when caught up. */
  page_token?: string | null;
  /** Set once a run reaches the last page — the backfill is complete. */
  caught_up?: boolean;
  /** Last NCT id written, for operators reading the cursor table. */
  last_nct?: string;
  /** CT.gov totalCount for the query at the start of the last run. */
  total_count?: number;
  [key: string]: unknown;
}

export interface SweepOptions {
  /** Reset the cursor to SWEEP_EPOCH and start over. */
  full?: boolean;
  /** Max pages this run (route ?chunk=). */
  maxPages?: number;
  /** Studies per page, 1..1000 (route ?limit=). */
  pageSize?: number;
  /** Wall-clock budget for the run (default 250 s of the 300 s maxDuration). */
  timeBudgetMs?: number;
  runType?: 'scheduled' | 'manual' | 'backfill';
  /** Injectable clock for tests. */
  now?: () => number;
}

export interface SweepResult {
  pagesFetched: number;
  studiesFetched: number;
  trialsUpserted: number;
  orphanTrials: number;
  croLedTrials: number;
  interventionsUpserted: number;
  primaryInterventions: number;
  sponsorsSeen: number;
  sponsorsResolved: number;
  companiesMatched: number;
  companiesCreated: number;
  cursorBefore: string | null;
  cursorAfter: string | null;
  pageTokenAfter: string | null;
  caughtUp: boolean;
  totalCount: number | null;
  timedOut: boolean;
  errors: string[];
  logged: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// SPONSOR NAME NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════

/** Trailing corporate-form tokens stripped from normalized sponsor names. */
const CORPORATE_SUFFIX_TOKENS = new Set([
  'inc', 'incorporated', 'ltd', 'limited', 'llc', 'lp', 'llp', 'plc', 'ag', 'sa', 'sas', 'se',
  'nv', 'bv', 'gmbh', 'co', 'corp', 'corporation', 'company', 'kk', 'pty', 'ab', 'oy', 'oyj',
  'as', 'asa', 'aps', 'spa', 'srl', 'sarl', 'pte', 'sdn', 'bhd', 'kg', 'mbh', 'ug', 'gk',
  'sac', 'sl', 'lda', 'ltda', 'zrt', 'doo', 'sp', 'zoo', 'ooo', 'ehf',
]);

const TOKEN_REPLACEMENTS: Array<[RegExp, string]> = [
  [/^(bio)?pharmaceuticals?$/, '$1pharma'],
  [/^laborator(y|ies)$/, 'labs'],
  [/^laboratoires?$/, 'labs'],
];

/**
 * Canonical key for a sponsor string: lower-case, ASCII-folded, punctuation
 * removed, "&" → "and", corporate suffixes stripped from the end
 * (repeatedly, so "Co., Ltd." and "Pharmaceuticals, Inc." both go),
 * pharmaceutical(s) → pharma, leading "the" dropped.
 */
export function normalizeSponsorName(name: string): string {
  if (!name) return '';
  let s = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\ba\/s\b/g, ' as ') // Danish/Norwegian "A/S"
    .replace(/[.'’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!s) return '';
  let tokens = s.split(' ').filter(Boolean);
  if (tokens[0] === 'the') tokens = tokens.slice(1);
  // Strip corporate-form tokens from the end, but never the whole name.
  while (tokens.length > 1 && CORPORATE_SUFFIX_TOKENS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  tokens = tokens.map(t => {
    for (const [re, rep] of TOKEN_REPLACEMENTS) {
      if (re.test(t)) return t.replace(re, rep);
    }
    return t;
  });
  s = tokens.join(' ');
  return s;
}

/**
 * Candidate strings to look up against companies.name / name_variations
 * (case-insensitive exact match): the verbatim sponsor name plus the name
 * with trailing corporate suffixes removed ("Pfizer Inc." → "Pfizer").
 */
export function buildCompanyLookupNames(name: string): string[] {
  const out: string[] = [];
  const push = (v: string) => {
    const t = v.trim();
    if (t && !out.some(o => o.toLowerCase() === t.toLowerCase())) out.push(t);
  };
  push(name);
  let stripped = name.trim();
  const suffixRe = /[\s,]+(inc|incorporated|ltd|limited|llc|lp|llp|plc|ag|sa|sas|se|nv|bv|gmbh|co|corp|corporation|company|kk|k\.k|pty|ab|oy|a\/s|spa|s\.p\.a|srl|sarl|pte|sdn|bhd)\.?\s*$/i;
  for (let i = 0; i < 3; i++) {
    const next = stripped.replace(suffixRe, '').replace(/[,\s]+$/, '');
    if (next === stripped) break;
    stripped = next;
    push(stripped);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// CRO DETECTION + OWNER TYPE
// ═══════════════════════════════════════════════════════════════════════

/** Matched against normalizeSponsorName() output. CROs never own assets. */
const CRO_PATTERNS: RegExp[] = [
  /\biqvia\b/, /\bquintiles\b/, /\bparexel\b/, /\bppd\b/, /\bpharmaceutical product development\b/,
  /\bsyneos\b/, /\binc research\b/, /\binventiv health\b/, /\bmedpace\b/,
  /^icon$/, /\bicon (clinical|plc|research|government|early)/, /\blabcorp\b/, /\bcovance\b/,
  /\btigermed\b/, /\bcharles river\b/, /\bfortrea\b/, /\bwuxi\b/, /\bnovotech\b/,
  /\bpra health\b/, /\bpra international\b/, /\bpremier research\b/, /\bworldwide clinical trials\b/,
  /\bclinipace\b/, /\bcelerion\b/, /\bchiltern\b/, /\bpharm olam\b/, /\bveristat\b/,
  /\bgeorge clinical\b/, /\blinical\b/, /\bcmic\b/, /\beps holdings\b/, /\bcaidya\b/,
  /\bcromos pharma\b/, /\bclinical research organi[sz]ation\b/, /\bcontract research organi[sz]ation\b/,
  /\bcro\b/,
];

export function isCroSponsor(name: string): boolean {
  const n = normalizeSponsorName(name);
  if (!n) return false;
  return CRO_PATTERNS.some(re => re.test(n));
}

const HOSPITAL_RE = /\b(hospital|hospitals|hopital|hopitaux|hospices|clinic|clinics|clinique|clinica|medical cent(er|re)|health system|health network|infirmary|nhs|klinik|klinikum|ospedale|sjukhus|ziekenhuis|cancer cent(er|re)|assistance publique|charite|policlinico|krankenhaus)\b/;
const ACADEMIC_RE = /\b(university|universite|universidad|universita|universitat|universiteit|universitas|college|school of medicine|medical school|academy|faculty|polytechnic|institut|institute|instituto|istituto|research cent(er|re)|graduate school)\b/;
const GOVERNMENT_RE = /\b(ministry|national institutes?|department of|government|public health|centers for disease|veterans affairs|health authority|agency|national health|federal|state of|province|municipal|army|navy|air force|military)\b/;
const NETWORK_RE = /\b(group|network|consortium|alliance|cooperative|foundation|society|association|trust|fund|charity|federation|organization|organisation|initiative|coalition|council)\b/;
const INDUSTRY_NAME_RE = /\b(pharma|biopharma|therapeutics|biotech|biotechnology|biosciences|bioscience|biologics|biomedical|medicines|oncology|genomics|labs|technologies|lifesciences|life sciences|holdings|healthcare|biomed|medical|diagnostics|biopharmaceutics|vaccines|genetics)\b/;

/**
 * Owner type for a sponsor from its CT.gov LeadSponsorClass, with name
 * heuristics for OTHER / INDIV / AMBIG. CRO detection wins over the class
 * (IQVIA registers as INDUSTRY).
 */
export function deriveOwnerType(name: string, leadSponsorClass: string | null | undefined): OwnerType {
  if (isCroSponsor(name)) return 'cro';
  const cls = (leadSponsorClass || '').toUpperCase().trim();
  if (cls === 'INDUSTRY') return 'industry';
  if (cls === 'NIH' || cls === 'FED' || cls === 'OTHER_GOV') return 'government';
  if (cls === 'NETWORK') return 'network';
  const n = normalizeSponsorName(name);
  if (!n) return cls ? 'other' : 'unknown';
  if (HOSPITAL_RE.test(n)) return 'hospital';
  if (ACADEMIC_RE.test(n)) return 'academic';
  if (GOVERNMENT_RE.test(n)) return 'government';
  if (NETWORK_RE.test(n)) return 'network';
  if (INDUSTRY_NAME_RE.test(n)) return 'industry';
  if (cls === 'INDIV') return 'other';
  return cls ? 'other' : 'unknown';
}

export function relationshipForOwnerType(ownerType: OwnerType): AliasRelationship {
  switch (ownerType) {
    case 'industry': return 'self';
    case 'cro': return 'cro';
    case 'academic': return 'academic';
    case 'government': return 'government';
    case 'hospital': return 'hospital';
    default: return 'unknown';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// GEOGRAPHY
// ═══════════════════════════════════════════════════════════════════════

/** CT.gov location country names → ISO 3166-1 alpha-2. */
export const CTGOV_COUNTRY_TO_ISO: Record<string, string> = {
  'united states': 'US', 'canada': 'CA', 'mexico': 'MX', 'puerto rico': 'US',
  'united kingdom': 'GB', 'germany': 'DE', 'france': 'FR', 'switzerland': 'CH', 'netherlands': 'NL',
  'belgium': 'BE', 'denmark': 'DK', 'sweden': 'SE', 'norway': 'NO', 'finland': 'FI', 'ireland': 'IE',
  'italy': 'IT', 'spain': 'ES', 'austria': 'AT', 'portugal': 'PT', 'luxembourg': 'LU', 'iceland': 'IS',
  'czechia': 'CZ', 'czech republic': 'CZ', 'poland': 'PL', 'hungary': 'HU', 'greece': 'GR',
  'romania': 'RO', 'bulgaria': 'BG', 'croatia': 'HR', 'slovenia': 'SI', 'slovakia': 'SK',
  'lithuania': 'LT', 'latvia': 'LV', 'estonia': 'EE', 'serbia': 'RS', 'ukraine': 'UA',
  'russian federation': 'RU', 'russia': 'RU', 'belarus': 'BY', 'georgia': 'GE', 'cyprus': 'CY', 'malta': 'MT',
  'china': 'CN', 'hong kong': 'HK', 'macau': 'MO', 'macao': 'MO', 'taiwan': 'TW', 'japan': 'JP',
  'korea, republic of': 'KR', 'south korea': 'KR', 'korea': 'KR',
  'india': 'IN', 'singapore': 'SG', 'malaysia': 'MY', 'thailand': 'TH', 'indonesia': 'ID',
  'philippines': 'PH', 'vietnam': 'VN', 'viet nam': 'VN', 'pakistan': 'PK', 'bangladesh': 'BD',
  'sri lanka': 'LK', 'nepal': 'NP', 'australia': 'AU', 'new zealand': 'NZ',
  'israel': 'IL', 'turkey': 'TR', 'türkiye': 'TR', 'turkiye': 'TR', 'turkey (türkiye)': 'TR', 'iran, islamic republic of': 'IR', 'iran': 'IR',
  'saudi arabia': 'SA', 'united arab emirates': 'AE', 'qatar': 'QA', 'kuwait': 'KW', 'bahrain': 'BH',
  'oman': 'OM', 'jordan': 'JO', 'lebanon': 'LB', 'iraq': 'IQ',
  'egypt': 'EG', 'south africa': 'ZA', 'nigeria': 'NG', 'kenya': 'KE', 'morocco': 'MA', 'tunisia': 'TN',
  'algeria': 'DZ', 'ghana': 'GH', 'uganda': 'UG', 'tanzania': 'TZ', 'ethiopia': 'ET', 'zambia': 'ZM',
  'zimbabwe': 'ZW', 'malawi': 'MW', 'mozambique': 'MZ', 'senegal': 'SN', 'cameroon': 'CM',
  'brazil': 'BR', 'argentina': 'AR', 'chile': 'CL', 'colombia': 'CO', 'peru': 'PE', 'uruguay': 'UY',
  'venezuela': 'VE', 'ecuador': 'EC', 'guatemala': 'GT', 'panama': 'PA', 'costa rica': 'CR',
  'dominican republic': 'DO', 'cuba': 'CU', 'bolivia': 'BO', 'paraguay': 'PY',
};

export function ctgovCountryToIso(country: string | null | undefined): string | null {
  if (!country) return null;
  const t = country.trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase() === 'UK' ? 'GB' : t.toUpperCase();
  return CTGOV_COUNTRY_TO_ISO[t.toLowerCase()] ?? null;
}

/** Most frequent country across a study's locations (first-seen wins ties). */
export function dominantLocationCountry(countries: string[]): string | null {
  if (countries.length === 0) return null;
  const counts = new Map<string, number>();
  for (const c of countries) counts.set(c, (counts.get(c) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [c, n] of counts) {
    if (n > bestN) { best = c; bestN = n; }
  }
  return best;
}

/**
 * Headquarters for a new company row: the name classifier when it is
 * confident, else the trial's dominant location country. Returns ISO-2 +
 * region slug (lib/ingestion/company-geography.ts vocabulary).
 */
export function resolveSponsorGeography(
  name: string,
  locationCountries: string[],
): { country: string | null; region: string | null; source: 'name' | 'location' | null } {
  const geo = classifyCompanyCountry(name);
  if (geo.country !== 'unknown' && geo.confidence !== 'low') {
    return { country: geo.country, region: geo.region !== 'unknown' ? geo.region : null, source: 'name' };
  }
  const loc = ctgovCountryToIso(dominantLocationCountry(locationCountries));
  if (loc) {
    const region = deriveRegion(loc);
    return { country: loc, region: region !== 'unknown' ? region : null, source: 'location' };
  }
  return { country: null, region: null, source: null };
}

// ═══════════════════════════════════════════════════════════════════════
// INTERVENTIONS + ARM ROLES
// ═══════════════════════════════════════════════════════════════════════

const ARM_ROLE_BY_TYPE: Record<string, ArmRole> = {
  EXPERIMENTAL: 'experimental',
  ACTIVE_COMPARATOR: 'active_comparator',
  PLACEBO_COMPARATOR: 'placebo_comparator',
  SHAM_COMPARATOR: 'sham',
  NO_INTERVENTION: 'no_intervention',
  OTHER: 'other',
};

/** Strongest role first — an intervention in several arms takes the strongest. */
const ARM_ROLE_STRENGTH: ArmRole[] = [
  'experimental', 'active_comparator', 'placebo_comparator', 'sham', 'no_intervention', 'other', 'unknown',
];

export function mapArmRole(armType: string | null | undefined): ArmRole {
  if (!armType) return 'unknown';
  const key = armType.toUpperCase().trim().replace(/[\s-]+/g, '_');
  return ARM_ROLE_BY_TYPE[key] ?? 'unknown';
}

export function strongestArmRole(roles: Iterable<ArmRole>): ArmRole {
  const set = new Set(roles);
  for (const r of ARM_ROLE_STRENGTH) if (set.has(r)) return r;
  return 'unknown';
}

/** Key for trial_interventions.name_normalized and for arm-name matching. */
export function normalizeInterventionName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** armGroups[].interventionNames entries look like "Drug: Pembrolizumab". */
export function interventionNameFromArmRef(ref: string): string {
  const idx = ref.indexOf(':');
  if (idx < 0) return ref.trim();
  const prefix = ref.slice(0, idx).trim().toLowerCase();
  const known = ['drug', 'biological', 'genetic', 'combination product', 'device', 'procedure',
    'behavioral', 'dietary supplement', 'radiation', 'diagnostic test', 'other'];
  return known.includes(prefix) ? ref.slice(idx + 1).trim() : ref.trim();
}

export function isDrugType(type: string | null | undefined): boolean {
  if (!type) return false;
  const drugTypes: readonly string[] = DRUG_INTERVENTION_TYPES;
  return drugTypes.includes(type.toUpperCase().trim().replace(/\s+/g, '_'));
}

const PLACEBO_LIKE_RE = /\b(placebo|vehicle|saline|sham|standard of care|best supportive care|usual care|no treatment|observation|dummy|matching)\b/i;

export function isPlaceboLikeName(name: string): boolean {
  return PLACEBO_LIKE_RE.test(name || '');
}

/**
 * Approved backbone / comparator drugs that show up in other sponsors'
 * combination trials. When one of these sits in an experimental arm next
 * to another experimental drug, it is the background, not the asset.
 * TODO(drug-master): replace with originator lookup once the drug master
 * entity (Phase 2 item 3) records originators; a Merck-sponsored
 * pembrolizumab monotherapy trial is correctly primary today only because
 * the count rule below keeps single-drug arms.
 */
const BACKGROUND_COMPARATOR_NAMES = new Set([
  'pembrolizumab', 'keytruda', 'nivolumab', 'opdivo', 'atezolizumab', 'tecentriq', 'durvalumab', 'imfinzi',
  'ipilimumab', 'yervoy', 'avelumab', 'cemiplimab', 'dostarlimab', 'tislelizumab', 'toripalimab', 'sintilimab',
  'camrelizumab', 'trastuzumab', 'herceptin', 'bevacizumab', 'avastin', 'rituximab', 'rituxan', 'cetuximab',
  'panitumumab', 'daratumumab', 'obinutuzumab', 'ramucirumab', 'pertuzumab',
  'carboplatin', 'cisplatin', 'oxaliplatin', 'paclitaxel', 'nab paclitaxel', 'docetaxel', 'gemcitabine',
  'pemetrexed', 'cyclophosphamide', 'fludarabine', 'bendamustine', 'doxorubicin', 'epirubicin', 'etoposide',
  'irinotecan', 'topotecan', 'temozolomide', 'capecitabine', '5 fluorouracil', 'fluorouracil', 'leucovorin',
  'folfox', 'folfiri', 'folfirinox', 'cytarabine', 'azacitidine', 'decitabine', 'vincristine', 'vinorelbine',
  'methotrexate', 'dexamethasone', 'prednisone', 'prednisolone', 'methylprednisolone', 'hydrocortisone',
  'lenalidomide', 'pomalidomide', 'bortezomib', 'carfilzomib', 'thalidomide', 'venetoclax', 'ibrutinib',
  'tamoxifen', 'letrozole', 'anastrozole', 'exemestane', 'fulvestrant', 'enzalutamide', 'abiraterone',
  'goserelin', 'leuprolide', 'degarelix', 'androgen deprivation therapy',
  'metformin', 'insulin', 'insulin glargine', 'aspirin', 'heparin', 'enoxaparin', 'warfarin', 'atorvastatin',
  'rosuvastatin', 'lidocaine', 'bupivacaine', 'ropivacaine', 'propofol', 'fentanyl', 'morphine', 'ketamine',
  'midazolam', 'ondansetron', 'acetaminophen', 'paracetamol', 'ibuprofen', 'tacrolimus', 'mycophenolate',
  'cyclosporine', 'sirolimus', 'antithymocyte globulin', 'busulfan', 'melphalan', 'filgrastim',
  'granulocyte colony stimulating factor', 'g csf', 'interleukin 2', 'aldesleukin', 'interferon alfa',
  'omeprazole', 'pantoprazole', 'amoxicillin', 'vancomycin', 'ceftriaxone', 'meropenem', 'piperacillin tazobactam',
  'hydroxychloroquine', 'azithromycin', 'remdesivir', 'oseltamivir', 'tenofovir', 'emtricitabine',
  'dolutegravir', 'lamivudine', 'efavirenz', 'rifampicin', 'isoniazid',
]);

export function isBackgroundComparatorName(name: string): boolean {
  const n = normalizeInterventionName(name);
  if (!n) return false;
  if (BACKGROUND_COMPARATOR_NAMES.has(n)) return true;
  // "Pembrolizumab (MK-3475)", "Carboplatin AUC5", "Paclitaxel 80 mg/m2"
  const head = n.split(' ').slice(0, 2).join(' ');
  return BACKGROUND_COMPARATOR_NAMES.has(head) || BACKGROUND_COMPARATOR_NAMES.has(n.split(' ')[0]);
}

export interface PrimaryAssetContext {
  /** Drug-class interventions sitting in an experimental arm (or unknown arm on a study without arm groups). */
  experimentalDrugCount: number;
  hasArmGroups: boolean;
}

/**
 * Is this intervention the sponsor's asset?
 *   drug-class type
 *   AND experimental arm (or no arm groups on the record at all)
 *   AND not placebo / vehicle / SOC
 *   AND not in BOTH an experimental and a comparator arm (a backbone)
 *   AND not a known approved backbone when the arm has other experimental drugs.
 * TODO(drug-master): use originator ownership instead of the name list.
 */
export function computeIsPrimaryAsset(
  iv: Pick<ParsedIntervention, 'name' | 'type' | 'armRole' | 'armRoles'>,
  ctx: PrimaryAssetContext,
): boolean {
  if (!isDrugType(iv.type)) return false;
  if (isPlaceboLikeName(iv.name)) return false;
  const roleOk = iv.armRole === 'experimental' || (!ctx.hasArmGroups && iv.armRole === 'unknown');
  if (!roleOk) return false;
  const roles = new Set(iv.armRoles);
  if (roles.has('experimental') && (roles.has('active_comparator') || roles.has('placebo_comparator'))) {
    return false;
  }
  if (isBackgroundComparatorName(iv.name) && ctx.experimentalDrugCount > 1) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// STUDY PARSING
// ═══════════════════════════════════════════════════════════════════════

type RawStudy = {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string; acronym?: string };
    statusModule?: {
      overallStatus?: string; whyStopped?: string;
      startDateStruct?: { date?: string }; primaryCompletionDateStruct?: { date?: string };
      completionDateStruct?: { date?: string }; studyFirstPostDateStruct?: { date?: string };
      lastUpdatePostDateStruct?: { date?: string }; resultsFirstPostDateStruct?: { date?: string };
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string; class?: string };
      collaborators?: Array<{ name?: string; class?: string }>;
    };
    descriptionModule?: { briefSummary?: string };
    conditionsModule?: { conditions?: string[] };
    designModule?: { studyType?: string; phases?: string[]; enrollmentInfo?: { count?: number } };
    armsInterventionsModule?: {
      armGroups?: Array<{ label?: string; type?: string; interventionNames?: string[] }>;
      interventions?: Array<{ name?: string; type?: string; description?: string; otherNames?: string[]; armGroupLabels?: string[] }>;
    };
    contactsLocationsModule?: { locations?: Array<{ country?: string }> };
    outcomesModule?: {
      primaryOutcomes?: Array<{ measure?: string; description?: string; timeFrame?: string }>;
      secondaryOutcomes?: Array<{ measure?: string }>;
    };
  };
  derivedSection?: { conditionBrowseModule?: { meshes?: Array<{ term?: string }> } };
  resultsSection?: unknown;
};

/** Parse one CT.gov v2 study JSON into the shape the sweep stores. */
export function parseStudy(raw: RawStudy): ParsedStudy | null {
  const p = raw?.protocolSection;
  const nctId = p?.identificationModule?.nctId;
  if (!p || !nctId) return null;

  const status = p.statusModule;
  const sponsor = p.sponsorCollaboratorsModule;
  const design = p.designModule;
  const arms = p.armsInterventionsModule;

  // Arm label → role, plus role by intervention name for records that only
  // link through armGroups.interventionNames.
  const armGroups = arms?.armGroups ?? [];
  const roleByLabel = new Map<string, ArmRole>();
  const rolesByInterventionKey = new Map<string, Set<ArmRole>>();
  for (const arm of armGroups) {
    const role = mapArmRole(arm.type);
    if (arm.label) roleByLabel.set(arm.label.trim().toLowerCase(), role);
    for (const ref of arm.interventionNames ?? []) {
      const key = normalizeInterventionName(interventionNameFromArmRef(ref));
      if (!key) continue;
      if (!rolesByInterventionKey.has(key)) rolesByInterventionKey.set(key, new Set());
      rolesByInterventionKey.get(key)!.add(role);
    }
  }

  // Sponsors often list the same intervention once per arm ("PLN-101095"
  // six times, each with one armGroupLabel); merge duplicates by normalized
  // name and union their arm roles, other names and description.
  const byKey = new Map<string, {
    name: string; type: string; description: string | null; otherNames: Set<string>; roles: Set<ArmRole>;
  }>();
  for (const iv of arms?.interventions ?? []) {
    const name = (iv.name || '').trim();
    if (!name) continue;
    const key = normalizeInterventionName(name);
    if (!key) continue;
    const type = (iv.type || '').toUpperCase().replace(/\s+/g, '_');
    let entry = byKey.get(key);
    if (!entry) {
      entry = { name, type, description: null, otherNames: new Set(), roles: new Set() };
      byKey.set(key, entry);
    }
    if (!entry.type && type) entry.type = type;
    if (!entry.description && iv.description) entry.description = iv.description.substring(0, 2000);
    for (const o of iv.otherNames ?? []) {
      const t = (o || '').trim();
      if (t) entry.otherNames.add(t);
    }
    for (const label of iv.armGroupLabels ?? []) {
      const r = roleByLabel.get(label.trim().toLowerCase());
      if (r) entry.roles.add(r);
    }
    for (const r of rolesByInterventionKey.get(key) ?? []) entry.roles.add(r);
  }
  const interventions: ParsedIntervention[] = [...byKey.entries()].map(([key, e]) => {
    const armRoles = [...e.roles];
    return {
      name: e.name,
      nameNormalized: key,
      type: e.type,
      description: e.description,
      otherNames: [...e.otherNames].slice(0, 20),
      armRole: strongestArmRole(armRoles),
      armRoles,
      isPrimaryAsset: false,
    };
  });

  const hasArmGroups = armGroups.length > 0;
  const experimentalDrugCount = interventions.filter(iv =>
    isDrugType(iv.type) && !isPlaceboLikeName(iv.name) &&
    (iv.armRole === 'experimental' || (!hasArmGroups && iv.armRole === 'unknown')),
  ).length;
  for (const iv of interventions) {
    iv.isPrimaryAsset = computeIsPrimaryAsset(iv, { experimentalDrugCount, hasArmGroups });
  }

  const locationCountries: string[] = [];
  for (const loc of p.contactsLocationsModule?.locations ?? []) {
    if (loc.country) locationCountries.push(loc.country);
  }

  return {
    nctId,
    title: p.identificationModule?.briefTitle || '',
    acronym: p.identificationModule?.acronym || null,
    briefSummary: p.descriptionModule?.briefSummary || null,
    leadSponsorName: (sponsor?.leadSponsor?.name || '').trim(),
    leadSponsorClass: (sponsor?.leadSponsor?.class || 'UNKNOWN').toUpperCase(),
    collaborators: (sponsor?.collaborators ?? [])
      .map(c => ({ name: (c.name || '').trim(), class: (c.class || 'UNKNOWN').toUpperCase() }))
      .filter(c => c.name),
    studyType: design?.studyType || null,
    phase: mapPhase(design?.phases),
    status: mapStatus(status?.overallStatus),
    whyStopped: status?.whyStopped ? status.whyStopped.substring(0, 1000) : null,
    conditions: (p.conditionsModule?.conditions ?? []).filter(Boolean),
    meshTerms: (raw.derivedSection?.conditionBrowseModule?.meshes ?? []).map(m => m.term || '').filter(Boolean),
    interventions,
    hasArmGroups,
    startDate: normalizeDate(status?.startDateStruct?.date),
    primaryCompletionDate: normalizeDate(status?.primaryCompletionDateStruct?.date),
    completionDate: normalizeDate(status?.completionDateStruct?.date),
    firstPostedDate: normalizeDate(status?.studyFirstPostDateStruct?.date),
    lastUpdatePosted: normalizeDate(status?.lastUpdatePostDateStruct?.date),
    enrollmentCount: design?.enrollmentInfo?.count ?? null,
    locationCountries,
    hasResults: !!raw.resultsSection || !!status?.resultsFirstPostDateStruct,
    primaryOutcomes: (p.outcomesModule?.primaryOutcomes ?? []).map(o => ({
      measure: o.measure || '',
      description: o.description || null,
      timeFrame: o.timeFrame || null,
    })),
    secondaryOutcomes: (p.outcomesModule?.secondaryOutcomes ?? []).map(o => o.measure || '').filter(Boolean),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// QUERY + CURSOR
// ═══════════════════════════════════════════════════════════════════════

/** The filter.advanced Essie expression for a run starting at `from` (inclusive). */
export function buildSweepFilter(from: string): string {
  return `${DRUG_STUDY_FILTER} AND AREA[LastUpdatePostDate]RANGE[${from},MAX]`;
}

/** Full query string for one page. Exported so tests can pin the exact request. */
export function buildSweepQuery(args: {
  from: string;
  pageSize: number;
  pageToken?: string | null;
  countTotal?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set('filter.advanced', buildSweepFilter(args.from));
  params.set('fields', SWEEP_FIELDS.join(','));
  // Single key: CT.gov rejects NCTId as a sort field ("Unsupported sort field type").
  params.set('sort', 'LastUpdatePostDate:asc');
  params.set('pageSize', String(Math.min(MAX_PAGE_SIZE, Math.max(1, args.pageSize))));
  if (args.countTotal) params.set('countTotal', 'true');
  if (args.pageToken) params.set('pageToken', args.pageToken);
  return params.toString();
}

export function isoDateMinusDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function isIsoDate(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Advance the persisted cursor after a page.
 *
 * The cursor is the last LastUpdatePostDate known to be FULLY processed. A
 * day can span pages, so while more pages remain the cursor only reaches the
 * day before the page's max date; on the final page it reaches the max date
 * itself. Progress inside a day is carried by the page token in `state`,
 * which is only valid for the same `query_from`. The cursor never moves
 * backwards.
 */
export function advanceCursor(args: {
  cursor: string | null;
  queryFrom: string;
  pageMaxDate: string | null;
  nextPageToken: string | null;
  lastNct?: string;
  totalCount?: number | null;
}): { cursor: string; state: SweepCursorState } {
  const prev = isIsoDate(args.cursor) ? args.cursor : SWEEP_EPOCH;
  let next = prev;
  if (isIsoDate(args.pageMaxDate)) {
    const candidate = args.nextPageToken ? isoDateMinusDays(args.pageMaxDate, 1) : args.pageMaxDate;
    if (candidate > next) next = candidate;
  }
  const state: SweepCursorState = {
    query_from: args.queryFrom,
    page_token: args.nextPageToken ?? null,
    caught_up: !args.nextPageToken,
  };
  if (args.lastNct) state.last_nct = args.lastNct;
  if (typeof args.totalCount === 'number') state.total_count = args.totalCount;
  return { cursor: next, state };
}

/** Where a run starts: resume an in-flight token when its query_from is still valid, else from the cursor. */
export function resolveStart(cursor: string | null, state: SweepCursorState | null | undefined, full: boolean): {
  from: string;
  pageToken: string | null;
} {
  if (full) return { from: SWEEP_EPOCH, pageToken: null };
  const base = isIsoDate(cursor) ? cursor : SWEEP_EPOCH;
  if (state?.page_token && isIsoDate(state.query_from) && state.query_from <= base) {
    return { from: state.query_from, pageToken: state.page_token };
  }
  return { from: base, pageToken: null };
}

// ═══════════════════════════════════════════════════════════════════════
// SPONSOR RESOLUTION (DB)
// ═══════════════════════════════════════════════════════════════════════

interface SponsorResolution {
  sponsorName: string;
  normalized: string;
  companyId: string | null;
  companyName: string | null;
  ownerType: OwnerType;
  relationship: AliasRelationship;
  leadSponsorClass: string;
  source: 'alias' | 'company' | 'created' | 'cro' | 'unresolved';
}

interface AliasRow {
  sponsor_name: string;
  sponsor_name_normalized: string;
  company_id: string | null;
  relationship: AliasRelationship;
  lead_sponsor_class: string | null;
  trial_count: number;
}

interface CompanyMatchRow {
  matched_name: string;
  id: string;
  name: string;
  owner_type: string | null;
  headquarters_country: string | null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Collect every sponsor the page needs resolved, with per-sponsor context for creation. */
interface SponsorContext {
  name: string;
  leadSponsorClass: string;
  trialCount: number;
  locationCountries: string[];
  firstStartDate: string | null;
  modalities: Set<string>;
  indications: Set<string>;
}

/** Trial attribution: which company (if any) owns a study's assets. */
export function attributeStudy(study: ParsedStudy): { sponsorName: string; sponsorClass: string; viaCollaborator: boolean } | null {
  if (!study.leadSponsorName) return null;
  if (!isCroSponsor(study.leadSponsorName)) {
    return { sponsorName: study.leadSponsorName, sponsorClass: study.leadSponsorClass, viaCollaborator: false };
  }
  const industry = study.collaborators.find(c => c.class === 'INDUSTRY' && !isCroSponsor(c.name));
  if (industry) return { sponsorName: industry.name, sponsorClass: industry.class, viaCollaborator: true };
  return null;
}

async function resolveSponsors(
  supabase: SupabaseClient,
  contexts: Map<string, SponsorContext>,
  counters: { companiesMatched: number; companiesCreated: number; errors: string[] },
): Promise<Map<string, SponsorResolution>> {
  const resolutions = new Map<string, SponsorResolution>();
  const nowIso = new Date().toISOString();

  // ── 0. CROs never resolve to a company ─────────────────────────────
  const pending: SponsorContext[] = [];
  for (const ctx of contexts.values()) {
    const normalized = normalizeSponsorName(ctx.name);
    if (!normalized) continue;
    if (isCroSponsor(ctx.name)) {
      resolutions.set(ctx.name, {
        sponsorName: ctx.name, normalized, companyId: null, companyName: null,
        ownerType: 'cro', relationship: 'cro', leadSponsorClass: ctx.leadSponsorClass, source: 'cro',
      });
    } else {
      pending.push(ctx);
    }
  }

  // ── 1. sponsor_aliases ──────────────────────────────────────────────
  const aliasByNormalized = new Map<string, AliasRow>();
  const normalizedList = [...new Set(pending.map(c => normalizeSponsorName(c.name)))];
  for (const part of chunk(normalizedList, LOOKUP_CHUNK)) {
    const { data, error } = await supabase
      .from('sponsor_aliases')
      .select('sponsor_name, sponsor_name_normalized, company_id, relationship, lead_sponsor_class, trial_count')
      .in('sponsor_name_normalized', part);
    if (error) {
      counters.errors.push(`sponsor_aliases lookup failed (is migration 106 applied?): ${error.message}`);
      break;
    }
    for (const row of (data ?? []) as AliasRow[]) aliasByNormalized.set(row.sponsor_name_normalized, row);
  }

  // Alias rows with a company or an explicit CRO relationship are final. Rows
  // with company_id NULL and another relationship are retried below (a
  // previous creation may have failed).
  const companyIdsToVerify = new Set<string>();
  const stillPending: SponsorContext[] = [];
  for (const ctx of pending) {
    const normalized = normalizeSponsorName(ctx.name);
    const alias = aliasByNormalized.get(normalized);
    if (alias?.relationship === 'cro') {
      resolutions.set(ctx.name, {
        sponsorName: ctx.name, normalized, companyId: null, companyName: null,
        ownerType: 'cro', relationship: 'cro', leadSponsorClass: ctx.leadSponsorClass, source: 'cro',
      });
    } else if (alias?.company_id) {
      companyIdsToVerify.add(alias.company_id);
      resolutions.set(ctx.name, {
        sponsorName: ctx.name, normalized, companyId: alias.company_id, companyName: null,
        ownerType: 'unknown', relationship: alias.relationship, leadSponsorClass: ctx.leadSponsorClass, source: 'alias',
      });
    } else {
      stillPending.push(ctx);
    }
  }

  // Company names for alias hits (company_trials.company_name must match companies.name).
  if (companyIdsToVerify.size > 0) {
    const nameById = new Map<string, { name: string; owner_type: string | null }>();
    for (const part of chunk([...companyIdsToVerify], LOOKUP_CHUNK)) {
      const { data, error } = await supabase.from('companies').select('id, name, owner_type').in('id', part);
      if (error) { counters.errors.push(`companies lookup by id failed: ${error.message}`); break; }
      for (const row of data ?? []) nameById.set(row.id, { name: row.name, owner_type: row.owner_type });
    }
    for (const res of resolutions.values()) {
      if (res.source !== 'alias' || !res.companyId) continue;
      const c = nameById.get(res.companyId);
      if (c) {
        res.companyName = c.name;
        res.ownerType = (c.owner_type as OwnerType) || 'unknown';
      } else {
        // Alias points at a deleted company — fall through to name lookup / creation.
        const ctx = contexts.get(res.sponsorName);
        if (ctx) stillPending.push(ctx);
        resolutions.delete(res.sponsorName);
      }
    }
  }

  // ── 2. companies.name / name_variations (case-insensitive) ─────────
  const lookupNames = new Map<string, string>(); // lookup string (lower) → sponsor name
  const lookupList: string[] = [];
  for (const ctx of stillPending) {
    for (const cand of buildCompanyLookupNames(ctx.name)) {
      const k = cand.toLowerCase();
      if (!lookupNames.has(k)) { lookupNames.set(k, ctx.name); lookupList.push(cand); }
    }
  }
  const matchBySponsor = new Map<string, CompanyMatchRow>();
  for (const part of chunk(lookupList, 200)) {
    const { data, error } = await supabase.rpc('radar_find_companies_by_name', { p_names: part });
    if (error) {
      counters.errors.push(`radar_find_companies_by_name failed (is migration 106 applied?): ${error.message}`);
      break;
    }
    for (const row of (data ?? []) as CompanyMatchRow[]) {
      const sponsorName = lookupNames.get(row.matched_name.toLowerCase());
      if (!sponsorName) continue;
      // Prefer the verbatim-name match over a suffix-stripped variant.
      const prior = matchBySponsor.get(sponsorName);
      if (!prior || row.matched_name.toLowerCase() === sponsorName.toLowerCase()) matchBySponsor.set(sponsorName, row);
    }
  }

  const toCreate: SponsorContext[] = [];
  const ownerTypeUpdates = new Map<OwnerType, string[]>();
  for (const ctx of stillPending) {
    const normalized = normalizeSponsorName(ctx.name);
    const match = matchBySponsor.get(ctx.name);
    if (!match) { toCreate.push(ctx); continue; }
    const derived = deriveOwnerType(ctx.name, ctx.leadSponsorClass);
    const existingType = (match.owner_type as OwnerType) || 'unknown';
    const ownerType = existingType !== 'unknown' ? existingType : derived;
    if (existingType === 'unknown' && derived !== 'unknown') {
      if (!ownerTypeUpdates.has(derived)) ownerTypeUpdates.set(derived, []);
      ownerTypeUpdates.get(derived)!.push(match.id);
    }
    counters.companiesMatched++;
    resolutions.set(ctx.name, {
      sponsorName: ctx.name, normalized, companyId: match.id, companyName: match.name,
      ownerType, relationship: relationshipForOwnerType(ownerType), leadSponsorClass: ctx.leadSponsorClass, source: 'company',
    });
  }

  for (const [ownerType, ids] of ownerTypeUpdates) {
    for (const part of chunk([...new Set(ids)], LOOKUP_CHUNK)) {
      const { error } = await supabase
        .from('companies')
        .update({ owner_type: ownerType })
        .in('id', part)
        .or('owner_type.is.null,owner_type.eq.unknown');
      if (error) counters.errors.push(`owner_type backfill failed: ${error.message}`);
    }
  }

  // ── 3. create missing companies ─────────────────────────────────────
  // Two sponsor strings can share a name case-insensitively; create once.
  const createByLower = new Map<string, SponsorContext>();
  for (const ctx of toCreate) {
    const k = ctx.name.toLowerCase();
    if (!createByLower.has(k)) createByLower.set(k, ctx);
  }
  const createRows = [...createByLower.values()].map(ctx => {
    const ownerType = deriveOwnerType(ctx.name, ctx.leadSponsorClass);
    const geo = resolveSponsorGeography(ctx.name, ctx.locationCountries);
    return {
      name: ctx.name,
      name_variations: [ctx.name],
      owner_type: ownerType,
      lead_sponsor_class: ctx.leadSponsorClass,
      source_registry: 'ctgov',
      first_seen_trial_at: ctx.firstStartDate,
      actively_acquiring: false,
      data_sources: ['clinicaltrials_sweep'],
      headquarters_country: geo.country,
      headquarters_region: geo.region,
      modalities_active: [...ctx.modalities],
      indications_active: [...ctx.indications],
      active_trials_count: ctx.trialCount,
      last_enriched_at: nowIso,
    };
  });

  const createdByLower = new Map<string, { id: string; name: string; owner_type: string | null }>();
  for (const part of chunk(createRows, UPSERT_CHUNK)) {
    // ON CONFLICT (name) DO NOTHING — never overwrite an existing row's flags.
    const { data, error } = await supabase
      .from('companies')
      .upsert(part, { onConflict: 'name', ignoreDuplicates: true })
      .select('id, name, owner_type');
    if (error) {
      counters.errors.push(`companies insert failed (${part.length} rows): ${error.message}`);
      continue;
    }
    for (const row of data ?? []) createdByLower.set(row.name.toLowerCase(), row);
    counters.companiesCreated += (data ?? []).length;
  }
  // Rows skipped by DO NOTHING (exact-name race / variant collision): look them up.
  const missing = createRows.map(r => r.name).filter(n => !createdByLower.has(n.toLowerCase()));
  for (const part of chunk(missing, 200)) {
    const { data, error } = await supabase.rpc('radar_find_companies_by_name', { p_names: part });
    if (error) { counters.errors.push(`post-insert company lookup failed: ${error.message}`); break; }
    for (const row of (data ?? []) as CompanyMatchRow[]) {
      createdByLower.set(row.matched_name.toLowerCase(), { id: row.id, name: row.name, owner_type: row.owner_type });
    }
  }

  for (const ctx of toCreate) {
    const normalized = normalizeSponsorName(ctx.name);
    const created = createdByLower.get(ctx.name.toLowerCase());
    if (!created) {
      resolutions.set(ctx.name, {
        sponsorName: ctx.name, normalized, companyId: null, companyName: null,
        ownerType: deriveOwnerType(ctx.name, ctx.leadSponsorClass), relationship: 'unknown',
        leadSponsorClass: ctx.leadSponsorClass, source: 'unresolved',
      });
      continue;
    }
    const ownerType = (created.owner_type as OwnerType) || deriveOwnerType(ctx.name, ctx.leadSponsorClass);
    resolutions.set(ctx.name, {
      sponsorName: ctx.name, normalized, companyId: created.id, companyName: created.name,
      ownerType, relationship: relationshipForOwnerType(ownerType), leadSponsorClass: ctx.leadSponsorClass, source: 'created',
    });
  }
  // ── 4. record every resolution in sponsor_aliases ──────────────────
  const aliasRows = new Map<string, Record<string, unknown>>();
  for (const res of resolutions.values()) {
    if (!res.normalized || aliasRows.has(res.normalized)) continue;
    const ctx = contexts.get(res.sponsorName);
    const existing = aliasByNormalized.get(res.normalized);
    const row: Record<string, unknown> = {
      sponsor_name: existing?.sponsor_name ?? res.sponsorName,
      sponsor_name_normalized: res.normalized,
      lead_sponsor_class: res.leadSponsorClass || existing?.lead_sponsor_class || null,
      last_seen_at: nowIso,
      trial_count: (existing?.trial_count ?? 0) + (ctx?.trialCount ?? 0),
    };
    // Never overwrite a hand-edited resolution on an existing alias row.
    if (!existing) {
      row.company_id = res.companyId;
      row.relationship = res.relationship;
    } else if (!existing.company_id && res.companyId) {
      row.company_id = res.companyId;
      row.relationship = res.relationship;
    }
    aliasRows.set(res.normalized, row);
  }
  for (const part of chunk([...aliasRows.values()], UPSERT_CHUNK)) {
    const { error } = await supabase
      .from('sponsor_aliases')
      .upsert(part, { onConflict: 'sponsor_name_normalized' });
    if (error) counters.errors.push(`sponsor_aliases upsert failed (${part.length} rows): ${error.message}`);
  }

  return resolutions;
}

// ═══════════════════════════════════════════════════════════════════════
// ROW BUILDERS
// ═══════════════════════════════════════════════════════════════════════

/** company_trials row — same mapping as runWeeklyIngestion plus the sweep columns. */
export function buildTrialRow(
  study: ParsedStudy,
  attribution: { companyId: string | null; companyName: string | null },
): Record<string, unknown> {
  const ivs = study.interventions.map(i => ({ name: i.name, type: i.type, description: i.description }));
  const modality = inferModalityFromIntervention(ivs);
  const indication = inferIndicationFromConditions([...study.conditions, ...study.meshTerms]);
  // The asset intervention: first primary asset, else the existing ingester's
  // "first drug-class intervention" rule so the legacy universe path still works.
  const primary = study.interventions.find(i => i.isPrimaryAsset) ?? pickPrimaryIntervention(ivs);
  const locations = [...new Set(study.locationCountries)];

  return {
    company_id: attribution.companyId,
    company_name: attribution.companyName ?? (study.leadSponsorName || 'Unknown sponsor'),
    nct_id: study.nctId,
    trial_title: study.title,
    trial_acronym: study.acronym,
    brief_summary: study.briefSummary?.substring(0, 2000) ?? null,
    intervention_name: primary?.name ?? null,
    intervention_type: primary?.type ?? null,
    modality,
    indication_category: indication.category,
    indication_specific: indication.specific,
    conditions: study.conditions,
    phase: study.phase,
    status: study.status,
    is_collaboration: study.collaborators.length > 0,
    collaborator_names: study.collaborators.map(c => c.name),
    lead_sponsor_type: study.leadSponsorClass,
    lead_sponsor_name: study.leadSponsorName,
    lead_sponsor_class: study.leadSponsorClass,
    registry: 'ctgov',
    why_stopped: study.whyStopped,
    study_type: study.studyType,
    locations_countries: locations,
    enrollment_count: study.enrollmentCount,
    start_date: study.startDate,
    primary_completion_date: study.primaryCompletionDate,
    completion_date: study.completionDate,
    first_posted_date: study.firstPostedDate,
    last_update_posted: study.lastUpdatePosted,
    results_available: study.hasResults,
    primary_outcomes: study.primaryOutcomes.map(o => o.measure).filter(Boolean),
    secondary_outcomes: study.secondaryOutcomes,
    primary_outcome_measures: study.primaryOutcomes,
    updated_at: new Date().toISOString(),
  };
}

export function buildInterventionRows(study: ParsedStudy, companyId: string | null): Record<string, unknown>[] {
  const nowIso = new Date().toISOString();
  return study.interventions.map(iv => ({
    nct_id: study.nctId,
    company_id: companyId,
    name: iv.name.substring(0, 500),
    name_normalized: iv.nameNormalized.substring(0, 500),
    intervention_type: iv.type || null,
    arm_role: iv.armRole,
    other_names: iv.otherNames,
    description: iv.description,
    is_primary_asset: iv.isPrimaryAsset,
    updated_at: nowIso,
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// PAGE PROCESSING (DB)
// ═══════════════════════════════════════════════════════════════════════

interface PageCounters {
  trialsUpserted: number;
  orphanTrials: number;
  croLedTrials: number;
  interventionsUpserted: number;
  primaryInterventions: number;
  sponsorsSeen: number;
  sponsorsResolved: number;
  companiesMatched: number;
  companiesCreated: number;
  errors: string[];
}

async function processPage(supabase: SupabaseClient, studies: ParsedStudy[], counters: PageCounters): Promise<void> {
  // ── Sponsor contexts ────────────────────────────────────────────────
  const contexts = new Map<string, SponsorContext>();
  const attributionByNct = new Map<string, ReturnType<typeof attributeStudy>>();
  for (const study of studies) {
    const attr = attributeStudy(study);
    attributionByNct.set(study.nctId, attr);
    if (isCroSponsor(study.leadSponsorName)) counters.croLedTrials++;
    // Record the lead sponsor itself (CROs included, so the alias table has them)
    // and the attributed collaborator when different.
    const names = new Set<string>();
    if (study.leadSponsorName) names.add(study.leadSponsorName);
    if (attr?.sponsorName) names.add(attr.sponsorName);
    for (const name of names) {
      const cls = attr && attr.sponsorName === name ? attr.sponsorClass : study.leadSponsorClass;
      let ctx = contexts.get(name);
      if (!ctx) {
        ctx = { name, leadSponsorClass: cls, trialCount: 0, locationCountries: [], firstStartDate: null, modalities: new Set(), indications: new Set() };
        contexts.set(name, ctx);
      }
      ctx.trialCount++;
      ctx.locationCountries.push(...study.locationCountries);
      if (study.startDate && (!ctx.firstStartDate || study.startDate < ctx.firstStartDate)) ctx.firstStartDate = study.startDate;
      const modality = inferModalityFromIntervention(study.interventions.map(i => ({ name: i.name, type: i.type, description: i.description })));
      if (modality && modality !== 'other') ctx.modalities.add(modality);
      const ind = inferIndicationFromConditions(study.conditions);
      if (ind.category) ctx.indications.add(ind.category);
    }
  }
  counters.sponsorsSeen += contexts.size;

  const resolutions = await resolveSponsors(supabase, contexts, counters);
  for (const res of resolutions.values()) if (res.companyId || res.source === 'cro') counters.sponsorsResolved++;

  // ── Rows ───────────────────────────────────────────────────────────
  const attributedRows = new Map<string, Record<string, unknown>>(); // company_id\0nct
  const orphanRows = new Map<string, Record<string, unknown>>();     // nct
  const interventionRows = new Map<string, Record<string, unknown>>(); // nct\0name_normalized

  for (const study of studies) {
    const attr = attributionByNct.get(study.nctId);
    const res = attr ? resolutions.get(attr.sponsorName) : undefined;
    const companyId = res?.companyId ?? null;
    const companyName = res?.companyName ?? null;
    const row = buildTrialRow(study, { companyId, companyName });
    if (companyId) attributedRows.set(`${companyId}\u0000${study.nctId}`, row);
    else orphanRows.set(study.nctId, row);
    for (const iv of buildInterventionRows(study, companyId)) {
      interventionRows.set(`${study.nctId}\u0000${iv.name_normalized}`, iv);
      if (iv.is_primary_asset) counters.primaryInterventions++;
    }
  }

  for (const part of chunk([...attributedRows.values()], UPSERT_CHUNK)) {
    const { error } = await supabase.from('company_trials').upsert(part, { onConflict: 'company_id,nct_id' });
    if (error) counters.errors.push(`company_trials upsert failed (${part.length} rows): ${error.message}`);
    else counters.trialsUpserted += part.length;
  }

  // Orphans (company_id NULL) cannot use ON CONFLICT through PostgREST because
  // the partial unique index needs a WHERE clause in the conflict target;
  // delete-then-insert keyed on nct_id is idempotent and nothing references
  // company_trials.id.
  for (const part of chunk([...orphanRows.values()], UPSERT_CHUNK)) {
    const ncts = part.map(r => r.nct_id as string);
    const { error: delError } = await supabase.from('company_trials').delete().in('nct_id', ncts).is('company_id', null);
    if (delError) { counters.errors.push(`orphan company_trials delete failed: ${delError.message}`); continue; }
    const { error } = await supabase.from('company_trials').insert(part);
    if (error) counters.errors.push(`orphan company_trials insert failed (${part.length} rows): ${error.message}`);
    else { counters.trialsUpserted += part.length; counters.orphanTrials += part.length; }
  }

  for (const part of chunk([...interventionRows.values()], UPSERT_CHUNK)) {
    const { error } = await supabase.from('trial_interventions').upsert(part, { onConflict: 'nct_id,name_normalized' });
    if (error) counters.errors.push(`trial_interventions upsert failed (${part.length} rows): ${error.message}`);
    else counters.interventionsUpserted += part.length;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FETCH
// ═══════════════════════════════════════════════════════════════════════

interface PageResponse {
  studies: RawStudy[];
  nextPageToken: string | null;
  totalCount: number | null;
}

class InvalidPageTokenError extends Error {}

async function fetchPage(query: string): Promise<PageResponse> {
  const url = `${CT_API_V2}?${query}`;
  // fetchWithTimeout retries 429/502/503/504 with exponential backoff.
  const response = await fetchWithTimeout(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Solidus-AssetRadar/1.0 (+https://solidus.ambrosiaventures.co)' },
    timeoutMs: 90_000,
    retries: 3,
    retryDelayMs: 3_000,
  });
  if (response.status === 400 && query.includes('pageToken=')) {
    const body = await response.text().catch(() => '');
    throw new InvalidPageTokenError(`CT.gov rejected the page token: ${body.slice(0, 200)}`);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`CT.gov ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  return {
    studies: Array.isArray(data?.studies) ? data.studies : [],
    nextPageToken: data?.nextPageToken || null,
    totalCount: typeof data?.totalCount === 'number' ? data.totalCount : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

export async function runCtgovSweep(supabase: SupabaseClient, options: SweepOptions = {}): Promise<SweepResult> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const budget = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const maxPages = Math.max(1, options.maxPages ?? DEFAULT_MAX_PAGES);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE));

  const counters: PageCounters = {
    trialsUpserted: 0, orphanTrials: 0, croLedTrials: 0, interventionsUpserted: 0, primaryInterventions: 0,
    sponsorsSeen: 0, sponsorsResolved: 0, companiesMatched: 0, companiesCreated: 0, errors: [],
  };
  let pagesFetched = 0;
  let studiesFetched = 0;
  let timedOut = false;
  let caughtUp = false;
  let totalCount: number | null = null;

  // ── Cursor ─────────────────────────────────────────────────────────
  let cursorBefore: string | null = null;
  let cursor: string | null = null;
  let state: SweepCursorState = {};
  try {
    const saved = await readSyncCursor<SweepCursorState>(supabase, SWEEP_SOURCE);
    cursorBefore = saved.cursor;
    cursor = saved.cursor;
    state = saved.state ?? {};
  } catch (err) {
    counters.errors.push(`cursor read failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (options.full) {
    cursor = SWEEP_EPOCH;
    state = {};
    try { await writeSyncCursor(supabase, SWEEP_SOURCE, SWEEP_EPOCH, { reset_at: new Date().toISOString() }); }
    catch (err) { counters.errors.push(`cursor reset failed: ${err instanceof Error ? err.message : String(err)}`); }
  }
  let { from, pageToken } = resolveStart(cursor, state, !!options.full);
  let pageTokenAfter: string | null = pageToken;

  const finish = async (): Promise<SweepResult> => {
    const status = deriveRunStatus({
      errors: counters.errors.length,
      timedOut,
      processed: studiesFetched,
      produced: counters.trialsUpserted + counters.interventionsUpserted,
    });
    const logged = await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt,
      status,
      runType: options.runType ?? 'scheduled',
      fetched: studiesFetched,
      processed: studiesFetched,
      inserted: counters.trialsUpserted,
      updated: counters.interventionsUpserted,
      skipped: counters.orphanTrials,
      failed: counters.errors.length,
      errors: counters.errors,
      parameters: {
        stage: 'ctgov_sweep',
        query: buildSweepFilter(from),
        page_size: pageSize,
        pages_fetched: pagesFetched,
        cursor_before: cursorBefore,
        cursor_after: cursor,
        page_token_after: pageTokenAfter ? 'set' : null,
        caught_up: caughtUp,
        total_count: totalCount,
        timed_out: timedOut,
        companies_created: counters.companiesCreated,
        companies_matched: counters.companiesMatched,
        sponsors_seen: counters.sponsorsSeen,
        sponsors_resolved: counters.sponsorsResolved,
        cro_led_trials: counters.croLedTrials,
        orphan_trials: counters.orphanTrials,
        primary_interventions: counters.primaryInterventions,
      },
    });
    const seconds = Math.round((now() - startedAt) / 1000);
    console.log(`[ctgov-sweep] ${pagesFetched} pages, ${studiesFetched} studies, ${counters.trialsUpserted} trials, ${counters.interventionsUpserted} interventions, ${counters.companiesCreated} companies created, cursor ${cursorBefore ?? 'NULL'} → ${cursor ?? 'NULL'}${pageTokenAfter ? ' (+token)' : ''}, ${counters.errors.length} errors, ${seconds}s${timedOut ? ' (timed out)' : ''}${caughtUp ? ' (caught up)' : ''}${logged ? '' : ' [LOG WRITE FAILED]'}`);
    return {
      pagesFetched, studiesFetched,
      trialsUpserted: counters.trialsUpserted, orphanTrials: counters.orphanTrials, croLedTrials: counters.croLedTrials,
      interventionsUpserted: counters.interventionsUpserted, primaryInterventions: counters.primaryInterventions,
      sponsorsSeen: counters.sponsorsSeen, sponsorsResolved: counters.sponsorsResolved,
      companiesMatched: counters.companiesMatched, companiesCreated: counters.companiesCreated,
      cursorBefore, cursorAfter: cursor, pageTokenAfter, caughtUp, totalCount, timedOut,
      errors: counters.errors, logged,
    };
  };

  // Cursor infrastructure missing → nothing else will work either.
  if (counters.errors.length > 0) return finish();

  // ── Page loop ──────────────────────────────────────────────────────
  let tokenRetried = false;
  while (pagesFetched < maxPages) {
    if (now() - startedAt > budget - PAGE_RESERVE_MS) { timedOut = true; break; }
    const requestStartedAt = now();

    let page: PageResponse;
    try {
      page = await fetchPage(buildSweepQuery({ from, pageSize, pageToken, countTotal: pagesFetched === 0 }));
    } catch (err) {
      if (err instanceof InvalidPageTokenError && !tokenRetried) {
        // Stale token (query changed or CT.gov invalidated it): restart from the cursor.
        tokenRetried = true;
        counters.errors.push(`${err.message} — restarting from cursor ${cursor ?? SWEEP_EPOCH}`);
        from = isIsoDate(cursor) ? cursor : SWEEP_EPOCH;
        pageToken = null;
        pageTokenAfter = null;
        continue;
      }
      counters.errors.push(`page fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
    pagesFetched++;
    if (page.totalCount !== null) totalCount = page.totalCount;

    const studies: ParsedStudy[] = [];
    for (const raw of page.studies) {
      const parsed = parseStudy(raw);
      if (parsed) studies.push(parsed);
    }
    studiesFetched += studies.length;

    if (studies.length > 0) {
      try {
        await processPage(supabase, studies, counters);
      } catch (err) {
        counters.errors.push(`page processing failed: ${err instanceof Error ? err.message : String(err)}`);
        break; // do not advance the cursor past an unprocessed page
      }
    }

    // ── Advance cursor after every page ───────────────────────────────
    let pageMaxDate: string | null = null;
    for (const s of studies) if (isIsoDate(s.lastUpdatePosted) && (!pageMaxDate || s.lastUpdatePosted > pageMaxDate)) pageMaxDate = s.lastUpdatePosted;
    const advanced = advanceCursor({
      cursor, queryFrom: from, pageMaxDate, nextPageToken: page.nextPageToken,
      lastNct: studies[studies.length - 1]?.nctId, totalCount,
    });
    cursor = advanced.cursor;
    pageToken = page.nextPageToken;
    pageTokenAfter = pageToken;
    try {
      await writeSyncCursor(supabase, SWEEP_SOURCE, cursor, advanced.state);
    } catch (err) {
      counters.errors.push(`cursor write failed: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }

    if (!page.nextPageToken || page.studies.length === 0) { caughtUp = true; break; }

    // Polite rate: one request per REQUEST_INTERVAL_MS, measured from request start.
    const elapsed = now() - requestStartedAt;
    if (elapsed < REQUEST_INTERVAL_MS) await sleep(REQUEST_INTERVAL_MS - elapsed);
  }

  return finish();
}
