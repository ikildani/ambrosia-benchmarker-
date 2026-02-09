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
  'antibody': ['adc', 'bispecific', 'tau_targeting'],
  'car_t': ['cell_therapy', 'gene_therapy', 'antibody'],
  'cell_therapy': ['car_t', 'gene_therapy', 'stem_cell'],
  'gene_therapy': ['cell_therapy', 'mrna', 'oligonucleotide', 'aso', 'stem_cell'],
  'mrna': ['gene_therapy', 'vaccine', 'oligonucleotide'],
  'radiopharm': ['antibody', 'small_molecule', 'peptide'],
  'small_molecule': ['peptide', 'ion_channel', 'psychedelic'],
  'oligonucleotide': ['gene_therapy', 'mrna', 'aso'],
  'peptide': ['small_molecule', 'antibody'],
  'vaccine': ['mrna', 'antibody'],
  'aso': ['oligonucleotide', 'gene_therapy', 'rnai'],
  'bbb_platform': ['antibody', 'gene_therapy', 'aso', 'small_molecule', 'peptide'],
  'psychedelic': ['small_molecule', 'ion_channel'],
  'ion_channel': ['small_molecule', 'psychedelic', 'peptide'],
  'tau_targeting': ['antibody', 'small_molecule', 'aso'],
  'stem_cell': ['cell_therapy', 'gene_therapy'],
};

