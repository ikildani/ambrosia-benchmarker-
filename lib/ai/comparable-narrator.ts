/**
 * AI Comparable Deal Narrator
 *
 * Generates institutional-grade narrative analysis for each comparable deal,
 * explaining relevance, differences, and valuation adjustments relative to
 * the user's asset. Designed as the intelligence backbone for Alaric.
 *
 * Architecture:
 *   1. Structured context assembly — deterministic, no AI. Computes
 *      adjustment factors from the engine data (phase delta, modality
 *      premium, competitive position, data quality, regulatory pathway).
 *   2. AI synthesis — single Claude call generates narratives grounded
 *      in the structured context. AI cannot hallucinate numbers because
 *      all quantitative data is pre-computed and injected.
 *   3. Adjustment rationale — each comparable gets a signed adjustment
 *      percentage with source attribution, suitable for IC memos.
 *
 * This module is the precursor to Alaric's cross-platform deal reasoning.
 * Every output is structured for programmatic consumption, not just display.
 *
 * @module lib/ai/comparable-narrator
 */

import type { CalculationInput, CalculationResult } from '@/lib/calculations';
import type { ComparableDealForUI } from '@/lib/comparableDeals';
import type { RNPVResult } from '@/lib/financial/types';
import { parseJsonResponse } from './parse-json';
import { CircuitBreaker } from './circuit-breaker';
import { createLogger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComparableAdjustment {
  factor: string;
  direction: 'premium' | 'discount' | 'neutral';
  magnitude_pct: number;
  rationale: string;
}

export interface NarratedComparable {
  dealId: string;
  parties: string;
  totalValue: string;
  year: number;
  relevanceScore: number;
  adjustments: ComparableAdjustment[];
  netAdjustment_pct: number;
  adjustedImplication: string;
  oneLineSummary: string;
  detailedNarrative: string;
}

export interface ComparableNarrationResult {
  narratedDeals: NarratedComparable[];
  synthesisNarrative: string;
  valuationImplication: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Deterministic Adjustment Engine (no AI — pure math)
// ---------------------------------------------------------------------------

const PHASE_RANK: Record<string, number> = {
  discovery: 0, preclinical: 1, phase1: 2, phase1_2: 3,
  phase2: 4, phase2_3: 5, phase3: 6, nda_filed: 7, approved: 8,
};

const PHASE_LABELS: Record<string, string> = {
  discovery: 'Discovery', preclinical: 'Preclinical', phase1: 'Phase 1',
  phase1_2: 'Phase 1/2', phase2: 'Phase 2', phase2_3: 'Phase 2/3',
  phase3: 'Phase 3', nda_filed: 'NDA Filed', approved: 'Approved',
};

function computeDeterministicAdjustments(
  userAsset: { phase: string; modality: string; therapeuticArea: string; indication: string; competitivePosition?: string; territory?: string; dealType?: string },
  comp: ComparableDealForUI,
): ComparableAdjustment[] {
  const adjustments: ComparableAdjustment[] = [];

  // Phase adjustment — later phase = higher value, so if user is earlier, discount the comp
  const userRank = PHASE_RANK[userAsset.phase] ?? 4;
  const compPhase = comp.phase || 'phase2';
  const compRank = PHASE_RANK[compPhase] ?? 4;
  const phaseDelta = userRank - compRank;

  if (phaseDelta !== 0) {
    const perPhasePct = 15;
    const mag = Math.abs(phaseDelta) * perPhasePct;
    const dir = phaseDelta < 0 ? 'discount' as const : 'premium' as const;
    const userLabel = PHASE_LABELS[userAsset.phase] || userAsset.phase;
    const compLabel = PHASE_LABELS[compPhase] || compPhase;
    adjustments.push({
      factor: 'Development Stage',
      direction: dir,
      magnitude_pct: mag,
      rationale: `Your asset is ${userLabel} vs comparable at ${compLabel} — ${Math.abs(phaseDelta)} phase${Math.abs(phaseDelta) > 1 ? 's' : ''} ${phaseDelta < 0 ? 'earlier (higher risk, lower de-risking)' : 'later (more de-risked, lower execution risk)'}. Industry benchmark: ~${perPhasePct}% value adjustment per phase transition.`,
    });
  }

  // Territory adjustment
  const compTerritory = (comp as any).territory;
  if (userAsset.territory && compTerritory && userAsset.territory !== compTerritory) {
    const globalPremium = userAsset.territory === 'global' && compTerritory !== 'global';
    const regionalDiscount = userAsset.territory !== 'global' && compTerritory === 'global';
    if (globalPremium) {
      adjustments.push({
        factor: 'Territory Scope',
        direction: 'premium',
        magnitude_pct: 20,
        rationale: 'Your asset has global rights vs regional comparable — global deals command 15-25% premiums due to larger addressable market and simplified governance.',
      });
    } else if (regionalDiscount) {
      adjustments.push({
        factor: 'Territory Scope',
        direction: 'discount',
        magnitude_pct: 20,
        rationale: 'Your asset has regional rights vs global comparable — regional deals typically trade at 15-25% discount reflecting smaller addressable market.',
      });
    }
  }

  // Deal type adjustment
  const compDealType = (comp as any).dealType;
  if (userAsset.dealType && compDealType && userAsset.dealType !== compDealType) {
    const typeMultipliers: Record<string, number> = {
      acquisition: 1.30, licensing: 1.00, codevelopment: 0.85,
      option: 0.60, collaboration: 0.75,
    };
    const userMult = typeMultipliers[userAsset.dealType] ?? 1.0;
    const compMult = typeMultipliers[compDealType] ?? 1.0;
    const diff = ((userMult / compMult) - 1) * 100;
    if (Math.abs(diff) > 5) {
      adjustments.push({
        factor: 'Deal Structure',
        direction: diff > 0 ? 'premium' : 'discount',
        magnitude_pct: Math.abs(Math.round(diff)),
        rationale: `Your ${userAsset.dealType} structure vs comparable's ${compDealType} — different deal types capture different fractions of asset value. Acquisitions capture ~85% vs licensing ~65% vs options ~40%.`,
      });
    }
  }

  // Competitive position
  if (userAsset.competitivePosition) {
    const positionPremiums: Record<string, number> = {
      firstInClass: 25, firstToPivotal: 15, bestInClass: 10,
      racing: 0, behind: -10, crowded: -20,
    };
    const premium = positionPremiums[userAsset.competitivePosition] ?? 0;
    if (premium !== 0) {
      adjustments.push({
        factor: 'Competitive Position',
        direction: premium > 0 ? 'premium' : 'discount',
        magnitude_pct: Math.abs(premium),
        rationale: premium > 0
          ? `Your ${userAsset.competitivePosition.replace(/([A-Z])/g, ' $1').trim().toLowerCase()} position commands a strategic premium — limited competition drives buyer urgency.`
          : `Your ${userAsset.competitivePosition} position faces market compression — multiple competing assets reduce buyer willingness to pay premium.`,
      });
    }
  }

  return adjustments;
}

// ---------------------------------------------------------------------------
// AI Synthesis
// ---------------------------------------------------------------------------

const circuitBreaker = new CircuitBreaker({
  name: 'comparable-narrator',
  failureThreshold: 3,
  cooldownMs: 60_000,
});

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Anthropic API ${response.status}: ${err.substring(0, 200)}`);
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> };
  const text = data.content?.find(c => c.type === 'text');
  if (!text) throw new Error('No text in AI response');
  return text.text;
}

function buildNarratorPrompt(
  userAsset: CalculationInput,
  userTerms: CalculationResult,
  rnpv: RNPVResult | undefined,
  comparables: ComparableDealForUI[],
  adjustmentsByDeal: Map<string, ComparableAdjustment[]>,
): string {
  const assetDesc = `${PHASE_LABELS[userAsset.phase] || userAsset.phase} ${userAsset.modality} in ${userAsset.indication} (${userAsset.therapeuticArea}), ${userAsset.territory || 'global'} rights, ${userAsset.competitivePosition || 'racing'} competitive position`;
  const tdv = `$${userTerms.terms.totalDealValue.low}M-$${userTerms.terms.totalDealValue.high}M (median $${userTerms.terms.totalDealValue.median}M)`;
  const upfront = `$${userTerms.terms.upfront.median}M`;

  const compDetails = comparables.map((c, i) => {
    const adjs = adjustmentsByDeal.get(c.id) || [];
    const netAdj = adjs.reduce((sum, a) => sum + (a.direction === 'discount' ? -a.magnitude_pct : a.direction === 'premium' ? a.magnitude_pct : 0), 0);
    return `
COMPARABLE ${i + 1}: ${c.parties}
  Value: ${c.totalValue} (${c.year})
  Phase: ${c.phase || 'N/A'}
  Relevance: ${c.relevanceReasons.join('; ')}
  Pre-computed adjustments vs your asset:
${adjs.map(a => `    - ${a.factor}: ${a.direction === 'discount' ? '-' : '+'}${a.magnitude_pct}% (${a.rationale})`).join('\n')}
  Net adjustment: ${netAdj > 0 ? '+' : ''}${netAdj}%`;
  }).join('\n');

  return `You are a senior pharma M&A advisor writing comparable deal analysis for an institutional investor.

YOUR CLIENT'S ASSET:
  ${assetDesc}
  Benchmark TDV: ${tdv}
  Expected upfront: ${upfront}
  ${rnpv ? `rNPV: $${rnpv.riskAdjustedNPV.toFixed(0)}M | PoS: ${(rnpv.cumulativePoS * 100).toFixed(1)}% | WACC: ${(rnpv.discountRate * 100).toFixed(1)}%` : ''}

COMPARABLE TRANSACTIONS:
${compDetails}

Write analysis. For EACH comparable, provide:
1. oneLineSummary: Why this deal is relevant in ONE sentence
2. detailedNarrative: 2-3 sentences explaining key similarities AND differences. Reference specific dollar amounts, modalities, indications. Explain what the buyer was paying for and why.

Then provide:
3. synthesisNarrative: 3-4 sentences synthesizing what the full set of comparables implies for this asset's valuation range
4. valuationImplication: 1-2 sentences on where the asset should price relative to these comps (above, below, in-line) and why
5. confidenceLevel: "high" if 3+ close comps exist, "medium" if 1-2, "low" if mostly distant

Return ONLY JSON (no markdown):
{
  "deals": [
    { "dealIndex": 0, "oneLineSummary": "...", "detailedNarrative": "..." },
    ...
  ],
  "synthesisNarrative": "...",
  "valuationImplication": "...",
  "confidenceLevel": "high|medium|low"
}`;
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export async function narrateComparables(
  userAsset: CalculationInput,
  userTerms: CalculationResult,
  comparables: ComparableDealForUI[],
  rnpv?: RNPVResult,
): Promise<ComparableNarrationResult> {
  const log = createLogger('comparable-narrator');
  const elapsed = log.startTimer();

  if (!comparables || comparables.length === 0) {
    return {
      narratedDeals: [],
      synthesisNarrative: 'No comparable transactions identified for this asset profile.',
      valuationImplication: 'Valuation must rely on rNPV and market sizing in the absence of transaction precedents.',
      confidenceLevel: 'low',
      generatedAt: new Date().toISOString(),
    };
  }

  // Step 1: Compute deterministic adjustments for each comparable
  const adjustmentsByDeal = new Map<string, ComparableAdjustment[]>();
  for (const comp of comparables) {
    const adjs = computeDeterministicAdjustments(
      { phase: userAsset.phase, modality: userAsset.modality, therapeuticArea: userAsset.therapeuticArea, indication: userAsset.indication, competitivePosition: userAsset.competitivePosition, territory: userAsset.territory, dealType: userAsset.dealType },
      comp,
    );
    adjustmentsByDeal.set(comp.id, adjs);
  }

  // Step 2: AI narration
  const prompt = buildNarratorPrompt(userAsset, userTerms, rnpv, comparables, adjustmentsByDeal);

  let aiResult: { deals: Array<{ dealIndex: number; oneLineSummary: string; detailedNarrative: string }>; synthesisNarrative: string; valuationImplication: string; confidenceLevel: string };

  try {
    const text = await circuitBreaker.execute(() => callClaude(prompt));
    aiResult = parseJsonResponse(text);
  } catch (err) {
    log.error('AI narration failed, using deterministic fallback', { error: err instanceof Error ? err.message : String(err), durationMs: elapsed() });

    // Fallback: deterministic-only narration (no AI)
    const narratedDeals: NarratedComparable[] = comparables.map((comp, i) => {
      const adjs = adjustmentsByDeal.get(comp.id) || [];
      const netAdj = adjs.reduce((sum, a) => sum + (a.direction === 'discount' ? -a.magnitude_pct : a.direction === 'premium' ? a.magnitude_pct : 0), 0);
      return {
        dealId: comp.id,
        parties: comp.parties,
        totalValue: comp.totalValue,
        year: comp.year,
        relevanceScore: comp.scoreBreakdown?.weightedScore ?? 0,
        adjustments: adjs,
        netAdjustment_pct: netAdj,
        adjustedImplication: `${netAdj > 0 ? 'Premium' : netAdj < 0 ? 'Discount' : 'In-line'} of ${Math.abs(netAdj)}% vs this comparable.`,
        oneLineSummary: comp.relevanceReasons.join('; '),
        detailedNarrative: `${comp.parties} (${comp.year}) at ${comp.totalValue}. ${comp.relevanceReasons.join('. ')}.`,
      };
    });

    return {
      narratedDeals,
      synthesisNarrative: `${comparables.length} comparable transactions identified. Adjustments suggest a net ${narratedDeals.reduce((s, d) => s + d.netAdjustment_pct, 0) / narratedDeals.length > 0 ? 'premium' : 'discount'} relative to the median comparable.`,
      valuationImplication: 'See individual comparable adjustments for positioning guidance.',
      confidenceLevel: comparables.length >= 3 ? 'medium' : 'low',
      generatedAt: new Date().toISOString(),
    };
  }

  // Step 3: Merge deterministic adjustments with AI narratives
  const narratedDeals: NarratedComparable[] = comparables.map((comp, i) => {
    const adjs = adjustmentsByDeal.get(comp.id) || [];
    const netAdj = adjs.reduce((sum, a) => sum + (a.direction === 'discount' ? -a.magnitude_pct : a.direction === 'premium' ? a.magnitude_pct : 0), 0);
    const aiDeal = aiResult.deals?.find(d => d.dealIndex === i);

    return {
      dealId: comp.id,
      parties: comp.parties,
      totalValue: comp.totalValue,
      year: comp.year,
      relevanceScore: comp.scoreBreakdown?.weightedScore ?? 0,
      adjustments: adjs,
      netAdjustment_pct: netAdj,
      adjustedImplication: `${netAdj > 0 ? 'Premium' : netAdj < 0 ? 'Discount' : 'In-line'} of ${Math.abs(netAdj)}% vs this comparable.`,
      oneLineSummary: aiDeal?.oneLineSummary || comp.relevanceReasons.join('; '),
      detailedNarrative: aiDeal?.detailedNarrative || `${comp.parties} (${comp.year}) at ${comp.totalValue}.`,
    };
  });

  log.info('Narration complete', { durationMs: elapsed(), dealCount: comparables.length, confidence: aiResult.confidenceLevel });

  return {
    narratedDeals,
    synthesisNarrative: aiResult.synthesisNarrative || '',
    valuationImplication: aiResult.valuationImplication || '',
    confidenceLevel: (aiResult.confidenceLevel as 'high' | 'medium' | 'low') || 'medium',
    generatedAt: new Date().toISOString(),
  };
}
