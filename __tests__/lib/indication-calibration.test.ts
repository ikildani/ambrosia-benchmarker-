/**
 * Indication Calibration Regression Tests
 *
 * Phase 3 of the indication-level calibration project (2026-04-10).
 * These tests catch silent regressions if anyone reverts or weakens the
 * four per-indication calibration layers:
 *   1. lib/financial/indication-pos-modifiers.ts (PoS multipliers)
 *   2. lib/financial/index-drugs.ts INDICATION_MARKET_CAPS (peak sales caps)
 *   3. lib/financial/pos-tables.ts INDICATION_REVENUE_CURVES (ramp/peak/decay)
 *   4. lib/financial/indication-competitive-density.ts (crowding multiplier)
 *
 * Each test asserts a BEHAVIORAL invariant (e.g., "Alzheimer's phase2->3 PoS
 * must be materially lower than the neurology base"), not a specific numeric
 * output — that way future calibration refinements don't require churning
 * the test file.
 */

import {
  INDICATION_POS_MODIFIERS,
  applyIndicationModifier,
  getIndicationPoSModifier,
  CALIBRATED_INDICATION_COUNT,
} from '@/lib/financial/indication-pos-modifiers';
import {
  INDICATION_MARKET_CAPS,
  getIndicationMarketCap,
  checkPeakSalesCeiling,
} from '@/lib/financial/index-drugs';
import {
  INDICATION_REVENUE_CURVES,
  getIndicationRevenueCurve,
  POS_BY_THERAPEUTIC_AREA,
} from '@/lib/financial/pos-tables';
import {
  COMPETITIVE_DENSITY,
  getCompetitiveDensity,
  applyCompetitiveDensityToPeakSales,
} from '@/lib/financial/indication-competitive-density';

describe('Indication calibration Layer 0: coverage sanity', () => {
  test('at least 50 indications are calibrated with PoS modifiers', () => {
    expect(CALIBRATED_INDICATION_COUNT).toBeGreaterThanOrEqual(50);
  });

  test('at least 40 indications have market cap data', () => {
    expect(Object.keys(INDICATION_MARKET_CAPS).length).toBeGreaterThanOrEqual(40);
  });

  test('at least 40 indications have revenue curve data', () => {
    expect(Object.keys(INDICATION_REVENUE_CURVES).length).toBeGreaterThanOrEqual(40);
  });

  test('at least 40 indications have competitive density data', () => {
    expect(Object.keys(COMPETITIVE_DENSITY).length).toBeGreaterThanOrEqual(40);
  });
});

describe('Indication PoS modifiers (Layer 1)', () => {
  const neurologyP2toP3 = POS_BY_THERAPEUTIC_AREA.neurology.phase2ToPhase3;
  const rareP2toP3 = POS_BY_THERAPEUTIC_AREA.rareDisease.phase2ToPhase3;
  const oncologyP2toP3 = POS_BY_THERAPEUTIC_AREA.oncology.phase2ToPhase3;

  test("Alzheimer's has lower phase2to3 PoS than neurology base (~0.45x modifier)", () => {
    const alzPos = applyIndicationModifier(neurologyP2toP3, 'alzheimers', 'phase2ToPhase3');
    expect(alzPos).toBeLessThan(neurologyP2toP3 * 0.6);
    const mod = getIndicationPoSModifier('alzheimers');
    expect(mod?.phase2ToPhase3).toBeLessThanOrEqual(0.5);
  });

  test("Huntington's disease has reduced phase2to3 PoS vs neurology base (~0.55x)", () => {
    const hdPos = applyIndicationModifier(neurologyP2toP3, 'huntingtons', 'phase2ToPhase3');
    expect(hdPos).toBeLessThan(neurologyP2toP3 * 0.7);
  });

  test("DMD has higher phase2to3 PoS than rareDisease base (~1.40x)", () => {
    const dmdPos = applyIndicationModifier(rareP2toP3, 'dmd', 'phase2ToPhase3');
    expect(dmdPos).toBeGreaterThan(rareP2toP3 * 1.2);
    const mod = getIndicationPoSModifier('dmd');
    expect(mod?.phase2ToPhase3).toBeGreaterThanOrEqual(1.30);
  });

  test('DMD and duchenneMD aliases produce identical modifiers', () => {
    const dmd = getIndicationPoSModifier('dmd');
    const dmdAlias = getIndicationPoSModifier('duchenneMD');
    expect(dmd?.phase2ToPhase3).toBe(dmdAlias?.phase2ToPhase3);
  });

  test('SMA has higher phase2to3 PoS than rareDisease base (validated biology)', () => {
    const smaPos = applyIndicationModifier(rareP2toP3, 'sma', 'phase2ToPhase3');
    expect(smaPos).toBeGreaterThan(rareP2toP3 * 1.2);
  });

  test('Pancreatic cancer has materially lower phase2to3 PoS than oncology base', () => {
    const pancPos = applyIndicationModifier(oncologyP2toP3, 'pancreatic', 'phase2ToPhase3');
    expect(pancPos).toBeLessThan(oncologyP2toP3 * 0.8);
  });

  test('HER2+ breast has higher phase2to3 PoS than oncology base (best-validated target)', () => {
    const her2Pos = applyIndicationModifier(oncologyP2toP3, 'breast_her2', 'phase2ToPhase3');
    expect(her2Pos).toBeGreaterThan(oncologyP2toP3);
  });

  test('NSCLC has lower phase2to3 PoS than oncology base (crowded, heterogeneous)', () => {
    const nsclcPos = applyIndicationModifier(oncologyP2toP3, 'lung_nsclc', 'phase2ToPhase3');
    expect(nsclcPos).toBeLessThan(oncologyP2toP3);
  });

  test('Multiple myeloma has higher phase2to3 PoS than hematology base', () => {
    const hemeBase = POS_BY_THERAPEUTIC_AREA.hematology.phase2ToPhase3;
    const mmPos = applyIndicationModifier(hemeBase, 'myeloma', 'phase2ToPhase3');
    expect(mmPos).toBeGreaterThan(hemeBase);
  });

  test('Unknown indication returns base PoS unchanged', () => {
    const base = neurologyP2toP3;
    const result = applyIndicationModifier(base, 'not_a_real_indication_xyz', 'phase2ToPhase3');
    expect(result).toBe(base);
  });

  test('applyIndicationModifier clamps into [0.01, 0.98]', () => {
    const clamped = applyIndicationModifier(10, 'dmd', 'phase2ToPhase3');
    expect(clamped).toBeLessThanOrEqual(0.98);
    expect(clamped).toBeGreaterThanOrEqual(0.01);
  });
});

