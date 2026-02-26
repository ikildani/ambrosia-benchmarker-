/**
 * Statistical distribution utilities for Monte Carlo simulation.
 *
 * Pure TypeScript — zero external dependencies.
 * Every sampling function accepts a seeded PRNG so simulations are
 * deterministic and reproducible.
 */

// ---------------------------------------------------------------------------
// Seeded PRNG (Mulberry32)
// ---------------------------------------------------------------------------

/**
 * Returns a deterministic pseudo-random number generator seeded with `seed`.
 * Algorithm: Mulberry32 — a fast 32-bit PRNG with excellent statistical
 * properties for non-cryptographic use.
 *
 * @returns A function that, on each call, returns a float in [0, 1).
 */
export function seedableRandom(seed: number): () => number {
  let s = seed | 0; // coerce to 32-bit integer
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Continuous distributions
// ---------------------------------------------------------------------------

/**
 * Sample from a normal (Gaussian) distribution using the Box-Muller transform.
 *
 * @param mean   - Centre of the distribution.
 * @param stdDev - Standard deviation (must be > 0).
 * @param rng    - A () => number PRNG returning values in [0, 1).
 */
export function sampleNormal(
  mean: number,
  stdDev: number,
  rng: () => number,
): number {
  // Box-Muller: generate two uniform samples → one standard-normal variate.
  let u1 = rng();
  let u2 = rng();

  // Guard against the (astronomically rare) u1 === 0 which would give -Infinity.
  while (u1 === 0) u1 = rng();

  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z;
}

/**
 * Sample from a triangular distribution.
 *
 * @param min  - Absolute minimum value.
 * @param mode - Most likely value (peak of the triangle).
 * @param max  - Absolute maximum value.
 * @param rng  - PRNG.
 */
export function sampleTriangular(
  min: number,
  mode: number,
  max: number,
  rng: () => number,
): number {
  if (min >= max) return mode;
  const u = rng();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

/**
 * Sample from a Beta distribution using the Jöhnk algorithm (for small
 * alpha/beta) or the transformation method via Gamma variates.
 *
 * @param alpha - Shape parameter α (must be > 0).
 * @param beta  - Shape parameter β (must be > 0).
 * @param rng   - PRNG.
 */
export function sampleBeta(
  alpha: number,
  beta: number,
  rng: () => number,
): number {
  const ga = sampleGamma(alpha, 1, rng);
  const gb = sampleGamma(beta, 1, rng);
  if (ga + gb === 0) return 0.5; // degenerate edge case
  return ga / (ga + gb);
}

/**
 * Sample from a Gamma distribution using the Marsaglia & Tsang method.
 * Internal helper for sampleBeta.
 */
function sampleGamma(
  shape: number,
  scale: number,
  rng: () => number,
): number {
  // For shape < 1, use the relation: Gamma(shape) = Gamma(shape+1) * U^(1/shape)
  if (shape < 1) {
    const u = rng() || 1e-30; // avoid 0
    return sampleGamma(shape + 1, scale, rng) * Math.pow(u, 1 / shape);
  }

  // Marsaglia & Tsang's method for shape >= 1
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  for (;;) {
    let x: number;
    let v: number;

    do {
      x = sampleNormal(0, 1, rng);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = rng() || 1e-30;

    // Squeeze test (fast accept)
    if (u < 1 - 0.0331 * (x * x) * (x * x)) {
      return d * v * scale;
    }

    // Full acceptance check
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v * scale;
    }
  }
}

/**
 * Sample from a log-normal distribution.
 *
 * The log-normal is parameterised here by mu and sigma of the underlying
 * normal distribution: if X ~ N(mu, sigma²), then exp(X) ~ LogNormal.
 *
 * @param mu    - Mean of the underlying normal.
 * @param sigma - Std-dev of the underlying normal (must be > 0).
 * @param rng   - PRNG.
 */
export function sampleLognormal(
  mu: number,
  sigma: number,
  rng: () => number,
): number {
  return Math.exp(sampleNormal(mu, sigma, rng));
}

// ---------------------------------------------------------------------------
// Descriptive statistics helpers
// ---------------------------------------------------------------------------

/**
 * Extract the p-th percentile from a **pre-sorted** (ascending) array.
 * Uses linear interpolation between adjacent ranks.
 *
 * @param sortedArray - Array sorted in ascending order.
 * @param p           - Percentile in [0, 100].
 */
export function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;
  if (sortedArray.length === 1) return sortedArray[0];

  const index = (p / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sortedArray[lower];

  const fraction = index - lower;
  return sortedArray[lower] * (1 - fraction) + sortedArray[upper] * fraction;
}

/**
 * Build a histogram from an array of values.
 *
 * @param values - Raw (unsorted) data.
 * @param bins   - Number of equal-width bins (default 30).
 * @returns Array of `{ binStart, binEnd, count }` objects.
 */
export function buildHistogram(
  values: number[],
  bins: number = 30,
): { binStart: number; binEnd: number; count: number }[] {
  if (values.length === 0) return [];

  const min = values.reduce((a, b) => Math.min(a, b), Infinity);
  const max = values.reduce((a, b) => Math.max(a, b), -Infinity);

  // If all values are identical, return a single bin.
  if (min === max) {
    return [{ binStart: min, binEnd: max, count: values.length }];
  }

  const binWidth = (max - min) / bins;
  const histogram: { binStart: number; binEnd: number; count: number }[] = [];

  for (let i = 0; i < bins; i++) {
    histogram.push({
      binStart: min + i * binWidth,
      binEnd: min + (i + 1) * binWidth,
      count: 0,
    });
  }

  for (const v of values) {
    let idx = Math.floor((v - min) / binWidth);
    // Clamp the maximum value into the last bin.
    if (idx >= bins) idx = bins - 1;
    histogram[idx].count++;
  }

  return histogram;
}
