-- Lead scoring & advisory conversion tracking
-- Stores lead scoring events, email send history, and calculation context
-- Used by lib/lead-scoring.ts to track deal-readiness signals

CREATE TABLE IF NOT EXISTS lead_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'calculation', 'email_1_sent', 'email_2_sent', 'email_3_sent', 'hot_lead_alert'
  context JSONB DEFAULT '{}',
  lead_score INTEGER,
  deal_stage TEXT, -- 'exploring', 'evaluating', 'preparing', 'active'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_user ON lead_events(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_type ON lead_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lead_events_created ON lead_events(created_at DESC);

-- RLS: only service role can access (this is internal analytics, not user-facing)
ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;
