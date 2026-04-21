-- Reactive SEO content queue: bridges competitor-intel alerts to blog generation
CREATE TABLE seo_content_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,  -- 'competitor_intel' | 'manual' | 'deal_alert'
  trigger_event JSONB NOT NULL,  -- the competitor intel entry that triggered this
  priority INTEGER DEFAULT 50,  -- higher = more urgent (news-reactive = 90, rotation = 50)
  status TEXT DEFAULT 'pending',  -- pending | generating | published | failed
  topic_params JSONB NOT NULL,  -- { therapeuticArea, phase, modality, dealType, headline, companies, dealValue }
  generated_slug TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX idx_seo_queue_status ON seo_content_queue(status) WHERE status = 'pending';
