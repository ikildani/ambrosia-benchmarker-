/**
 * EDGAR filer index (Search & Evaluation company signals v2, migration 198).
 *
 * The 189 Form D / 10-K discovery searches EDGAR full text (2001+, US companies only, one query
 * per company). EDGAR's own CIK lookup file lists every name any filer has used since 1993, with
 * its CIK, in one 40 MB download: a Nov 23 2026 sample of 400 uncovered US feed companies found
 * 168 exact-name filers, 137 of them health-care filers (60 with 10-K/20-F history, 70 Form D
 * only, 7 registration only); 28 of 250 non-US companies matched too.
 *
 *   1. Stream cik-lookup-data.txt; keep names whose key equals a candidate company key
 *      (legal forms dropped, sector words kept, distinctive core).
 *   2. For each candidate CIK, read data.sec.gov/submissions: a CIK counts only when it is a
 *      health-care filer (SIC 2833-2836, 3841/3842/3845, 8731/8733, 5122, 8071, 8090) or files
 *      Form D, and exactly one such CIK matches the company.
 *   3. Periodic filer (10-K, 10-Q, 20-F, 40-F, 10-KSB): an active one (periodic report within
 *      15 months) gets a company_listings SEC_FILER row and, when its current name agrees with
 *      the company and no other company row holds it, companies.cik (the financials cron then
 *      reads its XBRL); an inactive one gets companies.sec_inactive_cik / sec_last_10k_at (189
 *      semantics; company_signal_refresh_derived_listings writes the ceased_filing row).
 *   4. Form D filings: primary_doc.xml through the 189 guards (filer name on the document matches
 *      the company, industry group is health care) -> company_financing_events; companies.form_d_cik.
 *
 * Every checked company gets companies.edgar_checked_at, so the queue advances; unmatched
 * companies are re-checked after 90 days. SEC fair access: SEC_USER_AGENT, < 10 req/s (shared
 * throttle in company-financials.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { padCik, secGetJson, secGetText, secUserAgent, stripCik } from './company-financials';
import { upsertFinancingEvents, type FinancingEventRow } from './company-signals';
import { formDDocUrl, formDEventRow, parseFormDXml, type FormDHit } from './form-d';
import { companyKeys, isDistinctiveKey, nameAgreement, nameKey } from './signal-match';

export const EDGAR_CIK_LOOKUP_URL = 'https://www.sec.gov/Archives/edgar/cik-lookup-data.txt';
export const EDGAR_SUBMISSIONS_URL = 'https://data.sec.gov/submissions';
export const EDGAR_RECHECK_DAYS = 90;
const ACTIVE_MONTHS = 15;
const MAX_CIKS_PER_COMPANY = 3;
const MAX_FORM_D_DOCS = 12;

export const HEALTH_SICS: ReadonlySet<string> = new Set(['2833', '2834', '2835', '2836', '3841', '3842', '3845', '5122', '8071', '8090', '8731', '8733']);
const PERIODIC_FORMS: ReadonlySet<string> = new Set(['10-K', '10-K/A', '10-K405', '10-KSB', '10-KSB/A', '10KSB', '10-Q', '10-Q/A', '10-QSB', '10QSB', '20-F', '20-F/A', '40-F', '40-F/A', '10-KT']);
const FORM_D: ReadonlySet<string> = new Set(['D', 'D/A']);

export interface EdgarCandidate {
  id: string;
  name: string;
  name_variations: string[] | null;
  company_type: string | null;
}

// ═══════════════════════════════════════════════════════════════════════
// PURE
// ═══════════════════════════════════════════════════════════════════════

/** Parse one cik-lookup-data.txt line: "NAME:0001234567:" (names may contain colons). */
export function parseCikLookupLine(line: string): { name: string; cik: string } | null {
  const m = /^(.*):(\d{10}):\s*$/.exec(line);
  if (!m || !m[1].trim()) return null;
  return { name: m[1].trim(), cik: stripCik(m[2]) };
}

/** company key -> companies holding it (duplicate rows of one company share a key). */
export function candidateKeyIndex(companies: EdgarCandidate[]): Map<string, EdgarCandidate[]> {
  const idx = new Map<string, EdgarCandidate[]>();
  for (const c of companies) {
    if (c.company_type === 'large_pharma') continue; // their names collide with subsidiaries and plans
    for (const k of companyKeys(c.name, c.name_variations).en) {
      if (!isDistinctiveKey(k, 6)) continue;
      const a = idx.get(k) ?? [];
      a.push(c);
      idx.set(k, a);
    }
  }
  return idx;
}

/** Scan the lookup text (or a chunk of lines) and return company id -> candidate CIKs. */
export function scanCikLookup(lines: Iterable<string>, idx: Map<string, EdgarCandidate[]>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const line of lines) {
    const p = parseCikLookupLine(line);
    if (!p) continue;
    const hit = idx.get(nameKey(p.name));
    if (!hit) continue;
    for (const c of hit) {
      const s = out.get(c.id) ?? new Set<string>();
      s.add(p.cik);
      out.set(c.id, s);
    }
  }
  return out;
}

