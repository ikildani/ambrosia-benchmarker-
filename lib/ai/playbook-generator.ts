import Anthropic from '@anthropic-ai/sdk';
import { CalculationResult, DealTerms, TieredRoyalties, DealRecommendation } from '@/lib/calculations';

// Input types
export interface PlaybookInput {
  inputs: {
    modality: string;
    phase: string;
    indication: string;
    territory: string;
  };
  results: {
    terms: DealTerms;
    tieredRoyalties: TieredRoyalties;
    dealRecommendation: DealRecommendation;
    negotiationInsight: string;
    modifiers: { name: string; multiplier: number; context?: string }[];
  };
  labels: {
    phase: string;
    modality: string;
    indication: string;
  };
}

// Output types
export interface PlaybookSection {
  title: string;
  content: string;
  bullets: string[];
  highlight: string;
}

export interface NegotiationPlaybook {
  generatedAt: string;
  assetProfile: {
    phase: string;
    modality: string;
    indication: string;
    territory: string;
  };
  sections: {
    openingPosition: PlaybookSection;
    structureStrategy: PlaybookSection;
    royaltyFloor: PlaybookSection;
    competitiveIntelligence: PlaybookSection;
    partnerTactics: PlaybookSection;
  };
  keyCaveats: string[];
}

// Territory labels for prompt
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
function formatCurrencyForPrompt(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value}M`;
}

// Build the playbook generation prompt
function buildPlaybookPrompt(input: PlaybookInput): string {
  const { inputs, results, labels } = input;
  const { terms, tieredRoyalties, dealRecommendation, negotiationInsight, modifiers } = results;

  const territoryLabel = territoryLabels[inputs.territory] || inputs.territory;

  const modifiersList = modifiers
    .map((m) => {
      const sign = m.multiplier >= 1 ? '+' : '';
      const pct = Math.round((m.multiplier - 1) * 100);
      return `- ${m.name}: ${sign}${pct}%${m.context ? ` (${m.context})` : ''}`;
    })
    .join('\n');

  return `Expert pharma BD advisor. Generate negotiation playbook for out-licensing this asset.

ASSET: ${labels.phase} ${labels.modality} in ${labels.indication}, ${territoryLabel} rights
UPFRONT: ${formatCurrencyForPrompt(terms.upfront.low)}-${formatCurrencyForPrompt(terms.upfront.high)} (median ${formatCurrencyForPrompt(terms.upfront.median)})
TOTAL VALUE: ${formatCurrencyForPrompt(terms.totalDealValue.low)}-${formatCurrencyForPrompt(terms.totalDealValue.high)} (median ${formatCurrencyForPrompt(terms.totalDealValue.median)})
MILESTONES: Dev ${formatCurrencyForPrompt(terms.devMilestones.median)}, Reg ${formatCurrencyForPrompt(terms.regMilestones.median)}, Comm ${formatCurrencyForPrompt(terms.commMilestones.median)}
ROYALTIES: Base ${tieredRoyalties.base.low}-${tieredRoyalties.base.high}%, Mid ${tieredRoyalties.midTier.low}-${tieredRoyalties.midTier.high}%, High ${tieredRoyalties.highTier.low}-${tieredRoyalties.highTier.high}%
STRUCTURE: ${dealRecommendation.upfrontPercent}% upfront / ${dealRecommendation.milestonePercent}% milestones
${modifiersList ? `MODIFIERS: ${modifiersList}` : ''}

Return JSON with 5 sections. Each section: title, content (2 sentences), bullets (3 items), highlight (1 key point). Be SPECIFIC to this ${labels.modality} at ${labels.phase} - reference the actual numbers.

{"sections":{"openingPosition":{"title":"Opening Position","content":"...","bullets":["...","...","..."],"highlight":"..."},"structureStrategy":{"title":"Deal Structure","content":"...","bullets":["...","...","..."],"highlight":"..."},"royaltyFloor":{"title":"Royalty Negotiation","content":"...","bullets":["...","...","..."],"highlight":"..."},"competitiveIntelligence":{"title":"Competitive Dynamics","content":"...","bullets":["...","...","..."],"highlight":"..."},"partnerTactics":{"title":"Partner Tactics","content":"...","bullets":["...","...","..."],"highlight":"..."}},"keyCaveats":["For informational purposes only.","Consult advisors before commitments."]}`;
}

// Parse JSON from Claude's response
function parseJsonResponse<T>(text: string): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }
  return JSON.parse(jsonMatch[0]) as T;
}

// Playbook Generator class
export class PlaybookGenerator {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.client = new Anthropic({ apiKey });
  }

  async generatePlaybook(input: PlaybookInput): Promise<NegotiationPlaybook> {
    const prompt = buildPlaybookPrompt(input);

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    const parsed = parseJsonResponse<{
      sections: NegotiationPlaybook['sections'];
      keyCaveats: string[];
    }>(textContent.text);

    return {
      generatedAt: new Date().toISOString(),
      assetProfile: {
        phase: input.labels.phase,
        modality: input.labels.modality,
        indication: input.labels.indication,
        territory: territoryLabels[input.inputs.territory] || input.inputs.territory,
      },
      sections: parsed.sections,
      keyCaveats: parsed.keyCaveats,
    };
  }
}

// Singleton instance
let generatorInstance: PlaybookGenerator | null = null;

export function getPlaybookGenerator(): PlaybookGenerator {
  if (!generatorInstance) {
    generatorInstance = new PlaybookGenerator();
  }
  return generatorInstance;
}
