// Server-only comparable deals functions that query Supabase
// Import this ONLY from API routes / server components (uses next/headers)

import { createServiceClient } from '@/lib/supabase/server';
import {
  ComparableDeal,
  ComparableDealForUI,
  getRelevantDeals,
  findComparableDeals,
  COMPARABLE_DEALS,
} from '@/lib/comparableDeals';
import { weightedQuantile, recencyWeight } from '@/lib/math/quantile';
import { classifyBuyerTier } from './buyer-tier';
import {
  scoreCompMatch,
  selectWithRelaxation,
  shouldExcludeForStage,
  type CompRelaxation,
  type CompMatchBreakdown,
} from '@/lib/comparable-scoring';

// Format dollar amount from raw USD number to display string
function formatDealValue(usd: number | null): string | null {
  if (!usd || usd <= 0) return null;
  const millions = usd / 1_000_000;
  if (millions >= 1000) return `$${(millions / 1000).toFixed(1)}B`;
  return `$${Math.round(millions)}M`;
}

// Async version that merges live DB deals (SEC EDGAR) with curated static deals
export async function getRelevantDealsWithDB(
  therapeuticArea: string,
  modality?: string,
  indication?: string,
  maxDeals: number = 8
): Promise<ComparableDeal[]> {
  try {
    const supabase = createServiceClient();

    const { data: dbDeals } = await supabase
      .from('deals')
      .select('licensor_name, licensee_name, total_deal_value_usd, upfront_usd, announced_date, modality, indication_category, indication_specific, therapeutic_area, asset_name, phase_at_signing, deal_type')
      .eq('terms_disclosed', true)
      .eq('is_synthetic', false)
      .or('is_canonical.is.null,is_canonical.eq.true')
      .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")')
      // Filter on TA in SQL first so older exact-match comps are not crowded out by recency
      .eq('therapeutic_area', therapeuticArea)
      .not('total_deal_value_usd', 'is', null)
      .gt('total_deal_value_usd', 0)
      .order('announced_date', { ascending: false })
      .limit(500);

    const mappedDbDeals: (ComparableDeal & { _source: 'db' })[] = (dbDeals || []).map(d => {
      const value = formatDealValue(d.total_deal_value_usd) || formatDealValue(d.upfront_usd) || 'Undisclosed';
      const year = d.announced_date ? new Date(d.announced_date).getFullYear() : new Date().getFullYear();
      const ta = (d.therapeutic_area || 'oncology') as ComparableDeal['therapeuticArea'];

      return {
        licensor: d.licensor_name || 'Unknown',
        licensee: d.licensee_name || 'Unknown',
        value,
        year,
        relevance: [d.asset_name, d.phase_at_signing, d.modality].filter(Boolean).join(' — ') || 'SEC EDGAR filing',
        modalities: d.modality ? [d.modality] : undefined,
        indications: [d.indication_category, d.indication_specific].filter(Boolean) as string[] | undefined,
        therapeuticArea: ta,
        dealType: (d.deal_type as ComparableDeal['dealType']) || undefined,
        phase: d.phase_at_signing || undefined,
        _source: 'db' as const,
      };
    });

    // Deduplicate: remove DB deals that match a curated deal
    const curatedKeys = new Set(
      COMPARABLE_DEALS.map(d => `${d.licensor.toLowerCase()}|${d.licensee.toLowerCase()}|${d.year}`)
    );
    const uniqueDbDeals = mappedDbDeals.filter(d =>
      !curatedKeys.has(`${d.licensor.toLowerCase()}|${d.licensee.toLowerCase()}|${d.year}`)
    );

    const allDeals: ComparableDeal[] = [...COMPARABLE_DEALS, ...uniqueDbDeals];

    // Shared weight table (phase > modality). No phase is available on this
    // legacy path, so the pass rule reduces to TA + indication, relaxing to
    // TA + modality, then TA only.
    const scored = allDeals.map(deal => {
      const r = scoreCompMatch(
        { therapeuticArea, modality, indication },
        { therapeuticArea: deal.therapeuticArea, secondaryTAs: deal.secondaryTAs, phase: deal.phase, modalities: deal.modalities, indications: deal.indications, dealType: deal.dealType, year: deal.year },
      );
      return { deal, score: r.score, breakdown: r.breakdown };
    });

    const { items } = selectWithRelaxation(scored, s => s.breakdown);
    return items
      .sort((a, b) => b.score - a.score)
      .slice(0, maxDeals)
      .map(s => s.deal);
  } catch (error) {
    console.error('[comparableDeals] DB query failed, using static fallback:', error);
    return getRelevantDeals(therapeuticArea, modality, indication, maxDeals);
  }
}

