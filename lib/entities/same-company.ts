/**
 * Same-company rows under different names.
 *
 * The merge job (lib/entities/merge.ts) folds rows whose *normalised names*
 * are equal. It cannot see "Regeneron" next to "Regeneron Pharmaceuticals,
 * Inc.", "Hansoh Pharma" next to "Jiangsu Hansoh Pharmaceutical Co., Ltd." or
 * "Everest Medicines" next to "Everest Medicines (Singapore) Pte. Ltd.".
 *
 * This planner reduces each name to a *stem* by removing, from the end and in
 * any order, legal forms (normalizeCompanyName), industry descriptors
 * (Pharmaceuticals, Therapeutics, Biosciences …), neutral words (Group,
 * Holdings, International) and national-affiliate words (Canada, UK, Japan …),
 * and from the front the Chinese region prefixes (Jiangsu, Shanghai …).
 * Rows sharing a stem are the same company when:
 *
 *   - the stem is distinctive (six or more characters and not a common word)
 *     and their descriptors do not disagree in class — "Pharma" agrees with
 *     "Pharmaceuticals"; "Therapeutics" does not agree with "Biosciences"
 *     (Arbor Pharmaceuticals is not Arbor Biotechnologies);
 *   - or the stem is a common word and their descriptor tokens are identical
 *     ("Everest Medicines" ×4 merge; "Alpha Pharma" and "Alpha Biopharma" do not);
 *
 * and never when a name carries a division marker ("Pfizer Oncology"), a
 * known-subsidiary marker, a parenthetical tag that is not a country, a code
 * or a parent name ("Recordati (Enjaymo)", "Acadia (Proprietary)"), or when
 * the group has more than one ticker, CIK, website domain or (among
 * non-affiliate rows) HQ country.
 *
 * Institutions (hospitals, universities, ministries, trial groups — by
 * owner_type or by name) keep every word: for them only the registry's
 * parenthetical country tag is ignorable, so "University of Oxford (UK)" folds
 * into "University of Oxford" while "Beijing Children's Hospital" never meets
 * "Shanghai Children's Hospital". Descriptor tokens are compared after
 * spelling normalisation: "Pharma" = "Pharmaceuticals", but "Biosciences" ≠
 * "Biotechnologies" (different brands), and a bare stem may absorb a
 * descriptor only when that descriptor is a life-science word (Pharma,
 * Therapeutics, Bio…, Medicines), never "Sciences" or "Health".
 *
 * Pure; the script scripts/merge-same-company-rows.ts loads rows, counts
 * references and applies the plans through lib/entities/merge-apply.ts with
 * reason 'same_company_alias'.
 */

import { compactKey, normalizeCompanyName, sameCompanyKey } from './normalize';
import {
  DIVISION_MARKERS,
  KNOWN_SUBSIDIARIES,
  rankCanonical,
  splitNameMarkers,
  stripParentAliases,
  unionAliases,
  type MergeCompanyRow,
  type MergePlan,
  type MergedRowPlan,
} from './merge';
import { companyPopulationScore } from './resolve';

export const SAME_COMPANY_REASON = 'same_company_alias';

/** Industry descriptors → class. Same class = same kind of word, not a different company. */
const DESCRIPTOR_CLASS: Readonly<Record<string, string>> = {
  pharmaceuticals: 'pharma', pharmaceutical: 'pharma', pharma: 'pharma', biopharma: 'pharma', biopharmaceuticals: 'pharma',
  biopharmaceutical: 'pharma', farma: 'pharma', farmaceutici: 'pharma', farmaceutica: 'pharma', pharmaceutique: 'pharma', arzneimittel: 'pharma',
  therapeutics: 'thera', therapeutic: 'thera',
  biosciences: 'bio', bioscience: 'bio', biotech: 'bio', biotechnology: 'bio', biotechnologies: 'bio', bio: 'bio', biologics: 'bio',
  biologicals: 'bio', biomed: 'bio', biomedical: 'bio', biopharm: 'bio',
  medicines: 'med', medicine: 'med', medical: 'med',
  laboratories: 'lab', laboratory: 'lab', labs: 'lab', lab: 'lab',
  sciences: 'sci', science: 'sci',
  healthcare: 'health', health: 'health',
  genomics: 'gen', genetics: 'gen',
  industries: 'ind', industry: 'ind',
};

