/**
 * Exchange listings: listed status of feed companies from official, free exchange lists
 * (Search & Evaluation company signals v2, migration 198 company_listings).
 *
 *   SSE        query.sse.com.cn A-share + STAR lists (full Chinese and English names, listing date)
 *   SZSE       szse.cn A-share list xlsx (full Chinese / English names, listing date, shares, website)
 *   JPX        jpx.co.jp "List of TSE-listed Issues" (English names, sector)
 *   KRX        kind.krx.co.kr corporate list (Korean names, listing date, homepage)
 *   TWSE/TPEx  openapi company profiles (Chinese names, listing date, shares, website)
 *   ASX        ASXListedCompanies.csv (names, GICS industry group)
 *   TSX/TSXV   tsx.com company directory JSON
 *   Euronext   live.euronext.com equities CSV (all Euronext venues incl. Oslo)
 *   SIX        six-group.com equity issuers CSV
 *   SEC        company_tickers_exchange.json, joined on companies.cik only (name resolution of
 *              US filers is resolveCiks' job in company-financials.ts)
 *
 * Resolution (pure, matchListings): companies.ticker with an exchange suffix confirmed by name
 * agreement (95); CIK (98); exact Chinese full-name key (92); exact English or local-script key
 * (90); website registrable domain from a trusted website source (85). A key shared by several
 * issuers of one exchange, or one issuer claimed by more than three unrelated company rows, is
 * dropped as ambiguous. Nothing below 85 is written.
 *
 * Network: one request per list (Euronext POST, SSE needs a Referer), generic research UA.
 * Rows of an exchange whose list fetched cleanly and that were not seen in this run are deleted.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { strFromU8, unzipSync } from 'fflate';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { secGetJson, stripCik } from './company-financials';
import { decodeHtmlEntities } from './company-signals';
import {
  SIGNAL_USER_AGENT, TRUSTED_WEBSITE_SOURCES, cjkKey, companyKeys, hasCjk, isDistinctiveCjkKey, isDistinctiveKey,
  loadMatchSubjects, nameAgreement, nameKey, urlDomain, type MatchSubject,
} from './signal-match';

export type ListingExchange =
  | 'SSE' | 'SZSE' | 'BSE_CN' | 'HKEX' | 'JPX' | 'KRX' | 'TWSE' | 'TPEX' | 'ASX' | 'TSX' | 'TSXV'
  | 'EURONEXT' | 'SIX' | 'NASDAQ' | 'NYSE' | 'NYSE_AMERICAN' | 'CBOE' | 'OTC';

export type ListingMatchMethod = 'cik' | 'ticker' | 'exact_name_en' | 'exact_name_cn' | 'exact_name_local' | 'website_domain';

export interface ListingEntry {
  exchange: ListingExchange;
  market: string | null;
  ticker: string;
  nameEn: string | null;
  /** Chinese / Japanese / Korean legal or short name. */
  nameLocal: string | null;
  listedAt: string | null;
  website: string | null;
  shares: number | null;
  cik: string | null;
  sourceUrl: string;
}

export const LISTING_SOURCES = {
  SSE: 'https://query.sse.com.cn/sseQuery/commonQuery.do',
  SZSE: 'https://www.szse.cn/api/report/ShowReport?SHOWTYPE=xlsx&CATALOGID=1110&TABKEY=tab1',
  JPX: 'https://www.jpx.co.jp/english/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_e.xlsx',
  KRX: 'https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13',
  TWSE: 'https://openapi.twse.com.tw/v1/opendata/t187ap03_L',
  TPEX: 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O',
  ASX: 'https://www.asx.com.au/asx/research/ASXListedCompanies.csv',
  TSX: 'https://www.tsx.com/json/company-directory/search/tsx/%5E*',
  TSXV: 'https://www.tsx.com/json/company-directory/search/tsxv/%5E*',
  EURONEXT: 'https://live.euronext.com/en/pd_es/data/stocks/download?mics=dm_all_stock&display_datapoints=dp_stocks&display_filters=df_stocks',
  SIX: 'https://www.six-group.com/sheldon/equity_issuers/v1/equity_issuers.csv',
  SEC: 'https://www.sec.gov/files/company_tickers_exchange.json',
} as const;

