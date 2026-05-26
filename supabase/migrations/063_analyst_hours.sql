-- Analyst hours tracking for Portfolio License concierge service

BEGIN;

CREATE TABLE IF NOT EXISTS analyst_hour_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  logged_by UUID REFERENCES auth.users(id),
  description TEXT NOT NULL,
  hours NUMERIC(4,1) NOT NULL CHECK (hours > 0),
  service_date DATE NOT NULL,
  category TEXT CHECK (category IN ('research', 'report', 'call', 'custom')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analyst_hours_team ON analyst_hour_entries(team_id, service_date DESC);

-- RLS
ALTER TABLE analyst_hour_entries ENABLE ROW LEVEL SECURITY;

-- Team members can view their team's analyst hours
CREATE POLICY analyst_hours_select ON analyst_hour_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = analyst_hour_entries.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.status = 'active'
    )
  );

-- Only admins or service role can insert
CREATE POLICY analyst_hours_insert ON analyst_hour_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = analyst_hour_entries.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role = 'admin'
        AND team_members.status = 'active'
    )
  );

COMMIT;
