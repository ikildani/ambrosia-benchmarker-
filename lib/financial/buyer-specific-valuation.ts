/**
 * Buyer-Specific Deal Valuation Engine
 *
 * Connects the Pharma Intent Score with the rNPV/Deal Waterfall to compute
 * what a SPECIFIC buyer would pay versus a generic buyer. The engine models
 * five independent premium factors — portfolio fit, deal urgency, patent cliff
 * pressure, pipeline gap desperation, and competitive deal pressure — weighted
 * and confidence-adjusted to produce an institutional-grade strategic premium.
 *
 * Premium is capped at +75% to prevent unrealistic valuations. Even the most
 * desperate buyer operating under patent-cliff pressure will not pay 2x fair
 * value in a competitive BD process.
 *
 * Sources: DealForma 2020-2025 strategic premium analysis, BioCentury deal
 * analytics, Nature Reviews Drug Discovery M&A premia studies.
 *
 * @module lib/financial/buyer-specific-valuation
 */

import type { DealWaterfall, RNPVResult } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Profile of a specific buyer, assembled from partner matching and pharma
 * intent scoring data. Each field maps to one or more premium factors.
 */
export interface BuyerProfile {
  /** Display name of the potential acquirer/licensee */
  companyName: string;
  /** Unique identifier (maps to companies table) */
  companyId: string;
  /** Portfolio fit score from partner matching engine (0-100) */
  matchScore: number;
  /** Acquisition/licensing intent score from Pharma Intent engine (0-100) */
  intentScore: number;
  /** Categorical intent tier derived from intentScore */
  intentTier: string;
  /** Expected deal timing bucket */
  timing: string;
  /** Model confidence in the intent prediction (0-1) */
  confidence: number;
  /** Number of deals closed by this buyer in the trailing 12 months */
  dealsLast12mo: number;
  /** Patent cliff revenue pressure score (0-100, from intent factors) */
  patentCliffPressure: number;
  /** Pipeline gap severity score (0-100, from intent factors) */
  pipelineGap: number;
  /** Deal velocity / activity level score (0-100, from intent factors) */
  dealVelocity: number;
  /** Competitive pressure from peer deal activity (0-100, from intent factors) */
  competitivePressure: number;
  /** Headquarters country (ISO 3166-1 alpha-2) */
  hqCountry?: string;
  /** Company classification (e.g., large_pharma, mid_biotech) */
  companyType?: string;
}

/**
 * A single factor contributing to the buyer-specific strategic premium.
 * Rendered as a horizontal bar in the premium breakdown UI.
 */
export interface PremiumFactor {
  /** Human-readable factor name */
  factor: string;
  /** Percentage-point contribution to total premium */
  contribution: number;
  /** Raw input score (0-100) */
  score: number;
  /** Weight applied to this factor */
  weight: number;
  /** Explanation of why this factor drives premium for this buyer */
  rationale: string;
}

/**
 * Complete buyer-specific valuation output, comparing a specific buyer's
 * willingness-to-pay against the generic deal waterfall.
 */
