/**
 * Deal Intelligence Brief v3 — shared data contract.
 *
 * Every new Brief section renders from one of the shapes below. Builders in
 * lib/brief/*.ts produce them (from Supabase + the financial engine); page
 * renderers in lib/report/pages/*.ts consume them. Keep this file free of
 * runtime imports so both server and client code can type against it.
 *
 * Conventions
 *  - Money is in $M unless the field name ends in Usd.
 *  - Every builder output carries `n` (sample size) and `asOf` (ISO date) so
 *    the page can print a source line. No section renders without them.
 *  - `null` means "not available"; renderers must degrade honestly (show the
 *    gap, never invent a value).
 */

// ─── Common ────────────────────────────────────────────────────────────────

export interface Range3 { low: number; median: number; high: number }

/** Source line printed under every chart/table. */
export interface SourceNote {
  /** e.g. "Solidus deal database" | "ClinicalTrials.gov via Solidus" | "Company filings" */
  source: string;
  /** Sample size behind the visual. */
  n: number;
  /** ISO date the data was pulled. */
  asOf: string;
  /** Optional qualifier, e.g. "verified, canonical, non-synthetic rows only". */
  note?: string;
}

export type DealPhase = 'discovery' | 'preclinical' | 'phase_1' | 'phase_2' | 'phase_3' | 'approved' | 'unknown';
export type DealStructure = 'license' | 'option' | 'acquisition' | 'collaboration' | 'co_development' | 'co_promotion' | 'other';

// ─── Asset profile (from intake) ───────────────────────────────────────────

export interface AssetProfile {
  assetName?: string | null;
  company?: string | null;
  mechanism?: string | null;
  target?: string | null;
  modality: string;
  phase: string;
  /** Engine indication key (e.g. lung_nsclc). */
  indication: string;
  /** Human label for the indication (e.g. "Lung Cancer (NSCLC)"); pages and prose print this, never the key. */
  indicationLabel?: string | null;
  therapeuticArea: string;
  territory: string;
  /** Deal structure the client is preparing for. */
  targetDealType: string;
  /** Free text from intake: differentiation, data package, competitive claims. */
  differentiationNotes?: string | null;
  /** e.g. "in vivo efficacy", "IND-enabling complete", "Phase 1 SAD/MAD read out" */
  dataPackageStage?: string | null;
}

// ─── Comparable set (scatter, distribution strips, appendix) ───────────────

export interface CompRow {
  id: string;
  licensor: string;
  licensee: string;
  asset: string | null;
  announcedDate: string | null;   // ISO
  year: number | null;
  phase: DealPhase;
  structure: DealStructure;
  modality: string | null;
  indication: string | null;
  territory: string | null;
  /** $M, null when undisclosed */
  upfrontM: number | null;
  totalM: number | null;
  milestonesM: number | null;
  royaltyLowPct: number | null;
  royaltyHighPct: number | null;
  equityM: number | null;
  verified: boolean;
  sourceType: string | null;
  sourceUrl: string | null;
  /** 0–100 relevance from the hedonic scorer (phase/modality/TA/indication/territory/recency). */
  relevance: number;
  /** Why this comp is in the set, short phrases. */
  reasons: string[];
  /** True when the row is a statistical outlier on totalM (> p75 + 1.5·IQR). */
  outlier: boolean;
  /** Same indication as the asset (vs. same TA only). */
  sameIndication: boolean;
  /** Same mechanism or target as the asset, from the row's target / mechanism / asset-name text. */
  sameMechanism?: boolean;
}

export interface CompStats {
  n: number;
  upfront: { p25: number; p50: number; p75: number } | null;
  total: { p25: number; p50: number; p75: number } | null;
  royaltyMid: { p25: number; p50: number; p75: number } | null;
}

export interface CompSet {
  source: SourceNote;
  rows: CompRow[];
  /** Stats on all rows vs. rows with outliers removed. */
  stats: { all: CompStats; exOutliers: CompStats };
  /** Stats bucketed by phase for the distribution strips. */
  byPhase: Array<{ phase: DealPhase; stats: CompStats }>;
  /** Stats bucketed by structure (license vs option vs acquisition …). */
  byStructure: Array<{ structure: DealStructure; stats: CompStats }>;
  /** Which rows drive the headline (top relevance, non-outlier). */
  headlineDriverIds: string[];
  /** Plain-language note when the set is thin, e.g. "Only 6 same-indication comps; TA-level set used." */
  caveat?: string;
  /** Phase window the rows were taken from: steps from the asset phase (null = any phase) and the printed label. */
  phaseWindow?: { steps: number | null; label: string };
}

// ─── Regional deal strategy ────────────────────────────────────────────────

