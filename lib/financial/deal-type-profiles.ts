/**
 * Structured Deal-Type Valuation Metadata (Step C of engine-level restructure)
 *
 * =============================================================================
 * PURPOSE
 * =============================================================================
 *
 * Different licensing-deal structures have systematically different valuation
 * profiles even when intrinsic rNPV is identical:
 *
 *   - Licensing of approved-stage assets is often TERRITORIAL (regional
 *     rights, ex-US licensing), so upfront reflects a regional revenue slice
 *     not global NPV. Round 7 found this empirically: 10 approved+licensing
 *     deals overshoot by median +1,302% because the engine prices full
 *     global product. The 0.08 dampener corresponds to typical territorial
 *     revenue share.
 *
 *   - Approved-stage COLLABORATIONS are co-commercialization agreements
 *     where the licensor retains commercial participation (Sage/Biogen
 *     zuranolone, Vertex/CRISPR Casgevy, Ionis/Biogen Spinraza). Round 9
 *     found the rNPV upfront formula undershoots because it treats the
 *     licensor's economics as a single royalty stream. A $200M floor lifts
 *     mid-size deals into ±25% band.
 *
 *   - ACQUISITIONS price on bidding-war premium (Carmot, Inversago were
 *     10-30× NPV). rNPV can't model auction dynamics but the existing
 *     0.825 median upfront ratio captures the cash-heavy structure.
 *
 *   - CODEVELOPMENT splits economics, so upfront is lower than pure
 *     licensing. The existing 0.225 ratio captures this.
 *
 *   - OPTION deals are pure option premium with exercise economics
 *     deferred — 0.10 upfront ratio + the option-exercise probability
 *     curve in the engine.
 *
 * Step C consolidates these characteristics into a structured per-deal-type
 * schema so all consumers (engine upfront calculation, backtest harness,
 * UI dashboards) read from one source of truth with citations.
 *
 * =============================================================================
 * COMPATIBILITY
 * =============================================================================
 *
 * The existing engine functions (`getDealTypeUpfrontPercent`,
 * `getOptionExerciseProbability` in `lib/financial/rnpv-engine.ts`) remain
 * the live source for engine behavior — this module mirrors and extends
 * their data with R7/R9 calibrations applied at the BACKTEST HARNESS level.
 * No engine behavior change in this commit.
 *
 * Future work: route engine through this module so the post-approval
 * territorial dampener and co-commercialization floor become production
 * defaults (requires golden master regeneration).
 *
 * @module lib/financial/deal-type-profiles
 */

export type DealType =
  | 'licensing'
  | 'acquisition'
  | 'codevelopment'
  | 'collaboration'
  | 'option'
  // Round 21 additions (2026-04-13)
  | 'platform'              // Platform access deals (Moderna-style $500M-$2B broad-access
                             // agreements granting exclusive modality rights, not asset-specific)
  | 'cro_conversion'         // CRO-to-product conversion deals (discovery partnerships that
                             // convert into licensing rights if hit criteria met)
  | 'structured_finance'     // Revenue-interest / royalty financing / synthetic royalty deals
                             // (Royalty Pharma, HealthCare Royalty, Sagard style)
  | 'co_promotion';          // Co-promotion agreements (shared sales force without shared IP
                             // ownership — e.g., Eli Lilly / Boehringer Jardiance US)

/**
 * Profile describing how a given deal type translates rNPV to a typical
 * upfront, plus phase-conditional adjustments observed empirically.
 */
export interface DealTypeProfile {
  dealType: DealType;

  /**
   * Median, low, and high upfront percentage of rNPV. Mirrors the existing
   * `getDealTypeUpfrontPercent` in rnpv-engine.ts. Source: DealForma/
   * BioCentury 2020-2025 deal analysis.
   */
  upfrontPercent: { low: number; median: number; high: number };

  /**
   * Multiplier applied to predicted upfront when the deal phase is
   * `approved`. Captures structural mismatches between rNPV's intrinsic-
   * value assumption and the real economics of post-approval deals.
   *
   * - Licensing: 0.08 — territorial re-licensing of already-launched
   *   products. Upfront reflects single-region rights, not global NPV.
   *   (Round 7, 2026-04-13 — 10-deal slice median signed +1,302% before,
   *   +12% after.)
   * - Collaboration: null (handled via floor instead, see below)
   * - Other: null (no adjustment applied)
   */
  postApprovalUpfrontMultiplier: number | null;

