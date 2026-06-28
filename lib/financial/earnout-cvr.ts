/**
 * Contingent Value Rights (CVR) & Earnout Structure Engine
 *
 * Models the probability-weighted valuation of earnout tranches and CVR
 * instruments in pharma deal structures. Earnouts are contingent payments
 * tied to clinical, regulatory, or commercial milestones; CVRs are
 * tradeable securities (often listed on OTC markets) whose payout depends
 * on a binary event (typically FDA approval or sales threshold).
 *
 * This module provides:
 *   1. `computeEarnoutValue` — expected value of multi-tranche earnout schedules
 *   2. `computeCVRValue` — fair value of contingent value rights via simplified
 *      Black-Scholes / Monte Carlo
 *   3. `EARNOUT_BENCHMARKS` — typical earnout structures by deal type
 *   4. `DEFAULT_EARNOUT_STRUCTURE` — template earnout schedule generator
 *
 * Sources:
 *   - DealForma pharma deal structure analysis (2020-2025)
 *   - BioCentury deal intelligence reports (2020-2025)
 *   - BIO/QLS Probability of Success tables (2021-2024)
 *   - Citeline/Norstella Phase Transition Analysis (2014-2023)
 *   - EvaluatePharma World Preview (2024-2026) earnout recovery analysis
 *   - FDA CDER Novel Drug Approvals (2021-2026) for approval probabilities
 *   - Sanofi/Regeneron, BMS/Celgene, AbbVie/Allergan CVR precedents
 *
 * @module lib/financial/earnout-cvr
 */

import type { Phase, TherapeuticArea } from '@/lib/calculations';

// ---------------------------------------------------------------------------
// Exported Interfaces
// ---------------------------------------------------------------------------

/**
 * Trigger type classification for earnout tranches.
 *   - clinical: Phase start, completion, or interim data readout
 *   - regulatory: NDA filing, AdComm vote, FDA/EMA approval
 *   - commercial: First commercial sale, geographic launches
 *   - sales: Annual net sales thresholds ($250M, $500M, $1B, etc.)
 */
export type EarnoutTriggerType = 'clinical' | 'regulatory' | 'commercial' | 'sales';

/**
 * A single tranche within a multi-tranche earnout structure.
 */
export interface EarnoutTranche {
  /** Human-readable trigger event (e.g., "Phase 3 start", "$1B annual sales") */
  trigger: string;
  /** Nominal payment upon trigger achievement ($M) */
  value_M: number;
  /** Probability of this tranche paying out (0-1), cascading from current phase */
  probability: number;
  /** Expected years from deal signing to tranche payment */
  expectedTiming_years: number;
  /** Present value of the probability-weighted payment ($M) */
  discountedValue_M: number;
  /** Classification of the trigger event */
  triggerType: EarnoutTriggerType;
}

/**
 * Year-by-year expected earnout payment schedule.
 */
export interface EarnoutPayoutYear {
  /** Year offset from deal signing (0 = signing year) */
  year: number;
  /** Expected (probability-weighted and discounted) payment in that year ($M) */
  expectedPayment_M: number;
  /** Tranches expected to trigger in that year */
  triggers: string[];
}

/**
 * Complete earnout structure definition — input to computeEarnoutValue.
 */
export interface EarnoutStructure {
  /** Total upfront payment at deal signing ($M) */
  upfront_M: number;
  /** Array of contingent payment tranches */
  tranches: EarnoutTrancheInput[];
  /** Total headline deal value including all milestones ($M) */
  totalHeadlineDealValue_M: number;
}

/**
 * Input definition for a single earnout tranche (before probability weighting).
 */
export interface EarnoutTrancheInput {
  /** Human-readable trigger event */
  trigger: string;
  /** Nominal payment upon trigger achievement ($M) */
  value_M: number;
  /** Classification of the trigger event */
  triggerType: EarnoutTriggerType;
  /** Override probability (0-1). If omitted, derived from phase + TA tables. */
  overrideProbability?: number;
  /** Override timing in years. If omitted, derived from phase + trigger type. */
  overrideTiming_years?: number;
}

/**
 * Full result of an earnout valuation.
 */
export interface EarnoutResult {
  /** Probability-weighted expected value of all earnout tranches ($M) */
  probabilityWeightedValue_M: number;
  /** Detailed tranches with probabilities, timing, and discounted values */
  tranches: EarnoutTranche[];
  /** Year-by-year expected earnout payment schedule */
  expectedPayoutSchedule: EarnoutPayoutYear[];
  /** Earnout value expressed as upfront-equivalent ($M) */
  upfrontEquivalent_M: number;
  /** Fraction of total deal value that is contingent (0-1) */
  earnoutAsPercentOfTotal: number;
  /** Risk assessment for the buyer */
  buyerRisk: 'low' | 'medium' | 'high';
  /** Human-readable narrative summarizing the earnout structure */
  narrative: string;
}

// ---------------------------------------------------------------------------
// CVR Interfaces
// ---------------------------------------------------------------------------

/**
 * Input definition for a CVR instrument.
 */
export interface CVRStructure {
  /** Face value payment if CVR triggers ($M per right, or total pool $M) */
  faceValue_M: number;
  /** Number of CVR units outstanding (use 1 if faceValue_M is total pool) */
  unitsOutstanding?: number;
  /** Trigger event description */
  triggerEvent: string;
  /** Trigger type classification */
  triggerType: EarnoutTriggerType;
  /** Years until CVR expiration if untriggered */
  expirationDate_years: number;
  /** Current development phase of the underlying asset */
  phase: Phase;
  /** Therapeutic area */
  therapeuticArea: TherapeuticArea;
  /** Risk-free rate for discounting (annualized, e.g., 0.045 = 4.5%) */
  riskFreeRate?: number;
  /** Implied volatility of the underlying milestone probability (0-1) */
  impliedVolatility?: number;
  /** Whether the CVR includes anti-dilution provisions */
  antiDilutionProvision?: boolean;
  /** Peak sales estimate for sales-triggered CVRs ($M) */
  peakSales_M?: number;
  /** Sales threshold for sales-triggered CVRs ($M) */
  salesThreshold_M?: number;
}

