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
import { daysUntil, fmtDate, fmtRelative, fmtRights, shortLabel } from '@/lib/radar/client/format';
import { ScoreCell } from './ScoreCell';
import { CountryTag, FOCUS_RING, OwnerTypeChip, PartnershipTag, cn } from './ui';

export const ROW_HEIGHT = 56;
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
        className="sticky top-0 z-10 grid h-9 items-center gap-x-3 border-b border-neutral-200 bg-neutral-50/95 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-600 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 dark:text-neutral-400"
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
                'absolute left-0 top-0 grid w-full cursor-pointer items-center gap-x-3 border-b border-neutral-100 px-3 text-sm text-neutral-800 hover:bg-neutral-50 dark:border-neutral-800/70 dark:text-neutral-200 dark:hover:bg-neutral-800/50',
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

function num(v: number | null | undefined): string {
  return v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : String(Math.round(Number(v)));
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
  let body: ReactNode;
  switch (col.key) {
    case 'compare':
      body = (
        <input
          type="checkbox"
          checked={inCompare}
          disabled={!inCompare && compareFull}
          onChange={() => onToggleCompare(row.id)}
          aria-label={`Compare ${row.asset_name}`}
          className={cn('h-4 w-4 rounded border-neutral-400 text-teal-600 dark:border-neutral-600 dark:bg-neutral-900', FOCUS_RING)}
        />
      );
      return <div role="gridcell" className="flex items-center">{body}</div>;
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
            className={cn('block truncate font-medium text-neutral-900 hover:text-teal-700 dark:text-neutral-100 dark:hover:text-teal-300 rounded', FOCUS_RING)}
            tabIndex={-1}
          >
            {row.asset_name}
          </Link>
          <div className="flex items-center gap-2 truncate text-xs text-neutral-600 dark:text-neutral-400">
            <PartnershipTag status={row.partnership_status} />
            {row.mechanism && <span className="truncate">{row.mechanism}</span>}
          </div>
        </div>
      );
    case 'owner':
      return (
        <div role="gridcell" className="group/owner min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate">{row.company_name}</span>
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
          <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
            <OwnerTypeChip type={row.owner_type} />
            {row.partner_company_name && <span className="truncate">with {row.partner_company_name}</span>}
          </div>
        </div>
      );
    case 'phase':
      return (
        <div role="gridcell" className="font-mono text-xs tabular-nums" title={row.phase === 'preclinical' && row.stage_detail ? `${radarLabel(row.phase)} · ${radarLabel(row.stage_detail)}` : radarLabel(row.phase)}>
          {shortLabel(row.phase)}
        </div>
      );
    case 'origin': {
      const filing = row.asset_origin === 'filing';
      return (
        <div role="gridcell" className="truncate text-xs" title={filing ? `Company-disclosed${row.stage_detail ? ` · ${radarLabel(row.stage_detail)}` : ''}` : 'Trial registry'}>
          <span className={filing ? 'text-sky-700 dark:text-sky-300' : 'text-neutral-600 dark:text-neutral-400'}>{filing ? 'SEC filing' : 'Registry'}</span>
          {filing && row.stage_detail && row.stage_detail !== 'preclinical' && (
            <span className="block truncate text-[11px] text-neutral-500 dark:text-neutral-400">{radarLabel(row.stage_detail)}</span>
          )}
        </div>
      );
    }
    case 'modality':
      return (
        <div role="gridcell" className="truncate text-xs" title={radarLabel(row.modality)}>
          {shortLabel(row.modality)}
        </div>
      );
    case 'ta':
      return (
        <div role="gridcell" className="min-w-0">
          <div className="truncate text-xs">{row.therapeutic_area ? radarLabel(row.therapeutic_area) : '—'}</div>
          <div className="truncate text-xs text-neutral-600 dark:text-neutral-400" title={row.indication_specific ?? undefined}>
            {row.indication_specific ?? (row.indication_category ? radarLabel(row.indication_category) : '')}
          </div>
        </div>
      );
    case 'target':
      return (
        <div role="gridcell" className="truncate font-mono text-xs" title={row.target ?? undefined}>
          {row.target ?? '—'}
        </div>
      );
    case 'rights':
      return (
        <div role="gridcell" className="truncate text-xs" title={fmtRights(row.territory_rights_available)}>
          {fmtRights(row.territory_rights_available)}
        </div>
      );
    case 'catalyst': {
      const catalystDays = daysUntil(row.next_catalyst_date);
      return (
        <div role="gridcell" className="text-xs">
          {row.next_catalyst_date ? (
            <>
              <div className="tabular-nums">{fmtDate(row.next_catalyst_date)}</div>
              {catalystDays !== null && (
                <div className={cn('text-[11px]', catalystDays <= 90 ? 'text-teal-700 dark:text-teal-300' : 'text-neutral-600 dark:text-neutral-400')}>
                  primary completion in {catalystDays}d
                </div>
              )}
            </>
          ) : (
            <span className="text-neutral-500">—</span>
          )}
        </div>
      );
    }
    case 'confidence':
      return <div role="gridcell" className={cn('font-mono text-xs tabular-nums', right)} title="Evidence coverage behind the score (0-100)">{num(row.score_confidence)}</div>;
    case 'readiness':
      return <div role="gridcell" className={cn('font-mono text-xs tabular-nums', right)} title="Deal readiness (0-100)">{num(row.deal_readiness_score)}</div>;
    case 'heat':
      return <div role="gridcell" className={cn('font-mono text-xs tabular-nums', right)} title="Competitive heat (0-100)">{num(row.competitive_heat)}</div>;
    case 'trials':
      return (
        <div role="gridcell" className={cn('text-xs tabular-nums', right)}>
          {row.asset_origin === 'filing' && !(row.trial_count ?? 0) ? (
            <span className="text-neutral-500" title="Company-disclosed; no registered trial yet">disclosed</span>
          ) : (
            <>
              <div>{row.trial_count ?? 0} trial{(row.trial_count ?? 0) === 1 ? '' : 's'}</div>
              <div className="text-[11px] text-neutral-600 dark:text-neutral-400">{(row.enrollment_total ?? 0).toLocaleString('en-US')} enrolled</div>
            </>
          )}
        </div>
      );
    case 'updated':
      return (
        <div role="gridcell" className="text-xs tabular-nums text-neutral-600 dark:text-neutral-400" title={fmtDate(row.last_update_date)}>
          {fmtRelative(row.last_update_date)}
        </div>
      );
    default:
      return <div role="gridcell" />;
  }
}
