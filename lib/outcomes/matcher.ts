/**
 * Outcome ledger — pure matching and metric functions.
 *
 * scoreMatch(prediction, deal, companyAliases) → 0–1
 *
 *   component                         weight   notes
 *   ─────────────────────────────────────────────────────────────────────────
 *   licensor identity                 0.45     company_id / exact name / alias = 1.0,
 *                                              asset-name match = 0.85, fuzzy name = 0.7.
 *                                              No identity at all → HARD GATE (score 0).
 *   indication                        0.25     same indication (isSameIndication);
 *                                              same TA only → 0.10; neither → 0.
 *   phase                             0.15     same normalized phase = 0.15, one step
 *                                              away = 0.10, unknown on either side = 0.05,
 *                                              more than one step → HARD GATE (score 0).
 *   announced after resolve_after     0.15     HARD GATE: a deal announced before the
 *                                              prediction's resolve_after scores 0.
 *
 * Thresholds (resolver.ts): ≥ 0.80 auto-resolves, 0.50–0.80 goes to the review
 * queue, below 0.50 is ignored.
 *
 * computeOutcomeMetrics(prediction, actuals) derives APE, within-band, buyer hit,
 * window hit and value captured. Money is $M throughout.
 */

import { isSameIndication, isSameTA, normalizePhase } from '@/lib/brief/comp-set';
import type { DealPhase } from '@/lib/brief/types';
import type {
  CompanyAlias,
  DealCandidateRow,
  MatchEvidence,
  MatchScore,
  OutcomeActuals,
  OutcomeMetrics,
  PredictionForMatch,
} from './types';

// ─── Weights & thresholds (exported so tests and docs stay in sync) ─────────

export const MATCH_WEIGHTS = {
  identity: 0.45,
  indication: 0.25,
  taOnly: 0.10,
  phaseExact: 0.15,
  phaseOneStep: 0.10,
  phaseUnknown: 0.05,
  resolveAfterGate: 0.15,
} as const;

export const IDENTITY_SCORES = {
  company_id: 1.0,
  name: 1.0,
  alias: 1.0,
  asset: 0.85,
  fuzzy: 0.7,
  none: 0,
} as const;

export const AUTO_RESOLVE_THRESHOLD = 0.8;
export const REVIEW_QUEUE_THRESHOLD = 0.5;

// ─── Name normalisation ────────────────────────────────────────────────────

const LEGAL_TOKENS = new Set([
  'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'plc', 'ag', 'sa', 'nv', 'bv',
  'gmbh', 'llc', 'lp', 'llp', 'holdings', 'holding', 'group', 'the', 'kk', 'kgaa', 'spa', 'ab', 'as', 'oy', 'pte',
]);

const DESCRIPTOR_TOKENS = new Set([
  'pharmaceuticals', 'pharmaceutical', 'pharma', 'therapeutics', 'therapeutic', 'biosciences', 'bioscience',
  'biotech', 'biotechnology', 'biotechnologies', 'biopharma', 'biopharmaceuticals', 'biopharmaceutical',
  'biologics', 'sciences', 'science', 'medical', 'medicines', 'medicine', 'health', 'healthcare', 'labs',
  'laboratories', 'laboratory', 'research', 'international', 'global', 'bio', 'biomedical', 'life',
]);

/** Lowercase, strip punctuation and legal suffixes. "Pfizer Inc." → "pfizer". */
export function normalizeCompanyName(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !LEGAL_TOKENS.has(t))
    .join(' ')
    .trim();
}

/** normalizeCompanyName minus generic descriptors. "Acme Therapeutics" → "acme". */
export function coreCompanyName(s: string | null | undefined): string {
  return normalizeCompanyName(s)
    .split(' ')
    .filter((t) => t && !DESCRIPTOR_TOKENS.has(t))
    .join(' ')
    .trim();
}

/** All normalised spellings a company row is known by. */
export function aliasSet(c: Pick<CompanyAlias, 'name' | 'name_variations'>): Set<string> {
  const out = new Set<string>();
  const add = (v: string | null | undefined) => { const n = normalizeCompanyName(v); if (n) out.add(n); };
  add(c.name);
  (c.name_variations ?? []).forEach(add);
  return out;
}

/**
 * Every normalised spelling that refers to the same company as `name` or `companyId`,
 * resolved through the supplied companies rows. Always includes the name itself.
 */
export function expandAliases(name: string | null | undefined, companyId: string | null | undefined, companies: CompanyAlias[]): Set<string> {
  const out = new Set<string>();
  const self = normalizeCompanyName(name);
  if (self) out.add(self);
  for (const c of companies) {
    const set = aliasSet(c);
    if ((companyId && c.id === companyId) || (self && set.has(self))) {
      set.forEach((a) => out.add(a));
    }
  }
  return out;
}

function fuzzyNameMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ca = coreCompanyName(a);
  const cb = coreCompanyName(b);
  if (ca.length >= 4 && ca === cb) return true;
  const na = normalizeCompanyName(a);
  const nb = normalizeCompanyName(b);
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  return shorter.length >= 6 && longer.includes(shorter);
}

// ─── Phase distance ────────────────────────────────────────────────────────

const PHASE_INDEX: Record<DealPhase, number | null> = {
  discovery: 0, preclinical: 1, phase_1: 2, phase_2: 3, phase_3: 4, approved: 5, unknown: null,
};

/** Steps between two phase strings; null when either side is unknown. */
export function phaseDistance(a: string | null | undefined, b: string | null | undefined): number | null {
  const ia = PHASE_INDEX[normalizePhase(a)];
  const ib = PHASE_INDEX[normalizePhase(b)];
  if (ia == null || ib == null) return null;
  return Math.abs(ia - ib);
}

// ─── scoreMatch ────────────────────────────────────────────────────────────

function identityOf(prediction: PredictionForMatch, deal: DealCandidateRow, companies: CompanyAlias[]): { kind: MatchEvidence['identity']; score: number; assetNameMatch: boolean } {
  const assetA = normalizeCompanyName(prediction.asset_name);
  const assetB = normalizeCompanyName(deal.asset_name);
  const assetNameMatch = assetA.length >= 4 && assetA === assetB;

  if (prediction.company_id && deal.licensor_id && prediction.company_id === deal.licensor_id) {
    return { kind: 'company_id', score: IDENTITY_SCORES.company_id, assetNameMatch };
  }
  const pName = normalizeCompanyName(prediction.licensor_name);
  const dName = normalizeCompanyName(deal.licensor_name);
  if (pName && dName && pName === dName) {
    return { kind: 'name', score: IDENTITY_SCORES.name, assetNameMatch };
  }
  if (pName || prediction.company_id) {
    const pAliases = expandAliases(prediction.licensor_name, prediction.company_id, companies);
    const dAliases = expandAliases(deal.licensor_name, deal.licensor_id, companies);
    for (const a of pAliases) {
      if (dAliases.has(a)) return { kind: 'alias', score: IDENTITY_SCORES.alias, assetNameMatch };
    }
  }
  if (assetNameMatch) {
    return { kind: 'asset', score: IDENTITY_SCORES.asset, assetNameMatch };
  }
  if (pName && dName && fuzzyNameMatch(prediction.licensor_name ?? '', deal.licensor_name ?? '')) {
    return { kind: 'fuzzy', score: IDENTITY_SCORES.fuzzy, assetNameMatch };
  }
  return { kind: 'none', score: 0, assetNameMatch };
}

/**
 * Score how well a quality-filtered deal resolves a prediction. Pure.
 * `companyAliases` should contain the companies rows for the prediction's
 * company_id, the deal's licensor_id, and any row whose name/name_variations
 * contain either licensor name (the resolver fetches these in one query).
 */
export function scoreMatch(prediction: PredictionForMatch, deal: DealCandidateRow, companyAliases: CompanyAlias[] = []): MatchScore {
  const id = identityOf(prediction, deal, companyAliases);
  const identityScore = id.score * MATCH_WEIGHTS.identity;

  // Indication: same indication beats same TA.
  let indication: MatchEvidence['indication'] = 'none';
  let indicationScore = 0;
  const dealInd = { indication_category: deal.indication_category, indication_specific: deal.indication_specific, therapeutic_area: deal.therapeutic_area };
  if (prediction.indication && isSameIndication(dealInd, prediction.indication)) {
    indication = 'indication';
    indicationScore = MATCH_WEIGHTS.indication;
  } else if (prediction.therapeutic_area && isSameTA(dealInd, prediction.therapeutic_area)) {
    indication = 'ta';
    indicationScore = MATCH_WEIGHTS.taOnly;
  }

  // Phase within one step.
  const phaseSteps = phaseDistance(prediction.phase, deal.phase_at_signing);
  let phaseScore = 0;
  if (phaseSteps === 0) phaseScore = MATCH_WEIGHTS.phaseExact;
  else if (phaseSteps === 1) phaseScore = MATCH_WEIGHTS.phaseOneStep;
  else if (phaseSteps == null) phaseScore = MATCH_WEIGHTS.phaseUnknown;

  // Hard gate: announced on/after resolve_after.
  const announced = deal.announced_date ? Date.parse(deal.announced_date) : NaN;
  const resolveAfter = Date.parse(prediction.resolve_after);
  const afterResolveAfter = Number.isFinite(announced) && Number.isFinite(resolveAfter) && announced >= startOfDay(resolveAfter);
  const gateScore = afterResolveAfter ? MATCH_WEIGHTS.resolveAfterGate : 0;

  const evidence: MatchEvidence = {
    identity: id.kind,
    identityScore: round4(identityScore),
    indication,
    indicationScore,
    phaseSteps,
    phaseScore,
    afterResolveAfter,
    gateScore,
    assetNameMatch: id.assetNameMatch,
    predictionLicensor: prediction.licensor_name ?? null,
    dealLicensor: deal.licensor_name ?? null,
  };

  const gated = id.kind === 'none' || !afterResolveAfter || (phaseSteps != null && phaseSteps > 1);
  const score = gated ? 0 : round4(identityScore + indicationScore + phaseScore + gateScore);
  return { score, evidence };
}

