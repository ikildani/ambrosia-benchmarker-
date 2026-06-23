/**
 * Trade Space API — interactive deal structure optimization.
 *
 * POST /api/trade-space
 *
 * Accepts an asset profile and runs all 5 deal structures through the
 * optimizer. Returns ranked deal types with recommendation copy.
 * Optionally fetches buyer-specific counterparty premiums.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';
import { optimizeDealStructure } from '@/lib/financial/deal-structure-optimizer';
import { createServiceClient } from '@/lib/supabase/server';
import type { RNPVInput } from '@/lib/financial/types';
import type { TherapeuticArea, Phase, Modality } from '@/lib/calculations';

interface TradeSpaceRequestBody {
  therapeuticArea: TherapeuticArea;
  phase: Phase;
  modality: Modality;
  indication?: string;
  peakSalesLow: number;
  peakSalesMedian: number;
  peakSalesHigh: number;
  competitivePosition: string;
  companyType: string;
  buyerName?: string;
}

export async function POST(request: NextRequest) {
  // Auth gate
  const [, errorResponse] = await requireAuth(request);
  if (errorResponse) return errorResponse;

  let body: TradeSpaceRequestBody;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  // Validate required fields
  const {
    therapeuticArea,
    phase,
    modality,
    indication,
    peakSalesLow,
    peakSalesMedian,
    peakSalesHigh,
    competitivePosition,
    companyType,
    buyerName,
  } = body;

  if (!therapeuticArea || !phase || !modality || !peakSalesMedian) {
    return apiError('Missing required fields: therapeuticArea, phase, modality, peakSalesMedian', 400);
  }

  // Build rNPV input
  const rnpvInput: RNPVInput = {
    therapeuticArea,
    phase,
    modality,
    indication: indication || 'lung_nsclc',
    territory: 'global',
    dealType: 'licensing',
    peakSalesEstimate: {
      low: peakSalesLow || peakSalesMedian * 0.5,
      median: peakSalesMedian,
      high: peakSalesHigh || peakSalesMedian * 2,
    },
    competitivePosition: competitivePosition || 'racing',
    dataQuality: 'strongPhase2',
    biomarkerStatus: 'unselected',
    regulatoryDesignations: {
      breakthrough: false,
      fastTrack: false,
      orphan: false,
      prime: false,
    },
    companyType: companyType || 'biotech',
  };

  // Run the optimizer
  let result;
  try {
    result = optimizeDealStructure(rnpvInput);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Deal structure optimization failed';
    return apiError(message, 500);
  }

  // Optionally fetch buyer-specific premium
  let buyerPremium: { name: string; premium: number } | null = null;
  if (buyerName) {
    const supabase = createServiceClient();
    const { data: premiumRows } = await supabase
      .from('counterparty_premiums')
      .select('company_name, premium_multiplier')
      .eq('company_name', buyerName)
      .limit(1);

    if (premiumRows && premiumRows.length > 0) {
      buyerPremium = {
        name: premiumRows[0].company_name,
        premium: Number(premiumRows[0].premium_multiplier),
      };
    }
  }

  return apiSuccess({
    rankings: result.rankings.map((r) => ({
      dealType: r.dealType,
      upfrontMedian: Math.round(r.upfrontMedian),
      totalDealMedian: Math.round(r.totalDealMedian),
      pctVsBaseline: r.pctVsBaseline,
      rank: r.rank,
      rationale: r.rationale,
    })),
    recommendation: result.recommendation,
    recommendationStrength: result.recommendationStrength,
    buyerPremium,
  });
}
