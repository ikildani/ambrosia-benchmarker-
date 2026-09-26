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
  reason: 'same_asset' | 'same_parties_near_date';
  reversed: boolean;
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
  const lk = partyKey(deal.licensor), ek = partyKey(deal.licensee);
  if (lk.length < 3 || ek.length < 3) return null;
  const ak = assetKey(deal.asset);
  const token = (k: string) => k.slice(0, Math.min(6, k.length));
  const tl = token(lk), te = token(ek);
  // Either orientation: (licensor~lk AND licensee~ek) OR (licensor~ek AND licensee~lk)
  const { data } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, announced_date, verification_status')
    .eq('is_synthetic', false)
    .or(`and(licensor_name.ilike.%${tl}%,licensee_name.ilike.%${te}%),and(licensor_name.ilike.%${te}%,licensee_name.ilike.%${tl}%)`)
    .limit(50);
  const target = pairKey(deal.licensor, deal.licensee);
  for (const c of (data ?? []) as DuplicateCandidate[]) {
    if (pairKey(c.licensor_name, c.licensee_name) !== target) continue;
    const reversed = partyKey(c.licensor_name) !== lk;
    const dd = daysBetween(c.announced_date, deal.announcedDate);
    const cak = assetKey(c.asset_name);
    if (ak && cak && ak === cak && dd <= 400) return { id: c.id, reason: 'same_asset', reversed };
    if ((!ak || !cak) && dd <= 60) return { id: c.id, reason: 'same_parties_near_date', reversed };
  }
  return null;
}

/** True when the pair reads backwards: a big buyer listed as licensor while the other side is not. */
export function looksRoleReversed(licensor: string, licensee: string): boolean {
  const l = partyKey(licensor), e = partyKey(licensee);
  return LIKELY_LICENSEES.has(l) && !LIKELY_LICENSEES.has(e);
}
