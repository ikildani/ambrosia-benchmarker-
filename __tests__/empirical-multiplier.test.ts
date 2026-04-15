/**
 * R67 Empirical Multiplier — invariant + regression tests
 *
 * Guards against the R42+R50+R61 multiplicative-stacking regression that
 * produced 15-20× multipliers on Phase 2 oncology acquisitions (double-
 * counting the same undershoot correction across multiple calibration
 * rounds).
 */

import {
  computeEmpiricalMultiplier,
  isTier1Asset,
  HARD_CAP,
  ADDITIVE_CAP,
  FLOOR,
  TA_UPLIFT,
  MODALITY_UPLIFT,
  PHASE_DEALTYPE_BASE,
} from '../lib/financial/empirical-multiplier';
import type { RNPVInput } from '../lib/financial/types';

function makeInput(overrides: Partial<RNPVInput> = {}): RNPVInput {
  return {
    therapeuticArea: 'oncology',
    phase: 'phase2',
    modality: 'adc',
    dealType: 'licensing',
    territory: 'global',
    biomarkerStatus: 'unselected',
    competitivePosition: 'racing',
    dataQuality: 'promising',
    lineOfTherapy: '1L',
    combinationPotential: 'some',
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
    discountRate: 0.12,
    peakSalesEstimate: { low: 500, median: 1000, high: 2000 },
    indication: 'breast_her2',
    ...overrides,
  } as RNPVInput;
}

describe('empirical-multiplier invariants', () => {
  it('never exceeds HARD_CAP across all parameter combinations', () => {
    const tas = ['oncology', 'neurology', 'infectiousDisease', 'rareDisease', 'immunology', 'hematology', 'metabolic', 'cardiovascular'];
    const phases = ['discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved'];
    const dealTypes = ['licensing', 'acquisition', 'codevelopment', 'collaboration', 'option'];
    const modalities = ['smallMolecule', 'adc', 'bispecific', 'radiopharmaceutical', 'rnai', 'protac', 'mrna', 'enzymeReplacement', 'geneTherapyRare', 'mab', 'carT_heme'];
    const cps = ['firstInClass', 'bestInClass', 'racing', 'crowded', 'behind'];
    const dqs = ['strongPhase2', 'pivotalReady', 'promising', 'mixed', 'limited'];

    // All four regulatory designations on = most aggressive stacking scenario
    const allRegOn = { breakthrough: true, orphan: true, fastTrack: true, prime: true };

    let maxSeen = 0;
    let maxCase = '';
    for (const ta of tas)
      for (const phase of phases)
        for (const dealType of dealTypes)
          for (const mod of modalities)
            for (const cp of cps)
              for (const dq of dqs) {
                const input = makeInput({
                  therapeuticArea: ta, phase, modality: mod, dealType,
                  competitivePosition: cp as RNPVInput['competitivePosition'],
                  dataQuality: dq as RNPVInput['dataQuality'],
                  regulatoryDesignations: allRegOn,
                });
                const m = computeEmpiricalMultiplier(input);
                expect(m).toBeLessThanOrEqual(HARD_CAP);
                expect(m).toBeGreaterThanOrEqual(FLOOR);
                if (m > maxSeen) { maxSeen = m; maxCase = `${ta}/${phase}/${dealType}/${mod}/${cp}/${dq}`; }
              }
    console.log(`  max multiplier observed: ${maxSeen.toFixed(2)}× for ${maxCase}`);
    expect(maxSeen).toBeLessThanOrEqual(HARD_CAP);
  });

  it('acquisition > licensing at same (TA, phase, modality, asset quality)', () => {
    const common: Partial<RNPVInput> = {
      therapeuticArea: 'oncology',
      phase: 'phase2',
      modality: 'adc',
      competitivePosition: 'firstInClass',
      dataQuality: 'strongPhase2',
      regulatoryDesignations: { breakthrough: true, fastTrack: false, orphan: false, prime: false },
    };
    const lic = computeEmpiricalMultiplier(makeInput({ ...common, dealType: 'licensing' }));
    const acq = computeEmpiricalMultiplier(makeInput({ ...common, dealType: 'acquisition' }));
    expect(acq).toBeGreaterThan(lic);
  });

  it('Tier-1 > Tier-2 at same (TA, phase, modality, dealType)', () => {
    const tier1 = computeEmpiricalMultiplier(makeInput({
      therapeuticArea: 'oncology', phase: 'phase2', modality: 'adc', dealType: 'acquisition',
      competitivePosition: 'firstInClass', dataQuality: 'strongPhase2',
      regulatoryDesignations: { breakthrough: true, fastTrack: false, orphan: false, prime: false },
    }));
    const tier2 = computeEmpiricalMultiplier(makeInput({
      therapeuticArea: 'oncology', phase: 'phase2', modality: 'adc', dealType: 'acquisition',
      competitivePosition: 'racing', dataQuality: 'promising',
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
    }));
    expect(tier1).toBeGreaterThan(tier2);
  });
});

