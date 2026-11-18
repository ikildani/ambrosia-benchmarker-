/**
 * SEC Form D: private US financings (Search & Evaluation company signals, migration 189).
 *
 * A private company that sells securities under Regulation D files a Form D within 15 days of
 * the first sale; the filing states the offering size, the amount sold and the issuer's
 * industry group. For US feed companies without a public-filer CIK this is the only free
 * primary source on fundraising.
 *
 *   Discovery  EDGAR full-text search by entity name (forms=D), last 120 months (the backtest reads 10 years). A hit counts only
 *              when the filer name equals our company name (loose key keeps sector words, so
 *              "Acme Therapeutics" never matches "Acme Bio"), exactly one CIK matches, and the
 *              filing's industry group is health care. The CIK is stored on
 *              companies.form_d_cik so later runs query by CIK.
 *   Filings    primary_doc.xml of each Form D / D/A: dateOfFirstSale, totalOfferingAmount,
 *              totalAmountSold, industryGroupType. One company_financing_events row per
 *              accession; announced_at is the filing date (the day it became public), the first
 *              sale date is kept in metadata.
 *
 * Evidence is the filed values verbatim; source_url is the primary_doc.xml on sec.gov.
 * Fair access: SEC_USER_AGENT, shared < 10 req/s throttle (company-financials.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { looseCompanyKey, normalizeCompanyKey, padCik, secGetJson, secGetText, stripCik, SEC_FULL_TEXT_SEARCH_URL } from './company-financials';
import { upsertFinancingEvents, type FinancingEventRow } from './company-signals';

export const FORM_D_LOOKBACK_MONTHS = 120;
/** Re-search companies with no Form D match after this many days; matched companies refresh weekly. */
export const FORM_D_RECHECK_DAYS = 90;
export const FORM_D_REFRESH_DAYS = 7;
/** Industry groups (Form D item 4) that belong to a drug developer. */
export const FORM_D_HEALTH_GROUPS: ReadonlySet<string> = new Set(['Biotechnology', 'Pharmaceuticals', 'Other Health Care']);
const MAX_FILINGS_PER_COMPANY = 12;

// ═══════════════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════════════

export interface FormDHit {
  adsh: string;
  cik: string;
  filerName: string;
  form: 'D' | 'D/A' | string;
  fileDate: string;
  primaryDoc: string;
}

interface EftsFormDSource {
  adsh?: string;
  ciks?: string[];
  display_names?: string[];
  form?: string;
  file_date?: string;
  root_forms?: string[];
}

/**
 * "Ollin Biosciences, Inc.  (CIK 0002141184)" -> { name, cik }; listed filers carry their
 * ticker(s) before the CIK: "EAGLE PHARMACEUTICALS, INC.  (EGRX)  (CIK 0000827871)".
 */
export function parseDisplayName(display: string): { name: string; cik: string; tickers: string[] } | null {
  const m = /^(.*?)\s*\(CIK\s*0*(\d+)\)\s*$/.exec(display ?? '');
  if (!m) return null;
  let name = m[1].trim();
  let tickers: string[] = [];
  const t = /^(.*?)\s+\(([A-Z0-9.\-]{1,10}(?:,\s*[A-Z0-9.\-]{1,10})*)\)$/.exec(name);
  if (t) { name = t[1].trim(); tickers = t[2].split(/,\s*/); }
  return { name, cik: m[2], tickers };
}

export function parseEftsFormDHits(json: unknown, forms: ReadonlySet<string> = new Set(['D', 'D/A'])): FormDHit[] {
  const hits = (json as { hits?: { hits?: Array<{ _id?: string; _source?: EftsFormDSource }> } })?.hits?.hits ?? [];
  const out: FormDHit[] = [];
  for (const h of hits) {
    const src = h._source ?? {};
    const form = src.form ?? '';
    if (!forms.has(form)) continue;
    const disp = parseDisplayName(src.display_names?.[0] ?? '');
    const adsh = src.adsh ?? (h._id ?? '').split(':')[0];
    if (!disp || !adsh || !src.file_date) continue;
    out.push({ adsh, cik: disp.cik, filerName: disp.name, form, fileDate: src.file_date, primaryDoc: (h._id ?? '').split(':')[1] || 'primary_doc.xml' });
  }
  return out;
}

