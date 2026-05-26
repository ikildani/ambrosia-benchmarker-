-- Deal alert configuration and delivery history

BEGIN;

CREATE TABLE IF NOT EXISTS deal_alert_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  alert_type TEXT NOT NULL
    CHECK (alert_type IN ('deal_feed', 'custom_rule', 'saved_search')),
  filters JSONB NOT NULL DEFAULT '{}',
  channels JSONB DEFAULT '["email"]',
  slack_webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  frequency TEXT DEFAULT 'daily'
    CHECK (frequency IN ('realtime', 'daily', 'weekly')),
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_configs_team ON deal_alert_configs(team_id) WHERE is_active = true;
CREATE INDEX idx_alert_configs_user ON deal_alert_configs(user_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS deal_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_config_id UUID REFERENCES deal_alert_configs(id) ON DELETE CASCADE,
  deal_id UUID,
  delivered_via TEXT[],
  delivered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_history_config ON deal_alert_history(alert_config_id, delivered_at DESC);

-- RLS
ALTER TABLE deal_alert_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_alert_history ENABLE ROW LEVEL SECURITY;

-- Users can manage their own alerts; team admins can manage team alerts
CREATE POLICY alert_configs_select ON deal_alert_configs FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = deal_alert_configs.team_id
          AND team_members.user_id = auth.uid()
          AND team_members.status = 'active'
      )
    )
  );

CREATE POLICY alert_configs_insert ON deal_alert_configs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = deal_alert_configs.team_id
          AND team_members.user_id = auth.uid()
          AND team_members.role = 'admin'
          AND team_members.status = 'active'
      )
    )
  );

CREATE POLICY alert_configs_update ON deal_alert_configs FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (
      team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = deal_alert_configs.team_id
          AND team_members.user_id = auth.uid()
          AND team_members.role = 'admin'
          AND team_members.status = 'active'
      )
    )
  );

CREATE POLICY alert_configs_delete ON deal_alert_configs FOR DELETE
  USING (
    user_id = auth.uid()
    OR (
      team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = deal_alert_configs.team_id
          AND team_members.user_id = auth.uid()
          AND team_members.role = 'admin'
          AND team_members.status = 'active'
      )
    )
  );

-- Alert history: same access as config
CREATE POLICY alert_history_select ON deal_alert_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deal_alert_configs
      WHERE deal_alert_configs.id = deal_alert_history.alert_config_id
        AND (
          deal_alert_configs.user_id = auth.uid()
          OR (
            deal_alert_configs.team_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM team_members
              WHERE team_members.team_id = deal_alert_configs.team_id
                AND team_members.user_id = auth.uid()
                AND team_members.status = 'active'
            )
          )
        )
    )
  );

-- Service role insert for cron delivery
CREATE POLICY alert_history_insert ON deal_alert_history FOR INSERT
  WITH CHECK (true);

COMMIT;
