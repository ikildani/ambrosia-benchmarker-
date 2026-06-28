/**
 * Cross-Border Tax Structuring Engine
 *
 * Models the tax impact of IP holding structures on pharma deal economics.
 * Evaluates five jurisdictions (US direct, Ireland, Switzerland, Singapore,
 * Netherlands) and selects the structure that maximizes after-tax NPV while
 * accounting for OECD Pillar Two (BEPS 2.0) global minimum tax, withholding
 * treaties, and transfer pricing scrutiny risk.
 *
 * Key reference rates (2025-2026 vintage):
 *   - Ireland:     12.5% corporate, 6.25% Knowledge Development Box (KDB)
 *   - Switzerland:  11-14% cantonal, patent box regimes
 *   - Singapore:   17% headline, 5-10% IP Development Incentive (IDI)
 *   - Netherlands:  9% Innovation Box on qualifying profits
 *   - US:          21% federal + ~4% blended state, FDII deduction → 13.125%
 *
 * Pillar Two:      15% global minimum effective rate for MNCs with >EUR 750M
 *                  consolidated revenue — limits benefit of sub-15% regimes.
 *
 * Sources:
 *   - OECD BEPS Inclusive Framework, Pillar Two Model Rules (Dec 2021, updated 2024)
 *   - US IRC §250 FDII provisions; IRC §901-909 foreign tax credit rules
 *   - Ireland Finance Act 2022 (KDB extension); Swiss TRAF 2020; Singapore EDB IDI
 *   - PwC Worldwide Tax Summaries 2025; EY Transfer Pricing Global Reference Guide
 *
 * @module lib/financial/cross-border-tax
 */

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface TaxJurisdictionProfile {
  /** Jurisdiction identifier */
  jurisdiction: string;
  /** Headline corporate tax rate */
  headlineRate: number;
  /** Effective rate for qualifying IP income */
  ipBoxRate: number;
  /** Whether a patent/innovation box regime is available */
  hasIPBox: boolean;
  /** Typical % of total income that qualifies for IP box */
  qualifyingIncomePct: number;
  /** Minimum substance requirements (employees, R&D spend) */
  substanceRequirement: 'low' | 'medium' | 'high';
  /** Withholding tax rate on royalty payments to/from US */
  withholdingRateUS: number;
  /** Whether Pillar Two top-up applies (rate < 15%) */
  pillarTwoExposed: boolean;
}

export interface StructureBreakdownEntry {
  jurisdiction: string;
  taxRate: number;
  applicableIncome_pct: number;
  rationale: string;
}

export interface TaxStructureResult {
  /** Blended effective tax rate across the optimal structure */
  effectiveTaxRate: number;
  /** NPV of tax savings vs naive US-only structure ($M) */
  taxSavings_M: number;
  /** Recommended IP holding jurisdiction */
  optimalStructure: 'direct' | 'ireland' | 'switzerland' | 'singapore' | 'netherlands';
  /** Cost of cross-border withholding taxes on royalty flows ($M) */
  witholdingTaxImpact_M: number;
  /** Transfer pricing scrutiny risk from tax authorities */
  transferPricingRisk: 'low' | 'medium' | 'high';
  /** Whether OECD Pillar Two 15% global minimum applies */
  pillarTwoImpact: boolean;
  /** Breakdown of income allocation and rates by jurisdiction */
  structureBreakdown: StructureBreakdownEntry[];
  /** Human-readable narrative summary */
  narrative: string;
}

export type Territory =
  | 'us'
  | 'eu'
  | 'japan'
  | 'china'
  | 'row'
  | 'global';

export type DealType =
  | 'licensing'
  | 'acquisition'
  | 'codevelopment'
  | 'option'
  | 'collaboration';

// ---------------------------------------------------------------------------
// Jurisdiction tax profiles
// ---------------------------------------------------------------------------

