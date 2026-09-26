/**
 * Search & Evaluation scoring v3 — model (pure TypeScript, no dependencies).
 *
 * L2-regularised logistic regression with monotone sign constraints on the
 * documented features, class weights for the ~1-2 % positive rate, and a
 * calibration step (Platt or isotonic, both sample-weighted so negative
 * subsampling in the training set is undone before the curve is fitted).
 *
 * Contract for the UI (lib/radar/types.ts ScoreFactorContribution):
 *
 *   logit = intercept + Σ_j contribution_j
 *   contribution_j = weight_j × standardized_j
 *   intercept = bias + prior_correction           (prior_correction = ln(sampling_rate))
 *   probability = calibrate(logit)
 *   score (0-100) = round(100 × probability × availability)   [signal-detection.ts]
 *
 * `scoreFromFeatures` returns every term above so a waterfall can be drawn
 * exactly, and a test asserts Σ contribution + intercept === logit.
 */

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

/** +1: coefficient must be >= 0; -1: <= 0; 0: unconstrained. */
export type SignConstraint = 1 | -1 | 0;

export type CalibrationParams =
  | { type: 'none' }
  /** p = sigmoid(a × logit + b) */
  | { type: 'platt'; a: number; b: number }
  /** Piecewise-linear interpolation through (x = raw probability, y = observed rate) knots. */
  | { type: 'isotonic'; x: number[]; y: number[] };

export interface ModelParams {
  version: string;
  feature_version: string;
  feature_names: string[];
  sign_constraints: SignConstraint[];
  /** Training means/stds per feature (imputation + standardization). */
  means: number[];
  stds: number[];
  weights: number[];
  bias: number;
  /** ln(negative sampling rate) added to the logit; 0 when training used every negative. */
  prior_correction: number;
  calibration: CalibrationParams;
  l2: number;
  class_weight_pos: number;
  trained_at: string;
  train_window: { from: string; to: string };
  test_window: { from: string; to: string };
  n_train: number;
  positives_train: number;
  iterations: number;
  final_loss: number;
}

export interface TrainOptions {
  l2?: number;
  learningRate?: number;
  maxIterations?: number;
  tolerance?: number;
  /** Positive-class weight, or 'balanced' = negatives / positives. */
  classWeightPos?: number | 'balanced';
  signConstraints?: SignConstraint[];
}

export interface TrainedLogistic {
  weights: number[];
  bias: number;
  means: number[];
  stds: number[];
  iterations: number;
  finalLoss: number;
  classWeightPos: number;
}

export interface FeatureContribution {
  feature: string;
  /** Raw value after imputation (training mean when the input was null). */
  value: number;
  imputed: boolean;
  standardized: number;
  weight: number;
  contribution: number;
}

export interface ScoreOutput {
  /** Calibrated probability in [0, 1]. */
  probability: number;
  /** sigmoid(logit) before calibration. */
  raw_probability: number;
  logit: number;
  intercept: number;
  contributions: FeatureContribution[];
  /** Share of features supplied non-null. */
  completeness: number;
}

// ═══════════════════════════════════════════════════════════════════════
// NUMERICS
// ═══════════════════════════════════════════════════════════════════════

export function sigmoid(z: number): number {
  if (z > 500) return 1;
  if (z < -500) return 0;
  return 1 / (1 + Math.exp(-z));
}

export function logit(p: number): number {
  const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
  return Math.log(q / (1 - q));
}

/**
 * Column means and stds over non-null cells. A column with no non-null cells
 * gets mean 0 / std 1; a constant column gets std 1 so it standardizes to 0.
 */
export function fitStandardization(X: readonly (readonly (number | null)[])[], d: number): { means: number[]; stds: number[] } {
  const means = new Array<number>(d).fill(0);
  const stds = new Array<number>(d).fill(1);
  for (let j = 0; j < d; j++) {
    let n = 0;
    let sum = 0;
    for (const row of X) {
      const v = row[j];
      if (v === null || v === undefined || !Number.isFinite(v)) continue;
      n++;
      sum += v;
    }
    if (n === 0) continue;
    const mean = sum / n;
    let sq = 0;
    for (const row of X) {
      const v = row[j];
      if (v === null || v === undefined || !Number.isFinite(v)) continue;
      sq += (v - mean) ** 2;
    }
    const std = Math.sqrt(sq / n);
    means[j] = mean;
    stds[j] = std > 1e-9 ? std : 1;
  }
  return { means, stds };
}

