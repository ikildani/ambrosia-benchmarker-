// Partner Matching Service
// Matches user's asset profile to potential acquirers/licensees

import { SupabaseClient } from '@supabase/supabase-js';
import {
  DetailedScoreBreakdown,
  ScoreFactor,
  EvidenceLine,
  WatchOutFactor,
  RelevantDeal,
  StrategicContext,
  PatentCliff,
  EnhancedPartnerMatchData,
} from '@/types/partner-breakdown';
import { getRecencyWeight } from '@/lib/comparableDeals';
import { calculatePharmaIntent, type TrialForIntent, type PressReleaseForIntent, type ResearchSignalForIntent } from '@/lib/services/pharma-intent';

// Company profile shape (matches Supabase `companies` table columns used in scoring)
interface CompanyProfile {
  id: string;
  name: string;
  company_type: string | null;
  ticker: string | null;
  hq_country: string | null;
  modalities_active: string[];
  modalities_primary: string[];
  indications_active: string[];
  indications_specific: string[];
  deals_last_12mo: number;
  deals_last_24mo: number;
  last_deal_date: string | null;
  last_deal_modality: string | null;
  last_deal_indication: string | null;
  active_trials_count: number;
  avg_upfront_usd: number | null;
  median_upfront_usd: number | null;
  phase_preference_min: string | null;
  phase_preference_max: string | null;
  acquisition_appetite: string | null;
  actively_acquiring: boolean;
  strategic_priorities: string[];
  territory_focus: string[];
  data_quality_score: number;
  patent_cliffs: unknown;
  revenue_at_risk_2025: number;
  revenue_at_risk_2026: number;
  revenue_at_risk_2027: number;
}

// Deal shape for enrichment queries
interface CompanyDeal {
  id: string;
  asset_name: string | null;
  licensor_id: string;
  licensee_id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  modality: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  phase_at_signing: string | null;
  total_deal_value_usd: number | null;
  upfront_usd: number | null;
  announced_date: string;
  deal_type: string | null;
  territory: string | null;
}

// Scoring weights - tuned for deal relevance with strategic need parity
const WEIGHTS = {
  // Modality alignment (max 40 points)
  modality_exact: 40,
  modality_primary: 35,
  modality_adjacent: 20,

  // Indication alignment (max 30 points)
  indication_specific_exact: 30,
  indication_category_exact: 20,
  indication_category_adjacent: 10,

  // Phase preference (max 18 points) - increased, with sweet-spot bonus
  phase_in_range: 15,
  phase_sweet_spot: 18,  // When asset is in the company's preferred phase range center
  phase_adjacent: 8,

  // Activity signals (max 20 points) - reduced from 25 to balance with strategic need
  deal_last_6mo: 12,
  deal_last_12mo: 8,
  deal_last_24mo: 4,
  active_trials_relevant: 8,

  // Strategic need (max 20 points) - NEW: patent cliff urgency and pipeline gaps
  strategic_patent_cliff: 15,
  strategic_pipeline_gap: 10,
  strategic_priority_match: 8,

  // Territory alignment (max 15 points)
  territory_match: 15,
  territory_partial: 8,

  // Company quality bonus (max 10 points)
  data_quality_high: 5,
  actively_acquiring: 5,

  // Company capacity (max 8 points) - large pharma for late-stage, biotech for early-stage
  company_capacity: 8,

  // Deal size matching (max 10 points) - company's historical deal sizes match asset phase
  deal_size_match: 10,

  // Regulatory designation match (max 5 points) - company priorities align with designations
  regulatory_match: 5,
};

// Modality adjacency map - related modalities that indicate interest
const MODALITY_ADJACENCY: Record<string, string[]> = {
  'adc': ['antibody', 'bispecific', 'small_molecule'],
  'bispecific': ['antibody', 'adc'],
  'antibody': ['adc', 'bispecific', 'tau_targeting'],
  'car_t': ['cell_therapy', 'gene_therapy', 'antibody'],
  'cell_therapy': ['car_t', 'gene_therapy', 'stem_cell'],
  'gene_therapy': ['cell_therapy', 'mrna', 'oligonucleotide', 'aso', 'stem_cell'],
  'mrna': ['gene_therapy', 'vaccine', 'oligonucleotide'],
  'radiopharm': ['antibody', 'small_molecule', 'peptide'],
  'small_molecule': ['peptide', 'ion_channel', 'psychedelic'],
  'oligonucleotide': ['gene_therapy', 'mrna', 'aso', 'rnai'],
  'peptide': ['small_molecule', 'antibody'],
  'vaccine': ['mrna', 'antibody'],
  'aso': ['oligonucleotide', 'gene_therapy', 'rnai'],
  'bbb_platform': ['antibody', 'gene_therapy', 'aso', 'small_molecule', 'peptide'],
  'psychedelic': ['small_molecule', 'ion_channel'],
  'ion_channel': ['small_molecule', 'psychedelic', 'peptide'],
  'tau_targeting': ['antibody', 'small_molecule', 'aso'],
  'stem_cell': ['cell_therapy', 'gene_therapy'],
  'rnai': ['oligonucleotide', 'aso', 'gene_therapy', 'mrna'],
  // Metabolic modalities map to core types but also cross-link
  'sglt2_inhibitor': ['small_molecule', 'peptide'],
};

// Indication category adjacency (includes neurology and immunology sub-indication cross-links)
const INDICATION_ADJACENCY: Record<string, string[]> = {
  'solid_tumor': ['hematological'],
  'hematological': ['solid_tumor', 'autoimmune'],
  'autoimmune': ['hematological', 'dermatology', 'rare_disease', 'cns', 'ibd', 'nephrology', 'rheumatology', 'neuromuscular'],
  'cns': ['rare_disease', 'autoimmune', 'cardiovascular', 'metabolic', 'pain', 'neuromuscular'],
  'rare_disease': ['cns', 'metabolic', 'rare_neurological', 'nephrology'],
  'infectious': ['vaccine'],
  'metabolic': ['cardiovascular', 'rare_disease', 'cns'],
  'cardiovascular': ['metabolic', 'cns'],
  'respiratory': ['infectious', 'autoimmune'],
  'dermatology': ['autoimmune', 'rheumatology'],
  'ophthalmology': ['rare_disease', 'cns'],
  // Neurology sub-indication adjacency
  'alzheimers': ['parkinsons', 'rare_neurological', 'cns'],
  'parkinsons': ['alzheimers', 'tremor', 'rare_neurological', 'cns'],
  'schizophrenia': ['depression', 'addiction', 'cns'],
  'depression': ['schizophrenia', 'addiction', 'pain', 'cns'],
  'pain': ['depression', 'cns', 'epilepsy', 'migraine'],
  'multiple_sclerosis': ['autoimmune', 'rare_neurological', 'cns', 'neuromuscular'],
  'epilepsy': ['rare_neurological', 'pain', 'cns'],
  'rare_neurological': ['alzheimers', 'parkinsons', 'epilepsy', 'rare_disease', 'cns'],
  'als': ['rare_neurological', 'parkinsons', 'cns'],
  'huntingtons': ['rare_neurological', 'als', 'cns'],
  'migraine': ['pain', 'cns'],
  'narcolepsy': ['depression', 'cns'],
  'tremor': ['parkinsons', 'epilepsy', 'cns'],
  'tbi': ['pain', 'rare_neurological', 'cns'],
  'addiction': ['depression', 'schizophrenia', 'pain', 'cns'],
  // Immunology sub-indication adjacency
  'ibd': ['autoimmune', 'rheumatology', 'dermatology'],
  'rheumatology': ['autoimmune', 'dermatology', 'ibd', 'nephrology'],
  'nephrology': ['autoimmune', 'rare_disease', 'rheumatology', 'hematological'],
  'neuromuscular': ['autoimmune', 'cns', 'rare_disease', 'multiple_sclerosis'],
  'complement': ['autoimmune', 'hematological', 'nephrology', 'rare_disease'],
  // Metabolic sub-indication adjacency
  'obesity': ['metabolic', 'cardiovascular', 'type2_diabetes', 'nash_mash'],
  'type2_diabetes': ['metabolic', 'obesity', 'cardiovascular', 'nash_mash'],
  'nash_mash': ['metabolic', 'obesity', 'rare_disease'],
  'metabolic_syndrome': ['metabolic', 'cardiovascular', 'obesity', 'type2_diabetes'],
  'lipodystrophy': ['metabolic', 'rare_disease', 'obesity'],
  'glycogen_storage': ['metabolic', 'rare_disease'],
  'pku': ['metabolic', 'rare_disease'],
  'rare_metabolic': ['metabolic', 'rare_disease', 'glycogen_storage', 'pku'],
};

// Map therapeutic areas to their associated indication categories
// Used to boost TA-aligned companies and penalize misaligned ones
const THERAPEUTIC_AREA_INDICATIONS: Record<string, string[]> = {
  'oncology': ['solid_tumor', 'hematological'],
  'neurology': ['cns', 'alzheimers', 'parkinsons', 'epilepsy', 'pain', 'multiple_sclerosis',
    'rare_neurological', 'als', 'huntingtons', 'migraine', 'narcolepsy', 'tremor',
    'tbi', 'addiction', 'schizophrenia', 'depression'],
  'immunology': ['autoimmune', 'dermatology', 'rheumatology', 'ibd', 'nephrology',
    'neuromuscular', 'complement'],
  'metabolic': ['metabolic', 'obesity', 'type2_diabetes', 'nash_mash', 'metabolic_syndrome',
    'lipodystrophy', 'glycogen_storage', 'pku', 'rare_metabolic'],
  'cardiovascular': ['cardiovascular', 'heart_failure', 'atherosclerosis', 'hypertension',
    'arrhythmia', 'thrombosis', 'pulmonary_hypertension', 'aortic_stenosis'],
  'infectiousDisease': ['infectious', 'hiv', 'hbv', 'hcv', 'tuberculosis', 'amr',
    'respiratory_infection', 'fungal', 'vaccine'],
  'ophthalmology': ['ophthalmology', 'retinal', 'macular_degeneration', 'glaucoma',
    'diabetic_retinopathy', 'uveitis', 'dry_eye', 'inherited_retinal'],
  'womensHealth': ['womens_health', 'endometriosis', 'uterine_fibroids', 'fertility',
    'menopause', 'preeclampsia', 'pcos', 'contraception', 'postpartum'],
  'rareDisease': ['rare_disease', 'genetic_disorders', 'orphan', 'enzyme_deficiency',
    'lysosomal_storage', 'neuromuscular'],
  'hematology': ['hematology', 'blood_disorders', 'lymphoma', 'leukemia', 'myeloma',
    'hemophilia', 'sickle_cell'],
  'dermatology': ['dermatology', 'skin', 'psoriasis', 'atopic_dermatitis', 'eczema',
    'alopecia', 'vitiligo'],
  'gastroenterology': ['gastroenterology', 'gi', 'ibd', 'crohns', 'ulcerative_colitis',
    'celiac', 'liver'],
};

