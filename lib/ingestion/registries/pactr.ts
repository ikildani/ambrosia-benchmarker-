/**
 * PACTR — Pan African Clinical Trials Registry (SAMRC; WHO primary registry
 * for Africa, covering Egypt, Nigeria, Kenya, South Africa, Morocco and
 * most of MENA-Africa). Industry drug trials here are mostly multinational
 * Phase 3 sites that also carry an NCT id.
 *
 * Capability  scrape_required. Verified Sep 2026:
 *   GET https://pactr.samrc.ac.za/Search.aspx           ASP.NET WebForms; results, the
 *       "Download XML"/"Download Excel" buttons (ctl00$lbDownloadXml, ctl00$lbDownloadTrials)
 *       and paging are __doPostBack calls that need __VIEWSTATE / __EVENTVALIDATION
 *       round-trips — a browser is needed.
 *   GET https://pactr.samrc.ac.za/TrialDisplay.aspx?TrialID={numericId}
 *       returns a 3.6 KB shell; the record is rendered client-side.
 *   There is no API and no public bulk file; WHO ICTRP mirrors PACTR (id bridge only).
 * Worker recipe: open Search.aspx, submit the empty search, click "Download XML"
 *   (yields the PACTR XML export for the current result page, 100 rows per page),
 *   page with the grid's __doPostBack, POST each file to the registry-sweep
 *   ingest path as ScrapedPage {id: PACTR…, url, fields}.
 * Field mapping (PACTR export / detail labels → RegistryRecord):
 *   "Trial ID" / "PACTR ID"                         → registry_id (PACTR2023xxxxxxxxxxx)
 *   "Public title", "Scientific title"              → title
 *   "Primary sponsor" (name), "Primary sponsor type" → sponsor_name, sponsor_type
 *   "Secondary sponsors", "Source(s) of monetary support" → collaborators
 *   "Intervention(s)" rows: {Intervention type, Intervention name, Description, Group name}
 *                                                   → interventions (Drug → 'drug'; Group name
 *                                                     "control"/"placebo" → comparator/placebo)
 *   "Health condition(s) or problem(s) studied"     → conditions
 *   "Phase"                                         → phase ("Phase 3", "Not applicable")
 *   "Recruitment status"                            → status
 *   "Countries of recruitment"                      → countries
 *   "Anticipated/Actual date of first enrolment", "Date of registration",
 *   "Last updated", "Anticipated/Actual date of last follow-up" → dates
 *   "Secondary identifying numbers"                 → secondary_ids (NCT bridge)
 *   "Study type"                                    → study_type
 * License   PACTR data are public; registry asks for attribution (https://pactr.samrc.ac.za/Terms.aspx).
 * Reach     ~4,500 trials; ~500 industry-sponsored drug trials (most with NCT ids).
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

const REASON = 'ASP.NET WebForms postbacks (__VIEWSTATE) for search, paging and XML download; detail page is client-rendered';

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

export function mapPactrPage(page: ScrapedPage): RegistryRecord {
  const id = field(page, 'Trial ID', 'PACTR ID', 'Registry ID') ?? page.id;
  const sponsor = field(page, 'Primary sponsor', 'Primary Sponsor');
  const sponsorType = field(page, 'Primary sponsor type', 'Sponsor type');
  const interventionNames = fieldList(page, 'Intervention name', 'Intervention(s)', 'Interventions');
  const interventionTypes = fieldList(page, 'Intervention type');
  const groupNames = fieldList(page, 'Group name');
  const interventions = interventionNames
    .map((n, i) => {
      const group = (groupNames[i] ?? '').toLowerCase();
      const role = /placebo/.test(group) ? 'placebo' : /control|comparator|standard/.test(group) ? 'comparator' : 'experimental';
      return makeIntervention(n, interventionTypes[i] ?? interventionTypes[0] ?? 'unknown', role);
    })
    .filter((iv): iv is NonNullable<typeof iv> => !!iv);
  const phaseRaw = field(page, 'Phase');
  const statusRaw = field(page, 'Recruitment status', 'Recruitment Status', 'Overall status');
  const allText = Object.values(page.fields).flat().filter(Boolean).join(' ');

  return {
    registry: 'pactr',
    registry_id: id,
    secondary_ids: uniq([...fieldList(page, 'Secondary identifying numbers', 'Secondary IDs'), ...extractSecondaryIds(allText)]).filter(s => s !== id),
    title: field(page, 'Scientific title', 'Public title', 'Title'),
    sponsor_name: sponsor,
    sponsor_type: classifySponsorClass(sponsor, sponsorType),
    collaborators: compact([...fieldList(page, 'Secondary sponsors', 'Secondary sponsor'), ...fieldList(page, 'Source(s) of monetary support', 'Funding source')]).filter(c => c !== sponsor),
    interventions,
    conditions: fieldList(page, 'Health condition(s) or problem(s) studied', 'Condition', 'Health condition').slice(0, 20),
    phase_raw: phaseRaw,
    phase: mapRegistryPhase(phaseRaw),
    status_raw: statusRaw,
    status: mapRegistryStatus(statusRaw),
    study_type: (field(page, 'Study type', 'Type of study') ?? '').toLowerCase() || null,
    countries: toIso2List(fieldList(page, 'Countries of recruitment', 'Country')),
    start_date: normalizeRegistryDate(field(page, 'Actual date of first enrolment', 'Anticipated date of first enrolment', 'Date of first enrolment')),
    primary_completion_date: normalizeRegistryDate(field(page, 'Actual date of last follow-up', 'Anticipated date of last follow-up', 'Date of last follow-up')),
    first_registered: normalizeRegistryDate(field(page, 'Date of registration', 'Registration date')),
    last_updated: normalizeRegistryDate(field(page, 'Last updated', 'Date of last update')),
    source_url: page.url || `https://pactr.samrc.ac.za/Search.aspx?TrialID=${encodeURIComponent(id)}`,
    raw: { format: 'scraped_page', fields: page.fields, fetched_at: page.fetchedAt ?? null },
  };
}

export const pactrAdapter: RegistryAdapter<ScrapedPage> = {
  registry: 'pactr',
  displayName: 'PACTR (Pan-African)',
  countryScope: ['ZA', 'EG', 'NG', 'KE', 'MA', 'GH', 'UG', 'TZ', 'ET', 'TN'],
  license: 'PACTR public data, attribution requested',
  capability: 'scrape_required',
  transport: 'none',
  verified: 'verified',
  rateLimitMs: 2000,
  defaultLimit: 100,
  estimatedReach: 4_500,
  urls: {
    search: 'https://pactr.samrc.ac.za/Search.aspx',
    detail: id => `https://pactr.samrc.ac.za/TrialDisplay.aspx?TrialID=${encodeURIComponent(id)}`,
  },
  mapRecord(raw: ScrapedPage): RegistryRecord {
    return mapPactrPage(raw);
  },
  async fetchPage(_cursor: string | null, _opts: FetchPageOptions): Promise<FetchPageResult> {
    throw new NotImplementedError('pactr', REASON);
  },
};

export default pactrAdapter;
