import {
  seedableRandom,
  sampleNormal,
  sampleTriangular,
  sampleBeta,
  sampleLognormal,
  percentile,
  buildHistogram,
} from '../../lib/financial/distributions';

// ---------------------------------------------------------------------------
// seedableRandom
// ---------------------------------------------------------------------------
describe('seedableRandom', () => {
  it('produces identical sequences from the same seed', () => {
    const rng1 = seedableRandom(42);
    const rng2 = seedableRandom(42);

    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());

    expect(seq1).toEqual(seq2);
  });

  it('produces different sequences from different seeds', () => {
    const rng1 = seedableRandom(42);
    const rng2 = seedableRandom(99);

    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());

    expect(seq1).not.toEqual(seq2);
  });

  it('returns values in [0, 1)', () => {
    const rng = seedableRandom(123);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('has reasonable uniformity (no extreme bias)', () => {
    const rng = seedableRandom(7);
    let belowHalf = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      if (rng() < 0.5) belowHalf++;
    }
    // Expect roughly half below 0.5 (within 3%)
    expect(belowHalf / n).toBeGreaterThan(0.47);
    expect(belowHalf / n).toBeLessThan(0.53);
  });
});

// ---------------------------------------------------------------------------
// sampleNormal
// ---------------------------------------------------------------------------
describe('sampleNormal', () => {
  it('converges to mean=0, stddev=1 for standard normal over 10,000 samples', () => {
    const rng = seedableRandom(1);
    const n = 10_000;
    const samples: number[] = [];

    for (let i = 0; i < n; i++) {
      samples.push(sampleNormal(0, 1, rng));
    }

    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const variance =
      samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);

    expect(mean).toBeGreaterThan(-0.05);
    expect(mean).toBeLessThan(0.05);
    expect(stddev).toBeGreaterThan(0.95);
    expect(stddev).toBeLessThan(1.05);
  });

  it('shifts mean correctly', () => {
    const rng = seedableRandom(2);
    const n = 10_000;
    const targetMean = 100;
    const samples: number[] = [];

    for (let i = 0; i < n; i++) {
      samples.push(sampleNormal(targetMean, 1, rng));
    }

    const mean = samples.reduce((a, b) => a + b, 0) / n;
    expect(mean).toBeGreaterThan(targetMean - 0.05);
    expect(mean).toBeLessThan(targetMean + 0.05);
  });

  it('scales stddev correctly', () => {
    const rng = seedableRandom(3);
    const n = 10_000;
    const targetStdDev = 5;
    const samples: number[] = [];

    for (let i = 0; i < n; i++) {
      samples.push(sampleNormal(0, targetStdDev, rng));
    }

    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const variance =
      samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);

    expect(stddev).toBeGreaterThan(targetStdDev - 0.25);
    expect(stddev).toBeLessThan(targetStdDev + 0.25);
  });

  it('is deterministic with the same rng seed', () => {
    const samples1 = Array.from({ length: 50 }, () =>
      sampleNormal(0, 1, seedableRandom(42)),
    );
    // Each call creates a fresh rng with seed 42 so the first sample is always the same
    expect(new Set(samples1).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// sampleTriangular
// ---------------------------------------------------------------------------
describe('sampleTriangular', () => {
  it('produces values within [min, max]', () => {
    const rng = seedableRandom(10);
    for (let i = 0; i < 5_000; i++) {
      const v = sampleTriangular(1, 5, 10, rng);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it('returns mode when min >= max (degenerate case)', () => {
    const rng = seedableRandom(11);
    expect(sampleTriangular(5, 3, 5, rng)).toBe(3);
    expect(sampleTriangular(10, 7, 5, rng)).toBe(7);
  });

  it('has mean near (min + mode + max) / 3', () => {
    const rng = seedableRandom(12);
    const min = 2;
    const mode = 5;
    const max = 8;
    const expectedMean = (min + mode + max) / 3;
    const n = 10_000;
    let sum = 0;

    for (let i = 0; i < n; i++) {
      sum += sampleTriangular(min, mode, max, rng);
    }

    const mean = sum / n;
    expect(mean).toBeGreaterThan(expectedMean - 0.1);
    expect(mean).toBeLessThan(expectedMean + 0.1);
  });
});

// ---------------------------------------------------------------------------
// sampleBeta
// ---------------------------------------------------------------------------
describe('sampleBeta', () => {
  it('produces values in [0, 1]', () => {
    const rng = seedableRandom(20);
    for (let i = 0; i < 5_000; i++) {
      const v = sampleBeta(2, 5, rng);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('has mean near alpha / (alpha + beta) for alpha=2, beta=5', () => {
    const rng = seedableRandom(21);
    const alpha = 2;
    const beta = 5;
    const expectedMean = alpha / (alpha + beta);
    const n = 10_000;
    let sum = 0;

    for (let i = 0; i < n; i++) {
      sum += sampleBeta(alpha, beta, rng);
    }

    const mean = sum / n;
    expect(mean).toBeGreaterThan(expectedMean - 0.02);
    expect(mean).toBeLessThan(expectedMean + 0.02);
  });

  it('handles shape parameters < 1 (U-shaped distribution)', () => {
    const rng = seedableRandom(22);
    const n = 5_000;
    const samples: number[] = [];

    for (let i = 0; i < n; i++) {
      samples.push(sampleBeta(0.5, 0.5, rng));
    }

    // All values must be in [0, 1]
    for (const v of samples) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }

    // Symmetric beta(0.5, 0.5) should have mean near 0.5
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  it('handles shape parameters > 1 (bell-shaped distribution)', () => {
    const rng = seedableRandom(23);
    const alpha = 5;
    const beta = 5;
    const expectedMean = alpha / (alpha + beta); // 0.5
    const n = 10_000;
    let sum = 0;

    for (let i = 0; i < n; i++) {
      sum += sampleBeta(alpha, beta, rng);
    }

    const mean = sum / n;
    expect(mean).toBeGreaterThan(expectedMean - 0.02);
    expect(mean).toBeLessThan(expectedMean + 0.02);
  });

  it('is skewed right when alpha < beta', () => {
    const rng = seedableRandom(24);
    const n = 10_000;
    let sum = 0;

    for (let i = 0; i < n; i++) {
      sum += sampleBeta(1, 5, rng);
    }

    const mean = sum / n;
    // alpha=1, beta=5 => mean = 1/6 ~ 0.167
    expect(mean).toBeLessThan(0.25);
  });
});

// ---------------------------------------------------------------------------
// sampleLognormal
// ---------------------------------------------------------------------------
describe('sampleLognormal', () => {
  it('produces only positive values', () => {
    const rng = seedableRandom(30);
    for (let i = 0; i < 5_000; i++) {
      const v = sampleLognormal(0, 1, rng);
      expect(v).toBeGreaterThan(0);
    }
  });

  it('has mean near exp(mu + sigma^2 / 2)', () => {
    const rng = seedableRandom(31);
    const mu = 0;
    const sigma = 0.5;
    const expectedMean = Math.exp(mu + (sigma * sigma) / 2);
    const n = 10_000;
    let sum = 0;

    for (let i = 0; i < n; i++) {
      sum += sampleLognormal(mu, sigma, rng);
    }

    const mean = sum / n;
    expect(mean).toBeGreaterThan(expectedMean - 0.1);
    expect(mean).toBeLessThan(expectedMean + 0.1);
  });

  it('shifts distribution when mu changes', () => {
    const rng1 = seedableRandom(32);
    const rng2 = seedableRandom(33);
    const n = 5_000;

    let sum1 = 0;
    let sum2 = 0;
    for (let i = 0; i < n; i++) {
      sum1 += sampleLognormal(0, 0.5, rng1);
      sum2 += sampleLognormal(1, 0.5, rng2);
    }

    // Higher mu should produce higher mean
    expect(sum2 / n).toBeGreaterThan(sum1 / n);
  });
});

// ---------------------------------------------------------------------------
// percentile
// ---------------------------------------------------------------------------
describe('percentile', () => {
  it('returns 0 for an empty array', () => {
    expect(percentile([], 50)).toBe(0);
  });

  it('returns the only element for a single-element array', () => {
    expect(percentile([42], 0)).toBe(42);
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 100)).toBe(42);
  });

  it('returns min at p=0 and max at p=100', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 100)).toBe(10);
  });

  it('computes median (p=50) correctly for odd-length array', () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 50)).toBe(3);
  });

  it('interpolates median for even-length array', () => {
    const sorted = [1, 2, 3, 4];
    // index = 0.5 * 3 = 1.5 => interpolation between 2 and 3 => 2.5
    expect(percentile(sorted, 50)).toBe(2.5);
  });

  it('handles all same values', () => {
    const sorted = [7, 7, 7, 7, 7];
    expect(percentile(sorted, 0)).toBe(7);
    expect(percentile(sorted, 25)).toBe(7);
    expect(percentile(sorted, 50)).toBe(7);
    expect(percentile(sorted, 75)).toBe(7);
    expect(percentile(sorted, 100)).toBe(7);
  });

  it('computes known percentiles correctly', () => {
    // 1..100 sorted
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    // p=25 => index = 0.25 * 99 = 24.75 => 25 * 0.25 + 26 * 0.75 = 25.75
    expect(percentile(sorted, 25)).toBeCloseTo(25.75, 5);
    // p=75 => index = 0.75 * 99 = 74.25 => 75 * 0.75 + 76 * 0.25 = 75.25
    expect(percentile(sorted, 75)).toBeCloseTo(75.25, 5);
  });

  it('handles two-element array interpolation', () => {
    const sorted = [10, 20];
    expect(percentile(sorted, 0)).toBe(10);
    expect(percentile(sorted, 50)).toBe(15);
    expect(percentile(sorted, 100)).toBe(20);
    expect(percentile(sorted, 25)).toBe(12.5);
  });
});

// ---------------------------------------------------------------------------
// buildHistogram
// ---------------------------------------------------------------------------
describe('buildHistogram', () => {
  it('returns empty array for empty input', () => {
    expect(buildHistogram([])).toEqual([]);
  });

  it('returns a single bin when all values are identical', () => {
    const hist = buildHistogram([5, 5, 5, 5]);
    expect(hist).toHaveLength(1);
    expect(hist[0].binStart).toBe(5);
    expect(hist[0].binEnd).toBe(5);
    expect(hist[0].count).toBe(4);
  });

  it('creates the requested number of bins', () => {
    const values = Array.from({ length: 100 }, (_, i) => i);
    const hist = buildHistogram(values, 10);
    expect(hist).toHaveLength(10);
  });

  it('accounts for all values (total count equals input length)', () => {
    const rng = seedableRandom(50);
    const values = Array.from({ length: 500 }, () => sampleNormal(0, 1, rng));
    const hist = buildHistogram(values, 20);

    const totalCount = hist.reduce((sum, bin) => sum + bin.count, 0);
    expect(totalCount).toBe(500);
  });

  it('uses 30 bins by default', () => {
    const values = Array.from({ length: 100 }, (_, i) => i);
    const hist = buildHistogram(values);
    expect(hist).toHaveLength(30);
  });

  it('bins cover the full range from min to max', () => {
    const values = [1, 5, 10, 15, 20];
    const hist = buildHistogram(values, 5);

    expect(hist[0].binStart).toBe(1);
    expect(hist[hist.length - 1].binEnd).toBeCloseTo(20, 10);
  });

  it('places the maximum value in the last bin', () => {
    const values = [0, 1, 2, 3, 4, 5];
    const hist = buildHistogram(values, 5);

    const lastBin = hist[hist.length - 1];
    expect(lastBin.count).toBeGreaterThanOrEqual(1);
  });

  it('each bin has non-negative count', () => {
    const rng = seedableRandom(51);
    const values = Array.from({ length: 1000 }, () =>
      sampleNormal(50, 10, rng),
    );
    const hist = buildHistogram(values, 25);

    for (const bin of hist) {
      expect(bin.count).toBeGreaterThanOrEqual(0);
      expect(bin.binEnd).toBeGreaterThan(bin.binStart);
    }
  });
});
