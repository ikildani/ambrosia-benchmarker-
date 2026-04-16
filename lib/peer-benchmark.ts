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

export interface PeerBenchmarkInput {
  therapeuticArea?: string;
  phase?: string;
  modality?: string;
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
        // Extended deals embed the source URL in `source` field as
        // "press_release — https://..."; extract URL if present.
        const src = d.source ?? '';
        const match = src.match(/(https?:\/\/[^\s]+)/);
        return match ? match[1] : undefined;
      })(),
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
 * Match ranking scores each corpus deal on:
 *   TA match      : 1.0 (required — hard filter)
 *   Phase match   : 0.3  (exact), 0.15 (±1 phase), 0.0 otherwise
 *   Modality match: 0.3  (exact), 0.15 (same family), 0.0 otherwise
 *   Structure match: 0.2 (when candidate structure supplied)
 *   Recency       : 0.2 × (deal year - 2015) / 11  (favors recent)
 *
 * Max score = 1.0 (perfect TA + phase + modality + structure + recency).
 * Ties broken by recency then by |candidate.upfront - comp.upfront|.
 */
export function getClosestComparables(
  input: PeerBenchmarkInput & { limit?: number },
): ComparableDealForUI[] {
  const corpus = combinedCorpus();
  if (!input.therapeuticArea) return [];
  const limit = input.limit ?? 8;

  const FAMILY: Record<string, string[]> = {
    antibody: ['mab', 'antibody', 'bispecific', 'bispecificAntibody', 'adc'],
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

  const phaseOrder = ['preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3', 'approved'];
  function phaseDistance(a: string, b: string): number {
    const ia = phaseOrder.indexOf(a);
    const ib = phaseOrder.indexOf(b);
    if (ia < 0 || ib < 0) return Infinity;
    return Math.abs(ia - ib);
  }

  const matches = corpus
    .filter(d => d.therapeuticArea === input.therapeuticArea)
    .map(d => {
      let score = 0;
      const reasons: string[] = ['same TA'];

      // Phase
      if (input.phase) {
        const dist = phaseDistance(d.phase, input.phase);
        if (dist === 0) {
          score += 0.3;
          reasons.push('exact phase');
        } else if (dist === 1) {
          score += 0.15;
          reasons.push('±1 phase');
        }
      }

      // Modality
      if (input.modality) {
        if (d.modality === input.modality) {
          score += 0.3;
          reasons.push('exact modality');
        } else if (sameFamily(d.modality, input.modality)) {
          score += 0.15;
          reasons.push('same modality family');
        }
      }

      // Structure
      if (input.dealStructure && d.structure === input.dealStructure) {
        score += 0.2;
        reasons.push('same deal structure');
      }

      // Recency
      const years = 11; // 2015-2026 window
      const normalizedRecency = Math.max(0, Math.min(1, (d.year - 2015) / years));
      score += 0.2 * normalizedRecency;

      return { deal: d, score, reasons };
    })
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

  return matches.map(m => ({
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
    matchScore: Math.round(m.score * 100) / 100,
    matchReason: m.reasons.join(' · '),
  }));
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
  const corpus = combinedCorpus();

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
