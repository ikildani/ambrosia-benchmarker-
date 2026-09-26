-- Migration 126 — deal_coverage_stats(): one call for the public coverage panel (/api/deals/stats).
-- Totals and breakdowns over real rows (is_synthetic = false): by therapeutic area (all and verified),
-- phase at signing, deal type, year, licensor region; distinct source types and countries.
-- Every number on the panel now shares one definition with the headline count.
CREATE OR REPLACE FUNCTION deal_coverage_stats()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH r AS (SELECT * FROM deals WHERE COALESCE(is_synthetic, false) = false)
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM r),
    'verified', (SELECT count(*) FROM r WHERE verification_status = 'verified'),
    'cited', (SELECT count(*) FROM r WHERE source_url IS NOT NULL OR press_release_url IS NOT NULL OR source_filing_id IS NOT NULL),
    'by_ta', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT therapeutic_area k, count(*) v FROM r WHERE therapeutic_area IS NOT NULL AND therapeutic_area <> 'other' AND therapeutic_area NOT LIKE '\_%' GROUP BY 1) t),
    'by_ta_verified', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT therapeutic_area k, count(*) v FROM r WHERE verification_status = 'verified' AND therapeutic_area IS NOT NULL AND therapeutic_area <> 'other' AND therapeutic_area NOT LIKE '\_%' GROUP BY 1) t),
    'by_phase', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT coalesce(phase_at_signing, 'unknown') k, count(*) v FROM r GROUP BY 1) t),
    'by_type', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT coalesce(deal_type, 'other') k, count(*) v FROM r GROUP BY 1) t),
    'by_year', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT extract(year FROM announced_date)::int k, count(*) v FROM r WHERE announced_date >= '2017-01-01' GROUP BY 1) t),
    'by_region', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT coalesce(licensor_region, 'unknown') k, count(*) v FROM r GROUP BY 1) t),
    'source_types', (SELECT count(DISTINCT source_type) FROM r WHERE source_type IS NOT NULL),
    'countries', (SELECT count(DISTINCT licensor_country) FROM r WHERE licensor_country IS NOT NULL),
    'last_added_at', (SELECT max(created_at) FROM r)
  );
$$;
