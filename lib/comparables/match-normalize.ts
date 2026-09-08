/**
 * Comparable-deal matching normalizers.
 *
 * The calculator and the `deals` table spell the same concepts differently:
 *
 *   phase:      calculator 'phase2'        vs DB 'phase_2'
 *   modality:   calculator 'smallMolecule' vs DB 'smallMolecule' | 'small_molecule'
 *               calculator 'mab'           vs DB 'mab' | 'antibody'
 *               calculator 'adc'           vs DB 'adc' | 'adc_her2' | 'adc_trop2' ...
 *   indication: calculator 'pancreatic'    vs DB 'Pancreatic' | 'pancreatic cancer' | 'pancreatic and lung cancers'
 *   dealType:   calculator 'licensing'     vs DB 'license'
 *
 * Every comparables path (enriched comps, legacy comps, transparency drill-down)
 * used strict `===` on the raw strings, so phase and indication never matched
 * and modality only matched when the DB row happened to use camelCase. The
 * result was comp sets built from "same TA + recent" only.
 *
 * These helpers are pure and side-effect free so they can be unit tested.
 */

import { normalizePhaseForDB } from '@/lib/financial/deal-type-normalization';

// ---------------------------------------------------------------------------
// Phase
// ---------------------------------------------------------------------------

const PHASE_RANK: Record<string, number> = {
  discovery: 0,
  preclinical: 1,
  phase_1: 2,
  phase_2: 3,
  phase_3: 4,
  approved: 5,
};

/** Canonical DB-style phase key ('phase_2', 'approved', ...) or 'unknown'. */
export function phaseKey(value: string | null | undefined): string {
  return normalizePhaseForDB(value);
}

/** True when both sides resolve to the same known phase. */
export function phasesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = phaseKey(a);
  const kb = phaseKey(b);
  return ka !== 'unknown' && ka === kb;
}

/**
 * Ladder distance between two phases (0 = same, 1 = adjacent, ...).
 * Returns null when either side is unknown.
 */
export function phaseDistance(a: string | null | undefined, b: string | null | undefined): number | null {
  const ka = phaseKey(a);
  const kb = phaseKey(b);
  if (ka === 'unknown' || kb === 'unknown') return null;
  return Math.abs(PHASE_RANK[ka] - PHASE_RANK[kb]);
}

// ---------------------------------------------------------------------------
// Modality
// ---------------------------------------------------------------------------

/** Spellings that mean the same thing once lower-cased and stripped of punctuation. */
const MODALITY_ALIASES: Record<string, string> = {
  mab: 'antibody',
  monoclonalantibody: 'antibody',
  monoclonal: 'antibody',
  radiopharm: 'radiopharmaceutical',
  radioligand: 'radiopharmaceutical',
  tcellengager: 'tce',
  bispecificantibody: 'bispecific',
  antibodydrugconjugate: 'adc',
  genetherapy: 'genetherapy',
  celltherapy: 'celltherapy',
  degrader: 'protac',
  degraderoral: 'protac',
  molecularglue: 'protac',
  smallmolecule: 'smallmolecule',
  oligo: 'oligonucleotide',
  aso: 'oligonucleotide',
  antisense: 'oligonucleotide',
};

/**
 * Sub-type prefixes that roll up to a family. 'adc_her2' and 'adc' are the
 * same family; 'carT_heme', 'carT_solid', 'car_t' are all CAR-T.
 */
const MODALITY_FAMILIES = [
  'adc',
  'cart',
  'tce',
  'crispr',
  'genetherapy',
  'bispecific',
  'jakinhibitor',
  'vaccine',
  'protac',
  'antibody',
  'smallmolecule',
  'celltherapy',
  'radiopharmaceutical',
  'oligonucleotide',
];

function canonical(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Canonical modality key: lower-case, punctuation stripped, aliases resolved. */
export function modalityKey(value: string | null | undefined): string {
  const c = canonical(value);
  if (!c) return '';
  return MODALITY_ALIASES[c] ?? c;
}

/** Family bucket for a modality key ('adc_her2' -> 'adc'), or '' when none. */
export function modalityFamily(value: string | null | undefined): string {
  const k = modalityKey(value);
  if (!k) return '';
  for (const fam of MODALITY_FAMILIES) {
    if (k === fam || k.startsWith(fam)) return fam;
  }
  return '';
}

/** True when the two modalities are the same, or roll up to the same family. */
export function modalitiesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = modalityKey(a);
  const kb = modalityKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const fa = modalityFamily(ka);
  return fa !== '' && fa === modalityFamily(kb);
}

