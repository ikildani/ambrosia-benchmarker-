/**
 * Unit Tests for Deal Flow Forecast Service
 *
 * These tests verify:
 * - All 12 therapeutic areas have 2026Q1 data
 * - Forecast generates future quarters correctly
 * - Historical data is in chronological order
 * - Forecast output structure and reasonableness
 * - Prediction intervals: low <= predicted <= high
 * - Value forecasts are positive
 * - dataQuality and forecastReliability fields are present
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
  'rareDisease',
  'hematology',
  'dermatology',
  'gastroenterology',
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

    it('should have all 12 therapeutic areas with 2026Q1 data', async () => {
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

      // Last complete historical quarter is Q4 2025 (Q1 2026 is partial and excluded
      // from regression), so forecast starts at Q1 2026
      expect(result.forecast[0].quarter).toBe('Q1 2026');
      expect(result.forecast[1].quarter).toBe('Q2 2026');
      expect(result.forecast[2].quarter).toBe('Q3 2026');
      expect(result.forecast[3].quarter).toBe('Q4 2026');
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
  // Prediction Intervals
  // ============================================================
  describe('prediction intervals', () => {
    it.each(ALL_THERAPEUTIC_AREAS)(
      'should have low <= predicted <= high for deal counts in %s',
      async (therapeuticArea) => {
        const result = await forecastDealFlow(therapeuticArea);

        result.forecast.forEach((f) => {
          expect(f.predictedDealsLow).toBeDefined();
          expect(f.predictedDealsHigh).toBeDefined();
          expect(f.predictedDealsLow!).toBeLessThanOrEqual(f.predictedDeals);
          expect(f.predictedDealsHigh!).toBeGreaterThanOrEqual(f.predictedDeals);
        });
      }
    );

    it.each(ALL_THERAPEUTIC_AREAS)(
      'should have positive value forecasts for %s',
      async (therapeuticArea) => {
        const result = await forecastDealFlow(therapeuticArea);

        result.forecast.forEach((f) => {
          expect(f.predictedValueM).toBeDefined();
          expect(f.predictedValueM!).toBeGreaterThan(0);
          expect(f.predictedValueMLow).toBeDefined();
          expect(f.predictedValueMLow!).toBeGreaterThan(0);
          expect(f.predictedValueMHigh).toBeDefined();
          expect(f.predictedValueMHigh!).toBeGreaterThan(0);
        });
      }
    );

    it.each(ALL_THERAPEUTIC_AREAS)(
      'should have low <= predicted <= high for deal values in %s',
      async (therapeuticArea) => {
        const result = await forecastDealFlow(therapeuticArea);

        result.forecast.forEach((f) => {
          expect(f.predictedValueMLow!).toBeLessThanOrEqual(f.predictedValueM!);
          expect(f.predictedValueMHigh!).toBeGreaterThanOrEqual(f.predictedValueM!);
        });
      }
    );
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
      expect(result.dataQuality).toBeDefined();
      expect(result.forecastReliability).toBeDefined();
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

    it('should have dataQuality as one of the valid values', async () => {
      const result = await forecastDealFlow('oncology');

      expect(['live', 'curated', 'proxy']).toContain(result.dataQuality);
    });

    it('should have a non-empty forecastReliability string', async () => {
      const result = await forecastDealFlow('oncology');

      expect(typeof result.forecastReliability).toBe('string');
      expect(result.forecastReliability.length).toBeGreaterThan(0);
    });

    it('should have curated dataQuality when no supabase client is provided', async () => {
      const result = await forecastDealFlow('oncology');

      expect(result.dataQuality).toBe('curated');
    });

    it('should have proxy dataQuality for unknown therapeutic areas', async () => {
      const result = await forecastDealFlow('unknownArea');

      expect(result.dataQuality).toBe('proxy');
    });
  });

  // ============================================================
  // Value Forecasting
  // ============================================================
  describe('value forecasting', () => {
    it('should include deal value forecasts in the narrative', async () => {
      const result = await forecastDealFlow('oncology');

      // Narrative should mention deal value
      expect(result.narrative).toMatch(/\$[\d.]+[BM]/);
    });

    it.each(ALL_THERAPEUTIC_AREAS)(
      'should produce valid value forecasts for %s',
      async (therapeuticArea) => {
        const result = await forecastDealFlow(therapeuticArea);

        result.forecast.forEach((f) => {
          expect(f.predictedValueM).toBeDefined();
          expect(typeof f.predictedValueM).toBe('number');
          expect(f.predictedValueM!).toBeGreaterThan(0);
          expect(Number.isFinite(f.predictedValueM!)).toBe(true);
        });
      }
    );
  });

  // ============================================================
  // All 12 TAs Produce Valid Forecasts
  // ============================================================
  describe('comprehensive TA validation', () => {
    it.each(ALL_THERAPEUTIC_AREAS)(
      'should produce a complete, valid forecast for %s',
      async (therapeuticArea) => {
        const result = await forecastDealFlow(therapeuticArea);

        // Structural completeness
        expect(result.therapeuticArea).toBe(therapeuticArea);
        expect(result.historicalQuarters.length).toBeGreaterThanOrEqual(16);
        expect(result.forecast).toHaveLength(4);
        expect(['accelerating', 'stable', 'decelerating']).toContain(result.trend);
        expect(['hot', 'warm', 'neutral', 'cooling']).toContain(result.marketSentiment);
        expect(result.narrative.length).toBeGreaterThan(50);
        expect(['live', 'curated', 'proxy']).toContain(result.dataQuality);
        expect(result.forecastReliability.length).toBeGreaterThan(0);

        // Forecast reasonableness
        result.forecast.forEach((f) => {
          expect(f.predictedDeals).toBeGreaterThanOrEqual(1);
          expect(f.confidence).toBeGreaterThanOrEqual(0.35);
          expect(f.confidence).toBeLessThanOrEqual(1);
          expect(f.predictedDealsLow!).toBeLessThanOrEqual(f.predictedDeals);
          expect(f.predictedDealsHigh!).toBeGreaterThanOrEqual(f.predictedDeals);
          expect(f.predictedValueM!).toBeGreaterThan(0);
          expect(f.predictedValueMLow!).toBeLessThanOrEqual(f.predictedValueM!);
          expect(f.predictedValueMHigh!).toBeGreaterThanOrEqual(f.predictedValueM!);
        });
      }
    );
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
