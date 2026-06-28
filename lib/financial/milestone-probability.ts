/**
 * Milestone Probability Weighting Engine
 *
 * Models individual milestone probability weighting for pharma deals,
 * decomposing total deal value into development, commercial, and regulatory
 * milestones with cascading conditional probabilities.
 *
 * Probabilities cascade: P(reach Phase 3 milestone) = P(reach Phase 3) x
 * P(complete Phase 3 | reached). Commercial milestones are conditional on
 * FDA approval. Phase-dependent: milestones for phases already completed
 * by the asset receive probability 1.0.
 *
 * Sources:
 *   - DealForma 2020-2025 milestone structure analysis
 *   - BIO/QLS Probability of Success tables (2021-2024)
 *   - BIO/Informa "Clinical Development Success Rates" (2011-2020)
 *   - Citeline/Norstella Phase Transition Analysis 2014-2023
 *   - Nature Communications dynamic clinical trial success rates (2025)
 *   - EvaluatePharma World Preview 2024-2026 deal structure analysis
 *   - FDA CDER Novel Drug Approvals 2021-2026
 *
 * @module lib/financial/milestone-probability
 */

import type { Phase, TherapeuticArea, Modality } from '@/lib/calculations';
import { POS_BY_THERAPEUTIC_AREA, POS_MODALITY_ADJUSTMENT, PHASE_DURATION } from './pos-tables';

// ---------------------------------------------------------------------------
// Exported Interfaces
// ---------------------------------------------------------------------------

/**
 * A single milestone with its conditional probability, typical timing,
 * and typical value as a percentage of total deal value.
 */
export interface MilestoneEntry {
  /** Human-readable milestone event name */
  event: string;
  /** Cascading conditional probability of this milestone being achieved (0-1) */
  probability: number;
  /** Typical timing in years from deal signing to this milestone payment */
  typicalTiming_years: number;
  /** Typical milestone payment as % of total deal value (0-100) */
  typicalValue_pct: number;
}

/**
 * Year-by-year expected milestone payout schedule.
 */
export interface AnnualPayout {
  /** Year offset from deal signing (0 = signing year) */
  year: number;
  /** Expected (probability-weighted) milestone payment in that year ($M equivalent pct) */
  expectedPayout_pct: number;
  /** Milestones expected to trigger in that year */
  milestones: string[];
}

/**
 * Complete milestone probability analysis for a pharma deal.
 */
export interface MilestoneProbabilityResult {
  /** Development milestones (IND through FDA approval) */
  developmentMilestones: MilestoneEntry[];
  /** Commercial milestones (first sale through blockbuster thresholds) */
  commercialMilestones: MilestoneEntry[];
  /** Regulatory milestones (ex-US approvals, pediatric, label expansions) */
  regulatoryMilestones: MilestoneEntry[];
  /** Sum of (milestone_value x probability) across all milestones */
  probabilityWeightedTotalValue: number;
  /** Year-by-year expected milestone payment schedule */
  expectedPayoutSchedule: AnnualPayout[];
  /** Human-readable narrative summarizing the milestone structure */
  narrative: string;
}

// ---------------------------------------------------------------------------
// Phase Ordering (for cascade logic)
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
 * Returns true if the asset's current phase is at or beyond the target phase.
 * Milestones for phases already achieved receive probability 1.0.
 */
function phaseAtOrBeyond(currentPhase: string, targetPhase: string): boolean {
  const current = PHASE_ORDER[currentPhase] ?? -1;
  const target = PHASE_ORDER[targetPhase] ?? 99;
  return current >= target;
}

// ---------------------------------------------------------------------------
// Cumulative Transition Probabilities
// ---------------------------------------------------------------------------

/**
 * Maps development milestone events to the phase transition they depend on.
 * Each entry specifies: the phase the asset must REACH, and whether the
 * milestone triggers at the START or COMPLETION of that phase.
 */
interface TransitionMapping {
  /** The phase the asset must be in or have completed */
  requiredPhase: string;
  /** 'start' = milestone triggers when entering this phase; 'complete' = when finishing */
  trigger: 'start' | 'complete';
}

