// Landing Page Prompt Templates

export interface LandingPagePromptParams {
  modality?: string;
  modalityLabel?: string;
  modalityContext?: string;
  modalityMultiplier?: number;
  indication?: string;
  indicationLabel?: string;
  targetKeyword?: string;
  phaseData?: {
    upfront: { low: number; median: number; high: number };
    totalValue: { low: number; median: number; high: number };
  };
}

export function generateLandingPagePrompt(params: LandingPagePromptParams): string {
  const {
    modalityLabel,
    modalityContext,
    modalityMultiplier,
    indicationLabel,
    targetKeyword,
    phaseData,
  } = params;

  const focus = modalityLabel || indicationLabel || 'Oncology';
  const premium = modalityMultiplier ? `${((modalityMultiplier - 1) * 100).toFixed(0)}%` : null;

  return `You are a conversion-focused copywriter creating a landing page for a biotech licensing deal calculator. The page targets professionals searching for "${targetKeyword || `${focus} licensing deal calculator`}".

## Page Focus
- Primary: ${modalityLabel || 'All modalities'}
${indicationLabel ? `- Indication: ${indicationLabel}` : ''}
${modalityContext ? `- Market Context: ${modalityContext}` : ''}
${premium ? `- Valuation Premium: ${premium} above baseline` : ''}

## Market Data
${phaseData ? `
- Typical Phase 2 Upfront: $${phaseData.upfront.low}M - $${phaseData.upfront.high}M
- Total Deal Value Range: $${phaseData.totalValue.low}M - $${phaseData.totalValue.high}M
` : ''}

## Landing Page Requirements

### Tone & Style
- Professional, authoritative, data-driven
- Clear value proposition
- Urgency without being pushy
- Speaks to biotech founders, BD executives, and investors

### Content Sections to Create

1. **Hero Section**
   - Headline (8-12 words, benefit-focused)
   - Subtitle (15-25 words, expands on headline)
   - CTA button text (2-4 words)

2. **Value Props** (3 items)
   - Each with a short title and 1-2 sentence description
   - Focus on speed, accuracy, and market data

3. **How It Works** (3 steps)
   - Simple, clear steps to use the calculator
   - Each step: title + brief description

4. **Stats Section** (3-4 stats)
   - Impressive numbers about deals, modalities, accuracy
   - Use real market data where possible

5. **FAQ Section** (4 questions)
   - Common questions about ${focus} licensing deals
   - Concise, helpful answers

### Output Format
Return the content in this exact JSON format:
{
  "title": "Page title for SEO (50-60 chars)",
  "meta_description": "Meta description (150-160 chars)",
  "hero": {
    "headline": "Main headline",
    "subtitle": "Supporting subtitle",
    "cta_text": "CTA button text"
  },
  "value_props": [
    { "title": "Value Prop 1", "description": "Description" },
    { "title": "Value Prop 2", "description": "Description" },
    { "title": "Value Prop 3", "description": "Description" }
  ],
  "how_it_works": [
    { "step": 1, "title": "Step Title", "description": "Description" },
    { "step": 2, "title": "Step Title", "description": "Description" },
    { "step": 3, "title": "Step Title", "description": "Description" }
  ],
  "stats": [
    { "value": "17", "label": "Modalities Covered" },
    { "value": "$100M+", "label": "Deals Benchmarked" }
  ],
  "faqs": [
    { "question": "Question?", "answer": "Answer" }
  ]
}

Write the landing page content now.`;
}
