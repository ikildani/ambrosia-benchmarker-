/**
 * Shared entity graph — name normalisation and similarity.
 *
 * Pure functions, no I/O. Used by lib/entities/resolve.ts and by the
 * read-only duplicate-company audit (docs/entity-graph.md).
 *
 * Company names: NFKC-fold, lowercase, strip trademark marks and punctuation,
 * expand "&" to "and", then drop trailing legal-form tokens (inc, ltd, ag,
 * plc, gmbh, ...) and a trailing connector left behind by that ("Eli Lilly
 * and Company" -> "eli lilly"). Tokens that distinguish real organisations
 * are deliberately NOT stripped: "holding"/"holdings" (Roche vs Roche
 * Holding AG are separate rows today and must not collapse silently),
 * "kgaa" (Merck KGaA is not Merck & Co), "group", "therapeutics", etc.
 *
 * Asset names: the drug_aliases.alias_normalized key from
 * lib/radar/drug-name.ts (lowercase alphanumerics only) so alias lookups hit
 * the existing index exactly.
 *
 * similarity(a, b): pg_trgm-style trigram Jaccard. Each word is padded with
 * two leading spaces and one trailing space before trigrams are taken, so a
 * word boundary counts and short words still produce trigrams. Result is
 * |A ∩ B| / |A ∪ B| in [0, 1]. Threshold for an automatic fuzzy match is
 * FUZZY_MATCH_THRESHOLD (0.85); anything between CANDIDATE_FLOOR (0.4) and
 * the threshold is surfaced as a candidate, never a match.
 */

import { normalizeKey } from '@/lib/radar/drug-name';

/** Minimum trigram similarity for an automatic fuzzy match. */
export const FUZZY_MATCH_THRESHOLD = 0.85;
/** Minimum similarity to be reported as a candidate (below the threshold). */
export const CANDIDATE_FLOOR = 0.4;
/** Candidates returned when nothing clears the threshold. */
export const MAX_CANDIDATES = 3;

/**
 * Legal-form suffixes stripped from the END of a company name, repeatedly,
 * so "Eli Lilly and Company, Inc." loses "inc" then "company" then "and".
 * Multi-word forms are listed as single tokens after punctuation removal
 * ("kabushiki kaisha" arrives as two tokens and is handled by the pair list).
 */
const LEGAL_SUFFIXES = new Set([
  'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'llc', 'lp', 'llp',
  'plc', 'ag', 'sa', 'se', 'nv', 'bv', 'gmbh', 'kk', 'pty', 'pte', 'spa', 'srl', 'sarl', 'ab', 'oy', 'oyj',
  'as', 'asa', 'aps', 'sas', 'sl', 'ltda', 'sdn', 'bhd', 'dac', 'ug', 'mbh', 'ohg', 'kg',
]);
const LEGAL_SUFFIX_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['kabushiki', 'kaisha'],
  ['co', 'ltd'],
  ['pty', 'ltd'],
  ['pte', 'ltd'],
  ['sdn', 'bhd'],
];
const TRAILING_CONNECTORS = new Set(['and', 'of', 'the']);
const LEADING_ARTICLES = new Set(['the']);

function fold(s: string | null | undefined): string {
  return (s ?? '').replace(/[™®©]/g, ' ').normalize('NFKC').toLowerCase();
}

/**
 * Canonical comparison key for an organisation name. Empty string when the
 * input has no alphanumeric content.
 */
