/**
 * Path to next inflection — partner now, or fund to the next data point?
 *
 * Three options: deal now, partner after the next phase completes, partner
 * after the phase after that. Each carries development cost, months,
 * probability of reaching that point, the terms if reached, the probability-
 * weighted cost-adjusted expected upfront today, and the equity dilution
 * implied by financing the spend.
 *
 * Constants (list on the methodology page):
 *  - PHASE_STEP_UP — typical multiple applied to upfront/total when an asset
 *    completes a phase. Engine calibration from the Solidus deal database
 *    (phase-bucket median upfronts): preclinical→P1 ×2.0, P1→P2 ×2.2,
 *    P2→P3 ×1.8, P3→approved ×1.5. Overridable via `assumptions.stepUp`.
 *  - RAISE_BUFFER_PCT = 0.30 — equity raise sized at cost × 1.3 to cover
 *    overheads and a runway cushion.
 *  - PRE_MONEY_MULTIPLE_OF_RNPV = 1.0 — assumed pre-money equals the
 *    risk-adjusted NPV; fallback when no rNPV is 0.5 × headline total.
 *  - MILESTONE_PV_FACTOR = 0.45 — present value of contingent milestones as a
 *    share of face value when computing value retained under a licence.
 *  - OPTION_VALUE_HURDLE = 0.15 — a deferred option must beat "deal now" by
 *    at least 15% on expected upfront before it is recommended.
 *
 * Expected upfront is undiscounted; the dilution term carries the financing
 * cost, and the probability term carries the development risk.
 */

import type { CalculationInput, CalculationResult } from '@/lib/calculations';
import type { RNPVResult } from '@/lib/financial/types';
import { PHASE_COSTS, PHASE_DURATION, POS_BY_THERAPEUTIC_AREA } from '@/lib/financial/pos-tables';
import type { InflectionPath, InflectionOption, Range3 } from './types';

export const PHASE_STEP_UP: Record<string, number> = {
  discovery: 1.8,     // discovery → preclinical candidate
  preclinical: 2.0,   // preclinical → Phase 1 (IND)
  phase1: 2.2,        // Phase 1 → Phase 2
  phase1_2: 2.2,
  phase2: 1.8,        // Phase 2 → Phase 3
  phase2_3: 1.8,
  phase3: 1.5,        // Phase 3 → approval
  nda_filed: 1.2,
};
export const RAISE_BUFFER_PCT = 0.3;
export const PRE_MONEY_MULTIPLE_OF_RNPV = 1.0;
export const PRE_MONEY_FALLBACK_SHARE_OF_HEADLINE = 0.5;
export const MILESTONE_PV_FACTOR = 0.45;
export const OPTION_VALUE_HURDLE = 0.15;

/** Ordered development pathway used to name the next two milestones. */
const PATHWAY = ['discovery', 'preclinical', 'phase1', 'phase2', 'phase3', 'nda_filed', 'approved'] as const;
type PathPhase = typeof PATHWAY[number];

/** "Partner after X" — what has just been completed when the option is exercised. */
const COMPLETION_LABEL: Record<string, string> = {
  discovery: 'candidate selection',
  preclinical: 'IND',
  phase1: 'Phase 1',
  phase2: 'Phase 2',
  phase3: 'Phase 3',
  nda_filed: 'approval',
};

const POS_KEY: Record<string, keyof typeof POS_BY_THERAPEUTIC_AREA[string]> = {
  discovery: 'discoveryToPreclinical',
  preclinical: 'preclinicalToPhase1',
  phase1: 'phase1ToPhase2',
  phase2: 'phase2ToPhase3',
  phase3: 'phase3ToApproval',
  nda_filed: 'ndaFiledToApproval',
};

function normalizePhase(phase: string): PathPhase | null {
  const k = phase.replace(/_/g, '').toLowerCase();
  if (k === 'discovery') return 'discovery';
  if (k === 'preclinical') return 'preclinical';
  if (k === 'phase1' || k === 'phase12') return 'phase1';
  if (k === 'phase2' || k === 'phase23') return 'phase2';
  if (k === 'phase3') return 'phase3';
  if (k === 'ndafiled' || k === 'nda') return 'nda_filed';
  if (k === 'approved') return 'approved';
  return null;
}

interface Transition { costM: number; years: number; probability: number }

function transitionsFromTables(ta: string, phases: PathPhase[]): Transition[] {
  const costs = PHASE_COSTS[ta] ?? PHASE_COSTS.oncology;
  const durations = PHASE_DURATION[ta] ?? PHASE_DURATION.oncology;
  const pos = POS_BY_THERAPEUTIC_AREA[ta] ?? POS_BY_THERAPEUTIC_AREA.oncology;
  return phases.map(p => ({
    costM: costs[p] ?? 0,
    years: durations[p] ?? 0,
    probability: (pos[POS_KEY[p]] as number | undefined) ?? 0.5,
  }));
}

