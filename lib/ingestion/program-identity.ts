/**
 * Drug identifiers in a program name, the same way the database reads them
 * (radar_asset_identifiers, migration 187): development codes ("HLX37",
 * "PF-07104091", "BI 10773", "4D-150") and INN-shaped words ("ivonescimab"),
 * normalized to upper case without hyphens or spaces, in the order written.
 *
 * Disclosed programs (filings, pipeline pages) use this to (a) match an
 * existing registry row whose arm name carries the same code ("HLX37 dose1"),
 * (b) refuse to create a program whose code already belongs to another
 * company's program, and (c) give new rows an asset_name that contains the
 * code so migration 187 groups them with the registry program.
 */

// Prefixes that look like a code but name a target, unit, form or registry (kept in sync with migration 187).
const NOT_CODE_PREFIX = new Set((
  'CD IL PD HER GLP FGF VEGF HPV COVID SARS CTLA TNF IGF TLR CCR CXCR HLA JAK CDK BTK EGFR MDI NCT CTR KRAS BRCA HBV HCV ' +
  'HIV USP FDA CYP MAGE NY ESO GD MUC DLL FLT ALK ROS MET SSTR PSMA CA PDL TIGIT LAG TIM OX CCL CXCL HSP MMP PI AKT MEK ' +
  'ERK IDH FGFR PARP STAT SHP BCL MCL IRAK NLRP TYK BMP TGF GPR SGLT DPP PCSK APO LP TRK NTRK RET SIRP CEA EPCAM PEG COX ' +
  'WHO ISO IU MG ML DAY WEEK PHASE PART ARM COHORT STEP STAGE GROUP LEVEL DOSE FORM TEST BATCH LOT PH UK US EU AAV DNA ' +
  'RNA HFA DPI PMDI IR MR XR ER SR CR SC IV QD BID TID QW VG AS ICS LABA LAMA GM CMV EBV RSV HSV ATC ICD SNOMED MEDDRA ' +
  'ECOG NYHA GOLD CTCAE RECIST WT MT DS PS PO IM IT ID'
).split(' '));

const INN_SUFFIX_RE = /^[a-z]+(mab|cept|nib|ciclib|parib|lisib|tide|leucel|gene|vec|stat|vir|mig|tug|platin|taxel|rubicin|tecan|limus|degib|siran|rsen|lukast|sartan|gliflozin|gliptin|glutide|parin|stim|fusp|dronate|xaban|gatran|vastatin|setron|triptan|pitant|azole|mycin|cillin|floxacin|zomib|relin|kinra|alfa|ucel|temcel|dencel|abine|domide|mustine|trexed|poetin|ermin|plase)$/;
const INN_STOPWORDS = new Set(['peptide', 'peptides', 'polypeptide', 'nucleotide', 'oligonucleotide', 'dinucleotide', 'transgene', 'oncogene', 'autoleucel', 'thermostat']);
const CODE_RE = /(?:^|[^A-Za-z0-9])([0-9][A-Z]{1,3}-?\d{2,5}|[A-Z]{2,6}-?\d{2,7}(?:[A-Z]{1,2}(?![a-z]))?|[A-Z]-?\d{4,7}(?:[A-Z]{1,2}(?![a-z]))?)(?![0-9])/;
const PREFIX_RE = /(?:^|[^A-Za-z0-9])([A-Z]{2,6})-?\d/;

/** Ordered, normalized drug identifiers in a name (port of radar_asset_identifiers). */
export function assetIdentifiers(name: string | null | undefined): string[] {
  // "BI 10773", "ARQ 197" -> one token.
  const s = (name ?? '').replace(/(^|[^A-Za-z0-9])([A-Z]{1,6}) (\d{2,7})(?![A-Za-z0-9])/g, '$1$2$3');
  const out: string[] = [];
  for (const raw of s.split(/[^A-Za-z0-9-]+/)) {
    let word = raw.replace(/^-+|-+$/g, '');
    if (!word) continue;
    // "mRNA-3927", "XmAb24306" -> upper case before matching.
    if (/^[A-Za-z]{2,6}-?\d/.test(word) && /^[A-Za-z]*[a-z][A-Z]/.test(word)) word = word.toUpperCase();
    const code = CODE_RE.exec(word)?.[1];
    const pre = PREFIX_RE.exec(word)?.[1] ?? '';
    if (code && !NOT_CODE_PREFIX.has(pre)) {
      out.push(code.replace(/-/g, '').toUpperCase());
      continue;
    }
    const lower = word.toLowerCase();
    if (word.length >= 7 && INN_SUFFIX_RE.test(lower) && !INN_STOPWORDS.has(lower)) out.push(word.toUpperCase());
  }
  return out;
}

/** Identifiers of a disclosed program: its name first, then its aliases, de-duplicated. */
export function programIdentifiers(p: { program_name: string; aliases?: string[] | null }): string[] {
  const seen = new Set<string>();
  for (const s of [p.program_name, ...(p.aliases ?? [])]) for (const t of assetIdentifiers(s)) seen.add(t);
  return [...seen];
}

/** True for a development code (has a digit); false for an INN. */
export function isCodeIdentifier(tok: string): boolean {
  return /\d/.test(tok);
}

/**
 * The asset_name a new disclosed row gets: the program name when it already
 * carries a code or INN, otherwise "<name> (<alias with a code>)" so the
 * program groups by identifier, otherwise the name as given.
 */
export function cleanProgramAssetName(p: { program_name: string; aliases?: string[] | null }): string {
  // Trademark marks are typography, not part of the name ("AdoXLong™ Sema", scraped as "AdoXLongTM Sema").
  const name = p.program_name.replace(/[®™©]/g, '').replace(/([a-z])TM\b/g, '$1').replace(/\s+/g, ' ').trim();
  if (assetIdentifiers(name).length > 0) return name.slice(0, 120);
  const alias = (p.aliases ?? []).map(a => a.replace(/\s+/g, ' ').trim()).find(a => assetIdentifiers(a).length > 0);
  return (alias ? `${name} (${alias})` : name).slice(0, 120);
}

/** Spellings to search for a normalized code in free text: "HLX37" -> ["HLX37", "HLX-37", "HLX 37"]. */
export function identifierSpellings(tok: string): string[] {
  const m = /^([0-9]?[A-Z]+)(\d+)([A-Z]*)$/.exec(tok);
  if (!m) return [tok];
  return [...new Set([tok, `${m[1]}-${m[2]}${m[3]}`, `${m[1]} ${m[2]}${m[3]}`])];
}
