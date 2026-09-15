-- Profile identity capture + enrichment bookkeeping.
--
-- profile_completed_at         set when the user submits the "Tell us about
--                              yourself" step (name, company, role, company type)
-- profile_prompt_dismissed_at  set when the user dismisses that step; the prompt
--                              returns on the next session until completed
-- profile_enriched_at          last time lib/enrichment/profile-enrichment.ts
--                              filled empty fields for this row
-- profile_enrichment_source    'domain' | 'companies' | 'apollo' | 'user' — where
--                              the current company / name values came from
--
-- Apply before deploying feat/profile-identity: PATCH /api/user/profile writes
-- these columns.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_prompt_dismissed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_enrichment_source TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_needs_enrichment
  ON user_profiles (created_at)
  WHERE (full_name IS NULL OR company_name IS NULL) AND profile_enriched_at IS NULL;

COMMENT ON COLUMN user_profiles.profile_enrichment_source IS
  'Origin of name/company values: user (typed at signup), apollo, companies (table match), domain (derived from email).';
