-- Manual-sequence suppression for lifecycle email crons.
--
-- drip_suppressed_until  while this timestamp is in the future, the four
--                        lifecycle crons (onboarding-drip, calculation-convert,
--                        smart-trial-extend, post-trial-drip) skip the user so a
--                        founder-led personal sequence is the only voice they hear.
--                        NULL or a past timestamp means normal automation.
--
-- Set per cohort by scripts/cohort-sep2026.ts; read via
-- lib/email/drip-suppression.ts (dripSuppressionFilter).

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS drip_suppressed_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_drip_suppressed_until
  ON user_profiles (drip_suppressed_until)
  WHERE drip_suppressed_until IS NOT NULL;

COMMENT ON COLUMN user_profiles.drip_suppressed_until IS
  'Lifecycle email crons skip this user until this time. Set for cohorts receiving a personal sequence.';
