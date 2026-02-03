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

// Base input for consistent testing
const baseInput: CalculationInput = {
  phase: 'phase2' as Phase,
  modality: 'smallMolecule' as Modality,
  indication: 'lung_nsclc' as Indication,
  territory: 'global' as Territory,
  biomarker: 'unselected' as BiomarkerStatus,
  lineOfTherapy: '2L' as LineOfTherapy,
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

describe('calculateDealTerms', () => {
  describe('basic calculations', () => {
    it('should return valid deal terms structure', () => {
      const result = calculateDealTerms(baseInput);

      expect(result).toHaveProperty('terms');
      expect(result).toHaveProperty('tieredRoyalties');
      expect(result).toHaveProperty('dealRecommendation');
      expect(result).toHaveProperty('negotiationInsight');
      expect(result).toHaveProperty('modifiers');
      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('drillDown');
      expect(result).toHaveProperty('phase');
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

  // ============================================================
  // MULTIPLIER STACKING TESTS (CALC-001 to CALC-009)
  // ============================================================
  describe('multiplier stacking', () => {
    it('CALC-001: modality multiplier at power 1.0 (radiopharmaceutical = 1.60)', () => {
      const smallMolResult = calculateDealTerms({ ...baseInput, modality: 'smallMolecule' as Modality });
      const radioResult = calculateDealTerms({ ...baseInput, modality: 'radiopharmaceutical' as Modality });

      // Radiopharmaceutical (1.60x) should be significantly higher than small molecule (1.0x)
      // The ratio should be close to 1.60 (full power 1.0)
      const ratio = radioResult.terms.totalDealValue.median / smallMolResult.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(1.4);
      expect(ratio).toBeLessThan(1.8);
    });

    it('CALC-002: indication multiplier dampened at power 0.8', () => {
      const baselineResult = calculateDealTerms({ ...baseInput, indication: 'melanoma' as Indication }); // 1.0x
      const premiumResult = calculateDealTerms({ ...baseInput, indication: 'gbm' as Indication }); // 1.28x

      // GBM (1.28^0.8 ≈ 1.22) should be higher than melanoma (1.0^0.8 = 1.0)
      const ratio = premiumResult.terms.totalDealValue.median / baselineResult.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(1.1);
      expect(ratio).toBeLessThan(1.35); // Dampened, not full 1.28
    });

    it('CALC-003: territory multiplier at power 1.0 (us_only = 0.55)', () => {
      const globalResult = calculateDealTerms({ ...baseInput, territory: 'global' as Territory }); // 1.0x
      const usOnlyResult = calculateDealTerms({ ...baseInput, territory: 'us_only' as Territory }); // 0.55x

      // US-only should be roughly 55% of global
      const ratio = usOnlyResult.terms.totalDealValue.median / globalResult.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(0.45);
      expect(ratio).toBeLessThan(0.65);
    });

    it('CALC-004: biomarker multiplier at power 0.9', () => {
      const unselectedResult = calculateDealTerms({ ...baseInput, biomarker: 'unselected' as BiomarkerStatus }); // 1.0x
      const selectedResult = calculateDealTerms({ ...baseInput, biomarker: 'selected' as BiomarkerStatus }); // 1.15x

      // Selected (1.15^0.9 ≈ 1.13) should be higher
      const ratio = selectedResult.terms.totalDealValue.median / unselectedResult.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(1.05);
      expect(ratio).toBeLessThan(1.2);
    });

    it('CALC-005: line of therapy multiplier at power 0.85', () => {
      const secondLineResult = calculateDealTerms({ ...baseInput, lineOfTherapy: '2L' as LineOfTherapy }); // 1.0x
      const firstLineResult = calculateDealTerms({ ...baseInput, lineOfTherapy: '1L' as LineOfTherapy }); // 1.25x

      // 1L (1.25^0.85 ≈ 1.21) should be higher than 2L
      const ratio = firstLineResult.terms.totalDealValue.median / secondLineResult.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(1.1);
      expect(ratio).toBeLessThan(1.3);
    });

    it('CALC-006: combination potential at power 0.75', () => {
      const standaloneResult = calculateDealTerms({ ...baseInput, combinationPotential: 'standalone' as CombinationPotential }); // 1.0x
      const strongResult = calculateDealTerms({ ...baseInput, combinationPotential: 'strong' as CombinationPotential }); // 1.20x

      // Strong combo (1.20^0.75 ≈ 1.15) should be higher
      const ratio = strongResult.terms.totalDealValue.median / standaloneResult.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(1.05);
      expect(ratio).toBeLessThan(1.25);
    });

    it('CALC-007: competitive position at power 0.7', () => {
      const racingResult = calculateDealTerms({ ...baseInput, competitivePosition: 'racing' as CompetitivePosition }); // 1.0x
      const firstInClassResult = calculateDealTerms({ ...baseInput, competitivePosition: 'firstInClass' as CompetitivePosition }); // 1.25x

      // First-in-class (1.25^0.7 ≈ 1.17) should be higher
      const ratio = firstInClassResult.terms.totalDealValue.median / racingResult.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(1.05);
      expect(ratio).toBeLessThan(1.25);
    });

    it('CALC-008: data quality at power 0.5 (most dampened)', () => {
      const promisingResult = calculateDealTerms({ ...baseInput, dataQuality: 'promising' as DataQuality }); // 1.0x
      const pivotalReadyResult = calculateDealTerms({ ...baseInput, dataQuality: 'pivotalReady' as DataQuality }); // 1.15x

      // Pivotal-ready (1.15^0.5 ≈ 1.07) should be modestly higher
      const ratio = pivotalReadyResult.terms.totalDealValue.median / promisingResult.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(1.02);
      expect(ratio).toBeLessThan(1.15); // Heavily dampened
    });

    it('CALC-009: full multiplier stacking combines all factors', () => {
      // Baseline: all neutral values
      const baselineResult = calculateDealTerms(baseInput);

      // Premium: all positive multipliers
      const premiumResult = calculateDealTerms({
        ...baseInput,
        modality: 'radiopharmaceutical' as Modality, // 1.60x
        indication: 'gbm' as Indication, // 1.28x
        biomarker: 'selected' as BiomarkerStatus, // 1.15x
        lineOfTherapy: '1L' as LineOfTherapy, // 1.25x
        combinationPotential: 'strong' as CombinationPotential, // 1.20x
        competitivePosition: 'firstInClass' as CompetitivePosition, // 1.25x
        dataQuality: 'pivotalReady' as DataQuality, // 1.15x
      });

      // Premium should be significantly higher due to stacking
      const ratio = premiumResult.terms.totalDealValue.median / baselineResult.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(2.0); // Multiple premium factors compound
      expect(ratio).toBeLessThan(5.0); // But dampening prevents extreme values
    });
  });

  // ============================================================
  // REGULATORY BONUS TESTS (CALC-010 to CALC-016)
  // ============================================================
  describe('regulatory designations', () => {
    it('CALC-010: breakthrough designation adds +12% bonus', () => {
      const withoutDesignation = calculateDealTerms(baseInput);
      const withBreakthrough = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: { ...baseInput.regulatoryDesignations, breakthrough: true },
      });

      const ratio = withBreakthrough.terms.totalDealValue.median / withoutDesignation.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(1.10);
      expect(ratio).toBeLessThan(1.15);
    });

    it('CALC-011: fastTrack designation adds +6% bonus', () => {
      const withoutDesignation = calculateDealTerms(baseInput);
      const withFastTrack = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: { ...baseInput.regulatoryDesignations, fastTrack: true },
      });

      const ratio = withFastTrack.terms.totalDealValue.median / withoutDesignation.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(1.04);
      expect(ratio).toBeLessThan(1.08);
    });

    it('CALC-012: orphan designation adds +8% bonus', () => {
      const withoutDesignation = calculateDealTerms(baseInput);
      const withOrphan = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: { ...baseInput.regulatoryDesignations, orphan: true },
      });

      const ratio = withOrphan.terms.totalDealValue.median / withoutDesignation.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(1.06);
      expect(ratio).toBeLessThan(1.10);
    });

    it('CALC-013: PRIME (EU) designation adds +5% bonus', () => {
      const withoutDesignation = calculateDealTerms(baseInput);
      const withPrime = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: { ...baseInput.regulatoryDesignations, prime: true },
      });

      const ratio = withPrime.terms.totalDealValue.median / withoutDesignation.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(1.03);
      expect(ratio).toBeLessThan(1.07);
    });

    it('CALC-014: combined bonus is CAPPED at 20% (not 31%)', () => {
      const withoutDesignation = calculateDealTerms(baseInput);
      const withAllDesignations = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: {
          breakthrough: true, // 12%
          fastTrack: true,    // 6%
          orphan: true,       // 8%
          prime: true,        // 5%
          // Total uncapped: 31%
        },
      });

      // Should be capped at 20%
      const ratio = withAllDesignations.terms.totalDealValue.median / withoutDesignation.terms.totalDealValue.median;
      expect(ratio).toBeGreaterThan(1.18);
      expect(ratio).toBeLessThanOrEqual(1.22); // Capped at ~20%
    });

    it('CALC-015: no designations = 0% bonus', () => {
      const result = calculateDealTerms(baseInput);

      // Check that no regulatory modifiers are present
      const regModifiers = result.modifiers.filter(m =>
        m.name.toLowerCase().includes('breakthrough') ||
        m.name.toLowerCase().includes('fast track') ||
        m.name.toLowerCase().includes('orphan') ||
        m.name.toLowerCase().includes('prime')
      );
      expect(regModifiers.length).toBe(0);
    });

    it('should have breakthrough modifier in modifiers list when enabled', () => {
      const result = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: { ...baseInput.regulatoryDesignations, breakthrough: true },
      });

      const hasBreakthroughModifier = result.modifiers.some(
        (m) => m.name.toLowerCase().includes('breakthrough')
      );
      expect(hasBreakthroughModifier).toBe(true);
    });

    it('should stack multiple regulatory designations (up to cap)', () => {
      const singleDesignation = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: {
          fastTrack: true,
          breakthrough: false,
          orphan: false,
          prime: false,
        },
      });

      const multipleDesignations = calculateDealTerms({
        ...baseInput,
        regulatoryDesignations: {
          fastTrack: true,
          breakthrough: true,
          orphan: true,
          prime: false,
        },
      });

      expect(multipleDesignations.terms.totalDealValue.median).toBeGreaterThan(
        singleDesignation.terms.totalDealValue.median
      );
    });
  });

  // ============================================================
  // PHASE BASELINE TESTS (CALC-020 to CALC-027)
  // ============================================================
  describe('phase baselines', () => {
    it('CALC-020: preclinical baseline values', () => {
      const result = calculateDealTerms({ ...baseInput, phase: 'preclinical' as Phase });

      // Preclinical: Total $400M median baseline (before multipliers)
      // With lung_nsclc (1.22^0.8) and other factors, should be modestly adjusted
      expect(result.terms.totalDealValue.median).toBeGreaterThan(200);
      expect(result.terms.totalDealValue.median).toBeLessThan(1000);
    });

    it('CALC-021: phase 1 baseline values', () => {
      const result = calculateDealTerms({ ...baseInput, phase: 'phase1' as Phase });

      // Phase 1: Total $700M median baseline
      expect(result.terms.totalDealValue.median).toBeGreaterThan(400);
      expect(result.terms.totalDealValue.median).toBeLessThan(1500);
    });

    it('CALC-022: phase 2 baseline values', () => {
      const result = calculateDealTerms({ ...baseInput, phase: 'phase2' as Phase });

      // Phase 2: Total $1300M median baseline
      expect(result.terms.totalDealValue.median).toBeGreaterThan(700);
      expect(result.terms.totalDealValue.median).toBeLessThan(3000);
    });

    it('CALC-023: phase 3 baseline values', () => {
      const result = calculateDealTerms({ ...baseInput, phase: 'phase3' as Phase });

      // Phase 3: Total $2500M median baseline
      expect(result.terms.totalDealValue.median).toBeGreaterThan(1400);
      expect(result.terms.totalDealValue.median).toBeLessThan(5500);
    });

    it('CALC-024: approved baseline values', () => {
      const result = calculateDealTerms({ ...baseInput, phase: 'approved' as Phase });

      // Approved: Total $4500M median baseline
      expect(result.terms.totalDealValue.median).toBeGreaterThan(2500);
      expect(result.terms.totalDealValue.median).toBeLessThan(10000);
    });

    it('CALC-025: preclinical has widest range (±60%)', () => {
      const result = calculateDealTerms({ ...baseInput, phase: 'preclinical' as Phase });

      const rangeWidth = (result.terms.totalDealValue.high - result.terms.totalDealValue.low) /
        (2 * result.terms.totalDealValue.median);
      expect(rangeWidth).toBeGreaterThan(0.5);
      expect(rangeWidth).toBeLessThan(0.7);
    });

    it('CALC-026: phase 3 has tighter range (±25%)', () => {
      const result = calculateDealTerms({ ...baseInput, phase: 'phase3' as Phase });

      const rangeWidth = (result.terms.totalDealValue.high - result.terms.totalDealValue.low) /
        (2 * result.terms.totalDealValue.median);
      expect(rangeWidth).toBeGreaterThan(0.2);
      expect(rangeWidth).toBeLessThan(0.3);
    });

    it('CALC-027: approved has tightest range (±15%)', () => {
      const result = calculateDealTerms({ ...baseInput, phase: 'approved' as Phase });

      const rangeWidth = (result.terms.totalDealValue.high - result.terms.totalDealValue.low) /
        (2 * result.terms.totalDealValue.median);
      expect(rangeWidth).toBeGreaterThan(0.1);
      expect(rangeWidth).toBeLessThan(0.2);
    });
  });

  // ============================================================
  // ROYALTY TIER TESTS (CALC-040 to CALC-044)
  // ============================================================
  describe('tiered royalties', () => {
    it('CALC-040: royalty uses dampened multiplier (power 0.3)', () => {
      const baselineResult = calculateDealTerms(baseInput);
      const premiumResult = calculateDealTerms({
        ...baseInput,
        modality: 'radiopharmaceutical' as Modality,
      });

      // Deal value ratio should be higher than royalty ratio due to dampening
      const dealRatio = premiumResult.terms.totalDealValue.median / baselineResult.terms.totalDealValue.median;
      const royaltyRatio = premiumResult.tieredRoyalties.base.low / baselineResult.tieredRoyalties.base.low;

      // Royalty change should be less than deal value change
      expect(royaltyRatio).toBeLessThan(dealRatio);
    });

    it('CALC-041: base tier caps at 25% low, 30% high', () => {
      // Use premium factors to push royalties high
      const result = calculateDealTerms({
        ...baseInput,
        phase: 'approved' as Phase,
        modality: 'radiopharmaceutical' as Modality,
        indication: 'gbm' as Indication,
      });

      expect(result.tieredRoyalties.base.low).toBeLessThanOrEqual(25);
      expect(result.tieredRoyalties.base.high).toBeLessThanOrEqual(30);
    });

    it('CALC-042: mid tier caps at 28% low, 33% high', () => {
      const result = calculateDealTerms({
        ...baseInput,
        phase: 'approved' as Phase,
        modality: 'radiopharmaceutical' as Modality,
      });

      expect(result.tieredRoyalties.midTier.low).toBeLessThanOrEqual(28);
      expect(result.tieredRoyalties.midTier.high).toBeLessThanOrEqual(33);
    });

    it('CALC-043: high tier caps at 30% low, 35% high', () => {
      const result = calculateDealTerms({
        ...baseInput,
        phase: 'approved' as Phase,
        modality: 'radiopharmaceutical' as Modality,
      });

      expect(result.tieredRoyalties.highTier.low).toBeLessThanOrEqual(30);
      expect(result.tieredRoyalties.highTier.high).toBeLessThanOrEqual(35);
    });

    it('CALC-044: tier ordering is base <= midTier <= highTier', () => {
      const result = calculateDealTerms(baseInput);

      expect(result.tieredRoyalties.midTier.low).toBeGreaterThanOrEqual(result.tieredRoyalties.base.low);
      expect(result.tieredRoyalties.highTier.low).toBeGreaterThanOrEqual(result.tieredRoyalties.midTier.low);
      expect(result.tieredRoyalties.midTier.high).toBeGreaterThanOrEqual(result.tieredRoyalties.base.high);
      expect(result.tieredRoyalties.highTier.high).toBeGreaterThanOrEqual(result.tieredRoyalties.midTier.high);
    });

    it('should have royalties within reasonable bounds (0-35%)', () => {
      const result = calculateDealTerms(baseInput);

      expect(result.tieredRoyalties.base.low).toBeGreaterThanOrEqual(0);
      expect(result.tieredRoyalties.highTier.high).toBeLessThanOrEqual(35);
    });
  });

  // ============================================================
  // MILESTONE ALLOCATION TESTS (CALC-050 to CALC-052)
  // ============================================================
  describe('milestone allocations', () => {
    it('CALC-050: preclinical milestones - dev 50%, reg 30%, comm 20%', () => {
      const result = calculateDealTerms({ ...baseInput, phase: 'preclinical' as Phase });

      const totalMilestones = result.terms.devMilestones.median +
        result.terms.regMilestones.median +
        result.terms.commMilestones.median;

      const devPercent = result.terms.devMilestones.median / totalMilestones;
      const regPercent = result.terms.regMilestones.median / totalMilestones;
      const commPercent = result.terms.commMilestones.median / totalMilestones;

      expect(devPercent).toBeCloseTo(0.50, 1);
      expect(regPercent).toBeCloseTo(0.30, 1);
      expect(commPercent).toBeCloseTo(0.20, 1);
    });

    it('CALC-051: approved milestones - dev 5%, reg 25%, comm 70%', () => {
      const result = calculateDealTerms({ ...baseInput, phase: 'approved' as Phase });

      const totalMilestones = result.terms.devMilestones.median +
        result.terms.regMilestones.median +
        result.terms.commMilestones.median;

      const devPercent = result.terms.devMilestones.median / totalMilestones;
      const regPercent = result.terms.regMilestones.median / totalMilestones;
      const commPercent = result.terms.commMilestones.median / totalMilestones;

      expect(devPercent).toBeCloseTo(0.05, 1);
      expect(regPercent).toBeCloseTo(0.25, 1);
      expect(commPercent).toBeCloseTo(0.70, 1);
    });

    it('CALC-052: milestone sum equals total minus upfront', () => {
      const result = calculateDealTerms(baseInput);

      const upfront = result.terms.upfront.median;
      const totalMilestones = result.terms.devMilestones.median +
        result.terms.regMilestones.median +
        result.terms.commMilestones.median;
      const totalValue = result.terms.totalDealValue.median;

      // Allow for rounding differences
      expect(Math.abs(totalValue - upfront - totalMilestones)).toBeLessThan(5);
    });
  });

  // ============================================================
  // DEAL RECOMMENDATION TESTS
  // ============================================================
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

    it('high-risk profile should recommend lower upfront percentage', () => {
      // High risk: early phase + crowded + limited data
      const highRiskResult = calculateDealTerms({
        ...baseInput,
        phase: 'preclinical' as Phase,
        competitivePosition: 'crowded' as CompetitivePosition,
        dataQuality: 'limited' as DataQuality,
      });

      // Low risk: late phase + first-in-class + pivotal-ready
      const lowRiskResult = calculateDealTerms({
        ...baseInput,
        phase: 'phase3' as Phase,
        competitivePosition: 'firstInClass' as CompetitivePosition,
        dataQuality: 'pivotalReady' as DataQuality,
      });

      expect(highRiskResult.dealRecommendation.upfrontPercent).toBeLessThan(
        lowRiskResult.dealRecommendation.upfrontPercent
      );
    });
  });

  // ============================================================
  // LABELS TESTS
  // ============================================================
  describe('labels', () => {
    it('should return human-readable labels', () => {
      const result = calculateDealTerms(baseInput);

      expect(result.labels.phase).toBeTruthy();
      expect(result.labels.modality).toBeTruthy();
      expect(result.labels.indication).toBeTruthy();
    });

    it('should return correct phase label', () => {
      const result = calculateDealTerms({ ...baseInput, phase: 'phase2' as Phase });
      expect(result.labels.phase).toBe('Phase 2');
    });
  });

  // ============================================================
  // EDGE CASES TESTS
  // ============================================================
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
          prime: true,
        },
      });

      expect(result.terms.totalDealValue.median).toBeGreaterThan(0);
      expect(result.modifiers.length).toBeGreaterThanOrEqual(4); // At least 4 regulatory modifiers
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

    it('should handle all negative multipliers combined', () => {
      // All penalty factors
      const result = calculateDealTerms({
        ...baseInput,
        territory: 'china' as Territory, // 0.22x
        lineOfTherapy: '3L+' as LineOfTherapy, // 0.85x
        competitivePosition: 'crowded' as CompetitivePosition, // 0.70x
        dataQuality: 'limited' as DataQuality, // 0.75x
      });

      // Should still produce positive values
      expect(result.terms.totalDealValue.median).toBeGreaterThan(0);
      expect(result.terms.upfront.median).toBeGreaterThan(0);
    });

    it('should handle extreme premium scenario', () => {
      const result = calculateDealTerms({
        ...baseInput,
        phase: 'approved' as Phase,
        modality: 'radiopharmaceutical' as Modality,
        indication: 'lung_sclc' as Indication,
        biomarker: 'selected' as BiomarkerStatus,
        lineOfTherapy: '1L' as LineOfTherapy,
        combinationPotential: 'strong' as CombinationPotential,
        competitivePosition: 'firstInClass' as CompetitivePosition,
        dataQuality: 'pivotalReady' as DataQuality,
        regulatoryDesignations: {
          breakthrough: true,
          fastTrack: true,
          orphan: true,
          prime: true,
        },
      });

      // Should produce high but reasonable values
      expect(result.terms.totalDealValue.median).toBeGreaterThan(5000);
      expect(result.terms.totalDealValue.median).toBeLessThan(50000); // Not unreasonable
    });
  });

  // ============================================================
  // MODALITY VARIATIONS TESTS
  // ============================================================
  describe('modality variations', () => {
    it('should return different values for different modalities', () => {
      const smallMolResult = calculateDealTerms({ ...baseInput, modality: 'smallMolecule' as Modality });
      const adcResult = calculateDealTerms({ ...baseInput, modality: 'adc' as Modality });
      const radioResult = calculateDealTerms({ ...baseInput, modality: 'radiopharmaceutical' as Modality });

      expect(adcResult.terms.totalDealValue.median).not.toBe(smallMolResult.terms.totalDealValue.median);
      expect(radioResult.terms.totalDealValue.median).not.toBe(smallMolResult.terms.totalDealValue.median);
    });

    it('radiopharmaceutical should command highest premium', () => {
      const radioResult = calculateDealTerms({ ...baseInput, modality: 'radiopharmaceutical' as Modality });
      const adcResult = calculateDealTerms({ ...baseInput, modality: 'adc' as Modality });
      const smallMolResult = calculateDealTerms({ ...baseInput, modality: 'smallMolecule' as Modality });

      expect(radioResult.terms.totalDealValue.median).toBeGreaterThan(adcResult.terms.totalDealValue.median);
      expect(radioResult.terms.totalDealValue.median).toBeGreaterThan(smallMolResult.terms.totalDealValue.median);
    });
  });

  // ============================================================
  // DRILL-DOWN DATA TESTS
  // ============================================================
  describe('drill-down data', () => {
    it('should include range explanation for each metric', () => {
      const result = calculateDealTerms(baseInput);

      expect(result.drillDown.upfront.rangeExplanation).toBeTruthy();
      expect(result.drillDown.totalDealValue.rangeExplanation).toBeTruthy();
      expect(result.drillDown.devMilestones.rangeExplanation).toBeTruthy();
      expect(result.drillDown.regMilestones.rangeExplanation).toBeTruthy();
      expect(result.drillDown.commMilestones.rangeExplanation).toBeTruthy();
      expect(result.drillDown.royalties.rangeExplanation).toBeTruthy();
    });

    it('should include factor impacts', () => {
      const result = calculateDealTerms({
        ...baseInput,
        modality: 'radiopharmaceutical' as Modality, // Premium factor
      });

      expect(result.drillDown.totalDealValue.factors.length).toBeGreaterThan(0);
      expect(result.drillDown.totalDealValue.factors.some(f => f.impact === 'positive')).toBe(true);
    });

    it('should include milestone breakdown for development milestones', () => {
      const result = calculateDealTerms(baseInput);

      expect(result.drillDown.devMilestones.breakdown).toBeDefined();
      expect(result.drillDown.devMilestones.breakdown!.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// FORMAT CURRENCY TESTS
// ============================================================
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

// ============================================================
// FORMAT RANGE TESTS
// ============================================================
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

// ============================================================
// GOLDEN FILE VALIDATION - Representative Scenarios
// ============================================================
describe('golden file validation', () => {
  const goldenScenarios = [
    {
      name: 'Phase 2 Small Molecule Baseline',
      input: baseInput,
      expectedTotalRange: { min: 800, max: 2000 },
    },
    {
      name: 'Phase 3 ADC Premium',
      input: {
        ...baseInput,
        phase: 'phase3' as Phase,
        modality: 'adc' as Modality,
      },
      expectedTotalRange: { min: 2500, max: 5500 },
    },
    {
      name: 'Preclinical Radiopharmaceutical',
      input: {
        ...baseInput,
        phase: 'preclinical' as Phase,
        modality: 'radiopharmaceutical' as Modality,
      },
      expectedTotalRange: { min: 300, max: 1000 },
    },
    {
      name: 'Approved First-in-Class',
      input: {
        ...baseInput,
        phase: 'approved' as Phase,
        competitivePosition: 'firstInClass' as CompetitivePosition,
      },
      expectedTotalRange: { min: 4000, max: 8000 },
    },
    {
      name: 'Phase 2 High Unmet Need (GBM)',
      input: {
        ...baseInput,
        indication: 'gbm' as Indication,
      },
      expectedTotalRange: { min: 900, max: 2500 },
    },
  ];

  goldenScenarios.forEach(scenario => {
    it(`should match expected range for: ${scenario.name}`, () => {
      const result = calculateDealTerms(scenario.input);

      expect(result.terms.totalDealValue.median).toBeGreaterThanOrEqual(scenario.expectedTotalRange.min);
      expect(result.terms.totalDealValue.median).toBeLessThanOrEqual(scenario.expectedTotalRange.max);
    });
  });
});
