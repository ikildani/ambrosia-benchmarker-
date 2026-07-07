/**
 * MCP Server — Ambrosia Benchmarker
 *
 * Exposes 8 institutional-grade tools over the Model Context Protocol (MCP)
 * using the Streamable HTTP transport. Each tool wraps one of the core
 * calculation engines that power calculator.ambrosiaventures.co.
 *
 * Auth: Enterprise API keys only (Pro + Portfolio tiers).
 * Rate limits: pilot 1K/mo, growth 10K/mo, enterprise 100K/mo.
 *
 * Transport: JSON-RPC over HTTP (POST). GET returns server capabilities.
 *
 * @module app/api/mcp/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

import { validateApiKey, type ApiKeyContext } from '@/lib/api-v1-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { currentPeriodMonth } from '@/lib/enterprise-api';

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

export const maxDuration = 60;

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
): Promise<{ context: ApiKeyContext } | { error: string; status: number }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ambk_')) {
    return { error: 'API key required. Use Authorization: Bearer ambk_<your_key>', status: 401 };
  }

  const context = await validateApiKey(request);
  if (!context) {
    return { error: 'Invalid, expired, or rate-limited API key', status: 401 };
  }

  // Tier gate: Portfolio License only — MCP is an enterprise feature
  if (context.tier !== 'portfolio') {
    return {
      error: 'MCP access requires a Portfolio License. Contact ikildani@ambrosiaventures.co for access.',
      status: 403,
    };
  }

  return { context };
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
// MCP Server Factory
// ═════════════════════════════════════════════════════════════════════════

/**
 * Build a fresh McpServer instance with all 8 tools registered.
 *
 * The API key context is threaded through so each tool can track usage
 * against the caller's quota. A new server is created per request
 * because the StreamableHTTPServerTransport is stateless (no session).
 */
function createMcpServerInstance(apiKeyContext: ApiKeyContext): McpServer {
  const server = new McpServer({
    name: 'Ambrosia Benchmarker',
    version: '1.0.0',
  });

  // ─────────────────────────────────────────────────────────────────────
  // Tool 1: calculate_deal_terms
  // ─────────────────────────────────────────────────────────────────────
  server.tool(
    'calculate_deal_terms',
    'Calculate pharmaceutical deal terms (upfront payment, milestones, royalties) for a drug asset based on therapeutic area, development phase, modality, indication, and competitive position. Returns institutional-grade deal structure recommendations calibrated against 2,500+ real transactions.',
    {
      therapeuticArea: therapeuticAreaEnum,
      phase: phaseEnum,
      modality: modalityEnum,
      indication: z.string().describe('Specific indication key (e.g., "lung_nsclc", "alzheimers", "rheumatoidArthritis"). See the full indication list per therapeutic area.'),
      territory: territoryEnum,
      competitivePosition: competitivePositionEnum,
      dealType: dealTypeEnum.optional().describe('Deal structure type. Defaults to licensing.'),
      peakSalesMedian: z.number().positive().optional().describe('Peak annual sales estimate in $M. If omitted, the engine uses indication-based defaults.'),
      differentiationFactors: z.array(z.string()).optional().describe('Asset differentiation factors: "novelMechanism", "superiorEfficacy", "betterSafety", "convenientDosing", "biomarkerSelected"'),
    },
    async (params) => {
      await trackToolUsage(apiKeyContext.keyId, 'calculate_deal_terms');

      const input: CalculationInput = {
        therapeuticArea: params.therapeuticArea as TherapeuticArea,
        phase: params.phase as Phase,
        modality: params.modality as Modality,
        indication: params.indication as Indication,
        territory: params.territory as Territory,
        competitivePosition: params.competitivePosition as CompetitivePosition,
        dealType: (params.dealType as DealType) || undefined,
        biomarker: 'unselected',
        lineOfTherapy: '1L',
        treatmentApproach: 'diseaseModifying',
        combinationPotential: 'some',
        dataQuality: 'promising',
        regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
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
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : 'Calculation failed'}` }],
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
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : 'rNPV/MC calculation failed'}` }],
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
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : 'Deal structure optimization failed'}` }],
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
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : 'Partner matching failed'}` }],
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
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : 'ZOPA computation failed'}` }],
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
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : 'Regulatory risk analysis failed'}` }],
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
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : 'Comparable deals search failed'}` }],
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
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : 'Market intelligence fetch failed'}` }],
          isError: true,
        };
      }
    },
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

  const { context: apiKeyContext } = authResult;

  // ── Build MCP server + transport ──
  const server = createMcpServerInstance(apiKeyContext);
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
    name: 'Ambrosia Benchmarker MCP Server',
    version: '1.0.0',
    protocol: 'mcp',
    transport: 'streamable-http',
    description: 'Institutional-grade pharmaceutical deal intelligence via the Model Context Protocol. 8 tools covering deal terms, rNPV/Monte Carlo valuation, deal structure optimization, partner matching, negotiation ZOPA, regulatory risk, comparable transactions, and market intelligence.',
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
      {
        name: 'calculate_deal_terms',
        description: 'Calculate pharmaceutical deal terms (upfront, milestones, royalties) calibrated against 2,500+ real transactions.',
      },
      {
        name: 'run_rnpv_model',
        description: 'Risk-adjusted NPV with 10,000-iteration Monte Carlo simulation. Returns P10/P50/P90, cash flows, driver sensitivity.',
      },
      {
        name: 'optimize_deal_structure',
        description: 'Rank all 5 deal structures by total value to licensor with upfront/milestone/royalty breakdown.',
      },
      {
        name: 'match_partners',
        description: 'Find best-fit partners from 850+ companies scored across 9 dimensions with Pharma Intent signals.',
      },
      {
        name: 'compute_negotiation_zopa',
        description: 'Compute Zone of Possible Agreement for 1-3 buyers with counterparty premiums and BATNA-anchored positions.',
      },
      {
        name: 'get_regulatory_risk',
        description: 'Global regulatory risk across 7 agencies (FDA, EMA, PMDA, NMPA, TGA, Health Canada, Swissmedic).',
      },
      {
        name: 'get_comparable_deals',
        description: 'Find comparable transactions from 280+ curated deals using hedonic regression scoring.',
      },
      {
        name: 'get_market_intelligence',
        description: 'Upcoming Phase 3 readouts (ClinicalTrials.gov) and FDA AdComm calendar for near-term catalysts.',
      },
    ],
    endpoint: 'POST /api/mcp',
    documentation: 'https://calculator.ambrosiaventures.co/docs/api/mcp',
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
