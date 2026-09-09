-- Asset Radar Layer 1: indexing cursor + geography normalization
--
-- 1. companies.assets_indexed_at — a dedicated cursor for the asset-universe
--    cron. The cron used to order by companies.updated_at, but trials-update
--    bumps updated_at for every company it enriches, so the 200 companies with
--    the OLDEST updated_at were exactly the ones with no company_trials rows —
--    the same trial-less 200 were re-selected every day and clinical_assets
--    never grew past its initial load.
-- 2. radar_companies_to_index() — server-side selection of companies that have
--    at least one drug-bearing trial, ordered by the new cursor (NULLS FIRST so
--    never-indexed companies go first).
-- 3. Idempotent normalization of clinical_assets.originator_country to ISO
--    3166-1 alpha-2 and originator_region to the snake_case region slugs used
--    by lib/ingestion/company-geography.ts, and derivation of region from
--    country where region is NULL.

-- ══════════════════════════════════════════════════════════════════════
-- 1. INDEXING CURSOR
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS assets_indexed_at TIMESTAMPTZ;

COMMENT ON COLUMN companies.assets_indexed_at IS
  'Last time the asset-universe cron indexed this company''s trials into clinical_assets. NULL = never indexed.';

CREATE INDEX IF NOT EXISTS idx_companies_assets_indexed_at
  ON companies (assets_indexed_at ASC NULLS FIRST);

-- ══════════════════════════════════════════════════════════════════════
-- 2. COMPANY SELECTION RPC
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION radar_companies_to_index(
  p_limit INT DEFAULT 400,
  p_company_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  hq_country TEXT,
  hq_region TEXT,
  headquarters_country TEXT,
  headquarters_region TEXT,
  assets_indexed_at TIMESTAMPTZ
) AS $$
  SELECT
    c.id,
    c.name,
    c.hq_country,
    c.hq_region,
    c.headquarters_country,
    c.headquarters_region,
    c.assets_indexed_at
  FROM companies c
  WHERE EXISTS (
      SELECT 1
      FROM company_trials t
      WHERE t.company_id = c.id
        AND t.intervention_name IS NOT NULL
    )
    AND (p_company_ids IS NULL OR c.id = ANY(p_company_ids))
  ORDER BY c.assets_indexed_at ASC NULLS FIRST, c.id ASC
  LIMIT GREATEST(COALESCE(p_limit, 400), 1);
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION radar_companies_to_index(INT, UUID[]) IS
  'Companies with >=1 drug-bearing company_trials row, least-recently indexed first (never-indexed first). Used by /api/cron/asset-universe.';

-- ══════════════════════════════════════════════════════════════════════
-- 3. GEOGRAPHY NORMALIZATION (idempotent)
-- ══════════════════════════════════════════════════════════════════════

