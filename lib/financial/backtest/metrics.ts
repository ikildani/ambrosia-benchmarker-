/**
 * Statistical metrics for back-test validation.
 *
 * Standard regression metrics used to quantify how well the engine's
 * predictions match observed historical outcomes.
 *
 * @module lib/financial/backtest/metrics
 */

/**
 * Mean Absolute Percentage Error.
 * MAPE = mean(|actual - predicted| / |actual|)
 *
 * Measures average prediction error as percentage of actual.
 * Lower is better. Industry standard for financial forecasting.
 */
export function mape(actuals: number[], predictions: number[]): number {
  if (actuals.length !== predictions.length || actuals.length === 0) {
    return NaN;
  }
  const sum = actuals.reduce((acc, actual, i) => {
    if (Math.abs(actual) < 1e-6) return acc; // avoid divide-by-zero
    return acc + Math.abs((actual - predictions[i]) / actual);
  }, 0);
  return sum / actuals.length;
}

/**
 * Mean Absolute Error.
 * MAE = mean(|actual - predicted|)
 *
 * Measures average absolute prediction error in the same units as input.
 * Lower is better.
 */
export function mae(actuals: number[], predictions: number[]): number {
  if (actuals.length !== predictions.length || actuals.length === 0) {
    return NaN;
  }
  const sum = actuals.reduce((acc, actual, i) => acc + Math.abs(actual - predictions[i]), 0);
  return sum / actuals.length;
}

/**
 * Root Mean Squared Error.
 * RMSE = sqrt(mean((actual - predicted)^2))
 *
 * Penalizes large errors more heavily than MAE. Useful when
 * large deviations are particularly undesirable.
 */
export function rmse(actuals: number[], predictions: number[]): number {
  if (actuals.length !== predictions.length || actuals.length === 0) {
    return NaN;
  }
  const sumSquared = actuals.reduce((acc, actual, i) => {
    const err = actual - predictions[i];
    return acc + err * err;
  }, 0);
  return Math.sqrt(sumSquared / actuals.length);
}

/**
 * Coefficient of determination (R²).
 * R² = 1 - (SS_res / SS_tot)
 *
 * Proportion of variance in actuals explained by predictions.
 * 1.0 = perfect prediction. 0.0 = no better than mean. Negative = worse than mean.
 */
export function rSquared(actuals: number[], predictions: number[]): number {
  if (actuals.length !== predictions.length || actuals.length === 0) {
    return NaN;
  }
  const meanActual = actuals.reduce((acc, v) => acc + v, 0) / actuals.length;
  const ssTot = actuals.reduce((acc, v) => acc + (v - meanActual) ** 2, 0);
  const ssRes = actuals.reduce((acc, v, i) => acc + (v - predictions[i]) ** 2, 0);
  if (ssTot === 0) return NaN;
  return 1 - ssRes / ssTot;
}

/**
 * Pearson correlation coefficient.
 *
 * Measures linear correlation between predictions and actuals.
 * Range: -1 (inverse) to +1 (perfect). 0 = no linear relationship.
 */
export function pearsonCorrelation(actuals: number[], predictions: number[]): number {
  if (actuals.length !== predictions.length || actuals.length < 2) {
    return NaN;
  }
  const n = actuals.length;
  const meanA = actuals.reduce((s, v) => s + v, 0) / n;
  const meanP = predictions.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let sumSqA = 0;
  let sumSqP = 0;
  for (let i = 0; i < n; i++) {
    const dA = actuals[i] - meanA;
    const dP = predictions[i] - meanP;
    num += dA * dP;
    sumSqA += dA * dA;
    sumSqP += dP * dP;
  }
  const denom = Math.sqrt(sumSqA * sumSqP);
  if (denom === 0) return NaN;
  return num / denom;
}

/**
 * Calibration accuracy for confidence intervals.
 *
 * Measures what fraction of actuals fall within the predicted [P10, P90] band.
 * Ideal: 0.80 (80% of outcomes in the 80% confidence band).
 * < 0.80 = overconfident (bands too narrow).
 * > 0.80 = underconfident (bands too wide).
 */
export function calibrationAccuracy(
  actuals: number[],
  p10Predictions: number[],
  p90Predictions: number[],
): number {
  if (actuals.length === 0 || actuals.length !== p10Predictions.length || actuals.length !== p90Predictions.length) {
    return NaN;
  }
  let inBand = 0;
  for (let i = 0; i < actuals.length; i++) {
    if (actuals[i] >= p10Predictions[i] && actuals[i] <= p90Predictions[i]) {
      inBand++;
    }
  }
  return inBand / actuals.length;
}

/**
 * Timing accuracy for discrete year predictions.
 *
 * Measures what fraction of predictions are within ±tolerance years of actual.
 */
export function timingAccuracy(
  actuals: number[],
  predictions: number[],
  toleranceYears = 1,
): number {
  if (actuals.length !== predictions.length || actuals.length === 0) {
    return NaN;
  }
  let correct = 0;
  for (let i = 0; i < actuals.length; i++) {
    if (Math.abs(actuals[i] - predictions[i]) <= toleranceYears) {
      correct++;
    }
  }
  return correct / actuals.length;
}

/**
 * Full metrics bundle for a single target variable.
 */
export interface MetricsBundle {
  n: number;
  mape: number;
  mae: number;
  rmse: number;
  rSquared: number;
  pearsonR: number;
  meanActual: number;
  meanPredicted: number;
  minError: number;
  maxError: number;
}

export function computeMetricsBundle(
  actuals: number[],
  predictions: number[],
): MetricsBundle {
  const n = actuals.length;
  const meanActual = n > 0 ? actuals.reduce((s, v) => s + v, 0) / n : 0;
  const meanPredicted = n > 0 ? predictions.reduce((s, v) => s + v, 0) / n : 0;
  const errors = actuals.map((a, i) => Math.abs(a - predictions[i]));
  const minError = errors.length > 0 ? Math.min(...errors) : 0;
  const maxError = errors.length > 0 ? Math.max(...errors) : 0;

  return {
    n,
    mape: mape(actuals, predictions),
    mae: mae(actuals, predictions),
    rmse: rmse(actuals, predictions),
    rSquared: rSquared(actuals, predictions),
    pearsonR: pearsonCorrelation(actuals, predictions),
    meanActual,
    meanPredicted,
    minError,
    maxError,
  };
}
