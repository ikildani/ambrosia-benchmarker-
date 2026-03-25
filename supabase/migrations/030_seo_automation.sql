-- SEO Automation Tables
-- Supports: daily blog generation, health monitoring, CTR optimization, competitor intelligence

-- 1. Topic rotation log for daily AI blog generation
CREATE TABLE IF NOT EXISTS seo_content_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_key VARCHAR(500) UNIQUE NOT NULL,
  content_type VARCHAR(50) NOT NULL DEFAULT 'blog_post',
  result_id UUID,
  therapeutic_area VARCHAR(100),
  deal_type VARCHAR(50),
  modality VARCHAR(100),
  phase VARCHAR(50),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  performance_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_seo_content_log_topic ON seo_content_log(topic_key);
CREATE INDEX IF NOT EXISTS idx_seo_content_log_ta ON seo_content_log(therapeutic_area);
CREATE INDEX IF NOT EXISTS idx_seo_content_log_generated ON seo_content_log(generated_at DESC);

-- 2. SEO metrics store (GSC data, sitemap health, CWV)
CREATE TABLE IF NOT EXISTS seo_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_metrics_date ON seo_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_seo_metrics_type ON seo_metrics(metric_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_metrics_date_type ON seo_metrics(metric_date, metric_type);

-- 3. SEO metadata overrides (CTR optimization writes here, pages read at build)
CREATE TABLE IF NOT EXISTS seo_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path VARCHAR(500) UNIQUE NOT NULL,
  meta_title VARCHAR(200),
  meta_description VARCHAR(300),
  og_title VARCHAR(200),
  og_description VARCHAR(300),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_overrides_path ON seo_overrides(page_path);

-- 4. CTR optimization audit log (before/after tracking)
CREATE TABLE IF NOT EXISTS seo_optimization_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path VARCHAR(500) NOT NULL,
  optimization_type VARCHAR(50) NOT NULL DEFAULT 'meta',
  original_title VARCHAR(200),
  original_description VARCHAR(300),
  new_title VARCHAR(200),
  new_description VARCHAR(300),
  trigger_query VARCHAR(500),
  trigger_position DECIMAL,
  trigger_ctr DECIMAL,
  trigger_impressions INTEGER,
  result_ctr DECIMAL,
  result_position DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  measured_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_seo_opt_log_path ON seo_optimization_log(page_path);
CREATE INDEX IF NOT EXISTS idx_seo_opt_log_created ON seo_optimization_log(created_at DESC);

-- 5. Competitor content tracking
CREATE TABLE IF NOT EXISTS competitor_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(100) NOT NULL,
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  published_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  keyword_overlap JSONB,
  relevance_score DECIMAL,
  ai_analysis TEXT,
  suggested_response TEXT,
  response_status VARCHAR(20) DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_competitor_source ON competitor_content(source);
CREATE INDEX IF NOT EXISTS idx_competitor_detected ON competitor_content(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_relevance ON competitor_content(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_status ON competitor_content(response_status);

-- Enable RLS on all tables (admin-only access via service role)
ALTER TABLE seo_content_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_optimization_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_content ENABLE ROW LEVEL SECURITY;

-- Service role policies (crons use service role key)
CREATE POLICY "Service role full access" ON seo_content_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON seo_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON seo_overrides FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON seo_optimization_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON competitor_content FOR ALL USING (true) WITH CHECK (true);
