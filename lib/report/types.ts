import type { CalculationResult, CalculationInput } from '@/lib/calculations';
import type { SensitivityData } from '@/lib/sensitivity';
import type { ComparableDealForUI } from '@/lib/comparableDeals';
import type { NegotiationPlaybook } from '@/lib/ai/playbook-generator';
import type { DealMemo } from '@/lib/ai/deal-memo-generator';
import type { RNPVResult, MonteCarloResult, MarketSizeEstimate, ScenarioResult, FXSensitivity, CompetitiveLandscape, DealFlowForecast, DealWaterfall, ScenarioComparisonResult, LifecycleExtensionResult } from '@/lib/financial/types';
import type { MilestoneProbabilityResult } from '@/lib/financial/milestone-probability';
import type { CompetitiveDynamicsResult, RealOptionsResult } from '@/lib/financial/advanced-upgrades';
import type { BuyerSpecificValuation } from '@/lib/financial/buyer-specific-valuation';
import type { RegulatoryRiskResult } from '@/lib/financial/regulatory-risk';
import type { RoyaltyStackingResult } from '@/lib/financial/royalty-stacking';
import type { CMCRiskResult } from '@/lib/financial/cmc-timeline-risk';
import type { PricingConstraintResult } from '@/lib/financial/pricing-access';
import type { BuyerSynergyResult } from '@/lib/financial/buyer-synergy';
import type { TaxStructureResult } from '@/lib/financial/cross-border-tax';
import type { PatentDynamicsResult } from '@/lib/financial/patent-loe-dynamics';
import type { EarnoutResult } from '@/lib/financial/earnout-cvr';
import type { IndicationSequenceResult } from '@/lib/financial/indication-sequencing';

export interface PartnerForPDF {
  company_name: string;
  match_score: number;
  match_reasons: { reason: string; strength: string }[];
  deals_last_12mo: number;
  hq_country: string | null;
  strategic_context?: {
    patent_cliffs: { drug_name: string; indication: string | null; revenue_usd: number; expiry_year: number }[];
    revenue_at_risk: { year: number; amount: number }[];
    pipeline_gaps: string[];
    strategic_priorities: string[];
  } | null;
  pharma_intent?: {
    intentScore: number;
    intentTier: string;
    timing: string;
    confidence: number;
    factors?: Array<{ name: string; score: number; weight: number }>;
    signals?: string[];
    preferredDealType?: string;
  } | null;
}

export interface PDFReportData {
  result: CalculationResult;
  inputs: CalculationInput;
  sensitivityData: SensitivityData;
  riskScore: number;
  partnerMatches?: PartnerForPDF[];
  playbookData?: NegotiationPlaybook;
  memoData?: DealMemo;
  comparableDeals: ComparableDealForUI[];
  historyId?: string;

  // Financial modeling data (pro/report tier)
  rnpvResult?: RNPVResult;
  monteCarloResult?: MonteCarloResult;
  marketSizeEstimate?: MarketSizeEstimate;
  scenarioResults?: ScenarioResult[];
  fxSensitivity?: FXSensitivity;
  competitiveLandscape?: CompetitiveLandscape;
  dealFlowForecast?: DealFlowForecast;
  defensiveAnalysis?: {
    worstCase: ScenarioResult;
    bestCase: ScenarioResult;
    defensiveFloor: number;
    walkAwayThreshold: number;
    narrative: string;
  };

  // Advanced rNPV upgrade data (pro/report tier)
  dealWaterfall?: DealWaterfall;
  scenarioComparison?: ScenarioComparisonResult;
  lifecycleExtensions?: LifecycleExtensionResult;
  competitiveDynamics?: CompetitiveDynamicsResult;
  realOptions?: RealOptionsResult;
  buyerSpecificValuation?: BuyerSpecificValuation;
  buyerSpecificValuations?: BuyerSpecificValuation[];
  milestoneProbabilities?: MilestoneProbabilityResult;
  regulatoryRisk?: RegulatoryRiskResult;
  royaltyStacking?: RoyaltyStackingResult;
  cmcRisk?: CMCRiskResult;
  pricingConstraints?: PricingConstraintResult;
  buyerSynergies?: BuyerSynergyResult[];
  taxStructure?: TaxStructureResult;
  patentDynamics?: PatentDynamicsResult;
  earnoutValuation?: EarnoutResult;
  indicationSequence?: IndicationSequenceResult;
}

export interface TocEntry {
  title: string;
  page: number;
  description: string;
}

export interface ReportMeta {
  reportId: string;
  generatedAt: string;
  version: string;
  pageCount: number;
  currentPage: number;
  tocEntries: TocEntry[];
  brandConfig?: BrandConfig;
}

export interface BrandConfig {
  fundName: string;
  logoUrl?: string;
  logoBase64?: string;
  primaryColor: string;
  secondaryColor: string;
  disclaimerText?: string;
}
