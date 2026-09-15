/**
 * Shared Asset Radar row types. Mirrors the production `clinical_assets`
 * columns (migrations 090, 102, 103, 107, 109, 112). Every Radar component,
 * API route, and cron imports from here instead of redeclaring the shape.
 */

export type PartnershipStatus = 'unpartnered' | 'partially_partnered' | 'partnered';
export type DrugResolutionStatus = 'unresolved' | 'resolved' | 'ambiguous' | 'unresolvable';
export type ClassificationStatus = 'unclassified' | 'classified' | 'needs_review' | 'skipped';
export type OwnerType = 'industry' | 'academic' | 'government' | 'hospital' | 'network' | 'cro' | 'other' | 'unknown';

export interface PartnershipEvidence {
  type: 'deal' | 'trial_collaborator' | 'press_release';
  id: string;
  url?: string;
  date?: string;
  note?: string;
}

export interface ClinicalAssetRow {
  id: string;
  company_id: string | null;
  company_name: string;
  asset_name: string;
  asset_aliases: string[] | null;
  mechanism: string | null;
  target: string | null;
  modality: string | null;
  therapeutic_area: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  indications_all: string[] | null;
  phase: string | null;
  phase_history: unknown[] | null;
  trial_status: string | null;
  lead_nct_id: string | null;
  nct_ids: string[] | null;
  trial_count: number | null;
  enrollment_total: number | null;
  first_posted_date: string | null;
  last_update_date: string | null;
  regulatory_designations: string[] | null;
  fda_approval_date: string | null;
  ema_approval_date: string | null;
  partnership_status: PartnershipStatus | null;
  partner_company_id: string | null;
  partner_company_name: string | null;
  deal_id: string | null;
  deal_ids: string[] | null;
  territory_rights_available: string[] | null;
  originator_country: string | null;
  originator_region: string | null;
  licensing_intent_score: number | null;
  competitive_heat: number | null;
  deal_readiness_score: number | null;
  confidence_score: number | null;
  data_sources: string[] | null;
  last_enriched_at: string | null;
  enrichment_version: number | null;
  created_at: string | null;
  updated_at: string | null;
  last_scored_at: string | null;
  score_confidence: number | null;
  partnership_evidence: PartnershipEvidence[];
  partnership_confidence: number;
  partnership_checked_at: string | null;
  drug_master_id: string | null;
  drug_resolution_status: DrugResolutionStatus;
  drug_resolution_confidence: number | null;
  drug_resolved_at: string | null;
  /** Added by migration 112 (classification pass). */
  classification_status?: ClassificationStatus;
  classified_at?: string | null;
  classification_confidence?: number | null;
  /** Joined from companies.owner_type in API responses. */
  owner_type?: OwnerType | null;
}

/** Columns the feed/table needs; keep the select list in one place. */
export const ASSET_LIST_COLUMNS =
  'id, company_id, company_name, asset_name, modality, therapeutic_area, indication_category, indication_specific, target, mechanism, phase, trial_status, trial_count, enrollment_total, partnership_status, partner_company_name, territory_rights_available, licensing_intent_score, score_confidence, competitive_heat, deal_readiness_score, confidence_score, originator_country, originator_region, first_posted_date, last_update_date, last_scored_at, nct_ids, drug_master_id';

export interface ScoreFactorContribution {
  factor: string;
  weight: number;
  score: number;
  /** weight × score, points toward the composite. */
  points: number;
  confidence: number;
  evidence_text: string | null;
  evidence_url: string | null;
  evidence_date: string | null;
  sources_checked: string[];
}

/** Shape written by the backtest harness (migration 115) and read by the methodology page. */
export interface ScoreBacktestSummary {
  id: string;
  model_version: string;
  run_at: string;
  train_window: { from: string; to: string };
  test_window: { from: string; to: string };
  n_train: number;
  n_test: number;
  positives_test: number;
  roc_auc: number;
  pr_auc: number;
  precision_at_50: number;
  precision_at_100: number;
  lift_top_decile: number;
  brier: number;
  calibration_bins: { bin: string; predicted: number; observed: number; n: number }[];
  factor_importance: { factor: string; importance: number }[];
  notes: string | null;
}
