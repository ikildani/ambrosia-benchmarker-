/**
 * Financial Modeling Engine — Barrel Export
 *
 * Re-exports all financial modeling functions for clean imports:
 *   import { calculateRNPV, runMonteCarlo, ... } from '@/lib/financial';
 */

// Core engines
export { calculateRNPV } from './rnpv-engine';
export { runMonteCarlo } from './monte-carlo';
export { estimateMarketSize, getEpidemiologyData, formatPatientFunnel } from './market-size';
export { calculateFXSensitivity, getPricingPressureNarrative } from './fx-sensitivity';
export { applyScenario, runAllScenarios, getDefensiveAnalysis, SCENARIO_TEMPLATES } from './scenario-planner';
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