/** Midnight UTC of a timestamp — announced_date is a DATE, resolve_after a timestamptz. */
function startOfDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ─── computeOutcomeMetrics ─────────────────────────────────────────────────

function pointEstimate(mid: number | null, low: number | null, high: number | null): number | null {
  if (mid != null && Number.isFinite(mid)) return mid;
  if (low != null && high != null) return (low + high) / 2;
  return null;
}

function absPctError(actual: number | null, predicted: number | null): number | null {
  if (actual == null || predicted == null || !(actual > 0)) return null;
  return round4(Math.abs(actual - predicted) / actual);
}

function withinBand(actual: number | null, low: number | null, high: number | null): boolean | null {
  if (actual == null || low == null || high == null) return null;
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  return actual >= lo && actual <= hi;
}

/** Does `licensee` match any predicted buyer (exact, alias, or fuzzy name)? */
export function buyerHit(licensee: string | null | undefined, licenseeId: string | null | undefined, predictedBuyers: string[], companies: CompanyAlias[] = []): boolean | null {
  if (!predictedBuyers.length) return null;
  if (!licensee && !licenseeId) return null;
  const actual = expandAliases(licensee, licenseeId, companies);
  for (const b of predictedBuyers) {
    const bAliases = expandAliases(b, null, companies);
    for (const a of bAliases) if (actual.has(a)) return true;
    if (licensee && fuzzyNameMatch(b, licensee)) return true;
  }
  return false;
}

/** Derived metrics for an outcome. `actuals` are $M; a null field yields a null metric. */
export function computeOutcomeMetrics(prediction: PredictionForMatch, actuals: OutcomeActuals, companyAliases: CompanyAlias[] = []): OutcomeMetrics {
  const upfrontPoint = pointEstimate(prediction.upfront_mid, prediction.upfront_low, prediction.upfront_high);
  const totalPoint = pointEstimate(prediction.total_mid, prediction.total_low, prediction.total_high);

  let window_hit: boolean | null = null;
  if (prediction.predicted_window_start && prediction.predicted_window_end && actuals.signed_date) {
    const s = Date.parse(prediction.predicted_window_start);
    const e = Date.parse(prediction.predicted_window_end);
    const d = Date.parse(actuals.signed_date);
    if ([s, e, d].every(Number.isFinite)) window_hit = d >= s && d <= e;
  }

  let value_captured_m: number | null = null;
  if (actuals.total_m != null && actuals.first_offer_total_m != null) {
    value_captured_m = round4(actuals.total_m - actuals.first_offer_total_m);
  } else if (actuals.upfront_m != null && actuals.first_offer_upfront_m != null) {
    value_captured_m = round4(actuals.upfront_m - actuals.first_offer_upfront_m);
  }

  return {
    abs_pct_error_upfront: absPctError(actuals.upfront_m, upfrontPoint),
    abs_pct_error_total: absPctError(actuals.total_m, totalPoint),
    within_band_upfront: withinBand(actuals.upfront_m, prediction.upfront_low, prediction.upfront_high),
    within_band_total: withinBand(actuals.total_m, prediction.total_low, prediction.total_high),
    buyer_hit: buyerHit(actuals.licensee_name, actuals.licensee_id, prediction.predicted_buyers ?? [], companyAliases),
    window_hit,
    value_captured_m,
  };
}

/** deals row (USD) → OutcomeActuals ($M). */
export function dealToActuals(deal: DealCandidateRow): OutcomeActuals {
  const m = (usd: number | null) => (usd == null ? null : round4(usd / 1_000_000));
  return {
    upfront_m: m(deal.upfront_usd),
    total_m: m(deal.total_deal_value_usd),
    royalty_low: deal.royalty_low_pct,
    royalty_high: deal.royalty_high_pct,
    licensee_name: deal.licensee_name,
    licensee_id: deal.licensee_id,
    signed_date: deal.announced_date,
    deal_type: deal.deal_type,
  };
}
