/**
 * Search & Evaluation scoring v5 — additive boosted-stump model (pure TypeScript).
 *
 * A generalized additive model fitted by gradient boosting with depth-1 trees (stumps):
 *
 *   logit(x) = bias + Σ_j f_j(x_j)
 *
 * where every f_j is a piecewise-constant function of ONE feature, stored as a lookup table over
 * fixed bins (training quantiles) plus a dedicated "missing" bin. Because each stump touches one
 * feature, the model stays additive: contribution_j = f_j(x_j) exactly, so the score waterfall
 * contract of model.ts (intercept + Σ contribution = logit) holds unchanged.
 *
 * Why not more logistic regression: the strongest signals are non-linear (asset age is U-shaped,
 * runway matters only when short) and missingness itself is informative (a company with filed
 * financials is listed). Mean imputation in the linear model erases both. Scoring is a table
 * lookup, deterministic and cheap in the existing TS scorer.
 *
 * Training: Newton boosting on the class-weighted log loss, shrinkage, L2 on leaf values, a
 * minimum hessian per leaf, and the number of rounds chosen on a later time slice (early
 * stopping on weighted log loss, never on the ranking metrics the activation gate reads).
 */

export interface GamParams {
  /** Bin upper edges per feature (ascending); bin k holds values <= edges[k], last bin is > all edges. */
  edges: number[][];
  /** Table value per feature per bin (length edges[j].length + 1). */
  values: number[][];
  /** Table value for a missing input, per feature. */
  missing: number[];
}

export interface GamTrainOptions {
  maxRounds?: number;
  learningRate?: number;
  /** L2 penalty on leaf values (Newton denominator). */
  lambda?: number;
  /** Minimum hessian mass on each side of a split (absolute; overrides minChildWeightShare). */
  minChildHessian?: number;
  /**
   * Minimum hessian mass per side as a share of the total class-weighted row weight. Default
   * 0.000625 (v5). v6 uses 0.01: with ~150 positive programs per test year, smaller leaves fit
   * single programs' monthly rows and the ranking lost out of sample.
   */
  minChildWeightShare?: number;
  /** Quantile bins per feature (excluding the missing bin). */
  maxBins?: number;
  /** Positive-class weight; 'balanced' = negative weight / positive weight. */
  classWeightPos?: number | 'balanced';
  /** Per-row weights (e.g. 1 / sampling rate for subsampled negatives). Default 1. */
  rowWeights?: readonly number[];
  /** Validation slice for early stopping. */
  valid?: { X: readonly (readonly (number | null)[])[]; y: readonly number[]; w?: readonly number[] };
  /** Stop after this many rounds without a validation improvement. */
  patience?: number;
  /** Exact number of rounds (refit with a known count; disables early stopping). */
  rounds?: number;
}

export interface GamFit {
  params: GamParams;
  bias: number;
  rounds: number;
  bestValidLoss: number | null;
  classWeightPos: number;
  /** Validation loss per round (for diagnostics). */
  validCurve: number[];
}

/** v5 leaf floor: 0.25 % of the weight mass × 0.25. */
export const DEFAULT_MIN_CHILD_WEIGHT_SHARE = 0.0025 * 0.25;

const isMissing = (v: number | null | undefined): boolean => v === null || v === undefined || !Number.isFinite(v);

/** Quantile edges over non-missing values; duplicates collapsed, so binary features get one edge. */
export function quantileEdges(values: readonly (number | null)[], maxBins: number): number[] {
  const xs = values.filter((v): v is number => !isMissing(v)).sort((a, b) => a - b);
  if (xs.length === 0) return [];
  const distinct = Array.from(new Set(xs));
  if (distinct.length <= maxBins) return distinct.slice(0, -1);
  const edges: number[] = [];
  for (let k = 1; k < maxBins; k++) {
    const e = xs[Math.min(xs.length - 1, Math.floor((k * xs.length) / maxBins))];
    if (edges.length === 0 || e > edges[edges.length - 1]) edges.push(e);
  }
  // The top edge must leave something above it.
  while (edges.length && edges[edges.length - 1] >= xs[xs.length - 1]) edges.pop();
  return edges;
}

/** Bin index for a value: k = first edge >= v; edges.length when above all. -1 = missing. */
export function binOf(edges: readonly number[], v: number | null | undefined): number {
  if (isMissing(v)) return -1;
  let lo = 0;
  let hi = edges.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((v as number) <= edges[mid]) hi = mid; else lo = mid + 1;
  }
  return lo;
}

