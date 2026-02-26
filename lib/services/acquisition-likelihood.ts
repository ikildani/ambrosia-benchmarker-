/**
 * Acquisition Likelihood Scoring
 *
 * Predicts how likely a company is to acquire or in-license an asset
 * based on patent cliff urgency, pipeline gaps, financial capacity,
 * recent M&A activity, and competitive pressure.
 */

import type { AcquisitionLikelihood } from '@/lib/financial/types';

interface CompanySignals {
  companyName: string;
  companyType: string;
  // Patent cliff data
  revenueAtRisk3yr?: number;  // $B revenue facing LOE in next 3 years
  revenueAtRisk5yr?: number;  // $B revenue facing LOE in next 5 years
  totalRevenue?: number;       // $B annual revenue
  // Pipeline health
  pipelineGapScore?: number;   // 0-100, higher = more gaps
  activeTrialsCount?: number;
  // Financial capacity
  cashOnHand?: number;         // $B
  debtCapacity?: number;       // $B
  // Historical behavior
  dealsLast12mo?: number;
  dealsLast24mo?: number;
  lastDealDate?: string;
  acquisitionHistory?: number; // acquisitions in last 3 years
  // Match quality
  modalityAlignment?: 'exact' | 'primary' | 'adjacent' | 'none';
  indicationAlignment?: 'exact' | 'adjacent' | 'broad' | 'none';
  phasePreferenceMatch?: boolean;
}

/**
 * Score the likelihood that a company will acquire or in-license a given asset.
 *
 * The model weights five key factors:
 * 1. Patent cliff urgency (30%) — revenue at risk creates acquisition pressure
 * 2. Pipeline gap severity (25%) — gaps in target TA/modality drive need
 * 3. Financial capacity (15%) — cash/debt headroom to do deals
 * 4. Deal momentum (15%) — recent activity signals active BD team
 * 5. Strategic fit (15%) — alignment with company's existing focus
 */
export function scoreAcquisitionLikelihood(signals: CompanySignals): AcquisitionLikelihood {
  const factors: AcquisitionLikelihood['factors'] = [];

  // Factor 1: Patent cliff urgency (30% weight)
  const cliffScore = calculatePatentCliffScore(signals);
  factors.push({
    factor: 'Patent Cliff Urgency',
    weight: 0.30,
    score: cliffScore.score,
    narrative: cliffScore.narrative,
  });

  // Factor 2: Pipeline gap severity (25% weight)
  const gapScore = calculatePipelineGapScore(signals);
  factors.push({
    factor: 'Pipeline Gap Severity',
    weight: 0.25,
    score: gapScore.score,
    narrative: gapScore.narrative,
  });

  // Factor 3: Financial capacity (15% weight)
  const finScore = calculateFinancialCapacity(signals);
  factors.push({
    factor: 'Financial Capacity',
    weight: 0.15,
    score: finScore.score,
    narrative: finScore.narrative,
  });

  // Factor 4: Deal momentum (15% weight)
  const momentumScore = calculateDealMomentum(signals);
  factors.push({
    factor: 'Deal Momentum',
    weight: 0.15,
    score: momentumScore.score,
    narrative: momentumScore.narrative,
  });

  // Factor 5: Strategic fit (15% weight)
  const fitScore = calculateStrategicFit(signals);
  factors.push({
    factor: 'Strategic Fit',
    weight: 0.15,
    score: fitScore.score,
    narrative: fitScore.narrative,
  });

  // Weighted total
  const totalScore = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  // Categorize
  const category: AcquisitionLikelihood['category'] =
    totalScore >= 75 ? 'very_likely'
    : totalScore >= 55 ? 'likely'
    : totalScore >= 35 ? 'possible'
    : 'unlikely';

  // Timing assessment
  const timing: AcquisitionLikelihood['timing'] =
    cliffScore.score >= 80 && momentumScore.score >= 60 ? 'imminent'
    : totalScore >= 65 ? 'near_term'
    : totalScore >= 45 ? 'medium_term'
    : 'speculative';

  const narrative = generateLikelihoodNarrative(signals.companyName, totalScore, category, timing, factors);

  return {
    score: totalScore,
    category,
    factors,
    timing,
    narrative,
  };
}

function calculatePatentCliffScore(signals: CompanySignals): { score: number; narrative: string } {
  if (!signals.revenueAtRisk3yr && !signals.revenueAtRisk5yr) {
    // No data — use company type heuristic
    const typeScores: Record<string, number> = {
      'Large Pharma': 55, // Large pharma always has some cliff pressure
      'Mid Pharma': 45,
      'Biotech': 30,
      'Specialty Pharma': 40,
    };
    const score = typeScores[signals.companyType] || 40;
    return {
      score,
      narrative: `${signals.companyName} faces typical patent cliff pressure for a ${signals.companyType.toLowerCase()} company.`,
    };
  }

  const totalRev = signals.totalRevenue || 20; // default $20B for large pharma
  const atRisk3yr = signals.revenueAtRisk3yr || 0;
  const riskRatio = atRisk3yr / totalRev;

  let score: number;
  let urgency: string;

  if (riskRatio >= 0.30) {
    score = 90;
    urgency = 'Critical';
  } else if (riskRatio >= 0.20) {
    score = 75;
    urgency = 'High';
  } else if (riskRatio >= 0.10) {
    score = 55;
    urgency = 'Moderate';
  } else if (riskRatio >= 0.05) {
    score = 35;
    urgency = 'Low';
  } else {
    score = 15;
    urgency = 'Minimal';
  }

  return {
    score,
    narrative: `${urgency} patent cliff pressure: $${atRisk3yr.toFixed(1)}B revenue (${(riskRatio * 100).toFixed(0)}% of total) at risk over 3 years.`,
  };
}