/** Lists fetched per run; SEC is keyed separately because its rows are CIK-joined. */
export type ListingSourceKey = keyof typeof LISTING_SOURCES;

// ═══════════════════════════════════════════════════════════════════════
// PARSERS (pure)
// ═══════════════════════════════════════════════════════════════════════

function isoDate(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  let m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
}

function num(raw: unknown): number | null {
  const s = String(raw ?? '').replace(/[,\s]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function blankToNull(s: unknown): string | null {
  const t = String(s ?? '').trim();
  return t && t !== '-' && t !== '－' ? t : null;
}

/** Minimal RFC 4180 CSV parser (quoted fields, doubled quotes, any delimiter). */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** First worksheet of an xlsx as rows of strings (shared + inline strings). */
export function readXlsxRows(buf: Uint8Array): string[][] {
  const files = unzipSync(buf, { filter: f => f.name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet1\.xml$/.test(f.name) });
  const sheet = files['xl/worksheets/sheet1.xml'];
  if (!sheet) throw new Error('xlsx: sheet1.xml missing');
  const shared: string[] = [];
  const ss = files['xl/sharedStrings.xml'];
  if (ss) {
    const xml = strFromU8(ss);
    for (const si of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      shared.push(decodeHtmlEntities([...si[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
    }
  }
  const out: string[][] = [];
  const xml = strFromU8(sheet);
  for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+)\d+"/.exec(c[1])?.[1];
      if (!ref) continue;
      let col = 0;
      for (const ch of ref) col = col * 26 + (ch.charCodeAt(0) - 64);
      const type = /\bt="(\w+)"/.exec(c[1])?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[2] ?? '')?.[1];
      const inline = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(c[2] ?? '')?.[1];
      let val = '';
      if (type === 's' && v != null) val = shared[Number(v)] ?? '';
      else if (inline != null) val = decodeHtmlEntities(inline);
      else if (v != null) val = decodeHtmlEntities(v);
      cells[col - 1] = val.trim();
    }
    out.push(Array.from(cells, x => x ?? ''));
  }
  return out;
}

interface SseRow { A_STOCK_CODE?: string; FULL_NAME?: string; FULL_NAME_IN_ENGLISH?: string; COMPANY_ABBR?: string; LIST_DATE?: string; DELIST_DATE?: string }

export function parseSseJson(json: unknown, market: string): ListingEntry[] {
  const rows = ((json as { pageHelp?: { data?: SseRow[] } })?.pageHelp?.data ?? []) as SseRow[];
  return rows.filter(r => r.A_STOCK_CODE && r.FULL_NAME && (!r.DELIST_DATE || r.DELIST_DATE === '-')).map(r => ({
    exchange: 'SSE', market, ticker: String(r.A_STOCK_CODE), nameEn: blankToNull(r.FULL_NAME_IN_ENGLISH),
    nameLocal: blankToNull(r.FULL_NAME), listedAt: isoDate(r.LIST_DATE), website: null, shares: null, cik: null,
    sourceUrl: LISTING_SOURCES.SSE,
  }));
}

/** SZSE A-share list: 板块, 公司全称, 英文名称, 注册地址, A股代码, A股简称, A股上市日期, A股总股本, ..., 公司网址 (col 18). */
export function parseSzseRows(rows: string[][]): ListingEntry[] {
  const header = rows[0] ?? [];
  const col = (label: string) => header.findIndex(h => h.replace(/\s/g, '') === label);
  const iFull = col('公司全称'), iEn = col('英文名称'), iCode = col('A股代码'), iDate = col('A股上市日期'), iShares = col('A股总股本'), iWeb = col('公司网址'), iBoard = col('板块');
  if (iFull < 0 || iCode < 0) throw new Error('SZSE list: unexpected header');
  return rows.slice(1).filter(r => /^\d{6}$/.test(r[iCode] ?? '')).map(r => ({
    exchange: 'SZSE', market: blankToNull(r[iBoard]), ticker: r[iCode], nameEn: blankToNull(r[iEn]), nameLocal: blankToNull(r[iFull]),
    listedAt: isoDate(r[iDate]), website: iWeb >= 0 ? blankToNull(r[iWeb]) : null, shares: iShares >= 0 ? num(r[iShares]) : null,
    cik: null, sourceUrl: LISTING_SOURCES.SZSE,
  }));
}

/** JPX: Effective Date, Local Code, Name (English), Section/Products, 33 Sector(Code), 33 Sector(name), ... */
export function parseJpxRows(rows: string[][]): ListingEntry[] {
  const header = rows[0] ?? [];
  const iCode = header.indexOf('Local Code'), iName = header.indexOf('Name (English)'), iSec = header.indexOf('Section/Products');
  if (iCode < 0 || iName < 0) throw new Error('JPX list: unexpected header');
  return rows.slice(1)
    .filter(r => r[iCode] && r[iName] && !/ETF|ETN|REIT|PRO Market|Infrastructure/i.test(r[iSec] ?? ''))
    .map(r => ({
      exchange: 'JPX', market: blankToNull(r[iSec]), ticker: String(r[iCode]).replace(/\.0$/, ''), nameEn: r[iName], nameLocal: null,
      listedAt: null, website: null, shares: null, cik: null, sourceUrl: LISTING_SOURCES.JPX,
    }));
}

/** KRX KIND list (EUC-KR HTML table): 회사명, 시장구분, 종목코드, 업종, 주요제품, 상장일, 결산월, 대표자명, 홈페이지, 지역. */
export function parseKrxHtml(html: string): ListingEntry[] {
  const out: ListingEntry[] = [];
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => decodeHtmlEntities(c[1].replace(/<[^>]+>/g, '')).trim()));
  const header = rows.find(r => r.includes('회사명')) ?? [];
  const iName = header.indexOf('회사명'), iMkt = header.indexOf('시장구분'), iCode = header.indexOf('종목코드'), iDate = header.indexOf('상장일'), iWeb = header.indexOf('홈페이지');
  if (iName < 0 || iCode < 0) throw new Error('KRX list: unexpected header');
  for (const r of rows) {
    if (r === header || !/^[0-9A-Z]{6}$/.test(r[iCode] ?? '')) continue;
    out.push({
      exchange: 'KRX', market: blankToNull(r[iMkt]), ticker: r[iCode], nameEn: null, nameLocal: blankToNull(r[iName]),
      listedAt: isoDate(r[iDate]), website: iWeb >= 0 ? blankToNull(r[iWeb]) : null, shares: null, cik: null, sourceUrl: LISTING_SOURCES.KRX,
    });
  }
  return out;
}