/** f_j(x_j) for one feature. */
export function gamTerm(params: GamParams, j: number, v: number | null | undefined): number {
  const b = binOf(params.edges[j], v);
  return b < 0 ? params.missing[j] : params.values[j][b];
}

/** Σ_j f_j(x_j) (without the bias). */
export function gamSum(params: GamParams, row: readonly (number | null)[]): number {
  let s = 0;
  for (let j = 0; j < params.edges.length; j++) s += gamTerm(params, j, row[j]);
  return s;
}

function sigmoid(z: number): number {
  if (z > 35) return 1;
  if (z < -35) return 0;
  return 1 / (1 + Math.exp(-z));
}

function weightedLogLoss(z: readonly number[], y: readonly number[], w: readonly number[]): number {
  let s = 0;
  let tw = 0;
  for (let i = 0; i < z.length; i++) {
    const p = Math.min(1 - 1e-12, Math.max(1e-12, sigmoid(z[i])));
    s += w[i] * (y[i] === 1 ? -Math.log(p) : -Math.log(1 - p));
    tw += w[i];
  }
  return tw > 0 ? s / tw : 0;
}

/**
 * Fit the additive model. Deterministic: no sampling, ties broken by feature index then bin.
 */
export function trainGam(X: readonly (readonly (number | null)[])[], y: readonly number[], opts: GamTrainOptions = {}): GamFit {
  const n = X.length;
  if (n === 0) throw new Error('trainGam: empty training set');
  if (y.length !== n) throw new Error('trainGam: X and y differ in length');
  const d = X[0].length;
  const maxRounds = opts.rounds ?? opts.maxRounds ?? 400;
  const lr = opts.learningRate ?? 0.1;
  const lambda = opts.lambda ?? 1;
  const maxBins = opts.maxBins ?? 24;
  const patience = opts.patience ?? 40;
  const rowW = opts.rowWeights ?? new Array<number>(n).fill(1);

  let wPosSum = 0;
  let wNegSum = 0;
  for (let i = 0; i < n; i++) { if (y[i] === 1) wPosSum += rowW[i]; else wNegSum += rowW[i]; }
  const cwPos = opts.classWeightPos === 'balanced' || opts.classWeightPos === undefined
    ? (wPosSum > 0 ? wNegSum / wPosSum : 1)
    : opts.classWeightPos;
  const w = y.map((v, i) => rowW[i] * (v === 1 ? cwPos : 1));
  let wSum = 0;
  for (const v of w) wSum += v;
  // Hessian floor relative to the data mass, so the setting does not depend on row counts.
  const minChild = opts.minChildHessian ?? wSum * (opts.minChildWeightShare ?? DEFAULT_MIN_CHILD_WEIGHT_SHARE);

  // Bin every cell once.
  const edges: number[][] = [];
  const bins: Int16Array[] = [];
  for (let j = 0; j < d; j++) {
    const col = X.map(r => r[j]);
    const e = quantileEdges(col, maxBins);
    edges.push(e);
    const b = new Int16Array(n);
    for (let i = 0; i < n; i++) b[i] = binOf(e, col[i]);
    bins.push(b);
  }
  const values = edges.map(e => new Array<number>(e.length + 1).fill(0));
  const missing = new Array<number>(d).fill(0);

  // Initial bias = weighted log-odds.
  let wp = 0;
  for (let i = 0; i < n; i++) if (y[i] === 1) wp += w[i];
  const p0 = Math.min(1 - 1e-9, Math.max(1e-9, wp / wSum));
  const bias = Math.log(p0 / (1 - p0));
  const z = new Float64Array(n).fill(bias);

  // Validation state.
  const valid = opts.valid;
  let vz: Float64Array | null = null;
  let vBins: Int16Array[] | null = null;
  let vw: number[] | null = null;
  if (valid && valid.X.length && opts.rounds === undefined) {
    vz = new Float64Array(valid.X.length).fill(bias);
    vBins = edges.map((e, j) => {
      const b = new Int16Array(valid.X.length);
      for (let i = 0; i < valid.X.length; i++) b[i] = binOf(e, valid.X[i][j]);
      return b;
    });
    const vrw = valid.w ?? new Array<number>(valid.X.length).fill(1);
    vw = valid.y.map((v, i) => vrw[i] * (v === 1 ? cwPos : 1));
  }
  const validCurve: number[] = [];
  let best = Infinity;
  let bestRound = 0;
  let snapshot: { values: number[][]; missing: number[] } | null = null;

  const g = new Float64Array(n);
  const h = new Float64Array(n);
  let rounds = 0;
  for (let round = 0; round < maxRounds; round++) {
    for (let i = 0; i < n; i++) {
      const p = sigmoid(z[i]);
      g[i] = (p - y[i]) * w[i];
      h[i] = Math.max(1e-12, p * (1 - p) * w[i]);
    }
    let bestGain = 0;
    let bestJ = -1;
    let bestSplit = -1;
    let bestMissingLeft = false;
    let bestLeft = 0;
    let bestRight = 0;
    for (let j = 0; j < d; j++) {
      const nb = edges[j].length + 1;
      if (nb < 2 && !hasMissing(bins[j])) continue;
      const G = new Float64Array(nb);
      const H = new Float64Array(nb);
      let Gm = 0;
      let Hm = 0;
      const bj = bins[j];
      for (let i = 0; i < n; i++) {
        const b = bj[i];
        if (b < 0) { Gm += g[i]; Hm += h[i]; } else { G[b] += g[i]; H[b] += h[i]; }
      }
      let Gt = Gm;
      let Ht = Hm;
      for (let b = 0; b < nb; b++) { Gt += G[b]; Ht += H[b]; }
      const parent = (Gt * Gt) / (Ht + lambda);
      // Splits: bins [0..k] vs (k..], missing joins either side; plus missing vs all present.
      let GL = 0;
      let HL = 0;
      for (let k = -1; k < nb - 1; k++) {
        if (k >= 0) { GL += G[k]; HL += H[k]; }
        for (const mLeft of [false, true]) {
          if (k === -1 && !mLeft) continue;
          const gl = GL + (mLeft ? Gm : 0);
          const hl = HL + (mLeft ? Hm : 0);
          const gr = Gt - gl;
          const hr = Ht - hl;
          if (hl < minChild || hr < minChild) continue;
          const gain = (gl * gl) / (hl + lambda) + (gr * gr) / (hr + lambda) - parent;
          if (gain > bestGain + 1e-12) {
            bestGain = gain; bestJ = j; bestSplit = k; bestMissingLeft = mLeft;
            bestLeft = -gl / (hl + lambda); bestRight = -gr / (hr + lambda);
          }
        }
      }
    }
    if (bestJ < 0) break;
    rounds = round + 1;
    const lv = lr * bestLeft;
    const rv = lr * bestRight;
    const vals = values[bestJ];
    for (let b = 0; b < vals.length; b++) vals[b] += b <= bestSplit ? lv : rv;
    missing[bestJ] += bestMissingLeft ? lv : rv;
    const bj = bins[bestJ];
    for (let i = 0; i < n; i++) {
      const b = bj[i];
      z[i] += b < 0 ? (bestMissingLeft ? lv : rv) : b <= bestSplit ? lv : rv;
    }
    if (vz && vBins && vw && valid) {
      const vb = vBins[bestJ];
      for (let i = 0; i < vz.length; i++) {
        const b = vb[i];
        vz[i] += b < 0 ? (bestMissingLeft ? lv : rv) : b <= bestSplit ? lv : rv;
      }
      const loss = weightedLogLoss(Array.from(vz), valid.y, vw);
      validCurve.push(loss);
      if (loss < best - 1e-9) {
        best = loss; bestRound = rounds;
        snapshot = { values: values.map(v => v.slice()), missing: missing.slice() };
      } else if (rounds - bestRound >= patience) {
        break;
      }
    }
  }
  const finalValues = snapshot ? snapshot.values : values;
  const finalMissing = snapshot ? snapshot.missing : missing;
  return {
    params: { edges, values: finalValues.map(v => v.map(round6)), missing: finalMissing.map(round6) },
    bias: round6(bias),
    rounds: snapshot ? bestRound : rounds,
    bestValidLoss: snapshot ? best : null,
    classWeightPos: cwPos,
    validCurve,
  };
}

function hasMissing(b: Int16Array): boolean {
  for (let i = 0; i < b.length; i++) if (b[i] < 0) return true;
  return false;
}

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
