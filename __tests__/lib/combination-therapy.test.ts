/**
 * Combination Therapy Tests
 *
 * Tests computeEffectiveMultiplier, getCombinationDynamics, and
 * applyCombinationAdjustment from lib/financial/combination-therapy.ts.
 *
 * Covers: combo adjustment on peak sales, standalone/monotherapy passthrough,
 * edge cases for unknown indications and missing data, alias resolution.
 */

import {
  computeEffectiveMultiplier,
  getCombinationDynamics,
  applyCombinationAdjustment,
  COMBINATION_BY_INDICATION,
} from '@/lib/financial/combination-therapy';

// ---------------------------------------------------------------------------
// computeEffectiveMultiplier
// ---------------------------------------------------------------------------

describe('computeEffectiveMultiplier', () => {
  it('returns 1.0 for comboFraction=0 (pure monotherapy)', () => {
    expect(computeEffectiveMultiplier(0, 0.5)).toBe(1.0);
  });

  it('returns revenueShare for comboFraction=1 (pure combo)', () => {
    const rs = 0.40;
    expect(computeEffectiveMultiplier(1.0, rs)).toBe(rs);
  });

  it('returns a value between revenueShare and 1.0 for partial combo', () => {
    const result = computeEffectiveMultiplier(0.5, 0.40);
    expect(result).toBeGreaterThan(0.40);
    expect(result).toBeLessThan(1.0);
  });

  it('is floored at 0.25 (MIN_COMBO_MULTIPLIER)', () => {
    // comboFraction=1.0, revenueShare=0.10 would give 0.10 without floor
    expect(computeEffectiveMultiplier(1.0, 0.10)).toBe(0.25);
  });

  it('clamps comboFraction to [0, 1]', () => {
    // Negative comboFraction treated as 0
    expect(computeEffectiveMultiplier(-0.5, 0.40)).toBe(1.0);
    // comboFraction > 1 treated as 1
    expect(computeEffectiveMultiplier(1.5, 0.40)).toBe(0.40);
  });

  it('clamps revenueShare to [0, 1]', () => {
    // Negative revenueShare treated as 0
    const result = computeEffectiveMultiplier(1.0, -0.5);
    expect(result).toBe(0.25); // 0 clamped, then floored at 0.25
  });

  it('comboFraction=0.85, revenueShare=0.40 matches NSCLC expected value', () => {
    const result = computeEffectiveMultiplier(0.85, 0.40);
    const expected = 0.85 * 0.40 + 0.15 * 1.0; // 0.49
    expect(result).toBeCloseTo(expected, 4);
  });
});

// ---------------------------------------------------------------------------
// COMBINATION_BY_INDICATION data coverage
// ---------------------------------------------------------------------------

describe('COMBINATION_BY_INDICATION', () => {
  it('has entries for major oncology indications', () => {
    const oncologyKeys = [
      'lung_nsclc', 'lung_sclc', 'breast_her2', 'breast_tnbc',
      'multiple_myeloma', 'dlbcl', 'melanoma', 'colorectal',
      'pancreatic', 'prostate', 'bladder', 'renal_cell',
    ];
    for (const key of oncologyKeys) {
      expect(COMBINATION_BY_INDICATION[key]).toBeDefined();
    }
  });

  it('has entries for immunology indications', () => {
    const immunoKeys = ['rheumatoid_arthritis', 'psoriasis', 'lupus', 'ms', 'ibd_uc', 'ibd_cd'];
    for (const key of immunoKeys) {
      expect(COMBINATION_BY_INDICATION[key]).toBeDefined();
    }
  });

  it('has entries for neurology indications', () => {
    const neuroKeys = ['alzheimers', 'als', 'parkinsons', 'epilepsy', 'migraine'];
    for (const key of neuroKeys) {
      expect(COMBINATION_BY_INDICATION[key]).toBeDefined();
    }
  });

  it('all entries have effectiveRevenueMultiplier in [0.25, 1.0]', () => {
    for (const [key, dynamics] of Object.entries(COMBINATION_BY_INDICATION)) {
      expect(dynamics.effectiveRevenueMultiplier).toBeGreaterThanOrEqual(0.25);
      expect(dynamics.effectiveRevenueMultiplier).toBeLessThanOrEqual(1.0);
    }
  });

  it('all entries have comboFraction in [0, 1] and revenueShare in [0, 1]', () => {
    for (const [key, dynamics] of Object.entries(COMBINATION_BY_INDICATION)) {
      expect(dynamics.comboFraction).toBeGreaterThanOrEqual(0);
      expect(dynamics.comboFraction).toBeLessThanOrEqual(1);
      expect(dynamics.revenueShare).toBeGreaterThanOrEqual(0);
      expect(dynamics.revenueShare).toBeLessThanOrEqual(1);
    }
  });

  it('oncology indications have higher comboFraction than rare disease indications', () => {
    const nsclc = COMBINATION_BY_INDICATION['lung_nsclc'];
    const sma = COMBINATION_BY_INDICATION['sma'];
    expect(nsclc.comboFraction).toBeGreaterThan(sma.comboFraction);
  });

  it('all entries have non-empty notes', () => {
    for (const [key, dynamics] of Object.entries(COMBINATION_BY_INDICATION)) {
      expect(dynamics.notes).toBeTruthy();
      expect(dynamics.notes.length).toBeGreaterThan(10);
    }
  });
});

