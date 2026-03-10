-- Fix "database error querying schema" on sign-in
-- Root cause: NULL recovery_token/confirmation_token in auth.users
-- GoTrue can't scan NULL into non-nullable string fields
-- Fix applied directly to auth.users via Supabase SQL editor (UPDATE, not ALTER)

-- 1. Update CHECK constraint on tier to include 'report' (one-time purchase tier)
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_tier_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_tier_check
  CHECK (tier IN ('free', 'pro', 'report'));

-- 2. Add INSERT policy so client-side upsert (onAuthStateChange) doesn't fail RLS
CREATE POLICY "Users insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Create report_purchases table (referenced by webhook handler but was missing)
CREATE TABLE IF NOT EXISTS public.report_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  calculation_inputs JSONB,
  calculation_results JSONB,
  memo_content TEXT,
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.report_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own reports" ON public.report_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own reports" ON public.report_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
