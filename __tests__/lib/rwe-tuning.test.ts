/**
 * Tests for lib/financial/rwe-tuning.ts (Item 10 — Tier 3)
 *
 * Validates the backtest engine, bias aggregation, bounded delta proposals,
 * and held-out validation against synthetic and real index drug data.
 */

import {
  runRWEBacktest,
  buildRetrospectiveInput,
  backtestDrug,
  computeRecommendedAdjustment,
  computeTuningDeltas,
  computeHoldoutValidation,
  DELTA_CAP,
  MIN_SLICE_N,
  __test,
} from '@/lib/financial/rwe-tuning';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import { INDEX_DRUG_DATABASE, type IndexDrug } from '@/lib/financial/index-drugs';
import type { RNPVInput, RNPVResult, DrugBacktest, BiasAggregate } from '@/lib/financial/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDrug(overrides: Partial<IndexDrug> = {}): IndexDrug {
  return {
    name: 'TestDrug',
    company: 'TestCo',
    modality: 'mab',
    peakSalesM: 5000,
    peakSalesYear: 2024,
    currentSalesM: 4500,
    indication: 'lung_nsclc',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 50000,
    ...overrides,
  };
}

function makeBacktest(overrides: Partial<DrugBacktest> = {}): DrugBacktest {
  return {
    drugName: 'TestDrug',
    company: 'TestCo',
    therapeuticArea: 'oncology',
    modality: 'mab',
    indication: 'lung_nsclc',
    actualPeakM: 5000,
    modelPeakM: 5500,
    errorPct: 0.10,
    errorAbsM: 500,
    notes: 'ok',
    ...overrides,
  };
}

/**
 * Stub rNPV calculator that returns a deterministic peak from a benchmark.
 * Used in unit tests to avoid coupling to the real engine's bias.
 */
function stubRNPV(scaleFactor: number = 1.0): (input: RNPVInput) => RNPVResult {
  return (input: RNPVInput): RNPVResult => {
    const peak = (input.peakSalesEstimate?.median ?? 0) * scaleFactor;
    return {
      riskAdjustedNPV: peak * 0.5,
      unadjustedNPV: peak,
      cumulativePoS: 1.0,
      phaseTransitions: [],
      cashFlows: [
        { year: 2024, revenue: peak * 0.5, cogs: 0, grossProfit: 0, rdCosts: 0, sgaCosts: 0, netCashFlow: 0, discountFactor: 1, presentValue: 0, cumulativePoS: 1, riskAdjustedPV: 0 },
        { year: 2025, revenue: peak, cogs: 0, grossProfit: 0, rdCosts: 0, sgaCosts: 0, netCashFlow: 0, discountFactor: 1, presentValue: 0, cumulativePoS: 1, riskAdjustedPV: 0 },
        { year: 2026, revenue: peak * 0.95, cogs: 0, grossProfit: 0, rdCosts: 0, sgaCosts: 0, netCashFlow: 0, discountFactor: 1, presentValue: 0, cumulativePoS: 1, riskAdjustedPV: 0 },
      ],
      peakSalesYear: 2025,
      yearsToMarket: 0,
      impliedDealValue: {
        upfront: { low: 0, median: 0, high: 0 },
        totalDeal: { low: 0, median: 0, high: 0 },
      },
      discountRate: 0.10,
      terminalValue: 0,
      modelAssumptions: [],
    };
  };
}

// ---------------------------------------------------------------------------
// buildRetrospectiveInput
// ---------------------------------------------------------------------------

