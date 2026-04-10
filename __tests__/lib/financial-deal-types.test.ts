/**
 * Deal-type structural component tests
 *
 * Verifies that co-development, option, and collaboration deal types produce
 * internally consistent deal value output with the new structural overlays:
 *   - codev: cost-sharing benefit surfaced and rolled into totalDeal
 *   - option: probability-weighted exercise fee surfaced
 *   - collaboration: FTE research funding + equity surfaced
 *
 * Covers the gap fix documented in the Apr 2026 "deal type logic" work stream.
 */

import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import type { RNPVInput } from '@/lib/financial/types';

const baseInput: RNPVInput = {
  phase: 'phase2',
  therapeuticArea: 'oncology',
  modality: 'adc',
  indication: 'lung_nsclc',
  territory: 'global',
  peakSalesEstimate: { low: 800, median: 1500, high: 2500 },
  competitivePosition: 'bestInClass',
  dataQuality: 'strongPhase2',
  regulatoryDesignations: { breakthrough: false, fastTrack: true, orphan: false, prime: false },
  biomarkerStatus: 'validated',
  companyType: 'biotech',
};

function monotonic(r: { low: number; median: number; high: number }): boolean {
  return r.low <= r.median && r.median <= r.high;
}

describe('Deal-type structural components', () => {
  // -------------------------------------------------------------------------
  // Baseline licensing — no structural components, establishes reference
  // -------------------------------------------------------------------------
  describe('licensing baseline', () => {
    it('produces no deal-type-specific components for plain licensing', () => {
      const r = calculateRNPV({ ...baseInput, dealType: 'licensing' });
      expect(r.impliedDealValue.codevCostSharing).toBeUndefined();
      expect(r.impliedDealValue.optionExerciseFee).toBeUndefined();
      expect(r.impliedDealValue.fteResearchValue).toBeUndefined();
      expect(r.impliedDealValue.equityInvestment).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Co-development
  // -------------------------------------------------------------------------
  describe('codevelopment', () => {
    it('surfaces cost-sharing benefit with default 50/50 split', () => {
      const r = calculateRNPV({ ...baseInput, dealType: 'codevelopment' });
      expect(r.impliedDealValue.codevCostSharing).toBeDefined();
      expect(r.impliedDealValue.codevCostSharing!.ratioLicensee).toBe(0.5);
      expect(r.impliedDealValue.codevCostSharing!.totalRDCost_M).toBeGreaterThan(0);
      expect(r.impliedDealValue.codevCostSharing!.sharedRDCost_M).toBeGreaterThan(0);
    });

    it('uses the provided costSharingRatio when supplied', () => {
      const r60 = calculateRNPV({ ...baseInput, dealType: 'codevelopment', costSharingRatio: 0.6 });
      const r50 = calculateRNPV({ ...baseInput, dealType: 'codevelopment', costSharingRatio: 0.5 });
      expect(r60.impliedDealValue.codevCostSharing!.ratioLicensee).toBe(0.6);
      expect(r60.impliedDealValue.codevCostSharing!.sharedRDCost_M)
        .toBeGreaterThan(r50.impliedDealValue.codevCostSharing!.sharedRDCost_M);
    });

    it('rolls cost-sharing benefit into totalDeal (codev total > licensing total)', () => {
      const codev = calculateRNPV({ ...baseInput, dealType: 'codevelopment' });
      const lic = calculateRNPV({ ...baseInput, dealType: 'licensing' });
      expect(codev.impliedDealValue.totalDeal.median)
        .toBeGreaterThan(lic.impliedDealValue.totalDeal.median);
    });

    it('preserves upfront ≤ totalDeal and monotonic ranges', () => {
      const r = calculateRNPV({ ...baseInput, dealType: 'codevelopment' });
      expect(r.impliedDealValue.upfront.median).toBeLessThanOrEqual(r.impliedDealValue.totalDeal.median);
      expect(monotonic(r.impliedDealValue.upfront)).toBe(true);
      expect(monotonic(r.impliedDealValue.totalDeal)).toBe(true);
    });

    it('clamps out-of-range cost share ratios to [0, 0.9]', () => {
      const rHigh = calculateRNPV({ ...baseInput, dealType: 'codevelopment', costSharingRatio: 1.5 });
      const rNeg = calculateRNPV({ ...baseInput, dealType: 'codevelopment', costSharingRatio: -0.2 });
      expect(rHigh.impliedDealValue.codevCostSharing!.ratioLicensee).toBeLessThanOrEqual(0.9);
      expect(rNeg.impliedDealValue.codevCostSharing!.ratioLicensee).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // Option
  // -------------------------------------------------------------------------
  describe('option', () => {
    it('surfaces a default exercise fee with phase-scaled probability', () => {
      const r = calculateRNPV({ ...baseInput, phase: 'phase1', dealType: 'option' });
      expect(r.impliedDealValue.optionExerciseFee).toBeDefined();
      expect(r.impliedDealValue.optionExerciseFee!.fee_M).toBeGreaterThan(0);
      // Phase 1 exercise probability is 50% per BIO 2024–2026 analysis
      expect(r.impliedDealValue.optionExerciseFee!.probability).toBe(0.5);
      expect(r.impliedDealValue.optionExerciseFee!.expectedValue_M)
        .toBeCloseTo(r.impliedDealValue.optionExerciseFee!.fee_M * 0.5, 0);
    });

    it('honors explicit optionExerciseFee override', () => {
      const r = calculateRNPV({
        ...baseInput, phase: 'phase1', dealType: 'option', optionExerciseFee: 30,
      });
      expect(r.impliedDealValue.optionExerciseFee!.fee_M).toBe(30);
    });

    it('exercise probability increases with phase', () => {
      const p1 = calculateRNPV({ ...baseInput, phase: 'phase1', dealType: 'option' });
      const p3 = calculateRNPV({ ...baseInput, phase: 'phase3', dealType: 'option' });
      expect(p3.impliedDealValue.optionExerciseFee!.probability)
        .toBeGreaterThan(p1.impliedDealValue.optionExerciseFee!.probability);
    });

    it('preserves upfront ≤ totalDeal and monotonic ranges', () => {
      const r = calculateRNPV({ ...baseInput, phase: 'phase1', dealType: 'option' });
      expect(r.impliedDealValue.upfront.median).toBeLessThanOrEqual(r.impliedDealValue.totalDeal.median);
      expect(monotonic(r.impliedDealValue.upfront)).toBe(true);
      expect(monotonic(r.impliedDealValue.totalDeal)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Collaboration
  // -------------------------------------------------------------------------
  describe('collaboration', () => {
    it('surfaces FTE research funding when provided', () => {
      const r = calculateRNPV({
        ...baseInput, phase: 'preclinical', dealType: 'collaboration',
        fteFunding: { fteCount: 10, costPerFTE_M: 1.0, yearsOfFunding: 4 },
      });
      expect(r.impliedDealValue.fteResearchValue).toBeDefined();
      expect(r.impliedDealValue.fteResearchValue!.fteCount).toBe(10);
      expect(r.impliedDealValue.fteResearchValue!.totalValue_M).toBe(40); // 10 × 1 × 4
    });

    it('surfaces equity investment when provided', () => {
      const r = calculateRNPV({
        ...baseInput, phase: 'preclinical', dealType: 'collaboration',
        equityInvestment: 25,
      });
      expect(r.impliedDealValue.equityInvestment).toBe(25);
    });

    it('rolls FTE + equity into totalDeal', () => {
      const withComponents = calculateRNPV({
        ...baseInput, phase: 'preclinical', dealType: 'collaboration',
        fteFunding: { fteCount: 10, costPerFTE_M: 1.0, yearsOfFunding: 4 },
        equityInvestment: 25,
      });
      const withoutComponents = calculateRNPV({
        ...baseInput, phase: 'preclinical', dealType: 'collaboration',
      });
      expect(withComponents.impliedDealValue.totalDeal.median)
        .toBeGreaterThan(withoutComponents.impliedDealValue.totalDeal.median);
    });

    it('omits FTE/equity fields when zero or missing', () => {
      const r = calculateRNPV({
        ...baseInput, phase: 'preclinical', dealType: 'collaboration',
      });
      expect(r.impliedDealValue.fteResearchValue).toBeUndefined();
      expect(r.impliedDealValue.equityInvestment).toBeUndefined();
    });

    it('preserves upfront ≤ totalDeal and monotonic ranges', () => {
      const r = calculateRNPV({
        ...baseInput, phase: 'preclinical', dealType: 'collaboration',
        fteFunding: { fteCount: 15, costPerFTE_M: 1.5, yearsOfFunding: 5 },
        equityInvestment: 50,
      });
      expect(r.impliedDealValue.upfront.median).toBeLessThanOrEqual(r.impliedDealValue.totalDeal.median);
      expect(monotonic(r.impliedDealValue.upfront)).toBe(true);
      expect(monotonic(r.impliedDealValue.totalDeal)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Cross-deal-type consistency
  // -------------------------------------------------------------------------
  describe('all deal types — global invariants', () => {
    const dealTypes = ['licensing', 'acquisition', 'codevelopment', 'option', 'collaboration'] as const;

    for (const dt of dealTypes) {
      it(`${dt}: upfront ≤ totalDeal across all range points`, () => {
        const r = calculateRNPV({ ...baseInput, dealType: dt });
        expect(r.impliedDealValue.upfront.low).toBeLessThanOrEqual(r.impliedDealValue.totalDeal.low);
        expect(r.impliedDealValue.upfront.median).toBeLessThanOrEqual(r.impliedDealValue.totalDeal.median);
        expect(r.impliedDealValue.upfront.high).toBeLessThanOrEqual(r.impliedDealValue.totalDeal.high);
      });

      it(`${dt}: ranges are monotonic (low ≤ median ≤ high)`, () => {
        const r = calculateRNPV({ ...baseInput, dealType: dt });
        expect(monotonic(r.impliedDealValue.upfront)).toBe(true);
        expect(monotonic(r.impliedDealValue.totalDeal)).toBe(true);
      });

      it(`${dt}: median deal values are finite positive`, () => {
        const r = calculateRNPV({ ...baseInput, dealType: dt });
        expect(Number.isFinite(r.impliedDealValue.upfront.median)).toBe(true);
        expect(Number.isFinite(r.impliedDealValue.totalDeal.median)).toBe(true);
        expect(r.impliedDealValue.upfront.median).toBeGreaterThan(0);
        expect(r.impliedDealValue.totalDeal.median).toBeGreaterThan(0);
      });
    }
  });
});
