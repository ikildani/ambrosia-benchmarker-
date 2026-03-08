import Anthropic from '@anthropic-ai/sdk';
import { CalculationInput, CalculationResult } from '@/lib/calculations';
import { ComparableDeal } from '@/lib/comparableDeals';
import { getRelevantDealsWithDB } from '@/lib/comparableDeals.server';
import { CircuitBreaker } from './circuit-breaker';
import { createLogger } from '@/lib/logger';

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
  canada: 'Canada',
  australia: 'Australia & New Zealand',
  south_korea: 'South Korea',
  apac_ex_cj: 'APAC (ex-China/Japan)',
  latam: 'Latin America',
  mena: 'Middle East & North Africa',
};

// Format currency for prompt
function formatCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`;
  return `$${value}M`;
}

/** TA-specific risk guidance for the AI — tells Claude exactly what kind of risks to emphasize */
function getTherapeuticAreaRiskGuidance(inputs: CalculationInput): string {
  const ta = inputs.therapeuticArea;

  if (ta === 'oncology') {
    return `For oncology, focus risks on: (1) competitive landscape intensity — how many programs in the same target/modality are in late-stage, (2) line-of-therapy trial complexity and cost (1L vs 3L+), (3) combination strategy dependency and regulatory pathway for combo approvals, (4) commercial risk from IO/checkpoint saturation or emerging modality competition (ADC, bispecifics). Reference specific competitors, trial sizes, and approval timelines.`;
  }
  if (ta === 'neurology') {
    return `For neurology, focus risks on: (1) blood-brain barrier delivery challenges for the specific modality, (2) clinical endpoint validation — disease-modifying vs symptomatic, with historical failure rates for the indication, (3) trial duration and cost (CNS trials average 18-36 months), (4) biomarker validation status and FDA acceptance of surrogate endpoints. Reference specific CNS trial failure rates and regulatory precedents.`;
  }
  if (ta === 'immunology') {
    return `For immunology, focus risks on: (1) immune reset safety — CRS/ICANS risk for cell therapies, infection risk for broad immunosuppression, (2) target specificity and off-target immune effects, (3) durability of response and relapse rates, (4) competition from established biologics (anti-TNF, IL-17, IL-23) and biosimilar pressure. Reference specific safety monitoring requirements and comparator efficacy bars.`;
  }
  if (ta === 'metabolic') {
    return `For metabolic, focus risks on: (1) GLP-1/incretin competitive dominance (Lilly tirzepatide, Novo semaglutide) and differentiation bar, (2) CVOT trial requirements and cost ($500M+, 10K+ patients), (3) weight loss efficacy benchmarks (>15% is now table stakes), (4) formulary access and payer dynamics in a crowded market. Reference specific competitor market shares and clinical endpoints.`;
  }
  if (ta === 'cardiovascular') {
    return `For cardiovascular, focus risks on: (1) CVOT trial burden — size, duration, and cost for hard outcome endpoints, (2) payer requirements for outcomes data beyond surrogate biomarkers, (3) generic/biosimilar competition for established mechanisms, (4) heart failure vs atherosclerosis vs arrhythmia-specific regulatory and market dynamics. Reference specific CVOT precedents and enrollment requirements.`;
  }
  if (ta === 'infectiousDisease') {
    return `For infectious disease, focus risks on: (1) antimicrobial resistance dynamics and generic competition, (2) market size uncertainty — depends on incidence rates and pandemic preparedness funding, (3) reimbursement challenges (pull incentives like PASTEUR Act are uncertain), (4) speed-to-resistance for novel targets vs broad-spectrum approaches. Reference specific pathogen resistance rates and BARDA/CARB-X funding landscape.`;
  }
  if (ta === 'ophthalmology') {
    return `For ophthalmology, focus risks on: (1) anti-VEGF competition intensity and biosimilar pressure (aflibercept biosimilars arriving), (2) injection burden and treatment durability as key differentiators, (3) ocular delivery technology risk — intravitreal vs implant vs gene therapy, (4) posterior vs anterior segment market dynamics and pricing. Reference specific injection frequency benchmarks and Lucentis/Eylea precedents.`;
  }
  if (ta === 'womensHealth') {
    return `For women's health, focus risks on: (1) pregnancy-related regulatory complexity (teratogenicity studies, REMS), (2) historically underfunded therapeutic area with emerging partner interest, (3) generic competition in mature categories (contraception, HRT), (4) unmet need assessment — how much of the market is truly underserved vs well-covered. Reference specific regulatory requirements and recent women's health deal precedents.`;
  }
  if (ta === 'rareDisease') {
    return `For rare disease, focus risks on: (1) small patient population and enrollment challenges, (2) gene therapy manufacturing scalability and durability of response, (3) orphan drug pricing sustainability and payer pushback, (4) natural history data gaps and endpoint selection, (5) regulatory pathway advantages (breakthrough, accelerated approval) vs post-marketing commitments.`;
  }
  if (ta === 'hematology') {
    return `For hematology, focus risks on: (1) CAR-T/bispecific manufacturing complexity and COGS, (2) cytokine release syndrome and neurotoxicity management requirements, (3) MRD-based endpoint acceptance by regulators, (4) competitive intensity in relapsed/refractory settings (multiple CAR-T and bispecifics), (5) earlier-line expansion potential and combination strategies.`;
  }
  if (ta === 'dermatology') {
    return `For dermatology, focus risks on: (1) IL-4/IL-13/IL-17/IL-31 competitive crowding in atopic dermatitis and psoriasis, (2) JAK inhibitor class-wide safety signals (black box warnings), (3) topical vs systemic administration preference and market segmentation, (4) differentiation on onset speed, durability, and skin clearance endpoints (EASI, PASI, IGA), (5) biosimilar risk for established biologics.`;
  }
  if (ta === 'gastroenterology') {
    return `For gastroenterology, focus risks on: (1) anti-TL1A competition heating up (Merck, Roche, others), (2) endoscopic endpoint requirements and trial duration/cost, (3) biologic sequencing and positioning vs established TNF/IL-23/integrin therapies, (4) oral vs injectable preference in IBD (S1P modulators, JAK), (5) Crohn's vs UC market dynamics and indication expansion potential.`;
  }
  return 'Focus on the most relevant clinical, regulatory, and commercial risks specific to this therapeutic area.';
}

