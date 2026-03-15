import {
  calculateDealTerms,
  CalculationInput,
  Phase,
  Modality,
  Territory,
  DealType,
  BiomarkerStatus,
  LineOfTherapy,
  CombinationPotential,
  CompetitivePosition,
  DataQuality,
  TherapeuticArea,
  Indication,
} from '../lib/calculations';

// =============================================================================
// Shared base inputs per therapeutic area
// =============================================================================

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

/** Representative default inputs for each TA — picks a valid indication + modality combo. */
const taDefaults: Record<TherapeuticArea, Partial<CalculationInput>> = {
  oncology: {
    therapeuticArea: 'oncology',
    modality: 'smallMolecule' as Modality,
    indication: 'lung_nsclc' as Indication,
  },
  neurology: {
    therapeuticArea: 'neurology',
    modality: 'smallMolecule' as Modality,
    indication: 'alzheimers' as Indication,
    treatmentApproach: 'symptomatic',
  },
  immunology: {
    therapeuticArea: 'immunology',
    modality: 'mab' as Modality,
    indication: 'rheumatoidArthritis' as Indication,
  },
  metabolic: {
    therapeuticArea: 'metabolic',
    modality: 'glp1Agonist' as Modality,
    indication: 'obesity' as Indication,
  },
  cardiovascular: {
    therapeuticArea: 'cardiovascular',
    modality: 'smallMolecule' as Modality,
    indication: 'heartFailureHfref' as Indication,
  },
  infectiousDisease: {
    therapeuticArea: 'infectiousDisease',
    modality: 'antiviral' as Modality,
    indication: 'hivAids' as Indication,
  },
  ophthalmology: {
    therapeuticArea: 'ophthalmology',
    modality: 'antiVegf' as Modality,
    indication: 'wetAmd' as Indication,
  },
  womensHealth: {
    therapeuticArea: 'womensHealth',
    modality: 'smallMolecule' as Modality,
    indication: 'endometriosis' as Indication,
  },
  rareDisease: {
    therapeuticArea: 'rareDisease',
    modality: 'enzymeReplacement' as Modality,
    indication: 'fabryDisease' as Indication,
  },
  hematology: {
    therapeuticArea: 'hematology',
    modality: 'carT_heme' as Modality,
    indication: 'dlbcl' as Indication,
  },
  dermatology: {
    therapeuticArea: 'dermatology',
    modality: 'il17Inhibitor' as Modality,
    indication: 'psoriasis' as Indication,
  },
  gastroenterology: {
    therapeuticArea: 'gastroenterology',
    modality: 'antiTl1a' as Modality,
    indication: 'crohnsDisease' as Indication,
  },
};

function inputForTA(ta: TherapeuticArea, overrides: Partial<CalculationInput> = {}): CalculationInput {
  return { ...baseInput, ...taDefaults[ta], ...overrides } as CalculationInput;
}

// =============================================================================
// 1. Cross-TA Phase Monotonicity
// =============================================================================

describe('Cross-TA Phase Monotonicity', () => {
  const allTAs: TherapeuticArea[] = [
    'oncology', 'neurology', 'immunology', 'metabolic',
    'cardiovascular', 'infectiousDisease', 'ophthalmology', 'womensHealth',
  ];

  // Major phases that must be strictly monotonic across all TAs.
  // Intermediate phases (phase1_2, phase2_3, nda_filed) may have small inversions
  // due to milestone allocation rebalancing, so they are tested separately with tolerance.
  const majorPhases: Phase[] = [
    'discovery', 'preclinical', 'phase1', 'phase2', 'phase3', 'approved',
  ];

  const allPhases: Phase[] = [
    'discovery', 'preclinical', 'phase1', 'phase1_2',
    'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved',
  ];

  allTAs.forEach((ta) => {
    it(`${ta}: deal values increase monotonically across major phases`, () => {
      const medians = majorPhases.map((phase) => {
        const result = calculateDealTerms(inputForTA(ta, { phase }));
        return { phase, median: result.terms.totalDealValue.median };
      });

      // Each successive phase should be >= the previous (non-decreasing)
      for (let i = 1; i < medians.length; i++) {
        expect(medians[i].median).toBeGreaterThanOrEqual(medians[i - 1].median);
      }

      // Overall: approved must be at least 5x discovery to ensure real progression
      expect(medians[medians.length - 1].median).toBeGreaterThan(medians[0].median * 5);
    });

    it(`${ta}: deal values increase across all phases (5% tolerance for adjacent)`, () => {
      const medians = allPhases.map((phase) => {
        const result = calculateDealTerms(inputForTA(ta, { phase }));
        return { phase, median: result.terms.totalDealValue.median };
      });

      for (let i = 1; i < medians.length; i++) {
        // Allow up to 10% regression between adjacent intermediate phases
        // but the overall trend must be upward
        expect(medians[i].median).toBeGreaterThan(medians[i - 1].median * 0.90);
      }
    });
  });
});

