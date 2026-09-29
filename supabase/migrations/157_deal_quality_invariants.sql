-- 157: deal_quality_invariants() — slippage checks on the public set; every count should be 0.
-- Printed at the top of the daily deal-data email (lib/ingestion/flag-fix-report.ts); a failing check
-- puts "QUALITY CHECK FAILING" in the subject. Applied to prod via MCP on Sep 29 2026 (all 9 at 0).
CREATE OR REPLACE FUNCTION public.deal_quality_invariants()
RETURNS TABLE(check_name text, violations bigint, sample_ids text)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH v AS MATERIALIZED (
    SELECT id, licensor_id, licensee_id, licensor_name, licensee_name, announced_date, upfront_usd, total_deal_value_usd,
           royalty_high_pct, source_url, press_release_url, source_filing_id, verification_notes,
           deal_party_root(licensor_name) lr, deal_party_root(licensee_name) er
    FROM deals_verified),
  k AS MATERIALIZED (
    SELECT id, announced_date, verification_notes, least(lr, er) p1, greatest(lr, er) p2 FROM v WHERE announced_date IS NOT NULL),
  dup AS (
    SELECT a.id::text a_id, b.id::text b_id FROM k a JOIN k b
      ON a.p1 = b.p1 AND a.p2 = b.p2 AND a.id < b.id
     AND abs(a.announced_date - b.announced_date) <= 45
     AND coalesce(a.verification_notes,'') NOT LIKE '%distinct from ' || b.id || '%'
     AND coalesce(b.verification_notes,'') NOT LIKE '%distinct from ' || a.id || '%'),
  cnt AS MATERIALIZED (
    SELECT cid, count(*) n FROM (
      SELECT licensor_id cid, id FROM v WHERE announced_date > now() - interval '12 months' AND announced_date <= current_date AND licensor_id IS NOT NULL
      UNION SELECT licensee_id, id FROM v WHERE announced_date > now() - interval '12 months' AND announced_date <= current_date AND licensee_id IS NOT NULL) s
    GROUP BY cid),
  co AS (
    SELECT c.id FROM companies c LEFT JOIN cnt ON cnt.cid = c.id
    WHERE c.merged_into IS NULL AND NOT EXISTS (SELECT 1 FROM companies m WHERE m.merged_into = c.id)
      AND coalesce(c.deals_last_12mo, 0) <> coalesce(cnt.n, 0))
  SELECT 'duplicate_pairs_45d'::text, count(*), string_agg(a_id || '/' || b_id, ' ') FROM (SELECT * FROM dup LIMIT 200) d
  UNION ALL SELECT 'upfront_exceeds_total', count(*), string_agg(id::text, ' ') FROM (SELECT id FROM v WHERE upfront_usd > total_deal_value_usd * 1.05 LIMIT 50) x
  UNION ALL SELECT 'future_announced_date', count(*), string_agg(id::text, ' ') FROM (SELECT id FROM v WHERE announced_date > current_date LIMIT 50) x
  UNION ALL SELECT 'url_in_filing_id', count(*), string_agg(id::text, ' ') FROM (SELECT id FROM v WHERE source_filing_id ~* '^https?://' LIMIT 50) x
  UNION ALL SELECT 'no_citation', count(*), string_agg(id::text, ' ') FROM (SELECT id FROM v WHERE source_url IS NULL AND press_release_url IS NULL AND source_filing_id IS NULL LIMIT 50) x
  UNION ALL SELECT 'missing_party', count(*), string_agg(id::text, ' ') FROM (SELECT id FROM v WHERE coalesce(trim(licensor_name),'') = '' OR coalesce(trim(licensee_name),'') = '' LIMIT 50) x
  UNION ALL SELECT 'same_party_both_sides', count(*), string_agg(id::text, ' ') FROM (SELECT id FROM v WHERE lr = er AND lr <> '' AND coalesce(verification_notes,'') NOT LIKE '%same-party reviewed%' LIMIT 50) x
  UNION ALL SELECT 'royalty_over_50pct', count(*), string_agg(id::text, ' ') FROM (SELECT id FROM v WHERE royalty_high_pct > 50 LIMIT 50) x
  UNION ALL SELECT 'company_count_stale', count(*), string_agg(id::text, ' ') FROM (SELECT id FROM co LIMIT 50) x;
$function$;
GRANT EXECUTE ON FUNCTION public.deal_quality_invariants() TO service_role;
