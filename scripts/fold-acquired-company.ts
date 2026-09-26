/**
 * Fold one company that no longer exists as an independent buyer (acquired,
 * renamed) into its acquirer, through the same audited path the entity-graph
 * merge job uses: references re-pointed, name_variations unioned,
 * merged_into / merged_at set on the folded row, a company_merges audit row
 * with reason 'acquired'. Never deletes.
 *
 *   npx tsx scripts/fold-acquired-company.ts --from <id|name> --into <id|name>                      # dry run
 *   MERGE_APPLY=yes npx tsx scripts/fold-acquired-company.ts --from AveXis --into Novartis --apply --run-id fold-avexis-2026-09-26
 *
 * A name must match exactly one un-merged company row (case-insensitive); pass
 * the id when it does not.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { COMPANY_COLS } from '../lib/entities/resolve';
import type { MergeCompanyRow, MergePlan } from '../lib/entities/merge';
import { countCompanyReferences } from '../lib/entities/reference-counts';
import { applyMergePlan, assertApplyGuards, assertMigrationPresent } from '../lib/entities/merge-apply';

interface Args { from: string | null; into: string | null; apply: boolean; runId: string | null }
function parseArgs(argv: string[]): Args {
  const a: Args = { from: null, into: null, apply: false, runId: null };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--from') a.from = argv[++i] ?? null;
    else if (t === '--into') a.into = argv[++i] ?? null;
    else if (t === '--apply') a.apply = true;
    else if (t === '--run-id') a.runId = argv[++i] ?? null;
  }
  return a;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findCompany(sb: ReturnType<typeof createClient>, ref: string): Promise<MergeCompanyRow> {
  const cols = `${COMPANY_COLS},merged_into,created_at`;
  if (UUID.test(ref)) {
    const { data, error } = await sb.from('companies').select(cols).eq('id', ref).maybeSingle();
    if (error || !data) throw new Error(`company ${ref} not found${error ? `: ${error.message}` : ''}`);
    return data as unknown as MergeCompanyRow;
  }
  const { data, error } = await sb.from('companies').select(cols).ilike('name', ref).is('merged_into', null).limit(5);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as MergeCompanyRow[];
  if (rows.length !== 1) throw new Error(`"${ref}" matches ${rows.length} un-merged companies${rows.length ? `: ${rows.map(r => `${r.name} (${r.id})`).join(', ')}` : ''}; pass the id`);
  return rows[0];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.from || !args.into) throw new Error('--from and --into are required');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const sb = createClient(url, key);

  const from = await findCompany(sb, args.from);
  const into = await findCompany(sb, args.into);
  if (from.id === into.id) throw new Error('--from and --into are the same company');
  if (from.merged_into) throw new Error(`${from.name} is already merged into ${from.merged_into}`);
  if (into.merged_into) throw new Error(`${into.name} is itself merged into ${into.merged_into}; fold into that canonical instead`);

  const refs = await countCompanyReferences(sb, [from.id]);
  const referenceCount = refs.perRow.get(from.id) ?? 0;
  const aliasUnion = Array.from(new Set([...(into.name_variations ?? []), from.name, ...(from.name_variations ?? [])].map(s => s.trim()).filter(Boolean)));

  const plan: MergePlan = {
    key: `acquired:${from.id}`,
    canonicalId: into.id,
    canonicalName: into.name,
    canonicalScore: 0,
    canonicalReferenceCount: refs.perRow.get(into.id) ?? 0,
    merged: [{ id: from.id, name: from.name, populationScore: 0, referenceCount, reasons: ['acquired'] }],
    aliasUnion,
    aliasStrips: [],
    reason: 'acquired',
    referenceCount,
  };

  console.log(`Fold ${from.name} (${from.id}) → ${into.name} (${into.id}); ${referenceCount} references to re-point; aliases on canonical after: ${aliasUnion.length}`);
  if (!args.apply) { console.log('dry run — nothing written'); return; }

  assertApplyGuards({ apply: args.apply, runId: args.runId, env: process.env as Record<string, string | undefined> });
  await assertMigrationPresent(sb);
  const result = await applyMergePlan(sb, plan, args.runId!, { info: (m: string) => console.log(m), warn: (m: string) => console.warn(m) });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
