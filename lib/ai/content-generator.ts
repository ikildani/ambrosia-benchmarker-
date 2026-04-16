import Anthropic from '@anthropic-ai/sdk';
import benchmarks from '@/data/benchmarks.json';
import {
  generateModalityInsightsPrompt,
  generateEducationalPrompt,
  generateDealTrendsPrompt,
  generateIndustryAnalysisPrompt,
  BlogPostPromptParams,
} from './prompts/blog-post';
import { generateLandingPagePrompt, LandingPagePromptParams } from './prompts/landing-page';
import { ContentCategory, GenerationParameters } from '@/types/content';

// Types
export interface GeneratedBlogSource {
  title: string;
  url?: string;
  publication?: string;
  date?: string;
}

export interface GeneratedBlogContent {
  title: string;
  meta_description: string;
  excerpt: string;
  content: string;
  faqs: Array<{ question: string; answer: string }>;
  sources: GeneratedBlogSource[];
}

export interface GeneratedLandingContent {
  title: string;
  meta_description: string;
  hero: {
    headline: string;
    subtitle: string;
    cta_text: string;
  };
  value_props: Array<{ title: string; description: string }>;
  how_it_works: Array<{ step: number; title: string; description: string }>;
  stats: Array<{ value: string; label: string }>;
  faqs: Array<{ question: string; answer: string }>;
}

// Get modality data from benchmarks
function getModalityData(modalityKey: string) {
  const modalities = benchmarks.modalities as Record<string, {
    multiplier: number;
    label: string;
    context: string;
  }>;
  return modalities[modalityKey] || null;
}

// Get phase baseline data
function getPhaseData(phase: string = 'phase2') {
  const baselines = benchmarks.phaseBaselines as Record<string, {
    upfront: { low: number; median: number; high: number };
    totalValue: { low: number; median: number; high: number };
    royalty: { base: number; max: number };
  }>;
  return baselines[phase] || baselines.phase2;
}

// Indication labels
const indicationLabels: Record<string, string> = {
  lung_nsclc: 'Non-Small Cell Lung Cancer (NSCLC)',
  lung_sclc: 'Small Cell Lung Cancer (SCLC)',
  breast_her2: 'HER2+ Breast Cancer',
  breast_tnbc: 'Triple-Negative Breast Cancer',
  breast_hr: 'HR+ Breast Cancer',
  colorectal: 'Colorectal Cancer',
  pancreatic: 'Pancreatic Cancer',
  melanoma: 'Melanoma',
  prostate: 'Prostate Cancer',
  ovarian: 'Ovarian Cancer',
  gastric: 'Gastric Cancer',
  liver: 'Hepatocellular Carcinoma',
  renal: 'Renal Cell Carcinoma',
  gbm: 'Glioblastoma (GBM)',
  bladder: 'Bladder Cancer',
  headNeck: 'Head & Neck Cancer',
  aml: 'Acute Myeloid Leukemia (AML)',
  all: 'Acute Lymphoblastic Leukemia (ALL)',
  cll: 'Chronic Lymphocytic Leukemia (CLL)',
  myeloma: 'Multiple Myeloma',
  dlbcl: 'Diffuse Large B-Cell Lymphoma',
  follicular: 'Follicular Lymphoma',
};

// Build prompt params from generation parameters
function buildBlogPromptParams(params: GenerationParameters): BlogPostPromptParams {
  const promptParams: BlogPostPromptParams = {
    topic: params.topic,
    targetKeyword: params.topic,
    category: params.category,
  };

  if (params.modality) {
    const modalityData = getModalityData(params.modality);
    if (modalityData) {
      promptParams.modality = params.modality;
      promptParams.modalityLabel = modalityData.label;
      promptParams.modalityContext = modalityData.context;
      promptParams.modalityMultiplier = modalityData.multiplier;
    }
  }

  if (params.indication) {
    promptParams.indication = params.indication;
    promptParams.indicationLabel = indicationLabels[params.indication] || params.indication;
  }

  const phaseData = getPhaseData(params.phase || 'phase2');
  promptParams.phaseData = {
    phase: params.phase || 'phase2',
    ...phaseData,
  };

  return promptParams;
}

// Build landing page prompt params
function buildLandingPromptParams(params: GenerationParameters): LandingPagePromptParams {
  const promptParams: LandingPagePromptParams = {
    targetKeyword: params.topic,
  };

  if (params.modality) {
    const modalityData = getModalityData(params.modality);
    if (modalityData) {
      promptParams.modality = params.modality;
      promptParams.modalityLabel = modalityData.label;
      promptParams.modalityContext = modalityData.context;
      promptParams.modalityMultiplier = modalityData.multiplier;
    }
  }

  if (params.indication) {
    promptParams.indication = params.indication;
    promptParams.indicationLabel = indicationLabels[params.indication] || params.indication;
  }

  const phaseData = getPhaseData('phase2');
  promptParams.phaseData = {
    upfront: phaseData.upfront,
    totalValue: phaseData.totalValue,
  };

  return promptParams;
}

// Select the appropriate prompt based on category
function selectBlogPrompt(category: ContentCategory, params: BlogPostPromptParams): string {
  switch (category) {
    case 'modality-insights':
      return generateModalityInsightsPrompt(params);
    case 'educational':
      return generateEducationalPrompt(params);
    case 'deal-trends':
      return generateDealTrendsPrompt(params);
    case 'industry-analysis':
      return generateIndustryAnalysisPrompt(params);
    default:
      return generateDealTrendsPrompt(params);
  }
}

// Parse JSON from Claude's response
function parseJsonResponse<T>(text: string): T {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }
  return JSON.parse(jsonMatch[0]) as T;
}

// Main content generator class
export class ContentGenerator {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.client = new Anthropic({ apiKey });
  }

  async generateBlogPost(params: GenerationParameters): Promise<GeneratedBlogContent> {
    const category = params.category || 'deal-trends';
    const promptParams = buildBlogPromptParams(params);
    const prompt = selectBlogPrompt(category, promptParams);

    const message = await this.client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text content
    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    return parseJsonResponse<GeneratedBlogContent>(textContent.text);
  }

  async generateLandingPage(params: GenerationParameters): Promise<GeneratedLandingContent> {
    const promptParams = buildLandingPromptParams(params);
    const prompt = generateLandingPagePrompt(promptParams);

    const message = await this.client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    return parseJsonResponse<GeneratedLandingContent>(textContent.text);
  }
}

// Export singleton instance helper
let generatorInstance: ContentGenerator | null = null;

export function getContentGenerator(): ContentGenerator {
  if (!generatorInstance) {
    generatorInstance = new ContentGenerator();
  }
  return generatorInstance;
}
