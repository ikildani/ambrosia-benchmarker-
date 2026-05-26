-- Shared Comp Library — team-scoped saved searches and annotations

BEGIN;

CREATE TABLE IF NOT EXISTS shared_comp_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  filters JSONB NOT NULL DEFAULT '{}',
  deal_ids UUID[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comp_sets_team ON shared_comp_sets(team_id, created_at DESC);

CREATE TABLE IF NOT EXISTS comp_set_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_set_id UUID NOT NULL REFERENCES shared_comp_sets(id) ON DELETE CASCADE,
  deal_id UUID,
  user_id UUID REFERENCES auth.users(id),
  annotation_type TEXT DEFAULT 'note'
    CHECK (annotation_type IN ('note', 'flag', 'highlight', 'exclusion')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_annotations_comp_set ON comp_set_annotations(comp_set_id);

-- RLS
ALTER TABLE shared_comp_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE comp_set_annotations ENABLE ROW LEVEL SECURITY;

-- Team members can read/write comp sets for their team
CREATE POLICY comp_sets_select ON shared_comp_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = shared_comp_sets.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.status = 'active'
    )
  );

CREATE POLICY comp_sets_insert ON shared_comp_sets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = shared_comp_sets.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.status = 'active'
    )
  );

CREATE POLICY comp_sets_update ON shared_comp_sets FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = shared_comp_sets.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role = 'admin'
        AND team_members.status = 'active'
    )
  );

CREATE POLICY comp_sets_delete ON shared_comp_sets FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = shared_comp_sets.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role = 'admin'
        AND team_members.status = 'active'
    )
  );

-- Annotations: team members can read/write
CREATE POLICY annotations_select ON comp_set_annotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_comp_sets
      JOIN team_members ON team_members.team_id = shared_comp_sets.team_id
      WHERE shared_comp_sets.id = comp_set_annotations.comp_set_id
        AND team_members.user_id = auth.uid()
        AND team_members.status = 'active'
    )
  );

CREATE POLICY annotations_insert ON comp_set_annotations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_comp_sets
      JOIN team_members ON team_members.team_id = shared_comp_sets.team_id
      WHERE shared_comp_sets.id = comp_set_annotations.comp_set_id
        AND team_members.user_id = auth.uid()
        AND team_members.status = 'active'
    )
  );

-- Updated_at trigger
CREATE TRIGGER comp_sets_updated_at
  BEFORE UPDATE ON shared_comp_sets
  FOR EACH ROW EXECUTE FUNCTION update_teams_updated_at();

COMMIT;