function scale(r: Range3, f: number): Range3 {
  return { low: r.low * f, median: r.median * f, high: r.high * f };
}

function round1(v: number): number { return Math.round(v * 10) / 10; }

export interface InflectionInput {
  inputs: CalculationInput;
  result: CalculationResult;
  rnpv?: RNPVResult;
  asOf: string;
  assumptions?: {
    preMoneyMultipleOfRnpv?: number;
    raiseBufferPct?: number;
    /** Override the phase step-up table. */
    stepUp?: Partial<Record<string, number>>;
  };
}

/**
 * Which option the rule recommends. Pure function of the options so pages and
 * the decision builder agree without parsing text.
 */
export function recommendedOptionKey(options: InflectionOption[]): InflectionOption['key'] {
  const now = options.find(o => o.key === 'deal_now');
  if (!now) return options[0]?.key ?? 'deal_now';
  let best = now;
  for (const o of options) if (o.expectedUpfrontM > best.expectedUpfrontM) best = o;
  if (best.key === 'deal_now') return 'deal_now';
  const hurdle = now.expectedUpfrontM > 0 ? now.expectedUpfrontM * (1 + OPTION_VALUE_HURDLE) : now.expectedUpfrontM + 1e-9;
  return best.expectedUpfrontM >= hurdle ? best.key : 'deal_now';
}