export type RegionKey = 'global' | 'us' | 'ex_us' | 'europe' | 'japan' | 'greater_china' | 'ex_china' | 'asia_pacific' | 'other';

export interface RegionalStrategy {
  source: SourceNote;
  rows: Array<{
    region: RegionKey;
    label: string;
    n: number;
    upfront: { p25: number; p50: number; p75: number } | null;
    total: { p25: number; p50: number; p75: number } | null;
    /** Median upfront as a share of the global median (null when either side missing). */
    upfrontVsGlobal: number | null;
    exampleDeal?: { parties: string; year: number | null; upfrontM: number | null } | null;
  }>;
  /** Deterministic recommendation text: keep global vs carve out. */
  recommendation: string;
}

// ─── Term-sheet precedent map ──────────────────────────────────────────────

export interface ClauseFrequency {
  clause: string;               // e.g. "Co-development option"
  key: string;                  // stable id
  /** Share of comps (0–1) where the clause was disclosed as present. */
  share: number;
  n: number;
  /** Share within the asset's phase bucket, when computable. */
  sharePhase: number | null;
  nPhase: number;
  /** What to ask for, one line. */
  guidance: string;
}

export interface TermSheetPrecedent {
  source: SourceNote;
  clauses: ClauseFrequency[];
  royaltyTiers: { low: { p25: number; p50: number; p75: number } | null; high: { p25: number; p50: number; p75: number } | null; n: number };
  termYears: { p25: number; p50: number; p75: number; n: number } | null;
}

// ─── Buyer map ─────────────────────────────────────────────────────────────

export interface BuyerPriorDeal {
  parties: string;
  year: number | null;
  phase: DealPhase;
  structure: DealStructure;
  upfrontM: number | null;
  totalM: number | null;
  indication: string | null;
  sameTA: boolean;
  sourceUrl: string | null;
}

/**
 * Size class used by the buyer-mix rule. From companies.company_type when set;
 * otherwise inferred from total_annual_revenue (>= $10B large_pharma,
 * $1–10B mid_pharma, < $1B mid_biotech); 'unknown' when neither is known.
 */
export type BuyerSizeBucket = 'large_pharma' | 'mid_pharma' | 'large_biotech' | 'mid_biotech' | 'specialty' | 'unknown';

export interface BuyerCandidate {
  companyId: string | null;
  name: string;
  companyType: string | null;    // large_pharma | mid_pharma | large_biotech | mid_biotech | specialty
  sizeBucket: BuyerSizeBucket;
  hqRegion: string | null;
  hqCountry: string | null;
  /** 0–100 from partner matching. */
  fit: number;
  /** 0–100 composite of revenue-at-risk share, deal cadence, hiring signal, intent score. */
  urgency: number;
  intentScore: number | null;
  intentTier: string | null;
  preferredDealType: string | null;
  dealsLast12mo: number;
  dealsLast24mo: number;
  lastDealDate: string | null;
  phasePreference: { min: string | null; max: string | null };
  /** Does this buyer transact at the asset's phase (from prior deals or stated preference)? */
  transactsAtPhase: 'yes' | 'no' | 'unknown';
  totalRevenueUsd: number | null;
  revenueAtRisk: { y2025: number | null; y2026: number | null; y2027: number | null };
  patentCliffs: Array<{ drug: string; expiryYear: number; revenueUsd: number | null }>;
  hiringBd: boolean | null;
  acquisitionAppetite: string | null;
  priorDeals: BuyerPriorDeal[];          // up to 3, same TA first
  /** Historical premium vs market (1.0 = market) when known. */
  counterpartyPremium: { multiplier: number; n: number; confidence: string } | null;
  /** Buyer-specific valuation when computed. */
  impliedUpfront: Range3 | null;
  impliedTotal: Range3 | null;
  /** One line each. */
  whyNow: string;
  howToEngage: string;
  /** Where the candidate came from: the partner-match API, or the deal-history supplement used when the match list is thin. */
  source?: 'partner_match' | 'deal_history';
  /** Most recent disclosed deal by this buyer in the asset's own indication within the last three years, when one exists. */
  recentIndicationDeal?: { parties: string; year: number | null } | null;
}

export interface BuyerMap {
  source: SourceNote;
  candidates: BuyerCandidate[];          // ranked, up to 12 after the mix rule
  /** Explicitly excluded names with the reason, e.g. "does not transact preclinical". */
  excluded: Array<{ name: string; reason: string }>;
  /** Suggested process: who first, who as tension, who to hold. */
  process: { lead: string[]; tension: string[]; hold: string[]; rationale: string };
  /**
   * Composition of `candidates`: large = large_pharma + large_biotech,
   * mid = mid_pharma + mid_biotech + specialty, unknown = no size evidence.
   * regions = HQ regions represented (north_america | europe | japan | china_apac | other).
   */
  mix: { large: number; mid: number; unknown: number; regions: string[] };
}

