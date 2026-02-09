import benchmarks from '@/data/benchmarks.json';
import { CalculationInput } from './calculations';

export interface ComparableDeal {
  id: string;
  parties: string;
  totalValue: number;
  upfront: number;
  year: number;
  phase: string;
  modalities: string[];
  indications: string[];
  therapeuticArea: string;
  context: string;
  relevanceScore: number;
  relevanceReasons: string[];
}

export function findComparableDeals(inputs: CalculationInput): ComparableDeal[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = (benchmarks as any).comparableDeals as Array<{
    id: string;
    parties: string;
    totalValue: number;
    upfront: number;
    year: number;
    phase: string;
    modalities: string[];
    indications: string[];
    therapeuticArea: string;
    context: string;
  }>;

  if (!deals) return [];

  const scored: ComparableDeal[] = deals.map((deal) => {
    let score = 0;
    const reasons: string[] = [];

    // Therapeutic area match (+3)
    if (deal.therapeuticArea === inputs.therapeuticArea) {
      score += 3;
      reasons.push('Same therapeutic area');
    }

    // Modality match (+4)
    if (deal.modalities.includes(inputs.modality)) {
      score += 4;
      reasons.push('Same modality');
    }

    // Indication match (+3)
    if (deal.indications.includes(inputs.indication)) {
      score += 3;
      reasons.push('Same indication');
    }

    // Phase proximity (+2 for exact, +1 for adjacent)
    const phaseOrder = ['preclinical', 'phase1', 'phase2', 'phase3', 'approved'];
    const inputIdx = phaseOrder.indexOf(inputs.phase);
    const dealIdx = phaseOrder.indexOf(deal.phase);
    if (inputIdx === dealIdx) {
      score += 2;
      reasons.push('Same phase');
    } else if (Math.abs(inputIdx - dealIdx) === 1) {
      score += 1;
      reasons.push('Adjacent phase');
    }

    return {
      ...deal,
      relevanceScore: score,
      relevanceReasons: reasons,
    };
  });

  // Filter to at least some relevance, sort by score descending, return top 5
  return scored
    .filter((d) => d.relevanceScore >= 2)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5);
}
