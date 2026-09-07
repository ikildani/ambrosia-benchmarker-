/**
 * Peer benchmark — compute where a given deal sits in the distribution of
 * comparable real deals from the corpus. Sidebar on /calculator results
 * shows "your deal at Xth percentile" as inputs change.
 *
 * Deliberately sync + fast. Reads from the bundled corpus, no DB call.
 *
 * @module lib/peer-benchmark
 */

import { EXTENDED_COMPARABLE_DEALS } from '@/data/comparable-deals-extended';
import { SUPABASE_COMPARABLE_DEALS } from '@/data/comparable-deals-supabase';
import { classifyDealStructure, type DealStructure } from '@/lib/financial/deal-structure-classifier';
import {
  scoreCompMatch,
  selectWithRelaxation,
  shouldExcludeForStage,
  COMP_MATCH_WEIGHTS,
  COMP_MAX_SCORE,
  type CompRelaxation,
} from '@/lib/comparable-scoring';

export interface PeerBenchmarkInput {
  therapeuticArea?: string;
  phase?: string;
  modality?: string;
  /** Indication slug (e.g. 'pancreatic'). Scores +3 when the corpus deal matches. */
  indication?: string;
  /** Candidate deal's upfront ($M) — the point we're benchmarking */
  candidateUpfront_M?: number;
  /** Candidate total deal value ($M). */
  candidateTotalDeal_M?: number;
  /** Candidate deal's classified structure. When present, peer
   *  benchmark filters comparables to the same structure so the
   *  comparison is apples-to-apples (option deals to option deals,
   *  classic licenses to classic licenses). The existing TA/phase/
   *  modality widening still applies on top. */
  dealStructure?: DealStructure;
  /** Deal type — used to classify corpus deals when dealStructure is
   *  supplied (classifier needs dealType on both sides). */
  dealType?: string;
  /** Territory — used to classify corpus deals. */
  territory?: string;
}

export interface PeerBenchmarkResult {
  /** Number of comparable deals that matched the filter */
  n: number;
  /** Breadth level — how relaxed the filter had to be to get a usable sample */
  matchLevel: 'strict' | 'widened' | 'ta-only' | 'global';
  /** Distribution percentiles across comparable total deal values ($M). */
  totalDealPercentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
  /** Distribution percentiles across comparable upfronts ($M). */
  upfrontPercentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
  /** Candidate's percentile rank within comparable total deal values (0-100). */
  candidateTotalDealPercentile: number | null;
  /** Candidate's percentile rank within comparable upfronts (0-100). */
  candidateUpfrontPercentile: number | null;
  /** Human-readable narrative summarizing the position */
  narrative: string;
}

interface MinimalDeal {
  therapeuticArea: string;
  phase: string;
  modality: string;
  upfront: number;
  totalDealValue: number;
  /** Pre-computed deal-structure classification for this corpus row.
   *  Cached at corpus load so per-benchmark calls don't re-classify. */
  structure: DealStructure;
  /** Full metadata for UI display — not used for matching/percentiles. */
  licensor: string;
  licensee: string;
  year: number;
  indication: string;
  dealType: string;
  headline?: string;
  sourceUrl?: string;
  verified: boolean;
}

/** Public shape for the calculator results page. Each match is a real
 *  disclosed deal with enough metadata for a BD user to verify it. */
export interface ComparableDealForUI {
  licensor: string;
  licensee: string;
  year: number;
  therapeuticArea: string;
  phase: string;
  modality: string;
  indication: string;
  dealType: string;
  upfrontM: number;
  totalDealValueM: number;
  headline?: string;
  sourceUrl?: string;
  /** How well this deal matches the candidate (composite score 0-1).
   *  Higher = closer match. Used for ranking display. */
  matchScore: number;
  /** Human-readable reason this deal was selected. */
  matchReason: string;
  /** True if human-verified. False = pending/unaudited (show "Unverified"
   *  badge in UI so users know the data hasn't been confirmed). */
  verified: boolean;
}

export interface ClosestComparablesResult {
  deals: ComparableDealForUI[];
  /** Which rung of the relaxation ladder produced the pool. */
  relaxation: CompRelaxation;
  /** Approved-stage M&A rows dropped because the candidate is pre-approval. */
  excludedApprovedMA: number;
}

