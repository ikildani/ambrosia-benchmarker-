/**
 * Search & Evaluation — the ONE headline upfront shown for an asset.
 *
 * Every thesis carries two upfront figures for the same profile:
 *   - the comparable-deal estimate (predicted_upfront_low / mid / high):
 *     median and P25–P75 of disclosed upfronts in the licensing comp pool;
 *   - the Solidus calculator's headline (calculator_upfront_mid).
 *
 * Rule (validated 2026-10-28): the headline is the comparable-deal median
 * with its P25–P75 range whenever the thesis has terms, i.e. the pool holds
 * at least MIN_COMPS_FOR_TERMS (5) comps AND at least 5 disclosed upfronts.
 * The calculator is never the headline; it is shown as a reference, with a
 * note when it sits more than DISAGREEMENT_FACTOR (2×) away from the
 * headline. Below the floor no headline is shown at all.
 *
 * Why comps: on a hold-out of the most recent 25% of verified licensing deals
 * (signed 2024-03 → 2026-09), each priced only from deals signed before it,
 * the comps estimate was closer to the real upfront than the calculator in
 * every comp-count bucket (5–9, 10–19, 20+ disclosed upfronts). The
 * calculator's baselines are built from headline mega-deals (Phase 3 baseline
 * $350M upfront on a $2.5B total) and ran a median 2.9× above the disclosed
 * upfront on global-rights deals. See TERMS_VALIDATION.
 */

/** Calculator vs headline gap (either direction) that triggers the note. */
export const DISAGREEMENT_FACTOR = 2;

/** Minimum disclosed comp upfronts behind a headline (mirrors the thesis floor). */
export const HEADLINE_MIN_DISCLOSED_UPFRONTS = 5;

/** Hold-out validation behind the rule (median |ln(predicted / actual)|). */
export const TERMS_VALIDATION = {
  asOf: '2026-10-28',
  holdout: 'most recent 25% of verified licensing / collaboration / option deals with a disclosed upfront (2024-03 to 2026-09)',
  globalRights: {
    n: 175,
    newComps: { mdae: 1.24, coveragePct: 99 },
    oldComps: { mdae: 1.39, coveragePct: 100 },
    calculator: { mdae: 1.39, coveragePct: 85, medianOverstatement: 2.9 },
  },
} as const;

export interface TermsHeadlineInput {
  predicted_upfront_low: number | null;
  predicted_upfront_mid: number | null;
  predicted_upfront_high: number | null;
  calculator_upfront_mid: number | null;
  insufficient_comps?: boolean | null;
}

export type Disagreement = 'calculator_higher' | 'calculator_lower' | null;

export interface TermsHeadline {
  source: 'comparable_deals';
  /** $M */
  mid: number;
  /** $M, P25 of comp upfronts (null when not recorded) */
  low: number | null;
  /** $M, P75 of comp upfronts (null when not recorded) */
  high: number | null;
  /** $M, the calculator's headline for the same profile */
  calculatorMid: number | null;
  /** calculator / headline, null when either is missing */
  calculatorRatio: number | null;
  disagreement: Disagreement;
}

const pos = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;

/** Direction of a > DISAGREEMENT_FACTOR gap between the calculator and the headline. */
export function calculatorDisagreement(headlineMid: number | null | undefined, calculatorMid: number | null | undefined): Disagreement {
  const h = pos(headlineMid);
  const c = pos(calculatorMid);
  if (h == null || c == null) return null;
  const r = c / h;
  if (r > DISAGREEMENT_FACTOR) return 'calculator_higher';
  if (r < 1 / DISAGREEMENT_FACTOR) return 'calculator_lower';
  return null;
}

/** The single headline upfront for a thesis, or null when there is none to show. */
export function termsHeadline(th: TermsHeadlineInput | null | undefined): TermsHeadline | null {
  if (!th || th.insufficient_comps) return null;
  const mid = pos(th.predicted_upfront_mid);
  if (mid == null) return null;
  const calc = pos(th.calculator_upfront_mid);
  return {
    source: 'comparable_deals',
    mid,
    low: pos(th.predicted_upfront_low),
    high: pos(th.predicted_upfront_high),
    calculatorMid: calc,
    calculatorRatio: calc != null ? Math.round((calc / mid) * 10) / 10 : null,
    disagreement: calculatorDisagreement(mid, calc),
  };
}

function fmtMoney(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(m >= 10_000 ? 0 : 1)}B`;
  return `$${Math.round(m)}M`;
}

function fmtRatio(r: number): string {
  return r >= 10 ? `${Math.round(r)}×` : `${r.toFixed(1)}×`;
}

/**
 * Plain-English note when the calculator and the headline disagree by more
 * than DISAGREEMENT_FACTOR. Null when they agree or either is missing.
 */
export function disagreementNote(h: TermsHeadline | null): string | null {
  if (!h || !h.disagreement || h.calculatorMid == null) return null;
  const calc = fmtMoney(h.calculatorMid);
  if (h.disagreement === 'calculator_higher') {
    const r = h.calculatorMid / h.mid;
    return `The Solidus calculator puts this profile at ${calc} upfront, ${fmtRatio(r)} the comparable-deal median. `
      + `The calculator is built from headline deal values and on recent global-rights licenses it ran a median `
      + `${TERMS_VALIDATION.globalRights.calculator.medianOverstatement}× above the upfront actually paid, so the headline follows the comparable deals.`;
  }
  const r = h.mid / h.calculatorMid;
  return `The Solidus calculator puts this profile at ${calc} upfront, ${fmtRatio(r)} below the comparable-deal median. `
    + `The headline follows the comparable deals, which tracked real upfronts more closely on recent licenses; treat the gap as a sign the comps may run rich for this profile.`;
}

/** One-line statement of the rule, for tooltips and the brief footnote. */
export const HEADLINE_RULE_TEXT =
  `Headline = median disclosed upfront of verified global-rights licensing comps (no M&A, no regional licenses), `
  + `same or adjacent phase, range P25–P75; shown only with at least ${HEADLINE_MIN_DISCLOSED_UPFRONTS} disclosed upfronts.`;
