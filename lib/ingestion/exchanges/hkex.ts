/**
 * HKEX announcements adapter. China biotech discloses licensing deals here
 * as "Inside Information" announcements (3SBio → Pfizer, Lepu → MRG007,
 * HUTCHMED → GSK, Simcere → Roche), often days before any English press
 * release and with terms the release omits.
 *
 * Endpoint facts, measured 17 Sep 2026:
 *   - titleSearchServlet.do answers JSON with `result` as a JSON string.
 *   - Windows longer than ~14 days return `"result":"null"`. Walk 14-day
 *     windows.
 *   - Bursts are throttled: after a run of requests the servlet answers an
 *     empty body or "null" for a period. Keep >= 3 s between calls and back
 *     off for an hour on an empty result that follows a non-empty one.
 *   - FILE_LINK is a path under https://www1.hkexnews.hk; use it verbatim
 *     (guessed paths 404). Documents are PDFs; text via unpdf.
 *
 * Citation for every row: the announcement PDF URL as source_url,
 * NEWS_ID as source_filing_id, source_type 'hkex' (migration 114; stored as
 * 'other' with origin=hkex in extraction_notes until it is applied).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '../../fetch-with-timeout';
import { extractDealFromFiling, findOrCreateCompany, deriveTherapeuticArea } from '../sec-edgar';
import { validateExtractedDeal } from '../deal-extraction-validator';
import { classifyAndEnrichDeal } from '../company-geography';
import { FunnelCounter } from '../funnel';
import { insertCitedDeal } from '../insert-deal';
import { readSyncCursor, writeSyncCursor } from '../../radar/sync-cursor';

export const HKEX_BASE = 'https://www1.hkexnews.hk';
const SERVLET = `${HKEX_BASE}/search/titleSearchServlet.do`;
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
export const HKEX_WINDOW_DAYS = 14;
export const HKEX_MIN_INTERVAL_MS = 3_000;
export const HKEX_BACKOFF_MS = 60 * 60 * 1000;
export const HKEX_CURSOR_SOURCE = 'hkex_backfill';
export const HKEX_FROM_DATE = '2017-01-01';

/** Title terms that mark a licensing or partnering announcement. */
export const HKEX_TITLE_TERMS = ['licen', 'collaboration', 'co-development', 'option agreement', 'commercialization'] as const;
/** Titles that match a term but are regulatory, not deals. */
const TITLE_EXCLUDE = /biologics license application|marketing authori[sz]ation|new drug application|clinical trial approval|drug registration|product licen[cs]e renewal/i;

export interface HkexAnnouncement {
  newsId: string;
  stockCode: string;
  stockName: string;
  title: string;
  dateTime: string; // 'dd/mm/yyyy HH:mm'
  fileLink: string; // path
  url: string;
  totalCount: number;
}

