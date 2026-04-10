/**
 * Tests for lib/financial/deal-type-normalization.ts
 *
 * Validates the bridge between calculator enums and the deals table CHECK
 * constraints. These mappings are load-bearing for Tier 3: ensemble Method 2
 * (comparable filter) and counterparty premium grouping both rely on them.
 */

import {
  normalizeDealTypeForDB,
  normalizeDealTypeFromDB,
  normalizePhaseForDB,
  normalizePhaseFromDB,
  phaseWindowDB,
  phaseWindowCalculator,
} from '@/lib/financial/deal-type-normalization';
import type { DealType } from '@/lib/calculations';

describe('deal-type-normalization', () => {
  describe('normalizeDealTypeForDB', () => {
    it('maps licensing → license', () => {
      expect(normalizeDealTypeForDB('licensing')).toBe('license');
    });

    it('maps codevelopment → co_development', () => {
      expect(normalizeDealTypeForDB('codevelopment')).toBe('co_development');
    });

    it('preserves acquisition / option / collaboration', () => {
      expect(normalizeDealTypeForDB('acquisition')).toBe('acquisition');
      expect(normalizeDealTypeForDB('option')).toBe('option');
      expect(normalizeDealTypeForDB('collaboration')).toBe('collaboration');
    });

    it('round-trips for every DealType', () => {
      const dealTypes: DealType[] = ['licensing', 'acquisition', 'codevelopment', 'option', 'collaboration'];
      for (const dt of dealTypes) {
        const dbForm = normalizeDealTypeForDB(dt);
        const back = normalizeDealTypeFromDB(dbForm);
        expect(back).toBe(dt);
      }
    });
  });

  describe('normalizeDealTypeFromDB', () => {
    it('returns null for unknown DB values', () => {
      expect(normalizeDealTypeFromDB('co_promotion')).toBeNull();
      expect(normalizeDealTypeFromDB('other')).toBeNull();
      expect(normalizeDealTypeFromDB('unknown')).toBeNull();
    });

    it('returns null for null/undefined/empty', () => {
      expect(normalizeDealTypeFromDB(null)).toBeNull();
      expect(normalizeDealTypeFromDB(undefined)).toBeNull();
      expect(normalizeDealTypeFromDB('')).toBeNull();
    });

    it('is case-insensitive', () => {
      expect(normalizeDealTypeFromDB('LICENSE')).toBe('licensing');
      expect(normalizeDealTypeFromDB('Co_Development')).toBe('codevelopment');
    });

    it('accepts both DB form and calculator form (defensive)', () => {
      // Some legacy callers may pass calculator-form strings; handle gracefully.
      expect(normalizeDealTypeFromDB('licensing')).toBe('licensing');
      expect(normalizeDealTypeFromDB('codevelopment')).toBe('codevelopment');
    });
  });

  describe('normalizePhaseForDB', () => {
    it('maps simple phases without underscores', () => {
      expect(normalizePhaseForDB('phase1')).toBe('phase_1');
      expect(normalizePhaseForDB('phase2')).toBe('phase_2');
      expect(normalizePhaseForDB('phase3')).toBe('phase_3');
    });

    it('collapses compound phases to the higher discrete phase', () => {
      expect(normalizePhaseForDB('phase1_2')).toBe('phase_2');
      expect(normalizePhaseForDB('phase2_3')).toBe('phase_3');
    });

    it('maps nda_filed and bla_filed to phase_3', () => {
      expect(normalizePhaseForDB('nda_filed')).toBe('phase_3');
      expect(normalizePhaseForDB('bla_filed')).toBe('phase_3');
    });

    it('preserves discovery, preclinical, approved', () => {
      expect(normalizePhaseForDB('discovery')).toBe('discovery');
      expect(normalizePhaseForDB('preclinical')).toBe('preclinical');
      expect(normalizePhaseForDB('approved')).toBe('approved');
    });

    it('returns unknown for null/undefined/garbage', () => {
      expect(normalizePhaseForDB(null)).toBe('unknown');
      expect(normalizePhaseForDB(undefined)).toBe('unknown');
      expect(normalizePhaseForDB('garbage')).toBe('unknown');
    });
  });

  describe('normalizePhaseFromDB', () => {
    it('maps DB underscore form to calculator form', () => {
      expect(normalizePhaseFromDB('phase_1')).toBe('phase1');
      expect(normalizePhaseFromDB('phase_2')).toBe('phase2');
      expect(normalizePhaseFromDB('phase_3')).toBe('phase3');
    });

    it('maps DB phase_4 to approved (no calculator phase4)', () => {
      expect(normalizePhaseFromDB('phase_4')).toBe('approved');
    });

    it('handles early_phase_1', () => {
      expect(normalizePhaseFromDB('early_phase_1')).toBe('phase1');
    });

    it('returns unknown for unrecognized', () => {
      expect(normalizePhaseFromDB(null)).toBe('unknown');
      expect(normalizePhaseFromDB('not_applicable')).toBe('unknown');
    });
  });

  describe('phaseWindowDB', () => {
    it('returns ±1 window around phase_2', () => {
      const w = phaseWindowDB('phase_2', 1);
      expect(w).toEqual(['phase_1', 'phase_2', 'phase_3']);
    });

    it('respects ladder boundaries', () => {
      expect(phaseWindowDB('discovery', 1)).toEqual(['discovery', 'preclinical']);
      expect(phaseWindowDB('approved', 1)).toEqual(['phase_3', 'approved']);
    });

    it('window=0 returns just the phase', () => {
      expect(phaseWindowDB('phase_2', 0)).toEqual(['phase_2']);
    });

    it('window=2 spans 5 phases when interior', () => {
      const w = phaseWindowDB('phase_2', 2);
      expect(w).toEqual(['preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved']);
    });

    it('unknown returns just unknown', () => {
      expect(phaseWindowDB('unknown', 1)).toEqual(['unknown']);
    });
  });

  describe('phaseWindowCalculator', () => {
    it('widens around a calculator phase and converts back', () => {
      const w = phaseWindowCalculator('phase2', 1);
      expect(w).toContain('phase1');
      expect(w).toContain('phase2');
      expect(w).toContain('phase3');
    });

    it('works for compound phases (collapses then widens)', () => {
      // phase1_2 → phase_2 → window → ['phase_1','phase_2','phase_3']
      const w = phaseWindowCalculator('phase1_2', 1);
      expect(w).toEqual(['phase1', 'phase2', 'phase3']);
    });
  });
});
