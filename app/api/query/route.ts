/**
 * Natural Language Deal Query API
 *
 * Accepts plain English questions about the deal database, uses Claude to
 * parse into SQL, executes against Supabase, then synthesizes a data-backed
 * natural language answer.
 *
 * Auth: Pro+ tier required (Pro, Report, Portfolio).
 * Rate limits: 50/day Pro, 200/day Portfolio.
 *
 * POST /api/query
 * Body: { question: string }
 * Response: { answer: string, data: any[], query_type: string, deal_count: number }
 */

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { isProEmail } from '@/lib/config/authorized-emails';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { captureApiError } from '@/lib/sentry-api';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';
import { LIVE_DEAL_COUNT, formatDealCount } from '@/lib/config/constants';

export const maxDuration = 60;

// ── Deals table schema for Claude's SQL generation ──────────────────────
const DEALS_SCHEMA = `
Table: deals (${formatDealCount(LIVE_DEAL_COUNT)} verified biopharma deals)

Columns:
  id                        UUID PRIMARY KEY
  licensor_name             TEXT          -- Company licensing out the asset (seller/biotech)
  licensee_name             TEXT          -- Company licensing in the asset (buyer/pharma)
  asset_name                TEXT          -- Drug/candidate name
  asset_description         TEXT          -- Brief description of the asset
  modality                  TEXT          -- e.g. 'ADC', 'mAb', 'bispecific', 'small molecule', 'gene therapy', 'cell therapy', 'RNAi', 'ASO', 'peptide', 'GLP-1 agonist', 'mRNA', 'radiopharmaceutical', 'CAR-T', 'degrader'
  indication_category       TEXT          -- Broad indication (e.g. 'solid tumors', 'breast cancer', 'NSCLC', 'Alzheimer''s', 'lupus')
  indication_specific       TEXT          -- More specific indication if available
  therapeutic_area          TEXT          -- 'oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular', 'infectiousDisease', 'ophthalmology', 'womensHealth', 'rareDisease', 'hematology', 'dermatology', 'gastroenterology'
  target                    TEXT          -- Molecular target (e.g. 'HER2', 'PD-1', 'EGFR', 'GLP-1R', 'CD19')
  mechanism_of_action       TEXT          -- How the drug works
  phase_at_signing          TEXT          -- 'preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved', 'discovery'
  territory                 TEXT          -- Deal territory scope
  territories_included      TEXT          -- Specific territories included
  exclusivity               TEXT          -- Exclusivity terms
  deal_type                 TEXT          -- 'license', 'acquisition', 'collaboration', 'co_development', 'option'
  deal_status               TEXT          -- Deal status
  upfront_usd               BIGINT        -- Upfront payment in raw USD (NOT millions). e.g., 500000000 = $500M
  milestones_total_usd      BIGINT        -- Total milestone payments in raw USD
  milestones_development_usd BIGINT       -- Development milestones in raw USD
  milestones_regulatory_usd BIGINT        -- Regulatory milestones in raw USD
  milestones_commercial_usd BIGINT        -- Commercial/sales milestones in raw USD
  total_deal_value_usd      BIGINT        -- Total potential deal value in raw USD (upfront + milestones + royalties capitalized)
  royalty_low_pct           NUMERIC       -- Low end of royalty range (percentage, e.g. 5.0 = 5%)
  royalty_high_pct          NUMERIC       -- High end of royalty range
  equity_investment_usd     BIGINT        -- Equity investment component in raw USD
  option_exercise_fee       BIGINT        -- Option exercise fee in raw USD
  research_funding_usd      BIGINT        -- Research funding in raw USD
  profit_share_pct          NUMERIC       -- Profit share percentage
  includes_manufacturing    BOOLEAN       -- Whether deal includes manufacturing rights
  includes_co_development   BOOLEAN       -- Whether deal includes co-development
  includes_co_promotion     BOOLEAN       -- Whether deal includes co-promotion
  announced_date            DATE          -- When the deal was announced (YYYY-MM-DD)
  effective_date            DATE          -- When the deal became effective
  terms_disclosed           BOOLEAN       -- Whether financial terms are publicly disclosed
  is_synthetic              BOOLEAN       -- Whether this is a synthetic/fabricated deal (always filter to false)
  regulatory_designations   TEXT          -- FDA designations (breakthrough, fast track, etc.)
  source_type               TEXT          -- Source type (SEC 8-K, press release, etc.)
  source_url                TEXT          -- URL to the source document

IMPORTANT NOTES:
- All USD values are stored in RAW DOLLARS (not millions). $500M = 500000000. Always divide by 1000000 when displaying.
- Always filter: is_synthetic = false (exclude fabricated test data)
- For "largest" queries, use total_deal_value_usd or upfront_usd depending on context
- phase_at_signing uses underscores: 'phase_1', 'phase_2', 'phase_3' (not 'Phase 1')
- therapeutic_area uses camelCase: 'oncology', 'neurology', 'rareDisease', etc.
- When counting deals, use COUNT(*) not COUNT(id) for consistency
- For trend queries, use EXTRACT(YEAR FROM announced_date) to group by year
- Use COALESCE for NULL-safe aggregations
- LIMIT results to 50 rows maximum
`;