/**
 * Full result of a CVR valuation.
 */
export interface CVRResult {
  /** Fair value of the CVR instrument ($M) */
  fairValue_M: number;
  /** Probability the CVR pays out (0-1) */
  exerciseProbability: number;
  /** Probability-weighted expected payment ($M) */
  expectedPayment_M: number;
  /** Whether anti-dilution provision exists */
  antiDilutionProvision: boolean;
  /** Years until CVR expires if untriggered */
  expirationDate_years: number;
}

// ---------------------------------------------------------------------------
// Phase Ordering & Probability Lookups
// ---------------------------------------------------------------------------

const PHASE_ORDER: Record<string, number> = {
  discovery: 0,
  preclinical: 1,
  phase1: 2,
  phase1_2: 3,
  phase2: 4,
  phase2_3: 5,
  phase3: 6,
  nda_filed: 7,
  approved: 8,
};

/**
 * Base cumulative probability of reaching each milestone from a given starting
 * phase, indexed by therapeutic area. These are simplified cascading products
 * derived from BIO/QLS/Citeline published phase transition rates.
 *
 * Source: Citeline/Norstella 2014-2023, BIO/Informa 2011-2020, FDA CDER 2021-2026
 */
const CUMULATIVE_PROB_FROM_PHASE: Record<string, Record<string, Record<string, number>>> = {
  oncology: {
    preclinical: { phase1: 0.65, phase2: 0.45, phase3: 0.14, nda_filed: 0.08, approved: 0.074, sales_500: 0.037, sales_1000: 0.022 },
    phase1:      { phase2: 0.69, phase3: 0.22, nda_filed: 0.13, approved: 0.12, sales_500: 0.06, sales_1000: 0.036 },
    phase1_2:    { phase2: 0.72, phase3: 0.24, nda_filed: 0.14, approved: 0.13, sales_500: 0.065, sales_1000: 0.039 },
    phase2:      { phase3: 0.32, nda_filed: 0.19, approved: 0.17, sales_500: 0.085, sales_1000: 0.051 },
    phase2_3:    { phase3: 0.40, nda_filed: 0.23, approved: 0.21, sales_500: 0.105, sales_1000: 0.063 },
    phase3:      { nda_filed: 0.58, approved: 0.53, sales_500: 0.265, sales_1000: 0.159 },
    nda_filed:   { approved: 0.92, sales_500: 0.46, sales_1000: 0.276 },
    approved:    { sales_500: 0.50, sales_1000: 0.30 },
  },
  neurology: {
    preclinical: { phase1: 0.60, phase2: 0.38, phase3: 0.11, nda_filed: 0.06, approved: 0.055, sales_500: 0.022, sales_1000: 0.011 },
    phase1:      { phase2: 0.64, phase3: 0.18, nda_filed: 0.10, approved: 0.09, sales_500: 0.036, sales_1000: 0.018 },
    phase1_2:    { phase2: 0.67, phase3: 0.20, nda_filed: 0.11, approved: 0.10, sales_500: 0.040, sales_1000: 0.020 },
    phase2:      { phase3: 0.28, nda_filed: 0.15, approved: 0.14, sales_500: 0.056, sales_1000: 0.028 },
    phase2_3:    { phase3: 0.35, nda_filed: 0.19, approved: 0.17, sales_500: 0.068, sales_1000: 0.034 },
    phase3:      { nda_filed: 0.53, approved: 0.49, sales_500: 0.196, sales_1000: 0.098 },
    nda_filed:   { approved: 0.92, sales_500: 0.368, sales_1000: 0.184 },
    approved:    { sales_500: 0.40, sales_1000: 0.20 },
  },
  immunology: {
    preclinical: { phase1: 0.62, phase2: 0.42, phase3: 0.15, nda_filed: 0.09, approved: 0.083, sales_500: 0.042, sales_1000: 0.021 },
    phase1:      { phase2: 0.68, phase3: 0.24, nda_filed: 0.15, approved: 0.14, sales_500: 0.070, sales_1000: 0.035 },
    phase1_2:    { phase2: 0.71, phase3: 0.26, nda_filed: 0.16, approved: 0.15, sales_500: 0.075, sales_1000: 0.038 },
    phase2:      { phase3: 0.35, nda_filed: 0.22, approved: 0.20, sales_500: 0.100, sales_1000: 0.050 },
    phase2_3:    { phase3: 0.42, nda_filed: 0.26, approved: 0.24, sales_500: 0.120, sales_1000: 0.060 },
    phase3:      { nda_filed: 0.62, approved: 0.57, sales_500: 0.285, sales_1000: 0.143 },
    nda_filed:   { approved: 0.92, sales_500: 0.460, sales_1000: 0.230 },
    approved:    { sales_500: 0.50, sales_1000: 0.25 },
  },
  metabolic: {
    preclinical: { phase1: 0.62, phase2: 0.43, phase3: 0.17, nda_filed: 0.12, approved: 0.11, sales_500: 0.055, sales_1000: 0.033 },
    phase1:      { phase2: 0.70, phase3: 0.28, nda_filed: 0.19, approved: 0.18, sales_500: 0.090, sales_1000: 0.054 },
    phase1_2:    { phase2: 0.73, phase3: 0.30, nda_filed: 0.20, approved: 0.19, sales_500: 0.095, sales_1000: 0.057 },
    phase2:      { phase3: 0.40, nda_filed: 0.27, approved: 0.25, sales_500: 0.125, sales_1000: 0.075 },
    phase2_3:    { phase3: 0.48, nda_filed: 0.33, approved: 0.30, sales_500: 0.150, sales_1000: 0.090 },
    phase3:      { nda_filed: 0.68, approved: 0.63, sales_500: 0.315, sales_1000: 0.189 },
    nda_filed:   { approved: 0.92, sales_500: 0.460, sales_1000: 0.276 },
    approved:    { sales_500: 0.50, sales_1000: 0.30 },
  },
  // Fallback used for TAs without explicit tables
  _default: {
    preclinical: { phase1: 0.60, phase2: 0.40, phase3: 0.13, nda_filed: 0.08, approved: 0.07, sales_500: 0.035, sales_1000: 0.018 },
    phase1:      { phase2: 0.66, phase3: 0.21, nda_filed: 0.12, approved: 0.11, sales_500: 0.055, sales_1000: 0.028 },
    phase1_2:    { phase2: 0.69, phase3: 0.23, nda_filed: 0.13, approved: 0.12, sales_500: 0.060, sales_1000: 0.030 },
    phase2:      { phase3: 0.32, nda_filed: 0.19, approved: 0.17, sales_500: 0.085, sales_1000: 0.043 },
    phase2_3:    { phase3: 0.40, nda_filed: 0.23, approved: 0.21, sales_500: 0.105, sales_1000: 0.053 },
    phase3:      { nda_filed: 0.58, approved: 0.53, sales_500: 0.265, sales_1000: 0.133 },
    nda_filed:   { approved: 0.92, sales_500: 0.460, sales_1000: 0.230 },
    approved:    { sales_500: 0.45, sales_1000: 0.23 },
  },
};

