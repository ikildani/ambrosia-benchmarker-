/**
 * Tornado Sensitivity Analysis
 *
 * Computes dollar-impact sensitivity for key deal value drivers by varying
 * one factor at a time while holding all others constant.
 *
 * Pure TypeScript, zero external deps.
 */

import type { CalculationInput, CalculationResult } from '@/lib/calculations';
import type { TornadoSensitivity } from '@/components/TornadoChart';
import { calculateRNPV } from './rnpv-engine';
import { DEFAULT_DISCOUNT_RATES, TERRITORY_RISK_PREMIUM } from './discount-rates';
import type { RNPVInput } from './types';

// Phase-stratified peak sales multipliers (same as run-financial-model.ts)
const PEAK_SALES_MULTIPLIER: Record<string, { low: number; median: number; high: number }> = {
  preclinical: { low: 6, median: 12, high: 20 },
  phase1: { low: 4, median: 8, high: 14 },
  phase1_2: { low: 3, median: 6.5, high: 11 },
  phase2: { low: 2.5, median: 5, high: 9 },
  phase2_3: { low: 2, median: 4, high: 7 },
  phase3: { low: 1.5, median: 3, high: 5 },
  nda_filed: { low: 1.2, median: 2, high: 3.5 },
  approved: { low: 1.0, median: 1.5, high: 2.5 },
};

/** Build a base RNPVInput from calculator results (mirrors run-financial-model.ts) */
function buildBaseRNPVInput(inputs: CalculationInput, result: CalculationResult): RNPVInput {
  const totalDealMedian = result.terms.totalDealValue.median;
  const mult = PEAK_SALES_MULTIPLIER[inputs.phase] || PEAK_SALES_MULTIPLIER.phase2;

  return {
    phase: inputs.phase,
    therapeuticArea: inputs.therapeuticArea,
    modality: inputs.modality,
    indication: inputs.indication,
    territory: inputs.territory,
    peakSalesEstimate: {
      low: totalDealMedian * mult.low,
      median: totalDealMedian * mult.median,
      high: totalDealMedian * mult.high,
    },
    competitivePosition: inputs.competitivePosition || 'racing',
    dataQuality: inputs.dataQuality || 'moderate',
    biomarkerStatus: inputs.biomarker || 'unselected',
    regulatoryDesignations: {
      breakthrough: inputs.regulatoryDesignations?.breakthrough || false,
      fastTrack: inputs.regulatoryDesignations?.fastTrack || false,
      orphan: inputs.regulatoryDesignations?.orphan || false,
      prime: inputs.regulatoryDesignations?.prime || false,
    },
    discountRate: (() => {
      const baseRate = DEFAULT_DISCOUNT_RATES[inputs.therapeuticArea]?.[inputs.phase];
      return baseRate ? baseRate + (TERRITORY_RISK_PREMIUM[inputs.territory] || 0) : undefined;
    })(),
    benchmarkDealValue: {
      low: result.terms.totalDealValue.low,
      median: result.terms.totalDealValue.median,
      high: result.terms.totalDealValue.high,
    },
  };
}

/**
 * Compute tornado sensitivities for the 6 key deal value drivers.
 *
 * Returns an array of TornadoSensitivity objects sorted by total spread (widest first).
 * The rNPV engine is called once per variation (12 total: 2 per factor x 6 factors).
 */
