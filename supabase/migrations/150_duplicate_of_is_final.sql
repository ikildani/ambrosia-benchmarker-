-- 150: a row with duplicate_of set is never canonical and never on a product surface.
-- Why (Sep 28 2026): recompute_deal_dedupe() ranks rows inside their dedupe group, so a
-- reviewed duplicate that sits in a different group from its keeper was re-promoted to
-- canonical on the next run, and deals_verified did not check duplicate_of at all.
-- Applied to prod via MCP on Sep 28 2026; this file records it.
CREATE OR REPLACE VIEW public.deals_verified
WITH (security_invoker = true) AS
SELECT *
FROM public.deals
WHERE is_synthetic = false
  AND is_canonical IS NOT FALSE
  AND duplicate_of IS NULL
  AND coalesce(verification_status, '') NOT IN ('rejected', 'flagged');

CREATE OR REPLACE FUNCTION public.recompute_deal_dedupe()
 RETURNS TABLE(rows_processed integer, groups_found integer, duplicate_rows integer, tier_a integer, tier_b integer, tier_c integer, tier_d integer)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  WITH keyed AS (
    SELECT id, announced_date,
      deal_party_root(licensor_name) AS lr,
      deal_party_root(licensee_name) AS er,
      CASE
        WHEN upfront_usd IS NOT NULL AND upfront_usd > 0 THEN 'u' || round(ln(upfront_usd) / ln(1.5))::TEXT
        WHEN total_deal_value_usd IS NOT NULL AND total_deal_value_usd > 0 THEN 't' || round(ln(total_deal_value_usd) / ln(1.5))::TEXT
        ELSE 'x'
      END AS band
    FROM deals
  ),
  natural_key AS (
    SELECT id, announced_date, lr, er, band, lr || '|' || er || '|' || band AS new_group FROM keyed
  ),
  adopted AS (
    SELECT DISTINCT ON (x.id) x.id, v.new_group
    FROM natural_key x
    JOIN natural_key v
      ON v.band <> 'x'
     AND v.lr = x.lr AND v.er = x.er
     AND x.announced_date IS NOT NULL AND v.announced_date IS NOT NULL
     AND abs(v.announced_date - x.announced_date) <= 45
    WHERE x.band = 'x'
    ORDER BY x.id, abs(v.announced_date - x.announced_date), v.new_group
  ),
  reviewed AS (
    SELECT d.id, k.dedupe_group_id AS new_group
    FROM deals d JOIN deals k ON k.id = d.duplicate_of
    WHERE d.duplicate_of IS NOT NULL AND k.dedupe_group_id IS NOT NULL
  ),
  final_key AS (
    SELECT n.id, coalesce(r.new_group, a.new_group, n.new_group) AS new_group
    FROM natural_key n LEFT JOIN adopted a ON a.id = n.id LEFT JOIN reviewed r ON r.id = n.id
  )
  UPDATE deals d SET dedupe_group_id = f.new_group
  FROM final_key f
  WHERE f.id = d.id AND d.dedupe_group_id IS DISTINCT FROM f.new_group;

  UPDATE deals d SET provenance_tier = t.new_tier
  FROM (
    SELECT id, CASE
      WHEN NOT coalesce(terms_disclosed, false) THEN 'D'
      WHEN verification_status = 'verified' AND coalesce(source_url, press_release_url) IS NOT NULL THEN 'A'
      WHEN verification_status = 'verified' THEN 'B'
      ELSE 'C' END AS new_tier
    FROM deals
  ) t
  WHERE t.id = d.id AND d.provenance_tier IS DISTINCT FROM t.new_tier;

  WITH ranked AS (
    SELECT id, (duplicate_of IS NULL) AND row_number() OVER (
      PARTITION BY dedupe_group_id
      ORDER BY (duplicate_of IS NULL) DESC, deal_quality_score(deals.*) DESC, announced_date ASC NULLS LAST, id ASC
    ) = 1 AS should_be_canonical
    FROM deals
  )
  UPDATE deals d SET is_canonical = r.should_be_canonical
  FROM ranked r
  WHERE r.id = d.id AND d.is_canonical IS DISTINCT FROM r.should_be_canonical;

  RETURN QUERY SELECT
    (SELECT count(*)::INT FROM deals),
    (SELECT count(DISTINCT dedupe_group_id)::INT FROM deals),
    (SELECT count(*)::INT FROM deals WHERE NOT is_canonical),
    (SELECT count(*)::INT FROM deals WHERE provenance_tier='A'),
    (SELECT count(*)::INT FROM deals WHERE provenance_tier='B'),
    (SELECT count(*)::INT FROM deals WHERE provenance_tier='C'),
    (SELECT count(*)::INT FROM deals WHERE provenance_tier='D');
END $function$;
