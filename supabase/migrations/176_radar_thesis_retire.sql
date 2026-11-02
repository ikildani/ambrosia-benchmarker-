-- 176: Retire deal theses whose asset has left radar_thesis_eligible_assets.
--
-- The deal-thesis cron only regenerates eligible assets, and nothing removed a thesis once its
-- asset stopped qualifying. On 2026-11-02 there were 9,964 such theses, none touched since the
-- 2026-10-28 terms fix, and 5,735 of them still priced the asset off acquisition comps. The asset
-- page (lib/radar/narrative.ts) and compare view read a thesis for any asset id, so users saw them.
-- Most (8,296) were sponsors' trials of another company's marketed drug (ownership marketed_other
-- since the drug identity fix), where a licensing estimate means nothing.
--
-- radar_retire_ineligible_theses() moves those rows into radar_deal_theses_retired (full row as
-- jsonb) and deletes them. The deal-thesis cron calls it every run. An asset that becomes eligible
-- again is queued as 'never' and regenerated (thesis generation makes no AI calls).
-- Restore one: insert the row back from radar_deal_theses_retired.thesis.

CREATE TABLE IF NOT EXISTS radar_deal_theses_retired (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_id    uuid NOT NULL,
  retired_at  timestamptz NOT NULL DEFAULT now(),
  reason      text NOT NULL,
  thesis      jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_radar_deal_theses_retired_asset ON radar_deal_theses_retired (asset_id);
ALTER TABLE radar_deal_theses_retired ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION radar_retire_ineligible_theses(p_limit integer DEFAULT 20000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
DECLARE
  v_n integer;
BEGIN
  WITH gone AS (
    SELECT t.asset_id
    FROM radar_deal_theses t
    WHERE NOT EXISTS (SELECT 1 FROM radar_thesis_eligible_assets e WHERE e.id = t.asset_id)
    LIMIT p_limit
  ),
  del AS (
    DELETE FROM radar_deal_theses t
    USING gone g
    WHERE t.asset_id = g.asset_id
    RETURNING t.*
  )
  INSERT INTO radar_deal_theses_retired (asset_id, reason, thesis)
  SELECT del.asset_id, 'ineligible', to_jsonb(del) FROM del;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION radar_retire_ineligible_theses(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION radar_retire_ineligible_theses(integer) TO service_role;
