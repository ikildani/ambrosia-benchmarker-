/**
 * MCP Server — Solidus v3.0
 *
 * Exposes 22 institutional-grade tools, 10 read-only resources, and 7 prompt
 * templates over the Model Context Protocol (MCP) using the Streamable HTTP
 * transport. Each tool wraps one of the core calculation engines that power
 * solidus.ambrosiaventures.co.
 *
 * Auth: Enterprise API keys (Growth / Scale / Enterprise tiers).
 * Rate limits: Growth 5K/mo, Scale 15K/mo, Enterprise 100K/mo.
 * Tool access: Growth gets 14 core tools, Scale/Enterprise get all 21.
 *
 * Transport: JSON-RPC over HTTP (POST). GET returns server capabilities.
 *
 * @module app/api/mcp/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { DEAL_STATS } from '@/lib/config/constants';

import { validateApiKey, type ApiKeyContext } from '@/lib/api-v1-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { currentPeriodMonth } from '@/lib/enterprise-api';
import { resolveApiTierToMcpTier, assertToolAccess, type McpTier } from '@/lib/mcp-tiers';

// ── Engine imports ──────────────────────────────────────────────────────
import { calculateDealTerms } from '@/lib/calculations';
import type {
  TherapeuticArea,
  Phase,
  Modality,
  Indication,
  Territory,
  CompetitivePosition,
  DealType,
  DataQuality,
  BiomarkerStatus,
  CalculationInput,
} from '@/lib/calculations';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import { runMonteCarlo } from '@/lib/financial/monte-carlo';
import { optimizeDealStructure } from '@/lib/financial/deal-structure-optimizer';
import { computeGlobalRegulatoryRisk } from '@/lib/financial/global-regulatory-risk';
import { findComparableDeals } from '@/lib/comparableDeals';
import { fetchUpcomingReadouts } from '@/lib/market-intelligence/ct-gov-events';
import { getAdCommCalendar } from '@/lib/market-intelligence/fda-adcomm';
import { findPartnerMatches } from '@/lib/services/partner-matching';
import type { RNPVInput } from '@/lib/financial/types';

// ── New engine imports (Tools 9–21) ────────────────────────────────────
import { getDefensiveAnalysis } from '@/lib/financial/scenario-planner';
import { generateScenarioComparison, calculateLifecycleExtensions } from '@/lib/financial/institutional-upgrades';
import { calculateCompetitiveDynamics, calculateRealOptions } from '@/lib/financial/advanced-upgrades';
import { estimateStackingByModality, computeRoyaltyStacking } from '@/lib/financial/royalty-stacking';
import type { BackgroundIP, AntiStackingProvision, IPType } from '@/lib/financial/royalty-stacking';
import { computePatentDynamics } from '@/lib/financial/patent-loe-dynamics';
import { computeCMCRisk } from '@/lib/financial/cmc-timeline-risk';
import { computeEarnoutValue, DEFAULT_EARNOUT_STRUCTURE } from '@/lib/financial/earnout-cvr';
import type { EarnoutTrancheInput } from '@/lib/financial/earnout-cvr';
import { computeTaxStructureImpact } from '@/lib/financial/cross-border-tax';
import type { Territory as TaxTerritory, DealType as TaxDealType } from '@/lib/financial/cross-border-tax';
import { computeIndicationSequence } from '@/lib/financial/indication-sequencing';
import { computeBuyerSynergy, BUYER_PROFILES } from '@/lib/financial/buyer-synergy';
import type { AssetSynergyProfile, ModalityKey, GeographyKey, TherapeuticAreaKey } from '@/lib/financial/buyer-synergy';

export const maxDuration = 60;

// ═════════════════════════════════════════════════════════════════════════
// MCP Resource Data (read-only reference data for AI agents)
// ═════════════════════════════════════════════════════════════════════════

const TA_RESOURCE = [
  { key: 'oncology', label: 'Oncology', dealCount: '500+', topModalities: ['ADC', 'mAb', 'bispecific', 'small molecule'] },
  { key: 'neurology', label: 'Neurology', dealCount: '150+', topModalities: ['small molecule', 'mAb', 'gene therapy', 'ASO'] },
  { key: 'immunology', label: 'Immunology', dealCount: '113+', topModalities: ['mAb', 'bispecific', 'small molecule'] },
  { key: 'metabolic', label: 'Metabolic', dealCount: '79+', topModalities: ['GLP-1 agonist', 'small molecule', 'peptide'] },
  { key: 'cardiovascular', label: 'Cardiovascular', dealCount: '33+', topModalities: ['small molecule', 'RNAi', 'mAb'] },
  { key: 'infectiousDisease', label: 'Infectious Disease', dealCount: '40+', topModalities: ['antiviral', 'vaccine', 'mAb'] },
  { key: 'rareDisease', label: 'Rare Disease', dealCount: '50+', topModalities: ['gene therapy', 'enzyme replacement', 'ASO'] },
  { key: 'hematology', label: 'Hematology', dealCount: '43+', topModalities: ['CAR-T', 'bispecific', 'mAb'] },
  { key: 'ophthalmology', label: 'Ophthalmology', dealCount: '32+', topModalities: ['anti-VEGF', 'gene therapy', 'small molecule'] },
  { key: 'dermatology', label: 'Dermatology', dealCount: '40+', topModalities: ['mAb', 'JAK inhibitor', 'small molecule'] },
  { key: 'gastroenterology', label: 'Gastroenterology', dealCount: '39+', topModalities: ['mAb', 'small molecule', 'anti-TL1A'] },
  { key: 'womensHealth', label: "Women's Health", dealCount: '35+', topModalities: ['small molecule', 'hormone therapy', 'GnRH antagonist'] },
] as const;

const MODALITY_RESOURCE = [
  { ta: 'oncology', modalities: [
    { key: 'adc', label: 'Antibody-Drug Conjugate (ADC)', multiplier: 1.35 },
    { key: 'mab', label: 'Monoclonal Antibody', multiplier: 1.10 },
    { key: 'bispecific', label: 'Bispecific Antibody', multiplier: 1.25 },
    { key: 'smallMolecule', label: 'Small Molecule', multiplier: 1.00 },
    { key: 'carT_heme', label: 'CAR-T (Hematologic)', multiplier: 1.40 },
    { key: 'carT_solid', label: 'CAR-T (Solid Tumor)', multiplier: 1.50 },
    { key: 'radiopharmaceutical', label: 'Radiopharmaceutical', multiplier: 1.30 },
    { key: 'protac', label: 'PROTAC', multiplier: 1.20 },
  ]},
  { ta: 'neurology', modalities: [
    { key: 'smallMolecule', label: 'Small Molecule', multiplier: 1.00 },
    { key: 'mab', label: 'Monoclonal Antibody', multiplier: 1.15 },
    { key: 'geneTherapy', label: 'Gene Therapy', multiplier: 1.50 },
    { key: 'aso', label: 'Antisense Oligonucleotide', multiplier: 1.30 },
    { key: 'bbbPlatform', label: 'BBB-Crossing Platform', multiplier: 1.45 },
  ]},
  { ta: 'immunology', modalities: [
    { key: 'mab', label: 'Monoclonal Antibody', multiplier: 1.10 },
    { key: 'bispecific', label: 'Bispecific Antibody', multiplier: 1.25 },
    { key: 'carT_autoimmune', label: 'CAR-T (Autoimmune)', multiplier: 1.55 },
    { key: 'jakInhibitor', label: 'JAK Inhibitor', multiplier: 1.05 },
  ]},
  { ta: 'metabolic', modalities: [
    { key: 'glp1Agonist', label: 'GLP-1 Agonist', multiplier: 1.30 },
    { key: 'dualIncretin', label: 'Dual Incretin', multiplier: 1.45 },
    { key: 'tripleIncretin', label: 'Triple Incretin', multiplier: 1.55 },
    { key: 'smallMolecule', label: 'Small Molecule', multiplier: 1.00 },
  ]},
  { ta: 'rareDisease', modalities: [
    { key: 'geneTherapy', label: 'Gene Therapy', multiplier: 1.50 },
    { key: 'enzymeReplacement', label: 'Enzyme Replacement', multiplier: 1.20 },
    { key: 'aso', label: 'Antisense Oligonucleotide', multiplier: 1.30 },
    { key: 'substrateReduction', label: 'Substrate Reduction', multiplier: 1.15 },
  ]},
] as const;

const TERRITORY_RESOURCE = [
  { key: 'global', label: 'Global', revenueWeight: 1.0, agencies: ['FDA', 'EMA', 'PMDA', 'NMPA', 'TGA', 'Health Canada', 'Swissmedic'] },
  { key: 'us_only', label: 'US Only', revenueWeight: 0.55, agencies: ['FDA'] },
  { key: 'europe', label: 'Europe', revenueWeight: 0.25, agencies: ['EMA', 'Swissmedic'] },
  { key: 'us_eu', label: 'US + EU', revenueWeight: 0.80, agencies: ['FDA', 'EMA'] },
  { key: 'japan', label: 'Japan', revenueWeight: 0.08, agencies: ['PMDA'] },
  { key: 'china', label: 'China', revenueWeight: 0.07, agencies: ['NMPA'] },
  { key: 'us_japan', label: 'US + Japan', revenueWeight: 0.63, agencies: ['FDA', 'PMDA'] },
  { key: 'ex_us', label: 'Ex-US', revenueWeight: 0.45, agencies: ['EMA', 'PMDA', 'NMPA', 'TGA', 'Health Canada', 'Swissmedic'] },
  { key: 'canada', label: 'Canada', revenueWeight: 0.03, agencies: ['Health Canada'] },
  { key: 'australia', label: 'Australia', revenueWeight: 0.02, agencies: ['TGA'] },
  { key: 'row', label: 'Rest of World', revenueWeight: 0.05, agencies: ['TGA', 'Health Canada'] },
  { key: 'apac_ex_cj', label: 'APAC (ex-China/Japan)', revenueWeight: 0.02, agencies: ['TGA'] },
  { key: 'latam', label: 'Latin America', revenueWeight: 0.03, agencies: ['FDA (reference)'] },
  { key: 'mena', label: 'Middle East & North Africa', revenueWeight: 0.02, agencies: ['FDA (reference)'] },
  { key: 'south_korea', label: 'South Korea', revenueWeight: 0.02, agencies: ['FDA', 'EMA (reference)'] },
] as const;

const BUYER_PREMIUMS_RESOURCE = [
  { company: 'Novo Nordisk', premium: 1.407, confidence: 'high' as const, topTAs: ['metabolic', 'rareDisease'] },
  { company: 'Biogen', premium: 1.331, confidence: 'high' as const, topTAs: ['neurology', 'rareDisease'] },
  { company: 'GSK', premium: 1.320, confidence: 'high' as const, topTAs: ['infectiousDisease', 'immunology'] },
  { company: 'AstraZeneca', premium: 1.312, confidence: 'high' as const, topTAs: ['oncology', 'immunology'] },
  { company: 'Novartis', premium: 1.289, confidence: 'high' as const, topTAs: ['oncology', 'cardiovascular'] },
  { company: 'Amgen', premium: 1.234, confidence: 'high' as const, topTAs: ['oncology', 'immunology'] },
  { company: 'AbbVie', premium: 1.360, confidence: 'high' as const, topTAs: ['oncology', 'immunology'] },
  { company: 'Roche', premium: 1.360, confidence: 'high' as const, topTAs: ['oncology', 'neurology'] },
  { company: 'Gilead Sciences', premium: 1.127, confidence: 'high' as const, topTAs: ['oncology', 'immunology'] },
  { company: 'Eli Lilly', premium: 1.061, confidence: 'high' as const, topTAs: ['metabolic', 'neurology'] },
  { company: 'Pfizer', premium: 1.060, confidence: 'high' as const, topTAs: ['oncology', 'immunology'] },
  { company: 'Sanofi', premium: 1.015, confidence: 'high' as const, topTAs: ['immunology', 'rareDisease'] },
  { company: 'Merck', premium: 0.893, confidence: 'high' as const, topTAs: ['oncology', 'immunology'] },
  { company: 'Bristol-Myers Squibb', premium: 1.046, confidence: 'high' as const, topTAs: ['oncology', 'hematology'] },
  { company: 'Johnson & Johnson', premium: 1.086, confidence: 'high' as const, topTAs: ['oncology', 'immunology'] },
] as const;

const DIFFERENTIATION_RESOURCE = [
  { key: 'novelMechanism', label: 'Novel mechanism of action', baseAdjustment: 0.08, preclinicalScaling: 0.6 },
  { key: 'superiorEfficacy', label: 'Demonstrated superior efficacy', baseAdjustment: 0.07, preclinicalScaling: 0.3 },
  { key: 'convenientDosing', label: 'Dosing/delivery advantage', baseAdjustment: 0.05, preclinicalScaling: 0.5 },
  { key: 'betterSafety', label: 'Differentiated safety profile', baseAdjustment: 0.04, preclinicalScaling: 0.3 },
  { key: 'biomarkerSelected', label: 'Biomarker-selected population', baseAdjustment: 0.05, preclinicalScaling: 0.5 },
  { key: 'combinationBackbone', label: 'Combination backbone potential', baseAdjustment: 0.06, preclinicalScaling: 0.4 },
] as const;

const DEAL_TYPES_RESOURCE = [
  { key: 'licensing', label: 'Licensing / License Agreement', typicalUpfrontRatio: 0.20, description: 'Licensor grants rights to licensee in exchange for upfront payment, milestones, and royalties. Most common deal structure. Best for: assets with clear value where licensor wants to retain upside via royalties.', whenToUse: 'Default choice for most partnering deals. Licensor retains ownership and collects royalties on sales.' },
  { key: 'acquisition', label: 'Full Acquisition', typicalUpfrontRatio: 0.70, description: 'Outright purchase of asset or company. Highest upfront but no ongoing royalties. Best for: late-stage or approved assets, small companies with single key asset.', whenToUse: 'When buyer wants full control and licensor prefers certainty over long-term royalty income.' },
  { key: 'codevelopment', label: 'Co-Development', typicalUpfrontRatio: 0.15, description: 'Shared development costs and profits. Lower upfront but shared risk/reward. Best for: early-stage assets where both parties contribute capabilities.', whenToUse: 'When licensor has capabilities to contribute (manufacturing, clinical expertise) and wants to share risk.' },
  { key: 'option', label: 'Option Agreement', typicalUpfrontRatio: 0.10, description: 'Buyer pays option fee for right (not obligation) to license/acquire after data readout. Staged commitment. Best for: early-stage assets with upcoming catalysts.', whenToUse: 'When buyer wants to wait for data before committing. Lower upfront but higher total if option is exercised.' },
  { key: 'collaboration', label: 'Research Collaboration', typicalUpfrontRatio: 0.12, description: 'Joint research with FTE funding, equity investment, and milestone-triggered opt-ins. Best for: platform technologies, discovery-stage programs.', whenToUse: 'When the value is in the platform/technology rather than a single asset, or when discovery-stage risk is too high for licensing.' },
] as const;

const COMPETITIVE_POSITIONS_RESOURCE = [
  { key: 'firstInClass', multiplier: 1.25, description: 'First-in-class mechanism of action. No approved competitors with same MOA. Highest premium — ~25% above baseline — reflecting novel target validation and pricing power.' },
  { key: 'firstToPivotal', multiplier: 1.15, description: 'First to enter pivotal (Phase 3) trials. Competitors exist but are earlier in development. ~15% premium for time-to-market advantage.' },
  { key: 'bestInClass', multiplier: 1.10, description: 'Differentiated efficacy or safety vs. existing therapies. Not first, but demonstrably better. ~10% premium for clinical superiority.' },
  { key: 'racing', multiplier: 1.00, description: 'Multiple competitors at similar development stage. No clear advantage. Baseline valuation — deal terms driven by asset fundamentals rather than competitive positioning.' },
  { key: 'behind', multiplier: 0.90, description: 'Competitors are ahead in development. Asset must differentiate on other dimensions (safety, dosing, subpopulation) to justify deal. ~10% discount.' },
  { key: 'crowded', multiplier: 0.80, description: 'Highly competitive space with multiple approved therapies and late-stage pipeline. Significant pricing pressure expected. ~20% discount to deal terms.' },
] as const;

const REGULATORY_AGENCIES_RESOURCE = [
  { key: 'FDA', fullName: 'U.S. Food and Drug Administration', territory: 'US', standardReviewMonths: 12, priorityReviewMonths: 6, averageRejectionRate: 0.12, keyDesignations: ['Breakthrough Therapy', 'Fast Track', 'Priority Review', 'Accelerated Approval', 'Orphan Drug', 'Rare Pediatric Disease'], notes: 'Gold standard. Most deals anchor to FDA timeline. Priority Review Vouchers worth ~$100M.' },
  { key: 'EMA', fullName: 'European Medicines Agency', territory: 'Europe', standardReviewMonths: 15, priorityReviewMonths: 9, averageRejectionRate: 0.14, keyDesignations: ['PRIME', 'Orphan Medicinal Product', 'Conditional Marketing Authorization', 'Accelerated Assessment'], notes: 'Centralized procedure covers all EU member states. CHMP opinion is binding.' },
  { key: 'PMDA', fullName: 'Pharmaceuticals and Medical Devices Agency', territory: 'Japan', standardReviewMonths: 12, priorityReviewMonths: 6, averageRejectionRate: 0.10, keyDesignations: ['SAKIGAKE', 'Orphan Drug', 'Conditional/Time-Limited Approval'], notes: 'Japan frequently accepts bridging studies from US/EU. SAKIGAKE offers 6-month priority review.' },
  { key: 'NMPA', fullName: 'National Medical Products Administration', territory: 'China', standardReviewMonths: 14, priorityReviewMonths: 8, averageRejectionRate: 0.18, keyDesignations: ['Breakthrough Therapy', 'Priority Review', 'Conditional Approval'], notes: 'Significant regulatory reform since 2017. Now accepts global multi-regional clinical trial data.' },
  { key: 'TGA', fullName: 'Therapeutic Goods Administration', territory: 'Australia', standardReviewMonths: 11, priorityReviewMonths: 5, averageRejectionRate: 0.08, keyDesignations: ['Priority Review', 'Provisional Approval'], notes: 'Often used for early clinical development (CTN/CTX pathway). Generally follows FDA/EMA decisions.' },
  { key: 'Health Canada', fullName: 'Health Canada / Health Products and Food Branch', territory: 'Canada', standardReviewMonths: 12, priorityReviewMonths: 6, averageRejectionRate: 0.09, keyDesignations: ['Priority Review', 'Notice of Compliance with Conditions'], notes: 'Part of Project Orbis for concurrent oncology reviews with FDA and TGA.' },
  { key: 'Swissmedic', fullName: 'Swiss Agency for Therapeutic Products', territory: 'Switzerland', standardReviewMonths: 11, priorityReviewMonths: 5, averageRejectionRate: 0.07, keyDesignations: ['Fast Track Authorization', 'Temporary Authorization'], notes: 'Independent from EMA. Often among first to approve novel therapies. Key for Swiss pharma HQ decisions.' },
] as const;

const PHASES_RESOURCE = [
  { key: 'discovery', label: 'Discovery', posRange: '0.02 - 0.04', typicalDealValue_M: '50 - 200', description: 'Target identification and validation. Hit-to-lead optimization. Highest risk, lowest deal values.' },
  { key: 'preclinical', label: 'Preclinical', posRange: '0.04 - 0.08', typicalDealValue_M: '100 - 400', description: 'IND-enabling studies: toxicology, pharmacology, formulation, CMC. GLP-compliant safety studies required for IND filing.' },
  { key: 'phase1', label: 'Phase 1', posRange: '0.08 - 0.15', typicalDealValue_M: '150 - 600', description: 'First-in-human safety, tolerability, PK/PD. Dose escalation in healthy volunteers or patients. Typically 20-100 subjects.' },
  { key: 'phase1_2', label: 'Phase 1/2', posRange: '0.10 - 0.18', typicalDealValue_M: '200 - 800', description: 'Combined safety and preliminary efficacy. Common in oncology and rare disease. Initial dose-finding with expansion cohorts.' },
  { key: 'phase2', label: 'Phase 2', posRange: '0.15 - 0.30', typicalDealValue_M: '300 - 1,200', description: 'Proof-of-concept efficacy and dose-ranging. 100-300 patients. Key inflection point for deal activity — "sweet spot" for out-licensing.' },
  { key: 'phase2_3', label: 'Phase 2/3', posRange: '0.25 - 0.40', typicalDealValue_M: '500 - 2,000', description: 'Adaptive trial design that can transition from dose-finding to registration-quality. Regulatory engagement on primary endpoints.' },
  { key: 'phase3', label: 'Phase 3', posRange: '0.40 - 0.65', typicalDealValue_M: '800 - 4,000', description: 'Pivotal registration trials. 300-3,000+ patients. Most expensive phase. Highest deal values pre-approval. FDA/EMA alignment critical.' },
  { key: 'nda_filed', label: 'NDA/BLA Filed', posRange: '0.80 - 0.90', typicalDealValue_M: '1,500 - 6,000', description: 'Regulatory submission filed with FDA/EMA. Under review. AdComm risk for novel mechanisms. CRL probability 10-20%.' },
  { key: 'approved', label: 'Approved', posRange: '0.95 - 1.00', typicalDealValue_M: '2,000 - 10,000+', description: 'Marketed product. Deals focus on commercialization rights, geographic expansion, or full acquisition. Premium valuations.' },
] as const;

// ═════════════════════════════════════════════════════════════════════════
// Shared Zod Schemas
// ═════════════════════════════════════════════════════════════════════════

const therapeuticAreaEnum = z.enum([
  'oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular',
  'infectiousDisease', 'ophthalmology', 'womensHealth', 'rareDisease',
  'hematology', 'dermatology', 'gastroenterology',
]);

const phaseEnum = z.enum([
  'discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2',
  'phase2_3', 'phase3', 'nda_filed', 'approved',
]);

const modalityEnum = z.enum([
  'smallMolecule', 'mab', 'adc', 'bispecific', 'tCellEngager',
  'carT_heme', 'carT_solid', 'cellTherapy', 'geneTherapy',
  'radiopharmaceutical', 'mrna', 'rnai', 'protac',
  'molecularGlue', 'peptide', 'therapeuticVaccine', 'oncolyticVirus',
  'bbbPlatform', 'aso', 'psychedelic', 'ionChannel', 'tauTargeting',
  'stemCell', 'oligonucleotide',
  'carT_autoimmune', 'inVivoCarT', 'carTreg',
  'fcrnAntagonist', 'complementInhibitor', 'jakInhibitor',
  's1pModulator', 'oralIntegrin', 'dualAntagonist', 'tl1aInhibitor',
  'glp1Agonist', 'dualIncretin', 'tripleIncretin',
  'sglt2Inhibitor', 'amylinAnalog', 'oralPeptide',
  'antiActivin', 'microbiomeBased',
  'myosinInhibitor', 'anticoagulantNovel', 'rnaCardio', 'pcsk9Targeting',
  'antiviral', 'antibioticNovel', 'vaccinePreventive', 'phageTherapy',
  'antiVegf', 'geneTherapyOcular', 'intravitreal', 'topicalOphthalmic',
  'gnrhAntagonist', 'hormoneTherapy', 'neuroactiveSteroid',
  'enzymeReplacement', 'substrateReduction', 'geneTherapyRare',
  'bispecificHeme', 'btki',
  'il17Inhibitor', 'il13Inhibitor', 'jakInhibitorDerm', 'topicalBiologic',
  'antiTl1a', 'il23GI', 'gutSelectiveIntegrin',
]);

const territoryEnum = z.enum([
  'global', 'us_only', 'ex_us', 'europe', 'china', 'japan', 'row',
  'us_eu', 'us_japan', 'canada', 'australia', 'south_korea',
  'apac_ex_cj', 'latam', 'mena',
]);

const competitivePositionEnum = z.enum([
  'firstInClass', 'firstToPivotal', 'bestInClass', 'racing', 'behind', 'crowded',
]);

const dealTypeEnum = z.enum([
  'licensing', 'acquisition', 'codevelopment', 'option', 'collaboration',
]);

const dataQualityEnum = z.enum([
  'pivotalReady', 'strongPhase2', 'promising', 'mixed', 'limited',
]);

const biomarkerStatusEnum = z.enum(['selected', 'unselected']);

const regulatoryDesignationsSchema = z.object({
  breakthrough: z.boolean().default(false),
  fastTrack: z.boolean().default(false),
  orphan: z.boolean().default(false),
  prime: z.boolean().default(false),
}).default({ breakthrough: false, fastTrack: false, orphan: false, prime: false });

// ═════════════════════════════════════════════════════════════════════════
// Auth + Usage Tracking
// ═════════════════════════════════════════════════════════════════════════

async function authenticateRequest(
  request: NextRequest,
): Promise<{ context: ApiKeyContext; mcpTier: McpTier } | { error: string; status: number }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ambk_')) {
    return { error: 'API key required. Use Authorization: Bearer ambk_<your_key>', status: 401 };
  }

  const context = await validateApiKey(request);
  if (!context) {
    return { error: 'Invalid, expired, or rate-limited API key', status: 401 };
  }

  // Map API key tier to MCP tier (growth, scale, enterprise, or legacy portfolio)
  const mcpTier = resolveApiTierToMcpTier(context.tier);
  if (!mcpTier) {
    return {
      error: `MCP access requires a Growth ($30K/yr), Scale ($60K/yr), or Enterprise tier. Your current tier "${context.tier}" does not include MCP access. Contact ikildani@ambrosiaventures.co to upgrade.`,
      status: 403,
    };
  }

  return { context, mcpTier };
}

async function trackToolUsage(keyId: string, toolName: string): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('enterprise_api_usage').insert({
      api_key_id: keyId,
      period: currentPeriodMonth(),
      endpoint: `/api/mcp#${toolName}`,
    });
  } catch {
    // Usage tracking failure should not block the tool call
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Response Metadata — appended to every tool response
// ═════════════════════════════════════════════════════════════════════════

function getResponseMeta(): object {
  return {
    data_as_of: new Date().toISOString().split('T')[0],
    deal_count: DEAL_STATS.TOTAL_DEALS,
    engine_version: '2.0.0',
    source: 'Ambrosia Ventures Proprietary Database',
    verification: 'Primary-source-verified from SEC EDGAR, FTC filings, and direct research',
  };
}

// ═════════════════════════════════════════════════════════════════════════
// MCP Server Factory
// ═════════════════════════════════════════════════════════════════════════

/**
 * Build a fresh McpServer instance with all 22 tools registered.
 *
 * The API key context is threaded through so each tool can track usage
 * against the caller's quota. A new server is created per request
 * because the StreamableHTTPServerTransport is stateless (no session).
 */
