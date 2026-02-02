// Content System Types

export type ContentStatus = 'draft' | 'review' | 'published' | 'archived';
export type ContentCategory = 'deal-trends' | 'modality-insights' | 'educational' | 'industry-analysis';
export type JobType = 'blog_post' | 'landing_page' | 'faq';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  meta_keywords: string[] | null;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  category: ContentCategory | null;
  tags: string[] | null;
  modality: string | null;
  indication: string | null;
  ai_generated: boolean;
  ai_prompt_used: string | null;
  generation_model: string | null;
  status: ContentStatus;
  author_email: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  view_count: number;
  related_post_ids: string[] | null;
}

export interface LandingPage {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_cta_text: string;
  sections: LandingPageSection[] | null;
  target_keyword: string | null;
  secondary_keywords: string[] | null;
  prefill_modality: string | null;
  prefill_indication: string | null;
  prefill_phase: string | null;
  ai_generated: boolean;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface LandingPageSection {
  type: 'features' | 'stats' | 'testimonial' | 'cta' | 'faq' | 'comparison';
  title?: string;
  content?: string;
  items?: Array<{
    title?: string;
    description?: string;
    icon?: string;
    value?: string;
  }>;
}

export interface ContentGenerationJob {
  id: string;
  job_type: JobType;
  status: JobStatus;
  prompt_template: string | null;
  parameters: GenerationParameters | null;
  target_keyword: string | null;
  generated_content: string | null;
  generated_title: string | null;
  generated_meta_description: string | null;
  generated_at: string | null;
  result_post_id: string | null;
  result_page_id: string | null;
  requested_by: string | null;
  created_at: string;
  error_message: string | null;
}

export interface GenerationParameters {
  modality?: string;
  indication?: string;
  phase?: string;
  topic?: string;
  category?: ContentCategory;
  tone?: 'professional' | 'educational' | 'technical';
  wordCount?: number;
  includeFaq?: boolean;
  includeStats?: boolean;
}

// API Request/Response types
export interface CreateBlogPostRequest {
  title: string;
  slug?: string;
  content: string;
  excerpt?: string;
  meta_description?: string;
  category?: ContentCategory;
  tags?: string[];
  modality?: string;
  indication?: string;
  ai_generated?: boolean;
}

export interface UpdateBlogPostRequest {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  meta_description?: string;
  category?: ContentCategory;
  tags?: string[];
  status?: ContentStatus;
  modality?: string;
  indication?: string;
}

export interface GenerateContentRequest {
  job_type: JobType;
  target_keyword: string;
  parameters: GenerationParameters;
}

export interface GenerateContentResponse {
  job_id: string;
  status: JobStatus;
  content?: {
    title: string;
    meta_description: string;
    content: string;
    excerpt?: string;
    faqs?: Array<{ question: string; answer: string }>;
  };
}

// Helper to generate slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 100);
}
