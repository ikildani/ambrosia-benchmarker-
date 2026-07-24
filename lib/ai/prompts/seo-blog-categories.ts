import { DEAL_STATS } from '@/lib/config/constants';

/**
 * Category-specific SEO blog prompt generators.
 *
 * Five specialized prompts that replace the single generic seo-blog.ts prompt.
 * Each generator takes ACTUAL DATA from the deals database and produces a
 * prompt instructing Claude to return JSON in the GeneratedBlogContent format.
 *
 * Categories:
 *   1. Deal Analysis — deep-dive on a specific deal
 *   2. How Much — data-driven answer to "how much should I expect?"
 *   3. Buyer Intelligence — company deal activity profile
 *   4. Market Trend — trend analysis with period comparison
 *   5. Comparison — Ambrosia vs competitor
 */

import type {
  DealAnalysisData,
  HowMuchData,
  BuyerIntelligenceData,
  MarketTrendData,
  ComparisonData,
} from '@/lib/seo/topic-rotation';

// ── Shared constants ────────────────────────────────────────────────────────

const VOICE_INSTRUCTION = `You are a senior biopharma deal intelligence analyst writing for Ambrosia Ventures — a platform used by pharma BD teams, biotech founders, and investors. Your audience is sophisticated: directors, VPs, and C-suite executives who negotiate $50M–$5B deals. Write like a peer, not a content marketer.

Voice rules:
- No fluff openings. No "In today's rapidly evolving landscape…" nonsense.
- Lead with data. First sentence must contain a specific number.
- Use strong, declarative sentences. Avoid hedging ("it could be argued", "some experts say").
- Take clear positions. If a deal is overpriced, say so. If a trend is accelerating, quantify it.
- Write with a point of view — not a Wikipedia summary.`;

const JSON_FORMAT_INSTRUCTION = `Return ONLY a JSON object — no markdown wrapper, no code fences, no commentary before or after. The JSON must conform to this exact schema:

{
  "title": "string — SEO-optimized, 50–70 characters, includes primary keyword",
  "meta_description": "string — 155–165 characters, compelling, includes primary keyword",
  "excerpt": "string — 2–3 sentence hook for blog listing",
  "content": "string — Full HTML article using <h2>, <h3>, <p>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <blockquote>, <ul>, <li>, <strong>, <a> tags. No markdown.",
  "faqs": [{ "question": "string", "answer": "string" }],
  "sources": [{ "title": "string", "url": "string (optional)", "publication": "string (optional)", "date": "string (optional)" }]
}

Do not return anything but the JSON object.`;

const HTML_TAG_REMINDER = `Use proper semantic HTML: <h2>, <h3>, <p>, <table> (with <thead>, <tbody>, <tr>, <th>, <td>), <blockquote>, <ul>, <li>, <strong>, <a>. Never use markdown syntax inside the content string.`;

// ── 1. Deal Analysis ────────────────────────────────────────────────────────

export interface DealAnalysisPromptInput {
  data: DealAnalysisData;
}