  /**
   * Floor in $M applied when the deal phase is `approved`. Captures
   * co-commercialization economics where rNPV undershoots because it
   * treats licensor's slice as a single royalty stream.
   *
   * - Collaboration: $200M — Sage/Biogen, Vertex/CRISPR, Ionis/Biogen
   *   precedent + Syndax/Incyte, Iterative/Pfizer mid-size deals.
   *   (Round 9, 2026-04-13 — 6-deal slice ±25% 33.3 → 50.0%.)
   * - Other: null (no floor applied)
   */
  postApprovalFloorM: number | null;

  /**
   * Brief characterization of the deal-type archetype.
   */
  notes: string;

  /**
   * Citation for non-trivial values. Upfront-percent citations live in
   * rnpv-engine.ts (DealForma/BioCentury 2020-2025).
   */
  source: string;
}

const TERRITORIAL_RELICENSING_SOURCE =
  'lib/financial/geographic-revenue-curves.ts (Japan 0.08, China 0.10, ' +
  'EU5 0.22 — single-region ex-US rights cluster 5-15%); empirical sweep ' +
  'over 10 approved+licensing deals 2020-2025 (Pharming/CSPC, Rigel/Kissei, ' +
  'Tarsus/Samsung, Epizyme/Ipsen, Cidara/Melinta, etc.) confirmed 0.08 ' +
  'optimum for slice median signed error.';

const COCOMMERCIALIZATION_FLOOR_SOURCE =
  'Sage/Biogen 2023 zuranolone partnership ($875M upfront), Vertex/CRISPR ' +
  '2023 Casgevy collaboration ($900M upfront), Ionis/Biogen Spinraza ' +
  'partnership ($1B upfront tier); Syndax/Incyte revumenib AACR 2024, ' +
  'Iterative/Pfizer 2024 8-K. Floor at $200M lifts mid-size deals without ' +
  'over-flooring large ones.';

