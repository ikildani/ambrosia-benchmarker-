'use client';

/**
 * Left filter rail. Grouped the way a BD user thinks about a program
 * (science, stage, geography, deal, signal), one type scale throughout
 * (13px labels, 11px counts), and a proportion bar behind every count so
 * the shape of the current result set is visible at a glance. Counts come
 * from /api/radar/facets for the current filters. On mobile the same rail
 * renders inside a Dialog drawer.
 */

import { Fragment, useMemo, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Disclosure, DisclosureButton, DisclosurePanel, Transition, TransitionChild } from '@headlessui/react';
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { radarLabel } from '@/lib/radar/vocab';
import { facetOptions, type MultiFacetKey, type RadarFilterState } from '@/lib/radar/client/filter-schema';
import type { FacetBucket, FacetsResponse } from '@/lib/radar/client/api-types';
import { FACET_TITLES, fmtInt, ownerTypeLabel, trialStatusLabel } from '@/lib/radar/client/format';
import type { LoadStatus } from '@/lib/radar/client/hooks';
import { usePrefersReducedMotion } from '@/lib/radar/client/hooks';
import { StageTrack } from './MandateForm';
import { BTN_GHOST, FOCUS_RING, Skeleton, cn } from './ui';

const GROUPS: Array<{ title: string; keys: MultiFacetKey[] }> = [
  { title: 'Science', keys: ['ta', 'indication', 'modality', 'target'] },
  { title: 'Geography', keys: ['region', 'country'] },
  { title: 'Deal', keys: ['rights', 'partnership', 'ownership', 'owner_type'] },
  { title: 'Signal', keys: ['trial_status'] },
  { title: 'Companies', keys: ['company'] },
];

const OPEN_BY_DEFAULT = new Set<MultiFacetKey>(['ta', 'modality', 'region', 'rights']);
const COLLAPSED_ROWS = 6;

export interface FacetRailProps {
  filters: RadarFilterState;
  facets: FacetsResponse['facets'] | null;
  status: LoadStatus;
  onToggle: (key: MultiFacetKey, value: string) => void;
  onClearFacet: (key: MultiFacetKey) => void;
  onPhaseRange: (min: string | null, max: string | null) => void;
  onMinScore: (value: number | null) => void;
  onTopPct?: (value: number | null) => void;
  onClearAll?: () => void;
  activeCount?: number;
  /** Replace a facet's values (used by the academic switch). */
  onSetFacet?: (key: MultiFacetKey, values: string[]) => void;
}

const RIGHTS_LABELS: Record<string, string> = Object.fromEntries((facetOptions('rights') ?? []).map(o => [o.value, o.label]));

function labelFor(key: MultiFacetKey, value: string): string {
  switch (key) {
    case 'owner_type': return ownerTypeLabel(value);
    case 'trial_status': return trialStatusLabel(value);
    case 'target':
    case 'company': return value;
    case 'score_band': return value;
    case 'rights': return RIGHTS_LABELS[value] ?? value;
    case 'country': return facetOptions('country')?.find(o => o.value === value)?.label ?? value;
    default: return radarLabel(value);
  }
}

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
    // Vocab order is meaningful for stage-like facets and rights; everything else by live count.
    if (key !== 'rights' && key !== 'score_band' && key !== 'partnership') list.sort((a, b) => b.count - a.count);
  } else {
    list.push(...(buckets ?? []));
    for (const v of selected) if (!byValue.has(v)) list.push({ value: v, count: 0 });
  }
  return list.sort((a, b) => Number(selected.includes(b.value)) - Number(selected.includes(a.value)));
}