// ── SQL parsing prompt ──────────────────────────────────────────────────
function buildSQLPrompt(question: string): string {
  return `You are a senior biopharma BD analyst at Ambrosia Ventures with 15+ years of deal experience. You have access to one of the most comprehensive proprietary databases of biopharma licensing, acquisition, and collaboration deals in the industry.

SCHEMA:
${DEALS_SCHEMA}

USER QUESTION: "${question}"

Your job is to generate the BEST possible PostgreSQL query to answer this question. Think step by step:

1. What is the user really asking? Map their natural language to the right columns and filters.
2. What context would make the answer most useful? (e.g., if they ask about a company's deals, also pull the deal types, phases, and values — not just counts)
3. Would a comparison or benchmark make the answer more insightful? (e.g., if they ask about ADC upfronts, also compute the overall median for context)

QUERY RULES:
- ONLY SELECT statements. Never INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or DDL.
- Always include WHERE is_synthetic = false
- LIMIT to 50 rows maximum
- USD values are stored in RAW DOLLARS (not millions). $500M = 500000000.
- Use percentile_cont(0.5) WITHIN GROUP (ORDER BY col) for medians — not AVG
- For trend analysis, use EXTRACT(YEAR FROM announced_date)
- Use ILIKE with % wildcards for fuzzy matching on company names, modalities, indications
- For date ranges like "last 2 years", use announced_date >= NOW() - INTERVAL '2 years'
- For "recent" or "latest", order by announced_date DESC
- Always alias computed columns with meaningful names
- When querying specific deals, include: licensor_name, licensee_name, asset_name, deal_type, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date
- When aggregating, include COUNT(*) as deal_count alongside averages/medians
- Prefer percentile_cont for financial medians over AVG (medians resist outlier skew)
- For modality matching: 'ADC' = antibody-drug conjugate, 'mAb' = monoclonal antibody, 'CAR-T' = CAR-T cell therapy
- For company matching: try both licensor_name and licensee_name when the question says "company" without specifying buyer/seller
- NULL-safe: use COALESCE or filter WHERE column IS NOT NULL for financial aggregations

SMART PATTERNS:
- "How does X compare to Y?" → Use CASE WHEN or two CTEs side by side
- "What's the trend?" → Group by year, show count + median value per year
- "Who is most active?" → COUNT(*) GROUP BY company, but also SUM(total_deal_value_usd) for context
- "What's the average/typical deal?" → Use percentile_cont(0.5) for median, also show 25th and 75th percentile
- "Largest deals" → ORDER BY total_deal_value_usd DESC, include deal details not just numbers

Also determine the query_type from: 'single_deal', 'comparison', 'trend', 'ranking', 'aggregation', 'company_activity', 'benchmark'

Respond with ONLY a JSON object (no markdown, no backticks):
{
  "sql": "SELECT ... FROM deals WHERE is_synthetic = false AND ... LIMIT 50",
  "query_type": "single_deal|comparison|trend|ranking|aggregation|company_activity|benchmark",
  "explanation": "Brief explanation of what the query does"
}`;
}

