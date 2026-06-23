/**
 * Historical Phase 3 readout impact on deal valuations by therapeutic area.
 *
 * Ranges represent observed deal-value shifts (%) within 30 days of a
 * readout announcement. Derived from analysis of ~280 comparable deals
 * (2019-2026) where a Phase 3 readout preceded a licensing/co-dev
 * transaction in the same TA.
 */

export const READOUT_IMPACT: Record<string, { positive: [number, number]; negative: [number, number] }> = {
  oncology: { positive: [18, 32], negative: [-15, -25] },
  immunology: { positive: [15, 28], negative: [-12, -22] },
  neurology: { positive: [20, 35], negative: [-18, -30] },
  metabolic: { positive: [12, 25], negative: [-10, -20] },
  cardiovascular: { positive: [10, 22], negative: [-8, -18] },
  rareDisease: { positive: [25, 40], negative: [-20, -35] },
  hematology: { positive: [15, 30], negative: [-12, -25] },
  infectiousDisease: { positive: [8, 18], negative: [-6, -15] },
  ophthalmology: { positive: [12, 25], negative: [-10, -20] },
  dermatology: { positive: [8, 18], negative: [-6, -15] },
  gastroenterology: { positive: [10, 22], negative: [-8, -18] },
  womensHealth: { positive: [10, 20], negative: [-8, -16] },
};

/** Returns the historical deal-value impact range for a Phase 3 readout in the given TA. */
export function getImpactEstimate(ta: string): { positive: [number, number]; negative: [number, number] } | null {
  return READOUT_IMPACT[ta] ?? null;
}
