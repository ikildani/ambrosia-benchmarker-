/**
 * ISRCTN registry adapter (UK primary registry; also carries many EU/RoW
 * trials registered by UK sponsors and CROs).
 *
 * Endpoint   GET https://www.isrctn.com/api/query/format/default?q=<query>&limit=<n>
 *            Returns <allTrials totalCount="N"><fullTrial><trial ...>…</trial>
 *            <contact>…</contact><sponsor>…</sponsor><funder>…</funder></fullTrial>…
 *            Query language documented at https://www.isrctn.com/page/api
 *            (field GE/LT comparisons joined with AND). Verified Sep 2026:
 *              q=lastEdited GE 2026-09-01T00:00:00                  → 208 trials
 *              q=lastEdited GE 2026-09-01T00:00:00 AND lastEdited LT 2026-09-03T00:00:00 → 80
 *              q=lastEdited GE 2026-09-01   (date without time)     → NOT applied (returns all 28,673)
 *              limit=1000 honoured; `offset`/`page` are IGNORED, so paging
 *              is done with lastEdited windows, halving the window when
 *              totalCount exceeds the page size.
 * Auth       none.  Rate limit  none published; we use 1 req/s.
 * License    CC BY 4.0 (https://www.isrctn.com/page/faqs#using-the-data) — attribution "ISRCTN registry".
 * Reach      ~28,700 trials total (Sep 2026); roughly 3,500 are commercially
 *            sponsored/funded drug trials (interventionType=Drug, commercialStatus=Commercial).
 *
 * Field mapping (fullTrial):
 *   trial@publicIdentifierCanonical / <isrctn>       → registry_id (digits only)
 *   trial@lastUpdated                                → last_updated
 *   <isrctn dateAssigned>                            → first_registered
 *   trialDescription/title, scientificTitle          → title
 *   sponsor/organisation, sponsor/commercialStatus   → sponsor_name, sponsor_type
 *   funder/name                                      → collaborators (an industry funder of a
 *                                                      non-commercial sponsor becomes the sponsor,
 *                                                      original sponsor moves to collaborators)
 *   interventions/intervention/{interventionType,drugNames,description,phase}
 *                                                    → interventions, phase
 *   conditions/condition/{description,diseaseClass1} → conditions
 *   participants/recruitmentCountries/country        → countries
 *   participants/recruitmentStart, recruitmentEnd, trialDesign/overallEndDate → dates, derived status
 *   externalRefs/{clinicalTrialsGovNumber,eudraCTNumber,secondaryNumbers} → secondary_ids
 *   trialDesign/primaryStudyDesign                   → study_type
 */

import type { FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryRecord, RegistryIntervention } from './types';
import {
  activeStatusByDate,
  attrOf,
  classifySponsorClass,
  compact,
  extractSecondaryIds,
  makeIntervention,
  mapRegistryPhase,
  mapRegistryStatus,
  normalizeRegistryDate,
  registryFetch,
  splitList,
  toIso2List,
  uniq,
  xmlAll,
  xmlAttr,
  xmlBlocks,
  xmlElements,
  xmlFirst,
} from './shared';

const API = 'https://www.isrctn.com/api/query/format/default';
const DEFAULT_WINDOW_DAYS = 7;
const MIN_WINDOW_MS = 6 * 60 * 60 * 1000;
const MAX_LIMIT = 1000;

function isoNoMillis(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, '');
}

