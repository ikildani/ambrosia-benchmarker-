/**
 * SEO-optimized prompt template for daily blog generation.
 * Produces structured JSON output with real benchmark data and comparable deals.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface SEOBlogPromptParams {
  therapeuticArea: string;
  taLabel: string;
  phase: string;
  phaseLabel: string;
  modality: string;
  modalityLabel: string;
  dealType: string;
  dealTypeLabel: string;
  phaseData: {
    upfront: { low: number; median: number; high: number };
    totalValue: { low: number; median: number; high: number };
    royalty: { base: number; max: number };
  };
  comparableDeals: {
    licensor: string;
    licensee: string;
    upfront: number;
    totalDealValue: number;
    year: number;
  }[];
}

// ── Prompt generator ─────────────────────────────────────────────────────────

export function generateSEOBlogPrompt(params: SEOBlogPromptParams): string {
  const {
    therapeuticArea,
    taLabel,
    phase,
    phaseLabel,
    modality,
    modalityLabel,
    dealType,
    dealTypeLabel,
    phaseData,
    comparableDeals,
  } = params;

  const dealsList = comparableDeals
    .map(
      (d) =>
        `- ${d.licensor} / ${d.licensee} (${d.year}): $${d.upfront}M upfront, $${d.totalDealValue}M total deal value`,
    )
    .join('\n');

  return `You are an expert pharmaceutical business development analyst writing SEO-optimized content for biotech founders, BD executives, and investors. Write a comprehensive blog post about ${modalityLabel} ${taLabel} ${dealTypeLabel} deal benchmarks at the ${phaseLabel} stage.

## Target Keyword
"${modalityLabel.toLowerCase()} ${taLabel.toLowerCase()} ${dealTypeLabel.toLowerCase()} deal terms ${phaseLabel.toLowerCase()}"

## Exact Benchmark Data (use these numbers — do not fabricate)
- Therapeutic Area: ${taLabel} (${therapeuticArea})
- Phase: ${phaseLabel} (${phase})
- Modality: ${modalityLabel} (${modality})
- Deal Type: ${dealTypeLabel} (${dealType})
- ${phaseLabel} Upfront Payment Range: $${phaseData.upfront.low}M - $${phaseData.upfront.high}M (median $${phaseData.upfront.median}M)
- ${phaseLabel} Total Deal Value Range: $${phaseData.totalValue.low}M - $${phaseData.totalValue.high}M
- Royalty Range: ${phaseData.royalty.base}% - ${phaseData.royalty.max}%

## Real Comparable Deals (reference by name)
${dealsList || 'No directly comparable deals available — focus on benchmark data.'}

## Article Requirements

### Word Count
Approximately 1,500 words.

### Structure
1. **Introduction** (150-200 words): Open with a key stat hook from the benchmark data. Establish why this specific combination matters for deal-makers.
2. **Data Analysis** (400-500 words): Deep dive into the benchmark numbers. Include an HTML table comparing upfront, milestones, and total deal values across low/median/high scenarios. Discuss how ${modalityLabel} valuations differ from broader ${taLabel} averages.
3. **Real Deal Examples** (300-400 words): Reference the specific comparable deals listed above by licensor and licensee name. Analyze what drove the deal economics in each case.
4. **Implications for Founders** (250-350 words): Practical negotiation advice for biotech founders entering ${dealTypeLabel} discussions at the ${phaseLabel} stage. What leverage points exist? What terms to watch?
5. **FAQ Section**: 5 questions with concise answers relevant to ${modalityLabel} ${taLabel} ${dealTypeLabel} deals.

### Internal Links (include naturally in the content)
- [Deal Calculator](/calculator) — for running custom benchmarks
- [${taLabel} Benchmarks](/benchmarks?ta=${therapeuticArea}) — for exploring ${taLabel} data
- [Therapeutic Area Overview](/therapeutic-areas/${therapeuticArea}) — for full ${taLabel} landscape

### Tone & Style
- Written for a BD professional audience — informed, data-driven, practical
- Not too academic, not too casual
- Specific numbers and real deal names wherever possible
- Actionable insights, not generic observations

### SEO Requirements
- Use the target keyword in the first paragraph and at least 2 H2 headers
- Include keyword variations naturally throughout (e.g., "${taLabel.toLowerCase()} ${dealTypeLabel.toLowerCase()} benchmarks", "${modalityLabel.toLowerCase()} deal structure")
- Meta description: 150-160 characters, includes primary keyword
- Excerpt: 2-3 sentences for blog cards

### Output Format
Return the article as a single JSON object with this exact structure:
{
  "title": "Article title (50-60 characters ideal, includes primary keyword)",
  "meta_description": "Compelling description for search results (150-160 chars)",
  "excerpt": "2-3 sentence summary for blog listing cards",
  "content": "Full article content in HTML format with proper h2, h3, p, table, ul/li tags",
  "faqs": [
    { "question": "Question 1?", "answer": "Answer 1" }
  ],
  "sources": [
    { "title": "Source description", "url": "https://example.com" }
  ]
}

### Sources Requirements
Include 3-6 credible sources:
- Industry publications (BioPharma Dive, Endpoints News, FiercePharma, STAT News)
- SEC filings and press releases for referenced deals
- Reputable databases (Evaluate Pharma, GlobalData, DealForma)

Write the article now. Return ONLY the JSON object, no additional text.`;
}