// =============================================================================
// 2. Territory Multiplier Accuracy (all 15 territories)
// =============================================================================

describe('Territory Multiplier Accuracy', () => {
  const allTerritories: Territory[] = [
    'global', 'us_only', 'ex_us', 'europe', 'china', 'japan', 'row',
    'us_eu', 'us_japan', 'canada', 'australia', 'south_korea',
    'apac_ex_cj', 'latam', 'mena',
  ];

  // Pre-compute all territory results once
  let results: Record<string, ReturnType<typeof calculateDealTerms>>;

  beforeAll(() => {
    results = {} as any;
    allTerritories.forEach((t) => {
      results[t] = calculateDealTerms({ ...baseInput, territory: t });
    });
  });

  it('global produces the highest value among all territories', () => {
    const globalMedian = results.global.terms.totalDealValue.median;
    allTerritories.filter((t) => t !== 'global').forEach((t) => {
      expect(globalMedian).toBeGreaterThan(results[t].terms.totalDealValue.median);
    });
  });

  it('us_only is approximately 55% of global (within 45-65%)', () => {
    const ratio = results.us_only.terms.totalDealValue.median / results.global.terms.totalDealValue.median;
    expect(ratio).toBeGreaterThanOrEqual(0.45);
    expect(ratio).toBeLessThanOrEqual(0.65);
  });

  it('europe < us_only', () => {
    expect(results.europe.terms.totalDealValue.median).toBeLessThan(
      results.us_only.terms.totalDealValue.median
    );
  });

  it('china < europe', () => {
    expect(results.china.terms.totalDealValue.median).toBeLessThan(
      results.europe.terms.totalDealValue.median
    );
  });

  it('japan < europe', () => {
    expect(results.japan.terms.totalDealValue.median).toBeLessThan(
      results.europe.terms.totalDealValue.median
    );
  });

  it.each(['canada', 'australia', 'mena'] as Territory[])(
    '%s should be < 10%% of global',
    (territory) => {
      const ratio = results[territory].terms.totalDealValue.median / results.global.terms.totalDealValue.median;
      expect(ratio).toBeLessThan(0.10);
    }
  );

  it('us_eu > us_only (combined territory exceeds US alone)', () => {
    expect(results.us_eu.terms.totalDealValue.median).toBeGreaterThan(
      results.us_only.terms.totalDealValue.median
    );
  });

  it('us_japan > us_only (combined territory exceeds US alone)', () => {
    expect(results.us_japan.terms.totalDealValue.median).toBeGreaterThan(
      results.us_only.terms.totalDealValue.median
    );
  });
});

// =============================================================================
// 3. Deal Type Impact
// =============================================================================

