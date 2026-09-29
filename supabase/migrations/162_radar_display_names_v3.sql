-- 158: display names v3 + name-based program grouping.
-- Applied to production 2026-09-29 ahead of the PR merging.
--
-- Why: a spot check of 157 showed two failure modes.
--  1. drug_master matches are wrong even at confidence 92 (AVE1642 -> veligrotug,
--     a Budesonide product -> albuterol), so a display name must never swap the
--     registry name for the matched INN, and a program must not be grouped on the
--     match alone.
--  2. Removing dose/formulation words anywhere in a name garbles phrases
--     ("administration of one of Citalopram"). Removals are now anchored to the
--     start or end of the name (or of each ';'-separated segment).

CREATE OR REPLACE FUNCTION public.radar_clean_name_segment(p text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  s text := coalesce(p, '');
  prev text;
  u text := '(mg/kg|mg/m2|mg|µg|μg|ug|mcg|micrograms?|ml|g|iu|%|units?)';
BEGIN
  -- leading dose: "12.5 mg empagliflozin", "6.0 mg/kg of TQB2102"
  s := regexp_replace(s, '^\s*\d+(\.\d+)?\s?' || u || '(/(day|kg|dose))?\s+(of\s+)?', '', 'i');
  LOOP
    prev := s;
    -- trailing strength(s): "90µg", "50 microgram/500 microgram per actuation"
    s := regexp_replace(s, '[\s,;\-–]+\d+(\.\d+)?\s?' || u || '(\s*/\s*(\d+(\.\d+)?\s?)?' || u || '|/(day|kg|dose|ml|actuation))*(\s+per\s+(actuation|dose|day|puff))?\s*$', '', 'i');
    -- trailing formulation / regimen words
    s := regexp_replace(s, '[\s,;\-–]+(for\s+)?(concentrate|injections?|infusion|solution|suspension|emulsion|capsules?|tablets?|film[- ]coated|gel|cream|ointment|aerosol|powder|patch|lyophili[sz]ed|injectable|monotherapy|regimen|usp|formulation(\s+[ivx0-9]{1,4}|\s+[a-z])?|(extended|sustained|modified|immediate)[- ]release|oral|intravenous|subcutaneous|topical|inhalation|nasal spray|spray)(\s+use)?\s*$', '', 'i');
    -- trailing dose labels: "medium dose", "high-dose", "dose 2"
    s := regexp_replace(s, '[\s,;\-–]+((low|medium|mid|high|single|multiple|ascending|loading|maintenance)[- ])?(dose|dosage|dosing)(\s+(level|group|cohort))?(\s+[0-9a-z])?\s*$', '', 'i');
    -- trailing arm labels and route abbreviations
    s := regexp_replace(s, '[\s,;\-–]+(arm|cohort|part|group|panel)\s+[a-z0-9]{1,3}\s*$', '', 'i');
    s := regexp_replace(s, '\s*\((p\.?o\.?|i\.?v\.?|s\.?c\.?|i\.?m\.?)\)\s*$', '', 'i');
    -- trailing route / schedule: "IV Q3W", "SC QD"
    s := regexp_replace(s, '\s+(iv|sc|po|im|q\d+w|q\d+d|qd|qw|bid|tid|qod|once daily|twice daily)\s*$', '', 'i');
    s := regexp_replace(s, '\s+(as|in|for|of|with|and|via)\s*$', '', 'i');
    s := regexp_replace(s, '[\s,;:/\-–+]+$', '');
    EXIT WHEN s = prev;
  END LOOP;
  RETURN btrim(s);
END;
$$;

CREATE OR REPLACE FUNCTION public.radar_clean_asset_name(p_name text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  s text := btrim(coalesce(p_name, ''));
  orig text := s;
  stems text := '(mab|tug|nib|lisib|parib|ciclib|stat|vir|tide|cept|ine|ide|ate|olol|pril|sartan|azole|mycin|cillin|cycline|tecan|vedotin|platin|ase|gene|cel|mer|sen|tan|fen|zine|pine|done|one|mide|prost|gliptin|gliflozin|glutide|terol|sone|lone|zolam|pam|oxacin|stim|parin|dronate|profen|coxib|kin|ant|ol|il)';
BEGIN
  s := replace(s, '_', ' ');
  s := regexp_replace(s, '\[\s*14\s*c\s*\]\s*-?\s*', '', 'gi');
  -- leading design labels
  s := regexp_replace(s, '^\s*(phase\s+[0-9ivx]+[ab]?\s*)?((main|expansion|escalation)\s+)?(cohort|arm|part|group|stage|panel)\s*[a-z0-9]*\s*(\([^)]*\))?\s*[:,\-–]?\s+', '', 'i');
  s := regexp_replace(s, '^\s*(intervention|experimental|treatment|test|reference)(\s+(group|arm|product|drug))?\s*[:\-–]\s+', '', 'i');
  s := regexp_replace(s, '^\s*[A-Z]{1,3}\d{0,2}\s*[-:]\s+', '');
  s := regexp_replace(s, '^\s*(dose\s+(escalation|expansion)|ascending\s+doses?|sad|mad)\s*[:,\-–]\s+', '', 'i');
  s := regexp_replace(s, '^\s*(soc|standard of care|bsc)\s*\+\s*', '', 'i');
  -- clean each ';'-separated segment from its ends
  s := (SELECT string_agg(public.radar_clean_name_segment(seg), '; ' ORDER BY ord)
          FROM regexp_split_to_table(s, '\s*;\s*') WITH ORDINALITY AS t(seg, ord)
         WHERE btrim(seg) <> '');
  s := regexp_replace(coalesce(s, ''), '\(\s*\)', '', 'g');
  s := regexp_replace(s, '\s{2,}', ' ', 'g');
  s := btrim(s);
  -- INN-shaped words in capitals read as shouting: RISVUTATUG REZETECAN -> risvutatug rezetecan.
  -- Brand names and codes (HEPLISAV, LIGHT-PSMA) keep their case.
  IF s ~ '\m[A-Z]{6,}\M' THEN
    s := (SELECT string_agg(CASE WHEN w ~ ('^[A-Z]{6,}$') AND lower(w) ~ (stems || '$') THEN lower(w) ELSE w END, ' ' ORDER BY ord)
            FROM regexp_split_to_table(s, ' ') WITH ORDINALITY AS t(w, ord));
  END IF;
  IF length(s) < 2 THEN RETURN orig; END IF;
  RETURN s;
END;
$$;

-- The matched INN is no longer substituted: matches are wrong too often.
-- Signature kept for the 157 trigger.
CREATE OR REPLACE FUNCTION public.radar_display_name(p_name text, p_inn text, p_conf integer)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$ SELECT public.radar_clean_asset_name(p_name) $$;

-- Program key: the drug match only counts when the INN is written in the name;
-- otherwise the cleaned name (letters and digits only) groups arms and doses.
CREATE OR REPLACE FUNCTION public.radar_program_name_key(p_display text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$ SELECT nullif(lower(regexp_replace(coalesce(p_display, ''), '[^A-Za-z0-9]', '', 'g')), '') $$;

CREATE OR REPLACE FUNCTION public.radar_refresh_programs()
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout TO '180s'
AS $$
DECLARE
  v_changed integer := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_programs;
  CREATE TEMP TABLE tmp_programs ON COMMIT DROP AS
  WITH k AS (
    SELECT a.id,
           CASE
             WHEN a.company_id IS NULL THEN 'a:' || a.id::text
             WHEN a.drug_master_id IS NOT NULL AND coalesce(dm.confidence, 0) >= 65
                  AND length(coalesce(dm.inn, '')) >= 4
                  AND position(lower(dm.inn) IN lower(a.asset_name)) > 0
               THEN a.company_id::text || ':dm:' || a.drug_master_id::text
             WHEN public.radar_program_name_key(coalesce(a.display_name, a.asset_name)) IS NOT NULL
               THEN a.company_id::text || ':n:' || public.radar_program_name_key(coalesce(a.display_name, a.asset_name))
             ELSE a.company_id::text || ':a:' || a.id::text
           END AS program_key,
           CASE a.phase
             WHEN 'phase_4' THEN 9 WHEN 'phase_3' THEN 8 WHEN 'phase_2_3' THEN 7 WHEN 'phase_2' THEN 6
             WHEN 'phase_1_2' THEN 5 WHEN 'phase_1' THEN 4 WHEN 'early_phase_1' THEN 3 WHEN 'preclinical' THEN 2 ELSE 1 END AS phase_rank,
           COALESCE(a.trial_count, 0) AS trials,
           a.last_update_date
    FROM public.clinical_assets a
    LEFT JOIN public.drug_master dm ON dm.id = a.drug_master_id
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

-- 158c: the backfill job may already be unscheduled when a manual call finds no work.
CREATE OR REPLACE FUNCTION public.radar_quality_backfill_batch()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE n integer := 0; m integer := 0;
BEGIN
  WITH todo AS (
    SELECT a.id, a.asset_name, dm.inn, dm.confidence
    FROM public.clinical_assets a
    LEFT JOIN public.drug_master dm ON dm.id = a.drug_master_id
    WHERE a.display_name IS NULL
    LIMIT 6000
  )
  UPDATE public.clinical_assets a
     SET display_name = public.radar_display_name(todo.asset_name, todo.inn, todo.confidence)
    FROM todo
   WHERE a.id = todo.id;
  GET DIAGNOSTICS n = ROW_COUNT;

  WITH todo AS (
    SELECT a.id, coalesce(a.originator_country, public.radar_country_iso(coalesce(c.hq_country, c.headquarters_country))) AS iso
    FROM public.clinical_assets a
    LEFT JOIN public.companies c ON c.id = a.company_id
    WHERE a.originator_region IS NULL
      AND coalesce(a.originator_country, public.radar_country_iso(coalesce(c.hq_country, c.headquarters_country)))
          IN (SELECT country FROM public.radar_country_region)
    LIMIT 6000
  )
  UPDATE public.clinical_assets a
     SET originator_country = coalesce(a.originator_country, todo.iso),
         originator_region = cr.region
    FROM todo JOIN public.radar_country_region cr ON cr.country = todo.iso
   WHERE a.id = todo.id;
  GET DIAGNOSTICS m = ROW_COUNT;

  IF n = 0 AND m = 0 THEN
    PERFORM cron.unschedule('radar_quality_backfill') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'radar_quality_backfill');
  END IF;
  RETURN n + m;
END;
$function$;

-- Recompute every name with v3 (run once after applying; chunked by hash in production):
-- UPDATE public.clinical_assets SET display_name = public.radar_clean_asset_name(asset_name)
--  WHERE display_name IS DISTINCT FROM public.radar_clean_asset_name(asset_name);
-- SELECT public.radar_refresh_programs(); SELECT public.radar_refresh_score_percentiles();
