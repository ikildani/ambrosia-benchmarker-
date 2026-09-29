'use client';

/**
 * Landscape strip above the results: the shape of the current result set in
 * five small charts (stage, therapeutic area, modality, geography, rights),
 * drawn from the facets response the rail already loads, so it costs no extra
 * request. Every bar is a filter: clicking it narrows the feed.
 */

import { useEffect, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { RADAR_PHASE_OPTIONS, radarLabel } from '@/lib/radar/vocab';
import type { MultiFacetKey, RadarFilterState } from '@/lib/radar/client/filter-schema';
import type { FacetBucket, FacetsResponse } from '@/lib/radar/client/api-types';
import { fmtInt, phaseShort } from '@/lib/radar/client/format';
import { BTN_GHOST, FOCUS_RING, Skeleton, cn } from './ui';

const OPEN_KEY = 'radar:landscape-open';

/** Muted, colour-blind-safe ramp; the same colour means the same modality everywhere. */
export const MODALITY_COLORS: Record<string, string> = {
  small_molecule: '#0f766e', antibody: '#2563eb', adc: '#7c3aed', bispecific: '#c026d3', car_t: '#db2777', cell_therapy: '#e11d48',
  gene_therapy: '#ea580c', mrna: '#d97706', peptide: '#65a30d', oligonucleotide: '#0891b2', radiopharm: '#4f46e5', vaccine: '#0d9488',
};

interface Props {
  filters: RadarFilterState;
  facets: FacetsResponse['facets'] | null;
  total: number | null;
  loading: boolean;
  onToggle: (key: MultiFacetKey, value: string) => void;
  onPhaseRange: (min: string | null, max: string | null) => void;
}

export function Landscape({ filters, facets, total, loading, onToggle, onPhaseRange }: Props) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try { setOpen(window.localStorage.getItem(OPEN_KEY) !== '0'); } catch { /* storage unavailable */ }
  }, []);
  const flip = () => {
    setOpen(o => {
      try { window.localStorage.setItem(OPEN_KEY, o ? '0' : '1'); } catch { /* storage unavailable */ }
      return !o;
    });
  };

  return (
    <section className="mb-4 rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" aria-label="Landscape of the current results">
      <div className="flex items-center justify-between px-4 py-2.5">
        <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
          Landscape
          {total !== null && <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">{fmtInt(total)} assets · click any bar to filter</span>}
        </p>
        <button type="button" onClick={flip} className={cn(BTN_GHOST, 'px-2 py-1 text-[12px]')} aria-expanded={open}>
          <ChevronDownIcon className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} aria-hidden />
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <div className="grid gap-px border-t border-neutral-200 bg-neutral-200 dark:border-neutral-800 dark:bg-neutral-800 sm:grid-cols-2 xl:grid-cols-5">
          <Tile title="Stage">
            {loading || !facets ? <TileSkeleton /> : <StageColumns buckets={facets.phase} filters={filters} onPick={v => onPhaseRange(v, v)} />}
          </Tile>
          <Tile title="Therapeutic area">
            {loading || !facets ? <TileSkeleton /> : <Bars buckets={facets.ta} selected={filters.ta} label={radarLabel} onPick={v => onToggle('ta', v)} />}
          </Tile>
          <Tile title="Modality">
            {loading || !facets ? <TileSkeleton /> : <ModalityMix buckets={facets.modality} selected={filters.modality} onPick={v => onToggle('modality', v)} />}
          </Tile>
          <Tile title="Originator region">
            {loading || !facets ? <TileSkeleton /> : <Bars buckets={facets.region} selected={filters.region} label={radarLabel} onPick={v => onToggle('region', v)} />}
          </Tile>
          <Tile title="Rights available">
            {loading || !facets ? <TileSkeleton /> : <RightsSplit buckets={facets.rights} total={total} selected={filters.rights} onPick={v => onToggle('rights', v)} />}
          </Tile>
        </div>
      )}
    </section>
  );
}

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white px-4 py-3 dark:bg-neutral-900">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">{title}</p>
      {children}
    </div>
  );
}

function TileSkeleton() {
  return <div className="space-y-1.5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>;
}

