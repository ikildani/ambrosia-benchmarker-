-- 181: one row per program in Search & Evaluation.
--
-- Why (Nov 3 2026): trial arms and dose groups became their own assets ("CM336_group 5", "Cohort 7 of
-- M701"). In the evaluation pool 45,974 rows with a drug held only 34,726 distinct company + drug pairs,
-- so a buy-side list showed the same program several times and the score counted it several times.
-- Rows of the same company and drug_master other than the primary get ownership_status
-- 'duplicate_program' (evidence: primary_asset_id) and leave the pool; the primary takes the union of
-- their indications. Rule-based ownership decisions ('generic_drug_fda' from migration 179 and
-- 'duplicate_program') are kept by a trigger when radar_apply_ownership() re-evaluates the row.

ALTER TABLE public.clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_ownership_status_check;
ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_ownership_status_check CHECK (ownership_status = ANY (ARRAY[
  'originator', 'licensee', 'co_developer', 'comparator_or_background', 'marketed_other', 'unknown', 'duplicate_program']));

CREATE OR REPLACE FUNCTION public.clinical_assets_keep_rule_ownership()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.ownership_evidence->>'rule' IN ('generic_drug_fda', 'duplicate_program')
     AND NEW.ownership_status IS DISTINCT FROM OLD.ownership_status
     AND coalesce(NEW.ownership_evidence->>'rule', '') NOT IN ('generic_drug_fda', 'duplicate_program')
     AND coalesce(current_setting('radar.ownership_override', true), '') <> 'on' THEN
    NEW.ownership_status := OLD.ownership_status;
    NEW.ownership_evidence := OLD.ownership_evidence;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_keep_rule_ownership ON public.clinical_assets;
CREATE TRIGGER trg_keep_rule_ownership BEFORE UPDATE OF ownership_status ON public.clinical_assets
  FOR EACH ROW EXECUTE FUNCTION public.clinical_assets_keep_rule_ownership();

CREATE OR REPLACE VIEW public.radar_thesis_eligible_assets AS
 SELECT a.id, a.company_id, a.company_name, a.asset_name, a.therapeutic_area, a.modality, a.phase,
    a.indication_category, a.indication_specific, a.indications_all, a.regulatory_designations,
    a.partnership_status, a.partner_company_id, a.partner_company_name, a.confidence_score,
    a.licensing_intent_score, a.updated_at, c.owner_type
   FROM clinical_assets a JOIN companies c ON c.id = a.company_id
  WHERE (c.owner_type = 'industry' OR (COALESCE(c.owner_type, 'unknown') = 'unknown' AND upper(COALESCE(c.lead_sponsor_class, '')) = 'INDUSTRY'))
    AND a.partnership_status = ANY (ARRAY['unpartnered', 'partially_partnered'])
    AND a.ownership_status <> ALL (ARRAY['comparator_or_background', 'marketed_other', 'duplicate_program'])
    AND COALESCE(a.confidence_score, 0) >= 20
    AND (a.phase = ANY (ARRAY['preclinical', 'early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3', 'early_phase1', 'phase1', 'phase1_phase2', 'phase2', 'phase2_phase3', 'phase3'])
         OR (a.phase = ANY (ARRAY['phase_4', 'phase4']) AND a.partnership_status = 'unpartnered'));

-- Primary row per company + drug: most advanced phase, then a clean name (no arm / dose / cohort words),
-- then most trials, then the shortest name.
CREATE OR REPLACE FUNCTION public.radar_duplicate_program_rows()
RETURNS TABLE (asset_id uuid, primary_asset_id uuid, company_id uuid, drug_master_id uuid, asset_name text, primary_name text)
LANGUAGE sql STABLE SET statement_timeout TO '120s' AS $$
  WITH p AS (
    SELECT a.id, a.company_id, a.drug_master_id, a.asset_name,
      row_number() OVER (PARTITION BY a.company_id, a.drug_master_id ORDER BY
        CASE a.phase WHEN 'phase_4' THEN 7 WHEN 'phase_3' THEN 6 WHEN 'phase_2_3' THEN 5 WHEN 'phase_2' THEN 4 WHEN 'phase_1_2' THEN 3
                     WHEN 'phase_1' THEN 2 WHEN 'early_phase_1' THEN 1 ELSE 0 END DESC,
        (a.asset_name ~* '(\mgroup\M|\mcohort\M|\marm\M|\mdose\M|\mpart [a-z0-9]\M|\mmg\M|mg/kg|\mlevel \d|regimen|placebo|\+)') ASC,
        coalesce(a.trial_count, 0) DESC, length(a.asset_name) ASC, a.id) rn
    FROM clinical_assets a
    JOIN radar_thesis_eligible_assets e ON e.id = a.id
    WHERE a.drug_master_id IS NOT NULL AND a.company_id IS NOT NULL)
  SELECT d.id, pr.id, d.company_id, d.drug_master_id, d.asset_name, pr.asset_name
  FROM p d JOIN p pr ON pr.company_id = d.company_id AND pr.drug_master_id = d.drug_master_id AND pr.rn = 1
  WHERE d.rn > 1
$$;
REVOKE ALL ON FUNCTION public.radar_duplicate_program_rows() FROM PUBLIC, anon, authenticated;