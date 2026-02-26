/**
 * Scenario Planning Engine
 *
 * Provides predefined scenario templates for stress-testing deal valuations.
 * Each scenario modifies rNPV input parameters and re-runs the financial model.
 */

import type { ScenarioTemplate, ScenarioResult, RNPVInput, RNPVResult } from './types';
import { calculateRNPV } from './rnpv-engine';

/**
 * Predefined scenario templates covering key risk categories.
 * Each template describes parameter adjustments and their rationale.
 */
export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  // Regulatory scenarios
  {
    id: 'regulatory_delay_12mo',
    name: 'Regulatory Delay (12 months)',
    description: 'FDA/EMA requests additional data or issues a CRL, delaying approval by 12 months.',
    category: 'regulatory',
    adjustments: [
      { parameter: 'timeToMarket', operation: 'add', value: 1.0, rationale: '12-month delay from CRL or additional data request' },
      { parameter: 'peakSales', operation: 'multiply', value: 0.95, rationale: 'Slight market share erosion from delayed entry' },
      { parameter: 'discountRate', operation: 'add', value: 0.005, rationale: 'Increased uncertainty from regulatory setback' },
    ],
  },
  {
    id: 'regulatory_delay_24mo',
    name: 'Major Regulatory Setback (24 months)',
    description: 'Significant regulatory hurdle requiring new clinical study or REMS, delaying approval by 2 years.',
    category: 'regulatory',
    adjustments: [
      { parameter: 'timeToMarket', operation: 'add', value: 2.0, rationale: '24-month delay from required additional study' },
      { parameter: 'peakSales', operation: 'multiply', value: 0.85, rationale: 'Meaningful market share loss to competitors' },
      { parameter: 'discountRate', operation: 'add', value: 0.01, rationale: 'Elevated uncertainty and capital cost' },
      { parameter: 'pos', operation: 'multiply', value: 0.85, rationale: 'Reduced confidence in eventual approval' },
    ],
  },
  {
    id: 'accelerated_approval',
    name: 'Accelerated Approval',
    description: 'Asset receives accelerated approval based on surrogate endpoint, reaching market 12-18 months earlier.',
    category: 'regulatory',
    adjustments: [
      { parameter: 'timeToMarket', operation: 'add', value: -1.5, rationale: '18-month acceleration from surrogate-based approval' },
      { parameter: 'peakSales', operation: 'multiply', value: 1.05, rationale: 'First-mover benefit from early market entry' },
      { parameter: 'pos', operation: 'multiply', value: 1.15, rationale: 'Breakthrough/accelerated pathway improves approval likelihood' },
    ],
  },

  // Clinical failure scenarios
  {
    id: 'phase2_failure',
    name: 'Phase 2 Failure',
    description: 'Asset fails to meet primary endpoint in Phase 2. Residual value from platform/data only.',
    category: 'clinical',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.0, rationale: 'No commercial revenue from failed asset' },
      { parameter: 'pos', operation: 'set', value: 0.0, rationale: 'Program terminated after Phase 2 miss' },
    ],
  },
  {
    id: 'phase3_failure',
    name: 'Phase 3 Failure',
    description: 'Asset fails pivotal Phase 3 trial. Significant sunk cost with potential salvage in subpopulation.',
    category: 'clinical',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.15, rationale: 'Potential salvage value in biomarker-selected subgroup' },
      { parameter: 'pos', operation: 'set', value: 0.20, rationale: 'Low probability of rescue study success' },
      { parameter: 'timeToMarket', operation: 'add', value: 3.0, rationale: 'Additional 3 years for rescue study if pursued' },
    ],
  },
  {
    id: 'safety_signal',
    name: 'Post-Market Safety Signal',
    description: 'Black box warning or REMS requirement after approval reduces market adoption.',
    category: 'clinical',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.60, rationale: '40% reduction in peak sales from restricted use' },
      { parameter: 'discountRate', operation: 'add', value: 0.015, rationale: 'Increased risk premium from safety concern' },
    ],
  },

  // Competitive scenarios
  {
    id: 'competitor_approval',
    name: 'Competitor Approved First',
    description: 'Key competitor reaches market 12 months before your asset, capturing first-mover advantage.',
    category: 'competitive',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.70, rationale: '30% market share loss to first-mover competitor' },
    ],
  },
  {
    id: 'crowded_market',
    name: 'Market Becomes Crowded',
    description: '3+ competitors enter the market within 2 years, fragmenting share.',
    category: 'competitive',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.50, rationale: '50% peak sales reduction from market fragmentation' },
      { parameter: 'discountRate', operation: 'add', value: 0.005, rationale: 'Increased uncertainty from competitive dynamics' },
    ],
  },
  {
    id: 'best_in_class_data',
    name: 'Best-in-Class Clinical Data',
    description: 'Asset demonstrates superior efficacy/safety vs. competitors in head-to-head or cross-trial comparison.',
    category: 'competitive',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 1.30, rationale: '30% uplift from differentiated clinical profile' },
      { parameter: 'pos', operation: 'multiply', value: 1.10, rationale: 'Strong data improves regulatory and commercial confidence' },
    ],
  },

  // Commercial scenarios
  {
    id: 'pricing_pressure',
    name: 'Severe Pricing Pressure',
    description: 'IRA negotiation, reference pricing, or payer pushback reduces net price by 25%.',
    category: 'pricing',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.75, rationale: '25% net price reduction from payer/regulatory pressure' },
    ],
  },
  {
    id: 'premium_pricing',
    name: 'Premium Pricing Achieved',
    description: 'Asset achieves premium pricing due to breakthrough designation, unmet need, or orphan status.',
    category: 'pricing',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 1.25, rationale: '25% price premium from orphan/breakthrough positioning' },
    ],
  },
  {
    id: 'indication_expansion',
    name: 'Indication Expansion',
    description: 'Asset gains approval in additional indication, expanding addressable market by 40%.',
    category: 'commercial',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 1.40, rationale: '40% TAM expansion from second indication' },
      { parameter: 'timeToMarket', operation: 'add', value: 0, rationale: 'Primary indication timeline unchanged' },
    ],
  },
  {
    id: 'slow_launch',
    name: 'Slow Commercial Launch',
    description: 'Market access delays, payer negotiations, or physician adoption slower than projected.',
    category: 'commercial',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.80, rationale: '20% lower peak due to slower-than-expected adoption' },
      { parameter: 'timeToMarket', operation: 'add', value: 0.5, rationale: '6-month effective delay from slow ramp' },
    ],
  },
];

