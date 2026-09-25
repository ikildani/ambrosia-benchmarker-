/**
 * Preclinical slice of the deal-terms backtest, read from the same versioned
 * report as /accuracy (__tests__/backtest/baseline-errors.json). Server-side.
 *
 * The public accuracy loader summarises phases by ±25% / ±35% hit rate. For
 * an early-stage reader the more useful questions are "how often is the
 * upfront within a factor of two", "how much of that is the test harness's
 * floor doing the work", and "does the engine beat simply guessing the phase
 * median" — so those are computed here from the per-case rows.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

interface Row {
  case: { id: string; phase: string; actualUpfront_M: number; actualTotalDeal_M?: number };
  predictedUpfront_M: number;
  predictedTotalDeal_M?: number;
  within50: boolean;
}

export interface PreclinicalBacktestSlice {
  runAt: string;
  n: number;
  /** Actual upfront within ±50% of the prediction. */
  within50: number;
  /** Actual upfront within a factor of two of the prediction (0.5x–2x). */
  within2x: number;
  /** Actual total deal value within a factor of two of the predicted total. */
  totalWithin2x: number;
  medianActualUpfront_M: number;
  medianPredictedUpfront_M: number;
  medianAbsErrorPct: number;
  /**
   * How a naive model does: predict the phase-median actual upfront for every
   * deal. If the engine is not clearly above this, its preclinical number is
   * not adding information.
   */
  phaseMedianWithin2x: number;
  /** Predictions sitting at the test harness's early-stage floor band. */
  atFloor: number;
}

const BACKTEST_PATH = join(process.cwd(), '__tests__', 'backtest', 'baseline-errors.json');
/** Test-only floor for preclinical predictions (lib/financial/backtest/deal-backtest.ts). */
const PRECLINICAL_TEST_FLOOR_M = 75;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function withinFactor(actual: number, predicted: number, factor: number): boolean {
  if (!(actual > 0) || !(predicted > 0)) return false;
  const r = actual / predicted;
  return r >= 1 / factor && r <= factor;
}

export function loadPreclinicalBacktestSlice(): PreclinicalBacktestSlice | null {
  let report: { runAt?: string; results?: Row[] };
  try {
    report = JSON.parse(readFileSync(BACKTEST_PATH, 'utf8'));
  } catch {
    return null;
  }
  const rows = (report.results ?? []).filter(r => r.case?.phase === 'preclinical');
  if (rows.length === 0) return null;

  const actuals = rows.map(r => r.case.actualUpfront_M);
  const preds = rows.map(r => r.predictedUpfront_M);
  const phaseMedian = median(actuals);
  const absErr = rows
    .filter(r => r.case.actualUpfront_M > 0)
    .map(r => Math.abs(r.predictedUpfront_M - r.case.actualUpfront_M) / r.case.actualUpfront_M);

  return {
    runAt: report.runAt ?? '',
    n: rows.length,
    within50: rows.filter(r => r.within50).length,
    within2x: rows.filter(r => withinFactor(r.case.actualUpfront_M, r.predictedUpfront_M, 2)).length,
    totalWithin2x: rows.filter(r => withinFactor(r.case.actualTotalDeal_M ?? 0, r.predictedTotalDeal_M ?? 0, 2)).length,
    medianActualUpfront_M: phaseMedian,
    medianPredictedUpfront_M: median(preds),
    medianAbsErrorPct: median(absErr),
    phaseMedianWithin2x: rows.filter(r => withinFactor(r.case.actualUpfront_M, phaseMedian, 2)).length,
    atFloor: rows.filter(r => Math.abs(r.predictedUpfront_M - PRECLINICAL_TEST_FLOOR_M) <= PRECLINICAL_TEST_FLOOR_M * 0.1).length,
  };
}
