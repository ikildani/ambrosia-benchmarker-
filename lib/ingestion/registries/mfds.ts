/**
 * MFDS — Korea Ministry of Food and Drug Safety clinical trial (IND) approvals,
 * via the data.go.kr OpenAPI. This is the authoritative list of every drug
 * trial approved to run in Korea (industry-sponsored INDs), including the
 * sponsor, product and phase — the fields Radar needs for Korean assets.
 *
 * Endpoint   GET https://apis.data.go.kr/1471000/ClncExamPlanDtlService2/getClncExamPlanDtlInq2
 *              ?serviceKey={MFDS_API_KEY}&type=json&pageNo={n}&numOfRows=100
 *            ("식품의약품안전처_의약품 임상시험 승인 정보" — verified Sep 2026 that the path is live:
 *            it answers SERVICE_KEY_IS_NOT_REGISTERED_ERROR (code 30) without a key.)
 *            Standard data.go.kr envelope:
 *              {"header":{"resultCode":"00","resultMsg":"NORMAL SERVICE."},
 *               "body":{"pageNo":1,"totalCount":N,"numOfRows":100,"items":[{…}]}}
 *            (older services wrap as body.items.item[]; both are handled).
 *            Item fields (from the service spec; unverified without a key, so several
 *            spellings are tried): CLINIC_EXAM_TITLE (title), APPLY_ENTP_NAME (sponsor),
 *            GOODS_NAME (product), LAB_NAME (sites), APPROVAL_TIME (approval date),
 *            CLINIC_STEP_NAME (phase: "1상", "2상", "3상", "1/2상", "연구자임상"),
 *            APPROVAL_NO / CLNC_TEST_SN (approval number → registry_id).
 * Auth       MFDS_API_KEY (data.go.kr personal service key; the "Decoding" key). Free,
 *            1,000 calls/day by default (raise via the data.go.kr portal).
 * License    KOGL Type 1 (attribution).
 * Reach      ~10,000 approvals since 2011; ~700 new IND approvals per year, >85% industry.
 * Status     MFDS publishes approvals, not recruitment status. status_raw='MFDS approval';
 *            status is derived from approval age (<30 d not_yet_recruiting, <3 y recruiting,
 *            else unknown).
 */

import type { FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryRecord } from './types';
import { RegistryUnavailableError } from './types';
import {
  classifySponsorClass,
  compact,
  makeIntervention,
  mapRegistryPhase,
  normalizeRegistryDate,
  registryFetch,
  splitList,
} from './shared';

const ENDPOINT = () =>
  process.env.MFDS_API_URL ?? 'https://apis.data.go.kr/1471000/ClncExamPlanDtlService2/getClncExamPlanDtlInq2';
const PAGE_SIZE = 100;

export type MfdsItem = Record<string, unknown>;

