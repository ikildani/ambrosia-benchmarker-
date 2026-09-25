'use client';

/**
 * Left facet rail with counts. Each facet is a Headless UI Disclosure with
 * a checkbox list; counts come from /api/radar/facets for the current
 * filter set. On mobile the same rail renders inside a Dialog drawer.
 */

import { Fragment, useMemo, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Disclosure, DisclosureButton, DisclosurePanel, Transition, TransitionChild } from '@headlessui/react';
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { radarLabel, RADAR_PHASE_OPTIONS } from '@/lib/radar/vocab';
import {
  facetOptions,
  type MultiFacetKey,
  type RadarFilterState,
} from '@/lib/radar/client/filter-schema';
import type { FacetBucket, FacetsResponse } from '@/lib/radar/client/api-types';
import { FACET_TITLES, fmtInt, ownerTypeLabel, trialStatusLabel } from '@/lib/radar/client/format';
import type { LoadStatus } from '@/lib/radar/client/hooks';
import { usePrefersReducedMotion } from '@/lib/radar/client/hooks';
import { BTN_GHOST, FOCUS_RING, Pill, SectionLabel, Skeleton, cn } from './ui';

const RAIL_ORDER: MultiFacetKey[] = [
  'region',
  'country',
  'ta',
  'indication',
  'modality',
  'phase',
  'target',
  'partnership',
  'ownership',
  'owner_type',
  'score_band',
  'trial_status',
];

const OPEN_BY_DEFAULT = new Set<MultiFacetKey>(['region', 'ta', 'modality', 'phase', 'partnership', 'ownership', 'score_band']);
const COLLAPSED_ROWS = 7;

export interface FacetRailProps {
  filters: RadarFilterState;
  facets: FacetsResponse['facets'] | null;
  status: LoadStatus;
  onToggle: (key: MultiFacetKey, value: string) => void;
  onClearFacet: (key: MultiFacetKey) => void;
  onPhaseRange: (min: string | null, max: string | null) => void;
  onMinScore: (value: number | null) => void;
}

function labelFor(key: MultiFacetKey, value: string): string {
  switch (key) {
    case 'owner_type':
      return ownerTypeLabel(value);
    case 'trial_status':
      return trialStatusLabel(value);
    case 'target':
    case 'indication':
      return key === 'indication' ? radarLabel(value) : value;
    case 'score_band':
      return value;
    default:
      return radarLabel(value);
  }
}

/** Buckets in display order: vocabulary order for closed facets, count order for open ones; selected values always shown. */
function orderedBuckets(key: MultiFacetKey, buckets: FacetBucket[] | undefined, selected: string[]): FacetBucket[] {
  const byValue = new Map((buckets ?? []).map(b => [b.value, b]));
  const vocab = facetOptions(key);
  const list: FacetBucket[] = [];
  if (vocab) {
    for (const o of vocab) {
      const b = byValue.get(o.value);
      if (b) list.push(b);
      else if (selected.includes(o.value)) list.push({ value: o.value, count: 0 });
    }
    // Country: vocab ordering by asset count is stale; re-sort by live count but keep selected first.
    if (key === 'country') list.sort((a, b) => b.count - a.count);
  } else {
    list.push(...(buckets ?? []));
    for (const v of selected) if (!byValue.has(v)) list.push({ value: v, count: 0 });
  }
  return list.sort((a, b) => Number(selected.includes(b.value)) - Number(selected.includes(a.value)));
}

export function FacetRail(props: FacetRailProps) {
  const { filters, facets, status, onToggle, onClearFacet, onPhaseRange, onMinScore } = props;
  const loading = status === 'loading' && !facets;

  return (
    <div className="space-y-1">
      <div className="px-1 pb-2">
        <SectionLabel>Phase range</SectionLabel>
        <PhaseRange min={filters.phase_min} max={filters.phase_max} onChange={onPhaseRange} />
      </div>
      <div className="px-1 pb-3">
        <SectionLabel>Minimum score</SectionLabel>
        <MinScore value={filters.min_score} onChange={onMinScore} />
      </div>

      {RAIL_ORDER.map(key => {
        const selected = filters[key];
        const buckets = orderedBuckets(key, facets?.[key], selected);
        return (
          <FacetGroup
            key={key}
            title={FACET_TITLES[key]}
            defaultOpen={OPEN_BY_DEFAULT.has(key) || selected.length > 0}
            selectedCount={selected.length}
            onClear={() => onClearFacet(key)}
          >
            {loading ? (
              <div className="space-y-2 py-1">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={`f-${key}-${i}`} className="h-3.5 w-full" />
                ))}
              </div>
            ) : buckets.length === 0 ? (
              <p className="py-1 text-xs text-neutral-500">Nothing in the current set</p>
            ) : (
              <BucketList facetKey={key} buckets={buckets} selected={selected} onToggle={onToggle} />
            )}
          </FacetGroup>
        );
      })}
    </div>
  );
}