// ── Answer synthesis prompt ─────────────────────────────────────────────
function buildAnswerPrompt(question: string, data: Record<string, unknown>[], queryType: string): string {
  const dataStr = JSON.stringify(data.slice(0, 30), null, 2);
  const totalResults = data.length;

  return `You are a senior biopharma BD analyst at Ambrosia Ventures — an elite life sciences advisory firm. You have just queried a proprietary database of ${formatDealCount(LIVE_DEAL_COUNT)} verified deals. Provide an answer that demonstrates deep market intelligence.

USER QUESTION: "${question}"

QUERY TYPE: ${queryType}

QUERY RESULTS (${totalResults} ${totalResults === 1 ? 'deal' : 'deals'} found):
${dataStr}

INSTRUCTIONS:
1. Lead with the key finding — the single most important number or insight.
2. All USD values in the data are RAW DOLLARS. Convert: $500M not $500000000. Use **$X.XB** or **$XXXM** bold formatting.
3. Bold company names: **Pfizer**, **AbbVie**, etc.
4. Bold key metrics and percentages for emphasis.
5. After the direct answer, add ONE sentence of strategic context — what does this mean for someone doing deals in this space? This is what separates a database lookup from intelligence.
6. For trend questions: describe direction, magnitude, AND what's driving it.
7. For ranking questions: list top entries with values, then note any pattern (e.g., "dominated by Big Pharma buyers" or "mostly preclinical platform deals").
8. For comparison questions: lead with the delta, then explain WHY the difference exists.
9. If no results found: say so, explain why (undisclosed terms, niche area, or suggest rephrasing), and offer what adjacent data IS available.
10. If the data shows something surprising or counter-intuitive, call it out explicitly — that's the insight the user came for.
11. Keep it tight: 2-4 sentences for simple questions, up to 6 for complex analyses. Never ramble.
12. Speak with authority. No hedging ("it appears", "it seems"), no disclaimers ("based on available data"). You KNOW this market.
13. Use deal terminology naturally: upfront, TDV, milestones, CVR, royalty, option, bolt-on, platform deal, out-licensing.

Respond with ONLY the answer text. No JSON, no markdown headers, no bullet points — flowing prose that reads like a senior analyst briefing.`;
}

// ── SQL safety validation ───────────────────────────────────────────────
const FORBIDDEN_PATTERNS = [
  /\bINSERT\b/, /\bUPDATE\b/, /\bDELETE\b/, /\bDROP\b/, /\bALTER\b/,
  /\bTRUNCATE\b/, /\bCREATE\b/, /\bGRANT\b/, /\bREVOKE\b/,
  /\bEXECUTE\s/, /\bMERGE\b/, /\bUPSERT\b/,
  /\bVACUUM\b/, /\bREINDEX\b/, /\bCOPY\b/,
  /\bpg_/, /\binformation_schema\b/, /\bpg_catalog\b/,
  /--/, /\/\*/, /\*\//, /;\s*$/,
];