/**
 * Apply a scenario to an rNPV input and calculate the adjusted result.
 */
export function applyScenario(
  baseInput: RNPVInput,
  baseResult: RNPVResult,
  scenario: ScenarioTemplate,
): ScenarioResult {
  // Clone the input for modification
  const adjustedInput: RNPVInput = { ...baseInput };
  const adjustedPeakSales = { ...baseInput.peakSalesEstimate };

  // Track effective PoS multiplier
  let posMultiplier = 1.0;
  let posOverride: number | null = null;
  let timeToMarketDelta = 0;

  for (const adj of scenario.adjustments) {
    switch (adj.parameter) {
      case 'peakSales':
        if (adj.operation === 'multiply') {
          adjustedPeakSales.low *= adj.value;
          adjustedPeakSales.median *= adj.value;
          adjustedPeakSales.high *= adj.value;
        } else if (adj.operation === 'set') {
          adjustedPeakSales.low = adj.value;
          adjustedPeakSales.median = adj.value;
          adjustedPeakSales.high = adj.value;
        }
        break;

      case 'discountRate':
        if (adj.operation === 'add') {
          adjustedInput.discountRate = (baseInput.discountRate || baseResult.discountRate) + adj.value;
        } else if (adj.operation === 'set') {
          adjustedInput.discountRate = adj.value;
        }
        break;

      case 'pos':
        if (adj.operation === 'multiply') {
          posMultiplier *= adj.value;
        } else if (adj.operation === 'set') {
          posOverride = adj.value;
        }
        break;

      case 'timeToMarket':
        if (adj.operation === 'add') {
          timeToMarketDelta += adj.value;
        }
        break;
    }
  }

  adjustedInput.peakSalesEstimate = adjustedPeakSales;

  // Re-run rNPV with adjusted inputs
  const adjustedResult = calculateRNPV(adjustedInput);

  // Apply PoS adjustment (post-calculation since PoS is internal to the engine)
  let adjustedRNPV = adjustedResult.riskAdjustedNPV;
  if (posOverride !== null) {
    // Override: scale by ratio of new PoS to original
    const originalPoS = baseResult.cumulativePoS;
    if (originalPoS > 0) {
      adjustedRNPV *= posOverride / originalPoS;
    } else {
      adjustedRNPV = 0;
    }
  } else if (posMultiplier !== 1.0) {
    adjustedRNPV *= posMultiplier;
  }

  // Apply time-to-market delta (approximation: each year delay reduces NPV by ~discount rate)
  if (timeToMarketDelta !== 0) {
    const discountPerYear = 1 / (1 + (adjustedInput.discountRate || baseResult.discountRate));
    adjustedRNPV *= Math.pow(discountPerYear, timeToMarketDelta);
  }

  const impactDelta = adjustedRNPV - baseResult.riskAdjustedNPV;
  const impactPercent = baseResult.riskAdjustedNPV > 0
    ? (impactDelta / baseResult.riskAdjustedNPV) * 100
    : 0;

  // Generate narrative
  const narrative = generateScenarioNarrative(scenario, impactDelta, impactPercent, baseResult.riskAdjustedNPV);

  return {
    scenario,
    baseRNPV: baseResult.riskAdjustedNPV,
    adjustedRNPV: Math.round(adjustedRNPV),
    impactDelta: Math.round(impactDelta),
    impactPercent: Math.round(impactPercent),
    adjustedDealValue: {
      low: Math.round(adjustedRNPV * 0.40),
      median: Math.round(adjustedRNPV * 0.55),
      high: Math.round(adjustedRNPV * 0.75),
    },
    narrative,
  };
}

