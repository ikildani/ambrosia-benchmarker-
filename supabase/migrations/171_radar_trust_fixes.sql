-- 171: Search & Evaluation trust fixes (Oct 29 2026). Every changed row is logged to
-- radar_trust_fix_log with its old values first, so each step is reversible.
--
-- 1. Partnership: 'partnered' requires hard evidence. A deal, a press release, or a partner named in
--    the company's own SEC filing dated within 2 years counts. A partner named only on the company's
--    web page, or in a filing older than 2 years, reads as partially partnered. Partner names the page
--    parser mangled are cleaned. Rows with deal evidence but a stale basis label are relabeled.
-- 2. Scores: programs the company does not own (marketed_other, comparator_or_background) are never
--    scored, but ~15k kept scores from older models. They are cleared, and a trigger clears them
--    whenever a program becomes non-owned.
-- 3. Trial status: an asset whose open trials were all last updated over 2 years ago is 'unverified',
--    not 'active' (ClinicalTrials.gov's "Unknown status" convention; CT.gov flips such studies without
--    changing their last-update date, so the sweep never sees it).
-- 4. Indexer queue: companies whose trials changed since their last indexing go first.

CREATE TABLE IF NOT EXISTS public.radar_trust_fix_log (
  id bigserial PRIMARY KEY,
  asset_id uuid,
  company_id uuid,
  step text NOT NULL,
  old_values jsonb NOT NULL,
  new_values jsonb NOT NULL,
  fixed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.radar_trust_fix_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.radar_trust_fix_log FROM anon, authenticated;

-- ── 1. Partnership ────────────────────────────────────────────────────────
WITH t AS (
  SELECT id, partnership_status, partner_company_name, partnership_basis FROM clinical_assets
  WHERE partnership_status = 'partnered'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(partnership_evidence, '[]'::jsonb)) e WHERE e->>'type' IN ('deal', 'press_release'))
    AND (partnership_basis = 'pipeline_page'
      OR (partnership_basis = 'filing' AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(coalesce(partnership_evidence, '[]'::jsonb)) e
            WHERE e->>'type' = 'filing' AND (e->>'date')::date >= current_date - 730))))
, logged AS (
  INSERT INTO radar_trust_fix_log (asset_id, step, old_values, new_values)
  SELECT id, 'partnership_soft_evidence',
         jsonb_build_object('partnership_status', partnership_status, 'partner_company_name', partner_company_name),
         jsonb_build_object('partnership_status', 'partially_partnered')
  FROM t RETURNING asset_id)
UPDATE clinical_assets a SET partnership_status = 'partially_partnered' FROM logged WHERE a.id = logged.asset_id;

WITH t AS (
  SELECT id, partner_company_name,
         nullif(regexp_replace(partner_company_name, '(\s+(preclinical|discovery|clinical|phase|ind|research|platform|programs?|pipeline|lead|candidate))+$', '', 'i'), '') AS cleaned
  FROM clinical_assets WHERE partnership_basis = 'pipeline_page' AND partner_company_name IS NOT NULL)
, fixed AS (
  SELECT id, partner_company_name, CASE WHEN length(cleaned) < 4 OR (cleaned !~ '\s' AND length(cleaned) < 5) THEN NULL ELSE cleaned END AS new_name FROM t)
, logged AS (
  INSERT INTO radar_trust_fix_log (asset_id, step, old_values, new_values)
  SELECT id, 'partner_name_cleaned', jsonb_build_object('partner_company_name', partner_company_name), jsonb_build_object('partner_company_name', new_name)
  FROM fixed WHERE new_name IS DISTINCT FROM partner_company_name RETURNING asset_id, new_values)
UPDATE clinical_assets a SET partner_company_name = logged.new_values->>'partner_company_name' FROM logged WHERE a.id = logged.asset_id;

WITH t AS (
  SELECT id, partnership_basis FROM clinical_assets
  WHERE partnership_status IN ('partnered', 'partially_partnered') AND partnership_basis IN ('no_evidence', 'trial_collaborator')
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(partnership_evidence, '[]'::jsonb)) e WHERE e->>'type' = 'deal'))
, logged AS (
  INSERT INTO radar_trust_fix_log (asset_id, step, old_values, new_values)
  SELECT id, 'partnership_basis_relabel', jsonb_build_object('partnership_basis', partnership_basis), jsonb_build_object('partnership_basis', 'deal_confirmed')
  FROM t RETURNING asset_id)
UPDATE clinical_assets a SET partnership_basis = 'deal_confirmed' FROM logged WHERE a.id = logged.asset_id;

