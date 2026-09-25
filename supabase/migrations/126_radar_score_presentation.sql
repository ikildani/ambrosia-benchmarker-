-- 126_radar_score_presentation.sql
--
-- The licensing-intent score v3 is a calibrated 12-month probability × 100 ×
-- availability. On Sep 25 2026 that put 90% of the core universe below 15 and
-- six assets above 30, so a strong program showed "4 / 100" with nothing to
-- compare it to. The number stays (it is the honest quantity); this migration
-- adds what makes it readable:
--
--   score_probability   the calibrated probability behind the score
--   score_pct_peer      percent rank within (phase × therapeutic area) among
--                       the core universe, 0-100 ("top 3% of Phase 2 oncology")
--   score_peer_n        how many peers that rank is over
--   score_peer_key      'phase_2|oncology'
--   score_pct_universe  percent rank across the whole core universe
--   score_base_rate     mean probability of the peer group (what "typical" is)
--   score_interval      {lo, hi, n, bin}: 80% Wilson interval of the observed
--                       licensing rate in the asset's calibration bin of the
--                       active backtest; null when the bin is too thin
--   score_top_drivers   [{factor, points, evidence, url, date}] top 3 by |points|
--   score_low_power     the active model was validated on < 30 positives
--
-- Per-asset fields are written by the scoring wave (lib/radar/signal-detection.ts).
-- The distribution fields are set-based: radar_refresh_score_percentiles() runs
-- once at the end of every scoring run (~56k rows, a few seconds).
--
-- asset_signal_snapshots gains logit + probability_raw so the v3 decomposition
-- can be checked exactly (QA follow-up from docs/asset-radar-qa.md).
--
-- Apply after 125.

ALTER TABLE public.clinical_assets
  ADD COLUMN IF NOT EXISTS score_probability numeric(7,5),
  ADD COLUMN IF NOT EXISTS score_pct_peer smallint,
  ADD COLUMN IF NOT EXISTS score_peer_n integer,
  ADD COLUMN IF NOT EXISTS score_peer_key text,
  ADD COLUMN IF NOT EXISTS score_pct_universe smallint,
  ADD COLUMN IF NOT EXISTS score_base_rate numeric(7,5),
  ADD COLUMN IF NOT EXISTS score_interval jsonb,
  ADD COLUMN IF NOT EXISTS score_top_drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS score_low_power boolean NOT NULL DEFAULT false;

ALTER TABLE public.asset_signal_snapshots
  ADD COLUMN IF NOT EXISTS probability_raw numeric(7,5),
  ADD COLUMN IF NOT EXISTS logit numeric(9,4);

COMMENT ON COLUMN public.clinical_assets.score_pct_peer IS
  'Percent rank (0-100) of licensing_intent_score within score_peer_key (phase|therapeutic_area) over the core universe; set by radar_refresh_score_percentiles().';
COMMENT ON COLUMN public.clinical_assets.score_pct_universe IS
  'Percent rank (0-100) of licensing_intent_score over the whole core universe (industry, unpartnered or partial, pre-approval, owned program).';
COMMENT ON COLUMN public.clinical_assets.score_base_rate IS
  'Mean calibrated probability of the peer group; the "typical" value the score is compared against.';
COMMENT ON COLUMN public.clinical_assets.score_interval IS
  '{lo, hi, n, bin}: 80% Wilson interval of the observed licensing rate in the asset''s calibration bin (active backtest). Null when no active backtest or bin n < 30.';
COMMENT ON COLUMN public.clinical_assets.score_top_drivers IS
  'Top three score contributions by absolute points with their evidence: [{factor, points, evidence, url, date}].';

-- Percentile refresh reads these three columns in this order.
CREATE INDEX IF NOT EXISTS idx_clinical_assets_peer_rank
  ON public.clinical_assets (phase, therapeutic_area, licensing_intent_score DESC)
  WHERE licensing_intent_score IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════
