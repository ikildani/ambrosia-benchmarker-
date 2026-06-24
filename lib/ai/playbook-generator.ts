import Anthropic from '@anthropic-ai/sdk';
import { CalculationResult, DealTerms, TieredRoyalties, DealRecommendation } from '@/lib/calculations';
import { ComparableDeal } from '@/lib/comparableDeals';
import { getRelevantDealsWithDB } from '@/lib/comparableDeals.server';
import { CircuitBreaker } from './circuit-breaker';
import { createLogger } from '@/lib/logger';

// Input types
export interface PlaybookInput {
  inputs: {
    modality: string;
    phase: string;
    indication: string;
    territory: string;
    therapeuticArea?: string;
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
  canada: 'Canada',
  australia: 'Australia & New Zealand',
  south_korea: 'South Korea',
  apac_ex_cj: 'APAC (ex-China/Japan)',
  latam: 'Latin America',
  mena: 'Middle East & North Africa',
};

// Format currency for prompt
function formatCurrencyForPrompt(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value}M`;
}

// Build the playbook generation prompt
function buildPlaybookPrompt(input: PlaybookInput, comparableDeals: ComparableDeal[]): string {
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

  const comparablesList = comparableDeals
    .map((d) => `- ${d.licensor} → ${d.licensee}: ${d.value} (${d.year}) — ${d.relevance}`)
    .join('\n');

  return `Expert pharma BD advisor. Generate negotiation playbook for out-licensing this asset.

ASSET: ${labels.phase} ${labels.modality} in ${labels.indication}, ${territoryLabel} rights
UPFRONT: ${formatCurrencyForPrompt(terms.upfront.low)}-${formatCurrencyForPrompt(terms.upfront.high)} (median ${formatCurrencyForPrompt(terms.upfront.median)})
TOTAL VALUE: ${formatCurrencyForPrompt(terms.totalDealValue.low)}-${formatCurrencyForPrompt(terms.totalDealValue.high)} (median ${formatCurrencyForPrompt(terms.totalDealValue.median)})
MILESTONES: Dev ${formatCurrencyForPrompt(terms.devMilestones.median)}, Reg ${formatCurrencyForPrompt(terms.regMilestones.median)}, Comm ${formatCurrencyForPrompt(terms.commMilestones.median)}
ROYALTIES: Base ${tieredRoyalties.base.low}-${tieredRoyalties.base.high}%, Mid ${tieredRoyalties.midTier.low}-${tieredRoyalties.midTier.high}%, High ${tieredRoyalties.highTier.low}-${tieredRoyalties.highTier.high}%
STRUCTURE: ${dealRecommendation.upfrontPercent}% upfront / ${dealRecommendation.milestonePercent}% milestones
${modifiersList ? `MODIFIERS:\n${modifiersList}` : ''}

COMPARABLE TRANSACTIONS:
${comparablesList || 'No direct comparables identified'}

CRITICAL RULES:
- Reference comparable transactions listed above when relevant to support negotiation positions.
- Do NOT cite patent cliff dates, revenue-at-risk figures, or pipeline gap data beyond what is provided.
- Do NOT invent or hallucinate any statistics, dollar amounts, or dates beyond the numbers provided above.
- Focus the partnerTactics section on strategic partner selection criteria and outreach positioning for this specific ${labels.modality} in ${labels.indication}.
- Reference the actual deal numbers and comparable transactions provided above.

Return JSON with 5 sections. Each section: title, content (2-3 sentences), bullets (3 items), highlight (1 key point). Be SPECIFIC to this ${labels.modality} at ${labels.phase}. Reference real company names and deal values from the comparables.

{"sections":{"openingPosition":{"title":"Opening Position","content":"...","bullets":["...","...","..."],"highlight":"..."},"structureStrategy":{"title":"Deal Structure","content":"...","bullets":["...","...","..."],"highlight":"..."},"royaltyFloor":{"title":"Royalty Negotiation","content":"...","bullets":["...","...","..."],"highlight":"..."},"competitiveIntelligence":{"title":"Competitive Dynamics","content":"...","bullets":["...","...","..."],"highlight":"..."},"partnerTactics":{"title":"Partner Selection Strategy","content":"...","bullets":["...","...","..."],"highlight":"..."}},"keyCaveats":["For informational purposes only.","Consult advisors before commitments."]}`;
}

import { parseJsonResponse } from './parse-json';

// Shared circuit breaker for playbook API calls
const circuitBreaker = new CircuitBreaker({
  name: 'playbook',
  failureThreshold: 3,
  cooldownMs: 60_000,
});

/** Exponential backoff with jitter. */
function backoffDelay(attempt: number, baseMs: number = 1_000): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseMs;
  return exponential + jitter;
}

function isRetryableError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  if (msg.includes('timeout')) return false;
  return msg.includes('529') || msg.includes('overloaded') || msg.includes('rate');
}

// Playbook Generator class
export class PlaybookGenerator {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.client = new Anthropic({ apiKey, timeout: 45_000 });
  }

  async generatePlaybook(input: PlaybookInput): Promise<NegotiationPlaybook> {
    const log = createLogger('playbook');
    const elapsed = log.startTimer();

    const comparableDeals = await getRelevantDealsWithDB(
      input.inputs.therapeuticArea || 'oncology',
      input.inputs.modality,
      input.inputs.indication,
      8
    );

    const prompt = buildPlaybookPrompt(input, comparableDeals);
    let lastError: Error | null = null;
    const maxAttempts = 2;

    return circuitBreaker.execute(async () => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          log.info('AI call starting', {
            model: 'claude-sonnet-4-6',
            attempt: attempt + 1,
            maxAttempts,
            circuitState: circuitBreaker.getState(),
          });

          const message = await this.client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4000,
            messages: [{ role: 'user', content: prompt }],
          });

          const textContent = message.content.find((c) => c.type === 'text');
          if (!textContent || textContent.type !== 'text') {
            throw new Error('No text content in AI response');
          }

          const parsed = parseJsonResponse<{
            sections: NegotiationPlaybook['sections'];
            keyCaveats: string[];
          }>(textContent.text);

          // Validate required fields
          if (!parsed.sections?.openingPosition || !Array.isArray(parsed.keyCaveats)) {
            throw new Error('AI response missing required playbook sections');
          }

          const durationMs = elapsed();
          log.info('Playbook generated', {
            durationMs,
            attempt: attempt + 1,
            tokenUsage: message.usage,
          });

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
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const durationMs = elapsed();

          log.error('AI call failed', {
            durationMs,
            attempt: attempt + 1,
            error: lastError.message,
            retryable: isRetryableError(lastError),
          });

          if (!isRetryableError(lastError) || attempt >= maxAttempts - 1) break;

          const delay = backoffDelay(attempt);
          log.info('Retrying after backoff', { delayMs: Math.round(delay), attempt: attempt + 1 });
          await new Promise(r => setTimeout(r, delay));
        }
      }

      throw lastError ?? new Error('Playbook generation failed');
    });
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

/** Expose circuit breaker for testing/monitoring. */
export function getCircuitBreaker(): CircuitBreaker {
  return circuitBreaker;
}
