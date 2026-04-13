/**
 * Negotiation Simulator — data loader.
 *
 * Combines rNPV base valuation + counterparty premium + licensor BATNA to
 * compute the Zone of Possible Agreement (ZOPA) and a recommended opening
 * position for a set of preset scenarios.
 *
 * Preset scenarios intentionally pair realistic asset profiles with large,
 * high-confidence buyers from the counterparty_premiums table so the
 * output is immediately credible.
 */

import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import { createServiceClient } from '@/lib/supabase/server';
import type { RNPVInput, RNPVResult } from '@/lib/financial/types';

export interface ZOPAScenario {
  slug: string;
  title: string;
  subtitle: string;
  assetProfile: {
    ta: string;
    indication: string;
    phase: string;
    modality: string;
    peakSalesM: number;
  };
  licensorContext: {
    companyName: string;
    cashRunwayNarrative: string;
    batnaUpfrontM: number;
    batnaRationale: string;
  };
  buyerContext: {
    companyName: string;
    premiumMultiplier: number | null;
    sampleSize: number | null;
    confidence: 'high' | 'medium' | 'low' | null;
  };
  rnpv: {
    totalDealMedian_M: number;
    upfrontMedian_M: number;
    riskAdjustedNPV_M: number;
  };
  zopa: {
    /** Licensor's walk-away point (BATNA upfront) */
    floorUpfront_M: number;
    /** What the buyer is likely to pay (rNPV upfront × buyer premium) */
    buyerTopUpfront_M: number;
    /** Zone width — positive means agreement possible */
    zopaWidth_M: number;
    /** Recommended opening ask (buyer top × 1.15, anchored above ZOPA midpoint) */
    recommendedOpening_M: number;
    /** Recommended fallback (ZOPA midpoint) */
    recommendedFallback_M: number;
  };
}

interface ScenarioConfig {
  slug: string;
  title: string;
  subtitle: string;
  input: RNPVInput;
  licensorName: string;
  cashRunwayNarrative: string;
  /** Licensor's minimum acceptable upfront ($M). Anchored to cash-runway need. */
  batnaUpfrontM: number;
  batnaRationale: string;
  /** Name of the buyer in counterparty_premiums.company_name */
  buyerName: string;
}

const SCENARIOS_CONFIG: ScenarioConfig[] = [
  {
    slug: 'abbvie-immunology-phase3',
    title: 'AbbVie offering for Phase 3 immunology',
    subtitle: 'Atopic dermatitis, $2B peak, clinical-stage biotech licensor',
    input: {
      therapeuticArea: 'immunology',
      indication: 'atopic_dermatitis',
      modality: 'mab',
      phase: 'phase3',
      territory: 'global',
      dealType: 'licensing',
      peakSalesEstimate: { low: 1000, median: 2000, high: 4000 },
      competitivePosition: 'bestInClass',
      dataQuality: 'pivotalReady',
      biomarkerStatus: 'unselected',
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      companyType: 'clinicalStageBiotech',
    },
    licensorName: 'Clinical-stage biotech (n=1 program)',
    cashRunwayNarrative: 'Single-asset clinical-stage biotech with 14-month cash runway — needs meaningful upfront to reach next inflection.',
    batnaUpfrontM: 200,
    batnaRationale: '$200M funds 2 years of Phase 3 spend + buffer; below this, continuing standalone is economically preferred.',
    buyerName: 'AbbVie',
  },
  {
    slug: 'pfizer-oncology-phase2',
    title: 'Pfizer offering for Phase 2 oncology ADC',
    subtitle: 'HER2+ breast cancer, $1.5B peak, mid-biotech licensor',
    input: {
      therapeuticArea: 'oncology',
      indication: 'breast_her2',
      modality: 'adc',
      phase: 'phase2',
      territory: 'global',
      dealType: 'licensing',
      peakSalesEstimate: { low: 750, median: 1500, high: 3000 },
      competitivePosition: 'racing',
      dataQuality: 'strongPhase2',
      biomarkerStatus: 'selected',
      regulatoryDesignations: { breakthrough: true, fastTrack: false, orphan: false, prime: false },
      companyType: 'biotech',
    },
    licensorName: 'Mid-cap biotech (multi-program)',
    cashRunwayNarrative: 'Mid-cap biotech with 3 programs; this asset is #2 priority. Will retain if upfront does not exceed opportunity cost of in-house Phase 3.',
    batnaUpfrontM: 150,
    batnaRationale: 'Phase 3 self-funding feasible at ~$150M opportunity cost (out-of-pocket + shareholder dilution risk).',
    buyerName: 'Pfizer',
  },
  {
    slug: 'gilead-hiv-phase3',
    title: 'Gilead offering for Phase 3 HIV combo',
    subtitle: 'HIV, $1B peak, small biotech licensor (single-program)',
    input: {
      therapeuticArea: 'infectiousDisease',
      indication: 'hiv',
      modality: 'smallMolecule',
      phase: 'phase3',
      territory: 'global',
      dealType: 'licensing',
      peakSalesEstimate: { low: 500, median: 1000, high: 2000 },
      competitivePosition: 'bestInClass',
      dataQuality: 'pivotalReady',
      biomarkerStatus: 'unselected',
      regulatoryDesignations: { breakthrough: false, fastTrack: true, orphan: false, prime: false },
      companyType: 'clinicalStageBiotech',
    },
    licensorName: 'Single-program HIV biotech',
    cashRunwayNarrative: 'Single-asset biotech with clinical-ready data but no commercial infrastructure. Licensing is the primary path to market.',
    batnaUpfrontM: 100,
    batnaRationale: 'Below $100M, shareholder calculus tips toward holding the asset and running a smaller combo study with a partner.',
    buyerName: 'Gilead Sciences',
  },
];