export function generateDealAnalysisPrompt(data: DealAnalysisData): string {
  // Format dollar values: raw USD -> human-readable (e.g., $150M, $1.2B)
  const fmtUsd = (v: number | null | undefined): string => {
    if (v == null || v <= 0) return 'undisclosed';
    if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
    return `$${(v / 1_000_000).toFixed(0)}M`;
  };

  const upfrontStr = fmtUsd(data.upfrontUsd);
  const tdvStr = fmtUsd(data.totalDealValueUsd);
  const milestonesStr = fmtUsd(data.milestonesTotalUsd);
  const royaltyStr =
    data.royaltyLowPct != null && data.royaltyHighPct != null
      ? `${data.royaltyLowPct}%–${data.royaltyHighPct}%`
      : data.royaltyLowPct != null
        ? `${data.royaltyLowPct}%+`
        : 'undisclosed';

  return `${VOICE_INSTRUCTION}

Write a 1,500-word deep-dive analysis of the ${data.licensorName}–${data.licenseeName} deal for ${data.assetName || 'their pipeline asset'}.

## TARGET KEYWORDS (primary)
- "${data.licensorName} ${data.licenseeName} deal terms"
- "${data.licensorName} ${data.licenseeName} deal structure"

## VERIFIED DEAL DATA (use these exact numbers — never fabricate)
- **Deal ID**: ${data.dealId}
- **Licensor**: ${data.licensorName}
- **Licensee**: ${data.licenseeName}
- **Asset**: ${data.assetName || 'Undisclosed'}
- **Modality**: ${data.modality || 'Undisclosed'}
- **Therapeutic Area**: ${data.therapeuticArea || 'Undisclosed'}
- **Phase**: ${data.phase || 'Undisclosed'}
- **Deal Type**: ${data.dealType || 'Undisclosed'}
- **Upfront Payment**: ${upfrontStr}
- **Total Deal Value**: ${tdvStr}
- **Milestones Total**: ${milestonesStr}
- **Royalty Range**: ${royaltyStr}
- **Announced**: ${data.announcedDate || 'Undisclosed'}
${data.target ? `- **Target**: ${data.target}` : ''}
${data.mechanismOfAction ? `- **Mechanism of Action**: ${data.mechanismOfAction}` : ''}

## REQUIRED STRUCTURE

1. **Title**: Include the deal value and both company names. Format: "${data.licenseeName} ${data.licensorName} ${tdvStr} ${data.dealType || 'Deal'} — Deal Structure Breakdown" (adapt as needed, keep under 70 chars).

2. **Lead paragraph**: Open with the single most striking number from this deal. State what happened, the key financial terms, and your one-sentence analytical take on why this deal matters.

3. **H2: Deal Structure Breakdown** — Dissect the upfront (${upfrontStr}), milestones (${milestonesStr}), and royalty tiers (${royaltyStr}). Calculate the upfront-to-TDV ratio. What does the milestone split tell you about buyer conviction vs. risk sharing?

4. **H2: Competitive Context — Why ${data.licenseeName} and Why ${data.assetName || 'This Asset'}** — Why did this buyer pursue this particular asset? What strategic gap does it fill? What competitive dynamics drove the timing?

5. **H2: What This Means for Similar Assets** — If you have a ${data.phase || 'similar-phase'} ${data.modality || ''} ${data.therapeuticArea || ''} asset, what does this deal tell you about your valuation? Be specific about upfront expectations and royalty benchmarks.

6. **CTA paragraph**: "Benchmark your own ${data.therapeuticArea || ''} deal against ${DEAL_STATS.TOTAL_DEALS} comparable transactions" — link to <a href="/calculator">the Ambrosia calculator</a>.

## INTERNAL LINKS (weave naturally)
- <a href="/calculator">Solidus</a> — custom benchmarks
${data.therapeuticArea ? `- <a href="/benchmarks?ta=${data.therapeuticArea}">${data.therapeuticArea} Deal Benchmarks</a>` : ''}

## FAQ SECTION
Include 2–3 questions a BD professional would actually ask about this specific deal. Answers must be 3–5 sentences with specific data.

## SOURCES
Include 3–4 sources: the press release or 8-K filing announcing the deal, plus 2–3 industry publication references (BioPharma Dive, Endpoints News, FiercePharma, STAT News, Evaluate Pharma).

${HTML_TAG_REMINDER}

${JSON_FORMAT_INSTRUCTION}

Write the article now.`;
}

// ── 2. How Much ─────────────────────────────────────────────────────────────

