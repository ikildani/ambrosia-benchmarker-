/**
 * Global Regulatory Risk Model — 7 Agencies
 *
 * Extends the FDA-only regulatory risk module to cover 7 major regulatory
 * agencies worldwide: FDA (US), EMA (EU), PMDA (Japan), NMPA (China),
 * TGA (Australia), Health Canada, and Swissmedic (Switzerland).
 *
 * For the FDA pathway, this module delegates to the existing
 * `computeRegulatoryRisk()` function and wraps its result. For the remaining
 * 6 agencies, it computes risk from agency-specific base rates sourced from
 * published annual reports (2019-2024).
 *
 * Sources per agency:
 *   - EMA: CHMP Annual Activity Reports 2019-2024, EMA PRIME factsheets
 *   - PMDA: PMDA Annual Reports 2020-2024, SAKIGAKE/breakthrough guidance
 *   - NMPA: CDE Annual Drug Review Reports 2020-2024, breakthrough reform docs
 *   - TGA: TGA Performance & Accountability Reports 2020-2024
 *   - Health Canada: Drug Submissions Performance Annual Reports 2020-2024
 *   - Swissmedic: Annual Reports 2020-2024, fast-track authorization stats
 *
 * Revenue-weighted risk scoring uses standard pharma global revenue splits:
 *   US 55%, EU 25%, Japan 8%, China 7%, RoW 5%
 *
 * @module lib/financial/global-regulatory-risk
 */

import { computeRegulatoryRisk } from './regulatory-risk';
import type { RegulatoryRiskResult, RegulatoryDesignations } from './regulatory-risk';
import type { Phase, TherapeuticArea, Modality } from '@/lib/calculations';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

export type Agency =
  | 'FDA'
  | 'EMA'
  | 'PMDA'
  | 'NMPA'
  | 'TGA'
  | 'HealthCanada'
  | 'Swissmedic';

export interface AgencyRegulatoryRisk {
  agency: Agency;
  agencyFullName: string;
  territory: string;
  rejectionProbability: number;
  rejectionLabel: string;
  expertCommitteeRequired: boolean;
  expertCommitteeFavorableRate: number;
  expertCommitteeLabel: string;
  standardReviewMonths: number;
  priorityReviewMonths: number;
  currentReviewType: 'standard' | 'priority' | 'accelerated';
  designations: Array<{ name: string; active: boolean; impact: string }>;
  conditionalApprovalAvailable: boolean;
  conditionalApprovalLabel: string;
  conditionalApprovalRisk: number;
  timelineImpact_years: number;
  narrative: string;
}

export interface GlobalRegulatoryRiskResult {
  primary: AgencyRegulatoryRisk;
  agencies: AgencyRegulatoryRisk[];
  combinedTimelineImpact_years: number;
  overallRiskScore: number;
  narrative: string;
  // Backward compat: spread the primary FDA result fields
  crlProbability: number;
  adcommRequired: boolean;
  adcommFavorableVoteProbability: number;
  pdufahRisk: { onTime: number; delay3mo: number; delay6mo: number };
  prvEligible: boolean;
  prvValue_M: number;
  timelineImpact_years: number;
}

// ---------------------------------------------------------------------------
// Territory -> Agency Mapping
// ---------------------------------------------------------------------------

const TERRITORY_AGENCIES: Record<string, Agency[]> = {
  global: ['FDA', 'EMA', 'PMDA', 'NMPA', 'TGA', 'HealthCanada', 'Swissmedic'],
  us_only: ['FDA'],
  europe: ['EMA', 'Swissmedic'],
  us_eu: ['FDA', 'EMA'],
  japan: ['PMDA'],
  china: ['NMPA'],
  us_japan: ['FDA', 'PMDA'],
  canada: ['HealthCanada'],
  australia: ['TGA'],
  ex_us: ['EMA', 'PMDA', 'NMPA', 'TGA', 'HealthCanada', 'Swissmedic'],
  row: ['TGA', 'HealthCanada'],
  apac_ex_cj: ['TGA'],
  latam: ['FDA'],
  mena: ['FDA'],
  south_korea: ['FDA', 'EMA'],
};

/**
 * Revenue weight per agency for combined scoring.
 * Reflects global pharma revenue distribution (IQVIA 2024).
 */
const AGENCY_REVENUE_WEIGHT: Record<Agency, number> = {
  FDA: 0.55,
  EMA: 0.22,
  Swissmedic: 0.03,
  PMDA: 0.08,
  NMPA: 0.07,
  TGA: 0.02,
  HealthCanada: 0.03,
};

/**
 * Primary agency determination per territory — the agency whose territory
 * represents the largest revenue share in a given filing strategy.
 */
const PRIMARY_AGENCY: Record<string, Agency> = {
  global: 'FDA',
  us_only: 'FDA',
  europe: 'EMA',
  us_eu: 'FDA',
  japan: 'PMDA',
  china: 'NMPA',
  us_japan: 'FDA',
  canada: 'HealthCanada',
  australia: 'TGA',
  ex_us: 'EMA',
  row: 'TGA',
  apac_ex_cj: 'TGA',
  latam: 'FDA',
  mena: 'FDA',
  south_korea: 'FDA',
};

// ---------------------------------------------------------------------------
// Agency Full Names & Territories
// ---------------------------------------------------------------------------

const AGENCY_META: Record<Agency, { fullName: string; territory: string }> = {
  FDA: { fullName: 'U.S. Food and Drug Administration', territory: 'United States' },
  EMA: { fullName: 'European Medicines Agency', territory: 'European Union' },
  PMDA: { fullName: 'Pharmaceuticals and Medical Devices Agency', territory: 'Japan' },
  NMPA: { fullName: 'National Medical Products Administration', territory: 'China' },
  TGA: { fullName: 'Therapeutic Goods Administration', territory: 'Australia' },
  HealthCanada: { fullName: 'Health Canada', territory: 'Canada' },
  Swissmedic: { fullName: 'Swiss Agency for Therapeutic Products', territory: 'Switzerland' },
};

// ---------------------------------------------------------------------------
// Agency-Specific Base Parameters (by TA)
// ---------------------------------------------------------------------------

/**
 * Per-TA regulatory risk parameters for non-FDA agencies.
 *
 * Each record maps TherapeuticArea to:
 *   - rejectionRate: base rejection/negative opinion probability
 *   - reviewStandard: standard review months
 *   - reviewPriority: priority/expedited review months
 *   - conditionalFailureRate: confirmatory requirement failure rate
 */