export function mapIsrctnFullTrial(fullTrial: string, now = new Date()): RegistryRecord {
  const trialBlock = xmlBlocks(fullTrial, 'trial')[0] ?? fullTrial;
  const trialOpen = /<trial\s[^>]*>/.exec(fullTrial)?.[0] ?? '';
  const canonical = attrOf(trialOpen, 'publicIdentifierCanonical') ?? '';
  const digits = (xmlFirst(trialBlock, 'isrctn') ?? canonical.replace(/^ISRCTN/i, '')).replace(/\D/g, '');
  const description = xmlBlocks(trialBlock, 'trialDescription')[0] ?? '';

  // Sponsor / funders
  const sponsorBlock = xmlBlocks(fullTrial, 'sponsor').find(b => /<organisation>/.test(b)) ?? '';
  const sponsorOrg = xmlFirst(sponsorBlock, 'organisation');
  const sponsorCommercial = xmlFirst(sponsorBlock, 'commercialStatus');
  const sponsorTypeHint = xmlFirst(sponsorBlock, 'sponsorType') ?? sponsorCommercial;
  const funders = compact(xmlBlocks(fullTrial, 'funder').map(b => xmlFirst(b, 'name')));

  let sponsorName = sponsorOrg;
  let sponsorClass = classifySponsorClass(sponsorOrg, sponsorTypeHint);
  let collaborators = funders.filter(f => f !== sponsorOrg);
  let sponsorReassigned = false;
  if (sponsorClass !== 'INDUSTRY') {
    const industryFunders = funders.filter(f => f !== sponsorOrg && classifySponsorClass(f) === 'INDUSTRY');
    if (industryFunders.length === 1) {
      sponsorName = industryFunders[0];
      sponsorClass = 'INDUSTRY';
      collaborators = compact([sponsorOrg, ...funders.filter(f => f !== industryFunders[0] && f !== sponsorOrg)]);
      sponsorReassigned = true;
    }
  }

  // Interventions
  const interventions: RegistryIntervention[] = [];
  let phaseRaw: string | null = null;
  for (const block of xmlBlocks(trialBlock, 'intervention')) {
    const type = xmlFirst(block, 'interventionType') ?? 'unknown';
    const phase = xmlFirst(block, 'phase');
    if (phase && !phaseRaw) phaseRaw = phase;
    const drugNames = splitList(xmlFirst(block, 'drugNames'));
    if (drugNames.length > 0) {
      for (const n of drugNames) {
        const iv = makeIntervention(n, type, 'experimental');
        if (iv) interventions.push(iv);
      }
    } else {
      const desc = xmlFirst(block, 'description');
      const iv = makeIntervention(desc ? desc.slice(0, 160) : null, type, 'unknown');
      if (iv) interventions.push(iv);
    }
  }

  // Conditions
  const conditions = compact(
    xmlBlocks(trialBlock, 'condition').flatMap(b => [xmlFirst(b, 'description'), xmlFirst(b, 'diseaseClass1')]),
  ).slice(0, 20);

  // Dates + derived status (ISRCTN exposes no overall status field in the API)
  const recruitmentStart = normalizeRegistryDate(xmlFirst(trialBlock, 'recruitmentStart'));
  const recruitmentEnd = normalizeRegistryDate(xmlFirst(trialBlock, 'recruitmentEnd'));
  const overallEnd = normalizeRegistryDate(xmlFirst(trialBlock, 'overallEndDate'));
  const explicitStatus = xmlFirst(trialBlock, 'overallStatus') ?? xmlFirst(trialBlock, 'recruitmentStatus') ?? xmlFirst(trialBlock, 'trialStatus');
  let status = explicitStatus ? mapRegistryStatus(explicitStatus) : 'unknown';
  let statusRaw = explicitStatus;
  if (!explicitStatus) {
    const t = now.getTime();
    const ms = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).getTime() : NaN);
    if (overallEnd && ms(overallEnd) < t) status = 'completed';
    else if (recruitmentEnd && ms(recruitmentEnd) < t) status = 'active_not_recruiting';
    else if (recruitmentStart) status = activeStatusByDate(recruitmentStart, now);
    statusRaw = 'derived:dates';
  }

  // Secondary ids
  const externalRefs = xmlBlocks(trialBlock, 'externalRefs')[0] ?? '';
  const secondaryIds = uniq([
    ...compact([xmlFirst(externalRefs, 'clinicalTrialsGovNumber'), xmlFirst(externalRefs, 'eudraCTNumber')]),
    ...xmlElements(externalRefs, 'secondaryNumber').map(el => attrOf(el, 'canonicalSecondaryNumber')).filter((s): s is string => !!s),
    ...xmlAll(externalRefs, 'secondaryNumber'),
    ...extractSecondaryIds(externalRefs),
  ]).filter(s => s && !/^ISRCTN\d{8}$/i.test(s) && s.replace(/\D/g, '') !== digits);

  const studyDesign = xmlFirst(trialBlock, 'primaryStudyDesign');

  return {
    registry: 'isrctn',
    registry_id: digits,
    secondary_ids: secondaryIds,
    title: xmlFirst(description, 'scientificTitle') ?? xmlFirst(description, 'title'),
    sponsor_name: sponsorName,
    sponsor_type: sponsorClass,
    collaborators,
    interventions,
    conditions,
    phase_raw: phaseRaw,
    phase: mapRegistryPhase(phaseRaw),
    status_raw: statusRaw,
    status,
    study_type: studyDesign ? (/interven/i.test(studyDesign) ? 'interventional' : /observ/i.test(studyDesign) ? 'observational' : studyDesign.toLowerCase()) : null,
    countries: toIso2List(xmlAll(xmlBlocks(trialBlock, 'recruitmentCountries')[0] ?? '', 'country')),
    start_date: recruitmentStart,
    primary_completion_date: overallEnd ?? recruitmentEnd,
    first_registered: normalizeRegistryDate(xmlAttr(trialBlock, 'isrctn', 'dateAssigned')),
    last_updated: normalizeRegistryDate(attrOf(trialOpen, 'lastUpdated')),
    source_url: `https://www.isrctn.com/ISRCTN${digits}`,
    raw: {
      format: 'isrctn_xml',
      sponsor_reassigned_from_funder: sponsorReassigned,
      sponsor_commercial_status: sponsorCommercial,
      xml: fullTrial.length > 60_000 ? fullTrial.slice(0, 60_000) : fullTrial,
    },
  };
}

