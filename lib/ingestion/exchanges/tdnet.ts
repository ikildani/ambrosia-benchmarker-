/**
 * TDnet (Tokyo Stock Exchange timely disclosure) — Japan's primary channel for
 * listed companies' deal announcements: ライセンス契約締結のお知らせ, 共同開発契約,
 * 導出/導入, 販売権 etc.
 *
 * There is no search API. The daily list is HTML at
 *   https://www.release.tdnet.info/inbs/I_list_{page}_{YYYYMMDD}.html   (page 001, 002, …)
 * with one <tr> per disclosure (time, code, company, title → PDF link). TDnet keeps
 * roughly one month online, so this adapter is a daily scan, not a historical
 * backfill. Rows are pre-filtered on Japanese/English deal terms in the title,
 * the PDF is read with unpdf, and extraction goes through the shared filing
 * extractor into the cited insert with source_type 'tdnet' and the PDF URL.
 *
 * Sep 25 2026. Runs as a phase of /api/cron/hkex-announcements?mode=both.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '../../fetch-with-timeout';
import { FunnelCounter } from '../funnel';
import { insertCitedDeal } from '../insert-deal';
import { extractDealFromFiling, findOrCreateCompany, deriveTherapeuticArea } from '../sec-edgar';
import { validateExtractedDeal } from '../deal-extraction-validator';
import { classifyAndEnrichDeal } from '../company-geography';

export const TDNET_BASE = 'https://www.release.tdnet.info/inbs/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MIN_INTERVAL_MS = 1_000;

/** Japanese and English title terms that mark a licensing / partnering disclosure. */
export const TDNET_DEAL_TERMS = [
  'ライセンス', '導出', '共同開発', '共同研究', '業務提携', '販売権', '独占的', 'オプション契約', '契約締結',
  'licens', 'collaboration', 'co-development', 'option agreement', 'commercialization',
] as const;
/** Titles that carry a term but are not deals (stock plans, shareholder perks, governance, results). */
const TITLE_EXCLUDE = /承認取得|承認申請|製造販売承認|訂正|決算|配当|株主総会|自己株式|役員|人事|IR説明会|決算説明|マーケティング承認|株主優待|株式報酬|譲渡制限付|ストックオプション|制度の導入|制度の変更|新株予約権/;
/**
 * Pharma signal: TSE securities codes 45xx are the pharmaceutical sector; otherwise the
 * title or company must carry a life-science term. Keeps Claude spend off retailers
 * announcing "business alliances".
 */
const PHARMA_HINT = /製薬|医薬|創薬|バイオ|ファーマ|治療薬|抗体|ワクチン|再生医療|細胞|遺伝子|核酸|ペプチド|診断薬|医療機器|セラピ|pharma|bio|thera|medic|oncol|vaccine|antibod|gene|cell/i;

export interface TdnetDisclosure {
  fileId: string;       // e.g. 140120260925540309
  code: string;         // securities code, e.g. 45190
  company: string;
  title: string;
  time: string;         // HH:mm JST
  dateIso: string;      // YYYY-MM-DD (list date)
  url: string;          // absolute PDF URL
}

let lastCallAt = 0;
async function throttle(): Promise<void> {
  const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallAt = Date.now();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

/** Parse one TDnet list page. Exported for tests. */
export function parseTdnetList(html: string, dateIso: string): { rows: TdnetDisclosure[]; pages: string[] } {
  const rows: TdnetDisclosure[] = [];
  const trs = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  for (const tr of trs) {
    const cell = (cls: string) => {
      const m = tr.match(new RegExp(`<td[^>]*class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)</td>`));
      return m ? m[1] : '';
    };
    const titleCell = cell('kjTitle');
    if (!titleCell) continue;
    const href = titleCell.match(/href="([^"]+\.pdf)"/i)?.[1];
    if (!href) continue;
    const file = href.split('/').pop() ?? href;
    rows.push({
      fileId: file.replace(/\.pdf$/i, ''),
      code: stripTags(cell('kjCode')),
      company: stripTags(cell('kjName')),
      title: stripTags(titleCell),
      time: stripTags(cell('kjTime')),
      dateIso,
      url: href.startsWith('http') ? href : `${TDNET_BASE}${href.replace(/^\.?\//, '')}`,
    });
  }
  const pages = [...new Set(html.match(/I_list_(\d{3})_\d{8}\.html/g)?.map(m => m.slice(7, 10)) ?? [])].sort();
  return { rows, pages };
}

