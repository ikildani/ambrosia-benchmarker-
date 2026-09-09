/**
 * ANZCTR — Australian New Zealand Clinical Trials Registry.
 *
 * Endpoint   https://api.anzctr.org.au/WebServices/AnzctrWebservices.asmx (ASP.NET ASMX;
 *            SOAP 1.1/1.2 and HTTP-GET bindings; WSDL at ?WSDL — verified reachable Sep 2026).
 *            Operations: AnzctrTrialSearch(searchText, purposeOfStudy, recruitmentStatus, phase,
 *              ethicsApproval, gender, healthyVolunteers, healthConditions, recruitmentSites,
 *              ageGroup, recruitmentCountries, studyType, conditionCategory, conditionCode,
 *              interventionCode, paging:int, pageNumber:int, getActrnOnly:bool) → XML string;
 *            AnzctrTrialDetailsV2(ids: "ACTRN…,ACTRN…", version:int) → XML string;
 *            AnzctrCtGovTrialSearch (same params, includes CT.gov mirror), GetPhases,
 *            GetRecruitmentStatuses, GetRecruitmentCountries, GetInterventionCodes.
 *            HTTP-GET form: …/AnzctrWebservices.asmx/AnzctrTrialSearch?searchText=…&…&paging=1&pageNumber=1&getActrnOnly=true
 *            (every parameter must be present; ints/bools must parse).
 *            Verification result: the service answers "Search Exception ---> User Unauthorised"
 *            for anonymous callers, so access is by arrangement with ANZCTR
 *            (info@anzctr.org.au). This adapter sends HTTP Basic credentials from
 *            ANZCTR_API_USER / ANZCTR_API_PASSWORD and skips when they are missing.
 *            The public site (www.anzctr.org.au/TrialSearch.aspx, /Trial/Registration/
 *            TrialReview.aspx?id=) is behind Cloudflare and returns 403 to non-browser
 *            clients, so there is no scrape fallback from Vercel.
 * XML fields (ANZCTR XML export format, unverified for the web service payload):
 *   <ANZCTR_Trial><actrn>, <stage>, <submitdate>, <approvaldate>, <dateLastUpdated>,
 *   <utrn>, <publictitle>, <scientifictitle>, <secondaryid>, <trialacronym>,
 *   <conditions><condition><conditionname>, <interventions><intervention>
 *   <interventiondescription>, <interventioncode>, <phase>, <studytype>,
 *   <recruitmentstatus>, <anticipatedstartdate>, <actualstartdate>, <anticipatedenddate>,
 *   <actualenddate>, <recruitmentcountry>, <sponsorship><primarysponsortype>,
 *   <primarysponsorname>, <fundingsourcetype>, <fundingsourcename>, <secondarysponsorname>
 * License    ANZCTR data policy: free for non-commercial use; commercial use requires
 *            written permission (https://www.anzctr.org.au/Support/Legal.aspx).
 * Reach      ~26,000 trials (AU+NZ); ~3,000 industry-sponsored drug trials, most of which
 *            are also on CT.gov (NCT bridge).
 */

import type { FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryRecord, RegistryIntervention } from './types';
import { RegistryUnavailableError } from './types';
import {
  classifySponsorClass,
  compact,
  decodeEntities,
  extractSecondaryIds,
  makeIntervention,
  mapRegistryPhase,
  mapRegistryStatus,
  normalizeRegistryDate,
  registryFetch,
  sleep,
  toIso2List,
  uniq,
  xmlAll,
  xmlBlocks,
  xmlFirst,
} from './shared';

const BASE = () => process.env.ANZCTR_API_URL ?? 'https://api.anzctr.org.au/WebServices/AnzctrWebservices.asmx';
const SEARCH_PARAMS = [
  'searchText', 'purposeOfStudy', 'recruitmentStatus', 'phase', 'ethicsApproval', 'gender', 'healthyVolunteers',
  'healthConditions', 'recruitmentSites', 'ageGroup', 'recruitmentCountries', 'studyType', 'conditionCategory',
  'conditionCode', 'interventionCode',
];
const DETAIL_BATCH = 20;

