/**
 * ASX (Australia) company announcements — the primary channel for Australian
 * listed biotechs' deal disclosures.
 *
 * Listing: the ASX research API returns the latest five announcements per company
 * code (count is ignored, verified 25 Sep 2026) — enough for the daily scan. History
 * comes from the legacy per-year HTML page (announcements.do?by=asxCode&timeframe=Y),
 * ~140 rows per company-year with the same idsId links. There is no market-wide
 * keyword search, so both walk a curated list of ASX pharma/biotech codes.
 * Document: the PDF sits behind a terms interstitial; the interstitial HTML
 * carries the real PDF URL in a hidden `pdfURL` input, and that URL serves the
 * PDF directly (verified 25 Sep 2026).
 *
 * Runs as a phase of /api/cron/hkex-announcements?mode=both:
 *   daily   — last `DAILY_COUNT` announcements per code
 *   deep    — walks (code × year) from 2017 with a cursor (radar_sync_cursors
 *             'asx_backfill'), as many steps as the budget allows, so history fills
 *             in over a few weeks without a separate cron.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '../../fetch-with-timeout';
import { readSyncCursor, writeSyncCursor } from '../../radar/sync-cursor';
import { FunnelCounter } from '../funnel';
import { insertCitedDeal } from '../insert-deal';
import { extractDealFromFiling, findOrCreateCompany, deriveTherapeuticArea } from '../sec-edgar';
import { validateExtractedDeal } from '../deal-extraction-validator';
import { classifyAndEnrichDeal } from '../company-geography';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MIN_INTERVAL_MS = 700;
export const ASX_CURSOR_SOURCE = 'asx_backfill';
const DAILY_COUNT = 5;
export const ASX_FROM_YEAR = 2017;

/**
 * ASX pharma / biotech codes (verified against the research API, 25 Sep 2026).
 * Devices, diagnostics and distributors are left out on purpose.
 */
export const ASX_BIOTECH_CODES: ReadonlyArray<string> = [
  'CSL', 'TLX', 'MSB', 'IMM', 'NEU', 'CUV', 'BOT', 'IMU', 'PTX', 'RAC', 'RCE', 'DXB', 'ATH', 'PAR',
  'NOX', 'CYP', 'PYC', 'PER', 'IMC', 'AGN', 'BIT', 'NSB', 'ACR', 'IVX', 'PAB', 'CU6', 'CHM', 'ANR',
  'SNT', 'AFP', 'IXC', 'ILA',
];

/** Headline terms that mark a licensing / partnering announcement. */
const DEAL_TERMS = /licen[cs]|collaborat|partnership|co-development|option agreement|commerciali[sz]ation agreement|distribution agreement|supply agreement|acquisition of|acquires|to acquire|merger|joint venture|term sheet/i;
/** Routine ASX paperwork that never is a deal. */
const EXCLUDE = /appendix|substantial holding|director interest|quotation of securities|buy-back|cleansing|annual general|dividend|placement|capital raising|trading halt|reinstatement|investor presentation|quarterly|half year|full year|annual report|ceasing to be|becoming a|change of director|notice of meeting|proxy|escrow|options expir|unquoted|ESOP|employee/i;

export interface AsxAnnouncement {
  code: string;
  companyName: string;
  documentKey: string;
  idsId: string;
  headline: string;
  dateIso: string;
  announcementType: string;
  isPriceSensitive: boolean;
}

let lastCallAt = 0;
async function throttle(): Promise<void> {
  const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallAt = Date.now();
}

export function isAsxDealHeadline(headline: string): boolean {
  return DEAL_TERMS.test(headline) && !EXCLUDE.test(headline);
}

/** idsId is the middle segment of the documentKey ("2924-03140218-3A702575" → "03140218"). */
export function idsIdFromDocumentKey(documentKey: string): string | null {
  const m = documentKey.match(/^\d+-(\d{6,10})-/);
  return m ? m[1] : null;
}

export async function listAsxAnnouncements(code: string, count = DAILY_COUNT): Promise<{ rows: AsxAnnouncement[]; status: number; companyName: string }> {
  await throttle();
  const res = await fetchWithTimeout(
    `https://asx.api.markitdigital.com/asx-research/1.0/companies/${encodeURIComponent(code.toLowerCase())}/announcements?count=${count}&market=ASX`,
    { timeoutMs: 20_000, retries: 1, headers: { 'User-Agent': UA, Accept: 'application/json' } },
  );
  if (!res.ok) return { rows: [], status: res.status, companyName: '' };
  const data = await res.json() as { data?: { displayName?: string; items?: Array<Record<string, unknown>> } };
  const companyName = String(data.data?.displayName ?? '');
  const rows: AsxAnnouncement[] = [];
  for (const it of data.data?.items ?? []) {
    const documentKey = String(it.documentKey ?? '');
    const idsId = idsIdFromDocumentKey(documentKey);
    if (!documentKey || !idsId) continue;
    rows.push({
      code: code.toUpperCase(), companyName, documentKey, idsId,
      headline: String(it.headline ?? '').replace(/\s+/g, ' ').trim(),
      dateIso: String(it.date ?? '').slice(0, 10),
      announcementType: String(it.announcementType ?? ''),
      isPriceSensitive: !!it.isPriceSensitive,
    });
  }
  return { rows, status: 200, companyName };
}

