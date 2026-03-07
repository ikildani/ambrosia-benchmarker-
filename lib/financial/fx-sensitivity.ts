/**
 * FX & Pricing Dynamics Engine
 *
 * Models the impact of currency fluctuations, regulatory pricing pressure
 * (EU IRA, China NRDL, Japan NHI), and geographic revenue mix on deal economics.
 */

import type { FXSensitivity, TerritoryPricingProfile } from './types';

/**
 * Territory pricing profiles with regulatory pressure and FX volatility data.
 * Sources: IQVIA, WHO pricing reports, Bloomberg FX volatility data
 */
export const TERRITORY_PRICING_PROFILES: Record<string, TerritoryPricingProfile> = {
  us_only: {
    territory: 'us_only',
    currencyCode: 'USD',
    pricingIndexVsUS: 1.00,
    regulatoryPressure: 'moderate', // IRA impact starting 2026+
    iraImpact: 0.08, // 8% average price erosion from IRA negotiation (for eligible drugs)
    volatility12mo: 0.0,
    notes: [
      'IRA Medicare price negotiation begins 2026 for first 10 drugs',
      'Part D redesign reduces out-of-pocket costs but shifts payer economics',
      'Specialty pharmacy remains high-price, high-access market',
    ],
  },
  europe: {
    territory: 'europe',
    currencyCode: 'EUR',
    pricingIndexVsUS: 0.38,
    regulatoryPressure: 'high',
    referenceBasketDiscount: 0.12, // 12% average reference pricing impact
    volatility12mo: 0.08, // EUR/USD 12-month historical volatility
    notes: [
      'EU HTA regulation (Jan 2025) harmonizes clinical assessments',
      'Reference pricing spreads discounts across member states',
      'Germany AMNOG and France CEESP drive largest market access decisions',
      'Orphan drug exemptions partially protect rare disease pricing',
    ],
  },
  china: {
    territory: 'china',
    currencyCode: 'CNY',
    pricingIndexVsUS: 0.15,
    regulatoryPressure: 'high',
    nrdlDiscount: 0.62, // Average 62% discount in NRDL negotiations (2023-2025 data)
    volatility12mo: 0.05, // CNY/USD relatively managed
    notes: [
      'NRDL annual negotiations require 50-70% discount from list price',
      'Volume-based procurement (VBP) for generics drives aggressive pricing',
      'Innovative drugs (first-in-class) receive preferential NRDL treatment',
      'Market access speed has improved: 1-2 years post-approval to NRDL',
    ],
  },
  japan: {
    territory: 'japan',
    currencyCode: 'JPY',
    pricingIndexVsUS: 0.25,
    regulatoryPressure: 'moderate',
    volatility12mo: 0.12, // JPY/USD high volatility recently
    notes: [
      'NHI drug pricing reform: biannual price revisions since 2021',
      'Cost-effectiveness evaluation (CEA) required for high-cost drugs',
      'Premium pricing available for innovative drugs with clinical value',
      'Sakigake and PRIME designations accelerate review by 6-12 months',
    ],
  },
  global: {
    territory: 'global',
    currencyCode: 'USD',
    pricingIndexVsUS: 0.28, // Blended global average (pharma-accessible markets)
    regulatoryPressure: 'moderate',
    volatility12mo: 0.06, // Trade-weighted USD index volatility
    notes: [
      'Global deals face blended pricing across all markets',
      'Revenue mix typically 55-65% US, 15-20% EU, 5-10% Japan, 5-10% China, 10-15% ROW',
    ],
  },
  ex_us: {
    territory: 'ex_us',
    currencyCode: 'USD',
    pricingIndexVsUS: 0.22,
    regulatoryPressure: 'high',
    volatility12mo: 0.07,
    notes: [
      'Ex-US pricing averages 20-30% of US list price',
      'Reference pricing chains amplify discounts across markets',
    ],
  },
  row: {
    territory: 'row',
    currencyCode: 'USD',
    pricingIndexVsUS: 0.15,
    regulatoryPressure: 'high',
    volatility12mo: 0.10,
    notes: [
      'Emerging markets price at 10-20% of US levels',
      'Access programs and tiered pricing common',
    ],
  },
  us_eu: {
    territory: 'us_eu',
    currencyCode: 'USD',
    pricingIndexVsUS: 0.72,
    regulatoryPressure: 'moderate',
    volatility12mo: 0.04,
    notes: ['Combined US+EU rights typically priced at 80-90% of global deal value'],
  },
  us_japan: {
    territory: 'us_japan',
    currencyCode: 'USD',
    pricingIndexVsUS: 0.80,
    regulatoryPressure: 'moderate',
    volatility12mo: 0.06,
    notes: ['US+Japan rights typically priced at 60-70% of global deal value'],
  },
  canada: {
    territory: 'canada',
    currencyCode: 'CAD',
    pricingIndexVsUS: 0.55,
    regulatoryPressure: 'moderate',
    volatility12mo: 0.06,
    notes: [
      'PMPRB price controls cap patented drug prices',
      'CADTH and INESSS drive provincial reimbursement decisions',
      'Market ~2-3% of global pharma revenue',
    ],
  },
  australia: {
    territory: 'australia',
    currencyCode: 'AUD',
    pricingIndexVsUS: 0.45,
    regulatoryPressure: 'moderate',
    volatility12mo: 0.08,
    notes: [
      'PBS reimbursement via PBAC HTA — strict cost-effectiveness thresholds',
      'Market ~2% of global pharma revenue',
      'Includes New Zealand (PHARMAC)',
    ],
  },
  south_korea: {
    territory: 'south_korea',
    currencyCode: 'KRW',
    pricingIndexVsUS: 0.30,
    regulatoryPressure: 'moderate',
    volatility12mo: 0.07,
    notes: [
      'HIRA price controls with mandatory price-volume agreements',
      'Growing biosimilar hub with strong domestic innovation',
      'Market ~2-3% of global pharma revenue',
    ],
  },
  apac_ex_cj: {
    territory: 'apac_ex_cj',
    currencyCode: 'USD',
    pricingIndexVsUS: 0.10,
    regulatoryPressure: 'high',
    volatility12mo: 0.09,
    notes: [
      'India, SE Asia, Taiwan — large populations, low per-capita pricing',
      'India DPCO price controls on essential medicines',
      'Highly fragmented regulatory landscape',
    ],
  },
  latam: {
    territory: 'latam',
    currencyCode: 'USD',
    pricingIndexVsUS: 0.18,
    regulatoryPressure: 'high',
    volatility12mo: 0.12,
    notes: [
      'Brazil (ANVISA/CMED) and Mexico lead the region',
      'Reference pricing and government tenders common',
      'Currency volatility significant (BRL, MXN, ARS)',
    ],
  },
  mena: {
    territory: 'mena',
    currencyCode: 'USD',
    pricingIndexVsUS: 0.20,
    regulatoryPressure: 'moderate',
    volatility12mo: 0.05,
    notes: [
      'Gulf states (UAE, Saudi) premium-priced, USD-pegged currencies',
      'North Africa tender-based, lower pricing',
      'Market ~2% of global pharma revenue',
    ],
  },
};