interface PremiumRow {
  premium_multiplier: number;
  sample_size: number;
  confidence: 'high' | 'medium' | 'low';
}

export async function loadNegotiationScenarios(): Promise<ZOPAScenario[]> {
  const supabase = createServiceClient();
  const buyerNames = SCENARIOS_CONFIG.map(s => s.buyerName);
  const { data: premiumRows } = await supabase
    .from('counterparty_premiums')
    .select('company_name, premium_multiplier, sample_size, confidence')
    .in('company_name', buyerNames);

  const premiumByName = new Map<string, PremiumRow>();
  for (const row of premiumRows ?? []) {
    premiumByName.set(row.company_name, {
      premium_multiplier: Number(row.premium_multiplier),
      sample_size: row.sample_size,
      confidence: row.confidence,
    });
  }

  return SCENARIOS_CONFIG.map(cfg => computeZOPA(cfg, premiumByName.get(cfg.buyerName)));
}

function computeZOPA(cfg: ScenarioConfig, premium: PremiumRow | undefined): ZOPAScenario {
  const result: RNPVResult = calculateRNPV(cfg.input);
  const baseUpfront = result.impliedDealValue?.upfront?.median ?? 0;
  const totalDealMedian = result.impliedDealValue?.totalDeal?.median ?? 0;

  const buyerMultiplier = premium?.premium_multiplier ?? 1.0;
  const buyerTopUpfront = Math.round(baseUpfront * buyerMultiplier);
  const floorUpfront = cfg.batnaUpfrontM;
  const zopaWidth = buyerTopUpfront - floorUpfront;

  // Opening ask: ~15% above buyer's top, anchored conservatively.
  const recommendedOpening = Math.round(buyerTopUpfront * 1.15);
  // Fallback: ZOPA midpoint when agreement is possible, otherwise BATNA.
  const recommendedFallback = zopaWidth > 0
    ? Math.round((floorUpfront + buyerTopUpfront) / 2)
    : floorUpfront;

  return {
    slug: cfg.slug,
    title: cfg.title,
    subtitle: cfg.subtitle,
    assetProfile: {
      ta: cfg.input.therapeuticArea,
      indication: cfg.input.indication || '',
      phase: cfg.input.phase,
      modality: cfg.input.modality,
      peakSalesM: cfg.input.peakSalesEstimate.median,
    },
    licensorContext: {
      companyName: cfg.licensorName,
      cashRunwayNarrative: cfg.cashRunwayNarrative,
      batnaUpfrontM: cfg.batnaUpfrontM,
      batnaRationale: cfg.batnaRationale,
    },
    buyerContext: {
      companyName: cfg.buyerName,
      premiumMultiplier: premium?.premium_multiplier ?? null,
      sampleSize: premium?.sample_size ?? null,
      confidence: premium?.confidence ?? null,
    },
    rnpv: {
      totalDealMedian_M: Math.round(totalDealMedian),
      upfrontMedian_M: Math.round(baseUpfront),
      riskAdjustedNPV_M: Math.round(result.riskAdjustedNPV ?? 0),
    },
    zopa: {
      floorUpfront_M: floorUpfront,
      buyerTopUpfront_M: buyerTopUpfront,
      zopaWidth_M: zopaWidth,
      recommendedOpening_M: recommendedOpening,
      recommendedFallback_M: recommendedFallback,
    },
  };
}
