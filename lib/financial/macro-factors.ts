/**
 * Macro Factor Adjustment (Tier 4 Item 12)
 *
 * Live-refreshed macro inputs for the discount-rate stack: US 10-year Treasury
 * yield (risk-free rate), biotech beta (IBB/NBI proxy), and equity risk
 * premium (Damodaran). The cron refreshes daily; `calculateRNPV` reads the
 * snapshot synchronously from a module-level cache.
 *
 * Bounds: the final WACC is always clamped to [0.05, 0.25]. If any upstream
 * source returns nonsense (negative treasury yield, beta > 3, etc.) we fall
 * back to `STATIC_MACRO_FALLBACK` rather than destabilize the model.
 *
 * Sources:
 *   - 10Y Treasury: FRED series DGS10 (https://api.stlouisfed.org)
 *   - Biotech beta: Yahoo Finance IBB (iShares Nasdaq Biotechnology ETF)
 *   - Equity risk premium: Damodaran NYU monthly dataset
 *
 * @module lib/financial/macro-factors
 */

export interface MacroSnapshot {
  /** ISO date YYYY-MM-DD */
  snapshotDate: string;
  /** 10Y Treasury yield (decimal, e.g. 0.045 for 4.5%) */
  treasury10y: number;
  /** Biotech beta (unitless, typical range 0.8-1.5) */
  biotechBeta: number;
  /** Equity risk premium (decimal, typical 0.05-0.065) */
  equityRiskPremium: number;
  /** Provenance of this snapshot */
  source: 'live' | 'cached' | 'fallback';
}

/**
 * Static fallback used when no DB snapshot and no live API response.
 * Values reflect mid-2026 US rate environment (post-Fed pause).
 */
export const STATIC_MACRO_FALLBACK: MacroSnapshot = {
  snapshotDate: '2026-04-01',
  treasury10y: 0.045,     // 4.5% — US 10Y range 2024-2026
  biotechBeta: 1.15,      // IBB historical 10y avg
  equityRiskPremium: 0.055, // Damodaran 2026 implied ERP
  source: 'fallback',
};

// ---------------------------------------------------------------------------
// Hard floors / ceilings — sanity bounds on upstream data
// ---------------------------------------------------------------------------

/** Minimum rf to guard against negative-rate regimes breaking option pricing. */
const MIN_RISK_FREE_RATE = 0.005;
/** Maximum rf to guard against API error returning absurd values. */
const MAX_RISK_FREE_RATE = 0.10;
/** Final WACC is clamped to this range regardless of macro inputs. */
export const WACC_FLOOR = 0.05;
export const WACC_CEILING = 0.25;

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

/**
 * Cached snapshot. Hydrated at server boot via `setMacroSnapshot()` (called
 * from the cron handler after it writes the DB row, or from instrumentation.ts
 * at boot reading the latest row). In test environments this starts as
 * STATIC_MACRO_FALLBACK.
 */
let cachedSnapshot: MacroSnapshot = STATIC_MACRO_FALLBACK;

/** Returns the current macro snapshot (sync — reads the module cache). */
export function getMacroSnapshot(): MacroSnapshot {
  return cachedSnapshot;
}

/**
 * Hydrate the cache (called by cron handler or instrumentation bootstrap).
 * Validates bounds; on failure returns false and leaves the cache unchanged.
 */
export function setMacroSnapshot(snapshot: MacroSnapshot): boolean {
  if (!isSnapshotValid(snapshot)) return false;
  cachedSnapshot = snapshot;
  return true;
}

/**
 * Returns the 10Y Treasury yield, floored/ceiled. Used by RealOptions and
 * any other engine needing rf.
 */
export function getRiskFreeRate(): number {
  const rf = cachedSnapshot.treasury10y;
  return Math.max(MIN_RISK_FREE_RATE, Math.min(MAX_RISK_FREE_RATE, rf));
}

/**
 * Returns the rf delta to layer on top of the static discount-rate table.
 * Positive when current rates are above the static baseline (0.045);
 * negative when below. Final WACC is clamped in the caller.
 *
 * @param staticBaseRate — the pre-dynamic WACC from DEFAULT_DISCOUNT_RATES.
 *   Used only to ensure the delta doesn't push the combined rate outside
 *   [WACC_FLOOR, WACC_CEILING].
 */
export function getDynamicWaccComponent(staticBaseRate: number): number {
  const currentRf = getRiskFreeRate();
  const baselineRf = STATIC_MACRO_FALLBACK.treasury10y; // 0.045
  const delta = currentRf - baselineRf;
  // Clamp the result so the final WACC stays in bounds.
  const combined = Math.max(WACC_FLOOR, Math.min(WACC_CEILING, staticBaseRate + delta));
  return combined - staticBaseRate;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isSnapshotValid(s: MacroSnapshot): boolean {
  if (!s || typeof s !== 'object') return false;
  if (!Number.isFinite(s.treasury10y) || s.treasury10y < -0.02 || s.treasury10y > 0.20) return false;
  if (!Number.isFinite(s.biotechBeta) || s.biotechBeta < 0.3 || s.biotechBeta > 3.0) return false;
  if (!Number.isFinite(s.equityRiskPremium) || s.equityRiskPremium < 0.01 || s.equityRiskPremium > 0.15) return false;
  return true;
}

/**
 * Reset the module cache to STATIC_MACRO_FALLBACK. Intended for tests.
 */
export function __resetMacroCacheForTests(): void {
  cachedSnapshot = STATIC_MACRO_FALLBACK;
}
