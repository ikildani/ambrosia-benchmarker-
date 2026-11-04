-- 182: background-therapy and placebo rows are not programs.
--
-- Why (Nov 4 2026): rows named only for a regimen or background therapy ("mFOLFOX6", "Platinum-based
-- chemotherapy", "Lymphodepleting chemotherapy", "Optimized background regimen") or for a placebo arm
-- ("ALG-000184 Placebo", "Matching placebo for WIN378") sat in the evaluation pool as unpartnered
-- assets. radar_background_residue() strips regimen, chemotherapy, placebo and formulation words; a row
-- with nothing left is background. Such rows get ownership_status 'comparator_or_background' with
-- evidence rule 'background_or_placebo', and the migration 181 trigger now keeps that rule too.

CREATE OR REPLACE FUNCTION public.radar_background_residue(n text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(regexp_replace(regexp_replace(lower(n),
   '\m(chemotherapy|chemo|regimens?|platinum|based|doublets?|placebos?|matching|matched|standard|care|best|supportive|investigator''?s?|investigators|physician''?s?|choice|treatments?|background|therapy|therapies|optimi[sz]ed|conventional|usual|local|iv|intravenous|oral|first[- ]line|second[- ]line|neo[- ]?adjuvant|adjuvant|concurrent|lymphodepleting|lymphodepletion|conditioning|agents?|drugs?|m?folfox\d*|folfiri|m?folfirinox|capox|xelox|r-?chop|chop|abvd|gemox|flot|sox|fec|tip|tbf|carboplatin|cisplatin|oxaliplatin|nedaplatin|paclitaxel|nab-paclitaxel|docetaxel|etoposide|pemetrexed|gemcitabine|capecitabine|fluorouracil|5-fu|leucovorin|irinotecan|cyclophosphamide|fludarabine|doxorubicin|pld|epirubicin|vincristine|prednisone|of|and|or|with|to|for|the|plus|powder|capsules?|tablets?|injections?|solution|cream|ointment|gel|vehicle|phase|arm|saline|normal|sodium|chloride|sham|control|comparator|reference|alone|cycles?|weekly|every|[a-e])\M', ' ', 'g'),
   '[^a-z0-9一-鿿]+|\m\d+\M', ' ', 'g'));
$$;
REVOKE ALL ON FUNCTION public.radar_background_residue(text) FROM PUBLIC, anon, authenticated;

-- 'background' = nothing but regimen / chemotherapy / placebo words; 'placebo_arm' = a single placebo item.
CREATE OR REPLACE FUNCTION public.radar_background_rows()
RETURNS TABLE (asset_id uuid, asset_name text, kind text)
LANGUAGE sql STABLE SET statement_timeout TO '120s' AS $$
  SELECT id, asset_name, kind FROM (
    SELECT e.id, e.asset_name,
      CASE WHEN radar_background_residue(e.asset_name) = ''
                AND e.asset_name ~* '(chemo|placebo|regimen|care|choice|background|platinum|folfox|folfiri|capox|xelox|chop|abvd|gemox|flot|saline|vehicle|sham|fec|tip|tbf|carboplatin|cisplatin|pemetrexed|paclitaxel)' THEN 'background'
           WHEN e.asset_name ~* '\mplacebos?\M' AND e.asset_name !~* '(\+|;|,|\mwith\M|\mand\M|\mor\M|combination|followed|then)' THEN 'placebo_arm' END kind
    FROM radar_thesis_eligible_assets e) x
  WHERE kind IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.radar_background_rows() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.clinical_assets_keep_rule_ownership()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  kept constant text[] := ARRAY['generic_drug_fda', 'duplicate_program', 'background_or_placebo'];
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
