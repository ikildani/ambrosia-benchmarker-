-- Backlink outreach tracking
CREATE TABLE IF NOT EXISTS backlink_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name VARCHAR(200),
  contact_email VARCHAR(200),
  organization VARCHAR(200) NOT NULL,
  org_type VARCHAR(50) NOT NULL,
  data_hook TEXT,
  page_linked VARCHAR(500),
  outreach_date DATE NOT NULL,
  follow_up_date DATE,
  status VARCHAR(30) DEFAULT 'sent',
  backlink_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlink_outreach_org ON backlink_outreach(organization);
CREATE INDEX IF NOT EXISTS idx_backlink_outreach_status ON backlink_outreach(status);
CREATE INDEX IF NOT EXISTS idx_backlink_outreach_date ON backlink_outreach(outreach_date DESC);
CREATE INDEX IF NOT EXISTS idx_backlink_outreach_followup ON backlink_outreach(follow_up_date);

ALTER TABLE backlink_outreach ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on backlink_outreach" ON backlink_outreach FOR ALL USING (true) WITH CHECK (true);