export function parseTwseJson(json: unknown): ListingEntry[] {
  const rows = (Array.isArray(json) ? json : []) as Array<Record<string, string>>;
  return rows.filter(r => r['公司代號'] && r['公司名稱']).map(r => ({
    exchange: 'TWSE', market: null, ticker: r['公司代號'].trim(), nameEn: null, nameLocal: r['公司名稱'].trim(),
    listedAt: isoDate(r['上市日期']), website: blankToNull(r['網址']), shares: num(r['已發行普通股數或TDR原股發行股數']), cik: null,
    sourceUrl: LISTING_SOURCES.TWSE,
  }));
}

export function parseTpexJson(json: unknown): ListingEntry[] {
  const rows = (Array.isArray(json) ? json : []) as Array<Record<string, string>>;
  return rows.filter(r => r.SecuritiesCompanyCode && r.CompanyName).map(r => ({
    exchange: 'TPEX', market: null, ticker: r.SecuritiesCompanyCode.trim(), nameEn: null, nameLocal: r.CompanyName.trim(),
    listedAt: isoDate(r.DateOfListing), website: blankToNull(r.WebAddress), shares: num(r.IssueShares), cik: null,
    sourceUrl: LISTING_SOURCES.TPEX,
  }));
}

export function parseAsxCsv(text: string): ListingEntry[] {
  const rows = parseCsv(text);
  const iHeader = rows.findIndex(r => r[0] === 'Company name');
  if (iHeader < 0) throw new Error('ASX list: header missing');
  return rows.slice(iHeader + 1).filter(r => r[0] && r[1]).map(r => ({
    exchange: 'ASX', market: blankToNull(r[2]), ticker: r[1].trim(), nameEn: r[0].trim(), nameLocal: null,
    listedAt: null, website: null, shares: null, cik: null, sourceUrl: LISTING_SOURCES.ASX,
  }));
}

