-- 168: New signups start on Free; the Pro trial requires a card (2026-09-29).
--
-- Migration 098 gave every new signup 7 days of Pro with no card. Of ~30 of
-- those trials, one became a paying subscription. From now on the trial is a
-- Stripe subscription in `trialing` status, started from Checkout with a card
-- on file (lib/billing/pro-checkout.ts); the Stripe webhook turns Pro on.
--
-- This restores handle_new_user to what migration 011 did (create the profile,
-- nothing else) with the tier and status written out, so a new row never
-- depends on column defaults:
--   tier                = 'free'
--   subscription_status = 'none'
--
-- Users already inside a no-card trial keep it until pro_expires_at; the
-- pro-expiration cron still ends those. They can then start one card trial
-- (a no-card trial does not count against eligibility).
--
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, tier, subscription_status, updated_at)
  VALUES (NEW.id, NEW.email, 'free', 'none', NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates the user_profiles row for a new auth user on the Free tier. Pro trials are card-required Stripe subscriptions (migration 168).';
