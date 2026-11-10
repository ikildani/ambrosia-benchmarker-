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
 *
 * Nov 9 2026 spot-check of the first full dry run (106 moves out of the US) found single-source
 * moves wrong far more often than that, so an override now needs two signals or a decisive one
 * (a name-verified EDGAR address, or a country the name states), group members named for their
 * parent no longer take the parent's country, and a country stated in the name counts as evidence.
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

const LEGAL_WORDS = new Set('inc incorporated ltd limited llc plc corp corporation co company gmbh ag sa spa as ab bv nv kk holdings holding group sas srl pty oy asa the and'.split(' '));

/** Lower-case name tokens without punctuation, parentheticals or legal-form words. */
export function nameTokens(name: string): string[] {
  return name.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9& ]+/g, ' ')
    .split(/\s+/).filter(t => t && !LEGAL_WORDS.has(t));
}

/**
 * Whether an EDGAR filer name is the same company: every token of the shorter name appears in the
 * longer. A stored CIK can belong to a different company (Bicycle Health carried Bicycle
 * Therapeutics' filer and was moved to the UK, Nov 9 2026 spot-check).
 */
export function edgarNameMatches(name: string, filerNames: string[]): boolean {
  const ours = nameTokens(name);
  if (ours.length === 0) return false;
  return filerNames.some(f => {
    const theirs = nameTokens(f);
    if (theirs.length === 0) return false;
    const [short, long] = ours.length <= theirs.length ? [ours, theirs] : [theirs, ours];
    return short.every(t => long.includes(t));
  });
}

/**
 * A country the company name states outright: "Danone Research B.V. (Netherlands)",
 * "Pharmion Ltd (UK)", "Alveron Pharma UK Ltd". Registries often record sponsors this way.
 */
export function nameStatedCountry(name: string): string | null {
  for (const m of name.matchAll(/\(([^)]+)\)/g)) {
    const iso = normalizeCountryCode(m[1].trim());
    if (iso) return iso === 'UK' ? 'GB' : iso;
  }
  return /\bU\.?K\.?(?=[\s,)]|$)/.test(name) ? 'GB' : null;
}

/**
 * A US arm of a foreign group ("Sanofi US Services", "Knight Therapeutics (USA)", "... Pharma America").
 * The name classifier maps these to the parent's country, so they keep a US vote instead.
 */
export function isUsSubsidiaryName(name: string): boolean {
  return /\bUSA\b|\bU\.S\.(A\.)?|\bUS\b|\bAmericas?\b/.test(name);
}

/** Group members named for their parent ("Genentech, Inc., a Member of the Roche Group"). */
const GROUP_MEMBER = /\b(a )?(member|subsidiary|part|division) of\b|\bwholly[- ]owned\b|\//i;

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
  reason: 'agreed' | 'override' | 'filled' | 'kept' | 'cleared' | 'contested' | 'no_evidence' | 'single_source';
}

/**
 * Signals strong enough to override a stored country on their own. Everything else needs a second
 * agreeing signal: single Wikidata, trial-site and parent-name hits produced most of the wrong moves
 * in the Nov 9 2026 spot-check (Applied Biology to Czechia, Exactech to Korea, Genentech to Switzerland).
 */
const DECISIVE = new Set(['sec_edgar', 'name_country', 'name_us_subsidiary']);

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
  const stated = nameStatedCountry(s.name);
  add(stated, 'name_country');
  if (!stated && isUsSubsidiaryName(s.name)) {
    add('US', 'name_us_subsidiary');
  } else if (!stated && !GROUP_MEMBER.test(s.name)) {
    const g = classifyCompanyCountry(s.name);
    if (g.country !== 'unknown') add(g.country, g.confidence === 'medium' ? 'name_suffix' : 'name_lookup');
  }

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
  // Overriding a country that carries evidence takes two signals or one decisive one.
  if (stored && basis.length < 2 && !basis.some(b => DECISIVE.has(b))) return keep('single_source');
  return { country: winner, changed: true, basis, reason: original ? 'override' : 'filled' };
}
