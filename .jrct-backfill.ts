/* One-off local jRCT backfill at the adapter's 1.5 s pace; pauses 15 min when MHLW rate-limits. */
import { createServiceClient } from '@/lib/supabase/server';
import { runRegistrySweep } from '@/lib/ingestion/registries';
import { jrctAdapter } from '@/lib/ingestion/registries/jrct';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
(async () => {
  const supabase = createServiceClient();
  const started = Date.now();
  let total = { fetched: 0, stored: 0, bridged: 0, mapped: 0, skipped: 0, companies: 0, errors: 0, pauses: 0 };
  for (let round = 1; round <= 300; round++) {
    const r = await runRegistrySweep(supabase, jrctAdapter, { budgetMs: 5 * 60 * 1000, limit: 40, maxPages: 2 });
    total = { ...total, fetched: total.fetched + r.fetched, stored: total.stored + r.stored, bridged: total.bridged + r.bridged, mapped: total.mapped + r.mapped, skipped: total.skipped + r.skipped, companies: total.companies + r.companiesCreated, errors: total.errors + r.errors.length };
    console.log(new Date().toISOString(), `round ${round}`, JSON.stringify({ pages: r.pages, fetched: r.fetched, stored: r.stored, mapped: r.mapped, bridged: r.bridged, done: r.done, unavailable: r.unavailable ?? null, cursor: r.cursor?.slice(0, 50), warnings: r.warnings.slice(0, 1), errors: r.errors.slice(0, 1) }), 'total', JSON.stringify(total), `${Math.round((Date.now() - started) / 60000)} min`);
    if (r.done) { console.log('DONE listing exhausted'); break; }
    if (r.unavailable || r.errors.length >= 3 || (r.fetched === 0 && r.pages > 0)) {
      total.pauses++;
      if (total.pauses > 8) { console.log('STOP: too many pauses'); break; }
      console.log('rate-limited or empty; pausing 15 min');
      await sleep(15 * 60 * 1000);
    }
  }
})().catch(e => { console.error('FATAL', e instanceof Error ? e.stack : e); process.exit(1); });
