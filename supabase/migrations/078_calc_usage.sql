-- Server-side calculation usage tracking to prevent incognito/localStorage bypass.
-- Tracks by user_id for authenticated users and ip_hash for anonymous users.

CREATE TABLE IF NOT EXISTS calc_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_hash TEXT,
  count INTEGER NOT NULL DEFAULT 0,
  period TEXT NOT NULL, -- 'YYYY-MM' monthly period
  last_calc_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT calc_usage_unique_user UNIQUE (user_id, period),
  CONSTRAINT calc_usage_unique_ip UNIQUE (ip_hash, period)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_calc_usage_user_period ON calc_usage(user_id, period) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calc_usage_ip_period ON calc_usage(ip_hash, period) WHERE ip_hash IS NOT NULL;

-- RLS: only service role can access this table (API routes use service client)
ALTER TABLE calc_usage ENABLE ROW LEVEL SECURITY;

-- No public policies — all access goes through the service role client
