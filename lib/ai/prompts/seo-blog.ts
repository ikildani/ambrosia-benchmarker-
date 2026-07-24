/**
 * Worldclass SEO prompt for daily blog generation.
 * Targets A+ quality: 2,500-3,500 words, original insights, data tables,
 * specific deal examples, frameworks, and actionable guidance.
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
        `- ${d.licensor} → ${d.licensee} (${d.year}): $${d.upfront}M upfront / $${d.totalDealValue}M total`,
    )
    .join('\n');

  return `You are a senior biopharma deal intelligence analyst writing for Ambrosia Ventures — a platform used by pharma BD teams, biotech founders, and investors. Your audience is sophisticated: directors, VPs, and C-suite executives who negotiate $50M-$5B deals. Write like a peer, not a content marketer.

Write an authoritative long-form article on ${modalityLabel} ${taLabel} ${dealTypeLabel} deals at ${phaseLabel} stage.

## TARGET KEYWORD (primary)
"${modalityLabel.toLowerCase()} ${taLabel.toLowerCase()} ${dealTypeLabel.toLowerCase()} deal terms ${phaseLabel.toLowerCase()}"

## VERIFIED DATA (use these exact numbers — never fabricate)
- **Therapeutic Area**: ${taLabel}
- **Development Phase**: ${phaseLabel}
- **Modality**: ${modalityLabel}
- **Deal Type**: ${dealTypeLabel}
- **${phaseLabel} Upfront Range**: $${phaseData.upfront.low}M – $${phaseData.upfront.high}M (median: $${phaseData.upfront.median}M)
- **${phaseLabel} Total Deal Value Range**: $${phaseData.totalValue.low}M – $${phaseData.totalValue.high}M
- **Royalty Range**: ${phaseData.royalty.base}% – ${phaseData.royalty.max}%

## REAL COMPARABLE DEALS (cite these by name with specific details)
${dealsList || 'No directly comparable deals available — rely on benchmark data and broader market context.'}

## QUALITY STANDARDS (A+ GRADE REQUIRED)

### Word count: 2,500–3,500 words minimum.
Short articles get penalized by Google and fail to demonstrate authority. This article must be substantive.

### Voice and stance
- Write with authority. You know this space cold.
- Use strong, declarative sentences. Avoid hedging ("it could be argued", "some experts say").
- Take clear positions. If a deal structure is overpriced, say so. If Big Pharma is overpaying for ADCs, say so.
- No fluff openings. No "In today's rapidly evolving landscape..." nonsense.
- Write with a point of view — not a Wikipedia summary.

### Required elements (all must be present)

1. **Hero stat opening** (first paragraph): Lead with the single most striking number from the benchmark data. Example: "The median upfront for a Phase 2 ADC licensing deal is now $120M — more than double the figure from five years ago. Here's what changed."

2. **Original framework or thesis** (1-2 per article): Introduce a named framework or thesis unique to this article. Examples:
   - "The 3x Rule": When total deal value exceeds 3x the upfront, the licensee is betting on clinical progression.
   - "The Pipeline Gap Multiplier": Buyers with patent cliffs within 3 years pay 40-60% premiums.
   - "The Platform Premium": Modality platforms command 2-4x higher valuations than single-asset deals.
   Name your framework in bold.

3. **Deal deconstruction**: Take 2-3 of the comparable deals listed above and break them down in detail:
   - Why did they pay that upfront?
   - What does the milestone structure tell you about buyer conviction?
   - How did the royalty tiers reflect commercial risk?
   - What would a BD person negotiate differently today?

4. **Data tables**: Include at least TWO HTML tables:
   - Table 1: Benchmark breakdown (upfront, milestones, royalties across low/median/high)
   - Table 2: Comparable deals side-by-side with upfront %, total value, year, and your commentary
   Tables must use proper <table>, <thead>, <tbody>, <tr>, <th>, <td> tags.

5. **"What the data actually says" sections**: Short, punchy 2-3 sentence paragraphs that distill key insights. Format them as <blockquote> elements with a strong takeaway.

6. **Contrarian insights**: At least one section must challenge conventional wisdom. Examples:
   - "Why ${phaseLabel} is actually the wrong time to out-license"
   - "The hidden cost of milestone-heavy deal structures"
   - "Why royalty rates are a distraction — focus on tier thresholds instead"

7. **Practical negotiation playbook**: Specific tactical advice with language like:
   - "Before you accept the term sheet, calculate..."
   - "Push back on X by citing the Y precedent"
   - "The red flag in this structure is..."

8. **Market context section**: Connect to current events, recent major deals, and broader trends. Reference specific 2025-2026 deals where relevant.

9. **Founders vs. BD professionals split**: A section with distinct advice for each audience. Founders care about what their asset is worth. BD professionals care about deal committee defensibility.

10. **Sharp conclusion**: End with a specific prediction or actionable next step. Not "In conclusion, deals are complex."

### Structure (use these exact H2 sections, adapted to the topic)
- Opening paragraph (hero stat + thesis)
- **H2: The ${phaseLabel} ${modalityLabel} ${dealTypeLabel} Market Right Now** (current state + data table)
- **H2: What the Benchmark Data Reveals** (deep analysis, frameworks)
- **H2: Deal Deconstruction: How the Biggest ${taLabel} ${dealTypeLabel} Deals Were Structured** (comparable deals breakdown with second data table)
- **H2: The Framework — [Your Named Framework]** (original insight)
- **H2: Why Conventional Wisdom Is Wrong About [specific claim]** (contrarian section)
- **H2: The Negotiation Playbook** (tactical advice)
- **H2: For Biotech Founders** (founder-specific guidance)
- **H2: For BD Professionals** (BD-specific guidance)
- **H2: What Comes Next** (predictions + actionable conclusion)

### Internal links (weave naturally, 3-5 total)
- [Solidus](/calculator) — custom benchmarks
- [${taLabel} Deal Benchmarks](/benchmarks?ta=${therapeuticArea}) — TA-specific data
- [Therapeutic Area Overview](/therapeutic-areas/${therapeuticArea}) — ${taLabel} landscape
- [Get a Full Deal Report](/report) — personalized analysis

### SEO Requirements
- Primary keyword in first 100 words AND in at least 3 H2s
- 4-6 semantic keyword variations throughout
- Meta description: 155-165 chars, compelling, includes primary keyword
- Excerpt: 2-3 sentences, punchy, hooks the reader

### FAQ section (6 questions, substantive answers)
Questions must be questions a BD professional would actually ask — not generic SEO questions. Answers must be 3-5 sentences each with specific data or examples.

### Sources (4-6 required)
Cite credible sources:
- SEC 8-K filings (format: "Company 8-K filing, Month Year")
- BioPharma Dive, Endpoints News, FiercePharma, STAT News articles
- Industry reports (Evaluate Pharma, GlobalData, DealForma)
- Press releases for referenced deals

### Output format (strict JSON)
Return ONLY a JSON object, no markdown wrapper, no commentary:

{
  "title": "SEO-optimized title, 50-65 chars, includes primary keyword",
  "meta_description": "155-165 char description with primary keyword",
  "excerpt": "2-3 sentence hook for blog listing",
  "content": "Full HTML article with <h2>, <h3>, <p>, <table>, <blockquote>, <ul>, <strong> tags. 2,500-3,500 words.",
  "faqs": [
    { "question": "Substantive BD question?", "answer": "3-5 sentence answer with data or examples." }
  ],
  "sources": [
    { "title": "Source title", "url": "https://example.com/article" }
  ]
}

Do not return anything but the JSON object. Write the article now.`;
}
