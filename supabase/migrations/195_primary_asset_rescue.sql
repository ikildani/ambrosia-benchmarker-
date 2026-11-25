-- 195: rescue the sponsor's own coded drug when the arm-role rule left a trial with no primary asset.
--
-- computeIsPrimaryAsset (lib/ingestion/ctgov-sweep.ts) only accepts interventions whose
-- strongest arm role is "experimental" and that never sit in a comparator arm. Sponsors label
-- their own drug "active comparator" in dose-ranging and crossover designs and add the drug to the
-- placebo arm's open-label extension, so 2,636 industry Phase 1-3 trials (Nov 23 2026) had no
-- primary intervention at all and their programs never reached clinical_assets (OpSCF, CTP-543,
-- ATI-501, HSK3486, PTI-808, ...).
--
-- Rule (mirrored by rescuePrimaryInterventions in ctgov-sweep.ts for new sweeps):
--   industry-owned trial, informative phase, no primary intervention;
--   candidate = drug-class intervention, not placebo/vehicle/SOC/comparator-named,
--               whose name carries a development code (radar_has_dev_code);
--   at most 3 candidates in the trial (dose rows of one code are fine; a 10-drug platform is not);
--   none of its identifiers names a program of ANOTHER corporate family (a backbone such as
--   "Pembrolizumab (MK-3475)" in someone else's trial stays non-primary).
-- Measured Nov 23 2026: 2,201 interventions in 2,636 trials, ~700 identifiers no program carries;
-- hand check of 30: 29 real sponsor programs (one typo'd code).
--
-- Rescued rows get primary_basis = 'dev_code_rescue' (revert: radar_rescue_primary_interventions_revert())
-- and their company_trials.updated_at is bumped so radar_companies_to_index puts the company at
-- the front of the asset-universe queue.

ALTER TABLE public.trial_interventions ADD COLUMN IF NOT EXISTS primary_basis text;

COMMENT ON COLUMN public.trial_interventions.primary_basis IS
  'Why is_primary_asset is true when not by the arm-role rule: dev_code_rescue (migration 195). NULL = arm-role rule.';

CREATE OR REPLACE FUNCTION public.radar_rescue_primary_interventions(p_limit integer DEFAULT 5000, p_dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '600s'
AS $function$
DECLARE
  v_ivs integer := 0;
  v_trials integer := 0;
  v_sample jsonb;
BEGIN
  DROP TABLE IF EXISTS tmp_rescue_owned;
  CREATE TEMP TABLE tmp_rescue_owned ON COMMIT DROP AS
  SELECT split_part(program_key, ':t:', 2) AS ident, array_agg(DISTINCT split_part(program_key, ':', 1)) AS fams
  FROM public.clinical_assets
  WHERE program_primary AND program_key LIKE '%:t:%'
  GROUP BY 1;
  CREATE INDEX ON tmp_rescue_owned (ident);

  DROP TABLE IF EXISTS tmp_rescue;
  CREATE TEMP TABLE tmp_rescue ON COMMIT DROP AS
  WITH t AS (
    SELECT ct.id AS trial_row, ct.company_id, ct.nct_id, coalesce(c.family_id, c.id)::text AS fam
    FROM public.company_trials ct
    JOIN public.companies c ON c.id = ct.company_id
    WHERE c.owner_type = 'industry'
      AND ct.phase IN ('early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3')
      AND NOT EXISTS (SELECT 1 FROM public.trial_interventions p
                      WHERE p.nct_id = ct.nct_id AND p.company_id = ct.company_id AND p.is_primary_asset)
  ), cand AS (
    SELECT t.trial_row, t.fam, ti.id, ti.nct_id, ti.name,
           count(*) OVER (PARTITION BY ti.nct_id, ti.company_id) AS n
    FROM t
    JOIN public.trial_interventions ti ON ti.nct_id = t.nct_id AND ti.company_id = t.company_id
    WHERE upper(coalesce(ti.intervention_type, '')) IN ('DRUG', 'BIOLOGICAL', 'GENETIC', 'COMBINATION_PRODUCT')
      AND ti.name !~* '(placebo|vehicle|saline|sham|standard of care|best supportive care|usual care|matching|dummy)'
      AND NOT public.radar_is_comparator_named(ti.name)
      AND public.radar_has_dev_code(ti.name)
  )
  SELECT c.trial_row, c.id, c.nct_id, c.name
  FROM cand c
  WHERE c.n <= 3
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(public.radar_asset_identifiers(c.name)) AS tok(ident)
      JOIN tmp_rescue_owned o ON o.ident = tok.ident
      WHERE cardinality(array_remove(o.fams, c.fam)) > 0
    )
  LIMIT greatest(coalesce(p_limit, 5000), 1);

  SELECT count(*), count(DISTINCT trial_row) INTO v_ivs, v_trials FROM tmp_rescue;
  SELECT coalesce(jsonb_agg(jsonb_build_object('nct_id', nct_id, 'name', name)), '[]'::jsonb)
    INTO v_sample FROM (SELECT nct_id, name FROM tmp_rescue ORDER BY md5(id::text) LIMIT 20) s;

  IF NOT coalesce(p_dry_run, true) THEN
    UPDATE public.trial_interventions ti
       SET is_primary_asset = true, primary_basis = 'dev_code_rescue', updated_at = now()
      FROM tmp_rescue r
     WHERE ti.id = r.id;
    UPDATE public.company_trials ct
       SET updated_at = now()
     WHERE ct.id IN (SELECT DISTINCT trial_row FROM tmp_rescue);
  END IF;

  RETURN jsonb_build_object('dry_run', coalesce(p_dry_run, true), 'interventions', v_ivs, 'trials', v_trials, 'sample', v_sample);
END;
$function$;

COMMENT ON FUNCTION public.radar_rescue_primary_interventions(integer, boolean) IS
  'Marks the sponsor''s own coded drug primary in industry trials the arm-role rule left without one (migration 195). Dry run by default.';

CREATE OR REPLACE FUNCTION public.radar_rescue_primary_interventions_revert()
 RETURNS integer
 LANGUAGE sql
AS $function$
  WITH r AS (
    UPDATE public.trial_interventions
       SET is_primary_asset = false, primary_basis = NULL, updated_at = now()
     WHERE primary_basis = 'dev_code_rescue'
    RETURNING 1
  )
  SELECT count(*)::integer FROM r;
$function$;

REVOKE ALL ON FUNCTION public.radar_rescue_primary_interventions(integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.radar_rescue_primary_interventions_revert() FROM PUBLIC, anon, authenticated;
