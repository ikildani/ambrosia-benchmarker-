/**
 * Topic rotation engine v2 — 5-category weighted content strategy.
 *
 * Replaces the old combinatorial TA x DealType x Modality x Phase rotation
 * (which produced 247 near-identical pages, 84% same type, zero clicks).
 *
 * Categories & weights:
 *   1. deal_analysis    (30%) — deep dive on a specific large deal
 *   2. how_much         (25%) — "how much does a Phase X [TA] deal cost?"
 *   3. buyer_intelligence (20%) — company deal-making profile
 *   4. market_trend     (15%) — period-over-period shifts by modality/TA
 *   5. comparison       (10%) — vs. competitor data providers
 *
 * Each category queries the Supabase `deals` table for real data and checks
 * `seo_content_log` to avoid duplicates.
 */

import { type SupabaseClient } from '@supabase/supabase-js';

// ── Label maps ──────────────────────────────────────────────────────────────

export const TA_LABELS: Record<string, string> = {
  oncology: 'Oncology',
  neurology: 'Neurology',
  immunology: 'Immunology',
  metabolic: 'Metabolic',
  cardiovascular: 'Cardiovascular',
  rareDisease: 'Rare Disease',
  hematology: 'Hematology',
  infectiousDisease: 'Infectious Disease',
  ophthalmology: 'Ophthalmology',
  dermatology: 'Dermatology',
  gastroenterology: 'Gastroenterology',
  womensHealth: "Women's Health",
};

export const PHASE_LABELS: Record<string, string> = {
  preclinical: 'Preclinical',
  phase1: 'Phase 1',
  phase2: 'Phase 2',
  phase3: 'Phase 3',
  approved: 'Approved',
};

export const MODALITY_LABELS: Record<string, string> = {
  adc: 'ADC',
  bispecific: 'Bispecific Antibody',
  smallMolecule: 'Small Molecule',
  mab: 'Monoclonal Antibody',
  geneTherapy: 'Gene Therapy',
  cellTherapy: 'Cell Therapy',
  rnai: 'RNAi',
  mrna: 'mRNA',
  protac: 'PROTAC',
  carT_heme: 'CAR-T (Hematologic)',
  peptide: 'Peptide',
  radiopharmaceutical: 'Radiopharmaceutical',
  aso: 'ASO',
  glp1Agonist: 'GLP-1 Agonist',
  antiVegf: 'Anti-VEGF',
};

// ── Types ────────────────────────────────────────────────────────────────────

export type ContentCategory =
  | 'deal_analysis'
  | 'how_much'
  | 'buyer_intelligence'
  | 'market_trend'
  | 'comparison';

export interface TopicParams {
  category: ContentCategory;
  topicKey: string;
  title: string;
  targetKeyword: string;
  /** Data payload for the prompt generator — varies by category */
  data:
    | DealAnalysisData
    | HowMuchData
    | BuyerIntelligenceData
    | MarketTrendData
    | ComparisonData;
}

// Category 1: Deal Analysis (30%)
export interface DealAnalysisData {
  category: 'deal_analysis';
  dealId: string;
  licensorName: string;
  licenseeName: string;
  assetName: string | null;
  modality: string | null;
  therapeuticArea: string;
  phase: string | null;
  dealType: string | null;
  upfrontUsd: number | null;
  totalDealValueUsd: number | null;
  milestonesTotalUsd: number | null;
  royaltyLowPct: number | null;
  royaltyHighPct: number | null;
  announcedDate: string | null;
  target: string | null;
  mechanismOfAction: string | null;
}

// Category 2: How Much Pages (25%)
export interface HowMuchData {
  category: 'how_much';
  phase: string;
  phaseLabel: string;
  modality: string | null;
  modalityLabel: string | null;
  therapeuticArea: string;
  taLabel: string;
  medianUpfront: number;
  p25Upfront: number;
  p75Upfront: number;
  medianTdv: number;
  dealCount: number;
  sampleDeals: Array<{
    licensor: string;
    licensee: string;
    upfront: number;
    tdv: number;
    year: number;
  }>;
}

