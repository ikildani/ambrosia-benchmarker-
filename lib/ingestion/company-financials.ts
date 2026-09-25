/**
 * Company financial pressure from primary SEC sources (Asset Radar, Phase 3
 * Workstream C). Writes `company_financials` (migration 114).
 *
 *   1. CIK resolution: SEC company_tickers.json matched by ticker, then by
 *      normalized name, stored on companies.cik.
 *   2. XBRL companyfacts: cash, short-term investments, operating cash flow,
 *      net loss, shares outstanding -> one row per fiscal period, with the
 *      trailing two-quarter burn and runway.
 *   3. Going concern: EDGAR full-text search for "substantial doubt" scoped to
 *      the company's latest 10-K / 10-Q accession.
 *   4. ATM / shelf: S-3, S-3ASR or 424B5 in the trailing 12 months from the
 *      submissions API.
 *
 * SEC fair-access rules: a User-Agent with a contact address is required
 * (env SEC_USER_AGENT) and requests are kept under 10/s.
 *
 * Pure helpers (exported for tests): deriveQuarterlyFlows, computeBurnAndRunway,
 * extractFinancialRows, detectGoingConcern, detectAtmOrShelf, matchCikEntry.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

export const SEC_COMPANY_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
export const SEC_COMPANYFACTS_URL = 'https://data.sec.gov/api/xbrl/companyfacts';
export const SEC_SUBMISSIONS_URL = 'https://data.sec.gov/submissions';
export const SEC_FULL_TEXT_SEARCH_URL = 'https://efts.sec.gov/LATEST/search-index';

const SYNC_SOURCE = 'company_financials';
const MIN_REQUEST_GAP_MS = 120; // < 10 req/s
const DEFAULT_TIME_BUDGET_MS = 240_000;
// 120 companies × 3 SEC calls at a 120 ms gap is ~45 s of a 240 s budget; at
// 6-hourly runs that covers ~500 filers a day, so a full pass over the listed
// biotechs takes two days instead of two weeks.
const DEFAULT_LIMIT = 120;
const MAX_PERIODS_PER_COMPANY = 12;

const CASH_TAGS = ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'];
const STI_TAGS = ['ShortTermInvestments', 'AvailableForSaleSecuritiesCurrent', 'MarketableSecuritiesCurrent', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'];
const OCF_TAGS = ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'];
const NET_INCOME_TAGS = ['NetIncomeLoss', 'ProfitLoss'];
const SHARES_TAGS_GAAP = ['CommonStockSharesOutstanding'];
const SHARES_TAGS_DEI = ['EntityCommonStockSharesOutstanding'];

const SHELF_FORMS = new Set(['S-3', 'S-3ASR', 'S-3/A', '424B5']);

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface XbrlFact {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy?: number;
  fp?: string;
  form: string;
  filed: string;
  frame?: string;
}

export interface CompanyFacts {
  cik: number;
  entityName?: string;
  facts?: {
    'us-gaap'?: Record<string, { units?: Record<string, XbrlFact[]> }>;
    dei?: Record<string, { units?: Record<string, XbrlFact[]> }>;
  };
}

export interface SecTickerEntry {
  cik_str: number | string;
  ticker: string;
  title: string;
}

export interface SubmissionsRecent {
  accessionNumber: string[];
  filingDate: string[];
  form: string[];
  primaryDocument: string[];
}

export interface Submissions {
  cik: string;
  name?: string;
  tickers?: string[];
  filings?: { recent?: SubmissionsRecent };
}

export interface FinancialRow {
  company_id: string;
  cik: string;
  fiscal_period_end: string;
  period_type: 'Q' | 'FY';
  cash_and_equivalents: number | null;
  short_term_investments: number | null;
  total_liquidity: number | null;
  operating_cash_flow: number | null;
  net_loss: number | null;
  quarterly_burn: number | null;
  runway_months: number | null;
  going_concern: boolean | null;
  atm_or_shelf_filed: boolean | null;
  shares_outstanding: number | null;
  market_cap_usd: number | null;
  source: 'sec_xbrl';
  source_url: string;
  filed_at: string | null;
  fetched_at: string;
}

export interface QuarterlyFlow {
  end: string;
  value: number;
  form: string;
  filed: string;
  accn: string;
  derived: 'direct' | 'diff';
}

export interface CompanyFinancialsRunResult {
  processed: number;
  ciksResolved: number;
  rowsUpserted: number;
  skippedNoCik: number;
  failed: number;
  errors: string[];
  timedOut: boolean;
  durationMs: number;
  cursor: string | null;
}

interface CursorState extends Record<string, unknown> {
  /** company_id -> last fiscal_period_end fetched. */
  byCompany?: Record<string, string>;
  /** ISO timestamp of the last CIK resolution pass. */
  lastCikResolveAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════════════

