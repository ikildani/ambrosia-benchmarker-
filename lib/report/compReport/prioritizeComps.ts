import type { ComparableDeal, HedocnicScoreBreakdown } from '@/lib/comparableDeals';

interface ScoredComp {
  deal: ComparableDeal;
  score: HedocnicScoreBreakdown;
  reasons: string[];
  id: string;
}

export function prioritizeCompsForReport(
  allResults: ScoredComp[],
  indication: string,
  maxDeals: number = 12
): ScoredComp[] {
  const withValue = allResults.filter(r =>
    r.deal.totalValueM != null && r.deal.totalValueM > 0
  );

  const exactIndicationMatches = withValue.filter(r =>
    r.deal.indications?.some(ind =>
      ind.toLowerCase() === indication.toLowerCase()
    )
  );

  const nonIndicationMatches = withValue.filter(r =>
    !r.deal.indications?.some(ind =>
      ind.toLowerCase() === indication.toLowerCase()
    )
  );

  const combined = [
    ...exactIndicationMatches,
    ...nonIndicationMatches,
  ];

  return combined.slice(0, maxDeals);
}
