/**
 * Feature flags — engine calibration features that change numeric output.
 *
 * These flags gate modeling changes that haven't yet been empirically
 * validated via the 100-deal backtest framework (`__tests__/backtest/`).
 * Default OFF so golden master baselines stay stable. Flip ON per-flag
 * once the backtest confirms the change improves predictive accuracy
 * (see engine-grade-a-option-b.md for the rigor methodology).
 *
 * Env vars: `TIER{2,3,4}_<FLAG>=on` enables the flag in any environment.
 * Callers can also pass an explicit input (e.g. `input.timeWindow`) which
 * opts in to the feature regardless of flag state.
 */

/** Tier 2 engine features (Stage 2 of the current roadmap). */
export const TIER2_FLAGS = {
  /** Item 4: time-varying PoS rates (pos-time-windows.ts) */
  timeWindowedPoS: process.env.TIER2_TIME_WINDOWED_POS === 'on',
  /** Item 5: combination therapy modeling (combination-therapy.ts) */
  combinationTherapy: process.env.TIER2_COMBO_THERAPY === 'on',
  /** Item 6: geographic revenue decomposition (geographic-revenue-curves.ts) */
  geographicDecomposition: process.env.TIER2_GEO_DECOMP === 'on',
} as const;

/** Tier 4 engine features (Stage 5 of the roadmap). */
export const TIER4_FLAGS = {
  /** Item 11: 4-bucket risk decomposition in RNPVResult */
  riskDecomposition: process.env.TIER4_RISK_DECOMP === 'on',
  /** Item 12: macro factors — live risk-free rate from FRED/treasury */
  macroFactors: process.env.TIER4_MACRO === 'on',
  /** Item 13: patient subpopulation modeling (mutation/demographic/severity) */
  subpopulation: process.env.TIER4_SUBPOP === 'on',
  /** Item 14: indication-level patent cliff timing */
  patentCliffs: process.env.TIER4_PATENT_CLIFFS === 'on',
} as const;
