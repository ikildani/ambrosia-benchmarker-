-- 164: program grouping v3 + more name suffixes.
-- Applied to production 2026-09-29 ahead of the PR merging, as ledger entry 160_radar_programs_v3.
--
-- 162 grouped on the drug match only when that row's own name contained the INN,
-- which split correct code/INN pairs (REGN1500 + Evinacumab, CC-220 + Iberdomide).
-- v3 trusts a drug match for a company when at least one of that company's rows
-- linked to the drug writes the INN in its name. Wrong matches (Inhaled Nitric
-- Oxide -> inotuzumab ozogamicin, risedronate -> zoledronic acid) have no such row
-- and fall back to the cleaned-name key.

CREATE OR REPLACE FUNCTION public.radar_clean_name_segment(p text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  s text := coalesce(p, '');
  prev text;
  u text := '(mg/kg|mg/m2|mg|µg|μg|ug|mcg|micrograms?|ml|g|iu|%|units?)';
BEGIN
  s := regexp_replace(s, '^\s*\d+(\.\d+)?\s?' || u || '(/(day|kg|dose))?\s+(of\s+)?', '', 'i');
  LOOP
    prev := s;
    s := regexp_replace(s, '[\s,;\-–]+\d+(\.\d+)?\s?' || u || '(\s*/\s*(\d+(\.\d+)?\s?)?' || u || '|/(day|kg|dose|ml|actuation))*(\s+per\s+(actuation|dose|day|puff))?\s*$', '', 'i');
    s := regexp_replace(s, '[\s,;\-–]+(for\s+)?(concentrate|injections?|infusion|solution|suspension|emulsion|capsules?|tablets?|film[- ]coated|gel|cream|ointment|aerosol|powder|patch|lyophili[sz]ed|injectable|monotherapy|regimen|usp|formulation(\s+[ivx0-9]{1,4}|\s+[a-z])?|(extended|sustained|modified|immediate)[- ]release|oral|intravenous|intramuscular|subcutaneous|topical|inhalation|nasal spray|spray)(\s+(use|\d{1,2}))?\s*$', '', 'i');
    s := regexp_replace(s, '[\s,;\-–]+((low|medium|mid|high|single|multiple|ascending|loading|maintenance)[- ])?(dose|dosage|dosing)(\s+(level|group|cohort|escalation|expansion))?(\s+[0-9a-z])?\s*$', '', 'i');
    s := regexp_replace(s, '[\s,;\-–]+(arm|cohort|part|group|panel)\s+[a-z0-9]{1,3}\s*$', '', 'i');
    s := regexp_replace(s, '\s*\((p\.?o\.?|i\.?v\.?|s\.?c\.?|i\.?m\.?)\)\s*$', '', 'i');
    s := regexp_replace(s, '\s+(iv|sc|po|im|q\d+w|q\d+d|qd|qw|bid|tid|qod|daily|weekly|once daily|twice daily)\s*$', '', 'i');
    s := regexp_replace(s, '\s+(\+|plus|along with|with|and)\s+(the\s+)?(standard|soc|best supportive|usual)\M.*$', '', 'i');
    s := regexp_replace(s, '\s+(as|in|for|of|with|and|via)\s*$', '', 'i');
    s := regexp_replace(s, '[\s,;:/\-–+]+$', '');
    EXIT WHEN s = prev;
  END LOOP;
  RETURN btrim(s);
END;
$$;

CREATE OR REPLACE FUNCTION public.radar_refresh_programs()
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout TO '300s'
AS $$
DECLARE
  v_changed integer := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_programs;
  CREATE TEMP TABLE tmp_programs ON COMMIT DROP AS
  WITH base AS (
    SELECT a.id, a.company_id, a.drug_master_id, a.asset_name, a.display_name, a.phase,
           a.trial_count, a.last_update_date, dm.inn, dm.confidence,
           (a.drug_master_id IS NOT NULL AND coalesce(dm.confidence, 0) >= 65
            AND length(coalesce(dm.inn, '')) >= 4
            AND position(lower(dm.inn) IN lower(a.asset_name)) > 0) AS names_inn
    FROM public.clinical_assets a
    LEFT JOIN public.drug_master dm ON dm.id = a.drug_master_id
  ), trusted AS (
    SELECT DISTINCT company_id, drug_master_id FROM base WHERE names_inn AND company_id IS NOT NULL
  ), k AS (
    SELECT b.id,
           CASE
             WHEN b.company_id IS NULL THEN 'a:' || b.id::text
             WHEN t.drug_master_id IS NOT NULL AND coalesce(b.confidence, 0) >= 65
               THEN b.company_id::text || ':dm:' || b.drug_master_id::text
             WHEN public.radar_program_name_key(coalesce(b.display_name, b.asset_name)) IS NOT NULL
               THEN b.company_id::text || ':n:' || public.radar_program_name_key(coalesce(b.display_name, b.asset_name))
             ELSE b.company_id::text || ':a:' || b.id::text
           END AS program_key,
           CASE b.phase
             WHEN 'phase_4' THEN 9 WHEN 'phase_3' THEN 8 WHEN 'phase_2_3' THEN 7 WHEN 'phase_2' THEN 6
             WHEN 'phase_1_2' THEN 5 WHEN 'phase_1' THEN 4 WHEN 'early_phase_1' THEN 3 WHEN 'preclinical' THEN 2 ELSE 1 END AS phase_rank,
           COALESCE(b.trial_count, 0) AS trials,
           b.last_update_date
    FROM base b
    LEFT JOIN trusted t ON t.company_id = b.company_id AND t.drug_master_id = b.drug_master_id
  )
  SELECT id,
         program_key,
         row_number() OVER (PARTITION BY program_key ORDER BY phase_rank DESC, trials DESC, last_update_date DESC NULLS LAST, id) = 1 AS is_primary,
         count(*) OVER (PARTITION BY program_key) AS n_assets,
         sum(trials) OVER (PARTITION BY program_key) AS n_trials
  FROM k;

  UPDATE public.clinical_assets a
     SET program_key = p.program_key,
         program_primary = p.is_primary,
         program_assets = p.n_assets,
         program_trials = p.n_trials
    FROM tmp_programs p
   WHERE a.id = p.id
     AND (a.program_key IS DISTINCT FROM p.program_key
       OR a.program_primary IS DISTINCT FROM p.is_primary
       OR a.program_assets IS DISTINCT FROM p.n_assets
       OR a.program_trials IS DISTINCT FROM p.n_trials);
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN jsonb_build_object('changed', v_changed);
END;
$$;

-- After applying: recompute names (chunked), then
-- SELECT public.radar_refresh_programs(); SELECT public.radar_refresh_score_percentiles();
