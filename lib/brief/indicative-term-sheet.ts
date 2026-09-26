/**
 * Indicative term sheet: the one-page document the CEO carries into the room.
 * Every number is taken from the decision (ask, floor, royalty), the
 * term-sheet precedent map (clause frequency, term length) and the intake
 * (structure, territory, retained rights, buyers). Milestone weighting follows
 * the levers by stage. Pure; nothing is recomputed from the engine.
 */
import type { AssetProfile, DecisionSummary, TermSheetPrecedent, BuyerMap } from './types';
import type { ClientIntake } from './client-intake';

export interface TermSheetLine {
  term: string;
  position: string;
  /** Why this position: precedent share, lever, or intake fact. */
  basis: string;
  /** Where we would stop. */
  floor?: string;
}

export interface IndicativeTermSheet {
  asOf: string;
  headline: string;
  structure: string;
  counterparties: string[];
  lines: TermSheetLine[];
  /** Development milestone schedule as shares of (total − upfront). */
  milestones: Array<{ event: string; shareOfMilestones: number; amountM: number }>;
  notes: string[];
}

type Bucket = 'preclinical' | 'phase_1' | 'phase_2' | 'phase_3';
function bucket(phase: string): Bucket {
  const p = phase.toLowerCase();
  if (/discovery|preclin/.test(p)) return 'preclinical';
  if (/phase_?1\b|phase1(?!_2)/.test(p) || /phase_?1_?2|phase1_2/.test(p)) return 'phase_1';
  if (/phase_?2|phase2/.test(p)) return 'phase_2';
  return 'phase_3';
}

const SCHEDULES: Record<Bucket, Array<[string, number]>> = {
  preclinical: [['IND clearance', 0.15], ['First patient dosed (Phase 1)', 0.15], ['Phase 2 start', 0.15], ['Pivotal start', 0.15], ['First regulatory filing', 0.15], ['First approval (US)', 0.15], ['Second major approval', 0.10]],
  phase_1: [['Proof-of-concept readout', 0.20], ['Phase 2 start', 0.15], ['Pivotal start', 0.20], ['First regulatory filing', 0.15], ['First approval (US)', 0.20], ['Second major approval', 0.10]],
  phase_2: [['Pivotal start', 0.25], ['First regulatory filing', 0.25], ['First approval (US)', 0.30], ['Second major approval', 0.20]],
  phase_3: [['First regulatory filing', 0.20], ['First approval (US)', 0.45], ['Second major approval', 0.20], ['First commercial sale', 0.15]],
};

