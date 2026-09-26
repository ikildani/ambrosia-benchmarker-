/**
 * Fold same-company rows that carry different names (lib/entities/same-company.ts).
 *
 *   npx tsx scripts/merge-same-company-rows.ts                       # dry run → tmp/same-company-report.md + tmp/same-company-plans.csv
 *   MERGE_APPLY=yes npx tsx scripts/merge-same-company-rows.ts --apply --run-id <id> [flags]
 *
 * Flags:
 *   --no-affiliates          do not fold national affiliates ("Pfizer Canada Inc") into the parent
 *   --exclude <file>         ids (one per line, '#' comments) never to plan
 *   --extra <file>           hand-checked groups: one line per group, ids comma-separated
 *   --only <key>             apply one plan (its key from the report, e.g. same:hansoh)
 *   --limit N                apply the first N plans (smallest reference count first)
 *   --skip-count             dry run without reference counting (faster; ranks by population only)
 *
 * Audit: company_merges rows with reason 'same_company_alias' (same shape as the
 * merge job; rollback per docs/entity-graph.md).
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { COMPANY_COLS } from '../lib/entities/resolve';
import type { MergeCompanyRow, MergePlan } from '../lib/entities/merge';
import { planSameCompanyMerges } from '../lib/entities/same-company';
import { countCompanyReferences } from '../lib/entities/reference-counts';
import { applyMergePlan, assertApplyGuards, assertMigrationPresent } from '../lib/entities/merge-apply';

interface Args { apply: boolean; runId: string | null; affiliates: boolean; exclude: string | null; extra: string | null; only: string | null; limit: number | null; skipCount: boolean }
function parseArgs(argv: string[]): Args {
  const a: Args = { apply: false, runId: null, affiliates: true, exclude: null, extra: null, only: null, limit: null, skipCount: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--apply') a.apply = true;
    else if (t === '--run-id') a.runId = argv[++i] ?? null;
    else if (t === '--no-affiliates') a.affiliates = false;
    else if (t === '--exclude') a.exclude = argv[++i] ?? null;
    else if (t === '--extra') a.extra = argv[++i] ?? null;
    else if (t === '--only') a.only = argv[++i] ?? null;
    else if (t === '--limit') a.limit = Number(argv[++i]);
    else if (t === '--skip-count') a.skipCount = true;
    else throw new Error(`unknown argument ${t}`);
  }
  return a;
}

const log = { info: (m: string) => console.log(m), warn: (m: string) => console.warn(m) };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function loadCompanies(supabase: ReturnType<typeof createClient>): Promise<MergeCompanyRow[]> {
  const rows: MergeCompanyRow[] = [];
  const PAGE = 250;
  for (let from = 0; ; from += PAGE) {
    let data: unknown[] | null = null;
    let error: { message: string } | null = null;
    for (let attempt = 1; attempt <= 6; attempt++) {
      const res = await supabase.from('companies').select(`${COMPANY_COLS},source_registry,created_at`).order('id').range(from, from + PAGE - 1);
      data = res.data; error = res.error;
      if (!error || attempt === 6) break;
      await sleep(1500 * attempt);
    }
    if (error) throw new Error(`companies page ${from}: ${error.message}`);
    rows.push(...((data ?? []) as MergeCompanyRow[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function readIdLines(path: string | null): string[] {
  if (!path) return [];
  return readFileSync(path, 'utf8').split('\n').map(l => l.split('#')[0].trim()).filter(Boolean);
}

function csvCell(v: unknown): string {
  return '"' + String(v ?? '').replace(/"/g, '""') + '"';
}

function report(plans: MergePlan[], review: ReturnType<typeof planSameCompanyMerges>['review'], stats: ReturnType<typeof planSameCompanyMerges>['stats'], counted: boolean): string {
  const lines: string[] = [];
  lines.push('# Same-company merge plan', '', `Generated ${new Date().toISOString()}. Read-only until \`--apply\`.`, '');
  lines.push('| | |', '|---|---:|', `| canonical rows scanned | ${stats.rows} |`, `| stems shared by ≥2 rows | ${stats.groups} |`, `| plans | ${stats.plannedGroups} |`, `| rows to fold | ${stats.rowsToMerge} |`, `| of which national affiliates | ${stats.affiliateRowsToMerge} |`, `| groups left for review | ${stats.reviewGroups} |`, `| references counted | ${counted ? 'yes' : 'no (--skip-count)'} |`, '');
  lines.push('## Plans', '', '| key | canonical (refs) | folded rows (refs) | refs to move |', '|---|---|---|---:|');
  for (const p of plans) {
    lines.push(`| ${p.key} | ${p.canonicalName} (${p.canonicalReferenceCount}) | ${p.merged.map(m => `${m.name} (${m.referenceCount})`).join('; ')} | ${p.referenceCount} |`);
  }
  lines.push('', '## Review (not planned)', '', '| stem | reason | detail | rows |', '|---|---|---|---|');
  for (const r of review) lines.push(`| ${r.stem} | ${r.reason} | ${r.detail.replace(/\|/g, '/')} | ${r.rows.map(x => x.name).join('; ')} |`);
  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  mkdirSync('tmp', { recursive: true });

  log.info('Loading companies…');
  const rows = await loadCompanies(supabase);
  log.info(`  ${rows.length} rows`);

  const excludeIds = new Set(readIdLines(args.exclude));
  const extraGroups = args.extra ? readFileSync(args.extra, 'utf8').split('\n').map(l => l.split('#')[0].split(',').map(s => s.trim()).filter(Boolean)).filter(g => g.length >= 2) : [];

  let result = planSameCompanyMerges(rows, { includeAffiliates: args.affiliates, excludeIds, extraGroups });
  log.info(`  ${result.stats.groups} shared stems → ${result.stats.plannedGroups} plans, ${result.stats.rowsToMerge} rows to fold, ${result.stats.reviewGroups} for review`);

  let counted = false;
  if (!args.skipCount) {
    const ids = [...new Set(result.plans.flatMap(p => [p.canonicalId, ...p.merged.map(m => m.id)]))];
    log.info(`Counting references for ${ids.length} rows…`);
    const counts = await countCompanyReferences(supabase, ids, { log: log.info });
    result = planSameCompanyMerges(rows, { includeAffiliates: args.affiliates, excludeIds, extraGroups, referenceCounts: counts.perRow });
    counted = true;
  }

  let plans = [...result.plans].sort((a, b) => a.referenceCount - b.referenceCount || a.key.localeCompare(b.key));
  writeFileSync('tmp/same-company-report.md', report(plans, result.review, result.stats, counted));
  const csv = ['key,canonical_id,canonical_name,merged_id,merged_name,merged_refs,affiliate'];
  for (const p of plans) for (const m of p.merged) csv.push([p.key, p.canonicalId, p.canonicalName, m.id, m.name, m.referenceCount, ''].map(csvCell).join(','));
  writeFileSync('tmp/same-company-plans.csv', csv.join('\n') + '\n');
  log.info('Report: tmp/same-company-report.md, tmp/same-company-plans.csv');

  if (!args.apply) { log.info('dry run — nothing written'); return; }
  assertApplyGuards({ apply: args.apply, runId: args.runId, env: process.env });
  await assertMigrationPresent(supabase);
  if (args.only) plans = plans.filter(p => p.key === args.only);
  if (args.limit != null) plans = plans.slice(0, args.limit);
  if (!plans.length) throw new Error('nothing to apply');

  log.info(`Applying ${plans.length} plans (run ${args.runId})…`);
  let folded = 0, repointed = 0, conflicts = 0;
  for (let i = 0; i < plans.length; i++) {
    const p = plans[i];
    log.info(`[${i + 1}/${plans.length}] ${p.key} → ${p.canonicalName} (${p.canonicalId})`);
    const r = await applyMergePlan(supabase, p, args.runId!, log);
    for (const m of r.merged) {
      if (m.skipped) continue;
      folded++;
      repointed += Object.values(m.repointed).reduce((s, n) => s + n, 0);
      conflicts += Object.values(m.conflicts).reduce((s, n) => s + n, 0);
    }
  }
  log.info(`Done: ${folded} rows folded, ${repointed} references re-pointed, ${conflicts} left on unique conflicts. Audit: company_merges WHERE run_id = '${args.runId}'.`);
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
