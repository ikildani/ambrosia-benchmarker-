-- 156: programs, not trial arms.
--
-- A quarter of the default feed repeated a program the same company already
-- had: registries publish one row per trial arm, formulation or dose
-- ("[14C] BI 1356 oral solution" x122, "6.0 mg/kg of TQB2102"), and each
-- became an asset. 12,372 of 49,489 default-view rows were such repeats.
--
-- A program is one company x one drug (drug_master_id; the asset itself
-- when the drug is unresolved). Each program gets one primary row (most
-- advanced phase, then most trials, then most recently updated) and the
-- counts across its rows. The feed and facets show primary rows; the brief
-- lists the siblings. Percentiles rank programs, then every row inherits
-- its program's rank, so siblings never compete with each other.
--
-- radar_refresh_programs() runs at the start of radar_refresh_score_percentiles()
-- (every scoring wave). Apply after 155. Idempotent.

ALTER TABLE public.clinical_assets
  ADD COLUMN IF NOT EXISTS program_key text,
  ADD COLUMN IF NOT EXISTS program_primary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS program_assets integer,
  ADD COLUMN IF NOT EXISTS program_trials integer;

COMMENT ON COLUMN public.clinical_assets.program_key IS 'company_id:drug_master_id (or company_id:a:<asset id> when unresolved); one program per company x drug (migration 156).';
COMMENT ON COLUMN public.clinical_assets.program_primary IS 'The row that represents its program in the feed: most advanced phase, then most trials, then most recent update.';

CREATE INDEX IF NOT EXISTS idx_clinical_assets_program_key ON public.clinical_assets (program_key);
CREATE INDEX IF NOT EXISTS idx_clinical_assets_program_primary ON public.clinical_assets (score_probability DESC NULLS LAST, id DESC) WHERE program_primary;

CREATE OR REPLACE FUNCTION public.radar_refresh_programs()
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_changed integer := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_programs;
  CREATE TEMP TABLE tmp_programs ON COMMIT DROP AS
  WITH k AS (
    SELECT a.id,
           CASE WHEN a.company_id IS NULL THEN 'a:' || a.id::text
                WHEN a.drug_master_id IS NULL THEN a.company_id::text || ':a:' || a.id::text
                ELSE a.company_id::text || ':' || a.drug_master_id::text END AS program_key,
           CASE a.phase
             WHEN 'phase_4' THEN 9 WHEN 'phase_3' THEN 8 WHEN 'phase_2_3' THEN 7 WHEN 'phase_2' THEN 6
             WHEN 'phase_1_2' THEN 5 WHEN 'phase_1' THEN 4 WHEN 'early_phase_1' THEN 3 WHEN 'preclinical' THEN 2 ELSE 1 END AS phase_rank,
           COALESCE(a.trial_count, 0) AS trials,
           a.last_update_date
    FROM public.clinical_assets a
  )
  SELECT id,
         program_key,
         row_number() OVER (PARTITION BY program_key ORDER BY phase_rank DESC, trials DESC, last_update_date DESC NULLS LAST, id) = 1 AS is_primary,
         count(*) OVER (PARTITION BY program_key) AS n_assets,
         sum(trials) OVER (PARTITION BY program_key) AS n_trials
  FROM k;

  UPDATE public.clinical_assets a
     SET program_key = p.program_key,
         program_primary = p.is_primary,
         program_assets = p.n_assets,
         program_trials = p.n_trials
    FROM tmp_programs p
   WHERE a.id = p.id
     AND (a.program_key IS DISTINCT FROM p.program_key
       OR a.program_primary IS DISTINCT FROM p.is_primary
       OR a.program_assets IS DISTINCT FROM p.n_assets
       OR a.program_trials IS DISTINCT FROM p.n_trials);
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN jsonb_build_object('changed', v_changed);
END;
$$;

