/**
 * Patent Cliffs (Tier 4 Item 14) — acceptance tests.
 */

import {
  PATENT_CLIFFS_STATIC,
  getPatentCliffs,
  getPatentCliffLeader,
  getPatentCliffAdjustment,
  __resetPatentCliffsCacheForTests,
} from '@/lib/financial/patent-cliffs';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import type { RNPVInput } from '@/lib/financial/types';

describe('patent-cliffs — static registry', () => {
  test('every entry has valid years (loe ≤ biosimilar)', () => {
    for (const list of Object.values(PATENT_CLIFFS_STATIC)) {
      for (const c of list) {
        expect(c.loeYear).toBeLessThanOrEqual(c.biosimilarYear);
        expect(c.loeYear).toBeGreaterThanOrEqual(2020);
        expect(c.biosimilarYear).toBeLessThanOrEqual(2055);
      }
    }
  });

  test('every indication has ≥1 rank-1 leader', () => {
    for (const [indication, list] of Object.entries(PATENT_CLIFFS_STATIC)) {
      const hasLeader = list.some(c => c.rank === 1);
      expect(hasLeader).toBe(true);
    }
  });

  test('every entry has non-empty source citation', () => {
    for (const list of Object.values(PATENT_CLIFFS_STATIC)) {
      for (const c of list) {
        expect(c.source.length).toBeGreaterThan(0);
        expect(c.currentRevenueUsdM).toBeGreaterThan(0);
      }
    }
  });
});

describe('patent-cliffs — resolver', () => {
  beforeEach(() => {
    __resetPatentCliffsCacheForTests();
  });

  test('getPatentCliffLeader returns rank-1 entry', () => {
    const leader = getPatentCliffLeader('lung_nsclc');
    expect(leader?.drug).toBe('Keytruda');
    expect(leader?.rank).toBe(1);
  });

  test('getPatentCliffs returns empty array for unknown indication', () => {
    expect(getPatentCliffs('made_up_indication')).toEqual([]);
    expect(getPatentCliffLeader('made_up_indication')).toBeNull();
  });
});

describe('patent-cliffs — launch timing adjustment', () => {
  beforeEach(() => {
    __resetPatentCliffsCacheForTests();
  });

  test('launching well before Keytruda LOE (2028) gets headwind', () => {
    // launchYear 2024 → gap = -4 → scenario preLoeCrowded, mult 0.88
    const r = getPatentCliffAdjustment('lung_nsclc', 2024);
    expect(r.scenario).toBe('preLoeCrowded');
    expect(r.multiplier).toBe(0.88);
    expect(r.leader?.drug).toBe('Keytruda');
  });

  test('launching 2y before LOE gets modest 5% headwind', () => {
    const r = getPatentCliffAdjustment('lung_nsclc', 2026);
    expect(r.scenario).toBe('preLoeApproaching');
    expect(r.multiplier).toBe(0.95);
  });

  test('launching in LOE-to-biosimilar window is neutral', () => {
    // Keytruda LOE 2028, biosimilar 2029 → launch 2028 = scenario atLoe
    const r = getPatentCliffAdjustment('lung_nsclc', 2028);
    expect(r.scenario).toBe('atLoe');
    expect(r.multiplier).toBe(1.00);
  });

  test('launching post-biosimilar ramp gets 15% boost', () => {
    // Keytruda biosimilar 2029, window 2029-2034 (5y) → launch 2030 boost
    const r = getPatentCliffAdjustment('lung_nsclc', 2030);
    expect(r.scenario).toBe('postBiosimilarBoost');
    expect(r.multiplier).toBe(1.15);
  });

  test('launching long after LOE gets stabilized 10% boost', () => {
    const r = getPatentCliffAdjustment('lung_nsclc', 2040);
    expect(r.scenario).toBe('postLoeBoost');
    expect(r.multiplier).toBe(1.10);
  });

  test('unknown indication returns noLeader neutral', () => {
    const r = getPatentCliffAdjustment('made_up_indication', 2030);
    expect(r.scenario).toBe('noLeader');
    expect(r.multiplier).toBe(1.0);
    expect(r.leader).toBeNull();
  });

  test('narrative is non-empty for every scenario', () => {
    const years = [2024, 2027, 2028, 2031, 2040];
    for (const y of years) {
      const r = getPatentCliffAdjustment('lung_nsclc', y);
      expect(r.narrative.length).toBeGreaterThan(20);
    }
  });
});

describe('Item 14 — engine integration', () => {
  const originalEnv = process.env.TIER4_PATENT_CLIFFS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TIER4_PATENT_CLIFFS;
    } else {
      process.env.TIER4_PATENT_CLIFFS = originalEnv;
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

  test('with flag off, patentCliffAdjustment is not attached', () => {
    delete process.env.TIER4_PATENT_CLIFFS;
    jest.resetModules();
    const { calculateRNPV: fresh } = require('@/lib/financial/rnpv-engine');
    const r = fresh(baseInput());
    expect(r.patentCliffAdjustment).toBeUndefined();
  });

  test('with flag on, known indication attaches patentCliffAdjustment', () => {
    process.env.TIER4_PATENT_CLIFFS = 'on';
    jest.resetModules();
    const { calculateRNPV: fresh } = require('@/lib/financial/rnpv-engine');
    const r = fresh(baseInput());
    expect(r.patentCliffAdjustment).toBeDefined();
    expect(r.patentCliffAdjustment?.leaderDrug).toBe('Keytruda');
    expect(r.patentCliffAdjustment?.loeYear).toBe(2028);
  });

  test('with flag on, unknown indication gets no patent cliff adjustment', () => {
    process.env.TIER4_PATENT_CLIFFS = 'on';
    jest.resetModules();
    const { calculateRNPV: fresh } = require('@/lib/financial/rnpv-engine');
    const r = fresh(baseInput({ indication: 'made_up_indication' }));
    expect(r.patentCliffAdjustment).toBeUndefined();
  });
});
