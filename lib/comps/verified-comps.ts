/**
 * Verified comparable deals: ranking, relaxation, summary stats and the
 * confidence label for the calculator results page ("Deals like yours").
 *
 * Pure and side-effect free (no Supabase, no next/headers) so it can be unit
 * tested and imported from client components. The server half that reads
 * `deals_verified` lives in lib/comps/verified-comps.server.ts.
 *
 * Ladder. Every rung keeps the therapeutic area. Rungs are tried in order and
 * the first one with at least MIN_COMPS deals wins; each deal is also tagged
 * with the narrowest rung it satisfies, which is its primary sort key, so the
 * closest deals always lead the list even when the pool had to widen.
 *
 *   structure = acquisition vs licensing (an acquisition price is not a
 *               licensing upfront, so structure is held longest)
 *   territory = rights scope (global query: global / unknown / US rights;
 *               regional query: that region)
 *
 * @module lib/comps/verified-comps
 */

import { modalitiesMatch, indicationMatches } from '@/lib/comparables/match-normalize';
import { phaseRank, phaseRelation, shouldExcludeForStage, territoryScope, canonicalPhase } from '@/lib/comparable-scoring';

/** Below this many deals a rung is too thin and the ladder widens. */
export const MIN_COMPS = 5;
/** The pool is the N closest deals of the chosen rung. */
export const MAX_POOL = 25;
/** "Close" comps for the confidence label: phase within one step, same modality or indication, same structure. */
export const HIGH_CONFIDENCE_CLOSE_COMPS = 8;
export const LOW_CONFIDENCE_CLOSE_COMPS = 3;
export const MIN_CALIBRATED_SAMPLE = 10;

export type PhaseConstraint = 'same' | 'adjacent' | 'any';

export interface CompRung {
  phase: PhaseConstraint;
  modality: boolean;
  indication: boolean;
  structure: boolean;
  territory: boolean;
}

const r = (phase: PhaseConstraint, modality: boolean, indication: boolean, structure: boolean, territory: boolean): CompRung =>
  ({ phase, modality, indication, structure, territory });

/** Narrowest first. Index 0 is an exact match on every input. */
export const COMP_LADDER: readonly CompRung[] = [
  r('same', true, true, true, true),
  r('same', true, false, true, true),
  r('same', false, true, true, true),
  r('adjacent', true, false, true, true),
  r('adjacent', false, true, true, true),
  r('same', true, false, true, false),
  r('same', false, true, true, false),
  r('adjacent', true, false, true, false),
  r('adjacent', false, true, true, false),
  r('same', false, false, true, true),
  r('adjacent', false, false, true, true),
  r('adjacent', false, false, true, false),
  r('any', true, false, true, false),
  r('any', false, false, true, false),
  r('adjacent', false, false, false, false),
  r('any', false, false, false, false),
];

export interface CompsQuery {
  therapeuticArea: string;
  phase?: string | null;
  modality?: string | null;
  indication?: string | null;
  dealType?: string | null;
  territory?: string | null;
}

/** A primary-sourced deal row as read from `deals_verified` (already mapped). */
export interface CompCandidateRow {
  id: string;
  licensor: string;
  licensee: string;
  asset: string | null;
  year: number;
  /** ISO date, when known. */
  announcedDate: string | null;
  therapeuticArea: string | null;
  phase: string | null;
  modality: string | null;
  indicationCategory: string | null;
  indicationSpecific: string | null;
  dealType: string | null;
  territory: string | null;
  upfrontM: number;
  totalM: number | null;
  royaltyLowPct: number | null;
  royaltyHighPct: number | null;
  sourceUrl: string;
  sourceLabel: string;
  /** deals.deal_subtype: 'asset_purchase' | 'company_acquisition' | null. */
  dealSubtype?: string | null;
}

export interface CompMatch {
  phase: 'same' | 'adjacent' | 'none';
  modality: boolean;
  indication: boolean;
  structure: boolean;
  territory: boolean;
}

export interface VerifiedComp extends CompCandidateRow {
  match: CompMatch;
  /** Narrowest ladder rung this deal satisfies (0 = exact). */
  rung: number;
  /** True when the deal counts toward the confidence label. */
  close: boolean;
  /** Acquisitions only: asset purchase, whole-company acquisition, or not stated. Null for licenses. */
  acquisitionKind: AcquisitionKind | null;
}

