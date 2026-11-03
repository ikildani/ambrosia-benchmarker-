-- 179: old generic drugs recorded as a sponsor's own asset (trial comparators / background therapy).
--
-- Why (Nov 3 2026): drugs such as zidovudine, furosemide or celecoxib appeared as assets of every
-- company that used them in a trial ("Amgen / Zidovudine"), and sat in the Search & Evaluation pool.
-- fda_ingredients holds Drugs@FDA facts per active ingredient (first NDA/BLA approval, holders,
-- ANDA product count), loaded from https://www.fda.gov/media/89850/download.
-- radar_generic_comparator_candidates() lists assets whose drug is claimed by two or more unrelated
-- companies, is an FDA-approved ingredient with generics approved before 2016, whose name is just the
-- ingredient, and whose company is neither an application holder nor a recorded owner.
-- One-off 2026-11-03: 552 such assets (first trial posted after approval) set to
-- ownership_status 'comparator_or_background'; old values in radar_trust_fix_log
-- (step generic_comparator_20261103). Applied to production as 179, 179b, 179c, 179d.

CREATE TABLE IF NOT EXISTS public.fda_ingredients (
  ingredient_key text PRIMARY KEY,
  ingredient text NOT NULL,
  first_approval date,
  nda_bla_holders text[] NOT NULL DEFAULT '{}',
  anda_products int NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'drugsatfda',
  loaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fda_ingredients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fda_ingredients FROM anon, authenticated;

-- Same normalisation as the Drugs@FDA loader: lower case, salts / hydrates removed, punctuation folded.
-- With p_strip_form, dose numbers and dose-form words are removed too ("Furosemide 40 mg tablets" -> "furosemide").
CREATE OR REPLACE FUNCTION public.fda_ingredient_key(p text, p_strip_form boolean DEFAULT false)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(btrim(regexp_replace(regexp_replace(regexp_replace(
    CASE WHEN p_strip_form THEN regexp_replace(lower(coalesce(p, '')),
      '\m(\d+(\.\d+)?\s*(mg|mcg|µg|g|ml|iu|units?|%)?|tablets?|capsules?|injections?|injectable|oral|solution|suspension|infusion|intravenous|iv|im|sc|subcutaneous|powder|for|vial|placebo matched|usp|bp|generic|film[- ]coated|immediate[- ]release|ir)\M', ' ', 'g')
    ELSE lower(coalesce(p, '')) END,
    '\m(hydrochloride|hcl|dihydrochloride|hydrobromide|sodium|disodium|potassium|calcium|magnesium|mesylate|maleate|fumarate|tartrate|bitartrate|succinate|citrate|acetate|sulfate|phosphate|besylate|tosylate|bromide|chloride|monohydrate|dihydrate|trihydrate|hemihydrate|anhydrous|hyclate|lactate|gluconate|nitrate|oxalate|malate|pamoate|propionate|valerate|dipropionate|furoate|decanoate|xinafoate|trometamol|tromethamine|meglumine|benzoate|salicylate|stearate|palmitate|hemifumarate|base|free acid)\M', ' ', 'g'),
    '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')), '')
$$;

CREATE OR REPLACE FUNCTION public.radar_generic_comparator_candidates()
RETURNS TABLE (asset_id uuid, company_name text, asset_name text, ownership_status text, phase text,
               ingredient text, first_approval date, anda_products int, in_pool boolean)
LANGUAGE sql STABLE SET statement_timeout TO '120s' AS $$
  WITH multi AS (SELECT drug_master_id FROM radar_drug_duplicate_groups() WHERE group_class = 'unexplained')
  SELECT a.id, a.company_name, a.asset_name, a.ownership_status, a.phase, f.ingredient, f.first_approval, f.anda_products,
         EXISTS (SELECT 1 FROM radar_thesis_eligible_assets e WHERE e.id = a.id)
  FROM clinical_assets a
  JOIN multi m ON m.drug_master_id = a.drug_master_id
  JOIN drug_master dm ON dm.id = a.drug_master_id
  JOIN fda_ingredients f ON f.ingredient_key = fda_ingredient_key(dm.preferred_name)
  WHERE a.owner_type = 'industry' AND a.ownership_status IN ('originator', 'unknown')
    AND f.anda_products > 0 AND f.first_approval < DATE '2016-01-01'
    AND fda_ingredient_key(a.asset_name, true) = f.ingredient_key
    -- The FDA application holder, or a company recorded as an owner of the drug, keeps its row.
    AND NOT EXISTS (
      SELECT 1 FROM unnest(f.nda_bla_holders) h
      WHERE split_part(lower(h), ' ', 1) = split_part(lower(regexp_replace(a.company_name, '[^A-Za-z ]', '', 'g')), ' ', 1))
    AND NOT EXISTS (SELECT 1 FROM drug_owners o WHERE o.drug_id = a.drug_master_id AND o.company_id = a.company_id)
$$;
REVOKE ALL ON FUNCTION public.radar_generic_comparator_candidates() FROM PUBLIC, anon, authenticated;
