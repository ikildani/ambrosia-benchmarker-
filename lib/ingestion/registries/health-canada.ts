/**
 * Health Canada Clinical Trials Database (CTA) adapter.
 *
 * Endpoints (documented at
 * https://health-products.canada.ca/api/documentation/cta-documentation-en.html;
 * no auth; JSON or XML via &type=):
 *   GET https://health-products.canada.ca/api/clinical-trial/protocol/?lang=en&type=json
 *       → [{protocol_id, protocol_no (sponsor protocol code), submission_no, status_id,
 *           start_date, end_date, nol_date (No Objection Letter = authorisation date),
 *           protocol_title, medConditionList[{med_condition}], studyPopulationList[]}]
 *       9,674 protocols, ~5.9 MB (verified Sep 2026). &id=<protocol_id> returns one.
 *   GET https://health-products.canada.ca/api/clinical-trial/drugproduct/?lang=en&type=json
 *       → [{protocol_id, submission_no, brand_id, manufacturer_id, manufacturer_name,
 *           brand_name}]  (~1.7 MB; the sponsor and the drug live here, one row per
 *           product; brand_name is often "SUVOREXANT (MK-4305)")
 *   GET https://health-products.canada.ca/api/clinical-trial/status/?lang=en&type=json
 *       → [{status_id:1,"ONGOING"},{2,"CLOSED"},{3,"PENDING"}]
 *   GET …/sponsor/?lang=en&type=json → [{manufacturer_id, manufacturer_name}]
 *   GET …/medicalcondition/?lang=en&type=json → [{med_condition_id, med_condition}]
 * There is no phase field: phase is parsed from protocol_title ("A PHASE IIA, …").
 * No last-updated field: incremental reads use nol_date (>= since).
 * License  Open Government Licence – Canada (https://open.canada.ca/en/open-government-licence-canada).
 * Reach    9,674 CTAs (all drug trials by construction: CTAs are only filed for drugs/biologics).
 *          ~4,500 ONGOING.
 * Note     The TLS chain of health-products.canada.ca failed verification with the
 *          local macOS curl CA bundle during verification (worked with -k); Node/Vercel
 *          use Mozilla's bundle. If fetch throws CERT errors on Vercel, set
 *          HEALTH_CANADA_BASE_URL to a proxy.
 */

import type { FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryRecord, RegistryIntervention } from './types';
import {
  activeStatusByDate,
  classifySponsorClass,
  compact,
  makeIntervention,
  mapRegistryPhase,
  normalizeRegistryDate,
  registryFetch,
  uniq,
} from './shared';

const BASE = () => process.env.HEALTH_CANADA_BASE_URL ?? 'https://health-products.canada.ca/api/clinical-trial';
const PAGE_LIMIT = 500;
const SNAPSHOT_TTL_MS = 15 * 60 * 1000;

export interface HcProtocol {
  protocol_id: number;
  protocol_no?: string | null;
  submission_no?: string | null;
  status_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  nol_date?: string | null;
  protocol_title?: string | null;
  medConditionList?: Array<{ med_condition_id?: number; med_condition?: string | null }> | null;
  studyPopulationList?: Array<{ study_population?: string | null }> | null;
}

export interface HcDrugProduct {
  protocol_id: number;
  submission_no?: string | null;
  brand_id?: number;
  manufacturer_id?: number;
  manufacturer_name?: string | null;
  brand_name?: string | null;
}

export interface HcRaw {
  protocol: HcProtocol;
  products: HcDrugProduct[];
  statusLabel?: string | null;
}

const STATUS_LABELS: Record<number, string> = { 1: 'ONGOING', 2: 'CLOSED', 3: 'PENDING' };

/** "A PHASE IIA, INTERNATIONAL …" / "PHASE 2/3" / "PHASE I/II" → phase text. */
export function phaseFromTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const m = /\bPHASE\s*((?:I{1,3}V?|IV|[0-4])(?:\s*[ab])?(?:\s*(?:\/|-|and|or)\s*(?:I{1,3}V?|IV|[0-4])(?:\s*[ab])?)?)/i.exec(title);
  return m ? `Phase ${m[1].replace(/\s+/g, '')}` : null;
}

