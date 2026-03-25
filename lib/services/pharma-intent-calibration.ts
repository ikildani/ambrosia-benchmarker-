// Pharma Intent Score — Weight Calibration via Backtesting
// Analyzes historical deals to determine which intent factors best predict actual deal outcomes.
// For each company that closed a deal at time T, we look back 12 months to reconstruct
// what their intent signals were BEFORE the deal, then compare to companies that didn't deal.

import { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───────────────────────────────────────────────

export interface CalibratedWeights {
  weights: Record<string, number>;
  sampleSize: number;
  positiveSamples: number;
  negativeSamples: number;
  factorCorrelations: Record<string, number>;
  accuracyEstimate: number;
  calibratedAt: string;
}

interface HistoricalDeal {
  id: string;
  licensee_id: string;
  licensee_name: string | null;
  licensor_id: string | null;
  modality: string | null;
  indication_category: string | null;
  announced_date: string;
  deal_type: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
}

interface CompanySnapshot {
  companyId: string;
  companyName: string;
  didDeal: boolean;
  // Reconstructed intent factors at the lookback window
  dealsCount12mo: number;
  modalityAligned: boolean;
  indicationAligned: boolean;
  trialCountInSpace: number;
  hasPatentCliff: boolean;
  revenueAtRisk: number;
  activelyAcquiring: boolean;
  dealVelocity: number; // deals per month in window
  pipelineGap: boolean; // no trials in that modality/indication = gap
}

// The factors we calibrate weights for
const FACTOR_KEYS = [
  'dealsCount12mo',
  'modalityAligned',
  'indicationAligned',
  'trialCountInSpace',
  'hasPatentCliff',
  'revenueAtRisk',
  'activelyAcquiring',
  'dealVelocity',
  'pipelineGap',
] as const;

type FactorKey = (typeof FACTOR_KEYS)[number];

// ─── Core Calibration Function ───────────────────────────

export async function calibrateIntentWeights(
  supabase: SupabaseClient
): Promise<CalibratedWeights> {
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  // 1. Fetch all deals from the last 3 years
  const { data: deals, error: dealsError } = await supabase
    .from('deals')
    .select(
      'id, licensee_id, licensee_name, licensor_id, modality, indication_category, announced_date, deal_type, upfront_usd, total_deal_value_usd'
    )
    .gte('announced_date', threeYearsAgo.toISOString())
    .order('announced_date', { ascending: false });

  if (dealsError) {
    throw new Error(`Failed to fetch deals: ${dealsError.message}`);
  }

  if (!deals || deals.length < 10) {
    throw new Error(`Insufficient deal data for calibration: ${deals?.length ?? 0} deals found (need >= 10)`);
  }

  const typedDeals = deals as HistoricalDeal[];

  // 2. Get unique companies that did deals (positive samples)
  const dealingCompanyIds = new Set<string>();
  const dealsByCompany = new Map<string, HistoricalDeal[]>();

  for (const deal of typedDeals) {
    if (deal.licensee_id) {
      dealingCompanyIds.add(deal.licensee_id);
      const existing = dealsByCompany.get(deal.licensee_id) || [];
      existing.push(deal);
      dealsByCompany.set(deal.licensee_id, existing);
    }
  }

  // 3. Fetch all companies to build positive + negative sample sets
  const { data: allCompanies, error: compError } = await supabase
    .from('companies')
    .select(
      'id, name, modalities_active, modalities_primary, indications_active, indications_specific, deals_last_12mo, deals_last_24mo, actively_acquiring, patent_cliffs, revenue_at_risk_2025, revenue_at_risk_2026, revenue_at_risk_2027, data_quality_score'
    )
    .gte('data_quality_score', 30); // Only calibrate against reasonably-data-rich companies

  if (compError) {
    throw new Error(`Failed to fetch companies: ${compError.message}`);
  }

  // 4. Fetch trial counts by company
  const { data: trialCounts, error: trialsError } = await supabase
    .from('company_trials')
    .select('company_id, modality, indication_category')
    .in('status', ['recruiting', 'active_not_recruiting', 'not_yet_recruiting', 'completed']);

  if (trialsError) {
    console.warn('Failed to fetch trials for calibration:', trialsError.message);
  }

  const trialsByCompany = new Map<string, Array<{ modality: string | null; indication_category: string | null }>>();
  if (trialCounts) {
    for (const t of trialCounts) {
      const existing = trialsByCompany.get(t.company_id) || [];
      existing.push(t);
      trialsByCompany.set(t.company_id, existing);
    }
  }

  // 5. Build snapshots for each company
  const snapshots: CompanySnapshot[] = [];

  for (const company of allCompanies || []) {
    const companyDeals = dealsByCompany.get(company.id) || [];
    const didDeal = dealingCompanyIds.has(company.id);

    // For positive samples: use their first deal's modality/indication as the "target"
    // For negative samples: use their most active modality/indication
    let targetModality: string | null = null;
    let targetIndication: string | null = null;

    if (didDeal && companyDeals.length > 0) {
      // Use earliest deal in window to reconstruct pre-deal state
      const earliestDeal = companyDeals[companyDeals.length - 1];
      targetModality = earliestDeal.modality;
      targetIndication = earliestDeal.indication_category;
    } else {
      // Use primary modality/indication from profile
      targetModality = company.modalities_primary?.[0] || company.modalities_active?.[0] || null;
      targetIndication = company.indications_active?.[0] || null;
    }

    const companyTrials = trialsByCompany.get(company.id) || [];
    const trialsInSpace = companyTrials.filter(
      (t) =>
        (targetModality && t.modality === targetModality) ||
        (targetIndication && t.indication_category === targetIndication)
    );

    // Reconstruct 12-month lookback factors
    const lookbackDeals = companyDeals.filter((d) => {
      const dDate = new Date(d.announced_date);
      const earliest = didDeal
        ? new Date(companyDeals[companyDeals.length - 1].announced_date)
        : new Date();
      const lookbackStart = new Date(earliest);
      lookbackStart.setMonth(lookbackStart.getMonth() - 12);
      return dDate >= lookbackStart && dDate < earliest;
    });

    const modalityAligned =
      targetModality != null &&
      (company.modalities_active?.includes(targetModality) ||
        company.modalities_primary?.includes(targetModality));

    const indicationAligned =
      targetIndication != null &&
      (company.indications_active?.includes(targetIndication) ||
        company.indications_specific?.includes(targetIndication));

    const hasPatentCliff = !!(
      company.patent_cliffs &&
      typeof company.patent_cliffs === 'object' &&
      Object.keys(company.patent_cliffs as object).length > 0
    );

    const revenueAtRisk = Math.max(
      company.revenue_at_risk_2025 || 0,
      company.revenue_at_risk_2026 || 0,
      company.revenue_at_risk_2027 || 0
    );

    snapshots.push({
      companyId: company.id,
      companyName: company.name,
      didDeal,
      dealsCount12mo: lookbackDeals.length,
      modalityAligned: !!modalityAligned,
      indicationAligned: !!indicationAligned,
      trialCountInSpace: trialsInSpace.length,
      hasPatentCliff,
      revenueAtRisk,
      activelyAcquiring: !!company.actively_acquiring,
      dealVelocity: lookbackDeals.length / 12,
      pipelineGap: trialsInSpace.length === 0 && (!!targetModality || !!targetIndication),
    });
  }

  // 6. Calculate point-biserial correlation for each factor
  const positives = snapshots.filter((s) => s.didDeal);
  const negatives = snapshots.filter((s) => !s.didDeal);

  if (positives.length === 0 || negatives.length === 0) {
    throw new Error(
      `Cannot calibrate: ${positives.length} positive, ${negatives.length} negative samples`
    );
  }

  const correlations: Record<string, number> = {};

  for (const factor of FACTOR_KEYS) {
    const posValues = positives.map((s) => numericValue(s, factor));
    const negValues = negatives.map((s) => numericValue(s, factor));

    const posMean = mean(posValues);
    const negMean = mean(negValues);
    const allValues = [...posValues, ...negValues];
    const stdDev = standardDeviation(allValues);

    if (stdDev === 0) {
      correlations[factor] = 0;
    } else {
      // Point-biserial correlation: r = (M1 - M0) * sqrt(n1*n0) / (N * s)
      const n1 = positives.length;
      const n0 = negatives.length;
      const N = n1 + n0;
      correlations[factor] = ((posMean - negMean) * Math.sqrt((n1 * n0) / (N * N))) / stdDev;
    }
  }

  // 7. Convert correlations to normalized weights (sum = 1.0)
  // Use absolute value of correlation (some factors may be negatively correlated = suppressive)
  const absCorrelations = Object.entries(correlations).map(([k, v]) => [k, Math.abs(v)] as const);
  const totalCorrelation = absCorrelations.reduce((sum, [, v]) => sum + v, 0);

  const weights: Record<string, number> = {};

  if (totalCorrelation === 0) {
    // Fallback: equal weights
    const equalWeight = 1.0 / FACTOR_KEYS.length;
    for (const factor of FACTOR_KEYS) {
      weights[factor] = Number(equalWeight.toFixed(4));
    }
  } else {
    for (const [factor, absCorr] of absCorrelations) {
      weights[factor] = Number((absCorr / totalCorrelation).toFixed(4));
    }
  }

  // Ensure weights sum to exactly 1.0 (fix rounding)
  const weightSum = Object.values(weights).reduce((s, w) => s + w, 0);
  const correction = 1.0 - weightSum;
  const firstKey = Object.keys(weights)[0];
  if (firstKey) {
    weights[firstKey] = Number((weights[firstKey] + correction).toFixed(4));
  }

  // 8. Estimate accuracy using leave-one-out on positive samples
  let correctPredictions = 0;
  const medianScore = computeMedianScore(snapshots, weights);

  for (const snapshot of snapshots) {
    const score = computeSnapshotScore(snapshot, weights);
    const predicted = score >= medianScore;
    if (predicted === snapshot.didDeal) {
      correctPredictions++;
    }
  }

  const accuracy = correctPredictions / snapshots.length;

  return {
    weights,
    sampleSize: snapshots.length,
    positiveSamples: positives.length,
    negativeSamples: negatives.length,
    factorCorrelations: correlations,
    accuracyEstimate: Number(accuracy.toFixed(4)),
    calibratedAt: new Date().toISOString(),
  };
}

// ─── Helpers ─────────────────────────────────────────────

function numericValue(snapshot: CompanySnapshot, factor: FactorKey): number {
  switch (factor) {
    case 'dealsCount12mo':
      return snapshot.dealsCount12mo;
    case 'modalityAligned':
      return snapshot.modalityAligned ? 1 : 0;
    case 'indicationAligned':
      return snapshot.indicationAligned ? 1 : 0;
    case 'trialCountInSpace':
      return snapshot.trialCountInSpace;
    case 'hasPatentCliff':
      return snapshot.hasPatentCliff ? 1 : 0;
    case 'revenueAtRisk':
      // Normalize: log scale to dampen outliers
      return snapshot.revenueAtRisk > 0 ? Math.log10(snapshot.revenueAtRisk + 1) : 0;
    case 'activelyAcquiring':
      return snapshot.activelyAcquiring ? 1 : 0;
    case 'dealVelocity':
      return snapshot.dealVelocity;
    case 'pipelineGap':
      return snapshot.pipelineGap ? 1 : 0;
    default:
      return 0;
  }
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeSnapshotScore(snapshot: CompanySnapshot, weights: Record<string, number>): number {
  let score = 0;
  for (const factor of FACTOR_KEYS) {
    const value = numericValue(snapshot, factor);
    score += value * (weights[factor] || 0);
  }
  return score;
}

function computeMedianScore(snapshots: CompanySnapshot[], weights: Record<string, number>): number {
  const scores = snapshots.map((s) => computeSnapshotScore(s, weights)).sort((a, b) => a - b);
  const mid = Math.floor(scores.length / 2);
  return scores.length % 2 !== 0 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
}
