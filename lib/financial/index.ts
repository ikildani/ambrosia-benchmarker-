/**
 * Financial Modeling Engine — Barrel Export
 *
 * Re-exports all financial modeling functions for clean imports:
 *   import { calculateRNPV, runMonteCarlo, ... } from '@/lib/financial';
 */

// Core engines
export { calculateRNPV, getCogsRate, getGenericErosionRate, getDefaultDiscountRate } from './rnpv-engine';
export { runMonteCarlo } from './monte-carlo';
export { estimateMarketSize, getEpidemiologyData, formatPatientFunnel } from './market-size';
export { calculateFXSensitivity, getPricingPressureNarrative } from './fx-sensitivity';
export { applyScenario, runAllScenarios, getDefensiveAnalysis, SCENARIO_TEMPLATES } from './scenario-planner';
export { buildScenarioBridge } from './scenario-bridge';
export { DEFAULT_DISCOUNT_RATES } from './discount-rates';

// PoS tables & helpers
export {
  getCumulativePoS,
  getPhaseDuration,
  getPhaseCost,
  getRemainingDevelopmentCost,
  getRemainingTimeToMarket,
  getBaselineLOA,
} from './pos-tables';

// Validation
export { validateRNPVInput, safeValidateRNPVInput, RNPVInputSchema, MonteCarloInputSchema } from './validation';

// Calibration
export { CALIBRATION_DEALS, runCalibrationBacktest } from './calibration';

// Index drug benchmarking (Nirav Jhaveri feedback — April 2026)
export {
  INDEX_DRUG_DATABASE,
  findIndexDrug,
  getIndexDrugsForTA,
  checkPeakSalesRealism,
  findTopComparables,
  getPhaseAdjustedConfidence,
  getGenericEntrenchmentMultiplier,
  checkEpidemiologyDataSufficiency,
  MANUFACTURING_WACC_PREMIUM,
  MARKET_ACCESS_DELAY_MONTHS,
} from './index-drugs';
export type { IndexDrug, ComparableResult, PhaseAdjustedConfidence } from './index-drugs';

// Types (re-export everything for consumer convenience)
export type {
  RNPVInput,
  RNPVResult,
  CashFlowYear,
  MonteCarloInput,
  MonteCarloResult,
  MarketSizeEstimate,
  EpidemiologyData,
  ScenarioTemplate,
  ScenarioResult,
  DefensiveAnalysis,
  FXSensitivity,
  TerritoryPricingProfile,
  CompetitiveLandscape,
  CompetitiveAsset,
  DealFlowForecast,
  AcquisitionLikelihood,
} from './types';

export type { ScenarioBridge, ScenarioBridgeAdjustment } from './scenario-bridge';

// Custom assumptions
export { getResolvedDefaults } from './default-assumptions';
export type { ResolvedDefaults } from './default-assumptions';
export type { CustomAssumptions } from './types';
