/**
 * Resolve scripts/data/same-company-hand-groups.txt (id prefixes and name:<exact name>)
 * to full canonical companies.id lines for merge-same-company-rows.ts --extra.
 *
 *   npx tsx scripts/build-same-company-groups.ts [--in file] [--out tmp/same-company-extra-groups.txt]
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

const args = process.argv.slice(2);
const IN = args.includes('--in') ? args[args.indexOf('--in') + 1] : 'scripts/data/same-company-hand-groups.txt';
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'tmp/same-company-extra-groups.txt';

(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  // uuid columns cannot be LIKE-matched through PostgREST: load the live rows once and resolve locally.
  const live: Array<{ id: string; name: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('companies').select('id,name').is('merged_into', null).order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    live.push(...((data ?? []) as Array<{ id: string; name: string }>));
    if (!data || data.length < 1000) break;
  }
  const byName = new Map<string, string[]>();
  for (const r of live) { const k = r.name.trim().toLowerCase(); byName.set(k, [...(byName.get(k) ?? []), r.id]); }
  const lines = readFileSync(IN, 'utf8').split('\n').map(l => l.split('#')[0].trim()).filter(Boolean);
  const out: string[] = [];
  const unresolved: string[] = [];
  let groups = 0, rows = 0;
  for (const line of lines) {
    const ids: string[] = [];
    for (const item of line.split('||').map(s => s.trim()).filter(Boolean)) {
      if (item.startsWith('name:')) {
        const hits = byName.get(item.slice(5).trim().toLowerCase()) ?? [];
        if (hits.length === 1) ids.push(hits[0]);
        else if (hits.length > 1) unresolved.push(`${item} → ${hits.length} live rows`);
        // 0 hits: an alternative spelling that does not exist — silently skipped.
      } else {
        const hits = live.filter(r => r.id.startsWith(item.toLowerCase()));
        if (hits.length === 1) ids.push(hits[0].id);
        else unresolved.push(`${item} → ${hits.length} live rows`);
      }
    }
    const uniq = [...new Set(ids)];
    if (uniq.length >= 2) { out.push(uniq.join(',')); groups++; rows += uniq.length; }
    else unresolved.push(`group dropped (fewer than 2 resolved): ${line.slice(0, 90)}`);
  }
  writeFileSync(OUT, out.join('\n') + '\n');
  console.log(`${groups} groups, ${rows} rows → ${OUT}`);
  if (unresolved.length) console.log('unresolved:\n  ' + unresolved.join('\n  '));
})();
