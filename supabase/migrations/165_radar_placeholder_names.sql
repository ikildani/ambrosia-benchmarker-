-- 165: registry placeholders are background, not programs.
-- Applied to production 2026-09-29 ahead of the PR merging.
--
-- The default feed carried rows named "Treatment A".."F", "High", "Low",
-- "Biospecimen Collection", "Chemotherapy", the Korean "국문" stub and ISRCTN
-- publication-deferral boilerplate. radar_is_comparator_named() is the first rule
-- of radar_apply_ownership(), so extending it keeps them hidden on every recheck.
-- Mirrors PLACEHOLDER_NAME_RE / PLACEHOLDER_TEXT_RE in lib/radar/ownership.ts.

CREATE OR REPLACE FUNCTION public.radar_is_placeholder_named(p_name text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT coalesce(p_name, '') ~* '^\s*(placebos?|treatment [a-z0-9]{1,2}|low|high|medium|test|reference|chemotherapy|biopsy|biospecimen collection|laboratory biomarker analysis|questionnaire administration|quality[- ]of[- ]life assessment|survey administration|androgen deprivation therapy|oral contraceptives?|국문|영문|해당\s?없음|n/?a|none|not applicable|other)\s*$'
      OR coalesce(p_name, '') ~* '(deferral of publication|full details will be added to the study record|^\s*this is a phase i trial in healthy volunteers)';
$$;

CREATE OR REPLACE FUNCTION public.radar_is_comparator_named(p_name text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT coalesce(p_name, '') ~* '^(comparators?\M|placebo\M|standard[- ]of[- ]care|soc\M|control\M|vehicle\M|sham\M|best supportive care|no intervention|usual care|background therapy)'
      OR public.radar_is_placeholder_named(p_name);
$$;

-- Reclassify existing rows now rather than waiting for the 30-day recheck.
UPDATE public.clinical_assets
   SET ownership_status = 'comparator_or_background',
       ownership_evidence = coalesce(ownership_evidence, '{}'::jsonb)
                            || jsonb_build_object('rule', 'comparator_named', 'placeholder', true, 'previous_status', ownership_status),
       ownership_checked_at = now()
 WHERE public.radar_is_placeholder_named(asset_name)
   AND ownership_status IS DISTINCT FROM 'comparator_or_background';