/** Returns TA-specific input fields formatted for the prompt */
function getTherapeuticAreaFields(inputs: CalculationInput): string {
  const ta = inputs.therapeuticArea;
  const fields: string[] = [];

  if (ta === 'neurology') {
    if (inputs.bbbPenetration) fields.push(`  BBB Penetration: ${inputs.bbbPenetration}`);
    if (inputs.diseaseProgression) fields.push(`  Disease Progression: ${inputs.diseaseProgression}`);
    if (inputs.biomarkerValidation) fields.push(`  Biomarker Validation: ${inputs.biomarkerValidation}`);
  } else if (ta === 'immunology') {
    if (inputs.immuneResetPotential) fields.push(`  Immune Reset Potential: ${inputs.immuneResetPotential}`);
    if (inputs.targetSpecificity) fields.push(`  Target Specificity: ${inputs.targetSpecificity}`);
    if (inputs.diseaseSeverity) fields.push(`  Disease Severity: ${inputs.diseaseSeverity}`);
    if (inputs.treatmentGoal) fields.push(`  Treatment Goal: ${inputs.treatmentGoal}`);
  } else if (ta === 'metabolic') {
    if (inputs.metabolicTreatmentApproach) fields.push(`  Metabolic Treatment Approach: ${inputs.metabolicTreatmentApproach}`);
    if (inputs.mechanismDifferentiation) fields.push(`  Mechanism Differentiation: ${inputs.mechanismDifferentiation}`);
    if (inputs.weightLossEfficacy) fields.push(`  Weight Loss Efficacy: ${inputs.weightLossEfficacy}`);
    if (inputs.comorbidityBreadth) fields.push(`  Comorbidity Breadth: ${inputs.comorbidityBreadth}`);
    if (inputs.routeOfAdministration) fields.push(`  Route of Administration: ${inputs.routeOfAdministration}`);
  } else if (ta === 'cardiovascular') {
    if (inputs.cvOutcomeBenefit) fields.push(`  CV Outcome Benefit: ${inputs.cvOutcomeBenefit}`);
    if (inputs.cvTrialEndpoint) fields.push(`  CV Trial Endpoint: ${inputs.cvTrialEndpoint}`);
    if (inputs.cvPopulationRisk) fields.push(`  CV Population Risk: ${inputs.cvPopulationRisk}`);
  } else if (ta === 'infectiousDisease') {
    if (inputs.resistanceProfile) fields.push(`  Resistance Profile: ${inputs.resistanceProfile}`);
    if (inputs.infectionChronicity) fields.push(`  Infection Chronicity: ${inputs.infectionChronicity}`);
    if (inputs.publicHealthPriority) fields.push(`  Public Health Priority: ${inputs.publicHealthPriority}`);
  } else if (ta === 'ophthalmology') {
    if (inputs.ocularDelivery) fields.push(`  Ocular Delivery: ${inputs.ocularDelivery}`);
    if (inputs.treatmentDurability) fields.push(`  Treatment Durability: ${inputs.treatmentDurability}`);
    if (inputs.visionImpact) fields.push(`  Vision Impact: ${inputs.visionImpact}`);
  } else if (ta === 'womensHealth') {
    if (inputs.whTargetPopulation) fields.push(`  Target Population: ${inputs.whTargetPopulation}`);
    if (inputs.whUnmetNeed) fields.push(`  Unmet Need: ${inputs.whUnmetNeed}`);
    if (inputs.whRegulatory) fields.push(`  Regulatory Pathway: ${inputs.whRegulatory}`);
  }

  return fields.length > 0 ? fields.join('\n') : '';
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

  // TA-specific risk factor guidance — ensures AI generates risks unique to the therapeutic area
  const taRiskGuidance = getTherapeuticAreaRiskGuidance(inputs);

  // TA-specific asset profile fields
  const taSpecificFields = getTherapeuticAreaFields(inputs);

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
${taSpecificFields ? `\nTHERAPEUTIC AREA-SPECIFIC PARAMETERS:\n${taSpecificFields}` : ''}

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

CRITICAL INSTRUCTIONS FOR RISK FACTORS:
Generate exactly 4 risk factors. Each must be specific to ${inputs.therapeuticArea} — NOT generic pharma risks. ${taRiskGuidance}
Each risk factor must include a specific number, percentage, or dollar amount. Example: "Phase 2 CNS trials in Alzheimer's have a 99.6% historical failure rate — disease-modifying endpoints require 18+ month trials costing $150M+."

Respond with ONLY a JSON object (no markdown, no backticks, just the raw JSON):
{
  "executive_summary": "2-3 sentences positioning this asset in the current market with specific valuation range and the single most important factor driving deal value",
  "valuation_rationale": "3-4 sentences explaining why these valuation ranges are appropriate, referencing specific modifiers and their impact on deal value",
  "market_context": "3-4 sentences on the current M&A/licensing environment for this specific therapeutic area and modality combination, referencing recent deal activity",
  "risk_factors": ["TA-specific risk 1 with numbers", "TA-specific risk 2 with numbers", "TA-specific risk 3 with numbers", "TA-specific risk 4 with numbers"],
  "negotiation_priorities": ["what to fight for 1 - specific", "what to concede 1 - specific", "key timing consideration"],
  "comparable_analysis": "3-4 sentences tying the most relevant comparable transactions to this asset, explaining why they're relevant or how they differ",
  "confidence_level": "high or medium or low"
}`;
}

import { parseJsonResponse } from './parse-json';

// Shared circuit breaker for deal memo API calls
const circuitBreaker = new CircuitBreaker({
  name: 'deal-memo',
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
  return msg.includes('timeout') || msg.includes('529') || msg.includes('overloaded') || msg.includes('rate');
}

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
    const log = createLogger('deal-memo');
    const elapsed = log.startTimer();

    const comparableDeals = await getRelevantDealsWithDB(
      input.inputs.therapeuticArea,
      input.inputs.modality,
      input.inputs.indication,
      8
    );

    const prompt = buildMemoPrompt(input, comparableDeals);
    let lastError: Error | null = null;
    const maxAttempts = 3;

    return circuitBreaker.execute(async () => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          log.info('AI call starting', {
            model: 'claude-sonnet-4-20250514',
            attempt: attempt + 1,
            maxAttempts,
            circuitState: circuitBreaker.getState(),
          });

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

          const durationMs = elapsed();
          log.info('Memo generated', {
            durationMs,
            attempt: attempt + 1,
            tokenUsage: message.usage,
          });

          return { ...parsed, generatedAt: new Date().toISOString() };
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

      throw lastError ?? new Error('Deal memo generation failed');
    });
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

/** Expose circuit breaker for testing/monitoring. */
export function getCircuitBreaker(): CircuitBreaker {
  return circuitBreaker;
}
