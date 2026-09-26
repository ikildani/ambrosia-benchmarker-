/**
 * Junk rows in `companies`: trial-registry funding sentences that were stored
 * as sponsors ("Peginterferon supplied free of charge from Roche
 * Pharmaceuticals.", "Record provided by the NHSTCT Register …") and people
 * (investigators) that were tagged owner_type = 'industry'.
 *
 * Pure classifiers; scripts/retire-junk-companies.ts applies them.
 */

export type JunkKind = 'funding_sentence' | 'person';

const SENTENCE_PATTERNS: readonly RegExp[] = [
  /\b(provided|provides|providing|supplied|supplies|supplying|will supply|will provide)\b/i,
  /\b(funded|funding|donated|donates|donation of|offered by|courtesy of|kindly|supported by|sponsored by|manufactured by|distributed by|in kind)\b/i,
  /\b(unrestricted|educational|research|study|block|unconditional) grant\b/i,
  /\bgrant (codes?|from|agency|number|no\.?)\b/i,
  /\bfree of charge\b/i,
  /\brecord (provided|supplied)\b/i,
  /\bsponsor not (yet )?(defined|specified|known)\b/i,
  /\bno (extra |additional )?(funding|grant)\b/i,
  /\bnot (yet )?(defined|specified|applicable|available)\b/i,
  /\bunpaid\b/i,
  /\b(has|have|is|are|was|were) (now )?(merged|acquired|a wholly|part of|owned by)\b/i,
  /\b(is|are) now\b/i,
  /\b(study drug|placebo|test compounds?|investigator[- ]initiated|investigator funded)\b/i,
  /\bthe (researcher|investigator)s?\b/i,
  /\bsources of funding\b/i,
];

/** Words that make a title/degree name an organisation ("Dr. Falk Pharma GmbH"), not a person. */
const ORG_TOKEN =
  /\b(gmbh|pharma\w*|chem\w*|fabrik|clinic|clinique|center|centre|corp\w*|inc|ltd|llc|hospital|klinik|laborat\w*|medical|group|co|kg|ag|university|universit\w*|institut\w*|foundation|fund|research|oncology|memorial|professional|associates|partners|practice|clinical|health\w*|care|dental|surgery|biotech\w*|therapeutics|sciences?|company|trust|society|college|school|department|ministry|agency|network|program\w*|centro|hopital|ospedale|policlinico|krankenhaus|stiftung|verein|sa|srl|spa|plc|bv|nv|ab|as|oy)\b/i;

const PERSON_TITLE = /^(dr\.?|drs\.?|prof\.?|professor|mr\.?|mrs\.?|ms\.?|dr\s?med\.?)\s+\S/i;
const PERSON_DEGREE = /[,;]?\s(md|phd|m\.d\.|ph\.d\.|mbbs|frcp|frcs|do|dds|dmd|pharmd|rn|msc|bsc|mph|facc|facs)\.?(\s*,?\s*(md|phd|m\.d\.|ph\.d\.|mbbs|frcp|facc|facs)\.?)*\s*$/i;

/** True when the name reads as a funding / supply sentence rather than an organisation. */
export function isFundingSentence(name: string): boolean {
  const n = (name ?? '').trim();
  if (!n) return false;
  return SENTENCE_PATTERNS.some(re => re.test(n));
}

/** True when the name is a person (title or degree) and carries no organisation word. */
export function isPersonName(name: string): boolean {
  const n = (name ?? '').trim();
  if (!n) return false;
  if (!(PERSON_TITLE.test(n) || PERSON_DEGREE.test(n))) return false;
  // A parenthetical (a registry's country tag), a possessive ("Dr. Reddy's") or a compound like "BioPharma" is an organisation.
  if (/[()]|'s\b|\w+(pharma|bio|chem|med|tech)\w*/i.test(n)) return false;
  return !ORG_TOKEN.test(n);
}

export function classifyJunk(name: string): JunkKind | null {
  if (isFundingSentence(name)) return 'funding_sentence';
  if (isPersonName(name)) return 'person';
  return null;
}
