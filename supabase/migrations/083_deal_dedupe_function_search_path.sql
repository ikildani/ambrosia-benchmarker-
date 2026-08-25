-- Migration 083 — pin search_path on the R79 functions (R79e)
--
-- The database linter flags function_search_path_mutable on every function in
-- this schema. Pre-existing ones are out of scope here, but the three added by
-- R79 should not extend the problem: a mutable search_path lets a caller with
-- CREATE on any schema in the path shadow a referenced object.
ALTER FUNCTION deal_party_root(TEXT)      SET search_path = public, pg_temp;
ALTER FUNCTION deal_quality_score(deals)  SET search_path = public, pg_temp;
ALTER FUNCTION recompute_deal_dedupe()    SET search_path = public, pg_temp;
