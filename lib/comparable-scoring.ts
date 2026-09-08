/**
 * Shared comparable-deal match scoring.
 *
 * Single source of truth for the weight table, pass threshold, and
 * relaxation ladder used by every comp scorer:
 *
 *   - lib/comparableDeals.server.ts   (enriched comps for /api/deals/comparable)
 *   - app/api/deals/transparency/route.ts (raw-data drill-down + stat bars)
 *   - lib/peer-benchmark.ts            (bundled corpus, sync, for panels)
 *
 * Weight table (max 17):
 *   TA 3 · same phase 4 · adjacent phase (±1 step) 2 · modality 3
 *   indication 3 · deal type 2 · recency 2
 *
 * Pass rule ('none'): TA must match AND at least one of
 *   { same phase, adjacent phase, same indication } must match.
 * Relaxation ladder when the strict pool has < MIN_POOL_BEFORE_RELAX deals:
 *   'modality_only' → TA + modality (phase/indication requirement dropped)
 *   'ta_only'       → TA alone
 * Each rung is a superset of the previous, so strict matches always rank first.
 *
 * Stage/structure sanity: when the query phase is pre-approval, deals that are
 * `approved` AND an acquisition/merger are excluded from the pool (a $74B
 * approved-stage M&A is not a comp for a Phase 2 license).
 *
 * @module lib/comparable-scoring
 */

import { modalitiesMatch, indicationMatches, dealTypesMatch } from '@/lib/comparables/match-normalize';

export const COMP_MATCH_WEIGHTS = {
  ta: 3,
  phase: 4,
  adjacentPhase: 2,
  modality: 3,
  indication: 3,
  dealType: 2,
  recency: 2,
  /** Verifier-confirmed rows outrank unverified ones at otherwise equal match. */
  verified: 1,
} as const;

/** Sum of all weights (phase and adjacentPhase are mutually exclusive → use phase). */
export const COMP_MAX_SCORE =
  COMP_MATCH_WEIGHTS.ta +
  COMP_MATCH_WEIGHTS.phase +
  COMP_MATCH_WEIGHTS.modality +
  COMP_MATCH_WEIGHTS.indication +
  COMP_MATCH_WEIGHTS.dealType +
  COMP_MATCH_WEIGHTS.recency +
  COMP_MATCH_WEIGHTS.verified; // 18

/** Below this many strict matches the ladder relaxes one rung. */
export const MIN_POOL_BEFORE_RELAX = 5;

export type CompRelaxation = 'none' | 'modality_only' | 'ta_only';

export interface CompMatchBreakdown {
  ta: boolean;
  phase: boolean;
  adjacentPhase: boolean;
  modality: boolean;
  indication: boolean;
  dealType: boolean;
  /** 0–2 */
  recency: number;
  /** True when the deal passed the Perplexity/Claude verifier. */
  verified?: boolean;
}

// ---------------------------------------------------------------------------
// Phase helpers — accept calculator ('phase2'), DB ('phase_2'), and corpus forms
// ---------------------------------------------------------------------------

export const PHASE_RANK: Record<string, number> = {
  discovery: 0,
  preclinical: 1,
  phase_1: 2,
  phase_1_2: 2.5,
  phase_2: 3,
  phase_2_3: 3.5,
  phase_3: 4,
  nda_filed: 5,
  bla_filed: 5,
  approved: 6,
  marketed: 6,
};

/** Normalize any phase spelling to the DB form (`phase_2`, `phase_1_2`, ...). */
export function canonicalPhase(phase: string | null | undefined): string | null {
  if (!phase) return null;
  const p = phase.toLowerCase().trim().replace(/\s+/g, '_').replace(/^phase(\d)/, 'phase_$1');
  return p in PHASE_RANK ? p : null;
}

export function phaseRank(phase: string | null | undefined): number | null {
  const c = canonicalPhase(phase);
  return c ? PHASE_RANK[c] : null;
}

/** 'same' | 'adjacent' (within one step on the ladder, half-steps count) | 'none' */
export function phaseRelation(a: string | null | undefined, b: string | null | undefined): 'same' | 'adjacent' | 'none' {
  const ra = phaseRank(a);
  const rb = phaseRank(b);
  if (ra == null || rb == null) return 'none';
  const dist = Math.abs(ra - rb);
  if (dist === 0) return 'same';
  if (dist <= 1) return 'adjacent';
  return 'none';
}

