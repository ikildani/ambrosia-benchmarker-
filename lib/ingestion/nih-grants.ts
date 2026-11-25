/**
 * NIH SBIR/STTR awards (Search & Evaluation company signals v2, migration 198 company_grants).
 *
 * SBIR (R43/R44, U43/U44, SB1) and STTR (R41/R42) awards go only to US small businesses; NIH
 * RePORTER publishes every award with the organization's legal name, state, amount and notice
 * date (free API, no key, ~1 request/second). Small private biotechs rarely file anything else,
 * so for them an award is often the only primary-source funding evidence.
 *
 * Bulk, not per company: each run pulls whole fiscal years (≈2,000 awards each, 500 per page) and
 * matches organization names against every feed company locally. A match needs equal name keys
 * (legal forms dropped, sector words kept, distinctive core), at most two distinct org states for
 * that key, and no large-pharma company row (SBIR excludes them). One company_grants row per
 * award (appl_id); evidence is the RePORTER fields verbatim.
 *
 * Backfill FY 2008 onward over a few runs, then refresh the two latest fiscal years weekly.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
import { SIGNAL_USER_AGENT, companyKeys, isDistinctiveKey, loadMatchSubjects, nameKey, type MatchSubject } from './signal-match';

export const NIH_REPORTER_SEARCH_URL = 'https://api.reporter.nih.gov/v2/projects/search';
export const NIH_SBIR_ACTIVITY_CODES = ['R41', 'R42', 'R43', 'R44', 'U43', 'U44', 'SB1'] as const;
const STTR_CODES = new Set(['R41', 'R42']);
export const NIH_FIRST_FISCAL_YEAR = 2008;
export const NIH_GRANTS_CURSOR = 'nih_grants';
const PAGE = 500;
/** RePORTER rejects offsets past 14,999 (≈2,000 SBIR awards a year, far below). */
const MAX_OFFSET = 14_500;
const REQUEST_GAP_MS = 1_100;

export interface NihProject {
  appl_id?: number;
  project_num?: string;
  fiscal_year?: number;
  award_amount?: number | null;
  award_notice_date?: string | null;
  project_start_date?: string | null;
  activity_code?: string | null;
  project_title?: string | null;
  organization?: { org_name?: string | null; org_state?: string | null; org_city?: string | null } | null;
}

export interface GrantRow {
  company_id: string;
  program: 'nih_sbir' | 'nih_sttr';
  source: 'nih_reporter';
  award_id: string;
  project_num: string;
  activity_code: string | null;
  fiscal_year: number;
  award_amount_usd: number | null;
  awarded_at: string;
  title: string | null;
  org_name: string;
  org_state: string | null;
  match_method: 'exact_name';
  resolution_confidence: number;
  source_url: string;
  evidence: string;
  fetched_at: string;
}

// ═══════════════════════════════════════════════════════════════════════
// PURE
// ═══════════════════════════════════════════════════════════════════════

function day(raw: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw ?? '');
  return m ? m[1] : null;
}

/** Date the award became known: notice date, else project start, else the fiscal year's first day. */
export function awardDate(p: NihProject): string | null {
  return day(p.award_notice_date) ?? day(p.project_start_date) ?? (p.fiscal_year ? `${p.fiscal_year - 1}-10-01` : null);
}

export interface NihMatchResult {
  rows: GrantRow[];
  matchedCompanies: number;
  matchedOrgKeys: number;
  skippedMultiState: number;
}

/**
 * Match awards to companies by exact name key. Every company row with the key gets the award
 * (duplicate rows of one company); a key whose awards span more than two states is skipped.
 */
export function matchNihProjects(subjects: MatchSubject[], projects: NihProject[], now = new Date()): NihMatchResult {
  const byKey = new Map<string, MatchSubject[]>();
  for (const s of subjects) {
    if (s.company_type === 'large_pharma') continue;
    for (const k of companyKeys(s.name, s.name_variations).en) {
      const a = byKey.get(k) ?? [];
      a.push(s);
      byKey.set(k, a);
    }
  }
  const projectsByKey = new Map<string, NihProject[]>();
  for (const p of projects) {
    const k = nameKey(p.organization?.org_name);
    if (!isDistinctiveKey(k) || !byKey.has(k)) continue;
    const a = projectsByKey.get(k) ?? [];
    a.push(p);
    projectsByKey.set(k, a);
  }
  const rows: GrantRow[] = [];
  const companies = new Set<string>();
  let skippedMultiState = 0;
  let matchedOrgKeys = 0;
  for (const [k, ps] of projectsByKey) {
    const states = new Set(ps.map(p => p.organization?.org_state ?? '?'));
    if (states.size > 2) { skippedMultiState++; continue; }
    matchedOrgKeys++;
    const confidence = states.size === 1 ? 92 : 85;
    for (const s of byKey.get(k) ?? []) {
      for (const p of ps) {
        const at = awardDate(p);
        if (!p.appl_id || !p.project_num || !p.fiscal_year || !at) continue;
        const code = (p.activity_code ?? '').toUpperCase() || null;
        const org = p.organization?.org_name ?? '';
        companies.add(s.id);
        rows.push({
          company_id: s.id,
          program: code && STTR_CODES.has(code) ? 'nih_sttr' : 'nih_sbir',
          source: 'nih_reporter',
          award_id: String(p.appl_id),
          project_num: p.project_num,
          activity_code: code,
          fiscal_year: p.fiscal_year,
          award_amount_usd: typeof p.award_amount === 'number' && p.award_amount >= 0 ? p.award_amount : null,
          awarded_at: at,
          title: p.project_title?.slice(0, 300) ?? null,
          org_name: org,
          org_state: p.organization?.org_state ?? null,
          match_method: 'exact_name',
          resolution_confidence: confidence,
          source_url: `https://reporter.nih.gov/project-details/${p.appl_id}`,
          evidence: [
            `NIH ${code ?? 'SBIR/STTR'} ${p.project_num} FY${p.fiscal_year}`,
            `organization "${org}"${p.organization?.org_state ? ` (${p.organization.org_state})` : ''}`,
            typeof p.award_amount === 'number' ? `award_amount ${p.award_amount}` : null,
            day(p.award_notice_date) ? `award_notice_date ${day(p.award_notice_date)}` : null,
          ].filter(Boolean).join('; ').slice(0, 500),
          fetched_at: now.toISOString(),
        });
      }
    }
  }
  return { rows, matchedCompanies: companies.size, matchedOrgKeys, skippedMultiState };
}

