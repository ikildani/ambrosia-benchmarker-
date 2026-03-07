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
    discovery: 0.18,
    preclinical: 0.15,
    phase1: 0.13,
    phase1_2: 0.12,
    phase2: 0.11,
    phase2_3: 0.10,
    phase3: 0.09,
    nda_filed: 0.085,
    approved: 0.08,
  },
  neurology: {
    discovery: 0.19,
    preclinical: 0.16,
    phase1: 0.14,
    phase1_2: 0.13,
    phase2: 0.12,
    phase2_3: 0.11,
    phase3: 0.10,
    nda_filed: 0.09,
    approved: 0.085,
  },
  immunology: {
    discovery: 0.17,
    preclinical: 0.14,
    phase1: 0.12,
    phase1_2: 0.1125,
    phase2: 0.105,
    phase2_3: 0.0975,
    phase3: 0.09,
    nda_filed: 0.085,
    approved: 0.08,
  },
  metabolic: {
    discovery: 0.17,
    preclinical: 0.14,
    phase1: 0.12,
    phase1_2: 0.1125,
    phase2: 0.105,
    phase2_3: 0.0975,
    phase3: 0.09,
    nda_filed: 0.085,
    approved: 0.08,
  },
  cardiovascular: {
    discovery: 0.18,
    preclinical: 0.15,
    phase1: 0.13,
    phase1_2: 0.1225,
    phase2: 0.115,
    phase2_3: 0.105,
    phase3: 0.095,
    nda_filed: 0.085,
    approved: 0.08,
  },
  infectiousDisease: {
    discovery: 0.16,
    preclinical: 0.13,
    phase1: 0.11,
    phase1_2: 0.105,
    phase2: 0.10,
    phase2_3: 0.0925,
    phase3: 0.085,
    nda_filed: 0.08,
    approved: 0.075,
  },
  ophthalmology: {
    discovery: 0.17,
    preclinical: 0.14,
    phase1: 0.12,
    phase1_2: 0.1125,
    phase2: 0.105,
    phase2_3: 0.0975,
    phase3: 0.09,
    nda_filed: 0.085,
    approved: 0.08,
  },
  womensHealth: {
    discovery: 0.165,
    preclinical: 0.135,
    phase1: 0.115,
    phase1_2: 0.1075,
    phase2: 0.10,
    phase2_3: 0.0925,
    phase3: 0.085,
    nda_filed: 0.08,
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
  canada: 0.0,         // Stable market, PMPRB predictable
  australia: 0.005,    // PBAC strict but predictable
  south_korea: 0.01,   // HIRA price controls
  apac_ex_cj: 0.025,   // Fragmented regulatory, access uncertainty
  latam: 0.02,         // Currency volatility, tender market risk
  mena: 0.015,         // Mixed — Gulf stable, North Africa volatile
};
