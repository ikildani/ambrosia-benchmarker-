/**
 * Back-Test Runner
 *
 * Runs the competitive dynamics and rNPV engines against historical assets
 * with as-of-launch inputs and compares predictions to observed outcomes.
 *
 * Produces validation metrics (MAPE, R², calibration accuracy, timing accuracy)
 * that can be cited in customer-facing claims.
 *
 * @module lib/financial/backtest/runner
 */

import { calculateRNPV } from '../rnpv-engine';
import { calculateCompetitiveDynamics } from '../advanced-upgrades';
import { HISTORICAL_ASSETS, type HistoricalAsset } from './historical-assets';
import {
  computeMetricsBundle,
  calibrationAccuracy,
  timingAccuracy,
  type MetricsBundle,
} from './metrics';
import type { RNPVInput } from '../types';

/**
 * Result of running the engine against a single historical asset.
 */
export interface BackTestAssetResult {
  asset: HistoricalAsset;
  predicted: {
    peakShareErosion: number;
    competitorCount: number;
    firstCompetitorYear: number;
    peakErosionYear: number;
    revenueImpact: number;
    revenueImpactP10?: number;
    revenueImpactP90?: number;
    peakErosionP10?: number;
    peakErosionP90?: number;
    dataSource: string;
    confidence: string;
  };
  errors: {
    peakErosionAbsolute: number;
    peakErosionPercent: number;
    competitorCountDelta: number;
    firstCompetitorYearDelta: number;
    peakErosionYearDelta: number;
  };
  /** Whether observed erosion fell within the predicted P10/P90 band */
  inCalibrationBand: boolean;
}

/**
 * Aggregated back-test results across all historical assets.
 */
export interface BackTestReport {
  /** When the back-test was run */
  generatedAt: string;
  /** Engine version identifier */
  engineVersion: string;
  /** Number of assets tested */
  assetCount: number;
  /** Per-asset results */
  assetResults: BackTestAssetResult[];
  /** Aggregate metrics on peak erosion prediction (ALL assets including edge cases) */
  peakErosionMetrics: MetricsBundle;
  /** Aggregate metrics on peak erosion EXCLUDING edge cases (defensible claims) */
  defensiblePeakErosionMetrics: MetricsBundle;
  /** Aggregate metrics on competitor count prediction */
  competitorCountMetrics: MetricsBundle;
  /** Aggregate metrics on first competitor year prediction */
  firstCompetitorYearMetrics: MetricsBundle;
  /** Calibration accuracy: fraction of outcomes in P10/P90 band */
  calibrationAccuracyPeakErosion: number;
  /** Timing accuracy: fraction of competitor-year predictions within ±1 year */
  timingAccuracyCompetitorYear: number;
  /** Overall assessment */
  overallConfidence: 'high' | 'moderate' | 'low';
  /** Human-readable summary */
  summary: string;
  /** Breakdown by therapeutic area */
  byTherapeuticArea: Record<string, { assetCount: number; mape: number; pearsonR: number }>;
  /** Number of edge cases excluded from defensible metrics */
  edgeCaseCount: number;
  /** List of edge case exclusions with reasons */
  edgeCases: Array<{ assetName: string; reason: string }>;
}

/**
 * Convert historical asset as-of inputs into an RNPVInput object.
 */
function assetToRNPVInput(asset: HistoricalAsset): RNPVInput {
  return {
    therapeuticArea: asset.asOfInputs.therapeuticArea as RNPVInput['therapeuticArea'],
    phase: asset.asOfInputs.phase as RNPVInput['phase'],
    modality: asset.asOfInputs.modality as RNPVInput['modality'],
    indication: asset.asOfInputs.indication,
    territory: asset.asOfInputs.territory as RNPVInput['territory'],
    dealType: 'licensing',
    competitivePosition: asset.asOfInputs.competitivePosition as RNPVInput['competitivePosition'],
    dataQuality: 'robust' as RNPVInput['dataQuality'],
    biomarkerStatus: asset.asOfInputs.biomarkerStatus as RNPVInput['biomarkerStatus'],
    regulatoryDesignations: asset.asOfInputs.regulatoryDesignations,
    peakSalesEstimate: asset.asOfInputs.peakSalesEstimate,
  };
}

