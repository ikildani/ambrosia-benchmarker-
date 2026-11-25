/**
 * Deal-terms backtest: price real licenses with the calculator and compare to the upfront paid.
 *
 *   npx tsx scripts/terms-backtest.ts [--fixture data/backtest/terms-backtest-fixture.json]
 *                                     [--summary-out file.json] [--out rows.json]
 *                                     [--check data/backtest/terms-backtest-baseline.json]
 *                                     [--write-baseline [data/backtest/terms-backtest-baseline.json]]
 *
 * Inputs: primary-sourced `deals_verified` licenses / collaborations / options with a disclosed upfront
 * (2023-01 to 2026-09) and the active `benchmark_calibrations` overlay. With --fixture both come from the committed
 * snapshot (scripts/terms-backtest-snapshot.ts) and nothing touches the network; without it they are read live
 * (service-role key, read-only).
 *
 * Each deal is priced with neutral inputs (its phase, area, modality, territory and deal type; every other factor
 * at its default). Territories: global, Greater China, Japan, Europe, US, US + Europe, ex-US and South Korea where
 * the deal's territory text maps cleanly (lib/backtest/terms-backtest-core.ts mapTerritory); carve-outs are skipped.
 * Neutral inputs mean absolute ratios carry the default-indication bias; compare runs, not levels.
 *
 * --check exits 1 when overall within-2x falls by more than 1 point or MdAE(log) rises by more than 0.02 against
 * the baseline (the CI accuracy gate). --write-baseline writes the summary as the new baseline: do that only on
 * purpose, commit it in the same PR, and explain the change in the PR body.
 */
import { readFileSync, writeFileSync } from 'fs';
import {
  checkAgainstBaseline, runFixture,
  type BacktestFixture, type BacktestSummary, type GroupStats,
} from '../lib/backtest/terms-backtest-core';

const DEFAULT_BASELINE = 'data/backtest/terms-backtest-baseline.json';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : '';
}

const r2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
function print(label: string, groups: Record<string, GroupStats>) {
  console.log(`\n${label}`);
  for (const [k, g] of Object.entries(groups)) {
    console.log(`  ${k.padEnd(20)} n=${String(g.n).padStart(3)}  median calc/actual x${r2(g.medianRatio)}  within 2x ${(g.within2x * 100).toFixed(0).padStart(3)}%  MdAE(log) ${r2(g.mdaeLog)}`);
  }
}

async function main() {
  const fixturePath = arg('--fixture');
  let fixture: BacktestFixture;
  if (fixturePath) {
    fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  } else {
    const { fetchBacktestFixture } = await import('../lib/backtest/terms-backtest-fetch');
    const { inWindow: _inWindow, ...live } = await fetchBacktestFixture();
    fixture = live;
  }
  const { rows, summary } = runFixture(fixture);
  console.log(`Fixture ${fixture.snapshotAt}: ${fixture.deals.length} deals, ${rows.length} priced, ${fixture.calibrations.length} calibration rows`);
  print('All', { all: summary.overall });
  print('By territory', summary.byTerritory);
  print('By phase', summary.byPhase);
  print('By TA', summary.byTA);
  print('By modality', summary.byModality);

  const out = arg('--out');
  if (out) writeFileSync(out, JSON.stringify(rows, null, 1));
  const summaryOut = arg('--summary-out');
  if (summaryOut) writeFileSync(summaryOut, JSON.stringify(summary, null, 2) + '\n');

  const wb = arg('--write-baseline');
  if (wb !== undefined) {
    const p = wb || DEFAULT_BASELINE;
    writeFileSync(p, JSON.stringify(summary, null, 2) + '\n');
    console.log(`\nWrote baseline ${p}`);
  }

  const check = arg('--check');
  if (check !== undefined) {
    const baseline: BacktestSummary = JSON.parse(readFileSync(check || DEFAULT_BASELINE, 'utf8'));
    const res = checkAgainstBaseline(summary, baseline);
    console.log(`\nAccuracy gate vs ${check || DEFAULT_BASELINE}: within 2x ${(baseline.overall.within2x * 100).toFixed(1)}% -> ${(summary.overall.within2x * 100).toFixed(1)}%, MdAE(log) ${baseline.overall.mdaeLog.toFixed(3)} -> ${summary.overall.mdaeLog.toFixed(3)}`);
    if (!res.ok) {
      for (const m of res.messages) console.error(`  FAIL: ${m}`);
      console.error('\nIf the change is intended, regenerate the baseline with --write-baseline, commit it in the same PR and explain why in the PR body.');
      process.exit(1);
    }
    console.log('  PASS');
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