describe('buildRetrospectiveInput', () => {
  test('produces an RNPVInput with phase=approved', () => {
    const drug = makeDrug();
    const input = buildRetrospectiveInput(drug);
    expect(input.phase).toBe('approved');
  });

  test('benchmark deal value scales with peak sales', () => {
    const drug = makeDrug({ peakSalesM: 1000 });
    const input = buildRetrospectiveInput(drug);
    expect(input.benchmarkDealValue?.median).toBeGreaterThan(0);
    expect(input.benchmarkDealValue?.median).toBeLessThan(drug.peakSalesM);
  });

  test('peak sales estimate centers on actual peak', () => {
    const drug = makeDrug({ peakSalesM: 5000 });
    const input = buildRetrospectiveInput(drug);
    expect(input.peakSalesEstimate?.median).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// backtestDrug
// ---------------------------------------------------------------------------

describe('backtestDrug', () => {
  test('returns a backtest record for a normal drug', () => {
    const drug = makeDrug({ peakSalesM: 5000 });
    const result = backtestDrug(drug, stubRNPV(1.0));
    expect(result).not.toBeNull();
    expect(result!.actualPeakM).toBe(5000);
    expect(result!.modelPeakM).toBeGreaterThan(0);
  });

  test('returns null when peak sales below minimum threshold', () => {
    const drug = makeDrug({ peakSalesM: 10 });
    expect(backtestDrug(drug, stubRNPV())).toBeNull();
  });

  test('returns null when therapeuticArea is missing', () => {
    const drug = makeDrug({ therapeuticArea: '' });
    expect(backtestDrug(drug, stubRNPV())).toBeNull();
  });

  test('errorPct positive when model overshoots', () => {
    const drug = makeDrug({ peakSalesM: 1000 });
    const result = backtestDrug(drug, stubRNPV(1.5))!; // model returns 1.5× input
    expect(result.errorPct).toBeGreaterThan(0);
  });

  test('errorPct negative when model undershoots', () => {
    const drug = makeDrug({ peakSalesM: 1000 });
    const result = backtestDrug(drug, stubRNPV(0.6))!;
    expect(result.errorPct).toBeLessThan(0);
  });

  test('catches calculator exceptions and records as note', () => {
    const throwingCalc = () => { throw new Error('boom'); };
    const drug = makeDrug();
    const result = backtestDrug(drug, throwingCalc as any);
    expect(result).not.toBeNull();
    expect(result!.notes).toMatch(/error: boom/);
    expect(result!.modelPeakM).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeRecommendedAdjustment
// ---------------------------------------------------------------------------

describe('computeRecommendedAdjustment', () => {
  test('returns 1.0 for zero error', () => {
    expect(computeRecommendedAdjustment(0)).toBeCloseTo(1.0, 9);
  });

  test('returns < 1 when model overshoots', () => {
    expect(computeRecommendedAdjustment(0.30)).toBeLessThan(1);
  });

  test('returns > 1 when model undershoots', () => {
    expect(computeRecommendedAdjustment(-0.20)).toBeGreaterThan(1);
  });

  test('clamps overshoot to 1 - DELTA_CAP', () => {
    // 100% overshoot would naively scale to 0.5; clamped to 0.85
    const adj = computeRecommendedAdjustment(1.0);
    expect(adj).toBeCloseTo(1 - DELTA_CAP, 5);
  });

  test('clamps undershoot to 1 + DELTA_CAP', () => {
    // 50% undershoot would naively scale to 2.0; clamped to 1.15
    const adj = computeRecommendedAdjustment(-0.50);
    expect(adj).toBeCloseTo(1 + DELTA_CAP, 5);
  });

  test('returns 1.0 for non-finite input', () => {
    expect(computeRecommendedAdjustment(NaN)).toBe(1.0);
    expect(computeRecommendedAdjustment(Infinity)).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// aggregateBy (via internal access)
// ---------------------------------------------------------------------------

describe('aggregation', () => {
  test('groups with n < MIN_SLICE_N are excluded', () => {
    const backtests = Array.from({ length: 4 }, (_, i) =>
      makeBacktest({ drugName: `Drug${i}`, therapeuticArea: 'oncology' }),
    );
    const aggregates = __test.aggregateBy(backtests, 'therapeutic_area', b => b.therapeuticArea);
    expect(aggregates).toHaveLength(0);
  });

  test('group with n ≥ MIN_SLICE_N produces an aggregate', () => {
    const backtests = Array.from({ length: MIN_SLICE_N }, (_, i) =>
      makeBacktest({ drugName: `Drug${i}`, errorPct: 0.10 }),
    );
    const aggregates = __test.aggregateBy(backtests, 'therapeutic_area', b => b.therapeuticArea);
    expect(aggregates).toHaveLength(1);
    expect(aggregates[0].sampleSize).toBe(MIN_SLICE_N);
    expect(aggregates[0].meanError).toBeCloseTo(0.10, 5);
  });

  test('aggregates are sorted by absolute meanError descending', () => {
    const make = (ta: string, error: number) =>
      Array.from({ length: MIN_SLICE_N }, (_, i) =>
        makeBacktest({ drugName: `${ta}-${i}`, therapeuticArea: ta, errorPct: error }),
      );
    const backtests = [...make('a', 0.05), ...make('b', 0.30), ...make('c', -0.20)];
    const aggregates = __test.aggregateBy(backtests, 'therapeutic_area', b => b.therapeuticArea);
    expect(aggregates[0].group).toBe('b'); // |0.30| largest
    expect(aggregates[1].group).toBe('c'); // |0.20|
    expect(aggregates[2].group).toBe('a'); // |0.05|
  });
});

// ---------------------------------------------------------------------------
// computeTuningDeltas
// ---------------------------------------------------------------------------

describe('computeTuningDeltas', () => {
  test('returns deltas only for non-zero adjustments', () => {
    const biasByTA: BiasAggregate[] = [
      { group: 'oncology', groupType: 'therapeutic_area', meanError: 0.30, medianError: 0.25, rmseM: 1000, sampleSize: 10, recommendedAdjustment: 0.85 },
      { group: 'neurology', groupType: 'therapeutic_area', meanError: 0.001, medianError: 0, rmseM: 100, sampleSize: 6, recommendedAdjustment: 1.0 },
    ];
    const deltas = computeTuningDeltas(biasByTA, []);
    expect(deltas).toHaveLength(1);
    expect(deltas[0].parameter).toBe('PEAK_SALES_CAP.oncology.median');
  });

  test('all proposed deltas are within ±15% of currentValue', () => {
    const biasByTA: BiasAggregate[] = [
      { group: 'oncology', groupType: 'therapeutic_area', meanError: 1.5, medianError: 1.0, rmseM: 2000, sampleSize: 20, recommendedAdjustment: 0.85 },
      { group: 'rareDisease', groupType: 'therapeutic_area', meanError: -0.8, medianError: -0.5, rmseM: 800, sampleSize: 15, recommendedAdjustment: 1.15 },
    ];
    const deltas = computeTuningDeltas(biasByTA, []);
    for (const d of deltas) {
      const ratio = d.proposedValue / d.currentValue;
      expect(ratio).toBeGreaterThanOrEqual(1 - DELTA_CAP - 1e-9);
      expect(ratio).toBeLessThanOrEqual(1 + DELTA_CAP + 1e-9);
    }
  });

  test('rationale includes direction and sample size', () => {
    const biasByTA: BiasAggregate[] = [
      { group: 'oncology', groupType: 'therapeutic_area', meanError: 0.30, medianError: 0.25, rmseM: 1000, sampleSize: 10, recommendedAdjustment: 0.85 },
    ];
    const deltas = computeTuningDeltas(biasByTA, []);
    expect(deltas[0].rationale).toMatch(/overshoots|undershoots/);
    expect(deltas[0].rationale).toMatch(/10 drugs/);
  });
});

// ---------------------------------------------------------------------------
// Hold-out validation
// ---------------------------------------------------------------------------

describe('held-out validation', () => {
  test('isHoldout is deterministic for the same name', () => {
    const a = __test.isHoldout('Keytruda');
    const b = __test.isHoldout('Keytruda');
    expect(a).toBe(b);
  });

  test('isHoldout produces ≈20% holdout rate over many drugs', () => {
    const names = Array.from({ length: 1000 }, (_, i) => `Drug${i}`);
    const holdoutCount = names.filter(n => __test.isHoldout(n)).length;
    // Allow loose tolerance — hash distribution is not perfectly uniform
    expect(holdoutCount).toBeGreaterThan(120);
    expect(holdoutCount).toBeLessThan(280);
  });

  test('returns undefined when fewer than 10 backtests', () => {
    const backtests = Array.from({ length: 5 }, (_, i) => makeBacktest({ drugName: `Drug${i}` }));
    const validation = computeHoldoutValidation(backtests);
    expect(validation).toBeUndefined();
  });

  test('returns sample size + RMSE pair for sufficient backtests', () => {
    const backtests = Array.from({ length: 50 }, (_, i) =>
      makeBacktest({ drugName: `Drug${i}`, actualPeakM: 1000, modelPeakM: 1100 }),
    );
    const validation = computeHoldoutValidation(backtests);
    expect(validation).toBeDefined();
    expect(validation!.sampleSize).toBeGreaterThan(0);
    expect(validation!.holdoutRmse).toBeGreaterThanOrEqual(0);
    expect(validation!.fullRmse).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Full runRWEBacktest
// ---------------------------------------------------------------------------

describe('runRWEBacktest', () => {
  test('runs on a small fixture without errors', () => {
    const drugs = Array.from({ length: 8 }, (_, i) =>
      makeDrug({ name: `Drug${i}`, peakSalesM: 1000 + i * 200 }),
    );
    const result = runRWEBacktest(drugs, stubRNPV(1.0));
    expect(result.totalDrugsAnalyzed).toBe(8);
    expect(result.drugsSkipped).toBe(0);
    expect(result.backtests).toHaveLength(8);
    expect(Number.isFinite(result.overallRmse)).toBe(true);
    expect(Number.isFinite(result.overallMape)).toBe(true);
  });

  test('counts skipped drugs correctly', () => {
    const drugs = [
      makeDrug({ name: 'KeepMe', peakSalesM: 5000 }),
      makeDrug({ name: 'TooSmall', peakSalesM: 10 }),
      makeDrug({ name: 'NoTA', peakSalesM: 5000, therapeuticArea: '' }),
    ];
    const result = runRWEBacktest(drugs, stubRNPV());
    expect(result.totalDrugsAnalyzed).toBe(1);
    expect(result.drugsSkipped).toBe(2);
  });

  test('drift alert fires when RMSE jumps > 20%', () => {
    const drugs = Array.from({ length: 10 }, (_, i) =>
      makeDrug({ name: `Drug${i}`, peakSalesM: 1000 }),
    );
    // stubRNPV(2.0) → model = 2× actual → big RMSE
    const result = runRWEBacktest(drugs, stubRNPV(2.0), 100);
    expect(result.driftAlert).toBe(true);
  });

  test('drift alert does not fire when RMSE stable', () => {
    const drugs = Array.from({ length: 10 }, (_, i) =>
      makeDrug({ name: `Drug${i}`, peakSalesM: 1000 }),
    );
    const result = runRWEBacktest(drugs, stubRNPV(1.0));
    // Pass a baseline equal to current — no drift
    const stableRun = runRWEBacktest(drugs, stubRNPV(1.0), result.overallRmse);
    expect(stableRun.driftAlert).toBe(false);
  });

  test('produces TA bias aggregates for slices with n ≥ 5', () => {
    const drugs = [
      ...Array.from({ length: 6 }, (_, i) => makeDrug({ name: `Onc${i}`, therapeuticArea: 'oncology' })),
      ...Array.from({ length: 6 }, (_, i) => makeDrug({ name: `Neu${i}`, therapeuticArea: 'neurology' })),
    ];
    const result = runRWEBacktest(drugs, stubRNPV(1.2));
    expect(result.biasByTA.length).toBeGreaterThanOrEqual(2);
    const onc = result.biasByTA.find(b => b.group === 'oncology');
    expect(onc).toBeDefined();
    expect(onc!.sampleSize).toBe(6);
  });

  test('proposed deltas all bounded to ±15%', () => {
    const drugs = Array.from({ length: 20 }, (_, i) =>
      makeDrug({ name: `Drug${i}`, peakSalesM: 1000, therapeuticArea: 'oncology' }),
    );
    const result = runRWEBacktest(drugs, stubRNPV(2.0));
    for (const d of result.proposedTuningDeltas) {
      expect(Math.abs(d.proposedValue / d.currentValue - 1)).toBeLessThanOrEqual(DELTA_CAP + 1e-9);
    }
  });
});

// ---------------------------------------------------------------------------
// Real-world: index drug database
// ---------------------------------------------------------------------------

describe('integration: full INDEX_DRUG_DATABASE', () => {
  test('runs against the real engine without crashing', () => {
    const result = runRWEBacktest(INDEX_DRUG_DATABASE, calculateRNPV);
    expect(result.totalDrugsAnalyzed).toBeGreaterThan(0);
    expect(result.totalDrugsAnalyzed + result.drugsSkipped).toBe(INDEX_DRUG_DATABASE.length);
  }, 60000);

  test('overall RMSE is finite and non-negative', () => {
    const result = runRWEBacktest(INDEX_DRUG_DATABASE, calculateRNPV);
    expect(Number.isFinite(result.overallRmse)).toBe(true);
    expect(result.overallRmse).toBeGreaterThanOrEqual(0);
  }, 60000);

  test('produces bias aggregates for at least the major TAs', () => {
    const result = runRWEBacktest(INDEX_DRUG_DATABASE, calculateRNPV);
    const taGroups = result.biasByTA.map(b => b.group);
    // The major TAs should each have ≥ MIN_SLICE_N drugs
    expect(taGroups).toEqual(expect.arrayContaining(['oncology']));
  }, 60000);

  test('every proposed delta is within ±15%', () => {
    const result = runRWEBacktest(INDEX_DRUG_DATABASE, calculateRNPV);
    for (const d of result.proposedTuningDeltas) {
      const ratio = d.proposedValue / d.currentValue;
      expect(ratio).toBeGreaterThanOrEqual(1 - DELTA_CAP - 1e-9);
      expect(ratio).toBeLessThanOrEqual(1 + DELTA_CAP + 1e-9);
    }
  }, 60000);
});