const JURISDICTION_PROFILES: Record<string, TaxJurisdictionProfile> = {
  us_direct: {
    jurisdiction: 'United States (direct)',
    headlineRate: 0.25, // 21% federal + ~4% blended state
    ipBoxRate: 0.13125, // FDII deduction on foreign-derived intangible income
    hasIPBox: true,
    qualifyingIncomePct: 0.60, // FDII only applies to export-attributed income
    substanceRequirement: 'low',
    withholdingRateUS: 0,
    pillarTwoExposed: false,
  },
  ireland: {
    jurisdiction: 'Ireland',
    headlineRate: 0.15, // post-Pillar Two alignment (was 12.5%, raised for large MNCs)
    ipBoxRate: 0.10, // KDB 6.25% + Pillar Two top-up to ~10%
    hasIPBox: true,
    qualifyingIncomePct: 0.75,
    substanceRequirement: 'medium',
    withholdingRateUS: 0,
    pillarTwoExposed: true,
  },
  switzerland: {
    jurisdiction: 'Switzerland',
    headlineRate: 0.14, // cantonal average (Zug/Basel)
    ipBoxRate: 0.11, // patent box with TRAF cantonal relief
    hasIPBox: true,
    qualifyingIncomePct: 0.70,
    substanceRequirement: 'high',
    withholdingRateUS: 0,
    pillarTwoExposed: false, // rates already near/above 15% post-TRAF
  },
  singapore: {
    jurisdiction: 'Singapore',
    headlineRate: 0.17,
    ipBoxRate: 0.08, // IP Development Incentive midpoint (5-10%)
    hasIPBox: true,
    qualifyingIncomePct: 0.65,
    substanceRequirement: 'high',
    withholdingRateUS: 0,
    pillarTwoExposed: true,
  },
  netherlands: {
    jurisdiction: 'Netherlands',
    headlineRate: 0.2569, // 25.8% headline (2024+)
    ipBoxRate: 0.09, // Innovation Box
    hasIPBox: true,
    qualifyingIncomePct: 0.80,
    substanceRequirement: 'medium',
    withholdingRateUS: 0,
    pillarTwoExposed: false, // headline rate well above 15%
  },
};

// ---------------------------------------------------------------------------
// Withholding tax treaty rates (royalty payments FROM territory TO IP holder)
// ---------------------------------------------------------------------------

const WITHHOLDING_RATES: Record<Territory, Record<string, number>> = {
  us: {
    us_direct: 0,
    ireland: 0,
    switzerland: 0,
    singapore: 0,
    netherlands: 0,
  },
  eu: {
    us_direct: 0, // EU Interest & Royalties Directive / bilateral treaties
    ireland: 0,
    switzerland: 0,
    singapore: 0.05, // average EU-Singapore treaty
    netherlands: 0,
  },
  japan: {
    us_direct: 0,
    ireland: 0,
    switzerland: 0,
    singapore: 0,
    netherlands: 0,
  },
  china: {
    us_direct: 0.10,
    ireland: 0.10,
    switzerland: 0.10,
    singapore: 0.10,
    netherlands: 0.10,
  },
  row: {
    us_direct: 0.10, // conservative blended rate for rest-of-world
    ireland: 0.08,
    switzerland: 0.08,
    singapore: 0.07,
    netherlands: 0.08,
  },
  global: {
    us_direct: 0.04, // revenue-weighted blend: ~60% US/EU/JP (0%) + 40% CN/ROW
    ireland: 0.03,
    switzerland: 0.03,
    singapore: 0.03,
    netherlands: 0.03,
  },
};

// ---------------------------------------------------------------------------
// Territory revenue share (% of global peak sales)
// ---------------------------------------------------------------------------

const TERRITORY_REVENUE_SHARE: Record<Territory, number> = {
  us: 0.55,
  eu: 0.25,
  japan: 0.08,
  china: 0.07,
  row: 0.05,
  global: 1.0,
};

// ---------------------------------------------------------------------------
// Deal type income characterization
// ---------------------------------------------------------------------------

