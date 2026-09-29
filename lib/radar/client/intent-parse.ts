/**
 * Plain-language mandate parser (client-side, no model, no network).
 *
 * "Phase 2 ADCs in solid tumours from Korea or Japan with ex-Asia rights,
 * unpartnered" → { ta: [oncology], modality: [adc], phase_min: phase_2,
 * phase_max: phase_2, country: [KR, JP], rights: [us, eu, row],
 * partnership: [unpartnered] }, plus the spans that produced each value so
 * the composer can show what it understood.
 *
 * Matching is dictionary-based over the Radar vocabulary with common
 * synonyms and abbreviations. Anything not understood stays as free text
 * the user can keep as a keyword search.
 */

import { RADAR_PHASE_OPTIONS, RADAR_PHASE_RANK } from '@/lib/radar/vocab';
import { EMPTY_FILTERS, type RadarFilterState } from './filter-schema';

export type ParsedDimension = 'ta' | 'modality' | 'phase' | 'region' | 'country' | 'rights' | 'partnership' | 'owner_type';

export interface ParsedToken {
  dimension: ParsedDimension;
  value: string;
  /** Text that matched, as typed. */
  match: string;
}

export interface ParseResult {
  filters: RadarFilterState;
  tokens: ParsedToken[];
  /** Words that matched nothing (stopwords removed). */
  leftover: string;
}

type Rule = { re: RegExp; dimension: ParsedDimension; values: string[] };

const R = (pattern: string, dimension: ParsedDimension, ...values: string[]): Rule => ({
  re: new RegExp(`(?<![a-z0-9])(?:${pattern})(?![a-z0-9])`, 'gi'),
  dimension,
  values,
});