/** True for discovery … nda_filed (anything before approval). */
export function isPreApprovalPhase(phase: string | null | undefined): boolean {
  const r = phaseRank(phase);
  return r != null && r < PHASE_RANK.approved;
}

const MA_DEAL_TYPES = new Set(['acquisition', 'merger', 'm&a', 'acquisitions']);

/** Approved-stage acquisition/merger — excluded from pre-approval comp pools by default. */
export function isApprovedStageMA(phase: string | null | undefined, dealType: string | null | undefined): boolean {
  if (canonicalPhase(phase) !== 'approved') return false;
  if (!dealType) return false;
  return MA_DEAL_TYPES.has(dealType.toLowerCase());
}

/**
 * Should this deal be dropped from the comp pool for the given query phase?
 * Only fires when the query is pre-approval and the deal is approved-stage M&A.
 */
export function shouldExcludeForStage(
  queryPhase: string | null | undefined,
  dealPhase: string | null | undefined,
  dealType: string | null | undefined,
): boolean {
  return isPreApprovalPhase(queryPhase) && isApprovedStageMA(dealPhase, dealType);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface CompQuery {
  therapeuticArea?: string | null;
  phase?: string | null;
  modality?: string | null;
  indication?: string | null;
  dealType?: string | null;
}

export interface CompCandidate {
  therapeuticArea?: string | null;
  /** Additional TAs this deal also belongs to (curated corpus only). */
  secondaryTAs?: string[] | null;
  phase?: string | null;
  /** One or more modality tags. */
  modalities?: (string | null | undefined)[] | null;
  /** One or more indication tags (category + specific). */
  indications?: (string | null | undefined)[] | null;
  dealType?: string | null;
  year?: number | null;
  /** verification_status === 'verified' on live rows; curated corpus rows may pass their own flag. */
  verified?: boolean | null;
}

export interface CompScoreResult {
  /** Raw weighted score, 0..COMP_MAX_SCORE */
  score: number;
  /** score / COMP_MAX_SCORE, 0..1 */
  normalized: number;
  breakdown: CompMatchBreakdown;
  reasons: string[];
}

export interface CompScoreOptions {
  currentYear?: number;
  /**
   * 'discrete' (default): current year → 2, previous year → 1, else 0.
   * 'continuous': 2 × clamp((year − 2015) / 11) — used for the bundled corpus.
   */
  recency?: 'discrete' | 'continuous';
}

const norm = (s: string | null | undefined) => (s || '').toLowerCase().trim();

/** Modality/deal-type aliases so calculator and DB spellings compare equal. */
const DEAL_TYPE_ALIASES: Record<string, string> = {
  license: 'licensing',
  licensing: 'licensing',
  co_development: 'codevelopment',
  codevelopment: 'codevelopment',
  'co-development': 'codevelopment',
  merger: 'acquisition',
  acquisition: 'acquisition',
};
export function canonicalDealType(dt: string | null | undefined): string {
  const n = norm(dt);
  return DEAL_TYPE_ALIASES[n] ?? n;
}

export function scoreCompMatch(query: CompQuery, deal: CompCandidate, opts: CompScoreOptions = {}): CompScoreResult {
  const W = COMP_MATCH_WEIGHTS;
  const currentYear = opts.currentYear ?? new Date().getFullYear();
  const breakdown: CompMatchBreakdown = {
    ta: false, phase: false, adjacentPhase: false, modality: false, indication: false, dealType: false, recency: 0,
  };
  const reasons: string[] = [];
  let score = 0;

  // TA
  const qTA = norm(query.therapeuticArea);
  const dTA = norm(deal.therapeuticArea);
  if (qTA && (dTA === qTA || dTA === 'both' || (deal.secondaryTAs || []).some(t => norm(t) === qTA))) {
    score += W.ta; breakdown.ta = true; reasons.push('Same therapeutic area');
  }

  // Phase
  if (query.phase && deal.phase) {
    const rel = phaseRelation(query.phase, deal.phase);
    if (rel === 'same') { score += W.phase; breakdown.phase = true; reasons.push('Same phase'); }
    else if (rel === 'adjacent') { score += W.adjacentPhase; breakdown.adjacentPhase = true; reasons.push('Adjacent phase (±1)'); }
  }

  // Modality
  // Calculator ('smallMolecule') and DB ('small_molecule') spellings differ —
  // compare through the shared normalizers, never raw strings.
  if (query.modality && (deal.modalities || []).some(m => modalitiesMatch(query.modality, m))) {
    score += W.modality; breakdown.modality = true; reasons.push('Same modality');
  }

  // Indication
  if (query.indication && indicationMatches(query.indication, ...(deal.indications || []))) {
    score += W.indication; breakdown.indication = true; reasons.push('Same indication');
  }

  // Deal type
  if (query.dealType && deal.dealType && (dealTypesMatch(query.dealType, deal.dealType) || canonicalDealType(query.dealType) === canonicalDealType(deal.dealType))) {
    score += W.dealType; breakdown.dealType = true; reasons.push('Same deal type');
  }

  // Recency
  if (deal.year != null) {
    if (opts.recency === 'continuous') {
      const r = Math.max(0, Math.min(1, (deal.year - 2015) / 11));
      breakdown.recency = W.recency * r;
    } else if (deal.year >= currentYear) {
      breakdown.recency = W.recency; reasons.push('Current year');
    } else if (deal.year === currentYear - 1) {
      breakdown.recency = 1;
    }
    score += breakdown.recency;
  }

  // Verification: a confirmed deal beats an unverified one at equal match.
  if (deal.verified) {
    score += W.verified; breakdown.verified = true; reasons.push('Verifier-confirmed');
  }

  return { score, normalized: Math.min(score / COMP_MAX_SCORE, 1), breakdown, reasons };
}

// ---------------------------------------------------------------------------
// Pass threshold + relaxation ladder
// ---------------------------------------------------------------------------

/** Strict pass: TA + at least one of {same phase, adjacent phase, indication}. */
export function passesStrict(b: CompMatchBreakdown): boolean {
  return b.ta && (b.phase || b.adjacentPhase || b.indication);
}

export function passesAtRung(b: CompMatchBreakdown, rung: CompRelaxation): boolean {
  if (rung === 'none') return passesStrict(b);
  if (rung === 'modality_only') return b.ta && (b.modality || passesStrict(b));
  return b.ta;
}

const LADDER: CompRelaxation[] = ['none', 'modality_only', 'ta_only'];

/**
 * Walk the ladder until at least `minPool` items pass. Returns the surviving
 * items (unsorted — caller sorts by score) and the rung that was applied.
 */
export function selectWithRelaxation<T>(
  items: T[],
  getBreakdown: (item: T) => CompMatchBreakdown,
  minPool: number = MIN_POOL_BEFORE_RELAX,
): { items: T[]; relaxation: CompRelaxation } {
  let last: { items: T[]; relaxation: CompRelaxation } = { items: [], relaxation: 'ta_only' };
  for (const rung of LADDER) {
    const passing = items.filter(it => passesAtRung(getBreakdown(it), rung));
    last = { items: passing, relaxation: rung };
    if (passing.length >= minPool) return last;
  }
  return last;
}

/** Human copy for the UI when the ladder relaxed. Null when strict. */
export function relaxationLabel(r: CompRelaxation | null | undefined): string | null {
  if (!r || r === 'none') return null;
  if (r === 'modality_only') return 'Thin coverage: widened to same therapeutic area + modality';
  return 'Thin coverage: widened to therapeutic area';
}

// ---------------------------------------------------------------------------
// Distribution stats with p5/p95 caps (StatBar uses p5–p95 as the bar range)
// ---------------------------------------------------------------------------

export interface CompStats {
  min: number;
  p5: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
  max: number;
  /** Number of disclosed values the stats were computed from. */
  n: number;
}

export function computeCompStats(values: number[]): CompStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  // Nearest-rank quantile: ceil(n·p) − 1. With floor(n·p) the p95 of a 20-row
  // pool lands on index 19 — the outlier itself — which defeats the cap.
  const q = (p: number) => sorted[Math.min(n - 1, Math.max(0, Math.ceil(n * p) - 1))];
  return {
    min: sorted[0],
    p5: q(0.05),
    p25: q(0.25),
    median: n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)],
    p75: q(0.75),
    p95: q(0.95),
    max: sorted[n - 1],
    n,
  };
}