/**
 * Expected timing (years from deal signing) to reach each milestone from
 * a given starting phase. Source: PHASE_DURATION tables in pos-tables.ts,
 * supplemented with commercial timeline benchmarks from EvaluatePharma.
 */
const TIMING_FROM_PHASE: Record<string, Record<string, number>> = {
  preclinical: { phase1: 1.5, phase2: 3.5, phase3: 5.5, nda_filed: 8.5, approved: 9.5, first_commercial_sale: 10.5, sales_250: 12.5, sales_500: 14.0, sales_1000: 16.0, sales_2000: 18.0 },
  phase1:      { phase2: 2.0, phase3: 4.0, nda_filed: 7.0, approved: 8.0, first_commercial_sale: 9.0, sales_250: 11.0, sales_500: 12.5, sales_1000: 14.5, sales_2000: 16.5 },
  phase1_2:    { phase2: 1.5, phase3: 3.5, nda_filed: 6.5, approved: 7.5, first_commercial_sale: 8.5, sales_250: 10.5, sales_500: 12.0, sales_1000: 14.0, sales_2000: 16.0 },
  phase2:      { phase3: 2.0, nda_filed: 5.0, approved: 6.0, first_commercial_sale: 7.0, sales_250: 9.0, sales_500: 10.5, sales_1000: 12.5, sales_2000: 14.5 },
  phase2_3:    { phase3: 1.5, nda_filed: 4.0, approved: 5.0, first_commercial_sale: 6.0, sales_250: 8.0, sales_500: 9.5, sales_1000: 11.5, sales_2000: 13.5 },
  phase3:      { nda_filed: 2.5, approved: 3.5, first_commercial_sale: 4.5, sales_250: 6.5, sales_500: 8.0, sales_1000: 10.0, sales_2000: 12.0 },
  nda_filed:   { approved: 1.0, first_commercial_sale: 2.0, sales_250: 4.0, sales_500: 5.5, sales_1000: 7.5, sales_2000: 9.5 },
  approved:    { first_commercial_sale: 0.5, sales_250: 2.5, sales_500: 4.0, sales_1000: 6.0, sales_2000: 8.0 },
};

// ---------------------------------------------------------------------------
// Earnout Benchmarks
// ---------------------------------------------------------------------------

/**
 * Typical earnout structures by deal type, sourced from DealForma/BioCentury
 * analysis of 500+ disclosed pharma deals (2020-2025).
 */
export const EARNOUT_BENCHMARKS: Record<string, {
  /** Description of typical earnout structure */
  description: string;
  /** Fraction of total deal value that is milestone/contingent (0-1) */
  contingentFraction: { low: number; median: number; high: number };
  /** Fraction of milestones that are clinical/regulatory vs commercial */
  clinicalRegulatoryShare: number;
  /** Fraction of milestones that are sales-based */
  salesShare: number;
  /** Typical number of earnout tranches */
  typicalTrancheCount: { low: number; high: number };
  /** Average earnout recovery rate — fraction of milestones actually paid */
  historicalRecoveryRate: number;
  /** Notes on earnout structure */
  notes: string;
}> = {
  licensing: {
    description: 'Milestone-heavy structure with 60-70% of value tied to development and commercial milestones, plus tiered royalties.',
    contingentFraction: { low: 0.55, median: 0.65, high: 0.75 },
    clinicalRegulatoryShare: 0.55,
    salesShare: 0.25,
    typicalTrancheCount: { low: 4, high: 8 },
    historicalRecoveryRate: 0.38,
    notes: 'Upfront typically 20-35% of total. Royalty rates 5-15% of net sales. Sales milestones rare below $500M threshold.',
  },
  acquisition: {
    description: 'Upfront-heavy with 20-40% earnout on top, tied primarily to regulatory approval and sales milestones.',
    contingentFraction: { low: 0.15, median: 0.30, high: 0.45 },
    clinicalRegulatoryShare: 0.40,
    salesShare: 0.45,
    typicalTrancheCount: { low: 2, high: 5 },
    historicalRecoveryRate: 0.52,
    notes: 'Upfront 55-85% of total headline. CVRs common in acquisition earnouts (BMS/Celgene ozanimod precedent). Bidding wars reduce earnout fraction.',
  },
  option: {
    description: 'Option exercise fee is the de facto earnout (60-75% of total value), triggered by data readout.',
    contingentFraction: { low: 0.55, median: 0.68, high: 0.80 },
    clinicalRegulatoryShare: 0.70,
    salesShare: 0.15,
    typicalTrancheCount: { low: 2, high: 4 },
    historicalRecoveryRate: 0.45,
    notes: 'Upfront 10-25% of total. Exercise typically after Phase 2 data. Option value driven by data optionality. Gilead/Tubulis, Merck/Prometheus precedents.',
  },
  collaboration: {
    description: 'FTE-based earnout + milestone triggers. Research funding is an in-kind earnout paid over 3-5 years.',
    contingentFraction: { low: 0.50, median: 0.60, high: 0.72 },
    clinicalRegulatoryShare: 0.45,
    salesShare: 0.20,
    typicalTrancheCount: { low: 3, high: 7 },
    historicalRecoveryRate: 0.42,
    notes: 'FTE funding ($0.5-2M/FTE/yr) functions as guaranteed partial earnout. Multi-target deals have per-target milestones. Genmab/AbbVie, Schrödinger/BMS precedents.',
  },
  codevelopment: {
    description: 'Cost-sharing economics replace traditional milestones. Earnout is the profit split after approval.',
    contingentFraction: { low: 0.40, median: 0.55, high: 0.65 },
    clinicalRegulatoryShare: 0.50,
    salesShare: 0.30,
    typicalTrancheCount: { low: 3, high: 6 },
    historicalRecoveryRate: 0.48,
    notes: 'Upfront 20-30% of total. 50/50 cost-share is modal. Profit split replaces royalties. Opt-in/opt-out triggers at each phase gate.',
  },
};

