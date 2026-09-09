/**
 * Pure drug-name normalization for the Asset Radar drug master.
 *
 * No I/O. Everything here is deterministic string handling so it can be unit
 * tested exhaustively (__tests__/lib/drug-name.test.ts). The resolver in
 * lib/radar/drug-master.ts layers database and external lookups on top.
 *
 * Vocabulary:
 *   key          matching key: lowercase, alphanumerics only. 'MK-3475',
 *                'MK3475' and 'mk 3475' share the key 'mk3475'.
 *   display      cleaned human form with dose, route, formulation and
 *                schedule noise removed and parentheticals lifted out.
 *   code name    sponsor development code: ABBV-400, JNJ-2113, RO7247669,
 *                BMS-986012, DS-8201a, BNT162b2, NNC0471-0119.
 *   INN          international non-proprietary name, recognised by stem.
 */

export type AliasType = 'inn' | 'code' | 'brand' | 'synonym' | 'cas' | 'unii' | 'chembl' | 'other';

/** Why a name cannot be a drug. 'placebo' covers placebo, comparators and generic drug classes. */
export type NonDrugReason = 'empty' | 'cjk' | 'placebo' | 'non_drug';

/** Mirrors lib/radar/vocab.ts RADAR_MODALITY_OPTIONS values. */
export type RadarModality =
  | 'small_molecule'
  | 'antibody'
  | 'adc'
  | 'bispecific'
  | 'car_t'
  | 'cell_therapy'
  | 'gene_therapy'
  | 'mrna'
  | 'peptide'
  | 'oligonucleotide'
  | 'radiopharm'
  | 'vaccine';

export interface NormalizedDrugName {
  /** Cleaned display form. Empty when reason is set. */
  display: string;
  /** Matching key for `display`. */
  key: string;
  /** Contents of parentheses, cleaned, in order: candidate aliases. */
  parentheticals: string[];
  /** Code names found anywhere in the raw string, canonical form. */
  codeNames: string[];
  /** Distinct alias candidates: display, parentheticals, code names (deduped by key). */
  candidates: string[];
  reason: NonDrugReason | null;
}

// ═══════════════════════════════════════════════════════════════════════
// KEYS AND CHARACTER CLASSES
// ═══════════════════════════════════════════════════════════════════════

// Ideographs, kana, hangul. Full-width punctuation is deliberately excluded:
// NFKC folds '；' to ';' and a Chinese sponsor writing 'SHR-9839；SHR-A2009'
// is still a Latin name.
const CJK_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/;

export function containsCJK(s: string): boolean {
  return CJK_RE.test(s);
}

/**
 * Lowercase, NFKC-folded, alphanumerics only (CJK ideographs kept so a CJK
 * alias can still be matched exactly). The alias_normalized column.
 */
