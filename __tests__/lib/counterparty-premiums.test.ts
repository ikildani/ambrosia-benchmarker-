/**
 * Tests for lib/financial/counterparty-premiums.ts (Item 9 — Tier 3)
 *
 * Validates per-buyer premium calculation, lookup logic, and the integration
 * with calculateBuyerSpecificValuation. Each test uses synthetic deal/company
 * fixtures so failures pinpoint logic bugs (no DB dependency).
 */

import {
  computeCounterpartyPremiums,
  getCounterpartyPremium,
  __test,
  type DealRow,
  type CompanyRow,
} from '@/lib/financial/counterparty-premiums';
import {
  calculateBuyerSpecificValuation,
  type BuyerProfile,
} from '@/lib/financial/buyer-specific-valuation';
import type { DealWaterfall, RNPVResult, CounterpartyPremiumLookup } from '@/lib/financial/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDeal(id: string, overrides: Partial<DealRow> = {}): DealRow {
  return {
    id,
    licensee_id: 'buyer-1',
    licensee_name: 'TestPharma',
    indication_category: 'lung_nsclc',
    phase_at_signing: 'phase_2',
    total_deal_value_usd: 1_000_000_000, // $1B
    therapeutic_area: 'oncology',
    ...overrides,
  };
}

function makeCompany(id: string, name: string): CompanyRow {
  return { id, name };
}

function makeBuyerProfile(overrides: Partial<BuyerProfile> = {}): BuyerProfile {
  return {
    companyName: 'TestPharma',
    companyId: 'buyer-1',
    matchScore: 70,
    intentScore: 60,
    intentTier: 'high',
    timing: 'active',
    confidence: 0.8,
    dealsLast12mo: 5,
    patentCliffPressure: 50,
    pipelineGap: 50,
    dealVelocity: 50,
    competitivePressure: 50,
    ...overrides,
  };
}

function makeDealWaterfall(): DealWaterfall {
  return {
    steps: [],
    upfrontPayment: { low: 100, median: 200, high: 300 },
    developmentMilestones: { low: 100, median: 200, high: 300 },
    commercialMilestones: { low: 200, median: 400, high: 600 },
    royaltyRate: { low: 0.05, median: 0.10, high: 0.15 },
    totalDealValue: { low: 500, median: 1000, high: 1500 },
    narrative: 'test',
  };
}

function makeRNPVResult(): RNPVResult {
  return {
    riskAdjustedNPV: 1000,
    unadjustedNPV: 5000,
    cumulativePoS: 0.20,
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
  };
}

// ---------------------------------------------------------------------------
// Helpers under test
// ---------------------------------------------------------------------------