export function parseTsxJson(json: unknown, exchange: 'TSX' | 'TSXV'): ListingEntry[] {
  const rows = ((json as { results?: Array<{ symbol?: string; name?: string }> })?.results ?? []);
  return rows.filter(r => r.symbol && r.name && !/\b(ETF|Fund|Trust|Split|Notes?)\b/i.test(r.name)).map(r => ({
    exchange, market: null, ticker: String(r.symbol), nameEn: String(r.name), nameLocal: null,
    listedAt: null, website: null, shares: null, cik: null, sourceUrl: LISTING_SOURCES[exchange],
  }));
}

/** Euronext CSV: Name;ISIN;Symbol;Market;Currency;... after three preamble lines. */
export function parseEuronextCsv(text: string): ListingEntry[] {
  const rows = parseCsv(text, ';');
  const iHeader = rows.findIndex(r => r[0] === 'Name' && r[1] === 'ISIN');
  if (iHeader < 0) throw new Error('Euronext list: header missing');
  return rows.slice(iHeader + 1).filter(r => r[0] && r[2] && /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(r[1] ?? '')).map(r => ({
    exchange: 'EURONEXT', market: blankToNull(r[3]), ticker: r[2].trim(), nameEn: r[0].trim(), nameLocal: null,
    listedAt: null, website: null, shares: null, cik: null, sourceUrl: LISTING_SOURCES.EURONEXT,
  }));
}

/** SIX equity issuers CSV: Company;ISIN;Symbol;...;Country;... (primary listings and secondary). */
export function parseSixCsv(text: string): ListingEntry[] {
  const rows = parseCsv(text, ';');
  const header = rows[0] ?? [];
  const iName = header.indexOf('Company'), iSym = header.indexOf('Symbol'), iSeg = header.indexOf('Listing Segment');
  if (iName < 0 || iSym < 0) throw new Error('SIX list: unexpected header');
  return rows.slice(1).filter(r => r[iName] && r[iSym]).map(r => ({
    exchange: 'SIX', market: iSeg >= 0 ? blankToNull(r[iSeg]) : null, ticker: r[iSym].trim(), nameEn: r[iName].trim(), nameLocal: null,
    listedAt: null, website: null, shares: null, cik: null, sourceUrl: LISTING_SOURCES.SIX,
  }));
}

const SEC_EXCHANGES: Record<string, ListingExchange> = { Nasdaq: 'NASDAQ', NYSE: 'NYSE', 'NYSE American': 'NYSE_AMERICAN', NYSEAMERICAN: 'NYSE_AMERICAN', CBOE: 'CBOE', OTC: 'OTC' };

export function parseSecTickersExchange(json: unknown): ListingEntry[] {
  const j = json as { fields?: string[]; data?: unknown[][] };
  const f = j?.fields ?? [];
  const iCik = f.indexOf('cik'), iName = f.indexOf('name'), iTicker = f.indexOf('ticker'), iEx = f.indexOf('exchange');
  if (iCik < 0 || iTicker < 0) throw new Error('SEC tickers: unexpected fields');
  const out: ListingEntry[] = [];
  for (const r of j.data ?? []) {
    const exchange = SEC_EXCHANGES[String(r[iEx] ?? '')];
    if (!exchange || !r[iTicker]) continue;
    out.push({
      exchange, market: String(r[iEx]), ticker: String(r[iTicker]), nameEn: String(r[iName] ?? ''), nameLocal: null,
      listedAt: null, website: null, shares: null, cik: stripCik(String(r[iCik])), sourceUrl: LISTING_SOURCES.SEC,
    });
  }
  return out;
}