// Async version of findComparableDeals for frontend API
export async function findComparableDealsWithDB(
  inputs: { therapeuticArea: string; modality: string; indication: string; phase?: string },
  maxDeals: number = 8
): Promise<ComparableDealForUI[]> {
  try {
    const supabase = createServiceClient();

    const { data: dbDeals } = await supabase
      .from('deals')
      .select('licensor_name, licensee_name, total_deal_value_usd, upfront_usd, announced_date, modality, indication_category, indication_specific, therapeutic_area, phase_at_signing, deal_type, verification_status')
      .eq('terms_disclosed', true)
      .eq('is_synthetic', false)
      .or('is_canonical.is.null,is_canonical.eq.true')
      .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")')
      // Filter on TA in SQL first so older exact-match comps are not crowded out by recency
      .eq('therapeutic_area', inputs.therapeuticArea)
      .not('total_deal_value_usd', 'is', null)
      .gt('total_deal_value_usd', 0)
      .order('announced_date', { ascending: false })
      .limit(500);

    const dbScored = (dbDeals || []).map((d, idx) => {
      const year = d.announced_date ? new Date(d.announced_date).getFullYear() : new Date().getFullYear();
      const { score, breakdown, reasons } = scoreCompMatch(
        { therapeuticArea: inputs.therapeuticArea, modality: inputs.modality, indication: inputs.indication, phase: inputs.phase },
        { therapeuticArea: d.therapeutic_area, phase: d.phase_at_signing, modalities: [d.modality], indications: [d.indication_category, d.indication_specific], year, verified: d.verification_status === 'verified' },
      );

      return {
        breakdown,
        dealType: d.deal_type as string | null,
        deal: {
          id: `db-${idx}`,
          parties: `${d.licensor_name || 'Unknown'} / ${d.licensee_name || 'Unknown'}`,
          totalValue: formatDealValue(d.total_deal_value_usd) || 'Undisclosed',
          upfront: formatDealValue(d.upfront_usd) || undefined,
          year,
          phase: d.phase_at_signing || undefined,
          relevanceReasons: reasons,
        },
        score,
        key: `${(d.licensor_name || '').toLowerCase()}|${(d.licensee_name || '').toLowerCase()}|${year}`,
      };
    });

    const staticScored = COMPARABLE_DEALS.map((deal, idx) => {
      const { score, breakdown, reasons } = scoreCompMatch(
        { therapeuticArea: inputs.therapeuticArea, modality: inputs.modality, indication: inputs.indication, phase: inputs.phase },
        { therapeuticArea: deal.therapeuticArea, secondaryTAs: deal.secondaryTAs, phase: deal.phase, modalities: deal.modalities, indications: deal.indications, dealType: deal.dealType, year: deal.year },
      );

      return {
        breakdown,
        dealType: deal.dealType ?? null,
        deal: {
          id: `deal-${idx}`,
          parties: `${deal.licensor} / ${deal.licensee}`,
          totalValue: deal.value,
          year: deal.year,
          relevanceReasons: reasons,
        } as ComparableDealForUI,
        score,
        key: `${deal.licensor.toLowerCase()}|${deal.licensee.toLowerCase()}|${deal.year}`,
      };
    });

    const staticKeys = new Set(staticScored.map(s => s.key));
    const uniqueDb = dbScored.filter(d => !staticKeys.has(d.key));

    // Stage sanity: no approved-stage M&A in a pre-approval comp pool.
    const all = [...staticScored, ...uniqueDb].filter(
      s => !shouldExcludeForStage(inputs.phase, s.deal.phase, s.dealType),
    );
    const { items } = selectWithRelaxation(all, s => s.breakdown);
    return items
      .sort((a, b) => b.score - a.score)
      .slice(0, maxDeals)
      .map(s => s.deal);
  } catch (error) {
    console.error('[comparableDeals] DB query failed for UI, using static fallback:', error);
    return findComparableDeals(inputs, maxDeals);
  }
}