/** Impute nulls with the mean (→ 0 after standardization) and standardize. */
export function standardizeRow(row: readonly (number | null)[], means: readonly number[], stds: readonly number[]): number[] {
  const out = new Array<number>(means.length);
  for (let j = 0; j < means.length; j++) {
    const v = row[j];
    const x = v === null || v === undefined || !Number.isFinite(v) ? means[j] : v;
    out[j] = (x - means[j]) / stds[j];
  }
  return out;
}

function projectSigns(weights: number[], signs: readonly SignConstraint[] | undefined): void {
  if (!signs) return;
  for (let j = 0; j < weights.length; j++) {
    const s = signs[j] ?? 0;
    if (s > 0 && weights[j] < 0) weights[j] = 0;
    else if (s < 0 && weights[j] > 0) weights[j] = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TRAINING — projected gradient descent with backtracking step size
// ═══════════════════════════════════════════════════════════════════════

/**
 * Minimise the class-weighted, L2-penalised log loss subject to the sign
 * constraints (projection after every step). Full-batch gradient descent with
 * a step size that halves whenever the loss fails to decrease, which keeps the
 * procedure stable on correlated standardized features without tuning.
 */
export function trainLogistic(
  X: readonly (readonly (number | null)[])[],
  y: readonly number[],
  opts: TrainOptions = {},
): TrainedLogistic {
  const n = X.length;
  if (n === 0) throw new Error('trainLogistic: empty training set');
  if (y.length !== n) throw new Error('trainLogistic: X and y differ in length');
  const d = X[0].length;

  const l2 = opts.l2 ?? 0.01;
  const maxIter = opts.maxIterations ?? 500;
  const tol = opts.tolerance ?? 1e-6;
  let lr = opts.learningRate ?? 0.5;
  const signs = opts.signConstraints;

  let positives = 0;
  for (const v of y) if (v === 1) positives++;
  const negatives = n - positives;
  const wPos =
    opts.classWeightPos === 'balanced' || opts.classWeightPos === undefined
      ? positives > 0 ? negatives / positives : 1
      : opts.classWeightPos;
  const sampleW = y.map(v => (v === 1 ? wPos : 1));
  const wSum = sampleW.reduce((s, w) => s + w, 0);

  const { means, stds } = fitStandardization(X, d);
  const Z = X.map(row => standardizeRow(row, means, stds));

  let weights = new Array<number>(d).fill(0);
  let bias = positives > 0 && negatives > 0 ? 0 : 0;

  const lossOf = (w: number[], b: number): number => {
    let loss = 0;
    for (let i = 0; i < n; i++) {
      let z = b;
      const zi = Z[i];
      for (let j = 0; j < d; j++) z += zi[j] * w[j];
      // Numerically stable log-loss: log(1 + e^{-z}) for y=1, log(1 + e^{z}) for y=0
      const ll = y[i] === 1 ? softplus(-z) : softplus(z);
      loss += sampleW[i] * ll;
    }
    loss /= wSum;
    let reg = 0;
    for (const v of w) reg += v * v;
    return loss + (l2 / 2) * reg;
  };

  let loss = lossOf(weights, bias);
  let iterations = 0;
  const gradW = new Array<number>(d).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    gradW.fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      let z = bias;
      const zi = Z[i];
      for (let j = 0; j < d; j++) z += zi[j] * weights[j];
      const err = (sigmoid(z) - y[i]) * sampleW[i];
      gradB += err;
      for (let j = 0; j < d; j++) gradW[j] += err * zi[j];
    }
    gradB /= wSum;
    for (let j = 0; j < d; j++) gradW[j] = gradW[j] / wSum + l2 * weights[j];

    let gradMag = gradB * gradB;
    for (const g of gradW) gradMag += g * g;
    if (Math.sqrt(gradMag) < tol) break;

    // Backtracking: shrink the step until the projected update lowers the loss.
    let accepted = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const nextW = weights.map((w, j) => w - lr * gradW[j]);
      const nextB = bias - lr * gradB;
      projectSigns(nextW, signs);
      const nextLoss = lossOf(nextW, nextB);
      if (nextLoss <= loss) {
        const improvement = loss - nextLoss;
        weights = nextW;
        bias = nextB;
        loss = nextLoss;
        accepted = true;
        if (improvement < tol * Math.max(1, loss)) { iter = maxIter; }
        break;
      }
      lr /= 2;
    }
    if (!accepted) break;
  }

  return { weights, bias, means, stds, iterations, finalLoss: loss, classWeightPos: wPos };
}

