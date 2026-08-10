/**
 * Feature Flags
 *
 * Lightweight env-var-driven feature flag mechanism. Read once at module
 * load (Node module caching means no per-request overhead). No external
 * service — set on Vercel via `printf 'on' | npx vercel env add ...` per
 * the lesson about `printf` vs `echo` (CRON_SECRET incident).
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

/**
 * Tier 4 engine grade A+ feature flags. All default off until each
 * item passes its golden master pass.
 *
 * - riskDecomposition: item 11 — populate RNPVResult.riskDecomposition
 * - dynamicWacc:       item 12 — blend FRED-backed macro factors into WACC
 * - subpopulation:     item 13 — apply subpopulation-specific peak/PoS modifiers
 * - patentCliffs:      item 14 — adjust peak sales by leader LOE timing
 *
 * NOTE: this is a `const` object so you can also override individual flags
 * in tests by re-exporting a mutable proxy. For now we keep it simple and
 * tests just set process.env before importing the module under test.
 */
export const TIER4_FLAGS = {
  riskDecomposition: flag('TIER4_RISK_DECOMP'),
  dynamicWacc:       flag('TIER4_DYNAMIC_WACC'),
  subpopulation:     flag('TIER4_SUBPOP'),
  patentCliffs:      flag('TIER4_PATENT_CLIFFS'),
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
    case 'dynamicWacc':        return flag('TIER4_DYNAMIC_WACC');
    case 'subpopulation':      return flag('TIER4_SUBPOP');
    case 'patentCliffs':       return flag('TIER4_PATENT_CLIFFS');
    case 'customAssumptions':  return flag('TIER4_CUSTOM_ASSUMPTIONS');
  }
}