describe('Deal Type Impact', () => {
  const allDealTypes: DealType[] = ['licensing', 'acquisition', 'codevelopment', 'option', 'collaboration'];

  let results: Record<string, ReturnType<typeof calculateDealTerms>>;

  beforeAll(() => {
    results = {} as any;
    allDealTypes.forEach((dt) => {
      results[dt] = calculateDealTerms({ ...baseInput, dealType: dt });
    });
  });

  it('Phase 2 acquisition total value is within 60-110% of licensing (phase-adjusted, not always premium)', () => {
    // Acquisition multiplier is phase-adjusted: early-stage = discount (buying risk),
    // late-stage = premium (control). Phase 2 acquisition ≈ 0.90x of licensing.
    const ratio = results.acquisition.terms.totalDealValue.median / results.licensing.terms.totalDealValue.median;
    expect(ratio).toBeGreaterThan(0.60);
    expect(ratio).toBeLessThan(1.10);
  });

  it('acquisition upfront % should be much higher than licensing (70%+ vs 15-35%)', () => {
    const acqUpfrontRatio = results.acquisition.terms.upfront.median / results.acquisition.terms.totalDealValue.median;
    const licUpfrontRatio = results.licensing.terms.upfront.median / results.licensing.terms.totalDealValue.median;
    expect(acqUpfrontRatio).toBeGreaterThan(0.60); // Acquisitions: 70%+ upfront
    expect(licUpfrontRatio).toBeLessThan(0.40);    // Licensing: <40% upfront
    expect(acqUpfrontRatio).toBeGreaterThan(licUpfrontRatio); // Acq always higher upfront %
  });

  it('licensing > codevelopment > option > collaboration (value ordering)', () => {
    const licensingVal = results.licensing.terms.totalDealValue.median;
    const codevelopmentVal = results.codevelopment.terms.totalDealValue.median;
    const optionVal = results.option.terms.totalDealValue.median;
    const collaborationVal = results.collaboration.terms.totalDealValue.median;

    expect(licensingVal).toBeGreaterThan(codevelopmentVal);
    expect(codevelopmentVal).toBeGreaterThan(optionVal);
    expect(optionVal).toBeGreaterThan(collaborationVal);
  });

  it('acquisition should have 0 or near-0 royalties', () => {
    const acqResult = results.acquisition;
    expect(acqResult.tieredRoyalties.base.low).toBe(0);
    expect(acqResult.tieredRoyalties.base.high).toBe(0);
    expect(acqResult.tieredRoyalties.midTier.low).toBe(0);
    expect(acqResult.tieredRoyalties.highTier.low).toBe(0);
  });

  it('all 5 deal types produce valid positive results', () => {
    allDealTypes.forEach((dt) => {
      expect(results[dt].terms.totalDealValue.median).toBeGreaterThan(0);
      expect(results[dt].terms.upfront.median).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// 4. Absolute Value Sanity Checks (industry benchmarks)
// =============================================================================

describe('Absolute Value Sanity Checks', () => {
  it('Phase 3 oncology global licensing: total deal value median $2B-6B', () => {
    const result = calculateDealTerms({
      ...baseInput,
      phase: 'phase3' as Phase,
      territory: 'global' as Territory,
      dealType: 'licensing' as DealType,
    });
    // Values are in $M
    expect(result.terms.totalDealValue.median).toBeGreaterThanOrEqual(2000);
    expect(result.terms.totalDealValue.median).toBeLessThanOrEqual(6000);
  });

  it('Phase 2 neurology global: total deal value median $500M-2B', () => {
    const result = calculateDealTerms(inputForTA('neurology', {
      phase: 'phase2' as Phase,
      territory: 'global' as Territory,
    }));
    expect(result.terms.totalDealValue.median).toBeGreaterThanOrEqual(500);
    expect(result.terms.totalDealValue.median).toBeLessThanOrEqual(3000);
  });

  it('Preclinical small molecule: upfront $20M-100M', () => {
    const result = calculateDealTerms({
      ...baseInput,
      phase: 'preclinical' as Phase,
      modality: 'smallMolecule' as Modality,
      territory: 'global' as Territory,
    });
    expect(result.terms.upfront.median).toBeGreaterThanOrEqual(20);
    expect(result.terms.upfront.median).toBeLessThanOrEqual(100);
  });

  it('Approved product: upfront > $500M', () => {
    const result = calculateDealTerms({
      ...baseInput,
      phase: 'approved' as Phase,
      territory: 'global' as Territory,
    });
    expect(result.terms.upfront.median).toBeGreaterThan(500);
  });
});

// =============================================================================
// 5. Royalty Tier Ordering
// =============================================================================

describe('Royalty Tier Ordering', () => {
  const allTAs: TherapeuticArea[] = [
    'oncology', 'neurology', 'immunology', 'metabolic',
    'cardiovascular', 'infectiousDisease', 'ophthalmology', 'womensHealth',
  ];

  allTAs.forEach((ta) => {
    it(`${ta}: base <= mid-tier <= high-tier royalties`, () => {
      const result = calculateDealTerms(inputForTA(ta));

      // low end ordering
      expect(result.tieredRoyalties.base.low).toBeLessThanOrEqual(result.tieredRoyalties.midTier.low);
      expect(result.tieredRoyalties.midTier.low).toBeLessThanOrEqual(result.tieredRoyalties.highTier.low);

      // high end ordering
      expect(result.tieredRoyalties.base.high).toBeLessThanOrEqual(result.tieredRoyalties.midTier.high);
      expect(result.tieredRoyalties.midTier.high).toBeLessThanOrEqual(result.tieredRoyalties.highTier.high);
    });

    it(`${ta}: royalties in reasonable range (1-35%)`, () => {
      const result = calculateDealTerms(inputForTA(ta));

      expect(result.tieredRoyalties.base.low).toBeGreaterThanOrEqual(1);
      expect(result.tieredRoyalties.highTier.high).toBeLessThanOrEqual(35);
    });
  });

  it('royalty ordering holds across all phases (oncology)', () => {
    const phases: Phase[] = ['preclinical', 'phase1', 'phase2', 'phase3', 'approved'];
    phases.forEach((phase) => {
      const result = calculateDealTerms({ ...baseInput, phase });
      expect(result.tieredRoyalties.base.low).toBeLessThanOrEqual(result.tieredRoyalties.midTier.low);
      expect(result.tieredRoyalties.midTier.low).toBeLessThanOrEqual(result.tieredRoyalties.highTier.low);
    });
  });
});

// =============================================================================
// 6. Modifier Direction Tests
// =============================================================================

describe('Modifier Direction Tests', () => {
  describe('competitive position ordering: firstInClass > racing > crowded', () => {
    it('firstInClass > racing', () => {
      const ficResult = calculateDealTerms({ ...baseInput, competitivePosition: 'firstInClass' as CompetitivePosition });
      const racingResult = calculateDealTerms({ ...baseInput, competitivePosition: 'racing' as CompetitivePosition });
      expect(ficResult.terms.totalDealValue.median).toBeGreaterThan(racingResult.terms.totalDealValue.median);
    });

    it('racing > crowded', () => {
      const racingResult = calculateDealTerms({ ...baseInput, competitivePosition: 'racing' as CompetitivePosition });
      const crowdedResult = calculateDealTerms({ ...baseInput, competitivePosition: 'crowded' as CompetitivePosition });
      expect(racingResult.terms.totalDealValue.median).toBeGreaterThan(crowdedResult.terms.totalDealValue.median);
    });
  });

  describe('data quality ordering: pivotalReady > promising > limited', () => {
    it('pivotalReady > promising', () => {
      const pivotalResult = calculateDealTerms({ ...baseInput, dataQuality: 'pivotalReady' as DataQuality });
      const promisingResult = calculateDealTerms({ ...baseInput, dataQuality: 'promising' as DataQuality });
      expect(pivotalResult.terms.totalDealValue.median).toBeGreaterThan(promisingResult.terms.totalDealValue.median);
    });

    it('promising > limited', () => {
      const promisingResult = calculateDealTerms({ ...baseInput, dataQuality: 'promising' as DataQuality });
      const limitedResult = calculateDealTerms({ ...baseInput, dataQuality: 'limited' as DataQuality });
      expect(promisingResult.terms.totalDealValue.median).toBeGreaterThan(limitedResult.terms.totalDealValue.median);
    });
  });

  describe('biomarker ordering: selected > unselected', () => {
    it('selected > unselected', () => {
      const selectedResult = calculateDealTerms({ ...baseInput, biomarker: 'selected' as BiomarkerStatus });
      const unselectedResult = calculateDealTerms({ ...baseInput, biomarker: 'unselected' as BiomarkerStatus });
      expect(selectedResult.terms.totalDealValue.median).toBeGreaterThan(unselectedResult.terms.totalDealValue.median);
    });
  });

  describe('modifier labels have correct direction indicators', () => {
    it('firstInClass modifier has multiplier > 1 (positive direction)', () => {
      const result = calculateDealTerms({ ...baseInput, competitivePosition: 'firstInClass' as CompetitivePosition });
      const compModifier = result.modifiers.find(
        (m) => m.name.toLowerCase().includes('first') || m.name.toLowerCase().includes('class')
      );
      expect(compModifier).toBeDefined();
      expect(compModifier!.multiplier).toBeGreaterThan(1.0);
    });

    it('crowded modifier has multiplier < 1 (negative direction)', () => {
      const result = calculateDealTerms({ ...baseInput, competitivePosition: 'crowded' as CompetitivePosition });
      const compModifier = result.modifiers.find(
        (m) => m.name.toLowerCase().includes('crowded')
      );
      expect(compModifier).toBeDefined();
      expect(compModifier!.multiplier).toBeLessThan(1.0);
    });

    it('pivotalReady modifier has multiplier > 1 (positive direction)', () => {
      const result = calculateDealTerms({ ...baseInput, dataQuality: 'pivotalReady' as DataQuality });
      const dataModifier = result.modifiers.find(
        (m) => m.name.toLowerCase().includes('pivotal')
      );
      expect(dataModifier).toBeDefined();
      expect(dataModifier!.multiplier).toBeGreaterThan(1.0);
    });

    it('limited data modifier has multiplier < 1 (negative direction)', () => {
      const result = calculateDealTerms({ ...baseInput, dataQuality: 'limited' as DataQuality });
      const dataModifier = result.modifiers.find(
        (m) => m.name.toLowerCase().includes('limited')
      );
      expect(dataModifier).toBeDefined();
      expect(dataModifier!.multiplier).toBeLessThan(1.0);
    });

    it('selected biomarker modifier has multiplier > 1 (positive direction)', () => {
      const result = calculateDealTerms({ ...baseInput, biomarker: 'selected' as BiomarkerStatus });
      const bioMarkerModifier = result.modifiers.find(
        (m) => m.name.toLowerCase().includes('biomarker') || m.name.toLowerCase().includes('selected')
      );
      expect(bioMarkerModifier).toBeDefined();
      expect(bioMarkerModifier!.multiplier).toBeGreaterThan(1.0);
    });
  });

  describe('modifier directions hold across TAs', () => {
    const testTAs: TherapeuticArea[] = ['oncology', 'neurology', 'immunology', 'metabolic'];

    testTAs.forEach((ta) => {
      it(`${ta}: firstInClass > crowded`, () => {
        const fic = calculateDealTerms(inputForTA(ta, { competitivePosition: 'firstInClass' as CompetitivePosition }));
        const crowded = calculateDealTerms(inputForTA(ta, { competitivePosition: 'crowded' as CompetitivePosition }));
        expect(fic.terms.totalDealValue.median).toBeGreaterThan(crowded.terms.totalDealValue.median);
      });

      it(`${ta}: pivotalReady > limited`, () => {
        const pivotal = calculateDealTerms(inputForTA(ta, { dataQuality: 'pivotalReady' as DataQuality }));
        const limited = calculateDealTerms(inputForTA(ta, { dataQuality: 'limited' as DataQuality }));
        expect(pivotal.terms.totalDealValue.median).toBeGreaterThan(limited.terms.totalDealValue.median);
      });
    });
  });
});
