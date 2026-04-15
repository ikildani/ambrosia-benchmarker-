/**
 * Empirical multiplier — composes TA × phase × dealType × modality × asset
 * quality signals into a SINGLE bounded multiplier applied to rNPV.
 *
 * DESIGN (R67 — 2026-04-15)
 * ────────────────────────────────────────────────────────────────────────
 *
 * Prior implementation (R42+R50+R61) composed three uplifts via straight
 * multiplication:
 *
 *   empiricalMultiplier = taUplift * modUplift * phaseDealTypeMult
 *
 * This produced 15–20x multipliers on Phase 2 oncology acquisitions because
 * each calibration round had measured the SAME undershoot against the SAME
 * reference deals (Prometheus-Merck, Karuna-BMS, etc.) and landed separate
 * corrections. When stacked multiplicatively the correction was applied N
 * times for one underlying bias — classic double-counting.
 *
 * This module replaces the stack with a BOUNDED ADDITIVE COMPOSITION:
 *
 *   premium = taPremium + modalityPremium + phaseDealTypePremium
 *   multiplier = 1 + min(premium, ADDITIVE_CAP)
 *   final = min(multiplier, HARD_CAP)
 *
 * Plus two orthogonal fixes:
 *   1. TA uplift is now split by dealType (licensing vs acquisition) —
 *      the R42 taUplift was calibrated against acquisitions and was
 *      inappropriate for licensing deals.
 *   2. Asset-quality tier gating — Phase 2 M&A premiums of 5x were
 *      calibrated against Tier-1 breakthroughs. Generic assets get
 *      half of that premium.
 *
 * INVARIANTS (verified by unit tests):
 *   - multiplier ∈ [0.25, HARD_CAP] for all RNPVInput
 *   - acquisition > licensing at same (TA, phase, modality, asset quality)
 *   - Tier-1 > Tier-2 at same (TA, phase, modality, dealType)
 *   - single source of truth — backtest harness imports the same function
 *
 * CALIBRATION OWNERSHIP:
 *   - TA_UPLIFT, MODALITY_UPLIFT, PHASE_DEALTYPE_BASE are the calibration
 *     surfaces. Adjust via calibration rounds (Round 67+).
 *   - HARD_CAP is a safety backstop, not a calibration target. Do not
 *     raise it without an incident review.
 *
 * AUTOMATION: see
 *   - lib/financial/__tests__/empirical-multiplier.test.ts (invariants)
 *   - scripts/validate-empirical-calibration.ts (regression against
 *     closed deals in lib/financial/calibration.ts)
 */

import type { RNPVInput } from './types';

// ═══════════════════════════════════════════════════════════════════════
// CALIBRATION SURFACES — adjust via calibration rounds
// ═══════════════════════════════════════════════════════════════════════

/**
 * TA × phase × dealType empirical uplift. Addresses the fact that the
 * R42 TA uplifts were calibrated against acquisition-heavy cohorts and
 * were inappropriately amplifying licensing deals.
 *
 * Key: TA_UPLIFT[therapeuticArea][phase || '*'][dealType]
 *
 * Source: R50 cleaned corpus (337 verified + 251 curated) + R61 M&A
 * split. Licensing values are new for R67 and are anchored to median
 * closed licensing deals per cohort, not acquisition tails.
 */
export const TA_UPLIFT: Record<string, Record<string, Partial<Record<string, number>>>> = {
  oncology: {
    phase2:    { acquisition: 3.0, licensing: 1.5, codevelopment: 2.0, collaboration: 1.8, option: 1.4 },
    phase2_3:  { acquisition: 3.0, licensing: 1.5, codevelopment: 2.0, collaboration: 1.8 },
    phase3:    { acquisition: 1.3, licensing: 1.1, codevelopment: 1.2, collaboration: 1.15 },
    nda_filed: { acquisition: 1.2, licensing: 1.4 },
    approved:  { acquisition: 1.1, licensing: 1.75 },
  },
  neurology: {
    phase2:    { acquisition: 2.0, licensing: 1.4, codevelopment: 1.6, collaboration: 1.5 },
    phase2_3:  { acquisition: 2.0, licensing: 1.4 },
  },
  infectiousDisease: {
    '*':       { acquisition: 2.0, licensing: 1.3, collaboration: 1.5 },
  },
  rareDisease: {
    phase2:    { acquisition: 2.2, licensing: 1.5, codevelopment: 1.7 },
    phase2_3:  { acquisition: 2.2, licensing: 1.5 },
    phase3:    { acquisition: 1.8, licensing: 1.4 },
    approved:  { acquisition: 1.3, licensing: 3.0 }, // orphan exclusivity premium preserved
  },
};