// ---------------------------------------------------------------------------
// getCombinationDynamics
// ---------------------------------------------------------------------------

describe('getCombinationDynamics', () => {
  it('returns dynamics for known indication', () => {
    const result = getCombinationDynamics('lung_nsclc');
    expect(result).not.toBeNull();
    expect(result!.context).toBe('combination_with_existing_soc');
    expect(result!.comboFraction).toBe(0.85);
  });

  it('resolves indication aliases (nsclc -> lung_nsclc)', () => {
    const result = getCombinationDynamics('nsclc');
    expect(result).not.toBeNull();
    expect(result!.context).toBe('combination_with_existing_soc');
  });

  it('resolves alias with mixed casing and hyphens', () => {
    const result = getCombinationDynamics('Crohns-Disease');
    expect(result).not.toBeNull();
    // crohns_disease -> ibd_cd
  });

  it('returns null for unknown indication', () => {
    const result = getCombinationDynamics('completely_unknown_indication');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getCombinationDynamics('')).toBeNull();
  });

  it('multiple_myeloma has the highest comboFraction (0.95)', () => {
    const mm = getCombinationDynamics('multiple_myeloma');
    expect(mm).not.toBeNull();
    expect(mm!.comboFraction).toBe(0.95);
  });

  it('MS is monotherapy with very low comboFraction', () => {
    const ms = getCombinationDynamics('ms');
    expect(ms).not.toBeNull();
    expect(ms!.context).toBe('monotherapy');
    expect(ms!.comboFraction).toBeLessThanOrEqual(0.10);
  });
});

// ---------------------------------------------------------------------------
// applyCombinationAdjustment — combo modifies peak sales upward/downward
// ---------------------------------------------------------------------------

