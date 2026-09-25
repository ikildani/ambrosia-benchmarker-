/**
 * Drug master resolver for the Search & Evaluation (migration 107).
 *
 * Turns a trial intervention string into one drug_master node so that
 * "MK-3475 (pembrolizumab)", "Pembrolizumab (MK-3475)", "KEYTRUDA" and
 * "pembrolizumab 200 mg" resolve to the same drug, combinations are split into
 * components, and the same drug under two sponsors is one asset with two owners.
 *
 * Cascade (resolveDrug):
 *   a. exact normalized alias hit in drug_aliases
 *   b. code-name exact-token hit (never fuzzy: ABC-123 is not ABC-124)
 *   c. INN hit, then conservative INN fuzzy (edit distance 1, 8+ chars)
 *   d. external, free APIs only, behind per-host limiters (GSRS 3/s, ChEMBL
 *      3/s, PubChem 4/s; GSRS and ChEMBL are queried in parallel) with an
 *      in-memory cache, drug_aliases as the persistent positive cache and
 *      drug_resolve_negative_cache (migration 113, 30-day TTL) as the
 *      persistent negative cache:
 *        NCATS GSRS  → UNII, names, codes, substance class
 *        ChEMBL      → chembl_id, pref_name, max_phase, molecule_type, synonyms
 *        PubChem     → CID, synonyms (CAS, UNII, DrugBank id, codes)
 *   e. internal row (source='internal', confidence 30) so the asset can still
 *      be keyed; status 'unresolvable' means no public identifier, not no row.
 *
 * Batch entry point: resolveAssetsBatch (cron /api/cron/drug-resolve). It
 * runs two passes per invocation:
 *
 *   local pass     up to 5,000 queued assets, no network: one batched
 *                  drug_aliases lookup per 200 candidate keys, placebo /
 *                  procedure names closed as non-drug, unmatched
 *                  industry-owned names minted as internal rows in bulk (one
 *                  row per group of names sharing a key, so the same code name
 *                  under two sponsors is one node from the start), and every
 *                  write applied set-based through radar_apply_drug_resolutions.
 *   external pass  internal drug rows still unchecked, industry-owned and
 *                  late-phase first (radar_internal_drugs_pending), resolved
 *                  concurrently against GSRS / ChEMBL / PubChem; a hit upgrades
 *                  or merges the row and flips every asset keyed on it to
 *                  'resolved' in one UPDATE.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';
import { RADAR_MODALITY_OPTIONS, isRadarValue } from '@/lib/radar/vocab';
import {
  classifyAlias,
  containsCJK,
  inferModalityFromName,
  innFuzzyEqual,
  isCodeName,
  looksLikeInn,
  modalityFromChemblType,
  modalityFromGsrsClass,
  normalizeDrugName,
  normalizeKey,
  splitCombination,
  type AliasType,
  type NonDrugReason,
  type NormalizedDrugName,
  type RadarModality,
} from '@/lib/radar/drug-name';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type DrugResolutionStatus = 'resolved' | 'ambiguous' | 'unresolvable';

export type MatchedVia =
  | 'alias'
  | 'code'
  | 'inn'
  | 'inn_fuzzy'
  | 'gsrs'
  | 'chembl'
  | 'gsrs+chembl'
  | 'pubchem'
  | 'combination'
  | 'internal'
  | 'none';

export interface ResolveDrugInput {
  rawName: string;
  /** Other raw strings seen for the same asset (clinical_assets.asset_aliases). */
  otherNames?: string[] | null;
  /** CT.gov intervention type; non-drug types short-circuit to unresolvable. */
  interventionType?: string | null;
  sponsorName?: string | null;
}

export interface ResolveDrugResult {
  drugId: string | null;
  confidence: number;
  status: DrugResolutionStatus;
  matchedVia: MatchedVia;
  /** Set when no drug_master row was created (placebo, procedure, CJK, empty). */
  reason?: NonDrugReason;
  preferredName: string | null;
  isCombination: boolean;
  componentDrugIds: string[];
  modality: RadarModality | null;
  aliasesRecorded: number;
  externalCalls: number;
}

export interface ResolveOptions {
  /** Query GSRS/ChEMBL/PubChem on a local miss. Default true. Set false at index time. */
  allowExternal?: boolean;
  /** Shared external-call budget for a run. */
  budget?: ExternalBudget;
  /** Alias provenance written to drug_aliases.source for names taken from the input. */
  aliasSource?: string;
  /**
   * Create a source='internal' drug_master row when nothing matches (default
   * true). The index-time call passes false so re-indexing never mints rows;
   * the cron creates them.
   */
  createInternalRow?: boolean;
}

export interface DrugMasterRow {
  id: string;
  preferred_name: string;
  inn: string | null;
  unii: string | null;
  chembl_id: string | null;
  ncit_code: string | null;
  pubchem_cid: number | null;
  drugbank_id: string | null;
  cas_number: string | null;
  modality: string | null;
  target: string | null;
  mechanism: string | null;
  max_phase: string | null;
  is_combination: boolean;
  component_drug_ids: string[];
  originator_company_id: string | null;
  source: string;
  confidence: number;
  external_checked_at: string | null;
  updated_at: string;
}

const DRUG_COLUMNS =
  'id, preferred_name, inn, unii, chembl_id, ncit_code, pubchem_cid, drugbank_id, cas_number, modality, target, mechanism, max_phase, is_combination, component_drug_ids, originator_company_id, source, confidence, external_checked_at, updated_at';

interface AliasInput {
  alias: string;
  type: AliasType;
  source: string;
}

const INTERNAL_CONFIDENCE = 30;
const AMBIGUOUS_CONFIDENCE = 50;
const RESOLVED_MIN_CONFIDENCE = 60;
const INTERNAL_RECHECK_DAYS = 30;
const MAX_ALIASES_PER_DRUG = 60;
const NON_DRUG_INTERVENTION_TYPES = new Set([
  'DEVICE', 'PROCEDURE', 'BEHAVIORAL', 'RADIATION', 'DIETARY_SUPPLEMENT', 'DIAGNOSTIC_TEST', 'OTHER',
]);

/** PostgREST caps an unranged select at max-rows (1,000); every multi-row read pages with .range(). */
const PAGE_SIZE = 1000;
/** Keys per `.in()` filter. */
const IN_CHUNK = 200;
/** Rows per bulk insert / upsert. */
const WRITE_CHUNK = 500;
/** Rows per radar_apply_drug_resolutions call. */
const APPLY_CHUNK = 1000;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function mapConcurrent<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Read every row of a query in PAGE_SIZE pages. `build` must apply a stable
 * order before `.range()` is added, so pages do not overlap.
 */
async function pagedSelect<T>(
  label: string,
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  maxRows = 50_000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label} failed: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

/** True when a PostgREST error means the migration-113 function is not installed yet. */
function isMissingFunction(message: string | undefined): boolean {
  return /could not find the function|function .* does not exist|schema cache/i.test(message ?? '');
}

// ═══════════════════════════════════════════════════════════════════════
// EXTERNAL BUDGET (rate + call cap + deadline)
// ═══════════════════════════════════════════════════════════════════════

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export type ExternalHost = 'gsrs' | 'chembl' | 'pubchem';
export const EXTERNAL_HOSTS: readonly ExternalHost[] = ['gsrs', 'chembl', 'pubchem'];

/**
 * Per-host request rates. The three services are independent hosts, so one
 * aggregate 3 req/s limiter left two thirds of the allowed traffic unused.
 */
export const HOST_RATE_PER_SEC: Record<ExternalHost, number> = { gsrs: 3, chembl: 3, pubchem: 4 };

/** Token-interval limiter for one host. `reserve` is synchronous, so it is safe under concurrent callers. */
class HostLimiter {
  private nextAt = 0;
  constructor(private readonly minIntervalMs: number) {}

  /** Reserve the next slot and return how long the caller must wait for it. */
  reserve(now = Date.now()): number {
    const wait = Math.max(0, this.nextAt - now);
    this.nextAt = Math.max(now, this.nextAt) + this.minIntervalMs;
    return wait;
  }
}

export interface ExternalBudgetOptions {
  /** Override the per-host rates (tests, throttled hosts). */
  ratesPerSec?: Partial<Record<ExternalHost, number>>;
  /** Epoch ms after which no new call starts. */
  deadlineMs?: number;
}

/**
 * Shared call cap + deadline across GSRS, ChEMBL and PubChem, with an
 * independent rate limiter per host.
 */
export class ExternalBudget {
  used = 0;
  readonly usedByHost: Record<ExternalHost, number> = { gsrs: 0, chembl: 0, pubchem: 0 };
  private readonly limiters: Record<ExternalHost, HostLimiter>;
  private readonly deadlineMs: number;

  constructor(public readonly maxCalls: number, options: ExternalBudgetOptions = {}) {
    const rates = { ...HOST_RATE_PER_SEC, ...(options.ratesPerSec ?? {}) };
    const interval = (host: ExternalHost) => Math.ceil(1000 / Math.max(0.1, rates[host]));
    this.limiters = {
      gsrs: new HostLimiter(interval('gsrs')),
      chembl: new HostLimiter(interval('chembl')),
      pubchem: new HostLimiter(interval('pubchem')),
    };
    this.deadlineMs = options.deadlineMs ?? Number.POSITIVE_INFINITY;
  }

  canCall(): boolean {
    return this.used < this.maxCalls && Date.now() < this.deadlineMs;
  }

