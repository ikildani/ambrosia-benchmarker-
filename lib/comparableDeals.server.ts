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
      .select('licensor_name, licensee_name, total_deal_value_usd, upfront_usd, announced_date, modality, indication_category, indication_specific, therapeutic_area, asset_name, phase_at_signing')
      .eq('terms_disclosed', true)
      .eq('is_synthetic', false)
      .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")')
      .not('total_deal_value_usd', 'is', null)
      .gt('total_deal_value_usd', 0)
      .order('announced_date', { ascending: false })
      .limit(200);

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

    const currentYear = new Date().getFullYear();
    const scored = allDeals.map(deal => {
      let score = 0;
      if (deal.therapeuticArea === therapeuticArea || deal.therapeuticArea === 'both') score += 1;
      if (modality && deal.modalities?.includes(modality)) score += 3;
      if (indication && deal.indications?.includes(indication)) score += 3;
      if (deal.year === currentYear) score += 2;
      else if (deal.year === currentYear - 1) score += 1;
      return { deal, score };
    });

    return scored
      .filter(s => s.score > 0)
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
      .select('licensor_name, licensee_name, total_deal_value_usd, upfront_usd, announced_date, modality, indication_category, indication_specific, therapeutic_area, phase_at_signing')
      .eq('terms_disclosed', true)
      .eq('is_synthetic', false)
      .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")')
      .not('total_deal_value_usd', 'is', null)
      .gt('total_deal_value_usd', 0)
      .order('announced_date', { ascending: false })
      .limit(200);

    const dbScored = (dbDeals || []).map((d, idx) => {
      let score = 0;
      const reasons: string[] = [];
      const ta = d.therapeutic_area || '';

      if (ta === inputs.therapeuticArea || ta === 'both') {
        score += 3;
        reasons.push('Same therapeutic area');
      }
      if (inputs.modality && d.modality === inputs.modality) {
        score += 4;
        reasons.push('Same modality');
      }
      if (inputs.indication && (d.indication_category === inputs.indication || d.indication_specific === inputs.indication)) {
        score += 3;
        reasons.push('Same indication');
      }

      const year = d.announced_date ? new Date(d.announced_date).getFullYear() : new Date().getFullYear();
      const currentYear = new Date().getFullYear();
      if (year === currentYear) { score += 2; reasons.push('Recent deal'); }
      else if (year === currentYear - 1) { score += 1; }

      return {
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
      let score = 0;
      const reasons: string[] = [];

      if (deal.therapeuticArea === inputs.therapeuticArea || deal.therapeuticArea === 'both') {
        score += 3;
        reasons.push('Same therapeutic area');
      }
      if (inputs.modality && deal.modalities?.includes(inputs.modality)) {
        score += 4;
        reasons.push('Same modality');
      }
      if (inputs.indication && deal.indications?.includes(inputs.indication)) {
        score += 3;
        reasons.push('Same indication');
      }

      return {
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

    const all = [...staticScored, ...uniqueDb];
    return all
      .filter(s => s.score >= 2)
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
  matchScore: number;
  matchBreakdown: { ta: boolean; modality: boolean; phase: boolean; indication: boolean; recency: number };
  relevanceReasons: string[];
}

export interface ComparableBenchmarkRange {
  upfront: { p25: number; median: number; p75: number };
  totalValue: { p25: number; median: number; p75: number };
  n: number;
}

export async function findEnrichedComparableDeals(
  inputs: { therapeuticArea: string; modality: string; indication: string; phase?: string; dealType?: string },
  maxDeals: number = 30,
): Promise<{ deals: EnrichedComparableDeal[]; benchmarkRange: ComparableBenchmarkRange }> {
  const supabase = createServiceClient();

  const { data: dbDeals } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, total_deal_value_usd, upfront_usd, announced_date, modality, indication_category, indication_specific, therapeutic_area, phase_at_signing, deal_type, territory, asset_name, licensor_country, licensee_country, cross_border, deal_corridor')
    .eq('terms_disclosed', true)
    .eq('is_synthetic', false)
    .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")')
    .not('total_deal_value_usd', 'is', null)
    .gt('total_deal_value_usd', 0)
    .order('announced_date', { ascending: false })
    .limit(500);

  const currentYear = new Date().getFullYear();
  const MAX_SCORE = 14;

  const scored = (dbDeals || []).map(d => {
    let score = 0;
    const reasons: string[] = [];
    const breakdown = { ta: false, modality: false, phase: false, indication: false, recency: 0 };
    const ta = d.therapeutic_area || '';
    const year = d.announced_date ? new Date(d.announced_date).getFullYear() : currentYear;

    if (ta === inputs.therapeuticArea) { score += 3; breakdown.ta = true; reasons.push('Same TA'); }
    if (inputs.modality && d.modality === inputs.modality) { score += 4; breakdown.modality = true; reasons.push('Same modality'); }
    if (inputs.indication && (d.indication_category === inputs.indication || d.indication_specific === inputs.indication)) {
      score += 3; breakdown.indication = true; reasons.push('Same indication');
    }
    if (inputs.phase && d.phase_at_signing === inputs.phase) { score += 2; breakdown.phase = true; reasons.push('Same phase'); }

    if (year >= currentYear) { score += 2; breakdown.recency = 2; reasons.push('Current year'); }
    else if (year >= currentYear - 1) { score += 1; breakdown.recency = 1; }

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
        matchScore: Math.min(score / MAX_SCORE, 1),
        matchBreakdown: breakdown,
        relevanceReasons: reasons,
      } as EnrichedComparableDeal,
      score,
    };
  });

  const filtered = scored
    .filter(s => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDeals);

  const deals = filtered.map(s => s.deal);

  const upfrontPairs = deals
    .filter(d => d.upfrontM && d.upfrontM > 0)
    .map(d => ({ value: d.upfrontM!, weight: recencyWeight(d.year) }));
  const totalPairs = deals
    .filter(d => d.totalValueM && d.totalValueM > 0)
    .map(d => ({ value: d.totalValueM!, weight: recencyWeight(d.year) }));

  const benchmarkRange: ComparableBenchmarkRange = {
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
  };

  return { deals, benchmarkRange };
}
