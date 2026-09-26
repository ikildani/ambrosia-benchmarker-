/**
 * Path to next inflection — partner now, or fund to the next data point?
 *
 * Three options: deal now, partner after the next phase completes, partner
 * after the phase after that. Each carries development cost, months,
 * probability of reaching that point, the terms if reached, the equity
 * dilution implied by financing the spend, and two expected values today:
 *
 *  - expectedUpfrontM  = P(reach) × upfront if reached − cost. Upfront only,
 *                        undiscounted; shown for reference because it is the
 *                        number people quote in the room.
 *  - expectedValueM    = P(reach) × (1 − dilution) × PV(upfront + milestone
 *                        value if reached) × discount factor − cost. This is
 *                        what the options are compared on. Comparing upfront
 *                        alone always favours dealing now, because the step-up
 *                        in total value and the milestones never enter.
 *
 * Constants (list on the methodology page):
 *  - PHASE_STEP_UP — typical multiple applied to upfront/total when an asset
 *    completes a phase. Engine calibration from the Solidus deal database
 *    (phase-bucket median upfronts): preclinical→P1 ×2.0, P1→P2 ×2.2,
 *    P2→P3 ×1.8, P3→approved ×1.5. Overridable via `assumptions.stepUp`.
 *  - RAISE_BUFFER_PCT = 0.30 — equity raise sized at cost × 1.3 to cover
 *    overheads and a runway cushion.
 *  - PRE_MONEY_MULTIPLE_OF_RNPV = 1.0 — assumed pre-money equals the
 *    risk-adjusted NPV when it is positive; otherwise 0.5 × headline total.
 *  - MILESTONE_PV_FACTOR = 0.45 — fallback share of milestone face value when
 *    no probability chain is available. When one is, the share is computed:
 *    each development milestone is weighted by the cumulative probability of
 *    reaching it from the current phase (IND, first patient, Phase 2 start,
 *    pivotal, filing, approval, second approval, with the stage schedule the
 *    term sheet uses), so a preclinical asset at 1–2% cumulative PoS carries
 *    milestones at roughly a quarter of face, not nearly half.
 *  - OPTION_VALUE_HURDLE = 0.15 — a deferred option must beat "deal now" by
 *    at least 15% on expected value before it is recommended.
 *  - DEFAULT_DISCOUNT_RATE = 0.12 — used when the financial model did not
 *    supply a rate.
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
export const DEFAULT_DISCOUNT_RATE = 0.12;

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

/** Upfront plus contingent milestones at `factor` of face value (probability-weighted when known). */
export function dealValueTodayM(upfrontM: number, totalM: number, factor: number = MILESTONE_PV_FACTOR): number {
  return upfrontM + factor * Math.max(0, totalM - upfrontM);
}

/** Milestone events as shares of the development pool, by the phase the deal signs at. */
const MILESTONE_SCHEDULE: Record<string, Array<[PathPhase | 'approved' | 'second_approval', number]>> = {
  discovery: [['preclinical', 0.15], ['phase1', 0.15], ['phase2', 0.15], ['phase3', 0.15], ['nda_filed', 0.15], ['approved', 0.15], ['second_approval', 0.10]],
  preclinical: [['phase1', 0.15], ['phase1', 0.15], ['phase2', 0.15], ['phase3', 0.15], ['nda_filed', 0.15], ['approved', 0.15], ['second_approval', 0.10]],
  phase1: [['phase2', 0.20], ['phase2', 0.15], ['phase3', 0.20], ['nda_filed', 0.15], ['approved', 0.20], ['second_approval', 0.10]],
  phase2: [['phase3', 0.25], ['nda_filed', 0.25], ['approved', 0.30], ['second_approval', 0.20]],
  phase3: [['nda_filed', 0.20], ['approved', 0.45], ['second_approval', 0.20], ['approved', 0.15]],
  nda_filed: [['approved', 0.80], ['second_approval', 0.20]],
};

/**
 * Share of milestone face value expected to be paid, given the chain of phase
 * transition probabilities from the current phase. Pure; exported for tests.
 */
export function milestoneFactorFromChain(current: PathPhase, ta: string): number {
  const schedule = MILESTONE_SCHEDULE[current];
  if (!schedule) return MILESTONE_PV_FACTOR;
  const idx = PATHWAY.indexOf(current);
  const chain = PATHWAY.slice(idx).filter(p => p !== 'approved') as PathPhase[];
  const trans = transitionsFromTables(ta, chain);
  // cumulative probability of having reached each later phase
  const reach = new Map<string, number>();
  let cum = 1;
  chain.forEach((p, i) => { cum *= trans[i]?.probability ?? 0.5; const next = PATHWAY[PATHWAY.indexOf(p) + 1]; if (next) reach.set(next, cum); });
  const approved = reach.get('approved') ?? cum;
  let factor = 0;
  for (const [event, share] of schedule) {
    const p = event === 'second_approval' ? approved * 0.7 : event === 'approved' ? approved : (reach.get(event) ?? approved);
    factor += share * p;
  }
  return Math.max(0.05, Math.min(0.9, Math.round(factor * 1000) / 1000));
}