/** "002422.SZ" -> SZSE 002422; null for bare (US) or unknown suffixes and for HKEX (189 owns it). */
export function parseTickerSuffix(raw: string | null | undefined): { exchange: ListingExchange; code: string } | null {
  const m = /^\s*([A-Z0-9][A-Z0-9.-]*?)\.([A-Z]{1,3})\s*$/i.exec(raw ?? '');
  if (!m) return null;
  const code = m[1].toUpperCase();
  const map: Record<string, ListingExchange> = {
    SZ: 'SZSE', SS: 'SSE', SH: 'SSE', T: 'JPX', AX: 'ASX', TO: 'TSX', V: 'TSXV', KS: 'KRX', KQ: 'KRX', TW: 'TWSE', TWO: 'TPEX',
    PA: 'EURONEXT', AS: 'EURONEXT', BR: 'EURONEXT', LS: 'EURONEXT', OL: 'EURONEXT', MI: 'EURONEXT', IR: 'EURONEXT', SW: 'SIX',
  };
  const exchange = map[m[2].toUpperCase()];
  return exchange ? { exchange, code } : null;
}

// ═══════════════════════════════════════════════════════════════════════
// MATCHING (pure)
// ═══════════════════════════════════════════════════════════════════════

export interface ListingMatch {
  companyId: string;
  entry: ListingEntry;
  method: ListingMatchMethod;
  confidence: number;
  evidence: string;
}

const CONFIDENCE: Record<ListingMatchMethod, number> = {
  cik: 98, ticker: 95, exact_name_cn: 92, exact_name_en: 90, exact_name_local: 90, website_domain: 85,
};

function issuerId(e: ListingEntry): string {
  return `${e.exchange}:${e.ticker}`;
}

function entryLabel(e: ListingEntry): string {
  return [e.nameLocal, e.nameEn].filter(Boolean).join(' / ');
}

interface Index {
  en: Map<string, ListingEntry[]>;
  cjk: Map<string, ListingEntry[]>;
  domain: Map<string, ListingEntry[]>;
  ticker: Map<string, ListingEntry>;
  cik: Map<string, ListingEntry[]>;
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const a = m.get(k);
  if (a) a.push(v); else m.set(k, [v]);
}

export function buildListingIndex(entries: ListingEntry[]): Index {
  const idx: Index = { en: new Map(), cjk: new Map(), domain: new Map(), ticker: new Map(), cik: new Map() };
  for (const e of entries) {
    if (e.cik) { push(idx.cik, e.cik, e); continue; }
    idx.ticker.set(issuerId(e), e);
    if (e.nameEn) { const k = nameKey(e.nameEn); if (isDistinctiveKey(k, 6)) push(idx.en, k, e); }
    if (e.nameLocal && hasCjk(e.nameLocal)) { const k = cjkKey(e.nameLocal); if (isDistinctiveCjkKey(k)) push(idx.cjk, k, e); }
    const d = urlDomain(e.website);
    if (d) push(idx.domain, d, e);
  }
  return idx;
}

/** Entries for one key, or [] when the key names more than one issuer on the same exchange. */
function unambiguous(list: ListingEntry[] | undefined): ListingEntry[] {
  if (!list?.length) return [];
  const byExchange = new Map<string, Set<string>>();
  for (const e of list) {
    const s = byExchange.get(e.exchange) ?? new Set<string>();
    s.add(e.ticker);
    byExchange.set(e.exchange, s);
  }
  // Same issuer under two tickers of one exchange (share classes) is fine only when the names agree.
  const out: ListingEntry[] = [];
  for (const [ex, tickers] of byExchange) {
    const group = list.filter(e => e.exchange === ex);
    if (tickers.size === 1) { out.push(group[0]); continue; }
    const names = new Set(group.map(e => (e.nameLocal ?? e.nameEn ?? '').toLowerCase()));
    if (names.size === 1) out.push(...group);
  }
  return out;
}

