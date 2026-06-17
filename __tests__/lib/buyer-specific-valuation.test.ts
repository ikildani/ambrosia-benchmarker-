/**
 * Tests for lib/financial/buyer-specific-valuation.ts
 *
 * Validates the buyer-specific valuation engine: factor weights, premium caps,
 * input clamping, confidence adjustment, timing multipliers, urgency upfront
 * boost, Phase 2 option-value floor, counterparty premium integration,
 * premium floor, and narrative generation.
 *
 * All tests use synthetic fixtures with no DB dependency.
 */

import {
  calculateBuyerSpecificValuation,
  type BuyerProfile,
} from '../../lib/financial/buyer-specific-valuation';
import type { DealWaterfall, RNPVResult, CounterpartyPremiumLookup } from '../../lib/financial/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBuyerProfile(overrides: Partial<BuyerProfile> = {}): BuyerProfile {
  return {
    companyName: 'TestPharma',
    companyId: 'buyer-1',
    matchScore: 70,
    intentScore: 60,
    intentTier: 'high',
    timing: 'near_term',
    confidence: 0.8,
    dealsLast12mo: 5,
    patentCliffPressure: 50,
    pipelineGap: 50,
    dealVelocity: 50,
    competitivePressure: 50,
    ...overrides,
  };
}

function makeDealWaterfall(overrides: Partial<DealWaterfall> = {}): DealWaterfall {
  return {
    steps: [],
    upfrontPayment: { low: 100, median: 200, high: 300 },
    developmentMilestones: { low: 100, median: 200, high: 300 },
    commercialMilestones: { low: 200, median: 400, high: 600 },
    royaltyRate: { low: 0.05, median: 0.10, high: 0.15 },
    totalDealValue: { low: 500, median: 1000, high: 1500 },
    narrative: 'test waterfall',
    ...overrides,
  };
}

