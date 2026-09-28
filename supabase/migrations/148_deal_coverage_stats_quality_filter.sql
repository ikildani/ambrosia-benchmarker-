-- 148: deal_coverage_stats() reads the same quality-filtered set as the headline count.
--
-- Why (Sep 28 2026): the home page said "1,400+ primary-sourced deals" in the hero
-- (lib/deal-stats.ts, reading deals_verified since migration 147) while the coverage
-- panel directly below said "1,900+" (this function, reading the raw deals table minus
-- synthetic rows). The 500-row gap is duplicate (is_canonical = false), rejected and
-- flagged rows that the hero excludes and this function did not.
--
-- One rule everywhere (migration 147): no synthetic, non-canonical, rejected or flagged
-- rows on any public surface. The CTE now selects FROM deals_verified so both numbers
-- move together. Everything else about the function is unchanged.
CREATE OR REPLACE FUNCTION public.deal_coverage_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  WITH r AS (
    SELECT *,
      (source_filing_id IS NOT NULL OR press_release_url IS NOT NULL
       OR (source_url IS NOT NULL AND source_type IN ('sec_8k','sec_6k','sec_10k','sec_10q','hkex','tdnet','asx','cninfo','mfn','dart','press_release'))) AS is_primary
    FROM public.deals_verified),
  parties AS (
    SELECT licensor_id AS id FROM r WHERE is_primary AND licensor_id IS NOT NULL
    UNION SELECT licensee_id FROM r WHERE is_primary AND licensee_id IS NOT NULL)
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM r),
    'primary', (SELECT count(*) FROM r WHERE is_primary),
    'verified', (SELECT count(*) FROM r WHERE verification_status = 'verified'),
    'primary_verified', (SELECT count(*) FROM r WHERE is_primary AND verification_status = 'verified'),
    'cited', (SELECT count(*) FROM r WHERE source_url IS NOT NULL OR press_release_url IS NOT NULL OR source_filing_id IS NOT NULL),
    'backlog', (SELECT count(*) FROM r WHERE NOT is_primary),
    'by_ta', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT therapeutic_area k, count(*) v FROM r WHERE is_primary AND therapeutic_area IS NOT NULL AND therapeutic_area <> 'other' AND therapeutic_area NOT LIKE '\_%' GROUP BY 1) t),
    'by_ta_verified', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT therapeutic_area k, count(*) v FROM r WHERE is_primary AND verification_status = 'verified' AND therapeutic_area IS NOT NULL AND therapeutic_area <> 'other' AND therapeutic_area NOT LIKE '\_%' GROUP BY 1) t),
    'by_ta_all', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT therapeutic_area k, count(*) v FROM r WHERE therapeutic_area IS NOT NULL AND therapeutic_area <> 'other' AND therapeutic_area NOT LIKE '\_%' GROUP BY 1) t),
    'by_phase', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT coalesce(phase_at_signing, 'unknown') k, count(*) v FROM r WHERE is_primary GROUP BY 1) t),
    'by_type', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT coalesce(deal_type, 'other') k, count(*) v FROM r WHERE is_primary GROUP BY 1) t),
    'by_year', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT extract(year FROM announced_date)::int k, count(*) v FROM r WHERE is_primary AND announced_date >= '2010-01-01' GROUP BY 1) t),
    'by_region', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT coalesce(licensor_region, 'unknown') k, count(*) v FROM r WHERE is_primary GROUP BY 1) t),
    'by_company_type', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (SELECT coalesce(c.company_type, 'unclassified') k, count(*) v FROM parties p JOIN companies c ON c.id = p.id GROUP BY 1) t),
    'companies', (SELECT count(*) FROM parties),
    'source_types', (SELECT count(DISTINCT source_type) FROM r WHERE is_primary AND source_type IS NOT NULL),
    'countries', (SELECT count(DISTINCT c) FROM (SELECT licensor_country c FROM r WHERE licensor_country IS NOT NULL UNION SELECT licensee_country FROM r WHERE licensee_country IS NOT NULL) u),
    'last_added_at', (SELECT max(created_at) FROM r)
  );
$function$;

COMMENT ON FUNCTION public.deal_coverage_stats() IS
  'Public coverage panel numbers. Reads deals_verified (migration 147) so the panel and the headline count share one definition; primary = filing id, issuer release URL, or URL from a primary pipeline.';
