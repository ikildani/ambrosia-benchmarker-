/**
 * Search & Evaluation — drug identity gate (migration 173).
 *
 * A clinical_assets row may point at a drug_master node only when the
 * company's own row writes that drug: its asset name (display form,
 * parenthetical, development code) or, failing that, one of its own
 * intervention aliases names a key the node is TRUSTED to carry.
 *
 * Why: the Oct 26 2026 QA run found 4,884 drug nodes held by two or more
 * industry companies. Most were not real shared drugs. The local pass grouped
 * unmatched names by any shared key (asset aliases included), recorded every
 * name in the group as an alias, and the external pass then merged the whole
 * group into whichever registry drug one of its names hit. "doxorubicin"
 * ended up carrying methotrexate, etoposide, venetoclax and "Group A" as
 * aliases, and every later asset with those names was matched to doxorubicin.
 *
 * Trusted keys of a node:
 *   - registry rows (source gsrs / chembl / pubchem, or a mix): preferred
 *     name, INN, and aliases that came from a registry (TRUSTED_ALIAS_SOURCES);
 *     plus "co-written" keys: a code or name that sits in the same asset name
 *     as one of those keys ("MK-3475 (pembrolizumab)") — the sponsor wrote both;
 *   - internal rows (source internal, a sponsor code with no registry entry):
 *     preferred name and INN only.
 *   - clinicaltrials-sourced aliases are never trusted on their own.
 *
 * Matching keys are normalizeKey() forms, so "ABC-123", "ABC 123" and "ABC123"
 * are one key, plus a salt-stripped form ("doxorubicin hydrochloride" →
 * "doxorubicin"). Never fuzzy.
 *
 * Pure: no I/O. Used by the drug-resolve cron (lib/radar/drug-master.ts) and
 * by scripts/radar-drug-identity-fix.ts, and mirrored by the SQL in
 * migration 173. Tests: __tests__/lib/radar-drug-identity.test.ts.
 */

import { normalizeDrugName, normalizeKey, splitCombination, containsCJK } from '@/lib/radar/drug-name';

/** drug_aliases.source values that come from a public registry. */
export const TRUSTED_ALIAS_SOURCES: ReadonlySet<string> = new Set(['gsrs', 'chembl', 'pubchem', 'ncit']);

/** drug_master.source values for registry-backed nodes ('gsrs+chembl', 'pubchem+chembl', ...). */
export function isRegistrySource(source: string | null | undefined): boolean {
  if (!source) return false;
  return source.split('+').every(s => TRUSTED_ALIAS_SOURCES.has(s));
}

/**
 * Salt and hydrate words that never change the active moiety. Deliberately
 * narrower than drug-name.ts SALT_WORDS: 'alfa', 'beta', 'pegol', 'glargine'
 * name different drugs (interferon alfa vs beta) and are kept.
 */
const SALT_SUFFIX_WORDS = new Set([
  'hydrochloride', 'hcl', 'dihydrochloride', 'hydrobromide', 'sodium', 'disodium', 'potassium',
  'dipotassium', 'calcium', 'magnesium', 'mesylate', 'mesilate', 'dimesylate', 'maleate', 'fumarate',
  'hemifumarate', 'tartrate', 'bitartrate', 'citrate', 'acetate', 'sulfate', 'sulphate', 'bisulfate',
  'phosphate', 'diphosphate', 'succinate', 'besylate', 'besilate', 'tosylate', 'tosilate', 'bromide',
  'chloride', 'malate', 'lactate', 'gluconate', 'nitrate', 'oxalate', 'benzoate', 'pamoate',
  'monohydrate', 'hydrate', 'hemihydrate', 'sesquihydrate', 'trihydrate', 'dihydrate', 'anhydrous',
  'free', 'base', 'salt', 'meglumine', 'tromethamine', 'trometamol', 'arginine', 'lysine', 'choline',
  'olamine', 'edisylate', 'napsylate', 'esylate', 'isethionate', 'hyclate', 'monosodium', 'trisodium',
]);