describe('empirical-multiplier regression — pre-refactor explosions now bounded', () => {
  it('Phase 2 oncology ADC acquisition Tier-1 (was 19.5× via stacking) now ≤ 7×', () => {
    const m = computeEmpiricalMultiplier(makeInput({
      therapeuticArea: 'oncology', phase: 'phase2', modality: 'adc', dealType: 'acquisition',
      competitivePosition: 'firstInClass', dataQuality: 'strongPhase2',
      regulatoryDesignations: { breakthrough: true, orphan: true, fastTrack: true, prime: false },
    }));
    expect(m).toBeLessThanOrEqual(7.0);
    expect(m).toBeGreaterThanOrEqual(5.5);
  });

  it('Phase 2 oncology ADC licensing generic (was 3.9× via stacking) now ≤ 2×', () => {
    const m = computeEmpiricalMultiplier(makeInput({
      therapeuticArea: 'oncology', phase: 'phase2', modality: 'adc', dealType: 'licensing',
      competitivePosition: 'racing', dataQuality: 'promising',
      regulatoryDesignations: { breakthrough: false, orphan: false, fastTrack: false, prime: false },
    }));
    expect(m).toBeLessThanOrEqual(2.0);
  });

  it('Phase 2 rare disease gene therapy licensing (was producing $5B TDV) now bounded', () => {
    const m = computeEmpiricalMultiplier(makeInput({
      therapeuticArea: 'rareDisease', phase: 'phase2', modality: 'geneTherapyRare', dealType: 'licensing',
      competitivePosition: 'firstInClass', dataQuality: 'strongPhase2',
      regulatoryDesignations: { breakthrough: false, orphan: true, fastTrack: false, prime: false },
    }));
    // Tier-1 rare disease licensing: should be ~2-3x (1.5x TA + 0.3x modality + 0 PDT, full tier)
    expect(m).toBeLessThanOrEqual(3.0);
    expect(m).toBeGreaterThanOrEqual(1.5);
  });

  it('Phase 2 rare disease FIC licensing sub-tier (no breakthrough/orphan) stays low', () => {
    const m = computeEmpiricalMultiplier(makeInput({
      therapeuticArea: 'rareDisease', phase: 'phase2', modality: 'enzymeReplacement', dealType: 'licensing',
      competitivePosition: 'firstInClass', dataQuality: 'strongPhase2',
      // No regulatory designations — pulls out of Tier-1
      regulatoryDesignations: { breakthrough: false, orphan: false, fastTrack: false, prime: false },
    }));
    expect(m).toBeLessThanOrEqual(1.6);
  });
});

describe('empirical-multiplier dealType differentiation (Fix 4)', () => {
  it('oncology licensing uses licensing-specific TA uplift, not acquisition-calibrated', () => {
    const mLic = computeEmpiricalMultiplier(
      makeInput({
        therapeuticArea: 'oncology', phase: 'phase2', modality: 'adc', dealType: 'licensing',
        competitivePosition: 'firstInClass', dataQuality: 'strongPhase2',
        regulatoryDesignations: { breakthrough: true, orphan: false, fastTrack: false, prime: false },
      }),
      { includeBreakdown: true }
    );
    if (typeof mLic === 'number') throw new Error('unreachable');
    expect(mLic.components.taUplift).toBe(TA_UPLIFT.oncology.phase2!.licensing);
    expect(mLic.components.taUplift).toBeLessThan(TA_UPLIFT.oncology.phase2!.acquisition!);
  });
});

