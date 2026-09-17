'use client';

/**
 * Radar feed composition: URL-backed state, mandate switcher, one search
 * box, facet rail, virtualised table or cards, cursor pagination, compare
 * tray, and the mandate dialogs. Everything the user can change lives in
 * the URL (lib/radar/client/use-radar-state.ts), so a link reproduces the view.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition, TransitionChild } from '@headlessui/react';
import { AdjustmentsHorizontalIcon, ArrowsUpDownIcon, BookmarkSquareIcon, LinkIcon, Squares2X2Icon, TableCellsIcon, XMarkIcon } from '@heroicons/react/20/solid';
import {
  FEED_PAGE_SIZE,
  COMPARE_LIMIT,
  SORT_KEYS,
  filtersFingerprint,
  isEmptyFilters,
  countActiveFilters,
  type MultiFacetKey,
  type RadarFilterState,
  type SortKey,
} from '@/lib/radar/client/filter-schema';
import { useRadarState } from '@/lib/radar/client/use-radar-state';
import { useFacets, useFeed, useIsDesktop, useMandates, usePrefersReducedMotion } from '@/lib/radar/client/hooks';
import { mandateToFilters, type MandateFields } from '@/lib/radar/client/mandate';
import { fmtEstimate } from '@/lib/radar/client/format';
import type { RadarMandate, SearchParseResponse } from '@/lib/radar/client/api-types';
import { AssetTable } from './AssetTable';
import { AssetCards } from './AssetCards';
import { CompareTray } from './CompareDrawer';
import { FacetDrawer, FacetRail } from './FacetRail';
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from './FeedStates';
import { FilterChips } from './FilterChips';
import { FirstRun } from './FirstRun';
import { MandateForm } from './MandateForm';
import { MandateSwitcher } from './MandateSwitcher';
import { Pagination } from './Pagination';
import { SearchBox } from './SearchBox';
import { BTN_GHOST, BTN_SECONDARY, FOCUS_RING, PANEL, Pill, cn } from './ui';

const SORT_LABELS: Record<SortKey, string> = {
  score: 'Intent score',
  confidence: 'Confidence',
  asset: 'Asset name',
  owner: 'Owner',
  phase: 'Phase',
  modality: 'Modality',
  ta: 'Therapeutic area',
  target: 'Target',
  readiness: 'Deal readiness',
  heat: 'Competitive heat',
  updated: 'Last updated',
};

const BROWSE_ALL_KEY = 'radar:browse-all';

type MandateDialog = { mode: 'create'; initial: RadarFilterState } | { mode: 'edit'; mandate: RadarMandate } | null;

export function RadarShell() {
  const { filters, ui, dispatch, href } = useRadarState();
  const isDesktop = useIsDesktop();
  const reduced = usePrefersReducedMotion();

  const mandatesApi = useMandates(true);
  const mandates = mandatesApi.mandates ?? [];
  const selectedMandate = ui.mandate ? mandates.find(m => m.id === ui.mandate) ?? null : null;

  // First run: no saved mandates, no state in the URL, not dismissed.
  const [browseAll, setBrowseAll] = useState(true);
  useEffect(() => {
    try {
      setBrowseAll(window.localStorage.getItem(BROWSE_ALL_KEY) === '1');
    } catch {
      setBrowseAll(false);
    }
  }, []);
  const firstRun =
    mandatesApi.status === 'ready' && mandates.length === 0 && !ui.mandate && isEmptyFilters(filters) && !browseAll;

  // A link that carries only ?m=<id> hydrates the mandate's filters once the mandate list arrives.
  useEffect(() => {
    if (selectedMandate && isEmptyFilters(filters)) {
      dispatch({ type: 'apply_filters', filters: mandateToFilters(selectedMandate), mode: 'replace' }, 'replace');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the selected mandate resolves
  }, [selectedMandate?.id]);

  const feedEnabled = !firstRun;
  const feed = useFeed(filters, ui, feedEnabled);
  const facets = useFacets(filters, feedEnabled);

  // Cursor stack for page numbers and "Previous"; reset when the result set changes.
  const setKey = `${filtersFingerprint(filters)}|${ui.sort}|${ui.dir}`;
  const cursorsRef = useRef<{ key: string; stack: string[] }>({ key: setKey, stack: [] });
  if (cursorsRef.current.key !== setKey) cursorsRef.current = { key: setKey, stack: [] };
  const stack = cursorsRef.current.stack;
  const pageIndex = ui.after ? stack.indexOf(ui.after) : -1;
  const page = ui.after ? (pageIndex >= 0 ? pageIndex + 2 : 0) : 1;

  const onNext = () => {
    if (!feed.nextCursor) return;
    if (!stack.includes(feed.nextCursor)) stack.push(feed.nextCursor);
    dispatch({ type: 'set_page', after: feed.nextCursor });
  };
  const onPrev = () => {
    const prev = pageIndex > 0 ? stack[pageIndex - 1] : null;
    dispatch({ type: 'set_page', after: prev });
  };

  // Table height: fill the viewport below the toolbar, never below 480px.
  const [tableHeight, setTableHeight] = useState(560);
  useEffect(() => {
    const measure = () => setTableHeight(Math.max(480, window.innerHeight - 300));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Dialogs and drawers.
  const [facetDrawerOpen, setFacetDrawerOpen] = useState(false);
  const [mandateDialog, setMandateDialog] = useState<MandateDialog>(null);
  const [mandateError, setMandateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const saveMandate = useCallback(
    async (fields: MandateFields, formFilters: RadarFilterState) => {
      setMandateError(null);
      try {
        if (mandateDialog?.mode === 'edit') {
          const m = await mandatesApi.update(mandateDialog.mandate.id, fields);
          dispatch({ type: 'select_mandate', id: m.id, filters: { ...mandateToFilters(m), owner_type: formFilters.owner_type } });
        } else {
          const m = await mandatesApi.create(fields);
          dispatch({ type: 'select_mandate', id: m.id, filters: { ...mandateToFilters(m), owner_type: formFilters.owner_type } });
        }
        setMandateDialog(null);
      } catch (err) {
        setMandateError(err instanceof Error ? err.message : 'Could not save the mandate');
      }
    },
    [mandateDialog, mandatesApi, dispatch],
  );

  const deleteMandate = useCallback(async () => {
    if (mandateDialog?.mode !== 'edit') return;
    if (!window.confirm(`Delete mandate "${mandateDialog.mandate.name}"?`)) return;
    setMandateError(null);
    try {
      await mandatesApi.remove(mandateDialog.mandate.id);
      setMandateDialog(null);
      if (ui.mandate === mandateDialog.mandate.id) dispatch({ type: 'select_mandate', id: null, filters: null });
    } catch (err) {
      setMandateError(err instanceof Error ? err.message : 'Could not delete the mandate');
    }
  }, [mandateDialog, mandatesApi, ui.mandate, dispatch]);

  const onBrowseAll = () => {
    try {
      window.localStorage.setItem(BROWSE_ALL_KEY, '1');
    } catch {
      // storage unavailable; the session still proceeds
    }
    setBrowseAll(true);
  };

  const onParsed = (res: SearchParseResponse) => {
    dispatch({ type: 'apply_filters', filters: res.filters, mode: 'merge', sort: res.sort });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const activeCount = countActiveFilters(filters);
  const totalText = useMemo(() => {
    const n = facets.total ?? feed.estimatedTotal;
    return n === null ? null : fmtEstimate(n);
  }, [facets.total, feed.estimatedTotal]);

  const railProps = {
    filters,
    facets: facets.facets,
    status: facets.status,
    onToggle: (key: MultiFacetKey, value: string) => dispatch({ type: 'toggle_facet', key, value }),
    onClearFacet: (key: MultiFacetKey) => dispatch({ type: 'set_facet', key, values: [] }),
    onPhaseRange: (min: string | null, max: string | null) => dispatch({ type: 'set_phase_range', min, max }),
    onMinScore: (value: number | null) => dispatch({ type: 'set_min_score', value }),
  };

  if (firstRun) {
    return (
      <div className="min-h-screen bg-neutral-50 pt-16 dark:bg-neutral-950 sm:pt-20">
        <FirstRun saving={mandatesApi.saving} error={mandateError} onSave={saveMandate} onBrowseAll={onBrowseAll} />
      </div>
    );
  }

  const showTable = ui.view === 'table' && isDesktop;
  const loading = feed.status === 'loading';
  const hasRows = feed.rows.length > 0;

  return (
    <div className={cn('min-h-screen bg-neutral-50 pt-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 sm:pt-20', ui.compare.length > 0 && 'pb-20')}>
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {/* Title row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">Asset Radar</h1>
            {mandatesApi.status === 'error' ? (
              <span className="text-xs text-amber-700 dark:text-amber-300">Mandates unavailable</span>
            ) : (
              <MandateSwitcher
                mandates={mandates}
                selectedId={ui.mandate}
                onSelect={id => {
                  const m = id ? mandates.find(x => x.id === id) ?? null : null;
                  dispatch({ type: 'select_mandate', id, filters: m ? mandateToFilters(m) : null });
                }}
                onEdit={m => {
                  setMandateError(null);
                  setMandateDialog({ mode: 'edit', mandate: m });
                }}
                onNew={() => {
                  setMandateError(null);
                  setMandateDialog({ mode: 'create', initial: filters });
                }}
              />
            )}
            {ui.mandate && !selectedMandate && mandatesApi.status === 'ready' && (
              <span className="text-xs text-amber-700 dark:text-amber-300">That mandate no longer exists</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setMandateError(null);
                setMandateDialog({ mode: 'create', initial: filters });
              }}
              className={BTN_SECONDARY}
              disabled={mandatesApi.status === 'error'}
            >
              <BookmarkSquareIcon className="h-4 w-4" aria-hidden />
              Save as mandate
            </button>
            <button type="button" onClick={copyLink} className={BTN_GHOST} aria-live="polite">
              <LinkIcon className="h-4 w-4" aria-hidden />
              {copied ? 'Link copied' : 'Share view'}
            </button>
            {isDesktop && (
              <div className="ml-1 flex items-center gap-1" role="group" aria-label="View">
                <Pill size="sm" active={ui.view === 'table'} onClick={() => dispatch({ type: 'set_view', view: 'table' }, 'replace')} title="Table">
                  <TableCellsIcon className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Table</span>
                </Pill>
                <Pill size="sm" active={ui.view === 'cards'} onClick={() => dispatch({ type: 'set_view', view: 'cards' }, 'replace')} title="Cards">
                  <Squares2X2Icon className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Cards</span>
                </Pill>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="mt-3">
          <SearchBox
            value={filters.q}
            onApplyText={q => dispatch({ type: 'set_q', q })}
            onToggleTarget={t => dispatch({ type: 'toggle_facet', key: 'target', value: t })}
            onParsed={onParsed}
          />
        </div>

        {/* Chips */}
        {activeCount > 0 && (
          <div className="mt-2.5">
            <FilterChips filters={filters} dispatch={dispatch} />
          </div>
        )}

        <div className="mt-4 flex gap-5">
          {/* Facet rail */}
          <aside className="hidden w-60 shrink-0 lg:block" aria-label="Filters">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
              <FacetRail {...railProps} />
            </div>
          </aside>

          {/* Results */}
          <section className={cn(PANEL, 'min-w-0 flex-1 overflow-hidden')} aria-label="Results">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
              <p className="text-xs text-neutral-600 dark:text-neutral-400" aria-live="polite">
                {totalText ? (
                  <>
                    <span className="font-mono font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{totalText}</span> assets
                    {selectedMandate ? ` match ${selectedMandate.name}` : activeCount > 0 ? ' match these filters' : ' indexed'}
                  </>
                ) : loading ? (
                  'Loading assets'
                ) : (
                  ''
                )}
              </p>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setFacetDrawerOpen(true)} className={cn(BTN_SECONDARY, 'lg:hidden')}>
                  <AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden />
                  Filters{activeCount > 0 ? ` (${activeCount})` : ''}
                </button>
                {!showTable && <SortMenu sort={ui.sort} dir={ui.dir} onChange={(s, d) => dispatch({ type: 'set_sort', sort: s, dir: d })} />}
              </div>
            </div>

            {feed.status === 'error' && feed.error ? (
              <ErrorState message={feed.error} onRetry={feed.retry} />
            ) : loading && !hasRows ? (
              showTable ? <TableSkeleton /> : <CardsSkeleton />
            ) : !hasRows && feed.status === 'ready' ? (
              <EmptyState
                title={selectedMandate ? 'No assets match this mandate today' : 'No assets match these filters'}
                body="Widen the phase range, drop a facet, or clear the search text. Counts in the rail show what each change would leave."
                onClear={activeCount > 0 ? () => dispatch({ type: 'clear_filters' }) : undefined}
                onBrowseAll={ui.mandate ? () => dispatch({ type: 'select_mandate', id: null, filters: null }) : undefined}
              />
            ) : showTable ? (
              <AssetTable
                rows={feed.rows}
                sort={ui.sort}
                dir={ui.dir}
                onSort={key => dispatch({ type: 'set_sort', sort: key })}
                compareIds={ui.compare}
                compareFull={ui.compare.length >= COMPARE_LIMIT}
                onToggleCompare={id => dispatch({ type: 'toggle_compare', id }, 'replace')}
                height={tableHeight}
                loading={loading}
              />
            ) : (
              <AssetCards
                rows={feed.rows}
                compareIds={ui.compare}
                compareFull={ui.compare.length >= COMPARE_LIMIT}
                onToggleCompare={id => dispatch({ type: 'toggle_compare', id }, 'replace')}
                loading={loading}
              />
            )}

            {(hasRows || page > 1) && feed.status !== 'error' && (
              <Pagination
                page={page}
                rowsOnPage={feed.rows.length}
                pageSize={FEED_PAGE_SIZE}
                estimatedTotal={feed.estimatedTotal}
                hasNext={!!feed.nextCursor}
                hasPrev={!!ui.after}
                onNext={onNext}
                onPrev={onPrev}
                loading={loading}
              />
            )}
          </section>
        </div>
      </div>

      <FacetDrawer open={facetDrawerOpen} onClose={() => setFacetDrawerOpen(false)} {...railProps} />

      <CompareTray
        ids={ui.compare}
        onRemove={id => dispatch({ type: 'toggle_compare', id }, 'replace')}
        onClear={() => dispatch({ type: 'set_compare', ids: [] }, 'replace')}
      />

      {/* Mandate dialog */}
      <Transition show={mandateDialog !== null} as={Fragment}>
        <Dialog onClose={() => setMandateDialog(null)} className="relative z-50">
          <TransitionChild as={Fragment} enter={reduced ? 'duration-0' : 'ease-out duration-200'} enterFrom="opacity-0" enterTo="opacity-100" leave={reduced ? 'duration-0' : 'ease-in duration-150'} leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-neutral-950/50" aria-hidden />
          </TransitionChild>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center sm:items-center sm:p-6">
              <TransitionChild as={Fragment} enter={reduced ? 'duration-0' : 'ease-out duration-200'} enterFrom="translate-y-4 opacity-0" enterTo="translate-y-0 opacity-100" leave={reduced ? 'duration-0' : 'ease-in duration-150'} leaveFrom="translate-y-0 opacity-100" leaveTo="translate-y-4 opacity-0">
                <DialogPanel className="w-full max-w-3xl rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 sm:rounded-2xl sm:p-6">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <DialogTitle className="text-base font-semibold">{mandateDialog?.mode === 'edit' ? `Edit ${mandateDialog.mandate.name}` : 'Save as mandate'}</DialogTitle>
                      <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                        {mandateDialog?.mode === 'edit' ? 'Changes apply to future matching runs.' : 'The current filters become a saved mandate you can switch to and get notified about.'}
                      </p>
                    </div>
                    <button type="button" onClick={() => setMandateDialog(null)} aria-label="Close" className={cn(BTN_GHOST, 'p-1.5')}>
                      <XMarkIcon className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                  {mandateDialog && (
                    <MandateForm
                      key={mandateDialog.mode === 'edit' ? mandateDialog.mandate.id : 'create'}
                      initial={mandateDialog.mode === 'create' ? mandateDialog.initial : undefined}
                      mandate={mandateDialog.mode === 'edit' ? mandateDialog.mandate : null}
                      submitLabel={mandateDialog.mode === 'edit' ? 'Save changes' : 'Save mandate'}
                      saving={mandatesApi.saving}
                      error={mandateError}
                      onSubmit={saveMandate}
                      onCancel={() => setMandateDialog(null)}
                    />
                  )}
                  {mandateDialog?.mode === 'edit' && (
                    <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                      <button type="button" onClick={deleteMandate} className={cn(BTN_GHOST, 'text-amber-700 dark:text-amber-300')} disabled={mandatesApi.saving}>
                        Delete this mandate
                      </button>
                    </div>
                  )}
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

