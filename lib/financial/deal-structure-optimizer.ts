/**
 * Deal Structure Optimizer (Item 8 — Tier 3 Engine Grade A+)
 *
 * Given an `RNPVInput`, runs all 5 deal types through the rNPV engine and
 * ranks them by total value to licensor. Surfaces a recommendation **only**
 * when the top alternative beats the user's selection by ≥20%.
 *
 * Critically: this **does not** auto-apply the recommendation. The UI
 * surfaces it as a suggestion with a CTA to apply manually. Auto-applying
 * would be coercive and the optimizer is one input among many.
 *
 * # Performance
 *
 * The optimizer runs `calculateRNPV` 5 times (one per deal type). It
 * deliberately skips Monte Carlo and ensemble re-blending for the 4
 * counterfactual deal types — those engines depend on PoS / discount rate /
 * peak sales, none of which change with `dealType`. The deal-type signal
 * lives entirely in `rnpv.impliedDealValue.totalDeal.median`, which already
 * captures upfront ratios, milestone allocation, and royalty structures via
 * the existing `DEAL_TYPE_CAPTURE` and `PHASE_ALLOCATION` tables in
 * `institutional-upgrades.ts`.
 *
 * Total cost: 5 × ~30ms ≈ 150ms vs. ~1.5s for the full pipeline. Acceptable
 * for a click-time computation in the results page.
 *
 * # Why we don't use the full ensemble for ranking
 *
 * The plan called for ensemble values for fair comparison, but in practice
 * the comparable transactions and real options methods produce **identical**
 * values across deal types (they don't read `dealType`). The only signal
 * differentiation is in rNPV's implied deal value, so blending it with two
 * deal-type-blind methods would dilute the signal. Documented here so a
 * future maintainer doesn't try to "fix" this.
 *
 * @module lib/financial/deal-structure-optimizer
 */

import type {
  RNPVInput,
  RNPVResult,
  DealOptimizerResult,
  DealStructureOption,
  LicensorPreferenceProfile,
} from './types';
import { calculateRNPV } from './rnpv-engine';
import type { DealType } from '@/lib/calculations';

const ALL_DEAL_TYPES: DealType[] = [
  'licensing',
  'acquisition',
  'codevelopment',
  'option',
  'collaboration',
];

// ---------------------------------------------------------------------------
// Licensor preference profiles
// ---------------------------------------------------------------------------

/**
 * Default preference profiles by company type.
 *
 * These weights control how the optimizer breaks ties when two deal types
 * produce similar headline values. They are starting points calibrated against
 * BD industry intuition — refine via Tier 4 follow-up cron later.
 *
 * Sources:
 *   - Small biotechs (cash runway < 18mo) historically prefer acquisitions or
 *     high-upfront licenses (cash now > upside).
 *   - Large biotechs with multiple programs and ample runway can afford to
 *     wait for option triggers and milestone payouts (upside > cash now).
 *   - Academic spinouts typically prefer cash but value retained involvement
 *     (collaborations + codev rank slightly higher than pure license).
 */
const DEFAULT_PROFILES: Record<string, LicensorPreferenceProfile> = {
  largePharma: { cashNowWeight: 0.2, riskAversionWeight: 0.2 },
  midPharma: { cashNowWeight: 0.3, riskAversionWeight: 0.3 },
  biotech: { cashNowWeight: 0.4, riskAversionWeight: 0.4 },
  clinicalStageBiotech: { cashNowWeight: 0.7, riskAversionWeight: 0.6 },
  academic: { cashNowWeight: 0.6, riskAversionWeight: 0.5 },
  // Fallback when companyType is missing or unrecognized
  default: { cashNowWeight: 0.4, riskAversionWeight: 0.4 },
};

function resolveProfile(
  rnpvInput: RNPVInput,
  override?: LicensorPreferenceProfile,
): LicensorPreferenceProfile {
  if (override) return override;
  const companyType = rnpvInput.companyType ?? 'default';
  return DEFAULT_PROFILES[companyType] ?? DEFAULT_PROFILES.default;
}

// ---------------------------------------------------------------------------
// Per-deal-type counterfactual
// ---------------------------------------------------------------------------

interface DealTypeProjection {
  dealType: DealType;
  rnpvResult: RNPVResult;
  upfrontMedian: number;
  totalDealMedian: number;
}

/**
 * Re-run the rNPV engine with a swapped `dealType`. The rest of the input
 * is unchanged. Returns the implied deal value for that structure.
 */