export function padCik(cik: string | number): string {
  return String(cik).replace(/^0+/, '').padStart(10, '0');
}

export function stripCik(cik: string | number): string {
  return String(cik).replace(/^0+/, '') || '0';
}

const CORPORATE_SUFFIX_RE =
  /\b(incorporated|inc|corporation|corp|company|co|limited|ltd|plc|llc|lp|ag|sa|nv|bv|se|holdings?|group|pharmaceuticals?|pharma|therapeutics|biosciences?|biotherapeutics|biotechnology|biotech|biopharma|biopharmaceuticals?|bio|sciences?|medical|medicines?|international|global|the)\b/g;

/**
 * SEC registrant titles carry state-of-incorporation and share-class noise:
 * "ACME THERAPEUTICS INC /DE/", "BETA BIO INC/NEW", "GAMMA PLC /ADR/",
 * "DELTA CORP (DE)". Before Sep 2026 that noise leaked into the name keys and
 * only 29 of 3,464 US industry companies ever resolved a CIK.
 */
export function stripSecTitleNoise(title: string): string {
  return (title ?? '')
    .replace(/\s*\/\s*[A-Za-z]{2,4}\s*\/?\s*$/g, ' ')   // trailing /DE/, /NEW, /ADR/
    .replace(/\s*\/\s*(new|old|adr|de|fi|ma|nj|ny|pa|ca|ga|wa|tx|ut|mn|nv|ct|va|md|oh)\b\s*\/?/gi, ' ')
    .replace(/\s*\((?:de|new|old|adr)\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Aggressive name key for SEC title matching: lowercase, strip punctuation and corporate suffixes. */
export function normalizeCompanyKey(name: string): string {
  return stripSecTitleNoise(name ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(CORPORATE_SUFFIX_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Loose key that keeps sector words (Acme Therapeutics vs Acme Biosciences stay distinct). */
export function looseCompanyKey(name: string): string {
  return stripSecTitleNoise(name ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|plc|llc|lp|ag|sa|nv|bv|se|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface CikIndex {
  byTicker: Map<string, SecTickerEntry>;
  byLooseName: Map<string, SecTickerEntry[]>;
  byStrictName: Map<string, SecTickerEntry[]>;
}

export function buildCikIndex(entries: SecTickerEntry[]): CikIndex {
  const byTicker = new Map<string, SecTickerEntry>();
  const byLooseName = new Map<string, SecTickerEntry[]>();
  const byStrictName = new Map<string, SecTickerEntry[]>();
  for (const e of entries) {
    if (!e || !e.title) continue;
    const t = (e.ticker || '').toUpperCase().trim();
    if (t && !byTicker.has(t)) byTicker.set(t, e);
    const loose = looseCompanyKey(e.title);
    if (loose) {
      const list = byLooseName.get(loose) ?? [];
      if (!list.some(x => stripCik(x.cik_str) === stripCik(e.cik_str))) list.push(e);
      byLooseName.set(loose, list);
    }
    const strict = normalizeCompanyKey(e.title);
    if (strict && strict.length >= 4) {
      const list = byStrictName.get(strict) ?? [];
      if (!list.some(x => stripCik(x.cik_str) === stripCik(e.cik_str))) list.push(e);
      byStrictName.set(strict, list);
    }
  }
  return { byTicker, byLooseName, byStrictName };
}

/**
 * Match one company to an SEC entry. Ticker first (exact, exchange suffix
 * stripped), then the loose name key (unique match only), then the strict key
 * (unique match only). Returns the CIK without leading zeros or null.
 */
export function matchCikEntry(
  company: { name: string; ticker?: string | null; name_variations?: string[] | null },
  index: CikIndex,
): { cik: string; method: 'ticker' | 'name' | 'name_strict'; title: string } | null {
  const rawTicker = (company.ticker || '').toUpperCase().trim();
  if (rawTicker) {
    // "NASDAQ:MRNA" -> MRNA (exchange prefix); "BRK.B" -> BRK (share class).
    const candidates = [rawTicker];
    if (rawTicker.includes(':')) candidates.push(rawTicker.split(':').pop() as string);
    if (rawTicker.includes('.')) candidates.push(rawTicker.split('.')[0]);
    for (const c of candidates.filter(Boolean)) {
      const hit = index.byTicker.get(c);
      if (hit) return { cik: stripCik(hit.cik_str), method: 'ticker', title: hit.title };
    }
  }
  const names = [company.name, ...(company.name_variations ?? [])].filter(Boolean);
  for (const n of names) {
    const hits = index.byLooseName.get(looseCompanyKey(n));
    if (hits && hits.length === 1) return { cik: stripCik(hits[0].cik_str), method: 'name', title: hits[0].title };
  }
  for (const n of names) {
    const key = normalizeCompanyKey(n);
    if (key.length < 4) continue;
    const hits = index.byStrictName.get(key);
    if (hits && hits.length === 1) return { cik: stripCik(hits[0].cik_str), method: 'name_strict', title: hits[0].title };
  }
  return null;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function isoMinusMonths(date: string, months: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** Prefer the latest filing for a given (start,end) pair so restatements win. */
function dedupeFacts(facts: XbrlFact[]): XbrlFact[] {
  const map = new Map<string, XbrlFact>();
  for (const f of facts) {
    if (!f || typeof f.val !== 'number' || !f.end) continue;
    const key = `${f.start ?? ''}|${f.end}`;
    const prev = map.get(key);
    if (!prev || (f.filed ?? '') > (prev.filed ?? '')) map.set(key, f);
  }
  return [...map.values()];
}

/**
 * Cash-flow facts in companyfacts are cumulative year-to-date for 10-Qs and
 * annual for 10-Ks. Turn them into discrete quarters: a ~3-month duration is
 * a quarter as-is; a 6/9/12-month duration minus the duration with the same
 * start that ends one quarter earlier gives the latest quarter.
 */
export function deriveQuarterlyFlows(facts: XbrlFact[]): QuarterlyFlow[] {
  const durations = dedupeFacts(facts).filter(f => f.start);
  const byStart = new Map<string, XbrlFact[]>();
  for (const f of durations) {
    const list = byStart.get(f.start as string) ?? [];
    list.push(f);
    byStart.set(f.start as string, list);
  }
  const out = new Map<string, QuarterlyFlow>();
  for (const f of durations) {
    const len = daysBetween(f.start as string, f.end);
    if (len >= 75 && len <= 105) {
      const prev = out.get(f.end);
      if (!prev || prev.derived === 'diff' || (f.filed ?? '') > prev.filed) {
        out.set(f.end, { end: f.end, value: f.val, form: f.form, filed: f.filed, accn: f.accn, derived: 'direct' });
      }
      continue;
    }
    if (len < 150) continue;
    const siblings = byStart.get(f.start as string) ?? [];
    const priorEnd = isoMinusMonths(f.end, 3);
    const prior = siblings.find(s => s !== f && Math.abs(daysBetween(s.end, priorEnd)) <= 12);
    if (!prior) continue;
    if (out.has(f.end) && out.get(f.end)!.derived === 'direct') continue;
    out.set(f.end, { end: f.end, value: f.val - prior.val, form: f.form, filed: f.filed, accn: f.accn, derived: 'diff' });
  }
  return [...out.values()].sort((a, b) => a.end.localeCompare(b.end));
}

/**
 * quarterly_burn = average of the negative operating cash flows over the
 * trailing two quarters ending at `periodEnd` (positive USD). A quarter with
 * positive OCF contributes zero burn. Runway = liquidity / (burn / 3).
 */
export function computeBurnAndRunway(
  periodEnd: string,
  quarterlyFlows: QuarterlyFlow[],
  totalLiquidity: number | null,
): { quarterly_burn: number | null; runway_months: number | null } {
  const trailing = quarterlyFlows
    .filter(q => q.end <= periodEnd && daysBetween(q.end, periodEnd) <= 200)
    .sort((a, b) => b.end.localeCompare(a.end))
    .slice(0, 2);
  if (trailing.length === 0) return { quarterly_burn: null, runway_months: null };
  const burns = trailing.map(q => (q.value < 0 ? -q.value : 0));
  const quarterlyBurn = burns.reduce((s, v) => s + v, 0) / burns.length;
  if (quarterlyBurn <= 0) return { quarterly_burn: 0, runway_months: null };
  if (totalLiquidity == null) return { quarterly_burn: round2(quarterlyBurn), runway_months: null };
  const monthly = quarterlyBurn / 3;
  return { quarterly_burn: round2(quarterlyBurn), runway_months: round1(totalLiquidity / monthly) };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function unitsFor(facts: CompanyFacts, taxonomy: 'us-gaap' | 'dei', tags: string[], unit: string): XbrlFact[] {
  const tax = facts.facts?.[taxonomy] as Record<string, { units?: Record<string, XbrlFact[]> }> | undefined;
  if (!tax) return [];
  for (const tag of tags) {
    const u = tax[tag]?.units?.[unit];
    if (u && u.length > 0) return u;
  }
  return [];
}

/** Latest instant value at or within 10 days before `end`. */
function instantAt(facts: XbrlFact[], end: string): XbrlFact | null {
  let best: XbrlFact | null = null;
  for (const f of facts) {
    if (f.start) continue;
    const gap = daysBetween(f.end, end);
    if (gap < 0 || gap > 10) continue;
    if (!best || (f.filed ?? '') > (best.filed ?? '')) best = f;
  }
  return best;
}

/** dei shares are reported "as of" a cover-page date after period end; take the nearest within 120 days. */
function sharesNear(deiFacts: XbrlFact[], gaapFacts: XbrlFact[], end: string): number | null {
  const gaap = instantAt(gaapFacts, end);
  if (gaap) return gaap.val;
  let best: XbrlFact | null = null;
  for (const f of deiFacts) {
    const gap = daysBetween(end, f.end);
    if (gap < -10 || gap > 120) continue;
    if (!best || Math.abs(daysBetween(end, f.end)) < Math.abs(daysBetween(end, best.end))) best = f;
  }
  return best ? best.val : null;
}

export interface ExtractOptions {
  /** Only periods ending after this date (cursor). */
  afterPeriodEnd?: string | null;
  maxPeriods?: number;
  goingConcern?: boolean | null;
  atmOrShelf?: boolean | null;
  now?: Date;
}

/**
 * Build one FinancialRow per balance-sheet period (10-Q and 10-K) from a
 * companyfacts payload. Periods are keyed by cash-fact `end` dates; the burn
 * and runway use the de-cumulated OCF series.
 */
export function extractFinancialRows(
  facts: CompanyFacts,
  companyId: string,
  cik: string,
  opts: ExtractOptions = {},
): FinancialRow[] {
  const cash = dedupeFacts(unitsFor(facts, 'us-gaap', CASH_TAGS, 'USD'));
  const sti = dedupeFacts(unitsFor(facts, 'us-gaap', STI_TAGS, 'USD'));
  const ocf = unitsFor(facts, 'us-gaap', OCF_TAGS, 'USD');
  const netIncome = unitsFor(facts, 'us-gaap', NET_INCOME_TAGS, 'USD');
  const sharesGaap = unitsFor(facts, 'us-gaap', SHARES_TAGS_GAAP, 'shares');
  const sharesDei = unitsFor(facts, 'dei', SHARES_TAGS_DEI, 'shares');

  const quarterlyOcf = deriveQuarterlyFlows(ocf);
  const quarterlyNi = deriveQuarterlyFlows(netIncome);
  const fetchedAt = (opts.now ?? new Date()).toISOString();
  const padded = padCik(cik);

  const periods = new Map<string, XbrlFact>();
  for (const f of cash) {
    if (f.start) continue;
    if (!['10-K', '10-Q', '10-K/A', '10-Q/A', '20-F', '40-F'].includes(f.form)) continue;
    if (opts.afterPeriodEnd && f.end <= opts.afterPeriodEnd) continue;
    const prev = periods.get(f.end);
    if (!prev || (f.filed ?? '') > (prev.filed ?? '')) periods.set(f.end, f);
  }

  const ends = [...periods.keys()].sort().reverse().slice(0, opts.maxPeriods ?? MAX_PERIODS_PER_COMPANY);
  const rows: FinancialRow[] = [];
  for (const end of ends) {
    const cashFact = periods.get(end)!;
    const stiFact = instantAt(sti, end);
    const cashVal = cashFact.val;
    const stiVal = stiFact ? stiFact.val : null;
    const liquidity = cashVal + (stiVal ?? 0);
    const q = quarterlyOcf.find(x => x.end === end) ?? null;
    const ni = quarterlyNi.find(x => x.end === end) ?? null;
    const { quarterly_burn, runway_months } = computeBurnAndRunway(end, quarterlyOcf, liquidity);
    const isAnnual = cashFact.fp === 'FY' || cashFact.form.startsWith('10-K') || cashFact.form === '20-F' || cashFact.form === '40-F';
    const accn = (cashFact.accn ?? '').replace(/-/g, '');
    rows.push({
      company_id: companyId,
      cik: stripCik(cik),
      fiscal_period_end: end,
      period_type: isAnnual ? 'FY' : 'Q',
      cash_and_equivalents: cashVal,
      short_term_investments: stiVal,
      total_liquidity: liquidity,
      operating_cash_flow: q ? q.value : null,
      net_loss: ni ? ni.value : null,
      quarterly_burn,
      runway_months,
      going_concern: opts.goingConcern ?? null,
      atm_or_shelf_filed: opts.atmOrShelf ?? null,
      shares_outstanding: sharesNear(sharesDei, sharesGaap, end),
      market_cap_usd: null,
      source: 'sec_xbrl',
      source_url: accn
        ? `https://www.sec.gov/Archives/edgar/data/${stripCik(cik)}/${accn}/`
        : `${SEC_COMPANYFACTS_URL}/CIK${padded}.json`,
      filed_at: cashFact.filed ?? null,
      fetched_at: fetchedAt,
    });
  }
  // Going-concern / ATM flags describe the present; only stamp the newest row.
  rows.forEach((r, i) => {
    if (i > 0) {
      r.going_concern = null;
      r.atm_or_shelf_filed = null;
    }
  });
  return rows;
}

export interface FilingRef {
  accessionNumber: string;
  form: string;
  filingDate: string;
  primaryDocument: string;
}

export function listRecentFilings(sub: Submissions): FilingRef[] {
  const r = sub.filings?.recent;
  if (!r) return [];
  const out: FilingRef[] = [];
  for (let i = 0; i < r.accessionNumber.length; i++) {
    out.push({
      accessionNumber: r.accessionNumber[i],
      form: r.form[i],
      filingDate: r.filingDate[i],
      primaryDocument: r.primaryDocument?.[i] ?? '',
    });
  }
  return out;
}

/** True when an S-3 / S-3ASR / 424B5 was filed in the trailing 12 months. */
export function detectAtmOrShelf(filings: FilingRef[], now = new Date()): { filed: boolean; latest: FilingRef | null } {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const hits = filings.filter(f => SHELF_FORMS.has(f.form) && f.filingDate >= cutoffIso).sort((a, b) => b.filingDate.localeCompare(a.filingDate));
  return { filed: hits.length > 0, latest: hits[0] ?? null };
}

export function latestPeriodicFiling(filings: FilingRef[]): FilingRef | null {
  return filings
    .filter(f => f.form === '10-K' || f.form === '10-Q' || f.form === '20-F')
    .sort((a, b) => b.filingDate.localeCompare(a.filingDate))[0] ?? null;
}

export interface EftsHit {
  _id?: string;
  _source: { accession_number?: string; adsh?: string; form?: string; file_date?: string; ciks?: string[] };
}

/**
 * Going concern = the full-text search returned a hit for the company's most
 * recent 10-K / 10-Q accession. Scoping to the latest filing avoids marking
 * companies whose risk-factor boilerplate mentioned the phrase years ago.
 */
export function detectGoingConcern(hits: EftsHit[], latest: FilingRef | null): boolean | null {
  if (!latest) return null;
  const target = latest.accessionNumber.replace(/-/g, '');
  return hits.some(h => {
    const acc = (h._source?.accession_number ?? h._source?.adsh ?? '').replace(/-/g, '');
    return acc === target;
  });
}

// ═══════════════════════════════════════════════════════════════════════
// NETWORK
// ═══════════════════════════════════════════════════════════════════════

export function secUserAgent(): string {
  const ua = process.env.SEC_USER_AGENT?.trim();
  if (ua) return ua;
  console.warn('[company-financials] SEC_USER_AGENT not set; falling back to default contact UA');
  return 'Solidus research@ambrosiaventures.co';
}

let lastRequestAt = 0;
async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function secGetJson<T>(url: string, timeoutMs = 20_000): Promise<T | null> {
  await throttle();
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': secUserAgent(), Accept: 'application/json' },
    timeoutMs,
    retries: 1,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`SEC ${res.status} for ${url}`);
  return (await res.json()) as T;
}

export async function fetchCompanyTickers(): Promise<SecTickerEntry[]> {
  const data = await secGetJson<Record<string, SecTickerEntry> | SecTickerEntry[]>(SEC_COMPANY_TICKERS_URL, 30_000);
  if (!data) return [];
  return Array.isArray(data) ? data : Object.values(data);
}

export async function fetchCompanyFacts(cik: string): Promise<CompanyFacts | null> {
  return secGetJson<CompanyFacts>(`${SEC_COMPANYFACTS_URL}/CIK${padCik(cik)}.json`, 30_000);
}

export async function fetchSubmissions(cik: string): Promise<Submissions | null> {
  return secGetJson<Submissions>(`${SEC_SUBMISSIONS_URL}/CIK${padCik(cik)}.json`, 20_000);
}

export async function searchGoingConcernHits(cik: string, now = new Date()): Promise<EftsHit[]> {
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - 15);
  const params = new URLSearchParams({
    q: '"substantial doubt"',
    ciks: padCik(cik),
    forms: '10-K,10-Q,20-F',
    dateRange: 'custom',
    startdt: start.toISOString().slice(0, 10),
    enddt: now.toISOString().slice(0, 10),
    from: '0',
    size: '20',
  });
  const data = await secGetJson<{ hits?: { hits?: EftsHit[] } }>(`${SEC_FULL_TEXT_SEARCH_URL}?${params}`, 20_000);
  return data?.hits?.hits ?? [];
}

// ═══════════════════════════════════════════════════════════════════════
// CIK RESOLUTION
// ═══════════════════════════════════════════════════════════════════════

interface CompanyLite {
  id: string;
  name: string;
  ticker: string | null;
  cik: string | null;
  sec_cik?: string | null;
  name_variations: string[] | null;
  owner_type?: string | null;
}

/**
 * Resolve CIKs for every company with a ticker, plus industry companies whose
 * name matches an SEC registrant uniquely. Writes companies.cik. Returns the
 * number of companies newly resolved.
 */
export async function resolveCiks(
  supabase: SupabaseClient,
  opts: { maxNameCandidates?: number } = {},
): Promise<{ resolved: number; checked: number; errors: string[] }> {
  const errors: string[] = [];
  let entries: SecTickerEntry[];
  try {
    entries = await fetchCompanyTickers();
  } catch (err) {
    return { resolved: 0, checked: 0, errors: [`company_tickers.json: ${errMsg(err)}`] };
  }
  if (entries.length === 0) return { resolved: 0, checked: 0, errors: ['company_tickers.json returned no entries'] };
  const index = buildCikIndex(entries);

  // Seed from sec_cik when present (migration 019) — no network needed.
  const { data: seedRows } = await supabase
    .from('companies')
    .select('id, sec_cik')
    .is('cik', null)
    .not('sec_cik', 'is', null)
    .limit(2000);
  let resolved = 0;
  for (const row of (seedRows ?? []) as Array<{ id: string; sec_cik: string }>) {
    const cik = stripCik(row.sec_cik);
    if (!cik || cik === '0') continue;
    const { error } = await supabase.from('companies').update({ cik }).eq('id', row.id);
    if (!error) resolved++;
  }

  // Ticker holders first.
  const { data: tickerRows, error: tErr } = await supabase
    .from('companies')
    .select('id, name, ticker, cik, name_variations')
    .is('cik', null)
    .not('ticker', 'is', null)
    .limit(2000);
  if (tErr) errors.push(`companies ticker read: ${tErr.message}`);

  // Then every industry company without a CIK. Matching is an in-memory map
  // lookup, so there is no reason to cap this: the old 4,000-row cap ordered
  // by pipeline_assets_count (null for the ~23k sponsor-created companies)
  // never reached the US biotechs the CT.gov sweep had added.
  const nameRows: CompanyLite[] = [];
  const maxNames = opts.maxNameCandidates ?? 30_000;
  const PAGE = 1000;
  for (let from = 0; from < maxNames; from += PAGE) {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, ticker, cik, name_variations')
      .is('cik', null)
      .is('ticker', null)
      .eq('owner_type', 'industry')
      .order('id', { ascending: true })
      .range(from, Math.min(from + PAGE, maxNames) - 1);
    if (error) { errors.push(`companies name read: ${error.message}`); break; }
    nameRows.push(...((data ?? []) as CompanyLite[]));
    if ((data ?? []).length < PAGE) break;
  }

  const candidates = [...((tickerRows ?? []) as CompanyLite[]), ...nameRows];
  const claimed = new Set<string>();
  for (const c of candidates) {
    const hit = matchCikEntry(c, index);
    if (!hit) continue;
    // Name matches are unique per SEC entry; never assign one CIK to two companies in a pass.
    if (hit.method !== 'ticker' && claimed.has(hit.cik)) continue;
    claimed.add(hit.cik);
    const { error } = await supabase.from('companies').update({ cik: hit.cik }).eq('id', c.id);
    if (error) errors.push(`cik write ${c.name}: ${error.message}`);
    else resolved++;
  }
  return { resolved, checked: candidates.length, errors };
}

// ═══════════════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════════════

export interface CompanyFinancialsOptions {
  limit?: number;
  timeBudgetMs?: number;
  /** Force CIK resolution even if it ran in the last 24h. */
  resolveCiks?: boolean;
  now?: Date;
}

export async function runCompanyFinancials(
  supabase: SupabaseClient,
  opts: CompanyFinancialsOptions = {},
): Promise<CompanyFinancialsRunResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const budget = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const errors: string[] = [];
  const result: CompanyFinancialsRunResult = {
    processed: 0, ciksResolved: 0, rowsUpserted: 0, skippedNoCik: 0, failed: 0,
    errors, timedOut: false, durationMs: 0, cursor: null,
  };
  const outOfTime = () => Date.now() - started > budget;

  const cursor = await readSyncCursor<CursorState>(supabase, SYNC_SOURCE);
  const state: CursorState = { byCompany: { ...(cursor.state.byCompany ?? {}) }, lastCikResolveAt: cursor.state.lastCikResolveAt };

  // Daily CIK resolution pass.
  const lastResolve = state.lastCikResolveAt ? Date.parse(state.lastCikResolveAt) : 0;
  if (opts.resolveCiks || now.getTime() - lastResolve > 24 * 3600_000) {
    const r = await resolveCiks(supabase);
    result.ciksResolved = r.resolved;
    errors.push(...r.errors);
    state.lastCikResolveAt = now.toISOString();
  }

  // Round-robin over companies with a CIK, resuming after the cursor.
  let query = supabase
    .from('companies')
    .select('id, name, ticker, cik, name_variations')
    .not('cik', 'is', null)
    .order('id', { ascending: true })
    .limit(limit);
  if (cursor.cursor) query = query.gt('id', cursor.cursor);
  let { data: companies, error: cErr } = await query;
  if (cErr) {
    errors.push(`companies read: ${cErr.message}`);
    companies = [];
  }
  let wrapped = false;
  if ((companies ?? []).length === 0 && cursor.cursor) {
    wrapped = true;
    const again = await supabase
      .from('companies')
      .select('id, name, ticker, cik, name_variations')
      .not('cik', 'is', null)
      .order('id', { ascending: true })
      .limit(limit);
    companies = again.data ?? [];
  }

  let lastId: string | null = wrapped ? null : cursor.cursor;
  for (const c of (companies ?? []) as CompanyLite[]) {
    if (outOfTime()) {
      result.timedOut = true;
      break;
    }
    lastId = c.id;
    const cik = c.cik ? stripCik(c.cik) : null;
    if (!cik) {
      result.skippedNoCik++;
      continue;
    }
    result.processed++;
    try {
      const [facts, submissions] = await Promise.all([fetchCompanyFacts(cik), fetchSubmissions(cik)]);
      if (!facts) {
        result.skippedNoCik++;
        continue;
      }
      const filings = submissions ? listRecentFilings(submissions) : [];
      const latest = latestPeriodicFiling(filings);
      const atm = detectAtmOrShelf(filings, now);
      let goingConcern: boolean | null = null;
      try {
        const hits = await searchGoingConcernHits(cik, now);
        goingConcern = detectGoingConcern(hits, latest);
      } catch (err) {
        errors.push(`efts ${c.name}: ${errMsg(err)}`);
      }
      const after = state.byCompany?.[c.id] ?? null;
      const rows = extractFinancialRows(facts, c.id, cik, {
        afterPeriodEnd: after,
        goingConcern,
        atmOrShelf: atm.filed,
        now,
      });
      if (rows.length === 0) {
        // Nothing new; still refresh the present-tense flags on the newest stored row.
        if (after) {
          await supabase
            .from('company_financials')
            .update({ going_concern: goingConcern, atm_or_shelf_filed: atm.filed, fetched_at: now.toISOString() })
            .eq('company_id', c.id)
            .eq('fiscal_period_end', after);
        }
        continue;
      }
      const { error: upErr } = await supabase
        .from('company_financials')
        .upsert(rows, { onConflict: 'company_id,fiscal_period_end,period_type' });
      if (upErr) {
        result.failed++;
        errors.push(`upsert ${c.name}: ${upErr.message}`);
        continue;
      }
      result.rowsUpserted += rows.length;
      state.byCompany![c.id] = rows[0].fiscal_period_end;
    } catch (err) {
      result.failed++;
      errors.push(`${c.name}: ${errMsg(err)}`);
    }
  }

  result.cursor = lastId;
  try {
    await writeSyncCursor(supabase, SYNC_SOURCE, lastId, state);
  } catch (err) {
    errors.push(`cursor write: ${errMsg(err)}`);
  }
  result.durationMs = Date.now() - started;
  return result;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