function titleCaseIfShouting(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  if (t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .replace(/(^|[\s\-\/(])([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase())
    .replace(/\b(Llc|Ulc|Ag|Sa|Nv|Bv|Plc|Ab|Kk)\b/g, m => m.toUpperCase())
    .replace(/\bGmbh\b/g, 'GmbH');
}

export function mapHealthCanadaRecord(raw: HcRaw, now = new Date()): RegistryRecord {
  const { protocol, products } = raw;
  const sponsorRaw = products.map(p => p.manufacturer_name).find(Boolean) ?? null;
  const sponsorName = titleCaseIfShouting(sponsorRaw);
  const interventions: RegistryIntervention[] = [];
  // Brand names are kept verbatim (code names such as "SUVOREXANT (MK-4305)" must not be re-cased).
  for (const brand of uniq(products.map(p => (p.brand_name ?? '').trim()).filter(Boolean))) {
    const role = /placebo/i.test(brand) ? 'placebo' : 'experimental';
    const iv = makeIntervention(brand, 'drug', role);
    if (iv) interventions.push(iv);
  }
  const statusLabel = raw.statusLabel ?? (protocol.status_id != null ? STATUS_LABELS[protocol.status_id] ?? null : null);
  const startDate = normalizeRegistryDate(protocol.start_date);
  const status =
    statusLabel === 'ONGOING' ? activeStatusByDate(startDate, now)
    : statusLabel === 'CLOSED' ? 'completed'
    : statusLabel === 'PENDING' ? 'not_yet_recruiting'
    : 'unknown';
  const phaseRaw = phaseFromTitle(protocol.protocol_title);
  const conditions = compact((protocol.medConditionList ?? []).map(c => titleCaseIfShouting(c.med_condition)));

  return {
    registry: 'health_canada',
    registry_id: String(protocol.protocol_id),
    secondary_ids: compact([protocol.protocol_no]),
    title: titleCaseIfShouting(protocol.protocol_title),
    sponsor_name: sponsorName,
    sponsor_type: classifySponsorClass(sponsorName),
    collaborators: [],
    interventions,
    conditions,
    phase_raw: phaseRaw,
    phase: mapRegistryPhase(phaseRaw),
    status_raw: statusLabel,
    status,
    study_type: 'interventional',
    countries: ['CA'],
    start_date: startDate,
    primary_completion_date: normalizeRegistryDate(protocol.end_date),
    first_registered: normalizeRegistryDate(protocol.nol_date),
    last_updated: normalizeRegistryDate(protocol.nol_date),
    source_url: `${BASE()}/protocol/?lang=en&type=json&id=${protocol.protocol_id}`,
    raw: { format: 'health_canada_json', protocol, products, sponsor_raw: sponsorRaw },
  };
}

interface Snapshot {
  fetchedAt: number;
  protocols: HcProtocol[];
  productsByProtocol: Map<number, HcDrugProduct[]>;
  statusLabels: Record<number, string>;
}

let snapshotCache: Snapshot | null = null;

async function loadSnapshot(signal?: AbortSignal): Promise<Snapshot> {
  if (snapshotCache && Date.now() - snapshotCache.fetchedAt < SNAPSHOT_TTL_MS) return snapshotCache;
  const get = async <T,>(path: string): Promise<T> => {
    const res = await registryFetch(`${BASE()}/${path}/?lang=en&type=json`, { signal, timeoutMs: 120_000, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Health Canada ${path} ${res.status}`);
    return (await res.json()) as T;
  };
  const [protocols, products, statuses] = await Promise.all([
    get<HcProtocol[]>('protocol'),
    get<HcDrugProduct[]>('drugproduct'),
    get<Array<{ status_id: number; status: string }>>('status').catch(() => [] as Array<{ status_id: number; status: string }>),
  ]);
  const productsByProtocol = new Map<number, HcDrugProduct[]>();
  for (const p of Array.isArray(products) ? products : []) {
    const list = productsByProtocol.get(p.protocol_id) ?? [];
    list.push(p);
    productsByProtocol.set(p.protocol_id, list);
  }
  const statusLabels: Record<number, string> = { ...STATUS_LABELS };
  for (const s of Array.isArray(statuses) ? statuses : []) statusLabels[s.status_id] = s.status;
  const sorted = (Array.isArray(protocols) ? protocols : [])
    .filter(p => p && typeof p.protocol_id === 'number')
    .sort((a, b) => (b.nol_date ?? '').localeCompare(a.nol_date ?? '') || b.protocol_id - a.protocol_id);
  snapshotCache = { fetchedAt: Date.now(), protocols: sorted, productsByProtocol, statusLabels };
  return snapshotCache;
}

export const healthCanadaAdapter: RegistryAdapter<HcRaw> = {
  registry: 'health_canada',
  displayName: 'Health Canada Clinical Trials Database',
  countryScope: ['CA'],
  license: 'Open Government Licence – Canada',
  capability: 'bulk',
  transport: 'json',
  verified: 'verified',
  rateLimitMs: 0,
  defaultLimit: PAGE_LIMIT,
  estimatedReach: 9_700,
  urls: {
    search: 'https://health-products.canada.ca/ctdb-bdec/index-eng.jsp',
    detail: id => `https://health-products.canada.ca/api/clinical-trial/protocol/?lang=en&type=json&id=${id}`,
  },

  mapRecord(raw: HcRaw): RegistryRecord {
    return mapHealthCanadaRecord(raw);
  },

  /**
   * Cursor: offset (as string) into the nol_date-DESC-sorted protocol list of
   * the current snapshot. The whole registry is downloaded once per run
   * (~7.6 MB, cached for 15 min in the lambda) and emitted 500 rows per page.
   * With `opts.since`, only protocols whose nol_date >= since are emitted.
   */
  async fetchPage(cursor: string | null, opts: FetchPageOptions): Promise<FetchPageResult> {
    const snap = await loadSnapshot(opts.signal);
    const since = opts.since ? normalizeRegistryDate(opts.since) : null;
    const eligible = since ? snap.protocols.filter(p => (normalizeRegistryDate(p.nol_date) ?? '') >= since) : snap.protocols;
    const offset = Math.max(0, Number(cursor ?? '0') || 0);
    const limit = Math.min(opts.limit ?? PAGE_LIMIT, 2000);
    const slice = eligible.slice(offset, offset + limit);
    const warnings: string[] = [];
    const records: RegistryRecord[] = [];
    for (const protocol of slice) {
      try {
        records.push(
          mapHealthCanadaRecord({
            protocol,
            products: snap.productsByProtocol.get(protocol.protocol_id) ?? [],
            statusLabel: protocol.status_id != null ? snap.statusLabels[protocol.status_id] ?? null : null,
          }),
        );
      } catch (err) {
        warnings.push(`Health Canada map ${protocol.protocol_id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const next = offset + slice.length;
    const done = next >= eligible.length;
    return { records, nextCursor: done ? null : String(next), done, warnings };
  },
};

export default healthCanadaAdapter;