function createMcpServerInstance(apiKeyContext: ApiKeyContext, mcpTier: McpTier): McpServer {
  const server = new McpServer({
    name: 'Solidus',
    version: '2.0.0',
    description: `Institutional-grade biopharma deal intelligence — 21 engines, ${DEAL_STATS.TOTAL_DEALS} transactions, 850+ companies`,
  });

  // ─────────────────────────────────────────────────────────────────────
  // Tool 1: calculate_deal_terms
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'calculate_deal_terms',
    `Calculate pharmaceutical deal terms (upfront payment, milestones, royalties) for a drug asset based on therapeutic area, development phase, modality, indication, and competitive position. Returns institutional-grade deal structure recommendations calibrated against ${DEAL_STATS.TOTAL_DEALS} real transactions.`,
    {
      therapeuticArea: therapeuticAreaEnum,
      phase: phaseEnum,
      modality: modalityEnum,
      indication: z.string().describe('Specific indication key (e.g., "lung_nsclc", "alzheimers", "rheumatoidArthritis"). See the full indication list per therapeutic area.'),
      territory: territoryEnum,
      competitivePosition: competitivePositionEnum,
      dealType: dealTypeEnum.optional().describe('Deal structure type. Defaults to licensing.'),
      peakSalesMedian: z.number().positive().optional().describe('Peak annual sales estimate in $M. If omitted, the engine uses indication-based defaults.'),
      differentiationFactors: z.array(z.string()).optional().describe('Asset differentiation factors: "novelMechanism", "superiorEfficacy", "betterSafety", "convenientDosing", "biomarkerSelected", "combinationBackbone"'),
      dataQuality: z.enum(['robust', 'moderate', 'promising', 'preliminary', 'preclinical_only']).optional().describe('Quality of available clinical/preclinical data. Defaults to "promising".'),
      biomarkerStatus: z.enum(['validated', 'exploratory', 'unselected', 'none']).optional().describe('Biomarker selection status. Defaults to "unselected".'),
      lineOfTherapy: z.enum(['1L', '2L', '3L', 'adjuvant', 'neoadjuvant', 'maintenance']).optional().describe('Line of therapy. Defaults to "1L".'),
      regulatoryDesignations: regulatoryDesignationsSchema.optional().describe('Regulatory designations held by the asset.'),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'calculate_deal_terms');

      // Map MCP-facing data quality values to engine-expected values
      const dataQualityMap: Record<string, DataQuality> = {
        robust: 'pivotalReady',
        moderate: 'strongPhase2',
        promising: 'promising',
        preliminary: 'mixed',
        preclinical_only: 'limited',
      };
      const mappedDataQuality = params.dataQuality
        ? (dataQualityMap[params.dataQuality] ?? 'promising')
        : 'promising';

      // Map MCP-facing biomarker values to engine-expected values
      const biomarkerMap: Record<string, BiomarkerStatus> = {
        validated: 'selected',
        exploratory: 'selected',
        unselected: 'unselected',
        none: 'unselected',
      };
      const mappedBiomarker = params.biomarkerStatus
        ? (biomarkerMap[params.biomarkerStatus] ?? 'unselected')
        : 'unselected';

      const input: CalculationInput = {
        therapeuticArea: params.therapeuticArea as TherapeuticArea,
        phase: params.phase as Phase,
        modality: params.modality as Modality,
        indication: params.indication as Indication,
        territory: params.territory as Territory,
        competitivePosition: params.competitivePosition as CompetitivePosition,
        dealType: (params.dealType as DealType) || undefined,
        biomarker: mappedBiomarker,
        lineOfTherapy: (params.lineOfTherapy ?? '1L') as CalculationInput['lineOfTherapy'],
        treatmentApproach: 'diseaseModifying',
        combinationPotential: 'some',
        dataQuality: mappedDataQuality,
        regulatoryDesignations: params.regulatoryDesignations ?? { breakthrough: false, fastTrack: false, orphan: false, prime: false },
        differentiationFactors: params.differentiationFactors,
        peakSalesOverrideM: params.peakSalesMedian ?? null,
      };

      try {
        const result = calculateDealTerms(input);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              dealTerms: result.terms,
              tieredRoyalties: result.tieredRoyalties,
              dealRecommendation: result.dealRecommendation,
              negotiationInsight: result.negotiationInsight,
              modifiers: result.modifiers,
              labels: result.labels,
              phase: result.phase,
              warnings: result.warnings,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error calculating deal terms: ${err instanceof Error ? err.message : 'Calculation failed'}. Check that your indication is valid for the specified therapeutic area. Use the therapeutic-areas resource for valid TA keys and modalities.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 2: run_rnpv_model
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'run_rnpv_model',
    'Run the risk-adjusted Net Present Value (rNPV) financial model with Monte Carlo simulation (10,000 iterations) for a pharmaceutical asset. Returns probability-weighted NPV, P10/P50/P90 confidence intervals, cash flow projections, and key driver sensitivity analysis. The gold standard for pharma asset valuation.',
    {
      therapeuticArea: therapeuticAreaEnum,
      phase: phaseEnum,
      modality: modalityEnum,
      indication: z.string().describe('Specific indication key (e.g., "lung_nsclc", "breast_her2", "alzheimers")'),
      territory: territoryEnum,
      competitivePosition: competitivePositionEnum,
      peakSalesMedian: z.number().positive().describe('Peak annual sales estimate in $M (e.g., 1500 for a $1.5B peak sales asset)'),
      peakSalesLow: z.number().positive().optional().describe('Bear-case peak sales in $M. Defaults to 50% of median.'),
      peakSalesHigh: z.number().positive().optional().describe('Bull-case peak sales in $M. Defaults to 200% of median.'),
      dataQuality: dataQualityEnum.optional().describe('Quality of available clinical data. Defaults to "promising".'),
      biomarkerStatus: biomarkerStatusEnum.optional().describe('Whether patients are biomarker-selected. Defaults to "unselected".'),
      regulatoryDesignations: regulatoryDesignationsSchema.optional(),
      dealType: dealTypeEnum.optional().describe('Deal structure. Defaults to licensing.'),
      companyType: z.enum(['largePharma', 'midPharma', 'biotech', 'clinicalStageBiotech', 'academic']).optional().describe('Asset owner company type. Affects discount rate.'),
      lineOfTherapy: z.enum(['1L', '2L', '3L', 'adjuvant', 'neoadjuvant', 'maintenance']).optional().describe('Line of therapy. Affects market size and competitive dynamics. Defaults to "1L".'),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'run_rnpv_model');

      const peakSalesMedian = params.peakSalesMedian;
      const rnpvInput: RNPVInput = {
        therapeuticArea: params.therapeuticArea as TherapeuticArea,
        phase: params.phase as Phase,
        modality: params.modality as Modality,
        indication: params.indication,
        territory: params.territory,
        competitivePosition: params.competitivePosition,
        peakSalesEstimate: {
          low: params.peakSalesLow ?? peakSalesMedian * 0.5,
          median: peakSalesMedian,
          high: params.peakSalesHigh ?? peakSalesMedian * 2,
        },
        dataQuality: params.dataQuality ?? 'promising',
        biomarkerStatus: params.biomarkerStatus ?? 'unselected',
        regulatoryDesignations: params.regulatoryDesignations ?? {
          breakthrough: false, fastTrack: false, orphan: false, prime: false,
        },
        dealType: params.dealType ?? 'licensing',
        companyType: params.companyType ?? 'biotech',
        lineOfTherapy: params.lineOfTherapy,
      };

      try {
        const rnpvResult = calculateRNPV(rnpvInput);
        const mcResult = runMonteCarlo({ rnpvInput, iterations: 10_000 });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              rnpv: {
                riskAdjustedNPV_M: rnpvResult.riskAdjustedNPV,
                cumulativePoS: rnpvResult.cumulativePoS,
                impliedDealValue: rnpvResult.impliedDealValue,
                cashFlowSummary: {
                  totalRevenue_M: rnpvResult.cashFlows?.reduce((s, cf) => s + cf.revenue, 0) ?? 0,
                  peakRevenueYear: rnpvResult.cashFlows?.reduce((max, cf) =>
                    cf.revenue > max.revenue ? cf : max, { revenue: 0, year: 0 } as { revenue: number; year: number })?.year ?? 0,
                  yearsToBreakeven: (() => {
                    let cum = 0;
                    return rnpvResult.cashFlows?.findIndex((cf) => { cum += cf.netCashFlow; return cum > 0; }) ?? -1;
                  })(),
                },
                riskDecomposition: rnpvResult.riskDecomposition,
              },
              monteCarlo: {
                mean_M: mcResult.mean,
                p10_M: mcResult.percentiles.p10,
                p25_M: mcResult.percentiles.p25,
                p50_M: mcResult.percentiles.p50,
                p75_M: mcResult.percentiles.p75,
                p90_M: mcResult.percentiles.p90,
                stdDev_M: mcResult.stdDev,
                confidenceInterval95: mcResult.confidenceInterval95,
                confidenceInterval80: mcResult.confidenceInterval80,
                probabilityOfPositiveNPV: mcResult.probabilityOfPositiveNPV,
                iterations: mcResult.iterations,
                keyDriverSensitivity: mcResult.keyDriverSensitivity,
              },
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error running rNPV model: ${err instanceof Error ? err.message : 'rNPV/MC calculation failed'}. Verify peak sales estimates are reasonable for the indication and that therapeutic area, modality, and phase are compatible.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 3: optimize_deal_structure
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'optimize_deal_structure',
    'Rank all 5 deal structures (licensing, acquisition, co-development, option, collaboration) for a given pharmaceutical asset. Returns each structure scored by total value to the licensor, with upfront amounts, total deal values, and a recommendation when an alternative beats the current selection by 20%+.',
    {
      therapeuticArea: therapeuticAreaEnum,
      phase: phaseEnum,
      modality: modalityEnum,
      indication: z.string().describe('Specific indication key'),
      territory: territoryEnum,
      competitivePosition: competitivePositionEnum,
      peakSalesMedian: z.number().positive().describe('Peak annual sales estimate in $M'),
      peakSalesLow: z.number().positive().optional(),
      peakSalesHigh: z.number().positive().optional(),
      dataQuality: dataQualityEnum.optional(),
      biomarkerStatus: biomarkerStatusEnum.optional(),
      regulatoryDesignations: regulatoryDesignationsSchema.optional(),
      dealType: dealTypeEnum.optional().describe('Currently selected deal type (used as baseline for comparison).'),
      companyType: z.enum(['largePharma', 'midPharma', 'biotech', 'clinicalStageBiotech', 'academic']).optional(),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'optimize_deal_structure');

      const peakSalesMedian = params.peakSalesMedian;
      const rnpvInput: RNPVInput = {
        therapeuticArea: params.therapeuticArea as TherapeuticArea,
        phase: params.phase as Phase,
        modality: params.modality as Modality,
        indication: params.indication,
        territory: params.territory,
        competitivePosition: params.competitivePosition,
        peakSalesEstimate: {
          low: params.peakSalesLow ?? peakSalesMedian * 0.5,
          median: peakSalesMedian,
          high: params.peakSalesHigh ?? peakSalesMedian * 2,
        },
        dataQuality: params.dataQuality ?? 'promising',
        biomarkerStatus: params.biomarkerStatus ?? 'unselected',
        regulatoryDesignations: params.regulatoryDesignations ?? {
          breakthrough: false, fastTrack: false, orphan: false, prime: false,
        },
        dealType: params.dealType ?? 'licensing',
        companyType: params.companyType ?? 'biotech',
      };

      try {
        const result = optimizeDealStructure(rnpvInput);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              rankings: result.rankings,
              recommendation: result.recommendation,
              userSelectedDealType: result.userSelectedDealType,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error optimizing deal structure: ${err instanceof Error ? err.message : 'Deal structure optimization failed'}. Ensure peak sales estimate and phase are compatible with the specified therapeutic area and modality.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 4: match_partners
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'match_partners',
    'Find the best-fit licensing/acquisition partners for a pharmaceutical asset. Scores 850+ companies across 9 dimensions (modality fit, indication relevance, phase preference, activity signals, strategic need, territory, quality, deal type, watch-outs). Returns ranked matches with Pharma Intent scores, strategic context, and recent deal history.',
    {
      therapeuticArea: therapeuticAreaEnum,
      phase: phaseEnum,
      modality: modalityEnum,
      indication: z.string().optional().describe('Specific indication key (e.g., "lung_nsclc"). Improves match precision.'),
      territory: territoryEnum.optional().describe('Territory scope for the deal. Defaults to global.'),
      dealType: dealTypeEnum.optional().describe('Preferred deal structure. Defaults to licensing.'),
      limit: z.number().min(1).max(20).optional().describe('Maximum number of partners to return (1-20). Defaults to 10.'),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'match_partners');

      try {
        const supabase = createServiceClient();
        const matchResult = await findPartnerMatches(supabase, {
          modality: params.modality,
          development_phase: params.phase,
          indication_category: params.therapeuticArea,
          indication_specific: params.indication ?? null,
          territory_scope: params.territory ?? 'global',
          therapeutic_area: params.therapeuticArea,
          dealType: params.dealType ?? 'licensing',
        }, {
          limit: params.limit ?? 10,
          includeEnhancedBreakdown: true,
        });

        // Serialize a clean subset for MCP consumers
        const matches = matchResult.matches.map((m) => ({
          company_name: m.company_name,
          company_type: m.company_type,
          ticker: m.ticker,
          hq_country: m.hq_country,
          match_score: m.match_score,
          match_reasons: m.match_reasons,
          score_breakdown: m.score_breakdown,
          deals_last_12mo: m.deals_last_12mo,
          deals_last_24mo: m.deals_last_24mo,
          last_deal_date: m.last_deal_date,
          modalities_active: m.modalities_active,
          pharma_intent: m.pharma_intent,
          watch_outs: m.watch_outs,
          strategic_context: m.strategic_context,
        }));

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              total_matches: matchResult.total_matches,
              matches,
              generated_at: matchResult.generated_at,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error matching partners: ${err instanceof Error ? err.message : 'Partner matching failed'}. Ensure therapeutic area and modality are valid. Use the therapeutic-areas resource for supported values.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 5: compute_negotiation_zopa
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'compute_negotiation_zopa',
    'Compute the Zone of Possible Agreement (ZOPA) for a pharmaceutical deal negotiation with 1-3 specific buyers. Uses rNPV base valuation combined with buyer-specific historical premiums from the counterparty premium database. Returns per-buyer floor (BATNA), ceiling, recommended opening position, and fallback point.',
    {
      therapeuticArea: therapeuticAreaEnum,
      phase: phaseEnum,
      modality: modalityEnum,
      indication: z.string().optional().describe('Specific indication key'),
      peakSalesMedian: z.number().positive().describe('Peak annual sales estimate in $M'),
      peakSalesLow: z.number().positive().optional(),
      peakSalesHigh: z.number().positive().optional(),
      competitivePosition: competitivePositionEnum,
      buyers: z.array(z.string()).min(1).max(3).describe('Array of 1-3 buyer company names (e.g., ["Pfizer", "AbbVie", "Roche"])'),
      batnaUpfrontM: z.number().nonnegative().describe('Licensor BATNA (walk-away) upfront amount in $M. The minimum acceptable upfront payment.'),
      dataQuality: dataQualityEnum.optional(),
      biomarkerStatus: biomarkerStatusEnum.optional(),
      regulatoryDesignations: regulatoryDesignationsSchema.optional(),
      companyType: z.enum(['largePharma', 'midPharma', 'biotech', 'clinicalStageBiotech', 'academic']).optional(),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'compute_negotiation_zopa');

      const peakSalesMedian = params.peakSalesMedian;
      const rnpvInput: RNPVInput = {
        therapeuticArea: params.therapeuticArea as TherapeuticArea,
        phase: params.phase as Phase,
        modality: params.modality as Modality,
        indication: params.indication ?? '',
        territory: 'global',
        competitivePosition: params.competitivePosition,
        peakSalesEstimate: {
          low: params.peakSalesLow ?? peakSalesMedian * 0.5,
          median: peakSalesMedian,
          high: params.peakSalesHigh ?? peakSalesMedian * 2,
        },
        dataQuality: params.dataQuality ?? 'promising',
        biomarkerStatus: params.biomarkerStatus ?? 'unselected',
        regulatoryDesignations: params.regulatoryDesignations ?? {
          breakthrough: false, fastTrack: false, orphan: false, prime: false,
        },
        dealType: 'licensing',
        companyType: params.companyType ?? 'biotech',
      };

      try {
        // Run rNPV once for the base valuation
        const rnpvResult = calculateRNPV(rnpvInput);
        const baseUpfront = rnpvResult.impliedDealValue?.upfront?.median ?? 0;
        const totalDealMedian = rnpvResult.impliedDealValue?.totalDeal?.median ?? 0;
        const riskAdjustedNPV = rnpvResult.riskAdjustedNPV ?? 0;

        // Fetch buyer premiums from counterparty_premiums table
        const supabase = createServiceClient();
        const { data: premiumRows } = await supabase
          .from('counterparty_premiums')
          .select('company_name, premium_multiplier')
          .in('company_name', params.buyers);

        const premiumMap = new Map<string, number>();
        for (const row of premiumRows ?? []) {
          premiumMap.set(row.company_name, Number(row.premium_multiplier));
        }

        // Compute per-buyer ZOPA
        const buyerResults = params.buyers.map((buyerName) => {
          const premium = premiumMap.get(buyerName) ?? 1.0;
          const buyerTopUpfront = Math.round(baseUpfront * premium);
          const floorUpfront = Math.round(params.batnaUpfrontM);
          const zopaWidth = buyerTopUpfront - floorUpfront;
          const zopaMidpoint = zopaWidth > 0 ? (floorUpfront + buyerTopUpfront) / 2 : floorUpfront;
          const recommendedOpening = zopaWidth > 0
            ? Math.round(zopaMidpoint + zopaWidth * 0.35)
            : Math.round(buyerTopUpfront);
          const recommendedFallback = zopaWidth > 0
            ? Math.round(zopaMidpoint)
            : floorUpfront;

          return {
            buyer: buyerName,
            premiumMultiplier: premium,
            premiumFound: premiumMap.has(buyerName),
            floorUpfront_M: floorUpfront,
            buyerTopUpfront_M: buyerTopUpfront,
            zopaWidth_M: zopaWidth,
            zopaExists: zopaWidth > 0,
            recommendedOpening_M: recommendedOpening,
            recommendedFallback_M: recommendedFallback,
          };
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              baseValuation: {
                riskAdjustedNPV_M: Math.round(riskAdjustedNPV),
                upfrontMedian_M: Math.round(baseUpfront),
                totalDealMedian_M: Math.round(totalDealMedian),
              },
              buyers: buyerResults,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error computing negotiation ZOPA: ${err instanceof Error ? err.message : 'ZOPA computation failed'}. Verify buyer names match known companies (use the buyer-premiums resource) and that BATNA amount is reasonable for the asset.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 6: get_regulatory_risk
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'get_regulatory_risk',
    'Analyze global regulatory risk across 7 agencies (FDA, EMA, PMDA, NMPA, TGA, Health Canada, Swissmedic) for a pharmaceutical asset. Returns per-agency rejection probability, review timelines, designation impacts, expert committee requirements, and conditional approval risks. Agencies are filtered based on the target territory.',
    {
      therapeuticArea: therapeuticAreaEnum,
      phase: phaseEnum,
      modality: modalityEnum,
      indication: z.string().describe('Specific indication key'),
      territory: territoryEnum,
      regulatoryDesignations: z.object({
        breakthrough: z.boolean().default(false).describe('FDA Breakthrough Therapy designation'),
        fastTrack: z.boolean().default(false).describe('FDA Fast Track designation'),
        orphan: z.boolean().default(false).describe('FDA/EMA Orphan Drug designation'),
        prime: z.boolean().default(false).describe('EMA PRIME (Priority Medicines) designation'),
        acceleratedApproval: z.boolean().default(false).describe('Accelerated Approval pathway'),
        priorityReview: z.boolean().default(false).describe('Priority Review designation'),
        rarePediatric: z.boolean().default(false).describe('Rare Pediatric Disease designation'),
      }).optional(),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'get_regulatory_risk');

      try {
        const designations = params.regulatoryDesignations ?? {
          breakthrough: false, fastTrack: false, orphan: false, prime: false,
          acceleratedApproval: false, priorityReview: false, rarePediatric: false,
        };

        const result = computeGlobalRegulatoryRisk(
          params.phase as Phase,
          params.therapeuticArea as TherapeuticArea,
          params.modality as Modality,
          params.indication,
          designations,
          params.territory,
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              overallRiskScore: result.overallRiskScore,
              combinedTimelineImpact_years: result.combinedTimelineImpact_years,
              narrative: result.narrative,
              primaryAgency: {
                agency: result.primary.agency,
                rejectionProbability: result.primary.rejectionProbability,
                rejectionLabel: result.primary.rejectionLabel,
                reviewType: result.primary.currentReviewType,
                standardReviewMonths: result.primary.standardReviewMonths,
                priorityReviewMonths: result.primary.priorityReviewMonths,
                designations: result.primary.designations,
                narrative: result.primary.narrative,
              },
              agencies: result.agencies.map((a) => ({
                agency: a.agency,
                agencyFullName: a.agencyFullName,
                territory: a.territory,
                rejectionProbability: a.rejectionProbability,
                rejectionLabel: a.rejectionLabel,
                expertCommitteeRequired: a.expertCommitteeRequired,
                expertCommitteeFavorableRate: a.expertCommitteeFavorableRate,
                reviewType: a.currentReviewType,
                standardReviewMonths: a.standardReviewMonths,
                priorityReviewMonths: a.priorityReviewMonths,
                conditionalApprovalAvailable: a.conditionalApprovalAvailable,
                conditionalApprovalRisk: a.conditionalApprovalRisk,
                timelineImpact_years: a.timelineImpact_years,
                narrative: a.narrative,
              })),
              // Backward-compat FDA-specific fields
              crlProbability: result.crlProbability,
              adcommRequired: result.adcommRequired,
              adcommFavorableVoteProbability: result.adcommFavorableVoteProbability,
              prvEligible: result.prvEligible,
              prvValue_M: result.prvValue_M,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error analyzing regulatory risk: ${err instanceof Error ? err.message : 'Regulatory risk analysis failed'}. Verify indication and territory are valid. Use the territories resource to see which agencies apply to each territory.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 7: get_comparable_deals
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'get_comparable_deals',
    'Find comparable pharmaceutical transactions from a curated database of 280+ deals. Uses hedonic regression scoring to rank deals by relevance across modality, indication, phase, territory, deal type, and recency. Returns deal parties, values, years, and relevance explanations.',
    {
      therapeuticArea: therapeuticAreaEnum,
      phase: phaseEnum.optional().describe('Development phase filter. Improves relevance scoring.'),
      modality: modalityEnum,
      indication: z.string().optional().describe('Specific indication key for tighter matching.'),
      dealType: dealTypeEnum.optional().describe('Deal structure filter.'),
      territory: territoryEnum.optional().describe('Territory filter.'),
      maxDeals: z.number().min(1).max(20).optional().describe('Maximum deals to return (1-20). Defaults to 5.'),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'get_comparable_deals');

      try {
        const deals = findComparableDeals(
          {
            therapeuticArea: params.therapeuticArea,
            modality: params.modality,
            indication: params.indication ?? '',
            phase: params.phase,
            dealType: params.dealType,
            territory: params.territory,
          },
          params.maxDeals ?? 5,
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              count: deals.length,
              deals: deals.map((d) => ({
                id: d.id,
                parties: d.parties,
                totalValue: d.totalValue,
                upfront: d.upfront,
                year: d.year,
                phase: d.phase,
                relevanceReasons: d.relevanceReasons,
                scoreBreakdown: d.scoreBreakdown,
                patentCliffContext: d.patent_cliff_context,
              })),
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error searching comparable deals: ${err instanceof Error ? err.message : 'Comparable deals search failed'}. Ensure modality and therapeutic area have matching deals in the database. Try broadening filters (remove indication or territory).` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 8: get_market_intelligence
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'get_market_intelligence',
    'Get upcoming Phase 3 clinical trial readouts (from ClinicalTrials.gov) and FDA Advisory Committee meetings for a given therapeutic area. Critical for understanding near-term catalysts that affect deal pricing and competitive dynamics.',
    {
      therapeuticArea: z.string().describe('Therapeutic area to filter (e.g., "oncology", "neurology", "immunology"). For readouts, maps to ClinicalTrials.gov condition queries. For AdComm, filters by TA.'),
      daysAhead: z.number().min(1).max(365).optional().describe('Number of days ahead to search for readouts (1-365). Defaults to 90.'),
      readoutLimit: z.number().min(1).max(50).optional().describe('Maximum readouts to return (1-50). Defaults to 10.'),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'get_market_intelligence');

      try {
        // Fetch readouts and AdComm calendar in parallel
        const [readouts, adcommMeetings] = await Promise.all([
          fetchUpcomingReadouts({
            ta: params.therapeuticArea,
            phase: 'PHASE3',
            limit: params.readoutLimit ?? 10,
            daysAhead: params.daysAhead ?? 90,
          }).catch(() => [] as Awaited<ReturnType<typeof fetchUpcomingReadouts>>),
          Promise.resolve(
            getAdCommCalendar({
              ta: params.therapeuticArea,
              daysAheadMax: params.daysAhead ?? 90,
              daysBehindMax: 30,
            }),
          ),
        ]);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              readouts: {
                count: readouts.length,
                items: readouts.map((r) => ({
                  nctId: r.nctId,
                  title: r.title,
                  sponsor: r.sponsor,
                  conditions: r.conditions,
                  phase: r.phase,
                  primaryCompletionDate: r.primaryCompletionDate,
                  daysToReadout: r.daysToReadout,
                  enrollment: r.enrollment,
                  intervention: r.intervention,
                  studyUrl: r.studyUrl,
                })),
              },
              adcommMeetings: {
                count: adcommMeetings.length,
                items: adcommMeetings.map((m) => ({
                  ...m,
                })),
              },
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error fetching market intelligence: ${err instanceof Error ? err.message : 'Market intelligence fetch failed'}. The ClinicalTrials.gov API may be temporarily unavailable. Try again or reduce daysAhead/readoutLimit.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 9: run_scenario_comparison
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'run_scenario_comparison',
    'Run Bear/Base/Bull scenario comparison with probability-weighted expected value for a pharmaceutical asset. Uses differentiated assumptions (peak sales, PoS, timeline) across three scenarios to produce a range-bound valuation with an expected value anchored to scenario weights.',
    {
      therapeuticArea: therapeuticAreaEnum,
      phase: phaseEnum,
      modality: modalityEnum,
      indication: z.string().describe('Specific indication key'),
      territory: territoryEnum,
      competitivePosition: competitivePositionEnum,
      peakSalesMedian: z.number().positive().describe('Base-case peak annual sales estimate in $M'),
      peakSalesLow: z.number().positive().optional().describe('Bear-case peak sales in $M. Defaults to 50% of median.'),
      peakSalesHigh: z.number().positive().optional().describe('Bull-case peak sales in $M. Defaults to 200% of median.'),
      dataQuality: dataQualityEnum.optional(),
      biomarkerStatus: biomarkerStatusEnum.optional(),
      regulatoryDesignations: regulatoryDesignationsSchema.optional(),
      dealType: dealTypeEnum.optional(),
      companyType: z.enum(['largePharma', 'midPharma', 'biotech', 'clinicalStageBiotech', 'academic']).optional(),
      bearWeight: z.number().min(0).max(1).optional().describe('Probability weight for bear scenario (0-1). Defaults to 0.25.'),
      baseWeight: z.number().min(0).max(1).optional().describe('Probability weight for base scenario (0-1). Defaults to 0.50.'),
      bullWeight: z.number().min(0).max(1).optional().describe('Probability weight for bull scenario (0-1). Defaults to 0.25.'),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'run_scenario_comparison');

      const peakSalesMedian = params.peakSalesMedian;
      const rnpvInput: RNPVInput = {
        therapeuticArea: params.therapeuticArea as TherapeuticArea,
        phase: params.phase as Phase,
        modality: params.modality as Modality,
        indication: params.indication,
        territory: params.territory,
        competitivePosition: params.competitivePosition,
        peakSalesEstimate: {
          low: params.peakSalesLow ?? peakSalesMedian * 0.5,
          median: peakSalesMedian,
          high: params.peakSalesHigh ?? peakSalesMedian * 2,
        },
        dataQuality: params.dataQuality ?? 'promising',
        biomarkerStatus: params.biomarkerStatus ?? 'unselected',
        regulatoryDesignations: params.regulatoryDesignations ?? {
          breakthrough: false, fastTrack: false, orphan: false, prime: false,
        },
        dealType: params.dealType ?? 'licensing',
        companyType: params.companyType ?? 'biotech',
      };

      try {
        const baseResult = calculateRNPV(rnpvInput);
        const scenarioComparison = generateScenarioComparison(rnpvInput, baseResult, calculateRNPV);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              bear: {
                rnpv_M: scenarioComparison.bear.rnpv,
                impliedDeal_M: scenarioComparison.bear.impliedDeal,
                cumulativePoS: scenarioComparison.bear.cumulativePoS,
                yearsToMarket: scenarioComparison.bear.yearsToMarket,
                assumptions: scenarioComparison.bear.assumptions,
              },
              base: {
                rnpv_M: scenarioComparison.base.rnpv,
                impliedDeal_M: scenarioComparison.base.impliedDeal,
                cumulativePoS: scenarioComparison.base.cumulativePoS,
                yearsToMarket: scenarioComparison.base.yearsToMarket,
                assumptions: scenarioComparison.base.assumptions,
              },
              bull: {
                rnpv_M: scenarioComparison.bull.rnpv,
                impliedDeal_M: scenarioComparison.bull.impliedDeal,
                cumulativePoS: scenarioComparison.bull.cumulativePoS,
                yearsToMarket: scenarioComparison.bull.yearsToMarket,
                assumptions: scenarioComparison.bull.assumptions,
              },
              expectedValue_M: scenarioComparison.expectedValue,
              weights: {
                bear: params.bearWeight ?? scenarioComparison.bearWeight,
                base: params.baseWeight ?? scenarioComparison.baseWeight,
                bull: params.bullWeight ?? scenarioComparison.bullWeight,
              },
              narrative: scenarioComparison.narrative,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error running scenario comparison: ${err instanceof Error ? err.message : 'Scenario comparison failed'}. Verify peak sales estimates and phase are valid.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 10: analyze_lifecycle_extensions
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'analyze_lifecycle_extensions',
    'Model label expansion, pediatric exclusivity, combination approval, and other lifecycle extension opportunities for a pharmaceutical asset. Quantifies incremental peak sales and franchise premium from each potential expansion beyond the primary indication.',
    {
      therapeuticArea: therapeuticAreaEnum,
      phase: phaseEnum,
      modality: modalityEnum,
      indication: z.string().describe('Primary indication key'),
      territory: territoryEnum,
      competitivePosition: competitivePositionEnum,
      peakSalesMedian: z.number().positive().describe('Base-case peak annual sales estimate in $M'),
      peakSalesLow: z.number().positive().optional(),
      peakSalesHigh: z.number().positive().optional(),
      dataQuality: dataQualityEnum.optional(),
      biomarkerStatus: biomarkerStatusEnum.optional(),
      regulatoryDesignations: regulatoryDesignationsSchema.optional(),
      dealType: dealTypeEnum.optional(),
      companyType: z.enum(['largePharma', 'midPharma', 'biotech', 'clinicalStageBiotech', 'academic']).optional(),
    },
    async (params) => {
      assertToolAccess(mcpTier, 'analyze_lifecycle_extensions');
      await trackToolUsage(apiKeyContext.keyId, 'analyze_lifecycle_extensions');

      const peakSalesMedian = params.peakSalesMedian;
      const rnpvInput: RNPVInput = {
        therapeuticArea: params.therapeuticArea as TherapeuticArea,
        phase: params.phase as Phase,
        modality: params.modality as Modality,
        indication: params.indication,
        territory: params.territory,
        competitivePosition: params.competitivePosition,
        peakSalesEstimate: {
          low: params.peakSalesLow ?? peakSalesMedian * 0.5,
          median: peakSalesMedian,
          high: params.peakSalesHigh ?? peakSalesMedian * 2,
        },
        dataQuality: params.dataQuality ?? 'promising',
        biomarkerStatus: params.biomarkerStatus ?? 'unselected',
        regulatoryDesignations: params.regulatoryDesignations ?? {
          breakthrough: false, fastTrack: false, orphan: false, prime: false,
        },
        dealType: params.dealType ?? 'licensing',
        companyType: params.companyType ?? 'biotech',
      };

      try {
        const baseResult = calculateRNPV(rnpvInput);
        const lifecycle = calculateLifecycleExtensions(rnpvInput, baseResult);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              extensions: JSON.parse(JSON.stringify(lifecycle.extensions)),
              baseRNPV_M: lifecycle.baseRNPV,
              extendedRNPV_M: lifecycle.extendedRNPV,
              incrementalValue_M: lifecycle.incrementalValue,
              incrementalPercent: lifecycle.incrementalPercent,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error analyzing lifecycle extensions: ${err instanceof Error ? err.message : 'Lifecycle analysis failed'}. Verify therapeutic area and modality are compatible.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 11: model_competitive_dynamics
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'model_competitive_dynamics',
    'Year-by-year competitive revenue erosion modeling for a pharmaceutical asset. Projects how pipeline competitors, generic/biosimilar entry, and pricing pressure affect peak revenue over time. Returns erosion schedule, generic entry timing, and biosimilar share impact.',
    {
      therapeuticArea: therapeuticAreaEnum,
      phase: phaseEnum,
      modality: modalityEnum,
      indication: z.string().describe('Specific indication key'),
      territory: territoryEnum,
      competitivePosition: competitivePositionEnum,
      peakSalesMedian: z.number().positive().describe('Peak annual sales estimate in $M'),
      peakSalesLow: z.number().positive().optional(),
      peakSalesHigh: z.number().positive().optional(),
      dataQuality: dataQualityEnum.optional(),
      biomarkerStatus: biomarkerStatusEnum.optional(),
      regulatoryDesignations: regulatoryDesignationsSchema.optional(),
      dealType: dealTypeEnum.optional(),
      companyType: z.enum(['largePharma', 'midPharma', 'biotech', 'clinicalStageBiotech', 'academic']).optional(),
    },
    async (params) => {
      assertToolAccess(mcpTier, 'model_competitive_dynamics');
      await trackToolUsage(apiKeyContext.keyId, 'model_competitive_dynamics');

      const peakSalesMedian = params.peakSalesMedian;
      const rnpvInput: RNPVInput = {
        therapeuticArea: params.therapeuticArea as TherapeuticArea,
        phase: params.phase as Phase,
        modality: params.modality as Modality,
        indication: params.indication,
        territory: params.territory,
        competitivePosition: params.competitivePosition,
        peakSalesEstimate: {
          low: params.peakSalesLow ?? peakSalesMedian * 0.5,
          median: peakSalesMedian,
          high: params.peakSalesHigh ?? peakSalesMedian * 2,
        },
        dataQuality: params.dataQuality ?? 'promising',
        biomarkerStatus: params.biomarkerStatus ?? 'unselected',
        regulatoryDesignations: params.regulatoryDesignations ?? {
          breakthrough: false, fastTrack: false, orphan: false, prime: false,
        },
        dealType: params.dealType ?? 'licensing',
        companyType: params.companyType ?? 'biotech',
      };

      try {
        const baseResult = calculateRNPV(rnpvInput);
        const dynamics = calculateCompetitiveDynamics(rnpvInput, baseResult);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              competitorTimeline: dynamics.competitorTimeline,
              baselineRevenue: dynamics.baselineRevenue,
              adjustedRevenue: dynamics.adjustedRevenue,
              priceIndex: dynamics.priceIndex,
              volumeIndex: dynamics.volumeIndex,
              peakShareErosion: dynamics.peakShareErosion,
              peakPriceErosion: dynamics.peakPriceErosion,
              revenueImpact: dynamics.revenueImpact,
              peakErosionYear: dynamics.peakErosionYear,
              confidence: dynamics.confidence,
              narrative: dynamics.narrative,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error modeling competitive dynamics: ${err instanceof Error ? err.message : 'Competitive dynamics modeling failed'}. Verify therapeutic area and indication have pipeline data.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 12: value_real_options
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'value_real_options',
    'CRR binomial lattice compound option valuation for a pharmaceutical asset. Values the management flexibility (abandon, delay, expand) embedded in staged drug development. Returns option value by phase, implied volatility, flexibility premium over static rNPV, and optimal exercise decisions.',
    {
      therapeuticArea: therapeuticAreaEnum,
      phase: phaseEnum,
      modality: modalityEnum,
      indication: z.string().describe('Specific indication key'),
      territory: territoryEnum,
      competitivePosition: competitivePositionEnum,
      peakSalesMedian: z.number().positive().describe('Peak annual sales estimate in $M'),
      peakSalesLow: z.number().positive().optional(),
      peakSalesHigh: z.number().positive().optional(),
      dataQuality: dataQualityEnum.optional(),
      biomarkerStatus: biomarkerStatusEnum.optional(),
      regulatoryDesignations: regulatoryDesignationsSchema.optional(),
      dealType: dealTypeEnum.optional(),
      companyType: z.enum(['largePharma', 'midPharma', 'biotech', 'clinicalStageBiotech', 'academic']).optional(),
    },
    async (params) => {
      assertToolAccess(mcpTier, 'value_real_options');
      await trackToolUsage(apiKeyContext.keyId, 'value_real_options');

      const peakSalesMedian = params.peakSalesMedian;
      const rnpvInput: RNPVInput = {
        therapeuticArea: params.therapeuticArea as TherapeuticArea,
        phase: params.phase as Phase,
        modality: params.modality as Modality,
        indication: params.indication,
        territory: params.territory,
        competitivePosition: params.competitivePosition,
        peakSalesEstimate: {
          low: params.peakSalesLow ?? peakSalesMedian * 0.5,
          median: peakSalesMedian,
          high: params.peakSalesHigh ?? peakSalesMedian * 2,
        },
        dataQuality: params.dataQuality ?? 'promising',
        biomarkerStatus: params.biomarkerStatus ?? 'unselected',
        regulatoryDesignations: params.regulatoryDesignations ?? {
          breakthrough: false, fastTrack: false, orphan: false, prime: false,
        },
        dealType: params.dealType ?? 'licensing',
        companyType: params.companyType ?? 'biotech',
      };

      try {
        const baseResult = calculateRNPV(rnpvInput);
        const mcResult = runMonteCarlo({ rnpvInput, iterations: 5_000 });
        const realOptions = calculateRealOptions(rnpvInput, baseResult, {
          percentiles: { p10: mcResult.percentiles.p10, p90: mcResult.percentiles.p90 },
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              optionValueByPhase: realOptions.optionValueByPhase,
              totalOptionValue_M: realOptions.totalOptionValue,
              flexibilityPremium_M: realOptions.flexibilityPremium,
              flexibilityPremiumPercent: realOptions.flexibilityPremiumPercent,
              volatilityUsed: realOptions.volatilityUsed,
              riskFreeRate: realOptions.riskFreeRate,
              latticeSteps: realOptions.latticeSteps,
              converged: realOptions.converged,
              narrative: realOptions.narrative,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error computing real options valuation: ${err instanceof Error ? err.message : 'Real options valuation failed'}. Verify asset parameters are reasonable for option pricing.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 13: run_defensive_analysis
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'run_defensive_analysis',
    'Worst/base/best case scenario analysis with walk-away thresholds and defensive floor. Identifies the minimum defensible valuation and the point at which a deal should be abandoned. Critical for negotiation preparation and risk management.',
    {
      therapeuticArea: therapeuticAreaEnum,
      phase: phaseEnum,
      modality: modalityEnum,
      indication: z.string().describe('Specific indication key'),
      territory: territoryEnum,
      competitivePosition: competitivePositionEnum,
      peakSalesMedian: z.number().positive().describe('Peak annual sales estimate in $M'),
      peakSalesLow: z.number().positive().optional(),
      peakSalesHigh: z.number().positive().optional(),
      dataQuality: dataQualityEnum.optional(),
      biomarkerStatus: biomarkerStatusEnum.optional(),
      regulatoryDesignations: regulatoryDesignationsSchema.optional(),
      dealType: dealTypeEnum.optional(),
      companyType: z.enum(['largePharma', 'midPharma', 'biotech', 'clinicalStageBiotech', 'academic']).optional(),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'run_defensive_analysis');

      const peakSalesMedian = params.peakSalesMedian;
      const rnpvInput: RNPVInput = {
        therapeuticArea: params.therapeuticArea as TherapeuticArea,
        phase: params.phase as Phase,
        modality: params.modality as Modality,
        indication: params.indication,
        territory: params.territory,
        competitivePosition: params.competitivePosition,
        peakSalesEstimate: {
          low: params.peakSalesLow ?? peakSalesMedian * 0.5,
          median: peakSalesMedian,
          high: params.peakSalesHigh ?? peakSalesMedian * 2,
        },
        dataQuality: params.dataQuality ?? 'promising',
        biomarkerStatus: params.biomarkerStatus ?? 'unselected',
        regulatoryDesignations: params.regulatoryDesignations ?? {
          breakthrough: false, fastTrack: false, orphan: false, prime: false,
        },
        dealType: params.dealType ?? 'licensing',
        companyType: params.companyType ?? 'biotech',
      };

      try {
        const baseResult = calculateRNPV(rnpvInput);
        const defensive = getDefensiveAnalysis(rnpvInput, baseResult);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              worstCase: {
                scenario: defensive.worstCase.scenario,
                adjustedRNPV_M: defensive.worstCase.adjustedRNPV,
                impactDelta_M: defensive.worstCase.impactDelta,
                impactPercent: defensive.worstCase.impactPercent,
                adjustedDealValue: defensive.worstCase.adjustedDealValue,
                narrative: defensive.worstCase.narrative,
              },
              bestCase: {
                scenario: defensive.bestCase.scenario,
                adjustedRNPV_M: defensive.bestCase.adjustedRNPV,
                impactDelta_M: defensive.bestCase.impactDelta,
                impactPercent: defensive.bestCase.impactPercent,
                adjustedDealValue: defensive.bestCase.adjustedDealValue,
                narrative: defensive.bestCase.narrative,
              },
              defensiveFloor_M: defensive.defensiveFloor,
              walkAwayThreshold_M: defensive.walkAwayThreshold,
              baseRNPV_M: baseResult.riskAdjustedNPV,
              narrative: defensive.narrative,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error running defensive analysis: ${err instanceof Error ? err.message : 'Defensive analysis failed'}. Verify asset parameters are valid.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 14: analyze_royalty_stacking
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'analyze_royalty_stacking',
    'Model upstream IP obligations and their net royalty impact on a pharmaceutical deal. Computes how background IP licenses, platform fees, and composition-of-matter obligations stack against the headline royalty rate. Supports anti-stacking provisions (floor, cap, pro-rata).',
    {
      modality: modalityEnum,
      grossRoyaltyRate: z.number().min(0.01).max(0.50).describe('Gross royalty rate as a decimal (e.g., 0.12 for 12%)'),
      obligationCount: z.number().min(0).max(10).optional().describe('Number of upstream IP obligations. Defaults to 2 (modality-typical).'),
      obligations: z.array(z.object({
        source: z.string().describe('IP licensor name (e.g., "University of Penn", "Genentech")'),
        rate: z.number().min(0).max(0.20).describe('Royalty rate owed to this licensor (e.g., 0.02 for 2%)'),
        type: z.enum(['platform', 'method', 'composition', 'formulation']).describe('Type of IP obligation'),
      })).optional().describe('Explicit upstream IP obligations. If omitted, uses modality-typical estimates.'),
      antiStackingProvisions: z.array(z.object({
        model: z.enum(['floor', 'cap', 'proRata']).describe('Anti-stacking provision type'),
        value: z.number().min(0).max(1).describe('Provision value (e.g., 0.50 for 50% floor/cap)'),
      })).optional().describe('Anti-stacking provisions in the license agreement.'),
    },
    async (params) => {
      assertToolAccess(mcpTier, 'analyze_royalty_stacking');
      await trackToolUsage(apiKeyContext.keyId, 'analyze_royalty_stacking');

      try {
        let result;
        if (params.obligations && params.obligations.length > 0) {
          // Use explicit obligations
          const backgroundIPs: BackgroundIP[] = params.obligations.map((o) => ({
            source: o.source,
            rate: o.rate,
            type: o.type as IPType,
          }));
          const provisions: AntiStackingProvision[] = (params.antiStackingProvisions ?? []).map((p) => ({
            model: p.model,
            value: p.value,
          }));
          result = computeRoyaltyStacking(params.grossRoyaltyRate, backgroundIPs, provisions);
        } else {
          // Use modality-based estimates
          result = estimateStackingByModality(
            params.grossRoyaltyRate,
            params.modality,
            params.obligationCount ?? 2,
          );
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              grossRoyaltyRate: params.grossRoyaltyRate,
              netRoyaltyRate: result.netRoyaltyRate,
              totalUpstreamBurden: result.totalUpstreamBurden,
              antiStackingOffset: result.antiStackingOffset,
              effectiveRetention: result.effectiveRetention,
              impactOnDealValue_pct: result.impactOnDealValue_pct,
              stackedObligations: result.stackedObligations,
              narrative: result.narrative,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error analyzing royalty stacking: ${err instanceof Error ? err.message : 'Royalty stacking analysis failed'}. Verify modality and royalty rate are valid.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 15: model_patent_dynamics
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'model_patent_dynamics',
    'Patent term adjustments, exclusivity periods, and loss-of-exclusivity (LOE) erosion curves for a pharmaceutical asset. Models PTA/PTE, pediatric exclusivity, orphan exclusivity, NCE/biologic exclusivity, Paragraph IV risk, and generic/biosimilar entry profiles.',
    {
      phase: phaseEnum,
      modality: modalityEnum,
      therapeuticArea: therapeuticAreaEnum,
      indication: z.string().describe('Specific indication key'),
      filingYear: z.number().min(2020).max(2040).optional().describe('Patent filing year. Defaults to current year.'),
      regulatoryDesignations: z.object({
        breakthrough: z.boolean().default(false),
        fastTrack: z.boolean().default(false),
        orphan: z.boolean().default(false),
        prime: z.boolean().default(false),
      }).optional(),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'model_patent_dynamics');

      try {
        const designations = params.regulatoryDesignations ?? {
          breakthrough: false, fastTrack: false, orphan: false, prime: false,
        };
        // Estimate approval year from phase
        const phaseToYears: Record<string, number> = {
          discovery: 10, preclinical: 8, phase1: 6, phase1_2: 5,
          phase2: 4, phase2_3: 3, phase3: 2, nda_filed: 1, approved: 0,
        };
        const yearsToApproval = phaseToYears[params.phase] ?? 4;
        const approvalYear = (params.filingYear ?? new Date().getFullYear()) + yearsToApproval;

        const result = computePatentDynamics(
          params.phase,
          params.modality,
          params.therapeuticArea,
          params.indication,
          designations,
          approvalYear,
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              basePatentLife_years: result.basePatentLife_years,
              ptaAdjustment_years: result.ptaAdjustment_years,
              pteAdjustment_years: result.pteAdjustment_years,
              pediatricExclusivity_years: result.pediatricExclusivity_years,
              orphanExclusivity_years: result.orphanExclusivity_years,
              nceExclusivity_years: result.nceExclusivity_years,
              biologicExclusivity_years: result.biologicExclusivity_years,
              effectiveLOE_yearsFromApproval: result.effectiveLOE_yearsFromApproval,
              estimatedApprovalYear: approvalYear,
              genericEntryProfile: result.genericEntryProfile,
              paragraphIVRisk: result.paragraphIVRisk,
              authorizedGenericImpact: result.authorizedGenericImpact,
              narrative: result.narrative,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error modeling patent dynamics: ${err instanceof Error ? err.message : 'Patent dynamics modeling failed'}. Verify modality and phase are valid.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 16: assess_cmc_risk
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'assess_cmc_risk',
    'Manufacturing timeline and complexity risk assessment for a pharmaceutical asset. Evaluates modality-specific manufacturing challenges, supply chain risk, clinical hold probability, scalability, and regulatory complexity. Critical for understanding hidden timeline and cost risks.',
    {
      modality: modalityEnum,
      phase: phaseEnum,
      therapeuticArea: therapeuticAreaEnum,
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'assess_cmc_risk');

      try {
        const result = computeCMCRisk(
          params.modality as Modality,
          params.phase as Phase,
          params.therapeuticArea as TherapeuticArea,
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              additionalTimeline_years: result.additionalTimeline_years,
              manufacturingCostMultiplier: result.manufacturingCostMultiplier,
              supplyChainRisk: result.supplyChainRisk,
              clinicalHoldProbability: result.clinicalHoldProbability,
              scalabilityScore: result.scalabilityScore,
              regulatoryComplexity: result.regulatoryComplexity,
              narrative: result.narrative,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error assessing CMC risk: ${err instanceof Error ? err.message : 'CMC risk assessment failed'}. Verify modality and phase are valid.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 17: value_earnout_cvr
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'value_earnout_cvr',
    'Contingent value rights and earnout time-value analysis for a pharmaceutical deal. Computes probability-weighted present value of milestone-contingent payments, CVR payoff profiles, and buyer risk assessment. Uses phase-specific PoS and time-to-event discounting.',
    {
      phase: phaseEnum,
      therapeuticArea: therapeuticAreaEnum,
      dealType: dealTypeEnum.optional().describe('Deal structure. Defaults to licensing.'),
      totalContingentValue_M: z.number().positive().optional().describe('Total contingent deal value in $M. If omitted, uses phase-based defaults.'),
      peakSalesMedian: z.number().positive().describe('Peak annual sales estimate in $M (used for sales-milestone sizing)'),
      discountRate: z.number().min(0.01).max(0.30).optional().describe('Discount rate for PV calculations (0.01-0.30). Defaults to 0.10.'),
      tranches: z.array(z.object({
        trigger: z.string().describe('Milestone trigger description (e.g., "Phase 3 initiation", "FDA approval", "$1B cumulative sales")'),
        amount_M: z.number().positive().describe('Milestone payment amount in $M'),
        type: z.enum(['development', 'regulatory', 'commercial']).describe('Milestone type'),
      })).optional().describe('Custom milestone tranches. If omitted, uses phase/deal-type defaults.'),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'value_earnout_cvr');

      try {
        const dealType = params.dealType ?? 'licensing';
        const discountRate = params.discountRate ?? 0.10;

        let earnoutStructure;
        if (params.tranches && params.tranches.length > 0) {
          const totalContingent = params.tranches.reduce((s, t) => s + t.amount_M, 0);
          const upfront = (params.totalContingentValue_M ?? totalContingent) * 0.25;
          earnoutStructure = {
            upfront_M: upfront,
            tranches: params.tranches.map((t) => ({
              trigger: t.trigger,
              amount_M: t.amount_M,
              type: t.type as 'development' | 'regulatory' | 'commercial',
            })) as unknown as EarnoutTrancheInput[],
            totalHeadlineDealValue_M: upfront + totalContingent,
          };
        } else {
          earnoutStructure = DEFAULT_EARNOUT_STRUCTURE(params.phase as Phase, dealType);
        }

        const result = computeEarnoutValue(
          earnoutStructure,
          params.phase as Phase,
          params.therapeuticArea as TherapeuticArea,
          discountRate,
          params.peakSalesMedian,
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              probabilityWeightedValue_M: result.probabilityWeightedValue_M,
              upfrontEquivalent_M: result.upfrontEquivalent_M,
              earnoutAsPercentOfTotal: result.earnoutAsPercentOfTotal,
              buyerRisk: result.buyerRisk,
              tranches: JSON.parse(JSON.stringify(result.tranches)),
              discountRateApplied: discountRate,
              narrative: result.narrative,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error valuing earnout/CVR: ${err instanceof Error ? err.message : 'Earnout valuation failed'}. Verify phase and therapeutic area are valid.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 18: analyze_cross_border_tax
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'analyze_cross_border_tax',
    'Territory-specific tax structuring impact analysis for a pharmaceutical deal. Evaluates effective tax rates, withholding tax impact, optimal IP holding structures, transfer pricing risk, and Pillar Two implications across major pharma jurisdictions.',
    {
      territory: z.enum(['us', 'eu', 'japan', 'china', 'row', 'global']).describe('Primary deal territory for tax analysis'),
      dealType: dealTypeEnum,
      peakSalesMedian: z.number().positive().describe('Peak annual sales estimate in $M'),
      dealValue_M: z.number().positive().optional().describe('Total deal value in $M. Defaults to 3x peak sales.'),
      royaltyRate: z.number().min(0.01).max(0.50).optional().describe('Royalty rate as decimal (e.g., 0.12 for 12%). Defaults to 0.10.'),
    },
    async (params) => {
      assertToolAccess(mcpTier, 'analyze_cross_border_tax');
      await trackToolUsage(apiKeyContext.keyId, 'analyze_cross_border_tax');

      try {
        const dealValue = params.dealValue_M ?? params.peakSalesMedian * 3;
        const royaltyRate = params.royaltyRate ?? 0.10;

        const result = computeTaxStructureImpact(
          params.territory as TaxTerritory,
          dealValue,
          royaltyRate,
          params.dealType as TaxDealType,
          params.peakSalesMedian,
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              effectiveTaxRate: result.effectiveTaxRate,
              taxSavings_M: result.taxSavings_M,
              optimalStructure: result.optimalStructure,
              witholdingTaxImpact_M: result.witholdingTaxImpact_M,
              transferPricingRisk: result.transferPricingRisk,
              pillarTwoImpact: result.pillarTwoImpact,
              structureBreakdown: result.structureBreakdown,
              narrative: result.narrative,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error analyzing cross-border tax: ${err instanceof Error ? err.message : 'Tax analysis failed'}. Verify territory and deal type are valid.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 19: score_pharma_intent
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'score_pharma_intent',
    'Look up a specific company\'s Pharma Intent Score — the counterparty premium multiplier, confidence level, and TA-specific deal activity. Queries the counterparty_premiums database for historical acquisition premium data. Use to understand how much a specific buyer typically pays above market.',
    {
      companyName: z.string().describe('Company name to look up (e.g., "Pfizer", "AbbVie", "Roche")'),
      therapeuticArea: therapeuticAreaEnum.optional().describe('Filter TA-specific premium data'),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'score_pharma_intent');

      try {
        const supabase = createServiceClient();

        // Query counterparty_premiums for this company
        const { data: premiumRows } = await supabase
          .from('counterparty_premiums')
          .select('*')
          .ilike('company_name', `%${params.companyName}%`)
          .limit(5);

        if (!premiumRows || premiumRows.length === 0) {
          // Fall back to static BUYER_PREMIUMS_RESOURCE
          const staticMatch = BUYER_PREMIUMS_RESOURCE.find(
            (b) => b.company.toLowerCase().includes(params.companyName.toLowerCase()),
          );
          if (staticMatch) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  companyName: staticMatch.company,
                  premiumMultiplier: staticMatch.premium,
                  confidence: staticMatch.confidence,
                  topTherapeuticAreas: staticMatch.topTAs,
                  source: 'static_reference',
                  note: 'Data from curated buyer premium reference. Real-time database entry not found.',
                  _meta: getResponseMeta(),
                }, null, 2),
              }],
            };
          }
          return {
            content: [{ type: 'text' as const, text: `No pharma intent data found for "${params.companyName}". Try an exact company name (e.g., "Pfizer", "AbbVie", "Roche"). Use the buyer-premiums resource for the full list of tracked companies.` }],
          };
        }

        const primary = premiumRows[0];
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              companyName: primary.company_name,
              premiumMultiplier: Number(primary.premium_multiplier),
              confidence: primary.confidence ?? 'medium',
              dealHistoryCount: primary.deal_count ?? null,
              taBreakdown: primary.ta_breakdown ?? null,
              phaseBreakdown: primary.phase_breakdown ?? null,
              lastUpdated: primary.updated_at ?? null,
              source: 'counterparty_premiums_db',
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error scoring pharma intent: ${err instanceof Error ? err.message : 'Intent scoring failed'}. Verify company name is a known pharma/biotech company.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 20: sequence_indications
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'sequence_indications',
    'Franchise expansion modeling with cannibalization analysis. Determines the optimal sequence for expanding a drug into additional indications beyond the primary, accounting for development lag, probability of success, cannibalization between indications, and incremental franchise value.',
    {
      therapeuticArea: therapeuticAreaEnum,
      indication: z.string().describe('Primary indication key'),
      modality: modalityEnum,
      primaryPeakSales_M: z.number().positive().describe('Peak annual sales estimate for primary indication in $M'),
    },
    async (params) => {
      assertToolAccess(mcpTier, 'sequence_indications');
      await trackToolUsage(apiKeyContext.keyId, 'sequence_indications');

      try {
        const result = computeIndicationSequence(
          params.therapeuticArea,
          params.indication,
          params.modality,
          params.primaryPeakSales_M,
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              expansionSequence: result.expansionSequence.map((step) => ({
                indication: step.indication,
                lineOfTherapy: step.lineOfTherapy,
                probability: step.probability,
                lag_years: step.lag_years,
                incrementalPeakSales_M: step.incrementalPeakSales_M,
                cannibalization_pct: step.cannibalization_pct,
                sequenceOrder: step.sequenceOrder,
              })),
              totalFranchiseValue_M: result.totalFranchiseValue_M,
              franchisePremium_pct: result.franchisePremium_pct,
              optimalSequencing: result.optimalSequencing,
              narrative: result.narrative,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error sequencing indications: ${err instanceof Error ? err.message : 'Indication sequencing failed'}. Verify therapeutic area and indication have expansion templates defined.` }],
          isError: true,
        };
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────
  // Tool 21: analyze_buyer_synergy
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'analyze_buyer_synergy',
    'Buyer-specific synergy analysis for a pharmaceutical acquisition or licensing deal. Evaluates cost synergies (manufacturing, R&D, SGA), revenue synergies (commercial infrastructure, geographic coverage), integration risk, and total premium uplift. Uses detailed buyer profiles for 10 major pharma companies.',
    {
      therapeuticArea: therapeuticAreaEnum,
      modality: modalityEnum,
      phase: phaseEnum,
      companyName: z.string().describe('Buyer company name (e.g., "Pfizer", "Roche", "Novartis"). 10 major pharma profiles available: Pfizer, Roche, Eli Lilly, Novartis, AbbVie, Merck, J&J, AstraZeneca, BMS, GSK.'),
      indication: z.string().optional().describe('Specific indication key for tighter synergy analysis.'),
      projectedPeakSales_M: z.number().positive().optional().describe('Projected peak sales in $M. Defaults to 1000.'),
      numberOfBidders: z.number().min(1).max(10).optional().describe('Number of competing bidders (affects auction premium). Defaults to 1.'),
    },
    async (params) => {
      assertToolAccess(mcpTier, 'analyze_buyer_synergy');
      await trackToolUsage(apiKeyContext.keyId, 'analyze_buyer_synergy');

      try {
        // Map company name to BUYER_PROFILES key
        const profileKey = Object.keys(BUYER_PROFILES).find(
          (k) => BUYER_PROFILES[k].name.toLowerCase().includes(params.companyName.toLowerCase()),
        );

        if (!profileKey) {
          return {
            content: [{ type: 'text' as const, text: `Buyer profile not found for "${params.companyName}". Available profiles: ${Object.values(BUYER_PROFILES).map((p) => p.name).join(', ')}. Use one of these company names for detailed synergy analysis.` }],
          };
        }

        const buyerProfile = BUYER_PROFILES[profileKey];

        // Map MCP modality enum to buyer-synergy ModalityKey
        const modalityMapping: Record<string, ModalityKey> = {
          smallMolecule: 'small_molecule', mab: 'mab', adc: 'adc', bispecific: 'bispecific',
          geneTherapy: 'gene_therapy', cellTherapy: 'cell_therapy', carT_heme: 'cell_therapy',
          carT_solid: 'cell_therapy', carT_autoimmune: 'cell_therapy', mrna: 'mrna',
          peptide: 'peptide', rnai: 'oligonucleotide', aso: 'oligonucleotide',
          oligonucleotide: 'oligonucleotide', protac: 'small_molecule',
          molecularGlue: 'small_molecule', therapeuticVaccine: 'vaccine',
          vaccinePreventive: 'vaccine', radiopharmaceutical: 'small_molecule',
        };

        // Map MCP TA enum to buyer-synergy TherapeuticAreaKey
        const taMapping: Record<string, TherapeuticAreaKey> = {
          oncology: 'oncology', neurology: 'neurology', immunology: 'immunology',
          metabolic: 'metabolic', cardiovascular: 'cardiovascular',
          infectiousDisease: 'infectious_disease', rareDisease: 'rare_disease',
          hematology: 'hematology', ophthalmology: 'ophthalmology',
          dermatology: 'dermatology', gastroenterology: 'gastroenterology',
          womensHealth: 'endocrinology',
        };

        const assetProfile: AssetSynergyProfile = {
          assetName: params.indication ?? 'unnamed asset',
          therapeuticArea: taMapping[params.therapeuticArea] ?? 'oncology',
          modality: modalityMapping[params.modality] ?? 'small_molecule',
          indication: params.indication ?? '',
          projectedPeakSales_M: params.projectedPeakSales_M ?? 1000,
          annualRDCost_M: 50, // Default estimate
          filingGeographies: ['us', 'eu'] as GeographyKey[],
          mechanism: params.indication ?? 'undisclosed',
          phase: params.phase,
          requiresCompanionDx: false,
          numberOfBidders: params.numberOfBidders ?? 1,
          attractiveness: 7,
        };

        const result = computeBuyerSynergy(buyerProfile, assetProfile);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              buyer: buyerProfile.name,
              totalSynergyPremium_pct: result.totalSynergyPremium_pct,
              revenueSynergies_M: result.revenueSynergies_M,
              costSynergies_M: result.costSynergies_M,
              timeToRealizeSynergies_years: result.timeToRealizeSynergies_years,
              integrationRisk: result.integrationRisk,
              synergySources: JSON.parse(JSON.stringify(result.synergySources)),
              narrative: result.narrative,
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error analyzing buyer synergy: ${err instanceof Error ? err.message : 'Buyer synergy analysis failed'}. Verify company name matches an available buyer profile.` }],
          isError: true,
        };
      }
    },
  );

  // ── Tool 22: Natural Language Deal Query ────────────────────────────
  server.tool(
    'query_deal_database',
    'Natural language query against the biopharma deal database. Ask any question in plain English about deal economics, company activity, trends, comparisons, or specific transactions. Returns a data-backed answer with supporting deal data. Examples: "What is the largest ADC deal?", "How have oncology upfronts trended?", "Which pharma is most active in gene therapy?"',
    {
      question: z.string().min(5).max(500).describe('Natural language question about biopharma deals. Be specific for best results.'),
    },
    async (params) => {
      assertToolAccess(mcpTier, 'query_deal_database');
      await trackToolUsage(apiKeyContext.keyId, 'query_deal_database');

      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

        const anthropic = new Anthropic({ apiKey });
        const supabase = createServiceClient();

        // Schema for SQL generation
        const schema = `Table: deals. Key columns: licensor_name, licensee_name, asset_name, modality, indication_category, indication_specific, therapeutic_area, target, mechanism_of_action, phase_at_signing (preclinical/phase_1/phase_2/phase_3/approved), territory, deal_type (license/acquisition/collaboration/co_development/option), upfront_usd (raw USD), milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, terms_disclosed, is_synthetic. All USD in raw dollars (not millions). Always filter is_synthetic = false. LIMIT 50.`;

        const sqlResponse = await anthropic.messages.create({
          model: 'claude-opus-4-6-20250610',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Generate a PostgreSQL SELECT query for: "${params.question}"\n\nSchema: ${schema}\n\nRespond with ONLY JSON: {"sql": "SELECT...", "query_type": "ranking|trend|comparison|aggregation|single_deal|company_activity"}`,
          }],
        });

        const sqlText = sqlResponse.content[0].type === 'text' ? sqlResponse.content[0].text : '';
        const parsed = JSON.parse(sqlText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

        // Validate SQL safety
        const upper = parsed.sql.toUpperCase();
        if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) throw new Error('Only SELECT allowed');
        if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/.test(upper)) throw new Error('Mutations not allowed');

        // Execute
        const { data, error } = await supabase.rpc('execute_readonly_query', { query_text: parsed.sql });
        if (error) throw new Error(`Query failed: ${error.message}`);

        const results = (data as Record<string, unknown>[]) || [];

        // Synthesize answer
        const answerResponse = await anthropic.messages.create({
          model: 'claude-opus-4-6-20250610',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: `Answer this biopharma deal question: "${params.question}"\n\nQuery results (${results.length} deals): ${JSON.stringify(results.slice(0, 30))}\n\nBe specific with dollar amounts (convert raw USD to $M/$B), company names, and dates. USD values are in raw dollars.`,
          }],
        });

        const answer = answerResponse.content[0].type === 'text' ? answerResponse.content[0].text : '';

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              answer,
              deal_count: results.length,
              query_type: parsed.query_type,
              data: results.slice(0, 20),
              _meta: getResponseMeta(),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error querying deal database: ${err instanceof Error ? err.message : 'Query failed'}. Try rephrasing your question.` }],
          isError: true,
        };
      }
    },
  );

  // ═════════════════════════════════════════════════════════════════════
  // MCP Resources (read-only data for AI agents to browse)
  // ═════════════════════════════════════════════════════════════════════

  server.resource(
    'therapeutic-areas',
    'ambrosia://therapeutic-areas',
    { description: 'List of 12 therapeutic areas with deal volume and top modalities. Use to understand available TAs and select valid keys for tool calls.', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'ambrosia://therapeutic-areas',
        text: JSON.stringify(TA_RESOURCE, null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  server.resource(
    'modalities',
    'ambrosia://modalities',
    { description: 'Modalities grouped by therapeutic area with valuation multiplier data. Use to select valid modality keys and understand relative value premiums.', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'ambrosia://modalities',
        text: JSON.stringify(MODALITY_RESOURCE, null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  server.resource(
    'territories',
    'ambrosia://territories',
    { description: 'List of 15 territories with revenue weights and applicable regulatory agencies. Use to understand territory value and agency coverage.', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'ambrosia://territories',
        text: JSON.stringify(TERRITORY_RESOURCE, null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  server.resource(
    'buyer-premiums',
    'ambrosia://buyer-premiums',
    { description: 'Top 15 pharma/biotech buyers with historical deal premium multipliers and confidence levels. Use to identify high-premium buyers and inform negotiation strategy.', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'ambrosia://buyer-premiums',
        text: JSON.stringify(BUYER_PREMIUMS_RESOURCE, null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  server.resource(
    'differentiation-factors',
    'ambrosia://differentiation-factors',
    { description: 'The 6 asset differentiation factors with base valuation adjustments and preclinical scaling. Use to understand how differentiation impacts deal terms.', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'ambrosia://differentiation-factors',
        text: JSON.stringify(DIFFERENTIATION_RESOURCE, null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  server.resource(
    'deal-types',
    'ambrosia://deal-types',
    { description: 'The 5 deal structure types with typical upfront ratios, descriptions, and guidance on when to use each. Licensing, Acquisition, Co-development, Option, Collaboration.', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'ambrosia://deal-types',
        text: JSON.stringify(DEAL_TYPES_RESOURCE, null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  server.resource(
    'competitive-positions',
    'ambrosia://competitive-positions',
    { description: 'The 6 competitive positions with valuation multipliers and descriptions. firstInClass (1.25x) through crowded (0.80x).', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'ambrosia://competitive-positions',
        text: JSON.stringify(COMPETITIVE_POSITIONS_RESOURCE, null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  server.resource(
    'regulatory-agencies',
    'ambrosia://regulatory-agencies',
    { description: 'The 7 major regulatory agencies (FDA, EMA, PMDA, NMPA, TGA, Health Canada, Swissmedic) with review timelines, rejection rates, and key designations.', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'ambrosia://regulatory-agencies',
        text: JSON.stringify(REGULATORY_AGENCIES_RESOURCE, null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  server.resource(
    'phases',
    'ambrosia://phases',
    { description: 'The 9 drug development phases from discovery through approved, with probability-of-success ranges and typical deal value ranges.', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'ambrosia://phases',
        text: JSON.stringify(PHASES_RESOURCE, null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  server.resource(
    'engine-capabilities',
    'ambrosia://engine-capabilities',
    { description: 'Complete list of all 22 MCP tools with descriptions and what each computes. Use to understand the full analytical surface area available.', mimeType: 'application/json' },
    async () => ({
      contents: [{
        uri: 'ambrosia://engine-capabilities',
        text: JSON.stringify([
          { name: 'calculate_deal_terms', category: 'Core Valuation', description: `Calculate deal terms (upfront, milestones, royalties) calibrated against ${DEAL_STATS.TOTAL_DEALS} real transactions.` },
          { name: 'run_rnpv_model', category: 'Core Valuation', description: 'Risk-adjusted NPV with 10,000-iteration Monte Carlo simulation. P10/P50/P90, cash flows, driver sensitivity.' },
          { name: 'optimize_deal_structure', category: 'Core Valuation', description: 'Rank all 5 deal structures by total value to licensor with component breakdown.' },
          { name: 'match_partners', category: 'Intelligence', description: 'Find best-fit partners from 850+ companies scored across 9 dimensions with Pharma Intent signals.' },
          { name: 'compute_negotiation_zopa', category: 'Negotiation', description: 'Zone of Possible Agreement for 1-3 buyers with counterparty premiums and BATNA-anchored positions.' },
          { name: 'get_regulatory_risk', category: 'Regulatory', description: 'Global regulatory risk across 7 agencies with rejection probability, review timelines, and designation impacts.' },
          { name: 'get_comparable_deals', category: 'Intelligence', description: 'Find comparable transactions from 280+ curated deals using hedonic regression scoring.' },
          { name: 'get_market_intelligence', category: 'Intelligence', description: 'Upcoming Phase 3 readouts and FDA AdComm calendar for near-term catalysts.' },
          { name: 'run_scenario_comparison', category: 'Financial Modeling', description: 'Bear/Base/Bull scenario comparison with probability-weighted expected value.' },
          { name: 'analyze_lifecycle_extensions', category: 'Financial Modeling', description: 'Label expansion, pediatric exclusivity, combination approval opportunities and franchise premium.' },
          { name: 'model_competitive_dynamics', category: 'Financial Modeling', description: 'Year-by-year competitive revenue erosion, generic entry timing, biosimilar share impact.' },
          { name: 'value_real_options', category: 'Financial Modeling', description: 'CRR binomial lattice compound option valuation with flexibility premium over static rNPV.' },
          { name: 'run_defensive_analysis', category: 'Financial Modeling', description: 'Worst/best case scenarios with walk-away thresholds and defensive floor.' },
          { name: 'analyze_royalty_stacking', category: 'Deal Structure', description: 'Upstream IP obligations and net royalty impact with anti-stacking provisions.' },
          { name: 'model_patent_dynamics', category: 'Deal Structure', description: 'Patent term adjustments, LOE erosion curves, generic entry profiles, Paragraph IV risk.' },
          { name: 'assess_cmc_risk', category: 'Deal Structure', description: 'Manufacturing timeline delay, cost multiplier, supply chain risk, scalability score.' },
          { name: 'value_earnout_cvr', category: 'Deal Structure', description: 'Contingent value rights and earnout time-value analysis with probability-weighted PV.' },
          { name: 'analyze_cross_border_tax', category: 'Deal Structure', description: 'Territory-specific tax structuring, withholding impact, optimal IP holding structure.' },
          { name: 'score_pharma_intent', category: 'Intelligence', description: 'Company-specific Pharma Intent Score with counterparty premium multiplier and TA breakdown.' },
          { name: 'sequence_indications', category: 'Intelligence', description: 'Franchise expansion modeling with cannibalization analysis and optimal sequencing.' },
          { name: 'analyze_buyer_synergy', category: 'Intelligence', description: 'Buyer-specific cost and revenue synergies, integration risk, total premium uplift.' },
          { name: 'query_deal_database', category: 'Intelligence', description: 'Natural language query against the full deal database. Ask any question in plain English and get a data-backed answer.' },
        ], null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  // ═════════════════════════════════════════════════════════════════════
  // MCP Prompts (pre-built templates for common workflows)
  // ═════════════════════════════════════════════════════════════════════

  server.prompt(
    'deal_benchmark',
    'Generate a comprehensive deal benchmark for a pharmaceutical asset',
    {
      asset_description: z.string().describe('Describe the asset (e.g., "Phase 2 ADC for HER2+ breast cancer")'),
      territory: z.string().optional().describe('Target territory (e.g., "global", "us_only", "europe")'),
    },
    async (params) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are an institutional-grade biopharma deal advisor. Using the Solidus MCP tools, generate a comprehensive deal benchmark for: ${params.asset_description}

Steps:
1. Call calculate_deal_terms with the appropriate parameters
2. Call run_rnpv_model for risk-adjusted valuation
3. Call match_partners to identify potential buyers
4. Call get_regulatory_risk to assess regulatory pathway
5. Call get_comparable_deals for precedent transactions

Present the results as a structured deal memo with:
- Headline deal terms (upfront, milestones, royalties, total deal value)
- Risk-adjusted valuation (rNPV, Monte Carlo P10/P50/P90)
- Top 5 potential partners with intent scores
- Regulatory risk assessment per relevant agency
- 3-5 comparable transactions
- Deal structure recommendation (licensing vs co-dev vs option)

Territory: ${params.territory || 'global'}`,
        },
      }],
    }),
  );

  server.prompt(
    'partner_search',
    'Find and rank the best licensing partners for a pharmaceutical asset',
    {
      asset_description: z.string().describe('Describe the asset (e.g., "Phase 1 bispecific antibody for r/r DLBCL")'),
      deal_type: z.string().optional().describe('Preferred deal structure: licensing, acquisition, codevelopment, option, collaboration'),
      territory: z.string().optional().describe('Target territory (e.g., "global", "us_only", "ex_us")'),
    },
    async (params) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are a biopharma business development expert. Using the Solidus MCP tools, identify and rank the best licensing partners for: ${params.asset_description}

Steps:
1. Read the buyer-premiums resource to understand premium multipliers
2. Call match_partners with the appropriate TA, modality, and phase
3. For the top 5 matches, call compute_negotiation_zopa to estimate deal value with each buyer
4. Call get_comparable_deals to find precedent transactions with each potential partner

Present the results as a partner ranking with:
- Company name, match score, and strategic rationale
- Historical premium multiplier and recent deal activity
- Estimated deal value range (floor to ceiling) per partner
- Watch-outs and risks for each partnership
- Recommended outreach priority and sequencing strategy

Preferred deal type: ${params.deal_type || 'licensing'}
Territory: ${params.territory || 'global'}`,
        },
      }],
    }),
  );

  server.prompt(
    'negotiation_prep',
    'Prepare a negotiation strategy for a pharmaceutical deal with specific buyers',
    {
      asset_description: z.string().describe('Describe the asset (e.g., "Phase 2b oral PCSK9 inhibitor for hyperlipidemia")'),
      buyers: z.string().describe('Comma-separated buyer names (e.g., "Pfizer, AbbVie, Novartis")'),
      batna_upfront_m: z.string().optional().describe('Walk-away upfront amount in $M (e.g., "50")'),
    },
    async (params) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are a senior biopharma deal negotiation strategist. Using the Solidus MCP tools, prepare a comprehensive negotiation strategy for: ${params.asset_description}

Target buyers: ${params.buyers}

Steps:
1. Call calculate_deal_terms to establish baseline deal terms
2. Call run_rnpv_model for the asset's risk-adjusted valuation
3. Call optimize_deal_structure to rank deal structures by licensor value
4. Call compute_negotiation_zopa with the specified buyers and BATNA
5. Read the buyer-premiums resource for historical premium context
6. Call get_comparable_deals to identify precedent transactions
7. Call get_regulatory_risk to understand regulatory timeline risks

Present the results as a negotiation preparation brief:
- Base case valuation and recommended deal structure
- Per-buyer ZOPA analysis with floor, ceiling, and opening position
- Premium/discount rationale for each buyer based on strategic fit
- Key negotiation levers (milestones, royalties, territory splits, opt-ins)
- Risk factors that could shift buyer willingness to pay
- Recommended negotiation sequencing (which buyer to approach first)
- Comparable transactions to cite during negotiations

BATNA upfront: $${params.batna_upfront_m || '0'}M`,
        },
      }],
    }),
  );

  server.prompt(
    'full_deal_analysis',
    'Run every available analysis for a pharmaceutical asset and produce a comprehensive investment committee memo',
    {
      asset_description: z.string().describe('Describe the asset (e.g., "Phase 2 ADC for HER2+ breast cancer with $1.5B peak sales")'),
      territory: z.string().optional().describe('Target territory (e.g., "global", "us_only")'),
      buyers: z.string().optional().describe('Comma-separated potential buyer names for synergy analysis (e.g., "Pfizer, Roche, AstraZeneca")'),
    },
    async (params) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are a senior biopharma investment analyst. Using ALL available Solidus MCP tools, produce a comprehensive Investment Committee memo for: ${params.asset_description}

Run the following analyses in logical order:
1. calculate_deal_terms — baseline deal structure
2. run_rnpv_model — risk-adjusted valuation with Monte Carlo
3. run_scenario_comparison — Bear/Base/Bull scenario analysis
4. get_comparable_deals — precedent transactions
5. match_partners — top potential acquirers/licensees
6. get_regulatory_risk — regulatory pathway and risk
7. model_competitive_dynamics — competitive erosion schedule
8. analyze_lifecycle_extensions — franchise expansion opportunities
9. value_real_options — option value from staged development
10. run_defensive_analysis — worst-case floor and walk-away threshold
${params.buyers ? `11. analyze_buyer_synergy — synergy analysis for ${params.buyers}` : ''}

Structure the output as an IC memo:
- **Executive Summary**: 3-5 bullet headline findings
- **Valuation Range**: rNPV, Monte Carlo P10/P50/P90, scenario-weighted EV
- **Deal Structure**: Recommended structure with terms breakdown
- **Competitive Position**: Pipeline competition and erosion timeline
- **Regulatory Path**: Agency-by-agency risk assessment
- **Franchise Potential**: Lifecycle extensions and indication sequencing
- **Real Options Value**: Flexibility premium over static rNPV
- **Risk Analysis**: Defensive floor, walk-away threshold, key risks
- **Partner Rankings**: Top 5 potential partners with strategic rationale
- **Comparable Transactions**: 3-5 most relevant precedent deals
- **Recommendation**: Clear invest/pass recommendation with conditions

Territory: ${params.territory || 'global'}`,
        },
      }],
    }),
  );

  server.prompt(
    'competitive_landscape',
    'Analyze the competitive landscape for a therapeutic indication including pipeline competitors, deal flow, and pricing dynamics',
    {
      indication: z.string().describe('The indication to analyze (e.g., "NSCLC", "Alzheimer\'s disease", "atopic dermatitis")'),
      therapeutic_area: z.string().optional().describe('Therapeutic area (e.g., "oncology", "neurology")'),
      modality: z.string().optional().describe('Modality of interest (e.g., "adc", "mab", "bispecific")'),
    },
    async (params) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are a biopharma competitive intelligence analyst. Using the Solidus MCP tools, produce a comprehensive competitive landscape analysis for: ${params.indication}

Steps:
1. Call get_market_intelligence for ${params.therapeutic_area || 'the relevant therapeutic area'} to identify upcoming readouts and AdComm meetings
2. Call model_competitive_dynamics to project revenue erosion from pipeline competition
3. Call get_comparable_deals to analyze recent deal activity in this space
4. Call sequence_indications to understand franchise expansion patterns

Present the results as a competitive landscape report:
- **Pipeline Overview**: Key competitors by phase and expected readout dates
- **Competitive Dynamics**: Year-by-year market share and pricing erosion projections
- **Deal Activity**: Recent comparable transactions with terms and valuations
- **Market Sizing**: Current and projected market size with growth drivers
- **Franchise Potential**: Common indication expansion patterns and cannibalization
- **Key Catalysts**: Near-term events that could shift competitive dynamics
- **Strategic Implications**: What this means for new entrants and existing players

${params.therapeutic_area ? `Therapeutic area: ${params.therapeutic_area}` : ''}
${params.modality ? `Modality focus: ${params.modality}` : ''}`,
        },
      }],
    }),
  );

  server.prompt(
    'ip_and_regulatory_strategy',
    'Assess the IP and regulatory strategy for a pharmaceutical asset across territories',
    {
      asset_description: z.string().describe('Describe the asset (e.g., "Phase 2 gene therapy for SMA")'),
      territories: z.string().optional().describe('Comma-separated target territories (e.g., "us_only, europe, japan")'),
    },
    async (params) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are a biopharma regulatory and IP strategy advisor. Using the Solidus MCP tools, produce a comprehensive IP and regulatory strategy assessment for: ${params.asset_description}

Steps:
1. Call get_regulatory_risk to assess regulatory pathway across target territories
2. Call model_patent_dynamics to analyze patent term, exclusivity periods, and LOE erosion
3. Call assess_cmc_risk to evaluate manufacturing complexity and timeline risks
4. Call analyze_cross_border_tax for each target territory to assess tax structuring implications
5. Read the regulatory-agencies resource for agency-specific context

Present the results as an IP & Regulatory Strategy memo:
- **Regulatory Pathway**: Per-agency review timelines, designation impacts, rejection risks
- **Patent Landscape**: Effective patent life, exclusivity periods (orphan, pediatric, NCE/biologic)
- **LOE Erosion**: Generic/biosimilar entry profile and revenue impact post-LOE
- **Paragraph IV Risk**: Probability and impact of generic challenge
- **CMC Considerations**: Manufacturing complexity, supply chain risk, scalability
- **Tax Structure**: Optimal IP holding structure by territory, withholding tax, Pillar Two
- **Timeline**: Integrated development-to-commercialization timeline with regulatory milestones
- **Risk Mitigation**: Key risks and recommended mitigation strategies

Target territories: ${params.territories || 'global (all major markets)'}`,
        },
      }],
    }),
  );

  server.prompt(
    'deal_structure_optimizer',
    'Find the optimal deal structure for a pharmaceutical asset considering specific buyers',
    {
      asset_description: z.string().describe('Describe the asset (e.g., "Phase 3 bispecific antibody for r/r DLBCL with $2B peak sales")'),
      buyers: z.string().describe('Comma-separated buyer company names (e.g., "Roche, AbbVie, J&J")'),
      batna_upfront_m: z.string().optional().describe('Walk-away upfront amount in $M (e.g., "100")'),
    },
    async (params) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `You are a senior biopharma deal structuring advisor. Using the Solidus MCP tools, find the optimal deal structure for: ${params.asset_description}

Target buyers: ${params.buyers}

Steps:
1. Call optimize_deal_structure to rank all 5 deal types by licensor value
2. Call compute_negotiation_zopa with the specified buyers to establish deal ranges
3. Call analyze_royalty_stacking to assess net royalty impact from upstream IP
4. Call value_earnout_cvr to value contingent payments and milestone tranches
5. Call analyze_buyer_synergy for each buyer to quantify synergy premiums
6. Call score_pharma_intent for each buyer to understand historical premium behavior
7. Call get_comparable_deals for relevant precedent transactions

Present the results as a Deal Structure Optimization report:
- **Recommended Structure**: Best deal type with rationale (licensing vs acquisition vs co-dev vs option)
- **Per-Buyer Analysis**: For each buyer:
  - ZOPA range (floor to ceiling)
  - Synergy premium and sources
  - Historical premium multiplier
  - Recommended opening position and fallback
- **Royalty Structure**: Gross vs net royalty after upstream IP stacking
- **Milestone Schedule**: Probability-weighted PV of each milestone tranche
- **Tax Optimization**: Territory-specific structuring considerations
- **Comparable Deals**: 3-5 precedent transactions to anchor negotiations
- **Sequencing Strategy**: Which buyer to approach first and why
- **Risk Factors**: Key deal-breakers and mitigation strategies

BATNA upfront: $${params.batna_upfront_m || '0'}M`,
        },
      }],
    }),
  );

  return server;
}

// ═════════════════════════════════════════════════════════════════════════
// HTTP Handlers
// ═════════════════════════════════════════════════════════════════════════

/**
 * POST /api/mcp — MCP JSON-RPC over HTTP
 *
 * Handles all MCP protocol messages (initialize, tools/list, tools/call)
 * via the StreamableHTTPServerTransport.
 */
export async function POST(request: NextRequest) {
  // ── Auth gate ──
  const authResult = await authenticateRequest(request);
  if ('error' in authResult) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32001, message: authResult.error }, id: null },
      { status: authResult.status },
    );
  }

  const { context: apiKeyContext, mcpTier } = authResult;

  // ── Build MCP server + transport ──
  const server = createMcpServerInstance(apiKeyContext, mcpTier);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless — no session persistence
  });

  // Connect the server to the transport
  await server.connect(transport);

  // ── Handle the request via the web-standard transport ──
  // WebStandardStreamableHTTPServerTransport accepts a web-standard Request
  // and returns a web-standard Response, which is exactly what Next.js
  // App Router provides and expects.
  const response = await transport.handleRequest(request);

  // Clean up after handling
  await transport.close();
  await server.close();

  return response;
}

/**
 * GET /api/mcp — Server discovery endpoint
 *
 * Returns MCP server capabilities, tool list, and usage instructions.
 * This is not part of the MCP protocol but provides a human/machine
 * readable discovery endpoint for integration.
 */
export async function GET() {
  return NextResponse.json({
    name: 'Solidus MCP Server',
    version: '3.0.0',
    protocol: 'mcp',
    transport: 'streamable-http',
    description: `Institutional-grade biopharma deal intelligence via the Model Context Protocol. 22 tools, 10 resources, and 7 prompt templates covering deal terms, rNPV/Monte Carlo valuation, scenario analysis, deal structure optimization, partner matching, negotiation ZOPA, regulatory risk, competitive dynamics, lifecycle extensions, real options, patent dynamics, CMC risk, royalty stacking, earnout/CVR valuation, cross-border tax, buyer synergy, indication sequencing, natural language deal queries, and market intelligence — calibrated against ${DEAL_STATS.TOTAL_DEALS} real transactions.`,
    contact: {
      name: 'Issa Kildani',
      email: 'ikildani@ambrosiaventures.co',
      url: 'https://ambrosiaventures.co',
    },
    auth: {
      type: 'bearer',
      prefix: 'ambk_',
      header: 'Authorization: Bearer ambk_<your_api_key>',
      tiers: ['portfolio'],
      note: 'Portfolio License only. Contact ikildani@ambrosiaventures.co for access.',
    },
    rateLimits: {
      pilot: '1,000 calls/month',
      growth: '10,000 calls/month',
      enterprise: '100,000 calls/month',
    },
    tools: [
      // ── Core Valuation (Tools 1-3) ──
      {
        name: 'calculate_deal_terms',
        category: 'Core Valuation',
        description: `Calculate pharmaceutical deal terms (upfront, milestones, royalties) calibrated against ${DEAL_STATS.TOTAL_DEALS} real transactions.`,
      },
      {
        name: 'run_rnpv_model',
        category: 'Core Valuation',
        description: 'Risk-adjusted NPV with 10,000-iteration Monte Carlo simulation. Returns P10/P50/P90, cash flows, driver sensitivity.',
      },
      {
        name: 'optimize_deal_structure',
        category: 'Core Valuation',
        description: 'Rank all 5 deal structures by total value to licensor with upfront/milestone/royalty breakdown.',
      },
      // ── Intelligence (Tools 4, 7-8, 19-21) ──
      {
        name: 'match_partners',
        category: 'Intelligence',
        description: 'Find best-fit partners from 850+ companies scored across 9 dimensions with Pharma Intent signals.',
      },
      {
        name: 'get_comparable_deals',
        category: 'Intelligence',
        description: 'Find comparable transactions from 280+ curated deals using hedonic regression scoring.',
      },
      {
        name: 'get_market_intelligence',
        category: 'Intelligence',
        description: 'Upcoming Phase 3 readouts (ClinicalTrials.gov) and FDA AdComm calendar for near-term catalysts.',
      },
      {
        name: 'score_pharma_intent',
        category: 'Intelligence',
        description: 'Company-specific Pharma Intent Score with counterparty premium multiplier, confidence, and TA breakdown.',
      },
      {
        name: 'sequence_indications',
        category: 'Intelligence',
        description: 'Franchise expansion modeling with cannibalization analysis and optimal indication sequencing.',
      },
      {
        name: 'analyze_buyer_synergy',
        category: 'Intelligence',
        description: 'Buyer-specific cost and revenue synergies, integration risk, and total premium uplift for 10 major pharma.',
      },
      // ── Negotiation (Tool 5) ──
      {
        name: 'compute_negotiation_zopa',
        category: 'Negotiation',
        description: 'Compute Zone of Possible Agreement for 1-3 buyers with counterparty premiums and BATNA-anchored positions.',
      },
      // ── Regulatory (Tool 6) ──
      {
        name: 'get_regulatory_risk',
        category: 'Regulatory',
        description: 'Global regulatory risk across 7 agencies (FDA, EMA, PMDA, NMPA, TGA, Health Canada, Swissmedic).',
      },
      // ── Financial Modeling (Tools 9-13) ──
      {
        name: 'run_scenario_comparison',
        category: 'Financial Modeling',
        description: 'Bear/Base/Bull scenario comparison with probability-weighted expected value.',
      },
      {
        name: 'analyze_lifecycle_extensions',
        category: 'Financial Modeling',
        description: 'Label expansion, pediatric exclusivity, combination approval opportunities and franchise premium.',
      },
      {
        name: 'model_competitive_dynamics',
        category: 'Financial Modeling',
        description: 'Year-by-year competitive revenue erosion, generic entry timing, biosimilar share impact.',
      },
      {
        name: 'value_real_options',
        category: 'Financial Modeling',
        description: 'CRR binomial lattice compound option valuation with flexibility premium over static rNPV.',
      },
      {
        name: 'run_defensive_analysis',
        category: 'Financial Modeling',
        description: 'Worst/best case scenarios with walk-away thresholds and defensive floor.',
      },
      // ── Deal Structure (Tools 14-18) ──
      {
        name: 'analyze_royalty_stacking',
        category: 'Deal Structure',
        description: 'Upstream IP obligations and net royalty impact with anti-stacking provisions.',
      },
      {
        name: 'model_patent_dynamics',
        category: 'Deal Structure',
        description: 'Patent term adjustments, LOE erosion curves, generic entry profiles, Paragraph IV risk.',
      },
      {
        name: 'assess_cmc_risk',
        category: 'Deal Structure',
        description: 'Manufacturing timeline delay, cost multiplier, supply chain risk, scalability score.',
      },
      {
        name: 'value_earnout_cvr',
        category: 'Deal Structure',
        description: 'Contingent value rights and earnout time-value analysis with probability-weighted PV.',
      },
      {
        name: 'analyze_cross_border_tax',
        category: 'Deal Structure',
        description: 'Territory-specific tax structuring, withholding impact, optimal IP holding structure.',
      },
      {
        name: 'query_deal_database',
        category: 'Intelligence',
        description: 'Natural language query against 1,500+ deals. Ask any question and get a data-backed answer with supporting deal data.',
      },
    ],
    resources: [
      {
        name: 'therapeutic-areas',
        uri: 'ambrosia://therapeutic-areas',
        description: 'List of 12 therapeutic areas with deal volume and top modalities.',
      },
      {
        name: 'modalities',
        uri: 'ambrosia://modalities',
        description: 'Modalities grouped by TA with valuation multiplier data.',
      },
      {
        name: 'territories',
        uri: 'ambrosia://territories',
        description: '15 territories with revenue weights and applicable regulatory agencies.',
      },
      {
        name: 'buyer-premiums',
        uri: 'ambrosia://buyer-premiums',
        description: 'Top 15 pharma/biotech buyers with historical deal premium multipliers.',
      },
      {
        name: 'differentiation-factors',
        uri: 'ambrosia://differentiation-factors',
        description: '6 asset differentiation factors with base adjustments and phase scaling.',
      },
      {
        name: 'deal-types',
        uri: 'ambrosia://deal-types',
        description: '5 deal structure types with typical upfront ratios and usage guidance.',
      },
      {
        name: 'competitive-positions',
        uri: 'ambrosia://competitive-positions',
        description: '6 competitive positions with valuation multipliers (1.25x firstInClass to 0.80x crowded).',
      },
      {
        name: 'regulatory-agencies',
        uri: 'ambrosia://regulatory-agencies',
        description: '7 major regulatory agencies with review timelines, rejection rates, and key designations.',
      },
      {
        name: 'phases',
        uri: 'ambrosia://phases',
        description: '9 development phases from discovery to approved with PoS ranges and typical deal values.',
      },
      {
        name: 'engine-capabilities',
        uri: 'ambrosia://engine-capabilities',
        description: 'Complete list of all 21 MCP tools with descriptions and categories.',
      },
    ],
    prompts: [
      {
        name: 'deal_benchmark',
        description: 'Generate a comprehensive deal benchmark for a pharmaceutical asset. Orchestrates 5 tools into a structured deal memo.',
      },
      {
        name: 'partner_search',
        description: 'Find and rank the best licensing partners for an asset. Combines partner matching with ZOPA analysis and comparable deals.',
      },
      {
        name: 'negotiation_prep',
        description: 'Prepare a negotiation strategy for specific buyers. Includes ZOPA, deal structure optimization, and precedent transactions.',
      },
      {
        name: 'full_deal_analysis',
        description: 'Complete IC memo using ALL 22 tools. Produces executive summary, valuation range, competitive position, regulatory path, franchise potential, real options, risk analysis, and partner rankings.',
      },
      {
        name: 'competitive_landscape',
        description: 'Competitive landscape analysis for an indication. Orchestrates market intelligence, competitive dynamics, comparable deals, and indication sequencing.',
      },
      {
        name: 'ip_and_regulatory_strategy',
        description: 'IP and regulatory strategy assessment across territories. Combines regulatory risk, patent dynamics, CMC risk, and cross-border tax analysis.',
      },
      {
        name: 'deal_structure_optimizer',
        description: 'Find optimal deal structure for specific buyers. Combines deal optimization, ZOPA, royalty stacking, earnout valuation, and buyer synergy.',
      },
    ],
    endpoint: 'POST /api/mcp',
    documentation: 'https://solidus.ambrosiaventures.co/docs/api/mcp',
  });
}

/**
 * DELETE /api/mcp — Session cleanup (required by MCP spec for completeness)
 *
 * Since we use stateless transport (no session persistence), this is a no-op
 * that returns 200 to satisfy compliant MCP clients.
 */
export async function DELETE() {
  return new NextResponse(null, { status: 200 });
}
