-- Add Stripe subscription fields and email verification support
-- Migration: 005_stripe_and_email_verification.sql

-- =============================================
-- Add Stripe fields to user_profiles
-- =============================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none'
  CHECK (subscription_status IN ('none', 'active', 'trialing', 'past_due', 'cancelled', 'incomplete'));

-- Add email verification status
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Create indexes for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id
  ON user_profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_status
  ON user_profiles(subscription_status) WHERE subscription_status != 'none';

-- =============================================
-- Subscription history table for audit trail
-- =============================================
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  event_type TEXT NOT NULL, -- 'created', 'updated', 'cancelled', 'renewed', 'payment_failed'
  previous_status TEXT,
  new_status TEXT,
  amount_cents INTEGER,
  currency TEXT DEFAULT 'usd',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX idx_subscription_history_customer_id ON subscription_history(stripe_customer_id);
CREATE INDEX idx_subscription_history_created_at ON subscription_history(created_at);

-- =============================================
-- Password reset tokens table
-- =============================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- Auto-cleanup expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_password_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Email verification tokens table
-- =============================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);

-- =============================================
-- Function to verify email
-- =============================================
CREATE OR REPLACE FUNCTION verify_email_token(p_token TEXT)
RETURNS TABLE(success BOOLEAN, user_id UUID, email TEXT, error TEXT) AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- Find valid token
  SELECT * INTO v_record
  FROM email_verification_tokens
  WHERE token = p_token
    AND expires_at > NOW()
    AND verified_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Invalid or expired token'::TEXT;
    RETURN;
  END IF;

  -- Mark token as used
  UPDATE email_verification_tokens
  SET verified_at = NOW()
  WHERE token = p_token;

  -- Update user profile
  UPDATE user_profiles
  SET email_verified = true,
      email_verified_at = NOW()
  WHERE id = v_record.user_id;

  RETURN QUERY SELECT true, v_record.user_id, v_record.email, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RLS Policies for new tables
-- =============================================
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription history
CREATE POLICY "Users read own subscription history"
  ON subscription_history FOR SELECT
  USING (auth.uid() = user_id);

-- No direct access to tokens (API routes use service role)
CREATE POLICY "No direct token access"
  ON password_reset_tokens FOR SELECT
  USING (false);

CREATE POLICY "No direct email token access"
  ON email_verification_tokens FOR SELECT
  USING (false);

-- =============================================
-- View for Pro subscribers (for admin dashboard)
-- =============================================
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT
  up.id,
  up.email,
  up.company_name,
  up.tier,
  up.subscription_status,
  up.stripe_customer_id,
  up.stripe_subscription_id,
  up.created_at as user_created_at,
  up.updated_at as subscription_updated_at
FROM user_profiles up
WHERE up.subscription_status IN ('active', 'trialing')
ORDER BY up.updated_at DESC;
