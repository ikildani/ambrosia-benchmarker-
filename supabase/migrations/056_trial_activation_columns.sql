-- Add trial/Pro lifecycle columns to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pro_activated_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pro_engagement_type TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tier_change_authorized BOOLEAN DEFAULT false;

-- Expand subscription_status CHECK to include 'expired'
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_subscription_status_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_subscription_status_check
  CHECK (subscription_status IN ('none', 'active', 'trialing', 'past_due', 'cancelled', 'incomplete', 'expired'));

-- Index for expiration cron lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_pro_expires
  ON user_profiles(pro_expires_at) WHERE pro_expires_at IS NOT NULL;
