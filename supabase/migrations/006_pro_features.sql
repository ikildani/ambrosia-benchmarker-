-- Migration: 006_pro_features.sql
-- Pro Features: Saved Scenarios and Shared Calculations

-- =============================================
-- Saved Scenarios for Comparison
-- =============================================
CREATE TABLE IF NOT EXISTS saved_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  email TEXT, -- For localStorage users without user_profiles entry
  name VARCHAR(255) NOT NULL,
  inputs JSONB NOT NULL,
  results JSONB NOT NULL,
  labels JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_scenarios_user ON saved_scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_scenarios_email ON saved_scenarios(email);
CREATE INDEX IF NOT EXISTS idx_saved_scenarios_created ON saved_scenarios(created_at DESC);

-- RLS for saved scenarios
ALTER TABLE saved_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scenarios" ON saved_scenarios
  FOR SELECT USING (
    auth.uid() = user_id OR
    email = current_setting('request.jwt.claims', true)::json->>'email'
  );

CREATE POLICY "Users can insert own scenarios" ON saved_scenarios
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    email IS NOT NULL
  );

CREATE POLICY "Users can delete own scenarios" ON saved_scenarios
  FOR DELETE USING (
    auth.uid() = user_id OR
    email = current_setting('request.jwt.claims', true)::json->>'email'
  );

-- Service role can do everything
CREATE POLICY "Service role full access scenarios" ON saved_scenarios
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- Shared Calculations
-- =============================================
CREATE TABLE IF NOT EXISTS shared_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token VARCHAR(24) UNIQUE NOT NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  email TEXT, -- For localStorage users
  inputs JSONB NOT NULL,
  results JSONB NOT NULL,
  labels JSONB NOT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_token ON shared_calculations(share_token);
CREATE INDEX IF NOT EXISTS idx_shared_user ON shared_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_email ON shared_calculations(email);
CREATE INDEX IF NOT EXISTS idx_shared_created ON shared_calculations(created_at DESC);

-- RLS for shared calculations
ALTER TABLE shared_calculations ENABLE ROW LEVEL SECURITY;

-- Public can view if is_public and not expired
CREATE POLICY "Public read shared" ON shared_calculations
  FOR SELECT USING (
    is_public AND (expires_at IS NULL OR expires_at > NOW())
  );

-- Users can manage their own shares
CREATE POLICY "Users manage own shares" ON shared_calculations
  FOR ALL USING (
    auth.uid() = user_id OR
    email = current_setting('request.jwt.claims', true)::json->>'email' OR
    auth.role() = 'service_role'
  );

-- =============================================
-- Email Preferences
-- =============================================
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  welcome_sent BOOLEAN DEFAULT FALSE,
  calculation_receipts BOOLEAN DEFAULT TRUE,
  weekly_digest BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_prefs_email ON email_preferences(email);

ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prefs" ON email_preferences
  FOR ALL USING (
    auth.uid() = user_id OR
    auth.role() = 'service_role'
  );

-- =============================================
-- Email Logs (for tracking)
-- =============================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  email_type VARCHAR(50) NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email ON email_logs(email);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent ON email_logs(sent_at DESC);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only email logs" ON email_logs
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- Triggers
-- =============================================
CREATE OR REPLACE FUNCTION update_scenario_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_saved_scenarios_updated_at
  BEFORE UPDATE ON saved_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_scenario_updated_at();

-- Function to increment share view count
CREATE OR REPLACE FUNCTION increment_share_views(p_token VARCHAR)
RETURNS void AS $$
BEGIN
  UPDATE shared_calculations
  SET view_count = view_count + 1
  WHERE share_token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
