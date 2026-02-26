/**
 * Discount Rate (WACC) Configuration for rNPV Models
 *
 * Rates reflect risk-adjusted cost of capital for pharmaceutical assets.
 * Earlier phases carry higher discount rates due to greater uncertainty.
 *
 * Sources:
 * - Damodaran industry WACC data (pharma/biotech)
 * - Published transaction analyses (Evaluate Pharma, DealForma)
 * - Industry standard: 8-15% depending on stage and therapeutic area
 */

/**
 * Default discount rates by therapeutic area and development phase.
 * Higher rates = more risk = lower NPV.
 */
export const DEFAULT_DISCOUNT_RATES: Record<string, Record<string, number>> = {
  oncology: {
    preclinical: 0.15,
    phase1: 0.13,
    phase2: 0.11,
    phase3: 0.09,
    approved: 0.08,
  },
  neurology: {
    preclinical: 0.16,  // CNS assets carry higher risk
    phase1: 0.14,
    phase2: 0.12,
    phase3: 0.10,
    approved: 0.085,
  },
  immunology: {
    preclinical: 0.14,
    phase1: 0.12,
    phase2: 0.105,
    phase3: 0.09,
    approved: 0.08,
  },
  metabolic: {
    preclinical: 0.14,
    phase1: 0.12,
    phase2: 0.105,
    phase3: 0.09,
    approved: 0.08,
  },
  cardiovascular: {
    preclinical: 0.15,  // Large outcome trials add cost/risk
    phase1: 0.13,
    phase2: 0.115,
    phase3: 0.095,
    approved: 0.08,
  },
  infectiousDisease: {
    preclinical: 0.13,  // Faster development cycle
    phase1: 0.11,
    phase2: 0.10,
    phase3: 0.085,
    approved: 0.075,
  },
  ophthalmology: {
    preclinical: 0.14,
    phase1: 0.12,
    phase2: 0.105,
    phase3: 0.09,
    approved: 0.08,
  },
  womensHealth: {
    preclinical: 0.135,
    phase1: 0.115,
    phase2: 0.10,
    phase3: 0.085,
    approved: 0.075,
  },
};

/**
 * Company type adjustments to base discount rate.
 * Applied as additive adjustment.
 */
export const COMPANY_TYPE_ADJUSTMENT: Record<string, number> = {
  largePharma: -0.01,     // Lower risk, more diversified
  midPharma: 0.0,         // Baseline
  biotech: 0.015,         // Higher risk, less diversified
  clinicalStageBiotech: 0.025,  // Pre-revenue, single-asset risk
  academic: 0.03,         // Highest risk, no commercial infrastructure
};

/**
 * Territory-specific risk premium adjustments.
 * Markets with regulatory/pricing uncertainty carry higher rates.
 */
export const TERRITORY_RISK_PREMIUM: Record<string, number> = {
  global: 0.0,
  us_only: -0.005,     // Most predictable market
  europe: 0.005,       // Reference pricing pressure
  china: 0.025,        // NRDL uncertainty, regulatory differences
  japan: 0.005,        // NHI pricing reform
  ex_us: 0.01,         // Aggregated non-US risk
  row: 0.02,           // Higher emerging market risk
  us_eu: 0.0,
  us_japan: 0.0,
};
