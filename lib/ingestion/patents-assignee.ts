/**
 * Patents by applicant for every originator (Search & Evaluation, Phase 3 Workstream C).
 * Writes `company_patents` (migration 114, source widened in 128);
 * `radar_patent_velocity` is the rolling 12-month view over it.
 *
 * Source: USPTO Open Data Portal patent application search
 * (https://api.uspto.gov/api/v1/patent/applications/search). PatentsView's
 * own search API was retired into ODP in 2026; the old host no longer
 * resolves. Queried by first applicant name for industry-owned companies
 * with at least one Phase 1+ asset, filings 2015+, CPC A61K / A61P / C07 /
 * C12N. Published applications count as well as grants, which is what the
 * velocity feature wants (grants lag filings by two to three years).
 *
 * Requires env PATENTSVIEW_API_KEY (an ODP key from data.uspto.gov/apikey,
 * ID.me-verified account) or USPTO_ODP_API_KEY. Without a key the run logs
 * "skipped: PATENTSVIEW_API_KEY not set" and exits cleanly.
 *
 * Drug linking: development codes (lib/radar/drug-name.ts extractCodeNames)
 * and INN-looking words from the title are normalized with normalizeKey and
 * looked up in drug_aliases.alias_normalized. ODP's search payload carries no
 * abstract.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
import { extractCodeNames, looksLikeInn, normalizeKey } from '@/lib/radar/drug-name';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

export const ODP_SEARCH_URL = 'https://api.uspto.gov/api/v1/patent/applications/search';
/** Kept for callers that still import the old name. */
export const PATENTSVIEW_SEARCH_URL = ODP_SEARCH_URL;
export const PATENT_FILING_FLOOR = '2015-01-01';
export const PATENT_CPC_PREFIXES = ['A61K', 'A61P', 'C07', 'C12N'] as const;
export const ODP_FIELDS = [
  'applicationNumberText',
  'applicationMetaData.inventionTitle',
  'applicationMetaData.filingDate',
  'applicationMetaData.grantDate',
  'applicationMetaData.patentNumber',
  'applicationMetaData.firstApplicantName',
  'applicationMetaData.cpcClassificationBag',
  'applicationMetaData.applicationStatusDescriptionText',
] as const;

const SYNC_SOURCE = 'patents_assignee';
const MIN_REQUEST_GAP_MS = 1_400; // ODP publishes no limit; stay well under 1 req/s
const DEFAULT_TIME_BUDGET_MS = 240_000;
const DEFAULT_COMPANY_LIMIT = 30;
const PAGE_SIZE = 100;
const MAX_PAGES_PER_COMPANY = 3;
const PHASE_1_PLUS = ['phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3', 'phase_4'];

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

/** One record of ODP's patentFileWrapperDataBag, limited to the fields we request. */
export interface OdpApplication {
  applicationNumberText: string;
  applicationMetaData?: {
    inventionTitle?: string | null;
    filingDate?: string | null;
    grantDate?: string | null;
    patentNumber?: string | null;
    firstApplicantName?: string | null;
    cpcClassificationBag?: string[] | null;
    applicationStatusDescriptionText?: string | null;
  };
}

export interface OdpSearchResponse {
  count?: number;
  patentFileWrapperDataBag?: OdpApplication[];
  message?: string;
}

export interface CompanyPatentRow {
  company_id: string;
  patent_id: string;
  title: string | null;
  assignee_raw: string | null;
  filing_date: string | null;
  grant_date: string | null;
  cpc_codes: string[];
  abstract: string | null;
  drug_master_id: string | null;
  source: 'uspto_odp';
  source_url: string;
  fetched_at: string;
}

export interface PatentsAssigneeRunResult {
  companiesProcessed: number;
  patentsFetched: number;
  patentsUpserted: number;
  linked: number;
  failed: number;
  errors: string[];
  timedOut: boolean;
  durationMs: number;
  cursor: string | null;
  skipped: string | null;
}

interface CursorState extends Record<string, unknown> {
  /** company_id -> latest filing date seen (ODP rows include pending applications). */
  byCompany?: Record<string, string>;
}

// ═══════════════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════════════

const LEGAL_SUFFIX_RE = /[,.]?\s*\b(incorporated|inc|corporation|corp|company|co|limited|ltd|plc|llc|l\.l\.c|lp|l\.p|ag|s\.?a|n\.?v|b\.?v|se|gmbh|pty|k\.?k|co\.?,? ltd)\.?\s*$/i;

