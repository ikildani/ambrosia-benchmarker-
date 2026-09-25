/**
 * Outcome ledger — shared types (Alaric outcomes program, workstream 1).
 *
 * Row shapes mirror supabase/migrations/122_outcome_ledger.sql. Money is in
 * $M everywhere in this module; the `deals` table stores USD and the resolver
 * converts on read (see toActuals in resolver.ts). Keep this file free of
 * runtime imports so tests and routes can type against it cheaply.
 */

export type PredictionSource = 'calculator' | 'brief' | 'radar' | 'share';
export type PredictionStatus = 'open' | 'resolved' | 'expired' | 'withdrawn';
export type MatchedBy = 'auto' | 'manual' | 'client';
export type OutcomeStatus = 'pending' | 'accepted' | 'rejected';
export type RollupWindow = '90d' | '365d' | 'all';

// ─── predictions ───────────────────────────────────────────────────────────

export interface PredictionRow {
  id: string;
  source: PredictionSource;
  source_id: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  company_id: string | null;
  asset_id: string | null;
  licensor_name: string | null;
  asset_name: string | null;
  indication: string | null;
  therapeutic_area: string | null;
  phase: string | null;
  modality: string | null;
  deal_type: string | null;
  territory: string | null;
  upfront_low: number | null;
  upfront_mid: number | null;
  upfront_high: number | null;
  total_low: number | null;
  total_mid: number | null;
  total_high: number | null;
  royalty_low: number | null;
  royalty_high: number | null;
  predicted_buyers: string[];
  predicted_window_start: string | null;
  predicted_window_end: string | null;
  model_version: string | null;
  fingerprint: string | null;
  status: PredictionStatus;
  resolve_after: string;
}

/** Insert payload: everything the writers set; the database fills id / timestamps / status. */
export type PredictionInsert = Omit<PredictionRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'resolve_after'> & {
  status?: PredictionStatus;
  resolve_after?: string;
};

/** The subset of a prediction the matcher needs. */
export type PredictionForMatch = Pick<
  PredictionRow,
  | 'id' | 'company_id' | 'asset_id' | 'licensor_name' | 'asset_name' | 'indication' | 'therapeutic_area'
  | 'phase' | 'resolve_after' | 'upfront_low' | 'upfront_mid' | 'upfront_high' | 'total_low' | 'total_mid'
  | 'total_high' | 'predicted_buyers' | 'predicted_window_start' | 'predicted_window_end'
>;

// ─── deals (the columns the resolver reads) ────────────────────────────────

export interface DealCandidateRow {
  id: string;
  licensor_name: string | null;
  licensor_id: string | null;
  licensee_name: string | null;
  licensee_id: string | null;
  asset_name: string | null;
  announced_date: string | null;
  phase_at_signing: string | null;
  deal_type: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  therapeutic_area: string | null;
  modality: string | null;
  territory: string | null;
  /** USD — converted to $M by toActuals(). */
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  created_at: string | null;
}

export const DEAL_CANDIDATE_COLUMNS = [
  'id', 'licensor_name', 'licensor_id', 'licensee_name', 'licensee_id', 'asset_name', 'announced_date',
  'phase_at_signing', 'deal_type', 'indication_category', 'indication_specific', 'therapeutic_area',
  'modality', 'territory', 'upfront_usd', 'total_deal_value_usd', 'royalty_low_pct', 'royalty_high_pct',
  'created_at',
].join(',');

/** companies row used to collapse name variants (name + name_variations). */
export interface CompanyAlias {
  id: string;
  name: string;
  name_variations: string[] | null;
}

// ─── matcher output ────────────────────────────────────────────────────────