const DEV_MILESTONE_PHASE_MAP: Record<string, TransitionMapping> = {
  'IND filing':           { requiredPhase: 'phase1',   trigger: 'start' },
  'Phase 1 start':        { requiredPhase: 'phase1',   trigger: 'start' },
  'Phase 1 completion':   { requiredPhase: 'phase1',   trigger: 'complete' },
  'Phase 2 start':        { requiredPhase: 'phase2',   trigger: 'start' },
  'Phase 2 interim':      { requiredPhase: 'phase2',   trigger: 'start' },
  'Phase 2 completion':   { requiredPhase: 'phase2',   trigger: 'complete' },
  'Phase 3 start':        { requiredPhase: 'phase3',   trigger: 'start' },
  'Phase 3 interim':      { requiredPhase: 'phase3',   trigger: 'start' },
  'Phase 3 completion':   { requiredPhase: 'phase3',   trigger: 'complete' },
  'NDA/BLA filing':       { requiredPhase: 'nda_filed', trigger: 'start' },
  'AdComm':               { requiredPhase: 'nda_filed', trigger: 'start' },
  'FDA approval':         { requiredPhase: 'approved', trigger: 'start' },
};

/**
 * Computes the cumulative probability of reaching a given phase from the
 * current phase, applying modality adjustments. Uses the cascading product
 * of individual phase transition probabilities.
 *
 * If the asset has already passed the target phase, returns 1.0.
 */
function cumulativeProbToPhase(
  currentPhase: string,
  targetPhase: string,
  ta: string,
  modality: string,
): number {
  if (phaseAtOrBeyond(currentPhase, targetPhase)) return 1.0;

  const rates = POS_BY_THERAPEUTIC_AREA[ta];
  if (!rates) return 0.5; // Fallback for unknown TAs

  const modalityAdj = POS_MODALITY_ADJUSTMENT[modality] ?? 1.0;

  // Ordered transitions from earliest to latest
  const transitions: { from: string; to: string; rate: number }[] = [
    { from: 'discovery',    to: 'preclinical', rate: rates.discoveryToPreclinical ?? 0.45 },
    { from: 'preclinical',  to: 'phase1',      rate: rates.preclinicalToPhase1 },
    { from: 'phase1',       to: 'phase1_2',    rate: 1.0 }, // phase1_2 is a subset of phase1->phase2
    { from: 'phase1_2',     to: 'phase2',      rate: rates.phase1ToPhase2 },
    { from: 'phase2',       to: 'phase2_3',    rate: 1.0 },
    { from: 'phase2_3',     to: 'phase3',      rate: rates.phase2ToPhase3 },
    { from: 'phase3',       to: 'nda_filed',   rate: rates.phase3ToApproval },
    { from: 'nda_filed',    to: 'approved',    rate: rates.ndaFiledToApproval ?? 0.92 },
  ];

  // Standard linear path: preclinical -> phase1 -> phase2 -> phase3 -> nda_filed -> approved
  const standardPath: { from: string; to: string; rate: number }[] = [
    { from: 'discovery',   to: 'preclinical', rate: rates.discoveryToPreclinical ?? 0.45 },
    { from: 'preclinical', to: 'phase1',      rate: rates.preclinicalToPhase1 },
    { from: 'phase1',      to: 'phase2',      rate: rates.phase1ToPhase2 },
    { from: 'phase2',      to: 'phase3',      rate: rates.phase2ToPhase3 },
    { from: 'phase3',      to: 'nda_filed',   rate: rates.phase3ToApproval },
    { from: 'nda_filed',   to: 'approved',    rate: rates.ndaFiledToApproval ?? 0.92 },
  ];

  const currentOrder = PHASE_ORDER[currentPhase] ?? 0;
  const targetOrder = PHASE_ORDER[targetPhase] ?? 8;

  let cumProb = 1.0;

  for (const step of standardPath) {
    const fromOrder = PHASE_ORDER[step.from] ?? 0;
    const toOrder = PHASE_ORDER[step.to] ?? 0;

    // Skip transitions the asset has already completed
    if (toOrder <= currentOrder) continue;
    // Stop once we reach or pass the target
    if (fromOrder >= targetOrder) break;

    // Apply modality adjustment to clinical transition rates
    const adjustedRate = Math.min(step.rate * modalityAdj, 0.99);
    cumProb *= adjustedRate;
  }

  return Math.max(0, Math.min(cumProb, 1.0));
}

/**
 * Computes the probability of completing a phase (reaching the NEXT phase)
 * from the current phase.
 */