function calculatePipelineGapScore(signals: CompanySignals): { score: number; narrative: string } {
  const gapScore = signals.pipelineGapScore ?? 50;
  const trialCount = signals.activeTrialsCount ?? 50;

  // Fewer trials + high gap score = strong acquisition driver
  let score = gapScore;
  if (trialCount < 20) score = Math.min(95, score + 15); // thin pipeline amplifies urgency
  if (trialCount > 100) score = Math.max(10, score - 10); // robust pipeline reduces urgency

  const severity = score >= 70 ? 'significant' : score >= 45 ? 'moderate' : 'limited';

  return {
    score: Math.min(100, Math.max(0, score)),
    narrative: `${severity} pipeline gaps identified (${trialCount} active trials). ${score >= 60 ? 'External innovation needed to fill therapeutic gaps.' : 'Internal pipeline appears adequate but selective in-licensing still likely.'}`,
  };
}

function calculateFinancialCapacity(signals: CompanySignals): { score: number; narrative: string } {
  const cash = signals.cashOnHand ?? (signals.companyType === 'Large Pharma' ? 15 : 5);

  let score: number;
  if (cash >= 30) score = 90;      // Mega-deal capacity
  else if (cash >= 15) score = 75;  // Multiple mid-size deals
  else if (cash >= 5) score = 55;   // Can do licensing/smaller acquisitions
  else if (cash >= 1) score = 35;   // Constrained
  else score = 15;                   // Very limited

  return {
    score,
    narrative: `~$${cash.toFixed(0)}B financial capacity. ${score >= 70 ? 'Ample firepower for mid-to-large deals.' : score >= 45 ? 'Adequate for licensing and smaller acquisitions.' : 'Financial constraints may limit deal size.'}`,
  };
}

function calculateDealMomentum(signals: CompanySignals): { score: number; narrative: string } {
  const deals12mo = signals.dealsLast12mo ?? 0;
  const deals24mo = signals.dealsLast24mo ?? 0;
  const acquisitions = signals.acquisitionHistory ?? 0;

  // Recent deal activity signals active BD team
  let score = Math.min(90, deals12mo * 15 + deals24mo * 5 + acquisitions * 10);
  if (score === 0 && signals.companyType === 'Large Pharma') {
    score = 40; // Large pharma always doing some deals
  }

  // Recent last deal date boosts score
  if (signals.lastDealDate) {
    const daysSinceLastDeal = Math.floor(
      (Date.now() - new Date(signals.lastDealDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastDeal < 90) score = Math.min(95, score + 15);
    else if (daysSinceLastDeal < 180) score = Math.min(90, score + 10);
  }

  const momentum = score >= 70 ? 'High' : score >= 40 ? 'Moderate' : 'Low';

  return {
    score: Math.min(100, Math.max(0, score)),
    narrative: `${momentum} deal momentum: ${deals12mo} deals in last 12 months, ${acquisitions} acquisitions in last 3 years. ${score >= 60 ? 'Active BD team with proven deal-making track record.' : 'Limited recent activity — may be cautious or repositioning.'}`,
  };
}

function calculateStrategicFit(signals: CompanySignals): { score: number; narrative: string } {
  let score = 50; // base

  // Modality alignment
  const modalityScores: Record<string, number> = {
    exact: 25, primary: 18, adjacent: 10, none: 0,
  };
  score += modalityScores[signals.modalityAlignment || 'none'] || 0;

  // Indication alignment
  const indicationScores: Record<string, number> = {
    exact: 20, adjacent: 12, broad: 5, none: 0,
  };
  score += indicationScores[signals.indicationAlignment || 'none'] || 0;

  // Phase preference match
  if (signals.phasePreferenceMatch) score += 10;

  const fitLevel = score >= 80 ? 'Excellent' : score >= 60 ? 'Strong' : score >= 40 ? 'Moderate' : 'Limited';

  return {
    score: Math.min(100, Math.max(0, score)),
    narrative: `${fitLevel} strategic fit. ${signals.modalityAlignment === 'exact' ? 'Direct modality alignment. ' : ''}${signals.indicationAlignment === 'exact' ? 'Exact indication overlap. ' : ''}${score >= 70 ? 'Asset fills a clear portfolio need.' : 'Some strategic alignment but may not be a top priority.'}`,
  };
}

function generateLikelihoodNarrative(
  companyName: string,
  score: number,
  category: string,
  timing: string,
  factors: AcquisitionLikelihood['factors'],
): string {
  const topFactor = factors.reduce((max, f) => f.score * f.weight > max.score * max.weight ? f : max, factors[0]);
  const timingText: Record<string, string> = {
    imminent: 'within the next 6 months',
    near_term: 'within the next 12 months',
    medium_term: 'within the next 12-24 months',
    speculative: 'over a longer time horizon (24+ months)',
  };

  const categoryText: Record<string, string> = {
    very_likely: 'is a highly probable acquirer/licensee',
    likely: 'is a likely deal partner',
    possible: 'is a possible but not certain partner',
    unlikely: 'has limited acquisition interest at this time',
  };

  return `${companyName} ${categoryText[category]} (${score}/100), with deal activity most likely ${timingText[timing]}. ` +
    `Primary driver: ${topFactor.factor} (${topFactor.narrative})`;
}
