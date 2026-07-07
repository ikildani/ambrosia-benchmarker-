-- Content pruning support: noindex flag and archive timestamp for blog posts
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS noindex BOOLEAN DEFAULT false;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
