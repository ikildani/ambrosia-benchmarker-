/**
 * Option B Foundation — Deal Backtest CLI
 *
 * Runs the rNPV engine against every real disclosed deal in
 * `data/comparable-deals-extended.ts`, compares predicted vs actual upfront
 * + total deal value, writes the full report to
 * `__tests__/backtest/baseline-errors.json`, and prints a summary table.
 *
 * Usage:
 *   npx tsx scripts/run-deal-backtest.ts
 *
 * Env vars toggle flag-gated features to measure their impact on accuracy:
 *   TIER2_TIME_WINDOWED_POS=on npx tsx scripts/run-deal-backtest.ts
 *   TIER4_MACRO=on TIER4_SUBPOP=on npx tsx scripts/run-deal-backtest.ts
 *
 * The resulting JSON file is version-controlled as the current baseline.
 * Stage 7 iterates: change calibration → re-run → diff baseline-errors.json
 * → commit when hit rate improves.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { runDealBacktest } from '../lib/financial/backtest/deal-backtest';

const OUT_PATH = join(__dirname, '..', '__tests__', 'backtest', 'baseline-errors.json');

function formatPct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function printSummary(label: string, summary: import('../lib/financial/backtest/deal-backtest').DealBacktestSummary, showHeatmap: boolean): void {
  console.log(`─── ${label} ───`);
  console.log(`Total deals scored:        ${summary.totalDeals}`);
  console.log(`Hit rate ±25% (target 60): ${formatPct(summary.hitRate25)}`);
  console.log(`Hit rate ±35% (target 70): ${formatPct(summary.hitRate35)}`);
  console.log(`Hit rate ±50% (target 80): ${formatPct(summary.hitRate50)}`);
  console.log(`Mean |error|:              ${formatPct(summary.meanAbsErrorPct)}`);
  console.log(`Median signed error:       ${formatPct(summary.medianSignedErrorPct)}`);
  console.log(`RMSE on upfront ($M):      ${summary.rmseUpfront_M}`);
  if (!showHeatmap) return;
  console.log('');
  console.log('  By Therapeutic Area:');
  for (const [ta, s] of Object.entries(summary.byTherapeuticArea).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`    ${ta.padEnd(20)} n=${String(s.n).padStart(3)}  hit25=${formatPct(s.hitRate25).padStart(6)}  hit35=${formatPct(s.hitRate35).padStart(6)}  meanSigned=${formatPct(s.meanSignedErrorPct).padStart(7)}`);
  }
  console.log('  By Phase:');
  for (const [ph, s] of Object.entries(summary.byPhase).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`    ${ph.padEnd(20)} n=${String(s.n).padStart(3)}  hit25=${formatPct(s.hitRate25).padStart(6)}  hit35=${formatPct(s.hitRate35).padStart(6)}  meanSigned=${formatPct(s.meanSignedErrorPct).padStart(7)}`);
  }
  console.log('  By Modality (top 10):');
  const modEntries = Object.entries(summary.byModality).sort((a, b) => b[1].n - a[1].n).slice(0, 10);
  for (const [m, s] of modEntries) {
    console.log(`    ${m.padEnd(20)} n=${String(s.n).padStart(3)}  hit25=${formatPct(s.hitRate25).padStart(6)}  hit35=${formatPct(s.hitRate35).padStart(6)}  meanSigned=${formatPct(s.meanSignedErrorPct).padStart(7)}`);
  }
}

function main(): void {
  const report = runDealBacktest();
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Deal Backtest — Option B Calibration');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Run at: ${report.runAt}`);
  console.log(`Flags: ${Object.entries(report.featureFlags).filter(([, v]) => v).map(([k]) => k).join(', ') || '(all off)'}`);
  console.log('');

  printSummary('CORE SCOPE: Phase 2/3 licensing + codev (the rNPV sweet spot)', report.coreScope, true);
  console.log('');
  printSummary('FULL SCOPE: All 251 disclosed deals (incl. structurally ill-fit)', report.fullScope, false);
  console.log('');

  // Round 13: held-out train/test validation
  console.log('─── HELD-OUT VALIDATION (80/20 core-scope split) ───');
  printSummary('TRAIN (80%)', report.holdout.coreTrain, false);
  console.log('');
  printSummary('TEST (20%, held out)', report.holdout.coreTest, false);
  console.log('');
  const gap = report.holdout.overfittingGap;
  console.log('Overfitting gap (train - test, positive = overfit):');
  console.log(`  ±25%: ${formatPct(gap.hit25)}`);
  console.log(`  ±35%: ${formatPct(gap.hit35)}`);
  console.log(`  ±50%: ${formatPct(gap.hit50)}`);
  console.log(`  Test mean |err| - Train mean |err|: ${formatPct(gap.meanAbsErrorPct)}`);
  console.log('');

  console.log('─── 10 Worst Core-Scope Deals (|upfront error|) ───');
  for (const r of report.worstDealsCore) {
    const c = r.case;
    console.log(
      `  ${c.year} ${c.licensor.padEnd(25)} → ${c.licensee.padEnd(18)} ` +
      `${c.therapeuticArea.padEnd(14)} ${c.phase.padEnd(10)} ${c.modality.padEnd(14)} ` +
      `actual=$${String(c.actualUpfront_M).padStart(4)}M predicted=$${String(r.predictedUpfront_M).padStart(5)}M err=${formatPct(r.upfrontErrorPct)}`
    );
  }
  console.log('');
  console.log(`Report written to: ${OUT_PATH}`);
}

main();
