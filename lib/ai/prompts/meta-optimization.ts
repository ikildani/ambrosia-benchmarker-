/**
 * Prompt template for CTR optimization via meta title/description rewriting.
 * Used by the ctr-optimizer to generate improved meta tags based on GSC data.
 */

export interface MetaOptParams {
  currentTitle: string;
  currentDescription: string;
  pagePath: string;
  topQueries: { query: string; impressions: number; ctr: number; position: number }[];
}

export function generateMetaOptimizationPrompt(params: MetaOptParams): string {
  const { currentTitle, currentDescription, pagePath, topQueries } = params;

  const queryTable = topQueries
    .map(
      (q) =>
        `- "${q.query}" | ${q.impressions} impressions | ${q.ctr.toFixed(1)}% CTR | position ${q.position.toFixed(1)}`
    )
    .join('\n');

  return `You are an SEO expert specializing in biopharma and life sciences content. Your task is to optimize the meta title and description for a web page to increase its click-through rate (CTR) from Google search results.

## Current Meta Tags
- **Page path**: ${pagePath}
- **Title**: ${currentTitle}
- **Description**: ${currentDescription}

## Top Search Queries Driving Impressions
${queryTable}

## Instructions
1. Analyze the current meta title and description for weaknesses (vague language, missing keywords, lack of specificity).
2. Consider the top search queries that are driving impressions to this page. The meta tags should align with user search intent.
3. Write an improved title (maximum 60 characters) that:
   - Includes the most relevant keyword from the top queries
   - Uses specificity (numbers, data points, year) where appropriate
   - Creates urgency or value proposition
   - Matches the dominant search intent
4. Write an improved description (maximum 155 characters) that:
   - Expands on the title with a compelling value proposition
   - Includes secondary keywords from the query list
   - Contains a clear call to action or benefit statement
   - Uses numbers or data points to build credibility
5. Focus on: specificity, numbers, urgency, matching search intent.

## Response Format
Return ONLY valid JSON with no additional text:
{
  "title": "improved title here (max 60 chars)",
  "description": "improved description here (max 155 chars)",
  "reasoning": "1-2 sentence explanation of why these changes should improve CTR"
}`;
}
