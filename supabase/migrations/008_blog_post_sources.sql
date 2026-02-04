-- Add sources column to blog_posts table for credibility
-- Sources are stored as JSONB array of source objects

ALTER TABLE blog_posts
ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN blog_posts.sources IS 'Array of source objects: [{title, url, publication, date}]';

-- Create index for potential source querying
CREATE INDEX IF NOT EXISTS idx_blog_posts_sources ON blog_posts USING GIN (sources);
