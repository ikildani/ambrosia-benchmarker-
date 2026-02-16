import { SupabaseClient } from '@supabase/supabase-js';

interface ModalityBreakdown {
  [modality: string]: {
    count: number;
    avg_upfront: number | null;
    total_value: number | null;
  };
}

interface NotableDeal {
  id: string;
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  modality: string;
  phase_at_signing: string;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  announced_date: string;
}

interface TrialUpdates {
  new_recruiting: number;
  completed: number;
  terminated: number;
  suspended: number;
}

export interface WeeklySnapshot {
  id: string;
  snapshot_date: string;
  snapshot_type: string;
  new_deals_count: number;
  total_upfront_usd: number | null;
  avg_upfront_usd: number | null;
  modality_breakdown: ModalityBreakdown;
  therapeutic_area_breakdown: ModalityBreakdown;
  phase_breakdown: ModalityBreakdown;
  notable_deals: NotableDeal[];
  benchmark_changes: Record<string, number>;
  trial_updates: TrialUpdates;
}

export async function generateWeeklySnapshot(supabase: SupabaseClient): Promise<WeeklySnapshot | null> {
  const now = new Date();
  const snapshotDate = now.toISOString().split('T')[0];
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Fetch this week's deals and trailing 90-day deals in parallel
  const [thisWeekResult, trailingResult, trialUpdatesResult] = await Promise.all([
    supabase
      .from('deals')
      .select('*')
      .gte('announced_date', weekAgo)
      .order('upfront_usd', { ascending: false, nullsFirst: false }),

    supabase
      .from('deals')
      .select('modality, therapeutic_area, phase_at_signing, upfront_usd, total_deal_value_usd')
      .gte('announced_date', ninetyDaysAgo)
      .lt('announced_date', weekAgo),

    supabase
      .from('company_trials')
      .select('status')
      .gte('last_update_posted', weekAgo),
  ]);

  const thisWeekDeals = thisWeekResult.data || [];
  const trailingDeals = trailingResult.data || [];
  const trialChanges = trialUpdatesResult.data || [];

  // Calculate new deals count and financials
  const newDealsCount = thisWeekDeals.length;
  const dealsWithUpfront = thisWeekDeals.filter((d) => d.upfront_usd != null && d.upfront_usd > 0);
  const totalUpfront = dealsWithUpfront.reduce((sum, d) => sum + (d.upfront_usd || 0), 0);
  const avgUpfront = dealsWithUpfront.length > 0 ? totalUpfront / dealsWithUpfront.length : null;

  // Modality breakdown
  const modalityBreakdown = buildBreakdown(thisWeekDeals, 'modality');

  // Therapeutic area breakdown
  const therapeuticAreaBreakdown = buildBreakdown(thisWeekDeals, 'therapeutic_area');

  // Phase breakdown
  const phaseBreakdown = buildBreakdown(thisWeekDeals, 'phase_at_signing');

  // Notable deals — top 5 by upfront
  const notableDeals: NotableDeal[] = thisWeekDeals
    .filter((d) => d.upfront_usd != null)
    .slice(0, 5)
    .map((d) => ({
      id: d.id,
      licensor_name: d.licensor_name,
      licensee_name: d.licensee_name,
      asset_name: d.asset_name,
      modality: d.modality,
      phase_at_signing: d.phase_at_signing,
      upfront_usd: d.upfront_usd,
      total_deal_value_usd: d.total_deal_value_usd,
      announced_date: d.announced_date,
    }));

  // Benchmark changes — compare this week avg upfront by modality vs trailing 90-day avg
  const benchmarkChanges: Record<string, number> = {};
  const trailingByModality = buildBreakdown(trailingDeals, 'modality');

  for (const [modality, weekData] of Object.entries(modalityBreakdown)) {
    const trailingData = trailingByModality[modality];
    if (weekData.avg_upfront != null && trailingData?.avg_upfront != null && trailingData.avg_upfront > 0) {
      const changePct = ((weekData.avg_upfront - trailingData.avg_upfront) / trailingData.avg_upfront) * 100;
      benchmarkChanges[`${modality}_upfront_change_pct`] = Math.round(changePct * 10) / 10;
    }
  }

  // Trial updates
  const trialUpdates: TrialUpdates = {
    new_recruiting: trialChanges.filter((t) => t.status === 'recruiting').length,
    completed: trialChanges.filter((t) => t.status === 'completed').length,
    terminated: trialChanges.filter((t) => t.status === 'terminated').length,
    suspended: trialChanges.filter((t) => t.status === 'suspended').length,
  };

  // Upsert into market_snapshots
  const snapshotData = {
    snapshot_date: snapshotDate,
    snapshot_type: 'weekly',
    new_deals_count: newDealsCount,
    total_upfront_usd: totalUpfront || null,
    avg_upfront_usd: avgUpfront,
    modality_breakdown: modalityBreakdown,
    therapeutic_area_breakdown: therapeuticAreaBreakdown,
    phase_breakdown: phaseBreakdown,
    notable_deals: notableDeals,
    benchmark_changes: benchmarkChanges,
    trial_updates: trialUpdates,
  };

  const { data, error } = await supabase
    .from('market_snapshots')
    .upsert(snapshotData, { onConflict: 'snapshot_date,snapshot_type' })
    .select()
    .single();

  if (error) {
    console.error('Failed to upsert market snapshot:', error.message);
    return null;
  }

  console.log(`Weekly snapshot generated: ${newDealsCount} new deals, avg upfront $${avgUpfront ? (avgUpfront / 1e6).toFixed(1) + 'M' : 'N/A'}`);
  return data as WeeklySnapshot;
}

function buildBreakdown(
  deals: Array<Record<string, unknown>>,
  key: string
): ModalityBreakdown {
  const groups: Record<string, Array<Record<string, unknown>>> = {};

  for (const deal of deals) {
    const val = (deal[key] as string) || 'unknown';
    if (!groups[val]) groups[val] = [];
    groups[val].push(deal);
  }

  const breakdown: ModalityBreakdown = {};
  for (const [val, group] of Object.entries(groups)) {
    const withUpfront = group.filter((d) => d.upfront_usd != null && (d.upfront_usd as number) > 0);
    const totalUpfront = withUpfront.reduce((sum, d) => sum + ((d.upfront_usd as number) || 0), 0);
    const totalValue = group.reduce((sum, d) => sum + ((d.total_deal_value_usd as number) || 0), 0);

    breakdown[val] = {
      count: group.length,
      avg_upfront: withUpfront.length > 0 ? totalUpfront / withUpfront.length : null,
      total_value: totalValue > 0 ? totalValue : null,
    };
  }

  return breakdown;
}