function probOfCompletingPhase(
  currentPhase: string,
  targetPhaseCompleted: string,
  ta: string,
  modality: string,
): number {
  // Map completion events to the next phase
  const completionToNext: Record<string, string> = {
    phase1: 'phase2',
    phase2: 'phase3',
    phase3: 'nda_filed',
    nda_filed: 'approved',
  };

  const nextPhase = completionToNext[targetPhaseCompleted];
  if (!nextPhase) return cumulativeProbToPhase(currentPhase, targetPhaseCompleted, ta, modality);

  return cumulativeProbToPhase(currentPhase, nextPhase, ta, modality);
}

// ---------------------------------------------------------------------------
// Typical Milestone Value Allocations by Deal Type
// Source: DealForma 2020-2025 milestone structure analysis
// ---------------------------------------------------------------------------

/**
 * Baseline development milestone value allocations as % of total deal.
 * These represent the median from 500+ disclosed pharma licensing deals
 * analyzed by DealForma (2020-2025).
 */
const BASE_DEV_MILESTONE_VALUES: Record<string, number> = {
  'IND filing':          1.5,
  'Phase 1 start':       2.0,
  'Phase 1 completion':  3.0,
  'Phase 2 start':       3.5,
  'Phase 2 interim':     2.5,
  'Phase 2 completion':  5.0,
  'Phase 3 start':       6.0,
  'Phase 3 interim':     4.0,
  'Phase 3 completion':  7.0,
  'NDA/BLA filing':      5.0,
  'AdComm':              2.0,
  'FDA approval':        8.0,
};

/**
 * Baseline commercial milestone value allocations as % of total deal.
 * Source: DealForma 2020-2025 commercial milestone benchmarks.
 */
const BASE_COMMERCIAL_MILESTONE_VALUES: Record<string, number> = {
  'First commercial sale (US)': 4.0,
  'EU approval':                3.0,
  'Japan approval':             2.5,
  '$100M sales':                3.5,
  '$250M sales':                4.0,
  '$500M sales':                5.0,
  '$1B sales':                  6.0,
  '$2B+ sales':                 5.0,
};

/**
 * Baseline regulatory milestone value allocations as % of total deal.
 */
const BASE_REGULATORY_MILESTONE_VALUES: Record<string, number> = {
  'Pediatric indication approval':  2.0,
  'Label expansion (new indication)': 4.0,
  'Breakthrough designation':        1.5,
  'Priority review granted':         1.0,
  'Orphan drug designation':         1.5,
  'EU conditional approval':         2.5,
  'China NMPA approval':             2.0,
};

// ---------------------------------------------------------------------------
// Deal-Type Adjustments
// Source: DealForma 2020-2025 deal structure analysis
// ---------------------------------------------------------------------------

/**
 * Deal-type multipliers for milestone value allocations.
 * Acquisitions front-load value (lower milestones); option deals
 * back-load value (higher milestones as % of total).
 */
const DEAL_TYPE_MILESTONE_MULTIPLIER: Record<string, { dev: number; commercial: number; regulatory: number }> = {
  licensing:      { dev: 1.00, commercial: 1.00, regulatory: 1.00 },
  acquisition:    { dev: 0.30, commercial: 0.20, regulatory: 0.15 },
  codevelopment:  { dev: 0.85, commercial: 1.10, regulatory: 0.90 },
  option:         { dev: 1.20, commercial: 1.15, regulatory: 1.10 },
  collaboration:  { dev: 0.90, commercial: 1.05, regulatory: 1.00 },
};

// ---------------------------------------------------------------------------
// Timing Tables
// Source: Median phase durations from PHASE_DURATION in pos-tables.ts
// ---------------------------------------------------------------------------

/**
 * Computes typical timing in years from deal signing to each development
 * milestone, accounting for the asset's current phase and TA-specific
 * phase durations.
 */