export function FacetRail(props: FacetRailProps) {
  const { filters, facets, status, onToggle, onClearFacet, onPhaseRange, onClearAll, activeCount = 0, onSetFacet, onTopPct } = props;
  const academicOn = ['academic', 'hospital'].every(v => filters.owner_type.includes(v));
  const academicCount = (facets?.owner_type ?? []).filter(b => b.value === 'academic' || b.value === 'hospital').reduce((n, b) => n + b.count, 0);
  const loading = status === 'loading' && !facets;

  return (
    <div className="text-neutral-800 dark:text-neutral-200">
      <div className="flex items-center justify-between pb-3">
        <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
          Filters
          {activeCount > 0 && <span className="ml-1.5 rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{activeCount}</span>}
        </p>
        {activeCount > 0 && onClearAll && (
          <button type="button" onClick={onClearAll} className={cn(BTN_GHOST, 'px-2 py-1 text-[12px]')}>Clear all</button>
        )}
      </div>

      {/* Stage */}
      <RailSection title="Stage">
        <div className="rounded-lg border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900">
          <StageTrack compact filters={filters} buckets={facets?.phase} onChange={onPhaseRange} />
        </div>
      </RailSection>

      {GROUPS.map(group => (
        <RailSection key={group.title} title={group.title}>
          {group.title === 'Deal' && onSetFacet && (
            <label className="mb-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200 p-2.5 dark:border-neutral-800">
              <button
                type="button"
                role="switch"
                aria-checked={academicOn}
                onClick={() => onSetFacet('owner_type', academicOn ? [] : ['industry', 'academic', 'hospital'])}
                className={cn('relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors motion-reduce:transition-none', academicOn ? 'bg-teal-600' : 'bg-neutral-300 dark:bg-neutral-700', FOCUS_RING)}
              >
                <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform motion-reduce:transition-none', academicOn ? 'translate-x-4' : 'translate-x-0.5')} />
              </button>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-neutral-800 dark:text-neutral-200">Include academic & hospital</span>
                <span className="block text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">{academicCount ? `${fmtInt(academicCount)} programs. ` : ''}Mostly investigator-led studies; off by default.</span>
              </span>
            </label>
          )}
          {group.keys.map(key => {
            const selected = filters[key];
            const buckets = orderedBuckets(key, facets?.[key], selected);
            return (
              <FacetGroup key={key} title={FACET_TITLES[key]} defaultOpen={OPEN_BY_DEFAULT.has(key) || selected.length > 0} selectedCount={selected.length} onClear={() => onClearFacet(key)}>
                {loading ? (
                  <div className="space-y-1.5 py-1">{Array.from({ length: 4 }, (_, i) => <Skeleton key={`f-${key}-${i}`} className="h-6 w-full" />)}</div>
                ) : buckets.length === 0 ? (
                  <p className="py-1 text-[12px] text-neutral-500">Nothing in the current set</p>
                ) : (
                  <BucketList facetKey={key} buckets={buckets} selected={selected} onToggle={onToggle} />
                )}
                {key === 'rights' && (
                  <p className="mt-1.5 text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">Worldwide means no partner was found. Split unconfirmed means partnered in part, territories not yet known.</p>
                )}
              </FacetGroup>
            );
          })}
          {group.title === 'Signal' && onTopPct && (
            <div className="pb-1">
              <p className="mb-1.5 text-[12px] font-medium text-neutral-700 dark:text-neutral-300">Licensing intent, rank among peers</p>
              <Segmented
                value={filters.top_pct === null ? 'any' : String(filters.top_pct)}
                options={[{ value: 'any', label: 'Any' }, { value: '25', label: 'Top 25%' }, { value: '10', label: 'Top 10%' }, { value: '5', label: 'Top 5%' }]}
                onChange={v => onTopPct(v === 'any' ? null : Number(v))}
              />
              <p className="mt-1.5 text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">Peers share the asset's phase and therapeutic area.</p>
            </div>
          )}
        </RailSection>
      ))}
    </div>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-neutral-200 py-3 dark:border-neutral-800" aria-label={title}>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800" role="radiogroup">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('flex-1 rounded-md px-1.5 py-1 text-[12px] font-medium transition-colors motion-reduce:transition-none', value === o.value ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-neutral-100' : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100', FOCUS_RING)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FacetGroup({ title, defaultOpen, selectedCount, onClear, children }: { title: string; defaultOpen: boolean; selectedCount: number; onClear: () => void; children: React.ReactNode }) {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div>
          <div className="flex items-center">
            <DisclosureButton className={cn('flex flex-1 items-center gap-1.5 rounded-md px-1 py-1.5 text-left text-[13px] font-medium text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800/60', FOCUS_RING)}>
              <ChevronDownIcon className={cn('h-4 w-4 shrink-0 text-neutral-400 transition-transform motion-reduce:transition-none', !open && '-rotate-90')} aria-hidden />
              <span className="flex-1">{title}</span>
              {selectedCount > 0 && <span className="rounded-full bg-teal-600 px-1.5 text-[10px] font-semibold text-white">{selectedCount}</span>}
            </DisclosureButton>
            {selectedCount > 0 && (
              <button type="button" onClick={onClear} className={cn('ml-1 rounded p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200', FOCUS_RING)} aria-label={`Clear ${title}`}>
                <XMarkIcon className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
          <DisclosurePanel className="pb-2 pl-1 pt-1">{children}</DisclosurePanel>
        </div>
      )}
    </Disclosure>
  );
}

function BucketList({ facetKey, buckets, selected, onToggle }: { facetKey: MultiFacetKey; buckets: FacetBucket[]; selected: string[]; onToggle: (key: MultiFacetKey, value: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const searchable = buckets.length > 10;
  const filtered = useMemo(() => {
    if (!query) return buckets;
    const q = query.toLowerCase();
    return buckets.filter(b => labelFor(facetKey, b.value).toLowerCase().includes(q) || b.value.toLowerCase().includes(q));
  }, [buckets, query, facetKey]);
  const shown = expanded || query ? filtered : filtered.slice(0, COLLAPSED_ROWS);
  const hidden = filtered.length - shown.length;
  const max = Math.max(1, ...buckets.map(b => b.count));

  return (
    <div>
      {searchable && (
        <div className="relative mb-1.5">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${FACET_TITLES[facetKey].toLowerCase()}`}
            aria-label={`Search ${FACET_TITLES[facetKey].toLowerCase()}`}
            className={cn('h-8 w-full rounded-md border border-neutral-200 bg-white pl-7 pr-2 text-[12px] text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100', FOCUS_RING)}
          />
        </div>
      )}
      <ul className="space-y-0.5" aria-label={FACET_TITLES[facetKey]}>
        {shown.map(b => {
          const checked = selected.includes(b.value);
          const label = labelFor(facetKey, b.value);
          return (
            <li key={b.value}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => onToggle(facetKey, b.value)}
                className={cn('group relative flex w-full items-center gap-2 overflow-hidden rounded-md px-1.5 py-1 text-left', checked ? 'bg-teal-50 dark:bg-teal-500/10' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/60', FOCUS_RING)}
                title={label}
              >
                <span aria-hidden className={cn('absolute inset-y-1 left-0 rounded-r', checked ? 'bg-teal-500/15' : 'bg-neutral-400/10 dark:bg-white/[0.05]')} style={{ width: `${Math.max(2, Math.round((b.count / max) * 100))}%` }} />
                <span className={cn('relative flex h-4 w-4 shrink-0 items-center justify-center rounded border', checked ? 'border-teal-600 bg-teal-600 text-white' : 'border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-900')}>
                  {checked && <CheckIcon className="h-3 w-3" aria-hidden />}
                </span>
                <span className={cn('relative flex-1 truncate text-[13px]', checked ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-700 dark:text-neutral-300')}>{label}</span>
                <span className="relative text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">{fmtInt(b.count)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className={cn(BTN_GHOST, 'mt-1 px-1.5 py-0.5 text-[12px] font-medium text-teal-700 dark:text-teal-300')}>Show {hidden} more</button>
      )}
      {expanded && !query && buckets.length > COLLAPSED_ROWS && (
        <button type="button" onClick={() => setExpanded(false)} className={cn(BTN_GHOST, 'mt-1 px-1.5 py-0.5 text-[12px]')}>Show fewer</button>
      )}
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
        <TransitionChild as={Fragment} enter={`ease-out ${dur}`} enterFrom="opacity-0" enterTo="opacity-100" leave={`ease-in ${dur}`} leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-neutral-950/50" aria-hidden />
        </TransitionChild>
        <div className="fixed inset-0 flex justify-start">
          <TransitionChild as={Fragment} enter={`ease-out ${dur}`} enterFrom="-translate-x-full" enterTo="translate-x-0" leave={`ease-in ${dur}`} leaveFrom="translate-x-0" leaveTo="-translate-x-full">
            <DialogPanel className="flex h-full w-[min(22rem,90vw)] flex-col bg-white shadow-xl dark:bg-neutral-900">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                <DialogTitle className="text-[14px] font-semibold text-neutral-900 dark:text-neutral-100">Filters</DialogTitle>
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
