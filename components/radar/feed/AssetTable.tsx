'use client';

/**
 * Dense virtualised table (TanStack Virtual, 56px rows). Built from ARIA
 * grid roles on divs so the virtualiser can absolutely position rows; the
 * header shares the same grid template. Keyboard: arrows move the focused
 * row (roving tabindex), Enter opens the asset page, Space toggles compare.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDownIcon, ChevronUpIcon, ChevronUpDownIcon, FunnelIcon } from '@heroicons/react/16/solid';
import { radarLabel } from '@/lib/radar/vocab';
import type { FeedRow } from '@/lib/radar/client/api-types';
import { DEFAULT_TABLE_COLUMNS, TABLE_COLUMNS, type SortDir, type SortKey, type TableColumn } from '@/lib/radar/client/filter-schema';
import { daysUntil, fmtDate, fmtRelative, fmtRightsAvailable, phaseShort, shortLabel } from '@/lib/radar/client/format';
import { MODALITY_COLORS } from './Landscape';
import { ScoreCell } from './ScoreCell';
import { CountryTag, FOCUS_RING, OwnerTypeChip, PartnershipTag, cn } from './ui';

export const ROW_HEIGHT = 60;
const GAP_PX = 12; // gap-x-3

interface Props {
  rows: FeedRow[];
  sort: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  compareIds: string[];
  compareFull: boolean;
  onToggleCompare: (id: string) => void;
  /** Height of the scroll container in px. */
  height: number;
  loading?: boolean;
  /** Visible column keys in TABLE_COLUMNS order (defaults to DEFAULT_TABLE_COLUMNS). */
  columns?: readonly string[];
  /** Toggle the company facet for a row's company (company-first browsing). */
  onFilterCompany?: (companyName: string) => void;
  /** Currently selected company facet values, to mark the active one. */
  companyFilter?: readonly string[];
}

