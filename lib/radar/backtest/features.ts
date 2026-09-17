/**
 * Asset Radar scoring v3 — feature layer.
 *
 * `buildFeatureVector(bundle, asOf)` is pure: it turns one asset's evidence
 * bundle into a documented, versioned numeric vector. Every feature is
 * computed only from rows dated on or before `asOf`, so the same function
 * reconstructs a historical snapshot (backtest) and scores today (asOf = now).
 * Every evidence item carries a source, a URL and a date.
 *
 * Leakage controls (enforced here, tested in __tests__/lib/radar-backtest.test.ts):
 *   - Financials: fiscal_period_end <= asOf AND filed_at <= asOf when filed_at is known
 *     (a 10-K for FY Dec-31 is public in March; using the period end alone leaks).
 *   - Press, intent signals, patents (filing_date), publications, deals
 *     (announced_date), trials (first_posted_date / stop dates): <= asOf.
 *   - Catalysts: the expected date may be in the future (that is the feature);
 *     the row must have been observable at asOf (observed_date <= asOf when set).
 *   - Phase at asOf is reconstructed from the asset's trials posted <= asOf,
 *     never from clinical_assets.phase (which is today's phase).
 *   - Known residual leaks, documented on the methodology page: regulatory
 *     designations and territory rights are undated in the schema and are used
 *     as of today.
 *
 * `fetchFeatureBundles` is the Supabase side. It tolerates missing tables
 * (migration 114 may land after this code): a failed source is recorded in
 * `sourceErrors` and its features come back null, never zero.
 *
 * Note on imports: this module imports phasePrior/availabilityFactor from
 * signal-detection.ts, which in turn imports buildFeatureVector from here.
 * Both sides only reference the other's exports at call time, so the cycle
 * is safe under webpack and jest.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { pgArrayLiteral } from '@/lib/radar/pg-array';
import { escapeLikePattern, phasePrior, availabilityFactor, normalizePhase } from '@/lib/radar/signal-detection';
import type { SignConstraint } from '@/lib/radar/backtest/model';

// ═══════════════════════════════════════════════════════════════════════
// FEATURE SPEC — the documented, versioned vector
// ═══════════════════════════════════════════════════════════════════════

export const FEATURE_VERSION = 'v3.0';

export type FeatureName =
  | 'runway_months'
  | 'runway_under_12'
  | 'going_concern'
  | 'atm_or_shelf_filed'
  | 'months_since_last_raise'
  | 'intent_bullish'
  | 'intent_bearish'
  | 'bd_hire_12m'
  | 'layoffs_12m'
  | 'strategic_review_12m'
  | 'press_licensing_12m'
  | 'patent_velocity'
  | 'competitor_terminations_12m'
  | 'months_to_primary_completion'
  | 'readout_window'
  | 'phase_prior'
  | 'designations_n'
  | 'owner_industry'
  | 'region_east_asia'
  | 'region_europe'
  | 'region_other'
  | 'company_deals_36m'
  | 'publication_velocity_12m'
  | 'availability'
  | 'pipeline_rank'
  | 'pipeline_same_phase_n'
  | 'ta_matches_company_focus'
  | 'asset_age_months'
  | 'trial_count_at_asof';

export interface FeatureSpec {
  name: FeatureName;
  label: string;
  description: string;
  /** Tables read. */
  sources: string[];
  /** Monotone constraint on the model coefficient (+1 raises probability as the value rises). */
  sign: SignConstraint;
  unit: string;
}

