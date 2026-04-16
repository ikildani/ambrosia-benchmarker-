// Outreach Generator Service
// Generates personalized approach strategies and outreach emails using Claude

import Anthropic from '@anthropic-ai/sdk';
import {
  ApproachStrategy,
  OutreachEmail,
  ScoreFactor,
  WatchOutFactor,
  PatentCliff,
  RelevantDeal,
  EmailTone,
  StrategyGenerationRequest,
  OutreachGenerationRequest,
} from '@/types/partner-breakdown';
import { formatters } from './partner-matching';

// ============================================================================
// TYPES
// ============================================================================

interface StrategyContext {
  companyName: string;
  companyType: string | null;
  matchScore: number;
  scoreFactors: ScoreFactor[];
  watchOuts: WatchOutFactor[];
  patentCliffs: PatentCliff[];
  recentDeals: RelevantDeal[];
  userAsset: {
    modality: string;
    phase: string;
    indication_category: string | null;
    indication_specific: string | null;
    territory: string | null;
  };
}

interface EmailContext extends StrategyContext {
  approachStrategy: ApproachStrategy;
  tone: EmailTone;
  recipientRole?: string;
  senderName?: string;
  senderCompany?: string;
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

function buildStrategyPrompt(context: StrategyContext): string {
  const { companyName, companyType, matchScore, scoreFactors, watchOuts, patentCliffs, recentDeals, userAsset } = context;

  // Format score factors
  const factorsSummary = scoreFactors
    .slice(0, 5)
    .map((f) => `- ${f.title}: +${f.points} pts (${f.evidenceLines.map((e) => e.text).join('; ')})`)
    .join('\n');

  // Format watch-outs
  const watchOutsSummary = watchOuts.length > 0
    ? watchOuts.map((w) => `- ${w.title}: ${w.description}`).join('\n')
    : 'No significant concerns identified.';

  // Format patent cliffs
  const cliffsSummary = patentCliffs.length > 0
    ? patentCliffs
        .slice(0, 3)
        .map((c) => `- ${c.drug_name} (${c.indication || 'multiple indications'}): ${formatCurrency(c.revenue_usd)} at risk, expires ${c.expiry_year}`)
        .join('\n')
    : 'No significant patent cliffs identified.';

  // Format recent deals
  const dealsSummary = recentDeals.length > 0
    ? recentDeals
        .slice(0, 3)
        .map((d) => `- ${d.asset_name} (${d.relevance}): ${d.upfront_usd ? formatCurrency(d.upfront_usd) + ' upfront' : 'Terms undisclosed'}, ${formatDate(d.announced_date)}`)
        .join('\n')
    : 'Limited recent deal activity.';

  // Format user asset
  const assetDescription = `${formatters.phase(userAsset.phase)} ${formatters.modality(userAsset.modality)}${
    userAsset.indication_specific ? ` in ${formatters.indication(userAsset.indication_specific)}` :
    userAsset.indication_category ? ` in ${formatters.indicationCategory(userAsset.indication_category)}` : ''
  }`;

  return `You are an expert biotech business development strategist with 20+ years of experience in pharma licensing deals.

Your task is to generate a concise, actionable approach strategy for pitching to ${companyName}.

## CONTEXT

**Target Partner:** ${companyName}
**Company Type:** ${companyType || 'Large Pharma'}
**Match Score:** ${matchScore}%

**Why They Match:**
${factorsSummary}

**Watch-Outs:**
${watchOutsSummary}

**Patent Cliffs:**
${cliffsSummary}

**Recent Deal Activity:**
${dealsSummary}

**Your Asset:** ${assetDescription}${userAsset.territory ? ` (${userAsset.territory} rights)` : ''}

## INSTRUCTIONS

Generate a strategic approach recommendation that:
1. Leads with their strongest motivation to engage (patent cliff urgency, pipeline gap, competitive pressure)
2. Positions the asset in context of their current strategy
3. Addresses the most significant watch-out proactively
4. Is specific to this partner - no generic BD advice

## OUTPUT FORMAT

Respond with a JSON object (no markdown, just the JSON):
{
  "summary": "2-3 sentence strategic summary that captures the key positioning angle and timing consideration",
  "keyPoints": ["Array of 3-4 specific talking points for the pitch, each referencing concrete evidence"],
  "timing": "One sentence on optimal timing or urgency factors",
  "differentiators": ["Array of 2-3 specific differentiators to emphasize based on their portfolio gaps"]
}`;
}

function buildEmailPrompt(context: EmailContext): string {
  const {
    companyName,
    companyType,
    matchScore,
    scoreFactors,
    approachStrategy,
    userAsset,
    tone,
    recipientRole,
    senderName,
    senderCompany,
    recentDeals,
    patentCliffs,
  } = context;

  // Build evidence for personalization
  const topFactor = scoreFactors[0];
  const topEvidence = topFactor?.evidenceLines[0]?.text || 'your active BD strategy';

  // Get relevant deal for hook
  const relevantDeal = recentDeals[0];
  const relevantCliff = patentCliffs.find(
    (c) => c.indication?.toLowerCase().includes(userAsset.indication_category?.toLowerCase() || '')
  );

  // Format asset
  const assetDescription = `${formatters.phase(userAsset.phase)} ${formatters.modality(userAsset.modality)}${
    userAsset.indication_specific ? ` targeting ${formatters.indication(userAsset.indication_specific)}` :
    userAsset.indication_category ? ` in ${formatters.indicationCategory(userAsset.indication_category)}` : ''
  }`;

  const toneInstructions = tone === 'formal'
    ? 'Use a professional, formal tone appropriate for C-suite or SVP-level executives. Be respectful of their time.'
    : 'Use a warm but professional tone. Be personable while maintaining credibility. Slightly less formal.';

  const recipientContext = recipientRole
    ? `The recipient is a ${recipientRole} at ${companyName}.`
    : `The recipient is a senior BD executive at ${companyName}.`;

  const senderContext = senderName && senderCompany
    ? `Sign as ${senderName} from ${senderCompany}.`
    : 'Sign with [Your Name] and [Your Company] placeholders.';

  return `You are drafting a business development outreach email for a biotech executive seeking a licensing partnership.

## CONTEXT

**Target:** ${companyName} (${companyType || 'Large Pharma'})
${recipientContext}
**Match Score:** ${matchScore}%

**Their Key Interest:** ${topFactor?.title || 'Strategic fit'} - ${topEvidence}

${relevantDeal ? `**Their Recent Deal:** ${relevantDeal.asset_name} (${relevantDeal.relevance}), ${formatDate(relevantDeal.announced_date)}` : ''}

${relevantCliff ? `**Their Patent Cliff:** ${relevantCliff.drug_name} expires ${relevantCliff.expiry_year} (${formatCurrency(relevantCliff.revenue_usd)} at risk)` : ''}

**Your Asset:** ${assetDescription}

**Approach Strategy:**
"${approachStrategy.summary}"

Key Points to Convey:
${approachStrategy.keyPoints.map((p) => `- ${p}`).join('\n')}

## INSTRUCTIONS

Write a personalized outreach email that:
1. Opens with a specific hook referencing their recent activity, strategic need, or patent cliff - NOT a generic opener
2. Briefly introduces the asset (1-2 sentences max) with its key differentiation
3. Connects explicitly to their strategic priorities (reference specific evidence)
4. Proposes a specific, low-commitment next step (15-min call, brief deck sharing, etc.)

${toneInstructions}

**Length:** 150-200 words maximum. Executives skim - be concise.

${senderContext}

## OUTPUT FORMAT

Respond with a JSON object (no markdown, just the JSON):
{
  "subject": "Email subject line (50 chars max, specific and intriguing)",
  "body": "Full email body with proper paragraph breaks (use \\n\\n for paragraphs)"
}`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(value: number): string {
  if (value >= 1000000000) {
    return `$${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(0)}M`;
  }
  return `$${value.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function parseJsonResponse<T>(text: string): T {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  // Clean up control characters that can appear in AI-generated JSON
  let cleanedJson = jsonMatch[0]
    // Replace actual newlines inside strings with escaped newlines
    .replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, '\\n')
    // Replace tabs with spaces
    .replace(/\t/g, ' ')
    // Remove other control characters
    .replace(/[\x00-\x1F\x7F]/g, (char) => {
      if (char === '\n' || char === '\r') return '\\n';
      if (char === '\t') return ' ';
      return '';
    });

  try {
    return JSON.parse(cleanedJson) as T;
  } catch (e) {
    // If still failing, try a more aggressive cleanup
    cleanedJson = jsonMatch[0]
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/\s+/g, ' ');
    return JSON.parse(cleanedJson) as T;
  }
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class OutreachGenerator {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Generate an approach strategy for a partner match
   */
  async generateApproachStrategy(request: StrategyGenerationRequest): Promise<ApproachStrategy> {
    const context: StrategyContext = {
      companyName: request.company_name,
      companyType: request.company_type,
      matchScore: request.match_score,
      scoreFactors: request.score_factors,
      watchOuts: request.watch_outs,
      patentCliffs: request.patent_cliffs,
      recentDeals: request.recent_deals,
      userAsset: request.user_asset,
    };

    const prompt = buildStrategyPrompt(context);

    const message = await this.client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 768,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    const parsed = parseJsonResponse<{
      summary: string;
      keyPoints: string[];
      timing?: string;
      differentiators?: string[];
    }>(textContent.text);

    return {
      summary: parsed.summary,
      keyPoints: parsed.keyPoints,
      timing: parsed.timing,
      differentiators: parsed.differentiators,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate an outreach email for a partner match
   */
  async generateOutreachEmail(request: OutreachGenerationRequest): Promise<{
    email: OutreachEmail;
    approach_strategy: ApproachStrategy;
  }> {
    const { match_context, user_asset, tone = 'formal', recipient_role, sender_name, sender_company } = request;

    // First, generate the approach strategy (or use provided one)
    const strategyRequest: StrategyGenerationRequest = {
      company_id: request.company_id,
      company_name: request.company_name,
      company_type: null, // Will be fetched if needed
      match_score: match_context.score,
      score_factors: match_context.factors,
      watch_outs: match_context.watch_outs,
      patent_cliffs: match_context.strategic_context.patent_cliffs,
      recent_deals: [], // Will be populated from context if available
      user_asset,
    };

    const approachStrategy = await this.generateApproachStrategy(strategyRequest);

    // Now generate the email
    const emailContext: EmailContext = {
      companyName: request.company_name,
      companyType: null,
      matchScore: match_context.score,
      scoreFactors: match_context.factors,
      watchOuts: match_context.watch_outs,
      patentCliffs: match_context.strategic_context.patent_cliffs,
      recentDeals: [],
      userAsset: user_asset,
      approachStrategy,
      tone,
      recipientRole: recipient_role,
      senderName: sender_name,
      senderCompany: sender_company,
    };

    const prompt = buildEmailPrompt(emailContext);

    const message = await this.client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    const parsed = parseJsonResponse<{
      subject: string;
      body: string;
    }>(textContent.text);

    const email: OutreachEmail = {
      subject: parsed.subject,
      body: parsed.body,
      tone,
      generatedAt: new Date().toISOString(),
    };

    return { email, approach_strategy: approachStrategy };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let generatorInstance: OutreachGenerator | null = null;

export function getOutreachGenerator(): OutreachGenerator {
  if (!generatorInstance) {
    generatorInstance = new OutreachGenerator();
  }
  return generatorInstance;
}