function computeDevMilestoneTiming(
  currentPhase: string,
  ta: string,
): Record<string, number> {
  const durations = PHASE_DURATION[ta] ?? PHASE_DURATION.oncology;
  const currentOrder = PHASE_ORDER[currentPhase] ?? 0;

  // Cumulative years from each phase start to each milestone
  const p1Duration = durations.phase1 ?? 1.5;
  const p2Duration = durations.phase2 ?? 2.5;
  const p3Duration = durations.phase3 ?? 3.0;
  const regDuration = durations.regulatory ?? 1.0;
  const preclinDuration = durations.preclinical ?? 2.0;

  // Years from current phase to each milestone
  let yearsFromNow = 0;
  const timings: Record<string, number> = {};

  // Preclinical -> Phase 1 transition
  if (currentOrder <= PHASE_ORDER.preclinical) {
    if (currentOrder <= PHASE_ORDER.discovery) {
      yearsFromNow += (durations.discovery ?? 3.0);
    }
    if (currentOrder <= PHASE_ORDER.preclinical) {
      yearsFromNow += preclinDuration;
    }
  }

  // Phase 1 milestones
  const p1Start = currentOrder < PHASE_ORDER.phase1 ? yearsFromNow : 0;
  timings['IND filing'] = Math.max(p1Start - 0.5, 0); // IND filed ~6mo before Phase 1 starts
  timings['Phase 1 start'] = p1Start;
  timings['Phase 1 completion'] = currentOrder < PHASE_ORDER.phase2
    ? p1Start + p1Duration
    : 0;

  // Phase 2 milestones
  const p2Start = currentOrder < PHASE_ORDER.phase2
    ? p1Start + p1Duration
    : 0;
  timings['Phase 2 start'] = p2Start;
  timings['Phase 2 interim'] = currentOrder < PHASE_ORDER.phase2
    ? p2Start + p2Duration * 0.5
    : 0;
  timings['Phase 2 completion'] = currentOrder < PHASE_ORDER.phase3
    ? p2Start + p2Duration
    : 0;

  // Phase 3 milestones
  const p3Start = currentOrder < PHASE_ORDER.phase3
    ? p2Start + p2Duration
    : 0;
  timings['Phase 3 start'] = p3Start;
  timings['Phase 3 interim'] = currentOrder < PHASE_ORDER.phase3
    ? p3Start + p3Duration * 0.5
    : 0;
  timings['Phase 3 completion'] = currentOrder < PHASE_ORDER.nda_filed
    ? p3Start + p3Duration
    : 0;

  // Regulatory milestones
  const ndaStart = currentOrder < PHASE_ORDER.nda_filed
    ? p3Start + p3Duration
    : 0;
  timings['NDA/BLA filing'] = ndaStart;
  timings['AdComm'] = currentOrder < PHASE_ORDER.approved
    ? ndaStart + regDuration * 0.7
    : 0;
  timings['FDA approval'] = currentOrder < PHASE_ORDER.approved
    ? ndaStart + regDuration
    : 0;

  return timings;
}

// ---------------------------------------------------------------------------
// Commercial Milestone Probabilities
// ---------------------------------------------------------------------------

/**
 * Probability of achieving commercial sales thresholds, conditional on
 * FDA approval. Source: EvaluatePharma launch outcome analysis 2020-2025.
 *
 * These represent the fraction of approved drugs that reach each sales
 * tier within 7 years of launch. Adjusted by TA and competitive position.
 */
const BASE_COMMERCIAL_PROBABILITIES: Record<string, number> = {
  'First commercial sale (US)': 0.95, // Almost all approved drugs launch
  'EU approval':                0.85, // ~85% of US-approved drugs get EU approval
  'Japan approval':             0.70, // ~70% pursue Japan
  '$100M sales':                0.55, // ~55% of launched drugs reach $100M
  '$250M sales':                0.38, // ~38% reach $250M
  '$500M sales':                0.25, // ~25% reach $500M (blockbuster lite)
  '$1B sales':                  0.15, // ~15% become blockbusters
  '$2B+ sales':                 0.06, // ~6% become mega-blockbusters
};

/**
 * TA-specific commercial probability multipliers.
 * Oncology and metabolic drugs have higher blockbuster potential;
 * rare disease has lower peak but near-guaranteed commercial success.
 */