export function isTdnetDealTitle(title: string, code = '', company = ''): boolean {
  if (TITLE_EXCLUDE.test(title)) return false;
  const t = title.toLowerCase();
  if (!TDNET_DEAL_TERMS.some(term => t.includes(term.toLowerCase()))) return false;
  const pharmaCode = /^45\d{2}/.test(code);
  return pharmaCode || PHARMA_HINT.test(`${title} ${company}`);
}

/** All disclosures for one date across its pages. */
export async function listTdnetDay(dateIso: string): Promise<{ rows: TdnetDisclosure[]; status: number }> {
  const ymd = dateIso.replace(/-/g, '');
  const out: TdnetDisclosure[] = [];
  let page = 1;
  let known = new Set<string>(['001']);
  while (page <= 12) {
    const p = String(page).padStart(3, '0');
    if (page > 1 && !known.has(p)) break;
    await throttle();
    const res = await fetchWithTimeout(`${TDNET_BASE}I_list_${p}_${ymd}.html`, { timeoutMs: 20_000, retries: 1, headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (!res.ok) { if (page === 1) return { rows: [], status: res.status }; break; }
    const html = await res.text();
    const parsed = parseTdnetList(html, dateIso);
    out.push(...parsed.rows);
    known = new Set([...known, ...parsed.pages]);
    page++;
  }
  return { rows: out, status: 200 };
}

/** Fetch a TDnet PDF and return its text. */
export async function fetchTdnetPdfText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  await throttle();
  const res = await fetchWithTimeout(url, { timeoutMs: 30_000, retries: 1, headers: { 'User-Agent': UA, Accept: 'application/pdf' } });
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

export async function processTdnetDisclosure(
  supabase: SupabaseClient,
  a: TdnetDisclosure,
  opts: { anthropicApiKey: string; dryRun: boolean; minConfidence: number; reviewConfidence: number; funnel: FunnelCounter },
): Promise<'inserted' | 'skipped' | 'error'> {
  const { funnel, dryRun } = opts;
  const filingId = `tdnet:${a.fileId}`;
  const { data: existing } = await supabase.from('deals').select('id').eq('source_filing_id', filingId).limit(1).maybeSingle();
  if (existing) { funnel.count('already_in_table'); return 'skipped'; }
  const pdf = await fetchTdnetPdfText(a.url);
  if (!pdf.ok) { funnel.count('content_unavailable', `http_${pdf.status}`, a.url); return 'skipped'; }
  if (pdf.text.length < 300) { funnel.count('content_too_short', 'pdf', a.title); return 'skipped'; }
  const deal = await extractDealFromFiling(pdf.text.substring(0, 24_000), opts.anthropicApiKey);
  if (!deal) { funnel.count('not_a_deal', 'tdnet', `${a.company}: ${a.title.slice(0, 80)}`); return 'skipped'; }
  const floor = Math.min(opts.reviewConfidence, opts.minConfidence);
  if (deal.confidence_score < floor) { funnel.count('confidence_gate', deal.confidence_score >= 60 ? '60-74' : 'below-60', `${deal.licensor} → ${deal.licensee} c=${deal.confidence_score}`); return 'skipped'; }
  const needsReview = deal.confidence_score < opts.minConfidence;
  if (!deal.licensor?.trim() || !deal.licensee?.trim()) { funnel.count('missing_parties'); return 'skipped'; }
  const validation = validateExtractedDeal(deal, { minConfidence: floor });
  if (!validation.valid) { funnel.count('validator_rejected', validation.rejectCode, `${deal.licensor} → ${deal.licensee}: ${validation.rejectReason}`); return 'skipped'; }
  const announcedDate = a.dateIso;
  const { data: same } = await supabase.from('deals').select('id')
    .ilike('licensor_name', deal.licensor.trim()).ilike('licensee_name', deal.licensee.trim())
    .gte('announced_date', addDays(announcedDate, -30)).lte('announced_date', addDays(announcedDate, 30)).limit(1).maybeSingle();
  if (same) { funnel.count('duplicate_same_day'); return 'skipped'; }
  const licensorId = dryRun ? null : await findOrCreateCompany(supabase, deal.licensor.trim(), false);
  const licenseeId = dryRun ? null : await findOrCreateCompany(supabase, deal.licensee.trim(), true);
  const therapeuticArea = deriveTherapeuticArea(deal.indication_category);
  const geo = classifyAndEnrichDeal(deal.licensor, deal.licensee);
  const result = await insertCitedDeal(supabase, {
    sourceType: 'tdnet', sourceUrl: a.url, sourceFilingId: filingId, extractionModel: 'claude-opus-4-6',
    provenanceNote: `TDnet ${a.code} ${a.company}: ${a.title.slice(0, 120)}`,
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
      announced_date: announcedDate, confidence_score: deal.confidence_score,
      extraction_notes: needsReview ? `Confidence ${deal.confidence_score}: needs verifier review. ${deal.extraction_notes || ''}`.trim() : deal.extraction_notes,
      therapeutic_area: therapeuticArea,
      licensor_country: geo.licensor_country !== 'unknown' ? geo.licensor_country : 'JP',
      licensee_country: geo.licensee_country !== 'unknown' ? geo.licensee_country : null,
      licensor_region: geo.licensor_region !== 'unknown' ? geo.licensor_region : 'japan',
      licensee_region: geo.licensee_region !== 'unknown' ? geo.licensee_region : null,
      cross_border: geo.cross_border, deal_corridor: geo.deal_corridor,
    },
  }, { dryRun });
  if (result.outcome === 'inserted') { funnel.count(dryRun ? 'dry_run_would_insert' : 'inserted', undefined, `${deal.licensor} → ${deal.licensee} ${deal.total_deal_value_usd ?? ''}`); return 'inserted'; }
  if (result.outcome === 'duplicate') { funnel.count('insert_duplicate'); return 'skipped'; }
  funnel.count('insert_error', result.outcome, result.error);
  return 'error';
}

export interface TdnetRunOptions {
  anthropicApiKey: string;
  dryRun?: boolean;
  timeBudgetMs?: number;
  maxExtractions?: number;
  minConfidence?: number;
  reviewConfidence?: number;
  /** Days back to scan, inclusive of today. Default 2 (yesterday + today, JST posts land late UTC). */
  daysBack?: number;
}

export interface TdnetRunResult {
  dates: string[];
  disclosures: number;
  dealTitles: number;
  extracted: number;
  inserted: number;
  errors: string[];
  funnel: ReturnType<FunnelCounter['toJSON']>;
  summary: string;
}

export async function runTdnetIngestion(supabase: SupabaseClient, opts: TdnetRunOptions): Promise<TdnetRunResult> {
  const start = Date.now();
  const budget = opts.timeBudgetMs ?? 90_000;
  const maxExtractions = opts.maxExtractions ?? 15;
  const minConfidence = opts.minConfidence ?? 75;
  const reviewConfidence = opts.reviewConfidence ?? 60;
  const dryRun = !!opts.dryRun;
  const funnel = new FunnelCounter();
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const dates: string[] = [];
  for (let i = (opts.daysBack ?? 2) - 1; i >= 0; i--) dates.push(addDays(today, -i));

  const candidates: TdnetDisclosure[] = [];
  let disclosures = 0;
  for (const d of dates) {
    if (Date.now() - start > budget) { funnel.count('time_budget', 'dates_remaining'); break; }
    const { rows, status } = await listTdnetDay(d);
    if (status !== 200) { errors.push(`TDnet list ${d}: HTTP ${status}`); continue; }
    disclosures += rows.length;
    for (const r of rows) { funnel.count('fetched'); if (isTdnetDealTitle(r.title, r.code, r.company)) candidates.push(r); else funnel.count('keyword_filtered', 'title'); }
  }

  let extracted = 0, inserted = 0;
  for (const a of candidates) {
    if (Date.now() - start > budget) { funnel.count('time_budget', 'announcements_remaining'); break; }
    if (extracted >= maxExtractions) { funnel.count('time_budget', 'extraction_cap'); break; }
    try {
      extracted++;
      const outcome = await processTdnetDisclosure(supabase, a, { anthropicApiKey: opts.anthropicApiKey, dryRun, minConfidence, reviewConfidence, funnel });
      if (outcome === 'inserted') inserted++;
      if (outcome === 'error') errors.push(`insert error ${a.fileId}`);
    } catch (e) {
      funnel.count('extraction_error', undefined, String(e).slice(0, 120));
      errors.push(`${a.fileId}: ${String(e).slice(0, 160)}`);
    }
  }
  const summary = funnel.summary();
  console.log(`[tdnet] ${dates[0]}..${dates[dates.length - 1]} disclosures=${disclosures} deals=${candidates.length} ${summary}${dryRun ? ' (dry run)' : ''}`);
  return { dates, disclosures, dealTitles: candidates.length, extracted, inserted, errors, funnel: funnel.toJSON(), summary };
}
