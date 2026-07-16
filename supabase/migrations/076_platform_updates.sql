-- Migration: 076_platform_updates.sql
-- Platform Updates: changelog entries emailed bi-weekly to all users

CREATE TABLE IF NOT EXISTS platform_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  cta_url TEXT,
  cta_label VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_updates_sent_at ON platform_updates(sent_at);
CREATE INDEX IF NOT EXISTS idx_platform_updates_created_at ON platform_updates(created_at DESC);

ALTER TABLE platform_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access platform_updates" ON platform_updates
  FOR ALL USING (auth.role() = 'service_role');

-- Add platform_updates preference to email_preferences
ALTER TABLE email_preferences ADD COLUMN IF NOT EXISTS platform_updates BOOLEAN DEFAULT TRUE;