interface DealIncomeProfile {
  /** Fraction of deal value that is IP-related (eligible for IP box) */
  ipIncomeFraction: number;
  /** Fraction that is service/COGS (taxed at headline rate) */
  serviceIncomeFraction: number;
  /** NPV discount factor for tax savings (years of income stream) */
  incomeStreamYears: number;
  /** Transfer pricing complexity multiplier */
  tpComplexity: number;
}

const DEAL_INCOME_PROFILES: Record<DealType, DealIncomeProfile> = {
  licensing: {
    ipIncomeFraction: 0.85,
    serviceIncomeFraction: 0.15,
    incomeStreamYears: 12,
    tpComplexity: 1.0,
  },
  acquisition: {
    ipIncomeFraction: 0.70,
    serviceIncomeFraction: 0.30,
    incomeStreamYears: 1, // one-time consideration
    tpComplexity: 0.5, // simpler — outright sale
  },
  codevelopment: {
    ipIncomeFraction: 0.60,
    serviceIncomeFraction: 0.40,
    incomeStreamYears: 10,
    tpComplexity: 1.5, // cost-sharing arrangements draw scrutiny
  },
  option: {
    ipIncomeFraction: 0.90,
    serviceIncomeFraction: 0.10,
    incomeStreamYears: 8,
    tpComplexity: 0.8,
  },
  collaboration: {
    ipIncomeFraction: 0.55,
    serviceIncomeFraction: 0.45,
    incomeStreamYears: 10,
    tpComplexity: 1.3,
  },
};

// ---------------------------------------------------------------------------
// Pillar Two threshold heuristic
// ---------------------------------------------------------------------------

/**
 * Determines whether OECD Pillar Two likely applies.
 * Pillar Two targets MNCs with consolidated revenue >= EUR 750M (~$825M).
 * For pharma deals, we proxy this by checking whether the deal implies
 * the licensor is a large multinational (peak sales > $500M is a strong
 * indicator of MNC scale).
 */