const TA_LABELS: Record<string, string> = {
  'oncology': 'Oncology',
  'neurology': 'Neurology',
  'immunology': 'Immunology',
  'metabolic': 'Metabolic/Obesity',
  'cardiovascular': 'Cardiovascular',
  'infectiousDisease': 'Infectious Disease',
  'ophthalmology': 'Ophthalmology',
  'womensHealth': 'Women\'s Health',
  'rareDisease': 'Rare Disease',
  'hematology': 'Hematology',
  'dermatology': 'Dermatology',
  'gastroenterology': 'Gastroenterology',
};

// Phase ranking for comparison.
// Accepts both the user-facing camelCase form (phase1/phase2/phase3) and the
// legacy snake_case form (phase_1/phase_2/phase_3) so existing tests and any
// legacy deal data still resolve correctly.
const PHASE_RANK: Record<string, number> = {
  'discovery': 0,
  'preclinical': 1,
  'phase1': 2,
  'phase_1': 2,
  'phase1_2': 2.5,
  'phase_1_2': 2.5,
  'phase2': 3,
  'phase_2': 3,
  'phase2_3': 3.5,
  'phase_2_3': 3.5,
  'phase3': 4,
  'phase_3': 4,
  'nda_filed': 4.5,
  'approved': 5,
};

// ============================================================================
// STRATEGIC PRIORITY SEMANTIC MATCHING
// ============================================================================
// Maps user's asset profile to keyword families that would appear in corporate
// strategic priority statements. E.g., a user with modality="adc" should match
// priorities containing "antibody-drug conjugate", "ADC", "targeted payload", etc.

/** Keyword families for therapeutic area matching */
const TA_PRIORITY_KEYWORDS: Record<string, string[]> = {
  oncology: ['oncology', 'immuno-oncology', 'io ', 'tumor', 'cancer', 'hematology', 'malignancy', 'solid tumor', 'liquid tumor', 'checkpoint', 'pd-1', 'pd-l1'],
  neurology: ['neurology', 'neuroscience', 'cns', 'neurodegeneration', 'brain', 'alzheimer', 'parkinson', 'neuro ', 'neuropsych', 'psychiatry', 'mental health'],
  immunology: ['immunology', 'autoimmune', 'inflammation', 'immune', 'immunomodulat', 'dermatology', 'rheumatology', 'inflammatory bowel', 'ibd'],
  metabolic: ['metabolic', 'obesity', 'diabetes', 'weight management', 'cardiometabolic', 'nash', 'mash', 'glp-1', 'incretin', 'endocrine'],
  cardiovascular: ['cardiovascular', 'cardiology', 'heart failure', 'atherosclerosis', 'hypertension', 'thrombosis', 'anticoagulant', 'cv ', 'cardiac'],
  infectiousDisease: ['infectious', 'anti-infective', 'antiviral', 'antibiotic', 'antimicrobial', 'vaccine', 'pandemic', 'amr ', 'resistance'],
  ophthalmology: ['ophthalmology', 'ophthalmic', 'retinal', 'ocular', 'eye disease', 'macular', 'glaucoma', 'anti-vegf', 'vision'],
  womensHealth: ['women\'s health', 'gynecology', 'reproductive', 'fertility', 'endometriosis', 'uterine', 'menopause', 'contracepti', 'obstetric'],
  rareDisease: ['rare disease', 'orphan drug', 'gene therapy', 'enzyme replacement', 'genetic', 'ultra-rare', 'rare pediatric'],
  hematology: ['hematology', 'blood cancer', 'lymphoma', 'leukemia', 'myeloma', 'car-t', 'cell therapy', 'hemophilia', 'sickle cell'],
  dermatology: ['dermatology', 'skin', 'psoriasis', 'atopic dermatitis', 'eczema', 'il-17', 'il-13', 'jak inhibitor', 'topical'],
  gastroenterology: ['gastroenterology', 'gi', 'ibd', 'crohn', 'ulcerative colitis', 'tl1a', 'il-23', 'integrin', 'microbiome'],
};

/** Keyword families for modality matching */
const MODALITY_PRIORITY_KEYWORDS: Record<string, string[]> = {
  adc: ['adc', 'antibody-drug conjugate', 'antibody drug conjugate', 'targeted payload', 'conjugate'],
  bispecific: ['bispecific', 'bi-specific', 'dual-target', 'multispecific', 't-cell engager'],
  antibody: ['antibody', 'monoclonal', 'mab ', 'biologics', 'biologic'],
  car_t: ['car-t', 'car t', 'cell therapy', 'cell and gene', 'autologous', 'allogeneic', 'engineered cell'],
  cell_therapy: ['cell therapy', 'cell and gene', 'autologous', 'allogeneic', 'regenerative'],
  gene_therapy: ['gene therapy', 'cell and gene', 'gene editing', 'aav', 'viral vector', 'genome'],
  mrna: ['mrna', 'rna therapeutic', 'nucleic acid'],
  rnai: ['rnai', 'rna interference', 'sirna', 'rna therapeutic'],
  small_molecule: ['small molecule', 'oral ', 'oral therapy', 'chemical entit', 'synthetic'],
  radiopharm: ['radiopharm', 'radioligand', 'rlt', 'theranostic', 'nuclear medicine', 'radionuclide'],
  oligonucleotide: ['oligonucleotide', 'aso', 'antisense', 'nucleic acid', 'rna therapeutic'],
  peptide: ['peptide', 'cyclic peptide', 'stapled peptide'],
  protac: ['protac', 'protein degrader', 'degradation', 'molecular glue', 'targeted degradation'],
  molecular_glue: ['molecular glue', 'protein degrader', 'degradation', 'protac'],
  vaccine: ['vaccine', 'vaccination', 'immunization', 'prophylactic'],
  bbb_platform: ['brain delivery', 'bbb', 'blood-brain barrier', 'cns delivery', 'brain penetrant'],
  psychedelic: ['psychedelic', 'neuroplastogen', 'psilocybin', 'ketamine'],
  sglt2_inhibitor: ['sglt2', 'renal glucose', 'sodium-glucose'],
  glp1_agonist: ['glp-1', 'glp1', 'incretin', 'semaglutide', 'tirzepatide'],
  jak_inhibitor: ['jak ', 'janus kinase', 'jak inhibitor', 'tofacitinib', 'upadacitinib'],
};

/** Keyword families for treatment approach / combination strategy */
const APPROACH_PRIORITY_KEYWORDS: Record<string, string[]> = {
  combination: ['combination', 'combo ', 'backbone', 'add-on', 'complementary', 'synergy', 'combinatorial'],
  diseaseModifying: ['disease-modifying', 'disease modifying', 'curative', 'transformative', 'durable remission'],
  firstInClass: ['first-in-class', 'first in class', 'novel mechanism', 'new mechanism', 'novel target', 'new target', 'novel biology'],
  platform: ['platform', 'pipeline-in-a-product', 'multi-indication', 'multiple indication', 'extensible'],
  precision: ['precision', 'biomarker-driven', 'biomarker driven', 'personalized', 'companion diagnostic', 'targeted therapy'],
  rareDisease: ['orphan', 'rare disease', 'ultra-rare', 'unmet need'],
};

/** Score a company's strategic priorities text against the user's asset profile */
function matchStrategicPriorities(
  prioritiesText: string,
  input: MatchInput
): { score: number; reason: string } {
  if (!prioritiesText || prioritiesText.length === 0) {
    return { score: 0, reason: '' };
  }

  let totalScore = 0;
  const matchedAreas: string[] = [];

  // 1. Literal matching (original logic — fast path for exact hits)
  if (input.indication_category && prioritiesText.includes(input.indication_category.toLowerCase())) {
    totalScore += 4;
    matchedAreas.push('indication area');
  }
  if (input.indication_specific && prioritiesText.includes(input.indication_specific.replace(/_/g, ' ').toLowerCase())) {
    totalScore += 4;
    matchedAreas.push('specific indication');
  }
  if (input.modality && prioritiesText.includes(input.modality.replace(/_/g, ' ').toLowerCase())) {
    totalScore += 4;
    matchedAreas.push('modality');
  }

  // 2. Therapeutic area keyword matching
  if (input.therapeutic_area) {
    const taKeywords = TA_PRIORITY_KEYWORDS[input.therapeutic_area] || [];
    const taHits = taKeywords.filter(kw => prioritiesText.includes(kw));
    if (taHits.length >= 2) {
      totalScore += 4;
      matchedAreas.push('therapeutic area focus');
    } else if (taHits.length === 1) {
      totalScore += 2;
      if (!matchedAreas.includes('therapeutic area focus')) matchedAreas.push('therapeutic area');
    }
  }

  // 3. Modality keyword matching (broader than literal)
  const modalityKeywords = MODALITY_PRIORITY_KEYWORDS[input.modality] || [];
  const modalityHits = modalityKeywords.filter(kw => prioritiesText.includes(kw));
  if (modalityHits.length >= 1 && !matchedAreas.includes('modality')) {
    totalScore += 3;
    matchedAreas.push('modality strategy');
  }

  // 4. Treatment approach / strategic theme matching
  for (const [theme, keywords] of Object.entries(APPROACH_PRIORITY_KEYWORDS)) {
    const hits = keywords.filter(kw => prioritiesText.includes(kw));
    if (hits.length >= 1) {
      // Only score if the theme is relevant to the user's asset
      let relevant = false;
      if (theme === 'combination' && input.modality) relevant = true; // universal
      if (theme === 'diseaseModifying') relevant = true;
      if (theme === 'firstInClass') relevant = true;
      if (theme === 'platform') relevant = true;
      if (theme === 'precision') relevant = true;
      if (theme === 'rareDisease' && input.indication_category &&
          ['rare_disease', 'rare_neurological', 'rare_metabolic', 'complement'].includes(input.indication_category)) {
        relevant = true;
      }
      if (relevant) {
        totalScore += 2;
        matchedAreas.push(theme === 'firstInClass' ? 'novel mechanism focus' :
                         theme === 'diseaseModifying' ? 'disease-modifying focus' :
                         theme === 'rareDisease' ? 'rare disease focus' :
                         `${theme} strategy`);
        break; // Only count the best theme match
      }
    }
  }

  // Cap at max weight and build reason string
  const cappedScore = Math.min(WEIGHTS.strategic_priority_match, totalScore);
  const uniqueAreas = [...new Set(matchedAreas)];
  const reason = uniqueAreas.length > 0
    ? `Strategic priorities align with ${uniqueAreas.slice(0, 3).join(', ')}`
    : '';

  return { score: cappedScore, reason };
}

