-- Program geography for every source, not only the CT.gov universe walker.
--
-- clinical_assets.originator_country / originator_region were set only by lib/radar/asset-universe.ts.
-- Programs created by the filing, HKEX and pipeline-page readers never got them, and the TS
-- country -> region map covered 66 countries (no Iran, Russia, Tanzania ...), so 3,723 pool programs
-- had no region and dropped out of every regional filter (Nov 6 2026).
--
-- radar_country_iso / radar_region_for_country mirror normalizeCountryCode (lib/radar/asset-universe.ts)
-- and COUNTRY_TO_REGION (lib/ingestion/company-geography.ts); the value lists are generated from
-- those maps, so change them there first. A trigger fills missing geography from the company on insert
-- or company change, a second one fills it when a company's country is first learned, and the backfill
-- is logged in radar_trust_fix_log (step asset_geography_20261106). radar_country_iso replaces the one from
-- 157c (same signature, superset of its names, plus UK -> GB); radar_quality_backfill_batch still calls it.

CREATE OR REPLACE FUNCTION radar_country_iso(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p IS NULL OR btrim(p) = '' OR lower(btrim(p)) = 'unknown' THEN NULL
    WHEN btrim(p) ~ '^[A-Za-z]{2}$' THEN CASE upper(btrim(p)) WHEN 'UK' THEN 'GB' ELSE upper(btrim(p)) END
    ELSE (SELECT iso FROM (VALUES ('united states','US'),('united states of america','US'),('usa','US'),('u.s.','US'),('u.s.a.','US'),('switzerland','CH'),('uk','GB'),('u.k.','GB'),('united kingdom','GB'),('great britain','GB'),('england','GB'),('scotland','GB'),('wales','GB'),('japan','JP'),('china','CN'),('people''s republic of china','CN'),('prc','CN'),('south korea','KR'),('korea','KR'),('republic of korea','KR'),('korea, republic of','KR'),('germany','DE'),('france','FR'),('denmark','DK'),('belgium','BE'),('italy','IT'),('ireland','IE'),('canada','CA'),('netherlands','NL'),('the netherlands','NL'),('holland','NL'),('israel','IL'),('india','IN'),('spain','ES'),('sweden','SE'),('brazil','BR'),('hong kong','HK'),('finland','FI'),('taiwan','TW'),('norway','NO'),('indonesia','ID'),('australia','AU'),('singapore','SG'),('austria','AT'),('mexico','MX'),('argentina','AR'),('south africa','ZA'),('united arab emirates','AE'),('saudi arabia','SA'),('turkey','TR'),('poland','PL'),('portugal','PT'),('czech republic','CZ'),('czechia','CZ'),('hungary','HU'),('greece','GR'),('new zealand','NZ'),('thailand','TH'),('malaysia','MY'),('philippines','PH'),('vietnam','VN'),('luxembourg','LU'),('iceland','IS'),('uae','AE'),('iran','IR'),('russia','RU'),('russian federation','RU'),('ukraine','UA'),('slovenia','SI'),('serbia','RS'),('egypt','EG'),('pakistan','PK'),('chile','CL'),('colombia','CO'),('peru','PE')) m(name, iso) WHERE m.name = lower(btrim(p)))
  END
$$;

CREATE OR REPLACE FUNCTION radar_region_for_country(iso text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT region FROM (VALUES ('US','north_america'),('CA','north_america'),('GB','europe'),('DE','europe'),('FR','europe'),('CH','europe'),('NL','europe'),('BE','europe'),('DK','europe'),('SE','europe'),('NO','europe'),('FI','europe'),('IE','europe'),('IT','europe'),('ES','europe'),('AT','europe'),('PT','europe'),('LU','europe'),('IS','europe'),('CZ','europe'),('PL','europe'),('HU','europe'),('GR','europe'),('RO','europe'),('BG','europe'),('HR','europe'),('SI','europe'),('SK','europe'),('LT','europe'),('LV','europe'),('EE','europe'),('CN','china'),('HK','china'),('MO','china'),('TW','asia_pacific'),('JP','japan'),('KR','south_korea'),('IL','israel'),('IN','asia_pacific'),('SG','asia_pacific'),('AU','asia_pacific'),('NZ','asia_pacific'),('TH','asia_pacific'),('MY','asia_pacific'),('ID','asia_pacific'),('PH','asia_pacific'),('VN','asia_pacific'),('SA','middle_east'),('AE','middle_east'),('QA','middle_east'),('KW','middle_east'),('BH','middle_east'),('OM','middle_east'),('JO','middle_east'),('TR','middle_east'),('BR','latin_america'),('MX','latin_america'),('AR','latin_america'),('CL','latin_america'),('CO','latin_america'),('PE','latin_america'),('ZA','africa'),('EG','africa'),('NG','africa'),('KE','africa'),('MA','africa'),('RU','europe'),('UA','europe'),('BY','europe'),('GE','europe'),('AM','europe'),('MD','europe'),('RS','europe'),('BA','europe'),('ME','europe'),('MK','europe'),('AL','europe'),('CY','europe'),('MT','europe'),('LI','europe'),('MC','europe'),('IR','middle_east'),('IQ','middle_east'),('LB','middle_east'),('SY','middle_east'),('YE','middle_east'),('PS','middle_east'),('KZ','asia_pacific'),('UZ','asia_pacific'),('PK','asia_pacific'),('BD','asia_pacific'),('LK','asia_pacific'),('NP','asia_pacific'),('MM','asia_pacific'),('KH','asia_pacific'),('MN','asia_pacific'),('BN','asia_pacific'),('VE','latin_america'),('EC','latin_america'),('UY','latin_america'),('PY','latin_america'),('BO','latin_america'),('CR','latin_america'),('PA','latin_america'),('DO','latin_america'),('CU','latin_america'),('GT','latin_america'),('PR','latin_america'),('JM','latin_america'),('TT','latin_america'),('KY','latin_america'),('TZ','africa'),('UG','africa'),('ET','africa'),('GH','africa'),('TN','africa'),('DZ','africa'),('RW','africa'),('SN','africa'),('CM','africa'),('CI','africa'),('ZW','africa'),('ZM','africa'),('MW','africa'),('BW','africa'),('MZ','africa')) m(code, region) WHERE m.code = iso
$$;

CREATE OR REPLACE FUNCTION radar_company_country(p_company_id uuid) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(radar_country_iso(headquarters_country), radar_country_iso(hq_country)) FROM companies WHERE id = p_company_id
$$;

CREATE OR REPLACE FUNCTION radar_fill_asset_geography() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.originator_country IS NULL AND NEW.company_id IS NOT NULL THEN
    NEW.originator_country := radar_company_country(NEW.company_id);
  END IF;
  IF NEW.originator_region IS NULL AND NEW.originator_country IS NOT NULL THEN
    NEW.originator_region := radar_region_for_country(radar_country_iso(NEW.originator_country));
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_fill_asset_geography ON clinical_assets;
CREATE TRIGGER trg_fill_asset_geography
  BEFORE INSERT OR UPDATE OF company_id, originator_country ON clinical_assets
  FOR EACH ROW EXECUTE FUNCTION radar_fill_asset_geography();

CREATE OR REPLACE FUNCTION radar_company_geography_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE iso text := coalesce(radar_country_iso(NEW.headquarters_country), radar_country_iso(NEW.hq_country));
BEGIN
  IF iso IS NOT NULL THEN
    UPDATE clinical_assets
       SET originator_country = iso,
           originator_region = coalesce(originator_region, radar_region_for_country(iso))
     WHERE company_id = NEW.id AND originator_country IS NULL;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_company_geography_changed ON companies;
CREATE TRIGGER trg_company_geography_changed
  AFTER UPDATE OF headquarters_country, hq_country ON companies
  FOR EACH ROW
  WHEN (OLD.headquarters_country IS DISTINCT FROM NEW.headquarters_country OR OLD.hq_country IS DISTINCT FROM NEW.hq_country)
  EXECUTE FUNCTION radar_company_geography_changed();

-- Backfill: programs with no region whose own country or company country now maps to one.
WITH target AS (
  SELECT a.id, a.company_id, a.originator_country AS old_country,
         coalesce(radar_country_iso(a.originator_country), radar_company_country(a.company_id)) AS iso
    FROM clinical_assets a
   WHERE a.originator_region IS NULL
), fixed AS (
  UPDATE clinical_assets a
     SET originator_country = t.iso,
         originator_region = radar_region_for_country(t.iso)
    FROM target t
   WHERE a.id = t.id AND t.iso IS NOT NULL AND radar_region_for_country(t.iso) IS NOT NULL
  RETURNING a.id, a.company_id, t.old_country, a.originator_country, a.originator_region
)
INSERT INTO radar_trust_fix_log (asset_id, company_id, step, old_values, new_values)
SELECT id, company_id, 'asset_geography_20261106',
       jsonb_build_object('originator_country', old_country, 'originator_region', NULL),
       jsonb_build_object('originator_country', originator_country, 'originator_region', originator_region)
  FROM fixed;
