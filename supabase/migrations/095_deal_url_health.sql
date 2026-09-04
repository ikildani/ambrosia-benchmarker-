-- Add URL health tracking columns to deals table
-- Used by the link-health cron to track source URL availability

ALTER TABLE deals ADD COLUMN IF NOT EXISTS url_status TEXT DEFAULT 'unknown'
  CHECK (url_status IN ('alive', 'dead', 'unknown'));

ALTER TABLE deals ADD COLUMN IF NOT EXISTS url_checked_at TIMESTAMPTZ;

-- Index for efficient cron queries (unchecked or stale URLs first)
CREATE INDEX IF NOT EXISTS idx_deals_url_health
  ON deals (url_status, url_checked_at)
  WHERE source_url IS NOT NULL;