function StageColumns({ buckets, filters, onPick }: { buckets: FacetBucket[] | undefined; filters: RadarFilterState; onPick: (v: string) => void }) {
  const phases = RADAR_PHASE_OPTIONS.filter(o => o.value !== 'phase_4');
  const counts = phases.map(p => buckets?.find(b => b.value === p.value)?.count ?? 0);
  const max = Math.max(1, ...counts);
  return (
    <div className="flex h-[104px] items-end gap-1">
      {phases.map((p, i) => {
        const on = filters.phase_min === p.value && filters.phase_max === p.value;
        return (
          <button key={p.value} type="button" onClick={() => onPick(p.value)} title={`${p.longLabel ?? p.label}: ${fmtInt(counts[i])}`} className={cn('group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1', FOCUS_RING)}>
            <span className="text-[10px] tabular-nums text-neutral-500">{counts[i] >= 1000 ? `${Math.round(counts[i] / 100) / 10}k` : counts[i]}</span>
            <span className={cn('w-full rounded-t', on ? 'bg-teal-600' : 'bg-teal-600/30 group-hover:bg-teal-600/60')} style={{ height: `${Math.max(4, Math.round((counts[i] / max) * 64))}px` }} />
            <span className="w-full truncate text-center text-[10px] font-medium text-neutral-600 dark:text-neutral-400">{phaseShort(p.value)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Bars({ buckets, selected, label, onPick, rows = 5 }: { buckets: FacetBucket[] | undefined; selected: string[]; label: (v: string) => string; onPick: (v: string) => void; rows?: number }) {
  const list = [...(buckets ?? [])].sort((a, b) => b.count - a.count).slice(0, rows);
  const max = Math.max(1, ...list.map(b => b.count));
  if (list.length === 0) return <p className="text-[12px] text-neutral-500">No data</p>;
  return (
    <ul className="space-y-1">
      {list.map(b => {
        const on = selected.includes(b.value);
        return (
          <li key={b.value}>
            <button type="button" onClick={() => onPick(b.value)} className={cn('group block w-full text-left', FOCUS_RING)} title={`${label(b.value)}: ${fmtInt(b.count)}`}>
              <span className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className={cn('truncate', on ? 'font-semibold text-teal-800 dark:text-teal-200' : 'text-neutral-700 dark:text-neutral-300')}>{label(b.value)}</span>
                <span className="tabular-nums text-[11px] text-neutral-500">{fmtInt(b.count)}</span>
              </span>
              <span className="mt-0.5 block h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
                <span className={cn('block h-1.5 rounded-full', on ? 'bg-teal-600' : 'bg-teal-600/40 group-hover:bg-teal-600/70')} style={{ width: `${Math.max(3, Math.round((b.count / max) * 100))}%` }} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ModalityMix({ buckets, selected, onPick }: { buckets: FacetBucket[] | undefined; selected: string[]; onPick: (v: string) => void }) {
  const list = [...(buckets ?? [])].filter(b => b.count > 0).sort((a, b) => b.count - a.count);
  const total = list.reduce((n, b) => n + b.count, 0) || 1;
  const top = list.slice(0, 6);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800" role="img" aria-label="Modality mix">
        {list.map(b => (
          <span key={b.value} title={`${radarLabel(b.value)}: ${fmtInt(b.count)}`} style={{ width: `${(b.count / total) * 100}%`, backgroundColor: MODALITY_COLORS[b.value] ?? '#a3a3a3', opacity: selected.length && !selected.includes(b.value) ? 0.3 : 1 }} />
        ))}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
        {top.map(b => (
          <li key={b.value}>
            <button type="button" onClick={() => onPick(b.value)} className={cn('flex w-full items-center gap-1.5 text-left text-[12px]', FOCUS_RING)}>
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: MODALITY_COLORS[b.value] ?? '#a3a3a3' }} aria-hidden />
              <span className={cn('truncate', selected.includes(b.value) ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-700 dark:text-neutral-300')}>{radarLabel(b.value)}</span>
              <span className="ml-auto tabular-nums text-[11px] text-neutral-500">{Math.round((b.count / total) * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RightsSplit({ buckets, total, selected, onPick }: { buckets: FacetBucket[] | undefined; total: number | null; selected: string[]; onPick: (v: string) => void }) {
  const get = (v: string) => buckets?.find(b => b.value === v)?.count ?? 0;
  const worldwide = get('global');
  const unconfirmed = get('unconfirmed');
  const regional = Math.max(0, (total ?? 0) - worldwide - unconfirmed);
  const sum = Math.max(1, worldwide + unconfirmed + regional);
  const segs = [
    { key: 'global', label: 'Worldwide', count: worldwide, color: '#0f766e' },
    { key: 'regional', label: 'Regional split', count: regional, color: '#5eead4' },
    { key: 'unconfirmed', label: 'Unconfirmed', count: unconfirmed, color: '#d4d4d4' },
  ];
  const territories = ['us', 'eu', 'japan', 'china', 'row'];
  const labels: Record<string, string> = { us: 'US', eu: 'EU', japan: 'JP', china: 'CN', row: 'RoW' };
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800" role="img" aria-label="Rights availability">
        {segs.map(s => <span key={s.key} style={{ width: `${(s.count / sum) * 100}%`, backgroundColor: s.color }} title={`${s.label}: ${fmtInt(s.count)}`} />)}
      </div>
      <ul className="mt-2 space-y-0.5">
        {segs.map(s => (
          <li key={s.key} className="flex items-center gap-1.5 text-[12px] text-neutral-700 dark:text-neutral-300">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
            {s.key === 'regional' ? <span>{s.label}</span> : (
              <button type="button" onClick={() => onPick(s.key)} className={cn('hover:underline', selected.includes(s.key) && 'font-semibold text-teal-800 dark:text-teal-200', FOCUS_RING)}>{s.label}</button>
            )}
            <span className="ml-auto tabular-nums text-[11px] text-neutral-500">{fmtInt(s.count)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-1" role="group" aria-label="Rights available in">
        {territories.map(t => (
          <button key={t} type="button" onClick={() => onPick(t)} aria-pressed={selected.includes(t)} className={cn('flex-1 rounded-md border px-1 py-0.5 text-[11px] font-semibold', selected.includes(t) ? 'border-teal-600 bg-teal-600 text-white' : 'border-neutral-200 text-neutral-700 hover:border-neutral-300 dark:border-neutral-700 dark:text-neutral-300', FOCUS_RING)} title={`Rights available in ${labels[t]}: ${fmtInt(get(t))}`}>
            {labels[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
