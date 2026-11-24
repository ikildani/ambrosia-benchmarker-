/**
 * Search & Evaluation — ownership attribution.
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
  /** clinical_assets.asset_name (migration 143 name rules). */
  assetName?: string | null;
  /** Other originator programs of the same company sharing this asset's code prefix (migration 143). */
  codePrefixOriginators?: number;
  /** Another industry company holds the same drug node (migration 173). */
  sharedWithOtherCompanies?: boolean;
  /** The drug node is a combination (migration 173: marketed_shared applies to single agents only). */
  drugIsCombination?: boolean;
  /** The drug's originator is in this row's corporate family (migration 193). */
  originatorInFamily?: boolean;
  /** Where the row came from (migration 197: disclosure and designation rows). */
  assetOrigin?: 'registry' | 'filing' | 'pipeline_page' | 'press' | 'designation' | 'user' | 'deal' | null;
  /**
   * Another same-script corporate family sponsored this single-agent, unapproved drug >= 180 days
   * earlier and holds it as originator (migration 197).
   */
  laterSponsor?: boolean;
  /** A reviewer's correction from /admin/radar-audit (radar_ownership_overrides). */
  overrideStatus?: OwnershipStatus | null;
}

export type OwnershipRule =
  | 'comparator_named'
  | 'code_prefix_match'
  | 'originator_match'
  | 'drug_owner_role'
  | 'marketed_other'
  | 'comparator'
  | 'originator_mismatch'
  | 'marketed_shared'
  | 'arm_comparator'
  | 'sponsor_default'
  | 'later_sponsor'
  | 'filing_disclosure'
  | 'pipeline_page_disclosure'
  | 'designation_sponsor'
  | 'sponsor_unknown_arm'
  | 'manual_override'
  | 'no_arm_evidence';

export interface OwnershipResult {
  status: OwnershipStatus;
  rule: OwnershipRule;
  evidence: OwnershipEvidence;
}

/** "Comparators: simvastatin and ezetimibe", "Placebo", "Standard of care": the row names a comparator, not a program. */
export const COMPARATOR_NAME_RE = /^(comparators?\b|placebo\b|standard[- ]of[- ]care|soc\b|control\b|vehicle\b|sham\b|best supportive care|no intervention|usual care|background therapy|watchful waiting|active surveillance|observation\b)/i;

/** "Daridorexant matching placebo", "Tablets matching VQ-101", "The placebo presentation is ..." (migration 197). */
export const PLACEBO_TEXT_RE = /(matching placebo|placebo[- ]matching|placebo to match|matched placebo|^the placebo\b|placebo presentation|^(tablets?|capsules?|injections?|solution|vials?) matching\b)/i;

/** Mirrors radar_is_comparator_named() without its placeholder-name branch. */
export function isComparatorNamed(name: string | null | undefined): boolean {
  const n = name ?? '';
  return COMPARATOR_NAME_RE.test(n) || PLACEBO_TEXT_RE.test(n);
}

/**
 * The name carries a sponsor development code anywhere (CT-P13, "MK-3475 (pembrolizumab)",
 * SHR-A1811). Mirrors radar_has_dev_code() (migration 173).
 */
export function hasDevelopmentCode(name: string | null | undefined): boolean {
  return /(^|[^A-Za-z0-9])[A-Z]{1,6}(-[A-Z])?[- ]?[0-9]{2,8}[A-Za-z]{0,2}([^A-Za-z0-9]|$)/.test(name ?? '');
}

/** "JDQ443" -> "JDQ", "CP-742,033" -> "CP", "Dotinurad" -> null. Mirrors radar_code_prefix(). */
export function codePrefixOf(name: string | null | undefined): string | null {
  if (!name) return null;
  let m = /^([A-Za-z]{2,6})[- ]?[0-9]{2,6}[A-Za-z]?$/.exec(name);
  if (m) return m[1].toUpperCase();
  m = /^([A-Za-z]{2,6})-[0-9]{2,4},[0-9]{3}$/.exec(name);
  return m ? m[1].toUpperCase() : null;
}

/** How many other originator programs a company needs in a code series before the series is trusted. */
export const CODE_PREFIX_MIN_ORIGINATORS = 2;

