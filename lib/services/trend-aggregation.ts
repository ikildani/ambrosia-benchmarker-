import type { SupabaseClient } from '@supabase/supabase-js';
import { weightedQuantile, recencyWeight } from '@/lib/math/quantile';

export interface QuarterData {
  quarter: string;
  year: number;
  dealCount: number;
  medianUpfrontM: number | null;
  medianTotalM: number | null;
  avgRoyaltyLow: number | null;
  avgRoyaltyHigh: number | null;
  byTA: Record<string, number>;
  byModality: Record<string, number>;
  byPhase: Record<string, number>;
  byDealType: Record<string, number>;
}

export interface MomentumSignal {
  dimension: string;
  label: string;
  metric: string;
  currentValue: number;
  priorValue: number;
  changePercent: number;
  direction: 'up' | 'down' | 'flat';
}

export interface EstimateResult {
  upfront: { p10: number; p25: number; median: number; p75: number; p90: number };
  totalValue: { p10: number; p25: number; median: number; p75: number; p90: number };
  royalty: { lowMedian: number; highMedian: number } | null;
  sampleSize: number;
}

interface DealRow {
  announced_date: string | null;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  total_deal_value_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  therapeutic_area: string | null;
  modality: string | null;
  phase_at_signing: string | null;
  deal_type: string | null;
  terms_disclosed: boolean | null;
}

const INTERNAL_TAS = new Set(['_option_deals', '_codev_deals', '_china_deals', '_mega_deals', 'other']);

function getQuarterKey(date: string): { quarter: string; year: number } | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = d.getMonth();
  const q = Math.floor(month / 3) + 1;
  return { quarter: `Q${q}`, year };
}

function toMillions(usd: number | null): number | null {
  if (usd == null || usd <= 0) return null;
  return Math.round(usd / 1_000_000);
}

async function fetchDeals(supabase: SupabaseClient, fromYear?: number, toYear?: number): Promise<DealRow[]> {
  let query = supabase
    .from('deals')
    .select('announced_date, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, therapeutic_area, modality, phase_at_signing, deal_type, terms_disclosed')
    .eq('is_synthetic', false)
    .order('announced_date', { ascending: true });

  if (fromYear) query = query.gte('announced_date', `${fromYear}-01-01`);
  if (toYear) query = query.lte('announced_date', `${toYear}-12-31`);

  const { data, error } = await query.limit(5000);
  if (error) throw new Error(`Deal fetch failed: ${error.message}`);
  return (data || []) as DealRow[];
}