let cachedCorpus: MinimalDeal[] | null = null;

function combinedCorpus(): MinimalDeal[] {
  if (cachedCorpus) return cachedCorpus;
  const rows: MinimalDeal[] = [];
  for (const d of [...EXTENDED_COMPARABLE_DEALS, ...SUPABASE_COMPARABLE_DEALS]) {
    if (!d.upfront || !d.totalDealValue || d.upfront <= 0 || d.totalDealValue <= 0) continue;
    const { structure } = classifyDealStructure({
      phase: d.phase,
      dealType: d.dealType ?? 'license',
      modality: d.modality,
      therapeuticArea: d.therapeuticArea,
      territory: d.territory ?? 'global',
      licensor: d.licensor,
      licensee: d.licensee,
    });
    rows.push({
      therapeuticArea: d.therapeuticArea,
      phase: d.phase,
      modality: d.modality,
      upfront: d.upfront,
      totalDealValue: d.totalDealValue,
      structure,
      licensor: d.licensor,
      licensee: d.licensee,
      year: d.year,
      indication: d.indication_specific || d.indication_category || '',
      dealType: d.dealType ?? 'license',
      headline: d.headline ?? undefined,
      sourceUrl: (() => {
        const src = d.source ?? '';
        const match = src.match(/(https?:\/\/[^\s]+)/);
        return match ? match[1] : undefined;
      })(),
      verified: d.verified !== false,
    });
  }
  cachedCorpus = rows;
  return rows;
}

// ---------------------------------------------------------------------------
// Closest-comparables retrieval for UI display
// ---------------------------------------------------------------------------

/**
 * Return the top-N closest comparable deals for UI display. Unlike the
 * percentile-based computePeerBenchmark which returns aggregate stats,
 * this returns actual deal rows with full metadata so the calculator
 * results page can show named comparables the BD user can verify.
 *
 * Ranking uses the shared weight table in lib/comparable-scoring.ts
 * (TA 3 · same phase 4 · adjacent phase 2 · modality 3 · indication 3 ·
 * deal type 2 · recency 2, max 17). A modality-family match earns half the
 * modality weight; a deal-structure match earns half the deal-type weight
 * when the exact deal type does not match. matchScore = score / 17.
 *
 * Pass rule: TA + one of {same phase, adjacent phase, indication}; relaxes
 * to TA + modality, then TA only, when fewer than 5 deals pass. Approved-stage
 * acquisitions are excluded for pre-approval candidates.
 *
 * Ties broken by recency then by |candidate.upfront - comp.upfront|.
 */