/**
 * First matching rule wins. Mirrors the CASE in radar_apply_ownership():
 *   comparator_named     the row is named after a comparator or placebo
 *   originator_match     trusted originator is this company
 *   drug_owner_role      drug_owners records this company as licensee / co-developer
 *   marketed_other       trusted originator is another company and the drug is
 *                        phase_4 here or approved anywhere
 *   comparator           trusted originator is another company and the drug never
 *                        sits in one of this company's experimental arms
 *   code_prefix_match    the asset is a development code in a series that already
 *                        names >= 2 of this company's originator programs; the
 *                        company's own naming beats a foreign drug_master originator
 *   originator_mismatch  trusted originator is another company but the drug is in
 *                        an experimental arm here: a possible licensee with no deal
 *                        on record, left visible as 'unknown'
 *   marketed_shared      (migration 173) no trusted originator, the single-agent drug is
 *                        approved, another industry company holds it too, and this row's
 *                        name carries no development code: a backbone, comparator, DDI
 *                        probe or generic, not the sponsor's program
 *   arm_comparator       no trusted originator; every matched arm is a comparator
 *   later_sponsor        (migration 197) another same-script family sponsored this single-agent,
 *                        unapproved drug >= 180 days earlier and holds it as originator: 'unknown',
 *                        and availability marks it originator_elsewhere
 *   sponsor_default      no trusted originator; at least one experimental arm
 *   code_prefix_match    (again) no arms, but the code series is the company's own
 *   filing_disclosure / pipeline_page_disclosure
 *                        (migration 197) the company's own filing or pipeline page lists it and no
 *                        other company holds the drug
 *   designation_sponsor  (migration 197) sponsor of an FDA orphan designation, drug not held elsewhere
 *   sponsor_unknown_arm  (migration 197) sponsored trial, arm role unrecorded, own development code,
 *                        drug not held elsewhere
 *   no_arm_evidence      nothing matched
 * A reviewer's correction (manual_override) comes before every rule.
 */
export function deriveOwnership(input: OwnershipInput): OwnershipResult {
  const drug = input.drug;
  const trustedOriginator = !!drug && !!drug.originatorCompanyId && drug.confidence >= ORIGINATOR_TRUST_MIN;
  const marketed = input.phase === 'phase_4' || drug?.maxPhase === 'approved';
  const experimental = input.armRoles.filter(r => r === 'experimental').length;
  const comparator = input.armRoles.filter(r => (COMPARATOR_ARM_ROLES as readonly string[]).includes(r)).length;
  const unknownArms = input.armRoles.filter(r => r === 'unknown').length;
  const matched = input.armRoles.length;
  const codePrefix = codePrefixOf(input.assetName);
  const seriesOwned = codePrefix !== null && (input.codePrefixOriginators ?? 0) >= CODE_PREFIX_MIN_ORIGINATORS;

  const shared = !!input.sharedWithOtherCompanies;

  let rule: OwnershipRule;
  let status: OwnershipStatus;
  if (input.overrideStatus) {
    rule = 'manual_override'; status = input.overrideStatus;
  } else if (isComparatorNamed(input.assetName)) {
    rule = 'comparator_named'; status = 'comparator_or_background';
  } else if (trustedOriginator && (drug!.originatorCompanyId === input.companyId || input.originatorInFamily)) {
    rule = 'originator_match'; status = 'originator';
  } else if (input.ownerRole) {
    rule = 'drug_owner_role'; status = input.ownerRole;
  } else if (trustedOriginator && marketed) {
    rule = 'marketed_other'; status = 'marketed_other';
  } else if (trustedOriginator && experimental === 0) {
    rule = 'comparator'; status = 'comparator_or_background';
  } else if (trustedOriginator && seriesOwned) {
    rule = 'code_prefix_match'; status = 'originator';
  } else if (trustedOriginator) {
    rule = 'originator_mismatch'; status = 'unknown';
  } else if (drug?.maxPhase === 'approved' && !input.drugIsCombination && input.sharedWithOtherCompanies && !hasDevelopmentCode(input.assetName)) {
    rule = 'marketed_shared'; status = 'marketed_other';
  } else if (matched > 0 && experimental === 0 && comparator > 0) {
    rule = 'arm_comparator'; status = 'comparator_or_background';
  } else if (input.laterSponsor && !seriesOwned) {
    rule = 'later_sponsor'; status = 'unknown';
  } else if (experimental > 0) {
    rule = 'sponsor_default'; status = 'originator';
  } else if (seriesOwned) {
    rule = 'code_prefix_match'; status = 'originator';
  } else if (input.assetOrigin === 'filing' && !shared) {
    rule = 'filing_disclosure'; status = 'originator';
  } else if (input.assetOrigin === 'pipeline_page' && !shared) {
    rule = 'pipeline_page_disclosure'; status = 'originator';
  } else if (input.assetOrigin === 'designation' && !shared) {
    rule = 'designation_sponsor'; status = 'originator';
  } else if (unknownArms > 0 && experimental === 0 && comparator === 0 && hasDevelopmentCode(input.assetName) && !shared) {
    rule = 'sponsor_unknown_arm'; status = 'originator';
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
  if (rule === 'code_prefix_match') {
    evidence.code_prefix = codePrefix ?? undefined;
    evidence.code_prefix_originators = input.codePrefixOriginators;
  }
  return { status, rule, evidence };
}

/** True when the feed hides this status unless the ownership facet asks for it. */
export function isOwnershipHiddenByDefault(status: OwnershipStatus | string | null | undefined): boolean {
  return !!status && RADAR_OWNERSHIP_DEFAULT_EXCLUDED.includes(status);
}

/** PostgREST filter value for `.not('ownership_status', 'in', …)`. */
export const OWNERSHIP_EXCLUDED_IN = `(${RADAR_OWNERSHIP_DEFAULT_EXCLUDED.join(',')})`;