describe('empirical-multiplier tier gating (Fix 3)', () => {
  it('identifies Tier-1 correctly', () => {
    expect(isTier1Asset(makeInput({
      competitivePosition: 'firstInClass', dataQuality: 'strongPhase2',
      regulatoryDesignations: { breakthrough: true, orphan: false, fastTrack: false, prime: false },
    }))).toBe(true);
    expect(isTier1Asset(makeInput({
      competitivePosition: 'firstInClass', dataQuality: 'promising',
      regulatoryDesignations: { breakthrough: true, orphan: false, fastTrack: false, prime: false },
    }))).toBe(false); // weak data
    expect(isTier1Asset(makeInput({
      competitivePosition: 'racing', dataQuality: 'strongPhase2',
      regulatoryDesignations: { breakthrough: true, orphan: false, fastTrack: false, prime: false },
    }))).toBe(false); // not FIC/BIC
    expect(isTier1Asset(makeInput({
      competitivePosition: 'firstInClass', dataQuality: 'strongPhase2',
      regulatoryDesignations: { breakthrough: false, orphan: false, fastTrack: true, prime: true },
    }))).toBe(false); // no breakthrough and no orphan
  });

  it('sub-tier asset gets dampened premium vs same-input Tier-1', () => {
    const tier1Breakdown = computeEmpiricalMultiplier(makeInput({
      therapeuticArea: 'oncology', phase: 'phase2', modality: 'adc', dealType: 'acquisition',
      competitivePosition: 'firstInClass', dataQuality: 'strongPhase2',
      regulatoryDesignations: { breakthrough: true, orphan: false, fastTrack: false, prime: false },
    }), { includeBreakdown: true });
    const tier2Breakdown = computeEmpiricalMultiplier(makeInput({
      therapeuticArea: 'oncology', phase: 'phase2', modality: 'adc', dealType: 'acquisition',
      competitivePosition: 'racing', dataQuality: 'promising',
      regulatoryDesignations: { breakthrough: false, orphan: false, fastTrack: false, prime: false },
    }), { includeBreakdown: true });

    if (typeof tier1Breakdown === 'number' || typeof tier2Breakdown === 'number') throw new Error('unreachable');
    expect(tier1Breakdown.tier).toBe(1);
    expect(tier2Breakdown.tier).toBe(2);
    expect(tier1Breakdown.multiplier).toBeGreaterThan(tier2Breakdown.multiplier);
  });
});

describe('empirical-multiplier composition (Fix 2 — additive not multiplicative)', () => {
  it('composition is bounded by ADDITIVE_CAP even when premiums sum high', () => {
    // Radiopharmaceutical (mod 2.2) + oncology phase 2 acquisition (TA 3.0) +
    // PDT 5.0 — if multiplicative, would be 33x. Additive-capped at 6.5x.
    const b = computeEmpiricalMultiplier(makeInput({
      therapeuticArea: 'oncology', phase: 'phase2', modality: 'radiopharmaceutical', dealType: 'acquisition',
      competitivePosition: 'firstInClass', dataQuality: 'strongPhase2',
      regulatoryDesignations: { breakthrough: true, orphan: true, fastTrack: false, prime: false },
    }), { includeBreakdown: true });
    if (typeof b === 'number') throw new Error('unreachable');
    expect(b.cappedByAdditive || b.cappedByHard).toBe(true);
    expect(b.multiplier).toBeLessThanOrEqual(1 + ADDITIVE_CAP);
  });
});

describe('empirical-multiplier breakdown mode', () => {
  it('returns structured explanation for calibration auditing', () => {
    const b = computeEmpiricalMultiplier(makeInput({
      therapeuticArea: 'oncology', phase: 'phase2', modality: 'adc', dealType: 'licensing',
    }), { includeBreakdown: true });
    if (typeof b === 'number') throw new Error('unreachable');
    expect(b.multiplier).toBeGreaterThan(0);
    expect(b.reason.length).toBeGreaterThan(0);
    expect(b.components.taUplift).toBeDefined();
    expect(b.components.modUplift).toBeDefined();
    expect(b.components.phaseDealBase).toBeDefined();
    expect(b.components.tierDampener).toBeDefined();
  });
});
