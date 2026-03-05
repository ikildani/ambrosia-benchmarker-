import {
  calculateDealTerms,
  formatCurrency,
  formatRange,
  CalculationInput,
  Phase,
  Modality,
  Indication,
  Territory,
  BiomarkerStatus,
  LineOfTherapy,
  CombinationPotential,
  CompetitivePosition,
  DataQuality,
} from '../lib/calculations';

// Base input for consistent testing (same pattern as calculations.test.ts)
const baseInput: CalculationInput = {
  therapeuticArea: 'oncology',
  phase: 'phase2' as Phase,
  modality: 'smallMolecule' as Modality,
  indication: 'lung_nsclc' as Indication,
  territory: 'global' as Territory,
  biomarker: 'unselected' as BiomarkerStatus,
  lineOfTherapy: '2L' as LineOfTherapy,
  treatmentApproach: 'symptomatic',
  combinationPotential: 'some' as CombinationPotential,
  competitivePosition: 'racing' as CompetitivePosition,
  dataQuality: 'promising' as DataQuality,
  regulatoryDesignations: {
    fastTrack: false,
    breakthrough: false,
    orphan: false,
    prime: false,
  },
};

// ============================================================
// NaN / Infinity PROTECTION
// ============================================================
describe('NaN / Infinity protection', () => {
  it('should never produce NaN in any output field across all phases', () => {
    const phases: Phase[] = ['discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved'];

    for (const phase of phases) {
      const result = calculateDealTerms({ ...baseInput, phase });
      const fields = [
        result.terms.upfront.low, result.terms.upfront.median, result.terms.upfront.high,
        result.terms.totalDealValue.low, result.terms.totalDealValue.median, result.terms.totalDealValue.high,
        result.terms.devMilestones.low, result.terms.devMilestones.median, result.terms.devMilestones.high,
        result.terms.regMilestones.low, result.terms.regMilestones.median, result.terms.regMilestones.high,
        result.terms.commMilestones.low, result.terms.commMilestones.median, result.terms.commMilestones.high,
        result.tieredRoyalties.base.low, result.tieredRoyalties.base.high,
        result.tieredRoyalties.midTier.low, result.tieredRoyalties.midTier.high,
        result.tieredRoyalties.highTier.low, result.tieredRoyalties.highTier.high,
      ];
      for (const val of fields) {
        expect(Number.isNaN(val)).toBe(false);
      }
    }
  });

  it('should never produce Infinity in any output field across all phases', () => {
    const phases: Phase[] = ['discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved'];

    for (const phase of phases) {
      const result = calculateDealTerms({ ...baseInput, phase });
      const fields = [
        result.terms.upfront.low, result.terms.upfront.median, result.terms.upfront.high,
        result.terms.totalDealValue.low, result.terms.totalDealValue.median, result.terms.totalDealValue.high,
        result.tieredRoyalties.base.low, result.tieredRoyalties.base.high,
      ];
      for (const val of fields) {
        expect(Number.isFinite(val)).toBe(true);
      }
    }
  });

  it('should produce finite results even with maximum penalty multipliers stacked', () => {
    const result = calculateDealTerms({
      ...baseInput,
      phase: 'preclinical' as Phase,
      territory: 'china' as Territory,
      lineOfTherapy: '3L+' as LineOfTherapy,
      competitivePosition: 'crowded' as CompetitivePosition,
      dataQuality: 'limited' as DataQuality,
      combinationPotential: 'standalone' as CombinationPotential,
    });

    expect(Number.isFinite(result.terms.totalDealValue.median)).toBe(true);
    expect(Number.isFinite(result.terms.upfront.median)).toBe(true);
    expect(result.terms.totalDealValue.median).toBeGreaterThan(0);
  });
});

