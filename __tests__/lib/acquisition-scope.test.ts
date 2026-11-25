/**
 * Acquisition scope: a single-asset purchase is priced like a discounted license (small closing payment, milestone
 * heavy), not like a whole-company buyout. Calibration: ASSET_PURCHASE_FACTOR in lib/calculations.ts.
 */
import { calculateDealTerms, ASSET_PURCHASE_FACTOR, type CalculationInput } from '@/lib/calculations';

const base = {
  therapeuticArea: 'oncology', phase: 'phase2', modality: 'peptide', indication: 'prostate', territory: 'global',
  biomarker: 'unselected', lineOfTherapy: '2L', dataQuality: 'promising', competitivePosition: 'racing',
  combinationPotential: 'standalone', treatmentApproach: 'symptomatic',
  regulatoryDesignations: { prime: false, orphan: false, fastTrack: false, breakthrough: false },
} as unknown as CalculationInput;

const run = (extra: Partial<CalculationInput>) => calculateDealTerms({ ...base, ...extra } as CalculationInput);

describe('acquisition scope', () => {
  it('defaults to a whole-company acquisition (unchanged pricing)', () => {
    const implicit = run({ dealType: 'acquisition' });
    const company = run({ dealType: 'acquisition', acquisitionScope: 'company' });
    expect(implicit.terms.upfront).toEqual(company.terms.upfront);
    expect(implicit.terms.totalDealValue).toEqual(company.terms.totalDealValue);
  });

  it('prices an asset purchase at a fraction of license value with license-like structure', () => {
    const lic = run({ dealType: 'licensing' });
    const asset = run({ dealType: 'acquisition', acquisitionScope: 'asset' });
    const ratio = asset.terms.totalDealValue.median / lic.terms.totalDealValue.median;
    expect(ratio).toBeGreaterThan(ASSET_PURCHASE_FACTOR * 0.8);
    expect(ratio).toBeLessThan(ASSET_PURCHASE_FACTOR * 1.25);
    // Closing payment is a minority of the price, as in licensing.
    expect(asset.terms.upfront.median).toBeLessThan(asset.terms.totalDealValue.median * 0.5);
  });

  it('prices an asset purchase far below a company buyout of the same program', () => {
    const company = run({ dealType: 'acquisition', acquisitionScope: 'company' });
    const asset = run({ dealType: 'acquisition', acquisitionScope: 'asset' });
    expect(asset.terms.upfront.median).toBeLessThan(company.terms.upfront.median / 10);
  });

  it('labels the result as an asset purchase, not M&A with CVRs', () => {
    const asset = run({ dealType: 'acquisition', acquisitionScope: 'asset' });
    expect(asset.dealTypeLabels?.dealTypeDisplay).toBe('Asset purchase');
    expect(asset.dealTypeLabels?.devMilestoneLabel).toBe('Development Milestones');
    expect(asset.modifiers.some(m => m.name === 'Asset purchase')).toBe(true);
    expect(asset.modifiers.some(m => m.name === 'Acquisition / M&A')).toBe(false);
    expect(asset.dealRecommendation.rationale).toMatch(/single asset/);
  });

  it('ignores the scope for non-acquisition deal types', () => {
    const lic = run({ dealType: 'licensing' });
    const licWithScope = run({ dealType: 'licensing', acquisitionScope: 'asset' });
    expect(licWithScope.terms.upfront).toEqual(lic.terms.upfront);
  });
});
