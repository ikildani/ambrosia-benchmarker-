/**
 * "Your model vs Solidus": the client's own assumptions set against the
 * engine's, line by line, with the source of each gap. Pure. The client's
 * numbers never change the ask; this page is where the two views meet.
 */
import type { ClientIntake, PriorOffer } from './client-intake';
import { bestPriorOffer } from './client-intake';
import type { ValuationBridge, InflectionPath, AssetProfile } from './types';
import type { RNPVResult } from '@/lib/financial/types';

export interface ComparisonRow {
  key: 'peak_sales' | 'pos' | 'launch_year' | 'dev_cost' | 'upfront' | 'total' | 'prior_offer';
  label: string;
  unit: '$M' | '%' | 'year';
  client: number | null;
  solidus: number | null;
  /** client − solidus in the row's unit (percentage points for pos). */
  delta: number | null;
  /** (client / solidus − 1), when both positive. */
  deltaPct: number | null;
  /** Where the Solidus number comes from. */
  basis: string;
  /** One sentence on what drives the gap and what a buyer will do with it. */
  read: string;
}

export interface ClientComparison {
  asOf: string;
  rows: ComparisonRow[];
  /** The offer already on the table, printed against floor and ask. */
  priorOffer: { offer: PriorOffer; vsFloorUpfrontPct: number | null; vsAskUpfrontPct: number | null; vsFloorTotalPct: number | null; vsAskTotalPct: number | null } | null;
  /** Client-supplied notes on their model, printed verbatim. */
  notes: string | null;
  summary: string;
}

const pos = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

function pctDelta(client: number | null, solidus: number | null): number | null {
  if (client == null || solidus == null || solidus <= 0) return null;
  return client / solidus - 1;
}

function fmtPct(x: number | null): string {
  if (x == null) return '';
  const s = Math.round(x * 100);
  return `${s >= 0 ? '+' : ''}${s}%`;
}

