/**
 * Deal Intelligence Brief v3 — Buyer map builder.
 *
 * Turns the partner-match list into ranked, evidence-backed buyer candidates:
 * company profile (companies), prior deals at stage (deals), historical
 * premium (counterparty_premiums), an urgency composite, an explicit
 * "transacts at this phase" verdict, one-line why-now / how-to-engage
 * sentences, an excluded list, and a suggested process.
 *
 * Read-only: every query is a plain supabase-js select. Never writes.
 *
 * Data caveats found while building (Sep 2026):
 *  - companies.phase_preference_min/max are derived with text MIN/MAX in SQL,
 *    so large pharma rows read "approved / unknown" (alphabetical, not
 *    chronological). The stated preference is therefore only trusted when
 *    both ends map to a known phase and min <= max in phase order; otherwise
 *    prior deals decide.
 *  - companies.patent_cliffs is one shape in production
 *    ({drug_name, indication, expiry_year, revenue_usd}); the parser also
 *    accepts {drug, loe_year|year, revenue}.
 *  - revenue_at_risk_2025..2027 are mostly 0/null; when they are, the
 *    revenue-at-risk figure falls back to the sum of patent-cliff revenue
 *    expiring in the window, then to strategic_context from the match API.
 *  - deals.licensee_name is not normalised ("Eli Lilly", "Eli Lilly and
 *    Company", "Lilly"; "Roche", "Genentech", "Roche/Genentech"), so prior
 *    deals are matched on the company name plus every name_variations entry.
 *
 * Deal-history supplement: always runs. The builder groups quality-filtered
 * deals in the asset's therapeutic area by licensee (variants collapsed
 * through companies.name_variations), ranks licensees by same-indication
 * deals ×3 + same-TA deals (recency tie-break) and adds up to HISTORY_POOL of
 * them to the pool as candidates tagged source = 'deal_history' (fit 70 with a
 * same-indication deal, else 55; intent score null).
 *
 * Composition rule (Sep 2026, Managing Partner ask: "mid-sized as well as
 * large, a good mix of pharma buyers"): every pool entry gets a size bucket
 * (companies.company_type; when null, total_annual_revenue >= $10B →
 * large_pharma, $1–10B → mid_pharma, < $1B → mid_biotech; else unknown) and a
 * region (hq_region, else hq_country). selectMix() then fills
 * CANDIDATE_TARGET (12) slots: at least MIN_MID (4) mid-sized (mid_pharma,
 * mid_biotech, specialty) and at least MIN_LARGE (4) large (large_pharma,
 * large_biotech) when such candidates exist with transactsAtPhase != 'no';
 * the rest by score (fit × 0.5 + urgency × 0.5). Whenever the next pick has
 * a same-score alternative (within REGION_TIEBREAK_POINTS = 5) from a region
 * not yet on the list (europe, japan, china_apac), that alternative wins.
 * Buyers with transactsAtPhase = 'no' only fill slots that would otherwise
 * stay empty and always rank last.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssetProfile, BuyerCandidate, BuyerMap, BuyerPriorDeal, BuyerSizeBucket, DealPhase, DealStructure, Range3 } from './types';
import type { PartnerForPDF } from '@/lib/report/types';
import type { BuyerSpecificValuation } from '@/lib/financial/buyer-specific-valuation';
import { isSameTA, isSameIndication } from './comp-set';

// ─── Input types ────────────────────────────────────────────────────────────

/**
 * PartnerForPDF plus the optional fields the /api/partners/match Pro response
 * carries but the PDF type does not declare. All optional: the builder works
 * from company_name alone and looks the rest up.
 */
export type PartnerInput = PartnerForPDF & {
  company_id?: string | null;
  company_type?: string | null;
  deals_last_24mo?: number | null;
  last_deal_date?: string | null;
  phase_preference_min?: string | null;
  phase_preference_max?: string | null;
  acquisition_appetite?: string | null;
  median_upfront_usd?: number | null;
  source?: 'partner_match' | 'deal_history';
};

/** Final list size after the mix rule. */
export const CANDIDATE_TARGET = 12;
/** Minimum mid-sized (mid_pharma | mid_biotech | specialty) in the final list when available. */
export const MIN_MID = 4;
/** Minimum large (large_pharma | large_biotech) in the final list when available. */
export const MIN_LARGE = 4;
/** A candidate from an unrepresented region wins the slot when within this many points of the best remaining score. */
export const REGION_TIEBREAK_POINTS = 5;
/** A mid-sized candidate within this many points of the third lead is promoted into the lead group. */
export const LEAD_PROMOTION_POINTS = 10;
/** Partner matches considered (top by match_score) before the mix rule. */
export const PARTNER_POOL = 40;
/** A buyer leads only when partner-match fit is at least this, unless it has a recent same-indication deal. */
export const LEAD_MIN_FIT = 60;
/** Score bonus for a disclosed deal in the asset's own indication in the last three years. */
export const INDICATION_DEAL_BONUS = 10;
export const INDICATION_DEAL_WINDOW_YEARS = 3;
/** Prior deals needed before "all at later stages" counts as evidence that a buyer does not transact here. */
export const MIN_DEALS_FOR_STAGE_NO = 5;
/** Deal-history licensees added to the pool. */
export const HISTORY_POOL = 12;
/** Regions the tiebreak tries to get onto the list. */
export const DIVERSITY_REGIONS: BuyerRegion[] = ['europe', 'japan', 'china_apac'];

export type BuyerRegion = 'north_america' | 'europe' | 'japan' | 'china_apac' | 'other' | 'unknown';

export interface BuildBuyerMapOptions {
  /** ISO date printed in the source note; defaults to today. */
  asOf?: string;
  /** Buyer-specific valuations (from computeBuyerValuations) to attach as impliedUpfront/impliedTotal. */
  valuations?: BuyerSpecificValuation[];
}

const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase();

// ─── Phase helpers ──────────────────────────────────────────────────────────

const PHASE_ORDER: DealPhase[] = ['discovery', 'preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved'];

/**
 * Normalise any phase spelling (deals keys `phase_1`, calc keys `phase1`,
 * `Phase 2`, `phase_2_3`, `phase1/2`, `nda`) to a DealPhase. Combined phases
 * resolve to their earlier stage. Returns 'unknown' when it cannot tell.
 */
export function normalisePhase(raw: string | null | undefined): DealPhase {
  if (!raw) return 'unknown';
  const k = String(raw).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (k === 'discovery' || k === 'research') return 'discovery';
  if (k.startsWith('preclin') || k === 'indenabling' || k === 'ind') return 'preclinical';
  if (k === 'approved' || k === 'marketed' || k === 'commercial' || k === 'nda' || k === 'bla' || k === 'ndabla' || k === 'registration') return 'approved';
  if (k === 'earlyphase1') return 'phase_1';
  const m = k.match(/^phase([123])/);
  if (m) return `phase_${m[1]}` as DealPhase;
  return 'unknown';
}

/** 0 (discovery) … 5 (approved); null for unknown. */
export function phaseRank(raw: string | null | undefined): number | null {
  const p = normalisePhase(raw);
  const i = PHASE_ORDER.indexOf(p);
  return i < 0 ? null : i;
}