export const FEATURE_SPECS: readonly FeatureSpec[] = Object.freeze([
  { name: 'runway_months', label: 'Cash runway', description: 'Months of runway from the latest filed period on or before the snapshot date (total liquidity / quarterly burn × 3, or the filed runway), capped at 48.', sources: ['company_financials'], sign: -1, unit: 'months' },
  { name: 'runway_under_12', label: 'Runway under 12 months', description: '1 when the latest runway is below 12 months.', sources: ['company_financials'], sign: 1, unit: 'flag' },
  { name: 'going_concern', label: 'Going-concern language', description: '1 when a going-concern intent signal (verbatim quote from a filing) was observed in the prior 12 months. The company_financials boolean is an EDGAR full-text "substantial doubt" proxy that can trip on risk-factor boilerplate, so it is used only when the intent-signal source is unavailable.', sources: ['company_intent_signals', 'company_financials'], sign: 1, unit: 'flag' },
  { name: 'atm_or_shelf_filed', label: 'ATM or shelf on file', description: '1 when the latest filed period reports an at-the-market program or shelf registration.', sources: ['company_financials'], sign: 1, unit: 'flag' },
  { name: 'months_since_last_raise', label: 'Months since last raise', description: 'Months since the last financing press release on or before the snapshot date, capped at 36. Null when no financing was ever observed.', sources: ['press_releases'], sign: 1, unit: 'months' },
  { name: 'intent_bullish', label: 'Seeking-partner language', description: 'Confidence-weighted sum of bullish intent signals (seeking partner, strategic review, restructuring, pipeline prioritization) with a 6-month half-life.', sources: ['company_intent_signals'], sign: 1, unit: 'decayed count' },
  { name: 'intent_bearish', label: 'Retaining-rights language', description: 'Confidence-weighted sum of bearish intent signals (retaining rights, self-commercialize) with a 6-month half-life.', sources: ['company_intent_signals'], sign: -1, unit: 'decayed count' },
  { name: 'bd_hire_12m', label: 'BD or CBO hire', description: 'Business-development, CBO or licensing hires in the prior 12 months (intent signals plus executive-hire press with BD keywords).', sources: ['company_intent_signals', 'press_releases'], sign: 1, unit: 'count' },
  { name: 'layoffs_12m', label: 'Layoffs', description: 'Workforce reductions in the prior 12 months.', sources: ['company_intent_signals', 'press_releases'], sign: 1, unit: 'count' },
  { name: 'strategic_review_12m', label: 'Strategic review', description: 'Strategic-alternatives or restructuring announcements in the prior 12 months.', sources: ['company_intent_signals', 'press_releases'], sign: 1, unit: 'count' },
  { name: 'press_licensing_12m', label: 'Licensing press activity', description: 'Press releases classified as licensing that mention the company in the prior 12 months.', sources: ['press_releases'], sign: 1, unit: 'count' },
  { name: 'patent_velocity', label: 'Patent velocity', description: '(filings in the prior 12 months + 1) / (annualised filings over months 13-36 + 1). Null when the assignee has no filings on record.', sources: ['company_patents'], sign: 1, unit: 'ratio' },
  { name: 'competitor_terminations_12m', label: 'Competitor terminations', description: 'Terminated or withdrawn trials by other sponsors in the same indication and modality in the prior 12 months.', sources: ['company_trials'], sign: 1, unit: 'count' },
  { name: 'months_to_primary_completion', label: 'Months to primary completion', description: 'Months from the snapshot date to the nearest primary completion or readout date of the asset (negative when it passed within the prior 12 months), clamped to [-12, 36].', sources: ['asset_catalysts', 'company_trials'], sign: -1, unit: 'months' },
  { name: 'readout_window', label: 'Readout window', description: '1 when a primary completion or readout falls between 3 months before and 9 months after the snapshot date.', sources: ['asset_catalysts', 'company_trials'], sign: 1, unit: 'flag' },
  { name: 'phase_prior', label: 'Phase prior', description: 'Phase at the snapshot date (highest phase among the asset\'s trials posted by then) mapped through the documented phase prior (Phase 2 = 1.0).', sources: ['company_trials'], sign: 1, unit: 'prior' },
  { name: 'designations_n', label: 'Regulatory designations', description: 'Count of breakthrough, fast-track, orphan, priority-review or RMAT designations (undated; used as of today).', sources: ['clinical_assets'], sign: 1, unit: 'count' },
  { name: 'owner_industry', label: 'Industry owner', description: '1 for industry owners, 0 for academic, hospital, government and other; null when unknown.', sources: ['companies'], sign: 0, unit: 'flag' },
  { name: 'region_east_asia', label: 'Originator in China, Japan or Korea', description: 'One-hot of originator region (baseline North America).', sources: ['clinical_assets'], sign: 0, unit: 'flag' },
  { name: 'region_europe', label: 'Originator in Europe', description: 'One-hot of originator region (baseline North America).', sources: ['clinical_assets'], sign: 0, unit: 'flag' },
  { name: 'region_other', label: 'Originator elsewhere', description: 'One-hot of originator region (baseline North America).', sources: ['clinical_assets'], sign: 0, unit: 'flag' },
  { name: 'company_deals_36m', label: 'Company deal history', description: 'Canonical deals in which the company was licensor, announced in the prior 36 months.', sources: ['deals'], sign: 1, unit: 'count' },
  { name: 'publication_velocity_12m', label: 'Publication velocity', description: 'Publications and preprints naming the asset in the prior 12 months.', sources: ['research_signals'], sign: 1, unit: 'count' },
  { name: 'availability', label: 'Rights available', description: 'Availability factor from partnership status and remaining territories (1.0 unpartnered). Constant in training because every training row is unpartnered at the snapshot date.', sources: ['clinical_assets', 'deals'], sign: 1, unit: 'factor' },
  { name: 'pipeline_rank', label: 'Rank in company pipeline', description: '1 = most advanced asset the company had at the snapshot date.', sources: ['clinical_assets', 'company_trials'], sign: 0, unit: 'rank' },
  { name: 'pipeline_same_phase_n', label: 'Sibling assets at same phase', description: 'Other assets of the company at the same phase at the snapshot date.', sources: ['clinical_assets', 'company_trials'], sign: 0, unit: 'count' },
  { name: 'ta_matches_company_focus', label: 'Core therapeutic area', description: '1 when the asset\'s therapeutic area is the company\'s most common one at the snapshot date (non-core assets are out-licensed more often).', sources: ['clinical_assets'], sign: -1, unit: 'flag' },
  { name: 'asset_age_months', label: 'Asset age', description: 'Months since the asset\'s first trial was posted, as of the snapshot date.', sources: ['company_trials'], sign: 0, unit: 'months' },
  { name: 'trial_count_at_asof', label: 'Trials posted', description: 'Number of the asset\'s trials posted on or before the snapshot date.', sources: ['company_trials'], sign: 1, unit: 'count' },
] as const);

export const FEATURE_NAMES: readonly FeatureName[] = FEATURE_SPECS.map(s => s.name);
export const SIGN_CONSTRAINTS: readonly SignConstraint[] = FEATURE_SPECS.map(s => s.sign);

// ═══════════════════════════════════════════════════════════════════════
// BUNDLE TYPES (rows as read from Supabase; all dates ISO strings)
// ═══════════════════════════════════════════════════════════════════════

export interface FeatureAsset {
  id: string;
  company_id: string | null;
  company_name: string;
  asset_name: string;
  asset_aliases?: string[] | null;
  phase: string | null;
  therapeutic_area: string | null;
  indication_category: string | null;
  modality: string | null;
  partnership_status: string | null;
  territory_rights_available?: string[] | null;
  nct_ids: string[] | null;
  first_posted_date?: string | null;
  regulatory_designations?: string[] | null;
  originator_region?: string | null;
  owner_type?: string | null;
}

export interface FinancialRow {
  fiscal_period_end: string;
  period_type?: string | null;
  cash_and_equivalents?: number | null;
  short_term_investments?: number | null;
  total_liquidity?: number | null;
  quarterly_burn?: number | null;
  runway_months?: number | null;
  going_concern?: boolean | null;
  atm_or_shelf_filed?: boolean | null;
  source_url?: string | null;
  filed_at?: string | null;
}

export interface IntentSignalRow {
  signal_type: string;
  polarity: 'bullish' | 'bearish' | 'neutral' | string | null;
  quote?: string | null;
  source_url?: string | null;
  observed_at: string;
  confidence?: number | null;
}

export interface PatentRow {
  patent_id: string;
  filing_date: string | null;
  grant_date?: string | null;
  drug_master_id?: string | null;
  source_url?: string | null;
}

export interface CatalystRow {
  asset_id: string;
  catalyst_type: string;
  expected_date: string | null;
  observed_date?: string | null;
  nct_id?: string | null;
  source_url?: string | null;
  confidence?: number | null;
}

export interface PressRow {
  id: string;
  headline: string;
  published_at: string;
  source_url: string | null;
  categories?: string[] | null;
}

export interface TrialRow {
  nct_id: string;
  company_id?: string | null;
  company_name?: string | null;
  phase: string | null;
  status: string | null;
  modality?: string | null;
  indication_category?: string | null;
  start_date?: string | null;
  first_posted_date?: string | null;
  primary_completion_date?: string | null;
  completion_date?: string | null;
  last_update_posted?: string | null;
  why_stopped?: string | null;
}

export interface CompanyDealRow {
  id: string;
  announced_date: string;
  deal_type?: string | null;
  asset_name?: string | null;
  source_url?: string | null;
}