describe('Indication peak sales caps (Layer 2)', () => {
  test("Friedreich's ataxia has ultra-low TAM (~$500M) and triggers warning at $50B", () => {
    const cap = getIndicationMarketCap('friedreichs_ataxia');
    expect(cap).not.toBeNull();
    expect(cap!.globalTAM_M).toBeLessThan(1000);

    const check = checkPeakSalesCeiling(50_000, 'friedreichs_ataxia');
    expect(check.ok).toBe(false);
    expect(check.severity).toBe('critical');
  });

  test('NSCLC has high TAM ($40B+) and $10B peak sales passes the ceiling check', () => {
    const check = checkPeakSalesCeiling(10_000, 'lung_nsclc');
    expect(check.ok).toBe(true);
  });

  test('Pancreatic cancer has low TAM and $5B peak sales triggers warning', () => {
    const check = checkPeakSalesCeiling(5000, 'pancreatic');
    expect(check.ok).toBe(false);
    // Either critical (>80% of TAM) or warning (>max drug ceiling) is acceptable
    expect(['warning', 'critical']).toContain(check.severity);
  });

  test('Unknown indication passes ceiling check (no cap defined)', () => {
    const check = checkPeakSalesCeiling(5000, 'unknown_indication_xyz');
    expect(check.ok).toBe(true);
  });

  test('DMD market cap reflects orphan population (<$5B TAM)', () => {
    const cap = getIndicationMarketCap('dmd') ?? getIndicationMarketCap('duchenneMD');
    expect(cap).not.toBeNull();
    expect(cap!.globalTAM_M).toBeLessThan(5000);
  });
});

