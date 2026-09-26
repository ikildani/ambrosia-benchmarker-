-- Migration 125 — uniqueness only among real rows.
-- Superseded duplicates (is_synthetic = true, duplicate_of set) keep their names and values for
-- lineage and must not block the surviving row. unique_deal was a table constraint (cannot be
-- partial), so it is dropped and re-created as a partial unique index.
ALTER TABLE deals DROP CONSTRAINT IF EXISTS unique_deal;
DROP INDEX IF EXISTS unique_deal;
DROP INDEX IF EXISTS idx_deals_dedup;
CREATE UNIQUE INDEX idx_deals_dedup ON public.deals USING btree (lower(TRIM(BOTH FROM licensor_name)), lower(TRIM(BOTH FROM licensee_name)), COALESCE((total_deal_value_usd)::text, 'null_value'::text))
  WHERE licensor_name IS NOT NULL AND licensee_name IS NOT NULL AND COALESCE(is_synthetic, false) = false;
CREATE UNIQUE INDEX unique_deal ON public.deals USING btree (licensor_name, licensee_name, asset_name, announced_date)
  WHERE COALESCE(is_synthetic, false) = false;