// ============================================================
// EXTREME MODALITY / INDICATION COMBINATIONS
// ============================================================
describe('extreme modality/indication combinations', () => {
  it('should handle gene therapy + rare neurology indication (cross-area modality)', () => {
    const result = calculateDealTerms({
      ...baseInput,
      therapeuticArea: 'neurology',
      modality: 'geneTherapy' as Modality,
      indication: 'rareNeuro' as Indication,
      treatmentApproach: 'diseaseModifying',
    });

    expect(result.terms.totalDealValue.median).toBeGreaterThan(0);
    expect(result.terms.totalDealValue.low).toBeLessThanOrEqual(result.terms.totalDealValue.median);
  });

  it('should handle CAR-T autoimmune + lupus in immunology', () => {
    const result = calculateDealTerms({
      ...baseInput,
      therapeuticArea: 'immunology',
      modality: 'carT_autoimmune' as Modality,
      indication: 'sle_lupus' as Indication,
      immuneResetPotential: 'curativeIntent',
      targetSpecificity: 'antigenSpecific',
      diseaseSeverity: 'refractory',
    });

    expect(result.terms.totalDealValue.median).toBeGreaterThan(0);
    expect(result.labels.modality).toBeTruthy();
    expect(result.labels.indication).toBeTruthy();
  });

  it('should handle triple incretin + obesity in metabolic', () => {
    const result = calculateDealTerms({
      ...baseInput,
      therapeuticArea: 'metabolic',
      modality: 'tripleIncretin' as Modality,
      indication: 'obesity' as Indication,
      mechanismDifferentiation: 'incretinBased',
      weightLossEfficacy: 'superiorEfficacy',
      routeOfAdministration: 'oral',
      comorbidityBreadth: 'cardiometabolicBenefit',
      metabolicTreatmentApproach: 'chronicWeightMgmt',
    });

    expect(result.terms.totalDealValue.median).toBeGreaterThan(0);
    expect(Number.isFinite(result.terms.totalDealValue.high)).toBe(true);
  });

  it('should handle psychedelic modality + PTSD in neurology', () => {
    const result = calculateDealTerms({
      ...baseInput,
      therapeuticArea: 'neurology',
      modality: 'psychedelic' as Modality,
      indication: 'ptsd' as Indication,
      treatmentApproach: 'diseaseModifying',
      bbbPenetration: 'provenCNS',
    });

    expect(result.terms.totalDealValue.median).toBeGreaterThan(0);
  });
});

// ============================================================
// ALL THERAPEUTIC AREAS RETURN VALID RESULTS
// ============================================================
describe('all therapeutic areas return valid results', () => {
  const areaConfigs: { area: string; modality: Modality; indication: Indication }[] = [
    { area: 'oncology', modality: 'adc' as Modality, indication: 'breast_her2' as Indication },
    { area: 'neurology', modality: 'smallMolecule' as Modality, indication: 'alzheimers' as Indication },
    { area: 'immunology', modality: 'mab' as Modality, indication: 'rheumatoidArthritis' as Indication },
    { area: 'metabolic', modality: 'glp1Agonist' as Modality, indication: 'obesity' as Indication },
  ];

  areaConfigs.forEach(({ area, modality, indication }) => {
    it(`should produce valid deal terms for ${area}`, () => {
      const result = calculateDealTerms({
        ...baseInput,
        therapeuticArea: area as 'oncology' | 'neurology' | 'immunology' | 'metabolic',
        modality,
        indication,
      });

      expect(result.terms.totalDealValue.median).toBeGreaterThan(0);
      expect(result.terms.upfront.median).toBeGreaterThan(0);
      expect(result.tieredRoyalties.base.low).toBeGreaterThanOrEqual(0);
      expect(result.dealRecommendation.upfrontPercent + result.dealRecommendation.milestonePercent).toBe(100);
      expect(result.negotiationInsight.length).toBeGreaterThan(0);
      expect(result.labels.phase).toBeTruthy();
      expect(result.labels.modality).toBeTruthy();
      expect(result.labels.indication).toBeTruthy();
    });
  });
});