async function queryWindow(startIso: string, endIso: string, limit: number, signal?: AbortSignal) {
  const q = `lastEdited GE ${startIso} AND lastEdited LT ${endIso}`;
  const url = `${API}?q=${encodeURIComponent(q)}&limit=${limit}`;
  const res = await registryFetch(url, { signal, timeoutMs: 45_000, headers: { Accept: 'application/xml' } });
  if (!res.ok) throw new Error(`ISRCTN ${res.status} for ${url}`);
  const xml = await res.text();
  const totalCount = Number(xmlAttr(xml, 'allTrials', 'totalCount') ?? '0');
  const fullTrials = xmlBlocks(xml, 'fullTrial');
  return { totalCount, fullTrials, url };
}

export const isrctnAdapter: RegistryAdapter<string> = {
  registry: 'isrctn',
  displayName: 'ISRCTN registry',
  countryScope: ['GB'],
  license: 'CC BY 4.0 (attribution: ISRCTN registry)',
  capability: 'api',
  transport: 'xml',
  verified: 'verified',
  rateLimitMs: 1000,
  defaultLimit: 1000,
  estimatedReach: 28_700,
  urls: {
    search: 'https://www.isrctn.com/search',
    detail: id => `https://www.isrctn.com/ISRCTN${id.replace(/^ISRCTN/i, '')}`,
  },

  mapRecord(raw: string): RegistryRecord {
    return mapIsrctnFullTrial(raw);
  },

  /**
   * Cursor: ISO datetime (no millis) lower bound of the next lastEdited
   * window. First run starts at `opts.since` or 2000-01-01.
   */
  async fetchPage(cursor: string | null, opts: FetchPageOptions): Promise<FetchPageResult> {
    const limit = Math.min(opts.limit ?? MAX_LIMIT, MAX_LIMIT);
    const now = new Date();
    const start = new Date(cursor ?? (opts.since ? `${opts.since}T00:00:00Z` : '2000-01-01T00:00:00Z'));
    if (Number.isNaN(start.getTime())) throw new Error(`ISRCTN bad cursor ${cursor}`);
    if (start.getTime() >= now.getTime()) {
      return { records: [], nextCursor: isoNoMillis(start), done: true };
    }

    let windowMs = DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const warnings: string[] = [];
    for (let attempt = 0; attempt < 10; attempt++) {
      const end = new Date(Math.min(start.getTime() + windowMs, now.getTime()));
      const { totalCount, fullTrials } = await queryWindow(isoNoMillis(start), isoNoMillis(end), limit, opts.signal);
      if (totalCount > fullTrials.length && windowMs > MIN_WINDOW_MS) {
        windowMs = Math.max(MIN_WINDOW_MS, Math.floor(windowMs / 2));
        continue;
      }
      if (totalCount > fullTrials.length) {
        warnings.push(`ISRCTN window ${isoNoMillis(start)}..${isoNoMillis(end)} has ${totalCount} trials, only ${fullTrials.length} returned`);
      }
      const records: RegistryRecord[] = [];
      for (const ft of fullTrials) {
        try {
          const rec = mapIsrctnFullTrial(ft, now);
          if (rec.registry_id) records.push(rec);
        } catch (err) {
          warnings.push(`ISRCTN map error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      const done = end.getTime() >= now.getTime();
      return { records, nextCursor: isoNoMillis(end), done, warnings };
    }
    throw new Error('ISRCTN window narrowing exhausted');
  },
};

export default isrctnAdapter;
