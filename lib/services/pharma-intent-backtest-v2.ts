// Pharma Intent Score — Backtest V2
// ═══════════════════════════════════════════════════════════════════════════
// Upgraded backtest addressing all issues identified in the April 2026 audit
// of the original pharma-intent-calibration.ts:
//
// 1. TEMPORAL HOLDOUT (no more in-sample evaluation)
//    Train on deals announced before cutoff, test on deals after cutoff.
//
// 2. TARGET-SPECIFIC LABELS (not "did ANY deal" but "did deal in TARGET mod/ind")
//    A positive example is (company, target_mod, target_ind, snapshot_date, label=1)
//    where the company actually did a deal matching that target within 12mo of
//    the snapshot. Negatives are matched pairs that did NOT deal.
//
// 3. TEN PRODUCTION FACTORS (not 9 parallel ones)
//    Imports and calls calculatePharmaIntent from pharma-intent.ts directly,
//    extracting individual factor scores from the returned factors array.
//    This means the backtest measures the ACTUAL production model.
//
// 4. LOGISTIC REGRESSION (not median split)
//    Pure-TypeScript gradient descent with L2 regularization. Gives us real
//    probabilities, ROC-AUC, and continuous precision@K metrics.
//
// 5. TIME-DECAYED FEATURES
//    Binary flags (e.g., activelyAcquiring) replaced with continuous
//    recency-weighted versions.
//
// 6. INTERACTION FEATURES
//    patentCliff × dealVelocity, pipelineGap × alignment, etc. Captures
//    non-linear compounding that linear factor sums miss.
//
// 7. REAL METRICS
//    Accuracy, ROC-AUC, precision@top-decile, precision@top-quartile,
//    Brier score (calibration), confusion matrix, per-factor feature
//    importance (via LR coefficient magnitudes).
//
// LIMITATIONS (documented honestly):
// - Company metadata (modalities_active, patent_cliffs) uses CURRENT state,
//   not historical state at snapshot_date. Fixing this requires company
//   history snapshots which we don't currently store.
// - Negatives are sampled by matching positive (target, snapshot_date) tuples
//   to random other companies. This introduces some class-imbalance bias.
// - 4x negatives per positive — not the true base rate (which would be ~100x).
//   We trade class balance for training stability; metrics reflect a 4:1 world,
//   not the real ~100:1 world. Precision@K is the metric to care about.

import { SupabaseClient } from '@supabase/supabase-js';
import {
  calculatePharmaIntent,
  CompanyForIntent,
  DealForIntent,
  TrialForIntent,
  PressReleaseForIntent,
  ResearchSignalForIntent,
  IntentFactor,
} from './pharma-intent';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface BacktestV2Config {
  /** How many months to look back for the training window. Default 36. */
  trainMonths: number;
  /** How many months to hold out for testing. Default 12. */
  testMonths: number;
  /** How many negatives to sample per positive. Default 4. */
  negativesPerPositive: number;
  /** L2 regularization strength for LR. Default 0.1. */
  l2Lambda: number;
  /** Learning rate for gradient descent. Default 0.05. */
  learningRate: number;
  /** Max iterations. Default 2000. */
  maxIterations: number;
  /** Random seed for reproducibility. Default 42. */
  seed: number;
  /** Minimum company data_quality_score to include. Default 30. */
  minDataQuality: number;
}

export const DEFAULT_CONFIG: BacktestV2Config = {
  trainMonths: 36,
  testMonths: 12,
  negativesPerPositive: 4,
  l2Lambda: 0.1,
  learningRate: 0.05,
  maxIterations: 2000,
  seed: 42,
  minDataQuality: 30,
};