export interface AnzctrRaw {
  actrn: string;
  xml: string;
}

export function mapAnzctrXml(raw: AnzctrRaw): RegistryRecord {
  const xml = raw.xml;
  const actrn = xmlFirst(xml, 'actrn') ?? raw.actrn;
  const sponsor = xmlFirst(xml, 'primarysponsorname');
  const sponsorType = xmlFirst(xml, 'primarysponsortype');
  const interventions: RegistryIntervention[] = [];
  for (const block of xmlBlocks(xml, 'intervention')) {
    const desc = xmlFirst(block, 'interventiondescription') ?? xmlFirst(block, 'description');
    const code = xmlFirst(block, 'interventioncode') ?? xmlFirst(xml, 'interventioncode') ?? 'unknown';
    const iv = makeIntervention(desc ? desc.slice(0, 160) : null, /treatment: drugs|drug/i.test(code) ? 'drug' : code, 'experimental');
    if (iv) interventions.push(iv);
  }
  if (interventions.length === 0) {
    const code = xmlFirst(xml, 'interventioncode') ?? 'unknown';
    const desc = xmlFirst(xml, 'interventiondescription');
    const iv = makeIntervention(desc ? desc.slice(0, 160) : null, /drug/i.test(code) ? 'drug' : code, 'experimental');
    if (iv) interventions.push(iv);
  }
  const phaseRaw = xmlFirst(xml, 'phase');
  const statusRaw = xmlFirst(xml, 'recruitmentstatus');
  const studyTypeRaw = xmlFirst(xml, 'studytype');
  const countries = toIso2List([...xmlAll(xml, 'recruitmentcountry'), ...xmlAll(xml, 'country')]);
  const secondaryIds = uniq([
    ...xmlAll(xml, 'secondaryid'),
    ...compact([xmlFirst(xml, 'utrn')]),
    ...extractSecondaryIds(xml),
  ]).filter(s => s !== actrn);

  return {
    registry: 'anzctr',
    registry_id: actrn,
    secondary_ids: secondaryIds,
    title: xmlFirst(xml, 'scientifictitle') ?? xmlFirst(xml, 'publictitle'),
    sponsor_name: sponsor,
    sponsor_type: classifySponsorClass(sponsor, sponsorType),
    collaborators: compact([...xmlAll(xml, 'secondarysponsorname'), ...xmlAll(xml, 'fundingsourcename')]).filter(c => c !== sponsor),
    interventions,
    conditions: compact(xmlAll(xml, 'conditionname')).slice(0, 20),
    phase_raw: phaseRaw,
    phase: mapRegistryPhase(phaseRaw),
    status_raw: statusRaw,
    status: mapRegistryStatus(statusRaw),
    study_type: studyTypeRaw ? (/interven/i.test(studyTypeRaw) ? 'interventional' : /observ/i.test(studyTypeRaw) ? 'observational' : studyTypeRaw.toLowerCase()) : null,
    countries: countries.length > 0 ? countries : ['AU'],
    start_date: normalizeRegistryDate(xmlFirst(xml, 'actualstartdate')) ?? normalizeRegistryDate(xmlFirst(xml, 'anticipatedstartdate')),
    primary_completion_date: normalizeRegistryDate(xmlFirst(xml, 'actualenddate')) ?? normalizeRegistryDate(xmlFirst(xml, 'anticipatedenddate')),
    first_registered: normalizeRegistryDate(xmlFirst(xml, 'approvaldate')) ?? normalizeRegistryDate(xmlFirst(xml, 'submitdate')),
    last_updated: normalizeRegistryDate(xmlFirst(xml, 'datelastupdated')) ?? normalizeRegistryDate(xmlFirst(xml, 'dateLastUpdated')),
    source_url: `https://www.anzctr.org.au/${actrn}.aspx`,
    raw: { format: 'anzctr_xml', xml: xml.length > 60_000 ? xml.slice(0, 60_000) : xml },
  };
}