function softplus(x: number): number {
  if (x > 30) return x;
  if (x < -30) return 0;
  return Math.log1p(Math.exp(x));
}

// ═══════════════════════════════════════════════════════════════════════
// CALIBRATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Platt scaling: fit p = sigmoid(a × logit + b) by weighted Newton-Raphson
 * with Platt's smoothed targets. `weights` undo negative subsampling
 * (negatives carry 1 / sampling_rate).
 */
export function fitPlatt(logits: readonly number[], y: readonly number[], weights?: readonly number[]): CalibrationParams {
  const n = logits.length;
  if (n === 0) return { type: 'none' };
  const w = weights ?? new Array<number>(n).fill(1);
  let nPos = 0;
  let nNeg = 0;
  for (let i = 0; i < n; i++) { if (y[i] === 1) nPos += w[i]; else nNeg += w[i]; }
  if (nPos === 0 || nNeg === 0) return { type: 'none' };
  const tPos = (nPos + 1) / (nPos + 2);
  const tNeg = 1 / (nNeg + 2);
  const t = y.map(v => (v === 1 ? tPos : tNeg));

  let a = 1;
  let b = 0;
  for (let iter = 0; iter < 100; iter++) {
    let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
    for (let i = 0; i < n; i++) {
      const p = sigmoid(a * logits[i] + b);
      const e = (p - t[i]) * w[i];
      const s = p * (1 - p) * w[i] + 1e-9;
      g0 += e * logits[i];
      g1 += e;
      h00 += s * logits[i] * logits[i];
      h01 += s * logits[i];
      h11 += s;
    }
    // Tiny ridge keeps the Hessian invertible on degenerate inputs.
    h00 += 1e-6; h11 += 1e-6;
    const det = h00 * h11 - h01 * h01;
    if (Math.abs(det) < 1e-12) break;
    const da = (h11 * g0 - h01 * g1) / det;
    const db = (h00 * g1 - h01 * g0) / det;
    a -= da;
    b -= db;
    if (Math.abs(da) < 1e-8 && Math.abs(db) < 1e-8) break;
  }
  // A negative slope would invert the ranking; fall back to identity.
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return { type: 'none' };
  return { type: 'platt', a, b };
}

/**
 * Isotonic regression by weighted pool-adjacent-violators on (raw probability,
 * label). Returns the knots of a non-decreasing step function, which
 * `applyCalibration` interpolates linearly between block centres.
 */
export function fitIsotonic(probs: readonly number[], y: readonly number[], weights?: readonly number[]): CalibrationParams {
  const n = probs.length;
  if (n === 0) return { type: 'none' };
  const w = weights ?? new Array<number>(n).fill(1);
  const order = probs.map((_, i) => i).sort((a, b) => probs[a] - probs[b] || a - b);

  // Blocks: [sumX, sumY, sumW]
  const bx: number[] = [];
  const by: number[] = [];
  const bw: number[] = [];
  for (const i of order) {
    bx.push(probs[i] * w[i]);
    by.push(y[i] * w[i]);
    bw.push(w[i]);
    // Merge while the previous block mean exceeds the current one.
    while (bx.length >= 2) {
      const k = bx.length - 1;
      const prevMean = by[k - 1] / bw[k - 1];
      const curMean = by[k] / bw[k];
      if (prevMean <= curMean) break;
      bx[k - 1] += bx[k]; by[k - 1] += by[k]; bw[k - 1] += bw[k];
      bx.pop(); by.pop(); bw.pop();
    }
  }
  const x = bx.map((s, k) => s / bw[k]);
  const yy = by.map((s, k) => s / bw[k]);
  if (x.length < 2) return { type: 'none' };
  return { type: 'isotonic', x, y: yy };
}