export function normalizeKey(s: string): string {
  return (s ?? '').replace(/[™®©]/g, '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9぀-ヿ㐀-䶿一-鿿가-힯]/g, '');
}

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Strip trademark marks before NFKC (which would fold '™' into 'TM'), then fold. */
function fold(s: string): string {
  return (s ?? '').replace(/[™®©]/g, ' ').normalize('NFKC');
}

// ═══════════════════════════════════════════════════════════════════════
// CODE NAMES
// ═══════════════════════════════════════════════════════════════════════

// (start | non-alnum)(letters)(sep)(digits)(letter suffix)(second segment)(end | non-alnum)
// No lookbehind: tsconfig targets ES2017.
// Digits 2–8: Pfizer codes carry eight (PF-06882961); registry ids are blacklisted by prefix.
// The prefix may carry a hyphenated letter (SHR-A2009, HRS-A1234).
const CODE_RE = /(^|[^A-Za-z0-9])([A-Za-z]{1,6}(?:-[A-Z])?)([- ]?)(\d{2,8})([A-Za-z]{1,2}\d?)?(-\d{2,5})?(?![A-Za-z0-9])/g;

/** Registry ids, disease names and units that look like codes. */
const CODE_PREFIX_BLACKLIST = new Set([
  'NCT', 'EUCT', 'ISRCTN', 'EUDRACT', 'CTR', 'CTRI', 'JRCT', 'JPRN', 'CHICTR', 'ACTRN', 'DRKS',
  'KCT', 'NTR', 'CTIS', 'UMIN', 'IRCT', 'PACTR', 'REBEC', 'RBR', 'SLCTR', 'TCTR', 'CTN', 'IND',
  'COVID', 'SARS', 'MERS', 'ICD', 'ISO', 'DSM', 'WHO', 'ECOG', 'NYHA', 'FDA', 'EMA', 'PMDA',
  'CTCAE', 'RECIST', 'BMI', 'MG', 'MCG', 'ML', 'KG', 'IU', 'GY', 'MBQ', 'GBQ', 'MCI', 'GMP',
  'ARM', 'COHORT', 'GROUP', 'PART', 'STAGE', 'STEP', 'PHASE', 'DAY', 'WEEK', 'CYCLE', 'VISIT',
  'DOSE', 'LEVEL', 'YEAR', 'STUDY', 'PROTOCOL', 'VERSION', 'LOT', 'BATCH', 'SITE', 'ROOM',
]);

/** Gene / target symbols: a digit after these is a family member, not a code (CD20, IL17, HER2). */
const GENE_PREFIXES = new Set([
  'CD', 'IL', 'HER', 'ERBB', 'PD', 'PDL', 'CTLA', 'TNF', 'TNFR', 'IFN', 'TLR', 'HLA', 'CCR', 'CXCR',
  'CXCL', 'CCL', 'IGF', 'IGFR', 'FGF', 'FGFR', 'EGF', 'EGFR', 'VEGF', 'VEGFR', 'MMP', 'KRAS', 'NRAS',
  'HRAS', 'BRAF', 'TP', 'CYP', 'HIV', 'HPV', 'HBV', 'HCV', 'HDV', 'HEV', 'EBV', 'CMV', 'HSV', 'HHV',
  'BCL', 'MCL', 'STAT', 'JAK', 'PIK', 'PI', 'MAP', 'MAPK', 'MEK', 'ERK', 'CDK', 'ALK', 'ROS', 'RET',
  'MET', 'KIT', 'PDGFR', 'NTRK', 'TRK', 'GPR', 'GPCR', 'GLP', 'GIP', 'SGLT', 'DPP', 'PCSK', 'LDL',
  'HDL', 'APOE', 'APOC', 'APOB', 'LRRK', 'SOD', 'TDP', 'HTT', 'SMN', 'DMD', 'FXN', 'ATP', 'ADP',
  'NAD', 'COX', 'LOX', 'PPAR', 'RAR', 'RXR', 'MUC', 'CEA', 'PSA', 'PSMA', 'EPCAM', 'TROP', 'GD',
  'GPC', 'DLL', 'BCMA', 'FCRL', 'SLAMF', 'KLK', 'BAFF', 'OX', 'LAG', 'TIM', 'B', 'NKG', 'ICAM',
  'VCAM', 'ITG', 'ITGA', 'ITGB', 'TGF', 'TGFB', 'BMP', 'WNT', 'FZD', 'NOTCH', 'HGF', 'HDAC', 'BET',
  'BRD', 'PARP', 'ATR', 'ATM', 'CHK', 'WEE', 'PLK', 'AURK', 'KDM', 'EZH', 'DNMT', 'IDH', 'FLT',
  'CSF', 'GM', 'EPO', 'TPO', 'NGF', 'BDNF', 'GDNF', 'AAV', 'ADRB', 'HTR', 'DRD', 'CHRM', 'CHRN',
  'GABA', 'GABR', 'GRIN', 'GRM', 'SLC', 'ABC', 'KCN', 'SCN', 'CACN', 'TRPV', 'TRPA', 'TRPM', 'P',
  'S', 'M', 'H', 'MCP', 'MIP', 'SDF', 'ANG', 'ANGPT', 'TIE', 'FGF', 'GH', 'IGFBP', 'SST', 'SSTR',
  'CGRP', 'PTH', 'PTHR', 'VIP', 'NPY', 'AVP', 'OXT', 'TSH', 'LH', 'FSH', 'ACTH', 'CRH', 'GNRH',
  'HBA', 'COVID', 'H', 'N', 'CAR', 'TCR', 'NK', 'CD', 'TREM', 'SIRP', 'CLEC', 'LILR', 'KIR',
  'NLRP', 'IRAK', 'TYK', 'SYK', 'BTK', 'ITK', 'ZAP', 'LCK', 'SRC', 'ABL', 'BCR', 'RAF', 'RAS',
  'MTOR', 'AKT', 'PTEN', 'RB', 'MDM', 'MYC', 'MYCN', 'SMO', 'PTCH', 'GLI', 'HH', 'SHH', 'YAP',
  'TAZ', 'TEAD', 'ROR', 'RORC', 'IRF', 'NF', 'NFKB', 'IKK', 'TAK', 'RIP', 'RIPK', 'MLKL', 'CASP',
  'BAX', 'BAK', 'BID', 'BIM', 'XIAP', 'IAP', 'SMAC', 'BIRC', 'CFLAR', 'FAS', 'FASL', 'TRAIL',
  'DR', 'FN', 'COL', 'LOXL', 'ITIH', 'C', 'CR', 'CFB', 'CFD', 'CFH', 'CFI', 'MASP', 'MBL', 'FCGR',
  'FCER', 'FCRN', 'IGH', 'IGK', 'IGL', 'IGA', 'IGG', 'IGM', 'IGE', 'CH', 'VH', 'VL',
]);

/** Radionuclide tokens written like codes (Lu-177, Ac-225, I-131, Zr-89, Tc-99m). */
const ISOTOPES = new Set([
  'LU177', 'AC225', 'I131', 'I123', 'I124', 'I125', 'ZR89', 'Y90', 'GA68', 'GA67', 'F18', 'TC99',
  'CU64', 'CU67', 'RA223', 'SM153', 'SR89', 'IN111', 'RE188', 'RE186', 'PB212', 'PB203', 'AT211',
  'TB161', 'C11', 'N13', 'O15', 'RB82', 'TL201', 'XE133', 'HO166', 'BI213', 'BI212', 'TH227',
  'SC44', 'SC47', 'ZR90', 'P32', 'P33', 'S35', 'H3', 'C14', 'FE59', 'CR51', 'CO57', 'CO60', 'I129',
  'CS137', 'IR192', 'PD103', 'YB169', 'ER169', 'DY165', 'SN117',
]);

function isAcceptableCode(rawLetters: string, sep: string, digits: string): boolean {
  // 'SHR-A' → judge on 'SHR'; the hyphenated letter is part of the code.
  const letters = rawLetters.replace(/-[A-Z]$/, '');
  const L = letters.toUpperCase();
  if (CODE_PREFIX_BLACKLIST.has(L)) return false;
  if (ISOTOPES.has(`${L}${digits}`)) return false;
  // Single-letter prefixes are cycle/day/week markers (D28, C12, W24) unless the
  // number is long and unseparated (Eisai E7080, E7389).
  if (letters.length === 1) {
    if (sep !== '' || digits.length < 4) return false;
    return true;
  }
  if (GENE_PREFIXES.has(L)) {
    // CD20, IL17, HER2, IL-6: family members. CD-388 (three digits, hyphenated) is a code.
    if (digits.length <= 2) return false;
    if (sep === '') return false;
  }
  // 'STUDY 2024' style years with a spaced separator.
  if (sep === ' ' && digits.length === 4 && /^(19|20)\d{2}$/.test(digits)) return false;
  return true;
}

function canonicalCodeDisplay(letters: string, sep: string, digits: string, suffix: string, seg2: string): string {
  const prefix = letters === letters.toLowerCase() ? letters.toUpperCase() : letters;
  return `${prefix}${sep === '' ? '' : '-'}${digits}${suffix}${seg2}`;
}

/**
 * Extract sponsor development codes from free text. Never fuzzy: ABC-123 and
 * ABC-124 are distinct. Returns canonical display forms (uppercased prefix,
 * hyphen instead of space) with duplicates removed by key.
 */
export function extractCodeNames(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const src = collapse(fold(text));
  for (const m of src.matchAll(CODE_RE)) {
    const letters = m[2];
    const sep = m[3];
    const digits = m[4];
    const suffix = m[5] ?? '';
    const seg2 = m[6] ?? '';
    // A spaced separator is only a code when the prefix is shouting (MK 3475,
    // not 'at 12'), or when the whole string is just that token ('mk 3475').
    if (sep === ' ' && letters !== letters.toUpperCase() && m[0].trim() !== src) continue;
    if (!isAcceptableCode(letters, sep, digits)) continue;
    const display = canonicalCodeDisplay(letters, sep, digits, suffix, seg2);
    const key = normalizeKey(display);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }
  return out;
}

/** True when the whole string is exactly one code name. */
export function isCodeName(s: string): boolean {
  if (!s) return false;
  const codes = extractCodeNames(s);
  return codes.length === 1 && normalizeKey(codes[0]) === normalizeKey(s);
}

// ═══════════════════════════════════════════════════════════════════════
// INN STEMS
// ═══════════════════════════════════════════════════════════════════════

/** USAN/INN stems, matched as word suffixes. Order does not matter. */
export const INN_STEMS: string[] = [
  // biologics
  'mab', 'cept', 'kinra', 'poetin', 'grastim', 'tropin', 'relin', 'ase',
  // oligonucleotides, gene and cell therapy
  'siran', 'rsen', 'gene', 'vec', 'cel', 'leucel',
  // kinase and other targeted small molecules
  'nib', 'ciclib', 'parib', 'lisib', 'sertib', 'zomib', 'degib', 'clax', 'stat',
  'lutamide', 'trexed', 'imus',
  // ADC payload/linker stems
  'tansine', 'dotin', 'tecan',
  // cytotoxics and anti-infectives
  'platin', 'taxel', 'rubicin', 'mycin', 'micin', 'cillin', 'cycline', 'floxacin', 'fungin', 'vir',
  // cardiometabolic and CNS
  'pril', 'sartan', 'statin', 'olol', 'dipine', 'tidine', 'prazole', 'glitazone', 'gliptin',
  'gliflozin', 'tide', 'afil', 'dronate', 'prost', 'terol', 'lukast', 'triptan', 'setron', 'pitant',
  'azole', 'caine', 'zepam', 'zolam', 'oxetine', 'pramine', 'apine', 'peridol', 'ridone', 'barbital',
  'gepant', 'ditan', 'zolid', 'penem', 'kiren', 'semide', 'thiazide', 'pressin', 'pexole',
];

/** Ordinary words that end in an INN stem. */
const INN_STOPWORDS = new Set([
  'peptide', 'polypeptide', 'nucleotide', 'oligonucleotide', 'dipeptide', 'tripeptide',
  'cancel', 'parcel', 'excel', 'release', 'disease', 'phase', 'increase', 'decrease', 'purchase',
  'concept', 'intercept', 'except', 'accept', 'percept', 'transgene', 'cholesterol', 'glycerol',
  'april', 'reservoir', 'elixir', 'thermostat', 'apostat', 'protein', 'vaccine', 'combine',
  'oncogene', 'ergosterol', 'customer', 'former', 'polymer', 'copolymer',
  'placebo', 'sterol', 'control', 'protocol', 'alcohol', 'ethanol', 'methanol', 'lipid', 'rapid',
  'base', 'case', 'chase', 'lease', 'please', 'erase', 'database', 'baseline', 'immunoglobulin',
  'insulin', 'heparin', 'aspirin', 'vitamin', 'saline', 'creatine', 'caffeine', 'nicotine',
  'minimus', 'maximus', 'hummus', 'campus',
  // enzyme class words, not enzyme drugs (alteplase, asparaginase still match)
  'kinase', 'kinases', 'protease', 'proteases', 'caspase', 'nuclease', 'lipase', 'esterase', 'oxidase',
  'reductase', 'synthase', 'synthetase', 'transferase', 'hydrolase', 'dehydrogenase', 'polymerase',
  'helicase', 'ligase', 'isomerase', 'phosphatase', 'peptidase', 'elastase', 'collagenase',
  'aromatase', 'cyclase', 'lactase', 'amylase', 'sucrase', 'maltase', 'tyrosinase', 'telomerase',
  'topoisomerase', 'integrase', 'transcriptase', 'deacetylase', 'methyltransferase', 'acetylase',
]);

/** Salts and qualifiers that follow an INN without changing it. */
const SALT_WORDS = new Set([
  'hydrochloride', 'hcl', 'dihydrochloride', 'hydrobromide', 'sodium', 'disodium', 'potassium',
  'calcium', 'magnesium', 'lithium', 'zinc', 'mesylate', 'mesilate', 'maleate', 'fumarate',
  'tartrate', 'bitartrate', 'citrate', 'acetate', 'sulfate', 'sulphate', 'phosphate', 'succinate',
  'besylate', 'besilate', 'tosylate', 'tosilate', 'bromide', 'chloride', 'malate', 'monohydrate',
  'hydrate', 'trihydrate', 'dihydrate', 'anhydrous', 'alfa', 'alpha', 'beta', 'gamma', 'delta',
  'pegol', 'peg', 'lactate', 'gluconate', 'nitrate', 'oxalate', 'palmitate', 'decanoate',
  'benzoate', 'valerate', 'propionate', 'pamoate', 'xinafoate', 'dipropionate', 'furoate',
  'trifenatate', 'argine', 'lysine', 'cilexetil', 'medoxomil', 'etexilate', 'pivoxil',
  'axetil', 'proxetil', 'aspart', 'lispro', 'glargine', 'detemir', 'degludec',
]);

function stripSaltWords(words: string[]): string[] {
  const out = [...words];
  while (out.length > 1 && SALT_WORDS.has(out[out.length - 1].toLowerCase())) out.pop();
  return out;
}

function wordHasInnStem(word: string): boolean {
  // 'sipuleucel-T', 'ide-cel'
  const w = word.toLowerCase().replace(/-t$/, '').replace(/[^a-z]/g, '');
  if (w.length < 6) return false;
  if (INN_STOPWORDS.has(w)) return false;
  if (w.endsWith('ease') || w.endsWith('base') || w.endsWith('case')) return false;
  return INN_STEMS.some(stem => w.endsWith(stem));
}

/**
 * True when the name reads as an INN: one to three alphabetic words (salt
 * words allowed after) whose last word ends in a known stem. Code names and
 * numbers disqualify.
 */
export function looksLikeInn(name: string): boolean {
  if (!name) return false;
  const cleaned = fold(name).trim();
  if (!cleaned || /\d/.test(cleaned)) return false;
  const words = stripSaltWords(collapse(cleaned).split(' '));
  if (words.length === 0 || words.length > 3) return false;
  if (!words.every(w => /^[A-Za-z][A-Za-z-]*$/.test(w))) return false;
  return wordHasInnStem(words[words.length - 1]);
}

/** Any word in the text that carries an INN stem (used to guard non-drug detection). */
export function hasInnWord(text: string): boolean {
  if (!text) return false;
  return collapse(fold(text))
    .split(/[\s/+,;]+/)
    .some(w => /^[A-Za-z][A-Za-z-]*$/.test(w) && wordHasInnStem(w));
}

// ═══════════════════════════════════════════════════════════════════════
// PLACEBO, COMPARATOR, GENERIC CLASS, NON-DRUG
// ═══════════════════════════════════════════════════════════════════════

const PLACEBO_EXACT = new Set([
  'placebo', 'placebos', 'standard of care', 'soc', 'best supportive care', 'bsc', 'supportive care',
  'vehicle', 'saline', 'normal saline', 'sham', 'usual care', 'chemotherapy', 'chemo',
  'treatment as usual', 'tau', 'no treatment', 'no intervention', 'observation', 'active comparator',
  'comparator', 'control', 'control group', 'control arm', 'standard therapy', 'standard treatment',
  'conventional treatment', 'conventional therapy', 'background therapy', 'background treatment',
  'dose', 'drug', 'device', 'procedure', 'other', 'biological', 'biologic', 'combination product',
  'immunotherapy', 'targeted therapy', 'hormone therapy', 'hormonal therapy', 'endocrine therapy',
  'radiotherapy', 'radiation', 'surgery', 'antibiotics', 'antibiotic', 'steroids', 'corticosteroids',
  'water', 'sterile water', 'dextrose', 'glucose', 'sugar pill', 'vehicle control', 'vehicle cream',
  'vehicle gel', 'matching placebo', 'placebo comparator', 'placebo control',
  // generic class words left behind once 'therapy'/'treatment' is stripped
  'endocrine', 'hormonal', 'hormone', 'targeted', 'cytotoxic', 'systemic', 'adjuvant', 'neoadjuvant',
  'maintenance', 'induction', 'consolidation', 'salvage', 'palliative', 'supportive', 'antiviral',
  'antiemetic', 'analgesic', 'anesthesia', 'anaesthesia', 'sedation', 'antibody', 'vaccine',
  'chemotherapeutic', 'immunosuppression', 'immunosuppressive', 'conditioning', 'prophylaxis',
  'gene', 'cell', 'cells', 'stem cell', 'stem cells', 'car-t', 'car-t cell', 'car-t cells', 'car t',
  'car t cell', 'car t cells', 'nk cell', 'nk cells', 't cell', 't cells', 'til', 'gene therapy',
  'cell therapy', 'stem cell therapy', 'car-t cell therapy', 'car t cell therapy',
  // backbone regimens
  'chop', 'r-chop', 'rchop', 'r-minichop', 'minichop', 'folfox', 'folfiri', 'folfoxiri', 'folfirinox',
  'xelox', 'capox', 'abvd', 'beacopp', 'bep', 'cvp', 'r-cvp', 'ice', 'dhap', 'gemox', 'hyper-cvad',
  'vad', 'rvd', 'vrd', 'krd', 'ac-t', 'fec', 'tc', 'tch', 'tchp', 'mvac', 'ddmvac', 'gc', 'gp',
  'tpf', 'epoch', 'r-epoch', 'da-epoch-r', 'flot', 'ecf', 'eox', 'chemoradiation', 'chemoradiotherapy',
  'crt', 'ccrt', 'br', 'bendamustine-rituximab', 'r2', 'ctx', 'sct', 'asct', 'hsct',
]);

const PLACEBO_PREFIX_RE = /^(?:matching\s+|matched\s+|oral\s+|iv\s+|sc\s+|double[- ]dummy\s+|corresponding\s+)?placebo(?:s)?\b/i;
const CHEMO_RE = /^(?:standard(?:\s+of\s+care)?|conventional|platinum[- ]based|cytotoxic|systemic|adjuvant|neoadjuvant|induction|salvage|combination|doublet|triplet|multi-?agent|single[- ]agent|investigator'?s?\s+choice|physician'?s?\s+choice)?\s*chemotherapy(?:\s+(?:regimen|agents?|drugs?))?$/i;
const CHOICE_RE = /^(?:investigator|physician|treating physician|clinician|doctor)'?s?\s+choice\b/i;
const SHAM_RE = /^sham(?:\s+(?:procedure|injection|control|surgery|treatment|comparator|device|stimulation))?$/i;
const VEHICLE_RE = /^vehicle(?:\s+(?:control|cream|gel|ointment|solution|foam|lotion|only))?$/i;

/** Placebo, comparator, backbone regimen, or a generic drug class without a specific agent. */
export function isPlaceboOrGeneric(name: string): boolean {
  if (!name) return true;
  const lower = collapse(fold(name).toLowerCase())
    .replace(/[.:]+$/, '')
    .trim();
  if (!lower) return true;
  if (PLACEBO_EXACT.has(lower)) return true;
  if (PLACEBO_PREFIX_RE.test(lower)) return true;
  if (CHEMO_RE.test(lower)) return true;
  if (CHOICE_RE.test(lower)) return true;
  if (SHAM_RE.test(lower) || VEHICLE_RE.test(lower)) return true;
  // A long descriptive sentence naming no agent ("Cancer treatment with tyrosine
  // kinase inhibitors or other molecularly targeted agents").
  const wordCount = lower.split(' ').length;
  if (wordCount >= 8 && extractCodeNames(name).length === 0 && !hasInnWord(name)) return true;
  return false;
}

const NON_DRUG_RE = new RegExp(
  '(?:^|\\s|-)(?:' +
    [
      'questionnaires?', 'interviews?', 'surveys?', 'screeners?', 'screening', 'letters?', 'apps?',
      'website', 'web-based', 'online', 'programs?', 'programmes?', 'education',
      'educational', 'counsel(?:l)?ing', 'coaching', 'training', 'exercises?', 'physiotherapy',
      'physical therapy', 'rehabilitation', 'surgery', 'surgical', 'resection', 'biopsy', 'biopsies',
      'scans?', 'imaging', 'mri', 'ultrasound', 'ultrasonography', 'echocardiography', 'radiotherapy',
      'radiation therapy', 'brachytherapy', 'sbrt', 'imrt', 'proton therapy', 'devices?', 'implants?',
      'lens', 'lenses', 'catheters?', 'stents?', 'stimulation', 'stimulators?', 'acupuncture',
      'massage', 'diet', 'dietary', 'nutrition(?:al)?', 'blood draw', 'sample collection',
      'data collection', 'monitoring', 'assessment', 'testing', 'visits?', 'consultation',
      'telehealth', 'telemedicine', 'mobile', 'virtual', 'sleep study', 'study', 'procedures?',
      'technique', 'protocol', 'pcr', 'system', 'software', 'algorithm', 'intervention',
      'yoga', 'meditation', 'mindfulness', 'hypnosis', 'music', 'video', 'text messages?', 'sms',
      'reminder', 'brochure', 'booklet', 'pamphlet', 'session', 'sessions', 'workshop', 'curriculum',
      'dressing', 'bandage', 'brace', 'splint', 'orthosis', 'prosthesis', 'pacemaker', 'defibrillator',
      'ventilation', 'oxygen therapy', 'laser', 'phototherapy', 'cryotherapy', 'ablation',
      'transplant(?:ation)?', 'dialysis', 'apheresis', 'plasmapheresis', 'photopheresis',
      'endoscopy', 'colonoscopy', 'bronchoscopy', 'laparoscopy', 'arthroscopy', 'cystoscopy',
      'ureteroscopy', 'hysteroscopy', 'gastroscopy', 'esophagogastroduodenoscopy', 'scintigraphy',
      'tomography', 'radiography', 'mammography', 'angiography', 'spectroscopy', 'electrophysiology',
      'electrocardiogram', 'ecg', 'eeg', 'emg',
    ].join('|') +
    ')(?=$|\\s|[-,;:.)])',
  'i',
);

const ANATOMICAL_PROCEDURE_RE = /\w+(?:ectomy|ostomy|otomy|oscopy|plasty|pexy|rrhaphy|desis)\b/i;

/** Procedures, devices, behavioural and diagnostic interventions. Never matches when a code or INN is present. */
export function isNonDrugIntervention(name: string): boolean {
  if (!name) return false;
  const s = collapse(fold(name));
  if (extractCodeNames(s).length > 0) return false;
  if (hasInnWord(s)) return false;
  return NON_DRUG_RE.test(s) || ANATOMICAL_PROCEDURE_RE.test(s);
}

// ═══════════════════════════════════════════════════════════════════════
// DISPLAY CLEANING
// ═══════════════════════════════════════════════════════════════════════

const LEADING_NOISE_RE = /^(?:study\s+drug|investigational\s+(?:product|drug|agent|medicinal\s+product)|imp|drug|biological|biologic|treatment|experimental|active|test\s+(?:product|article))\s*[:\-–]?\s+/i;
const LEADING_ROUTE_RE = /^(?:single[- ]agent|single[- ]dose|multiple[- ]dose|low[- ]dose|high[- ]dose|mid[- ]dose|fixed[- ]dose|intratumoral(?:ly)?|intravenous(?:ly)?|subcutaneous(?:ly)?|intramuscular(?:ly)?|intrathecal(?:ly)?|intravitreal(?:ly)?|intranasal|inhaled|topical|oral|iv|sc|po|im|nebuli[sz]ed)\s+/i;

const DOSE_RE = /(?:^|\s|\()\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*\s*(?:x\s*\d+\s*)?(?:mg|mcg|μg|µg|ug|ng|g|kg|ml|l|iu|u|units?|%|mmol|µmol|μmol|nmol|gy|bq|mbq|gbq|mci|ci|cells?|vp|vg|pfu|cfu|tablets?|capsules?|doses?|days?|weeks?|cycles?|months?|hours?|hrs?|h|min|minutes?|puffs?|sprays?|drops?|ampoules?|vials?|pens?|sachets?|patches?|mm|cm|w|d)\b(?:\s*\/\s*(?:kg|m2|m²|day|d|dose|ml|l|week|w|h|hr|min))?.*$/i;
const DOSE_PHRASE_RE = /\b(?:at|as|in)\s+(?:a\s+|an\s+|the\s+)?(?:single\s+|multiple\s+|fixed\s+|flat\s+|recommended\s+|maximum\s+tolerated\s+|escalating\s+|ascending\s+)?(?:dose|doses|dosing|dosage)s?\b.*$/i;
const DOSE_QUALIFIER_RE = /\b(?:dose|dosing|dosage)\s+(?:regimen|level|group|arm|cohort|escalation|expansion|schedule|[a-z0-9]{1,2})\b.*$/i;
const ARM_RE = /\b(?:regimen|arm|cohort|group|level|schedule|part|stage|sequence)\s+[a-z0-9]{1,2}\b.*$/i;
const SCHEDULE_RE = /\b(?:q\d+[wdhm]|q[wdm]|qd|qod|bid|tid|qid|qw|biw|tiw|once\s+(?:daily|weekly|monthly)|twice\s+(?:daily|weekly)|(?:every|per)\s+(?:day|week|month|\d+\s+(?:days|weeks|hours))|daily|weekly|monthly)\b.*$/i;

const ROUTE_FORM_RE = new RegExp(
  '(^|\\s)(?:' +
    [
      'i\\.?v\\.?', 'intravenous(?:ly)?', 's\\.?c\\.?', 'subcutaneous(?:ly)?', 'p\\.?o\\.?', 'oral(?:ly)?',
      'i\\.?m\\.?', 'intramuscular(?:ly)?', 'intratumoral(?:ly)?', 'intrathecal(?:ly)?',
      'intravitreal(?:ly)?', 'intradermal', 'intranasal', 'inhaled', 'inhalation', 'topical(?:ly)?',
      'nasal', 'ophthalmic', 'transdermal', 'infusions?', 'injections?', 'injectable', 'injected',
      'tablets?', 'tabs?', 'capsules?', 'caps?', 'solution', 'suspension', 'emulsion', 'cream', 'gel',
      'ointment', 'lotion', 'spray', 'patch', 'film', 'powder', 'syrup', 'lyophili[sz]ed',
      'for\\s+injection', 'for\\s+infusion', 'extended[- ]release', 'delayed[- ]release',
      'immediate[- ]release', 'prolonged[- ]release', 'sustained[- ]release', 'modified[- ]release',
      'xr', 'er', 'sr', 'pr', 'cr', 'la', 'prefilled\\s+syringe', 'pre-filled\\s+syringe',
      'autoinjector', 'auto-injector', 'vials?', 'ampoule', 'sachet', 'formulation', 'monotherapy',
      'eye\\s+drops', 'drops',
      'single[- ]agent', 'single[- ]dose', 'multiple[- ]dose', 'low[- ]dose', 'high[- ]dose',
      'mid[- ]dose', 'fixed[- ]dose', 'nebuli[sz]ed', 'liposomal', 'pegylated',
    ].join('|') +
    ')(?=$|\\s|[,;.)])',
  'gi',
);

function cleanDisplay(input: string, hasCode: boolean): string {
  let t = collapse(input);
  for (let i = 0; i < 3; i++) {
    const before = t;
    t = t.replace(LEADING_NOISE_RE, '');
    t = t.replace(LEADING_ROUTE_RE, '');
    if (t === before) break;
  }
  t = t.replace(DOSE_RE, ' ');
  t = t.replace(DOSE_PHRASE_RE, ' ');
  t = t.replace(DOSE_QUALIFIER_RE, ' ');
  // 'Arm A', 'Cohort 2' only when a code name anchors the string; otherwise
  // 'Group B streptococcus vaccine' would lose its meaning.
  if (hasCode) t = t.replace(ARM_RE, ' ');
  t = t.replace(SCHEDULE_RE, ' ');
  t = t.replace(ROUTE_FORM_RE, '$1');
  t = t.replace(/\s+\.\s+/g, ' ');
  t = collapse(t);
  // strip leading/trailing separators and punctuation
  t = t.replace(/^[\s\-–,;:/.]+/, '').replace(/[\s\-–,;:/.]+$/, '');
  t = collapse(t);
  // 'ribociclib treatment', 'olaparib monotherapy'
  t = t.replace(/\s+(?:treatment|regimen|monotherapy|arm|group|product|agent)$/i, '');
  if (/\s+therapy$/i.test(t) && hasInnWord(t.replace(/\s+therapy$/i, ''))) {
    t = t.replace(/\s+therapy$/i, '');
  }
  // 'NNC0471-0119 H' → arm letter after a code name
  if (hasCode && /\s[A-Z]$/.test(t)) t = t.replace(/\s[A-Z]$/, '');
  return t;
}

const PAREN_NOISE_RE = /^(?:also\s+known\s+as|a\.?k\.?a\.?|formerly(?:\s+known\s+as)?|previously(?:\s+known\s+as)?|brand\s+name|trade\s+name|generic\s+name|inn|code\s+name)\s*:?\s*/i;

function cleanParenthetical(inner: string): string[] {
  const out: string[] = [];
  for (const piece of inner.split(/[;,]|\s+or\s+/i)) {
    let p = collapse(piece).replace(PAREN_NOISE_RE, '');
    p = cleanDisplay(p, extractCodeNames(p).length > 0);
    if (!p) continue;
    if (/^\d+$/.test(p)) continue;
    if (isPlaceboOrGeneric(p) && extractCodeNames(p).length === 0) continue;
    if (p.length < 2) continue;
    out.push(p);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Normalize one intervention string. Does not split combinations; call
 * splitCombination first and normalize each component.
 */
export function normalizeDrugName(raw: string): NormalizedDrugName {
  const base: NormalizedDrugName = {
    display: '',
    key: '',
    parentheticals: [],
    codeNames: [],
    candidates: [],
    reason: null,
  };
  if (!raw || !raw.trim()) return { ...base, reason: 'empty' };

  const trimmed = raw.trim();
  if (containsCJK(trimmed)) {
    return { ...base, display: trimmed, key: normalizeKey(trimmed), candidates: [trimmed], reason: 'cjk' };
  }

  let s = collapse(fold(trimmed));

  // Procedures and devices first: 'Sham procedure' and 'The RibFix device should
  // be used in this arm' are non-drug before they are generic.
  if (isNonDrugIntervention(s)) return { ...base, display: s, key: normalizeKey(s), reason: 'non_drug' };
  if (isPlaceboOrGeneric(s)) return { ...base, display: s, key: normalizeKey(s), reason: 'placebo' };

  const codeNames = extractCodeNames(s);

  // Lift parentheticals out (balanced or truncated: 'DWZ2501 (Olaparib').
  const parentheticals: string[] = [];
  s = s.replace(/\(([^()]*)\)?/g, (_m, inner: string) => {
    for (const p of cleanParenthetical(inner)) parentheticals.push(p);
    return ' ';
  });

  let display = cleanDisplay(s, codeNames.length > 0);

  // '(pembrolizumab)' alone, or a name that was all dose noise: fall back.
  if (!display) display = parentheticals[0] ?? codeNames[0] ?? '';
  if (!display) return { ...base, reason: 'empty' };

  // 'mk 3475' → 'MK-3475': when the display is exactly a code, show the canonical code.
  const canonicalCode = codeNames.find(c => normalizeKey(c) === normalizeKey(display));
  if (canonicalCode) display = canonicalCode;

  // Re-check after cleaning ('Placebo tablets 200 mg' → 'Placebo').
  if (isPlaceboOrGeneric(display) && codeNames.length === 0 && parentheticals.length === 0) {
    return { ...base, display, key: normalizeKey(display), reason: 'placebo' };
  }

  const key = normalizeKey(display);
  const candidates: string[] = [];
  const seen = new Set<string>();
  const push = (c: string) => {
    const k = normalizeKey(c);
    if (!k || seen.has(k)) return;
    seen.add(k);
    candidates.push(c);
  };
  push(display);
  for (const p of parentheticals) push(p);
  for (const c of codeNames) push(c);

  return {
    display,
    key,
    parentheticals: parentheticals.filter(p => normalizeKey(p) !== key),
    codeNames,
    candidates,
    reason: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// COMBINATIONS
// ═══════════════════════════════════════════════════════════════════════

export interface CombinationSplit {
  /** Raw component substrings (trimmed), each still to be normalized. Empty when nothing is a drug. */
  components: string[];
  isCombination: boolean;
}

const STRONG_SEPARATOR_RE = /\s*(?:\+|\bplus\b|\bin\s+combination\s+with\b|\bcombined\s+with\b|\bcombination\s+with\b|\bfollowed\s+by\b|\bthen\b|;)\s*/i;
const WEAK_SEPARATOR_RE = /\s*(?:\/|,|\band\b|\bwith\b|&)\s*/i;

/** Heuristic: does this fragment read like a single named agent? Used to decide weak splits. */
export function looksLikeDrugName(fragment: string): boolean {
  const n = normalizeDrugName(fragment);
  if (n.reason) return false;
  if (n.codeNames.length > 0) return true;
  const words = n.display.split(' ');
  if (words.length > 4) return false;
  if (/\b(?:therapy|treatment|care|agents?|regimen|based|other|any|standard|arm|cohort|group)\b/i.test(n.display)) return false;
  if (hasInnWord(n.display)) return true;
  if (/^[A-Z]{3,}$/.test(words[0])) return true;
  const alpha = words[0].replace(/[^A-Za-z]/g, '');
  return alpha.length >= 5;
}

function isUsableComponent(fragment: string): boolean {
  const n = normalizeDrugName(fragment);
  if (n.reason) return false;
  if (!n.display) return false;
  if (n.codeNames.length > 0) return true;
  return n.display.replace(/[^A-Za-z0-9]/g, '').length >= 3;
}

/**
 * Split 'A + B', 'A plus B', 'A in combination with B', 'A/B', 'A and B'
 * (weak forms only when at least two sides look like drugs). Placebo,
 * backbone regimens and non-drug parts are dropped; 'SBRT + MEDI5752' is
 * therefore a single drug, not a combination.
 */
export function splitCombination(raw: string): CombinationSplit {
  if (!raw || !raw.trim()) return { components: [], isCombination: false };
  const s = collapse(fold(raw));
  if (containsCJK(s)) return { components: [s], isCombination: false };

  // A whole-string placebo/generic sentence or procedure is never a combination
  // ('Cancer treatment with tyrosine kinase inhibitors or other agents').
  const wholeReason = normalizeDrugName(s).reason;
  if (wholeReason === 'placebo' || wholeReason === 'non_drug') return { components: [], isCombination: false };

  const strongParts = s.split(STRONG_SEPARATOR_RE).map(collapse).filter(Boolean);
  const components: string[] = [];
  const seen = new Set<string>();
  const add = (c: string) => {
    const k = normalizeKey(normalizeDrugName(c).display || c);
    if (!k || seen.has(k)) return;
    seen.add(k);
    components.push(c);
  };

  for (const part of strongParts) {
    const weak = part.split(WEAK_SEPARATOR_RE).map(collapse).filter(Boolean);
    if (weak.length >= 2) {
      const drugLike = weak.filter(looksLikeDrugName);
      if (drugLike.length >= 2) {
        for (const d of drugLike) add(d);
        continue;
      }
      // 'Pembrolizumab with chemotherapy': one agent beside placebo/generic parts.
      const nonDrug = weak.filter(w => normalizeDrugName(w).reason !== null);
      if (drugLike.length === 1 && drugLike.length + nonDrug.length === weak.length) {
        add(drugLike[0]);
        continue;
      }
    }
    if (isUsableComponent(part)) add(part);
  }

  return { components, isCombination: components.length > 1 };
}

// ═══════════════════════════════════════════════════════════════════════
// ALIAS CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════

const CAS_RE = /^\d{2,7}-\d{2}-\d$/;
const UNII_RE = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{10}$/;
const CHEMBL_RE = /^CHEMBL\d+$/i;

export function classifyAlias(alias: string): AliasType {
  if (!alias) return 'other';
  const hasMark = /[™®]/.test(alias);
  const s = collapse(fold(alias));
  if (!s) return 'other';
  if (CHEMBL_RE.test(s)) return 'chembl';
  if (CAS_RE.test(s)) return 'cas';
  if (UNII_RE.test(s) && !isCodeName(s)) return 'unii';
  if (isCodeName(s)) return 'code';
  const bare = s;
  if (looksLikeInn(bare)) return 'inn';
  if (hasMark) return 'brand';
  if (/^[A-Z]{4,}$/.test(bare)) return 'brand';
  if (/^[A-Z]{4,}(?:\s+[A-Z]{2,})+$/.test(bare) && bare.length <= 24) return 'brand';
  return 'synonym';
}

// ═══════════════════════════════════════════════════════════════════════
// FUZZY (INN ONLY)
// ═══════════════════════════════════════════════════════════════════════

function levenshteinWithin1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (la > lb) i++;
    else if (lb > la) j++;
    else {
      i++;
      j++;
    }
  }
  if (i < la || j < lb) edits++;
  return edits <= 1;
}

/**
 * Conservative INN fuzzy: both names must be alphabetic, at least 8 characters,
 * and within one edit. Code names never fuzzy-match.
 */
export function innFuzzyEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (containsCJK(a) || containsCJK(b)) return false;
  const ka = normalizeKey(a);
  const kb = normalizeKey(b);
  if (ka === kb) return true;
  if (ka.length < 8 || kb.length < 8) return false;
  if (/\d/.test(ka) || /\d/.test(kb)) return false;
  return levenshteinWithin1(ka, kb);
}

// ═══════════════════════════════════════════════════════════════════════
// MODALITY INFERENCE
// ═══════════════════════════════════════════════════════════════════════

const ADC_RE = /\b(?:vedotin|deruxtecan|govitecan|emtansine|tesirine|mafodotin|tirumotecan|ozogamicin|soravtansine|ravtansine|tesirine|pelidotin|ecteribulin|rezetecan|zovodotin)\b|\badc\b|antibody[- ]drug conjugate/i;
const RADIO_RE = /^\[?\d{2,3}\]?\s*[A-Z][a-z]?[- ]|\b(?:lu|lutetium)[- ]?177\b|\b177[- ]?lu\b|\b(?:ac|actinium)[- ]?225\b|\b225[- ]?ac\b|\b(?:i|iodine)[- ]?131\b|\b131[- ]?i\b|\b(?:ra|radium)[- ]?223\b|\b(?:y|yttrium)[- ]?90\b|\b(?:ga|gallium)[- ]?68\b|\b(?:zr|zirconium)[- ]?89\b|\b(?:tc|technetium)[- ]?99m?\b|\b(?:cu|copper)[- ]?64\b|\b(?:f|fluorine)[- ]?18\b|\b(?:pb|lead)[- ]?212\b|\b(?:at|astatine)[- ]?211\b|\b(?:tb|terbium)[- ]?161\b|radioligand|radiopharm/i;

/** Modality from the name alone (INN stem, payload word, radionuclide, platform word). */
export function inferModalityFromName(name: string): RadarModality | null {
  if (!name) return null;
  const s = collapse(fold(name));
  const lower = s.toLowerCase();
  if (RADIO_RE.test(s)) return 'radiopharm';
  if (ADC_RE.test(s)) return 'adc';
  if (/\bbispecific\b|\bbi-specific\b|\btrispecific\b/.test(lower)) return 'bispecific';
  if (/\bcar[- ]?t\b|\bcar[- ]?nk\b|cabtagene|tisagenlecleucel|\bchimeric antigen receptor\b/.test(lower)) return 'car_t';
  if (/\bvaccine\b|\btoxoid\b|\bimmunization\b/.test(lower)) return 'vaccine';
  if (/^mrna[- ]|\bmrna\b|\bsamrna\b/.test(lower)) return 'mrna';
  if (/\bantisense\b|\bsirna\b|\baptamer\b|\bmirna\b|\boligonucleotide\b/.test(lower)) return 'oligonucleotide';
  if (/\bgene therapy\b|\baav\d*\b|\blentiviral\b|\badenovir/.test(lower)) return 'gene_therapy';
  if (/\bcell therapy\b|\bstem cells?\b|\bnk cells?\b|\bt[- ]cells?\b|\btil\b|\bmsc\b/.test(lower)) return 'cell_therapy';

  const words = stripSaltWords(lower.split(' '));
  const last = (words[words.length - 1] ?? '').replace(/-t$/, '').replace(/[^a-z]/g, '');
  const endsWith = (...stems: string[]) => stems.some(st => last.endsWith(st));

  // '-leucel' alone is any cell therapy (sipuleucel-T); CAR-T is caught above by 'cabtagene'.
  if (endsWith('cel')) return 'cell_therapy';
  if (endsWith('vec', 'gene')) return 'gene_therapy';
  if (endsWith('mab')) return 'antibody';
  if (endsWith('siran', 'rsen', 'mer') && last.length >= 8) return 'oligonucleotide';
  if (endsWith('tide', 'relin', 'glutide', 'pressin')) return 'peptide';
  if (endsWith('nib', 'ciclib', 'parib', 'lisib', 'sertib', 'zomib', 'degib', 'clax', 'stat', 'lutamide',
    'trexed', 'imus', 'tecan', 'platin', 'taxel', 'rubicin', 'mycin', 'micin', 'cillin', 'cycline', 'floxacin',
    'fungin', 'vir', 'pril', 'sartan', 'statin', 'olol', 'dipine', 'tidine', 'prazole', 'glitazone',
    'gliptin', 'gliflozin', 'afil', 'dronate', 'prost', 'terol', 'lukast', 'triptan', 'setron', 'pitant',
    'azole', 'caine', 'zepam', 'zolam', 'oxetine', 'pramine', 'apine', 'peridol', 'ridone')) {
    return 'small_molecule';
  }
  return null;
}

/** ChEMBL molecule_type → radar modality. Anything ambiguous returns null so the name rule decides. */
export function modalityFromChemblType(moleculeType: string | null | undefined): RadarModality | null {
  if (!moleculeType) return null;
  const t = moleculeType.toLowerCase();
  if (t === 'small molecule') return 'small_molecule';
  if (t === 'antibody') return 'antibody';
  if (t === 'oligonucleotide') return 'oligonucleotide';
  if (t === 'cell') return 'cell_therapy';
  if (t === 'gene') return 'gene_therapy';
  return null;
}

/** GSRS substanceClass → radar modality. */
export function modalityFromGsrsClass(substanceClass: string | null | undefined): RadarModality | null {
  if (!substanceClass) return null;
  const c = substanceClass.toLowerCase();
  if (c === 'chemical') return 'small_molecule';
  if (c === 'nucleicacid') return 'oligonucleotide';
  return null;
}
