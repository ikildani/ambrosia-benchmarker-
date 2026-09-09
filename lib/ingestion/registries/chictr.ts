/**
 * ChiCTR — Chinese Clinical Trial Registry (WHO primary registry for China;
 * investigator-initiated trials, TCM, and many hospital-run drug trials that
 * are neither on CDE nor CT.gov).
 *
 * Capability  scrape_required. Verified Sep 2026: https://www.chictr.org.cn/
 *   searchproj.html answers HTTP 200 with a 5.8 KB JavaScript challenge shell;
 *   the listing (searchproj.html, POST with page/reg_date filters, 10 rows/page)
 *   and detail pages (showprojEN.html?proj={internalId}, bilingual) render after
 *   the challenge cookie is set. There is no API; the "export" links produce
 *   XLS files via the same session. A browser with CN-friendly egress is required.
 * URL patterns
 *   search  https://www.chictr.org.cn/searchprojEN.html
 *   detail  https://www.chictr.org.cn/showprojEN.html?proj={internalId}
 *           (public id ChiCTR2300070000; the internal numeric id is in the listing)
 * Field mapping (English detail labels → RegistryRecord):
 *   "Registration number"                    → registry_id
 *   "Public title", "Scientific title"        → title
 *   "Primary sponsor", "Source(s) of funding" → sponsor_name / collaborators
 *   "Interventions" table rows {Group, Sample size, Intervention, Intervention code}
 *                                             → interventions (Group "control"/"placebo" → role)
 *   "Target disease"                          → conditions
 *   "Study phase" ("Phase I", "Phase II", "Phase III", "Phase IV", "0", "Not applicable"…) → phase
 *   "Recruiting status" ("Recruiting", "Not yet recruiting", "Completed", "Terminated"…) → status
 *   "Study type" ("Interventional study", "Observational study")  → study_type
 *   "Countries of recruitment and research settings" → countries
 *   "Date of Registration", "Date of Last Refreshed on", "Date of approval of ethical committee",
 *   "Date of first enrollment"/"Study execute time" → dates
 *   "Secondary ID(s)"                         → secondary_ids
 * License   ChiCTR data are public; the registry's statement asks for attribution
 *           and forbids bulk redistribution of the raw records.
 * Reach     ~90,000 records; ~4,000 industry-sponsored drug trials (mostly generics/
 *           biosimilars and hospital-sponsored innovative drug trials).
 */

import type { FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryRecord, ScrapedPage } from './types';
import { NotImplementedError } from './types';
import {
  classifySponsorClass,
  compact,
  extractSecondaryIds,
  makeIntervention,
  mapRegistryPhase,
  mapRegistryStatus,
  normalizeRegistryDate,
  splitList,
  toIso2List,
  uniq,
} from './shared';

const REASON = 'JavaScript challenge shell on every page and POST-only listing; needs browser + CN-friendly egress';

function field(page: ScrapedPage, ...labels: string[]): string | null {
  for (const l of labels) {
    const v = page.fields[l];
    if (Array.isArray(v)) return v.filter(Boolean).join('; ') || null;
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function fieldList(page: ScrapedPage, ...labels: string[]): string[] {
  for (const l of labels) {
    const v = page.fields[l];
    if (Array.isArray(v)) return compact(v);
    if (typeof v === 'string' && v.trim()) return splitList(v);
  }
  return [];
}

export function mapChictrPage(page: ScrapedPage): RegistryRecord {
  const id = field(page, 'Registration number', 'Registration Number', 'ChiCTR') ?? page.id;
  const sponsor = field(page, 'Primary sponsor', 'Primary Sponsor');
  const groups = fieldList(page, 'Group');
  const ivs = fieldList(page, 'Intervention', 'Interventions');
  const codes = fieldList(page, 'Intervention code');
  const interventions = ivs
    .map((n, i) => {
      const g = (groups[i] ?? '').toLowerCase();
      const role = /placebo/.test(g) ? 'placebo' : /control|comparator/.test(g) ? 'comparator' : 'experimental';
      const code = (codes[i] ?? codes[0] ?? '').toLowerCase();
      const type = /drug|药/.test(code) || /\bmg\b|tablet|capsule|injection|infusion/i.test(n) ? 'drug' : code || 'unknown';
      return makeIntervention(n, type, role);
    })
    .filter((iv): iv is NonNullable<typeof iv> => !!iv);
  const phaseRaw = field(page, 'Study phase', 'Phase');
  const statusRaw = field(page, 'Recruiting status', 'Recruitment status');
  const allText = Object.values(page.fields).flat().filter(Boolean).join(' ');
  const countries = toIso2List(fieldList(page, 'Countries of recruitment and research settings', 'Countries of recruitment'));

  return {
    registry: 'chictr',
    registry_id: id,
    secondary_ids: uniq([...fieldList(page, 'Secondary ID(s)', 'Secondary ID'), ...extractSecondaryIds(allText)]).filter(s => s !== id),
    title: field(page, 'Scientific title', 'Public title', 'Title'),
    sponsor_name: sponsor,
    sponsor_type: classifySponsorClass(sponsor),
    collaborators: fieldList(page, 'Source(s) of funding', 'Secondary sponsor').filter(c => c !== sponsor),
    interventions,
    conditions: fieldList(page, 'Target disease', 'Target Disease', 'Condition').slice(0, 20),
    phase_raw: phaseRaw,
    phase: mapRegistryPhase(phaseRaw),
    status_raw: statusRaw,
    status: mapRegistryStatus(statusRaw),
    study_type: (field(page, 'Study type', 'Study Type') ?? '').toLowerCase().replace(/ study$/, '') || null,
    countries: countries.length > 0 ? countries : ['CN'],
    start_date: normalizeRegistryDate(field(page, 'Date of first enrollment', 'Study execute time', 'Start date')),
    primary_completion_date: normalizeRegistryDate(field(page, 'Study execute end time', 'End date')),
    first_registered: normalizeRegistryDate(field(page, 'Date of Registration', 'Date of registration')),
    last_updated: normalizeRegistryDate(field(page, 'Date of Last Refreshed on', 'Date of last refreshed on', 'Last updated')),
    source_url: page.url || `https://www.chictr.org.cn/searchprojEN.html?regno=${encodeURIComponent(id)}`,
    raw: { format: 'scraped_page', fields: page.fields, fetched_at: page.fetchedAt ?? null },
  };
}

export const chictrAdapter: RegistryAdapter<ScrapedPage> = {
  registry: 'chictr',
  displayName: 'ChiCTR (China)',
  countryScope: ['CN'],
  license: 'ChiCTR public data; attribution, no bulk redistribution of raw records',
  capability: 'scrape_required',
  transport: 'none',
  verified: 'verified',
  rateLimitMs: 3000,
  defaultLimit: 10,
  estimatedReach: 90_000,
  urls: {
    search: 'https://www.chictr.org.cn/searchprojEN.html',
    detail: id => `https://www.chictr.org.cn/searchprojEN.html?regno=${encodeURIComponent(id)}`,
  },
  mapRecord(raw: ScrapedPage): RegistryRecord {
    return mapChictrPage(raw);
  },
  async fetchPage(_cursor: string | null, _opts: FetchPageOptions): Promise<FetchPageResult> {
    throw new NotImplementedError('chictr', REASON);
  },
};

export default chictrAdapter;