describe('helpers', () => {
  test('median of odd-length array', () => {
    expect(__test.median([1, 2, 3, 4, 5])).toBe(3);
  });

  test('median of even-length array', () => {
    expect(__test.median([1, 2, 3, 4])).toBe(2.5);
  });

  test('trimmedMean falls back to simple mean for n < 10', () => {
    expect(__test.trimmedMean([1, 2, 3, 4, 5])).toBe(3);
  });

  test('trimmedMean trims top/bottom 10% for n ≥ 10', () => {
    // 10 values: trim 1 from each end (10%)
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    // Trimmed: [2..9] → mean = (2+3+4+5+6+7+8+9)/8 = 5.5
    expect(__test.trimmedMean(values)).toBeCloseTo(5.5, 5);
  });

  test('clamp respects bounds', () => {
    expect(__test.clamp(0.5, 0.7, 1.5)).toBe(0.7);
    expect(__test.clamp(2.0, 0.7, 1.5)).toBe(1.5);
    expect(__test.clamp(1.0, 0.7, 1.5)).toBe(1.0);
  });

  test('confidenceFromN brackets', () => {
    expect(__test.confidenceFromN(3)).toBe('low');
    expect(__test.confidenceFromN(4)).toBe('low');
    expect(__test.confidenceFromN(5)).toBe('medium');
    expect(__test.confidenceFromN(9)).toBe('medium');
    expect(__test.confidenceFromN(10)).toBe('high');
    expect(__test.confidenceFromN(50)).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// computeCounterpartyPremiums
// ---------------------------------------------------------------------------

describe('computeCounterpartyPremiums', () => {
  test('buyer below minimum deals threshold is excluded', () => {
    const deals: DealRow[] = [
      makeDeal('1', { licensee_id: 'buyer-1' }),
      makeDeal('2', { licensee_id: 'buyer-1' }),
      // peer pool — different buyer, same indication
      makeDeal('p1', { licensee_id: 'other-1' }),
      makeDeal('p2', { licensee_id: 'other-2' }),
      makeDeal('p3', { licensee_id: 'other-3' }),
      makeDeal('p4', { licensee_id: 'other-4' }),
      makeDeal('p5', { licensee_id: 'other-5' }),
    ];
    const companies = [makeCompany('buyer-1', 'TestPharma')];
    const result = computeCounterpartyPremiums(deals, companies);
    // buyer-1 has only 2 deals → excluded
    expect(result.find(r => r.companyId === 'buyer-1')).toBeUndefined();
  });

  test('buyer with 3 deals at exactly the median produces premium ≈ 1.0', () => {
    // Build a peer pool of 5 deals at $1B median
    const peers = [1, 2, 3, 4, 5].map(i =>
      makeDeal(`peer-${i}`, { licensee_id: `peer-${i}`, total_deal_value_usd: 1_000_000_000 }),
    );
    // Buyer has 3 deals also at $1B
    const buyer = [1, 2, 3].map(i =>
      makeDeal(`buyer-deal-${i}`, { licensee_id: 'buyer-1', total_deal_value_usd: 1_000_000_000 }),
    );
    const result = computeCounterpartyPremiums([...peers, ...buyer], [makeCompany('buyer-1', 'TestPharma')]);
    const premium = result.find(r => r.companyId === 'buyer-1');
    expect(premium).toBeDefined();
    expect(premium!.premiumMultiplier).toBeCloseTo(1.0, 5);
    expect(premium!.confidence).toBe('low'); // n=3
  });

  test('buyer paying 2x median is clamped to 1.5', () => {
    const peers = [1, 2, 3, 4, 5].map(i =>
      makeDeal(`peer-${i}`, { licensee_id: `peer-${i}`, total_deal_value_usd: 1_000_000_000 }),
    );
    const buyer = [1, 2, 3].map(i =>
      makeDeal(`buyer-deal-${i}`, {
        licensee_id: 'buyer-1',
        total_deal_value_usd: 2_000_000_000,
      }),
    );
    const result = computeCounterpartyPremiums([...peers, ...buyer], [makeCompany('buyer-1', 'TestPharma')]);
    const premium = result.find(r => r.companyId === 'buyer-1');
    expect(premium!.premiumMultiplier).toBe(1.5);
  });

  test('buyer paying 0.5x is clamped to 0.7', () => {
    const peers = [1, 2, 3, 4, 5].map(i =>
      makeDeal(`peer-${i}`, { licensee_id: `peer-${i}`, total_deal_value_usd: 1_000_000_000 }),
    );
    const buyer = [1, 2, 3].map(i =>
      makeDeal(`buyer-deal-${i}`, {
        licensee_id: 'buyer-1',
        total_deal_value_usd: 500_000_000,
      }),
    );
    const result = computeCounterpartyPremiums([...peers, ...buyer], [makeCompany('buyer-1', 'TestPharma')]);
    const premium = result.find(r => r.companyId === 'buyer-1');
    expect(premium!.premiumMultiplier).toBe(0.7);
  });

  test('large buyer with 12 deals gets high confidence', () => {
    const peers = Array.from({ length: 6 }, (_, i) =>
      makeDeal(`peer-${i}`, { licensee_id: `peer-${i}`, total_deal_value_usd: 1_000_000_000 }),
    );
    const buyer = Array.from({ length: 12 }, (_, i) =>
      makeDeal(`buyer-deal-${i}`, {
        licensee_id: 'buyer-1',
        total_deal_value_usd: 1_200_000_000, // 1.2x median
      }),
    );
    const result = computeCounterpartyPremiums([...peers, ...buyer], [makeCompany('buyer-1', 'TestPharma')]);
    const premium = result.find(r => r.companyId === 'buyer-1');
    expect(premium!.confidence).toBe('high');
    expect(premium!.premiumMultiplier).toBeCloseTo(1.2, 2);
  });

  test('outlier deal does not unduly inflate trimmed mean', () => {
    const peers = Array.from({ length: 6 }, (_, i) =>
      makeDeal(`peer-${i}`, { licensee_id: `peer-${i}`, total_deal_value_usd: 1_000_000_000 }),
    );
    // 9 deals at 1.1x + 1 outlier deal at 5x (gets clamped, but tests aggregation)
    const buyer = [
      ...Array.from({ length: 9 }, (_, i) =>
        makeDeal(`buyer-deal-${i}`, {
          licensee_id: 'buyer-1',
          total_deal_value_usd: 1_100_000_000,
        }),
      ),
      makeDeal('buyer-outlier', { licensee_id: 'buyer-1', total_deal_value_usd: 5_000_000_000 }),
    ];
    const result = computeCounterpartyPremiums([...peers, ...buyer], [makeCompany('buyer-1', 'TestPharma')]);
    const premium = result.find(r => r.companyId === 'buyer-1');
    // Without trimming: mean ≈ ((9 × 1.1) + 5) / 10 = 1.49, clamped to 1.49
    // With trimming (top/bottom 10% = drop 1 each): mean of 8 values, all 1.1, = 1.1
    expect(premium!.premiumMultiplier).toBeLessThan(1.3);
  });

  test('TA-specific slice surfaces when sample is large enough', () => {
    const peers = Array.from({ length: 6 }, (_, i) =>
      makeDeal(`peer-${i}`, { licensee_id: `peer-${i}`, total_deal_value_usd: 1_000_000_000 }),
    );
    const buyer = Array.from({ length: 5 }, (_, i) =>
      makeDeal(`buyer-deal-${i}`, {
        licensee_id: 'buyer-1',
        total_deal_value_usd: 1_300_000_000,
        therapeutic_area: 'oncology',
      }),
    );
    const result = computeCounterpartyPremiums([...peers, ...buyer], [makeCompany('buyer-1', 'TestPharma')]);
    const premium = result.find(r => r.companyId === 'buyer-1');
    expect(premium!.byTherapeuticArea.oncology).toBeDefined();
    expect(premium!.byTherapeuticArea.oncology.n).toBe(5);
  });

  test('every premium falls within clamp range [0.7, 1.5]', () => {
    // Try several wild premium scenarios
    const scenarios = [0.3, 0.6, 1.0, 1.4, 2.5, 4.0];
    for (const ratio of scenarios) {
      const peers = Array.from({ length: 6 }, (_, i) =>
        makeDeal(`peer-${i}-${ratio}`, { licensee_id: `peer-${i}-${ratio}`, total_deal_value_usd: 1_000_000_000 }),
      );
      const buyer = Array.from({ length: 5 }, (_, i) =>
        makeDeal(`buyer-${i}-${ratio}`, {
          licensee_id: `buyer-${ratio}`,
          total_deal_value_usd: ratio * 1_000_000_000,
        }),
      );
      const result = computeCounterpartyPremiums(
        [...peers, ...buyer],
        [makeCompany(`buyer-${ratio}`, 'TestPharma')],
      );
      if (result.length > 0) {
        expect(result[0].premiumMultiplier).toBeGreaterThanOrEqual(0.7);
        expect(result[0].premiumMultiplier).toBeLessThanOrEqual(1.5);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getCounterpartyPremium lookup
// ---------------------------------------------------------------------------

describe('getCounterpartyPremium lookup', () => {
  const premiums = [
    {
      companyId: 'abbvie',
      companyName: 'AbbVie',
      premiumMultiplier: 1.25,
      sampleSize: 12,
      confidence: 'high' as const,
      byTherapeuticArea: { oncology: { premium: 1.30, n: 6 } },
      byPhase: { phase_2: { premium: 1.20, n: 5 } },
      asOfDate: '2026-04-10',
      calculationNotes: 'test',
    },
  ];

  test('unknown company → no_history fallback', () => {
    const result = getCounterpartyPremium('unknown-id', premiums);
    expect(result.multiplier).toBe(1.0);
    expect(result.source).toBe('no_history');
    expect(result.confidence).toBe('low');
  });

  test('known company without context → company_wide', () => {
    const result = getCounterpartyPremium('abbvie', premiums);
    expect(result.multiplier).toBe(1.25);
    expect(result.source).toBe('company_wide');
  });

  test('known company with TA context → ta_specific when n ≥ 5', () => {
    const result = getCounterpartyPremium('abbvie', premiums, { therapeuticArea: 'oncology' });
    expect(result.multiplier).toBe(1.30);
    expect(result.source).toBe('ta_specific');
  });

  test('known company with phase context → phase_specific when n ≥ 5', () => {
    const result = getCounterpartyPremium('abbvie', premiums, { phase: 'phase2' });
    expect(result.multiplier).toBe(1.20);
    expect(result.source).toBe('phase_specific');
  });

  test('phase context with sparse phase slice falls back to company_wide', () => {
    const sparse = [
      {
        ...premiums[0],
        byPhase: { phase_2: { premium: 1.20, n: 3 } }, // n < 5
      },
    ];
    const result = getCounterpartyPremium('abbvie', sparse, { phase: 'phase2' });
    expect(result.source).toBe('company_wide');
    expect(result.multiplier).toBe(1.25);
  });
});

// ---------------------------------------------------------------------------
// Integration: counterparty premium → buyer-specific valuation
// ---------------------------------------------------------------------------

describe('integration with calculateBuyerSpecificValuation', () => {
  test('without counterparty premium → behaves identically to pre-Item-9', () => {
    const buyer = makeBuyerProfile();
    const wf = makeDealWaterfall();
    const rnpv = makeRNPVResult();
    const result = calculateBuyerSpecificValuation(buyer, wf, rnpv);
    expect(result.counterpartyAdjustment).toBeUndefined();
    expect(result.strategicPremium).toBeGreaterThan(0);
  });

  test('high-confidence counterparty premium increases dealValue', () => {
    const buyer = makeBuyerProfile();
    const wf = makeDealWaterfall();
    const rnpv = makeRNPVResult();
    const baseline = calculateBuyerSpecificValuation(buyer, wf, rnpv);
    const cp: CounterpartyPremiumLookup = {
      multiplier: 1.25,
      confidence: 'high',
      source: 'company_wide',
    };
    const adjusted = calculateBuyerSpecificValuation(buyer, wf, rnpv, cp);
    expect(adjusted.buyerSpecificDealValue.median).toBeGreaterThan(
      baseline.buyerSpecificDealValue.median,
    );
    expect(adjusted.counterpartyAdjustment?.contribution).toBeCloseTo(0.25, 5);
    expect(adjusted.counterpartyAdjustment?.confidence).toBe('high');
  });

  test('medium-confidence counterparty contributes 50%', () => {
    const buyer = makeBuyerProfile();
    const wf = makeDealWaterfall();
    const rnpv = makeRNPVResult();
    const cp: CounterpartyPremiumLookup = {
      multiplier: 1.25,
      confidence: 'medium',
      source: 'company_wide',
    };
    const adjusted = calculateBuyerSpecificValuation(buyer, wf, rnpv, cp);
    // medium = 50% of (1.25 - 1) = 0.125
    expect(adjusted.counterpartyAdjustment?.contribution).toBeCloseTo(0.125, 5);
  });

  test('low-confidence counterparty premium is ignored', () => {
    const buyer = makeBuyerProfile();
    const wf = makeDealWaterfall();
    const rnpv = makeRNPVResult();
    const baseline = calculateBuyerSpecificValuation(buyer, wf, rnpv);
    const cp: CounterpartyPremiumLookup = {
      multiplier: 1.25,
      confidence: 'low',
      source: 'company_wide',
    };
    const adjusted = calculateBuyerSpecificValuation(buyer, wf, rnpv, cp);
    expect(adjusted.counterpartyAdjustment).toBeUndefined();
    expect(adjusted.buyerSpecificDealValue.median).toBeCloseTo(
      baseline.buyerSpecificDealValue.median,
      5,
    );
  });

  test('strategic premium cap holds even with very generous counterparty', () => {
    const buyer = makeBuyerProfile({
      matchScore: 100,
      intentScore: 100,
      patentCliffPressure: 100,
      pipelineGap: 100,
      competitivePressure: 100,
      confidence: 1,
      timing: 'imminent',
    });
    const wf = makeDealWaterfall();
    const rnpv = makeRNPVResult();
    const cp: CounterpartyPremiumLookup = {
      multiplier: 1.5, // very generous buyer, max clamp
      confidence: 'high',
      source: 'company_wide',
    };
    const result = calculateBuyerSpecificValuation(buyer, wf, rnpv, cp);
    // strategicPremium capped at 1 + 0.75 = 1.75
    expect(result.strategicPremium).toBeLessThanOrEqual(1.75 + 1e-9);
    expect(result.buyerSpecificDealValue.median).toBeLessThanOrEqual(
      wf.totalDealValue.median * 1.75 + 1e-6,
    );
  });

  test('discount counterparty (multiplier < 1) reduces deal value', () => {
    const buyer = makeBuyerProfile({
      matchScore: 30,
      intentScore: 30,
      patentCliffPressure: 30,
      pipelineGap: 30,
      competitivePressure: 30,
    });
    const wf = makeDealWaterfall();
    const rnpv = makeRNPVResult();
    const baseline = calculateBuyerSpecificValuation(buyer, wf, rnpv);
    const cp: CounterpartyPremiumLookup = {
      multiplier: 0.85,
      confidence: 'high',
      source: 'company_wide',
    };
    const adjusted = calculateBuyerSpecificValuation(buyer, wf, rnpv, cp);
    expect(adjusted.buyerSpecificDealValue.median).toBeLessThan(
      baseline.buyerSpecificDealValue.median,
    );
  });
});
