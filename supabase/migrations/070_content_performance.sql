-- Content Performance Feedback Loop
-- Adds GSC performance columns to blog_posts for tracking content → revenue attribution

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS gsc_clicks INTEGER DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS gsc_impressions INTEGER DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS gsc_avg_ctr NUMERIC(5,4);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS gsc_avg_position NUMERIC(5,1);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS conversion_signups INTEGER DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS conversion_pro INTEGER DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS performance_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_blog_posts_gsc_clicks ON blog_posts(gsc_clicks DESC) WHERE gsc_clicks > 0;
CREATE INDEX IF NOT EXISTS idx_blog_posts_conversion_signups ON blog_posts(conversion_signups DESC) WHERE conversion_signups > 0;