/** Assignee prefix to query: legal suffix stripped, punctuation normalized. */
export function assigneeQueryName(name: string): string {
  let n = (name ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 2; i++) n = n.replace(LEGAL_SUFFIX_RE, '').trim();
  return n.replace(/[,]+$/g, '').trim();
}

export function isPharmaCpc(codes: string[]): boolean {
  return codes.some(c => PATENT_CPC_PREFIXES.some(p => c.toUpperCase().startsWith(p)));
}

/** CPC codes as ODP prints them ("A61K  38/193") normalized to "A61K38/193". */
export function cpcCodesOf(p: OdpApplication): string[] {
  const out = new Set<string>();
  for (const c of p.applicationMetaData?.cpcClassificationBag ?? []) {
    const code = String(c ?? '').replace(/\s+/g, '').trim();
    if (code) out.add(code);
  }
  return [...out];
}

export function filingDateOf(p: OdpApplication): string | null {
  const d = p.applicationMetaData?.filingDate;
  return d ? String(d).slice(0, 10) : null;
}

export function titleOf(p: OdpApplication): string | null {
  return p.applicationMetaData?.inventionTitle?.trim() || null;
}

/**
 * Candidate alias keys from a patent title/abstract: development codes and
 * INN-looking words. Returns normalized keys (drug_aliases.alias_normalized).
 */
export function patentAliasKeys(title: string | null | undefined, abstract: string | null | undefined): string[] {
  const text = `${title ?? ''} ${abstract ?? ''}`;
  const keys = new Set<string>();
  for (const code of extractCodeNames(text)) keys.add(normalizeKey(code));
  for (const m of text.matchAll(/\b[A-Za-z][a-z]{6,}\b/g)) {
    const w = m[0];
    if (looksLikeInn(w)) keys.add(normalizeKey(w));
  }
  return [...keys].filter(k => k.length >= 5);
}

/**
 * Resolve a patent to a drug: code-name aliases win over INN aliases; among
 * equals, the first key in text order wins. `lookup` maps alias_normalized
 * to {drug_id, alias_type}.
 */
export function linkPatentToDrug(
  title: string | null | undefined,
  abstract: string | null | undefined,
  lookup: Map<string, { drug_id: string; alias_type: string }>,
): string | null {
  const keys = patentAliasKeys(title, abstract);
  let best: { drug_id: string; rank: number; order: number } | null = null;
  for (let order = 0; order < keys.length; order++) {
    const hit = lookup.get(keys[order]);
    if (!hit) continue;
    const rank = hit.alias_type === 'code' ? 0 : hit.alias_type === 'inn' ? 1 : 2;
    if (!best || rank < best.rank || (rank === best.rank && order < best.order)) best = { drug_id: hit.drug_id, rank, order };
  }
  return best ? best.drug_id : null;
}

/**
 * One row per application. patent_id is the application number (stable
 * across publication and grant); the URL points at the granted patent when
 * there is one, else at Patent Center for the application.
 */
export function toPatentRow(
  p: OdpApplication,
  companyId: string,
  drugMasterId: string | null,
  now = new Date(),
): CompanyPatentRow {
  const m = p.applicationMetaData ?? {};
  const cpc = cpcCodesOf(p);
  const patentNumber = m.patentNumber ? String(m.patentNumber).replace(/^US/i, '') : null;
  return {
    company_id: companyId,
    patent_id: String(p.applicationNumberText),
    title: titleOf(p),
    assignee_raw: m.firstApplicantName?.trim() || null,
    filing_date: filingDateOf(p),
    grant_date: m.grantDate ? String(m.grantDate).slice(0, 10) : null,
    cpc_codes: cpc.slice(0, 40),
    abstract: null,
    drug_master_id: drugMasterId,
    source: 'uspto_odp',
    source_url: patentNumber
      ? `https://patents.google.com/patent/US${patentNumber}`
      : `https://patentcenter.uspto.gov/applications/${encodeURIComponent(String(p.applicationNumberText))}`,
    fetched_at: now.toISOString(),
  };
}

/** Escape the characters Lucene treats specially inside a quoted phrase. */
function lucenePhrase(s: string): string {
  return `"${s.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim()}"`;
}

