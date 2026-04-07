/**
 * Scenario Planning Engine
 *
 * Provides predefined scenario templates for stress-testing deal valuations.
 * Each scenario modifies rNPV input parameters and re-runs the financial model.
 */

import type { ScenarioTemplate, ScenarioResult, RNPVInput, RNPVResult, DefensiveAnalysis } from './types';
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
      { parameter: 'pos', operation: 'multiply', value: 1.05, rationale: 'Accelerated pathway modestly improves approval likelihood (confirmatory trial still required)' },
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
      { parameter: 'pos', operation: 'multiply', value: 0.15, rationale: 'Low probability of rescue study success — 85% reduction from base PoS' },
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

  // Manufacturing & Supply Chain scenarios
  {
    id: 'cmc_failure',
    name: 'CMC / Manufacturing Failure',
    description: 'Critical manufacturing issue (sterility, potency, yield) requires process redesign and delays launch by 18 months.',
    category: 'regulatory',
    adjustments: [
      { parameter: 'timeToMarket', operation: 'add', value: 1.5, rationale: '18-month delay for manufacturing process redesign' },
      { parameter: 'peakSales', operation: 'multiply', value: 0.90, rationale: 'Supply constraints limit initial launch capacity' },
      { parameter: 'discountRate', operation: 'add', value: 0.01, rationale: 'Increased technical risk perception' },
    ],
  },
  {
    id: 'supply_disruption',
    name: 'Post-Launch Supply Disruption',
    description: 'Manufacturing facility issue or raw material shortage halves supply for 12 months post-launch.',
    category: 'commercial',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.70, rationale: '30% revenue loss from 12-month supply constraint' },
    ],
  },

  // Clinical scenarios (additional)
  {
    id: 'biomarker_failure',
    name: 'Biomarker Enrichment Failure',
    description: 'Companion diagnostic fails to identify responders, requiring broader (lower-response) population label.',
    category: 'clinical',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.65, rationale: 'Broader but less effective label reduces adoption' },
      { parameter: 'pos', operation: 'multiply', value: 0.80, rationale: 'Diluted effect size in unenriched population' },
    ],
  },
  {
    id: 'subgroup_rescue',
    name: 'Subgroup-Only Approval',
    description: 'Overall trial misses but pre-specified biomarker subgroup shows strong benefit. Narrow label approved.',
    category: 'clinical',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.35, rationale: 'Narrow subgroup = ~35% of original target population' },
      { parameter: 'timeToMarket', operation: 'add', value: 1.0, rationale: 'Additional 12 months for confirmatory study in subgroup' },
      { parameter: 'pos', operation: 'multiply', value: 0.70, rationale: 'Higher bar for subgroup-based approval' },
    ],
  },
  {
    id: 'dose_optimization_success',
    name: 'Dose Optimization Success',
    description: 'Improved dosing regimen in Phase 2b dramatically improves therapeutic index and patient compliance.',
    category: 'clinical',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 1.15, rationale: 'Better tolerability drives higher compliance and market share' },
      { parameter: 'pos', operation: 'multiply', value: 1.10, rationale: 'Cleaner safety profile improves Phase 3 success probability' },
    ],
  },

  // Regulatory scenarios (additional)
  {
    id: 'pediatric_extension',
    name: 'Pediatric Exclusivity Extension',
    description: 'FDA grants 6-month pediatric exclusivity, extending market protection and revenue tail.',
    category: 'regulatory',
    adjustments: [
      { parameter: 'timeToMarket', operation: 'add', value: -0.5, rationale: '6-month LOE extension effectively extends peak revenue duration (modeled as earlier effective launch relative to LOE)' },
    ],
  },
  {
    id: 'conditional_approval_eu',
    name: 'EU Conditional Marketing Authorization',
    description: 'EMA grants conditional approval based on early data, enabling EU revenue 12 months earlier.',
    category: 'regulatory',
    adjustments: [
      { parameter: 'timeToMarket', operation: 'add', value: -1.0, rationale: '12-month earlier EU market access via conditional MA' },
      { parameter: 'peakSales', operation: 'multiply', value: 1.03, rationale: 'Early EU access builds real-world evidence and KOL support' },
    ],
  },

  // Competitive scenarios (additional)
  {
    id: 'generic_entry_early',
    name: 'Early Generic / Biosimilar Entry',
    description: 'Patent challenge or paragraph IV filing enables generic/biosimilar entry 2 years before expected LOE.',
    category: 'competitive',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.75, rationale: '25% lifecycle revenue loss from 2-year earlier generic entry' },
    ],
  },
  {
    id: 'competitor_safety_withdrawal',
    name: 'Competitor Withdrawal (Safety)',
    description: 'Key competitor withdrawn from market due to safety signal, creating market share opportunity.',
    category: 'competitive',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 1.45, rationale: '45% peak sales uplift from competitor withdrawal' },
      { parameter: 'pos', operation: 'multiply', value: 1.05, rationale: 'Increased regulatory willingness to approve alternatives' },
    ],
  },
  {
    id: 'class_effect_concern',
    name: 'Class-Effect Safety Concern',
    description: 'Regulatory agency raises class-wide safety concern affecting all drugs with similar mechanism.',
    category: 'regulatory',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.75, rationale: 'Class-wide REMS or label warning reduces prescribing confidence' },
      { parameter: 'pos', operation: 'multiply', value: 0.85, rationale: 'Heightened regulatory scrutiny on the class' },
      { parameter: 'discountRate', operation: 'add', value: 0.01, rationale: 'Elevated risk perception across the mechanism class' },
    ],
  },

  // Commercial / Market Access scenarios (additional)
  {
    id: 'payer_restriction',
    name: 'Restrictive Payer Coverage',
    description: 'Major PBMs/payers require step therapy or prior authorization, limiting initial uptake.',
    category: 'commercial',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.80, rationale: '20% reduced adoption from step therapy / PA requirements' },
    ],
  },
  {
    id: 'real_world_outperformance',
    name: 'Real-World Data Outperformance',
    description: 'Post-launch real-world evidence shows superior outcomes vs. clinical trial data, boosting adoption.',
    category: 'commercial',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 1.20, rationale: '20% uplift from strong real-world evidence driving guideline adoption' },
    ],
  },
  {
    id: 'ira_negotiation_impact',
    name: 'IRA Price Negotiation (US)',
    description: 'Drug selected for Medicare price negotiation under IRA, imposing maximum fair price 9+ years post-launch.',
    category: 'pricing',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 0.85, rationale: '15% price reduction from IRA Medicare negotiation' },
    ],
  },
  {
    id: 'orphan_premium',
    name: 'Orphan Drug Premium Pricing',
    description: 'Orphan designation enables premium pricing ($200K+/year) with limited payer pushback due to small population.',
    category: 'pricing',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 1.35, rationale: '35% price premium from orphan designation and unmet need' },
    ],
  },
  {
    id: 'combination_synergy',
    name: 'Combination Therapy Approval',
    description: 'Asset approved as backbone of combination regimen, becoming standard-of-care component.',
    category: 'commercial',
    adjustments: [
      { parameter: 'peakSales', operation: 'multiply', value: 1.50, rationale: '50% TAM expansion as part of combination standard-of-care' },
      { parameter: 'pos', operation: 'multiply', value: 1.05, rationale: 'Combination data de-risks single-agent efficacy concerns' },
    ],
  },
];

