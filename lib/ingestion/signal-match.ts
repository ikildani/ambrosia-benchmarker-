/**
 * Name, domain and ticker keys shared by the company-signal matchers (migration 198):
 * exchange listings (listings.ts), NIH grants (nih-grants.ts) and the EDGAR filer index
 * (edgar-filers.ts).
 *
 * Matching is exact on normalized keys. A wrong-company match is worse than a gap, so there is
 * no fuzzy matching here: legal forms and holding words are dropped, sector words are kept
 * ("Acme Therapeutics" never matches "Acme Biosciences"), and a key must be distinctive.
 */

import { registrableDomain, isBlockedHost } from './company-websites';

export const SIGNAL_USER_AGENT = 'SolidusResearch/1.0 (+https://solidus.ambrosiaventures.co)';

const LEGAL_FORMS = /\b(incorporated|inc|corporation|corp|company|co|limited|ltd|plc|llc|l l c|lp|llp|ag|sa|s a|spa|s p a|srl|nv|bv|se|gmbh|kgaa|kg|kk|ab|publ|as|asa|a s|oy|oyj|pty|pte|tbk|bhd|berhad|sarl|sas|pbc|the|holdings?|topco|parent)\b/g;
const SECTOR_WORDS = new Set([
  'pharmaceutical', 'pharmaceuticals', 'pharma', 'pharm', 'therapeutics', 'therapeutic', 'biotherapeutics', 'bioscience',
  'biosciences', 'biotechnology', 'biotech', 'bio', 'biopharma', 'biopharmaceutical', 'biopharmaceuticals', 'biologics',
  'medicine', 'medicines', 'medical', 'laboratories', 'laboratory', 'labs', 'lab', 'science', 'sciences', 'life',
  'healthcare', 'health', 'technologies', 'technology', 'group', 'international', 'global', 'usa', 'us', 'and', 'of',
]);

/**
 * English key: NFKC, lower case, trailing "a X company" / "now part of" clauses and a trailing
 * parenthetical dropped, punctuation to spaces, legal forms dropped. Sector words are kept.
 */
export function nameKey(raw: string | null | undefined): string {
  let s = (raw ?? '').normalize('NFKC').toLowerCase();
  s = s.replace(/\s*[,;]\s*(a|an|now|formerly|operating|part of|d\/b\/a|dba)\s.*$/, '');
  s = s.replace(/\s*\([^)]*\)\s*$/, '');
  s = s.replace(/&/g, ' and ').replace(/[''`]/g, '');
  s = s.replace(/[^a-z0-9]+/g, ' ');
  s = s.replace(LEGAL_FORMS, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/** Words of a key with sector words removed (what makes the name distinctive). */
export function distinctiveCore(key: string): string {
  return key.split(' ').filter(w => w && !SECTOR_WORDS.has(w)).join(' ');
}

/** A key is safe to match exactly when it is long enough and has a distinctive core. */
export function isDistinctiveKey(key: string, minLength = 5): boolean {
  if (!key || key.length < minLength) return false;
  const core = distinctiveCore(key);
  return core.length >= 3 && !/^\d+$/.test(core.replace(/\s/g, ''));
}

const CJK_RE = /[぀-ヿ㐀-鿿가-힯]/;
const CJK_LEGAL = /(股份有限公司|有限责任公司|有限責任公司|有限公司|股份公司|株式会社|有限会社|주식회사|\(주\)|㈜|유한회사)/g;

export function hasCjk(s: string | null | undefined): boolean {
  return CJK_RE.test(s ?? '');
}

/** CJK key: NFKC, brackets and spaces removed, legal forms removed anywhere. */
export function cjkKey(raw: string | null | undefined): string {
  return (raw ?? '')
    .normalize('NFKC')
    .replace(CJK_LEGAL, '')
    .replace(/[()（）[\]【】\s·・,，.。]/g, '')
    .trim();
}

export function isDistinctiveCjkKey(key: string): boolean {
  return [...key].length >= 4 && CJK_RE.test(key);
}

/** Every English and CJK key of a company row (name + variations). */
export function companyKeys(name: string, variations: string[] | null | undefined): { en: Set<string>; cjk: Set<string> } {
  const en = new Set<string>();
  const cjk = new Set<string>();
  for (const n of [name, ...(variations ?? [])]) {
    if (!n) continue;
    // "Name ~ 中文名" variations and "English (中文)" names: split the scripts.
    const parts = n.split(/\s*[~|]\s*/);
    for (const p of parts) {
      const cjkPart = p.match(/[぀-ヿ㐀-鿿가-힯（）()]+[぀-ヿ㐀-鿿가-힯（）()\s]*/g);
      if (cjkPart) for (const c of cjkPart) { const k = cjkKey(c); if (isDistinctiveCjkKey(k)) cjk.add(k); }
      const latin = p.replace(/[぀-ヿ㐀-鿿가-힯（）]+/g, ' ');
      const k = nameKey(latin);
      if (isDistinctiveKey(k)) en.add(k);
    }
  }
  return { en, cjk };
}

/** Registrable domain of a URL or bare host; null when unusable or a blocked aggregator. */
export function urlDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s || s === '-' || /^n\/?a$/i.test(s)) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const host = new URL(s).hostname.toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) || isBlockedHost(host)) return null;
    return registrableDomain(host);
  } catch {
    return null;
  }
}

/** Website sources trusted for domain matching (migration 191/193): never a guessed domain. */
export const TRUSTED_WEBSITE_SOURCES: ReadonlySet<string> = new Set(['ctgov_contact', 'web_search', 'wikidata']);

/**
 * Agreement between two names (used to confirm a ticker or an id that already links a record to a
 * company): 100 equal keys or equal distinctive cores, 80 one core is a word-prefix of the other, 70 every word of
 * the shorter core appears in the longer one, else 0. Mirrors company_signal_name_agreement (198).
 */
export function nameAgreement(a: string, b: string): number {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (ka && ka === kb) return 100;
  const ca = distinctiveCore(ka);
  const cb = distinctiveCore(kb);
  if (ca.length < 3 || cb.length < 3) return 0;
  if (ca === cb) return 100;
  if (ca.startsWith(`${cb} `) || cb.startsWith(`${ca} `)) return 80;
  const wa = ca.split(' ');
  const wb = cb.split(' ');
  const [short, long] = wa.length <= wb.length ? [wa, new Set(wb)] : [wb, new Set(wa)];
  return short.every(w => long.has(w)) ? 70 : 0;
}

export interface MatchSubject {
  id: string;
  name: string;
  name_variations: string[] | null;
  country: string | null;
  ticker: string | null;
  cik: string | null;
  website_url: string | null;
  website_source: string | null;
  company_type: string | null;
  family_id: string | null;
}

/** Load every match subject (company_signal_match_subjects, migration 198). */
export async function loadMatchSubjects(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> },
): Promise<MatchSubject[]> {
  const out: MatchSubject[] = [];
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase.rpc('company_signal_match_subjects', { p_after: after, p_limit: 5000 });
    if (error) throw new Error(`match subjects: ${error.message}`);
    const rows = (data ?? []) as MatchSubject[];
    out.push(...rows);
    if (rows.length < 5000) break;
    after = rows[rows.length - 1].id;
  }
  return out;
}
