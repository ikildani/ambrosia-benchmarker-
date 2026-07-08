-- Referral program: Pro users earn $50 credits by referring new Pro subscribers
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id),
  referrer_email TEXT NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  referee_user_id UUID REFERENCES auth.users(id),
  referee_email TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'converted', 'credited')),
  credit_amount_cents INTEGER DEFAULT 5000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  converted_at TIMESTAMPTZ,
  credited_at TIMESTAMPTZ
);

CREATE INDEX idx_referrals_code ON referrals(referral_code) WHERE status = 'pending';
CREATE INDEX idx_referrals_referrer ON referrals(referrer_user_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT
  USING (referrer_user_id = auth.uid() OR referee_user_id = auth.uid());

CREATE POLICY "Service role full access"
  ON referrals FOR ALL
  USING (auth.role() = 'service_role');
