-- 100_team_audit_events.sql
--
-- Enterprise team workspace: shared calculation history, a typed audit trail
-- for estimates, and SSO auto-join scaffolding.
--
-- What already exists (migration 060): teams, team_members (role in
-- admin|analyst|viewer, status in pending|active|deactivated), team_invites,
-- audit_log (generic admin actions), user_profiles.team_id (denormalised copy
-- of the active membership). "Team admin" is team_members.role = 'admin';
-- no user_profiles.team_role column is needed and none is added here.
--
-- This migration adds:
--   1. Helper functions user_team_ids() / is_team_admin(team) — SECURITY DEFINER
--      so policies on other tables do not recurse through team_members RLS.
--   2. calculations: SELECT policy so active team members can read each
--      other's calculations (personal scope remains the default in the app).
--   3. audit_events: typed, per-estimate audit trail (who ran / exported /
--      shared which estimate, when, from where). Distinct from audit_log,
--      which stays the home of admin/config actions.
--   4. team_domains: email-domain -> team mapping for SSO auto-join
--      (see docs/enterprise-sso.md). Not yet consumed by the signup trigger.
--   5. teams.sso_entity_id / sso_sso_url: referenced by
--      app/api/portfolio/sso/{login,register} and the settings page but never
--      created by a migration. Added here (nullable) so those routes work.
--
-- Idempotent: safe to re-run.

BEGIN;

-- ── 1. Membership helpers ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.team_members
  WHERE user_id = auth.uid()
    AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.user_team_ids() FROM public;
REVOKE ALL ON FUNCTION public.is_team_admin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.user_team_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid) TO authenticated;

-- ── 2. Shared team history on calculations ───────────────────────────────────
-- Existing policy "Users read own calculations" (auth.uid() = user_id) stays.
-- This one adds: any active member of a team can read calculations owned by
-- any other active member of that same team. Service-role routes bypass RLS
-- and must check membership explicitly (app/api/calculations/route.ts does).

DROP POLICY IF EXISTS "Team members read team calculations" ON public.calculations;
CREATE POLICY "Team members read team calculations"
  ON public.calculations FOR SELECT
  TO authenticated
  USING (
    user_id IS NOT NULL
    AND user_id IN (
      SELECT tm.user_id
      FROM public.team_members tm
      WHERE tm.status = 'active'
        AND tm.team_id IN (SELECT public.user_team_ids())
    )
  );

-- ── 3. audit_events ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                 uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  user_id                 uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Enum-ish: enforced by CHECK so a typo in app code fails loudly in dev.
  event_type              text NOT NULL,
  resource_type           text NOT NULL,
  resource_id             text,
  calculation_fingerprint text,
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Salted SHA-256 of the client IP (never the raw IP); see lib/audit-log.ts.
  ip_hash                 text,
  user_agent              text,
  created_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT audit_events_event_type_check CHECK (event_type IN (
    'calculation_created',
    'calculation_viewed',
    'history_viewed',
    'results_exported',
    'results_shared',
    'share_viewed',
    'report_purchased',
    'team_history_viewed',
    'audit_exported'
  )),
  CONSTRAINT audit_events_resource_type_check CHECK (resource_type IN (
    'calculation', 'share', 'report', 'history', 'audit'
  )),
  CONSTRAINT audit_events_metadata_size_check CHECK (pg_column_size(metadata) <= 8192)
);

CREATE INDEX IF NOT EXISTS idx_audit_events_team_created
  ON public.audit_events (team_id, created_at DESC) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_user_created
  ON public.audit_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_team_type
  ON public.audit_events (team_id, event_type, created_at DESC) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_events_fingerprint
  ON public.audit_events (calculation_fingerprint) WHERE calculation_fingerprint IS NOT NULL;

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Users read their own trail.
DROP POLICY IF EXISTS audit_events_select_own ON public.audit_events;
CREATE POLICY audit_events_select_own
  ON public.audit_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Team admins read their team's trail.
DROP POLICY IF EXISTS audit_events_select_team_admin ON public.audit_events;
CREATE POLICY audit_events_select_team_admin
  ON public.audit_events FOR SELECT
  TO authenticated
  USING (team_id IS NOT NULL AND public.is_team_admin(team_id));

-- No INSERT/UPDATE/DELETE policies for authenticated: writes go through the
-- service role (lib/audit-log.ts recordAuditEvent). Append-only by design.

COMMENT ON TABLE public.audit_events IS
  'Per-estimate audit trail (who ran / viewed / exported / shared which calculation). Append-only; written by service role via lib/audit-log.ts recordAuditEvent(). Admin/config actions live in audit_log.';
COMMENT ON COLUMN public.audit_events.ip_hash IS
  'sha256(AUDIT_IP_HASH_SALT || client_ip), hex. Raw IPs are never stored.';

-- ── 4. team_domains (SSO auto-join) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_domains (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  domain         text NOT NULL,
  auto_join_role text NOT NULL DEFAULT 'viewer'
    CHECK (auto_join_role IN ('admin', 'analyst', 'viewer')),
  verified_at    timestamptz,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_domains_domain_lower CHECK (domain = lower(domain)),
  CONSTRAINT team_domains_domain_unique UNIQUE (domain)
);

CREATE INDEX IF NOT EXISTS idx_team_domains_team ON public.team_domains (team_id);

ALTER TABLE public.team_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_domains_select_member ON public.team_domains;
CREATE POLICY team_domains_select_member
  ON public.team_domains FOR SELECT
  TO authenticated
  USING (team_id IN (SELECT public.user_team_ids()));

DROP POLICY IF EXISTS team_domains_insert_admin ON public.team_domains;
CREATE POLICY team_domains_insert_admin
  ON public.team_domains FOR INSERT
  TO authenticated
  WITH CHECK (public.is_team_admin(team_id));

DROP POLICY IF EXISTS team_domains_delete_admin ON public.team_domains;
CREATE POLICY team_domains_delete_admin
  ON public.team_domains FOR DELETE
  TO authenticated
  USING (public.is_team_admin(team_id));

COMMENT ON TABLE public.team_domains IS
  'Verified email domains that auto-join a team on first SSO sign-in. Consumed by the handle_new_user change described in docs/enterprise-sso.md (not yet applied).';

-- ── 5. SSO columns referenced by existing code but never migrated ────────────

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS sso_entity_id text,
  ADD COLUMN IF NOT EXISTS sso_sso_url   text;

COMMIT;
