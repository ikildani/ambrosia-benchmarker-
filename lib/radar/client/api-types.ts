/**
 * Response shapes for the Radar feed, facets, search, compare and mandate
 * routes. Imported by the routes (to type what they return) and by the
 * client hooks (to type what they receive) so the two cannot drift.
 */

import type { ClinicalAssetRow, OwnerType, PartnershipStatus } from '@/lib/radar/types';
import type { MultiFacetKey, RadarFilterState, SortKey } from './filter-schema';

/** Columns from ASSET_LIST_COLUMNS, plus what the feed route joins or derives. */
export type FeedRow = Pick<
  ClinicalAssetRow,
  | 'id'
  | 'company_id'
  | 'company_name'
  | 'asset_name'
  | 'modality'
  | 'therapeutic_area'
  | 'indication_category'
  | 'indication_specific'
  | 'target'
  | 'mechanism'
  | 'phase'
  | 'trial_status'
  | 'trial_count'
  | 'enrollment_total'
  | 'partnership_status'
  | 'partner_company_name'
  | 'territory_rights_available'
  | 'licensing_intent_score'
  | 'score_confidence'
  | 'competitive_heat'
  | 'deal_readiness_score'
  | 'confidence_score'
  | 'originator_country'
  | 'originator_region'
  | 'first_posted_date'
  | 'last_update_date'
  | 'last_scored_at'
  | 'nct_ids'
  | 'drug_master_id'
> & {
  /** companies.owner_type joined through company_id; 'unknown' when the company is missing. */
  owner_type: OwnerType;
  /** Current score minus the oldest snapshot inside the last 30 days; null without a snapshot. */
  score_delta_30d: number | null;
  /** Up to 10 evenly spaced snapshot scores over the last 30 days, oldest first, ending at the current score. */
  score_spark: number[];
  /** Earliest primary completion date across the asset's active trials, when the payload has it. */
  next_catalyst_date: string | null;
};

export interface FeedResponse {
  rows: FeedRow[];
  /** Cursor for the next page; null when this is the last page. */
  next_cursor: string | null;
  /** Planner estimate (PostgREST `count: 'estimated'`); only on the first page or count-only calls. */
  estimated_total: number | null;
  limit: number;
}

export interface FeedCountResponse {
  estimated_total: number;
}

export interface FacetBucket {
  value: string;
  count: number;
}

export type FacetsResponse = {
  facets: Record<MultiFacetKey, FacetBucket[]>;
  /** Estimated rows matching the filters, from the same RPC call. */
  total: number;
  cached: boolean;
};

export type SuggestionKind = 'asset' | 'company' | 'target' | 'indication';

export interface SearchSuggestion {
  kind: SuggestionKind;
  /** Display text. */
  label: string;
  /** Asset id for `asset` suggestions so the row can link straight to /radar/[id]. */
  asset_id?: string;
  /** Secondary line: company for assets, asset count for companies/targets. */
  detail?: string;
}

export interface SearchSuggestResponse {
  q: string;
  suggestions: SearchSuggestion[];
}

export interface ParsedFilterChip {
  key: keyof RadarFilterState;
  value: string;
  label: string;
}

/** POST /api/radar/search: natural-language text parsed into feed filters. */
export interface SearchParseResponse {
  query: string;
  filters: Partial<RadarFilterState>;
  chips: ParsedFilterChip[];
  /** Sort the text implied ("hottest", "most ready"), or null to keep the current sort. */
  sort: SortKey | null;
}

export interface RadarMandate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  therapeutic_areas: string[];
  modalities: string[];
  phase_min: string | null;
  phase_max: string | null;
  countries: string[];
  regions: string[];
  partnership_statuses: string[];
  min_licensing_intent: number;
  min_deal_readiness: number;
  min_confidence: number;
  notify_email: boolean;
  notify_in_app: boolean;
  digest_frequency: 'realtime' | 'daily' | 'weekly';
  last_matched_at: string | null;
  match_count: number;
  created_at: string;
  updated_at: string;
  unread_matches?: number;
}

export interface MandatesResponse {
  mandates: RadarMandate[];
}

export interface CompareFactor {
  factor: string;
  score: number;
  confidence: number;
  evidence_text: string | null;
}

export interface CompareTerms {
  upfront_low: number | null;
  upfront_mid: number | null;
  upfront_high: number | null;
  total_low: number | null;
  total_mid: number | null;
  total_high: number | null;
  royalty_low: number | null;
  royalty_mid: number | null;
  royalty_high: number | null;
  comp_count: number;
  confidence: number;
  relaxation: string | null;
  insufficient_comps: boolean;
}

export interface CompareAsset {
  id: string;
  asset_name: string;
  company_name: string;
  company_id: string | null;
  owner_type: OwnerType;
  originator_country: string | null;
  originator_region: string | null;
  phase: string | null;
  modality: string | null;
  therapeutic_area: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  target: string | null;
  mechanism: string | null;
  partnership_status: PartnershipStatus | null;
  partner_company_name: string | null;
  territory_rights_available: string[] | null;
  regulatory_designations: string[] | null;
  trial_count: number | null;
  enrollment_total: number | null;
  licensing_intent_score: number | null;
  score_confidence: number | null;
  deal_readiness_score: number | null;
  competitive_heat: number | null;
  last_update_date: string | null;
  /** Top three active factors by score. */
  factors: CompareFactor[];
  terms: CompareTerms | null;
}

export interface CompareResponse {
  assets: CompareAsset[];
}
