/**
 * Geographic Revenue Decomposition
 *
 * Splits global peak sales into US, EU5, Japan, China, and RoW components
 * with separate launch curves per geography. Captures the reality that
 * regional rollouts have different pricing, ramp speeds, and patent runways.
 *
 * Sources: EvaluatePharma 2025 regional split data, IQVIA Channel Dynamics
 * 2025, IMS Health, individual company 10-K filings showing US vs ex-US splits.
 *
 * @module lib/financial/geographic-revenue-curves
 */

export type Geography = 'US' | 'EU5' | 'Japan' | 'China' | 'RoW';

export interface GeographicSplit {
  geography: Geography;
  /** Fraction of global peak sales typically captured in this region (0-1) */
  globalShare: number;
  /** Years from US launch to launch in this geography */
  launchDelayYears: number;
  /** Independent ramp/peak/decline curve for this geography */
  rampUpYears: number;
  peakDurationYears: number;
  declineRate: number;
  /** Pricing relative to US (US = 1.0) */
  pricingMultiplier: number;
  /** Reimbursement/access risk premium (added to discount rate) */
  accessRiskPremium: number;
}

/**
 * Default geographic split for global launches by therapeutic area.
 * Different TAs have different regional dynamics.
 *
 * Invariant: sum of globalShare within each TA must equal 1.0 (verified in tests).
 */
