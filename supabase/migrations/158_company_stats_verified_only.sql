-- 158: update_company_deal_stats uses the same rule as deals_verified (migration 156): verified rows only.
-- Applied to prod via MCP on Sep 29 2026, all deal-party companies recomputed (company_count_stale = 0).
DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.update_company_deal_stats(uuid)'::regprocedure);
  def := replace(def, $q$AND coalesce(d.verification_status, '') NOT IN ('rejected', 'flagged')$q$, $q$AND d.verification_status = 'verified'$q$);
  EXECUTE def;
END $$;