// ─── Landscape: pipeline map + catalyst calendar + patient funnel ──────────

export interface PipelineCell {
  phase: DealPhase;
  programs: Array<{ sponsor: string; intervention: string; nctId: string | null; status: string | null; isBuyerCandidate: boolean }>;
}

export interface PipelineMap {
  source: SourceNote;
  /** Rows: mechanism/modality buckets; columns: phases. */
  rows: Array<{ bucket: string; cells: PipelineCell[]; total: number }>;
  totals: Record<DealPhase, number>;
  /** Where the asset sits (bucket label + phase). */
  assetPosition: { bucket: string; phase: DealPhase } | null;
  crowdingScore: number | null;    // 0–100 when computable
  /**
   * What `crowdingScore` was computed from: the Solidus trial-map formula, or
   * Terrain's competitive density score (1–10 × 10) when the local score is
   * unavailable. Absent means `solidus_trials`.
   */
  crowdingBasis?: 'solidus_trials' | 'terrain_density';
}

export interface CatalystEvent {
  date: string;                    // ISO (month precision is fine)
  kind: 'readout' | 'loe' | 'regulatory' | 'buyer_event';
  title: string;
  sponsor: string | null;
  phase: DealPhase | null;
  nctId: string | null;
  /** Why it matters for this deal, one line. */
  impact: string;
  /** Does this reprice the asset up, down, or unclear? */
  direction: 'up' | 'down' | 'mixed';
  isBuyerCandidate: boolean;
}

export interface CatalystCalendar {
  source: SourceNote;
  windowMonths: number;            // default 24
  events: CatalystEvent[];         // sorted ascending
  /** Recommended go-to-market window, derived. */
  recommendedWindow: { start: string; end: string; rationale: string } | null;
}

export interface PatientFunnel {
  source: SourceNote;
  territory: string;
  steps: Array<{ label: string; value: number }>;   // population → addressable
  pricePerYearUsd: number | null;
  peakShare: Range3 | null;                          // share of addressable
  peakSalesM: Range3;
  /** Where peakSalesM comes from: the financial model's applied figure, or the market estimate when no model ran. */
  peakSalesBasis: 'model' | 'market';
}

export interface Landscape {
  pipeline: PipelineMap | null;
  catalysts: CatalystCalendar | null;
  funnel: PatientFunnel | null;
}

// ─── Valuation bridge (football field) ─────────────────────────────────────

export interface BridgeBar {
  key: 'comps_total' | 'comps_upfront' | 'rnpv' | 'monte_carlo' | 'scenarios' | 'buyer_implied' | 'headline';
  label: string;
  /** What the bar measures: total deal value or upfront. */
  basis: 'total' | 'upfront' | 'rnpv';
  low: number;
  mid: number | null;
  high: number;
  n?: number;
  note?: string;
  /**
   * False when the method produced a number that should not be read as a
   * value (e.g. a negative risk-adjusted NPV at a very low cumulative PoS).
   * Such bars are listed in the method table with their note but are not
   * drawn on the chart, ranked in the reconciliation, or used for the ask.
   */
  informative?: boolean;
}

export interface ValuationBridge {
  asOf: string;
  bars: BridgeBar[];
  /** The single recommended ask (total & upfront) used everywhere in the brief. */
  ask: { totalM: number; upfrontM: number };
  floor: { totalM: number; upfrontM: number };
  walkAway: { upfrontM: number };
  /** Which method set the ask on each basis: the calibrated headline or the comparable-set median. */
  askBasis: { total: 'headline' | 'comps'; upfront: 'headline' | 'comps' };
  /** The anchoring rule, printed on the bridge page so the reader can check it. */
  policy: string;
  /** False when the risk-adjusted NPV is at or below zero and cannot anchor a value. */
  rnpvInformative: boolean;
  /** Printed wherever a page would otherwise show the rNPV as a value; null when informative. */
  rnpvNote: string | null;
  /** Why the methods diverge, 2–4 sentences, deterministic. */
  reconciliation: string;
}

// ─── Inflection path & financing alternative ───────────────────────────────

