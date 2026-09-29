-- 154: "Rights available" as a feed filter and facet.
--
-- clinical_assets.territory_rights_available said 'global' for every asset
-- with no mapped deal territory, including 22,450 partially partnered assets
-- whose split is unknown (a trial collaborator, not a deal). A filter on it
-- would have promised rights nobody has confirmed. rights_available is the
-- honest version, maintained by trigger:
--
--   partnered                          -> {}
--   unpartnered                        -> {global, us, eu, japan, china, row}
--   partially partnered, known split   -> the regions still available
--   partially partnered, unknown split -> {unconfirmed}
--
-- Filter semantics: rights=global means worldwide rights with no partner
-- found; rights=china means China is available (unpartnered, or a deal that
-- excluded China); unconfirmed is opt-in.
--
-- Backfill: a self-retiring pg_cron job (8,000 rows per minute), so the
-- ALTER stays instant and no long statement holds locks.
-- Apply after 153. Idempotent.

ALTER TABLE public.clinical_assets ADD COLUMN IF NOT EXISTS rights_available text[];

CREATE OR REPLACE FUNCTION radar_rights_available(p_status text, p_territories text[])
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status = 'partnered' THEN '{}'::text[]
    WHEN p_status = 'unpartnered' OR p_status IS NULL THEN ARRAY['global','us','eu','japan','china','row']
    WHEN p_status = 'partially_partnered'
         AND p_territories IS NOT NULL AND cardinality(p_territories) > 0
         AND NOT ('global' = ANY(p_territories))
      THEN ARRAY(SELECT t FROM unnest(p_territories) t WHERE t IN ('us','eu','japan','china','row'))
    ELSE ARRAY['unconfirmed']
  END;
$$;

CREATE OR REPLACE FUNCTION trg_clinical_assets_rights_available()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.rights_available := radar_rights_available(NEW.partnership_status, NEW.territory_rights_available);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinical_assets_rights_available ON public.clinical_assets;
CREATE TRIGGER clinical_assets_rights_available
  BEFORE INSERT OR UPDATE OF partnership_status, territory_rights_available ON public.clinical_assets
  FOR EACH ROW EXECUTE FUNCTION trg_clinical_assets_rights_available();

CREATE INDEX IF NOT EXISTS idx_clinical_assets_rights_available ON public.clinical_assets USING gin (rights_available);

-- Backfill in batches; the job unschedules itself when nothing is left.
CREATE OR REPLACE FUNCTION radar_rights_backfill_batch()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE n integer;
BEGIN
  WITH todo AS (
    SELECT id FROM public.clinical_assets WHERE rights_available IS NULL LIMIT 8000
  )
  UPDATE public.clinical_assets a
     SET rights_available = radar_rights_available(a.partnership_status, a.territory_rights_available)
    FROM todo WHERE a.id = todo.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    PERFORM cron.unschedule('radar_rights_backfill');
  END IF;
  RETURN n;
END;
$$;

SELECT cron.schedule('radar_rights_backfill', '* * * * *', 'SELECT radar_rights_backfill_batch()')
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'radar_rights_backfill');

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
      (f.phase IS NULL AND a.phase = 'phase_4') AS default_hidden_phase,
      (f.owner_type IS NULL AND COALESCE(a.owner_type, 'unknown') <> 'industry') AS default_hidden_owner_type
    FROM clinical_assets a
    CROSS JOIN f
    WHERE (f.ta IS NULL OR a.therapeutic_area = ANY(f.ta))
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

COMMENT ON FUNCTION radar_facet_counts(jsonb) IS
  'Facet buckets for /api/radar/facets. filters keys: ta, modality, phase, partnership, ownership, country, region, owner_type, trial_status, indication, target, company, rights (text arrays), score_band, min_score (number), q (text). Defaults: no ownership list hides comparator_or_background + marketed_other; no phase list hides phase_4; the phase and ownership buckets are counted before those defaults. company bucket = top 30 company_name values; rights bucket = rights_available atoms (migration 154).';

-- Default owner view: with no owner_type filter the feed and facets show
-- industry programs only. Academic, hospital and government sponsors are
-- mostly investigator-initiated studies of marketed drugs; they stay one
-- click away (the owner_type bucket is counted before the default).
-- Mandates can require rights in a territory (applied with the rest of 154).
ALTER TABLE public.radar_user_mandates ADD COLUMN IF NOT EXISTS rights_available text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.radar_user_mandates.rights_available IS 'Territories the buyer needs available (global, us, eu, japan, china, row, unconfirmed); an asset matches when its rights_available overlaps. Empty = any (migration 154).';

-- Mandates remember which owner types to include; empty = industry only (the feed default).
ALTER TABLE public.radar_user_mandates ADD COLUMN IF NOT EXISTS owner_types text[] NOT NULL DEFAULT '{}';
