/**
 * Deal Intelligence Brief v3 — buyer-specific valuations for the top partners.
 *
 * Fills the `buyerSpecificValuations` gap in the generate route: takes the
 * partner matches, builds a BuyerProfile per partner and runs the existing
 * buyer-specific valuation engine against the generic waterfall. Pure and
 * synchronous; no database access. Counterparty premiums (from
 * counterparty_premiums) can be passed in as a map keyed by company name;
 * when the entry carries the per-TA / per-phase slices and the asset's TA and
 * phase are given, the lookup goes through `getCounterpartyPremium`, which
 * prefers a phase- or TA-specific premium with n ≥ 5 and otherwise falls back
 * to the company-wide multiplier (Sep 26 2026: previously always company-wide).
 */

import type { DealWaterfall, RNPVResult, CounterpartyPremium, CounterpartyPremiumLookup } from '@/lib/financial/types';
import {
  buildBuyerProfileFromMatch,
  calculateBuyerSpecificValuation,
  type BuyerSpecificValuation,
} from '@/lib/financial/buyer-specific-valuation';
import { getCounterpartyPremium } from '@/lib/financial/counterparty-premiums';
import { normalizePhase } from '@/lib/brief/comp-set';
import type { PartnerForPDF } from '@/lib/report/types';

export type PremiumSlice = Record<string, { premium: number; n: number }>;

export interface PremiumEntry {
  multiplier: number;
  n: number;
  confidence: string;
  /** counterparty_premiums.company_id (optional; only used to label the lookup). */
  companyId?: string | null;
  /** counterparty_premiums.by_therapeutic_area — { oncology: { premium, n } }. */
  byTherapeuticArea?: PremiumSlice | null;
  /** counterparty_premiums.by_phase — keyed on the DB phase ({ phase_2: { premium, n } }). */
  byPhase?: PremiumSlice | null;
}

/** Asset context for the TA / phase slice lookup. */
export interface PremiumContext {
  therapeuticArea?: string | null;
  phase?: string | null;
}

/** Number of partners priced by default; the buyer-specific page shows the top few. */
export const BUYER_VALUATION_LIMIT = 6;

const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase();

function toConfidence(c: string | null | undefined): CounterpartyPremiumLookup['confidence'] {
  const k = norm(c);
  return k === 'high' ? 'high' : k === 'medium' ? 'medium' : 'low';
}

function cleanSlice(slice: PremiumSlice | null | undefined): PremiumSlice {
  const out: PremiumSlice = {};
  if (!slice || typeof slice !== 'object') return out;
  for (const [k, v] of Object.entries(slice)) {
    const premium = Number(v?.premium);
    const n = Number(v?.n);
    if (Number.isFinite(premium) && premium > 0 && Number.isFinite(n) && n > 0) out[k] = { premium, n };
  }
  return out;
}

/**
 * Turn a premium row into the lookup the valuation engine takes. With a
 * context, `getCounterpartyPremium` picks the phase slice (n ≥ 5), then the TA
 * slice (n ≥ 5), then the company-wide multiplier; without one, or when the
 * entry has no slices, the result is the company-wide lookup as before.
 */
export function toLookup(entry: PremiumEntry | undefined, context?: PremiumContext): CounterpartyPremiumLookup | undefined {
  if (!entry || !Number.isFinite(entry.multiplier) || entry.multiplier <= 0) return undefined;
  const confidence = toConfidence(entry.confidence);
  const byTherapeuticArea = cleanSlice(entry.byTherapeuticArea);
  const byPhase = cleanSlice(entry.byPhase);
  const hasSlices = Object.keys(byTherapeuticArea).length > 0 || Object.keys(byPhase).length > 0;
  if (!context || !hasSlices) return { multiplier: entry.multiplier, confidence, source: 'company_wide' };
  const id = entry.companyId ?? 'entry';
  const premium: CounterpartyPremium = {
    companyId: id,
    companyName: id,
    premiumMultiplier: entry.multiplier,
    sampleSize: Number.isFinite(entry.n) ? entry.n : 0,
    confidence,
    byTherapeuticArea,
    byPhase,
    asOfDate: '',
    calculationNotes: '',
  };
  // Asset phases arrive as engine keys ("phase_2") or labels ("Phase 2"); the
  // slices are keyed on the DB phase, which normalizePhase produces.
  const phase = context.phase ? normalizePhase(context.phase) : 'unknown';
  return getCounterpartyPremium(id, [premium], {
    therapeuticArea: context.therapeuticArea ?? undefined,
    phase: phase === 'unknown' ? undefined : phase,
  });
}

/**
 * Price the top `limit` partners (by match_score) for a specific buyer.
 * Partners without a name are skipped; a missing intent profile still prices
 * (the engine treats it as low-confidence, speculative timing).
 */
export function computeBuyerValuations(
  partners: PartnerForPDF[],
  waterfall: DealWaterfall,
  rnpv: RNPVResult,
  premiums?: Map<string, PremiumEntry>,
  limit: number = BUYER_VALUATION_LIMIT,
  context?: PremiumContext,
): BuyerSpecificValuation[] {
  if (!Array.isArray(partners) || !waterfall || !rnpv) return [];
  const top = [...partners]
    .filter(p => p && typeof p.company_name === 'string' && p.company_name.trim())
    .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
    .slice(0, Math.max(0, limit));

  const out: BuyerSpecificValuation[] = [];
  for (const p of top) {
    const ext = p as PartnerForPDF & { company_id?: string | null; company_type?: string | null };
    const intent = p.pharma_intent
      ? {
          intentScore: p.pharma_intent.intentScore,
          intentTier: p.pharma_intent.intentTier,
          timing: p.pharma_intent.timing,
          confidence: p.pharma_intent.confidence,
          factors: p.pharma_intent.factors ?? [],
        }
      : null;
    const profile = buildBuyerProfileFromMatch({
      company_name: p.company_name.trim(),
      company_id: ext.company_id ?? p.company_name.trim(),
      match_score: p.match_score,
      pharma_intent: intent,
      deals_last_12mo: p.deals_last_12mo ?? 0,
      hq_country: p.hq_country ?? null,
      company_type: ext.company_type ?? null,
    });
    const premium = premiums ? toLookup(premiums.get(norm(p.company_name)) ?? premiums.get(p.company_name), context) : undefined;
    try {
      out.push(calculateBuyerSpecificValuation(profile, waterfall, rnpv, premium));
    } catch {
      // One bad partner record must not take the page down; skip it.
    }
  }
  return out;
}