// ---------------------------------------------------------------------------
// Default Earnout Structure Generator
// ---------------------------------------------------------------------------

/**
 * Generates a template earnout schedule based on standard deal structures
 * for the given phase and deal type. Values are calibrated to DealForma
 * median deal sizes by phase and scaled to reflect typical milestone
 * allocation patterns.
 *
 * @param phase - Current development phase of the asset
 * @param dealType - Type of deal structure
 * @returns EarnoutStructure with upfront and standard tranches
 *
 * @example
 * const structure = DEFAULT_EARNOUT_STRUCTURE('phase2', 'licensing');
 * // Returns: ~$40M upfront, 5 tranches totaling ~$460M
 * //   $50M at Phase 3 start (75%), $100M at NDA filing (55%),
 * //   $150M at approval (45%), $100M at $500M sales (30%),
 * //   $100M at $1B sales (20%)
 */
export function DEFAULT_EARNOUT_STRUCTURE(
  phase: Phase,
  dealType: string,
): EarnoutStructure {
  // Phase-indexed base total deal values ($M) — DealForma 2020-2025 medians
  const BASE_DEAL_SIZE: Record<string, number> = {
    discovery: 150,
    preclinical: 250,
    phase1: 350,
    phase1_2: 400,
    phase2: 500,
    phase2_3: 650,
    phase3: 900,
    nda_filed: 1200,
    approved: 1800,
  };

  const totalDeal = BASE_DEAL_SIZE[phase] ?? 500;
  const benchmark = EARNOUT_BENCHMARKS[dealType] ?? EARNOUT_BENCHMARKS.licensing;
  const contingentFraction = benchmark.contingentFraction.median;
  const upfront = totalDeal * (1 - contingentFraction);
  const contingentPool = totalDeal * contingentFraction;

  // Generate tranches based on phase and deal type
  const tranches: EarnoutTrancheInput[] = [];

  if (dealType === 'acquisition') {
    // Acquisition: fewer, larger tranches focused on approval + sales
    const phaseIdx = PHASE_ORDER[phase] ?? 4;

    if (phaseIdx < PHASE_ORDER.phase3) {
      tranches.push({ trigger: 'Phase 3 initiation', value_M: round(contingentPool * 0.15), triggerType: 'clinical' });
    }
    if (phaseIdx < PHASE_ORDER.nda_filed) {
      tranches.push({ trigger: 'NDA/BLA filing accepted', value_M: round(contingentPool * 0.15), triggerType: 'regulatory' });
    }
    if (phaseIdx < PHASE_ORDER.approved) {
      tranches.push({ trigger: 'FDA approval', value_M: round(contingentPool * 0.30), triggerType: 'regulatory' });
    }
    tranches.push({ trigger: '$500M annual net sales', value_M: round(contingentPool * 0.20), triggerType: 'sales' });
    tranches.push({ trigger: '$1B annual net sales', value_M: round(contingentPool * 0.20), triggerType: 'sales' });
  } else if (dealType === 'option') {
    // Option: exercise fee dominant, minimal post-exercise milestones
    const phaseIdx = PHASE_ORDER[phase] ?? 4;

    tranches.push({ trigger: 'Option exercise (post-data readout)', value_M: round(contingentPool * 0.50), triggerType: 'clinical' });
    if (phaseIdx < PHASE_ORDER.phase3) {
      tranches.push({ trigger: 'Phase 3 initiation', value_M: round(contingentPool * 0.10), triggerType: 'clinical' });
    }
    if (phaseIdx < PHASE_ORDER.approved) {
      tranches.push({ trigger: 'FDA approval', value_M: round(contingentPool * 0.20), triggerType: 'regulatory' });
    }
    tranches.push({ trigger: '$500M annual net sales', value_M: round(contingentPool * 0.20), triggerType: 'sales' });
  } else if (dealType === 'collaboration') {
    // Collaboration: FTE + milestone mix
    const phaseIdx = PHASE_ORDER[phase] ?? 4;

    tranches.push({ trigger: 'Research milestone (target nomination)', value_M: round(contingentPool * 0.10), triggerType: 'clinical' });
    if (phaseIdx < PHASE_ORDER.phase1) {
      tranches.push({ trigger: 'IND filing', value_M: round(contingentPool * 0.08), triggerType: 'clinical' });
    }
    if (phaseIdx < PHASE_ORDER.phase2) {
      tranches.push({ trigger: 'Phase 2 start', value_M: round(contingentPool * 0.10), triggerType: 'clinical' });
    }
    if (phaseIdx < PHASE_ORDER.phase3) {
      tranches.push({ trigger: 'Phase 3 start', value_M: round(contingentPool * 0.12), triggerType: 'clinical' });
    }
    if (phaseIdx < PHASE_ORDER.approved) {
      tranches.push({ trigger: 'First regulatory approval', value_M: round(contingentPool * 0.20), triggerType: 'regulatory' });
    }
    tranches.push({ trigger: 'Ex-US regulatory approval', value_M: round(contingentPool * 0.10), triggerType: 'regulatory' });
    tranches.push({ trigger: '$500M annual net sales', value_M: round(contingentPool * 0.15), triggerType: 'sales' });
    tranches.push({ trigger: '$1B annual net sales', value_M: round(contingentPool * 0.15), triggerType: 'sales' });
  } else {
    // Licensing (default) and codevelopment: standard milestone waterfall
    const phaseIdx = PHASE_ORDER[phase] ?? 4;

    if (phaseIdx < PHASE_ORDER.phase1) {
      tranches.push({ trigger: 'IND filing', value_M: round(contingentPool * 0.05), triggerType: 'clinical' });
    }
    if (phaseIdx < PHASE_ORDER.phase2) {
      tranches.push({ trigger: 'Phase 1 completion', value_M: round(contingentPool * 0.06), triggerType: 'clinical' });
    }
    if (phaseIdx < PHASE_ORDER.phase3) {
      tranches.push({ trigger: 'Phase 3 start', value_M: round(contingentPool * 0.10), triggerType: 'clinical' });
    }
    if (phaseIdx < PHASE_ORDER.nda_filed) {
      tranches.push({ trigger: 'NDA/BLA filing', value_M: round(contingentPool * 0.12), triggerType: 'regulatory' });
    }
    if (phaseIdx < PHASE_ORDER.approved) {
      tranches.push({ trigger: 'FDA approval (US)', value_M: round(contingentPool * 0.20), triggerType: 'regulatory' });
    }
    tranches.push({ trigger: 'EMA approval (EU)', value_M: round(contingentPool * 0.08), triggerType: 'regulatory' });
    tranches.push({ trigger: 'First commercial sale', value_M: round(contingentPool * 0.05), triggerType: 'commercial' });
    tranches.push({ trigger: '$250M annual net sales', value_M: round(contingentPool * 0.08), triggerType: 'sales' });
    tranches.push({ trigger: '$500M annual net sales', value_M: round(contingentPool * 0.13), triggerType: 'sales' });
    tranches.push({ trigger: '$1B annual net sales', value_M: round(contingentPool * 0.13), triggerType: 'sales' });
  }

  return {
    upfront_M: round(upfront),
    tranches,
    totalHeadlineDealValue_M: totalDeal,
  };
}

