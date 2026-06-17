import { TA_ADJACENCY } from '@/lib/financial/ta-adjacency';

interface AlertFilters {
  therapeutic_areas?: string[];
  modalities?: string[];
  min_value?: number;
  phases?: string[];
}

interface DealForScoring {
  therapeutic_area?: string;
  modality?: string;
  total_deal_value_usd?: number;
  phase_at_signing?: string;
}

interface RelevanceResult {
  score: number;
  factors: {
    ta_match: number;
    value_match: number;
    phase_match: number;
    modality_match: number;
  };
}

export function computeAlertRelevance(
  filters: AlertFilters,
  deal: DealForScoring,
): RelevanceResult {
  const factors = {
    ta_match: 0,
    value_match: 0,
    phase_match: 0,
    modality_match: 0,
  };

  // TA match (max 40 points)
  if (filters.therapeutic_areas?.length && deal.therapeutic_area) {
    if (filters.therapeutic_areas.includes(deal.therapeutic_area)) {
      factors.ta_match = 40;
    } else {
      const adjacent = TA_ADJACENCY[deal.therapeutic_area] || [];
      if (filters.therapeutic_areas.some(ta => adjacent.includes(ta))) {
        factors.ta_match = 20;
      }
    }
  } else {
    factors.ta_match = 25;
  }

  // Value match (max 30 points)
  if (filters.min_value && deal.total_deal_value_usd) {
    const ratio = deal.total_deal_value_usd / filters.min_value;
    if (ratio >= 0.8 && ratio <= 5.0) {
      factors.value_match = 30;
    } else if (ratio >= 0.5) {
      factors.value_match = 20;
    } else if (ratio > 0) {
      factors.value_match = 10;
    }
  } else {
    factors.value_match = 15;
  }

  // Phase match (max 20 points)
  if (filters.phases?.length && deal.phase_at_signing) {
    const normalized = deal.phase_at_signing.toLowerCase().replace(/\s+/g, '');
    if (filters.phases.some(p => p.toLowerCase().replace(/\s+/g, '') === normalized)) {
      factors.phase_match = 20;
    } else {
      factors.phase_match = 8;
    }
  } else {
    factors.phase_match = 10;
  }

  // Modality match (max 10 points)
  if (filters.modalities?.length && deal.modality) {
    const dealMod = deal.modality.toLowerCase();
    if (filters.modalities.some(m => m.toLowerCase() === dealMod)) {
      factors.modality_match = 10;
    } else {
      factors.modality_match = 3;
    }
  } else {
    factors.modality_match = 5;
  }

  const score = Math.min(100, factors.ta_match + factors.value_match + factors.phase_match + factors.modality_match);

  return { score, factors };
}