// ============================================================
// formatCurrency EDGE CASES
// ============================================================
describe('formatCurrency edge cases', () => {
  it('should handle very large numbers (tens of billions)', () => {
    expect(formatCurrency(50000)).toBe('$50.0B');
    expect(formatCurrency(100000)).toBe('$100.0B');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('$0M');
  });

  it('should handle null', () => {
    expect(formatCurrency(null)).toBe('$0M');
  });

  it('should handle undefined', () => {
    expect(formatCurrency(undefined)).toBe('$0M');
  });

  it('should handle the exact $1B boundary', () => {
    expect(formatCurrency(999)).toBe('$999M');
    expect(formatCurrency(1000)).toBe('$1.0B');
    expect(formatCurrency(1001)).toBe('$1.0B');
  });

  it('should handle fractional billion values', () => {
    expect(formatCurrency(1234)).toBe('$1.2B');
    expect(formatCurrency(9999)).toBe('$10.0B');
  });
});

// ============================================================
// formatRange EDGE CASES
// ============================================================
describe('formatRange edge cases', () => {
  it('should format a normal range correctly', () => {
    const range = { low: 500, median: 750, high: 1000 };
    const result = formatRange(range);
    expect(result).toContain('$500M');
    expect(result).toContain('$1.0B');
  });

  it('should handle equal low and high values', () => {
    const range = { low: 500, median: 500, high: 500 };
    const result = formatRange(range);
    expect(result).toBe('$500M - $500M');
  });

  it('should handle range spanning millions to billions', () => {
    const range = { low: 800, median: 1200, high: 1500 };
    const result = formatRange(range);
    expect(result).toContain('$800M');
    expect(result).toContain('$1.5B');
  });
});

// ============================================================
// REGULATORY DESIGNATIONS — ALL ON, ALL OFF, INDIVIDUAL FLAGS
// ============================================================
describe('regulatory designations edge cases', () => {
  it('should produce identical results when all designations are off', () => {
    const resultExplicitOff = calculateDealTerms({
      ...baseInput,
      regulatoryDesignations: { fastTrack: false, breakthrough: false, orphan: false, prime: false },
    });
    const resultBase = calculateDealTerms(baseInput);

    expect(resultExplicitOff.terms.totalDealValue.median).toBe(resultBase.terms.totalDealValue.median);
  });

  it('should produce higher value when all designations are on (capped at 20%)', () => {
    const resultAllOff = calculateDealTerms(baseInput);
    const resultAllOn = calculateDealTerms({
      ...baseInput,
      regulatoryDesignations: { fastTrack: true, breakthrough: true, orphan: true, prime: true },
    });

    const ratio = resultAllOn.terms.totalDealValue.median / resultAllOff.terms.totalDealValue.median;
    expect(ratio).toBeGreaterThan(1.0);
    expect(ratio).toBeLessThanOrEqual(1.22); // 20% cap with slight tolerance
  });

  it('each individual designation should increase total deal value', () => {
    const baseResult = calculateDealTerms(baseInput);
    const flags = ['fastTrack', 'breakthrough', 'orphan', 'prime'] as const;

    for (const flag of flags) {
      const result = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: { ...baseInput.regulatoryDesignations, [flag]: true },
      });
      expect(result.terms.totalDealValue.median).toBeGreaterThan(baseResult.terms.totalDealValue.median);
    }
  });
});

// ============================================================
// TERRITORY VARIATIONS — ALL 9 OPTIONS PRODUCE VALID RESULTS
// ============================================================
describe('territory variations', () => {
  const allTerritories: Territory[] = [
    'global', 'us_only', 'ex_us', 'europe', 'china', 'japan', 'row', 'us_eu', 'us_japan',
  ];

  allTerritories.forEach((territory) => {
    it(`should produce valid positive results for territory: ${territory}`, () => {
      const result = calculateDealTerms({ ...baseInput, territory });

      expect(result.terms.totalDealValue.median).toBeGreaterThan(0);
      expect(result.terms.upfront.median).toBeGreaterThan(0);
      expect(Number.isFinite(result.terms.totalDealValue.median)).toBe(true);
      expect(result.terms.totalDealValue.low).toBeLessThanOrEqual(result.terms.totalDealValue.median);
      expect(result.terms.totalDealValue.median).toBeLessThanOrEqual(result.terms.totalDealValue.high);
    });
  });

  it('global territory should produce the highest values', () => {
    const globalResult = calculateDealTerms({ ...baseInput, territory: 'global' as Territory });
    const nonGlobalTerritories: Territory[] = ['us_only', 'ex_us', 'europe', 'china', 'japan', 'row'];

    for (const territory of nonGlobalTerritories) {
      const result = calculateDealTerms({ ...baseInput, territory });
      expect(globalResult.terms.totalDealValue.median).toBeGreaterThanOrEqual(result.terms.totalDealValue.median);
    }
  });
});