/** Map a model logit (and its raw probability) through the calibration curve. */
export function applyCalibration(cal: CalibrationParams, logitValue: number, rawProb: number): number {
  switch (cal.type) {
    case 'none':
      return rawProb;
    case 'platt':
      return sigmoid(cal.a * logitValue + cal.b);
    case 'isotonic': {
      const { x, y } = cal;
      if (rawProb <= x[0]) return clamp01(y[0]);
      const last = x.length - 1;
      if (rawProb >= x[last]) return clamp01(y[last]);
      let lo = 0;
      let hi = last;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (x[mid] <= rawProb) lo = mid; else hi = mid;
      }
      const span = x[hi] - x[lo];
      const t = span > 0 ? (rawProb - x[lo]) / span : 0;
      return clamp01(y[lo] + t * (y[hi] - y[lo]));
    }
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ═══════════════════════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════════════════════

/** Assemble ModelParams from a trained fit plus calibration and metadata. */
export function buildModelParams(args: {
  version: string;
  featureVersion: string;
  featureNames: string[];
  signConstraints: SignConstraint[];
  fit: TrainedLogistic;
  calibration: CalibrationParams;
  samplingRate: number;
  l2: number;
  trainWindow: { from: string; to: string };
  testWindow: { from: string; to: string };
  nTrain: number;
  positivesTrain: number;
  trainedAt?: Date;
}): ModelParams {
  return {
    version: args.version,
    feature_version: args.featureVersion,
    feature_names: args.featureNames,
    sign_constraints: args.signConstraints,
    means: args.fit.means,
    stds: args.fit.stds,
    weights: args.fit.weights,
    bias: args.fit.bias,
    prior_correction: args.samplingRate > 0 && args.samplingRate < 1 ? Math.log(args.samplingRate) : 0,
    calibration: args.calibration,
    l2: args.l2,
    class_weight_pos: args.fit.classWeightPos,
    trained_at: (args.trainedAt ?? new Date()).toISOString(),
    train_window: args.trainWindow,
    test_window: args.testWindow,
    n_train: args.nTrain,
    positives_train: args.positivesTrain,
    iterations: args.fit.iterations,
    final_loss: args.fit.finalLoss,
  };
}

/**
 * Score one feature vector. Missing features are imputed with the training
 * mean (zero contribution) and reported as `imputed` so the UI can show
 * "no data" instead of a fake zero.
 */
export function scoreFromFeatures(vector: Record<string, number | null | undefined>, params: ModelParams): ScoreOutput {
  const d = params.feature_names.length;
  const contributions: FeatureContribution[] = new Array(d);
  let sum = 0;
  let present = 0;
  for (let j = 0; j < d; j++) {
    const name = params.feature_names[j];
    const raw = vector[name];
    const imputed = raw === null || raw === undefined || !Number.isFinite(raw);
    const value = imputed ? params.means[j] : (raw as number);
    if (!imputed) present++;
    const standardized = (value - params.means[j]) / params.stds[j];
    const weight = params.weights[j];
    const contribution = weight * standardized;
    sum += contribution;
    contributions[j] = { feature: name, value, imputed, standardized, weight, contribution };
  }
  const intercept = params.bias + params.prior_correction;
  const z = intercept + sum;
  const rawProb = sigmoid(z);
  const probability = applyCalibration(params.calibration, z, rawProb);
  return {
    probability,
    raw_probability: rawProb,
    logit: z,
    intercept,
    contributions,
    completeness: d > 0 ? present / d : 0,
  };
}

/** Standardized design matrix + per-row contribution matrix (for importance). */
export function contributionMatrix(X: readonly (readonly (number | null)[])[], params: ModelParams): number[][] {
  return X.map(row => {
    const z = standardizeRow(row, params.means, params.stds);
    return z.map((v, j) => v * params.weights[j]);
  });
}

/** Probabilities for a batch (calibrated). */
export function predictBatch(X: readonly (readonly (number | null)[])[], params: ModelParams): number[] {
  const intercept = params.bias + params.prior_correction;
  return X.map(row => {
    const z = standardizeRow(row, params.means, params.stds);
    let s = intercept;
    for (let j = 0; j < z.length; j++) s += z[j] * params.weights[j];
    return applyCalibration(params.calibration, s, sigmoid(s));
  });
}

/** Uncalibrated logits for a batch (used to fit calibration on a holdout slice). */
export function logitBatch(X: readonly (readonly (number | null)[])[], params: Pick<ModelParams, 'means' | 'stds' | 'weights' | 'bias' | 'prior_correction'>): number[] {
  const intercept = params.bias + params.prior_correction;
  return X.map(row => {
    const z = standardizeRow(row, params.means, params.stds);
    let s = intercept;
    for (let j = 0; j < z.length; j++) s += z[j] * params.weights[j];
    return s;
  });
}
