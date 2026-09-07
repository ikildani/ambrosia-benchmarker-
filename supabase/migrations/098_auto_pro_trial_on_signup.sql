-- 098: Auto-start a 7-day Pro trial for every new signup.
--
-- Background: since Aug 2026 nearly every new signup has stayed on tier 'free'
-- because the trial only began when the user found and clicked a button that
-- calls POST /api/trial/start. This migration moves trial activation into the
-- auth.users -> user_profiles trigger so the trial is live from the first
-- session, with no click.
--
-- Column values mirror app/api/trial/start/route.ts exactly, except
-- pro_engagement_type = 'auto-trial' so the two flows stay distinguishable:
--   tier                   = 'pro'
--   tier_change_authorized = true
--   subscription_status    = 'active'
--   pro_activated_at       = now()
--   pro_expires_at         = now() + 7 days
--   pro_engagement_type    = 'auto-trial'
--
-- Downstream behaviour is unchanged:
--   * app/api/cron/pro-expiration keys on tier='pro' AND pro_expires_at <= now()
--     -> downgrades to tier='free', subscription_status='expired'.
--   * app/api/cron/post-trial-drip keys on tier='free' AND subscription_status='expired'
--     AND pro_expires_at within 1-14 days -> drip fires normally after expiry.
--   * app/api/cron/smart-trial-extend keys on tier='pro' AND pro_expires_at within 2 days.
--   * trigger_prevent_tier_escalation is BEFORE UPDATE only, so this INSERT is unaffected.
--
-- The 'trial_activated' analytics event is inserted here too. The events table
-- has RLS enabled with a SELECT-only policy for users; this function runs as
-- SECURITY DEFINER (owner = postgres) so RLS does not block the insert.
-- The event insert is wrapped so an analytics failure can never break signup.
--
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now        TIMESTAMPTZ := NOW();
  v_expires_at TIMESTAMPTZ := NOW() + INTERVAL '7 days';
  v_inserted   BOOLEAN     := FALSE;
BEGIN
  -- Create the profile with the trial already running. ON CONFLICT DO NOTHING
  -- preserves the original behaviour (never clobber an existing profile).
  INSERT INTO public.user_profiles (
    id,
    email,
    tier,
    tier_change_authorized,
    subscription_status,
    pro_activated_at,
    pro_expires_at,
    pro_engagement_type,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    'pro',
    TRUE,
    'active',
    v_now,
    v_expires_at,
    'auto-trial',
    v_now
  )
  ON CONFLICT (id) DO NOTHING;

  v_inserted := FOUND;

  -- Emit the same analytics event POST /api/trial/start emits, only when this
  -- trigger actually created the row (so a pre-existing profile is not tagged).
  IF v_inserted THEN
    BEGIN
      INSERT INTO public.events (user_id, event_type, event_data, user_tier)
      VALUES (
        NEW.id,
        'trial_activated',
        jsonb_build_object(
          'source', 'auto-trial',
          'expires_at', v_expires_at,
          'email', NEW.email
        ),
        'pro'
      );
    EXCEPTION WHEN OTHERS THEN
      -- Analytics must never block account creation.
      RAISE WARNING 'handle_new_user: trial_activated event insert failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-create the trigger idempotently (definition unchanged from 011).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates user_profiles row for a new auth user with a 7-day auto Pro trial (pro_engagement_type=auto-trial). See migration 098.';
