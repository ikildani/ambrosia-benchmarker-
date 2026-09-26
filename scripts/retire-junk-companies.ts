/**
 * Retire junk rows in `companies` (lib/entities/junk-companies.ts).
 *
 *   funding sentences ("Peginterferon supplied free of charge from Roche …",
 *   "Record provided by the NHSTCT Register …"): deleted when nothing
 *   references them, or when every reference can be detached — company_trials
 *   rows keep their data with company_id set NULL, and columns with an
 *   ON DELETE SET NULL foreign key are nulled by the database. Rows referenced
 *   from a cascade table (drug_owners, company_financials …) are reported and
 *   left alone.
 *
 *   people tagged industry ("Amit Malhotra, MD" with owner_type = 'industry'
 *   or a company_type or actively_acquiring): reclassified to owner_type
 *   'other', company_type NULL, actively_acquiring false. Nothing deleted.
 *
 * Every deleted, detached or reclassified row is snapshotted into
 * company_cleanup_log first (migration 133).
 *
 *   npx tsx scripts/retire-junk-companies.ts                          # dry run → tmp/junk-companies-report.md
 *   MERGE_APPLY=yes npx tsx scripts/retire-junk-companies.ts --apply --run-id <id> [--skip-persons] [--skip-delete]
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'fs';
import { COMPANY_REFERENCING_COLUMNS, columnKey } from '../lib/entities/merge';
import { classifyJunk } from '../lib/entities/junk-companies';
import { countCompanyReferences } from '../lib/entities/reference-counts';
import { assertApplyGuards } from '../lib/entities/merge-apply';

type Client = ReturnType<typeof createClient>;
type Row = Record<string, unknown>;

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const RUN_ID = args.includes('--run-id') ? args[args.indexOf('--run-id') + 1] : null;
const SKIP_PERSONS = args.includes('--skip-persons');
const SKIP_DELETE = args.includes('--skip-delete');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface CompanyLite { id: string; name: string; owner_type: string | null; company_type: string | null; actively_acquiring: boolean | null }

async function loadCompanies(supabase: Client): Promise<CompanyLite[]> {
  const rows: CompanyLite[] = [];
  for (let from = 0; ; from += 1000) {
    let data: unknown[] | null = null, error: { message: string } | null = null;
    for (let attempt = 1; attempt <= 6; attempt++) {
      const res = await supabase.from('companies').select('id,name,owner_type,company_type,actively_acquiring').is('merged_into', null).order('id').range(from, from + 999);
      data = res.data; error = res.error;
      if (!error || attempt === 6) break;
      await sleep(1500 * attempt);
    }
    if (error) throw new Error(`companies page ${from}: ${error.message}`);
    rows.push(...((data ?? []) as CompanyLite[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/** Columns whose rows survive a company delete without data loss. */
const DETACHABLE = new Set(
  COMPANY_REFERENCING_COLUMNS.filter(c => c.kind === 'uuid' && ((c.fk && c.onDelete === 'set_null') || columnKey(c) === 'company_trials.company_id')).map(columnKey),
);