/** Spelling variants folded to one token so "Pharma" = "Pharmaceuticals" but "Biosciences" ≠ "Biotechnologies". */
const DESCRIPTOR_TOKEN: Readonly<Record<string, string>> = {
  pharmaceuticals: 'pharma', pharmaceutical: 'pharma', pharma: 'pharma', farma: 'pharma', farmaceutici: 'pharma', farmaceutica: 'pharma', pharmaceutique: 'pharma', arzneimittel: 'pharma',
  biopharma: 'biopharma', biopharmaceuticals: 'biopharma', biopharmaceutical: 'biopharma', biopharm: 'biopharma',
  therapeutics: 'therapeutics', therapeutic: 'therapeutics',
  biosciences: 'biosciences', bioscience: 'biosciences',
  biotech: 'biotech', biotechnology: 'biotechnology', biotechnologies: 'biotechnology',
  bio: 'bio', biologics: 'biologics', biologicals: 'biologics', biomed: 'biomed', biomedical: 'biomedical',
  medicines: 'medicines', medicine: 'medicines', medical: 'medical',
  laboratories: 'laboratories', laboratory: 'laboratories', labs: 'laboratories', lab: 'laboratories',
  sciences: 'sciences', science: 'sciences', healthcare: 'healthcare', health: 'health', genomics: 'genomics', genetics: 'genetics',
  industries: 'industries', industry: 'industries',
};
/** Descriptor classes a bare stem may absorb ("Regeneron" + "Regeneron Pharmaceuticals"); "Sciences" or "Health" are not among them. */
const ABSORBABLE_CLASSES = new Set(['pharma', 'thera', 'bio', 'med']);

/** Stems made only of these words name nothing ("Cell Therapy", "Medical", "Global Health"). */
const GENERIC_TOKENS = new Set([
  ...Object.keys(DESCRIPTOR_CLASS), 'cell', 'gene', 'therapy', 'therapies', 'care', 'clinical', 'research', 'national', 'general', 'international',
  'global', 'life', 'technology', 'technologies', 'tech', 'innovation', 'innovations', 'innovative', 'advanced', 'applied', 'new', 'united', 'first',
  'american', 'european', 'asian', 'pacific', 'precision', 'immune', 'immuno', 'onco', 'oncology', 'vaccine', 'vaccines', 'diagnostics', 'device',
  'devices', 'systems', 'solutions', 'partners', 'capital', 'ventures', 'holdings', 'group', 'products', 'brands', 'specialty', 'generics',
  'biosimilars', 'animal', 'consumer', 'human', 'molecular', 'cellular', 'genetic', 'genomic', 'digital', 'data', 'ai', 'central', 'regional',
  'provincial', 'municipal', 'public', 'private', 'hospital', 'hospitals', 'university', 'medical', 'center', 'centre', 'institute', 'people', 's',
  'children', 'cancer', 'tumor', 'tumour', 'chest', 'eye', 'ministry', 'academy', 'commission', 'council', 'association', 'society', 'trust',
]);

/** Institutions keep every word of their name. */
const INSTITUTION_OWNER = new Set(['academic', 'hospital', 'government', 'network']);
const INSTITUTION_RE =
  /\b(hospital|hospitals|hospice|infirmary|clinic|university|universit[àáäéè]t?\w*|universidad\w*|universit[ée]|college|school|faculty|institute|institut\w*|instituto|ministry|council|commission|foundation|fundaci[oó]n|fondazione|stiftung|society|association|academy|agency|department|government|nhs|trust|register|registry|consortium|cooperative|study group|research group|oncology group|trials? group|cancer trials|centers? for|centre for|center of|centre of|medical cent(er|re)|health (system|service|services|network|authority|board)|krankenhaus|klinik\w*|ospedale|policlinico|h[ôo]pital|hospices|sjukhus|ziekenhuis)\b/i;

const LEGAL_IN_BRACKETS = new Set(['publ', 'pty', 'ltd', 'limited', 'inc', 'plc', 'llc', 'pvt', 'private', 'co', 'corp', 'gmbh', 'ag', 'sa', 'srl', 'spa', 'bv', 'nv', 'ab', 'as', 'kk', 'pte', 'sdn', 'bhd', 'ltda', 'sas']);

/** Rows that are placeholders, not organisations. */
const PLACEHOLDER_RE = /^(undisclosed|confidential|individual sponsor|not applicable|unknown|n\/a|various|multiple|none|tbd|other|no sponsor|sponsor not)\b/i;

