/**
 * Counterparty Premium Engine (Item 9 — Tier 3 Engine Grade A+)
 *
 * Computes per-buyer historical deal premiums from the deals table. AbbVie
 * famously pays ~1.25x the comparable median (Cerevel, ImmunoGen, Allergan),
 * Gilead post-Immunomedics is ~0.95x. Same asset → different valuations.
 *
 * # Algorithm
 *
 * For each buyer with ≥3 disclosed deals:
 *   1. For each of their deals, find the comparable median across peer deals
 *      (matched on indication_category + phase, widening to TA + phase if
 *      sparse). Skip deals where peers are too sparse.
 *   2. Compute `dealPremium = totalDealValueUsd / peerMedian`.
 *   3. Aggregate per-deal premiums via trimmed mean (drop top/bottom 10% if
 *      n ≥ 10) to suppress one-off megadeal noise.
 *   4. Clamp final premium to [0.7, 1.5]. Anything outside is treated as
 *      suspect (small sample, weird outliers).
 *
 * # Confidence levels
 *
 *   high   → n ≥ 10 deals
 *   medium → 5 ≤ n ≤ 9
 *   low    → 3 ≤ n ≤ 4 (premium is applied at half weight downstream)
 *
 * # Why trimmed mean instead of median
 *
 * Median is robust but discards information when n is small. Trimmed mean
 * keeps more signal while still suppressing outliers. For n < 10 we fall
 * back to a simple mean (trimming would just delete data).
 *
 * @module lib/financial/counterparty-premiums
 */

import type { CounterpartyPremium, CounterpartyPremiumLookup } from './types';
import {
  normalizePhaseForDB,
  phaseWindowDB,
} from './deal-type-normalization';

// ---------------------------------------------------------------------------
// Inputs (mirror DB row shapes — kept loose so the cron route can pass raw rows)
// ---------------------------------------------------------------------------

/** Subset of `deals` table columns used by the premium calculation */
export interface DealRow {
  id: string;
  licensee_id: string | null;
  licensee_name: string | null;
  indication_category: string | null;
  indication_specific?: string | null;
  phase_at_signing: string | null;
  total_deal_value_usd: number | null;
  upfront_usd?: number | null;
  modality?: string | null;
  /** Therapeutic area derived from indication_category */
  therapeutic_area?: string | null;
}

/** Subset of `companies` table columns used by the premium calculation */
export interface CompanyRow {
  id: string;
  name: string;
  company_type?: string | null;
}

export interface ComputeOptions {
  /** Minimum number of disclosed deals for a buyer to get a premium. Default 3. */
  minDealsRequired?: number;
  /** Premium clamp range. Default [0.7, 1.5]. */
  clampRange?: [number, number];
  /** Minimum peer sample size for the strict (TA + phase) filter. Default 5. */
  strictPeerN?: number;
  /** Minimum peer sample size after widening to TA only. Default 3. */
  widenedPeerN?: number;
}

