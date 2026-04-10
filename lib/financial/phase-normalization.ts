/**
 * Canonical phase format used throughout the platform.
 *
 * Different upstream data sources spell out clinical phase inconsistently:
 *   - ClinicalTrials.gov: "Phase 1", "Phase 1/Phase 2", "Phase 2/Phase 3"
 *   - SEC filings: "phase_1", "phase_1_2", "phase1/2"
 *   - Internal legacy: "phase1", "phase1_2"
 *
 * All engines should import normalizePhase() and standardize on the
 * CanonicalPhase union rather than doing ad-hoc substring comparisons,
 * which are error-prone (e.g., "phase2".includes("phase2") is true but
 * so is "phase2_3".includes("phase2"), causing late-stage classifiers
 * to drift).
 *
 * @module lib/financial/phase-normalization
 */

export type CanonicalPhase =
  | 'discovery'
  | 'preclinical'
  | 'phase1'
  | 'phase1_2'
  | 'phase2'
  | 'phase2_3'
  | 'phase3'
  | 'nda_filed'
  | 'approved';

const VALID_PHASES: readonly CanonicalPhase[] = [
  'discovery',
  'preclinical',
  'phase1',
  'phase1_2',
  'phase2',
  'phase2_3',
  'phase3',
  'nda_filed',
  'approved',
];

/**
 * Normalize an arbitrary phase string to the canonical form.
 *
 * Accepts any of the common legacy/alternate formats:
 *   "Phase 1"    -> "phase1"
 *   "phase_1"    -> "phase1"
 *   "Phase 1/2"  -> "phase1_2"
 *   "phase 2/3"  -> "phase2_3"
 *
 * Returns `null` for empty/unknown values so callers can skip or fall
 * back instead of silently defaulting.
 */
export function normalizePhase(
  phase: string | undefined | null,
): CanonicalPhase | null {
  if (!phase) return null;
  const normalized = phase
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '') // "phase 1" -> "phase1"
    .replace(/\//g, '_') // "phase1/2" -> "phase1_2"
    .replace(/^phase_/, 'phase'); // "phase_1" -> "phase1"

  return (VALID_PHASES as readonly string[]).includes(normalized)
    ? (normalized as CanonicalPhase)
    : null;
}

/**
 * Test whether a phase string represents one of the named canonical phases.
 * Safe against substring-collision bugs (phase2 ≠ phase2_3).
 */
export function isPhase(
  phase: string | undefined | null,
  target: CanonicalPhase,
): boolean {
  return normalizePhase(phase) === target;
}

/**
 * Test whether a phase string matches ANY of the named canonical phases.
 */
export function isOneOfPhases(
  phase: string | undefined | null,
  targets: readonly CanonicalPhase[],
): boolean {
  const normalized = normalizePhase(phase);
  return normalized !== null && targets.includes(normalized);
}