/** Words that add nothing to identity. */
const NEUTRAL = new Set(['group', 'holdings', 'holding', 'international', 'global', 'worldwide', 'life', 'products', 'corporate']);

/** National-affiliate words: "Pfizer Canada", "Kyowa Kirin China", "Eli Lilly UK". */
const AFFILIATE = new Set([
  'usa', 'us', 'uk', 'america', 'americas', 'north america', 'europe', 'european', 'eu', 'asia', 'asia pacific', 'apac', 'emea', 'latam',
  'japan', 'china', 'korea', 'south korea', 'canada', 'australia', 'india', 'germany', 'deutschland', 'france', 'italy', 'italia', 'spain',
  'espana', 'netherlands', 'nederland', 'belgium', 'switzerland', 'schweiz', 'suisse', 'austria', 'sweden', 'denmark', 'norway', 'finland',
  'ireland', 'israel', 'singapore', 'taiwan', 'hong kong', 'hk', 'new zealand', 'brazil', 'brasil', 'mexico', 'poland', 'portugal', 'greece',
  'turkey', 'russia', 'thailand', 'argentina', 'chile', 'south africa', 'czech', 'hungary', 'pacific', 'overseas', 'united states', 'united kingdom',
]);

const COUNTRY_ALIAS: Readonly<Record<string, string>> = {
  us: 'us', usa: 'us', 'united states': 'us', 'united states of america': 'us', uk: 'gb', gb: 'gb', 'united kingdom': 'gb', england: 'gb',
  de: 'de', germany: 'de', deutschland: 'de', fr: 'fr', france: 'fr', ch: 'ch', switzerland: 'ch', jp: 'jp', japan: 'jp', cn: 'cn', china: 'cn',
  kr: 'kr', korea: 'kr', 'south korea': 'kr', ca: 'ca', canada: 'ca', au: 'au', australia: 'au', in: 'in', india: 'in', it: 'it', italy: 'it',
  es: 'es', spain: 'es', nl: 'nl', netherlands: 'nl', 'the netherlands': 'nl', be: 'be', belgium: 'be', se: 'se', sweden: 'se', dk: 'dk', denmark: 'dk',
  ie: 'ie', ireland: 'ie', il: 'il', israel: 'il', sg: 'sg', singapore: 'sg', tw: 'tw', taiwan: 'tw', hk: 'hk', 'hong kong': 'hk',
};

/** Leading region prefixes on Chinese entity names ("Jiangsu Hansoh", "Shanghai Junshi"). */
const LEADING_REGION = new Set([
  'jiangsu', 'shanghai', 'beijing', 'suzhou', 'hangzhou', 'guangzhou', 'shenzhen', 'zhejiang', 'sichuan', 'chongqing', 'tianjin', 'nanjing',
  'wuhan', 'chengdu', 'shandong', 'guangdong', 'hubei', 'hunan', 'anhui', 'fujian', 'jilin', 'hebei', 'hong kong', 'taizhou', 'wuxi', 'hefei',
  'xiamen', 'qingdao', 'changzhou', 'zhuhai', 'dalian', 'shenyang', 'yantai', 'kunming', 'guizhou', 'yunnan', 'liaoning', 'shaanxi', 'shanxi',
]);

/** Stems that are ordinary words; two such rows must carry identical descriptors to be the same company. */
const COMMON_STEMS = new Set([
  'alpha', 'beta', 'gamma', 'delta', 'omega', 'sigma', 'apex', 'hope', 'applied', 'forward', 'arctic', 'engage', 'arbor', 'atrium', 'aspen',
  'apollo', 'boston', 'cook', 'everest', 'antares', 'immune', 'united', 'general', 'national', 'american', 'european', 'first', 'new', 'north',
  'south', 'east', 'west', 'sun', 'star', 'summit', 'pioneer', 'horizon', 'frontier', 'vector', 'matrix', 'origin', 'genesis', 'phoenix',
  'atlas', 'titan', 'nova', 'aurora', 'harbour', 'harbor', 'bridge', 'beacon', 'compass', 'crown', 'eagle', 'evolve', 'fusion', 'impact',
  'insight', 'liberty', 'legend', 'mercury', 'meridian', 'oak', 'orbit', 'pacific', 'prime', 'quantum', 'sage', 'spark', 'sterling', 'trinity',
  'unity', 'vista', 'zenith', 'clover', 'cypress', 'element', 'elevate', 'empower', 'endeavor', 'kinetic', 'lumen', 'nexus', 'noble', 'pinnacle',
  'radiant', 'summit', 'true', 'vital', 'zephyr', 'aeon', 'auron', 'ascend', 'diamond', 'edge', 'ember', 'focus', 'guardian', 'harmony', 'iris',
  'jade', 'lotus', 'magnolia', 'monarch', 'olympus', 'onyx', 'oracle', 'paragon', 'pearl', 'polaris', 'ridge', 'river', 'rock', 'royal', 'sapphire',
  'sequoia', 'silver', 'sonic', 'spring', 'stone', 'tandem', 'terra', 'triton', 'valor', 'vantage', 'venture', 'vertex', 'vivo', 'zen',
  'orphan', 'formation', 'odyssey', 'miracle', 'remedy', 'progen', 'medicure', 'sanamed', 'coherent', 'multitude', 'domain', 'innovation',
  'providence', 'catalyst', 'genesis', 'vision', 'clarity', 'harmony', 'legacy', 'momentum', 'pursuit', 'resolve', 'signal', 'synergy', 'verve',
]);

