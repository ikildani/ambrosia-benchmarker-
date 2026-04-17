-- R72: Single-session enforcement for paid accounts.
-- Ensures only one active login per user — subsequent logins invalidate prior sessions.

-- Session nonce: set on every login, checked on every Pro API call.
-- If the nonce in the user's cookie doesn't match the DB, session is stale → force logout.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS active_session_nonce TEXT,
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_user_agent TEXT;

-- Index for fast nonce lookups in middleware
CREATE INDEX IF NOT EXISTS idx_user_profiles_session_nonce
  ON user_profiles (id, active_session_nonce);
