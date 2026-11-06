/**
 * Search & Evaluation — company headquarters country from independent evidence.
 *
 * Stored company countries were stamped by whichever pipeline saw the company first: the CT.gov
 * sweep used the dominant site country of one trial, and single-country registries (Health Canada,
 * ISRCTN, ...) stamped their own country. Checked against SEC EDGAR business addresses for 582 pool
 * companies (Nov 6 2026), sweep countries were right 72% of the time and registry stamps 0 of 17.
 *
 * Independent signals, each measured against the same EDGAR set:
 *   - SEC EDGAR business address (authoritative for US filers; a foreign parent can show its US
 *     subsidiary's address, so it votes rather than decides)
 *   - Wikidata, exact-label match with a business description: 89%
 *   - all-trials site consensus (one country, or >= 80% of >= 3 sites, never Australia / New Zealand
 *     alone because foreign sponsors run Phase 1 there): 92%
 *   - the name classifier (lib/ingestion/company-geography.ts): 84%
 * When the signals pick one country uncontested and it differs from the stored one, the signals were
 * right 39 times and the stored country 6 times in 48 (region right 44/48), so they override.
 */

import { classifyCompanyCountry } from '@/lib/ingestion/company-geography';
import { normalizeCountryCode } from '@/lib/radar/asset-universe';

export const GEOGRAPHY_FIX_STEP = 'company_geography_20261106';

const US_STATES = new Set(
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR VI GU'.split(' '),
);

export interface EdgarAddress {
  stateOrCountry?: string | null;
  stateOrCountryDescription?: string | null;
  country?: string | null;
  countryCode?: string | null;
}

/**
 * ISO-2 country of an EDGAR business address. US addresses carry a state code ("CA" is California)
 * and leave isForeignLocation null, so the state list decides before any country parsing.
 */
export function edgarAddressCountry(b: EdgarAddress | null | undefined): string | null {
  if (!b) return null;
  if (b.stateOrCountry && US_STATES.has(b.stateOrCountry.toUpperCase())) return 'US';
  return normalizeCountryCode(b.country ?? null)
    ?? normalizeCountryCode(b.stateOrCountryDescription ?? null)
    ?? (b.countryCode && /^[A-Z]{2}$/.test(b.countryCode) ? b.countryCode : null);
}

export interface SiteCount { iso: string; n: number }

/** Country of a sponsor's trial sites when they agree: one country, or >= 80% of >= 3 sites. */
export function siteConsensusCountry(sites: SiteCount[]): string | null {
  const total = sites.reduce((s, x) => s + x.n, 0);
  if (total < 3) return null;
  const top = [...sites].sort((a, b) => b.n - a.n)[0];
  if (!top || top.iso === 'AU' || top.iso === 'NZ') return null;
  return sites.length === 1 || top.n >= 0.8 * total ? top.iso : null;
}

export interface GeographySignals {
  name: string;
  stored: string | null;
  /** First data source on the company row (data_sources[0]). */
  storedSource: string | null;
  edgar: string | null;
  wikidata: string | null;
  sites: SiteCount[];
}

export interface GeographyDecision {
  country: string | null;
  changed: boolean;
  /** Signals that agreed on `country` (empty when the stored value was kept). */
  basis: string[];
  reason: 'agreed' | 'override' | 'filled' | 'kept' | 'cleared' | 'contested' | 'no_evidence';
}

/** Registries whose sponsors are mostly foreign, so their country says nothing about headquarters. */
export const NON_DOMESTIC_REGISTRIES = new Set(['registry:health_canada', 'registry:isrctn', 'registry:ctis', 'registry:drks', 'registry:anzctr', 'registry:euctr']);

export function decideCompanyCountry(s: GeographySignals): GeographyDecision {
  const votes = new Map<string, string[]>();
  const add = (iso: string | null, label: string) => {
    const c = iso === 'UK' ? 'GB' : iso;
    if (c) votes.set(c, [...(votes.get(c) ?? []), label]);
  };
  add(s.edgar, 'sec_edgar');
  add(s.wikidata, 'wikidata');
  add(siteConsensusCountry(s.sites), 'trial_sites');
  const g = classifyCompanyCountry(s.name);
  if (g.country !== 'unknown') add(g.country, g.confidence === 'medium' ? 'name_suffix' : 'name_lookup');

  const original = s.stored === 'UK' ? 'GB' : s.stored;
  // A country stamped by a registry whose sponsors are mostly foreign carries no evidence (0 of 17 right).
  const stored = s.storedSource && NON_DOMESTIC_REGISTRIES.has(s.storedSource) ? null : original;
  const ranked = [...votes].sort((a, b) => b[1].length - a[1].length);
  const keep = (reason: GeographyDecision['reason']): GeographyDecision =>
    ({ country: stored, changed: stored !== original, basis: [], reason: stored !== original ? 'cleared' : reason });
  if (ranked.length === 0) return keep(stored ? 'kept' : 'no_evidence');
  // A tie leaves the row alone.
  if (ranked.length > 1 && ranked[0][1].length === ranked[1][1].length) return keep('contested');
  const [winner, basis] = ranked[0];
  if (winner === original) return { country: original, changed: false, basis, reason: 'agreed' };
  return { country: winner, changed: true, basis, reason: original ? 'override' : 'filled' };
}