/** Parenthetical tags that are the parent of a subsidiary row ("Janssen (J&J)", "Kite (Gilead)") are not distinguishing. */
const PARENT_TAGS = new Set([
  ...Object.values(KNOWN_SUBSIDIARIES),
  'j j', 'j and j', 'johnson and johnson', 'johnson johnson', 'msd', 'gsk', 'viatris', 'novartis', 'roche', 'pfizer', 'abbvie', 'astrazeneca',
  'gilead', 'takeda', 'amgen', 'sanofi', 'bayer', 'merck', 'eli lilly', 'lilly', 'bristol myers squibb', 'bms', 'biogen', 'exelixis', 'qyuns',
]);

const COUNTRY_DIVISION = new Set(['japan', 'china', 'usa', 'uk', 'europe']);
const CODE_TAG = /^(ref|protocol|study|trial|no|nr|code)\b|^[a-z]{0,4}\s?\d|\d{3,}/;

/** "(HPA)" next to "Health Protection Agency", "(AMC)" next to "Academic Medical Center": the name's own initials, not a tag. */
function isInitialismOf(tag: string, stemTokens: readonly string[]): boolean {
  const t = tag.replace(/[^a-z0-9]/g, '');
  if (t.length < 2 || t.length > 8 || !stemTokens.length) return false;
  const initials = stemTokens.map(w => w[0]).join('');
  const significant = stemTokens.filter(w => !['of', 'the', 'and', 'for', 'de', 'la', 'le', 'du', 'des', 'di', 'da', 'del', 'y', 'e', 'in', 'on', 'at'].includes(w)).map(w => w[0]).join('');
  if (t === initials || t === significant) return true;
  // Multi-part tags like "upv ehu" or "amc vumc": every part is an initialism candidate or ≤ 5 letters of caps in the source.
  const parts = tag.split(/[^a-z0-9]+/).filter(Boolean);
  if (parts.length > 1 && parts.every(p => p.length <= 5)) return true;
  return false;
}

export interface SameCompanyParts {
  /** Identity after every removal; '' when nothing distinctive is left. */
  stem: string;
  /** Descriptor tokens removed (spelling-normalised), in name order. */
  descriptors: string[];
  /** Descriptor classes, deduped. */
  classes: string[];
  /** A national-affiliate word was removed ("Canada", "(UK)"). */
  affiliate: boolean;
  /** Parenthetical tags that make the row a different thing (a drug, "Proprietary", a person). */
  tagged: string[];
  /** Why the row can never join a same-company plan, else null. */
  excluded: 'division' | 'subsidiary' | 'placeholder' | 'generic' | null;
  /** Institution: only the parenthetical country tag was ignorable. */
  institutional: boolean;
  /** Country named by a parenthetical tag ("(UK)", "(The Netherlands)"), normalised; null when none. */
  countryTag: string | null;
}

export interface PartsOptions {
  /** Treat the name as an institution (hospital, university …): keep every word. */
  institutional?: boolean;
}

/** True when the row is an institution by owner_type or by name. */
export function isInstitutional(name: string | null | undefined, ownerType?: string | null): boolean {
  if (ownerType && INSTITUTION_OWNER.has(ownerType)) return true;
  return INSTITUTION_RE.test(name ?? '');
}