export function getClosestComparablesWithMeta(
  input: PeerBenchmarkInput & { limit?: number },
): ClosestComparablesResult {
  const corpus = combinedCorpus();
  if (!input.therapeuticArea) return { deals: [], relaxation: 'none', excludedApprovedMA: 0 };
  const limit = input.limit ?? 8;

  const FAMILY: Record<string, string[]> = {
    antibody: ['mab', 'antibody', 'bispecific', 'bispecificAntibody', 'trispecificAntibody', 'adc'],
    smallMolecule: ['small_molecule', 'smallMolecule', 'protac'],
    oligonucleotide: ['oligonucleotide', 'rnai', 'aso', 'mrna'],
    cellTherapy: ['cell_therapy', 'cellTherapy', 'car_t', 'carT_heme', 'carT_solid', 'til_therapy'],
    geneTherapy: ['gene_therapy', 'geneTherapy', 'crispr_base_editing', 'crispr_prime_editing', 'geneEditing'],
  };
  function sameFamily(a: string, b: string): boolean {
    for (const fam of Object.values(FAMILY)) {
      if (fam.includes(a) && fam.includes(b)) return true;
    }
    return false;
  }

  let excludedApprovedMA = 0;
  const scored = corpus
    .filter(d => d.therapeuticArea === input.therapeuticArea)
    .filter(d => {
      if (shouldExcludeForStage(input.phase, d.phase, d.dealType)) { excludedApprovedMA++; return false; }
      return true;
    })
    .map(d => {
      const r = scoreCompMatch(
        { therapeuticArea: input.therapeuticArea, phase: input.phase, modality: input.modality, indication: input.indication, dealType: input.dealType },
        { therapeuticArea: d.therapeuticArea, phase: d.phase, modalities: [d.modality], indications: [d.indication], dealType: d.dealType, year: d.year },
        { recency: 'continuous' },
      );
      let score = r.score;
      const reasons = [...r.reasons];

      // Partial credit: same modality family (half weight)
      if (input.modality && !r.breakdown.modality && sameFamily(d.modality, input.modality)) {
        score += COMP_MATCH_WEIGHTS.modality / 2;
        reasons.push('Same modality family');
      }
      // Partial credit: same deal structure when deal type itself differs (half weight)
      if (input.dealStructure && !r.breakdown.dealType && d.structure === input.dealStructure) {
        score += COMP_MATCH_WEIGHTS.dealType / 2;
        reasons.push('Same deal structure');
      }

      return { deal: d, score, breakdown: r.breakdown, reasons };
    });

  const { items, relaxation } = selectWithRelaxation(scored, s => s.breakdown);

  const matches = items
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.deal.year !== a.deal.year) return b.deal.year - a.deal.year;
      // Tiebreak: prefer smaller absolute delta vs candidate upfront.
      if (input.candidateUpfront_M) {
        const da = Math.abs(a.deal.upfront - input.candidateUpfront_M);
        const db = Math.abs(b.deal.upfront - input.candidateUpfront_M);
        return da - db;
      }
      return 0;
    })
    .slice(0, limit);

  const deals = matches.map(m => ({
    licensor: m.deal.licensor,
    licensee: m.deal.licensee,
    year: m.deal.year,
    therapeuticArea: m.deal.therapeuticArea,
    phase: m.deal.phase,
    modality: m.deal.modality,
    indication: m.deal.indication,
    dealType: m.deal.dealType,
    upfrontM: m.deal.upfront,
    totalDealValueM: m.deal.totalDealValue,
    headline: m.deal.headline,
    sourceUrl: m.deal.sourceUrl,
    matchScore: Math.round(Math.min(m.score / COMP_MAX_SCORE, 1) * 100) / 100,
    matchReason: m.reasons.join(' · '),
    verified: m.deal.verified,
  }));

  return { deals, relaxation, excludedApprovedMA };
}

