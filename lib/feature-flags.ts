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
 *
 * Convention: a flag is "on" if its env var is set to 'on', '1', or 'true'
 * (case-sensitive). Anything else (including unset) is "off".
 *
 * To enable a flag locally for tests:
 *   TIER4_RISK_DECOMP=on npx jest __tests__/lib/risk-decomposition.test.ts
 */

function flag(envKey: string): boolean {
  const v = process.env[envKey];
  if (v == null) return false;
  return v === 'on' || v === '1' || v === 'true';
}

/** Tier 2 engine features (Stage 2 of the current roadmap). */
export const TIER2_FLAGS = {
  /** Item 4: time-varying PoS rates (pos-time-windows.ts) */
  timeWindowedPoS: flag('TIER2_TIME_WINDOWED_POS'),
  /** Item 5: combination therapy modeling (combination-therapy.ts) */
  combinationTherapy: flag('TIER2_COMBO_THERAPY'),
  /** Item 6: geographic revenue decomposition (geographic-revenue-curves.ts) */
  geographicDecomposition: flag('TIER2_GEO_DECOMP'),
} as const;

/** Tier 4 engine features (Stage 5 of the roadmap). */
export const TIER4_FLAGS = {
  /** Item 11: 4-bucket risk decomposition in RNPVResult */
  riskDecomposition: flag('TIER4_RISK_DECOMP'),
  /** Item 12: macro factors — live risk-free rate from FRED/treasury */
  macroFactors: flag('TIER4_MACRO'),
  /** Item 13: patient subpopulation modeling (mutation/demographic/severity) */
  subpopulation: flag('TIER4_SUBPOP'),
  /** Item 14: indication-level patent cliff timing */
  patentCliffs: flag('TIER4_PATENT_CLIFFS'),
  /** Custom assumptions override (Pro feature) */
  customAssumptions: flag('TIER4_CUSTOM_ASSUMPTIONS'),
} as const;

/**
 * Force-evaluate a flag at call time rather than module load time.
 * Used by tests that need to flip a flag after the engine modules have
 * already been loaded — TIER4_FLAGS itself is frozen at module load.
 */
export function isFlagOn(flagKey: keyof typeof TIER4_FLAGS): boolean {
  switch (flagKey) {
    case 'riskDecomposition':  return flag('TIER4_RISK_DECOMP');
    case 'macroFactors':       return flag('TIER4_MACRO');
    case 'subpopulation':      return flag('TIER4_SUBPOP');
    case 'patentCliffs':       return flag('TIER4_PATENT_CLIFFS');
    case 'customAssumptions':  return flag('TIER4_CUSTOM_ASSUMPTIONS');
  }
}