/** Generic words that are never a drug identity on their own. */
const NON_IDENTITY_KEYS = new Set([
  'placebo', 'drug', 'study', 'treatment', 'therapy', 'control', 'vaccine', 'antibody', 'injection',
  'tablet', 'tablets', 'capsule', 'capsules', 'solution', 'infusion', 'patch', 'cream', 'gel', 'group',
  'groupa', 'groupb', 'groupc', 'arma', 'armb', 'cohort1', 'cohort2', 'chemotherapy', 'standardofcare',
  'phaseii', 'phasei', 'phaseiii', 'investigationalproduct', 'activecomparator', 'comparator',
]);

/** Salt-stripped form of a display string ("Imatinib Mesylate" → "imatinib"); null when nothing was stripped. */
export function saltStrippedKey(display: string): string | null {
  const words = display.replace(/[™®©]/g, ' ').normalize('NFKC').toLowerCase().split(/[\s,]+/).filter(Boolean);
  const out = [...words];
  while (out.length > 1 && SALT_SUFFIX_WORDS.has(out[out.length - 1].replace(/[^a-z]/g, ''))) out.pop();
  if (out.length === words.length) return null;
  const k = normalizeKey(out.join(' '));
  return k || null;
}

/** True when a key can identify a drug: not generic, long enough, not a bare number. */
export function isIdentityKey(key: string): boolean {
  if (!key) return false;
  if (NON_IDENTITY_KEYS.has(key)) return false;
  if (/^\d+$/.test(key)) return false;
  if (containsCJK(key)) return key.length >= 2;
  const hasDigit = /\d/.test(key);
  return hasDigit ? key.length >= 4 : key.length >= 5;
}

/** Matching keys for one string: normalizeKey plus the salt-stripped form. */
export function keyVariants(s: string): string[] {
  if (!s) return [];
  const out = new Set<string>();
  const k = normalizeKey(s);
  if (isIdentityKey(k)) out.add(k);
  const salt = saltStrippedKey(s);
  if (salt && isIdentityKey(salt)) out.add(salt);
  return [...out];
}

/** Keys of one name component: cleaned display, parentheticals and code names, each with variants. */
function componentKeys(component: string): string[] {
  const n = normalizeDrugName(component);
  if (n.reason === 'empty' || n.reason === 'placebo' || n.reason === 'non_drug') return [];
  const out = new Set<string>();
  const cands = n.reason === 'cjk' ? [n.display] : n.candidates;
  for (const c of cands) for (const k of keyVariants(c)) out.add(k);
  // The raw component too: a registry alias may keep the formulation word ("doxorubicin liposomal").
  for (const k of keyVariants(component.replace(/\([^)]*\)?/g, ' ').trim())) out.add(k);
  return [...out];
}

export interface OwnNameKeys {
  kind: 'non_drug' | 'single' | 'combination';
  /** One key list per component of the asset name (a single has one). */
  units: string[][];
}

/** Common words that also name a registry substance ("water", "oxygen"): never matched as a word. */
const WORD_STOP = new Set([
  'placebo', 'capsules', 'tablets', 'injection', 'solution', 'infusion', 'combination', 'treatment', 'therapy',
  'standard', 'control', 'vaccine', 'antibody', 'medicine', 'compound', 'extract', 'protein', 'peptide',
  'oxygen', 'water', 'saline', 'glucose', 'dextrose', 'sodium', 'potassium', 'calcium', 'magnesium', 'chloride',
  'vitamin', 'insulin', 'albumin', 'ethanol', 'alcohol', 'nicotine', 'caffeine', 'melatonin', 'probiotic',
  'cholesterol', 'hydrogen', 'nitrogen', 'carbon', 'contrast', 'hormone', 'steroid', 'steroids', 'chemotherapy',
]);

/**
 * Single alphabetic words of the asset name (7+ letters) as keys: "PEX010 Psilocybin
 * Capsules" writes psilocybin. Matched only against a node's own preferred name / INN
 * (index.primary), never against aliases.
 */
export function assetNameWordKeys(assetName: string | null | undefined): string[] {
  const raw = (assetName ?? '').replace(/\([^)]*\)?/g, ' ');
  const out = new Set<string>();
  for (const w of raw.normalize('NFKC').toLowerCase().split(/[^a-z]+/)) {
    if (w.length >= 7 && !WORD_STOP.has(w)) out.add(w);
  }
  return [...out];
}

