/**
 * Reactive SEO blog prompt for news-driven content.
 * Generates 1,500-2,500 word articles triggered by competitor intelligence
 * alerts — optimized for speed-to-publish while maintaining data authority.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReactiveTopicParams {
  therapeuticArea: string;
  headline: string;
  companies: string[];
  dealValue?: string;
  modality?: string;
  phase?: string;
  dealType?: string;
  suggestedResponse?: string;
  sourceUrl?: string;
}

export interface ReactiveBlogPromptParams {
  topicParams: ReactiveTopicParams;
  taLabel: string;
  phaseLabel: string;
  modalityLabel: string;
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

export function generateReactiveBlogPrompt(params: ReactiveBlogPromptParams): string {
  const {
    topicParams,
    taLabel,
    phaseLabel,
    modalityLabel,
    dealTypeLabel,
    phaseData,
    comparableDeals,
  } = params;

  const companiesList = topicParams.companies.length > 0
    ? topicParams.companies.join(', ')
    : 'undisclosed parties';

  const dealsList = comparableDeals
    .map(
      (d) =>
        `- ${d.licensor} → ${d.licensee} (${d.year}): $${d.upfront}M upfront / $${d.totalDealValue}M total`,
    )
    .join('\n');

  const seoKeywords = [
    topicParams.companies.length >= 2
      ? `${topicParams.companies[0]} ${topicParams.companies[1]} deal`
      : '',
    topicParams.companies.length >= 2
      ? `${topicParams.companies[0]} ${topicParams.companies[1]} licensing`
      : '',
    `${taLabel.toLowerCase()} deal terms 2026`,
    `${taLabel.toLowerCase()} ${dealTypeLabel.toLowerCase()} benchmarks`,
    modalityLabel !== 'Unknown'
      ? `${modalityLabel.toLowerCase()} ${taLabel.toLowerCase()} deal`
      : '',
    `pharma ${dealTypeLabel.toLowerCase()} deal structure`,
    `biopharma deal benchmarks 2026`,
  ].filter(Boolean);

  return `You are a senior biopharma deal intelligence analyst writing a breaking analysis for Ambrosia Ventures — a platform used by pharma BD teams, biotech founders, and investors. Your audience is sophisticated: directors, VPs, and C-suite executives who negotiate $50M-$5B deals.

This is a REACTIVE article triggered by a breaking deal or industry development. Speed and relevance matter. Write like a reporter with a data terminal, not a content marketer.

## THE BREAKING NEWS
**Headline:** ${topicParams.headline}
**Companies:** ${companiesList}
${topicParams.dealValue ? `**Reported Deal Value:** ${topicParams.dealValue}` : ''}
${topicParams.sourceUrl ? `**Source:** ${topicParams.sourceUrl}` : ''}

## TARGET SEO KEYWORDS (weave naturally throughout)
${seoKeywords.map((k) => `- "${k}"`).join('\n')}

## BENCHMARK CONTEXT (use these exact numbers — never fabricate)
- **Therapeutic Area**: ${taLabel}
- **Development Phase**: ${phaseLabel}
- **Modality**: ${modalityLabel}
- **Deal Type**: ${dealTypeLabel}
- **${phaseLabel} Upfront Range**: $${phaseData.upfront.low}M – $${phaseData.upfront.high}M (median: $${phaseData.upfront.median}M)
- **${phaseLabel} Total Deal Value Range**: $${phaseData.totalValue.low}M – $${phaseData.totalValue.high}M
- **Royalty Range**: ${phaseData.royalty.base}% – ${phaseData.royalty.max}%

## COMPARABLE DEALS (cite these by name)
${dealsList || 'No directly comparable deals available — rely on benchmark data and broader market context.'}

## QUALITY STANDARDS

### Word count: 1,500–2,500 words.
This is reactive content — concise but substantive. Every paragraph must earn its place.

### Voice and stance
- Lead with the news. No throat-clearing.
- First sentence must reference the deal/event directly.
- Take a position: Is this deal overpriced? Undervalued? A signal of a broader trend?
- Write with authority and urgency. This is breaking analysis, not a press release summary.
- No fluff. No "In today's rapidly evolving landscape..." nonsense.

### Required elements (all must be present)

1. **News lead** (first paragraph): State the deal/event, the companies, and the reported value. Then immediately add your analytical take — why this matters.

2. **Benchmark comparison**: How does this deal compare to our data? Is the upfront above/below median? Is the total value in line with ${phaseLabel} ${taLabel} norms? Use specific numbers from the benchmark data above.

3. **Data table**: ONE HTML table comparing this deal to 3-5 comparable deals from the same TA/modality. Columns: Licensor, Licensee, Upfront ($M), Total Value ($M), Year, Phase. Use proper <table>, <thead>, <tbody>, <tr>, <th>, <td> tags.

4. **"What this signals" section**: 2-3 paragraphs on what this deal tells us about the market. Is Big Pharma paying up for this modality? Is this a defensive move? Does it signal a shift in deal structures?

5. **Implications for dealmakers**: Specific tactical takeaways:
   - If you're a biotech with a similar asset, what does this mean for your valuation?
   - If you're a BD professional evaluating a similar deal, what precedent does this set?
   - What should your deal committee know about this?

6. **CTA paragraph**: Natural mention that readers can benchmark their own deal using the calculator at calculator.ambrosiaventures.co. Not salesy — informational.

### Structure (adapt H2s to fit the specific news)
- Opening paragraph (news lead + analytical take)
- **H2: Breaking Down the [Company-Company] Deal** (deal specifics + benchmark comparison)
- **H2: How This Compares to Recent ${taLabel} Deals** (comparable deals table + analysis)
- **H2: What This Signals for ${taLabel} Dealmakers** (market implications)
- **H2: What This Means for Your Next Deal** (practical takeaways)

### Internal links (weave naturally, 2-3 total)
- [Run Your Own Deal Benchmark](/calculator) — custom benchmarks
- [${taLabel} Deal Benchmarks](/benchmarks?ta=${topicParams.therapeuticArea}) — TA-specific data
- [Get a Full Deal Report](/report) — personalized analysis

### SEO Requirements
- Primary company names in title and first 100 words
- Target keywords woven naturally throughout
- Meta description: 155-165 chars, compelling, mentions the companies and deal
- Slug should include company names and deal type

### Output format (strict JSON)
Return ONLY a JSON object, no markdown wrapper, no commentary:

{
  "title": "SEO-optimized title, 50-70 chars, includes company names and deal type",
  "meta_description": "155-165 char description mentioning companies and the deal",
  "excerpt": "2-3 sentence hook for blog listing and social sharing",
  "content": "Full HTML article with <h2>, <h3>, <p>, <table>, <blockquote>, <ul>, <strong> tags. 1,500-2,500 words.",
  "slug": "url-safe-slug-with-company-names-and-deal-type",
  "seoKeywords": ["keyword1", "keyword2", "keyword3"],
  "comparableDeals": ["Licensor1-Licensee1-2025", "Licensor2-Licensee2-2026"],
  "faqs": [
    { "question": "Substantive BD question about this deal?", "answer": "3-5 sentence answer with data." }
  ],
  "sources": [
    { "title": "Source title", "url": "https://example.com/article" }
  ]
}

Do not return anything but the JSON object. Write the article now.`;
}