/**
 * Calculate FX and pricing sensitivity for a deal.
 *
 * @param territory - Territory scope of the deal
 * @param baseRevenue - Base case annual peak revenue ($M)
 * @param baseDealValue - Base case total deal value ($M)
 * @returns FX sensitivity analysis with scenarios
 */
export function calculateFXSensitivity(
  territory: string,
  baseRevenue: number,
  baseDealValue: number,
): FXSensitivity {
  const profile = TERRITORY_PRICING_PROFILES[territory] || TERRITORY_PRICING_PROFILES.global;

  // FX scenarios: ±5%, ±10%, ±15% USD move
  const fxScenarios = [
    { label: 'USD weakens 15%', fxChange: -0.15 },
    { label: 'USD weakens 10%', fxChange: -0.10 },
    { label: 'USD weakens 5%', fxChange: -0.05 },
    { label: 'Base case', fxChange: 0 },
    { label: 'USD strengthens 5%', fxChange: 0.05 },
    { label: 'USD strengthens 10%', fxChange: 0.10 },
    { label: 'USD strengthens 15%', fxChange: 0.15 },
  ];

  // For US-only deals, FX impact is zero
  const fxExposure = territory === 'us_only' ? 0 : getNonUSDRevenueShare(territory);

  const scenarios = fxScenarios.map(s => {
    // Revenue impact: only non-USD revenue is affected
    const revenueImpact = -baseRevenue * fxExposure * s.fxChange;
    // Deal value moves roughly proportionally to revenue
    const dealValueImpact = -baseDealValue * fxExposure * s.fxChange;

    return {
      label: s.label,
      fxChange: s.fxChange,
      revenueImpact: Math.round(revenueImpact * 10) / 10,
      dealValueImpact: Math.round(dealValueImpact * 10) / 10,
    };
  });

  // Regulatory pricing pressure impact
  let regulatoryImpact = 0;
  if (profile.iraImpact && (territory === 'us_only' || territory === 'global' || territory === 'us_eu' || territory === 'us_japan')) {
    const usShare = territory === 'us_only' ? 1.0 : territory === 'us_eu' ? 0.70 : territory === 'us_japan' ? 0.65 : 0.60;
    regulatoryImpact += baseRevenue * usShare * profile.iraImpact;
  }
  if (profile.nrdlDiscount && (territory === 'china' || territory === 'global' || territory === 'ex_us')) {
    const chinaShare = territory === 'china' ? 1.0 : territory === 'global' ? 0.08 : 0.10;
    regulatoryImpact += baseRevenue * chinaShare * 0.10; // 10% additional erosion risk
  }
  if (profile.referenceBasketDiscount && (territory === 'europe' || territory === 'global' || territory === 'ex_us' || territory === 'us_eu')) {
    const euShare = territory === 'europe' ? 1.0 : territory === 'us_eu' ? 0.35 : territory === 'global' ? 0.20 : 0.25;
    regulatoryImpact += baseRevenue * euShare * 0.05; // 5% additional reference pricing erosion
  }

  return {
    baseCaseRevenue: baseRevenue,
    scenarios,
    regulatoryPricingImpact: Math.round(regulatoryImpact),
    totalAdjustedRevenue: Math.round(baseRevenue - regulatoryImpact),
  };
}

