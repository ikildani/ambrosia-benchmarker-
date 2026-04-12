/**
 * Time-Windowed PoS Regression Tests
 *
 * Ensures the rolling-cohort PoS layer in
 * `lib/financial/pos-time-windows.ts` behaves correctly and integrates with
 * `getCumulativePoS` + `calculateRNPV`.
 *
 * Tests assert BEHAVIORAL invariants rather than exact numbers so future
 * recalibration does not require churning the expected values. Examples:
 *   - Obesity 2021-2024 PoS must be materially HIGHER than 2014-2024 (GLP-1 era)
 *   - NASH/MASH 2021-2024 PoS must be materially LOWER than 2014-2024
 *     (Madrigal/Akero 2024-2025 failure wave)
 *   - Alzheimer's 2021-2024 PoS must be HIGHER than 2014-2024 (Leqembi/Kisunla)
 */

import {
  TIME_WINDOWED_POS,
  TIME_WINDOWED_INDICATION_COUNT,
  getTimeWindowedPoS,
  type TimeWindow,
} from '@/lib/financial/pos-time-windows';
import { getCumulativePoS } from '@/lib/financial/pos-tables';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import type { RNPVInput } from '@/lib/financial/types';

function makeInput(overrides: Partial<RNPVInput> = {}): RNPVInput {
  return {
    phase: 'phase2',
    therapeuticArea: 'neurology',
    modality: 'smallMolecule',
    indication: 'alzheimers',
    territory: 'global',
    peakSalesEstimate: { low: 1500, median: 3000, high: 5000 },
    competitivePosition: 'bestInClass',
    dataQuality: 'robust',
    regulatoryDesignations: {
      breakthrough: false,
      fastTrack: false,
      orphan: false,
      prime: false,
    },
    benchmarkDealValue: { low: 300, median: 600, high: 1200 },
    biomarkerStatus: 'validated',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Coverage sanity
// ---------------------------------------------------------------------------

describe('Time-windowed PoS: coverage sanity', () => {
  test('at least 15 indications have time-windowed data', () => {
    // Target is 30; set a floor of 15 so the test survives de-duping aliases.
    expect(TIME_WINDOWED_INDICATION_COUNT).toBeGreaterThanOrEqual(15);
  });

  test('every entry has at least one window with valid rates', () => {
    for (const [key, entry] of Object.entries(TIME_WINDOWED_POS)) {
      const windows = Object.values(entry.windows);
      expect(windows.length).toBeGreaterThanOrEqual(1);
      for (const w of windows) {
        expect(w).toBeDefined();
        if (!w) continue;
        expect(w.phase1ToPhase2).toBeGreaterThan(0);
        expect(w.phase1ToPhase2).toBeLessThan(1);
        expect(w.phase2ToPhase3).toBeGreaterThan(0);
        expect(w.phase2ToPhase3).toBeLessThan(1);
        expect(w.phase3ToApproval).toBeGreaterThan(0);
        expect(w.phase3ToApproval).toBeLessThan(1);
        expect(w.sampleSize).toBeGreaterThan(0);
        expect(typeof w.source).toBe('string');
        expect(w.source.length).toBeGreaterThan(5);
      }
      // Light assertion: `key` matches the entry's self-reported indication
      expect(entry.indication).toBe(key);
    }
  });

  test('must include the high-shift indications from the spec', () => {
    const required = [
      'alzheimers',
      'als',
      'nash_mash',
      'huntingtons',
      'obesity',
      'type2_diabetes',
      'atopic_dermatitis',
      'psoriasis',
      'lung_nsclc',
      'breast_her2',
      'migraine',
    ];
    for (const slug of required) {
      expect(TIME_WINDOWED_POS[slug]).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Directional invariants — the whole point of time-windowing
// ---------------------------------------------------------------------------

describe('Time-windowed PoS: directional shifts', () => {
  test('obesity PoS materially improved from 2014-2024 to 2021-2024 (GLP-1 era)', () => {
    const old = getTimeWindowedPoS('obesity', '2014-2024')!;
    const recent = getTimeWindowedPoS('obesity', '2021-2024')!;
    expect(recent.phase2ToPhase3).toBeGreaterThan(old.phase2ToPhase3 * 1.25);
    expect(recent.phase3ToApproval).toBeGreaterThan(old.phase3ToApproval);
  });

  test('alzheimers Phase 2->3 improved from 2014-2024 to 2021-2024 (Leqembi/Kisunla)', () => {
    const old = getTimeWindowedPoS('alzheimers', '2014-2024')!;
    const recent = getTimeWindowedPoS('alzheimers', '2021-2024')!;
    expect(recent.phase2ToPhase3).toBeGreaterThan(old.phase2ToPhase3);
    expect(recent.phase3ToApproval).toBeGreaterThan(old.phase3ToApproval);
  });

  test('nash_mash worsened from 2014-2024 to 2021-2024 (Madrigal/Akero failures)', () => {
    const old = getTimeWindowedPoS('nash_mash', '2014-2024')!;
    const recent = getTimeWindowedPoS('nash_mash', '2021-2024')!;
    expect(recent.phase2ToPhase3).toBeLessThan(old.phase2ToPhase3);
    expect(recent.phase3ToApproval).toBeLessThan(old.phase3ToApproval);
  });

  test('als worsened in the 2021-2024 cohort (Relyvrio withdrawal)', () => {
    const old = getTimeWindowedPoS('als', '2014-2024')!;
    const recent = getTimeWindowedPoS('als', '2021-2024')!;
    expect(recent.phase2ToPhase3).toBeLessThanOrEqual(old.phase2ToPhase3);
    expect(recent.phase3ToApproval).toBeLessThan(old.phase3ToApproval);
  });

  test('lung_nsclc improved with checkpoint inhibitors', () => {
    const old = getTimeWindowedPoS('lung_nsclc', '2014-2024')!;
    const recent = getTimeWindowedPoS('lung_nsclc', '2021-2024')!;
    expect(recent.phase2ToPhase3).toBeGreaterThan(old.phase2ToPhase3);
    expect(recent.phase3ToApproval).toBeGreaterThan(old.phase3ToApproval);
  });
});

// ---------------------------------------------------------------------------
// Fallback behavior
// ---------------------------------------------------------------------------

describe('Time-windowed PoS: fallback behavior', () => {
  test('returns null for indications with no time-window data', () => {
    expect(getTimeWindowedPoS('nonexistent_indication')).toBeNull();
    // An indication that is in the calibrated set but NOT in time-windowed
    // should also return null so the engine falls through to the modifier
    // layer unchanged.
    expect(getTimeWindowedPoS('depression')).toBeNull();
  });

  test('most_recent falls back to 2021-2024 when available', () => {
    const result = getTimeWindowedPoS('obesity', 'most_recent');
    expect(result).not.toBeNull();
    expect(result!.resolvedWindow).toBe('2021-2024');
  });

  test('most_recent falls back further when 2021-2024 is missing', () => {
    // `rheumatoid_arthritis` in our table has only 2014-2024 and 2019-2024
    const result = getTimeWindowedPoS('rheumatoid_arthritis', 'most_recent');
    expect(result).not.toBeNull();
    expect(result!.resolvedWindow).toBe('2019-2024');
  });

  test('explicit window with no data falls back to most recent', () => {
    // Request 2021-2024 for an indication that only has older windows
    const result = getTimeWindowedPoS('rheumatoid_arthritis', '2021-2024' as TimeWindow);
    expect(result).not.toBeNull();
    // Should have fallen back, not thrown
    expect(result!.resolvedWindow).not.toBe('2021-2024');
  });

  test('lowConfidence flag is set when sampleSize < 20', () => {
    // alzheimers 2021-2024 sampleSize is 18
    const result = getTimeWindowedPoS('alzheimers', '2021-2024')!;
    expect(result.sampleSize).toBeLessThan(20);
    expect(result.lowConfidence).toBe(true);
  });

  test('lowConfidence flag is false for large cohorts', () => {
    const result = getTimeWindowedPoS('lung_nsclc', '2014-2024')!;
    expect(result.sampleSize).toBeGreaterThanOrEqual(20);
    expect(result.lowConfidence).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration with getCumulativePoS
// ---------------------------------------------------------------------------

describe('getCumulativePoS: time-window integration', () => {
  test('time window changes cumulative PoS for obesity (2014-2024 vs 2021-2024)', () => {
    const oldPoS = getCumulativePoS(
      'phase2',
      'metabolic',
      'smallMolecule',
      'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      'obesity',
      '2014-2024',
    );
    const recentPoS = getCumulativePoS(
      'phase2',
      'metabolic',
      'smallMolecule',
      'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      'obesity',
      '2021-2024',
    );
    expect(recentPoS.cumulativePoS).toBeGreaterThan(oldPoS.cumulativePoS);
  });

  test('time window makes NASH PoS worse in 2021-2024', () => {
    const oldPoS = getCumulativePoS(
      'phase2',
      'metabolic',
      'smallMolecule',
      'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      'nash_mash',
      '2014-2024',
    );
    const recentPoS = getCumulativePoS(
      'phase2',
      'metabolic',
      'smallMolecule',
      'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      'nash_mash',
      '2021-2024',
    );
    expect(recentPoS.cumulativePoS).toBeLessThan(oldPoS.cumulativePoS);
  });

  test('indications without time-window data behave identically regardless of timeWindow', () => {
    const regs = { breakthrough: false, fastTrack: false, orphan: false, prime: false };
    const a = getCumulativePoS('phase2', 'neurology', 'smallMolecule', 'unselected', regs, 'depression', '2014-2024');
    const b = getCumulativePoS('phase2', 'neurology', 'smallMolecule', 'unselected', regs, 'depression', '2021-2024');
    const c = getCumulativePoS('phase2', 'neurology', 'smallMolecule', 'unselected', regs, 'depression', 'most_recent');
    expect(a.cumulativePoS).toBeCloseTo(b.cumulativePoS, 10);
    expect(b.cumulativePoS).toBeCloseTo(c.cumulativePoS, 10);
  });

  test('omitting timeWindow falls back to multiplicative modifier path (opt-in semantics)', () => {
    // Per TIER2 flag-gating: omitting timeWindow should NOT activate
    // time-windowed cohort data. Caller must explicitly pass a window (or
    // set the TIER2_TIME_WINDOWED_POS flag in rnpv-engine) to opt in.
    // This preserves backward compatibility with golden masters until the
    // 100-deal backtest validates the time-windowed rates as more accurate.
    const regs = { breakthrough: false, fastTrack: false, orphan: false, prime: false };
    const omitted = getCumulativePoS('phase2', 'neurology', 'smallMolecule', 'unselected', regs, 'alzheimers');
    const explicit = getCumulativePoS('phase2', 'neurology', 'smallMolecule', 'unselected', regs, 'alzheimers', 'most_recent');
    // These should now differ — omitted uses the TA baseline + multiplicative
    // modifier, while explicit uses the 2021-2024 windowed absolute rates.
    expect(omitted.cumulativePoS).not.toBeCloseTo(explicit.cumulativePoS, 2);
  });
});

// ---------------------------------------------------------------------------
// Integration with calculateRNPV
// ---------------------------------------------------------------------------

describe('calculateRNPV: time-window integration', () => {
  test('obesity rNPV is higher with 2021-2024 window than 2014-2024', () => {
    const oldRun = calculateRNPV(
      makeInput({
        therapeuticArea: 'metabolic',
        indication: 'obesity',
        timeWindow: '2014-2024',
      }),
    );
    const recentRun = calculateRNPV(
      makeInput({
        therapeuticArea: 'metabolic',
        indication: 'obesity',
        timeWindow: '2021-2024',
      }),
    );
    // Same deterministic inputs, only the PoS window differs — recent should
    // produce a larger (or at least non-smaller) risk-adjusted value.
    expect(recentRun.riskAdjustedNPV).toBeGreaterThan(oldRun.riskAdjustedNPV);
  });

  test('nash_mash rNPV is lower with 2021-2024 window than 2014-2024', () => {
    const oldRun = calculateRNPV(
      makeInput({
        therapeuticArea: 'metabolic',
        indication: 'nash_mash',
        timeWindow: '2014-2024',
      }),
    );
    const recentRun = calculateRNPV(
      makeInput({
        therapeuticArea: 'metabolic',
        indication: 'nash_mash',
        timeWindow: '2021-2024',
      }),
    );
    expect(recentRun.riskAdjustedNPV).toBeLessThan(oldRun.riskAdjustedNPV);
  });

  test('RNPVInput without timeWindow still calculates successfully', () => {
    const run = calculateRNPV(makeInput());
    expect(Number.isFinite(run.riskAdjustedNPV)).toBe(true);
  });

  test('existing indication modifier logic still fires for non-windowed indications', () => {
    // `depression` is not in time-windowed but IS in indication modifiers.
    // Supplying any timeWindow should yield the same result as omitting it.
    const withWindow = calculateRNPV(
      makeInput({
        therapeuticArea: 'neurology',
        indication: 'depression',
        timeWindow: '2021-2024',
      }),
    );
    const without = calculateRNPV(
      makeInput({
        therapeuticArea: 'neurology',
        indication: 'depression',
      }),
    );
    expect(withWindow.riskAdjustedNPV).toBeCloseTo(without.riskAdjustedNPV, 6);
  });
});
