-- 186: rank programs by the model's raw logit, not the calibrated probability.
--
-- Isotonic calibration is a step function: the active model maps 58k scored
-- programs onto ~1,100 distinct probabilities and its top block ties dozens of
-- programs at exactly 1.71%, so the head of the feed was ordered by id. The
-- logit carries the model's full ordering (28k distinct values on the same
-- rows). The calibrated probability stays the number users see; the logit
-- orders the feed and the percentiles. The scorer writes score_logit from now
-- on; existing rows are backfilled in batches from asset_signal_snapshots.logit
-- (see the PR), outside this migration.

ALTER TABLE public.clinical_assets ADD COLUMN IF NOT EXISTS score_logit double precision;

COMMENT ON COLUMN public.clinical_assets.score_logit IS
  'Raw model logit behind score_probability; orders the feed and percentiles (calibration ties the top).';

CREATE INDEX IF NOT EXISTS idx_clinical_assets_score_logit
  ON public.clinical_assets (score_logit DESC NULLS LAST, id DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_assets_program_primary_logit
  ON public.clinical_assets (score_logit DESC NULLS LAST, id DESC) WHERE program_primary;

-- Percentiles: same population and outputs, ties broken by the logit.
CREATE OR REPLACE FUNCTION public.radar_refresh_score_percentiles()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '180s'
AS $function$
DECLARE
  v_ranked integer := 0;
  v_cleared integer := 0;
  v_low_power boolean := false;
  v_programs jsonb;
BEGIN
  v_programs := public.radar_refresh_programs();

  SELECT COALESCE(b.low_power, false) INTO v_low_power
  FROM public.radar_score_models m
  JOIN public.radar_score_backtests b ON b.model_version = m.version
  WHERE m.is_active = true
  ORDER BY b.created_at DESC
  LIMIT 1;

  DROP TABLE IF EXISTS tmp_score_ranks;
  CREATE TEMP TABLE tmp_score_ranks ON COMMIT DROP AS
  WITH core AS (
    SELECT a.id, a.program_key,
           COALESCE(a.phase, 'unknown') || '|' || COALESCE(a.therapeutic_area, 'unknown') AS peer_key,
           COALESCE(a.score_probability, a.licensing_intent_score / 100.0) AS p,
           COALESCE(a.score_logit, '-Infinity'::double precision) AS lg
    FROM public.clinical_assets a
    WHERE a.licensing_intent_score IS NOT NULL
      AND a.program_primary
      AND a.owner_type = 'industry'
      AND a.partnership_status IN ('unpartnered', 'partially_partnered')
      AND a.ownership_status NOT IN ('comparator_or_background', 'marketed_other')
      AND a.phase IN ('preclinical', 'early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3')
  ),
  ranked AS (
    SELECT program_key,
           peer_key,
           round(100 * percent_rank() OVER (PARTITION BY peer_key ORDER BY p, lg))::smallint AS pct_peer,
           count(*) OVER (PARTITION BY peer_key) AS peer_n,
           round(100 * percent_rank() OVER (ORDER BY p, lg))::smallint AS pct_universe,
           avg(p) OVER (PARTITION BY peer_key) AS base_rate
    FROM core
  )
  SELECT a.id, r.peer_key, r.pct_peer, r.peer_n, r.pct_universe, r.base_rate
  FROM ranked r
  JOIN public.clinical_assets a ON a.program_key = r.program_key;

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

  UPDATE public.clinical_assets a
  SET score_pct_peer = NULL, score_peer_n = NULL, score_peer_key = NULL,
      score_pct_universe = NULL, score_base_rate = NULL
  WHERE a.score_pct_peer IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM tmp_score_ranks r WHERE r.id = a.id);
  GET DIAGNOSTICS v_cleared = ROW_COUNT;

  RETURN jsonb_build_object('ranked_changed', v_ranked, 'cleared', v_cleared, 'low_power', v_low_power, 'programs', v_programs);
END;
$function$;