export function generateHowMuchPrompt(data: HowMuchData): string {
  // Format dollar values: raw USD -> millions
  const fmtM = (v: number | null | undefined): string =>
    v != null && v > 0 ? `$${(v / 1_000_000).toFixed(0)}M` : '—';

  const sampleDealsTable = data.sampleDeals
    .map(
      (d) =>
        `| ${d.licensor || 'Undisclosed'} | ${d.licensee || 'Undisclosed'} | ${fmtM(d.upfront)} | ${fmtM(d.tdv)} | ${d.year} |`,
    )
    .join('\n');

  return `${VOICE_INSTRUCTION}

Write a 1,200-word data-driven article that directly answers the question: "How much upfront should you expect for a ${data.phaseLabel} ${data.modalityLabel || ''} ${data.taLabel} deal in 2026?"

## TARGET KEYWORDS (primary)
- "how much upfront ${data.phaseLabel.toLowerCase()} ${data.taLabel.toLowerCase()} deal"
- "${data.phaseLabel.toLowerCase()} ${data.modalityLabel ? data.modalityLabel.toLowerCase() + ' ' : ''}${data.taLabel.toLowerCase()} deal terms"

## VERIFIED BENCHMARK DATA (use these exact numbers — never fabricate)
- **Therapeutic Area**: ${data.taLabel}
- **Phase**: ${data.phaseLabel}
${data.modalityLabel ? `- **Modality**: ${data.modalityLabel}` : ''}
- **Deals analyzed**: ${data.dealCount}
- **Median Upfront**: ${fmtM(data.medianUpfront)}
- **P25 Upfront**: ${fmtM(data.p25Upfront)}
- **P75 Upfront**: ${fmtM(data.p75Upfront)}
- **Median Total Deal Value**: ${fmtM(data.medianTdv)}

## SAMPLE DEALS
| Licensor | Licensee | Upfront | TDV | Year |
|----------|----------|---------|-----|------|
${sampleDealsTable}

## REQUIRED STRUCTURE

1. **Title**: Use one of these formats (adapt to data):
   - "How Much Upfront Should You Expect for a ${data.phaseLabel} ${data.taLabel} Deal in 2026?"
   - "${data.phaseLabel} ${data.modalityLabel || ''} Deals Average ${fmtM(data.medianUpfront)} Upfront in 2026"
   Keep under 70 characters.

2. **Lead paragraph**: Directly answer the question in the first sentence. State the median upfront (${fmtM(data.medianUpfront)}), the range (${fmtM(data.p25Upfront)}–${fmtM(data.p75Upfront)}), and how many deals this is based on (${data.dealCount}).

3. **H2: The Numbers — ${data.phaseLabel} ${data.taLabel} Deal Benchmarks** — Include an HTML data table:

   <table>
     <thead><tr><th>Metric</th><th>P25</th><th>Median</th><th>P75</th></tr></thead>
     <tbody>
       <tr><td>Upfront ($M)</td><td>${(data.p25Upfront / 1_000_000).toFixed(0)}</td><td>${(data.medianUpfront / 1_000_000).toFixed(0)}</td><td>${(data.p75Upfront / 1_000_000).toFixed(0)}</td></tr>
       <tr><td>Total Deal Value ($M)</td><td>—</td><td>${(data.medianTdv / 1_000_000).toFixed(0)}</td><td>—</td></tr>
     </tbody>
   </table>

   (Reproduce this table exactly in the content HTML.)

4. **H2: What Recent Deals Show** — Include a second HTML table with the ${data.sampleDeals.length} sample deals (Licensor, Licensee, Upfront, TDV, Year). Then analyze: what drives the range between the lowest and highest upfronts? How does competitive position, data maturity, and modality affect pricing?

5. **H2: What Drives the Range** — Analysis of why some deals land at P25 and others at P75. Discuss: differentiated mechanism, competitive landscape density, regulatory pathway clarity, buyer urgency.

6. **H2: How to Position Your Deal** — Practical advice on where in the range a specific asset would fall and what levers move the upfront higher.

7. **CTA paragraph**: "Run your own benchmark with the Ambrosia calculator" — link to <a href="/calculator">the calculator</a>. Mention that the platform has ${DEAL_STATS.TOTAL_DEALS} deals.

## INTERNAL LINKS (weave naturally)
- <a href="/calculator">Solidus</a>
- <a href="/benchmarks?ta=${data.therapeuticArea}">${data.taLabel} Benchmarks</a>

## FAQ SECTION
Include 3–4 questions a biotech founder or BD professional would ask about deal pricing in this space. Answers must be 3–5 sentences with specific numbers from the data above.

## SOURCES
Include 3–4 sources: Evaluate Pharma or DealForma benchmark reports, relevant industry articles, SEC filings for cited deals.

${HTML_TAG_REMINDER}

${JSON_FORMAT_INSTRUCTION}

Write the article now.`;
}

// ── 3. Buyer Intelligence ───────────────────────────────────────────────────