export function computeTornadoSensitivities(
  inputs: CalculationInput,
  result: CalculationResult,
): TornadoSensitivity[] {
  const baseInput = buildBaseRNPVInput(inputs, result);
  const baseResult = calculateRNPV(baseInput);
  const baseValue = baseResult.riskAdjustedNPV; // $M

  const sensitivities: TornadoSensitivity[] = [];

  // Helper: run rNPV with overrides and return the riskAdjustedNPV
  function runWithOverride(overrides: Partial<RNPVInput>): number {
    const overriddenInput = { ...baseInput, ...overrides };
    try {
      return calculateRNPV(overriddenInput).riskAdjustedNPV;
    } catch {
      return baseValue;
    }
  }

  // 1. Probability of Success (+/-20% absolute from base cumulative PoS)
  // Rerun the engine via posMultiplier so the effect flows through cashflow
  // risk-weighting non-linearly (rather than a closed-form PoS ratio).
  const basePoS = baseResult.cumulativePoS;
  const posLow = Math.max(0.01, basePoS - 0.20);
  const posHigh = Math.min(0.99, basePoS + 0.20);
  const posLowMult = basePoS > 0 ? posLow / basePoS : 1.0;
  const posHighMult = basePoS > 0 ? posHigh / basePoS : 1.0;
  sensitivities.push({
    factor: 'Probability of Success',
    lowValue: runWithOverride({ posMultiplier: posLowMult }),
    highValue: runWithOverride({ posMultiplier: posHighMult }),
    lowLabel: `PoS ${(posLow * 100).toFixed(0)}%`,
    highLabel: `PoS ${(posHigh * 100).toFixed(0)}%`,
  });

  // 2. Peak Sales (+/-30% from base)
  const peakBase = baseInput.peakSalesEstimate;
  const peakLow = {
    low: peakBase.low * 0.7,
    median: peakBase.median * 0.7,
    high: peakBase.high * 0.7,
  };
  const peakHigh = {
    low: peakBase.low * 1.3,
    median: peakBase.median * 1.3,
    high: peakBase.high * 1.3,
  };
  sensitivities.push({
    factor: 'Peak Sales',
    lowValue: runWithOverride({ peakSalesEstimate: peakLow }),
    highValue: runWithOverride({ peakSalesEstimate: peakHigh }),
    lowLabel: 'Peak -30%',
    highLabel: 'Peak +30%',
  });

  // 3. Discount Rate / WACC (+/-2 percentage points)
  const baseDiscount = baseInput.discountRate ?? 0.12;
  const discountLow = Math.max(0.04, baseDiscount - 0.02);
  const discountHigh = baseDiscount + 0.02;
  sensitivities.push({
    factor: 'Discount Rate (WACC)',
    // Lower discount = higher NPV, higher discount = lower NPV
    lowValue: runWithOverride({ discountRate: discountHigh }),
    highValue: runWithOverride({ discountRate: discountLow }),
    lowLabel: `WACC ${(discountHigh * 100).toFixed(0)}%`,
    highLabel: `WACC ${(discountLow * 100).toFixed(0)}%`,
  });

  // 4. Time to Market (+/-1.5 years) — rerun engine with timeToMarketAdjustment
  // so discounting, R&D burn schedule, and LOE tail all shift consistently.
  sensitivities.push({
    factor: 'Time to Market',
    lowValue: runWithOverride({ timeToMarketAdjustment: 1.5 }),
    highValue: runWithOverride({ timeToMarketAdjustment: -1.5 }),
    lowLabel: '+1.5yr delay',
    highLabel: '-1.5yr faster',
  });

  // 5. Royalty Rate (+/-3 percentage points)
  // Royalties reduce licensor retention; model via benchmark deal value scaling
  const baseDealMedian = result.terms.totalDealValue.median;
  const royaltyImpactPct = 0.03; // 3pp
  // Higher royalty = lower licensor value; Lower royalty = higher licensor value
  // Approximate: each 1pp of royalty changes deal value by ~2-3% of total
  const royaltyMultiplier = 2.5;
  const royaltyLowValue = baseValue * (1 - royaltyImpactPct * royaltyMultiplier);
  const royaltyHighValue = baseValue * (1 + royaltyImpactPct * royaltyMultiplier);
  sensitivities.push({
    factor: 'Royalty Rate',
    lowValue: royaltyLowValue,
    highValue: royaltyHighValue,
    lowLabel: 'Royalty +3pp',
    highLabel: 'Royalty -3pp',
  });

  // 6. Market Share at Peak (+/-15 percentage points)
  // Approximate: market share directly scales peak revenue
  const shareBase = inputs.competitivePosition === 'firstInClass' ? 0.35
    : inputs.competitivePosition === 'bestInClass' ? 0.28
    : inputs.competitivePosition === 'racing' ? 0.22
    : 0.15;
  const shareLow = Math.max(0.05, shareBase - 0.15);
  const shareHigh = Math.min(0.60, shareBase + 0.15);
  const shareScaleLow = shareLow / shareBase;
  const shareScaleHigh = shareHigh / shareBase;
  // Market share primarily affects peak sales
  sensitivities.push({
    factor: 'Market Share at Peak',
    lowValue: runWithOverride({
      peakSalesEstimate: {
        low: peakBase.low * shareScaleLow,
        median: peakBase.median * shareScaleLow,
        high: peakBase.high * shareScaleLow,
      },
    }),
    highValue: runWithOverride({
      peakSalesEstimate: {
        low: peakBase.low * shareScaleHigh,
        median: peakBase.median * shareScaleHigh,
        high: peakBase.high * shareScaleHigh,
      },
    }),
    lowLabel: `Share ${(shareLow * 100).toFixed(0)}%`,
    highLabel: `Share ${(shareHigh * 100).toFixed(0)}%`,
  });

  // Sort by total spread descending
  return sensitivities.sort(
    (a, b) => Math.abs(b.highValue - b.lowValue) - Math.abs(a.highValue - a.lowValue)
  );
}