describe('applyCombinationAdjustment', () => {
  const basePeakSales = 3000; // $3B

  describe('combination adjustment modifies peak sales for valid combos', () => {
    it('NSCLC combo reduces effective peak sales (multiplier < 1)', () => {
      const result = applyCombinationAdjustment(basePeakSales, 'lung_nsclc');
      expect(result.multiplier).toBeLessThan(1.0);
      expect(result.adjusted).toBeLessThan(basePeakSales);
      expect(result.adjusted).toBe(basePeakSales * result.multiplier);
    });

    it('multiple myeloma has significant combo discount', () => {
      const result = applyCombinationAdjustment(basePeakSales, 'multiple_myeloma');
      // 95% combo with 28% revenue share = very low multiplier
      expect(result.multiplier).toBeLessThan(0.40);
      expect(result.adjusted).toBeLessThan(basePeakSales * 0.40);
    });

    it('immunology indication (psoriasis) has minor or no combo discount', () => {
      const result = applyCombinationAdjustment(basePeakSales, 'psoriasis');
      // Psoriasis is monotherapy context with low comboFraction
      expect(result.multiplier).toBeGreaterThan(0.90);
    });

    it('rationale string is populated for known indications', () => {
      const result = applyCombinationAdjustment(basePeakSales, 'lung_nsclc');
      expect(result.rationale).toBeTruthy();
      expect(result.rationale!.length).toBeGreaterThan(20);
    });

    it('dynamics object is populated for known indications', () => {
      const result = applyCombinationAdjustment(basePeakSales, 'lung_nsclc');
      expect(result.dynamics).not.toBeNull();
      expect(result.dynamics!.partnerDrug).toBeTruthy();
    });
  });

  describe('standalone mode (no combination) returns unmodified values', () => {
    it('unknown indication returns unmodified peak sales', () => {
      const result = applyCombinationAdjustment(basePeakSales, 'completely_unknown');
      expect(result.adjusted).toBe(basePeakSales);
      expect(result.multiplier).toBe(1.0);
      expect(result.rationale).toBeNull();
      expect(result.dynamics).toBeNull();
    });

    it('empty indication returns unmodified peak sales', () => {
      const result = applyCombinationAdjustment(basePeakSales, '');
      expect(result.adjusted).toBe(basePeakSales);
      expect(result.multiplier).toBe(1.0);
    });

    it('user override to monotherapy skips combo discount', () => {
      const result = applyCombinationAdjustment(basePeakSales, 'lung_nsclc', 'monotherapy');
      expect(result.adjusted).toBe(basePeakSales);
      expect(result.multiplier).toBe(1.0);
      expect(result.rationale).toContain('monotherapy');
      // dynamics should still be returned (for informational purposes)
      expect(result.dynamics).not.toBeNull();
    });
  });

  describe('edge cases', () => {
    it('zero peak sales remains zero', () => {
      const result = applyCombinationAdjustment(0, 'lung_nsclc');
      expect(result.adjusted).toBe(0);
    });

    it('very large peak sales applies multiplier correctly', () => {
      const largeSales = 50000; // $50B
      const result = applyCombinationAdjustment(largeSales, 'lung_nsclc');
      expect(result.adjusted).toBe(largeSales * result.multiplier);
      expect(Number.isFinite(result.adjusted)).toBe(true);
    });

    it('alias nsclc resolves and applies combo adjustment', () => {
      const direct = applyCombinationAdjustment(basePeakSales, 'lung_nsclc');
      const alias = applyCombinationAdjustment(basePeakSales, 'nsclc');
      expect(alias.multiplier).toBe(direct.multiplier);
      expect(alias.adjusted).toBe(direct.adjusted);
    });

    it('alias with different casing resolves correctly', () => {
      const result = applyCombinationAdjustment(basePeakSales, 'NSCLC');
      expect(result.multiplier).toBeLessThan(1.0);
    });

    it('HIV always has high combo fraction (ART is always combination)', () => {
      const result = applyCombinationAdjustment(basePeakSales, 'hiv');
      expect(result.dynamics).not.toBeNull();
      expect(result.dynamics!.comboFraction).toBeGreaterThanOrEqual(0.90);
      expect(result.multiplier).toBeLessThan(0.50);
    });

    it('cystic_fibrosis is monotherapy (CFTR modulators)', () => {
      const result = applyCombinationAdjustment(basePeakSales, 'cystic_fibrosis');
      expect(result.dynamics).not.toBeNull();
      expect(result.dynamics!.context).toBe('monotherapy');
      expect(result.multiplier).toBeGreaterThan(0.90);
    });

    it('userOverride combination_with_existing_soc still applies combo adjustment', () => {
      // For a known indication, non-monotherapy override should still apply combo dynamics
      const result = applyCombinationAdjustment(
        basePeakSales,
        'lung_nsclc',
        'combination_with_existing_soc',
      );
      expect(result.multiplier).toBeLessThan(1.0);
      expect(result.adjusted).toBeLessThan(basePeakSales);
    });
  });
});

// ---------------------------------------------------------------------------
// Cross-check: effectiveRevenueMultiplier matches computeEffectiveMultiplier
// ---------------------------------------------------------------------------

describe('effectiveRevenueMultiplier consistency', () => {
  it('every COMBINATION_BY_INDICATION entry has a correct effectiveRevenueMultiplier', () => {
    for (const [key, dynamics] of Object.entries(COMBINATION_BY_INDICATION)) {
      const expected = computeEffectiveMultiplier(
        dynamics.comboFraction,
        dynamics.revenueShare,
      );
      expect(dynamics.effectiveRevenueMultiplier).toBeCloseTo(expected, 6);
    }
  });
});