export function generateBuyerIntelligencePrompt(data: BuyerIntelligenceData): string {
  // Format dollar values: raw USD -> millions
  const fmtM = (v: number | null | undefined): string =>
    v != null && v > 0 ? `$${(v / 1_000_000).toFixed(0)}M` : '—';

  const recentDealsRows = data.recentDeals
    .map(
      (d) =>
        `| ${d.assetName || 'Undisclosed'} | ${d.ta || '—'} | ${d.phase || '—'} | ${fmtM(d.upfront)} | ${fmtM(d.tdv)} | ${d.date || '—'} |`,
    )
    .join('\n');

  const taList = data.therapeuticAreas.join(', ');
  const dealTypeList = data.preferredDealTypes.join(', ');

  return `${VOICE_INSTRUCTION}

Write a 1,500-word profile of ${data.companyName}'s deal activity from ${data.periodStart} to ${data.periodEnd}.

## TARGET KEYWORDS (primary)
- "${data.companyName.toLowerCase()} licensing deals 2026"
- "${data.companyName.toLowerCase()} deal activity"

## VERIFIED DATA (use these exact numbers — never fabricate)
- **Company**: ${data.companyName}
- **Deals in period**: ${data.dealCount}
- **TA focus areas**: ${taList}
- **Preferred deal types**: ${dealTypeList}
- **Average upfront ratio**: ${data.avgUpfrontRatio != null ? `${(data.avgUpfrontRatio * 100).toFixed(1)}% of TDV` : 'Insufficient data'}
- **Period**: ${data.periodStart} to ${data.periodEnd}

## RECENT DEALS
| Asset | TA | Phase | Upfront | TDV | Date |
|-------|----|-----------|---------|----- |------|
${recentDealsRows}

## REQUIRED STRUCTURE

1. **Title**: Use one of these formats (adapt to data):
   - "${data.companyName}'s ${data.periodStart.slice(0, 4)}–${data.periodEnd.slice(0, 4)} Deal Activity — What They're Buying and Why"
   - "${data.companyName} Licensing Strategy — ${data.dealCount} Deals Analyzed"
   Keep under 70 characters.

2. **Lead paragraph**: Open with ${data.companyName}'s deal count (${data.dealCount}) and dominant TA focus. What pattern emerges from their recent activity?

3. **H2: ${data.companyName}'s Deal Portfolio** — Include an HTML table of their recent deals (columns: Asset, Therapeutic Area, Deal Type, Upfront, TDV, Date). Then summarize: which TAs are they concentrating in? Are they diversifying or doubling down?

4. **H2: Deal Type Preferences** — Analyze their preferred structures (${dealTypeList}). What does their deal type mix tell you about their risk appetite?${data.avgUpfrontRatio != null ? ` Average upfront ratio of ${(data.avgUpfrontRatio * 100).toFixed(1)}% — is this buyer-friendly or seller-friendly?` : ''}

5. **H2: Strategic Pattern** — Connect the dots across deals. What therapeutic thesis is ${data.companyName} building? Are they filling pipeline gaps, building platforms, or making defensive moves?

6. **H2: What This Means If You're Pitching to ${data.companyName}** — Specific, tactical advice for biotechs approaching this buyer. What asset profile fits their pattern? What deal structure should you propose? What terms will they push back on?

7. **CTA paragraph**: "See which companies match your asset" — link to <a href="/calculator">the Ambrosia calculator's partner matching engine</a>, which scores 850+ companies against your asset profile.

## INTERNAL LINKS (weave naturally)
- <a href="/calculator">Partner Matching</a> — find your best buyer fit
- <a href="/calculator">Solidus</a> — benchmark your terms
${data.therapeuticAreas[0] ? `- <a href="/benchmarks?ta=${data.therapeuticAreas[0]}">${data.therapeuticAreas[0]} Benchmarks</a>` : ''}

## FAQ SECTION
Include 3–4 questions about ${data.companyName}'s deal behavior and what it means for potential partners. Answers must be 3–5 sentences with specific data from above.

## SOURCES
Include 3–5 sources: SEC 8-K filings for cited deals, press releases, industry publication articles (BioPharma Dive, Endpoints News, FiercePharma).

${HTML_TAG_REMINDER}

${JSON_FORMAT_INSTRUCTION}

Write the article now.`;
}

// ── 4. Market Trend ─────────────────────────────────────────────────────────

