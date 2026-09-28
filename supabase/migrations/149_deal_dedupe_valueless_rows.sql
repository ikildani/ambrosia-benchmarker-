-- 149: recompute_deal_dedupe() — value-less rows join the group of their valued twin.
--
-- Why (Sep 28 2026): the dedupe key is party roots + a log-banded upfront (or total
-- value). A row with no economics gets the '|x' band, so a Perplexity discovery row
-- for "Pfizer × Company A, 2026-09-10, terms undisclosed" sits in a different group
-- from the 8-K row for the same deal that carries the $50M upfront. Both rows are then
-- rank-1 in their own group, both canonical, and the deal is counted twice.
-- Measured before this migration: 611 value-less rows, 75 of them with a valued row
-- for the same parties within 45 days in another group; 45 of the Perplexity rows
-- inserted Sep 26-28 were double-counted this way.
--
-- Fix: after computing the natural key, a value-less row whose party roots match a
-- valued row announced within 45 days adopts that row's group (nearest date wins).
-- Rank-1 selection then picks the valued, verified, cited row as canonical via
-- deal_quality_score(). Everything else (provenance tier, quiet writes from
-- migration 139) is unchanged. Rows are written only when the value changes.
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
    -- value-less row → nearest valued row with the same party roots within 45 days
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
  final_key AS (
    SELECT n.id, coalesce(a.new_group, n.new_group) AS new_group
    FROM natural_key n LEFT JOIN adopted a ON a.id = n.id
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
    SELECT id, row_number() OVER (
      PARTITION BY dedupe_group_id
      ORDER BY deal_quality_score(deals.*) DESC, announced_date ASC NULLS LAST, id ASC
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
