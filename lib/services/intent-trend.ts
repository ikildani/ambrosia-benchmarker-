import { createServiceClient } from '@/lib/supabase/server';

export interface IntentTrendResult {
  trend: 'rising' | 'stable' | 'declining';
  delta: number;
  dataPoints: number;
}

/**
 * Get the intent trend for a specific company/modality/indication
 * by comparing the last 3 snapshots.
 */
export async function getIntentTrend(
  supabase: ReturnType<typeof createServiceClient>,
  companyId: string,
  modality: string,
  indication: string
): Promise<IntentTrendResult> {
  const { data: snapshots, error } = await supabase
    .from('intent_score_snapshots')
    .select('intent_score, snapshot_date')
    .eq('company_id', companyId)
    .eq('modality', modality)
    .eq('indication', indication)
    .order('snapshot_date', { ascending: false })
    .limit(3);

  if (error || !snapshots || snapshots.length < 2) {
    return { trend: 'stable', delta: 0, dataPoints: snapshots?.length ?? 0 };
  }

  const newest = snapshots[0].intent_score;
  const oldest = snapshots[snapshots.length - 1].intent_score;
  const delta = newest - oldest;

  let trend: 'rising' | 'stable' | 'declining';
  if (delta >= 5) trend = 'rising';
  else if (delta <= -5) trend = 'declining';
  else trend = 'stable';

  return { trend, delta, dataPoints: snapshots.length };
}