export interface SubmissionsDoc {
  cik?: string;
  name?: string;
  sic?: string;
  sicDescription?: string;
  formerNames?: Array<{ name?: string; from?: string; to?: string }>;
  filings?: { recent?: { accessionNumber?: string[]; filingDate?: string[]; form?: string[]; primaryDocument?: string[] } };
}

export interface FilerProfile {
  cik: string;
  name: string;
  sic: string | null;
  health: boolean;
  periodicLast: string | null;
  periodicForms: string[];
  formD: FormDHit[];
}

export function filerProfile(doc: SubmissionsDoc, cik: string): FilerProfile {
  const r = doc.filings?.recent ?? {};
  const forms = r.form ?? [];
  let periodicLast: string | null = null;
  const periodicForms = new Set<string>();
  const formD: FormDHit[] = [];
  for (let i = 0; i < forms.length; i++) {
    const f = forms[i];
    const date = r.filingDate?.[i] ?? '';
    if (PERIODIC_FORMS.has(f)) {
      periodicForms.add(f);
      if (!periodicLast || date > periodicLast) periodicLast = date;
    } else if (FORM_D.has(f) && r.accessionNumber?.[i]) {
      const primary = (r.primaryDocument?.[i] ?? 'primary_doc.xml').replace(/^.*\//, '');
      formD.push({ adsh: r.accessionNumber[i], cik, filerName: doc.name ?? '', form: f, fileDate: date, primaryDoc: primary.endsWith('.xml') ? primary : 'primary_doc.xml' });
    }
  }
  const sic = doc.sic && doc.sic !== '0000' ? String(doc.sic) : null;
  return {
    cik, name: doc.name ?? '', sic,
    health: (sic != null && HEALTH_SICS.has(sic)) || (sic == null && formD.length > 0),
    periodicLast, periodicForms: [...periodicForms], formD,
  };
}

function monthsBefore(now: Date, months: number): string {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

export type FilerDecision =
  | { kind: 'none'; reason: string }
  | { kind: 'filer'; profile: FilerProfile; active: boolean; nameAgrees: boolean };

/** Exactly one health-care CIK, or none. */
export function decideFiler(profiles: FilerProfile[], names: string[], now = new Date()): FilerDecision {
  const health = profiles.filter(p => p.health);
  if (health.length === 0) return { kind: 'none', reason: profiles.length ? 'not a health-care filer' : 'no filer' };
  if (health.length > 1) return { kind: 'none', reason: `ambiguous: ${health.map(p => p.cik).join(',')}` };
  const p = health[0];
  const active = !!p.periodicLast && p.periodicLast >= monthsBefore(now, ACTIVE_MONTHS);
  const nameAgrees = names.some(n => nameAgreement(n, p.name) >= 80);
  return { kind: 'filer', profile: p, active, nameAgrees };
}

// ═══════════════════════════════════════════════════════════════════════
// NETWORK + RUNNER
// ═══════════════════════════════════════════════════════════════════════

/** Stream the lookup file line by line (40 MB; never held as one string). */
export async function* streamCikLookup(): AsyncGenerator<string> {
  const res = await fetchWithTimeout(EDGAR_CIK_LOOKUP_URL, { headers: { 'User-Agent': secUserAgent() }, timeoutMs: 120_000, retries: 1 });
  if (!res.ok || !res.body) throw new Error(`EDGAR cik-lookup-data ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder('latin1');
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      yield buf.slice(0, nl);
      buf = buf.slice(nl + 1);
    }
  }
  if (buf) yield buf;
}

async function scanStream(idx: Map<string, EdgarCandidate[]>): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  const batch: string[] = [];
  const flush = () => {
    for (const [id, ciks] of scanCikLookup(batch, idx)) {
      const s = out.get(id) ?? new Set<string>();
      ciks.forEach(c => s.add(c));
      out.set(id, s);
    }
    batch.length = 0;
  };
  for await (const line of streamCikLookup()) {
    batch.push(line);
    if (batch.length >= 20_000) flush();
  }
  flush();
  return out;
}

export interface EdgarRunResult {
  candidates: number;
  withCiks: number;
  processed: number;
  matched: number;
  activeFilers: number;
  ciksSet: number;
  inactiveFilers: number;
  formDCompanies: number;
  events: number;
  rejected: Record<string, number>;
  timedOut: boolean;
  errors: string[];
  sample: Array<{ company: string; cik: string; filer: string; kind: string }>;
}

/**
 * One pass: companies without any SEC link (cik, sec_cik, sec_inactive_cik, form_d_cik), never
 * checked or checked > 90 days ago (company_signal_edgar_candidates, migration 198).
 */
export async function runEdgarFilers(supabase: SupabaseClient, opts: { dryRun?: boolean; limit?: number; timeBudgetMs?: number; now?: Date } = {}): Promise<EdgarRunResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const budget = opts.timeBudgetMs ?? 230_000;
  const r: EdgarRunResult = { candidates: 0, withCiks: 0, processed: 0, matched: 0, activeFilers: 0, ciksSet: 0, inactiveFilers: 0, formDCompanies: 0, events: 0, rejected: {}, timedOut: false, errors: [], sample: [] };
  const { data, error } = await supabase.rpc('company_signal_edgar_candidates', { p_limit: opts.limit ?? 1500, p_recheck_days: EDGAR_RECHECK_DAYS });
  if (error) { r.errors.push(`edgar candidates: ${error.message}`); return r; }
  const companies = (data ?? []) as EdgarCandidate[];
  r.candidates = companies.length;
  if (!companies.length) return r;

  const ciksByCompany = await scanStream(candidateKeyIndex(companies));
  r.withCiks = ciksByCompany.size;
  const reject = (why: string) => { r.rejected[why] = (r.rejected[why] ?? 0) + 1; };

  for (const c of companies) {
    if (Date.now() - started > budget) { r.timedOut = true; break; }
    r.processed++;
    const patch: Record<string, unknown> = { edgar_checked_at: now.toISOString() };
    try {
      const ciks = [...(ciksByCompany.get(c.id) ?? [])];
      const names = [c.name, ...(c.name_variations ?? [])].filter(Boolean);
      if (ciks.length > MAX_CIKS_PER_COMPANY) reject('too many ciks');
      else if (ciks.length) {
        const profiles: FilerProfile[] = [];
        for (const cik of ciks) {
          const doc = await secGetJson<SubmissionsDoc>(`${EDGAR_SUBMISSIONS_URL}/CIK${padCik(cik)}.json`, 20_000);
          if (doc) profiles.push(filerProfile(doc, cik));
        }
        const d = decideFiler(profiles, names, now);
        if (d.kind === 'none') reject(d.reason.startsWith('ambiguous') ? 'ambiguous' : d.reason);
        else {
          const p = d.profile;
          patch.edgar_cik = p.cik;
          let produced = false;
          if (p.periodicLast) {
            produced = true;
            if (d.active) {
              r.activeFilers++;
              if (!opts.dryRun) {
                const { error: lErr } = await supabase.from('company_listings').upsert({
                  company_id: c.id, exchange: 'SEC_FILER', ticker: `CIK${p.cik}`, listed_name: p.name || c.name, listing_status: 'listed',
                  match_method: 'exact_name_en', resolution_confidence: d.nameAgrees ? 90 : 85, source: 'edgar_filer_index',
                  source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padCik(p.cik)}`, source_id: p.cik,
                  evidence: `EDGAR CIK ${p.cik} (SIC ${p.sic ?? 'n/a'}) files as "${p.name}"; latest periodic report ${p.periodicLast} (${p.periodicForms.slice(0, 4).join(', ')})`.slice(0, 500),
                  metadata: { sic: p.sic, renamed: !d.nameAgrees }, last_seen_at: now.toISOString(),
                }, { onConflict: 'company_id,exchange,ticker' });
                if (lErr) r.errors.push(`${c.name} listing: ${lErr.message}`);
              }
              if (d.nameAgrees) {
                const { count } = await supabase.from('companies').select('id', { count: 'exact', head: true }).eq('cik', p.cik).is('merged_into', null);
                if (!count) { patch.cik = p.cik; patch.sec_last_10k_at = p.periodicLast; r.ciksSet++; }
              }
            } else {
              r.inactiveFilers++;
              patch.sec_inactive_cik = p.cik;
              patch.sec_last_10k_at = p.periodicLast;
            }
          }
          if (p.formD.length) {
            const rows: FinancingEventRow[] = [];
            for (const h of p.formD.sort((a, b) => b.fileDate.localeCompare(a.fileDate)).slice(0, MAX_FORM_D_DOCS)) {
              const xml = await secGetText(formDDocUrl(h.cik, h.adsh, h.primaryDoc), 20_000);
              const doc = xml ? parseFormDXml(xml) : null;
              const row = doc ? formDEventRow(c.id, names, { ...h, filerName: doc.entityName }, doc, now) : null;
              if (row) rows.push(row);
            }
            if (rows.length) {
              produced = true;
              r.formDCompanies++;
              r.events += rows.length;
              patch.form_d_cik = p.cik;
              if (!opts.dryRun) {
                const up = await upsertFinancingEvents(supabase, rows);
                if (up.error) r.errors.push(`${c.name} form D: ${up.error}`);
              }
            } else reject('form D failed guards');
          }
          if (produced) {
            r.matched++;
            if (r.sample.length < 40) r.sample.push({ company: c.name, cik: p.cik, filer: p.name, kind: d.active ? 'active' : p.periodicLast ? 'inactive' : 'form_d' });
          } else reject('no periodic or form D');
        }
      } else reject('no exact-name filer');
      if (!opts.dryRun) {
        const { error: uErr } = await supabase.from('companies').update(patch).eq('id', c.id);
        if (uErr) r.errors.push(`${c.name} patch: ${uErr.message}`);
      }
    } catch (e) {
      r.errors.push(`${c.name}: ${e instanceof Error ? e.message.split('\n')[0].slice(0, 200) : String(e)}`);
    }
  }
  return r;
}
