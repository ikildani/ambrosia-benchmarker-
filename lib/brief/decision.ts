/**
 * Decision summary — page 3 of the Brief.
 *
 * Reads the bridge (ask / floor / walk-away), the inflection path, the buyer
 * map, the comp set and the catalyst window, and writes the one-page decision:
 * what we recommend, with whom, at what terms, by when. Never recomputes a
 * number that another builder owns.
 *
 * Constants (list on the methodology page):
 *  - LEAD_URGENCY_THRESHOLD = 60 — a lead buyer counts as "ready to transact"
 *    when urgency ≥ 60 and it transacts at the asset's phase.
 *  - PARALLEL_PROCESS_MIN_LEADS = 2 — with two such leads, run the process in
 *    parallel with the next readout rather than waiting.
 *  - CONFIDENCE_HIGH_N = 12, CONFIDENCE_MEDIUM_N = 6 — same-indication comps
 *    behind the number.
 */

import type { CalculationResult } from '@/lib/calculations';
import type { DealMemo } from '@/lib/ai/deal-memo-generator';
import { recommendedOptionKey } from './inflection';
import type {
  AssetProfile, ValuationBridge, InflectionPath, BuyerMap, BuyerCandidate, CompSet,
  DecisionSummary, Range3,
} from './types';

export const LEAD_URGENCY_THRESHOLD = 60;
export const PARALLEL_PROCESS_MIN_LEADS = 2;
export const CONFIDENCE_HIGH_N = 12;
export const CONFIDENCE_MEDIUM_N = 6;

export interface DecisionInput {
  asset: AssetProfile;
  bridge: ValuationBridge;
  inflection?: InflectionPath | null;
  buyerMap?: BuyerMap | null;
  compSet?: CompSet | null;
  catalystWindow?: { start: string; end: string; rationale: string } | null;
  memo?: DealMemo;
  result: CalculationResult;
  asOf: string;
  /** Intake data; an offer on the table adds a lever. */
  client?: import('./client-intake').ClientIntake | null;
}

const LABELS: Record<DecisionSummary['recommendation'], string> = {
  partner_now: 'Partner now',
  partner_after_next_readout: 'Partner after the next readout',
  run_process_in_parallel: 'Run the process in parallel with the next readout',
  hold: 'Hold',
};

type PhaseBucket = 'preclinical' | 'phase_1' | 'phase_2' | 'phase_3';

function phaseBucket(phase: string): PhaseBucket {
  const k = phase.replace(/_/g, '').toLowerCase();
  if (k === 'phase1' || k === 'phase12') return 'phase_1';
  if (k === 'phase2' || k === 'phase23') return 'phase_2';
  if (k === 'phase3' || k === 'ndafiled' || k === 'nda' || k === 'approved') return 'phase_3';
  return 'preclinical';
}

/** Bucket a deals-table phase key (discovery|preclinical|phase_1|…) onto the same four buckets. */
function dealPhaseBucket(phase: string | null | undefined): PhaseBucket | null {
  if (!phase) return null;
  const k = phase.replace(/_/g, '').toLowerCase();
  if (k === 'discovery' || k === 'preclinical') return 'preclinical';
  if (k === 'phase1' || k === 'phase12') return 'phase_1';
  if (k === 'phase2' || k === 'phase23') return 'phase_2';
  if (k === 'phase3' || k === 'approved' || k === 'ndafiled' || k === 'nda') return 'phase_3';
  return null;
}

function phaseWord(phase: string): string {
  const b = phaseBucket(phase);
  return b === 'preclinical' ? 'preclinical' : b === 'phase_1' ? 'Phase 1' : b === 'phase_2' ? 'Phase 2' : 'Phase 3';
}

function fmt(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  return `$${Math.round(v)}M`;
}

function monthLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function candidateByName(map: BuyerMap | null | undefined, name: string): BuyerCandidate | undefined {
  return map?.candidates.find(c => c.name.toLowerCase() === name.toLowerCase());
}

function isAsiaBased(c: BuyerCandidate): boolean {
  const r = `${c.hqRegion ?? ''} ${c.hqCountry ?? ''}`.toLowerCase();
  return /asia|china|japan|korea|cn\b|jp\b|kr\b|apac/.test(r);
}

