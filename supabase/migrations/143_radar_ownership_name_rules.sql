-- 143_radar_ownership_name_rules.sql
--
-- Search & Evaluation: two more ownership rules for the 8,444 industry assets
-- still 'unknown' after migration 125 (4,823 no_arm_evidence, 3,621
-- originator_mismatch).
--
--   comparator_named    the asset row is literally named after a comparator
--                       ("Comparators: simvastatin and ezetimibe", "Placebo",
--                       "Standard of care") -> comparator_or_background,
--                       whatever drug_master says. 330 industry rows, 124 of
--                       them wrongly 'originator'.
--   code_prefix_match   a development-code asset (JDQ443, NB002, CP-742,033)
--                       whose code series already names >= 2 originator
--                       programs of the same company -> originator. A company
--                       does not give its own code prefix to somebody else's
--                       drug; drug_master's originator is the weaker signal
--                       here. 737 rows.
--
-- Same function, same precedence otherwise; lib/radar/ownership.ts mirrors it.
-- Apply after 142. Idempotent.

CREATE OR REPLACE FUNCTION public.radar_code_prefix(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_name ~ '^[A-Za-z]{2,6}[- ]?[0-9]{2,6}[A-Za-z]?$'
      THEN upper(regexp_replace(p_name, '^([A-Za-z]{2,6})[- ]?[0-9].*$', '\1'))
    WHEN p_name ~ '^[A-Za-z]{2,6}-[0-9]{2,4},[0-9]{3}$'
      THEN upper(regexp_replace(p_name, '^([A-Za-z]{2,6})-.*$', '\1'))
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.radar_is_comparator_named(p_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(p_name, '') ~* '^(comparators?\M|placebo\M|standard[- ]of[- ]care|soc\M|control\M|vehicle\M|sham\M|best supportive care|no intervention|usual care|background therapy)';
$$;

CREATE OR REPLACE FUNCTION public.radar_apply_ownership(
  p_limit integer DEFAULT 5000,
  p_recheck_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout = '240s'
AS $$
DECLARE
  v_scanned integer := 0;
  v_written integer := 0;
  v_by_status jsonb := '{}'::jsonb;
  v_by_rule jsonb := '{}'::jsonb;
  v_remaining bigint := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_ownership_cand;
  DROP TABLE IF EXISTS tmp_ownership_calc;
  DROP TABLE IF EXISTS tmp_prefix_orig;

  CREATE TEMP TABLE tmp_ownership_cand ON COMMIT DROP AS
  SELECT a.id, a.company_id, a.asset_name, COALESCE(a.asset_aliases, '{}'::text[]) AS aliases,
         COALESCE(a.nct_ids, '{}'::text[]) AS nct_ids, a.phase, a.drug_master_id,
         public.radar_code_prefix(a.asset_name) AS code_prefix,
         public.radar_is_comparator_named(a.asset_name) AS comparator_named
  FROM public.clinical_assets a
  WHERE a.ownership_checked_at IS NULL
     OR (a.last_enriched_at IS NOT NULL AND a.last_enriched_at > a.ownership_checked_at)
     OR (a.drug_resolved_at IS NOT NULL AND a.drug_resolved_at > a.ownership_checked_at)
     OR a.ownership_checked_at < now() - make_interval(days => GREATEST(COALESCE(p_recheck_days, 30), 1))
  ORDER BY a.ownership_checked_at NULLS FIRST, a.id
  LIMIT GREATEST(COALESCE(p_limit, 5000), 1);
  GET DIAGNOSTICS v_scanned = ROW_COUNT;

  -- Code series the company already owns: originator programs (by originator
  -- match or its own experimental arms) sharing the candidate's code prefix.
  CREATE TEMP TABLE tmp_prefix_orig ON COMMIT DROP AS
  SELECT o.company_id, public.radar_code_prefix(o.asset_name) AS code_prefix, count(*) AS n
  FROM public.clinical_assets o
  WHERE o.company_id IN (SELECT DISTINCT company_id FROM tmp_ownership_cand WHERE code_prefix IS NOT NULL)
    AND o.ownership_status = 'originator'
    AND o.ownership_evidence->>'rule' IN ('originator_match', 'sponsor_default', 'code_prefix_match', 'filing_disclosure')
    AND public.radar_code_prefix(o.asset_name) IS NOT NULL
  GROUP BY 1, 2;

  CREATE TEMP TABLE tmp_ownership_calc ON COMMIT DROP AS
  WITH cand AS (
    SELECT c.*, ARRAY(SELECT public.radar_name_key(x) FROM unnest(ARRAY[c.asset_name] || c.aliases) x WHERE x IS NOT NULL AND btrim(x) <> '') AS name_keys
    FROM tmp_ownership_cand c
  ),
  dm AS (
    SELECT c.id AS asset_id, d.id AS drug_master_id, d.originator_company_id, d.confidence AS originator_confidence, d.max_phase
    FROM cand c
    JOIN public.drug_master d ON d.id = c.drug_master_id
  ),
  owner_role AS (
    SELECT c.id AS asset_id,
           (array_agg(o.role ORDER BY CASE o.role WHEN 'licensee' THEN 0 WHEN 'co_developer' THEN 1 ELSE 2 END))[1] AS role
    FROM cand c
    JOIN public.drug_owners o ON o.drug_id = c.drug_master_id AND o.company_id = c.company_id
    WHERE o.role IN ('licensee', 'co_developer')
    GROUP BY c.id
  ),
  arms AS (
    SELECT c.id AS asset_id,
           count(*) AS matched,
           count(*) FILTER (WHERE ti.arm_role = 'experimental') AS experimental,
           count(*) FILTER (WHERE ti.arm_role IN ('active_comparator', 'placebo_comparator', 'sham', 'no_intervention', 'other')) AS comparator,
           count(*) FILTER (WHERE ti.arm_role = 'unknown') AS unknown_arms
    FROM cand c
    JOIN public.trial_interventions ti
      ON ti.nct_id = ANY(c.nct_ids)
     AND ti.company_id IS NOT DISTINCT FROM c.company_id
     AND (
       public.radar_name_key(ti.name) = ANY(c.name_keys)
       OR EXISTS (SELECT 1 FROM unnest(ti.other_names) o WHERE public.radar_name_key(o) = ANY(c.name_keys))
     )
    WHERE cardinality(c.nct_ids) > 0
    GROUP BY c.id
  ),
  prefix AS (
    -- other programs only: the candidate must not count itself
    SELECT c.id AS asset_id, p.code_prefix,
           p.n - CASE WHEN EXISTS (
             SELECT 1 FROM public.clinical_assets self
             WHERE self.id = c.id AND self.ownership_status = 'originator'
               AND self.ownership_evidence->>'rule' IN ('originator_match', 'sponsor_default', 'code_prefix_match', 'filing_disclosure')
           ) THEN 1 ELSE 0 END AS n
    FROM cand c
    JOIN tmp_prefix_orig p ON p.company_id = c.company_id AND p.code_prefix = c.code_prefix
  ),
  calc AS (
    SELECT
      c.id,
      c.comparator_named,
      dm.drug_master_id,
      dm.originator_company_id,
      dm.originator_confidence,
      dm.max_phase,
      r.role AS owner_role,
      COALESCE(a.matched, 0) AS matched,
      COALESCE(a.experimental, 0) AS experimental,
      COALESCE(a.comparator, 0) AS comparator,
      COALESCE(a.unknown_arms, 0) AS unknown_arms,
      px.code_prefix,
      COALESCE(px.n, 0) AS code_prefix_originators,
      (dm.originator_company_id IS NOT NULL AND COALESCE(dm.originator_confidence, 0) >= 70) AS trusted_originator,
      (c.phase = 'phase_4' OR dm.max_phase = 'approved') AS marketed
    FROM cand c
    LEFT JOIN dm ON dm.asset_id = c.id
    LEFT JOIN owner_role r ON r.asset_id = c.id
    LEFT JOIN arms a ON a.asset_id = c.id
    LEFT JOIN prefix px ON px.asset_id = c.id
  ),
  decided AS (
    SELECT
      calc.*,
      CASE
        WHEN comparator_named THEN 'comparator_named'
        WHEN trusted_originator AND originator_company_id = (SELECT company_id FROM tmp_ownership_cand t WHERE t.id = calc.id) THEN 'originator_match'
        WHEN owner_role IS NOT NULL THEN 'drug_owner_role'
        WHEN trusted_originator AND marketed THEN 'marketed_other'
        WHEN trusted_originator AND experimental = 0 THEN 'comparator'
        WHEN trusted_originator AND code_prefix_originators >= 2 THEN 'code_prefix_match'
        WHEN trusted_originator THEN 'originator_mismatch'
        WHEN matched > 0 AND experimental = 0 AND comparator > 0 THEN 'arm_comparator'
        WHEN experimental > 0 THEN 'sponsor_default'
        WHEN code_prefix_originators >= 2 THEN 'code_prefix_match'
        ELSE 'no_arm_evidence'
      END AS rule
    FROM calc
  )
  SELECT
    d.id,
    CASE d.rule
      WHEN 'comparator_named' THEN 'comparator_or_background'
      WHEN 'originator_match' THEN 'originator'
      WHEN 'drug_owner_role' THEN d.owner_role
      WHEN 'marketed_other' THEN 'marketed_other'
      WHEN 'comparator' THEN 'comparator_or_background'
      WHEN 'code_prefix_match' THEN 'originator'
      WHEN 'originator_mismatch' THEN 'unknown'
      WHEN 'arm_comparator' THEN 'comparator_or_background'
      WHEN 'sponsor_default' THEN 'originator'
      ELSE 'unknown'
    END AS status,
    jsonb_strip_nulls(jsonb_build_object(
      'rule', d.rule,
      'drug_master_id', d.drug_master_id,
      'originator_company_id', d.originator_company_id,
      'originator_confidence', d.originator_confidence,
      'max_phase', d.max_phase,
      'owner_role', d.owner_role,
      'arms', jsonb_build_object('experimental', d.experimental, 'comparator', d.comparator, 'unknown', d.unknown_arms),
      'matched_interventions', d.matched,
      'code_prefix', CASE WHEN d.rule = 'code_prefix_match' THEN d.code_prefix END,
      'code_prefix_originators', CASE WHEN d.rule = 'code_prefix_match' THEN d.code_prefix_originators END
    )) AS evidence
  FROM decided d;

  UPDATE public.clinical_assets ca
  SET ownership_status = x.status,
      ownership_evidence = x.evidence,
      ownership_checked_at = now()
  FROM tmp_ownership_calc x
  WHERE ca.id = x.id;
  GET DIAGNOSTICS v_written = ROW_COUNT;

  SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb) INTO v_by_status
  FROM (SELECT status, count(*) AS n FROM tmp_ownership_calc GROUP BY status) q;
  SELECT COALESCE(jsonb_object_agg(rule, n), '{}'::jsonb) INTO v_by_rule
  FROM (SELECT evidence->>'rule' AS rule, count(*) AS n FROM tmp_ownership_calc GROUP BY 1) q;
  SELECT count(*) INTO v_remaining FROM public.clinical_assets WHERE ownership_checked_at IS NULL;

  RETURN jsonb_build_object(
    'scanned', v_scanned,
    'written', v_written,
    'by_status', v_by_status,
    'by_rule', v_by_rule,
    'remaining_unchecked', v_remaining
  );
END;
$$;

COMMENT ON FUNCTION public.radar_apply_ownership(integer, integer) IS
  'Sets clinical_assets.ownership_status/evidence for up to p_limit stale rows from drug_master originator, drug_owners roles, trial_interventions arm roles, comparator-style names and the company''s own code series (migration 143). Rules mirrored in lib/radar/ownership.ts.';

REVOKE ALL ON FUNCTION public.radar_code_prefix(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.radar_is_comparator_named(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.radar_code_prefix(text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_is_comparator_named(text) TO service_role, authenticated;

-- Re-evaluate the rows the new rules can move: everything still unknown and
-- every comparator-named row. The partnership-refresh cron applies them in
-- 5,000-row batches; the deploying migration runs the first two itself.
UPDATE public.clinical_assets
SET ownership_checked_at = NULL
WHERE owner_type = 'industry'
  AND (ownership_status = 'unknown' OR public.radar_is_comparator_named(asset_name));
