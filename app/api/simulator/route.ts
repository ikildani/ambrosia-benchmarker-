/**
 * Negotiation Simulator API — interactive ZOPA computation.
 *
 * POST /api/simulator
 *
 * Accepts an asset profile + 1-3 buyer names + licensor BATNA.
 * Runs calculateRNPV() once for the shared base valuation, then
 * fetches each buyer's historical premium from the counterparty_premiums
 * table to compute per-buyer ZOPA bands.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import { createServiceClient } from '@/lib/supabase/server';
import type { RNPVInput } from '@/lib/financial/types';
import type { TherapeuticArea, Phase, Modality } from '@/lib/calculations';

interface SimulatorRequestBody {
  therapeuticArea: TherapeuticArea;
  indication: string;
  modality: Modality;
  phase: Phase;
  peakSalesLow: number;
  peakSalesMedian: number;
  peakSalesHigh: number;
  competitivePosition: string;
  companyType: string;
  buyers: string[];
  batnaUpfrontM: number;
}

interface BuyerZOPA {
  name: string;
  premium: number;
  floorUpfront: number;
  buyerTopUpfront: number;
  zopaWidth: number;
  recommendedOpening: number;
  recommendedFallback: number;
}

export async function POST(request: NextRequest) {
  // Auth gate
  const [, errorResponse] = await requireAuth(request);
  if (errorResponse) return errorResponse;

  let body: SimulatorRequestBody;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  // Validate required fields
  const {
    therapeuticArea,
    indication,
    modality,
    phase,
    peakSalesLow,
    peakSalesMedian,
    peakSalesHigh,
    competitivePosition,
    companyType,
    buyers,
    batnaUpfrontM,
  } = body;

  if (!therapeuticArea || !modality || !phase || !peakSalesMedian) {
    return apiError('Missing required fields: therapeuticArea, modality, phase, peakSalesMedian', 400);
  }

  if (!buyers || !Array.isArray(buyers) || buyers.length === 0 || buyers.length > 3) {
    return apiError('buyers must be an array of 1-3 buyer names', 400);
  }

  if (typeof batnaUpfrontM !== 'number' || batnaUpfrontM < 0) {
    return apiError('batnaUpfrontM must be a non-negative number', 400);
  }

  if (peakSalesMedian < 10) {
    return apiError('Peak sales median must be at least $10M', 400);
  }

  const {
    dataQuality: userDataQuality,
    biomarkerStatus: userBiomarkerStatus,
    breakthrough, fastTrack, orphan, prime,
  } = body as unknown as Record<string, unknown>;

  const rnpvInput: RNPVInput = {
    therapeuticArea,
    indication: indication || '',
    modality,
    phase,
    territory: 'global',
    dealType: 'licensing',
    peakSalesEstimate: {
      low: peakSalesLow || peakSalesMedian * 0.5,
      median: peakSalesMedian,
      high: peakSalesHigh || peakSalesMedian * 2,
    },
    competitivePosition: competitivePosition || 'racing',
    dataQuality: (userDataQuality as string) || 'moderate',
    biomarkerStatus: (userBiomarkerStatus as string) || 'unselected',
    regulatoryDesignations: {
      breakthrough: breakthrough === true,
      fastTrack: fastTrack === true,
      orphan: orphan === true,
      prime: prime === true,
    },
    companyType: companyType || 'biotech',
  };

  // Run rNPV ONCE
  let result;
  try {
    result = calculateRNPV(rnpvInput);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'rNPV calculation failed';
    return apiError(message, 500);
  }

  const baseUpfront = result.impliedDealValue?.upfront?.median ?? 0;
  const totalDealMedian = result.impliedDealValue?.totalDeal?.median ?? 0;
  const riskAdjustedNPV = result.riskAdjustedNPV ?? 0;

  // Fetch premiums for all requested buyers
  const supabase = createServiceClient();
  const { data: premiumRows } = await supabase
    .from('counterparty_premiums')
    .select('company_name, premium_multiplier')
    .in('company_name', buyers);

  const premiumMap = new Map<string, number>();
  for (const row of premiumRows ?? []) {
    premiumMap.set(row.company_name, Number(row.premium_multiplier));
  }

  // Compute ZOPA per buyer
  const buyerResults: BuyerZOPA[] = buyers.map((buyerName) => {
    const premium = premiumMap.get(buyerName) ?? 1.0;
    const buyerTopUpfront = Math.round(baseUpfront * premium);
    const floorUpfront = Math.round(batnaUpfrontM);
    const zopaWidth = buyerTopUpfront - floorUpfront;
    const zopaMidpoint = zopaWidth > 0 ? (floorUpfront + buyerTopUpfront) / 2 : floorUpfront;
    const recommendedOpening = zopaWidth > 0
      ? Math.round(zopaMidpoint + zopaWidth * 0.35)
      : Math.round(buyerTopUpfront);
    const recommendedFallback = zopaWidth > 0
      ? Math.round(zopaMidpoint)
      : floorUpfront;

    return {
      name: buyerName,
      premium,
      floorUpfront,
      buyerTopUpfront,
      zopaWidth,
      recommendedOpening,
      recommendedFallback,
    };
  });

  return apiSuccess({
    baseRNPV: {
      upfrontMedian: Math.round(baseUpfront),
      totalDealMedian: Math.round(totalDealMedian),
      riskAdjustedNPV: Math.round(riskAdjustedNPV),
    },
    buyers: buyerResults,
  });
}