function pickLevers(asset: AssetProfile, buyerMap: BuyerMap | null | undefined, client?: import('./client-intake').ClientIntake | null): string[] {
  const bucket = phaseBucket(asset.phase);
  const structure = (asset.targetDealType || '').toLowerCase();
  const anyAsia = (buyerMap?.candidates ?? []).some(isAsiaBased);
  const territoryGlobal = /global|world/i.test(asset.territory || 'global');

  const levers: string[] = [];
  const offers = (client?.priorOffers ?? []).filter(o => o.status !== 'declined' && o.status !== 'expired');
  const best = offers.slice().sort((a, b) => ((b.totalM ?? b.upfrontM ?? 0) - (a.totalM ?? a.upfrontM ?? 0)))[0];
  if (best) levers.push(`Open every conversation above the ${best.party} offer already on the table${best.upfrontM != null ? ` ($${Math.round(best.upfrontM)}M upfront)` : ''}; it is the floor of the process, not the ask`);
  if (structure.includes('option')) levers.push('Option fee sized to the buyer’s diligence cost, creditable against the upfront on exercise');
  if (structure.includes('acqui') || structure.includes('m&a')) levers.push('Contingent value right on the lead-indication approval so the price tracks the data');

  if (bucket === 'preclinical') {
    levers.push('Front-load development milestones to IND clearance and first-patient dosing');
    levers.push('Co-development option on the lead indication with a US profit-share election');
  } else if (bucket === 'phase_1') {
    levers.push('Front-load milestones to the proof-of-concept readout and Phase 2 start');
    levers.push('Co-development option on the lead indication with a US profit-share election');
  } else if (bucket === 'phase_2') {
    levers.push('Weight milestones to Phase 3 start and first regulatory filing rather than approval');
    levers.push('US co-promotion right on the lead indication');
  } else {
    levers.push('Approval and first-commercial-sale milestones at 40% or more of the total');
    levers.push('Sales milestones stepped at $500M and $1B net sales');
  }

  if (territoryGlobal && !anyAsia) levers.push('Retain Greater China rights; no buyer on the list is Asia-based');
  levers.push('Anti-stacking floor at 4% on the royalty, with a term to the later of patent expiry or 12 years');

  return levers.slice(0, 3);
}

function buildTimeline(asset: AssetProfile): Array<{ week: string; step: string }> {
  const bucket = phaseBucket(asset.phase);
  const late = bucket === 'phase_3';
  const mid = bucket === 'phase_2';
  return [
    { week: 'Week 1', step: 'Data room open; diligence gaps closed; non-confidential deck final' },
    { week: 'Week 2', step: 'CDA and non-confidential package to the lead; tension buyers briefed' },
    { week: 'Week 3–4', step: 'Management presentations and confidential data room access' },
    { week: late ? 'Week 5–7' : 'Week 5–6', step: 'Term sheets requested; ask, floor and walk-away held' },
    { week: late ? 'Week 8–12' : mid ? 'Week 8–11' : 'Week 8–10', step: `Confirmatory diligence${late ? ' including CMC audit and regulatory file review' : mid ? ' including CMC and clinical file review' : ''}` },
    { week: late ? 'Week 14–20' : mid ? 'Week 13–17' : 'Week 12–16', step: 'Definitive agreement negotiated and signed' },
  ];
}

function royaltyRange(result: CalculationResult): Range3 | null {
  const maybe = (result.terms as Partial<{ royalties: Range3 }>).royalties;
  if (maybe && Number.isFinite(maybe.median)) return { ...maybe };
  const base = result.tieredRoyalties?.base;
  if (base && Number.isFinite(base.low) && Number.isFinite(base.high)) {
    return { low: base.low, median: (base.low + base.high) / 2, high: base.high };
  }
  return null;
}