/**
 * ODP query (Lucene syntax): first applicant phrase, filings from the floor
 * or from the last filing date seen for this company.
 */
export function buildOdpQuery(applicant: string, opts: { sinceFilingDate?: string | null } = {}): string {
  const from = opts.sinceFilingDate && opts.sinceFilingDate > PATENT_FILING_FLOOR ? opts.sinceFilingDate : PATENT_FILING_FLOOR;
  return `applicationMetaData.firstApplicantName:${lucenePhrase(applicant)} AND applicationMetaData.filingDate:[${from} TO *]`;
}

/** @deprecated PatentsView's own API is retired; kept so old imports still type-check. */
export function buildPatentsViewQuery(assignee: string, opts: { sinceGrantDate?: string | null } = {}): Record<string, unknown> {
  return { q: buildOdpQuery(assignee, { sinceFilingDate: opts.sinceGrantDate }) };
}

// ═══════════════════════════════════════════════════════════════════════
// NETWORK
// ═══════════════════════════════════════════════════════════════════════

let lastRequestAt = 0;
async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/**
 * Newest filings first, offset-paged, at most maxPages × PAGE_SIZE per call.
 * A 403 means the key is not accepted (not ID.me-verified or not activated)
 * and is surfaced as such rather than as a silent empty result.
 */