export interface BacktestV2Result {
  calibratedAt: string;
  config: BacktestV2Config;
  dataStats: {
    totalDealsInWindow: number;
    totalCompanies: number;
    totalTrials: number;
    totalPressReleases: number;
    totalResearchSignals: number;
    trainCutoffDate: string;
    testStartDate: string;
  };
  sampleStats: {
    trainPositives: number;
    trainNegatives: number;
    testPositives: number;
    testNegatives: number;
    featureCount: number;
  };
  // Held-out metrics (the honest numbers)
  metrics: {
    accuracy: number;             // 0-1
    rocAuc: number;               // 0-1
    precisionAtTopDecile: number; // 0-1
    precisionAtTopQuartile: number; // 0-1
    precisionAtTopHalf: number;   // 0-1
    liftAtTopDecile: number;      // multiplier vs base rate
    brierScore: number;           // 0-1, lower is better calibrated
    confusionMatrix: {
      truePositives: number;
      trueNegatives: number;
      falsePositives: number;
      falseNegatives: number;
    };
    precision: number;            // TP / (TP + FP)
    recall: number;               // TP / (TP + FN)
    f1: number;                   // harmonic mean
  };
  // Feature importance (LR coefficient magnitudes, standardized)
  featureImportance: Array<{
    feature: string;
    coefficient: number;
    standardizedImportance: number;
    category: 'production_factor' | 'time_decay' | 'interaction';
  }>;
  // The calibrated weights (10 production factors only, normalized to sum=1)
  // These are what should feed back into the production engine
  calibratedProductionWeights: Record<string, number>;
  // Comparison to hardcoded production weights
  weightShift: Array<{
    factor: string;
    currentWeight: number;
    calibratedWeight: number;
    delta: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Feature Extraction
// ═══════════════════════════════════════════════════════════════════════════

// Names of features in order — KEEP THIS STABLE
// Production factors (10) come from calling calculatePharmaIntent and
// extracting the factors array. These are scores 0-100.
const PRODUCTION_FACTOR_NAMES = [
  'Patent Cliff',
  'Deal Velocity',
  'Pipeline Gap',
  'Alignment', // Modality × Phase × Company Type
  'Competitive Pressure',
  'Strategic Signals',
  'Research Investment',
  'Deal Persistence',
  'Self-Saturation',
  'Portfolio Balance',
] as const;

// Time-decayed continuous features that complement the production scores
const TIME_DECAY_FEATURE_NAMES = [
  'recency_weighted_deals_24mo',
  'days_since_last_deal_inv',
  'active_trial_count_log',
  'revenue_at_risk_log',
  'strategic_priority_match',
  'company_type_size_rank',
] as const;

// Interaction features — non-linear compounding effects
const INTERACTION_FEATURE_NAMES = [
  'patent_cliff_x_deal_velocity',
  'pipeline_gap_x_alignment',
  'patent_cliff_x_pipeline_gap',
  'competitive_x_strategic',
  'deal_velocity_x_alignment',
  'saturation_x_persistence_inv', // inverted saturation × persistence
] as const;

const ALL_FEATURE_NAMES = [
  ...PRODUCTION_FACTOR_NAMES.map(n => `prod_${n.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`),
  ...TIME_DECAY_FEATURE_NAMES,
  ...INTERACTION_FEATURE_NAMES,
];

const FEATURE_COUNT = ALL_FEATURE_NAMES.length; // 22

interface LabeledSample {
  companyId: string;
  companyName: string;
  targetModality: string;
  targetIndication: string;
  snapshotDate: Date;
  dealDate: Date | null; // null for negatives
  label: 0 | 1;
  features: number[]; // length FEATURE_COUNT
}

/**
 * Extract all features for a (company, target, snapshot_date) tuple.
 *
 * Inputs must be pre-filtered to only include deals/trials/press/research
 * events that occurred BEFORE snapshotDate to avoid temporal leakage.
 */
function extractFeatures(
  company: CompanyForIntent,
  targetModality: string,
  targetIndication: string,
  targetPhase: string,
  targetTA: string,
  historicalDeals: DealForIntent[],
  historicalTrials: TrialForIntent[],
  historicalAllDeals: DealForIntent[],
  historicalPress: PressReleaseForIntent[],
  historicalResearch: ResearchSignalForIntent[],
  snapshotDate: Date,
): number[] {
  // 1. Call production scoring function → get 10 factor scores
  const intent = calculatePharmaIntent(
    company,
    targetModality,
    targetIndication,
    historicalDeals,
    historicalTrials,
    historicalAllDeals,
    historicalPress,
    historicalResearch,
    targetPhase,
    targetTA,
  );

  const factorMap = new Map<string, IntentFactor>();
  for (const f of intent.factors) {
    factorMap.set(f.name, f);
  }

  const productionScores: number[] = PRODUCTION_FACTOR_NAMES.map(name => {
    const f = factorMap.get(name);
    return f ? f.score / 100 : 0; // normalize to 0-1
  });

  // 2. Time-decayed features
  // recency_weighted_deals_24mo: weighted sum of deals in last 24mo from snapshot
  const snapMs = snapshotDate.getTime();
  let weightedDeals = 0;
  let lastDealMs = 0;
  for (const d of historicalDeals) {
    const dateMs = new Date(d.announced_date).getTime();
    if (dateMs > snapMs) continue; // leakage guard
    const ageMonths = (snapMs - dateMs) / (1000 * 60 * 60 * 24 * 30.44);
    if (ageMonths > 24) continue;
    // Exponential decay with 12mo half-life
    const weight = Math.pow(0.5, ageMonths / 12);
    weightedDeals += weight;
    if (dateMs > lastDealMs) lastDealMs = dateMs;
  }
  const daysSinceLastDeal = lastDealMs > 0
    ? (snapMs - lastDealMs) / (1000 * 60 * 60 * 24)
    : 730; // default to 2 years if no deal history
  // Inverse days: 1 / (1 + days/90) — higher = more recent
  const daysSinceLastDealInv = 1 / (1 + daysSinceLastDeal / 90);

  const activeTrialCountLog = Math.log1p(
    historicalTrials.filter(t =>
      t.status === 'recruiting' || t.status === 'active_not_recruiting'
    ).length
  );

  const revenueAtRisk =
    (company.revenue_at_risk_2025 || 0) +
    (company.revenue_at_risk_2026 || 0) +
    (company.revenue_at_risk_2027 || 0);
  const revenueAtRiskLog = revenueAtRisk > 0 ? Math.log10(revenueAtRisk + 1) / 11 : 0;

  // strategic_priority_match: 1 if targetModality or targetIndication in priorities
  const priorities = (company.strategic_priorities || []).map(p => (p || '').toLowerCase());
  const strategicPriorityMatch = priorities.some(p =>
    p.includes(targetModality.toLowerCase()) ||
    p.includes(targetIndication.toLowerCase())
  ) ? 1 : 0;

  // company_type_size_rank: large_pharma=1.0, mid_pharma=0.75, large_biotech=0.6, mid_biotech=0.4, specialty=0.5
  const companyTypeSize = (() => {
    switch (company.company_type) {
      case 'large_pharma': return 1.0;
      case 'mid_pharma': return 0.75;
      case 'large_biotech': return 0.6;
      case 'specialty': return 0.5;
      case 'mid_biotech': return 0.4;
      default: return 0.3;
    }
  })();

  // Normalize time-decay features to 0-1
  const weightedDealsNorm = Math.min(1, weightedDeals / 5); // 5 weighted deals = max

  const timeDecay: number[] = [
    weightedDealsNorm,
    daysSinceLastDealInv,
    Math.min(1, activeTrialCountLog / Math.log(50)), // 50 trials = max
    revenueAtRiskLog,
    strategicPriorityMatch,
    companyTypeSize,
  ];

  // 3. Interaction features (all products of production scores)
  const [patentCliff, dealVelocity, pipelineGap, alignment, competitive, strategic, , , saturation, ] = productionScores;
  const persistence = productionScores[7];

  const interactions: number[] = [
    patentCliff * dealVelocity,
    pipelineGap * alignment,
    patentCliff * pipelineGap,
    competitive * strategic,
    dealVelocity * alignment,
    (1 - saturation) * persistence, // inverted saturation: low saturation × high persistence = strong signal
  ];

  return [...productionScores, ...timeDecay, ...interactions];
}

// ═══════════════════════════════════════════════════════════════════════════
// Logistic Regression (pure TypeScript, gradient descent + L2)
// ═══════════════════════════════════════════════════════════════════════════

interface LRModel {
  weights: number[];     // length FEATURE_COUNT
  bias: number;
  featureMeans: number[]; // for standardization
  featureStds: number[];
  iterations: number;
  finalLoss: number;
}

function sigmoid(z: number): number {
  if (z > 500) return 1;
  if (z < -500) return 0;
  return 1 / (1 + Math.exp(-z));
}

function standardize(X: number[][]): { X: number[][]; means: number[]; stds: number[] } {
  const n = X.length;
  const d = X[0].length;
  const means = new Array(d).fill(0);
  const stds = new Array(d).fill(1);

  for (let j = 0; j < d; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += X[i][j];
    means[j] = sum / n;
  }
  for (let j = 0; j < d; j++) {
    let sq = 0;
    for (let i = 0; i < n; i++) sq += (X[i][j] - means[j]) ** 2;
    stds[j] = Math.sqrt(sq / n) || 1; // avoid div-by-zero
  }

  const Xs: number[][] = X.map(row =>
    row.map((v, j) => (v - means[j]) / stds[j])
  );

  return { X: Xs, means, stds };
}

function applyStandardize(X: number[][], means: number[], stds: number[]): number[][] {
  return X.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
}

function trainLogisticRegression(
  X: number[][],
  y: number[],
  config: BacktestV2Config,
): LRModel {
  const { X: Xs, means, stds } = standardize(X);
  const n = Xs.length;
  const d = Xs[0].length;

  const weights = new Array(d).fill(0);
  let bias = 0;

  let finalLoss = 0;
  const { l2Lambda, learningRate, maxIterations } = config;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Forward pass
    const gradW = new Array(d).fill(0);
    let gradB = 0;
    let loss = 0;

    for (let i = 0; i < n; i++) {
      let z = bias;
      for (let j = 0; j < d; j++) z += Xs[i][j] * weights[j];
      const p = sigmoid(z);
      const err = p - y[i];

      gradB += err;
      for (let j = 0; j < d; j++) gradW[j] += err * Xs[i][j];

      // Log loss
      const eps = 1e-9;
      loss += -(y[i] * Math.log(p + eps) + (1 - y[i]) * Math.log(1 - p + eps));
    }

    // Average gradients
    gradB /= n;
    for (let j = 0; j < d; j++) gradW[j] = gradW[j] / n + l2Lambda * weights[j];

    // Update
    bias -= learningRate * gradB;
    for (let j = 0; j < d; j++) weights[j] -= learningRate * gradW[j];

    loss = loss / n + (l2Lambda / 2) * weights.reduce((s, w) => s + w * w, 0);
    finalLoss = loss;

    // Early stop if gradient tiny
    const gradMag = Math.sqrt(gradW.reduce((s, g) => s + g * g, 0) + gradB * gradB);
    if (gradMag < 1e-6) break;
  }

  return { weights, bias, featureMeans: means, featureStds: stds, iterations: maxIterations, finalLoss };
}

function predictProba(model: LRModel, X: number[][]): number[] {
  const Xs = applyStandardize(X, model.featureMeans, model.featureStds);
  return Xs.map(row => {
    let z = model.bias;
    for (let j = 0; j < row.length; j++) z += row[j] * model.weights[j];
    return sigmoid(z);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Metrics
// ═══════════════════════════════════════════════════════════════════════════

function computeROCAUC(scores: number[], labels: number[]): number {
  // Mann-Whitney U statistic
  const pairs = scores.map((s, i) => ({ score: s, label: labels[i] }));
  const positives = pairs.filter(p => p.label === 1);
  const negatives = pairs.filter(p => p.label === 0);
  if (positives.length === 0 || negatives.length === 0) return 0.5;

  let wins = 0;
  let ties = 0;
  for (const pos of positives) {
    for (const neg of negatives) {
      if (pos.score > neg.score) wins++;
      else if (pos.score === neg.score) ties++;
    }
  }
  return (wins + 0.5 * ties) / (positives.length * negatives.length);
}

function precisionAtTopK(scores: number[], labels: number[], fraction: number): number {
  const indexed = scores.map((s, i) => ({ score: s, label: labels[i], i }))
    .sort((a, b) => b.score - a.score);
  const k = Math.max(1, Math.round(scores.length * fraction));
  const topK = indexed.slice(0, k);
  const positives = topK.filter(x => x.label === 1).length;
  return positives / k;
}

function computeBrierScore(scores: number[], labels: number[]): number {
  if (scores.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < scores.length; i++) {
    sum += (scores[i] - labels[i]) ** 2;
  }
  return sum / scores.length;
}

function computeConfusionMatrix(scores: number[], labels: number[], threshold = 0.5): {
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
} {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < scores.length; i++) {
    const pred = scores[i] >= threshold ? 1 : 0;
    if (pred === 1 && labels[i] === 1) tp++;
    else if (pred === 0 && labels[i] === 0) tn++;
    else if (pred === 1 && labels[i] === 0) fp++;
    else fn++;
  }
  return { truePositives: tp, trueNegatives: tn, falsePositives: fp, falseNegatives: fn };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Backtest Entry Point
// ═══════════════════════════════════════════════════════════════════════════

// Deterministic PRNG (mulberry32) for reproducible negative sampling
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function runBacktestV2(
  supabase: SupabaseClient,
  userConfig: Partial<BacktestV2Config> = {},
): Promise<BacktestV2Result> {
  const config: BacktestV2Config = { ...DEFAULT_CONFIG, ...userConfig };
  const rng = mulberry32(config.seed);

  // ── 1. Fetch data ──────────────────────────────────────────────────────
  const now = new Date();
  const trainCutoff = new Date(now);
  trainCutoff.setMonth(trainCutoff.getMonth() - config.testMonths);

  const windowStart = new Date(now);
  windowStart.setMonth(windowStart.getMonth() - config.trainMonths - config.testMonths);

  const { data: dealsRaw, error: dealsErr } = await supabase
    .from('deals')
    .select('id, licensee_id, licensee_name, licensor_id, modality, indication_category, indication_specific, announced_date, deal_type, upfront_usd, total_deal_value_usd, therapeutic_area')
    .gte('announced_date', windowStart.toISOString())
    .lte('announced_date', now.toISOString())
    .not('licensee_id', 'is', null)
    .not('modality', 'is', null)
    .order('announced_date', { ascending: true });

  if (dealsErr) throw new Error(`Failed to fetch deals: ${dealsErr.message}`);
  const allDeals = (dealsRaw || []) as DealForIntent[];

  const { data: companiesRaw, error: compErr } = await supabase
    .from('companies')
    .select('id, name, company_type, modalities_active, modalities_primary, indications_active, indications_specific, deals_last_12mo, deals_last_24mo, last_deal_date, last_deal_modality, last_deal_indication, active_trials_count, acquisition_appetite, actively_acquiring, strategic_priorities, data_quality_score, patent_cliffs, revenue_at_risk_2025, revenue_at_risk_2026, revenue_at_risk_2027, hiring_bd_roles, territory_focus')
    .gte('data_quality_score', config.minDataQuality);

  if (compErr) throw new Error(`Failed to fetch companies: ${compErr.message}`);
  const companies = (companiesRaw || []) as CompanyForIntent[];
  const companyById = new Map(companies.map(c => [c.id, c]));

  const { data: trialsRaw } = await supabase
    .from('company_trials')
    .select('company_id, modality, indication_category, indication_specific, phase, status, enrollment_count, is_collaboration, primary_completion_date');
  const allTrials = (trialsRaw || []) as TrialForIntent[];
  const trialsByCompany = new Map<string, TrialForIntent[]>();
  for (const t of allTrials) {
    const arr = trialsByCompany.get(t.company_id) || [];
    arr.push(t);
    trialsByCompany.set(t.company_id, arr);
  }

  const { data: pressRaw } = await supabase
    .from('press_releases')
    .select('headline, body_text, published_at, is_deal_announcement, companies_mentioned')
    .gte('published_at', windowStart.toISOString())
    .lte('published_at', now.toISOString())
    .limit(20000);
  const allPress = (pressRaw || []) as PressReleaseForIntent[];
  const pressByCompany = new Map<string, PressReleaseForIntent[]>();
  for (const p of allPress) {
    for (const cid of p.companies_mentioned || []) {
      const arr = pressByCompany.get(cid) || [];
      arr.push(p);
      pressByCompany.set(cid, arr);
    }
  }

  const { data: researchRaw } = await supabase
    .from('research_signals')
    .select('company_id, signal_type, therapeutic_area, funding_amount_usd, published_date, organization_name')
    .gte('published_date', windowStart.toISOString())
    .lte('published_date', now.toISOString());
  const allResearch = (researchRaw || []) as Array<ResearchSignalForIntent & { company_id: string }>;
  const researchByCompany = new Map<string, ResearchSignalForIntent[]>();
  for (const r of allResearch) {
    const arr = researchByCompany.get(r.company_id) || [];
    arr.push(r);
    researchByCompany.set(r.company_id, arr);
  }

  // Deals indexed by company
  const dealsByCompany = new Map<string, DealForIntent[]>();
  for (const d of allDeals) {
    const arr = dealsByCompany.get(d.licensee_id) || [];
    arr.push(d);
    dealsByCompany.set(d.licensee_id, arr);
  }

  // ── 2. Build labeled samples ──────────────────────────────────────────
  // POSITIVES: for each deal, create a sample where snapshot_date = dealDate - 12mo
  //            label = 1, target = (modality, indication) from deal
  // NEGATIVES: for each positive, sample K random companies that did NOT deal
  //            in (target, 12mo window) and create samples with label = 0
  const samples: LabeledSample[] = [];

  // Pre-build a Set of (companyId, modality, indication, 12mo-window-start-month) → did deal?
  // Used for fast negative eligibility checks
  const dealEventKeys = new Set<string>();
  for (const d of allDeals) {
    if (!d.modality || !d.licensee_id) continue;
    // Key the deal to its licensee, modality, indication, and month
    const monthKey = d.announced_date.slice(0, 7); // YYYY-MM
    dealEventKeys.add(`${d.licensee_id}|${d.modality}|${d.indication_category || 'null'}|${monthKey}`);
  }

  // Helper: does company have a deal in (modality, indication) within [snapshotDate, snapshotDate + 12mo]?
  function companyDealtInWindow(
    companyId: string,
    targetMod: string,
    targetInd: string | null,
    snapshotDate: Date,
  ): boolean {
    const windowEnd = new Date(snapshotDate);
    windowEnd.setMonth(windowEnd.getMonth() + 12);
    const compDeals = dealsByCompany.get(companyId) || [];
    for (const d of compDeals) {
      const dDate = new Date(d.announced_date);
      if (dDate < snapshotDate || dDate > windowEnd) continue;
      if (d.modality === targetMod || (targetInd && d.indication_category === targetInd)) {
        return true;
      }
    }
    return false;
  }

  for (const deal of allDeals) {
    const companyId = deal.licensee_id;
    const company = companyById.get(companyId);
    if (!company) continue;
    if (!deal.modality) continue;

    const dealDate = new Date(deal.announced_date);
    const snapshotDate = new Date(dealDate);
    snapshotDate.setMonth(snapshotDate.getMonth() - 12);

    // Only include snapshots within our window
    if (snapshotDate < windowStart || snapshotDate > now) continue;

    // Filter historical data for this snapshot (temporal leakage guard)
    const histDeals = (dealsByCompany.get(companyId) || []).filter(
      d => new Date(d.announced_date) < snapshotDate,
    );
    const histAllDeals = allDeals.filter(
      d => new Date(d.announced_date) < snapshotDate,
    );
    const histTrials = (trialsByCompany.get(companyId) || []).filter(t => {
      // Trials are typically registered before they start — use primary_completion_date if available
      // Otherwise include all (we can't do better without trial start date)
      return true;
    });
    const histPress = (pressByCompany.get(companyId) || []).filter(
      p => new Date(p.published_at) < snapshotDate,
    );
    const histResearch = (researchByCompany.get(companyId) || []).filter(
      r => !r.published_date || new Date(r.published_date) < snapshotDate,
    );

    const targetModality = deal.modality;
    const targetIndication = deal.indication_category || 'unknown';
    const targetTA = deal.therapeutic_area || 'unknown';
    const targetPhase = 'phase2'; // default; production engine accepts phase hints

    // POSITIVE SAMPLE
    try {
      const features = extractFeatures(
        company,
        targetModality,
        targetIndication,
        targetPhase,
        targetTA,
        histDeals,
        histTrials,
        histAllDeals,
        histPress,
        histResearch,
        snapshotDate,
      );
      samples.push({
        companyId,
        companyName: company.name,
        targetModality,
        targetIndication,
        snapshotDate,
        dealDate,
        label: 1,
        features,
      });
    } catch {
      continue;
    }

    // NEGATIVE SAMPLES: pick K random companies that didn't deal in this target window
    const candidateNegatives = companies.filter(c =>
      c.id !== companyId &&
      !companyDealtInWindow(c.id, targetModality, targetIndication, snapshotDate)
    );
    if (candidateNegatives.length === 0) continue;

    for (let k = 0; k < config.negativesPerPositive; k++) {
      const idx = Math.floor(rng() * candidateNegatives.length);
      const negCompany = candidateNegatives[idx];
      const negDeals = (dealsByCompany.get(negCompany.id) || []).filter(
        d => new Date(d.announced_date) < snapshotDate,
      );
      const negTrials = trialsByCompany.get(negCompany.id) || [];
      const negPress = (pressByCompany.get(negCompany.id) || []).filter(
        p => new Date(p.published_at) < snapshotDate,
      );
      const negResearch = (researchByCompany.get(negCompany.id) || []).filter(
        r => !r.published_date || new Date(r.published_date) < snapshotDate,
      );

      try {
        const negFeatures = extractFeatures(
          negCompany,
          targetModality,
          targetIndication,
          targetPhase,
          targetTA,
          negDeals,
          negTrials,
          histAllDeals,
          negPress,
          negResearch,
          snapshotDate,
        );
        samples.push({
          companyId: negCompany.id,
          companyName: negCompany.name,
          targetModality,
          targetIndication,
          snapshotDate,
          dealDate: null,
          label: 0,
          features: negFeatures,
        });
      } catch {
        continue;
      }
    }
  }

  if (samples.length < 50) {
    throw new Error(`Insufficient samples: ${samples.length} (need >= 50)`);
  }

  // ── 3. Temporal train/test split ──────────────────────────────────────
  const trainSamples: LabeledSample[] = [];
  const testSamples: LabeledSample[] = [];
  for (const s of samples) {
    // Positives: split by deal date. Negatives: split by snapshot date.
    // This ensures test set has deals from [trainCutoff, now].
    const splitDate = s.dealDate || s.snapshotDate;
    if (splitDate < trainCutoff) {
      trainSamples.push(s);
    } else {
      testSamples.push(s);
    }
  }

  const trainX = trainSamples.map(s => s.features);
  const trainY = trainSamples.map(s => s.label);
  const testX = testSamples.map(s => s.features);
  const testY = testSamples.map(s => s.label);

  if (trainSamples.length < 20 || testSamples.length < 10) {
    throw new Error(
      `Insufficient samples after split: train=${trainSamples.length}, test=${testSamples.length}`,
    );
  }

  // ── 4. Train LR model ─────────────────────────────────────────────────
  const model = trainLogisticRegression(trainX, trainY, config);

  // ── 5. Evaluate on held-out test set ──────────────────────────────────
  const testProbas = predictProba(model, testX);
  const rocAuc = computeROCAUC(testProbas, testY);
  const precAt10 = precisionAtTopK(testProbas, testY, 0.1);
  const precAt25 = precisionAtTopK(testProbas, testY, 0.25);
  const precAt50 = precisionAtTopK(testProbas, testY, 0.5);
  const baseRate = testY.filter(y => y === 1).length / testY.length;
  const liftAt10 = baseRate > 0 ? precAt10 / baseRate : 0;
  const brier = computeBrierScore(testProbas, testY);
  const cm = computeConfusionMatrix(testProbas, testY, 0.5);
  const accuracy = (cm.truePositives + cm.trueNegatives) / testY.length;
  const precision = cm.truePositives / Math.max(1, cm.truePositives + cm.falsePositives);
  const recall = cm.truePositives / Math.max(1, cm.truePositives + cm.falseNegatives);
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // ── 6. Feature importance ─────────────────────────────────────────────
  const absWeights = model.weights.map(Math.abs);
  const maxAbs = Math.max(...absWeights, 1);
  const featureImportance = ALL_FEATURE_NAMES.map((name, i) => {
    const category: 'production_factor' | 'time_decay' | 'interaction' =
      i < PRODUCTION_FACTOR_NAMES.length ? 'production_factor'
      : i < PRODUCTION_FACTOR_NAMES.length + TIME_DECAY_FEATURE_NAMES.length ? 'time_decay'
      : 'interaction';
    return {
      feature: name,
      coefficient: Number(model.weights[i].toFixed(4)),
      standardizedImportance: Number((absWeights[i] / maxAbs).toFixed(4)),
      category,
    };
  }).sort((a, b) => b.standardizedImportance - a.standardizedImportance);

  // ── 7. Calibrated production weights ──────────────────────────────────
  // Only use the 10 production factor coefficients, normalized to sum=1
  const prodCoefs = model.weights.slice(0, PRODUCTION_FACTOR_NAMES.length).map(Math.abs);
  const prodSum = prodCoefs.reduce((s, c) => s + c, 0) || 1;
  const calibratedWeights: Record<string, number> = {};
  const prodKeyMap: Record<string, string> = {
    'Patent Cliff': 'patentCliff',
    'Deal Velocity': 'dealVelocity',
    'Pipeline Gap': 'pipelineGap',
    'Alignment': 'alignment',
    'Competitive Pressure': 'competitive',
    'Strategic Signals': 'strategic',
    'Research Investment': 'research',
    'Deal Persistence': 'persistence',
    'Self-Saturation': 'saturation',
    'Portfolio Balance': 'portfolioBalance',
  };
  for (let i = 0; i < PRODUCTION_FACTOR_NAMES.length; i++) {
    const key = prodKeyMap[PRODUCTION_FACTOR_NAMES[i]];
    calibratedWeights[key] = Number((prodCoefs[i] / prodSum).toFixed(4));
  }

  // Compare to current hardcoded production weights
  const currentProductionWeights: Record<string, number> = {
    patentCliff: 0.16,
    dealVelocity: 0.14,
    pipelineGap: 0.14,
    alignment: 0.12,
    competitive: 0.10,
    strategic: 0.08,
    research: 0.06,
    persistence: 0.06,
    saturation: 0.07,
    portfolioBalance: 0.07,
  };
  const weightShift = Object.keys(currentProductionWeights).map(k => ({
    factor: k,
    currentWeight: currentProductionWeights[k],
    calibratedWeight: calibratedWeights[k] || 0,
    delta: Number(((calibratedWeights[k] || 0) - currentProductionWeights[k]).toFixed(4)),
  }));

  return {
    calibratedAt: new Date().toISOString(),
    config,
    dataStats: {
      totalDealsInWindow: allDeals.length,
      totalCompanies: companies.length,
      totalTrials: allTrials.length,
      totalPressReleases: allPress.length,
      totalResearchSignals: allResearch.length,
      trainCutoffDate: trainCutoff.toISOString(),
      testStartDate: trainCutoff.toISOString(),
    },
    sampleStats: {
      trainPositives: trainSamples.filter(s => s.label === 1).length,
      trainNegatives: trainSamples.filter(s => s.label === 0).length,
      testPositives: testSamples.filter(s => s.label === 1).length,
      testNegatives: testSamples.filter(s => s.label === 0).length,
      featureCount: FEATURE_COUNT,
    },
    metrics: {
      accuracy: Number(accuracy.toFixed(4)),
      rocAuc: Number(rocAuc.toFixed(4)),
      precisionAtTopDecile: Number(precAt10.toFixed(4)),
      precisionAtTopQuartile: Number(precAt25.toFixed(4)),
      precisionAtTopHalf: Number(precAt50.toFixed(4)),
      liftAtTopDecile: Number(liftAt10.toFixed(4)),
      brierScore: Number(brier.toFixed(4)),
      confusionMatrix: cm,
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
    },
    featureImportance,
    calibratedProductionWeights: calibratedWeights,
    weightShift,
  };
}