-- Distribution refresh
-- ══════════════════════════════════════════════════════════════════════
--
-- Core universe = the population a buyer screens: industry-owned, unpartnered
-- or partially partnered, pre-approval, and an owned program (ownership_status
-- not comparator_or_background / marketed_other). Assets outside it keep their
-- score but get null percentiles, and the UI says "not ranked (outside the
-- core universe)".

CREATE OR REPLACE FUNCTION public.radar_refresh_score_percentiles()
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout = '120s'
AS $$
DECLARE
  v_ranked integer := 0;
  v_cleared integer := 0;
  v_low_power boolean := false;
BEGIN
  -- Low statistical power is a property of the active model, stamped on every ranked row.
  SELECT COALESCE(b.low_power, false) INTO v_low_power
  FROM public.radar_score_models m
  JOIN public.radar_score_backtests b ON b.model_version = m.version
  WHERE m.is_active = true
  ORDER BY b.created_at DESC
  LIMIT 1;

  DROP TABLE IF EXISTS tmp_score_ranks;
  CREATE TEMP TABLE tmp_score_ranks ON COMMIT DROP AS
  WITH core AS (
    SELECT a.id,
           COALESCE(a.phase, 'unknown') || '|' || COALESCE(a.therapeutic_area, 'unknown') AS peer_key,
           a.licensing_intent_score AS score,
           COALESCE(a.score_probability, a.licensing_intent_score / 100.0) AS p
    FROM public.clinical_assets a
    WHERE a.licensing_intent_score IS NOT NULL
      AND a.owner_type = 'industry'
      AND a.partnership_status IN ('unpartnered', 'partially_partnered')
      AND a.ownership_status NOT IN ('comparator_or_background', 'marketed_other')
      AND a.phase IN ('early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3')
  )
  SELECT id,
         peer_key,
         round(100 * percent_rank() OVER (PARTITION BY peer_key ORDER BY score))::smallint AS pct_peer,
         count(*) OVER (PARTITION BY peer_key) AS peer_n,
         round(100 * percent_rank() OVER (ORDER BY score))::smallint AS pct_universe,
         avg(p) OVER (PARTITION BY peer_key) AS base_rate
  FROM core;

  UPDATE public.clinical_assets a
  SET score_pct_peer = r.pct_peer,
      score_peer_n = r.peer_n,
      score_peer_key = r.peer_key,
      score_pct_universe = r.pct_universe,
      score_base_rate = round(r.base_rate::numeric, 5),
      score_low_power = v_low_power
  FROM tmp_score_ranks r
  WHERE a.id = r.id
    AND (a.score_pct_peer IS DISTINCT FROM r.pct_peer
      OR a.score_peer_n IS DISTINCT FROM r.peer_n
      OR a.score_peer_key IS DISTINCT FROM r.peer_key
      OR a.score_pct_universe IS DISTINCT FROM r.pct_universe
      OR a.score_base_rate IS DISTINCT FROM round(r.base_rate::numeric, 5)
      OR a.score_low_power IS DISTINCT FROM v_low_power);
  GET DIAGNOSTICS v_ranked = ROW_COUNT;

  -- Rows that left the core universe (partnered, re-attributed, approved) lose their rank.
  UPDATE public.clinical_assets a
  SET score_pct_peer = NULL, score_peer_n = NULL, score_peer_key = NULL,
      score_pct_universe = NULL, score_base_rate = NULL
  WHERE a.score_pct_peer IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM tmp_score_ranks r WHERE r.id = a.id);
  GET DIAGNOSTICS v_cleared = ROW_COUNT;

  RETURN jsonb_build_object('ranked_changed', v_ranked, 'cleared', v_cleared, 'low_power', v_low_power);
END;
$$;

COMMENT ON FUNCTION public.radar_refresh_score_percentiles() IS
  'Recomputes score_pct_peer / score_pct_universe / score_base_rate / score_low_power over the core universe. Called at the end of every licensing-signals run.';

REVOKE ALL ON FUNCTION public.radar_refresh_score_percentiles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_refresh_score_percentiles() TO service_role;
