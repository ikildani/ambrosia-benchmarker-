/**
 * Financial Modeling Orchestrator
 *
 * Runs the full suite of synchronous financial engines:
 * rNPV, Monte Carlo, market sizing, FX sensitivity, scenario planning.
 *
 * This runs client-side (all engines are pure TypeScript, zero deps).
 * Server-side operations (competitive landscape, deal flow forecast)
 * are fetched via API from the UI components.
 */

import type { CalculationInput, CalculationResult } from '@/lib/calculations';
import type {
  RNPVInput,
  RNPVResult,
  MonteCarloResult,
  MarketSizeEstimate,
  FXSensitivity,
  ScenarioResult,
} from './types';
import { calculateRNPV } from './rnpv-engine';
import { runMonteCarlo } from './monte-carlo';
import { estimateMarketSize, getEpidemiologyData } from './market-size';
import { calculateFXSensitivity } from './fx-sensitivity';
import { runAllScenarios, getDefensiveAnalysis } from './scenario-planner';
import { DEFAULT_DISCOUNT_RATES, TERRITORY_RISK_PREMIUM } from './discount-rates';

/** Full output of the financial modeling pipeline */
export interface FinancialModelResult {
  rnpv: RNPVResult;
  monteCarlo: MonteCarloResult;
  marketSize: MarketSizeEstimate | null;
  fxSensitivity: FXSensitivity;
  scenarios: ScenarioResult[];
  defensiveAnalysis: {
    worstCase: ScenarioResult;
    bestCase: ScenarioResult;
    defensiveFloor: number;
    walkAwayThreshold: number;
    narrative: string;
  };
}

/**
 * Map CalculationInput into RNPVInput.
 * Bridges the existing calculator inputs to the financial engine's expected format.
 */
function buildRNPVInput(
  inputs: CalculationInput,
  result: CalculationResult,
  peakSalesOverride?: { low: number; median: number; high: number },
): RNPVInput {
  // Estimate peak sales from the deal value if no epidemiology-based estimate
  // Phase-stratified multipliers: earlier phases have wider uncertainty ranges
  const totalDealMedian = result.terms.totalDealValue.median;
  const PEAK_SALES_MULTIPLIER: Record<string, { low: number; median: number; high: number }> = {
    preclinical: { low: 6, median: 12, high: 20 },
    phase1: { low: 4, median: 8, high: 14 },
    phase2: { low: 2.5, median: 5, high: 9 },
    phase3: { low: 1.5, median: 3, high: 5 },
    approved: { low: 1.0, median: 1.5, high: 2.5 },
  };
  const mult = PEAK_SALES_MULTIPLIER[inputs.phase] || PEAK_SALES_MULTIPLIER.phase2;
  const defaultPeakSales = {
    low: totalDealMedian * mult.low,
    median: totalDealMedian * mult.median,
    high: totalDealMedian * mult.high,
  };

  return {
    phase: inputs.phase,
    therapeuticArea: inputs.therapeuticArea,
    modality: inputs.modality,
    indication: inputs.indication,
    territory: inputs.territory,
    peakSalesEstimate: peakSalesOverride || defaultPeakSales,
    competitivePosition: inputs.competitivePosition || 'racing',
    dataQuality: inputs.dataQuality || 'moderate',
    biomarkerStatus: inputs.biomarker || 'unselected',
    regulatoryDesignations: {
      breakthrough: inputs.regulatoryDesignations?.breakthrough || false,
      fastTrack: inputs.regulatoryDesignations?.fastTrack || false,
      orphan: inputs.regulatoryDesignations?.orphan || false,
      prime: inputs.regulatoryDesignations?.prime || false,
    },
    discountRate: (() => {
      const baseRate = DEFAULT_DISCOUNT_RATES[inputs.therapeuticArea]?.[inputs.phase];
      return baseRate ? baseRate + (TERRITORY_RISK_PREMIUM[inputs.territory] || 0) : undefined;
    })(),
    benchmarkDealValue: {
      low: result.terms.totalDealValue.low,
      median: result.terms.totalDealValue.median,
      high: result.terms.totalDealValue.high,
    },
  };
}

/**
 * Run the full financial modeling pipeline synchronously.
 *
 * Total runtime: ~200-400ms for rNPV + Monte Carlo + scenarios + FX.
 */
export function runFinancialModel(
  inputs: CalculationInput,
  result: CalculationResult,
  epidemiologyDataset?: Record<string, { prevalencePerMillion: number; incidencePerMillion: number; diagnosedPercent: number; treatedPercent: number; drugEligiblePercent: number; annualCostOfTherapy: number; sources: string[] }>,
): FinancialModelResult {
  // Step 1: Market size estimation (if epi data available)
  let marketSize: MarketSizeEstimate | null = null;
  let peakSalesFromMarket: { low: number; median: number; high: number } | undefined;

  if (epidemiologyDataset) {
    const epiData = getEpidemiologyData(inputs.indication, epidemiologyDataset);
    marketSize = estimateMarketSize(
      inputs.indication,
      inputs.territory,
      inputs.competitivePosition || 'racing',
      epiData,
    );
    // Use epidemiology-derived peak sales for rNPV
    peakSalesFromMarket = marketSize.peakSales;
  }

  // Step 2: rNPV calculation
  const rnpvInput = buildRNPVInput(inputs, result, peakSalesFromMarket);
  const rnpv = calculateRNPV(rnpvInput);

  // Step 3: Monte Carlo simulation (10K iterations, seeded for reproducibility)
  const monteCarlo = runMonteCarlo({ rnpvInput }, 42);

  // Step 4: FX sensitivity (use peak annual revenue, not lifetime sum)
  const baseRevenue = Math.max(...rnpv.cashFlows.map(cf => cf.revenue));
  const fxSensitivity = calculateFXSensitivity(
    inputs.territory,
    baseRevenue,
    rnpv.riskAdjustedNPV,
  );

  // Step 5: Scenario planning (pass precomputed scenarios to avoid duplicate computation)
  const scenarios = runAllScenarios(rnpvInput, rnpv);
  const defensiveAnalysis = getDefensiveAnalysis(rnpvInput, rnpv, scenarios);

  return {
    rnpv,
    monteCarlo,
    marketSize,
    fxSensitivity,
    scenarios,
    defensiveAnalysis,
  };
}