export interface CompsSummary {
  n: number;
  medianUpfrontM: number | null;
  p25UpfrontM: number | null;
  p75UpfrontM: number | null;
  medianTotalM: number | null;
  nTotal: number;
}

export interface CompsSelection {
  comps: VerifiedComp[];
  summary: CompsSummary;
  /** Index into COMP_LADDER of the rung that produced the pool, or null when empty. */
  rungIndex: number | null;
  rung: CompRung | null;
  /** True when the pool needed widening past an exact match. */
  relaxed: boolean;
  closeCount: number;
  /**
   * Acquisition queries: 'asset_purchases' when the headline stats come from
   * asset purchases only (3 or more in the pool); otherwise 'all'.
   */
  headlineBasis: 'all' | 'asset_purchases';
  assetPurchaseCount: number;
  companyAcquisitionCount: number;
  /** Plain note about the acquisition mix, or null. */
  acquisitionNote: string | null;
  /** Set when the comp mix itself limits confidence (acquisitions with < 3 asset purchases). */
  confidenceCap: ConfidenceLevel | null;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const MA_TYPES = new Set(['acquisition', 'acquisitions', 'merger', 'm&a']);

export function isAcquisitionType(dealType: string | null | undefined): boolean {
  return MA_TYPES.has((dealType ?? '').toLowerCase().trim());
}

/** Region keywords for regional territory queries. */
const REGION_PATTERNS: Record<string, RegExp> = {
  china: /china/i,
  japan: /japan/i,
  europe: /europe|\beu\b/i,
  south_korea: /korea/i,
  us_only: /^(us|us_only|united states)$/i,
  mena: /mena|middle east/i,
  latam: /latin|latam|south america/i,
  canada: /canada/i,
  australia: /australia/i,
  apac_ex_cj: /asia|apac/i,
};

/** "ex_china", "global ex-Greater China", "rest of world excluding Greater China", "outside China". */
const EX_CHINA = /^global|\bex[\s_.-]*(\(?excluding\s+)?(mainland\s+)?(greater[\s_]+)?china|exclud\w*\s+(mainland\s+)?(greater\s+)?china|outside\s+(of\s+)?(mainland\s+)?(greater\s+)?china/i;

/** Calculator territories that mean global or near-global rights. */
const BROAD_TERRITORIES = new Set(['', 'global', 'us_eu', 'us_japan', 'row']);

export function isRegionalTerritory(territory: string | null | undefined): boolean {
  return !BROAD_TERRITORIES.has((territory ?? '').trim());
}

/**
 * Does the deal's rights scope match the query's? Acquisitions buy the whole
 * asset, so they match any territory.
 */
export function territoryMatches(queryTerritory: string | null | undefined, deal: { territory: string | null; dealType: string | null }): boolean {
  if (isAcquisitionType(deal.dealType)) return true;
  const q = (queryTerritory ?? '').trim();
  const dealT = (deal.territory ?? '').trim();
  if (!isRegionalTerritory(q)) {
    // Global query: global / US-led rights, or not recorded (most unrecorded rows are worldwide licenses).
    return territoryScope(dealT) !== 'partial';
  }
  if (q === 'china') {
    // "ex_china" is a global-ex-China license, the opposite of a China license.
    return /china/i.test(dealT) && !EX_CHINA.test(dealT);
  }
  const pattern = REGION_PATTERNS[q];
  if (pattern) return pattern.test(dealT);
  return territoryScope(dealT) === 'partial';
}

export function matchComp(query: CompsQuery, deal: CompCandidateRow): CompMatch {
  const rel = query.phase ? phaseRelation(query.phase, deal.phase) : 'none';
  return {
    phase: rel,
    modality: !!query.modality && modalitiesMatch(query.modality, deal.modality),
    indication: !!query.indication && indicationMatches(query.indication, deal.indicationSpecific, deal.indicationCategory),
    structure: isAcquisitionType(query.dealType) === isAcquisitionType(deal.dealType),
    territory: territoryMatches(query.territory, deal),
  };
}

export function satisfiesRung(m: CompMatch, rung: CompRung): boolean {
  if (rung.phase === 'same' && m.phase !== 'same') return false;
  if (rung.phase === 'adjacent' && m.phase === 'none') return false;
  if (rung.modality && !m.modality) return false;
  if (rung.indication && !m.indication) return false;
  if (rung.structure && !m.structure) return false;
  if (rung.territory && !m.territory) return false;
  return true;
}

export function narrowestRung(m: CompMatch): number {
  for (let i = 0; i < COMP_LADDER.length; i++) {
    if (satisfiesRung(m, COMP_LADDER[i])) return i;
  }
  return COMP_LADDER.length; // never reached: the last rung accepts everything
}

export function isCloseComp(m: CompMatch): boolean {
  return m.phase !== 'none' && (m.modality || m.indication) && m.structure;
}

// ---------------------------------------------------------------------------
// Acquisitions: asset purchase vs whole-company buyout
// ---------------------------------------------------------------------------

export type AcquisitionKind = 'asset' | 'company' | 'unknown';

/** Minimum asset purchases before the headline is computed from them alone. */
export const MIN_ASSET_PURCHASES = 3;

const LEGAL_SUFFIXES = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|llc|plc|gmbh|ag|sa|s\.a|nv|n\.v|bv|b\.v|pte|pty|kk|holdings?|group|therapeutics|pharmaceuticals?|pharma|biosciences?|biotherapeutics|biotech(nology)?|biopharma(ceuticals)?|sciences?|medical|labs?|laboratories)\b\.?/gi;

/** "Biotheus Inc." -> "biotheus"; "S*BIO Pte Ltd" -> "s*bio". Empty when nothing distinctive is left. */
export function coreCompanyName(name: string | null | undefined): string {
  const first = (name ?? '').split(/\s*[/(,;]\s*/)[0];
  const core = first.replace(LEGAL_SUFFIXES, ' ').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return core.length >= 3 ? core : '';
}

/**
 * Asset purchase vs whole-company acquisition.
 *  1. `deal_subtype` when set.
 *  2. Company when the asset text names the target company ("Biotheus (BNT327 ...)",
 *     "ProfoundBio (Rina-S)") or says so ("full company acquisition", "portfolio").
 *     An asset text that says "assets" ("Atreca antibody-related assets") is an asset purchase.
 *  3. Otherwise unknown.
 */
export function classifyAcquisition(deal: { dealType: string | null; dealSubtype?: string | null; asset: string | null; licensor: string | null }): AcquisitionKind | null {
  if (!isAcquisitionType(deal.dealType)) return null;
  const sub = (deal.dealSubtype ?? '').toLowerCase();
  if (sub === 'asset_purchase') return 'asset';
  if (sub === 'company_acquisition') return 'company';
  const asset = (deal.asset ?? '').toLowerCase();
  if (!asset) return 'unknown';
  if (/\bassets?\b/.test(asset) && !/full (company )?acquisition/.test(asset)) return 'asset';
  if (/full (company )?acquisition|company acquisition|\bportfolio\b|\bpipeline\b/.test(asset)) return 'company';
  const core = coreCompanyName(deal.licensor);
  if (core && asset.includes(core)) return 'company';
  return 'unknown';
}

const KIND_RANK: Record<AcquisitionKind, number> = { asset: 0, unknown: 1, company: 2 };

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Linear-interpolated quantile (type 7, same as numpy / Excel PERCENTILE.INC). */
export function quantile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const h = (s.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return s[lo] + (s[hi] - s[lo]) * (h - lo);
}

export function summarizeComps(comps: Pick<CompCandidateRow, 'upfrontM' | 'totalM'>[]): CompsSummary {
  const ups = comps.map(c => c.upfrontM).filter(v => v > 0);
  const totals = comps.map(c => c.totalM).filter((v): v is number => v != null && v > 0);
  return {
    n: comps.length,
    medianUpfrontM: quantile(ups, 0.5),
    p25UpfrontM: quantile(ups, 0.25),
    p75UpfrontM: quantile(ups, 0.75),
    medianTotalM: quantile(totals, 0.5),
    nTotal: totals.length,
  };
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/**
 * Rank `rows` against the query, walk the ladder and return the pool.
 * Rows from other therapeutic areas are ignored (the caller already filters
 * on TA in SQL; this keeps the function safe on its own).
 */
export function selectVerifiedComps(query: CompsQuery, rows: CompCandidateRow[], opts: { maxPool?: number; minComps?: number } = {}): CompsSelection {
  const maxPool = opts.maxPool ?? MAX_POOL;
  const minComps = opts.minComps ?? MIN_COMPS;
  const ta = query.therapeuticArea.toLowerCase();

  const acquisitionQuery = isAcquisitionType(query.dealType);

  const tagged: VerifiedComp[] = rows
    .filter(d => (d.therapeuticArea ?? '').toLowerCase() === ta)
    .filter(d => d.upfrontM > 0)
    .filter(d => !shouldExcludeForStage(query.phase, d.phase, d.dealType))
    .map(d => {
      const match = matchComp(query, d);
      return { ...d, match, rung: narrowestRung(match), close: isCloseComp(match), acquisitionKind: classifyAcquisition(d) };
    });

  const inRung = (i: number) => tagged.filter(d => satisfiesRung(d.match, COMP_LADDER[i]));
  let rungIndex: number | null = null;
  let firstNonEmpty: number | null = null;
  for (let i = 0; i < COMP_LADDER.length; i++) {
    const count = inRung(i).length;
    if (count > 0 && firstNonEmpty == null) firstNonEmpty = i;
    if (count >= minComps) { rungIndex = i; break; }
  }
  // Acquisition query: an asset sale is priced off asset purchases, so keep
  // widening (while still holding acquisitions) until 3 asset purchases appear.
  if (acquisitionQuery && rungIndex != null) {
    for (let i = rungIndex; i < COMP_LADDER.length && COMP_LADDER[i].structure; i++) {
      if (inRung(i).filter(d => d.acquisitionKind === 'asset').length >= MIN_ASSET_PURCHASES) { rungIndex = i; break; }
    }
  }
  // Nothing reached the minimum: take the widest rung with anything in it.
  if (rungIndex == null && firstNonEmpty != null) rungIndex = COMP_LADDER.length - 1;

  if (rungIndex == null) {
    return {
      comps: [], summary: summarizeComps([]), rungIndex: null, rung: null, relaxed: false, closeCount: 0,
      headlineBasis: 'all', assetPurchaseCount: 0, companyAcquisitionCount: 0, acquisitionNote: null, confidenceCap: null,
    };
  }

  const rung = COMP_LADDER[rungIndex];
  const kindRank = (d: VerifiedComp) => (acquisitionQuery && d.acquisitionKind ? KIND_RANK[d.acquisitionKind] : 0);
  const pool = inRung(rungIndex)
    .sort((a, b) =>
      kindRank(a) - kindRank(b) ||
      a.rung - b.rung ||
      Number(b.close) - Number(a.close) ||
      (b.announcedDate ?? String(b.year)).localeCompare(a.announcedDate ?? String(a.year)),
    )
    .slice(0, maxPool);

  const assets = pool.filter(d => d.acquisitionKind === 'asset');
  const companies = pool.filter(d => d.acquisitionKind === 'company');
  let headline = pool;
  let headlineBasis: CompsSelection['headlineBasis'] = 'all';
  let acquisitionNote: string | null = null;
  let confidenceCap: ConfidenceLevel | null = null;
  if (acquisitionQuery && pool.length > 0) {
    if (assets.length >= MIN_ASSET_PURCHASES) {
      headline = assets;
      headlineBasis = 'asset_purchases';
      acquisitionNote = `Median and range from the ${assets.length} asset purchases. Whole-company acquisitions are listed separately.`;
    } else {
      confidenceCap = 'low';
      acquisitionNote = companies.length * 2 > pool.length
        ? `Most of these are whole-company acquisitions, which are usually priced well above an asset sale. Fewer than ${MIN_ASSET_PURCHASES} asset purchases match.`
        : `Fewer than ${MIN_ASSET_PURCHASES} of these are confirmed asset purchases; the rest may be whole-company acquisitions, which are usually priced well above an asset sale.`;
    }
  }

  return {
    comps: pool,
    summary: summarizeComps(headline),
    rungIndex,
    rung,
    relaxed: rungIndex > 0,
    closeCount: headline.filter(d => d.close).length,
    headlineBasis,
    assetPurchaseCount: assets.length,
    companyAcquisitionCount: companies.length,
    acquisitionNote,
    confidenceCap,
  };
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface BaselineInfo {
  source: 'calibrated' | 'static' | null | undefined;
  sampleSize: number | null | undefined;
}

export interface ConfidenceResult {
  level: ConfidenceLevel;
  reason: string;
}

/**
 * High / Medium / Low:
 *  - fewer than 3 close comparable deals            → Low
 *  - starting point not measured on ≥10 deals       → at most Medium
 *  - 8+ close comps and a measured starting point   → High
 *  - otherwise                                      → Medium
 */
export function computeConfidence(closeCount: number, baseline: BaselineInfo | null | undefined, cap?: ConfidenceLevel | null): ConfidenceResult {
  if (cap === 'low') {
    return {
      level: 'low',
      reason: 'Few comparable asset purchases; most acquisitions with disclosed prices bought a whole company. Lean on the comparable deals, not the estimate.',
    };
  }
  const calibrated = baseline?.source === 'calibrated' && (baseline.sampleSize ?? 0) >= MIN_CALIBRATED_SAMPLE;
  if (closeCount < LOW_CONFIDENCE_CLOSE_COMPS) {
    return {
      level: 'low',
      reason: closeCount === 0
        ? 'No closely comparable deals with disclosed terms. Lean on the comparable deals, not the estimate.'
        : `Only ${closeCount} closely comparable ${closeCount === 1 ? 'deal' : 'deals'} with disclosed terms. Lean on the comparable deals, not the estimate.`,
    };
  }
  if (!calibrated) {
    return {
      level: 'medium',
      reason: `${closeCount} close comparable deals, but the starting point for this stage rests on fewer than ${MIN_CALIBRATED_SAMPLE} disclosed deals.`,
    };
  }
  if (closeCount >= HIGH_CONFIDENCE_CLOSE_COMPS) {
    return { level: 'high', reason: `${closeCount} close comparable deals and a starting point measured on ${baseline?.sampleSize} disclosed deals.` };
  }
  return { level: 'medium', reason: `${closeCount} close comparable deals; ${HIGH_CONFIDENCE_CLOSE_COMPS} or more would make this high confidence.` };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const TA_LABELS: Record<string, string> = {
  oncology: 'oncology', neurology: 'neurology', immunology: 'immunology', metabolic: 'metabolic disease',
  cardiovascular: 'cardiovascular', infectiousDisease: 'infectious disease', ophthalmology: 'ophthalmology',
  womensHealth: "women's health", rareDisease: 'rare disease', hematology: 'hematology',
  dermatology: 'dermatology', gastroenterology: 'gastroenterology',
};

const PHASE_NAMES: Record<string, string> = {
  discovery: 'Discovery', preclinical: 'Preclinical', phase_1: 'Phase 1', phase_1_2: 'Phase 1/2', phase_2: 'Phase 2',
  phase_2_3: 'Phase 2/3', phase_3: 'Phase 3', nda_filed: 'Filed', bla_filed: 'Filed', approved: 'Approved', marketed: 'Approved',
};

export function phaseName(phase: string | null | undefined): string {
  const c = canonicalPhase(phase);
  return c ? PHASE_NAMES[c] : 'Stage not stated';
}

/** "Phase 1–3" for Phase 2 widened by one step either side. */
export function adjacentPhaseRange(phase: string | null | undefined): string {
  const rank = phaseRank(phase);
  if (rank == null) return 'all-stage';
  const ladder = ['discovery', 'preclinical', 'phase_1', 'phase_2', 'phase_3', 'nda_filed', 'approved'];
  const inRange = ladder.filter(p => Math.abs((phaseRank(p) as number) - rank) <= 1);
  const first = PHASE_NAMES[inRange[0]];
  const last = PHASE_NAMES[inRange[inRange.length - 1]];
  if (first.startsWith('Phase') && last.startsWith('Phase')) return `${first}–${last.replace('Phase ', '')}`;
  return `${first} to ${last}`;
}

const TERRITORY_LABELS: Record<string, string> = {
  china: 'Greater China', japan: 'Japan', europe: 'Europe', south_korea: 'South Korea', us_only: 'US',
  ex_us: 'ex-US', canada: 'Canada', australia: 'Australia', latam: 'Latin America', mena: 'Middle East and North Africa',
  apac_ex_cj: 'Asia-Pacific',
};

export interface QueryLabels {
  /** Human labels as shown in the calculator, e.g. result.labels. */
  modality?: string | null;
  indication?: string | null;
}

function describe(query: CompsQuery, rung: CompRung, labels: QueryLabels): string {
  const parts: string[] = [];
  if (rung.phase === 'same') parts.push(phaseName(query.phase));
  else if (rung.phase === 'adjacent') parts.push(adjacentPhaseRange(query.phase));
  if (rung.modality && labels.modality) parts.push(labels.modality.toLowerCase());
  const noun = !rung.structure ? 'deals' : isAcquisitionType(query.dealType) ? 'acquisitions' : 'licensing deals';
  parts.push(noun);
  const area = rung.indication && labels.indication ? labels.indication : (TA_LABELS[query.therapeuticArea] ?? query.therapeuticArea);
  let text = `${parts.join(' ')} in ${area}`;
  if (!isAcquisitionType(query.dealType)) {
    if (isRegionalTerritory(query.territory)) {
      const t = TERRITORY_LABELS[query.territory ?? ''] ?? 'regional';
      text += rung.territory && rung.structure ? ` for ${t} rights` : ', any territory';
    } else if (!rung.territory) {
      text += ', including regional licenses';
    }
  }
  return text;
}

/**
 * Plain description of what the pool is, and an honest note when the ladder
 * had to widen: "No Phase 2 peptide acquisitions in prostate cancer with
 * disclosed terms; showing Phase 1–3 acquisitions in oncology."
 */
export function describeSelection(query: CompsQuery, rungIndex: number | null, labels: QueryLabels): { shown: string; relaxationNote: string | null } {
  const exact = describe(query, COMP_LADDER[0], labels);
  if (rungIndex == null) return { shown: exact, relaxationNote: `No ${exact} with disclosed terms and a public source yet.` };
  const shown = describe(query, COMP_LADDER[rungIndex], labels);
  if (rungIndex === 0) return { shown, relaxationNote: null };
  return { shown, relaxationNote: `Fewer than ${MIN_COMPS} ${exact} with disclosed terms; showing ${shown}.` };
}

// ---------------------------------------------------------------------------
// Estimate vs comps
// ---------------------------------------------------------------------------

export interface ModifierLike { name: string; multiplier: number; applied?: number }

export interface Driver { name: string; pct: number }

/** Factors that moved the estimate, largest effect first. */
export function topDrivers(modifiers: ModifierLike[], limit = 4): Driver[] {
  return modifiers
    .map(m => ({ name: m.name, effect: m.applied ?? m.multiplier }))
    .filter(m => Number.isFinite(m.effect) && m.effect > 0 && Math.abs(m.effect - 1) >= 0.03)
    .sort((a, b) => Math.abs(Math.log(b.effect)) - Math.abs(Math.log(a.effect)))
    .slice(0, limit)
    .map(m => ({ name: m.name, pct: Math.round((m.effect - 1) * 100) }));
}

/**
 * "1.8x the comparable median, mainly because of Peptide (+25%)."
 * Picks the biggest factor pushing in the same direction as the gap.
 */
/**
 * Deal-structure modifiers set the basis of the estimate (the comps are already of that structure), so they never
 * explain a gap to the comps.
 */
const STRUCTURE_MODIFIERS = new Set([
  'Asset purchase', 'Acquisition / M&A', 'Co-Development', 'Option Agreement', 'Research Collaboration', 'Reformulation / 505(b)(2)',
]);

export function estimateVsComps(estimateM: number, compMedianM: number | null, allModifiers: ModifierLike[]): { ratio: number | null; sentence: string | null } {
  if (!compMedianM || compMedianM <= 0 || !(estimateM > 0)) return { ratio: null, sentence: null };
  const ratio = estimateM / compMedianM;
  const modifiers = allModifiers.filter(m => !STRUCTURE_MODIFIERS.has(m.name));
  const drivers = topDrivers(modifiers, 10);
  let head: string;
  if (ratio >= 1.15) head = `${ratio.toFixed(1)}x the comparable median`;
  else if (ratio <= 1 / 1.15) head = `${Math.round(ratio * 100)}% of the comparable median`;
  else return { ratio, sentence: 'In line with the comparable median.' };
  const same = drivers.find(d => (ratio > 1 ? d.pct > 0 : d.pct < 0));
  // Only blame a factor when the factors pushing that way explain at least half the gap (in log terms).
  // A +17% factor cannot explain 5.2x; then the gap is in the starting point for the stage, so say that.
  const pushing = modifiers
    .map(m => m.applied ?? m.multiplier)
    .filter(e => Number.isFinite(e) && e > 0 && (ratio > 1 ? e > 1 : e < 1));
  const explained = pushing.reduce((acc, e) => acc + Math.log(e), 0);
  if (same && Math.abs(explained) >= Math.abs(Math.log(ratio)) / 2) {
    return { ratio, sentence: `${head}, mainly because of ${same.name} (${same.pct > 0 ? '+' : ''}${same.pct}%).` };
  }
  const where = ratio > 1 ? 'above' : 'below';
  return { ratio, sentence: `${head}. Most of the gap is in the starting point for this stage, which sits ${where} what these deals paid, so lean on the deals.` };
}
