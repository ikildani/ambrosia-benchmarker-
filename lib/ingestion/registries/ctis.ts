/**
 * EU Clinical Trials Information System (CTIS) adapter — every EU/EEA
 * medicinal-product trial since Jan 2023 (mandatory since Jan 2025; legacy
 * EudraCT trials were transitioned by Jan 2025 or ended).
 *
 * Endpoints (the public portal's own JSON API; no auth, no published limit):
 *   POST https://euclinicaltrials.eu/ctis-public-api/search
 *        Content-Type: application/json
 *        {"pagination":{"page":1,"size":100},
 *         "sort":{"property":"decisionDate","direction":"DESC"},
 *         "searchCriteria":{"containAll":"","containAny":"","containNot":""}}
 *        → {"pagination":{"totalRecords":12384,"currentPage":1,"totalPages":124,"nextPage":true},
 *           "data":[{ctNumber, ctStatus (int), ctTitle, shortTitle, conditions, trialCountries
 *                    ["France:2"], decisionDateOverall "08/09/2026", decisionDate "FR: 08/09/2026",
 *                    therapeuticAreas[], sponsor, sponsorType, trialPhase (text), product
 *                    (comma list), lastUpdated "08/09/2026", lastPublicationUpdate, trialRegion, …}]}
 *        Verified Sep 2026: size up to 100 works; searchCriteria.trialPhaseCode:[6] and
 *        containAll filter; decisionDateFrom/lastUpdatedFrom/sponsorType are IGNORED and
 *        sort.property other than decisionDate is IGNORED. Incremental reads therefore page
 *        decisionDate DESC and stop once decisionDateOverall < since.
 *   GET  https://euclinicaltrials.eu/ctis-public-api/retrieve/{ctNumber}
 *        → full public record: ctStatus text, ctPublicStatusCode, decisionDate, publishDate,
 *          authorizedApplication.authorizedPartI.{sponsors[].organisation{name,type,typeCode},
 *          sponsors[].isCommercial, sponsors[].addresses[].address.country (ISO numeric),
 *          products[]{productName, jsonActiveSubstanceNames, mpRoleInTrial, part1MpRoleTypeCode},
 *          medicalConditions[].medicalCondition, therapeuticAreas[].name,
 *          trialDetails.clinicalTrialIdentifiers.{fullTitle,publicTitle,secondaryIdentifyingNumbers.additionalRegistries[]},
 *          trialDetails.trialInformation.{trialCategory.trialPhase (code), trialDuration.{estimatedRecruitmentStartDate,estimatedEndDate}}},
 *          authorizedApplication.memberStatesConcerned[].mscName,
 *          authorizedApplication.authorizedPartsII[].mscInfo.{countryName,trialStatus}, eudraCt
 * Phase codes (calibrated against the search text, Sep 2026):
 *   1 Phase I first-in-human, 2 Phase I bioequivalence, 3 Phase I other, 4 Phase II,
 *   5 Phase III, 6 Phase IV, 7 Phase I/II first-in-human, 9 Phase I/II other
 *   (8 = Phase I/II bioequivalence, 10–12 = Phase II/III variants: assumed, unverified).
 * Status codes seen in search hits: 2 Authorised, 11 Not authorised; 3 and 4 also
 *   return ctStatus "Authorised" from retrieve (assumed sub-states). Text from
 *   retrieve/partsII is used for mapping; codes are kept in raw.
 * Product role (mpRoleInTrial): 1 test → experimental, 2 comparator, 3 auxiliary → background,
 *   4 placebo (assumed from CTIS data model, unverified).
 * License   EMA public data; reuse permitted with source attribution
 *           (https://euclinicaltrials.eu/about-this-website — "Legal notice").
 * Reach     12,384 trials (Sep 2026), ~60% pharmaceutical-company sponsored. All are drug trials.
 * Rate      we use 300 ms between calls; retrieves are the expensive part (~120 KB each).
 */

import type { FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryRecord, RegistryIntervention, InterventionRole, CompanyTrialStatus } from './types';
import {
  activeStatusByDate,
  classifySponsorClass,
  compact,
  extractSecondaryIds,
  makeIntervention,
  mapRegistryPhase,
  mapRegistryStatus,
  normalizeRegistryDate,
  registryFetch,
  sleep,
  splitList,
  toIso2,
  toIso2List,
  uniq,
} from './shared';

