// Partner Matching Service
// Matches user's asset profile to potential acquirers/licensees

import { SupabaseClient } from '@supabase/supabase-js';

// Scoring weights - tuned for deal relevance
const WEIGHTS = {
  // Modality alignment (max 40 points)
  modality_exact: 40,
  modality_primary: 35,
  modality_adjacent: 20,

  // Indication alignment (max 30 points)
  indication_specific_exact: 30,
  indication_category_exact: 20,
  indication_category_adjacent: 10,

  // Phase preference (max 15 points)
  phase_in_range: 15,
  phase_adjacent: 8,

  // Activity signals (max 25 points)
  deal_last_6mo: 15,
  deal_last_12mo: 10,
  deal_last_24mo: 5,
  active_trials_relevant: 10,

  // Territory alignment (max 10 points)
  territory_match: 10,
  territory_partial: 5,

  // Company quality bonus (max 10 points)
  data_quality_high: 5,
  actively_acquiring: 5,
};

// Modality adjacency map - related modalities that indicate interest
const MODALITY_ADJACENCY: Record<string, string[]> = {
  'adc': ['antibody', 'bispecific', 'small_molecule'],
  'bispecific': ['antibody', 'adc'],
  'antibody': ['adc', 'bispecific'],
  'car_t': ['cell_therapy', 'gene_therapy', 'antibody'],
  'cell_therapy': ['car_t', 'gene_therapy'],
  'gene_therapy': ['cell_therapy', 'mrna', 'oligonucleotide'],
  'mrna': ['gene_therapy', 'vaccine', 'oligonucleotide'],
  'radiopharm': ['antibody', 'small_molecule', 'peptide'],
  'small_molecule': ['peptide'],
  'oligonucleotide': ['gene_therapy', 'mrna'],
  'peptide': ['small_molecule', 'antibody'],
  'vaccine': ['mrna', 'antibody'],
};

// Indication category adjacency
const INDICATION_ADJACENCY: Record<string, string[]> = {
  'solid_tumor': ['hematological'],
  'hematological': ['solid_tumor', 'autoimmune'],
  'autoimmune': ['hematological', 'dermatology', 'rare_disease'],
  'cns': ['rare_disease'],
  'rare_disease': ['cns', 'metabolic'],
  'infectious': ['vaccine'],
  'metabolic': ['cardiovascular', 'rare_disease'],
  'cardiovascular': ['metabolic'],
  'respiratory': ['infectious', 'autoimmune'],
  'dermatology': ['autoimmune'],
  'ophthalmology': ['rare_disease'],
};

// Phase ranking for comparison
const PHASE_RANK: Record<string, number> = {
  'discovery': 0,
  'preclinical': 1,
  'phase_1': 2,
  'phase_2': 3,
  'phase_3': 4,
  'approved': 5,
};

export interface MatchInput {
  modality: string;
  development_phase: string;
  indication_category: string | null;
  indication_specific: string | null;
  territory_scope: string | null;
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
}

export interface MatchReason {
  category: 'modality' | 'indication' | 'phase' | 'activity' | 'territory' | 'strategic';
  reason: string;
  strength: 'strong' | 'moderate' | 'weak';
}

export interface ScoreBreakdown {
  modality: number;
  indication: number;
  phase: number;
  activity: number;
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

export async function findPartnerMatches(
  supabase: SupabaseClient,
  input: MatchInput,
  limit: number = 50
): Promise<MatchResult> {
  // Fetch all actively acquiring companies with good data
  const { data: companies, error } = await supabase
    .from('companies')
    .select('*')
    .eq('actively_acquiring', true)
    .gte('data_quality_score', 20)
    .order('deals_last_12mo', { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`Failed to fetch companies: ${error.message}`);
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

  for (const company of companies) {
    const { score, breakdown, reasons } = calculateMatchScore(company, input);

    // Only include meaningful matches (score >= 15)
    if (score >= 15) {
      scoredMatches.push({
        company_id: company.id,
        company_name: company.name,
        company_type: company.company_type,
        ticker: company.ticker,
        hq_country: company.hq_country,
        match_score: Math.round(score),
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
      });
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
  company: any,
  input: MatchInput
): { score: number; breakdown: ScoreBreakdown; reasons: MatchReason[] } {
  const breakdown: ScoreBreakdown = {
    modality: 0,
    indication: 0,
    phase: 0,
    activity: 0,
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

  // 3. PHASE PREFERENCE MATCHING
  const inputPhaseRank = PHASE_RANK[input.development_phase] ?? 2;
  const minPhaseRank = PHASE_RANK[company.phase_preference_min] ?? 0;
  const maxPhaseRank = PHASE_RANK[company.phase_preference_max] ?? 5;

  if (inputPhaseRank >= minPhaseRank && inputPhaseRank <= maxPhaseRank) {
    breakdown.phase = WEIGHTS.phase_in_range;
    reasons.push({
      category: 'phase',
      reason: `Licenses at ${formatPhase(input.development_phase)}`,
      strength: 'strong',
    });
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

  // 5. TERRITORY MATCHING
  const companyTerritories = company.territory_focus || [];

  if (input.territory_scope) {
    if (companyTerritories.includes(input.territory_scope) || companyTerritories.includes('global')) {
      breakdown.territory = WEIGHTS.territory_match;
    } else if (
      (input.territory_scope === 'us' && companyTerritories.includes('us_eu')) ||
      (input.territory_scope === 'ex_us' && !companyTerritories.includes('us'))
    ) {
      breakdown.territory = WEIGHTS.territory_partial;
    }
  }

  // 6. QUALITY BONUSES
  if (company.data_quality_score >= 70) {
    breakdown.quality += WEIGHTS.data_quality_high;
  }
  if (company.actively_acquiring && company.acquisition_appetite === 'aggressive') {
    breakdown.quality += WEIGHTS.actively_acquiring;
  }

  // Calculate total
  breakdown.total = Object.values(breakdown).reduce((sum, val) => sum + val, 0) - breakdown.total;

  // Normalize to 0-100 scale
  const maxPossibleScore =
    WEIGHTS.modality_exact +
    WEIGHTS.indication_specific_exact +
    WEIGHTS.phase_in_range +
    WEIGHTS.deal_last_6mo +
    WEIGHTS.active_trials_relevant +
    WEIGHTS.territory_match +
    WEIGHTS.data_quality_high +
    WEIGHTS.actively_acquiring;

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
