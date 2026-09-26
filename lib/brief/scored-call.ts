/**
 * The scored call: what the brief committed to, how it will be scored, and
 * what the client will hear from us. Pure; read by the PDF page that follows
 * The Decision and by the data room's Outcomes card.
 *
 * Why (Sep 26 2026): every brief already writes a prediction to the outcome
 * ledger and is resolved against ingested deals or the client's report, but
 * the client never saw any of it. A recommendation that is visibly scored is
 * what turns the brief from an opinion into a commitment.
 */
import type { BriefIntelligence } from './types';
import type { PredictionRow, OutcomeRow } from '@/lib/outcomes/types';

export const FOLLOWUP_DAYS = [45, 120] as const;
/** Days after the predicted window closes before an unresolved call expires (lib/outcomes/resolver.ts). */
export const EXPIRY_GRACE_DAYS = 180;

export interface ScoredCall {
  /** What we committed to, in $M. */
  ask: { upfrontM: number; totalM: number };
  floor: { upfrontM: number; totalM: number };
  walkAwayUpfrontM: number | null;
  recommendationLabel: string | null;
  buyers: { lead: string[]; tension: string[] };
  window: { start: string | null; end: string | null };
  /** ISO date after which an unresolved call counts as a miss on the window. */
  expiresOn: string | null;
  /** The three ways the call gets scored, in plain words. */
  scoredBy: string[];
  /** What we measure once terms are signed. */
  measures: string[];
  /** Dates the client will hear from us, ISO, from the delivery date. */
  followups: Array<{ day: number; date: string | null }>;
  /** Accuracy statement for this therapeutic area when ≥ MIN_N resolved briefs exist. */
  accuracy: { metric: string; value: string; n: number; note: string } | null;
}

export type CallStatus =
  | { state: 'open'; note: string }
  | { state: 'resolved'; note: string; outcome: OutcomeSummary }
  | { state: 'expired'; note: string }
  | { state: 'withdrawn'; note: string };

export interface OutcomeSummary {
  matchedBy: 'auto' | 'manual' | 'client';
  licensee: string | null;
  signedDate: string | null;
  signedUpfrontM: number | null;
  signedTotalM: number | null;
  firstOfferUpfrontM: number | null;
  firstOfferTotalM: number | null;
  askUpfrontM: number | null;
  askTotalM: number | null;
  /** Signed total minus first offer total ($M), when both are known. */
  valueCapturedM: number | null;
  withinBandUpfront: boolean | null;
  buyerHit: boolean | null;
  windowHit: boolean | null;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Date(d.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** "YYYY-MM" from the catalyst window becomes a real date, as the ledger writer does. */
function windowDate(v: string | null | undefined, edge: 'start' | 'end'): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}$/.test(v)) return `${v}-${edge === 'start' ? '01' : '28'}`;
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
}

export function buildScoredCall(brief: BriefIntelligence, opts: { deliveredAt?: string | null } = {}): ScoredCall | null {
  const bridge = brief.bridge;
  if (!bridge) return null;
  const decision = brief.decision ?? null;
  const window = brief.landscape?.catalysts?.recommendedWindow;
  const start = windowDate(window?.start, 'start');
  const end = windowDate(window?.end, 'end');
  const lead = brief.buyerMap?.process.lead ?? [];
  const tension = brief.buyerMap?.process.tension ?? [];
  const deliveredAt = opts.deliveredAt ?? null;

  return {
    ask: { upfrontM: bridge.ask.upfrontM, totalM: bridge.ask.totalM },
    floor: { upfrontM: bridge.floor.upfrontM, totalM: bridge.floor.totalM },
    walkAwayUpfrontM: decision?.walkAwayUpfrontM ?? bridge.walkAway?.upfrontM ?? null,
    recommendationLabel: decision?.recommendationLabel ?? null,
    buyers: { lead: [...lead], tension: [...tension] },
    window: { start, end },
    expiresOn: end ? addDays(end, EXPIRY_GRACE_DAYS) : null,
    scoredBy: [
      'Automatically: when a transaction for this asset or company is published, the ledger matches it to this call and records the signed terms against the ask and the floor.',
      'By you: at day 45 and day 120 we send a two-minute form for the first offer you received, your opening ask and the signed terms, if any.',
      'On the window: a call with no transaction by the end of the window plus six months is scored as a miss on timing, not on price.',
    ],
    measures: [
      'Signed upfront and total value against the ask and the floor (within the stated band or not).',
      'Whether the signing counterparty was on the lead or tension list.',
      'Whether signing fell inside the recommended window.',
      'Value captured: signed total less the first offer you received.',
    ],
    followups: FOLLOWUP_DAYS.map(day => ({ day, date: deliveredAt ? addDays(deliveredAt, day) : null })),
    accuracy: brief.coverage?.accuracy ?? null,
  };
}

export function summariseOutcome(o: OutcomeRow): OutcomeSummary {
  const signedTotal = o.total_m ?? null;
  const firstTotal = o.first_offer_total_m ?? null;
  const computed = signedTotal != null && firstTotal != null ? signedTotal - firstTotal : null;
  return {
    matchedBy: o.matched_by,
    licensee: o.licensee_name ?? null,
    signedDate: o.signed_date ?? null,
    signedUpfrontM: o.upfront_m ?? null,
    signedTotalM: signedTotal,
    firstOfferUpfrontM: o.first_offer_upfront_m ?? null,
    firstOfferTotalM: firstTotal,
    askUpfrontM: o.our_ask_upfront_m ?? null,
    askTotalM: o.our_ask_total_m ?? null,
    valueCapturedM: typeof o.value_captured_m === 'number' ? o.value_captured_m : computed,
    withinBandUpfront: typeof o.within_band_upfront === 'boolean' ? o.within_band_upfront : null,
    buyerHit: typeof o.buyer_hit === 'boolean' ? o.buyer_hit : null,
    windowHit: typeof o.window_hit === 'boolean' ? o.window_hit : null,
  };
}

/** Status of the call from the ledger rows the data room loads. */
export function callStatus(prediction: PredictionRow | null, outcome: OutcomeRow | null, now: Date = new Date()): CallStatus {
  if (!prediction) return { state: 'open', note: 'The call is registered in the outcome ledger once the brief is delivered.' };
  if (prediction.status === 'withdrawn') return { state: 'withdrawn', note: 'This call was withdrawn and is not scored.' };
  if (outcome && outcome.status === 'accepted') {
    const s = summariseOutcome(outcome);
    const who = s.matchedBy === 'client' ? 'from your report' : 'from a published transaction';
    return { state: 'resolved', note: `Scored ${who}${s.signedDate ? ` (signed ${s.signedDate})` : ''}.`, outcome: s };
  }
  if (prediction.status === 'expired') return { state: 'expired', note: 'No transaction was matched by the end of the window plus six months; scored as a miss on timing.' };
  const end = prediction.predicted_window_end;
  const daysLeft = end ? Math.ceil((new Date(end).getTime() - now.getTime()) / 86_400_000) : null;
  const note = daysLeft == null
    ? 'Open. Scored when a transaction is published or you report one.'
    : daysLeft >= 0
      ? `Open. ${daysLeft} days left in the recommended window.`
      : `Open. The recommended window closed ${-daysLeft} days ago; the call expires ${EXPIRY_GRACE_DAYS} days after the window.`;
  return { state: 'open', note };
}
