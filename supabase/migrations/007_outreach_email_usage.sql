-- Migration: Outreach Email Usage Tracking
-- Tracks daily email generation usage for rate limiting

-- Create outreach email usage table
CREATE TABLE IF NOT EXISTS outreach_email_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  email_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for daily tracking per user
  UNIQUE(user_id, date)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_outreach_email_usage_user_date
ON outreach_email_usage(user_id, date);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_outreach_email_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_outreach_email_usage_updated_at
BEFORE UPDATE ON outreach_email_usage
FOR EACH ROW
EXECUTE FUNCTION update_outreach_email_usage_updated_at();

-- Add comment
COMMENT ON TABLE outreach_email_usage IS 'Tracks daily outreach email generation for rate limiting (10 emails/day per Pro user)';

-- Create outreach_emails table for storing generated emails
CREATE TABLE IF NOT EXISTS outreach_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,

  -- Email content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  tone TEXT NOT NULL CHECK (tone IN ('formal', 'conversational')),

  -- Generation context
  match_score INTEGER,
  recipient_role TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user's emails
CREATE INDEX IF NOT EXISTS idx_outreach_emails_user
ON outreach_emails(user_id, created_at DESC);

COMMENT ON TABLE outreach_emails IS 'Stores generated outreach emails for user reference';
