/**
 * Drug master resolver for the Asset Radar (migration 107).
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
 *   d. external, free APIs only, behind a shared ~3 req/s limiter with an
 *      in-memory cache and drug_aliases as the persistent cache:
 *        NCATS GSRS  → UNII, names, codes, substance class
 *        ChEMBL      → chembl_id, pref_name, max_phase, molecule_type, synonyms
 *        PubChem     → CID, synonyms (CAS, UNII, DrugBank id, codes)
 *   e. internal row (source='internal', confidence 30) so the asset can still
 *      be keyed; status 'unresolvable' means no public identifier, not no row.
 *
 * Batch entry point: resolveAssetsBatch (cron /api/cron/drug-resolve).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
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

// ═══════════════════════════════════════════════════════════════════════
// EXTERNAL BUDGET (rate + call cap + deadline)
// ═══════════════════════════════════════════════════════════════════════

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Aggregate limiter for GSRS + ChEMBL + PubChem: ~3 requests/second, a hard
 * call cap, and a deadline after which no new call starts.
 */
export class ExternalBudget {
  used = 0;
  private nextAt = 0;

  constructor(
    public readonly maxCalls: number,
    private readonly minIntervalMs = 340,
    private readonly deadlineMs = Number.POSITIVE_INFINITY,
  ) {}

  canCall(): boolean {
    return this.used < this.maxCalls && Date.now() < this.deadlineMs;
  }

