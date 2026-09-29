/**
 * Pipeline-page crawler (GitHub Actions; see .github/workflows/pipeline-crawler.yml).
 *
 *   npx tsx scripts/pipeline-crawler.ts --discover 150 --crawl 60 --minutes 45 [--llm none|haiku|sonnet] [--paid-search] [--dry-run] [--company <uuid>]
 *
 * Zero-cost by default: discovery uses trial contact emails, Wikidata and
 * domain guessing; extraction is rule-based on the page text. --llm turns on
 * the model extractor (text + screenshot; charts become readable) and
 * --paid-search adds a web search when the free chain finds no site.
 *
 * Two stages, both budgeted:
 *   1. discover: web-search the official site + pipeline page for industry
 *      companies with no website on record (lib/ingestion/company-websites.ts).
 *   2. crawl: render each queued company's pipeline page in headless Chromium,
 *      take the visible text and a screenshot, extract programs
 *      (lib/ingestion/pipeline-pages.ts) and write them through the filing
 *      pipeline's persist path with asset_origin = 'pipeline_page'.
 *
 * Companies with a site but no known pipeline URL get the common paths tried
 * and the homepage navigation scanned for a pipeline link. Every crawled
 * company is stamped pipeline_page_checked_at so the queue drains.
 */

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';
import { runWebsiteDiscovery } from '@/lib/ingestion/company-websites';
import { persistPrograms, PRECLINICAL_MODEL } from '@/lib/ingestion/preclinical-pipeline';
import { addUsage, emptyUsage, usageCostUsd, type IntentClient } from '@/lib/ingestion/management-intent';
import {
  PIPELINE_LINK_RE,
  PIPELINE_PATH_CANDIDATES,
  extractProgramsFromPage,
  extractProgramsHeuristic,
  looksLikePipelinePage,
  pageContext,
  pipelineTextParagraphs,
} from '@/lib/ingestion/pipeline-pages';
import type { DisclosedProgram } from '@/lib/ingestion/preclinical-pipeline';

const LLM_MODELS: Record<string, string> = { haiku: 'claude-haiku-4-5-20251001', sonnet: PRECLINICAL_MODEL };

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const RECRAWL_DAYS = 45;
const PAGE_TIMEOUT_MS = 45_000;
const MAX_SCREENSHOT_HEIGHT = 4_500;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

/**
 * Runs in the page. Pipeline grids often carry the stage only as a bar's
 * class name, a data attribute, an image alt or an aria-label ("phase-2",
 * "preclinical"). Emits one line per row with the row text and any such
 * hints appended, so the rule-based extractor sees name and stage together.
 */
const PAGE_TEXT_SCRIPT = `(() => {
  var STAGE = /(pre-?clinical|nonclinical|discovery|research|ind[- _]?enabling|lead[- _]?opt\\w*|phase[- _]?(?:[123]|i{1,3})(?:[- _\\/]?(?:[23]|i{1,3}))?|approved|marketed|commercial|registration|filed)/i;
  var hintOf = function (el) {
    var out = [];
    var attrs = ['class', 'alt', 'aria-label', 'title', 'data-phase', 'data-stage', 'data-status'];
    for (var i = 0; i < attrs.length; i++) {
      var a = el.getAttribute(attrs[i]) || '';
      var m = STAGE.exec(a);
      if (m) out.push(m[1].replace(/[-_]/g, ' '));
    }
    return out;
  };
  var rows = Array.prototype.slice.call(document.querySelectorAll('tr, li, [role="row"], [class*="row" i], [class*="item" i], [class*="program" i], [class*="pipeline" i] > div'));
  var lines = [];
  var seen = {};
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var t = (row.innerText || '').replace(/\\s+/g, ' ').trim();
    if (t.length < 4 || t.length > 400) continue;
    var hints = {};
    var kids = Array.prototype.slice.call(row.querySelectorAll('*'), 0, 80);
    kids.push(row);
    for (var k = 0; k < kids.length; k++) { var hs = hintOf(kids[k]); for (var h = 0; h < hs.length; h++) hints[hs[h]] = true; }
    var hintList = Object.keys(hints).slice(0, 3);
    var line = hintList.length ? t + ' \\u00b7 [stage hint: ' + hintList.join(', ') + ']' : t;
    if (!seen[line]) { seen[line] = true; lines.push(line); }
  }
  var alts = Array.prototype.slice.call(document.querySelectorAll('img[alt], [aria-label]')).map(function (el) { return (el.getAttribute('alt') || el.getAttribute('aria-label') || '').trim(); }).filter(function (s) { return s.length > 3; });
  return lines.join('\\n') + '\\n' + alts.join('\\n') + '\\n' + (document.body ? document.body.innerText : '');
})()`;