function validateSQL(sql: string): { valid: boolean; reason?: string } {
  const upper = sql.toUpperCase().trim();

  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    return { valid: false, reason: 'Query must be a SELECT statement' };
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    const upperPattern = new RegExp(pattern.source, 'i');
    if (upperPattern.test(sql)) {
      return { valid: false, reason: 'Forbidden SQL pattern detected' };
    }
  }

  if (!upper.includes('DEALS')) {
    return { valid: false, reason: 'Query must reference the deals table' };
  }

  if (!upper.includes('IS_SYNTHETIC')) {
    return { valid: false, reason: 'Query must filter on is_synthetic' };
  }

  if (!upper.includes('LIMIT')) {
    return { valid: false, reason: 'Query must include a LIMIT clause' };
  }

  const limitMatch = upper.match(/LIMIT\s+(\d+)/);
  if (limitMatch && parseInt(limitMatch[1]) > 50) {
    return { valid: false, reason: 'LIMIT must not exceed 50' };
  }

  return { valid: true };
}

// ── Question validation ─────────────────────────────────────────────────
function validateQuestion(question: string): { valid: boolean; reason?: string } {
  if (!question || typeof question !== 'string') {
    return { valid: false, reason: 'Question is required' };
  }

  const trimmed = question.trim();

  if (trimmed.length < 5) {
    return { valid: false, reason: 'Question is too short' };
  }

  if (trimmed.length > 500) {
    return { valid: false, reason: 'Question must be under 500 characters' };
  }

  // Check for SQL injection attempts in the question itself
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|UNION|EXEC)\b.*\b(FROM|INTO|TABLE|DATABASE)\b)/i;
  if (sqlPatterns.test(trimmed)) {
    return { valid: false, reason: 'Invalid question format' };
  }

  return { valid: true };
}

// ── Follow-up suggestion generator ────────────────────────────────────
function generateFollowUps(question: string, queryType: string, resultCount: number): string[] {
  const q = question.toLowerCase();
  const suggestions: string[] = [];

  if (queryType === 'ranking' || queryType === 'aggregation') {
    if (q.includes('upfront')) suggestions.push('How do these upfronts compare to total deal values?');
    if (q.includes('oncology')) suggestions.push('How does this compare to immunology deals?');
    if (q.includes('phase 2')) suggestions.push('What about Phase 3 — how do the economics change?');
    if (q.includes('phase 3')) suggestions.push('How do Phase 2 economics compare?');
    if (!q.includes('trend')) suggestions.push('How has this trended over the last 3 years?');
  }

  if (queryType === 'company_activity') {
    suggestions.push('What modalities are they most active in?');
    suggestions.push('How do their deal sizes compare to competitors?');
  }

  if (queryType === 'single_deal') {
    suggestions.push('What are comparable deals in this therapeutic area?');
    suggestions.push('What is the median upfront for this modality and phase?');
  }

  if (queryType === 'trend') {
    suggestions.push('Which companies are driving this trend?');
    suggestions.push('How does this compare across different modalities?');
  }

  if (q.includes('adc')) suggestions.push('How do ADC deal terms compare to bispecifics?');
  if (q.includes('car-t') || q.includes('cell therapy')) suggestions.push('What are the largest CAR-T deals by total value?');
  if (q.includes('lilly') || q.includes('eli lilly')) suggestions.push('How does Lilly\'s deal activity compare to Pfizer and AbbVie?');

  if (suggestions.length === 0) {
    suggestions.push('What are the largest deals in this space?');
    suggestions.push('How have deal values trended over the last 3 years?');
  }

  return suggestions.slice(0, 3);
}