/** Order matters: longer, more specific patterns first so they claim their span. */
const RULES: Rule[] = [
  // ── Rights (before geography so "ex-China" is not read as China) ──
  R('ex[- ]?(?:us|u\\.s\\.?|united states)|outside (?:the )?us', 'rights', 'eu', 'japan', 'china', 'row'),
  R('ex[- ]?(?:china|greater china)|outside (?:greater )?china', 'rights', 'us', 'eu', 'japan', 'row'),
  R('ex[- ]?japan|outside japan', 'rights', 'us', 'eu', 'china', 'row'),
  R('ex[- ]?(?:asia|apac)|outside asia', 'rights', 'us', 'eu', 'row'),
  R('ex[- ]?(?:eu|europe)|outside europe', 'rights', 'us', 'japan', 'china', 'row'),
  R('(?:global|worldwide|world[- ]?wide|all territories)(?: rights)?', 'rights', 'global'),
  R('(?:us|u\\.s\\.?|united states|north american?) rights', 'rights', 'us'),
  R('(?:eu|europe(?:an)?) rights', 'rights', 'eu'),
  R('(?:japan(?:ese)?) rights', 'rights', 'japan'),
  R('(?:china|chinese|greater china) rights', 'rights', 'china'),
  R('(?:asia|apac|asian) rights', 'rights', 'japan', 'china'),

  // ── Partnership / owner ──
  R('un-?partnered|no partner|not partnered|unlicen[cs]ed|available for licen[cs]ing|out-?licen[cs]ing', 'partnership', 'unpartnered'),
  R('partially partnered|partly partnered|regional deals?', 'partnership', 'partially_partnered'),
  R('academic|universit(?:y|ies)|institutional|tech(?:nology)? transfer', 'owner_type', 'academic', 'hospital'),
  R('biotechs?|compan(?:y|ies)|industry|corporate', 'owner_type', 'industry'),

  // ── Modality ──
  R('antibody[- ]drug conjugates?|adcs?', 'modality', 'adc'),
  R('bi-?specifics?|bsabs?|tri-?specifics?|t[- ]cell engagers?|tces?|bites?', 'modality', 'bispecific'),
  R('car[- ]?t(?: cells?)?|car[- ]?nk', 'modality', 'car_t'),
  R('cell therap(?:y|ies)|tils?|tcr[- ]?t|nk cells?|stem cells?', 'modality', 'cell_therapy'),
  R('gene therap(?:y|ies)|aav|gene editing|crispr|base editing|lentivir(?:al|us)', 'modality', 'gene_therapy'),
  R('mrna', 'modality', 'mrna'),
  R('sirna|rnai|antisense|asos?|oligonucleotides?|oligos?', 'modality', 'oligonucleotide'),
  R('radioligands?|radiopharm(?:aceuticals?|a)?|rlts?|radio-?conjugates?', 'modality', 'radiopharm'),
  R('vaccines?', 'modality', 'vaccine'),
  R('peptides?|macrocycles?|glp-?1s?', 'modality', 'peptide'),
  R('monoclonal antibod(?:y|ies)|mabs?|antibod(?:y|ies)|biologics?', 'modality', 'antibody'),
  R('small[- ]molecules?|oral|degraders?|protacs?|inhibitors?|smol', 'modality', 'small_molecule'),

  // ── Therapeutic area ──
  R('oncology|cancers?|tumou?rs?|solid tumou?rs?|carcinomas?|lymphomas?|leukaemias?|leukemias?|myelomas?|nsclc|sclc|breast|prostate|pancreatic|melanoma|glioblastoma|gbm|hcc', 'ta', 'oncology'),
  R('neurolog(?:y|ical)|neuro|cns|neuroscience|alzheimer\'?s?|parkinson\'?s?|als|epilepsy|psychiatr(?:y|ic)|depression|schizophrenia|pain|migraine', 'ta', 'neurology'),
  R('immunolog(?:y|ical)|i&i|inflammation|inflammatory|autoimmun(?:e|ity)|lupus|ra|rheumatoid|psoriasis|ibd|crohn\'?s|ulcerative colitis|atopic dermatitis', 'ta', 'immunology'),
  R('metabolic|obesity|diabetes|nash|mash|cardiometabolic|lipids?', 'ta', 'metabolic'),
  R('cardiovascular|cardio|cardiac|heart failure|hypertension|cv', 'ta', 'cardiovascular'),
  R('rare diseases?|orphan|rare', 'ta', 'rare_disease'),
  R('infectious diseases?|infections?|anti-?infectives?|antivirals?|antibiotics?|antibacterials?|antifungals?|id', 'ta', 'infectious_disease'),
  R('ophthalmology|ophtho|eye|retinal?|amd|glaucoma', 'ta', 'ophthalmology'),
  R('respiratory|pulmonary|lung disease|copd|asthma|ipf|fibrosis', 'ta', 'respiratory'),
  R('dermatology|derm|skin', 'ta', 'dermatology'),
  R('hematology|haematology|blood disorders?|hemophilia|haemophilia|sickle cell', 'ta', 'hematology'),
  R('gastroenterology|gastro|gi|hepatology|liver', 'ta', 'gastroenterology'),
  R('women\'?s health|fertility|endometriosis|obstetrics', 'ta', 'womens_health'),

  // ── Geography (countries before regions) ──
  R('united states|usa?|u\\.s\\.a?\\.?|american', 'country', 'US'),
  R('switzerland|swiss', 'country', 'CH'),
  R('united kingdom|uk|british|britain', 'country', 'GB'),
  R('japan(?:ese)?', 'country', 'JP'),
  R('china|chinese|prc', 'country', 'CN'),
  R('south korea|korea|korean', 'country', 'KR'),
  R('germany|german', 'country', 'DE'),
  R('france|french', 'country', 'FR'),
  R('denmark|danish', 'country', 'DK'),
  R('belgium|belgian', 'country', 'BE'),
  R('italy|italian', 'country', 'IT'),
  R('ireland|irish', 'country', 'IE'),
  R('canada|canadian', 'country', 'CA'),
  R('netherlands|dutch', 'country', 'NL'),
  R('israel(?:i)?', 'country', 'IL'),
  R('india(?:n)?', 'country', 'IN'),
  R('spain|spanish', 'country', 'ES'),
  R('australia(?:n)?', 'country', 'AU'),
  R('sweden|swedish', 'country', 'SE'),
  R('hong kong', 'country', 'HK'),
  R('taiwan(?:ese)?', 'country', 'TW'),
  R('singapore(?:an)?', 'country', 'SG'),
  R('brazil(?:ian)?', 'country', 'BR'),
  R('finland|finnish', 'country', 'FI'),
  R('norway|norwegian', 'country', 'NO'),
  R('austria(?:n)?', 'country', 'AT'),
  R('north america', 'region', 'north_america'),
  R('europe(?:an)?|eu|emea', 'region', 'europe'),
  R('asia[- ]?pacific|apac|asia(?:n)?', 'region', 'asia_pacific', 'china', 'japan', 'south_korea'),
  R('middle east|mena|gulf', 'region', 'middle_east'),
  R('latin america|latam|south america', 'region', 'latin_america'),
  R('africa(?:n)?', 'region', 'africa'),
];

