/**
 * Saved views, table columns and mandate templates (Search & Evaluation).
 *   lib/radar/client/filter-schema.ts      URL codec (v, cols), cleanColumns
 *   lib/radar/client/use-radar-state.ts    select_view / set_columns
 *   lib/radar/client/saved-view.ts         view <-> state, dirty check
 *   app/api/radar/_lib/view-schema.ts      server-side sanitising
 *   lib/radar/client/mandate-templates.ts  every template survives the codec
 */

import {
  DEFAULT_TABLE_COLUMNS,
  DEFAULT_UI,
  EMPTY_FILTERS,
  TABLE_COLUMNS,
  cleanColumns,
  parseRadarState,
  serializeRadarState,
  parseFilters,
  type RadarState,
} from '@/lib/radar/client/filter-schema';
import { radarReducer } from '@/lib/radar/client/use-radar-state';
import { viewIsDirty, viewSummary, viewToFilters, viewColumns } from '@/lib/radar/client/saved-view';
import { sanitizeViewFilters, savedViewFieldsSchema } from '@/app/api/radar/_lib/view-schema';
import { MANDATE_TEMPLATES } from '@/lib/radar/client/mandate-templates';
import type { RadarSavedView } from '@/lib/radar/client/api-types';

const view = (over: Partial<RadarSavedView> = {}): RadarSavedView => ({
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'u',
  team_id: null,
  name: 'Onc P2',
  description: null,
  filters: { ta: ['oncology'], phase_min: 'phase_2', q: 'her2' },
  sort: 'updated',
  dir: 'desc',
  view_mode: 'table',
  columns: ['compare', 'score', 'asset', 'owner', 'phase', 'origin'],
  is_default: false,
  use_count: 0,
  last_used_at: null,
  created_at: '',
  updated_at: '',
  is_mine: true,
  ...over,
});

describe('table columns', () => {
  it('keeps known keys in canonical order and forces the always-on columns', () => {
    expect(cleanColumns(['updated', 'bogus', 'phase', 'score'])).toEqual(['compare', 'score', 'asset', 'phase', 'updated']);
    expect(cleanColumns([])).toEqual(['compare', 'score', 'asset']);
    expect(DEFAULT_TABLE_COLUMNS.every(k => TABLE_COLUMNS.some(c => c.key === k))).toBe(true);
    expect(TABLE_COLUMNS.filter(c => c.always).map(c => c.key)).toEqual(['compare', 'score', 'asset']);
  });

  it('round-trips through the URL and omits the default set', () => {
    const state: RadarState = { filters: EMPTY_FILTERS, ui: { ...DEFAULT_UI, columns: cleanColumns(['origin', 'heat', 'phase']) } };
    const qs = serializeRadarState(state);
    expect(qs.get('cols')).toBe('compare,score,asset,phase,origin,heat');
    expect(parseRadarState(qs).ui.columns).toEqual(['compare', 'score', 'asset', 'phase', 'origin', 'heat']);
    expect(serializeRadarState({ filters: EMPTY_FILTERS, ui: DEFAULT_UI }).has('cols')).toBe(false);
    expect(parseRadarState(new URLSearchParams('cols=nonsense')).ui.columns).toEqual(['compare', 'score', 'asset']);
  });
});

describe('saved view in the URL and reducer', () => {
  const start: RadarState = { filters: { ...EMPTY_FILTERS, ta: ['neurology'] }, ui: { ...DEFAULT_UI, mandate: '22222222-2222-4222-8222-222222222222', after: 'abc' } };

  it('select_view replaces filters, sort, view mode and columns and clears the mandate and page', () => {
    const v = view();
    const next = radarReducer(start, { type: 'select_view', id: v.id, filters: viewToFilters(v), sort: v.sort, dir: v.dir, view: v.view_mode, columns: v.columns });
    expect(next.filters.ta).toEqual(['oncology']);
    expect(next.filters.q).toBe('her2');
    expect(next.ui).toMatchObject({ view_id: v.id, mandate: null, after: null, sort: 'updated', dir: 'desc', view: 'table' });
    expect(next.ui.columns).toEqual(['compare', 'score', 'asset', 'owner', 'phase', 'origin']);
    const qs = serializeRadarState(next);
    expect(qs.get('v')).toBe(v.id);
    expect(parseRadarState(qs).ui.view_id).toBe(v.id);
  });

  it('leaving a view clears everything; selecting a mandate drops the view id', () => {
    const inView = radarReducer(start, { type: 'select_view', id: view().id, filters: viewToFilters(view()) });
    const left = radarReducer(inView, { type: 'select_view', id: null, filters: null });
    expect(left.filters).toEqual(EMPTY_FILTERS);
    expect(left.ui.view_id).toBeNull();
    const withMandate = radarReducer(inView, { type: 'select_mandate', id: '33333333-3333-4333-8333-333333333333', filters: EMPTY_FILTERS });
    expect(withMandate.ui.view_id).toBeNull();
  });

  it('set_columns sanitises', () => {
    const next = radarReducer(start, { type: 'set_columns', columns: ['heat', 'zzz'] });
    expect(next.ui.columns).toEqual(['compare', 'score', 'asset', 'heat']);
  });

  it('ignores a non-uuid view id in the URL', () => {
    expect(parseRadarState(new URLSearchParams('v=not-a-uuid')).ui.view_id).toBeNull();
  });
});