const SEARCH_URL = 'https://euclinicaltrials.eu/ctis-public-api/search';
const RETRIEVE_URL = 'https://euclinicaltrials.eu/ctis-public-api/retrieve/';
const PAGE_SIZE = 100;
const CTIS_PHASE_CODES: Record<string, string> = {
  '1': 'Phase I', '2': 'Phase I', '3': 'Phase I', '4': 'Phase II', '5': 'Phase III', '6': 'Phase IV',
  '7': 'Phase I/II', '8': 'Phase I/II', '9': 'Phase I/II', '10': 'Phase II/III', '11': 'Phase II/III', '12': 'Phase II/III',
};
const ROLE_CODES: Record<string, InterventionRole> = { '1': 'experimental', '2': 'comparator', '3': 'background', '4': 'placebo' };

export interface CtisSearchHit {
  ctNumber: string;
  ctStatus?: number | string | null;
  ctTitle?: string | null;
  shortTitle?: string | null;
  conditions?: string | null;
  trialCountries?: string[] | null;
  decisionDateOverall?: string | null;
  decisionDate?: string | null;
  therapeuticAreas?: string[] | null;
  sponsor?: string | null;
  sponsorType?: string | null;
  trialPhase?: string | null;
  product?: string | null;
  lastUpdated?: string | null;
  lastPublicationUpdate?: string | null;
  [k: string]: unknown;
}

export interface CtisRaw {
  hit: CtisSearchHit;
  detail?: Record<string, unknown> | null;
}

type AnyRec = Record<string, unknown>;
const rec = (v: unknown): AnyRec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as AnyRec) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);