export interface InflectionOption {
  key: 'deal_now' | 'next_phase' | 'phase_after';
  label: string;                   // "Partner now" | "Partner after IND" | "Partner after Phase 1"
  /** Development cost to reach that point, $M. */
  costM: number;
  months: number;
  /** Probability of reaching that point from today. */
  pReach: number;
  /** Expected upfront / total at that point if reached, $M. */
  upfrontIfReached: Range3;
  totalIfReached: Range3;
  /** Probability-weighted, cost-adjusted expected upfront today, $M (upfront only; shown for reference). */
  expectedUpfrontM: number;
  /**
   * Probability-weighted expected value today, $M: P(reach) × (1 − dilution)
   * × (upfront + PV of milestones) discounted back over the months to reach
   * the point, less the development cost. This is the number the options are
   * compared on; upfront-only comparison always favours dealing now.
   */
  expectedValueM: number;
  /** Dilution implied if the cost is equity-financed at an assumed pre-money, 0–1. */
  dilution: number | null;
  verdict: string;                 // one line
}

export interface InflectionPath {
  asOf: string;
  /** Annual discount rate used to bring deferred proceeds back to today. */
  discountRate: number;
  options: InflectionOption[];
  financing: {
    /** Assumed pre-money used for the dilution math ($M) and where it came from. */
    preMoneyM: number;
    basis: string;
    raiseM: number;
    dilution: number;
    /** Equity value retained on the same asset if financed vs. licensed, $M. */
    retainedValueIfFinanceM: number;
    retainedValueIfLicenseM: number;
  } | null;
  recommendation: string;
}

// ─── Decision summary (page 3) ─────────────────────────────────────────────

export interface DecisionSummary {
  asOf: string;
  /** One sentence. */
  headline: string;
  recommendation: 'partner_now' | 'partner_after_next_readout' | 'run_process_in_parallel' | 'hold';
  recommendationLabel: string;
  rationale: string[];             // 3–5 bullets
  counterparties: Array<{ name: string; role: 'lead' | 'tension' | 'hold'; why: string }>;
  ask: { totalM: number; upfrontM: number; royaltyPct: Range3 | null };
  floor: { totalM: number; upfrontM: number };
  walkAwayUpfrontM: number;
  levers: string[];                // 3 negotiating levers
  wouldChangeView: string[];       // evidence that would move the number
  timeline: Array<{ week: string; step: string }>;
  confidence: 'high' | 'medium' | 'low';
  confidenceBasis: string;
}

// ─── Positioning & objections, diligence readiness ─────────────────────────

export interface PositioningObjections {
  generatedAt: string;
  positioning: string[];           // 2 short paragraphs
  objections: Array<{ objection: string; answer: string; evidenceToPrepare: string }>;  // 5
  /** Model that produced it; page prints "Strategic analysis" not the model. */
  model?: string;
}

export interface DiligenceItem {
  area: string;                    // "Chemistry / CMC", "Nonclinical", "IP", ...
  item: string;
  expectedAtPhase: boolean;        // buyers will expect it at this phase
  status: 'ready' | 'gap' | 'unknown';
}

export interface DiligenceChecklist {
  phase: string;
  modality: string;
  items: DiligenceItem[];
  gaps: string[];                  // derived, top gaps to close before outreach
}

// ─── Coverage / honesty block (methodology page) ───────────────────────────

export interface DataCoverage {
  asOf: string;
  trackedDeals: number;            // quality-filtered rows
  verifiedDeals: number;           // verified with citation
  taDeals: number;                 // in this TA
  indicationDeals: number;         // same indication
  compsUsed: number;
  /** Optional accuracy statement, when a backtest is available. */
  accuracy?: { metric: string; value: string; n: number; note: string } | null;
}

// ─── Managing Partner opinion ──────────────────────────────────────────────

export interface MPOpinion {
  text: string;                    // 1–3 short paragraphs, signed
  reviewer: string;                // "Issa Kildani, Managing Partner"
  reviewedAt: string;              // ISO
}

// ─── Container attached to PDFReportData.brief ─────────────────────────────

export interface BriefIntelligence {
  asOf: string;
  asset: AssetProfile;
  compSet?: CompSet | null;
  regional?: RegionalStrategy | null;
  termSheet?: TermSheetPrecedent | null;
  buyerMap?: BuyerMap | null;
  landscape?: Landscape | null;
  bridge?: ValuationBridge | null;
  inflection?: InflectionPath | null;
  decision?: DecisionSummary | null;
  positioning?: PositioningObjections | null;
  diligence?: DiligenceChecklist | null;
  coverage?: DataCoverage | null;
  mpOpinion?: MPOpinion | null;
  /** The client's own data as supplied at intake (migration 135); never blended into the ask. */
  client?: import('./client-intake').ClientIntake | null;
  /** "Your model vs Solidus" page data. */
  clientComparison?: import('./client-comparison').ClientComparison | null;
  /** Indicative term sheet generated from the decision. */
  indicativeTermSheet?: import('./indicative-term-sheet').IndicativeTermSheet | null;
}