const DEFAULT_OPTIONS: Required<ComputeOptions> = {
  minDealsRequired: 3,
  clampRange: [0.7, 1.5],
  strictPeerN: 5,
  widenedPeerN: 3,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function trimmedMean(values: number[], trimFraction: number = 0.1): number {
  if (values.length === 0) return 0;
  if (values.length < 10) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(values.length * trimFraction);
  const kept = sorted.slice(trim, sorted.length - trim);
  return kept.reduce((a, b) => a + b, 0) / kept.length;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function confidenceFromN(n: number): 'high' | 'medium' | 'low' {
  if (n >= 10) return 'high';
  if (n >= 5) return 'medium';
  return 'low';
}

function hasUsableValue(deal: DealRow): boolean {
  return (
    typeof deal.total_deal_value_usd === 'number' &&
    Number.isFinite(deal.total_deal_value_usd) &&
    deal.total_deal_value_usd > 0
  );
}

// ---------------------------------------------------------------------------
// Peer median lookup
// ---------------------------------------------------------------------------

/**
 * Find the median peer deal value for a given target deal.
 *
 * Filter cascade:
 *   1. Same indication_category + same phase ±1 → if n ≥ strictPeerN, use it.
 *   2. Same therapeutic_area + same phase ±1 → if n ≥ widenedPeerN, use it.
 *   3. Otherwise return null (skip this deal — not enough peers).
 *
 * The buyer's own deal is excluded from the peer pool.
 */
export function findPeerMedian(
  target: DealRow,
  allDeals: DealRow[],
  options: Required<ComputeOptions>,
): number | null {
  const targetDBPhase = normalizePhaseForDB(target.phase_at_signing);
  if (targetDBPhase === 'unknown') return null;
  const phaseWindow = new Set(phaseWindowDB(targetDBPhase, 1));

  // Strict: same indication_category
  const strictPeers = allDeals.filter(d => {
    if (d.id === target.id) return false;
    if (!hasUsableValue(d)) return false;
    if (d.indication_category !== target.indication_category) return false;
    if (!d.indication_category) return false;
    const dbPhase = normalizePhaseForDB(d.phase_at_signing);
    return phaseWindow.has(dbPhase);
  });

  if (strictPeers.length >= options.strictPeerN) {
    return median(strictPeers.map(d => d.total_deal_value_usd as number));
  }

  // Widened: same therapeutic_area
  if (target.therapeutic_area) {
    const widenedPeers = allDeals.filter(d => {
      if (d.id === target.id) return false;
      if (!hasUsableValue(d)) return false;
      if (d.therapeutic_area !== target.therapeutic_area) return false;
      const dbPhase = normalizePhaseForDB(d.phase_at_signing);
      return phaseWindow.has(dbPhase);
    });
    if (widenedPeers.length >= options.widenedPeerN) {
      return median(widenedPeers.map(d => d.total_deal_value_usd as number));
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute counterparty premiums for every buyer with ≥`minDealsRequired`
 * disclosed deals.
 *
 * @param deals     - Rows from the `deals` table (full set, not filtered)
 * @param companies - Rows from the `companies` table (used for name lookup)
 * @param options   - Tunables (minimum sample sizes, clamp range)
 * @returns Array of CounterpartyPremium objects, one per qualifying buyer
 */
export function computeCounterpartyPremiums(
  deals: DealRow[],
  companies: CompanyRow[],
  options: ComputeOptions = {},
): CounterpartyPremium[] {
  const opts: Required<ComputeOptions> = { ...DEFAULT_OPTIONS, ...options };
  const companyById = new Map(companies.map(c => [c.id, c]));

  // Group deals by buyer
  const dealsByBuyer = new Map<string, DealRow[]>();
  for (const d of deals) {
    if (!d.licensee_id || !hasUsableValue(d)) continue;
    const list = dealsByBuyer.get(d.licensee_id) ?? [];
    list.push(d);
    dealsByBuyer.set(d.licensee_id, list);
  }

  const results: CounterpartyPremium[] = [];
  const asOfDate = new Date().toISOString().slice(0, 10);

  for (const [buyerId, buyerDeals] of dealsByBuyer.entries()) {
    if (buyerDeals.length < opts.minDealsRequired) continue;

    // Compute per-deal premiums
    const dealPremiums: number[] = [];
    const taPremiums = new Map<string, number[]>();
    const phasePremiums = new Map<string, number[]>();

    for (const deal of buyerDeals) {
      const peerMed = findPeerMedian(deal, deals, opts);
      if (peerMed === null || peerMed <= 0) continue;
      const premium = (deal.total_deal_value_usd as number) / peerMed;
      // Skip premiums that are unrealistic (e.g., 10x → outlier or data error)
      if (!Number.isFinite(premium) || premium <= 0 || premium > 5) continue;
      dealPremiums.push(premium);

      if (deal.therapeutic_area) {
        const list = taPremiums.get(deal.therapeutic_area) ?? [];
        list.push(premium);
        taPremiums.set(deal.therapeutic_area, list);
      }
      if (deal.phase_at_signing) {
        const phaseKey = normalizePhaseForDB(deal.phase_at_signing);
        if (phaseKey !== 'unknown') {
          const list = phasePremiums.get(phaseKey) ?? [];
          list.push(premium);
          phasePremiums.set(phaseKey, list);
        }
      }
    }

    // Need at least minDealsRequired with computable premiums
    if (dealPremiums.length < opts.minDealsRequired) continue;

    const rawPremium = trimmedMean(dealPremiums);
    const clampedPremium = clamp(rawPremium, opts.clampRange[0], opts.clampRange[1]);
    const confidence = confidenceFromN(dealPremiums.length);

    // Per-TA slice (only TAs with n ≥ 3)
    const byTherapeuticArea: Record<string, { premium: number; n: number }> = {};
    for (const [ta, prems] of taPremiums.entries()) {
      if (prems.length >= 3) {
        byTherapeuticArea[ta] = {
          premium: clamp(trimmedMean(prems), opts.clampRange[0], opts.clampRange[1]),
          n: prems.length,
        };
      }
    }

    // Per-phase slice (only phases with n ≥ 3)
    const byPhase: Record<string, { premium: number; n: number }> = {};
    for (const [phase, prems] of phasePremiums.entries()) {
      if (prems.length >= 3) {
        byPhase[phase] = {
          premium: clamp(trimmedMean(prems), opts.clampRange[0], opts.clampRange[1]),
          n: prems.length,
        };
      }
    }

    const company = companyById.get(buyerId);
    const buyerName = company?.name ?? buyerDeals[0].licensee_name ?? 'Unknown';

    results.push({
      companyId: buyerId,
      companyName: buyerName,
      premiumMultiplier: clampedPremium,
      sampleSize: dealPremiums.length,
      confidence,
      byTherapeuticArea,
      byPhase,
      asOfDate,
      calculationNotes:
        `Trimmed mean of ${dealPremiums.length} disclosed deal premiums vs. peer medians. ` +
        `Raw premium ${rawPremium.toFixed(3)}, clamped to [${opts.clampRange[0]}, ${opts.clampRange[1]}].`,
    });
  }

  return results;
}

/**
 * Look up a single counterparty's premium given a context (TA + phase).
 *
 * Lookup priority:
 *   1. Phase-specific (only if both phase and overall have n ≥ 5)
 *   2. TA-specific (if n ≥ 5)
 *   3. Company-wide
 *   4. Fallback: { multiplier: 1.0, confidence: 'low', source: 'no_history' }
 *
 * @param companyId - UUID of the buyer
 * @param premiums  - Preloaded list (e.g., from `counterparty_premiums` table)
 * @param context   - Optional TA/phase to use for slicing
 */
export function getCounterpartyPremium(
  companyId: string,
  premiums: CounterpartyPremium[],
  context?: { therapeuticArea?: string; phase?: string },
): CounterpartyPremiumLookup {
  const found = premiums.find(p => p.companyId === companyId);
  if (!found) {
    return { multiplier: 1.0, confidence: 'low', source: 'no_history' };
  }

  // Phase-specific (highest priority — only if reliable)
  if (context?.phase) {
    const dbPhase = normalizePhaseForDB(context.phase);
    const phaseSlice = found.byPhase[dbPhase];
    if (phaseSlice && phaseSlice.n >= 5) {
      return {
        multiplier: phaseSlice.premium,
        confidence: confidenceFromN(phaseSlice.n),
        source: 'phase_specific',
      };
    }
  }

  // TA-specific
  if (context?.therapeuticArea) {
    const taSlice = found.byTherapeuticArea[context.therapeuticArea];
    if (taSlice && taSlice.n >= 5) {
      return {
        multiplier: taSlice.premium,
        confidence: confidenceFromN(taSlice.n),
        source: 'ta_specific',
      };
    }
  }

  // Company-wide fallback
  return {
    multiplier: found.premiumMultiplier,
    confidence: found.confidence,
    source: 'company_wide',
  };
}

// ---------------------------------------------------------------------------
// Internal exports for testing
// ---------------------------------------------------------------------------

/** @internal exposed only for unit tests */
export const __test = {
  median,
  trimmedMean,
  clamp,
  confidenceFromN,
  findPeerMedian,
  DEFAULT_OPTIONS,
};