const TA_COMMERCIAL_MULTIPLIER: Record<string, Record<string, number>> = {
  oncology: {
    '$100M sales': 1.15, '$250M sales': 1.20, '$500M sales': 1.25,
    '$1B sales': 1.30, '$2B+ sales': 1.40,
  },
  metabolic: {
    '$100M sales': 1.20, '$250M sales': 1.25, '$500M sales': 1.35,
    '$1B sales': 1.50, '$2B+ sales': 1.80, // GLP-1 era blockbuster frequency
  },
  rareDisease: {
    'First commercial sale (US)': 1.0, 'EU approval': 0.90,
    '$100M sales': 0.80, '$250M sales': 0.65, '$500M sales': 0.50,
    '$1B sales': 0.35, '$2B+ sales': 0.20,
  },
  neurology: {
    '$100M sales': 0.90, '$250M sales': 0.85, '$500M sales': 0.80,
    '$1B sales': 0.75, '$2B+ sales': 0.60,
  },
  immunology: {
    '$100M sales': 1.10, '$250M sales': 1.15, '$500M sales': 1.20,
    '$1B sales': 1.25, '$2B+ sales': 1.30,
  },
  cardiovascular: {
    '$100M sales': 0.95, '$250M sales': 0.90, '$500M sales': 0.85,
    '$1B sales': 0.80, '$2B+ sales': 0.70,
  },
  hematology: {
    '$100M sales': 1.05, '$250M sales': 1.10, '$500M sales': 1.10,
    '$1B sales': 1.05, '$2B+ sales': 0.90,
  },
  dermatology: {
    '$100M sales': 1.05, '$250M sales': 1.00, '$500M sales': 0.90,
    '$1B sales': 0.80, '$2B+ sales': 0.60,
  },
  infectiousDisease: {
    '$100M sales': 0.85, '$250M sales': 0.75, '$500M sales': 0.60,
    '$1B sales': 0.50, '$2B+ sales': 0.35,
  },
  ophthalmology: {
    '$100M sales': 0.95, '$250M sales': 0.90, '$500M sales': 0.80,
    '$1B sales': 0.70, '$2B+ sales': 0.50,
  },
  womensHealth: {
    '$100M sales': 0.80, '$250M sales': 0.70, '$500M sales': 0.55,
    '$1B sales': 0.40, '$2B+ sales': 0.25,
  },
  gastroenterology: {
    '$100M sales': 1.00, '$250M sales': 0.95, '$500M sales': 0.85,
    '$1B sales': 0.75, '$2B+ sales': 0.55,
  },
};

/**
 * Commercial milestone timing: years after FDA approval.
 * Source: EvaluatePharma launch trajectory analysis.
 */
const COMMERCIAL_TIMING_AFTER_APPROVAL: Record<string, number> = {
  'First commercial sale (US)': 0.5,
  'EU approval':                1.5,
  'Japan approval':             2.5,
  '$100M sales':                2.0,
  '$250M sales':                3.0,
  '$500M sales':                4.0,
  '$1B sales':                  5.0,
  '$2B+ sales':                 7.0,
};

// ---------------------------------------------------------------------------
// Regulatory Milestone Probabilities
// ---------------------------------------------------------------------------

/**
 * Probability of achieving regulatory milestones, conditional on
 * the appropriate prior event (FDA approval for most).
 */
const BASE_REGULATORY_PROBABILITIES: Record<string, number> = {
  'Pediatric indication approval':    0.30,
  'Label expansion (new indication)': 0.40,
  'Breakthrough designation':         0.25,
  'Priority review granted':          0.35,
  'Orphan drug designation':          0.20,
  'EU conditional approval':          0.80,
  'China NMPA approval':              0.45,
};

/**
 * Regulatory milestone timing: years from deal signing.
 * Breakthrough/priority review milestones occur during development;
 * label expansion and pediatric occur post-approval.
 */
const REGULATORY_TIMING_OFFSETS: Record<string, { basis: 'signing' | 'approval'; offset: number }> = {
  'Breakthrough designation':         { basis: 'signing',  offset: 1.0 },
  'Priority review granted':          { basis: 'signing',  offset: 1.5 },
  'Orphan drug designation':          { basis: 'signing',  offset: 0.5 },
  'EU conditional approval':          { basis: 'approval', offset: 1.0 },
  'China NMPA approval':              { basis: 'approval', offset: 2.5 },
  'Pediatric indication approval':    { basis: 'approval', offset: 3.0 },
  'Label expansion (new indication)': { basis: 'approval', offset: 4.0 },
};

// ---------------------------------------------------------------------------
// Indication-Specific Adjustments
// ---------------------------------------------------------------------------

/**
 * Certain indications have distinctive milestone probability profiles.
 * These multipliers are applied on top of the TA-level adjustments.
 */
