#!/usr/bin/env npx tsx
/**
 * Run the live deal sources locally in DRY RUN and print their funnels.
 * Nothing is written to deals or companies. Claude is called for extraction,
 * so budget a few dollars per run.
 *
 *   npx tsx scripts/ingestion/dry-run-live-sources.ts press --max 4
 *   npx tsx scripts/ingestion/dry-run-live-sources.ts edgar --date 2026-09-15
 */
import { createClient } from '@supabase/supabase-js';
import { runPressReleaseIngestion } from '@/lib/ingestion/press-releases';
import { runEdgarRealtime } from '@/lib/ingestion/edgar-realtime';

const [, , which, ...rest] = process.argv;
const arg = (k: string, d: string) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : d; };
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const key = process.env.ANTHROPIC_API_KEY!;

(async () => {
  if (which === 'press') {
    const r = await runPressReleaseIngestion(sb, key, { dryRun: true, maxArticlesPerSource: Number(arg('max', '4')), timeBudgetMs: Number(arg('budget', '420000')) });
    console.log('\nRESULT press_releases dry run');
    console.log(JSON.stringify({ sources_checked: r.sources_checked, articles_found: r.articles_found, potential_deals: r.potential_deals, deals_extracted: r.deals_extracted, would_insert: r.deals_inserted, errors: r.errors.length }, null, 0));
    console.log(JSON.stringify(r.funnel, null, 2));
    if (r.errors.length) console.log('errors sample:', r.errors.slice(0, 5));
  } else if (which === 'edgar') {
    const r = await runEdgarRealtime(sb, { dryRun: true, anthropicApiKey: key, date: arg('date', new Date().toISOString().slice(0, 10)), timeBudgetMs: Number(arg('budget', '420000')), maxExtractions: Number(arg('max', '25')) });
    console.log('\nRESULT edgar_realtime dry run', r.date);
    console.log(JSON.stringify({ fetched: r.fetched, processed: r.processed, would_insert: r.inserted, errors: r.errors.length, noFilings: r.noFilings }));
    console.log(JSON.stringify(r.funnel, null, 2));
    if (r.errors.length) console.log('errors sample:', r.errors.slice(0, 5));
  } else {
    console.error('usage: press|edgar'); process.exit(1);
  }
})();
