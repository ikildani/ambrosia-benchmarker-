/**
 * Calculator data. Incident: the calibration fetch failed silently and the
 * calculator fell back to static numbers with no signal to anyone.
 *
 * Loads active calibrations with the anon client (the browser's path and RLS
 * policy), checks the weekly calibration job is current, then runs a canary
 * calculation and bounds its output.
 */

import type { CalculationInput } from '@/lib/calculations';
import { type MonitorCheck, type CheckOutcome, ok, warn, fail, worst, hoursSince, errMsg } from '../types';

/** benchmark-calibration runs weekly (Tue 10:00 UTC). */
export const CALIBRATION_WARN_DAYS = 9;
export const CALIBRATION_FAIL_DAYS = 16;

/** Phase 2 oncology small molecule, global license: the most common calculator query. */
export const CANARY_INPUT = {
  therapeuticArea: 'oncology',
  phase: 'phase2',
  modality: 'smallMolecule',
  indication: 'solid_tumor',
  territory: 'global',
  dealType: 'licensing',
  biomarker: 'unselected',
  lineOfTherapy: '1L',
  treatmentApproach: 'diseaseModifying',
  combinationPotential: 'some',
  competitivePosition: 'firstInClass',
  dataQuality: 'strongPhase2',
  regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
} as unknown as CalculationInput;

/** $M. Static benchmarks give upfront ~$339M and total ~$2.05B for the canary. */
export const CANARY_BOUNDS = { upfront: [5, 2_000], total: [50, 20_000] } as const;

type Range = { low: number; median: number; high: number };

export function boundRange(name: string, r: Range | undefined, [min, max]: readonly [number, number]): CheckOutcome {
  if (!r || ![r.low, r.median, r.high].every(Number.isFinite)) return fail(`canary ${name} not finite`);
  if (!(r.low <= r.median && r.median <= r.high)) return fail(`canary ${name} range out of order (${r.low}/${r.median}/${r.high})`);
  if (r.median < min || r.median > max) return fail(`canary ${name} median $${r.median}M outside $${min}M-$${max}M`);
  return ok('');
}

export const calculatorDataCheck: MonitorCheck = {
  id: 'calculator_data',
  label: 'Calculator data',
  cadence: 'hourly',
  async run(ctx) {
    const parts: CheckOutcome[] = [];
    const anon = ctx.anon();
    const { count, error } = await anon
      .from('benchmark_calibrations')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    if (error) return fail(`calibrations unreadable with the anon key (calculator on static numbers): ${errMsg(error.message)}`);
    if (!count) return fail('0 active calibrations: calculator is on static numbers');

    const { data: newest } = await anon
      .from('benchmark_calibrations')
      .select('calibrated_at')
      .eq('is_active', true)
      .order('calibrated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const ageH = hoursSince((newest as { calibrated_at?: string | null } | null)?.calibrated_at, ctx.now);
    if (ageH === null) parts.push(warn('newest calibration has no calibrated_at'));
    else if (ageH > CALIBRATION_FAIL_DAYS * 24) parts.push(fail(`calibrations ${Math.round(ageH / 24)} days old (weekly job stopped)`));
    else if (ageH > CALIBRATION_WARN_DAYS * 24) parts.push(warn(`calibrations ${Math.round(ageH / 24)} days old (weekly job missed a run)`));

    let summary = '';
    try {
      await ctx.loadBenchmarks();
      const result = ctx.calculate(CANARY_INPUT);
      const up = result.terms.upfront as Range;
      const total = result.terms.totalDealValue as Range;
      parts.push(boundRange('upfront', up, CANARY_BOUNDS.upfront));
      parts.push(boundRange('total value', total, CANARY_BOUNDS.total));
      if (Number.isFinite(up?.median) && Number.isFinite(total?.median) && total.median < up.median) {
        parts.push(fail(`canary total $${total.median}M below upfront $${up.median}M`));
      }
      summary = `; canary Ph2 onc upfront $${up?.median}M, total $${total?.median}M`;
    } catch (e) {
      parts.push(fail(`canary calculation threw: ${errMsg(e)}`));
    }
    return worst(parts, `${count} active calibrations${summary}`);
  },
};
