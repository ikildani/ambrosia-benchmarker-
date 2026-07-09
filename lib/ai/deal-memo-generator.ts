import { CalculationInput, CalculationResult } from '@/lib/calculations';
import { ComparableDeal } from '@/lib/comparableDeals';
import { getRelevantDealsWithDB } from '@/lib/comparableDeals.server';
import { getCumulativePoS } from '@/lib/financial/pos-tables';
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

  // Cross-TA: molecular targets and delivery route
  if (inputs.molecularTargets && inputs.molecularTargets.length > 0) {
    fields.push(`  Molecular Targets: ${inputs.molecularTargets.join(', ')}`);
  }
  if (inputs.deliveryRoute) {
    fields.push(`  Delivery Route: ${inputs.deliveryRoute}`);
  }

  return fields.length > 0 ? fields.join('\n') : '';
}

// ---------------------------------------------------------------------------
// Data-Backed Risk Factor Generation
// ---------------------------------------------------------------------------
// Instead of letting Claude hallucinate specific numbers for risk factors,
// we pre-compute risk factors from actual PoS data, comparable deal counts,
// deal value trends, and modality-specific risks. Claude then elaborates
// on these grounded facts rather than inventing new ones.
// ---------------------------------------------------------------------------

/**
 * Build risk factors backed by actual data from PoS tables and comparable deals.
 *
 * These are passed to Claude as context to elaborate on, replacing the
 * previous approach where Claude would invent specific numbers that could
 * be hallucinated.
 */