function projectForDealType(input: RNPVInput, dealType: DealType): DealTypeProjection {
  const swapped: RNPVInput = { ...input, dealType };
  const result = calculateRNPV(swapped);
  return {
    dealType,
    rnpvResult: result,
    upfrontMedian: result.impliedDealValue?.upfront?.median ?? 0,
    totalDealMedian: result.impliedDealValue?.totalDeal?.median ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Preference scoring
// ---------------------------------------------------------------------------

/**
 * Apply licensor preferences as a multiplicative score modifier on top of
 * the headline `totalDealMedian`. Two preference axes:
 *
 *   1. **cashNowWeight** rewards deal types with a higher upfront/total ratio.
 *      A licensor that needs cash now will accept slightly less total value
 *      in exchange for a fatter upfront.
 *
 *   2. **riskAversionWeight** penalizes structures whose upside is back-loaded
 *      (option exercise fees, milestone-heavy collaborations). Risk-averse
 *      licensors discount future contingent payments more aggressively.
 *
 * The score is bounded — preferences cannot more than double or halve the
 * raw value. This prevents preference weights from drowning the underlying
 * signal.
 */
function preferenceScore(
  projection: DealTypeProjection,
  baseRatio: number,
  profile: LicensorPreferenceProfile,
): number {
  const { totalDealMedian, upfrontMedian, dealType } = projection;
  if (totalDealMedian <= 0) return 0;

  const upfrontRatio = upfrontMedian / totalDealMedian;
  // Cash-now bonus: positive when this deal type has more upfront than the average
  const cashNowDelta = upfrontRatio - baseRatio;
  const cashBonus = profile.cashNowWeight * cashNowDelta;

  // Risk-aversion penalty: option deals carry exercise risk, collaborations
  // depend on FTE-funded research milestones. Apply small penalty to those.
  const RISK_PENALTY: Record<DealType, number> = {
    licensing: 0.0,
    acquisition: -0.1, // Acquisition is risk-AVERSE friendly (no contingencies after close)
    codevelopment: 0.05,
    option: 0.15,
    collaboration: 0.10,
  };
  const riskPenalty = profile.riskAversionWeight * RISK_PENALTY[dealType];

  // Multiplicative modifier, bounded to [0.5, 2.0]
  const modifier = Math.max(0.5, Math.min(2.0, 1 + cashBonus - riskPenalty));
  return totalDealMedian * modifier;
}

// ---------------------------------------------------------------------------
// Rationale builders
// ---------------------------------------------------------------------------

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  licensing: 'Licensing',
  acquisition: 'Acquisition (M&A)',
  codevelopment: 'Co-development',
  option: 'Option / License',
  collaboration: 'Research Collaboration',
};

function buildRationale(
  projection: DealTypeProjection,
  profile: LicensorPreferenceProfile,
  pctVsBaseline: number,
  rank: number,
): string {
  const { dealType, upfrontMedian, totalDealMedian } = projection;
  const upfrontRatio = totalDealMedian > 0 ? upfrontMedian / totalDealMedian : 0;
  const upfrontPct = Math.round(upfrontRatio * 100);
  const totalStr = formatM(totalDealMedian);
  const upfrontStr = formatM(upfrontMedian);

  if (rank === 1) {
    return `Top-ranked: ${DEAL_TYPE_LABELS[dealType]} delivers $${totalStr} total deal value with $${upfrontStr} upfront (${upfrontPct}% upfront ratio). Best fit for the licensor's risk and cash preferences.`;
  }
  if (pctVsBaseline > 0.20) {
    return `${DEAL_TYPE_LABELS[dealType]}: $${totalStr} total (${upfrontPct}% upfront) — ${(pctVsBaseline * 100).toFixed(0)}% better than your selection.`;
  }
  if (pctVsBaseline < -0.20) {
    return `${DEAL_TYPE_LABELS[dealType]}: $${totalStr} total — ${Math.abs(pctVsBaseline * 100).toFixed(0)}% lower than your selection.`;
  }
  return `${DEAL_TYPE_LABELS[dealType]}: $${totalStr} total — comparable to your selection (within 20%).`;
}

function buildRecommendation(
  topAlt: DealStructureOption,
  userSelected: DealStructureOption,
  rnpvInput: RNPVInput,
): string {
  const pct = Math.round(topAlt.pctVsBaseline * 100);
  const altLabel = DEAL_TYPE_LABELS[topAlt.dealType];
  const userLabel = DEAL_TYPE_LABELS[userSelected.dealType];
  const taLabel = rnpvInput.therapeuticArea;
  const phaseLabel = rnpvInput.phase;

  return `Your asset would be worth ${pct}% more as a ${altLabel} ($${formatM(topAlt.dealValue)}) than as ${userLabel} ($${formatM(userSelected.dealValue)}). Based on ${phaseLabel} ${taLabel} benchmarks and your licensor profile, this structure better matches the asset's stage and the typical buyer behavior in this space.`;
}

function formatM(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}B`;
  return `${Math.round(value)}M`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Rank all 5 deal structures and surface a recommendation when a meaningful
 * alternative exists.
 *
 * @param rnpvInput     - The user's RNPVInput (with their currently selected dealType)
 * @param preferences   - Optional explicit preference profile; otherwise inferred from companyType
 * @returns DealOptimizerResult with rankings, top alternative, and recommendation copy
 */
export function optimizeDealStructure(
  rnpvInput: RNPVInput,
  preferences?: LicensorPreferenceProfile,
): DealOptimizerResult {
  const userSelectedDealType = (rnpvInput.dealType ?? 'licensing') as DealType;
  const profile = resolveProfile(rnpvInput, preferences);

  // ── 1. Project all 5 deal types ──
  const projections = ALL_DEAL_TYPES.map(dt => projectForDealType(rnpvInput, dt));

  // ── 2. Compute base upfront ratio (average across all 5) ──
  const upfrontRatios = projections
    .filter(p => p.totalDealMedian > 0)
    .map(p => p.upfrontMedian / p.totalDealMedian);
  const baseRatio =
    upfrontRatios.length > 0
      ? upfrontRatios.reduce((a, b) => a + b, 0) / upfrontRatios.length
      : 0.2;

  // ── 3. Score each projection ──
  const scored = projections.map(p => ({
    projection: p,
    score: preferenceScore(p, baseRatio, profile),
  }));

  // ── 4. Find user-selected baseline value (raw, not preference-adjusted) ──
  const userBaseline = projections.find(p => p.dealType === userSelectedDealType);
  const userValue = userBaseline?.totalDealMedian ?? 0;

  // ── 5. Sort by preference-adjusted score, descending ──
  scored.sort((a, b) => b.score - a.score);

  // ── 6. Build the rankings list ──
  const rankings: DealStructureOption[] = scored.map((s, i) => {
    const pctVsBaseline =
      userValue > 0 ? (s.projection.totalDealMedian - userValue) / userValue : 0;
    return {
      dealType: s.projection.dealType,
      dealValue: s.projection.totalDealMedian,
      upfrontMedian: s.projection.upfrontMedian,
      totalDealMedian: s.projection.totalDealMedian,
      preferenceAdjustedScore: s.score,
      pctVsBaseline,
      rank: i + 1,
      rationale: '', // filled in next pass
    };
  });

  // Now that ranks are known, fill in rationales
  for (const row of rankings) {
    const projection = projections.find(p => p.dealType === row.dealType)!;
    row.rationale = buildRationale(projection, profile, row.pctVsBaseline, row.rank);
  }

  // ── 7. Determine top alternative ──
  const topRow = rankings[0];
  const userRow = rankings.find(r => r.dealType === userSelectedDealType)!;
  let topAlternative: DealStructureOption | null = null;
  let recommendationStrength: 'strong' | 'moderate' | 'weak' | 'none' = 'none';
  let recommendation: string | null = null;

  if (topRow.dealType !== userSelectedDealType) {
    const delta = topRow.pctVsBaseline;
    if (delta >= 0.40) {
      recommendationStrength = 'strong';
      topAlternative = topRow;
      recommendation = buildRecommendation(topRow, userRow, rnpvInput);
    } else if (delta >= 0.20) {
      recommendationStrength = 'moderate';
      topAlternative = topRow;
      recommendation = buildRecommendation(topRow, userRow, rnpvInput);
    } else if (delta > 0) {
      recommendationStrength = 'weak';
      // Don't surface — too marginal
    }
  }

  return {
    userSelectedDealType,
    userSelectedDealValue: userValue,
    rankings,
    topAlternative,
    recommendationStrength,
    recommendation,
    preferenceProfile: profile,
  };
}

// ---------------------------------------------------------------------------
// Internal exports for testing
// ---------------------------------------------------------------------------

/** @internal exposed only for unit tests */
export const __test = {
  ALL_DEAL_TYPES,
  DEFAULT_PROFILES,
  resolveProfile,
  projectForDealType,
  preferenceScore,
};
