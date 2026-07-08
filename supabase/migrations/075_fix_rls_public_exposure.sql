-- SECURITY FIX: Close unauthenticated access to user_profiles and 9 internal tables
--
-- Root cause: Policies named "Service role full access" were granted to {public}
-- instead of {service_role}, and user_profiles had "Enable read access for all users"
-- with USING(true). This exposed PII (emails) and internal data to the anon key.
--
-- CVE: CVSS 6.5 — unauthenticated read of user_profiles.email (60 records)
-- Applied live: 2026-07-08

-- 1. user_profiles: replace open SELECT with auth-scoped SELECT
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
CREATE POLICY IF NOT EXISTS "Users read own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "Service role full access"
  ON public.user_profiles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2-9. Fix "Service role" policies that were mis-granted to {public}
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'backlink_outreach',
      'competitor_content',
      'deal_completeness_audits',
      'report_views',
      'research_signals',
      'seo_content_log',
      'seo_metrics',
      'seo_optimization_log',
      'seo_overrides'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access on %I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY "Service role full access on %I" ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      tbl, tbl
    );
  END LOOP;
END $$;
