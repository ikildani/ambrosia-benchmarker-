'use client';

import { radarLabel } from '@/lib/radar/vocab';
import { MULTI_FACET_KEYS, countActiveFilters, type RadarFilterState } from '@/lib/radar/client/filter-schema';
import { FACET_TITLES, ownerTypeLabel, trialStatusLabel } from '@/lib/radar/client/format';
import type { RadarAction } from '@/lib/radar/client/use-radar-state';
import { Chip, BTN_GHOST } from './ui';

function valueLabel(key: keyof RadarFilterState, value: string): string {
  switch (key) {
    case 'owner_type':
      return ownerTypeLabel(value);
    case 'trial_status':
      return trialStatusLabel(value);
    case 'target':
    case 'indication':
      return value;
    case 'score_band':
      return `Score ${value}`;
    default:
      return radarLabel(value);
  }
}

/** Active filters as removable chips, in facet order, with a clear-all. */
export function FilterChips({ filters, dispatch }: { filters: RadarFilterState; dispatch: (a: RadarAction) => void }) {
  const active = countActiveFilters(filters);
  if (active === 0) return null;

  const chips: { key: keyof RadarFilterState; value?: string; label: string; title: string }[] = [];
  if (filters.q) chips.push({ key: 'q', label: `"${filters.q}"`, title: 'Search text' });
  if (filters.phase_min || filters.phase_max) {
    const lo = filters.phase_min ? radarLabel(filters.phase_min) : 'Any';
    const hi = filters.phase_max ? radarLabel(filters.phase_max) : 'Any';
    chips.push({ key: 'phase_min', label: `Phase ${lo} to ${hi}`, title: 'Phase range' });
  }
  if (filters.min_score !== null) chips.push({ key: 'min_score', label: `Score ${filters.min_score}+`, title: 'Minimum intent score' });
  for (const key of MULTI_FACET_KEYS) {
    for (const v of filters[key]) chips.push({ key, value: v, label: valueLabel(key, v), title: FACET_TITLES[key] });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {chips.map(c => (
        <Chip
          key={`${c.key}:${c.value ?? ''}`}
          label={c.label}
          title={c.title}
          onRemove={() => {
            if (c.key === 'phase_min') {
              dispatch({ type: 'set_phase_range', min: null, max: null });
            } else {
              dispatch({ type: 'remove_filter', key: c.key, value: c.value });
            }
          }}
        />
      ))}
      {active > 1 && (
        <button type="button" onClick={() => dispatch({ type: 'clear_filters' })} className={BTN_GHOST}>
          Clear all
        </button>
      )}
    </div>
  );
}