const INDICATION_MILESTONE_MODIFIERS: Record<string, { devMultiplier: number; commercialMultiplier: number }> = {
  // High-value oncology indications with large patient populations
  lung_nsclc:     { devMultiplier: 1.05, commercialMultiplier: 1.20 },
  breast_her2:    { devMultiplier: 1.10, commercialMultiplier: 1.15 },
  // Notoriously difficult indications
  alzheimers:     { devMultiplier: 0.75, commercialMultiplier: 0.70 },
  parkinsons:     { devMultiplier: 0.85, commercialMultiplier: 0.80 },
  pancreatic:     { devMultiplier: 0.80, commercialMultiplier: 0.65 },
  // High-velocity metabolic
  obesity:        { devMultiplier: 1.15, commercialMultiplier: 1.50 },
  type2_diabetes: { devMultiplier: 1.10, commercialMultiplier: 1.30 },
  // Rare disease -- high dev probability, constrained commercial
  cystic_fibrosis: { devMultiplier: 1.20, commercialMultiplier: 0.85 },
  dmd:             { devMultiplier: 1.10, commercialMultiplier: 0.75 },
  sma:             { devMultiplier: 1.15, commercialMultiplier: 0.80 },
};

// ---------------------------------------------------------------------------
// Core Computation
// ---------------------------------------------------------------------------

/**
 * Computes milestone probabilities for a pharma deal, returning cascading
 * conditional probabilities for development, commercial, and regulatory
 * milestones along with a probability-weighted total value and expected
 * payout schedule.
 *
 * @param phase - Current development phase of the asset
 * @param therapeuticArea - Therapeutic area (maps to PoS tables)
 * @param modality - Drug modality (drives PoS adjustment)
 * @param indication - Clinical indication (e.g., 'lung_nsclc')
 * @param dealType - Deal structure type (licensing, acquisition, etc.)
 * @returns Complete milestone probability analysis
 */