  /** Waits for the host's rate slot; returns false when the budget or deadline is exhausted. */
  async acquire(host: ExternalHost): Promise<boolean> {
    if (!this.canCall()) return false;
    this.used++;
    this.usedByHost[host]++;
    const wait = this.limiters[host].reserve();
    if (wait > 0) await sleep(wait);
    return true;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// EXTERNAL CLIENTS (free, no key)
// ═══════════════════════════════════════════════════════════════════════

export interface ExternalHit {
  sources: Array<'gsrs' | 'chembl' | 'pubchem'>;
  preferredName: string;
  inn: string | null;
  unii: string | null;
  chemblId: string | null;
  pubchemCid: number | null;
  casNumber: string | null;
  drugbankId: string | null;
  ncitCode: string | null;
  modality: RadarModality | null;
  maxPhase: string | null;
  aliases: AliasInput[];
  confidence: number;
}

/** Positive and definitive-negative results for the life of the lambda. */
const externalCache = new Map<string, ExternalHit | null>();
/** Names being looked up right now, so concurrent assets sharing a name issue one request. */
const inflightLookups = new Map<string, Promise<ExternalHit | null>>();

// ── Negative cache (drug_resolve_negative_cache, migration 113) ──────────
export const NEGATIVE_CACHE_TTL_DAYS = 30;
/** Keys known to miss on every host: preloaded from the table, extended by this run's misses. */
const negativeKeys = new Set<string>();
/** Misses observed this run that still have to be written back. */
const pendingNegatives = new Map<string, ExternalHost[]>();
let negativeCacheHits = 0;

/** A negative-cache row is honoured while younger than the TTL; older rows are re-queried. */
export function isNegativeCacheFresh(
  checkedAt: string | null | undefined,
  nowMs = Date.now(),
  ttlDays = NEGATIVE_CACHE_TTL_DAYS,
): boolean {
  if (!checkedAt) return false;
  const t = new Date(checkedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return nowMs - t < ttlDays * 86_400_000;
}

/** Test hook: clears every in-memory cache in this module. */
export function resetExternalCachesForTests(): void {
  externalCache.clear();
  inflightLookups.clear();
  negativeKeys.clear();
  pendingNegatives.clear();
  negativeCacheHits = 0;
}

const USER_AGENT = 'AmbrosiaSolidus-AssetRadar/1.0 (drug-master resolver; contact: hello@ambrosiaventures.co)';

type FetchOutcome =
  | { status: 'ok'; json: unknown }
  /** The host answered and has no such record. */
  | { status: 'miss' }
  /** Budget or deadline exhausted before the call; nothing was learned. */
  | { status: 'denied' }
  /** Network / 5xx after retries; nothing was learned. */
  | { status: 'error' };

async function getJson(url: string, budget: ExternalBudget, host: ExternalHost, timeoutMs = 12_000): Promise<FetchOutcome> {
  if (!(await budget.acquire(host))) return { status: 'denied' };
  try {
    const res = await fetchWithTimeout(url, {
      timeoutMs,
      retries: 1,
      retryDelayMs: 800,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });
    if (res.status === 404) return { status: 'miss' };
    if (!res.ok) return { status: 'error' };
    return { status: 'ok', json: (await res.json()) as unknown };
  } catch (err) {
    console.warn(`[drug-master] external fetch failed ${url.slice(0, 120)}: ${err instanceof Error ? err.message : String(err)}`);
    return { status: 'error' };
  }
}

/** A host's answer: `definitive` is true when the host actually replied (hit or miss). */
interface LookupOutcome {
  hit: Partial<ExternalHit> | null;
  definitive: boolean;
}

const NO_ANSWER: LookupOutcome = { hit: null, definitive: false };

function titleFromUpper(name: string): string {
  // GSRS returns 'PEMBROLIZUMAB'; INNs are conventionally lowercase.
  if (name === name.toUpperCase() && /^[A-Z][A-Z\s-]+$/.test(name) && looksLikeInn(name.toLowerCase())) {
    return name.toLowerCase();
  }
  return name;
}

function isNoiseAlias(alias: string): boolean {
  if (!alias || alias.length < 2 || alias.length > 60) return true;
  if (/[=@\\[\]{}<>|]/.test(alias)) return true; // SMILES / InChI / markup
  if (/^\d+$/.test(alias)) return true;
  if (/^(?:DTXSID|DTXCID|SCHEMBL|NCGC|HMS|AKOS|MFCD|CHEBI|HY-|BCP|EN300|ZINC|CCG-|SR-|SMR|CS-|BDBM|GTPL|EX-A|MLS|STK|TS-|WLN|LS-|BRD-|HSDB|EINECS|MCULE|SBI-|SBB|NCI|CAS-|UNII-|Tox21|NSC-?\d|PDSP|BIM-|KS-|FT-|J-\d|Q\d{4,}|s\d{4,}|SY\d|A\d{5,}|AB\d{5,}|AC-\d|AM\d{5,}|CID\s?\d|SID\s?\d|DB\d{5}|InChI|SMILES|compound|molecule)/i.test(alias)) {
    return true;
  }
  return false;
}

function pushAlias(list: AliasInput[], alias: string, source: string, type?: AliasType): void {
  const a = alias.trim();
  if (isNoiseAlias(a)) return;
  list.push({ alias: a, type: type ?? classifyAlias(a), source });
}

interface GsrsSubstance {
  approvalID?: string;
  _name?: string;
  names?: Array<{ name?: string; type?: string; displayName?: boolean }>;
  codes?: Array<{ code?: string; codeSystem?: string }>;
  substanceClass?: string;
}

async function gsrsLookup(name: string, budget: ExternalBudget): Promise<LookupOutcome> {
  const key = normalizeKey(name);
  const q = `root_names_name:"^${name.replace(/"/g, '')}$"`;
  const url = `https://gsrs.ncats.nih.gov/api/v1/substances/search?q=${encodeURIComponent(q)}&top=5`;
  const outcome = await getJson(url, budget, 'gsrs');
  if (outcome.status === 'denied' || outcome.status === 'error') return NO_ANSWER;
  const json = outcome.status === 'ok' ? (outcome.json as { content?: GsrsSubstance[] } | null) : null;
  const content = json?.content ?? [];
  for (const sub of content) {
    const names = [sub._name ?? '', ...(sub.names ?? []).map(n => n.name ?? '')].filter(Boolean);
    const codes = (sub.codes ?? []).map(c => c.code ?? '').filter(Boolean);
    const exact = names.some(n => normalizeKey(n) === key) || codes.some(c => normalizeKey(c) === key);
    if (!exact) continue;
    const aliases: AliasInput[] = [];
    for (const n of names.slice(0, 40)) pushAlias(aliases, titleFromUpper(n), 'gsrs');
    let cas: string | null = null;
    let chembl: string | null = null;
    let drugbank: string | null = null;
    let pubchem: number | null = null;
    for (const c of sub.codes ?? []) {
      const sys = (c.codeSystem ?? '').toUpperCase();
      const code = (c.code ?? '').trim();
      if (!code) continue;
      if (sys === 'CAS' && /^\d{2,7}-\d{2}-\d$/.test(code)) { cas = cas ?? code; pushAlias(aliases, code, 'gsrs', 'cas'); }
      else if (sys.includes('CHEMBL') && /^CHEMBL\d+$/i.test(code)) { chembl = chembl ?? code.toUpperCase(); pushAlias(aliases, code.toUpperCase(), 'gsrs', 'chembl'); }
      else if (sys.includes('DRUG BANK') || sys === 'DRUGBANK') drugbank = drugbank ?? code;
      else if (sys === 'PUBCHEM' && /^\d+$/.test(code)) pubchem = pubchem ?? Number(code);
    }
    const ncitCode = (sub.codes ?? []).find(c => /NCI/i.test(c.codeSystem ?? '') && /^C\d+$/.test(c.code ?? ''))?.code ?? null;
    const unii = sub.approvalID && /^[A-Z0-9]{10}$/.test(sub.approvalID) ? sub.approvalID : null;
    if (unii) pushAlias(aliases, unii, 'gsrs', 'unii');
    const preferred = titleFromUpper(sub._name ?? name);
    return {
      definitive: true,
      hit: {
        sources: ['gsrs'],
        preferredName: preferred,
        inn: looksLikeInn(preferred) ? preferred.toLowerCase() : null,
        unii,
        casNumber: cas,
        chemblId: chembl,
        drugbankId: drugbank,
        ncitCode,
        pubchemCid: pubchem,
        modality: modalityFromGsrsClass(sub.substanceClass),
        aliases,
      },
    };
  }
  return { hit: null, definitive: true };
}

interface ChemblMolecule {
  molecule_chembl_id?: string;
  pref_name?: string | null;
  max_phase?: number | string | null;
  molecule_type?: string | null;
  molecule_synonyms?: Array<{ molecule_synonym?: string; syn_type?: string }>;
}

function chemblPhaseToSlug(p: number | string | null | undefined): string | null {
  if (p === null || p === undefined || p === '') return null;
  const n = typeof p === 'number' ? p : Number.parseFloat(String(p));
  if (!Number.isFinite(n)) return null;
  if (n >= 4) return 'approved';
  if (n >= 3) return 'phase_3';
  if (n >= 2) return 'phase_2';
  if (n >= 1) return 'phase_1';
  if (n > 0) return 'early_phase_1';
  return null;
}

function chemblSynType(t: string | undefined): AliasType | undefined {
  const s = (t ?? '').toUpperCase();
  if (['INN', 'USAN', 'BAN', 'JAN', 'USP', 'FDA'].includes(s)) return 'inn';
  if (s === 'TRADE_NAME') return 'brand';
  if (s === 'RESEARCH_CODE') return 'code';
  return undefined;
}

async function chemblLookup(name: string, budget: ExternalBudget): Promise<LookupOutcome> {
  const key = normalizeKey(name);
  const url = `https://www.ebi.ac.uk/chembl/api/data/molecule/search.json?q=${encodeURIComponent(name)}&limit=5`;
  const outcome = await getJson(url, budget, 'chembl');
  if (outcome.status === 'denied' || outcome.status === 'error') return NO_ANSWER;
  const json = outcome.status === 'ok' ? (outcome.json as { molecules?: ChemblMolecule[] } | null) : null;
  for (const mol of json?.molecules ?? []) {
    const syns = (mol.molecule_synonyms ?? []).map(s => s.molecule_synonym ?? '').filter(Boolean);
    const names = [mol.pref_name ?? '', ...syns].filter(Boolean);
    if (!names.some(n => normalizeKey(n) === key)) continue;
    const aliases: AliasInput[] = [];
    if (mol.pref_name) pushAlias(aliases, titleFromUpper(mol.pref_name), 'chembl');
    for (const s of (mol.molecule_synonyms ?? []).slice(0, 40)) {
      if (!s.molecule_synonym) continue;
      const t = chemblSynType(s.syn_type);
      pushAlias(aliases, t === 'inn' ? s.molecule_synonym.toLowerCase() : s.molecule_synonym, 'chembl', t);
    }
    const chemblId = mol.molecule_chembl_id && /^CHEMBL\d+$/i.test(mol.molecule_chembl_id) ? mol.molecule_chembl_id.toUpperCase() : null;
    if (chemblId) pushAlias(aliases, chemblId, 'chembl', 'chembl');
    const innSyn = (mol.molecule_synonyms ?? []).find(s => chemblSynType(s.syn_type) === 'inn')?.molecule_synonym ?? null;
    const preferred = titleFromUpper(mol.pref_name || innSyn || name);
    return {
      definitive: true,
      hit: {
        sources: ['chembl'],
        preferredName: preferred,
        inn: innSyn ? innSyn.toLowerCase() : looksLikeInn(preferred) ? preferred.toLowerCase() : null,
        chemblId,
        modality: modalityFromChemblType(mol.molecule_type),
        maxPhase: chemblPhaseToSlug(mol.max_phase),
        aliases,
      },
    };
  }
  return { hit: null, definitive: true };
}

async function pubchemLookup(name: string, budget: ExternalBudget): Promise<LookupOutcome> {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/synonyms/JSON`;
  const outcome = await getJson(url, budget, 'pubchem');
  if (outcome.status === 'denied' || outcome.status === 'error') return NO_ANSWER;
  const json = outcome.status === 'ok'
    ? (outcome.json as { InformationList?: { Information?: Array<{ CID?: number; Synonym?: string[] }> } } | null)
    : null;
  const info = json?.InformationList?.Information?.[0];
  if (!info?.CID) return { hit: null, definitive: true };
  const syns = (info.Synonym ?? []).filter(Boolean);
  const aliases: AliasInput[] = [];
  let cas: string | null = null;
  let unii: string | null = null;
  let drugbank: string | null = null;
  let chembl: string | null = null;
  let inn: string | null = null;
  for (const s of syns.slice(0, 80)) {
    if (/^\d{2,7}-\d{2}-\d$/.test(s)) { cas = cas ?? s; pushAlias(aliases, s, 'pubchem', 'cas'); continue; }
    if (/^CHEMBL\d+$/i.test(s)) { chembl = chembl ?? s.toUpperCase(); pushAlias(aliases, s.toUpperCase(), 'pubchem', 'chembl'); continue; }
    if (/^DB\d{5}$/.test(s)) { drugbank = drugbank ?? s; continue; }
    if (/^UNII-([A-Z0-9]{10})$/.test(s)) { const u = s.slice(5); unii = unii ?? u; pushAlias(aliases, u, 'pubchem', 'unii'); continue; }
    if (/^[A-Z0-9]{10}$/.test(s) && /[A-Z]/.test(s) && /\d/.test(s) && !isCodeName(s)) { unii = unii ?? s; pushAlias(aliases, s, 'pubchem', 'unii'); continue; }
    if (isNoiseAlias(s)) continue;
    const t = classifyAlias(s);
    if (t === 'inn' && !inn) inn = s.toLowerCase();
    if (t === 'inn' || t === 'code' || t === 'brand') pushAlias(aliases, t === 'inn' ? s.toLowerCase() : s, 'pubchem', t);
    if (aliases.length >= 30) break;
  }
  const preferred = inn ?? syns.find(s => !isNoiseAlias(s) && /^[A-Za-z][A-Za-z -]+$/.test(s)) ?? name;
  return {
    definitive: true,
    hit: {
      sources: ['pubchem'],
      preferredName: preferred,
      inn,
      unii,
      casNumber: cas,
      chemblId: chembl,
      drugbankId: drugbank,
      pubchemCid: info.CID,
      modality: null,
      aliases,
    },
  };
}

function mergeHits(name: string, parts: Array<Partial<ExternalHit> | null>): ExternalHit | null {
  const present = parts.filter((p): p is Partial<ExternalHit> => !!p);
  if (present.length === 0) return null;
  const sources = present.flatMap(p => p.sources ?? []);
  const pick = <K extends keyof ExternalHit>(k: K): ExternalHit[K] | null => {
    for (const p of present) {
      const v = p[k];
      if (v !== undefined && v !== null && v !== '') return v as ExternalHit[K];
    }
    return null;
  };
  const hasGsrs = sources.includes('gsrs');
  const hasChembl = sources.includes('chembl');
  const confidence = hasGsrs && hasChembl ? 92 : hasGsrs ? 85 : hasChembl ? 80 : 65;
  const preferredName = pick('inn') ?? pick('preferredName') ?? name;
  return {
    sources,
    preferredName,
    inn: pick('inn'),
    unii: pick('unii'),
    chemblId: pick('chemblId'),
    pubchemCid: pick('pubchemCid'),
    casNumber: pick('casNumber'),
    drugbankId: pick('drugbankId'),
    ncitCode: pick('ncitCode'),
    modality: pick('modality') ?? inferModalityFromName(preferredName),
    maxPhase: pick('maxPhase'),
    aliases: present.flatMap(p => p.aliases ?? []),
    confidence,
  };
}

/**
 * GSRS and ChEMBL in parallel (independent hosts), PubChem only when both
 * miss. Hits and definitive misses are cached in memory for the life of the
 * lambda; a definitive miss (every host answered) is also queued for the
 * persistent negative cache. A miss caused by budget exhaustion or a network
 * error is not cached anywhere.
 */
export async function lookupExternal(name: string, budget: ExternalBudget): Promise<ExternalHit | null> {
  const key = normalizeKey(name);
  if (!key || containsCJK(name)) return null;
  if (externalCache.has(key)) return externalCache.get(key) ?? null;
  if (negativeKeys.has(key)) {
    negativeCacheHits++;
    return null;
  }
  const running = inflightLookups.get(key);
  if (running) return running;
  if (!budget.canCall()) return null;

  const task = (async (): Promise<ExternalHit | null> => {
    try {
      const [gsrs, chembl] = await Promise.all([gsrsLookup(name, budget), chemblLookup(name, budget)]);
      let pubchem: LookupOutcome = { hit: null, definitive: true };
      if (!gsrs.hit && !chembl.hit) pubchem = await pubchemLookup(name, budget);
      const hit = mergeHits(name, [gsrs.hit, chembl.hit, pubchem.hit]);
      if (hit) {
        externalCache.set(key, hit);
      } else if (gsrs.definitive && chembl.definitive && pubchem.definitive) {
        externalCache.set(key, null);
        negativeKeys.add(key);
        pendingNegatives.set(key, [...EXTERNAL_HOSTS]);
      }
      return hit;
    } finally {
      inflightLookups.delete(key);
    }
  })();
  inflightLookups.set(key, task);
  return task;
}

/** Load fresh negative-cache rows for these keys into memory. Returns the number loaded. */
async function preloadNegativeCache(supabase: SupabaseClient, keys: string[]): Promise<{ loaded: number; error?: string }> {
  const uniq = [...new Set(keys.filter(k => k && !negativeKeys.has(k)))];
  if (uniq.length === 0) return { loaded: 0 };
  const cutoff = new Date(Date.now() - NEGATIVE_CACHE_TTL_DAYS * 86_400_000).toISOString();
  let loaded = 0;
  for (const part of chunks(uniq, IN_CHUNK)) {
    const { data, error } = await supabase
      .from('drug_resolve_negative_cache')
      .select('alias_normalized, checked_at')
      .in('alias_normalized', part)
      .gte('checked_at', cutoff)
      .range(0, PAGE_SIZE - 1);
    if (error) return { loaded, error: `negative cache read failed: ${error.message}` };
    for (const row of (data ?? []) as Array<{ alias_normalized: string; checked_at: string }>) {
      if (!isNegativeCacheFresh(row.checked_at)) continue;
      negativeKeys.add(row.alias_normalized);
      loaded++;
    }
  }
  return { loaded };
}

/** Write this run's definitive misses back to drug_resolve_negative_cache. */
async function flushNegativeCache(supabase: SupabaseClient): Promise<{ written: number; error?: string }> {
  if (pendingNegatives.size === 0) return { written: 0 };
  const keys = [...pendingNegatives.keys()];
  const attempts = new Map<string, number>();
  for (const part of chunks(keys, IN_CHUNK)) {
    const { data, error } = await supabase
      .from('drug_resolve_negative_cache')
      .select('alias_normalized, attempts')
      .in('alias_normalized', part)
      .range(0, PAGE_SIZE - 1);
    if (error) return { written: 0, error: `negative cache read failed: ${error.message}` };
    for (const row of (data ?? []) as Array<{ alias_normalized: string; attempts: number | null }>) {
      attempts.set(row.alias_normalized, row.attempts ?? 1);
    }
  }
  const nowIso = new Date().toISOString();
  const rows = keys.map(k => ({
    alias_normalized: k,
    checked_at: nowIso,
    attempts: (attempts.get(k) ?? 0) + 1,
    sources: pendingNegatives.get(k) ?? [],
  }));
  let written = 0;
  for (const part of chunks(rows, WRITE_CHUNK)) {
    const { error } = await supabase.from('drug_resolve_negative_cache').upsert(part, { onConflict: 'alias_normalized' });
    if (error) return { written, error: `negative cache write failed: ${error.message}` };
    written += part.length;
    for (const r of part) pendingNegatives.delete(r.alias_normalized);
  }
  return { written };
}

// ═══════════════════════════════════════════════════════════════════════
// DATABASE HELPERS
// ═══════════════════════════════════════════════════════════════════════

interface AliasHit {
  drug_id: string;
  alias_normalized: string;
  alias_type: AliasType;
}

async function findAliasHits(supabase: SupabaseClient, keys: string[]): Promise<AliasHit[]> {
  const uniq = [...new Set(keys.filter(Boolean))];
  if (uniq.length === 0) return [];
  const { data, error } = await supabase
    .from('drug_aliases')
    .select('drug_id, alias_normalized, alias_type')
    .in('alias_normalized', uniq);
  if (error) throw new Error(`drug_aliases lookup failed: ${error.message}`);
  return (data ?? []) as AliasHit[];
}

async function findInnFuzzyHits(supabase: SupabaseClient, key: string): Promise<AliasHit[]> {
  if (key.length < 8 || /\d/.test(key)) return [];
  const { data, error } = await supabase
    .from('drug_aliases')
    .select('drug_id, alias_normalized, alias_type')
    .eq('alias_type', 'inn')
    .like('alias_normalized', `${key.slice(0, 4)}%`)
    .limit(200);
  if (error) throw new Error(`drug_aliases fuzzy lookup failed: ${error.message}`);
  return ((data ?? []) as AliasHit[]).filter(h => innFuzzyEqual(h.alias_normalized, key));
}

async function getDrug(supabase: SupabaseClient, id: string): Promise<DrugMasterRow | null> {
  const { data, error } = await supabase.from('drug_master').select(DRUG_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(`drug_master read failed: ${error.message}`);
  return (data as DrugMasterRow | null) ?? null;
}

async function findDrugByExternalIds(
  supabase: SupabaseClient,
  ids: { unii?: string | null; chemblId?: string | null; pubchemCid?: number | null },
): Promise<DrugMasterRow | null> {
  const ors: string[] = [];
  if (ids.unii) ors.push(`unii.eq.${ids.unii}`);
  if (ids.chemblId) ors.push(`chembl_id.eq.${ids.chemblId}`);
  if (ids.pubchemCid) ors.push(`pubchem_cid.eq.${ids.pubchemCid}`);
  if (ors.length === 0) return null;
  const { data, error } = await supabase
    .from('drug_master')
    .select(DRUG_COLUMNS)
    .or(ors.join(','))
    .order('confidence', { ascending: false })
    .limit(1);
  if (error) throw new Error(`drug_master external-id lookup failed: ${error.message}`);
  return ((data ?? [])[0] as DrugMasterRow | undefined) ?? null;
}

function safeModality(m: string | null | undefined): RadarModality | null {
  return m && isRadarValue(RADAR_MODALITY_OPTIONS, m) ? (m as RadarModality) : null;
}

/** Insert aliases, ignoring ones already present for the drug. Returns rows attempted. */
async function recordAliases(supabase: SupabaseClient, drugId: string, aliases: AliasInput[]): Promise<number> {
  const byKey = new Map<string, AliasInput>();
  for (const a of aliases) {
    const k = normalizeKey(a.alias);
    if (!k || k.length > 200) continue;
    if (!byKey.has(k)) byKey.set(k, a);
  }
  const rows = [...byKey.entries()].slice(0, MAX_ALIASES_PER_DRUG).map(([k, a]) => ({
    drug_id: drugId,
    alias: a.alias.slice(0, 200),
    alias_normalized: k,
    alias_type: a.type,
    source: a.source,
  }));
  if (rows.length === 0) return 0;
  const { error } = await supabase
    .from('drug_aliases')
    .upsert(rows, { onConflict: 'alias_normalized,drug_id', ignoreDuplicates: true });
  if (error) throw new Error(`drug_aliases write failed: ${error.message}`);
  return rows.length;
}

async function insertDrug(supabase: SupabaseClient, row: Record<string, unknown>): Promise<DrugMasterRow> {
  const { data, error } = await supabase.from('drug_master').insert(row).select(DRUG_COLUMNS).single();
  if (error) throw new Error(`drug_master insert failed: ${error.message}`);
  return data as DrugMasterRow;
}

async function updateDrug(supabase: SupabaseClient, id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('drug_master').update(patch).eq('id', id);
  if (error) throw new Error(`drug_master update failed: ${error.message}`);
}

/** Fields from an external hit that fill gaps on an existing row (never overwrite a non-null value). */
function fillPatch(existing: DrugMasterRow, hit: ExternalHit): Record<string, unknown> {
  const patch: Record<string, unknown> = { external_checked_at: new Date().toISOString() };
  if (!existing.inn && hit.inn) patch.inn = hit.inn;
  if (!existing.unii && hit.unii) patch.unii = hit.unii;
  if (!existing.chembl_id && hit.chemblId) patch.chembl_id = hit.chemblId;
  if (!existing.pubchem_cid && hit.pubchemCid) patch.pubchem_cid = hit.pubchemCid;
  if (!existing.cas_number && hit.casNumber) patch.cas_number = hit.casNumber;
  if (!existing.drugbank_id && hit.drugbankId) patch.drugbank_id = hit.drugbankId;
  if (!existing.ncit_code && hit.ncitCode) patch.ncit_code = hit.ncitCode;
  if (!existing.modality && hit.modality) patch.modality = hit.modality;
  if (!existing.max_phase && hit.maxPhase) patch.max_phase = hit.maxPhase;
  if (existing.source === 'internal') {
    patch.source = hit.sources.join('+');
    patch.confidence = hit.confidence;
    patch.preferred_name = hit.preferredName;
  } else if (hit.confidence > existing.confidence) {
    patch.confidence = hit.confidence;
    patch.source = [...new Set([...existing.source.split('+'), ...hit.sources])].join('+');
  }
  return patch;
}

/**
 * Point everything at `canonicalId` and remove the internal row. Used when an
 * internal row later resolves to a public identifier already held by another row.
 */
async function mergeInternalInto(supabase: SupabaseClient, internalId: string, canonicalId: string): Promise<void> {
  if (internalId === canonicalId) return;
  const { data: aliases, error: aliasErr } = await supabase
    .from('drug_aliases')
    .select('alias, alias_normalized, alias_type, source')
    .eq('drug_id', internalId)
    .range(0, PAGE_SIZE - 1);
  if (aliasErr) throw new Error(`merge: drug_aliases read failed: ${aliasErr.message}`);
  if (aliases && aliases.length > 0) {
    const { error } = await supabase.from('drug_aliases').upsert(
      aliases.map(a => ({ ...a, drug_id: canonicalId })),
      { onConflict: 'alias_normalized,drug_id', ignoreDuplicates: true },
    );
    if (error) throw new Error(`merge: drug_aliases write failed: ${error.message}`);
  }
  const { data: owners, error: ownerErr } = await supabase
    .from('drug_owners')
    .select('company_id, role, territory, evidence_type, evidence_id')
    .eq('drug_id', internalId)
    .range(0, PAGE_SIZE - 1);
  if (ownerErr) throw new Error(`merge: drug_owners read failed: ${ownerErr.message}`);
  if (owners && owners.length > 0) {
    const { error } = await supabase.from('drug_owners').upsert(
      owners.map(o => ({ ...o, drug_id: canonicalId })),
      { onConflict: 'drug_id,company_id,role,territory', ignoreDuplicates: true },
    );
    if (error) throw new Error(`merge: drug_owners write failed: ${error.message}`);
  }
  const { error: repointErr } = await supabase.from('clinical_assets').update({ drug_master_id: canonicalId }).eq('drug_master_id', internalId);
  if (repointErr) throw new Error(`merge: clinical_assets repoint failed: ${repointErr.message}`);
  // combinations referencing the internal component
  const { data: combos, error: comboErr } = await supabase
    .from('drug_master')
    .select('id, component_drug_ids')
    .contains('component_drug_ids', [internalId])
    .range(0, PAGE_SIZE - 1);
  if (comboErr) throw new Error(`merge: combination read failed: ${comboErr.message}`);
  for (const c of (combos ?? []) as Array<{ id: string; component_drug_ids: string[] }>) {
    const next = [...new Set(c.component_drug_ids.map(id => (id === internalId ? canonicalId : id)))].sort();
    const { error } = await supabase.from('drug_master').update({ component_drug_ids: next }).eq('id', c.id);
    if (error) throw new Error(`merge: combination update failed: ${error.message}`);
  }
  const { error: deleteErr } = await supabase.from('drug_master').delete().eq('id', internalId);
  if (deleteErr) throw new Error(`merge: drug_master delete failed: ${deleteErr.message}`);
}

// ═══════════════════════════════════════════════════════════════════════
// SINGLE-DRUG RESOLUTION
// ═══════════════════════════════════════════════════════════════════════

interface Ctx {
  supabase: SupabaseClient;
  allowExternal: boolean;
  budget: ExternalBudget;
  aliasSource: string;
  createInternal: boolean;
}

/** No drug row yet and none created: the cron will resolve this asset later. */
function deferred(preferredName: string | null): ResolveDrugResult {
  return {
    drugId: null,
    confidence: 0,
    status: 'unresolvable',
    matchedVia: 'none',
    preferredName,
    isCombination: false,
    componentDrugIds: [],
    modality: preferredName ? inferModalityFromName(preferredName) : null,
    aliasesRecorded: 0,
    externalCalls: 0,
  };
}

function inputAliases(n: NormalizedDrugName, extra: string[], source: string): AliasInput[] {
  const out: AliasInput[] = [];
  for (const c of [...n.candidates, ...extra]) {
    const a = c.trim();
    if (!a || a.length > 200) continue;
    out.push({ alias: a, type: classifyAlias(a), source });
  }
  return out;
}

function resultFromDrug(
  drug: DrugMasterRow,
  matchedVia: MatchedVia,
  extras: Partial<ResolveDrugResult> = {},
): ResolveDrugResult {
  const internal = drug.source === 'internal';
  const conf = extras.confidence ?? drug.confidence;
  const status: DrugResolutionStatus =
    extras.status ?? (internal || conf < RESOLVED_MIN_CONFIDENCE ? 'unresolvable' : 'resolved');
  return {
    drugId: drug.id,
    confidence: conf,
    status,
    matchedVia,
    preferredName: drug.preferred_name,
    isCombination: drug.is_combination,
    componentDrugIds: drug.component_drug_ids ?? [],
    modality: safeModality(drug.modality),
    aliasesRecorded: 0,
    externalCalls: 0,
    ...extras,
  };
}

function noRow(reason: NonDrugReason, preferredName: string | null = null): ResolveDrugResult {
  return {
    drugId: null,
    confidence: 0,
    status: 'unresolvable',
    matchedVia: 'none',
    reason,
    preferredName,
    isCombination: false,
    componentDrugIds: [],
    modality: null,
    aliasesRecorded: 0,
    externalCalls: 0,
  };
}

function isStale(iso: string | null): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > INTERNAL_RECHECK_DAYS * 86_400_000;
}

/** Pick one drug from several alias hits, preferring code then INN matches. */
function disambiguate(
  hits: AliasHit[],
  n: NormalizedDrugName,
): { drugId: string; via: MatchedVia; ambiguous: boolean } | null {
  if (hits.length === 0) return null;
  const drugIds = [...new Set(hits.map(h => h.drug_id))];
  if (drugIds.length === 1) {
    const codeKeys = new Set(n.codeNames.map(normalizeKey));
    const viaCode = hits.some(h => h.alias_type === 'code' && codeKeys.has(h.alias_normalized));
    return { drugId: drugIds[0], via: viaCode ? 'code' : 'alias', ambiguous: false };
  }
  const codeKeys = new Set(n.codeNames.map(normalizeKey));
  const byCode = [...new Set(hits.filter(h => h.alias_type === 'code' && codeKeys.has(h.alias_normalized)).map(h => h.drug_id))];
  if (byCode.length === 1) return { drugId: byCode[0], via: 'code', ambiguous: false };
  const byInn = [...new Set(hits.filter(h => h.alias_type === 'inn').map(h => h.drug_id))];
  if (byInn.length === 1) return { drugId: byInn[0], via: 'inn', ambiguous: false };
  // Most alias matches wins, flagged ambiguous.
  const counts = new Map<string, number>();
  for (const h of hits) counts.set(h.drug_id, (counts.get(h.drug_id) ?? 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { drugId: best, via: 'alias', ambiguous: true };
}

async function resolveSingle(ctx: Ctx, raw: string, extraNames: string[]): Promise<ResolveDrugResult> {
  const { supabase } = ctx;
  const n = normalizeDrugName(raw);

  if (n.reason === 'empty' || n.reason === 'placebo' || n.reason === 'non_drug') {
    return noRow(n.reason, n.display || null);
  }

  // Extra raw names for the same asset contribute candidates when they are not combinations.
  const extraCandidates: string[] = [];
  for (const e of extraNames) {
    if (!e || containsCJK(e)) continue;
    const sp = splitCombination(e);
    if (sp.isCombination) continue;
    const en = normalizeDrugName(sp.components[0] ?? e);
    if (en.reason) continue;
    extraCandidates.push(...en.candidates);
  }
  const allCandidates = [...new Set([...n.candidates, ...extraCandidates])];
  const keys = allCandidates.map(normalizeKey).filter(Boolean);

  // CJK: exact alias only, no external, no fuzzy.
  if (n.reason === 'cjk') {
    const hits = await findAliasHits(supabase, [n.key].filter(Boolean));
    if (hits.length > 0) {
      const drug = await getDrug(supabase, hits[0].drug_id);
      if (drug) return { ...resultFromDrug(drug, 'alias', { status: 'unresolvable' }), reason: 'cjk' };
    }
    if (!ctx.createInternal) return { ...deferred(n.display), reason: 'cjk' };
    const drug = await insertDrug(supabase, {
      preferred_name: n.display.slice(0, 200),
      source: 'internal',
      confidence: INTERNAL_CONFIDENCE,
    });
    const recorded = await recordAliases(supabase, drug.id, [{ alias: n.display, type: 'other', source: ctx.aliasSource }]);
    return { ...resultFromDrug(drug, 'internal', { status: 'unresolvable', aliasesRecorded: recorded }), reason: 'cjk' };
  }

  // (a)+(b) exact alias / code hits
  const hits = await findAliasHits(supabase, keys);
  let picked = disambiguate(hits, n);

  // (c) INN fuzzy on INN-looking candidates only
  if (!picked) {
    for (const c of allCandidates) {
      if (!looksLikeInn(c)) continue;
      const fuzzy = await findInnFuzzyHits(supabase, normalizeKey(c));
      if (fuzzy.length === 0) continue;
      const d = disambiguate(fuzzy, n);
      if (d) {
        picked = { ...d, via: 'inn_fuzzy' };
        break;
      }
    }
  }

  if (picked) {
    const drug = await getDrug(supabase, picked.drugId);
    if (drug) {
      const recorded = await recordAliases(supabase, drug.id, inputAliases(n, extraCandidates, ctx.aliasSource));
      if (picked.ambiguous) {
        return resultFromDrug(drug, picked.via, { status: 'ambiguous', confidence: AMBIGUOUS_CONFIDENCE, aliasesRecorded: recorded });
      }
      // Internal row: try once more externally if it has not been checked recently.
      if (drug.source === 'internal' && ctx.allowExternal && isStale(drug.external_checked_at)) {
        const upgraded = await upgradeInternal(ctx, drug, n, allCandidates);
        if (upgraded) return { ...upgraded, aliasesRecorded: upgraded.aliasesRecorded + recorded };
        await updateDrug(supabase, drug.id, { external_checked_at: new Date().toISOString() });
      }
      const conf = picked.via === 'inn_fuzzy' ? Math.min(drug.confidence, 75) : drug.confidence;
      return resultFromDrug(drug, picked.via, { confidence: conf, aliasesRecorded: recorded });
    }
  }

  // (d) external lookups, most specific candidate first: INN, then code, then display.
  if (ctx.allowExternal) {
    const ordered = [
      ...allCandidates.filter(looksLikeInn),
      ...allCandidates.filter(isCodeName),
      ...allCandidates.filter(c => !looksLikeInn(c) && !isCodeName(c)),
    ].slice(0, 3);
    for (const candidate of ordered) {
      if (!ctx.budget.canCall()) break;
      const before = ctx.budget.used;
      const hit = await lookupExternal(candidate, ctx.budget);
      const calls = ctx.budget.used - before;
      if (!hit) continue;
      const created = await drugFromHit(ctx, hit, n, extraCandidates);
      return { ...created, externalCalls: created.externalCalls + calls };
    }
  }

  // (e) internal row
  if (!ctx.createInternal) return deferred(n.display);
  const drug = await insertDrug(supabase, {
    preferred_name: n.display.slice(0, 200),
    inn: looksLikeInn(n.display) ? n.display.toLowerCase() : null,
    modality: inferModalityFromName(n.display),
    source: 'internal',
    confidence: INTERNAL_CONFIDENCE,
    external_checked_at: ctx.allowExternal && ctx.budget.canCall() ? new Date().toISOString() : null,
  });
  const recorded = await recordAliases(supabase, drug.id, inputAliases(n, extraCandidates, ctx.aliasSource));
  return resultFromDrug(drug, 'internal', { status: 'unresolvable', aliasesRecorded: recorded });
}

/** Create or reuse a drug_master row for an external hit and record all aliases. */
async function drugFromHit(
  ctx: Ctx,
  hit: ExternalHit,
  n: NormalizedDrugName,
  extraCandidates: string[],
): Promise<ResolveDrugResult> {
  const { supabase } = ctx;
  const via = hit.sources.join('+') as MatchedVia;
  const existing = await findDrugByExternalIds(supabase, { unii: hit.unii, chemblId: hit.chemblId, pubchemCid: hit.pubchemCid });
  let drug: DrugMasterRow;
  if (existing) {
    await updateDrug(supabase, existing.id, fillPatch(existing, hit));
    drug = (await getDrug(supabase, existing.id)) ?? existing;
  } else {
    drug = await insertDrug(supabase, {
      preferred_name: hit.preferredName.slice(0, 200),
      inn: hit.inn,
      unii: hit.unii,
      chembl_id: hit.chemblId,
      pubchem_cid: hit.pubchemCid,
      cas_number: hit.casNumber,
      drugbank_id: hit.drugbankId,
      ncit_code: hit.ncitCode,
      modality: hit.modality,
      max_phase: hit.maxPhase,
      source: hit.sources.join('+'),
      confidence: hit.confidence,
      external_checked_at: new Date().toISOString(),
    });
  }
  const recorded = await recordAliases(supabase, drug.id, [...hit.aliases, ...inputAliases(n, extraCandidates, ctx.aliasSource)]);
  return resultFromDrug(drug, via, { confidence: Math.max(drug.confidence, hit.confidence), status: 'resolved', aliasesRecorded: recorded });
}

/** An internal row that now matches externally: fill it in, or merge it into the existing public row. */
async function upgradeInternal(
  ctx: Ctx,
  internal: DrugMasterRow,
  n: NormalizedDrugName,
  candidates: string[],
): Promise<ResolveDrugResult | null> {
  const ordered = [
    ...candidates.filter(looksLikeInn),
    ...candidates.filter(isCodeName),
    ...candidates.filter(c => !looksLikeInn(c) && !isCodeName(c)),
  ].slice(0, 2);
  for (const candidate of ordered) {
    if (!ctx.budget.canCall()) return null;
    const before = ctx.budget.used;
    const hit = await lookupExternal(candidate, ctx.budget);
    const calls = ctx.budget.used - before;
    if (!hit) continue;
    const canonical = await findDrugByExternalIds(ctx.supabase, { unii: hit.unii, chemblId: hit.chemblId, pubchemCid: hit.pubchemCid });
    if (canonical && canonical.id !== internal.id) {
      await mergeInternalInto(ctx.supabase, internal.id, canonical.id);
      await updateDrug(ctx.supabase, canonical.id, fillPatch(canonical, hit));
      const drug = (await getDrug(ctx.supabase, canonical.id)) ?? canonical;
      const recorded = await recordAliases(ctx.supabase, drug.id, [...hit.aliases, ...inputAliases(n, [], ctx.aliasSource)]);
      return resultFromDrug(drug, hit.sources.join('+') as MatchedVia, { status: 'resolved', aliasesRecorded: recorded, externalCalls: calls });
    }
    await updateDrug(ctx.supabase, internal.id, fillPatch(internal, hit));
    const drug = (await getDrug(ctx.supabase, internal.id)) ?? internal;
    const recorded = await recordAliases(ctx.supabase, drug.id, hit.aliases);
    return resultFromDrug(drug, hit.sources.join('+') as MatchedVia, { status: 'resolved', confidence: hit.confidence, aliasesRecorded: recorded, externalCalls: calls });
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// COMBINATIONS
// ═══════════════════════════════════════════════════════════════════════

function combinationAliasKey(ids: string[]): string {
  return `combination:${[...ids].sort().join('+')}`;
}

async function resolveCombination(ctx: Ctx, raw: string, components: string[]): Promise<ResolveDrugResult> {
  const { supabase } = ctx;
  const parts: ResolveDrugResult[] = [];
  let externalCalls = 0;
  let aliasesRecorded = 0;
  for (const c of components) {
    const r = await resolveSingle(ctx, c, []);
    externalCalls += r.externalCalls;
    aliasesRecorded += r.aliasesRecorded;
    if (r.drugId) parts.push(r);
  }
  if (parts.length === 0) return { ...noRow('placebo', raw), externalCalls };
  if (parts.length === 1) return { ...parts[0], externalCalls, aliasesRecorded };

  const ids = [...new Set(parts.map(p => p.drugId as string))].sort();
  const key = normalizeKey(combinationAliasKey(ids));
  const hits = await findAliasHits(supabase, [key]);
  let drug: DrugMasterRow | null = hits.length > 0 ? await getDrug(supabase, hits[0].drug_id) : null;
  const minConf = Math.min(...parts.map(p => p.confidence));
  const allResolved = parts.every(p => p.status === 'resolved');

  if (!drug) {
    const names = parts.map(p => p.preferredName ?? '').filter(Boolean);
    drug = await insertDrug(supabase, {
      preferred_name: names.join(' + ').slice(0, 200),
      is_combination: true,
      component_drug_ids: ids,
      source: 'combination',
      confidence: minConf,
    });
    aliasesRecorded += await recordAliases(supabase, drug.id, [
      { alias: combinationAliasKey(ids), type: 'other', source: 'internal' },
    ]);
  } else if (drug.confidence !== minConf) {
    await updateDrug(supabase, drug.id, { confidence: minConf });
  }
  aliasesRecorded += await recordAliases(supabase, drug.id, [{ alias: raw.trim().slice(0, 200), type: 'synonym', source: ctx.aliasSource }]);

  return {
    drugId: drug.id,
    confidence: minConf,
    status: allResolved ? 'resolved' : 'unresolvable',
    matchedVia: 'combination',
    preferredName: drug.preferred_name,
    isCombination: true,
    componentDrugIds: ids,
    modality: null,
    aliasesRecorded,
    externalCalls,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

/**
 * Resolve one intervention string to a drug_master node.
 *
 * Index-time integration (asset-universe.ts): call with
 * `{ allowExternal: false }` so no network is touched while indexing; the
 * cron fills in the rest.
 */
export async function resolveDrug(
  supabase: SupabaseClient,
  input: ResolveDrugInput,
  options: ResolveOptions = {},
): Promise<ResolveDrugResult> {
  const allowExternal = options.allowExternal ?? true;
  const ctx: Ctx = {
    supabase,
    allowExternal,
    budget: options.budget ?? new ExternalBudget(allowExternal ? 9 : 0),
    aliasSource: options.aliasSource ?? 'clinicaltrials',
    createInternal: options.createInternalRow ?? true,
  };

  const raw = (input.rawName ?? '').trim();
  if (!raw) return noRow('empty');
  const type = (input.interventionType ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  if (type && NON_DRUG_INTERVENTION_TYPES.has(type)) return noRow('non_drug', raw);

  const split = splitCombination(raw);
  if (split.components.length === 0) {
    const n = normalizeDrugName(raw);
    return noRow(n.reason ?? 'placebo', n.display || raw);
  }
  if (split.isCombination) return resolveCombination(ctx, raw, split.components);
  return resolveSingle(ctx, split.components[0], (input.otherNames ?? []).filter(Boolean));
}

/**
 * Local-only cascade (aliases, codes, INN, fuzzy INN). No network, no new
 * rows: a miss returns drugId null with status 'unresolvable' so the caller
 * leaves the asset 'unresolved' for the cron. This is the index-time entry
 * point for asset-universe.ts.
 */
export function resolveDrugLocal(
  supabase: SupabaseClient,
  input: ResolveDrugInput,
  aliasSource = 'clinicaltrials',
): Promise<ResolveDrugResult> {
  return resolveDrug(supabase, input, { allowExternal: false, aliasSource, createInternalRow: false });
}

// ═══════════════════════════════════════════════════════════════════════
// BATCH RESOLVER (cron)
// ═══════════════════════════════════════════════════════════════════════

export interface BatchOptions {
  /** Assets the local pass takes from the queue per run (default 5,000). */
  limit?: number;
  /** Wall-clock budget (default 250 s). */
  timeBudgetMs?: number;
  /** Query GSRS/ChEMBL/PubChem (default true). */
  allowExternal?: boolean;
  /** Hard cap on external calls per run (default 2,400 ≈ 10 req/s across the three hosts × 240 s). */
  maxExternalCalls?: number;
  /** Internal drug rows the external pass takes per run (default 900). */
  externalLimit?: number;
  /** Drug rows resolved concurrently in the external pass (default 4). */
  externalConcurrency?: number;
  /** Re-check internal rows whose last external check is older than this (default 30 days). */
  recheckDays?: number;
  runType?: 'scheduled' | 'manual' | 'backfill';
}

export interface DuplicateGroup {
  drug_master_id: string;
  preferred_name: string | null;
  companies: number;
  assets: number;
  sample_assets: string[];
}

export interface LocalPassStats {
  fetched: number;
  nonDrug: number;
  resolved: number;
  ambiguous: number;
  /** Assets keyed on an internal (no public id) row. */
  unresolvableInternal: number;
  /** Non-industry misses: stamped drug_resolved_at, left in the queue for the external tail. */
  leftUnresolved: number;
  internalCreated: number;
  combinations: number;
  combinationsCreated: number;
  aliasesRecorded: number;
  ownersWritten: number;
  aliasLookups: number;
}

export interface ExternalPassStats {
  drugsQueued: number;
  drugsChecked: number;
  /** Internal row filled in from a hit. */
  upgraded: number;
  /** Internal row merged into an existing public row. */
  merged: number;
  /** Internal row merged into a public row by conservative INN fuzzy, no network. */
  fuzzyMerged: number;
  misses: number;
  /** Assets flipped to 'resolved' by drug-level upgrades. */
  assetsResolved: number;
  /** Still-unresolved (non-industry) assets run through the per-asset path. */
  assetsTail: number;
  externalCalls: number;
  callsByHost: Record<ExternalHost, number>;
  negativeCacheHits: number;
  negativesPreloaded: number;
  negativesWritten: number;
  budgetExhausted: boolean;
}

export interface BacklogEstimate {
  unresolved: number | null;
  unresolvedNeverAttempted: number | null;
  internalPendingExternal: number | null;
  resolved: number | null;
  estimatedLocalRunsRemaining: number | null;
  estimatedExternalRunsRemaining: number | null;
}

export interface BatchResult {
  fetched: number;
  processed: number;
  resolved: number;
  ambiguous: number;
  unresolvable: number;
  /** Placebo / procedure / empty: status set, no drug row. */
  nonDrug: number;
  failed: number;
  combinations: number;
  drugsCreated: number;
  aliasesRecorded: number;
  ownersWritten: number;
  externalCalls: number;
  local: LocalPassStats;
  external: ExternalPassStats;
  backlog: BacklogEstimate;
  crossCompanyDuplicates: { count: number; groups: DuplicateGroup[] };
  timedOut: boolean;
  errors: string[];
  logged: boolean;
  durationMs: number;
}

interface AssetRow {
  id: string;
  company_id: string | null;
  company_name: string;
  asset_name: string;
  asset_aliases: string[] | null;
  modality: string | null;
  phase: string | null;
  partnership_status: string | null;
  drug_resolution_status: string | null;
  drug_resolved_at: string | null;
  created_at: string;
}

const ASSET_COLUMNS =
  'id, company_id, company_name, asset_name, asset_aliases, modality, phase, partnership_status, drug_resolution_status, drug_resolved_at, created_at';

/** companies.owner_type values that get an internal drug_master row on a local miss. */
const INTERNAL_ROW_OWNER_TYPES = new Set(['industry']);

const PHASE_RANK: Record<string, number> = {
  phase_4: 7, phase_3: 6, phase_2_3: 5, phase_2: 4, phase_1_2: 3, phase_1: 2, early_phase_1: 1,
};

// ── Pure planning helpers (unit-tested) ──────────────────────────────────

export interface LocalUnit {
  /** Unit identity: normalizeKey of the cleaned display (or the raw CJK string). */
  key: string;
  n: NormalizedDrugName;
  /** Display strings worth recording as aliases. */
  candidates: string[];
  /** Matching keys to look up in drug_aliases. */
  candidateKeys: string[];
  /** Candidates contributed by asset_aliases (singles only). */
  extraCandidates: string[];
  cjk: boolean;
}

export interface LocalPlan {
  kind: 'non_drug' | 'single' | 'combination';
  reason?: NonDrugReason;
  display: string | null;
  units: LocalUnit[];
}

function extraCandidatesFrom(extraNames: readonly string[]): string[] {
  const out: string[] = [];
  for (const e of extraNames) {
    if (!e || containsCJK(e)) continue;
    const sp = splitCombination(e);
    if (sp.isCombination) continue;
    const en = normalizeDrugName(sp.components[0] ?? e);
    if (en.reason) continue;
    out.push(...en.candidates);
  }
  return out;
}

function unitFor(component: string, extraNames: readonly string[]): LocalUnit | null {
  const n = normalizeDrugName(component);
  if (n.reason === 'empty' || n.reason === 'placebo' || n.reason === 'non_drug') return null;
  if (n.reason === 'cjk') {
    return { key: n.key, n, candidates: [n.display], candidateKeys: n.key ? [n.key] : [], extraCandidates: [], cjk: true };
  }
  const extraCandidates = extraCandidatesFrom(extraNames);
  const seen = new Set<string>();
  const candidates: string[] = [];
  const candidateKeys: string[] = [];
  for (const c of [...n.candidates, ...extraCandidates]) {
    const k = normalizeKey(c);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    candidates.push(c);
    candidateKeys.push(k);
  }
  if (!n.key) return null;
  return { key: n.key, n, candidates, candidateKeys, extraCandidates, cjk: false };
}

/**
 * Plan one asset for the local pass: non-drug (placebo / procedure / empty),
 * a single unit, or a combination of units. Mirrors resolveDrug's routing
 * without touching the database: candidate keys are normalizeKey of the
 * cleaned name, its parenthetical INNs / codes, every extracted code name,
 * and (for singles) the same for each asset alias.
 */
export function planLocalResolution(rawName: string, otherNames: readonly string[] = []): LocalPlan {
  const raw = (rawName ?? '').trim();
  if (!raw) return { kind: 'non_drug', reason: 'empty', display: null, units: [] };
  const split = splitCombination(raw);
  if (split.components.length === 0) {
    const n = normalizeDrugName(raw);
    return { kind: 'non_drug', reason: n.reason ?? 'placebo', display: n.display || raw, units: [] };
  }
  const extras = split.isCombination ? [] : otherNames.filter(Boolean);
  const units: LocalUnit[] = [];
  const seen = new Set<string>();
  for (const component of split.components) {
    const u = unitFor(component, extras);
    if (!u || seen.has(u.key)) continue;
    seen.add(u.key);
    units.push(u);
  }
  if (units.length === 0) {
    const n = normalizeDrugName(raw);
    return { kind: 'non_drug', reason: n.reason ?? 'placebo', display: n.display || raw, units: [] };
  }
  return { kind: units.length > 1 ? 'combination' : 'single', display: units[0].n.display || raw, units };
}

/**
 * Union-find over candidate keys: units that share any key are one drug, so
 * "ABC-123", "ABC-123 (drugxumab)" and "drugxumab" under three sponsors get
 * one internal row instead of three.
 */
export function groupUnitsByCandidateKeys<T extends { candidateKeys: readonly string[] }>(units: readonly T[]): T[][] {
  const parent = units.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const owner = new Map<string, number>();
  units.forEach((u, i) => {
    for (const k of u.candidateKeys) {
      const o = owner.get(k);
      if (o === undefined) owner.set(k, i);
      else union(o, i);
    }
  });
  const groups = new Map<number, T[]>();
  units.forEach((u, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(u);
  });
  return [...groups.values()];
}

/** INN first (lowercased), then a code name, then the first display. */
export function pickInternalPreferredName(group: readonly LocalUnit[]): string {
  for (const u of group) for (const c of u.candidates) if (looksLikeInn(c)) return c.toLowerCase();
  for (const u of group) for (const c of u.candidates) if (isCodeName(c)) return c;
  return group[0]?.n.display ?? group[0]?.candidates[0] ?? '';
}

/**
 * External-pass priority: industry-owned first, then later phase, then the
 * number of assets a hit would resolve at once. Higher sorts first.
 */
export function externalPriority(item: { industry: boolean; phase?: string | null; assetCount?: number }): number {
  const phase = PHASE_RANK[item.phase ?? ''] ?? 0;
  return (item.industry ? 1000 : 0) + phase * 100 + Math.min(99, item.assetCount ?? 1);
}

export function prioritizeForExternal<T extends { industry: boolean; phase?: string | null; assetCount?: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => externalPriority(b) - externalPriority(a));
}

/** Asset status/confidence for a matched drug row (same rules as resultFromDrug). */
export function resolutionForDrug(
  drug: Pick<DrugMasterRow, 'source' | 'confidence'>,
  ambiguous: boolean,
): { status: DrugResolutionStatus; confidence: number } {
  if (ambiguous) return { status: 'ambiguous', confidence: AMBIGUOUS_CONFIDENCE };
  if (drug.source === 'internal' || drug.confidence < RESOLVED_MIN_CONFIDENCE) return { status: 'unresolvable', confidence: drug.confidence };
  return { status: 'resolved', confidence: drug.confidence };
}

// ── Queue ────────────────────────────────────────────────────────────────

/**
 * Oldest never-attempted assets first (drug_resolved_at NULL), then the ones
 * attempted longest ago, so non-industry misses rotate instead of blocking
 * the head of the queue. Pages with .range() (PostgREST caps at 1,000).
 */
async function fetchQueue(supabase: SupabaseClient, limit: number): Promise<AssetRow[]> {
  const cap = Math.max(1, limit);
  const out = await pagedSelect<AssetRow>('clinical_assets queue read', (from, to) =>
    supabase
      .from('clinical_assets')
      .select(ASSET_COLUMNS)
      .eq('drug_resolution_status', 'unresolved')
      .order('drug_resolved_at', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, Math.min(to, cap - 1)), cap);

  if (out.length < cap) {
    const cutoff = new Date(Date.now() - INTERNAL_RECHECK_DAYS * 86_400_000).toISOString();
    const room = cap - out.length;
    const ambiguous = await pagedSelect<AssetRow>('clinical_assets ambiguous queue read', (from, to) =>
      supabase
        .from('clinical_assets')
        .select(ASSET_COLUMNS)
        .eq('drug_resolution_status', 'ambiguous')
        .lt('drug_resolved_at', cutoff)
        .order('drug_resolved_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, Math.min(to, room - 1)), room);
    out.push(...ambiguous);
  }
  return out;
}

async function fetchOwnerTypes(supabase: SupabaseClient, companyIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const uniq = [...new Set(companyIds.filter(Boolean))];
  for (const part of chunks(uniq, IN_CHUNK)) {
    const { data, error } = await supabase.from('companies').select('id, owner_type').in('id', part).range(0, PAGE_SIZE - 1);
    if (error) throw new Error(`companies owner_type read failed: ${error.message}`);
    for (const row of (data ?? []) as Array<{ id: string; owner_type: string | null }>) out.set(row.id, row.owner_type ?? 'unknown');
  }
  return out;
}

async function findAliasHitsBatched(supabase: SupabaseClient, keys: string[]): Promise<{ hits: Map<string, AliasHit[]>; lookups: number }> {
  const hits = new Map<string, AliasHit[]>();
  const uniq = [...new Set(keys.filter(Boolean))];
  let lookups = 0;
  for (const part of chunks(uniq, IN_CHUNK)) {
    lookups++;
    const rows = await pagedSelect<AliasHit>('drug_aliases batched lookup', (from, to) =>
      supabase
        .from('drug_aliases')
        .select('drug_id, alias_normalized, alias_type')
        .in('alias_normalized', part)
        .order('id', { ascending: true })
        .range(from, to));
    for (const h of rows) {
      if (!hits.has(h.alias_normalized)) hits.set(h.alias_normalized, []);
      hits.get(h.alias_normalized)!.push(h);
    }
  }
  return { hits, lookups };
}

async function getDrugsPaged(supabase: SupabaseClient, ids: string[]): Promise<Map<string, DrugMasterRow>> {
  const out = new Map<string, DrugMasterRow>();
  for (const part of chunks([...new Set(ids)], IN_CHUNK)) {
    const rows = await pagedSelect<DrugMasterRow>('drug_master batched read', (from, to) =>
      supabase.from('drug_master').select(DRUG_COLUMNS).in('id', part).order('id', { ascending: true }).range(from, to));
    for (const d of rows) out.set(d.id, d);
  }
  return out;
}

// ── Set-based writes ─────────────────────────────────────────────────────

interface ResolutionRow {
  id: string;
  drug_master_id: string | null;
  status: DrugResolutionStatus;
  confidence: number;
  modality: string | null;
  company_id: string | null;
  owner_role: 'originator' | 'unknown';
}

interface ApplyOutcome { assetsUpdated: number; ownersWritten: number; failed: number }

/**
 * radar_apply_drug_resolutions (migration 113) per 1,000 rows; falls back to
 * per-row writes when the function is not installed yet.
 */
async function applyResolutions(supabase: SupabaseClient, rows: ResolutionRow[], errors: string[]): Promise<ApplyOutcome> {
  const out: ApplyOutcome = { assetsUpdated: 0, ownersWritten: 0, failed: 0 };
  let useRpc = true;
  for (const part of chunks(rows, APPLY_CHUNK)) {
    if (useRpc) {
      const { data, error } = await supabase.rpc('radar_apply_drug_resolutions', { p_rows: part });
      if (!error) {
        const d = (data ?? {}) as { assets_updated?: number; owners_written?: number };
        out.assetsUpdated += d.assets_updated ?? 0;
        out.ownersWritten += d.owners_written ?? 0;
        continue;
      }
      if (!isMissingFunction(error.message)) {
        errors.push(`radar_apply_drug_resolutions failed: ${error.message}`);
        out.failed += part.length;
        continue;
      }
      useRpc = false;
      errors.push('radar_apply_drug_resolutions missing (migration 113 not applied); using per-row writes');
    }
    await mapConcurrent(part, 8, async r => {
      const patch: Record<string, unknown> = {
        drug_master_id: r.drug_master_id,
        drug_resolution_status: r.status,
        drug_resolution_confidence: r.confidence,
        drug_resolved_at: new Date().toISOString(),
      };
      if (r.modality) patch.modality = r.modality;
      const { error: upErr } = await supabase.from('clinical_assets').update(patch).eq('id', r.id);
      if (upErr) { out.failed++; errors.push(`clinical_assets update failed for ${r.id}: ${upErr.message}`); return; }
      out.assetsUpdated++;
      if (r.drug_master_id && r.company_id) {
        const { error: ownErr } = await supabase.from('drug_owners').upsert(
          {
            drug_id: r.drug_master_id, company_id: r.company_id, role: r.owner_role, territory: 'global',
            evidence_type: 'clinical_asset', evidence_id: r.id, updated_at: new Date().toISOString(),
          },
          { onConflict: 'drug_id,company_id,role,territory' },
        );
        if (ownErr) errors.push(`drug_owners upsert failed for ${r.id}: ${ownErr.message}`);
        else out.ownersWritten++;
      }
    });
  }
  return out;
}

/** drug_resolved_at only: the asset stays 'unresolved' but rotates to the back of the queue. */
async function stampAttempted(supabase: SupabaseClient, ids: string[], errors: string[]): Promise<number> {
  let stamped = 0;
  const nowIso = new Date().toISOString();
  for (const part of chunks(ids, WRITE_CHUNK)) {
    const { error } = await supabase.from('clinical_assets').update({ drug_resolved_at: nowIso }).in('id', part);
    if (error) { errors.push(`drug_resolved_at stamp failed: ${error.message}`); continue; }
    stamped += part.length;
  }
  return stamped;
}

interface AliasRow { drug_id: string; alias: string; alias_normalized: string; alias_type: AliasType; source: string }

async function upsertAliasRows(supabase: SupabaseClient, rows: AliasRow[], errors: string[]): Promise<number> {
  // Dedupe on the conflict key (PostgREST rejects a duplicate key within one statement) and cap per drug.
  const perDrug = new Map<string, number>();
  const seen = new Set<string>();
  const uniq: AliasRow[] = [];
  for (const r of rows) {
    if (!r.alias_normalized || r.alias_normalized.length > 200) continue;
    const k = `${r.drug_id}|${r.alias_normalized}`;
    if (seen.has(k)) continue;
    const n = perDrug.get(r.drug_id) ?? 0;
    if (n >= MAX_ALIASES_PER_DRUG) continue;
    perDrug.set(r.drug_id, n + 1);
    seen.add(k);
    uniq.push({ ...r, alias: r.alias.slice(0, 200) });
  }
  let written = 0;
  for (const part of chunks(uniq, WRITE_CHUNK)) {
    const { error } = await supabase
      .from('drug_aliases')
      .upsert(part, { onConflict: 'alias_normalized,drug_id', ignoreDuplicates: true });
    if (error) { errors.push(`drug_aliases bulk write failed: ${error.message}`); continue; }
    written += part.length;
  }
  return written;
}

// ── Local pass ───────────────────────────────────────────────────────────

interface UnitState {
  unit: LocalUnit;
  candidates: Set<string>;
  candidateKeys: Set<string>;
  extraCandidates: Set<string>;
  industry: boolean;
  rawNames: Set<string>;
  drugId: string | null;
  ambiguous: boolean;
  drug: Pick<DrugMasterRow, 'id' | 'source' | 'confidence' | 'is_combination' | 'modality' | 'preferred_name'> | null;
  isNew: boolean;
}

interface LocalPassOutput {
  rows: ResolutionRow[];
  leftUnresolved: AssetRow[];
}

function emptyLocalStats(): LocalPassStats {
  return {
    fetched: 0, nonDrug: 0, resolved: 0, ambiguous: 0, unresolvableInternal: 0, leftUnresolved: 0,
    internalCreated: 0, combinations: 0, combinationsCreated: 0, aliasesRecorded: 0, ownersWritten: 0, aliasLookups: 0,
  };
}

async function runLocalPass(
  supabase: SupabaseClient,
  assets: AssetRow[],
  stats: LocalPassStats,
  errors: string[],
): Promise<LocalPassOutput> {
  const output: LocalPassOutput = { rows: [], leftUnresolved: [] };
  if (assets.length === 0) return output;

  const ownerTypes = await fetchOwnerTypes(supabase, assets.map(a => a.company_id ?? '').filter(Boolean));
  const isIndustry = (a: AssetRow) => !!a.company_id && INTERNAL_ROW_OWNER_TYPES.has(ownerTypes.get(a.company_id) ?? 'unknown');

  // 1. Plan every asset; merge units across assets by key.
  const plans = new Map<string, LocalPlan>();
  const units = new Map<string, UnitState>();
  for (const asset of assets) {
    const plan = planLocalResolution(asset.asset_name, asset.asset_aliases ?? []);
    plans.set(asset.id, plan);
    for (const u of plan.units) {
      let state = units.get(u.key);
      if (!state) {
        state = {
          unit: u, candidates: new Set(), candidateKeys: new Set(), extraCandidates: new Set(), industry: false,
          rawNames: new Set(), drugId: null, ambiguous: false, drug: null, isNew: false,
        };
        units.set(u.key, state);
      }
      u.candidates.forEach(c => state!.candidates.add(c));
      u.candidateKeys.forEach(k => state!.candidateKeys.add(k));
      u.extraCandidates.forEach(c => state!.extraCandidates.add(c));
      state.rawNames.add(asset.asset_name);
      if (isIndustry(asset)) state.industry = true;
    }
  }

  // 2. One batched alias lookup per 200 keys.
  const { hits: hitsByKey, lookups } = await findAliasHitsBatched(supabase, [...units.values()].flatMap(s => [...s.candidateKeys]));
  stats.aliasLookups += lookups;

  // 3. Disambiguate per unit.
  for (const state of units.values()) {
    const hits = [...state.candidateKeys].flatMap(k => hitsByKey.get(k) ?? []);
    const picked = disambiguate(hits, state.unit.n);
    if (!picked) continue;
    state.drugId = picked.drugId;
    state.ambiguous = picked.ambiguous;
  }
  const drugs = await getDrugsPaged(supabase, [...units.values()].map(s => s.drugId ?? '').filter(Boolean));
  for (const state of units.values()) {
    if (!state.drugId) continue;
    const d = drugs.get(state.drugId);
    if (!d) { state.drugId = null; state.ambiguous = false; continue; } // alias pointing at a deleted row
    state.drug = d;
  }

  // 4. Industry-owned misses: one internal row per group of key-sharing units.
  const misses = [...units.values()].filter(s => !s.drugId && s.industry);
  const groups = groupUnitsByCandidateKeys(misses.map(s => ({ state: s, candidateKeys: [...s.candidateKeys] })));
  const internalRows: Array<{
    id: string; preferred_name: string; inn: string | null; modality: RadarModality | null;
    source: 'internal'; confidence: number; external_checked_at: null;
  }> = [];
  for (const group of groups) {
    const groupUnits = group.map(g => g.state.unit);
    const preferred = pickInternalPreferredName(groupUnits).slice(0, 200);
    if (!preferred) continue;
    const cjk = groupUnits.every(u => u.cjk);
    const row = {
      id: randomUUID(),
      preferred_name: preferred,
      inn: !cjk && looksLikeInn(preferred) ? preferred.toLowerCase() : null,
      modality: cjk ? null : inferModalityFromName(preferred),
      source: 'internal' as const,
      confidence: INTERNAL_CONFIDENCE,
      external_checked_at: null,
    };
    internalRows.push(row);
    for (const g of group) {
      g.state.drugId = row.id;
      g.state.isNew = true;
      g.state.drug = { id: row.id, source: 'internal', confidence: INTERNAL_CONFIDENCE, is_combination: false, modality: row.modality, preferred_name: preferred };
    }
  }
  for (const part of chunks(internalRows, WRITE_CHUNK)) {
    const { error } = await supabase.from('drug_master').insert(part);
    if (error) {
      errors.push(`drug_master bulk insert failed: ${error.message}`);
      const failedIds = new Set(part.map(r => r.id));
      for (const state of units.values()) if (state.drugId && failedIds.has(state.drugId)) { state.drugId = null; state.drug = null; state.isNew = false; }
      continue;
    }
    stats.internalCreated += part.length;
  }

  // 5. Aliases for every keyed unit (new internal rows and existing matches alike).
  const aliasRows: AliasRow[] = [];
  for (const state of units.values()) {
    if (!state.drugId || state.ambiguous) continue;
    const inputs: AliasInput[] = state.unit.cjk
      ? [{ alias: state.unit.n.display, type: 'other', source: 'clinicaltrials' }]
      : [...state.candidates].map(c => ({ alias: c.trim(), type: classifyAlias(c), source: 'clinicaltrials' }));
    for (const a of inputs) {
      const k = normalizeKey(a.alias);
      if (!k || a.alias.length > 200) continue;
      aliasRows.push({ drug_id: state.drugId, alias: a.alias, alias_normalized: k, alias_type: a.type, source: a.source });
    }
  }
  stats.aliasesRecorded += await upsertAliasRows(supabase, aliasRows, errors);

  // 6. Combinations: find or create the combination node for fully keyed plans.
  interface ComboNeed { assetId: string; raw: string; ids: string[]; key: string; minConf: number; allResolved: boolean }
  const comboNeeds: ComboNeed[] = [];
  for (const asset of assets) {
    const plan = plans.get(asset.id)!;
    if (plan.kind !== 'combination') continue;
    const states = plan.units.map(u => units.get(u.key)!);
    if (states.some(s => !s.drugId)) continue; // a non-industry component is missing: leave for the tail
    const ids = [...new Set(states.map(s => s.drugId as string))].sort();
    if (ids.length < 2) continue; // components collapsed onto one drug: handled as a single below
    const parts = states.map(s => resolutionForDrug(s.drug!, s.ambiguous));
    comboNeeds.push({
      assetId: asset.id, raw: asset.asset_name, ids, key: normalizeKey(combinationAliasKey(ids)),
      minConf: Math.min(...parts.map(p => p.confidence)), allResolved: parts.every(p => p.status === 'resolved'),
    });
  }
  const comboByAsset = new Map<string, { drugId: string; minConf: number; allResolved: boolean }>();
  if (comboNeeds.length > 0) {
    const { hits: comboHits, lookups: comboLookups } = await findAliasHitsBatched(supabase, comboNeeds.map(c => c.key));
    stats.aliasLookups += comboLookups;
    const newCombos = new Map<string, { id: string; preferred_name: string; is_combination: true; component_drug_ids: string[]; source: 'combination'; confidence: number }>();
    const comboAliasRows: AliasRow[] = [];
    for (const need of comboNeeds) {
      const existing = comboHits.get(need.key)?.[0]?.drug_id;
      let drugId = existing ?? newCombos.get(need.key)?.id ?? null;
      if (!drugId) {
        const names = need.ids.map(id => [...units.values()].find(s => s.drugId === id)?.drug?.preferred_name ?? '').filter(Boolean);
        const row = {
          id: randomUUID(),
          preferred_name: names.join(' + ').slice(0, 200) || need.raw.slice(0, 200),
          is_combination: true as const,
          component_drug_ids: need.ids,
          source: 'combination' as const,
          confidence: need.minConf,
        };
        newCombos.set(need.key, row);
        drugId = row.id;
        comboAliasRows.push({ drug_id: row.id, alias: combinationAliasKey(need.ids).slice(0, 200), alias_normalized: need.key, alias_type: 'other', source: 'internal' });
      }
      comboAliasRows.push({ drug_id: drugId, alias: need.raw.trim().slice(0, 200), alias_normalized: normalizeKey(need.raw), alias_type: 'synonym', source: 'clinicaltrials' });
      comboByAsset.set(need.assetId, { drugId, minConf: need.minConf, allResolved: need.allResolved });
    }
    const comboRows = [...newCombos.values()];
    const failedCombos = new Set<string>();
    for (const part of chunks(comboRows, WRITE_CHUNK)) {
      const { error } = await supabase.from('drug_master').insert(part);
      if (error) {
        errors.push(`drug_master combination insert failed: ${error.message}`);
        for (const r of part) failedCombos.add(r.id);
        continue;
      }
      stats.combinationsCreated += part.length;
    }
    for (const [assetId, c] of [...comboByAsset]) if (failedCombos.has(c.drugId)) comboByAsset.delete(assetId);
    stats.aliasesRecorded += await upsertAliasRows(supabase, comboAliasRows.filter(r => !failedCombos.has(r.drug_id)), errors);
  }

  // 7. One resolution row per asset.
  const nowResolved: ResolutionRow[] = [];
  for (const asset of assets) {
    const plan = plans.get(asset.id)!;
    const ownerRole: ResolutionRow['owner_role'] = asset.partnership_status === 'unpartnered' ? 'originator' : 'unknown';
    const base = { id: asset.id, company_id: asset.company_id, owner_role: ownerRole };
    if (plan.kind === 'non_drug') {
      nowResolved.push({ ...base, drug_master_id: null, status: 'unresolvable', confidence: 0, modality: null });
      stats.nonDrug++;
      continue;
    }
    if (plan.kind === 'combination') {
      const combo = comboByAsset.get(asset.id);
      if (combo) {
        stats.combinations++;
        nowResolved.push({ ...base, drug_master_id: combo.drugId, status: combo.allResolved ? 'resolved' : 'unresolvable', confidence: combo.minConf, modality: null });
        if (combo.allResolved) stats.resolved++; else stats.unresolvableInternal++;
        continue;
      }
      const states = plan.units.map(u => units.get(u.key)!);
      const keyed = states.filter(s => s.drugId);
      const distinct = new Set(keyed.map(s => s.drugId));
      if (keyed.length !== states.length || distinct.size !== 1) {
        output.leftUnresolved.push(asset);
        continue;
      }
      // every component collapsed onto one drug: treat as that single
      const s = keyed[0];
      const r = resolutionForDrug(s.drug!, s.ambiguous);
      nowResolved.push({ ...base, drug_master_id: s.drugId, status: r.status, confidence: r.confidence, modality: asset.modality ? null : safeModality(s.drug!.modality) });
      if (r.status === 'resolved') stats.resolved++; else if (r.status === 'ambiguous') stats.ambiguous++; else stats.unresolvableInternal++;
      continue;
    }
    const s = units.get(plan.units[0].key)!;
    if (!s.drugId || !s.drug) {
      output.leftUnresolved.push(asset);
      continue;
    }
    const r = resolutionForDrug(s.drug, s.ambiguous);
    const modality = asset.modality ? null : safeModality(s.drug.modality) ?? inferModalityFromName(s.drug.preferred_name);
    nowResolved.push({ ...base, drug_master_id: s.drugId, status: r.status, confidence: r.confidence, modality });
    if (r.status === 'resolved') stats.resolved++; else if (r.status === 'ambiguous') stats.ambiguous++; else stats.unresolvableInternal++;
  }

  // 8. Set-based writes.
  const applied = await applyResolutions(supabase, nowResolved, errors);
  stats.ownersWritten += applied.ownersWritten;
  output.rows = nowResolved;
  if (output.leftUnresolved.length > 0) {
    await stampAttempted(supabase, output.leftUnresolved.map(a => a.id), errors);
    stats.leftUnresolved += output.leftUnresolved.length;
  }
  return output;
}

// ── External pass (drug-level) ───────────────────────────────────────────

interface PendingDrug {
  id: string;
  preferred_name: string;
  inn: string | null;
  external_checked_at: string | null;
  industry: boolean;
  phase_rank: number;
  asset_count: number;
}

async function fetchPendingInternalDrugs(supabase: SupabaseClient, limit: number, recheckDays: number, errors: string[]): Promise<PendingDrug[]> {
  const { data, error } = await supabase.rpc('radar_internal_drugs_pending', { p_limit: limit, p_recheck_days: recheckDays });
  if (!error) return (data ?? []) as PendingDrug[];
  if (!isMissingFunction(error.message)) {
    errors.push(`radar_internal_drugs_pending failed: ${error.message}`);
    return [];
  }
  errors.push('radar_internal_drugs_pending missing (migration 113 not applied); using unprioritised queue');
  const rows = await pagedSelect<Pick<DrugMasterRow, 'id' | 'preferred_name' | 'inn' | 'external_checked_at'>>('drug_master pending read', (from, to) =>
    supabase
      .from('drug_master')
      .select('id, preferred_name, inn, external_checked_at')
      .eq('source', 'internal')
      .eq('is_combination', false)
      .is('external_checked_at', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, Math.min(to, limit - 1)), limit);
  return rows.map(r => ({ ...r, industry: false, phase_rank: 0, asset_count: 0 }));
}

interface DrugAliasRow { drug_id: string; alias: string; alias_type: AliasType }

async function fetchAliasesForDrugs(supabase: SupabaseClient, drugIds: string[]): Promise<Map<string, DrugAliasRow[]>> {
  const out = new Map<string, DrugAliasRow[]>();
  for (const part of chunks([...new Set(drugIds)], IN_CHUNK)) {
    const rows = await pagedSelect<DrugAliasRow>('drug_aliases by drug read', (from, to) =>
      supabase.from('drug_aliases').select('drug_id, alias, alias_type').in('drug_id', part).order('id', { ascending: true }).range(from, to));
    for (const r of rows) {
      if (!out.has(r.drug_id)) out.set(r.drug_id, []);
      out.get(r.drug_id)!.push(r);
    }
  }
  return out;
}

/** Lookup candidates for an internal row: INN, then codes, then other names; ids never. */
export function externalCandidatesForDrug(preferredName: string, aliases: ReadonlyArray<{ alias: string; alias_type: AliasType }>, max = 3): string[] {
  const names = [preferredName, ...aliases.filter(a => !['cas', 'unii', 'chembl'].includes(a.alias_type)).map(a => a.alias)]
    .map(s => (s ?? '').trim())
    .filter(s => s && !containsCJK(s));
  const seen = new Set<string>();
  const uniq = names.filter(n => { const k = normalizeKey(n); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  return [
    ...uniq.filter(looksLikeInn),
    ...uniq.filter(n => !looksLikeInn(n) && isCodeName(n)),
    ...uniq.filter(n => !looksLikeInn(n) && !isCodeName(n)),
  ].slice(0, max);
}

/** Flip every asset keyed on the drug from 'unresolvable' to 'resolved'. */
async function resolveAssetsOnDrug(supabase: SupabaseClient, drugId: string, confidence: number): Promise<number> {
  const { count, error } = await supabase
    .from('clinical_assets')
    .update({ drug_resolution_status: 'resolved', drug_resolution_confidence: confidence, drug_resolved_at: new Date().toISOString() }, { count: 'exact' })
    .eq('drug_master_id', drugId)
    .eq('drug_resolution_status', 'unresolvable');
  if (error) throw new Error(`clinical_assets resolve-on-drug failed: ${error.message}`);
  return count ?? 0;
}

function emptyExternalStats(): ExternalPassStats {
  return {
    drugsQueued: 0, drugsChecked: 0, upgraded: 0, merged: 0, fuzzyMerged: 0, misses: 0, assetsResolved: 0, assetsTail: 0,
    externalCalls: 0, callsByHost: { gsrs: 0, chembl: 0, pubchem: 0 }, negativeCacheHits: 0, negativesPreloaded: 0,
    negativesWritten: 0, budgetExhausted: false,
  };
}

async function runExternalPass(
  ctx: Ctx,
  pending: PendingDrug[],
  deadline: number,
  concurrency: number,
  stats: ExternalPassStats,
  errors: string[],
): Promise<void> {
  const { supabase, budget } = ctx;
  if (pending.length === 0) return;
  const drugRows = await getDrugsPaged(supabase, pending.map(p => p.id));
  const aliases = await fetchAliasesForDrugs(supabase, pending.map(p => p.id));
  const candidatesByDrug = new Map<string, string[]>();
  for (const p of pending) candidatesByDrug.set(p.id, externalCandidatesForDrug(p.preferred_name, aliases.get(p.id) ?? []));

  const preload = await preloadNegativeCache(supabase, [...candidatesByDrug.values()].flat().map(normalizeKey));
  if (preload.error) errors.push(preload.error);
  stats.negativesPreloaded += preload.loaded;

  await mapConcurrent(pending, concurrency, async p => {
    if (Date.now() > deadline) return;
    const drug = drugRows.get(p.id);
    if (!drug || drug.source !== 'internal') return; // merged away by a concurrent worker or already upgraded
    const candidates = candidatesByDrug.get(p.id) ?? [];
    try {
      // (c) conservative INN fuzzy against public rows: no network.
      for (const c of candidates.filter(looksLikeInn).slice(0, 1)) {
        const fuzzy = (await findInnFuzzyHits(supabase, normalizeKey(c))).filter(h => h.drug_id !== drug.id);
        const ids = [...new Set(fuzzy.map(h => h.drug_id))];
        if (ids.length !== 1) continue;
        const target = await getDrug(supabase, ids[0]);
        if (!target || target.source === 'internal') continue;
        await mergeInternalInto(supabase, drug.id, target.id);
        stats.fuzzyMerged++;
        stats.drugsChecked++;
        stats.assetsResolved += await resolveAssetsOnDrug(supabase, target.id, Math.min(target.confidence, 75));
        return;
      }

      // (d) external, most specific candidate first; negative-cached names cost nothing.
      let hit: ExternalHit | null = null;
      for (const c of candidates) {
        if (!budget.canCall()) { stats.budgetExhausted = true; break; }
        hit = await lookupExternal(c, budget);
        if (hit) break;
      }
      if (!hit) {
        if (stats.budgetExhausted) return; // nothing learned; retry next run
        stats.drugsChecked++;
        stats.misses++;
        await updateDrug(supabase, drug.id, { external_checked_at: new Date().toISOString() });
        return;
      }
      stats.drugsChecked++;
      const canonical = await findDrugByExternalIds(supabase, { unii: hit.unii, chemblId: hit.chemblId, pubchemCid: hit.pubchemCid });
      let finalId = drug.id;
      let confidence = hit.confidence;
      if (canonical && canonical.id !== drug.id) {
        await mergeInternalInto(supabase, drug.id, canonical.id);
        await updateDrug(supabase, canonical.id, fillPatch(canonical, hit));
        await recordAliases(supabase, canonical.id, hit.aliases);
        finalId = canonical.id;
        confidence = Math.max(canonical.confidence, hit.confidence);
        stats.merged++;
      } else {
        await updateDrug(supabase, drug.id, fillPatch(drug, hit));
        await recordAliases(supabase, drug.id, hit.aliases);
        stats.upgraded++;
      }
      stats.assetsResolved += await resolveAssetsOnDrug(supabase, finalId, confidence);
    } catch (err) {
      errors.push(`external pass ${p.preferred_name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

/** Per-asset path for assets the local pass could not key (non-industry misses). */
async function runExternalTail(
  ctx: Ctx,
  assets: AssetRow[],
  deadline: number,
  concurrency: number,
  stats: ExternalPassStats,
  errors: string[],
): Promise<{ resolved: number; ambiguous: number; unresolvable: number; nonDrug: number; failed: number }> {
  const out = { resolved: 0, ambiguous: 0, unresolvable: 0, nonDrug: 0, failed: 0 };
  if (assets.length === 0) return out;
  const rows: ResolutionRow[] = [];
  await mapConcurrent(assets, concurrency, async asset => {
    if (Date.now() > deadline || !ctx.budget.canCall()) { stats.budgetExhausted = stats.budgetExhausted || !ctx.budget.canCall(); return; }
    try {
      const r = await resolveDrug(
        ctx.supabase,
        { rawName: asset.asset_name, otherNames: asset.asset_aliases ?? [], sponsorName: asset.company_name },
        { allowExternal: true, budget: ctx.budget, aliasSource: ctx.aliasSource },
      );
      stats.assetsTail++;
      rows.push({
        id: asset.id,
        drug_master_id: r.drugId,
        status: r.status,
        confidence: r.confidence,
        modality: asset.modality ? null : r.modality,
        company_id: asset.company_id,
        owner_role: asset.partnership_status === 'unpartnered' ? 'originator' : 'unknown',
      });
      if (!r.drugId) out.nonDrug++;
      else if (r.status === 'resolved') out.resolved++;
      else if (r.status === 'ambiguous') out.ambiguous++;
      else out.unresolvable++;
    } catch (err) {
      out.failed++;
      errors.push(`${asset.company_name}/${asset.asset_name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  const applied = await applyResolutions(ctx.supabase, rows, errors);
  out.failed += applied.failed;
  return out;
}

// ── Reports ──────────────────────────────────────────────────────────────

async function fetchCrossCompanyDuplicates(supabase: SupabaseClient, limit: number): Promise<{ count: number; groups: DuplicateGroup[] }> {
  const { data, error } = await supabase.rpc('radar_drug_duplicates', { p_limit: limit });
  if (error) throw new Error(`radar_drug_duplicates failed: ${error.message}`);
  const rows = (data ?? []) as Array<DuplicateGroup & { total_groups: number | string }>;
  const count = rows.length > 0 ? Number(rows[0].total_groups) || rows.length : 0;
  return {
    count,
    groups: rows.map(r => ({
      drug_master_id: r.drug_master_id, preferred_name: r.preferred_name, companies: Number(r.companies), assets: Number(r.assets),
      sample_assets: r.sample_assets ?? [],
    })),
  };
}

async function fetchBacklog(supabase: SupabaseClient, localLimit: number, externalLimit: number, errors: string[]): Promise<BacklogEstimate> {
  const est: BacklogEstimate = {
    unresolved: null, unresolvedNeverAttempted: null, internalPendingExternal: null, resolved: null,
    estimatedLocalRunsRemaining: null, estimatedExternalRunsRemaining: null,
  };
  const { data, error } = await supabase.rpc('radar_drug_resolve_backlog');
  if (!error && data) {
    const d = data as Record<string, number>;
    est.unresolved = d.unresolved ?? null;
    est.unresolvedNeverAttempted = d.unresolved_never_attempted ?? null;
    est.internalPendingExternal = d.internal_pending_external ?? null;
    est.resolved = d.resolved ?? null;
  } else {
    if (error && !isMissingFunction(error.message)) errors.push(`radar_drug_resolve_backlog failed: ${error.message}`);
    const q1 = await supabase.from('clinical_assets').select('id', { count: 'exact', head: true }).eq('drug_resolution_status', 'unresolved');
    if (q1.error) errors.push(`backlog count failed: ${q1.error.message}`); else est.unresolved = q1.count ?? null;
    const q2 = await supabase.from('drug_master').select('id', { count: 'exact', head: true }).eq('source', 'internal').eq('is_combination', false).is('external_checked_at', null);
    if (q2.error) errors.push(`pending-external count failed: ${q2.error.message}`); else est.internalPendingExternal = q2.count ?? null;
  }
  if (est.unresolvedNeverAttempted !== null) est.estimatedLocalRunsRemaining = Math.ceil(est.unresolvedNeverAttempted / Math.max(1, localLimit));
  else if (est.unresolved !== null) est.estimatedLocalRunsRemaining = Math.ceil(est.unresolved / Math.max(1, localLimit));
  if (est.internalPendingExternal !== null) est.estimatedExternalRunsRemaining = Math.ceil(est.internalPendingExternal / Math.max(1, externalLimit));
  return est;
}

// ── Entry point ──────────────────────────────────────────────────────────

export async function resolveAssetsBatch(supabase: SupabaseClient, opts: BatchOptions = {}): Promise<BatchResult> {
  const startedAt = Date.now();
  const limit = opts.limit ?? 5000;
  const timeBudgetMs = opts.timeBudgetMs ?? 250_000;
  const allowExternal = opts.allowExternal ?? true;
  const externalLimit = opts.externalLimit ?? 900;
  const concurrency = Math.max(1, Math.min(8, opts.externalConcurrency ?? 4));
  const recheckDays = opts.recheckDays ?? INTERNAL_RECHECK_DAYS;
  const deadline = startedAt + timeBudgetMs;
  const budget = new ExternalBudget(allowExternal ? (opts.maxExternalCalls ?? 2400) : 0, { deadlineMs: deadline - 15_000 });
  const ctx: Ctx = { supabase, allowExternal, budget, aliasSource: 'clinicaltrials', createInternal: true };
  const runType = opts.runType ?? 'scheduled';

  const result: BatchResult = {
    fetched: 0, processed: 0, resolved: 0, ambiguous: 0, unresolvable: 0, nonDrug: 0, failed: 0,
    combinations: 0, drugsCreated: 0, aliasesRecorded: 0, ownersWritten: 0, externalCalls: 0,
    local: emptyLocalStats(), external: emptyExternalStats(),
    backlog: { unresolved: null, unresolvedNeverAttempted: null, internalPendingExternal: null, resolved: null, estimatedLocalRunsRemaining: null, estimatedExternalRunsRemaining: null },
    crossCompanyDuplicates: { count: 0, groups: [] }, timedOut: false, errors: [], logged: false, durationMs: 0,
  };
  const fail = async (message: string): Promise<BatchResult> => {
    result.errors.push(message);
    result.logged = await logRadarRun(supabase, {
      source: 'asset_universe', startedAt, status: 'failed', runType,
      errors: [message], parameters: { stage: 'drug_resolve', limit, external_limit: externalLimit },
    });
    result.durationMs = Date.now() - startedAt;
    return result;
  };

  // ── Local pass ────────────────────────────────────────────────────────
  let queue: AssetRow[] = [];
  try {
    queue = await fetchQueue(supabase, limit);
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
  result.fetched = queue.length;
  result.local.fetched = queue.length;

  let leftUnresolved: AssetRow[] = [];
  try {
    const local = await runLocalPass(supabase, queue, result.local, result.errors);
    leftUnresolved = local.leftUnresolved;
    result.processed += local.rows.length;
  } catch (err) {
    return fail(`local pass: ${err instanceof Error ? err.message : String(err)}`);
  }
  result.resolved += result.local.resolved;
  result.ambiguous += result.local.ambiguous;
  result.unresolvable += result.local.unresolvableInternal;
  result.nonDrug += result.local.nonDrug;
  result.combinations += result.local.combinations;
  result.drugsCreated += result.local.internalCreated + result.local.combinationsCreated;
  result.aliasesRecorded += result.local.aliasesRecorded;
  result.ownersWritten += result.local.ownersWritten;

  // ── External pass ─────────────────────────────────────────────────────
  if (allowExternal && Date.now() < deadline - 30_000) {
    try {
      const pending = await fetchPendingInternalDrugs(supabase, externalLimit, recheckDays, result.errors);
      result.external.drugsQueued = pending.length;
      await runExternalPass(ctx, pending, deadline - 10_000, concurrency, result.external, result.errors);
      result.resolved += result.external.assetsResolved;
      result.processed += result.external.assetsResolved;
    } catch (err) {
      result.errors.push(`external pass: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Tail: assets the local pass could not key, best first.
    if (leftUnresolved.length > 0 && budget.canCall() && Date.now() < deadline - 20_000) {
      // Non-industry by construction (industry misses got internal rows above); rank by phase.
      const ordered = prioritizeForExternal(leftUnresolved.map(a => ({ asset: a, industry: false, phase: a.phase })));
      const tail = await runExternalTail(ctx, ordered.map(o => o.asset), deadline - 10_000, concurrency, result.external, result.errors);
      result.resolved += tail.resolved;
      result.ambiguous += tail.ambiguous;
      result.unresolvable += tail.unresolvable;
      result.nonDrug += tail.nonDrug;
      result.failed += tail.failed;
      result.processed += tail.resolved + tail.ambiguous + tail.unresolvable + tail.nonDrug;
    }

    const flushed = await flushNegativeCache(supabase);
    if (flushed.error) result.errors.push(flushed.error);
    result.external.negativesWritten = flushed.written;
  }
  result.external.externalCalls = budget.used;
  result.external.callsByHost = { ...budget.usedByHost };
  result.external.negativeCacheHits = negativeCacheHits;
  result.externalCalls = budget.used;
  result.timedOut = Date.now() > deadline;

  // ── Reports ───────────────────────────────────────────────────────────
  try {
    result.crossCompanyDuplicates = await fetchCrossCompanyDuplicates(supabase, 20);
  } catch (err) {
    result.errors.push(`duplicate report: ${err instanceof Error ? err.message : String(err)}`);
  }
  result.backlog = await fetchBacklog(supabase, limit, externalLimit, result.errors);

  const status = deriveRunStatus({
    errors: result.errors.length,
    timedOut: result.timedOut,
    processed: result.fetched + result.external.drugsQueued,
    produced: result.processed,
  });

  result.logged = await logRadarRun(supabase, {
    source: 'asset_universe',
    startedAt,
    status,
    runType,
    fetched: result.fetched,
    processed: result.processed,
    inserted: result.drugsCreated,
    updated: result.processed,
    skipped: result.nonDrug,
    failed: result.failed,
    errors: result.errors,
    parameters: {
      stage: 'drug_resolve',
      limit,
      external_limit: externalLimit,
      allow_external: allowExternal,
      timed_out: result.timedOut,
      resolved: result.resolved,
      ambiguous: result.ambiguous,
      unresolvable: result.unresolvable,
      non_drug: result.nonDrug,
      combinations: result.combinations,
      aliases_recorded: result.aliasesRecorded,
      owners_written: result.ownersWritten,
      local: {
        fetched: result.local.fetched,
        resolved: result.local.resolved,
        ambiguous: result.local.ambiguous,
        unresolvable_internal: result.local.unresolvableInternal,
        non_drug: result.local.nonDrug,
        left_unresolved: result.local.leftUnresolved,
        internal_created: result.local.internalCreated,
        combinations_created: result.local.combinationsCreated,
        alias_lookups: result.local.aliasLookups,
      },
      external: {
        drugs_queued: result.external.drugsQueued,
        drugs_checked: result.external.drugsChecked,
        upgraded: result.external.upgraded,
        merged: result.external.merged,
        fuzzy_merged: result.external.fuzzyMerged,
        misses: result.external.misses,
        assets_resolved: result.external.assetsResolved,
        assets_tail: result.external.assetsTail,
        calls: result.external.externalCalls,
        calls_by_host: result.external.callsByHost,
        budget_exhausted: result.external.budgetExhausted,
      },
      negative_cache: {
        hits: result.external.negativeCacheHits,
        preloaded: result.external.negativesPreloaded,
        written: result.external.negativesWritten,
        ttl_days: NEGATIVE_CACHE_TTL_DAYS,
      },
      backlog: {
        unresolved: result.backlog.unresolved,
        unresolved_never_attempted: result.backlog.unresolvedNeverAttempted,
        internal_pending_external: result.backlog.internalPendingExternal,
        resolved: result.backlog.resolved,
        estimated_local_runs_remaining: result.backlog.estimatedLocalRunsRemaining,
        estimated_external_runs_remaining: result.backlog.estimatedExternalRunsRemaining,
      },
      cross_company_duplicates: {
        count: result.crossCompanyDuplicates.count,
        groups: result.crossCompanyDuplicates.groups.map(g => ({
          drug_master_id: g.drug_master_id,
          preferred_name: g.preferred_name,
          companies: g.companies,
          assets: g.assets,
          sample: g.sample_assets.slice(0, 6),
        })),
      },
    },
    notes: `drug_resolve: local ${result.local.resolved} resolved / ${result.local.unresolvableInternal} internal / ${result.local.nonDrug} non-drug / ${result.local.leftUnresolved} left; external ${result.external.drugsChecked} drugs checked, ${result.external.upgraded + result.external.merged + result.external.fuzzyMerged} upgraded, ${result.external.assetsResolved} assets resolved, ${result.externalCalls} calls, ${result.external.negativeCacheHits} negative-cache hits; backlog ${result.backlog.unresolved ?? '?'} unresolved, ${result.backlog.internalPendingExternal ?? '?'} pending external`,
  });

  result.durationMs = Date.now() - startedAt;
  return result;
}