/** Fiscal years to fetch this run: continue the backfill, else refresh the latest two. */
export function nihYearsToFetch(nextYear: number | null | undefined, now: Date, perRun: number): number[] {
  const current = now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const start = nextYear ?? NIH_FIRST_FISCAL_YEAR;
  if (start <= current - 1) {
    const out: number[] = [];
    for (let y = start; y <= current && out.length < perRun; y++) out.push(y);
    return out;
  }
  return [current - 1, current];
}

// ═══════════════════════════════════════════════════════════════════════
// NETWORK + RUNNER
// ═══════════════════════════════════════════════════════════════════════

export async function fetchNihFiscalYear(fy: number): Promise<NihProject[]> {
  const out: NihProject[] = [];
  for (let offset = 0; offset <= MAX_OFFSET; offset += PAGE) {
    const res = await fetchWithTimeout(NIH_REPORTER_SEARCH_URL, {
      method: 'POST',
      headers: { 'User-Agent': SIGNAL_USER_AGENT, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        criteria: { activity_codes: NIH_SBIR_ACTIVITY_CODES, fiscal_years: [fy] },
        include_fields: ['ApplId', 'ProjectNum', 'FiscalYear', 'Organization', 'AwardAmount', 'AwardNoticeDate', 'ProjectStartDate', 'ActivityCode', 'ProjectTitle'],
        offset, limit: PAGE,
      }),
      timeoutMs: 60_000,
      retries: 2,
    });
    if (!res.ok) throw new Error(`NIH RePORTER ${res.status} (FY${fy}, offset ${offset})`);
    const json = (await res.json()) as { meta?: { total?: number }; results?: NihProject[] };
    const results = json.results ?? [];
    out.push(...results);
    await new Promise(r => setTimeout(r, REQUEST_GAP_MS));
    if (!results.length || offset + PAGE >= (json.meta?.total ?? 0)) break;
  }
  return out;
}

export interface NihRunResult {
  years: number[];
  projects: number;
  rows: number;
  companies: number;
  orgKeys: number;
  skippedMultiState: number;
  written: number;
  timedOut: boolean;
  errors: string[];
  sample: Array<{ company: string; org: string; project: string; fy: number }>;
}

export async function runNihGrants(supabase: SupabaseClient, opts: { dryRun?: boolean; timeBudgetMs?: number; yearsPerRun?: number; now?: Date } = {}): Promise<NihRunResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const budget = opts.timeBudgetMs ?? 200_000;
  const r: NihRunResult = { years: [], projects: 0, rows: 0, companies: 0, orgKeys: 0, skippedMultiState: 0, written: 0, timedOut: false, errors: [], sample: [] };
  const cursor = await readSyncCursor<{ nextYear?: number }>(supabase, NIH_GRANTS_CURSOR);
  const years = nihYearsToFetch(cursor.state.nextYear, now, opts.yearsPerRun ?? 6);
  const subjects = await loadMatchSubjects(supabase);
  const byId = new Map(subjects.map(s => [s.id, s]));
  let lastDone: number | null = null;
  const companies = new Set<string>();
  for (const fy of years) {
    if (Date.now() - started > budget) { r.timedOut = true; break; }
    let projects: NihProject[];
    try {
      projects = await fetchNihFiscalYear(fy);
    } catch (e) {
      r.errors.push(e instanceof Error ? e.message : String(e));
      break;
    }
    r.years.push(fy);
    r.projects += projects.length;
    const m = matchNihProjects(subjects, projects, now);
    r.rows += m.rows.length;
    r.orgKeys += m.matchedOrgKeys;
    r.skippedMultiState += m.skippedMultiState;
    m.rows.forEach(x => companies.add(x.company_id));
    for (const x of m.rows) {
      if (r.sample.length >= 30) break;
      r.sample.push({ company: byId.get(x.company_id)?.name ?? x.company_id, org: x.org_name, project: x.project_num, fy: x.fiscal_year });
    }
    if (!opts.dryRun && m.rows.length) {
      for (let i = 0; i < m.rows.length; i += 500) {
        const { error } = await supabase.from('company_grants').upsert(m.rows.slice(i, i + 500), { onConflict: 'company_id,source,award_id' });
        if (error) { r.errors.push(`upsert FY${fy}: ${error.message}`); break; }
        r.written += Math.min(500, m.rows.length - i);
      }
    }
    lastDone = fy;
  }
  r.companies = companies.size;
  if (!opts.dryRun && lastDone !== null) {
    const next = Math.max(lastDone + 1, cursor.state.nextYear ?? NIH_FIRST_FISCAL_YEAR);
    try { await writeSyncCursor(supabase, NIH_GRANTS_CURSOR, String(lastDone), { nextYear: next, lastRunAt: now.toISOString() }); }
    catch (e) { r.errors.push(`cursor: ${e instanceof Error ? e.message : String(e)}`); }
  }
  return r;
}
