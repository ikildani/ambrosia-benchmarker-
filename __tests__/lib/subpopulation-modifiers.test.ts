/**
 * Subpopulation Modifiers (Tier 4 Item 13) — acceptance tests.
 */

import {
  SUBPOPULATION_MODIFIERS,
  PEAK_MULT_BOUNDS,
  POS_MULT_BOUNDS,
  getSubpopulationModifier,
} from '@/lib/financial/subpopulation-modifiers';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import type { RNPVInput } from '@/lib/financial/types';

describe('subpopulation modifiers — registry', () => {
  test('every entry has unique key', () => {
    const keys = SUBPOPULATION_MODIFIERS.map(e => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('every entry has non-empty source and notes', () => {
    for (const e of SUBPOPULATION_MODIFIERS) {
      expect(e.source.length).toBeGreaterThan(0);
      expect(e.notes.length).toBeGreaterThan(0);
    }
  });

  test('every entry has year in [2024, 2026]', () => {
    for (const e of SUBPOPULATION_MODIFIERS) {
      expect(e.year).toBeGreaterThanOrEqual(2024);
      expect(e.year).toBeLessThanOrEqual(2026);
    }
  });

  test('peakSalesMultiplier is within declared bounds', () => {
    for (const e of SUBPOPULATION_MODIFIERS) {
      expect(e.peakSalesMultiplier).toBeGreaterThanOrEqual(PEAK_MULT_BOUNDS.min);
      expect(e.peakSalesMultiplier).toBeLessThanOrEqual(PEAK_MULT_BOUNDS.max);
    }
  });

  test('posMultiplier is within declared bounds', () => {
    for (const e of SUBPOPULATION_MODIFIERS) {
      expect(e.posMultiplier).toBeGreaterThanOrEqual(POS_MULT_BOUNDS.min);
      expect(e.posMultiplier).toBeLessThanOrEqual(POS_MULT_BOUNDS.max);
    }
  });
});

describe('getSubpopulationModifier — resolution', () => {
  test('no-op when indication is missing', () => {
    const r = getSubpopulationModifier(undefined, 'krasG12C');
    expect(r).toEqual({ peakSalesMult: 1.0, posMult: 1.0, matchedKey: null, source: null });
  });

  test('no-op when no fields provided', () => {
    const r = getSubpopulationModifier('lung_nsclc');
    expect(r.peakSalesMult).toBe(1.0);
    expect(r.posMult).toBe(1.0);
    expect(r.matchedKey).toBeNull();
  });

  test('matches KRAS G12C NSCLC with full field specificity', () => {
    const r = getSubpopulationModifier('lung_nsclc', 'krasG12C', '2L', 'adult');
    expect(r.matchedKey).toBe('lung_nsclc.krasG12C.2L.adult');
    expect(r.peakSalesMult).toBeLessThan(1.0);
    expect(r.posMult).toBeGreaterThan(1.0);
  });

  test('specificity tie-break: more fields matched wins', () => {
    // DMD has two entries: dmd.pediatric (1 match field) and dmd.adult (1 match).
    // Passing pediatric should match pediatric only.
    const pedi = getSubpopulationModifier(
      'duchenne_muscular_dystrophy',
      undefined,
      undefined,
      'pediatric',
    );
    const adult = getSubpopulationModifier(
      'duchenne_muscular_dystrophy',
      undefined,
      undefined,
      'adult',
    );
    expect(pedi.matchedKey).toBe('dmd.pediatric');
    expect(adult.matchedKey).toBe('dmd.adult');
    expect(pedi.peakSalesMult).toBeGreaterThan(adult.peakSalesMult);
  });

  test('mismatched required field is rejected', () => {
    // lung_nsclc.krasG12C.2L.adult requires lineOfTherapy=2L.
    // Passing 1L should not match that entry.
    const r = getSubpopulationModifier('lung_nsclc', 'krasG12C', '1L', 'adult');
    expect(r.matchedKey).not.toBe('lung_nsclc.krasG12C.2L.adult');
  });

  test('unknown indication returns no-op', () => {
    const r = getSubpopulationModifier('made_up_indication', 'krasG12C');
    expect(r.matchedKey).toBeNull();
    expect(r.peakSalesMult).toBe(1.0);
  });
});

describe('Item 13 — engine integration', () => {
  const originalEnv = process.env.TIER4_SUBPOP;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TIER4_SUBPOP;
    } else {
      process.env.TIER4_SUBPOP = originalEnv;
    }
    jest.resetModules();
  });

  function baseInput(overrides: Partial<RNPVInput> = {}): RNPVInput {
    return {
      therapeuticArea: 'oncology',
      indication: 'lung_nsclc',
      modality: 'smallMolecule',
      phase: 'phase2',
      territory: 'global',
      competitivePosition: 'follower',
      dataQuality: 'good',
      peakSalesEstimate: { low: 500, median: 1500, high: 3000 },
      regulatoryDesignations: {
        breakthrough: false,
        fastTrack: false,
        orphan: false,
        prime: false,
      },
      ...overrides,
    };
  }

  test('without subpop fields set, calculateRNPV output matches baseline (flag off)', () => {
    delete process.env.TIER4_SUBPOP;
    jest.resetModules();
    const { calculateRNPV: fresh } = require('@/lib/financial/rnpv-engine');
    const baseline = fresh(baseInput());
    const withNoSubpop = fresh(baseInput({ mutationStatus: 'krasG12C' }));
    // Flag off → no subpop applied → identical outputs
    expect(withNoSubpop.riskAdjustedNPV).toBe(baseline.riskAdjustedNPV);
  });

  test('KRAS G12C NSCLC 2L yields different NPV than wild-type with flag on', () => {
    process.env.TIER4_SUBPOP = 'on';
    jest.resetModules();
    const { calculateRNPV: fresh } = require('@/lib/financial/rnpv-engine');
    const wt = fresh(baseInput());
    const mut = fresh(baseInput({
      mutationStatus: 'krasG12C',
      lineOfTherapy: '2L',
      demographicSubpop: 'adult',
    }));
    // KRAS G12C variant's riskAdjustedNPV is lower because the 0.18 peak
    // sales multiplier cascades to every downstream cash flow.
    expect(mut.riskAdjustedNPV).toBeLessThan(wt.riskAdjustedNPV);
    // NPV gap should exceed 30% since G12C peak multiplier is 0.18.
    const gap = Math.abs(mut.riskAdjustedNPV - wt.riskAdjustedNPV) / Math.max(Math.abs(wt.riskAdjustedNPV), 1);
    expect(gap).toBeGreaterThan(0.30);
  });

  test('DMD pediatric produces higher NPV than DMD adult (larger addressable pop)', () => {
    process.env.TIER4_SUBPOP = 'on';
    jest.resetModules();
    const { calculateRNPV: fresh } = require('@/lib/financial/rnpv-engine');
    const base = baseInput({
      therapeuticArea: 'rareDisease',
      indication: 'duchenne_muscular_dystrophy',
    });
    const pedi = fresh({ ...base, demographicSubpop: 'pediatric' });
    const adult = fresh({ ...base, demographicSubpop: 'adult' });
    expect(pedi.riskAdjustedNPV).toBeGreaterThan(adult.riskAdjustedNPV);
  });
});