interface AgencyTAParams {
  rejectionRate: number;
  reviewStandard: number;
  reviewPriority: number;
  conditionalFailureRate: number;
}

type TAParamMap = Record<TherapeuticArea, AgencyTAParams>;

// Default params for TAs not explicitly specified (used for fallback)
function defaultTAParams(base: AgencyTAParams): TAParamMap {
  const tas: TherapeuticArea[] = [
    'oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular',
    'infectiousDisease', 'ophthalmology', 'womensHealth', 'rareDisease',
    'hematology', 'dermatology', 'gastroenterology',
  ];
  const map = {} as TAParamMap;
  for (const ta of tas) {
    map[ta] = { ...base };
  }
  return map;
}

/**
 * EMA — CHMP negative opinion rates by TA
 * Source: EMA Annual Activity Reports 2019-2024, CHMP opinion statistics
 */
const EMA_PARAMS: TAParamMap = (() => {
  const base: AgencyTAParams = {
    rejectionRate: 0.05,
    reviewStandard: 11,
    reviewPriority: 7,
    conditionalFailureRate: 0.15,
  };
  const map = defaultTAParams(base);
  // TA-specific adjustments from CHMP opinion statistics
  map.oncology = { ...base, rejectionRate: 0.03 };
  map.hematology = { ...base, rejectionRate: 0.04 };
  map.rareDisease = { ...base, rejectionRate: 0.04 };
  map.infectiousDisease = { ...base, rejectionRate: 0.04 };
  map.neurology = { ...base, rejectionRate: 0.07 };
  map.metabolic = { ...base, rejectionRate: 0.05 };
  map.cardiovascular = { ...base, rejectionRate: 0.06 };
  map.immunology = { ...base, rejectionRate: 0.05 };
  map.ophthalmology = { ...base, rejectionRate: 0.04 };
  map.womensHealth = { ...base, rejectionRate: 0.06 };
  map.dermatology = { ...base, rejectionRate: 0.05 };
  map.gastroenterology = { ...base, rejectionRate: 0.06 };
  return map;
})();

/**
 * PMDA — rejection/non-approval rates by TA
 * Source: PMDA Annual Reports 2020-2024
 */
const PMDA_PARAMS: TAParamMap = (() => {
  const base: AgencyTAParams = {
    rejectionRate: 0.05,
    reviewStandard: 12,
    reviewPriority: 9,
    conditionalFailureRate: 0.12,
  };
  const map = defaultTAParams(base);
  map.oncology = { ...base, rejectionRate: 0.03 };
  map.hematology = { ...base, rejectionRate: 0.04 };
  map.rareDisease = { ...base, rejectionRate: 0.04 };
  map.neurology = { ...base, rejectionRate: 0.06 };
  map.infectiousDisease = { ...base, rejectionRate: 0.04 };
  map.immunology = { ...base, rejectionRate: 0.05 };
  map.metabolic = { ...base, rejectionRate: 0.05 };
  map.cardiovascular = { ...base, rejectionRate: 0.06 };
  map.ophthalmology = { ...base, rejectionRate: 0.04 };
  map.womensHealth = { ...base, rejectionRate: 0.06 };
  map.dermatology = { ...base, rejectionRate: 0.05 };
  map.gastroenterology = { ...base, rejectionRate: 0.05 };
  return map;
})();

/**
 * NMPA — rejection rates by TA (higher than EMA/PMDA on average)
 * Source: CDE Annual Drug Review Reports 2020-2024
 */
const NMPA_PARAMS: TAParamMap = (() => {
  const base: AgencyTAParams = {
    rejectionRate: 0.09,
    reviewStandard: 10, // 200-300 calendar days
    reviewPriority: 5,  // 130-day breakthrough
    conditionalFailureRate: 0.18,
  };
  const map = defaultTAParams(base);
  map.oncology = { ...base, rejectionRate: 0.07 };
  map.hematology = { ...base, rejectionRate: 0.08 };
  map.rareDisease = { ...base, rejectionRate: 0.06 };
  map.neurology = { ...base, rejectionRate: 0.11 };
  map.infectiousDisease = { ...base, rejectionRate: 0.08 };
  map.immunology = { ...base, rejectionRate: 0.09 };
  map.metabolic = { ...base, rejectionRate: 0.09 };
  map.cardiovascular = { ...base, rejectionRate: 0.10 };
  map.ophthalmology = { ...base, rejectionRate: 0.08 };
  map.womensHealth = { ...base, rejectionRate: 0.10 };
  map.dermatology = { ...base, rejectionRate: 0.09 };
  map.gastroenterology = { ...base, rejectionRate: 0.09 };
  return map;
})();

/**
 * TGA — rejection rates by TA (high FDA/EMA concordance ~90%)
 * Source: TGA Performance & Accountability Reports 2020-2024
 */
const TGA_PARAMS: TAParamMap = (() => {
  const base: AgencyTAParams = {
    rejectionRate: 0.04,
    reviewStandard: 8.5, // 255 calendar days
    reviewPriority: 5,   // 150 calendar days
    conditionalFailureRate: 0.12,
  };
  const map = defaultTAParams(base);
  map.oncology = { ...base, rejectionRate: 0.03 };
  map.neurology = { ...base, rejectionRate: 0.05 };
  map.rareDisease = { ...base, rejectionRate: 0.03 };
  map.hematology = { ...base, rejectionRate: 0.03 };
  map.immunology = { ...base, rejectionRate: 0.04 };
  map.infectiousDisease = { ...base, rejectionRate: 0.03 };
  return map;
})();

/**
 * Health Canada — NON/NOC refusal rates by TA
 * Source: Health Canada Drug Submission Performance Annual Reports 2020-2024
 */
const HC_PARAMS: TAParamMap = (() => {
  const base: AgencyTAParams = {
    rejectionRate: 0.06,
    reviewStandard: 10, // 300 calendar days
    reviewPriority: 6,  // 180 calendar days
    conditionalFailureRate: 0.14,
  };
  const map = defaultTAParams(base);
  map.oncology = { ...base, rejectionRate: 0.04 };
  map.neurology = { ...base, rejectionRate: 0.07 };
  map.rareDisease = { ...base, rejectionRate: 0.04 };
  map.hematology = { ...base, rejectionRate: 0.05 };
  map.immunology = { ...base, rejectionRate: 0.05 };
  map.infectiousDisease = { ...base, rejectionRate: 0.05 };
  map.cardiovascular = { ...base, rejectionRate: 0.07 };
  return map;
})();

