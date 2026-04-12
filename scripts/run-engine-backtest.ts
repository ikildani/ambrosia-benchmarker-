#!/usr/bin/env tsx
/**
 * CLI wrapper for the engine back-test.
 *
 * Usage:
 *   npx tsx scripts/run-engine-backtest.ts              # JSON output
 *   npx tsx scripts/run-engine-backtest.ts --markdown   # Markdown report
 *   npx tsx scripts/run-engine-backtest.ts --ta=oncology # Filter by TA
 */

import { runFullBackTest, formatReportMarkdown } from '@/lib/financial/backtest/runner';

const args = process.argv.slice(2);
const asMarkdown = args.includes('--markdown');
const taArg = args.find((a) => a.startsWith('--ta='));
const filterTA = taArg ? taArg.split('=')[1] : undefined;

const report = runFullBackTest({ filterTA, engineVersion: 'competitive-dynamics-v13' });

if (asMarkdown) {
  console.log(formatReportMarkdown(report));
} else {
  // Compact summary for terminal
  console.log('─'.repeat(80));
  console.log(`COMPETITIVE DYNAMICS ENGINE — BACK-TEST VALIDATION`);
  console.log('─'.repeat(80));
  console.log(`Engine version: ${report.engineVersion}`);
  console.log(`Assets tested: ${report.assetCount}`);
  console.log(`Generated: ${report.generatedAt}`);
  console.log(``);
  console.log(`DEFENSIBLE METRICS (excluding ${report.edgeCaseCount} known edge cases):`);
  console.log(`  n:          ${report.defensiblePeakErosionMetrics.n}`);
  console.log(`  MAPE:       ${(report.defensiblePeakErosionMetrics.mape * 100).toFixed(1)}%`);
  console.log(`  MAE:        ${report.defensiblePeakErosionMetrics.mae.toFixed(3)}`);
  console.log(`  RMSE:       ${report.defensiblePeakErosionMetrics.rmse.toFixed(3)}`);
  console.log(`  R²:         ${report.defensiblePeakErosionMetrics.rSquared.toFixed(3)}`);
  console.log(`  Pearson R:  ${report.defensiblePeakErosionMetrics.pearsonR.toFixed(3)}`);
  console.log(``);
  console.log(`FULL DATASET METRICS (including edge cases):`);
  console.log(`  MAPE:       ${(report.peakErosionMetrics.mape * 100).toFixed(1)}%`);
  console.log(`  Pearson R:  ${report.peakErosionMetrics.pearsonR.toFixed(3)}`);
  console.log(``);
  console.log(`CALIBRATION (target 80%):`);
  console.log(`  P10/P90 accuracy:     ${(report.calibrationAccuracyPeakErosion * 100).toFixed(1)}%`);
  console.log(`  Competitor timing:    ${(report.timingAccuracyCompetitorYear * 100).toFixed(1)}% within ±1 year`);
  console.log(``);
  console.log(`PER-ASSET RESULTS:`);
  console.log(`  ${'Asset'.padEnd(25)} ${'TA'.padEnd(18)} ${'Actual'.padEnd(8)} ${'Pred'.padEnd(8)} ${'Error'.padEnd(8)} ${'In-Band'}`);
  console.log(`  ${'-'.repeat(25)} ${'-'.repeat(18)} ${'-'.repeat(8)} ${'-'.repeat(8)} ${'-'.repeat(8)} ${'-'.repeat(7)}`);
  for (const r of report.assetResults) {
    const actual = (r.asset.actualOutcomes.estimatedPeakErosion * 100).toFixed(1) + '%';
    const pred = (r.predicted.peakShareErosion * 100).toFixed(1) + '%';
    const errPct = (r.errors.peakErosionAbsolute * 100).toFixed(1) + 'pp';
    const inBand = r.inCalibrationBand ? '✓' : '✗';
    console.log(
      `  ${r.asset.name.padEnd(25)} ${r.asset.asOfInputs.therapeuticArea.padEnd(18)} ${actual.padEnd(8)} ${pred.padEnd(8)} ${errPct.padEnd(8)} ${inBand}`,
    );
  }
  console.log(``);
  console.log(`BY THERAPEUTIC AREA:`);
  for (const [ta, m] of Object.entries(report.byTherapeuticArea)) {
    console.log(`  ${ta.padEnd(20)} n=${m.assetCount}  MAPE=${(m.mape * 100).toFixed(1)}%  r=${m.pearsonR.toFixed(3)}`);
  }
  console.log(``);
  console.log(`OVERALL CONFIDENCE: ${report.overallConfidence.toUpperCase()}`);
  console.log(``);
  console.log(`EDGE CASES EXCLUDED (${report.edgeCaseCount}):`);
  for (const ec of report.edgeCases) {
    console.log(`  • ${ec.assetName}: ${ec.reason}`);
  }
  console.log(``);
  console.log(`DEFENSIBLE CLAIMS:`);
  console.log(`  "Validated against ${report.assetCount} historical biopharma assets"`);
  console.log(`  "Peak erosion MAPE: ${(report.defensiblePeakErosionMetrics.mape * 100).toFixed(1)}% (n=${report.defensiblePeakErosionMetrics.n}, excludes known edge cases)"`);
  console.log(`  "Pearson correlation: ${report.defensiblePeakErosionMetrics.pearsonR.toFixed(2)}"`);
  console.log(`  "Best-performing TAs: ${Object.entries(report.byTherapeuticArea).filter(([,m]) => m.mape < 0.30).map(([ta,m]) => `${ta} (${(m.mape*100).toFixed(1)}% MAPE)`).join(', ')}"`);
  console.log('─'.repeat(80));
}