/** What the asset name itself writes: one key set per component. */
export function assetNameKeys(assetName: string | null | undefined): OwnNameKeys {
  const raw = (assetName ?? '').trim();
  if (!raw) return { kind: 'non_drug', units: [] };
  const split = splitCombination(raw);
  const units: string[][] = [];
  for (const c of split.components) {
    const keys = componentKeys(c);
    if (keys.length > 0) units.push(keys);
  }
  if (units.length === 0) return { kind: 'non_drug', units: [] };
  return { kind: units.length > 1 ? 'combination' : 'single', units };
}

/** Keys written by the asset's own intervention aliases (single-agent aliases only). */
export function assetAliasKeys(aliases: readonly (string | null)[] | null | undefined): string[][] {
  const out: string[][] = [];
  for (const a of aliases ?? []) {
    if (!a) continue;
    const split = splitCombination(a);
    if (split.isCombination || split.components.length === 0) continue;
    const keys = componentKeys(split.components[0]);
    if (keys.length > 0) out.push(keys);
  }
  return out;
}

// ── Trusted key index ─────────────────────────────────────────────────────

export interface DrugIdentityRow {
  id: string;
  preferred_name: string;
  inn: string | null;
  source: string;
  is_combination: boolean;
}

export interface AliasIdentityRow {
  drug_id: string;
  alias: string;
  source: string;
}

/** Keys a node is trusted to carry before co-written keys are added. */
export function baseTrustedKeys(drug: DrugIdentityRow, aliases: readonly AliasIdentityRow[]): string[] {
  if (drug.is_combination) return [];
  const out = new Set<string>();
  for (const k of keyVariants(drug.preferred_name)) out.add(k);
  if (drug.inn) for (const k of keyVariants(drug.inn)) out.add(k);
  if (isRegistrySource(drug.source)) {
    for (const a of aliases) if (TRUSTED_ALIAS_SOURCES.has(a.source)) for (const k of keyVariants(a.alias)) out.add(k);
  }
  return [...out];
}

/** key → drug ids that are trusted to carry it, plus the ids whose own name is that key. */
export interface TrustedKeyIndex {
  byKey: Map<string, Set<string>>;
  /** key → drug ids whose preferred name / INN is this key (tie-break for duplicate registry rows). */
  primary: Map<string, Set<string>>;
  /** drug id → trusted keys. */
  byDrug: Map<string, Set<string>>;
}

export function emptyIndex(): TrustedKeyIndex {
  return { byKey: new Map(), primary: new Map(), byDrug: new Map() };
}

function addTo(map: Map<string, Set<string>>, k: string, v: string): void {
  let s = map.get(k);
  if (!s) { s = new Set(); map.set(k, s); }
  s.add(v);
}

export function addTrustedKey(index: TrustedKeyIndex, drugId: string, key: string, primary = false): void {
  if (!isIdentityKey(key)) return;
  addTo(index.byKey, key, drugId);
  addTo(index.byDrug, drugId, key);
  if (primary) addTo(index.primary, key, drugId);
}

export function buildTrustedIndex(
  drugs: readonly DrugIdentityRow[],
  aliasesByDrug: ReadonlyMap<string, readonly AliasIdentityRow[]>,
): TrustedKeyIndex {
  const index = emptyIndex();
  for (const d of drugs) {
    if (d.is_combination) continue;
    const primaryKeys = new Set([...keyVariants(d.preferred_name), ...(d.inn ? keyVariants(d.inn) : [])]);
    for (const k of baseTrustedKeys(d, aliasesByDrug.get(d.id) ?? [])) addTrustedKey(index, d.id, k, primaryKeys.has(k));
  }
  return index;
}

/**
 * The single drug a set of keys names, or null when none or several do.
 * Duplicate registry rows ("doxorubicin" twice) tie-break on the row whose
 * own name is the key; registry rows beat internal rows when isRegistry is given.
 */