/**
 * Swissmedic — refusal rates by TA (high EMA alignment ~90%)
 * Source: Swissmedic Annual Reports 2020-2024
 */
const SWISS_PARAMS: TAParamMap = (() => {
  const base: AgencyTAParams = {
    rejectionRate: 0.04,
    reviewStandard: 11,  // 330 calendar days
    reviewPriority: 4.7, // 140 calendar days (fast-track)
    conditionalFailureRate: 0.13,
  };
  const map = defaultTAParams(base);
  map.oncology = { ...base, rejectionRate: 0.03 };
  map.neurology = { ...base, rejectionRate: 0.05 };
  map.rareDisease = { ...base, rejectionRate: 0.03 };
  map.hematology = { ...base, rejectionRate: 0.03 };
  map.immunology = { ...base, rejectionRate: 0.04 };
  map.infectiousDisease = { ...base, rejectionRate: 0.03 };
  return map;
})();

const AGENCY_TA_PARAMS: Record<Exclude<Agency, 'FDA'>, TAParamMap> = {
  EMA: EMA_PARAMS,
  PMDA: PMDA_PARAMS,
  NMPA: NMPA_PARAMS,
  TGA: TGA_PARAMS,
  HealthCanada: HC_PARAMS,
  Swissmedic: SWISS_PARAMS,
};

// ---------------------------------------------------------------------------
// Phase multiplier (reused for non-FDA agencies)
// ---------------------------------------------------------------------------

const PHASE_MULTIPLIER: Record<string, number> = {
  discovery: 0.15,
  preclinical: 0.20,
  phase1: 0.30,
  phase1_2: 0.35,
  phase2: 0.45,
  phase2_3: 0.55,
  phase3: 0.55,
  nda_filed: 1.00,
  approved: 0.00,
};

// ---------------------------------------------------------------------------
// Modality & Indication Adjustments (shared across agencies)
// ---------------------------------------------------------------------------

const NOVEL_MECHANISM_MODALITIES: Set<string> = new Set([
  'carT_heme', 'carT_solid', 'cellTherapy', 'geneTherapy',
  'mrna', 'rnai', 'protac', 'molecularGlue', 'oncolyticVirus',
  'bbbPlatform', 'aso', 'psychedelic', 'inVivoCarT', 'carTreg',
  'carT_autoimmune', 'radiopharmaceutical', 'oligonucleotide',
]);