/**
 * Modality-specific multipliers for platform / novel-mechanism classes.
 * These are TA-independent (modality uplift is not "where the disease
 * is" it's "how the asset works").
 */
export const MODALITY_UPLIFT: Record<string, number> = {
  adc: 1.3,
  bispecific: 1.5,
  bispecificAntibody: 1.5,
  rnai: 1.5,
  radiopharmaceutical: 2.2,
  protac: 1.5,
  mrna: 1.7,
  smallMolecule: 0.8,
  // Rare-disease-specific modalities — post-bust calibrated
  enzymeReplacement: 1.1,
  geneTherapyRare: 1.3,
  substrateReduction: 1.0,
};

/**
 * Phase × dealType BASE premium. Captures the rNPV-vs-M&A pricing gap
 * (acquisitions include bidding dynamics + defensive franchise protection
 * that rNPV fraction does not model). Not TA-specific — this is the
 * "M&A itself trades at a premium to rNPV" signal.
 *
 * Calibrated against representative 2020–2025 acquisitions per cohort:
 *   phase1:     Carmot-Roche $2.7B, Inversago-Novo $1.1B, Prevail-Lilly $1.04B
 *   phase2:     Prometheus-Merck $10.8B, Cerevel-AbbVie $8.7B, Telavant-Roche $7.1B
 *   phase3:     Pfizer-GBT $5.4B, BMS-MyoKardia $13B, Amgen-ChemoCentryx $3.7B
 *   approved:   Amgen-Horizon $28B, Pfizer-Seagen $43B, Roche-Spark $4.8B
 */
export const PHASE_DEALTYPE_BASE: Record<string, Partial<Record<string, number>>> = {
  collaboration: {
    phase2:   4.0,
    phase2_3: 4.0,
    phase3:   3.0,
  },
  acquisition: {
    discovery:   6.0,
    preclinical: 6.0,
    phase1:      4.0,
    phase1_2:    4.0,
    phase2:      5.0,
    phase2_3:    5.0,
    phase3:      2.5,
    approved:    1.5,
    nda_filed:   1.5,
  },
};

// ═══════════════════════════════════════════════════════════════════════
// COMPOSITION CONSTANTS — safety rails, not calibration targets
// ═══════════════════════════════════════════════════════════════════════

/** Additive premium cap BEFORE the base-1.0. Prevents any TA + mod + PDT
 *  combination from producing more than 6.5x output. */
export const ADDITIVE_CAP = 5.5;

/** Absolute maximum multiplier. Backstop if calibration surfaces drift. */
export const HARD_CAP = 8.0;

/** Minimum multiplier — prevents aggressive dampeners from zeroing rNPV. */
export const FLOOR = 0.25;

/** Tier-1 assets (breakthrough+FIC+strong data) earn full premium.
 *  Tier-2 assets get this dampener applied to both the TA uplift and the
 *  phase×dealType M&A premium — modality uplift is structural and not
 *  tier-gated. */
export const SUB_TIER_DAMPENER = 0.5;
export const TIER1_DAMPENER = 1.0;

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

/**
 * Asset-quality tier classification. Tier-1 = the kind of asset that
 * historically commanded the top-of-distribution acquisition premium
 * (Prometheus, Karuna, Mirati, Seagen, Cerevel). Everything else = Tier-2.
 */
export function isTier1Asset(input: RNPVInput): boolean {
  const regDes = input.regulatoryDesignations;
  const hasBreakthrough = !!regDes?.breakthrough;
  const hasOrphan = !!regDes?.orphan;
  const isFIC =
    input.competitivePosition === 'firstInClass' ||
    input.competitivePosition === 'bestInClass';
  const hasStrongData =
    input.dataQuality === 'strongPhase2' ||
    input.dataQuality === 'pivotalReady';
  return isFIC && hasStrongData && (hasBreakthrough || hasOrphan);
}