/**
 * Run the back-test against a single asset.
 */
export function runSingleBackTest(asset: HistoricalAsset): BackTestAssetResult {
  const input = assetToRNPVInput(asset);
  const rnpv = calculateRNPV(input);
  const dynamics = calculateCompetitiveDynamics(input, rnpv);

  // Predicted values
  const predicted = {
    peakShareErosion: dynamics.peakShareErosion,
    competitorCount: dynamics.competitorTimeline.length,
    firstCompetitorYear: dynamics.competitorTimeline.length > 0
      ? Math.min(...dynamics.competitorTimeline.map((c) => c.entryYear))
      : asset.launchYear,
    peakErosionYear: dynamics.peakErosionYear,
    revenueImpact: dynamics.revenueImpact,
    revenueImpactP10: dynamics.revenueImpactP10,
    revenueImpactP90: dynamics.revenueImpactP90,
    peakErosionP10: dynamics.peakErosionP10,
    peakErosionP90: dynamics.peakErosionP90,
    dataSource: dynamics.dataSource,
    confidence: dynamics.confidence,
  };

  // Errors (actual vs predicted)
  const errors = {
    peakErosionAbsolute: predicted.peakShareErosion - asset.actualOutcomes.estimatedPeakErosion,
    peakErosionPercent: asset.actualOutcomes.estimatedPeakErosion > 0
      ? (predicted.peakShareErosion - asset.actualOutcomes.estimatedPeakErosion) / asset.actualOutcomes.estimatedPeakErosion
      : 0,
    competitorCountDelta: predicted.competitorCount - asset.actualOutcomes.actualCompetitorCount,
    firstCompetitorYearDelta: predicted.firstCompetitorYear - asset.actualOutcomes.firstCompetitorYear,
    peakErosionYearDelta: predicted.peakErosionYear - asset.actualOutcomes.peakYear,
  };

  // Calibration: is the actual observation within the P10/P90 band?
  let inCalibrationBand = false;
  if (predicted.peakErosionP10 != null && predicted.peakErosionP90 != null) {
    inCalibrationBand =
      asset.actualOutcomes.estimatedPeakErosion >= predicted.peakErosionP10 &&
      asset.actualOutcomes.estimatedPeakErosion <= predicted.peakErosionP90;
  }

  return {
    asset,
    predicted,
    errors,
    inCalibrationBand,
  };
}

/**
 * Run the full back-test across all historical assets.
 */