/**
 * Run all applicable scenarios and return sorted by impact.
 */
export function runAllScenarios(
  baseInput: RNPVInput,
  baseResult: RNPVResult,
  categories?: ScenarioTemplate['category'][],
): ScenarioResult[] {
  const templates = categories
    ? SCENARIO_TEMPLATES.filter(t => categories.includes(t.category))
    : SCENARIO_TEMPLATES;

  return templates
    .map(template => applyScenario(baseInput, baseResult, template))
    .sort((a, b) => a.impactDelta - b.impactDelta); // worst scenarios first
}

/**
 * Get the defensive scenario summary — what's the downside?
 */
export function getDefensiveAnalysis(
  baseInput: RNPVInput,
  baseResult: RNPVResult,
): {
  worstCase: ScenarioResult;
  bestCase: ScenarioResult;
  defensiveFloor: number;
  walkAwayThreshold: number;
  narrative: string;
} {
  const results = runAllScenarios(baseInput, baseResult);
  const worstCase = results[0];
  const bestCase = results[results.length - 1];

  // Defensive floor: P10 of scenario outcomes
  const allAdjustedValues = results.map(r => r.adjustedRNPV);
  allAdjustedValues.sort((a, b) => a - b);
  const p10Index = Math.floor(allAdjustedValues.length * 0.10);
  const defensiveFloor = allAdjustedValues[p10Index] || 0;

  // Walk-away threshold: below this, the deal doesn't make financial sense
  const walkAwayThreshold = Math.round(defensiveFloor * 0.55); // 55% of floor as deal value

  const narrative = `Scenario analysis across ${results.length} scenarios shows a range of ` +
    `$${Math.round(worstCase.adjustedRNPV)}M to $${Math.round(bestCase.adjustedRNPV)}M rNPV ` +
    `(${worstCase.impactPercent}% to +${bestCase.impactPercent}% from base case). ` +
    `The defensive floor at the 10th percentile is $${defensiveFloor}M, ` +
    `implying a walk-away threshold of ~$${walkAwayThreshold}M in total deal value. ` +
    `Below this level, the risk-reward balance favors waiting or alternative strategies.`;

  return {
    worstCase,
    bestCase,
    defensiveFloor,
    walkAwayThreshold,
    narrative,
  };
}

function generateScenarioNarrative(
  scenario: ScenarioTemplate,
  impactDelta: number,
  impactPercent: number,
  baseRNPV: number,
): string {
  const direction = impactDelta >= 0 ? 'increases' : 'decreases';
  const magnitude = Math.abs(impactPercent);
  const severity = magnitude > 50 ? 'dramatically' : magnitude > 25 ? 'significantly' : magnitude > 10 ? 'meaningfully' : 'modestly';

  return `${scenario.name} ${severity} ${direction} the risk-adjusted NPV by ${magnitude.toFixed(0)}% ` +
    `($${Math.abs(Math.round(impactDelta))}M). ` +
    scenario.adjustments.map(a => a.rationale).join('. ') + '.';
}