const STRUCTURES: DealStructure[] = ['license', 'option', 'acquisition', 'collaboration', 'co_development', 'co_promotion', 'other'];

export function normaliseStructure(raw: string | null | undefined): DealStructure {
  if (!raw) return 'other';
  const k = String(raw).toLowerCase().replace(/[\s-]+/g, '_');
  if ((STRUCTURES as string[]).includes(k)) return k as DealStructure;
  if (k.includes('acqui') || k.includes('merger') || k === 'm_a' || k === 'm&a') return 'acquisition';
  if (k.includes('option')) return 'option';
  if (k.includes('codev') || k.includes('co_dev')) return 'co_development';
  if (k.includes('copro') || k.includes('co_pro')) return 'co_promotion';
  if (k.includes('collab') || k.includes('research') || k.includes('partnership')) return 'collaboration';
  if (k.includes('licen')) return 'license';
  return 'other';
}

// ─── Patent cliff parsing ───────────────────────────────────────────────────

export interface PatentCliff { drug: string; expiryYear: number; revenueUsd: number | null }

/**
 * Tolerant parser for companies.patent_cliffs (jsonb array). Accepts
 * {drug_name|drug|product|name, expiry_year|loe_year|year|expiry, revenue_usd|revenue|revenue_usd_m}.
 * Drops entries without a name or a plausible year. Sorted by year.
 */
export function parsePatentCliffs(raw: unknown): PatentCliff[] {
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  const out: PatentCliff[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const drug = String(o.drug_name ?? o.drug ?? o.product ?? o.name ?? '').trim();
    const yearRaw = o.expiry_year ?? o.loe_year ?? o.year ?? o.expiry ?? o.loe;
    const year = typeof yearRaw === 'number' ? yearRaw : parseInt(String(yearRaw ?? ''), 10);
    if (!drug || !Number.isFinite(year) || year < 2000 || year > 2100) continue;
    let revenue: number | null = null;
    if (typeof o.revenue_usd === 'number') revenue = o.revenue_usd;
    else if (typeof o.revenue === 'number') revenue = o.revenue;
    else if (typeof o.revenue_usd_m === 'number') revenue = o.revenue_usd_m * 1e6;
    else if (typeof o.revenue_usd === 'string' || typeof o.revenue === 'string') {
      const n = parseFloat(String(o.revenue_usd ?? o.revenue));
      revenue = Number.isFinite(n) ? n : null;
    }
    out.push({ drug, expiryYear: Math.round(year), revenueUsd: revenue != null && Number.isFinite(revenue) && revenue > 0 ? revenue : null });
  }
  return out.sort((a, b) => a.expiryYear - b.expiryYear);
}

// ─── Urgency composite ──────────────────────────────────────────────────────

export interface UrgencyInputs {
  /** USD at risk over 2026–2027 (sum), null when unknown. */
  revenueAtRiskUsd: number | null;
  /** USD, null when unknown. */
  totalRevenueUsd: number | null;
  dealsLast12mo: number;
  intentScore: number | null;
  hiringBd: boolean | null;
}

/**
 * Urgency 0–100, weighted composite:
 *   40  revenue at risk 2026–27 as a share of total revenue; 25% of revenue at
 *       risk earns full marks. Without a revenue denominator the absolute
 *       figure is used instead ($5B at risk = full marks). Unknown = 0.
 *   25  deal cadence: deals_last_12mo / 6, capped (6+ deals a year = full).
 *   25  Pharma Intent score / 100.
 *   10  hiring BD roles (binary).
 * Weights are fixed so the same buyer scores identically on every page.
 */
/**
 * companies.total_annual_revenue is not a reliable denominator: rows mix
 * annual USD, thousands and quarterly figures (Incyte reads $1.0M against a
 * $2.5B Jakafi cliff; Biogen and Novartis read a quarter's revenue). A
 * denominator is trusted only when it is at least as large as the product
 * revenue it is dividing; otherwise the share is not computed and urgency
 * falls back to the absolute scale.
 */
export function plausibleDenominator(partUsd: number | null | undefined, totalUsd: number | null | undefined): boolean {
  return totalUsd != null && Number.isFinite(totalUsd) && totalUsd > 0
    && partUsd != null && Number.isFinite(partUsd) && partUsd >= 0
    && partUsd <= totalUsd;
}

/** Whole-percent share of total revenue, or null when the denominator cannot be trusted or the share rounds to 0. */
export function revenueShare(partUsd: number | null | undefined, totalUsd: number | null | undefined): number | null {
  if (!plausibleDenominator(partUsd, totalUsd)) return null;
  const share = Math.round((partUsd! / totalUsd!) * 100);
  return share > 0 ? Math.min(100, share) : null;
}

export function computeUrgency(i: UrgencyInputs): number {
  let risk = 0;
  if (i.revenueAtRiskUsd != null && i.revenueAtRiskUsd > 0) {
    if (plausibleDenominator(i.revenueAtRiskUsd, i.totalRevenueUsd)) {
      risk = Math.min(1, (i.revenueAtRiskUsd / i.totalRevenueUsd!) / 0.25);
    } else {
      risk = Math.min(1, i.revenueAtRiskUsd / 5e9);
    }
  }
  const cadence = Math.min(1, Math.max(0, i.dealsLast12mo || 0) / 6);
  const intent = Math.min(1, Math.max(0, (i.intentScore ?? 0) / 100));
  const hiring = i.hiringBd ? 1 : 0;
  const score = risk * 40 + cadence * 25 + intent * 25 + hiring * 10;
  return Math.round(Math.max(0, Math.min(100, score)));
}

// ─── Transacts-at-phase verdict ─────────────────────────────────────────────

/**
 * 'yes'     — any prior deal at or below the asset phase, or a valid stated
 *             phase_preference_min at or below it.
 * 'no'      — a valid stated phase_preference_min strictly above the asset
 *             phase with no prior deal at or below it; or (stated preference
 *             unusable) at least MIN_DEALS_FOR_STAGE_NO prior deals in our
 *             data, all strictly above the asset phase. Three deals were too
 *             few: the obvious buyer in an indication was being excluded on a
 *             thin sample.
 * 'unknown' — everything else.
 * A stated preference is "valid" only when both ends map to a phase and
 * min <= max in phase order (see file header on the alphabetical artefact).
 */
export function transactsAtPhase(
  assetPhase: string,
  priorDealPhases: Array<string | null | undefined>,
  prefMin?: string | null,
  prefMax?: string | null,
): 'yes' | 'no' | 'unknown' {
  const asset = phaseRank(assetPhase);
  if (asset == null) return 'unknown';
  const ranks = priorDealPhases.map(phaseRank).filter((r): r is number => r != null);
  if (ranks.some(r => r <= asset)) return 'yes';
  const minR = phaseRank(prefMin);
  const maxR = phaseRank(prefMax);
  const validPref = minR != null && maxR != null && minR <= maxR;
  if (validPref && minR <= asset) return 'yes';
  if (validPref && minR > asset) return 'no';
  if (ranks.length >= MIN_DEALS_FOR_STAGE_NO && ranks.every(r => r > asset)) return 'no';
  return 'unknown';
}

