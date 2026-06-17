import { computeAlertRelevance } from '@/lib/portfolio/alert-relevance';

describe('Alert relevance scoring', () => {
  describe('TA matching (max 40 points)', () => {
    test('exact TA match scores 40', () => {
      const result = computeAlertRelevance(
        { therapeutic_areas: ['oncology'] },
        { therapeutic_area: 'oncology' },
      );
      expect(result.factors.ta_match).toBe(40);
    });

    test('adjacent TA match scores 20', () => {
      const result = computeAlertRelevance(
        { therapeutic_areas: ['hematology'] },
        { therapeutic_area: 'oncology' },
      );
      expect(result.factors.ta_match).toBe(20);
    });

    test('no TA match scores 0', () => {
      const result = computeAlertRelevance(
        { therapeutic_areas: ['neurology'] },
        { therapeutic_area: 'oncology' },
      );
      expect(result.factors.ta_match).toBe(0);
    });

    test('no TA filter scores 25 (neutral)', () => {
      const result = computeAlertRelevance({}, { therapeutic_area: 'oncology' });
      expect(result.factors.ta_match).toBe(25);
    });
  });

  describe('Value matching (max 30 points)', () => {
    test('value within range scores 30', () => {
      const result = computeAlertRelevance(
        { min_value: 100_000_000 },
        { total_deal_value_usd: 200_000_000 },
      );
      expect(result.factors.value_match).toBe(30);
    });

    test('value below range but close scores 20', () => {
      const result = computeAlertRelevance(
        { min_value: 200_000_000 },
        { total_deal_value_usd: 120_000_000 },
      );
      expect(result.factors.value_match).toBe(20);
    });

    test('no value filter scores 15 (neutral)', () => {
      const result = computeAlertRelevance({}, { total_deal_value_usd: 100_000_000 });
      expect(result.factors.value_match).toBe(15);
    });
  });

  describe('Phase matching (max 20 points)', () => {
    test('exact phase match scores 20', () => {
      const result = computeAlertRelevance(
        { phases: ['phase2'] },
        { phase_at_signing: 'phase2' },
      );
      expect(result.factors.phase_match).toBe(20);
    });

    test('no phase match scores 8', () => {
      const result = computeAlertRelevance(
        { phases: ['phase3'] },
        { phase_at_signing: 'phase1' },
      );
      expect(result.factors.phase_match).toBe(8);
    });

    test('no phase filter scores 10 (neutral)', () => {
      const result = computeAlertRelevance({}, { phase_at_signing: 'phase2' });
      expect(result.factors.phase_match).toBe(10);
    });
  });

  describe('Modality matching (max 10 points)', () => {
    test('exact modality match scores 10', () => {
      const result = computeAlertRelevance(
        { modalities: ['adc'] },
        { modality: 'adc' },
      );
      expect(result.factors.modality_match).toBe(10);
    });

    test('no modality match scores 3', () => {
      const result = computeAlertRelevance(
        { modalities: ['adc'] },
        { modality: 'smallMolecule' },
      );
      expect(result.factors.modality_match).toBe(3);
    });

    test('no modality filter scores 5 (neutral)', () => {
      const result = computeAlertRelevance({}, { modality: 'adc' });
      expect(result.factors.modality_match).toBe(5);
    });
  });

  describe('Total score', () => {
    test('perfect match scores 100', () => {
      const result = computeAlertRelevance(
        { therapeutic_areas: ['oncology'], min_value: 100_000_000, phases: ['phase2'], modalities: ['adc'] },
        { therapeutic_area: 'oncology', total_deal_value_usd: 200_000_000, phase_at_signing: 'phase2', modality: 'adc' },
      );
      expect(result.score).toBe(100);
    });

    test('empty filters produce neutral mid-range score', () => {
      const result = computeAlertRelevance({}, {});
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThanOrEqual(60);
    });

    test('score never exceeds 100', () => {
      const result = computeAlertRelevance(
        { therapeutic_areas: ['oncology'], min_value: 1, phases: ['phase2'], modalities: ['adc'] },
        { therapeutic_area: 'oncology', total_deal_value_usd: 999_999_999, phase_at_signing: 'phase2', modality: 'adc' },
      );
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('factors object is always populated', () => {
      const result = computeAlertRelevance({}, {});
      expect(result.factors).toHaveProperty('ta_match');
      expect(result.factors).toHaveProperty('value_match');
      expect(result.factors).toHaveProperty('phase_match');
      expect(result.factors).toHaveProperty('modality_match');
    });
  });
});