export function uniqueDrugForKeys(
  keys: readonly string[],
  index: TrustedKeyIndex,
  isRegistry?: (drugId: string) => boolean,
): { drugId: string; key: string } | null {
  const hits = new Map<string, string>();
  for (const k of keys) for (const id of index.byKey.get(k) ?? []) if (!hits.has(id)) hits.set(id, k);
  if (hits.size === 0) return null;
  if (hits.size === 1) {
    const [[drugId, key]] = [...hits];
    return { drugId, key };
  }
  let ids = [...hits.keys()];
  if (isRegistry) {
    const reg = ids.filter(isRegistry);
    if (reg.length >= 1) ids = reg;
    if (ids.length === 1) return { drugId: ids[0], key: hits.get(ids[0])! };
  }
  const primaryHits = ids.filter(id => keys.some(k => index.primary.get(k)?.has(id)));
  if (primaryHits.length === 1) return { drugId: primaryHits[0], key: hits.get(primaryHits[0])! };
  return null;
}

/** Does any of the keys belong to this drug's trusted set? */
export function writesDrug(keys: readonly string[], drugId: string, index: TrustedKeyIndex): boolean {
  const own = index.byDrug.get(drugId);
  if (!own) return false;
  return keys.some(k => own.has(k));
}

// ── Asset verdict ─────────────────────────────────────────────────────────

export type LinkVerdict =
  /** the current link is written by the asset name */
  | 'verified_name'
  /** the asset name names no trusted drug; its own aliases name only this one */
  | 'verified_alias'
  /** every component of a combination is written by the asset name */
  | 'verified_combination'
  /** the asset writes another drug: relink */
  | 'relink'
  /** the asset writes nothing this node is trusted to carry: unlink */
  | 'unlink'
  /** no current link; the asset writes exactly one trusted drug */
  | 'new_link'
  /** nothing to do */
  | 'none';

export interface AssetIdentityInput {
  assetName: string;
  aliases: readonly (string | null)[] | null;
  drugMasterId: string | null;
  /** the linked node, when it is a combination */
  combinationComponents?: readonly string[] | null;
}

export interface AssetIdentityResult {
  verdict: LinkVerdict;
  /** the drug the asset should point at after the gate (null = no link) */
  drugId: string | null;
  /** for a combination asset: the component drugs written by the name, in order (null when one is unknown) */
  componentIds?: string[] | null;
  /** the key that decided it */
  key?: string;
  via?: 'name' | 'alias';
}

/**
 * Decide what one asset's link should be. Precision first: an asset keeps or
 * gains a link only when its own name (or, for a name that names nothing
 * registered, its own aliases, unambiguously) writes a trusted key of that node.
 */