async function main() {
  if (APPLY) assertApplyGuards({ apply: APPLY, runId: RUN_ID, env: process.env });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  if (APPLY) {
    const { error } = await supabase.from('company_cleanup_log').select('id').limit(0);
    if (error) throw new Error(`apply refused: migration 133 not applied (company_cleanup_log: ${error.message})`);
  }
  mkdirSync('tmp', { recursive: true });

  const companies = await loadCompanies(supabase);
  const sentences = companies.filter(c => classifyJunk(c.name) === 'funding_sentence');
  const persons = companies.filter(c => classifyJunk(c.name) === 'person' && (c.owner_type === 'industry' || c.company_type != null || c.actively_acquiring === true));
  console.log(`${companies.length} canonical rows: ${sentences.length} funding sentences, ${persons.length} people tagged industry${APPLY ? ` — APPLYING (run ${RUN_ID})` : ' — dry run'}`);

  console.log(`Counting references for ${sentences.length} sentence rows…`);
  const counts = await countCompanyReferences(supabase, sentences.map(s => s.id), { log: m => console.log(m) });

  const report: string[] = ['# Junk company rows', '', `Generated ${new Date().toISOString()}. ${APPLY ? `Applied as run ${RUN_ID}.` : 'Dry run.'}`, ''];
  const deletable: Array<{ row: CompanyLite; refs: Map<string, number> }> = [];
  const kept: Array<{ row: CompanyLite; refs: Map<string, number> }> = [];
  for (const s of sentences) {
    const refs = counts.perRowColumn.get(s.id) ?? new Map<string, number>();
    const blocking = [...refs.keys()].filter(k => !DETACHABLE.has(k));
    (blocking.length ? kept : deletable).push({ row: s, refs });
  }

  report.push('## Funding sentences', '', `${sentences.length} rows read as a funding / supply sentence. ${deletable.length} can be deleted (no references, or only detachable ones); ${kept.length} are referenced from a cascade table and stay.`, '');
  report.push('| action | name | owner_type | references |', '|---|---|---|---|');
  for (const { row, refs } of deletable) report.push(`| delete | ${row.name.replace(/\|/g, '/')} | ${row.owner_type ?? '-'} | ${[...refs.entries()].map(([k, n]) => `${k} ${n}`).join(', ') || 'none'} |`);
  for (const { row, refs } of kept) report.push(`| keep | ${row.name.replace(/\|/g, '/')} | ${row.owner_type ?? '-'} | ${[...refs.entries()].map(([k, n]) => `${k} ${n}`).join(', ')} |`);
  report.push('', '## People tagged industry', '', `${persons.length} rows: owner_type → other, company_type → NULL, actively_acquiring → false.`, '', '| name | owner_type | company_type | actively_acquiring |', '|---|---|---|---|');
  for (const p of persons) report.push(`| ${p.name.replace(/\|/g, '/')} | ${p.owner_type ?? '-'} | ${p.company_type ?? '-'} | ${p.actively_acquiring ?? '-'} |`);
  writeFileSync('tmp/junk-companies-report.md', report.join('\n') + '\n');
  console.log(`  ${deletable.length} deletable, ${kept.length} kept (cascade references), ${persons.length} to reclassify. Report: tmp/junk-companies-report.md`);

  if (!APPLY) { console.log('dry run — nothing written'); return; }

  let deleted = 0, detached = 0, reclassified = 0, failed = 0;
  if (!SKIP_DELETE) {
    for (const { row, refs } of deletable) {
      const { data: full } = await supabase.from('companies').select('*').eq('id', row.id).maybeSingle();
      if (!full) continue;
      // Detach trials explicitly (nullable column; the FK would cascade-delete them).
      const trials = refs.get('company_trials.company_id') ?? 0;
      if (trials) {
        const { data: trialRows } = await supabase.from('company_trials').select('id,nct_id').eq('company_id', row.id);
        for (const tr of (trialRows ?? []) as Array<{ id: string; nct_id: string }>) {
          const { error } = await supabase.from('company_trials').update({ company_id: null }).eq('id', tr.id);
          if (error && /duplicate key|unique/i.test(error.message)) {
            // An orphan row for this trial already exists: this one is a duplicate.
            const { data: snap } = await supabase.from('company_trials').select('*').eq('id', tr.id).maybeSingle();
            await supabase.from('company_cleanup_log').insert({ run_id: RUN_ID, action: 'deleted_duplicate', table_name: 'company_trials', row_id: tr.id, company_id: row.id, row: snap ?? {}, changes: {} });
            await supabase.from('company_trials').delete().eq('id', tr.id);
          } else if (error) { failed++; console.error(`  detach trial ${tr.id}: ${error.message}`); continue; }
          else await supabase.from('company_cleanup_log').insert({ run_id: RUN_ID, action: 'detached', table_name: 'company_trials', row_id: tr.id, company_id: row.id, row: { nct_id: tr.nct_id }, changes: { company_id: null } });
          detached++;
        }
      }
      // Other detachable references are nulled by ON DELETE SET NULL; record which rows.
      for (const [k, n] of refs) {
        if (k === 'company_trials.company_id' || !n) continue;
        const col = COMPANY_REFERENCING_COLUMNS.find(c => columnKey(c) === k)!;
        const { data: refRows } = await supabase.from(col.table).select(col.pk.join(',')).eq(col.column, row.id).limit(1000);
        for (const rr of (refRows ?? []) as Row[]) {
          await supabase.from('company_cleanup_log').insert({ run_id: RUN_ID, action: 'detached', table_name: col.table, row_id: col.pk.map(p => String(rr[p])).join('|'), company_id: row.id, row: rr, changes: { [col.column]: null } });
          detached++;
        }
      }
      const { error: logErr } = await supabase.from('company_cleanup_log').insert({ run_id: RUN_ID, action: 'deleted_company', table_name: 'companies', row_id: row.id, company_id: row.id, row: full, changes: {} });
      if (logErr) { failed++; console.error(`  log ${row.id}: ${logErr.message}`); continue; }
      const { error: delErr } = await supabase.from('companies').delete().eq('id', row.id);
      if (delErr) { failed++; console.error(`  delete ${row.id} (${row.name}): ${delErr.message}`); continue; }
      deleted++;
    }
  }
  if (!SKIP_PERSONS) {
    for (const p of persons) {
      const changes = { owner_type: 'other', company_type: null, actively_acquiring: false };
      const { error: logErr } = await supabase.from('company_cleanup_log').insert({ run_id: RUN_ID, action: 'reclassified', table_name: 'companies', row_id: p.id, company_id: p.id, row: p, changes });
      if (logErr) { failed++; console.error(`  log ${p.id}: ${logErr.message}`); continue; }
      const { error } = await supabase.from('companies').update(changes).eq('id', p.id);
      if (error) { failed++; console.error(`  reclassify ${p.id} (${p.name}): ${error.message}`); continue; }
      reclassified++;
    }
  }
  console.log(`Done: ${deleted} junk rows deleted, ${detached} references detached, ${reclassified} people reclassified, ${failed} failed. Before-images: company_cleanup_log WHERE run_id = '${RUN_ID}'.`);
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
