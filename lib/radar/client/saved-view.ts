/**
 * Saved view ⇄ feed state. Pure, shared by the shell and the tests.
 */

import {
  DEFAULT_TABLE_COLUMNS,
  DEFAULT_UI,
  EMPTY_FILTERS,
  SORT_COLUMNS,
  TABLE_COLUMNS,
  cleanColumns,
  countActiveFilters,
  filtersFingerprint,
  parseFilters,
  sameColumns,
  serializeRadarState,
  type RadarFilterState,
  type RadarUiState,
} from './filter-schema';
import type { RadarSavedView } from './api-types';

/** The view's filters as a full, validated filter state (unknown values dropped). */
export function viewToFilters(view: Pick<RadarSavedView, 'filters'>): RadarFilterState {
  const draft: RadarFilterState = { ...EMPTY_FILTERS, ...(view.filters ?? {}) } as RadarFilterState;
  return parseFilters(serializeRadarState({ filters: draft, ui: DEFAULT_UI }));
}

export function viewColumns(view: Pick<RadarSavedView, 'columns'>): string[] {
  return view.columns?.length ? cleanColumns(view.columns) : [...DEFAULT_TABLE_COLUMNS];
}

/** True when the screen no longer matches the saved view (so "Update" is meaningful). */
export function viewIsDirty(view: RadarSavedView, filters: RadarFilterState, ui: Pick<RadarUiState, 'sort' | 'dir' | 'view' | 'columns'>): boolean {
  if (filtersFingerprint(viewToFilters(view)) !== filtersFingerprint(filters)) return true;
  if (view.sort !== ui.sort) return true;
  const dir = view.dir ?? SORT_COLUMNS[view.sort]?.defaultDir;
  if (dir !== ui.dir) return true;
  if (view.view_mode !== ui.view) return true;
  return !sameColumns(viewColumns(view), ui.columns);
}

/** "3 filters · sorted by score · 11 columns · table" for the save dialog. */
export function viewSummary(filters: RadarFilterState, ui: Pick<RadarUiState, 'sort' | 'view' | 'columns'>, sortLabel: string): string {
  const n = countActiveFilters(filters);
  const cols = TABLE_COLUMNS.filter(c => ui.columns.includes(c.key)).length;
  return [
    n === 0 ? 'No filters (whole universe)' : `${n} filter${n === 1 ? '' : 's'}`,
    `sorted by ${sortLabel.toLowerCase()}`,
    ui.view === 'table' ? `${cols} columns` : 'cards',
  ].join(' · ');
}
