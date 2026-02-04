// Blog Post Prompt Templates

export interface BlogPostPromptParams {
  modality?: string;
  modalityLabel?: string;
  modalityContext?: string;
  modalityMultiplier?: number;
  indication?: string;
  indicationLabel?: string;
  topic?: string;
  category?: string;
  targetKeyword?: string;
  phaseData?: {
    phase: string;
    upfront: { low: number; median: number; high: number };
    totalValue: { low: number; median: number; high: number };
    royalty: { base: number; max: number };
  };
}

export function generateModalityInsightsPrompt(params: BlogPostPromptParams): string {
  const { modalityLabel, modalityContext, modalityMultiplier, targetKeyword, phaseData } = params;

  return `You are an expert life sciences industry analyst writing for biotech professionals (founders, BD executives, investors). Write a comprehensive, SEO-optimized blog post about ${modalityLabel} licensing deal trends.

## Target Keyword
"${targetKeyword || `${modalityLabel} licensing deal trends`}"

## Market Data to Include
- Modality: ${modalityLabel}
- Market Context: ${modalityContext || 'Active deal category'}
- Valuation Premium: ${modalityMultiplier ? `${((modalityMultiplier - 1) * 100).toFixed(0)}% above baseline` : 'Market rate'}
${phaseData ? `
- Phase 2 Upfront Range: $${phaseData.upfront.low}M - $${phaseData.upfront.high}M (median $${phaseData.upfront.median}M)
- Phase 2 Total Deal Value: $${phaseData.totalValue.low}M - $${phaseData.totalValue.high}M
- Royalty Range: ${phaseData.royalty.base}% - ${phaseData.royalty.max}%
` : ''}

## Article Requirements

### Structure
1. **Introduction** (150-200 words): Hook with recent market activity, establish the topic's relevance
2. **Current Market Dynamics** (300-400 words): Trends, competition, strategic drivers
3. **Deal Structure Analysis** (300-400 words): Typical terms, what's driving valuations
4. **Key Factors Affecting Terms** (250-350 words): Risk factors, competitive position, data quality
5. **Comparison to Other Modalities** (200-300 words): Where this fits in the landscape
6. **Negotiation Considerations** (200-300 words): Practical advice for deal-makers
7. **Outlook** (150-200 words): Near-term expectations
8. **FAQ Section**: 5 questions with concise answers

### Tone & Style
- Professional but accessible
- Data-driven with specific numbers where possible
- Actionable insights, not just observations
- No fluff or filler content

### SEO Requirements
- Use the target keyword in the first paragraph
- Include keyword variations naturally throughout
- Use H2 and H3 headers with relevant keywords
- Write a compelling meta description (150-160 characters)

### Output Format
Return the article in this exact JSON format:
{
  "title": "Article title (50-60 characters ideal)",
  "meta_description": "Compelling description for search results (150-160 chars)",
  "excerpt": "2-3 sentence summary for blog cards",
  "content": "Full article content in Markdown format",
  "faqs": [
    { "question": "Question 1?", "answer": "Answer 1" },
    { "question": "Question 2?", "answer": "Answer 2" }
  ],
  "sources": [
    { "title": "Source title or description", "publication": "Publication name", "url": "https://example.com/article", "date": "2024" },
    { "title": "Another source", "publication": "SEC Filing / Press Release / Journal Name" }
  ]
}

### Sources Requirements
Include 3-6 credible sources that support the data and claims in the article. Sources should include:
- Industry reports (e.g., BioPharma Dive, Endpoints News, FiercePharma)
- SEC filings and press releases for specific deal data
- Academic journals or research reports where applicable
- Reputable industry databases (e.g., Evaluate Pharma, GlobalData)

Write the article now.`;
}

export function generateEducationalPrompt(params: BlogPostPromptParams): string {
  const { topic, targetKeyword } = params;

  return `You are an expert life sciences industry analyst writing educational content for biotech professionals who may be new to licensing deals.

## Topic
"${topic}"

## Target Keyword
"${targetKeyword || topic}"

## Article Requirements

### Structure
1. **Introduction** (150-200 words): Why this topic matters for biotech professionals
2. **Definition & Context** (200-300 words): Clear explanation of the concept
3. **How It Works in Practice** (300-400 words): Real-world application in licensing deals
4. **Typical Ranges & Benchmarks** (200-300 words): Market data and what's normal
5. **Factors That Affect Terms** (250-350 words): What moves the needle
6. **Common Mistakes to Avoid** (200-300 words): Practical advice
7. **Key Takeaways** (100-150 words): Summary of main points
8. **FAQ Section**: 5 questions with concise answers

### Tone & Style
- Educational but not condescending
- Use examples to illustrate concepts
- Include specific numbers/ranges where appropriate
- Practical and actionable

### SEO Requirements
- Use the target keyword in the first paragraph
- Include keyword variations naturally
- Use descriptive H2 and H3 headers

### Output Format
Return the article in this exact JSON format:
{
  "title": "Article title (50-60 characters ideal)",
  "meta_description": "Compelling description for search results (150-160 chars)",
  "excerpt": "2-3 sentence summary for blog cards",
  "content": "Full article content in Markdown format",
  "faqs": [
    { "question": "Question 1?", "answer": "Answer 1" }
  ],
  "sources": [
    { "title": "Source title or description", "publication": "Publication name", "url": "https://example.com/article", "date": "2024" }
  ]
}

### Sources Requirements
Include 3-6 credible sources that support the educational content. Sources should include:
- Industry guides and best practices documentation
- SEC filings showing example deal structures
- Academic or legal publications on licensing terms
- Reputable industry databases and reports

Write the article now.`;
}

