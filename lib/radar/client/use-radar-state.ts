'use client';

/**
 * Single reducer for the Radar feed, with the URL as the store.
 *
 * State is parsed from `useSearchParams` on every render, so back/forward
 * and shared links reproduce the exact feed. Actions run the pure reducer
 * against the current URL state and write the result back with
 * `router.push` (discrete navigations) or `router.replace` (rapid edits such
 * as typing in the search box). Any filter change resets the page cursor.
 */

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  parseRadarState,
  serializeRadarState,
  EMPTY_FILTERS,
  DEFAULT_UI,
  SORT_COLUMNS,
  COMPARE_LIMIT,
  MULTI_FACET_KEYS,
  type RadarState,
  type RadarFilterState,
  type MultiFacetKey,
  type SortKey,
  type SortDir,
  type ViewMode,
} from './filter-schema';

export type RadarAction =
  | { type: 'set_facet'; key: MultiFacetKey; values: string[] }
  | { type: 'toggle_facet'; key: MultiFacetKey; value: string }
  | { type: 'set_q'; q: string }
  | { type: 'set_phase_range'; min: string | null; max: string | null }
  | { type: 'set_min_score'; value: number | null }
  /** Merge parsed chips (natural-language search) or a mandate's filters into the state. */
  | { type: 'apply_filters'; filters: Partial<RadarFilterState>; mode: 'merge' | 'replace'; sort?: SortKey | null }
  | { type: 'clear_filters' }
  | { type: 'remove_filter'; key: keyof RadarFilterState; value?: string }
  | { type: 'set_sort'; sort: SortKey; dir?: SortDir }
  | { type: 'set_view'; view: ViewMode }
  | { type: 'set_page'; after: string | null }
  | { type: 'select_mandate'; id: string | null; filters: RadarFilterState | null }
  | { type: 'toggle_compare'; id: string }
  | { type: 'set_compare'; ids: string[] };

function resetPage(state: RadarState): RadarState {
  return state.ui.after ? { ...state, ui: { ...state.ui, after: null } } : state;
}

export function radarReducer(state: RadarState, action: RadarAction): RadarState {
  switch (action.type) {
    case 'set_facet':
      return resetPage({ ...state, filters: { ...state.filters, [action.key]: action.values } });
    case 'toggle_facet': {
      const current = state.filters[action.key];
      const values = current.includes(action.value) ? current.filter(v => v !== action.value) : [...current, action.value];
      return resetPage({ ...state, filters: { ...state.filters, [action.key]: values } });
    }
    case 'set_q':
      return resetPage({ ...state, filters: { ...state.filters, q: action.q } });
    case 'set_phase_range':
      return resetPage({ ...state, filters: { ...state.filters, phase_min: action.min, phase_max: action.max } });
    case 'set_min_score':
      return resetPage({ ...state, filters: { ...state.filters, min_score: action.value } });
    case 'apply_filters': {
      const base = action.mode === 'replace' ? EMPTY_FILTERS : state.filters;
      const merged: RadarFilterState = { ...base };
      for (const key of MULTI_FACET_KEYS) {
        const incoming = action.filters[key];
        if (incoming?.length) merged[key] = Array.from(new Set([...(action.mode === 'merge' ? base[key] : []), ...incoming]));
      }
      if (action.filters.q !== undefined) merged.q = action.filters.q;
      if (action.filters.phase_min !== undefined) merged.phase_min = action.filters.phase_min;
      if (action.filters.phase_max !== undefined) merged.phase_max = action.filters.phase_max;
      if (action.filters.min_score !== undefined) merged.min_score = action.filters.min_score;
      const ui = action.sort
        ? { ...state.ui, sort: action.sort, dir: SORT_COLUMNS[action.sort].defaultDir, after: null }
        : { ...state.ui, after: null };
      return { filters: merged, ui };
    }
    case 'clear_filters':
      return { filters: EMPTY_FILTERS, ui: { ...state.ui, after: null } };
    case 'remove_filter': {
      const f = { ...state.filters };
      if (action.key === 'q') f.q = '';
      else if (action.key === 'phase_min' || action.key === 'phase_max') f[action.key] = null;
      else if (action.key === 'min_score') f.min_score = null;
      else if (action.value !== undefined) f[action.key] = f[action.key].filter(v => v !== action.value);
      else f[action.key] = [];
      return resetPage({ ...state, filters: f });
    }
    case 'set_sort': {
      const dir = action.dir ?? (state.ui.sort === action.sort ? (state.ui.dir === 'asc' ? 'desc' : 'asc') : SORT_COLUMNS[action.sort].defaultDir);
      return { ...state, ui: { ...state.ui, sort: action.sort, dir, after: null } };
    }
    case 'set_view':
      return { ...state, ui: { ...state.ui, view: action.view } };
    case 'set_page':
      return { ...state, ui: { ...state.ui, after: action.after } };
    case 'select_mandate':
      return {
        filters: action.filters ?? EMPTY_FILTERS,
        ui: { ...state.ui, mandate: action.id, after: null, sort: DEFAULT_UI.sort, dir: DEFAULT_UI.dir },
      };
    case 'toggle_compare': {
      const has = state.ui.compare.includes(action.id);
      if (!has && state.ui.compare.length >= COMPARE_LIMIT) return state;
      const compare = has ? state.ui.compare.filter(id => id !== action.id) : [...state.ui.compare, action.id];
      return { ...state, ui: { ...state.ui, compare } };
    }
    case 'set_compare':
      return { ...state, ui: { ...state.ui, compare: action.ids.slice(0, COMPARE_LIMIT) } };
    default:
      return state;
  }
}

export interface RadarStateApi {
  state: RadarState;
  filters: RadarFilterState;
  ui: RadarState['ui'];
  /** `history: 'replace'` for keystroke-rate edits; default pushes a history entry. */
  dispatch: (action: RadarAction, history?: 'push' | 'replace') => void;
  /** Serialised query string for the current state (for share links). */
  href: string;
}

export function useRadarState(): RadarStateApi {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const state = useMemo(() => parseRadarState(new URLSearchParams(params.toString())), [params]);

  const dispatch = useCallback(
    (action: RadarAction, history: 'push' | 'replace' = 'push') => {
      // Re-parse at dispatch time so rapid successive actions compose on the latest URL.
      const current = parseRadarState(new URLSearchParams(window.location.search));
      const next = radarReducer(current, action);
      const qs = serializeRadarState(next).toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (history === 'replace') router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [router, pathname],
  );

  const href = useMemo(() => {
    const qs = serializeRadarState(state).toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [state, pathname]);

  return { state, filters: state.filters, ui: state.ui, dispatch, href };
}