export function computeMilestoneProbabilities(
  phase: Phase,
  therapeuticArea: TherapeuticArea,
  modality: Modality,
  indication: string,
  dealType: string = 'licensing',
): MilestoneProbabilityResult {
  const ta = therapeuticArea as string;
  const mod = modality as string;
  const dt = dealType as string;

  // Resolve deal-type multipliers
  const dtMultiplier = DEAL_TYPE_MILESTONE_MULTIPLIER[dt] ?? DEAL_TYPE_MILESTONE_MULTIPLIER.licensing;

  // Resolve indication-specific modifiers
  const indicationMod = INDICATION_MILESTONE_MODIFIERS[indication] ?? { devMultiplier: 1.0, commercialMultiplier: 1.0 };

  // Compute time from current phase to FDA approval (for commercial timing)
  const devTimings = computeDevMilestoneTiming(phase, ta);
  const yearsToApproval = devTimings['FDA approval'] ?? 5.0;

  // -----------------------------------------------------------------------
  // Development Milestones
  // -----------------------------------------------------------------------
  const devMilestoneEvents = [
    'IND filing', 'Phase 1 start', 'Phase 1 completion',
    'Phase 2 start', 'Phase 2 interim', 'Phase 2 completion',
    'Phase 3 start', 'Phase 3 interim', 'Phase 3 completion',
    'NDA/BLA filing', 'AdComm', 'FDA approval',
  ];

  const developmentMilestones: MilestoneEntry[] = devMilestoneEvents.map((event) => {
    const mapping = DEV_MILESTONE_PHASE_MAP[event];
    if (!mapping) {
      return { event, probability: 0.5, typicalTiming_years: 0, typicalValue_pct: 0 };
    }

    let probability: number;
    if (mapping.trigger === 'start') {
      probability = cumulativeProbToPhase(phase, mapping.requiredPhase, ta, mod);
    } else {
      probability = probOfCompletingPhase(phase, mapping.requiredPhase, ta, mod);
    }

    // Interim milestones have slightly higher probability than completion
    // (you can reach interim without completing the phase)
    if (event.includes('interim')) {
      const completionProb = probOfCompletingPhase(phase, mapping.requiredPhase, ta, mod);
      const startProb = cumulativeProbToPhase(phase, mapping.requiredPhase, ta, mod);
      // Interim probability: geometric mean between start and completion
      probability = Math.sqrt(startProb * completionProb);
    }

    // Apply indication modifier to development probabilities
    probability = Math.min(probability * indicationMod.devMultiplier, 1.0);

    // Timing
    const timing = devTimings[event] ?? 0;

    // Value allocation with deal-type adjustment
    const baseValue = (BASE_DEV_MILESTONE_VALUES[event] ?? 0) * dtMultiplier.dev;

    return {
      event,
      probability: roundTo4(probability),
      typicalTiming_years: roundTo1(timing),
      typicalValue_pct: roundTo2(baseValue),
    };
  });

  // -----------------------------------------------------------------------
  // Commercial Milestones
  // -----------------------------------------------------------------------
  const commercialMilestoneEvents = [
    'First commercial sale (US)', 'EU approval', 'Japan approval',
    '$100M sales', '$250M sales', '$500M sales', '$1B sales', '$2B+ sales',
  ];

  // Probability of reaching approval from current phase (gate for all commercial milestones)
  const approvalProb = cumulativeProbToPhase(phase, 'approved', ta, mod);

  const commercialMilestones: MilestoneEntry[] = commercialMilestoneEvents.map((event) => {
    const baseProb = BASE_COMMERCIAL_PROBABILITIES[event] ?? 0.5;

    // Apply TA-specific multiplier
    const taMultiplier = TA_COMMERCIAL_MULTIPLIER[ta]?.[event] ?? 1.0;

    // Apply indication-specific multiplier
    const indMult = indicationMod.commercialMultiplier;

    // Cascade: commercial probability = P(approval) x P(commercial milestone | approved)
    const conditionalProb = Math.min(baseProb * taMultiplier * indMult, 1.0);
    const cascadedProb = approvalProb * conditionalProb;

    // Timing: years to approval + years after approval
    const timingAfterApproval = COMMERCIAL_TIMING_AFTER_APPROVAL[event] ?? 3.0;
    const totalTiming = yearsToApproval + timingAfterApproval;

    // Value allocation with deal-type adjustment
    const baseValue = (BASE_COMMERCIAL_MILESTONE_VALUES[event] ?? 0) * dtMultiplier.commercial;

    return {
      event,
      probability: roundTo4(cascadedProb),
      typicalTiming_years: roundTo1(totalTiming),
      typicalValue_pct: roundTo2(baseValue),
    };
  });

  // -----------------------------------------------------------------------
  // Regulatory Milestones
  // -----------------------------------------------------------------------
  const regulatoryMilestoneEvents = [
    'Pediatric indication approval', 'Label expansion (new indication)',
    'Breakthrough designation', 'Priority review granted',
    'Orphan drug designation', 'EU conditional approval', 'China NMPA approval',
  ];

  const regulatoryMilestones: MilestoneEntry[] = regulatoryMilestoneEvents.map((event) => {
    const baseProb = BASE_REGULATORY_PROBABILITIES[event] ?? 0.2;
    const timingInfo = REGULATORY_TIMING_OFFSETS[event] ?? { basis: 'approval' as const, offset: 2.0 };

    let probability: number;
    let timing: number;

    if (timingInfo.basis === 'approval') {
      // Conditional on approval
      probability = approvalProb * baseProb;
      timing = yearsToApproval + timingInfo.offset;
    } else {
      // Can occur during development (designations)
      // Probability scales with how early the asset is (earlier = more likely to seek designation)
      const phaseMultiplier = PHASE_ORDER[phase] <= PHASE_ORDER.phase2 ? 1.2 : 0.8;
      probability = Math.min(baseProb * phaseMultiplier, 1.0);
      timing = timingInfo.offset;
    }

    // Rare disease assets more likely to get orphan designation
    if (event === 'Orphan drug designation' && ta === 'rareDisease') {
      probability = Math.min(probability * 2.5, 0.95);
    }

    // Value allocation with deal-type adjustment
    const baseValue = (BASE_REGULATORY_MILESTONE_VALUES[event] ?? 0) * dtMultiplier.regulatory;

    return {
      event,
      probability: roundTo4(probability),
      typicalTiming_years: roundTo1(timing),
      typicalValue_pct: roundTo2(baseValue),
    };
  });

  // -----------------------------------------------------------------------
  // Probability-Weighted Total Value
  // -----------------------------------------------------------------------
  const allMilestones = [...developmentMilestones, ...commercialMilestones, ...regulatoryMilestones];
  const probabilityWeightedTotalValue = roundTo2(
    allMilestones.reduce((sum, m) => sum + m.probability * m.typicalValue_pct, 0)
  );

  // -----------------------------------------------------------------------
  // Expected Payout Schedule (year-by-year)
  // -----------------------------------------------------------------------
  const maxYear = Math.ceil(
    Math.max(...allMilestones.map((m) => m.typicalTiming_years), 1)
  );

  const expectedPayoutSchedule: AnnualPayout[] = [];

  for (let y = 0; y <= maxYear; y++) {
    const milestonesInYear = allMilestones.filter((m) => {
      const mYear = Math.floor(m.typicalTiming_years);
      return mYear === y && m.typicalValue_pct > 0;
    });

    if (milestonesInYear.length === 0) continue;

    const expectedPayout = roundTo2(
      milestonesInYear.reduce((sum, m) => sum + m.probability * m.typicalValue_pct, 0)
    );

    expectedPayoutSchedule.push({
      year: y,
      expectedPayout_pct: expectedPayout,
      milestones: milestonesInYear.map((m) => m.event),
    });
  }

  // -----------------------------------------------------------------------
  // Narrative Generation
  // -----------------------------------------------------------------------
  const narrative = generateNarrative(
    phase, ta, mod, indication, dt,
    developmentMilestones, commercialMilestones, regulatoryMilestones,
    probabilityWeightedTotalValue, approvalProb, yearsToApproval,
  );

  return {
    developmentMilestones,
    commercialMilestones,
    regulatoryMilestones,
    probabilityWeightedTotalValue,
    expectedPayoutSchedule,
    narrative,
  };
}

