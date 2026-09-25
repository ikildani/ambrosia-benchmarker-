/**
 * DART (Korea Financial Supervisory Service) — the primary channel for Korean
 * listed companies' deal disclosures (기술이전/기술도입 계약, 라이선스, 공동개발).
 *
 * OpenDART API (free key, env DART_API_KEY, 20,000 requests/day):
 *   list.json     disclosures in a date window; pblntf_ty=I (거래소공시 / timely)
 *   document.xml  the filing as a zip of XML/HTML — unzipped with fflate
 * Extraction goes through the shared filing extractor into the cited insert with
 * source_type 'dart' and the DART viewer URL as citation.
 *
 * Sep 25 2026. Runs as a phase of the rotating /api/cron/exchanges route.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { unzipSync, strFromU8 } from 'fflate';
import { fetchWithTimeout } from '../../fetch-with-timeout';
import { FunnelCounter } from '../funnel';
import { insertCitedDeal } from '../insert-deal';
import { extractDealFromFiling, findOrCreateCompany, deriveTherapeuticArea } from '../sec-edgar';
import { validateExtractedDeal } from '../deal-extraction-validator';
import { classifyAndEnrichDeal } from '../company-geography';

const BASE = 'https://opendart.fss.or.kr/api';
const MIN_INTERVAL_MS = 400;

/** Strong terms: technology transfer / licence — pass without a pharma hint (the extractor rejects non-deals). */
const STRONG_TERMS = /기술이전|라이선스|라이센스|license|licence/i;
/** Weaker terms need a pharma signal in the report or company name. */
const DEAL_TERMS = /기술도입|공동개발|공동연구|판매계약|공급계약|독점|계약체결|collaborat/i;
/** Report names that carry a term but are not deals. */
const EXCLUDE = /정정신고|주주총회|유상증자|무상증자|전환사채|신주인수권|자기주식|임원|감사|분기보고서|반기보고서|사업보고서|배당|합병|분할|공시위반|해지|종료/;
/** Pharma signal in the company name or report name. */
const PHARMA_HINT = /제약|바이오|팜|파마|약품|의약|셀|테라퓨틱스|메디|헬스케어|사이언스|진단|백신|항체|유전자|pharm|bio|thera|medic|vaccine|cell|gene/i;

export interface DartDisclosure {
  rcept_no: string;
  corp_code: string;
  corp_name: string;
  stock_code: string;
  report_nm: string;
  rcept_dt: string;   // YYYYMMDD
  dateIso: string;
  viewerUrl: string;
}

let lastCallAt = 0;
async function throttle(): Promise<void> {
  const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallAt = Date.now();
}

export function isDartDealReport(reportName: string, corpName = ''): boolean {
  if (EXCLUDE.test(reportName)) return false;
  if (STRONG_TERMS.test(reportName)) return true;
  if (!DEAL_TERMS.test(reportName)) return false;
  return PHARMA_HINT.test(`${reportName} ${corpName}`);
}

function yyyymmdd(iso: string): string { return iso.replace(/-/g, ''); }
function isoFromYyyymmdd(s: string): string { return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s; }