// ============================================================
// OUTPUT STRUCTURE INVARIANTS
// ============================================================
describe('output structure invariants', () => {
  it('should maintain low <= median <= high for totalDealValue across all therapeutic areas', () => {
    const configs = [
      { therapeuticArea: 'oncology' as const, modality: 'adc' as Modality, indication: 'lung_nsclc' as Indication },
      { therapeuticArea: 'neurology' as const, modality: 'smallMolecule' as Modality, indication: 'alzheimers' as Indication },
      { therapeuticArea: 'immunology' as const, modality: 'mab' as Modality, indication: 'psoriasis' as Indication },
      { therapeuticArea: 'metabolic' as const, modality: 'glp1Agonist' as Modality, indication: 'type2Diabetes' as Indication },
    ];

    for (const cfg of configs) {
      const result = calculateDealTerms({ ...baseInput, ...cfg });
      expect(result.terms.totalDealValue.low).toBeLessThanOrEqual(result.terms.totalDealValue.median);
      expect(result.terms.totalDealValue.median).toBeLessThanOrEqual(result.terms.totalDealValue.high);
    }
  });

  it('should maintain low <= median <= high for upfront across all phases', () => {
    const phases: Phase[] = ['discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved'];

    for (const phase of phases) {
      const result = calculateDealTerms({ ...baseInput, phase });
      expect(result.terms.upfront.low).toBeLessThanOrEqual(result.terms.upfront.median);
      expect(result.terms.upfront.median).toBeLessThanOrEqual(result.terms.upfront.high);
    }
  });

  it('upfront percent + milestone percent should always equal 100', () => {
    const phases: Phase[] = ['discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved'];

    for (const phase of phases) {
      const result = calculateDealTerms({ ...baseInput, phase });
      expect(result.dealRecommendation.upfrontPercent + result.dealRecommendation.milestonePercent).toBe(100);
    }
  });

  it('royalty tiers should always satisfy base <= midTier <= highTier', () => {
    const result = calculateDealTerms({
      ...baseInput,
      phase: 'approved' as Phase,
      modality: 'radiopharmaceutical' as Modality,
      regulatoryDesignations: { fastTrack: true, breakthrough: true, orphan: true, prime: true },
    });

    expect(result.tieredRoyalties.base.low).toBeLessThanOrEqual(result.tieredRoyalties.midTier.low);
    expect(result.tieredRoyalties.midTier.low).toBeLessThanOrEqual(result.tieredRoyalties.highTier.low);
    expect(result.tieredRoyalties.base.high).toBeLessThanOrEqual(result.tieredRoyalties.midTier.high);
    expect(result.tieredRoyalties.midTier.high).toBeLessThanOrEqual(result.tieredRoyalties.highTier.high);
  });

  it('drillDown should always be populated for every metric', () => {
    const result = calculateDealTerms(baseInput);

    const drillDownKeys = ['upfront', 'totalDealValue', 'devMilestones', 'regMilestones', 'commMilestones', 'royalties'] as const;
    for (const key of drillDownKeys) {
      expect(result.drillDown[key]).toBeDefined();
      expect(result.drillDown[key].rangeExplanation).toBeTruthy();
      expect(typeof result.drillDown[key].rangeWidthPercent).toBe('number');
      expect(Array.isArray(result.drillDown[key].factors)).toBe(true);
    }
  });
});