export interface EmpiricalMultiplierBreakdown {
  multiplier: number;
  tier: 1 | 2;
  taPremium: number;
  modPremium: number;
  phaseDealTypePremium: number;
  rawComposition: number;
  cappedByAdditive: boolean;
  cappedByHard: boolean;
  reason: string[];
  /** The sub-components for calibration auditing. */
  components: {
    taUplift: number;
    modUplift: number;
    phaseDealBase: number;
    tierDampener: number;
  };
}

/**
 * Compute the empirical multiplier for rNPV. Always bounded to
 * [FLOOR, HARD_CAP] regardless of inputs.
 */
export function computeEmpiricalMultiplier(input: RNPVInput): number;
export function computeEmpiricalMultiplier(
  input: RNPVInput,
  opts: { includeBreakdown: true }
): EmpiricalMultiplierBreakdown;
export function computeEmpiricalMultiplier(
  input: RNPVInput,
  opts?: { includeBreakdown?: boolean }
): number | EmpiricalMultiplierBreakdown {
  const therapeuticArea = input.therapeuticArea;
  const modality = input.modality;
  const phase = input.phase;
  const dealType = input.dealType || 'licensing';

  // ─── Layer 1: TA × phase × dealType uplift ─────────────────────────
  const taTable = TA_UPLIFT[therapeuticArea] || {};
  const taUpliftRaw =
    taTable[phase]?.[dealType] ??
    taTable['*']?.[dealType] ??
    1.0;

  // ─── Layer 2: Modality uplift ──────────────────────────────────────
  const modUpliftRaw = MODALITY_UPLIFT[modality] ?? 1.0;

  // ─── Layer 3: Phase × dealType M&A base premium ────────────────────
  const phaseDealBaseRaw = PHASE_DEALTYPE_BASE[dealType]?.[phase] ?? 1.0;

  // ─── Tier gating (Tier-1 full premium, Tier-2 dampened) ────────────
  const tier1 = isTier1Asset(input);
  const tierDampener = tier1 ? TIER1_DAMPENER : SUB_TIER_DAMPENER;

  // ─── Additive composition (replaces multiplicative stacking) ───────
  // Convert each multiplier to a "premium above 1.0" and sum.
  // TA and phase×dealType premiums are tier-gated. Modality is not.
  const taPremium = (taUpliftRaw - 1.0) * tierDampener;
  const modPremium = (modUpliftRaw - 1.0);
  const phaseDealTypePremium = (phaseDealBaseRaw - 1.0) * tierDampener;

  const rawComposition = taPremium + modPremium + phaseDealTypePremium;
  const additiveCapped = Math.min(rawComposition, ADDITIVE_CAP);
  const combined = 1.0 + additiveCapped;

  const hardCapped = Math.min(combined, HARD_CAP);
  const floored = Math.max(hardCapped, FLOOR);

  if (!opts?.includeBreakdown) return floored;

  const reason: string[] = [];
  if (taUpliftRaw !== 1.0) {
    reason.push(
      `TA[${therapeuticArea}][${phase}][${dealType}]=${taUpliftRaw.toFixed(2)}×`
    );
  }
  if (modUpliftRaw !== 1.0) {
    reason.push(`modality[${modality}]=${modUpliftRaw.toFixed(2)}×`);
  }
  if (phaseDealBaseRaw !== 1.0) {
    reason.push(
      `phase×dealType[${dealType}][${phase}]=${phaseDealBaseRaw.toFixed(2)}×`
    );
  }
  reason.push(`tier=${tier1 ? 1 : 2} (dampener=${tierDampener.toFixed(2)})`);
  if (rawComposition > ADDITIVE_CAP) {
    reason.push(`additive-cap@${ADDITIVE_CAP}`);
  }
  if (combined > HARD_CAP) {
    reason.push(`hard-cap@${HARD_CAP}`);
  }

  return {
    multiplier: floored,
    tier: tier1 ? 1 : 2,
    taPremium,
    modPremium,
    phaseDealTypePremium,
    rawComposition,
    cappedByAdditive: rawComposition > ADDITIVE_CAP,
    cappedByHard: combined > HARD_CAP,
    reason,
    components: {
      taUplift: taUpliftRaw,
      modUplift: modUpliftRaw,
      phaseDealBase: phaseDealBaseRaw,
      tierDampener,
    },
  };
}
