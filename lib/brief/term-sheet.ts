/**
 * Deal Intelligence Brief v3 — term-sheet precedent map (pure).
 *
 * Counts how often each clause is disclosed as present in the comp set
 * (overall and within the asset's phase), and prints one plain sentence of
 * guidance per clause. Absence in the data means "undisclosed", never
 * "absent" — the page says so.
 */

import type { AssetProfile, ClauseFrequency, TermSheetPrecedent } from './types';
import { normalizePhase, quartiles } from './comp-set';

export interface DealRowForClauses {
  id?: string;
  phase_at_signing: string | null;
  deal_type: string | null;
  includes_co_development: boolean | null;
  includes_co_promotion: boolean | null;
  sublicense_rights: string | boolean | null;
  rights_retained: string | null;
  opt_in_rights: string | boolean | null;
  opt_in_stage: string | null;
  equity_investment_usd: number | null;
  research_funding_usd: number | null;
  profit_share_pct: number | null;
  cost_share_ratio: string | number | null;
  option_exercise_fee: number | null;
  term_years: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  verified?: boolean | null;
}

const NEGATIVE_TEXT = /^(none|no|n\/a|na|not applicable|null|false|0)$/i;

function textPresent(v: string | boolean | number | null | undefined): boolean {
  if (v == null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v > 0;
  const s = v.trim();
  return s.length > 0 && !NEGATIVE_TEXT.test(s);
}

function numPresent(v: number | null | undefined): boolean {
  return v != null && Number.isFinite(v) && v > 0;
}

interface ClauseDef {
  key: string;
  clause: string;
  present: (r: DealRowForClauses) => boolean;
  guidance: string;
}

export const CLAUSE_DEFS: ClauseDef[] = [
  {
    key: 'co_development',
    clause: 'Co-development option',
    present: (r) => r.includes_co_development === true,
    guidance: 'Ask for the right to fund a share of development in exchange for a larger share of profit, and keep it optional so you can decline if the cost is too high.',
  },
  {
    key: 'co_promotion',
    clause: 'Co-promotion right',
    present: (r) => r.includes_co_promotion === true,
    guidance: 'Ask for a co-promotion right in one home market if you plan to build a sales presence; otherwise trade it away for a higher royalty.',
  },
  {
    key: 'sublicense',
    clause: 'Sublicense right',
    present: (r) => textPresent(r.sublicense_rights),
    guidance: 'Allow sublicensing only with your consent and with a share of any sublicense income, so the buyer cannot flip the asset for a profit you never see.',
  },
  {
    key: 'rights_retained',
    clause: 'Retained rights',
    present: (r) => textPresent(r.rights_retained),
    guidance: 'Keep the rights you can realistically use yourself, usually one territory or one indication, and make the buyer pay a clear price for anything beyond that.',
  },
  {
    key: 'opt_in',
    clause: 'Opt-in right',
    present: (r) => textPresent(r.opt_in_rights) || textPresent(r.opt_in_stage),
    guidance: 'Ask for an opt-in at a named data milestone, with the price of exercising it written into the agreement now rather than negotiated later.',
  },
  {
    key: 'equity',
    clause: 'Equity component',
    present: (r) => numPresent(r.equity_investment_usd),
    guidance: 'Take equity only at a premium to your last round and as an addition to cash upfront, never as a substitute for it.',
  },
  {
    key: 'research_funding',
    clause: 'Research funding',
    present: (r) => numPresent(r.research_funding_usd),
    guidance: 'Ask for committed research funding with a fixed number of funded staff for at least two years, paid quarterly in advance.',
  },
  {
    key: 'profit_share',
    clause: 'Profit share',
    present: (r) => numPresent(r.profit_share_pct),
    guidance: 'Ask for a profit share in one major market only if you can fund your side of the costs; otherwise a higher royalty is the safer version of the same idea.',
  },
  {
    key: 'cost_share',
    clause: 'Cost share',
    present: (r) => textPresent(r.cost_share_ratio),
    guidance: 'Cap your share of development cost at a fixed dollar amount per year, with the right to convert to a royalty if you stop funding.',
  },
  {
    key: 'option_fee',
    clause: 'Option exercise fee',
    present: (r) => numPresent(r.option_exercise_fee),
    guidance: 'If the buyer wants an option, ask for a meaningful option fee upfront and a larger exercise fee that is set now, so the option is not a free look.',
  },
  {
    key: 'term_length',
    clause: 'Term length',
    present: (r) => numPresent(r.term_years),
    guidance: 'Tie the royalty term to the later of patent expiry or ten years from first sale in each country, and add a step-down rather than a cliff when protection lapses.',
  },
];

export function buildTermSheetPrecedent(rawRows: DealRowForClauses[], asset: AssetProfile, asOf: string): TermSheetPrecedent {
  const n = rawRows.length;
  const assetPhase = normalizePhase(asset.phase);
  const phaseRows = rawRows.filter((r) => normalizePhase(r.phase_at_signing) === assetPhase);
  const nPhase = phaseRows.length;

  const clauses: ClauseFrequency[] = CLAUSE_DEFS.map((def) => {
    const present = rawRows.filter(def.present).length;
    const presentPhase = phaseRows.filter(def.present).length;
    return {
      clause: def.clause,
      key: def.key,
      share: n > 0 ? present / n : 0,
      n,
      sharePhase: nPhase > 0 ? presentPhase / nPhase : null,
      nPhase,
      guidance: def.guidance,
    };
  });

  const lows = rawRows.map((r) => r.royalty_low_pct);
  const highs = rawRows.map((r) => r.royalty_high_pct);
  const royaltyN = rawRows.filter((r) => r.royalty_low_pct != null || r.royalty_high_pct != null).length;

  const termVals = rawRows.map((r) => r.term_years).filter((v): v is number => numPresent(v));
  const termQ = quartiles(termVals);

  const verified = rawRows.filter((r) => r.verified === true).length;

  return {
    source: {
      source: 'Solidus deal database',
      n,
      asOf,
      note: `verified ${verified} of ${n}; clause fields count only where the filing discloses them`,
    },
    clauses,
    royaltyTiers: { low: quartiles(lows), high: quartiles(highs), n: royaltyN },
    termYears: termQ ? { ...termQ, n: termVals.length } : null,
  };
}