function FacetGroup({
  title,
  defaultOpen,
  selectedCount,
  onClear,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  selectedCount: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div className="border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center">
            <DisclosureButton
              className={cn(
                'flex flex-1 items-center justify-between rounded px-1 py-2 text-left text-xs font-semibold text-neutral-800 hover:text-neutral-900 dark:text-neutral-200 dark:hover:text-neutral-100',
                FOCUS_RING,
              )}
            >
              <span>
                {title}
                {selectedCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-teal-600 px-1.5 text-[11px] font-semibold text-white">{selectedCount}</span>
                )}
              </span>
              <ChevronDownIcon className={cn('h-4 w-4 text-neutral-500 transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
            </DisclosureButton>
            {selectedCount > 0 && (
              <button type="button" onClick={onClear} className={cn(BTN_GHOST, 'px-2 py-1 text-[11px]')} aria-label={`Clear ${title}`}>
                Clear
              </button>
            )}
          </div>
          <DisclosurePanel className="pb-2">{children}</DisclosurePanel>
        </div>
      )}
    </Disclosure>
  );
}

function BucketList({
  facetKey,
  buckets,
  selected,
  onToggle,
}: {
  facetKey: MultiFacetKey;
  buckets: FacetBucket[];
  selected: string[];
  onToggle: (key: MultiFacetKey, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const searchable = buckets.length > 12;
  const filtered = useMemo(() => {
    if (!query) return buckets;
    const q = query.toLowerCase();
    return buckets.filter(b => labelFor(facetKey, b.value).toLowerCase().includes(q) || b.value.toLowerCase().includes(q));
  }, [buckets, query, facetKey]);
  const shown = expanded || query ? filtered : filtered.slice(0, COLLAPSED_ROWS);
  const hidden = filtered.length - shown.length;

  return (
    <div>
      {searchable && (
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Find ${FACET_TITLES[facetKey].toLowerCase()}`}
          aria-label={`Find ${FACET_TITLES[facetKey].toLowerCase()}`}
          className={cn(
            'mb-1.5 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100',
            FOCUS_RING,
          )}
        />
      )}
      <ul className="space-y-0.5" aria-label={FACET_TITLES[facetKey]}>
        {shown.map(b => {
          const checked = selected.includes(b.value);
          const id = `facet-${facetKey}-${b.value.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
          return (
            <li key={b.value}>
              <label
                htmlFor={id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800',
                  checked ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-700 dark:text-neutral-300',
                )}
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(facetKey, b.value)}
                  className={cn('h-3.5 w-3.5 rounded border-neutral-400 text-teal-600 dark:border-neutral-600 dark:bg-neutral-900', FOCUS_RING)}
                />
                <span className="flex-1 truncate" title={labelFor(facetKey, b.value)}>
                  {labelFor(facetKey, b.value)}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-neutral-500">{fmtInt(b.count)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className={cn(BTN_GHOST, 'mt-1 px-1 py-0.5 text-[11px]')}>
          Show {hidden} more
        </button>
      )}
      {expanded && !query && buckets.length > COLLAPSED_ROWS && (
        <button type="button" onClick={() => setExpanded(false)} className={cn(BTN_GHOST, 'mt-1 px-1 py-0.5 text-[11px]')}>
          Show fewer
        </button>
      )}
    </div>
  );
}

function PhaseRange({ min, max, onChange }: { min: string | null; max: string | null; onChange: (min: string | null, max: string | null) => void }) {
  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Minimum phase">
        <span className="w-8 self-center text-[11px] text-neutral-600 dark:text-neutral-400">From</span>
        {RADAR_PHASE_OPTIONS.map(o => (
          <Pill key={`min-${o.value}`} size="sm" active={min === o.value} onClick={() => onChange(min === o.value ? null : o.value, max)} title={o.longLabel ?? o.label}>
            {o.label}
          </Pill>
        ))}
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Maximum phase">
        <span className="w-8 self-center text-[11px] text-neutral-600 dark:text-neutral-400">To</span>
        {RADAR_PHASE_OPTIONS.map(o => (
          <Pill key={`max-${o.value}`} size="sm" active={max === o.value} onClick={() => onChange(min, max === o.value ? null : o.value)} title={o.longLabel ?? o.label}>
            {o.label}
          </Pill>
        ))}
      </div>
    </div>
  );
}

const SCORE_STEPS = [20, 40, 60, 80];

function MinScore({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Minimum licensing intent score">
      <Pill size="sm" active={value === null} onClick={() => onChange(null)}>
        Any
      </Pill>
      {SCORE_STEPS.map(s => (
        <Pill key={s} size="sm" active={value === s} onClick={() => onChange(value === s ? null : s)}>
          {s}+
        </Pill>
      ))}
    </div>
  );
}

/** Mobile: the rail inside a slide-over Dialog. */
export function FacetDrawer({ open, onClose, ...rail }: FacetRailProps & { open: boolean; onClose: () => void }) {
  const reduced = usePrefersReducedMotion();
  const dur = reduced ? 'duration-0' : 'duration-200';
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50 lg:hidden">
        <TransitionChild
          as={Fragment}
          enter={`ease-out ${dur}`}
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave={`ease-in ${dur}`}
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-neutral-950/50" aria-hidden />
        </TransitionChild>
        <div className="fixed inset-0 flex justify-start">
          <TransitionChild
            as={Fragment}
            enter={`ease-out ${dur}`}
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave={`ease-in ${dur}`}
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <DialogPanel className="flex h-full w-[min(22rem,90vw)] flex-col bg-white shadow-xl dark:bg-neutral-900">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                <DialogTitle className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Filters</DialogTitle>
                <button type="button" onClick={onClose} aria-label="Close filters" className={cn(BTN_GHOST, 'p-1.5')}>
                  <XMarkIcon className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <FacetRail {...rail} />
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