-- The QA check counts a recent SEC filing that names the partner as hard evidence, like a deal.
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.radar_qa_universe_stats'::regproc);
  IF position($q$e->>'type' IN ('deal', 'press_release')))$q$ IN d) > 0 THEN
    d := replace(d, $q$e->>'type' IN ('deal', 'press_release')))$q$,
      $q$e->>'type' IN ('deal', 'press_release') OR (e->>'type' = 'filing' AND (e->>'date')::date >= current_date - 730)))$q$);
    EXECUTE d;
  END IF;
END
$do$;

-- ── 2. Scores on programs the company does not own ────────────────────────
CREATE OR REPLACE FUNCTION public.radar_clear_score_when_not_owned()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.ownership_status IN ('marketed_other', 'comparator_or_background')
     AND (NEW.licensing_intent_score IS NOT NULL OR NEW.score_probability IS NOT NULL) THEN
    NEW.licensing_intent_score := NULL;
    NEW.score_probability := NULL;
    NEW.score_confidence := NULL;
    NEW.score_interval := NULL;
    NEW.score_top_drivers := '[]'::jsonb; -- NOT NULL column
    NEW.score_pct_peer := NULL;
    NEW.score_pct_universe := NULL;
    NEW.score_model_version := NULL;
    NEW.last_scored_at := NULL;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_radar_clear_score_when_not_owned ON public.clinical_assets;
CREATE TRIGGER trg_radar_clear_score_when_not_owned
  BEFORE INSERT OR UPDATE OF ownership_status, licensing_intent_score, score_probability ON public.clinical_assets
  FOR EACH ROW EXECUTE FUNCTION public.radar_clear_score_when_not_owned();

-- Backfill (production: run in 5k-row batches; the statement is idempotent).
WITH t AS (
  SELECT id, licensing_intent_score, score_probability, score_model_version FROM clinical_assets
  WHERE ownership_status IN ('marketed_other', 'comparator_or_background')
    AND (licensing_intent_score IS NOT NULL OR score_probability IS NOT NULL)
  LIMIT 5000)
, logged AS (
  INSERT INTO radar_trust_fix_log (asset_id, step, old_values, new_values)
  SELECT id, 'score_cleared_not_owned',
         jsonb_build_object('licensing_intent_score', licensing_intent_score, 'score_probability', score_probability, 'score_model_version', score_model_version),
         '{}'::jsonb
  FROM t RETURNING asset_id)
UPDATE clinical_assets a SET ownership_status = a.ownership_status FROM logged WHERE a.id = logged.asset_id;

-- ── 3. Trial status: unverified after 2 years without an update ───────────
WITH t AS (
  SELECT id FROM clinical_assets WHERE trial_status = 'active' AND last_update_date < current_date - 730)
, logged AS (
  INSERT INTO radar_trust_fix_log (asset_id, step, old_values, new_values)
  SELECT id, 'trial_status_unverified', '{"trial_status":"active"}'::jsonb, '{"trial_status":"unverified"}'::jsonb
  FROM t RETURNING asset_id)
UPDATE clinical_assets a SET trial_status = 'unverified' FROM logged WHERE a.id = logged.asset_id;

-- ── 4. Indexer queue: changed trials first ────────────────────────────────
CREATE OR REPLACE FUNCTION public.radar_companies_to_index(p_limit integer DEFAULT 400, p_company_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, name text, hq_country text, hq_region text, headquarters_country text, headquarters_region text, assets_indexed_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET statement_timeout TO '60s'
AS $function$
  SELECT c.id, c.name, c.hq_country, c.hq_region, c.headquarters_country, c.headquarters_region, c.assets_indexed_at
  FROM companies c
  WHERE COALESCE(c.owner_type, 'unknown') <> 'cro'
    AND EXISTS (SELECT 1 FROM company_trials t WHERE t.company_id = c.id AND t.intervention_name IS NOT NULL)
    AND (p_company_ids IS NULL OR c.id = ANY(p_company_ids))
  ORDER BY (c.assets_indexed_at IS NULL) DESC,
           EXISTS (SELECT 1 FROM company_trials t2 WHERE t2.company_id = c.id AND t2.updated_at > COALESCE(c.assets_indexed_at, 'epoch')) DESC,
           c.assets_indexed_at ASC NULLS FIRST, c.id ASC
  LIMIT GREATEST(COALESCE(p_limit, 400), 1);
$function$;

-- Production ops note (Oct 29 2026): the step-2 backfill above clears 5k rows per run. The remaining
-- ~48k rows were cleared by a self-retiring pg_cron job, 'radar_trust_score_clear', calling
-- public.radar_trust_score_clear_step() every minute; it unschedules itself when a run clears 0 rows.