export interface BuyerSpecificValuation {
  /** The buyer profile used for this calculation */
  buyer: BuyerProfile;
  /** Generic deal value range from the waterfall (low/median/high, $M) */
  genericDealValue: { low: number; median: number; high: number };
  /** Buyer-specific deal value after strategic premium ($M) */
  buyerSpecificDealValue: { low: number; median: number; high: number };
  /** Total strategic premium multiplier (e.g., 1.49 = +49%) */
  strategicPremium: number;
  /** Premium expressed as a percentage (e.g., 49) */
  strategicPremiumPercent: number;
  /** Itemized breakdown of each premium factor's contribution */
  premiumBreakdown: PremiumFactor[];
  /** Buyer-specific upfront payment range ($M) */
  buyerUpfront: { low: number; median: number; high: number };
  /** Generic upfront payment range ($M) */
  genericUpfront: { low: number; median: number; high: number };
  /** Dollar difference between buyer-specific and generic upfront median ($M) */
  upfrontPremium: number;
  /** Narrative about timing urgency and deal window */
  timingAdvantage: string;
  /** Categorical assessment of negotiation leverage */
  negotiationLeverage: 'strong' | 'moderate' | 'limited';
  /** Full narrative explanation of the buyer-specific premium */
  narrative: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum strategic premium (cap at +75%) */
const MAX_PREMIUM = 0.75;

/** Factor weights — must sum to 1.0 */
const FACTOR_WEIGHTS = {
  portfolioFit: 0.30,
  dealUrgency: 0.25,
  patentCliff: 0.20,
  pipelineGap: 0.15,
  competitivePressure: 0.10,
} as const;

/** Timing multipliers applied after confidence adjustment */
const TIMING_MULTIPLIERS: Record<string, number> = {
  imminent: 1.3,
  near_term: 1.1,
  medium_term: 1.0,
  speculative: 0.7,
};

/** Urgency upfront boost: imminent buyers shift more value to upfront */
const URGENCY_UPFRONT_BOOST: Record<string, number> = {
  imminent: 0.10,
  near_term: 0.05,
  medium_term: 0.0,
  speculative: 0.0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number in $M or $B for narratives */
function fmtM(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value.toFixed(0)}M`;
}

/**
 * Extract a named factor score from the pharma intent factors array.
 * Returns 0 if the factor is not found.
 */
export function extractFactorScore(
  factors: Array<{ name: string; score: number }>,
  targetName: string,
): number {
  // Normalize both sides for fuzzy matching (lower-case, strip underscores/spaces)
  const normalize = (s: string) => s.toLowerCase().replace(/[_\s-]/g, '');
  const target = normalize(targetName);
  const match = factors.find(f => normalize(f.name).includes(target) || target.includes(normalize(f.name)));
  return match?.score ?? 0;
}

// ---------------------------------------------------------------------------
// Core Engine
// ---------------------------------------------------------------------------

/**
 * Calculate a buyer-specific deal valuation by applying a strategic premium
 * to the generic deal waterfall based on the buyer's intent profile.
 *
 * The premium is computed from 5 independent weighted factors:
 * 1. Portfolio Fit (30%) — how well the asset matches the buyer's strategy
 * 2. Deal Urgency (25%) — active deal-seeking behavior and intent signals
 * 3. Patent Cliff Pressure (20%) — revenue-at-risk driving acquisition urgency
 * 4. Pipeline Gap Desperation (15%) — absence of late-stage assets in the TA
 * 5. Competitive Deal Pressure (10%) — FOMO from peer deal activity
 *
 * Premium is confidence-adjusted (sparse data = halved premium) and timing-
 * modified (imminent = 1.3x, speculative = 0.7x), then capped at +75%.
 *
 * @param buyer            - Profile of the specific buyer
 * @param genericWaterfall - Deal waterfall computed from the generic rNPV model
 * @param rnpvResult       - The underlying rNPV calculation result
 * @returns BuyerSpecificValuation with premium breakdown and narrative
 */
export function calculateBuyerSpecificValuation(
  buyer: BuyerProfile,
  genericWaterfall: DealWaterfall,
  rnpvResult: RNPVResult,
): BuyerSpecificValuation {
  // ── 0. Clamp all input scores to valid [0, 100] range ──
  // Upstream sources (partner-matching, pharma-intent) should already clamp,
  // but we defend in depth here so a rogue >100 score can't blow the premium cap.
  const clamp100 = (n: number): number =>
    Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  const matchScore = clamp100(buyer.matchScore);
  const intentScore = clamp100(buyer.intentScore);
  const patentCliffPressure = clamp100(buyer.patentCliffPressure);
  const pipelineGap = clamp100(buyer.pipelineGap);
  const competitivePressure = clamp100(buyer.competitivePressure);

  // ── 1. Compute individual factor contributions ──

  const portfolioFitContribution = (matchScore / 100) * FACTOR_WEIGHTS.portfolioFit;
  const dealUrgencyContribution = (intentScore / 100) * FACTOR_WEIGHTS.dealUrgency;
  const patentCliffContribution = (patentCliffPressure / 100) * FACTOR_WEIGHTS.patentCliff;
  const pipelineGapContribution = (pipelineGap / 100) * FACTOR_WEIGHTS.pipelineGap;
  const competitivePressureContribution = (competitivePressure / 100) * FACTOR_WEIGHTS.competitivePressure;

  // ── 2. Build premium breakdown for transparency ──

  const premiumBreakdown: PremiumFactor[] = [
    {
      factor: 'Portfolio Fit',
      contribution: portfolioFitContribution * 100,
      score: matchScore,
      weight: FACTOR_WEIGHTS.portfolioFit,
      rationale: matchScore >= 80
        ? `${buyer.companyName}'s active modality and indication focus aligns strongly with this asset, making it a high-priority strategic fit.`
        : matchScore >= 50
          ? `Moderate portfolio alignment — ${buyer.companyName} has adjacent capabilities but this asset would extend their current focus.`
          : `Limited portfolio overlap — ${buyer.companyName} would need to build new capabilities around this asset.`,
    },
    {
      factor: 'Deal Urgency',
      contribution: dealUrgencyContribution * 100,
      score: intentScore,
      weight: FACTOR_WEIGHTS.dealUrgency,
      rationale: intentScore >= 70
        ? `High acquisition intent (${intentScore}/100) with ${buyer.dealsLast12mo} deals in the last 12 months signals active BD engagement and willingness to move quickly.`
        : intentScore >= 40
          ? `Moderate deal intent (${intentScore}/100) — ${buyer.companyName} is selectively pursuing assets but not under acute pressure.`
          : `Low deal intent (${intentScore}/100) — limited recent BD activity suggests a cautious acquisition stance.`,
    },
    {
      factor: 'Patent Cliff Pressure',
      contribution: patentCliffContribution * 100,
      score: patentCliffPressure,
      weight: FACTOR_WEIGHTS.patentCliff,
      rationale: patentCliffPressure >= 70
        ? `Significant revenue at risk from upcoming LOE events drives urgency to replenish the portfolio through in-licensing or acquisition.`
        : patentCliffPressure >= 40
          ? `Moderate patent cliff exposure — some revenue replacement needed but no acute crisis.`
          : `Minimal patent cliff pressure — current portfolio has healthy exclusivity runway.`,
    },
    {
      factor: 'Pipeline Gap',
      contribution: pipelineGapContribution * 100,
      score: pipelineGap,
      weight: FACTOR_WEIGHTS.pipelineGap,
      rationale: pipelineGap >= 70
        ? `${buyer.companyName} has a critical gap in late-stage pipeline assets for this therapeutic area, creating strong pull for external innovation.`
        : pipelineGap >= 40
          ? `Some pipeline coverage but gaps remain — external assets would complement internal programs.`
          : `Well-stocked internal pipeline reduces the urgency to in-license in this space.`,
    },
    {
      factor: 'Competitive Pressure',
      contribution: competitivePressureContribution * 100,
      score: competitivePressure,
      weight: FACTOR_WEIGHTS.competitivePressure,
      rationale: competitivePressure >= 70
        ? `Peer companies have recently signed deals in this space, creating competitive FOMO and upward pressure on valuations.`
        : competitivePressure >= 40
          ? `Moderate competitive deal activity in the space — some urgency but not acute.`
          : `Limited peer deal activity — no competitive FOMO driving premiums.`,
    },
  ];

  // Sort breakdown by contribution descending for display
  premiumBreakdown.sort((a, b) => b.contribution - a.contribution);

  // ── 3. Compute raw premium ──

  const rawPremium =
    portfolioFitContribution +
    dealUrgencyContribution +
    patentCliffContribution +
    pipelineGapContribution +
    competitivePressureContribution;

  // ── 4. Confidence adjustment ──
  // Low confidence (sparse data) = premium is halved. High confidence = full premium.
  // Clamp confidence to [0, 1] so an upstream model emitting >1 can't push the
  // multiplier above 1.0 (which would inflate the premium beyond raw contribution).
  const clampedConfidence = Number.isFinite(buyer.confidence)
    ? Math.max(0, Math.min(1, buyer.confidence))
    : 0;
  const confidenceAdjustedPremium = rawPremium * (0.5 + 0.5 * clampedConfidence);

  // ── 5. Timing modifier ──
  const timingMultiplier = TIMING_MULTIPLIERS[buyer.timing] ?? 1.0;
  const timingAdjustedPremium = confidenceAdjustedPremium * timingMultiplier;

  // ── 6. Cap at maximum premium ──
  const cappedPremium = Math.min(timingAdjustedPremium, MAX_PREMIUM);
  const strategicPremium = 1 + cappedPremium;
  const strategicPremiumPercent = cappedPremium * 100;

  // ── 7. Apply premium to deal values ──

  const genericDealValue = genericWaterfall.totalDealValue;
  const buyerSpecificDealValue = {
    low: genericDealValue.low * strategicPremium,
    median: genericDealValue.median * strategicPremium,
    high: genericDealValue.high * strategicPremium,
  };

  const genericUpfront = genericWaterfall.upfrontPayment;
  const urgencyBoost = URGENCY_UPFRONT_BOOST[buyer.timing] ?? 0;
  const upfrontMultiplier = strategicPremium * (1 + urgencyBoost);
  const buyerUpfront = {
    low: genericUpfront.low * upfrontMultiplier,
    median: genericUpfront.median * upfrontMultiplier,
    high: genericUpfront.high * upfrontMultiplier,
  };

  const upfrontPremium = buyerUpfront.median - genericUpfront.median;

  // ── 8. Negotiation leverage assessment ──

  let negotiationLeverage: 'strong' | 'moderate' | 'limited';
  if (strategicPremium >= 1.30) {
    negotiationLeverage = 'strong';
  } else if (strategicPremium >= 1.10) {
    negotiationLeverage = 'moderate';
  } else {
    negotiationLeverage = 'limited';
  }

  // ── 9. Timing advantage narrative ──

  const timingAdvantage = buildTimingAdvantage(buyer);

  // ── 10. Full narrative ──

  const narrative = buildNarrative(buyer, strategicPremiumPercent, premiumBreakdown, genericDealValue, buyerSpecificDealValue, negotiationLeverage);

  return {
    buyer,
    genericDealValue,
    buyerSpecificDealValue,
    strategicPremium,
    strategicPremiumPercent,
    premiumBreakdown,
    buyerUpfront,
    genericUpfront,
    upfrontPremium,
    timingAdvantage,
    negotiationLeverage,
    narrative,
  };
}