export function buildDecisionSummary(input: DecisionInput): DecisionSummary {
  const { asset, bridge, inflection, buyerMap, compSet, catalystWindow, memo, result, asOf } = input;
  const assetName = asset.assetName || asset.company || 'the asset';
  const candidates = buyerMap?.candidates ?? [];
  const leadNames = buyerMap?.process.lead ?? [];
  const lead = leadNames.map(n => candidateByName(buyerMap, n)).find(Boolean) ?? candidates[0];

  // Recommendation mapping
  const inflKey = inflection ? recommendedOptionKey(inflection.options) : 'deal_now';
  const readyLeads = leadNames
    .map(n => candidateByName(buyerMap, n))
    .filter((c): c is BuyerCandidate => !!c && c.transactsAtPhase === 'yes' && c.urgency >= LEAD_URGENCY_THRESHOLD);

  let recommendation: DecisionSummary['recommendation'];
  if (candidates.length === 0) recommendation = 'hold';
  else if (inflKey === 'deal_now') recommendation = 'partner_now';
  else if (readyLeads.length >= PARALLEL_PROCESS_MIN_LEADS) recommendation = 'run_process_in_parallel';
  else recommendation = 'partner_after_next_readout';

  const ask = bridge.ask;
  const floor = bridge.floor;
  const walkAwayUpfrontM = bridge.walkAway.upfrontM;

  // Headline
  const nextOpt = inflection?.options.find(o => o.key === inflKey && o.key !== 'deal_now');
  let headline: string;
  if (recommendation === 'hold') {
    headline = `Hold ${assetName}: no buyer on the evidence transacts at ${phaseWord(asset.phase)} in ${asset.indication}; build the buyer list before taking a ${fmt(ask.totalM)} ask to market.`;
  } else if (recommendation === 'partner_now') {
    headline = `Take ${assetName} to ${lead ? lead.name : 'the lead buyer'} now at ${fmt(ask.totalM)} total and ${fmt(ask.upfrontM)} upfront, holding a ${fmt(floor.upfrontM)} upfront floor.`;
  } else if (recommendation === 'run_process_in_parallel') {
    headline = `Open a process with ${readyLeads.map(c => c.name).slice(0, 2).join(' and ')} now at ${fmt(ask.totalM)} total, while funding to ${nextOpt ? nextOpt.label.replace('Partner after ', '') : 'the next readout'} so the ask steps up if the data lands.`;
  } else {
    headline = `Fund ${assetName} to ${nextOpt ? nextOpt.label.replace('Partner after ', '') : 'the next readout'} (${nextOpt ? `${fmt(nextOpt.costM)}, ${nextOpt.months} months` : 'see inflection path'}) and take it to ${lead ? lead.name : 'the lead buyer'} then; today’s ${fmt(ask.totalM)} ask is the floor for that conversation.`;
  }

  // Rationale bullets (each with a number)
  const rationale: string[] = [];
  const stats = compSet ? (compSet.stats.exOutliers.n > 0 ? compSet.stats.exOutliers : compSet.stats.all) : null;
  if (stats && stats.n > 0 && (stats.total || stats.upfront)) {
    const sameInd = compSet!.rows.filter(r => r.sameIndication).length;
    const bucket = phaseBucket(asset.phase);
    const samePhase = compSet!.rows.filter(r => dealPhaseBucket(r.phase) === bucket).length;
    const parts: string[] = [];
    if (stats.total) parts.push(`median total ${fmt(stats.total.p50)}`);
    if (stats.upfront) parts.push(`median upfront ${fmt(stats.upfront.p50)}`);
    const askSrc = bridge.askBasis.total === 'comps' || bridge.askBasis.upfront === 'comps'
      ? ' The ask is anchored on that median.'
      : ' The calibrated headline sits above that median, so the ask is anchored on the headline.';
    rationale.push(`${stats.n} comparable deals (${sameInd} same-indication, ${samePhase} at ${phaseWord(asset.phase)}): ${parts.join(', ')}, outliers removed.${askSrc}`);
  }
  const rnpvBar = bridge.bars.find(b => b.key === 'rnpv');
  if (rnpvBar && rnpvBar.mid != null && rnpvBar.mid > 0 && bridge.rnpvInformative) {
    rationale.push(`Risk-adjusted NPV of ${fmt(rnpvBar.mid)}; the ${fmt(ask.totalM)} ask is ${((ask.totalM / rnpvBar.mid) * 100).toFixed(0)}% of it, in line with a licence that transfers development risk.`);
  } else if (bridge.rnpvNote) {
    rationale.push(bridge.rnpvNote);
  }
  if (lead) {
    rationale.push(`${lead.name} scores ${Math.round(lead.urgency)}/100 on urgency with ${lead.dealsLast12mo} deal${lead.dealsLast12mo === 1 ? '' : 's'} in the last 12 months${lead.transactsAtPhase === 'yes' ? ` and a record of transacting at ${phaseWord(asset.phase)}` : lead.transactsAtPhase === 'no' ? `, but no record of transacting at ${phaseWord(asset.phase)}` : ''}.`);
  }
  if (catalystWindow) {
    rationale.push(`Go-to-market window ${monthLabel(catalystWindow.start)} to ${monthLabel(catalystWindow.end)}: ${catalystWindow.rationale}`);
  }
  if (inflection && nextOpt) {
    const now = inflection.options.find(o => o.key === 'deal_now');
    rationale.push(`Funding to ${nextOpt.label.replace('Partner after ', '')} costs ${fmt(nextOpt.costM)} over ${nextOpt.months} months at ${(nextOpt.pReach * 100).toFixed(0)}% probability; expected value ${fmt(nextOpt.expectedValueM)} today (upfront plus milestone value, after dilution and time) against ${fmt(now?.expectedValueM ?? ask.upfrontM)} now.`);
  } else if (inflection) {
    const now = inflection.options.find(o => o.key === 'deal_now');
    const alt = inflection.options.filter(o => o.key !== 'deal_now').sort((a, b) => b.expectedValueM - a.expectedValueM)[0];
    if (alt) rationale.push(`Deferring to ${alt.label.replace('Partner after ', '')} would cost ${fmt(alt.costM)} for a ${(alt.pReach * 100).toFixed(0)}% chance of reaching it; expected value ${fmt(alt.expectedValueM)} today (upfront plus milestone value, after dilution and time) does not beat ${fmt(now?.expectedValueM ?? ask.upfrontM)} now by the 15% hurdle.`);
  }
  if (rationale.length < 3) {
    rationale.push(`Ask ${fmt(ask.totalM)} total and ${fmt(ask.upfrontM)} upfront against a floor of ${fmt(floor.totalM)} / ${fmt(floor.upfrontM)} and a walk-away at ${fmt(walkAwayUpfrontM)} upfront.`);
  }
  if (rationale.length < 3 && buyerMap) {
    rationale.push(`${candidates.length} buyers ranked on evidence; ${candidates.filter(c => c.transactsAtPhase === 'yes').length} have transacted at ${phaseWord(asset.phase)}.`);
  }

  // Counterparties
  const counterparties: DecisionSummary['counterparties'] = [];
  if (buyerMap) {
    const push = (names: string[], role: 'lead' | 'tension' | 'hold', cap: number) => {
      for (const name of names.slice(0, cap)) {
        const c = candidateByName(buyerMap, name);
        counterparties.push({ name, role, why: c?.whyNow || buyerMap.process.rationale });
      }
    };
    push(buyerMap.process.lead, 'lead', 3);
    push(buyerMap.process.tension, 'tension', 3);
    push(buyerMap.process.hold, 'hold', 2);
  }

  // What would change our view
  const p25 = stats?.total?.p25;
  const p75 = stats?.total?.p75;
  const wouldChangeView: string[] = [
    p25 != null && p75 != null
      ? `A new ${asset.indication} deal signed above ${fmt(p75)} or below ${fmt(p25)} total, outside the current 25th–75th percentile band.`
      : `A new ${asset.indication} deal at ${phaseWord(asset.phase)} with disclosed terms; the comp set is too thin to bound the ask today.`,
    lead
      ? `A readout, in-licence or programme cut by ${lead.name} in ${asset.indication} that changes the gap this asset fills.`
      : `A buyer on the list announcing an in-licence or readout in ${asset.indication}.`,
    asset.dataPackageStage
      ? `The asset’s next data package beyond “${asset.dataPackageStage}”: a positive read supports the step-up, a mixed read moves the ask to the floor.`
      : `The asset’s next data package at ${phaseWord(asset.phase)}: a positive read supports the step-up, a mixed read moves the ask to the floor.`,
  ];

  // Confidence
  const sameIndicationN = compSet ? compSet.rows.filter(r => r.sameIndication).length : 0;
  // One verdict. Pricing evidence (same-indication comparables) sets it; the
  // strategic read can only lower it, and is described without a second
  // adjective so the page never says "low" and "high" on the same line.
  let confidence: DecisionSummary['confidence'] = sameIndicationN >= CONFIDENCE_HIGH_N ? 'high' : sameIndicationN >= CONFIDENCE_MEDIUM_N ? 'medium' : 'low';
  const rank = { low: 0, medium: 1, high: 2 } as const;
  let confidenceBasis = `Pricing evidence: ${sameIndicationN} same-indication comparable${sameIndicationN === 1 ? '' : 's'}${compSet ? ` of ${compSet.rows.length} in the set` : ' (no comparable set)'}`;
  if (memo?.confidence_level) {
    const memoWhy = memo.confidence_basis ? memo.confidence_basis.replace(/\s*\(high ≥ \d+, medium ≥ \d+\)\s*$/i, '').trim() : '';
    if (rank[memo.confidence_level] < rank[confidence]) {
      confidence = memo.confidence_level;
      confidenceBasis += `; the strategic read is weaker${memoWhy ? ` (${memoWhy})` : ''} and sets the verdict`;
    } else if (rank[memo.confidence_level] > rank[confidence]) {
      confidenceBasis += `; the strategic read is stronger${memoWhy ? ` (${memoWhy})` : ''}, but pricing evidence sets the verdict`;
    }
  }

  return {
    asOf,
    headline,
    recommendation,
    recommendationLabel: LABELS[recommendation],
    rationale: rationale.slice(0, 5),
    counterparties,
    ask: { totalM: ask.totalM, upfrontM: ask.upfrontM, royaltyPct: royaltyRange(result) },
    floor: { totalM: floor.totalM, upfrontM: floor.upfrontM },
    walkAwayUpfrontM,
    levers: pickLevers(asset, buyerMap, input.client),
    wouldChangeView,
    timeline: buildTimeline(asset),
    confidence,
    confidenceBasis,
  };
}
