-- Self-healing cron remediation log
-- Tracks every auto-fix action for audit trail and learning system

CREATE TABLE IF NOT EXISTS remediation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_source TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  action_taken TEXT NOT NULL,
  confidence INTEGER,
  auto_fixed BOOLEAN NOT NULL DEFAULT true,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  reviewed_at TIMESTAMPTZ,
  review_outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_remediation_cron ON remediation_log (cron_source);
CREATE INDEX idx_remediation_deal ON remediation_log (deal_id);
CREATE INDEX idx_remediation_type ON remediation_log (issue_type);
CREATE INDEX idx_remediation_created ON remediation_log (created_at DESC);
CREATE INDEX idx_remediation_review ON remediation_log (needs_review) WHERE needs_review = true;

ALTER TABLE remediation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on remediation_log"
  ON remediation_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