export function generateMarketTrendPrompt(data: MarketTrendData): string {
  // Format dollar values: raw USD -> millions
  const fmtM = (v: number | null | undefined): string =>
    v != null && v > 0 ? `$${(v / 1_000_000).toFixed(0)}M` : '—';

  const topDealsRows = data.topDeals
    .map(
      (d) =>
        `| ${d.licensor || 'Undisclosed'} | ${d.licensee || 'Undisclosed'} | ${fmtM(d.upfront)} | ${fmtM(d.tdv)} | ${d.date || '—'} |`,
    )
    .join('\n');

  const directionWord = data.changePercent >= 0 ? 'Up' : 'Down';
  const absChange = Math.abs(data.changePercent).toFixed(1);

  return `${VOICE_INSTRUCTION}

Write a 1,200-word trend analysis on ${data.dimensionLabel} deal activity.

## TARGET KEYWORDS (primary)
- "${data.dimensionLabel.toLowerCase()} deal trends 2026"
- "${data.dimensionLabel.toLowerCase()} licensing 2026"

## VERIFIED TREND DATA (use these exact numbers — never fabricate)
- **Dimension**: ${data.dimensionLabel}
- **Trend type**: ${data.trendType}
- **Headline**: ${data.headline}
- **${data.currentPeriodLabel}**: ${typeof data.currentValue === 'number' ? data.currentValue.toLocaleString() : data.currentValue}
- **${data.previousPeriodLabel}**: ${typeof data.previousValue === 'number' ? data.previousValue.toLocaleString() : data.previousValue}
- **Change**: ${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(1)}%

## NOTABLE DEALS IN THIS TREND
| Licensor | Licensee | Upfront | TDV | Date |
|----------|----------|---------|-----|------|
${topDealsRows}

## REQUIRED STRUCTURE

1. **Title**: Use one of these formats (adapt to the data):
   - "${data.dimensionLabel} Deals Are ${directionWord} ${absChange}% in 2026 — Here's the Data"
   - "The ${data.dimensionLabel} Squeeze: Why ${data.headline}"
   Keep under 70 characters.

2. **Lead paragraph**: Open with the trend number (${directionWord.toLowerCase()} ${absChange}%). State the comparison periods (${data.previousPeriodLabel} vs. ${data.currentPeriodLabel}). Then give your one-sentence analytical take on what's driving it.

3. **H2: The Data — ${data.dimensionLabel} Deal Activity, Period over Period** — Include an HTML table showing the period comparison:

   <table>
     <thead><tr><th>Period</th><th>Value</th></tr></thead>
     <tbody>
       <tr><td>${data.previousPeriodLabel}</td><td>${typeof data.previousValue === 'number' ? data.previousValue.toLocaleString() : data.previousValue}</td></tr>
       <tr><td>${data.currentPeriodLabel}</td><td>${typeof data.currentValue === 'number' ? data.currentValue.toLocaleString() : data.currentValue}</td></tr>
       <tr><td><strong>Change</strong></td><td><strong>${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(1)}%</strong></td></tr>
     </tbody>
   </table>

   (Reproduce this table exactly in the content HTML.)

4. **H2: What's Driving the Trend** — 2–3 paragraphs analyzing the underlying forces. Is this regulatory (FDA approvals/CRLs), competitive (crowded pipelines), economic (capital availability), or strategic (Big Pharma pipeline gaps)?

5. **H2: Notable Deals** — Discuss the top deals from the table above. How do they exemplify or contradict the broader trend? Include the deal table as a second HTML table in the content.

6. **H2: What This Means for BD Teams Right Now** — Specific tactical implications. If you're selling, is this a seller's or buyer's market? If you're buying, should you move fast or wait? What deal structures are gaining or losing favor?

7. **CTA paragraph**: "Benchmark your deal against current market rates" — link to <a href="/calculator">the Ambrosia calculator</a>.

## INTERNAL LINKS (weave naturally)
- <a href="/calculator">Solidus</a>
- <a href="/benchmarks">Deal Benchmarks</a>

## FAQ SECTION
Include 2–3 questions a BD professional would ask about this trend and its implications. Answers must be 3–5 sentences with specific data.

## SOURCES
Include 3–4 sources: industry benchmark reports (Evaluate Pharma, DealForma), news articles covering the trend, relevant SEC filings.

${HTML_TAG_REMINDER}

${JSON_FORMAT_INSTRUCTION}

Write the article now.`;
}

// ── 5. Comparison ───────────────────────────────────────────────────────────