function pairAt(tokens: string[], i: number): string {
  return i >= 1 ? `${tokens[i - 1]} ${tokens[i]}` : '';
}

/** Reduce a raw company name to its identity stem. Pure; exported for tests. */
export function sameCompanyParts(raw: string | null | undefined, opts: PartsOptions = {}): SameCompanyParts {
  const institutional = opts.institutional ?? isInstitutional(raw);
  const out: SameCompanyParts = { stem: '', descriptors: [], classes: [], affiliate: false, tagged: [], excluded: null, institutional, countryTag: null };
  if (PLACEHOLDER_RE.test((raw ?? '').trim())) { out.excluded = 'placeholder'; return out; }
  let s0: string;
  let markers: string[];
  if (institutional) {
    // Institutions: parentheticals are tags; every other word, including a trailing country, is identity.
    markers = [];
    const stripped = (raw ?? '').replace(/\(([^()]*)\)/g, (_m, inner: string) => { const k = normalizeCompanyName(inner); if (k) markers.push(k); return ' '; });
    s0 = normalizeCompanyName(stripped);
  } else {
    ({ stem: s0, markers } = splitNameMarkers(raw));
  }

  const stemTokensForTags = s0.split(' ').filter(Boolean);
  for (const m of markers) {
    if (COUNTRY_DIVISION.has(m) || AFFILIATE.has(m) || LEADING_REGION.has(m)) { out.affiliate = true; out.countryTag = out.countryTag ?? (COUNTRY_ALIAS[m] ?? m); continue; }
    // "(UK & Ireland)", "(South Africa)", "(Germany, Austria)": every word a country/region word → affiliate.
    const words = m.split(' ').filter(Boolean);
    if (words.length && words.every(w => AFFILIATE.has(w) || COUNTRY_DIVISION.has(w) || LEADING_REGION.has(w) || ['and', 'the', 'of', 'south', 'north', 'east', 'west', 'central', 'latin', 'middle'].includes(w))) { out.affiliate = true; out.countryTag = out.countryTag ?? m; continue; }
    if (isInitialismOf(m, stemTokensForTags)) continue;
    // "(Pty)", "(Ltd)", "(Inc.)": a legal form in brackets.
    if (words.length && words.every(w => LEGAL_IN_BRACKETS.has(w))) continue;
    if (DIVISION_MARKERS.includes(m)) { out.excluded = 'division'; continue; }
    if (m in KNOWN_SUBSIDIARIES) { out.excluded = 'subsidiary'; continue; }
    if (CODE_TAG.test(m) || PARENT_TAGS.has(m)) continue;
    out.tagged.push(m);
  }

  let tokens = s0.split(' ').filter(Boolean);
  if (institutional) {
    // Every word is identity; only the parenthetical tags above were considered.
    out.stem = tokens.join(' ');
    if (tokens.every(t => GENERIC_TOKENS.has(t))) out.excluded = out.excluded ?? 'generic';
    return out;
  }
  // Leading region prefix (possibly two: "Hong Kong").
  let moved = true;
  while (moved && tokens.length > 1) {
    moved = false;
    if (tokens.length > 2 && LEADING_REGION.has(`${tokens[0]} ${tokens[1]}`)) { tokens = tokens.slice(2); moved = true; }
    else if (LEADING_REGION.has(tokens[0])) { tokens = tokens.slice(1); moved = true; }
  }
  // Trailing descriptor / neutral / affiliate words, then legal forms they uncovered, until stable.
  let changed = true;
  while (changed) {
    changed = false;
    while (tokens.length > 1) {
      const last = tokens[tokens.length - 1];
      const pair = pairAt(tokens, tokens.length - 1);
      if (tokens.length > 2 && AFFILIATE.has(pair)) { tokens = tokens.slice(0, -2); out.affiliate = true; continue; }
      if (AFFILIATE.has(last)) { tokens = tokens.slice(0, -1); out.affiliate = true; continue; }
      if (NEUTRAL.has(last)) { tokens = tokens.slice(0, -1); continue; }
      if (last in DESCRIPTOR_CLASS) { out.descriptors.unshift(DESCRIPTOR_TOKEN[last] ?? last); tokens = tokens.slice(0, -1); continue; }
      break;
    }
    const renormalised = normalizeCompanyName(tokens.join(' ')).split(' ').filter(Boolean);
    if (renormalised.length && renormalised.length < tokens.length) { tokens = renormalised; changed = true; }
  }
  // Tag descriptors that were removed for the class signature; the stem is what is left.
  out.stem = tokens.join(' ');
  out.classes = [...new Set(out.descriptors.map(d => DESCRIPTOR_CLASS[classKeyOf(d)]))];
  // A stem that is itself only descriptors / generic words ("Pharma", "Cell Therapy") names nothing.
  if (!tokens.length || tokens.every(t => GENERIC_TOKENS.has(t) || NEUTRAL.has(t) || AFFILIATE.has(t))) { out.stem = ''; out.excluded = out.excluded ?? 'generic'; }
  return out;
}

