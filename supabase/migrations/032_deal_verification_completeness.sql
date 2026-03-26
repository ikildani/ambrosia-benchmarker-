-- Deal verification status + completeness audit tracking
ALTER TABLE deals ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';
UPDATE deals SET verification_status = 'verified' WHERE verified = true;
UPDATE deals SET verification_status = 'pending' WHERE verified = false OR verified IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_verification ON deals(verification_status);

CREATE TABLE IF NOT EXISTS deal_completeness_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  deals_found_public INTEGER,
  deals_in_db INTEGER,
  deals_missing INTEGER,
  deals_auto_ingested INTEGER,
  completeness_pct DECIMAL,
  missing_deals JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE deal_completeness_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on deal_completeness_audits" ON deal_completeness_audits FOR ALL USING (true) WITH CHECK (true);
