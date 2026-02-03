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

  return `You are an expert life sciences business development advisor with 20+ years of experience negotiating pharmaceutical licensing deals. You have deep knowledge of deal structures, royalty mechanics, milestone strategies, and negotiation tactics for oncology assets.

Generate a comprehensive negotiation playbook for a biotech company preparing to out-license their asset. Your advice should be:
- Specific and actionable (not generic platitudes)
- Grounded in the provided deal terms and market context
- Strategic yet realistic
- Structured for easy reference during negotiations

## Asset Profile
- Development Phase: ${labels.phase}
- Modality: ${labels.modality}
- Primary Indication: ${labels.indication}
- Territory: ${territoryLabel}

## Calculated Deal Terms
Upfront Payment Range: ${formatCurrencyForPrompt(terms.upfront.low)} - ${formatCurrencyForPrompt(terms.upfront.high)} (Expected: ${formatCurrencyForPrompt(terms.upfront.median)})
Total Deal Value Range: ${formatCurrencyForPrompt(terms.totalDealValue.low)} - ${formatCurrencyForPrompt(terms.totalDealValue.high)} (Expected: ${formatCurrencyForPrompt(terms.totalDealValue.median)})

Development Milestones: ${formatCurrencyForPrompt(terms.devMilestones.low)} - ${formatCurrencyForPrompt(terms.devMilestones.high)}
Regulatory Milestones: ${formatCurrencyForPrompt(terms.regMilestones.low)} - ${formatCurrencyForPrompt(terms.regMilestones.high)}
Commercial Milestones: ${formatCurrencyForPrompt(terms.commMilestones.low)} - ${formatCurrencyForPrompt(terms.commMilestones.high)}

Recommended Structure: ${dealRecommendation.upfrontPercent}% Upfront / ${dealRecommendation.milestonePercent}% Milestones
Rationale: ${dealRecommendation.rationale}

Royalty Tiers:
- Base (<$500M sales): ${tieredRoyalties.base.low}% - ${tieredRoyalties.base.high}%
- Mid ($500M-$1B): ${tieredRoyalties.midTier.low}% - ${tieredRoyalties.midTier.high}%
- High (>$1B): ${tieredRoyalties.highTier.low}% - ${tieredRoyalties.highTier.high}%

## Applied Value Modifiers
${modifiersList || 'No special modifiers applied'}

## Market Context
${negotiationInsight}

---

Generate a negotiation playbook with the following sections. For each section, provide:
1. A strategic overview (2-3 sentences)
2. 3-5 specific, actionable bullet points
3. A "Key Highlight" - one critical point to remember

## Required Sections

### 1. Opening Position
How to frame your initial ask. Consider whether to anchor high or start closer to expected value based on the asset's profile and competitive dynamics.

### 2. Deal Structure Strategy
How to balance upfront vs milestones. When to push for higher upfront, when to accept milestone-heavy structures, and how to structure milestone triggers.

### 3. Royalty Floor Negotiation
Minimum acceptable royalty rates, how to defend your floor, escalation triggers, and anti-stacking provisions to consider.

### 4. Competitive Intelligence
How to leverage (or mitigate) competitive dynamics. Reference the modality/indication landscape and timing considerations.

### 5. Partner-Specific Tactics
Tailored advice for different partner types (big pharma vs. regional players vs. specialty pharma). Include territory-specific considerations for ${territoryLabel} rights.

---

Return your response in this exact JSON format:
{
  "sections": {
    "openingPosition": {
      "title": "Opening Position Strategy",
      "content": "Strategic overview here...",
      "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"],
      "highlight": "Key point to remember"
    },
    "structureStrategy": {
      "title": "Deal Structure Strategy",
      "content": "...",
      "bullets": ["..."],
      "highlight": "..."
    },
    "royaltyFloor": {
      "title": "Royalty Floor Negotiation",
      "content": "...",
      "bullets": ["..."],
      "highlight": "..."
    },
    "competitiveIntelligence": {
      "title": "Competitive Intelligence",
      "content": "...",
      "bullets": ["..."],
      "highlight": "..."
    },
    "partnerTactics": {
      "title": "Partner-Specific Tactics",
      "content": "...",
      "bullets": ["..."],
      "highlight": "..."
    }
  },
  "keyCaveats": [
    "This playbook is for informational purposes only and does not constitute professional advice.",
    "Actual negotiation outcomes depend on many factors not captured here.",
    "Consult with legal and financial advisors before making any commitments."
  ]
}

Important: Make your advice specific to this ${labels.modality} asset in ${labels.indication} at ${labels.phase} stage. Reference the actual numbers provided. Avoid generic advice that could apply to any deal.`;
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
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
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
