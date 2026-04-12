-- Normalize user_profiles.email to lowercase + trim, and enforce it via trigger.
--
-- Background: the Stripe webhook (app/api/webhook/route.ts) falls back to matching
-- users by email when the metadata user_id lookup misses. Stripe normalizes
-- customer_email to lowercase, but our signup flow stored emails as the user typed
-- them. A user signing up with mixed-case email + paying in Stripe could end up with
-- the webhook failing the email match and never being upgraded.
--
-- The webhook itself is now patched to lowercase emails before query, but this
-- migration provides defense-in-depth: backfill all existing rows + a BEFORE trigger
-- so any future code path inserting/updating an email will normalize automatically.

-- Backfill: lowercase + trim every existing email
UPDATE user_profiles
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL AND email <> LOWER(TRIM(email));

-- Enforcement: any future insert or email update normalizes at the DB layer
CREATE OR REPLACE FUNCTION normalize_user_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := LOWER(TRIM(NEW.email));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_user_profile_email ON user_profiles;
CREATE TRIGGER trg_normalize_user_profile_email
  BEFORE INSERT OR UPDATE OF email ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION normalize_user_profile_email();
