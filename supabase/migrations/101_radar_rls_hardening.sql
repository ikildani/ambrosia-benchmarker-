-- 101_radar_rls_hardening.sql
--
-- Asset Radar P0 security hardening.
--
-- Background: migrations 090/093/094/095/096 created the Radar intelligence
-- tables with `FOR SELECT USING (true)` policies, which exposed the entire
-- scored asset universe (and every user's notes, including emails) to the
-- anon key. All reads go through /api/radar/* route handlers using the
-- service-role client; a repo-wide grep confirmed no client component or
-- page reads these tables directly with the anon/authenticated key
-- (the only non-API readers are the server-only lib/radar/* jobs, which also
-- use the service client). So public/authenticated SELECT is not needed.
--
-- This migration:
--   1. Drops the public-read policies on the intelligence tables and leaves
--      SELECT to service_role only (explicit policy added for clarity; the
--      existing "Service role full access" FOR ALL policies remain).
--   2. Replaces the world-readable notes policy with author-or-teammate
--      scoping, using user_team_ids() from migration 100.
--   3. Adds radar_asset_narratives: a read-through cache for the Opus-
--      generated analyst brief, keyed by a hash of the inputs, so repeated
--      opens of an asset do not re-call the model.
--
-- Idempotent: safe to re-run.

BEGIN;

-- ── 1. Intelligence tables: service_role SELECT only ─────────────────────────

-- clinical_assets (090)
DROP POLICY IF EXISTS "Public read clinical assets" ON public.clinical_assets;
DROP POLICY IF EXISTS "Service role read clinical assets" ON public.clinical_assets;
CREATE POLICY "Service role read clinical assets"
  ON public.clinical_assets FOR SELECT
  TO service_role
  USING (true);

-- radar_deal_theses (093)
DROP POLICY IF EXISTS "Public read deal theses" ON public.radar_deal_theses;
DROP POLICY IF EXISTS "Service role read deal theses" ON public.radar_deal_theses;
CREATE POLICY "Service role read deal theses"
  ON public.radar_deal_theses FOR SELECT
  TO service_role
  USING (true);

-- licensing_signals (094)
DROP POLICY IF EXISTS "Public read licensing signals" ON public.licensing_signals;
DROP POLICY IF EXISTS "Service role read licensing signals" ON public.licensing_signals;
CREATE POLICY "Service role read licensing signals"
  ON public.licensing_signals FOR SELECT
  TO service_role
  USING (true);

-- asset_signal_snapshots (094)
DROP POLICY IF EXISTS "Public read signal snapshots" ON public.asset_signal_snapshots;
DROP POLICY IF EXISTS "Service role read signal snapshots" ON public.asset_signal_snapshots;
CREATE POLICY "Service role read signal snapshots"
  ON public.asset_signal_snapshots FOR SELECT
  TO service_role
  USING (true);

-- competitive_intel (095)
DROP POLICY IF EXISTS "Public read competitive intel" ON public.competitive_intel;
DROP POLICY IF EXISTS "Service role read competitive intel" ON public.competitive_intel;
CREATE POLICY "Service role read competitive intel"
  ON public.competitive_intel FOR SELECT
  TO service_role
  USING (true);

-- radar_deal_opportunities (095)
DROP POLICY IF EXISTS "Public read deal opportunities" ON public.radar_deal_opportunities;
DROP POLICY IF EXISTS "Service role read deal opportunities" ON public.radar_deal_opportunities;
CREATE POLICY "Service role read deal opportunities"
  ON public.radar_deal_opportunities FOR SELECT
  TO service_role
  USING (true);

-- ── 2. radar_asset_notes: author or same-team readers only ───────────────────
-- Mirrors "Team members read team calculations" (migration 100): a note is
-- visible to its author and to every active member of any team the reader
-- is an active member of. INSERT/DELETE policies from 096 are unchanged.

DROP POLICY IF EXISTS "Users read all notes" ON public.radar_asset_notes;
DROP POLICY IF EXISTS "Users read own or team notes" ON public.radar_asset_notes;
CREATE POLICY "Users read own or team notes"
  ON public.radar_asset_notes FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT tm.user_id
      FROM public.team_members tm
      WHERE tm.status = 'active'
        AND tm.team_id IN (SELECT public.user_team_ids())
    )
  );

-- ── 3. radar_asset_narratives: read-through cache for the AI brief ───────────

CREATE TABLE IF NOT EXISTS public.radar_asset_narratives (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    uuid NOT NULL REFERENCES public.clinical_assets(id) ON DELETE CASCADE,
  -- sha256 hex of the JSON-serialised NarrativeInput (app/api/radar/_lib/radar-api.ts)
  input_hash  text NOT NULL,
  narrative   text NOT NULL,
  model       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT radar_asset_narratives_asset_hash_unique UNIQUE (asset_id, input_hash),
  CONSTRAINT radar_asset_narratives_hash_format CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT radar_asset_narratives_narrative_size CHECK (char_length(narrative) <= 8000)
);

CREATE INDEX IF NOT EXISTS idx_radar_asset_narratives_asset_created
  ON public.radar_asset_narratives (asset_id, created_at DESC);

ALTER TABLE public.radar_asset_narratives ENABLE ROW LEVEL SECURITY;

-- Service role only: written and read by the narrative/export routes.
DROP POLICY IF EXISTS "Service role full access narratives" ON public.radar_asset_narratives;
CREATE POLICY "Service role full access narratives"
  ON public.radar_asset_narratives FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.radar_asset_narratives IS
  'Cache of Opus-generated analyst briefs per clinical asset, keyed by a hash of the narrative inputs. Read-through from app/api/radar/_lib/radar-api.ts getOrGenerateNarrative(); stale rows are harmless and can be pruned.';

COMMIT;