export interface EnrichedComparableDeal {
  id: string;
  parties: string;
  licensor: string;
  licensee: string;
  totalValue: string;
  upfront: string | null;
  upfrontM: number | null;
  totalValueM: number | null;
  year: number;
  phase: string | null;
  modality: string | null;
  indication: string | null;
  therapeuticArea: string | null;
  dealType: string | null;
  territory: string | null;
  buyerTier: string | null;
  licensorCountry: string | null;
  licenseeCountry: string | null;
  crossBorder: boolean;
  dealCorridor: string | null;
  // Per-row provenance so data quality is visible next to each comp
  confidenceScore: number | null;
  verificationStatus: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  provenanceTier: string | null;
  /** 0–1, score / COMP_MAX_SCORE */
  matchScore: number;
  matchBreakdown: CompMatchBreakdown;
  relevanceReasons: string[];
}

export interface ComparableBenchmarkRange {
  upfront: { p25: number; median: number; p75: number };
  totalValue: { p25: number; median: number; p75: number };
  /** Deals in the comp set (shown). */
  n: number;
  /** Deals with a disclosed upfront — the upfront range is computed from these. */
  nUpfront: number;
  /** Deals with a disclosed total value — the total range is computed from these. */
  nTotal: number;
}

export interface EnrichedComparableResult {
  deals: EnrichedComparableDeal[];
  benchmarkRange: ComparableBenchmarkRange;
  /** Which rung of the relaxation ladder produced this pool. */
  relaxation: CompRelaxation;
  /** Approved-stage M&A deals dropped because the query phase is pre-approval. */
  excludedApprovedMA: number;
}

/** Recency-weighted p25 / median / p75 over disclosed values. */
export function computeBenchmarkRange(
  deals: Pick<EnrichedComparableDeal, 'upfrontM' | 'totalValueM' | 'year'>[],
): ComparableBenchmarkRange {
  const upfrontPairs = deals
    .filter(d => d.upfrontM && d.upfrontM > 0)
    .map(d => ({ value: d.upfrontM!, weight: recencyWeight(d.year) }));
  const totalPairs = deals
    .filter(d => d.totalValueM && d.totalValueM > 0)
    .map(d => ({ value: d.totalValueM!, weight: recencyWeight(d.year) }));

  return {
    upfront: {
      p25: weightedQuantile(upfrontPairs, 0.25),
      median: weightedQuantile(upfrontPairs, 0.5),
      p75: weightedQuantile(upfrontPairs, 0.75),
    },
    totalValue: {
      p25: weightedQuantile(totalPairs, 0.25),
      median: weightedQuantile(totalPairs, 0.5),
      p75: weightedQuantile(totalPairs, 0.75),
    },
    n: deals.length,
    nUpfront: upfrontPairs.length,
    nTotal: totalPairs.length,
  };
}