/** The DESCRIPTOR_CLASS key for a normalised descriptor token. */
function classKeyOf(token: string): string {
  if (token in DESCRIPTOR_CLASS) return token;
  const k = Object.keys(DESCRIPTOR_TOKEN).find(x => DESCRIPTOR_TOKEN[x] === token);
  return k ?? token;
}

/** Signature of a row's descriptors: sorted normalised tokens. */
function descriptorSignature(p: SameCompanyParts): string {
  return p.descriptors.slice().sort().join('+');
}

/** Two descriptor sets agree: identical, or one empty and the other only life-science words. */
function descriptorsCompatible(a: SameCompanyParts, b: SameCompanyParts): boolean {
  const sa = descriptorSignature(a);
  const sb = descriptorSignature(b);
  if (sa === sb) return true;
  const bare = !sa ? a : !sb ? b : null;
  const other = bare === a ? b : bare === b ? a : null;
  if (!bare || !other) return false;
  return other.classes.every(c => ABSORBABLE_CLASSES.has(c));
}

/** Five or more characters and not an ordinary word. */
export function isDistinctiveStem(stem: string): boolean {
  if (stem.length < 5) return false;
  if (COMMON_STEMS.has(stem)) return false;
  return true;
}

export type SameCompanyReviewReason = 'ticker_conflict' | 'cik_conflict' | 'domain_conflict' | 'country_conflict' | 'descriptor_conflict' | 'affiliate' | 'tagged';

export interface SameCompanyReview {
  stem: string;
  reason: SameCompanyReviewReason;
  detail: string;
  rows: Array<{ id: string; name: string; descriptors: string[]; ticker: string | null; cik: string | null }>;
}

export interface SameCompanyOptions {
  referenceCounts?: ReadonlyMap<string, number>;
  /** Fold national affiliates ("Pfizer Canada Inc") into the parent. Default true. */
  includeAffiliates?: boolean;
  /** Explicit groups of ids to plan regardless of the rule (hand-checked pairs). */
  extraGroups?: readonly (readonly string[])[];
  /** Ids never to plan. */
  excludeIds?: ReadonlySet<string>;
}

export interface SameCompanyPlanResult {
  plans: MergePlan[];
  review: SameCompanyReview[];
  stats: { rows: number; groups: number; plannedGroups: number; rowsToMerge: number; affiliateRowsToMerge: number; reviewGroups: number };
}