/** Disclosures in [fromIso, toIso] of type I (timely). Pages of 100. Requires DART_API_KEY. */
export async function listDartDisclosures(fromIso: string, toIso: string, maxPages = 5): Promise<{ rows: DartDisclosure[]; status: number; message?: string }> {
  const key = process.env.DART_API_KEY;
  if (!key) return { rows: [], status: 0, message: 'DART_API_KEY not configured' };
  const out: DartDisclosure[] = [];
  for (let page = 1; page <= maxPages; page++) {
    await throttle();
    const res = await fetchWithTimeout(
      `${BASE}/list.json?crtfc_key=${encodeURIComponent(key)}&bgn_de=${yyyymmdd(fromIso)}&end_de=${yyyymmdd(toIso)}&pblntf_ty=I&page_no=${page}&page_count=100`,
      { timeoutMs: 20_000, retries: 1 },
    );
    if (!res.ok) return { rows: out, status: res.status };
    const data = await res.json() as { status?: string; message?: string; total_page?: number; list?: Array<Record<string, string>> };
    if (data.status && data.status !== '000') {
      // '013' = no data in the window; anything else is an API error worth surfacing.
      return { rows: out, status: data.status === '013' ? 200 : 500, message: data.status === '013' ? undefined : `${data.status} ${data.message ?? ''}` };
    }
    for (const r of data.list ?? []) {
      out.push({
        rcept_no: r.rcept_no, corp_code: r.corp_code, corp_name: r.corp_name, stock_code: r.stock_code ?? '',
        report_nm: (r.report_nm ?? '').replace(/\s+/g, ' ').trim(), rcept_dt: r.rcept_dt, dateIso: isoFromYyyymmdd(r.rcept_dt ?? ''),
        viewerUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${r.rcept_no}`,
      });
    }
    if (!data.total_page || page >= data.total_page) break;
  }
  return { rows: out, status: 200 };
}

/** Fetch the filing zip and return the concatenated text of its XML/HTML parts. */
export async function fetchDartDocumentText(rcept_no: string): Promise<{ ok: boolean; status: number; text: string }> {
  const key = process.env.DART_API_KEY;
  if (!key) return { ok: false, status: 0, text: '' };
  await throttle();
  const res = await fetchWithTimeout(`${BASE}/document.xml?crtfc_key=${encodeURIComponent(key)}&rcept_no=${encodeURIComponent(rcept_no)}`, { timeoutMs: 30_000, retries: 1 });
  if (!res.ok) return { ok: false, status: res.status, text: '' };
  const buf = new Uint8Array(await res.arrayBuffer());
  // An error is returned as a small XML body rather than a zip.
  if (buf.length < 4 || !(buf[0] === 0x50 && buf[1] === 0x4b)) {
    return { ok: false, status: 422, text: strFromU8(buf).slice(0, 200) };
  }
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(buf); } catch { return { ok: false, status: 422, text: '' }; }
  const parts: string[] = [];
  for (const [name, bytes] of Object.entries(files)) {
    if (!/\.(xml|html?|txt)$/i.test(name)) continue;
    // DART documents are EUC-KR or UTF-8; try UTF-8 first and fall back.
    let text = strFromU8(bytes);
    if (/�/.test(text.slice(0, 2000))) { try { text = new TextDecoder('euc-kr').decode(bytes); } catch { /* keep utf-8 */ } }
    parts.push(text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim());
  }
  return { ok: true, status: 200, text: parts.join(' ') };
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}

export async function processDartDisclosure(
  supabase: SupabaseClient,
  a: DartDisclosure,
  opts: { anthropicApiKey: string; dryRun: boolean; minConfidence: number; reviewConfidence: number; funnel: FunnelCounter },
): Promise<'inserted' | 'skipped' | 'error'> {
  const { funnel, dryRun } = opts;
  const filingId = `dart:${a.rcept_no}`;
  const { data: existing } = await supabase.from('deals').select('id').eq('source_filing_id', filingId).limit(1).maybeSingle();
  if (existing) { funnel.count('already_in_table'); return 'skipped'; }
  const doc = await fetchDartDocumentText(a.rcept_no);
  if (!doc.ok) { funnel.count('content_unavailable', `http_${doc.status}`, a.viewerUrl); return 'skipped'; }
  if (doc.text.length < 300) { funnel.count('content_too_short', 'xml', a.report_nm); return 'skipped'; }
  const deal = await extractDealFromFiling(doc.text.substring(0, 24_000), opts.anthropicApiKey);
  if (!deal) { funnel.count('not_a_deal', 'dart', `${a.corp_name}: ${a.report_nm.slice(0, 80)}`); return 'skipped'; }
  const floor = Math.min(opts.reviewConfidence, opts.minConfidence);
  if (deal.confidence_score < floor) { funnel.count('confidence_gate', deal.confidence_score >= 60 ? '60-74' : 'below-60', `${deal.licensor} → ${deal.licensee} c=${deal.confidence_score}`); return 'skipped'; }
  const needsReview = deal.confidence_score < opts.minConfidence;
  if (!deal.licensor?.trim() || !deal.licensee?.trim()) { funnel.count('missing_parties'); return 'skipped'; }
  const validation = validateExtractedDeal(deal, { minConfidence: floor });
  if (!validation.valid) { funnel.count('validator_rejected', validation.rejectCode, `${deal.licensor} → ${deal.licensee}: ${validation.rejectReason}`); return 'skipped'; }
  const announcedDate = a.dateIso || new Date().toISOString().slice(0, 10);
  const { data: same } = await supabase.from('deals').select('id')
    .ilike('licensor_name', deal.licensor.trim()).ilike('licensee_name', deal.licensee.trim())
    .gte('announced_date', addDays(announcedDate, -30)).lte('announced_date', addDays(announcedDate, 30)).limit(1).maybeSingle();
  if (same) { funnel.count('duplicate_same_day'); return 'skipped'; }
  const licensorId = dryRun ? null : await findOrCreateCompany(supabase, deal.licensor.trim(), false);
  const licenseeId = dryRun ? null : await findOrCreateCompany(supabase, deal.licensee.trim(), true);
  const therapeuticArea = deriveTherapeuticArea(deal.indication_category);
  const geo = classifyAndEnrichDeal(deal.licensor, deal.licensee);
  const result = await insertCitedDeal(supabase, {
    sourceType: 'dart', sourceUrl: a.viewerUrl, sourceFilingId: filingId, extractionModel: 'claude-opus-4-6',
    provenanceNote: `DART ${a.stock_code} ${a.corp_name}: ${a.report_nm.slice(0, 120)}`,
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
      licensor_country: geo.licensor_country !== 'unknown' ? geo.licensor_country : 'KR',
      licensee_country: geo.licensee_country !== 'unknown' ? geo.licensee_country : null,
      licensor_region: geo.licensor_region !== 'unknown' ? geo.licensor_region : 'south_korea',
      licensee_region: geo.licensee_region !== 'unknown' ? geo.licensee_region : null,
      cross_border: geo.cross_border, deal_corridor: geo.deal_corridor,
    },
  }, { dryRun });
  if (result.outcome === 'inserted') { funnel.count(dryRun ? 'dry_run_would_insert' : 'inserted', undefined, `${deal.licensor} → ${deal.licensee} ${deal.total_deal_value_usd ?? ''}`); return 'inserted'; }
  if (result.outcome === 'duplicate') { funnel.count('insert_duplicate'); return 'skipped'; }
  funnel.count('insert_error', result.outcome, result.error);
  return 'error';
}

export interface DartRunOptions {
  anthropicApiKey: string;
  dryRun?: boolean;
  timeBudgetMs?: number;
  maxExtractions?: number;
  minConfidence?: number;
  reviewConfidence?: number;
  /** Window to scan; default the last 3 days. */
  fromIso?: string;
  toIso?: string;
}

export interface DartRunResult {
  window: { fromIso: string; toIso: string };
  configured: boolean;
  disclosures: number;
  dealReports: number;
  extracted: number;
  inserted: number;
  errors: string[];
  funnel: ReturnType<FunnelCounter['toJSON']>;
  summary: string;
}

export async function runDartIngestion(supabase: SupabaseClient, opts: DartRunOptions): Promise<DartRunResult> {
  const start = Date.now();
  const budget = opts.timeBudgetMs ?? 90_000;
  const maxExtractions = opts.maxExtractions ?? 15;
  const minConfidence = opts.minConfidence ?? 75;
  const reviewConfidence = opts.reviewConfidence ?? 60;
  const dryRun = !!opts.dryRun;
  const funnel = new FunnelCounter();
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const window = { fromIso: opts.fromIso ?? addDays(today, -3), toIso: opts.toIso ?? today };
  const configured = !!process.env.DART_API_KEY;

  const { rows, status, message } = await listDartDisclosures(window.fromIso, window.toIso);
  if (!configured) errors.push('DART_API_KEY not configured');
  else if (status !== 200) errors.push(`DART list ${window.fromIso}..${window.toIso}: ${message ?? `HTTP ${status}`}`);

  const candidates = rows.filter(r => { funnel.count('fetched'); const keep = isDartDealReport(r.report_nm, r.corp_name); if (!keep) funnel.count('keyword_filtered', 'report_nm'); return keep; });
  let extracted = 0, inserted = 0;
  for (const a of candidates) {
    if (Date.now() - start > budget) { funnel.count('time_budget', 'announcements_remaining'); break; }
    if (extracted >= maxExtractions) { funnel.count('time_budget', 'extraction_cap'); break; }
    try {
      extracted++;
      const outcome = await processDartDisclosure(supabase, a, { anthropicApiKey: opts.anthropicApiKey, dryRun, minConfidence, reviewConfidence, funnel });
      if (outcome === 'inserted') inserted++;
      if (outcome === 'error') errors.push(`insert error ${a.rcept_no}`);
    } catch (e) {
      funnel.count('extraction_error', undefined, String(e).slice(0, 120));
      errors.push(`${a.rcept_no}: ${String(e).slice(0, 160)}`);
    }
  }
  const summary = funnel.summary();
  console.log(`[dart] ${window.fromIso}..${window.toIso} configured=${configured} disclosures=${rows.length} deals=${candidates.length} ${summary}${dryRun ? ' (dry run)' : ''}`);
  return { window, configured, disclosures: rows.length, dealReports: candidates.length, extracted, inserted, errors, funnel: funnel.toJSON(), summary };
}
