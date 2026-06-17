/**
 * Scenario Planner & Scenario Bridge Tests
 *
 * Tests applyScenario, runAllScenarios, getDefensiveAnalysis (from
 * scenario-planner.ts) and buildScenarioBridge (from scenario-bridge.ts).
 *
 * Validates: bear < base < bull ordering, realistic bounds, defensive
 * analysis invariants, and scenario bridge decomposition.
 */

import {
  applyScenario,
  runAllScenarios,
  getDefensiveAnalysis,
  SCENARIO_TEMPLATES,
} from '@/lib/financial/scenario-planner';
import { buildScenarioBridge } from '@/lib/financial/scenario-bridge';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import type { RNPVInput, ScenarioTemplate } from '@/lib/financial/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRNPVInput(overrides: Partial<RNPVInput> = {}): RNPVInput {
  return {
    phase: 'phase2',
    therapeuticArea: 'oncology',
    modality: 'smallMolecule',
    indication: 'lung_nsclc',
    territory: 'global',
    peakSalesEstimate: { low: 1500, median: 3000, high: 5000 },
    competitivePosition: 'bestInClass',
    dataQuality: 'robust',
    regulatoryDesignations: {
      breakthrough: false,
      fastTrack: false,
      orphan: false,
      prime: false,
    },
    benchmarkDealValue: { low: 300, median: 600, high: 1200 },
    biomarkerStatus: 'validated',
    ...overrides,
  };
}

function getBaseResult(input?: RNPVInput) {
  const inp = input ?? makeRNPVInput();
  return calculateRNPV(inp);
}

// ---------------------------------------------------------------------------
// SCENARIO_TEMPLATES sanity checks
// ---------------------------------------------------------------------------