function tickerOf(r: MergeCompanyRow): string | null {
  const t = (r.ticker ?? '').trim().toUpperCase();
  return t || null;
}
function cikOf(r: MergeCompanyRow): string | null {
  const digits = (r.cik ?? r.sec_cik ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return digits || null;
}
function domainOf(r: MergeCompanyRow): string | null {
  const u = (r.website_url ?? '').trim().toLowerCase();
  if (!u) return null;
  const d = u.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
  return d || null;
}
function distinct(values: Array<string | null>): string[] {
  return [...new Set(values.filter((v): v is string => !!v))];
}
function countryOf(r: MergeCompanyRow): string | null {
  const c = (r.hq_country ?? '').trim().toLowerCase();
  if (!c) return null;
  return COUNTRY_ALIAS[c] ?? c;
}

/** Plan same-company merges over canonical rows (rows carrying merged_into are ignored). Pure; exported for tests. */
export function planSameCompanyMerges(rows: readonly MergeCompanyRow[], opts: SameCompanyOptions = {}): SameCompanyPlanResult {
  const refs = opts.referenceCounts;
  const refOf = (id: string) => refs?.get(id) ?? 0;
  const includeAffiliates = opts.includeAffiliates ?? true;
  const live = rows.filter(r => !r.merged_into && !opts.excludeIds?.has(r.id));

  // Canonical row per exact normalised name — the index hazard-1 strips read.
  const canonicalByKey = new Map<string, MergeCompanyRow>();
  for (const r of live) {
    const k = compactKey(normalizeCompanyName(r.name));
    if (!k) continue;
    const cur = canonicalByKey.get(k);
    if (!cur || rankCanonical([cur, r], refs)[0].id === r.id) canonicalByKey.set(k, r);
  }

  const parts = new Map<string, SameCompanyParts>();
  const groups = new Map<string, MergeCompanyRow[]>();
  for (const r of live) {
    const p = sameCompanyParts(r.name, { institutional: isInstitutional(r.name, r.owner_type) });
    parts.set(r.id, p);
    if (!p.stem) continue;
    const k = compactKey(p.stem);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  const plans: MergePlan[] = [];
  const review: SameCompanyReview[] = [];
  const planned = new Set<string>();
  let affiliateRows = 0;

  const summary = (rs: readonly MergeCompanyRow[]) =>
    rs.map(r => ({ id: r.id, name: r.name, descriptors: parts.get(r.id)?.descriptors ?? [], ticker: tickerOf(r), cik: cikOf(r) }));

  const makePlan = (stem: string, members: MergeCompanyRow[], reasonNote: string): void => {
    // Best-populated row wins, but a clean parent name (no affiliate word, no tag, no brackets) beats a variant.
    const ranked = rankCanonical(members, refs);
    const clean = (r: MergeCompanyRow) => { const p = parts.get(r.id); return !!p && !p.affiliate && !p.tagged.length && !/[()\[\]]/.test(r.name); };
    const canonical = ranked.find(clean) ?? ranked.find(r => !parts.get(r.id)?.affiliate) ?? ranked[0];
    const others = ranked.filter(r => r.id !== canonical.id);
    const merged: MergedRowPlan[] = others.map(r => ({
      id: r.id,
      name: r.name,
      populationScore: companyPopulationScore(r),
      referenceCount: refOf(r.id),
      reasons: [`same company stem "${stem}" as canonical "${canonical.name}" (${reasonNote})`, `population ${companyPopulationScore(r)} ≤ ${companyPopulationScore(canonical)}`],
    }));
    const union = unionAliases(canonical, others);
    const ownKey = compactKey(normalizeCompanyName(canonical.name));
    // Aliases that are the exact name of a canonical row outside this group stay off (hazard 1).
    const groupKeys = new Set(members.map(m => compactKey(normalizeCompanyName(m.name))));
    const outside = new Map([...canonicalByKey].filter(([k]) => !groupKeys.has(k)));
    const { kept, strips } = stripParentAliases(canonical, ownKey, union, outside);
    plans.push({
      key: `same:${compactKey(stem)}`,
      canonicalId: canonical.id,
      canonicalName: canonical.name,
      canonicalScore: companyPopulationScore(canonical),
      canonicalReferenceCount: refOf(canonical.id),
      merged,
      aliasUnion: kept,
      aliasStrips: strips,
      reason: SAME_COMPANY_REASON,
      referenceCount: merged.reduce((s, m) => s + m.referenceCount, 0),
    });
    for (const m of members) planned.add(m.id);
    affiliateRows += others.filter(r => parts.get(r.id)?.affiliate).length;
  };

  for (const [, members0] of groups) {
    if (members0.length < 2) continue;
    const stem = parts.get(members0[0].id)!.stem;
    const eligible = members0.filter(r => { const p = parts.get(r.id)!; return !p.excluded && !p.tagged.length; });
    const tagged = members0.filter(r => parts.get(r.id)!.tagged.length);
    if (tagged.length && eligible.length) review.push({ stem, reason: 'tagged', detail: `tagged rows left out: ${tagged.map(r => JSON.stringify(r.name)).join(', ')}`, rows: summary(tagged) });
    if (eligible.length < 2) continue;

    const tickers = distinct(eligible.map(tickerOf));
    if (tickers.length > 1) { review.push({ stem, reason: 'ticker_conflict', detail: `tickers ${tickers.join(', ')}`, rows: summary(eligible) }); continue; }
    const ciks = distinct(eligible.map(cikOf));
    if (ciks.length > 1) { review.push({ stem, reason: 'cik_conflict', detail: `ciks ${ciks.join(', ')}`, rows: summary(eligible) }); continue; }
    const domains = distinct(eligible.map(domainOf));
    if (domains.length > 1) { review.push({ stem, reason: 'domain_conflict', detail: `domains ${domains.join(', ')}`, rows: summary(eligible) }); continue; }
    const countries = distinct(eligible.filter(r => !parts.get(r.id)!.affiliate).map(countryOf));
    if (countries.length > 1) { review.push({ stem, reason: 'country_conflict', detail: `hq countries ${countries.join(', ')}`, rows: summary(eligible) }); continue; }

    let members = eligible;
    if (!includeAffiliates) {
      const affiliates = members.filter(r => parts.get(r.id)!.affiliate);
      if (affiliates.length) review.push({ stem, reason: 'affiliate', detail: `affiliates not folded: ${affiliates.map(r => JSON.stringify(r.name)).join(', ')}`, rows: summary(affiliates) });
      members = members.filter(r => !parts.get(r.id)!.affiliate);
      if (members.length < 2) continue;
    }

    const institutional = members.every(r => parts.get(r.id)!.institutional);
    if (institutional) {
      // Only parenthetical country tags differed: exact same words — but two different countries are two institutions.
      const tags = distinct(members.map(r => parts.get(r.id)!.countryTag));
      if (tags.length > 1) { review.push({ stem, reason: 'country_conflict', detail: `country tags ${tags.join(', ')}`, rows: summary(members) }); continue; }
      makePlan(stem, members, 'institution, same words');
      continue;
    }
    if (isDistinctiveStem(stem)) {
      const first = parts.get(members[0].id)!;
      const compatible = members.every(r => descriptorsCompatible(first, parts.get(r.id)!)) && members.every(a => members.every(b => descriptorsCompatible(parts.get(a.id)!, parts.get(b.id)!)));
      if (!compatible) {
        const signatures = distinct(members.map(r => descriptorSignature(parts.get(r.id)!) || '(none)'));
        review.push({ stem, reason: 'descriptor_conflict', detail: `descriptors ${signatures.join(' vs ')}`, rows: summary(members) });
        continue;
      }
      const sig = distinct(members.map(r => descriptorSignature(parts.get(r.id)!) || null));
      makePlan(stem, members, sig[0] ? `descriptors ${sig[0]}` : 'no descriptor');
      continue;
    }
    // Common-word stem: identical descriptor tokens only.
    const clusters = new Map<string, MergeCompanyRow[]>();
    for (const r of members) {
      const sig = descriptorSignature(parts.get(r.id)!);
      if (!sig) continue;
      clusters.set(sig, [...(clusters.get(sig) ?? []), r]);
    }
    for (const [sig, cluster] of clusters) {
      if (cluster.length < 2) continue;
      makePlan(stem, cluster, `common-word stem, identical descriptors "${sig}"`);
    }
  }

  // Hand-checked groups.
  const byId = new Map(live.map(r => [r.id, r]));
  for (const ids of opts.extraGroups ?? []) {
    const members = ids.map(id => byId.get(id)).filter((r): r is MergeCompanyRow => !!r && !planned.has(r.id));
    if (members.length < 2) continue;
    makePlan(sameCompanyParts(members[0].name).stem || normalizeCompanyName(members[0].name), members, 'hand-checked group');
  }

  const rowsToMerge = plans.reduce((s, p) => s + p.merged.length, 0);
  return {
    plans,
    review,
    stats: { rows: live.length, groups: [...groups.values()].filter(g => g.length > 1).length, plannedGroups: plans.length, rowsToMerge, affiliateRowsToMerge: affiliateRows, reviewGroups: review.length },
  };
}

/** True when two raw names reduce to the same distinctive stem with compatible descriptors. Convenience for tests and ad-hoc checks. */
export function isSameCompanyName(a: string, b: string, opts: PartsOptions = {}): boolean {
  const pa = sameCompanyParts(a, opts);
  const pb = sameCompanyParts(b, opts);
  if (!pa.stem || !pb.stem || pa.excluded || pb.excluded || pa.tagged.length || pb.tagged.length) return false;
  if (!sameCompanyKey(pa.stem, pb.stem)) return false;
  if (pa.institutional && pb.institutional) return !(pa.countryTag && pb.countryTag && pa.countryTag !== pb.countryTag);
  if (pa.institutional !== pb.institutional) return false;
  if (isDistinctiveStem(pa.stem)) return descriptorsCompatible(pa, pb);
  const da = descriptorSignature(pa);
  return !!da && da === descriptorSignature(pb);
}