function assessPillarTwoApplicability(
  peakSales_M: number,
  dealValue_M: number,
): boolean {
  // Large peak-sales targets are almost certainly licensed to/from MNCs
  if (peakSales_M >= 500) return true;
  // Large deal values also imply MNC counterparties
  if (dealValue_M >= 200) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Transfer pricing risk assessment
// ---------------------------------------------------------------------------

function assessTransferPricingRisk(
  dealValue_M: number,
  structure: string,
  dealType: DealType,
  peakSales_M: number,
): 'low' | 'medium' | 'high' {
  const profile = DEAL_INCOME_PROFILES[dealType];
  let riskScore = 0;

  // Deal size — larger deals attract more scrutiny
  if (dealValue_M > 500) riskScore += 3;
  else if (dealValue_M > 100) riskScore += 2;
  else riskScore += 1;

  // Structure complexity
  if (structure !== 'us_direct') riskScore += 2;

  // Deal type complexity
  riskScore += Math.round(profile.tpComplexity);

  // Peak sales magnitude — high-revenue assets get audited
  if (peakSales_M > 2000) riskScore += 2;
  else if (peakSales_M > 500) riskScore += 1;

  // Substance requirement gaps
  const jurisdictionProfile = JURISDICTION_PROFILES[structure];
  if (jurisdictionProfile?.substanceRequirement === 'high') riskScore -= 1;

  if (riskScore >= 7) return 'high';
  if (riskScore >= 4) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Effective rate computation for a single jurisdiction
// ---------------------------------------------------------------------------

interface JurisdictionTaxComputation {
  effectiveRate: number;
  breakdown: StructureBreakdownEntry[];
  withholdingCost_M: number;
}

function computeJurisdictionTax(
  structureKey: string,
  territory: Territory,
  dealValue_M: number,
  royaltyRate: number,
  dealType: DealType,
  peakSales_M: number,
  pillarTwoApplies: boolean,
): JurisdictionTaxComputation {
  const profile = JURISDICTION_PROFILES[structureKey];
  if (!profile) {
    throw new Error(`Unknown jurisdiction: ${structureKey}`);
  }

  const incomeProfile = DEAL_INCOME_PROFILES[dealType];
  const territoryShare = TERRITORY_REVENUE_SHARE[territory];

  // Total taxable income base: deal value + NPV of royalty stream
  const royaltyNPV = computeRoyaltyNPV(
    peakSales_M * territoryShare,
    royaltyRate,
    incomeProfile.incomeStreamYears,
  );
  const totalIncome_M = dealValue_M + royaltyNPV;

  // IP box qualifying income
  const ipQualifyingPct = incomeProfile.ipIncomeFraction * profile.qualifyingIncomePct;
  const serviceIncomePct = 1 - ipQualifyingPct;

  // Determine applicable IP box rate (apply Pillar Two floor if needed)
  let effectiveIPBoxRate = profile.ipBoxRate;
  if (pillarTwoApplies && profile.pillarTwoExposed) {
    effectiveIPBoxRate = Math.max(effectiveIPBoxRate, 0.15);
  }

  // Blended effective rate
  const blendedRate =
    ipQualifyingPct * effectiveIPBoxRate +
    serviceIncomePct * profile.headlineRate;

  // Withholding tax on royalty payments
  const withholdingRate = WITHHOLDING_RATES[territory]?.[structureKey] ?? 0.05;
  const withholdingCost_M = royaltyNPV * withholdingRate;

  // Build breakdown
  const breakdown: StructureBreakdownEntry[] = [];

  if (ipQualifyingPct > 0) {
    breakdown.push({
      jurisdiction: profile.jurisdiction,
      taxRate: effectiveIPBoxRate,
      applicableIncome_pct: round4(ipQualifyingPct * 100),
      rationale: profile.hasIPBox
        ? `Qualifying IP income under ${getIPBoxName(structureKey)} regime${
            pillarTwoApplies && profile.pillarTwoExposed
              ? ' (topped up to 15% under Pillar Two)'
              : ''
          }`
        : 'Standard corporate rate on IP-related income',
    });
  }

  if (serviceIncomePct > 0) {
    breakdown.push({
      jurisdiction: profile.jurisdiction,
      taxRate: profile.headlineRate,
      applicableIncome_pct: round4(serviceIncomePct * 100),
      rationale: 'Service, manufacturing, and non-qualifying income at headline rate',
    });
  }

  // If structure is not US, include US residual tax on repatriation (GILTI)
  if (structureKey !== 'us_direct') {
    const giltiRate = Math.max(0, 0.105 - blendedRate * 0.80); // 80% deemed tangible return
    if (giltiRate > 0.005) {
      breakdown.push({
        jurisdiction: 'United States (GILTI residual)',
        taxRate: round4(giltiRate),
        applicableIncome_pct: round4(ipQualifyingPct * 100 * 0.5),
        rationale: 'US GILTI inclusion on CFC income net of deemed tangible return',
      });
    }
  }

  return {
    effectiveRate: round4(blendedRate),
    breakdown,
    withholdingCost_M: round2(withholdingCost_M),
  };
}

// ---------------------------------------------------------------------------
// Royalty NPV helper
// ---------------------------------------------------------------------------

/**
 * Simplified NPV of a royalty stream: assumes peak sales ramp over 5 years
 * (S-curve), then plateau for the remaining years, discounted at 10%.
 */
function computeRoyaltyNPV(
  peakSalesTerritory_M: number,
  royaltyRate: number,
  years: number,
): number {
  const discountRate = 0.10;
  let npv = 0;

  for (let y = 1; y <= years; y++) {
    // S-curve ramp: reaches ~90% of peak by year 5
    const rampFactor = y <= 5 ? (1 - Math.exp(-0.5 * y)) : 0.95;
    // Decline after year 10 (loss of exclusivity erosion)
    const erosionFactor = y > 10 ? Math.max(0.3, 1 - 0.15 * (y - 10)) : 1.0;

    const yearRevenue = peakSalesTerritory_M * rampFactor * erosionFactor;
    const royaltyPayment = yearRevenue * royaltyRate;
    npv += royaltyPayment / Math.pow(1 + discountRate, y);
  }

  return npv;
}

// ---------------------------------------------------------------------------
// IP box regime name helper
// ---------------------------------------------------------------------------

function getIPBoxName(structureKey: string): string {
  switch (structureKey) {
    case 'ireland':
      return 'Knowledge Development Box (KDB)';
    case 'switzerland':
      return 'Patent Box (TRAF)';
    case 'singapore':
      return 'IP Development Incentive (IDI)';
    case 'netherlands':
      return 'Innovation Box';
    case 'us_direct':
      return 'FDII deduction';
    default:
      return 'IP box';
  }
}

// ---------------------------------------------------------------------------
// Narrative generation
// ---------------------------------------------------------------------------

function generateNarrative(
  optimalStructure: string,
  territory: Territory,
  effectiveTaxRate: number,
  taxSavings_M: number,
  pillarTwoImpact: boolean,
  transferPricingRisk: string,
  dealValue_M: number,
  dealType: DealType,
  witholdingTaxImpact_M: number,
): string {
  const structureName = JURISDICTION_PROFILES[optimalStructure]?.jurisdiction ?? 'Direct US';
  const savingsDirection = taxSavings_M > 0 ? 'saves' : 'costs';
  const absSavings = Math.abs(taxSavings_M);

  const parts: string[] = [];

  if (optimalStructure === 'us_direct') {
    parts.push(
      `A direct US structure is optimal for this ${dealType} deal. ` +
      `The FDII deduction on foreign-derived income yields an effective rate ` +
      `of ${(effectiveTaxRate * 100).toFixed(1)}%, which is competitive with ` +
      `offshore IP holding structures once substance costs and transfer pricing ` +
      `compliance are factored in.`,
    );
  } else {
    parts.push(
      `Routing IP through ${structureName} ${savingsDirection} an estimated ` +
      `$${absSavings.toFixed(1)}M in NPV-adjusted taxes versus a naive US-only structure. ` +
      `The blended effective rate of ${(effectiveTaxRate * 100).toFixed(1)}% reflects ` +
      `${getIPBoxName(optimalStructure)} treatment on qualifying IP income.`,
    );
  }

  if (pillarTwoImpact) {
    parts.push(
      `Note: OECD Pillar Two (15% global minimum) applies to this deal's counterparties, ` +
      `which limits the benefit of sub-15% IP box rates. Effective rates have been ` +
      `topped up accordingly.`,
    );
  }

  if (witholdingTaxImpact_M > 0.5) {
    parts.push(
      `Cross-border withholding taxes on royalty flows to the ${territory.toUpperCase()} ` +
      `territory add $${witholdingTaxImpact_M.toFixed(1)}M in frictional costs. ` +
      `Treaty networks may partially mitigate this.`,
    );
  }

  if (transferPricingRisk === 'high') {
    parts.push(
      `Transfer pricing risk is HIGH. The deal size ($${dealValue_M.toFixed(0)}M) and ` +
      `structure complexity will likely trigger IRS/OECD scrutiny. Robust documentation ` +
      `of arm's-length pricing and economic substance is essential.`,
    );
  } else if (transferPricingRisk === 'medium') {
    parts.push(
      `Transfer pricing risk is moderate. Standard benchmarking documentation and ` +
      `consistent intercompany pricing policies should suffice.`,
    );
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Rounding helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Computes the tax-optimized structure for a pharma deal, comparing five
 * jurisdictional IP holding strategies and selecting the one that maximizes
 * after-tax NPV.
 *
 * @param territory        Primary revenue territory for the licensed asset
 * @param dealValue_M      Total deal consideration in $M (upfront + milestones)
 * @param royaltyRate      Royalty rate on net sales (e.g. 0.08 for 8%)
 * @param dealType         Deal structure type
 * @param peakSales_M      Estimated peak annual sales in $M
 * @returns                Tax structure analysis with optimal jurisdiction
 */
export function computeTaxStructureImpact(
  territory: Territory,
  dealValue_M: number,
  royaltyRate: number,
  dealType: DealType,
  peakSales_M: number,
): TaxStructureResult {
  // Determine Pillar Two applicability
  const pillarTwoApplies = assessPillarTwoApplicability(peakSales_M, dealValue_M);

  // Evaluate each jurisdiction
  const structureKeys = ['us_direct', 'ireland', 'switzerland', 'singapore', 'netherlands'] as const;

  type StructureKey = typeof structureKeys[number];

  const results = new Map<
    StructureKey,
    JurisdictionTaxComputation
  >();

  for (const key of structureKeys) {
    results.set(
      key,
      computeJurisdictionTax(
        key,
        territory,
        dealValue_M,
        royaltyRate,
        dealType,
        peakSales_M,
        pillarTwoApplies,
      ),
    );
  }

  // Compute total tax cost for each structure (tax on income + withholding)
  const incomeProfile = DEAL_INCOME_PROFILES[dealType];
  const territoryShare = TERRITORY_REVENUE_SHARE[territory];
  const royaltyNPV = computeRoyaltyNPV(
    peakSales_M * territoryShare,
    royaltyRate,
    incomeProfile.incomeStreamYears,
  );
  const totalIncome_M = dealValue_M + royaltyNPV;

  // Add substance/setup costs for offshore structures
  const substanceCosts: Record<string, number> = {
    us_direct: 0,
    ireland: 2.5, // annual costs ~$2.5M for IP holding entity with real employees
    switzerland: 4.0, // higher substance requirements post-TRAF
    singapore: 3.5, // EDB requires significant local R&D spend
    netherlands: 2.0, // moderate substance requirements
  };

  // Select optimal structure by minimizing total tax + substance cost
  let bestKey: StructureKey = 'us_direct';
  let bestTotalCost = Infinity;

  const totalCosts = new Map<StructureKey, number>();

  for (const key of structureKeys) {
    const result = results.get(key)!;
    const taxCost = totalIncome_M * result.effectiveRate;
    const withholding = result.withholdingCost_M;
    const substance = substanceCosts[key] ?? 0;
    // NPV of substance costs over income stream period (simplified)
    const substanceNPV = substance * Math.min(incomeProfile.incomeStreamYears, 10) * 0.65;
    const total = taxCost + withholding + substanceNPV;

    totalCosts.set(key, total);

    if (total < bestTotalCost) {
      bestTotalCost = total;
      bestKey = key;
    }
  }

  const bestResult = results.get(bestKey)!;
  const usDirectResult = results.get('us_direct')!;

  // Tax savings = US direct cost minus optimal structure cost
  const usDirectTotalCost = totalCosts.get('us_direct')!;
  const taxSavings_M = round2(usDirectTotalCost - bestTotalCost);

  // Map internal key to output union type
  const structureMap: Record<StructureKey, TaxStructureResult['optimalStructure']> = {
    us_direct: 'direct',
    ireland: 'ireland',
    switzerland: 'switzerland',
    singapore: 'singapore',
    netherlands: 'netherlands',
  };

  const transferPricingRisk = assessTransferPricingRisk(
    dealValue_M,
    bestKey,
    dealType,
    peakSales_M,
  );

  const narrative = generateNarrative(
    bestKey,
    territory,
    bestResult.effectiveRate,
    taxSavings_M,
    pillarTwoApplies,
    transferPricingRisk,
    dealValue_M,
    dealType,
    bestResult.withholdingCost_M,
  );

  return {
    effectiveTaxRate: bestResult.effectiveRate,
    taxSavings_M,
    optimalStructure: structureMap[bestKey],
    witholdingTaxImpact_M: bestResult.withholdingCost_M,
    transferPricingRisk,
    pillarTwoImpact: pillarTwoApplies,
    structureBreakdown: bestResult.breakdown,
    narrative,
  };
}
