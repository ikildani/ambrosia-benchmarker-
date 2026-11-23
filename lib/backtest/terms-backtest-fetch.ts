/**
 * Read the deal-terms backtest inputs from Supabase (read-only, service role): primary-sourced `deals_verified`
 * licenses with a disclosed upfront, and the active `benchmark_calibrations` rows.
 */
import { createClient } from '@supabase/supabase-js';
import type { BacktestDeal, BacktestFixture } from './terms-backtest-core';

export const BACKTEST_WINDOW = { from: '2023-01-01', to: '2026-09-30' };
const DEAL_COLS = 'id, licensor_name, licensee_name, therapeutic_area, modality, phase_at_signing, deal_type, territory, territories_included, upfront_usd, announced_date, source_filing_id, press_release_url';
const CAL_COLS = 'calibration_type, therapeutic_area, phase, modality, upfront_low, upfront_median, upfront_high, total_value_low, total_value_median, total_value_high, royalty_base, royalty_max, multiplier, sample_size, calibrated_at';

const present = (v: unknown) => (typeof v === 'string' ? v.trim().length > 0 : v != null);

export async function fetchBacktestFixture(window: { from: string; to: string } = BACKTEST_WINDOW): Promise<BacktestFixture & { inWindow: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const db = createClient(url, key, { auth: { persistSession: false } });

  const raw: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('deals_verified')
      .select(DEAL_COLS)
      .gt('upfront_usd', 0)
      .gte('announced_date', window.from)
      .lte('announced_date', window.to)
      .in('deal_type', ['license', 'licensing', 'collaboration', 'option'])
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    raw.push(...((data ?? []) as Array<Record<string, unknown>>));
    if (!data || data.length < 1000) break;
  }
  // Public-count rule (CLAUDE.md): only rows with a filing id or an issuer press release.
  const deals: BacktestDeal[] = raw
    .filter((d) => present(d.source_filing_id) || present(d.press_release_url))
    .map((d) => ({
      id: String(d.id),
      licensor_name: (d.licensor_name as string) ?? null,
      licensee_name: (d.licensee_name as string) ?? null,
      therapeutic_area: (d.therapeutic_area as string) ?? null,
      modality: (d.modality as string) ?? null,
      phase_at_signing: (d.phase_at_signing as string) ?? null,
      deal_type: (d.deal_type as string) ?? null,
      territory: (d.territory as string) ?? null,
      territories_included: (d.territories_included as string[]) ?? null,
      upfront_usd: Number(d.upfront_usd),
      announced_date: (d.announced_date as string) ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const { data: cals, error: calErr } = await db.from('benchmark_calibrations').select(CAL_COLS).eq('is_active', true);
  if (calErr) throw new Error(calErr.message);
  const k = (r: Record<string, unknown>) => [r.calibration_type, r.therapeutic_area, r.phase, r.modality].join('|');
  const calibrations = ((cals ?? []) as unknown as Array<Record<string, unknown>>).sort((a, b) => k(a).localeCompare(k(b)));

  return {
    snapshotAt: new Date().toISOString(),
    source: 'deals_verified (primary-sourced, disclosed upfront, license/collaboration/option) + active benchmark_calibrations',
    window,
    deals,
    calibrations,
    inWindow: raw.length,
  };
}