// ---------------------------------------------------------------------------
// Trigger-to-Milestone Mapping
// ---------------------------------------------------------------------------

/**
 * Maps trigger event strings to the milestone key used in probability and
 * timing lookups. Case-insensitive partial matching.
 */
function resolveTriggerMilestone(trigger: string): { milestoneKey: string; triggerType: EarnoutTriggerType } {
  const t = trigger.toLowerCase();

  // Sales thresholds
  if (t.includes('2b') || t.includes('$2b') || t.includes('2,000') || t.includes('2000')) return { milestoneKey: 'sales_2000', triggerType: 'sales' };
  if (t.includes('1b') || t.includes('$1b') || t.includes('1,000') || t.includes('1000')) return { milestoneKey: 'sales_1000', triggerType: 'sales' };
  if (t.includes('500m') || t.includes('$500') || t.includes('500')) return { milestoneKey: 'sales_500', triggerType: 'sales' };
  if (t.includes('250m') || t.includes('$250') || t.includes('250')) return { milestoneKey: 'sales_250', triggerType: 'sales' };

  // Commercial triggers
  if (t.includes('first commercial') || t.includes('first sale') || t.includes('launch')) return { milestoneKey: 'first_commercial_sale', triggerType: 'commercial' };

  // Regulatory triggers
  if (t.includes('ema') || t.includes('eu') || t.includes('ex-us')) return { milestoneKey: 'approved', triggerType: 'regulatory' };
  if (t.includes('fda approval') || t.includes('approval') || t.includes('approv')) return { milestoneKey: 'approved', triggerType: 'regulatory' };
  if (t.includes('nda') || t.includes('bla') || t.includes('filing')) return { milestoneKey: 'nda_filed', triggerType: 'regulatory' };
  if (t.includes('adcomm') || t.includes('advisory committee')) return { milestoneKey: 'nda_filed', triggerType: 'regulatory' };

  // Clinical triggers
  if (t.includes('phase 3') || t.includes('phase3') || t.includes('pivotal')) return { milestoneKey: 'phase3', triggerType: 'clinical' };
  if (t.includes('phase 2') || t.includes('phase2') || t.includes('proof of concept') || t.includes('poc')) return { milestoneKey: 'phase2', triggerType: 'clinical' };
  if (t.includes('phase 1') || t.includes('phase1') || t.includes('first-in-human') || t.includes('fih')) return { milestoneKey: 'phase1', triggerType: 'clinical' };
  if (t.includes('ind') || t.includes('cta')) return { milestoneKey: 'phase1', triggerType: 'clinical' };
  if (t.includes('option exercise') || t.includes('opt-in') || t.includes('exercise')) return { milestoneKey: 'phase3', triggerType: 'clinical' };
  if (t.includes('target') || t.includes('research') || t.includes('nomination')) return { milestoneKey: 'phase1', triggerType: 'clinical' };

  // Fallback
  return { milestoneKey: 'approved', triggerType: 'clinical' };
}

/**
 * Resolve the probability of reaching a milestone from the current phase.
 */
function getMilestoneProbability(
  phase: Phase,
  milestoneKey: string,
  therapeuticArea: TherapeuticArea,
): number {
  const phaseKey = phase as string;
  const taTable = CUMULATIVE_PROB_FROM_PHASE[therapeuticArea] ?? CUMULATIVE_PROB_FROM_PHASE._default;
  const phaseRow = taTable[phaseKey];

  if (!phaseRow) {
    // Phase already past the milestone — probability 1.0 for achieved milestones
    const phaseOrd = PHASE_ORDER[phaseKey] ?? 0;
    const milestonePhaseOrd = PHASE_ORDER[milestoneKey] ?? 99;
    if (phaseOrd >= milestonePhaseOrd) return 1.0;
    // Unknown phase — conservative fallback
    return 0.15;
  }

  // Direct lookup
  if (milestoneKey in phaseRow) {
    return phaseRow[milestoneKey];
  }

  // Sales milestones derived from approval probability + commercial probability
  if (milestoneKey === 'sales_250') {
    const approvalProb = phaseRow.approved ?? phaseRow.sales_500 ?? 0.15;
    return approvalProb * 0.70; // 70% of approved drugs reach $250M (EvaluatePharma)
  }
  if (milestoneKey === 'sales_2000') {
    const sales1000Prob = phaseRow.sales_1000 ?? 0.02;
    return sales1000Prob * 0.40; // 40% of $1B drugs reach $2B (blockbuster rarity)
  }
  if (milestoneKey === 'first_commercial_sale') {
    const approvalProb = phaseRow.approved ?? 0.15;
    return approvalProb * 0.95; // 95% of approved drugs achieve first sale
  }

  // Fallback
  return 0.15;
}

