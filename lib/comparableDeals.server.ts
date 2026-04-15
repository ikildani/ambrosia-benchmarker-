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
