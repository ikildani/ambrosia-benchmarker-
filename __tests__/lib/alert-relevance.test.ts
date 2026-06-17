/**
 * Unit tests for lib/portfolio/alert-relevance.ts
 *
 * Tests the pure computeAlertRelevance function:
 * - TA match scoring (exact, adjacent, empty)
 * - Value range scoring
 * - Phase match scoring
 * - Modality match scoring
 * - Total score cap at 100
 * - Empty filters produce neutral mid-range scores
 */

import { computeAlertRelevance } from '@/lib/portfolio/alert-relevance';

describe('Alert relevance scoring', () => {
  // ═════════════════════════════════════════════════════════════════════════
  // TA Match (max 40 points)
  // ═════════════════════════════════════════════════════════════════════════

  describe('TA matching (max 40 points)', () => {
    test('exact TA match scores 40', () => {
      const result = computeAlertRelevance(
        { therapeutic_areas: ['oncology'] },
        { therapeutic_area: 'oncology' },
      );
      expect(result.factors.ta_match).toBe(40);
    });

    test('adjacent TA match scores 20', () => {
      // hematology and oncology are adjacent per TA_ADJACENCY
      const result = computeAlertRelevance(
        { therapeutic_areas: ['hematology'] },
        { therapeutic_area: 'oncology' },
      );
      expect(result.factors.ta_match).toBe(20);
    });

    test('non-matching, non-adjacent TA scores 0', () => {
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

    test('deal with no TA and filter present scores 25 (neutral)', () => {
      const result = computeAlertRelevance(
        { therapeutic_areas: ['oncology'] },
        {},
      );
      expect(result.factors.ta_match).toBe(25);
    });

    test('both empty TA filter and deal TA score 25 (neutral)', () => {
      const result = computeAlertRelevance({}, {});
      expect(result.factors.ta_match).toBe(25);
    });

    test('matches against any of multiple filter TAs', () => {
      const result = computeAlertRelevance(
        { therapeutic_areas: ['neurology', 'immunology', 'oncology'] },
        { therapeutic_area: 'immunology' },
      );
      expect(result.factors.ta_match).toBe(40);
    });

    test('picks up adjacency across multiple filter TAs', () => {
      // neurology is adjacent to rareDisease
      const result = computeAlertRelevance(
        { therapeutic_areas: ['neurology', 'oncology'] },
        { therapeutic_area: 'rareDisease' },
      );
      expect(result.factors.ta_match).toBe(20);
    });

    test('TA with no adjacencies scores 0 against unrelated filter', () => {
      // ophthalmology has empty adjacency list
      const result = computeAlertRelevance(
        { therapeutic_areas: ['oncology'] },
        { therapeutic_area: 'ophthalmology' },
      );
      expect(result.factors.ta_match).toBe(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Value Match (max 30 points)
  // ═════════════════════════════════════════════════════════════════════════

  describe('Value matching (max 30 points)', () => {
    test('value within range (0.8x-5.0x) scores 30', () => {
      const result = computeAlertRelevance(
        { min_value: 100_000_000 },
        { total_deal_value_usd: 200_000_000 },
      );
      expect(result.factors.value_match).toBe(30);
    });

    test('value at lower boundary (0.8x) scores 30', () => {
      const result = computeAlertRelevance(
        { min_value: 100 },
        { total_deal_value_usd: 80 },
      );
      expect(result.factors.value_match).toBe(30);
    });

    test('value at upper boundary (5.0x) scores 30', () => {
      const result = computeAlertRelevance(
        { min_value: 100 },
        { total_deal_value_usd: 500 },
      );
      expect(result.factors.value_match).toBe(30);
    });

    test('value between 0.5x and 0.8x scores 20', () => {
      const result = computeAlertRelevance(
        { min_value: 200_000_000 },
        { total_deal_value_usd: 120_000_000 },
      );
      expect(result.factors.value_match).toBe(20);
    });

    test('value below 0.5x but above 0 scores 10', () => {
      const result = computeAlertRelevance(
        { min_value: 100 },
        { total_deal_value_usd: 10 },
      );
      expect(result.factors.value_match).toBe(10);
    });

    test('no value filter scores 15 (neutral)', () => {
      const result = computeAlertRelevance({}, { total_deal_value_usd: 100_000_000 });
      expect(result.factors.value_match).toBe(15);
    });

    test('deal with no value and filter present scores 15 (neutral)', () => {
      const result = computeAlertRelevance({ min_value: 100 }, {});
      expect(result.factors.value_match).toBe(15);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Phase Match (max 20 points)
  // ═════════════════════════════════════════════════════════════════════════

  describe('Phase matching (max 20 points)', () => {
    test('exact phase match scores 20', () => {
      const result = computeAlertRelevance(
        { phases: ['phase2'] },
        { phase_at_signing: 'phase2' },
      );
      expect(result.factors.phase_match).toBe(20);
    });

    test('case-insensitive phase match scores 20', () => {
      const result = computeAlertRelevance(
        { phases: ['phase 2'] },
        { phase_at_signing: 'Phase 2' },
      );
      expect(result.factors.phase_match).toBe(20);
    });

    test('whitespace-insensitive phase match scores 20', () => {
      const result = computeAlertRelevance(
        { phases: ['Phase  2'] },
        { phase_at_signing: 'Phase 2' },
      );
      expect(result.factors.phase_match).toBe(20);
    });

    test('non-matching phase scores 8', () => {
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

    test('deal with no phase and filter present scores 10 (neutral)', () => {
      const result = computeAlertRelevance({ phases: ['Phase 2'] }, {});
      expect(result.factors.phase_match).toBe(10);
    });

    test('matches any of multiple filter phases', () => {
      const result = computeAlertRelevance(
        { phases: ['Phase 1', 'Phase 2', 'Phase 3'] },
        { phase_at_signing: 'Phase 2' },
      );
      expect(result.factors.phase_match).toBe(20);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Modality Match (max 10 points)
  // ═════════════════════════════════════════════════════════════════════════

  describe('Modality matching (max 10 points)', () => {
    test('exact modality match scores 10', () => {
      const result = computeAlertRelevance(
        { modalities: ['adc'] },
        { modality: 'adc' },
      );
      expect(result.factors.modality_match).toBe(10);
    });

    test('case-insensitive modality match scores 10', () => {
      const result = computeAlertRelevance(
        { modalities: ['ADC'] },
        { modality: 'adc' },
      );
      expect(result.factors.modality_match).toBe(10);
    });

    test('non-matching modality scores 3', () => {
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

    test('deal with no modality and filter present scores 5 (neutral)', () => {
      const result = computeAlertRelevance({ modalities: ['mab'] }, {});
      expect(result.factors.modality_match).toBe(5);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Total Score
  // ═════════════════════════════════════════════════════════════════════════

  describe('Total score', () => {
    test('perfect match scores 100', () => {
      const result = computeAlertRelevance(
        { therapeutic_areas: ['oncology'], min_value: 100_000_000, phases: ['phase2'], modalities: ['adc'] },
        { therapeutic_area: 'oncology', total_deal_value_usd: 200_000_000, phase_at_signing: 'phase2', modality: 'adc' },
      );
      expect(result.score).toBe(100);
    });

    test('score is the sum of all factors', () => {
      const result = computeAlertRelevance(
        { therapeutic_areas: ['oncology'], min_value: 100, phases: ['Phase 2'], modalities: ['mab'] },
        { therapeutic_area: 'oncology', total_deal_value_usd: 300, phase_at_signing: 'Phase 2', modality: 'mab' },
      );
      expect(result.score).toBe(
        result.factors.ta_match +
        result.factors.value_match +
        result.factors.phase_match +
        result.factors.modality_match,
      );
    });

    test('empty filters produce neutral mid-range score (55)', () => {
      // No filters: 25 + 15 + 10 + 5 = 55
      const result = computeAlertRelevance({}, {});
      expect(result.score).toBe(55);
      expect(result.factors.ta_match).toBe(25);
      expect(result.factors.value_match).toBe(15);
      expect(result.factors.phase_match).toBe(10);
      expect(result.factors.modality_match).toBe(5);
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

    test('partial matches produce intermediate score', () => {
      // Adjacent TA (20) + neutral value (15) + non-matching phase (8) + neutral modality (5) = 48
      const result = computeAlertRelevance(
        { therapeutic_areas: ['oncology'], phases: ['Phase 3'] },
        { therapeutic_area: 'hematology', phase_at_signing: 'Phase 1' },
      );
      expect(result.factors.ta_match).toBe(20);
      expect(result.factors.value_match).toBe(15);
      expect(result.factors.phase_match).toBe(8);
      expect(result.factors.modality_match).toBe(5);
      expect(result.score).toBe(48);
    });
  });
});
