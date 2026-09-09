/**
 * CTRI — Clinical Trials Registry – India (ICMR/NIMS; WHO primary registry).
 * Mandatory for every trial run in India since 2009, so it carries Indian
 * pharma's domestic Phase 1–3 programmes (Sun, Dr. Reddy's, Cipla, Lupin,
 * Glenmark, Zydus, Biocon, Bharat Biotech, Serum Institute…) that rarely
 * appear on CT.gov.
 *
 * Capability  scrape_required. Verified Sep 2026: https://ctri.nic.in/Clinicaltrials/
 *   advancesearchmain.php loads (HTTP 200) but searching is a POST with a CAPTCHA
 *   (captcha.php) and PHP session; result pages are rendered server-side with
 *   pagination via POST; detail pages need the EncHid token from the results list.
 *   No API and no bulk export (the registry offers PDF downloads per trial). A
 *   browser with a captcha-solving step (manual or service) is required; once the
 *   session exists, plain HTTP paging works.
 * URL patterns
 *   search  https://ctri.nic.in/Clinicaltrials/advancesearchmain.php
 *   detail  https://ctri.nic.in/Clinicaltrials/pmaindet2.php?EncHid={token}&Enc=&userName=
 *           (public id CTRI/2023/01/048888; the EncHid token comes from the results list)
 * Field mapping (detail-page labels → RegistryRecord):
 *   "CTRI Number"                                → registry_id
 *   "Public Title of Study", "Scientific Title of Study" → title
 *   "Primary Sponsor" {Name, Address, Type of Sponsor ("Pharmaceutical industry-Indian",
 *      "Pharmaceutical industry-Global", "Government funding agency", "Research institution
 *      and hospital", "Contract Research Organization"…)} → sponsor_name, sponsor_type
 *   "Secondary Sponsor", "Source of Monetary or Material Support" → collaborators
 *   "Intervention / Comparator Agent" rows {Type ("Intervention"/"Comparator Agent"), Name, Details}
 *                                                → interventions (Comparator → comparator; "Placebo" → placebo)
 *   "Health Condition/Problems Studied" rows {Health Type, Condition} → conditions
 *   "Phase of Trial" ("Phase 1", "Phase 2", "Phase 2/ Phase 3", "Phase 3", "Phase 4", "N/A") → phase
 *   "Recruitment Status of Trial (India)" / "(Global)" ("Not Yet Recruiting", "Open to Recruitment",
 *      "Closed to Recruitment of Participants", "Completed", "Suspended", "Terminated") → status
 *   "Type of Study" ("Interventional", "Observational", "PMS", "BA/BE") → study_type
 *   "Countries of Recruitment"                   → countries
 *   "Date of First Enrollment (India)", "Date of First Enrollment (Global)",
 *   "Date of Registration", "Last Modified On", "Estimated Duration of Trial" → dates
 *   "Secondary IDs if Any" rows {Secondary ID, Identifier ("NCT", "CTRI", "EudraCT", "Protocol Number")}
 *                                                → secondary_ids
 * License   CTRI data are public for non-commercial use; commercial reuse should be
 *           cleared with ICMR-NIMS (ctri@nims.res.in). Keep to field-level storage.
 * Reach     ~65,000 trials; ~6,000 industry-sponsored drug trials (incl. BA/BE studies).
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

const REASON = 'POST search behind a CAPTCHA and PHP session; detail pages need the EncHid token from the results list';

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

export function mapCtriPage(page: ScrapedPage): RegistryRecord {
  const id = field(page, 'CTRI Number', 'CTRI No', 'Registration Number') ?? page.id;
  const sponsor = field(page, 'Primary Sponsor', 'Primary Sponsor Name');
  const sponsorType = field(page, 'Type of Sponsor', 'Primary Sponsor Type');
  const ivTypes = fieldList(page, 'Intervention Type');
  const ivNames = fieldList(page, 'Intervention Name', 'Intervention / Comparator Agent', 'Intervention');
  const interventions = ivNames
    .map((n, i) => {
      const t = (ivTypes[i] ?? '').toLowerCase();
      const role = /placebo/i.test(n) ? 'placebo' : /comparator/.test(t) ? 'comparator' : 'experimental';
      return makeIntervention(n, 'drug', role);
    })
    .filter((iv): iv is NonNullable<typeof iv> => !!iv);
  const phaseRaw = field(page, 'Phase of Trial', 'Phase');
  const statusIndia = field(page, 'Recruitment Status of Trial (India)');
  const statusGlobal = field(page, 'Recruitment Status of Trial (Global)');
  const statusRaw = statusIndia ?? statusGlobal ?? field(page, 'Recruitment Status');
  const allText = Object.values(page.fields).flat().filter(Boolean).join(' ');
  const countries = toIso2List(fieldList(page, 'Countries of Recruitment'));
  const studyTypeRaw = field(page, 'Type of Study', 'Study Type');
  const sponsorIsCro = !!sponsorType && /contract research/i.test(sponsorType);

  return {
    registry: 'ctri',
    registry_id: id,
    secondary_ids: uniq([...fieldList(page, 'Secondary ID', 'Secondary IDs if Any'), ...extractSecondaryIds(allText)]).filter(s => s !== id && !/^(nil|na|none)$/i.test(s)),
    title: field(page, 'Scientific Title of Study', 'Public Title of Study', 'Title'),
    sponsor_name: sponsor,
    sponsor_type: sponsorIsCro ? 'CRO' : classifySponsorClass(sponsor, sponsorType),
    collaborators: compact([...fieldList(page, 'Secondary Sponsor'), ...fieldList(page, 'Source of Monetary or Material Support')]).filter(c => c !== sponsor),
    interventions,
    conditions: fieldList(page, 'Condition', 'Health Condition/Problems Studied').slice(0, 20),
    phase_raw: phaseRaw,
    phase: mapRegistryPhase(phaseRaw),
    status_raw: statusRaw,
    status: mapRegistryStatus(statusRaw && /open to recruitment/i.test(statusRaw) ? 'recruiting' : statusRaw && /closed to recruitment/i.test(statusRaw) ? 'active, not recruiting' : statusRaw),
    study_type: studyTypeRaw ? (/interven|ba\/be|pms/i.test(studyTypeRaw) ? 'interventional' : /observ/i.test(studyTypeRaw) ? 'observational' : studyTypeRaw.toLowerCase()) : null,
    countries: countries.length > 0 ? countries : ['IN'],
    start_date: normalizeRegistryDate(field(page, 'Date of First Enrollment (India)', 'Date of First Enrollment (Global)', 'Date of First Enrollment')),
    primary_completion_date: normalizeRegistryDate(field(page, 'Date of Study Completion (India)', 'Date of Study Completion (Global)')),
    first_registered: normalizeRegistryDate(field(page, 'Date of Registration')),
    last_updated: normalizeRegistryDate(field(page, 'Last Modified On', 'Last Modified')),
    source_url: page.url || `https://ctri.nic.in/Clinicaltrials/advancesearchmain.php?ctri=${encodeURIComponent(id)}`,
    raw: { format: 'scraped_page', fields: page.fields, sponsor_type_raw: sponsorType, status_global: statusGlobal, fetched_at: page.fetchedAt ?? null },
  };
}

export const ctriAdapter: RegistryAdapter<ScrapedPage> = {
  registry: 'ctri',
  displayName: 'CTRI (India)',
  countryScope: ['IN'],
  license: 'CTRI public data, non-commercial; commercial reuse to be cleared with ICMR-NIMS',
  capability: 'scrape_required',
  transport: 'none',
  verified: 'verified',
  rateLimitMs: 2500,
  defaultLimit: 25,
  estimatedReach: 65_000,
  urls: {
    search: 'https://ctri.nic.in/Clinicaltrials/advancesearchmain.php',
    detail: id => `https://ctri.nic.in/Clinicaltrials/advancesearchmain.php?ctri=${encodeURIComponent(id)}`,
  },
  mapRecord(raw: ScrapedPage): RegistryRecord {
    return mapCtriPage(raw);
  },
  async fetchPage(_cursor: string | null, _opts: FetchPageOptions): Promise<FetchPageResult> {
    throw new NotImplementedError('ctri', REASON);
  },
};

export default ctriAdapter;