export interface PublicationRow {
  id: string;
  title: string;
  published_date: string | null;
  source_url: string | null;
}

export interface SiblingAsset {
  id: string;
  phase: string | null;
  therapeutic_area: string | null;
  first_posted_date?: string | null;
  nct_ids?: string[] | null;
}

export interface FeatureBundle {
  asset: FeatureAsset;
  financials: FinancialRow[];
  intentSignals: IntentSignalRow[];
  patents: PatentRow[];
  catalysts: CatalystRow[];
  press: PressRow[];
  /** Every trial of the owning company; the asset's own trials are those whose nct_id is in asset.nct_ids. */
  companyTrials: TrialRow[];
  /** Terminated / withdrawn trials in the asset's indication category, any sponsor. */
  competitorTerminations: TrialRow[];
  /** Deals where the owning company was licensor (canonical, non-rejected). */
  companyDeals: CompanyDealRow[];
  publications: PublicationRow[];
  /** The company's other assets (for portfolio position). */
  siblings: SiblingAsset[];
  /** table → error; features that read a failed table are null. */
  sourceErrors: Record<string, string>;
}

export interface FeatureEvidence {
  source: string;
  source_url: string | null;
  date: string | null;
  text: string;
}

export interface FeatureVector {
  version: string;
  as_of: string;
  values: Record<FeatureName, number | null>;
  evidence: Partial<Record<FeatureName, FeatureEvidence[]>>;
  /** Share of features with a non-null value. */
  completeness: number;
  /** False when the asset had no trial posted on or before as_of (it did not exist yet). */
  eligible: boolean;
  phase_at_asof: string | null;
  sources_failed: string[];
}

export function emptyFeatureBundle(asset: FeatureAsset): FeatureBundle {
  return {
    asset, financials: [], intentSignals: [], patents: [], catalysts: [], press: [], companyTrials: [],
    competitorTerminations: [], companyDeals: [], publications: [], siblings: [], sourceErrors: {},
  };
}

// ═══════════════════════════════════════════════════════════════════════
// DATE HELPERS
// ═══════════════════════════════════════════════════════════════════════

const MS_PER_MONTH = 365.25 * 86_400_000 / 12;