export function runFullBackTest(options?: {
  filterTA?: string;
  engineVersion?: string;
}): BackTestReport {
  const assets = options?.filterTA
    ? HISTORICAL_ASSETS.filter((a) => a.asOfInputs.therapeuticArea === options.filterTA)
    : HISTORICAL_ASSETS;

  const assetResults = assets.map(runSingleBackTest);

  // Aggregate predictions and actuals for each metric
  const peakErosionActuals = assetResults.map((r) => r.asset.actualOutcomes.estimatedPeakErosion);
  const peakErosionPredictions = assetResults.map((r) => r.predicted.peakShareErosion);

  const competitorCountActuals = assetResults.map((r) => r.asset.actualOutcomes.actualCompetitorCount);
  const competitorCountPredictions = assetResults.map((r) => r.predicted.competitorCount);

  const firstYearActuals = assetResults.map((r) => r.asset.actualOutcomes.firstCompetitorYear);
  const firstYearPredictions = assetResults.map((r) => r.predicted.firstCompetitorYear);

  const peakErosionMetrics = computeMetricsBundle(peakErosionActuals, peakErosionPredictions);
  const competitorCountMetrics = computeMetricsBundle(competitorCountActuals, competitorCountPredictions);
  const firstCompetitorYearMetrics = computeMetricsBundle(firstYearActuals, firstYearPredictions);

  // Defensible metrics exclude known edge cases (disruptive modality shifts,
  // reimbursement failures, biosimilar cliffs) — these are handled by separate
  // models and are not competitive dynamics phenomena.
  const defensibleResults = assetResults.filter((r) => !r.asset.isEdgeCase);
  const defensibleActuals = defensibleResults.map((r) => r.asset.actualOutcomes.estimatedPeakErosion);
  const defensiblePredictions = defensibleResults.map((r) => r.predicted.peakShareErosion);
  const defensiblePeakErosionMetrics = computeMetricsBundle(defensibleActuals, defensiblePredictions);

  const edgeCases = assetResults
    .filter((r) => r.asset.isEdgeCase)
    .map((r) => ({
      assetName: r.asset.name,
      reason: r.asset.edgeCaseReason || 'Edge case',
    }));

  // Calibration accuracy (only for assets that have P10/P90 bands, excluding edge cases)
  const assetsWithBands = assetResults.filter(
    (r) => r.predicted.peakErosionP10 != null && r.predicted.peakErosionP90 != null && !r.asset.isEdgeCase,
  );
  const calibrationActuals = assetsWithBands.map((r) => r.asset.actualOutcomes.estimatedPeakErosion);
  const calibrationP10 = assetsWithBands.map((r) => r.predicted.peakErosionP10!);
  const calibrationP90 = assetsWithBands.map((r) => r.predicted.peakErosionP90!);
  const calibrationAccuracyPeakErosion = calibrationAccuracy(calibrationActuals, calibrationP10, calibrationP90);

  // Timing accuracy
  const timingAccuracyCompetitorYear = timingAccuracy(firstYearActuals, firstYearPredictions, 1);

  // TA breakdown
  const byTherapeuticArea: Record<string, { assetCount: number; mape: number; pearsonR: number }> = {};
  const taGroups = new Map<string, BackTestAssetResult[]>();
  for (const r of assetResults) {
    const ta = r.asset.asOfInputs.therapeuticArea;
    if (!taGroups.has(ta)) taGroups.set(ta, []);
    taGroups.get(ta)!.push(r);
  }
  for (const [ta, group] of taGroups.entries()) {
    const actuals = group.map((r) => r.asset.actualOutcomes.estimatedPeakErosion);
    const preds = group.map((r) => r.predicted.peakShareErosion);
    const metrics = computeMetricsBundle(actuals, preds);
    byTherapeuticArea[ta] = {
      assetCount: group.length,
      mape: metrics.mape,
      pearsonR: metrics.pearsonR,
    };
  }

  // Overall confidence assessment — based on DEFENSIBLE metrics (excluding edge cases)
  let overallConfidence: BackTestReport['overallConfidence'];
  if (defensiblePeakErosionMetrics.mape < 0.25 && defensiblePeakErosionMetrics.pearsonR > 0.5) {
    overallConfidence = 'high';
  } else if (defensiblePeakErosionMetrics.mape < 0.35 && defensiblePeakErosionMetrics.pearsonR > 0.3) {
    overallConfidence = 'moderate';
  } else {
    overallConfidence = 'low';
  }

  const summary =
    `Engine validated against ${assets.length} historical biopharma assets across ${taGroups.size} therapeutic areas. ` +
    `Defensible metrics (excluding ${edgeCases.length} known edge cases): ` +
    `Peak erosion MAPE: ${(defensiblePeakErosionMetrics.mape * 100).toFixed(1)}%, ` +
    `Pearson R: ${defensiblePeakErosionMetrics.pearsonR.toFixed(3)}. ` +
    `P10/P90 calibration: ${(calibrationAccuracyPeakErosion * 100).toFixed(1)}%. ` +
    `Overall confidence: ${overallConfidence.toUpperCase()}.`;

  return {
    generatedAt: new Date().toISOString(),
    engineVersion: options?.engineVersion ?? 'competitive-dynamics-v13',
    assetCount: assets.length,
    assetResults,
    peakErosionMetrics,
    defensiblePeakErosionMetrics,
    competitorCountMetrics,
    firstCompetitorYearMetrics,
    calibrationAccuracyPeakErosion,
    timingAccuracyCompetitorYear,
    overallConfidence,
    summary,
    byTherapeuticArea,
    edgeCaseCount: edgeCases.length,
    edgeCases,
  };
}

