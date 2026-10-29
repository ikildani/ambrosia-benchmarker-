/**
 * Search & Evaluation predicted terms (2026-10-28 fix):
 *  - licensing-terms comp pool hygiene (no M&A, no partial-territory licenses,
 *    phase-anchored strict rung);
 *  - the single headline upfront and the calculator-disagreement note.
 */

import {
  isLicensingTermsComp,
  passesAtRung,
  passesAtRungPhaseAnchored,
  selectWithRelaxation,
  territoryScope,
  type CompMatchBreakdown,
} from '@/lib/comparable-scoring';
import {
  DISAGREEMENT_FACTOR,
  HEADLINE_RULE_TEXT,
  calculatorDisagreement,
  disagreementNote,
  termsHeadline,
} from '@/lib/radar/terms-headline';

const b = (over: Partial<CompMatchBreakdown>): CompMatchBreakdown => ({
  ta: true, phase: false, adjacentPhase: false, modality: false, indication: false, dealType: false, recency: 0, ...over,
});

describe('territoryScope', () => {
  it.each([
    ['global', 'full'],
    ['Worldwide', 'full'],
    ['us', 'full'],
    ['us_eu', 'full'],
    ['ex_china', 'full'],
    ['global ex-Greater China', 'full'],
    ['ex-Greater China (exclusive global rights outside Greater China)', 'full'],
    ['global excluding mainland China, Hong Kong, and Macau', 'full'],
    ['US, EU, Japan, and rest of world excluding Greater China', 'full'],
    ['regional', 'partial'],
    ['china', 'partial'],
    ['Greater China', 'partial'],
    ['japan', 'partial'],
    ['ex_us', 'partial'],
    ['europe', 'partial'],
    ['India, South Africa and five other emerging markets', 'partial'],
    ['other', 'partial'],
    [null, 'unknown'],
    ['', 'unknown'],
  ])('%s → %s', (territory, expected) => {
    expect(territoryScope(territory)).toBe(expected);
  });
});

describe('isLicensingTermsComp', () => {
  it('drops acquisitions and mergers (an M&A price is not a licensing upfront)', () => {
    expect(isLicensingTermsComp({ dealType: 'acquisition', territory: 'global' })).toBe(false);
    expect(isLicensingTermsComp({ dealType: 'Merger', territory: 'global' })).toBe(false);
  });
  it('drops partial-territory licenses and keeps global / unknown-territory licenses', () => {
    expect(isLicensingTermsComp({ dealType: 'license', territory: 'china' })).toBe(false);
    expect(isLicensingTermsComp({ dealType: 'license', territory: 'global' })).toBe(true);
    expect(isLicensingTermsComp({ dealType: 'collaboration', territory: null })).toBe(true);
    expect(isLicensingTermsComp({ dealType: 'option', territory: 'ex_china' })).toBe(true);
  });
});

describe('phase-anchored relaxation ladder', () => {
  it('an indication match alone no longer passes the strict rung', () => {
    const indicationOnly = b({ indication: true });
    expect(passesAtRung(indicationOnly, 'none')).toBe(true);
    expect(passesAtRungPhaseAnchored(indicationOnly, 'none')).toBe(false);
    expect(passesAtRungPhaseAnchored(b({ adjacentPhase: true }), 'none')).toBe(true);
    expect(passesAtRungPhaseAnchored(b({ phase: true }), 'none')).toBe(true);
  });

  it('labels a pool "phase matched" only when ≥ 5 same/adjacent-phase deals exist', () => {
    const pool = [
      ...Array.from({ length: 6 }, () => b({ indication: true })),
      ...Array.from({ length: 3 }, () => b({ phase: true })),
      b({ modality: true }),
      b({ modality: true }),
    ];
    expect(selectWithRelaxation(pool, x => x).relaxation).toBe('none');
    const anchored = selectWithRelaxation(pool, x => x, undefined, { phaseAnchored: true });
    expect(anchored.relaxation).toBe('modality_only');
    expect(anchored.items).toHaveLength(5); // 3 phase + 2 modality
  });
});

describe('termsHeadline', () => {
  const base = { predicted_upfront_low: 25, predicted_upfront_mid: 75, predicted_upfront_high: 150, calculator_upfront_mid: null as number | null, insufficient_comps: false };

  it('the headline is the comps median with its P25–P75 range', () => {
    const h = termsHeadline(base)!;
    expect(h).toMatchObject({ source: 'comparable_deals', mid: 75, low: 25, high: 150, calculatorMid: null, disagreement: null });
    expect(disagreementNote(h)).toBeNull();
  });

  it('no headline when comps are insufficient, even if the calculator has a number', () => {
    expect(termsHeadline({ ...base, insufficient_comps: true, calculator_upfront_mid: 300 })).toBeNull();
    expect(termsHeadline({ ...base, predicted_upfront_mid: null, calculator_upfront_mid: 300 })).toBeNull();
    expect(termsHeadline(null)).toBeNull();
  });

  it('within 2× → no note; the calculator never replaces the headline', () => {
    const h = termsHeadline({ ...base, calculator_upfront_mid: 140 })!;
    expect(h.mid).toBe(75);
    expect(h.disagreement).toBeNull();
    expect(disagreementNote(h)).toBeNull();
  });

  it('calculator more than 2× above → note says so with the ratio and the validation result', () => {
    // Pre-fix production median for Phase 3: comps $45M, calculator $213M.
    const h = termsHeadline({ ...base, predicted_upfront_mid: 45, calculator_upfront_mid: 213 })!;
    expect(h.disagreement).toBe('calculator_higher');
    expect(h.calculatorRatio).toBe(4.7);
    const note = disagreementNote(h)!;
    expect(note).toContain('$213M');
    expect(note).toContain('4.7×');
    expect(note).toContain('2.9× above');
  });

  it('calculator more than 2× below → note in the other direction', () => {
    const h = termsHeadline({ ...base, predicted_upfront_mid: 60, calculator_upfront_mid: 21 })!;
    expect(h.disagreement).toBe('calculator_lower');
    expect(disagreementNote(h)).toContain('2.9× below');
  });

  it('threshold is exactly the 2× factor, both directions', () => {
    expect(DISAGREEMENT_FACTOR).toBe(2);
    expect(calculatorDisagreement(50, 100)).toBeNull();
    expect(calculatorDisagreement(50, 101)).toBe('calculator_higher');
    expect(calculatorDisagreement(50, 25)).toBeNull();
    expect(calculatorDisagreement(50, 24)).toBe('calculator_lower');
    expect(calculatorDisagreement(50, null)).toBeNull();
    expect(calculatorDisagreement(0, 100)).toBeNull();
  });

  it('the rule text states the floor', () => {
    expect(HEADLINE_RULE_TEXT).toContain('at least 5 disclosed upfronts');
  });
});