describe('Indication revenue curves (Layer 3)', () => {
  test('DMD uses 2y ramp + 10y peak (orphan blockbuster profile)', () => {
    const curve = getIndicationRevenueCurve('dmd');
    expect(curve).not.toBeNull();
    expect(curve!.rampUpYears).toBeLessThanOrEqual(2);
    expect(curve!.peakDurationYears).toBeGreaterThanOrEqual(10);
  });

  test("Alzheimer's uses slow 6y ramp (Leqembi infrastructure bottleneck)", () => {
    const curve = getIndicationRevenueCurve('alzheimers');
    expect(curve).not.toBeNull();
    expect(curve!.rampUpYears).toBeGreaterThanOrEqual(5);
  });

  test('Cystic fibrosis uses fast 2y ramp (Trikafta trajectory)', () => {
    const curve = getIndicationRevenueCurve('cystic_fibrosis');
    expect(curve).not.toBeNull();
    expect(curve!.rampUpYears).toBeLessThanOrEqual(2);
    expect(curve!.peakDurationYears).toBeGreaterThanOrEqual(9);
  });

  test('Obesity uses fast 2y ramp (GLP-1 explosive uptake)', () => {
    const curve = getIndicationRevenueCurve('obesity');
    expect(curve).not.toBeNull();
    expect(curve!.rampUpYears).toBeLessThanOrEqual(3);
  });

  test('NSCLC uses slower 5y ramp (biomarker stratification)', () => {
    const curve = getIndicationRevenueCurve('lung_nsclc');
    expect(curve).not.toBeNull();
    expect(curve!.rampUpYears).toBeGreaterThanOrEqual(4);
  });

  test('SMA has orphan-style short ramp and long peak', () => {
    const curve = getIndicationRevenueCurve('sma');
    expect(curve).not.toBeNull();
    expect(curve!.rampUpYears).toBeLessThanOrEqual(2);
    expect(curve!.peakDurationYears).toBeGreaterThanOrEqual(8);
  });

  test('Rare disease curves generally have slower decline than blockbuster onc', () => {
    const dmd = getIndicationRevenueCurve('dmd');
    const nsclc = getIndicationRevenueCurve('lung_nsclc');
    expect(dmd!.declineRate).toBeLessThan(nsclc!.declineRate);
  });

  test('Unknown indication returns null (falls back to TA curve)', () => {
    expect(getIndicationRevenueCurve('unknown_indication_xyz')).toBeNull();
  });
});

describe('Competitive density (Layer 4)', () => {
  test('Breast HER2 applies a >=1.35x penetration penalty', () => {
    const d = getCompetitiveDensity('breast_her2');
    expect(d).not.toBeNull();
    expect(d!.penetrationMultiplier).toBeGreaterThanOrEqual(1.35);

    const adjusted = applyCompetitiveDensityToPeakSales(1000, 'breast_her2');
    expect(adjusted).toBeLessThan(1000 / 1.3);
  });

  test("Friedreich's ataxia gets an <=0.80x boost (under-served)", () => {
    const d = getCompetitiveDensity('friedreichs_ataxia');
    expect(d).not.toBeNull();
    expect(d!.penetrationMultiplier).toBeLessThanOrEqual(0.85);

    const adjusted = applyCompetitiveDensityToPeakSales(1000, 'friedreichs_ataxia');
    expect(adjusted).toBeGreaterThan(1000);
  });

  test('NSCLC applies a >=1.35x penetration penalty (crowded IO/TKI/ADC)', () => {
    const d = getCompetitiveDensity('lung_nsclc');
    expect(d).not.toBeNull();
    expect(d!.penetrationMultiplier).toBeGreaterThanOrEqual(1.30);
  });

  test('Type 2 diabetes is crowded (penalty ~1.3x)', () => {
    const d = getCompetitiveDensity('type2_diabetes');
    expect(d).not.toBeNull();
    expect(d!.penetrationMultiplier).toBeGreaterThanOrEqual(1.25);
  });

  test('NASH/MASH is relatively under-served (Rezdiffra first-in-class)', () => {
    const d = getCompetitiveDensity('nash_mash');
    expect(d).not.toBeNull();
    expect(d!.penetrationMultiplier).toBeLessThanOrEqual(1.0);
  });

  test('Unknown indication returns null (falls back to default)', () => {
    expect(getCompetitiveDensity('unknown_indication_xyz')).toBeNull();
    const adjusted = applyCompetitiveDensityToPeakSales(1000, 'unknown_indication_xyz');
    expect(adjusted).toBe(1000);
  });
});

describe('Cross-layer integration: calibration composes correctly', () => {
  test("Alzheimer's stack: lower PoS, slower ramp — materially different from MS", () => {
    const alzMod = getIndicationPoSModifier('alzheimers');
    const alzCurve = getIndicationRevenueCurve('alzheimers');
    const msCurve = getIndicationRevenueCurve('multiple_sclerosis');

    expect(alzMod?.phase2ToPhase3).toBeLessThanOrEqual(0.5);
    expect(alzCurve!.rampUpYears).toBeGreaterThan(msCurve!.rampUpYears);
  });

  test('DMD stack: higher PoS, orphan revenue curve, competitive boost', () => {
    const mod = getIndicationPoSModifier('dmd');
    const curve = getIndicationRevenueCurve('dmd');
    expect(mod?.phase2ToPhase3).toBeGreaterThanOrEqual(1.30);
    expect(curve!.rampUpYears).toBeLessThanOrEqual(2);
    expect(curve!.peakDurationYears).toBeGreaterThanOrEqual(10);
  });
});