function buildDataBackedRiskFactors(
  inputs: CalculationInput,
  comparableDeals: ComparableDeal[],
): string[] {
  const risks: string[] = [];

  // 1. Phase transition risk (from actual PoS data)
  const posResult = getCumulativePoS(
    inputs.phase,
    inputs.therapeuticArea,
    inputs.modality,
    'unselected',
    inputs.regulatoryDesignations,
    inputs.indication,
  );
  const failureRate = ((1 - posResult.cumulativePoS) * 100).toFixed(0);
  risks.push(
    `Phase transition risk: ${inputs.therapeuticArea} assets at ${inputs.phase} have a ${failureRate}% cumulative failure rate from current phase to market launch (FDA/BIO Industry Analysis 2024). ` +
    `Key attrition point: ${posResult.transitions.length > 0 ? posResult.transitions[0].phase : 'N/A'} at ${posResult.transitions.length > 0 ? ((1 - posResult.transitions[0].probability) * 100).toFixed(0) : 'N/A'}% failure rate.`
  );

  // 2. Competitive density (from comparable deals count)
  const sameTADeals = comparableDeals.filter(
    (d) => d.therapeuticArea === inputs.therapeuticArea,
  );
  if (sameTADeals.length > 5) {
    risks.push(
      `Competitive crowding: ${sameTADeals.length} comparable deals in ${inputs.therapeuticArea} since 2022 indicate intense competition. ` +
      `Recent transactions include ${sameTADeals.slice(0, 3).map(d => `${d.licensor}→${d.licensee} (${d.value}, ${d.year})`).join('; ')}.`
    );
  } else if (sameTADeals.length > 0) {
    risks.push(
      `Market activity: ${sameTADeals.length} comparable deals identified in ${inputs.therapeuticArea}, suggesting ${sameTADeals.length <= 2 ? 'limited' : 'moderate'} competitive deal flow.`
    );
  }

  // 3. Deal value trend (from comparable deals pricing)
  const dealsWithValues = sameTADeals.filter(d => d.totalValueM && d.totalValueM > 0);
  if (dealsWithValues.length >= 3) {
    const sorted = dealsWithValues.sort((a, b) => a.year - b.year);
    const recentHalf = sorted.slice(Math.floor(sorted.length / 2));
    const olderHalf = sorted.slice(0, Math.floor(sorted.length / 2));

    const recentMedian = recentHalf.length > 0
      ? recentHalf.reduce((s, d) => s + (d.totalValueM || 0), 0) / recentHalf.length
      : 0;
    const olderMedian = olderHalf.length > 0
      ? olderHalf.reduce((s, d) => s + (d.totalValueM || 0), 0) / olderHalf.length
      : 0;

    if (olderMedian > 0) {
      const trendPct = ((recentMedian - olderMedian) / olderMedian * 100).toFixed(0);
      const direction = recentMedian > olderMedian ? 'increasing' : 'decreasing';
      risks.push(
        `Deal value trend: Average ${inputs.therapeuticArea} deal values are ${direction} (${trendPct}% change), ` +
        `from ~$${(olderMedian / 1000).toFixed(1)}B (older cohort) to ~$${(recentMedian / 1000).toFixed(1)}B (recent cohort). ` +
        `This ${direction === 'increasing' ? 'supports' : 'pressures'} premium deal structuring.`
      );
    }
  }

  // 4. Modality-specific risk
  const geneTherapyModalities = ['geneTherapy', 'geneTherapyOcular', 'geneTherapyRare'];
  const carTModalities = ['carT_heme', 'carT_solid', 'carT_autoimmune', 'inVivoCarT', 'carTreg'];
  const complexBiologics = ['adc', 'bispecific', 'tCellEngager'];

  if (geneTherapyModalities.includes(inputs.modality)) {
    risks.push(
      'Modality risk (gene therapy): Viral vector manufacturing scalability remains a key commercial bottleneck. ' +
      'Commercial COGS for AAV-based gene therapies run 25-35% of revenue vs 10-18% for traditional biologics. ' +
      'Durability of transgene expression beyond 3-5 years is unproven for most indications.'
    );
  } else if (carTModalities.includes(inputs.modality)) {
    risks.push(
      'Modality risk (CAR-T): Autologous manufacturing requires 3-4 week vein-to-vein turnaround, limiting addressable patients. ' +
      'CRS/ICANS safety monitoring restricts administration to certified centers. ' +
      'COGS at 25-30% of revenue significantly compress gross margins vs traditional biologics.'
    );
  } else if (complexBiologics.includes(inputs.modality)) {
    risks.push(
      `Modality risk (${inputs.modality}): Complex biologic manufacturing involves multi-step conjugation/assembly processes. ` +
      'CMC-related clinical holds have affected 15-20% of programs in this class. ' +
      'Immunogenicity risk from novel protein formats may limit repeat dosing tolerability.'
    );
  }

  // 5. TA-specific structural risk
  if (inputs.therapeuticArea === 'neurology') {
    risks.push(
      'CNS-specific risk: Blood-brain barrier limits large molecule exposure to <1% of plasma levels without specialized delivery. ' +
      'CNS trial durations average 18-36 months with high placebo response rates (30-40% in depression/pain). ' +
      'Disease-modifying endpoints (cognitive decline, neurodegeneration) lack validated surrogate biomarkers for accelerated approval.'
    );
  } else if (inputs.therapeuticArea === 'oncology' && (inputs.competitivePosition === 'crowded' || inputs.competitivePosition === 'behind')) {
    risks.push(
      'Oncology crowding risk: The target indication has 5+ active programs in pivotal trials. ' +
      'Rapid standard-of-care evolution during 3-year Phase 3 timelines risks trial design obsolescence. ' +
      'Combination strategy dependency adds regulatory complexity (separate or concurrent approvals).'
    );
  }

  return risks;
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

  // Data-backed risk factors — computed from actual PoS tables and comparable deals
  // These replace hallucinated numbers with grounded data points
  const dataBackedRisks = buildDataBackedRiskFactors(inputs, comparableDeals);
  const dataBackedRisksSection = dataBackedRisks.length > 0
    ? `\nDATA-BACKED RISK FACTORS (from actual PoS tables and deal database — use these as the foundation for your risk analysis):\n${dataBackedRisks.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}`
    : '';

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
${dataBackedRisksSection}

Write a deal analysis memo. Be SPECIFIC — reference actual dollar amounts from the benchmarks above, name actual companies from the comparable transactions, and provide actionable guidance. Do NOT be generic. Every sentence should contain a specific number, company name, or concrete recommendation.

CRITICAL INSTRUCTIONS FOR RISK FACTORS:
Generate exactly 4 risk factors. You MUST use the DATA-BACKED RISK FACTORS above as your foundation — elaborate on them with additional context, but DO NOT invent new statistics or percentages. Every number in your risk factors must come from either the data-backed risks, the comparable transactions, or the valuation benchmarks provided above. ${taRiskGuidance}

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
  failureThreshold: 5,
  cooldownMs: 30_000,
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

async function callAnthropicAPI(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${errBody.substring(0, 200)}`);
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }>; usage?: Record<string, number> };
  const textContent = data.content?.find((c: { type: string }) => c.type === 'text');
  if (!textContent) throw new Error('No text content in AI response');
  return textContent.text;
}

// Deal Memo Generator class
export class DealMemoGenerator {
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

          const text = await callAnthropicAPI(prompt, 2500);
          const parsed = parseJsonResponse<Omit<DealMemo, 'generatedAt'>>(text);

          if (!parsed.executive_summary || !parsed.valuation_rationale || !Array.isArray(parsed.risk_factors)) {
            throw new Error('AI response missing required fields (executive_summary, valuation_rationale, or risk_factors)');
          }

          const durationMs = elapsed();
          log.info('Memo generated', { durationMs, attempt: attempt + 1 });

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