function pick(item: MfdsItem, keys: string[]): string | null {
  for (const k of keys) {
    const v = item[k];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `h${(h >>> 0).toString(16)}`;
}

export function mapMfdsItem(item: MfdsItem, now = new Date()): RegistryRecord {
  const title = pick(item, ['CLINIC_EXAM_TITLE', 'CLNC_TEST_NM', 'TITLE', 'clinicExamTitle']);
  const sponsor = pick(item, ['APPLY_ENTP_NAME', 'ENTP_NAME', 'APPLICANT', 'applyEntpName']);
  const product = pick(item, ['GOODS_NAME', 'PRDT_NM', 'PRODUCT_NAME', 'goodsName']);
  const approval = pick(item, ['APPROVAL_TIME', 'APPRVL_DT', 'APPROVAL_DATE', 'approvalTime']);
  const phaseRaw = pick(item, ['CLINIC_STEP_NAME', 'CLNC_STEP_NM', 'PHASE', 'clinicStepName']);
  const sites = pick(item, ['LAB_NAME', 'SITE_NAME', 'labName']);
  const approvalNo = pick(item, ['APPROVAL_NO', 'CLNC_TEST_SN', 'APPRVL_NO', 'SEQ', 'approvalNo']);
  const protocolNo = pick(item, ['PROTOCOL_CODE', 'PROTOCOL_NO', 'protocolCode']);

  const approvalDate = normalizeRegistryDate(approval) ?? normalizeRegistryDate(approval?.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'));
  const registryId = approvalNo ?? hashId(`${title ?? ''}|${sponsor ?? ''}|${approvalDate ?? ''}`);
  const ageDays = approvalDate ? (now.getTime() - new Date(`${approvalDate}T00:00:00Z`).getTime()) / 86_400_000 : NaN;
  const status = Number.isNaN(ageDays) ? 'unknown' : ageDays < 30 ? 'not_yet_recruiting' : ageDays < 3 * 365 ? 'recruiting' : 'unknown';

  const interventions = compact(product ? splitList(product) : [])
    .map(n => makeIntervention(n, 'drug', 'experimental'))
    .filter((i): i is NonNullable<typeof i> => !!i);

  const isInvestigatorTrial = phaseRaw ? /연구자/.test(phaseRaw) : false;

  return {
    registry: 'mfds',
    registry_id: registryId,
    secondary_ids: compact([protocolNo]),
    title,
    sponsor_name: sponsor,
    sponsor_type: classifySponsorClass(sponsor, isInvestigatorTrial ? 'investigator' : 'company'),
    collaborators: [],
    interventions,
    conditions: [],
    phase_raw: phaseRaw,
    phase: isInvestigatorTrial && !/\d/.test(phaseRaw ?? '') ? 'unknown' : mapRegistryPhase(phaseRaw),
    status_raw: 'MFDS approval',
    status,
    study_type: 'interventional',
    countries: ['KR'],
    start_date: approvalDate,
    primary_completion_date: null,
    first_registered: approvalDate,
    last_updated: approvalDate,
    source_url: 'https://nedrug.mfds.go.kr/searchClinic',
    raw: { format: 'mfds_json', item, sites },
  };
}

function serviceKeyParam(key: string): string {
  // data.go.kr issues an "Encoding" key (already percent-encoded) and a "Decoding" key.
  return /%[0-9A-Fa-f]{2}/.test(key) ? key : encodeURIComponent(key);
}

export const mfdsAdapter: RegistryAdapter<MfdsItem> = {
  registry: 'mfds',
  displayName: 'MFDS clinical trial approvals (Korea)',
  countryScope: ['KR'],
  license: 'KOGL Type 1 (attribution)',
  capability: 'api',
  transport: 'json',
  verified: 'partial',
  rateLimitMs: 200,
  defaultLimit: PAGE_SIZE,
  estimatedReach: 10_000,
  requiredEnv: ['MFDS_API_KEY'],
  urls: {
    search: 'https://nedrug.mfds.go.kr/searchClinic',
    detail: () => 'https://nedrug.mfds.go.kr/searchClinic',
  },

  mapRecord(raw: MfdsItem): RegistryRecord {
    return mapMfdsItem(raw);
  },

  /** Cursor: page number. Pages newest-first (service default). */
  async fetchPage(cursor: string | null, opts: FetchPageOptions): Promise<FetchPageResult> {
    const key = process.env.MFDS_API_KEY;
    if (!key) throw new RegistryUnavailableError('mfds', 'MFDS_API_KEY not set');
    const page = Math.max(1, Number(cursor ?? '1') || 1);
    const rows = Math.min(opts.limit ?? PAGE_SIZE, PAGE_SIZE);
    const url = `${ENDPOINT()}?serviceKey=${serviceKeyParam(key)}&type=json&pageNo=${page}&numOfRows=${rows}`;
    const res = await registryFetch(url, { signal: opts.signal, timeoutMs: 30_000, headers: { Accept: 'application/json' } });
    const text = await res.text();
    if (!res.ok) throw new RegistryUnavailableError('mfds', `HTTP ${res.status}: ${text.slice(0, 200)}`);
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`MFDS non-JSON response: ${text.slice(0, 200)}`);
    }
    const envelope = json.OpenAPI_ServiceResponse as Record<string, unknown> | undefined;
    if (envelope) {
      const hdr = (envelope.cmmMsgHeader ?? {}) as Record<string, unknown>;
      throw new RegistryUnavailableError('mfds', `${hdr.errMsg ?? 'gateway error'} (${hdr.returnReasonCode ?? '?'})`);
    }
    const header = (json.header ?? {}) as Record<string, unknown>;
    if (header.resultCode && String(header.resultCode) !== '00') {
      throw new Error(`MFDS resultCode ${header.resultCode}: ${header.resultMsg ?? ''}`);
    }
    const body = (json.body ?? json) as Record<string, unknown>;
    const itemsRaw = body.items;
    const items: MfdsItem[] = Array.isArray(itemsRaw)
      ? (itemsRaw as MfdsItem[])
      : itemsRaw && typeof itemsRaw === 'object' && Array.isArray((itemsRaw as Record<string, unknown>).item)
        ? ((itemsRaw as Record<string, unknown>).item as MfdsItem[])
        : [];
    const total = Number(body.totalCount ?? 0);
    const records = items.map(i => mapMfdsItem(i));
    const since = opts.since ? normalizeRegistryDate(opts.since) : null;
    const allBeforeSince = since !== null && records.length > 0 && records.every(r => (r.first_registered ?? '') < since);
    const done = records.length === 0 || page * rows >= total || allBeforeSince;
    return { records, nextCursor: done ? null : String(page + 1), done };
  },
};

export default mfdsAdapter;