export async function findEnrichedComparableDeals(
  inputs: { therapeuticArea: string; modality: string; indication: string; phase?: string; dealType?: string },
  maxDeals: number = 30,
): Promise<EnrichedComparableResult> {
  const supabase = createServiceClient();

  const { data: dbDeals } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, total_deal_value_usd, upfront_usd, announced_date, modality, indication_category, indication_specific, therapeutic_area, phase_at_signing, deal_type, territory, asset_name, licensor_country, licensee_country, cross_border, deal_corridor, confidence_score, verification_status, source_url, source_type, provenance_tier')
    .eq('terms_disclosed', true)
    .eq('is_synthetic', false)
    .or('is_canonical.is.null,is_canonical.eq.true')
    .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")')
    // Filter on TA in SQL first (indexed). The relaxation ladder never widens
    // beyond TA, so this is lossless — and it means an older exact-match comp
    // is no longer pushed out by 500 more-recent deals from other TAs.
    .eq('therapeutic_area', inputs.therapeuticArea)
    .not('total_deal_value_usd', 'is', null)
    .gt('total_deal_value_usd', 0)
    .order('announced_date', { ascending: false })
    .limit(1000);

  const currentYear = new Date().getFullYear();

  // Stage/structure sanity filter — approved-stage acquisitions/mergers are
  // not comps for a pre-approval licensing query.
  let excludedApprovedMA = 0;
  const stageFiltered = (dbDeals || []).filter(d => {
    if (shouldExcludeForStage(inputs.phase, d.phase_at_signing, d.deal_type)) {
      excludedApprovedMA++;
      return false;
    }
    return true;
  });

  const scored = stageFiltered.map(d => {
    const ta = d.therapeutic_area || '';
    const year = d.announced_date ? new Date(d.announced_date).getFullYear() : currentYear;

    const { score, normalized, breakdown, reasons } = scoreCompMatch(
      { therapeuticArea: inputs.therapeuticArea, phase: inputs.phase, modality: inputs.modality, indication: inputs.indication, dealType: inputs.dealType },
      { therapeuticArea: ta, phase: d.phase_at_signing, modalities: [d.modality], indications: [d.indication_category, d.indication_specific], dealType: d.deal_type, year, verified: d.verification_status === 'verified' },
      { currentYear },
    );

    const upfrontRaw = d.upfront_usd ? Number(d.upfront_usd) : null;
    const totalRaw = d.total_deal_value_usd ? Number(d.total_deal_value_usd) : null;

    return {
      deal: {
        id: d.id,
        parties: `${d.licensor_name || 'Unknown'} / ${d.licensee_name || 'Unknown'}`,
        licensor: d.licensor_name || 'Unknown',
        licensee: d.licensee_name || 'Unknown',
        totalValue: formatDealValue(totalRaw) || 'Undisclosed',
        upfront: formatDealValue(upfrontRaw),
        upfrontM: upfrontRaw ? Math.round(upfrontRaw / 1_000_000) : null,
        totalValueM: totalRaw ? Math.round(totalRaw / 1_000_000) : null,
        year,
        phase: d.phase_at_signing || null,
        modality: d.modality || null,
        indication: d.indication_specific || d.indication_category || null,
        therapeuticArea: ta || null,
        dealType: d.deal_type || null,
        territory: d.territory || null,
        buyerTier: classifyBuyerTier(d.licensee_name || ''),
        licensorCountry: d.licensor_country || null,
        licenseeCountry: d.licensee_country || null,
        crossBorder: d.cross_border || false,
        dealCorridor: d.deal_corridor || null,
        confidenceScore: d.confidence_score ?? null,
        verificationStatus: d.verification_status || null,
        sourceUrl: d.source_url || null,
        sourceType: d.source_type || null,
        provenanceTier: d.provenance_tier ? String(d.provenance_tier).trim() : null,
        matchScore: normalized,
        matchBreakdown: breakdown,
        relevanceReasons: reasons,
      } as EnrichedComparableDeal,
      score,
      breakdown,
    };
  });

  // Pass threshold: TA + one of {phase, adjacent phase, indication}; relax if thin.
  const { items, relaxation } = selectWithRelaxation(scored, s => s.breakdown);
  if (relaxation !== 'none') {
    console.info(`[comparableDeals] relaxation=${relaxation} for ${inputs.therapeuticArea}/${inputs.phase ?? '?'}/${inputs.modality} (strict pool too thin)`);
  }

  const deals = items
    .sort((a, b) => b.score - a.score || b.deal.year - a.deal.year)
    .slice(0, maxDeals)
    .map(s => s.deal);

  return { deals, benchmarkRange: computeBenchmarkRange(deals), relaxation, excludedApprovedMA };
}