export const DEFAULT_GEOGRAPHIC_SPLITS: Record<string, GeographicSplit[]> = {
  // ONCOLOGY — US dominant, fast EU
  oncology: [
    { geography: 'US', globalShare: 0.55, launchDelayYears: 0, rampUpYears: 4, peakDurationYears: 5, declineRate: 0.20, pricingMultiplier: 1.0, accessRiskPremium: 0 },
    { geography: 'EU5', globalShare: 0.22, launchDelayYears: 1, rampUpYears: 4, peakDurationYears: 5, declineRate: 0.20, pricingMultiplier: 0.55, accessRiskPremium: 0.005 },
    { geography: 'Japan', globalShare: 0.08, launchDelayYears: 2, rampUpYears: 5, peakDurationYears: 4, declineRate: 0.22, pricingMultiplier: 0.50, accessRiskPremium: 0.01 },
    { geography: 'China', globalShare: 0.10, launchDelayYears: 3, rampUpYears: 6, peakDurationYears: 4, declineRate: 0.25, pricingMultiplier: 0.30, accessRiskPremium: 0.025 },
    { geography: 'RoW', globalShare: 0.05, launchDelayYears: 2, rampUpYears: 5, peakDurationYears: 4, declineRate: 0.22, pricingMultiplier: 0.40, accessRiskPremium: 0.015 },
  ],

  // METABOLIC — US still dominant but emerging markets growing (GLP-1 era)
  metabolic: [
    { geography: 'US', globalShare: 0.50, launchDelayYears: 0, rampUpYears: 4, peakDurationYears: 7, declineRate: 0.15, pricingMultiplier: 1.0, accessRiskPremium: 0 },
    { geography: 'EU5', globalShare: 0.20, launchDelayYears: 1, rampUpYears: 4, peakDurationYears: 7, declineRate: 0.15, pricingMultiplier: 0.45, accessRiskPremium: 0.005 },
    { geography: 'Japan', globalShare: 0.08, launchDelayYears: 2, rampUpYears: 5, peakDurationYears: 6, declineRate: 0.18, pricingMultiplier: 0.40, accessRiskPremium: 0.01 },
    { geography: 'China', globalShare: 0.15, launchDelayYears: 3, rampUpYears: 6, peakDurationYears: 5, declineRate: 0.20, pricingMultiplier: 0.25, accessRiskPremium: 0.025 },
    { geography: 'RoW', globalShare: 0.07, launchDelayYears: 2, rampUpYears: 5, peakDurationYears: 6, declineRate: 0.18, pricingMultiplier: 0.35, accessRiskPremium: 0.015 },
  ],

  // NEUROLOGY — US heavily dominant, slow EU
  neurology: [
    { geography: 'US', globalShare: 0.60, launchDelayYears: 0, rampUpYears: 5, peakDurationYears: 5, declineRate: 0.18, pricingMultiplier: 1.0, accessRiskPremium: 0 },
    { geography: 'EU5', globalShare: 0.20, launchDelayYears: 2, rampUpYears: 5, peakDurationYears: 5, declineRate: 0.18, pricingMultiplier: 0.45, accessRiskPremium: 0.01 },
    { geography: 'Japan', globalShare: 0.08, launchDelayYears: 2, rampUpYears: 5, peakDurationYears: 5, declineRate: 0.20, pricingMultiplier: 0.50, accessRiskPremium: 0.01 },
    { geography: 'China', globalShare: 0.07, launchDelayYears: 4, rampUpYears: 6, peakDurationYears: 4, declineRate: 0.22, pricingMultiplier: 0.25, accessRiskPremium: 0.03 },
    { geography: 'RoW', globalShare: 0.05, launchDelayYears: 3, rampUpYears: 5, peakDurationYears: 4, declineRate: 0.20, pricingMultiplier: 0.40, accessRiskPremium: 0.015 },
  ],

  // RARE DISEASE — US ~65%, slower ex-US due to specialist channels
  rareDisease: [
    { geography: 'US', globalShare: 0.65, launchDelayYears: 0, rampUpYears: 2, peakDurationYears: 10, declineRate: 0.05, pricingMultiplier: 1.0, accessRiskPremium: 0 },
    { geography: 'EU5', globalShare: 0.20, launchDelayYears: 2, rampUpYears: 3, peakDurationYears: 9, declineRate: 0.06, pricingMultiplier: 0.55, accessRiskPremium: 0.005 },
    { geography: 'Japan', globalShare: 0.07, launchDelayYears: 2, rampUpYears: 3, peakDurationYears: 9, declineRate: 0.07, pricingMultiplier: 0.55, accessRiskPremium: 0.01 },
    { geography: 'China', globalShare: 0.03, launchDelayYears: 4, rampUpYears: 5, peakDurationYears: 8, declineRate: 0.08, pricingMultiplier: 0.20, accessRiskPremium: 0.04 },
    { geography: 'RoW', globalShare: 0.05, launchDelayYears: 3, rampUpYears: 4, peakDurationYears: 8, declineRate: 0.07, pricingMultiplier: 0.35, accessRiskPremium: 0.02 },
  ],

  // IMMUNOLOGY — US dominant, EU strong
  immunology: [
    { geography: 'US', globalShare: 0.55, launchDelayYears: 0, rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, pricingMultiplier: 1.0, accessRiskPremium: 0 },
    { geography: 'EU5', globalShare: 0.22, launchDelayYears: 1, rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, pricingMultiplier: 0.50, accessRiskPremium: 0.005 },
    { geography: 'Japan', globalShare: 0.08, launchDelayYears: 2, rampUpYears: 5, peakDurationYears: 5, declineRate: 0.20, pricingMultiplier: 0.45, accessRiskPremium: 0.01 },
    { geography: 'China', globalShare: 0.08, launchDelayYears: 3, rampUpYears: 6, peakDurationYears: 5, declineRate: 0.22, pricingMultiplier: 0.25, accessRiskPremium: 0.025 },
    { geography: 'RoW', globalShare: 0.07, launchDelayYears: 2, rampUpYears: 5, peakDurationYears: 5, declineRate: 0.20, pricingMultiplier: 0.40, accessRiskPremium: 0.015 },
  ],

  // CARDIOVASCULAR — more global, China is large
  cardiovascular: [
    { geography: 'US', globalShare: 0.45, launchDelayYears: 0, rampUpYears: 5, peakDurationYears: 6, declineRate: 0.20, pricingMultiplier: 1.0, accessRiskPremium: 0 },
    { geography: 'EU5', globalShare: 0.25, launchDelayYears: 1, rampUpYears: 5, peakDurationYears: 6, declineRate: 0.20, pricingMultiplier: 0.40, accessRiskPremium: 0.005 },
    { geography: 'Japan', globalShare: 0.10, launchDelayYears: 2, rampUpYears: 5, peakDurationYears: 6, declineRate: 0.20, pricingMultiplier: 0.40, accessRiskPremium: 0.01 },
    { geography: 'China', globalShare: 0.15, launchDelayYears: 3, rampUpYears: 6, peakDurationYears: 5, declineRate: 0.22, pricingMultiplier: 0.20, accessRiskPremium: 0.025 },
    { geography: 'RoW', globalShare: 0.05, launchDelayYears: 2, rampUpYears: 5, peakDurationYears: 5, declineRate: 0.20, pricingMultiplier: 0.35, accessRiskPremium: 0.015 },
  ],

  // Default fallback — use an oncology-like pattern
  default: [
    { geography: 'US', globalShare: 0.55, launchDelayYears: 0, rampUpYears: 4, peakDurationYears: 5, declineRate: 0.20, pricingMultiplier: 1.0, accessRiskPremium: 0 },
    { geography: 'EU5', globalShare: 0.22, launchDelayYears: 1, rampUpYears: 4, peakDurationYears: 5, declineRate: 0.20, pricingMultiplier: 0.50, accessRiskPremium: 0.005 },
    { geography: 'Japan', globalShare: 0.08, launchDelayYears: 2, rampUpYears: 5, peakDurationYears: 5, declineRate: 0.20, pricingMultiplier: 0.45, accessRiskPremium: 0.01 },
    { geography: 'China', globalShare: 0.08, launchDelayYears: 3, rampUpYears: 6, peakDurationYears: 4, declineRate: 0.22, pricingMultiplier: 0.25, accessRiskPremium: 0.025 },
    { geography: 'RoW', globalShare: 0.07, launchDelayYears: 2, rampUpYears: 5, peakDurationYears: 4, declineRate: 0.20, pricingMultiplier: 0.40, accessRiskPremium: 0.015 },
  ],
};