export interface MatchEvidence {
  /** How the licensor was matched: company_id | name | alias | asset (asset-name only) | fuzzy | none. */
  identity: 'company_id' | 'name' | 'alias' | 'asset' | 'fuzzy' | 'none';
  identityScore: number;
  /** indication | ta | none */
  indication: 'indication' | 'ta' | 'none';
  indicationScore: number;
  /** Phase distance in steps (0 = same, 1 = adjacent, null = unknown on either side). */
  phaseSteps: number | null;
  phaseScore: number;
  /** Deal announced on/after resolve_after. */
  afterResolveAfter: boolean;
  gateScore: number;
  /** Asset name matched (evidence only, no weight). */
  assetNameMatch: boolean;
  predictionLicensor: string | null;
  dealLicensor: string | null;
}

export interface MatchScore {
  /** 0–1; 0 when any hard gate fails. */
  score: number;
  evidence: MatchEvidence;
}

// ─── outcomes ──────────────────────────────────────────────────────────────

/** Actual terms in $M (royalty in %) — from a deal row or a client report. */
export interface OutcomeActuals {
  upfront_m: number | null;
  total_m: number | null;
  royalty_low: number | null;
  royalty_high: number | null;
  licensee_name: string | null;
  licensee_id: string | null;
  signed_date: string | null;
  deal_type: string | null;
  first_offer_upfront_m?: number | null;
  first_offer_total_m?: number | null;
  our_ask_upfront_m?: number | null;
  our_ask_total_m?: number | null;
}

export interface OutcomeMetrics {
  abs_pct_error_upfront: number | null;
  abs_pct_error_total: number | null;
  within_band_upfront: boolean | null;
  within_band_total: boolean | null;
  buyer_hit: boolean | null;
  window_hit: boolean | null;
  value_captured_m: number | null;
}

export interface OutcomeRow extends OutcomeActuals, OutcomeMetrics {
  id: string;
  prediction_id: string;
  deal_id: string | null;
  matched_by: MatchedBy;
  status: OutcomeStatus;
  match_confidence: number | null;
  match_evidence: Record<string, unknown>;
  first_offer_upfront_m: number | null;
  first_offer_total_m: number | null;
  our_ask_upfront_m: number | null;
  our_ask_total_m: number | null;
  created_at: string;
  resolved_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
}

export type OutcomeInsert = Omit<OutcomeRow, 'id' | 'created_at'>;

// ─── accuracy_rollups ──────────────────────────────────────────────────────

export interface AccuracyRollupRow {
  key: string;
  source: PredictionSource | null;
  therapeutic_area: string | null;
  phase: string | null;
  model_version: string | null;
  window: RollupWindow;
  n: number;
  n_expired: number;
  median_ape_upfront: number | null;
  median_ape_total: number | null;
  within_band_rate_upfront: number | null;
  within_band_rate_total: number | null;
  buyer_hit_rate: number | null;
  window_hit_rate: number | null;
  value_captured_total_m: number;
  computed_at: string;
}

/** One accepted outcome joined to its prediction — the rollup input. */
export interface RollupInputRow {
  source: PredictionSource;
  therapeutic_area: string | null;
  phase: string | null;
  model_version: string | null;
  /** ISO timestamp the outcome was accepted (null for expired predictions). */
  resolved_at: string | null;
  /** True for an expired prediction (counts against window_hit_rate only). */
  expired: boolean;
  /** True when the prediction named at least one buyer. */
  namedBuyers: boolean;
  /** True when the prediction had a window. */
  hadWindow: boolean;
  metrics: OutcomeMetrics;
}

export interface AccuracyFilters {
  source?: PredictionSource | null;
  therapeutic_area?: string | null;
  phase?: string | null;
  model_version?: string | null;
  window?: RollupWindow | null;
}

// ─── run reports (cron logging) ────────────────────────────────────────────

export interface ResolverRunReport {
  dealsScanned: number;
  openPredictions: number;
  pairsScored: number;
  autoResolved: number;
  queued: number;
  expired: number;
  cursorFrom: string | null;
  cursorTo: string | null;
  errors: string[];
}

export interface RollupRunReport {
  inputRows: number;
  cells: number;
  errors: string[];
}

export interface RadarWriterReport {
  enabled: boolean;
  candidates: number;
  inserted: number;
  skipped: number;
  errors: string[];
}