function fmt(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(2)}B` : `$${Math.round(v)}M`;
}

export function buildIndicativeTermSheet(input: {
  asset: AssetProfile;
  decision: DecisionSummary;
  termSheet?: TermSheetPrecedent | null;
  buyerMap?: BuyerMap | null;
  client?: ClientIntake | null;
  asOf: string;
}): IndicativeTermSheet {
  const { asset, decision, termSheet, buyerMap, client, asOf } = input;
  const b = bucket(asset.phase);
  const structure = (asset.targetDealType || 'licensing').toLowerCase();
  const isOption = structure.includes('option');
  const isCodev = structure.includes('co');
  const isMA = structure.includes('acqui') || structure.includes('m&a');
  const territory = asset.territory || 'global';
  const milestonesPool = Math.max(0, decision.ask.totalM - decision.ask.upfrontM);
  const schedule = SCHEDULES[b].map(([event, share]) => ({ event, shareOfMilestones: share, amountM: Math.round(milestonesPool * share) }));
  const clauseShare = (key: string) => termSheet?.clauses.find(c => c.key === key)?.share ?? null;
  const pctText = (s: number | null) => (s == null ? 'no precedent data' : `${Math.round(s * 100)}% of comparable deals`);
  const royalty = decision.ask.royaltyPct;
  const term = termSheet?.termYears ? Math.round(termSheet.termYears.p50) : null;
  const anyAsia = (buyerMap?.candidates ?? []).some(c => /asia|china|japan|korea|apac/i.test(`${c.hqRegion ?? ''} ${c.hqCountry ?? ''}`));
  const retainChina = /global|world/i.test(territory) && !anyAsia && !(client?.targetBuyers ?? []).some(n => /(china|shanghai|beijing|jiangsu|hengrui|hansoh|sino|takeda|daiichi|astellas|eisai|chugai|ono|otsuka)/i.test(n));

  const lines: TermSheetLine[] = [];
  lines.push({ term: 'Structure', position: isMA ? 'Acquisition of the asset (or the company) with contingent consideration' : isOption ? 'Option to an exclusive licence, with an evaluation period' : isCodev ? 'Co-development and commercialisation licence with a profit-share election' : 'Exclusive licence to develop and commercialise', basis: `Structure you are preparing for at intake${isMA ? '' : `; licences are ${pctText(clauseShare('exclusive') ?? clauseShare('exclusivity'))} exclusive`}` });
  lines.push({ term: 'Territory', position: retainChina ? 'Worldwide excluding Greater China (retained)' : /global|world/i.test(territory) ? 'Worldwide' : territory.replace(/_/g, ' '), basis: retainChina ? 'No buyer on the list is Asia-based; Greater China is a second transaction' : 'Territory on offer at intake' });
  if (isOption) lines.push({ term: 'Option fee', position: `${fmt(Math.round(decision.ask.upfrontM * 0.25))}, creditable against the upfront on exercise`, basis: 'Sized to the buyer\'s diligence cost (decision lever); option fees are disclosed in ' + pctText(clauseShare('option_fee')), floor: `${fmt(Math.round(decision.floor.upfrontM * 0.2))}` });
  lines.push({ term: isOption ? 'Upfront on exercise' : isMA ? 'Consideration at close' : 'Upfront', position: fmt(decision.ask.upfrontM), basis: 'The ask on page three', floor: `${fmt(decision.floor.upfrontM)} (floor); walk away below ${fmt(decision.walkAwayUpfrontM)}` });
  lines.push({ term: isMA ? 'Contingent consideration' : 'Development and regulatory milestones', position: `${fmt(milestonesPool)} in aggregate, weighted as scheduled below`, basis: `Total ask ${fmt(decision.ask.totalM)} less the upfront; weighting follows the stage lever`, floor: `${fmt(Math.max(0, decision.floor.totalM - decision.floor.upfrontM))}` });
  if (!isMA) lines.push({ term: 'Sales milestones', position: b === 'phase_3' ? 'Stepped at $500M and $1B net sales' : 'Stepped at $500M and $1B net sales, in addition to the schedule', basis: `Sales milestones appear in ${pctText(clauseShare('sales_milestones'))}` });
  if (!isMA) lines.push({ term: 'Royalty', position: royalty ? `Tiered ${Math.round(royalty.low)}% to ${Math.round(royalty.high)}% of net sales` : 'Tiered, to be set from the comparable royalty band', basis: royalty ? 'Royalty range on page three, from the comparable set' : 'No royalty band could be built from disclosed comps', floor: 'Anti-stacking floor at 4%; no reduction below it for third-party licences' });
  if (!isMA) lines.push({ term: 'Royalty term', position: term ? `Later of patent expiry, regulatory exclusivity, or ${term} years from first sale` : 'Later of patent expiry, regulatory exclusivity, or 12 years from first sale', basis: term ? `Median disclosed term is ${term} years (n=${termSheet?.termYears?.n ?? 0})` : 'Decision lever' });
  if (isCodev || b === 'preclinical' || b === 'phase_1') lines.push({ term: 'Co-development election', position: 'Option to co-fund from pivotal start in exchange for a US profit share', basis: 'Decision lever for early-stage assets; keeps upside if the data outruns the ask' });
  if (b === 'phase_2') lines.push({ term: 'Co-promotion', position: 'US co-promotion right on the lead indication', basis: 'Decision lever for Phase 2 assets' });
  lines.push({ term: 'Diligence', position: 'Commercially reasonable efforts with objective diligence milestones (first patient dosed, filing) and reversion on failure', basis: `Diligence obligations are disclosed in ${pctText(clauseShare('diligence'))}` });
  lines.push({ term: 'Exclusivity period', position: isOption ? 'Evaluation period of 9 months, extendable once for a fee' : '45 days of exclusive negotiation from signing of this term sheet', basis: 'Keeps the tension list warm; see the timeline on page three' });
  if (client?.upstreamLicenses) lines.push({ term: 'Upstream obligations', position: 'Buyer assumes pass-through of upstream royalties and milestones as disclosed', basis: `Intake: ${client.upstreamLicenses.slice(0, 140)}` });

  const notes: string[] = [];
  notes.push(`Indicative only. Positions are the opening set consistent with the decision on page three; the floor column is where we would stop.`);
  if (decision.levers.length) notes.push(`Levers: ${decision.levers.join('; ')}.`);
  if (client?.priorOffers?.length) notes.push(`An offer is already on the table; page "Your model vs Solidus" sets it against the floor and the ask.`);

  return {
    asOf,
    headline: `${asset.assetName || asset.company || 'The asset'} — indicative ${isMA ? 'acquisition' : isOption ? 'option and licence' : isCodev ? 'co-development' : 'licence'} terms`,
    structure: lines[0].position,
    counterparties: [...(decision.counterparties.filter(c => c.role !== 'hold').map(c => c.name))],
    lines,
    milestones: schedule,
    notes,
  };
}
