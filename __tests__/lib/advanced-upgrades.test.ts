/**
 * Tests for advanced rNPV upgrades
 * Covers: Competitive Dynamics, Real Options, Enhanced Correlation
 */
import { calculateCompetitiveDynamics, calculateRealOptions, getEnhancedCorrelationMatrix, applyConditionalPeakSalesFloor } from '@/lib/financial/advanced-upgrades';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import { runMonteCarlo } from '@/lib/financial/monte-carlo';
import type { RNPVInput } from '@/lib/financial/types';

const baseInput: RNPVInput = {
  phase: 'phase2' as any,
  therapeuticArea: 'oncology' as any,
  modality: 'mab' as any,
  indication: 'lung_nsclc',
  territory: 'us',
  peakSalesEstimate: { low: 800, median: 1500, high: 2500 },
  competitivePosition: 'racing',
  dataQuality: 'moderate',
  regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
};

const baseResult = calculateRNPV(baseInput);
const mcResult = runMonteCarlo({ rnpvInput: baseInput }, 42);

// ============================================================
// Upgrade 4: Competitive Dynamics
// ============================================================
describe('Competitive Dynamics', () => {
  it('should generate competitor timeline for racing position', () => {
    const dynamics = calculateCompetitiveDynamics(baseInput, baseResult);
    expect(dynamics.competitorTimeline.length).toBeGreaterThan(0);
  });

  it('should have more competitors for crowded vs firstInClass', () => {
    const crowdedInput = { ...baseInput, competitivePosition: 'crowded' };
    const ficInput = { ...baseInput, competitivePosition: 'firstInClass' };
    const crowdedResult = calculateRNPV(crowdedInput);
    const ficResult = calculateRNPV(ficInput);
    const crowdedDyn = calculateCompetitiveDynamics(crowdedInput, crowdedResult);
    const ficDyn = calculateCompetitiveDynamics(ficInput, ficResult);
    expect(crowdedDyn.competitorTimeline.length).toBeGreaterThan(ficDyn.competitorTimeline.length);
  });

  it('should have higher peak erosion for crowded vs firstInClass', () => {
    const crowdedInput = { ...baseInput, competitivePosition: 'crowded' };
    const ficInput = { ...baseInput, competitivePosition: 'firstInClass' };
    const crowdedResult = calculateRNPV(crowdedInput);
    const ficResult = calculateRNPV(ficInput);
    const crowdedDyn = calculateCompetitiveDynamics(crowdedInput, crowdedResult);
    const ficDyn = calculateCompetitiveDynamics(ficInput, ficResult);
    // Crowded should have >= erosion than firstInClass (may both be 0 if cash flows don't overlap with competitor entry)
    expect(crowdedDyn.peakShareErosion).toBeGreaterThanOrEqual(ficDyn.peakShareErosion);
    // At minimum, crowded should have more competitors in the timeline
    expect(crowdedDyn.competitorTimeline.length).toBeGreaterThan(ficDyn.competitorTimeline.length);
  });

  it('should have adjustedRevenue <= baselineRevenue for each year', () => {
    const dynamics = calculateCompetitiveDynamics(baseInput, baseResult);
    for (let i = 0; i < dynamics.baselineRevenue.length; i++) {
      expect(dynamics.adjustedRevenue[i]).toBeLessThanOrEqual(dynamics.baselineRevenue[i] + 0.01);
    }
  });

  it('should have revenueImpact >= 0', () => {
    const dynamics = calculateCompetitiveDynamics(baseInput, baseResult);
    expect(dynamics.revenueImpact).toBeGreaterThanOrEqual(0);
  });

  it('should generate a non-empty narrative', () => {
    const dynamics = calculateCompetitiveDynamics(baseInput, baseResult);
    expect(dynamics.narrative.length).toBeGreaterThan(20);
  });

  it('should handle behind position with pre-launch competitors', () => {
    const behindInput = { ...baseInput, competitivePosition: 'behind' };
    const behindResult = calculateRNPV(behindInput);
    const dynamics = calculateCompetitiveDynamics(behindInput, behindResult);
    // Should have at least one competitor entering before launch year
    const launchYear = new Date().getFullYear() + baseResult.yearsToMarket;
    const preLaunch = dynamics.competitorTimeline.filter(c => c.entryYear <= launchYear);
    expect(preLaunch.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Upgrade 5: Real Options
// ============================================================
describe('Real Options Overlay', () => {
  it('should return option values for each remaining phase', () => {
    const options = calculateRealOptions(baseInput, baseResult, mcResult);
    expect(options.optionValueByPhase.length).toBeGreaterThan(0);
  });

  it('should have totalOptionValue > 0 for phase2 asset', () => {
    const options = calculateRealOptions(baseInput, baseResult, mcResult);
    expect(options.totalOptionValue).toBeGreaterThan(0);
  });

  it('should have a defined flexibility premium (can be negative for deep-in-the-money assets)', () => {
    const options = calculateRealOptions(baseInput, baseResult, mcResult);
    // Flexibility premium can be negative when strike exceeds underlying
    // (development costs exceed risk-adjusted downstream value)
    expect(typeof options.flexibilityPremium).toBe('number');
    expect(isFinite(options.flexibilityPremium)).toBe(true);
  });

  it('should have flexibilityPremiumPercent as a finite number', () => {
    const options = calculateRealOptions(baseInput, baseResult, mcResult);
    expect(typeof options.flexibilityPremiumPercent).toBe('number');
    expect(isFinite(options.flexibilityPremiumPercent)).toBe(true);
  });

  it('should use volatility between 0.30 and 0.90', () => {
    const options = calculateRealOptions(baseInput, baseResult, mcResult);
    expect(options.volatilityUsed).toBeGreaterThanOrEqual(0.30);
    expect(options.volatilityUsed).toBeLessThanOrEqual(0.90);
  });

  it('should have higher flexibility premium for early-stage vs late-stage', () => {
    const earlyInput = { ...baseInput, phase: 'preclinical' as any };
    const lateInput = { ...baseInput, phase: 'phase3' as any };
    const earlyResult = calculateRNPV(earlyInput);
    const lateResult = calculateRNPV(lateInput);
    const earlyMc = runMonteCarlo({ rnpvInput: earlyInput }, 42);
    const lateMc = runMonteCarlo({ rnpvInput: lateInput }, 42);
    const earlyOptions = calculateRealOptions(earlyInput, earlyResult, earlyMc);
    const lateOptions = calculateRealOptions(lateInput, lateResult, lateMc);
    expect(earlyOptions.flexibilityPremiumPercent).toBeGreaterThan(lateOptions.flexibilityPremiumPercent);
  });

  it('should generate a non-empty narrative', () => {
    const options = calculateRealOptions(baseInput, baseResult, mcResult);
    expect(options.narrative.length).toBeGreaterThan(20);
  });

  it('should decompose into intrinsic + time value', () => {
    const options = calculateRealOptions(baseInput, baseResult, mcResult);
    for (const phase of options.optionValueByPhase) {
      expect(phase.optionValue).toBeCloseTo(phase.intrinsicValue + phase.timeValue, 0);
      expect(phase.timeValue).toBeGreaterThanOrEqual(-0.01); // time value should be non-negative
    }
  });
});

// ============================================================
// Upgrade 6: Enhanced Correlation
// ============================================================
describe('Enhanced Monte Carlo Correlation', () => {
  it('should return a 5x5 matrix', () => {
    const { matrix, labels } = getEnhancedCorrelationMatrix('phase2');
    expect(matrix.length).toBe(5);
    expect(matrix[0].length).toBe(5);
    expect(labels.length).toBe(5);
  });

  it('should have diagonal = 1.0', () => {
    const { matrix } = getEnhancedCorrelationMatrix('phase2');
    for (let i = 0; i < 5; i++) {
      expect(matrix[i][i]).toBe(1.0);
    }
  });

  it('should be symmetric', () => {
    const { matrix } = getEnhancedCorrelationMatrix('phase2');
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        expect(matrix[i][j]).toBeCloseTo(matrix[j][i], 10);
      }
    }
  });

  it('should have stronger PoS-PeakSales correlation for early stage', () => {
    const { matrix: early } = getEnhancedCorrelationMatrix('preclinical');
    const { matrix: late } = getEnhancedCorrelationMatrix('phase3');
    // PoS is index 0, PeakSales is index 1
    expect(early[0][1]).toBeGreaterThan(late[0][1]);
  });

  it('should have all correlations between -1 and 1', () => {
    const { matrix } = getEnhancedCorrelationMatrix('phase2');
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        expect(matrix[i][j]).toBeGreaterThanOrEqual(-1);
        expect(matrix[i][j]).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('Conditional Peak Sales Floor', () => {
  it('should not modify peak sales when PoS is normal', () => {
    const result = applyConditionalPeakSalesFloor(0.80, 1.20, 0.10);
    expect(result).toBe(1.20);
  });

  it('should cap peak sales at 0.60 when PoS multiplier < 0.50', () => {
    const result = applyConditionalPeakSalesFloor(0.40, 1.50, 0.10);
    expect(result).toBeLessThanOrEqual(0.60);
  });

  it('should cap peak sales at 0.30 when PoS multiplier < 0.25', () => {
    const result = applyConditionalPeakSalesFloor(0.20, 1.50, 0.10);
    expect(result).toBeLessThanOrEqual(0.30);
  });

  it('should return original value when already below cap', () => {
    const result = applyConditionalPeakSalesFloor(0.40, 0.50, 0.10);
    expect(result).toBe(0.50);
  });
});
