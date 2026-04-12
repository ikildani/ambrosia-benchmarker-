/**
 * Deal Type & Phase Normalization Helpers
 *
 * The calculator (lib/calculations.ts) and the deals database use different
 * spellings for the same enums. These helpers bridge the two namespaces so that
 * Tier 3 features (counterparty premiums, ensemble valuation comparable filter)
 * can join calculator inputs to historical deal records.
 *
 * Calculator dealType:    'licensing' | 'acquisition' | 'codevelopment' | 'option' | 'collaboration'
 * DB deals.deal_type:     'license'   | 'acquisition' | 'co_development' | 'option' | 'collaboration' | 'co_promotion' | 'other'
 *
 * Calculator phase:       'phase1', 'phase2', 'phase3', 'phase1_2', 'phase2_3', 'nda_filed', 'approved', ...
 * DB deals.phase_at_signing: 'phase_1', 'phase_2', 'phase_3', 'discovery', 'preclinical', 'approved', 'unknown'
 *
 * @module lib/financial/deal-type-normalization
 */

import type { DealType } from '@/lib/calculations';

// ---------------------------------------------------------------------------
// Deal type normalization
// ---------------------------------------------------------------------------

/** Maps calculator DealType → deals table deal_type */
export function normalizeDealTypeForDB(dealType: DealType): string {
  switch (dealType) {
    case 'licensing':
      return 'license';
    case 'codevelopment':
      return 'co_development';
    case 'acquisition':
    case 'option':
    case 'collaboration':
      return dealType;
    default: {
      // Exhaustiveness check — TS will error if a new DealType is added
      const _exhaustive: never = dealType;
      return _exhaustive;
    }
  }
}

/**
 * Maps deals table deal_type → calculator DealType.
 * Returns null for DB-only values ('co_promotion', 'other') that have no
 * calculator equivalent — callers should treat these as "unsupported" rather
 * than guessing.
 */
export function normalizeDealTypeFromDB(dbDealType: string | null | undefined): DealType | null {
  if (!dbDealType) return null;
  switch (dbDealType.toLowerCase()) {
    case 'license':
    case 'licensing':
      return 'licensing';
    case 'co_development':
    case 'codevelopment':
      return 'codevelopment';
    case 'acquisition':
      return 'acquisition';
    case 'option':
      return 'option';
    case 'collaboration':
      return 'collaboration';
    // Unmapped: 'co_promotion', 'other', 'unknown', etc.
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Phase normalization
// ---------------------------------------------------------------------------

/**
 * Ordered phase ladder used for ±1 widening in comparable filters.
 * Compound phases (phase1_2, phase2_3) collapse to the higher phase for
 * DB lookups since the deals table only stores discrete phases.
 */
const PHASE_LADDER = [
  'discovery',
  'preclinical',
  'phase_1',
  'phase_2',
  'phase_3',
  'approved',
] as const;
type DBPhase = (typeof PHASE_LADDER)[number] | 'unknown';

/** Maps calculator phase → deals table phase_at_signing */
export function normalizePhaseForDB(phase: string | null | undefined): DBPhase {
  if (!phase) return 'unknown';
  const p = phase.toLowerCase();
  switch (p) {
    case 'discovery':
      return 'discovery';
    case 'preclinical':
      return 'preclinical';
    case 'phase1':
    case 'phase_1':
      return 'phase_1';
    case 'phase1_2':
    case 'phase_1_2':
      // Collapse compound to the higher of the two phases — represents the
      // furthest milestone reached, which is what the deals table records.
      return 'phase_2';
    case 'phase2':
    case 'phase_2':
      return 'phase_2';
    case 'phase2_3':
    case 'phase_2_3':
      return 'phase_3';
    case 'phase3':
    case 'phase_3':
      return 'phase_3';
    case 'nda_filed':
    case 'bla_filed':
      // Filed but not yet approved — closest DB equivalent is phase_3
      return 'phase_3';
    case 'approved':
      return 'approved';
    default:
      return 'unknown';
  }
}

/** Maps deals table phase_at_signing → calculator phase. */
export function normalizePhaseFromDB(dbPhase: string | null | undefined): string {
  if (!dbPhase) return 'unknown';
  switch (dbPhase.toLowerCase()) {
    case 'discovery':
      return 'discovery';
    case 'preclinical':
      return 'preclinical';
    case 'phase_1':
    case 'phase1':
    case 'early_phase_1':
      return 'phase1';
    case 'phase_1_2':
    case 'phase1_2':
      return 'phase1_2';
    case 'phase_2':
    case 'phase2':
      return 'phase2';
    case 'phase_2_3':
    case 'phase2_3':
      return 'phase2_3';
    case 'phase_3':
    case 'phase3':
      return 'phase3';
    case 'phase_4':
    case 'phase4':
    case 'approved':
      return 'approved';
    default:
      return 'unknown';
  }
}

/**
 * Returns the set of DB phases within ±`window` steps of the given phase
 * along the discrete ladder. Used by ensemble Method 2 (comparable filter)
 * and counterparty premium grouping to widen sample size when an exact
 * phase match is too sparse.
 *
 * Example: phaseWindowDB('phase_2', 1) → ['phase_1', 'phase_2', 'phase_3']
 *
 * `unknown` returns just itself (no widening — we don't know what to widen to).
 */
export function phaseWindowDB(phase: DBPhase, window: number = 1): DBPhase[] {
  if (phase === 'unknown') return ['unknown'];
  const idx = PHASE_LADDER.indexOf(phase);
  if (idx === -1) return [phase];
  const start = Math.max(0, idx - window);
  const end = Math.min(PHASE_LADDER.length - 1, idx + window);
  return PHASE_LADDER.slice(start, end + 1) as DBPhase[];
}

/** Same widening over calculator phase strings — used by comparableDeals.ts filter. */
export function phaseWindowCalculator(phase: string, window: number = 1): string[] {
  const dbPhase = normalizePhaseForDB(phase);
  const dbWindow = phaseWindowDB(dbPhase, window);
  return dbWindow.map(normalizePhaseFromDB);
}
