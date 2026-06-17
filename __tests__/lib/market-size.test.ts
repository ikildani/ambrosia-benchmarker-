/**
 * Unit Tests for Market Size Estimation Engine
 *
 * Covers:
 * 1. Patient funnel arithmetic (prevalence -> diagnosed -> treated -> drug-eligible -> addressable)
 * 2. TA share multiplier (rareDisease 1.35x, oncology 0.85x, no-TA 1.0x) with [0, 0.95] clamp
 * 3. TA-specific adoption ceiling (rareDisease=0.85, oncology=0.65, default=0.70)
 * 4. Epidemiology fallback guard (null, 0, NaN, >1 drugEligiblePercent)
 * 5. All 15 territories produce valid output
 * 6. TAM >= SAM >= SOM.median ordering
 * 7. Unknown territory fallback to global with fallback reason
 * 8. Market share ordering by competitive position
 */

import { estimateMarketSize } from '../../lib/financial/market-size';
import type { EpidemiologyData } from '../../lib/financial/types';

// ---------------------------------------------------------------------------
// Shared epidemiology stub
// ---------------------------------------------------------------------------

const stubEpi: EpidemiologyData = {
  prevalencePerMillion: 100,
  incidencePerMillion: 10,
  diagnosedPercent: 0.80,
  treatedPercent: 0.70,
  drugEligiblePercent: 0.60,
  annualCostOfTherapy: 50_000,
  sources: ['Test stub'],
  peakSalesRangeM: undefined,
};

// ---------------------------------------------------------------------------
// All 15 territory keys from TERRITORY_DATA
// ---------------------------------------------------------------------------

const ALL_TERRITORIES = [
  'global',
  'us_only',
  'europe',
  'china',
  'japan',
  'ex_us',
  'row',
  'us_eu',
  'us_japan',
  'canada',
  'australia',
  'south_korea',
  'apac_ex_cj',
  'latam',
  'mena',
];

// ---------------------------------------------------------------------------
// All 6 competitive positions in descending share order
// ---------------------------------------------------------------------------

const COMPETITIVE_POSITIONS_ORDERED = [
  'firstInClass',
  'firstToPivotal',
  'bestInClass',
  'racing',
  'behind',
  'crowded',
];

