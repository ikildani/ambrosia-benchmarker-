/**
 * Asset brief contract shared by the server loader (brief-loader.ts), the
 * /radar/[id] page, /api/radar/assets/[id], the PDF/XLSX exporters and the
 * client islands. Everything the one-page deal brief renders is here.
 */

import type { ClinicalAssetRow, ScoreFactorContribution, PartnershipEvidence } from '@/lib/radar/types';

export interface AssetOwner {
  company_id: string | null;
  company_name: string;
  owner_type: string | null;
  country: string | null;
  region: string | null;
  website_url: string | null;
}

export interface DrugIdentity {
  drug_master_id: string;
  preferred_name: string | null;
  inn: string | null;
  unii: string | null;
  chembl_id: string | null;
  max_phase: string | null;
  resolution_status: string;
  resolution_confidence: number | null;
}

export interface ScoreWaterfallStep {
  key: string;
  label: string;
  /** 'factor' = additive points; 'multiplier' = scales the running total; 'total' = subtotal/composite. */
  kind: 'factor' | 'multiplier' | 'total';
  /** Points added (factor) or multiplier value (multiplier) or running value (total). */
  value: number;
  /** Running total after this step. */
  running: number;
  contribution?: ScoreFactorContribution;
}

export interface ScoreBreakdown {
  score: number;
  confidence: number;
  model_version: string;
  /** All nine factors, zero-score ones included ("checked N sources"). */
  contributions: ScoreFactorContribution[];
  raw_weighted: number;
  phase_multiplier: number;
  availability_factor: number;
  waterfall: ScoreWaterfallStep[];
  /** True when the contributions were reconstructed from the legacy factor_scores map. */
  legacy_shape: boolean;
  snapshot_date: string | null;
}

export interface TrendPoint {
  date: string;
  score: number;
  delta: number;
  trend: string | null;
}

export interface ScoreTrend {
  points: TrendPoint[];
  delta_7d: number | null;
  delta_30d: number | null;
  delta_90d: number | null;
  current_trend: string;
}

export interface CompRow {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  asset_name: string | null;
  therapeutic_area: string | null;
  modality: string | null;
  phase_at_signing: string | null;
  upfront_m: number | null;
  total_deal_value_m: number | null;
  milestones_m: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  territory: string | null;
  announced_date: string | null;
  year: number | null;
  deal_type: string | null;
  verification_status: string | null;
  match_score: number;
  relevance_reasons: string[];
  source_url: string | null;
  source_type: string | null;
  url_status: string | null;
}

export interface ThesisRow {
  predicted_upfront_low: number | null;
  predicted_upfront_mid: number | null;
  predicted_upfront_high: number | null;
  predicted_total_low: number | null;
  predicted_total_mid: number | null;
  predicted_total_high: number | null;
  predicted_royalty_low: number | null;
  predicted_royalty_mid: number | null;
  predicted_royalty_high: number | null;
  comp_count: number;
  thesis_confidence: number;
  comp_relaxation: string | null;
  insufficient_comps: boolean;
  comp_dispersion: number | null;
  generated_at: string | null;
  /** Workstream E columns — null until migration lands. */
  verified_comp_count: number | null;
  terms_basis: string | null;
  calculator_upfront_mid: number | null;
  calculator_total_mid: number | null;
  likely_acquirers: { name: string; dealCount?: number; avgUpfront?: number | null }[];
}

export interface PredictedTerms {
  thesis: ThesisRow | null;
  comps: CompRow[];
  n: number;
  verified_n: number;
  relaxation: string;
  insufficient: boolean;
  min_comps: number;
  excluded_approved_ma: number;
  /** Median of disclosed comp upfronts / totals ($M), null when < 3 disclosed. */
  comps_median_upfront_m: number | null;
  comps_median_total_m: number | null;
}

export interface TrialRow {
  nct_id: string;
  trial_title: string | null;
  phase: string | null;
  status: string | null;
  enrollment_count: number | null;
  start_date: string | null;
  primary_completion_date: string | null;
  completion_date: string | null;
  locations_countries: string[];
  conditions: string[];
  is_collaboration: boolean;
  collaborator_names: string[];
  lead_sponsor_name: string | null;
  registry: string | null;
  last_update_posted: string | null;
}

export interface CatalystRow {
  id: string;
  date: string;
  kind: string;
  title: string;
  detail: string | null;
  nct_id: string | null;
  source: 'asset_catalysts' | 'company_trials' | 'regulatory';
}

export interface IntelRow {
  id: string;
  intel_type: string;
  competitor_name: string | null;
  intensity: number;
  evidence_text: string | null;
  detected_at: string | null;
}

export interface AcquirerRow {
  id: string;
  acquirer_name: string;
  acquirer_company_id: string | null;
  opportunity_score: number;
  strategic_fit_score: number;
  timing_score: number;
  rationale: string;
  strategic_drivers: string[];
  risk_factors: string[];
  gap_type: string | null;
  gap_detail: string | null;
  predicted_upfront_mid: number | null;
  predicted_total_mid: number | null;
  confidence: number;
  status: string;
}

export interface LinkedDealRow {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  upfront_m: number | null;
  total_deal_value_m: number | null;
  territory: string | null;
  announced_date: string | null;
  deal_status: string | null;
  source_url: string | null;
}

export interface Freshness {
  last_update_date: string | null;
  last_scored_at: string | null;
  last_enriched_at: string | null;
  partnership_checked_at: string | null;
  thesis_generated_at: string | null;
  drug_resolved_at: string | null;
}

export interface AssetBrief {
  asset: ClinicalAssetRow;
  owner: AssetOwner;
  drug: DrugIdentity | null;
  partnership: {
    status: string | null;
    partner_name: string | null;
    partner_company_id: string | null;
    confidence: number;
    evidence: PartnershipEvidence[];
    rights_available: string[];
  };
  score: ScoreBreakdown;
  trend: ScoreTrend;
  terms: PredictedTerms;
  trials: TrialRow[];
  catalysts: CatalystRow[];
  intel: IntelRow[];
  acquirers: AcquirerRow[];
  linked_deals: LinkedDealRow[];
  freshness: Freshness;
  generated_at: string;
}

/** Viewer context passed from the server page to the client shell. */
export interface BriefViewer {
  user_id: string | null;
  has_team: boolean;
  team_name: string | null;
}