-- QA: measure discrimination on the probability and logit. The old check
-- counted licensing_intent_score >= 30, but that column is probability x 100
-- and rounds to 0-2 for every program, so the blocker could never pass.
CREATE OR REPLACE FUNCTION public.radar_qa_score_stats(p_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET statement_timeout TO '180s'
AS $function$
DECLARE
  v_out          JSONB;
  v_active_model TEXT;
BEGIN
  SELECT version INTO v_active_model FROM radar_score_models WHERE is_active = true LIMIT 1;

  WITH scored AS (
    SELECT a.id, a.licensing_intent_score, a.score_confidence, a.score_model_version, a.last_scored_at,
           a.score_probability, a.score_logit
    FROM clinical_assets a
    JOIN companies c ON c.id = a.company_id AND c.owner_type = 'industry'
    WHERE a.last_scored_at IS NOT NULL
  ),
  latest AS (
    SELECT DISTINCT ON (s.asset_id) s.asset_id, s.licensing_intent_score, s.factor_scores, s.model_version, s.snapshot_date
    FROM asset_signal_snapshots s
    JOIN scored a ON a.id = s.asset_id
    WHERE s.snapshot_date >= CURRENT_DATE - GREATEST(COALESCE(p_days, 14), 1)
    ORDER BY s.asset_id, s.snapshot_date DESC
  ),
  checked AS (
    SELECT
      l.asset_id,
      l.licensing_intent_score,
      l.model_version,
      (jsonb_typeof(l.factor_scores) = 'array') AS is_array,
      CASE WHEN jsonb_typeof(l.factor_scores) = 'array' THEN jsonb_array_length(l.factor_scores) ELSE 0 END AS entries,
      CASE WHEN jsonb_typeof(l.factor_scores) = 'array'
           THEN (SELECT SUM(NULLIF(e->>'points', '')::numeric) FROM jsonb_array_elements(l.factor_scores) e)
           ELSE NULL END AS points_sum,
      CASE WHEN jsonb_typeof(l.factor_scores) = 'array'
           THEN EXISTS (SELECT 1 FROM jsonb_array_elements(l.factor_scores) e WHERE e->>'factor' = 'intercept')
           ELSE false END AS has_intercept,
      (l.model_version IS NULL OR l.model_version = 'v2-composite') AS is_v2
    FROM latest l
  ),
  flags AS (
    SELECT
      c.*,
      (NOT is_array OR entries < 9) AS entries_bad,
      CASE
        WHEN is_v2 THEN (points_sum IS NULL OR abs(points_sum - licensing_intent_score) > 0.5)
        ELSE (points_sum IS NULL OR NOT has_intercept OR abs(points_sum) > 20)
      END AS sum_bad
    FROM checked c
  ),
  agg AS (
    SELECT
      (SELECT COUNT(*) FROM scored)                                           AS scored_industry,
      COUNT(*)                                                                AS snapshot_checked,
      COUNT(*) FILTER (WHERE entries_bad)                                     AS entries_bad,
      COUNT(*) FILTER (WHERE sum_bad)                                         AS sum_bad,
      COUNT(*) FILTER (WHERE NOT is_v2)                                       AS v3_rows,
      COUNT(*) FILTER (WHERE is_v2)                                           AS v2_rows,
      COUNT(*) FILTER (WHERE model_version IS NULL)                           AS model_version_missing
    FROM flags
  ),
  dist AS (
    SELECT
      COUNT(*)                                                    AS n,
      MAX(licensing_intent_score)                                 AS max,
      AVG(licensing_intent_score)                                 AS mean,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY licensing_intent_score) AS p50,
      percentile_cont(0.9) WITHIN GROUP (ORDER BY licensing_intent_score) AS p90,
      COUNT(*) FILTER (WHERE licensing_intent_score >= 50)        AS count_ge_50,
      COUNT(*) FILTER (WHERE licensing_intent_score >= 30)        AS count_ge_30,
      COUNT(*) FILTER (WHERE score_confidence IS NULL)            AS confidence_missing,
      COUNT(*) FILTER (WHERE score_model_version IS NULL)         AS asset_model_version_missing,
      COUNT(score_probability)                                    AS prob_n,
      percentile_cont(0.5)  WITHIN GROUP (ORDER BY score_probability) AS prob_p50,
      percentile_cont(0.99) WITHIN GROUP (ORDER BY score_probability) AS prob_p99,
      COUNT(DISTINCT score_logit)                                 AS logit_distinct,
      COUNT(*) FILTER (WHERE score_probability IS NOT NULL AND score_logit IS NULL) AS logit_missing
    FROM scored
  ),
  s_entries AS (
    SELECT COALESCE(jsonb_agg(asset_id), '[]'::jsonb) AS ids FROM (SELECT asset_id FROM flags WHERE entries_bad ORDER BY asset_id LIMIT 20) x
  ),
  s_sum AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', asset_id, 'score', licensing_intent_score, 'points_sum', points_sum, 'model_version', model_version)), '[]'::jsonb) AS rows
    FROM (SELECT asset_id, licensing_intent_score, points_sum, model_version FROM flags WHERE sum_bad ORDER BY asset_id LIMIT 20) x
  )
  SELECT jsonb_build_object(
    'active_model_version', v_active_model,
    'scored_industry', agg.scored_industry,
    'snapshot_checked', agg.snapshot_checked,
    'v2_rows', agg.v2_rows,
    'v3_rows', agg.v3_rows,
    'entries_bad', jsonb_build_object('count', agg.entries_bad, 'sample_ids', s_entries.ids),
    'sum_bad', jsonb_build_object('count', agg.sum_bad, 'samples', s_sum.rows),
    'snapshot_model_version_missing', agg.model_version_missing,
    'asset_model_version_missing', dist.asset_model_version_missing,
    'confidence_missing', dist.confidence_missing,
    'distribution', jsonb_build_object(
      'n', dist.n, 'max', dist.max, 'mean', dist.mean, 'p50', dist.p50, 'p90', dist.p90,
      'count_ge_50', dist.count_ge_50, 'count_ge_30', dist.count_ge_30,
      'prob_n', dist.prob_n, 'prob_p50', dist.prob_p50, 'prob_p99', dist.prob_p99,
      'logit_distinct', dist.logit_distinct, 'logit_missing', dist.logit_missing)
  )
  INTO v_out
  FROM agg, dist, s_entries, s_sum;

  RETURN v_out;
END;
$function$;