export function buildClientComparison(
  client: ClientIntake | null | undefined,
  ctx: { asset: AssetProfile; bridge?: ValuationBridge | null; rnpv?: RNPVResult | null; inflection?: InflectionPath | null; asOf: string },
): ClientComparison | null {
  if (!client) return null;
  const m = client.model;
  const rnpv = ctx.rnpv ?? null;
  const bridge = ctx.bridge ?? null;
  const rows: ComparisonRow[] = [];
  const launchYearSolidus = rnpv && Number.isFinite(rnpv.yearsToMarket) ? new Date(ctx.asOf).getUTCFullYear() + Math.round(rnpv.yearsToMarket) : null;
  const devCostSolidus = rnpv?.phaseTransitions?.length ? rnpv.phaseTransitions.reduce((s, p) => s + (Number.isFinite(p.costEstimate) ? p.costEstimate : 0), 0) : null;

  if (m) {
    const peakS = pos(rnpv?.peakSalesApplied?.median);
    if (m.peakSalesM != null || peakS != null) {
      const d = pctDelta(m.peakSalesM ?? null, peakS);
      rows.push({
        key: 'peak_sales', label: 'Peak sales', unit: '$M', client: m.peakSalesM ?? null, solidus: peakS,
        delta: m.peakSalesM != null && peakS != null ? m.peakSalesM - peakS : null, deltaPct: d,
        basis: 'Indication epidemiology and pricing, capped at 80% of the addressable market; the figure the rNPV ran on.',
        read: d == null ? 'Supply a peak-sales view to compare.' : Math.abs(d) < 0.15 ? 'Within 15%: a buyer will not fight this number.' : d > 0 ? `Your view is ${fmtPct(d)} above ours; expect a buyer to underwrite ours and ask you to prove the share or price behind the difference.` : `Your view is ${fmtPct(d)} below ours; the ask can be defended at our number, and your conservatism is a negotiating reserve, not a concession to open with.`,
      });
    }
    const posS = rnpv && Number.isFinite(rnpv.cumulativePoS) ? rnpv.cumulativePoS * 100 : null;
    if (m.posToApprovalPct != null || posS != null) {
      const delta = m.posToApprovalPct != null && posS != null ? m.posToApprovalPct - posS : null;
      rows.push({
        key: 'pos', label: 'Probability to approval', unit: '%', client: m.posToApprovalPct ?? null, solidus: posS != null ? Math.round(posS * 10) / 10 : null,
        delta, deltaPct: null,
        basis: 'Phase-transition base rates by area (BIO, Citeline, Wong–Siah–Lo) adjusted for modality, biomarker and designations.',
        read: delta == null ? 'Supply a probability to compare.' : Math.abs(delta) < 3 ? 'Within three points: no argument here.' : delta > 0 ? `You assume ${delta.toFixed(0)} points more success than the base rate; a buyer will price the base rate unless the differentiation on page three moves it.` : `You assume ${(-delta).toFixed(0)} points less than the base rate; check whether that reflects a known risk a buyer will also see.`,
      });
    }
    if (m.launchYear != null || launchYearSolidus != null) {
      const delta = m.launchYear != null && launchYearSolidus != null ? m.launchYear - launchYearSolidus : null;
      rows.push({
        key: 'launch_year', label: 'Launch year', unit: 'year', client: m.launchYear ?? null, solidus: launchYearSolidus,
        delta, deltaPct: null,
        basis: 'Median phase durations for the area from the current stage, plus filing and market access.',
        read: delta == null ? 'Supply a launch year to compare.' : Math.abs(delta) <= 1 ? 'Within a year: aligned.' : delta < 0 ? `You plan ${-delta} years faster than the median path; each year is worth a discount-rate turn to a buyer, so the plan behind it belongs in the data room.` : `You plan ${delta} years slower than the median; a buyer will not credit the extra time, so the ask does not move.`,
      });
    }
    if (m.devCostToApprovalM != null || devCostSolidus != null) {
      const d = pctDelta(m.devCostToApprovalM ?? null, pos(devCostSolidus));
      rows.push({
        key: 'dev_cost', label: 'Cost to approval', unit: '$M', client: m.devCostToApprovalM ?? null, solidus: pos(devCostSolidus),
        delta: m.devCostToApprovalM != null && devCostSolidus != null ? m.devCostToApprovalM - devCostSolidus : null, deltaPct: d,
        basis: 'Phase cost benchmarks (DiMasi, inflation-adjusted) for the remaining phases.',
        read: d == null ? 'Supply a cost to compare.' : Math.abs(d) < 0.2 ? 'Within 20%: aligned.' : d < 0 ? `Your budget is ${fmtPct(d)} below benchmark; a co-development structure can hold you to it, a licence will not.` : `Your budget is ${fmtPct(d)} above benchmark; that supports a larger milestone stack rather than a larger upfront.`,
      });
    }
    if (bridge) {
      const du = pctDelta(m.expectedUpfrontM ?? null, pos(bridge.ask.upfrontM));
      if (m.expectedUpfrontM != null) rows.push({
        key: 'upfront', label: 'Upfront', unit: '$M', client: m.expectedUpfrontM, solidus: bridge.ask.upfrontM,
        delta: m.expectedUpfrontM - bridge.ask.upfrontM, deltaPct: du,
        basis: 'The ask: the greater of the calibrated median and the comparable median, with the floor at the comparable lower quartile.',
        read: du == null ? '' : m.expectedUpfrontM < bridge.floor.upfrontM ? `Your expectation is below our floor of $${Math.round(bridge.floor.upfrontM)}M; do not open there.` : Math.abs(du) < 0.15 ? 'Aligned with the ask.' : du > 0 ? `Your expectation is ${fmtPct(du)} above the ask; the comparable set does not support it as an opening position, though a buyer under competitive tension may pay it.` : `Your expectation is ${fmtPct(du)} below the ask; the evidence supports opening higher.`,
      });
      const dt = pctDelta(m.expectedTotalM ?? null, pos(bridge.ask.totalM));
      if (m.expectedTotalM != null) rows.push({
        key: 'total', label: 'Total value', unit: '$M', client: m.expectedTotalM, solidus: bridge.ask.totalM,
        delta: m.expectedTotalM - bridge.ask.totalM, deltaPct: dt,
        basis: 'Same policy as the upfront, on total headline value.',
        read: dt == null ? '' : Math.abs(dt) < 0.15 ? 'Aligned with the ask.' : dt > 0 ? `Your expectation is ${fmtPct(dt)} above the ask; milestones can carry the difference if they are weighted to events you control.` : `Your expectation is ${fmtPct(dt)} below the ask.`,
      });
    }
  }

  const offer = bestPriorOffer(client.priorOffers);
  const priorOffer = offer && bridge ? {
    offer,
    vsFloorUpfrontPct: pctDelta(offer.upfrontM ?? null, pos(bridge.floor.upfrontM)),
    vsAskUpfrontPct: pctDelta(offer.upfrontM ?? null, pos(bridge.ask.upfrontM)),
    vsFloorTotalPct: pctDelta(offer.totalM ?? null, pos(bridge.floor.totalM)),
    vsAskTotalPct: pctDelta(offer.totalM ?? null, pos(bridge.ask.totalM)),
  } : null;

  if (rows.length === 0 && !priorOffer) return null;

  const gaps = rows.filter(r => r.deltaPct != null && Math.abs(r.deltaPct) >= 0.15 || (r.key === 'pos' && r.delta != null && Math.abs(r.delta) >= 3) || (r.key === 'launch_year' && r.delta != null && Math.abs(r.delta) > 1));
  const summary = priorOffer
    ? `An offer from ${offer!.party} is on the table${priorOffer.vsFloorTotalPct != null ? ` at ${fmtPct(priorOffer.vsFloorTotalPct)} versus the floor on total value` : ''}${priorOffer.vsAskTotalPct != null ? ` and ${fmtPct(priorOffer.vsAskTotalPct)} versus the ask` : ''}. ${gaps.length ? `${gaps.length} of your assumptions differ materially from ours; the rows below say which and why.` : 'Your assumptions and ours agree; the negotiation is about the counterparty, not the number.'}`
    : gaps.length
      ? `${gaps.length} of ${rows.length} assumptions differ materially. The rows below say what drives each gap and how a buyer will treat it.`
      : `Your model and ours agree within tolerance on every line supplied. The ask on page three is defensible at your numbers and at ours.`;

  return { asOf: ctx.asOf, rows, priorOffer, notes: m?.notes ?? null, summary };
}