// ─── Size bucket and region ─────────────────────────────────────────────────

const SIZE_BUCKETS: BuyerSizeBucket[] = ['large_pharma', 'mid_pharma', 'large_biotech', 'mid_biotech', 'specialty'];

/**
 * companies.company_type when it is one of the five known values; otherwise
 * inferred from total_annual_revenue (USD): >= $10B large_pharma, $1–10B
 * mid_pharma, < $1B mid_biotech. 'unknown' without either.
 */
export function sizeBucketOf(companyType: string | null | undefined, totalRevenueUsd: number | null | undefined): BuyerSizeBucket {
  const t = norm(companyType).replace(/[\s-]+/g, '_') as BuyerSizeBucket;
  if ((SIZE_BUCKETS as string[]).includes(t)) return t;
  const rev = totalRevenueUsd != null && Number.isFinite(Number(totalRevenueUsd)) ? Number(totalRevenueUsd) : null;
  if (rev != null && rev > 0) {
    if (rev >= 10e9) return 'large_pharma';
    if (rev >= 1e9) return 'mid_pharma';
    return 'mid_biotech';
  }
  return 'unknown';
}

export const isLargeBucket = (b: BuyerSizeBucket | null | undefined): boolean => b === 'large_pharma' || b === 'large_biotech';
export const isMidBucket = (b: BuyerSizeBucket | null | undefined): boolean => b === 'mid_pharma' || b === 'mid_biotech' || b === 'specialty';

const COUNTRY_REGION: Array<[RegExp, BuyerRegion]> = [
  [/^(us|usa|united states( of america)?|canada|ca|mexico|mx)$/, 'north_america'],
  [/^(japan|jp)$/, 'japan'],
  [/^(china|cn|prc|hong kong|hk|taiwan|tw|south korea|korea|kr|singapore|sg|australia|au|india|in|new zealand|nz|asia|apac)$/, 'china_apac'],
  [/^(gb|uk|united kingdom|england|scotland|switzerland|ch|germany|de|france|fr|denmark|dk|belgium|be|netherlands|nl|the netherlands|ireland|ie|sweden|se|italy|it|spain|es|austria|at|norway|no|finland|fi|portugal|pt|poland|pl|czech republic|czechia|cz|hungary|hu|luxembourg|lu|iceland|is|eu|europe)$/, 'europe'],
];

/** HQ region from companies.hq_region when set, else from hq_country (codes or names). */
export function regionOf(hqRegion: string | null | undefined, hqCountry: string | null | undefined): BuyerRegion {
  const r = norm(hqRegion).replace(/[\s-]+/g, '_');
  if (r === 'north_america') return 'north_america';
  if (r === 'europe') return 'europe';
  if (r === 'japan') return 'japan';
  if (r === 'china' || r === 'south_korea' || r === 'asia_pacific' || r === 'china_apac' || r === 'asia') return 'china_apac';
  if (r === 'latin_america' || r === 'middle_east' || r === 'africa' || r === 'other') return 'other';
  const c = norm(hqCountry).replace(/\./g, '');
  if (!c) return 'unknown';
  for (const [re, region] of COUNTRY_REGION) if (re.test(c)) return region;
  return 'other';
}

// ─── Mix selection ──────────────────────────────────────────────────────────

type MixInput = Pick<BuyerCandidate, 'name' | 'fit' | 'urgency' | 'transactsAtPhase' | 'sizeBucket' | 'hqRegion' | 'hqCountry'>;

const combinedScore = (c: Pick<BuyerCandidate, 'fit' | 'urgency'> & { recentIndicationDeal?: BuyerCandidate['recentIndicationDeal'] }): number =>
  c.fit * 0.5 + c.urgency * 0.5 + (c.recentIndicationDeal ? INDICATION_DEAL_BONUS : 0);

/**
 * Pick `target` candidates from the pool. Order of filling: MIN_MID mid-sized,
 * MIN_LARGE large, then the rest by score; every pick prefers an equally
 * strong (within REGION_TIEBREAK_POINTS) candidate from a diversity region
 * not yet represented. Only transactsAtPhase != 'no' candidates count toward
 * the quotas; 'no' candidates fill leftover slots and rank last. Returns the
 * selection ordered by score (eligible first) plus the mix summary.
 */
export function selectMix<T extends MixInput>(pool: T[], target: number = CANDIDATE_TARGET): { selected: T[]; mix: BuyerMap['mix'] } {
  const eligible = pool.filter(c => c.transactsAtPhase !== 'no').sort((a, b) => combinedScore(b) - combinedScore(a));
  const ineligible = pool.filter(c => c.transactsAtPhase === 'no').sort((a, b) => combinedScore(b) - combinedScore(a));
  const picked = new Set<T>();
  const regionsSeen = new Set<BuyerRegion>();
  const regionFor = (c: T): BuyerRegion => regionOf(c.hqRegion, c.hqCountry);

  const pickNext = (accept: (c: T) => boolean): boolean => {
    const remaining = eligible.filter(c => !picked.has(c) && accept(c));
    if (!remaining.length) return false;
    const best = remaining[0];
    const alt = remaining.find(c =>
      combinedScore(best) - combinedScore(c) <= REGION_TIEBREAK_POINTS &&
      DIVERSITY_REGIONS.includes(regionFor(c)) && !regionsSeen.has(regionFor(c)));
    const chosen = alt ?? best;
    picked.add(chosen);
    regionsSeen.add(regionFor(chosen));
    return true;
  };

  for (let i = 0; i < MIN_MID && picked.size < target; i++) if (!pickNext(c => isMidBucket(c.sizeBucket))) break;
  for (let i = 0; i < MIN_LARGE && picked.size < target; i++) if (!pickNext(c => isLargeBucket(c.sizeBucket))) break;
  while (picked.size < target) if (!pickNext(() => true)) break;

  const selected = eligible.filter(c => picked.has(c));
  for (const c of ineligible) { if (selected.length >= target) break; selected.push(c); }

  return { selected, mix: mixOf(selected) };
}

/** Large / mid / unknown counts and the regions represented, in list order. */
export function mixOf(candidates: Array<Pick<BuyerCandidate, 'sizeBucket' | 'hqRegion' | 'hqCountry'>>): BuyerMap['mix'] {
  const regions: string[] = [];
  for (const c of candidates) { const r = regionOf(c.hqRegion, c.hqCountry); if (r !== 'unknown' && !regions.includes(r)) regions.push(r); }
  return {
    large: candidates.filter(c => isLargeBucket(c.sizeBucket)).length,
    mid: candidates.filter(c => isMidBucket(c.sizeBucket)).length,
    unknown: candidates.filter(c => !isLargeBucket(c.sizeBucket) && !isMidBucket(c.sizeBucket)).length,
    regions,
  };
}

// ─── Process split ──────────────────────────────────────────────────────────

