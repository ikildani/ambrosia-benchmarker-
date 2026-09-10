-- radar_companies_to_index timed out once the CT.gov sweep created ~24k
-- sponsor companies: ORDER BY (assets_indexed_at, id) with LIMIT could not
-- stop early because the presorted index only covered assets_indexed_at, so
-- the whole NULL group (every never-indexed company) was semi-joined before
-- the sort. A composite index lets the plan stream in order and stop at the
-- limit. Also skips CRO rows (they never own assets) and caps the function's
-- own statement_timeout so a slow plan degrades instead of hanging the cron.

CREATE INDEX IF NOT EXISTS idx_companies_assets_indexed_at_id
  ON companies (assets_indexed_at ASC NULLS FIRST, id ASC);

CREATE INDEX IF NOT EXISTS idx_company_trials_company_drug
  ON company_trials (company_id)
  WHERE intervention_name IS NOT NULL;

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
)
LANGUAGE sql STABLE
SET statement_timeout = '60s'
AS $$
  SELECT
    c.id, c.name, c.hq_country, c.hq_region,
    c.headquarters_country, c.headquarters_region, c.assets_indexed_at
  FROM companies c
  WHERE COALESCE(c.owner_type, 'unknown') <> 'cro'
    AND EXISTS (
      SELECT 1 FROM company_trials t
      WHERE t.company_id = c.id AND t.intervention_name IS NOT NULL
    )
    AND (p_company_ids IS NULL OR c.id = ANY(p_company_ids))
  ORDER BY c.assets_indexed_at ASC NULLS FIRST, c.id ASC
  LIMIT GREATEST(COALESCE(p_limit, 400), 1);
$$;
