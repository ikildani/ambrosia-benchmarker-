/**
 * Progressive input filtering — pure functions that determine which options
 * are available based on the user's current selections, preventing impossible
 * combinations at the UI level rather than via post-hoc validation.
 */
import type { Phase, DealType, Territory } from './calculations';
import { phaseOptions, dealTypeOptions, territoryOptions } from './calculations';

// ── Phase x Deal Type filtering ──────────────────────────────────────────────

/** Phases hidden for each deal type */
const HIDDEN_PHASES_BY_DEAL_TYPE: Record<DealType, Phase[]> = {
  acquisition: ['discovery'],
  option: ['approved', 'nda_filed'],
  collaboration: ['approved', 'nda_filed', 'phase3'],
  licensing: [],
  codevelopment: ['discovery'],
};

/** Deal types hidden for each phase */
const HIDDEN_DEAL_TYPES_BY_PHASE: Record<Phase, DealType[]> = {
  discovery: ['acquisition', 'codevelopment'],
  preclinical: [],
  phase1: [],
  phase1_2: [],
  phase2: [],
  phase2_3: [],
  phase3: ['collaboration'],
  nda_filed: ['collaboration', 'option'],
  approved: ['collaboration', 'option'],
};

/** Territories hidden for each deal type (acquisition/collaboration default global) */
const HIDDEN_TERRITORIES_BY_DEAL_TYPE: Record<DealType, Territory[]> = {
  acquisition: ['us_only', 'ex_us', 'us_eu', 'us_japan', 'europe', 'japan', 'china', 'canada', 'south_korea', 'australia', 'apac_ex_cj', 'latam', 'mena', 'row'],
  collaboration: ['us_only', 'ex_us', 'us_eu', 'us_japan', 'europe', 'japan', 'china', 'canada', 'south_korea', 'australia', 'apac_ex_cj', 'latam', 'mena', 'row'],
  licensing: [],
  option: [],
  codevelopment: [],
};

// ── Phase range descriptions for deal type tooltips ──────────────────────────

export const dealTypePhaseHints: Record<DealType, string> = {
  licensing: 'All phases available',
  acquisition: 'Preclinical through Approved',
  codevelopment: 'Preclinical through Approved',
  option: 'Discovery through Phase 3',
  collaboration: 'Discovery through Phase 2/3',
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the phase options that are valid given the selected deal type.
 * If no deal type is provided, returns all phases.
 */
export function getAvailablePhases(dealType?: DealType): typeof phaseOptions {
  if (!dealType) return phaseOptions;
  const hidden = new Set(HIDDEN_PHASES_BY_DEAL_TYPE[dealType] ?? []);
  if (hidden.size === 0) return phaseOptions;
  return phaseOptions.filter(opt => !hidden.has(opt.value as Phase));
}

/**
 * Returns the deal type options that are valid given the selected phase.
 * If no phase is provided, returns all deal types.
 */
export function getAvailableDealTypes(phase?: Phase): typeof dealTypeOptions {
  if (!phase) return dealTypeOptions;
  const hidden = new Set(HIDDEN_DEAL_TYPES_BY_PHASE[phase] ?? []);
  if (hidden.size === 0) return dealTypeOptions;
  return dealTypeOptions.filter(opt => !hidden.has(opt.value as DealType));
}

/**
 * Returns the territory options that are valid given the selected deal type.
 * Acquisition and collaboration are locked to global.
 */
export function getAvailableTerritories(dealType?: DealType): typeof territoryOptions {
  if (!dealType) return territoryOptions;
  const hidden = new Set(HIDDEN_TERRITORIES_BY_DEAL_TYPE[dealType] ?? []);
  if (hidden.size === 0) return territoryOptions;
  return territoryOptions.filter(opt => !hidden.has(opt.value as Territory));
}

/**
 * When a field changes, checks whether dependent fields now hold an invalid
 * value. Returns a patch of field resets needed, or null if nothing to reset.
 */
export function getFieldResets(
  changedField: 'dealType' | 'phase',
  newValue: string,
  currentState: { phase: Phase | string; dealType: DealType | string; territory: Territory },
): Partial<{ phase: Phase; dealType: DealType; territory: Territory }> | null {
  const resets: Partial<{ phase: Phase; dealType: DealType; territory: Territory }> = {};
  let hasResets = false;

  if (changedField === 'dealType') {
    const newDealType = newValue as DealType;
    // Check if current phase is still valid
    const availablePhases = getAvailablePhases(newDealType);
    const phaseValues = new Set(availablePhases.map(o => o.value));
    if (!currentState.phase || !phaseValues.has(currentState.phase as Phase)) {
      // Pick the nearest valid phase — prefer the closest one in the ordered list
      resets.phase = findNearestPhase((currentState.phase || 'phase2') as Phase, availablePhases);
      hasResets = true;
    }
    // Check if current territory is still valid
    const availableTerritories = getAvailableTerritories(newDealType);
    const territoryValues = new Set(availableTerritories.map(o => o.value));
    if (!territoryValues.has(currentState.territory)) {
      resets.territory = 'global';
      hasResets = true;
    }
  }

  if (changedField === 'phase') {
    const newPhase = newValue as Phase;
    // Check if current deal type is still valid
    const availableDealTypes = getAvailableDealTypes(newPhase);
    const dealTypeValues = new Set(availableDealTypes.map(o => o.value));
    if (!dealTypeValues.has(currentState.dealType)) {
      // Default to licensing (always valid)
      resets.dealType = 'licensing';
      hasResets = true;
    }
  }

  return hasResets ? resets : null;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

const PHASE_ORDER: Phase[] = [
  'discovery', 'preclinical', 'phase1', 'phase1_2',
  'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved',
];

function findNearestPhase(
  current: Phase,
  available: { value: string }[],
): Phase {
  const availableSet = new Set(available.map(o => o.value));
  const currentIdx = PHASE_ORDER.indexOf(current);

  // Search outward from current position
  for (let offset = 1; offset < PHASE_ORDER.length; offset++) {
    // Try later phases first (more conservative)
    if (currentIdx - offset >= 0 && availableSet.has(PHASE_ORDER[currentIdx - offset])) {
      return PHASE_ORDER[currentIdx - offset];
    }
    if (currentIdx + offset < PHASE_ORDER.length && availableSet.has(PHASE_ORDER[currentIdx + offset])) {
      return PHASE_ORDER[currentIdx + offset];
    }
  }

  // Fallback (should not happen)
  return available[0].value as Phase;
}