/** Estimate non-USD revenue share by territory */
function getNonUSDRevenueShare(territory: string): number {
  const shares: Record<string, number> = {
    global: 0.40,     // ~40% of global pharma revenue is non-USD
    us_only: 0.0,
    europe: 0.95,     // Almost entirely EUR-denominated
    china: 0.95,      // Almost entirely CNY-denominated
    japan: 0.95,      // Almost entirely JPY-denominated
    ex_us: 0.85,      // Mix of EUR, JPY, CNY, other
    row: 0.90,        // Various non-USD currencies
    us_eu: 0.35,      // ~35% EUR exposure
    us_japan: 0.25,   // ~25% JPY exposure
    canada: 0.95,     // Almost entirely CAD-denominated
    australia: 0.95,  // Almost entirely AUD-denominated
    south_korea: 0.95, // Almost entirely KRW-denominated
    apac_ex_cj: 0.90, // Mix of INR, THB, TWD, etc.
    latam: 0.90,      // Mix of BRL, MXN, COP
    mena: 0.30,       // Gulf states USD-pegged, North Africa local
  };
  return shares[territory] || 0.40;
}

/**
 * Generate pricing pressure narrative for report.
 */
export function getPricingPressureNarrative(territory: string): string {
  const profile = TERRITORY_PRICING_PROFILES[territory];
  if (!profile) return 'Territory-specific pricing data not available.';

  const notes = profile.notes.join(' ');
  const pressure = profile.regulatoryPressure === 'high'
    ? 'significant regulatory pricing pressure'
    : profile.regulatoryPressure === 'moderate'
      ? 'moderate regulatory pricing dynamics'
      : 'relatively favorable pricing environment';

  return `${profile.territory.replace(/_/g, ' ').toUpperCase()} faces ${pressure}. ${notes}`;
}
