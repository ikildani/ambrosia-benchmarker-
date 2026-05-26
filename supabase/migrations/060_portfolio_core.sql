-- Portfolio License — core multi-tenant infrastructure
-- Teams, team members, invites, audit log, user_profiles alterations

BEGIN;

-- 1. Teams table — organizational unit for a Portfolio license
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  portfolio_tier TEXT NOT NULL DEFAULT 'growth'
    CHECK (portfolio_tier IN ('growth', 'scale', 'enterprise')),
  max_seats INTEGER NOT NULL DEFAULT 5,

  -- Stripe
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'past_due', 'cancelled', 'trialing')),

  -- Contract
  contract_start_date DATE,
  contract_end_date DATE,

  -- White-label branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0f172a',
  secondary_color TEXT DEFAULT '#14b8a6',
  disclaimer_text TEXT,

  -- Analyst hours
  analyst_hours_monthly INTEGER DEFAULT 2,
  analyst_hours_used_this_month NUMERIC(5,1) DEFAULT 0,
  analyst_hours_period_start DATE DEFAULT CURRENT_DATE,

  -- Slack/Teams integration
  slack_webhook_url TEXT,
  slack_channel_type TEXT DEFAULT 'slack' CHECK (slack_channel_type IN ('slack', 'teams')),

  -- SSO
  sso_provider_id TEXT,
  sso_email_domain TEXT,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Team members — junction table linking users to teams
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin', 'analyst', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'deactivated')),
  UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_lookup ON team_members(team_id, user_id, status);
CREATE INDEX idx_team_members_user ON team_members(user_id) WHERE status = 'active';

-- 3. Team invites — invite tokens for team provisioning
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin', 'analyst', 'viewer')),
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_team_invites_token ON team_invites(token) WHERE accepted_at IS NULL;
CREATE INDEX idx_team_invites_email ON team_invites(email, team_id) WHERE accepted_at IS NULL;

-- 4. Audit log — enterprise compliance trail
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure', 'denied')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_team ON audit_log(team_id, created_at DESC) WHERE team_id IS NOT NULL;
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_log_action ON audit_log(action, created_at DESC);

-- 5. Add team_id to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_team_id ON user_profiles(team_id) WHERE team_id IS NOT NULL;

-- 6. Update tier CHECK constraint to include 'portfolio'
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_tier_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_tier_check
  CHECK (tier IN ('free', 'pro', 'report', 'portfolio'));

-- 7. RLS policies

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Teams: members can read their own team
CREATE POLICY teams_select_member ON teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
        AND team_members.user_id = auth.uid()
        AND team_members.status = 'active'
    )
  );

-- Teams: only admins can update
CREATE POLICY teams_update_admin ON teams FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
        AND team_members.user_id = auth.uid()
        AND team_members.role = 'admin'
        AND team_members.status = 'active'
    )
  );

-- Team members: active members can see teammates
CREATE POLICY team_members_select ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members AS tm
      WHERE tm.team_id = team_members.team_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- Team members: only admins can insert/update/delete
CREATE POLICY team_members_insert_admin ON team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members AS tm
      WHERE tm.team_id = team_members.team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
        AND tm.status = 'active'
    )
  );

CREATE POLICY team_members_update_admin ON team_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members AS tm
      WHERE tm.team_id = team_members.team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
        AND tm.status = 'active'
    )
  );

CREATE POLICY team_members_delete_admin ON team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members AS tm
      WHERE tm.team_id = team_members.team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
        AND tm.status = 'active'
    )
  );

-- Team invites: admins can manage, invited users can read their own
CREATE POLICY team_invites_select ON team_invites FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invites.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role = 'admin'
        AND team_members.status = 'active'
    )
  );

CREATE POLICY team_invites_insert_admin ON team_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invites.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role = 'admin'
        AND team_members.status = 'active'
    )
  );

-- Audit log: admins can read their team's logs, service role can insert
CREATE POLICY audit_log_select_admin ON audit_log FOR SELECT
  USING (
    team_id IS NULL
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = audit_log.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role = 'admin'
        AND team_members.status = 'active'
    )
  );

-- Allow service role to insert audit logs (application code uses service client)
CREATE POLICY audit_log_insert_service ON audit_log FOR INSERT
  WITH CHECK (true);

-- Updated_at trigger for teams
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_teams_updated_at();

COMMIT;
