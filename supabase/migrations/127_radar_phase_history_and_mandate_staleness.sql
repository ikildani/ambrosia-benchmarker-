-- 127_radar_phase_history_and_mandate_staleness.sql
--
-- Three pipeline-correctness fixes from the Sep 25 2026 audit:
--
--   1. clinical_assets.phase_history was never written (every row held the
--      default), so the phase_transition catalyst (lib/ingestion/catalysts.ts
--      derivePhaseTransitions) never fired. A BEFORE UPDATE trigger appends
--      {phase, from, date, kind:'phase'} whenever the indexer moves the phase
--      and {status, from, date, kind:'status'} when the trial status moves.
--      Rows still holding the default are seeded with their current phase at
--      first_posted_date so the first real transition has a predecessor.
--
--   2. radar_mandate_matches rows were insert-only: an asset that got
--      partnered, re-attributed to another owner, or dropped below the
--      mandate's minimum score stayed "matched" forever. is_stale /
--      stale_reason / last_evaluated_at let the matcher re-evaluate standing
--      matches (lib/radar/mandate-matcher.ts) and the digest and matches view
--      skip stale ones without deleting the user's read / saved state.
--
--   3. radar_user_mandates.team_id for shared mandates (team plan, week 4).
--
-- Apply after 126.

-- ══════════════════════════════════════════════════════════════════════
-- 1. phase_history
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.radar_clinical_assets_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_hist jsonb := COALESCE(NEW.phase_history, '[]'::jsonb);
BEGIN
  IF jsonb_typeof(v_hist) <> 'array' THEN
    v_hist := '[]'::jsonb;
  END IF;
  IF NEW.phase IS DISTINCT FROM OLD.phase THEN
    v_hist := v_hist || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'kind', 'phase', 'phase', NEW.phase, 'from', OLD.phase, 'date', to_char(now(), 'YYYY-MM-DD')
    )));
  END IF;
  IF NEW.trial_status IS DISTINCT FROM OLD.trial_status THEN
    v_hist := v_hist || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'kind', 'status', 'status', NEW.trial_status, 'from', OLD.trial_status, 'date', to_char(now(), 'YYYY-MM-DD')
    )));
  END IF;
  -- Keep the last 60 events; older history is in asset_catalysts.
  IF jsonb_array_length(v_hist) > 60 THEN
    v_hist := (SELECT jsonb_agg(e) FROM (SELECT e FROM jsonb_array_elements(v_hist) WITH ORDINALITY AS t(e, i) ORDER BY i DESC LIMIT 60) s);
  END IF;
  NEW.phase_history := v_hist;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_assets_history ON public.clinical_assets;
CREATE TRIGGER trg_clinical_assets_history
  BEFORE UPDATE OF phase, trial_status ON public.clinical_assets
  FOR EACH ROW
  WHEN (OLD.phase IS DISTINCT FROM NEW.phase OR OLD.trial_status IS DISTINCT FROM NEW.trial_status)
  EXECUTE FUNCTION public.radar_clinical_assets_history();

-- Seed: rows with no history get their current phase dated at first post.
UPDATE public.clinical_assets
SET phase_history = jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'kind', 'phase', 'phase', phase,
      'date', to_char(COALESCE(first_posted_date, created_at::date, now()::date), 'YYYY-MM-DD'),
      'seed', true
    )))
WHERE phase IS NOT NULL
  AND (phase_history IS NULL OR jsonb_typeof(phase_history) <> 'array' OR jsonb_array_length(phase_history) = 0);

COMMENT ON COLUMN public.clinical_assets.phase_history IS
  'Append-only log kept by trg_clinical_assets_history: [{kind: phase|status, phase|status, from, date, seed?}]. Read by lib/ingestion/catalysts.ts derivePhaseTransitions.';

-- ══════════════════════════════════════════════════════════════════════
-- 2. Mandate match staleness
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.radar_mandate_matches
  ADD COLUMN IF NOT EXISTS is_stale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stale_reason text,
  ADD COLUMN IF NOT EXISTS last_evaluated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radar_mandate_matches_stale_reason_check') THEN
    ALTER TABLE public.radar_mandate_matches ADD CONSTRAINT radar_mandate_matches_stale_reason_check
      CHECK (stale_reason IS NULL OR stale_reason IN ('partnered', 'score_below_min', 'ownership_excluded', 'filter_mismatch', 'asset_removed'));
  END IF;
END $$;

UPDATE public.radar_mandate_matches SET last_evaluated_at = matched_at WHERE last_evaluated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_radar_mandate_matches_live
  ON public.radar_mandate_matches (mandate_id, matched_at DESC)
  WHERE is_stale = false AND is_dismissed = false;

COMMENT ON COLUMN public.radar_mandate_matches.is_stale IS
  'True when the matcher re-evaluated the match and the asset no longer qualifies (see stale_reason). Read/saved/dismissed state is kept; the digest and matches view skip stale rows.';

-- ══════════════════════════════════════════════════════════════════════
-- 3. Shared mandates
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.radar_user_mandates
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_radar_user_mandates_team
  ON public.radar_user_mandates (team_id) WHERE team_id IS NOT NULL;

COMMENT ON COLUMN public.radar_user_mandates.team_id IS
  'Set when a mandate is shared with the owner''s team (team plan); null = personal.';