export async function fetchPatentsForAssignee(
  apiKey: string,
  applicant: string,
  opts: { sinceFilingDate?: string | null; maxPages?: number } = {},
): Promise<OdpApplication[]> {
  const out: OdpApplication[] = [];
  for (let page = 0; page < (opts.maxPages ?? MAX_PAGES_PER_COMPANY); page++) {
    await throttle();
    const params = new URLSearchParams({
      q: buildOdpQuery(applicant, opts),
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      sort: 'applicationMetaData.filingDate desc',
      fields: ODP_FIELDS.join(','),
    });
    const res = await fetchWithTimeout(`${ODP_SEARCH_URL}?${params}`, {
      method: 'GET',
      headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
      timeoutMs: 30_000,
      retries: 1,
    });
    if (res.status === 404) return out;
    if (res.status === 401 || res.status === 403) {
      throw new Error(`USPTO ODP ${res.status}: API key rejected (needs an ID.me-verified USPTO.gov account; see data.uspto.gov/apikey)`);
    }
    if (!res.ok) throw new Error(`USPTO ODP ${res.status} for "${applicant}"`);
    const data = (await res.json()) as OdpSearchResponse;
    const apps = data.patentFileWrapperDataBag ?? [];
    out.push(...apps);
    if (apps.length < PAGE_SIZE) break;
    if (typeof data.count === 'number' && out.length >= data.count) break;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════════════

export interface PatentsAssigneeOptions {
  limit?: number;
  timeBudgetMs?: number;
  now?: Date;
}

interface CompanyLite {
  id: string;
  name: string;
  name_variations: string[] | null;
}

async function eligibleCompanies(supabase: SupabaseClient, afterId: string | null, limit: number): Promise<{ rows: CompanyLite[]; scanned: number; error?: string }> {
  // Scan industry companies in id order and keep those with a Phase 1+ asset.
  const rows: CompanyLite[] = [];
  let cursor = afterId;
  let scanned = 0;
  for (let round = 0; round < 6 && rows.length < limit; round++) {
    let q = supabase
      .from('companies')
      .select('id, name, name_variations')
      .eq('owner_type', 'industry')
      .order('id', { ascending: true })
      .limit(200);
    if (cursor) q = q.gt('id', cursor);
    const { data, error } = await q;
    if (error) return { rows, scanned, error: error.message };
    const batch = (data ?? []) as CompanyLite[];
    if (batch.length === 0) break;
    scanned += batch.length;
    cursor = batch[batch.length - 1].id;
    const { data: assets, error: aErr } = await supabase
      .from('clinical_assets')
      .select('company_id')
      .in('company_id', batch.map(b => b.id))
      .in('phase', PHASE_1_PLUS)
      .limit(2000);
    if (aErr) return { rows, scanned, error: aErr.message };
    const withAssets = new Set((assets ?? []).map(a => (a as { company_id: string }).company_id));
    for (const c of batch) {
      if (withAssets.has(c.id)) rows.push(c);
      if (rows.length >= limit) break;
    }
  }
  return { rows, scanned };
}

export async function runPatentsAssignee(
  supabase: SupabaseClient,
  opts: PatentsAssigneeOptions = {},
): Promise<PatentsAssigneeRunResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const budget = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const limit = opts.limit ?? DEFAULT_COMPANY_LIMIT;
  const errors: string[] = [];
  const result: PatentsAssigneeRunResult = {
    companiesProcessed: 0, patentsFetched: 0, patentsUpserted: 0, linked: 0, failed: 0,
    errors, timedOut: false, durationMs: 0, cursor: null, skipped: null,
  };
  const apiKey = (process.env.PATENTSVIEW_API_KEY ?? process.env.USPTO_ODP_API_KEY)?.trim();
  if (!apiKey) {
    result.skipped = 'skipped: PATENTSVIEW_API_KEY not set';
    console.warn(`[patents-assignee] ${result.skipped}`);
    result.durationMs = Date.now() - started;
    return result;
  }
  const outOfTime = () => Date.now() - started > budget;

  const cursor = await readSyncCursor<CursorState>(supabase, SYNC_SOURCE);
  const state: CursorState = { byCompany: { ...(cursor.state.byCompany ?? {}) } };

  let { rows: companies, error: cErr } = await eligibleCompanies(supabase, cursor.cursor, limit);
  if (cErr) errors.push(`companies read: ${cErr}`);
  let lastId: string | null = cursor.cursor;
  if (companies.length === 0 && cursor.cursor) {
    // Wrap around.
    const again = await eligibleCompanies(supabase, null, limit);
    companies = again.rows;
    if (again.error) errors.push(`companies read (wrap): ${again.error}`);
    lastId = null;
  }

  for (const c of companies) {
    if (outOfTime()) { result.timedOut = true; break; }
    lastId = c.id;
    const queryName = assigneeQueryName(c.name);
    if (queryName.length < 4) continue;
    result.companiesProcessed++;
    try {
      // Incremental: only filings on or after the newest one seen last time.
      const since = state.byCompany?.[c.id] ?? null;
      const patents = await fetchPatentsForAssignee(apiKey, queryName, { sinceFilingDate: since });
      const pharma = patents.filter(p => isPharmaCpc(cpcCodesOf(p)));
      result.patentsFetched += pharma.length;
      if (pharma.length === 0) continue;

      // Alias lookup for drug linking, one query per company.
      const keys = new Set<string>();
      for (const p of pharma) for (const k of patentAliasKeys(titleOf(p), null)) keys.add(k);
      const lookup = new Map<string, { drug_id: string; alias_type: string }>();
      const keyList = [...keys];
      for (let i = 0; i < keyList.length; i += 200) {
        const { data, error } = await supabase
          .from('drug_aliases')
          .select('drug_id, alias_normalized, alias_type')
          .in('alias_normalized', keyList.slice(i, i + 200));
        if (error) { errors.push(`${c.name}: drug_aliases ${error.message}`); break; }
        for (const row of (data ?? []) as Array<{ drug_id: string; alias_normalized: string; alias_type: string }>) {
          const prev = lookup.get(row.alias_normalized);
          if (!prev || (row.alias_type === 'code' && prev.alias_type !== 'code')) lookup.set(row.alias_normalized, { drug_id: row.drug_id, alias_type: row.alias_type });
        }
      }

      const rows = pharma.map(p => {
        const drugId = linkPatentToDrug(titleOf(p), null, lookup);
        if (drugId) result.linked++;
        return toPatentRow(p, c.id, drugId, now);
      });
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from('company_patents').upsert(rows.slice(i, i + 200), { onConflict: 'patent_id,company_id' });
        if (error) { result.failed++; errors.push(`${c.name}: upsert ${error.message}`); break; }
        result.patentsUpserted += Math.min(200, rows.length - i);
      }
      const latestFiling = pharma.map(p => filingDateOf(p) ?? '').filter(Boolean).sort().pop();
      if (latestFiling) state.byCompany![c.id] = latestFiling;
    } catch (err) {
      result.failed++;
      errors.push(`${c.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  result.cursor = lastId;
  try {
    await writeSyncCursor(supabase, SYNC_SOURCE, lastId, state);
  } catch (err) {
    errors.push(`cursor write: ${err instanceof Error ? err.message : String(err)}`);
  }
  result.durationMs = Date.now() - started;
  return result;
}
