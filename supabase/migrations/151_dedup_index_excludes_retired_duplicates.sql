-- 151: idx_deals_dedup ignores rows already retired as duplicates.
-- Why (Sep 28 2026): the unique index on (licensor, licensee, total) counted retired losers,
-- so correcting a keeper's total to the documented figure was rejected whenever the loser
-- already held that figure (Prothena → Novo, Harpoon → AbbVie during the dedupe review).
-- A row with duplicate_of set is out of every surface (migration 150) and must not block
-- the keeper. unique_deal (licensor, licensee, asset, date) is scoped the same way.
-- Applied to prod via MCP on Sep 28 2026; this file records it.
DROP INDEX IF EXISTS public.idx_deals_dedup;
CREATE UNIQUE INDEX idx_deals_dedup ON public.deals
  USING btree (lower(TRIM(BOTH FROM licensor_name)), lower(TRIM(BOTH FROM licensee_name)), COALESCE((total_deal_value_usd)::text, 'null_value'::text))
  WHERE licensor_name IS NOT NULL AND licensee_name IS NOT NULL AND COALESCE(is_synthetic, false) = false AND duplicate_of IS NULL;
DROP INDEX IF EXISTS public.unique_deal;
CREATE UNIQUE INDEX unique_deal ON public.deals
  USING btree (licensor_name, licensee_name, asset_name, announced_date)
  WHERE COALESCE(is_synthetic, false) = false AND duplicate_of IS NULL;