export function splitProcess(
  candidates: Array<Pick<BuyerCandidate, 'name' | 'fit' | 'urgency' | 'transactsAtPhase'> & { sizeBucket?: BuyerSizeBucket; recentIndicationDeal?: BuyerCandidate['recentIndicationDeal'] }>,
  assetPhaseLabel: string,
): BuyerMap['process'] {
  const scored = candidates
    .filter(c => c.transactsAtPhase !== 'no')
    .map(c => ({ ...c, score: combinedScore(c) }))
    .sort((a, b) => b.score - a.score);

  // Fit gate: urgency alone must not make a buyer a lead. A lead needs a
  // strategic fit of LEAD_MIN_FIT or a disclosed deal in this indication;
  // when fewer than two candidates clear the gate, the gate is dropped so a
  // thin list still produces a process, and the rationale says so.
  const fitsLead = (c: { fit: number; recentIndicationDeal?: BuyerCandidate['recentIndicationDeal'] }) => c.fit >= LEAD_MIN_FIT || !!c.recentIndicationDeal;
  const gated = scored.filter(fitsLead);
  const gateApplied = gated.length >= 2;
  const eligible = gateApplied ? [...gated, ...scored.filter(c => !fitsLead(c))] : scored;

  // Lead promotion: an all-large lead group gives way to a mid-sized buyer
  // that ranks within LEAD_PROMOTION_POINTS of the third lead; the weakest
  // large lead moves to the front of the tension group.
  let promotion: { promoted: string; demoted: string; gap: number } | null = null;
  if (eligible.length > 3 && eligible.slice(0, 3).every(c => isLargeBucket(c.sizeBucket))) {
    const third = eligible[2];
    // A promoted mid-sized buyer must clear the same fit gate as any other lead.
    const midIdx = eligible.findIndex((c, i) => i >= 3 && isMidBucket(c.sizeBucket) && (!gateApplied || fitsLead(c)) && third.score - c.score <= LEAD_PROMOTION_POINTS);
    if (midIdx >= 0) {
      const mid = eligible[midIdx];
      eligible.splice(midIdx, 1);
      eligible.splice(2, 1, mid, third);
      promotion = { promoted: mid.name, demoted: third.name, gap: Math.round(third.score - mid.score) };
    }
  }

  const lead = eligible.slice(0, 3).map(c => c.name);
  const tensionCount = Math.min(3, Math.max(2, eligible.length - 3));
  const tension = eligible.slice(3, 3 + tensionCount).map(c => c.name);
  const hold = eligible.slice(3 + tensionCount).map(c => c.name);
  let rationale: string;
  if (lead.length === 0) {
    rationale = `No candidate in the match list has transacted at ${assetPhaseLabel}; open with education rather than a term sheet.`;
  } else {
    const leadTxt = joinNames(lead);
    const evidence = eligible.slice(0, 3).filter(c => c.transactsAtPhase === 'yes').length;
    rationale = `Open with ${leadTxt}: ${gateApplied ? `highest combined fit and urgency among buyers with a fit of ${LEAD_MIN_FIT} or more or a recent deal in this indication` : 'highest combined fit and urgency (no candidate clears the fit gate, so urgency carries the ranking)'}` +
      (evidence === lead.length ? `, and each has signed at ${assetPhaseLabel} before.` : evidence > 0 ? `; ${evidence} of ${lead.length} has signed at ${assetPhaseLabel} before.` : `, though none has a disclosed deal at ${assetPhaseLabel} yet.`);
    if (promotion) {
      rationale += ` ${promotion.promoted} takes the third lead slot ahead of ${promotion.demoted}${promotion.gap > 0 ? ` (${promotion.gap} points apart)` : ' (level on score)'}: mid-sized buyers move faster at this stage, and an all-large lead group would let the three set the pace together.`;
    }
    if (tension.length) rationale += ` Keep ${joinNames(tension)} warm from week one so the leads price against real competition.`;
    if (hold.length) rationale += ` Hold ${hold.length === 1 ? hold[0] : `the remaining ${hold.length}`} until the next data package.`;
  }
  return { lead, tension, hold, rationale };
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ─── Sentence builders ──────────────────────────────────────────────────────

const usdShort = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v) || v <= 0) return '';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${Math.round(v / 1e6)}M`;
  return `$${Math.round(v / 1e3)}K`;
};

const PHASE_TEXT: Record<DealPhase, string> = {
  discovery: 'discovery', preclinical: 'preclinical', phase_1: 'Phase 1', phase_2: 'Phase 2', phase_3: 'Phase 3', approved: 'approved', unknown: 'undisclosed-phase',
};

const STRUCTURE_TEXT: Record<DealStructure, string> = {
  license: 'license', option: 'option deal', acquisition: 'acquisition', collaboration: 'collaboration', co_development: 'co-development deal', co_promotion: 'co-promotion deal', other: 'deal',
};

export function buildWhyNow(c: {
  name: string;
  patentCliffs: PatentCliff[];
  revenueAtRisk: { y2025?: number | null; y2026: number | null; y2027: number | null };
  totalRevenueUsd: number | null;
  priorDeals: BuyerPriorDeal[];
  dealsLast12mo: number;
  intentTier: string | null;
  fit: number;
  source?: 'partner_match' | 'deal_history';
}, nowYear: number, taLabel: string): string {
  if (c.source === 'deal_history') {
    const recent = [...c.priorDeals].filter(d => d.sameTA).sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0] ?? c.priorDeals[0];
    if (recent) {
      const up = recent.upfrontM != null ? `${recent.upfrontM >= 1000 ? `$${(recent.upfrontM / 1000).toFixed(1)}B` : `$${Math.round(recent.upfrontM)}M`} upfront` : 'undisclosed upfront';
      const what = `${PHASE_TEXT[recent.phase]} ${STRUCTURE_TEXT[recent.structure]}${recent.indication ? ` in ${recent.indication}` : ''}`;
      return `Signed ${recent.parties}${recent.year ? ` in ${recent.year}` : ''} at ${up} (${what}); they are on this list because of that deal, not a match score.`;
    }
  }
  const upcoming = c.patentCliffs.filter(p => p.expiryYear >= nowYear).sort((a, b) => (b.revenueUsd ?? 0) - (a.revenueUsd ?? 0));
  const cliff = upcoming.find(p => p.revenueUsd) ?? upcoming[0];
  if (cliff) {
    const rev = usdShort(cliff.revenueUsd);
    const share = revenueShare(cliff.revenueUsd, c.totalRevenueUsd);
    return `${cliff.drug} loses exclusivity in ${cliff.expiryYear}${rev ? ` (${rev} of revenue${share != null ? `, ${share}% of the total` : ''})` : ''}; the replacement has to be signed before then.`;
  }
  const rar = (c.revenueAtRisk.y2026 ?? 0) + (c.revenueAtRisk.y2027 ?? 0);
  if (rar > 0) {
    return `${usdShort(rar)} of revenue is at risk across 2026–2027, which puts new in-licensing on the board agenda now.`;
  }
  const recent = c.priorDeals[0];
  if (recent && recent.year) {
    const money = recent.upfrontM != null ? ` with ${recent.upfrontM >= 1000 ? `$${(recent.upfrontM / 1000).toFixed(1)}B` : `$${Math.round(recent.upfrontM)}M`} upfront` : '';
    const what = `${PHASE_TEXT[recent.phase]} ${STRUCTURE_TEXT[recent.structure]}`;
    return `Signed ${/^[aeiou]/i.test(what) ? 'an' : 'a'} ${what} with ${recent.parties.split(' → ')[0]} in ${recent.year}${money}${recent.sameTA ? ` in ${taLabel}` : ''}; the team that did it is still buying.`;
  }
  if (c.dealsLast12mo > 0) {
    return `${c.dealsLast12mo} deal${c.dealsLast12mo === 1 ? '' : 's'} signed in the last 12 months; the business-development budget is open this year.`;
  }
  if (c.intentTier && c.intentTier !== 'minimal') {
    return `Intent signals read "${c.intentTier}" but no disclosed cliff or recent deal supports it; treat as a soft lead.`;
  }
  return `No disclosed patent cliff or recent deal in ${taLabel}; the ${Math.round(c.fit)}% fit score is the only signal.`;
}

export function buildHowToEngage(c: {
  preferredDealType: string | null;
  priorDeals: BuyerPriorDeal[];
  transactsAtPhase: 'yes' | 'no' | 'unknown';
  acquisitionAppetite: string | null;
  phasePreference: { min: string | null; max: string | null };
}, assetPhase: DealPhase, taLabel: string, nowYear: number): string {
  const openers: Record<string, string> = {
    license: 'Go straight to a license',
    licensing: 'Go straight to a license',
    option: 'Option-to-license first',
    acquisition: 'Expect an acquisition conversation, not a license',
    collaboration: 'Research collaboration with an option to license',
    co_development: 'Co-development with shared costs',
    codevelopment: 'Co-development with shared costs',
  };
  const pref = (c.preferredDealType ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  let opener = openers[pref];
  if (!opener) {
    const structures = c.priorDeals.map(d => d.structure);
    const mode = structures.length ? structures.sort((a, b) => structures.filter(s => s === b).length - structures.filter(s => s === a).length)[0] : null;
    opener = mode && mode !== 'other' ? `Lead with the ${STRUCTURE_TEXT[mode]} structure they used last` : (assetPhase === 'preclinical' || assetPhase === 'discovery' ? 'Option-to-license first' : 'Lead with a straight license');
  }
  const phaseTxt = PHASE_TEXT[assetPhase];
  const atPhase = c.priorDeals.filter(d => phaseRank(d.phase) != null && phaseRank(d.phase)! <= (phaseRank(assetPhase) ?? 99));
  let clause: string;
  if (atPhase.length > 0) {
    const paid = atPhase.filter(d => d.upfrontM != null);
    const last = atPhase.map(d => d.year).filter((y): y is number => y != null).sort((a, b) => b - a)[0];
    clause = paid.length > 0
      ? `they have paid upfront at ${phaseTxt} or earlier ${paid.length === 1 ? 'once' : `${paid.length} times`}${last ? `, most recently in ${last}` : ''}`
      : `they have signed at ${phaseTxt} or earlier${last ? `, most recently in ${last}` : ''}, with terms undisclosed`;
  } else if (c.transactsAtPhase === 'no') {
    const earliest = c.priorDeals.map(d => d.year).filter((y): y is number => y != null).sort((a, b) => a - b)[0];
    clause = `they have not signed at ${phaseTxt} in ${taLabel}${earliest ? ` since at least ${earliest}` : ' in our data'}`;
  } else {
    clause = `no disclosed ${phaseTxt} deal in ${taLabel} in our data, so lead with the data package and ask what stage they would price`;
  }
  const appetite = c.acquisitionAppetite ? `; stated appetite is ${c.acquisitionAppetite}` : '';
  void nowYear;
  return `${opener}; ${clause}${appetite}.`;
}

// ─── Supabase row shapes ────────────────────────────────────────────────────

interface CompanyRow {
  id: string;
  name: string;
  name_variations: string[] | null;
  company_type: string | null;
  hq_region: string | null;
  hq_country: string | null;
  phase_preference_min: string | null;
  phase_preference_max: string | null;
  deals_last_12mo: number | null;
  deals_last_24mo: number | null;
  last_deal_date: string | null;
  total_annual_revenue: number | null;
  revenue_at_risk_2025: number | null;
  revenue_at_risk_2026: number | null;
  revenue_at_risk_2027: number | null;
  patent_cliffs: unknown;
  hiring_bd_roles: boolean | null;
  acquisition_appetite: string | null;
  data_quality_score?: number | null;
}

interface DealRow {
  id: string;
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  announced_date: string | null;
  phase_at_signing: string | null;
  deal_type: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  therapeutic_area: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  source_url: string | null;
  verified: boolean | null;
}

interface PremiumRow {
  company_id: string | null;
  company_name: string;
  premium_multiplier: number;
  sample_size: number;
  confidence: string;
  as_of_date: string | null;
}

const COMPANY_COLS = 'id,name,name_variations,company_type,hq_region,hq_country,phase_preference_min,phase_preference_max,deals_last_12mo,deals_last_24mo,last_deal_date,total_annual_revenue,revenue_at_risk_2025,revenue_at_risk_2026,revenue_at_risk_2027,patent_cliffs,hiring_bd_roles,acquisition_appetite,data_quality_score';
const DEAL_COLS = 'id,licensor_name,licensee_name,asset_name,announced_date,phase_at_signing,deal_type,upfront_usd,total_deal_value_usd,therapeutic_area,indication_category,indication_specific,source_url,verified';

/** Quote a value for a PostgREST `.or()` filter (commas, parens, quotes are unsafe bare). */
function orValue(v: string): string {
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}


/** Company-name aliases that reliably mean the same buyer in deals.licensee_name. */
function nameAliases(name: string, variations: string[] | null | undefined): string[] {
  const set = new Set<string>();
  const add = (v: string | null | undefined) => { const t = (v ?? '').trim(); if (t) set.add(t); };
  add(name);
  (variations ?? []).forEach(add);
  return [...set];
}

// ─── Deal-history supplement ────────────────────────────────────────────────

/**
 * Rows where the "licensee" is the licensor's own vehicle or a placeholder
 * ("Annovis Bio → Annovis (Proprietary)", "undisclosed", "internal program")
 * are not buyers and must never reach the buyer map.
 */
export function isInternalCounterparty(licensee: string | null | undefined, licensor: string | null | undefined): boolean {
  const lic = (licensee ?? '').trim();
  if (!lic) return true;
  if (/\((proprietary|internal|in-house|own)\)|^(undisclosed|internal|n\/a|none|proprietary|self)\b/i.test(lic)) return true;
  const a = norm(lic).replace(/proprietary|internal|inc|ltd|llc|corp|co|plc|ag|sa|nv|bio|biosciences|pharma|pharmaceuticals|therapeutics/g, '');
  const b = norm(licensor ?? '').replace(/inc|ltd|llc|corp|co|plc|ag|sa|nv|bio|biosciences|pharma|pharmaceuticals|therapeutics/g, '');
  if (a && b && (a === b || (a.length >= 5 && b.startsWith(a)) || (b.length >= 5 && a.startsWith(b)))) return true;
  return false;
}

/** All quality-filtered deals in the asset's TA (in-memory match via comp-set helpers), paged. */
async function fetchTaDeals(supabase: SupabaseClient, asset: AssetProfile): Promise<Array<DealRow & { sameIndication: boolean }>> {
  const out: Array<DealRow & { sameIndication: boolean }> = [];
  const page = 1000;
  for (let from = 0, pages = 0; pages < 4; from += page, pages++) {
    const { data } = await supabase
      .from('deals')
      .select(DEAL_COLS)
      .eq('is_synthetic', false)
      .not('is_canonical', 'is', false)
      .not('verification_status', 'in', '("rejected","flagged")')
      .order('announced_date', { ascending: false })
      .range(from, from + page - 1);
    const batch = Array.isArray(data) ? (data as DealRow[]) : [];
    for (const d of batch) {
      if (!d.licensee_name || isInternalCounterparty(d.licensee_name, d.licensor_name)) continue;
      const ta = isSameTA(d, asset.therapeuticArea);
      const ind = isSameIndication(d, asset.indication);
      if (ta || ind) out.push({ ...d, sameIndication: ind });
    }
    if (batch.length < page) break;
  }
  return out;
}

export interface LicenseeGroup {
  /** Display name: the most frequent spelling, or the companies.name when resolved. */
  name: string;
  companyId: string | null;
  aliases: string[];
  sameIndication: number;
  sameTA: number;
  latest: string | null;
  score: number;
}

/**
 * Group TA deals by licensee, collapsing name variants through the supplied
 * company rows (name / name_variations). Pure; exported for tests.
 */
export function groupLicensees(rows: Array<{ licensee_name: string; announced_date: string | null; sameIndication: boolean }>, companies: Array<{ id: string; name: string; name_variations: string[] | null }>): LicenseeGroup[] {
  const aliasToCompany = new Map<string, { id: string; name: string; name_variations: string[] | null }>();
  for (const c of companies) {
    for (const a of nameAliases(c.name, c.name_variations)) {
      if (!aliasToCompany.has(norm(a))) aliasToCompany.set(norm(a), c);
    }
  }
  const groups = new Map<string, LicenseeGroup & { spellings: Map<string, number> }>();
  for (const r of rows) {
    const n = norm(r.licensee_name);
    if (!n) continue;
    const co = aliasToCompany.get(n);
    const key = co ? `id:${co.id}` : `name:${n}`;
    let g = groups.get(key);
    if (!g) {
      g = { name: co?.name ?? r.licensee_name.trim(), companyId: co?.id ?? null, aliases: co ? nameAliases(co.name, co.name_variations) : [r.licensee_name.trim()], sameIndication: 0, sameTA: 0, latest: null, score: 0, spellings: new Map() };
      groups.set(key, g);
    }
    if (!g.aliases.some(a => norm(a) === n)) g.aliases.push(r.licensee_name.trim());
    g.spellings.set(r.licensee_name.trim(), (g.spellings.get(r.licensee_name.trim()) ?? 0) + 1);
    if (r.sameIndication) g.sameIndication++; else g.sameTA++;
    if (r.announced_date && (!g.latest || r.announced_date > g.latest)) g.latest = r.announced_date;
  }
  return [...groups.values()].map(g => {
    if (!g.companyId) g.name = [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const { spellings: _s, ...rest } = g;
    void _s;
    return { ...rest, score: rest.sameIndication * 3 + rest.sameTA };
  }).sort((a, b) => (b.score - a.score) || ((b.latest ?? '').localeCompare(a.latest ?? '')));
}

// ─── Main builder ───────────────────────────────────────────────────────────

export async function buildBuyerMap(
  supabase: SupabaseClient,
  asset: AssetProfile,
  partners: PartnerForPDF[],
  opts: BuildBuyerMapOptions = {},
): Promise<BuyerMap> {
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const nowYear = new Date(asOf).getFullYear() || new Date().getFullYear();
  const assetPhase = normalisePhase(asset.phase);
  const assetPhaseText = PHASE_TEXT[assetPhase];
  const taKey = norm(asset.therapeuticArea);
  const taLabel = asset.therapeuticArea ? asset.therapeuticArea.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() : 'this area';

  const top = [...(partners as PartnerInput[])]
    .filter(p => p && p.company_name)
    .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
    .slice(0, PARTNER_POOL);

  if (top.length === 0 && !asset.therapeuticArea && !asset.indication) {
    return {
      source: { source: 'Solidus deal database and company profiles', n: 0, asOf, note: 'no partner matches supplied' },
      candidates: [], excluded: [], process: { lead: [], tension: [], hold: [], rationale: 'No partner matches were supplied, so no process can be recommended.' },
      mix: { large: 0, mid: 0, unknown: 0, regions: [] },
    };
  }

  // 1. Company profiles — by id when the match carried one, else by name / name_variations.
  const ids = top.map(p => p.company_id).filter((x): x is string => !!x);
  const names = top.map(p => p.company_name.trim()).filter(Boolean);
  const companyRows: CompanyRow[] = [];
  if (ids.length) {
    const { data } = await supabase.from('companies').select(COMPANY_COLS).in('id', ids);
    if (Array.isArray(data)) companyRows.push(...(data as CompanyRow[]));
  }
  const unresolved = top.filter(p => !companyRows.some(r => (p.company_id && r.id === p.company_id) || norm(r.name) === norm(p.company_name)));
  if (unresolved.length) {
    const filters = unresolved.flatMap(p => [
      `name.ilike.${orValue(p.company_name.trim())}`,
      `name_variations.cs.{${orValue(p.company_name.trim())}}`,
    ]);
    const { data } = await supabase.from('companies').select(COMPANY_COLS).or(filters.join(',')).limit(200);
    if (Array.isArray(data)) companyRows.push(...(data as CompanyRow[]));
  }

  const companyFor = (p: PartnerInput): CompanyRow | null => {
    if (p.company_id) {
      const byId = companyRows.find(r => r.id === p.company_id);
      if (byId) return byId;
    }
    const n = norm(p.company_name);
    const exact = companyRows.filter(r => norm(r.name) === n);
    const viaVariation = companyRows.filter(r => (r.name_variations ?? []).some(v => norm(v) === n));
    const pool = exact.length ? exact : viaVariation;
    if (!pool.length) return null;
    // Several near-duplicate rows exist per big pharma; prefer the best-populated one.
    return pool.sort((a, b) => scoreRow(b) - scoreRow(a))[0];
  };
  const scoreRow = (r: CompanyRow): number =>
    (r.data_quality_score ?? 0) + (r.total_annual_revenue ? 50 : 0) + (r.deals_last_24mo ?? 0) + (parsePatentCliffs(r.patent_cliffs).length ? 10 : 0);

  // Explicit element type: the deal-history supplement below pushes PartnerInput
  // objects, so the array must not narrow to the literal shape of the first map.
  const resolved: Array<{ partner: PartnerInput; company: CompanyRow | null }> = top.map(p => ({
    partner: { ...p, source: p.source ?? ('partner_match' as const) } as PartnerInput,
    company: companyFor(p),
  }));

  // 1b. Deal-history supplement — always adds up to HISTORY_POOL licensees so
  // the mix rule can choose from buyers with a signed deal in this area, not
  // only from the match ranking.
  if (asset.therapeuticArea || asset.indication) {
    const taDeals = await fetchTaDeals(supabase, asset);
    if (taDeals.length) {
      // Resolve the most active licensee spellings to company rows so variants collapse.
      const prelim = groupLicensees(taDeals, []).slice(0, 30);
      const lookupNames = prelim.flatMap(g => g.aliases).filter(a => !companyRows.some(r => norm(r.name) === norm(a)));
      if (lookupNames.length) {
        const filters = lookupNames.flatMap(a => [`name.ilike.${orValue(a)}`, `name_variations.cs.{${orValue(a)}}`]);
        const { data } = await supabase.from('companies').select(COMPANY_COLS).or(filters.join(',')).limit(300);
        if (Array.isArray(data)) for (const r of data as CompanyRow[]) if (!companyRows.some(x => x.id === r.id)) companyRows.push(r);
      }
      const taken = new Set<string>();
      const takenIds = new Set<string>();
      for (const { partner, company } of resolved) {
        nameAliases(partner.company_name, company?.name_variations).concat(company ? [company.name] : []).forEach(a => taken.add(norm(a)));
        if (company) takenIds.add(company.id);
        if (partner.company_id) takenIds.add(partner.company_id);
      }
      const groups = groupLicensees(taDeals, companyRows);
      const cutoff = new Date(asOf); cutoff.setMonth(cutoff.getMonth() - 12);
      const cutoffIso = cutoff.toISOString().slice(0, 10);
      let added = 0;
      for (const g of groups) {
        if (added >= HISTORY_POOL) break;
        const dup = (g.companyId && takenIds.has(g.companyId)) || g.aliases.some(a => taken.has(norm(a)));
        if (dup) continue;
        const company = g.companyId ? companyRows.find(r => r.id === g.companyId) ?? null : null;
        const recent = taDeals.filter(d => g.aliases.some(a => norm(a) === norm(d.licensee_name)) && (d.announced_date ?? '') >= cutoffIso).length;
        const partner: PartnerInput = {
          company_name: g.name,
          company_id: g.companyId,
          match_score: g.sameIndication > 0 ? 70 : 55,
          match_reasons: [{ reason: g.sameIndication > 0 ? 'Prior same-indication deal' : 'Prior deal in this therapeutic area', strength: g.sameIndication > 0 ? 'strong' : 'moderate' }],
          deals_last_12mo: recent,
          hq_country: company?.hq_country ?? null,
          pharma_intent: null,
          strategic_context: null,
          source: 'deal_history',
        };
        resolved.push({ partner: { ...partner, source: 'deal_history' as const }, company });
        g.aliases.forEach(a => taken.add(norm(a)));
        if (g.companyId) takenIds.add(g.companyId);
        added++;
      }
    }
  }

  // 2. Prior deals — one batched query over every alias of every buyer.
  const aliasesByPartner = new Map<PartnerInput, string[]>();
  const allAliases = new Set<string>();
  for (const { partner, company } of resolved) {
    const al = nameAliases(partner.company_name, company?.name_variations).concat(company ? [company.name] : []);
    aliasesByPartner.set(partner, al);
    al.forEach(a => allAliases.add(a));
  }
  let dealRows: DealRow[] = [];
  if (allAliases.size) {
    const filter = [...allAliases].map(a => `licensee_name.ilike.${orValue(a)}`).join(',');
    const { data } = await supabase
      .from('deals')
      .select(DEAL_COLS)
      .eq('is_synthetic', false)
      .not('is_canonical', 'is', false)
      .not('verification_status', 'in', '("rejected","flagged")')
      .or(filter)
      .order('announced_date', { ascending: false })
      .limit(1000);
    if (Array.isArray(data)) dealRows = data as DealRow[];
  }
  const dealsFor = (p: PartnerInput): DealRow[] => {
    const al = new Set((aliasesByPartner.get(p) ?? []).map(norm));
    return dealRows.filter(d => al.has(norm(d.licensee_name)));
  };

  // 3. Counterparty premiums — latest row per company (by id, then by name alias).
  const premiumRows: PremiumRow[] = [];
  {
    const allIds = [...new Set(resolved.map(r => r.company?.id ?? r.partner.company_id).filter((x): x is string => !!x))];
    const idFilter = allIds.length ? [`company_id.in.(${allIds.join(',')})`] : [];
    const nameFilter = [...allAliases].map(a => `company_name.ilike.${orValue(a)}`);
    const { data } = await supabase
      .from('counterparty_premiums')
      .select('company_id,company_name,premium_multiplier,sample_size,confidence,as_of_date')
      .or([...idFilter, ...nameFilter].join(','))
      .order('as_of_date', { ascending: false })
      .limit(200);
    if (Array.isArray(data)) premiumRows.push(...(data as PremiumRow[]));
  }
  const premiumFor = (p: PartnerInput, company: CompanyRow | null): BuyerCandidate['counterpartyPremium'] => {
    const al = new Set((aliasesByPartner.get(p) ?? []).map(norm));
    const row = premiumRows.find(r => (company && r.company_id === company.id) || (p.company_id && r.company_id === p.company_id))
      ?? premiumRows.find(r => al.has(norm(r.company_name)));
    if (!row || !Number.isFinite(Number(row.premium_multiplier))) return null;
    return { multiplier: Number(row.premium_multiplier), n: Number(row.sample_size ?? 0), confidence: String(row.confidence ?? 'low') };
  };

  // 4. Assemble candidates.
  const valuations = opts.valuations ?? [];
  const pool: BuyerCandidate[] = [];
  const excludedRaw: Array<{ name: string; reason: string; score: number }> = [];
  let totalPriorDeals = 0;
  let verifiedPriorDeals = 0;

  for (const { partner, company } of resolved) {
    const deals = dealsFor(partner);
    totalPriorDeals += deals.length;
    verifiedPriorDeals += deals.filter(d => d.verified).length;

    const sameTA = (d: DealRow): boolean => {
      if (!taKey) return false;
      if (norm(d.therapeutic_area) === taKey) return true;
      const ind = norm(asset.indication);
      return !!ind && (norm(d.indication_category).includes(ind) || norm(d.indication_specific).includes(ind));
    };
    const recentIndication = deals
      .filter(d => isSameIndication(d, asset.indication))
      .map(d => ({ parties: `${d.licensor_name} → ${d.licensee_name}`, year: d.announced_date ? parseInt(d.announced_date.slice(0, 4), 10) || null : null }))
      .filter(d => d.year != null && d.year >= nowYear - INDICATION_DEAL_WINDOW_YEARS)
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0] ?? null;
    const priorDeals: BuyerPriorDeal[] = deals
      .map(d => ({
        parties: `${d.licensor_name} → ${d.licensee_name}`,
        year: d.announced_date ? parseInt(d.announced_date.slice(0, 4), 10) || null : null,
        phase: normalisePhase(d.phase_at_signing),
        structure: normaliseStructure(d.deal_type),
        upfrontM: d.upfront_usd != null && Number.isFinite(Number(d.upfront_usd)) ? Number(d.upfront_usd) / 1e6 : null,
        totalM: d.total_deal_value_usd != null && Number.isFinite(Number(d.total_deal_value_usd)) ? Number(d.total_deal_value_usd) / 1e6 : null,
        indication: d.indication_specific ?? d.indication_category ?? null,
        sameTA: sameTA(d),
      }))
      .map((row, i) => ({ ...row, sourceUrl: deals[i].source_url ?? null }))
      .sort((a, b) => (Number(b.sameTA) - Number(a.sameTA)) || ((b.year ?? 0) - (a.year ?? 0)))
      .slice(0, 3);

    // Patent cliffs: company row first, then the match API's strategic_context.
    const cliffs = parsePatentCliffs(company?.patent_cliffs);
    if (!cliffs.length && partner.strategic_context?.patent_cliffs?.length) {
      cliffs.push(...parsePatentCliffs(partner.strategic_context.patent_cliffs));
    }
    const rarFromCliffs = (y: number): number | null => {
      const inYear = cliffs.filter(c => c.expiryYear === y && c.revenueUsd);
      return inYear.length ? inYear.reduce((s, c) => s + (c.revenueUsd ?? 0), 0) : null;
    };
    const rarFromContext = (y: number): number | null => {
      const hit = partner.strategic_context?.revenue_at_risk?.find(r => r.year === y);
      return hit && hit.amount > 0 ? hit.amount : null;
    };
    const rar = (col: number | null | undefined, y: number): number | null => {
      if (col != null && Number(col) > 0) return Number(col);
      return rarFromCliffs(y) ?? rarFromContext(y);
    };
    const revenueAtRisk = {
      y2025: rar(company?.revenue_at_risk_2025, 2025),
      y2026: rar(company?.revenue_at_risk_2026, 2026),
      y2027: rar(company?.revenue_at_risk_2027, 2027),
    };
    const totalRevenueUsd = company?.total_annual_revenue != null && Number(company.total_annual_revenue) > 0 ? Number(company.total_annual_revenue) : null;
    const intentScore = partner.pharma_intent?.intentScore ?? null;
    const dealsLast12mo = Number(company?.deals_last_12mo ?? partner.deals_last_12mo ?? 0) || 0;
    const dealsLast24mo = Number(company?.deals_last_24mo ?? partner.deals_last_24mo ?? 0) || 0;
    const hiringBd = company?.hiring_bd_roles ?? null;
    const rar2627 = (revenueAtRisk.y2026 ?? 0) + (revenueAtRisk.y2027 ?? 0);

    const urgency = computeUrgency({
      revenueAtRiskUsd: rar2627 > 0 ? rar2627 : null,
      totalRevenueUsd,
      dealsLast12mo,
      intentScore,
      hiringBd,
    });

    const prefMin = company?.phase_preference_min ?? partner.phase_preference_min ?? null;
    const prefMax = company?.phase_preference_max ?? partner.phase_preference_max ?? null;
    const verdict = transactsAtPhase(assetPhase, deals.map(d => d.phase_at_signing), prefMin, prefMax);

    const fit = Math.max(0, Math.min(100, Number(partner.match_score) || 0));
    const valuation = valuations.find(v =>
      (partner.company_id && v.buyer.companyId === partner.company_id) ||
      (company && v.buyer.companyId === company.id) ||
      norm(v.buyer.companyName) === norm(partner.company_name));
    const toRange = (r: { low: number; median: number; high: number } | undefined): Range3 | null =>
      r && Number.isFinite(r.median) ? { low: r.low, median: r.median, high: r.high } : null;

    const companyType = company?.company_type ?? partner.company_type ?? null;
    const hqCountry = company?.hq_country ?? partner.hq_country ?? null;
    const derivedRegion = regionOf(company?.hq_region, hqCountry);
    const base = {
      companyId: company?.id ?? partner.company_id ?? null,
      name: partner.company_name.trim(),
      companyType,
      sizeBucket: sizeBucketOf(companyType, company?.total_annual_revenue),
      hqRegion: company?.hq_region ?? (derivedRegion !== 'unknown' ? derivedRegion : null),
      hqCountry,
      fit,
      urgency,
      intentScore,
      intentTier: partner.pharma_intent?.intentTier ?? null,
      preferredDealType: partner.pharma_intent?.preferredDealType ?? null,
      dealsLast12mo,
      dealsLast24mo,
      lastDealDate: company?.last_deal_date ?? partner.last_deal_date ?? (deals[0]?.announced_date ?? null),
      phasePreference: { min: prefMin, max: prefMax },
      transactsAtPhase: verdict,
      totalRevenueUsd,
      revenueAtRisk,
      patentCliffs: cliffs.map(c => ({ drug: c.drug, expiryYear: c.expiryYear, revenueUsd: c.revenueUsd })),
      hiringBd,
      acquisitionAppetite: company?.acquisition_appetite ?? partner.acquisition_appetite ?? null,
      priorDeals,
      counterpartyPremium: premiumFor(partner, company),
      impliedUpfront: toRange(valuation?.buyerUpfront),
      impliedTotal: toRange(valuation?.buyerSpecificDealValue),
      source: partner.source ?? 'partner_match',
      recentIndicationDeal: recentIndication,
    };

    const candidate: BuyerCandidate = {
      ...base,
      whyNow: buildWhyNow({ ...base, name: base.name }, nowYear, taLabel),
      howToEngage: buildHowToEngage({ ...base }, assetPhase, taLabel, nowYear),
    };
    pool.push(candidate);

    if (verdict === 'no') {
      const yrs = deals.map(d => d.announced_date?.slice(0, 4)).filter(Boolean).sort();
      const stated = phaseRank(prefMin) != null && phaseRank(prefMax) != null && phaseRank(prefMin)! <= phaseRank(prefMax)!;
      excludedRaw.push({
        name: candidate.name,
        score: combinedScore({ fit, urgency, recentIndicationDeal: recentIndication }),
        reason: stated
          ? `stated stage range starts at ${PHASE_TEXT[normalisePhase(prefMin)]}; no ${assetPhaseText} deal in our data`
          : `${deals.length} disclosed deals${yrs.length ? ` since ${yrs[0]}` : ''}, none at ${assetPhaseText} or earlier`,
      });
    }
  }

  // 5. Mix rule: 12 from the pool, >= 4 mid-sized and >= 4 large when
  // available, rest by score, regional tiebreak; 'no' verdicts last.
  const { selected: candidates, mix } = selectMix(pool, CANDIDATE_TARGET);
  const supplementCount = candidates.filter(c => c.source === 'deal_history').length;
  // Stage exclusions from the whole pool (strongest first) so a high-fit buyer
  // that does not transact here is named even when it did not make the list.
  const excluded: BuyerMap['excluded'] = excludedRaw
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ name, reason }) => ({ name, reason }));

  const process = splitProcess(candidates, assetPhaseText);
  const verifiedShare = totalPriorDeals ? Math.round((verifiedPriorDeals / totalPriorDeals) * 100) : 0;

  return {
    source: {
      source: 'Solidus deal database and company profiles',
      n: totalPriorDeals,
      asOf,
      note: `${candidates.length} buyers selected from ${pool.length} profiled${supplementCount ? ` (${supplementCount} added from deal history in ${taLabel})` : ''}; prior deals are non-synthetic, canonical rows, ${verifiedShare}% verified with citation`,
    },
    candidates,
    excluded,
    process,
    mix,
  };
}
