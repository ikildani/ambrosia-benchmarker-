-- Migration: 016_security_and_perf.sql
-- Security hardening: RLS fixes, tier escalation prevention, missing indexes

-- =============================================
-- 1. Enable RLS on outreach tables (CRITICAL — currently exposed)
-- =============================================

ALTER TABLE outreach_email_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_emails ENABLE ROW LEVEL SECURITY;

-- Outreach email usage: users read own, service role manages
CREATE POLICY "Users read own usage" ON outreach_email_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages usage" ON outreach_email_usage
  FOR ALL USING (auth.role() = 'service_role');

-- Outreach emails: users read own, service role manages
CREATE POLICY "Users read own emails" ON outreach_emails
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages emails" ON outreach_emails
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- 2. Fix partner_match_results SELECT policy (privacy breach)
--    Current: auth.uid() = user_id OR anonymous_id IS NOT NULL
--    This lets any authenticated user read ALL anonymous rows
-- =============================================

DROP POLICY IF EXISTS "Users read own match results" ON partner_match_results;

CREATE POLICY "Users read own match results" ON partner_match_results
  FOR SELECT USING (auth.uid() = user_id);

-- Service role needs access for anonymous→user linking
CREATE POLICY "Service role manages match results" ON partner_match_results
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- 3. Prevent users from self-escalating tier (CRITICAL — payment bypass)
--    Use a trigger to block direct tier/stripe field changes by non-service-role
-- =============================================

CREATE OR REPLACE FUNCTION prevent_tier_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service_role (webhooks, crons) to update anything
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For regular users, prevent changes to sensitive subscription fields
  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    RAISE EXCEPTION 'Tier cannot be modified directly. Use Stripe checkout.';
  END IF;

  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'Stripe customer ID cannot be modified directly.';
  END IF;

  IF NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
    RAISE EXCEPTION 'Stripe subscription ID cannot be modified directly.';
  END IF;

  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Subscription status cannot be modified directly.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_tier_escalation ON user_profiles;

CREATE TRIGGER trigger_prevent_tier_escalation
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_tier_escalation();

-- =============================================
-- 4. Add missing UPDATE policy for saved_scenarios
-- =============================================

CREATE POLICY "Users can update own scenarios" ON saved_scenarios
  FOR UPDATE USING (
    auth.uid() = user_id OR
    email = current_setting('request.jwt.claims', true)::json->>'email'
  );

-- =============================================
-- 5. Missing indexes for query performance
-- =============================================

-- Auth lookups by email (every login/tier check)
CREATE INDEX IF NOT EXISTS idx_user_profiles_email
  ON user_profiles(email);

-- Weekly snapshot trial date filtering
CREATE INDEX IF NOT EXISTS idx_company_trials_last_update_posted
  ON company_trials(last_update_posted DESC)
  WHERE last_update_posted IS NOT NULL;

-- Most common deals filter combination
CREATE INDEX IF NOT EXISTS idx_deals_ta_modality_date
  ON deals(therapeutic_area, modality, announced_date DESC);

-- Market snapshots composite for upsert conflict resolution
CREATE INDEX IF NOT EXISTS idx_market_snapshots_date_type
  ON market_snapshots(snapshot_date, snapshot_type);

-- Partial index for unlinked deal matching
CREATE INDEX IF NOT EXISTS idx_deals_licensee_null
  ON deals(id, licensee_name)
  WHERE licensee_id IS NULL AND licensee_name IS NOT NULL;
