/**
 * Search & Evaluation — the words next to a score. Pure, shared by the feed, the
 * asset page, compare and export so every surface says the same thing.
 *
 * The score is a calibrated 12-month probability × 100 × availability, so
 * almost everything scores under 15; the fair comparison is the percentile
 * within the asset's peers (phase × therapeutic area). Colour and rank
 * language come from the percentile, never from the raw number.
 */

import { radarLabel } from '@/lib/radar/vocab';

export interface ScorePresentation {
  score: number | null;
  probability?: number | null;
  pct_peer?: number | null;
  peer_n?: number | null;
  peer_key?: string | null;
  pct_universe?: number | null;
  base_rate?: number | null;
  low_power?: boolean | null;
}

/** "Phase 2 oncology" from 'phase_2|oncology'; null for unknown parts. */
export function peerGroupLabel(peerKey: string | null | undefined): string | null {
  if (!peerKey) return null;
  const [phase, ta] = peerKey.split('|');
  const parts: string[] = [];
  if (phase && phase !== 'unknown') parts.push(radarLabel(phase).replace(' / Approved', ''));
  if (ta && ta !== 'unknown') parts.push(radarLabel(ta).toLowerCase());
  return parts.length ? parts.join(' ') : null;
}

/** "Top 3%" / "Top half" / "Bottom 40%" phrasing from a percent rank (0 = lowest). */
export function rankPhrase(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  const top = Math.max(1, Math.round(100 - pct));
  if (top <= 25) return `Top ${top}%`;
  if (top <= 50) return 'Top half';
  return `Bottom ${Math.min(99, Math.round(100 - top + 1))}%`;
}

/** "Top 3% of Phase 2 oncology (n=412)" or null when the asset is not ranked. */
export function percentileLabel(p: ScorePresentation, opts: { withN?: boolean } = {}): string | null {
  const rank = rankPhrase(p.pct_peer);
  if (!rank) return null;
  const group = peerGroupLabel(p.peer_key);
  const n = opts.withN && p.peer_n ? ` (n=${p.peer_n.toLocaleString('en-US')})` : '';
  return group ? `${rank} of ${group}${n}` : `${rank} of peers${n}`;
}

/** Why the asset has no percentile. */
export function unrankedReason(p: ScorePresentation): string {
  if (p.score === null || p.score === undefined) return 'Not yet scored';
  return 'Not ranked: outside the core universe (partnered, approved, or not an owned program)';
}

function fmtPct(x: number, digits = 1): string {
  const v = 100 * x;
  if (v < 0.05) return '<0.1%';
  return `${v.toFixed(v < 10 ? digits : 0)}%`;
}

/** "3.2% chance of a licensing deal within 12 months (peers average 0.8%)". */
export function probabilityLabel(p: ScorePresentation): string | null {
  if (p.probability === null || p.probability === undefined || !Number.isFinite(p.probability)) return null;
  const base = p.base_rate !== null && p.base_rate !== undefined && Number.isFinite(p.base_rate) ? ` (peers average ${fmtPct(p.base_rate)})` : '';
  return `${fmtPct(p.probability)} chance of a licensing deal within 12 months${base}`;
}

/** Multiple of the peer base rate, e.g. "4.2× peers"; null when either side is missing or tiny. */
export function baseRateMultiple(p: ScorePresentation): string | null {
  if (!p.probability || !p.base_rate || p.base_rate < 1e-6) return null;
  const m = p.probability / p.base_rate;
  if (!Number.isFinite(m)) return null;
  return `${m >= 10 ? Math.round(m) : m.toFixed(1)}× peers`;
}

export type ScoreToneKey = 'high' | 'mid' | 'neutral' | 'none';

/** Tone from the peer percentile (top 10% high, top 25% mid); raw score only when unranked and ≥ 40. */
export function scoreToneKey(p: ScorePresentation): ScoreToneKey {
  if (p.score === null || p.score === undefined) return 'none';
  if (p.pct_peer !== null && p.pct_peer !== undefined) {
    if (p.pct_peer >= 90) return 'high';
    if (p.pct_peer >= 75) return 'mid';
    return 'neutral';
  }
  return p.score >= 40 ? 'mid' : 'neutral';
}

/** One sentence for legends and tooltips. */
export const SCORE_LEGEND =
  'The score is a calibrated 12-month licensing probability × 100. Most programs score under 15, so the percentile within the peer group is the fair comparison.';

export const LOW_POWER_NOTE =
  'Validated on fewer than 30 announced deals: read the score as a relative rank, not a probability.';