// ---------------------------------------------------------------------------
// Narrative Generation
// ---------------------------------------------------------------------------

function generateNarrative(
  phase: string,
  ta: string,
  modality: string,
  indication: string,
  dealType: string,
  devMilestones: MilestoneEntry[],
  commercialMilestones: MilestoneEntry[],
  regulatoryMilestones: MilestoneEntry[],
  weightedTotal: number,
  approvalProb: number,
  yearsToApproval: number,
): string {
  const phaseLabel = phase.replace('_', '/').replace('phase', 'Phase ').replace('nda filed', 'NDA Filed');
  const taLabel = ta.replace(/([A-Z])/g, ' $1').trim();

  // Find highest-probability development milestone not yet achieved
  const nextDevMilestone = devMilestones.find((m) => m.probability > 0 && m.probability < 1.0);
  // Find the biggest commercial milestone with >10% probability
  const topCommercial = [...commercialMilestones]
    .filter((m) => m.probability >= 0.10)
    .sort((a, b) => b.typicalValue_pct - a.typicalValue_pct)[0];

  // Count milestones with >50% probability
  const highProbCount = devMilestones.filter((m) => m.probability >= 0.50).length;
  const totalDevValue = devMilestones.reduce((s, m) => s + m.typicalValue_pct, 0);
  const totalCommValue = commercialMilestones.reduce((s, m) => s + m.typicalValue_pct, 0);

  let narrative = `This ${taLabel} ${indication.replace(/_/g, ' ')} asset is currently in ${phaseLabel} `;
  narrative += `with a ${formatPct(approvalProb)} cumulative probability of reaching FDA approval `;
  narrative += `(estimated ${roundTo1(yearsToApproval)} years from signing). `;

  narrative += `Under a ${dealType} structure, development milestones represent ${roundTo1(totalDevValue)}% `;
  narrative += `of total deal value and commercial milestones represent ${roundTo1(totalCommValue)}%. `;

  if (nextDevMilestone) {
    narrative += `The next key development milestone is "${nextDevMilestone.event}" `;
    narrative += `with ${formatPct(nextDevMilestone.probability)} probability, `;
    narrative += `expected in ~${roundTo1(nextDevMilestone.typicalTiming_years)} years. `;
  }

  if (topCommercial) {
    narrative += `The highest-value commercial milestone with meaningful probability is `;
    narrative += `"${topCommercial.event}" (${formatPct(topCommercial.probability)} probability, `;
    narrative += `${roundTo1(topCommercial.typicalValue_pct)}% of deal value). `;
  }

  narrative += `${highProbCount} of 12 development milestones have >50% probability. `;
  narrative += `The probability-weighted expected milestone payout is ${roundTo1(weightedTotal)}% `;
  narrative += `of headline deal value, reflecting the cascading attrition from `;
  narrative += `${phaseLabel} through commercialization.`;

  return narrative;
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

function roundTo4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundTo1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
