/**
 * Deal Intelligence Brief v3 — buyer-specific valuations for the top partners.
 *
 * Fills the `buyerSpecificValuations` gap in the generate route: takes the
 * partner matches, builds a BuyerProfile per partner and runs the existing
 * buyer-specific valuation engine against the generic waterfall. Pure and
 * synchronous; no database access. Counterparty premiums (from
 * counterparty_premiums) can be passed in as a map keyed by company name.
 */

import type { DealWaterfall, RNPVResult, CounterpartyPremiumLookup } from '@/lib/financial/types';
import {
  buildBuyerProfileFromMatch,
  calculateBuyerSpecificValuation,
  type BuyerSpecificValuation,
} from '@/lib/financial/buyer-specific-valuation';
import type { PartnerForPDF } from '@/lib/report/types';

export interface PremiumEntry { multiplier: number; n: number; confidence: string }

/** Number of partners priced by default; the buyer-specific page shows the top few. */
export const BUYER_VALUATION_LIMIT = 6;

const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase();

function toLookup(entry: PremiumEntry | undefined): CounterpartyPremiumLookup | undefined {
  if (!entry || !Number.isFinite(entry.multiplier) || entry.multiplier <= 0) return undefined;
  const c = norm(entry.confidence);
  const confidence: CounterpartyPremiumLookup['confidence'] = c === 'high' ? 'high' : c === 'medium' ? 'medium' : 'low';
  return { multiplier: entry.multiplier, confidence, source: 'company_wide' };
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
    const premium = premiums ? toLookup(premiums.get(norm(p.company_name)) ?? premiums.get(p.company_name)) : undefined;
    try {
      out.push(calculateBuyerSpecificValuation(profile, waterfall, rnpv, premium));
    } catch {
      // One bad partner record must not take the page down; skip it.
    }
  }
  return out;
}
