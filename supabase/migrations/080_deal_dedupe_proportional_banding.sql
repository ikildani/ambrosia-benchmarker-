-- Migration 080 — proportional value banding for the dedupe key (R79b)
--
-- 079 keyed on coalesce(total_deal_value_usd, upfront_usd * 8) in fixed $250M
-- buckets. Two failures showed up on known duplicate clusters:
--   * the *8 fallback fabricates a value, so a row missing total_deal_value_usd
--     landed in a different bucket from its own duplicate (3SBio/Pfizer split
--     5 rows across 2 groups; Hengrui/BMS split 6 across 3)
--   * fixed-width buckets are brittle at large values, where sources routinely
--     disagree by 2-5% ($6.2B vs $6.35B for the same transaction)
--
-- upfront_usd is the more consistently reported and more stable figure across
-- sources, so it becomes the primary key. Rows with no upfront cannot be
-- value-matched and are grouped separately rather than guessed at. 1.5x
-- proportional banding tolerates the disagreement real sources exhibit.

CREATE OR REPLACE FUNCTION recompute_deal_dedupe() RETURNS TABLE(
  rows_processed INT, groups_found INT, duplicate_rows INT,
  tier_a INT, tier_b INT, tier_c INT, tier_d INT
) LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE deals d SET dedupe_group_id =
    deal_party_root(d.licensor_name) || '|' || deal_party_root(d.licensee_name) || '|' ||
    CASE
      WHEN d.upfront_usd IS NOT NULL AND d.upfront_usd > 0
        THEN 'u' || round(ln(d.upfront_usd) / ln(1.5))::TEXT
      WHEN d.total_deal_value_usd IS NOT NULL AND d.total_deal_value_usd > 0
        THEN 't' || round(ln(d.total_deal_value_usd) / ln(1.5))::TEXT
      ELSE 'x'
    END;

  UPDATE deals d SET provenance_tier = CASE
    WHEN NOT coalesce(d.terms_disclosed, false) THEN 'D'
    WHEN d.verification_status = 'verified'
      AND coalesce(d.source_url, d.press_release_url) IS NOT NULL THEN 'A'
    WHEN d.verification_status = 'verified' THEN 'B'
    ELSE 'C' END;

  UPDATE deals SET is_canonical = false WHERE is_canonical;

  UPDATE deals d SET is_canonical = true
  FROM (
    SELECT id, row_number() OVER (
      PARTITION BY dedupe_group_id
      ORDER BY deal_quality_score(deals.*) DESC, announced_date ASC NULLS LAST, id ASC
    ) rn
    FROM deals
  ) ranked
  WHERE ranked.id = d.id AND ranked.rn = 1;

  RETURN QUERY SELECT
    (SELECT count(*)::INT FROM deals),
    (SELECT count(DISTINCT dedupe_group_id)::INT FROM deals),
    (SELECT count(*)::INT FROM deals WHERE NOT is_canonical),
    (SELECT count(*)::INT FROM deals WHERE provenance_tier='A'),
    (SELECT count(*)::INT FROM deals WHERE provenance_tier='B'),
    (SELECT count(*)::INT FROM deals WHERE provenance_tier='C'),
    (SELECT count(*)::INT FROM deals WHERE provenance_tier='D');
END $fn$;
