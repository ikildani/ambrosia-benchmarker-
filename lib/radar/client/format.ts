/**
 * Display formatting for the Radar feed. Labels for vocabulary values come
 * from lib/radar/vocab.ts; this module only formats numbers, dates and the
 * few enumerations the vocab module does not carry.
 */

import { RADAR_PHASE_OPTIONS, RADAR_MODALITY_OPTIONS, radarLabel } from '@/lib/radar/vocab';
import type { OwnerType, PartnershipStatus } from '@/lib/radar/types';
import { RADAR_OWNER_TYPE_OPTIONS, RADAR_TRIAL_STATUS_OPTIONS, type RadarFilterState } from './filter-schema';

const SHORT_LABELS: Record<string, string> = Object.fromEntries(
  [...RADAR_PHASE_OPTIONS, ...RADAR_MODALITY_OPTIONS].map(o => [o.value, o.label]),
);

/** Short label (P2, mAb) for dense table cells; falls back to the long label. */
export function shortLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return SHORT_LABELS[value] ?? radarLabel(value);
}

export function ownerTypeLabel(v: OwnerType | string | null | undefined): string {
  return RADAR_OWNER_TYPE_OPTIONS.find(o => o.value === v)?.label ?? 'Unknown';
}

export function trialStatusLabel(v: string | null | undefined): string {
  return RADAR_TRIAL_STATUS_OPTIONS.find(o => o.value === v)?.label ?? radarLabel(v);
}

export function partnershipLabel(v: PartnershipStatus | string | null | undefined): string {
  return radarLabel(v ?? null);
}

/** Facet key → rail heading. */
export const FACET_TITLES: Record<keyof Omit<RadarFilterState, 'q' | 'phase_min' | 'phase_max' | 'min_score'>, string> = {
  region: 'Region',
  country: 'Country',
  ta: 'Therapeutic area',
  indication: 'Indication',
  modality: 'Modality',
  phase: 'Phase',
  target: 'Target',
  partnership: 'Partnership',
  ownership: 'Ownership',
  owner_type: 'Owner type',
  score_band: 'Intent score',
  trial_status: 'Trial status',
};

export function fmtScore(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return String(Math.round(n));
}

export function fmtDelta(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  const r = Math.round(n);
  if (r === 0) return '0';
  return r > 0 ? `+${r}` : `${r}`;
}

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

/** Planner estimates are approximate; say so. */
export function fmtEstimate(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  if (n < 1000) return n.toLocaleString('en-US');
  const rounded = Math.round(n / 100) * 100;
  return `about ${rounded.toLocaleString('en-US')}`;
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : DATE_FMT.format(d);
}

export function fmtRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const days = Math.round((now - t) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

/** Days until a future ISO date; negative when past. */
export function daysUntil(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - now) / 86_400_000);
}

/** $M with one decimal under 100, none above; null → "—". */
export function fmtMillions(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}B`;
  return `$${n < 100 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US')}M`;
}

export function fmtRange(low: number | null, mid: number | null, high: number | null, fmt: (n: number | null) => string): string {
  if (mid === null && low === null && high === null) return '—';
  if (low !== null && high !== null) return `${fmt(low)} – ${fmt(high)}`;
  return fmt(mid);
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n < 10 ? n.toFixed(1) : Math.round(n)}%`;
}

/** Territory list as a compact string: "Global" / "US, EU, Japan" / "—". */
export function fmtRights(rights: string[] | null | undefined): string {
  if (!rights || rights.length === 0) return '—';
  const norm = rights.map(r => r.toLowerCase());
  if (norm.includes('global') || norm.includes('worldwide')) return 'Global';
  return rights.map(r => radarLabel(r)).join(', ');
}

/** Human factor name from a licensing_signals.signal_type slug. */
export function factorLabel(slug: string): string {
  return slug.replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase());
}