function parseDate(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

/** True when `date` is known and on or before `asOf`. Unknown dates never pass. */
export function onOrBefore(date: string | null | undefined, asOf: Date): boolean {
  const t = parseDate(date);
  return t !== null && t <= asOf.getTime();
}

function monthsBetween(from: number, to: number): number {
  return (to - from) / MS_PER_MONTH;
}

function monthsAgoMs(asOf: Date, months: number): number {
  return asOf.getTime() - months * MS_PER_MONTH;
}

function isoDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════
// PURE FEATURE BUILDER
// ═══════════════════════════════════════════════════════════════════════

const BULLISH_INTENT = new Set(['seeking_partner', 'strategic_review', 'restructuring', 'pipeline_prioritization', 'going_concern_language', 'layoffs']);
const BEARISH_INTENT = new Set(['retaining_rights']);
const BD_PRESS_RE = /\b(chief business officer|business development|licensing|corporate development|alliance management|head of partner|vp,? bd|cbo\b)/i;
const HIGH_VALUE_DESIGNATIONS = ['breakthrough', 'fast_track', 'fast track', 'priority_review', 'priority review', 'orphan', 'rmat', 'prime'];
const EAST_ASIA = new Set(['china', 'japan', 'south_korea']);
const PHASE_RANK: Record<string, number> = {
  early_phase1: 1, early_phase_1: 1,
  phase1: 2, phase_1: 2,
  phase1_phase2: 3, phase_1_2: 3,
  phase2: 4, phase_2: 4,
  phase2_phase3: 5, phase_2_3: 5,
  phase3: 6, phase_3: 6,
  phase4: 7, phase_4: 7, approved: 7,
};

const INTENT_HALF_LIFE_MONTHS = 6;

function phaseRank(phase: string | null | undefined): number | null {
  const key = normalizePhase(phase);
  return key ? PHASE_RANK[key] ?? null : null;
}

function normalizePhaseKey(phase: string | null | undefined): string | null {
  const key = normalizePhase(phase);
  if (!key || !(key in PHASE_RANK)) return null;
  // canonical vocab spelling
  return key.replace(/^phase(\d)/, 'phase_$1').replace(/^phase_(\d)_phase(\d)/, 'phase_$1_$2').replace(/^early_phase(\d)/, 'early_phase_$1');
}

/** Trial posting date: first_posted_date, else start_date. */
function trialPostedAt(t: TrialRow): string | null {
  return t.first_posted_date || t.start_date || null;
}

/** When a trial stopped: completion, primary completion, else last update. */
function trialStoppedAt(t: TrialRow): string | null {
  return t.completion_date || t.primary_completion_date || t.last_update_posted || null;
}

/** Highest phase among trials posted on or before asOf; null when none. */
export function phaseAtAsOf(assetTrials: readonly TrialRow[], asOf: Date): string | null {
  let best: { rank: number; key: string } | null = null;
  for (const t of assetTrials) {
    if (!onOrBefore(trialPostedAt(t), asOf)) continue;
    const rank = phaseRank(t.phase);
    const key = normalizePhaseKey(t.phase);
    if (rank === null || !key) continue;
    if (!best || rank > best.rank) best = { rank, key };
  }
  return best ? best.key : null;
}

/**
 * Build the versioned feature vector for one asset as of a date. Pure.
 */
export function buildFeatureVector(bundle: FeatureBundle, asOf: Date): FeatureVector {
  const { asset } = bundle;
  const asOfMs = asOf.getTime();
  const values = {} as Record<FeatureName, number | null>;
  const evidence: Partial<Record<FeatureName, FeatureEvidence[]>> = {};
  const failed = new Set(Object.keys(bundle.sourceErrors));
  const ok = (...tables: string[]) => tables.every(t => !failed.has(t));

  const addEvidence = (name: FeatureName, item: FeatureEvidence) => {
    const list = evidence[name] ?? (evidence[name] = []);
    if (list.length < 3) list.push(item);
  };

  // ── Asset trials, phase at asOf, eligibility ──
  const nctSet = new Set((asset.nct_ids ?? []).filter(Boolean));
  const assetTrials = bundle.companyTrials.filter(t => nctSet.has(t.nct_id));
  const postedTrials = assetTrials.filter(t => onOrBefore(trialPostedAt(t), asOf));
  const phaseKey = phaseAtAsOf(assetTrials, asOf);
  const firstPosted = postedTrials.reduce<number | null>((min, t) => {
    const ts = parseDate(trialPostedAt(t));
    return ts === null ? min : min === null ? ts : Math.min(min, ts);
  }, null);
  // Fallback for assets whose trials are not in company_trials (ex-US registries):
  // first_posted_date on the asset row, when it is on or before asOf.
  const fallbackPosted = parseDate(asset.first_posted_date);
  const existedAtAsOf = firstPosted !== null || (fallbackPosted !== null && fallbackPosted <= asOfMs);
  const eligible = ok('company_trials') ? existedAtAsOf : fallbackPosted !== null && fallbackPosted <= asOfMs;
  const effectivePhase = phaseKey ?? (existedAtAsOf ? normalizePhaseKey(asset.phase) : null);

  // ── Financials ──
  if (ok('company_financials')) {
    const fin = bundle.financials
      .filter(f => onOrBefore(f.fiscal_period_end, asOf) && (!f.filed_at || onOrBefore(f.filed_at, asOf)))
      .sort((a, b) => (b.fiscal_period_end || '').localeCompare(a.fiscal_period_end || ''));
    const latest = fin[0];
    if (latest) {
      let runway: number | null = latest.runway_months ?? null;
      if (runway === null) {
        const liquidity = latest.total_liquidity ?? ((latest.cash_and_equivalents ?? 0) + (latest.short_term_investments ?? 0) || null);
        const burn = latest.quarterly_burn ?? null;
        if (liquidity !== null && burn !== null && burn > 0) runway = (liquidity / burn) * 3;
      }
      // Runway is measured at the period end; age it forward to asOf.
      if (runway !== null) {
        const age = monthsBetween(parseDate(latest.fiscal_period_end)!, asOfMs);
        runway = clamp(runway - Math.max(0, age), 0, 48);
        values.runway_months = round2(runway);
        values.runway_under_12 = runway < 12 ? 1 : 0;
        addEvidence('runway_months', { source: 'company_financials', source_url: latest.source_url ?? null, date: latest.fiscal_period_end, text: `${round2(runway)} months of runway at ${latest.fiscal_period_end}${latest.period_type ? ` (${latest.period_type})` : ''}` });
        if (runway < 12) addEvidence('runway_under_12', { source: 'company_financials', source_url: latest.source_url ?? null, date: latest.fiscal_period_end, text: `Runway below 12 months (${round2(runway)})` });
      } else {
        values.runway_months = null;
        values.runway_under_12 = null;
      }
      values.atm_or_shelf_filed = latest.atm_or_shelf_filed === null || latest.atm_or_shelf_filed === undefined ? null : latest.atm_or_shelf_filed ? 1 : 0;
      if (latest.atm_or_shelf_filed) addEvidence('atm_or_shelf_filed', { source: 'company_financials', source_url: latest.source_url ?? null, date: latest.fiscal_period_end, text: 'ATM program or shelf registration on file' });
      // Low-precision proxy; overridden below when company_intent_signals is readable.
      values.going_concern = latest.going_concern ? 1 : latest.going_concern === false ? 0 : null;
      if (latest.going_concern) addEvidence('going_concern', { source: 'company_financials', source_url: latest.source_url ?? null, date: latest.fiscal_period_end, text: 'Full-text "substantial doubt" match in the latest filing (proxy)' });
    } else {
      values.runway_months = null; values.runway_under_12 = null; values.atm_or_shelf_filed = null; values.going_concern = null;
    }
  } else {
    values.runway_months = null; values.runway_under_12 = null; values.atm_or_shelf_filed = null; values.going_concern = null;
  }

  // ── Intent signals (decayed) ──
  let bdHires = 0;
  let layoffs = 0;
  let strategic = 0;
  if (ok('company_intent_signals')) {
    let bullish = 0;
    let bearish = 0;
    let goingConcernSignal: IntentSignalRow | null = null;
    const twelveAgo = monthsAgoMs(asOf, 12);
    for (const s of bundle.intentSignals) {
      if (!onOrBefore(s.observed_at, asOf)) continue;
      const t = parseDate(s.observed_at)!;
      const ageMonths = monthsBetween(t, asOfMs);
      const decay = Math.pow(0.5, ageMonths / INTENT_HALF_LIFE_MONTHS);
      const conf = clamp(s.confidence ?? 0.7, 0, 1);
      const polarity = (s.polarity || '').toLowerCase();
      const type = (s.signal_type || '').toLowerCase();
      const ev: FeatureEvidence = { source: 'company_intent_signals', source_url: s.source_url ?? null, date: isoDay(t), text: s.quote ? `"${s.quote.slice(0, 200)}"` : type.replace(/_/g, ' ') };
      if (polarity === 'bullish' || (polarity !== 'bearish' && BULLISH_INTENT.has(type))) { bullish += decay * conf; addEvidence('intent_bullish', ev); }
      if (polarity === 'bearish' || BEARISH_INTENT.has(type)) { bearish += decay * conf; addEvidence('intent_bearish', ev); }
      if (t >= twelveAgo) {
        if (type === 'bd_hire' || type === 'cfo_cbo_change') { bdHires++; addEvidence('bd_hire_12m', ev); }
        if (type === 'layoffs') { layoffs++; addEvidence('layoffs_12m', ev); }
        if (type === 'strategic_review' || type === 'restructuring') { strategic++; addEvidence('strategic_review_12m', ev); }
        if (type === 'going_concern_language' && !goingConcernSignal) goingConcernSignal = s;
      }
    }
    values.intent_bullish = round2(bullish);
    values.intent_bearish = round2(bearish);
    // The verbatim intent signal is the authoritative going-concern source;
    // it replaces the financials proxy whenever this table is readable.
    delete evidence.going_concern;
    if (goingConcernSignal) {
      values.going_concern = 1;
      const t = parseDate(goingConcernSignal.observed_at)!;
      addEvidence('going_concern', { source: 'company_intent_signals', source_url: goingConcernSignal.source_url ?? null, date: isoDay(t), text: goingConcernSignal.quote ? `"${goingConcernSignal.quote.slice(0, 200)}"` : 'Going-concern language in a filing' });
    } else {
      values.going_concern = 0;
    }
  } else {
    values.intent_bullish = null;
    values.intent_bearish = null;
  }

  // ── Press releases (categories) ──
  if (ok('press_releases')) {
    const twelveAgo = monthsAgoMs(asOf, 12);
    let lastRaise: number | null = null;
    let lastRaiseRow: PressRow | null = null;
    let licensing = 0;
    for (const pr of bundle.press) {
      if (!onOrBefore(pr.published_at, asOf)) continue;
      const t = parseDate(pr.published_at)!;
      const cats = (pr.categories ?? []).map(c => c.toLowerCase());
      const ev: FeatureEvidence = { source: 'press_releases', source_url: pr.source_url, date: isoDay(t), text: pr.headline.slice(0, 200) };
      if (cats.includes('financing') && (lastRaise === null || t > lastRaise)) { lastRaise = t; lastRaiseRow = pr; }
      if (t < twelveAgo) continue;
      if (cats.includes('licensing')) { licensing++; addEvidence('press_licensing_12m', ev); }
      if (cats.includes('executive_hire') && BD_PRESS_RE.test(pr.headline)) { bdHires++; addEvidence('bd_hire_12m', ev); }
      if (cats.includes('layoffs')) { layoffs++; addEvidence('layoffs_12m', ev); }
      if (cats.includes('strategic_review')) { strategic++; addEvidence('strategic_review_12m', ev); }
    }
    values.press_licensing_12m = licensing;
    if (lastRaise !== null && lastRaiseRow) {
      const m = clamp(monthsBetween(lastRaise, asOfMs), 0, 36);
      values.months_since_last_raise = round2(m);
      addEvidence('months_since_last_raise', { source: 'press_releases', source_url: lastRaiseRow.source_url, date: isoDay(lastRaise), text: lastRaiseRow.headline.slice(0, 200) });
    } else {
      values.months_since_last_raise = null;
    }
  } else {
    values.press_licensing_12m = null;
    values.months_since_last_raise = null;
  }

  const intentOrPress = ok('company_intent_signals') || ok('press_releases');
  values.bd_hire_12m = intentOrPress ? bdHires : null;
  values.layoffs_12m = intentOrPress ? layoffs : null;
  values.strategic_review_12m = intentOrPress ? strategic : null;

  // ── Patents ──
  if (ok('company_patents')) {
    const twelveAgo = monthsAgoMs(asOf, 12);
    const thirtySixAgo = monthsAgoMs(asOf, 36);
    let recent = 0;
    let prior = 0;
    let any = 0;
    let latest: PatentRow | null = null;
    for (const p of bundle.patents) {
      if (!onOrBefore(p.filing_date, asOf)) continue;
      any++;
      const t = parseDate(p.filing_date)!;
      if (t >= twelveAgo) { recent++; if (!latest || t > parseDate(latest.filing_date)!) latest = p; }
      else if (t >= thirtySixAgo) prior++;
    }
    if (any === 0) {
      values.patent_velocity = null;
    } else {
      values.patent_velocity = round2((recent + 1) / (prior / 2 + 1));
      if (latest) addEvidence('patent_velocity', { source: 'company_patents', source_url: latest.source_url ?? null, date: latest.filing_date, text: `${recent} filing${recent === 1 ? '' : 's'} in the prior 12 months vs ${prior} in months 13-36 (latest ${latest.patent_id})` });
    }
  } else {
    values.patent_velocity = null;
  }

  // ── Competitor terminations (same indication + modality, other sponsors) ──
  if (ok('company_trials') && asset.indication_category) {
    const twelveAgo = monthsAgoMs(asOf, 12);
    const ownId = asset.company_id;
    const ownName = asset.company_name.toLowerCase();
    let n = 0;
    for (const t of bundle.competitorTerminations) {
      const status = (t.status || '').toLowerCase();
      if (status !== 'terminated' && status !== 'withdrawn') continue;
      if ((ownId && t.company_id === ownId) || (t.company_name || '').toLowerCase() === ownName) continue;
      if (asset.modality && t.modality && t.modality !== asset.modality) continue;
      const stopped = trialStoppedAt(t);
      if (!onOrBefore(stopped, asOf)) continue;
      const ts = parseDate(stopped)!;
      if (ts < twelveAgo) continue;
      n++;
      addEvidence('competitor_terminations_12m', { source: 'company_trials', source_url: `https://clinicaltrials.gov/study/${t.nct_id}`, date: isoDay(ts), text: `${t.company_name ?? 'Sponsor'} ${status} ${t.nct_id}${t.why_stopped ? `: ${t.why_stopped.slice(0, 120)}` : ''}` });
    }
    values.competitor_terminations_12m = n;
  } else {
    values.competitor_terminations_12m = ok('company_trials') ? 0 : null;
  }

  // ── Catalyst proximity ──
  {
    const candidates: Array<{ t: number; text: string; url: string | null; source: string }> = [];
    if (ok('asset_catalysts')) {
      for (const c of bundle.catalysts) {
        if (c.asset_id !== asset.id) continue;
        if (c.observed_date && !onOrBefore(c.observed_date, asOf)) continue;
        const t = parseDate(c.expected_date);
        if (t === null) continue;
        candidates.push({ t, text: `${c.catalyst_type.replace(/_/g, ' ')} expected ${isoDay(t)}${c.nct_id ? ` (${c.nct_id})` : ''}`, url: c.source_url ?? (c.nct_id ? `https://clinicaltrials.gov/study/${c.nct_id}` : null), source: 'asset_catalysts' });
      }
    }
    if (ok('company_trials')) {
      for (const t of postedTrials) {
        const ts = parseDate(t.primary_completion_date);
        if (ts === null) continue;
        candidates.push({ t: ts, text: `primary completion ${isoDay(ts)} (${t.nct_id})`, url: `https://clinicaltrials.gov/study/${t.nct_id}`, source: 'company_trials' });
      }
    }
    if (!ok('asset_catalysts') && !ok('company_trials')) {
      values.months_to_primary_completion = null;
      values.readout_window = null;
    } else if (candidates.length === 0) {
      values.months_to_primary_completion = null;
      values.readout_window = 0;
    } else {
      // Nearest date in [-12m, +36m]; prefer the nearest upcoming, else the most recent past.
      let best: typeof candidates[number] | null = null;
      let bestDist = Infinity;
      for (const c of candidates) {
        const m = monthsBetween(asOfMs, c.t);
        if (m < -12 || m > 36) continue;
        const dist = m >= 0 ? m : 12 + Math.abs(m); // upcoming first
        if (dist < bestDist) { bestDist = dist; best = c; }
      }
      if (best) {
        const m = clamp(monthsBetween(asOfMs, best.t), -12, 36);
        values.months_to_primary_completion = round2(m);
        values.readout_window = m >= -3 && m <= 9 ? 1 : 0;
        addEvidence('months_to_primary_completion', { source: best.source, source_url: best.url, date: isoDay(best.t), text: best.text });
        if (values.readout_window === 1) addEvidence('readout_window', { source: best.source, source_url: best.url, date: isoDay(best.t), text: best.text });
      } else {
        values.months_to_primary_completion = null;
        values.readout_window = 0;
      }
    }
  }

  // ── Phase prior, designations, owner, region ──
  values.phase_prior = effectivePhase ? round2(phasePrior(effectivePhase)) : null;
  if (effectivePhase) {
    const lead = postedTrials.find(t => normalizePhaseKey(t.phase) === effectivePhase);
    addEvidence('phase_prior', { source: 'company_trials', source_url: lead ? `https://clinicaltrials.gov/study/${lead.nct_id}` : null, date: lead ? trialPostedAt(lead) : null, text: `${effectivePhase.replace(/_/g, ' ')} at ${isoDay(asOfMs)}` });
  }
  const desigs = (asset.regulatory_designations ?? []).filter(d => HIGH_VALUE_DESIGNATIONS.some(k => d.toLowerCase().includes(k)));
  values.designations_n = desigs.length;
  if (desigs.length) addEvidence('designations_n', { source: 'clinical_assets', source_url: null, date: null, text: desigs.join(', ') });

  const owner = (asset.owner_type || '').toLowerCase();
  values.owner_industry = !owner || owner === 'unknown' ? null : owner === 'industry' ? 1 : 0;

  const region = (asset.originator_region || '').toLowerCase();
  if (!region) {
    values.region_east_asia = null; values.region_europe = null; values.region_other = null;
  } else {
    values.region_east_asia = EAST_ASIA.has(region) ? 1 : 0;
    values.region_europe = region === 'europe' ? 1 : 0;
    values.region_other = region === 'north_america' || EAST_ASIA.has(region) || region === 'europe' ? 0 : 1;
  }

  // ── Company deal history ──
  if (ok('deals')) {
    const thirtySixAgo = monthsAgoMs(asOf, 36);
    let n = 0;
    for (const d of bundle.companyDeals) {
      if (!onOrBefore(d.announced_date, asOf)) continue;
      const t = parseDate(d.announced_date)!;
      if (t < thirtySixAgo) continue;
      n++;
      addEvidence('company_deals_36m', { source: 'deals', source_url: d.source_url ?? null, date: isoDay(t), text: `${d.deal_type ?? 'deal'}${d.asset_name ? `: ${d.asset_name.slice(0, 80)}` : ''}` });
    }
    values.company_deals_36m = n;
  } else {
    values.company_deals_36m = null;
  }

  // ── Publications ──
  if (ok('research_signals')) {
    const twelveAgo = monthsAgoMs(asOf, 12);
    let n = 0;
    for (const p of bundle.publications) {
      if (!onOrBefore(p.published_date, asOf)) continue;
      const t = parseDate(p.published_date)!;
      if (t < twelveAgo) continue;
      n++;
      addEvidence('publication_velocity_12m', { source: 'research_signals', source_url: p.source_url, date: isoDay(t), text: p.title.slice(0, 200) });
    }
    values.publication_velocity_12m = n;
  } else {
    values.publication_velocity_12m = null;
  }

  // ── Availability ──
  values.availability = round2(availabilityFactor(asset.partnership_status, asset.territory_rights_available));

  // ── Portfolio position (siblings existing at asOf) ──
  {
    const siblingsAtAsOf = bundle.siblings.filter(s => s.id !== asset.id && onOrBefore(s.first_posted_date, asOf));
    const ownRank = effectivePhase ? phaseRank(effectivePhase) : null;
    if (ownRank === null) {
      values.pipeline_rank = null;
      values.pipeline_same_phase_n = null;
      values.ta_matches_company_focus = null;
    } else {
      let ahead = 0;
      let same = 0;
      const taCounts = new Map<string, number>();
      for (const s of siblingsAtAsOf) {
        const r = phaseRank(s.phase);
        if (r !== null) {
          if (r > ownRank) ahead++;
          else if (r === ownRank) same++;
        }
        if (s.therapeutic_area) taCounts.set(s.therapeutic_area, (taCounts.get(s.therapeutic_area) ?? 0) + 1);
      }
      if (asset.therapeutic_area) taCounts.set(asset.therapeutic_area, (taCounts.get(asset.therapeutic_area) ?? 0) + 1);
      values.pipeline_rank = ahead + 1;
      values.pipeline_same_phase_n = same;
      let modalTa: string | null = null;
      let modalN = 0;
      for (const [ta, n] of taCounts) if (n > modalN) { modalN = n; modalTa = ta; }
      values.ta_matches_company_focus = asset.therapeutic_area ? (modalTa === asset.therapeutic_area ? 1 : 0) : null;
    }
  }

  // ── Asset age and trial count ──
  if (firstPosted !== null) {
    values.asset_age_months = round2(clamp(monthsBetween(firstPosted, asOfMs), 0, 240));
    values.trial_count_at_asof = postedTrials.length;
  } else if (existedAtAsOf && fallbackPosted !== null) {
    values.asset_age_months = round2(clamp(monthsBetween(fallbackPosted, asOfMs), 0, 240));
    values.trial_count_at_asof = ok('company_trials') ? 0 : null;
  } else {
    values.asset_age_months = null;
    values.trial_count_at_asof = ok('company_trials') ? 0 : null;
  }

  let present = 0;
  for (const name of FEATURE_NAMES) if (values[name] !== null && values[name] !== undefined) present++;

  return {
    version: FEATURE_VERSION,
    as_of: isoDay(asOfMs),
    values,
    evidence,
    completeness: present / FEATURE_NAMES.length,
    eligible,
    phase_at_asof: effectivePhase,
    sources_failed: Array.from(failed).sort(),
  };
}

/** Vector values in FEATURE_NAMES order (for the model). */
export function vectorToRow(v: FeatureVector): (number | null)[] {
  return FEATURE_NAMES.map(name => v.values[name] ?? null);
}

// ═══════════════════════════════════════════════════════════════════════
// SUPABASE FETCHER — per company group, table-absence tolerant
// ═══════════════════════════════════════════════════════════════════════

export interface CompanyGroup {
  company_id: string | null;
  company_name: string;
  assets: FeatureAsset[];
}

export interface FetchBundleOptions {
  /** Rows dated after this are not fetched (default now). Filtering to <= asOf happens again in the pure builder. */
  asOf?: Date;
  /** How far back to pull press / intent / patents / deals (default 36 months; use 120 for backtests). */
  historyMonths?: number;
  /** Fetch per-asset publications (one query pair per asset). Default true. */
  includePublications?: boolean;
  /** Cache of terminated trials per indication_category shared across waves. */
  terminationCache?: Map<string, { rows: TrialRow[]; error?: string }>;
  /** Per-wave row caps. */
  maxRowsPerTable?: number;
}

export interface FetchBundlesResult {
  bundles: Map<string, FeatureBundle>;
  /** table → number of companies affected by a failed read. */
  sourceErrorCounts: Record<string, number>;
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
}

/**
 * Read one table for a wave. Any failure (missing table, RLS, timeout) is
 * returned as an error string, never thrown.
 */
async function readTable<T>(fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<{ rows: T[]; error?: string }> {
  try {
    const res = await fn();
    if (res.error) return { rows: [], error: res.error.message };
    return { rows: (res.data ?? []) as T[] };
  } catch (e) {
    return { rows: [], error: errText(e) };
  }
}

/** Empty result for a table that is skipped (e.g. no company ids in the wave). */
function none<T>(): Promise<{ rows: T[]; error?: string }> {
  return Promise.resolve({ rows: [] });
}

async function readPaged<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  max: number,
  page = 1000,
): Promise<{ rows: T[]; error?: string }> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += page) {
    const to = Math.min(from + page, max) - 1;
    const res = await readTable<T>(() => build(from, to));
    if (res.error) return { rows, error: res.error };
    rows.push(...res.rows);
    if (res.rows.length < to - from + 1) break;
  }
  return { rows };
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function fetchFeatureBundles(
  supabase: SupabaseClient,
  groups: CompanyGroup[],
  opts: FetchBundleOptions = {},
): Promise<FetchBundlesResult> {
  const asOf = opts.asOf ?? new Date();
  const historyMonths = opts.historyMonths ?? 36;
  const includePubs = opts.includePublications ?? true;
  const maxRows = opts.maxRowsPerTable ?? 5000;
  const sinceIso = new Date(asOf.getTime() - historyMonths * MS_PER_MONTH).toISOString();
  const sinceDay = sinceIso.slice(0, 10);
  const asOfIso = asOf.toISOString();
  const asOfDay = asOfIso.slice(0, 10);

  const companyIds = Array.from(new Set(groups.map(g => g.company_id).filter((x): x is string => !!x)));
  const companyNames = Array.from(new Set(groups.map(g => g.company_name).filter(Boolean)));
  const allAssets = groups.flatMap(g => g.assets);
  const assetIds = allAssets.map(a => a.id);
  const lowerNameToGroup = new Map(groups.map(g => [g.company_name.toLowerCase(), g] as const));
  const idToGroup = new Map(groups.filter(g => g.company_id).map(g => [g.company_id as string, g] as const));

  const bundles = new Map<string, FeatureBundle>();
  for (const a of allAssets) bundles.set(a.id, emptyFeatureBundle(a));
  const sourceErrorCounts: Record<string, number> = {};
  const failSource = (table: string, message: string, group?: CompanyGroup) => {
    const targets = group ? group.assets : allAssets;
    for (const a of targets) bundles.get(a.id)!.sourceErrors[table] = message;
    sourceErrorCounts[table] = (sourceErrorCounts[table] ?? 0) + (group ? 1 : groups.length);
  };
  const assignByCompany = <T extends { company_id?: string | null }>(table: string, res: { rows: T[]; error?: string }, put: (b: FeatureBundle, row: T) => void) => {
    if (res.error) { failSource(table, res.error); return; }
    for (const row of res.rows) {
      const g = row.company_id ? idToGroup.get(row.company_id) : undefined;
      if (!g) continue;
      for (const a of g.assets) put(bundles.get(a.id)!, row);
    }
  };

  // ── Company-keyed tables (one query per table per wave) ──
  const [finRes, intentRes, patentRes, trialsRes, dealsByIdRes, siblingsRes, ownerRes] = await Promise.all([
    companyIds.length
      ? readTable<FinancialRow & { company_id: string }>(() => supabase.from('company_financials')
          .select('company_id, fiscal_period_end, period_type, cash_and_equivalents, short_term_investments, total_liquidity, quarterly_burn, runway_months, going_concern, atm_or_shelf_filed, source_url, filed_at')
          .in('company_id', companyIds).lte('fiscal_period_end', asOfDay).order('fiscal_period_end', { ascending: false }).limit(maxRows))
      : none<FinancialRow & { company_id: string }>(),
    companyIds.length
      ? readTable<IntentSignalRow & { company_id: string }>(() => supabase.from('company_intent_signals')
          .select('company_id, signal_type, polarity, quote, source_url, observed_at, confidence')
          .in('company_id', companyIds).gte('observed_at', sinceIso).lte('observed_at', asOfIso).order('observed_at', { ascending: false }).limit(maxRows))
      : none<IntentSignalRow & { company_id: string }>(),
    companyIds.length
      ? readPaged<PatentRow & { company_id: string }>((from, to) => supabase.from('company_patents')
          .select('company_id, patent_id, filing_date, grant_date, drug_master_id, source_url')
          .in('company_id', companyIds).gte('filing_date', sinceDay).lte('filing_date', asOfDay).order('filing_date', { ascending: false }).range(from, to), maxRows)
      : none<PatentRow & { company_id: string }>(),
    companyIds.length
      ? readPaged<TrialRow & { company_id: string }>((from, to) => supabase.from('company_trials')
          .select('company_id, company_name, nct_id, phase, status, modality, indication_category, start_date, first_posted_date, primary_completion_date, completion_date, last_update_posted, why_stopped')
          .in('company_id', companyIds).order('first_posted_date', { ascending: false, nullsFirst: false }).range(from, to), maxRows)
      : none<TrialRow & { company_id: string }>(),
    companyIds.length
      ? readTable<CompanyDealRow & { licensor_id: string | null; licensor_name: string | null }>(() => supabase.from('deals')
          .select('id, licensor_id, licensor_name, announced_date, deal_type, asset_name, source_url')
          .in('licensor_id', companyIds).gte('announced_date', sinceDay).lte('announced_date', asOfDay)
          .or('is_canonical.is.null,is_canonical.eq.true')
          .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")')
          .order('announced_date', { ascending: false }).limit(maxRows))
      : none<CompanyDealRow & { licensor_id: string | null; licensor_name: string | null }>(),
    companyIds.length
      ? readPaged<SiblingAsset & { company_id: string }>((from, to) => supabase.from('clinical_assets')
          .select('id, company_id, phase, therapeutic_area, first_posted_date')
          .in('company_id', companyIds).range(from, to), maxRows)
      : none<SiblingAsset & { company_id: string }>(),
    companyIds.length
      ? readTable<{ id: string; owner_type: string | null }>(() => supabase.from('companies').select('id, owner_type').in('id', companyIds))
      : none<{ id: string; owner_type: string | null }>(),
  ]);

  assignByCompany('company_financials', finRes, (b, r) => { b.financials.push(r); });
  assignByCompany('company_intent_signals', intentRes, (b, r) => { b.intentSignals.push(r); });
  assignByCompany('company_patents', patentRes, (b, r) => { b.patents.push(r); });
  assignByCompany('company_trials', trialsRes, (b, r) => { b.companyTrials.push(r); });
  assignByCompany('clinical_assets', siblingsRes, (b, r) => { b.siblings.push(r); });
  if (ownerRes.error) {
    failSource('companies', ownerRes.error);
  } else {
    const ownerById = new Map(ownerRes.rows.map(r => [r.id, r.owner_type] as const));
    for (const a of allAssets) {
      if (a.company_id && !a.owner_type) a.owner_type = ownerById.get(a.company_id) ?? null;
    }
  }
  if (dealsByIdRes.error) {
    failSource('deals', dealsByIdRes.error);
  } else {
    for (const row of dealsByIdRes.rows) {
      const g = row.licensor_id ? idToGroup.get(row.licensor_id) : undefined;
      if (!g) continue;
      for (const a of g.assets) bundles.get(a.id)!.companyDeals.push(row);
    }
  }

  // Deals by licensor name for companies with no id (or unresolved licensor_id).
  const namesNeedingDeals = groups.filter(g => !g.company_id).map(g => g.company_name);
  if (namesNeedingDeals.length && !dealsByIdRes.error) {
    const res = await readTable<CompanyDealRow & { licensor_name: string | null }>(() => supabase.from('deals')
      .select('id, licensor_name, announced_date, deal_type, asset_name, source_url')
      .in('licensor_name', namesNeedingDeals).gte('announced_date', sinceDay).lte('announced_date', asOfDay)
      .or('is_canonical.is.null,is_canonical.eq.true')
      .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")')
      .limit(maxRows));
    if (res.error) {
      for (const g of groups.filter(g => !g.company_id)) failSource('deals', res.error, g);
    } else {
      for (const row of res.rows) {
        const g = lowerNameToGroup.get((row.licensor_name || '').toLowerCase());
        if (!g) continue;
        for (const a of g.assets) bundles.get(a.id)!.companyDeals.push(row);
      }
    }
  }

  // ── Asset-keyed: catalysts ──
  {
    const res = await readPaged<CatalystRow>((from, to) => supabase.from('asset_catalysts')
      .select('asset_id, company_id, catalyst_type, expected_date, observed_date, nct_id, source_url, confidence')
      .in('asset_id', assetIds).range(from, to), maxRows);
    if (res.error) failSource('asset_catalysts', res.error);
    else for (const row of res.rows) bundles.get(row.asset_id)?.catalysts.push(row);
  }

  // ── Press releases by company name (categories) ──
  {
    const res = await readPaged<PressRow & { companies_mentioned: string[] | null }>((from, to) => supabase.from('press_releases')
      .select('id, headline, published_at, source_url, categories, companies_mentioned')
      .overlaps('companies_mentioned', pgArrayLiteral(companyNames))
      .gte('published_at', sinceIso).lte('published_at', asOfIso)
      .order('published_at', { ascending: false }).range(from, to), maxRows);
    if (res.error) {
      failSource('press_releases', res.error);
    } else {
      for (const row of res.rows) {
        const seen = new Set<string>();
        for (const m of row.companies_mentioned ?? []) {
          const g = lowerNameToGroup.get((m || '').toLowerCase());
          if (!g || seen.has(g.company_name)) continue;
          seen.add(g.company_name);
          for (const a of g.assets) bundles.get(a.id)!.press.push(row);
        }
      }
    }
  }

  // ── Competitor terminations per indication (cached across waves) ──
  {
    const cache = opts.terminationCache ?? new Map<string, { rows: TrialRow[]; error?: string }>();
    const indications = Array.from(new Set(allAssets.map(a => a.indication_category).filter((x): x is string => !!x)));
    await mapConcurrent(indications.filter(i => !cache.has(i)), 4, async (ind) => {
      const res = await readTable<TrialRow>(() => supabase.from('company_trials')
        .select('company_id, company_name, nct_id, phase, status, modality, indication_category, primary_completion_date, completion_date, last_update_posted, why_stopped')
        .eq('indication_category', ind).in('status', ['terminated', 'withdrawn'])
        .order('last_update_posted', { ascending: false, nullsFirst: false }).limit(1000));
      cache.set(ind, res);
    });
    for (const a of allAssets) {
      if (!a.indication_category) continue;
      const entry = cache.get(a.indication_category);
      if (!entry) continue;
      const b = bundles.get(a.id)!;
      if (entry.error) { if (!b.sourceErrors.company_trials) b.sourceErrors.company_trials = entry.error; }
      else b.competitorTerminations = entry.rows;
    }
  }

  // ── Publications per asset ──
  if (includePubs) {
    await mapConcurrent(allAssets, 8, async (a) => {
      const name = a.asset_name.trim();
      if (name.length < 3) return;
      const pattern = `%${escapeLikePattern(name)}%`;
      const cols = 'id, title, published_date, source_url';
      const [t, ab] = await Promise.all([
        readTable<PublicationRow>(() => supabase.from('research_signals').select(cols).in('source_type', ['pubmed', 'preprint']).ilike('title', pattern).gte('published_date', sinceDay).lte('published_date', asOfDay).order('published_date', { ascending: false }).limit(50)),
        readTable<PublicationRow>(() => supabase.from('research_signals').select(cols).in('source_type', ['pubmed', 'preprint']).ilike('abstract', pattern).gte('published_date', sinceDay).lte('published_date', asOfDay).order('published_date', { ascending: false }).limit(50)),
      ]);
      const b = bundles.get(a.id)!;
      if (t.error || ab.error) {
        b.sourceErrors.research_signals = [t.error, ab.error].filter(Boolean).join('; ');
        sourceErrorCounts.research_signals = (sourceErrorCounts.research_signals ?? 0) + 1;
        return;
      }
      const map = new Map<string, PublicationRow>();
      for (const r of [...t.rows, ...ab.rows]) map.set(r.id, r);
      b.publications = Array.from(map.values());
    });
  }

  return { bundles, sourceErrorCounts };
}
