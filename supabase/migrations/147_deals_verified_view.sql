-- 147: deals_verified — the one definition of a deal that may appear on a product surface.
--
-- Why (Sep 28 2026): the quality filter was repeated by hand on every read path
-- (applyDealQualityFilter, inline .eq/.not chains, SQL functions). Surfaces that forgot
-- it leaked rejected, flagged, duplicate and synthetic rows into alerts, Market Pulse,
-- company pages and the headline count. Public reads now go through this view; the
-- base table stays for ingestion, admin and dedupe work.
--
-- Rule (same as migration 146 and applyDealQualityFilter):
--   is_synthetic = false AND is_canonical IS NOT FALSE
--   AND coalesce(verification_status,'') NOT IN ('rejected','flagged')
--
-- security_invoker: callers see exactly the rows deals' RLS would give them.
-- SELECT * binds the column list at creation. After adding a column to deals, re-run
-- this CREATE OR REPLACE so the view picks it up.
CREATE OR REPLACE VIEW public.deals_verified
WITH (security_invoker = true) AS
SELECT *
FROM public.deals
WHERE is_synthetic = false
  AND is_canonical IS NOT FALSE
  AND coalesce(verification_status, '') NOT IN ('rejected', 'flagged');

COMMENT ON VIEW public.deals_verified IS
  'Quality-filtered deals: no synthetic, duplicate (non-canonical), rejected or flagged rows. Read product surfaces from here, not from deals.';

GRANT SELECT ON public.deals_verified TO anon, authenticated, service_role;
