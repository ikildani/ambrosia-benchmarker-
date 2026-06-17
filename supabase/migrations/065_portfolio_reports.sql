-- Portfolio Reports: stores generated quarterly/on-demand reports for retrieval
CREATE TABLE IF NOT EXISTS portfolio_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL DEFAULT 'quarterly' CHECK (report_type IN ('quarterly', 'on_demand', 'white_label')),
  quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),
  year INTEGER,
  title TEXT,
  pdf_url TEXT,
  generated_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portfolio_reports_team ON portfolio_reports (team_id, created_at DESC);

ALTER TABLE portfolio_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view reports"
  ON portfolio_reports FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Admins can create reports"
  ON portfolio_reports FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  );

CREATE POLICY "Service role full access to reports"
  ON portfolio_reports FOR ALL
  USING (auth.role() = 'service_role');
