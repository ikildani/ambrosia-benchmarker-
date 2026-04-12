/**
 * Macro Factors (Tier 4 Item 12) — acceptance tests.
 */

import {
  STATIC_MACRO_FALLBACK,
  WACC_FLOOR,
  WACC_CEILING,
  getMacroSnapshot,
  setMacroSnapshot,
  getRiskFreeRate,
  getDynamicWaccComponent,
  __resetMacroCacheForTests,
} from '@/lib/financial/macro-factors';

describe('macro-factors — getMacroSnapshot', () => {
  beforeEach(() => {
    __resetMacroCacheForTests();
  });

  test('returns STATIC_MACRO_FALLBACK when cache is fresh', () => {
    expect(getMacroSnapshot()).toEqual(STATIC_MACRO_FALLBACK);
  });

  test('setMacroSnapshot updates the cache when inputs are valid', () => {
    const ok = setMacroSnapshot({
      snapshotDate: '2026-06-01',
      treasury10y: 0.055,
      biotechBeta: 1.20,
      equityRiskPremium: 0.058,
      source: 'live',
    });
    expect(ok).toBe(true);
    const snap = getMacroSnapshot();
    expect(snap.treasury10y).toBe(0.055);
    expect(snap.source).toBe('live');
  });

  test('setMacroSnapshot rejects out-of-bounds treasury yield', () => {
    const ok = setMacroSnapshot({
      snapshotDate: '2026-06-01',
      treasury10y: 0.5,  // 50% — impossible
      biotechBeta: 1.15,
      equityRiskPremium: 0.055,
      source: 'live',
    });
    expect(ok).toBe(false);
    expect(getMacroSnapshot()).toEqual(STATIC_MACRO_FALLBACK);
  });

  test('setMacroSnapshot rejects invalid biotech beta', () => {
    const ok = setMacroSnapshot({
      snapshotDate: '2026-06-01',
      treasury10y: 0.045,
      biotechBeta: 10,  // absurd
      equityRiskPremium: 0.055,
      source: 'live',
    });
    expect(ok).toBe(false);
  });
});

describe('macro-factors — getRiskFreeRate', () => {
  beforeEach(() => {
    __resetMacroCacheForTests();
  });

  test('returns static fallback rf in a fresh cache', () => {
    expect(getRiskFreeRate()).toBe(STATIC_MACRO_FALLBACK.treasury10y);
  });

  test('floors at 0.005 if cache holds a sub-floor yield', () => {
    // Force the cache past validation to test the rf floor.
    setMacroSnapshot({
      snapshotDate: '2026-06-01',
      treasury10y: 0.001,
      biotechBeta: 1.15,
      equityRiskPremium: 0.055,
      source: 'live',
    });
    // Note: 0.001 passes the validator (-0.02..0.20), so the rf floor in
    // getRiskFreeRate is what kicks in.
    expect(getRiskFreeRate()).toBe(0.005);
  });

  test('ceils at 0.10', () => {
    setMacroSnapshot({
      snapshotDate: '2026-06-01',
      treasury10y: 0.15,  // passes validator (<0.20) but above rf ceiling
      biotechBeta: 1.15,
      equityRiskPremium: 0.055,
      source: 'live',
    });
    expect(getRiskFreeRate()).toBe(0.10);
  });
});

describe('macro-factors — getDynamicWaccComponent', () => {
  beforeEach(() => {
    __resetMacroCacheForTests();
  });

  test('returns 0 delta when cache matches the static baseline', () => {
    const delta = getDynamicWaccComponent(0.12);
    expect(delta).toBeCloseTo(0, 5);
  });

  test('returns positive delta when treasury is above baseline', () => {
    setMacroSnapshot({
      snapshotDate: '2026-06-01',
      treasury10y: 0.060,
      biotechBeta: 1.15,
      equityRiskPremium: 0.055,
      source: 'live',
    });
    const delta = getDynamicWaccComponent(0.12);
    expect(delta).toBeCloseTo(0.015, 5);
  });

  test('returns negative delta when treasury is below baseline', () => {
    setMacroSnapshot({
      snapshotDate: '2026-06-01',
      treasury10y: 0.030,
      biotechBeta: 1.15,
      equityRiskPremium: 0.055,
      source: 'live',
    });
    const delta = getDynamicWaccComponent(0.12);
    expect(delta).toBeCloseTo(-0.015, 5);
  });

  test('never pushes combined WACC above WACC_CEILING (0.25)', () => {
    setMacroSnapshot({
      snapshotDate: '2026-06-01',
      treasury10y: 0.10,   // pushing hard
      biotechBeta: 1.5,
      equityRiskPremium: 0.07,
      source: 'live',
    });
    for (const base of [0.20, 0.23, 0.245]) {
      const delta = getDynamicWaccComponent(base);
      expect(base + delta).toBeLessThanOrEqual(WACC_CEILING + 1e-9);
    }
  });

  test('never pushes combined WACC below WACC_FLOOR (0.05)', () => {
    setMacroSnapshot({
      snapshotDate: '2026-06-01',
      treasury10y: 0.005,
      biotechBeta: 0.8,
      equityRiskPremium: 0.045,
      source: 'live',
    });
    for (const base of [0.05, 0.06, 0.07]) {
      const delta = getDynamicWaccComponent(base);
      expect(base + delta).toBeGreaterThanOrEqual(WACC_FLOOR - 1e-9);
    }
  });
});

describe('macro-factors — fuzz WACC bounds', () => {
  test('combined WACC stays in [0.05, 0.25] across 500 random macro inputs', () => {
    for (let i = 0; i < 500; i++) {
      __resetMacroCacheForTests();
      const rfPct = Math.random() * 0.09 + 0.005;   // 0.5% .. 9.5%
      const beta = Math.random() * 0.9 + 0.8;       // 0.8 .. 1.7
      const erp = Math.random() * 0.04 + 0.045;     // 4.5% .. 8.5%
      setMacroSnapshot({
        snapshotDate: '2026-06-01',
        treasury10y: rfPct,
        biotechBeta: beta,
        equityRiskPremium: erp,
        source: 'live',
      });
      const base = Math.random() * 0.20 + 0.05;     // 5% .. 25%
      const delta = getDynamicWaccComponent(base);
      const combined = base + delta;
      expect(combined).toBeGreaterThanOrEqual(WACC_FLOOR - 1e-9);
      expect(combined).toBeLessThanOrEqual(WACC_CEILING + 1e-9);
    }
  });
});