export async function aggregateDealsByQuarter(
  supabase: SupabaseClient,
  filters?: { ta?: string; modality?: string; fromYear?: number; toYear?: number }
): Promise<QuarterData[]> {
  let deals = await fetchDeals(supabase, filters?.fromYear, filters?.toYear);

  deals = deals.filter(d => {
    if (!d.announced_date) return false;
    if (d.therapeutic_area && INTERNAL_TAS.has(d.therapeutic_area)) return false;
    if (filters?.ta && d.therapeutic_area !== filters.ta) return false;
    if (filters?.modality && d.modality !== filters.modality) return false;
    return true;
  });

  const grouped = new Map<string, DealRow[]>();
  for (const deal of deals) {
    const qk = getQuarterKey(deal.announced_date!);
    if (!qk) continue;
    const key = `${qk.year}-${qk.quarter}`;
    const arr = grouped.get(key) || [];
    arr.push(deal);
    grouped.set(key, arr);
  }

  const quarters: QuarterData[] = [];
  for (const [key, qDeals] of Array.from(grouped.entries())) {
    const [yearStr, quarter] = key.split('-');
    const year = parseInt(yearStr);
    const referenceYear = new Date().getFullYear();

    const upfrontPairs = qDeals
      .filter(d => d.terms_disclosed && d.upfront_usd && d.upfront_usd > 0)
      .map(d => ({
        value: toMillions(d.upfront_usd)!,
        weight: recencyWeight(year, referenceYear),
      }));

    const totalPairs = qDeals
      .filter(d => d.terms_disclosed && d.total_deal_value_usd && d.total_deal_value_usd > 0)
      .map(d => ({
        value: toMillions(d.total_deal_value_usd)!,
        weight: recencyWeight(year, referenceYear),
      }));

    const royaltyDeals = qDeals.filter(d => d.royalty_low_pct != null && d.royalty_low_pct > 0);
    const avgRoyaltyLow = royaltyDeals.length > 0
      ? royaltyDeals.reduce((s, d) => s + (d.royalty_low_pct || 0), 0) / royaltyDeals.length
      : null;
    const avgRoyaltyHigh = royaltyDeals.length > 0
      ? royaltyDeals.reduce((s, d) => s + (d.royalty_high_pct || 0), 0) / royaltyDeals.length
      : null;

    const byTA: Record<string, number> = {};
    const byModality: Record<string, number> = {};
    const byPhase: Record<string, number> = {};
    const byDealType: Record<string, number> = {};

    for (const d of qDeals) {
      if (d.therapeutic_area) byTA[d.therapeutic_area] = (byTA[d.therapeutic_area] || 0) + 1;
      if (d.modality) byModality[d.modality] = (byModality[d.modality] || 0) + 1;
      if (d.phase_at_signing) byPhase[d.phase_at_signing] = (byPhase[d.phase_at_signing] || 0) + 1;
      if (d.deal_type) byDealType[d.deal_type] = (byDealType[d.deal_type] || 0) + 1;
    }

    quarters.push({
      quarter,
      year,
      dealCount: qDeals.length,
      medianUpfrontM: upfrontPairs.length >= 3 ? weightedQuantile(upfrontPairs, 0.5) : null,
      medianTotalM: totalPairs.length >= 3 ? weightedQuantile(totalPairs, 0.5) : null,
      avgRoyaltyLow: avgRoyaltyLow ? Math.round(avgRoyaltyLow * 10) / 10 : null,
      avgRoyaltyHigh: avgRoyaltyHigh ? Math.round(avgRoyaltyHigh * 10) / 10 : null,
      byTA,
      byModality,
      byPhase,
      byDealType,
    });
  }

  quarters.sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter.localeCompare(b.quarter));
  return quarters;
}

export function computeMomentumSignals(quarters: QuarterData[]): MomentumSignal[] {
  if (quarters.length < 2) return [];

  const current = quarters[quarters.length - 1];
  const prior = quarters[quarters.length - 2];
  const priorYear = quarters.find(q => q.year === current.year - 1 && q.quarter === current.quarter);

  const signals: MomentumSignal[] = [];

  function addSignal(dimension: string, label: string, metric: string, curr: number, prev: number) {
    if (prev === 0 && curr === 0) return;
    const change = prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);
    signals.push({
      dimension,
      label,
      metric,
      currentValue: curr,
      priorValue: prev,
      changePercent: change,
      direction: change > 5 ? 'up' : change < -5 ? 'down' : 'flat',
    });
  }

  addSignal('overall', 'Total Deals', 'deal_count_qoq', current.dealCount, prior.dealCount);
  if (current.medianUpfrontM != null && prior.medianUpfrontM != null) {
    addSignal('overall', 'Median Upfront', 'upfront_qoq', current.medianUpfrontM, prior.medianUpfrontM);
  }
  if (current.medianTotalM != null && prior.medianTotalM != null) {
    addSignal('overall', 'Median Total Value', 'total_value_qoq', current.medianTotalM, prior.medianTotalM);
  }

  if (priorYear) {
    addSignal('overall', 'Total Deals (YoY)', 'deal_count_yoy', current.dealCount, priorYear.dealCount);
    if (current.medianUpfrontM != null && priorYear.medianUpfrontM != null) {
      addSignal('overall', 'Median Upfront (YoY)', 'upfront_yoy', current.medianUpfrontM, priorYear.medianUpfrontM);
    }
  }

  const topTAs = Object.entries(current.byTA).sort((a, b) => b[1] - a[1]).slice(0, 6);
  for (const [ta, count] of topTAs) {
    const priorCount = prior.byTA[ta] || 0;
    addSignal(`ta:${ta}`, ta, 'ta_count_qoq', count, priorCount);
  }

  const topModalities = Object.entries(current.byModality).sort((a, b) => b[1] - a[1]).slice(0, 6);
  for (const [mod, count] of topModalities) {
    const priorCount = prior.byModality[mod] || 0;
    addSignal(`modality:${mod}`, mod, 'modality_count_qoq', count, priorCount);
  }

  return signals;
}

