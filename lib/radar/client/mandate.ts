/**
 * Mandate ⇄ filter state conversion. A mandate is a saved filter set with
 * notification preferences (radar_user_mandates, migration 092). Columns
 * that the mandate table does not have (owner type, trial status, target,
 * indication, score band, free text) are reported by `unsavedFilterKeys`
 * so the save dialog can say what will not be kept.
 */

import { RADAR_PHASE_OPTIONS, RADAR_PHASE_RANK } from '@/lib/radar/vocab';
import { EMPTY_FILTERS, type RadarFilterState } from './filter-schema';
import type { RadarMandate } from './api-types';

export type DigestFrequency = RadarMandate['digest_frequency'];

/** Fields the mandate routes accept (app/api/radar/_lib/mandate-schema.ts). */
export interface MandateFields {
  name: string;
  description?: string | null;
  is_active?: boolean;
  therapeutic_areas: string[];
  modalities: string[];
  phase_min: string | null;
  phase_max: string | null;
  countries: string[];
  regions: string[];
  partnership_statuses: string[];
  min_licensing_intent: number;
  min_deal_readiness?: number;
  min_confidence?: number;
  notify_email: boolean;
  notify_in_app: boolean;
  digest_frequency: DigestFrequency;
}

export function mandateToFilters(m: Pick<
  RadarMandate,
  'therapeutic_areas' | 'modalities' | 'phase_min' | 'phase_max' | 'countries' | 'regions' | 'partnership_statuses' | 'min_licensing_intent'
>): RadarFilterState {
  return {
    ...EMPTY_FILTERS,
    ta: m.therapeutic_areas ?? [],
    modality: m.modalities ?? [],
    phase_min: m.phase_min ?? null,
    phase_max: m.phase_max ?? null,
    country: m.countries ?? [],
    region: m.regions ?? [],
    partnership: m.partnership_statuses ?? [],
    min_score: m.min_licensing_intent > 0 ? Number(m.min_licensing_intent) : null,
  };
}

/** Lowest and highest phase in an explicit phase selection, for mandates that only store a range. */
function phaseRangeOf(phases: string[]): { min: string | null; max: string | null } {
  if (!phases.length) return { min: null, max: null };
  const ranked = [...phases].sort((a, b) => (RADAR_PHASE_RANK[a] ?? 0) - (RADAR_PHASE_RANK[b] ?? 0));
  return { min: ranked[0], max: ranked[ranked.length - 1] };
}

export function filtersToMandateFields(
  f: RadarFilterState,
  meta: { name: string; notify_email: boolean; notify_in_app: boolean; digest_frequency: DigestFrequency; description?: string | null },
): MandateFields {
  const range = f.phase_min || f.phase_max ? { min: f.phase_min, max: f.phase_max } : phaseRangeOf(f.phase);
  return {
    name: meta.name,
    description: meta.description ?? null,
    therapeutic_areas: f.ta,
    modalities: f.modality,
    phase_min: range.min,
    phase_max: range.max,
    countries: f.country,
    regions: f.region,
    partnership_statuses: f.partnership,
    min_licensing_intent: f.min_score ?? 0,
    notify_email: meta.notify_email,
    notify_in_app: meta.notify_in_app,
    digest_frequency: meta.digest_frequency,
  };
}

/** Filter keys that are active but have no mandate column, in display order. */
export function unsavedFilterKeys(f: RadarFilterState): (keyof RadarFilterState)[] {
  const out: (keyof RadarFilterState)[] = [];
  if (f.q) out.push('q');
  if (f.owner_type.length) out.push('owner_type');
  if (f.ownership.length) out.push('ownership');
  if (f.trial_status.length) out.push('trial_status');
  if (f.indication.length) out.push('indication');
  if (f.target.length) out.push('target');
  if (f.score_band.length) out.push('score_band');
  // A non-contiguous phase pick collapses to its min..max range.
  if (f.phase.length && !f.phase_min && !f.phase_max) {
    const { min, max } = phaseRangeOf(f.phase);
    const span = RADAR_PHASE_OPTIONS.filter(o => {
      const r = RADAR_PHASE_RANK[o.value];
      return r >= (RADAR_PHASE_RANK[min ?? ''] ?? 0) && r <= (RADAR_PHASE_RANK[max ?? ''] ?? 0);
    });
    if (span.length !== f.phase.length) out.push('phase');
  }
  return out;
}

/** Human summary of a mandate for the switcher and first-run list, e.g. "Oncology, Neurology · ADC · P2 to P3 · Unpartnered". */
export function mandateSummary(m: RadarMandate, label: (v: string | null | undefined) => string): string {
  const parts: string[] = [];
  if (m.therapeutic_areas?.length) parts.push(m.therapeutic_areas.map(label).join(', '));
  if (m.modalities?.length) parts.push(m.modalities.map(label).join(', '));
  if (m.phase_min || m.phase_max) {
    const lo = m.phase_min ? label(m.phase_min) : 'Any';
    const hi = m.phase_max ? label(m.phase_max) : 'Any';
    parts.push(m.phase_min && m.phase_max && m.phase_min === m.phase_max ? lo : `${lo} to ${hi}`);
  }
  if (m.countries?.length) parts.push(m.countries.join(', '));
  else if (m.regions?.length) parts.push(m.regions.map(label).join(', '));
  if (m.partnership_statuses?.length && m.partnership_statuses.length < 3) parts.push(m.partnership_statuses.map(label).join(', '));
  if (m.min_licensing_intent > 0) parts.push(`Score ${m.min_licensing_intent}+`);
  return parts.length ? parts.join(' · ') : 'All assets';
}