export function mapCtisRecord(raw: CtisRaw, now = new Date()): RegistryRecord {
  const { hit } = raw;
  const detail = rec(raw.detail);
  const app = rec(detail.authorizedApplication);
  const partI = rec(app.authorizedPartI);
  const trialDetails = rec(partI.trialDetails);
  const identifiers = rec(trialDetails.clinicalTrialIdentifiers);
  const info = rec(trialDetails.trialInformation);
  const category = rec(info.trialCategory);
  const duration = rec(info.trialDuration);

  // Sponsor
  const sponsors = arr(partI.sponsors).map(rec);
  const primary = sponsors.find(s => s.primary === true) ?? sponsors[0] ?? {};
  const primaryOrg = rec(primary.organisation);
  const sponsorName = str(primaryOrg.name) ?? str(hit.sponsor);
  const sponsorHint = str(primaryOrg.type) ?? str(hit.sponsorType);
  const isCommercial = primary.isCommercial === true || primaryOrg.commercial === true;
  const sponsorClass = classifySponsorClass(sponsorName, isCommercial ? 'commercial' : sponsorHint);
  const sponsorCountry = arr(primary.addresses)
    .map(a => rec(rec(a).address).country)
    .map(c => toIso2(typeof c === 'number' ? c : str(c)))
    .find((c): c is string => !!c) ?? null;
  const collaborators = compact(
    sponsors.filter(s => s !== primary).map(s => str(rec(s.organisation).name)),
  );

  // Products / interventions
  const interventions: RegistryIntervention[] = [];
  for (const p of arr(partI.products).map(rec)) {
    const dict = rec(p.productDictionaryInfo);
    const name = str(p.productName) ?? str(dict.prodName) ?? str(p.jsonActiveSubstanceNames) ?? str(dict.activeSubstanceName);
    const role = ROLE_CODES[String(p.mpRoleInTrial ?? '')] ?? 'unknown';
    const iv = makeIntervention(name, 'drug', role);
    if (iv) interventions.push(iv);
  }
  if (interventions.length === 0 && hit.product) {
    for (const n of splitList(hit.product)) {
      const iv = makeIntervention(n, 'drug', 'unknown');
      if (iv) interventions.push(iv);
    }
  }

  // Conditions
  const conditions = compact([
    ...arr(partI.medicalConditions).map(m => str(rec(m).medicalCondition)),
    ...arr(partI.therapeuticAreas).map(t => str(rec(t).name)),
    ...(hit.conditions ? [hit.conditions] : []),
    ...(hit.therapeuticAreas ?? []),
  ]).map(c => c.slice(0, 200)).slice(0, 20);

  // Phase
  const phaseCode = str(category.trialPhase);
  const phaseRaw = str(hit.trialPhase) ?? (phaseCode ? CTIS_PHASE_CODES[phaseCode] ?? `code:${phaseCode}` : null);

  // Status: prefer retrieve text; if every member state says Ended → completed.
  const startDate = normalizeRegistryDate(str(duration.estimatedRecruitmentStartDate));
  const partsII = arr(app.authorizedPartsII).map(rec);
  const mscStatuses = compact(partsII.map(p => str(rec(p.mscInfo).trialStatus)));
  const statusText = str(detail.ctStatus) ?? (typeof hit.ctStatus === 'string' ? hit.ctStatus : null);
  let status: CompanyTrialStatus;
  let statusRaw: string | null = statusText ?? (hit.ctStatus != null ? `code:${hit.ctStatus}` : null);
  if (mscStatuses.length > 0 && mscStatuses.every(s => /ended|completed/i.test(s))) {
    status = 'completed';
    statusRaw = `Ended (all MSC)`;
  } else if (mscStatuses.some(s => /revoked|suspended|halted/i.test(s)) && !mscStatuses.some(s => /^authorised$|ongoing|recruiting/i.test(s))) {
    status = mapRegistryStatus(mscStatuses.find(s => /revoked|suspended|halted/i.test(s)) ?? null);
  } else if (statusText && /^authori[sz]ed$/i.test(statusText)) {
    status = activeStatusByDate(startDate, now);
  } else if (statusText) {
    status = mapRegistryStatus(statusText);
  } else {
    const code = Number(hit.ctStatus);
    status = code === 11 ? 'withdrawn' : code === 2 ? activeStatusByDate(startDate, now) : 'unknown';
  }

  // Countries
  const mscNames = arr(app.memberStatesConcerned).map(m => str(rec(m).mscName));
  const partIICountries = partsII.map(p => str(rec(p.mscInfo).countryName));
  const hitCountries = (hit.trialCountries ?? []).map(c => c.replace(/:\s*\d+$/, ''));
  const countries = toIso2List([...mscNames, ...partIICountries, ...hitCountries]);

  // Secondary ids (EudraCT, NCT etc. from additionalRegistries)
  const secondaryIds = uniq([
    ...compact([str(detail.eudraCt), str(partI.eudraCt)]),
    ...extractSecondaryIds(JSON.stringify(rec(identifiers.secondaryIdentifyingNumbers))),
  ]).filter(s => s !== hit.ctNumber);

  const decisionDate = normalizeRegistryDate(str(detail.decisionDate)) ?? normalizeRegistryDate(hit.decisionDateOverall);
  const submission = arr(app.applicationInfo).map(a => str(rec(a).submissionDate)).find(Boolean) ?? null;

  return {
    registry: 'ctis',
    registry_id: hit.ctNumber,
    secondary_ids: secondaryIds,
    title: str(identifiers.fullTitle) ?? str(hit.ctTitle) ?? str(identifiers.publicTitle) ?? str(hit.shortTitle),
    sponsor_name: sponsorName,
    sponsor_type: sponsorClass,
    collaborators,
    interventions,
    conditions,
    phase_raw: phaseRaw,
    phase: mapRegistryPhase(phaseRaw),
    status_raw: statusRaw,
    status,
    study_type: 'interventional',
    countries,
    start_date: startDate,
    primary_completion_date: normalizeRegistryDate(str(duration.estimatedEndDate) ?? str(duration.estimatedGlobalEndDate)),
    first_registered: normalizeRegistryDate(submission) ?? decisionDate,
    last_updated: normalizeRegistryDate(str(detail.publishDate)) ?? normalizeRegistryDate(hit.lastUpdated) ?? decisionDate,
    source_url: `https://euclinicaltrials.eu/ctis-public/view/${hit.ctNumber}`,
    raw: {
      format: 'ctis_json',
      hit,
      sponsor_country: sponsorCountry,
      phase_code: phaseCode,
      status_code: detail.ctPublicStatusCode ?? hit.ctStatus ?? null,
      msc_statuses: mscStatuses,
      detail_fetched: !!raw.detail,
    },
  };
}