// ---------------------------------------------------------------------------
// Narrative Builders
// ---------------------------------------------------------------------------

/**
 * Build a timing advantage narrative based on the buyer's deal velocity
 * and intent timing signals.
 */
function buildTimingAdvantage(buyer: BuyerProfile): string {
  const timingLabel: Record<string, string> = {
    imminent: 'imminent deal timeline',
    near_term: 'near-term acquisition window',
    medium_term: 'medium-term BD planning cycle',
    speculative: 'longer-term strategic evaluation',
  };

  const dealContext = buyer.dealsLast12mo > 5
    ? `${buyer.dealsLast12mo} deals in the last 12 months`
    : buyer.dealsLast12mo > 0
      ? `${buyer.dealsLast12mo} deal${buyer.dealsLast12mo > 1 ? 's' : ''} in the last 12 months`
      : 'no recent deal activity';

  const timing = timingLabel[buyer.timing] ?? 'uncertain timeline';

  if (buyer.timing === 'imminent') {
    return `${buyer.companyName}'s ${timing} and ${dealContext} suggest a compressed negotiation window. Assets presented in the next 3-6 months have the strongest leverage position.`;
  }
  if (buyer.timing === 'near_term') {
    return `${buyer.companyName}'s ${timing} (${dealContext}) indicates active BD evaluation. Engaging within the next 6-12 months aligns with their acquisition cycle.`;
  }
  if (buyer.timing === 'medium_term') {
    return `${buyer.companyName} is in a ${timing} phase (${dealContext}). Building the relationship now positions the asset for consideration in the next 12-18 months.`;
  }
  return `${buyer.companyName} shows a ${timing} (${dealContext}). The deal window is not immediate — consider whether a catalytic event could accelerate their interest.`;
}