// ---------------------------------------------------------------------------
// Deal type
// ---------------------------------------------------------------------------

const DEAL_TYPE_ALIASES: Record<string, string> = {
  licensing: 'license',
  licence: 'license',
  codevelopment: 'co_development',
  co_development: 'co_development',
  codev: 'co_development',
  copromotion: 'co_promotion',
  co_promotion: 'co_promotion',
  'm&a': 'acquisition',
  merger: 'acquisition',
};

/** Canonical DB-style deal type key ('license', 'acquisition', ...). */
export function dealTypeKey(value: string | null | undefined): string {
  const v = (value || '').toLowerCase().trim();
  if (!v) return '';
  return DEAL_TYPE_ALIASES[v] ?? v;
}

export function dealTypesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = dealTypeKey(a);
  const kb = dealTypeKey(b);
  return ka !== '' && ka === kb;
}

// ---------------------------------------------------------------------------
// Indication
// ---------------------------------------------------------------------------

/**
 * Calculator indication tokens that appear under a different spelling in
 * free-text DB rows. Each token matches if the token itself OR any alias is
 * found in the DB text.
 */
const INDICATION_TOKEN_ALIASES: Record<string, string[]> = {
  lung: ['lung', 'nsclc', 'sclc'],
  nsclc: ['nsclc', 'non small cell', 'nonsmall cell', 'non-small cell'],
  sclc: ['sclc', 'small cell lung'],
  tnbc: ['tnbc', 'triple negative', 'triple-negative'],
  her2: ['her2', 'her-2'],
  hr: ['hr+', 'hr positive', 'hormone receptor', 'er+', 'er positive', 'estrogen receptor'],
  colorectal: ['colorectal', 'crc', 'colon cancer'],
  gbm: ['gbm', 'glioblastoma'],
  headneck: ['head and neck', 'head & neck', 'hnscc'],
  aml: ['aml', 'acute myeloid'],
  all: ['acute lymphoblastic', 'acute lymphocytic'],
  cll: ['cll', 'chronic lymphocytic'],
  cml: ['cml', 'chronic myeloid', 'chronic myelogenous'],
  mds: ['mds', 'myelodysplastic'],
  mpn: ['mpn', 'myeloproliferative', 'myelofibrosis'],
  myeloma: ['myeloma'],
  dlbcl: ['dlbcl', 'diffuse large b'],
  mantlecell: ['mantle cell'],
  liver: ['liver', 'hepatocellular', 'hcc'],
  renal: ['renal', 'kidney', 'rcc'],
  gastric: ['gastric', 'stomach'],
  neuroendocrine: ['neuroendocrine', 'net', 'gep-net', 'gep net'],
  prostate: ['prostate', 'mcrpc', 'crpc'],
  bladder: ['bladder', 'urothelial'],
  cholangiocarcinoma: ['cholangiocarcinoma', 'biliary'],
  alzheimers: ['alzheimer'],
  parkinsons: ['parkinson'],
};

/** Split a calculator indication id into lower-case tokens: 'lung_nsclc' -> ['lung','nsclc']. */
export function indicationTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase -> spaced
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter(Boolean);
}

function normalizeText(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/[_/,()]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * True when every token of the calculator indication (or one of its aliases)
 * appears in at least one of the supplied DB text fields.
 *
 * 'pancreatic' matches 'Pancreatic', 'pancreatic cancer', 'pancreatic and lung cancers'.
 * 'lung_nsclc' matches 'non-small cell lung cancer' and 'NSCLC / solid tumors'.
 * 'pancreatic' does NOT match 'solid_tumor' or 'oncology'.
 */
export function indicationMatches(
  input: string | null | undefined,
  ...dbFields: (string | null | undefined)[]
): boolean {
  const tokens = indicationTokens(input);
  if (tokens.length === 0) return false;
  const texts = dbFields.map(normalizeText).filter(Boolean);
  if (texts.length === 0) return false;

  return texts.some(text =>
    tokens.every(token => {
      const candidates = [token, ...(INDICATION_TOKEN_ALIASES[token] ?? [])];
      return candidates.some(c => text.includes(c.toLowerCase()));
    }),
  );
}