let lastCallAt = 0;
async function throttle(): Promise<void> {
  const wait = Math.max(0, lastCallAt + HKEX_MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallAt = Date.now();
}

function yyyymmdd(iso: string): string { return iso.replace(/-/g, ''); }

/** Parse the servlet's double-encoded JSON. `null` result means no rows OR throttled; callers disambiguate. */
export function parseHkexResult(body: string): { rows: HkexAnnouncement[]; empty: boolean; throttled: boolean } {
  if (!body || !body.trim()) return { rows: [], empty: true, throttled: true };
  let outer: { result?: string | null };
  try { outer = JSON.parse(body); } catch { return { rows: [], empty: true, throttled: true }; }
  if (!outer.result || outer.result === 'null') return { rows: [], empty: true, throttled: false };
  let inner: Array<Record<string, string>>;
  try { inner = JSON.parse(outer.result); } catch { return { rows: [], empty: true, throttled: true }; }
  const rows = inner.map(r => ({
    newsId: String(r.NEWS_ID ?? ''),
    stockCode: String(r.STOCK_CODE ?? ''),
    stockName: String(r.STOCK_NAME ?? ''),
    title: String(r.TITLE ?? '').replace(/\s+/g, ' ').trim(),
    dateTime: String(r.DATE_TIME ?? ''),
    fileLink: String(r.FILE_LINK ?? ''),
    url: `${HKEX_BASE}${String(r.FILE_LINK ?? '')}`,
    totalCount: Number(r.TOTAL_COUNT ?? inner.length),
  })).filter(r => r.newsId && r.fileLink);
  return { rows, empty: rows.length === 0, throttled: false };
}

/** dd/mm/yyyy HH:mm → ISO date. */
export function hkexDateToIso(dateTime: string): string | null {
  const m = dateTime.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export async function searchHkexTitles(term: string, fromIso: string, toIso: string): Promise<{ rows: HkexAnnouncement[]; throttled: boolean }> {
  await throttle();
  const params = new URLSearchParams({
    sortDir: '0', sortByOptions: 'DateTime', category: '0', market: 'SEHK', stockId: '', documentType: '-1',
    fromDate: yyyymmdd(fromIso), toDate: yyyymmdd(toIso), title: term, searchType: '1',
    t1code: '-2', t2Gcode: '-2', t2code: '-2', rowRange: '100', lang: 'EN',
  });
  const res = await fetchWithTimeout(`${SERVLET}?${params}`, {
    timeoutMs: 20_000, retries: 0,
    headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json, text/javascript, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest', Referer: `${HKEX_BASE}/search/titlesearch.xhtml?lang=en` },
  });
  if (!res.ok) return { rows: [], throttled: res.status === 429 || res.status >= 500 };
  const parsed = parseHkexResult(await res.text());
  return { rows: parsed.rows, throttled: parsed.throttled };
}

export function isDealTitle(title: string): boolean {
  if (TITLE_EXCLUDE.test(title)) return false;
  return /licen|collaborat|co-development|option agreement|commercialization|partnership agreement/i.test(title);
}

/** Fetch an announcement PDF and return its text. */
export async function fetchHkexPdfText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  await throttle();
  const res = await fetchWithTimeout(url, { timeoutMs: 30_000, retries: 1, headers: { 'User-Agent': BROWSER_UA, Accept: 'application/pdf' } });
  if (!res.ok) return { ok: false, status: res.status, text: '' };
  const buf = new Uint8Array(await res.arrayBuffer());
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  return { ok: true, status: res.status, text: String(text).replace(/\s+/g, ' ').trim() };
}

export interface HkexRunOptions {
  anthropicApiKey: string;
  dryRun?: boolean;
  timeBudgetMs?: number;
  maxExtractions?: number;
  minConfidence?: number;
  /** 'daily' scans the last HKEX_WINDOW_DAYS; 'backfill' walks the cursor from 2017. */
  mode: 'daily' | 'backfill';
  /** Local probe: fixed window instead of cursor. */
  window?: { fromIso: string; toIso: string };
}

export interface HkexRunResult {
  mode: 'daily' | 'backfill';
  window: { fromIso: string; toIso: string };
  announcements: number;
  dealTitles: number;
  extracted: number;
  inserted: number;
  throttled: boolean;
  errors: string[];
  funnel: ReturnType<FunnelCounter['toJSON']>;
  summary: string;
  next?: { fromIso: string };
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}

export async function processHkexAnnouncement(
  supabase: SupabaseClient,
  a: HkexAnnouncement,
  opts: { anthropicApiKey: string; dryRun: boolean; minConfidence: number; funnel: FunnelCounter },
): Promise<'inserted' | 'skipped' | 'error'> {
  const { funnel, dryRun } = opts;
  const filingId = `hkex:${a.newsId}`;
  const { data: existing } = await supabase.from('deals').select('id').eq('source_filing_id', filingId).limit(1).maybeSingle();
  if (existing) { funnel.count('already_in_table'); return 'skipped'; }
  const pdf = await fetchHkexPdfText(a.url);
  if (!pdf.ok) { funnel.count('content_unavailable', `http_${pdf.status}`, a.url); return 'skipped'; }
  if (pdf.text.length < 500) { funnel.count('content_too_short', 'pdf', a.title); return 'skipped'; }
  const deal = await extractDealFromFiling(pdf.text.substring(0, 24_000), opts.anthropicApiKey);
  if (!deal) { funnel.count('not_a_deal', 'hkex', `${a.stockName}: ${a.title.slice(0, 80)}`); return 'skipped'; }
  if (deal.confidence_score < opts.minConfidence) { funnel.count('confidence_gate', deal.confidence_score >= 60 ? '60-74' : 'below-60', `${deal.licensor} → ${deal.licensee} c=${deal.confidence_score}`); return 'skipped'; }
  if (!deal.licensor?.trim() || !deal.licensee?.trim()) { funnel.count('missing_parties'); return 'skipped'; }
  const validation = validateExtractedDeal(deal);
  if (!validation.valid) { funnel.count('validator_rejected', validation.rejectCode, `${deal.licensor} → ${deal.licensee}: ${validation.rejectReason}`); return 'skipped'; }
  const announcedDate = hkexDateToIso(a.dateTime) ?? new Date().toISOString().slice(0, 10);
  const { data: same } = await supabase.from('deals').select('id')
    .ilike('licensor_name', deal.licensor.trim()).ilike('licensee_name', deal.licensee.trim())
    .gte('announced_date', addDays(announcedDate, -30)).lte('announced_date', addDays(announcedDate, 30)).limit(1).maybeSingle();
  if (same) { funnel.count('duplicate_same_day'); return 'skipped'; }
  const licensorId = dryRun ? null : await findOrCreateCompany(supabase, deal.licensor.trim(), false);
  const licenseeId = dryRun ? null : await findOrCreateCompany(supabase, deal.licensee.trim(), true);
  const therapeuticArea = deriveTherapeuticArea(deal.indication_category);
  const geo = classifyAndEnrichDeal(deal.licensor, deal.licensee);
  const result = await insertCitedDeal(supabase, {
    sourceType: 'hkex', sourceUrl: a.url, sourceFilingId: filingId, extractionModel: 'claude-opus-4-6',
    provenanceNote: `HKEX ${a.stockCode} ${a.stockName}: ${a.title.slice(0, 120)}`,
    row: {
      licensor_name: deal.licensor, licensor_id: licensorId, licensee_name: deal.licensee, licensee_id: licenseeId,
      asset_name: deal.asset_name, asset_description: deal.asset_description, modality: deal.modality,
      indication_category: deal.indication_category, indication_specific: deal.indication_specific, target: deal.target,
      mechanism_of_action: deal.mechanism_of_action, phase_at_signing: deal.phase_at_signing, territory: deal.territory,
      territories_included: deal.territories_included || [], exclusivity: deal.exclusivity, deal_type: deal.deal_type,
      upfront_usd: deal.upfront_usd, milestones_total_usd: deal.milestones_total_usd,
      milestones_development_usd: deal.milestones_development_usd, milestones_regulatory_usd: deal.milestones_regulatory_usd,
      milestones_commercial_usd: deal.milestones_commercial_usd, royalty_low_pct: deal.royalty_low_pct, royalty_high_pct: deal.royalty_high_pct,
      total_deal_value_usd: deal.total_deal_value_usd, equity_investment_usd: deal.equity_investment_usd,
      includes_manufacturing: deal.includes_manufacturing, includes_co_development: deal.includes_co_development,
      includes_co_promotion: deal.includes_co_promotion, option_exercise_fee: deal.option_exercise_fee,
      milestone_details: deal.milestone_details || [], sales_milestones: deal.sales_milestones || [],
      research_funding_usd: deal.research_funding_usd, profit_share_pct: deal.profit_share_pct, cost_share_ratio: deal.cost_share_ratio,
      opt_in_rights: deal.opt_in_rights, opt_in_stage: deal.opt_in_stage, regulatory_designations: deal.regulatory_designations || [],
      term_years: deal.term_years, sublicense_rights: deal.sublicense_rights, rights_retained: deal.rights_retained,
      indications_licensed: deal.indications_licensed, includes_diagnostics: deal.includes_diagnostics || false,
      announced_date: announcedDate, confidence_score: deal.confidence_score, extraction_notes: deal.extraction_notes,
      therapeutic_area: therapeuticArea,
      licensor_country: geo.licensor_country !== 'unknown' ? geo.licensor_country : null,
      licensee_country: geo.licensee_country !== 'unknown' ? geo.licensee_country : null,
      licensor_region: geo.licensor_region !== 'unknown' ? geo.licensor_region : null,
      licensee_region: geo.licensee_region !== 'unknown' ? geo.licensee_region : null,
      cross_border: geo.cross_border, deal_corridor: geo.deal_corridor,
    },
  }, { dryRun });
  if (result.outcome === 'inserted') { funnel.count(dryRun ? 'dry_run_would_insert' : 'inserted', undefined, `${deal.licensor} → ${deal.licensee} ${deal.total_deal_value_usd ?? ''}`); return 'inserted'; }
  if (result.outcome === 'duplicate') { funnel.count('insert_duplicate'); return 'skipped'; }
  funnel.count('insert_error', result.outcome, result.error);
  return 'error';
}

export async function runHkexIngestion(supabase: SupabaseClient, opts: HkexRunOptions): Promise<HkexRunResult> {
  const start = Date.now();
  const budget = opts.timeBudgetMs ?? 250_000;
  const maxExtractions = opts.maxExtractions ?? 20;
  const minConfidence = opts.minConfidence ?? 75;
  const dryRun = !!opts.dryRun;
  const funnel = new FunnelCounter();
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const MIN_WINDOW_BUDGET_MS = 45_000;

  // Backfill state (cursor) — only read when walking the cursor.
  let backoffUntil: string | null = null;
  let cursorFrom: string | null = null;
  if (!opts.window && opts.mode === 'backfill') {
    const cur = await readSyncCursor<{ fromIso?: string; backoffUntil?: string | null }>(supabase, HKEX_CURSOR_SOURCE);
    backoffUntil = cur.state.backoffUntil ?? null;
    cursorFrom = cur.state.fromIso ?? HKEX_FROM_DATE;
    if (backoffUntil && new Date(backoffUntil).getTime() > Date.now()) {
      const window = { fromIso: cursorFrom, toIso: addDays(cursorFrom, HKEX_WINDOW_DAYS - 1) };
      return { mode: opts.mode, window, announcements: 0, dealTitles: 0, extracted: 0, inserted: 0, throttled: true, errors: [`HKEX backoff until ${backoffUntil}`], funnel: funnel.toJSON(), summary: 'backoff', next: { fromIso: cursorFrom } };
    }
  }

  let announcementsTotal = 0, dealTitlesTotal = 0, extracted = 0, inserted = 0;
  let throttled = false;
  let firstWindow: { fromIso: string; toIso: string } | null = null;
  let lastWindow: { fromIso: string; toIso: string } | null = null;
  let next: { fromIso: string } | undefined;
  let windows = 0;

  // Sep 25 2026: a backfill run walks window after window until its budget or cap is
  // used (one 14-day window per run meant ~250 runs from 2017, i.e. four months at two
  // runs a day). Daily mode and explicit windows still do exactly one window.
  while (true) {
    let window: { fromIso: string; toIso: string };
    if (opts.window) window = opts.window;
    else if (opts.mode === 'daily') window = { fromIso: addDays(today, -HKEX_WINDOW_DAYS), toIso: today };
    else window = { fromIso: cursorFrom!, toIso: addDays(cursorFrom!, HKEX_WINDOW_DAYS - 1) };
    if (window.toIso > today) window.toIso = today;
    if (!firstWindow) firstWindow = window;
    lastWindow = window;
    windows++;

    const seen = new Map<string, HkexAnnouncement>();
    for (const term of HKEX_TITLE_TERMS) {
      if (Date.now() - start > budget) { funnel.count('time_budget', 'terms_remaining'); break; }
      const { rows, throttled: t } = await searchHkexTitles(term, window.fromIso, window.toIso);
      if (t) { throttled = true; break; }
      for (const r of rows) if (!seen.has(r.newsId)) seen.set(r.newsId, r);
    }
    const announcements = seen.size;
    announcementsTotal += announcements;
    for (let i = 0; i < announcements; i++) funnel.count('fetched');
    const dealRows = [...seen.values()].filter(r => isDealTitle(r.title));
    dealTitlesTotal += dealRows.length;
    for (let i = 0; i < announcements - dealRows.length; i++) funnel.count('keyword_filtered', 'title');

    let windowComplete = !throttled;
    for (const a of dealRows) {
      if (Date.now() - start > budget) { funnel.count('time_budget', 'announcements_remaining'); windowComplete = false; break; }
      if (extracted >= maxExtractions) { funnel.count('time_budget', 'extraction_cap'); windowComplete = false; break; }
      try {
        extracted++;
        const outcome = await processHkexAnnouncement(supabase, a, { anthropicApiKey: opts.anthropicApiKey, dryRun, minConfidence, funnel });
        if (outcome === 'inserted') inserted++;
        if (outcome === 'error') errors.push(`insert error ${a.newsId}`);
      } catch (e) {
        funnel.count('extraction_error', undefined, String(e).slice(0, 120));
        errors.push(`${a.newsId}: ${String(e).slice(0, 160)}`);
      }
    }

    if (opts.mode !== 'backfill' || opts.window) break; // single window modes

    // Advance the cursor only when the window was fully processed; an unfinished window
    // is re-scanned next run (processHkexAnnouncement dedupes on the announcement id).
    const advanceTo = windowComplete ? addDays(window.toIso, 1) : window.fromIso;
    next = { fromIso: advanceTo > today ? today : advanceTo };
    if (!dryRun) {
      await writeSyncCursor(supabase, HKEX_CURSOR_SOURCE, next.fromIso, {
        fromIso: next.fromIso,
        backoffUntil: throttled ? new Date(Date.now() + HKEX_BACKOFF_MS).toISOString() : null,
        lastWindow: window,
      });
    }
    cursorFrom = next.fromIso;
    if (throttled || !windowComplete) break;
    if (window.toIso >= today) break;                                  // caught up
    if (Date.now() - start > budget - MIN_WINDOW_BUDGET_MS) break;     // not enough budget for another window
    if (extracted >= maxExtractions) break;
  }

  if (throttled) errors.push('HKEX throttled this run; window not advanced');
  const summary = funnel.summary();
  const window = { fromIso: firstWindow!.fromIso, toIso: lastWindow!.toIso };
  console.log(`[hkex] ${opts.mode} ${window.fromIso}..${window.toIso} windows=${windows} announcements=${announcementsTotal} deals=${dealTitlesTotal} ${summary}${throttled ? ' THROTTLED' : ''}${dryRun ? ' (dry run)' : ''}`);
  return { mode: opts.mode, window, announcements: announcementsTotal, dealTitles: dealTitlesTotal, extracted, inserted, throttled, errors, funnel: funnel.toJSON(), summary, next };
}