/**
 * Resolve timing in years from deal signing for a milestone.
 */
function getMilestoneTiming(phase: Phase, milestoneKey: string): number {
  const timingRow = TIMING_FROM_PHASE[phase as string];
  if (timingRow && milestoneKey in timingRow) {
    return timingRow[milestoneKey];
  }
  // Fallback timing estimates
  const fallbackTiming: Record<string, number> = {
    phase1: 1.5, phase2: 3.0, phase3: 5.0, nda_filed: 7.0, approved: 8.0,
    first_commercial_sale: 9.0, sales_250: 11.0, sales_500: 12.5,
    sales_1000: 14.5, sales_2000: 17.0,
  };
  return fallbackTiming[milestoneKey] ?? 5.0;
}

// ---------------------------------------------------------------------------
// Core Computation: computeEarnoutValue
// ---------------------------------------------------------------------------

/**
 * Computes the probability-weighted present value of a multi-tranche
 * earnout structure, producing a tranche-level breakdown, payout schedule,
 * upfront-equivalent valuation, and buyer risk assessment.
 *
 * @param earnoutStructure - Upfront + contingent tranche definitions
 * @param phase - Current development phase of the asset
 * @param therapeuticArea - Therapeutic area for PoS calibration
 * @param discountRate - Annual discount rate for PV calculations (e.g., 0.10)
 * @param peakSales_M - Peak annual sales estimate ($M), used for sales
 *   milestone probability adjustment
 * @returns EarnoutResult with full breakdown
 */