/** Array-only convenience wrapper around getClosestComparablesWithMeta. */
export function getClosestComparables(
  input: PeerBenchmarkInput & { limit?: number },
): ComparableDealForUI[] {
  return getClosestComparablesWithMeta(input).deals;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function rankPercentile(sorted: number[], value: number): number {
  if (sorted.length === 0) return 50;
  // Find first index where sorted[i] >= value. Everything before is strictly less.
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  // `lo` is how many deals are < value. Percentile rank = (strictly less / total).
  return Math.round((lo / sorted.length) * 100);
}

function matchesFilter(d: MinimalDeal, filter: {
  ta?: string;
  phase?: string;
  modality?: string;
  structure?: DealStructure;
}): boolean {
  if (filter.ta && d.therapeuticArea !== filter.ta) return false;
  if (filter.phase && d.phase !== filter.phase) return false;
  if (filter.modality && d.modality !== filter.modality) return false;
  if (filter.structure && d.structure !== filter.structure) return false;
  return true;
}

function computeStats(pool: MinimalDeal[], input: PeerBenchmarkInput, matchLevel: PeerBenchmarkResult['matchLevel']): PeerBenchmarkResult {
  const sortedUpfront = pool.map(d => d.upfront).sort((a, b) => a - b);
  const sortedTotal = pool.map(d => d.totalDealValue).sort((a, b) => a - b);

  const totalDealPercentiles = {
    p10: percentile(sortedTotal, 10),
    p25: percentile(sortedTotal, 25),
    p50: percentile(sortedTotal, 50),
    p75: percentile(sortedTotal, 75),
    p90: percentile(sortedTotal, 90),
  };
  const upfrontPercentiles = {
    p10: percentile(sortedUpfront, 10),
    p25: percentile(sortedUpfront, 25),
    p50: percentile(sortedUpfront, 50),
    p75: percentile(sortedUpfront, 75),
    p90: percentile(sortedUpfront, 90),
  };

  const candidateTotalDealPercentile = input.candidateTotalDeal_M != null
    ? rankPercentile(sortedTotal, input.candidateTotalDeal_M)
    : null;
  const candidateUpfrontPercentile = input.candidateUpfront_M != null
    ? rankPercentile(sortedUpfront, input.candidateUpfront_M)
    : null;

  const narrative = buildNarrative(
    pool.length,
    matchLevel,
    candidateUpfrontPercentile,
    candidateTotalDealPercentile,
    input,
  );

  return {
    n: pool.length,
    matchLevel,
    totalDealPercentiles,
    upfrontPercentiles,
    candidateTotalDealPercentile,
    candidateUpfrontPercentile,
    narrative,
  };
}

function buildNarrative(
  n: number,
  matchLevel: PeerBenchmarkResult['matchLevel'],
  upfrontPct: number | null,
  totalPct: number | null,
  input: PeerBenchmarkInput,
): string {
  if (n < 3) return 'Too few comparable deals for a meaningful benchmark.';

  const scopeDescription = (() => {
    if (matchLevel === 'strict') return `${n} same-TA, same-phase, same-modality comparables`;
    if (matchLevel === 'widened') return `${n} same-TA, same-phase comparables (modality widened)`;
    if (matchLevel === 'ta-only') return `${n} same-TA comparables`;
    return `${n} comparable deals (broad)`;
  })();

  if (upfrontPct != null && totalPct != null) {
    const uf = `p${upfrontPct}`;
    const td = `p${totalPct}`;
    return `Your deal sits at ${uf} on upfront and ${td} on total value vs ${scopeDescription}.`;
  }
  if (upfrontPct != null) {
    return `Your upfront sits at p${upfrontPct} vs ${scopeDescription}.`;
  }
  if (totalPct != null) {
    return `Your total deal value sits at p${totalPct} vs ${scopeDescription}.`;
  }
  return `${scopeDescription} available. Enter an upfront or total deal value to see where you sit.`;
}

const MIN_POOL_FOR_STRICT = 8;
const MIN_POOL_FOR_WIDENED = 5;
const MIN_POOL_FOR_TA = 5;

/**
 * Compute peer benchmark with progressive filter widening:
 *   1. strict: TA + phase + modality
 *   2. widened: TA + phase (modality dropped)
 *   3. ta-only: TA alone
 *   4. global: full corpus
 */
export function computePeerBenchmark(input: PeerBenchmarkInput): PeerBenchmarkResult {
  // Stage sanity: approved-stage M&A is not a peer for a pre-approval candidate.
  const corpus = combinedCorpus().filter(d => !shouldExcludeForStage(input.phase, d.phase, d.dealType));

  // Try strict — including dealStructure match when supplied. If the
  // same-structure pool is too small, we drop the structure filter
  // before dropping TA/phase/modality (structure is a coarser-grained
  // cut than the others and often drains the pool faster).
  if (input.dealStructure) {
    const strictStructure = corpus.filter(d => matchesFilter(d, {
      ta: input.therapeuticArea,
      phase: input.phase,
      modality: input.modality,
      structure: input.dealStructure,
    }));
    if (strictStructure.length >= MIN_POOL_FOR_STRICT) {
      return computeStats(strictStructure, input, 'strict');
    }
    const structureOnlyTA = corpus.filter(d => matchesFilter(d, {
      ta: input.therapeuticArea,
      structure: input.dealStructure,
    }));
    if (structureOnlyTA.length >= MIN_POOL_FOR_TA) {
      return computeStats(structureOnlyTA, input, 'ta-only');
    }
  }

  const strict = corpus.filter(d => matchesFilter(d, {
    ta: input.therapeuticArea,
    phase: input.phase,
    modality: input.modality,
  }));
  if (strict.length >= MIN_POOL_FOR_STRICT) {
    return computeStats(strict, input, 'strict');
  }

  const widened = corpus.filter(d => matchesFilter(d, {
    ta: input.therapeuticArea,
    phase: input.phase,
  }));
  if (widened.length >= MIN_POOL_FOR_WIDENED) {
    return computeStats(widened, input, 'widened');
  }

  const taOnly = corpus.filter(d => matchesFilter(d, {
    ta: input.therapeuticArea,
  }));
  if (taOnly.length >= MIN_POOL_FOR_TA) {
    return computeStats(taOnly, input, 'ta-only');
  }

  return computeStats(corpus, input, 'global');
}