export async function ctisSearch(page: number, size = PAGE_SIZE, signal?: AbortSignal, criteria: Record<string, unknown> = {}) {
  const body = {
    pagination: { page, size },
    sort: { property: 'decisionDate', direction: 'DESC' },
    searchCriteria: { containAll: '', containAny: '', containNot: '', ...criteria },
  };
  const res = await registryFetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal,
    timeoutMs: 45_000,
  });
  if (!res.ok) throw new Error(`CTIS search ${res.status}`);
  const json = (await res.json()) as { pagination?: { totalRecords?: number; totalPages?: number; nextPage?: boolean }; data?: CtisSearchHit[] };
  return { hits: json.data ?? [], pagination: json.pagination ?? {} };
}

export async function ctisRetrieve(ctNumber: string, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
  const res = await registryFetch(`${RETRIEVE_URL}${encodeURIComponent(ctNumber)}`, { signal, timeoutMs: 45_000, headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, unknown>;
  return json && typeof json === 'object' && Object.keys(json).length > 0 ? json : null;
}

interface CtisCursor {
  page: number;
  sweepStartedAt: string;
}

function parseCursor(cursor: string | null): CtisCursor {
  if (!cursor) return { page: 1, sweepStartedAt: new Date().toISOString() };
  try {
    const c = JSON.parse(cursor) as Partial<CtisCursor>;
    return { page: Math.max(1, Number(c.page) || 1), sweepStartedAt: c.sweepStartedAt ?? new Date().toISOString() };
  } catch {
    return { page: 1, sweepStartedAt: new Date().toISOString() };
  }
}

export const ctisAdapter: RegistryAdapter<CtisRaw> = {
  registry: 'ctis',
  displayName: 'EU CTIS',
  countryScope: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'],
  license: 'EMA public data, reuse with attribution (CTIS legal notice)',
  capability: 'api',
  transport: 'json',
  verified: 'verified',
  rateLimitMs: 300,
  defaultLimit: 25,
  estimatedReach: 12_400,
  urls: {
    search: 'https://euclinicaltrials.eu/search-for-clinical-trials',
    detail: id => `https://euclinicaltrials.eu/ctis-public/view/${id}`,
  },

  mapRecord(raw: CtisRaw): RegistryRecord {
    return mapCtisRecord(raw);
  },

  /**
   * Cursor: {"page":n,"sweepStartedAt":iso}. Pages decisionDate DESC, 100 hits
   * per search call, and retrieves up to `opts.limit` (default 25) full
   * records per call — the rest of the page is emitted from search-hit data
   * only (detail_fetched=false) so a full sweep still completes; the next
   * sweep re-reads them. When `opts.since` is set the sweep stops at the
   * first page whose decisions all pre-date it.
   */
  async fetchPage(cursor: string | null, opts: FetchPageOptions): Promise<FetchPageResult> {
    const c = parseCursor(cursor);
    const detailBudget = opts.limit ?? this.defaultLimit;
    const { hits, pagination } = await ctisSearch(c.page, PAGE_SIZE, opts.signal);
    const warnings: string[] = [];
    const since = opts.since ? normalizeRegistryDate(opts.since) : null;

    const records: RegistryRecord[] = [];
    let detailsFetched = 0;
    let allBeforeSince = since !== null && hits.length > 0;
    for (const hit of hits) {
      if (!hit?.ctNumber) continue;
      const decision = normalizeRegistryDate(hit.decisionDateOverall) ?? normalizeRegistryDate(hit.lastUpdated);
      if (since && decision && decision >= since) allBeforeSince = false;
      let detail: Record<string, unknown> | null = null;
      if (detailsFetched < detailBudget) {
        try {
          detail = await ctisRetrieve(hit.ctNumber, opts.signal);
          detailsFetched++;
          await sleep(this.rateLimitMs);
        } catch (err) {
          warnings.push(`CTIS retrieve ${hit.ctNumber}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      try {
        records.push(mapCtisRecord({ hit, detail }));
      } catch (err) {
        warnings.push(`CTIS map ${hit.ctNumber}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const hasNext = pagination.nextPage === true && hits.length > 0;
    const done = !hasNext || allBeforeSince;
    return {
      records,
      nextCursor: done ? null : JSON.stringify({ page: c.page + 1, sweepStartedAt: c.sweepStartedAt } satisfies CtisCursor),
      done,
      warnings,
    };
  },
};

export default ctisAdapter;
