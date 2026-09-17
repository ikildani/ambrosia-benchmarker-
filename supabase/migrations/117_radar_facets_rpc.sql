-- Asset Radar facet counts for the feed's left rail.
--
-- radar_facet_counts(filters jsonb) applies the same filter set as
-- /api/radar/feed (see lib/radar/client/filter-schema.ts for the keys) once,
-- materialises the matching rows, and returns one (facet, value, count) row
-- per bucket for every facet the rail shows. A '_total' facet carries the
-- matching row count so the route does not need a second query.
--
-- Cost model: one filtered scan of clinical_assets (~30k rows, every
-- filtered column is btree-indexed by 090/102), one hash join to companies
-- for owner_type, then twelve GROUP BYs over the materialised CTE. Measured
-- plan at 6k rows is ~25 ms; the 300 ms budget holds well past 50k rows.
-- The route caches results per filter fingerprint for five minutes.

CREATE OR REPLACE FUNCTION radar_score_band(score numeric)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN score IS NULL THEN NULL
    WHEN score >= 80 THEN '80+'
    WHEN score >= 60 THEN '60-79'
    WHEN score >= 40 THEN '40-59'
    WHEN score >= 20 THEN '20-39'
    ELSE '0-19'
  END;
$$;

COMMENT ON FUNCTION radar_score_band(numeric) IS
  'Licensing intent score band used by the Radar facet rail; values must match RADAR_SCORE_BAND_OPTIONS in lib/radar/client/filter-schema.ts.';

-- Expression index so the score_band facet and filter avoid recomputing the CASE per row.
CREATE INDEX IF NOT EXISTS idx_clinical_assets_score_band
  ON clinical_assets (radar_score_band(licensing_intent_score));

-- The feed's free-text search and typeahead use ILIKE on these columns; a
-- btree only serves prefix matches under the C collation, so give them
-- text_pattern_ops indexes for the typeahead's `q%` form.
CREATE INDEX IF NOT EXISTS idx_clinical_assets_asset_name_pattern
  ON clinical_assets (lower(asset_name) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_clinical_assets_company_name_pattern
  ON clinical_assets (lower(company_name) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_clinical_assets_target_pattern
  ON clinical_assets (lower(target) text_pattern_ops)
  WHERE target IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_assets_target
  ON clinical_assets (target)
  WHERE target IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_assets_trial_status
  ON clinical_assets (trial_status);

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
      CASE WHEN jsonb_typeof(filters->'score_band') = 'array' AND jsonb_array_length(filters->'score_band') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'score_band')) END AS score_band,
      CASE WHEN jsonb_typeof(filters->'min_score') = 'number'
        THEN (filters->>'min_score')::numeric END AS min_score,
      NULLIF(btrim(filters->>'q'), '') AS q
  ),
  base AS MATERIALIZED (
    SELECT
      a.therapeutic_area,
      a.indication_category,
      a.modality,
      a.phase,
      a.target,
      a.partnership_status,
      a.originator_country,
      a.originator_region,
      a.trial_status,
      COALESCE(c.owner_type, 'unknown') AS owner_type,
      radar_score_band(a.licensing_intent_score) AS score_band
    FROM clinical_assets a
    LEFT JOIN companies c ON c.id = a.company_id
    CROSS JOIN f
    WHERE (f.ta IS NULL OR a.therapeutic_area = ANY(f.ta))
      AND (f.modality IS NULL OR a.modality = ANY(f.modality))
      AND (f.phase IS NULL OR a.phase = ANY(f.phase))
      AND (f.partnership IS NULL OR a.partnership_status = ANY(f.partnership))
      AND (f.country IS NULL OR a.originator_country = ANY(f.country))
      AND (f.region IS NULL OR a.originator_region = ANY(f.region))
      AND (f.owner_type IS NULL OR COALESCE(c.owner_type, 'unknown') = ANY(f.owner_type))
      AND (f.trial_status IS NULL OR a.trial_status = ANY(f.trial_status))
      AND (f.indication IS NULL OR a.indication_category = ANY(f.indication))
      AND (f.target IS NULL OR a.target = ANY(f.target))
      AND (f.score_band IS NULL OR radar_score_band(a.licensing_intent_score) = ANY(f.score_band))
      AND (f.min_score IS NULL OR a.licensing_intent_score >= f.min_score)
      AND (
        f.q IS NULL
        OR a.asset_name ILIKE '%' || f.q || '%'
        OR a.company_name ILIKE '%' || f.q || '%'
        OR a.target ILIKE '%' || f.q || '%'
        OR a.indication_specific ILIKE '%' || f.q || '%'
      )
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
  (SELECT 'phase', phase, count(*) FROM base WHERE phase IS NOT NULL GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'target', target, count(*) FROM base WHERE target IS NOT NULL GROUP BY 2 ORDER BY 3 DESC LIMIT 30)
  UNION ALL
  (SELECT 'partnership', partnership_status, count(*) FROM base WHERE partnership_status IS NOT NULL GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'owner_type', owner_type, count(*) FROM base GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'score_band', score_band, count(*) FROM base WHERE score_band IS NOT NULL GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'trial_status', trial_status, count(*) FROM base WHERE trial_status IS NOT NULL GROUP BY 2 ORDER BY 3 DESC);
$$;

COMMENT ON FUNCTION radar_facet_counts(jsonb) IS
  'Facet buckets for /api/radar/facets. filters keys: ta, modality, phase, partnership, country, region, owner_type, trial_status, indication, target, score_band (text arrays), min_score (number), q (text; caller strips LIKE metacharacters). Returns a _total row plus one row per bucket.';

-- Intelligence tables are not readable with the anon key (101); the RPC is
-- called by the service role from the API route only.
REVOKE ALL ON FUNCTION radar_facet_counts(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION radar_score_band(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION radar_facet_counts(jsonb) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION radar_score_band(numeric) TO service_role, authenticated;