/**
 * Build a 2-3 sentence narrative explaining why this buyer would pay a
 * strategic premium, referencing the top contributing factors.
 */
function buildNarrative(
  buyer: BuyerProfile,
  premiumPct: number,
  breakdown: PremiumFactor[],
  genericDeal: { low: number; median: number; high: number },
  buyerDeal: { low: number; median: number; high: number },
  leverage: 'strong' | 'moderate' | 'limited',
): string {
  // Take top 2-3 factors
  const topFactors = breakdown.slice(0, 3);
  const factorNames = topFactors.map(f => f.factor.toLowerCase()).join(', ');

  const leverageText: Record<string, string> = {
    strong: 'strong negotiation leverage — the asset owner can push for premium terms',
    moderate: 'moderate negotiation leverage — balanced power dynamics favor a fair deal',
    limited: 'limited negotiation leverage — the buyer has alternatives and less urgency',
  };

  if (premiumPct < 5) {
    return `${buyer.companyName} would likely transact near generic market terms (${fmtM(genericDeal.median)}). Their profile does not indicate material strategic urgency in this space, resulting in ${leverageText[leverage]}.`;
  }

  const clampedConfidence = Number.isFinite(buyer.confidence)
    ? Math.max(0, Math.min(1, buyer.confidence))
    : 0;
  return `${buyer.companyName} would likely pay a +${premiumPct.toFixed(0)}% strategic premium (${fmtM(buyerDeal.median)} vs ${fmtM(genericDeal.median)} generic), driven primarily by ${factorNames}. This reflects ${leverageText[leverage]}. ${clampedConfidence >= 0.7 ? 'High model confidence reinforces this estimate.' : 'Note: lower data availability means the premium estimate carries wider uncertainty.'}`;
}