// ── Main handler ────────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();

  try {
    // 1. Rate limiting
    const identifier = getIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, 'query', RATE_LIMIT_CONFIGS.aiGeneration);
    if (!rateLimitResult.success) {
      return apiErrorWithHeaders(
        'Query rate limit exceeded. Pro users get 50 queries/day, Portfolio users get 200/day.',
        429,
        getRateLimitHeaders(rateLimitResult),
        'RATE_LIMITED'
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { question } = body as { question: string };

    // 3. Validate question
    const questionValidation = validateQuestion(question);
    if (!questionValidation.valid) {
      return apiError(questionValidation.reason!, 400, 'INVALID_QUESTION');
    }

    // 4. Authentication — require Pro+ tier
    const supabase = createServiceClient();
    let authorized = false;
    let userTier: string = 'free';

    try {
      const authUser = await getAuthenticatedUser(request);
      if (authUser?.id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, tier, email')
          .eq('id', authUser.id)
          .single();

        if (profile) {
          userTier = profile.tier || 'free';
          if (userTier === 'pro' || userTier === 'report' || userTier === 'portfolio') {
            authorized = true;
          }
          if (!authorized && profile.email && isProEmail(profile.email)) {
            authorized = true;
            userTier = 'pro';
          }
        }
      }
    } catch {
      // Auth check failed
    }

    if (!authorized) {
      return apiError(
        'Deal Query requires a Pro or Portfolio subscription. Upgrade to unlock AI-powered deal intelligence.',
        403,
        'PRO_REQUIRED'
      );
    }

    // 5. Call Claude to generate SQL
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return apiError('AI service is not configured', 500, 'CONFIG_ERROR');
    }

    const anthropic = new Anthropic({ apiKey });

    const sqlResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildSQLPrompt(question) }],
    });

    const sqlText = sqlResponse.content[0].type === 'text' ? sqlResponse.content[0].text : '';

    // Parse the JSON response
    let parsedSQL: { sql: string; query_type: string; explanation: string };
    try {
      // Strip any markdown formatting if present
      const cleanedText = sqlText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedSQL = JSON.parse(cleanedText);
    } catch {
      return apiError('Failed to parse query generation response', 500, 'PARSE_ERROR');
    }

    // 6. Validate the generated SQL
    const sqlValidation = validateSQL(parsedSQL.sql);
    if (!sqlValidation.valid) {
      return apiError(`Query safety check failed: ${sqlValidation.reason}`, 400, 'UNSAFE_QUERY');
    }

    // 7. Execute the query against Supabase using raw SQL via rpc
    // We use Supabase's rpc to call a server-side function, or fall back to direct query
    let queryData: Record<string, unknown>[];
    try {
      // Use Supabase's PostgreSQL function for raw queries
      // The service client has full access
      const { data, error } = await supabase.rpc('execute_readonly_query', {
        query_text: parsedSQL.sql,
      });

      if (error) {
        console.error('[query] RPC execution failed:', error.message, 'SQL:', parsedSQL.sql);
        return apiError(
          'Query execution failed. Try rephrasing with simpler terms.',
          422,
          'QUERY_EXECUTION_ERROR'
        );
      }

      queryData = (data as Record<string, unknown>[]) || [];
    } catch (queryError) {
      console.error('[query] Query execution error:', queryError);
      return apiError(
        'Query execution failed. Try rephrasing your question.',
        500,
        'QUERY_EXECUTION_ERROR'
      );
    }

    // 8. Synthesize answer with Claude
    const answerResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildAnswerPrompt(question, queryData, parsedSQL.query_type) }],
    });

    const answer = answerResponse.content[0].type === 'text' ? answerResponse.content[0].text : '';

    // 9. Log the query for analytics
    try {
      await supabase.from('query_logs').insert({
        question: question.slice(0, 500),
        query_type: parsedSQL.query_type,
        result_count: queryData.length,
        execution_time_ms: Date.now() - startTime,
        user_tier: userTier,
      });
    } catch {
      // Non-critical — don't fail the request
    }

    // 10. Generate follow-up suggestions
    const followUps = generateFollowUps(question, parsedSQL.query_type, queryData.length);

    // 11. Return response
    return apiSuccess({
      answer,
      data: queryData.slice(0, 20),
      query_type: parsedSQL.query_type,
      deal_count: queryData.length,
      execution_time_ms: Date.now() - startTime,
      follow_ups: followUps,
    });

  } catch (error) {
    captureApiError(error, 'query');
    console.error('[query] Unexpected error:', error);
    return apiError('An unexpected error occurred. Please try again.', 500);
  }
}
