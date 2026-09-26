/**
 * Which priors a brief was priced on: the newest active benchmark calibration
 * (calibrated_at date) and the newest counterparty premium (as_of_date), as
 * one short string stored in predictions.priors_as_of (migration 136). The
 * model version stays fixed; this is what changes as outcomes feed back.
 * Never throws — a missing table or an empty one yields null on that side.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PriorsSnapshot {
  calibratedAt: string | null;
  premiumsAsOf: string | null;
}

export function formatPriorsSnapshot(s: PriorsSnapshot): string | null {
  if (!s.calibratedAt && !s.premiumsAsOf) return null;
  return `${s.calibratedAt ?? '-'}|${s.premiumsAsOf ?? '-'}`;
}

export async function readPriorsSnapshot(supabase: SupabaseClient): Promise<PriorsSnapshot> {
  const out: PriorsSnapshot = { calibratedAt: null, premiumsAsOf: null };
  try {
    const { data } = await supabase
      .from('benchmark_calibrations')
      .select('calibrated_at')
      .eq('is_active', true)
      .order('calibrated_at', { ascending: false })
      .limit(1);
    const at = (data?.[0] as { calibrated_at?: string } | undefined)?.calibrated_at;
    if (typeof at === 'string' && at) out.calibratedAt = at.slice(0, 10);
  } catch {}
  try {
    const { data } = await supabase
      .from('counterparty_premiums')
      .select('as_of_date')
      .order('as_of_date', { ascending: false })
      .limit(1);
    const at = (data?.[0] as { as_of_date?: string } | undefined)?.as_of_date;
    if (typeof at === 'string' && at) out.premiumsAsOf = at.slice(0, 10);
  } catch {}
  return out;
}

/** "2026-09-22|2026-09-26", or null when neither table has a row. */
export async function loadPriorsSnapshot(supabase: SupabaseClient): Promise<string | null> {
  return formatPriorsSnapshot(await readPriorsSnapshot(supabase));
}