export async function computeEstimate(
  supabase: SupabaseClient,
  ta: string,
  phase: string,
  modality: string,
  territory: string = 'global'
): Promise<EstimateResult> {
  const { data: deals, error } = await supabase
    .from('deals')
    .select('upfront_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, phase_at_signing, modality, therapeutic_area, territory')
    .eq('is_synthetic', false)
    .eq('terms_disclosed', true)
    .order('announced_date', { ascending: false })
    .limit(500);

  if (error) throw new Error(`Estimate query failed: ${error.message}`);
  if (!deals || deals.length === 0) {
    return { upfront: { p10: 0, p25: 0, median: 0, p75: 0, p90: 0 }, totalValue: { p10: 0, p25: 0, median: 0, p75: 0, p90: 0 }, royalty: null, sampleSize: 0 };
  }

  const referenceYear = new Date().getFullYear();

  const scored = deals.map(d => {
    let score = 0;
    if (d.therapeutic_area === ta) score += 3;
    if (d.modality === modality) score += 4;
    const phaseNorm = (d.phase_at_signing || '').replace(/_/g, '');
    const targetPhaseNorm = phase.replace(/_/g, '');
    if (phaseNorm === targetPhaseNorm) score += 2;
    if (territory !== 'global' && d.territory === territory) score += 1;
    const year = d.announced_date ? new Date(d.announced_date).getFullYear() : 2020;
    if (year === referenceYear) score += 2;
    else if (year === referenceYear - 1) score += 1;
    return { ...d, score, year };
  });

  const relevant = scored.filter(d => d.score >= 2).sort((a, b) => b.score - a.score).slice(0, 50);
  if (relevant.length === 0) {
    return { upfront: { p10: 0, p25: 0, median: 0, p75: 0, p90: 0 }, totalValue: { p10: 0, p25: 0, median: 0, p75: 0, p90: 0 }, royalty: null, sampleSize: 0 };
  }

  const upfrontPairs = relevant
    .filter(d => d.upfront_usd && d.upfront_usd > 0)
    .map(d => ({ value: d.upfront_usd / 1_000_000, weight: recencyWeight(d.year, referenceYear) }));

  const totalPairs = relevant
    .filter(d => d.total_deal_value_usd && d.total_deal_value_usd > 0)
    .map(d => ({ value: d.total_deal_value_usd / 1_000_000, weight: recencyWeight(d.year, referenceYear) }));

  const royaltyDeals = relevant.filter(d => d.royalty_low_pct != null && d.royalty_low_pct > 0);

  function pcts(pairs: { value: number; weight: number }[]) {
    if (pairs.length < 3) return { p10: 0, p25: 0, median: 0, p75: 0, p90: 0 };
    return {
      p10: Math.round(weightedQuantile(pairs, 0.10)),
      p25: Math.round(weightedQuantile(pairs, 0.25)),
      median: Math.round(weightedQuantile(pairs, 0.50)),
      p75: Math.round(weightedQuantile(pairs, 0.75)),
      p90: Math.round(weightedQuantile(pairs, 0.90)),
    };
  }

  return {
    upfront: pcts(upfrontPairs),
    totalValue: pcts(totalPairs),
    royalty: royaltyDeals.length >= 3
      ? {
          lowMedian: Math.round(royaltyDeals.reduce((s, d) => s + (d.royalty_low_pct || 0), 0) / royaltyDeals.length * 10) / 10,
          highMedian: Math.round(royaltyDeals.reduce((s, d) => s + (d.royalty_high_pct || 0), 0) / royaltyDeals.length * 10) / 10,
        }
      : null,
    sampleSize: relevant.length,
  };
}
