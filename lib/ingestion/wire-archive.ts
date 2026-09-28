/**
 * Wire-archive walker: issuer press releases from the newswire archives, by month.
 *
 * Why (Sep 28 2026): the EDGAR full-text backfill has walked every quarter from
 * 2017 to 2025Q3 and yields 25–60 deals a quarter, about 15% of the disclosed
 * market, because only US filers file 8-Ks and only some deals are material
 * enough to file. Nearly every biopharma deal has an issuer release on a wire,
 * and an issuer release on a primary host is a primary citation under the
 * house rule. GlobeNewswire's archive search is a client-rendered app, so the
 * listing is read with a real browser; release bodies are server-rendered and
 * fetched over HTTP. Every candidate then goes through the same gate,
 * extractor, validator and cited insert as the RSS pipeline.
 *
 * Ledger: press_releases (source_url unique). A release is never fetched or
 * extracted twice; the gate verdict is stored as is_deal_announcement and the
 * inserted row id as deal_id, which is also what the coverage report counts.
 *
 * Runs locally (scripts/wire-archive.ts); nothing here is scheduled on Vercel.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Browser, Page } from 'playwright';
import { FunnelCounter } from './funnel';
import { regexDealGate, haikuDealGate } from './deal-gate';
import { validateExtractedDeal } from './deal-extraction-validator';
import { fetchArticleContent, extractDealFromArticle, persistExtractedPressDeal, pressContentHash } from './press-releases';
import { mapWithConcurrency } from './concurrency';

export type WireSource = 'globenewswire';

export interface WireItem {
  source: WireSource;
  url: string;
  title: string;
  /** YYYY-MM-DD, parsed from the release URL. */
  date: string;
  keyword: string;
}

export interface WireArchiveOptions {
  anthropicApiKey: string;
  /** Inclusive month bounds, 'YYYY-MM'. Walked newest first. */
  fromMonth: string;
  toMonth: string;
  keywords?: readonly string[];
  /** Cap on model extractions this run (gate calls are not counted). */
  maxExtractions?: number;
  concurrency?: number;
  dryRun?: boolean;
  /** Stop after this many ms; the ledger makes the next run resume where this one stopped. */
  timeBudgetMs?: number;
  /** Insert [reviewConfidence, insertConfidence) as pending with a review note. */
  reviewConfidence?: number;
  insertConfidence?: number;
  log?: (line: string) => void;
}

export interface WireArchiveResult {
  months: string[];
  listed: number;
  candidates: number;
  fetched: number;
  gated_in: number;
  extracted: number;
  inserted: number;
  duplicates: number;
  errors: string[];
  funnel: Record<string, unknown>;
  timed_out: boolean;
}

/** Search phrases. Quoted so the archive matches the phrase, not the words. */
export const WIRE_KEYWORDS: readonly string[] = [
  '"license agreement"',
  '"licensing agreement"',
  '"exclusive license"',
  '"collaboration and license"',
  '"collaboration agreement"',
  '"option agreement"',
  '"co-development"',
  '"asset purchase agreement"',
  '"definitive agreement" acquire',
  '"upfront payment"',
  '"milestone payments"',
  '"worldwide rights"',
];

const HEADLINE_DEAL = /\b(licen[cs]\w*|collaborat\w*|option|acqui\w*|merger|co-?develop\w*|partner\w*|agreement|rights|milestone\w*|upfront|royalt\w*|alliance|strategic)\b/i;
const HEADLINE_BIO = /\b(therap\w*|pharma\w*|bio\w*|clinic\w*|drug\w*|oncolog\w*|antibod\w*|vaccine\w*|gene|cell|molecul\w*|medicin\w*|disease\w*|treatment\w*|asset\w*|program\w*|pipeline|candidate\w*|compound\w*|indication\w*|patient\w*|FDA|EMA|phase)\b/i;
const HEADLINE_EXCLUDE = /\b(financial results|quarter(?:ly)?\b|earnings|conference call|webcast|to present|will present|investor day|annual meeting|proxy|public offering|private placement|pricing of|closes? .*offering|direct offering|appoint\w*|names? .* as|joins? .* as|board of directors|inducement grant|reverse stock split|Nasdaq (?:listing|notice)|shareholder|analyst)\b/i;

