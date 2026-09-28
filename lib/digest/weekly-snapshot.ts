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

/** Rows a user-facing surface may count: the same filter as applyDealQualityFilter (lib/entities/resolve.ts). */
const DEAL_QUALITY = {
  notInStatus: '("rejected","flagged")',
} as const;

/**
 * One modality key per modality: the corpus mixes camelCase and snake_case
 * (smallMolecule / small_molecule), which split every breakdown and sparkline.
 */
export function canonicalModality(m: string | null | undefined): string {
  if (!m) return 'unknown';
  return m.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Pseudo-TAs used for routing (_codev_deals, _china_deals ...) are not therapeutic areas. */
function canonicalTA(ta: string | null | undefined): string {
  if (!ta || ta.startsWith('_')) return 'other';
  return ta;
}

function partyKey(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\b(inc|ltd|llc|plc|sa|ag|co|corp|corporation|limited|gmbh|pharmaceuticals?|pharma|therapeutics|biosciences?|biotech(nology)?|group|holdings?)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Canonical duplicates survive the quality filter (same deal ingested under two spellings,
 * or with licensor and licensee reversed). Collapse them: dedupe_group_id when set, otherwise
 * the unordered party pair plus asset. Keeps the row with the most disclosed terms.
 */
export function collapseDuplicateDeals<T extends Record<string, unknown>>(deals: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const d of deals) {
    const parties = [partyKey(d.licensor_name as string), partyKey(d.licensee_name as string)].sort().join('|');
    const asset = partyKey(d.asset_name as string);
    const key = (d.dedupe_group_id as string | null) || `${parties}|${asset}`;
    const prev = byKey.get(key);
    const score = (x: T) => (x.upfront_usd != null ? 2 : 0) + (x.total_deal_value_usd != null ? 1 : 0);
    if (!prev || score(d) > score(prev)) byKey.set(key, d);
  }
  return [...byKey.values()];
}

/**
 * Build (and upsert) the weekly snapshot for the 7 days ending on `weekEnd` (default: now).
 * Pass an earlier `weekEnd` to recompute a past week once late-ingested deals arrive.
 */
export async function generateWeeklySnapshot(
  supabase: SupabaseClient,
  opts: { weekEnd?: Date } = {},
): Promise<WeeklySnapshot | null> {
  const now = opts.weekEnd ?? new Date();
  const snapshotDate = now.toISOString().split('T')[0];
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Fetch this week's deals and trailing 90-day deals in parallel.
  // R68 + quality filter: no synthetic, non-canonical, rejected or flagged rows in user digests.
  const [thisWeekResult, trailingResult, trialUpdatesResult] = await Promise.all([
    supabase
      .from('deals')
      .select('*')
      .eq('is_synthetic', false)
      .not('is_canonical', 'is', false)
      .not('verification_status', 'in', DEAL_QUALITY.notInStatus)
      .gte('announced_date', weekAgo)
      .lte('announced_date', snapshotDate)
      .order('upfront_usd', { ascending: false, nullsFirst: false }),

    supabase
      .from('deals')
      .select('licensor_name, licensee_name, asset_name, dedupe_group_id, modality, therapeutic_area, phase_at_signing, upfront_usd, total_deal_value_usd')
      .eq('is_synthetic', false)
      .not('is_canonical', 'is', false)
      .not('verification_status', 'in', DEAL_QUALITY.notInStatus)
      .gte('announced_date', ninetyDaysAgo)
      .lt('announced_date', weekAgo),

    supabase
      .from('company_trials')
      .select('status')
      .gte('last_update_posted', weekAgo)
      .lte('last_update_posted', snapshotDate),
  ]);

  // A failed query must not publish a zero-deal week.
  if (thisWeekResult.error) throw new Error(`weekly snapshot: deals query failed: ${thisWeekResult.error.message}`);
  if (trailingResult.error) throw new Error(`weekly snapshot: trailing deals query failed: ${trailingResult.error.message}`);

  const normalize = <T extends Record<string, unknown>>(rows: T[]) =>
    collapseDuplicateDeals(rows).map((d) => ({
      ...d,
      modality: canonicalModality(d.modality as string),
      therapeutic_area: canonicalTA(d.therapeutic_area as string),
    }));
  const thisWeekDeals = normalize((thisWeekResult.data || []) as Array<Record<string, unknown>>)
    .sort((a, b) => ((b.upfront_usd as number) ?? -1) - ((a.upfront_usd as number) ?? -1)) as Array<Record<string, any>>;
  const trailingDeals = normalize((trailingResult.data || []) as Array<Record<string, unknown>>);
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
    .filter((d) => d.upfront_usd != null && d.upfront_usd > 0)
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
