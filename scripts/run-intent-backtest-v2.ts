/**
 * Pharma Intent Score — Backtest V2 (standalone runner)
 *
 * Addresses the issues found in the April 2026 audit of the v1 calibration:
 *   1. Temporal holdout (no in-sample accuracy)
 *   2. Target-specific labels (not "did any deal")
 *   3. Uses the actual 10 production factors (not 9 parallel ones)
 *   4. Logistic regression (not median split) → real probabilities + AUC
 *   5. Time-decayed features
 *   6. Interaction features
 *   7. ROC-AUC, precision@top-decile, Brier, confusion matrix
 *
 * Runs standalone against production Supabase. Does NOT store results.
 *
 * Usage:
 *   npx tsx scripts/run-intent-backtest-v2.ts
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  calculatePharmaIntent,
  type CompanyForIntent,
  type DealForIntent,
  type TrialForIntent,
  type PressReleaseForIntent,
  type ResearchSignalForIntent,
  type IntentFactor,
} from '../lib/services/pharma-intent';

// ─── Config ──────────────────────────────────────────────────────────────

const CONFIG = {
  trainMonths: 36,          // look back 36 months for training deals
  testMonths: 12,           // hold out last 12 months for testing
  negativesPerPositive: 4,  // class ratio
  l2Lambda: 0.1,
  learningRate: 0.05,
  maxIterations: 2000,
  seed: 42,
  minDataQuality: 30,
  maxSamples: 6000,         // cap compute (10k would be better but slow)
  fetchPageSize: 1000,      // Supabase default pagination limit
};

// ─── Feature Names ───────────────────────────────────────────────────────

const PRODUCTION_FACTOR_NAMES = [
  'Patent Cliff',
  'Deal Velocity',
  'Pipeline Gap',
  'Alignment',
  'Competitive Pressure',
  'Strategic Signals',
  'Research Investment',
  'Deal Persistence',
  'Self-Saturation',
  'Portfolio Balance',
] as const;

const TIME_DECAY_NAMES = [
  'recency_weighted_deals_24mo',
  'days_since_last_deal_inv',
  'active_trial_count_log',
  'revenue_at_risk_log',
  'strategic_priority_match',
  'company_type_size_rank',
] as const;

const INTERACTION_NAMES = [
  'patent_cliff_x_deal_velocity',
  'pipeline_gap_x_alignment',
  'patent_cliff_x_pipeline_gap',
  'competitive_x_strategic',
  'deal_velocity_x_alignment',
  'saturation_x_persistence_inv',
] as const;

const ALL_FEATURE_NAMES = [
  ...PRODUCTION_FACTOR_NAMES.map(n => `prod_${n.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`),
  ...TIME_DECAY_NAMES,
  ...INTERACTION_NAMES,
];
const FEATURE_COUNT = ALL_FEATURE_NAMES.length;

// ─── Types ───────────────────────────────────────────────────────────────

interface LabeledSample {
  companyId: string;
  companyName: string;
  targetModality: string;
  targetIndication: string;
  snapshotDate: Date;
  dealDate: Date | null;
  label: 0 | 1;
  features: number[];
}

// ─── Feature Extraction ──────────────────────────────────────────────────

function extractFeatures(
  company: CompanyForIntent,
  targetModality: string,
  targetIndication: string,
  targetPhase: string,
  targetTA: string,
  histDeals: DealForIntent[],
  histTrials: TrialForIntent[],
  histAllDeals: DealForIntent[],
  histPress: PressReleaseForIntent[],
  histResearch: ResearchSignalForIntent[],
  snapshotDate: Date,
): number[] {
  // 1. Call production scoring function → get 10 factor scores
  const intent = calculatePharmaIntent(
    company,
    targetModality,
    targetIndication,
    histDeals,
    histTrials,
    histAllDeals,
    histPress,
    histResearch,
    targetPhase,
    targetTA,
  );

  const factorMap = new Map<string, IntentFactor>();
  for (const f of intent.factors) factorMap.set(f.name, f);

  const prodScores: number[] = PRODUCTION_FACTOR_NAMES.map(name => {
    const f = factorMap.get(name);
    return f ? f.score / 100 : 0;
  });

  // 2. Time-decayed features
  const snapMs = snapshotDate.getTime();
  let weightedDeals = 0;
  let lastDealMs = 0;
  for (const d of histDeals) {
    const dateMs = new Date(d.announced_date).getTime();
    if (dateMs > snapMs) continue;
    const ageMonths = (snapMs - dateMs) / (1000 * 60 * 60 * 24 * 30.44);
    if (ageMonths > 24) continue;
    const weight = Math.pow(0.5, ageMonths / 12);
    weightedDeals += weight;
    if (dateMs > lastDealMs) lastDealMs = dateMs;
  }
  const daysSinceLastDeal = lastDealMs > 0
    ? (snapMs - lastDealMs) / (1000 * 60 * 60 * 24)
    : 730;
  const daysSinceLastDealInv = 1 / (1 + daysSinceLastDeal / 90);

  const activeTrialCount = histTrials.filter(
    t => t.status === 'recruiting' || t.status === 'active_not_recruiting',
  ).length;
  const activeTrialCountLog = Math.log1p(activeTrialCount);

  const revAtRisk =
    (company.revenue_at_risk_2025 || 0) +
    (company.revenue_at_risk_2026 || 0) +
    (company.revenue_at_risk_2027 || 0);
  const revAtRiskLog = revAtRisk > 0 ? Math.log10(revAtRisk + 1) / 11 : 0;

  const priorities = (company.strategic_priorities || []).map(p => (p || '').toLowerCase());
  const stratMatch = priorities.some(p =>
    p.includes(targetModality.toLowerCase()) ||
    p.includes(targetIndication.toLowerCase()),
  ) ? 1 : 0;

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

  const timeDecay = [
    Math.min(1, weightedDeals / 5),
    daysSinceLastDealInv,
    Math.min(1, activeTrialCountLog / Math.log(50)),
    revAtRiskLog,
    stratMatch,
    companyTypeSize,
  ];

  // 3. Interaction features
  const [pc, dv, pg, al, cp, ss] = prodScores;
  const persistence = prodScores[7];
  const saturation = prodScores[8];

  const interactions = [
    pc * dv,
    pg * al,
    pc * pg,
    cp * ss,
    dv * al,
    (1 - saturation) * persistence,
  ];

  return [...prodScores, ...timeDecay, ...interactions];
}

// ─── Logistic Regression ─────────────────────────────────────────────────

interface LRModel {
  weights: number[];
  bias: number;
  featureMeans: number[];
  featureStds: number[];
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
    stds[j] = Math.sqrt(sq / n) || 1;
  }

  const Xs = X.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
  return { X: Xs, means, stds };
}

function applyStandardize(X: number[][], means: number[], stds: number[]): number[][] {
  return X.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
}

function trainLR(X: number[][], y: number[]): LRModel {
  const { X: Xs, means, stds } = standardize(X);
  const n = Xs.length;
  const d = Xs[0].length;
  const weights = new Array(d).fill(0);
  let bias = 0;
  let finalLoss = 0;

  for (let iter = 0; iter < CONFIG.maxIterations; iter++) {
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
      const eps = 1e-9;
      loss += -(y[i] * Math.log(p + eps) + (1 - y[i]) * Math.log(1 - p + eps));
    }

    gradB /= n;
    for (let j = 0; j < d; j++) gradW[j] = gradW[j] / n + CONFIG.l2Lambda * weights[j];

    bias -= CONFIG.learningRate * gradB;
    for (let j = 0; j < d; j++) weights[j] -= CONFIG.learningRate * gradW[j];

    loss = loss / n + (CONFIG.l2Lambda / 2) * weights.reduce((s, w) => s + w * w, 0);
    finalLoss = loss;

    const gradMag = Math.sqrt(gradW.reduce((s, g) => s + g * g, 0) + gradB * gradB);
    if (gradMag < 1e-6) break;
  }

  return { weights, bias, featureMeans: means, featureStds: stds, finalLoss };
}

function predictProba(model: LRModel, X: number[][]): number[] {
  const Xs = applyStandardize(X, model.featureMeans, model.featureStds);
  return Xs.map(row => {
    let z = model.bias;
    for (let j = 0; j < row.length; j++) z += row[j] * model.weights[j];
    return sigmoid(z);
  });
}

// ─── Metrics ─────────────────────────────────────────────────────────────

function computeROCAUC(scores: number[], labels: number[]): number {
  const positives = scores.filter((_, i) => labels[i] === 1);
  const negatives = scores.filter((_, i) => labels[i] === 0);
  if (positives.length === 0 || negatives.length === 0) return 0.5;

  let wins = 0;
  let ties = 0;
  for (const pos of positives) {
    for (const neg of negatives) {
      if (pos > neg) wins++;
      else if (pos === neg) ties++;
    }
  }
  return (wins + 0.5 * ties) / (positives.length * negatives.length);
}

function precisionAtTopK(scores: number[], labels: number[], fraction: number): number {
  const indexed = scores.map((s, i) => ({ s, l: labels[i] })).sort((a, b) => b.s - a.s);
  const k = Math.max(1, Math.round(scores.length * fraction));
  return indexed.slice(0, k).filter(x => x.l === 1).length / k;
}

function brierScore(scores: number[], labels: number[]): number {
  let sum = 0;
  for (let i = 0; i < scores.length; i++) sum += (scores[i] - labels[i]) ** 2;
  return sum / scores.length;
}

// ─── Deterministic PRNG ──────────────────────────────────────────────────

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

// ─── Main Backtest ───────────────────────────────────────────────────────

async function runBacktest(supabase: SupabaseClient) {
  console.log('─'.repeat(72));
  console.log('Pharma Intent Backtest V2');
  console.log('─'.repeat(72));
  console.log('Config:', JSON.stringify(CONFIG, null, 2));
  console.log();

  const rng = mulberry32(CONFIG.seed);
  const now = new Date();
  const trainCutoff = new Date(now);
  trainCutoff.setMonth(trainCutoff.getMonth() - CONFIG.testMonths);

  const windowStart = new Date(now);
  windowStart.setMonth(windowStart.getMonth() - CONFIG.trainMonths - CONFIG.testMonths);

  console.log(`Window: ${windowStart.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}`);
  console.log(`Train/test split at: ${trainCutoff.toISOString().slice(0, 10)}`);
  console.log();

  // ─── Fetch data ───
  // Paginated fetches to get around Supabase's 1000-row default limit
  async function fetchAllPaged<T>(
    table: string,
    select: string,
    filter?: (q: any) => any,
  ): Promise<T[]> {
    const out: T[] = [];
    let offset = 0;
    while (true) {
      let q: any = supabase.from(table).select(select).range(offset, offset + CONFIG.fetchPageSize - 1);
      if (filter) q = filter(q);
      const { data, error } = await q;
      if (error) throw new Error(`${table}: ${error.message}`);
      if (!data || data.length === 0) break;
      out.push(...(data as T[]));
      if (data.length < CONFIG.fetchPageSize) break;
      offset += CONFIG.fetchPageSize;
    }
    return out;
  }

  console.log('Fetching deals...');
  const allDeals = await fetchAllPaged<DealForIntent>(
    'deals',
    'id, licensee_id, licensee_name, licensor_id, modality, indication_category, indication_specific, announced_date, deal_type, upfront_usd, total_deal_value_usd, therapeutic_area',
    q => q
      .gte('announced_date', windowStart.toISOString())
      .lte('announced_date', now.toISOString())
      .not('licensee_id', 'is', null)
      .not('modality', 'is', null)
      .order('announced_date', { ascending: false }), // NEWEST first so samples cap keeps recent ones
  );
  console.log(`  ${allDeals.length} deals in window`);

  console.log('Fetching companies...');
  const { data: companiesRaw, error: compErr } = await supabase
    .from('companies')
    .select('id, name, company_type, modalities_active, modalities_primary, indications_active, indications_specific, deals_last_12mo, deals_last_24mo, last_deal_date, last_deal_modality, last_deal_indication, active_trials_count, acquisition_appetite, actively_acquiring, strategic_priorities, data_quality_score, patent_cliffs, revenue_at_risk_2025, revenue_at_risk_2026, revenue_at_risk_2027, hiring_bd_roles, territory_focus')
    .gte('data_quality_score', CONFIG.minDataQuality);
  if (compErr) throw new Error(`companies: ${compErr.message}`);
  const companies = (companiesRaw || []) as CompanyForIntent[];
  const companyById = new Map(companies.map(c => [c.id, c]));
  console.log(`  ${companies.length} companies (data_quality_score >= ${CONFIG.minDataQuality})`);

  console.log('Fetching trials...');
  const allTrials = await fetchAllPaged<TrialForIntent>(
    'company_trials',
    'company_id, modality, indication_category, indication_specific, phase, status, enrollment_count, is_collaboration, primary_completion_date',
  );
  const trialsByCompany = new Map<string, TrialForIntent[]>();
  for (const t of allTrials) {
    const arr = trialsByCompany.get(t.company_id) || [];
    arr.push(t);
    trialsByCompany.set(t.company_id, arr);
  }
  console.log(`  ${allTrials.length} trials`);

  console.log('Fetching press releases...');
  const allPress = await fetchAllPaged<PressReleaseForIntent>(
    'press_releases',
    'headline, body_text, published_at, is_deal_announcement, companies_mentioned',
    q => q
      .gte('published_at', windowStart.toISOString())
      .lte('published_at', now.toISOString()),
  ).catch(err => {
    console.log(`  (press_releases unavailable: ${err.message})`);
    return [] as PressReleaseForIntent[];
  });
  const pressByCompany = new Map<string, PressReleaseForIntent[]>();
  for (const p of allPress) {
    for (const cid of p.companies_mentioned || []) {
      const arr = pressByCompany.get(cid) || [];
      arr.push(p);
      pressByCompany.set(cid, arr);
    }
  }
  console.log(`  ${allPress.length} press releases`);

  console.log('Fetching research signals...');
  const allResearch = await fetchAllPaged<ResearchSignalForIntent & { company_id: string }>(
    'research_signals',
    'company_id, signal_type, therapeutic_area, funding_amount_usd, published_date, organization_name',
    q => q
      .gte('published_date', windowStart.toISOString())
      .lte('published_date', now.toISOString()),
  ).catch(err => {
    console.log(`  (research_signals unavailable: ${err.message})`);
    return [] as Array<ResearchSignalForIntent & { company_id: string }>;
  });
  const researchByCompany = new Map<string, ResearchSignalForIntent[]>();
  for (const r of allResearch) {
    const arr = researchByCompany.get(r.company_id) || [];
    arr.push(r);
    researchByCompany.set(r.company_id, arr);
  }
  console.log(`  ${allResearch.length} research signals`);
  console.log();

  // Deals indexed by company
  const dealsByCompany = new Map<string, DealForIntent[]>();
  for (const d of allDeals) {
    const arr = dealsByCompany.get(d.licensee_id) || [];
    arr.push(d);
    dealsByCompany.set(d.licensee_id, arr);
  }

  // ─── Build samples ───
  console.log('Building labeled samples...');

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

  const samples: LabeledSample[] = [];

  for (const deal of allDeals) {
    if (samples.length >= CONFIG.maxSamples) break;
    const companyId = deal.licensee_id;
    const company = companyById.get(companyId);
    if (!company || !deal.modality) continue;

    const dealDate = new Date(deal.announced_date);
    const snapshotDate = new Date(dealDate);
    snapshotDate.setMonth(snapshotDate.getMonth() - 12);
    if (snapshotDate < windowStart || snapshotDate > now) continue;

    const histDeals = (dealsByCompany.get(companyId) || []).filter(
      d => new Date(d.announced_date) < snapshotDate,
    );
    const histAllDeals = allDeals.filter(d => new Date(d.announced_date) < snapshotDate);
    const histTrials = trialsByCompany.get(companyId) || [];
    const histPress = (pressByCompany.get(companyId) || []).filter(
      p => new Date(p.published_at) < snapshotDate,
    );
    const histResearch = (researchByCompany.get(companyId) || []).filter(
      r => !r.published_date || new Date(r.published_date) < snapshotDate,
    );

    const targetModality = deal.modality;
    const targetIndication = deal.indication_category || 'unknown';
    const targetTA = deal.therapeutic_area || 'unknown';
    const targetPhase = 'phase2';

    try {
      const features = extractFeatures(
        company, targetModality, targetIndication, targetPhase, targetTA,
        histDeals, histTrials, histAllDeals, histPress, histResearch, snapshotDate,
      );
      samples.push({
        companyId, companyName: company.name,
        targetModality, targetIndication,
        snapshotDate, dealDate, label: 1, features,
      });
    } catch {
      continue;
    }

    // Negatives
    const candidates = companies.filter(
      c => c.id !== companyId &&
      !companyDealtInWindow(c.id, targetModality, targetIndication, snapshotDate),
    );
    if (candidates.length === 0) continue;

    for (let k = 0; k < CONFIG.negativesPerPositive; k++) {
      if (samples.length >= CONFIG.maxSamples) break;
      const idx = Math.floor(rng() * candidates.length);
      const negCompany = candidates[idx];
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
          negCompany, targetModality, targetIndication, targetPhase, targetTA,
          negDeals, negTrials, histAllDeals, negPress, negResearch, snapshotDate,
        );
        samples.push({
          companyId: negCompany.id, companyName: negCompany.name,
          targetModality, targetIndication,
          snapshotDate, dealDate: null, label: 0, features: negFeatures,
        });
      } catch {
        continue;
      }
    }
  }

  console.log(`  ${samples.length} total samples (positives: ${samples.filter(s => s.label === 1).length})`);
  console.log();

  // ─── Split ───
  const train: LabeledSample[] = [];
  const test: LabeledSample[] = [];
  for (const s of samples) {
    const splitDate = s.dealDate || s.snapshotDate;
    if (splitDate < trainCutoff) train.push(s);
    else test.push(s);
  }

  console.log(`Train: ${train.length} (pos ${train.filter(s => s.label === 1).length} / neg ${train.filter(s => s.label === 0).length})`);
  console.log(`Test:  ${test.length} (pos ${test.filter(s => s.label === 1).length} / neg ${test.filter(s => s.label === 0).length})`);
  console.log();

  if (train.length < 20 || test.length < 10) {
    throw new Error(`Insufficient samples after split: train=${train.length}, test=${test.length}`);
  }

  // ─── Train ───
  console.log('Training logistic regression...');
  const trainX = train.map(s => s.features);
  const trainY = train.map(s => s.label);
  const model = trainLR(trainX, trainY);
  console.log(`  final loss: ${model.finalLoss.toFixed(4)}`);
  console.log();

  // ─── Evaluate ───
  console.log('Evaluating on held-out test set...');
  const testX = test.map(s => s.features);
  const testY = test.map(s => s.label);
  const probs = predictProba(model, testX);

  const auc = computeROCAUC(probs, testY);
  const pAt10 = precisionAtTopK(probs, testY, 0.1);
  const pAt25 = precisionAtTopK(probs, testY, 0.25);
  const pAt50 = precisionAtTopK(probs, testY, 0.5);
  const brier = brierScore(probs, testY);
  const baseRate = testY.filter(y => y === 1).length / testY.length;
  const lift10 = baseRate > 0 ? pAt10 / baseRate : 0;

  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < probs.length; i++) {
    const pred = probs[i] >= 0.5 ? 1 : 0;
    if (pred === 1 && testY[i] === 1) tp++;
    else if (pred === 0 && testY[i] === 0) tn++;
    else if (pred === 1 && testY[i] === 0) fp++;
    else fn++;
  }
  const accuracy = (tp + tn) / testY.length;
  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // ─── Report ───
  console.log();
  console.log('═'.repeat(72));
  console.log('RESULTS (held-out test set)');
  console.log('═'.repeat(72));
  console.log(`  Accuracy:                ${(accuracy * 100).toFixed(2)}%`);
  console.log(`  ROC-AUC:                 ${auc.toFixed(4)}`);
  console.log(`  Precision @ top 10%:     ${(pAt10 * 100).toFixed(1)}% (lift ${lift10.toFixed(2)}× vs base rate ${(baseRate * 100).toFixed(1)}%)`);
  console.log(`  Precision @ top 25%:     ${(pAt25 * 100).toFixed(1)}%`);
  console.log(`  Precision @ top 50%:     ${(pAt50 * 100).toFixed(1)}%`);
  console.log(`  Brier score:             ${brier.toFixed(4)} (lower = better calibrated)`);
  console.log(`  Precision (binary):      ${(precision * 100).toFixed(1)}%`);
  console.log(`  Recall (binary):         ${(recall * 100).toFixed(1)}%`);
  console.log(`  F1 (binary):             ${(f1 * 100).toFixed(1)}%`);
  console.log(`  Confusion:               TP=${tp}  TN=${tn}  FP=${fp}  FN=${fn}`);
  console.log();

  // ─── Feature importance ───
  const absW = model.weights.map(Math.abs);
  const maxAbs = Math.max(...absW, 1);
  const importance = ALL_FEATURE_NAMES.map((name, i) => ({
    name,
    coef: model.weights[i],
    imp: absW[i] / maxAbs,
    category: i < 10 ? 'prod' : i < 16 ? 'time' : 'interact',
  })).sort((a, b) => b.imp - a.imp);

  console.log('FEATURE IMPORTANCE (top 15)');
  console.log('─'.repeat(72));
  for (const f of importance.slice(0, 15)) {
    const sign = f.coef >= 0 ? '+' : '-';
    const bar = '█'.repeat(Math.round(f.imp * 40));
    console.log(`  ${f.category.padEnd(8)} ${f.name.padEnd(34)} ${sign}${Math.abs(f.coef).toFixed(3)} ${bar}`);
  }
  console.log();

  // ─── Calibrated production weights ───
  const prodCoefs = model.weights.slice(0, 10).map(Math.abs);
  const prodSum = prodCoefs.reduce((s, c) => s + c, 0) || 1;

  console.log('CALIBRATED PRODUCTION WEIGHTS (normalized)');
  console.log('─'.repeat(72));
  const keyMap: Record<string, string> = {
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
  const currentW: Record<string, number> = {
    patentCliff: 0.16, dealVelocity: 0.14, pipelineGap: 0.14, alignment: 0.12,
    competitive: 0.10, strategic: 0.08, research: 0.06, persistence: 0.06,
    saturation: 0.07, portfolioBalance: 0.07,
  };

  console.log('  factor                  hardcoded  calibrated  delta');
  console.log('  ' + '─'.repeat(55));
  for (let i = 0; i < PRODUCTION_FACTOR_NAMES.length; i++) {
    const key = keyMap[PRODUCTION_FACTOR_NAMES[i]];
    const calibrated = prodCoefs[i] / prodSum;
    const current = currentW[key];
    const delta = calibrated - current;
    const sign = delta >= 0 ? '+' : '';
    console.log(
      `  ${key.padEnd(22)} ${(current * 100).toFixed(1).padStart(7)}%  ${(calibrated * 100).toFixed(1).padStart(8)}%  ${sign}${(delta * 100).toFixed(1)}pp`,
    );
  }
  console.log();

  console.log('═'.repeat(72));
  console.log('SUMMARY');
  console.log('═'.repeat(72));
  console.log(`  Held-out accuracy:       ${(accuracy * 100).toFixed(1)}%`);
  console.log(`  Held-out ROC-AUC:        ${auc.toFixed(3)}`);
  console.log(`  Precision @ top-decile:  ${(pAt10 * 100).toFixed(1)}% (${lift10.toFixed(1)}× base rate)`);
  console.log(`  Sample count:            train=${train.length}, test=${test.length}`);
  console.log('═'.repeat(72));
}

// ─── Entry point ─────────────────────────────────────────────────────────

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const start = Date.now();
  try {
    await runBacktest(supabase);
    console.log(`\nElapsed: ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.error('Backtest failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