function SortMenu({ sort, dir, onChange }: { sort: SortKey; dir: 'asc' | 'desc'; onChange: (s: SortKey, d: 'asc' | 'desc') => void }) {
  return (
    <div className="flex items-center gap-1">
      <Listbox value={sort} onChange={s => onChange(s, dir)}>
        <ListboxButton className={cn(BTN_SECONDARY, 'px-3 py-1.5')} aria-label="Sort by">
          <ArrowsUpDownIcon className="h-4 w-4" aria-hidden />
          {SORT_LABELS[sort]}
        </ListboxButton>
        <ListboxOptions anchor="bottom end" className="z-40 mt-1 w-52 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg focus:outline-none dark:border-neutral-800 dark:bg-neutral-900">
          {SORT_KEYS.map(k => (
            <ListboxOption key={k} value={k} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm text-neutral-800 data-[focus]:bg-neutral-100 data-[selected]:font-semibold dark:text-neutral-200 dark:data-[focus]:bg-neutral-800">
              {SORT_LABELS[k]}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
      <button
        type="button"
        onClick={() => onChange(sort, dir === 'asc' ? 'desc' : 'asc')}
        className={cn(BTN_GHOST, 'px-2 py-1.5 font-mono text-[11px]')}
        aria-label={dir === 'asc' ? 'Sorted ascending; switch to descending' : 'Sorted descending; switch to ascending'}
      >
        {dir === 'asc' ? 'ASC' : 'DESC'}
      </button>
      <span className="sr-only" aria-live="polite">{`Sorted by ${SORT_LABELS[sort]}, ${dir === 'asc' ? 'ascending' : 'descending'}`}</span>
    </div>
  );
}
