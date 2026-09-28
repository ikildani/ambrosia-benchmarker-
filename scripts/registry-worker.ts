/**
 * Browser registry worker (GitHub Actions; see .github/workflows/registry-worker.yml).
 *
 *   npx tsx scripts/registry-worker.ts --registry cde --minutes 40 [--dry-run] [--limit 20]
 *
 * Drives headless Chromium through Playwright to pass the registry's
 * JavaScript challenge, then reads listing and detail pages through the
 * browser context and upserts through runRegistrySweep, exactly like the
 * Vercel cron does for API registries. --dry-run fetches one page and prints
 * the mapped records without touching the database.
 */

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { createServiceClient } from '@/lib/supabase/server';
import { runRegistrySweep, getRegistryAdapter, type AnyRegistryAdapter } from '@/lib/ingestion/registries';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';
import { createCdeFetchPage, type CdeSession } from '@/lib/ingestion/registries/browser/cde-fetch';
import { CDE_BASE } from '@/lib/ingestion/registries/browser/cde-pages';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function stealthContext(browser: Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    userAgent: UA,
    locale: 'zh-CN',
    viewport: { width: 1366, height: 860 },
    extraHTTPHeaders: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return ctx;
}

/** Load the CDE home page and submit the search form once so the WAF cookie exists. */
async function cdeSession(ctx: BrowserContext): Promise<CdeSession> {
  let page: Page | null = null;
  const bootstrap = async () => {
    page?.close().catch(() => undefined);
    page = await ctx.newPage();
    await page.goto(`${CDE_BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForSelector('form[action*="searchlist"]', { timeout: 60_000 });
    await page.waitForTimeout(1_000);
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.locator('form[action*="searchlist"]').first().evaluate(f => (f as HTMLFormElement).submit()),
    ]);
    await page.waitForSelector('a[onclick*="getDetail"]', { timeout: 60_000 });
    console.log(new Date().toISOString(), 'cde session ready');
  };
  await bootstrap();
  // POSTs run inside the loaded page: the WAF's script decorates fetch() with
  // the per-request token, so consecutive requests succeed (the context-level
  // request API got a 202 challenge after two requests).
  const postInPage = async (path: string, form: Record<string, string>) => {
    if (!page) throw new Error('cde session not bootstrapped');
    return page.evaluate(async ({ path, form }) => {
      const res = await fetch(path, {
        method: 'POST',
        body: new URLSearchParams(form),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'include',
      });
      return { status: res.status, text: await res.text() };
    }, { path, form });
  };
  return {
    async post(path, form) {
      const res = await postInPage(path, form);
      if (flag('verbose')) console.log(new Date().toISOString(), 'post', path.replace('/clinicaltrials.', ''), form.id ? `id=${form.id.slice(0, 8)}` : `page=${form.currentpage}`, res.status, `${res.text.length}B`);
      return res;
    },
    async refresh() {
      console.log(new Date().toISOString(), 'cde session refresh');
      await bootstrap();
    },
  };
}

async function main() {
  const registry = arg('registry', 'cde');
  const minutes = Number(arg('minutes', '40'));
  const limit = Number(arg('limit', '20'));
  const dryRun = flag('dry-run');
  const started = Date.now();

  const base = getRegistryAdapter(registry);
  if (!base) throw new Error(`unknown registry ${registry}`);
  if (registry !== 'cde') throw new Error(`no browser fetcher for ${registry} yet`);

  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: ['--disable-blink-features=AutomationControlled'] });
  try {
    const ctx = await stealthContext(browser);
    const session = await cdeSession(ctx);
    // 1.5 s between requests: the site answers in ~0.4 s and one run must cover ~1,500 records.
    const adapter: AnyRegistryAdapter = { ...base, fetchPage: createCdeFetchPage(session, { rateLimitMs: 1_500 }) };

    if (dryRun) {
      const page = await adapter.fetchPage(null, { limit });
      console.log(JSON.stringify({ records: page.records.length, done: page.done, warnings: page.warnings, cursor: page.nextCursor?.slice(0, 80) }, null, 1));
      for (const r of page.records.slice(0, limit)) {
        console.log(JSON.stringify({ id: r.registry_id, sponsor: r.sponsor_name, type: r.sponsor_type, phase: r.phase, status: r.status, iv: r.interventions.map(i => `${i.name}(${i.role})`), cond: r.conditions.slice(0, 2), first: r.first_registered, title: r.title?.slice(0, 60) }));
      }
      return;
    }

    const supabase = createServiceClient();
    const budgetMs = minutes * 60_000;
    const totals = { pages: 0, fetched: 0, stored: 0, bridged: 0, mapped: 0, skipped: 0, companies: 0, errors: [] as string[], warnings: [] as string[], done: false, unavailable: null as string | null, cursor: null as string | null };
    while (Date.now() - started < budgetMs) {
      const remaining = budgetMs - (Date.now() - started);
      const r = await runRegistrySweep(supabase, adapter, { budgetMs: Math.min(remaining, 10 * 60_000), limit, maxPages: 5 });
      totals.pages += r.pages; totals.fetched += r.fetched; totals.stored += r.stored; totals.bridged += r.bridged;
      totals.mapped += r.mapped; totals.skipped += r.skipped; totals.companies += r.companiesCreated;
      totals.errors.push(...r.errors); totals.warnings.push(...r.warnings); totals.cursor = r.cursor;
      console.log(new Date().toISOString(), JSON.stringify({ pages: r.pages, fetched: r.fetched, stored: r.stored, mapped: r.mapped, bridged: r.bridged, skipped: r.skipped, companies: r.companiesCreated, done: r.done, unavailable: r.unavailable ?? null, errors: r.errors.slice(0, 2), warnings: r.warnings.slice(0, 2) }));
      if (r.done) { totals.done = true; break; }
      if (r.unavailable) { totals.unavailable = r.unavailable; break; }
      if (r.errors.length >= 5) break;
    }

    const status = totals.unavailable ? 'partial' : deriveRunStatus({ errors: totals.errors.length, timedOut: !totals.done, processed: totals.fetched, produced: totals.stored });
    await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt: started,
      status,
      runType: 'scheduled',
      fetched: totals.fetched,
      processed: totals.fetched,
      inserted: totals.mapped,
      updated: totals.stored,
      skipped: totals.skipped,
      failed: totals.errors.length,
      errors: totals.errors.slice(0, 20),
      parameters: {
        stage: 'registry_sweep',
        registry,
        worker: process.env.REGISTRY_WORKER_RUNTIME ?? 'local',
        pages: totals.pages,
        bridged: totals.bridged,
        companies_created: totals.companies,
        done: totals.done,
        unavailable: totals.unavailable,
        cursor: totals.cursor,
        warnings: totals.warnings.slice(0, 20),
        duration_seconds: Math.round((Date.now() - started) / 1000),
      },
      notes: `browser worker ${registry}: ${totals.stored} stored, ${totals.mapped} mapped, ${totals.bridged} bridged over ${totals.pages} pages${totals.unavailable ? ` (${totals.unavailable})` : ''}`,
    });
    console.log('TOTAL', JSON.stringify({ ...totals, errors: totals.errors.length, warnings: totals.warnings.length }));
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('FATAL', err instanceof Error ? err.stack : err);
  process.exit(1);
});
