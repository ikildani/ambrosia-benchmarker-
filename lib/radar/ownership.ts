/**
 * Asset Radar — ownership attribution.
 *
 * Does the company on a clinical_assets row actually own the program, or is
 * it running somebody else's drug (comparator arm, background therapy, a
 * marketed product in an investigator-style study)? The Sep 2026 audit found
 * 79,027 of 150,113 rows whose drug_master originator was a different
 * company, and the feed ranked Pembrolizumab at Merck KGaA and Nusinersen at
 * Scholar Rock above every real unpartnered program.
 *
 * The rules live in radar_apply_ownership() (migration 125), which runs
 * set-based over the whole table. This module is the pure mirror: it
 * documents the rules, is unit-tested, and lets the indexer and the UI
 * reason about a single row without a round trip. Keep the two in step.
 */

import type { OwnershipEvidence, OwnershipStatus } from '@/lib/radar/types';
import { RADAR_OWNERSHIP_DEFAULT_EXCLUDED } from '@/lib/radar/vocab';

/** drug_master originator rows below this confidence are not trusted for attribution. */
export const ORIGINATOR_TRUST_MIN = 70;

export type ArmRole = 'experimental' | 'active_comparator' | 'placebo_comparator' | 'sham' | 'no_intervention' | 'other' | 'unknown';

export const COMPARATOR_ARM_ROLES: readonly ArmRole[] = ['active_comparator', 'placebo_comparator', 'sham', 'no_intervention', 'other'];

export interface OwnershipInput {
  /** The owning company on the asset row. */
  companyId: string | null;
  /** Highest phase on the asset row (vocab slug). */
  phase: string | null;
  /** Resolved drug_master row, if any. */
  drug: {
    id: string;
    originatorCompanyId: string | null;
    confidence: number;
    maxPhase: string | null;
  } | null;
  /** drug_owners role for (drug, company), if any. */
  ownerRole: 'licensee' | 'co_developer' | null;
  /** Arm roles of the company's trial_interventions rows that name this asset. */
  armRoles: readonly ArmRole[];
}

export type OwnershipRule =
  | 'originator_match'
  | 'drug_owner_role'
  | 'marketed_other'
  | 'comparator'
  | 'originator_mismatch'
  | 'arm_comparator'
  | 'sponsor_default'
  | 'no_arm_evidence';

export interface OwnershipResult {
  status: OwnershipStatus;
  rule: OwnershipRule;
  evidence: OwnershipEvidence;
}

/**
 * First matching rule wins. Mirrors the CASE in radar_apply_ownership():
 *   originator_match     trusted originator is this company
 *   drug_owner_role      drug_owners records this company as licensee / co-developer
 *   marketed_other       trusted originator is another company and the drug is
 *                        phase_4 here or approved anywhere
 *   comparator           trusted originator is another company and the drug never
 *                        sits in one of this company's experimental arms
 *   originator_mismatch  trusted originator is another company but the drug is in
 *                        an experimental arm here: a possible licensee with no deal
 *                        on record, left visible as 'unknown'
 *   arm_comparator       no trusted originator; every matched arm is a comparator
 *   sponsor_default      no trusted originator; at least one experimental arm
 *   no_arm_evidence      nothing matched
 */
export function deriveOwnership(input: OwnershipInput): OwnershipResult {
  const drug = input.drug;
  const trustedOriginator = !!drug && !!drug.originatorCompanyId && drug.confidence >= ORIGINATOR_TRUST_MIN;
  const marketed = input.phase === 'phase_4' || drug?.maxPhase === 'approved';
  const experimental = input.armRoles.filter(r => r === 'experimental').length;
  const comparator = input.armRoles.filter(r => (COMPARATOR_ARM_ROLES as readonly string[]).includes(r)).length;
  const unknownArms = input.armRoles.filter(r => r === 'unknown').length;
  const matched = input.armRoles.length;

  let rule: OwnershipRule;
  let status: OwnershipStatus;
  if (trustedOriginator && drug!.originatorCompanyId === input.companyId) {
    rule = 'originator_match'; status = 'originator';
  } else if (input.ownerRole) {
    rule = 'drug_owner_role'; status = input.ownerRole;
  } else if (trustedOriginator && marketed) {
    rule = 'marketed_other'; status = 'marketed_other';
  } else if (trustedOriginator && experimental === 0) {
    rule = 'comparator'; status = 'comparator_or_background';
  } else if (trustedOriginator) {
    rule = 'originator_mismatch'; status = 'unknown';
  } else if (matched > 0 && experimental === 0 && comparator > 0) {
    rule = 'arm_comparator'; status = 'comparator_or_background';
  } else if (experimental > 0) {
    rule = 'sponsor_default'; status = 'originator';
  } else {
    rule = 'no_arm_evidence'; status = 'unknown';
  }

  const evidence: OwnershipEvidence = {
    rule,
    arms: { experimental, comparator, unknown: unknownArms },
    matched_interventions: matched,
  };
  if (drug) {
    evidence.drug_master_id = drug.id;
    if (drug.originatorCompanyId) evidence.originator_company_id = drug.originatorCompanyId;
    evidence.originator_confidence = drug.confidence;
    if (drug.maxPhase) evidence.max_phase = drug.maxPhase;
  }
  if (input.ownerRole) evidence.owner_role = input.ownerRole;
  return { status, rule, evidence };
}

/** True when the feed hides this status unless the ownership facet asks for it. */
export function isOwnershipHiddenByDefault(status: OwnershipStatus | string | null | undefined): boolean {
  return !!status && RADAR_OWNERSHIP_DEFAULT_EXCLUDED.includes(status);
}

/** PostgREST filter value for `.not('ownership_status', 'in', …)`. */
export const OWNERSHIP_EXCLUDED_IN = `(${RADAR_OWNERSHIP_DEFAULT_EXCLUDED.join(',')})`;
