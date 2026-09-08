import {
  findComparableDeals,
  getRelevantDeals,
  COMPARABLE_DEALS,
} from '@/lib/comparableDeals';

describe('comparableDeals module', () => {
  describe('COMPARABLE_DEALS', () => {
    it('is a non-empty array of curated deals', () => {
      expect(Array.isArray(COMPARABLE_DEALS)).toBe(true);
      expect(COMPARABLE_DEALS.length).toBeGreaterThan(0);
    });
  });

  describe('findComparableDeals', () => {
    it('returns results for oncology + smallMolecule', () => {
      const results = findComparableDeals({
        therapeuticArea: 'oncology',
        modality: 'smallMolecule',
        indication: 'solid tumors',
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns results for neurology + geneTherapy', () => {
      const results = findComparableDeals({
        therapeuticArea: 'neurology',
        modality: 'geneTherapy',
        indication: 'neurodegeneration',
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns results for immunology + mab', () => {
      const results = findComparableDeals({
        therapeuticArea: 'immunology',
        modality: 'mab',
        indication: 'autoimmune',
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty array when no matches (nonsense TA)', () => {
      const results = findComparableDeals({
        therapeuticArea: 'xyzNonsenseArea',
        modality: 'xyzNonsenseModality',
        indication: 'xyzNonsenseIndication',
      });
      expect(results).toEqual([]);
    });

    it('respects maxDeals limit', () => {
      const limit = 2;
      const results = findComparableDeals(
        {
          therapeuticArea: 'oncology',
          modality: 'smallMolecule',
          indication: 'solid tumors',
        },
        limit,
      );
      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it('returned objects have the correct shape', () => {
      const results = findComparableDeals({
        therapeuticArea: 'oncology',
        modality: 'smallMolecule',
        indication: 'solid tumors',
      });

      expect(results.length).toBeGreaterThan(0);

      for (const deal of results) {
        expect(deal).toHaveProperty('id');
        expect(deal).toHaveProperty('parties');
        expect(deal).toHaveProperty('totalValue');
        expect(deal).toHaveProperty('year');
        expect(deal).toHaveProperty('relevanceReasons');

        expect(typeof deal.id).toBe('string');
        expect(typeof deal.parties).toBe('string');
        expect(typeof deal.totalValue).toBe('string');
        expect(typeof deal.year).toBe('number');
        expect(Array.isArray(deal.relevanceReasons)).toBe(true);
        expect(deal.relevanceReasons.length).toBeGreaterThan(0);
        for (const reason of deal.relevanceReasons) {
          expect(typeof reason).toBe('string');
        }
      }
    });
  });

  describe('getRelevantDeals', () => {
    it('returns deals for oncology', () => {
      const results = getRelevantDeals('oncology');
      expect(results.length).toBeGreaterThan(0);
      // Every returned deal should be from oncology or broadly relevant
    });

    it('returns deals for neurology with modality filter', () => {
      const results = getRelevantDeals('neurology', 'geneTherapy');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns deals matching a specific indication', () => {
      // Pick a known indication from a curated deal to ensure a match
      const knownDeal = COMPARABLE_DEALS[0];
      const results = getRelevantDeals(
        knownDeal.therapeuticArea,
        undefined,
        knownDeal.indications?.[0],
      );
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty array for unknown TA', () => {
      const results = getRelevantDeals('totallyFakeTherapeuticArea');
      expect(results).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Shared comp scoring — weight table, pass threshold, relaxation ladder,
// stage/structure sanity filter (lib/comparable-scoring.ts)
// ---------------------------------------------------------------------------

import {
  scoreCompMatch,
  passesStrict,
  selectWithRelaxation,
  shouldExcludeForStage,
  computeCompStats,
  COMP_MATCH_WEIGHTS,
  COMP_MAX_SCORE,
} from '@/lib/comparable-scoring';
import { getClosestComparablesWithMeta } from '@/lib/peer-benchmark';

describe('comparable-scoring weight table', () => {
  const query = { therapeuticArea: 'oncology', phase: 'phase2', modality: 'smallMolecule', indication: 'pancreatic', dealType: 'licensing' };
  const Y = 2020; // fixed year so recency is 0

  it('phase (4) outranks modality (3); adjacent phase scores 2', () => {
    expect(COMP_MATCH_WEIGHTS.phase).toBeGreaterThan(COMP_MATCH_WEIGHTS.modality);
    const samePhase = scoreCompMatch(query, { therapeuticArea: 'oncology', phase: 'phase_2', modalities: ['mab'], year: Y }, { currentYear: 2026 });
    const sameModality = scoreCompMatch(query, { therapeuticArea: 'oncology', phase: 'approved', modalities: ['smallMolecule'], year: Y }, { currentYear: 2026 });
    const adjacent = scoreCompMatch(query, { therapeuticArea: 'oncology', phase: 'phase_3', modalities: ['mab'], year: Y }, { currentYear: 2026 });
    expect(samePhase.score).toBe(3 + 4);
    expect(sameModality.score).toBe(3 + 3);
    expect(adjacent.score).toBe(3 + 2);
    expect(samePhase.score).toBeGreaterThan(sameModality.score);
  });

  it('accepts calculator and DB phase spellings interchangeably', () => {
    const a = scoreCompMatch({ therapeuticArea: 'oncology', phase: 'phase2' }, { therapeuticArea: 'oncology', phase: 'phase_2', year: Y }, { currentYear: 2026 });
    const b = scoreCompMatch({ therapeuticArea: 'oncology', phase: 'phase_2' }, { therapeuticArea: 'oncology', phase: 'phase2', year: Y }, { currentYear: 2026 });
    expect(a.breakdown.phase).toBe(true);
    expect(b.breakdown.phase).toBe(true);
  });

  it('full match totals COMP_MAX_SCORE (18) with current-year recency and verification', () => {
    const r = scoreCompMatch(query, {
      therapeuticArea: 'oncology', phase: 'phase_2', modalities: ['smallMolecule'],
      indications: ['gi', 'pancreatic'], dealType: 'license', year: 2026, verified: true,
    }, { currentYear: 2026 });
    expect(r.score).toBe(COMP_MAX_SCORE);
    expect(r.normalized).toBe(1);
  });

  it('an unverified deal scores one point below an otherwise identical verified one', () => {
    const base = {
      therapeuticArea: 'oncology', phase: 'phase_2', modalities: ['smallMolecule'],
      indications: ['gi', 'pancreatic'], dealType: 'license', year: 2026,
    };
    const verified = scoreCompMatch(query, { ...base, verified: true }, { currentYear: 2026 });
    const unverified = scoreCompMatch(query, { ...base, verified: false }, { currentYear: 2026 });
    expect(verified.score - unverified.score).toBe(1);
    expect(verified.breakdown.verified).toBe(true);
    expect(unverified.breakdown.verified).toBeFalsy();
  });
});

describe('comparable-scoring pass threshold + relaxation ladder', () => {
  const q = { therapeuticArea: 'oncology', phase: 'phase2', modality: 'smallMolecule', indication: 'pancreatic' };
  const mk = (over: Record<string, unknown>) => scoreCompMatch(q, { therapeuticArea: 'oncology', phase: 'approved', modalities: ['mab'], year: 2020, ...over }, { currentYear: 2026 }).breakdown;

  it('modality-only match does NOT pass the strict rule; TA + phase / adjacent / indication do', () => {
    expect(passesStrict(mk({ modalities: ['smallMolecule'] }))).toBe(false);
    expect(passesStrict(mk({ phase: 'phase_2' }))).toBe(true);
    expect(passesStrict(mk({ phase: 'phase_3' }))).toBe(true);
    expect(passesStrict(mk({ indications: ['pancreatic'] }))).toBe(true);
    expect(passesStrict(mk({ therapeuticArea: 'neurology', phase: 'phase_2' }))).toBe(false);
  });

  it('stays strict when >= 5 deals pass', () => {
    const items = Array.from({ length: 5 }, () => ({ b: mk({ phase: 'phase_2' }) }))
      .concat([{ b: mk({ modalities: ['smallMolecule'] }) }]);
    const { items: out, relaxation } = selectWithRelaxation(items, i => i.b);
    expect(relaxation).toBe('none');
    expect(out).toHaveLength(5);
  });

  it('relaxes to modality_only, then ta_only, when the strict pool is thin', () => {
    const thin = [
      { b: mk({ phase: 'phase_2' }) },
      { b: mk({ modalities: ['smallMolecule'] }) },
      { b: mk({ modalities: ['smallMolecule'] }) },
      { b: mk({ modalities: ['smallMolecule'] }) },
      { b: mk({ modalities: ['smallMolecule'] }) },
      { b: mk({}) }, // TA only
    ];
    const r1 = selectWithRelaxation(thin, i => i.b);
    expect(r1.relaxation).toBe('modality_only');
    expect(r1.items).toHaveLength(5);

    const thinner = thin.slice(0, 3).concat([{ b: mk({}) }, { b: mk({}) }, { b: mk({}) }]);
    const r2 = selectWithRelaxation(thinner, i => i.b);
    expect(r2.relaxation).toBe('ta_only');
    expect(r2.items).toHaveLength(6);
  });
});

describe('comparable-scoring stage/structure sanity filter', () => {
  it('excludes approved-stage acquisitions/mergers for pre-approval queries only', () => {
    expect(shouldExcludeForStage('phase2', 'approved', 'acquisition')).toBe(true);
    expect(shouldExcludeForStage('phase2', 'approved', 'merger')).toBe(true);
    expect(shouldExcludeForStage('nda_filed', 'approved', 'acquisition')).toBe(true);
    expect(shouldExcludeForStage('phase2', 'approved', 'licensing')).toBe(false);
    expect(shouldExcludeForStage('phase2', 'phase_3', 'acquisition')).toBe(false);
    expect(shouldExcludeForStage('approved', 'approved', 'acquisition')).toBe(false);
  });

  it('computeCompStats reports p5/p95 and n so one outlier cannot flatten the bar', () => {
    const values = [...Array.from({ length: 19 }, (_, i) => 10 + i), 74_000];
    const s = computeCompStats(values)!;
    expect(s.n).toBe(20);
    expect(s.max).toBe(74_000);
    expect(s.p95).toBeLessThan(74_000);
    expect(s.p5).toBeGreaterThanOrEqual(s.min);
  });
});

describe('peer-benchmark getClosestComparablesWithMeta', () => {
  it('returns no approved-stage acquisitions for a Phase 2 candidate and ranks same-phase first', () => {
    const { deals, relaxation } = getClosestComparablesWithMeta({
      therapeuticArea: 'oncology', phase: 'phase2', modality: 'smallMolecule', dealType: 'licensing', limit: 20,
    });
    expect(deals.length).toBeGreaterThan(0);
    expect(['none', 'modality_only', 'ta_only']).toContain(relaxation);
    for (const d of deals) {
      expect(d.phase === 'approved' && d.dealType === 'acquisition').toBe(false);
    }
    // Scores are non-increasing (sorted best-first)
    for (let i = 1; i < deals.length; i++) {
      expect(deals[i].matchScore).toBeLessThanOrEqual(deals[i - 1].matchScore);
    }
  });
});
