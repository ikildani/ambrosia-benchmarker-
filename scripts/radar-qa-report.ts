/**
 * Print the latest Asset Radar QA report as tables, or drive the harness
 * from a terminal (docs/asset-radar-qa.md).
 *
 *   npx tsx scripts/radar-qa-report.ts                       latest report (tables)
 *   npx tsx scripts/radar-qa-report.ts --md                  markdown instead of tables
 *   npx tsx scripts/radar-qa-report.ts --run <uuid>          a specific invariants run
 *   npx tsx scripts/radar-qa-report.ts --invariants [--dry]  run the invariant checks now
 *   npx tsx scripts/radar-qa-report.ts --select [--seed s] [--size 200]
 *   npx tsx scripts/radar-qa-report.ts --agreement [--dry] [--max-cost 15]
 *   npx tsx scripts/radar-qa-report.ts --sheet out.xlsx      export the human review sheet
 *   npx tsx scripts/radar-qa-report.ts --import file.xlsx --reviewer "Name"
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local;
 * --agreement also needs ANTHROPIC_API_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { runInvariants } from '@/lib/radar/qa/invariants';
import { exportHumanReviewSheet, importHumanReviews, parseHumanReviewSheet, runGoldenAgreement, selectGoldenSet } from '@/lib/radar/qa/golden-set';
import { buildQaReport, renderQaReportMarkdown, type QaReport } from '@/lib/radar/qa/report';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};

function table(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cells = rows.map(r => r.map(v => (v == null ? '-' : String(v))));
  const widths = headers.map((h, i) => Math.max(h.length, ...cells.map(r => (r[i] ?? '').length)));
  const line = (r: string[]) => r.map((c, i) => c.padEnd(widths[i])).join('  ');
  return [line(headers), line(widths.map(w => '-'.repeat(w))), ...cells.map(line)].join('\n');
}

function printReport(report: QaReport): void {
  const g = report.launch_gate;
  console.log(`Asset Radar QA — generated ${report.generated_at} — launch gate ${report.passed ? 'PASS' : 'FAIL'}`);
  console.log(table(['Gate', 'Status'], [
    ['No blockers', g.no_blockers == null ? 'n/a' : g.no_blockers ? 'yes' : 'NO'],
    ['Majors', g.majors_count ?? 'n/a'],
    ['Model agreement', g.agreement_ok == null ? 'n/a' : g.agreement_ok ? 'yes' : 'NO'],
    ['Human review', g.human_ok == null ? 'n/a' : g.human_ok ? 'yes' : 'NO'],
  ]));
  for (const n of g.notes) console.log(`  ! ${n}`);

  if (report.invariants) {
    const inv = report.invariants;
    console.log(`\nInvariants run ${inv.run_id} (${inv.run_at}) — ${inv.checks_passed}/${inv.checks_total} passed, universe ${inv.universe_size ?? '?'}`);
    const rows = [...inv.blockers, ...inv.majors, ...inv.minors].map(f => [f.severity, f.check_name, f.observed ?? '', f.count ?? '', f.failing_ids.slice(0, 3).join(',')]);
    console.log(rows.length ? table(['Severity', 'Check', 'Observed', 'Count', 'Sample ids'], rows) : '  all checks passed');
  }
  if (report.coverage.length) {
    console.log('\nCoverage');
    console.log(table(['Metric', 'n / N', 'Share', 'Threshold', 'OK'], report.coverage.map(c => [c.metric, `${c.numerator}/${c.denominator}`, `${c.share_pct.toFixed(1)}%`, c.threshold_pct == null ? '-' : `>= ${c.threshold_pct}%`, c.passed == null ? 'n/a' : c.passed ? 'yes' : 'NO'])));
  }
  if (report.agreement) {
    const a = report.agreement;
    console.log(`\nGolden agreement (${a.model ?? 'model'}, ${a.golden_size ?? '?'} assets, $${(a.estimated_cost_usd ?? 0).toFixed(2)}, ${a.run_at})`);
    console.log(table(['Field', 'Compared', 'Agreement', 'Kappa', 'Gate', 'OK'], a.rows.map(r => [r.field, r.compared, `${r.agreement_pct.toFixed(1)}%`, r.kappa == null ? '-' : r.kappa.toFixed(3), r.gate_pct == null ? '-' : `>= ${r.gate_pct}%`, r.passed == null ? 'n/a' : r.passed ? 'yes' : 'NO'])));
  }
  if (report.human) {
    console.log(`\nHuman review (${report.human.reviewer ?? 'reviewer'}, ${report.human.run_at})`);
    console.log(table(['Field', 'Reviewed', 'Agreement', 'Kappa', 'Gate', 'OK'], report.human.rows.map(r => [r.field, r.compared, `${r.agreement_pct.toFixed(1)}%`, r.kappa == null ? '-' : r.kappa.toFixed(3), r.gate_pct == null ? '-' : `>= ${r.gate_pct}%`, r.passed == null ? 'n/a' : r.passed ? 'yes' : 'NO'])));
  }
  if (report.cron_health) {
    const ch = report.cron_health;
    console.log('\nCron health (48 h)');
    console.log(ch.missing.length ? `  missing: ${ch.missing.map(m => `${m.source}${m.stage ? `/${m.stage}` : ''}${m.critical ? ' (critical)' : ''}`).join(', ')}` : '  all expected stages ran');
    if (ch.failures_7d.length) console.log(`  failures (7 d): ${ch.failures_7d.map(f => `${f.source}${f.stage ? `/${f.stage}` : ''}x${f.failed}`).join(', ')}`);
  }
}

async function main() {
  if (flag('invariants')) {
    const r = await runInvariants(supabase, { persist: !flag('dry') });
    console.log(`invariants: run ${r.run_id ?? '(dry)'} passed=${r.passed} blockers=${r.blockers} majors=${r.majors} minors=${r.minors} in ${r.duration_ms} ms`);
    for (const c of r.checks.filter(c => !c.passed)) console.log(`  [${c.severity}] ${c.check_name}: ${c.observed}`);
    for (const e of r.errors) console.log(`  error: ${e}`);
    return;
  }
  if (flag('select')) {
    const size = opt('size') ? Number(opt('size')) : undefined;
    const r = await selectGoldenSet(supabase, { seed: opt('seed'), size, replace: !flag('keep') });
    console.log(`golden set: seed ${r.seed}, selected ${r.selected}/${r.size}, shortfall ${r.shortfall}, removed ${r.removed}`);
    console.log(table(['Stratum', 'Quota', 'Filled'], Object.keys(r.quotas).sort().map(k => [k, r.quotas[k], r.filled[k] ?? 0])));
    for (const e of r.errors) console.log(`  error: ${e}`);
    return;
  }
  if (flag('agreement')) {
    if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY is not set'); process.exit(1); }
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ maxRetries: 0, timeout: 120_000 });
    const r = await runGoldenAgreement(supabase, client, { persist: !flag('dry'), maxCostUsd: opt('max-cost') ? Number(opt('max-cost')) : undefined });
    console.log(`agreement: run ${r.run_id ?? '(dry)'} model ${r.model} compared ${r.classified_compared} (partnership ${r.partnership_compared}) requests ${r.requests} $${r.estimated_cost_usd.toFixed(2)} in ${r.duration_ms} ms`);
    console.log(table(['Field', 'Compared', 'Agreement', 'Kappa'], [
      ...Object.entries(r.fields).map(([f, s]) => [f, s.compared, `${s.agreement_pct.toFixed(1)}%`, s.kappa == null ? '-' : s.kappa.toFixed(3)]),
      ['partnership_status', r.partnership.compared, `${r.partnership.agreement_pct.toFixed(1)}%`, r.partnership.kappa == null ? '-' : r.partnership.kappa.toFixed(3)],
    ]));
    for (const e of r.errors) console.log(`  error: ${e}`);
    return;
  }
  if (flag('sheet')) {
    const out = opt('sheet') ?? 'radar-golden-review.xlsx';
    const { buffer, rows, assets } = await exportHumanReviewSheet(supabase);
    writeFileSync(out, buffer);
    console.log(`wrote ${out}: ${rows} rows over ${assets} assets`);
    return;
  }
  if (flag('import')) {
    const file = opt('import');
    const reviewer = opt('reviewer');
    if (!file || !reviewer) { console.error('--import <file.xlsx> --reviewer <name> are both required'); process.exit(1); }
    const rows = await parseHumanReviewSheet(readFileSync(file));
    const r = await importHumanReviews(supabase, rows, reviewer);
    console.log(`imported ${r.imported} reviewed rows for ${reviewer}; run ${r.run_id ?? '(none)'}`);
    console.log(table(['Field', 'Reviewed', 'Agreement', 'Kappa'], Object.entries(r.fields).map(([f, s]) => [f, s.compared, `${s.agreement_pct.toFixed(1)}%`, s.kappa == null ? '-' : s.kappa.toFixed(3)])));
    for (const e of r.errors) console.log(`  error: ${e}`);
    return;
  }

  const report = await buildQaReport(supabase, opt('run'));
  if (flag('md')) console.log(renderQaReportMarkdown(report));
  else printReport(report);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