export function headlineLooksLikeDeal(title: string): boolean {
  if (HEADLINE_EXCLUDE.test(title)) return false;
  return HEADLINE_DEAL.test(title) && HEADLINE_BIO.test(title);
}

/** Every 'YYYY-MM' from `to` down to `from`. */
export function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  const out: string[] = [];
  let y = ty, m = tm;
  while (y > fy || (y === fy && m >= fm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1; if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function dateFromGnwUrl(url: string): string | null {
  const m = url.match(/\/news-release\/(\d{4})\/(\d{2})\/(\d{2})\//);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

const GNW_PAGE_SIZE = 50;
const GNW_MAX_PAGES = 20;

/** One keyword × one month on GlobeNewswire's archive search, all pages. */
export async function searchGlobeNewswire(page: Page, keyword: string, from: string, to: string, log?: (l: string) => void): Promise<WireItem[]> {
  const out = new Map<string, WireItem>();
  for (let p = 1; p <= GNW_MAX_PAGES; p++) {
    const url = `https://www.globenewswire.com/search/keyword/${encodeURIComponent(keyword)}/date/[${from}%20TO%20${to}]?pageSize=${GNW_PAGE_SIZE}&page=${p}`;
    let rows: Array<[string, string]> = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
        await page.waitForTimeout(900);
        rows = await page.$$eval('a[href*="/news-release/"]', as =>
          as.map(a => [a.getAttribute('href') ?? '', (a.textContent ?? '').trim()] as [string, string]).filter(([h, t]) => /\/news-release\/\d{4}\/\d{2}\/\d{2}\//.test(h) && t.length > 20));
        break;
      } catch (e) {
        log?.(`[wire] gnw page error ${keyword} ${from} p${p} attempt ${attempt + 1}: ${String(e).slice(0, 120)}`);
        await page.waitForTimeout(3000 * (attempt + 1));
      }
    }
    let added = 0;
    for (const [href, title] of rows) {
      const abs = href.startsWith('http') ? href : `https://www.globenewswire.com${href}`;
      const key = abs.split('?')[0];
      if (out.has(key)) continue;
      const date = dateFromGnwUrl(key);
      if (!date) continue;
      out.set(key, { source: 'globenewswire', url: key, title, date, keyword });
      added++;
    }
    if (rows.length < GNW_PAGE_SIZE || added === 0) break;
  }
  return [...out.values()];
}

interface LedgerRow { source_url: string; processed: boolean | null; deal_id: string | null; is_deal_announcement: boolean | null }

async function loadLedger(supabase: SupabaseClient, urls: string[]): Promise<Map<string, LedgerRow>> {
  const map = new Map<string, LedgerRow>();
  for (let i = 0; i < urls.length; i += 200) {
    const slice = urls.slice(i, i + 200);
    const { data } = await supabase.from('press_releases').select('source_url, processed, deal_id, is_deal_announcement').in('source_url', slice);
    for (const r of data ?? []) map.set(r.source_url as string, r as LedgerRow);
    const { data: deals } = await supabase.from('deals').select('id, source_url, press_release_url').or(`source_url.in.(${slice.map(u => `"${u}"`).join(',')}),press_release_url.in.(${slice.map(u => `"${u}"`).join(',')})`);
    for (const d of deals ?? []) {
      const u = (d.press_release_url as string | null) ?? (d.source_url as string);
      if (u && !map.get(u)?.deal_id) map.set(u, { source_url: u, processed: true, deal_id: d.id as string, is_deal_announcement: true });
    }
  }
  return map;
}

async function upsertLedger(supabase: SupabaseClient, item: WireItem, patch: Partial<{ processed: boolean; is_deal_announcement: boolean; deal_id: string | null; processing_notes: string; body_text: string }>): Promise<void> {
  const row = {
    source: item.source,
    source_url: item.url,
    source_id: item.url,
    headline: item.title.slice(0, 500),
    published_at: `${item.date}T00:00:00Z`,
    feed: `archive:${item.keyword.replace(/"/g, '')}`,
    content_hash: pressContentHash(item.source, item.title, item.date),
    raw: { archive: true, keyword: item.keyword, month: item.date.slice(0, 7) },
    updated_at: new Date().toISOString(),
    ...patch,
  };
  const { error } = await supabase.from('press_releases').upsert(row, { onConflict: 'source_url' });
  if (error) throw new Error(`ledger upsert ${item.url}: ${error.message}`);
}

export async function runWireArchive(supabase: SupabaseClient, browser: Browser, opts: WireArchiveOptions): Promise<WireArchiveResult> {
  const start = Date.now();
  const budget = opts.timeBudgetMs ?? 6 * 3_600_000;
  const maxExtractions = opts.maxExtractions ?? 400;
  const concurrency = Math.max(1, opts.concurrency ?? 3);
  const insertConfidence = opts.insertConfidence ?? 75;
  const reviewConfidence = opts.reviewConfidence ?? 60;
  const keywords = opts.keywords ?? WIRE_KEYWORDS;
  const log = opts.log ?? ((l: string) => console.log(l));
  const funnel = new FunnelCounter();
  const result: WireArchiveResult = { months: [], listed: 0, candidates: 0, fetched: 0, gated_in: 0, extracted: 0, inserted: 0, duplicates: 0, errors: [], funnel: {}, timed_out: false };
  const page = await (await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36', locale: 'en-US' })).newPage();
  let extractions = 0;

  try {
    for (const month of monthsBetween(opts.fromMonth, opts.toMonth)) {
      if (Date.now() - start > budget) { result.timed_out = true; break; }
      const { from, to } = monthBounds(month);
      const items = new Map<string, WireItem>();
      for (const kw of keywords) {
        if (Date.now() - start > budget) { result.timed_out = true; break; }
        const found = await searchGlobeNewswire(page, kw, from, to, log);
        for (const it of found) if (!items.has(it.url)) items.set(it.url, it);
        log(`[wire] ${month} ${kw}: ${found.length} listed, ${items.size} unique so far`);
      }
      result.months.push(month);
      result.listed += items.size;
      const all = [...items.values()];
      for (const it of all) funnel.count('fetched');
      const candidates = all.filter(it => headlineLooksLikeDeal(it.title));
      for (let i = 0; i < all.length - candidates.length; i++) funnel.count('keyword_filtered', 'headline');
      result.candidates += candidates.length;

      const ledger = await loadLedger(supabase, candidates.map(c => c.url));
      const todo = candidates.filter(c => { const l = ledger.get(c.url); return !(l && (l.processed || l.deal_id)); });
      for (let i = 0; i < candidates.length - todo.length; i++) funnel.count('already_in_table');
      log(`[wire] ${month}: ${all.length} listed, ${candidates.length} deal-like headlines, ${todo.length} not yet processed`);

      await mapWithConcurrency(todo, concurrency, async (item) => {
        if (Date.now() - start > budget) { result.timed_out = true; return; }
        if (extractions >= maxExtractions) return;
        try {
          const content = await fetchArticleContent(item.url);
          if (content.length < 300) {
            funnel.count('content_unavailable', item.source, item.url);
            if (!opts.dryRun) await upsertLedger(supabase, item, { processed: true, is_deal_announcement: false, processing_notes: 'archive: body unavailable' });
            return;
          }
          result.fetched++;
          const rg = regexDealGate(content);
          if (!rg.keep) {
            funnel.count('gate_rejected', rg.reason);
            if (!opts.dryRun) await upsertLedger(supabase, item, { processed: true, is_deal_announcement: false, processing_notes: `archive: ${rg.reason}` });
            return;
          }
          const hk = await haikuDealGate(content, opts.anthropicApiKey);
          if (!hk.keep) {
            funnel.count('gate_rejected', hk.reason);
            if (!opts.dryRun) await upsertLedger(supabase, item, { processed: true, is_deal_announcement: false, processing_notes: `archive: ${hk.reason}` });
            return;
          }
          result.gated_in++;
          if (extractions >= maxExtractions) return;
          extractions++;
          const deal = await extractDealFromArticle(item.title, content, 'GlobeNewswire archive', opts.anthropicApiKey);
          if (!deal) {
            funnel.count('not_a_deal', 'article', item.title);
            if (!opts.dryRun) await upsertLedger(supabase, item, { processed: true, is_deal_announcement: false, processing_notes: 'archive: extractor found no deal' });
            return;
          }
          if (deal.confidence_score < reviewConfidence || !deal.licensor || !deal.licensee) {
            funnel.count(deal.confidence_score < reviewConfidence ? 'confidence_gate' : 'missing_parties', undefined, `${deal.licensor} → ${deal.licensee} c=${deal.confidence_score}`);
            if (!opts.dryRun) await upsertLedger(supabase, item, { processed: true, is_deal_announcement: true, processing_notes: `archive: below confidence (${deal.confidence_score}) or missing party` });
            return;
          }
          const validation = validateExtractedDeal({
            licensor: deal.licensor, licensee: deal.licensee, modality: deal.modality, asset_name: deal.asset_name,
            indication_specific: deal.indication_specific, upfront_usd: deal.upfront_usd, total_deal_value_usd: deal.total_deal_value_usd,
            confidence_score: deal.confidence_score, source_url: item.url, source_filing_id: item.url,
          }, { minConfidence: reviewConfidence });
          if (!validation.valid) {
            funnel.count('validator_rejected', validation.rejectCode, `${deal.licensor} → ${deal.licensee}: ${validation.rejectReason}`);
            if (!opts.dryRun) await upsertLedger(supabase, item, { processed: true, is_deal_announcement: true, processing_notes: `archive: validator ${validation.rejectCode}` });
            return;
          }
          result.extracted++;
          const needsReview = deal.confidence_score < insertConfidence;
          const ins = await persistExtractedPressDeal(supabase, { deal, content, link: item.url, guid: item.url, pubDate: item.date, sourceName: 'GlobeNewswire archive', needsReview, dryRun: !!opts.dryRun });
          if (ins.outcome === 'inserted') {
            result.inserted++;
            funnel.count(opts.dryRun ? 'dry_run_would_insert' : 'inserted', undefined, `${deal.licensor} → ${deal.licensee} ${deal.total_deal_value_usd ?? ''}`);
            if (!opts.dryRun) await upsertLedger(supabase, item, { processed: true, is_deal_announcement: true, deal_id: ins.id ?? null, processing_notes: 'archive: inserted' });
          } else if (ins.outcome === 'duplicate') {
            result.duplicates++;
            funnel.count('insert_duplicate');
            if (!opts.dryRun) await upsertLedger(supabase, item, { processed: true, is_deal_announcement: true, processing_notes: `archive: duplicate of existing row${ins.id ? ' ' + ins.id : ''}` });
          } else {
            funnel.count('insert_error', ins.outcome, ins.error);
            result.errors.push(`insert ${item.url}: ${ins.error}`);
          }
        } catch (e) {
          funnel.count('extraction_error', undefined, String(e).slice(0, 120));
          result.errors.push(`${item.url}: ${String(e).slice(0, 160)}`);
        }
      });
      if (extractions >= maxExtractions) { log(`[wire] extraction cap ${maxExtractions} reached in ${month}`); break; }
    }
  } finally {
    await page.context().close().catch(() => {});
  }

  result.funnel = funnel.toJSON();
  if (!opts.dryRun) {
    await supabase.from('data_ingestion_log').insert({
      source: 'wire_archive', run_type: 'manual',
      parameters: { from: opts.fromMonth, to: opts.toMonth, months: result.months, keywords: keywords.length, maxExtractions, funnel: result.funnel },
      records_fetched: result.listed, records_processed: result.candidates, records_inserted: result.inserted, records_skipped: result.duplicates,
      records_failed: result.errors.length, errors: result.errors.slice(0, 50),
      status: result.errors.length > 0 ? 'partial' : 'completed', completed_at: new Date().toISOString(),
    });
    await supabase.rpc('recompute_deal_dedupe');
  }
  log(`[wire] done: months=${result.months.length} listed=${result.listed} candidates=${result.candidates} fetched=${result.fetched} gated_in=${result.gated_in} extracted=${result.extracted} inserted=${result.inserted} duplicates=${result.duplicates} errors=${result.errors.length} | ${funnel.summary()}`);
  return result;
}
