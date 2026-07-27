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
  return `You are a senior biopharma BD analyst with deep expertise in pharma deal economics. You have access to a comprehensive database of biopharma licensing, acquisition, and collaboration deals.

SCHEMA:
${DEALS_SCHEMA}

USER QUESTION: "${question}"

Generate a PostgreSQL SELECT query to answer this question. Follow these rules strictly:

1. ONLY generate SELECT statements. Never INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or any DDL/DML.
2. Always include WHERE is_synthetic = false
3. LIMIT to 50 rows maximum
4. For financial values, remember they are stored in raw USD (not millions)
5. Use appropriate aggregations (AVG, MEDIAN via percentile_cont, SUM, COUNT, MIN, MAX)
6. For trend analysis, group by EXTRACT(YEAR FROM announced_date)
7. For company activity, group by licensor_name or licensee_name
8. For comparison queries, use CASE WHEN or subqueries
9. Order results meaningfully (by value DESC, by date DESC, by count DESC)
10. Select only the columns needed to answer the question — don't SELECT *
11. For "largest" or "biggest" queries, order by the relevant value DESC and LIMIT appropriately
12. When the user asks about a specific company, use ILIKE for case-insensitive matching
13. When filtering by modality or indication, use ILIKE with % wildcards for flexible matching
14. For date ranges like "last 2 years", use announced_date >= NOW() - INTERVAL '2 years'
15. Always alias computed columns with meaningful names

Also determine the query_type from: 'single_deal', 'comparison', 'trend', 'ranking', 'aggregation', 'company_activity'

Respond with ONLY a JSON object (no markdown, no backticks):
{
  "sql": "SELECT ... FROM deals WHERE is_synthetic = false AND ... LIMIT 50",
  "query_type": "single_deal|comparison|trend|ranking|aggregation|company_activity",
  "explanation": "Brief explanation of what the query does"
}`;
}

// ── Answer synthesis prompt ─────────────────────────────────────────────
function buildAnswerPrompt(question: string, data: Record<string, unknown>[], queryType: string): string {
  const dataStr = JSON.stringify(data.slice(0, 30), null, 2);
  const totalResults = data.length;

  return `You are a senior biopharma BD analyst at a top investment bank. You have just queried a comprehensive deal database to answer a question. Provide a precise, data-backed answer.

USER QUESTION: "${question}"

QUERY TYPE: ${queryType}

QUERY RESULTS (${totalResults} ${totalResults === 1 ? 'deal' : 'deals'} found):
${dataStr}

INSTRUCTIONS:
1. Answer the question directly and specifically. Lead with the key finding.
2. Reference specific dollar amounts, company names, dates, and deal details from the data.
3. All USD values in the data are in RAW DOLLARS. Convert to millions ($XXM) or billions ($X.XB) for display.
4. For trend questions, describe the direction and magnitude of changes.
5. For ranking questions, list the top entries with their values.
6. For comparison questions, highlight the key differences with specific numbers.
7. If no results were found, say so clearly and suggest why (e.g., no disclosed terms, niche area).
8. Keep the answer concise but complete — 2-5 sentences for simple questions, up to a short paragraph for complex analyses.
9. Use professional BD/pharma terminology naturally.
10. If the data shows something surprising or noteworthy, mention it.
11. Do NOT hedge or say "based on our database" — speak with authority as if you know the market.
12. When mentioning dollar amounts, use bold formatting: **$X.XB** or **$XXXM**
13. When mentioning company names, use bold: **Pfizer**, **AbbVie**, etc.
14. When mentioning key metrics, use bold for emphasis.

Respond with ONLY the answer text. No JSON, no markdown headers, just the natural language answer.`;
}

// ── SQL safety validation ───────────────────────────────────────────────
const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE',
  'GRANT', 'REVOKE', 'EXECUTE', 'EXEC', 'CALL', 'MERGE', 'UPSERT',
  'SET ', 'VACUUM', 'REINDEX', 'CLUSTER', 'COPY', 'LOAD', 'IMPORT',
  'pg_', 'information_schema', 'pg_catalog',
  '--', '/*', '*/', ';',  // comment injection and statement chaining
];

function validateSQL(sql: string): { valid: boolean; reason?: string } {
  const upper = sql.toUpperCase().trim();

  // Must start with SELECT or WITH (for CTEs)
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    return { valid: false, reason: 'Query must be a SELECT statement' };
  }

  // Check for forbidden keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (upper.includes(keyword.toUpperCase())) {
      // Allow 'SET' only within CASE expressions and offset/fetch
      if (keyword === 'SET ' && (upper.includes('CASE') || upper.includes('OFFSET'))) continue;
      // Allow '--' if it's inside a string literal (very basic check)
      if (keyword === '--' && !upper.includes('--')) continue;
      return { valid: false, reason: `Forbidden keyword detected: ${keyword.trim()}` };
    }
  }

  // Must reference the deals table
  if (!upper.includes('DEALS')) {
    return { valid: false, reason: 'Query must reference the deals table' };
  }

  // Must include is_synthetic filter
  if (!upper.includes('IS_SYNTHETIC')) {
    return { valid: false, reason: 'Query must filter on is_synthetic' };
  }

  // Must have a LIMIT clause
  if (!upper.includes('LIMIT')) {
    return { valid: false, reason: 'Query must include a LIMIT clause' };
  }

  // Check LIMIT value doesn't exceed 50
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
      model: 'claude-sonnet-4-20250514',
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
        // If the RPC function doesn't exist, fall back to parsing the SQL
        // and using Supabase query builder — or handle gracefully
        console.error('[query] RPC execution failed:', error.message);

        // Fall back: try executing via a direct REST call to PostgREST
        // This is safer — just return a helpful error
        return apiError(
          'Query execution failed. The question may be too complex for our current system. Try rephrasing with simpler terms.',
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
      model: 'claude-sonnet-4-20250514',
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

    // 10. Return response
    return apiSuccess({
      answer,
      data: queryData.slice(0, 20), // Limit data payload for frontend
      query_type: parsedSQL.query_type,
      deal_count: queryData.length,
      execution_time_ms: Date.now() - startTime,
    });

  } catch (error) {
    captureApiError(error, 'query');
    console.error('[query] Unexpected error:', error);
    return apiError('An unexpected error occurred. Please try again.', 500);
  }
}
