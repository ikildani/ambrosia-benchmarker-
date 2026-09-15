/**
 * Patents by assignee for every originator (Asset Radar, Phase 3 Workstream C).
 * Writes `company_patents` (migration 114); `radar_patent_velocity` is the
 * rolling 12-month view over it.
 *
 * Source: PatentsView search API v1 (https://search.patentsview.org/api/v1/patent/),
 * queried by assignee organization for industry-owned companies with at least
 * one Phase 1+ asset, filings 2015+, CPC A61K / A61P / C07 / C12N. Requires
 * env PATENTSVIEW_API_KEY (45 requests/minute). Without the key the run logs
 * "skipped: PATENTSVIEW_API_KEY not set" and exits cleanly.
 *
 * Drug linking: development codes (lib/radar/drug-name.ts extractCodeNames)
 * and INN-looking words from the title/abstract are normalized with
 * normalizeKey and looked up in drug_aliases.alias_normalized.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
import { extractCodeNames, looksLikeInn, normalizeKey } from '@/lib/radar/drug-name';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

export const PATENTSVIEW_SEARCH_URL = 'https://search.patentsview.org/api/v1/patent/';
export const PATENT_FILING_FLOOR = '2015-01-01';
export const PATENT_CPC_PREFIXES = ['A61K', 'A61P', 'C07', 'C12N'] as const;

const SYNC_SOURCE = 'patents_assignee';
const MIN_REQUEST_GAP_MS = 1_400; // 45/min with headroom
const DEFAULT_TIME_BUDGET_MS = 240_000;
const DEFAULT_COMPANY_LIMIT = 30;
const PAGE_SIZE = 100;
const MAX_PAGES_PER_COMPANY = 3;
const PHASE_1_PLUS = ['phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3', 'phase_4'];

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface PatentsViewPatent {
  patent_id: string;
  patent_title?: string;
  patent_date?: string;
  patent_abstract?: string;
  application?: Array<{ filing_date?: string }> | { filing_date?: string };
  assignees?: Array<{ assignee_organization?: string | null }>;
  cpc_current?: Array<{ cpc_group_id?: string; cpc_subclass_id?: string; cpc_group?: string }>;
}

export interface PatentsViewResponse {
  error?: boolean;
  count?: number;
  total_hits?: number;
  patents?: PatentsViewPatent[];
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
  source: 'patentsview';
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
  /** company_id -> latest grant date seen. */
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

export function cpcCodesOf(p: PatentsViewPatent): string[] {
  const out = new Set<string>();
  for (const c of p.cpc_current ?? []) {
    const code = c.cpc_group_id ?? c.cpc_group ?? c.cpc_subclass_id;
    if (code) out.add(String(code).trim());
  }
  return [...out];
}

export function filingDateOf(p: PatentsViewPatent): string | null {
  const app = p.application;
  if (!app) return null;
  const first = Array.isArray(app) ? app[0] : app;
  const d = first?.filing_date;
  return d ? String(d).slice(0, 10) : null;
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

export function toPatentRow(
  p: PatentsViewPatent,
  companyId: string,
  drugMasterId: string | null,
  now = new Date(),
): CompanyPatentRow {
  const cpc = cpcCodesOf(p);
  return {
    company_id: companyId,
    patent_id: String(p.patent_id),
    title: p.patent_title?.trim() || null,
    assignee_raw: p.assignees?.map(a => a.assignee_organization).filter(Boolean).join('; ') || null,
    filing_date: filingDateOf(p),
    grant_date: p.patent_date ? String(p.patent_date).slice(0, 10) : null,
    cpc_codes: cpc.slice(0, 40),
    abstract: p.patent_abstract ? p.patent_abstract.slice(0, 5000) : null,
    drug_master_id: drugMasterId,
    source: 'patentsview',
    source_url: `https://patents.google.com/patent/US${String(p.patent_id).replace(/^US/i, '')}`,
    fetched_at: now.toISOString(),
  };
}

export function buildPatentsViewQuery(assignee: string, opts: { sinceGrantDate?: string | null } = {}): Record<string, unknown> {
  const and: Record<string, unknown>[] = [
    { _gte: { 'application.filing_date': PATENT_FILING_FLOOR } },
    { _begins: { 'assignees.assignee_organization': assignee } },
  ];
  if (opts.sinceGrantDate) and.push({ _gte: { patent_date: opts.sinceGrantDate } });
  return { _and: and };
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

export async function fetchPatentsForAssignee(
  apiKey: string,
  assignee: string,
  opts: { sinceGrantDate?: string | null; maxPages?: number } = {},
): Promise<PatentsViewPatent[]> {
  const out: PatentsViewPatent[] = [];
  let after: string | null = null;
  for (let page = 0; page < (opts.maxPages ?? MAX_PAGES_PER_COMPANY); page++) {
    await throttle();
    const body: Record<string, unknown> = {
      q: buildPatentsViewQuery(assignee, opts),
      f: ['patent_id', 'patent_title', 'patent_date', 'patent_abstract', 'application.filing_date', 'assignees.assignee_organization', 'cpc_current.cpc_group_id'],
      o: after ? { size: PAGE_SIZE, after } : { size: PAGE_SIZE },
      s: [{ patent_id: 'asc' }],
    };
    const res = await fetchWithTimeout(PATENTSVIEW_SEARCH_URL, {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: 30_000,
      retries: 1,
    });
    if (res.status === 404) return out;
    if (!res.ok) throw new Error(`PatentsView ${res.status} for "${assignee}"`);
    const data = (await res.json()) as PatentsViewResponse;
    if (data.error) throw new Error(`PatentsView error payload for "${assignee}"`);
    const patents = data.patents ?? [];
    out.push(...patents);
    if (patents.length < PAGE_SIZE) break;
    after = String(patents[patents.length - 1].patent_id);
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
  const apiKey = process.env.PATENTSVIEW_API_KEY?.trim();
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
      const since = state.byCompany?.[c.id] ?? null;
      const patents = await fetchPatentsForAssignee(apiKey, queryName, { sinceGrantDate: since });
      const pharma = patents.filter(p => isPharmaCpc(cpcCodesOf(p)));
      result.patentsFetched += pharma.length;
      if (pharma.length === 0) continue;

      // Alias lookup for drug linking, one query per company.
      const keys = new Set<string>();
      for (const p of pharma) for (const k of patentAliasKeys(p.patent_title, p.patent_abstract)) keys.add(k);
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
        const drugId = linkPatentToDrug(p.patent_title, p.patent_abstract, lookup);
        if (drugId) result.linked++;
        return toPatentRow(p, c.id, drugId, now);
      });
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from('company_patents').upsert(rows.slice(i, i + 200), { onConflict: 'patent_id,company_id' });
        if (error) { result.failed++; errors.push(`${c.name}: upsert ${error.message}`); break; }
        result.patentsUpserted += Math.min(200, rows.length - i);
      }
      const latestGrant = pharma.map(p => p.patent_date ?? '').filter(Boolean).sort().pop();
      if (latestGrant) state.byCompany![c.id] = latestGrant.slice(0, 10);
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