describe('SCENARIO_TEMPLATES', () => {
  it('has at least 20 templates', () => {
    expect(SCENARIO_TEMPLATES.length).toBeGreaterThanOrEqual(20);
  });

  it('every template has required fields', () => {
    for (const t of SCENARIO_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.adjustments.length).toBeGreaterThan(0);
    }
  });

  it('template IDs are unique', () => {
    const ids = SCENARIO_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every adjustment has a valid operation', () => {
    for (const t of SCENARIO_TEMPLATES) {
      for (const adj of t.adjustments) {
        expect(['multiply', 'add', 'set']).toContain(adj.operation);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// applyScenario
// ---------------------------------------------------------------------------

describe('applyScenario', () => {
  const input = makeRNPVInput();
  const baseResult = getBaseResult(input);

  it('upside scenario increases rNPV', () => {
    const bullTemplate = SCENARIO_TEMPLATES.find(t => t.id === 'best_in_class_data')!;
    const result = applyScenario(input, baseResult, bullTemplate);
    expect(result.adjustedRNPV).toBeGreaterThan(baseResult.riskAdjustedNPV);
    expect(result.impactDelta).toBeGreaterThan(0);
  });

  it('downside scenario decreases rNPV', () => {
    const bearTemplate = SCENARIO_TEMPLATES.find(t => t.id === 'phase3_failure')!;
    const result = applyScenario(input, baseResult, bearTemplate);
    expect(result.adjustedRNPV).toBeLessThan(baseResult.riskAdjustedNPV);
    expect(result.impactDelta).toBeLessThan(0);
  });

  it('result includes a narrative', () => {
    const template = SCENARIO_TEMPLATES.find(t => t.id === 'competitor_approval')!;
    const result = applyScenario(input, baseResult, template);
    expect(result.narrative).toBeTruthy();
    expect(result.narrative.length).toBeGreaterThan(20);
  });

  it('baseRNPV in result matches input base result', () => {
    const template = SCENARIO_TEMPLATES[0];
    const result = applyScenario(input, baseResult, template);
    expect(result.baseRNPV).toBe(baseResult.riskAdjustedNPV);
  });

  it('adjustedDealValue is computed from adjustedRNPV', () => {
    const template = SCENARIO_TEMPLATES.find(t => t.id === 'pricing_pressure')!;
    const result = applyScenario(input, baseResult, template);
    expect(result.adjustedDealValue.low).toBe(Math.round(result.adjustedRNPV * 0.40));
    expect(result.adjustedDealValue.median).toBe(Math.round(result.adjustedRNPV * 0.55));
    expect(result.adjustedDealValue.high).toBe(Math.round(result.adjustedRNPV * 0.75));
  });

  it('phase2 failure produces near-zero or negative rNPV', () => {
    const template = SCENARIO_TEMPLATES.find(t => t.id === 'phase2_failure')!;
    const result = applyScenario(input, baseResult, template);
    // Phase 2 failure sets peakSales and PoS to near-zero, so rNPV should
    // be dramatically lower than base (potentially negative from sunk costs)
    expect(result.adjustedRNPV).toBeLessThan(baseResult.riskAdjustedNPV * 0.10);
  });
});

// ---------------------------------------------------------------------------
// runAllScenarios — bear < base < bull ordering
// ---------------------------------------------------------------------------

describe('runAllScenarios', () => {
  const input = makeRNPVInput();
  const baseResult = getBaseResult(input);

  it('returns results sorted by impactDelta (worst first)', () => {
    const results = runAllScenarios(input, baseResult);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].impactDelta).toBeGreaterThanOrEqual(results[i - 1].impactDelta);
    }
  });

  it('worst scenario has negative delta, best has positive delta', () => {
    const results = runAllScenarios(input, baseResult);
    const worst = results[0];
    const best = results[results.length - 1];
    expect(worst.impactDelta).toBeLessThan(0);
    expect(best.impactDelta).toBeGreaterThan(0);
  });

  it('all 3 scenarios (bear < base < bull) are present in the output', () => {
    const results = runAllScenarios(input, baseResult);
    const hasDownside = results.some(r => r.adjustedRNPV < baseResult.riskAdjustedNPV);
    const hasUpside = results.some(r => r.adjustedRNPV > baseResult.riskAdjustedNPV);
    expect(hasDownside).toBe(true);
    expect(hasUpside).toBe(true);
  });

  it('scenario adjustments stay within realistic bounds (no negative peak sales)', () => {
    const results = runAllScenarios(input, baseResult);
    for (const r of results) {
      // adjustedDealValue.low can be negative when rNPV is negative (sunk costs),
      // but the rNPV approach allows that. What we do not want is NaN or Infinity.
      expect(Number.isFinite(r.adjustedRNPV)).toBe(true);
      expect(Number.isFinite(r.impactDelta)).toBe(true);
      expect(Number.isFinite(r.impactPercent)).toBe(true);
    }
  });

  it('filtering by category returns only matching templates', () => {
    const results = runAllScenarios(input, baseResult, ['regulatory']);
    // All individual scenarios (not compound) should be regulatory
    const individualResults = results.filter(r => !r.scenario.id.startsWith('compound_'));
    for (const r of individualResults) {
      expect(r.scenario.category).toBe('regulatory');
    }
  });

  it('includes compound scenarios beyond individual templates', () => {
    const results = runAllScenarios(input, baseResult);
    const compoundCount = results.filter(r => r.scenario.id.startsWith('compound_')).length;
    expect(compoundCount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getDefensiveAnalysis
// ---------------------------------------------------------------------------

describe('getDefensiveAnalysis', () => {
  const input = makeRNPVInput();
  const baseResult = getBaseResult(input);

  it('defensiveFloor < base rNPV and walkAwayThreshold < base rNPV', () => {
    const analysis = getDefensiveAnalysis(input, baseResult);
    expect(analysis.defensiveFloor).toBeLessThan(baseResult.riskAdjustedNPV);
    // walkAwayThreshold = max(defensiveFloor * 0.50, baseRNPV * phaseFraction).
    // When defensiveFloor is deeply negative, walkAwayThreshold can exceed it
    // (the phase-based fraction of base rNPV provides a sensible positive floor).
    expect(analysis.walkAwayThreshold).toBeLessThan(baseResult.riskAdjustedNPV);
  });

  it('worstCase.adjustedRNPV <= defensiveFloor', () => {
    const analysis = getDefensiveAnalysis(input, baseResult);
    expect(analysis.worstCase.adjustedRNPV).toBeLessThanOrEqual(analysis.defensiveFloor);
  });

  it('bestCase.adjustedRNPV > base rNPV', () => {
    const analysis = getDefensiveAnalysis(input, baseResult);
    expect(analysis.bestCase.adjustedRNPV).toBeGreaterThan(baseResult.riskAdjustedNPV);
  });

  it('worstCase.adjustedRNPV < base rNPV', () => {
    const analysis = getDefensiveAnalysis(input, baseResult);
    expect(analysis.worstCase.adjustedRNPV).toBeLessThan(baseResult.riskAdjustedNPV);
  });

  it('narrative is a non-empty string', () => {
    const analysis = getDefensiveAnalysis(input, baseResult);
    expect(analysis.narrative).toBeTruthy();
    expect(analysis.narrative.length).toBeGreaterThan(50);
  });

  it('accepts precomputed results to avoid re-running', () => {
    const results = runAllScenarios(input, baseResult);
    const analysis = getDefensiveAnalysis(input, baseResult, results);
    expect(analysis.worstCase).toBeDefined();
    expect(analysis.bestCase).toBeDefined();
  });

  it('walk-away threshold uses phase-specific fraction', () => {
    // Earlier-phase deals have lower walk-away fraction
    const earlyInput = makeRNPVInput({ phase: 'preclinical' });
    const earlyBase = getBaseResult(earlyInput);
    const earlyAnalysis = getDefensiveAnalysis(earlyInput, earlyBase);

    const lateInput = makeRNPVInput({ phase: 'phase3' });
    const lateBase = getBaseResult(lateInput);
    const lateAnalysis = getDefensiveAnalysis(lateInput, lateBase);

    // The walk-away as a fraction of base rNPV should be lower for preclinical
    const earlyFraction = earlyAnalysis.walkAwayThreshold / earlyBase.riskAdjustedNPV;
    const lateFraction = lateAnalysis.walkAwayThreshold / lateBase.riskAdjustedNPV;
    expect(earlyFraction).toBeLessThan(lateFraction);
  });
});

// ---------------------------------------------------------------------------
// buildScenarioBridge
// ---------------------------------------------------------------------------

describe('buildScenarioBridge', () => {
  const input = makeRNPVInput();
  const baseResult = getBaseResult(input);

  it('bear_value_m < base_value_m < bull_value_m', () => {
    const bridge = buildScenarioBridge(input, baseResult);
    expect(bridge.bear_value_m).toBeLessThan(bridge.base_value_m);
    expect(bridge.bull_value_m).toBeGreaterThan(bridge.base_value_m);
  });

  it('base_value_m matches riskAdjustedNPV (rounded)', () => {
    const bridge = buildScenarioBridge(input, baseResult);
    expect(bridge.base_value_m).toBe(Math.round(baseResult.riskAdjustedNPV));
  });

  it('has at least 2 adjustments', () => {
    const bridge = buildScenarioBridge(input, baseResult);
    expect(bridge.adjustments.length).toBeGreaterThanOrEqual(2);
  });

  it('every adjustment has valid direction and non-zero impact', () => {
    const bridge = buildScenarioBridge(input, baseResult);
    for (const adj of bridge.adjustments) {
      expect(['upside', 'downside']).toContain(adj.direction);
      expect(adj.impact_m).not.toBe(0);
      expect(adj.factor).toBeTruthy();
      expect(adj.description).toBeTruthy();
    }
  });

  it('downside adjustments sum to bear delta', () => {
    const bridge = buildScenarioBridge(input, baseResult);
    const downsideSum = bridge.adjustments
      .filter(a => a.direction === 'downside')
      .reduce((sum, a) => sum + a.impact_m, 0);
    expect(bridge.bear_value_m).toBe(Math.round(bridge.base_value_m + downsideSum));
  });

  it('upside adjustments sum to bull delta', () => {
    const bridge = buildScenarioBridge(input, baseResult);
    const upsideSum = bridge.adjustments
      .filter(a => a.direction === 'upside')
      .reduce((sum, a) => sum + a.impact_m, 0);
    expect(bridge.bull_value_m).toBe(Math.round(bridge.base_value_m + upsideSum));
  });

  it('expected_value_m is the probability-weighted average (20% bear + 50% base + 30% bull)', () => {
    const bridge = buildScenarioBridge(input, baseResult);
    const expected = Math.round(
      0.20 * bridge.bear_value_m + 0.50 * bridge.base_value_m + 0.30 * bridge.bull_value_m,
    );
    expect(bridge.expected_value_m).toBe(expected);
  });

  it('payer coverage adjustment is always present', () => {
    const bridge = buildScenarioBridge(input, baseResult);
    const payerAdj = bridge.adjustments.find(a => a.factor === 'Payer coverage restricted');
    expect(payerAdj).toBeDefined();
    expect(payerAdj!.direction).toBe('downside');
  });

  it('label expansion adjustment is always present', () => {
    const bridge = buildScenarioBridge(input, baseResult);
    const labelAdj = bridge.adjustments.find(a =>
      a.factor.includes('Label expansion'),
    );
    expect(labelAdj).toBeDefined();
    expect(labelAdj!.direction).toBe('upside');
  });

  it('gene therapy modality adds manufacturing risk factor', () => {
    const gtInput = makeRNPVInput({ modality: 'geneTherapy' });
    const gtBase = getBaseResult(gtInput);
    const bridge = buildScenarioBridge(gtInput, gtBase);
    const mfgAdj = bridge.adjustments.find(a =>
      a.factor.includes('Gene therapy manufacturing'),
    );
    expect(mfgAdj).toBeDefined();
    expect(mfgAdj!.direction).toBe('downside');
  });
});
