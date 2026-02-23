import Anthropic from '@anthropic-ai/sdk';
import { CalculationInput, CalculationResult } from '@/lib/calculations';
import { ComparableDeal } from '@/lib/comparableDeals';
import { getRelevantDealsWithDB } from '@/lib/comparableDeals.server';

// Output types
export interface DealMemo {
  executive_summary: string;
  valuation_rationale: string;
  market_context: string;
  risk_factors: string[];
  negotiation_priorities: string[];
  comparable_analysis: string;
  confidence_level: 'high' | 'medium' | 'low';
  generatedAt: string;
}

export interface DealMemoInput {
  inputs: CalculationInput;
  results: CalculationResult;
  labels: { phase: string; modality: string; indication: string };
}

// Territory labels
const territoryLabels: Record<string, string> = {
  global: 'Global (Worldwide)',
  us_only: 'US Only',
  ex_us: 'Ex-US',
  europe: 'Europe',
  china: 'China',
  japan: 'Japan',
  row: 'Rest of World',
  us_eu: 'US & Europe',
  us_japan: 'US & Japan',
};

// Format currency for prompt
function formatCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`;
  return `$${value}M`;
}

// Build the memo prompt
function buildMemoPrompt(input: DealMemoInput, comparableDeals: ComparableDeal[]): string {
  const { inputs, results, labels } = input;
  const { terms, tieredRoyalties, dealRecommendation, modifiers } = results;
  const territory = territoryLabels[inputs.territory] || inputs.territory;

  const modifiersList = modifiers
    .map((m) => {
      const sign = m.multiplier >= 1 ? '+' : '';
      const pct = Math.round((m.multiplier - 1) * 100);
      return `${m.name}: ${sign}${pct}%${m.context ? ` (${m.context})` : ''}`;
    })
    .join('\n  ');

  const comparablesList = comparableDeals
    .map((d) => `${d.licensor} → ${d.licensee}: ${d.value} (${d.year}) — ${d.relevance}`)
    .join('\n  ');

  return `You are a senior biotech business development advisor with 20+ years of experience in licensing, M&A, and strategic partnerships. Write a confidential deal analysis memo for a client considering out-licensing the following asset.

ASSET PROFILE:
  Phase: ${labels.phase}
  Modality: ${labels.modality}
  Indication: ${labels.indication}
  Territory: ${territory}
  Therapeutic Area: ${inputs.therapeuticArea}
  Competitive Position: ${inputs.competitivePosition}
  Data Quality: ${inputs.dataQuality}
  Line of Therapy: ${inputs.lineOfTherapy}
  Treatment Approach: ${inputs.treatmentApproach}
  Biomarker: ${inputs.biomarker}
  Combination Potential: ${inputs.combinationPotential}

VALUATION BENCHMARKS:
  Upfront: ${formatCurrency(terms.upfront.low)} – ${formatCurrency(terms.upfront.high)} (expected ${formatCurrency(terms.upfront.median)})
  Total Deal Value: ${formatCurrency(terms.totalDealValue.low)} – ${formatCurrency(terms.totalDealValue.high)} (expected ${formatCurrency(terms.totalDealValue.median)})
  Development Milestones: ${formatCurrency(terms.devMilestones.median)}
  Regulatory Milestones: ${formatCurrency(terms.regMilestones.median)}
  Commercial Milestones: ${formatCurrency(terms.commMilestones.median)}
  Royalties: Base ${tieredRoyalties.base.low}–${tieredRoyalties.base.high}%, Mid-tier ${tieredRoyalties.midTier.low}–${tieredRoyalties.midTier.high}%, High-tier ${tieredRoyalties.highTier.low}–${tieredRoyalties.highTier.high}%
  Recommended Structure: ${dealRecommendation.upfrontPercent}% upfront / ${dealRecommendation.milestonePercent}% milestones
  Rationale: ${dealRecommendation.rationale}

${modifiersList ? `VALUE MODIFIERS:\n  ${modifiersList}` : ''}

COMPARABLE TRANSACTIONS:
  ${comparablesList || 'No direct comparables identified'}

Write a deal analysis memo. Be SPECIFIC — reference actual dollar amounts from the benchmarks above, name actual companies from the comparable transactions, and provide actionable guidance. Do NOT be generic. Every sentence should contain a specific number, company name, or concrete recommendation.

Respond with ONLY a JSON object (no markdown, no backticks, just the raw JSON):
{
  "executive_summary": "2-3 sentences positioning this asset in the current market with specific valuation range and the single most important factor driving deal value",
  "valuation_rationale": "3-4 sentences explaining why these valuation ranges are appropriate, referencing specific modifiers and their impact on deal value",
  "market_context": "3-4 sentences on the current M&A/licensing environment for this specific therapeutic area and modality combination, referencing recent deal activity",
  "risk_factors": ["specific risk 1 with numbers", "specific risk 2 with numbers", "specific risk 3 with numbers"],
  "negotiation_priorities": ["what to fight for 1 - specific", "what to concede 1 - specific", "key timing consideration"],
  "comparable_analysis": "3-4 sentences tying the most relevant comparable transactions to this asset, explaining why they're relevant or how they differ",
  "confidence_level": "high or medium or low"
}`;
}

import { parseJsonResponse } from './parse-json';

// Deal Memo Generator class
export class DealMemoGenerator {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.client = new Anthropic({ apiKey, timeout: 30_000 });
  }

  async generateMemo(input: DealMemoInput): Promise<DealMemo> {
    const comparableDeals = await getRelevantDealsWithDB(
      input.inputs.therapeuticArea,
      input.inputs.modality,
      input.inputs.indication,
      8
    );

    const prompt = buildMemoPrompt(input, comparableDeals);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const message = await this.client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2500,
          messages: [{ role: 'user', content: prompt }],
        });

        const textContent = message.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text content in AI response');
        }

        const parsed = parseJsonResponse<Omit<DealMemo, 'generatedAt'>>(textContent.text);

        // Validate required fields
        if (!parsed.executive_summary || !parsed.valuation_rationale || !Array.isArray(parsed.risk_factors)) {
          throw new Error('AI response missing required fields (executive_summary, valuation_rationale, or risk_factors)');
        }

        return { ...parsed, generatedAt: new Date().toISOString() };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const msg = lastError.message.toLowerCase();
        const isRetryable = msg.includes('timeout') || msg.includes('529') || msg.includes('overloaded') || msg.includes('rate');
        if (!isRetryable || attempt > 0) break;
        await new Promise(r => setTimeout(r, 2_000));
      }
    }

    throw lastError ?? new Error('Deal memo generation failed');
  }
}

// Singleton instance
let generatorInstance: DealMemoGenerator | null = null;

export function getDealMemoGenerator(): DealMemoGenerator {
  if (!generatorInstance) {
    generatorInstance = new DealMemoGenerator();
  }
  return generatorInstance;
}
