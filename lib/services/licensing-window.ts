import { getPatentCliffs, type IndicationPatentCliff } from '@/lib/financial/patent-cliffs';

export interface LicensingWindowResult {
  status: 'active' | 'closing' | 'no_window';
  urgency: 'high' | 'medium' | 'low';
  estimatedMonthsRemaining: number | null;
  patentCliffYear: number | null;
  patentCliffDrug: string | null;
  biosimilarYear: number | null;
  revenueAtRiskM: number | null;
  signals: string[];
}

interface CompanyWindowInput {
  intentScore: number;
  pipelineGapScore?: number;
  lastDealDate?: string | null;
  activelyAcquiring?: boolean;
  acquisitionAppetite?: string | null;
  indicationsActive?: string[];
}

export function computeLicensingWindow(
  company: CompanyWindowInput,
  targetIndication?: string,
  targetTA?: string,
): LicensingWindowResult {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const signals: string[] = [];

  const indications = targetIndication
    ? [targetIndication]
    : (company.indicationsActive || []);

  let nearestCliff: IndicationPatentCliff | null = null;
  let nearestMonths = Infinity;

  for (const ind of indications) {
    const cliffs = getPatentCliffs(ind);
    for (const cliff of cliffs) {
      if (cliff.rank !== 1) continue;
      const monthsToLoe = (cliff.loeYear - currentYear) * 12 - currentMonth;
      if (monthsToLoe < nearestMonths && monthsToLoe > -12) {
        nearestMonths = monthsToLoe;
        nearestCliff = cliff;
      }
    }
  }

  if (!nearestCliff) {
    const hasIntent = company.intentScore >= 40;
    if (hasIntent && company.activelyAcquiring) {
      signals.push('No patent cliff data, but active acquisition signals');
      return {
        status: 'closing',
        urgency: 'low',
        estimatedMonthsRemaining: null,
        patentCliffYear: null,
        patentCliffDrug: null,
        biosimilarYear: null,
        revenueAtRiskM: null,
        signals,
      };
    }
    return {
      status: 'no_window',
      urgency: 'low',
      estimatedMonthsRemaining: null,
      patentCliffYear: null,
      patentCliffDrug: null,
      biosimilarYear: null,
      revenueAtRiskM: null,
      signals: ['No patent cliff approaching in tracked indications'],
    };
  }

  const dealLeadTimeMonths = 12;
  const windowMonths = Math.max(0, nearestMonths - dealLeadTimeMonths);
  const pipelineGap = company.pipelineGapScore ?? 50;

  signals.push(`${nearestCliff.drug} LOE in ${nearestCliff.loeYear} ($${Math.round(nearestCliff.currentRevenueUsdM / 1000)}B revenue at risk)`);

  if (nearestMonths <= 36) {
    signals.push(`Patent cliff in ${Math.round(nearestMonths)} months — active licensing pressure`);
  }

  if (company.intentScore >= 60) {
    signals.push(`High intent score (${Math.round(company.intentScore)}) — actively sourcing`);
  }

  if (company.lastDealDate) {
    const lastDeal = new Date(company.lastDealDate);
    const monthsSinceDeal = Math.round((now.getTime() - lastDeal.getTime()) / (30 * 24 * 60 * 60 * 1000));
    if (monthsSinceDeal <= 6) {
      signals.push(`Recent deal activity (${monthsSinceDeal}mo ago)`);
    } else if (monthsSinceDeal >= 18) {
      signals.push(`No deals in ${monthsSinceDeal} months — may be building pipeline gap`);
    }
  }

  if (company.activelyAcquiring) {
    signals.push('Flagged as actively acquiring');
  }

  if (company.intentScore >= 60 && nearestMonths <= 36 && pipelineGap >= 40) {
    return {
      status: 'active',
      urgency: 'high',
      estimatedMonthsRemaining: windowMonths > 0 ? windowMonths : null,
      patentCliffYear: nearestCliff.loeYear,
      patentCliffDrug: nearestCliff.drug,
      biosimilarYear: nearestCliff.biosimilarYear,
      revenueAtRiskM: nearestCliff.currentRevenueUsdM,
      signals,
    };
  }

  if (company.intentScore >= 40 && nearestMonths <= 48) {
    return {
      status: 'closing',
      urgency: 'medium',
      estimatedMonthsRemaining: windowMonths > 0 ? windowMonths : null,
      patentCliffYear: nearestCliff.loeYear,
      patentCliffDrug: nearestCliff.drug,
      biosimilarYear: nearestCliff.biosimilarYear,
      revenueAtRiskM: nearestCliff.currentRevenueUsdM,
      signals,
    };
  }

  return {
    status: 'no_window',
    urgency: 'low',
    estimatedMonthsRemaining: null,
    patentCliffYear: nearestCliff.loeYear,
    patentCliffDrug: nearestCliff.drug,
    biosimilarYear: nearestCliff.biosimilarYear,
    revenueAtRiskM: nearestCliff.currentRevenueUsdM,
    signals: signals.length > 0 ? signals : ['No active licensing window detected'],
  };
}