// Category 3: Buyer Intelligence (20%)
export interface BuyerIntelligenceData {
  category: 'buyer_intelligence';
  companyName: string;
  dealCount: number;
  therapeuticAreas: string[];
  preferredDealTypes: string[];
  avgUpfrontRatio: number | null;
  recentDeals: Array<{
    licensor: string;
    assetName: string | null;
    upfront: number | null;
    tdv: number | null;
    phase: string | null;
    ta: string;
    date: string | null;
  }>;
  periodStart: string;
  periodEnd: string;
}

// Category 4: Market Trend (15%)
export interface MarketTrendData {
  category: 'market_trend';
  trendType:
    | 'modality_surge'
    | 'ta_shift'
    | 'geography_trend'
    | 'deal_size_trend'
    | 'phase_mix';
  headline: string;
  currentPeriodLabel: string;
  previousPeriodLabel: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  topDeals: Array<{
    licensor: string;
    licensee: string;
    upfront: number | null;
    tdv: number | null;
    date: string | null;
  }>;
  dimension: string;
  dimensionLabel: string;
}

// Category 5: Comparison / Alternative (10%)
export interface ComparisonData {
  category: 'comparison';
  competitorName: string;
  comparisonAngle: string;
  uniqueDataPoints: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_WEIGHTS: Array<{ category: ContentCategory; weight: number }> = [
  { category: 'deal_analysis', weight: 0.3 },
  { category: 'how_much', weight: 0.25 },
  { category: 'buyer_intelligence', weight: 0.2 },
  { category: 'market_trend', weight: 0.15 },
  { category: 'comparison', weight: 0.1 },
];

const COMPETITORS = [
  { name: 'DealForma', slug: 'dealforma', angle: 'deal-level granularity and live benchmarks' },
  { name: 'Evaluate Pharma', slug: 'evaluate-pharma', angle: 'consensus forecasts vs. real deal economics' },
  { name: 'GlobalData', slug: 'globaldata', angle: 'breadth of pipeline data vs. deal-term depth' },
  { name: 'Cortellis', slug: 'cortellis', angle: 'clinical trial integration vs. deal analytics' },
  { name: 'PitchBook', slug: 'pitchbook', angle: 'VC/PE deal coverage vs. pharma licensing benchmarks' },
  { name: 'BioPharma Dive', slug: 'biopharma-dive', angle: 'news coverage vs. quantitative deal data' },
];

const ALL_PHASES = Object.keys(PHASE_LABELS);
const ALL_TAS = Object.keys(TA_LABELS);

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Pick a category using weighted random selection.
 * Returns categories in weight-priority order starting from the selected one,
 * so callers can fall through if the first pick is exhausted.
 */
function pickCategoryOrder(): ContentCategory[] {
  const rand = Math.random();
  let cumulative = 0;
  let startIdx = 0;

  for (let i = 0; i < CATEGORY_WEIGHTS.length; i++) {
    cumulative += CATEGORY_WEIGHTS[i].weight;
    if (rand < cumulative) {
      startIdx = i;
      break;
    }
  }

  // Build ordered list: start from selected, then remaining by weight
  const ordered: ContentCategory[] = [];
  for (let i = 0; i < CATEGORY_WEIGHTS.length; i++) {
    const idx = (startIdx + i) % CATEGORY_WEIGHTS.length;
    ordered.push(CATEGORY_WEIGHTS[idx].category);
  }
  return ordered;
}

/**
 * Compute a percentile value from a sorted numeric array.
 * Uses linear interpolation (the "inclusive" / R-7 method).
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const frac = index - lower;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - frac) + sorted[upper] * frac;
}

function sixMonthsAgo(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() - 6);
  return d;
}

function formatDateISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── Category generators ─────────────────────────────────────────────────────

async function generateDealAnalysis(
  supabase: SupabaseClient,
): Promise<TopicParams | null> {
  // Fetch 5 most recent large deals (non-synthetic, TDV > $500M)
  const { data: deals, error } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, modality, therapeutic_area, phase_at_signing, deal_type, upfront_usd, total_deal_value_usd, milestones_total_usd, royalty_low_pct, royalty_high_pct, announced_date, target, mechanism_of_action')
    .eq('is_synthetic', false)
    .gt('total_deal_value_usd', 500_000_000)
    .order('announced_date', { ascending: false })
    .limit(5);

  if (error) {
    console.error('[topic-rotation] deal_analysis query failed:', error.message);
    return null;
  }
  if (!deals || deals.length === 0) return null;

  // Check which of these already have posts
  const candidateKeys = deals.map(
    (d) => `deal_analysis:${d.licensor_name}:${d.licensee_name}:${d.id}`,
  );

  const { data: existingLogs } = await supabase
    .from('seo_content_log')
    .select('topic_key')
    .in('topic_key', candidateKeys);

  const usedKeys = new Set((existingLogs || []).map((r) => r.topic_key));

  for (const deal of deals) {
    const topicKey = `deal_analysis:${deal.licensor_name}:${deal.licensee_name}:${deal.id}`;
    if (usedKeys.has(topicKey)) continue;

    const ta = deal.therapeutic_area || 'oncology';
    const taLabel = TA_LABELS[ta] || ta;
    const licensor = deal.licensor_name;
    const licensee = deal.licensee_name;
    const asset = deal.asset_name;

    const titleAsset = asset ? `${asset}: ` : '';
    const title = `${titleAsset}${licensor}-${licensee} Deal Analysis — What the ${taLabel} Terms Reveal`;
    const targetKeyword =
      `${licensor} ${licensee} ${asset || ''} deal terms ${taLabel}`.trim().toLowerCase();

    const data: DealAnalysisData = {
      category: 'deal_analysis',
      dealId: deal.id,
      licensorName: licensor,
      licenseeName: licensee,
      assetName: deal.asset_name,
      modality: deal.modality,
      therapeuticArea: ta,
      phase: deal.phase_at_signing,
      dealType: deal.deal_type,
      upfrontUsd: deal.upfront_usd,
      totalDealValueUsd: deal.total_deal_value_usd,
      milestonesTotalUsd: deal.milestones_total_usd,
      royaltyLowPct: deal.royalty_low_pct,
      royaltyHighPct: deal.royalty_high_pct,
      announcedDate: deal.announced_date,
      target: deal.target,
      mechanismOfAction: deal.mechanism_of_action,
    };

    return { category: 'deal_analysis', topicKey, title, targetKeyword, data };
  }

  return null;
}

async function generateHowMuch(
  supabase: SupabaseClient,
): Promise<TopicParams | null> {
  // Build all (phase, ta) combos
  const combos: Array<{ phase: string; ta: string }> = [];
  for (const phase of ALL_PHASES) {
    for (const ta of ALL_TAS) {
      combos.push({ phase, ta });
    }
  }

  // Check which combos already have posts
  const comboKeys = combos.map((c) => `how_much:${c.phase}:${c.ta}`);
  const { data: existingLogs } = await supabase
    .from('seo_content_log')
    .select('topic_key')
    .in('topic_key', comboKeys);

  const usedKeys = new Set((existingLogs || []).map((r) => r.topic_key));

  // Shuffle combos so we don't always start with the same phase/TA
  const shuffled = combos
    .filter((c) => !usedKeys.has(`how_much:${c.phase}:${c.ta}`))
    .sort(() => Math.random() - 0.5);

  for (const combo of shuffled) {
    // Fetch up to 200 deals for this phase+TA
    const { data: deals, error } = await supabase
      .from('deals')
      .select('licensor_name, licensee_name, upfront_usd, total_deal_value_usd, announced_date, modality')
      .eq('phase_at_signing', combo.phase)
      .eq('therapeutic_area', combo.ta)
      .eq('is_synthetic', false)
      .gt('upfront_usd', 0)
      .order('announced_date', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[topic-rotation] how_much query failed:', error.message);
      continue;
    }
    if (!deals || deals.length < 3) continue; // need at least 3 data points

    // Compute percentiles on upfront_usd
    const upfronts = deals
      .map((d) => d.upfront_usd as number)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);

    if (upfronts.length < 3) continue;

    const medianUpfront = percentile(upfronts, 50);
    const p25Upfront = percentile(upfronts, 25);
    const p75Upfront = percentile(upfronts, 75);

    // Median TDV
    const tdvs = deals
      .map((d) => d.total_deal_value_usd as number)
      .filter((v) => v != null && v > 0)
      .sort((a, b) => a - b);
    const medianTdv = tdvs.length > 0 ? percentile(tdvs, 50) : 0;

    // Sample deals for the article
    const sampleDeals = deals.slice(0, 5).map((d) => ({
      licensor: d.licensor_name as string,
      licensee: d.licensee_name as string,
      upfront: (d.upfront_usd as number) || 0,
      tdv: (d.total_deal_value_usd as number) || 0,
      year: d.announced_date
        ? new Date(d.announced_date as string).getFullYear()
        : new Date().getFullYear(),
    }));

    // Determine the most common modality for a richer title
    const modalityCounts: Record<string, number> = {};
    for (const d of deals) {
      if (d.modality) {
        modalityCounts[d.modality as string] =
          (modalityCounts[d.modality as string] || 0) + 1;
      }
    }
    const topModality =
      Object.entries(modalityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const phaseLabel = PHASE_LABELS[combo.phase] || combo.phase;
    const taLabel = TA_LABELS[combo.ta] || combo.ta;
    const modalityLabel = topModality
      ? MODALITY_LABELS[topModality] || topModality
      : null;

    const topicKey = `how_much:${combo.phase}:${combo.ta}`;

    const medianM = (medianUpfront / 1_000_000).toFixed(0);
    const title = `How Much Does a ${phaseLabel} ${taLabel} Deal Cost? Median Upfront: $${medianM}M`;
    const targetKeyword =
      `how much ${phaseLabel} ${taLabel} licensing deal upfront cost`.toLowerCase();

    const data: HowMuchData = {
      category: 'how_much',
      phase: combo.phase,
      phaseLabel,
      modality: topModality,
      modalityLabel,
      therapeuticArea: combo.ta,
      taLabel,
      medianUpfront,
      p25Upfront,
      p75Upfront,
      medianTdv,
      dealCount: upfronts.length,
      sampleDeals,
    };

    return { category: 'how_much', topicKey, title, targetKeyword, data };
  }

  return null;
}

async function generateBuyerIntelligence(
  supabase: SupabaseClient,
): Promise<TopicParams | null> {
  // Find top buyers by deal count (non-synthetic)
  const { data: buyers, error } = await supabase
    .from('deals')
    .select('licensee_name')
    .eq('is_synthetic', false)
    .not('licensee_name', 'is', null);

  if (error) {
    console.error('[topic-rotation] buyer_intelligence count query failed:', error.message);
    return null;
  }
  if (!buyers || buyers.length === 0) return null;

  // Aggregate deal counts by licensee in JS
  const countMap: Record<string, number> = {};
  for (const row of buyers) {
    const name = row.licensee_name as string;
    if (!name) continue;
    countMap[name] = (countMap[name] || 0) + 1;
  }

  // Sort by count DESC, take top 20 candidates
  const ranked = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (ranked.length === 0) return null;

  // Check which already have buyer_intelligence posts
  const candidateKeys = ranked.map(
    ([name]) => `buyer_intelligence:${slugify(name)}`,
  );
  const { data: existingLogs } = await supabase
    .from('seo_content_log')
    .select('topic_key')
    .in('topic_key', candidateKeys);

  const usedKeys = new Set((existingLogs || []).map((r) => r.topic_key));

  for (const [companyName, dealCount] of ranked) {
    const companySlug = slugify(companyName);
    const topicKey = `buyer_intelligence:${companySlug}`;
    if (usedKeys.has(topicKey)) continue;

    // Fetch this buyer's deals
    const { data: companyDeals, error: cdErr } = await supabase
      .from('deals')
      .select('licensor_name, asset_name, upfront_usd, total_deal_value_usd, phase_at_signing, therapeutic_area, deal_type, announced_date')
      .eq('licensee_name', companyName)
      .eq('is_synthetic', false)
      .order('announced_date', { ascending: false })
      .limit(50);

    if (cdErr || !companyDeals || companyDeals.length === 0) continue;

    // Compute stats
    const taSet = new Set<string>();
    const dtSet = new Set<string>();
    let upfrontSum = 0;
    let tdvSum = 0;
    let ratioCount = 0;

    for (const d of companyDeals) {
      if (d.therapeutic_area) taSet.add(d.therapeutic_area as string);
      if (d.deal_type) dtSet.add(d.deal_type as string);
      const up = d.upfront_usd as number | null;
      const tdv = d.total_deal_value_usd as number | null;
      if (up != null && up > 0 && tdv != null && tdv > 0) {
        upfrontSum += up / tdv;
        ratioCount++;
      }
    }

    const avgUpfrontRatio = ratioCount > 0 ? upfrontSum / ratioCount : null;

    // Date range
    const dates = companyDeals
      .map((d) => d.announced_date as string | null)
      .filter((d): d is string => d != null)
      .sort();
    const periodStart = dates[0] || '';
    const periodEnd = dates[dates.length - 1] || '';

    const recentDeals = companyDeals.slice(0, 10).map((d) => ({
      licensor: d.licensor_name as string,
      assetName: d.asset_name as string | null,
      upfront: d.upfront_usd as number | null,
      tdv: d.total_deal_value_usd as number | null,
      phase: d.phase_at_signing as string | null,
      ta: (d.therapeutic_area as string) || 'unknown',
      date: d.announced_date as string | null,
    }));

    const title = `${companyName} Deal-Making Profile: ${dealCount} Deals Analyzed`;
    const targetKeyword =
      `${companyName} pharma deals licensing strategy`.toLowerCase();

    const data: BuyerIntelligenceData = {
      category: 'buyer_intelligence',
      companyName,
      dealCount,
      therapeuticAreas: Array.from(taSet),
      preferredDealTypes: Array.from(dtSet),
      avgUpfrontRatio,
      recentDeals,
      periodStart,
      periodEnd,
    };

    return { category: 'buyer_intelligence', topicKey, title, targetKeyword, data };
  }

  return null;
}

async function generateMarketTrend(
  supabase: SupabaseClient,
): Promise<TopicParams | null> {
  const now = new Date();
  const currentStart = sixMonthsAgo(now);
  const previousStart = sixMonthsAgo(currentStart);

  const currentLabel = `${formatDateISO(currentStart)} to ${formatDateISO(now)}`;
  const previousLabel = `${formatDateISO(previousStart)} to ${formatDateISO(currentStart)}`;

  // Fetch deals from the last 12 months
  const { data: deals, error } = await supabase
    .from('deals')
    .select('licensor_name, licensee_name, upfront_usd, total_deal_value_usd, announced_date, modality, therapeutic_area')
    .eq('is_synthetic', false)
    .gte('announced_date', formatDateISO(previousStart))
    .order('announced_date', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[topic-rotation] market_trend query failed:', error.message);
    return null;
  }
  if (!deals || deals.length < 10) return null;

  const currentStartStr = formatDateISO(currentStart);

  // Bucket deals into current vs. previous period
  type DealRow = (typeof deals)[number];
  const currentDeals: DealRow[] = [];
  const previousDeals: DealRow[] = [];

  for (const d of deals) {
    const date = d.announced_date as string | null;
    if (!date) continue;
    if (date >= currentStartStr) {
      currentDeals.push(d);
    } else {
      previousDeals.push(d);
    }
  }

  // Analyze both modality and TA shifts
  type TrendCandidate = {
    trendType: MarketTrendData['trendType'];
    dimension: string;
    dimensionLabel: string;
    currentCount: number;
    previousCount: number;
    changePercent: number;
    topDeals: MarketTrendData['topDeals'];
  };

  const candidates: TrendCandidate[] = [];

  // Modality surge analysis
  const modalityCurrentCounts: Record<string, DealRow[]> = {};
  const modalityPreviousCounts: Record<string, number> = {};

  for (const d of currentDeals) {
    const mod = d.modality as string | null;
    if (!mod) continue;
    if (!modalityCurrentCounts[mod]) modalityCurrentCounts[mod] = [];
    modalityCurrentCounts[mod].push(d);
  }
  for (const d of previousDeals) {
    const mod = d.modality as string | null;
    if (!mod) continue;
    modalityPreviousCounts[mod] = (modalityPreviousCounts[mod] || 0) + 1;
  }

  for (const [mod, currentGroup] of Object.entries(modalityCurrentCounts)) {
    const prev = modalityPreviousCounts[mod] || 0;
    const curr = currentGroup.length;
    if (prev === 0 && curr <= 1) continue; // not interesting
    const changePct = prev > 0 ? ((curr - prev) / prev) * 100 : curr * 100;
    if (Math.abs(changePct) < 20) continue; // skip small changes

    const topDeals = currentGroup.slice(0, 5).map((d) => ({
      licensor: d.licensor_name as string,
      licensee: d.licensee_name as string,
      upfront: d.upfront_usd as number | null,
      tdv: d.total_deal_value_usd as number | null,
      date: d.announced_date as string | null,
    }));

    candidates.push({
      trendType: 'modality_surge',
      dimension: mod,
      dimensionLabel: MODALITY_LABELS[mod] || mod,
      currentCount: curr,
      previousCount: prev,
      changePercent: Math.round(changePct),
      topDeals,
    });
  }

  // TA shift analysis
  const taCurrentCounts: Record<string, DealRow[]> = {};
  const taPreviousCounts: Record<string, number> = {};

  for (const d of currentDeals) {
    const ta = d.therapeutic_area as string | null;
    if (!ta) continue;
    if (!taCurrentCounts[ta]) taCurrentCounts[ta] = [];
    taCurrentCounts[ta].push(d);
  }
  for (const d of previousDeals) {
    const ta = d.therapeutic_area as string | null;
    if (!ta) continue;
    taPreviousCounts[ta] = (taPreviousCounts[ta] || 0) + 1;
  }

  for (const [ta, currentGroup] of Object.entries(taCurrentCounts)) {
    const prev = taPreviousCounts[ta] || 0;
    const curr = currentGroup.length;
    if (prev === 0 && curr <= 1) continue;
    const changePct = prev > 0 ? ((curr - prev) / prev) * 100 : curr * 100;
    if (Math.abs(changePct) < 20) continue;

    const topDeals = currentGroup.slice(0, 5).map((d) => ({
      licensor: d.licensor_name as string,
      licensee: d.licensee_name as string,
      upfront: d.upfront_usd as number | null,
      tdv: d.total_deal_value_usd as number | null,
      date: d.announced_date as string | null,
    }));

    candidates.push({
      trendType: 'ta_shift',
      dimension: ta,
      dimensionLabel: TA_LABELS[ta] || ta,
      currentCount: curr,
      previousCount: prev,
      changePercent: Math.round(changePct),
      topDeals,
    });
  }

  if (candidates.length === 0) return null;

  // Sort by absolute change percent — biggest shift first
  candidates.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  // Check seo_content_log for already-used trends
  const trendKeys = candidates.map(
    (c) => `market_trend:${c.trendType}:${c.dimension}:${currentLabel}`,
  );
  const { data: existingLogs } = await supabase
    .from('seo_content_log')
    .select('topic_key')
    .in('topic_key', trendKeys);

  const usedKeys = new Set((existingLogs || []).map((r) => r.topic_key));

  for (const candidate of candidates) {
    const topicKey = `market_trend:${candidate.trendType}:${candidate.dimension}:${currentLabel}`;
    if (usedKeys.has(topicKey)) continue;

    const direction = candidate.changePercent > 0 ? 'Surge' : 'Decline';
    const headline = `${candidate.dimensionLabel} Deal ${direction}: ${candidate.changePercent > 0 ? '+' : ''}${candidate.changePercent}% in 6 Months`;

    const title = `${candidate.dimensionLabel} ${direction} — ${Math.abs(candidate.changePercent)}% Shift in Pharma Licensing Activity`;
    const targetKeyword =
      `${candidate.dimensionLabel} pharma licensing trend ${new Date().getFullYear()}`.toLowerCase();

    const data: MarketTrendData = {
      category: 'market_trend',
      trendType: candidate.trendType,
      headline,
      currentPeriodLabel: currentLabel,
      previousPeriodLabel: previousLabel,
      currentValue: candidate.currentCount,
      previousValue: candidate.previousCount,
      changePercent: candidate.changePercent,
      topDeals: candidate.topDeals,
      dimension: candidate.dimension,
      dimensionLabel: candidate.dimensionLabel,
    };

    return { category: 'market_trend', topicKey, title, targetKeyword, data };
  }

  return null;
}

async function generateComparison(
  supabase: SupabaseClient,
): Promise<TopicParams | null> {
  // Check which competitors already have posts
  const competitorKeys = COMPETITORS.map((c) => `comparison:${c.slug}`);
  const { data: existingLogs } = await supabase
    .from('seo_content_log')
    .select('topic_key')
    .in('topic_key', competitorKeys);

  const usedKeys = new Set((existingLogs || []).map((r) => r.topic_key));

  // Get our total deal count for the data point
  const { count } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('is_synthetic', false);

  const uniqueDataPoints = count || 0;

  for (const competitor of COMPETITORS) {
    const topicKey = `comparison:${competitor.slug}`;
    if (usedKeys.has(topicKey)) continue;

    const title = `Ambrosia Benchmarker vs. ${competitor.name}: ${competitor.angle.charAt(0).toUpperCase() + competitor.angle.slice(1)}`;
    const targetKeyword =
      `${competitor.name} alternative pharma deal benchmarking`.toLowerCase();

    const data: ComparisonData = {
      category: 'comparison',
      competitorName: competitor.name,
      comparisonAngle: competitor.angle,
      uniqueDataPoints,
    };

    return { category: 'comparison', topicKey, title, targetKeyword, data };
  }

  return null;
}

// ── Category dispatcher ─────────────────────────────────────────────────────

const GENERATORS: Record<
  ContentCategory,
  (supabase: SupabaseClient) => Promise<TopicParams | null>
> = {
  deal_analysis: generateDealAnalysis,
  how_much: generateHowMuch,
  buyer_intelligence: generateBuyerIntelligence,
  market_trend: generateMarketTrend,
  comparison: generateComparison,
};

// ── Main export ─────────────────────────────────────────────────────────────

/**
 * Returns the next topic to generate, or null if all categories are exhausted.
 *
 * Picks a category using weighted random, generates a topic within that
 * category using real DB data, and falls through to the next category
 * if the selected one is exhausted.
 */
export async function getNextTopic(
  supabase: SupabaseClient,
): Promise<TopicParams | null> {
  const order = pickCategoryOrder();

  for (const category of order) {
    try {
      const result = await GENERATORS[category](supabase);
      if (result) return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[topic-rotation] ${category} generator failed:`, msg);
      // Fall through to next category
    }
  }

  // All categories exhausted
  return null;
}
