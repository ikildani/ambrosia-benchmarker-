-- 140_radar_saved_views.sql
--
-- Search & Evaluation: saved views. A view is everything a user can change on
-- the feed (every filter, free text, sort, table/cards, visible columns)
-- under a name, private or shared with the owner's team, optionally the
-- default that opens on /radar. Mandates stay what they are: a subset of
-- filters with notifications and matching. A view is the whole screen.
--
-- Apply after 139. Idempotent.

CREATE TABLE IF NOT EXISTS public.radar_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort text NOT NULL DEFAULT 'score',
  dir text NOT NULL DEFAULT 'desc' CHECK (dir IN ('asc', 'desc')),
  view_mode text NOT NULL DEFAULT 'table' CHECK (view_mode IN ('table', 'cards')),
  columns text[] NOT NULL DEFAULT '{}',
  is_default boolean NOT NULL DEFAULT false,
  use_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radar_saved_views_user ON public.radar_saved_views (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_saved_views_team ON public.radar_saved_views (team_id, updated_at DESC) WHERE team_id IS NOT NULL;
-- One default per user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_radar_saved_views_default ON public.radar_saved_views (user_id) WHERE is_default;

ALTER TABLE public.radar_saved_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS radar_saved_views_service ON public.radar_saved_views;
CREATE POLICY radar_saved_views_service ON public.radar_saved_views
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.radar_saved_views_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_radar_saved_views_touch ON public.radar_saved_views;
CREATE TRIGGER trg_radar_saved_views_touch
  BEFORE UPDATE ON public.radar_saved_views
  FOR EACH ROW EXECUTE FUNCTION public.radar_saved_views_touch();

COMMENT ON TABLE public.radar_saved_views IS
  'Search & Evaluation saved views: full feed state (filters jsonb in the URL codec''s shape, sort, dir, view_mode, visible columns) under a name; team_id set when shared with the owner''s team; one is_default per user opens on /radar.';