/** dd/mm/yyyy [h:mm am] → ISO date. */
function asxDateToIso(text: string): string {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** Parse the legacy per-year announcements page. Exported for tests. */
export function parseAsxYearPage(html: string, code: string): AsxAnnouncement[] {
  const out: AsxAnnouncement[] = [];
  const trs = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  for (const tr of trs) {
    const link = tr.match(/displayAnnouncement\.do\?display=pdf&(?:amp;)?idsId=(\d+)/);
    if (!link) continue;
    const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(c => c.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
    const dateIso = asxDateToIso(cells[0] ?? '');
    const headline = (cells[2] ?? cells[cells.length - 1] ?? '').replace(/\s*\d+\s+pages?\s+[\d.]+\s*[KM]B\s*$/i, '').trim();
    if (!headline) continue;
    out.push({
      code: code.toUpperCase(), companyName: '', documentKey: `legacy-${link[1]}`, idsId: link[1],
      headline, dateIso, announcementType: '', isPriceSensitive: /<img[^>]*(price|sensitive)/i.test(tr),
    });
  }
  return out;
}

/** One company-year of announcements from the legacy page (history). */
export async function listAsxYear(code: string, year: number): Promise<{ rows: AsxAnnouncement[]; status: number }> {
  await throttle();
  const res = await fetchWithTimeout(
    `https://www.asx.com.au/asx/v2/statistics/announcements.do?by=asxCode&asxCode=${encodeURIComponent(code.toUpperCase())}&timeframe=Y&year=${year}`,
    { timeoutMs: 25_000, retries: 1, headers: { 'User-Agent': UA, Accept: 'text/html' } },
  );
  if (!res.ok) return { rows: [], status: res.status };
  return { rows: parseAsxYearPage(await res.text(), code), status: 200 };
}

/** Resolve the interstitial to the PDF URL it hides. */
export async function resolveAsxPdfUrl(idsId: string): Promise<string | null> {
  await throttle();
  const res = await fetchWithTimeout(`https://www.asx.com.au/asx/v2/statistics/displayAnnouncement.do?display=pdf&idsId=${encodeURIComponent(idsId)}`, {
    timeoutMs: 20_000, retries: 1, headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/name="pdfURL"\s+value="([^"]+\.pdf)"/i) ?? html.match(/value="([^"]+\.pdf)"\s+name="pdfURL"/i);
  return m ? m[1] : null;
}

export async function fetchAsxPdfText(pdfUrl: string): Promise<{ ok: boolean; status: number; text: string }> {
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

export async function processAsxAnnouncement(
  supabase: SupabaseClient,
  a: AsxAnnouncement,
  opts: { anthropicApiKey: string; dryRun: boolean; minConfidence: number; reviewConfidence: number; funnel: FunnelCounter },
): Promise<'inserted' | 'skipped' | 'error'> {
  const { funnel, dryRun } = opts;
  const filingId = `asx:${a.idsId}`;
  const { data: existing } = await supabase.from('deals').select('id').eq('source_filing_id', filingId).limit(1).maybeSingle();
  if (existing) { funnel.count('already_in_table'); return 'skipped'; }
  const pdfUrl = await resolveAsxPdfUrl(a.idsId);
  if (!pdfUrl) { funnel.count('content_unavailable', 'no_pdf_url', `${a.code} ${a.headline.slice(0, 60)}`); return 'skipped'; }
  const pdf = await fetchAsxPdfText(pdfUrl);
  if (!pdf.ok) { funnel.count('content_unavailable', `http_${pdf.status}`, pdfUrl); return 'skipped'; }
  if (pdf.text.length < 500) { funnel.count('content_too_short', 'pdf', a.headline); return 'skipped'; }
  const deal = await extractDealFromFiling(pdf.text.substring(0, 12_000), opts.anthropicApiKey);
  if (!deal) { funnel.count('not_a_deal', 'asx', `${a.companyName}: ${a.headline.slice(0, 80)}`); return 'skipped'; }
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
    sourceType: 'asx', sourceUrl: pdfUrl, sourceFilingId: filingId, extractionModel: 'claude-opus-4-6',
    provenanceNote: `ASX ${a.code} ${a.companyName}: ${a.headline.slice(0, 120)}`,
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

export interface AsxRunOptions {
  anthropicApiKey: string;
  dryRun?: boolean;
  timeBudgetMs?: number;
  maxExtractions?: number;
  minConfidence?: number;
  reviewConfidence?: number;
  codes?: ReadonlyArray<string>;
  /** Also pull one code's deep history (cursor over the list). Default true. */
  deep?: boolean;
}

export interface AsxRunResult {
  codesScanned: number;
  deepCode: string | null;
  announcements: number;
  dealHeadlines: number;
  extracted: number;
  inserted: number;
  errors: string[];
  funnel: ReturnType<FunnelCounter['toJSON']>;
  summary: string;
}

export async function runAsxIngestion(supabase: SupabaseClient, opts: AsxRunOptions): Promise<AsxRunResult> {
  const start = Date.now();
  const budget = opts.timeBudgetMs ?? 80_000;
  const maxExtractions = opts.maxExtractions ?? 12;
  const minConfidence = opts.minConfidence ?? 75;
  const reviewConfidence = opts.reviewConfidence ?? 60;
  const dryRun = !!opts.dryRun;
  const codes = opts.codes ?? ASX_BIOTECH_CODES;
  const funnel = new FunnelCounter();
  const errors: string[] = [];
  const thisYear = new Date().getUTCFullYear();
  const years = thisYear - ASX_FROM_YEAR + 1;
  const steps = codes.length * years;

  const candidates: AsxAnnouncement[] = [];
  let announcements = 0, codesScanned = 0;

  // 1. Daily: latest five per code from the research API (cheap, ~0.7 s each).
  for (const code of codes) {
    if (Date.now() - start > budget * 0.4) { funnel.count('time_budget', 'codes_remaining'); break; }
    const { rows, status } = await listAsxAnnouncements(code, DAILY_COUNT);
    if (status !== 200) { errors.push(`ASX ${code}: HTTP ${status}`); continue; }
    codesScanned++;
    announcements += rows.length;
    for (const r of rows) { funnel.count('fetched'); if (isAsxDealHeadline(r.headline)) candidates.push(r); else funnel.count('keyword_filtered', 'headline'); }
  }

  // 2. Deep: walk (code × year) from 2017 with a cursor, a few steps per run.
  let deepCode: string | null = null;
  if (opts.deep !== false && !dryRun) {
    const cur = await readSyncCursor<{ step?: number }>(supabase, ASX_CURSOR_SOURCE);
    let step = (cur.state.step ?? 0) % steps;
    let walked = 0;
    while (walked < 6 && Date.now() - start < budget * 0.6) {
      const code = codes[Math.floor(step / years)];
      const year = ASX_FROM_YEAR + (step % years);
      deepCode = `${code}:${year}`;
      const { rows, status } = await listAsxYear(code, year);
      if (status !== 200) { errors.push(`ASX ${code} ${year}: HTTP ${status}`); }
      else {
        announcements += rows.length;
        for (const r of rows) { funnel.count('fetched'); if (isAsxDealHeadline(r.headline)) candidates.push(r); else funnel.count('keyword_filtered', 'headline'); }
      }
      step = (step + 1) % steps;
      walked++;
      await writeSyncCursor(supabase, ASX_CURSOR_SOURCE, `${code}:${year}`, { step, lastCode: code, lastYear: year });
    }
  }

  // 3. Extract. Ledger-less: processAsxAnnouncement dedupes on asx:<idsId> in deals;
  //    rejected announcements are re-extracted only when the same code-year comes round again.
  let extracted = 0, inserted = 0;
  const seen = new Set<string>();
  for (const a of candidates) {
    if (seen.has(a.idsId)) continue;
    seen.add(a.idsId);
    if (Date.now() - start > budget) { funnel.count('time_budget', 'announcements_remaining'); break; }
    if (extracted >= maxExtractions) { funnel.count('time_budget', 'extraction_cap'); break; }
    try {
      extracted++;
      const outcome = await processAsxAnnouncement(supabase, a, { anthropicApiKey: opts.anthropicApiKey, dryRun, minConfidence, reviewConfidence, funnel });
      if (outcome === 'inserted') inserted++;
      if (outcome === 'error') errors.push(`insert error ${a.idsId}`);
    } catch (e) {
      funnel.count('extraction_error', undefined, String(e).slice(0, 120));
      errors.push(`${a.idsId}: ${String(e).slice(0, 160)}`);
    }
  }
  const summary = funnel.summary();
  console.log(`[asx] codes=${codesScanned} deep=${deepCode ?? '-'} announcements=${announcements} deals=${candidates.length} ${summary}${dryRun ? ' (dry run)' : ''}`);
  return { codesScanned, deepCode, announcements, dealHeadlines: candidates.length, extracted, inserted, errors, funnel: funnel.toJSON(), summary };
}