export function generateComparisonPrompt(data: ComparisonData): string {
  return `${VOICE_INSTRUCTION}

Write a 1,200-word comparison article: Ambrosia vs ${data.competitorName} for biopharma deal benchmarking.

## TARGET KEYWORDS (primary)
- "${data.competitorName.toLowerCase()} alternative"
- "ambrosia vs ${data.competitorName.toLowerCase()}"

## COMPARISON ANGLE
${data.comparisonAngle}

## AMBROSIA DATA ADVANTAGE (verified facts — use these exact numbers)
- **Deal count in database**: ${DEAL_STATS.TOTAL_DEALS}
- **Real-time benchmarking engines**: 14 (Deal Terms, rNPV, Monte Carlo, Tornado Sensitivity, Partner Matching with 850+ companies, Competitive Landscape, Market Sizing, Pharma Intent Score, Deal Waterfall, Scenario Comparison, Real Options via CRR lattice, Competitive Dynamics, Lifecycle Extensions, Buyer-Specific Valuation)
- **Therapeutic areas covered**: 12 with 562 indications
- **Pro pricing**: $299/month ($199/month annual)
- **One-time report**: $499
- **Comparable deals in database**: ~280 unique curated deals
- **Unique data points**: ${data.uniqueDataPoints.toLocaleString()}

## REQUIRED STRUCTURE

1. **Title**: Use one of these formats:
   - "Ambrosia vs ${data.competitorName} — Biopharma Deal Benchmarking Compared"
   - "Best Biotech Deal Databases in 2026"
   Keep under 70 characters.

2. **Lead paragraph**: State what both tools do and why this comparison matters to BD professionals. No marketing fluff — frame it as "which tool gives you better deal intelligence?"

3. **H2: Overview — What Each Tool Does** — Factual summary of both Ambrosia and ${data.competitorName}. Be fair and accurate about the competitor. Do not misrepresent their capabilities.

4. **H2: Feature Comparison** — Include an HTML comparison table:
   - Rows: Deal benchmarking, rNPV/valuation, Monte Carlo simulation, Partner matching, Competitive landscape, Market sizing, Intent scoring, Real options, Scenario comparison, Deal count, TA coverage, Pricing
   - Columns: Feature, Ambrosia, ${data.competitorName}
   Be factual. If ${data.competitorName} has a feature, acknowledge it. If you genuinely don't know whether they have a feature, say "Not publicly available" — never claim they lack something you can't verify.

5. **H2: Data Depth** — Compare the depth of deal data. Ambrosia has ${data.uniqueDataPoints.toLocaleString()} unique data points across ${DEAL_STATS.TOTAL_DEALS} deals. What does ${data.competitorName} offer? Discuss granularity: does the competitor provide upfront/milestone/royalty breakdowns or just headline numbers?

6. **H2: Pricing** — Ambrosia Pro: $299/month ($199/month annual). One-time report: $499. Compare to ${data.competitorName}'s pricing if publicly available. Frame value in terms of what BD professionals actually need.

7. **H2: Who Each Tool Is Best For** — Fair assessment. Maybe ${data.competitorName} is better for X use case. Ambrosia is better for Y. Give honest guidance.

8. **H2: Verdict** — Clear recommendation with nuance. Don't be blindly promotional. State where Ambrosia wins on data depth and engine breadth, acknowledge where the competitor has strengths, and conclude with who should choose which tool.

9. **CTA paragraph**: "Try Ambrosia free" — link to <a href="/calculator">the calculator</a>.

## IMPORTANT GUIDELINES
- Be factual and fair. An obviously biased comparison hurts credibility.
- Highlight Ambrosia's genuine advantages: 14 engines, ${DEAL_STATS.TOTAL_DEALS} deals, real-time benchmarks, 562 indications across 12 TAs.
- Do not fabricate competitor capabilities. If unsure, say "based on publicly available information."
- Write for a BD professional evaluating tools — not for a marketing audience.

## INTERNAL LINKS
- <a href="/calculator">Try the Calculator</a>
- <a href="/benchmarks">Deal Benchmarks</a>

## FAQ SECTION
Include 2–3 questions a buyer would ask when evaluating deal benchmarking tools. Answers must be 3–5 sentences.

## SOURCES
Include 2–3 sources: link to both products' public pages, relevant industry reviews or comparisons if they exist.

${HTML_TAG_REMINDER}

${JSON_FORMAT_INSTRUCTION}

Write the article now.`;
}
