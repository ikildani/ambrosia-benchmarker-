/**
 * Search & Evaluation — saved view validation (shared by views/route.ts and
 * views/[id]/route.ts). The filters object is sanitised by round-tripping it
 * through the URL codec, so a stored view can never hold a value the feed
 * would reject.
 */

import { z } from 'zod';
import {
  DEFAULT_UI,
  EMPTY_FILTERS,
  MULTI_FACET_KEYS,
  SORT_KEYS,
  cleanColumns,
  parseFilters,
  serializeRadarState,
  type RadarFilterState,
} from '@/lib/radar/client/filter-schema';

const stringList = z.array(z.string().max(120)).max(60);

/** Loose shape accepted from the client; `sanitizeViewFilters` narrows it. */
export const viewFiltersInputSchema = z
  .object({
    q: z.string().max(200).optional(),
    ta: stringList.optional(),
    modality: stringList.optional(),
    phase: stringList.optional(),
    partnership: stringList.optional(),
    ownership: stringList.optional(),
    country: stringList.optional(),
    region: stringList.optional(),
    owner_type: stringList.optional(),
    trial_status: stringList.optional(),
    indication: stringList.optional(),
    target: stringList.optional(),
    score_band: stringList.optional(),
    phase_min: z.string().max(40).nullable().optional(),
    phase_max: z.string().max(40).nullable().optional(),
    min_score: z.number().nullable().optional(),
  })
  .strict();

export type ViewFiltersInput = z.infer<typeof viewFiltersInputSchema>;

/** Filters as the feed would parse them from a URL: unknown vocab dropped, caps applied. */
export function sanitizeViewFilters(input: ViewFiltersInput): RadarFilterState {
  const draft: RadarFilterState = { ...EMPTY_FILTERS };
  for (const key of MULTI_FACET_KEYS) {
    const v = input[key];
    if (Array.isArray(v)) draft[key] = v;
  }
  if (typeof input.q === 'string') draft.q = input.q;
  draft.phase_min = input.phase_min ?? null;
  draft.phase_max = input.phase_max ?? null;
  draft.min_score = typeof input.min_score === 'number' ? input.min_score : null;
  return parseFilters(serializeRadarState({ filters: draft, ui: DEFAULT_UI }));
}

export const savedViewFieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).nullable(),
    filters: viewFiltersInputSchema,
    sort: z.enum(SORT_KEYS),
    dir: z.enum(['asc', 'desc']),
    view_mode: z.enum(['table', 'cards']),
    columns: z.array(z.string().max(40)).max(40).transform(cleanColumns),
    is_default: z.boolean(),
    /** true = share with the caller's active team; false = private. */
    shared: z.boolean(),
  })
  .partial();

export type SavedViewFields = z.infer<typeof savedViewFieldsSchema>;

export const MAX_VIEWS_PER_USER = 30;
