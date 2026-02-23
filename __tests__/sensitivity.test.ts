import {
  calculateDealTerms,
  CalculationInput,
  Phase,
  Modality,
  Territory,
  BiomarkerStatus,
  LineOfTherapy,
  CombinationPotential,
  CompetitivePosition,
  DataQuality,
  TreatmentApproach,
  BBBPenetration,
  DiseaseProgression,
  BiomarkerValidation,
  ImmuneResetPotential,
  TargetSpecificity,
  DiseaseSeverity,
  ImmunologyTreatmentGoal,
  MechanismDifferentiation,
  WeightLossEfficacy,
  RouteOfAdministration,
  ComorbidityBreadth,
  MetabolicTreatmentApproach,
} from '@/lib/calculations';

import {
  computeSensitivityAnalysis,
  getTopParameters,
  formatDelta,
  SensitivityData,
  ParameterSensitivity,
} from '@/lib/sensitivity';

// ============================================================
// Base inputs per therapeutic area
// ============================================================

const oncologyInput: CalculationInput = {
  therapeuticArea: 'oncology',
  phase: 'phase2' as Phase,
  modality: 'smallMolecule' as Modality,
  indication: 'lung_nsclc',
  territory: 'global' as Territory,
  biomarker: 'unselected' as BiomarkerStatus,
  lineOfTherapy: '2L' as LineOfTherapy,
  treatmentApproach: 'symptomatic' as TreatmentApproach,
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

const neurologyInput: CalculationInput = {
  therapeuticArea: 'neurology',
  phase: 'phase2' as Phase,
  modality: 'smallMolecule' as Modality,
  indication: 'alzheimers',
  territory: 'global' as Territory,
  biomarker: 'unselected' as BiomarkerStatus,
  lineOfTherapy: '2L' as LineOfTherapy,
  treatmentApproach: 'diseaseModifying' as TreatmentApproach,
  combinationPotential: 'some' as CombinationPotential,
  competitivePosition: 'racing' as CompetitivePosition,
  dataQuality: 'promising' as DataQuality,
  regulatoryDesignations: {
    fastTrack: false,
    breakthrough: false,
    orphan: false,
    prime: false,
  },
  bbbPenetration: 'promisingPreclinical' as BBBPenetration,
  diseaseProgression: 'slowProgressive' as DiseaseProgression,
  biomarkerValidation: 'validatedSurrogate' as BiomarkerValidation,
};

const immunologyInput: CalculationInput = {
  therapeuticArea: 'immunology',
  phase: 'phase2' as Phase,
  modality: 'mab' as Modality,
  indication: 'rheumatoidArthritis',
  territory: 'global' as Territory,
  biomarker: 'unselected' as BiomarkerStatus,
  lineOfTherapy: '2L' as LineOfTherapy,
  treatmentApproach: 'symptomatic' as TreatmentApproach,
  combinationPotential: 'some' as CombinationPotential,
  competitivePosition: 'racing' as CompetitivePosition,
  dataQuality: 'promising' as DataQuality,
  regulatoryDesignations: {
    fastTrack: false,
    breakthrough: false,
    orphan: false,
    prime: false,
  },
  immuneResetPotential: 'chronicTreatment' as ImmuneResetPotential,
  targetSpecificity: 'pathwayTargeted' as TargetSpecificity,
  diseaseSeverity: 'moderateSevere' as DiseaseSeverity,
  treatmentGoal: 'maintenance' as ImmunologyTreatmentGoal,
};

const metabolicInput: CalculationInput = {
  therapeuticArea: 'metabolic',
  phase: 'phase2' as Phase,
  modality: 'glp1Agonist' as Modality,
  indication: 'obesity',
  territory: 'global' as Territory,
  biomarker: 'unselected' as BiomarkerStatus,
  lineOfTherapy: '2L' as LineOfTherapy,
  treatmentApproach: 'symptomatic' as TreatmentApproach,
  combinationPotential: 'some' as CombinationPotential,
  competitivePosition: 'racing' as CompetitivePosition,
  dataQuality: 'promising' as DataQuality,
  regulatoryDesignations: {
    fastTrack: false,
    breakthrough: false,
    orphan: false,
    prime: false,
  },
  mechanismDifferentiation: 'incretinBased' as MechanismDifferentiation,
  weightLossEfficacy: 'competitiveEfficacy' as WeightLossEfficacy,
  routeOfAdministration: 'injectable' as RouteOfAdministration,
  comorbidityBreadth: 'obesityPrimary' as ComorbidityBreadth,
  metabolicTreatmentApproach: 'chronicWeightMgmt' as MetabolicTreatmentApproach,
};

// ============================================================
// Helper: compute sensitivity from an input
// ============================================================
function buildSensitivity(input: CalculationInput): SensitivityData {
  const result = calculateDealTerms(input);
  return computeSensitivityAnalysis(input, result);
}

// ============================================================
// Tests
// ============================================================

describe('computeSensitivityAnalysis', () => {
  // ----------------------------------------------------------
  // All 4 therapeutic areas return valid results
  // ----------------------------------------------------------
  describe('therapeutic area coverage', () => {
    it('should return valid results for oncology', () => {
      const sa = buildSensitivity(oncologyInput);

      expect(sa.parameters.length).toBeGreaterThan(0);
      expect(sa.currentUpfront).toBeGreaterThan(0);
      expect(sa.currentTotalValue).toBeGreaterThan(0);
      expect(sa.topValueDriver).toBeDefined();
      expect(sa.computedAt).toBeGreaterThan(0);
    });

    it('should return valid results for neurology', () => {
      const sa = buildSensitivity(neurologyInput);

      expect(sa.parameters.length).toBeGreaterThan(0);
      expect(sa.currentUpfront).toBeGreaterThan(0);
      expect(sa.currentTotalValue).toBeGreaterThan(0);
    });

    it('should return valid results for immunology', () => {
      const sa = buildSensitivity(immunologyInput);

      expect(sa.parameters.length).toBeGreaterThan(0);
      expect(sa.currentUpfront).toBeGreaterThan(0);
      expect(sa.currentTotalValue).toBeGreaterThan(0);
    });

    it('should return valid results for metabolic', () => {
      const sa = buildSensitivity(metabolicInput);

      expect(sa.parameters.length).toBeGreaterThan(0);
      expect(sa.currentUpfront).toBeGreaterThan(0);
      expect(sa.currentTotalValue).toBeGreaterThan(0);
    });

    it('should include neurology-specific parameters for neurology TA', () => {
      const sa = buildSensitivity(neurologyInput);
      const keys = sa.parameters.map(p => p.parameterKey);

      expect(keys).toContain('bbbPenetration');
      expect(keys).toContain('diseaseProgression');
      expect(keys).toContain('biomarkerValidation');
      // Should NOT include immunology- or metabolic-specific params
      expect(keys).not.toContain('immuneResetPotential');
      expect(keys).not.toContain('mechanismDifferentiation');
    });

    it('should include immunology-specific parameters for immunology TA', () => {
      const sa = buildSensitivity(immunologyInput);
      const keys = sa.parameters.map(p => p.parameterKey);

      expect(keys).toContain('immuneResetPotential');
      expect(keys).toContain('targetSpecificity');
      expect(keys).toContain('diseaseSeverity');
      expect(keys).not.toContain('bbbPenetration');
      expect(keys).not.toContain('weightLossEfficacy');
    });

    it('should include metabolic-specific parameters for metabolic TA', () => {
      const sa = buildSensitivity(metabolicInput);
      const keys = sa.parameters.map(p => p.parameterKey);

      expect(keys).toContain('mechanismDifferentiation');
      expect(keys).toContain('weightLossEfficacy');
      expect(keys).toContain('routeOfAdministration');
      expect(keys).toContain('comorbidityBreadth');
      expect(keys).not.toContain('bbbPenetration');
      expect(keys).not.toContain('immuneResetPotential');
    });
  });

  // ----------------------------------------------------------
  // TA-specific insights
  // ----------------------------------------------------------
  describe('therapeutic area insights', () => {
    it('should generate oncology insights for oncology TA', () => {
      const sa = buildSensitivity(oncologyInput);

      expect(sa.neurologyInsights.length).toBeGreaterThan(0);
      const categories = sa.neurologyInsights.map(i => i.category);
      expect(categories).toContain('competitive_landscape');
      expect(categories).toContain('line_of_therapy');
      expect(categories).toContain('combination_strategy');
    });

    it('should generate neurology insights for neurology TA', () => {
      const sa = buildSensitivity(neurologyInput);

      expect(sa.neurologyInsights.length).toBe(3);
      const categories = sa.neurologyInsights.map(i => i.category);
      expect(categories).toContain('bbb_penetration');
      expect(categories).toContain('disease_progression');
      expect(categories).toContain('biomarker_validation');
    });

    it('should generate immunology insights for immunology TA', () => {
      const sa = buildSensitivity(immunologyInput);

      expect(sa.neurologyInsights.length).toBe(3);
      sa.neurologyInsights.forEach(insight => {
        expect(insight.title).toBeTruthy();
        expect(insight.description).toBeTruthy();
        expect(['VERY HIGH', 'HIGH', 'MEDIUM', 'LOW']).toContain(insight.impactLevel);
      });
    });

    it('should generate metabolic insights for metabolic TA', () => {
      const sa = buildSensitivity(metabolicInput);

      expect(sa.neurologyInsights.length).toBe(3);
      const categories = sa.neurologyInsights.map(i => i.category);
      expect(categories).toContain('competitive_landscape');
      expect(categories).toContain('line_of_therapy');
      expect(categories).toContain('combination_strategy');
    });
  });

  // ----------------------------------------------------------
  // Structure validation
  // ----------------------------------------------------------
  describe('structure validation', () => {
    it('should have expected top-level fields', () => {
      const sa = buildSensitivity(oncologyInput);

      expect(sa).toHaveProperty('currentUpfront');
      expect(sa).toHaveProperty('currentTotalValue');
      expect(sa).toHaveProperty('parameters');
      expect(sa).toHaveProperty('topValueDriver');
      expect(sa).toHaveProperty('neurologyInsights');
      expect(sa).toHaveProperty('computedAt');
    });

    it('should have valid ParameterSensitivity shapes', () => {
      const sa = buildSensitivity(oncologyInput);

      sa.parameters.forEach(p => {
        expect(p).toHaveProperty('parameterKey');
        expect(p).toHaveProperty('label');
        expect(p).toHaveProperty('currentValue');
        expect(p).toHaveProperty('currentLabel');
        expect(p).toHaveProperty('options');
        expect(p).toHaveProperty('maxPositiveDelta');
        expect(p).toHaveProperty('maxNegativeDelta');
        expect(p).toHaveProperty('impactRange');
        expect(p).toHaveProperty('impactLevel');
        expect(p.options.length).toBeGreaterThan(0);
        expect(['VERY HIGH', 'HIGH', 'MEDIUM', 'LOW']).toContain(p.impactLevel);
      });
    });

    it('should have valid TopValueDriver shape', () => {
      const sa = buildSensitivity(oncologyInput);

      expect(sa.topValueDriver).toHaveProperty('parameterKey');
      expect(sa.topValueDriver).toHaveProperty('parameterLabel');
      expect(sa.topValueDriver).toHaveProperty('bestOption');
      expect(sa.topValueDriver).toHaveProperty('insightText');
      expect(typeof sa.topValueDriver.insightText).toBe('string');
      expect(sa.topValueDriver.insightText.length).toBeGreaterThan(0);
    });

    it('should sort parameters by impactRange descending', () => {
      const sa = buildSensitivity(oncologyInput);

      for (let i = 1; i < sa.parameters.length; i++) {
        expect(sa.parameters[i - 1].impactRange).toBeGreaterThanOrEqual(
          sa.parameters[i].impactRange
        );
      }
    });

    it('should sort each parameter options by resultingTotalValue descending', () => {
      const sa = buildSensitivity(oncologyInput);

      sa.parameters.forEach(p => {
        for (let i = 1; i < p.options.length; i++) {
          expect(p.options[i - 1].resultingTotalValue).toBeGreaterThanOrEqual(
            p.options[i].resultingTotalValue
          );
        }
      });
    });

    it('should include a zero-delta option for the current value in each parameter', () => {
      const sa = buildSensitivity(oncologyInput);

      sa.parameters.forEach(p => {
        const currentOpt = p.options.find(o => o.value === p.currentValue);
        expect(currentOpt).toBeDefined();
        expect(currentOpt!.delta).toBe(0);
        expect(currentOpt!.deltaPercent).toBe(0);
      });
    });

    it('should not produce NaN or Infinity in any option', () => {
      const sa = buildSensitivity(oncologyInput);

      sa.parameters.forEach(p => {
        p.options.forEach(o => {
          expect(Number.isFinite(o.resultingUpfront)).toBe(true);
          expect(Number.isFinite(o.resultingTotalValue)).toBe(true);
          expect(Number.isFinite(o.delta)).toBe(true);
          expect(Number.isFinite(o.deltaPercent)).toBe(true);
        });
      });
    });

    it('impactRange should equal maxPositiveDelta minus maxNegativeDelta', () => {
      const sa = buildSensitivity(oncologyInput);

      sa.parameters.forEach(p => {
        expect(p.impactRange).toBeCloseTo(p.maxPositiveDelta - p.maxNegativeDelta, 5);
      });
    });
  });

  // ----------------------------------------------------------
  // Edge cases
  // ----------------------------------------------------------
  describe('edge cases', () => {
    it('should handle preclinical phase input', () => {
      const input = { ...oncologyInput, phase: 'preclinical' as Phase };
      const sa = buildSensitivity(input);

      expect(sa.parameters.length).toBeGreaterThan(0);
      expect(sa.currentTotalValue).toBeGreaterThan(0);
    });

    it('should handle approved phase input', () => {
      const input = { ...oncologyInput, phase: 'approved' as Phase };
      const sa = buildSensitivity(input);

      expect(sa.parameters.length).toBeGreaterThan(0);
      expect(sa.currentTotalValue).toBeGreaterThan(0);
    });

    it('should handle input with all regulatory designations enabled', () => {
      const input: CalculationInput = {
        ...oncologyInput,
        regulatoryDesignations: {
          fastTrack: true,
          breakthrough: true,
          orphan: true,
          prime: true,
        },
      };
      const sa = buildSensitivity(input);

      expect(sa.parameters.length).toBeGreaterThan(0);
      // The current upfront should reflect the regulatory bonus
      const saBase = buildSensitivity(oncologyInput);
      expect(sa.currentTotalValue).toBeGreaterThan(saBase.currentTotalValue);
    });
  });
});

// ============================================================
// getTopParameters
// ============================================================
describe('getTopParameters', () => {
  it('should return at most maxCount parameters', () => {
    const sa = buildSensitivity(oncologyInput);
    const top = getTopParameters(sa, 2);

    expect(top.length).toBeLessThanOrEqual(2);
  });

  it('should default to 4 when maxCount is not specified', () => {
    const sa = buildSensitivity(oncologyInput);
    const top = getTopParameters(sa);

    expect(top.length).toBeLessThanOrEqual(4);
  });

  it('should filter out LOW-impact parameters', () => {
    const sa = buildSensitivity(oncologyInput);
    const top = getTopParameters(sa, 100);

    top.forEach(p => {
      expect(p.impactLevel).not.toBe('LOW');
    });
  });

  it('should handle empty parameters gracefully', () => {
    const emptySA: SensitivityData = {
      currentUpfront: 0,
      currentTotalValue: 0,
      parameters: [],
      topValueDriver: {
        parameterKey: 'phase',
        parameterLabel: 'Development Phase',
        bestOption: { value: '', label: '', resultingUpfront: 0, resultingTotalValue: 0, delta: 0, deltaPercent: 0 },
        insightText: 'No parameters available for sensitivity analysis.',
      },
      neurologyInsights: [],
      computedAt: Date.now(),
    };
    const top = getTopParameters(emptySA, 4);

    expect(top).toEqual([]);
  });

  it('should preserve descending impactRange order from source', () => {
    const sa = buildSensitivity(oncologyInput);
    const top = getTopParameters(sa, 10);

    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].impactRange).toBeGreaterThanOrEqual(top[i].impactRange);
    }
  });
});

// ============================================================
// formatDelta
// ============================================================
describe('formatDelta', () => {
  it('should format positive delta with up arrow', () => {
    const result = formatDelta(200, 15);
    expect(result).toContain('▲');
    expect(result).toContain('+15%');
  });

  it('should format negative delta with down arrow', () => {
    const result = formatDelta(-300, -25);
    expect(result).toContain('▼');
    expect(result).toContain('-25%');
  });

  it('should format zero delta as current', () => {
    const result = formatDelta(0, 0);
    expect(result).toBe('— Current');
  });

  it('should include formatted currency value for positive delta', () => {
    const result = formatDelta(1500, 50);
    // 1500 => $1.5B via formatCurrency
    expect(result).toContain('$1.5B');
  });

  it('should include formatted currency value for negative delta', () => {
    const result = formatDelta(-400, -20);
    // 400 => $400M via formatCurrency
    expect(result).toContain('$400M');
  });

  it('should handle small positive delta', () => {
    const result = formatDelta(1, 0.5);
    expect(result).toContain('▲');
    expect(result).toContain('$1M');
  });

  it('should handle large negative delta', () => {
    const result = formatDelta(-5000, -80);
    expect(result).toContain('▼');
    expect(result).toContain('$5.0B');
  });
});
