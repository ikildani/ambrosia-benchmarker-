-- 118_radar_team_and_alerts.sql
--
-- Asset Radar Workstream G2: team watchlists and alerts.
--
--   1. radar_watchlist.team_id — org-scoped watchlist rows. Set on insert from
--      the caller's active team_members row; readable by every active member
--      of that team (policy mirrors "Users read own or team notes", 101).
--      Also last_partnership_status / last_score_seen so the notifier can
--      detect partnership transitions and score moves per watched asset
--      without a second history table.
--   2. radar_user_mandates.last_digest_at — "new matches since last digest"
--      cursor for the daily mandate digest.
--   3. radar_alert_rules — per-user (optionally team) alert configuration.
--   4. radar_alert_events — every delivered/queued alert, with a UNIQUE
--      dedupe_key so a re-run of the cron never double-sends. in_app rows are
--      read back by /api/radar/alerts?events=true (read_at marks them seen).
--
-- Idempotent: safe to re-run.

BEGIN;

-- ── 1. radar_watchlist: team scope + change-detection cursors ────────────────

ALTER TABLE public.radar_watchlist
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_partnership_status text,
  ADD COLUMN IF NOT EXISTS last_score_seen numeric;

CREATE INDEX IF NOT EXISTS idx_radar_watchlist_team
  ON public.radar_watchlist (team_id, added_at DESC) WHERE team_id IS NOT NULL;

-- Backfill team_id from the owner's active membership (one team per user in
-- practice; pick the earliest accepted membership deterministically).
UPDATE public.radar_watchlist w
SET team_id = tm.team_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, team_id
  FROM public.team_members
  WHERE status = 'active'
  ORDER BY user_id, accepted_at NULLS LAST, invited_at
) tm
WHERE w.user_id = tm.user_id
  AND w.team_id IS NULL;

-- Seed the change-detection cursors from the current asset state so the first
-- notifier run does not fire a "change" for every existing row.
UPDATE public.radar_watchlist w
SET last_partnership_status = COALESCE(w.last_partnership_status, a.partnership_status),
    last_score_seen = COALESCE(w.last_score_seen, a.licensing_intent_score)
FROM public.clinical_assets a
WHERE a.id = w.asset_id
  AND (w.last_partnership_status IS NULL OR w.last_score_seen IS NULL);

DROP POLICY IF EXISTS "Team members read team watchlist" ON public.radar_watchlist;
CREATE POLICY "Team members read team watchlist"
  ON public.radar_watchlist FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (team_id IS NOT NULL AND team_id IN (SELECT public.user_team_ids()))
  );

DROP TRIGGER IF EXISTS update_radar_watchlist_updated_at ON public.radar_watchlist;
CREATE TRIGGER update_radar_watchlist_updated_at
  BEFORE UPDATE ON public.radar_watchlist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON COLUMN public.radar_watchlist.team_id IS
  'Active team of the row owner at insert time. Rows with a team_id are visible to every active member of that team (org watchlist).';
COMMENT ON COLUMN public.radar_watchlist.last_partnership_status IS
  'partnership_status last seen by lib/radar/notifications.ts; a difference from clinical_assets.partnership_status fires partnership_change alerts.';
COMMENT ON COLUMN public.radar_watchlist.last_score_seen IS
  'licensing_intent_score last seen by lib/radar/notifications.ts (score_threshold / watchlist_activity detection).';

-- ── 2. radar_user_mandates: digest cursor ────────────────────────────────────

ALTER TABLE public.radar_user_mandates
  ADD COLUMN IF NOT EXISTS last_digest_at timestamptz;

COMMENT ON COLUMN public.radar_user_mandates.last_digest_at IS
  'Set by the radar-digest cron after a digest for this mandate was sent (any channel). Matches with matched_at after this are "new".';