-- Percentiles over programs (primary rows), inherited by siblings.
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
           COALESCE(a.score_probability, a.licensing_intent_score / 100.0) AS p
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
           round(100 * percent_rank() OVER (PARTITION BY peer_key ORDER BY p))::smallint AS pct_peer,
           count(*) OVER (PARTITION BY peer_key) AS peer_n,
           round(100 * percent_rank() OVER (ORDER BY p))::smallint AS pct_universe,
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

-- Facets count programs (primary rows), matching the feed. Apply with the feed code.
CREATE OR REPLACE FUNCTION radar_facet_counts(filters jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(facet text, value text, count bigint)
LANGUAGE sql STABLE
SET statement_timeout = '5s'
AS $$
  WITH f AS (
    SELECT
      CASE WHEN jsonb_typeof(filters->'ta') = 'array' AND jsonb_array_length(filters->'ta') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'ta')) END AS ta,
      CASE WHEN jsonb_typeof(filters->'modality') = 'array' AND jsonb_array_length(filters->'modality') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'modality')) END AS modality,
      CASE WHEN jsonb_typeof(filters->'phase') = 'array' AND jsonb_array_length(filters->'phase') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'phase')) END AS phase,
      CASE WHEN jsonb_typeof(filters->'partnership') = 'array' AND jsonb_array_length(filters->'partnership') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'partnership')) END AS partnership,
      CASE WHEN jsonb_typeof(filters->'ownership') = 'array' AND jsonb_array_length(filters->'ownership') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'ownership')) END AS ownership,
      CASE WHEN jsonb_typeof(filters->'country') = 'array' AND jsonb_array_length(filters->'country') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'country')) END AS country,
      CASE WHEN jsonb_typeof(filters->'region') = 'array' AND jsonb_array_length(filters->'region') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'region')) END AS region,
      CASE WHEN jsonb_typeof(filters->'owner_type') = 'array' AND jsonb_array_length(filters->'owner_type') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'owner_type')) END AS owner_type,
      CASE WHEN jsonb_typeof(filters->'trial_status') = 'array' AND jsonb_array_length(filters->'trial_status') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'trial_status')) END AS trial_status,
      CASE WHEN jsonb_typeof(filters->'indication') = 'array' AND jsonb_array_length(filters->'indication') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'indication')) END AS indication,
      CASE WHEN jsonb_typeof(filters->'target') = 'array' AND jsonb_array_length(filters->'target') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'target')) END AS target,
      CASE WHEN jsonb_typeof(filters->'company') = 'array' AND jsonb_array_length(filters->'company') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'company')) END AS company,
      CASE WHEN jsonb_typeof(filters->'rights') = 'array' AND jsonb_array_length(filters->'rights') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'rights')) END AS rights,
      CASE WHEN jsonb_typeof(filters->'score_band') = 'array' AND jsonb_array_length(filters->'score_band') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'score_band')) END AS score_band,
      CASE WHEN jsonb_typeof(filters->'min_score') = 'number'
        THEN (filters->>'min_score')::numeric END AS min_score,
      CASE WHEN jsonb_typeof(filters->'top_pct') = 'number'
        THEN (filters->>'top_pct')::numeric END AS top_pct,
      NULLIF(btrim(filters->>'q'), '') AS q
  ),
  base_all AS MATERIALIZED (
    SELECT
      a.therapeutic_area,
      a.indication_category,
      a.modality,
      a.phase,
      a.target,
      a.company_name,
      a.partnership_status,
      a.ownership_status,
      a.originator_country,
      a.originator_region,
      a.trial_status,
      COALESCE(a.owner_type, 'unknown') AS owner_type,
      a.rights_available,
      radar_score_band(a.licensing_intent_score) AS score_band,
      (f.ownership IS NULL AND a.ownership_status IN ('comparator_or_background', 'marketed_other')) AS default_hidden_ownership,
      (f.phase IS NULL AND a.phase IN ('phase_4', 'not_applicable', 'unknown')) AS default_hidden_phase,
      (f.owner_type IS NULL AND COALESCE(a.owner_type, 'unknown') <> 'industry') AS default_hidden_owner_type
    FROM clinical_assets a
    CROSS JOIN f
    WHERE a.program_primary
      AND (f.ta IS NULL OR a.therapeutic_area = ANY(f.ta))
      AND (f.modality IS NULL OR a.modality = ANY(f.modality))
      AND (f.phase IS NULL OR a.phase = ANY(f.phase))
      AND (f.partnership IS NULL OR a.partnership_status = ANY(f.partnership))
      AND (f.ownership IS NULL OR a.ownership_status = ANY(f.ownership))
      AND (f.country IS NULL OR a.originator_country = ANY(f.country))
      AND (f.region IS NULL OR a.originator_region = ANY(f.region))
      AND (f.owner_type IS NULL OR COALESCE(a.owner_type, 'unknown') = ANY(f.owner_type))
      AND (f.trial_status IS NULL OR a.trial_status = ANY(f.trial_status))
      AND (f.indication IS NULL OR a.indication_category = ANY(f.indication))
      AND (f.target IS NULL OR a.target = ANY(f.target))
      AND (f.company IS NULL OR a.company_name = ANY(f.company))
      AND (f.rights IS NULL OR a.rights_available && f.rights)
      AND (f.score_band IS NULL OR radar_score_band(a.licensing_intent_score) = ANY(f.score_band))
      AND (f.min_score IS NULL OR a.licensing_intent_score >= f.min_score)
      AND (f.top_pct IS NULL OR a.score_pct_peer >= 100 - f.top_pct)
      AND (
        f.q IS NULL
        OR a.asset_name ILIKE '%' || f.q || '%'
        OR a.company_name ILIKE '%' || f.q || '%'
        OR a.target ILIKE '%' || f.q || '%'
        OR a.indication_specific ILIKE '%' || f.q || '%'
      )
  ),
  base AS MATERIALIZED (
    SELECT * FROM base_all WHERE NOT default_hidden_ownership AND NOT default_hidden_phase AND NOT default_hidden_owner_type
  )
  SELECT '_total', 'all', count(*) FROM base
  UNION ALL
  (SELECT 'region', originator_region, count(*) FROM base WHERE originator_region IS NOT NULL GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'country', originator_country, count(*) FROM base WHERE originator_country IS NOT NULL GROUP BY 2 ORDER BY 3 DESC LIMIT 60)
  UNION ALL
  (SELECT 'ta', therapeutic_area, count(*) FROM base WHERE therapeutic_area IS NOT NULL GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'indication', indication_category, count(*) FROM base WHERE indication_category IS NOT NULL GROUP BY 2 ORDER BY 3 DESC LIMIT 50)
  UNION ALL
  (SELECT 'modality', modality, count(*) FROM base WHERE modality IS NOT NULL GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'phase', phase, count(*) FROM base_all WHERE phase IS NOT NULL AND NOT default_hidden_ownership AND NOT default_hidden_owner_type GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'ownership', ownership_status, count(*) FROM base_all WHERE NOT default_hidden_phase AND NOT default_hidden_owner_type GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'target', target, count(*) FROM base WHERE target IS NOT NULL GROUP BY 2 ORDER BY 3 DESC LIMIT 30)
  UNION ALL
  (SELECT 'company', company_name, count(*) FROM base WHERE company_name IS NOT NULL GROUP BY 2 ORDER BY 3 DESC LIMIT 30)
  UNION ALL
  (SELECT 'partnership', partnership_status, count(*) FROM base WHERE partnership_status IS NOT NULL GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'owner_type', owner_type, count(*) FROM base_all WHERE NOT default_hidden_ownership AND NOT default_hidden_phase GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'rights', r, count(*) FROM base, unnest(COALESCE(rights_available, '{}'::text[])) AS r GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'score_band', score_band, count(*) FROM base WHERE score_band IS NOT NULL GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'trial_status', trial_status, count(*) FROM base WHERE trial_status IS NOT NULL GROUP BY 2 ORDER BY 3 DESC);
$$;

