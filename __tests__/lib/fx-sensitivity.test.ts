/**
 * FX Sensitivity Engine Tests
 *
 * Tests the calculateFXSensitivity function from lib/financial/fx-sensitivity.ts.
 * Validates FX exposure modeling across territories, scenario bounds, and
 * proportionality of revenue impact to FX move magnitude.
 */

import {
  calculateFXSensitivity,
  TERRITORY_PRICING_PROFILES,
  getPricingPressureNarrative,
} from '@/lib/financial/fx-sensitivity';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_REVENUE = 2000; // $2B peak revenue
const BASE_DEAL_VALUE = 800; // $800M deal value

const ALL_TERRITORIES = Object.keys(TERRITORY_PRICING_PROFILES);

// ---------------------------------------------------------------------------
// US-only territory — zero FX sensitivity
// ---------------------------------------------------------------------------

describe('FX Sensitivity — US-only territory', () => {
  const result = calculateFXSensitivity('us_only', BASE_REVENUE, BASE_DEAL_VALUE);

  test('all scenario revenue impacts should be zero for US-only deals', () => {
    for (const scenario of result.scenarios) {
      // Use toEqual(0) to handle -0 === 0 (Math.round can produce -0)
      expect(scenario.revenueImpact === 0 || scenario.revenueImpact === -0).toBe(true);
    }
  });

  test('all scenario deal value impacts should be zero for US-only deals', () => {
    for (const scenario of result.scenarios) {
      expect(scenario.dealValueImpact === 0 || scenario.dealValueImpact === -0).toBe(true);
    }
  });

  test('base case revenue is passed through correctly', () => {
    expect(result.baseCaseRevenue).toBe(BASE_REVENUE);
  });

  test('total adjusted revenue accounts for IRA regulatory impact only', () => {
    // US-only still has IRA regulatory pricing pressure
    expect(result.totalAdjustedRevenue).toBeLessThanOrEqual(BASE_REVENUE);
    expect(result.totalAdjustedRevenue).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Global territory — meaningful FX sensitivity
// ---------------------------------------------------------------------------

describe('FX Sensitivity — Global territory', () => {
  const result = calculateFXSensitivity('global', BASE_REVENUE, BASE_DEAL_VALUE);

  test('non-base-case scenarios have non-zero revenue impact', () => {
    const nonBaseScenarios = result.scenarios.filter(s => s.fxChange !== 0);
    expect(nonBaseScenarios.length).toBeGreaterThan(0);
    for (const scenario of nonBaseScenarios) {
      expect(scenario.revenueImpact).not.toBe(0);
    }
  });

  test('multiple currencies are implicitly affected (non-USD share > 0)', () => {
    // Global territory has ~40% non-USD revenue exposure
    // A 10% USD strengthening should impact revenue noticeably
    const usd10Scenario = result.scenarios.find(s => s.fxChange === 0.10);
    expect(usd10Scenario).toBeDefined();
    // Revenue impact should be negative when USD strengthens (non-USD revenue worth less)
    expect(usd10Scenario!.revenueImpact).toBeLessThan(0);
  });

  test('USD weakening increases revenue (positive impact)', () => {
    const usdWeak10 = result.scenarios.find(s => s.fxChange === -0.10);
    expect(usdWeak10).toBeDefined();
    expect(usdWeak10!.revenueImpact).toBeGreaterThan(0);
  });

  test('regulatory pricing impact is non-negative', () => {
    // Global profile does not carry territory-specific regulatory properties
    // (iraImpact, nrdlDiscount, referenceBasketDiscount) directly, so the
    // regulatory impact may be zero. It should never be negative.
    expect(result.regulatoryPricingImpact).toBeGreaterThanOrEqual(0);
  });

  test('total adjusted revenue does not exceed base case revenue', () => {
    expect(result.totalAdjustedRevenue).toBeLessThanOrEqual(BASE_REVENUE);
    expect(result.totalAdjustedRevenue).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// FX shocks stay within plausible bounds
// ---------------------------------------------------------------------------

describe('FX Sensitivity — scenario bounds', () => {
  test('all FX changes are within +/-20% (plausible annual moves)', () => {
    for (const territory of ALL_TERRITORIES) {
      const result = calculateFXSensitivity(territory, BASE_REVENUE, BASE_DEAL_VALUE);
      for (const scenario of result.scenarios) {
        expect(Math.abs(scenario.fxChange)).toBeLessThanOrEqual(0.20);
      }
    }
  });

  test('scenarios include both positive and negative FX moves', () => {
    const result = calculateFXSensitivity('global', BASE_REVENUE, BASE_DEAL_VALUE);
    const positiveChanges = result.scenarios.filter(s => s.fxChange > 0);
    const negativeChanges = result.scenarios.filter(s => s.fxChange < 0);
    expect(positiveChanges.length).toBeGreaterThan(0);
    expect(negativeChanges.length).toBeGreaterThan(0);
  });

  test('base case scenario (fxChange = 0) is always present', () => {
    for (const territory of ALL_TERRITORIES) {
      const result = calculateFXSensitivity(territory, BASE_REVENUE, BASE_DEAL_VALUE);
      const baseCaseScenario = result.scenarios.find(s => s.fxChange === 0);
      expect(baseCaseScenario).toBeDefined();
      // Math.round can produce -0 for zero-exposure territories; treat as zero
      expect(baseCaseScenario!.revenueImpact + 0).toBe(0);
      expect(baseCaseScenario!.dealValueImpact + 0).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// All territories produce valid output
// ---------------------------------------------------------------------------

describe('FX Sensitivity — validity across all territories', () => {
  test.each(ALL_TERRITORIES)(
    '%s produces valid (non-NaN, non-Infinity) output',
    (territory) => {
      const result = calculateFXSensitivity(territory, BASE_REVENUE, BASE_DEAL_VALUE);

      expect(Number.isFinite(result.baseCaseRevenue)).toBe(true);
      expect(Number.isFinite(result.regulatoryPricingImpact)).toBe(true);
      expect(Number.isFinite(result.totalAdjustedRevenue)).toBe(true);

      for (const scenario of result.scenarios) {
        expect(Number.isFinite(scenario.fxChange)).toBe(true);
        expect(Number.isFinite(scenario.revenueImpact)).toBe(true);
        expect(Number.isFinite(scenario.dealValueImpact)).toBe(true);
      }
    },
  );

  test('unknown territory falls back to global profile gracefully', () => {
    const result = calculateFXSensitivity('unknown_territory', BASE_REVENUE, BASE_DEAL_VALUE);
    expect(result.baseCaseRevenue).toBe(BASE_REVENUE);
    expect(Number.isFinite(result.totalAdjustedRevenue)).toBe(true);
    // Should still produce valid scenarios
    expect(result.scenarios.length).toBeGreaterThan(0);
  });

  test('zero revenue input produces zero impacts', () => {
    const result = calculateFXSensitivity('global', 0, 0);
    expect(result.baseCaseRevenue).toBe(0);
    for (const scenario of result.scenarios) {
      // Math.round(0 * exposure * change) can produce -0
      expect(scenario.revenueImpact + 0).toBe(0);
      expect(scenario.dealValueImpact + 0).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Revenue impact proportional to FX move magnitude
// ---------------------------------------------------------------------------

describe('FX Sensitivity — proportionality', () => {
  test('revenue impact scales linearly with FX move magnitude', () => {
    const result = calculateFXSensitivity('europe', BASE_REVENUE, BASE_DEAL_VALUE);

    const scenario5 = result.scenarios.find(s => s.fxChange === 0.05);
    const scenario10 = result.scenarios.find(s => s.fxChange === 0.10);
    const scenario15 = result.scenarios.find(s => s.fxChange === 0.15);

    expect(scenario5).toBeDefined();
    expect(scenario10).toBeDefined();
    expect(scenario15).toBeDefined();

    // 10% move should have ~2x the impact of 5% move
    const ratio10to5 = Math.abs(scenario10!.revenueImpact) / Math.abs(scenario5!.revenueImpact);
    expect(ratio10to5).toBeCloseTo(2.0, 0);

    // 15% move should have ~3x the impact of 5% move
    const ratio15to5 = Math.abs(scenario15!.revenueImpact) / Math.abs(scenario5!.revenueImpact);
    expect(ratio15to5).toBeCloseTo(3.0, 0);
  });

  test('higher base revenue produces proportionally higher FX impact', () => {
    const smallRevenue = calculateFXSensitivity('global', 500, 200);
    const largeRevenue = calculateFXSensitivity('global', 5000, 2000);

    const small10 = smallRevenue.scenarios.find(s => s.fxChange === 0.10);
    const large10 = largeRevenue.scenarios.find(s => s.fxChange === 0.10);

    expect(small10).toBeDefined();
    expect(large10).toBeDefined();

    // 10x revenue should produce ~10x FX impact
    const ratio = Math.abs(large10!.revenueImpact) / Math.abs(small10!.revenueImpact);
    expect(ratio).toBeCloseTo(10.0, 0);
  });

  test('symmetric FX moves produce symmetric impacts (opposite sign)', () => {
    const result = calculateFXSensitivity('japan', BASE_REVENUE, BASE_DEAL_VALUE);
    const weakening = result.scenarios.find(s => s.fxChange === -0.10);
    const strengthening = result.scenarios.find(s => s.fxChange === 0.10);

    expect(weakening).toBeDefined();
    expect(strengthening).toBeDefined();

    // Impacts should be equal in magnitude but opposite in sign
    expect(Math.abs(weakening!.revenueImpact)).toBeCloseTo(
      Math.abs(strengthening!.revenueImpact),
      1,
    );
    expect(weakening!.revenueImpact * strengthening!.revenueImpact).toBeLessThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Pricing pressure narrative
// ---------------------------------------------------------------------------

describe('getPricingPressureNarrative', () => {
  test('returns a non-empty narrative for all known territories', () => {
    for (const territory of ALL_TERRITORIES) {
      const narrative = getPricingPressureNarrative(territory);
      expect(narrative.length).toBeGreaterThan(0);
    }
  });

  test('returns fallback message for unknown territory', () => {
    const narrative = getPricingPressureNarrative('unknown');
    expect(narrative).toContain('not available');
  });
});