// ---------------------------------------------------------------------------
// Utility: Build BuyerProfile from partner match data
// ---------------------------------------------------------------------------

/**
 * Construct a BuyerProfile from the partner match data structure used in
 * the PartnerMatches component. Extracts intent factor scores by name.
 *
 * @param match - A partner match record from the partner matching API
 * @returns A fully populated BuyerProfile ready for valuation
 */
export function buildBuyerProfileFromMatch(match: {
  company_name: string;
  company_id: string;
  match_score: number;
  pharma_intent?: {
    intentScore: number;
    intentTier: string;
    timing: string;
    confidence: number;
    factors: Array<{ name: string; score: number; weight: number }>;
  } | null;
  deals_last_12mo?: number | null;
  hq_country?: string | null;
  company_type?: string | null;
}): BuyerProfile {
  const intent = match.pharma_intent;
  const factors = intent?.factors ?? [];

  // Defense-in-depth: clamp incoming scores to the documented [0, 100] range
  // and confidence to [0, 1]. Upstream services should already do this, but a
  // single out-of-range value here propagates directly into the premium cap.
  const clamp100 = (n: number): number =>
    Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  const clampConfidence = (n: number): number =>
    Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;

  return {
    companyName: match.company_name,
    companyId: match.company_id,
    matchScore: clamp100(match.match_score),
    intentScore: clamp100(intent?.intentScore ?? 0),
    intentTier: intent?.intentTier ?? 'minimal',
    timing: intent?.timing ?? 'speculative',
    confidence: clampConfidence(intent?.confidence ?? 0.3),
    dealsLast12mo: match.deals_last_12mo ?? 0,
    patentCliffPressure: clamp100(extractFactorScore(factors, 'patent_cliff')),
    pipelineGap: clamp100(extractFactorScore(factors, 'pipeline_gap')),
    dealVelocity: clamp100(extractFactorScore(factors, 'deal_velocity')),
    competitivePressure: clamp100(extractFactorScore(factors, 'competitive_pressure')),
    hqCountry: match.hq_country ?? undefined,
    companyType: match.company_type ?? undefined,
  };
}
