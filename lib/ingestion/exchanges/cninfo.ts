/**
 * cninfo (巨潮资讯) — the Shanghai and Shenzhen exchanges' disclosure portal, the
 * primary channel for mainland-listed pharma (incl. STAR board 688xxx and ChiNext
 * 300xxx) deal announcements that never reach HKEX.
 *
 * Listing: POST /new/hisAnnouncement/query with a search key and a date window
 * (verified 25 Sep 2026: "许可协议" for Sep 2026 returned 诺诚健华 ↔ 礼来 and 复星医药
 * licence announcements). Document: the PDF at static.cninfo.com.cn/<adjunctUrl>.
 *
 * Daily: the last `DAILY_DAYS` days over every search key. History: a cursor over
 * (quarter × key) from 2017, like the SEC backfill, a few steps per run.
 * Runs as a phase of the rotating /api/cron/exchanges route.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '../../fetch-with-timeout';
import { readSyncCursor, writeSyncCursor } from '../../radar/sync-cursor';
import { FunnelCounter } from '../funnel';
import { quartersSince } from '../edgar-fts';
import { processFilingText, type AdapterRunResult } from './shared';

const QUERY_URL = 'http://www.cninfo.com.cn/new/hisAnnouncement/query';
const STATIC_BASE = 'https://static.cninfo.com.cn/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MIN_INTERVAL_MS = 800;
export const CNINFO_CURSOR_SOURCE = 'cninfo_backfill';
export const CNINFO_FROM_YEAR = 2017;
const DAILY_DAYS = 4;

/** Title search keys, most specific first. */
export const CNINFO_SEARCH_KEYS: ReadonlyArray<string> = ['许可协议', '授权许可', '对外许可', '独家许可', 'License', '合作开发协议', '商业化'];

/** Title terms that mark a licensing / partnering announcement. */
const DEAL_TERMS = /许可|授权|license|合作开发|共同开发|商业化|独家|战略合作协议|技术转让|引进/i;
/** Titles that carry a term but are not new deals. */
const EXCLUDE = /终止|解除|摘要|进展公告|完成|变更|补充公告|更正|回购|减持|增持|股权激励|募集|中标|中期票据|自动驾驶|地图/;
/** Pharma signal in the company name or title. */
const PHARMA_HINT = /医药|生物|制药|药业|药物|医疗|健康|生命|基因|细胞|疫苗|抗体|创新药|新药|临床|pharm|bio|thera|medic/i;

export interface CninfoAnnouncement {
  announcementId: string;
  secCode: string;
  secName: string;
  title: string;
  dateIso: string;
  pdfUrl: string;
}

let lastCallAt = 0;
async function throttle(): Promise<void> {
  const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallAt = Date.now();
}

export function isCninfoDealTitle(title: string, secName = ''): boolean {
  if (EXCLUDE.test(title)) return false;
  if (!DEAL_TERMS.test(title)) return false;
  return PHARMA_HINT.test(`${title} ${secName}`);
}

