/**
 * Unit Tests for Deal Flow Forecast Service
 *
 * These tests verify:
 * - All 8 therapeutic areas have 2026Q1 data
 * - Forecast generates future quarters correctly
 * - Historical data is in chronological order
 * - Forecast output structure and reasonableness
 */

// Access the HISTORICAL_DEAL_FLOW constant indirectly via the exported forecastDealFlow function
import { forecastDealFlow } from '@/lib/services/deal-flow-forecast';

const ALL_THERAPEUTIC_AREAS = [
  'oncology',
  'neurology',
  'immunology',
  'metabolic',
  'cardiovascular',
  'infectiousDisease',
  'ophthalmology',
  'womensHealth',
];

describe('deal-flow-forecast', () => {
  // ============================================================
  // 2026Q1 Data Presence
  // ============================================================
  describe('2026Q1 data coverage', () => {
    it.each(ALL_THERAPEUTIC_AREAS)(
      'should include 2026Q1 data for %s',
      async (therapeuticArea) => {
        const result = await forecastDealFlow(therapeuticArea);

        // Historical quarters should contain Q1 2026
        const has2026Q1 = result.historicalQuarters.some(
          (q) => q.quarter === 'Q1 2026'
        );
        expect(has2026Q1).toBe(true);
      }
    );

    it('should have all 8 therapeutic areas with 2026Q1 data', async () => {
      for (const ta of ALL_THERAPEUTIC_AREAS) {
        const result = await forecastDealFlow(ta);
        const has2026Q1 = result.historicalQuarters.some(
          (q) => q.quarter === 'Q1 2026'
        );
        expect(has2026Q1).toBe(true);
      }
    });
  });

  // ============================================================
  // Forecast Generation
  // ============================================================
  describe('forecast generation', () => {
    it('should generate exactly 4 forecast quarters', async () => {
      const result = await forecastDealFlow('oncology');

      expect(result.forecast).toHaveLength(4);
    });

    it('should generate future quarters after the last historical quarter', async () => {
      const result = await forecastDealFlow('oncology');

      // Last historical quarter is Q1 2026, so forecast should start at Q2 2026
      expect(result.forecast[0].quarter).toBe('Q2 2026');
      expect(result.forecast[1].quarter).toBe('Q3 2026');
      expect(result.forecast[2].quarter).toBe('Q4 2026');
      expect(result.forecast[3].quarter).toBe('Q1 2027');
    });

    it('should have positive predicted deals for all forecast quarters', async () => {
      const result = await forecastDealFlow('oncology');

      result.forecast.forEach((f) => {
        expect(f.predictedDeals).toBeGreaterThanOrEqual(1);
      });
    });

    it('should have confidence between 0 and 1 for all forecast quarters', async () => {
      const result = await forecastDealFlow('oncology');

      result.forecast.forEach((f) => {
        expect(f.confidence).toBeGreaterThanOrEqual(0);
        expect(f.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should have decreasing confidence for further-out quarters', async () => {
      const result = await forecastDealFlow('oncology');

      for (let i = 1; i < result.forecast.length; i++) {
        expect(result.forecast[i].confidence).toBeLessThanOrEqual(
          result.forecast[i - 1].confidence
        );
      }
    });
  });

  // ============================================================
  // Historical Data Order
  // ============================================================
  describe('historical data chronological order', () => {
    it.each(ALL_THERAPEUTIC_AREAS)(
      'should have historical quarters in chronological order for %s',
      async (therapeuticArea) => {
        const result = await forecastDealFlow(therapeuticArea);

        // Parse "Q1 2022" format into comparable values
        const parseQuarter = (q: string) => {
          const match = q.match(/Q(\d) (\d{4})/);
          if (!match) return 0;
          return parseInt(match[2]) * 10 + parseInt(match[1]);
        };

        for (let i = 1; i < result.historicalQuarters.length; i++) {
          const prev = parseQuarter(result.historicalQuarters[i - 1].quarter);
          const curr = parseQuarter(result.historicalQuarters[i].quarter);
          expect(curr).toBeGreaterThan(prev);
        }
      }
    );
  });

  // ============================================================
  // Output Structure
  // ============================================================
  describe('output structure', () => {
    it('should return all required fields', async () => {
      const result = await forecastDealFlow('oncology');

      expect(result.therapeuticArea).toBe('oncology');
      expect(result.historicalQuarters).toBeDefined();
      expect(result.forecast).toBeDefined();
      expect(result.trend).toBeDefined();
      expect(result.seasonalPattern).toBeDefined();
      expect(result.marketSentiment).toBeDefined();
      expect(result.narrative).toBeDefined();
    });

    it('should have trend as one of the valid values', async () => {
      const result = await forecastDealFlow('oncology');

      expect(['accelerating', 'stable', 'decelerating']).toContain(result.trend);
    });

    it('should have marketSentiment as one of the valid values', async () => {
      const result = await forecastDealFlow('oncology');

      expect(['hot', 'warm', 'neutral', 'cooling']).toContain(result.marketSentiment);
    });

    it('should have a non-empty narrative string', async () => {
      const result = await forecastDealFlow('oncology');

      expect(typeof result.narrative).toBe('string');
      expect(result.narrative.length).toBeGreaterThan(0);
    });

    it('should convert totalValue from $B to $M in historicalQuarters', async () => {
      const result = await forecastDealFlow('oncology');

      // The first oncology quarter is 2022Q1 with totalValue 12.5 ($B)
      // After conversion should be 12500 ($M)
      const firstQuarter = result.historicalQuarters[0];
      expect(firstQuarter.totalValue).toBe(12500);
    });

    it('should have positive dealCount and totalValue for all historical quarters', async () => {
      const result = await forecastDealFlow('oncology');

      result.historicalQuarters.forEach((q) => {
        expect(q.dealCount).toBeGreaterThan(0);
        expect(q.totalValue).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================
  // Fallback Behavior
  // ============================================================
  describe('fallback behavior', () => {
    it('should fall back to oncology data for unknown therapeutic area', async () => {
      const result = await forecastDealFlow('unknownArea');
      const oncologyResult = await forecastDealFlow('oncology');

      expect(result.historicalQuarters.length).toBe(oncologyResult.historicalQuarters.length);
      expect(result.historicalQuarters[0].dealCount).toBe(oncologyResult.historicalQuarters[0].dealCount);
    });
  });
});
