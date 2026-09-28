/**
 * Search & Evaluation — acquirer view helpers (pure).
 *
 * The acquirer view answers "I am <company>: which programs should I be
 * looking at?" from radar_deal_opportunities (lib/radar/deal-creator.ts).
 * Opportunity rows were generated over months with looser rules than the
 * feed uses today, so the read side re-applies the feed's default
 * exclusions (Phase 4 / approved, comparator or marketed-elsewhere
 * ownership, fully partnered) instead of trusting every stored row.
 */

import { RADAR_OWNERSHIP_DEFAULT_EXCLUDED, RADAR_PHASE_DEFAULT_EXCLUDED } from '@/lib/radar/vocab';

export interface OpportunityAsset {
  id: string;
  asset_name: string;
  company_name: string;
  company_id: string | null;
  phase: string | null;
  modality: string | null;
  therapeutic_area: string | null;
  indication_specific: string | null;
  partnership_status: string | null;
  ownership_status: string | null;
  licensing_intent_score: number | null;
  score_pct_peer: number | null;
  originator_country: string | null;
  asset_origin: string | null;
}

export interface OpportunityRow {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_company_name: string;
  acquirer_company_id: string;
  acquirer_name: string;
  opportunity_score: number;
  strategic_fit_score: number | null;
  timing_score: number | null;
  rationale: string | null;
  strategic_drivers: unknown;
  risk_factors: unknown;
  predicted_upfront_low: number | null;
  predicted_upfront_mid: number | null;
  predicted_upfront_high: number | null;
  predicted_total_low: number | null;
  predicted_total_mid: number | null;
  predicted_total_high: number | null;
  gap_type: string | null;
  gap_detail: string | null;
  comp_count: number | null;
  confidence: number | null;
  status: string;
  generated_at: string;
}

export type OpportunityWithAsset = OpportunityRow & { asset: OpportunityAsset | null };

/** The feed's default exclusions, applied at read time to stored opportunities. */
export function opportunityEligible(asset: Pick<OpportunityAsset, 'phase' | 'ownership_status' | 'partnership_status'> | null): boolean {
  if (!asset) return false;
  if (asset.phase && RADAR_PHASE_DEFAULT_EXCLUDED.includes(asset.phase)) return false;
  if (asset.ownership_status && RADAR_OWNERSHIP_DEFAULT_EXCLUDED.includes(asset.ownership_status)) return false;
  if (asset.partnership_status === 'partnered') return false;
  return true;
}

/** One opportunity per asset (the highest-scored), then by opportunity score desc. */
export function dedupeOpportunities<T extends { asset_id: string; opportunity_score: number }>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const cur = best.get(r.asset_id);
    if (!cur || Number(r.opportunity_score) > Number(cur.opportunity_score)) best.set(r.asset_id, r);
  }
  return Array.from(best.values()).sort((a, b) => Number(b.opportunity_score) - Number(a.opportunity_score));
}

export const GAP_TYPE_LABEL: Record<string, string> = {
  patent_cliff_replacement: 'Patent cliff replacement',
  therapeutic_gap: 'Therapeutic area gap',
  modality_gap: 'Modality gap',
  pipeline_stage_gap: 'Pipeline stage gap',
  other: 'Other',
};

export function gapTypeLabel(gap: string | null | undefined): string {
  if (!gap) return GAP_TYPE_LABEL.other;
  return GAP_TYPE_LABEL[gap] ?? gap.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

export interface GapGroup<T> {
  gap_type: string;
  label: string;
  count: number;
  opportunities: T[];
}

/** Group by gap type, largest group first, each group ordered by opportunity score. */
export function groupByGap<T extends { gap_type: string | null; opportunity_score: number }>(rows: T[]): GapGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const key = r.gap_type || 'other';
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return Array.from(groups.entries())
    .map(([gap_type, opportunities]) => ({
      gap_type,
      label: gapTypeLabel(gap_type),
      count: opportunities.length,
      opportunities: [...opportunities].sort((a, b) => Number(b.opportunity_score) - Number(a.opportunity_score)),
    }))
    .sort((a, b) => b.count - a.count);
}

export interface LeaderboardRow {
  company_id: string;
  name: string;
  opportunities: number;
  avg_score: number;
}

/**
 * Acquirers ranked by open opportunity count. Grouped by company id (the
 * stored acquirer_name varies by run: "GSK", "Glaxo Group Limited (GSK)");
 * the most frequent spelling wins.
 */
export function buildLeaderboard(
  rows: Array<{ acquirer_company_id: string; acquirer_name: string; opportunity_score: number | string }>,
  top: number,
): LeaderboardRow[] {
  const byCompany = new Map<string, { names: Map<string, number>; count: number; scoreSum: number }>();
  for (const r of rows) {
    if (!r.acquirer_company_id) continue;
    const entry = byCompany.get(r.acquirer_company_id) ?? { names: new Map(), count: 0, scoreSum: 0 };
    entry.count++;
    entry.scoreSum += Number(r.opportunity_score) || 0;
    entry.names.set(r.acquirer_name, (entry.names.get(r.acquirer_name) ?? 0) + 1);
    byCompany.set(r.acquirer_company_id, entry);
  }
  return Array.from(byCompany.entries())
    .map(([company_id, e]) => ({
      company_id,
      name: Array.from(e.names.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? company_id,
      opportunities: e.count,
      avg_score: e.count ? Math.round(e.scoreSum / e.count) : 0,
    }))
    .sort((a, b) => b.opportunities - a.opportunities || a.name.localeCompare(b.name))
    .slice(0, Math.max(1, Math.min(top, 50)));
}