/**
 * Apply a scenario to an rNPV input and calculate the adjusted result.
 *
 * All adjustments are fed into the rNPV engine as first-class inputs so that
 * revenue, costs, PoS, and discounting interact correctly. No post-hoc
 * multipliers are applied to the aggregated rNPV number — that approach
 * causes sign-flip bugs when costs are a significant fraction of NPV.
 */
export function applyScenario(
  baseInput: RNPVInput,
  baseResult: RNPVResult,
  scenario: ScenarioTemplate,
): ScenarioResult {
  // Clone the input for modification
  const adjustedInput: RNPVInput = { ...baseInput };
  const adjustedPeakSales = { ...baseInput.peakSalesEstimate };

  // Accumulate PoS and time-to-market adjustments for the engine
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

  // Pass time-to-market adjustment into the engine (applied to yearsToMarket internally)
  if (timeToMarketDelta !== 0) {
    adjustedInput.timeToMarketAdjustment = timeToMarketDelta;
  }

  // Pass PoS adjustment into the engine (applied to cumulativePoS internally,
  // which correctly affects only revenue risk-weighting, not development costs)
  if (posOverride !== null) {
    // For absolute PoS override, convert to multiplier relative to base
    const originalPoS = baseResult.cumulativePoS;
    if (originalPoS > 0) {
      adjustedInput.posMultiplier = posOverride / originalPoS;
    } else {
      adjustedInput.posMultiplier = 0;
    }
  } else if (posMultiplier !== 1.0) {
    adjustedInput.posMultiplier = posMultiplier;
  }

  // Re-run rNPV with all adjustments applied inside the engine
  const adjustedResult = calculateRNPV(adjustedInput);
  const adjustedRNPV = adjustedResult.riskAdjustedNPV;

  const impactDelta = adjustedRNPV - baseResult.riskAdjustedNPV;
  const impactPercent = baseResult.riskAdjustedNPV !== 0
    ? (impactDelta / Math.abs(baseResult.riskAdjustedNPV)) * 100
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

  const individual = templates
    .map(template => applyScenario(baseInput, baseResult, template));

  // Add compound scenarios (non-linear interaction between scenario pairs)
  const compound = runCompoundScenarios(baseInput, baseResult);

  return [...individual, ...compound]
    .sort((a, b) => a.impactDelta - b.impactDelta); // worst scenarios first
}