-- ── 3. radar_alert_rules ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.radar_alert_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id     uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  kind        text NOT NULL CHECK (kind IN (
                'mandate_digest', 'score_threshold', 'partnership_change',
                'catalyst_upcoming', 'watchlist_activity')),
  -- Validated by alertRuleSchema in lib/radar/notifications.ts:
  --   mandate_digest     { mandate_id?: uuid|null, max_items?: int }
  --   score_threshold    { asset_id?: uuid|null, threshold: 0-100, direction: 'above'|'below'|'either' }
  --   partnership_change { asset_id?: uuid|null }
  --   catalyst_upcoming  { asset_id?: uuid|null, days_ahead: int }
  --   watchlist_activity { min_delta: int }
  --   any (channel=slack) { webhook_url: https://hooks.slack.com/... }
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel     text NOT NULL CHECK (channel IN ('email', 'slack', 'in_app')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT radar_alert_rules_config_size CHECK (pg_column_size(config) <= 4096)
);

CREATE INDEX IF NOT EXISTS idx_radar_alert_rules_user
  ON public.radar_alert_rules (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_alert_rules_active
  ON public.radar_alert_rules (kind) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_radar_alert_rules_asset
  ON public.radar_alert_rules ((config->>'asset_id')) WHERE config ? 'asset_id';

ALTER TABLE public.radar_alert_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own alert rules" ON public.radar_alert_rules;
CREATE POLICY "Users manage own alert rules"
  ON public.radar_alert_rules FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access alert rules" ON public.radar_alert_rules;
CREATE POLICY "Service role full access alert rules"
  ON public.radar_alert_rules FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.radar_alert_rules IS
  'Asset Radar alert configuration. Evaluated daily by /api/cron/radar-digest via lib/radar/notifications.ts. Mandate digests also run implicitly from radar_user_mandates.notify_email / notify_in_app without a rule.';

-- ── 4. radar_alert_events ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.radar_alert_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL for implicit mandate digests driven by radar_user_mandates.notify_*.
  rule_id     uuid REFERENCES public.radar_alert_rules(id) ON DELETE SET NULL,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id    uuid REFERENCES public.clinical_assets(id) ON DELETE CASCADE,
  mandate_id  uuid REFERENCES public.radar_user_mandates(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN (
                'mandate_digest', 'score_threshold', 'partnership_change',
                'catalyst_upcoming', 'watchlist_activity')),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel     text NOT NULL CHECK (channel IN ('email', 'slack', 'in_app')),
  sent_at     timestamptz NOT NULL DEFAULT now(),
  -- 'sent' | 'failed' | 'queued' (in_app rows are queued until read)
  delivery_status text NOT NULL DEFAULT 'sent'
    CHECK (delivery_status IN ('sent', 'failed', 'queued')),
  read_at     timestamptz,
  dedupe_key  text NOT NULL UNIQUE,
  CONSTRAINT radar_alert_events_payload_size CHECK (pg_column_size(payload) <= 16384)
);

CREATE INDEX IF NOT EXISTS idx_radar_alert_events_user_sent
  ON public.radar_alert_events (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_alert_events_rule
  ON public.radar_alert_events (rule_id, sent_at DESC) WHERE rule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_radar_alert_events_asset
  ON public.radar_alert_events (asset_id, sent_at DESC) WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_radar_alert_events_unread
  ON public.radar_alert_events (user_id, sent_at DESC)
  WHERE channel = 'in_app' AND read_at IS NULL;

ALTER TABLE public.radar_alert_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own alert events" ON public.radar_alert_events;
CREATE POLICY "Users read own alert events"
  ON public.radar_alert_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users mark own alert events read" ON public.radar_alert_events;
CREATE POLICY "Users mark own alert events read"
  ON public.radar_alert_events FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access alert events" ON public.radar_alert_events;
CREATE POLICY "Service role full access alert events"
  ON public.radar_alert_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.radar_alert_events IS
  'Append-only log of Asset Radar alerts. dedupe_key (kind:subject:bucket) is UNIQUE so cron re-runs are idempotent; inserts use ON CONFLICT DO NOTHING and only send when the insert succeeded.';

COMMIT;
