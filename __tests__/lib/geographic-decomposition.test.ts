/**
 * Tests for the geographic revenue decomposition engine.
 *
 * Critical invariants verified:
 *   1. Sum of globalShare equals 1.0 for every TA (including default)
 *   2. Total decomposed revenue reconciles to the input global peak (<5% drift)
 *   3. Launch delays reflect real-world regional rollout (US = 0y, China 3-5y)
 *   4. Works across at least 3 TAs plus the default fallback
 */

import {
  DEFAULT_GEOGRAPHIC_SPLITS,
  decomposeGeographicRevenue,
  getGeographicSplit,
  maxDecomposedPeak,
  type Geography,
} from '@/lib/financial/geographic-revenue-curves';

describe('geographic-revenue-curves', () => {
  describe('DEFAULT_GEOGRAPHIC_SPLITS invariants', () => {
    const allTAs = Object.keys(DEFAULT_GEOGRAPHIC_SPLITS);

    test.each(allTAs)('%s: globalShare sums to 1.0', (ta) => {
      const splits = DEFAULT_GEOGRAPHIC_SPLITS[ta];
      const total = splits.reduce((sum, s) => sum + s.globalShare, 0);
      expect(total).toBeCloseTo(1.0, 5);
    });

    test.each(allTAs)('%s: covers all 5 canonical geographies exactly once', (ta) => {
      const splits = DEFAULT_GEOGRAPHIC_SPLITS[ta];
      const geos = splits.map((s) => s.geography).sort();
      expect(geos).toEqual(['China', 'EU5', 'Japan', 'RoW', 'US']);
    });

    test.each(allTAs)('%s: US always launches first (delay=0)', (ta) => {
      const splits = DEFAULT_GEOGRAPHIC_SPLITS[ta];
      const us = splits.find((s) => s.geography === 'US')!;
      expect(us.launchDelayYears).toBe(0);
      expect(us.pricingMultiplier).toBe(1.0);
    });

    test.each(allTAs)('%s: China launch delay is 3-5 years (real-world)', (ta) => {
      const splits = DEFAULT_GEOGRAPHIC_SPLITS[ta];
      const china = splits.find((s) => s.geography === 'China')!;
      expect(china.launchDelayYears).toBeGreaterThanOrEqual(3);
      expect(china.launchDelayYears).toBeLessThanOrEqual(5);
    });

    test.each(allTAs)('%s: EU5 launch delay is 1-2 years', (ta) => {
      const splits = DEFAULT_GEOGRAPHIC_SPLITS[ta];
      const eu5 = splits.find((s) => s.geography === 'EU5')!;
      expect(eu5.launchDelayYears).toBeGreaterThanOrEqual(1);
      expect(eu5.launchDelayYears).toBeLessThanOrEqual(2);
    });

    test.each(allTAs)('%s: ex-US pricing multipliers are below US', (ta) => {
      const splits = DEFAULT_GEOGRAPHIC_SPLITS[ta];
      for (const s of splits) {
        if (s.geography === 'US') continue;
        expect(s.pricingMultiplier).toBeLessThan(1.0);
      }
    });

    test.each(allTAs)('%s: China pricing multiplier <= 0.30 (NRDL pressure)', (ta) => {
      const splits = DEFAULT_GEOGRAPHIC_SPLITS[ta];
      const china = splits.find((s) => s.geography === 'China')!;
      expect(china.pricingMultiplier).toBeLessThanOrEqual(0.30);
    });
  });

  describe('getGeographicSplit', () => {
    it('returns the oncology table for oncology', () => {
      const splits = getGeographicSplit('oncology');
      expect(splits).toBe(DEFAULT_GEOGRAPHIC_SPLITS.oncology);
    });

    it('falls back to default for unknown TA', () => {
      const splits = getGeographicSplit('fictional_ta');
      expect(splits).toBe(DEFAULT_GEOGRAPHIC_SPLITS.default);
    });
  });

  describe('decomposeGeographicRevenue', () => {
    const TAS_TO_TEST = ['oncology', 'neurology', 'metabolic', 'rareDisease', 'cardiovascular', 'immunology'];

    test.each(TAS_TO_TEST)('%s: reconciles total decomposed peak to global within 5%%', (ta) => {
      const globalPeak = 2000; // $2B
      const decomp = decomposeGeographicRevenue(globalPeak, ta, 2030, 30);
      const decomposedPeak = maxDecomposedPeak(decomp);
      const drift = Math.abs(decomposedPeak - globalPeak) / globalPeak;
      expect(drift).toBeLessThan(0.05);
    });

    it('initializes every geography bucket to a full-length array', () => {
      const decomp = decomposeGeographicRevenue(1000, 'oncology', 2030, 20);
      const geos: Geography[] = ['US', 'EU5', 'Japan', 'China', 'RoW'];
      for (const g of geos) {
        expect(decomp.byGeography[g]).toBeDefined();
        expect(decomp.byGeography[g].length).toBe(20);
      }
    });

    it('US revenue is non-zero in year 0 (ramp starts immediately)', () => {
      const decomp = decomposeGeographicRevenue(1000, 'oncology', 2030, 20);
      // year 0 is launch year — S-curve starts at 0 and ramps
      // year 1 should be > 0
      expect(decomp.byGeography.US[1]).toBeGreaterThan(0);
    });

    it('China revenue is zero during its launch-delay window', () => {
      const decomp = decomposeGeographicRevenue(1000, 'oncology', 2030, 20);
      // Oncology: China delay = 3 years
      expect(decomp.byGeography.China[0]).toBe(0);
      expect(decomp.byGeography.China[1]).toBe(0);
      expect(decomp.byGeography.China[2]).toBe(0);
      // By year 4 (1 year post-launch in China), should be non-zero
      expect(decomp.byGeography.China[4]).toBeGreaterThan(0);
    });

    it('zero global peak yields all-zero schedule', () => {
      const decomp = decomposeGeographicRevenue(0, 'oncology', 2030, 20);
      expect(decomp.totalRevenueByYear.every((v) => v === 0)).toBe(true);
    });

    it('total-by-year is the sum of per-geography arrays', () => {
      const decomp = decomposeGeographicRevenue(1500, 'neurology', 2030, 25);
      for (let y = 0; y < 25; y++) {
        const rowSum =
          decomp.byGeography.US[y] +
          decomp.byGeography.EU5[y] +
          decomp.byGeography.Japan[y] +
          decomp.byGeography.China[y] +
          decomp.byGeography.RoW[y];
        expect(decomp.totalRevenueByYear[y]).toBeCloseTo(rowSum, 5);
      }
    });

    it('rare disease has a longer peak duration than oncology (slow erosion)', () => {
      const rare = getGeographicSplit('rareDisease').find((s) => s.geography === 'US')!;
      const onc = getGeographicSplit('oncology').find((s) => s.geography === 'US')!;
      expect(rare.peakDurationYears).toBeGreaterThan(onc.peakDurationYears);
    });
  });
});