export function normalizeCompanyName(raw: string | null | undefined): string {
  let s = fold(raw)
    .replace(/&/g, ' and ')
    // Dotted legal forms: "S.p.A." -> "spa", "N.V." -> "nv", "A/S" -> "as".
    .replace(/\b(?:[a-z]\.){2,}/g, m => m.replace(/\./g, ''))
    .replace(/\ba\/s\b/g, 'as')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  if (!s) return '';
  let tokens = s.split(/\s+/).filter(Boolean);
  while (tokens.length > 0 && LEADING_ARTICLES.has(tokens[0]) && tokens.length > 1) tokens = tokens.slice(1);
  // Strip trailing legal forms and the connectors they leave behind. Never
  // strip the last remaining token (a company literally named "Co" stays).
  let changed = true;
  while (changed && tokens.length > 1) {
    changed = false;
    const last = tokens[tokens.length - 1];
    const prev = tokens.length > 1 ? tokens[tokens.length - 2] : '';
    const pair = LEGAL_SUFFIX_PAIRS.find(([a, b]) => a === prev && b === last);
    if (pair && tokens.length > 2) {
      tokens = tokens.slice(0, -2);
      changed = true;
      continue;
    }
    if (LEGAL_SUFFIXES.has(last) || TRAILING_CONNECTORS.has(last)) {
      tokens = tokens.slice(0, -1);
      changed = true;
    }
  }
  s = tokens.join(' ');
  return s;
}

/**
 * Space-free form of a normalised company name, so "Astra Zeneca" and
 * "AstraZeneca" compare equal at the exact stage without any fuzziness.
 */
export function compactKey(normalized: string): string {
  return normalized.replace(/\s+/g, '');
}

/** True when two normalised company names are the same organisation name. */
export function sameCompanyKey(a: string, b: string): boolean {
  return a === b || (a.length > 0 && compactKey(a) === compactKey(b));
}

/** Comparison key for an asset name: the drug_aliases.alias_normalized form. */
export function normalizeAssetName(raw: string | null | undefined): string {
  return normalizeKey(raw ?? '');
}

/** Loose key for free-text party names on deals (same rules as companies). */
export function normalizePartyName(raw: string | null | undefined): string {
  return normalizeCompanyName(raw);
}

/**
 * pg_trgm-compatible trigram set: split on non-alphanumerics, pad each word
 * with "  " before and " " after, take every 3-char window.
 */
export function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  const words = fold(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
  for (const w of words) {
    const padded = `  ${w} `;
    for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
}

/**
 * Trigram Jaccard similarity in [0, 1]. Symmetric. 1 for identical
 * normalised strings, 0 when either side has no trigrams.
 */
export function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return ta.size === tb.size ? 1 : 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Similarity of two company names after normalisation. */
export function companySimilarity(a: string, b: string): number {
  return similarity(normalizeCompanyName(a), normalizeCompanyName(b));
}

/**
 * Rank a pool of candidates by similarity to the query. Returns the best
 * match (if it clears the threshold and beats the runner-up by a clear
 * margin or is unique at that score) and up to MAX_CANDIDATES near misses.
 */
export interface Scored<T> {
  item: T;
  score: number;
}

export function rankBySimilarity<T>(
  query: string,
  pool: readonly T[],
  keyOf: (item: T) => readonly string[],
  opts: { threshold?: number; floor?: number; max?: number } = {},
): { best: Scored<T> | null; candidates: Scored<T>[] } {
  const threshold = opts.threshold ?? FUZZY_MATCH_THRESHOLD;
  const floor = opts.floor ?? CANDIDATE_FLOOR;
  const max = opts.max ?? MAX_CANDIDATES;
  const scored: Scored<T>[] = [];
  for (const item of pool) {
    let score = 0;
    for (const k of keyOf(item)) {
      const s = similarity(query, k);
      if (s > score) score = s;
    }
    if (score >= floor) scored.push({ item, score });
  }
  scored.sort((x, y) => y.score - x.score);
  const best = scored.length && scored[0].score >= threshold ? scored[0] : null;
  const rest = best ? scored.slice(1) : scored;
  return { best, candidates: rest.slice(0, max) };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string | null | undefined): boolean {
  return !!s && UUID_RE.test(s);
}

/** Quote a value for a PostgREST `.or()` filter (commas, parens, quotes are unsafe bare). */
export function orValue(v: string): string {
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * The most distinctive token of a normalised name, used to pull a bounded
 * candidate pool from the database before scoring locally. Longest token
 * wins; ties go to the earlier one.
 */
export function anchorToken(normalized: string): string {
  let best = '';
  for (const t of normalized.split(' ')) {
    if (t.length > best.length) best = t;
  }
  return best;
}