const PHASE_WORDS: Array<{ re: RegExp; phases: string[] }> = [
  { re: /(?<![a-z0-9])(?:discovery|pre-?clinical|ind[- ]enabling|research[- ]stage|early[- ]stage research)(?![a-z0-9])/gi, phases: ['preclinical'] },
  { re: /(?<![a-z0-9])(?:early[- ]stage|early clinical)(?![a-z0-9])/gi, phases: ['preclinical', 'early_phase_1', 'phase_1', 'phase_1_2'] },
  { re: /(?<![a-z0-9])(?:mid[- ]stage)(?![a-z0-9])/gi, phases: ['phase_1_2', 'phase_2'] },
  { re: /(?<![a-z0-9])(?:late[- ]stage|pivotal|registrational)(?![a-z0-9])/gi, phases: ['phase_2_3', 'phase_3'] },
  { re: /(?<![a-z0-9])(?:clinical[- ]stage|in the clinic)(?![a-z0-9])/gi, phases: ['early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3'] },
  { re: /(?<![a-z0-9])(?:proof[- ]of[- ]concept|poc)(?![a-z0-9])/gi, phases: ['phase_1_2', 'phase_2'] },
];

const PHASE_NUM = '(?:1|2|3|i{1,3}|one|two|three)';
/** "phase 2", "ph2", "p2", "phase 1/2", "phase 2-3", "phase 2 to 3", "phase 2+" */
const PHASE_RE = new RegExp(
  `(?<![a-z0-9])(?:phase|ph\\.?|p)\\s?(${PHASE_NUM})(?:\\s?(?:\\/|-|–|to|through|or)\\s?(?:phase\\s?|ph\\.?\\s?|p)?(${PHASE_NUM}))?(\\s?\\+|\\s?(?:and|or) (?:later|above|beyond))?(?![a-z0-9])`,
  'gi',
);

function phaseNum(raw: string): number {
  const s = raw.toLowerCase();
  if (s === '1' || s === 'i' || s === 'one') return 1;
  if (s === '2' || s === 'ii' || s === 'two') return 2;
  return 3;
}

const NUM_TO_PHASE: Record<number, string> = { 1: 'phase_1', 2: 'phase_2', 3: 'phase_3' };

const STOPWORDS = new Set(['a', 'an', 'the', 'in', 'for', 'from', 'with', 'and', 'or', 'of', 'to', 'at', 'on', 'by', 'looking', 'look', 'want', 'need', 'find', 'me', 'i', 'we', 'our', 'assets', 'asset', 'programs', 'program', 'programmes', 'candidates', 'candidate', 'drugs', 'drug', 'that', 'are', 'is', 'based', 'stage', 'available', 'rights', 'any', 'all', 'show', 'only', 'some', 'focus', 'focused', 'interested', 'which', 'have', 'has', 'targeting', 'companies', 'company', 'originator', 'originators', 'licensing', 'in-licensing', 'opportunities', 'opportunity', 'buy', 'buying', 'acquire', 'deals', 'deal', 'e.g.', 'like', 'such', 'as', 'etc', 'plus', '&', 'vs', 'into', 'across', 'within', 'globally']);

function blank(text: string, start: number, end: number): string {
  return text.slice(0, start) + ' '.repeat(end - start) + text.slice(end);
}

function addUnique(list: string[], values: string[]) {
  for (const v of values) if (!list.includes(v)) list.push(v);
}

