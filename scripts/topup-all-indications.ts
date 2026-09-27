/**
 * Coverage program: bring every registry indication up to a quotable
 * comparable set. Seeds the brief_topups queue (request_id null) for every
 * indication that is red or amber on same-indication comparables, then drains
 * it locally with bounded parallelism — the same runner the discovery cron
 * uses, so every row lands as pending for the verifier.
 *
 *   npx tsx scripts/topup-all-indications.ts --seed                 # score all indications, queue the thin ones, print the plan
 *   npx tsx scripts/topup-all-indications.ts --seed --ta oncology   # one area
 *   npx tsx scripts/topup-all-indications.ts --run --max 30 --parallel 3   # drain up to 30 queued top-ups
 *   npx tsx scripts/topup-all-indications.ts --status               # queue and yield so far
 *
 * Cost guard: --max caps the number of top-ups per invocation (each is 3–4
 * Perplexity searches and 3–4 Opus extractions). Nothing is trusted before
 * the verifier reaches it.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { computeReadiness } from '../lib/brief/readiness';
import { fetchQualityDealRows } from '../lib/brief/comp-set';
import { INDICATION_REGISTRY } from '../lib/benchmarkPagesIndication';
import { runIndicationTopup, MAX_RUNS } from '../lib/ingestion/indication-topup';

interface Args { seed: boolean; run: boolean; status: boolean; ta: string | null; max: number; parallel: number; phase: string }
function parseArgs(argv: string[]): Args {
  const a: Args = { seed: false, run: false, status: false, ta: null, max: 20, parallel: 2, phase: 'phase2' };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--seed') a.seed = true; else if (t === '--run') a.run = true; else if (t === '--status') a.status = true;
    else if (t === '--ta') a.ta = argv[++i] ?? null; else if (t === '--max') a.max = Number(argv[++i]); else if (t === '--parallel') a.parallel = Math.max(1, Math.min(4, Number(argv[++i]) || 1));
    else if (t === '--phase') a.phase = argv[++i] ?? 'phase2';
  }
  return a;
}

/** Areas a brief is most likely to be ordered in go first. */
const TA_PRIORITY = ['oncology', 'neurology', 'immunology', 'rareDisease', 'hematology', 'metabolic', 'cardiovascular', 'infectiousDisease', 'dermatology', 'ophthalmology', 'gastroenterology', 'womensHealth'];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const sb = createClient(url, key);

  if (args.status) {
    const { data } = await sb.from('brief_topups').select('status, indication, therapeutic_area, runs, deals_inserted, deals_discovered, readiness_before, readiness_after').is('request_id', null).order('created_at');
    const rows = (data ?? []) as Array<{ status: string; indication: string; therapeutic_area: string; runs: number; deals_inserted: number; deals_discovered: number; readiness_before: { counts?: { sameIndication: number } } | null; readiness_after: { counts?: { sameIndication: number } } | null }>;
    const tally = rows.reduce((m, r) => { m[r.status] = (m[r.status] ?? 0) + 1; return m; }, {} as Record<string, number>);
    console.log('queue', tally, 'inserted so far', rows.reduce((s, r) => s + r.deals_inserted, 0), 'discovered', rows.reduce((s, r) => s + r.deals_discovered, 0));
    for (const r of rows.filter(r => r.status !== 'pending')) console.log(`  ${r.status.padEnd(7)} ${r.therapeutic_area.padEnd(16)} ${r.indication.padEnd(40)} runs=${r.runs} +${r.deals_inserted} (${r.readiness_before?.counts?.sameIndication ?? '?'} → ${r.readiness_after?.counts?.sameIndication ?? '?'} comps)`);
    return;
  }

  if (args.seed) {
    const rows = await fetchQualityDealRows(sb);
    const { data: existing } = await sb.from('brief_topups').select('indication_key, status').is('request_id', null);
    const queued = new Set(((existing ?? []) as Array<{ indication_key: string | null; status: string }>).filter(e => e.status === 'pending' || e.status === 'running').map(e => e.indication_key));
    const plan: Array<{ key: string; label: string; ta: string; comps: number; status: string }> = [];
    for (const d of INDICATION_REGISTRY) {
      if (args.ta && d.ta !== args.ta) continue;
      const r = await computeReadiness(sb, { therapeuticArea: d.ta, indication: d.label, phase: args.phase, rows, skipTerrain: true });
      if (r.lines[0].status === 'green' || queued.has(d.value)) continue;
      plan.push({ key: d.value, label: d.label, ta: d.ta, comps: r.counts.sameIndication, status: r.lines[0].status });
    }
    plan.sort((a, b) => TA_PRIORITY.indexOf(a.ta) - TA_PRIORITY.indexOf(b.ta) || a.comps - b.comps);
    if (plan.length) {
      const { error } = await sb.from('brief_topups').insert(plan.map(p => ({ request_id: null, therapeutic_area: p.ta, indication: p.label, indication_key: p.key, phase: args.phase, notes: `coverage program: ${p.comps} same-indication comps at seed` })));
      if (error) throw new Error(error.message);
    }
    console.log(`queued ${plan.length} indications (${plan.filter(p => p.status === 'red').length} red, ${plan.filter(p => p.status === 'amber').length} amber); already queued ${queued.size}`);
    const byTa = plan.reduce((m, p) => { m[p.ta] = (m[p.ta] ?? 0) + 1; return m; }, {} as Record<string, number>);
    console.log(byTa);
    return;
  }

  if (args.run) {
    const pk = process.env.PERPLEXITY_API_KEY; const ak = process.env.ANTHROPIC_API_KEY;
    if (!pk || !ak) throw new Error('PERPLEXITY_API_KEY and ANTHROPIC_API_KEY are required');
    let done = 0; let inserted = 0; let discovered = 0;
    const worker = async (n: number) => {
      while (done < args.max) {
        const slot = done++;
        if (slot >= args.max) break;
        const r = await runIndicationTopup(sb, pk, ak, { timeBudgetMs: 240_000 });
        if (r.status === 'none') {
          // Empty queue ends the run; a transient read error does not.
          if (!r.errors.length) { done = args.max; break; }
          console.warn(`[w${n}] queue read failed (${r.errors[0].slice(0, 80)}); retrying in 30s`);
          done--; await new Promise(res => setTimeout(res, 30_000)); continue;
        }
        inserted += r.dealsInserted; discovered += r.dealsDiscovered;
        console.log(`[w${n}] ${r.indication}: ${r.queriesRun} queries, ${r.dealsDiscovered} found, ${r.dealsInserted} inserted → ${r.status}${r.readinessAfter ? ` · ${r.readinessAfter.split(' · ')[1]}` : ''}${r.errors.length ? ` · ${r.errors[0].slice(0, 80)}` : ''}`);
      }
    };
    await Promise.all(Array.from({ length: args.parallel }, (_, i) => worker(i + 1)));
    console.log(`done: ${discovered} discovered, ${inserted} inserted (pending verification); MAX_RUNS per indication ${MAX_RUNS}`);
    return;
  }
  console.log('nothing to do: pass --seed, --run or --status');
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