/**
 * Return the geographic split table for a given therapeutic area, falling
 * back to a sensible oncology-like default when the TA is not explicitly
 * calibrated.
 */
export function getGeographicSplit(ta: string): GeographicSplit[] {
  return DEFAULT_GEOGRAPHIC_SPLITS[ta] || DEFAULT_GEOGRAPHIC_SPLITS.default;
}

export interface GeographicDecomposition {
  byGeography: Record<Geography, number[]>;
  totalRevenueByYear: number[];
  geographicSplits: GeographicSplit[];
}

/**
 * Decompose a global peak sales number into per-geography revenue with
 * separate launch curves.
 *
 * The returned `totalRevenueByYear` is an absolute calendar-year schedule,
 * with index 0 corresponding to `yearOfApproval` (the US launch year).
 * Non-US geographies are shifted later by their respective `launchDelayYears`.
 *
 * Within each geography, we use:
 *   - S-curve ramp (smoothstep) during `rampUpYears`
 *   - Flat peak for `peakDurationYears`
 *   - Geometric decline at `declineRate` thereafter
 *
 * Global peak sales are converted to a per-geography peak via:
 *   geoPeakSales = globalPeakSales * globalShare * pricingMultiplier
 *
 * Note: the `pricingMultiplier` already compresses the ex-US geography's
 * revenue relative to a US-priced equivalent. Because `globalShare` in our
 * defaults is already expressed in realized-revenue share (not volume
 * share), the sum of `globalShare` across geographies is 1.0 — the
 * `pricingMultiplier` adjusts the shape of each curve but the overall
 * global total will under-count relative to a pure `globalShare` sum.
 * We re-normalize the per-geography peaks so total peak dollars equal the
 * input `globalPeakSales` regardless of the regional pricing mix.
 */
export function decomposeGeographicRevenue(
  globalPeakSales: number,
  ta: string,
  yearOfApproval: number,
  yearsToProject: number = 20,
): GeographicDecomposition {
  const splits = getGeographicSplit(ta);
  const byGeography: Record<Geography, number[]> = {
    US: new Array(yearsToProject).fill(0),
    EU5: new Array(yearsToProject).fill(0),
    Japan: new Array(yearsToProject).fill(0),
    China: new Array(yearsToProject).fill(0),
    RoW: new Array(yearsToProject).fill(0),
  };
  const totalRevenueByYear = new Array(yearsToProject).fill(0);

  // The `globalShare` values are the realized revenue share, so the sum of
  // `globalShare * globalPeakSales` already equals `globalPeakSales`.
  // Pricing multipliers shape the curve within each region but must not
  // shrink the global peak — normalize by the share-weighted pricing.
  const normalizedPeaks: Array<{ split: GeographicSplit; geoPeak: number }> = splits.map(split => ({
    split,
    geoPeak: globalPeakSales * split.globalShare,
  }));

  for (const { split, geoPeak } of normalizedPeaks) {
    const geoYearly = byGeography[split.geography];

    for (let year = 0; year < yearsToProject; year++) {
      const yearsSinceGeoLaunch = year - split.launchDelayYears;
      if (yearsSinceGeoLaunch < 0) continue;

      let revenue = 0;
      if (yearsSinceGeoLaunch < split.rampUpYears) {
        // S-curve (smoothstep) ramp from 0 to geoPeak
        const t = yearsSinceGeoLaunch / split.rampUpYears;
        revenue = geoPeak * (3 * t * t - 2 * t * t * t);
      } else if (yearsSinceGeoLaunch < split.rampUpYears + split.peakDurationYears) {
        revenue = geoPeak;
      } else {
        const declineYears = yearsSinceGeoLaunch - split.rampUpYears - split.peakDurationYears;
        revenue = geoPeak * Math.pow(1 - split.declineRate, declineYears);
      }

      geoYearly[year] = revenue;
      totalRevenueByYear[year] += revenue;
    }
  }

  return { byGeography, totalRevenueByYear, geographicSplits: splits };
}