/** Parse free text into filters. Pure; runs on every keystroke. */
export function parseMandateText(input: string): ParseResult {
  const filters: RadarFilterState = { ...EMPTY_FILTERS, ta: [], modality: [], phase: [], region: [], country: [], rights: [], partnership: [], owner_type: [] };
  const tokens: ParsedToken[] = [];
  let work = ` ${input.replace(/\s+/g, ' ')} `;

  // Phases: numeric forms first.
  const phaseSet = new Set<string>();
  let openEndedFrom: number | null = null;
  for (const m of [...work.matchAll(PHASE_RE)]) {
    const a = phaseNum(m[1]);
    const b = m[2] ? phaseNum(m[2]) : null;
    const plus = !!m[3];
    const joined = m[0].includes('/') && b !== null && b === a + 1;
    if (joined) phaseSet.add(a === 1 ? 'phase_1_2' : 'phase_2_3');
    if (b !== null) {
      for (let n = Math.min(a, b); n <= Math.max(a, b); n++) phaseSet.add(NUM_TO_PHASE[n]);
      if (a === 1 || b === 1) phaseSet.add('phase_1_2');
      if ((a === 2 && b === 3) || (a === 3 && b === 2)) phaseSet.add('phase_2_3');
    } else {
      phaseSet.add(NUM_TO_PHASE[a]);
      if (plus) openEndedFrom = a;
    }
    tokens.push({ dimension: 'phase', value: [...phaseSet].join(','), match: m[0].trim() });
    work = blank(work, m.index ?? 0, (m.index ?? 0) + m[0].length);
  }
  for (const w of PHASE_WORDS) {
    for (const m of [...work.matchAll(w.re)]) {
      w.phases.forEach(p => phaseSet.add(p));
      tokens.push({ dimension: 'phase', value: w.phases.join(','), match: m[0].trim() });
      work = blank(work, m.index ?? 0, (m.index ?? 0) + m[0].length);
    }
  }
  if (openEndedFrom !== null) {
    for (const o of RADAR_PHASE_OPTIONS) {
      const r = RADAR_PHASE_RANK[o.value] ?? 0;
      if (r >= (RADAR_PHASE_RANK[NUM_TO_PHASE[openEndedFrom]] ?? 0) && o.value !== 'phase_4') phaseSet.add(o.value);
    }
  }
  if (phaseSet.size) {
    const ranked = RADAR_PHASE_OPTIONS.map(o => o.value).filter(v => phaseSet.has(v));
    filters.phase_min = ranked[0];
    filters.phase_max = ranked[ranked.length - 1];
  }

  // Dictionary rules.
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    for (const m of [...work.matchAll(rule.re)]) {
      const target = filters[rule.dimension] as string[];
      addUnique(target, rule.values);
      tokens.push({ dimension: rule.dimension, value: rule.values.join(','), match: m[0].trim() });
      work = blank(work, m.index ?? 0, (m.index ?? 0) + m[0].length);
    }
  }

  // A country implies nothing about region; if both came from one phrase ("Korean"), keep the country only.
  if (filters.country.length && filters.region.length) {
    const countryRegions: Record<string, string> = { CN: 'china', JP: 'japan', KR: 'south_korea', IL: 'israel', US: 'north_america', CA: 'north_america' };
    filters.region = filters.region.filter(r => !filters.country.some(c => countryRegions[c] === r));
  }

  const leftover = work
    .split(/[\s,.;:!?()]+/)
    .map(w => w.trim())
    .filter(w => w.length > 1 && !STOPWORDS.has(w.toLowerCase()))
    .join(' ');

  return { filters, tokens, leftover };
}

/** Dimensions still open after parsing, in the order the composer asks about them. */
export const QUESTION_ORDER: ParsedDimension[] = ['ta', 'modality', 'phase', 'region', 'rights', 'partnership'];

export function answeredDimensions(f: RadarFilterState): Set<ParsedDimension> {
  const out = new Set<ParsedDimension>();
  if (f.ta.length) out.add('ta');
  if (f.modality.length) out.add('modality');
  if (f.phase_min || f.phase_max || f.phase.length) out.add('phase');
  if (f.region.length || f.country.length) out.add('region');
  if (f.rights.length) out.add('rights');
  if (f.partnership.length) out.add('partnership');
  if (f.owner_type.length) out.add('owner_type');
  return out;
}

/** Suggested mandate name from the parsed filters, e.g. "Oncology ADCs · P2–P3 · Korea, Japan". */
export function suggestMandateName(f: RadarFilterState, label: (v: string) => string): string {
  const parts: string[] = [];
  if (f.ta.length) parts.push(f.ta.slice(0, 2).map(label).join(' & '));
  if (f.modality.length) parts.push(f.modality.slice(0, 2).map(label).join('/'));
  if (f.phase_min || f.phase_max) {
    const lo = f.phase_min ? label(f.phase_min) : null;
    const hi = f.phase_max ? label(f.phase_max) : null;
    parts.push(lo && hi && lo !== hi ? `${lo}–${hi}` : (lo ?? hi ?? ''));
  }
  if (f.country.length) parts.push(f.country.slice(0, 3).join(', '));
  else if (f.region.length) parts.push(f.region.slice(0, 2).map(label).join(', '));
  if (f.rights.length && !f.rights.includes('global')) parts.push('regional rights');
  return parts.filter(Boolean).join(' · ').slice(0, 110) || 'New mandate';
}
