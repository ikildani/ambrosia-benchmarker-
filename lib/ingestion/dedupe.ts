/**
 * Duplicate detection for deal inserts.
 *
 * Why (Sep 25 2026): the insert-time check compared exact licensor/licensee
 * strings in one direction within ±30 days. The corpus held the same deal two to
 * five times under name variants ("BMS" / "Bristol-Myers Squibb" / "Bristol Myers
 * Squibb"), swapped roles, and placeholder dates. This module normalises party
 * names to a core key, matches either orientation, and tolerates the date slack
 * that press coverage and filings introduce.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const SUFFIXES = /\b(inc|ltd|llc|corp|corporation|co|plc|ag|sa|nv|ab|as|oy|kk|limited|company|holdings?|group|pharmaceuticals?|pharma|therapeutics|biosciences?|biotechnology|biotech|biopharma|biopharmaceuticals?|laboratories|labs?|medicines?|sciences?|the)\b/g;

/** Big buyers: when a pair appears in both orientations, the orientation with one of these as licensee wins. */
export const LIKELY_LICENSEES: ReadonlySet<string> = new Set([
  'pfizer', 'merck', 'msd', 'johnsonjohnson', 'janssen', 'abbvie', 'elililly', 'lilly', 'bristolmyerssquibb', 'bms', 'amgen', 'gilead',
  'regeneron', 'vertex', 'biogen', 'moderna', 'roche', 'genentech', 'novartis', 'astrazeneca', 'gsk', 'glaxosmithkline', 'sanofi', 'novonordisk',
  'bayer', 'boehringeringelheim', 'boehringer', 'merckkgaa', 'takeda', 'daiichisankyo', 'astellas', 'eisai', 'otsuka', 'chugai', 'ono',
  'cslbehring', 'csl', 'ucb', 'ipsen', 'servier', 'jazz', 'alexion', 'abbott', 'teva', 'viatris', 'sunpharmaceutical', 'sun', 'hansoh', 'hengrui',
  'fosun', 'cspc', 'innovent', 'beigene', 'beone', 'zailab', 'hutchmed',
]);

/** Core key for a company name: lowercase, parentheticals and legal/sector suffixes removed, non-alphanumerics stripped. */
export function partyKey(name: string | null | undefined): string {
  if (!name) return '';
  return name.toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(SUFFIXES, ' ').replace(/[^a-z0-9]/g, '');
}