// Indication category adjacency (includes neurology sub-indication cross-links)
const INDICATION_ADJACENCY: Record<string, string[]> = {
  'solid_tumor': ['hematological'],
  'hematological': ['solid_tumor', 'autoimmune'],
  'autoimmune': ['hematological', 'dermatology', 'rare_disease', 'cns'],
  'cns': ['rare_disease', 'autoimmune', 'cardiovascular', 'metabolic', 'pain'],
  'rare_disease': ['cns', 'metabolic', 'rare_neurological'],
  'infectious': ['vaccine'],
  'metabolic': ['cardiovascular', 'rare_disease', 'cns'],
  'cardiovascular': ['metabolic', 'cns'],
  'respiratory': ['infectious', 'autoimmune'],
  'dermatology': ['autoimmune'],
  'ophthalmology': ['rare_disease', 'cns'],
  // Neurology sub-indication adjacency
  'alzheimers': ['parkinsons', 'rare_neurological', 'cns'],
  'parkinsons': ['alzheimers', 'tremor', 'rare_neurological', 'cns'],
  'schizophrenia': ['depression', 'addiction', 'cns'],
  'depression': ['schizophrenia', 'addiction', 'pain', 'cns'],
  'pain': ['depression', 'cns', 'epilepsy', 'migraine'],
  'multiple_sclerosis': ['autoimmune', 'rare_neurological', 'cns'],
  'epilepsy': ['rare_neurological', 'pain', 'cns'],
  'rare_neurological': ['alzheimers', 'parkinsons', 'epilepsy', 'rare_disease', 'cns'],
  'als': ['rare_neurological', 'parkinsons', 'cns'],
  'huntingtons': ['rare_neurological', 'als', 'cns'],
  'migraine': ['pain', 'cns'],
  'narcolepsy': ['depression', 'cns'],
  'tremor': ['parkinsons', 'epilepsy', 'cns'],
  'tbi': ['pain', 'rare_neurological', 'cns'],
  'addiction': ['depression', 'schizophrenia', 'pain', 'cns'],
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

  // Enhanced breakdown data (Pro tier only)
  detailed_breakdown?: DetailedScoreBreakdown;
  watch_outs?: WatchOutFactor[];
  relevant_deals?: RelevantDeal[];
  strategic_context?: StrategicContext;
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
  let companyDealsMap: Map<string, any[]> = new Map();
  if (includeEnhancedBreakdown) {
    const companyIds = companies.map((c) => c.id);
    const { data: allDeals } = await supabase
      .from('deals')
      .select(
        'id, asset_name, licensor_id, licensee_id, licensor_name, licensee_name, modality, indication_category, indication_specific, phase_at_signing, total_deal_value_usd, upfront_usd, announced_date, deal_type, territory'
      )
      .or(`licensor_id.in.(${companyIds.join(',')}),licensee_id.in.(${companyIds.join(',')})`)
      .gte('announced_date', new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('announced_date', { ascending: false });

    if (allDeals) {
      for (const deal of allDeals) {
        const licensorDeals = companyDealsMap.get(deal.licensor_id) || [];
        licensorDeals.push(deal);
        companyDealsMap.set(deal.licensor_id, licensorDeals);

        const licenseeDeals = companyDealsMap.get(deal.licensee_id) || [];
        licenseeDeals.push(deal);
        companyDealsMap.set(deal.licensee_id, licenseeDeals);
      }
    }
  }

  for (const company of companies) {
    const { score, breakdown, reasons } = calculateMatchScore(company, input);

    // Only include meaningful matches (score >= 15)
    if (score >= 15) {
      const match: PartnerMatch = {
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
      };

      // Add enhanced breakdown for Pro tier
      if (includeEnhancedBreakdown) {
        const companyDeals = companyDealsMap.get(company.id) || [];
        match.detailed_breakdown = buildDetailedBreakdown(company, input, breakdown, companyDeals);
        match.watch_outs = calculateWatchOuts(company, input, companyDeals);
        match.strategic_context = buildStrategicContext(company);
        match.relevant_deals = companyDeals.slice(0, 5).map((deal) => ({
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
  company: any,
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
  const minPhaseRank = PHASE_RANK[company.phase_preference_min] ?? 0;
  const maxPhaseRank = PHASE_RANK[company.phase_preference_max] ?? 5;

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

  // Patent cliff urgency: upcoming cliffs in related indication = buying pressure
  const relevantCliffs = patentCliffs.filter((cliff: PatentCliff) => {
    const cliffIndication = cliff.indication?.toLowerCase() || '';
    return (
      (input.indication_category && cliffIndication.includes(input.indication_category.toLowerCase())) ||
      (input.indication_specific && cliffIndication.includes(input.indication_specific.toLowerCase())) ||
      (cliff.expiry_year <= 2028 && cliff.revenue_usd >= 1_000_000_000)
    );
  });

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
  const priorities = company.strategic_priorities || [];
  const hasPriorityMatch = priorities.some((p: string) => {
    const lower = p.toLowerCase();
    return (
      (input.indication_category && lower.includes(input.indication_category.toLowerCase())) ||
      (input.indication_specific && lower.includes(input.indication_specific.toLowerCase())) ||
      (input.modality && lower.includes(input.modality.replace(/_/g, ' ').toLowerCase()))
    );
  });

  if (hasPriorityMatch) {
    breakdown.strategic += WEIGHTS.strategic_priority_match;
    reasons.push({
      category: 'strategic',
      reason: `Matches stated strategic priorities`,
      strength: 'strong',
    });
  }

  // Pipeline gap from patent cliffs in target indication
  const pipelineGaps = patentCliffs
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
    }
  }

  // 7. QUALITY BONUSES
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
    WEIGHTS.phase_sweet_spot +
    WEIGHTS.deal_last_6mo +
    WEIGHTS.active_trials_relevant +
    WEIGHTS.strategic_patent_cliff +
    WEIGHTS.strategic_priority_match +
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
  company: any,
  input: MatchInput,
  breakdown: ScoreBreakdown,
  companyDeals: any[]
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

  // STRATEGIC FACTOR (from patent cliffs)
  const patentCliffs = parsePatentCliffs(company.patent_cliffs);
  const relevantCliff = patentCliffs.find(
    (cliff) =>
      cliff.indication?.toLowerCase().includes(input.indication_category?.toLowerCase() || '') ||
      cliff.indication?.toLowerCase().includes(input.indication_specific?.toLowerCase() || '')
  );

  if (relevantCliff || (company.revenue_at_risk_2027 && company.revenue_at_risk_2027 > 1000000000)) {
    const strategicEvidence: EvidenceLine[] = [];

    if (relevantCliff) {
      strategicEvidence.push({
        text: `${relevantCliff.drug_name} patent cliff ${relevantCliff.expiry_year} (${formatCurrency(relevantCliff.revenue_usd)} at risk)`,
        type: 'patent_cliff',
        highlight: true,
      });
      strategicEvidence.push({
        text: `Pipeline gap in ${relevantCliff.indication || input.indication_category}`,
        type: 'strategic',
      });
    } else if (company.revenue_at_risk_2027 > 1000000000) {
      strategicEvidence.push({
        text: `${formatCurrency(company.revenue_at_risk_2027)} revenue at risk by 2027`,
        type: 'patent_cliff',
        highlight: true,
      });
    }

    factors.push({
      category: 'strategic',
      title: 'Strategic Need',
      points: 10, // Bonus points for strategic alignment
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
 * Calculate watch-out factors for a partner match
 */
export function calculateWatchOuts(
  company: any,
  input: MatchInput,
  companyDeals: any[]
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
  const minPhaseRank = PHASE_RANK[company.phase_preference_min] ?? 0;
  const maxPhaseRank = PHASE_RANK[company.phase_preference_max] ?? 5;

  if (inputPhaseRank < minPhaseRank - 1) {
    watchOuts.push({
      title: 'Early Stage Hesitation',
      impact: -5,
      description: `Historically focuses on ${formatPhase(company.phase_preference_min)}+ assets. May require more data package.`,
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
 * Build strategic context from company data
 */
export function buildStrategicContext(company: any): StrategicContext {
  const patentCliffs = parsePatentCliffs(company.patent_cliffs);

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

  // Identify pipeline gaps based on patent cliffs
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
// HELPER FUNCTIONS
// ============================================================================

function parsePatentCliffs(cliffs: any): PatentCliff[] {
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
    us_eu: 'US & EU',
    ex_us: 'Ex-US',
    ex_china: 'Ex-China',
    china: 'China',
    japan: 'Japan',
    europe: 'Europe',
  };
  return labels[territory] || territory;
}

function generateDealRelevance(deal: any): string {
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
