/**
 * Market Size Estimation Engine
 *
 * Estimates Total Addressable Market (TAM), Serviceable Addressable Market (SAM),
 * and peak sales potential using curated epidemiology data and territory-specific
 * pricing models.
 */

import type { MarketSizeEstimate, EpidemiologyData } from './types';

// Territory population and pricing data (inline to avoid JSON import issues)
const TERRITORY_DATA: Record<string, { population: number; pricingIndexVsUS: number }> = {
  global: { population: 8_100_000_000, pricingIndexVsUS: 0.45 },
  us_only: { population: 335_000_000, pricingIndexVsUS: 1.00 },
  europe: { population: 450_000_000, pricingIndexVsUS: 0.65 },
  china: { population: 1_410_000_000, pricingIndexVsUS: 0.15 },
  japan: { population: 124_000_000, pricingIndexVsUS: 0.70 },
  ex_us: { population: 7_765_000_000, pricingIndexVsUS: 0.40 },
  row: { population: 5_940_000_000, pricingIndexVsUS: 0.25 },
  us_eu: { population: 785_000_000, pricingIndexVsUS: 0.85 },
  us_japan: { population: 459_000_000, pricingIndexVsUS: 0.90 },
};

/** Market share assumptions by competitive position */
const MARKET_SHARE_BY_POSITION: Record<string, { low: number; median: number; high: number }> = {
  firstInClass: { low: 0.25, median: 0.35, high: 0.50 },
  firstToPivotal: { low: 0.20, median: 0.30, high: 0.40 },
  bestInClass: { low: 0.15, median: 0.25, high: 0.35 },
  racing: { low: 0.10, median: 0.18, high: 0.25 },
  behind: { low: 0.05, median: 0.10, high: 0.18 },
  crowded: { low: 0.03, median: 0.08, high: 0.12 },
};

/**
 * Estimate market size for an indication in a given territory.
 *
 * @param indication - The indication key (e.g., 'lung_nsclc')
 * @param territory - Territory key (e.g., 'us_only', 'global')
 * @param competitivePosition - Competitive position key
 * @param epidemiologyData - Curated epidemiology data for this indication
 * @returns Market size estimate with patient funnel and peak sales range
 */
export function estimateMarketSize(
  indication: string,
  territory: string,
  competitivePosition: string,
  epidemiologyData: EpidemiologyData,
): MarketSizeEstimate {
  const territoryInfo = TERRITORY_DATA[territory] || TERRITORY_DATA.global;
  const shareAssumption = MARKET_SHARE_BY_POSITION[competitivePosition] || MARKET_SHARE_BY_POSITION.racing;

  // Patient funnel calculation
  const totalPopulation = territoryInfo.population;
  const prevalentPatients = Math.round(
    (epidemiologyData.prevalencePerMillion / 1_000_000) * totalPopulation
  );
  const diagnosedPatients = Math.round(prevalentPatients * epidemiologyData.diagnosedPercent);
  const treatedPatients = Math.round(diagnosedPatients * epidemiologyData.treatedPercent);
  const drugEligiblePatients = Math.round(treatedPatients * epidemiologyData.drugEligiblePercent);

  // Revenue per patient adjusted for territory pricing
  const annualRevenuePerPatient = epidemiologyData.annualCostOfTherapy * territoryInfo.pricingIndexVsUS;

  // Addressable patients (drug-eligible × adoption ceiling ~70%)
  const adoptionCeiling = 0.70;
  const addressablePatients = Math.round(drugEligiblePatients * adoptionCeiling);

  // TAM = all drug-eligible patients × annual cost
  const tam = (drugEligiblePatients * annualRevenuePerPatient) / 1_000_000; // $M

  // SAM = addressable patients × annual cost (accounting for adoption)
  const sam = (addressablePatients * annualRevenuePerPatient) / 1_000_000; // $M

  // SOM = SAM × market share
  const som = {
    low: sam * shareAssumption.low,
    median: sam * shareAssumption.median,
    high: sam * shareAssumption.high,
  };

  // Peak sales = SOM (represents steady-state annual revenue at peak penetration)
  const peakSales = {
    low: Math.round(som.low),
    median: Math.round(som.median),
    high: Math.round(som.high),
  };

  return {
    indication,
    territory,
    totalAddressableMarket: Math.round(tam),
    serviceableAddressableMarket: Math.round(sam),
    serviceableObtainableMarket: Math.round(som.median),
    peakSales,
    patientFunnel: {
      totalPopulation,
      prevalentPatients,
      diagnosedPatients,
      treatedPatients,
      drugEligiblePatients,
      addressablePatients,
    },
    marketShareAssumption: shareAssumption,
    annualRevenuePerPatient: Math.round(annualRevenuePerPatient),
    sources: epidemiologyData.sources,
  };
}

/**
 * Get epidemiology data from the curated dataset.
 * Falls back to therapeutic-area defaults if specific indication not found.
 */
export function getEpidemiologyData(
  indication: string,
  epidemiologyDataset: Record<string, EpidemiologyData>,
): EpidemiologyData {
  if (epidemiologyDataset[indication]) {
    return epidemiologyDataset[indication];
  }

  // Fallback: generic rare disease profile
  return {
    prevalencePerMillion: 50,
    incidencePerMillion: 10,
    diagnosedPercent: 0.50,
    treatedPercent: 0.60,
    drugEligiblePercent: 0.40,
    annualCostOfTherapy: 100_000,
    sources: ['Estimated — specific epidemiology data not available'],
  };
}

/**
 * Calculate the patient funnel summary string for display.
 */
export function formatPatientFunnel(estimate: MarketSizeEstimate): string {
  const f = estimate.patientFunnel;
  return [
    `${formatNumber(f.prevalentPatients)} prevalent patients`,
    `${formatNumber(f.diagnosedPatients)} diagnosed (${(estimate.patientFunnel.diagnosedPatients / estimate.patientFunnel.prevalentPatients * 100).toFixed(0)}%)`,
    `${formatNumber(f.treatedPatients)} treated`,
    `${formatNumber(f.drugEligiblePatients)} drug-eligible`,
    `${formatNumber(f.addressablePatients)} addressable`,
  ].join(' → ');
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}