export function matchListings(subjects: MatchSubject[], entries: ListingEntry[]): { matches: ListingMatch[]; ambiguousIssuers: number } {
  const idx = buildListingIndex(entries);
  const raw: ListingMatch[] = [];
  for (const s of subjects) {
    const best = new Map<string, ListingMatch>();
    const offer = (e: ListingEntry, method: ListingMatchMethod, evidence: string) => {
      const id = issuerId(e);
      const cur = best.get(id);
      if (!cur || CONFIDENCE[method] > cur.confidence) best.set(id, { companyId: s.id, entry: e, method, confidence: CONFIDENCE[method], evidence });
    };
    const names = [s.name, ...(s.name_variations ?? [])].filter(Boolean);

    if (s.cik) for (const e of idx.cik.get(stripCik(s.cik)) ?? []) offer(e, 'cik', `SEC company_tickers_exchange: CIK ${stripCik(s.cik)} = ${e.ticker} on ${e.market}`);

    const t = parseTickerSuffix(s.ticker);
    if (t) {
      const e = idx.ticker.get(`${t.exchange}:${t.code}`);
      // A stored ticker is only trusted when the listed name agrees with the company (or the
      // local-script name is one of the company's own names).
      const agrees = e && (
        names.some(n => nameAgreement(n, e.nameEn ?? '') >= 70)
        || (e.nameLocal != null && names.some(n => hasCjk(n) && cjkKey(n) === cjkKey(e.nameLocal))));
      if (e && agrees) offer(e, 'ticker', `${t.exchange} ${t.code} (${entryLabel(e)}) = companies.ticker ${s.ticker}`);
    }

    const keys = companyKeys(s.name, s.name_variations);
    for (const k of keys.cjk) for (const e of unambiguous(idx.cjk.get(k))) {
      offer(e, e.exchange === 'SSE' || e.exchange === 'SZSE' || e.exchange === 'TWSE' || e.exchange === 'TPEX' ? 'exact_name_cn' : 'exact_name_local',
        `${e.exchange} ${e.ticker} listed name "${e.nameLocal}" = company name`);
    }
    for (const k of keys.en) for (const e of unambiguous(idx.en.get(k))) {
      offer(e, 'exact_name_en', `${e.exchange} ${e.ticker} listed name "${e.nameEn}" = company name`);
    }
    if (s.website_url && s.website_source && TRUSTED_WEBSITE_SOURCES.has(s.website_source)) {
      const d = urlDomain(s.website_url);
      const list = d ? idx.domain.get(d) : undefined;
      if (d && list && new Set(list.map(issuerId)).size === 1) offer(list[0], 'website_domain', `${list[0].exchange} ${list[0].ticker} (${entryLabel(list[0])}) website ${d} = company website (${s.website_source})`);
    }
    raw.push(...best.values());
  }

  // One issuer claimed by many unrelated company rows is a generic name, not a match. Duplicate
  // rows of one company (same family or same normalized name) are fine.
  const byIssuer = new Map<string, ListingMatch[]>();
  for (const m of raw) push(byIssuer, issuerId(m.entry), m);
  const subjectById = new Map(subjects.map(s => [s.id, s]));
  const matches: ListingMatch[] = [];
  let ambiguousIssuers = 0;
  for (const group of byIssuer.values()) {
    if (group.length <= 1 || group.every(m => m.method === 'cik' || m.method === 'ticker')) { matches.push(...group); continue; }
    const owners = new Set(group.map(m => {
      const s = subjectById.get(m.companyId);
      return s?.family_id ?? nameKey(s?.name ?? m.companyId);
    }));
    if (owners.size > 3) { ambiguousIssuers++; continue; }
    matches.push(...group);
  }
  return { matches, ambiguousIssuers };
}

