/**
 * AI-powered competitor content analysis.
 * Uses Claude to assess keyword overlap, relevance, and suggest responses
 * for competitor articles detected via RSS monitoring.
 */

import Anthropic from '@anthropic-ai/sdk';
import { type CompetitorEntry } from './competitor-monitor';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AnalyzedEntry {
  source: string;
  url: string;
  title: string;
  description: string;
  publishedAt: string | null;
  keywordOverlap: string[];
  relevanceScore: number;
  analysis: string;
  suggestedResponse: string;
}

// ── Target keywords ──────────────────────────────────────────────────────────

const TARGET_KEYWORDS = [
  'oncology licensing',
  'pharma deal benchmarks',
  'biotech out-licensing',
  'upfront payments',
  'milestone payments',
  'royalty rates',
  'deal valuation',
  'rNPV',
  'Monte Carlo',
];

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyze competitor content entries for relevance and keyword overlap.
 * Sends up to 20 entries to Claude in a single batch.
 * Returns only entries with relevance > 0.3.
 */
export async function analyzeCompetitorContent(
  entries: CompetitorEntry[]
): Promise<AnalyzedEntry[]> {
  if (entries.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  // Limit to 20 entries per batch
  const batch = entries.slice(0, 20);

  const entrySummaries = batch
    .map(
      (e, i) =>
        `[${i}] Source: ${e.source}\n    Title: ${e.title}\n    Description: ${e.description}\n    URL: ${e.url}`
    )
    .join('\n\n');

  const prompt = `You are a competitive intelligence analyst for a biopharma deal benchmarking platform (Ambrosia Benchmarker). Analyze these competitor content pieces.

## Our Target Keywords
${TARGET_KEYWORDS.map((k) => `- ${k}`).join('\n')}

## Competitor Content
${entrySummaries}

## Instructions
For each content piece, assess:
1. **keywordOverlap**: Which of our target keywords does this content compete with? List only matching keywords.
2. **relevanceScore**: How relevant is this to our business (0.0 = not relevant, 1.0 = directly competing)? Consider: Does it cover deal benchmarking, licensing terms, valuation methods, or pharma deal structures?
3. **analysis**: Write a 2-sentence competitive analysis explaining the threat/opportunity.
4. **suggestedResponse**: Suggest a specific page topic or content piece we could create in response.

## Response Format
Return ONLY valid JSON with no additional text:
{
  "results": [
    {
      "index": 0,
      "keywordOverlap": ["keyword1", "keyword2"],
      "relevanceScore": 0.7,
      "analysis": "Two sentence analysis here.",
      "suggestedResponse": "Suggested response topic here"
    }
  ]
}`;

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in Claude response');
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    results: {
      index: number;
      keywordOverlap: string[];
      relevanceScore: number;
      analysis: string;
      suggestedResponse: string;
    }[];
  };

  // Merge analysis results with original entries, filter by relevance
  const analyzed: AnalyzedEntry[] = [];

  for (const result of parsed.results) {
    if (result.index < 0 || result.index >= batch.length) continue;
    if (result.relevanceScore <= 0.3) continue;

    const entry = batch[result.index];
    analyzed.push({
      source: entry.source,
      url: entry.url,
      title: entry.title,
      description: entry.description,
      publishedAt: entry.publishedAt,
      keywordOverlap: result.keywordOverlap,
      relevanceScore: result.relevanceScore,
      analysis: result.analysis,
      suggestedResponse: result.suggestedResponse,
    });
  }

  return analyzed;
}
