/**
 * Re-resolve deal parties that were routed to the wrong company row.
 *
 * Why: a subsidiary or combined row ("Alexion (AstraZeneca)", "Arena/Pfizer",
 * "Roche Holding AG") listed the parent's name among its name_variations, so
 * deals whose licensor/licensee string is exactly "AstraZeneca", "Pfizer" or
 * "Roche" were linked to the wrong row. The merge job's dry run lists them
 * (docs/entity-graph.md → "Deals mis-routed through a parent alias").
 *
 * This script fixes the deterministic subset only: the deal's party string
 * equals, case-insensitively, the name of a canonical company row. Everything
 * else stays for a human pass.
 *
 * Usage:
 *   npx tsx scripts/reresolve-deal-parties.ts                 # dry run, prints the plan
 *   MERGE_APPLY=yes npx tsx scripts/reresolve-deal-parties.ts --apply --run-id <id>
 *
 * Audit: one company_merges row per deal side repointed, reason
 * 'deal_party_reresolve' (canonical_id = correct row, merged_id = wrong row,
 * repointed_ids = {"deals.<side>_id": [deal id]}). Reversible from that row.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const runIdIdx = args.indexOf('--run-id');
const RUN_ID = runIdIdx >= 0 ? args[runIdIdx + 1] : null;
const LIMIT_IDX = args.indexOf('--limit');
const LIMIT = LIMIT_IDX >= 0 ? Number(args[LIMIT_IDX + 1]) : null;

const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

interface DealRow { id: string; licensor_id: string | null; licensor_name: string | null; licensee_id: string | null; licensee_name: string | null }
interface CompanyRow { id: string; name: string; merged_into: string | null }

async function main() {
  if (APPLY && (!RUN_ID || process.env.MERGE_APPLY !== 'yes')) {
    throw new Error('--apply requires --run-id <id> and MERGE_APPLY=yes');
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // 1. Canonical companies by normalised name (only unambiguous names).
  const byName = new Map<string, CompanyRow[]>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('companies').select('id,name,merged_into').order('id').range(from, from + 999);
    if (error) throw new Error(`companies page ${from}: ${error.message}`);
    for (const r of (data ?? []) as CompanyRow[]) {
      if (r.merged_into) continue;
      const k = norm(r.name);
      byName.set(k, [...(byName.get(k) ?? []), r]);
    }
    if (!data || data.length < 1000) break;
  }
  const canonicalFor = (name: string): CompanyRow | null => {
    const rows = byName.get(norm(name));
    return rows && rows.length === 1 ? rows[0] : null;
  };

  // 2. Deals whose party id points at a row whose name differs from the party string.
  const deals: DealRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('deals')
      .select('id,licensor_id,licensor_name,licensee_id,licensee_name')
      .eq('is_synthetic', false)
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`deals page ${from}: ${error.message}`);
    deals.push(...((data ?? []) as DealRow[]));
    if (!data || data.length < 1000) break;
  }
  const idToName = new Map<string, string>();
  for (const rows of byName.values()) for (const r of rows) idToName.set(r.id, r.name);
  // Merged rows too, so we can name the wrong row in the plan.
  const { data: mergedRows } = await supabase.from('companies').select('id,name').not('merged_into', 'is', null).limit(5000);
  for (const r of (mergedRows ?? []) as Array<{ id: string; name: string }>) idToName.set(r.id, r.name);

  const plan: Array<{ dealId: string; side: 'licensor' | 'licensee'; party: string; wrongId: string; wrongName: string; rightId: string; rightName: string }> = [];
  const skipped: Array<{ dealId: string; side: string; party: string; currentName: string }> = [];
  /** [party, substring of the current row] pairs that are different companies sharing a short name. */
  const AMBIGUOUS: Array<[string, string]> = [
    ['merck', 'kgaa'], ['merck', 'emd'], ['merck', 'serono'], ['merck', 'dupont'],
    ['abbott', 'abbvie'], ['pfizer', 'arena'], ['gsk', 'haleon'], ['novartis', 'sandoz'], ['j and j', 'kenvue'],
  ];
  for (const d of deals) {
    for (const side of ['licensor', 'licensee'] as const) {
      const party = d[`${side}_name`];
      const currentId = d[`${side}_id`];
      if (!party || !currentId) continue;
      const right = canonicalFor(party);
      if (!right || right.id === currentId) continue;
      const currentName = idToName.get(currentId) ?? '';
      if (norm(currentName) === norm(party)) continue; // already on a same-named row (duplicate handled by the merge job)
      // Only move when the wrong row is visibly a subsidiary / division / legal-form
      // variant of the party (its name contains the party string). A row that
      // merely carried the party as an alias but is a different company stays.
      if (!norm(currentName).includes(norm(party))) { skipped.push({ dealId: d.id, side, party, currentName }); continue; }
      // Same short name, different company: never move these automatically.
      if (AMBIGUOUS.some(([a, b]) => norm(party) === a && norm(currentName).includes(b))) { skipped.push({ dealId: d.id, side, party, currentName }); continue; }
      plan.push({ dealId: d.id, side, party, wrongId: currentId, wrongName: currentName, rightId: right.id, rightName: right.name });
    }
  }
  const selected = LIMIT != null ? plan.slice(0, LIMIT) : plan;

  console.log(`deals scanned ${deals.length}; party sides to re-resolve ${plan.length}${LIMIT != null ? ` (applying ${selected.length})` : ''}; left for human review ${skipped.length}`);
  const bySkip = new Map<string, number>();
  for (const k of skipped) bySkip.set(`${k.party} ← ${k.currentName}`, (bySkip.get(`${k.party} ← ${k.currentName}`) ?? 0) + 1);
  console.log('review (not moved):', [...bySkip.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, c]) => `${n} (${c})`).join('; '));
  const byWrong = new Map<string, number>();
  for (const p of plan) byWrong.set(p.wrongName, (byWrong.get(p.wrongName) ?? 0) + 1);
  console.log('top wrong rows:', [...byWrong.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n, c]) => `${n} (${c})`).join('; '));
  for (const p of selected.slice(0, 15)) console.log(`  ${p.dealId} ${p.side} "${p.party}": ${p.wrongName} → ${p.rightName}`);
  if (selected.length > 15) console.log(`  … ${selected.length - 15} more`);

  if (!APPLY) { console.log('dry run — nothing written'); return; }

  let done = 0, failed = 0;
  for (const p of selected) {
    const { error: upErr } = await supabase.from('deals').update({ [`${p.side}_id`]: p.rightId }).eq('id', p.dealId).eq(`${p.side}_id`, p.wrongId);
    if (upErr) { failed++; console.error(`deal ${p.dealId} ${p.side}: ${upErr.message}`); continue; }
    const { error: auditErr } = await supabase.from('company_merges').insert({
      canonical_id: p.rightId, merged_id: p.wrongId, merged_name: p.wrongName, reason: 'deal_party_reresolve',
      repointed: { [`deals.${p.side}_id`]: 1 }, repointed_ids: { [`deals.${p.side}_id`]: [p.dealId] },
      run_id: RUN_ID, dry_run: false,
    });
    if (auditErr) console.error(`audit for deal ${p.dealId}: ${auditErr.message}`);
    done++;
  }
  console.log(`Done: ${done} deal sides re-resolved, ${failed} failed. Audit: company_merges WHERE run_id = '${RUN_ID}' AND reason = 'deal_party_reresolve'.`);
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