/**
 * Get the defensive scenario summary — what's the downside?
 * Accepts optional precomputedResults to avoid re-running all scenarios.
 */
export function getDefensiveAnalysis(
  baseInput: RNPVInput,
  baseResult: RNPVResult,
  precomputedResults?: ScenarioResult[],
): DefensiveAnalysis {
  const results = precomputedResults ?? runAllScenarios(baseInput, baseResult);
  const worstCase = results[0];
  const bestCase = results[results.length - 1];

  // Defensive floor: probability-weighted P10 of scenario outcomes.
  // Downside scenarios (clinical failure, safety) are more likely than extreme
  // upside scenarios. We weight by implied probability based on category.
  const categoryWeights: Record<string, number> = {
    clinical: 0.25,      // Clinical failures are the most common risk
    regulatory: 0.20,    // Regulatory setbacks are frequent
    competitive: 0.20,   // Competitive dynamics always present
    commercial: 0.20,    // Commercial execution risk
    pricing: 0.15,       // Pricing pressure less frequent but impactful
  };
  // Weight each scenario, sort by adjusted rNPV, find weighted P10
  const weightedResults = results.map(r => ({
    adjustedRNPV: r.adjustedRNPV,
    weight: categoryWeights[r.scenario.category] || 0.20,
  }));
  weightedResults.sort((a, b) => a.adjustedRNPV - b.adjustedRNPV);
  const totalWeight = weightedResults.reduce((s, r) => s + r.weight, 0);
  let cumulativeWeight = 0;
  let defensiveFloor = weightedResults[0]?.adjustedRNPV || 0;
  for (const wr of weightedResults) {
    cumulativeWeight += wr.weight / totalWeight;
    if (cumulativeWeight >= 0.10) {
      defensiveFloor = wr.adjustedRNPV;
      break;
    }
  }

  // Walk-away threshold: phase-adjusted minimum acceptable deal value
  // Source: Industry practice — earlier-stage deals require lower absolute floor
  // but higher risk-adjusted return hurdle
  // Phase-specific walk-away as fraction of base rNPV:
  //   Preclinical: 8% (high risk, accept low floor)
  //   Phase 1: 12%, Phase 2: 18%, Phase 3: 25%, Approved: 35%
  const phaseWalkAwayFractions: Record<string, number> = {
    preclinical: 0.08, phase1: 0.12, phase2: 0.18, phase3: 0.25, approved: 0.35,
  };
  const walkAwayFraction = phaseWalkAwayFractions[baseInput.phase] ?? 0.18;
  const walkAwayThreshold = Math.round(
    Math.max(defensiveFloor * 0.50, baseResult.riskAdjustedNPV * walkAwayFraction)
  );

  const fmtVal = (v: number) => v < 0 ? `-$${Math.abs(Math.round(v))}M` : `$${Math.round(v)}M`;
  const narrative = `Scenario analysis across ${results.length} scenarios shows a range of ` +
    `${fmtVal(worstCase.adjustedRNPV)} to ${fmtVal(bestCase.adjustedRNPV)} rNPV ` +
    `(${worstCase.impactPercent}% to +${bestCase.impactPercent}% from base case). ` +
    `The defensive floor at the 10th percentile is ${fmtVal(defensiveFloor)}, ` +
    `implying a walk-away threshold of ~${fmtVal(walkAwayThreshold)} in total deal value. ` +
    `Below this level, the risk-reward balance favors waiting or alternative strategies.`;

  return {
    worstCase,
    bestCase,
    defensiveFloor,
    walkAwayThreshold,
    narrative,
  };
}

