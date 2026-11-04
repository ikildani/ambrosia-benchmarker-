-- 183: website text that a pipeline-page crawl stored as an asset is not a program.
--
-- Why (Nov 4 2026): of 185 code-less assets created from company pipeline pages, about 80 were page
-- furniture ("Connect on LinkedIn", "Copyright© 2026"), stage labels ("Pre-IND Stage", "Target
-- validation"), campus names or news lines. The extractor now rejects these
-- (isPlaceholderProgramName, lib/ingestion/preclinical-pipeline.ts); existing rows get
-- ownership_status 'not_a_program' (rule 'not_a_program'), which the pool view excludes and the
-- migration 181 trigger keeps.

ALTER TABLE public.clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_ownership_status_check;
ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_ownership_status_check CHECK (ownership_status = ANY (ARRAY[
  'originator', 'licensee', 'co_developer', 'comparator_or_background', 'marketed_other', 'unknown', 'duplicate_program', 'not_a_program']));

CREATE OR REPLACE VIEW public.radar_thesis_eligible_assets AS
 SELECT a.id, a.company_id, a.company_name, a.asset_name, a.therapeutic_area, a.modality, a.phase,
    a.indication_category, a.indication_specific, a.indications_all, a.regulatory_designations,
    a.partnership_status, a.partner_company_id, a.partner_company_name, a.confidence_score,
    a.licensing_intent_score, a.updated_at, c.owner_type
   FROM clinical_assets a JOIN companies c ON c.id = a.company_id
  WHERE (c.owner_type = 'industry' OR (COALESCE(c.owner_type, 'unknown') = 'unknown' AND upper(COALESCE(c.lead_sponsor_class, '')) = 'INDUSTRY'))
    AND a.partnership_status = ANY (ARRAY['unpartnered', 'partially_partnered'])
    AND a.ownership_status <> ALL (ARRAY['comparator_or_background', 'marketed_other', 'duplicate_program', 'not_a_program'])
    AND COALESCE(a.confidence_score, 0) >= 20
    AND (a.phase = ANY (ARRAY['preclinical', 'early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3', 'early_phase1', 'phase1', 'phase1_phase2', 'phase2', 'phase2_phase3', 'phase3'])
         OR (a.phase = ANY (ARRAY['phase_4', 'phase4']) AND a.partnership_status = 'unpartnered'));

CREATE OR REPLACE FUNCTION public.clinical_assets_keep_rule_ownership()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  kept constant text[] := ARRAY['generic_drug_fda', 'duplicate_program', 'background_or_placebo', 'not_a_program'];
BEGIN
  IF OLD.ownership_evidence->>'rule' = ANY (kept)
     AND NEW.ownership_status IS DISTINCT FROM OLD.ownership_status
     AND NOT (coalesce(NEW.ownership_evidence->>'rule', '') = ANY (kept))
     AND coalesce(current_setting('radar.ownership_override', true), '') <> 'on' THEN
    NEW.ownership_status := OLD.ownership_status;
    NEW.ownership_evidence := OLD.ownership_evidence;
  END IF;
  RETURN NEW;
END $$;