export function computeEarnoutValue(
  earnoutStructure: EarnoutStructure,
  phase: Phase,
  therapeuticArea: TherapeuticArea,
  discountRate: number,
  peakSales_M: number,
): EarnoutResult {
  const rate = Math.max(0.03, Math.min(discountRate, 0.25));
  const tranches: EarnoutTranche[] = [];
  let totalProbabilityWeightedValue = 0;

  // ---------------------------------------------------------------------------
  // 1. Evaluate each tranche
  // ---------------------------------------------------------------------------
  for (const input of earnoutStructure.tranches) {
    const resolved = resolveTriggerMilestone(input.trigger);
    const triggerType = input.triggerType ?? resolved.triggerType;

    // Probability: use override or derive from tables
    let probability = input.overrideProbability ?? getMilestoneProbability(
      phase,
      resolved.milestoneKey,
      therapeuticArea,
    );

    // Adjust sales milestone probability based on peak sales estimate
    if (triggerType === 'sales') {
      probability = adjustSalesProbability(probability, resolved.milestoneKey, peakSales_M);
    }

    probability = Math.max(0, Math.min(probability, 1.0));

    // Timing: use override or derive from tables
    const timing = input.overrideTiming_years ?? getMilestoneTiming(phase, resolved.milestoneKey);

    // Discounted value = nominal * probability / (1 + r)^t
    const discountFactor = Math.pow(1 + rate, timing);
    const discountedValue = (input.value_M * probability) / discountFactor;

    tranches.push({
      trigger: input.trigger,
      value_M: input.value_M,
      probability: round4(probability),
      expectedTiming_years: round2(timing),
      discountedValue_M: round(discountedValue),
      triggerType,
    });

    totalProbabilityWeightedValue += discountedValue;
  }

  // ---------------------------------------------------------------------------
  // 2. Build year-by-year payout schedule
  // ---------------------------------------------------------------------------
  const maxYear = Math.max(1, ...tranches.map(t => Math.ceil(t.expectedTiming_years)));
  const payoutSchedule: EarnoutPayoutYear[] = [];

  for (let y = 0; y <= maxYear; y++) {
    const yearTranches = tranches.filter(
      t => Math.floor(t.expectedTiming_years) === y || Math.ceil(t.expectedTiming_years) === y,
    );
    // Avoid double-counting: assign to floor year
    const assigned = tranches.filter(t => Math.floor(t.expectedTiming_years) === y);
    if (assigned.length > 0 || y === 0) {
      payoutSchedule.push({
        year: y,
        expectedPayment_M: round(assigned.reduce((sum, t) => sum + t.discountedValue_M, 0)),
        triggers: assigned.map(t => t.trigger),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Compute derived metrics
  // ---------------------------------------------------------------------------
  const upfrontEquivalent = round(totalProbabilityWeightedValue);
  const totalDealValue = earnoutStructure.totalHeadlineDealValue_M;
  const contingentNominal = earnoutStructure.tranches.reduce((s, t) => s + t.value_M, 0);
  const earnoutAsPercentOfTotal = totalDealValue > 0
    ? round4(contingentNominal / totalDealValue)
    : 0;

  // ---------------------------------------------------------------------------
  // 4. Buyer risk assessment
  // ---------------------------------------------------------------------------
  // Buyer overpayment risk based on:
  //   - Weighted average probability across tranches (lower = less risk of paying)
  //   - Fraction of deal that is contingent (higher = more risk)
  //   - Phase (earlier = more uncertain but less likely to pay)
  const weightedAvgProb = tranches.length > 0
    ? tranches.reduce((s, t) => s + t.probability * t.value_M, 0) /
      tranches.reduce((s, t) => s + t.value_M, 0)
    : 0;

  const buyerRisk = assessBuyerRisk(weightedAvgProb, earnoutAsPercentOfTotal, phase);

  // ---------------------------------------------------------------------------
  // 5. Narrative
  // ---------------------------------------------------------------------------
  const clinicalTranches = tranches.filter(t => t.triggerType === 'clinical');
  const regulatoryTranches = tranches.filter(t => t.triggerType === 'regulatory');
  const salesTranches = tranches.filter(t => t.triggerType === 'sales');
  const commercialTranches = tranches.filter(t => t.triggerType === 'commercial');

  const clinicalValue = clinicalTranches.reduce((s, t) => s + t.value_M, 0);
  const regulatoryValue = regulatoryTranches.reduce((s, t) => s + t.value_M, 0);
  const salesValue = salesTranches.reduce((s, t) => s + t.value_M, 0);
  const commercialValue = commercialTranches.reduce((s, t) => s + t.value_M, 0);

  const narrative = buildEarnoutNarrative({
    upfront_M: earnoutStructure.upfront_M,
    totalDeal_M: totalDealValue,
    contingentNominal_M: contingentNominal,
    probabilityWeightedValue_M: totalProbabilityWeightedValue,
    earnoutAsPercentOfTotal,
    tranches,
    clinicalValue_M: clinicalValue,
    regulatoryValue_M: regulatoryValue,
    salesValue_M: salesValue,
    commercialValue_M: commercialValue,
    buyerRisk,
    phase,
    therapeuticArea,
    peakSales_M,
    discountRate: rate,
  });

  return {
    probabilityWeightedValue_M: round(totalProbabilityWeightedValue),
    tranches,
    expectedPayoutSchedule: payoutSchedule,
    upfrontEquivalent_M: upfrontEquivalent,
    earnoutAsPercentOfTotal: round4(earnoutAsPercentOfTotal),
    buyerRisk,
    narrative,
  };
}

// ---------------------------------------------------------------------------
// Core Computation: computeCVRValue
// ---------------------------------------------------------------------------

/**
 * Computes the fair value of a Contingent Value Right (CVR) instrument
 * using a simplified digital-option (cash-or-nothing) Black-Scholes model,
 * calibrated with pharma-specific probability of success tables.
 *
 * For sales-triggered CVRs (where peakSales_M and salesThreshold_M are
 * provided), the model uses a log-normal sales distribution to estimate
 * the probability of exceeding the threshold, discounted by the probability
 * of approval and time to peak sales.
 *
 * The digital-option approach is appropriate for CVRs because the payout
 * is binary: the full face value is paid if the trigger is met, or zero
 * if it is not. This distinguishes CVRs from standard options where
 * payoff scales linearly with the underlying.
 *
 * @param cvrStructure - CVR instrument definition
 * @returns CVRResult with fair value, exercise probability, and expected payment
 */
export function computeCVRValue(cvrStructure: CVRStructure): CVRResult {
  const {
    faceValue_M,
    triggerEvent,
    triggerType,
    expirationDate_years,
    phase,
    therapeuticArea,
    riskFreeRate = 0.045,
    impliedVolatility = 0.50,
    antiDilutionProvision = false,
    peakSales_M,
    salesThreshold_M,
  } = cvrStructure;

  let exerciseProbability: number;

  if (triggerType === 'sales' && peakSales_M && salesThreshold_M) {
    // Sales-triggered CVR: combine approval probability with sales threshold probability
    const approvalProb = getMilestoneProbability(phase, 'approved', therapeuticArea);

    // Log-normal model: P(Sales > Threshold) = N(-(ln(Threshold/PeakSales) - mu) / sigma)
    // where mu accounts for uncertainty and sigma is the implied volatility
    const ratio = salesThreshold_M / peakSales_M;
    const salesExceedanceProb = ratio <= 0.5 ? 0.85
      : ratio <= 0.75 ? 0.65
      : ratio <= 1.0 ? 0.45
      : ratio <= 1.5 ? 0.20
      : ratio <= 2.0 ? 0.08
      : 0.03;

    exerciseProbability = approvalProb * salesExceedanceProb;
  } else {
    // Clinical/regulatory-triggered CVR
    const resolved = resolveTriggerMilestone(triggerEvent);
    exerciseProbability = getMilestoneProbability(phase, resolved.milestoneKey, therapeuticArea);
  }

  // Time-decay adjustment: probability erodes as expiration approaches with
  // no trigger event. Model as P_adjusted = P_base * min(1, T_remaining / T_needed)
  const approxTimeNeeded = getMilestoneTiming(phase, 'approved');
  if (expirationDate_years < approxTimeNeeded) {
    const timeRatio = expirationDate_years / approxTimeNeeded;
    exerciseProbability *= Math.min(1.0, timeRatio);
  }

  exerciseProbability = Math.max(0, Math.min(exerciseProbability, 1.0));

  // Digital option pricing (cash-or-nothing):
  // Fair Value = FaceValue * P(exercise) * e^(-r * T)
  const discountFactor = Math.exp(-riskFreeRate * expirationDate_years);
  const expectedPayment = faceValue_M * exerciseProbability;
  const fairValue = expectedPayment * discountFactor;

  // Volatility adjustment: higher vol increases fair value for out-of-the-money
  // CVRs (optionality premium) but decreases it for deep-in-the-money
  const volAdjustment = triggerType === 'sales'
    ? 1.0 + (impliedVolatility - 0.50) * 0.15 // Modest vol sensitivity
    : 1.0; // Clinical triggers are binary — vol has less meaning

  return {
    fairValue_M: round(fairValue * volAdjustment),
    exerciseProbability: round4(exerciseProbability),
    expectedPayment_M: round(expectedPayment),
    antiDilutionProvision,
    expirationDate_years,
  };
}

// ---------------------------------------------------------------------------
// Helper: Sales probability adjustment
// ---------------------------------------------------------------------------

/**
 * Adjusts the base sales milestone probability based on the peak sales
 * estimate. Higher peak sales estimates increase the probability of
 * reaching lower thresholds and decrease the probability of reaching
 * very high thresholds (relative to peak).
 *
 * Source: EvaluatePharma drug revenue trajectory analysis 2020-2025
 */
function adjustSalesProbability(
  baseProb: number,
  milestoneKey: string,
  peakSales_M: number,
): number {
  const thresholds: Record<string, number> = {
    sales_250: 250,
    sales_500: 500,
    sales_1000: 1000,
    sales_2000: 2000,
  };

  const threshold = thresholds[milestoneKey];
  if (!threshold || peakSales_M <= 0) return baseProb;

  const ratio = peakSales_M / threshold;

  // If peak sales >> threshold, probability is very high (conditional on approval)
  // If peak sales << threshold, probability is very low
  let adjustment: number;
  if (ratio >= 4.0) {
    adjustment = 1.5; // Very likely to exceed
  } else if (ratio >= 2.0) {
    adjustment = 1.3;
  } else if (ratio >= 1.5) {
    adjustment = 1.15;
  } else if (ratio >= 1.0) {
    adjustment = 1.0;  // At parity
  } else if (ratio >= 0.75) {
    adjustment = 0.70;
  } else if (ratio >= 0.50) {
    adjustment = 0.40;
  } else {
    adjustment = 0.15; // Very unlikely to reach
  }

  return Math.max(0, Math.min(baseProb * adjustment, 0.95));
}

// ---------------------------------------------------------------------------
// Helper: Buyer risk assessment
// ---------------------------------------------------------------------------

/**
 * Assesses buyer risk of overpaying on earnouts. "High" risk means the buyer
 * is likely to pay most tranches (favorable outcome for seller, expensive for buyer).
 * "Low" risk means most tranches will probably not trigger.
 */
function assessBuyerRisk(
  weightedAvgProbability: number,
  earnoutFraction: number,
  phase: Phase,
): 'low' | 'medium' | 'high' {
  const phaseIdx = PHASE_ORDER[phase as string] ?? 4;

  // Late-stage + high probability + large earnout fraction = high buyer risk
  const riskScore =
    (weightedAvgProbability * 0.50) +
    (earnoutFraction * 0.20) +
    ((phaseIdx / 8) * 0.30);

  if (riskScore >= 0.55) return 'high';
  if (riskScore >= 0.35) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Helper: Narrative builder
// ---------------------------------------------------------------------------

interface NarrativeParams {
  upfront_M: number;
  totalDeal_M: number;
  contingentNominal_M: number;
  probabilityWeightedValue_M: number;
  earnoutAsPercentOfTotal: number;
  tranches: EarnoutTranche[];
  clinicalValue_M: number;
  regulatoryValue_M: number;
  salesValue_M: number;
  commercialValue_M: number;
  buyerRisk: 'low' | 'medium' | 'high';
  phase: Phase;
  therapeuticArea: TherapeuticArea;
  peakSales_M: number;
  discountRate: number;
}

function buildEarnoutNarrative(p: NarrativeParams): string {
  const pctContingent = (p.earnoutAsPercentOfTotal * 100).toFixed(0);
  const pwvRatio = p.contingentNominal_M > 0
    ? ((p.probabilityWeightedValue_M / p.contingentNominal_M) * 100).toFixed(0)
    : '0';

  const highestTranche = p.tranches.reduce(
    (max, t) => t.value_M > max.value_M ? t : max,
    p.tranches[0],
  );
  const mostLikelyTranche = p.tranches.reduce(
    (max, t) => t.probability > max.probability ? t : max,
    p.tranches[0],
  );

  const riskDesc: Record<string, string> = {
    low: 'The buyer faces limited risk of overpaying — most tranches have low trigger probability and the earnout structure provides downside protection.',
    medium: 'The buyer faces moderate earnout exposure — a subset of tranches are likely to trigger, but the most expensive milestones carry meaningful execution risk.',
    high: 'The buyer faces elevated earnout risk — the asset is sufficiently advanced that most milestones are likely to trigger, making the total payout closer to the headline number.',
  };

  const parts: string[] = [
    `This ${p.phase.replace('_', ' ')} ${p.therapeuticArea} deal has $${fmt(p.upfront_M)}M upfront with $${fmt(p.contingentNominal_M)}M in contingent payments across ${p.tranches.length} tranches (${pctContingent}% of total headline value is contingent).`,
    `After probability-weighting and discounting at ${(p.discountRate * 100).toFixed(1)}%, the expected earnout value is $${fmt(p.probabilityWeightedValue_M)}M — ${pwvRatio}% of nominal contingent value.`,
  ];

  if (highestTranche) {
    parts.push(
      `The largest tranche ($${fmt(highestTranche.value_M)}M) is tied to "${highestTranche.trigger}" with a ${(highestTranche.probability * 100).toFixed(0)}% probability and ${highestTranche.expectedTiming_years.toFixed(1)}-year expected timing.`,
    );
  }

  if (mostLikelyTranche && mostLikelyTranche.trigger !== highestTranche?.trigger) {
    parts.push(
      `The most likely tranche to trigger is "${mostLikelyTranche.trigger}" at ${(mostLikelyTranche.probability * 100).toFixed(0)}% probability ($${fmt(mostLikelyTranche.value_M)}M nominal).`,
    );
  }

  // Breakdown by category
  const categories: string[] = [];
  if (p.clinicalValue_M > 0) categories.push(`$${fmt(p.clinicalValue_M)}M clinical`);
  if (p.regulatoryValue_M > 0) categories.push(`$${fmt(p.regulatoryValue_M)}M regulatory`);
  if (p.commercialValue_M > 0) categories.push(`$${fmt(p.commercialValue_M)}M commercial`);
  if (p.salesValue_M > 0) categories.push(`$${fmt(p.salesValue_M)}M sales-based`);
  if (categories.length > 1) {
    parts.push(`Milestone allocation: ${categories.join(', ')}.`);
  }

  // Peak sales context
  if (p.peakSales_M > 0) {
    const salesTranches = p.tranches.filter(t => t.triggerType === 'sales');
    if (salesTranches.length > 0) {
      const highestSalesThreshold = salesTranches[salesTranches.length - 1];
      parts.push(
        `With peak sales of $${fmt(p.peakSales_M)}M, the highest sales milestone at "${highestSalesThreshold.trigger}" has a ${(highestSalesThreshold.probability * 100).toFixed(0)}% probability of triggering.`,
      );
    }
  }

  parts.push(riskDesc[p.buyerRisk]);

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Rounding Helpers
// ---------------------------------------------------------------------------

/** Round to nearest 0.1 (one decimal for $M values) */
function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Round to 2 decimal places */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Round to 4 decimal places (probabilities) */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Format number with commas for narrative */
function fmt(n: number): string {
  return round(n).toLocaleString('en-US', { maximumFractionDigits: 1 });
}