function authHeaders(): Record<string, string> {
  const user = process.env.ANZCTR_API_USER;
  const pass = process.env.ANZCTR_API_PASSWORD;
  if (!user || !pass) throw new RegistryUnavailableError('anzctr', 'ANZCTR_API_USER / ANZCTR_API_PASSWORD not set (service answers "User Unauthorised" anonymously)');
  return { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` };
}

/** ASMX HTTP-GET responses wrap the payload as <string>…escaped xml…</string>. */
function unwrapAsmxString(body: string): string {
  const inner = xmlBlocks(body, 'string')[0];
  return inner ? decodeEntities(inner) : body;
}

export async function anzctrSearchActrns(pageNumber: number, signal?: AbortSignal): Promise<string[]> {
  const qs = SEARCH_PARAMS.map(p => `${p}=`).join('&') + `&paging=1&pageNumber=${pageNumber}&getActrnOnly=true`;
  const res = await registryFetch(`${BASE()}/AnzctrTrialSearch?${qs}`, { signal, timeoutMs: 45_000, headers: authHeaders() });
  const text = await res.text();
  if (!res.ok) throw new RegistryUnavailableError('anzctr', `HTTP ${res.status}: ${text.slice(0, 160)}`);
  const payload = unwrapAsmxString(text);
  const ids = new Set<string>();
  const re = /ACTRN\d{14}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(payload)) !== null) ids.add(m[0]);
  return Array.from(ids);
}

export async function anzctrDetails(ids: string[], signal?: AbortSignal): Promise<AnzctrRaw[]> {
  const res = await registryFetch(`${BASE()}/AnzctrTrialDetailsV2?ids=${encodeURIComponent(ids.join(','))}&version=1`, { signal, timeoutMs: 60_000, headers: authHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(`ANZCTR details HTTP ${res.status}: ${text.slice(0, 160)}`);
  const payload = unwrapAsmxString(text);
  const blocks = xmlBlocks(payload, 'ANZCTR_Trial');
  if (blocks.length === 0) return ids.map(actrn => ({ actrn, xml: payload }));
  return blocks.map(b => ({ actrn: xmlFirst(b, 'actrn') ?? '', xml: b })).filter(b => b.actrn);
}

export const anzctrAdapter: RegistryAdapter<AnzctrRaw> = {
  registry: 'anzctr',
  displayName: 'ANZCTR (Australia / New Zealand)',
  countryScope: ['AU', 'NZ'],
  license: 'ANZCTR data policy: non-commercial free; commercial use by written permission',
  capability: 'api',
  transport: 'soap',
  verified: 'partial',
  rateLimitMs: 1000,
  defaultLimit: 40,
  estimatedReach: 26_000,
  requiredEnv: ['ANZCTR_API_USER', 'ANZCTR_API_PASSWORD'],
  urls: {
    search: 'https://www.anzctr.org.au/TrialSearch.aspx',
    detail: id => `https://www.anzctr.org.au/${id}.aspx`,
  },

  mapRecord(raw: AnzctrRaw): RegistryRecord {
    return mapAnzctrXml(raw);
  },

  /** Cursor: search page number. */
  async fetchPage(cursor: string | null, opts: FetchPageOptions): Promise<FetchPageResult> {
    const page = Math.max(1, Number(cursor ?? '1') || 1);
    const ids = await anzctrSearchActrns(page, opts.signal);
    const limit = Math.min(opts.limit ?? this.defaultLimit, 200);
    const warnings: string[] = [];
    const records: RegistryRecord[] = [];
    for (let i = 0; i < Math.min(ids.length, limit); i += DETAIL_BATCH) {
      const batch = ids.slice(i, i + DETAIL_BATCH);
      try {
        for (const raw of await anzctrDetails(batch, opts.signal)) records.push(mapAnzctrXml(raw));
      } catch (err) {
        warnings.push(`ANZCTR details ${batch[0]}…: ${err instanceof Error ? err.message : String(err)}`);
      }
      await sleep(this.rateLimitMs);
    }
    const done = ids.length === 0;
    return { records, nextCursor: done ? null : String(page + 1), done, warnings };
  },
};

export default anzctrAdapter;
