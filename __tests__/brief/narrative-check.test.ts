import { allowedFigures, checkNarrative, extractFigures, fmtFigure } from '@/lib/brief/narrative-check';
import type { BriefIntelligence, PositioningObjections } from '@/lib/brief/types';

const brief = {
  asOf: '2026-09-26',
  asset: { modality: 'smallMolecule', phase: 'preclinical', indication: 'als', therapeuticArea: 'neurology', territory: 'global', targetDealType: 'Licensing' },
  decision: { ask: { totalM: 1000, upfrontM: 35, royaltyPct: null }, floor: { totalM: 790, upfrontM: 23 }, walkAwayUpfrontM: 19, rationale: [], counterparties: [], levers: [], wouldChangeView: [], timeline: [], headline: '', recommendation: 'partner_now', recommendationLabel: 'Partner now', confidence: 'low', confidenceBasis: '', asOf: '2026-09-26' },
  bridge: { asOf: '2026-09-26', bars: [{ key: 'comps_total', label: 'Comparable deals (total)', basis: 'total', low: 788, mid: 1018, high: 1700, n: 19 }, { key: 'rnpv', label: 'Risk-adjusted NPV', basis: 'rnpv', low: -80, mid: -60, high: 800, informative: false }], ask: { totalM: 1000, upfrontM: 35 }, floor: { totalM: 790, upfrontM: 23 }, walkAway: { upfrontM: 19 }, askBasis: { total: 'comps', upfront: 'comps' }, policy: '', rnpvInformative: false, rnpvNote: null, reconciliation: '' },
} as unknown as BriefIntelligence;

const pos = (answer: string): PositioningObjections => ({
  generatedAt: '2026-09-26', positioning: ['The asset is a preclinical small molecule for ALS.', `The ask is $1.0B total with $35M upfront. ${answer}`],
  objections: [{ objection: 'Why now?', answer, evidenceToPrepare: 'Comparable table' }],
});

describe('narrative consistency check', () => {
  it('collects the figures the brief has registered', () => {
    const allowed = allowedFigures(brief);
    const values = allowed.map(a => a.valueM);
    expect(values).toEqual(expect.arrayContaining([1000, 35, 790, 23, 19, 788, 1018, 1700]));
    // Non-informative bars are not citable.
    expect(values).not.toContain(800);
  });

  it('parses dollar figures in prose, in $M', () => {
    expect(extractFigures('an ask of $1.5B with $93M upfront, against $12.5 million and $2,152M')).toEqual([1500, 93, 12.5, 2152]);
  });

  it('accepts rounded citations of registered figures and flags anything else', () => {
    const allowed = allowedFigures(brief);
    expect(checkNarrative(pos('The comps median of $1.0B and the floor of $790M hold.'), allowed).ok).toBe(true);
    const bad = checkNarrative(pos('The median upfront for that set is $30M, which is our floor.'), allowed);
    expect(bad.ok).toBe(false);
    expect(bad.mismatches).toEqual([30]);
    expect(fmtFigure(30)).toBe('$30M');
    expect(fmtFigure(1500)).toBe('$1.5B');
  });
});