export interface InflectionInput {
  inputs: CalculationInput;
  result: CalculationResult;
  rnpv?: RNPVResult;
  asOf: string;
  assumptions?: {
    preMoneyMultipleOfRnpv?: number;
    raiseBufferPct?: number;
    discountRate?: number;
    /** Override the phase step-up table. */
    stepUp?: Partial<Record<string, number>>;
    /** From intake: the raise the client actually plans replaces the cost-plus-buffer estimate. */
    financing?: { nextRaiseM?: number | null; cashOnHandM?: number | null; runwayMonths?: number | null } | null;
  };
}

/**
 * Which option the rule recommends. Pure function of the options so pages and
 * the decision builder agree without parsing text. Compares expected value
 * today (upfront + milestone PV, dilution and time value counted).
 */
export function recommendedOptionKey(options: InflectionOption[]): InflectionOption['key'] {
  const now = options.find(o => o.key === 'deal_now');
  if (!now) return options[0]?.key ?? 'deal_now';
  let best = now;
  for (const o of options) if (o.expectedValueM > best.expectedValueM) best = o;
  if (best.key === 'deal_now') return 'deal_now';
  const hurdle = now.expectedValueM > 0 ? now.expectedValueM * (1 + OPTION_VALUE_HURDLE) : now.expectedValueM + 1e-9;
  return best.expectedValueM >= hurdle ? best.key : 'deal_now';
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
  const discountRate = assumptions?.discountRate
    ?? (rnpv && Number.isFinite(rnpv.discountRate) && rnpv.discountRate > 0 ? rnpv.discountRate : DEFAULT_DISCOUNT_RATE);
  const discountFactor = (months: number) => 1 / Math.pow(1 + discountRate, months / 12);
  const milestoneFactor = milestoneFactorFromChain(current, inputs.therapeuticArea);

  const terms = result.terms;
  const headlineTotal = terms.totalDealValue.median;
  const hasRnpv = !!rnpv && Number.isFinite(rnpv.riskAdjustedNPV) && rnpv.riskAdjustedNPV > 0;
  const rnpvNegative = !!rnpv && Number.isFinite(rnpv.riskAdjustedNPV) && rnpv.riskAdjustedNPV <= 0;
  const preMoneyM = hasRnpv
    ? preMult * rnpv!.riskAdjustedNPV
    : headlineTotal * PRE_MONEY_FALLBACK_SHARE_OF_HEADLINE;
  const preMoneyBasis = hasRnpv
    ? `${preMult.toFixed(1)}× risk-adjusted NPV of $${Math.round(rnpv!.riskAdjustedNPV)}M`
    : `${PRE_MONEY_FALLBACK_SHARE_OF_HEADLINE}× headline total of $${Math.round(headlineTotal)}M (${rnpvNegative ? 'the risk-adjusted NPV is at or below zero at this stage' : 'no risk-adjusted NPV available'})`;

  const dilutionFor = (costM: number): number | null => {
    if (!(preMoneyM > 0)) return null;
    const raise = costM * (1 + buffer);
    return raise / (preMoneyM + raise);
  };

  const expectedValue = (o: { pReach: number; dilution: number | null; upfrontIfReached: Range3; totalIfReached: Range3; months: number; costM: number }): number => {
    const keep = 1 - (o.dilution ?? 0);
    const valueIfReached = dealValueTodayM(o.upfrontIfReached.median, o.totalIfReached.median, milestoneFactor);
    return round1(o.pReach * keep * valueIfReached * discountFactor(o.months) - o.costM);
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
    expectedValueM: 0,
    dilution: 0,
    verdict: '',
  };
  dealNow.expectedValueM = expectedValue(dealNow);
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
    expectedValueM: 0,
    dilution: null,
    verdict: '',
  };
  next.expectedUpfrontM = round1(next.pReach * next.upfrontIfReached.median - next.costM);
  next.dilution = dilutionFor(next.costM);
  next.expectedValueM = expectedValue(next);
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
      expectedValueM: 0,
      dilution: null,
      verdict: '',
    };
    after.expectedUpfrontM = round1(after.pReach * after.upfrontIfReached.median - after.costM);
    after.dilution = dilutionFor(after.costM);
    after.expectedValueM = expectedValue(after);
    options.push(after);
  }

  const recKey = recommendedOptionKey(options);
  const rec = options.find(o => o.key === recKey)!;

  // Verdicts
  for (const o of options) {
    const exp = `$${Math.round(o.expectedValueM)}M`;
    if (o.key === 'deal_now') {
      o.verdict = recKey === 'deal_now'
        ? `Recommended: ${exp} of expected value today, with certainty and no dilution.`
        : `${exp} of expected value today with certainty; deferring is worth the financing risk here.`;
    } else {
      const dil = o.dilution != null ? `${(o.dilution * 100).toFixed(0)}% dilution` : 'dilution not computable';
      const uplift = dealNow.expectedValueM > 0 ? ((o.expectedValueM / dealNow.expectedValueM - 1) * 100) : 0;
      o.verdict = o.key === recKey
        ? `Recommended: expected ${exp} today, ${uplift.toFixed(0)}% above partnering now after $${Math.round(o.costM)}M spend, ${dil} and ${o.months} months of discounting.`
        : o.expectedValueM > dealNow.expectedValueM
          ? `Expected ${exp} today is only ${uplift.toFixed(0)}% above partnering now; does not clear the ${OPTION_VALUE_HURDLE * 100}% hurdle after ${dil}.`
          : `Expected ${exp} today after $${Math.round(o.costM)}M spend, ${dil} and a ${(o.pReach * 100).toFixed(0)}% chance of reaching it; below partnering now.`;
    }
  }

  // Financing alternative (next phase)
  const nextDil = next.dilution;
  const retainedIfLicense = round1(dealValueTodayM(terms.upfront.median, terms.totalDealValue.median, milestoneFactor));
  const clientRaise = input.assumptions?.financing?.nextRaiseM;
  const useClientRaise = typeof clientRaise === 'number' && Number.isFinite(clientRaise) && clientRaise > 0;
  const financing = nextDil != null ? {
    preMoneyM: round1(preMoneyM),
    basis: useClientRaise ? `${preMoneyBasis}; raise per intake` : preMoneyBasis,
    raiseM: round1(useClientRaise ? clientRaise : next.costM * (1 + buffer)),
    dilution: nextDil,
    retainedValueIfFinanceM: round1((1 - nextDil) * dealValueTodayM(next.upfrontIfReached.median, next.totalIfReached.median, milestoneFactor) * next.pReach * discountFactor(next.months)),
    retainedValueIfLicenseM: retainedIfLicense,
  } : null;

  // Recommendation text
  let recommendation: string;
  if (recKey === 'deal_now') {
    const bestAlt = options.filter(o => o.key !== 'deal_now').sort((a, b) => b.expectedValueM - a.expectedValueM)[0];
    if (bestAlt && bestAlt.expectedValueM > dealNow.expectedValueM) {
      const uplift = ((bestAlt.expectedValueM / Math.max(dealNow.expectedValueM, 1e-9) - 1) * 100).toFixed(0);
      recommendation = `Partner now. Funding to ${bestAlt.label.replace('Partner after ', '')} raises the expected value today from $${Math.round(dealNow.expectedValueM)}M to $${Math.round(bestAlt.expectedValueM)}M (${uplift}%), below the ${OPTION_VALUE_HURDLE * 100}% hurdle; the option value does not pay for the financing risk of $${Math.round(bestAlt.costM)}M and ${bestAlt.dilution != null ? (bestAlt.dilution * 100).toFixed(0) + '% dilution' : 'the dilution it implies'}.`;
    } else {
      recommendation = `Partner now. Every deferred option has a lower expected value today than the $${Math.round(dealNow.expectedValueM)}M available now (upfront plus milestone value) once the spend, the dilution, the time value and the probability of reaching the next data point are counted.`;
    }
  } else {
    const uplift = ((rec.expectedValueM / Math.max(dealNow.expectedValueM, 1e-9) - 1) * 100).toFixed(0);
    recommendation = `${rec.label}. Spending $${Math.round(rec.costM)}M over ${rec.months} months with a ${(rec.pReach * 100).toFixed(0)}% chance of reaching it lifts the expected value today to $${Math.round(rec.expectedValueM)}M, ${uplift}% above the $${Math.round(dealNow.expectedValueM)}M on offer now${rec.dilution != null ? `, after ${(rec.dilution * 100).toFixed(0)}% dilution` : ''}. That clears the ${OPTION_VALUE_HURDLE * 100}% hurdle, provided the financing is available on those terms.`;
  }

  return { asOf, discountRate, milestoneFactor, options, financing, recommendation };
}