export interface ListingRow {
  company_id: string;
  exchange: ListingExchange;
  market: string | null;
  ticker: string;
  listed_name: string;
  listing_status: 'listed';
  listed_at: string | null;
  shares_outstanding: number | null;
  match_method: ListingMatchMethod;
  resolution_confidence: number;
  source: 'exchange_list' | 'sec_tickers';
  source_url: string;
  source_id: string;
  evidence: string;
  metadata: Record<string, unknown>;
  last_seen_at: string;
}

export function listingRow(m: ListingMatch, now: Date): ListingRow {
  const e = m.entry;
  return {
    company_id: m.companyId,
    exchange: e.exchange,
    market: e.market,
    ticker: e.ticker,
    listed_name: (e.nameLocal ?? e.nameEn ?? e.ticker).slice(0, 300),
    listing_status: 'listed',
    listed_at: e.listedAt,
    shares_outstanding: e.shares,
    match_method: m.method,
    resolution_confidence: m.confidence,
    source: e.cik ? 'sec_tickers' : 'exchange_list',
    source_url: e.sourceUrl,
    source_id: `${e.exchange}:${e.ticker}`,
    evidence: m.evidence.slice(0, 500),
    metadata: { name_en: e.nameEn, name_local: e.nameLocal, website: e.website },
    last_seen_at: now.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// NETWORK
// ═══════════════════════════════════════════════════════════════════════

const HEADERS = { 'User-Agent': SIGNAL_USER_AGENT };

async function getOk(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const res = await fetchWithTimeout(url, { timeoutMs: 60_000, retries: 1, ...init, headers: { ...HEADERS, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res;
}

async function fetchSse(): Promise<ListingEntry[]> {
  const out: ListingEntry[] = [];
  for (const [type, market] of [['1', 'Main Board'], ['8', 'STAR Market']] as const) {
    const params = new URLSearchParams({
      STOCK_TYPE: type, REG_PROVINCE: '', CSRC_CODE: '', STOCK_CODE: '', sqlId: 'COMMON_SSE_CP_GPJCTPZ_GPLB_GP_L',
      COMPANY_STATUS: '2,4,5,7,8', type: 'inParams', isPagination: 'true', 'pageHelp.cacheSize': '1',
      'pageHelp.beginPage': '1', 'pageHelp.pageSize': '5000', 'pageHelp.pageNo': '1',
    });
    const res = await getOk(`${LISTING_SOURCES.SSE}?${params}`, { headers: { Referer: 'https://www.sse.com.cn/' } });
    out.push(...parseSseJson(await res.json(), market));
  }
  return out;
}

export async function fetchListingSource(key: ListingSourceKey): Promise<ListingEntry[]> {
  switch (key) {
    case 'SSE': return fetchSse();
    case 'SZSE': return parseSzseRows(readXlsxRows(new Uint8Array(await (await getOk(LISTING_SOURCES.SZSE)).arrayBuffer())));
    case 'JPX': return parseJpxRows(readXlsxRows(new Uint8Array(await (await getOk(LISTING_SOURCES.JPX)).arrayBuffer())));
    case 'KRX': return parseKrxHtml(new TextDecoder('euc-kr').decode(await (await getOk(LISTING_SOURCES.KRX)).arrayBuffer()));
    case 'TWSE': return parseTwseJson(await (await getOk(LISTING_SOURCES.TWSE)).json());
    case 'TPEX': return parseTpexJson(await (await getOk(LISTING_SOURCES.TPEX)).json());
    case 'ASX': return parseAsxCsv(await (await getOk(LISTING_SOURCES.ASX)).text());
    case 'TSX': return parseTsxJson(await (await getOk(LISTING_SOURCES.TSX)).json(), 'TSX');
    case 'TSXV': return parseTsxJson(await (await getOk(LISTING_SOURCES.TSXV)).json(), 'TSXV');
    case 'EURONEXT': return parseEuronextCsv(await (await getOk(LISTING_SOURCES.EURONEXT, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'args%5BinitialLetter%5D=&iDisplayLength=20000&iDisplayStart=0',
    })).text());
    case 'SIX': return parseSixCsv(new TextDecoder('windows-1252').decode(await (await getOk(LISTING_SOURCES.SIX)).arrayBuffer()));
    case 'SEC': {
      const json = await secGetJson<unknown>(LISTING_SOURCES.SEC, 60_000);
      if (!json) throw new Error('SEC company_tickers_exchange.json missing');
      return parseSecTickersExchange(json);
    }
  }
}

/** Minimum entries a list must yield before its stale rows may be deleted (guards a half-broken fetch). */
export const MIN_LIST_SIZE: Record<ListingSourceKey, number> = {
  SSE: 1500, SZSE: 2000, JPX: 3000, KRX: 2000, TWSE: 800, TPEX: 600, ASX: 1500, TSX: 1000, TSXV: 1000, EURONEXT: 1000, SIX: 150, SEC: 5000,
};

// ═══════════════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════════════

export interface ListingsRunResult {
  sources: Record<string, { entries: number; matched: number; error?: string }>;
  subjects: number;
  matches: number;
  companies: number;
  byMethod: Record<string, number>;
  ambiguousIssuers: number;
  written: number;
  deleted: number;
  errors: string[];
  sample: Array<{ company: string; exchange: string; ticker: string; listed: string; method: string }>;
}

export async function runListings(supabase: SupabaseClient, opts: { dryRun?: boolean; only?: ListingSourceKey[]; now?: Date } = {}): Promise<ListingsRunResult> {
  const now = opts.now ?? new Date();
  const r: ListingsRunResult = { sources: {}, subjects: 0, matches: 0, companies: 0, byMethod: {}, ambiguousIssuers: 0, written: 0, deleted: 0, errors: [], sample: [] };
  const keys = (opts.only?.length ? opts.only : (Object.keys(LISTING_SOURCES) as ListingSourceKey[]));
  const entries: ListingEntry[] = [];
  const healthy = new Set<ListingExchange>();
  for (const key of keys) {
    try {
      const list = await fetchListingSource(key);
      entries.push(...list);
      r.sources[key] = { entries: list.length, matched: 0 };
      if (list.length >= MIN_LIST_SIZE[key]) for (const e of list) healthy.add(e.exchange);
      else r.errors.push(`${key}: only ${list.length} entries; stale rows kept`);
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 200) : String(e);
      r.sources[key] = { entries: 0, matched: 0, error: msg };
      r.errors.push(`${key}: ${msg}`);
    }
  }

  const subjects = await loadMatchSubjects(supabase);
  r.subjects = subjects.length;
  const { matches, ambiguousIssuers } = matchListings(subjects, entries);
  r.matches = matches.length;
  r.ambiguousIssuers = ambiguousIssuers;
  r.companies = new Set(matches.map(m => m.companyId)).size;
  const byId = new Map(subjects.map(s => [s.id, s]));
  for (const m of matches) {
    r.byMethod[m.method] = (r.byMethod[m.method] ?? 0) + 1;
    const src = m.entry.cik ? 'SEC' : (Object.keys(LISTING_SOURCES) as ListingSourceKey[]).find(k => LISTING_SOURCES[k] === m.entry.sourceUrl) ?? m.entry.exchange;
    if (r.sources[src]) r.sources[src].matched++;
    if (r.sample.length < 40) r.sample.push({ company: byId.get(m.companyId)?.name ?? m.companyId, exchange: m.entry.exchange, ticker: m.entry.ticker, listed: entryLabel(m.entry), method: m.method });
  }
  if (opts.dryRun) return r;

  const rows = matches.map(m => listingRow(m, now));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('company_listings').upsert(rows.slice(i, i + 500), { onConflict: 'company_id,exchange,ticker' });
    if (error) { r.errors.push(`upsert: ${error.message}`); return r; }
    r.written += Math.min(500, rows.length - i);
  }
  for (const ex of healthy) {
    const { count, error } = await supabase.from('company_listings').delete({ count: 'exact' })
      .in('source', ['exchange_list', 'sec_tickers']).eq('exchange', ex).lt('last_seen_at', now.toISOString());
    if (error) r.errors.push(`stale ${ex}: ${error.message}`);
    else r.deleted += count ?? 0;
  }
  return r;
}