/**
 * Format a report as human-readable markdown.
 */
export function formatReportMarkdown(report: BackTestReport): string {
  const lines: string[] = [];
  lines.push(`# Competitive Dynamics Engine — Back-Test Report`);
  lines.push(``);
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**Engine version:** ${report.engineVersion}`);
  lines.push(`**Assets tested:** ${report.assetCount}`);
  lines.push(`**Overall confidence:** ${report.overallConfidence.toUpperCase()}`);
  lines.push(``);
  lines.push(`## Summary`);
  lines.push(``);
  lines.push(report.summary);
  lines.push(``);
  lines.push(`## Aggregate Metrics`);
  lines.push(``);
  lines.push(`### Peak Erosion Prediction`);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| n | ${report.peakErosionMetrics.n} |`);
  lines.push(`| MAPE | ${(report.peakErosionMetrics.mape * 100).toFixed(1)}% |`);
  lines.push(`| MAE | ${report.peakErosionMetrics.mae.toFixed(3)} |`);
  lines.push(`| RMSE | ${report.peakErosionMetrics.rmse.toFixed(3)} |`);
  lines.push(`| R² | ${report.peakErosionMetrics.rSquared.toFixed(3)} |`);
  lines.push(`| Pearson R | ${report.peakErosionMetrics.pearsonR.toFixed(3)} |`);
  lines.push(`| Mean actual | ${report.peakErosionMetrics.meanActual.toFixed(3)} |`);
  lines.push(`| Mean predicted | ${report.peakErosionMetrics.meanPredicted.toFixed(3)} |`);
  lines.push(``);
  lines.push(`### Calibration & Timing`);
  lines.push(`| Metric | Value | Target |`);
  lines.push(`|--------|-------|--------|`);
  lines.push(`| P10/P90 calibration | ${(report.calibrationAccuracyPeakErosion * 100).toFixed(1)}% | 80% |`);
  lines.push(`| Competitor timing (±1yr) | ${(report.timingAccuracyCompetitorYear * 100).toFixed(1)}% | >70% |`);
  lines.push(``);
  lines.push(`## Per-Asset Results`);
  lines.push(``);
  lines.push(`| Asset | TA | Actual Erosion | Predicted | Error | In P10-P90 Band |`);
  lines.push(`|-------|-----|----------------|-----------|-------|-----------------|`);
  for (const r of report.assetResults) {
    lines.push(
      `| ${r.asset.name} | ${r.asset.asOfInputs.therapeuticArea} | ${(r.asset.actualOutcomes.estimatedPeakErosion * 100).toFixed(1)}% | ${(r.predicted.peakShareErosion * 100).toFixed(1)}% | ${(r.errors.peakErosionAbsolute * 100).toFixed(1)}pp | ${r.inCalibrationBand ? '✓' : '✗'} |`,
    );
  }
  lines.push(``);
  lines.push(`## Therapeutic Area Breakdown`);
  lines.push(``);
  lines.push(`| TA | n | MAPE | Pearson R |`);
  lines.push(`|-----|---|------|-----------|`);
  for (const [ta, m] of Object.entries(report.byTherapeuticArea)) {
    lines.push(`| ${ta} | ${m.assetCount} | ${(m.mape * 100).toFixed(1)}% | ${m.pearsonR.toFixed(3)} |`);
  }
  lines.push(``);
  lines.push(`## Data Sources`);
  lines.push(``);
  for (const r of report.assetResults) {
    lines.push(`- **${r.asset.name}:** ${r.asset.sources.join(', ')}`);
  }
  return lines.join('\n');
}
