-- Portfolio Company Office Hours: quarterly scheduling for BD consultations
CREATE TABLE IF NOT EXISTS office_hour_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  scheduled_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'booked', 'completed', 'cancelled')),
  topic TEXT,
  notes TEXT,
  booked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_office_hours_team ON office_hour_slots (team_id, scheduled_date DESC);
CREATE INDEX idx_office_hours_status ON office_hour_slots (team_id, status) WHERE status = 'booked';

ALTER TABLE office_hour_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view office hours"
  ON office_hour_slots FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Team members can book slots"
  ON office_hour_slots FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Admins can manage office hours"
  ON office_hour_slots FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  );

CREATE POLICY "Service role full access to office hours"
  ON office_hour_slots FOR ALL
  USING (auth.role() = 'service_role');