export interface MatchInput {
  modality: string;
  development_phase: string;
  indication_category: string | null;
  indication_specific: string | null;
  territory_scope: string | null;
  therapeutic_area: string | null;
  regulatory_designations?: {
    breakthrough?: boolean;
    fastTrack?: boolean;
    orphan?: boolean;
    prime?: boolean;
  };
}

export interface PartnerMatch {
  company_id: string;
  company_name: string;
  company_type: string | null;
  ticker: string | null;
  hq_country: string | null;
  match_score: number;
  match_reasons: MatchReason[];
  score_breakdown: ScoreBreakdown;

  // Profile data
  modalities_active: string[];
  modalities_primary: string[];
  indications_active: string[];
  indications_specific: string[];
  deals_last_12mo: number;
  deals_last_24mo: number;
  last_deal_date: string | null;
  last_deal_modality: string | null;
  last_deal_indication: string | null;
  active_trials_count: number;
  avg_upfront_usd: number | null;
  median_upfront_usd: number | null;
  phase_preference_min: string | null;
  phase_preference_max: string | null;
  acquisition_appetite: string | null;
  strategic_priorities: string[];
  data_quality_score: number;

  // Enhanced breakdown data (Pro tier only)
  detailed_breakdown?: DetailedScoreBreakdown;
  watch_outs?: WatchOutFactor[];
  relevant_deals?: RelevantDeal[];
  strategic_context?: StrategicContext;

  // Pharma Intent Score (Pro tier only)
  pharma_intent?: import('@/lib/services/pharma-intent').PharmaIntentResult | null;
}

export interface MatchReason {
  category: 'modality' | 'indication' | 'phase' | 'activity' | 'territory' | 'strategic' | 'deal_size' | 'regulatory';
  reason: string;
  strength: 'strong' | 'moderate' | 'weak';
}

export interface ScoreBreakdown {
  modality: number;
  indication: number;
  phase: number;
  activity: number;
  strategic: number;
  territory: number;
  quality: number;
  total: number;
}

export interface MatchResult {
  total_matches: number;
  matches: PartnerMatch[];
  query_params: MatchInput;
  generated_at: string;
}

export interface FindPartnerMatchesOptions {
  limit?: number;
  includeEnhancedBreakdown?: boolean; // Pro tier: include detailed breakdown, watch-outs, etc.
}