describe('view <-> state helpers', () => {
  it('drops unknown vocabulary when reading a view and reports dirtiness precisely', () => {
    const v = view({ filters: { ta: ['oncology', 'made_up'], phase_min: 'phase_2' } });
    const f = viewToFilters(v);
    expect(f.ta).toEqual(['oncology']);
    const ui = { sort: v.sort, dir: v.dir, view: v.view_mode, columns: viewColumns(v) };
    expect(viewIsDirty(v, f, ui)).toBe(false);
    expect(viewIsDirty(v, { ...f, q: 'x' }, ui)).toBe(true);
    expect(viewIsDirty(v, f, { ...ui, sort: 'score' })).toBe(true);
    expect(viewIsDirty(v, f, { ...ui, columns: [...DEFAULT_TABLE_COLUMNS] })).toBe(true);
    expect(viewIsDirty(v, f, { ...ui, view: 'cards' })).toBe(true);
  });

  it('summarises the screen for the save dialog', () => {
    expect(viewSummary({ ...EMPTY_FILTERS, ta: ['oncology'], q: 'x' }, { sort: 'score', view: 'table', columns: [...DEFAULT_TABLE_COLUMNS] }, 'Intent score'))
      .toBe('2 filters · sorted by intent score · 11 columns');
    expect(viewSummary(EMPTY_FILTERS, { sort: 'updated', view: 'cards', columns: [...DEFAULT_TABLE_COLUMNS] }, 'Last updated'))
      .toBe('No filters (whole universe) · sorted by last updated · cards');
  });
});

describe('server-side view schema', () => {
  it('sanitises filters exactly like the feed would parse a URL', () => {
    const f = sanitizeViewFilters({ ta: ['oncology', 'nope'], target: ['HER2'], min_score: 250, phase_min: 'phase_9', q: 'x,y(z)' });
    expect(f.ta).toEqual(['oncology']);
    expect(f.target).toEqual(['HER2']);
    expect(f.min_score).toBe(100);
    expect(f.phase_min).toBeNull();
    expect(f.q).toBe('x y z');
  });

  it('accepts a partial body and rejects unknown filter keys and bad enums', () => {
    expect(savedViewFieldsSchema.safeParse({ name: 'x', columns: ['heat', 'junk'] }).success).toBe(true);
    const ok = savedViewFieldsSchema.parse({ name: 'x', columns: ['heat', 'junk'] });
    expect(ok.columns).toEqual(['compare', 'score', 'asset', 'heat']);
    expect(savedViewFieldsSchema.safeParse({ filters: { company: ['x'] } }).success).toBe(false);
    expect(savedViewFieldsSchema.safeParse({ sort: 'nonsense' }).success).toBe(false);
    expect(savedViewFieldsSchema.safeParse({ view_mode: 'grid' }).success).toBe(false);
  });
});

describe('mandate templates', () => {
  it('every template survives the URL codec unchanged (only vocabulary values)', () => {
    for (const t of MANDATE_TEMPLATES) {
      const round = parseFilters(serializeRadarState({ filters: t.filters, ui: DEFAULT_UI }));
      expect({ id: t.id, f: round }).toEqual({ id: t.id, f: t.filters });
      expect(t.name.length).toBeGreaterThan(3);
      expect(t.description.length).toBeGreaterThan(10);
    }
    expect(new Set(MANDATE_TEMPLATES.map(t => t.id)).size).toBe(MANDATE_TEMPLATES.length);
  });

  it('includes a preclinical-inclusive template for first-in-class scouting', () => {
    const scout = MANDATE_TEMPLATES.find(t => t.id === 'large-pharma-first-in-class-scout')!;
    expect(scout.filters.phase_min).toBe('preclinical');
  });
});
