-- 177: company deal stats follow deals ageing out of the 12-month window.
--
-- Why (Nov 3 2026): deals_last_12mo is recomputed only when a deal row changes (trigger,
-- migration 146), so a company whose last deal turned 12 months old kept counting it.
-- deal_quality_invariants() showed 29 such companies (company_count_stale).
--
-- refresh_aged_company_deal_stats() recomputes every company with a verified deal that left
-- the window in the last p_days, plus any unmerged company whose stored count no longer
-- matches deals_verified (the invariant's own test). pg_cron runs it daily at 04:10 UTC.

CREATE OR REPLACE FUNCTION public.refresh_aged_company_deal_stats(p_days int DEFAULT 3)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
  v_n int := 0;
BEGIN
  FOR v_id IN
    WITH aged AS (
      SELECT unnest(ARRAY[licensor_id, licensee_id]) cid FROM deals_verified
      WHERE announced_date <= now() - interval '12 months'
        AND announced_date > now() - interval '12 months' - make_interval(days => greatest(p_days, 1))),
    cnt AS MATERIALIZED (
      SELECT cid, count(*) n FROM (
        SELECT licensor_id cid, id FROM deals_verified WHERE announced_date > now() - interval '12 months' AND announced_date <= current_date AND licensor_id IS NOT NULL
        UNION SELECT licensee_id, id FROM deals_verified WHERE announced_date > now() - interval '12 months' AND announced_date <= current_date AND licensee_id IS NOT NULL) s
      GROUP BY cid),
    stale AS (
      SELECT c.id cid FROM companies c LEFT JOIN cnt ON cnt.cid = c.id
      WHERE c.merged_into IS NULL AND NOT EXISTS (SELECT 1 FROM companies m WHERE m.merged_into = c.id)
        AND coalesce(c.deals_last_12mo, 0) <> coalesce(cnt.n, 0))
    SELECT DISTINCT cid FROM (SELECT cid FROM aged UNION SELECT cid FROM stale) x WHERE cid IS NOT NULL
  LOOP
    PERFORM refresh_company_deal_stats(v_id);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_aged_company_deal_stats(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_aged_company_deal_stats(int) TO service_role;

SELECT cron.unschedule('company-stats-age-out') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'company-stats-age-out');
SELECT cron.schedule('company-stats-age-out', '10 4 * * *', $$SELECT public.refresh_aged_company_deal_stats(3)$$);