export function judgeAssetLink(
  input: AssetIdentityInput,
  index: TrustedKeyIndex,
  isRegistry?: (drugId: string) => boolean,
): AssetIdentityResult {
  const own = assetNameKeys(input.assetName);
  const current = input.drugMasterId;

  if (own.kind === 'combination') {
    const ids = own.units.map(u => uniqueDrugForKeys(u, index, isRegistry)?.drugId ?? null);
    const allKnown = ids.every((x): x is string => !!x);
    const distinct = allKnown ? [...new Set(ids as string[])].sort() : null;
    if (current && input.combinationComponents && input.combinationComponents.length > 0) {
      const comps = [...new Set(input.combinationComponents)].sort();
      // every linked component must be written by some unit of the name
      const ok = comps.every(c => own.units.some(u => writesDrug(u, c, index)));
      if (ok) return { verdict: 'verified_combination', drugId: current, componentIds: distinct };
      return { verdict: distinct && distinct.length > 1 ? 'relink' : 'unlink', drugId: null, componentIds: distinct };
    }
    if (current) {
      // a combination name linked to a single node: only fine if every unit writes that node
      if (own.units.every(u => writesDrug(u, current, index))) return { verdict: 'verified_name', drugId: current };
      return { verdict: distinct && distinct.length > 1 ? 'relink' : 'unlink', drugId: null, componentIds: distinct };
    }
    if (distinct && distinct.length > 1) return { verdict: 'new_link', drugId: null, componentIds: distinct };
    return { verdict: 'none', drugId: null, componentIds: distinct };
  }

  const nameKeys = own.units[0] ?? [];
  // A sponsor-internal node gives way to a registry node the same name writes.
  if (current && isRegistry && !isRegistry(current) && nameKeys.length > 0) {
    const reg = uniqueDrugForKeys(nameKeys, index, isRegistry);
    if (reg && reg.drugId !== current && isRegistry(reg.drugId)) {
      return { verdict: 'relink', drugId: reg.drugId, key: reg.key, via: 'name' };
    }
  }
  if (current && nameKeys.length > 0 && writesDrug(nameKeys, current, index)) {
    return { verdict: 'verified_name', drugId: current, key: nameKeys.find(k => index.byDrug.get(current)?.has(k)), via: 'name' };
  }
  const byName = nameKeys.length > 0 ? uniqueDrugForKeys(nameKeys, index, isRegistry) : null;
  if (byName) {
    return { verdict: current ? 'relink' : 'new_link', drugId: byName.drugId, key: byName.key, via: 'name' };
  }
  // A word of the name that is exactly one node's own name (preferred / INN).
  const words = assetNameWordKeys(input.assetName);
  if (current && words.some(w => index.primary.get(w)?.has(current))) {
    return { verdict: 'verified_name', drugId: current, key: words.find(w => index.primary.get(w)?.has(current)), via: 'name' };
  }
  const wordDrugs = new Set<string>();
  for (const w of words) for (const id of index.primary.get(w) ?? []) if (!isRegistry || isRegistry(id)) wordDrugs.add(id);
  if (wordDrugs.size === 1 && !nameKeys.some(k => index.byKey.has(k))) {
    const [only] = [...wordDrugs];
    return { verdict: current ? 'relink' : 'new_link', drugId: only, key: words.find(w => index.primary.get(w)?.has(only)), via: 'name' };
  }
  // The name writes no trusted key. Aliases count only when they agree on one drug
  // and the name itself named no other drug (checked above: byName is null).
  const anyNameHit = nameKeys.some(k => index.byKey.has(k));
  if (!anyNameHit) {
    const aliasUnits = assetAliasKeys(input.aliases);
    const aliasDrugs = new Set<string>();
    let decidingKey: string | undefined;
    for (const u of aliasUnits) {
      const hit = uniqueDrugForKeys(u, index, isRegistry);
      if (hit) { aliasDrugs.add(hit.drugId); decidingKey = decidingKey ?? hit.key; }
      else if (u.some(k => index.byKey.has(k))) aliasDrugs.add('__ambiguous__');
    }
    if (aliasDrugs.size === 1 && !aliasDrugs.has('__ambiguous__')) {
      const [only] = [...aliasDrugs];
      if (current === only) return { verdict: 'verified_alias', drugId: current, key: decidingKey, via: 'alias' };
      return { verdict: current ? 'relink' : 'new_link', drugId: only, key: decidingKey, via: 'alias' };
    }
  }
  if (current) return { verdict: 'unlink', drugId: null };
  return { verdict: 'none', drugId: null };
}

/**
 * Co-written keys: when an asset name writes a trusted key of drug D, the other
 * identity keys in the same name ("MK-3475 (pembrolizumab)" → mk3475) are the
 * sponsor's own names for D. Returns [drugId, key] pairs to add, skipping keys
 * already trusted for a different drug.
 */
export function coWrittenKeys(
  assetName: string,
  index: TrustedKeyIndex,
  isRegistry?: (drugId: string) => boolean,
): Array<{ drugId: string; key: string }> {
  const own = assetNameKeys(assetName);
  if (own.kind !== 'single') return [];
  const keys = own.units[0];
  const hit = uniqueDrugForKeys(keys, index, isRegistry);
  if (!hit) return [];
  const out: Array<{ drugId: string; key: string }> = [];
  for (const k of keys) {
    const holders = index.byKey.get(k);
    if (holders && !holders.has(hit.drugId)) continue; // trusted for another drug: never steal it
    if (holders?.has(hit.drugId)) continue;
    out.push({ drugId: hit.drugId, key: k });
  }
  return out;
}
