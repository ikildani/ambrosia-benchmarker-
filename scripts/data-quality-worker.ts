/**
 * Data-quality worker (GitHub Actions; see .github/workflows/data-quality-worker.yml).
 *
 *   npx tsx scripts/data-quality-worker.ts --job wire-archive --from 2024-01 --to 2026-09 --minutes 300 [--max 400] [--dry-run]
 *   npx tsx scripts/data-quality-worker.ts --job flag-fix --minutes 40 [--max 60]
 *   npx tsx scripts/data-quality-worker.ts --job resource --minutes 30 [--max 80]
 *
 * Same shape as scripts/registry-worker.ts: a real browser where a listing is
 * client-rendered, the repo's own ingestion modules for every write, and one
 * data_ingestion_log row per run. Jobs:
 *   wire-archive  issuer releases from the newswire archives (lib/ingestion/wire-archive.ts)
 *   flag-fix      repair flagged rows from a primary document (lib/ingestion/flag-fixer.ts)
 *   resource      attach a primary citation to rows that only have a secondary one (lib/ingestion/resource.ts)
 */
import { chromium } from '@playwright/test';
import { createServiceClient } from '@/lib/supabase/server';
import { runWireArchive, WIRE_KEYWORDS } from '@/lib/ingestion/wire-archive';
import { fixFlaggedDeals } from '@/lib/ingestion/flag-fixer';
import { runResourcing } from '@/lib/ingestion/resource';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main(): Promise<void> {
  const job = arg('job', 'wire-archive');
  const minutes = Number(arg('minutes', '40'));
  const dryRun = flag('dry-run');
  const supabase = createServiceClient();
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? '';
  const perplexityApiKey = process.env.PERPLEXITY_API_KEY ?? '';
  const log = (l: string) => console.log(new Date().toISOString().slice(11, 19), l);

  if (job === 'wire-archive') {
    if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY missing');
    const from = arg('from', '2026-01');
    const to = arg('to', new Date().toISOString().slice(0, 7));
    const max = Number(arg('max', '400'));
    const kw = arg('keywords', '');
    const keywords = kw ? kw.split(',').map(s => s.trim()).filter(Boolean) : WIRE_KEYWORDS;
    const src = arg('sources', 'globenewswire,prnewswire').split(',').map(s => s.trim()).filter(Boolean) as Array<'globenewswire' | 'prnewswire'>;
    const browser = await chromium.launch({ headless: true });
    try {
      const r = await runWireArchive(supabase, browser, {
        anthropicApiKey, fromMonth: from, toMonth: to, keywords, sources: src, maxExtractions: max,
        concurrency: Number(arg('concurrency', '3')), dryRun, timeBudgetMs: minutes * 60_000, log,
      });
      console.log(JSON.stringify(dryRun ? r : { ...r, funnel: undefined }, null, 1));
    } finally {
      await browser.close();
    }
    return;
  }

  if (job === 'flag-fix') {
    if (!anthropicApiKey || !perplexityApiKey) throw new Error('ANTHROPIC_API_KEY / PERPLEXITY_API_KEY missing');
    const max = Number(arg('max', '60'));
    const start = Date.now();
    let attempted = 0, fixed = 0, duplicates = 0, unresolved = 0;
    // The fixer picks up to maxDeals flagged rows not attempted in the last retryAfterDays; loop until the budget is spent.
    while (Date.now() - start < minutes * 60_000 && attempted < max) {
      const r = await fixFlaggedDeals(supabase, perplexityApiKey, anthropicApiKey, { maxDeals: Math.min(10, max - attempted), timeBudgetMs: Math.min(240_000, minutes * 60_000 - (Date.now() - start)) });
      attempted += r.attempted; fixed += r.fixed; duplicates += r.duplicates; unresolved += r.unresolved;
      log(`[flag-fix] batch attempted=${r.attempted} fixed=${r.fixed} duplicates=${r.duplicates} unresolved=${r.unresolved} errors=${r.errors.length}`);
      for (const e of r.errors.slice(0, 3)) log(`[flag-fix] ${e}`);
      if (r.attempted === 0) break;
    }
    if (fixed + duplicates > 0) await supabase.rpc('recompute_deal_dedupe');
    log(`[flag-fix] done attempted=${attempted} fixed=${fixed} duplicates=${duplicates} unresolved=${unresolved}`);
    return;
  }

  if (job === 'resource') {
    const max = Number(arg('max', '80'));
    const r = await runResourcing(supabase, { maxRows: max, timeBudgetMs: minutes * 60_000 });
    console.log(JSON.stringify(r, null, 1));
    return;
  }

  throw new Error(`unknown --job ${job}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
