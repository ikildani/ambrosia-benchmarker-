-- Migration 082 — re-derive dedupe columns after 080/081 (R79d)
--
-- Touches only the three derived columns added in 079. No source data changes.
SELECT recompute_deal_dedupe();
