-- Migration 139 — a verifier attempt stamp, and a recompute that only writes what changes
--
-- 1. deals.verify_attempted_at: when the verifier last tried this row, whether
--    or not the verdict could be saved. The pick queries use it to move on from
--    rows whose verdict the database refused (citation rule), and the flagged
--    retry timer uses it instead of updated_at.
-- 2. recompute_deal_dedupe(): the previous body updated every row on every
--    call (dedupe_group_id, provenance_tier, is_canonical), which bumped
--    updated_at on the whole table each time and broke every "untouched for N
--    hours" rule. It now writes only rows whose value actually changes.

ALTER TABLE deals ADD COLUMN IF NOT EXISTS verify_attempted_at timestamptz;
CREATE INDEX IF NOT EXISTS deals_verify_attempted_idx ON deals (verification_status, verify_attempted_at);

CREATE OR REPLACE FUNCTION public.recompute_deal_dedupe()
 RETURNS TABLE(rows_processed integer, groups_found integer, duplicate_rows integer, tier_a integer, tier_b integer, tier_c integer, tier_d integer)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE deals d SET dedupe_group_id = g.new_group
  FROM (
    SELECT id,
      deal_party_root(licensor_name) || '|' || deal_party_root(licensee_name) || '|' ||
      CASE
        WHEN upfront_usd IS NOT NULL AND upfront_usd > 0 THEN 'u' || round(ln(upfront_usd) / ln(1.5))::TEXT
        WHEN total_deal_value_usd IS NOT NULL AND total_deal_value_usd > 0 THEN 't' || round(ln(total_deal_value_usd) / ln(1.5))::TEXT
        ELSE 'x'
      END AS new_group
    FROM deals
  ) g
  WHERE g.id = d.id AND d.dedupe_group_id IS DISTINCT FROM g.new_group;

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
