-- 161: data quality for what users read.
-- Applied to production 2026-09-29 ahead of the PR merging, under ledger names 157a/157b/157c_radar_display_names_regions (renumbered: main took 157).
--
-- 1. display_name: registry rows are named after trial arms and doses
--    ("Phase Ib Cohort 2: HDM2005 1.4 mg/kg + R-Len", "EDP-323 Dose Regimen 1",
--    "Entrectinib Reference Formulation", "[14C] BI 1356 oral solution").
--    display_name keeps asset_name intact and shows the program: the INN when
--    the drug dictionary matched with >= 80 confidence, otherwise asset_name
--    with cohort / arm / dose / formulation text stripped and all-caps words
--    lowered. Maintained by trigger; backfilled by a self-retiring job.
-- 2. Programs group only on drug matches with confidence >= 65: low-confidence
--    dictionary matches are often wrong (ponsegromab -> trifluridine/tipiracil)
--    and would have merged different drugs into one program.
-- 3. Region: originator_country from the company's headquarters when the
--    asset has none, then originator_region from the country (4,295 default-
--    view programs had no region).
-- Apply after 156. Idempotent.

ALTER TABLE public.clinical_assets ADD COLUMN IF NOT EXISTS display_name text;

CREATE OR REPLACE FUNCTION public.radar_clean_asset_name(p_name text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  s text := coalesce(p_name, '');
  orig text := s;
BEGIN
  s := replace(s, '_', ' ');
  -- Study-design prefixes, with or without punctuation: "Phase Ib Cohort 2:", "Cohort 1 ", "Main cohort (Cohort A):", "T2 - ", "Arm B:"
  s := regexp_replace(s, '^\s*(phase\s+[0-9ivx]+[ab]?\s*)?((main|expansion|escalation)\s+)?(cohort|arm|part|group|stage|panel)\s*[a-z0-9]*\s*(\([^)]*\))?\s*[:,\-–]?\s+', '', 'i');
  s := regexp_replace(s, '^\s*[A-Z]{1,3}\d{0,2}\s*[-:]\s+', '');
  s := regexp_replace(s, '^\s*(dose\s+(escalation|expansion)|ascending\s+dose[s]?|sad|mad)\s*[:,\-–]?\s+', '', 'i');
  s := regexp_replace(s, '^\s*(soc|standard of care|bsc)\s*\+\s*', '', 'i');
  s := regexp_replace(s, '\s+(arm|cohort|part|group|panel)\s+[a-z0-9]{1,3}\s*$', '', 'i');
  s := regexp_replace(s, '\[\s*14\s*c\s*\]\s*-?', '', 'gi');
  -- Doses, strengths, durations
  s := regexp_replace(s, '(^|\s)\d+(\.\d+)?\s?(mg/kg|mg/m2|mg|µg|μg|ug|mcg|ml|g|iu|%|units?)(/(day|kg|dose))?(?=\s|$|[,;)/])', ' ', 'gi');
  s := regexp_replace(s, '\m(up\s+to\s+)?\d+[- ](day|days|week|weeks|month|months)\M', '', 'gi');
  s := regexp_replace(s, '\m(low|medium|mid|high|single|multiple|ascending|escalating|loading|maintenance)?\s*dos(e|es|ing)(\s+(regimen|level|group|cohort))?\s*[0-9a-z]?\M', '', 'gi');
  s := regexp_replace(s, '\m(dose\s+)?(escalation|expansion)(\s+cohort)?\M', '', 'gi');
  -- Formulation and route
  s := regexp_replace(s, '\m(as\s+)?(for\s+)?(injection|infusion|oral\s+solution|solution|suspension|capsules?|tablets?|topical\s+gel|gel|cream|ointment|inhalation\s+aerosol|aerosol|powder|lyophili[sz]ed|reference\s+formulation|formulation\s*[0-9a-z]?|intramuscularly|intravenously|subcutaneously|orally|oral|placebo)\M', '', 'gi');
  s := regexp_replace(s, '\((p\.?o\.?|i\.?v\.?|s\.?c\.?|i\.?m\.?)\)', '', 'gi');
  s := regexp_replace(s, '\m(sequential|combination|monotherapy|treatment|regimen)\s*$', '', 'gi');
  s := regexp_replace(s, '^\s*of\s+', '', 'i');
  s := regexp_replace(s, '\s+of\s*$', '', 'i');
  -- Punctuation left behind
  s := regexp_replace(s, '\(\s*\)', '', 'g');
  s := regexp_replace(s, '\s+([,;])', '\1', 'g');
  s := regexp_replace(s, '([,;:/\-–+])\s*([,;:/\-–+])', '\1', 'g');
  s := regexp_replace(s, '\s*[,;:/\-–+]\s*$', '', 'g');
  s := regexp_replace(s, '^\s*[,;:/\-–+]\s*', '', 'g');
  s := regexp_replace(s, '\s{2,}', ' ', 'g');
  s := btrim(s);
  IF s ~ '[A-Z]{5,}' THEN
    s := (SELECT string_agg(CASE WHEN w ~ '^[A-Z][A-Z\-]{4,}$' AND w !~ '\d' THEN lower(w) ELSE w END, ' ') FROM regexp_split_to_table(s, '\s+') w);
  END IF;
  IF length(s) < 2 THEN RETURN btrim(orig); END IF;
  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.radar_display_name(p_name text, p_inn text, p_conf integer)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_inn IS NOT NULL AND btrim(p_inn) <> '' AND coalesce(p_conf, 0) >= 80
         AND (p_name ~* '(\d+(\.\d+)?\s?(mg|µg|μg|ug|mcg|ml|iu|%)|cohort|dose|formulation|capsule|tablet|injection|solution|\[14c\])' OR length(p_name) > 60 OR p_name = upper(p_name))
      THEN lower(btrim(p_inn))
    ELSE public.radar_clean_asset_name(p_name)
  END;
$$;

CREATE OR REPLACE FUNCTION public.trg_clinical_assets_display_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_inn text; v_conf integer;
BEGIN
  IF NEW.drug_master_id IS NOT NULL THEN
    SELECT inn, confidence INTO v_inn, v_conf FROM public.drug_master WHERE id = NEW.drug_master_id;
  END IF;
  NEW.display_name := public.radar_display_name(NEW.asset_name, v_inn, v_conf);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinical_assets_display_name ON public.clinical_assets;
CREATE TRIGGER clinical_assets_display_name
  BEFORE INSERT OR UPDATE OF asset_name, drug_master_id ON public.clinical_assets
  FOR EACH ROW EXECUTE FUNCTION public.trg_clinical_assets_display_name();

-- Country -> region, from the pairs already in the data plus common names.
CREATE OR REPLACE FUNCTION public.radar_country_iso(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL OR btrim(p) = '' THEN NULL
    WHEN btrim(p) ~ '^[A-Za-z]{2}$' THEN upper(btrim(p))
    ELSE CASE lower(btrim(p))
      WHEN 'united states' THEN 'US' WHEN 'usa' THEN 'US' WHEN 'united states of america' THEN 'US'
      WHEN 'china' THEN 'CN' WHEN 'people''s republic of china' THEN 'CN' WHEN 'south korea' THEN 'KR' WHEN 'korea' THEN 'KR'
      WHEN 'republic of korea' THEN 'KR' WHEN 'japan' THEN 'JP' WHEN 'russia' THEN 'RU' WHEN 'russian federation' THEN 'RU'
      WHEN 'switzerland' THEN 'CH' WHEN 'netherlands' THEN 'NL' WHEN 'the netherlands' THEN 'NL' WHEN 'united kingdom' THEN 'GB'
      WHEN 'uk' THEN 'GB' WHEN 'germany' THEN 'DE' WHEN 'france' THEN 'FR' WHEN 'italy' THEN 'IT' WHEN 'spain' THEN 'ES'
      WHEN 'canada' THEN 'CA' WHEN 'australia' THEN 'AU' WHEN 'israel' THEN 'IL' WHEN 'india' THEN 'IN' WHEN 'taiwan' THEN 'TW'
      WHEN 'hong kong' THEN 'HK' WHEN 'singapore' THEN 'SG' WHEN 'sweden' THEN 'SE' WHEN 'denmark' THEN 'DK' WHEN 'belgium' THEN 'BE'
      WHEN 'ireland' THEN 'IE' WHEN 'austria' THEN 'AT' WHEN 'norway' THEN 'NO' WHEN 'finland' THEN 'FI' WHEN 'brazil' THEN 'BR'
      WHEN 'mexico' THEN 'MX' WHEN 'argentina' THEN 'AR' WHEN 'turkey' THEN 'TR' WHEN 'poland' THEN 'PL' WHEN 'iran' THEN 'IR'
      WHEN 'egypt' THEN 'EG' WHEN 'south africa' THEN 'ZA' WHEN 'saudi arabia' THEN 'SA' WHEN 'united arab emirates' THEN 'AE'
      ELSE NULL END
  END;
$$;

CREATE TABLE IF NOT EXISTS public.radar_country_region (country text PRIMARY KEY, region text NOT NULL);
INSERT INTO public.radar_country_region (country, region)
SELECT DISTINCT ON (originator_country) originator_country, originator_region
FROM (SELECT originator_country, originator_region, count(*) n FROM public.clinical_assets
      WHERE originator_country IS NOT NULL AND originator_region IS NOT NULL GROUP BY 1, 2) t
ORDER BY originator_country, n DESC
ON CONFLICT (country) DO NOTHING;
INSERT INTO public.radar_country_region (country, region) VALUES
  ('US','north_america'),('CA','north_america'),('RU','europe'),('UA','europe'),('BY','europe'),('TR','middle_east'),('IR','middle_east'),
  ('MX','latin_america'),('PE','latin_america'),('VN','asia_pacific'),('TH','asia_pacific'),('MY','asia_pacific'),('PH','asia_pacific'),
  ('PK','asia_pacific'),('BD','asia_pacific'),('NZ','asia_pacific'),('SG','asia_pacific'),('TW','asia_pacific'),('NG','africa'),('ZA','africa'),('TN','africa')
ON CONFLICT (country) DO NOTHING;

-- Backfill: display names and regions in batches; the job unschedules itself when done.
CREATE OR REPLACE FUNCTION public.radar_quality_backfill_batch()
RETURNS integer
LANGUAGE plpgsql
AS $$
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
    PERFORM cron.unschedule('radar_quality_backfill');
  END IF;
  RETURN n + m;
END;
$$;

SELECT cron.schedule('radar_quality_backfill', '* * * * *', 'SELECT public.radar_quality_backfill_batch()')
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'radar_quality_backfill');

-- Programs group only on trusted drug matches.
CREATE OR REPLACE FUNCTION public.radar_refresh_programs()
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_changed integer := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_programs;
  CREATE TEMP TABLE tmp_programs ON COMMIT DROP AS
  WITH k AS (
    SELECT a.id,
           CASE WHEN a.company_id IS NULL THEN 'a:' || a.id::text
                WHEN a.drug_master_id IS NULL OR coalesce(dm.confidence, 0) < 65 THEN a.company_id::text || ':a:' || a.id::text
                ELSE a.company_id::text || ':' || a.drug_master_id::text END AS program_key,
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