interface CompanyRow { id: string; name: string; website_url: string; pipeline_page_url: string | null }

interface RenderedPage { url: string; text: string; screenshot: string | null; status: number }

async function renderPage(ctx: BrowserContext, url: string, withScreenshot = true): Promise<RenderedPage | null> {
  const page: Page = await ctx.newPage();
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    const status = res?.status() ?? 0;
    if (status >= 400) return { url, text: '', screenshot: null, status };
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(1_200);
    // Dismiss the usual cookie banners so they do not cover the chart.
    for (const sel of ['button:has-text("Accept")', 'button:has-text("Accept all")', 'button:has-text("I agree")', 'button:has-text("OK")', '#onetrust-accept-btn-handler']) {
      const b = page.locator(sel).first();
      if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 2_000 }).catch(() => undefined); break; }
    }
    // Plain JS source string: tsx/esbuild would otherwise inject a __name
    // helper into the serialized function, which does not exist in the page.
    const text = await page.evaluate(PAGE_TEXT_SCRIPT) as string;
    const scrollHeight = withScreenshot ? await page.evaluate(() => document.body?.scrollHeight ?? 0) : 0;
    let screenshot: string | null = null;
    if (scrollHeight > 0) {
      // Viewport capture only (never fullPage): the API rejects images over
      // 8,000 px on a side. 1366 x 4500 JPEG at quality 70 keeps charts legible.
      await page.setViewportSize({ width: 1366, height: Math.max(900, Math.min(scrollHeight, MAX_SCREENSHOT_HEIGHT)) });
      await page.waitForTimeout(400);
      const buf = await page.screenshot({ fullPage: false, type: 'jpeg', quality: 70 }).catch(() => null);
      screenshot = buf ? buf.toString('base64') : null;
    }
    return { url: page.url(), text, screenshot, status };
  } catch (err) {
    if (flag('verbose') || flag('dry-run')) console.error('render failed', url, err instanceof Error ? err.message.split('\n')[0].slice(0, 200) : String(err));
    return null;
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Find the pipeline page: the known URL, then common paths, then a nav link on the homepage. */
async function locatePipelinePage(ctx: BrowserContext, co: CompanyRow, withScreenshot: boolean): Promise<RenderedPage | null> {
  if (co.pipeline_page_url) {
    const r = await renderPage(ctx, co.pipeline_page_url, withScreenshot);
    if (r && r.status < 400 && r.text.length > 50) return r;
  }
  const base = new URL(co.website_url);
  for (const path of PIPELINE_PATH_CANDIDATES) {
    const r = await renderPage(ctx, new URL(path, base).toString(), withScreenshot);
    if (r && r.status < 400 && looksLikePipelinePage(r.text)) return r;
  }
  const home = await ctx.newPage();
  try {
    await home.goto(base.toString(), { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    const links = await home.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => ({ text: (a.textContent || '').trim(), href: (a as HTMLAnchorElement).href })));
    const hit = links.find(l => PIPELINE_LINK_RE.test(l.text) && l.href.startsWith('http') && new URL(l.href).hostname.replace(/^www\./, '') === base.hostname.replace(/^www\./, ''));
    if (hit) {
      const r = await renderPage(ctx, hit.href, withScreenshot);
      if (r && r.status < 400 && r.text.length > 50) return r;
    }
    // Last resort: the homepage itself, when it carries the pipeline.
    const text = await home.evaluate(() => document.body?.innerText ?? '');
    if (looksLikePipelinePage(text)) return await renderPage(ctx, base.toString(), withScreenshot);
  } catch {
    // fall through
  } finally {
    await home.close().catch(() => undefined);
  }
  return null;
}

async function main() {
  const discoverN = Number(arg('discover', '0')) || 0;
  const crawlN = Number(arg('crawl', '40')) || 0;
  const minutes = Number(arg('minutes', '45'));
  const costCap = Number(arg('cost-cap', process.env.PIPELINE_CRAWL_COST_CAP_USD ?? '8'));
  const only = arg('company', '');
  const dryRun = flag('dry-run');
  const llm = arg('llm', 'none');
  const paidSearch = flag('paid-search');
  const model = LLM_MODELS[llm] ?? null;
  if (llm !== 'none' && !model) throw new Error(`--llm must be none, haiku or sonnet (got ${llm})`);
  const started = Date.now();
  const deadline = started + minutes * 60_000;
  const supabase = createServiceClient();
  let client: IntentClient | null = null;
  if (model || paidSearch) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set (needed for --llm / --paid-search)');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 180_000 }) as unknown as IntentClient;
  }
  console.log(new Date().toISOString(), 'mode', JSON.stringify({ llm, paidSearch, discoverN, crawlN, minutes, costCap: model || paidSearch ? costCap : 0 }));

  // ── Stage 1: discovery ────────────────────────────────────────────────
  let discovery: Awaited<ReturnType<typeof runWebsiteDiscovery>> | null = null;
  if (discoverN > 0 && !only) {
    discovery = await runWebsiteDiscovery(supabase, { limit: discoverN, costCapUsd: costCap / 2, timeBudgetMs: Math.min(deadline - Date.now(), 20 * 60_000), client: client ?? undefined, mode: paidSearch ? 'paid' : 'free', pipelinePaths: PIPELINE_PATH_CANDIDATES });
    console.log(new Date().toISOString(), 'discovery', JSON.stringify({ ...discovery, usage: undefined, sample: discovery.sample.slice(0, 6), errors: discovery.errors.slice(0, 3) }));
  }

  // ── Stage 2: crawl ────────────────────────────────────────────────────
  const recrawlBefore = new Date(Date.now() - RECRAWL_DAYS * 86_400_000).toISOString();
  let q = supabase
    .from('companies')
    .select('id, name, website_url, pipeline_page_url')
    .eq('owner_type', 'industry')
    .is('merged_into', null)
    .not('website_url', 'is', null);
  q = only ? q.eq('id', only) : q.or(`pipeline_page_checked_at.is.null,pipeline_page_checked_at.lt.${recrawlBefore}`).order('pipeline_page_checked_at', { ascending: true, nullsFirst: true }).limit(crawlN);
  const { data, error } = await q;
  if (error) throw new Error(`companies read: ${error.message}`);
  const companies = (data ?? []) as CompanyRow[];

  const usage = emptyUsage();
  const totals = { companies: 0, pagesFound: 0, programs: 0, fromChart: 0, chartOnly: 0, created: 0, matched: 0, unmatchedClinical: 0, noPage: 0, fetchFailed: 0, errors: [] as string[], sample: [] as Array<{ company: string; url: string; created: string[]; matched: number }> };
  const browser: Browser = await chromium.launch({ headless: true, channel: 'chromium', args: ['--disable-blink-features=AutomationControlled'] });
  try {
    const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1366, height: 900 }, locale: 'en-US' });
    await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
    // Duplicate company rows (Merck / Merck Oncology / MSD) share a site; crawl each host once per run.
    const seenHosts = new Set<string>();
    for (const co of companies) {
      if (Date.now() > deadline) break;
      if (usageCostUsd(usage) >= costCap) { totals.errors.push('cost cap reached'); break; }
      const host = (() => { try { return new URL(co.pipeline_page_url ?? co.website_url).hostname.replace(/^www\./, ''); } catch { return co.website_url; } })();
      if (seenHosts.has(host)) {
        if (!dryRun) await supabase.from('companies').update({ pipeline_page_status: 'duplicate_host', pipeline_page_checked_at: new Date().toISOString() }).eq('id', co.id);
        continue;
      }
      seenHosts.add(host);
      totals.companies++;
      const now = new Date();
      const stamp = async (status: string, extra: Record<string, unknown> = {}) => {
        if (dryRun) return;
        await supabase.from('companies').update({ pipeline_page_status: status, pipeline_page_checked_at: now.toISOString(), ...extra }).eq('id', co.id);
      };
      try {
        const page = await locatePipelinePage(ctx, co, !!model);
        if (!page) { totals.noPage++; await stamp('no_pipeline_page'); continue; }
        totals.pagesFound++;
        const paragraphs = pipelineTextParagraphs(page.text);
        let programs: DisclosedProgram[];
        let fromChart = 0;
        let extractor = 'heuristic';
        if (model && client) {
          const ex = await extractProgramsFromPage(client, co.name, page.url, now.toISOString(), paragraphs, page.screenshot, model);
          addUsage(usage, ex.usage);
          if (ex.error) { totals.errors.push(`${co.name}: ${ex.error}`); await stamp('fetch_failed', { pipeline_page_url: page.url }); continue; }
          programs = ex.programs;
          fromChart = ex.fromChart;
          extractor = model;
        } else {
          programs = extractProgramsHeuristic(paragraphs);
        }
        totals.programs += programs.length;
        totals.fromChart += fromChart;
        if (dryRun) {
          if (flag('verbose')) for (const p of paragraphs.filter(x => /\[stage hint/.test(x)).slice(0, 15)) console.log('   ', p.slice(0, 160));
          console.log(JSON.stringify({ company: co.name, url: page.url, paragraphs: paragraphs.length, extractor, programs: programs.map(p => `${p.program_name} [${p.stage}]${p.indication_specific ? ` ${p.indication_specific}` : ''}${p.evidence_quote.startsWith('[chart]') ? ' chart' : ''}`) }));
          continue;
        }
        if (programs.length === 0) {
          // A pipeline page with stage words but no extractable rows is a chart: flag it for an optional --llm pass.
          const chartOnly = !model && looksLikePipelinePage(page.text);
          if (chartOnly) totals.chartOnly++;
          await stamp(chartOnly ? 'chart_only' : 'no_programs', { pipeline_page_url: page.url, pipeline_page_programs: 0 });
          continue;
        }
        const persisted = await persistPrograms(supabase, pageContext(co, page.url, now, extractor), programs);
        totals.errors.push(...persisted.errors);
        totals.created += persisted.created.length;
        totals.matched += persisted.matched;
        totals.unmatchedClinical += persisted.unmatchedClinical;
        await stamp('extracted', { pipeline_page_url: page.url, pipeline_page_programs: programs.length });
        if (totals.sample.length < 10) totals.sample.push({ company: co.name, url: page.url, created: persisted.created.slice(0, 6), matched: persisted.matched });
        console.log(new Date().toISOString(), co.name, JSON.stringify({ url: page.url, programs: programs.length, chart: fromChart, created: persisted.created.length, matched: persisted.matched, extractor, cost: Math.round(usageCostUsd(usage) * 100) / 100 }));
      } catch (err) {
        totals.fetchFailed++;
        totals.errors.push(`${co.name}: ${err instanceof Error ? err.message.split('\n')[0].slice(0, 200) : String(err)}`);
        await stamp('fetch_failed');
      }
    }
  } finally {
    await browser.close();
  }

  const costUsd = Math.round(usageCostUsd(usage) * 10_000) / 10_000;
  console.log('TOTAL', JSON.stringify({ ...totals, errors: dryRun ? totals.errors.slice(0, 10) : totals.errors.length, costUsd, discovery: discovery ? { processed: discovery.processed, found: discovery.found, withPipeline: discovery.withPipeline, costUsd: discovery.costUsd } : null }));
  if (dryRun) return;
  await logRadarRun(supabase, {
    source: 'asset_universe',
    startedAt: started,
    status: deriveRunStatus({ errors: totals.errors.length, timedOut: Date.now() > deadline, processed: totals.companies, produced: totals.created + totals.matched }),
    runType: 'scheduled',
    fetched: totals.companies,
    processed: totals.pagesFound,
    inserted: totals.created,
    updated: totals.matched,
    skipped: totals.noPage,
    failed: totals.fetchFailed,
    errors: totals.errors.slice(0, 20),
    parameters: {
      stage: 'pipeline_pages',
      worker: process.env.REGISTRY_WORKER_RUNTIME ?? 'local',
      extractor: model ?? 'heuristic',
      paid_search: paidSearch,
      chart_only: totals.chartOnly,
      programs: totals.programs,
      from_chart: totals.fromChart,
      unmatched_clinical: totals.unmatchedClinical,
      cost_usd: costUsd,
      discovery: discovery ? { processed: discovery.processed, found: discovery.found, with_pipeline: discovery.withPipeline, not_found: discovery.notFound, dead: discovery.dead, cost_usd: discovery.costUsd, errors: discovery.errors.slice(0, 5) } : null,
      sample: totals.sample,
      duration_seconds: Math.round((Date.now() - started) / 1000),
    },
    notes: `pipeline pages: ${totals.pagesFound} pages / ${totals.companies} companies, ${totals.programs} programs (${totals.fromChart} from charts), ${totals.created} created, ${totals.matched} matched, $${costUsd}${discovery ? `; discovery ${discovery.found}/${discovery.processed} sites` : ''}`,
  });
}

main().catch(err => {
  console.error('FATAL', err instanceof Error ? err.stack : err);
  process.exit(1);
});
