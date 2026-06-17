/**
 * Deal Structure Classifier Tests
 *
 * Tests classifyDealStructure, resolveUpfrontStructure, and
 * getUpfrontPercentByStructure across all 6 deal structure regimes.
 */

import {
  classifyDealStructure,
  resolveUpfrontStructure,
  getUpfrontPercentByStructure,
  type DealStructureInput,
  type DealStructure,
} from '@/lib/financial/deal-structure-classifier';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<DealStructureInput> = {}): DealStructureInput {
  return {
    phase: 'phase2',
    dealType: 'licensing',
    modality: 'smallMolecule',
    therapeuticArea: 'oncology',
    territory: 'global',
    licensor: null,
    licensee: null,
    ...overrides,
  };
}

const ALL_STRUCTURES: DealStructure[] = [
  'classic_license',
  'option_style',
  'platform_collab',
  'regional_license',
  'biosimilar_license',
  'strategic_acquisition',
];

// ---------------------------------------------------------------------------
// classifyDealStructure — regime routing
// ---------------------------------------------------------------------------

describe('classifyDealStructure', () => {
  describe('strategic_acquisition', () => {
    it('routes dealType=acquisition to strategic_acquisition with confidence 1.0', () => {
      const result = classifyDealStructure(makeInput({ dealType: 'acquisition' }));
      expect(result.structure).toBe('strategic_acquisition');
      expect(result.confidence).toBe(1.0);
      expect(result.signals.length).toBeGreaterThan(0);
    });
  });

  describe('biosimilar_license', () => {
    it('routes known biosimilar licensor to biosimilar_license', () => {
      const result = classifyDealStructure(makeInput({ licensor: 'Shanghai Henlius' }));
      expect(result.structure).toBe('biosimilar_license');
      expect(result.confidence).toBe(0.95);
    });

    it('matches biosimilar licensor case-insensitively', () => {
      const result = classifyDealStructure(makeInput({ licensor: 'samsung bioepis' }));
      expect(result.structure).toBe('biosimilar_license');
    });

    it('matches Celltrion as biosimilar licensor', () => {
      const result = classifyDealStructure(makeInput({ licensor: 'Celltrion' }));
      expect(result.structure).toBe('biosimilar_license');
    });
  });

  describe('option_style', () => {
    it('routes dealType=option to option_style with confidence 1.0', () => {
      const result = classifyDealStructure(makeInput({ dealType: 'option' }));
      expect(result.structure).toBe('option_style');
      expect(result.confidence).toBe(1.0);
    });

    it('routes early-phase collaboration to option_style', () => {
      const result = classifyDealStructure(
        makeInput({ dealType: 'collaboration', phase: 'preclinical' }),
      );
      expect(result.structure).toBe('option_style');
      expect(result.confidence).toBe(0.85);
    });

    it('routes discovery-phase collaboration to option_style', () => {
      const result = classifyDealStructure(
        makeInput({ dealType: 'collaboration', phase: 'discovery' }),
      );
      expect(result.structure).toBe('option_style');
    });

    it('routes phase1 collaboration to option_style', () => {
      const result = classifyDealStructure(
        makeInput({ dealType: 'collaboration', phase: 'phase1' }),
      );
      expect(result.structure).toBe('option_style');
    });

    it('routes phase1_2 collaboration to option_style', () => {
      const result = classifyDealStructure(
        makeInput({ dealType: 'collaboration', phase: 'phase1_2' }),
      );
      expect(result.structure).toBe('option_style');
    });

    it('routes platform licensor + early phase to option_style', () => {
      const result = classifyDealStructure(
        makeInput({ phase: 'preclinical', licensor: 'Insilico Medicine', dealType: 'licensing' }),
      );
      expect(result.structure).toBe('option_style');
      expect(result.confidence).toBe(0.70);
    });

    it('does NOT route platform licensor + mid phase to option_style', () => {
      const result = classifyDealStructure(
        makeInput({ phase: 'phase2', licensor: 'Insilico Medicine', dealType: 'licensing' }),
      );
      expect(result.structure).not.toBe('option_style');
    });
  });

  describe('platform_collab', () => {
    it('routes mid-phase collaboration to platform_collab', () => {
      const result = classifyDealStructure(
        makeInput({ dealType: 'collaboration', phase: 'phase2' }),
      );
      expect(result.structure).toBe('platform_collab');
      expect(result.confidence).toBe(0.80);
    });

    it('routes phase3 collaboration to platform_collab', () => {
      const result = classifyDealStructure(
        makeInput({ dealType: 'collaboration', phase: 'phase3' }),
      );
      expect(result.structure).toBe('platform_collab');
    });
  });

  describe('regional_license', () => {
    it('routes china territory to regional_license', () => {
      const result = classifyDealStructure(makeInput({ territory: 'china' }));
      expect(result.structure).toBe('regional_license');
      expect(result.confidence).toBe(0.90);
    });

    it('routes japan territory to regional_license', () => {
      const result = classifyDealStructure(makeInput({ territory: 'japan' }));
      expect(result.structure).toBe('regional_license');
    });

    it('routes europe territory to regional_license', () => {
      const result = classifyDealStructure(makeInput({ territory: 'europe' }));
      expect(result.structure).toBe('regional_license');
    });

    it('routes asia_pacific territory to regional_license', () => {
      const result = classifyDealStructure(makeInput({ territory: 'asia_pacific' }));
      expect(result.structure).toBe('regional_license');
    });

    it('does NOT route global territory to regional_license', () => {
      const result = classifyDealStructure(makeInput({ territory: 'global' }));
      expect(result.structure).not.toBe('regional_license');
    });
  });

  describe('classic_license (default fallback)', () => {
    it('falls back to classic_license for standard licensing deal', () => {
      const result = classifyDealStructure(makeInput());
      expect(result.structure).toBe('classic_license');
      expect(result.confidence).toBe(0.70);
    });

    it('falls back to classic_license for unknown dealType', () => {
      const result = classifyDealStructure(
        makeInput({ dealType: 'unknown_deal_type' }),
      );
      expect(result.structure).toBe('classic_license');
    });

    it('falls back to classic_license for empty dealType', () => {
      const result = classifyDealStructure(makeInput({ dealType: '' }));
      expect(result.structure).toBe('classic_license');
    });

    it('always includes at least one signal', () => {
      const result = classifyDealStructure(makeInput());
      expect(result.signals.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// classifyDealStructure — priority ordering
// ---------------------------------------------------------------------------

describe('classifyDealStructure priority ordering', () => {
  it('acquisition takes priority over biosimilar licensor', () => {
    const result = classifyDealStructure(
      makeInput({ dealType: 'acquisition', licensor: 'Celltrion' }),
    );
    expect(result.structure).toBe('strategic_acquisition');
  });

  it('biosimilar licensor takes priority over option dealType', () => {
    const result = classifyDealStructure(
      makeInput({ dealType: 'option', licensor: 'Shanghai Henlius' }),
    );
    expect(result.structure).toBe('biosimilar_license');
  });

  it('option dealType takes priority over regional territory', () => {
    const result = classifyDealStructure(
      makeInput({ dealType: 'option', territory: 'china' }),
    );
    expect(result.structure).toBe('option_style');
  });

  it('early-phase collaboration takes priority over regional territory', () => {
    const result = classifyDealStructure(
      makeInput({ dealType: 'collaboration', phase: 'phase1', territory: 'japan' }),
    );
    expect(result.structure).toBe('option_style');
  });

  it('mid-phase collaboration takes priority over regional territory', () => {
    const result = classifyDealStructure(
      makeInput({ dealType: 'collaboration', phase: 'phase3', territory: 'china' }),
    );
    expect(result.structure).toBe('platform_collab');
  });
});

// ---------------------------------------------------------------------------
// getUpfrontPercentByStructure — upfront ratio validity
// ---------------------------------------------------------------------------

describe('getUpfrontPercentByStructure', () => {
  const PHASES = [
    'preclinical', 'phase1', 'phase_1', 'phase1_2', 'phase_1_2',
    'phase2', 'phase_2', 'phase2_3', 'phase_2_3', 'phase3', 'phase_3',
    'nda_filed', 'approved',
  ];

  it.each(ALL_STRUCTURES)(
    '%s produces upfront ratios in [0, 1]',
    (structure) => {
      for (const phase of PHASES) {
        const pct = getUpfrontPercentByStructure(structure, phase, 1.0);
        expect(pct.low).toBeGreaterThanOrEqual(0);
        expect(pct.low).toBeLessThanOrEqual(1);
        expect(pct.median).toBeGreaterThanOrEqual(0);
        expect(pct.median).toBeLessThanOrEqual(1);
        expect(pct.high).toBeGreaterThanOrEqual(0);
        expect(pct.high).toBeLessThanOrEqual(1);
      }
    },
  );

  it('low <= median <= high for all structures and phases', () => {
    for (const structure of ALL_STRUCTURES) {
      for (const phase of PHASES) {
        const pct = getUpfrontPercentByStructure(structure, phase, 1.0);
        expect(pct.low).toBeLessThanOrEqual(pct.median);
        expect(pct.median).toBeLessThanOrEqual(pct.high);
      }
    }
  });

  it('option_style has lower median than classic_license for same phase', () => {
    const option = getUpfrontPercentByStructure('option_style', 'phase2', 1.0);
    const classic = getUpfrontPercentByStructure('classic_license', 'phase2', 1.0);
    expect(option.median).toBeLessThan(classic.median);
  });

  it('strategic_acquisition has high upfront (>0.70)', () => {
    const acq = getUpfrontPercentByStructure('strategic_acquisition', 'phase2', 1.0);
    expect(acq.low).toBeGreaterThanOrEqual(0.70);
    expect(acq.median).toBeGreaterThan(0.80);
  });

  it('biosimilar_license is a fraction of classic_license', () => {
    const bio = getUpfrontPercentByStructure('biosimilar_license', 'phase2', 1.0);
    const classic = getUpfrontPercentByStructure('classic_license', 'phase2', 1.0);
    expect(bio.median).toBeLessThan(classic.median);
    // Biosimilar is 35% of classic
    expect(bio.median).toBeCloseTo(classic.median * 0.35, 4);
  });

  it('falls back to phase2 defaults for unknown phase', () => {
    const known = getUpfrontPercentByStructure('classic_license', 'phase2', 1.0);
    const unknown = getUpfrontPercentByStructure('classic_license', 'unknown_phase', 1.0);
    expect(unknown.median).toBe(known.median);
  });
});

// ---------------------------------------------------------------------------
// Confidence blending
// ---------------------------------------------------------------------------

describe('confidence blending', () => {
  it('confidence >= 0.95 returns pure picked structure (no blending)', () => {
    const pure = getUpfrontPercentByStructure('option_style', 'phase2', 0.95);
    const full = getUpfrontPercentByStructure('option_style', 'phase2', 1.0);
    expect(pure.median).toBe(full.median);
  });

  it('confidence < 0.95 blends toward classic_license', () => {
    const classic = getUpfrontPercentByStructure('classic_license', 'phase2', 1.0);
    const option = getUpfrontPercentByStructure('option_style', 'phase2', 1.0);
    const blended = getUpfrontPercentByStructure('option_style', 'phase2', 0.70);

    // Blended median should be between option and classic
    expect(blended.median).toBeGreaterThan(option.median);
    expect(blended.median).toBeLessThan(classic.median);
  });

  it('classic_license skips blending regardless of confidence', () => {
    const full = getUpfrontPercentByStructure('classic_license', 'phase2', 1.0);
    const low = getUpfrontPercentByStructure('classic_license', 'phase2', 0.50);
    expect(low.median).toBe(full.median);
  });

  it('confidence is clamped to [0, 1]', () => {
    // confidence = 0 should return pure classic
    const classic = getUpfrontPercentByStructure('classic_license', 'phase2', 1.0);
    const zero = getUpfrontPercentByStructure('option_style', 'phase2', 0.0);
    expect(zero.median).toBeCloseTo(classic.median, 4);
  });
});

// ---------------------------------------------------------------------------
// resolveUpfrontStructure — convenience wrapper
// ---------------------------------------------------------------------------

describe('resolveUpfrontStructure', () => {
  it('returns both classification and upfrontPercent', () => {
    const result = resolveUpfrontStructure(makeInput());
    expect(result.classification).toBeDefined();
    expect(result.classification.structure).toBe('classic_license');
    expect(result.upfrontPercent).toBeDefined();
    expect(result.upfrontPercent.low).toBeDefined();
    expect(result.upfrontPercent.median).toBeDefined();
    expect(result.upfrontPercent.high).toBeDefined();
  });

  it('acquisition produces high upfront percent', () => {
    const result = resolveUpfrontStructure(makeInput({ dealType: 'acquisition' }));
    expect(result.classification.structure).toBe('strategic_acquisition');
    expect(result.upfrontPercent.median).toBeGreaterThan(0.80);
  });

  it('option deal produces low upfront percent', () => {
    const result = resolveUpfrontStructure(makeInput({ dealType: 'option', phase: 'phase2' }));
    expect(result.classification.structure).toBe('option_style');
    expect(result.upfrontPercent.median).toBeLessThan(0.15);
  });

  it('all 6 regimes produce valid results through resolveUpfrontStructure', () => {
    const inputs: DealStructureInput[] = [
      makeInput({ dealType: 'licensing' }),                                         // classic_license
      makeInput({ dealType: 'option' }),                                            // option_style
      makeInput({ dealType: 'collaboration', phase: 'phase3' }),                    // platform_collab
      makeInput({ territory: 'japan' }),                                            // regional_license
      makeInput({ licensor: 'Sandoz' }),                                            // biosimilar_license
      makeInput({ dealType: 'acquisition' }),                                       // strategic_acquisition
    ];

    const expectedStructures: DealStructure[] = [
      'classic_license', 'option_style', 'platform_collab',
      'regional_license', 'biosimilar_license', 'strategic_acquisition',
    ];

    for (let i = 0; i < inputs.length; i++) {
      const result = resolveUpfrontStructure(inputs[i]);
      expect(result.classification.structure).toBe(expectedStructures[i]);
      expect(result.upfrontPercent.low).toBeGreaterThanOrEqual(0);
      expect(result.upfrontPercent.high).toBeLessThanOrEqual(1);
      expect(result.upfrontPercent.low).toBeLessThanOrEqual(result.upfrontPercent.median);
      expect(result.upfrontPercent.median).toBeLessThanOrEqual(result.upfrontPercent.high);
    }
  });
});