-- 3a. Full country names → ISO 3166-1 alpha-2
UPDATE clinical_assets
SET originator_country = CASE lower(trim(originator_country))
  WHEN 'united states'            THEN 'US'
  WHEN 'united states of america' THEN 'US'
  WHEN 'usa'                      THEN 'US'
  WHEN 'u.s.'                     THEN 'US'
  WHEN 'u.s.a.'                   THEN 'US'
  WHEN 'switzerland'              THEN 'CH'
  WHEN 'uk'                       THEN 'GB'
  WHEN 'u.k.'                     THEN 'GB'
  WHEN 'united kingdom'           THEN 'GB'
  WHEN 'great britain'            THEN 'GB'
  WHEN 'england'                  THEN 'GB'
  WHEN 'scotland'                 THEN 'GB'
  WHEN 'wales'                    THEN 'GB'
  WHEN 'japan'                    THEN 'JP'
  WHEN 'china'                    THEN 'CN'
  WHEN 'people''s republic of china' THEN 'CN'
  WHEN 'prc'                      THEN 'CN'
  WHEN 'south korea'              THEN 'KR'
  WHEN 'korea'                    THEN 'KR'
  WHEN 'republic of korea'        THEN 'KR'
  WHEN 'korea, republic of'       THEN 'KR'
  WHEN 'germany'                  THEN 'DE'
  WHEN 'france'                   THEN 'FR'
  WHEN 'denmark'                  THEN 'DK'
  WHEN 'belgium'                  THEN 'BE'
  WHEN 'italy'                    THEN 'IT'
  WHEN 'ireland'                  THEN 'IE'
  WHEN 'canada'                   THEN 'CA'
  WHEN 'netherlands'              THEN 'NL'
  WHEN 'the netherlands'          THEN 'NL'
  WHEN 'holland'                  THEN 'NL'
  WHEN 'israel'                   THEN 'IL'
  WHEN 'india'                    THEN 'IN'
  WHEN 'spain'                    THEN 'ES'
  WHEN 'sweden'                   THEN 'SE'
  WHEN 'brazil'                   THEN 'BR'
  WHEN 'hong kong'                THEN 'HK'
  WHEN 'finland'                  THEN 'FI'
  WHEN 'taiwan'                   THEN 'TW'
  WHEN 'norway'                   THEN 'NO'
  WHEN 'indonesia'                THEN 'ID'
  WHEN 'australia'                THEN 'AU'
  WHEN 'singapore'                THEN 'SG'
  WHEN 'austria'                  THEN 'AT'
  WHEN 'mexico'                   THEN 'MX'
  WHEN 'argentina'                THEN 'AR'
  WHEN 'south africa'             THEN 'ZA'
  WHEN 'united arab emirates'     THEN 'AE'
  WHEN 'saudi arabia'             THEN 'SA'
  WHEN 'turkey'                   THEN 'TR'
  WHEN 'poland'                   THEN 'PL'
  WHEN 'portugal'                 THEN 'PT'
  WHEN 'czech republic'           THEN 'CZ'
  WHEN 'czechia'                  THEN 'CZ'
  WHEN 'hungary'                  THEN 'HU'
  WHEN 'greece'                   THEN 'GR'
  WHEN 'new zealand'              THEN 'NZ'
  WHEN 'thailand'                 THEN 'TH'
  WHEN 'malaysia'                 THEN 'MY'
  WHEN 'philippines'              THEN 'PH'
  WHEN 'vietnam'                  THEN 'VN'
  WHEN 'luxembourg'               THEN 'LU'
  WHEN 'iceland'                  THEN 'IS'
  WHEN 'unknown'                  THEN NULL
  ELSE originator_country
END
WHERE originator_country IS NOT NULL
  AND originator_country !~ '^[A-Z]{2}$';

-- Lower-case ISO codes that slipped through (e.g. 'ch', 'gb') → upper-case.
UPDATE clinical_assets
SET originator_country = upper(originator_country)
WHERE originator_country ~ '^[a-z]{2}$';

-- 'UK' is not ISO; canonical is GB.
UPDATE clinical_assets SET originator_country = 'GB' WHERE originator_country = 'UK';

