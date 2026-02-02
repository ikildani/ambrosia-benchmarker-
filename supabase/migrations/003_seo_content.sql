-- SEO Content System Migration
-- Creates tables for blog posts, landing pages, and content generation jobs

-- Blog posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  meta_description VARCHAR(300),
  meta_keywords TEXT[],

  -- Content
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image_url TEXT,

  -- SEO
  canonical_url TEXT,
  og_title VARCHAR(200),
  og_description VARCHAR(300),

  -- Categorization
  category VARCHAR(100), -- 'deal-trends', 'modality-insights', 'educational', 'industry-analysis'
  tags TEXT[],
  modality VARCHAR(50), -- Links to calculator modalities
  indication VARCHAR(50), -- Links to calculator indications

  -- Content generation
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_prompt_used TEXT,
  generation_model VARCHAR(50),

  -- Workflow
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'review', 'published', 'archived'
  author_email VARCHAR(255),
  reviewed_by VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  -- Analytics
  view_count INTEGER DEFAULT 0,

  -- Related content
  related_post_ids UUID[]
);

-- Landing pages table
CREATE TABLE IF NOT EXISTS landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,

  -- Page content
  title VARCHAR(200) NOT NULL,
  meta_description VARCHAR(300),

  -- Hero section
  hero_title VARCHAR(200),
  hero_subtitle TEXT,
  hero_cta_text VARCHAR(50) DEFAULT 'Try Calculator',

  -- Page sections (JSON for flexibility)
  sections JSONB,

  -- SEO
  target_keyword VARCHAR(200),
  secondary_keywords TEXT[],

  -- Calculator prefill
  prefill_modality VARCHAR(50),
  prefill_indication VARCHAR(50),
  prefill_phase VARCHAR(50),

  -- Content generation
  ai_generated BOOLEAN DEFAULT FALSE,

  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'review', 'published'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Content generation queue
CREATE TABLE IF NOT EXISTS content_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job details
  job_type VARCHAR(50) NOT NULL, -- 'blog_post', 'landing_page', 'faq'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'

  -- Generation parameters
  prompt_template VARCHAR(100),
  parameters JSONB, -- modality, indication, topic, etc.
  target_keyword VARCHAR(200),

  -- Results
  generated_content TEXT,
  generated_title VARCHAR(500),
  generated_meta_description VARCHAR(300),
  generated_at TIMESTAMPTZ,

  -- Linking
  result_post_id UUID REFERENCES blog_posts(id) ON DELETE SET NULL,
  result_page_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,

  -- Admin
  requested_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_modality ON blog_posts(modality);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_pages_status ON landing_pages(status);
CREATE INDEX IF NOT EXISTS idx_landing_pages_slug ON landing_pages(slug);
CREATE INDEX IF NOT EXISTS idx_content_jobs_status ON content_generation_jobs(status);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_landing_pages_updated_at ON landing_pages;
CREATE TRIGGER update_landing_pages_updated_at
  BEFORE UPDATE ON landing_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies (service role bypasses these, but good for security)
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to published content
CREATE POLICY "Public can read published blog posts"
  ON blog_posts
  FOR SELECT
  USING (status = 'published');

CREATE POLICY "Public can read published landing pages"
  ON landing_pages
  FOR SELECT
  USING (status = 'published');

-- Service role has full access (used by API routes)
-- Note: Service role key bypasses RLS by default