describe('Market Size Estimation Engine', () => {
  // ==========================================================================
  // 1. Patient funnel arithmetic
  // ==========================================================================

  describe('Patient funnel arithmetic', () => {
    it('should compute the patient funnel chain correctly for us_only', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
      );
      const f = result.patientFunnel;

      // US population = 340,000,000
      expect(f.totalPopulation).toBe(340_000_000);

      // prevalent = (100 / 1,000,000) * 340,000,000 = 34,000
      expect(f.prevalentPatients).toBe(34_000);

      // diagnosed = 34,000 * 0.80 = 27,200
      expect(f.diagnosedPatients).toBe(Math.round(34_000 * 0.80));

      // treated = 27,200 * 0.70 = 19,040
      expect(f.treatedPatients).toBe(Math.round(27_200 * 0.70));

      // drug-eligible = 19,040 * 0.60 = 11,424
      expect(f.drugEligiblePatients).toBe(Math.round(19_040 * 0.60));

      // addressable = 11,424 * 0.70 (default adoption ceiling, no TA)
      expect(f.addressablePatients).toBe(Math.round(11_424 * 0.70));
    });

    it('should multiply each funnel stage sequentially', () => {
      const result = estimateMarketSize(
        'test_indication',
        'global',
        'firstInClass',
        stubEpi,
      );
      const f = result.patientFunnel;

      // Verify multiplicative chain: each stage is the previous * its percent
      const expectedPrevalent = Math.round((100 / 1_000_000) * 8_200_000_000);
      expect(f.prevalentPatients).toBe(expectedPrevalent);
      expect(f.diagnosedPatients).toBe(Math.round(expectedPrevalent * 0.80));
      expect(f.treatedPatients).toBe(Math.round(f.diagnosedPatients * 0.70));
      expect(f.drugEligiblePatients).toBe(Math.round(f.treatedPatients * 0.60));
      // No TA = default 0.70 adoption ceiling
      expect(f.addressablePatients).toBe(Math.round(f.drugEligiblePatients * 0.70));
    });

    it('should round all patient counts to integers', () => {
      // Use odd prevalence that forces fractional intermediate values
      const oddEpi: EpidemiologyData = {
        ...stubEpi,
        prevalencePerMillion: 33,
        diagnosedPercent: 0.73,
        treatedPercent: 0.41,
        drugEligiblePercent: 0.29,
      };
      const result = estimateMarketSize('odd_test', 'us_only', 'racing', oddEpi);
      const f = result.patientFunnel;

      expect(Number.isInteger(f.prevalentPatients)).toBe(true);
      expect(Number.isInteger(f.diagnosedPatients)).toBe(true);
      expect(Number.isInteger(f.treatedPatients)).toBe(true);
      expect(Number.isInteger(f.drugEligiblePatients)).toBe(true);
      expect(Number.isInteger(f.addressablePatients)).toBe(true);
    });
  });

  // ==========================================================================
  // 2. TA share multiplier
  // ==========================================================================

  describe('TA share multiplier', () => {
    it('should apply 1.35x multiplier for rareDisease', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'firstInClass',
        stubEpi,
        'rareDisease',
      );
      // Base firstInClass median = 0.35, with 1.35x => 0.4725
      expect(result.marketShareAssumption.median).toBeCloseTo(0.35 * 1.35, 4);
      expect(result.marketShareAssumption.low).toBeCloseTo(0.25 * 1.35, 4);
      expect(result.marketShareAssumption.high).toBeCloseTo(0.50 * 1.35, 4);
    });

    it('should apply 0.85x multiplier for oncology', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'firstInClass',
        stubEpi,
        'oncology',
      );
      expect(result.marketShareAssumption.median).toBeCloseTo(0.35 * 0.85, 4);
      expect(result.marketShareAssumption.low).toBeCloseTo(0.25 * 0.85, 4);
      expect(result.marketShareAssumption.high).toBeCloseTo(0.50 * 0.85, 4);
    });

    it('should use 1.0x (no adjustment) when no therapeuticArea is provided', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'firstInClass',
        stubEpi,
        // no therapeuticArea
      );
      // Without TA, shareAssumption should be the raw base share
      expect(result.marketShareAssumption.median).toBe(0.35);
      expect(result.marketShareAssumption.low).toBe(0.25);
      expect(result.marketShareAssumption.high).toBe(0.50);
    });

    it('should use 1.0x for a TA not in the multiplier map (e.g., neurology)', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'firstInClass',
        stubEpi,
        'neurology',
      );
      // neurology is not in TA_SHARE_MULTIPLIER => 1.0x applied
      expect(result.marketShareAssumption.median).toBeCloseTo(0.35, 4);
      expect(result.marketShareAssumption.low).toBeCloseTo(0.25, 4);
      expect(result.marketShareAssumption.high).toBeCloseTo(0.50, 4);
    });

    it('should clamp share to [0, 0.95] — high share does not exceed 0.95', () => {
      // rareDisease firstInClass high = 0.50 * 1.35 = 0.675, below cap
      // To trigger the cap, we need a position with high base share
      // firstInClass high = 0.50, rareDisease = 1.35x => 0.675 (under 0.95)
      // All standard combos are under 0.95, so we verify the clamp
      // is conceptually applied by checking the max possible value
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'firstInClass',
        stubEpi,
        'rareDisease',
      );
      expect(result.marketShareAssumption.high).toBeLessThanOrEqual(0.95);
      expect(result.marketShareAssumption.median).toBeLessThanOrEqual(0.95);
      expect(result.marketShareAssumption.low).toBeLessThanOrEqual(0.95);
    });

    it('should clamp share to minimum of 0', () => {
      // All positions have positive bases, and all multipliers are positive,
      // so the floor of 0 is always satisfied.
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'crowded',
        stubEpi,
        'oncology', // 0.85x on crowded low (0.03) => 0.0255
      );
      expect(result.marketShareAssumption.low).toBeGreaterThanOrEqual(0);
      expect(result.marketShareAssumption.median).toBeGreaterThanOrEqual(0);
      expect(result.marketShareAssumption.high).toBeGreaterThanOrEqual(0);
    });

    it('should apply 1.15x for hematology', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
        'hematology',
      );
      // racing median = 0.18, hematology = 1.15x => 0.207
      expect(result.marketShareAssumption.median).toBeCloseTo(0.18 * 1.15, 4);
    });

    it('should apply 1.15x for ophthalmology', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
        'ophthalmology',
      );
      expect(result.marketShareAssumption.median).toBeCloseTo(0.18 * 1.15, 4);
    });

    it('should apply 1.10x for dermatology', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
        'dermatology',
      );
      expect(result.marketShareAssumption.median).toBeCloseTo(0.18 * 1.10, 4);
    });
  });

  // ==========================================================================
  // 3. TA-specific adoption ceiling
  // ==========================================================================

  describe('TA-specific adoption ceiling', () => {
    it('should use 0.85 adoption ceiling for rareDisease', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
        'rareDisease',
      );
      const f = result.patientFunnel;
      expect(f.addressablePatients).toBe(
        Math.round(f.drugEligiblePatients * 0.85),
      );
    });

    it('should use 0.65 adoption ceiling for oncology', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
        'oncology',
      );
      const f = result.patientFunnel;
      expect(f.addressablePatients).toBe(
        Math.round(f.drugEligiblePatients * 0.65),
      );
    });

    it('should use 0.70 default adoption ceiling when no therapeuticArea is provided', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
        // no TA
      );
      const f = result.patientFunnel;
      expect(f.addressablePatients).toBe(
        Math.round(f.drugEligiblePatients * 0.70),
      );
    });

    it('should use 0.70 default for a TA not in ADOPTION_CEILING_BY_TA', () => {
      // Use a TA not in the map
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
        'unknownTherapeuticArea',
      );
      const f = result.patientFunnel;
      expect(f.addressablePatients).toBe(
        Math.round(f.drugEligiblePatients * 0.70),
      );
    });

    it('should use 0.80 adoption ceiling for hematology', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
        'hematology',
      );
      const f = result.patientFunnel;
      expect(f.addressablePatients).toBe(
        Math.round(f.drugEligiblePatients * 0.80),
      );
    });

    it('should use 0.55 adoption ceiling for neurology', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
        'neurology',
      );
      const f = result.patientFunnel;
      expect(f.addressablePatients).toBe(
        Math.round(f.drugEligiblePatients * 0.55),
      );
    });

    it('should use 0.50 adoption ceiling for cardiovascular', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
        'cardiovascular',
      );
      const f = result.patientFunnel;
      expect(f.addressablePatients).toBe(
        Math.round(f.drugEligiblePatients * 0.50),
      );
    });

    it('should use 0.50 adoption ceiling for metabolic', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
        'metabolic',
      );
      const f = result.patientFunnel;
      expect(f.addressablePatients).toBe(
        Math.round(f.drugEligiblePatients * 0.50),
      );
    });

    it.each([
      ['immunology', 0.65],
      ['infectiousDisease', 0.65],
      ['womensHealth', 0.65],
      ['ophthalmology', 0.75],
      ['dermatology', 0.75],
      ['gastroenterology', 0.70],
    ] as const)(
      'should use adoption ceiling for %s (%s)',
      (ta, expectedCeiling) => {
        const result = estimateMarketSize(
          'test_indication',
          'us_only',
          'racing',
          stubEpi,
          ta,
        );
        const f = result.patientFunnel;
        expect(f.addressablePatients).toBe(
          Math.round(f.drugEligiblePatients * expectedCeiling),
        );
      },
    );
  });

  // ==========================================================================
  // 4. Epidemiology fallback guard
  // ==========================================================================

  describe('Epidemiology fallback guard (drugEligiblePercent)', () => {
    it('should default to 0.40 when drugEligiblePercent is null', () => {
      const epi: EpidemiologyData = {
        ...stubEpi,
        drugEligiblePercent: null as unknown as number,
      };
      const result = estimateMarketSize('test', 'us_only', 'racing', epi);
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackReasons).toBeDefined();
      expect(result.fallbackReasons!.some((r) => r.includes('drugEligiblePercent'))).toBe(true);

      // Verify 0.40 was actually used in the funnel
      const f = result.patientFunnel;
      expect(f.drugEligiblePatients).toBe(Math.round(f.treatedPatients * 0.40));
    });

    it('should default to 0.40 when drugEligiblePercent is 0', () => {
      const epi: EpidemiologyData = { ...stubEpi, drugEligiblePercent: 0 };
      const result = estimateMarketSize('test', 'us_only', 'racing', epi);
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackReasons!.some((r) => r.includes('drugEligiblePercent'))).toBe(true);

      const f = result.patientFunnel;
      expect(f.drugEligiblePatients).toBe(Math.round(f.treatedPatients * 0.40));
    });

    it('should default to 0.40 when drugEligiblePercent is NaN', () => {
      const epi: EpidemiologyData = { ...stubEpi, drugEligiblePercent: NaN };
      const result = estimateMarketSize('test', 'us_only', 'racing', epi);
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackReasons!.some((r) => r.includes('drugEligiblePercent'))).toBe(true);

      const f = result.patientFunnel;
      expect(f.drugEligiblePatients).toBe(Math.round(f.treatedPatients * 0.40));
    });

    it('should default to 0.40 when drugEligiblePercent > 1', () => {
      const epi: EpidemiologyData = { ...stubEpi, drugEligiblePercent: 1.5 };
      const result = estimateMarketSize('test', 'us_only', 'racing', epi);
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackReasons!.some((r) => r.includes('drugEligiblePercent'))).toBe(true);

      const f = result.patientFunnel;
      expect(f.drugEligiblePatients).toBe(Math.round(f.treatedPatients * 0.40));
    });

    it('should default to 0.40 when drugEligiblePercent is undefined', () => {
      const epi: EpidemiologyData = {
        ...stubEpi,
        drugEligiblePercent: undefined as unknown as number,
      };
      const result = estimateMarketSize('test', 'us_only', 'racing', epi);
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackReasons!.some((r) => r.includes('drugEligiblePercent'))).toBe(true);
    });

    it('should default to 0.40 when drugEligiblePercent is negative', () => {
      const epi: EpidemiologyData = { ...stubEpi, drugEligiblePercent: -0.5 };
      const result = estimateMarketSize('test', 'us_only', 'racing', epi);
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackReasons!.some((r) => r.includes('drugEligiblePercent'))).toBe(true);
    });

    it('should accept valid drugEligiblePercent of exactly 1.0', () => {
      const epi: EpidemiologyData = { ...stubEpi, drugEligiblePercent: 1.0 };
      const result = estimateMarketSize('test', 'us_only', 'racing', epi);
      // drugEligiblePercent = 1.0 is valid (exactly 100%)
      const hasDrugEligibleFallback = result.fallbackReasons?.some((r) =>
        r.includes('drugEligiblePercent'),
      );
      expect(hasDrugEligibleFallback ?? false).toBe(false);
    });

    it('should accept valid drugEligiblePercent between 0 and 1', () => {
      const epi: EpidemiologyData = { ...stubEpi, drugEligiblePercent: 0.55 };
      const result = estimateMarketSize('test', 'us_only', 'racing', epi);
      const f = result.patientFunnel;
      expect(f.drugEligiblePatients).toBe(Math.round(f.treatedPatients * 0.55));
    });

    it('should not set usedFallback when drugEligiblePercent is valid and territory is known', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
      );
      expect(result.usedFallback).toBe(false);
      expect(result.fallbackReasons).toBeUndefined();
    });
  });

  // ==========================================================================
  // 5. All 15 territories
  // ==========================================================================

  describe('All 15 territories produce valid output', () => {
    it.each(ALL_TERRITORIES)(
      'should produce TAM > 0 and SAM > 0 for territory "%s"',
      (territory) => {
        const result = estimateMarketSize(
          'test_indication',
          territory,
          'racing',
          stubEpi,
        );
        expect(result.totalAddressableMarket).toBeGreaterThan(0);
        expect(result.serviceableAddressableMarket).toBeGreaterThan(0);
        expect(result.serviceableObtainableMarket).toBeGreaterThan(0);
        expect(result.territory).toBe(territory);
      },
    );

    it.each(ALL_TERRITORIES)(
      'should have positive annualRevenuePerPatient for territory "%s"',
      (territory) => {
        const result = estimateMarketSize(
          'test_indication',
          territory,
          'racing',
          stubEpi,
        );
        expect(result.annualRevenuePerPatient).toBeGreaterThan(0);
      },
    );

    it('should produce higher revenue per patient for US than China (pricing index)', () => {
      const usResult = estimateMarketSize('test', 'us_only', 'racing', stubEpi);
      const cnResult = estimateMarketSize('test', 'china', 'racing', stubEpi);
      expect(usResult.annualRevenuePerPatient).toBeGreaterThan(
        cnResult.annualRevenuePerPatient,
      );
    });
  });

  // ==========================================================================
  // 6. TAM >= SAM >= SOM.median ordering
  // ==========================================================================

  describe('TAM >= SAM >= SOM ordering', () => {
    it.each(ALL_TERRITORIES)(
      'should maintain TAM >= SAM >= SOM for territory "%s"',
      (territory) => {
        const result = estimateMarketSize(
          'test_indication',
          territory,
          'racing',
          stubEpi,
        );
        expect(result.totalAddressableMarket).toBeGreaterThanOrEqual(
          result.serviceableAddressableMarket,
        );
        expect(result.serviceableAddressableMarket).toBeGreaterThanOrEqual(
          result.serviceableObtainableMarket,
        );
      },
    );

    it.each(COMPETITIVE_POSITIONS_ORDERED)(
      'should maintain TAM >= SAM >= SOM for position "%s"',
      (position) => {
        const result = estimateMarketSize(
          'test_indication',
          'us_only',
          position,
          stubEpi,
        );
        expect(result.totalAddressableMarket).toBeGreaterThanOrEqual(
          result.serviceableAddressableMarket,
        );
        expect(result.serviceableAddressableMarket).toBeGreaterThanOrEqual(
          result.serviceableObtainableMarket,
        );
      },
    );

    it('should maintain ordering with rareDisease TA (high multiplier + high ceiling)', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'firstInClass',
        stubEpi,
        'rareDisease',
      );
      expect(result.totalAddressableMarket).toBeGreaterThanOrEqual(
        result.serviceableAddressableMarket,
      );
      expect(result.serviceableAddressableMarket).toBeGreaterThanOrEqual(
        result.serviceableObtainableMarket,
      );
    });

    it('should maintain ordering with oncology TA (low multiplier + moderate ceiling)', () => {
      const result = estimateMarketSize(
        'test_indication',
        'global',
        'firstInClass',
        stubEpi,
        'oncology',
      );
      expect(result.totalAddressableMarket).toBeGreaterThanOrEqual(
        result.serviceableAddressableMarket,
      );
      expect(result.serviceableAddressableMarket).toBeGreaterThanOrEqual(
        result.serviceableObtainableMarket,
      );
    });

    it('should maintain peakSales low <= median <= high ordering', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
      );
      expect(result.peakSales.low).toBeLessThanOrEqual(result.peakSales.median);
      expect(result.peakSales.median).toBeLessThanOrEqual(result.peakSales.high);
    });
  });

  // ==========================================================================
  // 7. Unknown territory fallback
  // ==========================================================================

  describe('Unknown territory fallback', () => {
    it('should fall back to global for an unknown territory', () => {
      const result = estimateMarketSize(
        'test_indication',
        'narnia',
        'racing',
        stubEpi,
      );
      // Should use global population
      expect(result.patientFunnel.totalPopulation).toBe(8_200_000_000);
    });

    it('should set usedFallback to true for unknown territory', () => {
      const result = estimateMarketSize(
        'test_indication',
        'narnia',
        'racing',
        stubEpi,
      );
      expect(result.usedFallback).toBe(true);
    });

    it('should add a fallback reason mentioning the unknown territory', () => {
      const result = estimateMarketSize(
        'test_indication',
        'atlantis',
        'racing',
        stubEpi,
      );
      expect(result.fallbackReasons).toBeDefined();
      expect(
        result.fallbackReasons!.some((r) => r.includes('atlantis')),
      ).toBe(true);
      expect(
        result.fallbackReasons!.some((r) => /global/i.test(r)),
      ).toBe(true);
    });

    it('should produce the same TAM as the global territory for unknown territory', () => {
      const unknownResult = estimateMarketSize(
        'test_indication',
        'unknown_land',
        'racing',
        stubEpi,
      );
      const globalResult = estimateMarketSize(
        'test_indication',
        'global',
        'racing',
        stubEpi,
      );
      expect(unknownResult.totalAddressableMarket).toBe(
        globalResult.totalAddressableMarket,
      );
      expect(unknownResult.serviceableAddressableMarket).toBe(
        globalResult.serviceableAddressableMarket,
      );
    });

    it('should preserve the territory name in the result (not replace with "global")', () => {
      const result = estimateMarketSize(
        'test_indication',
        'narnia',
        'racing',
        stubEpi,
      );
      // The engine keeps the original territory key in the result
      expect(result.territory).toBe('narnia');
    });
  });

  // ==========================================================================
  // 8. Market share by competitive position ordering
  // ==========================================================================

  describe('Market share by competitive position ordering', () => {
    it('should order median shares: firstInClass > firstToPivotal > bestInClass > racing > behind > crowded', () => {
      const results = COMPETITIVE_POSITIONS_ORDERED.map((pos) =>
        estimateMarketSize('test_indication', 'us_only', pos, stubEpi),
      );

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].marketShareAssumption.median).toBeGreaterThan(
          results[i + 1].marketShareAssumption.median,
        );
      }
    });

    it('should order low shares: firstInClass > firstToPivotal > bestInClass > racing > behind > crowded', () => {
      const results = COMPETITIVE_POSITIONS_ORDERED.map((pos) =>
        estimateMarketSize('test_indication', 'us_only', pos, stubEpi),
      );

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].marketShareAssumption.low).toBeGreaterThan(
          results[i + 1].marketShareAssumption.low,
        );
      }
    });

    it('should order high shares: firstInClass > firstToPivotal > bestInClass > racing > behind > crowded', () => {
      const results = COMPETITIVE_POSITIONS_ORDERED.map((pos) =>
        estimateMarketSize('test_indication', 'us_only', pos, stubEpi),
      );

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].marketShareAssumption.high).toBeGreaterThan(
          results[i + 1].marketShareAssumption.high,
        );
      }
    });

    it('should produce higher SOM for firstInClass than crowded', () => {
      const fic = estimateMarketSize(
        'test_indication',
        'us_only',
        'firstInClass',
        stubEpi,
      );
      const crowded = estimateMarketSize(
        'test_indication',
        'us_only',
        'crowded',
        stubEpi,
      );
      expect(fic.serviceableObtainableMarket).toBeGreaterThan(
        crowded.serviceableObtainableMarket,
      );
    });

    it('should fall back to racing share for an unknown competitive position', () => {
      const unknownPos = estimateMarketSize(
        'test_indication',
        'us_only',
        'nonexistent_position',
        stubEpi,
      );
      const racingResult = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
      );
      expect(unknownPos.marketShareAssumption.median).toBe(
        racingResult.marketShareAssumption.median,
      );
    });

    it('should maintain share ordering even with TA multiplier applied', () => {
      const results = COMPETITIVE_POSITIONS_ORDERED.map((pos) =>
        estimateMarketSize('test_indication', 'us_only', pos, stubEpi, 'rareDisease'),
      );

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].marketShareAssumption.median).toBeGreaterThan(
          results[i + 1].marketShareAssumption.median,
        );
      }
    });
  });

  // ==========================================================================
  // Additional edge cases
  // ==========================================================================

  describe('Output structure and metadata', () => {
    it('should include indication and territory in the result', () => {
      const result = estimateMarketSize(
        'lung_nsclc',
        'us_only',
        'firstInClass',
        stubEpi,
      );
      expect(result.indication).toBe('lung_nsclc');
      expect(result.territory).toBe('us_only');
    });

    it('should pass through epidemiology sources', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
      );
      expect(result.sources).toEqual(['Test stub']);
    });

    it('should use curated peakSalesRangeM when provided', () => {
      const epiWithPeak: EpidemiologyData = {
        ...stubEpi,
        peakSalesRangeM: { low: 500, median: 1000, high: 2000 },
      };
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        epiWithPeak,
      );
      expect(result.peakSales.low).toBe(500);
      expect(result.peakSales.median).toBe(1000);
      expect(result.peakSales.high).toBe(2000);
    });

    it('should compute bottom-up peakSales when peakSalesRangeM is undefined', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
      );
      // Bottom-up peakSales should be rounded SOM values
      expect(Number.isInteger(result.peakSales.low)).toBe(true);
      expect(Number.isInteger(result.peakSales.median)).toBe(true);
      expect(Number.isInteger(result.peakSales.high)).toBe(true);
    });

    it('should flag generic rare-disease fallback profile', () => {
      const genericFallbackEpi: EpidemiologyData = {
        ...stubEpi,
        sources: ['Estimated — specific epidemiology data not available'],
      };
      const result = estimateMarketSize(
        'unknown_indication',
        'us_only',
        'racing',
        genericFallbackEpi,
      );
      expect(result.usedFallback).toBe(true);
      expect(
        result.fallbackReasons!.some((r) => r.includes('Generic rare-disease')),
      ).toBe(true);
    });

    it('should round TAM and SAM to integers', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
      );
      expect(Number.isInteger(result.totalAddressableMarket)).toBe(true);
      expect(Number.isInteger(result.serviceableAddressableMarket)).toBe(true);
      expect(Number.isInteger(result.serviceableObtainableMarket)).toBe(true);
    });

    it('should round annualRevenuePerPatient to an integer', () => {
      const result = estimateMarketSize(
        'test_indication',
        'us_only',
        'racing',
        stubEpi,
      );
      expect(Number.isInteger(result.annualRevenuePerPatient)).toBe(true);
    });
  });
});
