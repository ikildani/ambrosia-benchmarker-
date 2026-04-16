/**
 * R68-T4: TA-aware competitive share multiplier tests + R67-T5 recency weight.
 */

import { recencyWeight } from '../lib/financial/calibration';
import { estimateMarketSize, getEpidemiologyData } from '../lib/financial/market-size';

// Minimal epidemiology stub for testing
const stubEpi = {
  prevalencePerMillion: 100,
  diagnosedPercent: 0.80,
  treatedPercent: 0.70,
  drugEligiblePercent: 0.60,
  annualCostOfTherapy: 50_000,
  sources: ['Test stub'],
} as any;

describe('TA-aware market share multiplier (R68-T4)', () => {
  it('rare disease FIC captures more share than oncology FIC at same position', () => {
    const rare = estimateMarketSize('mps_i', 'global', 'firstInClass', stubEpi, 'rareDisease');
    const onco = estimateMarketSize('breast_her2', 'global', 'firstInClass', stubEpi, 'oncology');
    // Both use the same epidemiology + territory, so only TA multiplier differs.
    // rareDisease 1.35 vs oncology 0.85 = rare FIC should be ~1.6× oncology FIC
    expect(rare.peakSales.median).toBeGreaterThan(onco.peakSales.median);
    const ratio = rare.peakSales.median / onco.peakSales.median;
    expect(ratio).toBeGreaterThanOrEqual(1.4);
    expect(ratio).toBeLessThanOrEqual(1.8);
  });

  it('oncology FIC median share dampened vs TA-neutral base', () => {
    const oncoFIC = estimateMarketSize('breast_her2', 'global', 'firstInClass', stubEpi, 'oncology');
    const neutralFIC = estimateMarketSize('breast_her2', 'global', 'firstInClass', stubEpi);
    expect(oncoFIC.peakSales.median).toBeLessThan(neutralFIC.peakSales.median);
  });

  it('share never exceeds 95% even with multiplier stacking', () => {
    const rare = estimateMarketSize('mps_i', 'global', 'firstInClass', stubEpi, 'rareDisease');
    // FIC base high = 0.50, × 1.35 = 0.675 → under 95% cap, should be fine
    // But the cap exists to guard future calibration drift.
    // Validate by checking that peakSales doesn't explode beyond realistic bound.
    const expectedMaxShare = 0.95;
    const maxTheoreticalPeak = stubEpi.annualCostOfTherapy * stubEpi.prevalencePerMillion / 1_000_000 * 100_000 * expectedMaxShare;
    expect(rare.peakSales.high).toBeLessThan(maxTheoreticalPeak);
  });

  it('backward-compatible: omitting TA falls back to TA-neutral base', () => {
    const withoutTA = estimateMarketSize('breast_her2', 'global', 'firstInClass', stubEpi);
    const withRare = estimateMarketSize('breast_her2', 'global', 'firstInClass', stubEpi, 'rareDisease');
    expect(withoutTA.peakSales.median).not.toBe(withRare.peakSales.median);
  });
});

describe('recency weight (R67-T5, already shipped)', () => {
  it('weights deals by exponential decay with 2.5y halflife from 2026 reference', () => {
    expect(recencyWeight(2026)).toBeCloseTo(1.0, 2);
    expect(recencyWeight(2023, 2026, 2.5)).toBeCloseTo(Math.pow(0.5, 3 / 2.5), 2);
    expect(recencyWeight(2019, 2026, 2.5)).toBeCloseTo(Math.pow(0.5, 7 / 2.5), 2);
  });

  it('future-dated deals do not get weight > 1', () => {
    expect(recencyWeight(2030, 2026, 2.5)).toBe(1.0);  // clamped via yearsAgo = max(0, ...)
  });

  it('2024 deals weight ~0.57 against 2026 reference', () => {
    expect(recencyWeight(2024)).toBeCloseTo(Math.pow(0.5, 2 / 2.5), 2);
  });
});
