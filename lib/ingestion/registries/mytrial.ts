/**
 * MyTrial — Israel Ministry of Health clinical trials database
 * (https://my.health.gov.il/CliniTrials). Lists every MoH-approved trial in
 * Israel including Phase 1 trials by Israeli biotechs that are not (yet) on
 * CT.gov.
 *
 * Capability  scrape_required. Verified Sep 2026: my.health.gov.il does not answer
 *   from US egress (connection timeout on every attempt); the site is a SharePoint
 *   application (…/CliniTrials/Pages/HomePage.aspx) whose search grid is loaded by
 *   XHR after login-free page load. A worker with EU/IL egress and a browser is
 *   needed; no API or bulk file is published.
 * URL patterns
 *   search  https://my.health.gov.il/CliniTrials/Pages/HomePage.aspx
 *   detail  https://my.health.gov.il/CliniTrials/Pages/MOH_{id}.aspx
 *           (ids look like MOH_2023-01-15_012345)
 * Field mapping (English labels on the detail page → RegistryRecord):
 *   "MOH Number" / "Trial ID"                → registry_id
 *   "Trial Name" / "Public title" / "Scientific title" → title
 *   "Sponsor" / "Initiator" ("Company" vs "Investigator/Institution") → sponsor_name, sponsor_type
 *   "Product Name" / "Generic Name" / "Drug"  → interventions (type drug; "Medical Device" → device)
 *   "Indication" / "Medical Condition"        → conditions
 *   "Phase"                                   → phase
 *   "Status" ("Recruiting", "Not yet recruiting", "Active - not recruiting", "Completed",
 *             "Terminated", "Suspended")       → status
 *   "Approval Date", "Start Date", "End Date", "Last Update" → dates
 *   "NCT Number" / "ClinicalTrials.gov ID"    → secondary_ids (NCT bridge)
 *   "Trial Type" ("Drug", "Device", "Other")  → study_type / intervention type
 * License   Israeli government open data (Freedom of Information / data.gov.il terms: attribution).
 * Reach     ~7,000 trials; ~1,500 industry drug trials, ~40% by Israeli sponsors.
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
  uniq,
} from './shared';

const REASON = 'my.health.gov.il is unreachable from US egress and the SharePoint grid loads via XHR; needs IL/EU egress + browser';

function field(page: ScrapedPage, ...labels: string[]): string | null {
  for (const l of labels) {
    const v = page.fields[l];
    if (Array.isArray(v)) return v.filter(Boolean).join('; ') || null;
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

export function mapMyTrialPage(page: ScrapedPage): RegistryRecord {
  const id = field(page, 'MOH Number', 'Trial ID', 'MoH Number') ?? page.id;
  const sponsor = field(page, 'Sponsor', 'Company', 'Initiator');
  const initiatorType = field(page, 'Initiator Type', 'Sponsor Type');
  const trialType = field(page, 'Trial Type', 'Type');
  const ivType = trialType && /device/i.test(trialType) ? 'device' : 'drug';
  const products = compact([
    ...splitList(field(page, 'Product Name', 'Drug', 'Product')),
    ...splitList(field(page, 'Generic Name', 'Active Ingredient')),
  ]);
  const interventions = products
    .map(n => makeIntervention(n, ivType, /placebo/i.test(n) ? 'placebo' : 'experimental'))
    .filter((iv): iv is NonNullable<typeof iv> => !!iv);
  const phaseRaw = field(page, 'Phase');
  const statusRaw = field(page, 'Status', 'Trial Status', 'Recruitment Status');
  const allText = Object.values(page.fields).flat().filter(Boolean).join(' ');

  return {
    registry: 'mytrial',
    registry_id: id,
    secondary_ids: uniq([...compact([field(page, 'NCT Number', 'ClinicalTrials.gov ID', 'NCT')]), ...extractSecondaryIds(allText)]).filter(s => s !== id),
    title: field(page, 'Scientific title', 'Trial Name', 'Public title', 'Title'),
    sponsor_name: sponsor,
    sponsor_type: classifySponsorClass(sponsor, initiatorType ?? (sponsor && /ltd|inc|pharma|bio/i.test(sponsor) ? 'company' : null)),
    collaborators: compact(splitList(field(page, 'Collaborators', 'CRO'))).filter(c => c !== sponsor),
    interventions,
    conditions: splitList(field(page, 'Indication', 'Medical Condition', 'Condition')).slice(0, 20),
    phase_raw: phaseRaw,
    phase: mapRegistryPhase(phaseRaw),
    status_raw: statusRaw,
    status: mapRegistryStatus(statusRaw),
    study_type: 'interventional',
    countries: ['IL'],
    start_date: normalizeRegistryDate(field(page, 'Start Date', 'Trial Start Date'), { monthFirst: false }),
    primary_completion_date: normalizeRegistryDate(field(page, 'End Date', 'Planned End Date'), { monthFirst: false }),
    first_registered: normalizeRegistryDate(field(page, 'Approval Date', 'MOH Approval Date'), { monthFirst: false }),
    last_updated: normalizeRegistryDate(field(page, 'Last Update', 'Last Updated'), { monthFirst: false }),
    source_url: page.url || `https://my.health.gov.il/CliniTrials/Pages/${encodeURIComponent(id)}.aspx`,
    raw: { format: 'scraped_page', fields: page.fields, fetched_at: page.fetchedAt ?? null },
  };
}

export const mytrialAdapter: RegistryAdapter<ScrapedPage> = {
  registry: 'mytrial',
  displayName: 'MyTrial (Israel MoH)',
  countryScope: ['IL'],
  license: 'Israeli government open data (attribution)',
  capability: 'scrape_required',
  transport: 'none',
  verified: 'unverified',
  rateLimitMs: 2000,
  defaultLimit: 50,
  estimatedReach: 7_000,
  urls: {
    search: 'https://my.health.gov.il/CliniTrials/Pages/HomePage.aspx',
    detail: id => `https://my.health.gov.il/CliniTrials/Pages/${encodeURIComponent(id)}.aspx`,
  },
  mapRecord(raw: ScrapedPage): RegistryRecord {
    return mapMyTrialPage(raw);
  },
  async fetchPage(_cursor: string | null, _opts: FetchPageOptions): Promise<FetchPageResult> {
    throw new NotImplementedError('mytrial', REASON);
  },
};

export default mytrialAdapter;