export type FormDNameMethod = 'exact' | 'strict';

/** "Orna Therapeutics Holdings, LLC" files for Orna Therapeutics: holding-company words are noise here. */
function holdingFree(key: string): string {
  return key.replace(/\b(holdings?|parent|topco|usa|us)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Conservative name equality. 'exact': loose keys equal (legal forms dropped, sector words
 * kept). 'strict': sector words dropped too, allowed only when the remaining key is at least
 * 6 characters (so "Acme" alone never matches). Containment never matches.
 */
export function formDNameMatch(filerName: string, companyNames: Array<string | null | undefined>): FormDNameMethod | null {
  const loose = holdingFree(looseCompanyKey(filerName));
  const strict = normalizeCompanyKey(filerName);
  let best: FormDNameMethod | null = null;
  for (const n of companyNames) {
    if (!n) continue;
    if (loose && holdingFree(looseCompanyKey(n)) === loose) return 'exact';
    const k = normalizeCompanyKey(n);
    if (strict && strict.length >= 6 && k === strict) best = 'strict';
  }
  return best;
}

/** Choose the single CIK whose filer name matches; null when none or more than one CIK matches. */
export function pickFormDCik(hits: FormDHit[], companyNames: Array<string | null | undefined>): { cik: string; method: FormDNameMethod; hits: FormDHit[] } | null {
  const byCik = new Map<string, { method: FormDNameMethod; hits: FormDHit[] }>();
  for (const h of hits) {
    const method = formDNameMatch(h.filerName, companyNames);
    if (!method) continue;
    const entry = byCik.get(h.cik) ?? { method, hits: [] };
    if (method === 'exact') entry.method = 'exact';
    entry.hits.push(h);
    byCik.set(h.cik, entry);
  }
  if (byCik.size !== 1) return null;
  const [cik, entry] = [...byCik.entries()][0];
  return { cik, method: entry.method, hits: entry.hits };
}

export interface FormDDoc {
  submissionType: string;
  entityName: string;
  cik: string;
  stateOrCountry: string | null;
  industryGroupType: string | null;
  dateOfFirstSale: string | null;
  yetToOccur: boolean;
  isAmendment: boolean;
  totalOfferingAmount: number | null;
  totalOfferingIndefinite: boolean;
  totalAmountSold: number | null;
  rawOffering: string | null;
  rawSold: string | null;
}

function tag(xml: string, name: string): string | null {
  const m = new RegExp(`<${name}>\\s*([\\s\\S]*?)\\s*</${name}>`).exec(xml);
  return m ? m[1].trim() : null;
}

function money(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Parse a Form D primary_doc.xml (schema X0708 and earlier). */
export function parseFormDXml(xml: string): FormDDoc | null {
  if (!xml || !/<edgarSubmission/.test(xml)) return null;
  const issuer = tag(xml, 'primaryIssuer') ?? '';
  const offering = tag(xml, 'offeringData') ?? '';
  const amounts = tag(offering, 'offeringSalesAmounts') ?? '';
  const firstSale = tag(offering, 'dateOfFirstSale') ?? '';
  const rawOffering = tag(amounts, 'totalOfferingAmount');
  const rawSold = tag(amounts, 'totalAmountSold');
  const dateVal = tag(firstSale, 'value');
  return {
    submissionType: tag(xml, 'submissionType') ?? '',
    entityName: tag(issuer, 'entityName') ?? '',
    cik: stripCik(tag(issuer, 'cik') ?? '0'),
    stateOrCountry: tag(tag(issuer, 'issuerAddress') ?? '', 'stateOrCountry'),
    industryGroupType: tag(tag(offering, 'industryGroup') ?? '', 'industryGroupType'),
    dateOfFirstSale: dateVal && /^\d{4}-\d{2}-\d{2}$/.test(dateVal) ? dateVal : null,
    yetToOccur: /<yetToOccur>\s*true/i.test(firstSale),
    isAmendment: /<isAmendment>\s*true/i.test(offering),
    totalOfferingAmount: money(rawOffering),
    totalOfferingIndefinite: /indefinite/i.test(rawOffering ?? ''),
    totalAmountSold: money(rawSold),
    rawOffering,
    rawSold,
  };
}

export function formDDocUrl(cik: string, adsh: string, primaryDoc = 'primary_doc.xml'): string {
  return `https://www.sec.gov/Archives/edgar/data/${stripCik(cik)}/${adsh.replace(/-/g, '')}/${primaryDoc}`;
}

/**
 * Turn one parsed Form D into a financing event, or null when it fails a guard: the filer name
 * on the document must still match the company, the industry group must be health care.
 */
export function formDEventRow(
  companyId: string,
  companyNames: Array<string | null | undefined>,
  hit: FormDHit,
  doc: FormDDoc,
  now = new Date(),
): FinancingEventRow | null {
  if (!formDNameMatch(doc.entityName, companyNames)) return null;
  if (!doc.industryGroupType || !FORM_D_HEALTH_GROUPS.has(doc.industryGroupType)) return null;
  const amendment = hit.form === 'D/A' || doc.isAmendment || doc.submissionType === 'D/A';
  const evidence = [
    `Form ${amendment ? 'D/A' : 'D'} filed ${hit.fileDate} by "${doc.entityName}" (CIK ${padCik(doc.cik || hit.cik)})`,
    `industryGroupType ${doc.industryGroupType}`,
    doc.dateOfFirstSale ? `dateOfFirstSale ${doc.dateOfFirstSale}` : doc.yetToOccur ? 'dateOfFirstSale yetToOccur' : null,
    doc.rawOffering != null ? `totalOfferingAmount ${doc.rawOffering}` : null,
    doc.rawSold != null ? `totalAmountSold ${doc.rawSold}` : null,
  ].filter(Boolean).join('; ');
  return {
    company_id: companyId,
    event_type: amendment ? 'form_d_amendment' : 'form_d',
    amount_usd: doc.totalAmountSold,
    amount_offered_usd: doc.totalOfferingIndefinite ? null : doc.totalOfferingAmount,
    currency: 'USD',
    announced_at: hit.fileDate,
    source: 'sec_form_d',
    source_url: formDDocUrl(hit.cik, hit.adsh, hit.primaryDoc),
    source_id: hit.adsh,
    evidence,
    industry_group: doc.industryGroupType,
    filer_cik: stripCik(hit.cik),
    metadata: { date_of_first_sale: doc.dateOfFirstSale, state: doc.stateOrCountry, offering_indefinite: doc.totalOfferingIndefinite },
    fetched_at: now.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// NETWORK
// ═══════════════════════════════════════════════════════════════════════

function isoMonthsAgo(now: Date, months: number): string {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** Form D / D/A hits by entity name (discovery) or by CIK (refresh). */
export async function searchFormD(query: { entityName?: string; cik?: string }, now = new Date()): Promise<FormDHit[]> {
  const params = new URLSearchParams({
    forms: 'D',
    dateRange: 'custom',
    startdt: isoMonthsAgo(now, FORM_D_LOOKBACK_MONTHS),
    enddt: now.toISOString().slice(0, 10),
  });
  if (query.cik) params.set('ciks', padCik(query.cik));
  else if (query.entityName) params.set('entityName', query.entityName);
  else return [];
  const json = await secGetJson<unknown>(`${SEC_FULL_TEXT_SEARCH_URL}?${params}`, 20_000);
  return json ? parseEftsFormDHits(json) : [];
}

/**
 * Public-filer CIK for a company that company_tickers.json does not list (Nov 17 2026: 25 US
 * feed companies carried a ticker but no CIK, all acquired or delisted, e.g. Seagen, Mirati,
 * ImmunoGen). Searches 10-K filings by entity name; a CIK is returned only when exactly one
 * filer's name equals the company name and it filed a 10-K within `activeMonths` (default 18).
 * Older filers are reported as `historical` but not returned as a match: aged XBRL from a filer
 * that stopped reporting would read as zero runway.
 */
export async function searchPeriodicFilerCik(
  names: Array<string | null | undefined>,
  now = new Date(),
  activeMonths = 18,
): Promise<{ cik: string | null; historicalCik: string | null; filerName: string | null; lastFiled: string | null }> {
  const clean = names.filter((n): n is string => !!n);
  for (const n of clean.slice(0, 2)) {
    const params = new URLSearchParams({ entityName: n.replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim(), forms: '10-K' });
    const json = await secGetJson<unknown>(`${SEC_FULL_TEXT_SEARCH_URL}?${params}`, 20_000);
    const hits = json ? parseEftsFormDHits(json, new Set(['10-K', '10-K/A', '10-KT'])) : [];
    if (!hits.length) continue;
    const pick = pickFormDCik(hits, clean);
    if (!pick || pick.method !== 'exact') return { cik: null, historicalCik: null, filerName: null, lastFiled: null };
    const lastFiled = pick.hits.map(h => h.fileDate).sort().reverse()[0] ?? null;
    const active = !!lastFiled && lastFiled >= isoMonthsAgo(now, activeMonths);
    return { cik: active ? pick.cik : null, historicalCik: active ? null : pick.cik, filerName: pick.hits[0].filerName, lastFiled };
  }
  return { cik: null, historicalCik: null, filerName: null, lastFiled: null };
}

export interface FormDCompany {
  id: string;
  name: string;
  name_variations?: string[] | null;
  form_d_cik?: string | null;
}

/** Discovery or refresh for one company; no DB writes. */
export async function formDEventsForCompany(c: FormDCompany, now = new Date()): Promise<{
  cik: string | null; method: FormDNameMethod | 'cik' | null; hits: number; rows: FinancingEventRow[]; rejected: number;
}> {
  const names = [c.name, ...(c.name_variations ?? [])].filter(Boolean);
  let cik = c.form_d_cik ? stripCik(c.form_d_cik) : null;
  let method: FormDNameMethod | 'cik' | null = cik ? 'cik' : null;
  let hits: FormDHit[];
  if (cik) {
    hits = await searchFormD({ cik }, now);
  } else {
    const all: FormDHit[] = [];
    // Name and up to two variations: the search tokenizes, so "Acme Therapeutics, Inc." and "Acme Therapeutics" return the same set.
    for (const n of names.slice(0, 3)) {
      all.push(...(await searchFormD({ entityName: n.replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim() }, now)));
      if (all.length) break;
    }
    const pick = pickFormDCik(all, names);
    if (!pick) return { cik: null, method: null, hits: all.length, rows: [], rejected: 0 };
    cik = pick.cik;
    method = pick.method;
    hits = pick.hits;
  }
  const rows: FinancingEventRow[] = [];
  let rejected = 0;
  const seen = new Set<string>();
  for (const h of hits.sort((a, b) => b.fileDate.localeCompare(a.fileDate)).slice(0, MAX_FILINGS_PER_COMPANY)) {
    if (seen.has(h.adsh)) continue;
    seen.add(h.adsh);
    const xml = await secGetText(formDDocUrl(h.cik, h.adsh, h.primaryDoc), 20_000);
    const doc = xml ? parseFormDXml(xml) : null;
    const row = doc ? formDEventRow(c.id, names, h, doc, now) : null;
    if (row) rows.push(row);
    else rejected++;
  }
  // A CIK whose every filing fails the guards (wrong industry, renamed filer) is not a match.
  if (rows.length === 0) return { cik: null, method: null, hits: hits.length, rows, rejected };
  return { cik, method, hits: hits.length, rows, rejected };
}

// ═══════════════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════════════

export interface FormDRunOptions {
  dryRun?: boolean;
  limit?: number;
  timeBudgetMs?: number;
  now?: Date;
}

export interface FormDRunResult {
  candidates: number;
  processed: number;
  /** Active 10-K filers found by name (companies.cik set; the financials cron takes over). */
  ciksResolved: number;
  /** 10-K filers that stopped filing (companies.sec_inactive_cik). */
  inactiveFilers: number;
  matched: number;
  events: number;
  rejectedFilings: number;
  timedOut: boolean;
  errors: string[];
  sample: Array<{ company: string; cik: string; method: string; events: number; latest: string | null }>;
}

/**
 * One pass over US feed companies without a public-filer CIK, least recently checked first
 * (company_signal_form_d_candidates, migration 189). Every checked company gets
 * form_d_checked_at so the queue advances whether or not a Form D was found.
 */
export async function runFormD(supabase: SupabaseClient, opts: FormDRunOptions = {}): Promise<FormDRunResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const budget = opts.timeBudgetMs ?? 240_000;
  const r: FormDRunResult = { candidates: 0, processed: 0, ciksResolved: 0, inactiveFilers: 0, matched: 0, events: 0, rejectedFilings: 0, timedOut: false, errors: [], sample: [] };
  const { data, error } = await supabase.rpc('company_signal_form_d_candidates', {
    p_limit: opts.limit ?? 80, p_recheck_days: FORM_D_RECHECK_DAYS, p_refresh_days: FORM_D_REFRESH_DAYS,
  });
  if (error) { r.errors.push(`form D candidates: ${error.message}`); return r; }
  const companies = (data ?? []) as FormDCompany[];
  r.candidates = companies.length;
  for (const c of companies) {
    if (Date.now() - started > budget) { r.timedOut = true; break; }
    r.processed++;
    try {
      const patch: Record<string, unknown> = { form_d_checked_at: now.toISOString() };
      // Public filers first: a company company_tickers.json does not list may still file 10-Ks.
      if (!c.form_d_cik) {
        const filer = await searchPeriodicFilerCik([c.name, ...(c.name_variations ?? [])], now);
        if (filer.cik) { r.ciksResolved++; patch.cik = filer.cik; patch.sec_last_10k_at = filer.lastFiled; }
        else if (filer.historicalCik) { r.inactiveFilers++; patch.sec_inactive_cik = filer.historicalCik; patch.sec_last_10k_at = filer.lastFiled; }
      }
      const res = await formDEventsForCompany(c, now);
      r.rejectedFilings += res.rejected;
      if (res.cik && res.rows.length) {
        r.matched++;
        r.events += res.rows.length;
        if (r.sample.length < 25) r.sample.push({ company: c.name, cik: res.cik, method: String(res.method), events: res.rows.length, latest: res.rows[0]?.announced_at ?? null });
      }
      if (opts.dryRun) continue;
      if (res.rows.length) {
        const up = await upsertFinancingEvents(supabase, res.rows);
        if (up.error) { r.errors.push(`${c.name}: ${up.error}`); continue; }
      }
      if (res.cik && !c.form_d_cik) patch.form_d_cik = res.cik;
      const { error: uErr } = await supabase.from('companies').update(patch).eq('id', c.id);
      if (uErr) r.errors.push(`${c.name} checked_at: ${uErr.message}`);
    } catch (e) {
      r.errors.push(`${c.name}: ${e instanceof Error ? e.message.split('\n')[0].slice(0, 200) : String(e)}`);
    }
  }
  return r;
}