export function generateDealTrendsPrompt(params: BlogPostPromptParams): string {
  const { targetKeyword, topic } = params;

  return `You are an expert life sciences industry analyst writing about current deal trends for biotech professionals.

## Topic
"${topic || 'Biotech Licensing Deal Trends'}"

## Target Keyword
"${targetKeyword || 'biotech licensing deals 2025'}"

## Article Requirements

### Structure
1. **Market Overview** (200-300 words): Current state of biotech licensing
2. **Key Trends** (400-500 words): 3-4 major trends with supporting data
3. **Hot Modalities** (300-400 words): Which drug types are commanding premiums
4. **Deal Structure Evolution** (250-350 words): How terms are changing
5. **Strategic Drivers** (200-300 words): What's motivating deals
6. **Outlook** (150-200 words): Near-term predictions
7. **FAQ Section**: 5 questions with answers

### Data Points to Include
- Reference specific deal ranges (e.g., "Phase 2 ADC assets commanding $100-250M upfronts")
- Mention premium modalities (radiopharmaceuticals at 50-60% premiums)
- Note market dynamics (big pharma LOE cliffs, China geopolitical discounts)

### Output Format
Return the article in this exact JSON format:
{
  "title": "Article title (50-60 characters ideal)",
  "meta_description": "Compelling description for search results (150-160 chars)",
  "excerpt": "2-3 sentence summary for blog cards",
  "content": "Full article content in Markdown format",
  "faqs": [
    { "question": "Question 1?", "answer": "Answer 1" }
  ],
  "sources": [
    { "title": "Source title or description", "publication": "Publication name", "url": "https://example.com/article", "date": "2024" }
  ]
}

### Sources Requirements
Include 3-6 credible sources that support the deal trends analysis. Sources should include:
- Recent deal announcements and press releases
- Industry publications (BioPharma Dive, Endpoints News, FiercePharma, STAT News)
- Financial filings and investor presentations
- Market research reports (Evaluate Pharma, GlobalData, DealForma)

Write the article now.`;
}

export function generateIndustryAnalysisPrompt(params: BlogPostPromptParams): string {
  const { targetKeyword, topic, indication, indicationLabel } = params;

  return `You are an expert life sciences industry analyst writing competitive landscape analysis for biotech professionals.

## Topic
"${topic || `${indicationLabel || 'Oncology'} Competitive Landscape`}"

## Target Keyword
"${targetKeyword}"

${indication ? `## Indication Focus\n${indicationLabel}` : ''}

## Article Requirements

### Structure
1. **Market Context** (200-300 words): Size, growth, key players
2. **Competitive Dynamics** (400-500 words): Who's winning and why
3. **Emerging Approaches** (300-400 words): New modalities and mechanisms
4. **Deal Activity** (250-350 words): Recent licensing and M&A
5. **Opportunities** (200-300 words): White space and underserved areas
6. **Risks & Challenges** (200-250 words): Market headwinds
7. **Strategic Implications** (150-200 words): What this means for deal-makers
8. **FAQ Section**: 5 questions with answers

### Output Format
Return the article in this exact JSON format:
{
  "title": "Article title (50-60 characters ideal)",
  "meta_description": "Compelling description for search results (150-160 chars)",
  "excerpt": "2-3 sentence summary for blog cards",
  "content": "Full article content in Markdown format",
  "faqs": [
    { "question": "Question 1?", "answer": "Answer 1" }
  ],
  "sources": [
    { "title": "Source title or description", "publication": "Publication name", "url": "https://example.com/article", "date": "2024" }
  ]
}

### Sources Requirements
Include 3-6 credible sources that support the competitive analysis. Sources should include:
- Market research reports (McKinsey, BCG, Deloitte life sciences reports)
- Industry publications covering competitive landscape
- Company 10-K filings and investor presentations
- Clinical trial databases (ClinicalTrials.gov) for pipeline analysis
- FDA approval and regulatory documents

Write the article now.`;
}
