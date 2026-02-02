import {
  calculateDealTerms,
  formatCurrency,
  formatRange,
  CalculationInput,
  Phase,
  Modality,
  Indication,
  Territory,
} from '../lib/calculations';

describe('calculateDealTerms', () => {
  const baseInput: CalculationInput = {
    phase: 'phase2' as Phase,
    modality: 'smallMolecule' as Modality,
    indication: 'lung_nsclc' as Indication,
    territory: 'global' as Territory,
    biomarker: 'validated',
    lineOfTherapy: 'secondLine',
    combinationPotential: 'moderate',
    competitivePosition: 'bestInClass',
    dataQuality: 'promising',
    regulatoryDesignations: {
      fastTrack: false,
      breakthrough: false,
      orphan: false,
      acceleratedApproval: false,
      priorityReview: false,
    },
  };

  describe('basic calculations', () => {
    it('should return valid deal terms structure', () => {
      const result = calculateDealTerms(baseInput);

      expect(result).toHaveProperty('terms');
      expect(result).toHaveProperty('tieredRoyalties');
      expect(result).toHaveProperty('dealRecommendation');
      expect(result).toHaveProperty('negotiationInsight');
      expect(result).toHaveProperty('modifiers');
      expect(result).toHaveProperty('labels');
    });

    it('should return terms with low, median, and high values', () => {
      const result = calculateDealTerms(baseInput);

      expect(result.terms.upfront).toHaveProperty('low');
      expect(result.terms.upfront).toHaveProperty('median');
      expect(result.terms.upfront).toHaveProperty('high');
      expect(result.terms.totalDealValue).toHaveProperty('low');
      expect(result.terms.totalDealValue).toHaveProperty('median');
      expect(result.terms.totalDealValue).toHaveProperty('high');
    });

    it('should have low <= median <= high for all terms', () => {
      const result = calculateDealTerms(baseInput);

      expect(result.terms.upfront.low).toBeLessThanOrEqual(result.terms.upfront.median);
      expect(result.terms.upfront.median).toBeLessThanOrEqual(result.terms.upfront.high);
      expect(result.terms.totalDealValue.low).toBeLessThanOrEqual(result.terms.totalDealValue.median);
      expect(result.terms.totalDealValue.median).toBeLessThanOrEqual(result.terms.totalDealValue.high);
    });

    it('should return positive values for all monetary terms', () => {
      const result = calculateDealTerms(baseInput);

      expect(result.terms.upfront.low).toBeGreaterThan(0);
      expect(result.terms.upfront.median).toBeGreaterThan(0);
      expect(result.terms.upfront.high).toBeGreaterThan(0);
      expect(result.terms.totalDealValue.low).toBeGreaterThan(0);
      expect(result.terms.devMilestones.low).toBeGreaterThanOrEqual(0);
      expect(result.terms.regMilestones.low).toBeGreaterThanOrEqual(0);
      expect(result.terms.commMilestones.low).toBeGreaterThanOrEqual(0);
    });
  });

  describe('phase variations', () => {
    it('should return higher values for later phases', () => {
      const phase1Result = calculateDealTerms({ ...baseInput, phase: 'phase1' as Phase });
      const phase2Result = calculateDealTerms({ ...baseInput, phase: 'phase2' as Phase });
      const phase3Result = calculateDealTerms({ ...baseInput, phase: 'phase3' as Phase });

      expect(phase2Result.terms.totalDealValue.median).toBeGreaterThan(phase1Result.terms.totalDealValue.median);
      expect(phase3Result.terms.totalDealValue.median).toBeGreaterThan(phase2Result.terms.totalDealValue.median);
    });

    it('should return lower upfront percentage for earlier phases', () => {
      const phase1Result = calculateDealTerms({ ...baseInput, phase: 'phase1' as Phase });
      const phase3Result = calculateDealTerms({ ...baseInput, phase: 'phase3' as Phase });

      const phase1Ratio = phase1Result.terms.upfront.median / phase1Result.terms.totalDealValue.median;
      const phase3Ratio = phase3Result.terms.upfront.median / phase3Result.terms.totalDealValue.median;

      expect(phase3Ratio).toBeGreaterThan(phase1Ratio);
    });
  });

  describe('modality variations', () => {
    it('should return different values for different modalities', () => {
      const smallMolResult = calculateDealTerms({ ...baseInput, modality: 'smallMolecule' as Modality });
      const adcResult = calculateDealTerms({ ...baseInput, modality: 'adc' as Modality });
      const radioResult = calculateDealTerms({ ...baseInput, modality: 'radiopharmaceutical' as Modality });

      // ADC and Radiopharm typically command higher premiums
      expect(adcResult.terms.totalDealValue.median).not.toBe(smallMolResult.terms.totalDealValue.median);
      expect(radioResult.terms.totalDealValue.median).not.toBe(smallMolResult.terms.totalDealValue.median);
    });
  });

  describe('regulatory designations', () => {
    it('should increase values with breakthrough designation', () => {
      const withoutDesignation = calculateDealTerms(baseInput);
      const withBreakthrough = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: {
          ...baseInput.regulatoryDesignations,
          breakthrough: true,
        },
      });

      expect(withBreakthrough.terms.totalDealValue.median).toBeGreaterThan(
        withoutDesignation.terms.totalDealValue.median
      );
    });

    it('should have breakthrough modifier in modifiers list', () => {
      const result = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: {
          ...baseInput.regulatoryDesignations,
          breakthrough: true,
        },
      });

      const hasBreakthroughModifier = result.modifiers.some(
        (m) => m.name.toLowerCase().includes('breakthrough')
      );
      expect(hasBreakthroughModifier).toBe(true);
    });

    it('should stack multiple regulatory designations', () => {
      const singleDesignation = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: {
          fastTrack: true,
          breakthrough: false,
          orphan: false,
          acceleratedApproval: false,
          priorityReview: false,
        },
      });

      const multipleDesignations = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: {
          fastTrack: true,
          breakthrough: true,
          orphan: true,
          acceleratedApproval: false,
          priorityReview: false,
        },
      });

      expect(multipleDesignations.terms.totalDealValue.median).toBeGreaterThan(
        singleDesignation.terms.totalDealValue.median
      );
    });
  });

  describe('tiered royalties', () => {
    it('should have increasing royalty tiers', () => {
      const result = calculateDealTerms(baseInput);

      expect(result.tieredRoyalties.midTier.low).toBeGreaterThanOrEqual(result.tieredRoyalties.base.low);
      expect(result.tieredRoyalties.highTier.low).toBeGreaterThanOrEqual(result.tieredRoyalties.midTier.low);
    });

    it('should have royalties within reasonable bounds (0-35%)', () => {
      const result = calculateDealTerms(baseInput);

      expect(result.tieredRoyalties.base.low).toBeGreaterThanOrEqual(0);
      expect(result.tieredRoyalties.highTier.high).toBeLessThanOrEqual(35);
    });
  });

  describe('deal recommendation', () => {
    it('should have upfront + milestone = 100%', () => {
      const result = calculateDealTerms(baseInput);

      expect(result.dealRecommendation.upfrontPercent + result.dealRecommendation.milestonePercent).toBe(100);
    });

    it('should provide a rationale string', () => {
      const result = calculateDealTerms(baseInput);

      expect(typeof result.dealRecommendation.rationale).toBe('string');
      expect(result.dealRecommendation.rationale.length).toBeGreaterThan(0);
    });
  });

  describe('labels', () => {
    it('should return human-readable labels', () => {
      const result = calculateDealTerms(baseInput);

      expect(result.labels.phase).toBeTruthy();
      expect(result.labels.modality).toBeTruthy();
      expect(result.labels.indication).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('should handle preclinical phase (earliest valid phase)', () => {
      const result = calculateDealTerms({ ...baseInput, phase: 'preclinical' as Phase });

      expect(result.terms.totalDealValue.median).toBeGreaterThan(0);
      expect(result.terms.upfront.median).toBeGreaterThan(0);
    });

    it('should handle approved phase (latest valid phase)', () => {
      const result = calculateDealTerms({ ...baseInput, phase: 'approved' as Phase });

      expect(result.terms.totalDealValue.median).toBeGreaterThan(0);
      expect(result.terms.upfront.median).toBeGreaterThan(0);
    });

    it('should handle all designations enabled', () => {
      const result = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: {
          fastTrack: true,
          breakthrough: true,
          orphan: true,
          acceleratedApproval: true,
          priorityReview: true,
        },
      });

      expect(result.terms.totalDealValue.median).toBeGreaterThan(0);
      expect(result.modifiers.length).toBeGreaterThanOrEqual(5);
    });

    it('should not produce NaN or Infinity values', () => {
      const result = calculateDealTerms(baseInput);

      expect(Number.isFinite(result.terms.upfront.low)).toBe(true);
      expect(Number.isFinite(result.terms.upfront.median)).toBe(true);
      expect(Number.isFinite(result.terms.upfront.high)).toBe(true);
      expect(Number.isFinite(result.terms.totalDealValue.low)).toBe(true);
      expect(Number.isFinite(result.terms.totalDealValue.median)).toBe(true);
      expect(Number.isFinite(result.terms.totalDealValue.high)).toBe(true);
    });
  });
});

describe('formatCurrency', () => {
  it('should format millions correctly', () => {
    expect(formatCurrency(100)).toBe('$100M');
    expect(formatCurrency(500)).toBe('$500M');
    expect(formatCurrency(999)).toBe('$999M');
  });

  it('should format billions correctly', () => {
    expect(formatCurrency(1000)).toBe('$1.0B');
    expect(formatCurrency(1500)).toBe('$1.5B');
    expect(formatCurrency(2500)).toBe('$2.5B');
  });

  it('should handle edge cases', () => {
    expect(formatCurrency(0)).toBe('$0M');
    expect(formatCurrency(1)).toBe('$1M');
  });
});

describe('formatRange', () => {
  it('should format range with low and high values', () => {
    const range = { low: 100, median: 150, high: 200 };
    const formatted = formatRange(range);

    expect(formatted).toContain('$100M');
    expect(formatted).toContain('$200M');
    expect(formatted).toContain('-');
  });

  it('should format billion ranges correctly', () => {
    const range = { low: 1000, median: 1500, high: 2000 };
    const formatted = formatRange(range);

    expect(formatted).toContain('$1.0B');
    expect(formatted).toContain('$2.0B');
  });
});
