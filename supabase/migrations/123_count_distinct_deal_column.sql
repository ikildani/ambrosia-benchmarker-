-- Migration 123 — helper for live public stats: distinct count of a whitelisted deals column
-- over real rows, excluding 'other' and internal rotation labels ('_mega_deals' etc.).
-- Used by lib/deal-stats.ts (methodology page, embed widget). Reversal: DROP FUNCTION.
CREATE OR REPLACE FUNCTION count_distinct_deal_column(p_column text)
RETURNS integer LANGUAGE plpgsql STABLE AS $$
DECLARE n integer;
BEGIN
  IF p_column NOT IN ('therapeutic_area', 'source_type', 'licensor_country', 'licensee_country', 'modality', 'deal_type') THEN
    RAISE EXCEPTION 'column % not allowed', p_column;
  END IF;
  EXECUTE format(
    'SELECT count(DISTINCT %I) FROM deals WHERE is_synthetic = false AND %I IS NOT NULL AND %I <> ''other'' AND %I NOT LIKE ''\_%%''',
    p_column, p_column, p_column, p_column
  ) INTO n;
  RETURN n;
END $$;