export function AssetTable({ rows, sort, dir, onSort, compareIds, compareFull, onToggleCompare, height, loading, columns, onFilterCompany, companyFilter }: Props) {
  const router = useRouter();
  const visible = useMemo(() => {
    const wanted = new Set(columns ?? DEFAULT_TABLE_COLUMNS);
    return TABLE_COLUMNS.filter(c => c.always || wanted.has(c.key));
  }, [columns]);
  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: visible.map(c => c.width).join(' '),
      minWidth: visible.reduce((n, c) => n + c.minPx, 0) + GAP_PX * (visible.length - 1) + 24,
    }),
    [visible],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const pendingFocus = useRef(false);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // Reset focus and scroll when the row set changes (new page, new filters).
  useEffect(() => {
    setFocusIndex(0);
    virtualizer.scrollToIndex(0);
  }, [rows, virtualizer]);

  // Move DOM focus to the row after the virtualiser has rendered it.
  useEffect(() => {
    if (!pendingFocus.current) return;
    const row = rows[focusIndex];
    if (!row) return;
    const el = document.getElementById(`radar-row-${row.id}`);
    if (el) {
      el.focus({ preventScroll: true });
      pendingFocus.current = false;
    }
  });

  const moveFocus = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(rows.length - 1, next));
      setFocusIndex(clamped);
      pendingFocus.current = true;
      virtualizer.scrollToIndex(clamped, { align: 'auto' });
    },
    [rows.length, virtualizer],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!rows.length) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(focusIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(focusIndex - 1);
        break;
      case 'PageDown':
        e.preventDefault();
        moveFocus(focusIndex + 10);
        break;
      case 'PageUp':
        e.preventDefault();
        moveFocus(focusIndex - 10);
        break;
      case 'Home':
        e.preventDefault();
        moveFocus(0);
        break;
      case 'End':
        e.preventDefault();
        moveFocus(rows.length - 1);
        break;
      case 'Enter': {
        const row = rows[focusIndex];
        if (row && (e.target as HTMLElement).getAttribute('role') === 'row') {
          e.preventDefault();
          router.push(`/radar/${row.id}`);
        }
        break;
      }
      case ' ': {
        const row = rows[focusIndex];
        if (row && (e.target as HTMLElement).getAttribute('role') === 'row') {
          e.preventDefault();
          onToggleCompare(row.id);
        }
        break;
      }
      default:
    }
  };

  const onRowClick = (e: MouseEvent<HTMLDivElement>, row: FeedRow, index: number) => {
    setFocusIndex(index);
    const target = e.target as HTMLElement;
    if (target.closest('a, button, input, label')) return;
    if (e.metaKey || e.ctrlKey) {
      window.open(`/radar/${row.id}`, '_blank', 'noopener');
      return;
    }
    router.push(`/radar/${row.id}`);
  };

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-label="Assets"
      aria-rowcount={rows.length + 1}
      aria-busy={loading || undefined}
      className={cn('relative overflow-auto overscroll-contain', loading && 'opacity-60 transition-opacity motion-reduce:transition-none')}
      style={{ height }}
      onKeyDown={onKeyDown}
    >
      {/* Header */}
      <div
        role="row"
        aria-rowindex={1}
        style={gridStyle}
        className="sticky top-0 z-10 grid h-10 items-center gap-x-3 border-b border-neutral-200 bg-white/95 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 dark:text-neutral-400"
      >
        {visible.map(col => {
          const active = col.sort && col.sort === sort;
          const ariaSort = active ? (dir === 'asc' ? 'ascending' : 'descending') : col.sort ? 'none' : undefined;
          return (
            <div key={col.key} role="columnheader" aria-sort={ariaSort} className={cn('truncate', col.align === 'right' && 'text-right')}>
              {col.sort ? (
                <button
                  type="button"
                  onClick={() => onSort(col.sort as SortKey)}
                  className={cn(
                    'inline-flex max-w-full items-center gap-0.5 rounded truncate hover:text-neutral-900 dark:hover:text-neutral-100',
                    active && 'text-neutral-900 dark:text-neutral-100',
                    FOCUS_RING,
                  )}
                  title={col.hint}
                >
                  <span className="truncate">{col.label}</span>
                  {active ? (
                    dir === 'asc' ? <ChevronUpIcon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : (
                    <ChevronUpDownIcon className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                  )}
                </button>
              ) : col.key === 'compare' ? (
                <span className="sr-only">{col.label}</span>
              ) : (
                <span title={col.hint}>{col.label}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div role="rowgroup" className="relative" style={{ height: virtualizer.getTotalSize(), minWidth: gridStyle.minWidth }}>
        {items.map(item => {
          const row = rows[item.index];
          const inCompare = compareIds.includes(row.id);
          const focused = item.index === focusIndex;
          return (
            <div
              key={row.id}
              id={`radar-row-${row.id}`}
              role="row"
              aria-rowindex={item.index + 2}
              aria-selected={inCompare || undefined}
              tabIndex={focused ? 0 : -1}
              onClick={e => onRowClick(e, row, item.index)}
              onFocus={() => setFocusIndex(item.index)}
              style={{ ...gridStyle, height: item.size, transform: `translateY(${item.start}px)` }}
              className={cn(
                'absolute left-0 top-0 grid w-full cursor-pointer items-center gap-x-3 border-b border-neutral-100 px-4 text-[13px] text-neutral-800 transition-colors hover:bg-teal-50/40 dark:border-neutral-800/70 dark:text-neutral-200 dark:hover:bg-neutral-800/50',
                inCompare && 'bg-teal-50/60 dark:bg-teal-500/5',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500',
              )}
            >
              {visible.map(col => (
                <Cell
                  key={col.key}
                  col={col}
                  row={row}
                  inCompare={inCompare}
                  compareFull={compareFull}
                  onToggleCompare={onToggleCompare}
                  onFilterCompany={onFilterCompany}
                  companyActive={!!companyFilter?.includes(row.company_name)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Cells ─────────────────────────────────────────────────────────────────
// Type scale: 13px primary line, 12px secondary line, 11px only for badges.
// Numbers use tabular figures in the body face (no monospace in the grid).

const PRIMARY = 'truncate text-[13px] text-neutral-900 dark:text-neutral-100';
const SECONDARY = 'truncate text-[12px] text-neutral-500 dark:text-neutral-400';
const NUMBER = 'text-[13px] tabular-nums text-neutral-800 dark:text-neutral-200';

function num(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : String(Math.round(Number(v)));
}

const PHASE_TONE: Record<string, string> = {
  preclinical: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30',
  early_phase_1: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
  phase_1: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
  phase_1_2: 'bg-cyan-50 text-cyan-800 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/30',
  phase_2: 'bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30',
  phase_2_3: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  phase_3: 'bg-emerald-100 text-emerald-900 ring-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-500/40',
  phase_4: 'bg-neutral-100 text-neutral-600 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-700',
};

export function PhaseBadge({ phase, stageDetail }: { phase: string | null; stageDetail?: string | null }) {
  if (!phase) return <span className={SECONDARY}>—</span>;
  const title = phase === 'preclinical' && stageDetail ? `Preclinical · ${radarLabel(stageDetail)}` : phase === 'not_applicable' ? 'No drug phase (device, diagnostic or sample study)' : phase === 'unknown' ? 'Phase not reported' : radarLabel(phase);
  return (
    <span title={title} className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', PHASE_TONE[phase] ?? PHASE_TONE.phase_4)}>
      {phaseShort(phase)}
    </span>
  );
}

const ORIGIN: Record<string, { label: string; tone: string; title: string }> = {
  registry: { label: 'Registry', tone: 'text-neutral-600 dark:text-neutral-400', title: 'Trial registry' },
  filing: { label: 'SEC filing', tone: 'text-sky-700 dark:text-sky-300', title: 'Disclosed in a 10-K / 20-F / S-1' },
  pipeline_page: { label: 'Pipeline page', tone: 'text-violet-700 dark:text-violet-300', title: "Disclosed on the company's pipeline page" },
  designation: { label: 'FDA orphan', tone: 'text-amber-700 dark:text-amber-300', title: 'FDA orphan drug designation' },
};

function Stacked({ top, bottom, title }: { top: ReactNode; bottom?: ReactNode; title?: string }) {
  return (
    <div role="gridcell" className="min-w-0" title={title}>
      <div className={PRIMARY}>{top}</div>
      {bottom !== undefined && bottom !== null && bottom !== '' && <div className={SECONDARY}>{bottom}</div>}
    </div>
  );
}

function Cell({ col, row, inCompare, compareFull, onToggleCompare, onFilterCompany, companyActive }: {
  col: TableColumn;
  row: FeedRow;
  inCompare: boolean;
  compareFull: boolean;
  onToggleCompare: (id: string) => void;
  onFilterCompany?: (companyName: string) => void;
  companyActive?: boolean;
}) {
  const right = col.align === 'right' ? 'text-right' : '';
  switch (col.key) {
    case 'compare':
      return (
        <div role="gridcell" className="flex items-center">
          <input
            type="checkbox"
            checked={inCompare}
            disabled={!inCompare && compareFull}
            onChange={() => onToggleCompare(row.id)}
            aria-label={`Compare ${row.asset_name}`}
            className={cn('h-4 w-4 rounded border-neutral-300 text-teal-600 dark:border-neutral-600 dark:bg-neutral-900', FOCUS_RING)}
          />
        </div>
      );
    case 'score':
      return (
        <div role="gridcell">
          <ScoreCell
            score={row.licensing_intent_score}
            confidence={row.score_confidence}
            delta30d={row.score_delta_30d}
            spark={row.score_spark}
            presentation={{ probability: row.score_probability, pct_peer: row.score_pct_peer, peer_n: row.score_peer_n, peer_key: row.score_peer_key, base_rate: row.score_base_rate }}
          />
        </div>
      );
    case 'asset':
      return (
        <div role="gridcell" className="min-w-0">
          <Link
            href={`/radar/${row.id}`}
            className={cn('block truncate rounded text-[13px] font-semibold text-neutral-900 hover:text-teal-700 dark:text-neutral-100 dark:hover:text-teal-300', FOCUS_RING)}
            tabIndex={-1}
            title={row.asset_name}
          >
            {row.asset_name}
          </Link>
          <div className="flex min-w-0 items-center gap-1.5">
            <PartnershipTag status={row.partnership_status} />
            {(row.program_assets ?? 1) > 1 && (
              <span className="shrink-0 rounded bg-neutral-100 px-1 text-[10px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300" title={`${row.program_assets} registry entries for this program (trial arms, doses, formulations); ${row.program_trials ?? 0} trials in total`}>
                +{(row.program_assets ?? 1) - 1} arms
              </span>
            )}
            {row.mechanism && <span className={SECONDARY}>{row.mechanism}</span>}
          </div>
        </div>
      );
    case 'owner':
      return (
        <div role="gridcell" className="group/owner min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={PRIMARY} title={row.company_name}>{row.company_name}</span>
            <CountryTag code={row.originator_country} />
            {onFilterCompany && (
              <button
                type="button"
                onClick={() => onFilterCompany(row.company_name)}
                className={cn(
                  'shrink-0 rounded p-0.5 text-neutral-400 hover:text-teal-700 dark:hover:text-teal-300',
                  companyActive ? 'text-teal-700 opacity-100 dark:text-teal-300' : 'opacity-0 group-hover/owner:opacity-100 focus:opacity-100',
                  FOCUS_RING,
                )}
                aria-label={companyActive ? `Stop filtering by ${row.company_name}` : `Only ${row.company_name}`}
                title={companyActive ? `Stop filtering by ${row.company_name}` : `Only ${row.company_name}'s programs`}
              >
                <FunnelIcon className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <OwnerTypeChip type={row.owner_type} />
            {row.partner_company_name && <span className={SECONDARY}>with {row.partner_company_name}</span>}
          </div>
        </div>
      );
    case 'phase':
      return (
        <div role="gridcell">
          <PhaseBadge phase={row.phase} stageDetail={row.stage_detail} />
        </div>
      );
    case 'origin': {
      const o = ORIGIN[row.asset_origin ?? 'registry'] ?? ORIGIN.registry;
      const detail = row.stage_detail && row.stage_detail !== 'preclinical' ? radarLabel(row.stage_detail) : null;
      return <Stacked title={o.title} top={<span className={cn('font-medium', o.tone)}>{o.label}</span>} bottom={detail} />;
    }
    case 'modality':
      return (
        <div role="gridcell" className="flex min-w-0 items-center gap-1.5" title={radarLabel(row.modality)}>
          {row.modality && <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: MODALITY_COLORS[row.modality] ?? '#a3a3a3' }} aria-hidden />}
          <span className={PRIMARY}>{row.modality ? shortLabel(row.modality) : '—'}</span>
        </div>
      );
    case 'ta':
      return (
        <Stacked
          title={row.indication_specific ?? undefined}
          top={row.therapeutic_area ? radarLabel(row.therapeutic_area) : '—'}
          bottom={row.indication_specific ?? (row.indication_category ? radarLabel(row.indication_category) : null)}
        />
      );
    case 'target':
      return <Stacked title={row.target ?? undefined} top={row.target ?? <span className="text-neutral-400">—</span>} />;
    case 'rights': {
      const r = fmtRightsAvailable(row.rights_available ?? null);
      const dot = r.tone === 'open' ? 'bg-emerald-500' : r.tone === 'partial' ? 'bg-teal-300' : r.tone === 'none' ? 'bg-neutral-300 dark:bg-neutral-600' : 'bg-amber-300';
      const note = r.tone === 'open' ? 'No partner found' : r.tone === 'unknown' && r.label !== '—' ? 'Partnered in part' : r.tone === 'partial' ? 'Available' : null;
      return (
        <div role="gridcell" className="min-w-0" title={row.partner_company_name ? `Partner: ${row.partner_company_name}` : undefined}>
          <div className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden />
            <span className={PRIMARY}>{r.label}</span>
          </div>
          {note && <div className={SECONDARY}>{note}</div>}
        </div>
      );
    }
    case 'catalyst': {
      const catalystDays = daysUntil(row.next_catalyst_date);
      if (!row.next_catalyst_date) return <div role="gridcell" className={SECONDARY}>—</div>;
      return (
        <Stacked
          top={<span className="tabular-nums">{fmtDate(row.next_catalyst_date)}</span>}
          bottom={catalystDays !== null ? <span className={catalystDays <= 90 ? 'text-teal-700 dark:text-teal-300' : undefined}>readout in {catalystDays}d</span> : null}
        />
      );
    }
    case 'confidence':
      return <div role="gridcell" className={cn(NUMBER, right)} title="Evidence coverage behind the score (0-100)">{num(row.score_confidence)}</div>;
    case 'readiness':
      return <div role="gridcell" className={cn(NUMBER, right)} title="Deal readiness (0-100)">{num(row.deal_readiness_score)}</div>;
    case 'heat':
      return <div role="gridcell" className={cn(NUMBER, right)} title="Competitive heat (0-100)">{num(row.competitive_heat)}</div>;
    case 'trials':
      return (
        <div role="gridcell" className={cn('min-w-0', right)}>
          {row.asset_origin && row.asset_origin !== 'registry' && !(row.trial_count ?? 0) ? (
            <span className={SECONDARY} title="Company-disclosed; no registered trial yet">No trial yet</span>
          ) : (
            <>
              <div className={NUMBER}>{row.trial_count ?? 0}</div>
              <div className={cn(SECONDARY, 'tabular-nums')}>{(row.enrollment_total ?? 0).toLocaleString('en-US')} pts</div>
            </>
          )}
        </div>
      );
    case 'updated':
      return (
        <div role="gridcell" className={cn(SECONDARY, 'tabular-nums')} title={fmtDate(row.last_update_date)}>
          {fmtRelative(row.last_update_date)}
        </div>
      );
    default:
      return <div role="gridcell" />;
  }
}