  /** Waits for the rate slot; returns false when the budget or deadline is exhausted. */
  async acquire(): Promise<boolean> {
    if (!this.canCall()) return false;
    this.used++;
    const now = Date.now();
    const wait = Math.max(0, this.nextAt - now);
    this.nextAt = Math.max(now, this.nextAt) + this.minIntervalMs;
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

const externalCache = new Map<string, ExternalHit | null>();

const USER_AGENT = 'AmbrosiaSolidus-AssetRadar/1.0 (drug-master resolver; contact: hello@ambrosiaventures.co)';

async function getJson(url: string, budget: ExternalBudget, timeoutMs = 12_000): Promise<unknown | null> {
  if (!(await budget.acquire())) return null;
  try {
    const res = await fetchWithTimeout(url, {
      timeoutMs,
      retries: 1,
      retryDelayMs: 800,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch (err) {
    console.warn(`[drug-master] external fetch failed ${url.slice(0, 120)}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

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

async function gsrsLookup(name: string, budget: ExternalBudget): Promise<Partial<ExternalHit> | null> {
  const key = normalizeKey(name);
  const q = `root_names_name:"^${name.replace(/"/g, '')}$"`;
  const url = `https://gsrs.ncats.nih.gov/api/v1/substances/search?q=${encodeURIComponent(q)}&top=5`;
  const json = (await getJson(url, budget)) as { content?: GsrsSubstance[] } | null;
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
    };
  }
  return null;
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

async function chemblLookup(name: string, budget: ExternalBudget): Promise<Partial<ExternalHit> | null> {
  const key = normalizeKey(name);
  const url = `https://www.ebi.ac.uk/chembl/api/data/molecule/search.json?q=${encodeURIComponent(name)}&limit=5`;
  const json = (await getJson(url, budget)) as { molecules?: ChemblMolecule[] } | null;
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
      sources: ['chembl'],
      preferredName: preferred,
      inn: innSyn ? innSyn.toLowerCase() : looksLikeInn(preferred) ? preferred.toLowerCase() : null,
      chemblId,
      modality: modalityFromChemblType(mol.molecule_type),
      maxPhase: chemblPhaseToSlug(mol.max_phase),
      aliases,
    };
  }
  return null;
}

async function pubchemLookup(name: string, budget: ExternalBudget): Promise<Partial<ExternalHit> | null> {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/synonyms/JSON`;
  const json = (await getJson(url, budget)) as { InformationList?: { Information?: Array<{ CID?: number; Synonym?: string[] }> } } | null;
  const info = json?.InformationList?.Information?.[0];
  if (!info?.CID) return null;
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
 * GSRS and ChEMBL together (two calls), PubChem only when both miss. Results,
 * including misses, are cached in memory for the life of the lambda.
 */
export async function lookupExternal(name: string, budget: ExternalBudget): Promise<ExternalHit | null> {
  const key = normalizeKey(name);
  if (!key || containsCJK(name)) return null;
  if (externalCache.has(key)) return externalCache.get(key) ?? null;
  if (!budget.canCall()) return null;
  const gsrs = await gsrsLookup(name, budget);
  const chembl = await chemblLookup(name, budget);
  let pubchem: Partial<ExternalHit> | null = null;
  if (!gsrs && !chembl) pubchem = await pubchemLookup(name, budget);
  const hit = mergeHits(name, [gsrs, chembl, pubchem]);
  externalCache.set(key, hit);
  return hit;
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

async function getDrugs(supabase: SupabaseClient, ids: string[]): Promise<DrugMasterRow[]> {
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return [];
  const { data, error } = await supabase.from('drug_master').select(DRUG_COLUMNS).in('id', uniq);
  if (error) throw new Error(`drug_master read failed: ${error.message}`);
  return (data ?? []) as DrugMasterRow[];
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
  const { data: aliases } = await supabase
    .from('drug_aliases')
    .select('alias, alias_normalized, alias_type, source')
    .eq('drug_id', internalId);
  if (aliases && aliases.length > 0) {
    await supabase.from('drug_aliases').upsert(
      aliases.map(a => ({ ...a, drug_id: canonicalId })),
      { onConflict: 'alias_normalized,drug_id', ignoreDuplicates: true },
    );
  }
  const { data: owners } = await supabase
    .from('drug_owners')
    .select('company_id, role, territory, evidence_type, evidence_id')
    .eq('drug_id', internalId);
  if (owners && owners.length > 0) {
    await supabase.from('drug_owners').upsert(
      owners.map(o => ({ ...o, drug_id: canonicalId })),
      { onConflict: 'drug_id,company_id,role,territory', ignoreDuplicates: true },
    );
  }
  await supabase.from('clinical_assets').update({ drug_master_id: canonicalId }).eq('drug_master_id', internalId);
  // combinations referencing the internal component
  const { data: combos } = await supabase
    .from('drug_master')
    .select('id, component_drug_ids')
    .contains('component_drug_ids', [internalId]);
  for (const c of (combos ?? []) as Array<{ id: string; component_drug_ids: string[] }>) {
    const next = [...new Set(c.component_drug_ids.map(id => (id === internalId ? canonicalId : id)))].sort();
    await supabase.from('drug_master').update({ component_drug_ids: next }).eq('id', c.id);
  }
  await supabase.from('drug_master').delete().eq('id', internalId);
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
  /** Assets per run (default 400). */
  limit?: number;
  /** Wall-clock budget (default 250 s). */
  timeBudgetMs?: number;
  /** Query GSRS/ChEMBL/PubChem (default true). */
  allowExternal?: boolean;
  /** Hard cap on external calls per run (default 700 ≈ 3 req/s × 250 s minus headroom). */
  maxExternalCalls?: number;
  /** Also retry 'unresolvable' internal rows older than 30 days (default false). */
  retryUnresolvable?: boolean;
  runType?: 'scheduled' | 'manual' | 'backfill';
}

export interface DuplicateGroup {
  drug_master_id: string;
  preferred_name: string | null;
  companies: number;
  assets: Array<{ asset_id: string; company_name: string; asset_name: string }>;
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
  partnership_status: string | null;
  drug_resolution_status: string | null;
  drug_resolved_at: string | null;
  created_at: string;
}

const ASSET_COLUMNS =
  'id, company_id, company_name, asset_name, asset_aliases, modality, partnership_status, drug_resolution_status, drug_resolved_at, created_at';

async function fetchQueue(supabase: SupabaseClient, limit: number, retryUnresolvable: boolean): Promise<AssetRow[]> {
  const out: AssetRow[] = [];
  const cutoff = new Date(Date.now() - INTERNAL_RECHECK_DAYS * 86_400_000).toISOString();

  const { data: unresolved, error: e1 } = await supabase
    .from('clinical_assets')
    .select(ASSET_COLUMNS)
    .eq('drug_resolution_status', 'unresolved')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (e1) throw new Error(`clinical_assets queue read failed: ${e1.message}`);
  out.push(...((unresolved ?? []) as AssetRow[]));

  if (out.length < limit) {
    const { data: ambiguous, error: e2 } = await supabase
      .from('clinical_assets')
      .select(ASSET_COLUMNS)
      .eq('drug_resolution_status', 'ambiguous')
      .lt('drug_resolved_at', cutoff)
      .order('drug_resolved_at', { ascending: true })
      .limit(limit - out.length);
    if (e2) throw new Error(`clinical_assets ambiguous queue read failed: ${e2.message}`);
    out.push(...((ambiguous ?? []) as AssetRow[]));
  }

  if (retryUnresolvable && out.length < limit) {
    const { data: stale, error: e3 } = await supabase
      .from('clinical_assets')
      .select(ASSET_COLUMNS)
      .eq('drug_resolution_status', 'unresolvable')
      .not('drug_master_id', 'is', null)
      .lt('drug_resolved_at', cutoff)
      .order('drug_resolved_at', { ascending: true })
      .limit(limit - out.length);
    if (e3) throw new Error(`clinical_assets unresolvable queue read failed: ${e3.message}`);
    out.push(...((stale ?? []) as AssetRow[]));
  }
  return out;
}

async function findCrossCompanyDuplicates(supabase: SupabaseClient, drugIds: string[]): Promise<DuplicateGroup[]> {
  const uniq = [...new Set(drugIds)];
  const groups = new Map<string, DuplicateGroup>();
  for (let i = 0; i < uniq.length; i += 200) {
    const chunk = uniq.slice(i, i + 200);
    const { data, error } = await supabase
      .from('clinical_assets')
      .select('id, company_id, company_name, asset_name, drug_master_id')
      .in('drug_master_id', chunk)
      .limit(5000);
    if (error) throw new Error(`duplicate scan failed: ${error.message}`);
    for (const row of (data ?? []) as Array<{ id: string; company_id: string | null; company_name: string; asset_name: string; drug_master_id: string }>) {
      const g = groups.get(row.drug_master_id) ?? { drug_master_id: row.drug_master_id, preferred_name: null, companies: 0, assets: [] };
      g.assets.push({ asset_id: row.id, company_name: row.company_name, asset_name: row.asset_name });
      groups.set(row.drug_master_id, g);
    }
  }
  const dups = [...groups.values()]
    .map(g => ({ ...g, companies: new Set(g.assets.map(a => a.company_name.toLowerCase())).size }))
    .filter(g => g.companies > 1);
  if (dups.length > 0) {
    const drugs = await getDrugs(supabase, dups.slice(0, 200).map(d => d.drug_master_id));
    const names = new Map(drugs.map(d => [d.id, d.preferred_name]));
    for (const d of dups) d.preferred_name = names.get(d.drug_master_id) ?? null;
  }
  return dups.sort((a, b) => b.companies - a.companies);
}

export async function resolveAssetsBatch(supabase: SupabaseClient, opts: BatchOptions = {}): Promise<BatchResult> {
  const startedAt = Date.now();
  const limit = opts.limit ?? 400;
  const timeBudgetMs = opts.timeBudgetMs ?? 250_000;
  const allowExternal = opts.allowExternal ?? true;
  const deadline = startedAt + timeBudgetMs;
  const budget = new ExternalBudget(allowExternal ? (opts.maxExternalCalls ?? 700) : 0, 340, deadline - 15_000);

  const result: BatchResult = {
    fetched: 0, processed: 0, resolved: 0, ambiguous: 0, unresolvable: 0, nonDrug: 0, failed: 0,
    combinations: 0, drugsCreated: 0, aliasesRecorded: 0, ownersWritten: 0, externalCalls: 0,
    crossCompanyDuplicates: { count: 0, groups: [] }, timedOut: false, errors: [], logged: false, durationMs: 0,
  };

  let queue: AssetRow[] = [];
  try {
    queue = await fetchQueue(supabase, limit, opts.retryUnresolvable ?? false);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
    result.logged = await logRadarRun(supabase, {
      source: 'asset_universe', startedAt, status: 'failed', runType: opts.runType ?? 'scheduled',
      errors: [message], parameters: { stage: 'drug_resolve', limit },
    });
    result.durationMs = Date.now() - startedAt;
    return result;
  }
  result.fetched = queue.length;

  const { count: drugsBefore } = await supabase.from('drug_master').select('id', { count: 'exact', head: true });
  const touchedDrugIds: string[] = [];

  for (const asset of queue) {
    if (Date.now() > deadline) { result.timedOut = true; break; }
    try {
      const r = await resolveDrug(
        supabase,
        { rawName: asset.asset_name, otherNames: asset.asset_aliases ?? [], sponsorName: asset.company_name },
        { allowExternal, budget, aliasSource: 'clinicaltrials' },
      );
      result.externalCalls += r.externalCalls;
      result.aliasesRecorded += r.aliasesRecorded;
      if (r.isCombination) result.combinations++;

      const patch: Record<string, unknown> = {
        drug_master_id: r.drugId,
        drug_resolution_status: r.status,
        drug_resolution_confidence: r.confidence,
        drug_resolved_at: new Date().toISOString(),
      };
      if (!asset.modality && r.modality) patch.modality = r.modality;
      const { error: upErr } = await supabase.from('clinical_assets').update(patch).eq('id', asset.id);
      if (upErr) throw new Error(`clinical_assets update failed: ${upErr.message}`);

      if (r.drugId) {
        touchedDrugIds.push(r.drugId);
        if (asset.company_id) {
          const role = asset.partnership_status === 'unpartnered' ? 'originator' : 'unknown';
          const { error: ownErr } = await supabase.from('drug_owners').upsert(
            {
              drug_id: r.drugId,
              company_id: asset.company_id,
              role,
              territory: 'global',
              evidence_type: 'clinical_asset',
              evidence_id: asset.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'drug_id,company_id,role,territory' },
          );
          if (ownErr) result.errors.push(`drug_owners upsert failed for ${asset.id}: ${ownErr.message}`);
          else {
            result.ownersWritten++;
            if (role === 'originator' && !r.isCombination) {
              await supabase.from('drug_master').update({ originator_company_id: asset.company_id })
                .eq('id', r.drugId).is('originator_company_id', null);
            }
          }
        }
        if (r.status === 'resolved') result.resolved++;
        else if (r.status === 'ambiguous') result.ambiguous++;
        else result.unresolvable++;
      } else {
        result.nonDrug++;
      }
      result.processed++;
    } catch (err) {
      result.failed++;
      result.errors.push(`${asset.company_name}/${asset.asset_name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const { count: drugsAfter } = await supabase.from('drug_master').select('id', { count: 'exact', head: true });
  result.drugsCreated = Math.max(0, (drugsAfter ?? 0) - (drugsBefore ?? 0));

  try {
    const groups = await findCrossCompanyDuplicates(supabase, touchedDrugIds);
    result.crossCompanyDuplicates = { count: groups.length, groups: groups.slice(0, 20) };
  } catch (err) {
    result.errors.push(`duplicate scan: ${err instanceof Error ? err.message : String(err)}`);
  }

  const status = deriveRunStatus({
    errors: result.errors.length,
    timedOut: result.timedOut,
    processed: result.processed,
    produced: result.resolved + result.ambiguous + result.unresolvable + result.nonDrug,
  });

  result.logged = await logRadarRun(supabase, {
    source: 'asset_universe',
    startedAt,
    status,
    runType: opts.runType ?? 'scheduled',
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
      allow_external: allowExternal,
      external_calls: result.externalCalls,
      timed_out: result.timedOut,
      resolved: result.resolved,
      ambiguous: result.ambiguous,
      unresolvable: result.unresolvable,
      non_drug: result.nonDrug,
      combinations: result.combinations,
      aliases_recorded: result.aliasesRecorded,
      owners_written: result.ownersWritten,
      cross_company_duplicates: {
        count: result.crossCompanyDuplicates.count,
        pairs: result.crossCompanyDuplicates.groups.map(g => ({
          drug_master_id: g.drug_master_id,
          preferred_name: g.preferred_name,
          companies: g.companies,
          assets: g.assets.slice(0, 6).map(a => `${a.company_name} / ${a.asset_name}`),
        })),
      },
    },
    notes: `drug_resolve: ${result.resolved} resolved, ${result.ambiguous} ambiguous, ${result.unresolvable} unresolvable, ${result.nonDrug} non-drug, ${result.externalCalls} external calls`,
  });

  result.durationMs = Date.now() - startedAt;
  return result;
}