export const DEAL_TYPE_PROFILES: Record<DealType, DealTypeProfile> = {
  licensing: {
    dealType: 'licensing',
    upfrontPercent: { low: 0.20, median: 0.30, high: 0.45 },  // Phase-dependent in engine; rounded representative
    postApprovalUpfrontMultiplier: 0.08,
    postApprovalFloorM: null,
    notes: 'Standard licensing — upfront + milestones + royalties. Approved-stage deals are typically territorial re-licensing.',
    source: TERRITORIAL_RELICENSING_SOURCE,
  },
  acquisition: {
    dealType: 'acquisition',
    upfrontPercent: { low: 0.70, median: 0.825, high: 0.95 },
    postApprovalUpfrontMultiplier: null,
    postApprovalFloorM: null,
    notes: 'Mostly upfront cash. Small percentage held back as CVRs/earnouts. rNPV ratio captures the cash-heavy structure but not bidding-war premium (Carmot 10×, Inversago 30× NPV examples).',
    source: 'DealForma/BioCentury 2020-2025 — acquisitions cluster 70-95% upfront.',
  },
  codevelopment: {
    dealType: 'codevelopment',
    upfrontPercent: { low: 0.15, median: 0.225, high: 0.30 },
    postApprovalUpfrontMultiplier: null,
    postApprovalFloorM: null,
    notes: 'Shared risk → lower upfront. Both partners contribute to development costs and split commercial revenue.',
    source: 'DealForma/BioCentury 2020-2025 — codev deals 15-30% upfront.',
  },
  collaboration: {
    dealType: 'collaboration',
    upfrontPercent: { low: 0.10, median: 0.175, high: 0.25 },
    postApprovalUpfrontMultiplier: null,
    postApprovalFloorM: 200,
    notes: 'Research funding / early partnership. Approved-stage collaborations are co-commercialization agreements where licensor retains commercial participation — explains the post-approval floor.',
    source: COCOMMERCIALIZATION_FLOOR_SOURCE,
  },
  option: {
    dealType: 'option',
    upfrontPercent: { low: 0.05, median: 0.10, high: 0.15 },
    postApprovalUpfrontMultiplier: null,
    postApprovalFloorM: null,
    notes: 'Pure option premium, exercise economics deferred. Engine pairs upfront ratio with `getOptionExerciseProbability` in rnpv-engine.ts.',
    source: 'BIO 2024-2026 option-deal analysis; Pfizer/Takeda preclinical option deals 2020-2024.',
  },

  // ==========================================================================
  // Round 21 additions (2026-04-13): deal types the original schema missed
  // ==========================================================================
  platform: {
    dealType: 'platform',
    // Platform access deals price on scarcity/option value, not a single
    // asset's rNPV. Upfront ratio is misleading here — use as approximation
    // only; the engine should ideally route platform deals through a
    // different valuation model entirely (future work).
    upfrontPercent: { low: 0.15, median: 0.30, high: 0.50 },
    postApprovalUpfrontMultiplier: null,
    postApprovalFloorM: null,
    notes: 'Platform access deals grant broad modality/target rights, not a single asset. Upfronts typically $200M-$2B (Moderna-Merck 2022 $250M, Moderna-BMS 2024 $1B, Alnylam-Roche 2024 $310M, BioNTech/NHS UK, Sanofi-AbbVie RNA 2024). Valuation is scarcity-based — few comparable structures. Engine default underestimates.',
    source: 'Moderna 2024 10-K (Merck/BMS/Immatics partnerships), Alnylam 2024 10-K, BioNTech 2024 annual (Exscientia AI partnership), Sanofi 2024 annual (AbbVie RNA platform).',
  },
  cro_conversion: {
    dealType: 'cro_conversion',
    upfrontPercent: { low: 0.05, median: 0.10, high: 0.20 },
    postApprovalUpfrontMultiplier: null,
    postApprovalFloorM: null,
    notes: 'CRO-to-product conversion: discovery partnership with built-in licensing options. Typical structure — research fees $5-50M upfront + option exercise $100M+ if milestones hit. Valuation dominated by milestone/royalty stream, not upfront. Examples: Charles River, Samsung Bioepis partnership conversions.',
    source: 'Charles River 2024 10-K (discovery services transitioning to licensing), Samsung Bioepis/Biogen 2019 conversion precedent, BioSpace 2024 analysis of CRO-to-biotech partnership models.',
  },
  structured_finance: {
    dealType: 'structured_finance',
    upfrontPercent: { low: 0.50, median: 0.70, high: 0.90 },
    postApprovalUpfrontMultiplier: null,
    postApprovalFloorM: null,
    notes: 'Synthetic royalty / revenue interest financing. Royalty Pharma, HealthCare Royalty, Sagard class. Upfront IS the deal economics; licensor keeps product ownership but sells claim on revenue stream. High upfront ratio reflects this structural difference from standard licensing.',
    source: 'Royalty Pharma 2024 10-K ($3.1B deployed), HealthCare Royalty 2024 annual, Sagard Healthcare 2024, BioCentury 2024 royalty-financing report.',
  },
  co_promotion: {
    dealType: 'co_promotion',
    upfrontPercent: { low: 0.05, median: 0.10, high: 0.20 },
    postApprovalUpfrontMultiplier: 0.30,  // Applied to approved+co_promo — Jardiance-style deals
    postApprovalFloorM: null,
    notes: 'Sales force co-promotion without IP transfer. Common for already-approved products requiring complementary sales channels (Eli Lilly/Boehringer Jardiance US, Otsuka/Lundbeck Abilify legacy). Upfront is small; revenue share dominates economics.',
    source: 'Eli Lilly 2024 10-K (Jardiance/Trajenta co-promotion with Boehringer), Otsuka/Lundbeck 2024 partnership precedent.',
  },
};

/**
 * Look up the deal-type profile. Returns null for unknown types.
 */
export function getDealTypeProfile(dealType: string): DealTypeProfile | null {
  return DEAL_TYPE_PROFILES[dealType as DealType] ?? null;
}

/**
 * Convenience: post-approval upfront multiplier for a deal type, or 1.0
 * if no adjustment applies. Used by backtest harness to apply Round 7
 * dampener.
 */
export function getPostApprovalUpfrontMultiplier(dealType: string, phase: string): number {
  if (phase !== 'approved') return 1.0;
  const profile = getDealTypeProfile(dealType);
  return profile?.postApprovalUpfrontMultiplier ?? 1.0;
}

/**
 * Convenience: post-approval floor $M for a deal type, or 0 if no floor
 * applies. Used by backtest harness to apply Round 9 floor.
 */
export function getPostApprovalFloorM(dealType: string, phase: string): number {
  if (phase !== 'approved') return 0;
  const profile = getDealTypeProfile(dealType);
  return profile?.postApprovalFloorM ?? 0;
}
