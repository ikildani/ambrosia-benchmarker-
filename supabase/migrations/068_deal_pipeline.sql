-- Cross-Portfolio Deal Pipeline Tracker with conflict detection
CREATE TABLE IF NOT EXISTS portfolio_deal_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  partner_name TEXT,
  partner_company_id UUID,
  stage TEXT DEFAULT 'evaluating' CHECK (stage IN ('evaluating', 'due_diligence', 'negotiation', 'term_sheet', 'closed', 'passed')),
  deal_type TEXT,
  therapeutic_area TEXT,
  modality TEXT,
  indication TEXT,
  estimated_value_m NUMERIC,
  notes TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deal_pipeline_team ON portfolio_deal_pipelines (team_id, stage, updated_at DESC);
CREATE INDEX idx_deal_pipeline_partner ON portfolio_deal_pipelines (team_id, partner_name);

ALTER TABLE portfolio_deal_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view pipeline"
  ON portfolio_deal_pipelines FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Team members can manage pipeline entries"
  ON portfolio_deal_pipelines FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Service role full access to pipeline"
  ON portfolio_deal_pipelines FOR ALL
  USING (auth.role() = 'service_role');

-- Alert relevance scoring for deal alerts
ALTER TABLE deal_alert_history ADD COLUMN IF NOT EXISTS relevance_score NUMERIC;
ALTER TABLE deal_alert_history ADD COLUMN IF NOT EXISTS relevance_factors JSONB;