const COMPLEX_ENDPOINT_INDICATIONS: Set<string> = new Set([
  'alzheimers', 'alzheimers_early', 'alzheimers_mild',
  'parkinsons', 'als', 'huntingtons',
  'depression', 'mdd', 'trd', 'schizophrenia', 'bipolar',
  'ptsd', 'anxiety', 'ocd',
  'obesity', 'nash', 'mash',
  'fibromyalgia', 'chronic_pain', 'migraine_chronic',
  'irritable_bowel', 'functional_dyspepsia',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round(v: number, d: number = 4): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

function pctLabel(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

function riskLabel(p: number): string {
  if (p >= 0.15) return 'Elevated';
  if (p >= 0.08) return 'Moderate';
  if (p >= 0.04) return 'Low';
  return 'Very Low';
}

// ---------------------------------------------------------------------------
// Designation Mapping Across Agencies
// ---------------------------------------------------------------------------

interface DesignationInput {
  breakthrough: boolean;
  fastTrack: boolean;
  orphan: boolean;
  prime?: boolean;
  acceleratedApproval?: boolean;
  priorityReview?: boolean;
  rarePediatric?: boolean;
}

interface AgencyDesignation {
  name: string;
  active: boolean;
  impact: string;
  rejectionAdjust_pp: number;
  timelineAdjust_years: number;
  reviewType?: 'priority' | 'accelerated';
}

function mapDesignations(
  agency: Agency,
  input: DesignationInput,
): AgencyDesignation[] {
  switch (agency) {
    case 'FDA':
      return mapFDADesignations(input);
    case 'EMA':
      return mapEMADesignations(input);
    case 'PMDA':
      return mapPMDADesignations(input);
    case 'NMPA':
      return mapNMPADesignations(input);
    case 'TGA':
      return mapTGADesignations(input);
    case 'HealthCanada':
      return mapHCDesignations(input);
    case 'Swissmedic':
      return mapSwissDesignations(input);
  }
}

function mapFDADesignations(d: DesignationInput): AgencyDesignation[] {
  const out: AgencyDesignation[] = [];
  out.push({
    name: 'Breakthrough Therapy',
    active: d.breakthrough,
    impact: 'Intensive FDA guidance, rolling review eligibility, -3pp CRL',
    rejectionAdjust_pp: d.breakthrough ? -0.03 : 0,
    timelineAdjust_years: d.breakthrough ? -0.25 : 0,
  });
  out.push({
    name: 'Fast Track',
    active: d.fastTrack,
    impact: 'Rolling review, frequent FDA meetings, -1pp CRL',
    rejectionAdjust_pp: d.fastTrack ? -0.01 : 0,
    timelineAdjust_years: d.fastTrack ? -0.17 : 0,
  });
  out.push({
    name: 'Orphan Drug',
    active: d.orphan,
    impact: '7-year exclusivity, tax credits, waived PDUFA fees, -2pp CRL',
    rejectionAdjust_pp: d.orphan ? -0.02 : 0,
    timelineAdjust_years: d.orphan ? -0.08 : 0,
  });
  out.push({
    name: 'Accelerated Approval',
    active: !!d.acceleratedApproval,
    impact: 'Surrogate/intermediate endpoint, confirmatory trial required',
    rejectionAdjust_pp: 0,
    timelineAdjust_years: d.acceleratedApproval ? -0.50 : 0,
    reviewType: d.acceleratedApproval ? 'accelerated' : undefined,
  });
  out.push({
    name: 'Priority Review',
    active: !!d.priorityReview,
    impact: '6-month review vs 10-month standard',
    rejectionAdjust_pp: 0,
    timelineAdjust_years: d.priorityReview ? -0.33 : 0,
    reviewType: d.priorityReview ? 'priority' : undefined,
  });
  out.push({
    name: 'Rare Pediatric Disease',
    active: !!d.rarePediatric,
    impact: 'PRV eligibility upon approval',
    rejectionAdjust_pp: 0,
    timelineAdjust_years: 0,
  });
  return out;
}

function mapEMADesignations(d: DesignationInput): AgencyDesignation[] {
  const out: AgencyDesignation[] = [];
  // Breakthrough maps to PRIME in EMA
  out.push({
    name: 'PRIME (Priority Medicines)',
    active: d.breakthrough || !!d.prime,
    impact: 'Early dialogue, rolling review, accelerated assessment eligibility, -20% review time',
    rejectionAdjust_pp: (d.breakthrough || d.prime) ? -0.02 : 0,
    timelineAdjust_years: (d.breakthrough || d.prime) ? -0.37 : 0, // ~20% of 11 months = 2.2mo = 0.18yr, plus rolling review benefit
    reviewType: (d.breakthrough || d.prime) ? 'accelerated' : undefined,
  });
  out.push({
    name: 'Orphan Designation',
    active: d.orphan,
    impact: '10-year market exclusivity, fee reductions, protocol assistance',
    rejectionAdjust_pp: d.orphan ? -0.02 : 0,
    timelineAdjust_years: d.orphan ? -0.08 : 0,
  });
  out.push({
    name: 'Accelerated Assessment',
    active: !!d.priorityReview || d.breakthrough || !!d.prime,
    impact: '150 days assessment vs 210 days standard (excludes clock-stops)',
    rejectionAdjust_pp: 0,
    timelineAdjust_years: 0, // already captured in PRIME
    reviewType: 'accelerated',
  });
  out.push({
    name: 'Conditional Marketing Authorisation',
    active: !!d.acceleratedApproval,
    impact: 'Conditional MA with annual renewal, confirmatory commitments',
    rejectionAdjust_pp: 0,
    timelineAdjust_years: d.acceleratedApproval ? -0.33 : 0,
  });
  return out;
}

function mapPMDADesignations(d: DesignationInput): AgencyDesignation[] {
  const out: AgencyDesignation[] = [];
  // Breakthrough maps to SAKIGAKE
  out.push({
    name: 'SAKIGAKE Designation',
    active: d.breakthrough,
    impact: 'Priority consultation, 6-month review (vs 12 standard), pre-submission support',
    rejectionAdjust_pp: d.breakthrough ? -0.02 : 0,
    timelineAdjust_years: d.breakthrough ? -0.50 : 0, // 12mo -> 6mo = 0.5yr
    reviewType: d.breakthrough ? 'priority' : undefined,
  });
  out.push({
    name: 'Orphan Drug Designation',
    active: d.orphan,
    impact: 'Priority review, tax credits, 10-year re-examination period extension',
    rejectionAdjust_pp: d.orphan ? -0.02 : 0,
    timelineAdjust_years: d.orphan ? -0.17 : 0,
    reviewType: d.orphan ? 'priority' : undefined,
  });
  out.push({
    name: 'Priority Review',
    active: !!d.priorityReview || d.fastTrack,
    impact: '9-month review (vs 12 standard)',
    rejectionAdjust_pp: 0,
    timelineAdjust_years: (d.priorityReview || d.fastTrack) ? -0.25 : 0,
    reviewType: 'priority',
  });
  out.push({
    name: 'Conditional Early Approval',
    active: !!d.acceleratedApproval,
    impact: 'Conditional approval with post-market confirmatory requirements',
    rejectionAdjust_pp: 0,
    timelineAdjust_years: d.acceleratedApproval ? -0.33 : 0,
  });
  return out;
}

function mapNMPADesignations(d: DesignationInput): AgencyDesignation[] {
  const out: AgencyDesignation[] = [];
  // Breakthrough maps directly (NMPA has its own breakthrough category since 2020)
  out.push({
    name: 'Breakthrough Therapy Designation',
    active: d.breakthrough,
    impact: '130-day expedited review, pre-submission communication, rolling submission',
    rejectionAdjust_pp: d.breakthrough ? -0.03 : 0,
    timelineAdjust_years: d.breakthrough ? -0.42 : 0, // 10mo -> 5mo
    reviewType: d.breakthrough ? 'accelerated' : undefined,
  });
  out.push({
    name: 'Rare Disease List (China)',
    active: d.orphan,
    impact: 'Expedited review if on China Rare Disease List, fee reductions',
    rejectionAdjust_pp: d.orphan ? -0.02 : 0,
    timelineAdjust_years: d.orphan ? -0.17 : 0,
  });
  out.push({
    name: 'Priority Review',
    active: !!d.priorityReview || d.fastTrack,
    impact: 'Priority review pathway, reduced review timeline',
    rejectionAdjust_pp: 0,
    timelineAdjust_years: (d.priorityReview || d.fastTrack) ? -0.25 : 0,
    reviewType: 'priority',
  });
  out.push({
    name: 'Conditional Approval',
    active: !!d.acceleratedApproval,
    impact: 'Conditional approval for serious conditions, confirmatory studies required',
    rejectionAdjust_pp: 0,
    timelineAdjust_years: d.acceleratedApproval ? -0.25 : 0,
  });
  return out;
}

function mapTGADesignations(d: DesignationInput): AgencyDesignation[] {
  const out: AgencyDesignation[] = [];
  // TGA relies heavily on FDA/EMA reference decisions
  out.push({
    name: 'Priority Review',
    active: d.breakthrough || !!d.priorityReview,
    impact: '150-day priority review (vs 255-day standard), reference agency alignment',
    rejectionAdjust_pp: (d.breakthrough || d.priorityReview) ? -0.01 : 0,
    timelineAdjust_years: (d.breakthrough || d.priorityReview) ? -0.29 : 0, // 8.5mo -> 5mo
    reviewType: (d.breakthrough || d.priorityReview) ? 'priority' : undefined,
  });
  out.push({
    name: 'Orphan Drug Designation',
    active: d.orphan,
    impact: 'Expedited review, fee reductions, reference to FDA/EMA orphan decisions',
    rejectionAdjust_pp: d.orphan ? -0.01 : 0,
    timelineAdjust_years: d.orphan ? -0.08 : 0,
  });
  out.push({
    name: 'Provisional Approval',
    active: !!d.acceleratedApproval,
    impact: '2-year conditional approval with confirmatory evidence requirements',
    rejectionAdjust_pp: 0,
    timelineAdjust_years: d.acceleratedApproval ? -0.25 : 0,
  });
  return out;
}

function mapHCDesignations(d: DesignationInput): AgencyDesignation[] {
  const out: AgencyDesignation[] = [];
  out.push({
    name: 'Priority Review',
    active: d.breakthrough || !!d.priorityReview,
    impact: '180-day priority review (vs 300-day standard)',
    rejectionAdjust_pp: (d.breakthrough || d.priorityReview) ? -0.02 : 0,
    timelineAdjust_years: (d.breakthrough || d.priorityReview) ? -0.33 : 0, // 10mo -> 6mo
    reviewType: (d.breakthrough || d.priorityReview) ? 'priority' : undefined,
  });
  out.push({
    name: 'Orphan Drug Status',
    active: d.orphan,
    impact: 'Expedited review consideration, potential fee reductions',
    rejectionAdjust_pp: d.orphan ? -0.01 : 0,
    timelineAdjust_years: d.orphan ? -0.08 : 0,
  });
  out.push({
    name: 'Notice of Compliance with Conditions (NOC/c)',
    active: !!d.acceleratedApproval,
    impact: 'Conditional approval with post-market commitments, confirmatory studies',
    rejectionAdjust_pp: 0,
    timelineAdjust_years: d.acceleratedApproval ? -0.25 : 0,
  });
  return out;
}

function mapSwissDesignations(d: DesignationInput): AgencyDesignation[] {
  const out: AgencyDesignation[] = [];
  // Swissmedic aligns closely with EMA (~90% concordance)
  out.push({
    name: 'Fast-Track Authorisation',
    active: d.breakthrough || !!d.priorityReview,
    impact: '140-day fast-track review (vs 330-day standard), EMA reference considered',
    rejectionAdjust_pp: (d.breakthrough || d.priorityReview) ? -0.01 : 0,
    timelineAdjust_years: (d.breakthrough || d.priorityReview) ? -0.53 : 0, // 11mo -> 4.7mo
    reviewType: (d.breakthrough || d.priorityReview) ? 'priority' : undefined,
  });
  out.push({
    name: 'Orphan Drug Designation',
    active: d.orphan,
    impact: 'Simplified application, fee reductions, EMA orphan decision recognized',
    rejectionAdjust_pp: d.orphan ? -0.01 : 0,
    timelineAdjust_years: d.orphan ? -0.08 : 0,
  });
  out.push({
    name: 'Temporary Authorisation',
    active: !!d.acceleratedApproval,
    impact: 'Temporary authorisation for unmet medical need, confirmatory data required',
    rejectionAdjust_pp: 0,
    timelineAdjust_years: d.acceleratedApproval ? -0.33 : 0,
  });
  return out;
}

// ---------------------------------------------------------------------------
// Non-FDA Agency Risk Computation
// ---------------------------------------------------------------------------

/**
 * Compute rejection probability for a non-FDA agency, applying phase,
 * modality, indication, and designation adjustments.
 */
function computeNonFDARejection(
  agency: Exclude<Agency, 'FDA'>,
  phase: string,
  ta: TherapeuticArea,
  modality: string,
  indication: string,
  designations: AgencyDesignation[],
): number {
  const params = AGENCY_TA_PARAMS[agency][ta];
  const phaseMult = PHASE_MULTIPLIER[phase] ?? 0.50;

  let rejection = params.rejectionRate * phaseMult;

  // Novel mechanism: +2pp (slightly less than FDA's +3pp due to reference
  // agency precedent reducing novelty uncertainty)
  if (NOVEL_MECHANISM_MODALITIES.has(modality)) {
    rejection += 0.02 * phaseMult;
  }

  // Complex endpoint: +3pp (less than FDA's +4pp because non-FDA agencies
  // often reference FDA endpoint decisions)
  if (COMPLEX_ENDPOINT_INDICATIONS.has(indication)) {
    rejection += 0.03 * phaseMult;
  }

  // NMPA additional: cross-border data acceptance friction
  if (agency === 'NMPA') {
    rejection += 0.02 * phaseMult; // ICH adoption still evolving
  }

  // PMDA additional: bridging study requirement for non-Japanese data
  if (agency === 'PMDA') {
    rejection += 0.01 * phaseMult; // ICH E5 bridging friction
  }

  // Apply designation adjustments
  for (const d of designations) {
    if (d.active) {
      rejection += d.rejectionAdjust_pp;
    }
  }

  return clamp01(round(rejection));
}

/**
 * Compute timeline impact for a non-FDA agency, combining base review
 * duration against standard expectations plus designation effects.
 */
function computeNonFDATimeline(
  agency: Exclude<Agency, 'FDA'>,
  ta: TherapeuticArea,
  modality: string,
  indication: string,
  rejectionProb: number,
  designations: AgencyDesignation[],
): number {
  let impact = 0;

  // Expected rejection delay: rejectionProb * mean resolution time
  // Non-FDA agencies: ~8 months average CRL/refusal resolution
  impact += rejectionProb * 0.67;

  // Novel mechanism: additional review complexity
  if (NOVEL_MECHANISM_MODALITIES.has(modality)) {
    impact += 0.12;
  }

  // Complex endpoints
  if (COMPLEX_ENDPOINT_INDICATIONS.has(indication)) {
    impact += 0.06;
  }

  // PMDA bridging study overhead for ex-Japan data
  if (agency === 'PMDA') {
    impact += 0.50; // ICH E5 bridging adds ~6 months
  }

  // NMPA cross-border acceptance friction
  if (agency === 'NMPA') {
    impact += 0.33; // ~4 months for supplemental China-specific requirements
  }

  // Apply designation timeline benefits
  for (const d of designations) {
    if (d.active) {
      impact += d.timelineAdjust_years;
    }
  }

  return round(impact, 2);
}

/**
 * Determine the current review type based on designations.
 */
function determineReviewType(
  designations: AgencyDesignation[],
): 'standard' | 'priority' | 'accelerated' {
  for (const d of designations) {
    if (d.active && d.reviewType === 'accelerated') return 'accelerated';
  }
  for (const d of designations) {
    if (d.active && d.reviewType === 'priority') return 'priority';
  }
  return 'standard';
}

// ---------------------------------------------------------------------------
// Expert Committee Assessment Per Agency
// ---------------------------------------------------------------------------

interface CommitteeInfo {
  required: boolean;
  favorableRate: number;
  label: string;
}

function assessExpertCommittee(
  agency: Agency,
  ta: TherapeuticArea,
  modality: string,
  indication: string,
  designations: DesignationInput,
): CommitteeInfo {
  switch (agency) {
    case 'FDA':
      // Handled by the existing module; we approximate here for the wrapper
      return {
        required: false, // will be overridden by actual FDA result
        favorableRate: 0.75,
        label: 'Advisory Committee (AdComm)',
      };
    case 'EMA':
      // CHMP always reviews (it IS the committee)
      return {
        required: true,
        favorableRate: computeEMAFavorableRate(ta, modality, indication, designations),
        label: 'CHMP (Committee for Medicinal Products for Human Use)',
      };
    case 'PMDA':
      // PMDA has expert committee review for new active substances
      return {
        required: true,
        favorableRate: computePMDAFavorableRate(ta, modality, indication),
        label: 'Pharmaceutical Affairs and Food Sanitation Council',
      };
    case 'NMPA':
      // CDE expert review committee
      return {
        required: true,
        favorableRate: computeNMPAFavorableRate(ta, modality, indication),
        label: 'CDE Expert Review Committee',
      };
    case 'TGA':
      // Advisory Committee on Prescription Medicines (ACPM) — not always convened
      return {
        required: isContestedIndication(indication),
        favorableRate: 0.92, // high concordance with FDA/EMA precedent
        label: 'Advisory Committee on Prescription Medicines (ACPM)',
      };
    case 'HealthCanada':
      // Scientific Advisory Committees — selectively convened
      return {
        required: isContestedIndication(indication),
        favorableRate: 0.88,
        label: 'Scientific Advisory Committee',
      };
    case 'Swissmedic':
      // Human Medicines Expert Committee (HMEC)
      return {
        required: true,
        favorableRate: 0.93, // high EMA alignment
        label: 'Human Medicines Expert Committee (HMEC)',
      };
  }
}

function isContestedIndication(indication: string): boolean {
  return COMPLEX_ENDPOINT_INDICATIONS.has(indication);
}

function computeEMAFavorableRate(
  ta: TherapeuticArea,
  modality: string,
  indication: string,
  designations: DesignationInput,
): number {
  // CHMP positive opinion base: ~95% (inverse of 5% rejection)
  let rate = 0.95;
  if (NOVEL_MECHANISM_MODALITIES.has(modality)) rate -= 0.03;
  if (COMPLEX_ENDPOINT_INDICATIONS.has(indication)) rate -= 0.05;
  if (ta === 'neurology') rate -= 0.02;
  if (designations.breakthrough || designations.prime) rate += 0.02;
  if (designations.orphan) rate += 0.02;
  return clamp01(round(rate));
}

function computePMDAFavorableRate(
  ta: TherapeuticArea,
  modality: string,
  indication: string,
): number {
  let rate = 0.95;
  if (NOVEL_MECHANISM_MODALITIES.has(modality)) rate -= 0.03;
  if (COMPLEX_ENDPOINT_INDICATIONS.has(indication)) rate -= 0.04;
  if (ta === 'neurology') rate -= 0.02;
  return clamp01(round(rate));
}

function computeNMPAFavorableRate(
  ta: TherapeuticArea,
  modality: string,
  indication: string,
): number {
  // Lower base than EMA/PMDA reflecting higher overall NMPA rejection
  let rate = 0.91;
  if (NOVEL_MECHANISM_MODALITIES.has(modality)) rate -= 0.04;
  if (COMPLEX_ENDPOINT_INDICATIONS.has(indication)) rate -= 0.05;
  if (ta === 'neurology') rate -= 0.03;
  return clamp01(round(rate));
}

// ---------------------------------------------------------------------------
// FDA Result -> AgencyRegulatoryRisk Adapter
// ---------------------------------------------------------------------------

function wrapFDAResult(
  fdaResult: RegulatoryRiskResult,
  designationInput: DesignationInput,
): AgencyRegulatoryRisk {
  const desigs = mapDesignations('FDA', designationInput);

  return {
    agency: 'FDA',
    agencyFullName: AGENCY_META.FDA.fullName,
    territory: AGENCY_META.FDA.territory,
    rejectionProbability: fdaResult.crlProbability,
    rejectionLabel: `CRL probability ${pctLabel(fdaResult.crlProbability)} (${riskLabel(fdaResult.crlProbability)})`,
    expertCommitteeRequired: fdaResult.adcommRequired,
    expertCommitteeFavorableRate: fdaResult.adcommFavorableVoteProbability,
    expertCommitteeLabel: 'Advisory Committee (AdComm)',
    standardReviewMonths: 10,
    priorityReviewMonths: 6,
    currentReviewType: designationInput.acceleratedApproval
      ? 'accelerated'
      : designationInput.priorityReview
        ? 'priority'
        : 'standard',
    designations: desigs.map((d) => ({
      name: d.name,
      active: d.active,
      impact: d.impact,
    })),
    conditionalApprovalAvailable: fdaResult.acceleratedApprovalRisk.eligible,
    conditionalApprovalLabel: 'Accelerated Approval',
    conditionalApprovalRisk: fdaResult.acceleratedApprovalRisk.confirmatoryFailureProbability,
    timelineImpact_years: fdaResult.timelineImpact_years,
    narrative: fdaResult.narrative,
  };
}

// ---------------------------------------------------------------------------
// Non-FDA Agency Risk Computation (Full)
// ---------------------------------------------------------------------------

function computeAgencyRisk(
  agency: Exclude<Agency, 'FDA'>,
  phase: string,
  ta: TherapeuticArea,
  modality: string,
  indication: string,
  designationInput: DesignationInput,
): AgencyRegulatoryRisk {
  const meta = AGENCY_META[agency];
  const params = AGENCY_TA_PARAMS[agency][ta];
  const desigs = mapDesignations(agency, designationInput);

  const rejectionProb = computeNonFDARejection(
    agency, phase, ta, modality, indication, desigs,
  );

  const committee = assessExpertCommittee(agency, ta, modality, indication, designationInput);

  const reviewType = determineReviewType(desigs);

  const timelineImpact = computeNonFDATimeline(
    agency, ta, modality, indication, rejectionProb, desigs,
  );

  // Agency-specific conditional approval details
  const conditionalLabels: Record<Exclude<Agency, 'FDA'>, string> = {
    EMA: 'Conditional Marketing Authorisation',
    PMDA: 'Conditional Early Approval',
    NMPA: 'Conditional Approval',
    TGA: 'Provisional Approval (2-year)',
    HealthCanada: 'Notice of Compliance with Conditions (NOC/c)',
    Swissmedic: 'Temporary Authorisation',
  };

  // Narrative for this agency
  const narrative = generateAgencyNarrative(
    agency, meta, rejectionProb, committee, reviewType,
    params, timelineImpact, desigs, ta,
  );

  return {
    agency,
    agencyFullName: meta.fullName,
    territory: meta.territory,
    rejectionProbability: rejectionProb,
    rejectionLabel: `${agencyRejectionTerm(agency)} probability ${pctLabel(rejectionProb)} (${riskLabel(rejectionProb)})`,
    expertCommitteeRequired: committee.required,
    expertCommitteeFavorableRate: committee.favorableRate,
    expertCommitteeLabel: committee.label,
    standardReviewMonths: params.reviewStandard,
    priorityReviewMonths: params.reviewPriority,
    currentReviewType: reviewType,
    designations: desigs.map((d) => ({
      name: d.name,
      active: d.active,
      impact: d.impact,
    })),
    conditionalApprovalAvailable: !!designationInput.acceleratedApproval,
    conditionalApprovalLabel: conditionalLabels[agency],
    conditionalApprovalRisk: params.conditionalFailureRate,
    timelineImpact_years: timelineImpact,
    narrative,
  };
}

function agencyRejectionTerm(agency: Agency): string {
  switch (agency) {
    case 'FDA': return 'CRL';
    case 'EMA': return 'CHMP negative opinion';
    case 'PMDA': return 'Non-approval';
    case 'NMPA': return 'Rejection';
    case 'TGA': return 'Rejection';
    case 'HealthCanada': return 'NON (Notice of Non-compliance)';
    case 'Swissmedic': return 'Refusal';
  }
}

// ---------------------------------------------------------------------------
// Agency-Level Narrative
// ---------------------------------------------------------------------------

function generateAgencyNarrative(
  agency: Exclude<Agency, 'FDA'>,
  meta: { fullName: string; territory: string },
  rejectionProb: number,
  committee: CommitteeInfo,
  reviewType: 'standard' | 'priority' | 'accelerated',
  params: AgencyTAParams,
  timelineImpact: number,
  designations: AgencyDesignation[],
  ta: TherapeuticArea,
): string {
  const parts: string[] = [];

  // Rejection risk
  const rejPct = pctLabel(rejectionProb);
  const term = agencyRejectionTerm(agency);
  parts.push(
    `${meta.fullName} (${meta.territory}): ${term} probability ${rejPct} (${riskLabel(rejectionProb)}).`,
  );

  // Committee
  if (committee.required) {
    parts.push(
      `${committee.label} review required; favorable opinion rate ${pctLabel(committee.favorableRate)}.`,
    );
  }

  // Review pathway
  const reviewMonths = reviewType === 'standard'
    ? params.reviewStandard
    : params.reviewPriority;
  const reviewLabel = reviewType === 'standard' ? 'Standard' : reviewType === 'priority' ? 'Priority' : 'Accelerated';
  parts.push(
    `${reviewLabel} review pathway: ~${reviewMonths} months.`,
  );

  // Active designations
  const activeDesigs = designations.filter((d) => d.active);
  if (activeDesigs.length > 0) {
    const names = activeDesigs.map((d) => d.name).join(', ');
    parts.push(`Active designations: ${names}.`);
  }

  // Timeline
  if (timelineImpact < -0.10) {
    const months = Math.abs(timelineImpact * 12).toFixed(0);
    parts.push(`Net timeline: ${months}-month acceleration from expedited pathways.`);
  } else if (timelineImpact > 0.10) {
    const months = (timelineImpact * 12).toFixed(0);
    parts.push(`Net timeline: ${months}-month expected delay from regulatory complexity.`);
  } else {
    parts.push('Net timeline impact neutral relative to standard review.');
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Global Narrative
// ---------------------------------------------------------------------------

function generateGlobalNarrative(
  agencies: AgencyRegulatoryRisk[],
  territory: string,
  overallRisk: number,
  combinedTimeline: number,
): string {
  const parts: string[] = [];

  const scope = territory === 'global'
    ? 'a global deal'
    : territory === 'us_only'
      ? 'a US-only deal'
      : `a ${territory.replace(/_/g, ' ')} deal`;

  parts.push(`For ${scope}, regulatory risk is assessed across ${agencies.length} agenc${agencies.length === 1 ? 'y' : 'ies'}.`);

  // Primary agency highlight
  const primary = agencies[0];
  if (primary) {
    const weight = AGENCY_REVENUE_WEIGHT[primary.agency];
    const weightPct = weight ? `${(weight * 100).toFixed(0)}% of global revenue` : '';
    const rejTerm = agencyRejectionTerm(primary.agency);
    parts.push(
      `Primary regulatory risk: ${primary.agencyFullName} (${primary.territory}${weightPct ? `, ${weightPct}` : ''})`
      + ` with ${rejTerm} probability ${pctLabel(primary.rejectionProbability)}.`,
    );
  }

  // Secondary agencies summary
  const secondaries = agencies.slice(1);
  for (const ag of secondaries) {
    const rejTerm = agencyRejectionTerm(ag.agency);
    parts.push(
      `${ag.agency} (${ag.territory}): ${rejTerm} probability ${pctLabel(ag.rejectionProbability)},`
      + ` ${ag.currentReviewType} review ~${ag.currentReviewType === 'standard' ? ag.standardReviewMonths : ag.priorityReviewMonths} months.`,
    );
  }

  // Overall risk score
  parts.push(`Overall risk score: ${overallRisk.toFixed(1)}/100.`);

  // Combined timeline
  if (combinedTimeline < -0.10) {
    const months = Math.abs(combinedTimeline * 12).toFixed(0);
    parts.push(`Revenue-weighted timeline impact: ${months}-month net acceleration.`);
  } else if (combinedTimeline > 0.10) {
    const months = (combinedTimeline * 12).toFixed(0);
    parts.push(`Revenue-weighted timeline impact: ${months}-month net delay.`);
  } else {
    parts.push('Revenue-weighted timeline impact is neutral.');
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Main Export: computeGlobalRegulatoryRisk
// ---------------------------------------------------------------------------

/**
 * Compute a global multi-agency regulatory risk assessment.
 *
 * For each agency in the territory mapping:
 *   - FDA: delegates to the existing `computeRegulatoryRisk()` module
 *   - Non-FDA: computes agency-specific risk from base rates
 *
 * Returns a combined result with per-agency breakdowns, revenue-weighted
 * timeline impact, overall risk score, multi-agency narrative, and
 * backward-compatible FDA fields at the top level.
 *
 * @param phase - Current clinical development phase
 * @param therapeuticArea - Therapeutic area (one of 12 supported TAs)
 * @param modality - Drug modality
 * @param indication - Clinical indication key
 * @param regulatoryDesignations - Regulatory designations (FDA + international)
 * @param territory - Filing territory strategy (e.g., 'global', 'us_eu', 'japan')
 * @returns Global regulatory risk assessment
 *
 * @example
 * ```typescript
 * const risk = computeGlobalRegulatoryRisk(
 *   'phase3', 'oncology', 'adc', 'breast_her2',
 *   { breakthrough: true, fastTrack: false, orphan: false },
 *   'global',
 * );
 * // risk.agencies.length === 7
 * // risk.primary.agency === 'FDA'
 * // risk.overallRiskScore ~ 5.2
 * // risk.crlProbability === risk.primary.rejectionProbability (backward compat)
 * ```
 */
export function computeGlobalRegulatoryRisk(
  phase: Phase,
  therapeuticArea: TherapeuticArea,
  modality: Modality,
  indication: string,
  regulatoryDesignations: {
    breakthrough: boolean;
    fastTrack: boolean;
    orphan: boolean;
    prime?: boolean;
    acceleratedApproval?: boolean;
    priorityReview?: boolean;
    rarePediatric?: boolean;
  },
  territory: string,
): GlobalRegulatoryRiskResult {
  // Resolve agencies for this territory
  const agencyList = TERRITORY_AGENCIES[territory] ?? TERRITORY_AGENCIES.global;
  const primaryAgency = PRIMARY_AGENCY[territory] ?? 'FDA';

  // Normalize designation input
  const desigInput: DesignationInput = {
    breakthrough: regulatoryDesignations.breakthrough,
    fastTrack: regulatoryDesignations.fastTrack,
    orphan: regulatoryDesignations.orphan,
    prime: regulatoryDesignations.prime ?? false,
    acceleratedApproval: regulatoryDesignations.acceleratedApproval ?? false,
    priorityReview: regulatoryDesignations.priorityReview ?? false,
    rarePediatric: regulatoryDesignations.rarePediatric ?? false,
  };

  // Build FDA designations for the existing module
  const fdaDesigs: RegulatoryDesignations = {
    breakthrough: desigInput.breakthrough,
    fastTrack: desigInput.fastTrack,
    orphan: desigInput.orphan,
    acceleratedApproval: desigInput.acceleratedApproval ?? false,
    priorityReview: desigInput.priorityReview ?? false,
    rarePediatric: desigInput.rarePediatric ?? false,
  };

  // Compute per-agency results
  const agencyResults: AgencyRegulatoryRisk[] = [];
  let fdaResult: RegulatoryRiskResult | null = null;

  for (const agency of agencyList) {
    if (agency === 'FDA') {
      fdaResult = computeRegulatoryRisk(
        phase, therapeuticArea, modality, indication, fdaDesigs,
      );
      agencyResults.push(wrapFDAResult(fdaResult, desigInput));
    } else {
      agencyResults.push(
        computeAgencyRisk(agency, phase, therapeuticArea, modality, indication, desigInput),
      );
    }
  }

  // Sort: primary agency first, then by revenue weight descending
  agencyResults.sort((a, b) => {
    if (a.agency === primaryAgency) return -1;
    if (b.agency === primaryAgency) return 1;
    return (AGENCY_REVENUE_WEIGHT[b.agency] ?? 0) - (AGENCY_REVENUE_WEIGHT[a.agency] ?? 0);
  });

  const primaryResult = agencyResults[0];

  // Revenue-weighted combined timeline
  const totalWeight = agencyResults.reduce(
    (sum, ag) => sum + (AGENCY_REVENUE_WEIGHT[ag.agency] ?? 0.02),
    0,
  );
  const combinedTimeline = round(
    agencyResults.reduce(
      (sum, ag) =>
        sum + ag.timelineImpact_years * (AGENCY_REVENUE_WEIGHT[ag.agency] ?? 0.02),
      0,
    ) / (totalWeight || 1),
    2,
  );

  // Overall risk score (0-100): revenue-weighted rejection probability * 100
  const overallRisk = round(
    (agencyResults.reduce(
      (sum, ag) =>
        sum + ag.rejectionProbability * (AGENCY_REVENUE_WEIGHT[ag.agency] ?? 0.02),
      0,
    ) / (totalWeight || 1)) * 100,
    1,
  );

  // Global narrative
  const narrative = generateGlobalNarrative(
    agencyResults, territory, overallRisk, combinedTimeline,
  );

  // Backward-compatible FDA fields: use FDA result if available, else primary
  const fdaCompat = fdaResult ?? null;
  const primaryFDA = agencyResults.find((a) => a.agency === 'FDA');

  return {
    primary: primaryResult,
    agencies: agencyResults,
    combinedTimelineImpact_years: combinedTimeline,
    overallRiskScore: overallRisk,
    narrative,

    // Backward compat fields (from FDA if present, else primary agency)
    crlProbability: fdaCompat?.crlProbability ?? primaryResult.rejectionProbability,
    adcommRequired: fdaCompat?.adcommRequired ?? primaryResult.expertCommitteeRequired,
    adcommFavorableVoteProbability:
      fdaCompat?.adcommFavorableVoteProbability ?? primaryResult.expertCommitteeFavorableRate,
    pdufahRisk: fdaCompat?.pdufahRisk ?? { onTime: 0.85, delay3mo: 0.10, delay6mo: 0.05 },
    prvEligible: fdaCompat?.prvEligible ?? false,
    prvValue_M: fdaCompat?.prvValue_M ?? 0,
    timelineImpact_years: fdaCompat?.timelineImpact_years ?? primaryResult.timelineImpact_years,
  };
}