function makeRNPVResult(overrides: Partial<RNPVResult> = {}): RNPVResult {
  return {
    riskAdjustedNPV: 1000,
    unadjustedNPV: 5000,
    cumulativePoS: 0.50,
    phaseTransitions: [],
    cashFlows: [],
    peakSalesYear: 2030,
    yearsToMarket: 5,
    impliedDealValue: {
      upfront: { low: 100, median: 200, high: 300 },
      totalDeal: { low: 500, median: 1000, high: 1500 },
    },
    discountRate: 0.12,
    terminalValue: 0,
    modelAssumptions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Factor weights sum to 1.0
// ---------------------------------------------------------------------------

describe('Factor weights', () => {
  test('FACTOR_WEIGHTS sum to 1.0', () => {
    // We verify indirectly: all scores at 100, confidence=1, timing=medium_term (1.0x)
    // The raw premium should equal sum of all weights = 1.0
    // After confidence adjustment (0.5 + 0.5*1) = 1.0, timing 1.0x => 1.0
    // Capped at 0.75
    // So strategicPremium should be 1 + 0.75 = 1.75
    const buyer = makeBuyerProfile({
      matchScore: 100,
      intentScore: 100,
      patentCliffPressure: 100,
      pipelineGap: 100,
      competitivePressure: 100,
      confidence: 1,
      timing: 'medium_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    // Raw premium = 0.30 + 0.25 + 0.20 + 0.15 + 0.10 = 1.0
    // After confidence (1.0) and timing (1.0x) => 1.0, capped to 0.75
    expect(result.strategicPremium).toBe(1.75);

    // Verify contribution breakdown covers all 5 factors
    const factorNames = result.premiumBreakdown.map(f => f.factor);
    expect(factorNames).toContain('Portfolio Fit');
    expect(factorNames).toContain('Deal Urgency');
    expect(factorNames).toContain('Patent Cliff Pressure');
    expect(factorNames).toContain('Pipeline Gap');
    expect(factorNames).toContain('Competitive Pressure');
    expect(result.premiumBreakdown).toHaveLength(5);
  });

  test('individual factor weights are correct (portfolioFit=0.30, dealUrgency=0.25, patentCliff=0.20, pipelineGap=0.15, competitivePressure=0.10)', () => {
    const buyer = result => result.premiumBreakdown;

    // Set each factor to 100 one at a time with others at 0
    const factors = [
      { field: 'matchScore', expectedFactor: 'Portfolio Fit', expectedWeight: 0.30 },
      { field: 'intentScore', expectedFactor: 'Deal Urgency', expectedWeight: 0.25 },
      { field: 'patentCliffPressure', expectedFactor: 'Patent Cliff Pressure', expectedWeight: 0.20 },
      { field: 'pipelineGap', expectedFactor: 'Pipeline Gap', expectedWeight: 0.15 },
      { field: 'competitivePressure', expectedFactor: 'Competitive Pressure', expectedWeight: 0.10 },
    ] as const;

    for (const { field, expectedFactor, expectedWeight } of factors) {
      const overrides: Partial<BuyerProfile> = {
        matchScore: 0,
        intentScore: 0,
        patentCliffPressure: 0,
        pipelineGap: 0,
        competitivePressure: 0,
        confidence: 1,
        timing: 'medium_term',
        [field]: 100,
      };
      const result = calculateBuyerSpecificValuation(
        makeBuyerProfile(overrides),
        makeDealWaterfall(),
        makeRNPVResult(),
      );
      const factor = result.premiumBreakdown.find(f => f.factor === expectedFactor);
      expect(factor).toBeDefined();
      expect(factor!.weight).toBe(expectedWeight);
      // contribution should be weight * 100 (score=100, score/100=1, * weight * 100 for percent)
      expect(factor!.contribution).toBeCloseTo(expectedWeight * 100, 5);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. MAX_PREMIUM cap holds
// ---------------------------------------------------------------------------

describe('MAX_PREMIUM cap', () => {
  test('even with all scores at 100, imminent timing, and confidence=1, strategicPremium does not exceed 1.75', () => {
    const buyer = makeBuyerProfile({
      matchScore: 100,
      intentScore: 100,
      patentCliffPressure: 100,
      pipelineGap: 100,
      competitivePressure: 100,
      confidence: 1,
      timing: 'imminent',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    // Raw = 1.0, confidence adj = 1.0, timing = 1.3 => 1.3, capped at 0.75
    expect(result.strategicPremium).toBeLessThanOrEqual(1.75);
    expect(result.strategicPremium).toBe(1.75);
    expect(result.strategicPremiumPercent).toBe(75);
  });

  test('strategicPremiumPercent never exceeds 75', () => {
    const buyer = makeBuyerProfile({
      matchScore: 100,
      intentScore: 100,
      patentCliffPressure: 100,
      pipelineGap: 100,
      competitivePressure: 100,
      confidence: 1,
      timing: 'imminent',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());
    expect(result.strategicPremiumPercent).toBeLessThanOrEqual(75);
  });

  test('cap holds even with high counterparty premium added', () => {
    const buyer = makeBuyerProfile({
      matchScore: 100,
      intentScore: 100,
      patentCliffPressure: 100,
      pipelineGap: 100,
      competitivePressure: 100,
      confidence: 1,
      timing: 'imminent',
    });
    const counterparty: CounterpartyPremiumLookup = {
      multiplier: 2.0, // +100% — very aggressive
      confidence: 'high',
      source: 'company_wide',
    };
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult(), counterparty);

    expect(result.strategicPremium).toBeLessThanOrEqual(1.75);
    expect(result.strategicPremium).toBe(1.75);
  });
});

// ---------------------------------------------------------------------------
// 3. Input clamping
// ---------------------------------------------------------------------------

describe('Input clamping', () => {
  test('scores > 100 are clamped to 100', () => {
    const buyer = makeBuyerProfile({
      matchScore: 200,
      intentScore: 150,
      patentCliffPressure: 999,
      pipelineGap: 300,
      competitivePressure: 500,
      confidence: 1,
      timing: 'medium_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    // If clamping works, this should equal the all-100 case
    const buyerAll100 = makeBuyerProfile({
      matchScore: 100,
      intentScore: 100,
      patentCliffPressure: 100,
      pipelineGap: 100,
      competitivePressure: 100,
      confidence: 1,
      timing: 'medium_term',
    });
    const resultAll100 = calculateBuyerSpecificValuation(buyerAll100, makeDealWaterfall(), makeRNPVResult());

    expect(result.strategicPremium).toBe(resultAll100.strategicPremium);
    expect(result.strategicPremiumPercent).toBe(resultAll100.strategicPremiumPercent);
  });

  test('scores < 0 are clamped to 0', () => {
    const buyer = makeBuyerProfile({
      matchScore: -50,
      intentScore: -10,
      patentCliffPressure: -100,
      pipelineGap: -20,
      competitivePressure: -5,
      confidence: 1,
      timing: 'medium_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    // All zeros => raw premium = 0, strategicPremium = 1.0
    expect(result.strategicPremium).toBe(1.0);
    expect(result.strategicPremiumPercent).toBe(0);
  });

  test('NaN scores are treated as 0', () => {
    const buyer = makeBuyerProfile({
      matchScore: NaN,
      intentScore: NaN,
      patentCliffPressure: NaN,
      pipelineGap: NaN,
      competitivePressure: NaN,
      confidence: 1,
      timing: 'medium_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    expect(result.strategicPremium).toBe(1.0);
    expect(result.strategicPremiumPercent).toBe(0);
  });

  test('Infinity scores are treated as 0', () => {
    const buyer = makeBuyerProfile({
      matchScore: Infinity,
      intentScore: -Infinity,
      patentCliffPressure: Infinity,
      pipelineGap: -Infinity,
      competitivePressure: Infinity,
      confidence: 1,
      timing: 'medium_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    // Infinity is not finite so clamp100 returns 0
    expect(result.strategicPremium).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// 4. Confidence adjustment
// ---------------------------------------------------------------------------

describe('Confidence adjustment', () => {
  test('confidence=1 gives full premium (multiplier = 0.5 + 0.5*1 = 1.0)', () => {
    const buyer = makeBuyerProfile({
      matchScore: 80,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    // Raw premium = (80/100) * 0.30 = 0.24
    // Confidence adj = 0.24 * (0.5 + 0.5*1) = 0.24 * 1.0 = 0.24
    // Timing = 1.0 => 0.24
    expect(result.strategicPremium).toBeCloseTo(1.24, 5);
  });

  test('confidence=0 halves the premium (multiplier = 0.5 + 0.5*0 = 0.5)', () => {
    const buyer = makeBuyerProfile({
      matchScore: 80,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 0,
      timing: 'medium_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    // Raw = 0.24, confidence adj = 0.24 * 0.5 = 0.12
    expect(result.strategicPremium).toBeCloseTo(1.12, 5);
  });

  test('confidence=0.5 gives 75% of full premium', () => {
    const buyer = makeBuyerProfile({
      matchScore: 80,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 0.5,
      timing: 'medium_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    // Raw = 0.24, confidence adj = 0.24 * (0.5 + 0.25) = 0.24 * 0.75 = 0.18
    expect(result.strategicPremium).toBeCloseTo(1.18, 5);
  });

  test('NaN confidence is treated as 0', () => {
    const buyer = makeBuyerProfile({
      matchScore: 80,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: NaN,
      timing: 'medium_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    // NaN confidence => clampedConfidence = 0 => multiplier 0.5
    // Raw = 0.24, confidence adj = 0.24 * 0.5 = 0.12
    expect(result.strategicPremium).toBeCloseTo(1.12, 5);
  });

  test('confidence > 1 is clamped to 1', () => {
    const buyerOver = makeBuyerProfile({
      matchScore: 80,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 5.0,
      timing: 'medium_term',
    });
    const buyerExact = makeBuyerProfile({
      matchScore: 80,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1.0,
      timing: 'medium_term',
    });
    const resultOver = calculateBuyerSpecificValuation(buyerOver, makeDealWaterfall(), makeRNPVResult());
    const resultExact = calculateBuyerSpecificValuation(buyerExact, makeDealWaterfall(), makeRNPVResult());

    expect(resultOver.strategicPremium).toBe(resultExact.strategicPremium);
  });
});

// ---------------------------------------------------------------------------
// 5. Timing multipliers
// ---------------------------------------------------------------------------

describe('Timing multipliers', () => {
  // Use a controlled setup: single factor so we can predict exact premium
  const baseOverrides: Partial<BuyerProfile> = {
    matchScore: 50,
    intentScore: 0,
    patentCliffPressure: 0,
    pipelineGap: 0,
    competitivePressure: 0,
    confidence: 1,
  };

  // Raw premium = (50/100) * 0.30 = 0.15
  // Confidence adj = 0.15 * 1.0 = 0.15

  test('imminent timing applies 1.3x multiplier', () => {
    const buyer = makeBuyerProfile({ ...baseOverrides, timing: 'imminent' });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());
    // 0.15 * 1.3 = 0.195
    expect(result.strategicPremium).toBeCloseTo(1.195, 5);
  });

  test('near_term timing applies 1.1x multiplier', () => {
    const buyer = makeBuyerProfile({ ...baseOverrides, timing: 'near_term' });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());
    // 0.15 * 1.1 = 0.165
    expect(result.strategicPremium).toBeCloseTo(1.165, 5);
  });

  test('medium_term timing applies 1.0x multiplier', () => {
    const buyer = makeBuyerProfile({ ...baseOverrides, timing: 'medium_term' });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());
    // 0.15 * 1.0 = 0.15
    expect(result.strategicPremium).toBeCloseTo(1.15, 5);
  });

  test('speculative timing applies 0.7x multiplier', () => {
    const buyer = makeBuyerProfile({ ...baseOverrides, timing: 'speculative' });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());
    // 0.15 * 0.7 = 0.105
    expect(result.strategicPremium).toBeCloseTo(1.105, 5);
  });

  test('unknown timing defaults to 1.0x multiplier', () => {
    const buyer = makeBuyerProfile({ ...baseOverrides, timing: 'unknown_timing' });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());
    // 0.15 * 1.0 = 0.15 (fallback)
    expect(result.strategicPremium).toBeCloseTo(1.15, 5);
  });
});

// ---------------------------------------------------------------------------
// 6. Urgency upfront boost
// ---------------------------------------------------------------------------

describe('Urgency upfront boost', () => {
  const waterfall = makeDealWaterfall({
    upfrontPayment: { low: 100, median: 200, high: 300 },
  });

  test('imminent buyers shift +10% to upfront', () => {
    const buyer = makeBuyerProfile({
      matchScore: 0,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'imminent',
    });
    const result = calculateBuyerSpecificValuation(buyer, waterfall, makeRNPVResult());

    // strategicPremium = 1.0 (all scores 0), upfrontMultiplier = 1.0 * (1 + 0.10) = 1.10
    expect(result.buyerUpfront.median).toBeCloseTo(200 * 1.10, 2);
  });

  test('near_term buyers shift +5% to upfront', () => {
    const buyer = makeBuyerProfile({
      matchScore: 0,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'near_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, waterfall, makeRNPVResult());

    // upfrontMultiplier = 1.0 * (1 + 0.05) = 1.05
    expect(result.buyerUpfront.median).toBeCloseTo(200 * 1.05, 2);
  });

  test('medium_term has no upfront boost', () => {
    const buyer = makeBuyerProfile({
      matchScore: 0,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, waterfall, makeRNPVResult());

    // upfrontMultiplier = 1.0 * (1 + 0) = 1.0
    expect(result.buyerUpfront.median).toBeCloseTo(200, 2);
  });

  test('speculative has no upfront boost', () => {
    const buyer = makeBuyerProfile({
      matchScore: 0,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'speculative',
    });
    const result = calculateBuyerSpecificValuation(buyer, waterfall, makeRNPVResult());

    expect(result.buyerUpfront.median).toBeCloseTo(200, 2);
  });

  test('upfront boost compounds with strategic premium', () => {
    // matchScore=100 => raw = 0.30, confidence=1 => 0.30, timing=imminent => 0.30*1.3 = 0.39
    // strategicPremium = 1.39, upfrontMultiplier = 1.39 * (1 + 0.10) = 1.529
    const buyer = makeBuyerProfile({
      matchScore: 100,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'imminent',
    });
    const result = calculateBuyerSpecificValuation(buyer, waterfall, makeRNPVResult());

    expect(result.buyerUpfront.median).toBeCloseTo(200 * 1.39 * 1.10, 1);
  });
});

// ---------------------------------------------------------------------------
// 7. Phase 2 option-value floor
// ---------------------------------------------------------------------------

describe('Phase 2 option-value floor', () => {
  test('floor kicks in when cumulativePoS < 0.35 and buyerUpfront.median < $60M', () => {
    const buyer = makeBuyerProfile({
      matchScore: 0,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const waterfall = makeDealWaterfall({
      upfrontPayment: { low: 5, median: 10, high: 15 },
      totalDealValue: { low: 20, median: 40, high: 60 },
    });
    const rnpv = makeRNPVResult({ cumulativePoS: 0.20 });

    const result = calculateBuyerSpecificValuation(buyer, waterfall, rnpv);

    // Floor: buyerUpfront.median >= 60, buyerUpfront.low >= 36, buyerUpfront.high >= 90
    expect(result.buyerUpfront.median).toBeGreaterThanOrEqual(60);
    expect(result.buyerUpfront.low).toBeGreaterThanOrEqual(60 * 0.6);
    expect(result.buyerUpfront.high).toBeGreaterThanOrEqual(60 * 1.5);

    // Floor: buyerSpecificDealValue.median >= 240, low >= 120, high >= 360
    expect(result.buyerSpecificDealValue.median).toBeGreaterThanOrEqual(60 * 4);
    expect(result.buyerSpecificDealValue.low).toBeGreaterThanOrEqual(60 * 2);
    expect(result.buyerSpecificDealValue.high).toBeGreaterThanOrEqual(60 * 6);
  });

  test('floor does NOT kick in when cumulativePoS >= 0.35', () => {
    const buyer = makeBuyerProfile({
      matchScore: 0,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const waterfall = makeDealWaterfall({
      upfrontPayment: { low: 5, median: 10, high: 15 },
      totalDealValue: { low: 20, median: 40, high: 60 },
    });
    const rnpv = makeRNPVResult({ cumulativePoS: 0.50 });

    const result = calculateBuyerSpecificValuation(buyer, waterfall, rnpv);

    // No floor: premium is 0, so values stay as-is
    expect(result.buyerUpfront.median).toBe(10);
    expect(result.buyerSpecificDealValue.median).toBe(40);
  });

  test('floor does NOT kick in when upfront median is already >= $60M', () => {
    const buyer = makeBuyerProfile({
      matchScore: 0,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const waterfall = makeDealWaterfall({
      upfrontPayment: { low: 50, median: 80, high: 120 },
      totalDealValue: { low: 200, median: 400, high: 600 },
    });
    const rnpv = makeRNPVResult({ cumulativePoS: 0.20 });

    const result = calculateBuyerSpecificValuation(buyer, waterfall, rnpv);

    // Even with low PoS, buyerUpfront.median = 80 (no premium) >= 60 so floor doesn't trigger
    expect(result.buyerUpfront.median).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// 8. Counterparty premium integration
// ---------------------------------------------------------------------------

describe('Counterparty premium integration', () => {
  test('high-confidence counterparty at 1.25 adds +0.25 to premium', () => {
    const buyer = makeBuyerProfile({
      matchScore: 0,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const counterparty: CounterpartyPremiumLookup = {
      multiplier: 1.25,
      confidence: 'high',
      source: 'company_wide',
    };
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult(), counterparty);

    // Raw = 0, confidence adj = 0, timing = 0, counterparty = (1.25-1)*1.0 = +0.25
    // Total = 0 + 0.25 = 0.25, capped at 0.75 => 0.25
    expect(result.strategicPremium).toBeCloseTo(1.25, 5);
    expect(result.counterpartyAdjustment).toBeDefined();
    expect(result.counterpartyAdjustment!.contribution).toBeCloseTo(0.25, 5);
    expect(result.counterpartyAdjustment!.confidence).toBe('high');
    expect(result.counterpartyAdjustment!.source).toBe('company_wide');
  });

  test('medium-confidence counterparty applies at 50%', () => {
    const buyer = makeBuyerProfile({
      matchScore: 0,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const counterparty: CounterpartyPremiumLookup = {
      multiplier: 1.40,
      confidence: 'medium',
      source: 'ta_specific',
    };
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult(), counterparty);

    // Counterparty contribution = (1.40-1) * 0.5 = 0.20
    expect(result.strategicPremium).toBeCloseTo(1.20, 5);
    expect(result.counterpartyAdjustment!.contribution).toBeCloseTo(0.20, 5);
    expect(result.counterpartyAdjustment!.confidence).toBe('medium');
  });

  test('low-confidence counterparty is ignored entirely', () => {
    const buyer = makeBuyerProfile({
      matchScore: 0,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const counterparty: CounterpartyPremiumLookup = {
      multiplier: 1.50,
      confidence: 'low',
      source: 'no_history',
    };
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult(), counterparty);

    expect(result.strategicPremium).toBe(1.0);
    expect(result.counterpartyAdjustment).toBeUndefined();
  });

  test('no counterparty premium passed gives identical behavior to pre-Item-9', () => {
    const buyer = makeBuyerProfile({
      matchScore: 70,
      intentScore: 60,
      confidence: 0.8,
      timing: 'near_term',
    });
    const waterfall = makeDealWaterfall();
    const rnpv = makeRNPVResult();

    const withoutCP = calculateBuyerSpecificValuation(buyer, waterfall, rnpv);
    const withUndefinedCP = calculateBuyerSpecificValuation(buyer, waterfall, rnpv, undefined);

    expect(withoutCP.strategicPremium).toBe(withUndefinedCP.strategicPremium);
    expect(withoutCP.counterpartyAdjustment).toBeUndefined();
    expect(withUndefinedCP.counterpartyAdjustment).toBeUndefined();
  });

  test('negative counterparty multiplier reduces the premium', () => {
    const buyer = makeBuyerProfile({
      matchScore: 50,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const counterparty: CounterpartyPremiumLookup = {
      multiplier: 0.80, // buyer historically pays 20% below median
      confidence: 'high',
      source: 'company_wide',
    };
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult(), counterparty);

    // Raw = 0.15, confidence = 0.15, timing = 0.15, counterparty = (0.80-1)*1.0 = -0.20
    // Total = 0.15 - 0.20 = -0.05, capped at -0.50 => -0.05
    expect(result.strategicPremium).toBeCloseTo(0.95, 5);
    expect(result.counterpartyAdjustment!.contribution).toBeCloseTo(-0.20, 5);
  });
});

// ---------------------------------------------------------------------------
// 9. Premium floor at -50%
// ---------------------------------------------------------------------------

describe('Premium floor at -50%', () => {
  test('negative premiums are capped at -0.50 (strategicPremium >= 0.50)', () => {
    const buyer = makeBuyerProfile({
      matchScore: 0,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const counterparty: CounterpartyPremiumLookup = {
      multiplier: 0.10, // -90% contribution = buyer historically pays 90% below median
      confidence: 'high',
      source: 'company_wide',
    };
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult(), counterparty);

    // Raw = 0, counterparty = (0.10-1)*1.0 = -0.90, total = -0.90
    // Capped at -0.50 => strategicPremium = 0.50
    expect(result.strategicPremium).toBeCloseTo(0.50, 5);
    expect(result.strategicPremiumPercent).toBeCloseTo(-50, 5);
  });

  test('premium floor holds with extremely negative counterparty', () => {
    const buyer = makeBuyerProfile({
      matchScore: 0,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const counterparty: CounterpartyPremiumLookup = {
      multiplier: -5.0, // extreme negative
      confidence: 'high',
      source: 'company_wide',
    };
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult(), counterparty);

    expect(result.strategicPremium).toBeGreaterThanOrEqual(0.50);
  });
});

// ---------------------------------------------------------------------------
// 10. Narrative generation
// ---------------------------------------------------------------------------

describe('Narrative generation', () => {
  test('narrative is a non-empty string', () => {
    const buyer = makeBuyerProfile();
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    expect(typeof result.narrative).toBe('string');
    expect(result.narrative.length).toBeGreaterThan(0);
  });

  test('timingAdvantage is a non-empty string', () => {
    const buyer = makeBuyerProfile();
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    expect(typeof result.timingAdvantage).toBe('string');
    expect(result.timingAdvantage.length).toBeGreaterThan(0);
  });

  test('narrative includes buyer company name', () => {
    const buyer = makeBuyerProfile({ companyName: 'AcquiCorp' });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    expect(result.narrative).toContain('AcquiCorp');
  });

  test('timingAdvantage includes buyer company name', () => {
    const buyer = makeBuyerProfile({ companyName: 'BuyerInc' });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    expect(result.timingAdvantage).toContain('BuyerInc');
  });

  test('imminent timing narrative mentions compressed negotiation window', () => {
    const buyer = makeBuyerProfile({ timing: 'imminent' });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    expect(result.timingAdvantage).toContain('compressed negotiation window');
  });

  test('speculative timing narrative mentions longer-term', () => {
    const buyer = makeBuyerProfile({ timing: 'speculative' });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    expect(result.timingAdvantage).toContain('not immediate');
  });

  test('near_term timing narrative mentions active BD evaluation', () => {
    const buyer = makeBuyerProfile({ timing: 'near_term' });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    expect(result.timingAdvantage).toContain('active BD evaluation');
  });

  test('low premium narrative mentions generic market terms', () => {
    const buyer = makeBuyerProfile({
      matchScore: 0,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    // premiumPct < 5 triggers generic market terms narrative
    expect(result.narrative).toContain('generic market terms');
  });

  test('high premium narrative includes strategic premium percentage', () => {
    const buyer = makeBuyerProfile({
      matchScore: 90,
      intentScore: 80,
      patentCliffPressure: 70,
      pipelineGap: 60,
      competitivePressure: 50,
      confidence: 0.9,
      timing: 'near_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    expect(result.narrative).toContain('strategic premium');
  });
});

// ---------------------------------------------------------------------------
// Additional integration tests
// ---------------------------------------------------------------------------

describe('Output structure and integration', () => {
  test('all required fields are present in the result', () => {
    const result = calculateBuyerSpecificValuation(
      makeBuyerProfile(),
      makeDealWaterfall(),
      makeRNPVResult(),
    );

    expect(result.buyer).toBeDefined();
    expect(result.genericDealValue).toBeDefined();
    expect(result.buyerSpecificDealValue).toBeDefined();
    expect(typeof result.strategicPremium).toBe('number');
    expect(typeof result.strategicPremiumPercent).toBe('number');
    expect(Array.isArray(result.premiumBreakdown)).toBe(true);
    expect(result.buyerUpfront).toBeDefined();
    expect(result.genericUpfront).toBeDefined();
    expect(typeof result.upfrontPremium).toBe('number');
    expect(typeof result.timingAdvantage).toBe('string');
    expect(['strong', 'moderate', 'limited']).toContain(result.negotiationLeverage);
    expect(typeof result.narrative).toBe('string');
  });

  test('buyerSpecificDealValue equals genericDealValue * strategicPremium (when floor is not active)', () => {
    const buyer = makeBuyerProfile({
      matchScore: 60,
      intentScore: 40,
      patentCliffPressure: 30,
      pipelineGap: 20,
      competitivePressure: 10,
      confidence: 0.7,
      timing: 'near_term',
    });
    const waterfall = makeDealWaterfall();
    const result = calculateBuyerSpecificValuation(buyer, waterfall, makeRNPVResult());

    expect(result.buyerSpecificDealValue.low).toBeCloseTo(
      waterfall.totalDealValue.low * result.strategicPremium, 2,
    );
    expect(result.buyerSpecificDealValue.median).toBeCloseTo(
      waterfall.totalDealValue.median * result.strategicPremium, 2,
    );
    expect(result.buyerSpecificDealValue.high).toBeCloseTo(
      waterfall.totalDealValue.high * result.strategicPremium, 2,
    );
  });

  test('premiumBreakdown is sorted by contribution descending', () => {
    const buyer = makeBuyerProfile({
      matchScore: 90,
      intentScore: 20,
      patentCliffPressure: 60,
      pipelineGap: 40,
      competitivePressure: 80,
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    for (let i = 1; i < result.premiumBreakdown.length; i++) {
      expect(result.premiumBreakdown[i - 1].contribution).toBeGreaterThanOrEqual(
        result.premiumBreakdown[i].contribution,
      );
    }
  });

  test('negotiation leverage is strong when strategicPremium >= 1.30', () => {
    const buyer = makeBuyerProfile({
      matchScore: 100,
      intentScore: 100,
      patentCliffPressure: 100,
      pipelineGap: 100,
      competitivePressure: 100,
      confidence: 1,
      timing: 'imminent',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());
    expect(result.negotiationLeverage).toBe('strong');
  });

  test('negotiation leverage is moderate when 1.10 <= strategicPremium < 1.30', () => {
    // matchScore=50 => raw = 0.15, confidence=1, timing=medium_term => premium = 0.15
    const buyer = makeBuyerProfile({
      matchScore: 50,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());
    // strategicPremium = 1.15
    expect(result.strategicPremium).toBeCloseTo(1.15, 5);
    expect(result.negotiationLeverage).toBe('moderate');
  });

  test('negotiation leverage is limited when strategicPremium < 1.10', () => {
    const buyer = makeBuyerProfile({
      matchScore: 10,
      intentScore: 0,
      patentCliffPressure: 0,
      pipelineGap: 0,
      competitivePressure: 0,
      confidence: 1,
      timing: 'medium_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());
    // Raw = (10/100)*0.30 = 0.03, strategicPremium = 1.03
    expect(result.strategicPremium).toBeCloseTo(1.03, 5);
    expect(result.negotiationLeverage).toBe('limited');
  });

  test('upfrontPremium equals buyerUpfront.median minus genericUpfront.median', () => {
    const buyer = makeBuyerProfile({
      matchScore: 60,
      intentScore: 40,
      confidence: 0.7,
      timing: 'near_term',
    });
    const result = calculateBuyerSpecificValuation(buyer, makeDealWaterfall(), makeRNPVResult());

    expect(result.upfrontPremium).toBeCloseTo(
      result.buyerUpfront.median - result.genericUpfront.median, 2,
    );
  });
});