export function assetKey(name: string | null | undefined): string {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const ROOT_STOP = /\b(inc|ltd|llc|corp|corporation|co|plc|ag|sa|nv|ab|as|oy|kk|gmbh|limited|company|holdings?|group|pharmaceuticals?|pharma|therapeutics|biosciences?|biotechnology|biotech|biopharma|biopharmaceuticals?|bio|biologics|laboratories|labs?|medicines?|sciences?|the|and|of)\b/g;
const ROOT_ALIASES: Record<string, string> = {
  eli: 'lilly', bms: 'bristol', bristolmyers: 'bristol', hoffmann: 'roche', genentech: 'genentech', msd: 'merck', az: 'astrazeneca',
  jnj: 'johnson', janssen: 'janssen', glaxosmithkline: 'gsk', boehringer: 'boehringer', jiangsu: 'hengrui', shenyang: '3sbio', sunshine: '3sbio',
};

/**
 * Company root for duplicate matching, mirroring the database's deal_party_root() (migration 152):
 * first meaningful token after legal/sector words are removed, with a small alias table.
 * "Eli Lilly and Company" and "Lilly" → lilly; "F. Hoffmann-La Roche" → roche; "Merck KGaA" → merckkgaa.
 * Non-Latin names keep their first 24 characters so distinct names stay distinct.
 */
/** Raw-name search terms for a root, so an alias root still finds "MSD" or "GlaxoSmithKline". */
const ROOT_SEARCH: Record<string, string[]> = {
  merck: ['merck', 'msd'], merckkgaa: ['merck', 'emd'], gsk: ['gsk', 'glaxo'], bristol: ['bristol', 'bms'],
  johnson: ['johnson', 'jnj', 'j&j'], astrazeneca: ['astrazeneca', 'az'], roche: ['roche', 'hoffmann'], lilly: ['lilly'],
};
export function rootSearchTerms(root: string): string[] {
  return (ROOT_SEARCH[root] ?? [root]).map(t => t.replace(/[%_,()]/g, ''));
}

export function partyRoot(name: string | null | undefined): string {
  if (!name) return '';
  const n = name.toLowerCase();
  const tokens = n.replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(ROOT_STOP, ' ').split(/\s+/).filter(t => t.length >= 2);
  if (tokens.length === 0) return n.replace(/\s+/g, '').slice(0, 24);
  const t = tokens[0];
  if (t === 'merck' && /kgaa|darmstadt|emd serono/.test(n)) return 'merckkgaa';
  if (t === 'emd') return 'merckkgaa';
  return ROOT_ALIASES[t] ?? t;
}

/** Unordered pair key so swapped roles collapse together. */
export function pairKey(licensor: string, licensee: string): string {
  const a = partyKey(licensor), b = partyKey(licensee);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

export interface DuplicateCandidate {
  id: string;
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  announced_date: string;
  verification_status: string | null;
}

export interface DuplicateMatch {
  id: string;
  reason: 'same_asset' | 'same_parties_near_date' | 'same_parties_30d_different_asset';
  reversed: boolean;
  /** Not a hard duplicate: insert flagged for review instead of dropping. */
  possible?: boolean;
}

/**
 * Find an existing real row that is the same deal. Same unordered party pair and
 * either the same normalised asset within 400 days, or no usable asset on either
 * side within 60 days. Pulls candidates by a cheap core-token ilike on both names.
 */
export async function findLikelyDuplicate(
  supabase: SupabaseClient,
  deal: { licensor: string; licensee: string; asset?: string | null; announcedDate: string },
): Promise<DuplicateMatch | null> {
  const lk = partyRoot(deal.licensor), ek = partyRoot(deal.licensee);
  if (lk.length < 2 || ek.length < 2) return null;
  const ak = assetKey(deal.asset);
  // Candidates by root token in either orientation; the root is one word, so ilike on the raw name finds it.
  const clauses: string[] = [];
  for (const a of rootSearchTerms(lk)) for (const b of rootSearchTerms(ek)) {
    clauses.push(`and(licensor_name.ilike.%${a}%,licensee_name.ilike.%${b}%)`, `and(licensor_name.ilike.%${b}%,licensee_name.ilike.%${a}%)`);
  }
  const { data } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, announced_date, verification_status')
    .eq('is_synthetic', false)
    .is('duplicate_of', null)
    .or(clauses.join(','))
    .limit(300);
  const samePair = (c: DuplicateCandidate) => {
    const a = partyRoot(c.licensor_name), b = partyRoot(c.licensee_name);
    return (a === lk && b === ek) || (a === ek && b === lk);
  };
  let possible: DuplicateMatch | null = null;
  for (const c of (data ?? []) as DuplicateCandidate[]) {
    if (!samePair(c)) continue;
    const reversed = partyRoot(c.licensor_name) !== lk;
    const dd = daysBetween(c.announced_date, deal.announcedDate);
    const cak = assetKey(c.asset_name);
    const sameAsset = !!ak && !!cak && (ak === cak || (Math.min(ak.length, cak.length) >= 5 && (ak.includes(cak) || cak.includes(ak))));
    if (sameAsset && dd <= 400) return { id: c.id, reason: 'same_asset', reversed };
    if ((!ak || !cak) && dd <= 60) return { id: c.id, reason: 'same_parties_near_date', reversed };
    // Same parties within 30 days but differently named assets: usually one agreement named two
    // ways ("research collaboration" vs "multi-target research collaboration"), sometimes two real
    // deals (Seagen → Merck, tucatinib and ladiratuzumab, 13 days apart). Not a hard duplicate:
    // the caller inserts it flagged so it stays off every surface until the flag-fixer decides.
    if (dd <= 30) possible = possible ?? { id: c.id, reason: 'same_parties_30d_different_asset', reversed, possible: true };
  }
  return possible;
}

/** True when the pair reads backwards: a big buyer listed as licensor while the other side is not. */
export function looksRoleReversed(licensor: string, licensee: string): boolean {
  const l = partyKey(licensor), e = partyKey(licensee);
  return LIKELY_LICENSEES.has(l) && !LIKELY_LICENSEES.has(e);
}
