/**
 * Asset Radar — score presentation helpers (pure).
 *
 * The v3 licensing-intent score is a calibrated 12-month probability × 100
 * × availability, so most of the universe scores under 15. These helpers
 * produce what makes that readable and are persisted by the scoring wave
 * (migration 126): the top drivers with their evidence, and an 80% interval
 * of the observed licensing rate in the asset's calibration bin.
 */

import type { ScoreFactorContribution } from '@/lib/radar/types';

export interface ScoreDriver {
  factor: string;
  /** Points toward the composite (v2) or logit units (v3); sign kept. */
  points: number;
  evidence: string | null;
  url: string | null;
  date: string | null;
}

/** Top `n` contributions by absolute points, excluding the model intercept and zero rows. */
export function topDrivers(contributions: readonly ScoreFactorContribution[], n = 3): ScoreDriver[] {
  return contributions
    .filter(c => c.factor !== 'intercept' && Number.isFinite(c.points) && c.points !== 0)
    .slice()
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, n)
    .map(c => ({
      factor: c.factor,
      points: Math.round(c.points * 100) / 100,
      evidence: c.evidence_text ? c.evidence_text.slice(0, 240) : null,
      url: c.evidence_url ?? null,
      date: c.evidence_date ?? null,
    }));
}

export interface CalibrationBin {
  /** "0.0-0.1" style label from the backtest harness. */
  bin: string;
  predicted: number;
  observed: number;
  n: number;
}

export interface ScoreInterval {
  lo: number;
  hi: number;
  n: number;
  bin: string;
}

/** Bins with fewer test rows than this say nothing useful. */
export const INTERVAL_MIN_N = 30;

/** Wilson score interval for a binomial proportion. z = 1.2816 for 80%. */
export function wilsonInterval(successes: number, n: number, z = 1.2816): { lo: number; hi: number } {
  if (n <= 0) return { lo: 0, hi: 1 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

function parseBin(label: string): { lo: number; hi: number } | null {
  const m = /^\s*([0-9.]+)\s*-\s*([0-9.]+)\s*$/.exec(label);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = Number(m[2]);
  return Number.isFinite(lo) && Number.isFinite(hi) && hi > lo ? { lo, hi } : null;
}

/**
 * 80% interval of the observed licensing rate among backtest rows that were
 * scored like this asset (same calibration bin). Null when there is no
 * backtest, the probability falls in no bin, or the bin has < INTERVAL_MIN_N
 * rows. `observed` in the harness is a rate, so successes = observed × n.
 */
export function intervalFromBins(probability: number | null | undefined, bins: readonly CalibrationBin[] | null | undefined): ScoreInterval | null {
  if (probability === null || probability === undefined || !Number.isFinite(probability) || !bins?.length) return null;
  for (const b of bins) {
    const range = parseBin(b.bin);
    if (!range) continue;
    const inBin = probability >= range.lo && (probability < range.hi || (range.hi >= 1 && probability <= 1));
    if (!inBin) continue;
    if (!Number.isFinite(b.n) || b.n < INTERVAL_MIN_N) return null;
    const successes = Math.max(0, Math.min(b.n, Math.round(b.observed * b.n)));
    const { lo, hi } = wilsonInterval(successes, b.n);
    return { lo: Math.round(lo * 1e5) / 1e5, hi: Math.round(hi * 1e5) / 1e5, n: b.n, bin: b.bin };
  }
  return null;
}
