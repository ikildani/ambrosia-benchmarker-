/**
 * Asset Radar — Layer 2: Licensing Signal Detection (scoring v2)
 *
 * 9-factor weighted model that scores every clinical asset's licensing
 * likelihood (0-100). Each factor is an independent detector that reads
 * pre-fetched evidence — company profile, press releases, research signals
 * (patents, publications, NIH grants), competitor trial/deal failures — and
 * produces a sub-score with an evidence chain.
 *
 * Pipeline shape (v2):
 *   1. Pull the scoring queue ordered by clinical_assets.last_scored_at
 *      (NULLS FIRST). Layer 1 no longer shares the cursor.
 *   2. Group assets by company and fetch every per-company evidence set ONCE
 *      (companies row, 12 months of press releases, NIH grants, patents),
 *      per-indication competitor evidence once, and per-asset publications.
 *   3. Score each asset with pure, synchronous detectors + the pure
 *      aggregator `computeCompositeScore` (unit-testable without Supabase).
 *   4. Persist in batches: licensing_signals upsert on signal_hash (all nine
 *      factors every run, zero-score rows included), asset_signal_snapshots
 *      upsert on (asset_id, snapshot_date), clinical_assets upsert on id.
 *   5. Write one data_ingestion_log row via lib/radar/run-log.
 *
 * Score = Σ(factor_score × weight)  × phase prior × availability factor.
 * Weights sum to 1.0, so a fully evidenced, unpartnered Phase 2 asset reaches
 * 100. Evidence completeness is reported separately as score_confidence and
 * is NOT multiplied into the score (v1 did, which capped real-world scores
 * near 15 and made every asset look like "no signal").
 *
 * Run: daily at 8:00 AM UTC via /api/cron/licensing-signals
 * Depends on: asset-universe (6:30 AM) running first
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export type SignalType =
  | 'cash_runway'
  | 'bd_executive_hire'
  | 'conference_activity'
  | 'regulatory_milestone'
  | 'competitor_failure'
  | 'management_commentary'
  | 'patent_filing'
  | 'publication_velocity'
  | 'strategic_review';

export const SIGNAL_TYPES: readonly SignalType[] = [
  'cash_runway',
  'bd_executive_hire',
  'conference_activity',
  'regulatory_milestone',
  'competitor_failure',
  'management_commentary',
  'patent_filing',
  'publication_velocity',
  'strategic_review',
];

/** Tables/sources a detector can read. Used for error attribution and evidence text. */
export type EvidenceSource =
  | 'companies'
  | 'press_releases'
  | 'research_signals'
  | 'clinical_assets'
  | 'company_trials'
  | 'deals';

export interface SignalFactor {
  type: SignalType;
  /** 0-100 factor score. */
  score: number;
  /** 0-100 evidence completeness for this factor. 0 = nothing found / source failed. */
  confidence: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  evidence: string;
  evidenceUrl?: string;
  evidenceSource?: string;
  evidenceDate?: string;
  metadata?: Record<string, unknown>;
  /** Stable identifier of the evidence set (source row ids), used for signal_hash. */
  evidenceKey?: string;
  /** Sources this detector consulted (whether or not they returned rows). */
  sourcesChecked?: EvidenceSource[];
  /** Set when one of the detector's sources failed to load. */
  error?: string;
}

export interface AssetForScoring {
  id: string;
  company_id: string | null;
  company_name: string;
  asset_name: string;
  modality: string | null;
  therapeutic_area: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  phase: string | null;
  trial_status: string | null;
  partnership_status: string | null;
  nct_ids: string[];
  trial_count: number;
  confidence_score: number;
  licensing_intent_score: number;
  regulatory_designations?: string[] | null;
  territory_rights_available?: string[] | null;
}

export type Trend = 'surging' | 'rising' | 'stable' | 'cooling' | 'declining';

export interface CompositeScore {
  /** Final 0-100 licensing intent score (rounded once, at the end). */
  score: number;
  /** 0-100 evidence completeness (weight-averaged factor confidence). */
  confidence: number;
  /** Σ score×weight before phase/availability adjustment (0-100, unrounded). */
  rawWeighted: number;
  phaseMultiplier: number;
  availabilityFactor: number;
}

export interface ScoringResult {
  assetId: string;
  licensingIntentScore: number;
  scoreConfidence: number;
  competitiveHeat: number;
  dealReadinessScore: number;
  factors: SignalFactor[];
  composite: CompositeScore;
  trend: Trend;
  scoreDelta: number;
  scoreDelta7d: number | null;
  scoreDelta30d: number | null;
  signalsInserted: number;
}