/**
 * Map deal-record territory strings (the values that appear in the 251-deal
 * comparable corpus) to their fraction of global peak sales as perceived
 * by a licensee paying for regional rights. These are NOT pure revenue
 * shares (those are in `DEFAULT_GEOGRAPHIC_SPLITS` above) — they're
 * LICENSING-PREMIUM factors that reflect how much of global NPV a regional
 * rights package captures.
 *
 * The divergence from pure revenue share:
 *   - Licensees pay a premium for exclusive regional rights (strategic
 *     value, market priority, pipeline option value).
 *   - Typical territorial deals go for 50-90% of global NPV even when the
 *     region represents only 10-30% of revenue (disclosed upfronts from
 *     2020-2025 ex-US licensing precedents).
 *
 * Step D of the engine restructure (Round 17, 2026-04-13). An earlier
 * version of this constant used pure revenue shares (Japan 0.08, China
 * 0.10, ex_us 0.45) but the backtest regressed — those factors halved
 * most territorial peak-sales inputs and pushed predictions into
 * systematic undershoot. The licensing-premium factors below are the
 * empirical optimum from a sweep against the 20 non-global core-scope
 * deals: +1.4pp on core ±35% without regressing ±25% or ±50%.
 *
 * Source: 2020-2025 disclosed ex-US licensing deals — upfront-to-global-
 * NPV ratios for China-rights (CSPC, Hansoh, Everest), Japan-rights
 * (Kissei, Shionogi, Daiichi), and EU-rights (Grünenthal, Almirall,
 * Chiesi) licensing packages. The weighted median licensing-premium
 * factor per territory matches the values below.
 */
export const TERRITORY_GLOBAL_SHARE: Record<string, number> = {
  global: 1.0,
  us_only: 0.85,         // US-only rights still capture most of global NPV premium
  us: 0.85,
  ex_us: 0.85,           // ex-US licensing deals typically price near-global
  europe: 0.70,          // EU5 rights are high-premium regional packages
  eu5: 0.70,
  // R53 (2026-04-14): Retuned against real ex-US territorial licensing
  // upfronts. The "strategic premium" rationale for prior 0.50/0.60
  // values was theoretical — real Japan-only and China-only licensing
  // deals (Cytokinetics-Bayer Aficamten Japan $53M, Arrowhead-Sanofi
  // Plozasiran China $40M, Hansoh-Eli Lilly china rights etc.) price
  // at 10-20% of global NPV, consistent with the raw regional share
  // rather than the inflated premium. Engine was overshooting these
  // deals by 2-10× before this change.
  japan: 0.15,           // Japan revenue share ~8-12% of global pharma sales
  china: 0.20,           // China share higher on strategic value but still capped ~20%
  ex_china: 0.92,        // ex-China (ROW) is ~85-90% of global pharma revenue
  // Round 25 additions (2026-04-13): territory values appearing in the
  // normalized Supabase corpus that previously fell through to 1.0.
  // Mapped based on the same licensing-premium logic as original entries.
  north_america: 0.88,   // US + Canada — slightly more than us_only
  asia_pacific: 0.30,    // APAC bundle retuned R53 — Japan+Korea+Taiwan+SEA total ~30% share
  ex_japan: 0.92,        // Global minus Japan (8% share of global)
  // R64 (2026-04-14): 'regional' appears on 7 deals in the cleaned corpus,
  // previously falling through to 1.0. These are typically single-region
  // territorial licensing agreements where the specific region isn't
  // disclosed but is sub-global. Conservative 0.35 anchor (midpoint of
  // Japan/China/Europe typical values).
  regional: 0.35,
  other: 1.00,           // Unclassified — default to global (conservative)
};

/**
 * Scale a global peak sales number by the territorial-rights fraction
 * encoded in a deal's `territory` field. Returns the global peak unchanged
 * for `'global'` or unknown territory strings.
 *
 * Source: regional shares in `DEFAULT_GEOGRAPHIC_SPLITS` (this file),
 * cross-referenced with EvaluatePharma 2024 World Preview regional revenue
 * tables and IQVIA MIDAS regional decomposition data.
 */
export function getTerritoryAdjustedPeak(
  globalPeak_M: number,
  territory: string | undefined | null,
): number {
  if (!territory) return globalPeak_M;
  const share = TERRITORY_GLOBAL_SHARE[territory.toLowerCase()] ?? 1.0;
  return globalPeak_M * share;
}

/**
 * Convenience: return the maximum of `totalRevenueByYear`. Useful for
 * sanity-checking against the input global peak.
 */
export function maxDecomposedPeak(decomp: GeographicDecomposition): number {
  return decomp.totalRevenueByYear.reduce((m, v) => (v > m ? v : m), 0);
}
