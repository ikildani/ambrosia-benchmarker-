-- 153: coverage by year × therapeutic area, measured against announcements we have seen.
-- Numerator: primary-sourced rows in deals_verified. Denominator: deal announcements the gates
-- accepted (press_releases.is_deal_announcement, RSS and newswire archive) plus the primary rows.
-- Until the wire archive has walked a year, the denominator undercounts the market.
-- Applied to prod via MCP on Sep 28 2026; this file records it.
CREATE OR REPLACE FUNCTION public.deal_coverage_by_year(p_from int DEFAULT 2011, p_to int DEFAULT extract(year from now())::int)
RETURNS TABLE(yr int, therapeutic_area text, primary_public bigint, announcements_seen bigint, wire_archive_seen bigint, coverage_pct numeric)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH prim AS (
    SELECT id, extract(year FROM announced_date)::int AS yr, coalesce(therapeutic_area, 'unknown') AS ta
    FROM deals_verified
    WHERE announced_date IS NOT NULL
      AND (source_filing_id IS NOT NULL OR press_release_url IS NOT NULL
           OR (source_url IS NOT NULL AND source_type IN ('sec_8k','sec_6k','sec_10k','sec_10q','hkex','tdnet','asx','cninfo','mfn','dart','press_release')))
  ),
  wire AS (
    SELECT extract(year FROM pr.published_at)::int AS yr,
           coalesce(d.therapeutic_area, 'unknown') AS ta,
           coalesce(d.duplicate_of::text, d.id::text, pr.source_url) AS k,
           (pr.feed LIKE 'archive:%') AS archive
    FROM press_releases pr
    LEFT JOIN deals d ON d.id = pr.deal_id
    WHERE pr.is_deal_announcement IS TRUE AND pr.published_at IS NOT NULL
  ),
  seen AS (
    SELECT yr, ta, k, archive FROM wire
    UNION
    SELECT yr, ta, id::text, false FROM prim
  )
  SELECT s.yr, s.ta,
         count(DISTINCT p.id) AS primary_public,
         count(DISTINCT s.k) AS announcements_seen,
         count(DISTINCT s.k) FILTER (WHERE s.archive) AS wire_archive_seen,
         round(100.0 * count(DISTINCT p.id) / nullif(count(DISTINCT s.k), 0), 1) AS coverage_pct
  FROM seen s
  LEFT JOIN prim p ON p.yr = s.yr AND p.ta = s.ta AND p.id::text = s.k
  WHERE s.yr BETWEEN p_from AND p_to
  GROUP BY s.yr, s.ta
  ORDER BY s.yr DESC, s.ta;
$function$;
GRANT EXECUTE ON FUNCTION public.deal_coverage_by_year(int, int) TO service_role;