export interface DetectionResult {
  /** Assets pulled from the queue this run. */
  assetsQueued: number;
  assetsScored: number;
  assetsFailed: number;
  /** Factors with score > 0 across scored assets. */
  signalsDetected: number;
  /** licensing_signals rows upserted (all nine factors per scored asset). */
  signalsInserted: number;
  snapshotsTaken: number;
  errors: string[];
  timedOut: boolean;
  /** Per-factor count of assets where the factor scored > 0. */
  factorNonZero: Record<SignalType, number>;
  /** Per-factor count of assets where a source query failed. */
  factorErrors: Record<SignalType, number>;
  durationMs: number;
  /** false when the data_ingestion_log insert itself failed. */
  logged: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR WEIGHTS — single source of truth (sum = 1.0)
// Tuned against 378 historical out-licensing events. Do not change the
// values without re-running the backtest.
// ═══════════════════════════════════════════════════════════════════════

export const FACTOR_WEIGHTS: Readonly<Record<SignalType, number>> = Object.freeze({
  cash_runway:           0.18,
  regulatory_milestone:  0.16,
  competitor_failure:    0.14,
  management_commentary: 0.12,
  strategic_review:      0.11,
  patent_filing:         0.09,
  publication_velocity:  0.07,
  conference_activity:   0.07,
  bd_executive_hire:     0.06,
});

// ═══════════════════════════════════════════════════════════════════════
// PHASE PRIOR — probability that an asset at this stage is *the subject of
// an out-licensing process*, relative to Phase 2 (= 1.00).
//
// Why Phase 2 sits at the top: licensing deal volume peaks right after the
// Phase 2 readout. Proof-of-concept data has de-risked the asset for the
// buyer, while the originator now faces Phase 3 capital needs it usually
// cannot fund alone. Phase 2 is the modal phase-at-signing in the Solidus
// deal database.
//
// Phase 3 below Phase 2: an asset still unpartnered in Phase 3 is often
// already funded for self-commercialization, and Phase 3 deals are rarer
// (buyers who wanted it moved earlier; the rest wait for approval/M&A).
//
// Phase 1 below Phase 3: platform and early deals happen, but most buyers
// wait for human PoC, so licensing *intent* is expressed less often.
//
// Approved / Phase 4 lowest: commercial assets are licensed mainly as
// regional or territory carve-outs; global out-licensing intent is minimal.
//
// Preclinical/discovery are normally excluded by the confidence gate but are
// listed for completeness. Unknown phase gets a mild haircut.
// ═══════════════════════════════════════════════════════════════════════

export const PHASE_PRIOR: Readonly<Record<string, number>> = Object.freeze({
  'phase2': 1.00,          'phase_2': 1.00,
  'phase2_phase3': 1.00,   'phase_2_3': 1.00,
  'phase1_phase2': 0.90,   'phase_1_2': 0.90,
  'phase3': 0.90,          'phase_3': 0.90,
  'phase1': 0.80,          'phase_1': 0.80,
  'early_phase1': 0.70,
  'phase4': 0.60,          'phase_4': 0.60,
  'approved': 0.50,
  'preclinical': 0.50,
  'discovery': 0.30,
});

export const DEFAULT_PHASE_PRIOR = 0.85;

// ═══════════════════════════════════════════════════════════════════════
// AVAILABILITY FACTOR — is there anything left to license?
// Partnered assets still emit signals (the *company* may be distressed) but
// the asset itself is not on the market, so the composite is cut to 10%.
// ═══════════════════════════════════════════════════════════════════════

export const AVAILABILITY_FACTOR: Readonly<Record<string, number>> = Object.freeze({
  unpartnered:         1.00,
  partially_partnered: 0.50,
  partnered:           0.10,
  unknown:             0.85,
});

/**
 * Approximate share of global licensing value by territory. Used to weight
 * `partially_partnered` assets when territory_rights_available is populated.
 */
export const TERRITORY_SHARE: Readonly<Record<string, number>> = Object.freeze({
  global: 1.00, worldwide: 1.00, ww: 1.00,
  us: 0.45, usa: 0.45, united_states: 0.45, north_america: 0.50, na: 0.50,
  ex_us: 0.55, 'ex-us': 0.55, exus: 0.55,
  europe: 0.25, eu: 0.25, emea: 0.28, uk: 0.05,
  japan: 0.12, jp: 0.12,
  china: 0.12, cn: 0.12, greater_china: 0.13,
  asia: 0.20, apac: 0.22, asia_pacific: 0.22, korea: 0.03, south_korea: 0.03,
  latam: 0.04, latin_america: 0.04, row: 0.10, rest_of_world: 0.10,
  canada: 0.03, australia: 0.02, middle_east: 0.02, africa: 0.01, india: 0.02,
});

// ═══════════════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════════════

export function normalizePhase(phase: string | null | undefined): string {
  return (phase || '').toLowerCase().replace(/\s+/g, '').replace(/-/g, '_');
}

export function phasePrior(phase: string | null | undefined): number {
  const key = normalizePhase(phase);
  return key ? (PHASE_PRIOR[key] ?? DEFAULT_PHASE_PRIOR) : DEFAULT_PHASE_PRIOR;
}

function normalizeTerritory(t: string): string {
  return t.toLowerCase().trim().replace(/[\s-]+/g, '_');
}

/**
 * Availability multiplier for the composite score.
 * partnered → 0.1, unpartnered → 1.0, partially_partnered → territory-weighted
 * when territory_rights_available is populated (clamped to [0.25, 1.0]),
 * otherwise 0.5. Unknown/null → 0.85.
 */
export function availabilityFactor(
  partnershipStatus: string | null | undefined,
  territoryRightsAvailable?: string[] | null,
): number {
  const status = (partnershipStatus || 'unknown').toLowerCase();
  if (status === 'partially_partnered') {
    const territories = (territoryRightsAvailable ?? []).map(normalizeTerritory).filter(Boolean);
    if (territories.length === 0) return AVAILABILITY_FACTOR.partially_partnered;
    let share = 0;
    let recognized = 0;
    for (const t of territories) {
      const s = TERRITORY_SHARE[t];
      if (s !== undefined) { share += s; recognized++; }
    }
    if (recognized === 0) return AVAILABILITY_FACTOR.partially_partnered;
    return Math.min(1, Math.max(0.25, share));
  }
  return AVAILABILITY_FACTOR[status] ?? AVAILABILITY_FACTOR.unknown;
}

/**
 * Escape a user/DB-derived string for use inside a PostgREST `ilike`
 * pattern. `%`, `_` and `\` are LIKE metacharacters. PostgREST rewrites `*`
 * to `%` before it reaches SQL and cannot be backslash-escaped, so `*` is
 * mapped to the single-character wildcard `_` (still matches the literal).
 * Commas and parentheses only matter inside `.or()` strings, which this
 * module no longer builds — every filter is a per-column `.ilike()` call.
 */
export function escapeLikePattern(str: string): string {
  return str.replace(/[\\%_]/g, '\\$&').replace(/\*/g, '_');
}

function computeSignalHash(assetId: string, type: SignalType, evidenceKey: string): string {
  return createHash('sha256')
    .update(`${assetId}:${type}:${evidenceKey}`)
    .digest('hex')
    .slice(0, 32);
}

function evidenceKeyFromIds(ids: string[]): string {
  if (ids.length === 0) return 'none';
  return Array.from(new Set(ids)).sort().slice(0, 8).join(',');
}

function monthsAgo(n: number, from = new Date()): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() - n);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function containsName(haystack: string, name: string): boolean {
  const needle = name.trim().toLowerCase();
  if (needle.length < 3) return false;
  return haystack.toLowerCase().includes(needle);
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

// ═══════════════════════════════════════════════════════════════════════
// EVIDENCE BUNDLES (pre-fetched once per company / indication / asset)
// ═══════════════════════════════════════════════════════════════════════

export interface CompanyData {
  name: string;
  company_type: string | null;
  deals_last_12mo: number;
  deals_last_24mo: number;
  actively_acquiring: boolean;
  acquisition_appetite: string | null;
  hiring_bd_roles: boolean;
  strategic_priorities: string[];
  data_quality_score: number;
  revenue_at_risk_2025: number;
  revenue_at_risk_2026: number;
  revenue_at_risk_2027: number;
}

export interface PressReleaseRow {
  id: string;
  headline: string;
  body_text: string | null;
  published_at: string;
  source_url: string | null;
}

export interface ResearchRow {
  id: string;
  title: string;
  published_date: string | null;
  source_url: string | null;
  therapeutic_area: string | null;
  journal?: string | null;
  funding_amount_usd?: number | null;
}

export interface CompanyEvidence {
  company: CompanyData;
  companyFound: boolean;
  /** Last 12 months, newest first. Detectors narrow to their own window. */
  pressReleases: PressReleaseRow[];
  nihGrants: ResearchRow[];
  patents: ResearchRow[];
  errors: Partial<Record<EvidenceSource, string>>;
}

export interface IndicationEvidence {
  failedAssets: Array<{ id: string; company_name: string; asset_name: string; modality: string | null }>;
  failedTrials: Array<{ id: string; company_name: string | null }>;
  terminatedDeals: Array<{ id: string; licensor_name: string | null }>;
  errors: Partial<Record<EvidenceSource, string>>;
}

export interface AssetEvidence {
  publications: ResearchRow[];
  /** Publications in the asset's TA over 6 months (only fetched when no asset pubs). */
  taPublicationCount: number | null;
  errors: Partial<Record<EvidenceSource, string>>;
}

export interface EvidenceBundle {
  company: CompanyEvidence;
  indication: IndicationEvidence;
  asset: AssetEvidence;
  now: Date;
}

function emptyCompanyData(name: string): CompanyData {
  return {
    name,
    company_type: null,
    deals_last_12mo: 0,
    deals_last_24mo: 0,
    actively_acquiring: true,
    acquisition_appetite: null,
    hiring_bd_roles: false,
    strategic_priorities: [],
    data_quality_score: 0,
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 0,
  };
}

export function emptyEvidence(companyName: string, now = new Date()): EvidenceBundle {
  return {
    company: { company: emptyCompanyData(companyName), companyFound: false, pressReleases: [], nihGrants: [], patents: [], errors: {} },
    indication: { failedAssets: [], failedTrials: [], terminatedDeals: [], errors: {} },
    asset: { publications: [], taPublicationCount: null, errors: {} },
    now,
  };
}

/** Apply "source failed" semantics uniformly: keep the score, zero the confidence, flag it. */
function applySourceErrors(
  factor: SignalFactor,
  sources: EvidenceSource[],
  errors: Array<Partial<Record<EvidenceSource, string>>>,
): SignalFactor {
  const failed: string[] = [];
  for (const src of sources) {
    for (const errMap of errors) {
      const msg = errMap[src];
      if (msg) failed.push(`${src}: ${msg}`);
    }
  }
  factor.sourcesChecked = sources;
  if (failed.length === 0) {
    if (factor.score === 0 && factor.confidence === 0) {
      factor.evidence = `No evidence found (checked ${sources.length} source${sources.length === 1 ? '' : 's'}: ${sources.join(', ')})`;
    }
    return factor;
  }
  factor.confidence = 0;
  factor.error = failed.join(' | ');
  const note = `Source query failed (${failed.join('; ')})`;
  factor.evidence = (factor.evidence ? `${factor.evidence} — ${note}` : note).slice(0, 2000);
  return factor;
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 1: CASH RUNWAY PRESSURE (18%)
// Low cash + high burn → company must out-license or die.
// Sources: companies (patent cliffs, deal cadence, acquirer posture), NIH grants.
// ═══════════════════════════════════════════════════════════════════════

export function detectCashRunway(asset: AssetForScoring, ev: EvidenceBundle): SignalFactor {
  const companyData = ev.company.company;
  let score = 0;
  const evidenceParts: string[] = [];
  const ids: string[] = [];

  if (ev.company.companyFound) ids.push(`companies:${companyData.name}`);

  const revAtRisk = Math.max(
    companyData.revenue_at_risk_2025 || 0,
    companyData.revenue_at_risk_2026 || 0,
    companyData.revenue_at_risk_2027 || 0,
  );
  if (revAtRisk > 5000) {
    score += 30;
    evidenceParts.push(`$${(revAtRisk / 1000).toFixed(1)}B revenue at risk from patent cliffs`);
  } else if (revAtRisk > 1000) {
    score += 20;
    evidenceParts.push(`$${revAtRisk.toFixed(0)}M revenue at risk`);
  } else if (revAtRisk > 0) {
    score += 10;
    evidenceParts.push(`$${revAtRisk.toFixed(0)}M revenue at risk`);
  }

  if (
    companyData.company_type &&
    ['mid_biotech', 'specialty'].includes(companyData.company_type) &&
    companyData.deals_last_24mo === 0
  ) {
    score += 25;
    evidenceParts.push('Mid/small biotech with zero deals in 24mo — likely capital-constrained');
  }

  // Recent NIH funding extends runway → lower signal
  let evidenceUrl: string | undefined;
  let evidenceDate: string | undefined;
  if (ev.company.nihGrants.length > 0) {
    const totalFunding = ev.company.nihGrants.reduce((sum, r) => sum + (r.funding_amount_usd || 0), 0);
    if (totalFunding > 10_000_000) {
      score = Math.max(score - 15, 0);
      evidenceParts.push(`Recent NIH funding: $${(totalFunding / 1_000_000).toFixed(1)}M (extends runway)`);
      for (const g of ev.company.nihGrants) ids.push(g.id);
      evidenceUrl = ev.company.nihGrants[0].source_url || undefined;
      evidenceDate = ev.company.nihGrants[0].published_date || undefined;
    }
  }

  if (ev.company.companyFound && companyData.deals_last_12mo === 0 && companyData.deals_last_24mo <= 1) {
    score += 15;
    evidenceParts.push('Minimal recent deal activity — may need partner for commercialization');
  }

  if (ev.company.companyFound && (companyData.acquisition_appetite === 'inactive' || !companyData.actively_acquiring)) {
    score += 20;
    evidenceParts.push('Company flagged as inactive acquirer — likely in out-licensing mode');
  }

  const hasEvidence = evidenceParts.length > 0;
  const factor: SignalFactor = {
    type: 'cash_runway',
    score: Math.min(score, 100),
    confidence: !hasEvidence ? 0 : companyData.data_quality_score > 50 ? 70 : 40,
    direction: score >= 40 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; '),
    evidenceSource: 'companies,research_signals',
    evidenceUrl,
    evidenceDate,
    evidenceKey: evidenceKeyFromIds(hasEvidence ? ids : []),
    metadata: { company_found: ev.company.companyFound, nih_grants: ev.company.nihGrants.length },
  };
  return applySourceErrors(factor, ['companies', 'research_signals'], [ev.company.errors]);
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 2: BD EXECUTIVE HIRING (6%)
// New BD/licensing hires signal deal intent.
// Sources: companies.hiring_bd_roles, press_releases with hiring keywords.
// ═══════════════════════════════════════════════════════════════════════

const BD_KEYWORDS = [
  'business development', 'chief business officer', 'licensing',
  'corporate development', 'strategic partnerships', 'vp of bd',
  'head of partnerships', 'alliance management',
];

const PARTNER_PRIORITY_KEYWORDS = ['partner', 'licens', 'collaborat', 'out-licens', 'co-develop'];

export function detectBDHiring(asset: AssetForScoring, ev: EvidenceBundle): SignalFactor {
  const companyData = ev.company.company;
  let score = 0;
  const evidenceParts: string[] = [];
  const ids: string[] = [];

  if (companyData.hiring_bd_roles) {
    score += 40;
    evidenceParts.push('Active BD/licensing hiring detected');
    ids.push(`companies:${companyData.name}`);
  }

  const sixMonthsAgo = monthsAgo(6, ev.now);
  const bdPRs = ev.company.pressReleases.filter(pr =>
    new Date(pr.published_at) >= sixMonthsAgo &&
    BD_KEYWORDS.some(kw => pr.headline.toLowerCase().includes(kw))
  );

  if (bdPRs.length >= 3) {
    score += 40;
    evidenceParts.push(`${bdPRs.length} BD-related press releases in 6mo — heavy BD activity`);
  } else if (bdPRs.length >= 1) {
    score += 20;
    evidenceParts.push(`${bdPRs.length} BD-related press release(s): "${bdPRs[0].headline}"`);
  }
  for (const pr of bdPRs) ids.push(pr.id);

  const hasPartnerPriority = companyData.strategic_priorities?.some(
    p => PARTNER_PRIORITY_KEYWORDS.some(kw => p.toLowerCase().includes(kw))
  );
  if (hasPartnerPriority) {
    score += 20;
    evidenceParts.push('Strategic priorities include partnership/licensing language');
    ids.push(`companies:${companyData.name}:priorities`);
  }

  const hasEvidence = evidenceParts.length > 0;
  const factor: SignalFactor = {
    type: 'bd_executive_hire',
    score: Math.min(score, 100),
    confidence: hasEvidence ? 60 : 0,
    direction: score >= 30 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; '),
    evidenceSource: 'companies,press_releases',
    evidenceUrl: bdPRs[0]?.source_url || undefined,
    evidenceDate: bdPRs[0] ? isoDate(new Date(bdPRs[0].published_at)) : undefined,
    evidenceKey: evidenceKeyFromIds(hasEvidence ? ids : []),
    metadata: { bd_press_releases: bdPRs.length },
  };
  return applySourceErrors(factor, ['companies', 'press_releases'], [ev.company.errors]);
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 3: CONFERENCE ACTIVITY (7%)
// Presenting at major conferences = asset gaining visibility for deals.
// Sources: press_releases (conference mentions).
// ═══════════════════════════════════════════════════════════════════════

const MAJOR_CONFERENCES = [
  'asco', 'aacr', 'esmo', 'ash', 'sabcs', 'aha', 'acc', 'wclc',
  'aasld', 'acr', 'ean', 'ada', 'easl', 'eha', 'isth', 'aanem',
  'sitc', 'pegs', 'bio international', 'jpm', 'jpmorgan',
  'roth', 'cowen', 'goldman', 'needham', 'leerink', 'piper',
  'world orphan drug congress', 'rare disease', 'pharm', 'dpharm',
  'bio-europe', 'bioeurope', 'bio europe', 'chinabio', 'lsx',
];

export function detectConferenceActivity(asset: AssetForScoring, ev: EvidenceBundle): SignalFactor {
  let score = 0;
  const evidenceParts: string[] = [];
  const sixMonthsAgo = monthsAgo(6, ev.now);

  const conferencePRs = ev.company.pressReleases.filter(pr => {
    if (new Date(pr.published_at) < sixMonthsAgo) return false;
    const h = pr.headline.toLowerCase();
    return MAJOR_CONFERENCES.some(c => h.includes(c)) ||
      h.includes('poster') || h.includes('oral presentation') ||
      h.includes('late-breaking') || h.includes('abstract');
  });

  const assetConferencePRs = conferencePRs.filter(pr => containsName(pr.headline, asset.asset_name));

  if (assetConferencePRs.length >= 2) {
    score += 50;
    evidenceParts.push(`${assetConferencePRs.length} conference presentations specifically for ${asset.asset_name}`);
  } else if (assetConferencePRs.length === 1) {
    score += 30;
    evidenceParts.push(`Conference presentation: "${assetConferencePRs[0].headline}"`);
  }

  if (conferencePRs.length >= 5 && assetConferencePRs.length === 0) {
    score += 15;
    evidenceParts.push(`${conferencePRs.length} total conference presentations — active BD posture`);
  }

  const highImpact = conferencePRs.filter(pr => {
    const h = pr.headline.toLowerCase();
    return h.includes('late-breaking') || h.includes('oral presentation') || h.includes('plenary');
  });
  if (highImpact.length > 0) {
    score += 20;
    evidenceParts.push(`${highImpact.length} high-impact presentation(s) (oral/late-breaking)`);
  }

  const hasEvidence = evidenceParts.length > 0;
  const top = assetConferencePRs[0] ?? highImpact[0] ?? conferencePRs[0];
  const factor: SignalFactor = {
    type: 'conference_activity',
    score: Math.min(score, 100),
    confidence: hasEvidence ? 55 : 0,
    direction: score >= 30 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; '),
    evidenceSource: 'press_releases',
    evidenceUrl: top?.source_url || undefined,
    evidenceDate: top ? isoDate(new Date(top.published_at)) : undefined,
    evidenceKey: evidenceKeyFromIds(hasEvidence ? conferencePRs.map(p => p.id) : []),
    metadata: { conference_press_releases: conferencePRs.length, asset_specific: assetConferencePRs.length },
  };
  return applySourceErrors(factor, ['press_releases'], [ev.company.errors]);
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 4: REGULATORY MILESTONES (16%)
// Breakthrough designation, fast track, positive readouts = deal catalyst.
// Sources: clinical_assets (designations, phase, trial count), press_releases.
// ═══════════════════════════════════════════════════════════════════════

const REGULATORY_KEYWORDS = [
  'breakthrough therapy', 'fast track', 'priority review',
  'accelerated approval', 'orphan drug', 'rare pediatric',
  'regenerative medicine advanced therapy', 'rmat',
  'positive results', 'met primary endpoint', 'statistically significant',
  'pivotal', 'registration-enabling', 'pdufa', 'nda', 'bla',
  'complete response', 'accepted for review', 'filing accepted',
];

const LATE_STAGE_PHASES = ['phase2', 'phase_2', 'phase2_phase3', 'phase_2_3', 'phase3', 'phase_3'];

export function detectRegulatoryMilestones(asset: AssetForScoring, ev: EvidenceBundle): SignalFactor {
  let score = 0;
  const evidenceParts: string[] = [];
  const ids: string[] = [];

  const desigs = asset.regulatory_designations ?? [];
  const highValue = desigs.filter(d =>
    ['breakthrough', 'fast_track', 'priority_review', 'orphan_drug', 'rmat'].some(k => d.toLowerCase().includes(k))
  );
  if (highValue.length > 0) {
    score += 35;
    evidenceParts.push(`Regulatory designations: ${highValue.join(', ')}`);
    ids.push(`clinical_assets:${asset.id}:designations`);
  }

  if (asset.trial_status === 'active' && LATE_STAGE_PHASES.includes(normalizePhase(asset.phase))) {
    score += 20;
    const phaseDisplay = (asset.phase || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    evidenceParts.push(`Active ${phaseDisplay} trials — progressing through late-stage development`);
    ids.push(`clinical_assets:${asset.id}:active_late_stage`);
  }

  const threeMonthsAgo = monthsAgo(3, ev.now);
  const regPRs = ev.company.pressReleases.filter(pr => {
    if (new Date(pr.published_at) < threeMonthsAgo) return false;
    const h = pr.headline.toLowerCase();
    return containsName(h, asset.asset_name) && REGULATORY_KEYWORDS.some(kw => h.includes(kw));
  });

  for (const pr of regPRs.slice(0, 3)) {
    const h = pr.headline.toLowerCase();
    if (h.includes('breakthrough therapy') || h.includes('met primary endpoint')) {
      score += 30;
      evidenceParts.push(`Major milestone: "${pr.headline}"`);
    } else if (h.includes('fast track') || h.includes('priority review') || h.includes('pivotal')) {
      score += 20;
      evidenceParts.push(`Regulatory advance: "${pr.headline}"`);
    } else {
      score += 10;
      evidenceParts.push(`Regulatory signal: "${pr.headline}"`);
    }
    ids.push(pr.id);
  }

  if (asset.trial_count >= 5) {
    score += 15;
    evidenceParts.push(`${asset.trial_count} clinical trials — robust development program`);
    ids.push(`clinical_assets:${asset.id}:trials`);
  } else if (asset.trial_count >= 3) {
    score += 8;
    evidenceParts.push(`${asset.trial_count} clinical trials across indications`);
    ids.push(`clinical_assets:${asset.id}:trials`);
  }

  const hasEvidence = evidenceParts.length > 0;
  const factor: SignalFactor = {
    type: 'regulatory_milestone',
    score: Math.min(score, 100),
    confidence: hasEvidence ? 75 : 0,
    direction: score >= 30 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; '),
    evidenceSource: 'clinical_assets,press_releases',
    evidenceUrl: regPRs[0]?.source_url || undefined,
    evidenceDate: regPRs[0] ? isoDate(new Date(regPRs[0].published_at)) : undefined,
    evidenceKey: evidenceKeyFromIds(hasEvidence ? ids : []),
    metadata: { designations: highValue, regulatory_press_releases: regPRs.length },
  };
  return applySourceErrors(factor, ['clinical_assets', 'press_releases'], [ev.company.errors]);
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 5: COMPETITOR FAILURE (14%)
// When a rival asset in the same indication fails, opportunity opens.
// Sources: clinical_assets (failed rivals), company_trials (terminated), deals (terminated).
// ═══════════════════════════════════════════════════════════════════════

export function detectCompetitorFailure(asset: AssetForScoring, ev: EvidenceBundle): SignalFactor {
  if (!asset.indication_category) {
    return {
      type: 'competitor_failure',
      score: 0,
      confidence: 0,
      direction: 'neutral',
      evidence: 'No indication data — cannot assess competitor landscape',
      evidenceSource: 'clinical_assets,company_trials,deals',
      evidenceKey: 'none',
      sourcesChecked: [],
      metadata: { reason: 'missing_indication_category' },
    };
  }

  let score = 0;
  const evidenceParts: string[] = [];
  const ids: string[] = [];
  const failedCompetitors = new Set<string>();
  const ownName = asset.company_name.toLowerCase();

  const failedAssets = ev.indication.failedAssets.filter(fa => fa.company_name.toLowerCase() !== ownName);
  const failedTrials = ev.indication.failedTrials.filter(ft => (ft.company_name || '').toLowerCase() !== ownName);
  const terminatedDeals = ev.indication.terminatedDeals.filter(d => (d.licensor_name || '').toLowerCase() !== ownName);

  for (const fa of failedAssets) { failedCompetitors.add(fa.company_name); ids.push(fa.id); }
  for (const ft of failedTrials) { if (ft.company_name) failedCompetitors.add(ft.company_name); ids.push(ft.id); }

  if (failedCompetitors.size >= 3) {
    score += 50;
    evidenceParts.push(`${failedCompetitors.size} competitors failed/terminated in ${asset.indication_category} — major opportunity`);
  } else if (failedCompetitors.size >= 1) {
    score += 25;
    evidenceParts.push(`${failedCompetitors.size} competitor(s) failed in ${asset.indication_category}: ${Array.from(failedCompetitors).slice(0, 3).join(', ')}`);
  }

  if (terminatedDeals.length > 0) {
    score += 20;
    evidenceParts.push(`${terminatedDeals.length} terminated deal(s) in ${asset.indication_category} — rights may be available`);
    for (const d of terminatedDeals) ids.push(d.id);
  }

  if (asset.modality) {
    const direct = failedAssets.filter(fa => fa.modality === asset.modality);
    if (direct.length > 0) {
      score += 15;
      evidenceParts.push(`${direct.length} direct competitor(s) (same modality) failed`);
    }
  }

  const hasEvidence = evidenceParts.length > 0;
  const factor: SignalFactor = {
    type: 'competitor_failure',
    score: Math.min(score, 100),
    confidence: !hasEvidence ? 0 : failedCompetitors.size > 0 ? 65 : 45,
    direction: score >= 30 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; '),
    evidenceSource: 'clinical_assets,company_trials,deals',
    evidenceKey: evidenceKeyFromIds(hasEvidence ? ids : []),
    metadata: {
      indication_category: asset.indication_category,
      failed_competitors: Array.from(failedCompetitors).slice(0, 10),
      terminated_deals: terminatedDeals.length,
    },
  };
  return applySourceErrors(factor, ['clinical_assets', 'company_trials', 'deals'], [ev.indication.errors]);
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 6: MANAGEMENT COMMENTARY (12%)
// CEO/CSO language about "exploring partnerships", "strategic options".
// Sources: press_releases (headline + body), companies.strategic_priorities.
// ═══════════════════════════════════════════════════════════════════════

const PARTNERSHIP_LANGUAGE = [
  'exploring strategic', 'seeking partner', 'out-licens',
  'looking for partner', 'global rights available', 'commercialization partner',
  'regional partner', 'co-development', 'strategic collaboration',
  'evaluating options', 'non-core asset', 'portfolio prioritization',
  'refocusing pipeline', 'streamlining', 'divesting', 'divestiture',
];

const ANTI_PARTNERSHIP_LANGUAGE = [
  'go it alone', 'retain all rights', 'self-commercialize',
  'own commercial', 'no plans to partner', 'maintaining full rights',
  'sole rights', 'independently develop',
];

export function detectManagementCommentary(asset: AssetForScoring, ev: EvidenceBundle): SignalFactor {
  const companyData = ev.company.company;
  let score = 0;
  const evidenceParts: string[] = [];
  const ids: string[] = [];
  const twelveMonthsAgo = monthsAgo(12, ev.now);

  let partnerMentions = 0;
  let antiPartnerMentions = 0;
  let assetSpecificMentions = 0;
  let topPR: PressReleaseRow | undefined;

  for (const pr of ev.company.pressReleases) {
    if (new Date(pr.published_at) < twelveMonthsAgo) continue;
    const text = `${pr.headline} ${pr.body_text || ''}`.toLowerCase();
    const mentionsAsset = containsName(text, asset.asset_name);
    const hasPartnerLanguage = PARTNERSHIP_LANGUAGE.some(kw => text.includes(kw));
    const hasAntiPartnerLanguage = ANTI_PARTNERSHIP_LANGUAGE.some(kw => text.includes(kw));

    if (hasPartnerLanguage) {
      partnerMentions++;
      ids.push(pr.id);
      if (mentionsAsset) {
        assetSpecificMentions++;
        if (!topPR) topPR = pr;
        evidenceParts.push(`Asset-specific partnership language: "${pr.headline}"`);
      } else if (!topPR) {
        topPR = pr;
      }
    }
    if (hasAntiPartnerLanguage && mentionsAsset) {
      antiPartnerMentions++;
      ids.push(pr.id);
    }
  }

  if (assetSpecificMentions >= 2) {
    score += 60;
    evidenceParts.push(`${assetSpecificMentions} press releases mention ${asset.asset_name} with partnership language`);
  } else if (assetSpecificMentions === 1) {
    score += 35;
  }

  if (partnerMentions >= 5 && assetSpecificMentions === 0) {
    score += 25;
    evidenceParts.push(`${partnerMentions} company-level partnership mentions in 12mo`);
  } else if (partnerMentions >= 2 && assetSpecificMentions === 0) {
    score += 15;
    evidenceParts.push(`${partnerMentions} partnership-related announcements`);
  }

  if (antiPartnerMentions > 0) {
    score = Math.max(score - 30, 0);
    evidenceParts.push(`Anti-partnership language detected (${antiPartnerMentions} mentions) — may retain rights`);
  }

  if (companyData.strategic_priorities?.length > 0) {
    const prioText = companyData.strategic_priorities.join(' ').toLowerCase();
    if (PARTNERSHIP_LANGUAGE.some(kw => prioText.includes(kw))) {
      score += 15;
      evidenceParts.push('Company strategic priorities reference partnership/licensing');
      ids.push(`companies:${companyData.name}:priorities`);
    }
  }

  const hasEvidence = evidenceParts.length > 0;
  const factor: SignalFactor = {
    type: 'management_commentary',
    score: Math.min(score, 100),
    confidence: hasEvidence ? 60 : 0,
    direction: antiPartnerMentions > 0 && score < 30 ? 'bearish' : score >= 30 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; '),
    evidenceSource: 'press_releases,companies',
    evidenceUrl: topPR?.source_url || undefined,
    evidenceDate: topPR ? isoDate(new Date(topPR.published_at)) : undefined,
    evidenceKey: evidenceKeyFromIds(hasEvidence ? ids : []),
    metadata: { partner_mentions: partnerMentions, asset_specific: assetSpecificMentions, anti_partner: antiPartnerMentions },
  };
  return applySourceErrors(factor, ['press_releases', 'companies'], [ev.company.errors]);
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 7: PATENT FILINGS (9%)
// Recent patent activity around an asset → IP being built for deal.
// Sources: research_signals (source_type = patent).
// ═══════════════════════════════════════════════════════════════════════

export function detectPatentActivity(asset: AssetForScoring, ev: EvidenceBundle): SignalFactor {
  const patents = ev.company.patents;
  let score = 0;
  const evidenceParts: string[] = [];

  const assetPatents = patents.filter(p => containsName(p.title, asset.asset_name));

  if (assetPatents.length >= 3) {
    score += 50;
    evidenceParts.push(`${assetPatents.length} patents specifically covering ${asset.asset_name} — strong IP build-out`);
  } else if (assetPatents.length >= 1) {
    score += 25;
    evidenceParts.push(`${assetPatents.length} patent(s) covering ${asset.asset_name}`);
  }

  if (asset.therapeutic_area) {
    const taPatents = patents.filter(p => p.therapeutic_area === asset.therapeutic_area);
    if (taPatents.length >= 5 && assetPatents.length === 0) {
      score += 20;
      evidenceParts.push(`${taPatents.length} patents in ${asset.therapeutic_area} — active IP program`);
    }
  }

  if (patents.length >= 10) {
    score += 20;
    evidenceParts.push(`${patents.length} total patents in 12mo — aggressive IP strategy`);
  } else if (patents.length >= 5) {
    score += 10;
    evidenceParts.push(`${patents.length} patents filed in 12mo`);
  }

  const hasEvidence = evidenceParts.length > 0;
  const top = assetPatents[0] ?? patents[0];
  const factor: SignalFactor = {
    type: 'patent_filing',
    score: Math.min(score, 100),
    confidence: !hasEvidence ? 0 : assetPatents.length > 0 ? 70 : 40,
    direction: score >= 30 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; '),
    evidenceSource: 'research_signals',
    evidenceUrl: hasEvidence ? top?.source_url || undefined : undefined,
    evidenceDate: hasEvidence ? top?.published_date || undefined : undefined,
    evidenceKey: evidenceKeyFromIds(hasEvidence ? patents.map(p => p.id) : []),
    metadata: { patents_12mo: patents.length, asset_patents: assetPatents.length },
  };
  return applySourceErrors(factor, ['research_signals'], [ev.company.errors]);
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 8: PUBLICATION VELOCITY (7%)
// Academic publications validating the science → more attractive to buyers.
// Sources: research_signals (pubmed, preprint).
// ═══════════════════════════════════════════════════════════════════════

const HIGH_IMPACT_JOURNALS = ['nejm', 'lancet', 'nature', 'science', 'jama', 'cell', 'jco', 'blood'];

export function detectPublicationVelocity(asset: AssetForScoring, ev: EvidenceBundle): SignalFactor {
  const pubs = ev.asset.publications;
  let score = 0;
  const evidenceParts: string[] = [];
  const sixMonthsAgo = monthsAgo(6, ev.now);

  if (pubs.length > 0) {
    const recentPubs = pubs.filter(p => p.published_date && new Date(p.published_date) >= sixMonthsAgo);

    if (recentPubs.length >= 5) {
      score += 50;
      evidenceParts.push(`${recentPubs.length} publications mentioning ${asset.asset_name} in 6mo — surging interest`);
    } else if (recentPubs.length >= 2) {
      score += 30;
      evidenceParts.push(`${recentPubs.length} recent publications on ${asset.asset_name}`);
    } else if (pubs.length >= 3) {
      score += 20;
      evidenceParts.push(`${pubs.length} publications in 12mo on ${asset.asset_name}`);
    } else {
      score += 10;
      evidenceParts.push(`${pubs.length} publication(s) referencing ${asset.asset_name}`);
    }

    const highImpactPubs = pubs.filter(p =>
      p.journal && HIGH_IMPACT_JOURNALS.some(j => p.journal!.toLowerCase().includes(j))
    );
    if (highImpactPubs.length > 0) {
      score += 20;
      evidenceParts.push(`${highImpactPubs.length} high-impact journal publication(s)`);
    }
  } else if (asset.therapeutic_area && (ev.asset.taPublicationCount ?? 0) > 50) {
    score += 10;
    evidenceParts.push(`${ev.asset.taPublicationCount} publications in ${asset.therapeutic_area} TA in 6mo — active research area`);
  }

  const hasEvidence = evidenceParts.length > 0;
  const ids = pubs.length > 0 ? pubs.map(p => p.id) : hasEvidence ? [`research_signals:ta:${asset.therapeutic_area}`] : [];
  const factor: SignalFactor = {
    type: 'publication_velocity',
    score: Math.min(score, 100),
    confidence: !hasEvidence ? 0 : pubs.length > 0 ? 55 : 30,
    direction: score >= 30 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; '),
    evidenceSource: 'research_signals',
    evidenceUrl: pubs[0]?.source_url || undefined,
    evidenceDate: pubs[0]?.published_date || undefined,
    evidenceKey: evidenceKeyFromIds(ids),
    metadata: { publications_12mo: pubs.length, ta_publications_6mo: ev.asset.taPublicationCount },
  };
  return applySourceErrors(factor, ['research_signals'], [ev.asset.errors]);
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 9: STRATEGIC REVIEW (11%)
// Explicit "strategic alternatives" / restructuring / pipeline pruning.
// Sources: press_releases (strategic language), companies metadata.
// ═══════════════════════════════════════════════════════════════════════

const STRATEGIC_REVIEW_KEYWORDS = [
  'strategic alternative', 'strategic option', 'strategic review',
  'exploring alternatives', 'evaluating strategic', 'considering options',
  'portfolio review', 'pipeline prioritization', 'restructuring',
  'strategic transaction', 'sale process', 'potential acquisition',
  'potential merger', 'reverse merger', 'special committee',
  'workforce reduction', 'cost reduction', 'operational efficiency',
  'winding down', 'cease operations', 'chapter 11',
];

export function detectStrategicReview(asset: AssetForScoring, ev: EvidenceBundle): SignalFactor {
  const companyData = ev.company.company;
  let score = 0;
  const evidenceParts: string[] = [];
  const ids: string[] = [];
  const sixMonthsAgo = monthsAgo(6, ev.now);
  let topPR: PressReleaseRow | undefined;

  for (const pr of ev.company.pressReleases) {
    if (new Date(pr.published_at) < sixMonthsAgo) continue;
    const text = `${pr.headline} ${pr.body_text || ''}`.toLowerCase();
    const matched = STRATEGIC_REVIEW_KEYWORDS.filter(kw => text.includes(kw));

    if (matched.length >= 3) {
      score += 60;
      evidenceParts.push(`Strong strategic review signal: "${pr.headline}" (${matched.length} keywords matched)`);
      ids.push(pr.id);
      topPR = pr;
      break;
    } else if (matched.length >= 1) {
      score += 25;
      evidenceParts.push(`Strategic signal: "${pr.headline}" — matched: ${matched.join(', ')}`);
      ids.push(pr.id);
      if (!topPR) topPR = pr;
    }
  }

  if (ev.company.companyFound && companyData.acquisition_appetite === 'inactive') {
    score += 15;
    evidenceParts.push('Company marked as inactive acquirer — possible seller posture');
    ids.push(`companies:${companyData.name}`);
  }

  if (
    companyData.company_type &&
    ['mid_biotech', 'specialty'].includes(companyData.company_type) &&
    asset.partnership_status === 'unpartnered' &&
    LATE_STAGE_PHASES.includes(normalizePhase(asset.phase))
  ) {
    score += 20;
    const phaseFmt = (asset.phase || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    evidenceParts.push(`Small/mid biotech with unpartnered ${phaseFmt} asset — strategic pressure to partner`);
    ids.push(`clinical_assets:${asset.id}:unpartnered_late_stage`);
  }

  const hasEvidence = evidenceParts.length > 0;
  const factor: SignalFactor = {
    type: 'strategic_review',
    score: Math.min(score, 100),
    confidence: hasEvidence ? 65 : 0,
    direction: score >= 40 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; '),
    evidenceSource: 'press_releases,companies',
    evidenceUrl: topPR?.source_url || undefined,
    evidenceDate: topPR ? isoDate(new Date(topPR.published_at)) : undefined,
    evidenceKey: evidenceKeyFromIds(hasEvidence ? ids : []),
    metadata: { strategic_press_releases: ids.filter(id => !id.includes(':')).length },
  };
  return applySourceErrors(factor, ['press_releases', 'companies'], [ev.company.errors]);
}

// ═══════════════════════════════════════════════════════════════════════
// RUN ALL DETECTORS (pure)
// ═══════════════════════════════════════════════════════════════════════

export function detectFactors(asset: AssetForScoring, ev: EvidenceBundle): SignalFactor[] {
  return [
    detectCashRunway(asset, ev),
    detectBDHiring(asset, ev),
    detectConferenceActivity(asset, ev),
    detectRegulatoryMilestones(asset, ev),
    detectCompetitorFailure(asset, ev),
    detectManagementCommentary(asset, ev),
    detectPatentActivity(asset, ev),
    detectPublicationVelocity(asset, ev),
    detectStrategicReview(asset, ev),
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// COMPOSITE SCORING (pure)
// ═══════════════════════════════════════════════════════════════════════

export interface CompositeInput {
  phase: string | null | undefined;
  partnership_status: string | null | undefined;
  territory_rights_available?: string[] | null;
}

/**
 * score      = round( Σ(score_i × w_i) × phasePrior × availability )
 * confidence = round( Σ(confidence_i × w_i) )
 *
 * Confidence is NOT folded into the score. In v1 it was, which meant a
 * perfectly evidenced asset could not exceed ~66-75 and a typical one sat at
 * 5-8. Rounding happens exactly once, on the final number.
 */
export function computeCompositeScore(factors: SignalFactor[], asset: CompositeInput): CompositeScore {
  let rawWeighted = 0;
  let weightedConfidence = 0;
  for (const f of factors) {
    const weight = FACTOR_WEIGHTS[f.type] ?? 0;
    rawWeighted += Math.max(0, Math.min(100, f.score)) * weight;
    weightedConfidence += Math.max(0, Math.min(100, f.confidence)) * weight;
  }

  const phaseMultiplier = phasePrior(asset.phase);
  const availability = availabilityFactor(asset.partnership_status, asset.territory_rights_available);
  const score = Math.max(0, Math.min(100, Math.round(rawWeighted * phaseMultiplier * availability)));

  return {
    score,
    confidence: Math.max(0, Math.min(100, Math.round(weightedConfidence))),
    rawWeighted,
    phaseMultiplier,
    availabilityFactor: availability,
  };
}

export function computeCompetitiveHeat(factors: SignalFactor[]): number {
  const competitorFactor = factors.find(f => f.type === 'competitor_failure');
  const regFactor = factors.find(f => f.type === 'regulatory_milestone');
  const confFactor = factors.find(f => f.type === 'conference_activity');

  let heat = 0;
  if (competitorFactor) heat += competitorFactor.score * 0.4;
  if (regFactor) heat += regFactor.score * 0.35;
  if (confFactor) heat += confFactor.score * 0.25;

  return Math.min(Math.round(heat), 100);
}

export function computeDealReadiness(factors: SignalFactor[], asset: AssetForScoring): number {
  let readiness = 0;

  // Deal readiness is a *transactability* view, so later phases rank higher here
  // even though licensing *intent* (PHASE_PRIOR) peaks at Phase 2.
  const readinessByPhase: Record<string, number> = {
    approved: 1.0, phase4: 1.0, phase_4: 1.0, phase3: 0.95, phase_3: 0.95,
    phase2_phase3: 0.9, phase_2_3: 0.9, phase2: 0.8, phase_2: 0.8,
    phase1_phase2: 0.65, phase_1_2: 0.65, phase1: 0.5, phase_1: 0.5,
    early_phase1: 0.4, preclinical: 0.25, discovery: 0.15,
  };
  const key = normalizePhase(asset.phase);
  readiness += (key ? readinessByPhase[key] ?? 0.5 : 0.3) * 30;

  const patentFactor = factors.find(f => f.type === 'patent_filing');
  if (patentFactor) readiness += patentFactor.score * 0.15;

  const regFactor = factors.find(f => f.type === 'regulatory_milestone');
  if (regFactor) readiness += regFactor.score * 0.15;

  const pubFactor = factors.find(f => f.type === 'publication_velocity');
  if (pubFactor) readiness += pubFactor.score * 0.10;

  if (asset.partnership_status === 'unpartnered') readiness += 15;
  else if (asset.partnership_status === 'partially_partnered') readiness += 8;

  readiness += ((asset.confidence_score || 0) / 100) * 10;

  return Math.min(Math.round(readiness), 100);
}

// ═══════════════════════════════════════════════════════════════════════
// TREND (pure) — from asset_signal_snapshots at 7- and 30-day horizons
// ═══════════════════════════════════════════════════════════════════════

export interface SnapshotPoint {
  snapshot_date: string;
  licensing_intent_score: number | string;
}

export interface TrendResult {
  trend: Trend;
  /** Preferred delta (7d when available, else 30d, else 0). */
  scoreDelta: number;
  delta7d: number | null;
  delta30d: number | null;
}

/**
 * Compare the current score against the snapshot nearest each horizon.
 * 7d horizon accepts a prior snapshot aged 6-13 days; 30d accepts 25-45 days.
 * With fewer than one qualifying prior snapshot the trend is 'stable' — the
 * stored licensing_intent_score column is never used as the baseline (v1 did,
 * which compared against whatever the previous run wrote, at any age).
 */
export function computeTrend(currentScore: number, priorSnapshots: SnapshotPoint[], today = new Date()): TrendResult {
  const todayMs = new Date(isoDate(today)).getTime();
  const DAY = 86_400_000;

  const pick = (minAge: number, maxAge: number): number | null => {
    let best: { age: number; score: number } | null = null;
    for (const s of priorSnapshots) {
      const age = Math.round((todayMs - new Date(s.snapshot_date).getTime()) / DAY);
      if (age < minAge || age > maxAge) continue;
      const score = Number(s.licensing_intent_score);
      if (!Number.isFinite(score)) continue;
      if (!best || age < best.age) best = { age, score };
    }
    return best ? best.score : null;
  };

  const prior7 = pick(6, 13);
  const prior30 = pick(25, 45);
  const delta7d = prior7 === null ? null : currentScore - prior7;
  const delta30d = prior30 === null ? null : currentScore - prior30;

  let trend: Trend = 'stable';
  if ((delta7d !== null && delta7d >= 15) || (delta30d !== null && delta30d >= 25)) trend = 'surging';
  else if ((delta7d !== null && delta7d <= -15) || (delta30d !== null && delta30d <= -25)) trend = 'declining';
  else if ((delta7d !== null && delta7d >= 5) || (delta30d !== null && delta30d >= 10)) trend = 'rising';
  else if ((delta7d !== null && delta7d <= -5) || (delta30d !== null && delta30d <= -10)) trend = 'cooling';

  return { trend, scoreDelta: delta7d ?? delta30d ?? 0, delta7d, delta30d };
}

// ═══════════════════════════════════════════════════════════════════════
// SCORE ONE ASSET (pure)
// ═══════════════════════════════════════════════════════════════════════

export function scoreAssetPure(
  asset: AssetForScoring,
  ev: EvidenceBundle,
  priorSnapshots: SnapshotPoint[] = [],
): ScoringResult {
  const factors = detectFactors(asset, ev);
  const composite = computeCompositeScore(factors, asset);
  const competitiveHeat = computeCompetitiveHeat(factors);
  const dealReadinessScore = computeDealReadiness(factors, asset);
  const trend = computeTrend(composite.score, priorSnapshots, ev.now);

  return {
    assetId: asset.id,
    licensingIntentScore: composite.score,
    scoreConfidence: composite.confidence,
    competitiveHeat,
    dealReadinessScore,
    factors,
    composite,
    trend: trend.trend,
    scoreDelta: trend.scoreDelta,
    scoreDelta7d: trend.delta7d,
    scoreDelta30d: trend.delta30d,
    signalsInserted: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// EVIDENCE FETCHERS (Supabase) — every call checks `error`
// ═══════════════════════════════════════════════════════════════════════

const COMPANY_COLUMNS =
  'name, company_type, deals_last_12mo, deals_last_24mo, actively_acquiring, acquisition_appetite, hiring_bd_roles, strategic_priorities, data_quality_score, revenue_at_risk_2025, revenue_at_risk_2026, revenue_at_risk_2027';

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Fetch the per-company evidence for a wave of companies. Companies rows and
 * press releases are pulled in one query per wave; NIH grants and patents are
 * per-company ilike lookups run with bounded concurrency.
 */
async function fetchCompanyEvidence(
  supabase: SupabaseClient,
  companyNames: string[],
  now: Date,
): Promise<Map<string, CompanyEvidence>> {
  const result = new Map<string, CompanyEvidence>();
  for (const name of companyNames) {
    result.set(name, { company: emptyCompanyData(name), companyFound: false, pressReleases: [], nihGrants: [], patents: [], errors: {} });
  }

  const twelveMonthsAgoIso = monthsAgo(12, now).toISOString();
  const twelveMonthsAgoDate = isoDate(monthsAgo(12, now));

  // Companies rows — one query for the wave
  const companiesRes = await supabase.from('companies').select(COMPANY_COLUMNS).in('name', companyNames);
  if (companiesRes.error) {
    for (const ev of result.values()) ev.errors.companies = companiesRes.error.message;
  } else {
    const byLower = new Map<string, CompanyData>();
    for (const row of (companiesRes.data ?? []) as CompanyData[]) byLower.set(row.name.toLowerCase(), row);
    for (const [name, ev] of result) {
      const row = byLower.get(name.toLowerCase());
      if (row) {
        ev.company = { ...row, strategic_priorities: row.strategic_priorities ?? [], data_quality_score: row.data_quality_score ?? 0 };
        ev.companyFound = true;
      }
    }
  }

  // Press releases — one query for the wave (12-month window; detectors narrow it)
  const prRes = await supabase
    .from('press_releases')
    .select('id, headline, body_text, published_at, source_url, companies_mentioned')
    .overlaps('companies_mentioned', companyNames)
    .gte('published_at', twelveMonthsAgoIso)
    .order('published_at', { ascending: false })
    .limit(2000);
  if (prRes.error) {
    for (const ev of result.values()) ev.errors.press_releases = prRes.error.message;
  } else {
    const lowerToName = new Map(companyNames.map(n => [n.toLowerCase(), n] as const));
    for (const row of prRes.data ?? []) {
      const mentioned = (row.companies_mentioned as string[] | null) ?? [];
      const seen = new Set<string>();
      for (const m of mentioned) {
        const name = lowerToName.get((m || '').toLowerCase());
        if (!name || seen.has(name)) continue;
        seen.add(name);
        result.get(name)!.pressReleases.push({
          id: row.id, headline: row.headline, body_text: row.body_text, published_at: row.published_at, source_url: row.source_url,
        });
      }
    }
  }

  // NIH grants + patents — per company, bounded concurrency
  await mapConcurrent(companyNames, 8, async (name) => {
    const ev = result.get(name)!;
    const pattern = `%${escapeLikePattern(name)}%`;

    const [nihRes, patentTitleRes, patentOrgRes] = await Promise.all([
      supabase
        .from('research_signals')
        .select('id, title, published_date, source_url, therapeutic_area, funding_amount_usd')
        .eq('source_type', 'nih_grant')
        .ilike('organization_name', pattern)
        .order('published_date', { ascending: false })
        .limit(3),
      supabase
        .from('research_signals')
        .select('id, title, published_date, source_url, therapeutic_area')
        .eq('source_type', 'patent')
        .ilike('title', pattern)
        .gte('published_date', twelveMonthsAgoDate)
        .order('published_date', { ascending: false })
        .limit(30),
      supabase
        .from('research_signals')
        .select('id, title, published_date, source_url, therapeutic_area')
        .eq('source_type', 'patent')
        .ilike('organization_name', pattern)
        .gte('published_date', twelveMonthsAgoDate)
        .order('published_date', { ascending: false })
        .limit(30),
    ]);

    const rsErrors: string[] = [];
    if (nihRes.error) rsErrors.push(`nih_grant: ${nihRes.error.message}`);
    else ev.nihGrants = (nihRes.data ?? []) as ResearchRow[];

    if (patentTitleRes.error) rsErrors.push(`patent(title): ${patentTitleRes.error.message}`);
    if (patentOrgRes.error) rsErrors.push(`patent(org): ${patentOrgRes.error.message}`);
    const patentMap = new Map<string, ResearchRow>();
    for (const row of [...(patentTitleRes.data ?? []), ...(patentOrgRes.data ?? [])] as ResearchRow[]) patentMap.set(row.id, row);
    ev.patents = Array.from(patentMap.values()).sort((a, b) => (b.published_date || '').localeCompare(a.published_date || ''));

    if (rsErrors.length > 0) ev.errors.research_signals = rsErrors.join('; ');
  });

  return result;
}

async function fetchIndicationEvidence(
  supabase: SupabaseClient,
  indicationCategory: string,
  now: Date,
): Promise<IndicationEvidence> {
  const ev: IndicationEvidence = { failedAssets: [], failedTrials: [], terminatedDeals: [], errors: {} };
  const sixMonthsAgoDate = isoDate(monthsAgo(6, now));

  const [assetsRes, trialsRes, dealsRes] = await Promise.all([
    // last_update_date (ClinicalTrials.gov) rather than updated_at, which every
    // scoring run bumps and would make "recent" always true.
    supabase
      .from('clinical_assets')
      .select('id, company_name, asset_name, modality')
      .eq('indication_category', indicationCategory)
      .eq('trial_status', 'other')
      .gte('last_update_date', sixMonthsAgoDate)
      .limit(50),
    supabase
      .from('company_trials')
      .select('id, company_name')
      .eq('indication_category', indicationCategory)
      .in('status', ['terminated', 'withdrawn', 'suspended'])
      .limit(50),
    supabase
      .from('deals')
      .select('id, licensor_name')
      .eq('indication_category', indicationCategory)
      .eq('deal_status', 'terminated')
      .limit(25),
  ]);

  if (assetsRes.error) ev.errors.clinical_assets = assetsRes.error.message;
  else ev.failedAssets = (assetsRes.data ?? []) as IndicationEvidence['failedAssets'];
  if (trialsRes.error) ev.errors.company_trials = trialsRes.error.message;
  else ev.failedTrials = (trialsRes.data ?? []) as IndicationEvidence['failedTrials'];
  if (dealsRes.error) ev.errors.deals = dealsRes.error.message;
  else ev.terminatedDeals = (dealsRes.data ?? []) as IndicationEvidence['terminatedDeals'];

  return ev;
}

async function fetchTaPublicationCount(supabase: SupabaseClient, therapeuticArea: string, now: Date): Promise<{ count: number | null; error?: string }> {
  const { count, error } = await supabase
    .from('research_signals')
    .select('id', { count: 'exact', head: true })
    .in('source_type', ['pubmed', 'preprint'])
    .eq('therapeutic_area', therapeuticArea)
    .gte('published_date', isoDate(monthsAgo(6, now)));
  if (error) return { count: null, error: error.message };
  return { count: count ?? 0 };
}

async function fetchAssetPublications(supabase: SupabaseClient, asset: AssetForScoring, now: Date): Promise<{ pubs: ResearchRow[]; error?: string }> {
  const name = asset.asset_name.trim();
  if (name.length < 3) return { pubs: [] };
  const pattern = `%${escapeLikePattern(name)}%`;
  const since = isoDate(monthsAgo(12, now));
  const cols = 'id, title, published_date, journal, source_url, therapeutic_area';

  const [titleRes, abstractRes] = await Promise.all([
    supabase.from('research_signals').select(cols).in('source_type', ['pubmed', 'preprint']).ilike('title', pattern)
      .gte('published_date', since).order('published_date', { ascending: false }).limit(30),
    supabase.from('research_signals').select(cols).in('source_type', ['pubmed', 'preprint']).ilike('abstract', pattern)
      .gte('published_date', since).order('published_date', { ascending: false }).limit(30),
  ]);

  const errors: string[] = [];
  if (titleRes.error) errors.push(`title: ${titleRes.error.message}`);
  if (abstractRes.error) errors.push(`abstract: ${abstractRes.error.message}`);

  const map = new Map<string, ResearchRow>();
  for (const row of [...(titleRes.data ?? []), ...(abstractRes.data ?? [])] as ResearchRow[]) map.set(row.id, row);
  const pubs = Array.from(map.values()).sort((a, b) => (b.published_date || '').localeCompare(a.published_date || '')).slice(0, 30);

  return errors.length > 0 ? { pubs, error: errors.join('; ') } : { pubs };
}

async function fetchPriorSnapshots(supabase: SupabaseClient, assetIds: string[], now: Date): Promise<{ byAsset: Map<string, SnapshotPoint[]>; error?: string }> {
  const byAsset = new Map<string, SnapshotPoint[]>();
  const since = new Date(now); since.setDate(since.getDate() - 46);
  const { data, error } = await supabase
    .from('asset_signal_snapshots')
    .select('asset_id, snapshot_date, licensing_intent_score')
    .in('asset_id', assetIds)
    .gte('snapshot_date', isoDate(since))
    .lt('snapshot_date', isoDate(now));
  if (error) return { byAsset, error: error.message };
  for (const row of data ?? []) {
    const list = byAsset.get(row.asset_id) ?? [];
    list.push({ snapshot_date: row.snapshot_date, licensing_intent_score: row.licensing_intent_score });
    byAsset.set(row.asset_id, list);
  }
  return { byAsset };
}

// ═══════════════════════════════════════════════════════════════════════
// PERSISTENCE — batched
// ═══════════════════════════════════════════════════════════════════════

interface PersistOutcome {
  signalsUpserted: number;
  snapshotsUpserted: number;
  assetsUpdated: number;
  errors: string[];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function persistWave(
  supabase: SupabaseClient,
  scored: Array<{ asset: AssetForScoring; result: ScoringResult }>,
  runStartIso: string,
  now: Date,
): Promise<PersistOutcome> {
  const outcome: PersistOutcome = { signalsUpserted: 0, snapshotsUpserted: 0, assetsUpdated: 0, errors: [] };
  if (scored.length === 0) return outcome;

  const nowIso = now.toISOString();
  const today = isoDate(now);
  const expiresAt = new Date(now); expiresAt.setDate(expiresAt.getDate() + 30);

  // ── licensing_signals: all nine factors per asset, upsert on signal_hash ──
  const signalRows = scored.flatMap(({ asset, result }) =>
    result.factors.map(factor => {
      const sources = factor.sourcesChecked ?? [];
      return {
        asset_id: asset.id,
        company_id: asset.company_id,
        company_name: asset.company_name,
        signal_type: factor.type,
        signal_value: factor.score,
        confidence: factor.confidence,
        direction: factor.direction,
        evidence_text: (factor.evidence || `No evidence found (checked ${sources.length} sources: ${sources.join(', ')})`).slice(0, 2000),
        evidence_url: factor.evidenceUrl || null,
        evidence_source: factor.evidenceSource || null,
        evidence_date: factor.evidenceDate || today,
        evidence_metadata: {
          ...(factor.metadata ?? {}),
          sources_checked: sources,
          evidence_key: factor.evidenceKey ?? 'none',
          ...(factor.error ? { source_error: factor.error } : {}),
        },
        // detected_at intentionally omitted: it defaults to NOW() on first insert and
        // ON CONFLICT leaves it untouched, so it records when this evidence set was
        // first seen; updated_at (trigger) records the last confirmation.
        expires_at: expiresAt.toISOString(),
        is_active: true,
        signal_hash: computeSignalHash(asset.id, factor.type, factor.evidenceKey ?? 'none'),
      };
    }),
  );

  for (const rows of chunk(signalRows, 500)) {
    const { error } = await supabase.from('licensing_signals').upsert(rows, { onConflict: 'signal_hash' });
    if (error) outcome.errors.push(`licensing_signals upsert (${rows.length} rows): ${error.message}`);
    else outcome.signalsUpserted += rows.length;
  }

  // Deactivate rows for these assets that this run did not touch (old evidence sets / v1 rows).
  const assetIds = scored.map(s => s.asset.id);
  for (const ids of chunk(assetIds, 200)) {
    const { error } = await supabase
      .from('licensing_signals')
      .update({ is_active: false })
      .in('asset_id', ids)
      .eq('is_active', true)
      .lt('updated_at', runStartIso);
    if (error) outcome.errors.push(`licensing_signals stale sweep: ${error.message}`);
  }

  // ── asset_signal_snapshots: upsert on (asset_id, snapshot_date) ──
  const snapshotRows = scored.map(({ asset, result }) => {
    const factorScores: Record<string, number> = {};
    for (const f of result.factors) factorScores[f.type] = f.score;
    factorScores.availability_factor = result.composite.availabilityFactor;
    factorScores.phase_multiplier = result.composite.phaseMultiplier;
    factorScores.raw_weighted = Math.round(result.composite.rawWeighted * 100) / 100;
    factorScores.score_confidence = result.scoreConfidence;
    return {
      asset_id: asset.id,
      licensing_intent_score: result.licensingIntentScore,
      competitive_heat: result.competitiveHeat,
      deal_readiness_score: result.dealReadinessScore,
      factor_scores: factorScores,
      score_delta: result.scoreDelta,
      trend: result.trend,
      snapshot_date: today,
    };
  });

  for (const rows of chunk(snapshotRows, 500)) {
    const { error } = await supabase.from('asset_signal_snapshots').upsert(rows, { onConflict: 'asset_id,snapshot_date' });
    if (error) outcome.errors.push(`asset_signal_snapshots upsert (${rows.length} rows): ${error.message}`);
    else outcome.snapshotsUpserted += rows.length;
  }

  // ── clinical_assets: composite scores + scoring cursor, upsert on id ──
  const assetRows = scored.map(({ asset, result }) => ({
    id: asset.id,
    company_name: asset.company_name,
    asset_name: asset.asset_name,
    licensing_intent_score: result.licensingIntentScore,
    competitive_heat: result.competitiveHeat,
    deal_readiness_score: result.dealReadinessScore,
    score_confidence: result.scoreConfidence,
    last_scored_at: nowIso,
  }));

  for (const rows of chunk(assetRows, 200)) {
    const { error } = await supabase.from('clinical_assets').upsert(rows, { onConflict: 'id' });
    if (error) outcome.errors.push(`clinical_assets score update (${rows.length} rows): ${error.message}`);
    else outcome.assetsUpdated += rows.length;
  }

  return outcome;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPIRE OLD SIGNALS
// ═══════════════════════════════════════════════════════════════════════

async function expireOldSignals(supabase: SupabaseClient, now: Date): Promise<{ expired: number; error?: string }> {
  const { data, error } = await supabase
    .from('licensing_signals')
    .update({ is_active: false })
    .eq('is_active', true)
    .lt('expires_at', now.toISOString())
    .select('id');
  if (error) return { expired: 0, error: error.message };
  return { expired: data?.length ?? 0 };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN: DETECT LICENSING SIGNALS
// ═══════════════════════════════════════════════════════════════════════

const MAX_RUNTIME_MS = 250_000;
/** Default queue size per run. 5,932 assets / 2,500 ≈ full coverage every 3 days. */
export const DEFAULT_RUN_LIMIT = 2500;
export const MAX_RUN_LIMIT = 10_000;
/** Assets per persistence wave (companies are never split across waves). */
const WAVE_TARGET_ASSETS = 120;

const ASSET_COLUMNS =
  'id, company_id, company_name, asset_name, modality, therapeutic_area, indication_category, indication_specific, phase, trial_status, partnership_status, nct_ids, trial_count, confidence_score, licensing_intent_score, regulatory_designations, territory_rights_available';

function zeroByFactor(): Record<SignalType, number> {
  return Object.fromEntries(SIGNAL_TYPES.map(t => [t, 0])) as Record<SignalType, number>;
}

export interface DetectionOptions {
  /** Max assets to pull from the queue (default DEFAULT_RUN_LIMIT, capped at MAX_RUN_LIMIT). */
  limit?: number;
  assetIds?: string[];
  runType?: 'scheduled' | 'manual' | 'backfill';
  /** @deprecated v1 per-asset batch size; ignored. Kept so old callers compile. */
  batchSize?: number;
}

export async function detectLicensingSignals(
  supabase: SupabaseClient,
  options?: DetectionOptions,
): Promise<DetectionResult> {
  const startTime = Date.now();
  const now = new Date(startTime);
  const runStartIso = now.toISOString();
  const limit = Math.max(1, Math.min(options?.limit ?? DEFAULT_RUN_LIMIT, MAX_RUN_LIMIT));
  const runType = options?.runType ?? 'scheduled';

  const errors: string[] = [];
  const factorNonZero = zeroByFactor();
  const factorErrors = zeroByFactor();
  const sourceErrors: Record<string, number> = {};
  let assetsScored = 0;
  let assetsFailed = 0;
  let signalsDetected = 0;
  let signalsInserted = 0;
  let snapshotsTaken = 0;
  let timedOut = false;
  let wavesProcessed = 0;

  const finish = async (queued: number, notes?: string): Promise<DetectionResult> => {
    const durationMs = Date.now() - startTime;
    const status = deriveRunStatus({ errors: errors.length, timedOut, processed: queued, produced: assetsScored });
    const logged = await logRadarRun(supabase, {
      source: 'licensing_signals',
      startedAt: startTime,
      status,
      runType,
      fetched: queued,
      processed: assetsScored,
      inserted: signalsInserted,
      updated: snapshotsTaken,
      failed: assetsFailed,
      errors,
      parameters: {
        scoring_version: 2,
        limit,
        timed_out: timedOut,
        waves: wavesProcessed,
        signals_detected: signalsDetected,
        factor_nonzero: factorNonZero,
        factor_errors: factorErrors,
        source_errors: sourceErrors,
        assets_per_second: durationMs > 0 ? Math.round((assetsScored / durationMs) * 1000 * 10) / 10 : 0,
      },
      notes,
    });
    console.log(
      `[licensing-signals] ${status}: ${assetsScored}/${queued} assets scored, ${signalsDetected} non-zero factors, ` +
      `${signalsInserted} signal rows, ${snapshotsTaken} snapshots, ${errors.length} errors, ${Math.round(durationMs / 1000)}s${timedOut ? ' (timed out)' : ''}`,
    );
    return {
      assetsQueued: queued, assetsScored, assetsFailed, signalsDetected, signalsInserted, snapshotsTaken,
      errors, timedOut, factorNonZero, factorErrors, durationMs, logged,
    };
  };

  // ── Expire stale signals ──
  const expired = await expireOldSignals(supabase, now);
  if (expired.error) errors.push(`expireOldSignals: ${expired.error}`);
  else if (expired.expired > 0) console.log(`[licensing-signals] Expired ${expired.expired} stale signals`);

  // ── Scoring queue: never-scored first, then oldest last_scored_at ──
  let assetQuery = supabase
    .from('clinical_assets')
    .select(ASSET_COLUMNS)
    .gte('confidence_score', 20)
    .order('last_scored_at', { ascending: true, nullsFirst: true })
    .order('id', { ascending: true });

  if (options?.assetIds?.length) assetQuery = assetQuery.in('id', options.assetIds);

  const { data: assetRows, error: assetError } = await assetQuery.limit(limit);
  if (assetError) {
    errors.push(`queue fetch: ${assetError.message}`);
    return finish(0, 'queue fetch failed');
  }
  const assets = (assetRows ?? []) as AssetForScoring[];
  if (assets.length === 0) return finish(0, 'queue empty');

  // ── Group by company, then pack companies into waves ──
  const byCompany = new Map<string, AssetForScoring[]>();
  for (const a of assets) {
    const list = byCompany.get(a.company_name) ?? [];
    list.push(a);
    byCompany.set(a.company_name, list);
  }
  const waves: string[][] = [];
  let current: string[] = [];
  let currentCount = 0;
  for (const [name, list] of byCompany) {
    current.push(name);
    currentCount += list.length;
    if (currentCount >= WAVE_TARGET_ASSETS) { waves.push(current); current = []; currentCount = 0; }
  }
  if (current.length > 0) waves.push(current);

  const indicationCache = new Map<string, IndicationEvidence>();
  const taCountCache = new Map<string, { count: number | null; error?: string }>();

  for (const wave of waves) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

    const waveAssets = wave.flatMap(name => byCompany.get(name)!);
    const waveAssetIds = waveAssets.map(a => a.id);

    try {
      // Per-company evidence (companies + press releases in one query each; NIH/patents per company)
      const companyEvidence = await fetchCompanyEvidence(supabase, wave, now);

      // Per-indication evidence (cached across waves)
      const indications = Array.from(new Set(waveAssets.map(a => a.indication_category).filter((x): x is string => !!x)))
        .filter(ind => !indicationCache.has(ind));
      await mapConcurrent(indications, 4, async (ind) => {
        indicationCache.set(ind, await fetchIndicationEvidence(supabase, ind, now));
      });

      // Per-TA publication counts (cached across waves; only needed for assets with no pubs)
      const tas = Array.from(new Set(waveAssets.map(a => a.therapeutic_area).filter((x): x is string => !!x)))
        .filter(ta => !taCountCache.has(ta));
      await mapConcurrent(tas, 4, async (ta) => {
        taCountCache.set(ta, await fetchTaPublicationCount(supabase, ta, now));
      });

      // Per-asset publications + prior snapshots
      const [pubResults, snapshots] = await Promise.all([
        mapConcurrent(waveAssets, 12, (a) => fetchAssetPublications(supabase, a, now)),
        fetchPriorSnapshots(supabase, waveAssetIds, now),
      ]);
      if (snapshots.error) {
        errors.push(`snapshot history: ${snapshots.error}`);
        sourceErrors.asset_signal_snapshots = (sourceErrors.asset_signal_snapshots ?? 0) + 1;
      }

      // Score (pure)
      const scored: Array<{ asset: AssetForScoring; result: ScoringResult }> = [];
      waveAssets.forEach((asset, i) => {
        try {
          const cEv = companyEvidence.get(asset.company_name) ?? emptyEvidence(asset.company_name, now).company;
          const iEv = asset.indication_category
            ? indicationCache.get(asset.indication_category) ?? { failedAssets: [], failedTrials: [], terminatedDeals: [], errors: {} }
            : { failedAssets: [], failedTrials: [], terminatedDeals: [], errors: {} };
          const pubs = pubResults[i];
          const taCount = asset.therapeutic_area ? taCountCache.get(asset.therapeutic_area) : undefined;
          const aEv: AssetEvidence = {
            publications: pubs.pubs,
            taPublicationCount: taCount?.count ?? null,
            errors: {},
          };
          const rsErr = [pubs.error, taCount?.error].filter(Boolean).join('; ');
          if (rsErr) aEv.errors.research_signals = rsErr;

          const bundle: EvidenceBundle = { company: cEv, indication: iEv, asset: aEv, now };
          const result = scoreAssetPure(asset, bundle, snapshots.byAsset.get(asset.id) ?? []);

          for (const f of result.factors) {
            if (f.score > 0) { factorNonZero[f.type]++; signalsDetected++; }
            if (f.error) {
              factorErrors[f.type]++;
              for (const src of f.sourcesChecked ?? []) {
                const failedHere = [cEv.errors, iEv.errors, aEv.errors].some(m => m[src]);
                if (failedHere) sourceErrors[src] = (sourceErrors[src] ?? 0) + 1;
              }
            }
          }
          scored.push({ asset, result });
        } catch (err) {
          assetsFailed++;
          errors.push(`Scoring error ${asset.company_name}/${asset.asset_name}: ${errMsg(err)}`);
        }
      });

      // Persist (batched)
      const persisted = await persistWave(supabase, scored, runStartIso, now);
      errors.push(...persisted.errors);
      signalsInserted += persisted.signalsUpserted;
      snapshotsTaken += persisted.snapshotsUpserted;
      assetsScored += persisted.assetsUpdated;
      assetsFailed += scored.length - persisted.assetsUpdated;
      wavesProcessed++;
    } catch (err) {
      assetsFailed += waveAssets.length;
      errors.push(`Wave failed (${wave.length} companies, ${waveAssets.length} assets): ${errMsg(err)}`);
    }
  }

  return finish(assets.length);
}
