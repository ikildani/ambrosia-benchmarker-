/**
 * Consistency check between the written narrative (positioning, objections)
 * and the numbers the brief has actually registered. The model that writes
 * the narrative is told which figures it may cite; this is the check that it
 * did. A dollar figure in the text that matches nothing in the decision set
 * (within a small tolerance) is a mismatch: the build retries the narrative
 * once with the offending figures named, then falls back to the deterministic
 * text rather than ship a page that contradicts page three.
 *
 * Pure; exported for tests.
 */
import type { BriefIntelligence, PositioningObjections } from './types';

/** Every dollar figure ($M) the narrative is allowed to cite, with a label for the prompt. */
export function allowedFigures(brief: BriefIntelligence): Array<{ valueM: number; label: string }> {
  const out: Array<{ valueM: number; label: string }> = [];
  const push = (v: number | null | undefined, label: string) => { if (typeof v === 'number' && Number.isFinite(v) && v > 0) out.push({ valueM: v, label }); };
  const d = brief.decision;
  if (d) {
    push(d.ask.totalM, 'ask total'); push(d.ask.upfrontM, 'ask upfront');
    push(d.floor.totalM, 'floor total'); push(d.floor.upfrontM, 'floor upfront');
    push(d.walkAwayUpfrontM, 'walk-away upfront');
  }
  const b = brief.bridge;
  if (b) for (const bar of b.bars) { if (bar.informative === false) continue; push(bar.low, `${bar.label} low`); push(bar.mid, `${bar.label} mid`); push(bar.high, `${bar.label} high`); }
  const cs = brief.compSet;
  if (cs) {
    for (const [name, s] of [['all rows', cs.stats.all], ['ex-outliers', cs.stats.exOutliers]] as const) {
      push(s.upfront?.p25, `comps upfront p25 (${name})`); push(s.upfront?.p50, `comps upfront median (${name})`); push(s.upfront?.p75, `comps upfront p75 (${name})`);
      push(s.total?.p25, `comps total p25 (${name})`); push(s.total?.p50, `comps total median (${name})`); push(s.total?.p75, `comps total p75 (${name})`);
    }
    for (const r of cs.rows.slice(0, 40)) { push(r.upfrontM, `${r.licensee} upfront`); push(r.totalM, `${r.licensee} total`); }
  }
  const inf = brief.inflection;
  if (inf) for (const o of inf.options) { push(o.costM, `${o.label} cost`); push(o.expectedValueM, `${o.label} expected value`); push(o.upfrontIfReached.median, `${o.label} upfront if reached`); push(o.totalIfReached.median, `${o.label} total if reached`); }
  const f = brief.landscape?.funnel;
  if (f) { push(f.peakSalesM.low, 'peak sales low'); push(f.peakSalesM.median, 'peak sales median'); push(f.peakSalesM.high, 'peak sales high'); }
  const c = brief.client;
  if (c?.model) { push(c.model.peakSalesM, 'client peak sales'); push(c.model.expectedUpfrontM, 'client expected upfront'); push(c.model.expectedTotalM, 'client expected total'); push(c.model.devCostToApprovalM, 'client cost to approval'); }
  for (const o of c?.priorOffers ?? []) { push(o.upfrontM, `${o.party} offer upfront`); push(o.totalM, `${o.party} offer total`); }
  for (const cand of brief.buyerMap?.candidates ?? []) { push(cand.impliedUpfront?.median, `${cand.name} implied upfront`); push(cand.impliedTotal?.median, `${cand.name} implied total`); for (const p of cand.priorDeals) { push(p.upfrontM, `${p.parties} upfront`); push(p.totalM, `${p.parties} total`); } }
  return out;
}

const MONEY = /\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(billion|million|bn|mm|b|m)\b/gi;

/** Dollar figures in a text, in $M. */
export function extractFigures(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(MONEY)) {
    const n = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(n)) continue;
    const unit = m[2].toLowerCase();
    out.push(unit.startsWith('b') ? n * 1000 : n);
  }
  return out;
}

export interface NarrativeCheck {
  ok: boolean;
  /** Figures ($M) cited in the narrative that match nothing in the allowed set. */
  mismatches: number[];
}

/** Tolerance: rounding in prose ("$1.5B" for 1,508) is not a mismatch. */
export const FIGURE_TOLERANCE = 0.05;

export function checkNarrative(pos: PositioningObjections, allowed: Array<{ valueM: number }>): NarrativeCheck {
  const text = [...pos.positioning, ...pos.objections.flatMap(o => [o.objection, o.answer, o.evidenceToPrepare])].join('\n');
  const cited = extractFigures(text);
  const values = allowed.map(a => a.valueM);
  const mismatches = cited.filter(v => !values.some(a => Math.abs(a - v) <= Math.max(0.5, a * FIGURE_TOLERANCE)));
  return { ok: mismatches.length === 0, mismatches: [...new Set(mismatches)] };
}

export function fmtFigure(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}B` : `$${Math.round(v)}M`;
}