-- 3b. Region: wherever the country is a known ISO-2 code, derive the region
--     slug from it (this also repairs label-form regions such as 'Europe' and
--     mismatches such as region 'Asia' for a JP company).
UPDATE clinical_assets
SET originator_region = CASE originator_country
  WHEN 'US' THEN 'north_america' WHEN 'CA' THEN 'north_america'
  WHEN 'GB' THEN 'europe' WHEN 'DE' THEN 'europe' WHEN 'FR' THEN 'europe'
  WHEN 'CH' THEN 'europe' WHEN 'NL' THEN 'europe' WHEN 'BE' THEN 'europe'
  WHEN 'DK' THEN 'europe' WHEN 'SE' THEN 'europe' WHEN 'NO' THEN 'europe'
  WHEN 'FI' THEN 'europe' WHEN 'IE' THEN 'europe' WHEN 'IT' THEN 'europe'
  WHEN 'ES' THEN 'europe' WHEN 'AT' THEN 'europe' WHEN 'PT' THEN 'europe'
  WHEN 'LU' THEN 'europe' WHEN 'IS' THEN 'europe' WHEN 'CZ' THEN 'europe'
  WHEN 'PL' THEN 'europe' WHEN 'HU' THEN 'europe' WHEN 'GR' THEN 'europe'
  WHEN 'RO' THEN 'europe' WHEN 'BG' THEN 'europe' WHEN 'HR' THEN 'europe'
  WHEN 'SI' THEN 'europe' WHEN 'SK' THEN 'europe' WHEN 'LT' THEN 'europe'
  WHEN 'LV' THEN 'europe' WHEN 'EE' THEN 'europe'
  WHEN 'CN' THEN 'china' WHEN 'HK' THEN 'china' WHEN 'MO' THEN 'china'
  WHEN 'TW' THEN 'asia_pacific'
  WHEN 'JP' THEN 'japan'
  WHEN 'KR' THEN 'south_korea'
  WHEN 'IL' THEN 'israel'
  WHEN 'IN' THEN 'asia_pacific' WHEN 'SG' THEN 'asia_pacific' WHEN 'AU' THEN 'asia_pacific'
  WHEN 'NZ' THEN 'asia_pacific' WHEN 'TH' THEN 'asia_pacific' WHEN 'MY' THEN 'asia_pacific'
  WHEN 'ID' THEN 'asia_pacific' WHEN 'PH' THEN 'asia_pacific' WHEN 'VN' THEN 'asia_pacific'
  WHEN 'SA' THEN 'middle_east' WHEN 'AE' THEN 'middle_east' WHEN 'QA' THEN 'middle_east'
  WHEN 'KW' THEN 'middle_east' WHEN 'BH' THEN 'middle_east' WHEN 'OM' THEN 'middle_east'
  WHEN 'JO' THEN 'middle_east' WHEN 'TR' THEN 'middle_east'
  WHEN 'BR' THEN 'latin_america' WHEN 'MX' THEN 'latin_america' WHEN 'AR' THEN 'latin_america'
  WHEN 'CL' THEN 'latin_america' WHEN 'CO' THEN 'latin_america' WHEN 'PE' THEN 'latin_america'
  WHEN 'ZA' THEN 'africa' WHEN 'EG' THEN 'africa' WHEN 'NG' THEN 'africa'
  WHEN 'KE' THEN 'africa' WHEN 'MA' THEN 'africa'
  ELSE originator_region
END
WHERE originator_country ~ '^[A-Z]{2}$';

-- 3c. Remaining label-form regions (rows whose country is NULL/unrecognized)
UPDATE clinical_assets
SET originator_region = CASE lower(trim(originator_region))
  WHEN 'north america'  THEN 'north_america'
  WHEN 'europe'         THEN 'europe'
  WHEN 'china'          THEN 'china'
  WHEN 'japan'          THEN 'japan'
  WHEN 'south korea'    THEN 'south_korea'
  WHEN 'korea'          THEN 'south_korea'
  WHEN 'israel'         THEN 'israel'
  WHEN 'asia'           THEN 'asia_pacific'
  WHEN 'asia pacific'   THEN 'asia_pacific'
  WHEN 'asia-pacific'   THEN 'asia_pacific'
  WHEN 'apac'           THEN 'asia_pacific'
  WHEN 'middle east'    THEN 'middle_east'
  WHEN 'latin america'  THEN 'latin_america'
  WHEN 'latam'          THEN 'latin_america'
  WHEN 'africa'         THEN 'africa'
  WHEN 'unknown'        THEN NULL
  ELSE originator_region
END
WHERE originator_region IS NOT NULL
  AND originator_region !~ '^[a-z_]+$';

-- Index to support the upcoming geography filter in the Radar UI.
CREATE INDEX IF NOT EXISTS idx_clinical_assets_origin_country
  ON clinical_assets (originator_country) WHERE originator_country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_assets_origin_region
  ON clinical_assets (originator_region) WHERE originator_region IS NOT NULL;