export function buildInflectionPath(input: InflectionInput): InflectionPath | null {
  const { inputs, result, rnpv, asOf, assumptions } = input;
  const current = normalizePhase(inputs.phase);
  if (!current || current === 'approved') return null;
  const idx = PATHWAY.indexOf(current);
  const nextPhases = PATHWAY.slice(idx, idx + 2).filter(p => p !== 'approved') as PathPhase[];
  if (nextPhases.length === 0) return null;

  // Transitions: engine first, calibration tables as fallback.
  const engineT = (rnpv?.phaseTransitions ?? []).slice(0, nextPhases.length).map(t => ({
    costM: t.costEstimate, years: t.yearsToComplete, probability: t.probability,
  }));
  const transitions = engineT.length === nextPhases.length && engineT.every(t => Number.isFinite(t.probability))
    ? engineT
    : transitionsFromTables(inputs.therapeuticArea, nextPhases);

  const stepUp = { ...PHASE_STEP_UP, ...(assumptions?.stepUp ?? {}) };
  const buffer = assumptions?.raiseBufferPct ?? RAISE_BUFFER_PCT;
  const preMult = assumptions?.preMoneyMultipleOfRnpv ?? PRE_MONEY_MULTIPLE_OF_RNPV;

  const terms = result.terms;
  const headlineTotal = terms.totalDealValue.median;
  const hasRnpv = !!rnpv && Number.isFinite(rnpv.riskAdjustedNPV) && rnpv.riskAdjustedNPV > 0;
  const preMoneyM = hasRnpv
    ? preMult * rnpv!.riskAdjustedNPV
    : headlineTotal * PRE_MONEY_FALLBACK_SHARE_OF_HEADLINE;
  const preMoneyBasis = hasRnpv
    ? `${preMult.toFixed(1)}× risk-adjusted NPV of $${Math.round(rnpv!.riskAdjustedNPV)}M`
    : `${PRE_MONEY_FALLBACK_SHARE_OF_HEADLINE}× headline total of $${Math.round(headlineTotal)}M (no rNPV available)`;

  const dilutionFor = (costM: number): number | null => {
    if (!(preMoneyM > 0)) return null;
    const raise = costM * (1 + buffer);
    return raise / (preMoneyM + raise);
  };

  const options: InflectionOption[] = [];

  const dealNow: InflectionOption = {
    key: 'deal_now',
    label: 'Partner now',
    costM: 0,
    months: 0,
    pReach: 1,
    upfrontIfReached: { ...terms.upfront },
    totalIfReached: { ...terms.totalDealValue },
    expectedUpfrontM: terms.upfront.median,
    dilution: 0,
    verdict: '',
  };
  options.push(dealNow);

  // next_phase
  const t1 = transitions[0];
  const f1 = stepUp[nextPhases[0]] ?? 1.5;
  const next: InflectionOption = {
    key: 'next_phase',
    label: `Partner after ${COMPLETION_LABEL[nextPhases[0]]}`,
    costM: round1(t1.costM),
    months: Math.round(t1.years * 12),
    pReach: t1.probability,
    upfrontIfReached: scale(terms.upfront, f1),
    totalIfReached: scale(terms.totalDealValue, f1),
    expectedUpfrontM: 0,
    dilution: null,
    verdict: '',
  };
  next.expectedUpfrontM = round1(next.pReach * next.upfrontIfReached.median - next.costM);
  next.dilution = dilutionFor(next.costM);
  options.push(next);

  // phase_after (chain of two)
  if (nextPhases.length === 2 && transitions[1]) {
    const t2 = transitions[1];
    const f2 = f1 * (stepUp[nextPhases[1]] ?? 1.5);
    const after: InflectionOption = {
      key: 'phase_after',
      label: `Partner after ${COMPLETION_LABEL[nextPhases[1]]}`,
      costM: round1(t1.costM + t2.costM),
      months: Math.round((t1.years + t2.years) * 12),
      pReach: t1.probability * t2.probability,
      upfrontIfReached: scale(terms.upfront, f2),
      totalIfReached: scale(terms.totalDealValue, f2),
      expectedUpfrontM: 0,
      dilution: null,
      verdict: '',
    };
    after.expectedUpfrontM = round1(after.pReach * after.upfrontIfReached.median - after.costM);
    after.dilution = dilutionFor(after.costM);
    options.push(after);
  }

  const recKey = recommendedOptionKey(options);
  const rec = options.find(o => o.key === recKey)!;

  // Verdicts
  for (const o of options) {
    const exp = `$${Math.round(o.expectedUpfrontM)}M`;
    if (o.key === 'deal_now') {
      o.verdict = recKey === 'deal_now'
        ? `Recommended: ${exp} upfront with certainty and no dilution.`
        : `${exp} upfront with certainty; deferring is worth the financing risk here.`;
    } else {
      const dil = o.dilution != null ? `${(o.dilution * 100).toFixed(0)}% dilution` : 'dilution not computable';
      const uplift = dealNow.expectedUpfrontM > 0 ? ((o.expectedUpfrontM / dealNow.expectedUpfrontM - 1) * 100) : 0;
      o.verdict = o.key === recKey
        ? `Recommended: expected ${exp} today, ${uplift.toFixed(0)}% above partnering now after $${Math.round(o.costM)}M spend and ${dil}.`
        : o.expectedUpfrontM > dealNow.expectedUpfrontM
          ? `Expected ${exp} today is only ${uplift.toFixed(0)}% above partnering now; does not clear the ${OPTION_VALUE_HURDLE * 100}% hurdle after ${dil}.`
          : `Expected ${exp} today after $${Math.round(o.costM)}M spend and ${(o.pReach * 100).toFixed(0)}% chance of reaching it; below partnering now.`;
    }
  }

  // Financing alternative (next phase)
  const nextDil = next.dilution;
  const retainedIfLicense = round1(terms.upfront.median + MILESTONE_PV_FACTOR * Math.max(0, terms.totalDealValue.median - terms.upfront.median));
  const financing = nextDil != null ? {
    preMoneyM: round1(preMoneyM),
    basis: preMoneyBasis,
    raiseM: round1(next.costM * (1 + buffer)),
    dilution: nextDil,
    retainedValueIfFinanceM: round1((1 - nextDil) * next.totalIfReached.median * next.pReach),
    retainedValueIfLicenseM: retainedIfLicense,
  } : null;

  // Recommendation text
  let recommendation: string;
  if (recKey === 'deal_now') {
    const bestAlt = options.filter(o => o.key !== 'deal_now').sort((a, b) => b.expectedUpfrontM - a.expectedUpfrontM)[0];
    if (bestAlt && bestAlt.expectedUpfrontM > dealNow.expectedUpfrontM) {
      const uplift = ((bestAlt.expectedUpfrontM / Math.max(dealNow.expectedUpfrontM, 1e-9) - 1) * 100).toFixed(0);
      recommendation = `Partner now. Funding to ${bestAlt.label.replace('Partner after ', '')} raises the expected upfront from $${Math.round(dealNow.expectedUpfrontM)}M to $${Math.round(bestAlt.expectedUpfrontM)}M (${uplift}%), below the ${OPTION_VALUE_HURDLE * 100}% hurdle; the option value does not pay for the financing risk of $${Math.round(bestAlt.costM)}M and ${bestAlt.dilution != null ? (bestAlt.dilution * 100).toFixed(0) + '% dilution' : 'the dilution it implies'}.`;
    } else {
      recommendation = `Partner now. Every deferred option has a lower expected upfront than the $${Math.round(dealNow.expectedUpfrontM)}M available today once the spend and the probability of reaching the next data point are counted.`;
    }
  } else {
    const uplift = ((rec.expectedUpfrontM / Math.max(dealNow.expectedUpfrontM, 1e-9) - 1) * 100).toFixed(0);
    recommendation = `${rec.label}. Spending $${Math.round(rec.costM)}M over ${rec.months} months with a ${(rec.pReach * 100).toFixed(0)}% chance of reaching it lifts the expected upfront to $${Math.round(rec.expectedUpfrontM)}M today, ${uplift}% above the $${Math.round(dealNow.expectedUpfrontM)}M on offer now${rec.dilution != null ? `, at ${(rec.dilution * 100).toFixed(0)}% dilution` : ''}. That clears the ${OPTION_VALUE_HURDLE * 100}% hurdle, provided the financing is available on those terms.`;
  }

  return { asOf, options, financing, recommendation };
}