function stripEm(s: string): string { return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

/** One page of announcements for a key in [fromIso, toIso]. */
export async function searchCninfo(key: string, fromIso: string, toIso: string, pageNum = 1, pageSize = 30): Promise<{ rows: CninfoAnnouncement[]; total: number; hasMore: boolean; status: number }> {
  await throttle();
  const body = new URLSearchParams({
    pageNum: String(pageNum), pageSize: String(pageSize), column: 'szse', tabName: 'fulltext', plate: '', stock: '',
    searchkey: key, secid: '', category: '', trade: '', seDate: `${fromIso}~${toIso}`, sortName: '', sortType: '', isHLtitle: 'true',
  });
  const res = await fetchWithTimeout(QUERY_URL, {
    method: 'POST', timeoutMs: 25_000, retries: 1, body: body.toString(),
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json', Referer: 'http://www.cninfo.com.cn/new/commonUrl/pageOfSearch?url=disclosure/list/search' },
  });
  if (!res.ok) return { rows: [], total: 0, hasMore: false, status: res.status };
  let data: { totalRecordNum?: number; hasMore?: boolean; announcements?: Array<Record<string, unknown>> | null };
  try { data = await res.json(); } catch { return { rows: [], total: 0, hasMore: false, status: 502 }; }
  const rows: CninfoAnnouncement[] = [];
  for (const a of data.announcements ?? []) {
    const adjunct = String(a.adjunctUrl ?? '');
    if (!adjunct) continue;
    const ms = Number(a.announcementTime ?? 0);
    rows.push({
      announcementId: String(a.announcementId ?? adjunct.split('/').pop()?.replace(/\.pdf$/i, '') ?? ''),
      secCode: String(a.secCode ?? ''), secName: String(a.secName ?? ''),
      title: stripEm(String(a.announcementTitle ?? '')),
      dateIso: ms ? new Date(ms).toISOString().slice(0, 10) : '',
      pdfUrl: `${STATIC_BASE}${adjunct.replace(/^\//, '')}`,
    });
  }
  return { rows, total: Number(data.totalRecordNum ?? rows.length), hasMore: !!data.hasMore, status: 200 };
}

export async function fetchCninfoPdfText(pdfUrl: string): Promise<{ ok: boolean; status: number; text: string }> {
  await throttle();
  const res = await fetchWithTimeout(pdfUrl, { timeoutMs: 30_000, retries: 1, headers: { 'User-Agent': UA, Accept: 'application/pdf' } });
  if (!res.ok) return { ok: false, status: res.status, text: '' };
  const buf = new Uint8Array(await res.arrayBuffer());
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  return { ok: true, status: res.status, text: String(text).replace(/\s+/g, ' ').trim() };
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}

export interface CninfoRunOptions {
  anthropicApiKey: string;
  dryRun?: boolean;
  timeBudgetMs?: number;
  maxExtractions?: number;
  minConfidence?: number;
  reviewConfidence?: number;
  /** Walk the (quarter × key) history cursor as well. Default true. */
  deep?: boolean;
}

export async function runCninfoIngestion(supabase: SupabaseClient, opts: CninfoRunOptions): Promise<AdapterRunResult> {
  const start = Date.now();
  const budget = opts.timeBudgetMs ?? 120_000;
  const maxExtractions = opts.maxExtractions ?? 15;
  const minConfidence = opts.minConfidence ?? 75;
  const reviewConfidence = opts.reviewConfidence ?? 60;
  const dryRun = !!opts.dryRun;
  const funnel = new FunnelCounter();
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const candidates = new Map<string, CninfoAnnouncement>();
  let fetched = 0;
  const consider = (rows: CninfoAnnouncement[]) => {
    for (const r of rows) {
      fetched++;
      funnel.count('fetched');
      if (!isCninfoDealTitle(r.title, r.secName)) { funnel.count('keyword_filtered', 'title', `${r.secName} ${r.title.slice(0, 50)}`); continue; }
      if (!candidates.has(r.announcementId)) candidates.set(r.announcementId, r);
    }
  };

  // 1. Daily window over every key.
  for (const key of CNINFO_SEARCH_KEYS) {
    if (Date.now() - start > budget * 0.35) { funnel.count('time_budget', 'keys_remaining'); break; }
    const page = await searchCninfo(key, addDays(today, -DAILY_DAYS), today);
    if (page.status !== 200) { errors.push(`cninfo ${key}: HTTP ${page.status}`); continue; }
    consider(page.rows);
  }

  // 2. History: (quarter × key) cursor from 2017, a few steps per run.
  let deepStep: string | null = null;
  if (opts.deep !== false && !dryRun) {
    const quarters = quartersSince(CNINFO_FROM_YEAR);
    const steps = quarters.length * CNINFO_SEARCH_KEYS.length;
    const cur = await readSyncCursor<{ step?: number; page?: number }>(supabase, CNINFO_CURSOR_SOURCE);
    let step = (cur.state.step ?? 0) % steps;
    let pageNum = cur.state.page ?? 1;
    let walked = 0;
    while (walked < 4 && Date.now() - start < budget * 0.55) {
      const q = quarters[Math.floor(step / CNINFO_SEARCH_KEYS.length)];
      const key = CNINFO_SEARCH_KEYS[step % CNINFO_SEARCH_KEYS.length];
      deepStep = `${q.key}:${key}:p${pageNum}`;
      const page = await searchCninfo(key, q.startdt, q.enddt, pageNum, 30);
      if (page.status !== 200) { errors.push(`cninfo ${q.key} ${key}: HTTP ${page.status}`); }
      else consider(page.rows);
      if (page.status === 200 && page.hasMore && pageNum < 10) pageNum++;
      else { step = (step + 1) % steps; pageNum = 1; }
      walked++;
      await writeSyncCursor(supabase, CNINFO_CURSOR_SOURCE, deepStep, { step, page: pageNum, lastQuarter: q.key, lastKey: key });
    }
  }

  // 3. Extract.
  let extracted = 0, inserted = 0;
  for (const a of candidates.values()) {
    if (Date.now() - start > budget) { funnel.count('time_budget', 'announcements_remaining'); break; }
    if (extracted >= maxExtractions) { funnel.count('time_budget', 'extraction_cap'); break; }
    try {
      extracted++;
      const filingId = `cninfo:${a.announcementId}`;
      const { data: existing } = await supabase.from('deals').select('id').eq('source_filing_id', filingId).limit(1).maybeSingle();
      if (existing) { funnel.count('already_in_table'); continue; }
      const pdf = await fetchCninfoPdfText(a.pdfUrl);
      if (!pdf.ok) { funnel.count('content_unavailable', `http_${pdf.status}`, a.pdfUrl); continue; }
      const outcome = await processFilingText(supabase, {
        filingId, sourceType: 'cninfo', sourceUrl: a.pdfUrl, text: pdf.text, announcedDate: a.dateIso,
        provenanceNote: `cninfo ${a.secCode} ${a.secName}: ${a.title.slice(0, 120)}`,
        defaultLicensorCountry: 'CN', defaultLicensorRegion: 'china', label: `${a.secName}: ${a.title.slice(0, 80)}`,
      }, { anthropicApiKey: opts.anthropicApiKey, dryRun, minConfidence, reviewConfidence, funnel });
      if (outcome === 'inserted') inserted++;
      if (outcome === 'error') errors.push(`insert error ${a.announcementId}`);
    } catch (e) {
      funnel.count('extraction_error', undefined, String(e).slice(0, 120));
      errors.push(`${a.announcementId}: ${String(e).slice(0, 160)}`);
    }
  }
  const summary = funnel.summary();
  console.log(`[cninfo] fetched=${fetched} candidates=${candidates.size} deep=${deepStep ?? '-'} ${summary}${dryRun ? ' (dry run)' : ''}`);
  return { fetched, candidates: candidates.size, extracted, inserted, errors, funnel: funnel.toJSON(), summary, parameters: { deepStep, dailyDays: DAILY_DAYS }, expectRecords: true };
}