/**
 * Compound scenario pairs: when two bad (or good) things happen together,
 * the combined impact is WORSE than the sum of parts.
 *
 * Institutional practice: regulatory delay + competitor entry is more
 * damaging than either alone because the delay lets the competitor
 * establish market position before your launch.
 *
 * Each pair defines interaction multipliers on top of the combined
 * individual adjustments (non-linear compounding).
 */
const COMPOUND_SCENARIO_PAIRS: Array<{
  scenario1: string;
  scenario2: string;
  interactionMultipliers: { peakSalesMultiplier?: number; posMultiplier?: number; timeAdjustment?: number };
  name: string;
  narrative: string;
}> = [
  {
    scenario1: 'regulatory_delay_crl',
    scenario2: 'competitor_approved_first',
    interactionMultipliers: { peakSalesMultiplier: 0.80, timeAdjustment: 0.5 },
    name: 'CRL + Competitor Launch',
    narrative: 'Regulatory delay compounds with competitor entry — competitor establishes market position during your delay, reducing your peak share beyond the sum of individual impacts.',
  },
  {
    scenario1: 'phase3_failure',
    scenario2: 'subgroup_rescue',
    interactionMultipliers: { posMultiplier: 0.70, peakSalesMultiplier: 0.50, timeAdjustment: 2.0 },
    name: 'Phase 3 Failure + Subgroup Rescue',
    narrative: 'Failed pivotal but subgroup shows benefit — narrower label, extended timeline, and lower peak sales than either scenario suggests independently.',
  },
  {
    scenario1: 'pricing_pressure',
    scenario2: 'generic_entry_early',
    interactionMultipliers: { peakSalesMultiplier: 0.75 },
    name: 'Pricing Squeeze + Early Generic Entry',
    narrative: 'Government pricing pressure coincides with early generic/biosimilar entry — revenue tail collapses faster than either scenario alone.',
  },
  {
    scenario1: 'best_in_class_data',
    scenario2: 'indication_expansion',
    interactionMultipliers: { peakSalesMultiplier: 1.15, posMultiplier: 1.10 },
    name: 'Best-in-Class + Label Expansion',
    narrative: 'Superior data accelerates label expansion plans — regulatory precedent from first indication de-risks second, creating compound upside.',
  },
];

/**
 * Run compound scenarios: pairs of events that interact non-linearly.
 * Returns additional scenario results beyond the individual templates.
 */
export function runCompoundScenarios(
  baseInput: RNPVInput,
  baseResult: RNPVResult,
): ScenarioResult[] {
  const compoundResults: ScenarioResult[] = [];

  for (const pair of COMPOUND_SCENARIO_PAIRS) {
    const s1 = SCENARIO_TEMPLATES.find(t => t.id === pair.scenario1);
    const s2 = SCENARIO_TEMPLATES.find(t => t.id === pair.scenario2);
    if (!s1 || !s2) continue;

    // Merge adjustments from both scenarios
    const mergedAdjustments = [...s1.adjustments, ...s2.adjustments];

    // Create compound template with interaction effects
    const compoundTemplate: ScenarioTemplate = {
      id: `compound_${pair.scenario1}_${pair.scenario2}`,
      name: pair.name,
      description: pair.narrative,
      category: s1.category,
      adjustments: mergedAdjustments,
    };

    // Apply the compound scenario
    let result = applyScenario(baseInput, baseResult, compoundTemplate);

    // Apply non-linear interaction multipliers on top.
    // These make the scenario WORSE (for downside) or BETTER (for upside).
    // We apply them to the IMPACT DELTA (not the absolute rNPV) to ensure
    // that a negative scenario always gets more negative, not less.
    const ix = pair.interactionMultipliers;
    if (ix.peakSalesMultiplier || ix.posMultiplier || ix.timeAdjustment) {
      // Amplify the impact delta by the interaction factor
      const interactionFactor = (ix.peakSalesMultiplier || 1.0) * (ix.posMultiplier || 1.0);
      const amplifiedDelta = result.impactDelta * (1.0 + (1.0 - interactionFactor));
      const compoundedRNPV = baseResult.riskAdjustedNPV + amplifiedDelta;

      result = {
        ...result,
        adjustedRNPV: Math.round(compoundedRNPV),
        impactDelta: Math.round(amplifiedDelta),
        impactPercent: Math.round((amplifiedDelta / Math.abs(baseResult.riskAdjustedNPV || 1)) * 100),
        narrative: pair.narrative,
        scenario: compoundTemplate,
      };
    }

    compoundResults.push(result);
  }

  return compoundResults.sort((a, b) => a.impactDelta - b.impactDelta);
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
