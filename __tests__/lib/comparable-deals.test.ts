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
