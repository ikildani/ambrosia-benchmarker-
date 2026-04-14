-- Enterprise API portal — API keys + usage tracking

CREATE TABLE IF NOT EXISTS enterprise_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL,
  -- API key shown once at creation; we store sha256 hash
  key_hash TEXT NOT NULL UNIQUE,
  -- Display prefix (first 8 chars) so user can identify the key
  key_prefix TEXT NOT NULL,
  -- Rate-limiting tier
  tier TEXT NOT NULL DEFAULT 'pilot' CHECK (tier IN ('pilot', 'growth', 'enterprise')),
  monthly_quota INTEGER NOT NULL DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_enterprise_api_keys_user ON enterprise_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_api_keys_hash ON enterprise_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_enterprise_api_keys_status ON enterprise_api_keys(status);

CREATE TABLE IF NOT EXISTS enterprise_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES enterprise_api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER,
  -- YYYY-MM for fast monthly aggregation without a time-series
  period_month TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_api_usage_key_period
  ON enterprise_api_usage(api_key_id, period_month);
CREATE INDEX IF NOT EXISTS idx_enterprise_api_usage_created
  ON enterprise_api_usage(created_at DESC);

ALTER TABLE enterprise_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_api_usage ENABLE ROW LEVEL SECURITY;

-- Users see only their own keys; service role has full access.
DROP POLICY IF EXISTS enterprise_api_keys_user_read ON enterprise_api_keys;
CREATE POLICY enterprise_api_keys_user_read ON enterprise_api_keys
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS enterprise_api_usage_user_read ON enterprise_api_usage;
CREATE POLICY enterprise_api_usage_user_read ON enterprise_api_usage
  FOR SELECT TO authenticated
  USING (api_key_id IN (SELECT id FROM enterprise_api_keys WHERE user_id = auth.uid()));

COMMENT ON TABLE enterprise_api_keys IS 'Enterprise API pilot keys with tier-based rate limits.';
COMMENT ON TABLE enterprise_api_usage IS 'Per-call usage tracking for enterprise API keys.';