export async function findPartnerMatches(
  supabase: SupabaseClient,
  input: MatchInput,
  options: FindPartnerMatchesOptions = {}
): Promise<MatchResult> {
  const { limit = 50, includeEnhancedBreakdown = false } = options;
  // Fetch all actively acquiring companies with good data
  const { data: companies, error } = await supabase
    .from('companies')
    .select('*')
    .eq('actively_acquiring', true)
    .gte('data_quality_score', 20)
    .order('deals_last_12mo', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Failed to fetch companies:', error);
    throw new Error('Failed to fetch companies from database');
  }

  if (!companies || companies.length === 0) {
    return {
      total_matches: 0,
      matches: [],
      query_params: input,
      generated_at: new Date().toISOString(),
    };
  }

  // Score each company
  const scoredMatches: PartnerMatch[] = [];

  // Pre-fetch deals for all companies if enhanced breakdown is needed
  // This is more efficient than fetching per-company
  let companyDealsMap: Map<string, CompanyDeal[]> = new Map();
  let companyTrialsMap: Map<string, TrialForIntent[]> = new Map();
  let companyPressMap: Map<string, PressReleaseForIntent[]> = new Map();
  let companyResearchMap: Map<string, ResearchSignalForIntent[]> = new Map();
  if (includeEnhancedBreakdown) {
    const companyIds = companies.map((c) => c.id);

    // Pre-fetch deals and trials in parallel
    const [dealsResult, trialsResult] = await Promise.all([
      supabase
        .from('deals')
        .select(
          'id, asset_name, licensor_id, licensee_id, licensor_name, licensee_name, modality, indication_category, indication_specific, phase_at_signing, total_deal_value_usd, upfront_usd, announced_date, deal_type, territory'
        )
        .or(`licensor_id.in.(${companyIds.join(',')}),licensee_id.in.(${companyIds.join(',')})`)
        .gte('announced_date', new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('announced_date', { ascending: false }),
      supabase
        .from('company_trials')
        .select('company_id, modality, indication_category, indication_specific, phase, status, enrollment_count, is_collaboration, primary_completion_date')
        .in('company_id', companyIds)
        .in('status', ['recruiting', 'active_not_recruiting', 'not_yet_recruiting']),
    ]);

    if (dealsResult.data) {
      for (const deal of dealsResult.data as CompanyDeal[]) {
        const licensorDeals = companyDealsMap.get(deal.licensor_id) || [];
        licensorDeals.push(deal);
        companyDealsMap.set(deal.licensor_id, licensorDeals);

        const licenseeDeals = companyDealsMap.get(deal.licensee_id) || [];
        licenseeDeals.push(deal);
        companyDealsMap.set(deal.licensee_id, licenseeDeals);
      }
    }

    if (trialsResult.data) {
      for (const trial of trialsResult.data as TrialForIntent[]) {
        const trials = companyTrialsMap.get(trial.company_id) || [];
        trials.push(trial);
        companyTrialsMap.set(trial.company_id, trials);
      }
    }

    // Pre-fetch press releases and research signals for intent scoring
    // Wrapped in try/catch to never block partner matching
    const companyNames = companies.map((c) => (c as CompanyProfile).name).filter(Boolean);

    try {
      const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString();
      const twelveMonthsAgo = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000).toISOString();

      const [pressResult, researchResult] = await Promise.all([
        // Press releases: companies_mentioned overlaps with any company name (GIN index)
        supabase
          .from('press_releases')
          .select('headline, body_text, published_at, is_deal_announcement, companies_mentioned')
          .gte('published_at', sixMonthsAgo)
          .overlaps('companies_mentioned', companyNames)
          .order('published_at', { ascending: false })
          .limit(1000),
        // Research signals: organization_name matches any company name
        supabase
          .from('research_signals')
          .select('signal_type, therapeutic_area, funding_amount_usd, published_date, organization_name')
          .gte('published_date', twelveMonthsAgo)
          .in('organization_name', companyNames)
          .order('published_date', { ascending: false })
          .limit(1000),
      ]);

      if (pressResult.data) {
        for (const pr of pressResult.data as PressReleaseForIntent[]) {
          if (pr.companies_mentioned) {
            for (const companyName of pr.companies_mentioned) {
              // Find the matching company to get its ID for the map
              const matchedCompany = companies.find(
                (c) => (c as CompanyProfile).name === companyName
              ) as CompanyProfile | undefined;
              if (matchedCompany) {
                const existing = companyPressMap.get(matchedCompany.id) || [];
                existing.push(pr);
                companyPressMap.set(matchedCompany.id, existing);
              }
            }
          }
        }
      }

      if (researchResult.data) {
        for (const rs of researchResult.data as ResearchSignalForIntent[]) {
          if (rs.organization_name) {
            const matchedCompany = companies.find(
              (c) => (c as CompanyProfile).name === rs.organization_name
            ) as CompanyProfile | undefined;
            if (matchedCompany) {
              const existing = companyResearchMap.get(matchedCompany.id) || [];
              existing.push(rs);
              companyResearchMap.set(matchedCompany.id, existing);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[PartnerMatching] Non-blocking: failed to pre-fetch press/research signals:', err);
      // Maps remain empty — intent scoring will work without these signals
    }
  }

  for (const company of companies as CompanyProfile[]) {
    const { score, breakdown, reasons } = calculateMatchScore(company, input);

    // Apply quick watch-out penalties to all companies before filtering
    const quickWatchOuts = calculateQuickWatchOuts(company, input);
    const watchOutPenaltySum = quickWatchOuts.reduce((sum, w) => sum + w.impact, 0);
    const adjustedScore = Math.max(0, Math.round(score + watchOutPenaltySum * 0.5));

    // Only include meaningful matches (score >= 15)
    if (adjustedScore >= 15) {
      const match: PartnerMatch = {
        company_id: company.id,
        company_name: company.name,
        company_type: company.company_type,
        ticker: company.ticker,
        hq_country: company.hq_country,
        match_score: adjustedScore,
        match_reasons: reasons.slice(0, 4), // Top 4 reasons
        score_breakdown: breakdown,
        modalities_active: company.modalities_active || [],
        modalities_primary: company.modalities_primary || [],
        indications_active: company.indications_active || [],
        indications_specific: company.indications_specific || [],
        deals_last_12mo: company.deals_last_12mo || 0,
        deals_last_24mo: company.deals_last_24mo || 0,
        last_deal_date: company.last_deal_date,
        last_deal_modality: company.last_deal_modality,
        last_deal_indication: company.last_deal_indication,
        active_trials_count: company.active_trials_count || 0,
        avg_upfront_usd: company.avg_upfront_usd,
        median_upfront_usd: company.median_upfront_usd,
        phase_preference_min: company.phase_preference_min,
        phase_preference_max: company.phase_preference_max,
        acquisition_appetite: company.acquisition_appetite,
        strategic_priorities: company.strategic_priorities || [],
        data_quality_score: company.data_quality_score || 0,
      };

      // Add enhanced breakdown for Pro tier
      if (includeEnhancedBreakdown) {
        const companyDeals = companyDealsMap.get(company.id) || [];
        match.detailed_breakdown = buildDetailedBreakdown(company, input, breakdown, companyDeals);
        match.watch_outs = calculateWatchOuts(company, input, companyDeals);
        match.strategic_context = buildStrategicContext(company, input.therapeutic_area);
        // Sort deals by recency-weighted relevance (recent deals ranked higher)
        const sortedDeals = [...companyDeals].sort((a, b) => {
          const yearA = new Date(a.announced_date).getFullYear();
          const yearB = new Date(b.announced_date).getFullYear();
          return getRecencyWeight(yearB) - getRecencyWeight(yearA);
        });
        match.relevant_deals = sortedDeals.slice(0, 5).map((deal) => ({
          id: deal.id,
          asset_name: deal.asset_name || 'Undisclosed',
          partner_name: deal.licensor_name || deal.licensee_name || 'Unknown',
          modality: deal.modality,
          indication: deal.indication_specific || deal.indication_category,
          phase: deal.phase_at_signing,
          total_value_usd: deal.total_deal_value_usd,
          upfront_usd: deal.upfront_usd,
          announced_date: deal.announced_date,
          deal_type: deal.deal_type,
          relevance: generateDealRelevance(deal),
        }));

        // Pharma Intent Score v3 — predictive acquisition likelihood
        try {
          const companyTrials = companyTrialsMap.get(company.id) || [];
          const allDealsFlat = Array.from(companyDealsMap.values()).flat();
          const companyPress = companyPressMap.get(company.id) || undefined;
          const companyResearch = companyResearchMap.get(company.id) || undefined;
          match.pharma_intent = calculatePharmaIntent(
            company,
            input.modality,
            input.indication_specific || input.indication_category || '',
            companyDeals,
            companyTrials,
            allDealsFlat,
            companyPress,
            companyResearch,
            input.development_phase || undefined, // targetPhase for company type × phase interaction
            input.therapeutic_area || undefined,   // targetTA for TA-specific patent cliff relevance
          );
        } catch (err) {
          console.error(`[PharmaIntent] Error for ${company.name}:`, err);
        }
      }

      scoredMatches.push(match);
    }
  }

  // Sort by score descending, then by data quality
  scoredMatches.sort((a, b) => {
    if (b.match_score !== a.match_score) {
      return b.match_score - a.match_score;
    }
    return b.data_quality_score - a.data_quality_score;
  });

  return {
    total_matches: scoredMatches.length,
    matches: scoredMatches.slice(0, limit),
    query_params: input,
    generated_at: new Date().toISOString(),
  };
}

function calculateMatchScore(
  company: CompanyProfile,
  input: MatchInput
): { score: number; breakdown: ScoreBreakdown; reasons: MatchReason[] } {
  const breakdown: ScoreBreakdown = {
    modality: 0,
    indication: 0,
    phase: 0,
    activity: 0,
    strategic: 0,
    territory: 0,
    quality: 0,
    total: 0,
  };
  const reasons: MatchReason[] = [];

  // 1. MODALITY MATCHING
  const companyModalities = company.modalities_active || [];
  const companyPrimaryModalities = company.modalities_primary || [];

  if (companyPrimaryModalities.includes(input.modality)) {
    breakdown.modality = WEIGHTS.modality_primary;
    reasons.push({
      category: 'modality',
      reason: `Primary focus on ${formatModality(input.modality)}`,
      strength: 'strong',
    });
  } else if (companyModalities.includes(input.modality)) {
    breakdown.modality = WEIGHTS.modality_exact;
    reasons.push({
      category: 'modality',
      reason: `Active in ${formatModality(input.modality)}`,
      strength: 'strong',
    });
  } else {
    // Check adjacent modalities
    const adjacentModalities = MODALITY_ADJACENCY[input.modality] || [];
    const hasAdjacent = adjacentModalities.some(m => companyModalities.includes(m));
    if (hasAdjacent) {
      breakdown.modality = WEIGHTS.modality_adjacent;
      reasons.push({
        category: 'modality',
        reason: `Active in related modalities`,
        strength: 'moderate',
      });
    }
  }

  // 2. INDICATION MATCHING
  const companyIndications = company.indications_active || [];
  const companyIndicationsSpecific = company.indications_specific || [];

  if (input.indication_specific && companyIndicationsSpecific.includes(input.indication_specific)) {
    breakdown.indication = WEIGHTS.indication_specific_exact;
    reasons.push({
      category: 'indication',
      reason: `Focused on ${formatIndication(input.indication_specific)}`,
      strength: 'strong',
    });
  } else if (input.indication_category && companyIndications.includes(input.indication_category)) {
    breakdown.indication = WEIGHTS.indication_category_exact;
    reasons.push({
      category: 'indication',
      reason: `Active in ${formatIndicationCategory(input.indication_category)}`,
      strength: 'strong',
    });
  } else if (input.indication_category) {
    // Check adjacent indication categories
    const adjacentIndications = INDICATION_ADJACENCY[input.indication_category] || [];
    const hasAdjacent = adjacentIndications.some(i => companyIndications.includes(i));
    if (hasAdjacent) {
      breakdown.indication = WEIGHTS.indication_category_adjacent;
      reasons.push({
        category: 'indication',
        reason: `Active in related therapeutic areas`,
        strength: 'weak',
      });
    }
  }

  // 3. PHASE PREFERENCE MATCHING (with sweet-spot bonus)
  const inputPhaseRank = PHASE_RANK[input.development_phase] ?? 2;
  const minPhaseRank = (company.phase_preference_min ? PHASE_RANK[company.phase_preference_min] : undefined) ?? 0;
  const maxPhaseRank = (company.phase_preference_max ? PHASE_RANK[company.phase_preference_max] : undefined) ?? 5;

  if (inputPhaseRank >= minPhaseRank && inputPhaseRank <= maxPhaseRank) {
    // Check if asset is in the sweet spot (center of company's preferred range)
    const rangeSize = maxPhaseRank - minPhaseRank;
    const rangeMid = minPhaseRank + rangeSize / 2;
    const distFromCenter = Math.abs(inputPhaseRank - rangeMid);

    if (rangeSize <= 1 || distFromCenter <= rangeSize * 0.25) {
      // Sweet spot: narrow range or within center 50% of range
      breakdown.phase = WEIGHTS.phase_sweet_spot;
      reasons.push({
        category: 'phase',
        reason: `${formatPhase(input.development_phase)} is their licensing sweet spot`,
        strength: 'strong',
      });
    } else {
      breakdown.phase = WEIGHTS.phase_in_range;
      reasons.push({
        category: 'phase',
        reason: `Licenses at ${formatPhase(input.development_phase)}`,
        strength: 'strong',
      });
    }
  } else if (Math.abs(inputPhaseRank - minPhaseRank) <= 1 || Math.abs(inputPhaseRank - maxPhaseRank) <= 1) {
    breakdown.phase = WEIGHTS.phase_adjacent;
    reasons.push({
      category: 'phase',
      reason: `Sometimes licenses near ${formatPhase(input.development_phase)}`,
      strength: 'moderate',
    });
  }

  // 4. ACTIVITY SIGNALS
  const lastDealDate = company.last_deal_date ? new Date(company.last_deal_date) : null;
  const now = new Date();

  if (lastDealDate) {
    const monthsAgo = (now.getTime() - lastDealDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (monthsAgo <= 6) {
      breakdown.activity += WEIGHTS.deal_last_6mo;
      reasons.push({
        category: 'activity',
        reason: `Deal closed in last 6 months`,
        strength: 'strong',
      });
    } else if (monthsAgo <= 12) {
      breakdown.activity += WEIGHTS.deal_last_12mo;
      reasons.push({
        category: 'activity',
        reason: `${company.deals_last_12mo} deal(s) in last 12 months`,
        strength: 'strong',
      });
    } else if (monthsAgo <= 24) {
      breakdown.activity += WEIGHTS.deal_last_24mo;
      reasons.push({
        category: 'activity',
        reason: `${company.deals_last_24mo} deal(s) in last 24 months`,
        strength: 'moderate',
      });
    }
  }

  // Bonus for relevant active trials
  if (company.active_trials_count > 0 && breakdown.indication > 0) {
    breakdown.activity += WEIGHTS.active_trials_relevant;
    reasons.push({
      category: 'activity',
      reason: `${company.active_trials_count} active trials in development`,
      strength: 'moderate',
    });
  }

  // 5. STRATEGIC NEED (patent cliffs, pipeline gaps, strategic priority match)
  const patentCliffs = parsePatentCliffs(company.patent_cliffs);

  // Patent cliff urgency: upcoming cliffs in related TA/indication = buying pressure
  // taCliffs are already filtered to the user's therapeutic area
  const taCliffs = filterCliffsByTA(patentCliffs, input.therapeutic_area);
  // Among TA-filtered cliffs, prioritize those expiring soon
  const relevantCliffs = taCliffs.filter((cliff: PatentCliff) =>
    cliff.expiry_year <= 2029
  );

  if (relevantCliffs.length > 0) {
    breakdown.strategic += WEIGHTS.strategic_patent_cliff;
    reasons.push({
      category: 'strategic',
      reason: `Patent cliff creates acquisition urgency`,
      strength: 'strong',
    });
  } else if (company.revenue_at_risk_2027 > 2_000_000_000) {
    breakdown.strategic += Math.round(WEIGHTS.strategic_patent_cliff * 0.6);
    reasons.push({
      category: 'strategic',
      reason: `Significant revenue at risk by 2027`,
      strength: 'moderate',
    });
  }

  // Strategic priority match: company's stated priorities align with asset
  // Uses semantic keyword expansion to catch priorities like "expanding in oncology",
  // "IO combinations", "CNS pipeline", "cell and gene therapy" etc.
  const priorities = company.strategic_priorities || [];
  const prioritiesText = priorities.map((p: string) => p.toLowerCase()).join(' ');
  const priorityMatchResult = matchStrategicPriorities(prioritiesText, input);

  if (priorityMatchResult.score > 0) {
    breakdown.strategic += Math.min(WEIGHTS.strategic_priority_match, priorityMatchResult.score);
    reasons.push({
      category: 'strategic',
      reason: priorityMatchResult.reason,
      strength: priorityMatchResult.score >= WEIGHTS.strategic_priority_match ? 'strong' : 'moderate',
    });
  }

  // Pipeline gap from patent cliffs in target indication (filtered to same TA)
  const pipelineGaps = taCliffs
    .filter((c: PatentCliff) => c.expiry_year <= 2028 && c.indication)
    .map((c: PatentCliff) => c.indication!.toLowerCase());

  const hasGapMatch = pipelineGaps.some((gap: string) =>
    (input.indication_category && gap.includes(input.indication_category.toLowerCase())) ||
    (input.indication_specific && gap.includes(input.indication_specific.toLowerCase()))
  );

  if (hasGapMatch && relevantCliffs.length === 0) {
    breakdown.strategic += WEIGHTS.strategic_pipeline_gap;
    reasons.push({
      category: 'strategic',
      reason: `Pipeline gap in target indication`,
      strength: 'moderate',
    });
  }

  // 6. TERRITORY MATCHING
  const companyTerritories = company.territory_focus || [];

  if (input.territory_scope) {
    if (companyTerritories.includes(input.territory_scope) || companyTerritories.includes('global')) {
      breakdown.territory = WEIGHTS.territory_match;
    } else if (
      (input.territory_scope === 'us' && companyTerritories.includes('us_eu')) ||
      (input.territory_scope === 'ex_us' && !companyTerritories.includes('us'))
    ) {
      breakdown.territory = WEIGHTS.territory_partial;
    } else if (companyTerritories.length > 0 && !companyTerritories.includes('global')) {
      // Territory mismatch: company has a territory focus that doesn't include
      // user's territory. Zero (no bonus) instead of a negative penalty so the
      // total partner score cannot be driven below zero by unbounded subtraction.
      breakdown.territory = 0;
    }
  }

  // 7. QUALITY BONUSES
  if (company.data_quality_score >= 70) {
    breakdown.quality += WEIGHTS.data_quality_high;
  }
  if (company.actively_acquiring && company.acquisition_appetite === 'aggressive') {
    breakdown.quality += WEIGHTS.actively_acquiring;
  }

  // 8b. COMPANY CAPACITY
  // Large pharma suited for late-stage, biotech for early-stage
  const isLateStage = inputPhaseRank >= 3; // phase_2 or later
  const isEarlyStage = inputPhaseRank <= 1; // discovery or preclinical
  const companyType = (company.company_type || '').toLowerCase();

  if (companyType.includes('large_pharma') || companyType.includes('mega_pharma')) {
    if (isLateStage) breakdown.quality += 8;
    else if (!isEarlyStage) breakdown.quality += 4;
  } else if (companyType.includes('biotech') || companyType.includes('specialty')) {
    if (isEarlyStage) breakdown.quality += 6;
    else if (!isLateStage) breakdown.quality += 3;
  } else if (companyType.includes('mid_pharma')) {
    breakdown.quality += 5; // mid-pharma is versatile
  }

  // 8c. DEAL SIZE MATCHING
  // Estimate expected deal range from phase, then check if company's historical deal sizes align
  // Accepts both camelCase (phase1/phase2) and legacy snake_case (phase_1/phase_2)
  // so existing tests and legacy deal data continue to resolve.
  const dealSizeRanges: Record<string, [number, number]> = {
    discovery: [10_000_000, 200_000_000],
    preclinical: [10_000_000, 200_000_000],
    phase1: [50_000_000, 500_000_000],
    phase_1: [50_000_000, 500_000_000],
    phase1_2: [75_000_000, 750_000_000],
    phase_1_2: [75_000_000, 750_000_000],
    phase2: [100_000_000, 1_000_000_000],
    phase_2: [100_000_000, 1_000_000_000],
    phase2_3: [150_000_000, 1_500_000_000],
    phase_2_3: [150_000_000, 1_500_000_000],
    phase3: [200_000_000, 2_000_000_000],
    phase_3: [200_000_000, 2_000_000_000],
    nda_filed: [350_000_000, 3_500_000_000],
    approved: [500_000_000, 5_000_000_000],
  };

  const expectedRange = dealSizeRanges[input.development_phase];
  if (expectedRange) {
    const [rangeLow, rangeHigh] = expectedRange;
    const companyDealSize = company.median_upfront_usd || company.avg_upfront_usd;

    if (companyDealSize && companyDealSize > 0) {
      if (companyDealSize >= rangeLow && companyDealSize <= rangeHigh) {
        // Within expected range: full points
        breakdown.quality += WEIGHTS.deal_size_match;
        reasons.push({
          category: 'deal_size',
          reason: `Historical deal sizes align with ${formatPhase(input.development_phase)} assets`,
          strength: 'strong',
        });
      } else if (companyDealSize >= rangeLow / 3 && companyDealSize <= rangeHigh * 3) {
        // Within 3x of range bounds: partial points
        breakdown.quality += Math.round(WEIGHTS.deal_size_match * 0.5);
        reasons.push({
          category: 'deal_size',
          reason: `Deal size history in reasonable range for ${formatPhase(input.development_phase)} assets`,
          strength: 'moderate',
        });
      }
    }
  }

  // 8d. REGULATORY DESIGNATION MATCHING
  if (input.regulatory_designations) {
    const priorities = (company.strategic_priorities || []).map((p: string) => p.toLowerCase());
    const prioritiesText = priorities.join(' ');
    let regMatch = false;

    if (input.regulatory_designations.breakthrough) {
      if (prioritiesText.includes('breakthrough') || prioritiesText.includes('accelerated')) {
        regMatch = true;
      }
    }
    if (input.regulatory_designations.orphan) {
      if (prioritiesText.includes('orphan') || prioritiesText.includes('rare')) {
        regMatch = true;
      }
    }
    if (input.regulatory_designations.fastTrack) {
      if (prioritiesText.includes('fast track') || prioritiesText.includes('priority')) {
        regMatch = true;
      }
    }
    if (input.regulatory_designations.prime) {
      if (prioritiesText.includes('prime') || prioritiesText.includes('ema') || prioritiesText.includes('european')) {
        regMatch = true;
      }
    }

    if (regMatch) {
      breakdown.quality += WEIGHTS.regulatory_match;
      reasons.push({
        category: 'regulatory',
        reason: 'Strategic priorities align with regulatory designations',
        strength: 'moderate',
      });
    }
  }

  // 8e. THERAPEUTIC AREA RELEVANCE
  // Ensures companies are relevant to the user's therapeutic area, not just
  // coincidentally sharing a modality (e.g., oncology peptide vs metabolic peptide)
  if (input.therapeutic_area) {
    const taIndications = THERAPEUTIC_AREA_INDICATIONS[input.therapeutic_area] || [];
    const taLabel = TA_LABELS[input.therapeutic_area] || input.therapeutic_area;

    // Check company's overlap with the user's therapeutic area
    const companyTAOverlap = taIndications.filter(ind =>
      companyIndications.includes(ind) || companyIndicationsSpecific.includes(ind)
    );

    if (companyTAOverlap.length >= 2) {
      // Strong TA alignment — significant boost
      breakdown.indication += 15;
      reasons.push({
        category: 'indication',
        reason: `Strong ${taLabel} focus with multiple active programs`,
        strength: 'strong',
      });
    } else if (companyTAOverlap.length === 1) {
      breakdown.indication += 8;
      reasons.push({
        category: 'indication',
        reason: `Active in ${taLabel}`,
        strength: 'moderate',
      });
    } else {
      // No TA overlap — check if company is primarily in a different TA
      let primaryOtherTA = false;
      for (const [otherTA, otherIndications] of Object.entries(THERAPEUTIC_AREA_INDICATIONS)) {
        if (otherTA === input.therapeutic_area) continue;
        const otherOverlap = otherIndications.filter(ind => companyIndications.includes(ind));
        if (otherOverlap.length >= 2) {
          primaryOtherTA = true;
          break;
        }
      }

      if (primaryOtherTA) {
        // Company is clearly in a different TA — modality match is coincidental
        breakdown.modality = Math.round(breakdown.modality * 0.4);
      }
    }
  }

  // Calculate total
  breakdown.total = Object.values(breakdown).reduce((sum, val) => sum + val, 0) - breakdown.total;

  // Normalize to 0-100 scale
  const maxPossibleScore =
    WEIGHTS.modality_exact +
    WEIGHTS.indication_specific_exact +
    WEIGHTS.phase_sweet_spot +
    WEIGHTS.deal_last_6mo +
    WEIGHTS.active_trials_relevant +
    WEIGHTS.strategic_patent_cliff +
    WEIGHTS.strategic_priority_match +
    WEIGHTS.territory_match +
    WEIGHTS.data_quality_high +
    WEIGHTS.actively_acquiring +
    WEIGHTS.company_capacity +
    WEIGHTS.deal_size_match +
    WEIGHTS.regulatory_match;

  const normalizedScore = Math.min(100, Math.round((breakdown.total / maxPossibleScore) * 100));

  return {
    score: normalizedScore,
    breakdown,
    reasons: reasons.sort((a, b) => {
      const strengthOrder = { strong: 0, moderate: 1, weak: 2 };
      return strengthOrder[a.strength] - strengthOrder[b.strength];
    }),
  };
}

// Formatting helpers
function formatModality(modality: string): string {
  const labels: Record<string, string> = {
    'adc': 'ADCs',
    'bispecific': 'Bispecifics',
    'small_molecule': 'Small Molecules',
    'antibody': 'Antibodies',
    'car_t': 'CAR-T',
    'cell_therapy': 'Cell Therapy',
    'gene_therapy': 'Gene Therapy',
    'mrna': 'mRNA',
    'radiopharm': 'Radiopharmaceuticals',
    'oligonucleotide': 'Oligonucleotides',
    'peptide': 'Peptides',
    'vaccine': 'Vaccines',
    'aso': 'Antisense Oligonucleotides',
    'bbb_platform': 'BBB Delivery Platforms',
    'psychedelic': 'Psychedelics / Neuroplastogens',
    'ion_channel': 'Ion Channel Modulators',
    'tau_targeting': 'Tau-Targeting Therapies',
    'stem_cell': 'Stem Cell Therapies',
  };
  return labels[modality] || modality;
}

function formatPhase(phase: string): string {
  const labels: Record<string, string> = {
    'discovery': 'Discovery',
    'preclinical': 'Preclinical',
    'phase_1': 'Phase 1',
    'phase_2': 'Phase 2',
    'phase_3': 'Phase 3',
    'approved': 'Approved',
  };
  return labels[phase] || phase;
}

function formatIndication(indication: string): string {
  return indication
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatIndicationCategory(category: string): string {
  const labels: Record<string, string> = {
    'solid_tumor': 'Solid Tumors',
    'hematological': 'Hematological Malignancies',
    'autoimmune': 'Autoimmune/Inflammation',
    'cns': 'CNS Disorders',
    'cardiovascular': 'Cardiovascular',
    'infectious': 'Infectious Diseases',
    'metabolic': 'Metabolic Diseases',
    'rare_disease': 'Rare Diseases',
    'respiratory': 'Respiratory',
    'dermatology': 'Dermatology',
    'ophthalmology': 'Ophthalmology',
    'hematology': 'Hematology',
    'gastroenterology': 'Gastroenterology',
  };
  return labels[category] || category;
}

// Export formatting helpers for use in components
export const formatters = {
  modality: formatModality,
  phase: formatPhase,
  indication: formatIndication,
  indicationCategory: formatIndicationCategory,
};

// ============================================================================
// ENHANCED BREAKDOWN FUNCTIONS
// ============================================================================

/**
 * Build detailed score breakdown with evidence lines for each category
 */
export function buildDetailedBreakdown(
  company: CompanyProfile,
  input: MatchInput,
  breakdown: ScoreBreakdown,
  companyDeals: CompanyDeal[]
): DetailedScoreBreakdown {
  const factors: ScoreFactor[] = [];

  // MODALITY FACTOR
  if (breakdown.modality > 0) {
    const modalityEvidence: EvidenceLine[] = [];
    const companyPrimaryModalities = company.modalities_primary || [];
    const companyModalities = company.modalities_active || [];

    if (companyPrimaryModalities.includes(input.modality)) {
      modalityEvidence.push({
        text: `${formatModality(input.modality)} is a primary focus area`,
        type: 'strategic',
        highlight: true,
      });
    }

    // Find deals in this modality
    const modalityDeals = companyDeals.filter(
      (d) => d.modality === input.modality || d.modality?.includes(input.modality)
    );
    if (modalityDeals.length > 0) {
      modalityEvidence.push({
        text: `${modalityDeals.length} ${formatModality(input.modality)} deal${modalityDeals.length > 1 ? 's' : ''} in last 24 months`,
        type: 'deal',
      });

      // Highlight largest deal
      const largestDeal = modalityDeals.sort(
        (a, b) => (b.total_deal_value_usd || 0) - (a.total_deal_value_usd || 0)
      )[0];
      if (largestDeal && largestDeal.total_deal_value_usd) {
        modalityEvidence.push({
          text: `${largestDeal.asset_name || 'Recent deal'} (${formatCurrency(largestDeal.total_deal_value_usd)} total)`,
          type: 'deal',
          sourceData: { id: largestDeal.id, value: largestDeal.total_deal_value_usd },
        });
      }
    }

    // Count active modalities
    const activeModalityCount = companyModalities.filter(
      (m: string) => m === input.modality || MODALITY_ADJACENCY[input.modality]?.includes(m)
    ).length;
    if (activeModalityCount > 1) {
      modalityEvidence.push({
        text: `${activeModalityCount} related modalities in active development`,
        type: 'metric',
      });
    }

    factors.push({
      category: 'modality',
      title: `${formatModality(input.modality)} Expertise`,
      points: breakdown.modality,
      maxPoints: WEIGHTS.modality_exact,
      evidenceLines: modalityEvidence,
    });
  }

  // INDICATION FACTOR
  if (breakdown.indication > 0) {
    const indicationEvidence: EvidenceLine[] = [];
    const companyIndications = company.indications_active || [];
    const indicationLabel = input.indication_specific
      ? formatIndication(input.indication_specific)
      : formatIndicationCategory(input.indication_category || '');

    if (input.indication_specific && (company.indications_specific || []).includes(input.indication_specific)) {
      indicationEvidence.push({
        text: `${indicationLabel} is an active focus area`,
        type: 'strategic',
        highlight: true,
      });
    } else if (input.indication_category && companyIndications.includes(input.indication_category)) {
      indicationEvidence.push({
        text: `Active ${formatIndicationCategory(input.indication_category)} programs`,
        type: 'strategic',
      });
    }

    // Count indication-specific programs
    const indicationDeals = companyDeals.filter(
      (d) =>
        d.indication_category === input.indication_category ||
        d.indication_specific === input.indication_specific
    );
    if (indicationDeals.length > 0) {
      indicationEvidence.push({
        text: `${indicationDeals.length} deal${indicationDeals.length > 1 ? 's' : ''} in ${indicationLabel}`,
        type: 'deal',
      });
    }

    // Check strategic priorities
    const priorities = company.strategic_priorities || [];
    const hasIndicationPriority = priorities.some(
      (p: string) =>
        p.toLowerCase().includes(input.indication_category?.toLowerCase() || '') ||
        p.toLowerCase().includes(input.indication_specific?.toLowerCase() || '')
    );
    if (hasIndicationPriority) {
      indicationEvidence.push({
        text: `${indicationLabel} is a strategic priority`,
        type: 'strategic',
        highlight: true,
      });
    }

    factors.push({
      category: 'indication',
      title: `${indicationLabel} Interest`,
      points: breakdown.indication,
      maxPoints: WEIGHTS.indication_specific_exact,
      evidenceLines: indicationEvidence,
    });
  }

  // PHASE FACTOR
  if (breakdown.phase > 0) {
    const phaseEvidence: EvidenceLine[] = [];
    const phaseLabel = formatPhase(input.development_phase);

    // Calculate phase preference stats
    const phaseDeals = companyDeals.filter((d) => d.phase_at_signing === input.development_phase);
    const totalDeals = companyDeals.length;
    if (totalDeals > 0 && phaseDeals.length > 0) {
      const phasePercent = Math.round((phaseDeals.length / totalDeals) * 100);
      phaseEvidence.push({
        text: `${phasePercent}% of deals at ${phaseLabel}`,
        type: 'metric',
        highlight: phasePercent >= 50,
      });
    }

    // Average upfront at this phase
    const avgUpfront = company.avg_upfront_usd;
    if (avgUpfront) {
      phaseEvidence.push({
        text: `Average upfront: ${formatCurrency(avgUpfront)}`,
        type: 'metric',
      });
    }

    // Phase preference range
    if (company.phase_preference_min && company.phase_preference_max) {
      phaseEvidence.push({
        text: `Licenses from ${formatPhase(company.phase_preference_min)} to ${formatPhase(company.phase_preference_max)}`,
        type: 'strategic',
      });
    }

    factors.push({
      category: 'phase',
      title: `${phaseLabel} Track Record`,
      points: breakdown.phase,
      maxPoints: WEIGHTS.phase_in_range,
      evidenceLines: phaseEvidence,
    });
  }

  // ACTIVITY FACTOR
  if (breakdown.activity > 0) {
    const activityEvidence: EvidenceLine[] = [];

    // Deal velocity
    const deals12mo = company.deals_last_12mo || 0;
    const deals24mo = company.deals_last_24mo || 0;
    if (deals24mo > 0) {
      activityEvidence.push({
        text: `${deals24mo} deal${deals24mo > 1 ? 's' : ''} in last 24 months`,
        type: 'metric',
        highlight: deals24mo >= 5,
      });
    }

    // Recent deal timing
    if (company.last_deal_date) {
      const lastDeal = new Date(company.last_deal_date);
      const monthsAgo = Math.round(
        (Date.now() - lastDeal.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      if (monthsAgo <= 6) {
        activityEvidence.push({
          text: `Most recent deal: ${monthsAgo} month${monthsAgo !== 1 ? 's' : ''} ago`,
          type: 'deal',
          highlight: true,
        });
      }
    }

    // Active trials
    if (company.active_trials_count > 0) {
      activityEvidence.push({
        text: `${company.active_trials_count} active clinical trial${company.active_trials_count > 1 ? 's' : ''}`,
        type: 'trial',
      });
    }

    // BD activity indicator
    if (deals12mo >= 4) {
      activityEvidence.push({
        text: 'Active BD team, fast decision-making',
        type: 'strategic',
      });
    }

    factors.push({
      category: 'activity',
      title: 'Deal Velocity',
      points: breakdown.activity,
      maxPoints: WEIGHTS.deal_last_6mo + WEIGHTS.active_trials_relevant,
      evidenceLines: activityEvidence,
    });
  }

  // TERRITORY FACTOR (if applicable)
  if (breakdown.territory > 0 && input.territory_scope) {
    const territoryEvidence: EvidenceLine[] = [];
    const territories = company.territory_focus || [];

    if (territories.includes('global')) {
      territoryEvidence.push({
        text: 'Licenses worldwide rights',
        type: 'strategic',
      });
    } else {
      territoryEvidence.push({
        text: `Active in ${formatTerritory(input.territory_scope)} market`,
        type: 'strategic',
      });
    }

    factors.push({
      category: 'territory',
      title: 'Territory Fit',
      points: breakdown.territory,
      maxPoints: WEIGHTS.territory_match,
      evidenceLines: territoryEvidence,
    });
  }

  // STRATEGIC FACTOR (from patent cliffs — filtered to user's therapeutic area)
  const allCliffs = parsePatentCliffs(company.patent_cliffs);
  const taFilteredCliffs = filterCliffsByTA(allCliffs, input.therapeutic_area);
  // Find the most relevant cliff: prefer those expiring soon with high revenue
  const relevantCliff = taFilteredCliffs
    .filter((c) => c.expiry_year <= 2029)
    .sort((a, b) => b.revenue_usd - a.revenue_usd)[0] || null;

  if (relevantCliff) {
    const strategicEvidence: EvidenceLine[] = [];

    strategicEvidence.push({
      text: `${relevantCliff.drug_name} patent cliff ${relevantCliff.expiry_year} (${formatCurrency(relevantCliff.revenue_usd)} at risk)`,
      type: 'patent_cliff',
      highlight: true,
    });
    strategicEvidence.push({
      text: `Pipeline gap in ${relevantCliff.indication || input.therapeutic_area || 'target area'}`,
      type: 'strategic',
    });

    factors.push({
      category: 'strategic',
      title: 'Strategic Need',
      points: 10,
      maxPoints: 15,
      evidenceLines: strategicEvidence,
    });
  }

  // Calculate totals
  const rawTotal = factors.reduce((sum, f) => sum + f.points, 0);
  const maxPossible = factors.reduce((sum, f) => sum + f.maxPoints, 0);

  return {
    factors: factors.sort((a, b) => b.points - a.points), // Sort by points descending
    rawTotal,
    normalizedTotal: Math.round((rawTotal / Math.max(maxPossible, 1)) * 100),
    maxPossible,
  };
}

/**
 * Lightweight watch-out calculation using only company profile data (no deals needed).
 * Applied to ALL companies before filtering to adjust scores for red flags.
 */
export function calculateQuickWatchOuts(
  company: CompanyProfile,
  input: MatchInput
): WatchOutFactor[] {
  const watchOuts: WatchOutFactor[] = [];

  // 1. Competing internal asset: company has same indication+modality in indications_specific
  if (
    input.indication_specific &&
    (company.indications_specific || []).includes(input.indication_specific) &&
    (company.modalities_active || []).includes(input.modality)
  ) {
    watchOuts.push({
      title: 'Competing Internal Asset',
      impact: -10,
      description: `Existing ${formatModality(input.modality)} program in ${formatIndication(input.indication_specific)} may cause internal competition.`,
      severity: 'high',
      category: 'competition',
    });
  }

  // 2. Phase mismatch risk: asset phase earlier than company's min by 2+ ranks
  const inputPhaseRank = PHASE_RANK[input.development_phase] ?? 2;
  const minPhaseRank = (company.phase_preference_min ? PHASE_RANK[company.phase_preference_min] : undefined) ?? 0;
  if (inputPhaseRank < minPhaseRank - 1) {
    watchOuts.push({
      title: 'Early Stage Hesitation',
      impact: -5,
      description: `Historically focuses on ${formatPhase(company.phase_preference_min || 'phase_1')}+ assets.`,
      severity: 'medium',
      category: 'strategic',
    });
  }

  // 3. Modality mismatch: not in adjacency map AND not in active modalities
  const companyModalities = company.modalities_active || [];
  const adjacentModalities = MODALITY_ADJACENCY[input.modality] || [];
  if (
    !companyModalities.includes(input.modality) &&
    !adjacentModalities.some(m => companyModalities.includes(m))
  ) {
    watchOuts.push({
      title: 'Modality Mismatch',
      impact: -5,
      description: `No active or adjacent modality overlap with ${formatModality(input.modality)}.`,
      severity: 'medium',
      category: 'strategic',
    });
  }

  // 4. BD activity slowdown: deals_last_12mo is 0 but deals_last_24mo > 0
  if (company.deals_last_12mo === 0 && company.deals_last_24mo > 0) {
    watchOuts.push({
      title: 'BD Activity Slowdown',
      impact: -5,
      description: 'No deals in last 12 months despite prior activity. May indicate internal restructuring.',
      severity: 'medium',
      category: 'timing',
    });
  }

  return watchOuts;
}

/**
 * Calculate watch-out factors for a partner match
 */
export function calculateWatchOuts(
  company: CompanyProfile,
  input: MatchInput,
  companyDeals: CompanyDeal[]
): WatchOutFactor[] {
  const watchOuts: WatchOutFactor[] = [];

  // 1. Integration Mode - Recent large acquisition
  const recentAcquisitions = companyDeals.filter(
    (d) =>
      d.deal_type === 'acquisition' &&
      new Date(d.announced_date) > new Date(Date.now() - 18 * 30 * 24 * 60 * 60 * 1000)
  );
  if (recentAcquisitions.length > 0) {
    const acquisition = recentAcquisitions[0];
    watchOuts.push({
      title: 'Integration Mode',
      impact: -8,
      description: `Post-${acquisition.asset_name || 'acquisition'} integration may slow BD processes. Decision timelines could be 20-30% longer.`,
      severity: 'medium',
      category: 'timing',
    });
  }

  // 2. Global Rights Preference - If user wants regional but company prefers global
  const territoryDeals = companyDeals.filter((d) => d.territory);
  if (territoryDeals.length >= 3) {
    const globalDeals = territoryDeals.filter(
      (d) => d.territory === 'global' || d.territory === 'worldwide'
    );
    const globalPercent = Math.round((globalDeals.length / territoryDeals.length) * 100);

    if (
      globalPercent > 80 &&
      input.territory_scope &&
      !['global', 'worldwide'].includes(input.territory_scope)
    ) {
      watchOuts.push({
        title: 'Global Rights Preference',
        impact: 0, // Informational
        description: `${globalPercent}% of deals are worldwide rights. Historically reluctant to do regional deals.`,
        severity: 'low',
        category: 'structure',
      });
    }
  }

  // 3. BD Activity Slowdown
  const deals6mo = companyDeals.filter(
    (d) => new Date(d.announced_date) > new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)
  ).length;
  if (company.deals_last_12mo >= 4 && deals6mo === 0) {
    watchOuts.push({
      title: 'BD Activity Slowdown',
      impact: -5,
      description: 'No deals in last 6 months despite active history. May indicate internal restructuring.',
      severity: 'medium',
      category: 'timing',
    });
  }

  // 4. Phase Mismatch Risk
  const inputPhaseRank = PHASE_RANK[input.development_phase] ?? 2;
  const minPhaseRank = (company.phase_preference_min ? PHASE_RANK[company.phase_preference_min] : undefined) ?? 0;
  const maxPhaseRank = (company.phase_preference_max ? PHASE_RANK[company.phase_preference_max] : undefined) ?? 5;

  if (inputPhaseRank < minPhaseRank - 1) {
    watchOuts.push({
      title: 'Early Stage Hesitation',
      impact: -5,
      description: `Historically focuses on ${formatPhase(company.phase_preference_min || 'phase_1')}+ assets. May require more data package.`,
      severity: 'medium',
      category: 'strategic',
    });
  }

  // 5. Competitive Pipeline - Check if they have similar asset
  const companyIndications = company.indications_specific || [];
  const hasCompetingAsset =
    input.indication_specific &&
    companyIndications.includes(input.indication_specific) &&
    (company.modalities_active || []).includes(input.modality);

  if (hasCompetingAsset) {
    watchOuts.push({
      title: 'Competing Internal Asset',
      impact: -10,
      description: `Existing ${formatModality(input.modality)} program in ${formatIndication(input.indication_specific!)} may cause internal competition.`,
      severity: 'high',
      category: 'competition',
    });
  }

  // 6. Financial constraints (if data available)
  if (company.acquisition_appetite === 'selective' || company.acquisition_appetite === 'inactive') {
    watchOuts.push({
      title: 'Conservative BD Posture',
      impact: -3,
      description: 'Currently showing selective deal appetite. May have budget constraints.',
      severity: 'low',
      category: 'timing',
    });
  }

  // 7. CNS Manufacturing Complexity - advanced modalities with CNS delivery challenges
  const complexCnsModalities = ['gene_therapy', 'cell_therapy', 'car_t', 'stem_cell', 'bbb_platform', 'aso'];
  if (complexCnsModalities.includes(input.modality) && input.indication_category === 'cns') {
    watchOuts.push({
      title: 'CNS Manufacturing Complexity',
      impact: -3,
      description: `${formatModality(input.modality)} for CNS requires specialized manufacturing (e.g., BBB-penetrant formulation, viral vector GMP). Ensure CMC readiness for diligence.`,
      severity: 'low',
      category: 'operational',
    });
  }

  // 8. CNS Regulatory Complexity - indications with historically high FDA attrition
  const highAttritionCns = ['alzheimers', 'schizophrenia', 'depression', 'addiction', 'tbi'];
  if (input.indication_category === 'cns' && input.indication_specific && highAttritionCns.includes(input.indication_specific)) {
    watchOuts.push({
      title: 'CNS Regulatory Complexity',
      impact: -2,
      description: `${formatIndication(input.indication_specific)} has historically high FDA attrition. Partners may require robust biomarker strategy or validated endpoints.`,
      severity: 'low',
      category: 'regulatory',
    });
  }

  // 9. Novel Mechanism Reimbursement Risk - psychedelics and novel CNS mechanisms
  if (['psychedelic', 'ion_channel'].includes(input.modality)) {
    watchOuts.push({
      title: 'Reimbursement Uncertainty',
      impact: -4,
      description: `Novel mechanism classes like ${formatModality(input.modality)} face payer scrutiny. Partners may want health economics data or REMS strategy.`,
      severity: 'medium',
      category: 'commercial',
    });
  }

  return watchOuts.sort((a, b) => a.impact - b.impact); // Most negative first
}

/**
 * Build strategic context from company data.
 * Filters patent cliffs to the user's therapeutic area so only relevant drugs are shown.
 */
export function buildStrategicContext(company: CompanyProfile, therapeuticArea?: string | null): StrategicContext {
  const allCliffs = parsePatentCliffs(company.patent_cliffs);
  // Filter cliffs to the user's therapeutic area — never show irrelevant drugs
  const patentCliffs = filterCliffsByTA(allCliffs, therapeuticArea || null);

  const revenueAtRisk: { year: number; amount: number }[] = [];
  if (company.revenue_at_risk_2025 > 0) {
    revenueAtRisk.push({ year: 2025, amount: company.revenue_at_risk_2025 });
  }
  if (company.revenue_at_risk_2026 > 0) {
    revenueAtRisk.push({ year: 2026, amount: company.revenue_at_risk_2026 });
  }
  if (company.revenue_at_risk_2027 > 0) {
    revenueAtRisk.push({ year: 2027, amount: company.revenue_at_risk_2027 });
  }

  // Identify pipeline gaps based on TA-filtered patent cliffs
  const pipelineGaps: string[] = [];
  for (const cliff of patentCliffs) {
    if (cliff.indication && cliff.expiry_year <= 2028) {
      pipelineGaps.push(cliff.indication);
    }
  }

  return {
    patent_cliffs: patentCliffs,
    revenue_at_risk: revenueAtRisk,
    pipeline_gaps: Array.from(new Set(pipelineGaps)), // Dedupe
    strategic_priorities: company.strategic_priorities || [],
  };
}

/**
 * Fetch recent deals for a company
 */
export async function fetchCompanyDeals(
  supabase: SupabaseClient,
  companyId: string,
  limit: number = 10
): Promise<RelevantDeal[]> {
  const { data: deals, error } = await supabase
    .from('deals')
    .select(
      'id, asset_name, licensor_name, licensee_name, modality, indication_category, indication_specific, phase_at_signing, total_deal_value_usd, upfront_usd, announced_date, deal_type, territory'
    )
    .or(`licensor_id.eq.${companyId},licensee_id.eq.${companyId}`)
    .order('announced_date', { ascending: false })
    .limit(limit);

  if (error || !deals) {
    return [];
  }

  return deals.map((deal) => ({
    id: deal.id,
    asset_name: deal.asset_name || 'Undisclosed',
    partner_name: deal.licensor_name || deal.licensee_name || 'Unknown',
    modality: deal.modality,
    indication: deal.indication_specific || deal.indication_category,
    phase: deal.phase_at_signing,
    total_value_usd: deal.total_deal_value_usd,
    upfront_usd: deal.upfront_usd,
    announced_date: deal.announced_date,
    deal_type: deal.deal_type,
    relevance: generateDealRelevance(deal),
  }));
}

// ============================================================================
// DEAL HISTORY CROSS-REFERENCE
// ============================================================================

/** Summary of a company's recent deal history for negotiation anchoring */
export interface DealHistorySummary {
  company_name: string;
  company_id: string;
  recent_deals: {
    partner: string;
    upfront_usd: number | null;
    total_value_usd: number | null;
    year: number;
    modality: string | null;
    indication: string | null;
    deal_type: string | null;
  }[];
  median_upfront_usd: number | null;
  median_total_value_usd: number | null;
  preferred_deal_structure: 'licensing' | 'acquisition' | 'mixed';
  deal_history_summary: string;
  negotiation_anchor: string;
}

/**
 * Cross-reference partner matches with their actual deal history from the
 * deals database and EXTENDED_COMPARABLE_DEALS. Provides negotiation anchoring
 * based on each partner's historical deal behavior.
 */
export async function getDealHistoryCrossReference(
  supabase: SupabaseClient,
  matches: PartnerMatch[],
  input: MatchInput,
  maxDealsPerPartner: number = 3
): Promise<DealHistorySummary[]> {
  const { EXTENDED_COMPARABLE_DEALS } = await import('@/data/comparable-deals-extended');
  const { COMPARABLE_DEALS } = await import('@/lib/comparableDeals');

  const results: DealHistorySummary[] = [];

  for (const match of matches) {
    // 1. Query real deals from DB
    const { data: dbDeals } = await supabase
      .from('deals')
      .select(
        'licensor_name, licensee_name, upfront_usd, total_deal_value_usd, announced_date, modality, indication_category, indication_specific, deal_type'
      )
      .or(`licensor_id.eq.${match.company_id},licensee_id.eq.${match.company_id}`)
      .order('announced_date', { ascending: false })
      .limit(maxDealsPerPartner * 2);

    // 2. Check static comparable deals for fallback enrichment
    const companyNameLower = match.company_name.toLowerCase();
    const staticDeals = [
      ...EXTENDED_COMPARABLE_DEALS
        .filter((d: { licensor: string; licensee: string }) => d.licensor.toLowerCase() === companyNameLower || d.licensee.toLowerCase() === companyNameLower)
        .map((d: { licensor: string; licensee: string; upfront?: number; totalDealValue?: number; year: number; modality: string; indication_specific: string; indication_category: string; dealType: string }) => ({
          partner: d.licensor.toLowerCase() === companyNameLower ? d.licensee : d.licensor,
          upfront_usd: d.upfront ? d.upfront * 1_000_000 : null,
          total_value_usd: d.totalDealValue ? d.totalDealValue * 1_000_000 : null,
          year: d.year,
          modality: d.modality,
          indication: d.indication_specific || d.indication_category,
          deal_type: d.dealType,
        })),
      ...COMPARABLE_DEALS
        .filter(d => d.licensor.toLowerCase() === companyNameLower || d.licensee.toLowerCase() === companyNameLower)
        .map(d => ({
          partner: d.licensor.toLowerCase() === companyNameLower ? d.licensee : d.licensor,
          upfront_usd: d.upfrontM ? d.upfrontM * 1_000_000 : null,
          total_value_usd: d.totalValueM ? d.totalValueM * 1_000_000 : null,
          year: d.year,
          modality: d.modalities?.[0] || null,
          indication: d.indications?.[0] || null,
          deal_type: d.dealType || null,
        })),
    ];

    // 3. Merge and deduplicate by partner+year
    const seen = new Set<string>();
    const allDeals: DealHistorySummary['recent_deals'] = [];

    for (const deal of (dbDeals || [])) {
      const partner = deal.licensor_name || deal.licensee_name || 'Unknown';
      const year = new Date(deal.announced_date).getFullYear();
      const key = `${partner.toLowerCase()}|${year}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allDeals.push({
        partner,
        upfront_usd: deal.upfront_usd,
        total_value_usd: deal.total_deal_value_usd,
        year,
        modality: deal.modality,
        indication: deal.indication_specific || deal.indication_category,
        deal_type: deal.deal_type,
      });
    }

    for (const deal of staticDeals) {
      const key = `${deal.partner.toLowerCase()}|${deal.year}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allDeals.push(deal);
    }

    // Sort by recency weight (2024-2026 deals weighted 2x, prioritized first)
    allDeals.sort((a, b) => {
      const weightDiff = getRecencyWeight(b.year) - getRecencyWeight(a.year);
      return weightDiff !== 0 ? weightDiff : b.year - a.year;
    });
    const recentDeals = allDeals.slice(0, maxDealsPerPartner);

    if (recentDeals.length === 0) continue;

    // 4. Compute statistics
    const upfronts = recentDeals.map(d => d.upfront_usd).filter((v): v is number => v !== null && v > 0);
    const totals = recentDeals.map(d => d.total_value_usd).filter((v): v is number => v !== null && v > 0);
    const dealTypes = recentDeals.map(d => d.deal_type).filter((v): v is string => v !== null);

    const median = (arr: number[]) => {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const medianUpfront = median(upfronts);
    const medianTotal = median(totals);

    const licenseCount = dealTypes.filter(t => t === 'licensing' || t === 'license' || t === 'collaboration' || t === 'codevelopment' || t === 'option').length;
    const acquisitionCount = dealTypes.filter(t => t === 'acquisition').length;
    const preferredStructure: DealHistorySummary['preferred_deal_structure'] =
      acquisitionCount > licenseCount ? 'acquisition' :
      licenseCount > acquisitionCount ? 'licensing' : 'mixed';

    // 5. Build human-readable summary
    const dealDescriptions = recentDeals.map((d, i) => {
      const upfrontStr = d.upfront_usd ? formatCurrency(d.upfront_usd) + ' upfront' : formatCurrency(d.total_value_usd || 0) + ' total';
      return `(${i + 1}) ${upfrontStr} ${d.year}`;
    });
    const modTA = input.therapeutic_area ? ` in ${TA_LABELS[input.therapeutic_area] || input.therapeutic_area}` : '';
    const dealHistorySummaryText = `${match.company_name}'s last ${recentDeals.length} deals${modTA}: ${dealDescriptions.join(', ')}`;

    // 6. Build negotiation anchor
    let negotiationAnchor: string;
    if (upfronts.length >= 2) {
      const minUp = Math.min(...upfronts);
      const maxUp = Math.max(...upfronts);
      negotiationAnchor = `Based on ${match.company_name}'s recent deals, expect ${formatCurrency(minUp)}-${formatCurrency(maxUp)} upfront for a similar asset`;
    } else if (medianUpfront) {
      negotiationAnchor = `${match.company_name}'s recent upfront benchmark: ${formatCurrency(medianUpfront)}`;
    } else if (medianTotal) {
      negotiationAnchor = `${match.company_name}'s recent deal size benchmark: ${formatCurrency(medianTotal)} total value`;
    } else {
      negotiationAnchor = `Limited disclosed financial data for ${match.company_name}'s recent deals`;
    }

    results.push({
      company_name: match.company_name,
      company_id: match.company_id,
      recent_deals: recentDeals,
      median_upfront_usd: medianUpfront,
      median_total_value_usd: medianTotal,
      preferred_deal_structure: preferredStructure,
      deal_history_summary: dealHistorySummaryText,
      negotiation_anchor: negotiationAnchor,
    });
  }

  return results;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parsePatentCliffs(cliffs: unknown): PatentCliff[] {
  if (!cliffs || !Array.isArray(cliffs)) {
    return [];
  }
  return cliffs
    .filter((c) => c.drug_name && c.expiry_year)
    .map((c) => ({
      drug_name: c.drug_name,
      indication: c.indication || null,
      revenue_usd: c.revenue_usd || 0,
      expiry_year: c.expiry_year,
    }));
}

// Map therapeutic area to keywords found in patent cliff indication strings
// Exported so client components can reuse the same keyword list
export const TA_CLIFF_KEYWORDS: Record<string, string[]> = {
  oncology: ['oncology', 'tumor', 'cancer', 'pd-1', 'pd-l1', 'adc', 'her2', 'egfr', 'cdk', 'parp', 'btk', 'bcl', 'alk', 'lymphoma', 'leukemia', 'myeloma', 'melanoma', 'nsclc', 'sclc', 'breast', 'prostate', 'lung', 'colorectal', 'bladder', 'renal', 'ovarian', 'glioblastoma', 'carcinoma', 'sarcoma'],
  neurology: ['neuro', 'cns', 'multiple sclerosis', 'sma', 'alzheimer', 'parkinson', 'epilepsy', 'migraine', 'schizophrenia', 'depression', 'bipolar', 'adhd', 'pain', 'neuropath', 'als', 'huntington', 'dementia'],
  immunology: ['autoimmune', 'il-', 'tnf', 'jak', 'immunology', 'lupus', 'psoriasis', 'crohn', 'colitis', 'rheumatoid', 'atopic', 'dermatitis', 'ibd', 'inflammatory'],
  metabolic: ['metabolic', 'obesity', 'diabetes', 'glp-1', 'gip', 'sglt2', 'weight', 't2d', 'nash', 'mash', 'nafld', 'cardiovascular', 'lipid', 'cholesterol', 'hypertension'],
  rare_disease: ['rare disease', 'orphan', 'gene therapy', 'enzyme replacement', 'genetic', 'lysosomal', 'neuromuscular', 'sma', 'duchenne', 'fabry', 'gaucher', 'pompe', 'hemophilia'],
  hematology: ['hematology', 'blood', 'hemophilia', 'sickle cell', 'thalassemia', 'anticoagulant', 'thrombocytopenia', 'myelofibrosis', 'polycythemia', 'lymphoma', 'leukemia', 'myeloma'],
  dermatology: ['dermatology', 'skin', 'psoriasis', 'atopic dermatitis', 'eczema', 'alopecia', 'vitiligo', 'il-17', 'il-13', 'acne', 'rosacea'],
  gastroenterology: ['gastroenterology', 'gi', 'ibd', 'crohn', 'colitis', 'celiac', 'liver', 'hepatitis', 'nafld', 'gerd', 'irritable bowel', 'il-23', 'tl1a', 'integrin'],
};

// NOTE: 'hematology' is NOT in the oncology list because hematology drugs
// (e.g. anticoagulants like Eliquis) are not relevant to solid tumor oncology assets.
// Oncology-relevant hematologic malignancies are covered by 'lymphoma', 'leukemia', 'myeloma'.

export function filterCliffsByTA(cliffs: PatentCliff[], therapeuticArea: string | null): PatentCliff[] {
  if (!therapeuticArea || !TA_CLIFF_KEYWORDS[therapeuticArea]) return cliffs;
  const keywords = TA_CLIFF_KEYWORDS[therapeuticArea];
  return cliffs.filter((cliff) => {
    const indication = cliff.indication?.toLowerCase() || '';
    return keywords.some((kw) => indication.includes(kw));
  });
}

function formatCurrency(value: number): string {
  if (value >= 1000000000) {
    return `$${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(0)}M`;
  }
  return `$${value.toLocaleString()}`;
}

function formatTerritory(territory: string): string {
  const labels: Record<string, string> = {
    global: 'Global',
    worldwide: 'Worldwide',
    us: 'US',
    us_only: 'US',
    us_eu: 'US & EU',
    us_japan: 'US & Japan',
    ex_us: 'Ex-US',
    ex_china: 'Ex-China',
    china: 'China',
    japan: 'Japan',
    europe: 'Europe',
    row: 'Rest of World',
    canada: 'Canada',
    australia: 'Australia / NZ',
    south_korea: 'South Korea',
    apac_ex_cj: 'APAC ex-China/Japan',
    latam: 'Latin America',
    mena: 'Middle East & North Africa',
  };
  return labels[territory] || territory;
}

function generateDealRelevance(deal: Pick<CompanyDeal, 'modality' | 'phase_at_signing' | 'deal_type'>): string {
  const parts: string[] = [];
  if (deal.modality) parts.push(formatModality(deal.modality));
  if (deal.phase_at_signing) parts.push(formatPhase(deal.phase_at_signing));
  if (deal.deal_type) {
    const typeLabels: Record<string, string> = {
      license: 'License',
      acquisition: 'Acquisition',
      collaboration: 'Collaboration',
      option: 'Option',
    };
    parts.push(typeLabels[deal.deal_type] || deal.deal_type);
  }
  return parts.join(' · ') || 'Recent deal';
}
